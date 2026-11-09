import { CONFIG, BUILDINGS, RECIPES, RECIPE_CATEGORIES, MAGIC_SKILLS, MAGIC_STUDY_CONFIG, RESEARCH } from '../core/config.js';
import { findOpenRect, findNearestResource } from './tutorial-hints.js';
import { t } from '../core/i18n.js';
import { buildingName, resourceName, buildCategoryName, recipeCategoryName } from '../core/names.js';

/**
 * Familiarity levels, chosen on the New Game screen.
 *   none     - never played a colony sim: full script with the basics explained.
 *   some     - knows the genre: the original Rifthold walkthrough.
 *   veteran  - played Rifthold: no walkthrough, just an unordered goal checklist.
 */
export const TUTORIAL_LEVELS = ['none', 'some', 'veteran'];

// Ticks a step can sit unfinished before the note offers extra help.
const STUCK_TICKS = 900;

// "A, B, C and D".
function andList(items) {
    if (items.length < 2) return items[0] || '';
    return t('tutorial.and_list', { list: items.slice(0, -1).join(t('msg.main.list_separator')), last: items[items.length - 1] });
}

// The techs with no prerequisites, read from the tree so the research step never
// names techs that don't exist.
function starterTechList() {
    return andList(Object.values(RESEARCH).filter(tech => !tech.requires || tech.requires.length === 0).map(tech => tech.name));
}
const STARTER_TECHS = starterTechList();
const WEAPONS_RECIPE_CLUB = RECIPES.craft_wooden_club ? 'craft_wooden_club' : null;

// Shown when a research step has sat for a while. Research is slow by nature, so
// point at the two levers that actually speed it up.
const RESEARCH_STUCK_HELP = t('tutorial.research.stuck_help');

// One-time popups raised by game state rather than step order. `when(game)` is
// checked on every tutorial update; the tip shows once, while nothing else is pending.
const TUTORIAL_TIPS = [
    {
        id: 'first_winter',
        // Two days before the first winter.
        when(game) {
            const w = game.weather;
            return w.year === 1 && w.season === 'autumn' && CONFIG.TICKS_PER_SEASON - w.seasonTick <= 2 * CONFIG.TICKS_PER_DAY;
        },
        text: t('tutorial.tip.first_winter'),
    },
];

// Order of the original tutorial. Old saves stored a step *index*; this maps it to an id.
const LEGACY_STEP_IDS = [
    'farm', 'gather', 'workbench', 'craft_planks', 'cooking_pot', 'cook', 'research_desk',
    'research', 'weapon', 'equip', 'tome', 'equip_tome', 'bedroom',
];

// ---------------------------------------------------------------------------
// Pointer helpers. A step's `pointer(game)` returns what the player should click
// *right now* (it changes as they progress through menus), as one of:
//   { selector, text?, label }  a DOM element (optionally filtered by its text)
//   { map: {x,y,w,h,...}, label }  a suggested rectangle on the map
//   null                         nothing to point at
// ---------------------------------------------------------------------------

const modeBtn = (action, label) => ({ selector: `#mode-bar [data-mode-action="${action}"]`, label });

function openBuild(game, type) {
    const cat = BUILDINGS[type].category;
    game.input.buildCategory = cat;
    game.input.buildOptions = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].category === cat);
    game.input.buildType = type;
    game.input.setMode('build');
}

/** Build button -> category tab -> building card -> (optional) spot on the map. */
function buildPointer(type, mapSize, mapLabel) {
    return (game) => {
        const input = game.input;
        const def = BUILDINGS[type];
        if (input.mode !== 'build') return modeBtn('build', t('tutorial.pointer.open_build'));
        if (input.buildCategory !== def.category) {
            return { selector: `#build-panel .build-tab[data-build-cat="${def.category}"]`, label: t('tutorial.pointer.open_tab', { tab: buildCategoryName(def.category) }) };
        }
        if (input.buildType !== type) {
            return { selector: `#build-panel .build-card[data-build-opt="${type}"]`, label: t('tutorial.pointer.pick', { name: buildingName(type) }) };
        }
        if (!mapSize) return null;
        const rect = game.tutorial.getMapHint(game, `build:${type}`, () => findOpenRect(game, mapSize[0], mapSize[1]));
        return rect ? { map: rect, label: mapLabel || t('tutorial.pointer.place_here') } : null;
    };
}

function recipeFor(outputKey) {
    return Object.keys(RECIPES).find(k => RECIPES[k].output && RECIPES[k].output[outputKey]);
}

/** Craft button -> recipe category tab -> recipe button (a specific one, or the first craftable). */
function craftPointer(getRecipeKey, fallbackTab, label) {
    return (game) => {
        const ui = game.ui;
        const recipeKey = getRecipeKey ? getRecipeKey() : null;
        const tab = (recipeKey && RECIPES[recipeKey]?.category) || fallbackTab;
        if (!ui.craftPanelVisible) return modeBtn('craft', t('tutorial.pointer.open_craft'));
        if ((ui._craftTab || RECIPE_CATEGORIES[0]) !== tab) {
            return { selector: `#craft-panel .craft-tab[data-craft-tab="${tab}"]`, label: t('tutorial.pointer.open_tab', { tab: recipeCategoryName(tab) }) };
        }
        const selector = recipeKey
            ? `#craft-panel [data-craft-recipe="${recipeKey}"]`
            : '#craft-panel .craft-row.craft-available > button:first-child';
        return { selector, label };
    };
}

/** Click a colonist -> click the named equipment slot in their info panel. `slotLabel` is the whole arrow label. */
function equipPointer(slot, slotLabel) {
    return (game) => {
        const pickColonist = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: t('tutorial.pointer.click_colonist') };
        if (!game.selectedColonist) return pickColonist;
        // If the info panel is showing something else, the slot is not in the DOM: point at the colonist list.
        return { selector: `[data-tut-slot="${slot}"]`, label: slotLabel, fallback: pickColonist };
    };
}

/** After a craft order is queued there is nothing left to do in the menu: point at its close button. */
function closeCraftPointer(game) {
    if (!game.ui.craftPanelVisible) return null;
    return { selector: '#craft-panel .panel-close[data-panel-close="craft"]', label: t('tutorial.pointer.close_menu') };
}

// Same rule the game uses for its "missing attunement" alerts: a living, non-golem colonist
// with fewer attuned schools than there are slots.
const needsAttunement = (c) => c.hp > 0 && !c.golem
    && (Array.isArray(c.attunedSchools) ? c.attunedSchools.length : 0) < MAGIC_STUDY_CONFIG.attunementSlots;

/**
 * Priority button -> Attunement tab -> a school cell in the first colonist who still has a free slot.
 * Each colonist gets their own pair of columns (1-2, 3-4, 5-6, ...) so the colony covers more schools.
 */
function attunePointer(game) {
    const ui = game.ui;
    if (!ui.priorityPanelVisible) return modeBtn('priority', t('tutorial.pointer.open_priority'));
    if (ui._prioTab !== 'attune') {
        return { selector: '#priority-panel [data-prio-tab="attune"]', label: t('tutorial.pointer.open_attunement_tab') };
    }
    const colonist = game.colonists.find(needsAttunement);
    if (!colonist) return null;
    const attuned = colonist.attunedSchools || [];
    // Columns follow MAGIC_SKILLS order and rows follow aliveColonists, matching the attunement grid.
    const schools = Object.keys(MAGIC_SKILLS);
    const start = (aliveColonists(game).indexOf(colonist) * MAGIC_STUDY_CONFIG.attunementSlots) % schools.length;
    const school = [...schools.slice(start), ...schools.slice(0, start)].find(k => !attuned.includes(k));
    return {
        selector: `#priority-panel td[data-colonist-id="${colonist.id}"][data-attune="${school}"]`,
        label: t('tutorial.pointer.click_school'),
    };
}

const aliveColonists = (game) => game.colonists.filter(c => c.hp > 0 && !c.golem);
const prioSnapshot = (game) => JSON.stringify(aliveColonists(game).map(c => [c.id, c.priorities]));
const needsWeapon = (c) => !c.weapon;

/** Click a colonist who still has no weapon, then their Weapon slot. */
function equipEveryonePointer(game) {
    const target = aliveColonists(game).find(needsWeapon);
    if (!target) return null;
    const row = { selector: `#colonist-hud .hud-colonist[data-colonist-id="${target.id}"]`, label: t('tutorial.pointer.click_name', { name: target.name }) };
    const sel = game.selectedColonist;
    if (!sel || sel.id !== target.id) return row;
    return { selector: '[data-tut-slot="weapon"]', label: t('tutorial.pointer.click_weapon_slot'), fallback: row };
}

// Raid pop-up -> select a colonist -> "Draft All" in their Actions list.
function draftPointer(game) {
    if (game.events?.pendingEvent?.type === 'raid') {
        return { selector: '#event-panel button[onclick="window.game.resolveEvent(0)"]', label: t('tutorial.pointer.go_to_raiders') };
    }
    const row = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: t('tutorial.pointer.click_colonist') };
    if (!game.selectedColonist) return row;
    return { selector: '.info-actions button[onclick="window.game.draftAll()"]', label: t('tutorial.pointer.draft_everyone'), fallback: row };
}

function undraftPointer(game) {
    const row = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: t('tutorial.pointer.click_colonist') };
    if (!game.selectedColonist) return row;
    return { selector: '.info-actions button[onclick="window.game.undraftAll()"]', label: t('tutorial.pointer.undraft_everyone'), fallback: row };
}

/** Priority button -> Work Priorities tab -> a farming cell. Any change completes the step. */
function workPriorityPointer(game) {
    const ui = game.ui;
    if (!ui.priorityPanelVisible) return modeBtn('priority', t('tutorial.pointer.open_priority'));
    if ((ui._prioTab || 'work') !== 'work') {
        return { selector: '#priority-panel [data-prio-tab="work"]', label: t('tutorial.pointer.open_work_priorities') };
    }
    const colonist = aliveColonists(game)[0];
    if (!colonist) return null;
    return { selector: `#priority-panel td[data-colonist-id="${colonist.id}"][data-skill="farming"]`, label: t('tutorial.pointer.change_priority') };
}

function closePriorityPointer(game) {
    if (!game.ui.priorityPanelVisible) return null;
    return { selector: '#priority-panel .panel-close[data-panel-close="priority"]', label: t('tutorial.pointer.close_menu') };
}

function closeResearchPointer(game) {
    if (!game.ui.researchPanelVisible) return null;
    return { selector: '#research-panel .panel-close[data-panel-close="research"]', label: t('tutorial.pointer.close_menu') };
}

/** Rifts button -> Expeditions tab -> realm -> party -> Launch, then collect the rewards. */
function expeditionPointer(game) {
    const ui = game.ui;
    const expl = game.exploration;
    const panelOpen = !!ui.arcanePanelVisible;
    if (expl.pendingSummary) {
        if (!panelOpen) return modeBtn('arcane', t('tutorial.pointer.open_rifts'));
        return { selector: '#arcane-panel button[onclick*="dismissSummary"]', label: t('tutorial.pointer.collect_rewards') };
    }
    if (expl.expeditions.length > 0) {
        // Running: nothing to click unless the party needs a decision. The expedition stalls until it
        // is answered, so lead the player to the first available choice. We do not pick for them.
        const waiting = expl.expeditions.some(e => !e.autoMode && (e.pendingDecision || e.pendingVoidPactChoice));
        if (!waiting) return null;
        if (!panelOpen) return modeBtn('arcane', t('tutorial.pointer.party_needs_decision'));
        return {
            selector: '#arcane-panel button:not([disabled])[onclick*="resolveExpedition"], #arcane-panel button[onclick*="resolveVoidPactChoice"]',
            label: t('tutorial.pointer.make_choice'),
        };
    }
    if (!panelOpen) return modeBtn('arcane', t('tutorial.pointer.open_rifts'));
    if ((ui._arcaneTab || 'expeditions') !== 'expeditions') {
        return { selector: '#arcane-panel [data-arcane-tab="expeditions"]', label: t('tutorial.pointer.open_expeditions_tab') };
    }
    if (!ui._arcaneExpSetup) {
        return { selector: '#arcane-panel button[onclick*="showExpeditionSetupInPanel("]', label: t('tutorial.pointer.pick_destination') };
    }
    // A lone colonist is a death sentence (the panel itself rates it "Dangerous"), so lead the player
    // through ticking every available colonist (the party holds at most 5) before launching.
    const free = document.querySelectorAll('#arcane-panel .exp-check:not(:disabled):not(:checked)');
    const picked = document.querySelectorAll('#arcane-panel .exp-check:checked').length;
    if (free.length > 0 && picked < 5) {
        return { selector: '#arcane-panel .exp-check:not(:disabled):not(:checked)', label: t('tutorial.pointer.add_everyone') };
    }
    return { selector: '#arcane-panel button[onclick*="launchExpeditionFromPanel"]', label: t('tutorial.pointer.launch') };
}

function selectFirstColonist(game) {
    const col = aliveColonists(game)[0];
    if (col) {
        game.selectedColonist = col;
        game.selectedColonists = [col];
        game.ui.showColonistInfo(col);
    }
}

const buildCount = (game, type) => game.mapIndex.getStructurePositions(type).size;

// "Acted" checks: true once the player has done what the arrow asked, even though the step is not
// complete yet (colonists still have to do the work, and a menu may keep the game paused). The
// arrow hides then. They read the task queue because every order the player gives adds a task.
const queued = (game, matches) => game.taskQueue.tasks.some(matches);
const queuedBuild = (game, type) => queued(game, t => t.type === 'build' && t.buildType === type);
const queuedGather = (game) => queued(game, t => t.type === 'chop' || t.type === 'mine');
const startedResearch = game => game.research.activeResearch !== null || game.research.completed.size > 0;
const changedPriorities = (game) => {
    const base = game.tutorial.flags.prioBaseline;
    return base !== undefined && base !== prioSnapshot(game);
};
const attunedEveryone = (game) => !game.colonists.some(needsAttunement);
const queuedCraft = (game, recipeKey) => queued(game, t => (t.type === 'craft' || t.type === 'cook') && t.recipe === RECIPES[recipeKey]);
const queuedCraftCount = (game, category) => game.taskQueue.tasks.filter(t => (t.type === 'craft' || t.type === 'cook') && t.recipe?.category === category).length;
const queuedCraftIn = (game, category) => queued(game, t => (t.type === 'craft' || t.type === 'cook') && t.recipe?.category === category);
// Walls are placed in bulk, so only count the room as started once enough pieces are down.
const wallPieces = (game) => buildCount(game, 'wood_wall') + game.taskQueue.tasks.filter(t => t.type === 'build' && t.buildType === 'wood_wall').length;

/** A step the player dismisses with a "Got it" button. */
function manualStep(step) {
    return {
        highlight: null,
        manual: true,
        goTo() {},
        pointer: null,
        ...step,
        isComplete(game) { return !!game.tutorial.flags[`ack_${step.id}`]; },
    };
}

// ---------------------------------------------------------------------------
// Steps. `levels` picks which familiarity levels see the step. `descriptionNone`
// is the longer "why this matters" text shown to first-time players.
// ---------------------------------------------------------------------------

const TUTORIAL_STEPS = [
    manualStep({
        id: 'welcome',
        levels: ['none'],
        title: t('tutorial.welcome.title'),
        description: t('tutorial.welcome.description'),
    }),
    {
        id: 'pan_camera',
        levels: ['none'],
        title: t('tutorial.pan_camera.title'),
        description: t('tutorial.pan_camera.description'),
        descriptionTouch: t('tutorial.pan_camera.description_touch'),
        highlight: null,
        isComplete(game) { return !!game.tutorial.flags.cameraMoved; },
        goTo() {},
        pointer: null,
    },
    {
        id: 'start_time',
        levels: ['none'],
        title: t('tutorial.start_time.title'),
        description: t('tutorial.start_time.description'),
        highlight: null,
        isComplete(game) { return !game.paused; },
        goTo(game) { if (game.paused) game.togglePause(); },
        pointer() { return { selector: '#btn-speed-1', label: t('tutorial.pointer.resume_game') }; },
    },
    {
        id: 'select_colonist',
        levels: ['none'],
        title: t('tutorial.select_colonist.title'),
        description: t('tutorial.select_colonist.description'),
        highlight: null,
        isComplete(game) { return !!game.selectedColonist; },
        goTo: selectFirstColonist,
        pointer() { return { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: t('tutorial.pointer.click_colonist') }; },
    },
    {
        id: 'farm',
        levels: ['none', 'some'],
        title: t('tutorial.farm.title'),
        description: t('tutorial.farm.description'),
        descriptionNone: t('tutorial.farm.description_none'),
        highlight: 'zone',
        isComplete(game) { return game.mapIndex.zones.size > 0; },
        goTo(game) { game.input.setMode('zone'); },
        pointer(game) {
            if (game.input.mode !== 'zone') return modeBtn('zone', t('tutorial.pointer.open_farm'));
            const rect = game.tutorial.getMapHint(game, 'farm', () => findOpenRect(game, 4, 3));
            return rect ? { map: rect, label: t('tutorial.pointer.drag_grass') } : null;
        },
    },
    {
        id: 'gather',
        levels: ['none', 'some'],
        title: t('tutorial.gather.title'),
        description: t('tutorial.gather.description'),
        descriptionNone: t('tutorial.gather.description_none'),
        highlight: 'gather',
        isComplete(game) { return !!game.tutorial.flags.gathered; },
        goTo(game) { game.input.setMode('designate'); },
        acted(game) { return queuedGather(game); },
        pointer(game) {
            if (game.input.mode !== 'designate') return modeBtn('gather', t('tutorial.pointer.open_gather'));
            const rect = game.tutorial.getMapHint(game, 'gather', () => findNearestResource(game, ['tree']));
            return rect ? { map: rect, label: t('tutorial.pointer.drag_trees') } : null;
        },
    },
    {
        id: 'workbench',
        levels: ['none', 'some'],
        title: t('tutorial.workbench.title'),
        description: t('tutorial.workbench.description'),
        descriptionNone: t('tutorial.workbench.description_none'),
        highlight: 'build',
        cost: BUILDINGS.workbench.cost,
        isComplete(game) { return buildCount(game, 'workbench') > 0; },
        goTo(game) { openBuild(game, 'workbench'); },
        acted(game) { return queuedBuild(game, 'workbench'); },
        pointer: buildPointer('workbench', [2, 2]),
    },
    {
        id: 'craft_planks',
        levels: ['none', 'some'],
        title: t('tutorial.craft_planks.title'),
        description: t('tutorial.craft_planks.description'),
        descriptionNone: t('tutorial.craft_planks.description_none'),
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.craftedPlanks; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraft(game, recipeFor('planks')); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(() => recipeFor('planks'), 'Materials', t('tutorial.pointer.queue_planks')),
    },
    {
        id: 'cooking_pot',
        levels: ['none', 'some'],
        title: t('tutorial.cooking_pot.title'),
        description: t('tutorial.cooking_pot.description'),
        highlight: 'build',
        cost: BUILDINGS.cooking_pot.cost,
        isComplete(game) { return buildCount(game, 'cooking_pot') > 0; },
        goTo(game) { openBuild(game, 'cooking_pot'); },
        acted(game) { return queuedBuild(game, 'cooking_pot'); },
        pointer: buildPointer('cooking_pot', [2, 2]),
    },
    {
        id: 'cook',
        levels: ['none', 'some'],
        title: t('tutorial.cook.title'),
        description: t('tutorial.cook.description'),
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.cookedMeal; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraft(game, 'cook_meal'); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(() => 'cook_meal', 'Food & Potions', t('tutorial.pointer.queue_cook_meal')),
    },
    {
        id: 'research_desk',
        levels: ['none', 'some'],
        title: t('tutorial.research_desk.title'),
        description: t('tutorial.research_desk.description'),
        highlight: 'build',
        cost: BUILDINGS.research_desk.cost,
        isComplete(game) { return buildCount(game, 'research_desk') > 0; },
        goTo(game) { openBuild(game, 'research_desk'); },
        acted(game) { return queuedBuild(game, 'research_desk'); },
        pointer: buildPointer('research_desk', [2, 2]),
    },
    {
        id: 'research',
        levels: ['none', 'some'],
        title: t('tutorial.research.title'),
        stuckHelp: RESEARCH_STUCK_HELP,
        description: t('tutorial.research.description', { techs: STARTER_TECHS }),
        descriptionNone: t('tutorial.research.description_none', { techs: STARTER_TECHS }),
        highlight: 'research',
        // Wait for the panel to close so the next step's arrows don't land on top of it.
        isComplete(game) { return startedResearch(game) && !game.ui?.researchPanelVisible; },
        goTo(game) { game.ui.toggleResearchPanel(); },
        acted: startedResearch,
        actedPointer: closeResearchPointer,
        pointer(game) {
            if (!game.ui.researchPanelVisible) return modeBtn('research', t('tutorial.pointer.open_research'));
            // `text` matches the button's label, so it must be the same string the research panel shows.
            return { selector: '#research-panel .research-node-btn', text: t('ui.research.select'), label: t('tutorial.pointer.select_technology') };
        },
    },
    {
        id: 'work_priorities',
        levels: ['none', 'some'],
        title: t('tutorial.work_priorities.title'),
        description: t('tutorial.work_priorities.description'),
        descriptionNone: t('tutorial.work_priorities.description_none'),
        highlight: 'priority',
        // Colonists do not start at the default priority, so compare against what they had when the step began.
        onEnter(game) {
            if (game.tutorial.flags.prioBaseline === undefined) game.tutorial.flags.prioBaseline = prioSnapshot(game);
        },
        // Wait for the panel to close so the next step's arrows don't land on top of it.
        isComplete(game) { return changedPriorities(game) && !game.ui?.priorityPanelVisible; },
        goTo(game) {
            const ui = game.ui;
            ui._prioTab = 'work';
            ui._lastPrioHtml = null;
            if (!ui.priorityPanelVisible) ui.togglePriorityPanel();
            else ui.updatePriorityPanel();
        },
        acted: changedPriorities,
        actedPointer: closePriorityPointer,
        pointer: workPriorityPointer,
    },
    manualStep({
        id: 'threats',
        levels: ['none'],
        title: t('tutorial.threats.title'),
        description: t('tutorial.threats.description'),
    }),
    {
        id: 'weapon',
        levels: ['none', 'some'],
        title: t('tutorial.weapon.title'),
        // Stone can be a long walk away, and the spear is the only weapon named above.
        helpText(game) {
            const club = WEAPONS_RECIPE_CLUB && RECIPES[WEAPONS_RECIPE_CLUB];
            if (!club || (game.resources.stockpile.stone || 0) >= 2) return null;
            const cost = andList(Object.entries(club.input).map(([k, v]) => t('msg.main.resource_amount', { n: v, resource: resourceName(k) })));
            return t('tutorial.weapon.help_club', { cost });
        },
        description: t('tutorial.weapon.description'),
        descriptionNone: t('tutorial.weapon.description_none'),
        highlight: 'craft',
        isComplete(game) {
            const armed = aliveColonists(game).filter(c => c.weapon).length;
            return armed + game.resources.weapons.length >= aliveColonists(game).length;
        },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) {
            const armed = aliveColonists(game).filter(c => c.weapon).length;
            return armed + game.resources.weapons.length + queuedCraftCount(game, 'Weapons') >= aliveColonists(game).length;
        },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(null, 'Weapons', t('tutorial.pointer.craft_weapon')),
    },
    {
        id: 'equip',
        levels: ['none', 'some'],
        title: t('tutorial.equip.title'),
        description: t('tutorial.equip.description'),
        descriptionNone: t('tutorial.equip.description_none'),
        highlight: null,
        isComplete(game) { return aliveColonists(game).every(c => c.weapon); },
        goTo(game) {
            const target = aliveColonists(game).find(needsWeapon) || aliveColonists(game)[0];
            if (target) {
                game.selectedColonist = target;
                game.selectedColonists = [target];
                game.ui.showColonistInfo(target);
            }
        },
        pointer: equipEveryonePointer,
    },
    // A small scripted raid, so drafting is learned by doing instead of by reading.
    {
        id: 'draft',
        levels: ['none', 'some'],
        title: t('tutorial.draft.title'),
        description: t('tutorial.draft.description'),
        highlight: null,
        applies() { return !CONFIG.PEACEFUL_MODE; },
        onEnter(game) {
            const tutorial = game.tutorial;
            if (tutorial.flags.trainingRaid) return;
            tutorial.flags.trainingRaid = true;
            if (!game.combat.raidActive) game.combat.startScriptedRaid(game, 'training_raid', 1);
        },
        isComplete(game) {
            return !!game.tutorial.flags.trainingRaid
                && (aliveColonists(game).some(c => c.drafted) || !game.combat.raidActive);
        },
        goTo: selectFirstColonist,
        pointer: draftPointer,
    },
    {
        id: 'fight',
        levels: ['none', 'some'],
        title: t('tutorial.fight.title'),
        description: t('tutorial.fight.description'),
        highlight: null,
        applies() { return !CONFIG.PEACEFUL_MODE; },
        isComplete(game) { return !game.combat.raidActive; },
        goTo(game) { if (game.paused) game.togglePause(); },
        pointer(game) {
            return game.paused ? { selector: '#btn-speed-1', label: t('tutorial.pointer.unpause') } : null;
        },
    },
    {
        id: 'undraft',
        levels: ['none', 'some'],
        title: t('tutorial.undraft.title'),
        description: t('tutorial.undraft.description'),
        highlight: null,
        applies() { return !CONFIG.PEACEFUL_MODE; },
        isComplete(game) { return !aliveColonists(game).some(c => c.drafted); },
        goTo: selectFirstColonist,
        pointer: undraftPointer,
    },
    {
        id: 'tome',
        levels: ['none', 'some'],
        title: t('tutorial.tome.title'),
        description: t('tutorial.tome.description'),
        highlight: 'craft',
        isComplete(game) { return game.resources.tomes.length > 0; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraftIn(game, 'Tomes'); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(null, 'Tomes', t('tutorial.pointer.craft_tome')),
    },
    {
        id: 'equip_tome',
        levels: ['none', 'some'],
        title: t('tutorial.equip_tome.title'),
        description: t('tutorial.equip_tome.description'),
        highlight: null,
        isComplete(game) { return game.colonists.some(c => c.equippedTome); },
        goTo: selectFirstColonist,
        pointer: equipPointer('tome', t('tutorial.pointer.click_tome_slot')),
    },
    {
        id: 'attunement',
        levels: ['none', 'some'],
        title: t('tutorial.attunement.title'),
        description: t('tutorial.attunement.description'),
        descriptionNone: t('tutorial.attunement.description_none'),
        highlight: 'priority',
        isComplete(game) { return attunedEveryone(game) && !game.ui?.priorityPanelVisible; },
        goTo(game) {
            const ui = game.ui;
            ui._prioTab = 'attune';
            ui._lastPrioHtml = null;
            if (!ui.priorityPanelVisible) ui.togglePriorityPanel();
            else ui.updatePriorityPanel();
        },
        acted: attunedEveryone,
        actedPointer: closePriorityPointer,
        pointer: attunePointer,
    },
    // Combined bedroom step for players who know the genre.
    {
        id: 'bedroom',
        levels: ['some'],
        title: t('tutorial.bedroom.title'),
        description: t('tutorial.bedroom.description'),
        highlight: 'build',
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
        goTo(game) { openBuild(game, 'wood_wall'); },
        acted(game) { return wallPieces(game) >= 8; },
        pointer: buildPointer('wood_wall', [5, 5], t('tutorial.pointer.outline_room')),
    },
    // The same goal broken into stages for first-time players.
    {
        id: 'bedroom_walls',
        levels: ['none'],
        title: t('tutorial.bedroom_walls.title'),
        description: t('tutorial.bedroom_walls.description'),
        highlight: 'build',
        isComplete(game) { return buildCount(game, 'wood_wall') >= 8; },
        goTo(game) { openBuild(game, 'wood_wall'); },
        acted(game) { return wallPieces(game) >= 8; },
        pointer: buildPointer('wood_wall', [5, 5], t('tutorial.pointer.outline_room')),
    },
    {
        id: 'bedroom_door',
        levels: ['none'],
        title: t('tutorial.bedroom_door.title'),
        description: t('tutorial.bedroom_door.description'),
        highlight: 'build',
        cost: BUILDINGS.door.cost,
        isComplete(game) { return buildCount(game, 'door') > 0; },
        goTo(game) { openBuild(game, 'door'); },
        acted(game) { return queuedBuild(game, 'door'); },
        pointer: buildPointer('door', null),
    },
    {
        id: 'bedroom_bed',
        levels: ['none'],
        title: t('tutorial.bedroom_bed.title'),
        description: t('tutorial.bedroom_bed.description'),
        highlight: 'build',
        cost: BUILDINGS.bed.cost,
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
        goTo(game) { openBuild(game, 'bed'); },
        acted(game) { return queuedBuild(game, 'bed'); },
        pointer: buildPointer('bed', null),
    },
    {
        id: 'gathering_circle',
        levels: ['none', 'some'],
        title: t('tutorial.gathering_circle.title'),
        description: t('tutorial.gathering_circle.description'),
        highlight: 'build',
        cost: BUILDINGS.gathering_circle.cost,
        isComplete(game) { return buildCount(game, 'gathering_circle') > 0; },
        goTo(game) { openBuild(game, 'gathering_circle'); },
        acted(game) { return queuedBuild(game, 'gathering_circle'); },
        pointer: buildPointer('gathering_circle', [1, 1]),
    },
    {
        id: 'expedition',
        levels: ['none', 'some'],
        title: t('tutorial.expedition.title'),
        description: t('tutorial.expedition.description'),
        highlight: 'arcane',
        isComplete(game) { return (game.stats?.expeditionsCompleted || 0) >= 1; },
        goTo(game) { game.ui.toggleArcanePanel?.(); },
        pointer: expeditionPointer,
    },
    manualStep({
        id: 'colony_growth',
        levels: ['none', 'some'],
        title: t('tutorial.colony_growth.title'),
        description: t('tutorial.colony_growth.description'),
    }),
    manualStep({
        id: 'finish',
        levels: ['none'],
        title: t('tutorial.finish.title'),
        description: t('tutorial.finish.description'),
        pointer: () => modeBtn('story', t('tutorial.pointer.story_goals')),
    }),
];

// Unordered goal list for players who already know Rifthold.
const VETERAN_GOALS = [
    {
        id: 'v_weapon',
        title: t('tutorial.v_weapon.title'),
        isComplete(game) { return game.colonists.some(c => c.weapon && c.weapon.key !== 'fists'); },
    },
    {
        id: 'v_research',
        title: t('tutorial.v_research.title'),
        isComplete(game) { return game.research.activeResearch !== null || game.research.completed.size > 0; },
    },
    {
        id: 'v_tome',
        title: t('tutorial.v_tome.title'),
        isComplete(game) { return game.colonists.some(c => c.equippedTome); },
    },
    {
        id: 'v_bedroom',
        title: t('tutorial.v_bedroom.title'),
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
    },
    {
        id: 'v_gathering_circle',
        title: t('tutorial.v_gathering_circle.title'),
        isComplete(game) { return buildCount(game, 'gathering_circle') > 0; },
    },
    {
        id: 'v_expedition',
        title: t('tutorial.v_expedition.title'),
        isComplete(game) { return (game.exploration?.expeditions?.length || 0) > 0; },
    },
];

export class TutorialSystem {
    /** @param {string} [level] One of TUTORIAL_LEVELS. */
    constructor(level = 'some') {
        this.completed = new Set(); // step ids
        this.flags = {};
        this._lastRenderedStep = -1;
        this._hint = null;
        this._stepStartTick = null;
        this._stepKey = null;
        this.setLevel(level);
    }

    /** Switches the walkthrough. Steps already completed are kept, so progress carries across levels. */
    setLevel(level) {
        this.level = TUTORIAL_LEVELS.includes(level) ? level : 'some';
        this.steps = this.level === 'veteran'
            ? VETERAN_GOALS
            : TUTORIAL_STEPS.filter(s => s.levels.includes(this.level));
        this.currentStep = 0;
        this._hint = null;
        this._skipCompleted();
    }

    get isChecklist() { return this.level === 'veteran'; }

    get totalSteps() { return this.steps.length; }

    get completedCount() {
        return this.steps.filter(s => this.completed.has(s.id)).length;
    }

    getCurrentTask() {
        if (this.isChecklist || this.currentStep >= this.steps.length) return null;
        return this.steps[this.currentStep];
    }

    isFinished() {
        return this.isChecklist
            ? this.steps.every(s => this.completed.has(s.id))
            : this.currentStep >= this.steps.length;
    }

    // `touch`: the player is on a touch screen, for steps whose text is about the mouse.
    getDescription(task, touch = false) {
        return (touch && task.descriptionTouch) || (this.level === 'none' && task.descriptionNone) || task.description;
    }

    _skipCompleted() {
        while (this.currentStep < this.steps.length && this.completed.has(this.steps[this.currentStep].id)) {
            this.currentStep++;
        }
    }

    // Detects the "did the player do X" events that no other system records.
    _trackFlags(game) {
        const task = this.getCurrentTask();
        if (!task) return;
        if (task.id === 'pan_camera' && game.camera) {
            const cam = game.camera;
            if (this.flags._camX === undefined) {
                this.flags._camX = cam.targetX;
                this.flags._camY = cam.targetY;
            } else if (cam.targetX !== this.flags._camX || cam.targetY !== this.flags._camY) {
                this.flags.cameraMoved = true;
            }
        }
    }

    update(game) {
        if (!game.settings.showTutorial) return;
        this._checkTips(game);
        if (this.isFinished()) return;

        this._trackFlags(game);

        let advanced = false;
        const finish = (step) => {
            this.completed.add(step.id);
            advanced = true;
            game.notifications?.push({ text: t('tutorial.step_done', { title: step.title }), tick: game.tick, type: 'success' });
        };

        if (this.isChecklist) {
            for (const goal of this.steps) {
                if (!this.completed.has(goal.id) && goal.isComplete(game)) finish(goal);
            }
        } else {
            while (this.currentStep < this.steps.length) {
                const step = this.steps[this.currentStep];
                if (this.completed.has(step.id)) {
                    this.currentStep++;
                } else if (step.applies && !step.applies(game)) {
                    // Not relevant right now (e.g. raid steps in peaceful mode): skip without a toast.
                    this.completed.add(step.id);
                    this.currentStep++;
                } else if (step.isComplete(game)) {
                    finish(step);
                    this.currentStep++;
                } else {
                    break;
                }
            }
        }

        // Take baselines for the step we just moved onto right away, not on the next update.
        this._trackFlags(game);

        const task = this.getCurrentTask();
        const key = task ? task.id : null;
        if (key !== this._stepKey) {
            this._stepKey = key;
            this._stepStartTick = game.tick;
            this._hint = null;
            // Steps may script something when they begin. They guard with a flag, since this also
            // runs the first time a loaded save resumes on the step.
            if (task && typeof task.onEnter === 'function') task.onEnter(game);
        }

        if (advanced && game.ui) {
            game.ui.updateTutorialNote(game);
            game.ui.updateModeDisplay(game.input);
        }
    }

    /** Raises the first due tip as an event popup (pausing like other events), once per colony. */
    _checkTips(game) {
        if (this.isChecklist || game.events.pendingEvent) return;
        for (const tip of TUTORIAL_TIPS) {
            if (this.flags[`tip_${tip.id}`] || !tip.when(game)) continue;
            this.flags[`tip_${tip.id}`] = true;
            game.events.pendingEvent = { type: 'tip', text: tip.text, choices: [t('tutorial.got_it')] };
            if (game.settings.autoPauseEvent && !game.paused) {
                game.togglePause();
                game._eventPaused = true;
            }
            return;
        }
    }

    getHighlight() {
        const task = this.getCurrentTask();
        return task ? task.highlight : null;
    }

    goTo(game) {
        const task = this.getCurrentTask();
        if (task && task.goTo) task.goTo(game);
    }

    /**
     * True while the walkthrough has a drafting lesson still ahead of it. Regular
     * raids wait until then, so the first raid a new player meets is the scripted
     * training raid, after weapons have been crafted and equipped.
     */
    holdsRaids(game) {
        if (!game.settings.showTutorial || this.isChecklist || this.isFinished()) return false;
        const draftIdx = this.steps.findIndex(s => s.id === 'draft');
        return draftIdx >= 0 && !this.completed.has('draft') && this.currentStep <= draftIdx;
    }

    /** Dismisses the current "Got it" step. */
    acknowledge(game) {
        const task = this.getCurrentTask();
        if (!task || !task.manual) return;
        this.flags[`ack_${task.id}`] = true;
        this.update(game);
        game.ui?.updateTutorialNote(game);
    }

    /** Marks the current step done without doing it, for players who are stuck. */
    skip(game) {
        const task = this.getCurrentTask();
        if (!task) return;
        this.completed.add(task.id);
        this.currentStep++;
        this._skipCompleted();
        this.update(game);
        game.ui?.updateTutorialNote(game);
        game.ui?.updateModeDisplay(game.input);
    }

    /** Applies a level chosen from Settings mid-game. */
    changeLevel(game, level) {
        game.settings.tutorialLevel = level;
        this.setLevel(level);
        this.update(game);
        game.saveSettingsToStorage?.();
        game.ui?.updateTutorialNote(game);
        game.ui?.updateModeDisplay(game.input);
    }

    /** What the arrow should point at for the current step, or null. */
    getPointer(game) {
        const task = this.getCurrentTask();
        if (!task || typeof task.pointer !== 'function') return null;
        if (typeof task.acted === 'function' && task.acted(game)) {
            return typeof task.actedPointer === 'function' ? task.actedPointer(game) : null;
        }
        return task.pointer(game);
    }

    /**
     * Returns the map suggestion for this step. Once chosen it is kept until the step changes,
     * even after the player acts on it: designating trees or placing a blueprint makes those
     * tiles "not free", and re-picking then would make the hint jump to a new spot.
     */
    getMapHint(game, key, finder) {
        if (this._hint && this._hint.key === key && this._hint.rect) return this._hint.rect;
        this._hint = { key, rect: finder() };
        return this._hint.rect;
    }

    /** Extra help text when the player cannot afford the step or has been stuck a while. */
    getHelpText(game) {
        const task = this.getCurrentTask();
        if (!task || task.manual) return null;
        // Step-specific hints that depend on the colony's state come first.
        const hint = typeof task.helpText === 'function' ? task.helpText(game) : null;
        if (hint) return hint;
        if (task.cost && game.resources?.has && !game.resources.has(task.cost)) {
            const need = Object.entries(task.cost).map(([k, v]) => t('msg.main.resource_amount', { n: v, resource: resourceName(k) })).join(t('msg.main.list_separator'));
            return t('tutorial.not_enough_materials', { need });
        }
        if (this._stepStartTick !== null && game.tick - this._stepStartTick > STUCK_TICKS) {
            return task.stuckHelp || t('tutorial.stuck_help');
        }
        return null;
    }

    serialize() {
        return {
            level: this.level,
            completedIds: [...this.completed],
            flags: { ...this.flags },
        };
    }

    restore(data) {
        if (!data) return;
        this.flags = data.flags || {};
        if (Array.isArray(data.completedIds)) {
            this.completed = new Set(data.completedIds);
            this.setLevel(data.level);
            this._completeBeforeLastDone();
            return;
        }
        // Pre-level saves stored indices into the original 13-step list.
        const upTo = data.currentStep || 0;
        const ids = new Set(LEGACY_STEP_IDS.slice(0, upTo));
        for (const i of data.completed || []) {
            if (LEGACY_STEP_IDS[i]) ids.add(LEGACY_STEP_IDS[i]);
        }
        this.completed = ids;
        this.setLevel('some');
        this._completeBeforeLastDone();
    }

    // Progress is strictly in order, so a step sitting before one the player already finished is
    // done too. This keeps steps added to the script later from reappearing in old saves.
    _completeBeforeLastDone() {
        if (this.isChecklist) return;
        let last = -1;
        this.steps.forEach((s, i) => { if (this.completed.has(s.id)) last = i; });
        for (let i = 0; i < last; i++) this.completed.add(this.steps[i].id);
        this.currentStep = 0;
        this._skipCompleted();
    }
}

import { CONFIG, BUILDINGS, RECIPES, RECIPE_CATEGORIES, MAGIC_SKILLS, MAGIC_STUDY_CONFIG } from '../core/config.js';
import { findOpenRect, findNearestResource } from './tutorial-hints.js';

/**
 * Familiarity levels, chosen on the New Game screen.
 *   none     - never played a colony sim: full script with the basics explained.
 *   some     - knows the genre: the original Rifthold walkthrough.
 *   veteran  - played Rifthold: no walkthrough, just an unordered goal checklist.
 */
export const TUTORIAL_LEVELS = ['none', 'some', 'veteran'];

// Ticks a step can sit unfinished before the note offers extra help.
const STUCK_TICKS = 900;

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
        if (input.mode !== 'build') return modeBtn('build', 'Open Build');
        if (input.buildCategory !== def.category) {
            return { selector: `#build-panel .build-tab[data-build-cat="${def.category}"]`, label: `Open the ${def.category} tab` };
        }
        if (input.buildType !== type) {
            return { selector: `#build-panel .build-card[data-build-opt="${type}"]`, label: `Pick ${def.name || type.replace(/_/g, ' ')}` };
        }
        if (!mapSize) return null;
        const rect = game.tutorial.getMapHint(game, `build:${type}`, () => findOpenRect(game, mapSize[0], mapSize[1]));
        return rect ? { map: rect, label: mapLabel || 'Click here to place it' } : null;
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
        if (!ui.craftPanelVisible) return modeBtn('craft', 'Open Craft');
        if ((ui._craftTab || RECIPE_CATEGORIES[0]) !== tab) {
            return { selector: `#craft-panel .craft-tab[data-craft-tab="${tab}"]`, label: `Open the ${tab} tab` };
        }
        const selector = recipeKey
            ? `#craft-panel [data-craft-recipe="${recipeKey}"]`
            : '#craft-panel .craft-row.craft-available > button:first-child';
        return { selector, label };
    };
}

/** Click a colonist -> click the named equipment slot in their info panel. */
function equipPointer(slot, slotLabel) {
    const pickColonist = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: 'Click a colonist' };
    return (game) => {
        if (!game.selectedColonist) return pickColonist;
        // If the info panel is showing something else, the slot is not in the DOM: point at the colonist list.
        return { selector: `[data-tut-slot="${slot}"]`, label: `Click the ${slotLabel} slot`, fallback: pickColonist };
    };
}

/** After a craft order is queued there is nothing left to do in the menu: point at its close button. */
function closeCraftPointer(game) {
    if (!game.ui.craftPanelVisible) return null;
    return { selector: '#craft-panel .panel-close[data-panel-close="craft"]', label: 'Close the menu' };
}

// Same rule the game uses for its "missing attunement" alerts: a living, non-golem colonist
// with fewer attuned schools than there are slots.
const needsAttunement = (c) => c.hp > 0 && !c.golem
    && (Array.isArray(c.attunedSchools) ? c.attunedSchools.length : 0) < MAGIC_STUDY_CONFIG.attunementSlots;

/** Priority button -> Attunement tab -> a school cell in the first colonist who still has a free slot. */
function attunePointer(game) {
    const ui = game.ui;
    if (!ui.priorityPanelVisible) return modeBtn('priority', 'Open Priority');
    if (ui._prioTab !== 'attune') {
        return { selector: '#priority-panel [data-prio-tab="attune"]', label: 'Open the Attunement tab' };
    }
    const colonist = game.colonists.find(needsAttunement);
    if (!colonist) return null;
    const attuned = colonist.attunedSchools || [];
    // Suggest the school they know best, since that is the one most likely to be useful.
    const level = (school) => (colonist.magicSkills && colonist.magicSkills[school]) || 0;
    const school = Object.keys(MAGIC_SKILLS).filter(k => !attuned.includes(k)).sort((a, b) => level(b) - level(a))[0];
    return {
        selector: `#priority-panel td[data-colonist-id="${colonist.id}"][data-attune="${school}"]`,
        label: 'Click a school to attune',
    };
}

const aliveColonists = (game) => game.colonists.filter(c => c.hp > 0 && !c.golem);
const prioSnapshot = (game) => JSON.stringify(aliveColonists(game).map(c => [c.id, c.priorities]));
const needsWeapon = (c) => !c.weapon;

/** Click a colonist who still has no weapon, then their Weapon slot. */
function equipEveryonePointer(game) {
    const target = aliveColonists(game).find(needsWeapon);
    if (!target) return null;
    const row = { selector: `#colonist-hud .hud-colonist[data-colonist-id="${target.id}"]`, label: `Click ${target.name}` };
    const sel = game.selectedColonist;
    if (!sel || sel.id !== target.id) return row;
    return { selector: '[data-tut-slot="weapon"]', label: 'Click the Weapon slot', fallback: row };
}

// Raid pop-up -> select a colonist -> "Draft All" in their Actions list.
function draftPointer(game) {
    if (game.events?.pendingEvent?.type === 'raid') {
        return { selector: '#event-panel button[onclick="window.game.resolveEvent(0)"]', label: 'Go to the raiders' };
    }
    const row = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: 'Click a colonist' };
    if (!game.selectedColonist) return row;
    return { selector: '.info-actions button[onclick="window.game.draftAll()"]', label: 'Draft everyone', fallback: row };
}

function undraftPointer(game) {
    const row = { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: 'Click a colonist' };
    if (!game.selectedColonist) return row;
    return { selector: '.info-actions button[onclick="window.game.undraftAll()"]', label: 'Undraft everyone', fallback: row };
}

/** Priority button -> Work Priorities tab -> a farming cell. Any change completes the step. */
function workPriorityPointer(game) {
    const ui = game.ui;
    if (!ui.priorityPanelVisible) return modeBtn('priority', 'Open Priority');
    if ((ui._prioTab || 'work') !== 'work') {
        return { selector: '#priority-panel [data-prio-tab="work"]', label: 'Open Work Priorities' };
    }
    const colonist = aliveColonists(game)[0];
    if (!colonist) return null;
    return { selector: `#priority-panel td[data-colonist-id="${colonist.id}"][data-skill="farming"]`, label: 'Click to change a priority' };
}

/** Research button -> Rifts tab -> the Wayfinding Select button. */
function wayfindingPointer(game) {
    const ui = game.ui;
    if (!ui.researchPanelVisible) return modeBtn('research', 'Open Research');
    if ((ui._researchTab || 'foundations') !== 'rifts') {
        return { selector: '#research-panel [data-research-tab="rifts"]', label: 'Open the Rifts tab' };
    }
    return { selector: `#research-panel button[onclick*="selectResearch('wayfinding')"]`, label: 'Research Wayfinding' };
}

function closeResearchPointer(game) {
    if (!game.ui.researchPanelVisible) return null;
    return { selector: '#research-panel .panel-close[data-panel-close="research"]', label: 'Close the menu' };
}

/** Rifts button -> Expeditions tab -> realm -> party -> Launch, then collect the rewards. */
function expeditionPointer(game) {
    const ui = game.ui;
    const expl = game.exploration;
    const panelOpen = !!ui.arcanePanelVisible;
    if (expl.pendingSummary) {
        if (!panelOpen) return modeBtn('arcane', 'Open Rifts');
        return { selector: '#arcane-panel button[onclick*="dismissSummary"]', label: 'Collect your rewards' };
    }
    if (expl.expeditions.length > 0) {
        // Running: nothing to click unless the party needs a decision. The expedition stalls until it
        // is answered, so lead the player to the first available choice. We do not pick for them.
        const waiting = expl.expeditions.some(e => !e.autoMode && (e.pendingDecision || e.pendingVoidPactChoice));
        if (!waiting) return null;
        if (!panelOpen) return modeBtn('arcane', 'Your party needs a decision');
        return {
            selector: '#arcane-panel button:not([disabled])[onclick*="resolveExpedition"], #arcane-panel button[onclick*="resolveVoidPactChoice"]',
            label: 'Make a choice',
        };
    }
    if (!panelOpen) return modeBtn('arcane', 'Open Rifts');
    if ((ui._arcaneTab || 'expeditions') !== 'expeditions') {
        return { selector: '#arcane-panel [data-arcane-tab="expeditions"]', label: 'Open the Expeditions tab' };
    }
    if (!ui._arcaneExpSetup) {
        return { selector: '#arcane-panel button[onclick*="showExpeditionSetupInPanel("]', label: 'Pick a destination' };
    }
    // A lone colonist is a death sentence (the panel itself rates it "Dangerous"), so lead the player
    // through ticking every available colonist (the party holds at most 5) before launching.
    const free = document.querySelectorAll('#arcane-panel .exp-check:not(:disabled):not(:checked)');
    const picked = document.querySelectorAll('#arcane-panel .exp-check:checked').length;
    if (free.length > 0 && picked < 5) {
        return { selector: '#arcane-panel .exp-check:not(:disabled):not(:checked)', label: 'Add everyone to the party' };
    }
    return { selector: '#arcane-panel button[onclick*="launchExpeditionFromPanel"]', label: 'Launch' };
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
        title: 'Welcome to Rifthold',
        description: 'You lead a small group of colonists. They handle the work on their own. You decide what gets farmed, gathered and built, and they get to it. Nothing happens instantly, so give them a little time.',
    }),
    {
        id: 'pan_camera',
        levels: ['none'],
        title: 'Look Around',
        description: 'Move the camera with [WASD] or the arrow keys. The mouse wheel zooms in and out.',
        highlight: null,
        isComplete(game) { return !!game.tutorial.flags.cameraMoved; },
        goTo() {},
        pointer: null,
    },
    {
        id: 'start_time',
        levels: ['none'],
        title: 'Start the Clock',
        description: 'The game starts paused so you can look around first. Press [Space] or the || button to start time. You can pause again whenever you need a moment, and orders still work while the game is paused.',
        highlight: null,
        isComplete(game) { return !game.paused; },
        goTo(game) { if (game.paused) game.togglePause(); },
        pointer() { return { selector: '#btn-pause', label: 'Start time' }; },
    },
    {
        id: 'select_colonist',
        levels: ['none'],
        title: 'Meet a Colonist',
        description: 'Click a colonist, either in the list at the bottom or on the map. Their needs, mood and gear show up in the info panel.',
        highlight: null,
        isComplete(game) { return !!game.selectedColonist; },
        goTo: selectFirstColonist,
        pointer() { return { selector: '#colonist-hud .hud-colonist[data-colonist-id]', label: 'Click a colonist' }; },
    },
    {
        id: 'farm',
        levels: ['none', 'some'],
        title: 'Plant a Farm',
        description: "Your starting food won't last long. Press [F] to Farm, then drag on grass to plant wheat or berries. Colonists handle planting and harvesting automatically.",
        descriptionNone: 'Colonists get hungry, and hungry colonists don\'t last long, so food comes first. Press [F] for Farm, then drag across open grass to mark a field. Colonists plant and harvest it on their own.',
        highlight: 'zone',
        isComplete(game) { return game.mapIndex.zones.size > 0; },
        goTo(game) { game.input.setMode('zone'); },
        pointer(game) {
            if (game.input.mode !== 'zone') return modeBtn('zone', 'Open Farm');
            const rect = game.tutorial.getMapHint(game, 'farm', () => findOpenRect(game, 4, 3));
            return rect ? { map: rect, label: 'Drag across this grass' } : null;
        },
    },
    {
        id: 'gather',
        levels: ['none', 'some'],
        title: 'Gather Resources',
        description: 'Designate trees or rocks for your colonists to harvest. Press [G] or click Gather in the mode bar, then drag over trees or rocks.',
        descriptionNone: 'Everything you build needs materials. Press [G] for Gather, then drag over trees for wood or rocks for stone. Colonists will walk over and harvest them.',
        highlight: 'gather',
        isComplete(game) { return !!game.tutorial.flags.gathered; },
        goTo(game) { game.input.setMode('designate'); },
        acted(game) { return queuedGather(game); },
        pointer(game) {
            if (game.input.mode !== 'designate') return modeBtn('gather', 'Open Gather');
            const rect = game.tutorial.getMapHint(game, 'gather', () => findNearestResource(game, ['tree']));
            return rect ? { map: rect, label: 'Drag over these trees' } : null;
        },
    },
    {
        id: 'workbench',
        levels: ['none', 'some'],
        title: 'Build a Workbench',
        description: 'A Workbench lets you craft planks, tools, and weapons. Press [B] to Build, select "Production", and place a Workbench.',
        descriptionNone: 'A Workbench is where colonists craft planks, tools and weapons. Press [B] to Build, open the Production tab, pick Workbench, and click an empty spot. If you\'re short on materials, gather some first.',
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
        title: 'Craft Planks',
        description: 'Open Craft [C] and queue a "Planks" order. Colonists will turn 2 wood into 3 planks at the workbench.',
        descriptionNone: 'Planks are a refined material that many buildings need. Open Craft [C] and queue a "Planks" order. A colonist will carry wood to the workbench and make them.',
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.craftedPlanks; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraft(game, recipeFor('planks')); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(() => recipeFor('planks'), 'Materials', 'Queue Planks'),
    },
    {
        id: 'cooking_pot',
        levels: ['none', 'some'],
        title: 'Build a Cooking Pot',
        description: 'You started with some wheat and your farm will add more, so it\'s time to turn it into cooked meals. A Cooking Pot (3 stone, 1 wood) lets colonists cook food that is more filling and gives a mood bonus.',
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
        title: 'Cook a Meal',
        description: 'Open Craft [C] and queue "Cook Meal" (5 raw foodstuffs → 4 cooked food). Meals restore more hunger and give a mood bonus. Tip: set an auto-cook target in Settings.',
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.cookedMeal; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraft(game, 'cook_meal'); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(() => 'cook_meal', 'Food & Potions', 'Queue Cook Meal'),
    },
    {
        id: 'research_desk',
        levels: ['none', 'some'],
        title: 'Build a Research Desk',
        description: 'A Research Desk generates research points to unlock new technologies. Build one from the Production tab (5 wood, 3 stone, 2 planks).',
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
        title: 'Start Researching',
        description: 'Open Research [R] and pick a technology to study. Stonework, Runecraft, and Druidcraft have no prerequisites so pick whichever sounds useful!',
        descriptionNone: 'Research unlocks new buildings, recipes and abilities. Open Research [R] and press Select on a technology. Stonework, Runecraft, and Druidcraft have no prerequisites so pick whichever sounds useful. Colonists earn the points at the Research Desk.',
        highlight: 'research',
        isComplete(game) { return game.research.activeResearch !== null || game.research.completed.size > 0; },
        goTo(game) { game.ui.toggleResearchPanel(); },
        pointer(game) {
            if (!game.ui.researchPanelVisible) return modeBtn('research', 'Open Research');
            return { selector: '#research-panel .research-node-btn', text: 'Select', label: 'Select a technology' };
        },
    },
    {
        id: 'work_priorities',
        levels: ['none', 'some'],
        title: 'Set Work Priorities',
        description: 'Every colonist starts with a specialty, shown by the 1s in the grid. Open Priority [P] and click any cell to change how much a colonist cares about that job. 1 is the highest priority, 5 is the lowest, and a dash turns the job off.',
        descriptionNone: 'Colonists pick their own jobs, and the Priority panel [P] decides what they reach for first. Every colonist starts with a specialty, shown by the 1s in the grid. Click any cell to change it. 1 is the highest priority, 5 is the lowest, and a dash turns the job off for that colonist. If a job isn\'t getting done, raise its priority.',
        highlight: 'priority',
        // Colonists do not start at the default priority, so compare against what they had when the step began.
        onEnter(game) {
            if (game.tutorial.flags.prioBaseline === undefined) game.tutorial.flags.prioBaseline = prioSnapshot(game);
        },
        isComplete(game) {
            const base = game.tutorial.flags.prioBaseline;
            return base !== undefined && base !== prioSnapshot(game);
        },
        goTo(game) {
            const ui = game.ui;
            ui._prioTab = 'work';
            ui._lastPrioHtml = null;
            if (!ui.priorityPanelVisible) ui.togglePriorityPanel();
            else ui.updatePriorityPanel();
        },
        pointer: workPriorityPointer,
    },
    manualStep({
        id: 'threats',
        levels: ['none'],
        title: 'Prepare for Trouble',
        description: 'Raiders and wild creatures will come for the colony eventually. Fires can break out in summer, and blight can spread through your crops. The game pauses on its own when a raid starts, and you can change that in Settings. Colonists fight with whatever they have equipped, so next you\'ll arm everyone. A few scouts will test your defenses once you\'re ready.',
    }),
    {
        id: 'weapon',
        levels: ['none', 'some'],
        title: 'Craft Weapons for Everyone',
        description: 'Open Craft [C], find the Weapons section, and craft a weapon for each colonist. The x5 button queues several at once. A Stone Spear only costs 2 stone and 1 wood.',
        descriptionNone: 'Your colonists will need to defend themselves from raiders, and unarmed colonists fight with their fists. Open Craft [C], find the Weapons section, and craft a weapon for each colonist. The x5 button queues several at once, and a Stone Spear only costs 2 stone and 1 wood.',
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
        pointer: craftPointer(null, 'Weapons', 'Craft a weapon'),
    },
    {
        id: 'equip',
        levels: ['none', 'some'],
        title: 'Equip Everyone',
        description: 'Click a colonist to select them, then click an empty weapon slot in their info panel to equip one of your crafted weapons. Do this for each colonist. Equipped tools also boost work speed.',
        descriptionNone: 'Crafted weapons wait in storage until a colonist equips one. Click a colonist to select them, then click their empty weapon slot in the info panel and choose a weapon. Do this for each colonist.',
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
        title: 'Raiders Attack!',
        description: 'Scouts are approaching the colony. Select a colonist and press Draft All, or press [Q] to draft just the selected colonist. Drafted colonists hold their position and fight anything in range.',
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
        title: 'Defend the Colony',
        description: 'Press [Space] to unpause and let your drafted colonists deal with them. You can right-click the map to move drafted colonists somewhere better.',
        highlight: null,
        applies() { return !CONFIG.PEACEFUL_MODE; },
        isComplete(game) { return !game.combat.raidActive; },
        goTo(game) { if (game.paused) game.togglePause(); },
        pointer(game) {
            return game.paused ? { selector: '#btn-pause', label: 'Unpause' } : null;
        },
    },
    {
        id: 'undraft',
        levels: ['none', 'some'],
        title: 'Stand Down',
        description: 'Drafted colonists stand at the ready and won\'t do any work. Select a colonist and press Undraft All so everyone goes back to their jobs.',
        highlight: null,
        applies() { return !CONFIG.PEACEFUL_MODE; },
        isComplete(game) { return !aliveColonists(game).some(c => c.drafted); },
        goTo: selectFirstColonist,
        pointer: undraftPointer,
    },
    {
        id: 'tome',
        levels: ['none', 'some'],
        title: 'Craft a Tome',
        description: 'Open Craft [C], find the Tomes section, and craft any spell tome. Your colonists can learn a wide variety of spells that can help grow your colony.',
        highlight: 'craft',
        isComplete(game) { return game.resources.tomes.length > 0; },
        goTo(game) { game.ui.toggleCraftPanel(); },
        acted(game) { return queuedCraftIn(game, 'Tomes'); },
        actedPointer: closeCraftPointer,
        pointer: craftPointer(null, 'Tomes', 'Craft any tome'),
    },
    {
        id: 'equip_tome',
        levels: ['none', 'some'],
        title: 'Equip a Tome',
        description: 'Click a colonist to select them, then click an empty tome slot in their info panel to equip your crafted tome. The colonist will automatically study the tome as part of their regular research tasks.',
        highlight: null,
        isComplete(game) { return game.colonists.some(c => c.equippedTome); },
        goTo: selectFirstColonist,
        pointer: equipPointer('tome', 'Tome'),
    },
    {
        id: 'attunement',
        levels: ['none', 'some'],
        title: 'Set Magic Attunements',
        description: 'Spells only autocast from schools a colonist is attuned to, and each colonist has 2 attunement slots. Open Priority [P], switch to the Attunement tab, and click schools in each colonist\'s row until both slots are full. A ★ marks an attuned school, and you can change them for free at any time.',
        descriptionNone: 'A colonist can learn spells from tomes, but a spell only casts on its own if its school is one they\'re attuned to. This applies at home and on expeditions. Each colonist has 2 attunement slots. Open Priority [P], switch to the Attunement tab, and click a school in each colonist\'s row to attune them. A ★ marks an attuned school. Pick schools that match the tomes you plan to use. You can change them for free at any time.',
        highlight: 'priority',
        isComplete(game) { return !game.colonists.some(needsAttunement); },
        goTo(game) {
            const ui = game.ui;
            ui._prioTab = 'attune';
            ui._lastPrioHtml = null;
            if (!ui.priorityPanelVisible) ui.togglePriorityPanel();
            else ui.updatePriorityPanel();
        },
        pointer: attunePointer,
    },
    // Combined bedroom step for players who know the genre.
    {
        id: 'bedroom',
        levels: ['some'],
        title: 'Build a Bedroom',
        description: 'Build an enclosed room (walls on all sides + a door) with a Bed inside. Valid bedrooms give colonists an ongoing mood bonus when they sleep. The same system can be used to make specialty buildings for each of your different workstations.',
        highlight: 'build',
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
        goTo(game) { openBuild(game, 'wood_wall'); },
        acted(game) { return wallPieces(game) >= 8; },
        pointer: buildPointer('wood_wall', [5, 5], 'Outline a room here'),
    },
    // The same goal broken into stages for first-time players.
    {
        id: 'bedroom_walls',
        levels: ['none'],
        title: 'Build Bedroom Walls',
        description: 'Colonists sleep better in a proper room. Build wooden walls around a small area and leave one gap for a door. Click and drag to place a line of walls. The yellow box shows a suggested spot.',
        highlight: 'build',
        isComplete(game) { return buildCount(game, 'wood_wall') >= 8; },
        goTo(game) { openBuild(game, 'wood_wall'); },
        acted(game) { return wallPieces(game) >= 8; },
        pointer: buildPointer('wood_wall', [5, 5], 'Outline a room here'),
    },
    {
        id: 'bedroom_door',
        levels: ['none'],
        title: 'Add a Door',
        description: 'A room needs a door so colonists can walk in. Pick Door from the Walls & Floors tab and place it in the gap in your wall.',
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
        title: 'Place a Bed',
        description: 'Last, put a Bed inside the room. You\'ll find it on the Furniture tab. Once the room is fully enclosed with a door and a bed, it counts as a bedroom, and colonists who sleep there get a mood bonus.',
        highlight: 'build',
        cost: BUILDINGS.bed.cost,
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
        goTo(game) { openBuild(game, 'bed'); },
        acted(game) { return queuedBuild(game, 'bed'); },
        pointer: buildPointer('bed', null),
    },
    {
        id: 'wayfinding',
        levels: ['none', 'some'],
        title: 'Research Wayfinding',
        description: 'Rifts lead to other lands. Open Research [R], switch to the Rifts tab, and research Wayfinding. It lets you send small scouting parties beyond the colony.',
        highlight: 'research',
        isComplete(game) { return game.research.isResearched('wayfinding'); },
        goTo(game) { game.ui.toggleResearchPanel(); },
        acted(game) { return game.research.activeResearch === 'wayfinding'; },
        actedPointer: closeResearchPointer,
        pointer: wayfindingPointer,
    },
    {
        id: 'expedition',
        levels: ['none', 'some'],
        title: 'Complete Your First Expedition',
        description: 'Open Rifts [V], pick The Wild Frontiers, and add all of your armed colonists to the party before you launch. The panel rates a lone colonist as Dangerous. The party fights on its own and stops now and then for you to make a choice. Keep the difficulty low for your first run. If the whole party falls, you can send everyone out again.',
        highlight: 'arcane',
        isComplete(game) { return (game.stats?.expeditionsCompleted || 0) >= 1; },
        goTo(game) { game.ui.toggleArcanePanel?.(); },
        pointer: expeditionPointer,
    },
    manualStep({
        id: 'finish',
        levels: ['none'],
        title: "You're On Your Own",
        description: 'Your colony is up and running. Keep an eye on food, mood and defenses, and stock up before the seasons change. Story [J] tracks your goals, and Rifts [V] has more realms to explore as your research grows.',
        pointer: () => modeBtn('story', 'Story goals'),
    }),
];

// Unordered goal list for players who already know Rifthold.
const VETERAN_GOALS = [
    {
        id: 'v_weapon',
        title: 'Arm a colonist',
        isComplete(game) { return game.colonists.some(c => c.weapon && c.weapon.key !== 'fists'); },
    },
    {
        id: 'v_research',
        title: 'Start a research project',
        isComplete(game) { return game.research.activeResearch !== null || game.research.completed.size > 0; },
    },
    {
        id: 'v_tome',
        title: 'Equip a spell tome',
        isComplete(game) { return game.colonists.some(c => c.equippedTome); },
    },
    {
        id: 'v_bedroom',
        title: 'Build a valid bedroom',
        isComplete(game) { return Object.keys(game.roomQualities).length > 0; },
    },
    {
        id: 'v_expedition',
        title: 'Send out an expedition (Rifts [V])',
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

    getDescription(task) {
        return (this.level === 'none' && task.descriptionNone) || task.description;
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
        if (this.isFinished()) return;

        this._trackFlags(game);

        let advanced = false;
        const finish = (step) => {
            this.completed.add(step.id);
            advanced = true;
            game.notifications?.push({ text: `Tutorial: ${step.title} ✓`, tick: game.tick, type: 'success' });
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

    getHighlight() {
        const task = this.getCurrentTask();
        return task ? task.highlight : null;
    }

    goTo(game) {
        const task = this.getCurrentTask();
        if (task && task.goTo) task.goTo(game);
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
        if (task.cost && game.resources?.has && !game.resources.has(task.cost)) {
            const need = Object.entries(task.cost).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ');
            return `You don't have enough materials yet. This needs ${need}.`;
        }
        if (this._stepStartTick !== null && game.tick - this._stepStartTick > STUCK_TICKS) {
            return 'This can take a while, since colonists need time to do the work. If nothing is happening, check Priority [P] to make sure the right jobs are turned on. You can also skip this step.';
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

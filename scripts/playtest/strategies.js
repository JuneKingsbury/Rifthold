// Play policies for the playtest bot. A strategy gets a small api from bot.js
// (the game, the home tile, logging and screenshot hooks) and exposes:
//   step()          called every 10 ticks: decide and issue player actions
//   handlePrompts() called every tick: answer events, expedition choices, summaries
//   blockedGoals()  goals the bot wants but cannot do yet (feeds the goal_blocked stall)
//   report()        end-of-run notes for summary.json
//
// The competent policy plays a sensible build: food and shelter first, a fixed
// research route to expeditions, then crypts, waves and realm chains. The novice
// policy follows the tutorial one step at a time with a reaction delay, then
// plays a weaker version of the competent policy (UI-order research, no farm
// sizing, slow to take risks).

import {
    CONFIG, BUILDINGS, RESEARCH, RECIPES, WEAPONS, ARMORS, HELMETS, SPELL_TOMES, SPELLS, REALMS,
    COLONIST_CONFIG, FARMABLE_TERRAIN, UNBUILDABLE_TERRAIN, PLANT_STRUCTURES, WALL_STRUCTURES, MAGIC_SKILLS,
} from '../../js/core/config.js';
import { designateBuild, designateGather, cancelDesignation } from '../../js/systems/building.js';
import { designateFarmZone } from '../../js/systems/farming.js';
import { getAvailableRecipes } from '../../js/systems/crafting.js';

export const PROFILES = {
    competent: { world: 'medium', policy: 'competent', autoPause: false },
    peaceful: { world: 'medium', policy: 'competent', autoPause: false, peaceful: true },
    large: { world: 'large', policy: 'competent', autoPause: false },
    // The start screen preselects the large world, so a first-timer most likely plays there.
    new: { world: 'large', policy: 'novice', autoPause: true, tutorial: 'none' },
};

const COMPETENT_RESEARCH = [
    'runecraft', 'metalworking', 'wayfinding', 'arcane_studies', 'ley_channeling', 'warrior_training',
    'alchemy', 'arcane_implements', 'runeforging', 'arcane_infusion', 'planar_rift', 'void_summoning',
    'textiles', 'auto_expedition', 'marksmanship', 'warding', 'irrigation', 'domestic_alchemy', 'herbalism',
    'fortification', 'luminance', 'arcane_conduits', 'advanced_arcana', 'void_forging', 'battle_brewing',
];

// Attunement pairs handed out by colonist index, so the colony covers several schools.
const SCHOOL_PAIRS = [
    ['evocation', 'abjuration'], ['evocation', 'enchantment'], ['abjuration', 'transmutation'],
    ['conjuration', 'evocation'], ['divination', 'abjuration'], ['enchantment', 'evocation'],
];

const WEAPON_DPS = (w) => (w.damage || 0) / (w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown || 3);

export function createStrategy(profileKey, api) {
    const profile = PROFILES[profileKey];
    return new Strategy(api, profile.policy === 'novice');
}

class Strategy {
    constructor(api, novice) {
        this.api = api;
        this.g = api.g;
        this.home = api.home;
        this.novice = novice;
        this.rand = mulberry32(1234);
        this.reserved = new Set();   // tiles promised to planned structures/farms
        this.blocked = new Map();    // goal -> first tick it was blocked
        this.crypt = null;           // the crypt currently being worked on
        this.lastWaveEndTick = 0;
        this.lastExpeditionTick = -99999;
        this.decisionsSeen = 0;
        this.firstPrompt = new Set();
        this.holdPrompt = false;
        this.bedrooms = 0;
        this.tutorialStepTick = null;
        this.tutorialStepId = null;
        this.tutorialDelay = 0;
        this.hungerScare = 0;        // novice: farm zones added after food scares
        this.periodicPanels = ['map', 'research', 'priority', 'arcane', 'craft', 'map', 'build'];
        this.notes = [];
        this._setupDone = false;
    }

    // ---- Small helpers -------------------------------------------------------
    alive() { return this.g.colonists.filter(c => c.hp > 0); }
    homeColonists() { return this.alive().filter(c => !c.onExpedition && !c.expeditionPending); }
    count(type) { return this.g.mapIndex.getStructurePositions(type).size + this.pendingBuilds(type); }
    built(type) { return this.g.mapIndex.getStructurePositions(type).size; }
    pendingBuilds(type) { return this.g.taskQueue.getAll().filter(t => t.type === 'build' && t.buildType === type).length; }
    pendingTasks(type) { return this.g.taskQueue.getAll().filter(t => t.type === type).length; }
    has(cost) { return this.g.resources.has(cost); }
    stock(k) { return this.g.resources.stockpile[k] || 0; }
    researched(k) { return this.g.research.isResearched(k); }
    day() { return this.g.tick / CONFIG.TICKS_PER_DAY; }
    every(n) { return this.g.tick % n === 0; }

    blockGoal(goal, active) {
        if (active) { if (!this.blocked.has(goal)) this.blocked.set(goal, this.g.tick); }
        else this.blocked.delete(goal);
    }
    blockedGoals() {
        // Only report goals blocked for over two days, so normal waiting is not a stall.
        const out = [];
        for (const [goal, t] of this.blocked) if (this.g.tick - t > 2 * CONFIG.TICKS_PER_DAY) out.push(goal);
        return out;
    }

    tileFree(x, y) {
        const g = this.g;
        const t = g.map[y]?.[x];
        if (!t) return false;
        if (this.reserved.has(y * 100000 + x)) return false;
        if (t.sealed || t.resource || t.zone || t.designation) return false;
        if (t.structure && !PLANT_STRUCTURES.has(t.structure)) return false;
        if (UNBUILDABLE_TERRAIN.has(t.terrain) || t.terrain === 'water') return false;
        if (t.passable === false) return false;
        if (g.ruins.getRuinAt(x, y)) return false;
        return true;
    }
    rectFree(x, y, w, h, margin, farm) {
        for (let yy = y - margin; yy < y + h + margin; yy++) {
            for (let xx = x - margin; xx < x + w + margin; xx++) {
                if (!this.tileFree(xx, yy)) return false;
                if (farm && yy >= y && yy < y + h && xx >= x && xx < x + w && !FARMABLE_TERRAIN.has(this.g.map[yy][xx].terrain)) return false;
            }
        }
        return true;
    }
    findRect(w, h, { minR = 2, maxR = 45, margin = 1, farm = false } = {}) {
        for (let r = minR; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = this.home.x + dx, y = this.home.y + dy;
                    if (this.rectFree(x, y, w, h, margin, farm)) return { x, y, w, h };
                }
            }
        }
        return null;
    }
    reserve(rect, margin = 0) {
        for (let y = rect.y - margin; y < rect.y + rect.h + margin; y++)
            for (let x = rect.x - margin; x < rect.x + rect.w + margin; x++) this.reserved.add(y * 100000 + x);
    }

    /** Places one building near home. Returns true if a build order was queued. */
    build(type, opts = {}) {
        const def = BUILDINGS[type];
        if (!def) return false;
        if (def.research && !this.researched(def.research)) return false;
        if (!this.has(def.cost)) { this.api.note(`cant_afford:${type}`); return false; }
        const spot = this.findRect(1, 1, { minR: opts.minR ?? 3, maxR: opts.maxR ?? 30, margin: 1 });
        if (!spot) { this.api.note(`no_spot:${type}`); return false; }
        if (designateBuild(this.g, spot.x, spot.y, type)) {
            this.reserve(spot, 1);
            this.api.event('bot_build', { type, x: spot.x, y: spot.y });
            return true;
        }
        this.api.note(`designate_failed:${type}`);
        return false;
    }

    farmTiles() {
        let n = 0;
        const zones = this.g.mapIndex.zones;
        if (zones && typeof zones.size === 'number') n = zones.size;
        return n;
    }
    plantFarm(w, h, crop = 'wheat') {
        const rect = this.findRect(w, h, { minR: 5, maxR: 40, margin: 1, farm: true });
        if (!rect) { this.api.note('no_farm_spot'); return false; }
        if (designateFarmZone(this.g, rect.x, rect.y, rect.x + w - 1, rect.y + h - 1, crop)) {
            this.reserve(rect, 1);
            this.api.event('bot_farm', { crop, w, h });
            return true;
        }
        return false;
    }

    /** Walled bedroom: 5x5 outline, door in the bottom middle, bed in the centre. */
    buildBedroom() {
        const cost = { wood: 15 * 2 + 3 + 5 };
        if (!this.has(cost)) return false;
        const rect = this.findRect(5, 5, { minR: 4, maxR: 35, margin: 1 });
        if (!rect) { this.api.note('no_bedroom_spot'); return false; }
        const g = this.g;
        const door = { x: rect.x + 2, y: rect.y + 4 };
        let walls = 0;
        for (let y = rect.y; y < rect.y + 5; y++) {
            for (let x = rect.x; x < rect.x + 5; x++) {
                const edge = x === rect.x || x === rect.x + 4 || y === rect.y || y === rect.y + 4;
                if (!edge || (x === door.x && y === door.y)) continue;
                if (designateBuild(g, x, y, 'wood_wall')) walls++;
            }
        }
        designateBuild(g, door.x, door.y, 'door');
        designateBuild(g, rect.x + 2, rect.y + 2, 'bed');
        this.reserve(rect, 1);
        this.bedrooms++;
        this.api.event('bot_bedroom', { x: rect.x, y: rect.y, walls });
        return true;
    }

    /** Marks the nearest n resource tiles of the given types for gathering. */
    gather(types, n) {
        const g = this.g;
        let marked = 0;
        for (let r = 1; r <= 110 && marked < n; r++) {
            for (let dy = -r; dy <= r && marked < n; dy++) {
                for (let dx = -r; dx <= r && marked < n; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = this.home.x + dx, y = this.home.y + dy;
                    const t = g.map[y]?.[x];
                    if (!t || !t.resource || t.designation || t.sealed) continue;
                    if (!types.includes(t.resource.type)) continue;
                    if (g.ruins.getRuinAt(x, y)) continue;
                    if (designateGather(g, x, y)) marked++;
                }
            }
        }
        if (marked === 0) this.api.note(`nothing_to_gather:${types.join('+')}`);
        return marked;
    }

    craftPending(category) {
        return this.g.taskQueue.getAll().filter(t => (t.type === 'craft' || t.type === 'cook') && (!category || t.recipe?.category === category)).length;
    }
    canCraft(key) {
        const e = getAvailableRecipes(this.g).find(r => r.key === key);
        return !!(e && e.canCraft);
    }
    craft(key, n = 1) {
        let q = 0;
        for (let i = 0; i < n; i++) {
            const before = this.g.taskQueue.getAll().length;
            this.g.craft(key);
            if (this.g.taskQueue.getAll().length > before) q++; else break;
        }
        if (q) this.api.event('bot_craft', { recipe: key, n: q });
        return q;
    }

    // ---- Prompts (every tick) ------------------------------------------------
    handlePrompts() {
        const g = this.g;
        const pe = g.events.pendingEvent;
        if (pe) {
            const key = `event:${pe.type}`;
            if (!this.firstPrompt.has(key)) {
                // Leave the popup up for one screenshot the first time each kind appears.
                this.firstPrompt.add(key);
                this.api.requestShot(`prompt_${pe.type}`);
                return;
            }
            this.answerEvent(pe);
        }
        for (const exp of g.exploration.expeditions) {
            if (exp.pendingDecision) {
                const key = `exp:${exp.pendingDecision.type}`;
                if (!this.firstPrompt.has(key)) {
                    this.firstPrompt.add(key);
                    this.api.requestShot(`prompt_expedition_${exp.pendingDecision.type}`, (gm) => {
                        if (!gm.ui.arcanePanelVisible) gm.ui.toggleArcanePanel();
                        return () => { if (gm.ui.arcanePanelVisible) gm.ui.toggleArcanePanel(); };
                    });
                    return;
                }
                this.answerExpedition(exp);
            } else if (exp.pendingVoidPactChoice) {
                const accept = this.novice ? this.rand() < 0.5 : false;
                g.resolveVoidPactChoice(exp.id, accept);
                this.api.event('bot_void_pact', { accept });
            }
        }
        if (g.exploration.pendingSummary) {
            const exp = g.exploration.pendingSummary;
            if (!this.firstPrompt.has('exp_summary')) {
                this.firstPrompt.add('exp_summary');
                this.api.requestShot('expedition_summary');
                return;
            }
            this.recordExpedition(exp);
            g.exploration.dismissSummary();
        }
    }

    answerEvent(pe) {
        const g = this.g;
        let choice = 0;
        switch (pe.type) {
            case 'wanderer': choice = this.alive().length < g.waves.getColonistCap(g) ? 0 : 1; break;
            case 'caravan': case 'trade': choice = 1; break;
            case 'raid': choice = 1; break;
            case 'research_complete': choice = 0; break;
            case 'void_whisper': choice = this.rand() < 0.5 ? 0 : 1; break;
            default: choice = 0;
        }
        g.resolveEvent(choice);
        // Anything resolveEvent does not know how to close would block new events forever.
        if (g.events.pendingEvent === pe) { g.events.pendingEvent = null; this.api.note(`event_force_closed:${pe.type}`); }
        this.api.event('bot_answer', { prompt: pe.type, choice });
    }

    answerExpedition(exp) {
        const g = this.g;
        const pd = exp.pendingDecision;
        this.decisionsSeen++;
        let ok = false;
        if (pd.type === 'decision') {
            const idx = Math.floor(this.rand() * pd.choices.length);
            g.resolveExpeditionDecision(exp.id, idx);
            ok = true;
        } else if (pd.type === 'puzzle') {
            g.resolveExpeditionPuzzle(exp.id, 0);
        } else if (pd.type === 'npc') {
            g.resolveExpeditionNpc(exp.id, 0);
        } else if (pd.type === 'trap') {
            g.resolveExpeditionTrap(exp.id, 0);
        }
        // Fall back to skipping if the first option was not valid.
        if (exp.pendingDecision === pd) {
            if (pd.type === 'puzzle') g.resolveExpeditionPuzzle(exp.id, -1);
            else if (pd.type === 'npc') g.resolveExpeditionNpc(exp.id, -1);
            else if (pd.type === 'trap') g.resolveExpeditionTrap(exp.id, -1);
            else if (pd.type === 'decision') g.resolveExpeditionDecision(exp.id, 0);
        }
        if (exp.pendingDecision === pd) { g.exploration._autoResolvePendingDecision(exp, g); this.api.note('exp_decision_autoresolved'); }
        this.api.event('bot_exp_choice', { type: pd.type, ok });
    }

    recordExpedition(exp) {
        const s = exp.summary || {};
        const party = (exp.partySnapshot || []).map(p => ({ name: p.name, hp: Math.round(p.hp), maxHp: Math.round(p.maxHp || 0) }));
        const flat = {};
        for (const [k, v] of Object.entries(s)) if (typeof v !== 'object' || v === null) flat[k] = v;
        const rec = {
            realm: exp.realmKey || exp.dimensionKey || exp.realm, tick: this.g.tick, day: +this.day().toFixed(2),
            started: exp.startTick, durationTicks: exp.startTick ? this.g.tick - exp.startTick : null,
            difficulty: exp.difficulty, auto: !!exp.autoMode, result: exp.result || exp.outcome || exp.status,
            party, summary: flat,
        };
        this.api.summary.expeditions.push(rec);
        this.api.event('expedition_result', { realm: rec.realm, result: rec.result, partyDead: party.filter(p => p.hp <= 0).length });
    }

    // ---- Main decision step (every 10 ticks) ----------------------------------
    step() {
        const g = this.g;
        if (!this._setupDone) this.setup();
        if (this.novice && g.settings.showTutorial && !g.tutorial.isFinished()) {
            this.tutorialStep();
            this.survivalReflex();
            this.defend();
            return;
        }
        if (this.novice && !this._tutorialDoneLogged) {
            this._tutorialDoneLogged = true;
            this.api.milestone('tutorial_finished');
        }
        this.defend();
        if (this.every(30)) this.chooseResearch();
        if (this.every(60)) this.economy();
        if (this.every(60)) this.gear();
        if (this.every(90)) this.cryptWork();
        if (this.every(120)) this.waveWork();
        if (this.every(60)) this.expeditionWork();
    }

    setup() {
        this._setupDone = true;
        if (this.novice) return;
        // A competent player makes the best student the researcher and keeps cooking going.
        const cs = this.alive();
        const best = cs.slice().sort((a, b) => (b.skills.research || 0) - (a.skills.research || 0))[0];
        for (const c of cs) {
            c.priorities.research = c === best ? 1 : 3;
            c.priorities.cooking = Math.min(c.priorities.cooking ?? 3, 2);
        }
        this.api.event('bot_priorities', { researcher: best?.name });
    }

    // ---- Research --------------------------------------------------------------
    chooseResearch() {
        const r = this.g.research;
        if (r.activeResearch) return;
        if (!this.g.mapIndex.findFirst('research_desk')) return;
        const avail = r.getAvailable().map(t => t.key);
        if (!avail.length) return;
        let pick = null;
        if (this.novice) {
            pick = avail[0];   // the first Select button in the panel
        } else {
            pick = COMPETENT_RESEARCH.find(k => avail.includes(k))
                || avail.slice().sort((a, b) => RESEARCH[a].cost - RESEARCH[b].cost)[0];
        }
        if (this.g.research.selectResearch(pick)) this.api.event('bot_research', { key: pick });
    }

    // ---- Food, materials, buildings ------------------------------------------
    economy() {
        const g = this.g;
        const n = this.alive().length;
        const season = g.weather.season;

        // Food. Competent: ~7 tiles a colonist, planted ahead of winter. Novice: the
        // tutorial's field, plus one more after each food scare.
        const targetTiles = this.novice ? 12 * (1 + this.hungerScare) : n * 7 + 6;
        if (this.farmTiles() < targetTiles && season !== 'winter') {
            const crop = (!this.novice && this.farmTiles() >= 12 && this.farmTiles() < 18) ? 'berries' : 'wheat';
            this.plantFarm(4, 3, crop);
        }
        if (!this.novice) {
            if (this.built('cooking_pot')) g.settings.autoCookTarget = n * 4;
        } else {
            this.survivalReflex();
        }

        // Core buildings, in tutorial order.
        if (!this.count('workbench')) { this.build('workbench'); this.blockGoal('workbench', !this.count('workbench')); }
        else if (!this.count('cooking_pot')) this.build('cooking_pot');
        else if (!this.count('research_desk')) this.build('research_desk');

        // Materials. Keep gather orders topped up while stocks are low.
        const chop = this.pendingTasks('chop'), mine = this.pendingTasks('mine');
        const woodWant = this.novice ? 25 : 60;
        if (this.stock('wood') < woodWant && chop < 6) this.gather(['tree'], 8);
        if (this.stock('stone') < (this.novice ? 15 : 40) && mine < 4) this.gather(['stone'], 6);
        if (this.researched('metalworking') && this.stock('iron') + this.stock('iron_ore') < 12 && mine < 6) this.gather(['iron_ore'], 4);
        if (!this.novice || this.day() > 15) {
            if (this.stock('runite_ore') + this.stock('runite') < 12 && mine < 8) {
                const got = this.gather(['runite_ore'], 4);
                this.blockGoal('no_runite_ore_nearby', got === 0 && this.pendingTasks('mine') === 0 && this.stock('runite') < 5);
            }
        }
        if (this.count('workbench') && this.built('workbench')) {
            if (this.stock('planks') < 20 && this.stock('wood') >= 8 && this.craftPending('Materials') < 2) this.craft('craft_planks', 2);
            if (this.researched('metalworking') && this.stock('bricks') < 6 && this.stock('stone') >= 10 && this.craftPending('Materials') < 3) this.craft('craft_bricks', 1);
            if (this.stock('hides') >= 2 && this.stock('leather') < 6) this.craft('tan_leather', 1);
        }
        if (this.built('anvil')) {
            if (this.stock('iron_ore') >= 2) this.craft('smelt_iron', 1);
            if (this.researched('runeforging') && this.stock('runite_ore') >= 2) this.craft('smelt_runite', 1);
        }
        // Leather for the scriptorium and bows comes from hides, so hunt when there are none.
        if (this.stock('hides') + this.stock('leather') < 3 && this.pendingTasks('hunt') === 0 && this.day() > 3) this.hunt();

        if (!this.built('workbench') || !this.built('research_desk')) return;

        // Shelter and comfort.
        if (this.bedrooms < Math.min(n, this.novice ? 1 : n) && this.day() > (this.novice ? 6 : 2)) this.buildBedroom();
        if (this.count('food_chest') < (this.novice ? 0 : 2) && this.day() > 3) this.build('food_chest');
        if ((season === 'autumn' || season === 'winter') && this.count('campfire') < (this.novice ? 1 : 2)) this.build('campfire', { minR: 2, maxR: 8 });
        if (!this.novice && this.count('research_desk') < 2 && n >= 3 && this.day() > 5) this.build('research_desk');

        // Tech buildings as research unlocks them.
        if (this.researched('metalworking') && !this.count('anvil')) { const ok = this.build('anvil'); this.blockGoal('anvil', !ok && !this.count('anvil')); }
        if (this.researched('ley_channeling')) {
            const spare = g.power.totalGenerated - g.power.totalConsumed;
            const want = this.researched('arcane_infusion') ? (spare < 4 ? this.count('mana_crystal') + 1 : 0) : 2;
            if (this.count('mana_crystal') < Math.min(4 + (g.mana_crystalBonus || 0), Math.max(2, want))) this.build('mana_crystal');
            // Hearth Shrine slots open with milestones; designateBuild enforces the cap.
            if (this.alive().length >= g.waves.getColonistCap(g) && this.has(BUILDINGS.hearth_shrine.cost)) {
                if (this.build('hearth_shrine')) this.api.milestone(`shrine_${this.count('hearth_shrine')}`);
            }
        }
        if (this.researched('arcane_studies') && !this.count('scriptorium')) { const ok = this.build('scriptorium'); this.blockGoal('scriptorium(leather)', !ok && !this.count('scriptorium')); }
        if (this.researched('arcane_infusion') && !this.count('enchanting_table')) this.build('enchanting_table');
        if (this.researched('alchemy') && !this.count('alchemy_table') && !this.novice) this.build('alchemy_table');
        if (this.researched('textiles') && !this.count('loom') && !this.novice) this.build('loom');
        if (this.researched('void_summoning') && !this.count('void_nexus')) {
            const ok = this.build('void_nexus', { minR: 6, maxR: 20 });
            this.blockGoal('void_nexus(runite)', !ok && !this.count('void_nexus'));
        }
    }

    hunt() {
        const g = this.g;
        let best = null, bd = Infinity;
        for (const a of g.wildAnimals) {
            if (a.hp <= 0 || a.tamed || a.hostile || a.guardian) continue;
            const d = Math.abs(a.x - this.home.x) + Math.abs(a.y - this.home.y);
            if (d < bd && d < 50) { bd = d; best = a; }
        }
        if (best) { g.huntAnimal(best.id); this.api.event('bot_hunt', { type: best.type }); }
    }

    /** Novice-only food habits: cook by hand when meals run low, add a field after a scare. */
    survivalReflex() {
        const g = this.g;
        const n = this.alive().length;
        if (!this.built('cooking_pot')) return;
        if (this.stock('food') < n && g.resources.getFoodstuffTotal() >= 6 && this.craftPending('Food & Potions') === 0) this.craft('cook_meal', 2);
        const hungry = this.homeColonists().some(c => c.needs.hunger < 15);
        if (hungry && g.tick - (this._lastScare || -99999) > 2 * CONFIG.TICKS_PER_DAY) {
            this._lastScare = g.tick;
            this.hungerScare++;
            this.api.event('bot_food_scare', { scares: this.hungerScare });
        }
    }

    // ---- Gear --------------------------------------------------------------------
    gear() {
        const g = this.g;
        if (!this.built('workbench')) return;
        const homeC = this.homeColonists();
        const unarmed = homeC.filter(c => !c.weapon).length;
        const weaponRecipes = getAvailableRecipes(g).filter(r => r.recipe.category === 'Weapons' && r.canCraft);
        const best = weaponRecipes
            .map(r => ({ key: r.key, w: WEAPONS[Object.keys(r.recipe.output)[0]] }))
            .filter(x => x.w)
            .sort((a, b) => this.novice ? 0 : WEAPON_DPS(b.w) - WEAPON_DPS(a.w))[0];
        if (unarmed > g.resources.weapons.length && best && this.craftPending('Weapons') === 0) {
            // The novice follows the tutorial's suggestion: the cheap Stone Spear.
            const key = this.novice && this.canCraft('craft_stone_spear') ? 'craft_stone_spear' : best.key;
            this.craft(key, unarmed - g.resources.weapons.length);
        } else if (!this.novice && best && this.craftPending('Weapons') === 0) {
            const worst = homeC.filter(c => c.weapon).sort((a, b) => WEAPON_DPS(a.weapon) - WEAPON_DPS(b.weapon))[0];
            if (worst && WEAPON_DPS(best.w) > WEAPON_DPS(worst.weapon) * 1.25 && g.resources.weapons.length === 0) this.craft(best.key, 1);
        }
        // Armor once the basics are up.
        if (!this.novice && this.day() > 6 && this.craftPending('Armor') === 0) {
            const armorRecipes = getAvailableRecipes(g).filter(r => r.recipe.category === 'Armor' && r.canCraft);
            const needArmor = homeC.some(c => !c.armor) && g.resources.armors.length === 0;
            const a = armorRecipes.find(r => ARMORS[Object.keys(r.recipe.output)[0]]);
            if (needArmor && a) this.craft(a.key, 1);
            const needHelm = homeC.some(c => !c.helmet) && g.resources.helmets.length === 0;
            const h = armorRecipes.find(r => HELMETS[Object.keys(r.recipe.output)[0]]);
            if (needHelm && h) this.craft(h.key, 1);
        }
        for (const c of homeC) {
            if (g.resources.weapons.length || g.resources.armors.length || g.resources.helmets.length || g.resources.boots.length) g.autoEquipBest(c.id);
        }
        this.tomes(homeC);
    }

    tomes(homeC) {
        const g = this.g;
        if (this.novice && this.day() < 10) return;
        homeC.forEach((c, i) => {
            if (!Array.isArray(c.attunedSchools)) c.attunedSchools = [];
            if (c.attunedSchools.length < 2) {
                for (const s of SCHOOL_PAIRS[i % SCHOOL_PAIRS.length]) if (!c.attunedSchools.includes(s)) g.toggleAttunement(c.id, s);
            }
        });
        // Hand out stored tomes, then craft one for a colonist with nothing to study.
        for (const c of homeC) {
            if (c.equippedTome || !g.resources.tomes.length) continue;
            const idx = g.resources.tomes.findIndex(t => c.attunedSchools.includes(SPELLS[SPELL_TOMES[t.key]?.spell]?.school));
            g.equipTome(c.id, idx >= 0 ? idx : 0);
        }
        const student = homeC.find(c => !c.equippedTome);
        if (!student || g.resources.tomes.length || this.craftPending('Tomes')) return;
        const options = getAvailableRecipes(g).filter(r => r.recipe.category === 'Tomes' && r.canCraft).filter(r => {
            const tomeKey = Object.keys(r.recipe.output)[0];
            const spell = SPELL_TOMES[tomeKey]?.spell;
            return spell && student.attunedSchools.includes(SPELLS[spell]?.school) && !(student.knownSpells || []).includes(spell);
        });
        // Keep runite for buildings until there is plenty of it.
        const cheap = options.filter(r => !r.recipe.input.runite || this.stock('runite') > 10);
        if (cheap.length) this.craft(cheap[0].key, 1);
    }

    // ---- Combat --------------------------------------------------------------------
    hostilesNear(radius = 18) {
        const g = this.g;
        const near = (e) => e.hp > 0 && Math.abs(e.x - this.home.x) + Math.abs(e.y - this.home.y) <= radius;
        return g.raiders.some(near) || g.waves.enemies.some(near) || g.entities.some(e => e.hostile && !e.tamed && near(e));
    }
    defend() {
        const g = this.g;
        const guardianFight = this.crypt?.phase === 'fight';
        const threat = g.combat.raidActive || (g.waves.active && g.waves.enemies.length > 0) || this.hostilesNear() || guardianFight;
        const drafted = this.homeColonists().some(c => c.drafted);
        if (threat && !drafted) {
            // The novice drafts only when the tutorial says to, or when a raid is plainly on.
            if (this.novice && !(g.combat.raidActive || g.waves.active)) return;
            g.draftAll();
            if (g.waves.active && g.waves.nexusPosition) g.rallyDrafted(g.waves.nexusPosition.x, g.waves.nexusPosition.y + 2);
            else if (guardianFight && this.crypt.entry) g.rallyDrafted(this.crypt.entry.x, this.crypt.entry.y);
            this.api.event('bot_draft', { reason: g.combat.raidActive ? 'raid' : g.waves.active ? 'wave' : guardianFight ? 'guardians' : 'hostile_near' });
        } else if (!threat && drafted) {
            if (this.novice && g.settings.showTutorial && !g.tutorial.isFinished()) return; // tutorial handles undraft
            g.undraftAll();
            this.api.event('bot_undraft', {});
        }
    }

    // ---- Crypts: breach, clear guardians, loot, attune anchors --------------------
    cryptWork() {
        const g = this.g;
        const homeC = this.homeColonists();
        const armed = homeC.length > 0 && homeC.every(c => c.weapon);
        if (!this.crypt) {
            const minDay = this.novice ? 20 : 6;
            if (this.day() < minDay || !armed || homeC.length < Math.min(3, this.alive().length) || g.combat.raidActive || g.waves.active) return;
            const candidates = g.ruins.list.filter(r => r.kind === 'crypt' && r.state === 'sealed' && !r.ward);
            if (!candidates.length) return;
            const dist = r => Math.abs(r.x + r.w / 2 - this.home.x) + Math.abs(r.y + r.h / 2 - this.home.y);
            // Prefer crypts with a rift anchor once Planar Rifts is close; otherwise the nearest.
            candidates.sort((a, b) => (this.researched('planar_rift') ? (!!b.anchor - !!a.anchor) * 1000 : 0) + dist(a) - dist(b));
            const ruin = candidates[0];
            const entry = this.cryptEntry(ruin);
            if (!entry) { this.api.note('crypt_no_entry'); return; }
            cancelDesignation(g, entry.wall.x, entry.wall.y);
            this.crypt = { ruin, entry: entry.outside, phase: 'breach', since: g.tick };
            this.api.event('bot_crypt_breach', { tier: ruin.tier, anchor: ruin.anchor?.chain || null, dist: Math.round(dist(ruin)) });
            this.api.summary.crypts.push({ tick: g.tick, day: +this.day().toFixed(2), tier: ruin.tier, anchor: ruin.anchor?.chain || null, guardians: (ruin.guardians || []).length });
            return;
        }
        const c = this.crypt;
        const ruin = c.ruin;
        if (c.phase === 'breach') {
            if (ruin.state !== 'sealed') { c.phase = 'fight'; c.since = g.tick; this.api.milestone('first_crypt_breached'); }
            else if (g.tick - c.since > 3 * CONFIG.TICKS_PER_DAY) { this.api.note('crypt_breach_timeout'); this.crypt = null; }
            return;
        }
        if (c.phase === 'fight') {
            const guardians = g.entities.filter(e => e.guardian && e.hp > 0 && e.x >= ruin.x - 4 && e.x < ruin.x + ruin.w + 4 && e.y >= ruin.y - 4 && e.y < ruin.y + ruin.h + 4);
            if (!guardians.length || g.tick - c.since > 2 * CONFIG.TICKS_PER_DAY) {
                if (guardians.length) this.api.note('crypt_guardians_survived');
                c.phase = 'loot'; c.since = g.tick;
                g.undraftAll();
            }
            return;
        }
        if (c.phase === 'loot') {
            let queued = 0;
            for (let y = ruin.y; y < ruin.y + ruin.h; y++) {
                for (let x = ruin.x; x < ruin.x + ruin.w; x++) {
                    const t = g.map[y][x];
                    if ((t.structure === 'ancient_chest' || t.structure === 'rift_anchor') && !t.designation) { cancelDesignation(g, x, y); queued++; }
                }
            }
            if (queued) this.api.event('bot_crypt_loot', { queued });
            const left = this.pendingTasks('loot_chest') + this.pendingTasks('attune_anchor');
            if ((left === 0 && g.tick - c.since > 100) || g.tick - c.since > 4 * CONFIG.TICKS_PER_DAY) {
                if (ruin.anchor?.attuned) this.api.milestone(`anchor_${ruin.anchor.chain}`);
                this.crypt = null;
            }
        }
    }

    /** A wall tile on the crypt ring with an open, reachable tile outside it, nearest home. */
    cryptEntry(ruin) {
        const g = this.g;
        let best = null, bd = Infinity;
        for (let y = ruin.y; y < ruin.y + ruin.h; y++) {
            for (let x = ruin.x; x < ruin.x + ruin.w; x++) {
                const t = g.map[y][x];
                if (!t.structure || !WALL_STRUCTURES.has(t.structure) || t.structure === 'warded_wall') continue;
                for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                    const ox = x + dx, oy = y + dy;
                    const o = g.map[oy]?.[ox];
                    if (!o || g.ruins.getRuinAt(ox, oy) === ruin || !o.passable) continue;
                    const d = Math.abs(ox - this.home.x) + Math.abs(oy - this.home.y);
                    if (d < bd) { bd = d; best = { wall: { x, y }, outside: { x: ox, y: oy } }; }
                }
            }
        }
        return best;
    }

    // ---- Waves -------------------------------------------------------------------
    waveWork() {
        const g = this.g;
        if (g.waves.active) { this._waveWasActive = true; return; }
        if (this._waveWasActive) { this._waveWasActive = false; this.lastWaveEndTick = g.tick; }
        if (!g.waves.canStartWave(g)) return;
        const homeC = this.homeColonists();
        const healthy = homeC.length >= 2 && homeC.every(c => c.hp > c.maxHp * 0.8 && c.weapon);
        const gap = (this.novice ? 6 : 2) * CONFIG.TICKS_PER_DAY;
        if (!healthy || g.combat.raidActive || this.crypt || g.tick - this.lastWaveEndTick < gap) return;
        g.startWave();
        if (g.waves.active) {
            this._waveWasActive = true;
            this.api.event('bot_wave_start', { wave: g.waves.currentWave });
            if (this.api.milestone('first_wave_started')) this.api.requestShot('first_wave', (gm) => { gm.camera.centerOn(gm.waves.nexusPosition.x, gm.waves.nexusPosition.y); });
        }
    }

    // ---- Expeditions ---------------------------------------------------------------
    expeditionWork() {
        const g = this.g;
        const ex = g.exploration;
        if (g.combat.raidActive || g.waves.active || this.crypt?.phase === 'fight') return;
        const manualOut = ex.expeditions.some(e => e.status !== 'complete' && !e.autoMode);
        const realms = ex.getAvailableRealms(g).filter(r => ex.canSend(g, r.key));
        const fresh = realms.filter(r => !ex.completedRealms.has(r.key)).sort((a, b) => (a.difficulty - b.difficulty) || ((a.chainOrder || 0) - (b.chainOrder || 0)));
        const blockedFresh = ex.getAvailableRealms(g).filter(r => !ex.completedRealms.has(r.key) && !ex.canSend(g, r.key));
        // Before Planar Rifts every anchored realm is unsendable by design, so only flag it after.
        if (this.researched('planar_rift')) this.blockGoal(`expedition(${blockedFresh.map(r => r.key).join(',')})`, blockedFresh.length > 0 && fresh.length === 0);
        let target = fresh[0];
        let auto = false;
        if (!target && realms.length && g.tick - this.lastExpeditionTick > 3 * CONFIG.TICKS_PER_DAY && !this.novice) {
            // Nothing new to clear: farm the hardest cleared realm for loot.
            target = realms.slice().sort((a, b) => b.difficulty - a.difficulty)[0];
            auto = ex.canSendAuto(g);
        }
        if (!target) return;
        if (!auto && manualOut) return;
        const homeC = this.homeColonists();
        const keepHome = homeC.length >= 5 ? 2 : homeC.length >= 3 ? 1 : 0;
        const ready = homeC.filter(c => !c.drafted && c.weapon && c.hp >= c.maxHp * 0.7 && !ex.isFatigued(c.id, g.tick) && !(c.traits || []).includes('pacifist'));
        ready.sort((a, b) => WEAPON_DPS(b.weapon) - WEAPON_DPS(a.weapon));
        const size = Math.min(5, ready.length, homeC.length - keepHome);
        if (size < (target.scoutingMode ? 1 : 2)) { this.api.note('expedition_party_too_small'); return; }
        const ids = ready.slice(0, size).map(c => c.id);
        const exp = ex.sendExpedition(g, target.key, ids, [], 1, { autoMode: auto });
        if (exp) {
            this.lastExpeditionTick = g.tick;
            this.api.event('bot_expedition', { realm: target.key, party: ids.length, auto });
            if (this.api.milestone('first_expedition_sent')) {
                this.api.requestShot('first_expedition', (gm) => {
                    if (!gm.ui.arcanePanelVisible) gm.ui.toggleArcanePanel();
                    return () => { if (gm.ui.arcanePanelVisible) gm.ui.toggleArcanePanel(); };
                });
            }
        } else {
            this.api.note(`expedition_send_failed:${target.key}`);
        }
    }

    // ---- Tutorial (novice) -----------------------------------------------------------
    tutorialStep() {
        const g = this.g;
        const tut = g.tutorial;
        const step = tut.getCurrentTask();
        if (!step) return;
        if (step.id !== this.tutorialStepId) {
            if (this.tutorialStepId) {
                this.api.summary.tutorial.push({ id: this.tutorialStepId, startTick: this.tutorialStepTick, endTick: g.tick, ticks: g.tick - this.tutorialStepTick, day: +this.day().toFixed(2), stuckHelpShown: !!this._stuckShown });
            }
            this.tutorialStepId = step.id;
            this.tutorialStepTick = g.tick;
            this._stuckShown = false;
            this._acted = false;
            // A first-timer reads the note before acting: 30-90 s of game time.
            this.tutorialDelay = 150 + Math.floor(this.rand() * 300);
            this.api.event('tutorial_step', { id: step.id });
            this.api.requestShot(`tutorial_${step.id}`, (gm) => {
                try { gm.tutorial.goTo(gm); } catch { /* some steps open nothing */ }
                return () => closePanels(gm);
            });
        }
        if (!this._stuckShown && tut.getHelpText(g)) {
            const help = tut.getHelpText(g);
            if (/while/.test(help)) {
                this._stuckShown = true;
                this.api.event('tutorial_stuck_help', { id: step.id });
                this.api.requestShot(`tutorial_stuck_${step.id}`);
            }
        }
        if (g.tick - this.tutorialStepTick < this.tutorialDelay) return;
        // Steps that need repeating (waiting on materials) retry every 2 days of game time.
        if (this._acted && g.tick - this._actedTick < 2 * CONFIG.TICKS_PER_DAY) return;
        this._acted = true;
        this._actedTick = g.tick;
        this.doTutorialAction(step);
    }

    doTutorialAction(step) {
        const g = this.g;
        const cs = this.alive();
        const id = step.id;
        const hint = (w, h) => this.findRect(w, h, { minR: 2, maxR: 30, margin: 0 });
        switch (id) {
            case 'welcome': case 'threats': case 'finish': g.tutorial.acknowledge(g); break;
            case 'pan_camera': g.camera.centerOn(this.home.x + 6, this.home.y + 3); break;
            case 'start_time': break;
            case 'select_colonist': g.selectedColonist = cs[0]; g.selectedColonists = [cs[0]]; g.ui.showColonistInfo(cs[0]); break;
            case 'farm': this.plantFarm(4, 3, 'wheat'); break;
            case 'gather': this.gather(['tree'], 9); break;
            case 'workbench': case 'cooking_pot': case 'research_desk': {
                if (!this.build(id)) this.gather(['tree'], 6) || this.gather(['stone'], 4);
                break;
            }
            case 'craft_planks': this.craft('craft_planks', 1); break;
            case 'cook': this.craft('cook_meal', 1); break;
            case 'research': this.chooseResearch(); break;
            case 'work_priorities': g.cyclePriority(cs[0].id, 'research'); break;
            case 'weapon': {
                const need = cs.filter(c => !c.weapon).length - g.resources.weapons.length;
                if (need > 0 && !this.craft('craft_stone_spear', need)) this.gather(['stone'], 4);
                break;
            }
            case 'equip': for (const c of cs) if (!c.weapon && g.resources.weapons.length) g.equipWeapon(c.id, 0); break;
            case 'draft': g.draftAll(); break;
            case 'fight': if (g.paused) g.togglePause(true); break;
            case 'undraft': g.undraftAll(); break;
            case 'tome': {
                const t = getAvailableRecipes(g).find(r => r.recipe.category === 'Tomes' && r.canCraft);
                if (t) this.craft(t.key, 1); else this.gather(['tree'], 4);
                break;
            }
            case 'equip_tome': if (g.resources.tomes.length) g.equipTome(cs[0].id, 0); break;
            case 'attunement': cs.forEach((c, i) => { for (const s of SCHOOL_PAIRS[i % SCHOOL_PAIRS.length]) if (!(c.attunedSchools || []).includes(s)) g.toggleAttunement(c.id, s); }); break;
            case 'bedroom_walls': case 'bedroom_door': case 'bedroom_bed': case 'bedroom':
                if (!this._tutorialRoom) { if (this.buildBedroom()) this._tutorialRoom = true; else this.gather(['tree'], 10); }
                break;
            case 'wayfinding': g.research.selectResearch('wayfinding'); break;
            case 'expedition': {
                const armed = this.homeColonists().filter(c => c.weapon && !c.drafted);
                if (armed.length && g.exploration.canSend(g, 'wild_frontiers')) {
                    const exp = g.exploration.sendExpedition(g, 'wild_frontiers', armed.map(c => c.id), [], 1, {});
                    if (exp) { this.lastExpeditionTick = g.tick; this.api.event('bot_expedition', { realm: 'wild_frontiers', party: armed.length }); this.api.milestone('first_expedition_sent'); }
                }
                break;
            }
            default:
                this.api.note(`tutorial_unhandled:${id}`);
                if (g.tick - this.tutorialStepTick > 6 * CONFIG.TICKS_PER_DAY) { g.tutorial.skip(g); this.api.event('tutorial_skipped', { id }); }
        }
        // A real player gives up and presses Skip eventually.
        if (g.tick - this.tutorialStepTick > 10 * CONFIG.TICKS_PER_DAY && g.tutorial.getCurrentTask()?.id === id) {
            g.tutorial.skip(g);
            this.api.event('tutorial_skipped', { id });
        }
    }

    // ---- Screenshot helpers ----------------------------------------------------------
    panelPrep(panel) {
        return (gm) => {
            gm.camera.centerOn(this.home.x, this.home.y);
            const ui = gm.ui;
            if (panel === 'research' && !ui.researchPanelVisible) ui.toggleResearchPanel();
            if (panel === 'priority' && !ui.priorityPanelVisible) ui.togglePriorityPanel();
            if (panel === 'arcane' && !ui.arcanePanelVisible) ui.toggleArcanePanel();
            if (panel === 'craft' && !ui.craftPanelVisible) ui.toggleCraftPanel();
            if (panel === 'build') gm.input.setMode('build');
            return () => { closePanels(gm); if (panel === 'build') gm.input.setMode('normal'); };
        };
    }
    shotPrepFor(stallKey) {
        if (/research/.test(stallKey)) return this.panelPrep('research');
        if (/expedition/.test(stallKey)) return this.panelPrep('arcane');
        if (/idle|mood/.test(stallKey)) return this.panelPrep('priority');
        return this.panelPrep('map');
    }

    report() {
        return {
            bedrooms: this.bedrooms, decisionsSeen: this.decisionsSeen, hungerScares: this.hungerScare,
            stillBlocked: [...this.blocked.keys()],
        };
    }
}

function closePanels(gm) {
    const ui = gm.ui;
    if (ui.researchPanelVisible) ui.toggleResearchPanel();
    if (ui.priorityPanelVisible) ui.togglePriorityPanel();
    if (ui.arcanePanelVisible) ui.toggleArcanePanel();
    if (ui.craftPanelVisible) ui.toggleCraftPanel();
}

// Small seeded PRNG so the bot's own choices are repeatable between runs.
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

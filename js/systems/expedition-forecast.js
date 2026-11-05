// Expedition forecast: estimates a party's chance of success by playing the real
// expedition simulation many times on a sandboxed copy of the party.
//
// The sandbox is a stub game holding clones of the chosen colonists and animals,
// with its own ExplorationSystem, so nothing the simulation does (XP, gear that
// shatters, potions drunk, bestiary entries) reaches the live colony. Runs use a
// seeded PRNG keyed by the setup, so the same party always gets the same number.
// Work is done in time-boxed steps so the UI can refine the estimate over a few
// frames instead of blocking.

import { ExplorationSystem, getExpeditionSlotItem, withPreservedExpeditionIds } from './exploration.js';
import { recalcMaxMana } from '../entities/colonist.js';

const SLOTS = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
// Ticks one simulated expedition may take before it's abandoned as stuck.
const MAX_TICKS = 200000;

// Small fast seeded PRNG (mulberry32).
function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
}

// The colonist as they will depart: Expedition-set gear, full HP and mana (the
// party is healed at departure), and fresh copies of each item so a shattering
// revive trinket only breaks the clone's.
function cloneColonist(c) {
    const clone = {
        id: c.id, name: c.name, race: c.race, x: 0, y: 0, state: 'idle', path: [],
        golem: c.golem, golemType: c.golemType,
        traits: [...(c.traits || [])], opinions: { ...(c.opinions || {}) }, skills: c.skills || {},
        knownSpells: [...(c.knownSpells || [])], disabledSpells: [...(c.disabledSpells || [])],
        attunedSchools: c.attunedSchools ? [...c.attunedSchools] : c.attunedSchools,
        magicSkills: { ...(c.magicSkills || {}) },
        mana: c.maxMana || 0, maxMana: c.maxMana || 0,
        trinketBroken: false, currentTaskId: null,
    };
    let liveBonus = 0, expBonus = 0;
    for (const slot of SLOTS) {
        const live = slot === 'trinket' && c.trinketBroken ? null : c[slot];
        liveBonus += live?.maxHpBonus || 0;
        let item = getExpeditionSlotItem(c, slot);
        if (slot === 'trinket' && item === c.trinket && c.trinketBroken) item = null;
        clone[slot] = item ? { ...item } : null;
        expBonus += clone[slot]?.maxHpBonus || 0;
    }
    clone.maxHp = Math.max(1, (c.maxHp || 100) - liveBonus + expBonus);
    clone.hp = c.hp > 0 ? clone.maxHp : 0;
    // Max mana depends on gear (staves), so recompute it for the Expedition set.
    if (!c.golem && c.maxMana > 0) { recalcMaxMana(clone); clone.mana = clone.maxMana; }
    return clone;
}

function makeSandbox(game, colonistIds, animalIds) {
    const colonists = colonistIds.map(id => game.getColonist(id)).filter(Boolean).map(cloneColonist);
    const entities = animalIds
        .map(id => game.entities.find(e => e.id === id))
        .filter(Boolean)
        .map(a => ({ ...a, onExpedition: false }));
    const real = game.resources;
    const sandbox = {
        tick: game.tick, paused: false, settings: game.settings || {},
        activeComplexStructures: game.activeComplexStructures,
        colonists, entities, combatEffects: [], stats: {},
        togglePause() {}, switchEquipmentSet() {},
        getColonist(id) { return colonists.find(c => c.id === id); },
        eventLog: { add() {} },
        resources: {
            getPotionCount: key => real?.getPotionCount?.(key) ?? 0,
            takePotion() {}, addPotion() {}, deduct() {},
            stockpile: { ...(real?.stockpile || {}) },
        },
        mapIndex: { findFirst: () => ({ x: 0, y: 0 }), getStructurePositions: () => new Set([0]) },
        ruins: { getAnchor: () => null },
        taskQueue: { getById() { return null; }, release() {} },
        story: { checkMilestone() {} },
    };
    const ex = new ExplorationSystem();
    const live = game.exploration;
    if (live) {
        ex.expeditionXP = live.expeditionXP;
        ex.fatigueCooldowns = { ...live.fatigueCooldowns };
        ex.activeRealmEvents = live.activeRealmEvents.map(e => ({ ...e }));
    }
    ex.canSend = () => true;
    sandbox.exploration = ex;
    return { sandbox, ex };
}

/**
 * Plays one expedition in a fresh sandbox, start to finish.
 *
 * @return {{win: boolean, hpLeft: number, fallen: number}|null} The outcome, or
 *   null when the real launch would refuse this party (e.g. all fatigued).
 */
function runOnce(game, setup) {
    const { sandbox, ex } = makeSandbox(game, setup.colonistIds, [...setup.packAnimalIds, ...setup.warBeastIds]);
    const exp = ex.sendExpedition(sandbox, setup.realmKey, setup.colonistIds, setup.packAnimalIds, setup.difficulty, {
        potions: setup.potions, formation: setup.formation, mutators: setup.mutators, warBeastIds: setup.warBeastIds,
    });
    if (!exp) return null;
    for (let i = 0; i < MAX_TICKS; i++) {
        sandbox.tick++;
        // The player's own choices can't be known, so decisions take the safe option.
        if (exp.pendingDecision) ex._autoResolvePendingDecision(exp, sandbox);
        if (exp.pendingVoidPactChoice) ex.resolveVoidPactChoice(sandbox, exp.id, false);
        ex.update(sandbox);
        if (exp.status === 'returning' || exp.status === 'complete') break;
    }
    const party = exp.partySnapshot;
    if (party.length === 0) return null;
    const maxHp = party.reduce((s, p) => s + p.maxHp, 0);
    return {
        win: party.some(p => p.hp > 0),
        hpLeft: party.reduce((s, p) => s + Math.max(0, p.hp), 0) / Math.max(1, maxHp),
        fallen: exp.defeated.length,
    };
}

/**
 * Starts a forecast for an expedition setup. Call step() repeatedly (e.g. once per
 * frame) until it reports done; each call returns the running estimate.
 *
 * @param {object} game Live game; only read, never modified.
 * @param {object} setup { realmKey, colonistIds, difficulty, mutators, potions,
 *   formation: {front, back}, packAnimalIds, warBeastIds }
 * @param {number} [targetRuns=240] Runs to finish on.
 * @return {{step: function(number): object}} step(budgetMs) runs simulations for
 *   about budgetMs and returns { runs, targetRuns, done, winChance, avgHpLeft,
 *   avgFallen, invalid }.
 *
 * @par Thread Safety:
 *      Not thread-safe. step() temporarily replaces Math.random and mutes
 *      window.soundManager, restoring both before it returns.
 */
export function createExpeditionForecast(game, setup, targetRuns = 240) {
    const s = {
        realmKey: setup.realmKey,
        colonistIds: [...setup.colonistIds],
        difficulty: setup.difficulty || 1,
        mutators: [...(setup.mutators || [])],
        potions: { ...(setup.potions || {}) },
        formation: setup.formation || { front: [...setup.colonistIds], back: [] },
        packAnimalIds: [...(setup.packAnimalIds || [])],
        warBeastIds: [...(setup.warBeastIds || [])],
    };
    const rng = makeRng(hashString(JSON.stringify(s)));
    let runs = 0, wins = 0, hpLeft = 0, fallen = 0, invalid = false;

    const snapshot = () => ({
        runs, targetRuns, done: invalid || runs >= targetRuns, invalid,
        winChance: runs ? wins / runs : null,
        avgHpLeft: runs ? hpLeft / runs : null,
        avgFallen: runs ? fallen / runs : null,
    });

    return {
        step(budgetMs = 12) {
            if (invalid || runs >= targetRuns) return snapshot();
            const realRandom = Math.random;
            const sound = window.soundManager;
            const start = performance.now();
            Math.random = rng;
            window.soundManager = null;
            try {
                withPreservedExpeditionIds(() => {
                    do {
                        const r = runOnce(game, s);
                        if (!r) { invalid = true; break; }
                        runs++;
                        if (r.win) wins++;
                        hpLeft += r.hpLeft;
                        fallen += r.fallen;
                    } while (runs < targetRuns && performance.now() - start < budgetMs);
                });
            } finally {
                Math.random = realRandom;
                window.soundManager = sound;
            }
            return snapshot();
        },
    };
}

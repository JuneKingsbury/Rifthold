// Dev-only: headless expedition simulator. Runs the real ExplorationSystem combat
// loop in Node against a stub game, so a party can be played through an expedition
// hundreds of times and its real win rate compared with estimatePartyStrength().
//
//   node scripts/expsim/run.mjs            (see run.mjs for the scenario matrix)

globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const ROOT = new URL('../../js/', import.meta.url);
// Config text lives in locale/en.json and is filled in when config loads (see
// stampLoc in js/core/i18n.js), so the table has to be loaded first.
{
    const { loadLocaleData } = await import(new URL('core/i18n.js', ROOT));
    const fs = await import('node:fs');
    loadLocaleData('en', JSON.parse(fs.readFileSync(new URL('../../locale/en.json', import.meta.url), 'utf8')));
}
const { ExplorationSystem } = await import(new URL('systems/exploration.js', ROOT));
const { createExpeditionForecast } = await import(new URL('systems/expedition-forecast.js', ROOT));
const CFG = await import(new URL('core/config.js', ROOT));
const { recalcMaxMana } = await import(new URL('entities/colonist.js', ROOT));
export { CFG };

const { ALL_ITEMS, SPELLS, MAGIC_SKILLS, ENTITIES, COLONIST_CONFIG } = CFG;

let nextId = 1;

/**
 * Builds a plain colonist object with the fields the expedition code reads.
 * @param {object} spec { name, weapon, armor, helmet, clothes, boots, tool, trinket,
 *   spells: [spellKey], magic: { school: level }, traits: [] }
 */
export function makeColonist(spec) {
    const c = {
        id: nextId++, name: spec.name || `C${nextId}`, race: 'human',
        x: 0, y: 0, state: 'idle', path: [], traits: spec.traits || [],
        opinions: {}, knownSpells: [], attunedSchools: [], magicSkills: {},
        mana: 0, maxMana: 0, skills: spec.skills || {},
    };
    for (const slot of ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket']) {
        const key = spec[slot];
        if (!key) { c[slot] = null; continue; }
        if (!ALL_ITEMS[key]) throw new Error(`unknown item ${key}`);
        c[slot] = { ...ALL_ITEMS[key], key };
    }
    const hpBonus = ['armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket', 'weapon']
        .reduce((s, k) => s + (c[k]?.maxHpBonus || 0), 0);
    c.maxHp = COLONIST_CONFIG.maxHp + hpBonus;
    c.hp = c.maxHp;
    if (spec.spells?.length) {
        c.knownSpells = [...spec.spells];
        const schools = new Set(spec.spells.map(s => SPELLS[s]?.school).filter(Boolean));
        // Respect the game's attunement cap: only the first schools listed autocast.
        c.attunedSchools = [...schools].slice(0, CFG.MAGIC_STUDY_CONFIG.attunementSlots);
        for (const s of schools) c.magicSkills[s] = spec.magic?.[s] ?? Math.max(...spec.spells.filter(k => SPELLS[k].school === s).map(k => SPELLS[k].minLevel || 1));
        recalcMaxMana(c);   // the game's own focus-weighted mana formula
        c.mana = c.maxMana;
    }
    return c;
}

/** Builds a tamed animal entity with a war role. */
export function makeBeast(type, level = 0) {
    const def = ENTITIES[type];
    const war = def.tamed.roles.find(r => r.type === 'war');
    return { id: nextId++, type, tamed: true, hp: def.hp, damage: def.damage, level, roles: [war], char: def.char, color: def.color };
}

function makeGame(colonists, beasts) {
    const game = {
        tick: 1000, paused: false, settings: {}, colonists, entities: [...beasts],
        combatEffects: [], stats: {}, activeComplexStructures: [],
        togglePause() {}, switchEquipmentSet() {},
        getColonist(id) { return colonists.find(c => c.id === id); },
        eventLog: { add() {} },
        resources: { getPotionCount: () => 99, takePotion() {}, addPotion() {} },
        mapIndex: { findFirst: () => ({ x: 0, y: 0 }), getStructurePositions: () => new Set([0]) },
        ruins: { getAnchor: () => null },
        taskQueue: { getById() { return null; }, release() {} },
        story: { checkMilestone() {} },
        ui: { _expBackRowIds: new Set() },
    };
    return game;
}

/**
 * Plays one expedition to completion and reports what happened.
 * @param {object} sc { realm, difficulty, party: [colonistSpec], beasts: [type],
 *   potions: {key:n}, back: [index], mutators: [] }
 */
export function simulate(sc) {
    const colonists = sc.party.map(makeColonist);
    const beasts = (sc.beasts || []).map(b => typeof b === 'string' ? makeBeast(b) : makeBeast(b.type, b.level));
    const game = makeGame(colonists, beasts);
    const ex = new ExplorationSystem();
    ex.canSend = () => true;
    game.exploration = ex;
    const backIds = (sc.back || []).map(i => colonists[i].id);
    const formation = { front: colonists.map(c => c.id).filter(id => !backIds.includes(id)), back: backIds };
    const exp = ex.sendExpedition(game, sc.realm, colonists.map(c => c.id), [], sc.difficulty || 1, {
        potions: sc.potions || {}, formation, mutators: sc.mutators || [], warBeastIds: beasts.map(b => b.id),
    });
    if (!exp) throw new Error('sendExpedition refused');
    let combatTicks = 0;
    for (let i = 0; i < 200000; i++) {
        game.tick++;
        if (exp.pendingDecision) ex._autoResolvePendingDecision(exp, game);
        if (exp.pendingVoidPactChoice) ex.resolveVoidPactChoice(game, exp.id, false);
        if (exp.combat) combatTicks++;
        ex.update(game);
        if (exp.status === 'returning' || exp.status === 'complete') break;
    }
    const snap = exp.partySnapshot;
    const win = snap.some(p => p.hp > 0) && !exp.manualRetreat;
    const hpFrac = snap.reduce((s, p) => s + Math.max(0, p.hp), 0) / snap.reduce((s, p) => s + p.maxHp, 0);
    const minHpFrac = Math.min(...snap.map(p => Math.max(0, p.hp) / p.maxHp));
    const deaths = exp.defeated.length;
    const dmgTaken = Object.values(exp.summary.damageTaken).reduce((a, b) => a + b, 0);
    return { win, hpFrac, minHpFrac, deaths, dmgTaken, combatTicks, bossReached: exp.bossTriggered };
}

/** The in-game forecast for the same scenario, run against a fresh stub game. */
export function estimate(sc) {
    const colonists = sc.party.map(makeColonist);
    const beasts = (sc.beasts || []).map(b => typeof b === 'string' ? makeBeast(b) : makeBeast(b.type, b.level));
    const game = makeGame(colonists, beasts);
    game.exploration = new ExplorationSystem();
    const ids = colonists.map(c => c.id);
    const backIds = (sc.back || []).map(i => colonists[i].id);
    const job = createExpeditionForecast(game, {
        realmKey: sc.realm, colonistIds: ids, difficulty: sc.difficulty || 1, mutators: sc.mutators || [],
        potions: sc.potions || {}, formation: { front: ids.filter(id => !backIds.includes(id)), back: backIds },
        packAnimalIds: [], warBeastIds: beasts.map(b => b.id),
    });
    let r;
    do { r = job.step(1000); } while (!r.done);
    return { victoryChance: Math.round(r.winChance * 100), rating: '' };
}

/** Runs a scenario n times and aggregates. */
export function trial(sc, n = 200) {
    let wins = 0, hp = 0, minHp = 0, deaths = 0, boss = 0;
    for (let i = 0; i < n; i++) {
        const r = simulate(sc);
        if (r.win) wins++;
        hp += r.hpFrac; minHp += r.minHpFrac; deaths += r.deaths; boss += r.bossReached ? 1 : 0;
    }
    const est = estimate(sc);
    return {
        winRate: wins / n, avgHpLeft: hp / n, avgMinHp: minHp / n, avgDeaths: deaths / n,
        est: est.victoryChance / 100, estRating: est.rating, bossRate: boss / n,
    };
}

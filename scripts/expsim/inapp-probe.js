// Dev-only: checks the expedition forecast inside the real game. Starts a colony,
// runs a forecast on real colonists, and verifies it left no trace on the live
// game (gear, HP, potions, expeditions, XP, Math.random, sound). Then drives the
// Rifts setup panel and reads the forecast line it renders.
//
//   npm run playtest -- --bot=scripts/expsim/inapp-probe.js --label=forecast-probe

import { ALL_ITEMS, getItemStatLines } from '../../js/core/config.js';
import { createExpeditionForecast } from '../../js/systems/expedition-forecast.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(pred, seconds) {
    const t0 = Date.now();
    while (Date.now() - t0 < seconds * 1000) {
        try { const v = pred(); if (v) return v; } catch { /* not ready */ }
        await sleep(100);
    }
    return null;
}

export async function run() {
    const out = { logs: [], done: false, summary: null, error: null };
    window.__pt = { poll() { const r = { ...out, logs: out.logs }; out.logs = []; return r; }, shotAck() {} };
    const log = (m) => out.logs.push(m);
    try {
        out.summary = await probe(log);
    } catch (e) {
        out.error = String(e && e.stack || e);
    }
    out.done = true;
}

async function probe(log) {
    const dev = await waitFor(() => window.__riftholdDev, 60);
    window.confirm = () => true;
    window.alert = () => {};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('splash-overlay')?.remove();
    const old = window.game;
    dev.launchGame(g => { Object.assign(g.settings, { autoSaveInterval: 0, showTutorial: false, sfxVolume: 0, musicVolume: 0 }); g.tutorial.setLevel('none'); });
    const g = await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length && window.game, 60);
    g.speed = 0;

    const party = g.colonists.slice(0, 3);
    // A revive trinket that shatters on use, to catch gear leaking out of the sandbox.
    party[0].trinket = { ...ALL_ITEMS.ward_of_the_sentinel, key: 'ward_of_the_sentinel' };
    party[0]._equipStatCache = null;
    const fingerprint = () => JSON.stringify({
        cols: party.map(c => ({ hp: c.hp, mana: c.mana, maxHp: c.maxHp, trinket: c.trinket?.key, trinketBroken: !!c.trinketBroken, weapon: c.weapon?.name, onExp: !!c.onExpedition, pending: !!c.expeditionPending, state: c.state })),
        exps: g.exploration.expeditions.length, xp: JSON.stringify(g.exploration.expeditionXP),
        bestiary: g.exploration.bestiary.size, potions: g.resources.getPotionCount('health_potion'),
        log: g.eventLog.entries?.length ?? null, tick: g.tick,
    });
    const before = fingerprint();
    const rand = Math.random, sound = window.soundManager;

    // A realm hard enough that members fall and the revive trinket fires.
    const job = createExpeditionForecast(g, {
        realmKey: 'crystal_mines', colonistIds: party.map(c => c.id), difficulty: 3,
        potions: { health_potion: 2 }, formation: { front: party.map(c => c.id), back: [] },
    });
    let r, steps = 0, worstStep = 0;
    do {
        const t0 = performance.now();
        r = job.step(12);
        worstStep = Math.max(worstStep, performance.now() - t0);
        steps++;
    } while (!r.done);
    const after = fingerprint();
    const leaks = [];
    if (before !== after) leaks.push({ before, after });
    if (Math.random !== rand) leaks.push('Math.random not restored');
    if (window.soundManager !== sound) leaks.push('soundManager not restored');
    log(`forecast: ${Math.round(r.winChance * 100)}% over ${r.runs} runs in ${steps} steps, worst step ${worstStep.toFixed(1)}ms, leaks=${leaks.length}`);

    // Same setup again must give the same number (seeded).
    const job2 = createExpeditionForecast(g, {
        realmKey: 'crystal_mines', colonistIds: party.map(c => c.id), difficulty: 3,
        potions: { health_potion: 2 }, formation: { front: party.map(c => c.id), back: [] },
    });
    let r2; do { r2 = job2.step(50); } while (!r2.done);
    const deterministic = r2.winChance === r.winChance;

    // Gear max mana: equipping a staff raises the pool, removing it drops it back.
    const mage = g.colonists[3] || party[2];
    const prevWeapon = mage.weapon;
    mage.weapon = null; g._recalcEquipmentStats(mage);
    const bare = mage.maxMana;
    mage.weapon = { ...ALL_ITEMS.abyssal_staff, key: 'abyssal_staff' }; g._recalcEquipmentStats(mage);
    const staffed = mage.maxMana;
    mage.weapon = prevWeapon; g._recalcEquipmentStats(mage);
    log(`max mana bare ${bare}, with Abyssal Staff ${staffed}, restored ${mage.maxMana}; tooltip: ${getItemStatLines(ALL_ITEMS.abyssal_staff).join(' / ')}`);

    // UI: open the Rifts setup for a realm, tick three colonists, read the line.
    const ui = g.ui;
    // The setup panel needs a Gathering Circle; pretend one exists at the first colonist.
    const findFirst = g.mapIndex.findFirst.bind(g.mapIndex);
    g.mapIndex.findFirst = (k) => k === 'gathering_circle' ? { x: party[0].x, y: party[0].y } : findFirst(k);
    ui.toggleArcanePanel('expeditions');
    ui._arcaneExpSetup = 'crystal_caves';
    ui._lastArcaneHtml = '';
    ui.updateArcanePanel();
    const boxes = [...ui.elements.arcanePanel.querySelectorAll('.exp-check')].slice(0, 3);
    if (!boxes.length) log(`setup panel: ${ui.elements.arcanePanel.textContent.slice(0, 600)}`);
    for (const cb of boxes) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
    const line = await waitFor(() => {
        const t = document.getElementById('exp-forecast-line')?.textContent || '';
        return /success\)/.test(t) && !/simulating/.test(t) ? t : null;
    }, 20);
    log(`ui line: ${line}`);

    return { forecast: r, deterministic, leaks, worstStepMs: worstStep, uiLine: line, checkboxes: boxes.length };
}

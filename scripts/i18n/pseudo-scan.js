// Dev-only: finds on-screen text that bypasses the locale table. Run it twice
// with the same profile: the first run selects the pseudo-locale (see
// pseudo-locale.mjs), the second plays a few days, opens every panel and
// reports visible text that isn't wrapped in ⟦…⟧.
//
//   node scripts/i18n/pseudo-locale.mjs
//   npm run playtest -- --bot=scripts/i18n/pseudo-scan.js --label=pseudo-set  --user-data=/tmp/rifthold-pseudo
//   npm run playtest -- --bot=scripts/i18n/pseudo-scan.js --label=pseudo-scan --user-data=/tmp/rifthold-pseudo
//
// Canvas text can't be scanned; check the screenshots for it.

import { getLanguage } from '../../js/core/i18n.js';

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
    const out = { logs: [], done: false, summary: null, error: null, shot: null };
    let shotResolve = null;
    window.__pt = {
        poll() { const r = { ...out }; out.logs = []; out.shot = null; return r; },
        shotAck() { shotResolve?.(); },
    };
    const log = (m) => out.logs.push(m);
    const shot = (name) => new Promise(r => { shotResolve = r; out.shot = name; });
    try {
        out.summary = await scan(log, shot);
    } catch (e) {
        out.error = String(e && e.stack || e);
    }
    out.done = true;
}

// Visible text nodes under `root` without pseudo brackets, ignoring numbers,
// symbols and the given proper names.
function untranslated(root, names) {
    const found = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest('script,style,[data-i18n-skip]')) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || !el.getClientRects().length) continue;
        // Markup strings split ⟦…⟧ across several text nodes; any bracket means
        // the node came from the table.
        if (/[⟦⟧]/.test(n.textContent)) continue;
        let text = n.textContent;
        for (const name of names) text = text.split(name).join(' ');
        if (/[A-Za-z]{3,}/.test(text)) found.add(text.replace(/\s+/g, ' ').trim().slice(0, 120));
    }
    for (const el of root.querySelectorAll('[title],[placeholder]')) {
        for (const attr of ['title', 'placeholder']) {
            const v = el.getAttribute(attr);
            if (!v || !el.getClientRects().length) continue;
            let text = v.replace(/⟦[^⟧]*⟧/g, ' ');
            for (const name of names) text = text.split(name).join(' ');
            if (/[A-Za-z]{3,}/.test(text)) found.add(`[${attr}] ${text.replace(/\s+/g, ' ').trim().slice(0, 100)}`);
        }
    }
    return [...found];
}

async function scan(log, shot) {
    // boot.js loads the locale before the game; wait for the game so the active
    // language is settled before checking it.
    const dev = await waitFor(() => window.__riftholdDev, 60);
    if (getLanguage() !== 'xx') {
        const s = JSON.parse(localStorage.getItem('colony_settings') || '{}');
        s.language = 'xx';
        localStorage.setItem('colony_settings', JSON.stringify(s));
        log('pseudo-locale selected; run again with the same --user-data to scan');
        return { final: { day: 0 }, wallSeconds: 0 };
    }
    window.confirm = () => true;
    window.alert = () => {};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('splash-overlay')?.remove();
    const report = {};
    report.start = untranslated(document.getElementById('start-screen') || document.body, []);
    document.getElementById('start-settings-panel').style.display = 'block';
    report.start_settings = untranslated(document.getElementById('start-settings-panel'), []);
    await shot('start-settings');
    document.getElementById('start-settings-panel').style.display = 'none';

    const old = window.game;
    dev.launchGame(g => { Object.assign(g.settings, { autoSaveInterval: 0, sfxVolume: 0, musicVolume: 0 }); });
    const g = await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length && window.game, 60);
    // Let a few days of events, logs and thoughts accumulate.
    g.speed = 0;
    for (let i = 0; i < 480 * 3; i++) {
        g.simulationTick();
        if (g.events?.pendingEvent) g.events.pendingEvent = null;   // don't stall on prompts
        if (i % 60 === 0) await sleep(0);
    }
    const names = [...g.colonists.map(c => c.name), ...g.entities.map(e => e.name).filter(Boolean)];
    report.hud = untranslated(document.getElementById('game-container') || document.body, names);
    await shot('hud');
    const keys = { story: 'j', build: 'b', farm: 'f', gather: 'g', priority: 'p', craft: 'c', research: 'r', inventory: 'i', rifts: 'v', map: 'm' };
    for (const [name, key] of Object.entries(keys)) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        await sleep(400);
        report[name] = untranslated(document.body, names).filter(s => !report.hud.includes(s));
        await shot(`panel-${name}`);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(200);
    }
    g.ui._settingsTab = 'general';
    for (const tab of ['general', 'graphics', 'controls']) {
        g.ui._settingsTab = tab;
        g.ui.updateSettingsPanel();
        g.ui.elements.settingsPanel.style.display = 'block';
        await sleep(100);
        report[`settings_${tab}`] = untranslated(g.ui.elements.settingsPanel, names);
        await shot(`settings-${tab}`);
    }
    g.ui.elements.settingsPanel.style.display = 'none';
    if (g.colonists[0]) {
        g.ui.selectedEntity = g.colonists[0];
        g.selectedColonist = g.colonists[0];
        g.ui.updateInfoPanel?.();
        await sleep(200);
        report.colonist_info = untranslated(g.ui.elements.infoPanel || document.body, names);
        await shot('colonist-info');
    }
    let total = 0;
    for (const [area, list] of Object.entries(report)) {
        total += list.length;
        for (const s of list) log(`UNTRANSLATED [${area}] ${s}`);
    }
    log(`${total} untranslated text node(s)`);
    return { untranslated: report, final: { day: Math.floor(g.tick / 480) }, wallSeconds: 0 };
}

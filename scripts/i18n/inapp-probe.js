// Dev-only: checks localization inside the real game. Confirms boot loaded the
// English table, the static markup was translated, both language selects list
// the languages in locale/index.json, and choosing one is stored for the next
// launch without changing the running game. Screenshots both settings panels.
//
//   npm run playtest -- --bot=scripts/i18n/inapp-probe.js --label=i18n-probe

import { getLanguage, getAvailableLanguages, hasKey, getMissingKeys } from '../../js/core/i18n.js';
import { addThought, hasThought, thoughtText } from '../../js/entities/colonist.js';
import { serializeGame, applySerializedGame } from '../../js/core/save.js';
import { rollItem, applyEnchantmentEffect, itemName } from '../../js/entities/item-roll.js';
import { ENCHANTMENT_TIERS } from '../../js/core/config.js';
import { logEntryText, logEntryTime } from '../../js/ui/eventlog.js';
import { ref } from '../../js/core/i18n.js';

// Decodes a save string the way save.js does (compressed or plain).
async function decodeSave(stored) {
    if (stored.startsWith('RHc1:')) {
        const bin = atob(stored.slice(5));
        const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
        return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    return stored.startsWith('RHj1:') ? stored.slice(5) : stored;
}

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
        out.summary = await probe(log, shot);
    } catch (e) {
        out.error = String(e && e.stack || e);
    }
    out.done = true;
}

async function probe(log, shot) {
    const checks = [];
    const check = (ok, what) => { checks.push({ ok: !!ok, what }); log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
    const dev = await waitFor(() => window.__riftholdDev, 60);
    window.confirm = () => true;
    window.alert = () => {};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('splash-overlay')?.remove();

    const storedBefore = localStorage.getItem('colony_settings');
    check(getLanguage() === 'en', 'boot loaded English');
    check(hasKey('ui.settings.language'), 'locale/en.json is in the table');
    check(document.documentElement.lang === 'en', '<html lang> set');
    const langs = getAvailableLanguages();
    check(langs.length >= 1 && langs[0].code === 'en', 'locale/index.json read');

    // Start screen
    document.getElementById('start-settings-panel').style.display = 'block';
    const startSel = document.getElementById('start-language');
    check(startSel && startSel.options.length === langs.length, 'start-screen select lists every language');
    check(startSel?.value === 'en', 'start-screen select shows the stored language');
    const title = document.querySelector('[data-i18n="ui.settings.language_title"]');
    check(title?.textContent === 'Language', 'data-i18n text applied');
    check(document.getElementById('start-language-note').style.display === 'none', 'no restart note when unchanged');
    await shot('start-settings');

    // Choosing a language is stored, flags a restart, and leaves the table alone.
    startSel.innerHTML += '<option value="xx">Probe</option>';
    startSel.value = 'xx';
    startSel.dispatchEvent(new Event('change', { bubbles: true }));
    check(JSON.parse(localStorage.getItem('colony_settings') || '{}').language === 'xx', 'choice stored in colony_settings');
    check(document.getElementById('start-language-note').style.display !== 'none', 'restart note shown');
    check(getLanguage() === 'en', 'running game keeps its language');
    await shot('start-settings-changed');
    startSel.value = 'en';
    startSel.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('start-settings-panel').style.display = 'none';

    // In-game settings panel
    const old = window.game;
    dev.launchGame(g => { Object.assign(g.settings, { autoSaveInterval: 0, showTutorial: false, sfxVolume: 0, musicVolume: 0 }); g.tutorial.setLevel('none'); });
    const g = await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length && window.game, 60);
    g.speed = 0;
    g.ui._settingsTab = 'general';
    g.ui.updateSettingsPanel();
    g.ui.elements.settingsPanel.style.display = 'block';
    const gameSel = document.getElementById('set-language');
    check(gameSel && gameSel.options.length === langs.length && gameSel.value === 'en', 'in-game select lists languages');
    await shot('ingame-settings');

    // Thoughts are matched by id, and their text is looked up for display.
    const c = g.colonists[0];
    c.thoughts = [];
    addThought(c, 'freezing', -8, 50, g.tick);
    addThought(c, 'freezing', -8, 50, g.tick + 1);
    check(c.thoughts.length === 1 && hasThought(c, 'freezing'), 'thought deduplicates by id');
    check(thoughtText(c.thoughts[0]) === 'Freezing outside', 'thought text looked up');
    addThought(c, 'Some mod text', 2, 50, g.tick);
    check(c.thoughts[1]?.id === 'text:Some mod text' && thoughtText(c.thoughts[1]) === 'Some mod text', 'plain-text thought still works');

    // A v13 save stores thoughts by English text; loading maps them to ids.
    const data = JSON.parse(await decodeSave(await serializeGame(g)));
    data.version = 13;
    const dc = data.colonists.find(x => x.id === c.id);
    const other = data.colonists.find(x => x.id !== c.id);
    dc.thoughts = [
        { text: 'Freezing outside', moodEffect: -8, duration: 50, tickAdded: g.tick },
        { text: 'Cozy bedroom', moodEffect: 16, duration: 375, tickAdded: g.tick },
        { text: 'Soothed by a rabbit', moodEffect: 2, duration: 20, tickAdded: g.tick },
        { text: `${other.name} died`, moodEffect: -20, duration: 100, tickAdded: g.tick },
        { text: 'Unknown mod thought', moodEffect: 1, duration: 100, tickAdded: g.tick },
    ];
    // An item saved before enchantments carried a locale key keeps its saved name.
    dc.weapon = { ...dc.weapon, key: dc.weapon?.key || 'wooden_club', name: 'Legacy Club of Sharpness II', enchantment: { suffix: 'of Sharpness', description: 'x' } };
    await applySerializedGame(g, 'RHj1:' + JSON.stringify(data));
    const lc = window.game.colonists.find(x => x.id === c.id);
    const ids = lc.thoughts.map(th => th.id);
    check(hasThought(lc, 'freezing'), `v13 thought text migrated to id (${ids.join(', ')})`);
    // The animal is shown by its locale name now ("Rabbit"), where the old text used the raw type.
    check(lc.thoughts.map(thoughtText).join('|') === `Freezing outside|Cozy bedroom|Soothed by a Rabbit|${other.name} died|Unknown mod thought`, `migrated thoughts show their text (${lc.thoughts.map(thoughtText).join('|')})`);
    check(lc.thoughts[3].targetId === other.id, 'death thought linked to the colonist');
    check(itemName(lc.weapon) === 'Legacy Club of Sharpness II', 'legacy enchanted item keeps its saved name');
    const fresh = rollItem('iron_sword', 'fine');
    if (fresh) {
        applyEnchantmentEffect(fresh, 'weapon', ENCHANTMENT_TIERS[0]);
        check(itemName(JSON.parse(JSON.stringify(fresh))) === fresh.name, `new item name rebuilt after save (${fresh.name})`);
    }

    // Log entries store a key and params, survive a save, and render on display.
    const g2 = window.game;
    g2.eventLog.add(g2, { key: 'save.slot.autosave', params: { n: ref('season.winter.name') } }, 'info', null);
    g2.eventLog.add(g2, 'Plain legacy line', 'info', null);
    const saved = JSON.parse(await decodeSave(await serializeGame(g2)));
    await applySerializedGame(g2, 'RHj1:' + JSON.stringify(saved));
    const entries = window.game.eventLog.entries.slice(-2);
    check(logEntryText(entries[0]) === 'Auto-save Winter' && entries[0].key, 'keyed log entry survives save and renders');
    check(logEntryText(entries[1]) === 'Plain legacy line', 'plain-text log entry still shows');
    check(/^Y\d+ (Spring|Summer|Autumn|Winter) \d\d:\d\d$/.test(logEntryTime(entries[0])), `timestamp renders (${logEntryTime(entries[0])})`);
    check(logEntryTime({ time: 'Y1 spring 06:00' }) === 'Y1 spring 06:00', 'old saved timestamp shows as-is');
    window.game.ui.updateEventLog();
    check(window.game.ui.elements.eventLog.innerHTML.includes('Auto-save Winter'), 'event log panel shows keyed entry');

    check(getMissingKeys().length === 0, `no missing keys (${getMissingKeys().join(', ') || 'none'})`);
    if (storedBefore == null) localStorage.removeItem('colony_settings');
    else localStorage.setItem('colony_settings', storedBefore);
    const failed = checks.filter(c => !c.ok);
    return { passed: checks.length - failed.length, failed: failed.map(c => c.what), final: { day: 0 }, wallSeconds: 0 };
}

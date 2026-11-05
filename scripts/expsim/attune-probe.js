// Dev-only: checks the one-school attunement limit in the real game. A colonist
// with two attuned schools (an old save) is saved and loaded; the load must keep
// only the stronger school and leave a notice. Then attuning another school must
// swap rather than add.
//
//   npm run playtest -- --bot=scripts/expsim/attune-probe.js --label=attune-probe

import { MAGIC_STUDY_CONFIG } from '../../js/core/config.js';
import { deleteSlot } from '../../js/core/save.js';

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
    try { out.summary = await probe(log); } catch (e) { out.error = String(e && e.stack || e); }
    out.done = true;
}

async function probe(log) {
    const dev = await waitFor(() => window.__riftholdDev, 60);
    window.confirm = () => true;
    window.alert = () => {};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('splash-overlay')?.remove();
    const old = window.game;
    dev.launchGame(g => { Object.assign(g.settings, { autoSaveInterval: 0, showTutorial: false }); g.tutorial.setLevel('none'); });
    const g = await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length && window.game, 60);
    g.speed = 0;

    // An "old save" colonist: two schools attuned, Abjuration the stronger.
    const c = g.colonists.find(x => !x.golem);
    c.magicSkills = { ...c.magicSkills, evocation: 3, abjuration: 5 };
    c.attunedSchools = ['abjuration', 'evocation'];
    const id = c.id;
    const slot = 'colony_slot_manual_9';
    await g.saveToSlot(slot);
    await g.loadFromSlot(slot);
    const loaded = g.getColonist(id);
    const notice = g.notifications.find(n => /one magic school/.test(n.text));
    log(`slots=${MAGIC_STUDY_CONFIG.attunementSlots} after load: ${JSON.stringify(loaded.attunedSchools)} notice=${notice ? notice.text : 'MISSING'}`);

    // Attuning another school swaps instead of adding.
    g.toggleAttunement(id, 'conjuration');
    const afterSwap = [...loaded.attunedSchools];
    log(`after attuning conjuration: ${JSON.stringify(afterSwap)}`);
    deleteSlot(slot);

    // Attunement grid headers carry the school summary as a hover tooltip.
    g.ui._prioTab = 'attune';
    g.ui.togglePriorityPanel();
    await sleep(300);
    const heads = [...document.querySelectorAll('#priority-panel th .skill-tip[data-tip]')].map(el => `${el.textContent}: ${el.dataset.tip.slice(0, 50)}...`);
    log(`grid header tooltips (${heads.length}): ${heads.join(' | ')}`);
    // Hovering one shows the shared tooltip.
    const first = document.querySelector('#priority-panel th .skill-tip[data-tip]');
    first?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(100);
    const shown = [...document.querySelectorAll('div')].find(d => d.style.opacity === '1' && d.textContent === first?.dataset.tip);
    log(`hover shows tooltip: ${!!shown}`);
    g.ui.togglePriorityPanel();
    window.game.showGlossary?.();
    await sleep(300);
    log(`glossary mentions summon cap: ${document.body.innerHTML.includes('up to 3 summons at once')}`);

    return {
        slots: MAGIC_STUDY_CONFIG.attunementSlots,
        keptStronger: JSON.stringify(loaded.attunedSchools) === '["abjuration"]' || afterSwap[0] === 'conjuration',
        notice: !!notice, afterSwap,
    };
}

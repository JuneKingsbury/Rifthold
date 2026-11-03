// Runs inside the game window (injected by launch.js, with window.__batchOpts
// set). Drives the trailer director through the requested scenes and returns
// one result per scene: { scene, clip, secs, beats } or { scene, error }.
(async () => {
    const opts = window.__batchOpts || {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const waitFor = async (pred, seconds) => {
        const t0 = Date.now();
        while (Date.now() - t0 < seconds * 1000) {
            try { const v = pred(); if (v) return v; } catch { /* not ready yet */ }
            await sleep(250);
        }
        return null;
    };
    const log = (m) => console.log('[batch] ' + m);
    // Nobody is there to answer "Replace the current trailer colony?".
    window.confirm = () => true;

    if (!await waitFor(() => window.trailerDirector && window.__riftholdDev, 60)) return { error: 'the trailer director never loaded' };
    const d = window.trailerDirector;
    if (!d.recorder) return { error: 'clip recording is not supported in this window' };
    const { SCENES } = await import('./js/dev/trailer/scenes.js');

    // "--scenes=6", "--scenes=6-10", "--scenes=1,3,5-7" (1-based, like Alt+1..0).
    const pick = new Set();
    for (const part of (opts.scenes || `1-${SCENES.length}`).split(',')) {
        const [a, b] = part.split('-').map(n => parseInt(n, 10));
        for (let n = a; n <= (b || a); n++) if (n >= 1 && n <= SCENES.length) pick.add(n - 1);
    }
    const order = [...pick].sort((x, y) => x - y);
    if (!order.length) return { error: `no scenes match "${opts.scenes}" (there are ${SCENES.length})` };
    log(`scenes: ${order.map(i => `${i + 1}.${SCENES[i].id}`).join(', ')}`);

    // A fresh colony when asked, or when there's nothing to start the first
    // scene from yet. Otherwise start a throwaway game for the snapshot to load into.
    await d._refreshSnapIds();
    const first = SCENES[order[0]];
    if (opts.newColony || !d._snapIds.has(first.id)) {
        if (!opts.newColony) log(`no saved start for ${first.id} in this profile yet: generating a new colony`);
        await d.newColony();
        if (d.state !== 'ready') return { error: 'the new colony did not start' };
    } else {
        const old = window.game;
        window.__riftholdDev.launchGame(g => { g.settings.showTutorial = false; g.tutorial.setLevel('none'); });
        if (!await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length, 30)) return { error: 'the game did not start' };
    }

    const results = [];
    for (const i of order) {
        const scene = SCENES[i];
        if (!(d.current === i && d.state === 'ready')) await d.loadScene(i);
        if (d.state !== 'ready') { results.push({ scene: scene.id, error: 'scene failed to load' }); break; }
        log(`rolling ${i + 1}. ${scene.name}`);
        d.lastClip = null;
        const t0 = performance.now();
        await d.play();
        const secs = +((performance.now() - t0) / 1000).toFixed(1);
        const status = d.panel?.querySelector('.td-status')?.textContent || '';
        if (/error/i.test(status)) results.push({ scene: scene.id, clip: d.lastClip, error: status });
        else results.push({ scene: scene.id, clip: d.lastClip, secs, beats: d.beats.map(b => `${b.t.toFixed(1)}s ${b.label}`) });
        log(`done ${scene.id} in ${secs}s: ${d.lastClip || 'no clip'}`);
        // Keep the take so the next scene starts where this one ended.
        if (opts.keep && i < SCENES.length - 1) await d.keep();
    }
    return results;
})()

console.log('[boot] start');
try {
    const { runModLoader } = await import('./mod-loader.js');
    console.log('[boot] mod-loader imported');
    await runModLoader();
    console.log('[boot] mods loaded');
} catch (err) {
    console.error('[boot] mod loader error:', err);
}
console.log('[boot] importing main.js');
try {
    await import('./main.js');
} catch (err) {
    console.error('[boot] main.js error:', err);
}

// Dev-only trailer director. Enabled by ?trailer in the URL or the Debug menu
// toggle; js/dev is excluded from release builds, so the import fails quietly there.
if (new URLSearchParams(location.search).has('trailer') || localStorage.getItem('rifthold_trailer_director') === '1') {
    import('../dev/trailer/director.js').catch(err => console.warn('[boot] trailer director unavailable:', err));
}
// The Debug menu only offers the toggle where the director files exist (dev
// checkouts); release builds exclude js/dev, so players never see it.
fetch(new URL('../dev/trailer/director.js', import.meta.url), { method: 'HEAD' })
    .then(r => { window.trailerDirectorAvailable = r.ok; })
    .catch(() => { window.trailerDirectorAvailable = false; });
window.toggleTrailerDirector = async () => {
    if (window.trailerDirector) {
        localStorage.removeItem('rifthold_trailer_director');
        window.trailerDirector.shutdown();
        return;
    }
    try {
        await import('../dev/trailer/director.js');
        localStorage.setItem('rifthold_trailer_director', '1');
    } catch (err) {
        console.warn('[boot] trailer director unavailable:', err);
        alert('The trailer director is not included in this build.');
    }
};

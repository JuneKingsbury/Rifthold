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

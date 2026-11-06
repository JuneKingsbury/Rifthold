// Dev-only: loads the game config in Node and prints every config text key
// stampLoc() saw, with the text it resolved to, as JSON on stdout.
//
//   node scripts/i18n/snapshot.mjs              inline text only (no table loaded)
//   node scripts/i18n/snapshot.mjs --with-table  with locale/en.json loaded first
//
// Used by extract-config.mjs (before and after stripping a file) and check.mjs.
// Runs in its own process so each run evaluates the config modules fresh.

import fs from 'node:fs';

globalThis.window = globalThis;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const ROOT = new URL('../../', import.meta.url);
const i18n = await import(new URL('js/core/i18n.js', ROOT));
if (process.argv.includes('--with-table')) {
    i18n.loadLocaleData('en', JSON.parse(fs.readFileSync(new URL('locale/en.json', ROOT), 'utf8')));
}
await import(new URL('js/core/config.js', ROOT));
// Some config files (dice.js) aren't re-exported by the config index.
for (const f of fs.readdirSync(new URL('js/core/config/', ROOT)).filter(f => f.endsWith('.js')).sort()) {
    await import(new URL(`js/core/config/${f}`, ROOT));
}

process.stdout.write(JSON.stringify({
    text: i18n.getConfigTextSnapshot(),
    inline: i18n.getInlineConfigKeys(),
    table: i18n.getTableConfigKeys(),
}));

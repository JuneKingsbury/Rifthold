// Dev-only: writes locale/xx.json, a pseudo-translation of en.json where every
// string is wrapped in ⟦…⟧ with its {placeholders} and markup left intact.
// Select it to find text that bypasses the table: anything on screen without
// the brackets didn't come from a lookup.
//
//   node scripts/i18n/pseudo-locale.mjs
//   then in the browser console: setGameLanguage('xx'); location.reload()
//   (or set colony_settings.language = 'xx'). Remove locale/xx.json when done;
//   it is git-ignored.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale/en.json'), 'utf8'));
const wrap = (s) => (s === '' ? s : `⟦${s}⟧`);
const out = {};
for (const [k, v] of Object.entries(en)) {
    out[k] = typeof v === 'string' ? wrap(v) : Object.fromEntries(Object.entries(v).map(([f, s]) => [f, wrap(s)]));
}
fs.writeFileSync(path.join(ROOT, 'locale/xx.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote locale/xx.json (${Object.keys(out).length} keys)`);

// Dev-only: merges new strings into locale/en.json, keeping it sorted.
//
//   node scripts/i18n/add-keys.mjs <strings.json>    a JSON object of key -> text
//   node scripts/i18n/add-keys.mjs - < strings.json   same, from stdin
//
// Safe to run from several processes at once (a lock directory serializes the
// read-merge-write). A key that already exists with different text is an
// error and nothing is written; pick another key or fix the text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EN = path.join(ROOT, 'locale/en.json');
const LOCK = path.join(ROOT, 'locale/.en.json.lock');

const src = process.argv[2];
if (!src) {
    console.error('usage: add-keys.mjs <strings.json | ->');
    process.exit(2);
}
const incoming = JSON.parse(src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8'));

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const t0 = Date.now();
for (;;) {
    try { fs.mkdirSync(LOCK); break; }
    catch (e) {
        if (e.code !== 'EEXIST') throw e;
        // A lock older than 30s is left over from a crashed run.
        try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 30000) fs.rmdirSync(LOCK); } catch { /* raced */ }
        if (Date.now() - t0 > 60000) { console.error('timed out waiting for the en.json lock'); process.exit(1); }
        sleep(50);
    }
}
try {
    const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
    const conflicts = [];
    let added = 0;
    for (const [key, value] of Object.entries(incoming)) {
        // Code keys are snake_case; config-derived keys can carry camelCase field names (successText).
        if (!/^[a-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(key)) { conflicts.push(`${key}: keys are dotted, starting with a lowercase prefix`); continue; }
        if (key in en) {
            if (JSON.stringify(en[key]) !== JSON.stringify(value)) conflicts.push(`${key}: already "${JSON.stringify(en[key])}"`);
            continue;
        }
        en[key] = value;
        added++;
    }
    if (conflicts.length) {
        for (const c of conflicts) console.error('conflict: ' + c);
        console.error('nothing written');
        process.exitCode = 1;
    } else {
        const sorted = Object.fromEntries(Object.keys(en).sort().map(k => [k, en[k]]));
        const tmp = EN + '.tmp' + process.pid;
        fs.writeFileSync(tmp, JSON.stringify(sorted, null, 2) + '\n');
        fs.renameSync(tmp, EN);
        console.log(`added ${added} key(s), ${Object.keys(incoming).length - added} already present`);
    }
} finally {
    fs.rmdirSync(LOCK);
}

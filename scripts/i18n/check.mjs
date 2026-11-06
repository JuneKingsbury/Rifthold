// Dev-only: checks the locale tables against the code.
//
//   npm run i18n:check              errors fail the run; unused keys are listed
//   node scripts/i18n/check.mjs -q  errors only
//   node scripts/i18n/check.mjs --all  list every unused key
//
// Errors:
//   - a literal key in t('...'), tp('...'), tHtml('...') or data-i18n*="..." that
//     locale/en.json does not define
//   - a tp() key whose value isn't a plural object with "one" and "other"
//   - markup ('<') in a value whose key doesn't end in _html
//   - a language in locale/index.json without a file, or a file that isn't JSON
//   - a translation whose {placeholders} differ from English
// Report only:
//   - config text still inline in js/core/config (not moved to en.json yet)
//   - keys nothing appears to use: not looked up literally, not a config text key,
//     not quoted anywhere in code, and not under a prefix code builds keys from
//     (`msg.x.${id}`, 'msg.x.' + id, idLabel('msg.x', id)) or dynamic-prefixes.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const quiet = process.argv.includes('-q');
const errors = [];
const err = (msg) => errors.push(msg);

function readJson(rel) {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    } catch (e) {
        err(`${rel}: ${e.message}`);
        return null;
    }
}

const en = readJson('locale/en.json') || {};
const index = readJson('locale/index.json') || [];
let dynamicPrefixes = [];
if (fs.existsSync(path.join(ROOT, 'scripts/i18n/dynamic-prefixes.json'))) {
    dynamicPrefixes = readJson('scripts/i18n/dynamic-prefixes.json') || [];
}

// Config text that is HTML by design (shown through sanitizeHtml).
const MARKUP_PREFIXES = ['story_milestone.'];

// --- Table shape --------------------------------------------------------------
const isPlural = (v) => v && typeof v === 'object' && !Array.isArray(v);
for (const [key, value] of Object.entries(en)) {
    if (isPlural(value)) {
        if (typeof value.one !== 'string' || typeof value.other !== 'string') err(`en.json "${key}": plural needs string "one" and "other"`);
    } else if (typeof value !== 'string') {
        err(`en.json "${key}": value must be a string or a plural object`);
    }
    const texts = isPlural(value) ? Object.values(value) : [value];
    if (!key.endsWith('_html') && !MARKUP_PREFIXES.some(p => key.startsWith(p)) && texts.some(s => typeof s === 'string' && s.includes('<'))) {
        err(`en.json "${key}": contains markup but the key doesn't end in _html`);
    }
}
const sorted = Object.keys(en).slice().sort();
if (Object.keys(en).some((k, i) => k !== sorted[i])) err('en.json: keys are not sorted (run with --fix-order to sort)');
if (process.argv.includes('--fix-order')) {
    const out = {};
    for (const k of sorted) out[k] = en[k];
    fs.writeFileSync(path.join(ROOT, 'locale/en.json'), JSON.stringify(out, null, 2) + '\n');
    errors.splice(errors.indexOf('en.json: keys are not sorted (run with --fix-order to sort)'), 1);
    console.log('sorted locale/en.json');
}

// --- Other languages -------------------------------------------------------------
const placeholders = (s) => new Set([...String(s).replace(/\{\{|\}\}/g, '').matchAll(/\{(\w+)\}/g)].map(m => m[1]));
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
for (const { code } of index) {
    if (code === 'en') continue;
    const table = readJson(`locale/${code}.json`);
    if (!table) continue;
    for (const [key, value] of Object.entries(table)) {
        if (!(key in en)) { err(`${code}.json "${key}": not in en.json`); continue; }
        const ours = isPlural(value) ? Object.values(value) : [value];
        const theirs = isPlural(en[key]) ? en[key].other : en[key];
        for (const s of ours) {
            if (!sameSet(placeholders(s), placeholders(theirs))) err(`${code}.json "${key}": placeholders differ from English`);
        }
    }
}

// --- Literal keys in code ----------------------------------------------------------
function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (p === path.join(ROOT, 'js/dev')) continue;
            walk(p, out);
        } else if (ent.name.endsWith('.js')) {
            out.push(p);
        }
    }
    return out;
}
const sources = [...walk(path.join(ROOT, 'js')), path.join(ROOT, 'index.html')];
const used = new Map();   // key -> first location
const codePrefixes = new Set();
const quotedKeys = new Set();
const callRe = /(?<![\w.$])(t|tp|tHtml)\(\s*(['"`])([a-z0-9_]+(?:\.[a-z0-9_]+)+)\2/g;
const attrRe = /data-i18n(?:-html|-title|-placeholder|-aria|-alt)?="([^"]+)"/g;
for (const file of sources) {
    // Blank out whole-line comments (keeping line numbers) so examples in docs don't count.
    const text = fs.readFileSync(file, 'utf8').replace(/^[ \t]*(\/\/|\*|\/\*).*$/gm, '');
    const rel = path.relative(ROOT, file);
    const lineOf = (i) => text.slice(0, i).split('\n').length;
    // Calls through import aliases count too: import { t as tr, tp as tpr } from '.../i18n.js'.
    const aliases = { t: 't', tp: 'tp', tHtml: 'tHtml' };
    for (const imp of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*i18n\.js['"]/g)) {
        for (const part of imp[1].split(',')) {
            const am = /^\s*(t|tp|tHtml)\s+as\s+([\w$]+)\s*$/.exec(part);
            if (am) aliases[am[2]] = am[1];
        }
    }
    const names = Object.keys(aliases).map(n => n.replace(/\$/g, '\\$')).join('|');
    const fileCallRe = new RegExp(`(?<![\\w.$])(${names})\\(\\s*(['"\`])([a-z0-9_]+(?:\\.[A-Za-z0-9_]+)+)\\2`, 'g');
    for (const m of text.matchAll(fileCallRe)) {
        const [, alias, , key] = m;
        const fn = aliases[alias];
        if (!used.has(key)) used.set(key, `${rel}:${lineOf(m.index)}`);
        if (!(key in en)) err(`${rel}:${lineOf(m.index)}: ${fn}('${key}') is not in en.json`);
        else if (fn === 'tp' && !isPlural(en[key])) err(`${rel}:${lineOf(m.index)}: tp('${key}') but the value isn't a plural object`);
    }
    // Saved messages name their key in an object: { key: 'msg.x.y', params }.
    for (const m of text.matchAll(/(?<![\w$])(?:key|titleKey|textKey|labelKey|descKey|loc)\s*:\s*(['"`])((?:msg|ui|tutorial|common|save|log|html)\.[A-Za-z0-9_.]+)\1/g)) {
        const key = m[2];
        if (!used.has(key)) used.set(key, `${rel}:${lineOf(m.index)}`);
        if (!(key in en)) err(`${rel}:${lineOf(m.index)}: key '${key}' is not in en.json`);
    }
    // Keys built at runtime count by prefix: `msg.x.${id}`, 'msg.x.' + id,
    // idLabel('msg.x', id). Keys picked by a ternary or table count when they
    // appear as a quoted literal anywhere.
    for (const m of text.matchAll(/[`'"]((?:ui|msg|tutorial|common|save|log|html|glossary|changelog|config)\.[A-Za-z0-9_.]+?)(?:\$\{|['"]\s*\+)/g)) codePrefixes.add(m[1]);
    for (const m of text.matchAll(/idLabel\(\s*['"]([a-z0-9_.]+)['"]/g)) codePrefixes.add(m[1] + '.');
    for (const m of text.matchAll(/['"`]([a-z0-9_]+\.[A-Za-z0-9_.]+)['"`]/g)) quotedKeys.add(m[1]);
    for (const m of text.matchAll(attrRe)) {
        const key = m[1];
        if (!used.has(key)) used.set(key, `${rel}:${lineOf(m.index)}`);
        if (!(key in en)) err(`${rel}:${lineOf(m.index)}: data-i18n key "${key}" is not in en.json`);
    }
}

// --- Config text -------------------------------------------------------------------
// Load the config with the table, as the game does, and see which config text
// keys it fills from the table (used) and which still come from inline text.
const snap = JSON.parse(execFileSync(process.execPath, ['--no-warnings', path.join(ROOT, 'scripts/i18n/snapshot.mjs'), '--with-table'], { maxBuffer: 64 * 1024 * 1024 }).toString());
for (const key of snap.table) if (!used.has(key)) used.set(key, 'config');
if (!quiet && snap.inline.length) {
    console.log(`${snap.inline.length} config text field(s) still inline (not in en.json):`);
    for (const k of snap.inline.slice(0, 20)) console.log('  ' + k);
    if (snap.inline.length > 20) console.log(`  ... and ${snap.inline.length - 20} more`);
}

// --- Report ---------------------------------------------------------------------
const runtimePrefixes = [...dynamicPrefixes, ...[...codePrefixes].filter(p => p.split('.').length >= 2 && p.length > 4)];
const unused = Object.keys(en).filter(k => !used.has(k) && !quotedKeys.has(k) && !runtimePrefixes.some(p => k.startsWith(p)));
if (!quiet && unused.length) {
    console.log(`${unused.length} key(s) nothing appears to use:`);
    const shown = process.argv.includes('--all') ? unused : unused.slice(0, 50);
    for (const k of shown) console.log('  ' + k);
    if (unused.length > shown.length) console.log(`  ... and ${unused.length - shown.length} more (--all lists them)`);
}
if (!quiet) console.log(`${Object.keys(en).length} English keys, ${used.size} used literally, ${index.length} language(s).`);
if (errors.length) {
    for (const e of errors) console.error('error: ' + e);
    console.error(`${errors.length} error(s)`);
    process.exit(1);
}
console.log('i18n check passed');

// Dev-only: moves player-visible text out of a config file into locale/en.json.
//
//   node scripts/i18n/extract-config.mjs <file.js|all> [--dry-run]
//
// <file.js> is a name in js/core/config/ (e.g. magic.js). For each stampLoc()
// call in the file it finds the text literals stampLoc() would fill (the same
// fields, keys and nesting rules as js/core/i18n.js), and moves each one whose
// key and text match what the config produces at runtime. That check is what
// makes stripping safe: a literal is only removed if loading the config gives
// that exact key and text, so defText()/def.name find it in the table after.
//
// Text built at runtime (template literals with ${...}, spreads, function
// calls) can't be moved automatically and is listed as MANUAL.
// Lists of flavor lines (TEXT_ARRAY_FIELDS) become a count, e.g. `ambient: 12`,
// which stampLoc() expands back into the lines from the table.
// After writing, the config is loaded again with the new table and every moved
// key must resolve to its original text, or the script restores the file and
// exits non-zero.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_DIR = path.join(ROOT, 'js/core/config');
const EN_PATH = path.join(ROOT, 'locale/en.json');
const { TEXT_FIELDS, TEXT_ARRAY_FIELDS } = await import(new URL('../../js/core/i18n.js', import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = args.find(a => !a.startsWith('--'));
if (!target) {
    console.error('usage: extract-config.mjs <file.js|all> [--dry-run]');
    process.exit(2);
}
const files = target === 'all'
    ? fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.js')).sort()
    : [target];

function snapshot(withTable) {
    const out = execFileSync(process.execPath, ['--no-warnings', path.join(ROOT, 'scripts/i18n/snapshot.mjs'), ...(withTable ? ['--with-table'] : [])], { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out.toString()).text;
}

// HTML text (story milestones) is stored with its whitespace collapsed; the
// browser renders it the same.
const normalize = (s) => (/<[a-z][^>]*>/i.test(s) ? s.replace(/\s+/g, ' ').trim() : s);

function literalString(node) {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    return null;
}
const propName = (p) => (p.key.type === 'Identifier' ? p.key.name : String(p.key.value));

// Evaluates a literal options object like { idField: 'key', fields: ['label'] }.
function literalValue(node) {
    if (!node) return undefined;
    if (node.type === 'Literal') return node.value;
    if (node.type === 'ArrayExpression') return node.elements.map(literalValue);
    if (node.type === 'ObjectExpression') {
        const o = {};
        for (const p of node.properties) if (p.type === 'Property') o[propName(p)] = literalValue(p.value);
        return o;
    }
    return undefined;
}

function extractFile(file, inline, en) {
    const full = path.join(CONFIG_DIR, file);
    const src = fs.readFileSync(full, 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });

    const decls = {};
    for (const node of ast.body) {
        const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
        if (decl?.type !== 'VariableDeclaration') continue;
        for (const d of decl.declarations) if (d.init) decls[d.id.name] = d.init;
    }

    const found = [];     // { key, value, kind: 'prop'|'list', node }
    const manual = [];

    function visitObject(node, loc, ctx) {
        for (const p of node.properties) {
            if (p.type !== 'Property' || p.computed) continue;
            const k = propName(p);
            if (ctx.skip.has(k)) continue;
            const v = p.value;
            const str = literalString(v);
            if (ctx.fields.has(k)) {
                if (str != null) { found.push({ key: `${loc}.${k}`, value: str, kind: 'prop', node: p, parent: node }); continue; }
                if (v.type === 'TemplateLiteral' || v.type === 'CallExpression' || v.type === 'BinaryExpression' || v.type === 'ConditionalExpression') {
                    manual.push(`${loc}.${k} (${v.type} at line ${src.slice(0, v.start).split('\n').length})`);
                    continue;
                }
            }
            if (v.type === 'ArrayExpression') visitArray(v, `${loc}.${k}`, ctx, ctx.fields.has(k) || ctx.arrayFields.has(k), p);
            else if (v.type === 'ObjectExpression') visitObject(v, `${loc}.${k}`, ctx);
        }
    }

    function visitArray(node, loc, ctx, textList, prop) {
        if (node.elements.some(e => e?.type === 'SpreadElement')) {
            if (textList) manual.push(`${loc} (array with a spread)`);
            return;
        }
        const lines = [];
        node.elements.forEach((el, i) => {
            if (!el) return;
            const str = literalString(el);
            if (str != null) {
                if (textList) lines.push({ key: `${loc}.${i}`, value: str });
            } else if (el.type === 'ObjectExpression') {
                const keyProp = el.properties.find(p => p.type === 'Property' && !p.computed && propName(p) === 'key');
                const id = keyProp && (typeof keyProp.value.value === 'string' || typeof keyProp.value.value === 'number') ? keyProp.value.value : i;
                visitObject(el, `${loc}.${id}`, ctx);
            } else if (textList && el.type === 'TemplateLiteral') {
                manual.push(`${loc}.${i} (template at line ${src.slice(0, el.start).split('\n').length})`);
            }
        });
        if (textList && lines.length && lines.length === node.elements.length && prop) {
            found.push({ key: loc, value: null, kind: 'list', node: prop, lines });
        } else if (textList && lines.length) {
            manual.push(`${loc} (list mixes text with other values)`);
        }
    }

    function visitCollection(init, category, ctx) {
        if (!init) return;
        if (init.type === 'ObjectExpression') {
            for (const p of init.properties) {
                if (p.type !== 'Property' || p.computed) continue;
                const id = propName(p);
                if (p.value.type === 'ObjectExpression') visitObject(p.value, `${category}.${id}`, ctx);
                else if (p.value.type === 'ArrayExpression') visitArray(p.value, `${category}.${id}`, ctx, ctx.fields.has(id) || ctx.arrayFields.has(id), p);
                else if (p.value.type === 'Identifier' && decls[p.value.name]) {
                    // stampLoc({ dice: DICE_CONFIG }, 'config'): a wrapper around a declaration.
                    const inner = decls[p.value.name];
                    if (inner.type === 'ObjectExpression') visitObject(inner, `${category}.${id}`, ctx);
                    else if (inner.type === 'ArrayExpression') visitArray(inner, `${category}.${id}`, ctx, false, null);
                }
            }
        } else if (init.type === 'ArrayExpression') {
            init.elements.forEach((el) => {
                if (el?.type !== 'ObjectExpression') return;
                const idProp = el.properties.find(p => p.type === 'Property' && !p.computed && propName(p) === ctx.idField);
                const id = idProp ? literalValue(idProp.value) : undefined;
                if (id != null) visitObject(el, `${category}.${id}`, ctx);
            });
        }
    }

    for (const node of ast.body) {
        if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression') continue;
        const call = node.expression;
        if (call.callee.name !== 'stampLoc') continue;
        const [collArg, catArg, optsArg] = call.arguments;
        const category = literalValue(catArg);
        const opts = literalValue(optsArg) || {};
        const ctx = {
            idField: opts.idField || 'key',
            fields: new Set(opts.fields || TEXT_FIELDS),
            arrayFields: new Set(TEXT_ARRAY_FIELDS),
            skip: new Set(opts.skip || []),
        };
        const init = collArg.type === 'Identifier' ? decls[collArg.name] : collArg;
        visitCollection(init, category, ctx);
    }

    // Keep only literals whose key and text match what the runtime produces.
    const moves = [];
    const mismatched = [];
    for (const f of found) {
        const pairs = f.kind === 'list' ? f.lines : [{ key: f.key, value: f.value }];
        const ok = pairs.every(({ key, value }) => key in inline && inline[key] === value);
        if (!ok) { mismatched.push(f.key); continue; }
        const conflicts = pairs.filter(({ key, value }) => key in en && en[key] !== normalize(value));
        if (conflicts.length) { mismatched.push(`${f.key} (en.json already has different text)`); continue; }
        moves.push(f);
    }

    // Edit the source from the end so earlier offsets stay valid.
    const removed = new Set(moves.filter(f => f.kind === 'prop').map(f => f.node));
    let edits = [];
    for (const f of moves) {
        if (f.kind === 'list') {
            edits.push({ start: f.node.value.start, end: f.node.value.end, text: String(f.lines.length) });
            continue;
        }
        edits.push(removalRange(src, f.node, f.parent, removed));
    }
    // Neighbouring removals can overlap (a last property takes the comma
    // before it); merge them so each character is removed once.
    edits.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const e of edits) {
        const last = merged[merged.length - 1];
        if (last && e.start < last.end && !e.text && !last.text) last.end = Math.max(last.end, e.end);
        else merged.push({ ...e });
    }
    edits = merged.reverse();
    let out = src;
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

    const strings = {};
    for (const f of moves) {
        if (f.kind === 'list') for (const l of f.lines) strings[l.key] = l.value;
        else strings[f.key] = normalize(f.value);
    }
    return { file, full, src, out, strings, manual, mismatched, moved: moves.length };
}

// Range that removes a property cleanly: its whole line when it sits alone on
// one, otherwise the property plus the comma that follows (or precedes it, for
// the last property).
function removalRange(src, prop, parent, removed) {
    let start = prop.start;
    let end = prop.end;
    const after = src.slice(end);
    const comma = /^\s*,/.exec(after);
    if (comma) end += comma[0].length;
    const lineStart = src.lastIndexOf('\n', start - 1) + 1;
    const before = src.slice(lineStart, start);
    const rest = /^[ \t]*(\/\/[^\n]*)?\n/.exec(src.slice(end));
    if (/^[ \t]*$/.test(before) && rest && !rest[1]) {
        return { start: lineStart, end: end + rest[0].length, text: '' };
    }
    if (!comma) {
        // Last property: drop the comma after the last property that stays.
        let idx = parent.properties.indexOf(prop) - 1;
        while (idx >= 0 && removed.has(parent.properties[idx])) idx--;
        if (idx >= 0) start = parent.properties[idx].end;
        return { start, end, text: '' };
    }
    const spaces = /^[ \t]*/.exec(src.slice(end))[0];
    return { start, end: end + spaces.length, text: '' };
}

// ---------------------------------------------------------------------------
const before = snapshot(false);
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const results = files.map(f => extractFile(f, before, en));

let total = 0;
for (const r of results) {
    total += Object.keys(r.strings).length;
    console.log(`${r.file}: ${Object.keys(r.strings).length} string(s) in ${r.moved} field(s)`);
    for (const m of r.manual) console.log(`  MANUAL ${m}`);
    for (const m of r.mismatched) console.log(`  SKIPPED ${m}`);
}
if (dryRun) {
    console.log(`dry run: ${total} string(s) would move`);
    process.exit(0);
}

const merged = { ...en };
for (const r of results) Object.assign(merged, r.strings);
const sorted = Object.fromEntries(Object.keys(merged).sort().map(k => [k, merged[k]]));
const enBefore = fs.readFileSync(EN_PATH, 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(sorted, null, 2) + '\n');
for (const r of results) fs.writeFileSync(r.full, r.out);

function restore(msg) {
    if (process.env.I18N_NO_RESTORE) { console.error(msg); process.exit(1); }
    console.error(msg);
    fs.writeFileSync(EN_PATH, enBefore);
    for (const r of results) fs.writeFileSync(r.full, r.src);
    console.error('restored the config files and locale/en.json');
    process.exit(1);
}

for (const r of results) {
    try { execFileSync(process.execPath, ['--check', r.full], { stdio: 'pipe' }); }
    catch (e) { restore(`${r.file}: stripped source doesn't parse:\n${e.stderr}`); }
}
let after;
try { after = snapshot(true); } catch (e) { restore(`config failed to load after stripping:\n${e.stderr || e.message}`); }
const bad = [];
for (const r of results) {
    for (const [key, value] of Object.entries(r.strings)) {
        const original = normalize(before[key]);
        if (normalize(after[key] ?? '') !== original) bad.push(key);
    }
}
if (bad.length) restore(`${bad.length} key(s) no longer resolve to their text, e.g. ${bad.slice(0, 5).join(', ')}`);
console.log(`moved ${total} string(s); every moved key resolves to its original text`);

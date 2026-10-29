// Shared helpers for editors that export full config files.
//
// Exports are produced by splicing edited entries into the real config source
// text, so comments, non-exported helpers, derived exports and every entry the
// editor does not touch survive byte-for-byte. Edited entries are written with
// a generic JS literal serializer.

// Mods merge into the live config objects in place, so editors read base data
// from a second module instance. A distinct URL gives a distinct ES module
// record; both the Electron app:// handler and static servers ignore the query.
export async function importPristineConfig(file) {
    const url = new URL(`../core/config/${file}`, import.meta.url);
    url.searchParams.set('pristine', '1');
    try {
        return await import(url.href);
    } catch (err) {
        console.warn(`Editor: could not load unmodded ${file}, falling back to live config.`, err);
        return null;
    }
}

export async function fetchConfigSource(file) {
    const res = await fetch(new URL(`../core/config/${file}`, import.meta.url));
    if (!res.ok) throw new Error(`Could not read ${file} (HTTP ${res.status})`);
    return res.text();
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const INLINE_MAX = 160;

function quoteString(s) {
    // JSON.stringify does the escaping; then swap to single quotes to match the config style.
    return `'${JSON.stringify(s).slice(1, -1).replace(/\\(.)|'/g, (m, c) => c === undefined ? "\\'" : (c === '"' ? '"' : m))}'`;
}

function formatKey(key) {
    // A literal `__proto__:` key sets the prototype instead of defining a property.
    if (key === '__proto__') return `[${quoteString(key)}]`;
    return IDENT_RE.test(key) || /^(0|[1-9]\d*)$/.test(key) ? key : quoteString(key);
}

// toString() of a function is only usable as an expression for function/class
// declarations and arrows; method shorthand (`foo() {}`) and natives are not.
function functionSource(fn) {
    const src = fn.toString();
    const ok = /^(async\s+)?(function\b|class\b)/.test(src) || /^(async\s*)?(\(|[A-Za-z_$][\w$]*\s*=>)/.test(src);
    if (!ok || /\{\s*\[native code\]\s*\}$/.test(src)) {
        throw new Error(`Cannot serialize function "${fn.name || '(anonymous)'}" as config source`);
    }
    return src;
}

// Serialize a value as JS source. `inline` forces a single line; otherwise
// objects and arrays that don't fit on one line are expanded. Throws on values
// with no faithful literal form (Date, RegExp, BigInt, Symbol, class instances).
export function toJsLiteral(value, { indent = '', inline = false } = {}) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return quoteString(value);
    if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'function') return functionSource(value);
    if (typeof value !== 'object') throw new Error(`Cannot serialize a ${typeof value} as config source`);
    if (value instanceof Set) return `new Set(${toJsLiteral([...value], { indent, inline })})`;
    if (value instanceof Map) return `new Map(${toJsLiteral([...value], { indent, inline })})`;

    const isArr = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (!isArr && proto !== Object.prototype && proto !== null) {
        throw new Error(`Cannot serialize a ${value.constructor?.name || 'non-plain'} object as config source`);
    }
    const parts = isArr
        ? value.map(v => [null, v])
        : Object.entries(value).filter(([, v]) => v !== undefined);
    if (parts.length === 0) return isArr ? '[]' : '{}';

    const fmt = (k, s) => (k === null ? s : `${formatKey(k)}: ${s}`);
    const flat = parts.map(([k, v]) => fmt(k, toJsLiteral(v, { inline: true }))).join(', ');
    const oneLine = isArr ? `[${flat}]` : `{ ${flat} }`;
    if (inline || (oneLine.length + indent.length <= INLINE_MAX && !oneLine.includes('\n'))) return oneLine;

    const inner = indent + '    ';
    const lines = parts.map(([k, v]) => `${inner}${fmt(k, toJsLiteral(v, { indent: inner }))},`);
    return `${isArr ? '[' : '{'}\n${lines.join('\n')}\n${indent}${isArr ? ']' : '}'}`;
}

// --- Minimal JS scanner: enough to walk config object literals ---

function skipString(src, i) {
    const q = src[i++];
    while (i < src.length) {
        const c = src[i];
        if (c === '\\') { i += 2; continue; }
        if (q === '`' && c === '$' && src[i + 1] === '{') { i = skipBalanced(src, i + 1); continue; }
        if (c === q) return i + 1;
        i++;
    }
    throw new Error('Unterminated string in config source');
}

function skipComment(src, i) {
    if (src[i] !== '/') return -1;
    if (src[i + 1] === '/') { const n = src.indexOf('\n', i); return n === -1 ? src.length : n; }
    if (src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); if (n === -1) throw new Error('Unterminated comment'); return n + 2; }
    return -1;
}

// src[i] is an opening bracket; returns the index just past its match.
function skipBalanced(src, i) {
    let depth = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
        const ce = skipComment(src, i);
        if (ce !== -1) { i = ce; continue; }
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') { if (--depth === 0) return i + 1; }
        i++;
    }
    throw new Error('Unbalanced brackets in config source');
}

function parseKeyToken(src, i) {
    const c = src[i];
    if (c === "'" || c === '"') {
        const end = skipString(src, i);
        const raw = src.slice(i + 1, end - 1);
        // Config keys are plain identifiers-with-punctuation; resolve the common escapes only.
        return { key: raw.replace(/\\(.)/g, '$1'), end };
    }
    const m = /^[\w$]+/.exec(src.slice(i, i + 200));
    if (!m) throw new Error(`Unexpected token in config object at offset ${i}`);
    return { key: m[0], end: i + m[0].length };
}

// Locate `export const NAME = {...}` and list its top-level entries. Each
// entry's [start, end) covers its whole line(s) when it sits on its own line,
// so splicing keeps the surrounding comments and formatting intact.
export function findExportObject(src, name) {
    const re = new RegExp(`^export const ${name}\\s*=\\s*\\{`, 'm');
    const m = re.exec(src);
    if (!m) throw new Error(`export const ${name} not found in config source`);
    const open = m.index + m[0].length - 1;
    const closeEnd = skipBalanced(src, open);
    const close = closeEnd - 1;
    const entries = [];
    let i = open + 1;
    while (i < close) {
        const c = src[i];
        if (/\s|,/.test(c)) { i++; continue; }
        const ce = skipComment(src, i);
        if (ce !== -1) { i = ce; continue; }
        const keyStart = i;
        const { key, end: keyEnd } = parseKeyToken(src, i);
        i = keyEnd;
        while (/\s/.test(src[i])) i++;
        if (src[i] !== ':') throw new Error(`Unsupported syntax for key "${key}" in ${name}`);
        i++;
        // valueEnd tracks the end of the last value token, before any trailing space or comment.
        let valueEnd = i;
        while (i < close && src[i] !== ',') {
            const ch = src[i];
            if (ch === "'" || ch === '"' || ch === '`') { i = valueEnd = skipString(src, i); continue; }
            const ce2 = skipComment(src, i);
            if (ce2 !== -1) { i = ce2; continue; }
            if (ch === '{' || ch === '[' || ch === '(') { i = valueEnd = skipBalanced(src, i); continue; }
            i++;
            if (!/\s/.test(ch)) valueEnd = i;
        }
        const hasComma = src[i] === ',';
        if (hasComma) i++;
        const lineStart = src.lastIndexOf('\n', keyStart - 1) + 1;
        const ownLine = /^[ \t]*$/.test(src.slice(lineStart, keyStart));
        const start = ownLine ? lineStart : keyStart;
        let end = i;
        const nl = src.indexOf('\n', i);
        const rest = src.slice(i, nl === -1 ? close : nl);
        if (ownLine && /^[ \t]*$/.test(rest) && nl !== -1 && nl < close) end = nl + 1;
        entries.push({
            key, start, end, valueEnd, hasComma, ownLine,
            indent: ownLine ? src.slice(lineStart, keyStart) : '',
            endsLine: src[end - 1] === '\n',
            multiline: src.slice(keyStart, i).includes('\n'),
        });
    }
    const closeLineStart = src.lastIndexOf('\n', close - 1) + 1;
    const exportLineStart = src.lastIndexOf('\n', m.index - 1) + 1;
    return {
        open, close, entries,
        // Only a `}` alone on a line below the export line can take new entries in front of its line.
        closeOwnLine: closeLineStart > open && /^[ \t]*$/.test(src.slice(closeLineStart, close)),
        closeLineStart,
        baseIndent: src.slice(exportLineStart, m.index).match(/^[ \t]*/)[0],
    };
}

function formatEntry(key, value, indent, multiline) {
    return `${formatKey(key)}: ${toJsLiteral(value, { indent, inline: !multiline })}`;
}

// Rewrite one export object in `src`. `changed` and `added` map key -> value,
// `removed` is a set of keys, `renamed` maps oldKey -> { key, value } and keeps
// the entry where it was. New entries go at the end of the object.
export function spliceExportObject(src, name, { changed = new Map(), removed = new Set(), added = new Map(), renamed = new Map(), multiline = false } = {}) {
    const { close, entries, closeOwnLine, closeLineStart, baseIndent } = findExportObject(src, name);
    const edits = [];
    const kept = entries.filter(e => !removed.has(e.key));
    const last = kept[kept.length - 1];
    // The last surviving entry needs a comma before anything is appended after it.
    const lastNeedsComma = added.size > 0 && last && !last.hasComma;
    for (const e of entries) {
        if (removed.has(e.key)) { edits.push([e.start, e.end, '']); continue; }
        const ren = renamed.get(e.key);
        if (!ren && !changed.has(e.key)) {
            if (e === last && lastNeedsComma) edits.push([e.valueEnd, e.valueEnd, ',']);
            continue;
        }
        const key = ren ? ren.key : e.key;
        const value = ren ? ren.value : changed.get(e.key);
        const comma = e.hasComma || e.ownLine || (e === last && lastNeedsComma) ? ',' : '';
        const text = e.ownLine
            ? `${e.indent}${formatEntry(key, value, e.indent, e.multiline)}${comma}${e.endsLine ? '\n' : ''}`
            : `${formatEntry(key, value, '', false)}${comma}${e.hasComma ? '' : ' '}`;
        edits.push([e.start, e.end, text]);
    }
    if (added.size) {
        const indent = kept.find(e => e.ownLine)?.indent || entries.find(e => e.ownLine)?.indent || baseIndent + '    ';
        const text = [...added].map(([k, v]) => `${indent}${formatEntry(k, v, indent, multiline)},\n`).join('');
        // A `}` sharing its line with the export or the last entry gets the new entries on lines of their own.
        if (closeOwnLine) edits.push([closeLineStart, closeLineStart, text]);
        else edits.push([close, close, `\n${text}${baseIndent}`]);
    }
    edits.sort((a, b) => b[0] - a[0]);
    let out = src;
    for (const [s, e, text] of edits) out = out.slice(0, s) + text + out.slice(e);
    return out;
}

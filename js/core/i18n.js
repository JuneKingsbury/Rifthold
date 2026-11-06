// Localization: every player-visible string is looked up by key in a per-language
// table (locale/<lang>.json). English is always loaded as the fallback, so a key
// missing from another language still shows English, and a key missing from both
// shows the inline fallback passed by the caller, or the key itself.
//
// This module imports nothing from the game and touches the DOM only behind
// guards, so it loads in boot.js before main.js and in Node (scripts/expsim).
//
// Keys are flat and dotted: `ui.settings.language`, `log.raid.arrived`.
// Config text uses derived keys `<category>.<id>.<field>` (see stampLoc/defText),
// so a config entry needs no key fields of its own.
//
// Placeholders: `{name}` is replaced by params.name. `{{` and `}}` are literal braces.
// Plurals: the table value is an object of Intl.PluralRules categories, at least
// { "one": ..., "other": ... }; look it up with tp(key, n).
//
// HTML safety: t() returns plain text. Escape it (escapeHtml/escapeAttr in
// js/ui/ui-utils.js) before putting it into innerHTML or an attribute, exactly as
// for any other string. Only keys ending in `_html` may hold markup; read those
// with tHtml(), which escapes the params but not the template, and sanitize the
// result if mods can supply it.
//
// Debugging, by URL flag or localStorage:
//   ?i18n-debug   (or rifthold_i18n_debug = '1') logs each missing key once.
//   ?i18n-pseudo  (or rifthold_i18n_pseudo = '1') wraps every looked-up string in
//                 [[...]], so text that bypasses the table stands out on screen.

const FALLBACK_LANG = 'en';

let _lang = FALLBACK_LANG;
let _table = Object.create(null);      // current language, empty when it is English
let _fallback = Object.create(null);   // English
let _plural = new Intl.PluralRules(FALLBACK_LANG);
let _languages = [{ code: FALLBACK_LANG, label: 'English' }];
const _missing = new Set();

function _flag(name) {
    try {
        if (globalThis.location && new URLSearchParams(globalThis.location.search).has(name)) return true;
        return globalThis.localStorage?.getItem('rifthold_' + name.replace('-', '_')) === '1';
    } catch {
        return false;
    }
}
const _debug = _flag('i18n-debug');
const _pseudo = _flag('i18n-pseudo');

function _noteMissing(key) {
    if (_missing.has(key)) return;
    _missing.add(key);
    if (_debug) console.warn('[i18n] missing key:', key);
}

function _escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _format(template, params) {
    const out = params
        ? template.replace(/\{\{|\}\}|\{(\w+)\}/g, (m, name) => {
            if (m === '{{') return '{';
            if (m === '}}') return '}';
            return Object.prototype.hasOwnProperty.call(params, name) ? _paramText(params[name]) : m;
        })
        : template.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    return _pseudo ? `[[${out}]]` : out;
}

// A param is a plain value, or a reference made by ref()/defRef() that is looked
// up when the string is shown. Stored log entries and thoughts keep references,
// so they show in whatever language is active when they're read.
function _paramText(value) {
    if (value && typeof value === 'object') {
        if (typeof value.$t === 'string') return t(value.$t, value.p, value.fb);
        if (typeof value.$f === 'string') {
            const fmt = _paramTypes[value.$f];
            return fmt ? String(fmt(value.v)) : String(value.fb ?? '');
        }
    }
    return String(value ?? '');
}

// Formatters for params that are built from parts rather than one key (item
// names: quality + base + enchantment). Registered by the module that owns the
// data, e.g. item-roll.js registers 'item'.
const _paramTypes = Object.create(null);

/**
 * Registers a formatter for typed params `{ $f: type, v: data, fb: text }`.
 * The formatter receives `v` and returns display text in the active language.
 */
export function registerParamType(type, format) {
    _paramTypes[type] = format;
}

// Raw table value for a key: a string, a plural object, or undefined.
function _lookup(key) {
    const v = _table[key];
    return v !== undefined ? v : _fallback[key];
}

function _pickPlural(value, n) {
    if (typeof value === 'string') return value;
    return value[_plural.select(n)] ?? value.other ?? '';
}

async function _fetchJson(url, fetchImpl) {
    try {
        const resp = await fetchImpl(url);
        if (!resp.ok) return null;
        return await resp.json();
    } catch {
        return null;
    }
}

function _setLanguage(lang) {
    _lang = lang;
    try { _plural = new Intl.PluralRules(lang); } catch { _plural = new Intl.PluralRules(FALLBACK_LANG); }
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
}

/**
 * Loads English plus the chosen language. Never throws: if a file is missing the
 * game runs on whatever loaded, falling back to inline text or keys.
 * @param {string} lang Language code from settings, e.g. 'en'.
 * @param {{ baseUrl?: string|URL, fetchImpl?: Function }} [opts] baseUrl is the
 *   locale/ directory; defaults to the one next to js/.
 */
export async function loadLocale(lang, { baseUrl = new URL('../../locale/', import.meta.url), fetchImpl = globalThis.fetch } = {}) {
    const base = String(baseUrl).replace(/\/?$/, '/');
    if (typeof fetchImpl !== 'function') {
        console.warn('[i18n] no fetch available; using inline text');
        return;
    }
    const [index, en] = await Promise.all([
        _fetchJson(base + 'index.json', fetchImpl),
        _fetchJson(base + FALLBACK_LANG + '.json', fetchImpl),
    ]);
    if (Array.isArray(index) && index.length) _languages = index;
    if (en) _fallback = Object.assign(Object.create(null), en);
    else console.warn('[i18n] could not load locale/en.json; using inline text');

    let target = FALLBACK_LANG;
    if (lang && lang !== FALLBACK_LANG) {
        // index.json only drives the language menu; a file installed without an
        // entry there (a test or hand-made locale) still loads.
        const data = /^[a-zA-Z_-]+$/.test(lang) ? await _fetchJson(base + lang + '.json', fetchImpl) : null;
        if (data) {
            _table = Object.assign(Object.create(null), data);
            target = lang;
        } else {
            console.warn(`[i18n] language "${lang}" is not available; using English`);
        }
    }
    _setLanguage(target);
    _invalidateIndex();
}

/** Synchronous load for Node and tests: sets the table for `lang` directly. */
export function loadLocaleData(lang, data) {
    if (lang === FALLBACK_LANG) {
        _fallback = Object.assign(Object.create(null), data);
        _table = Object.create(null);
    } else {
        _table = Object.assign(Object.create(null), data);
    }
    _setLanguage(lang);
    _invalidateIndex();
}

/**
 * Merges extra strings (a mod's locale file) into the table for `lang`. Keys
 * already present win unless `overwrite` is set, so a mod can't silently replace
 * base game text. Strings for a language that isn't active are ignored.
 */
export function mergeLocale(lang, data, { overwrite = false } = {}) {
    let target = null;
    if (lang === FALLBACK_LANG) target = _fallback;
    else if (lang === _lang) target = _table;
    if (!target || !data) return;
    for (const [key, value] of Object.entries(data)) {
        if (overwrite || target[key] === undefined) target[key] = value;
    }
    _invalidateIndex();
}

/** Adds English text for a key only if no locale file defines it (inline mod text). */
export function registerFallback(key, text) {
    if (text == null || _fallback[key] !== undefined) return;
    _fallback[key] = String(text);
    _invalidateIndex();
}

/** True if the active language or English defines `key`. */
export function hasKey(key) {
    return _lookup(key) !== undefined;
}

/**
 * Looks up a plain-text string.
 * @param {string} key Dotted key, e.g. 'ui.settings.language'.
 * @param {object} [params] Values for `{name}` placeholders.
 * @param {string} [fallback] Text to use when no table defines the key
 *   (inline config text during migration). Placeholders in it are filled too.
 * @returns {string}
 */
export function t(key, params, fallback) {
    const v = _lookup(key);
    if (v !== undefined) return _format(_pickPlural(v, params?.n ?? 2), params);
    _noteMissing(key);
    return fallback != null ? _format(String(fallback), params) : key;
}

/**
 * Looks up a plural string. `n` picks the plural form and is also available to
 * the template as `{n}`.
 */
export function tp(key, n, params) {
    const all = { ...params, n };
    const v = _lookup(key);
    if (v !== undefined) return _format(_pickPlural(v, n), all);
    _noteMissing(key);
    return key;
}

/**
 * Looks up a string that carries markup. Params are HTML-escaped; the template
 * is not. Keys must end in `_html` so the checker can tell markup is intended.
 */
export function tHtml(key, params, fallback) {
    if (_debug && !key.endsWith('_html')) console.warn('[i18n] tHtml used on a non-_html key:', key);
    let escaped;
    if (params) {
        escaped = {};
        for (const [k, v] of Object.entries(params)) escaped[k] = _escapeHtml(v);
    }
    return t(key, escaped, fallback);
}

export function getLanguage() {
    return _lang;
}

/** Languages listed in locale/index.json, as [{ code, label }]. */
export function getAvailableLanguages() {
    return _languages.slice();
}

/** Keys looked up this session that no table defined (for dev tooling). */
export function getMissingKeys() {
    return [..._missing].sort();
}

// ---------------------------------------------------------------------------
// Config text. Config entries keep only mechanics; their text lives in the
// table under `<category>.<id>.<field>`. stampLoc() records that prefix on each
// entry as `_loc` and fills the entry's text fields from the table, so code
// that reads `def.name` or `def.description` gets the active language with no
// changes. The table is loaded in boot.js before any config module runs; in
// Node, call loadLocaleData() before importing config.
//
// It stamps `_loc` rather than an `id` field because items are created as
// shallow copies of their config entry (`{ ...ALL_ITEMS[key], key }`) and
// instances already use `id` for themselves.
// ---------------------------------------------------------------------------

// Property names that hold player-visible text in config entries. Fields that
// double as identifiers (category, realmGroup, chain) are deliberately absent.
export const TEXT_FIELDS = Object.freeze([
    'name', 'description', 'desc', 'text', 'label', 'lore', 'title', 'summary',
    'prefix', 'suffix', 'notification', 'message', 'detail', 'logMessage', 'logText',
    'transitionText', 'armorText', 'successText', 'failText', 'approachText',
    'defeatText', 'arrivalText', 'promptText', 'logAccept', 'logRefuse',
    'flavor', 'flavour', 'tooltip', 'hint', 'displayName', 'subtitle',
]);
// Arrays of strings under these names are lists of text (flavor lines).
export const TEXT_ARRAY_FIELDS = Object.freeze([
    'ambient', 'discoveries', 'traps', 'combatStart', 'combatHit', 'combatMiss', 'combatDefeat',
]);
const _defaultFields = new Set(TEXT_FIELDS);
const _defaultArrayFields = new Set(TEXT_ARRAY_FIELDS);

const _inlineKeys = new Map();    // config text not found in the table (still inline): key -> text
const _tableKeys = new Map();     // config text filled from the table: key -> text

// Table keys grouped by prefix: 'spell.fireball' -> ['name', 'description'].
// Lets stampLoc() fill fields that exist only in the table (text stripped from
// the config file). Rebuilt lazily after the table changes.
let _fieldIndex = null;
function _invalidateIndex() { _fieldIndex = null; }
function _fieldsFor(prefix) {
    if (!_fieldIndex) {
        _fieldIndex = new Map();
        for (const key of new Set([...Object.keys(_fallback), ...Object.keys(_table)])) {
            const dot = key.lastIndexOf('.');
            if (dot < 0) continue;
            const p = key.slice(0, dot);
            let list = _fieldIndex.get(p);
            if (!list) _fieldIndex.set(p, list = []);
            list.push(key.slice(dot + 1));
        }
    }
    return _fieldIndex.get(prefix);
}

function _hydrate(key, inline) {
    const v = _lookup(key);
    if (v === undefined) {
        if (inline != null) _inlineKeys.set(key, inline);
        return inline;
    }
    const s = typeof v === 'string' ? v : (v.other ?? '');
    _tableKeys.set(key, s);
    return _pseudo ? `[[${s}]]` : s;
}

function _isPlainObject(v) {
    if (!v || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

/**
 * Stamps `_loc = '<category>.<id>'` on every entry of a config map or array,
 * and fills each text field from the table (`<_loc>.<field>`), including
 * fields the entry doesn't have inline (text moved to the table, or names that
 * only exist there, like building names). Nested objects
 * and arrays inside an entry are walked too, extending the key with the
 * property name, or an array element's `key` (index when it has none):
 * `realm.crystal_mines.boss.approachText`, `exp_decision.fork.options.0.text`. Safe to call more than once; an object
 * that already has `_loc` is left alone, so the first category wins for shared
 * objects.
 * @param {object|Array} collection Map of id -> entry, or array of entries.
 * @param {string} category Key prefix, e.g. 'spell'.
 * @param {object} [opts]
 * @param {string} [opts.idField='key'] Id property for array entries.
 * @param {string[]} [opts.fields] Text fields to fill; defaults to TEXT_FIELDS.
 * @param {string[]} [opts.skip] Properties not to walk into.
 * @returns the collection, for chaining.
 */
export function stampLoc(collection, category, { idField = 'key', fields, skip = [] } = {}) {
    if (!collection) return collection;
    if (!_stamped.some(([c, cat]) => c === collection && cat === category)) _stamped.push([collection, category, { idField, fields, skip }]);
    const textFields = fields ? new Set(fields) : _defaultFields;
    const skipSet = new Set(skip);
    // Array elements are keyed by their `key` property when they have one, so
    // reordering a list doesn't change its keys; otherwise by index.
    const visitArray = (list, loc, textList) => {
        list.forEach((el, i) => {
            if (typeof el === 'string') {
                if (textList) list[i] = _hydrate(`${loc}.${i}`, el);
            } else if (_isPlainObject(el)) {
                const id = typeof el.key === 'string' || typeof el.key === 'number' ? el.key : i;
                visit(el, `${loc}.${id}`, false);
            }
        });
    };
    const visit = (obj, loc, top) => {
        if (obj._loc) return;
        let hasText = top;
        for (const k of Object.keys(obj)) {
            if (skipSet.has(k)) continue;
            const v = obj[k];
            if (typeof v === 'string') {
                if (textFields.has(k)) { obj[k] = _hydrate(`${loc}.${k}`, v); hasText = true; }
            } else if (typeof v === 'number' && _defaultArrayFields.has(k) && _lookup(`${loc}.${k}.0`) !== undefined) {
                // A count in place of a list of flavor lines: the lines are all in
                // the table as `<loc>.<field>.0` ... `<loc>.<field>.<n-1>`.
                obj[k] = Array.from({ length: v }, (_, i) => _hydrate(`${loc}.${k}.${i}`, ''));
                hasText = true;
            } else if (Array.isArray(v)) {
                const textList = textFields.has(k) || _defaultArrayFields.has(k);
                visitArray(v, `${loc}.${k}`, textList);
                if (textList && v.some(el => typeof el === 'string')) hasText = true;
            } else if (_isPlainObject(v)) {
                visit(v, `${loc}.${k}`, false);
            }
        }
        // Fields whose text is only in the table (stripped from the config file,
        // or never inline, like building names).
        for (const k of _fieldsFor(loc) || []) {
            if (obj[k] === undefined && !skipSet.has(k)) {
                obj[k] = _hydrate(`${loc}.${k}`, null);
                hasText = true;
            }
        }
        if (hasText) Object.defineProperty(obj, '_loc', { value: loc, enumerable: true, writable: true, configurable: true });
    };
    if (Array.isArray(collection)) {
        for (const def of collection) {
            if (_isPlainObject(def) && def[idField] != null) visit(def, `${category}.${def[idField]}`, true);
        }
    } else {
        for (const [id, def] of Object.entries(collection)) {
            if (typeof def === 'number' && _defaultArrayFields.has(id) && _lookup(`${category}.${id}.0`) !== undefined) {
                collection[id] = Array.from({ length: def }, (_, i) => _hydrate(`${category}.${id}.${i}`, ''));
                continue;
            }
            if (_isPlainObject(def)) visit(def, `${category}.${id}`, true);
            else if (Array.isArray(def)) visitArray(def, `${category}.${id}`, textFields.has(id) || _defaultArrayFields.has(id));
        }
    }
    return collection;
}

// Every stampLoc() call, so entries added later (mods) can be stamped too.
const _stamped = [];

/**
 * Stamps entries added to config collections since they were first stamped
 * (mod content), filling their text from any mod locale strings merged since.
 * Entries already stamped are left alone.
 */
export function restampConfig() {
    for (const [collection, category, opts] of _stamped) stampLoc(collection, category, opts);
}

/** Config text keys still coming from inline text, i.e. not yet in the table (dev tooling). */
export function getInlineConfigKeys() {
    return [..._inlineKeys.keys()].sort();
}

/** Config text keys filled from the table (dev tooling: they count as used). */
export function getTableConfigKeys() {
    return [..._tableKeys.keys()].sort();
}

/** Every config text key seen by stampLoc, with the text it resolved to (dev tooling). */
export function getConfigTextSnapshot() {
    return Object.fromEntries([..._inlineKeys, ..._tableKeys]);
}

/**
 * Text field of a config entry, e.g. defText(SPELLS.fireball, 'description').
 * Falls back to the entry's inline field, so it works before and after that
 * field moves into the locale file.
 */
export function defText(def, field, params) {
    if (!def) return '';
    const inline = def[field];
    if (!def._loc) return inline == null ? '' : _format(String(inline), params);
    return t(`${def._loc}.${field}`, params, inline ?? '');
}

/**
 * A param that is translated when shown: t('log.x', { item: ref('item.iron_sword.name') }).
 * Plain JSON, so it can be saved with a log entry or thought.
 * @param {string} key Locale key.
 * @param {string} [fallback] Text when no table defines the key.
 * @param {object} [params] Params for the referenced string.
 */
export function ref(key, fallback, params) {
    const r = { $t: key };
    if (fallback != null) r.fb = String(fallback);
    if (params) r.p = params;
    return r;
}

/** A ref() to a config entry's text field, e.g. { item: defRef(ALL_ITEMS.iron_sword) }. */
export function defRef(def, field = 'name') {
    if (!def) return '';
    if (!def._loc) return def[field] == null ? '' : String(def[field]);
    return ref(`${def._loc}.${field}`, def[field]);
}

/**
 * A log message ({ key, params }) for a config entry's text field, for saved
 * logs: _addLog(exp, game, defMessage(trap, 'successText', { name })).
 * `field` may be a path into the entry, e.g. 'combatHit.2' for a line in a list.
 * Mod content without a locale key gets its inline text with params filled in.
 */
export function defMessage(def, field, params) {
    if (def?._loc && hasKey(`${def._loc}.${field}`)) return params ? { key: `${def._loc}.${field}`, params } : { key: `${def._loc}.${field}` };
    let inline = def;
    for (const part of String(field).split('.')) inline = inline?.[part];
    return inline == null ? '' : _format(String(inline), params);
}

/** Shorthand for defText(def, 'name'). */
export function defName(def, params) {
    return defText(def, 'name', params);
}

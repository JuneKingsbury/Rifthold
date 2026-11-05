// Small presentation helpers shared across the UI modules (ui.js, ui-arcane.js)
// and the exploration system. Kept dependency-free so any layer can import them.
import { EXPEDITION_XP_CONFIG, ANIMAL_XP_CONFIG } from '../core/config.js';

const ADVENTURER_ABILITY_DESCS = {
    scout:   'Scout: Reveals extra info about the next encounter before it starts.',
    rally:   'Rally: Chance to heal the party when a member falls in battle.',
    ambush:  'Ambush: First strike in combat, party attacks before enemies in round 1.',
    veteran: 'Veteran: Fatigue after expeditions is halved, so you can adventure again sooner.',
};

// Returns a multi-line tooltip string describing all active Adventurer level bonuses.
export function adventurerLevelTooltip(level) {
    if (!level || level <= 0) return 'No Adventurer levels yet.';
    const lines = [`Adventurer Level ${level} Active Bonuses:`];
    let damageMult = 1;
    let trapMult = 1;
    for (let lv = 1; lv <= level; lv++) {
        const b = EXPEDITION_XP_CONFIG.levelBonuses[lv];
        if (!b) continue;
        if (b.expeditionDamageMult) damageMult *= b.expeditionDamageMult;
        if (b.trapDamageMult) trapMult *= b.trapDamageMult;
        if (b.rareEncounterMult) lines.push(`Lv${lv}: +${Math.round((b.rareEncounterMult - 1) * 100)}% rare encounter chance`);
        if (b.ability) lines.push(`Lv${lv}: ${ADVENTURER_ABILITY_DESCS[b.ability] || b.ability}`);
    }
    if (damageMult > 1) lines.splice(1, 0, `Expedition damage: +${Math.round((damageMult - 1) * 100)}%`);
    if (trapMult < 1) lines.splice(damageMult > 1 ? 2 : 1, 0, `Trap damage taken: -${Math.round((1 - trapMult) * 100)}%`);
    const needed = EXPEDITION_XP_CONFIG.xpToLevel + level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
    if (level < EXPEDITION_XP_CONFIG.maxLevel) lines.push(`Next level at ${needed} XP.`);
    else lines.push('Maximum level reached.');
    return lines.join('\n');
}

// Returns an HTML badge string like ' <span ...>Lv3</span>' for an animal that
// has leveled up, or '' for level 0. Used by multiple UI panels.
export function animalLevelBadge(level) {
    if (!level || level <= 0) return '';
    const maxed = level >= ANIMAL_XP_CONFIG.maxLevel;
    const color = maxed ? '#ffaa22' : '#ffcc44';
    return ` <span style="color:${color};font-size:0.8em;font-weight:bold;">Lv${level}</span>`;
}

// Returns a tooltip string listing the cumulative bonuses an animal has earned.
export function animalLevelTooltip(level, animalType) {
    if (!level || level <= 0) return 'No Animal levels yet.';
    const isWarBeast = animalType === 'wolf' || animalType === 'boar';
    const bonusKey = isWarBeast ? 'warBeast' : 'packAnimal';
    const bonuses = ANIMAL_XP_CONFIG.levelBonuses[bonusKey];
    const lines = [`Animal Level ${level}:`];
    let totalHp = 0, totalDmg = 0, totalSpeed = 0;
    for (let lv = 1; lv <= level; lv++) {
        const b = bonuses[lv];
        if (!b) continue;
        if (b.hpBonus)        totalHp    += b.hpBonus;
        if (b.damageBonus)    totalDmg   += b.damageBonus;
        if (b.speedBonusAdd)  totalSpeed += b.speedBonusAdd;
    }
    if (totalHp)    lines.push(`+${totalHp} expedition HP`);
    if (totalDmg)   lines.push(`+${totalDmg} expedition damage`);
    if (totalSpeed) lines.push(`+${Math.round(totalSpeed * 100)}% expedition speed`);
    const needed = ANIMAL_XP_CONFIG.xpToLevel + level * ANIMAL_XP_CONFIG.xpScalePerLevel;
    if (level < ANIMAL_XP_CONFIG.maxLevel) lines.push(`Next level at ${needed} XP.`);
    else lines.push('Maximum level reached.');
    return lines.join('\n');
}

export function getTargetPriority(x) {
    let priority = 0;
    for (const item of [x.weapon, x.armor, x.helmet, x.clothes, x.boots, x.tool, x.trinket].filter(Boolean)) {
        priority += item.targetPriority || 0;
    }
    return priority;
}

// Tally items into a plain { key: count } object. keyFn maps each item to its
// grouping key, used for inventory stacks (potions, tomes, tamed animals).
export function countByKey(items, keyFn) {
    const counts = {};
    for (const item of items) {
        const k = keyFn(item);
        counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
}

// The `[▲Threat]` / `[▼Threat]` colored span shown next to expedition party
// members. Returns '' for neutral (0) priority.
export function getThreatDisplayHtml(priority) {
    if (priority === 0) return '';
    const color = priority > 0 ? '#ff6644' : '#66aaff';
    const arrow = priority > 0 ? '▲' : '▼';
    return ` <span style="color:${color};font-size:0.85em;">[${arrow}Threat]</span>`;
}

// Escape a string for safe interpolation into HTML text content. Use on any
// value that can come from a mod, an imported/cloud save, a skin zip or player
// input (names, descriptions, preset labels) before it goes into innerHTML.
export function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape a string for a quoted HTML attribute value. Same rules as escapeHtml;
// kept separate so call sites document which context they target.
export function escapeAttr(str) {
    return escapeHtml(str);
}

// Encode a string as a JS string literal for an inline handler attribute, e.g.
// onclick="fn(${jsArg(name)})". JSON-encodes (handles quotes, backslashes,
// newlines) then HTML-escapes so the result is safe inside a quoted attribute.
export function jsArg(str) {
    return escapeAttr(JSON.stringify(String(str ?? '')));
}

// Escape like escapeHtml, but keep character references (`&#10022;`, `&mdash;`)
// working. For game text that embeds external names (notifications, event
// text) but also uses entities for glyphs. A character reference only ever
// decodes to text, so letting it through can't inject markup.
export function escapeHtmlKeepEntities(str) {
    return escapeHtml(str).replace(/&amp;(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, '&$1;');
}

// Sanitize game text that is meant to carry simple markup (story milestone
// text with portraits and line breaks) but that mods can also supply. Parses
// into an inert <template> (no scripts run, no images load), keeps a small
// allowlist of tags and attributes, and drops event handlers and non-relative
// or non-image URLs. Disallowed elements are unwrapped (their text kept).
const SANITIZE_TAGS = new Set(['B', 'I', 'EM', 'STRONG', 'U', 'SMALL', 'BR', 'P', 'SPAN', 'DIV', 'IMG', 'UL', 'OL', 'LI']);
const SANITIZE_ATTRS = new Set(['class', 'style', 'src', 'alt', 'title']);
const SANITIZE_DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'LINK', 'META']);
const _sanitizeCache = new Map();
export function sanitizeHtml(html) {
    const src = String(html ?? '');
    const cached = _sanitizeCache.get(src);
    if (cached !== undefined) return cached;
    const tpl = document.createElement('template');
    tpl.innerHTML = src;
    const walk = (parent) => {
        for (const node of [...parent.childNodes]) {
            if (node.nodeType === Node.COMMENT_NODE) { node.remove(); continue; }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (SANITIZE_DROP.has(node.tagName)) { node.remove(); continue; }
            walk(node);
            if (!SANITIZE_TAGS.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
            for (const attr of [...node.attributes]) {
                const name = attr.name.toLowerCase();
                const val = attr.value.trim();
                const badUrl = name === 'src' && (/^[a-z][a-z0-9+.-]*:/i.test(val) && !/^data:image\//i.test(val) || val.startsWith('//'));
                // Reject any backslash too: CSS escapes (`u\72l(`) would slip past a url() check.
                const badStyle = name === 'style' && /url|expression|\\/i.test(val);
                if (!SANITIZE_ATTRS.has(name) || badUrl || badStyle) node.removeAttribute(attr.name);
            }
        }
    };
    walk(tpl.content);
    const out = tpl.innerHTML;
    if (_sanitizeCache.size > 500) _sanitizeCache.clear();
    _sanitizeCache.set(src, out);
    return out;
}

// True when the primary pointer is a finger (phones, tablets). Touch-only UI
// (long-press tips, no keyboard hints, bigger tap targets) keys off this, so a
// laptop with a touchscreen but a mouse or trackpad keeps the desktop UI.
export function isTouchUI() {
    return !!globalThis.window?.matchMedia?.('(pointer: coarse)').matches;
}

// True when the narrow tabbed layout is active (phones, or Layout mode: Tabbed).
export function isCompactLayout() {
    return !!(document.getElementById('game-footer')?.classList.contains('tabbed')
        || document.getElementById('game-container')?.classList.contains('tabbed-mode'));
}

// "[F]"-style key hints are noise without a keyboard.
export function keyHint(key) {
    return isTouchUI() ? '' : `[${key}]`;
}

// Panels that sit behind the More button on narrow screens (see COMPACT_NAV_PRIMARY in ui.js).
const MORE_MENU_PANELS = 'Priority|Rifts|Story|Inventory';

// Rewrites mouse-and-keyboard wording for touch screens: drops key hints, and turns
// clicks into taps and right-clicks into long presses. Steps that need more than a
// word swap have their own descriptionTouch.
export function touchText(text) {
    if (!text || !isTouchUI()) return text;
    let t = text
        .replace(/Press \[[^\]]+\] or click ([^,.]+?) in the mode bar/g, 'Tap $1 at the bottom of the screen')
        .replace(/Press \[Space\] or click the 1x button/g, 'Tap the 1x button')
        .replace(/press \[Q\] to draft/g, 'tap Draft on the bottom bar to draft')
        .replace(/\s?\[(?:[A-Z]|Space|Esc|Tab)\]/g, '')
        .replace(/right-click/g, 'long-press')
        .replace(/Right-click/g, 'Long-press')
        .replace(/Click and drag/g, 'Drag')
        .replace(/\bclick(ing)?\b/g, (_, ing) => (ing ? 'tapping' : 'tap'))
        .replace(/\bClick(ing)?\b/g, (_, ing) => (ing ? 'Tapping' : 'Tap'));
    if (isCompactLayout()) t = t.replace(new RegExp(`\\bOpen (${MORE_MENU_PANELS})\\b`, 'g'), 'Open $1 from the More menu');
    return t;
}

// A short buzz on phones (placing, long-press, raids), unless the player turned
// "Vibration feedback" off. `pattern` is ms, or [on, off, on, ...] like navigator.vibrate.
// Uses globalThis so headless sims (scripts/expsim, Node) can call it safely.
export function haptic(pattern) {
    if (globalThis.window?.game?.settings?.haptics === false) return;
    globalThis.navigator?.vibrate?.(pattern);
}

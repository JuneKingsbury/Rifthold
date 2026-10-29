// Shared visual effects for canvas-drawn bars (HP/mana/progress rendered with
// raw ctx.fillRect calls, as opposed to the DOM bars in stat-bar.js).
//
// drawBarFill() lays a pixel-art DITHERED sheen over any flat fill: a crisp
// ordered-dither highlight strip along the top edge and a dither shadow strip
// along the bottom edge, flat color in between. This replaces the older smooth
// top-to-bottom gloss gradient, which read as anti-aliased "glass" and fought
// the game's pixel-art look. The dither pattern is the single source of truth
// shared with the DOM bars: installBarDitherCss() exports the exact same tiles
// as data-URIs into CSS custom properties, so the two bar systems stay
// identical. See css/style.css's shared `::after` rule.
//
// advanceGhost()/drawGhostBar() port the DOM "white ghost recede" effect from
// stat-bar.js to canvas: the colored fill drops to a new (lower) value fast,
// while a white edge lingers at the old value and recedes slowly, telegraphing
// recent damage. See stat-bar.js's file header for the full rationale; the
// decay constants here are identical so the two bar systems feel the same.

import { statBarFactors } from './stat-bar.js';

const EPS = 0.4;
const LEAD_HIDE = 2;

// --- Dithered sheen -------------------------------------------------------
//
// The sheen is two fixed-height strips (so one recipe works at any bar height):
// a bright highlight along the top and a darker shadow along the bottom. Each
// strip is a tiny tile whose cells carry a per-pixel alpha (0 = empty); the
// non-empty cells are the dither dots. Columns are offset row-to-row so the
// result reads as fading dots, not solid stripes. Tune these masks by eye.
const TOP_H = 2; // highlight strip height in px
const BOT_H = 1; // shadow strip height in px

// White highlight: row 0 ~50% coverage, row 1 ~25% offset (a fading top-light).
const TOP_MASK = [
    [0.55, 0, 0.55, 0],
    [0, 0.45, 0, 0],
];
// Black shadow: single row, ~50% coverage.
const BOT_MASK = [
    [0, 0.4, 0, 0.4],
];

let _tiles = null;

/**
 * Build one dither tile canvas from an alpha mask. Each cell > 0 becomes a
 * single pixel of `rgb` at that alpha; cells == 0 stay transparent.
 *
 * @param {number[][]} mask Rows of per-pixel alpha (0 = empty).
 * @param {string} rgb      '255,255,255' (white) or '0,0,0' (black).
 * @returns {HTMLCanvasElement} A (mask-width x mask-height) tile.
 */
function buildTile(mask, rgb) {
    const h = mask.length;
    const w = mask[0].length;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
            const a = mask[yy][xx];
            if (a > 0) {
                g.fillStyle = `rgba(${rgb},${a})`;
                g.fillRect(xx, yy, 1, 1);
            }
        }
    }
    return c;
}

/** Lazily build and cache the two sheen tiles (needs a DOM). */
function getDitherTiles() {
    if (_tiles) return _tiles;
    _tiles = {
        top: buildTile(TOP_MASK, '255,255,255'),
        bottom: buildTile(BOT_MASK, '0,0,0'),
    };
    return _tiles;
}

// CanvasPatterns are bound to the context that made them, so cache them per
// context and per tile. Building a pattern per bar per frame was a steady
// allocation in the overlay hot path.
const _patterns = new WeakMap();

function getPattern(ctx, tile) {
    let byTile = _patterns.get(ctx);
    if (!byTile) { byTile = new Map(); _patterns.set(ctx, byTile); }
    let pat = byTile.get(tile);
    if (pat === undefined) {
        pat = ctx.createPattern(tile, 'repeat');
        byTile.set(tile, pat);
    }
    return pat;
}

/**
 * Paint a dither tile across a rect, tiling horizontally and anchored to the
 * rect's top-left so dots stay on the integer pixel grid. No-op if empty.
 */
function paintStrip(ctx, tile, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const pat = getPattern(ctx, tile);
    if (!pat) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function clampPct(pct) {
    if (!Number.isFinite(pct)) return 0;
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
}

/**
 * Fill a bar rectangle with `color`, then lay a pixel-art dithered sheen over
 * it: a highlight strip along the top edge and a shadow strip along the bottom.
 * Coordinates are snapped to whole pixels so the dither dots stay crisp. No-op
 * (draws nothing) if `w` or `h` is <= 0.
 */
export function drawBarFill(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    const tiles = getDitherTiles();
    // Highlight along the top (clamped on very short bars like the 2px connector).
    paintStrip(ctx, tiles.top, x, y, w, Math.min(TOP_H, h));
    // Shadow along the bottom, only when both strips fit without overlapping.
    if (h >= TOP_H + BOT_H) {
        paintStrip(ctx, tiles.bottom, x, y + h - BOT_H, w, BOT_H);
    }
}

/**
 * Export the dither tiles as data-URIs into CSS custom properties on :root, so
 * the DOM bars' shared `::after` rule renders the exact same sheen as the
 * canvas bars. Safe to call more than once; a no-op outside a DOM.
 */
export function installBarDitherCss() {
    if (typeof document === 'undefined') return;
    const t = getDitherTiles();
    const root = document.documentElement;
    root.style.setProperty('--bar-dither-top', `url(${t.top.toDataURL()})`);
    root.style.setProperty('--bar-dither-bottom', `url(${t.bottom.toDataURL()})`);
}

/**
 * Advance one ghost-recede bar state by one frame toward `target`.
 *
 * @param {?{fill:number, lead:number, max:number}} state Previous state, or
 *   null/undefined on first call for this entity.
 * @param {number} target Live value as a percentage (0-100).
 * @param {number} max    Denominator (maxHp etc.). A change vs. the last seen
 *                         max snaps the bar, same as stat-bar.js.
 * @param {number} dt     Frame delta in ms.
 * @returns {{fill:number, lead:number, max:number}} New state (also mutates
 *   and returns `state` when passed in, so callers may ignore the return and
 *   just read the field back off the entity they stored it on).
 */
export function advanceGhost(state, target, max, dt) {
    const t = clampPct(target);
    const { fillK, leadK } = statBarFactors(dt);
    if (!state || state.max !== max) {
        return { fill: t, lead: t, max };
    }
    if (t >= state.fill) {
        state.fill += (t - state.fill) * fillK;
        if (t - state.fill < EPS) state.fill = t;
        state.lead = Math.max(0, state.fill - LEAD_HIDE);
    } else {
        if (state.lead < state.fill) state.lead = state.fill;
        state.fill += (t - state.fill) * fillK;
        if (state.fill - t < EPS) state.fill = t;
        const rest = Math.max(0, state.fill - LEAD_HIDE);
        state.lead += (rest - state.lead) * leadK;
        if (state.lead - rest < EPS) state.lead = rest;
    }
    return state;
}

/**
 * Draw a full ghost-recede bar: optional background track, white receding
 * ghost, then the colored sheen fill on top, using the live fill/lead values
 * from `state` (as produced by advanceGhost).
 *
 * @param {?string} bgColor Background track color, or null/undefined to skip
 *   painting a background (e.g. when the caller already painted one, such as
 *   boss phase-color bands).
 */
export function drawGhostBar(ctx, x, y, w, h, state, color, bgColor) {
    if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
    }
    if (state.lead > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w * (state.lead / 100), h);
    }
    drawBarFill(ctx, x, y, w * (state.fill / 100), h, color);
}

// Install the shared dither CSS once, as soon as the DOM is ready. This module
// is a singleton, so this runs exactly once however many renderers import it.
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installBarDitherCss, { once: true });
    } else {
        installBarDitherCss();
    }
}

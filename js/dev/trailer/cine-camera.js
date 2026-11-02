// Cinematic camera for trailer takes. Works in world-center coordinates (tiles)
// plus a continuous zoom value in the game's font-size units (5..48, default 14).
//
// While active it replaces Camera.lerpToward on the game instance, so every
// rendered frame gets the director's position instead of the game's own glide.
// Zoom is continuous: the game can only render whole font sizes, so the director
// picks the nearest font at or below the requested zoom and covers the remainder
// with a CSS scale on the canvas, plus a CSS translate that pins the shot center
// to the middle of the game area. That keeps slow push-ins smooth instead of
// stepping (or nudging sideways) each time the font size changes.

import { CONFIG, RENDER_CONFIG } from '../../core/config.js';
import { getEntityRenderPos } from '../../systems/movement-lerp.js';

const MIN_FONT = 5;
const MAX_FONT = 48;

export const EASE = {
    linear: t => t,
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    // Gentle start and stop for long establishing drifts.
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

// Physical cell size for a font, mirroring fitGameFont in main.js.
function cellSizeFor(font) {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(Math.ceil(font * RENDER_CONFIG.fontHeightMult) * dpr) / dpr;
}

export class CineCamera {
    constructor() {
        this.active = false;
        this.game = null;
        this.cx = 0;
        this.cy = 0;
        this.zoom = 14;
        this._tween = null;     // { from, to, start, dur, ease, resolve }
        this._follow = null;    // { target: () => {x,y}|entity, zoom, lag, offset }
        this._shake = null;     // { until, amp }
        this._appliedFont = null;
        this._lastFrame = 0;
        // Current framing on the canvas, for the clip recorder (null when released).
        this.view = null;
    }

    attach(game) {
        this.game = game;
        const cam = game.camera;
        if (cam._directorWrapped) return;
        const orig = cam.lerpToward.bind(cam);
        cam._directorOrigLerp = orig;
        cam.lerpToward = (dt) => {
            if (this.active && this.game === game) this._frame(game);
            else orig(dt);
        };
        cam._directorWrapped = true;
    }

    detach(game) {
        const cam = game?.camera;
        if (cam?._directorWrapped) {
            cam.lerpToward = cam._directorOrigLerp;
            delete cam._directorOrigLerp;
            delete cam._directorWrapped;
        }
        this.release();
    }

    // Take control, starting from wherever the game camera currently is.
    engage() {
        if (this.active || !this.game) return;
        const cam = this.game.camera;
        this.zoom = window.getZoomFont?.() ?? 14;
        this.cx = cam.x + CONFIG.VIEWPORT_WIDTH / 2;
        this.cy = cam.y + CONFIG.VIEWPORT_HEIGHT / 2;
        this._appliedFont = null;
        this.game.followingColonist = null;
        this.active = true;
    }

    // Hand the camera back to the player, keeping the current framing.
    release() {
        if (!this.active) return;
        this.active = false;
        this._cancelTween();
        this._follow = null;
        this._shake = null;
        for (const id of ['game-canvas', 'overlay-canvas']) {
            const c = document.getElementById(id);
            if (c) { c.style.transform = ''; c.style.transformOrigin = ''; }
        }
        this.view = null;
        if (this.game) {
            window.setZoomFont?.(Math.round(this.zoom));
            const cam = this.game.camera;
            cam.x = cam.targetX = this.cx - CONFIG.VIEWPORT_WIDTH / 2;
            cam.y = cam.targetY = this.cy - CONFIG.VIEWPORT_HEIGHT / 2;
            cam.clamp();
        }
    }

    // Current framing, in the same shape cut/move accept. Used for camera marks.
    get shot() {
        return { x: +this.cx.toFixed(1), y: +this.cy.toFixed(1), zoom: +this.zoom.toFixed(1) };
    }

    // Snap to a shot. Missing fields keep their current value.
    cut(shot) {
        this.engage();
        this._cancelTween();
        this._follow = null;
        if (shot.x != null) this.cx = shot.x;
        if (shot.y != null) this.cy = shot.y;
        if (shot.zoom != null) this.zoom = shot.zoom;
    }

    // Glide to a shot over `seconds`. Resolves when the move finishes (or is
    // replaced by another move/cut). Missing fields keep their current value.
    move(shot, seconds = 2, ease = 'inOut') {
        this.engage();
        this._cancelTween();
        this._follow = null;
        const from = { x: this.cx, y: this.cy, zoom: this.zoom };
        const to = { x: shot.x ?? from.x, y: shot.y ?? from.y, zoom: shot.zoom ?? from.zoom };
        return new Promise(resolve => {
            this._tween = {
                from, to, resolve,
                start: performance.now(),
                dur: Math.max(0.001, seconds * 1000),
                ease: typeof ease === 'function' ? ease : (EASE[ease] || EASE.inOut),
            };
        });
    }

    // Relative glide: shift the center by (dx, dy) tiles and scale zoom by `zoomMul`.
    drift(dx, dy, seconds, { zoomMul = 1, ease = 'sine' } = {}) {
        return this.move({ x: this.cx + dx, y: this.cy + dy, zoom: this.zoom * zoomMul }, seconds, ease);
    }

    zoomTo(zoom, seconds = 2, ease = 'inOut') {
        return this.move({ zoom }, seconds, ease);
    }

    // Keep a target in frame. `target` is an entity (colonist/raider/animal), an
    // {x,y} object, or a function returning {x,y}. `lag` is the smoothing time
    // constant in seconds (0 = locked on). `offset` shifts the framing so the
    // subject can sit off-center.
    follow(target, { zoom, lag = 0.6, offset = { x: 0, y: 0 } } = {}) {
        this.engage();
        this._cancelTween();
        this._follow = { target, zoom, lag, offset };
    }

    stopFollow() { this._follow = null; }

    shake(seconds = 0.4, amp = 0.35) {
        this._shake = { until: performance.now() + seconds * 1000, amp };
    }

    _cancelTween() {
        if (this._tween) { const r = this._tween.resolve; this._tween = null; r(); }
    }

    _resolveTarget(t) {
        if (typeof t === 'function') t = t();
        if (!t) return null;
        // Entities glide between tiles; follow the interpolated position, not the tile.
        if (t.id != null) {
            const p = getEntityRenderPos(t, performance.now());
            return { x: p.x, y: p.y };
        }
        return t;
    }

    _frame(game) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - (this._lastFrame || now)) / 1000);
        this._lastFrame = now;

        if (this._tween) {
            const tw = this._tween;
            const p = Math.min(1, (now - tw.start) / tw.dur);
            const e = tw.ease(p);
            this.cx = tw.from.x + (tw.to.x - tw.from.x) * e;
            this.cy = tw.from.y + (tw.to.y - tw.from.y) * e;
            // Zoom interpolates geometrically so a 2x push-in feels even throughout.
            this.zoom = tw.from.zoom * Math.pow(tw.to.zoom / tw.from.zoom, e);
            if (p >= 1) { this._tween = null; tw.resolve(); }
        } else if (this._follow) {
            const f = this._follow;
            const pos = this._resolveTarget(f.target);
            if (pos) {
                const tx = pos.x + 0.5 + (f.offset.x || 0);
                const ty = pos.y + 0.5 + (f.offset.y || 0);
                const k = f.lag > 0 ? 1 - Math.exp(-dt / f.lag) : 1;
                this.cx += (tx - this.cx) * k;
                this.cy += (ty - this.cy) * k;
                if (f.zoom != null) this.zoom += (f.zoom - this.zoom) * k;
            }
        }

        this._applyZoom();

        let sx = 0, sy = 0;
        if (this._shake) {
            if (now > this._shake.until) this._shake = null;
            else {
                sx = (Math.random() * 2 - 1) * this._shake.amp;
                sy = (Math.random() * 2 - 1) * this._shake.amp;
            }
        }

        // Keep the framed view inside the map, so shots near the world's edge
        // never show the void past it.
        const { w, h } = this._areaSize();
        const want = this.zoom * RENDER_CONFIG.fontHeightMult;
        const halfW = w / (2 * want), halfH = h / (2 * want);
        const clampTo = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
        const wx = clampTo(this.cx + sx, halfW, CONFIG.MAP_WIDTH - halfW);
        const wy = clampTo(this.cy + sy, halfH, CONFIG.MAP_HEIGHT - halfH);

        const cam = game.camera;
        cam.x = cam.targetX = wx - CONFIG.VIEWPORT_WIDTH / 2;
        cam.y = cam.targetY = wy - CONFIG.VIEWPORT_HEIGHT / 2;
        cam.clamp();
        this._applyCanvasTransform(cam, wx, wy);
    }

    _areaSize() {
        const area = document.getElementById('game-area');
        return area ? { w: area.clientWidth, h: area.clientHeight } : { w: 1920, h: 1080 };
    }

    // Picks the whole font to render at. Its cell must not exceed the requested
    // zoom's cell (so the remainder is a CSS scale-up, never down), and the
    // viewport it gives, once scaled, must still cover the whole game area.
    // Checking coverage here, not just cell size, is what keeps the framing
    // steady when the font steps: the canvas never comes up short of an edge.
    _applyZoom() {
        this.zoom = Math.max(MIN_FONT, Math.min(MAX_FONT, this.zoom));
        const want = this.zoom * RENDER_CONFIG.fontHeightMult;
        const { w, h } = this._areaSize();
        // Mirrors fitGameFont: viewport tiles = floor((area - 4) / cell).
        const covers = (cell) => Math.floor((w - 4) / cell) * want >= w + want && Math.floor((h - 4) / cell) * want >= h + want;
        let font = Math.min(MAX_FONT, Math.ceil(this.zoom));
        while (font > MIN_FONT && (cellSizeFor(font) > want || !covers(cellSizeFor(font)))) font--;
        if (font !== this._appliedFont) {
            window.setZoomFont?.(font);
            this._appliedFont = font;
        }
    }

    // Positions the canvas so the shot center (wx, wy) sits exactly at the
    // center of the game area, scaled to the requested zoom. Everything is
    // derived from the camera, not from the canvas's size or placement, which
    // shift by up to a tile whenever the font steps.
    _applyCanvasTransform(cam, wx, wy) {
        const canvas = document.getElementById('game-canvas');
        const area = document.getElementById('game-area');
        if (!canvas || !area) return;
        const cell = cellSizeFor(this._appliedFont);
        const scale = Math.max(1, (this.zoom * RENDER_CONFIG.fontHeightMult) / cell);
        // Shot center in canvas CSS pixels.
        const px = (wx - cam.x) * cell;
        const py = (wy - cam.y) * cell;
        let offX = 0, offY = 0;
        for (let el = canvas; el && el !== area; el = el.offsetParent) {
            offX += el.offsetLeft; offY += el.offsetTop;
            if (el.offsetParent === area) break;
        }
        const tx = area.clientWidth / 2 - (offX + px);
        const ty = area.clientHeight / 2 - (offY + py);
        // The effects layer (particles, floating text, flashes) is a separate
        // canvas stacked exactly on the world canvas; it has to move with it.
        // The CRT scanline canvas is screen-space and stays put.
        for (const c of [canvas, document.getElementById('overlay-canvas')]) {
            if (!c) continue;
            c.style.transformOrigin = `${px}px ${py}px`;
            c.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        }
        // For the clip recorder: where the shot center is on the canvas, and how
        // many canvas CSS pixels one game-area pixel covers.
        this.view = { px, py, scale, cell, areaW: area.clientWidth, areaH: area.clientHeight };
    }
}

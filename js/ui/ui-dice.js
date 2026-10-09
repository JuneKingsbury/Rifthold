// CSS 3D dice renderer for the Void Shards mini-game.
// Self-contained: injects its own <style> tag and manages its own rAF loop.
// Exposed as window.VoidDiceRenderer so the arcane panel can instantiate it
// without needing an ES module import (the panel is injected as innerHTML).

const FACE_ROTATIONS = [
    null,                                      // index 0 unused
    'rotateY(0deg)',                            // face 1: front
    'rotateY(180deg)',                          // face 2: back
    'rotateY(-90deg)',                          // face 3: left
    'rotateY(90deg)',                           // face 4: right
    'rotateX(-90deg)',                          // face 5: top
    'rotateX(90deg)',                           // face 6: bottom
];

// Tally mark SVGs for each face value.
// Each SVG is 40x40, strokes drawn at the standard die face size.
// Groups of 4 verticals + 1 diagonal cross = 5. Two groups = 6 uses 3+3.
function _tallyFaceSvg(value) {
    // stroke style is set via CSS class so lock color can override
    const S = 'class="vd-tally-stroke"';
    // single vertical stroke at cx, from y1 to y2
    const v = (cx, y1, y2) => `<line ${S} x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}"/>`;
    // diagonal strike-through across a group
    const d = (x1, y1, x2, y2) => `<line ${S} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

    // A tally group of n (1-5) centred around (gx, gy) in a 40x40 space
    // Each stroke is 14px tall, spaced 5px apart
    function group(n, gx, gy) {
        const sw = 5;   // gap between strokes
        const sh = 14;  // stroke height
        const total = (n <= 4 ? n : 4) * sw;
        const startX = gx - total / 2 + sw / 2;
        let s = '';
        const count = Math.min(n, 4);
        for (let i = 0; i < count; i++) {
            const cx = startX + i * sw;
            s += v(cx, gy - sh / 2, gy + sh / 2);
        }
        if (n === 5) {
            // diagonal across the 4 verticals
            s += d(startX - 3, gy + sh / 2 + 1, startX + 3 * sw + 3, gy - sh / 2 - 1);
        }
        return s;
    }

    let inner = '';
    if (value === 1) {
        inner = group(1, 20, 20);
    } else if (value === 2) {
        inner = group(1, 20, 13) + group(1, 20, 27);
    } else if (value === 3) {
        inner = group(1, 20, 10) + group(1, 20, 20) + group(1, 20, 30);
    } else if (value === 4) {
        inner = group(4, 20, 20);
    } else if (value === 5) {
        inner = group(5, 20, 20);
    } else if (value === 6) {
        // void sigil star instead of tally marks
        return `<span class="vd-sigil-six" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:24px;line-height:1;">&#10022;</span>`;
    }

    return `<svg viewBox="0 0 40 40" width="40" height="40" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);">${inner}</svg>`;
}

const STYLE_ID = 'vd-renderer-styles-4';

function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
        .vd-mat {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            padding: 18px 14px;
            background: radial-gradient(ellipse at 50% 60%, #1e1440 0%, #0e0e1e 80%);
            border: 1px solid #5533aa;
            border-radius: 8px;
            box-shadow: 0 0 18px rgba(120,60,220,0.25) inset;
            perspective: 700px;
            min-height: 100px;
            user-select: none;
        }
        .vd-mat-label {
            position: absolute;
            bottom: 5px;
            right: 10px;
            font-size: 9px;
            color: #5533aa;
            letter-spacing: 1px;
            text-transform: uppercase;
            opacity: 0.6;
        }
        .vd-die-wrap {
            cursor: pointer;
            width: 56px;
            height: 56px;
            perspective: 400px;
            flex-shrink: 0;
        }
        .vd-die {
            position: relative;
            width: 56px;
            height: 56px;
            transform-style: preserve-3d;
            transform: rotateX(0deg) rotateY(0deg);
            transition: transform 0.08s ease-out;
            border-radius: 6px;
        }
        .vd-die-wrap.vd-locked {
            animation: vd-locked-pulse 1.8s ease-in-out infinite;
        }
        @keyframes vd-locked-pulse {
            0%, 100% { filter: drop-shadow(0 0 5px #ffcc00aa); }
            50%       { filter: drop-shadow(0 0 12px #ffcc00ff); }
        }
        .vd-face {
            position: absolute;
            width: 56px;
            height: 56px;
            background: #1a1a2e;
            border: 2px solid #4422aa;
            border-radius: 6px;
            box-sizing: border-box;
            backface-visibility: hidden;
            overflow: hidden;
        }
        .vd-die-wrap.vd-locked .vd-face {
            border-color: #ffcc00;
            background: #1c1810;
        }
        .vd-tally-stroke {
            stroke: #bb88ff;
            stroke-width: 1.5;
            stroke-linecap: round;
        }
        .vd-sigil-six {
            color: #bb88ff;
        }
        .vd-die-wrap.vd-locked .vd-tally-stroke { stroke: #ffffff; }
        .vd-die-wrap.vd-locked .vd-sigil-six    { color: #ffffff; }
        .vd-die-wrap.vd-unrolled .vd-face        { background: #111118; border-color: #2a2a3a; }
        .vd-die-wrap.vd-unrolled .vd-tally-stroke { stroke: #333344; }
        .vd-die-wrap.vd-unrolled .vd-sigil-six   { color: #333344; }
        .vd-combo-pair      { background: #1a1e2e !important; border-color: #4488ff !important; }
        .vd-combo-three     { background: #1a2018 !important; border-color: #44cc66 !important; }
        .vd-combo-four      { background: #221a2e !important; border-color: #aa44ff !important; }
        .vd-combo-five      { background: #2a1a1a !important; border-color: #ff4444 !important; }
        .vd-combo-straight  { background: #1a2225 !important; border-color: #44ddcc !important; }
        .vd-combo-fullhouse { background: #222018 !important; border-color: #ffaa00 !important; }
        .vd-combo-pair      .vd-tally-stroke { stroke: #88aaff; }
        .vd-combo-three     .vd-tally-stroke { stroke: #88ee88; }
        .vd-combo-four      .vd-tally-stroke { stroke: #dd88ff; }
        .vd-combo-five      .vd-tally-stroke { stroke: #ff8888; }
        .vd-combo-straight  .vd-tally-stroke { stroke: #88eedd; }
        .vd-combo-fullhouse .vd-tally-stroke { stroke: #ffcc66; }
        .vd-die-wrap.vd-locked .vd-face        { border-color: #ffcc00 !important; background: #1c1810 !important; }
        .vd-die-wrap.vd-locked .vd-tally-stroke { stroke: #ffffff !important; }
        .vd-lock-badge {
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: #ffcc00;
            letter-spacing: 0.5px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
        }
        .vd-die-wrap.vd-locked .vd-lock-badge {
            opacity: 1;
        }
        .vd-die-wrap.vd-rolling {
            pointer-events: none;
            opacity: 0.7;
        }
        .vd-particle {
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            font-size: 11px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            border-radius: 3px;
            padding: 1px 4px;
            opacity: 1;
            transition: none;
        }
        @keyframes vd-chip-fly {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            80%  { opacity: 1; }
            100% { opacity: 0; }
        }
        @keyframes vd-counter-bump {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.35); }
            100% { transform: scale(1); }
        }
        .vd-counter-bump {
            animation: vd-counter-bump 0.25s ease-out;
        }
    `;
    document.head.appendChild(s);
}

function _buildFaceHtml(value) {
    return _tallyFaceSvg(value);
}

function _buildDieHtml(index) {
    let html = `<div class="vd-die-wrap" data-die="${index}" onclick="window._voidDiceRenderer?.toggleLock(${index})">`;
    html += `<span class="vd-lock-badge">LOCKED</span>`;
    html += `<div class="vd-die" id="vd-die-${index}">`;
    for (let f = 1; f <= 6; f++) {
        const faceTransform = _faceTransform(f);
        html += `<div class="vd-face vd-face-${f}" style="transform:${faceTransform};" id="vd-face-${index}-${f}">`;
        html += _buildFaceHtml(f);
        html += '</div>';
    }
    html += '</div></div>';
    return html;
}

function _faceTransform(face) {
    const half = 28;
    switch (face) {
        case 1: return `translateZ(${half}px)`;
        case 2: return `rotateY(180deg) translateZ(${half}px)`;
        case 3: return `rotateY(90deg) translateZ(${half}px)`;
        case 4: return `rotateY(-90deg) translateZ(${half}px)`;
        case 5: return `rotateX(-90deg) translateZ(${half}px)`;
        case 6: return `rotateX(90deg) translateZ(${half}px)`;
    }
    return '';
}

// Returns the rotateX and rotateY angles that put the given face number facing forward.
function _faceToAngles(face) {
    switch (face) {
        case 1: return { rx: 0, ry: 0 };
        case 2: return { rx: 0, ry: 180 };
        case 3: return { rx: 0, ry: -90 };
        case 4: return { rx: 0, ry: 90 };
        case 5: return { rx: 90, ry: 0 };
        case 6: return { rx: -90, ry: 0 };
    }
    return { rx: 0, ry: 0 };
}

function _easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

class VoidDiceRenderer {
    constructor() {
        this._container = null;
        this._locked = [false, false, false, false, false];
        this._faceValues = [1, 1, 1, 1, 1];
        this._rolling = false;
        this._anims = []; // per-die animation state
        this._rafId = null;
        this._onComplete = null;
        this._numDice = 5;
    }

    init(containerEl, numDice) {
        _injectStyles();
        this._container = containerEl;
        this._numDice = numDice || 5;
        let html = '<div class="vd-mat" id="vd-mat">';
        for (let i = 0; i < this._numDice; i++) {
            html += _buildDieHtml(i);
        }
        html += '<span class="vd-mat-label">Void Shards</span>';
        html += '</div>';
        containerEl.innerHTML = html;
        containerEl.setAttribute('data-renderer-attached', '1');
        this._applyLockStyles();
    }

    isAttached() {
        return !!(this._container && this._container.isConnected && this._container.querySelector('#vd-mat'));
    }

    getFaceValues() {
        return [...this._faceValues];
    }

    setLocked(index, locked) {
        if (index < 0 || index >= this._numDice) return;
        this._locked[index] = locked;
        this._applyLockStyles();
    }

    toggleLock(index) {
        if (this._rolling) return;
        if (!window.game) return;
        window.game.voidShardsToggleLock(index);
    }

    // Called by game logic to update lock display from canonical state
    syncLocked(lockedArr) {
        for (let i = 0; i < this._numDice; i++) {
            this._locked[i] = lockedArr[i] || false;
        }
        this._applyLockStyles();
    }

    // Given current face values, compute which die indices are part of the best
    // combo and what class to apply. Returns {indices: Set, cls: string}.
    _computeCombo(faceValues) {
        const counts = {};
        for (let i = 0; i < faceValues.length; i++) {
            const v = faceValues[i];
            if (!counts[v]) counts[v] = [];
            counts[v].push(i);
        }
        const groups = Object.values(counts).sort((a, b) => b.length - a.length);

        // Five of a kind
        if (groups[0].length === 5) {
            return { indices: new Set(groups[0]), cls: 'vd-combo-five' };
        }
        // Straight
        const sorted = [...faceValues].sort((a, b) => a - b);
        if (sorted.join(',') === '1,2,3,4,5' || sorted.join(',') === '2,3,4,5,6') {
            return { indices: new Set([0, 1, 2, 3, 4]), cls: 'vd-combo-straight' };
        }
        // Four of a kind
        if (groups[0].length === 4) {
            return { indices: new Set(groups[0]), cls: 'vd-combo-four' };
        }
        // Full house
        if (groups[0].length === 3 && groups[1] && groups[1].length === 2) {
            return { indices: new Set([...groups[0], ...groups[1]]), cls: 'vd-combo-fullhouse' };
        }
        // Three of a kind
        if (groups[0].length === 3) {
            return { indices: new Set(groups[0]), cls: 'vd-combo-three' };
        }
        // Two pair: highlight both pairs
        if (groups[0].length === 2 && groups[1] && groups[1].length === 2) {
            return { indices: new Set([...groups[0], ...groups[1]]), cls: 'vd-combo-pair' };
        }
        // One pair
        if (groups[0].length === 2) {
            return { indices: new Set(groups[0]), cls: 'vd-combo-pair' };
        }
        return { indices: new Set(), cls: '' };
    }

    syncUnrolled(rolledFlags) {
        // rolledFlags: array of booleans, true = has been rolled (show normal), false = unrolled (gray)
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const wrap = this._container.querySelector(`[data-die="${i}"]`);
            if (!wrap) continue;
            if (!rolledFlags[i]) {
                wrap.classList.add('vd-unrolled');
            } else {
                wrap.classList.remove('vd-unrolled');
            }
        }
    }

    syncCombo(faceValues) {
        if (!this._container) return;
        const { indices, cls } = this._computeCombo(faceValues);
        const allComboClasses = ['vd-combo-pair', 'vd-combo-three', 'vd-combo-four', 'vd-combo-five', 'vd-combo-straight', 'vd-combo-fullhouse'];
        for (let i = 0; i < this._numDice; i++) {
            // Apply the class to the front face (face-1) which is always visible when static
            for (let f = 1; f <= 6; f++) {
                const faceEl = this._container.querySelector(`#vd-face-${i}-${f}`);
                if (!faceEl) continue;
                faceEl.classList.remove(...allComboClasses);
                if (indices.has(i) && cls) faceEl.classList.add(cls);
            }
        }
    }

    _applyLockStyles() {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const wrap = this._container.querySelector(`[data-die="${i}"]`);
            if (!wrap) continue;
            if (this._locked[i]) {
                wrap.classList.add('vd-locked');
            } else {
                wrap.classList.remove('vd-locked');
            }
        }
    }

    // Snap all dice to their face values with no animation (used on remount).
    showStatic(faceValues, lockedArr) {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            this._faceValues[i] = faceValues[i] || 1;
            this._locked[i] = lockedArr[i] || false;
            const { rx, ry } = _faceToAngles(faceValues[i] || 1);
            const dieEl = this._container.querySelector(`#vd-die-${i}`);
            if (dieEl) dieEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        }
        this._applyLockStyles();
        this.syncUnrolled(faceValues.map(v => v > 0));
        this.syncCombo(faceValues.map(v => v > 0 ? v : 1));
    }

    // Roll the unlocked dice to the given target face values.
    // targetValues: array of length numDice, face value 1-6 for each die
    // locked: array of booleans
    // onComplete: called when animation finishes
    roll(targetValues, lockedArr, onComplete) {
        this._onComplete = onComplete || null;
        this._rolling = true;
        this._anims = [];

        for (let i = 0; i < this._numDice; i++) {
            this._locked[i] = lockedArr[i] || false;
            if (lockedArr[i]) {
                // Keep locked dice where they are, no animation
                this._anims.push(null);
                continue;
            }
            const target = targetValues[i] || 1;
            this._faceValues[i] = target;
            const { rx: targetRx, ry: targetRy } = _faceToAngles(target);
            // Add several full rotations to the tumble for visual effect
            const extraX = (Math.random() > 0.5 ? 1 : -1) * (360 * (2 + Math.floor(Math.random() * 2)));
            const extraY = (Math.random() > 0.5 ? 1 : -1) * (360 * (2 + Math.floor(Math.random() * 2)));
            const startRx = 0;
            const startRy = 0;
            const endRx = targetRx + extraX;
            const endRy = targetRy + extraY;
            const duration = 500 + i * 60 + Math.random() * 120;
            this._anims.push({ i, startRx, startRy, endRx, endRy, duration, startTime: null });
        }

        this._applyLockStyles();
        for (let i = 0; i < this._numDice; i++) {
            const wrap = this._container && this._container.querySelector(`[data-die="${i}"]`);
            if (wrap && !lockedArr[i]) wrap.classList.add('vd-rolling');
        }

        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(ts => this._animFrame(ts));
    }

    _animFrame(ts) {
        let allDone = true;
        for (const anim of this._anims) {
            if (!anim) continue;
            if (anim.startTime === null) anim.startTime = ts;
            const elapsed = ts - anim.startTime;
            const t = Math.min(elapsed / anim.duration, 1);
            const eased = _easeOut(t);
            const rx = anim.startRx + (anim.endRx - anim.startRx) * eased;
            const ry = anim.startRy + (anim.endRy - anim.startRy) * eased;
            const dieEl = this._container && this._container.querySelector(`#vd-die-${anim.i}`);
            if (dieEl) {
                dieEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
            }
            if (t < 1) allDone = false;
        }

        if (!allDone) {
            this._rafId = requestAnimationFrame(ts2 => this._animFrame(ts2));
        } else {
            this._rolling = false;
            for (let i = 0; i < this._numDice; i++) {
                const wrap = this._container && this._container.querySelector(`[data-die="${i}"]`);
                if (wrap) wrap.classList.remove('vd-rolling');
            }
            this._applyLockStyles();
            if (this._onComplete) this._onComplete();
        }
    }

    destroy() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
        this._container = null;
    }
}

// Expose globally so the arcane panel (injected innerHTML) can access it.
window.VoidDiceRenderer = VoidDiceRenderer;

// Particle + counter animation fired when the player scores.
// chips: number, mult: number, fd: number
// The particles fly from the dice mat toward the score display.
window.voidShardsScoreAnim = function(chips, mult, fd) {
    const matEl = document.getElementById('vd-mat');
    const chipsEl = document.getElementById('vd-chips-val');
    const multEl = document.getElementById('vd-mult-val');
    const fdEl = document.getElementById('vd-fd-val');
    if (!matEl || !chipsEl || !fdEl) return;

    const matRect = matEl.getBoundingClientRect();
    const chipsRect = chipsEl.getBoundingClientRect();
    const multRect = multEl ? multEl.getBoundingClientRect() : chipsRect;
    const fdRect = fdEl.getBoundingClientRect();

    // Chip particles (blue, fly toward chips counter)
    const chipCount = Math.min(chips, 12);
    for (let i = 0; i < chipCount; i++) {
        _spawnParticle(
            matRect.left + Math.random() * matRect.width,
            matRect.top + Math.random() * matRect.height,
            chipsRect.left + chipsRect.width / 2,
            chipsRect.top + chipsRect.height / 2,
            '#88aaff', '+' + Math.ceil(chips / chipCount),
            i * 40
        );
    }

    // Mult particles (purple, fly toward mult counter)
    if (mult > 1) {
        const multCount = Math.min(mult, 6);
        for (let i = 0; i < multCount; i++) {
            _spawnParticle(
                matRect.left + Math.random() * matRect.width,
                matRect.top + Math.random() * matRect.height,
                multRect.left + multRect.width / 2,
                multRect.top + multRect.height / 2,
                '#dd88ff', 'x' + mult,
                chipCount * 40 + i * 50
            );
        }
    }

    // After particles land, count up the fd display
    const delay = (chipCount * 40) + (mult > 1 ? (Math.min(mult, 6) * 50) : 0) + 80;
    setTimeout(() => {
        _countUp(fdEl, 0, fd, 600);
        if (chipsEl) _bump(chipsEl);
        if (multEl) _bump(multEl);
    }, delay);
};

function _spawnParticle(x0, y0, x1, y1, color, label, delayMs) {
    setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'vd-particle';
        el.textContent = label;
        el.style.color = color;
        el.style.border = `1px solid ${color}`;
        el.style.background = '#0e0e1e';
        el.style.left = x0 + 'px';
        el.style.top = y0 + 'px';
        document.body.appendChild(el);

        const dx = x1 - x0;
        const dy = y1 - y0;
        const duration = 500;
        const start = performance.now();

        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 2);
            el.style.left = (x0 + dx * ease) + 'px';
            el.style.top  = (y0 + dy * ease) + 'px';
            el.style.opacity = t < 0.8 ? '1' : String(1 - (t - 0.8) / 0.2);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                el.remove();
            }
        }
        requestAnimationFrame(step);
    }, delayMs);
}

function _countUp(el, from, to, duration) {
    const start = performance.now();
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const val = Math.round(from + (to - from) * ease);
        el.textContent = val + ' Fd';
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function _bump(el) {
    el.classList.remove('vd-counter-bump');
    void el.offsetWidth;
    el.classList.add('vd-counter-bump');
    setTimeout(() => el.classList.remove('vd-counter-bump'), 300);
}

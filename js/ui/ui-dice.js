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

// Digit face renderer: plain readable characters instead of tally marks.
// 'W' faces (Wildcard Die reforge) render as a star glyph in an accent color.
function _digitFaceHtml(value) {
    const isWild = value === 'W';
    const label = isWild ? '&#9733;' : String(value);
    const cls = isWild ? 'vd-face-digit vd-face-wild' : 'vd-face-digit';
    return `<span class="${cls}">${label}</span>`;
}

const STYLE_ID = 'vd-renderer-styles-5';

function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
        .vd-mat {
            position: relative;
            display: flex;
            flex-wrap: wrap;
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
        /* 6-7 dice (Overflow Core relic): shrink a size step so a crowded
           mat still reads cleanly instead of overflowing. */
        .vd-mat-wide {
            gap: 8px;
        }
        .vd-mat-wide .vd-die-wrap {
            width: 46px;
            height: 46px;
        }
        .vd-mat-wide .vd-die {
            width: 46px;
            height: 46px;
        }
        .vd-mat-wide .vd-face {
            width: 46px;
            height: 46px;
        }
        .vd-mat-wide .vd-face-digit {
            font-size: 20px;
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
            /* !important: locked and reforged are equal-specificity selectors that
               both animate filter. The functional "locked" cue must win over the
               cosmetic reforge shimmer when a die is both. */
            animation: vd-locked-pulse 1.8s ease-in-out infinite !important;
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
            /* Center the digit via flex, not left:50%/transform:translate(-50%,-50%).
               That combination, nested inside this face's own 3D transform
               (translateZ + rotate, set inline per face), compounds into a
               non-integer final pixel position almost every time, which the
               compositor then anti-aliases, reading as blurry text next to
               the crisp (nearest-neighbor) sprite art. Flex layout lands on
               a clean pixel grid instead. */
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .vd-die-wrap.vd-locked .vd-face {
            border-color: #ffcc00;
            background: #1c1810;
        }
        .vd-face-digit {
            font-size: 26px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            color: #bb88ff;
            line-height: 1;
            -webkit-font-smoothing: antialiased;
        }
        .vd-face-wild {
            color: #ffcc33;
        }
        .vd-die-wrap.vd-locked .vd-face-digit { color: #ffffff; }
        .vd-die-wrap.vd-unrolled .vd-face        { background: #111118; border-color: #2a2a3a; }
        .vd-die-wrap.vd-unrolled .vd-face-digit { color: #333344; }
        .vd-combo-pair      { background: #1a1e2e !important; border-color: #4488ff !important; }
        .vd-combo-three     { background: #1a2018 !important; border-color: #44cc66 !important; }
        .vd-combo-four      { background: #221a2e !important; border-color: #aa44ff !important; }
        .vd-combo-five      { background: #2a1a1a !important; border-color: #ff4444 !important; }
        .vd-combo-straight  { background: #1a2225 !important; border-color: #44ddcc !important; }
        .vd-combo-fullhouse { background: #222018 !important; border-color: #ffaa00 !important; }
        .vd-combo-pair      .vd-face-digit { color: #88aaff; }
        .vd-combo-three     .vd-face-digit { color: #88ee88; }
        .vd-combo-four      .vd-face-digit { color: #dd88ff; }
        .vd-combo-five      .vd-face-digit { color: #ff8888; }
        .vd-combo-straight  .vd-face-digit { color: #88eedd; }
        .vd-combo-fullhouse .vd-face-digit { color: #ffcc66; }
        .vd-die-wrap.vd-locked .vd-face        { border-color: #ffcc00 !important; background: #1c1810 !important; }
        .vd-die-wrap.vd-locked .vd-face-digit { color: #ffffff !important; }
        .vd-face-cursed::before {
            content: '';
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(45deg, transparent 0 4px, #ff3333aa 4px 6px);
            pointer-events: none;
        }
        .vd-face-fogged .vd-face-digit {
            opacity: 0;
        }
        .vd-face-fogged::after {
            content: '?';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 26px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            color: #8866aa;
            pointer-events: none;
        }
        .vd-die-wrap.vd-forced-lock .vd-face { border-color: #ff6644 !important; }
        .vd-die-wrap.vd-forced-lock .vd-lock-badge { color: #ff6644; }
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
        @keyframes vd-counter-bump-big {
            0%   { transform: scale(1) rotate(0deg); }
            35%  { transform: scale(1.6) rotate(-3deg); }
            65%  { transform: scale(1.3) rotate(3deg); }
            100% { transform: scale(1) rotate(0deg); }
        }
        .vd-counter-bump-big {
            animation: vd-counter-bump-big 0.4s ease-out;
        }
        @keyframes vd-combo-pulse-ring {
            0%   { filter: drop-shadow(0 0 2px rgba(255,255,255,0)); }
            30%  { filter: drop-shadow(0 0 14px rgba(255,255,255,0.8)); }
            100% { filter: drop-shadow(0 0 2px rgba(255,255,255,0)); }
        }
        .vd-die-wrap.vd-combo-pulse {
            /* !important: see the note on .vd-locked above. This one-shot
               pulse must briefly win over the ambient locked/reforge glow. */
            animation: vd-combo-pulse-ring 0.5s ease-out !important;
        }
        @keyframes vd-reforge-shimmer {
            0%, 100% { filter: drop-shadow(0 0 2px var(--reforge-color, #44ddee)); }
            50%      { filter: drop-shadow(0 0 8px var(--reforge-color, #44ddee)); }
        }
        .vd-die-wrap.vd-reforged {
            animation: vd-reforge-shimmer 2.4s ease-in-out infinite;
        }
        @keyframes vd-lock-snap-bounce {
            0%   { transform: scale(1); }
            45%  { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        .vd-die-wrap.vd-lock-snap {
            /* !important: a brief one-shot, must win over the ambient
               cursed-tremor shake (same transform property) if both apply. */
            animation: vd-lock-snap-bounce 0.3s ease-out !important;
        }
        @keyframes vd-unlock-shake {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            25% { transform: translateX(-4px) rotate(-3deg); }
            75% { transform: translateX(4px) rotate(3deg); }
        }
        .vd-die-wrap.vd-unlock-break {
            /* !important: same reasoning as .vd-lock-snap above. */
            animation: vd-unlock-shake 0.3s ease-out !important;
        }
        @keyframes vd-cursed-shake {
            0%, 100% { transform: translate(0,0); }
            20% { transform: translate(-1.5px, 1px); }
            40% { transform: translate(1.5px, -1px); }
            60% { transform: translate(-1px, -1.5px); }
            80% { transform: translate(1px, 1.5px); }
        }
        .vd-die-wrap.vd-cursed-tremor {
            animation: vd-cursed-shake 0.4s ease-in-out infinite;
        }
        .vd-poof-dot {
            position: fixed;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            pointer-events: none;
            z-index: 9998;
        }
        .vd-score-flash {
            position: fixed;
            pointer-events: none;
            z-index: 9990;
            border-radius: 8px;
            animation: vd-score-flash-fade 0.45s ease-out forwards;
        }
        @keyframes vd-score-flash-fade {
            0%   { opacity: 0.45; }
            100% { opacity: 0; }
        }
        .vd-combo-banner {
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 15px;
            letter-spacing: 1px;
            white-space: nowrap;
            animation: vd-combo-banner-punch 0.9s cubic-bezier(.2,1.4,.4,1) forwards;
        }
        @keyframes vd-combo-banner-punch {
            0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
            15%  { transform: translate(-50%, -50%) scale(1.25); opacity: 1; }
            30%  { transform: translate(-50%, -60%) scale(1.0); opacity: 1; }
            80%  { transform: translate(-50%, -70%) scale(1.0); opacity: 1; }
            100% { transform: translate(-50%, -85%) scale(0.9); opacity: 0; }
        }
        .vd-confetti-shard {
            position: fixed;
            width: 6px;
            height: 10px;
            pointer-events: none;
            z-index: 9997;
            border-radius: 1px;
        }
        .vd-loss-pulse {
            position: fixed;
            pointer-events: none;
            z-index: 9990;
            background: #000000;
            border-radius: 8px;
            animation: vd-loss-pulse-fade 0.7s ease-out forwards;
        }
        @keyframes vd-loss-pulse-fade {
            0%   { opacity: 0.4; }
            100% { opacity: 0; }
        }
        .vd-boss-slam {
            animation: vd-boss-slam-in 0.45s cubic-bezier(.2,1.6,.4,1);
        }
        @keyframes vd-boss-slam-in {
            0%   { transform: scale(1.4) translateY(-14px); opacity: 0; }
            60%  { transform: scale(0.96) translateY(2px); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        /* One fail away from ending the run, keep pulsing until it clears. */
        .vd-fail-warn {
            animation: vd-fail-warn-pulse 1.1s ease-in-out infinite;
        }
        @keyframes vd-fail-warn-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.55; }
        }
        /* Reusable "what does this do" tooltip: data-vd-tooltip="text" on any
           element shows a small styled box near it on hover. JS-positioned
           (see _attachAttrTooltipDelegate) rather than a pure-CSS ::after,
           so it can be clamped to stay inside the viewport instead of
           getting cut off at the panel's edges. */
        .vd-attr-tooltip {
            position: fixed;
            background: #1a0e2a;
            border: 1px solid #6644aa;
            color: #ddccff;
            font-size: 10px;
            font-weight: normal;
            line-height: 1.4;
            padding: 6px 8px;
            border-radius: 4px;
            white-space: normal;
            width: max-content;
            max-width: 200px;
            z-index: 10000;
            pointer-events: none;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        /* Die face popover: hover a die to see all 6 faces and roll odds.
           Also JS-clamped to the viewport, see _positionFloatingTooltip. */
        .vd-die-tooltip {
            position: fixed;
            background: #1a0e2a;
            border: 1px solid #6644aa;
            border-radius: 6px;
            padding: 8px 10px;
            z-index: 10001;
            pointer-events: none;
            display: none;
            font-size: 10px;
            color: #ddccff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .vd-die-tooltip-faces {
            display: flex;
            gap: 3px;
            margin-bottom: 6px;
        }
        .vd-die-tooltip-face {
            width: 16px;
            height: 16px;
            background: #2a1a4a;
            border: 1px solid #5533aa;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-family: 'Courier New', monospace;
        }
        .vd-die-tooltip-odds {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .vd-die-tooltip-odds > div {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
    `;
    document.head.appendChild(s);
}

// Picks a flavor color for a reforged die's ambient shimmer, based on the
// shape of its face set (wild/singular/low/high/even/odd/mixed).
function _reforgeColorFor(faces) {
    if (!faces) return '#44ddee';
    if (faces.includes('W')) return '#ffcc33';
    if (new Set(faces).size === 1) return '#ff5566';
    const avg = faces.reduce((a, b) => a + b, 0) / faces.length;
    if (avg <= 2.5) return '#55ddaa';
    if (avg >= 4.5) return '#ff9944';
    if (faces.every(v => v % 2 === 0)) return '#55aaff';
    if (faces.every(v => v % 2 === 1)) return '#ff66cc';
    return '#44ddee';
}
window.voidShardsReforgeColor = _reforgeColorFor;

function _buildFaceHtml(value) {
    return _digitFaceHtml(value);
}

function _buildDieHtml(index, half) {
    let html = `<div class="vd-die-wrap" data-die="${index}" onclick="window._voidDiceRenderer?.toggleLock(${index})" onmouseenter="window._voidDiceRenderer?.showDieTooltip(${index}, event)" onmouseleave="window._voidDiceRenderer?.hideDieTooltip()">`;
    html += `<span class="vd-lock-badge">LOCKED</span>`;
    html += `<div class="vd-die" id="vd-die-${index}">`;
    for (let f = 1; f <= 6; f++) {
        const faceTransform = _faceTransform(f, half);
        html += `<div class="vd-face vd-face-${f}" style="transform:${faceTransform};" id="vd-face-${index}-${f}">`;
        html += _buildFaceHtml(f);
        html += '</div>';
    }
    html += '</div></div>';
    return html;
}

// half is the die's half-width in px (28 for the standard 56px die, 23 for
// the shrunk 46px .vd-mat-wide variant), it must match the CSS size exactly
// or the cube's faces visibly gap/overlap instead of forming a sealed box.
function _faceTransform(face, half) {
    half = half || 28;
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
        this._rolling = false;
        this._anims = []; // per-die animation state
        this._rafId = null;
        this._onComplete = null;
        this._numDice = 5;
        this._cursedFace = null;
        this._fogged = false;
        this._forcedLockIndex = -1;
        this._lastFaceSetsFingerprint = null;
        this._prevComboIndices = null;
        // Per-die arrays are rebuilt in init() to the actual die count, since
        // a Relic can change it between runs/mounts (never mid-round, see
        // _voidShardsResizeDice in main.js). Default-sized here only so the
        // instance isn't holding undefined arrays before init() ever runs.
        this._locked = [];
        this._faceValues = [];
        this._faceSets = [];
        this._prevLocked = [];
    }

    // Briefly adds `cls` to `el` then removes it, restarting the animation
    // even if it's already mid-play (classList add/remove forces a reflow).
    _playOneShot(el, cls, durationMs) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), durationMs);
    }

    // Resolve a target displayed value to a physical face position (1-6) to
    // rotate to. Standard dice have faceSet[i] === i+1, so this is a no-op
    // identity lookup for them. Custom face sets may have the same value on
    // multiple physical faces (visually identical), any match is fine.
    _physicalIndexForValue(dieIndex, value) {
        const faces = this._faceSets[dieIndex] || [1, 2, 3, 4, 5, 6];
        const matches = [];
        for (let f = 0; f < 6; f++) if (faces[f] === value) matches.push(f + 1);
        if (matches.length === 0) return 1;
        return matches[Math.floor(Math.random() * matches.length)];
    }

    // Rebuild every die's 6 physical faces to show a new face set's values,
    // and re-apply any active cursed-face marking. Standard dice (all five
    // default [1,2,3,4,5,6]) are a no-op visually. Called every render tick
    // while mounted (not just on an actual reforge), so skip the DOM rewrite
    // when the content hasn't actually changed since last time.
    setFaceSets(faceSetsArr) {
        const fingerprint = JSON.stringify(faceSetsArr || null);
        if (fingerprint === this._lastFaceSetsFingerprint) return;
        this._lastFaceSetsFingerprint = fingerprint;
        for (let i = 0; i < this._numDice; i++) {
            this._faceSets[i] = (faceSetsArr && faceSetsArr[i]) || [1, 2, 3, 4, 5, 6];
            for (let f = 1; f <= 6; f++) {
                const faceEl = this._container && this._container.querySelector(`#vd-face-${i}-${f}`);
                if (faceEl) faceEl.innerHTML = _digitFaceHtml(this._faceSets[i][f - 1]);
            }
            const isStandard = this._faceSets[i].every((v, idx) => v === idx + 1);
            const wrap = this._container && this._container.querySelector(`[data-die="${i}"]`);
            if (wrap) {
                wrap.classList.toggle('vd-reforged', !isStandard);
                if (!isStandard) wrap.style.setProperty('--reforge-color', _reforgeColorFor(this._faceSets[i]));
            }
        }
        this._applyCursedMarks();
    }

    // Mark every physical face (on every die) currently showing faceValue
    // with the boss "Cursed Face" overlay. Pass null to clear.
    markCursedFace(faceValue) {
        this._cursedFace = (faceValue === undefined) ? null : faceValue;
        this._applyCursedMarks();
    }

    _applyCursedMarks() {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            for (let f = 1; f <= 6; f++) {
                const faceEl = this._container.querySelector(`#vd-face-${i}-${f}`);
                if (!faceEl) continue;
                const isCursed = this._cursedFace != null && this._faceSets[i] && this._faceSets[i][f - 1] === this._cursedFace;
                faceEl.classList.toggle('vd-face-cursed', !!isCursed);
            }
            // Tremor only while the die's currently-displayed face is the cursed one.
            const wrap = this._container.querySelector(`[data-die="${i}"]`);
            if (wrap) {
                const frontIsCursed = this._cursedFace != null && this._faceValues[i] === this._cursedFace;
                wrap.classList.toggle('vd-cursed-tremor', !!frontIsCursed);
            }
        }
    }

    // Visually distinguish the one die a boss "Static One" effect pre-locked
    // this round from normal player-toggled locks. Pass -1 to clear.
    markForcedLock(index) {
        this._forcedLockIndex = (index === undefined) ? -1 : index;
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const wrap = this._container.querySelector(`[data-die="${i}"]`);
            if (!wrap) continue;
            const isForced = i === this._forcedLockIndex;
            wrap.classList.toggle('vd-forced-lock', isForced);
            const badge = wrap.querySelector('.vd-lock-badge');
            if (badge) badge.textContent = isForced ? '☠ BOSS-LOCKED' : 'LOCKED';
        }
    }

    // Boss "The Fog": unlocked dice show a ? overlay instead of their real
    // value (the underlying digit content is untouched, scoring is
    // unaffected, this is purely a display mask) until locked.
    markFogged(active) {
        this._fogged = !!active;
        this._applyFogMarks();
    }

    _applyFogMarks() {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const isFoggedDie = this._fogged && !this._locked[i];
            for (let f = 1; f <= 6; f++) {
                const faceEl = this._container.querySelector(`#vd-face-${i}-${f}`);
                if (faceEl) faceEl.classList.toggle('vd-face-fogged', isFoggedDie);
            }
        }
    }

    // Shows a popover with this die's actual 6 faces and roll odds, "what
    // all the sides look like" as a flattened fold-out plus a probability
    // list, since a reforged die no longer has a uniform 1-in-6 spread.
    showDieTooltip(index, evt) {
        const faces = this._faceSets[index] || [1, 2, 3, 4, 5, 6];
        const el = _getSharedDieTooltipEl();
        const counts = {};
        for (const f of faces) counts[f] = (counts[f] || 0) + 1;
        let html = '<div class="vd-die-tooltip-faces">';
        for (const f of faces) html += `<span class="vd-die-tooltip-face">${f === 'W' ? '&#9733;' : f}</span>`;
        html += '</div><div class="vd-die-tooltip-odds">';
        const keys = Object.keys(counts).sort((a, b) => {
            if (a === 'W') return 1;
            if (b === 'W') return -1;
            return Number(a) - Number(b);
        });
        for (const k of keys) {
            const pct = Math.round(counts[k] / 6 * 100);
            html += `<div><span>${k === 'W' ? 'Wild' : k}</span><span>${pct}%</span></div>`;
        }
        html += '</div>';
        el.innerHTML = html;
        el.style.display = 'block';
        const wrap = evt && evt.currentTarget ? evt.currentTarget : (this._container && this._container.querySelector(`[data-die="${index}"]`));
        if (wrap) _positionFloatingTooltip(el, wrap.getBoundingClientRect());
    }

    hideDieTooltip() {
        if (_sharedDieTooltipEl) _sharedDieTooltipEl.style.display = 'none';
    }

    init(containerEl, numDice) {
        _injectStyles();
        this._container = containerEl;
        this._numDice = numDice || 5;
        this._locked = new Array(this._numDice).fill(false);
        this._faceValues = new Array(this._numDice).fill(1);
        this._faceSets = new Array(this._numDice).fill(null).map(() => [1, 2, 3, 4, 5, 6]);
        this._prevLocked = new Array(this._numDice).fill(false);
        const isWide = this._numDice > 5;
        const half = isWide ? 23 : 28;
        let html = `<div class="vd-mat${isWide ? ' vd-mat-wide' : ''}" id="vd-mat">`;
        for (let i = 0; i < this._numDice; i++) {
            html += _buildDieHtml(i, half);
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
            const inComboNow = !!(cls && indices.has(i));
            const wasInCombo = !!(this._prevComboIndices && this._prevComboIndices.has(i));
            // Apply the class to the front face (face-1) which is always visible when static
            for (let f = 1; f <= 6; f++) {
                const faceEl = this._container.querySelector(`#vd-face-${i}-${f}`);
                if (!faceEl) continue;
                faceEl.classList.remove(...allComboClasses);
                if (inComboNow) faceEl.classList.add(cls);
            }
            if (inComboNow && !wasInCombo) {
                const wrap = this._container.querySelector(`[data-die="${i}"]`);
                if (wrap) this._playOneShot(wrap, 'vd-combo-pulse', 500);
            }
        }
        this._prevComboIndices = indices;
    }

    _applyLockStyles() {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const wrap = this._container.querySelector(`[data-die="${i}"]`);
            if (!wrap) continue;
            const wasLocked = this._prevLocked[i];
            const isLocked = this._locked[i];
            if (isLocked) {
                wrap.classList.add('vd-locked');
            } else {
                wrap.classList.remove('vd-locked');
            }
            if (isLocked && !wasLocked) {
                this._playOneShot(wrap, 'vd-lock-snap', 320);
            } else if (!isLocked && wasLocked) {
                this._playOneShot(wrap, 'vd-unlock-break', 320);
            }
            this._prevLocked[i] = isLocked;
        }
        this._applyFogMarks();
    }

    // Snap all dice to their face values with no animation (used on remount).
    showStatic(faceValues, lockedArr) {
        if (!this._container) return;
        for (let i = 0; i < this._numDice; i++) {
            const val = faceValues[i] || 1;
            this._faceValues[i] = val;
            this._locked[i] = lockedArr[i] || false;
            const physIdx = this._physicalIndexForValue(i, val);
            const { rx, ry } = _faceToAngles(physIdx);
            const dieEl = this._container.querySelector(`#vd-die-${i}`);
            if (dieEl) dieEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        }
        this._applyLockStyles();
        this.syncUnrolled(faceValues.map(v => v !== 0));
        this.syncCombo(faceValues.map(v => v === 0 ? 1 : v));
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
            const physIdx = this._physicalIndexForValue(i, target);
            const { rx: targetRx, ry: targetRy } = _faceToAngles(physIdx);
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
            for (const anim of this._anims) {
                if (!anim) continue;
                const wrap = this._container && this._container.querySelector(`[data-die="${anim.i}"]`);
                if (wrap) _spawnLandPuff(wrap);
            }
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

// Inject styles eagerly (not just on first renderer mount) so one-shot
// visual effects that can fire before any dice mat exists (e.g. the boss
// banner's entrance animation) always have their keyframes available.
_injectStyles();

// Delegated hover handling for every data-vd-tooltip="..." element in the
// document (modifier/relic/boss-effect badges, reforge legend labels, the
// score category label). One listener handles all of them, including ones
// injected later via innerHTML, no per-element wiring needed. Positioned
// and clamped via _positionFloatingTooltip so it never gets cut off at the
// edge of the Rifts panel or the screen.
let _attrTooltipEl = null;
function _getAttrTooltipEl() {
    if (!_attrTooltipEl) {
        _attrTooltipEl = document.createElement('div');
        _attrTooltipEl.className = 'vd-attr-tooltip';
        document.body.appendChild(_attrTooltipEl);
    }
    return _attrTooltipEl;
}
document.addEventListener('mouseover', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-vd-tooltip]') : null;
    if (!el) return;
    const text = el.getAttribute('data-vd-tooltip');
    if (!text) return;
    const tip = _getAttrTooltipEl();
    tip.textContent = text;
    tip.style.display = 'block';
    _positionFloatingTooltip(tip, el.getBoundingClientRect());
});
document.addEventListener('mouseout', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-vd-tooltip]') : null;
    if (!el) return;
    // Don't hide if we're just moving within the same tooltip-owning element.
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    if (_attrTooltipEl) _attrTooltipEl.style.display = 'none';
});

// Single shared tooltip element reused across every VoidDiceRenderer
// instance (one gets created per fresh mount, e.g. every ante/shop
// transition), so hovering a die never accumulates orphaned hidden divs.
let _sharedDieTooltipEl = null;
function _getSharedDieTooltipEl() {
    if (!_sharedDieTooltipEl) {
        _sharedDieTooltipEl = document.createElement('div');
        _sharedDieTooltipEl.className = 'vd-die-tooltip';
        document.body.appendChild(_sharedDieTooltipEl);
    }
    return _sharedDieTooltipEl;
}

// Positions a `position: fixed` tooltip-like element near anchorRect,
// preferring centered-above, then clamps/flips it to stay fully inside the
// viewport. Two-pass: place it, measure its actual rendered box (size
// depends on content), then nudge. Shared by both tooltip kinds so a badge
// in the corner of the Rifts panel doesn't get its tooltip clipped off the
// edge of the screen.
function _positionFloatingTooltip(el, anchorRect) {
    const margin = 8;
    let left = anchorRect.left + anchorRect.width / 2;
    let top = anchorRect.top - margin;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.transform = 'translate(-50%, -100%)';

    const tipRect = el.getBoundingClientRect();
    let dx = 0;
    if (tipRect.left < margin) dx = margin - tipRect.left;
    else if (tipRect.right > window.innerWidth - margin) dx = (window.innerWidth - margin) - tipRect.right;
    if (dx !== 0) el.style.left = (left + dx) + 'px';

    if (tipRect.top < margin) {
        // Not enough room above, flip to below the anchor instead.
        el.style.top = (anchorRect.bottom + margin) + 'px';
        el.style.transform = 'translate(-50%, 0)';
    }
}

function _spawnLandPuff(wrapEl) {
    const rect = wrapEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 5;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 14 + Math.random() * 8;
        _spawnPoofDot(cx, cy, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, '#bb88ff');
    }
}

function _spawnPoofDot(x0, y0, x1, y1, color) {
    const el = document.createElement('div');
    el.className = 'vd-poof-dot';
    el.style.background = color;
    el.style.left = x0 + 'px';
    el.style.top = y0 + 'px';
    document.body.appendChild(el);
    const dx = x1 - x0, dy = y1 - y0;
    const duration = 350;
    const start = performance.now();
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 2);
        el.style.left = (x0 + dx * ease) + 'px';
        el.style.top = (y0 + dy * ease) + 'px';
        el.style.opacity = String(1 - t);
        el.style.transform = `scale(${1 - t * 0.6})`;
        if (t < 1) requestAnimationFrame(step);
        else el.remove();
    }
    requestAnimationFrame(step);
}

function _spawnConfettiShard(x0, y, color, delayMs) {
    setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'vd-confetti-shard';
        el.style.left = x0 + 'px';
        el.style.top = y + 'px';
        el.style.background = color;
        document.body.appendChild(el);
        const fallDist = 90 + Math.random() * 60;
        const drift = (Math.random() - 0.5) * 60;
        const duration = 900 + Math.random() * 400;
        const spin = (Math.random() - 0.5) * 720;
        const start = performance.now();
        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = t * t;
            el.style.top = (y + fallDist * ease) + 'px';
            el.style.left = (x0 + drift * ease) + 'px';
            el.style.transform = `rotate(${spin * t}deg)`;
            el.style.opacity = t < 0.7 ? '1' : String(1 - (t - 0.7) / 0.3);
            if (t < 1) requestAnimationFrame(step);
            else el.remove();
        }
        requestAnimationFrame(step);
    }, delayMs);
}

// Purchase feedback (shop modifiers/reforges, permanent upgrades): a small
// sparkle burst centered on the Shards panel. Called directly from main.js
// at the moment of purchase, since the shop screen doesn't keep the dice mat
// mounted to anchor an in-panel effect to.
window.voidShardsPurchasePoof = function(color) {
    const panel = document.querySelector('.void-shards-root');
    const rect = panel ? panel.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + 60 : 100;
    const c = color || '#88ddee';
    const count = 10;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 24 + Math.random() * 16;
        _spawnPoofDot(x, y, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, c);
    }
};

// Full-panel color flash, appended to document.body so it survives the
// panel's innerHTML being replaced immediately after a purchase.
window.voidShardsColorFlash = function(color) {
    const panel = document.querySelector('.void-shards-root') || document.body;
    const rect = panel.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'vd-score-flash';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.background = color || '#88ddee';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 450);
};

// Writes the current Run Fd total directly into both display elements
// (active-run stat box, shop header), bypassing the panel's full-rebuild
// path entirely. The panel intentionally skips rebuilding while a roll or
// hit/death/walk battle animation is in flight (so it doesn't tear down the
// mid-animation canvas/dice mat), which otherwise freezes every number in
// the panel, including this one, for up to ~2.7s after every score. Called
// directly from main.js at every point vs.earnedFd changes.
window.voidShardsSyncFdDisplay = function(val) {
    const activeEl = document.getElementById('vs-run-fd-active');
    if (activeEl) { activeEl.textContent = String(val); _bump(activeEl); }
    const shopEl = document.getElementById('vs-run-fd-shop');
    if (shopEl) { shopEl.textContent = val + ' Fd'; _bump(shopEl); }
};

// Run-end flourish: shard confetti on a win, a brief dark pulse on a loss.
window.voidShardsRunEndEffect = function(won) {
    const panel = document.querySelector('.void-shards-root');
    const rect = panel ? panel.getBoundingClientRect() : { left: window.innerWidth / 2 - 100, top: window.innerHeight / 2 - 100, width: 200, height: 200 };
    if (won) {
        const colors = ['#cc99ff', '#88ddee', '#ffcc66', '#88ff88'];
        for (let i = 0; i < 24; i++) {
            _spawnConfettiShard(rect.left + Math.random() * rect.width, rect.top, colors[i % colors.length], i * 18);
        }
    } else {
        const el = document.createElement('div');
        el.className = 'vd-loss-pulse';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        el.style.width = rect.width + 'px';
        el.style.height = rect.height + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 700);
    }
};

// Color/banner for the biggest combo tiers, keyed by DICE_CONFIG.scoring key.
const _COMBO_FLASH_COLOR = {
    void_convergence: '#ffffff',
    shard_straight: '#66eedd',
    void_bloom: '#cc77ff',
    full_fracture: '#ffcc44',
    shard_cluster: '#77ee99',
};
const _COMBO_BANNER_LABEL = {
    void_convergence: 'VOID CONVERGENCE!',
    shard_straight: 'SHARD STRAIGHT!',
    void_bloom: 'VOID BLOOM!',
};

// Particle + counter animation fired when the player scores.
// chips/mult/fd: numbers. category: scoring key (e.g. 'void_bloom'), used to
// color-code a screen flash and show a banner for the biggest tiers.
// clearRatio: fd/threshold, used to give a bigger bounce on a decisive clear.
window.voidShardsScoreAnim = function(chips, mult, fd, category, clearRatio) {
    const matEl = document.getElementById('vd-mat');
    const chipsEl = document.getElementById('vd-chips-val');
    const multEl = document.getElementById('vd-mult-val');
    const fdEl = document.getElementById('vd-fd-val');
    if (!matEl || !chipsEl || !fdEl) return;

    const matRect = matEl.getBoundingClientRect();

    const flashColor = _COMBO_FLASH_COLOR[category];
    if (flashColor) {
        const flashEl = document.createElement('div');
        flashEl.className = 'vd-score-flash';
        flashEl.style.left = matRect.left + 'px';
        flashEl.style.top = matRect.top + 'px';
        flashEl.style.width = matRect.width + 'px';
        flashEl.style.height = matRect.height + 'px';
        flashEl.style.background = flashColor;
        document.body.appendChild(flashEl);
        setTimeout(() => flashEl.remove(), 450);
    }
    const bannerLabel = _COMBO_BANNER_LABEL[category];
    if (bannerLabel) {
        const bannerEl = document.createElement('div');
        bannerEl.className = 'vd-combo-banner';
        bannerEl.textContent = bannerLabel;
        bannerEl.style.left = (matRect.left + matRect.width / 2) + 'px';
        bannerEl.style.top = (matRect.top + matRect.height / 2) + 'px';
        bannerEl.style.color = flashColor || '#ffffff';
        bannerEl.style.textShadow = `0 0 10px ${flashColor || '#ffffff'}`;
        document.body.appendChild(bannerEl);
        setTimeout(() => bannerEl.remove(), 900);
    }

    // Resolve knight screen position from the battle canvas if available
    const battleCanvas = document.getElementById('vs-battle-canvas');
    let knightScreenX, knightScreenY;
    if (battleCanvas) {
        const br = battleCanvas.getBoundingClientRect();
        const scaleX = br.width / battleCanvas.width;
        const scaleY = br.height / battleCanvas.height;
        knightScreenX = br.left + 75 * scaleX;
        knightScreenY = br.top + 48 * scaleY;
    } else {
        const chipsRect = chipsEl.getBoundingClientRect();
        knightScreenX = chipsRect.left + chipsRect.width / 2;
        knightScreenY = chipsRect.top + chipsRect.height / 2;
    }

    // Chip particles (blue, fly toward knight)
    const chipCount = Math.min(chips, 12);
    for (let i = 0; i < chipCount; i++) {
        _spawnParticle(
            matRect.left + Math.random() * matRect.width,
            matRect.top + Math.random() * matRect.height,
            knightScreenX,
            knightScreenY,
            '#88aaff', '+' + Math.ceil(chips / chipCount),
            i * 40
        );
    }

    // Mult particles (purple, fly toward knight)
    if (mult > 1) {
        const multCount = Math.min(mult, 6);
        for (let i = 0; i < multCount; i++) {
            _spawnParticle(
                matRect.left + Math.random() * matRect.width,
                matRect.top + Math.random() * matRect.height,
                knightScreenX,
                knightScreenY,
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
        if (fdEl) _bump(fdEl, clearRatio >= 1.5 ? 1.6 : 1);
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

function _bump(el, scale) {
    const cls = (scale && scale > 1.3) ? 'vd-counter-bump-big' : 'vd-counter-bump';
    el.classList.remove('vd-counter-bump', 'vd-counter-bump-big');
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 400);
}

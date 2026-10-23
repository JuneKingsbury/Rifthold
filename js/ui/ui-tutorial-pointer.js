// Draws the tutorial's "click here" arrow. The current step supplies a pointer
// descriptor (see js/systems/tutorial.js). DOM targets get a floating arrow + ring
// from this module, and map targets are handed to OverlayRenderer through
// `game.tutorialMapHint`, because tiles have no DOM element to anchor to.

const POLL_MS = 150;
const NOTE_REFRESH_EVERY = 7; // polls (~1s), so affordability/stuck hints stay current
const EDGE = 6; // keep the arrow this far from the window edge
const GAP = 8; // space between the arrow tip and the target
const ARROW_LENGTH = 46; // arrow + gap, the part of the unit that is not the label

const ARROW_SVG = '<svg class="tp-arrow" viewBox="0 0 40 46" width="40" height="46" aria-hidden="true">'
    + '<path d="M20 44 L3 22 H13 V2 H27 V22 H37 Z" /></svg>';

export function installTutorialPointer(UI) {
    Object.assign(UI.prototype, pointerMethods);
}

const pointerMethods = {
    initTutorialPointer() {
        if (this._tpEl) return;
        const root = document.createElement('div');
        root.id = 'tutorial-pointer';
        root.style.display = 'none';
        root.innerHTML = '<div class="tp-ring"></div>'
            + `<div class="tp-unit"><div class="tp-label"></div><div class="tp-shift"><div class="tp-bob">${ARROW_SVG}</div></div></div>`;
        document.body.appendChild(root);
        this._tpEl = root;
        this._tpRing = root.querySelector('.tp-ring');
        this._tpUnit = root.querySelector('.tp-unit');
        this._tpLabel = root.querySelector('.tp-label');
        this._tpPolls = 0;
        this._tpTimer = setInterval(() => this._updateTutorialPointer(), POLL_MS);
    },

    _hideTutorialPointer() {
        if (this._tpEl) this._tpEl.style.display = 'none';
        if (this.game) this.game.tutorialMapHint = null;
    },

    _updateTutorialPointer() {
        const game = this.game;
        const tutorial = game?.tutorial;
        if (!tutorial || !this._tpEl) return;

        // The game loop only ticks the tutorial every 20 ticks and not at all while paused, but
        // the game starts paused and steps like "look around" must complete promptly.
        tutorial.update(game);
        if (++this._tpPolls % NOTE_REFRESH_EVERY === 0) this.updateTutorialNote(game);

        const enabled = game.settings.showTutorial
            && game.settings.showTutorialArrows !== false
            && !tutorial.isChecklist
            && !tutorial.isFinished()
            // Point at the interface only while the player can act on it.
            && !this._anyBlockingOverlay();
        if (!enabled) {
            this._hideTutorialPointer();
            return;
        }

        let desc = tutorial.getPointer(game);
        if (!desc) {
            this._hideTutorialPointer();
            return;
        }

        if (desc.map) {
            this._tpEl.style.display = 'none';
            game.tutorialMapHint = { ...desc.map, label: desc.label, reduceMotion: !!game.settings.reduceMotion };
            return;
        }
        game.tutorialMapHint = null;

        let target = this._resolveTarget(desc);
        if (!target && desc.fallback) {
            desc = desc.fallback;
            target = this._resolveTarget(desc);
        }
        // A target that exists but is scrolled out of view is being scrolled to, so don't re-point elsewhere.
        if (!target && this._tpOffscreen) {
            this._hideTutorialPointer();
            return;
        }
        if (!target) {
            // The panel for this step is not open: fall back to its mode-bar button.
            const hl = tutorial.getHighlight();
            if (hl) {
                desc = { selector: `#mode-bar [data-mode-action="${hl}"]`, label: desc.label };
                target = this._resolveTarget(desc);
            }
        }
        if (!target) {
            this._hideTutorialPointer();
            return;
        }
        this._placePointer(target, desc.label);
    },

    // The settings dialog and similar modals sit on top of the game; an arrow floating over them is confusing.
    _anyBlockingOverlay() {
        const settings = this.elements.settingsPanel;
        return !!(settings && settings.style.display === 'block');
    },

    // Returns the target's rect if it is on screen. A target that exists but is scrolled out of
    // view (inside the viewport, or clipped by a scrolling panel) is scrolled into view once, and
    // pointed at on a later poll.
    _resolveTarget(desc) {
        let offscreen = null;
        this._tpOffscreen = false;
        for (const node of document.querySelectorAll(desc.selector)) {
            if (desc.text && node.textContent.trim() !== desc.text) continue;
            const r = node.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (this._visibleFraction(node, r) >= 0.8) return r;
            offscreen = offscreen || node;
        }
        this._tpOffscreen = !!offscreen;
        if (offscreen && this._tpScrolledNode !== offscreen) {
            // Scroll once per element. A re-rendered panel produces a new element, which scrolls again,
            // but a player who scrolls away on their own is not dragged back.
            this._tpScrolledNode = offscreen;
            offscreen.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        return null;
    },

    // Fraction of the element's area that is inside the window and every scrolling ancestor.
    _visibleFraction(node, r) {
        let left = Math.max(r.left, 0);
        let top = Math.max(r.top, 0);
        let right = Math.min(r.right, window.innerWidth);
        let bottom = Math.min(r.bottom, window.innerHeight);
        for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
            const cs = getComputedStyle(el);
            if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
            const pr = el.getBoundingClientRect();
            left = Math.max(left, pr.left);
            top = Math.max(top, pr.top);
            right = Math.min(right, pr.right);
            bottom = Math.min(bottom, pr.bottom);
        }
        if (right <= left || bottom <= top) return 0;
        return ((right - left) * (bottom - top)) / (r.width * r.height);
    },

    _placePointer(r, label) {
        const el = this._tpEl;
        const unit = this._tpUnit;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        this._tpLabel.textContent = label || '';
        this._tpLabel.style.display = label ? '' : 'none';
        el.classList.toggle('tp-static', !!this.game.settings.reduceMotion);
        el.style.display = 'block';

        // Ring around the target.
        const ring = this._tpRing.style;
        ring.left = `${r.left - 4}px`;
        ring.top = `${r.top - 4}px`;
        ring.width = `${r.width + 8}px`;
        ring.height = `${r.height + 8}px`;

        // Pick the side with room, preferring an arrow above the target pointing down.
        const w = Math.max(unit.offsetWidth, 60);
        const h = Math.max(unit.offsetHeight, ARROW_LENGTH);
        let dir;
        if (r.top - h - GAP >= EDGE) dir = 'down';
        else if (r.bottom + h + GAP <= vh - EDGE) dir = 'up';
        else if (r.left - w - GAP >= EDGE) dir = 'right';
        else dir = 'left';
        unit.className = `tp-unit dir-${dir}`;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let left;
        let top;
        if (dir === 'down') { left = cx - w / 2; top = r.top - h - GAP; }
        else if (dir === 'up') { left = cx - w / 2; top = r.bottom + GAP; }
        else if (dir === 'right') { left = r.left - w - GAP; top = cy - h / 2; }
        else { left = r.right + GAP; top = cy - h / 2; }

        const clampedLeft = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - w - EDGE));
        const clampedTop = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - h - EDGE));
        unit.style.left = `${clampedLeft}px`;
        unit.style.top = `${clampedTop}px`;

        // If clamping moved the unit, slide the arrow back so it still points at the target.
        const shift = (dir === 'down' || dir === 'up')
            ? cx - (clampedLeft + w / 2)
            : cy - (clampedTop + h / 2);
        unit.style.setProperty('--tp-shift', `${Math.round(shift)}px`);
    },
};

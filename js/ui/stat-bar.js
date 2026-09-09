// Live animated stat bars (HP / mana / needs).
//
// The UI panels that show these values rebuild their whole innerHTML string
// every frame and swap it in only when the string changes, which destroys and
// recreates the bar elements on every value change. That makes a CSS
// `transition:width` bar impossible (it snaps to the new width on recreation)
// and gives us nowhere to persist the "white ghost recede" animation state.
//
// So we do NOT animate in CSS. We emit stable markup carrying the live target
// percentage in a data attribute, keep per-bar animation state in a Map on the
// UI instance (keyed by a globally-unique string), and run runStatBarPass()
// once per rendered frame to ease each bar toward its target and write inline
// widths. The pass runs in the same rAF tick after all innerHTML swaps and
// before paint, so freshly recreated elements are corrected from persisted
// state with no flash.

// Per-frame decay constants, expressed per ~16.67ms frame and made
// frame-rate-independent via exponential decay in runStatBarPass. FILL is the
// colored bar chasing the target (snappy). LEAD is the white edge receding
// after damage (slow). EPS is the snap-to-target threshold in percent.
const FILL_BASE = 0.25;
const LEAD_BASE = 0.05;
const EPS = 0.4;
// At rest the white ghost tucks this far BEHIND the colored fill's right edge,
// so the fill fully covers it. Without this the ghost's edge lines up with the
// fill's and a thin white sliver shows past the fill's rounded corners.
const LEAD_HIDE = 2;

function clampPct(pct) {
    if (!Number.isFinite(pct)) return 0;
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
}

/**
 * Emit the markup for one stat bar. The colored fill is drawn on top of a white
 * "ghost" layer inside a track; the gap between them (fill..lead) is the white
 * chunk that shows after damage. The live percentage is baked into both the
 * inline width (safe static fallback) and data-bar-pct (read by the pass).
 *
 * @param {object}  o
 * @param {string}  o.key    Globally-unique bar key, e.g. 'info:hp:12'.
 * @param {number}  o.pct    Live value as a percentage (0-100).
 * @param {string}  o.color  Fill color (CSS color string).
 * @param {number} [o.width] Track width in px (default 80).
 * @param {number} [o.max]   Denominator (maxHp/maxMana). A change vs. the last
 *                           seen max snaps the bar so an equipment swap that
 *                           lowers pct doesn't spawn a spurious ghost.
 * @returns {string} One line of HTML with no inter-span whitespace.
 */
export function statBarHtml({ key, pct, color, width = 80, max = 0 }) {
    const c = clampPct(pct);
    return `<span class="stat-bar-track" style="width:${width}px">` +
        `<span class="stat-bar-ghost"></span>` +
        `<span class="stat-bar-fill" data-bar-key="${key}" data-bar-pct="${c}" data-bar-max="${max}" style="width:${c}%;background:${color}"></span>` +
        `</span>`;
}

/**
 * Advance every stat bar under `container` toward its target for one frame.
 *
 * @param {Element} container Root to query (info panel, HUD, or arcane panel).
 * @param {Map}     stateMap  Persistent { fill, lead, max } state, keyed by bar key.
 * @param {number}  fillK     Per-frame lerp factor for the colored fill.
 * @param {number}  leadK     Per-frame lerp factor for the white recede.
 * @param {Set}     seen      Bar keys touched this frame (caller prunes the rest).
 */
export function runStatBarPass(container, stateMap, fillK, leadK, seen) {
    if (!container) return;
    const fills = container.querySelectorAll('.stat-bar-fill[data-bar-key]');
    for (const fillEl of fills) {
        const key = fillEl.getAttribute('data-bar-key');
        const target = clampPct(parseFloat(fillEl.getAttribute('data-bar-pct')));
        const max = parseFloat(fillEl.getAttribute('data-bar-max')) || 0;
        seen.add(key);

        let st = stateMap.get(key);
        // First sight, or the denominator changed (e.g. equipped +maxHp armor):
        // snap so we neither animate from zero nor flash a ghost.
        if (!st || st.max !== max) {
            st = { fill: target, lead: target, max };
            stateMap.set(key, st);
        }

        if (target >= st.fill) {
            // Increase or steady: colored bar rises, ghost stays tucked behind.
            st.fill += (target - st.fill) * fillK;
            if (target - st.fill < EPS) st.fill = target;
            st.lead = Math.max(0, st.fill - LEAD_HIDE);
        } else {
            // Decrease: capture the old height on the first damage frame, drop
            // the colored bar fast, then let the white edge recede slowly until
            // it settles LEAD_HIDE behind the new fill value (so no sliver shows).
            if (st.lead < st.fill) st.lead = st.fill;
            st.fill += (target - st.fill) * fillK;
            if (st.fill - target < EPS) st.fill = target;
            const rest = Math.max(0, st.fill - LEAD_HIDE);
            st.lead += (rest - st.lead) * leadK;
            if (st.lead - rest < EPS) st.lead = rest;
        }

        fillEl.style.width = st.fill + '%';
        const ghostEl = fillEl.parentNode && fillEl.parentNode.querySelector('.stat-bar-ghost');
        if (ghostEl) ghostEl.style.width = st.lead + '%';
    }
}

/**
 * Compute the two per-frame lerp factors for a given frame delta, so animation
 * duration is identical at 30fps and 60fps.
 *
 * @param {number} dt Frame delta in ms.
 * @returns {{ fillK: number, leadK: number }}
 */
export function statBarFactors(dt) {
    const r = dt > 0 ? dt / 16.67 : 1;
    return {
        fillK: 1 - Math.pow(1 - FILL_BASE, r),
        leadK: 1 - Math.pow(1 - LEAD_BASE, r),
    };
}

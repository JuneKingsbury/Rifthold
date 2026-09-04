import { RENDER_CONFIG } from '../core/config.js';

// Procedural "action" animation layer for the in-world map renderer.
//
// Composes ONE reusable transform descriptor (`_xf`) per entity per frame from
// four blending tiers, mirroring the expedition view's `_composeEntityAnim`
// (js/ui/ui-arcane.js) without touching it:
//
//   1. Ambient breathing  → growPx        (always; height-stretch, handled inline
//                                           by the renderer's drawImage as today)
//   2. Ambient walk-sway   → rotation       (moving entities only)
//   3. One-shot slot       → rotation/offset/scale/overlay
//        A single per-entity slot resolves melee / ranged / cast / hit by
//        priority. A new one-shot seizes the slot only if its priority >= the
//        current holder's, so a dramatic action (attack/cast, pr 40) isn't
//        cancelled by being struck (hit, pr 20) — the hit flinch plays only when
//        the slot is otherwise free. Same-type re-trigger restarts the timer.
//   4. Continuous work bob → rotation/offset (blends only while the slot is free)
//
// The descriptor is module-scope and reused every call (zero per-frame
// allocation, like movement-lerp's `_pos`). Latch scratch (`_wanim`) is stored
// on the PERSISTENT sim entity — the static renderer's per-tile entity objects
// are rebuilt every tick, so scratch there would not survive across ticks.

// Reusable transform descriptor. `identity` reflects the AFFINE transform only
// (rotation/offset/scale); growPx and the overlay are applied by the renderer
// regardless, so the fast path (plain drawImage + inline grow) matches today.
const _xf = {
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    growPx: 0,
    overlayKey: null,
    overlayAlpha: 0,
    identity: true,
};

// Continuous sine "breath": px of extra sprite height this frame (0..amplitude).
// Ported from the renderer so all composition lives here. `seed` decorrelates
// each entity's phase. Driven by `now` so it stays smooth and runs while paused.
function breatheGrow(now, seed) {
    if (!RENDER_CONFIG.entityBreathing) return 0;
    const phase = (now / RENDER_CONFIG.breathePeriodMs) * Math.PI * 2
        + (seed % 1000) / 1000 * RENDER_CONFIG.breathePhaseSpread;
    return (0.5 - 0.5 * Math.cos(phase)) * RENDER_CONFIG.breatheAmplitudePx;
}

// Walking "sway": pendulum rotation (radians) about the feet, driven by move
// progress `t` (0→1) so the sprite is upright at both ends of every tile step.
// `seed` parity flips the lead side. `mood` (0-100) subtly scales amplitude.
function walkSway(t, seed, mood) {
    if (!RENDER_CONFIG.entityWalkSway) return 0;
    const dir = (seed & 1) ? -1 : 1;
    const phase = t * Math.PI * 2 * RENDER_CONFIG.walkSwayCycles;
    const moodMult = mood != null ? (mood > 70 ? 1.2 : mood < 30 ? 0.6 : 1.0) : 1.0;
    return Math.sin(phase) * RENDER_CONFIG.walkSwayAmplitudeRad * dir * moodMult;
}

// Idle "sway": a slow low-amplitude weight-shift (radians) about the feet while
// an entity is stationary, driven by `now` (smooth, runs while paused). `seed`
// decorrelates each entity's phase. The resting counterpart to walkSway; mirrors
// the expedition view's `expedIdleShift`.
function idleSway(now, seed) {
    if (!RENDER_CONFIG.entityIdleSway) return 0;
    const phase = (now / RENDER_CONFIG.idleSwayPeriodMs) * Math.PI * 2
        + (seed % 1000) / 1000 * 6.28;
    return Math.sin(phase) * RENDER_CONFIG.idleSwayRad;
}

// Wind strength (0..1) for a weather type: how hard the trees should be blown.
// Unknown weather falls back to the `clear` value (a gentle breeze).
// Phase continuity state. When wind changes, we store an offset so sway picks up
// from the same sine position rather than jumping to a new phase.
// _smoothSwayWind lerps toward _lastSwayWind for amplitude only, so the wave
// speed snaps (phase-corrected) but the size eases in gradually.
let _swayPhaseOffset = 0;
let _lastSwayWind = -1;
let _smoothSwayWind = 0;

export function setSwayWind(wind, now, dt) {
    // Lerp amplitude wind toward target
    if (_lastSwayWind >= 0) {
        const rate = 1 - Math.pow(0.001, dt);  // ~3s transition
        _smoothSwayWind += (wind - _smoothSwayWind) * rate;
    } else {
        _smoothSwayWind = wind;
    }

    if (_lastSwayWind === wind) return;
    if (_lastSwayWind >= 0) {
        const D = RENDER_CONFIG.terrainDetail;
        if (D && D.enabled) {
            const oldPeriod = D.grassCalmPeriodMs + (D.grassStormPeriodMs - D.grassCalmPeriodMs) * _lastSwayWind;
            const newPeriod = D.grassCalmPeriodMs + (D.grassStormPeriodMs - D.grassCalmPeriodMs) * wind;
            const oldPhase = (now / oldPeriod) * Math.PI * 2;
            const newPhase = (now / newPeriod) * Math.PI * 2;
            _swayPhaseOffset += oldPhase - newPhase;
        }
    }
    _lastSwayWind = wind;
}

export function windStrengthFor(weatherType) {
    const W = RENDER_CONFIG.treeSway;
    if (!W || !W.windByWeather) return 0;
    const w = W.windByWeather[weatherType];
    return w != null ? w : (W.windByWeather.clear || 0);
}

// Tree sway: rotation (radians) about the trunk base for a tree resource sprite.
// Cadence shortens and amplitude grows with `wind` (0..1); a slow gust envelope
// makes the breeze surge and ease; `seed` decorrelates each tree's phase. Trees
// only ever lean one way from vertical (|sin|), like a canopy pushed by wind,
// with the lean direction fixed by seed parity. Driven by `now` (smooth, runs
// while paused).
function treeSwayRotation(now, seed, wind) {
    const W = RENDER_CONFIG.treeSway;
    if (!W || !W.enabled) return 0;
    // Interpolate cadence + amplitude between the calm and storm extremes.
    const period = W.calmPeriodMs + (W.stormPeriodMs - W.calmPeriodMs) * wind;
    // Gust envelope: 0.6..1.0 base swell, widening toward 0.3..1.0 at full wind.
    const gustPhase = (now / W.gustPeriodMs) * Math.PI * 2 + (seed % 997) / 997 * 6.28;
    const gust = 1 - (0.4 + 0.3 * wind) * (0.5 - 0.5 * Math.cos(gustPhase));
    const amp = (W.calmSwayRad + (W.stormSwayRad - W.calmSwayRad) * _smoothSwayWind) * gust;
    const dir = (seed & 1) ? -1 : 1;
    const phase = (now / period) * Math.PI * 2 + (seed % 1000) / 1000 * W.phaseSpread;
    return Math.abs(Math.sin(phase)) * amp * dir;
}

/**
 * Sway rotation (radians) for a tree resource sprite, about its trunk base.
 *
 * @param {number} now    performance.now() for this frame.
 * @param {number} seed   Per-tile phase-decorrelation seed (e.g. y*W+x).
 * @param {number} wind   Wind strength 0..1 (see windStrengthFor).
 * @returns {number} Rotation in radians (0 when disabled).
 */
export function getTreeSway(now, seed, wind) {
    return treeSwayRotation(now, seed, wind);
}

/**
 * Grass-tuft sway rotation (radians), about the tuft base. Side-to-side (signed
 * sin, unlike the tree's one-way |sin|) so tufts wave both ways in the breeze.
 * Shares the tree wind model: amplitude and cadence scale with `wind` (0..1).
 *
 * @param {number} now   performance.now() for this frame.
 * @param {number} seed  Per-tile phase-decorrelation seed.
 * @param {number} wind  Wind strength 0..1 (see windStrengthFor).
 * @returns {number} Rotation in radians (0 when disabled).
 */
export function getGrassSway(now, seed, wind, boostAdd) {
    const D = RENDER_CONFIG.terrainDetail;
    if (!D || !D.enabled) return 0;
    const period = D.grassCalmPeriodMs + (D.grassStormPeriodMs - D.grassCalmPeriodMs) * wind;
    const baseAmp = D.grassCalmSwayRad + (D.grassStormSwayRad - D.grassCalmSwayRad) * _smoothSwayWind;
    const phase = (now / period) * Math.PI * 2 + _swayPhaseOffset + (seed % 1000) / 1000 * D.grassPhaseSpread;
    return Math.sin(phase) * baseAmp + (boostAdd || 0);
}

/**
 * Crop/flower sway rotation (radians), lighter than grass tufts. Side-to-side sway
 * driven by wind. Used for farm zone tiles with a crop planted.
 */
export function getCropSway(now, seed, wind) {
    const D = RENDER_CONFIG.terrainDetail;
    if (!D || !D.enabled) return 0;
    const calm = D.cropCalmPeriodMs || 3800;
    const storm = D.cropStormPeriodMs || 1400;
    const calmAmp = D.cropCalmSwayRad || 0.03;
    const stormAmp = D.cropStormSwayRad || 0.10;
    const period = calm + (storm - calm) * wind;
    const amp = calmAmp + (stormAmp - calmAmp) * _smoothSwayWind;
    const phase = (now / period) * Math.PI * 2 + _swayPhaseOffset + (seed % 1000) / 1000 * 6.28;
    return Math.sin(phase) * amp;
}

// Reusable water-wave descriptor (offsetY px, alpha). Module-scope so the hot
// loop allocates nothing, like `_xf`.
const _water = { offsetY: 0, alpha: 1 };

/**
 * Water-wave motion: a slow vertical rise/fall plus a gentle alpha shimmer for a
 * `water_waves` overlay sprite. No wind term; water keeps its own steady rhythm.
 *
 * @param {number} now   performance.now() for this frame.
 * @param {number} seed  Per-tile phase-decorrelation seed.
 * @returns {object} The reused `_water` descriptor {offsetY, alpha}. Do not retain.
 */
export function getWaterWave(now, seed) {
    const D = RENDER_CONFIG.terrainDetail;
    if (!D || !D.enabled) { _water.offsetY = 0; _water.alpha = 1; return _water; }
    const phase = (now / D.waterPeriodMs) * Math.PI * 2 + (seed % 1000) / 1000 * D.waterPhaseSpread;
    // Rise and fall about the resting position (sin, so it lifts then dips).
    _water.offsetY = Math.sin(phase) * D.waterBobPx;
    // Shimmer the opacity in quadrature so the peak brightness leads the crest.
    _water.alpha = D.waterAlphaBase + D.waterAlphaVar * Math.cos(phase);
    return _water;
}

// Progress (0..1) of a tick-stamped one-shot, latching its wall-clock start on
// the entity's scratch object. Returns null when inactive/expired. `key`
// namespaces the latch so different one-shots don't clobber each other.
// Mirrors `_animShotT` in ui-arcane.js.
function animShotT(scratch, tick, key, durationMs, now) {
    if (tick == null) return null;
    const seenKey = key + 'Seen';
    const startKey = key + 'Start';
    if (scratch[seenKey] !== tick) { scratch[seenKey] = tick; scratch[startKey] = now; }
    const start = scratch[startKey];
    if (start == null) return null;
    const t = (now - start) / durationMs;
    return (t >= 0 && t < 1) ? t : null;
}

// Apply a per-school cast signature to `_xf`. `arc` = sin(π·t) (0→1→0), `t` is
// raw progress for phase-based wobble. `facing` is +1/-1 (toward last cast/attack
// direction, else seed parity).
function applyCastSignature(school, facing, arc, t, A) {
    switch (school) {
        case 'evocation':      // forward thrust toward the foe
            _xf.offsetX += facing * A.castThrustPx * arc;
            break;
        case 'abjuration':     // reverent upward raise
            _xf.offsetY += -A.castRaisePx * arc;
            break;
        case 'conjuration':    // conjuring pulse (uniform scale)
            _xf.scaleX *= 1 + A.castPulseScale * arc;
            _xf.scaleY *= 1 + A.castPulseScale * arc;
            break;
        case 'enchantment':    // shimmering wobble (3 oscillations across the window)
            _xf.rotation += Math.sin(t * Math.PI * 3) * A.castWobbleRad;
            break;
        case 'transmutation':  // squash-and-stretch
            _xf.scaleY *= 1 + A.castSquash * arc;
            _xf.scaleX *= 1 - A.castSquash * arc;
            break;
        case 'divination':     // gentle hover
            _xf.offsetY += -A.castRaisePx * 0.5 * arc;
            break;
        default:               // unknown school: neutral raise
            _xf.offsetY += -A.castRaisePx * 0.5 * arc;
            break;
    }
}

/**
 * Compose the per-frame transform for one entity.
 *
 * @param {object} entity  Persistent sim entity (scratch + action stamps live here).
 * @param {number} now     performance.now() for this frame.
 * @param {object} game    For taskQueue lookup (work bob).
 * @param {number|null} moveT  Move progress 0→1 for moving entities; null when stationary.
 * @param {number} seed    Phase decorrelation seed (entity id).
 * @param {object} flags   { showBreathing, showWalkSway, showActionAnimations }.
 * @returns {object} The reused `_xf` descriptor. Do not retain across calls.
 */
export function getEntityTransform(entity, now, game, moveT, seed, flags) {
    _xf.rotation = 0;
    _xf.offsetX = 0;
    _xf.offsetY = 0;
    _xf.scaleX = 1;
    _xf.scaleY = 1;
    _xf.growPx = 0;
    _xf.overlayKey = null;
    _xf.overlayAlpha = 0;

    // ── Tier 1: ambient breathing (independent channel) ──
    // Sleeping: 3x amplitude slow breathing
    if (flags.showBreathing) {
        if (entity && entity.state === 'sleeping') {
            const phase = (now / (RENDER_CONFIG.breathePeriodMs * 3)) * Math.PI * 2
                + (seed % 1000) / 1000 * RENDER_CONFIG.breathePhaseSpread;
            _xf.growPx = (0.5 - 0.5 * Math.cos(phase)) * RENDER_CONFIG.breatheAmplitudePx * 3;
        } else {
            _xf.growPx = breatheGrow(now, seed);
        }
    } else {
        _xf.growPx = 0;
    }

    const mood = entity ? entity.mood : null;

    // ── Tier 2: ambient walk-sway (moving only) ──
    if (flags.showWalkSway && moveT != null) {
        _xf.rotation += walkSway(moveT, seed, mood);
    }

    const A = RENDER_CONFIG.entityActionAnim;
    const actionsOn = !!(flags.showActionAnimations && A && A.enabled && entity);

    // ── Tier 3: one-shot slot (priority-resolved) ──
    let oneShotActive = false;
    if (actionsOn) {
        const scratch = entity._wanim || (entity._wanim = {});
        const P = A.priority;

        // Resolve the single winning one-shot: highest priority with a live t;
        // `>=` lets a fresh same-priority action replace the holder (crisp restart).
        let best = null;
        const consider = (name, t, pr) => {
            if (t == null) return;
            if (!best || pr >= best.pr) best = { name, t, pr };
        };
        // Weapon-driven motion class, matching the expedition view's attack anim
        // (js/ui/ui-arcane.js `_composeEntityAnim`). New stamps carry the weapon's
        // `attackAnim` ('Swing' | 'Stab' | 'DrawAndShoot'); older stamps
        // ('melee'/'ranged'/'bow'/'wand') are mapped for saved-game safety.
        let atkClass = entity._lastAttackKind || 'Swing';
        if (atkClass === 'melee') atkClass = 'Swing';
        else if (atkClass === 'ranged' || atkClass === 'bow' || atkClass === 'wand') atkClass = 'DrawAndShoot';
        const atkDur = atkClass === 'DrawAndShoot' ? A.rangedRecoilDurationMs : RENDER_CONFIG.attackSwingDurationMs;
        consider('cast', animShotT(scratch, entity._lastCastTick, 'cast', A.castDurationMs, now), P.cast);
        consider('attack', animShotT(scratch, entity._lastAttackTick, 'attack', atkDur, now), P.attack);
        // Hit uses `_dmgFlashUntil` as its tick signal — it changes value on each
        // new hit that advances the tick, so no extra sim stamp is needed.
        consider('hit', animShotT(scratch, entity._dmgFlashUntil, 'hit', A.hitDurationMs, now), P.hit);

        if (best) {
            oneShotActive = true;
            const t = best.t;
            const arc = Math.sin(t * Math.PI);   // 0→1→0, upright/centered at ends
            const dir = entity._lastAttackDir;
            const facing = dir ? (dir.dx >= 0 ? 1 : -1) : ((seed & 1) ? -1 : 1);

            switch (best.name) {
                case 'attack':
                    // Motion class per equipped weapon, mirroring the expedition view.
                    // Directional lunge/recoil follow the stamped attack vector when
                    // present (dx/dy toward the foe), else fall back to seed facing.
                    if (atkClass === 'DrawAndShoot') {
                        // Pull back (away from foe) through the first half, then snap
                        // forward on release: bows, crossbows, wands, staves.
                        const draw = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
                        const reach = t < 0.45 ? -draw * A.rangedRecoilPx : arc * A.rangedRecoilPx * 1.5;
                        if (dir) {
                            _xf.offsetX += dir.dx * reach;
                            _xf.offsetY += dir.dy * reach;
                        } else {
                            _xf.offsetX += facing * reach;
                        }
                        _xf.scaleX *= 1 - 0.06 * arc;
                    } else if (atkClass === 'Stab') {
                        // Forward linear thrust toward the foe then retract, with a hair
                        // of forward tilt: spears, daggers.
                        if (dir) {
                            _xf.offsetX += dir.dx * A.stabThrustPx * arc;
                            _xf.offsetY += dir.dy * A.stabThrustPx * arc;
                        } else {
                            _xf.offsetX += facing * A.stabThrustPx * arc;
                        }
                        _xf.rotation += 0.08 * facing * arc;
                    } else {
                        // 'Swing': rotation lunge toward the foe plus a slight step in:
                        // swords, axes, maces, claws.
                        if (dir) {
                            _xf.offsetX += dir.dx * A.meleeLungePx * arc;
                            _xf.offsetY += dir.dy * A.meleeLungePx * arc;
                        } else {
                            _xf.offsetX += facing * A.meleeLungePx * arc;
                        }
                        _xf.rotation += RENDER_CONFIG.attackSwingAmplitudeRad * facing * arc;
                    }
                    break;
                case 'cast': {
                    const school = entity._lastCastSchool;
                    applyCastSignature(school, facing, arc, t, A);
                    const key = school ? A.castOverlayKeys[school] : null;
                    if (key) { _xf.overlayKey = key; _xf.overlayAlpha = arc; }
                    break;
                }
                case 'hit':
                    // Flinch: knock back (seed-parity direction — the victim doesn't
                    // stamp the attacker's direction) + brief vertical squash.
                    _xf.offsetX += -facing * A.hitRecoilPx * arc;
                    _xf.scaleY *= 1 - A.hitSquash * arc;
                    _xf.rotation += -0.06 * facing * arc;
                    break;
            }
        }
    }

    // ── Tier 4: continuous work bob (blends only while the slot is free) ──
    let workActive = false;
    if (actionsOn && !oneShotActive && entity.state === 'working') {
        workActive = true;
        const task = (game.taskQueue && entity.currentTaskId != null)
            ? game.taskQueue.getById(entity.currentTaskId) : null;
        const type = task ? task.type : null;
        const ph = (now / A.workBobPeriodMs) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
        if (type === 'mine' || type === 'chop' || type === 'deconstruct' || type === 'demolish') {
            // Chopping/mining: downward hack bob + slight rock.
            _xf.offsetY += -Math.abs(Math.sin(ph)) * A.workBobPx;
            _xf.rotation += Math.sin(ph) * A.workBobRotRad;
        } else if (type === 'build' || type === 'craft' || type === 'cook') {
            // Hammering/crafting: steady vertical bob.
            _xf.offsetY += -Math.abs(Math.sin(ph)) * A.workBobPx;
        } else {
            // Research/harvest/plant/misc: gentle side-to-side sway.
            _xf.rotation += Math.sin(ph) * A.workBobRotRad;
        }
    }

    // ── Tier 2b: idle sway (stationary and otherwise inactive) ──
    if (flags.showWalkSway && moveT == null && !oneShotActive && !workActive) {
        if (entity && entity.state === 'sleeping') {
            // Sleeping sway: very gentle side-to-side
            const phase = (now / 5000) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
            _xf.rotation += Math.sin(phase) * 0.015;
        } else {
            _xf.rotation += idleSway(now, seed);
        }
    }

    // ── Tier 2c: eating animation ──
    if (actionsOn && !oneShotActive && !workActive && entity && entity.state === 'eating') {
        const phase = (now / 500) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
        const facing = (seed & 1) ? 1 : -1;
        _xf.rotation += facing * 0.08 * Math.abs(Math.sin(phase));
        _xf.offsetY += Math.abs(Math.sin(phase)) * 1;
    }

    // ── Tier 2d: startle reaction (danger nearby) ──
    if (actionsOn && entity && entity._startleUntil) {
        const t = animShotT(entity._wanim || (entity._wanim = {}), entity._startleUntil, 'startle', 180, now);
        if (t != null && !oneShotActive) {
            const arc = Math.sin(t * Math.PI);
            const facing = (seed & 1) ? 1 : -1;
            _xf.offsetX += -facing * 3 * arc;
            _xf.scaleY *= 1 - 0.08 * arc;
        }
    }

    // ── Tier 2e: idle fidget (rare micro-gestures while truly idle) ──
    if (actionsOn && !oneShotActive && !workActive && moveT == null
        && entity && entity.state !== 'sleeping' && entity.state !== 'eating') {
        const scratch = entity._wanim || (entity._wanim = {});
        if (scratch.fidgetNext == null) {
            scratch.fidgetNext = now + 10000 + Math.random() * 10000;
        }
        if (now >= scratch.fidgetNext) {
            scratch.fidgetType = Math.floor(Math.random() * 3);
            scratch.fidgetStart = now;
            scratch.fidgetNext = now + 10000 + Math.random() * 10000;
        }
        if (scratch.fidgetStart != null) {
            const elapsed = now - scratch.fidgetStart;
            const fidgetDurations = [800, 600, 500];
            const dur = fidgetDurations[scratch.fidgetType] || 700;
            if (elapsed < dur) {
                const ft = elapsed / dur;
                const arc = Math.sin(ft * Math.PI);
                if (scratch.fidgetType === 0) {
                    // Look around: slow rotation oscillation
                    _xf.rotation += Math.sin(ft * Math.PI * 3) * 0.06 * arc;
                } else if (scratch.fidgetType === 1) {
                    // Stretch: exaggerated breath peak
                    _xf.growPx += arc * RENDER_CONFIG.breatheAmplitudePx * 2;
                    _xf.offsetY -= arc * 2;
                } else {
                    // Foot tap: rapid small bobs
                    _xf.offsetY += -Math.abs(Math.sin(ft * Math.PI * 4)) * 0.8;
                }
            } else {
                scratch.fidgetStart = null;
            }
        }
    }

    _xf.identity = (_xf.rotation === 0 && _xf.offsetX === 0 && _xf.offsetY === 0
        && _xf.scaleX === 1 && _xf.scaleY === 1);
    return _xf;
}

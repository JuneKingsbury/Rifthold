export const RENDER_CONFIG = {
    fontSize: 14,
    fontHeightMult: 1.15,
    bgColor: '#85a643',
    cursorBg: '#444',
    selectionBgZone: '#2a3a2a',
    selectionBgBuild: '#3a2a2a',
    nightMaxDarkness: 0.55,
    nightDawnDuskOffset: { duskEnd: 0.12, dawnStart: 0.10 },
    nightGradientSteps: 8,
    nightOverlayColor: [0, 0, 20],
    lightSourceMargin: 8,
    fireLightRadius: 2,
    seasonDaylight: {
        summer: { dawn: 0.15, dusk: 0.75 },
        winter: { dawn: 0.25, dusk: 0.65 },
        spring: { dawn: 0.18, dusk: 0.72 },
        autumn: { dawn: 0.22, dusk: 0.68 },
        default: { dawn: 0.20, dusk: 0.70 },
    },
    terrainDithering: true,
    ditherDepth: 0.3,
    draftedPulsePeriod: 20,
    draftedPulseDuty: 10,
    draftedOutlineColor: '#aa33ff',
    spellGlowPeriod: 16,
    spellGlowDuty: 8,
    riftPulsePeriod: 20,
    riftPulseDuty: 10,
    // Entity "breathing": subtle continuous vertical stretch, driven by
    // performance.now() (NOT game.tick) so it stays smooth at 60fps and
    // continues while paused. Period in ms, amplitude in CSS px.
    entityBreathing: true,
    breathePeriodMs: 3200,
    breatheAmplitudePx: 1.4,
    breathePhaseSpread: 6.28,
    // Walking sway: subtle pendulum rotation on a sprite while it lerps between
    // tiles, pivoting at the feet. Driven by the move's progress (0→1) rather than
    // wall-clock time, so the sprite is guaranteed upright at both the start and
    // end of every tile step. `walkSwayCycles` is the number of full sway cycles
    // per tile step (1 = straight→left→right→straight). amplitude in radians
    // (~0.09 ≈ 5°). Applied only to moving entities.
    entityWalkSway: true,
    walkSwayCycles: 1,
    walkSwayAmplitudeRad: 0.09,
    // Idle sway: a slow, low-amplitude weight-shift while an entity is stationary
    // (not moving, not mid-action, not working), mirroring the expedition view's
    // `expedIdleShift`. Driven by performance.now() so it stays smooth and runs
    // while paused; `seed` decorrelates each entity's phase. Gated by the same
    // `showWalkSway` setting (the sway family: moving → walk-sway, idle → shift).
    entityIdleSway: true,
    idleSwayPeriodMs: 2600,
    idleSwayRad: 0.02,           // ~1.1°, subtle weight-shift when stopped
    // Tree sway: slow ambient rotation of tree resource sprites about the trunk
    // base, driven by performance.now() (smooth, runs while paused). The cadence
    // shortens and the amplitude grows with a wind strength (0..1) derived from
    // the active weather, so trees barely stir when it's clear and whip during a
    // thunderstorm. A per-tile seed decorrelates phase; a slow gust envelope
    // makes the breeze wax and wane. Gated by the `showTreeSway` setting.
    // Composed in js/ui/entity-animation.js.
    treeSway: {
        enabled: true,
        calmPeriodMs: 4200,      // full sway cycle in still air
        stormPeriodMs: 1500,     // faster cycle at full wind
        calmSwayRad: 0.025,      // ~1.4° amplitude in still air
        stormSwayRad: 0.11,      // ~6.3° amplitude at full wind
        gustPeriodMs: 9000,      // slow envelope so the breeze surges and eases
        phaseSpread: 6.28,       // per-tile phase decorrelation (radians)
        // Wind strength (0..1) per weather type; lerps period/amplitude calm->storm.
        windByWeather: {
            clear: 0.12, rain: 0.4, thunderstorm: 1.0,
            snow: 0.3, blizzard: 0.9, heatwave: 0.08,
        },
    },
    // Animated terrain detail: optional decorative overlay sprites drawn on top of
    // bare terrain tiles (no structure/resource/floor/entity). Two kinds:
    //   * grass tufts on grass: sway side-to-side in the wind, sharing the tree
    //     wind model (windByWeather above) so the whole scene reacts together.
    //   * water waves on water: bob slowly up and down (rise/fall) with a gentle
    //     alpha shimmer, independent of wind (water motion is its own rhythm).
    // Both are procedural transforms on new `effects` sprites (`grass_tuft`,
    // `water_waves`); missing art simply skips the overlay. Per-tile seed
    // decorrelates phase. Driven by performance.now() (smooth, runs while paused).
    // Gated by the `showTerrainDetail` setting. Composed in entity-animation.js.
    terrainDetail: {
        enabled: true,
        // Grass tufts: side-to-side sway (rotation about the tuft base). Reuses the
        // tree wind (0..1); amplitude lerps calm->storm, cadence shortens with wind.
        grassCalmPeriodMs: 4600,
        grassStormPeriodMs: 1700,
        grassCalmSwayRad: 0.05,   // ~2.9deg in still air
        grassStormSwayRad: 0.22,  // ~12.6deg at full wind (lighter than a whole tree)
        grassPhaseSpread: 6.28,
        // Water waves: slow vertical bob (px) + subtle alpha shimmer. No wind term.
        waterPeriodMs: 3000,
        waterBobPx: 1.5,          // peak vertical rise/fall
        waterAlphaBase: 0.75,     // mean overlay opacity
        waterAlphaVar: 0.2,       // +/- shimmer about the base
        waterPhaseSpread: 6.28,
        // Crop/flower sway (farm zone tiles with a planted crop)
        cropCalmPeriodMs: 3800,
        cropStormPeriodMs: 1400,
        cropCalmSwayRad: 0.03,
        cropStormSwayRad: 0.10,
        // Submerged entities: instead of an `in_water` overlay on top, the lower
        // fraction of the sprite is clipped away so the entity looks partially under
        // water (the animated water waves drawn behind it show through the gap). The
        // waterline bobs gently with the same wave motion so entities appear to float.
        submergeFrac: 0.4,        // fraction of sprite height hidden below the waterline
        submergeBobPx: 1.0,       // peak waterline rise/fall (px) for the float effect
    },
    // Attack swing: a quick lunge-and-return rotation on an entity's sprite when
    // it lands (or attempts) a *basic* attack in expedition combat — NOT spells.
    // The combat model stamps `entity._lastAttackTick = game.tick` on each basic
    // attack; the expedition visual latches a tick change to a performance.now()
    // start and plays `sin(π·t)` over `attackSwingDurationMs`, so the sprite is
    // upright at both ends and leans toward its opponent at the peak. amplitude
    // in radians (~0.35 ≈ 20°, more pronounced than the walking sway).
    entityAttackSwing: true,
    attackSwingDurationMs: 320,
    attackSwingAmplitudeRad: 0.35,
    // Basic-attack motion is chosen per weapon via `weapon.attackAnim`, one of:
    //   'Swing': a rotation lunge toward the foe (swords, axes, maces).
    //   'Stab': a forward linear thrust then retract (spears, daggers).
    //   'DrawAndShoot': pull back, snap forward, and release a projectile
    //   (bows, crossbows, wands, staves). Enemies map their `ranged` flag to
    //   DrawAndShoot, else Swing.
    // The animation's duration is scaled by the attacker's attack-speed so fast
    // weapons play quick, snappy motions and slow/heavy weapons play drawn-out
    // ones (see `_atkAnimMult`, stamped on each combatant at combat start).
    attackStabThrustPx: 7,       // forward reach of a Stab thrust (px)
    attackAnimMinMult: 0.6,      // clamp: fastest animation is 0.6x base duration
    attackAnimMaxMult: 1.8,      // clamp: slowest animation is 1.8x base duration
    // ── In-world "action" animations ───────────────────────────────────────
    // Layered on the regular map renderer (NOT the expedition view). A single
    // per-entity one-shot slot resolves melee/ranged/cast/hit by priority (higher
    // wins; a new one-shot seizes the slot only if its priority >= the current
    // holder's — so a dramatic action isn't cancelled by a minor reaction). Work
    // is a continuous bob that blends only while the slot is free. All are gated
    // behind the single `showActionAnimations` setting; `enabled` here is a
    // config-level kill switch for tuning. Composed in js/ui/entity-animation.js,
    // mirroring the expedition `_composeEntityAnim` shape.
    entityActionAnim: {
        enabled: true,
        // Basic-attack motion class comes from the weapon's `attackAnim`
        // ('Swing' | 'Stab' | 'DrawAndShoot'), matching the expedition view. Swing
        // reuses attackSwingDurationMs / attackSwingAmplitudeRad above.
        meleeLungePx: 3,             // Swing: step-in toward the foe (px)
        stabThrustPx: 5,             // Stab: forward lunge reach toward the foe (px)
        // Fraction of a tile the melee attack effect (swing/stab) travels from the
        // attacker toward the target: it starts on the attacker and slides out to this
        // distance over `attackEffectTravelMs`, like a short-range projectile, then
        // vanishes (0 = stays on attacker, 1 = travels one tile toward the foe).
        attackEffectLeadFrac: 0.5,
        // Fraction of a tile the effect is already offset toward the target at the start
        // of its travel (prog=0), so it begins a bit ahead of the attacker's center
        // rather than on top of it (~0.25 = a quarter sprite out).
        attackEffectStartFrac: 0.3,
        // Travel time (ms) of the melee attack effect from attacker toward target,
        // driven by performance.now() and latched to the attack tick so it plays once
        // and briefly (independent of the coarser attack-shake tick window). The effect
        // fades out over the final `attackEffectFadeFrac` of this window.
        attackEffectTravelMs: 150,
        attackEffectFadeFrac: 0.4,
        rangedRecoilDurationMs: 260,
        rangedRecoilPx: 3,           // DrawAndShoot: pull-back / snap-forward reach (px)
        castDurationMs: 380,
        castThrustPx: 3,
        castRaisePx: 3,
        castPulseScale: 0.12,
        castWobbleRad: 0.08,
        castSquash: 0.1,
        // Per-school cast overlay effect keys (resolved with null fallback —
        // missing art simply skips the overlay). Keys authored in skin-editor.js.
        castOverlayKeys: {
            evocation: 'spell_evocation',
            abjuration: 'spell_abjuration',
            conjuration: 'spell_conjuration',
            enchantment: 'spell_enchantment',
            transmutation: 'spell_transmutation',
            divination: 'spell_divination',
        },
        workBobPeriodMs: 700,
        workBobPx: 2,
        workBobRotRad: 0.05,
        hitDurationMs: 240,
        hitRecoilPx: 3,
        hitSquash: 0.12,
        // One-shot slot priorities: higher wins, and a new one-shot replaces the
        // active holder only if its priority >= the holder's. cast == attack so a
        // fresh action restarts crisply; hit is lowest so being struck mid-action
        // doesn't cancel the swing/cast (it plays only when the slot is free).
        priority: { cast: 40, attack: 40, hit: 20 },
    },
    // ── Expedition "extra" animations ──────────────────────────────────────
    // A richer set of reaction/locomotion/combat/ambient animations layered on
    // the expedition visual. All are gated behind the single `showExpeditionExtras`
    // setting (one menu toggle); each keeps its own flag below for config-level
    // tuning/disable. They are composed per-entity through a channel model
    // (rot += , translate += , scale *= , alpha *=) with a priority-gated
    // one-shot slot so dramatic beats (death, enrage) aren't interrupted by
    // minor reactions (a hit recoil). See `_composeEntityAnim` in ui-arcane.js.
    //
    // One-shot priorities (higher wins; a new one-shot replaces the active one
    // only if its priority >= the active one's; death suppresses everything and
    // enrage/stomp suppresses ambient shivers too):
    expedAnimPriority: { death: 100, enrage: 60, crit: 50, attack: 40, cast: 40, dodge: 30, recoil: 20 },
    // Reactions to being hit
    expedHitRecoil: true,
    hitRecoilDurationMs: 260,
    hitRecoilPx: 4,              // knock-back distance away from the attacker
    expedDeathTopple: true,
    deathToppleDurationMs: 700,
    deathToppleRad: 1.4,         // ~80° topple to the ground
    expedDodgeHop: true,
    dodgeHopDurationMs: 240,
    dodgeHopPx: 6,               // vertical juke height
    // Locomotion polish
    expedFootstepBob: true,
    footstepBobPx: 1.6,          // vertical bob amplitude, synced to walk-sway phase
    expedTravelLean: true,
    travelLeanRad: 0.06,         // forward tilt at full travel speed
    expedIdleShift: true,
    idleShiftPeriodMs: 2600,
    idleShiftRad: 0.02,          // slow low-amplitude weight-shift when stopped
    // Combat feedback beyond basic attacks
    expedCastWindup: true,
    castWindupDurationMs: 360,
    castWindupPx: 3,             // pull-back (away from foe) before a spell fires
    expedCritEmphasis: true,
    critSwingAmplitudeRad: 0.6,  // stronger than a normal swing
    critPunchScale: 0.15,        // scale overshoot (1.15×) then settle
    expedEnrageStomp: true,
    enrageStompDurationMs: 520,
    enrageStompPx: 5,
    enrageStompScale: 0.2,       // scale-up punch on enrage / phase transition
    expedStatusBodyLanguage: true,
    statusShiverPx: 1.2,         // freeze shiver / stun wobble amplitude
    statusWobbleRad: 0.05,
    // Ambience & pacing
    expedLowHpLabored: true,
    lowHpThreshold: 0.3,         // below this hp ratio, breathing slows & deepens
    lowHpBreathMult: 2.2,        // amplitude multiplier at 0 hp ratio
    expedSummonScale: true,
    summonScaleDurationMs: 400,  // scale-in on arrival, scale-out handled by fade
    expedVictoryFlourish: true,
    victoryFlourishRad: 0.5,     // per-entity weapon-raise tilt during celebration
    expedLootArc: true,          // loot effect arcs toward the party instead of dropping in place
    healthBarGreenThreshold: 0.5,
    healthBarYellowThreshold: 0.25,
    healthBarColors: { green: '#00ff00', yellow: '#ffaa00', red: '#ff3333' },
    buildGridColor: 'rgba(255, 140, 0, 1)',
};

export const COMBAT_VISUALS = {
    hitChar: '!',
    hitColor: '#ffff00',
    hitTtl: 2,
    damageTakenColor: '#ff3333',
    nexusDamageColor: '#9933ff',
    structureDamageColor: '#ff8800',
    portalChar: 'Ø',
    portalColor: '#ff55ff',
    portalBg: '#440044',
    portalPathColor: '#663388',
    portalPathBg: '#1a001a',
    shotColorArcane: '#ff4444',
    shotColorVoid: '#cc00ff',
    spellHealChar: '+',
    spellHealColor: '#44ff44',
    spellBuffChar: '>',
    spellBuffColor: '#88ffff',
    spellShieldChar: 'O',
    spellShieldColor: '#4488ff',
    spellTeleportChar: '@',
    spellTeleportColor: '#33ccff',
    spellGrowthChar: '%',
    spellGrowthColor: '#44ff44',
    spellTerraformChar: '.',
    spellTerraformColor: '#88ff88',
    spellDivinationChar: '?',
    spellDivinationColor: '#ccaaff',
    spellRangePreviewBg: '#1a0033',
    magicLevelUpChar: '★',
    magicLevelUpTtl: 5,
    dmgFlashTtl: 2,
    dmgFlashColor: '#ff2222',
    dmgFlashAlpha: 0.4,
    atkShakeTtl: 2,
    atkShakePx: 2,
    spellCastChar: '◇',
    spellCastColor: '#cc88ff',
    projectileSpeed: 12,
    projectileChar: '•',
    craftCompleteChar: '✧',
    craftCompleteColor: '#ffcc44',
    craftCompleteTtl: 4,
    needCriticalChar: '!',
    needCriticalColor: '#ff4444',
    needCriticalTtl: 6,
    sleepChar: 'z',
    sleepColor: '#6688cc',
    sleepTtl: 8,
    healthRegenChar: '♥',
    healthRegenColor: '#66ff66',
    healthRegenTtl: 2,
    healTickChar: '+',
    healTickColor: '#44ff44',
    healTickTtl: 2,
    researchCompleteChar: '!',
    researchCompleteColor: '#44ffff',
    researchCompleteTtl: 6,
    buildCompleteChar: '✓',
    buildCompleteColor: '#ffffff',
    buildCompleteTtl: 4,
    harvestChar: '⌂',
    harvestColor: '#66cc44',
    harvestTtl: 3,
    mentalBreakChar: '☠',
    mentalBreakColor: '#cc2222',
    mentalBreakTtl: 8,
    freezingChar: '~',
    freezingColor: '#88ddff',
    freezingTtl: 4,
    mineDustChar: '·',
    mineDustColor: '#999999',
    mineDustTtl: 2,
    shieldBlockChar: '○',
    shieldBlockColor: '#4488ff',
    shieldBlockTtl: 3,
    manaRegenChar: '∴',
    manaRegenColor: '#aa66ff',
    manaRegenTtl: 2,
    deathChar: '☠',
    deathColor: '#ffffff',
    deathTtl: 10,
    summonArriveChar: '◊',
    summonArriveColor: '#cc44ff',
    summonArriveTtl: 5,
    lootDropChar: '$',
    lootDropColor: '#ffdd44',
    lootDropTtl: 5,
    fireIgniteChar: '^',
    fireIgniteColor: '#ff6600',
    fireIgniteTtl: 3,
    waveAlertTtl: 8,
    waveAlertColor: '#ff2222',
    golemActivateChar: '⚡',
    golemActivateColor: '#44ffff',
    golemActivateTtl: 6,
    xpGainChar: '·',
    xpGainColor: '#88ff88',
    xpGainTtl: 1,
    smiteChar: '✝',
};

export const LOG_COLORS = {
    danger: '#ff5555',
    combat: '#ff8844',
    success: '#88ff88',
    loot: '#ffcc44',
    ambient: '#777777',
    default: '#aaddff',
};

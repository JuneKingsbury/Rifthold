import { stampLoc } from '../i18n.js';

import { BUILDINGS } from './buildings.js';
import { RECIPES } from './equipment.js';
import { CROPS } from './world.js';

export const MAGIC_SKILLS = {
    evocation:     { baseLevel: [0, 0], biasBonus: 2, color: '#ff6644' },
    enchantment:   { baseLevel: [0, 0], biasBonus: 2, color: '#88ffff' },
    abjuration:    { baseLevel: [0, 0], biasBonus: 2, color: '#44ff44' },
    conjuration:   { baseLevel: [0, 0], biasBonus: 2, color: '#9966ff' },
    transmutation: { baseLevel: [0, 0], biasBonus: 2, color: '#88ff88' },
    divination:    { baseLevel: [0, 0], biasBonus: 2, color: '#ccaaff' },
};
stampLoc(MAGIC_SKILLS, 'magic_skill');

export const MANA_CONFIG = {
    baseMana: 20,
    manaPerMagicLevel: 5,
    // Mana pool is driven by the colonist's HIGHEST school. Levels in other schools
    // contribute only at manaFocusFactor of the rate. This makes focusing one school
    // grow the pool faster than spreading levels across many.
    manaFocusFactor: 0.5,
    baseRegen: 0.05,
    regenPerMagicLevel: 0.01,
    regenWhileIdle: 2.0,
    regenWhileSleeping: 3.0,
};

// Mana grid supply order. When generation falls short, consumers are powered
// tier by tier and whatever no longer fits goes dark, instead of the whole grid
// failing at once. Mana relays are always powered first because their discount
// changes everyone else's cost. A tile can override its building's default tier
// (tile.powerPriority).
export const POWER_PRIORITY = {
    tiers: ['high', 'normal', 'low'],
    labels: { high: 'High', normal: 'Normal', low: 'Low' },
    defaultTier: 'normal',
    byBuilding: {
        arcane_sentinel: 'high', void_turret: 'high', inferno_ward: 'high',
        ember_heater: 'high',
        glowstone: 'low', beacon: 'low',
    },
};

// Pedestal overcharge levels (tile.pedestalCharge indexes into levels). Each
// level multiplies the trinket's mana cost. Fractional effects scale by
// strength, *Mult effects scale their distance from 1, whole-number bonuses
// gain flatBonus and finite radii grow by radiusBonus. Colony-wide trinkets
// stop at maxGlobalLevel so global effects don't snowball.
export const PEDESTAL_CHARGE = {
    levels: [
        { color: '#ccaa44', costMult: 1, strength: 1,   flatBonus: 0, radiusBonus: 0 },
        { color: '#ffcc55', costMult: 2, strength: 1.5, flatBonus: 1, radiusBonus: 2 },
        { color: '#ffee99', costMult: 3, strength: 2,   flatBonus: 2, radiusBonus: 4 },
    ],
    maxGlobalLevel: 1,
    flatKeys: ['harvestYieldBonus', 'craftOutputBonus', 'cookingBonusFood'],
    radiusKeys: ['lightRadius'],
    caps: { blightDamageReduction: 0.9 },
};
stampLoc({ pedestal: PEDESTAL_CHARGE }, 'config');

export const SPELLS = {
    // Evocation
    spark: { school: 'evocation', minLevel: 0, manaCost: 4, cooldown: 25, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 6, range: 4, projectileColor: '#ffaa33', projectileChar: '.' },
    singe: { school: 'evocation', minLevel: 1, manaCost: 5, cooldown: 35, castType: 'auto', trigger: 'inCombat', effect: 'dot_burn', damage: 4, burnDuration: 45, burnRounds: 3, range: 5, projectileColor: '#ff6600', projectileChar: '~' },
    magic_missile: { school: 'evocation', minLevel: 2, manaCost: 8, cooldown: 30, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 15, range: 6, projectileColor: '#ff44ff', projectileChar: '*' },
    hex_bolt: { school: 'evocation', minLevel: 2, manaCost: 9, cooldown: 40, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_hex', damage: 10, hexDamageMult: 1.2, hexDuration: 60, hexRounds: 3, range: 5, projectileColor: '#cc44ff', projectileChar: '⁕' },
    smite: { school: 'evocation', minLevel: 1, manaCost: 6, cooldown: 20, castType: 'auto', trigger: 'inCombat', effect: 'melee_damage', damage: 12, range: 1, projectileColor: '#ffffaa', projectileChar: '✝' },
    fireball: { school: 'evocation', minLevel: 5, manaCost: 18, cooldown: 60, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_aoe', damage: 12, range: 7, radius: 3, projectileColor: '#ff6600', projectileChar: '●' },
    // Chain Lightning arcs from the primary target to nearby foes, each arc dealing
    // chainFalloff× the previous hit's damage. chainTargets counts the primary hit.
    chain_lightning: { school: 'evocation', minLevel: 4, manaCost: 14, cooldown: 45, castType: 'auto', trigger: 'inCombat', effect: 'chain_damage', damage: 11, range: 6, chainTargets: 3, chainFalloff: 0.6, chainRange: 4, projectileColor: '#88ddff', projectileChar: '⚡' },
    arcane_blast: { school: 'evocation', minLevel: 3, manaCost: 10, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'knockback', damage: 8, knockbackDist: 2, stunDuration: 20, stunRounds: 1, range: 2, projectileColor: '#aaaaff', projectileChar: '◎' },
    // Frost Lance deals damage and slows the target (movement + attack cadence). Slow is
    // soft CC: slowMult scales speed in the colony, slowRounds skips no turn but adds a
    // "slowed" status in expeditions that reduces the enemy's attacks that round.
    frost_lance: { school: 'evocation', minLevel: 3, manaCost: 12, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_slow', damage: 12, range: 6, slowMult: 0.5, slowDuration: 60, slowRounds: 2, projectileColor: '#aaddff', projectileChar: '❄' },

    // Abjuration
    mend: { school: 'abjuration', minLevel: 0, manaCost: 4, cooldown: 60, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.5, effect: 'heal', healAmount: 8, range: 4 },
    renewal: { school: 'abjuration', minLevel: 3, manaCost: 10, cooldown: 90, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.6, effect: 'heal', healAmount: 28, range: 6 },
    shield: { school: 'abjuration', minLevel: 4, manaCost: 15, cooldown: 150, castType: 'auto', trigger: 'inCombat', effect: 'buff_defense', expeditionTarget: 'tank', damageReduction: 0.3, duration: 60, radius: 4 },
    // Chain Heal is the abjuration counterpart to Chain Lightning: it mends the most
    // wounded ally, then bounces to further wounded allies, each bounce healing
    // chainFalloff× the previous. chainTargets counts the primary heal.
    chain_heal: { school: 'abjuration', minLevel: 5, manaCost: 13, cooldown: 100, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.7, effect: 'chain_heal', healAmount: 16, range: 6, chainTargets: 3, chainFalloff: 0.6, chainRange: 5 },
    fortify: { school: 'abjuration', minLevel: 2, manaCost: 8, cooldown: 100, castType: 'auto', trigger: 'inCombat', effect: 'buff_defense_self', damageReduction: 0.25, duration: 80 },
    // Mending Aura pulses a small heal-over-time to nearby wounded allies each cast.
    mending_aura: { school: 'abjuration', minLevel: 2, manaCost: 8, cooldown: 120, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.8, effect: 'heal_aura', healPerRound: 4, auraRounds: 3, healPerTick: 0.12, range: 5, duration: 90 },
    // Cleanse strips harmful statuses (bleed/poison/burn/slow/debuff DoTs) from the most
    // afflicted ally in range. Fires whenever an ally nearby is suffering a debuff.
    cleanse: { school: 'abjuration', minLevel: 1, manaCost: 8, cooldown: 50, castType: 'auto', trigger: 'debuffNearby', effect: 'cleanse', range: 6 },
    // Guardian Ward grants a flat HP absorb-shield bubble that soaks damage before HP.
    // Scales with school mastery. Distinct from Shield's percentage damage reduction.
    guardian_ward: { school: 'abjuration', minLevel: 3, manaCost: 16, cooldown: 140, castType: 'auto', trigger: 'inCombat', effect: 'absorb_shield', absorbAmount: 30, duration: 120, radius: 4 },

    // Enchantment
    quicken: { school: 'enchantment', minLevel: 0, manaCost: 6, cooldown: 80, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', moveSpeedBonus: 0, workSpeedBonus: 0.2, duration: 40, radius: 3 },
    haste: { school: 'enchantment', minLevel: 2, manaCost: 12, cooldown: 200, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', expeditionAttackSpeed: 0.2, expeditionRounds: 4, moveSpeedBonus: 0.4, workSpeedBonus: 0.2, duration: 80, idleExclude: true, radius: 5 },
    // Diligence: aura that improves craft/build quality odds for working allies (read in
    // task-executor applyQuality via a 'quality' activeEffect). Fires while working.
    diligence: { school: 'enchantment', minLevel: 1, manaCost: 8, cooldown: 120, castType: 'auto', trigger: 'hasTask', effect: 'buff_quality', qualityBonus: 3, duration: 150, radius: 4 },
    // Tireless: slows rest-need decay for allies (read in updateNeeds via a 'rest' effect).
    tireless: { school: 'enchantment', minLevel: 2, manaCost: 12, cooldown: 300, castType: 'auto', trigger: 'always', effect: 'buff_rest', restDecayMult: 0.4, duration: 300, idleExclude: true, radius: 5 },
    // Mind Shroud clouds nearby enemies' senses, granting the caster a chance to evade
    // incoming attacks (dodge charges in expedition; evasion aura in colony).
    mind_shroud: { school: 'enchantment', minLevel: 3, manaCost: 11, cooldown: 120, castType: 'auto', trigger: 'inCombat', effect: 'buff_miss_chance', expeditionTarget: 'tank', dodgeBonus: 0.25, dodgeRounds: 2, duration: 80 },
    // Mesmerize: brief stun/pacify on a foe (skips its turn / freezes it). Light CC.
    mesmerize: { school: 'enchantment', minLevel: 3, manaCost: 12, cooldown: 90, castType: 'auto', trigger: 'inCombat', effect: 'stun', range: 6, stunDuration: 45, stunRounds: 1, projectileColor: '#ffccff', projectileChar: '✦' },

    inspire: { school: 'enchantment', minLevel: 4, manaCost: 14, cooldown: 250, castType: 'auto', trigger: 'hasTask', effect: 'buff_inspire', workSpeedBonus: 0.3, qualityBonus: 4, duration: 120, radius: 5, inspireRounds: 3 },
    // Spellbind enthralls an enemy mind, compelling it to stand down. In expeditions
    // this is resolved as a powerful stun (full mind-control is out of scope there).
    spellbind: { school: 'enchantment', minLevel: 5, manaCost: 18, cooldown: 300, castType: 'auto', trigger: 'inCombat', effect: 'convert_enemy', bindRounds: 2, charmDuration: 120, range: 6, projectileColor: '#ffccff', projectileChar: '◈' },

    // Conjuration
    phase_step: { school: 'conjuration', minLevel: 0, manaCost: 6, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'teleport', range: 5 },
    // Conjure Decoy spawns a short-lived illusory construct that draws enemy attacks.
    // In expeditions enemies strongly prefer targeting it over party members.
    conjure_decoy: { school: 'conjuration', minLevel: 1, manaCost: 10, cooldown: 200, castType: 'auto', trigger: 'inCombat', effect: 'summon_decoy', summonType: 'decoy' },
    summon_familiar: { school: 'conjuration', minLevel: 1, manaCost: 10, cooldown: 250, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'familiar' },
    warp: { school: 'conjuration', minLevel: 2, manaCost: 15, cooldown: 100, castType: 'targeted', effect: 'teleport', range: 15 },
    summon_ghost: { school: 'conjuration', minLevel: 3, manaCost: 15, cooldown: 200, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'ghost' },
    gate: { school: 'conjuration', minLevel: 4, manaCost: 25, cooldown: 200, castType: 'targeted', effect: 'teleport', range: 30 },
    summon_monster: { school: 'conjuration', minLevel: 5, manaCost: 25, cooldown: 400, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'monster' },
    // Spectral Swarm conjures several weak, short-lived skirmishers at once (vs. the single
    // summon of the other conjuration spells). swarmCount uses the spectral_wisp entity.
    spectral_swarm: { school: 'conjuration', minLevel: 3, manaCost: 22, cooldown: 350, castType: 'auto', trigger: 'inCombat', effect: 'summon_swarm', summonType: 'spectral_wisp', swarmCount: 3 },

    // Transmutation
    nurture: { school: 'transmutation', minLevel: 0, manaCost: 8, cooldown: 600, castType: 'auto', trigger: 'cropsNearby', effect: 'boost_crops', range: 5, radius: 1, growthMult: 1.5, duration: 100 },
    // Enrich Soil applies a permanent per-tile growth bonus to a farm tile. Unlike
    // Nurture's temporary boost, this modifier persists across seasons.
    enrich_soil: { school: 'transmutation', minLevel: 1, manaCost: 12, cooldown: 1200, castType: 'targeted', effect: 'enrich_soil', range: 8, growthBonus: 0.15 },
    circle_of_growth: { school: 'transmutation', minLevel: 2, manaCost: 20, cooldown: 1200, castType: 'auto', trigger: 'cropsNearby', effect: 'boost_crops', range: 10, radius: 3, growthMult: 2.0, duration: 200 },
    level_field: { school: 'transmutation', minLevel: 4, manaCost: 30, cooldown: 600, castType: 'targeted', effect: 'terraform', range: 8, radius: 3, targetTerrain: 'grass' },
    // Stone Shape instantly completes a targeted construction (build task) or repairs a
    // damaged structure, matter shaped to will. Targeted so the player picks the tile.
    stone_shape: { school: 'transmutation', minLevel: 2, manaCost: 18, cooldown: 200, castType: 'targeted', effect: 'finish_construction', range: 12 },
    // Transmutation alchemy of the colony's stores, split into three tiers that each
    // auto-cast (trigger 'canTransmute') only when the conversion is actually possible,
    // i.e. enough of the input material is stockpiled. A missing `fromResource` means the
    // output is conjured from nothing (Transmute Stone). Cheaper/faster at the low tier,
    // costlier/slower and stingier at the high tier so runite stays scarce.
    transmute_stone: { school: 'transmutation', minLevel: 1, manaCost: 10, cooldown: 200, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', toResource: 'stone', outputAmount: 8 },
    transmute_iron: { school: 'transmutation', minLevel: 3, manaCost: 18, cooldown: 300, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', fromResource: 'stone', inputAmount: 10, toResource: 'iron_ore', outputAmount: 6 },
    transmute_runite: { school: 'transmutation', minLevel: 5, manaCost: 28, cooldown: 500, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', fromResource: 'iron', inputAmount: 8, toResource: 'runite', outputAmount: 2 },
    // Verdant Bloom instantly ripens all mature growing crops in radius (sets them ready to
    // harvest). Targeted burst of growth, the payoff transmutation capstone for farms.
    verdant_bloom: { school: 'transmutation', minLevel: 4, manaCost: 28, cooldown: 500, castType: 'targeted', effect: 'ripen_crops', range: 10, radius: 3, ripenThreshold: 0.5 },

    // Divination
    foresight: { school: 'divination', minLevel: 0, manaCost: 6, cooldown: 300, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { raidDelay: 200 }, duration: 300 },
    augury: { school: 'divination', minLevel: 1, manaCost: 7, cooldown: 400, castType: 'auto', trigger: 'always', effect: 'buff_morale', happinessBonus: 6, duration: 400, radius: 6 },
    // Ill Omen hexes a nearby enemy with bad fortune, reducing its outgoing damage.
    // Uses the existing weaken status in expedition combat.
    ill_omen: { school: 'divination', minLevel: 2, manaCost: 8, cooldown: 90, castType: 'auto', trigger: 'inCombat', effect: 'debuff_accuracy', weakenMult: 0.7, weakenDuration: 90, weakenRounds: 3, range: 6, projectileColor: '#884488', projectileChar: '☽' },
    fair_winds: { school: 'divination', minLevel: 2, manaCost: 10, cooldown: 400, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { weatherBias: 'clear' }, duration: 200 },
    merchants_omen: { school: 'divination', minLevel: 3, manaCost: 15, cooldown: 600, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'caravan', eventMult: 3.0 }, duration: 400 },
    ward_of_calamity: { school: 'divination', minLevel: 4, manaCost: 20, cooldown: 800, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { suppressEvents: ['blight_bloom', 'cold_snap'], blightSpreadSuppressed: true }, duration: 500 },
    fortunate_discovery: { school: 'divination', minLevel: 5, manaCost: 25, cooldown: 1000, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'meteorite', eventMult: 5.0 }, duration: 600 },
};
stampLoc(SPELLS, 'spell');

// Player-triggered rituals: on-demand invocations performed at a Grand Ritual
// altar (a complex structure). Unlike passive complex structures and auto-cast
// spells, the player fires these directly for a reagent cost to get a big
// one-shot effect, then waits out a long cooldown (in ticks). Each entry:
//   name/description  - UI copy.
//   icon/color        - UI glyph and tone.
//   cost              - reagents deducted from the stockpile on cast.
//   cooldown          - ticks before this ritual can be cast again.
//   effect            - dispatch key handled in main.js triggerRitual.
//   ...params         - effect-specific tuning consumed by that handler.
// Consumed by complexBuildings.js (altar detection) and main.js (triggerRitual).
export const RITUALS = {
    rite_of_mending: {
        icon: '✚', color: '#66dd88',
        cost: { void_essence: 3, moonbloom: 4 },
        cooldown: 3000,
        effect: 'mass_heal',
    },
    rite_of_calm_skies: {
        icon: '☀', color: '#ffdd66',
        cost: { void_essence: 2, runite: 2 },
        cooldown: 2400,
        effect: 'weather_bias', weatherBias: 'clear', duration: 600,
    },
    rite_of_warding: {
        icon: '⛨', color: '#88bbff',
        cost: { void_essence: 4, runite: 3 },
        cooldown: 3600,
        effect: 'raid_ward', raidDelay: 1200,
    },
    rite_of_abundance: {
        icon: '❀', color: '#88ff88',
        cost: { void_essence: 3, moonbloom: 3 },
        cooldown: 3000,
        effect: 'ripen_crops', growthGain: 0.5,
    },
};
stampLoc(RITUALS, 'ritual');

export const SPELL_TOMES = {
    // Evocation
    tome_of_spark: { tradeValue: 12, spell: 'spark', learningWork: 60, minSchoolLevel: 0 },
    tome_of_singe: { tradeValue: 18, spell: 'singe', learningWork: 90, minSchoolLevel: 1 },
    tome_of_smite: { tradeValue: 22, spell: 'smite', learningWork: 120, minSchoolLevel: 1 },
    tome_of_magic_missile: { tradeValue: 28, spell: 'magic_missile', learningWork: 150, minSchoolLevel: 2 },
    tome_of_hex_bolt: { tradeValue: 28, spell: 'hex_bolt', learningWork: 150, minSchoolLevel: 2 },
    tome_of_arcane_blast: { tradeValue: 38, spell: 'arcane_blast', learningWork: 200, minSchoolLevel: 3 },
    tome_of_frost_lance: { tradeValue: 40, spell: 'frost_lance', learningWork: 240, minSchoolLevel: 3 },
    tome_of_chain_lightning: { tradeValue: 44, spell: 'chain_lightning', learningWork: 260, minSchoolLevel: 4 },
    tome_of_fireball: { tradeValue: 58, spell: 'fireball', learningWork: 350, minSchoolLevel: 5 },

    // Abjuration
    tome_of_mend: { tradeValue: 12, spell: 'mend', learningWork: 60, minSchoolLevel: 0 },
    tome_of_cleanse: { tradeValue: 20, spell: 'cleanse', learningWork: 110, minSchoolLevel: 1 },
    tome_of_fortify: { tradeValue: 28, spell: 'fortify', learningWork: 140, minSchoolLevel: 2 },
    tome_of_mending_aura: { tradeValue: 30, spell: 'mending_aura', learningWork: 160, minSchoolLevel: 2 },
    tome_of_renewal: { tradeValue: 40, spell: 'renewal', learningWork: 230, minSchoolLevel: 3 },
    tome_of_guardian_ward: { tradeValue: 46, spell: 'guardian_ward', learningWork: 280, minSchoolLevel: 3 },
    tome_of_shield: { tradeValue: 52, spell: 'shield', learningWork: 320, minSchoolLevel: 4 },
    tome_of_chain_heal: { tradeValue: 54, spell: 'chain_heal', learningWork: 330, minSchoolLevel: 5 },

    // Enchantment
    tome_of_quicken: { tradeValue: 12, spell: 'quicken', learningWork: 60, minSchoolLevel: 0 },
    tome_of_diligence: { tradeValue: 22, spell: 'diligence', learningWork: 120, minSchoolLevel: 1 },
    tome_of_haste: { tradeValue: 45, spell: 'haste', learningWork: 280, minSchoolLevel: 2 },
    tome_of_tireless: { tradeValue: 38, spell: 'tireless', learningWork: 220, minSchoolLevel: 2 },
    tome_of_mind_shroud: { tradeValue: 38, spell: 'mind_shroud', learningWork: 210, minSchoolLevel: 3 },
    tome_of_mesmerize: { tradeValue: 40, spell: 'mesmerize', learningWork: 240, minSchoolLevel: 3 },
    tome_of_inspire: { tradeValue: 52, spell: 'inspire', learningWork: 300, minSchoolLevel: 4 },
    tome_of_spellbind: { tradeValue: 70, spell: 'spellbind', learningWork: 460, minSchoolLevel: 5 },

    // Conjuration
    tome_of_phase_step: { tradeValue: 12, spell: 'phase_step', learningWork: 60, minSchoolLevel: 0 },
    tome_of_conjure_decoy: { tradeValue: 20, spell: 'conjure_decoy', learningWork: 100, minSchoolLevel: 1 },
    tome_of_summon_familiar: { tradeValue: 24, spell: 'summon_familiar', learningWork: 120, minSchoolLevel: 1 },
    tome_of_warp: { tradeValue: 38, spell: 'warp', learningWork: 230, minSchoolLevel: 2 },
    tome_of_summon_ghost: { tradeValue: 70, spell: 'summon_ghost', learningWork: 440, minSchoolLevel: 3 },
    tome_of_spectral_swarm: { tradeValue: 56, spell: 'spectral_swarm', learningWork: 340, minSchoolLevel: 3 },
    tome_of_gate: { tradeValue: 38, spell: 'gate', learningWork: 440, minSchoolLevel: 4 },
    tome_of_summon_monster: { tradeValue: 70, spell: 'summon_monster', learningWork: 650, minSchoolLevel: 5 },

    // Transmutation
    tome_of_nurture: { tradeValue: 12, spell: 'nurture', learningWork: 60, minSchoolLevel: 0 },
    tome_of_enrich_soil: { tradeValue: 20, spell: 'enrich_soil', learningWork: 100, minSchoolLevel: 1 },
    tome_of_transmute_stone: { tradeValue: 30, spell: 'transmute_stone', learningWork: 180, minSchoolLevel: 1 },
    tome_of_stone_shape: { tradeValue: 44, spell: 'stone_shape', learningWork: 260, minSchoolLevel: 2 },
    tome_of_circle_of_growth: { tradeValue: 40, spell: 'circle_of_growth', learningWork: 240, minSchoolLevel: 2 },
    tome_of_transmute_iron: { tradeValue: 50, spell: 'transmute_iron', learningWork: 300, minSchoolLevel: 3 },
    tome_of_level_field: { tradeValue: 70, spell: 'level_field', learningWork: 440, minSchoolLevel: 4 },
    tome_of_verdant_bloom: { tradeValue: 66, spell: 'verdant_bloom', learningWork: 420, minSchoolLevel: 4 },
    tome_of_transmute_runite: { tradeValue: 68, spell: 'transmute_runite', learningWork: 420, minSchoolLevel: 5 },

    // Divination
    tome_of_foresight: { tradeValue: 12, spell: 'foresight', learningWork: 60, minSchoolLevel: 0 },
    tome_of_augury: { tradeValue: 18, spell: 'augury', learningWork: 90, minSchoolLevel: 1 },
    tome_of_fair_winds: { tradeValue: 28, spell: 'fair_winds', learningWork: 150, minSchoolLevel: 2 },
    tome_of_ill_omen: { tradeValue: 28, spell: 'ill_omen', learningWork: 150, minSchoolLevel: 2 },
    tome_of_merchants_omen: { tradeValue: 40, spell: 'merchants_omen', learningWork: 240, minSchoolLevel: 3 },
    tome_of_ward_of_calamity: { tradeValue: 58, spell: 'ward_of_calamity', learningWork: 350, minSchoolLevel: 4 },
    tome_of_fortunate_discovery: { tradeValue: 70, spell: 'fortunate_discovery', learningWork: 440, minSchoolLevel: 5 },
};
stampLoc(SPELL_TOMES, 'item');

export const RESEARCH_TABS = [
    { key: 'foundations' },
    { key: 'nature' },
    { key: 'mana' },
    { key: 'crafting' },
    { key: 'magic' },
    { key: 'rifts' },
];
stampLoc(RESEARCH_TABS, 'research_tab');

export const RESEARCH = {
    // Foundations
    runecraft: { cost: 80, requires: [], tab: 'foundations'},
    metalworking: { cost: 100, requires: [], tab: 'foundations' },
    ley_channeling: { cost: 175, requires: ['runecraft', 'metalworking'], tab: 'mana', requiresBuildings: { anvil: 1 } },
    alchemy: { cost: 150, requires: ['runecraft'], tab: 'foundations' },
    trade_routes: { cost: 300, requires: ['alchemy'], tab: 'foundations' },
    domestic_alchemy: { cost: 280, requires: ['alchemy'], tab: 'foundations' },
    battle_brewing: { cost: 500, requires: ['domestic_alchemy', 'herbalism'], tab: 'foundations' },

    // Wildlife
    beast_binding: { cost: 280, requires: [], tab: 'nature' },
    pack_binding: { cost: 350, requires: ['husbandry'], tab: 'nature' },
    husbandry: { cost: 350, requires: ['beast_binding'], tab: 'nature' },
    wolf_mastery: { cost: 350, requires: ['pack_binding'], tab: 'nature' },
    textiles: { cost: 150, requires: [], tab: 'nature' },
    irrigation: { cost: 250, requires: ['textiles'], tab: 'nature' },
    herbalism: { cost: 350, requires: ['alchemy', 'irrigation'], tab: 'nature' },
    verdant_growth: { cost: 500, requires: ['herbalism'], tab: 'nature' },

    // Crafting
    marksmanship: { cost: 250, requires: ['runecraft', 'metalworking'], tab: 'crafting' },
    arcane_implements: { cost: 250, requires: ['runecraft'], tab: 'crafting' },
    artisans_touch: { cost: 450, requires: ['marksmanship'], tab: 'crafting' },
    runeforging: { cost: 350, requires: ['arcane_infusion', 'arcane_implements', 'warrior_training'], tab: 'crafting' },
    masterwork: { cost: 800, requires: ['runeforging', 'arcane_infusion', 'artisans_touch'], tab: 'crafting', requiresBuildings: { enchanting_table: 1 }, requiresMilestone: { stat: 'superiorItemsCrafted', min: 1 }, requiresTabCount: 3 },
    golem_craft: { cost: 1000, requires: ['arcane_infusion', 'void_forging', 'mana_reservoir'], tab: 'crafting', requiresBuildings: { enchanting_table: 1 }, requiresTabCount: 3 },

    // Spells
    arcane_studies: { cost: 100, requires: ['runecraft'], tab: 'magic' },
    arcane_infusion: { cost: 300, requires: ['arcane_studies', 'ley_channeling', 'alchemy'], tab: 'magic', requiresBuildings: { mana_crystal: 2 } },
    advanced_arcana: { cost: 550, requires: ['arcane_infusion'], tab: 'magic', requiresBuildings: { scriptorium: 1 } },
    ritual_magic: { cost: 600, requires: ['advanced_arcana'], tab: 'magic' },
    void_sorcery: { cost: 600, requires: ['advanced_arcana'], tab: 'magic', requiresTabCount: 2 },
    mana_weaving: { cost: 650, requires: ['arcane_infusion', 'textiles'], tab: 'magic', requiresTabCount: 3 },
    void_weaving: { cost: 700, requires: ['mana_weaving', 'void_forging'], tab: 'magic' },

    // Mana
    luminance: { cost: 200, requires: ['ley_channeling'], tab: 'mana' },
    brilliance: { cost: 500, requires: ['ember_magic'], tab: 'mana', requiresTabCount: 3 },
    arcane_conduits: { cost: 400, requires: ['ley_channeling'], tab: 'mana' },
    ember_magic: { cost: 250, requires: ['luminance'], tab: 'mana' },
    mana_reservoir: { cost: 600, requires: ['arcane_conduits'], tab: 'mana', requiresTabCount: 3 },
    pyroclasm: { cost: 750, requires: ['ember_magic'], tab: 'mana', requiresTabCount: 3 },

    // Rifts
    warrior_training: { cost: 150, requires: ['metalworking'], tab: 'crafting' },
    warding: { cost: 250, requires: ['runecraft'], tab: 'rifts' },
    fortification: { cost: 350, requires: ['warding', 'metalworking'], tab: 'rifts' },
    void_summoning: { cost: 550, requires: ['ley_channeling'], tab: 'rifts', requiresMilestone: { stat: 'raidsDefeated', min: 1 } },
    void_architecture: { cost: 400, requires: ['fortification'], tab: 'rifts' },
    void_forging: { cost: 750, requires: ['void_summoning', 'runeforging'], tab: 'crafting', requiresTabCount: 3 },
    planar_rift: { cost: 300, requires: ['arcane_infusion'], tab: 'rifts' },
    auto_expedition: { cost: 600, requires: ['planar_rift'], tab: 'rifts', requiresMilestone: { stat: 'expeditionsCompleted', min: 1 }, },
    auto_expedition_ii: { cost: 1000, requires: ['auto_expedition'], tab: 'rifts' },
    auto_expedition_iii: { cost: 1600, requires: ['auto_expedition_ii'], tab: 'rifts' },
    abyss_smithing: { cost: 900, requires: ['void_forging'], tab: 'crafting', requiresMilestone: { stat: 'expeditionsCompleted', min: 5 } },
};
stampLoc(RESEARCH, 'research');

export const DEMO_LOCKED_RESEARCH = new Set([
    'advanced_arcana', 'void_sorcery', 'masterwork', 'golem_craft', 'mana_weaving',
    'mana_reservoir', 'brilliance', 'pyroclasm', 'void_architecture',
    'void_forging', 'void_weaving', 'auto_expedition_ii'
]);

// Auto-derive unlocks from the 'research' field on buildings, recipes, and crops.
for (const [key, tech] of Object.entries(RESEARCH)) {
    tech.unlocks = { buildings: [], recipes: [], crops: [] };
}
for (const [name, b] of Object.entries(BUILDINGS)) {
    if (b.research && RESEARCH[b.research]) RESEARCH[b.research].unlocks.buildings.push(name);
}
for (const [name, r] of Object.entries(RECIPES)) {
    if (r.research && RESEARCH[r.research]) RESEARCH[r.research].unlocks.recipes.push(name);
}
for (const [name, c] of Object.entries(CROPS)) {
    if (c.research && RESEARCH[c.research]) RESEARCH[c.research].unlocks.crops.push(name);
}

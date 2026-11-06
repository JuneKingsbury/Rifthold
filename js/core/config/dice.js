import { stampLoc, t } from '../i18n.js';

export const DICE_CONFIG = {
    numDice: 5,
    rollsPerRound: 3,
    antesPerRun: 8,
    roundsPerAnte: 3,
    maxModifiers: 4,
    maxRelics: 3,
    minDice: 3,
    maxDice: 7,

    // Base ante threshold (Fd needed to clear), scaled by 1.6x per ante
    anteBaseThreshold: 8,
    anteScaling: 1.6,

    // Fd reward: base for clearing a round (multiplied by ante number)
    roundClearReward: 6,

    // Fraction of earnedFd returned on run failure
    failureReturnRate: 0.3,

    // Scoring: chips (addition) and mult (multiplier).
    // Chance falls back to sum-of-dice chips with x1 mult.
    // Final Fd = chips * mult.
    scoring: [
        { key: 'void_convergence', chips: 60, mult: 8  },
        { key: 'shard_straight',   chips: 30, mult: 5  },
        { key: 'void_bloom',       chips: 30, mult: 4  },
        { key: 'full_fracture',    chips: 25, mult: 4  },
        { key: 'shard_cluster',    chips: 20, mult: 3  },
        { key: 'two_rifts',        chips: 10, mult: 2  },
        { key: 'rift_pair',        chips: 10, mult: 2  },
        { key: 'chance',           chips: 0,  mult: 1  },
    ],

    modifiers: [
        {
            key: 'void_eye',
            chipBonus: 4, multBonus: 0,
            tier: 1, cost: 12,
        },
        {
            key: 'shard_magnet',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'fracture_lens',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 20,
        },
        {
            key: 'null_weight',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 22,
        },
        {
            key: 'echo_bloom',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 16,
        },
        {
            key: 'twin_rift',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'entropy_spike',
            chipBonus: 0, multBonus: 3,
            tier: 2, cost: 14,
        },
        {
            key: 'locked_light',
            chipBonus: 0, multBonus: 0,
            tier: 1, cost: 10,
        },
        {
            key: 'void_prism',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 24,
        },
        {
            key: 'fracture_surge',
            chipBonus: 0, multBonus: 2,
            tier: 2, cost: 20,
        },
        {
            key: 'shard_loop',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'chain_reaction',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 22,
        },
        {
            key: 'fracture_insurance',
            chipBonus: 0, multBonus: 0,
            tier: 1, cost: 14,
        },
    ],

    // Permanent upgrades bought with global Fd between runs
    permanentUpgrades: [
        {
            key: 'extra_roll',
            maxLevel: 2,
            costs: [60, 150],
        },
        {
            key: 'starting_reforge',
            maxLevel: 1,
            costs: [80],
        },
        {
            key: 'ante_cushion',
            maxLevel: 3,
            costs: [40, 100, 220],
        },
        {
            key: 'shop_slots',
            maxLevel: 2,
            costs: [50, 130],
        },
        {
            key: 'failure_return',
            maxLevel: 2,
            costs: [35, 90],
        },
        {
            key: 'base_chips',
            maxLevel: 3,
            costs: [45, 110, 240],
        },
        {
            key: 'modifier_memory',
            maxLevel: 1,
            costs: [70],
        },
    ],
};
stampLoc({ dice: DICE_CONFIG }, 'config');

// Cosmetic enemy pools for normal (non-boss) rounds, tiered by ante.
export const SHARD_ENEMIES = {
    tier1: ['shadow_imp', 'crystal_bat', 'shade', 'chaos_hound'],
    tier2: ['void_walker', 'shard_spider', 'hollow_sentinel', 'echo_beast', 'crystal_beast'],
    tier3: ['void_brute', 'void_stalker', 'oblivion_spawn', 'void_horror', 'reality_shred', 'glitch_beast', 'mirror_twin', 'fracture_imp', 'void_penitent', 'void_herald', 'void_broker'],
};

// Boss sprite pools, tiered by ante. Ante 8 is weighted toward the sovereign.
export const SHARD_BOSS_SPRITES = {
    tier1: ['hollow_sentinel', 'shard_spider', 'mirror_twin'],
    tier2: ['glitch_beast', 'void_stalker', 'reality_shred', 'void_herald'],
    tier3: ['void_broker', 'void_penitent', 'boss_void_sovereign'],
};

// Boss "Blind"-style rule twists. Every 3rd round (the last round of each
// ante) rolls a fresh boss with 1-3 of these stacked, scaling with ante.
export const SHARD_BOSS_EFFECTS = {
    cursed_face: {
        desc: (f) => t('config.text.shard_boss_effect.cursed_face', { face: f }),
        roll: () => ({ face: 1 + Math.floor(Math.random() * 6) }),
    },
    static_one: {
        desc: () => t('config.text.shard_boss_effect.static_one'),
    },
    the_shackle: {
        desc: () => t('config.text.shard_boss_effect.the_shackle'),
    },
    null_zone: {
        desc: () => t('config.text.shard_boss_effect.null_zone'),
    },
    the_devourer: {
        desc: () => t('config.text.shard_boss_effect.the_devourer'),
    },
    the_splitter: {
        desc: () => t('config.text.shard_boss_effect.the_splitter'),
    },
    the_fog: {
        desc: () => t('config.text.shard_boss_effect.the_fog'),
    },
    the_inverter: {
        desc: () => t('config.text.shard_boss_effect.the_inverter'),
    },
    the_starveling: {
        desc: () => t('config.text.shard_boss_effect.the_starveling'),
    },
    the_twin: {
        desc: () => t('config.text.shard_boss_effect.the_twin'),
    },
};
stampLoc(SHARD_BOSS_EFFECTS, 'shard_boss_effect');

export const SHARD_BOSS_CONFIG = {
    effectCountByAnte: (ante) => ante >= 8 ? 3 : ante >= 5 ? 2 : 1,
    thresholdMult: 1.25,
};

// Alternate die face sets, "reforges", bought in the shop like modifiers.
// singular.faces is resolved at purchase time to [n,n,n,n,n,n] for the chosen n.
export const DICE_FACE_SETS = {
    standard: {
        faces: [1, 2, 3, 4, 5, 6],
        tier: 0, cost: 0,
    },
    loaded_low: {
        faces: [1, 1, 2, 2, 3, 3],
        tier: 1, cost: 16,
    },
    loaded_high: {
        faces: [4, 4, 5, 5, 6, 6],
        tier: 1, cost: 16,
    },
    twin_evens: {
        faces: [2, 2, 4, 4, 6, 6],
        tier: 2, cost: 20,
    },
    twin_odds: {
        faces: [1, 1, 3, 3, 5, 5],
        tier: 2, cost: 20,
    },
    converger: {
        faces: [3, 3, 3, 4, 4, 4],
        tier: 2, cost: 22,
    },
    singular: {
        faces: null,
        tier: 3, cost: 30,
    },
    wildcard_die: {
        faces: [1, 2, 3, 4, 'W', 'W'],
        tier: 3, cost: 28,
    },
    anchor_die: {
        faces: [1, 2, 3, 4, 5, 6],
        tier: 2, cost: 20,
    },
    split_die: {
        faces: [1, 6, 1, 6, 1, 6],
        tier: 2, cost: 20,
    },
};
stampLoc(DICE_FACE_SETS, 'dice_face_set');

// Relics: a third per-run equip slot alongside modifiers and die reforges.
// Rarer (one shop offer per visit) and pricier than modifiers/reforges.
export const RELICS = {
    overflow_core: {
        cost: 50,
    },
    fracture_weight: {
        cost: 30,
    },
    shard_capacitor: {
        cost: 45,
    },
    second_chance: {
        cost: 40,
    },
    prism_shard: {
        cost: 35,
    },
    chip_battery: {
        cost: 40,
    },
    mult_engine: {
        cost: 45,
    },
    null_compass: {
        cost: 35,
    },
};
stampLoc(RELICS, 'relic');
// These two quote dice limits from DICE_CONFIG, so their text is a template.
RELICS.overflow_core.desc = t('relic.overflow_core.desc', { max: DICE_CONFIG.maxDice });
RELICS.fracture_weight.desc = t('relic.fracture_weight.desc', { min: DICE_CONFIG.minDice });

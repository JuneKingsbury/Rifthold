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
        { key: 'void_convergence', label: 'Void Convergence', desc: 'All 5 dice match',        chips: 60, mult: 8  },
        { key: 'shard_straight',   label: 'Shard Straight',   desc: '1-2-3-4-5 or 2-3-4-5-6', chips: 30, mult: 5  },
        { key: 'void_bloom',       label: 'Void Bloom',       desc: '4 of a kind',             chips: 30, mult: 4  },
        { key: 'full_fracture',    label: 'Full Fracture',    desc: '3 of a kind + pair',       chips: 25, mult: 4  },
        { key: 'shard_cluster',    label: 'Shard Cluster',    desc: '3 of a kind',             chips: 20, mult: 3  },
        { key: 'two_rifts',        label: 'Two Rifts',        desc: 'Two pairs',               chips: 10, mult: 2  },
        { key: 'rift_pair',        label: 'Rift Pair',        desc: 'One pair',                chips: 10, mult: 2  },
        { key: 'chance',           label: 'Chance',           desc: 'Sum of all dice chips x1', chips: 0,  mult: 1  },
    ],

    modifiers: [
        {
            key: 'void_eye',
            label: 'Void Eye',
            desc: '+4 chips whenever you score 3-of-a-kind or better',
            chipBonus: 4, multBonus: 0,
            tier: 1, cost: 12,
        },
        {
            key: 'shard_magnet',
            label: 'Shard Magnet',
            desc: 'Pairs score as 3-of-a-kind',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'fracture_lens',
            label: 'Fracture Lens',
            desc: '+1 free reroll per round',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 20,
        },
        {
            key: 'null_weight',
            label: 'Null Weight',
            desc: 'Sixes count as any face for combos',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 22,
        },
        {
            key: 'echo_bloom',
            label: 'Echo Bloom',
            desc: 'Scoring Void Bloom also adds Rift Pair chips',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 16,
        },
        {
            key: 'twin_rift',
            label: 'Twin Rift',
            desc: 'Two-pair scores as Full Fracture',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'entropy_spike',
            label: 'Entropy Spike',
            desc: '+3 mult when scoring Chance',
            chipBonus: 0, multBonus: 3,
            tier: 2, cost: 14,
        },
        {
            key: 'locked_light',
            label: 'Locked Light',
            desc: 'Each locked die adds +2 chips to the score',
            chipBonus: 0, multBonus: 0,
            tier: 1, cost: 10,
        },
        {
            key: 'void_prism',
            label: 'Void Prism',
            desc: '+1 mult for each unique face value showing',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 24,
        },
        {
            key: 'fracture_surge',
            label: 'Fracture Surge',
            desc: '+2 mult when every die is scored (no stragglers)',
            chipBonus: 0, multBonus: 2,
            tier: 2, cost: 20,
        },
        {
            key: 'shard_loop',
            label: 'Shard Loop',
            desc: '+1 Fd for every point your score clears the threshold by',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 18,
        },
        {
            key: 'chain_reaction',
            label: 'Chain Reaction',
            desc: 'Clearing with a Shard Straight grants +1 reroll for the rest of this run',
            chipBonus: 0, multBonus: 0,
            tier: 2, cost: 22,
        },
        {
            key: 'fracture_insurance',
            label: 'Fracture Insurance',
            desc: 'A failed round still banks half the shortfall as Fd',
            chipBonus: 0, multBonus: 0,
            tier: 1, cost: 14,
        },
    ],

    // Permanent upgrades bought with global Fd between runs
    permanentUpgrades: [
        {
            key: 'extra_roll',
            label: 'Void Momentum',
            desc: '+1 roll per round (all runs)',
            maxLevel: 2,
            costs: [60, 150],
        },
        {
            key: 'starting_reforge',
            label: 'Attuned Shard',
            desc: 'Unlock a configurable starting die reforge for all future runs',
            maxLevel: 1,
            costs: [80],
        },
        {
            key: 'ante_cushion',
            label: 'Fracture Buffer',
            desc: 'Thresholds are 10% lower per level',
            maxLevel: 3,
            costs: [40, 100, 220],
        },
        {
            key: 'shop_slots',
            label: 'Wider Market',
            desc: '+1 modifier offered in shop per level',
            maxLevel: 2,
            costs: [50, 130],
        },
        {
            key: 'failure_return',
            label: 'Shard Memory',
            desc: 'Return 15% more Fd on run failure per level',
            maxLevel: 2,
            costs: [35, 90],
        },
        {
            key: 'base_chips',
            label: 'Crystalline Core',
            desc: '+5 base chips to every score',
            maxLevel: 3,
            costs: [45, 110, 240],
        },
        {
            key: 'modifier_memory',
            label: 'Modifier Memory',
            desc: 'Start every run with one random modifier already equipped',
            maxLevel: 1,
            costs: [70],
        },
    ],
};

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
        label: 'Cursed Face',
        desc: (f) => `Dice showing ${f} score as 0 and don't count toward combos`,
        roll: () => ({ face: 1 + Math.floor(Math.random() * 6) }),
    },
    static_one: {
        label: 'The Static One',
        desc: () => `One die is locked at a random value and can't be toggled this round`,
    },
    the_shackle: {
        label: 'The Shackle',
        desc: () => `-1 roll this round`,
    },
    null_zone: {
        label: 'The Null Zone',
        desc: () => `Chance (no combo) scores x0 mult`,
    },
    the_devourer: {
        label: 'The Devourer',
        desc: () => `Your single highest die is zeroed before scoring`,
    },
    the_splitter: {
        label: 'The Splitter',
        desc: () => `Pairs don't count this round (falls back to Chance)`,
    },
    the_fog: {
        label: 'The Fog',
        desc: () => `Unlocked dice show their value only once locked`,
    },
    the_inverter: {
        label: 'The Inverter',
        desc: () => `Your single lowest die is zeroed before scoring`,
    },
    the_starveling: {
        label: 'The Starveling',
        desc: () => `No ante clear bonus this round, raw score only`,
    },
    the_twin: {
        label: 'The Twin',
        desc: () => `Two random unlocked dice are forced to match on every roll`,
    },
};

export const SHARD_BOSS_CONFIG = {
    effectCountByAnte: (ante) => ante >= 8 ? 3 : ante >= 5 ? 2 : 1,
    thresholdMult: 1.25,
};

// Alternate die face sets, "reforges", bought in the shop like modifiers.
// singular.faces is resolved at purchase time to [n,n,n,n,n,n] for the chosen n.
export const DICE_FACE_SETS = {
    standard: {
        label: 'Standard',
        desc: 'Faces 1-6, balanced',
        faces: [1, 2, 3, 4, 5, 6],
        tier: 0, cost: 0,
    },
    loaded_low: {
        label: 'Loaded Low',
        desc: 'Faces 1,1,2,2,3,3: safer low rolls and easy pairs, low ceiling',
        faces: [1, 1, 2, 2, 3, 3],
        tier: 1, cost: 16,
    },
    loaded_high: {
        label: 'Loaded High',
        desc: 'Faces 4,4,5,5,6,6: big chip sums, never a lone straggler under 4',
        faces: [4, 4, 5, 5, 6, 6],
        tier: 1, cost: 16,
    },
    twin_evens: {
        label: 'Twin Evens',
        desc: 'Faces 2,2,4,4,6,6',
        faces: [2, 2, 4, 4, 6, 6],
        tier: 2, cost: 20,
    },
    twin_odds: {
        label: 'Twin Odds',
        desc: 'Faces 1,1,3,3,5,5',
        faces: [1, 1, 3, 3, 5, 5],
        tier: 2, cost: 20,
    },
    converger: {
        label: 'Converger',
        desc: 'Faces 3,3,3,4,4,4: always shows 3 or 4, biasing toward pairing with other dice on those values',
        faces: [3, 3, 3, 4, 4, 4],
        tier: 2, cost: 22,
    },
    singular: {
        label: 'Singular',
        desc: 'Choose one value, all six faces show it. Guaranteed every roll, catastrophic if a boss curses that value',
        faces: null,
        tier: 3, cost: 30,
    },
    wildcard_die: {
        label: 'Wildcard Die',
        desc: 'Faces 1,2,3,4,W,W: W counts as whatever value completes your best combo',
        faces: [1, 2, 3, 4, 'W', 'W'],
        tier: 3, cost: 28,
    },
    anchor_die: {
        label: 'Anchor Die',
        desc: 'Standard faces 1-6, but this die is permanently locked the moment you reforge it',
        faces: [1, 2, 3, 4, 5, 6],
        tier: 2, cost: 20,
    },
    split_die: {
        label: 'Split Die',
        desc: 'Faces 1,6,1,6,1,6: extreme high/low split, pairs well with Null Weight',
        faces: [1, 6, 1, 6, 1, 6],
        tier: 2, cost: 20,
    },
};

// Relics: a third per-run equip slot alongside modifiers and die reforges.
// Rarer (one shop offer per visit) and pricier than modifiers/reforges.
export const RELICS = {
    overflow_core: {
        label: 'Overflow Core',
        desc: `+1 die for the rest of the run (max ${DICE_CONFIG.maxDice} dice)`,
        cost: 50,
    },
    fracture_weight: {
        label: 'Fracture Weight',
        desc: `-1 die for the rest of the run (min ${DICE_CONFIG.minDice} dice), +25% mult on every score`,
        cost: 30,
    },
    shard_capacitor: {
        label: 'Shard Capacitor',
        desc: '+1 modifier slot for the rest of the run',
        cost: 45,
    },
    second_chance: {
        label: 'Second Chance',
        desc: 'Once per run, a 3rd straight fail resets your fail streak instead of ending the run',
        cost: 40,
    },
    prism_shard: {
        label: 'Prism Shard',
        desc: "See the ante-after-next boss in every shop, one ante earlier than normal",
        cost: 35,
    },
    chip_battery: {
        label: 'Chip Battery',
        desc: '+15 chips on every score for the rest of the run',
        cost: 40,
    },
    mult_engine: {
        label: 'Mult Engine',
        desc: '+2 mult on every score for the rest of the run',
        cost: 45,
    },
    null_compass: {
        label: 'Null Compass',
        desc: "Immune to the boss Cursed Face effect for the rest of the run",
        cost: 35,
    },
};

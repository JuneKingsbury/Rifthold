export const DICE_CONFIG = {
    numDice: 5,
    rollsPerRound: 3,
    antesPerRun: 8,
    roundsPerAnte: 3,
    maxModifiers: 4,

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
            desc: '+2 mult when all 5 dice are scored (no stragglers)',
            chipBonus: 0, multBonus: 2,
            tier: 2, cost: 20,
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
    ],
};

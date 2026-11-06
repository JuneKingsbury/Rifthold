import { stampLoc } from '../i18n.js';

// Named enemy catalog. Each enemy type has base stats, a sprite, and a color.
// Realms reference these by key with a spawn weight.
export const EXPEDITION_ENEMIES = {
    // Crystal chain
    // attackAnim picks the expedition basic-attack motion: 'Swing' (claw/slam),
    // 'Stab' (fang/thorn/spear thrust), or 'DrawAndShoot' (fling a projectile).
    // DrawAndShoot enemies carry projectileChar/projectileColor so their shot
    // renders themed (the composer styles it as a mote when the enemy has spells).
    crystal_bat:      { hp: [20, 35],  damage: [3, 6],  sprite: 'crystal_bat', color: '#6688ff', attackAnim: 'Swing' },
    crystal_beast:    { hp: [30, 45],  damage: [4, 7],  sprite: 'crystal_beast', color: '#4368ec', attackAnim: 'Swing' },
    crystal_golem:    { hp: [50, 80],  damage: [6, 10], sprite: 'crystal_golem', color: '#4466cc', attackAnim: 'Swing' },
    shard_spider:     { hp: [30, 50],  damage: [5, 8],  sprite: 'shard_spider', color: '#88aaff', attackAnim: 'Stab' },
    runite_elemental: { hp: [80, 130], damage: [9, 14], sprite: 'runite_elemental', color: '#44ccff', attackAnim: 'DrawAndShoot', projectileChar: '✦', projectileColor: '#44ccff', spells: [{ spell: 'arcane_bolt', chance: 0.25, damage: [8, 14] }] },
    crystal_wurm:     { hp: [100, 160],damage: [11, 17],sprite: 'crystal_wurm', color: '#3355aa', attackAnim: 'Swing' },

    // Verdant chain
    vine_creeper:     { hp: [20, 35],  damage: [3, 5],  sprite: 'vine_creeper', color: '#44aa44', attackAnim: 'Swing' },
    thorn_beast:      { hp: [40, 65],  damage: [5, 9],  sprite: 'thorn_beast', color: '#338833', attackAnim: 'Stab' },
    spore_walker:     { hp: [35, 55],  damage: [4, 7],  sprite: 'spore_walker', color: '#88aa44', attackAnim: 'Swing', spells: [{ spell: 'poison_cloud', chance: 0.2, damage: [3, 6], dot: { damage: [2, 3], ticks: 3, interval: 10 } }] },
    fungal_horror:    { hp: [55, 90],  damage: [6, 11], sprite: 'fungal_horror', color: '#669944', attackAnim: 'Swing', spells: [{ spell: 'spore_burst', chance: 0.2, damage: [4, 8], aoe: true }] },
    canopy_stalker:   { hp: [70, 120], damage: [8, 13], sprite: 'canopy_stalker', color: '#226622', attackAnim: 'Swing' },

    // Arcane chain
    arcane_wisp:      { hp: [15, 30],  damage: [4, 7],  sprite: 'arcane_wisp', color: '#aa88ff', attackAnim: 'DrawAndShoot', projectileChar: '·', projectileColor: '#aa88ff', spells: [{ spell: 'arcane_bolt', chance: 0.3, damage: [5, 10] }] },
    tome_guardian:    { hp: [50, 80],  damage: [6, 10], sprite: 'tome_guardian', color: '#8866cc', attackAnim: 'Swing' },
    spell_wraith:     { hp: [40, 70],  damage: [7, 12], sprite: 'spell_wraith', color: '#bb88ff', attackAnim: 'DrawAndShoot', projectileChar: '·', projectileColor: '#bb88ff', spells: [{ spell: 'soul_drain', chance: 0.25, damage: [6, 12], lifesteal: 0.5 }] },
    construct:        { hp: [70, 120], damage: [8, 14], sprite: 'construct', color: '#6644aa', attackAnim: 'Swing', spells: [{ spell: 'arcane_blast', chance: 0.2, damage: [10, 16], aoe: true }] },
    lab_abomination:  { hp: [90, 150], damage: [10, 16],sprite: 'lab_abomination', color: '#994488', attackAnim: 'Swing', spells: [{ spell: 'toxic_spray', chance: 0.2, damage: [5, 10], aoe: true, dot: { damage: [2, 4], ticks: 3, interval: 10 } }] },

    // Shadow chain
    shadow_imp:       { hp: [40, 65],  damage: [6, 10], sprite: 'shadow_imp', color: '#885588', attackAnim: 'Swing' },
    void_stalker:     { hp: [60, 100], damage: [8, 13], sprite: 'void_stalker', color: '#664488', attackAnim: 'Swing', spells: [{ spell: 'void_bolt', chance: 0.2, damage: [8, 14] }] },
    shade:            { hp: [80, 130], damage: [10, 15],sprite: 'shade', color: '#553377', attackAnim: 'DrawAndShoot', projectileChar: '·', projectileColor: '#9977bb', spells: [{ spell: 'shadow_drain', chance: 0.2, damage: [6, 12], lifesteal: 0.3 }] },
    void_horror:      { hp: [120, 180],damage: [12, 18],sprite: 'void_horror', color: '#442266', attackAnim: 'Swing', spells: [{ spell: 'void_blast', chance: 0.25, damage: [10, 18], aoe: true }] },
    oblivion_spawn:   { hp: [150, 230],damage: [14, 21],sprite: 'oblivion_spawn', color: '#331155', attackAnim: 'Swing', spells: [{ spell: 'annihilate', chance: 0.15, damage: [15, 25] }] },

    // Void Pact chain
    shade_wraith:       { hp: [45, 70],  damage: [8, 13],  sprite: 'shade_wraith', color: '#7733aa', attackAnim: 'DrawAndShoot', projectileChar: '·', projectileColor: '#9955cc', spells: [{ spell: 'soul_drain', chance: 0.25, damage: [5, 10], lifesteal: 0.3 }] },
    void_penitent:      { hp: [35, 55],  damage: [7, 11],  sprite: 'void_penitent', color: '#553388', attackAnim: 'Stab' },
    hollow_sentinel:    { hp: [75, 110], damage: [11, 16], sprite: 'hollow_sentinel', color: '#442266', attackAnim: 'Swing', damageReduction: 0.25 },
    void_broker:        { hp: [40, 65],  damage: [8, 12],  sprite: 'void_broker', color: '#8844bb', attackAnim: 'DrawAndShoot', projectileChar: '✦', projectileColor: '#aa66dd', spells: [{ spell: 'soul_drain', chance: 0.3, damage: [3, 6], manaDrain: 0.12 }] },
    penitent_guardian:  { hp: [60, 90],  damage: [13, 18], sprite: 'penitent_guardian', color: '#6633aa', attackAnim: 'Swing' },
    echo_beast:         { hp: [50, 80],  damage: [10, 15], sprite: 'echo_beast', color: '#773399', attackAnim: 'Swing', onDeath: { applyVoidDrained: true, rounds: 2 } },
    void_herald:        { hp: [70, 110], damage: [14, 20], sprite: 'void_herald', color: '#993dcc', attackAnim: 'Swing', spells: [{ spell: 'summon_penitent', chance: 0.25, summonKey: 'void_penitent' }] },

    // Chaos chain
    fracture_imp:       { hp: [25, 40],  damage: [6, 10],  sprite: 'fracture_imp', color: '#ff66cc', attackAnim: 'Swing', chaosOnDeath: true },
    glitch_beast:       { hp: [40, 65],  damage: [9, 14],  sprite: 'phase_beast', color: '#cc44ff', attackAnim: 'Swing', spells: [{ spell: 'phase_dodge', chance: 0.3, dodgeRounds: 1 }] },
    mirror_shade:       { hp: [35, 55],  damage: [8, 12],  sprite: 'mirror_shade', color: '#ff88ff', attackAnim: 'DrawAndShoot', projectileChar: '✦', projectileColor: '#ff88ff' },
    shifting_horror:    { hp: [55, 85],  damage: [11, 17], sprite: 'shifting_horror', color: '#ff44aa', attackAnim: 'Swing' },
    chaos_hound:        { hp: [30, 50],  damage: [10, 15], sprite: 'chaos_hound', color: '#ff6633', attackAnim: 'Stab', spells: [{ spell: 'frenzy_bite', chance: 0.2, extraAttack: true }] },
    mirror_twin:        { hp: [30, 50],  damage: [8, 13],  sprite: 'mirror_twin', color: '#ee88ff', attackAnim: 'Swing' },
    reality_shred:      { hp: [65, 100], damage: [13, 19], sprite: 'reality_shred', color: '#cc33cc', attackAnim: 'DrawAndShoot', projectileChar: '✦', projectileColor: '#cc33cc', spells: [{ spell: 'chaos_bolt', chance: 0.2, damage: [8, 14], appliesChaos: true }] },

    // Kingdom chain (armored: true enables armoredDamageBonus on Runic Greatsword)
    kingdom_guard:    { hp: [35, 55],  damage: [5, 8],  sprite: 'kingdom_guard', color: '#ccaa44', attackAnim: 'Stab', armored: true, damageReduction: 0.1 },
    knight:           { hp: [60, 90],  damage: [7, 12], sprite: 'knight', color: '#bbaa33', attackAnim: 'Swing', armored: true, damageReduction: 0.15 },
    crusader:         { hp: [80, 120], damage: [9, 14], sprite: 'crusader', color: '#ddcc44', attackAnim: 'Swing', armored: true, damageReduction: 0.2 },
    high_priest:      { hp: [50, 75],  damage: [10, 16],sprite: 'high_priest', color: '#ffcc66', attackAnim: 'DrawAndShoot', projectileChar: '✦', projectileColor: '#ffcc66', spells: [{ spell: 'holy_smite', chance: 0.3, damage: [8, 14] }, { spell: 'heal', chance: 0.2, healPct: 0.15 }] },
    palace_champion:  { hp: [100, 150],damage: [12, 18],sprite: 'palace_champion', color: '#ffdd88', attackAnim: 'Swing', armored: true, damageReduction: 0.25 },
};
stampLoc(EXPEDITION_ENEMIES, 'exp_enemy');

// Realm chains a demo-mode player may explore. All other chains stay locked
// while demo mode is on, even if their research / event / prior-realm
// prerequisites are otherwise met (e.g. defeating the year-8 crusader raid must
// not open the kingdom chain in the demo).
export const DEMO_ALLOWED_REALM_CHAINS = new Set(['crystal', 'verdant']);

// Exploration / realms. Used by exploration.js.
export const REALMS = {
    wild_frontiers: {
        difficulty: 1,
        chain: 'scouting',
        chainOrder: 1,
        scoutingMode: true,
        duration: [120, 240],
        encounters: 4,
        combatEncounters: [1, 2],
        vis: { wall: 'scouting_wall', floor: 'scouting_floor' },
        loot: [
            { resource: 'wood', weight: 40, amount: [3, 8] },
            { resource: 'stone', weight: 25, amount: [2, 6] },
            { resource: 'leather', weight: 20, amount: [1, 3] },
            { resource: 'hides', weight: 10, amount: [1, 2] },
            { resource: 'meat', weight: 5, amount: [1, 3] },
        ],
        enemies: { count: [1, 2], types: [
            { key: 'vine_creeper', weight: 40 },
            { key: 'thorn_beast', weight: 35 },
            { key: 'spore_walker', weight: 25 },
        ] },
        events: {
            ambient: 5,
            discoveries: 4,
            traps: 3,
            rare: [
                { chance: 0.05, loot: { resource: 'runite', amount: [1, 2] } },
                { chance: 0.04, loot: { resource: 'leather', amount: [2, 4] } },
            ],
        },
    },
    crystal_caves: {
        difficulty: 3,
        chain: 'crystal', chainOrder: 1,
        duration: [220, 380], encounters: 5, combatEncounters: [1, 2],
        vis: { wall: 'crystal_wall', floor: 'crystal_floor' },
        loot: [
            { resource: 'stone', weight: 40, amount: [5, 12] },
            { resource: 'runite', weight: 30, amount: [2, 5] },
            { resource: 'void_essence', weight: 10, amount: [1, 3] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'crystal_bat', weight: 30 },
            { key: 'crystal_beast', weight: 20 },
            { key: 'shard_spider', weight: 30 },
            { key: 'crystal_golem', weight: 20 },
        ] },
        events: {
            ambient: 5,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.05, loot: { resource: 'runite', amount: [3, 6] } },
                { chance: 0.03, loot: { resource: 'stone', amount: [8, 15] } },
                { chance: 0.005, loot: { item: 'compass_of_greed' } },
                { chance: 0.005, loot: { item: 'jewelers_loupe' } },
            ],
        },
    },
    crystal_mines: {
        difficulty: 4,
        chain: 'crystal', chainOrder: 2,
        duration: [350, 550], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'crystal_wall', floor: 'crystal_floor' },
        requiresRealm: 'crystal_caves',
        loot: [
            { resource: 'runite', weight: 35, amount: [4, 9] },
            { resource: 'stone', weight: 25, amount: [6, 14] },
            { resource: 'void_essence', weight: 15, amount: [2, 5] },
        ],
        enemies: { count: [3, 5], types: [
            { key: 'crystal_bat', weight: 10 },
            { key: 'crystal_beast', weight: 15 },
            { key: 'shard_spider', weight: 30 },
            { key: 'crystal_golem', weight: 35 },
            { key: 'runite_elemental', weight: 10 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.04, loot: { resource: 'runite', amount: [6, 12] } },
                { chance: 0.03, loot: { resource: 'void_essence', amount: [4, 8] } },
                { chance: 0.005, loot: { item: 'ley_battery' } },
                { chance: 0.005, loot: { item: 'ward_of_the_sentinel' } },
            ],
        },
    },
    crystal_depths: {
        difficulty: 5,
        chain: 'crystal', chainOrder: 3,
        duration: [500, 750], encounters: 8, combatEncounters: [2, 4],
        vis: { wall: 'crystal_wall', floor: 'crystal_floor' },
        requiresRealm: 'crystal_mines',
        loot: [
            { resource: 'runite', weight: 40, amount: [6, 14] },
            { resource: 'void_essence', weight: 25, amount: [3, 7] },
            { resource: 'stone', weight: 15, amount: [8, 18] },
        ],
        enemies: { count: [4, 7], types: [
            { key: 'shard_spider', weight: 15 },
            { key: 'crystal_golem', weight: 30 },
            { key: 'runite_elemental', weight: 35 },
            { key: 'crystal_wurm', weight: 20 },
        ] },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'crystal_aegis', chance: 0.5 },
                { item: 'crystalline_hammer', chance: 0.5 },
            ],
            bonusResources: { runite: 8, void_essence: 4 },
            phases: [
                {
                    hp: 300, damage: 20, damageReduction: 0.35,
                    color: '#4488ff', sprite: 'boss_crystal_colossus',
                },
                {
                    hp: 250, damage: 30, damageReduction: 0.20,
                    color: '#ff2222', sprite: 'boss_crystal_colossus_enraged',
                    abilities: [{ type: 'aoe', chance: 0.15, damage: [5, 10] }],
                },
                {
                    hp: 200, damage: 38, damageReduction: 0.10,
                    color: '#ff6644', sprite: 'boss_crystal_colossus_shattered',
                    abilities: [{ type: 'aoe', chance: 0.25, damage: [8, 14] }],
                },
                {
                    hp: 150, damage: 45,
                    color: '#ff0000', sprite: 'boss_crystal_colossus_heart',
                    abilities: [{ type: 'aoe', chance: 0.3, damage: [12, 20] }],
                },
            ],
        },
        events: {
            ambient: 7,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.04, loot: { resource: 'runite', amount: [10, 18] } },
                { chance: 0.03, loot: { resource: 'void_essence', amount: [6, 12] } },
                { chance: 0.004, loot: { item: 'crystal_aegis' } },
                { chance: 0.004, loot: { item: 'crystalline_hammer' } },
                { chance: 0.005, loot: { item: 'ward_of_the_sentinel' } },
            ],
        },
    },
    verdant_depths: {
        difficulty: 1,
        chain: 'verdant', chainOrder: 1,
        duration: [150, 280], encounters: 4, combatEncounters: [1, 1],
        vis: { wall: 'verdant_wall', floor: 'verdant_floor' },
        loot: [
            { resource: 'wood', weight: 50, amount: [8, 15] },
            { resource: 'wheat', weight: 20, amount: [5, 10] },
            { resource: 'berries', weight: 20, amount: [4, 8] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [1, 3], types: [
            { key: 'vine_creeper', weight: 50 },
            { key: 'thorn_beast', weight: 30 },
            { key: 'spore_walker', weight: 20 },
        ] },
        events: {
            ambient: 5,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.06, loot: { resource: 'potatoes', amount: [6, 10] } },
                { chance: 0.04, loot: { resource: 'berries', amount: [8, 12] } },
                { chance: 0.005, loot: { item: 'cornucopia_charm' } },
            ],
        },
    },
    fungal_hollows: {
        difficulty: 2,
        chain: 'verdant', chainOrder: 2,
        duration: [280, 450], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'verdant_wall', floor: 'verdant_floor' },
        requiresRealm: 'verdant_depths',
        loot: [
            { resource: 'wood', weight: 35, amount: [10, 20] },
            { resource: 'berries', weight: 25, amount: [6, 12] },
            { resource: 'potatoes', weight: 20, amount: [5, 10] },
        ],
        enemies: { count: [2, 5], types: [
            { key: 'vine_creeper', weight: 15 },
            { key: 'thorn_beast', weight: 30 },
            { key: 'spore_walker', weight: 30 },
            { key: 'fungal_horror', weight: 25 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.05, loot: { resource: 'potatoes', amount: [8, 14] } },
                { chance: 0.04, loot: { resource: 'wheat', amount: [10, 16] } },
                { chance: 0.005, loot: { item: 'staff_of_regrowth' } },
                { chance: 0.004, loot: { item: 'mycelium_crown' } },
                { chance: 0.005, loot: { item: 'cornucopia_charm' } },
            ],
        },
    },
    primeval_canopy: {
        difficulty: 3,
        chain: 'verdant', chainOrder: 3,
        duration: [400, 600], encounters: 7, combatEncounters: [2, 3],
        vis: { wall: 'verdant_wall', floor: 'verdant_floor' },
        requiresRealm: 'fungal_hollows',
        loot: [
            { resource: 'wood', weight: 30, amount: [12, 24] },
            { resource: 'berries', weight: 20, amount: [8, 16] },
            { resource: 'potatoes', weight: 15, amount: [6, 12] },
            { resource: 'void_essence', weight: 10, amount: [2, 5] },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'thorn_beast', weight: 15 },
            { key: 'spore_walker', weight: 20 },
            { key: 'fungal_horror', weight: 35 },
            { key: 'canopy_stalker', weight: 30 },
        ] },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'living_bark_armor', chance: 0.5 },
                { item: 'heartwood_staff', chance: 0.5 },
            ],
            bonusResources: { wood: 15, berries: 10 },
            phases: [
                {
                    hp: 270, damage: 18, damageReduction: 0.35,
                    color: '#22aa66', sprite: 'boss_ancient_treant',
                },
                {
                    hp: 220, damage: 28, damageReduction: 0.20,
                    color: '#ff4400', sprite: 'boss_ancient_treant_enraged',
                    abilities: [{ type: 'aoe', chance: 0.15, damage: [4, 9] }],
                },
                {
                    hp: 180, damage: 35, damageReduction: 0.10,
                    color: '#cc3300', sprite: 'boss_ancient_treant_uprooted',
                    abilities: [{ type: 'aoe', chance: 0.2, damage: [6, 12] }],
                },
                {
                    hp: 130, damage: 42,
                    color: '#ff0000', sprite: 'boss_ancient_treant_heartwood',
                    abilities: [{ type: 'aoe', chance: 0.3, damage: [10, 18] }],
                },
            ],
        },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [5, 9] } },
                { chance: 0.03, loot: { resource: 'berries', amount: [12, 20] } },
                { chance: 0.004, loot: { item: 'staff_of_regrowth' } },
                { chance: 0.003, loot: { item: 'verdant_talisman' } },
            ],
        },
    },
    arcane_library: {
        difficulty: 5,
        chain: 'arcane', chainOrder: 1,
        duration: [180, 320], encounters: 4, combatEncounters: [1, 1],
        vis: { wall: 'university_wall', floor: 'university_floor' },
        loot: [
            { resource: 'tome_of_magic_missile', weight: 20, amount: [1, 1] },
            { resource: 'tome_of_renewal', weight: 20, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 10, amount: [1, 1] },
            { resource: 'runite', weight: 20, amount: [2, 4] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [1, 3], types: [
            { key: 'arcane_wisp', weight: 50 },
            { key: 'tome_guardian', weight: 35 },
            { key: 'spell_wraith', weight: 15 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.05, loot: { resource: 'tome_of_magic_missile', amount: [1, 1] } },
                { chance: 0.04, loot: { resource: 'runite', amount: [3, 5] } },
                { chance: 0.005, loot: { item: 'tome_of_shared_wisdom' } },
                { chance: 0.004, loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    ancient_university: {
        difficulty: 6,
        chain: 'arcane', chainOrder: 2,
        duration: [320, 500], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'university_wall', floor: 'university_floor' },
        requiresRealm: 'arcane_library',
        loot: [
            { resource: 'tome_of_magic_missile', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_renewal', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 10, amount: [1, 1] },
            { resource: 'runite', weight: 25, amount: [3, 7] },
        ],
        enemies: { count: [2, 5], types: [
            { key: 'arcane_wisp', weight: 15 },
            { key: 'tome_guardian', weight: 30 },
            { key: 'spell_wraith', weight: 35 },
            { key: 'construct', weight: 20 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.04, loot: { resource: 'tome_of_haste', amount: [1, 1] } },
                { chance: 0.03, loot: { resource: 'runite', amount: [5, 9] } },
                { chance: 0.005, loot: { item: 'scholars_spectacles' } },
                { chance: 0.004, loot: { item: 'tome_of_shared_wisdom' } },
            ],
        },
    },
    abandoned_laboratory: {
        difficulty: 7,
        chain: 'arcane', chainOrder: 3,
        duration: [450, 680], encounters: 8, combatEncounters: [2, 4],
        vis: { wall: 'university_wall', floor: 'university_floor' },
        requiresRealm: 'ancient_university',
        loot: [
            { resource: 'tome_of_magic_missile', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_renewal', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 12, amount: [1, 1] },
            { resource: 'runite', weight: 20, amount: [4, 9] },
            { resource: 'void_essence', weight: 15, amount: [2, 6] },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'spell_wraith', weight: 15 },
            { key: 'construct', weight: 35 },
            { key: 'lab_abomination', weight: 35 },
            { key: 'tome_guardian', weight: 15 },
        ] },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'arcane_amplifier', chance: 0.7 },
                { item: 'staff_of_distortion', chance: 0.5 },
            ],
            bonusResources: { runite: 6, void_essence: 5 },
            phases: [
                {
                    hp: 290, damage: 20, damageReduction: 0.35,
                    color: '#ff8844', sprite: 'boss_arcane_construct',
                },
                {
                    hp: 240, damage: 30, damageReduction: 0.20,
                    color: '#ff0000', sprite: 'boss_arcane_construct_enraged',
                    abilities: [{ type: 'aoe', chance: 0.15, damage: [5, 10] }],
                },
                {
                    hp: 190, damage: 38, damageReduction: 0.10,
                    color: '#ff4400', sprite: 'boss_arcane_construct_overcharged',
                    abilities: [{ type: 'aoe', chance: 0.25, damage: [8, 14] }],
                },
                {
                    hp: 140, damage: 46,
                    color: '#ff0000', sprite: 'boss_arcane_construct_meltdown',
                    abilities: [{ type: 'aoe', chance: 0.35, damage: [12, 22] }],
                },
            ],
        },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 5,
            rare: [
                { chance: 0.04, loot: { resource: 'tome_of_circle_of_growth', amount: [1, 1] } },
                { chance: 0.03, loot: { resource: 'void_essence', amount: [6, 10] } },
                { chance: 0.004, loot: { item: 'scholars_spectacles' } },
                { chance: 0.003, loot: { item: 'soulbond_scepter' } },
                { chance: 0.002, loot: { item: 'expedition_spellbook' } },
            ],
        },
    },
    shadow_realm: {
        difficulty: 7,
        chain: 'shadow', chainOrder: 1,
        duration: [400, 650], encounters: 7, combatEncounters: [2, 3],
        vis: { wall: 'abyss_wall', floor: 'abyss_floor' },
        loot: [
            { resource: 'void_essence', weight: 40, amount: [3, 7] },
            { resource: 'runite', weight: 25, amount: [3, 6] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'shadow_imp', weight: 30 },
            { key: 'void_stalker', weight: 35 },
            { key: 'shade', weight: 35 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [4, 8] } },
                { chance: 0.02, loot: { resource: 'void_essence', amount: [6, 10] } },
                { chance: 0.005, loot: { item: 'voidwalkers_lantern' } },
                { chance: 0.005, loot: { item: 'cloak_of_shadows' } },
                { chance: 0.005, loot: { item: 'ghost_step_charm' } },
            ],
        },
    },
    void_abyss: {
        difficulty: 8,
        chain: 'shadow', chainOrder: 2,
        duration: [550, 800], encounters: 7, combatEncounters: [3, 5],
        vis: { wall: 'abyss_wall', floor: 'abyss_floor' },
        requiresRealm: 'shadow_realm',
        loot: [
            { resource: 'void_essence', weight: 45, amount: [5, 10] },
            { resource: 'runite', weight: 20, amount: [4, 8] },
        ],
        enemies: { count: [4, 7], types: [
            { key: 'void_stalker', weight: 20 },
            { key: 'shade', weight: 30 },
            { key: 'void_horror', weight: 35 },
            { key: 'oblivion_spawn', weight: 15 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 5,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [8, 14] } },
                { chance: 0.03, loot: { resource: 'runite', amount: [6, 12] } },
                { chance: 0.004, loot: { item: 'void_edge' } },
                { chance: 0.005, loot: { item: 'bloodstone_gauntlet' } },
                { chance: 0.002, loot: { item: 'dimensional_orb' } },
                { chance: 0.003, loot: { item: 'void_charm' } },
                { chance: 0.004, loot: { item: 'voidwalkers_lantern' } },
            ],
        },
    },
    oblivion_rift: {
        difficulty: 9,
        chain: 'shadow', chainOrder: 3,
        duration: [700, 1000], encounters: 9, combatEncounters: [3, 6],
        vis: { wall: 'abyss_wall', floor: 'abyss_floor' },
        requiresRealm: 'void_abyss',
        loot: [
            { resource: 'void_essence', weight: 50, amount: [7, 14] },
            { resource: 'runite', weight: 20, amount: [5, 10] },
        ],
        enemies: { count: [4, 8], types: [
            { key: 'shade', weight: 15 },
            { key: 'void_horror', weight: 35 },
            { key: 'oblivion_spawn', weight: 50 },
        ] },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'shard_of_oblivion', chance: 0.4 },
                { item: 'voidheart', chance: 0.3 },
                { item: 'armor_of_the_abyss', chance: 0.3 },
            ],
            bonusResources: { void_essence: 10 },
            phases: [
                {
                    hp: 350, damage: 25, damageReduction: 0.35,
                    color: '#7722cc', sprite: 'boss_void_sovereign',
                },
                {
                    hp: 300, damage: 38, damageReduction: 0.20,
                    color: '#ff0000', sprite: 'boss_void_sovereign_enraged',
                    abilities: [{ type: 'aoe', chance: 0.15, damage: [6, 12] }],
                },
                {
                    hp: 250, damage: 48, damageReduction: 0.10,
                    color: '#aa00ff', sprite: 'boss_void_sovereign_unbound',
                    abilities: [{ type: 'aoe', chance: 0.25, damage: [10, 18] }],
                },
                {
                    hp: 200, damage: 58,
                    color: '#ff00ff', sprite: 'boss_void_sovereign_true',
                    abilities: [{ type: 'aoe', chance: 0.35, damage: [15, 25] }],
                },
            ],
        },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 6,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [10, 18] } },
                { chance: 0.003, loot: { item: 'void_charm' } },
                { chance: 0.004, loot: { item: 'cloak_of_shadows' } },
                { chance: 0.003, loot: { item: 'abyss_wardens_helm' } },
                { chance: 0.003, loot: { item: 'abyssal_bramble_plate' } },
            ],
        },
    },
    // ── Void Pact chain ──────────────────────────────────────────────────────
    void_hollow: {
        difficulty: 9,
        chain: 'void_pact', chainOrder: 1,
        duration: [400, 620], encounters: 6, combatEncounters: [2, 3],
        vis: { wall: 'arcane_wall', floor: 'abyss_floor' },
        loot: [
            { resource: 'void_essence', weight: 45, amount: [4, 9] },
            { resource: 'runite', weight: 30, amount: [2, 5] },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'shade_wraith', weight: 35 },
            { key: 'void_penitent', weight: 35 },
            { key: 'hollow_sentinel', weight: 30 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [6, 12] } },
                { chance: 0.004, loot: { item: 'void_contract' } },
                { chance: 0.003, loot: { item: 'stitched_poppet' } },
                { chance: 0.003, loot: { item: 'seers_eye' } },
            ],
        },
    },
    void_sanctum: {
        difficulty: 10,
        chain: 'void_pact', chainOrder: 2,
        duration: [500, 750], encounters: 7, combatEncounters: [2, 4],
        vis: { wall: 'arcane_wall', floor: 'abyss_floor' },
        requiresRealm: 'void_hollow',
        loot: [
            { resource: 'void_essence', weight: 40, amount: [5, 12] },
            { resource: 'runite', weight: 25, amount: [3, 7] },
            { resource: 'abyss_sliver', weight: 5, amount: [1, 2] },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'void_broker', weight: 25 },
            { key: 'penitent_guardian', weight: 35 },
            { key: 'echo_beast', weight: 30 },
            { key: 'hollow_sentinel', weight: 10 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [8, 14] } },
                { chance: 0.03, loot: { resource: 'abyss_sliver', amount: [1, 2] } },
                { chance: 0.005, loot: { item: 'void_contract' } },
                { chance: 0.005, loot: { item: 'arbiters_ledger' } },
            ],
        },
    },
    void_heart: {
        difficulty: 11,
        chain: 'void_pact', chainOrder: 3,
        duration: [600, 900], encounters: 8, combatEncounters: [3, 5],
        vis: { wall: 'arcane_wall', floor: 'abyss_floor' },
        requiresRealm: 'void_sanctum',
        loot: [
            { resource: 'void_essence', weight: 40, amount: [6, 14] },
            { resource: 'runite', weight: 25, amount: [4, 8] },
            { resource: 'abyss_sliver', weight: 5, amount: [1, 2] },
        ],
        enemies: { count: [2, 5], types: [
            { key: 'void_broker', weight: 15 },
            { key: 'penitent_guardian', weight: 25 },
            { key: 'echo_beast', weight: 30 },
            { key: 'void_herald', weight: 20 },
            { key: 'hollow_sentinel', weight: 10 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [10, 18] } },
                { chance: 0.04, loot: { resource: 'abyss_sliver', amount: [1, 2] } },
                { chance: 0.005, loot: { item: 'void_contract' } },
                { chance: 0.004, loot: { item: 'arbiters_ledger' } },
            ],
        },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'void_contract', chance: 1.0 },
                { item: 'arbiters_ledger', chance: 0.7 },
            ],
            bonusResources: { void_essence: 20, runite: 5, abyss_sliver: 3 },
            phases: [
                {
                    hp: 320, damage: 20, damageReduction: 0.35,
                    color: '#8844bb', sprite: 'boss_void_arbiter',
                    voidPactChoice: {
                        acceptEffect: { partyDamage: 20, nextPhaseDmgMult: 0.5 },
                    },
                },
                {
                    hp: 260, damage: 26, damageReduction: 0.10,
                    color: '#6622aa', sprite: 'boss_void_arbiter',
                    voidPactChoice: {
                        acceptEffect: { weakestMemberDamage: 40, applyVoidDrained: true, bossDamage: 60, bossStun: 2 },
                    },
                },
                {
                    hp: 220, damage: 32, damageReduction: 0.20,
                    color: '#440088', sprite: 'boss_void_arbiter_enraged',
                    abilities: [
                        { type: 'aoe', chance: 0.2, damage: [12, 20] },
                    ],
                },
            ],
        },
    },

    // ── Chaos chain ──────────────────────────────────────────────────────────
    fracture_gate: {
        difficulty: 13,
        chain: 'chaos', chainOrder: 1,
        duration: [420, 650], encounters: 6, combatEncounters: [2, 3],
        vis: { wall: 'crystal_wall', floor: 'shadow_floor' },
        chaosEncounterChance: 0.30,
        loot: [
            { resource: 'void_essence', weight: 30, amount: [3, 7] },
            { resource: 'runite', weight: 25, amount: [2, 5] },
            { resource: 'gold', weight: 20, amount: [4, 10] },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'fracture_imp', weight: 40 },
            { key: 'glitch_beast', weight: 35 },
            { key: 'mirror_shade', weight: 25 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.05, loot: { resource: 'void_essence', amount: [5, 10] } },
                { chance: 0.005, loot: { item: 'chaos_shard' } },
                { chance: 0.003, loot: { item: 'fracture_edge' } },
                { chance: 0.003, loot: { item: 'chaos_wrought_plate' } },
                { chance: 0.003, loot: { item: 'boots_of_haste' } },
            ],
        },
    },
    shifting_labyrinth: {
        difficulty: 14,
        chain: 'chaos', chainOrder: 2,
        duration: [550, 820], encounters: 8, combatEncounters: [3, 5],
        vis: { wall: 'arcane_wall', floor: 'shadow_floor' },
        requiresRealm: 'fracture_gate',
        chaosEncounterChance: 0.50,
        loot: [
            { resource: 'void_essence', weight: 30, amount: [4, 9] },
            { resource: 'runite', weight: 25, amount: [3, 7] },
            { resource: 'gold', weight: 20, amount: [6, 14] },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'shifting_horror', weight: 30 },
            { key: 'chaos_hound', weight: 30 },
            { key: 'mirror_twin', weight: 25 },
            { key: 'glitch_beast', weight: 15 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.04, loot: { resource: 'gold', amount: [10, 18] } },
                { chance: 0.005, loot: { item: 'chaos_shard' } },
                { chance: 0.004, loot: { item: 'unravelers_eye' } },
            ],
        },
    },
    unraveling_core: {
        difficulty: 15,
        chain: 'chaos', chainOrder: 3,
        duration: [650, 950], encounters: 9, combatEncounters: [4, 6],
        vis: { wall: 'arcane_wall', floor: 'shadow_floor' },
        requiresRealm: 'shifting_labyrinth',
        chaosEncounterChance: 0.70,
        loot: [
            { resource: 'void_essence', weight: 30, amount: [5, 12] },
            { resource: 'runite', weight: 25, amount: [4, 9] },
            { resource: 'gold', weight: 20, amount: [8, 16] },
            { resource: 'abyss_sliver', weight: 8, amount: [1, 3] },
        ],
        enemies: { count: [3, 5], types: [
            { key: 'shifting_horror', weight: 20 },
            { key: 'chaos_hound', weight: 20 },
            { key: 'mirror_twin', weight: 20 },
            { key: 'reality_shred', weight: 25 },
            { key: 'fracture_imp', weight: 15 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 3,
            rare: [
                { chance: 0.04, loot: { resource: 'void_essence', amount: [12, 20] } },
                { chance: 0.005, loot: { item: 'chaos_shard' } },
                { chance: 0.003, loot: { item: 'unravelers_eye' } },
                { chance: 0.04, loot: { resource: 'abyss_sliver', amount: [2, 4] } },
            ],
        },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'chaos_shard', chance: 1.0 },
                { item: 'unravelers_eye', chance: 0.8 },
            ],
            bonusResources: { void_essence: 15, runite: 6, abyss_sliver: 5 },
            isChaosEncounter: true,
            chaosPhaseTransition: true,
            // The Unraveler builds its early phases at spawn as buffed "masks" of
            // other realm bosses (see ExplorationSystem._buildUnravelerMasks). The
            // final phase below is always kept as the true, undisguised form.
            dynamicMasks: true,
            phases: [
                {
                    hp: 280, damage: 18, damageReduction: 0.35,
                    color: '#cc33cc', sprite: 'boss_unraveler',
                    abilities: [
                        { type: 'aoe', chance: 0.25, damage: [8, 14] },
                    ],
                },
                {
                    hp: 240, damage: 24, damageReduction: 0.20,
                    color: '#ff33aa', sprite: 'boss_unraveler',
                    abilities: [
                        { type: 'aoe', chance: 0.30, damage: [10, 18] },
                        { type: 'summon_adds', chance: 0.2, hp: 30, damage: 8, count: 1 },
                    ],
                },
                {
                    hp: 200, damage: 30, damageReduction: 0.10,
                    color: '#ff6600', sprite: 'boss_unraveler',
                    autoChaosTick: true,
                    abilities: [
                        { type: 'aoe', chance: 0.25, damage: [12, 20] },
                    ],
                },
                {
                    hp: 150, damage: 35,
                    color: '#ff0066', sprite: 'boss_unraveler',
                    transitionText: null,
                    autoChaosTick: true,
                    abilities: [
                        { type: 'aoe', chance: 0.3, damage: [14, 22] },
                        { type: 'random_status', chance: 0.15 },
                    ],
                },
            ],
        },
    },

    // ── Kingdom chain ────────────────────────────────────────────────────────
    kingdom_outskirts: {
        difficulty: 11,
        chain: 'kingdom', chainOrder: 1,
        duration: [700, 1000], encounters: 9, combatEncounters: [3, 6],

        vis: { wall: 'kingdom_wall', floor: 'kingdom_floor' },
        requiresEvent: 'crusader_raid_defeated',
        loot: [
            { resource: 'gold', weight: 35, amount: [5, 12] },
            { resource: 'runite', weight: 25, amount: [3, 7] },
            { resource: 'void_essence', weight: 15, amount: [2, 4] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'kingdom_guard', weight: 50 },
            { key: 'knight', weight: 35 },
            { key: 'high_priest', weight: 15 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.05, loot: { resource: 'gold', amount: [10, 20] } },
                { chance: 0.03, loot: { resource: 'gold', amount: [8, 16] } },
                { chance: 0.005, loot: { item: 'hagglers_coin' } },
                { chance: 0.005, loot: { item: 'amulet_of_fortune' } },
            ],
        },
    },
    crusader_barracks: {
        difficulty: 12,
        chain: 'kingdom', chainOrder: 2,
        duration: [700, 1000], encounters: 9, combatEncounters: [4, 6],
        vis: { wall: 'kingdom_wall', floor: 'kingdom_floor' },
        requiresRealm: 'kingdom_outskirts',
        loot: [
            { resource: 'runite', weight: 30, amount: [5, 10] },
            { resource: 'gold', weight: 30, amount: [8, 16] },
            { resource: 'void_essence', weight: 20, amount: [3, 6] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [3, 5], types: [
            { key: 'kingdom_guard', weight: 15 },
            { key: 'knight', weight: 30 },
            { key: 'crusader', weight: 35 },
            { key: 'high_priest', weight: 20 },
        ] },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.05, loot: { resource: 'gold', amount: [14, 26] } },
                { chance: 0.03, loot: { resource: 'runite', amount: [8, 14] } },
                { chance: 0.005, loot: { item: 'drum_of_rallying' } },
                { chance: 0.005, loot: { item: 'rallying_standard' } },
                { chance: 0.004, loot: { item: 'berserkers_wraps' } },
            ],
        },
    },
    palace_fortress: {
        difficulty: 13,
        chain: 'kingdom', chainOrder: 3,
        duration: [700, 1000], encounters: 9, combatEncounters: [5, 7],
        vis: { wall: 'kingdom_wall', floor: 'kingdom_floor' },
        requiresRealm: 'crusader_barracks',
        loot: [
            { resource: 'gold', weight: 40, amount: [12, 24] },
            { resource: 'void_essence', weight: 25, amount: [4, 8] },
            { resource: 'runite', weight: 20, amount: [6, 12] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'knight', weight: 15 },
            { key: 'crusader', weight: 30 },
            { key: 'high_priest', weight: 25 },
            { key: 'palace_champion', weight: 30 },
        ] },
        boss: {
            attackAnim: 'Swing',
            guaranteedLoot: [
                { item: 'sovereign_blade', chance: 0.4 },
                { item: 'commanders_crown', chance: 0.4 },
                { item: 'lodestone_of_prosperity', chance: 0.3 },
            ],
            bonusResources: { gold: 50, void_essence: 8 },
            phases: [
                {
                    hp: 400, damage: 30,
                    color: '#ddaa22', sprite: 'boss_high_king',
                },
                {
                    hp: 350, damage: 44,
                    color: '#ff2200', sprite: 'boss_high_king_enraged',
                    abilities: [{ type: 'aoe', chance: 0.15, damage: [8, 14] }],
                },
                {
                    hp: 300, damage: 52,
                    color: '#ff4400', sprite: 'boss_high_king_guard',
                    abilities: [{ type: 'summon_adds', chance: 0.2, count: 2, hp: 40, damage: 12 }],
                },
                {
                    hp: 250, damage: 65,
                    color: '#ff0000', sprite: 'boss_high_king_desperate',
                    abilities: [{ type: 'aoe', chance: 0.3, damage: [15, 28] }],
                },
            ],
        },
        events: {
            ambient: 6,
            discoveries: 3,
            traps: 4,
            rare: [
                { chance: 0.05, loot: { resource: 'gold', amount: [20, 36] } },
                { chance: 0.03, loot: { resource: 'void_essence', amount: [8, 14] } },
                { chance: 0.005, loot: { item: 'lodestone_of_prosperity' } },
                { chance: 0.003, loot: { item: 'sovereign_blade' } },
                { chance: 0.003, loot: { item: 'commanders_crown' } },
            ],
        },
    },
};
stampLoc(REALMS, 'realm');

export const EXPLORATION_CONFIG = {
    // Party size the Rifts panel recommends before a chain's boss realm. Playtests
    // wiped 53-88% of 3-colonist parties on boss realms and ~11% at 4-5.
    bossRecommendedParty: 4,
    returnTimeMult: 1.3,
    retreatTicks: 200,
    encounterSpacing: 0.2,
    baseFistDamage: 5,
    // One expedition combat round = one baseline attack cycle (matches
    // COLONIST_CONFIG.baseAttackCooldown). Status durations, DoTs, boss/elite
    // ability rolls, chaos ticks and "per round" regen advance once per round.
    combatRoundTicks: 3,
    // Party members gather within this many tiles (Chebyshev) of the Gathering
    // Circle. After the timeout (half an in-game day), anyone still walking is
    // pulled into the rift from where they stand.
    gatherRadius: 2,
    gatherTimeoutTicks: 240,
    // Finished expeditions keep at most this many log lines, and at most this
    // many uncollected "Expeditions Returned" summaries are kept.
    completedLogCap: 300,
    maxPendingSummaries: 20,
    bossTriggerPercent: 0.7,
    microEventChance: 0.04,
    trapDamageRange: [5, 15],
    trapChance: 0.3,
    findItemChance: 0.3,
    ambientChance: 0.4,
    // Enemy melee target selection: softmax-weighted by target priority.
    // Lower temperature = enemies focus the highest-priority target more strongly.
    targetingTemperature: 8,
    // Ranged first-strike: at the start of each combat, before either side's
    // normal attack phase, every party member wielding a ranged weapon fires one
    // free opening shot. Makes bows/crossbows feel distinct from melee in
    // expeditions. Damage is scaled by this multiplier (1.0 = a normal hit).
    rangedFirstStrikeDamageMult: 1.0,
    // Summons the whole party can have out at once, from any mix of casters. A
    // caster may have several of them; each swarm wisp and decoy takes a slot.
    maxPartySummons: 3,
    // Party synergies: relationship-driven combat modifiers applied per member
    // based on who else is in the party. A member fighting alongside a friend or
    // lover gains a small outgoing-damage bonus; fighting alongside a rival takes
    // a small penalty. Opinion thresholds mirror the colony relationship tiers.
    synergy: {
        allyOpinion: 40,   // opinion at/above this = friend/lover boost
        rivalOpinion: -40, // opinion at/below this = rival penalty
        allyDamageBonus: 0.10,
        rivalDamagePenalty: 0.10,
        maxAllyBonus: 0.20,   // cap even with several friends present
        maxRivalPenalty: 0.20,
    },
};

export const EXPEDITION_DIFFICULTY = {
    1:  { enemyHpMult: 1,    enemyDmgMult: 1,    enemyCountMult: 1,    trapDmgMult: 1,    lootAmountMult: 1.00, rareLootMult: 1.00, extraEncounters: 0,  bossPhases: 3 },
    2:  { enemyHpMult: 1.3,  enemyDmgMult: 1.2,  enemyCountMult: 1.25, trapDmgMult: 1.3,  lootAmountMult: 1.15, rareLootMult: 1.10, extraEncounters: 1,  bossPhases: 3 },
    3:  { enemyHpMult: 1.7,  enemyDmgMult: 1.5,  enemyCountMult: 1.5,  trapDmgMult: 1.7,  lootAmountMult: 1.30, rareLootMult: 1.20, extraEncounters: 2,  bossPhases: 4 },
    4:  { enemyHpMult: 2.2,  enemyDmgMult: 1.8,  enemyCountMult: 1.75, trapDmgMult: 2.0,  lootAmountMult: 1.45, rareLootMult: 1.30, extraEncounters: 3,  bossPhases: 4 },
    5:  { enemyHpMult: 3.0,  enemyDmgMult: 2.2,  enemyCountMult: 2.0,  trapDmgMult: 2.5,  lootAmountMult: 1.60, rareLootMult: 1.40, extraEncounters: 4,  bossPhases: 4 },
    6:  { enemyHpMult: 3.9,  enemyDmgMult: 2.7,  enemyCountMult: 2.25, trapDmgMult: 3.2,  lootAmountMult: 1.75, rareLootMult: 1.50, extraEncounters: 5,  bossPhases: 4 },
    7:  { enemyHpMult: 5.0,  enemyDmgMult: 3.3,  enemyCountMult: 2.5,  trapDmgMult: 4.0,  lootAmountMult: 1.90, rareLootMult: 1.60, extraEncounters: 6,  bossPhases: 4 },
    8:  { enemyHpMult: 6.5,  enemyDmgMult: 4.0,  enemyCountMult: 2.75, trapDmgMult: 5.0,  lootAmountMult: 2.05, rareLootMult: 1.70, extraEncounters: 7,  bossPhases: 4 },
    9:  { enemyHpMult: 8.5,  enemyDmgMult: 4.8,  enemyCountMult: 3.0,  trapDmgMult: 6.0,  lootAmountMult: 2.20, rareLootMult: 1.80, extraEncounters: 8,  bossPhases: 4 },
    10: { enemyHpMult: 11.0, enemyDmgMult: 5.8,  enemyCountMult: 3.25, trapDmgMult: 7.5,  lootAmountMult: 2.35, rareLootMult: 1.90, extraEncounters: 9,  bossPhases: 4 },
    11: { enemyHpMult: 14.0, enemyDmgMult: 7.0,  enemyCountMult: 3.5,  trapDmgMult: 9.0,  lootAmountMult: 2.50, rareLootMult: 2.00, extraEncounters: 10, bossPhases: 4 },
    12: { enemyHpMult: 18.0, enemyDmgMult: 8.5,  enemyCountMult: 3.75, trapDmgMult: 11.0, lootAmountMult: 2.65, rareLootMult: 2.10, extraEncounters: 11, bossPhases: 4 },
    13: { enemyHpMult: 23.0, enemyDmgMult: 10.0, enemyCountMult: 4.0,  trapDmgMult: 13.0, lootAmountMult: 2.80, rareLootMult: 2.20, extraEncounters: 12, bossPhases: 4 },
    14: { enemyHpMult: 29.0, enemyDmgMult: 12.0, enemyCountMult: 4.25, trapDmgMult: 16.0, lootAmountMult: 2.95, rareLootMult: 2.30, extraEncounters: 13, bossPhases: 4 },
    15: { enemyHpMult: 36.0, enemyDmgMult: 14.5, enemyCountMult: 4.5,  trapDmgMult: 20.0, lootAmountMult: 3.10, rareLootMult: 2.40, extraEncounters: 14, bossPhases: 4 },
};
stampLoc(EXPEDITION_DIFFICULTY, 'difficulty');

export const EXPLORATION_EVENTS = {
    ambient: 12,
    traps: 6,
    discoveries: 5,
    combatStart: 4,
    combatHit: 3,
    combatMiss: 2,
    combatDefeat: 2,
};
stampLoc(EXPLORATION_EVENTS, 'exp_event');

// Formation: front/back row positioning for expedition parties.
export const FORMATION_CONFIG = {
    rows: {
        front: {
            damageTakenMult: 1.3,
            meleeDamageMult: 1.2,
            spellDamageMult: 1.0,
            targetPriorityMod: 5,
        },
        back: {
            damageTakenMult: 0.7,
            meleeDamageMult: 0.6,
            spellDamageMult: 1.15,
            targetPriorityMod: -5,
        },
    },
    maxPerRow: 3,
    defaultAssignment: 'front',
};
stampLoc({ formation: FORMATION_CONFIG }, 'config');

// Trap types.
export const EXPEDITION_TRAPS = {
    rockfall: {
        damageType: 'instant',
        initialDamage: [5, 15],
        checks: [
            {
                skill: 'building', minLevel: 3,
                traitBonus: ['tough', 'sturdy'],
            },
            {
                skill: null, traitAny: ['quick', 'lucky'],
            },
        ],
    },
    poison_trap: {
        damageType: 'dot',
        initialDamage: [3, 8],
        dotDamage: [2, 4], dotTicks: 5, dotInterval: 10,
        checks: [
            {
                skill: 'research', minLevel: 3,
                traitBonus: ['scholar'],
            },
            {
                skill: 'cooking', minLevel: 3,
                traitBonus: ['iron_stomach'],
            },
        ],
    },
    disarm_trap: {
        damageType: 'equipment',
        initialDamage: [2, 5],
        effect: { disableRandomSlot: true, disableDuration: 3 },
        checks: [
            {
                skill: 'crafting', minLevel: 3,
                traitBonus: ['sturdy'],
            },
            {
                skill: 'animals', minLevel: 3,
                traitBonus: ['sturdy'],
            },
        ],
    },
    mana_siphon: {
        damageType: 'mana',
        initialDamage: [0, 2],
        manaDrain: [10, 25],
        checks: [
            {
                skill: 'research', minLevel: 4,
                traitBonus: ['scholar'],
            },
            {
                skill: 'farming', minLevel: 3,
                traitBonus: ['green_thumb'],
            },
        ],
    },
    snare_trap: {
        damageType: 'instant',
        initialDamage: [4, 12],
        checks: [
            {
                skill: 'crafting', minLevel: 3,
                traitBonus: ['quick'],
            },
            {
                skill: null, traitAny: ['quick', 'lucky'],
            },
        ],
    },
};
stampLoc(EXPEDITION_TRAPS, 'exp_trap');

// Elite enemy modifiers.
export const ELITE_MODIFIERS = {
    regenerating: {
        color: '#44ff44',
        hpMult: 1.2, regenPerRound: 0.05, lootBonusMult: 1.5,
    },
    shielded: {
        color: '#4488ff',
        hpMult: 1.0, damageReduction: 0.3, lootBonusMult: 1.4,
    },
    vampiric: {
        color: '#cc0044',
        hpMult: 0.9, lifeSteal: 0.5, lootBonusMult: 1.6,
    },
    explosive: {
        color: '#ff6600',
        hpMult: 0.8, onDeath: { aoe: true, damage: [10, 20] }, lootBonusMult: 1.3,
    },
    swift: {
        color: '#ffff44',
        hpMult: 0.9, extraAttacks: 1, dodgeChance: 0.2, lootBonusMult: 1.4,
    },
};
stampLoc(ELITE_MODIFIERS, 'elite_mod');

export const ELITE_CONFIG = {
    baseChance: 0.08,
    difficultyChanceBonus: 0.03,
    maxModifiers: 1,
    championChance: 0.02,
};

// Boss phase ability types: aoe, invulnerable, taunt, summon_adds, heal.

// Mid-expedition decisions.
export const EXPEDITION_DECISIONS = {
    forked_path: {
        triggerChance: 0.35,
        realmFilter: null,
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { spawnCombat: { countMult: 1.5 }, nextLootRareMult: 2.0 },
            },
            {
                effects: { healParty: 0.15 },
            },
        ],
    },
    mysterious_shrine: {
        triggerChance: 0.2,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        minDifficulty: 1,
        safeIndex: 2,
        choices: [
            {
                effects: { restoreMana: 0.5, trapRisk: 0.3 },
            },
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.5 }, buffEnemies: { hpMult: 1.2 } },
            },
            {
                effects: {},
            },
        ],
    },
    trapped_chest: {
        triggerChance: 0.25,
        realmFilter: null,
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.0 }, trapRisk: 0.4 },
            },
            {
                effects: {},
            },
        ],
    },
    echoing_cry: {
        triggerChance: 0.2,
        realmFilter: null,
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { npcChance: 0.6, trapRisk: 0.4 },
            },
            {
                effects: {},
            },
        ],
    },
    prisoners_dilemma: {
        triggerChance: 0.3,
        realmFilter: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'],
        minDifficulty: 1,
        safeIndex: 2,
        choices: [
            {
                effects: { healParty: 0.2, npcChance: 1.0 },
            },
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.5 }, spawnCombat: { countMult: 1.0 } },
            },
            {
                effects: {},
            },
        ],
    },
    supply_line: {
        triggerChance: 0.3,
        realmFilter: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { buffEnemies: { hpMult: 0.8 } },
            },
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.0 }, nextLootRareMult: 2.0 },
            },
        ],
    },
    resonant_vein: {
        triggerChance: 0.3,
        realmFilter: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        minDifficulty: 1,
        safeIndex: 2,
        choices: [
            {
                effects: { restoreMana: 0.4, grantLoot: { type: 'realm_roll', mult: 1.25 }, trapRisk: 0.3 },
            },
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 0.75 } },
            },
            {
                effects: {},
            },
        ],
    },
    ancient_grove: {
        triggerChance: 0.3,
        realmFilter: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.5 }, buffEnemies: { hpMult: 1.2 } },
            },
            {
                effects: { healParty: 0.2 },
            },
        ],
    },
    unstable_experiment: {
        triggerChance: 0.25,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { healParty: 0.25, restoreMana: 0.5, trapRisk: 0.5 },
            },
            {
                effects: {},
            },
        ],
    },
    whispering_rift: {
        triggerChance: 0.25,
        realmFilter: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { nextLootRareMult: 2.5, trapRisk: 0.4 },
            },
            {
                effects: { restoreMana: 0.25 },
            },
        ],
    },
    abandoned_campsite: {
        triggerChance: 0.25,
        realmFilter: null,
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { healParty: 0.2, restoreMana: 0.3, spawnCombat: { countMult: 0.5 } },
            },
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 0.75 } },
            },
        ],
    },
    rival_expedition: {
        triggerChance: 0.2,
        realmFilter: null,
        minDifficulty: 1,
        safeIndex: 2,
        choices: [
            {
                effects: { grantLoot: { type: 'realm_roll', mult: 1.25 } },
            },
            {
                effects: { spawnCombat: { countMult: 1.0 }, grantLoot: { type: 'realm_roll', mult: 1.5 }, nextLootRareMult: 1.5 },
            },
            {
                effects: {},
            },
        ],
    },
    bleeding_altar: {
        triggerChance: 0.45,
        realmFilter: ['void_hollow', 'void_sanctum', 'void_heart'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { voidDrainedSacrifice: 25, nextLootRareMult: 2.0 },
            },
            {
                effects: {},
            },
            {
                effects: { sacrificeLootForAltarBless: true },
            },
        ],
    },
    brokers_table: {
        triggerChance: 0.35,
        realmFilter: ['void_sanctum', 'void_heart'],
        minDifficulty: 1,
        safeIndex: 1,
        choices: [
            {
                effects: { partyDamagePercent: 0.15, expeditionWeaponBuff: 8 },
            },
            {
                effects: { spawnCombat: { countMult: 1.0 } },
            },
        ],
    },
    fractured_portal: {
        triggerChance: 0.40,
        realmFilter: ['fracture_gate', 'shifting_labyrinth', 'unraveling_core'],
        minDifficulty: 1,
        safeIndex: 0,
        choices: [
            {
                effects: { healParty: 0.05, nextLootRareMult: 1.5 },
            },
            {
                effects: { randomPortal: true },
            },
        ],
    },
};
stampLoc(EXPEDITION_DECISIONS, 'exp_decision');

// Puzzle encounters.
export const PUZZLE_ENCOUNTERS = {
    ancient_runes: {
        triggerWeight: 10,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        checks: [
            {
                requirement: { skill: 'research', minLevel: 7 },
                traitBonus: ['scholar'],
                success: { reward: { type: 'bonus_loot', mult: 2.0 } },
                failure: { penalty: { type: 'damage', amount: [10, 20] } },
            },
            {
                requirement: { skill: 'building', minLevel: 6 },
                traitBonus: ['tough', 'sturdy'],
                success: { reward: { type: 'bonus_loot', mult: 1.0 }, penalty: { type: 'spawn_combat' } },
                failure: { penalty: { type: 'damage', amount: [5, 15] } },
            },
        ],
    },
    unstable_bridge: {
        triggerWeight: 8,
        realmFilter: null,
        checks: [
            {
                requirement: { traitAny: ['quick', 'lucky'] },
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'damage_all', amount: [5, 10] } },
            },
            {
                requirement: null,
                success: { reward: null },
                failure: null,
            },
        ],
    },
    crystal_lock: {
        triggerWeight: 7,
        realmFilter: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        checks: [
            {
                requirement: { skill: 'research', minLevel: 6 },
                traitBonus: ['scholar'],
                success: { reward: { type: 'bonus_loot', mult: 2.5 } },
                failure: { penalty: { type: 'damage', amount: [8, 16] } },
            },
            {
                requirement: { skill: 'crafting', minLevel: 6 },
                traitBonus: ['creative'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'damage', amount: [3, 8] } },
            },
        ],
    },
    overgrown_path: {
        triggerWeight: 8,
        realmFilter: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        checks: [
            {
                requirement: { skill: 'farming', minLevel: 6 },
                traitBonus: ['green_thumb'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'damage', amount: [5, 12] } },
            },
            {
                requirement: null,
                traitBonus: ['tough'],
                success: { reward: null },
                failure: { penalty: { type: 'damage_all', amount: [3, 6] } },
            },
        ],
    },
    barred_gate: {
        triggerWeight: 8,
        realmFilter: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'],
        checks: [
            {
                requirement: { skill: 'building', minLevel: 7 },
                traitBonus: ['tough', 'sturdy'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'spawn_combat' } },
            },
            {
                requirement: { skill: 'research', minLevel: 8 },
                traitBonus: ['scholar'],
                success: { reward: { type: 'bonus_loot', mult: 2.5 } },
                failure: { penalty: { type: 'damage', amount: [10, 20] } },
            },
        ],
    },
    river_crossing: {
        triggerWeight: 8,
        realmFilter: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        checks: [
            {
                requirement: { skill: 'farming', minLevel: 6 },
                traitBonus: ['green_thumb', 'tough'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'damage_all', amount: [5, 10] } },
            },
            {
                requirement: { traitAny: ['quick', 'lucky'] },
                success: { reward: null },
                failure: { penalty: { type: 'damage', amount: [5, 12] } },
            },
        ],
    },
    void_seal: {
        triggerWeight: 7,
        realmFilter: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        checks: [
            {
                requirement: { skill: 'research', minLevel: 7 },
                traitBonus: ['scholar'],
                success: { reward: { type: 'bonus_loot', mult: 2.5 } },
                failure: { penalty: { type: 'damage_all', amount: [8, 15] } },
            },
            {
                requirement: { skill: 'building', minLevel: 7 },
                traitBonus: ['tough', 'sturdy'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 }, penalty: { type: 'spawn_combat' } },
                failure: { penalty: { type: 'damage', amount: [10, 18] } },
            },
        ],
    },
    collapsed_tunnel: {
        triggerWeight: 8,
        realmFilter: null,
        checks: [
            {
                requirement: { skill: 'building', minLevel: 6 },
                traitBonus: ['tough', 'sturdy'],
                success: { reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { penalty: { type: 'damage', amount: [8, 16] } },
            },
            {
                requirement: null,
                success: { reward: null },
                failure: null,
            },
        ],
    },
    price_ledger: {
        triggerWeight: 8,
        realmFilter: ['void_sanctum', 'void_heart'],
        checks: [
            {
                skill: 'research', minLevel: 5,
                traitBonus: ['scholar'],
            },
            {
                skill: 'crafting', minLevel: 4,
                traitBonus: ['creative'],
            },
        ],
    },
    shifting_map: {
        triggerWeight: 10,
        realmFilter: ['shifting_labyrinth', 'unraveling_core'],
        checks: [
            {
                skill: 'research', minLevel: 6,
                traitBonus: ['scholar'],
            },
            {
                skill: 'building', minLevel: 5,
                traitBonus: ['sturdy'],
            },
        ],
    },
};
stampLoc(PUZZLE_ENCOUNTERS, 'puzzle');

// NPC encounters.
export const NPC_ENCOUNTERS = {
    wounded_traveler: {
        sprite: 'npc_wounded_traveler',
        triggerWeight: 6,
        realmFilter: null,
        choices: [
            {
                requirement: { spellAny: ['mend', 'renewal'] },
                cost: { mana: 10 },
                result: { reward: { type: 'realm_roll', mult: 2.0 } },
            },
            {
                cost: { potionSlots: 1 },
                result: { reward: { type: 'reveal_encounters', count: 2 } },
            },
            {
                result: {  },
            },
        ],
    },
    mercenary: {
        sprite: 'npc_mercenary',
        triggerWeight: 4,
        realmFilter: null,
        choices: [
            {
                cost: { loot: { resource: 'runite', amount: 3 } },
                result: {
                    reward: { type: 'temp_ally', ally: { hp: 80, damage: 12, char: 'M', color: '#ccaa44', duration: 2, sprite: 'npc_mercenary' } },
                },
            },
            {
                result: {  },
            },
        ],
    },
    lost_scholar: {
        sprite: 'npc_lost_scholar',
        triggerWeight: 5,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        choices: [
            {
                result: {
                    reward: { type: 'bonus_loot', mult: 1.5 },
                },
            },
            {
                cost: { potionSlots: 1 },
                result: { reward: { type: 'bonus_loot', mult: 2.0 } },
            },
            {
                result: {  },
            },
        ],
    },
    shadow_merchant: {
        sprite: 'npc_shadow_merchant',
        triggerWeight: 3,
        realmFilter: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        choices: [
            {
                cost: { loot: { resource: 'void_essence', amount: 2 } },
                result: { reward: { type: 'heal_party', amount: 0.3 } },
            },
            {
                cost: { loot: { resource: 'void_essence', amount: 3 } },
                result: { reward: { type: 'buff_party', damageMult: 1.3, duration: 2 } },
            },
            {
                result: {  },
            },
        ],
    },
    defecting_soldier: {
        sprite: 'npc_defecting_soldier',
        triggerWeight: 5,
        realmFilter: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'],
        choices: [
            {
                cost: { potionSlots: 1 },
                result: {
                    reward: { type: 'temp_ally', ally: { hp: 90, damage: 13, char: 'D', color: '#ccaa44', duration: 2, sprite: 'npc_defecting_soldier' } },
                },
            },
            {
                cost: { loot: { resource: 'gold', amount: 3 } },
                result: { reward: { type: 'reveal_encounters', count: 3 } },
            },
            {
                result: {  },
            },
        ],
    },
    trapped_miner: {
        sprite: 'npc_trapped_miner',
        triggerWeight: 5,
        realmFilter: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        choices: [
            {
                cost: { potionSlots: 1 },
                result: {
                    reward: { type: 'temp_ally', ally: { hp: 85, damage: 11, char: 'M', color: '#88bbcc', duration: 2, sprite: 'npc_trapped_miner' } },
                },
            },
            {
                result: { reward: { type: 'reveal_encounters', count: 2 } },
            },
            {
                result: {  },
            },
        ],
    },
    wandering_druid: {
        sprite: 'npc_wandering_druid',
        triggerWeight: 5,
        realmFilter: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        choices: [
            {
                cost: { loot: { resource: 'berries', amount: 5 } },
                result: { reward: { type: 'heal_party', amount: 0.3 } },
            },
            {
                cost: { loot: { resource: 'berries', amount: 8 } },
                result: { reward: { type: 'buff_party', damageMult: 1.3, duration: 2 } },
            },
            {
                result: {  },
            },
        ],
    },
    spectral_professor: {
        sprite: 'npc_spectral_professor',
        triggerWeight: 4,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        choices: [
            {
                cost: { potionSlots: 1 },
                result: { reward: { type: 'bonus_loot', mult: 2.0 } },
            },
            {
                result: { reward: { type: 'reveal_encounters', count: 3 } },
            },
            {
                result: {  },
            },
        ],
    },
    strange_totem: {
        sprite: 'npc_strange_totem',
        triggerWeight: 4,
        realmFilter: null,
        choices: [
            {
                cost: { potionSlots: 1 },
                result: { reward: { type: 'buff_party', damageMult: 1.3, duration: 3 } },
            },
            {
                result: { reward: { type: 'realm_roll', mult: 1.0 } },
            },
            {
                result: {  },
            },
        ],
    },
};
stampLoc(NPC_ENCOUNTERS, 'npc');

// Expedition potions.
export const EXPEDITION_POTIONS = {
    health_potion: {
        resource: 'health_potion',
        maxCarry: 5, useCondition: 'combat',
        effect: { healTarget: 0.5 },
        autoUse: { hpThreshold: 0.3 },
    },
    mana_potion: {
        resource: 'mana_potion',
        maxCarry: 5, useCondition: 'combat',
        effect: { restoreMana: 0.5 },
        autoUse: { manaThreshold: 0.2 },
    },
    antidote: {
        resource: 'antidote',
        maxCarry: 5, useCondition: 'any',
        effect: { clearDot: true },
        autoUse: { hasDot: true },
    },
    battle_tonic: {
        resource: 'battle_tonic',
        maxCarry: 3, useCondition: 'combat',
        effect: { buffCombat: { attackSpeed: 0.3, critChance: 0.15, duration: 5 } },
        autoUse: { hpAbove: 0.7, onBoss: true },
    },
    smoke_draught: {
        resource: 'smoke_draught',
        maxCarry: 3, useCondition: 'combat',
        effect: { buffDefense: { dodgeChance: 0.35, duration: 5 } },
        autoUse: { hpThreshold: 0.7 },
    },
    lifesteal_elixir: {
        resource: 'lifesteal_elixir',
        maxCarry: 3, useCondition: 'combat',
        effect: { buffCombat: { hpOnKill: 25, duration: 5 } },
        autoUse: { anyMemberAtOrBelow: 0.4 },
    },
    loot_elixir: {
        resource: 'loot_elixir',
        maxCarry: 2, useCondition: 'entry',
        effect: { buffLoot: { lootMult: 1.5, rareEncounterMult: 1.4 } },
        autoUse: { onEntry: true },
    },
    rally_brew: {
        resource: 'rally_brew',
        maxCarry: 3, useCondition: 'combat',
        effect: { rallyParty: { healPercent: 0.2, clearSlow: true } },
        autoUse: { anyMemberSlowed: true },
    },
    mana_surge: {
        resource: 'mana_surge',
        maxCarry: 4, useCondition: 'combat',
        effect: { restoreMana: 0.3, buffCombat: { spellCostReduction: 0.25, duration: 5 } },
        autoUse: { manaThreshold: 0.4, requiresMana: true },
    },
};
stampLoc(EXPEDITION_POTIONS, 'exp_potion');

export const POTION_CARRY_CONFIG = {
    packAnimalBonus: 2,
};

// Expedition mutators.
export const EXPEDITION_MUTATORS = {
    dense_fog: {
        effects: { missChanceMod: 0.2, lootAmountMult: 1.3 },
        incompatible: [],
    },
    blood_moon: {
        effects: { enemyDmgMult: 1.5, rareLootMult: 1.5 },
        incompatible: [],
    },
    veterans_march: {
        effects: { durationMult: 0.7, enemyHpMult: 1.25 },
        incompatible: [],
    },
    arcane_surge: {
        effects: { spellDamageMult: 1.5, enemyPhysicalResist: 0.2 },
        incompatible: [],
    },
    thorns_aura: {
        effects: { globalThorns: 5, enemyHpMult: 1.2 },
        incompatible: [],
    },
    packmasters_bounty: {
        effects: { lootBonusFlat: 2, partyDamageMult: 0.8 },
        incompatible: [],
    },
};
stampLoc(EXPEDITION_MUTATORS, 'mutator');

// Fatigue cooldowns.
export const FATIGUE_CONFIG = {
    baseCooldownTicks: 200,
    difficultyMult: { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.0 },
    defeatPenalty: 1.5,
    maxCooldownTicks: 1000,
};

// Expedition streaks.
export const STREAK_CONFIG = {
    historyLength: 10,
    sameRealmDiminishing: { 2: 0.9, 3: 0.75, 4: 0.6, 5: 0.5 },
    varietyBonus: {
        uniqueRealmsForBonus: 3,
        lootMult: 1.25,
        rareLootMult: 1.5,
    },
};
stampLoc({ streak: STREAK_CONFIG }, 'config');

// Expedition XP.
export const EXPEDITION_XP_CONFIG = {
    xpPerEncounter: 1,
    xpPerBossKill: 5,
    xpPerPuzzleSolved: 2,
    xpPerDecision: 1,
    xpToLevel: 10,
    xpScalePerLevel: 5,
    maxLevel: 10,
    levelBonuses: {
        1:  { expeditionDamageMult: 1.05 },
        2:  { trapDamageMult: 0.9 },
        3:  { ability: 'scout' },
        4:  { expeditionDamageMult: 1.1 },
        5:  { ability: 'rally' },
        6:  { rareEncounterMult: 1.15 },
        7:  { expeditionDamageMult: 1.15 },
        8:  { ability: 'ambush' },
        9:  { trapDamageMult: 0.8 },
        10: { ability: 'veteran', fatigueMult: 0.5 },
    },
};

// Animal expedition XP and leveling (pack animals and war beasts).
export const ANIMAL_XP_CONFIG = {
    maxLevel: 5,
    xpToLevel: 5,
    xpScalePerLevel: 3,     // thresholds: 5, 8, 11, 14, 17 XP (55 total to cap, ~11-18 expeditions)
    xpPerCombatEncounter: 1,
    xpPerBossKill: 3,

    levelBonuses: {
        warBeast: {
            // Cumulative HP/damage added on top of the reduced base stats in entities.js.
            // Max: wolf 40+45=65 HP, 7+5=12 dmg; boar 45+45=70 HP, 10+5=15 dmg
            1: { hpBonus: 5,  damageBonus: 1 },
            2: { hpBonus: 8,  damageBonus: 1 },
            3: { hpBonus: 10, damageBonus: 1 },
            4: { hpBonus: 10, damageBonus: 1 },
            5: { hpBonus: 12, damageBonus: 1 },
        },
        packAnimal: {
            // Cumulative speed bonus additions.
            // Max: deer 0.05+0.12=17%, okapi 0.13+0.12=25% (matches old unleveled value)
            1: { speedBonusAdd: 0.02 },
            2: { speedBonusAdd: 0.02 },
            3: { speedBonusAdd: 0.03 },
            4: { speedBonusAdd: 0.03 },
            5: { speedBonusAdd: 0.02 },
        },
    },
};

// Realm events.
export const REALM_EVENTS = {
    crystal_surge: {
        realms: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        effects: { resourceMult: { runite: 2.0 }, enemyHpMult: 1.5 },
        duration: [2000, 4000],
        weight: 10,
    },
    void_tide: {
        realms: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        effects: { resourceMult: { void_essence: 1.75 }, enemyAoEChance: 0.15, enemyAoEDamage: [3, 6] },
        duration: [2500, 5000],
        weight: 8,
    },
    arcane_residue: {
        realms: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        effects: { manaRegenMult: 2.0, lootAmountMult: 1.3 },
        duration: [1500, 3000],
        weight: 8,
    },
    verdant_bloom: {
        realms: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        effects: { resourceMult: { berries: 1.5, potatoes: 1.5, wheat: 1.5 }, enemyRegenPerRound: 0.03 },
        duration: [2000, 3500],
        weight: 8,
    },
    crusade_muster: {
        realms: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'],
        effects: { resourceMult: { gold: 1.5 }, lootAmountMult: 1.3, enemyDmgMult: 1.4 },
        duration: [2000, 4000],
        weight: 8,
    },
    seismic_tremor: {
        realms: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        effects: { resourceMult: { stone: 1.75, runite: 1.75 }, enemyAoEChance: 0.12, enemyAoEDamage: [2, 5] },
        duration: [1500, 3000],
        weight: 8,
    },
};
stampLoc(REALM_EVENTS, 'realm_event');

export const REALM_EVENT_CONFIG = {
    checkInterval: 500,
    maxActiveEvents: 2,
    baseChance: 0.15,
};

// Bestiary.
export const BESTIARY_CONFIG = {
    categories: {
        regular: { color: '#ff4444' },
        elite: { color: '#ff8844' },
        boss: { color: '#ffcc44' },
        npc: { color: '#44ccff' },
    },
    completionRewards: {
        25: { type: 'loot_bonus', value: 1.05 },
        50: { type: 'loot_bonus', value: 1.1 },
        75: { type: 'rare_bonus', value: 1.15 },
        100: { type: 'title' },
    },
};
// `fields` is TEXT_FIELDS plus `value` (the title reward), spelled out because
// extract-config.mjs reads stampLoc options as literals.
stampLoc({ bestiary: BESTIARY_CONFIG }, 'config', { fields: ['name', 'description', 'desc', 'text', 'label', 'lore', 'title', 'summary', 'prefix', 'suffix', 'notification', 'message', 'detail', 'logMessage', 'logText', 'transitionText', 'armorText', 'successText', 'failText', 'approachText', 'defeatText', 'arrivalText', 'promptText', 'logAccept', 'logRefuse', 'flavor', 'flavour', 'tooltip', 'hint', 'displayName', 'subtitle', 'value'] });

// Node map.
export const NODE_MAP_CONFIG = {
    nodeTypes: {
        combat:   { icon: '⚔', color: '#ff4444' },
        loot:     { icon: '◆', color: '#ffcc44' },
        decision: { icon: '?', color: '#44ccff' },
        puzzle:   { icon: '⊕', color: '#aa88ff' },
        npc:      { icon: '☺', color: '#88ff88' },
        boss:     { icon: '☠', color: '#ff8844' },
    },
    canvasHeight: 60,
    nodeRadius: 10,
    nodeSpacing: 50,
    lineColor: '#333',
    completedColor: '#666',
    currentColor: '#ffffff',
    futureColor: '#444',
};
stampLoc({ node_map: NODE_MAP_CONFIG }, 'config');

// Wave defense (void nexus) tuning. Used by waves.js.
export const WAVE_CONFIG = {
    baseEnemies: 4,              // enemies in wave 1
    enemiesPerWave: 2,           // additional enemies per wave after wave 1
    spawnInterval: 15,           // ticks between enemy spawns during a wave
    essencePerKill: 1,           // void essence earned per kill
    nexusHp: 200,                // starting HP of the void nexus
    nexusHpPerWave: 0,           // additional nexus HP per wave (0 = static)
    colonistCapBase: 3,          // starting colonist cap before any waves
    colonistCapMax: 12,          // fallback maximum colonist cap (used when the map width has no entry below)
    repathInterval: 20,          // ticks before wave enemies recalculate path
    spawnDistance: { near: 25, far: 50, offsetRange: 10 }, // portal spawn distances from nexus
    maxPathNodes: 2000,          // A* node limit for wave enemy pathfinding
    bonusEssencePerWave: 2,      // multiplied by wave number for completion bonus
};

// Per-world-size colony tuning, keyed by map width (matches the world-size presets).
// capPerMilestone is how much each reached COLONY_MILESTONES entry raises the colonist cap;
// the summed cap is floored, so fractional steps never yield a fractional colonist.
// capMax is the world's colonist ceiling: base 3 + all 9 milestones at the size's step, floored.
export const WORLD_SIZE_COLONY = {
    128: { capPerMilestone: 1,   capMax: 12 },
    256: { capPerMilestone: 1.5, capMax: 16 },
    384: { capPerMilestone: 2,   capMax: 21 },
};

// Ordered list of milestones that each raise the colonist cap by the world's capPerMilestone.
// type 'wave': fires when game.waves.highestWaveCompleted >= threshold
// type 'realm_order': fires when any realm with chainOrder === order has been completed
// type 'chains_completed': fires when countCompletedChains() >= count
export const COLONY_MILESTONES = [
    { key: 'wave_1',        type: 'wave',            threshold: 1 },
    { key: 'realm_order_1', type: 'realm_order',     order: 1 },
    { key: 'wave_3',        type: 'wave',            threshold: 3 },
    { key: 'realm_order_2', type: 'realm_order',     order: 2 },
    { key: 'chain_1',       type: 'chains_completed', count: 1 },
    { key: 'wave_6',        type: 'wave',            threshold: 6 },
    { key: 'chain_2',       type: 'chains_completed', count: 2 },
    { key: 'wave_9',        type: 'wave',            threshold: 9 },
    { key: 'chain_3',       type: 'chains_completed', count: 3 },
];
stampLoc(COLONY_MILESTONES, 'colony_milestone');

// Returns how many full realm chains (all 3 chainOrder tiers present in completedRealms) have been completed.
// The 'scouting' chain has only 1 realm and no boss, so it is excluded from the count.
export function countCompletedChains(completedRealms) {
    const chains = new Set();
    for (const def of Object.values(REALMS)) {
        if (def.chain !== 'scouting') chains.add(def.chain);
    }
    let completed = 0;
    for (const chain of chains) {
        const allDone = Object.entries(REALMS)
            .filter(([, def]) => def.chain === chain)
            .every(([key]) => completedRealms.has(key));
        if (allDone) completed++;
    }
    return completed;
}

// ============================================================================
// STORY MILESTONES - SPOILER WARNING!
// The text below contains narrative spoilers for Rifthold.
// Do not read ahead if you want to experience the story organically in-game.
// ============================================================================

export const STORY_MILESTONES = {
    // -----------------------------------------------------------------------
    // Colony tab: narrative story beats about your colony's journey
    // -----------------------------------------------------------------------
    first_building: {
        tab: 'colony',
        trigger: 'first_building_placed',
    },
    colony_5: {
        tab: 'colony',
        trigger: 'colonist_count_5',
    },
    colony_10: {
        tab: 'colony',
        trigger: 'colonist_count_10',
    },
    first_raid_survived: {
        tab: 'colony',
        trigger: 'first_raid_survived',
    },
    first_crusader_raid_survived: {
        tab: 'colony',
        trigger: 'first_crusader_raid_survived',
    },
    first_mental_break: {
        tab: 'colony',
        trigger: 'first_mental_break',
    },
    first_death: {
        tab: 'colony',
        trigger: 'first_colonist_death',
    },
    first_tame: {
        tab: 'colony',
        trigger: 'first_animal_tamed',
    },
    first_trade: {
        tab: 'colony',
        trigger: 'first_trade_completed',
    },
    first_spell: {
        tab: 'colony',
        trigger: 'first_spell_cast',
    },
    first_friend: {
        tab: 'colony',
        trigger: 'first_friend_made',
    },
    first_love: {
        tab: 'colony',
        trigger: 'first_lover_made',
    },
    first_winter_feast: {
        tab: 'colony',
        trigger: 'first_winter_feast',
    },
    first_wave_complete: {
        tab: 'colony',
        trigger: 'first_wave_completed',
    },
    // -----------------------------------------------------------------------
    // Research tab: knowledge and technology discoveries
    // -----------------------------------------------------------------------
    research_runecraft: {
        tab: 'research',
        trigger: 'research_runecraft',
    },
    research_beast_binding: {
        tab: 'research',
        trigger: 'research_beast_binding',
    },
    research_ley_channeling: {
        tab: 'research',
        trigger: 'research_ley_channeling',
    },
    research_arcane_studies: {
        tab: 'research',
        trigger: 'research_arcane_studies',
    },
    research_void_summoning: {
        tab: 'research',
        trigger: 'research_void_summoning',
    },
    research_planar_rift: {
        tab: 'research',
        trigger: 'research_planar_rift',
    },
    research_deep_delving: {
        tab: 'research',
        trigger: 'anchor_shadow',
    },
    research_golem_craft: {
        tab: 'research',
        trigger: 'research_golem_craft',
    },
    research_herbalism: {
        tab: 'research',
        trigger: 'research_herbalism',
    },
    research_void_architecture: {
        tab: 'research',
        trigger: 'research_void_architecture',
    },
    research_mana_reservoir: {
        tab: 'research',
        trigger: 'research_mana_reservoir',
    },
    research_alchemy: {
        tab: 'research',
        trigger: 'research_alchemy',
    },
    research_trade_routes: {
        tab: 'research',
        trigger: 'research_trade_routes',
    },
    research_arcane_infusion: {
        tab: 'research',
        trigger: 'research_arcane_infusion',
    },
    research_warding: {
        tab: 'research',
        trigger: 'research_warding',
    },
    research_void_forging: {
        tab: 'research',
        trigger: 'research_void_forging',
    },
    research_masterwork: {
        tab: 'research',
        trigger: 'research_masterwork',
    },
    research_advanced_arcana: {
        tab: 'research',
        trigger: 'research_advanced_arcana',
    },
    research_mana_weaving: {
        tab: 'research',
        trigger: 'research_mana_weaving',
    },
    research_void_sorcery: {
        tab: 'research',
        trigger: 'research_void_sorcery',
    },

    // -----------------------------------------------------------------------
    // Races tab: lore about the peoples of the world
    // -----------------------------------------------------------------------
    first_bufos_colonist: {
        tab: 'races',
        trigger: 'first_bufos_colonist_arrived',
    },
    first_kobalos_colonist: {
        tab: 'races',
        trigger: 'first_kobalos_colonist_arrived',
    },
    first_ferin_colonist: {
        tab: 'races',
        trigger: 'first_ferin_colonist_arrived',
    },
    first_nymph_colonist: {
        tab: 'races',
        trigger: 'first_nymph_colonist_arrived',
    },
    first_human_colonist: {
        tab: 'races',
        trigger: 'first_human_colonist_arrived',
    },
    // -----------------------------------------------------------------------
    // Realms tab: exploration journals from other worlds
    // -----------------------------------------------------------------------
    realm_wild_frontiers: {
        tab: 'realms',
        realmGroup: 'The Wild Frontiers',
        trigger: 'realm_wild_frontiers',
    },
    realm_verdant_depths: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        trigger: 'realm_verdant_depths',
    },
    realm_fungal_hollows: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        trigger: 'realm_fungal_hollows',
    },
    realm_primeval_canopy: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        trigger: 'realm_primeval_canopy',
    },
    realm_crystal_caves: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        trigger: 'realm_crystal_caves',
    },
    realm_crystal_mines: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        trigger: 'realm_crystal_mines',
    },
    realm_crystal_depths: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        trigger: 'realm_crystal_depths',
    },
    realm_arcane_library: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        trigger: 'realm_arcane_library',
    },
    realm_ancient_university: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        trigger: 'realm_ancient_university',
    },
    realm_abandoned_laboratory: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        trigger: 'realm_abandoned_laboratory',
    },
    realm_shadow_realm: {
        tab: 'realms',
        realmGroup: 'The Abyss',
        trigger: 'realm_shadow_realm',
    },
    realm_void_abyss: {
        tab: 'realms',
        realmGroup: 'The Abyss',
        trigger: 'realm_void_abyss',
    },
    realm_oblivion_rift: {
        tab: 'realms',
        realmGroup: 'The Abyss',
        trigger: 'realm_oblivion_rift',
    },
    // ── Void Nexus / Void Whispers ───────────────────────────────────────────
    void_nexus_built: {
        tab: 'colony',
        trigger: 'void_nexus_placed',
    },
    void_whisper_first_accepted: {
        tab: 'colony',
        trigger: 'void_whisper_first_accepted',
    },
    void_whisper_refused_3: {
        tab: 'colony',
        trigger: 'void_whisper_refused_3',
    },
    void_whisper_accepted_5: {
        tab: 'colony',
        trigger: 'void_whisper_accepted_5',
    },
    void_whisper_veil_parted: {
        tab: 'colony',
        trigger: 'void_whisper_veil_parted',
    },
    waves_10_complete: {
        tab: 'colony',
        trigger: 'waves_10_complete',
    },
    // ── Void Pact realms ────────────────────────────────────────────────────
    realm_void_hollow: {
        tab: 'realms',
        realmGroup: 'The Void Pact',
        trigger: 'realm_void_hollow',
    },
    realm_void_sanctum: {
        tab: 'realms',
        realmGroup: 'The Void Pact',
        trigger: 'realm_void_sanctum',
    },
    realm_void_heart: {
        tab: 'realms',
        realmGroup: 'The Void Pact',
        trigger: 'realm_void_heart',
    },
    // ── Chaos realms ────────────────────────────────────────────────────────
    realm_fracture_gate: {
        tab: 'realms',
        realmGroup: 'The Unraveling',
        trigger: 'realm_fracture_gate',
    },
    realm_shifting_labyrinth: {
        tab: 'realms',
        realmGroup: 'The Unraveling',
        trigger: 'realm_shifting_labyrinth',
    },
    realm_unraveling_core: {
        tab: 'realms',
        realmGroup: 'The Unraveling',
        trigger: 'realm_unraveling_core',
    },
    realm_kingdom_outskirts: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        trigger: 'realm_kingdom_outskirts',
    },
    realm_crusader_barracks: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        trigger: 'realm_crusader_barracks',
    },
    realm_palace_fortress: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        trigger: 'realm_palace_fortress',
        // The story panel renders the "Return Home (Epilogue)" button for this
        // entry. It can't live in `text`: sanitizeHtml strips buttons and handlers.
        epilogueButton: true,
    },
};
stampLoc(STORY_MILESTONES, 'story_milestone');

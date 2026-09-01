// Named enemy catalog — each enemy type has base stats, a sprite, and a color.
// Realms reference these by key with a spawn weight.
export const EXPEDITION_ENEMIES = {
    // Crystal chain
    crystal_bat:      { name: 'Crystal Bat',      hp: [20, 35],  damage: [3, 6],  sprite: 'crystal_bat', color: '#6688ff' },
    crystal_golem:    { name: 'Crystal Golem',     hp: [50, 80],  damage: [6, 10], sprite: 'crystal_golem', color: '#4466cc' },
    shard_spider:     { name: 'Shard Spider',      hp: [30, 50],  damage: [5, 8],  sprite: 'shard_spider', color: '#88aaff' },
    runite_elemental: { name: 'Runite Elemental',  hp: [80, 130], damage: [9, 14], sprite: 'runite_elemental', color: '#44ccff', spells: [{ spell: 'arcane_bolt', chance: 0.25, damage: [8, 14] }] },
    crystal_wurm:     { name: 'Crystal Wurm',      hp: [100, 160],damage: [11, 17],sprite: 'crystal_wurm', color: '#3355aa' },

    // Verdant chain
    vine_creeper:     { name: 'Vine Creeper',      hp: [20, 35],  damage: [3, 5],  sprite: 'vine_creeper', color: '#44aa44' },
    thorn_beast:      { name: 'Thorn Beast',       hp: [40, 65],  damage: [5, 9],  sprite: 'thorn_beast', color: '#338833' },
    spore_walker:     { name: 'Spore Walker',      hp: [35, 55],  damage: [4, 7],  sprite: 'spore_walker', color: '#88aa44', spells: [{ spell: 'poison_cloud', chance: 0.2, damage: [3, 6], dot: { damage: [2, 3], ticks: 3, interval: 10 } }] },
    fungal_horror:    { name: 'Fungal Horror',     hp: [55, 90],  damage: [6, 11], sprite: 'fungal_horror', color: '#669944', spells: [{ spell: 'spore_burst', chance: 0.2, damage: [4, 8], aoe: true }] },
    canopy_stalker:   { name: 'Canopy Stalker',    hp: [70, 120], damage: [8, 13], sprite: 'canopy_stalker', color: '#226622' },

    // Arcane chain
    arcane_wisp:      { name: 'Arcane Wisp',       hp: [15, 30],  damage: [4, 7],  sprite: 'arcane_wisp', color: '#aa88ff', spells: [{ spell: 'arcane_bolt', chance: 0.3, damage: [5, 10] }] },
    tome_guardian:     { name: 'Tome Guardian',     hp: [50, 80],  damage: [6, 10], sprite: 'tome_guardian', color: '#8866cc' },
    spell_wraith:     { name: 'Spell Wraith',      hp: [40, 70],  damage: [7, 12], sprite: 'spell_wraith', color: '#bb88ff', spells: [{ spell: 'soul_drain', chance: 0.25, damage: [6, 12], lifesteal: 0.5 }] },
    construct:        { name: 'Arcane Construct',   hp: [70, 120], damage: [8, 14], sprite: 'construct', color: '#6644aa', spells: [{ spell: 'arcane_blast', chance: 0.2, damage: [10, 16], aoe: true }] },
    lab_abomination:  { name: 'Lab Abomination',   hp: [90, 150], damage: [10, 16],sprite: 'lab_abomination', color: '#994488', spells: [{ spell: 'toxic_spray', chance: 0.2, damage: [5, 10], aoe: true, dot: { damage: [2, 4], ticks: 3, interval: 10 } }] },

    // Shadow chain
    shadow_imp:       { name: 'Shadow Imp',        hp: [40, 65],  damage: [6, 10], sprite: 'shadow_imp', color: '#885588' },
    void_stalker:     { name: 'Void Stalker',      hp: [60, 100], damage: [8, 13], sprite: 'void_stalker', color: '#664488', spells: [{ spell: 'void_bolt', chance: 0.2, damage: [8, 14] }] },
    shade:            { name: 'Shade',              hp: [80, 130], damage: [10, 15],sprite: 'shade', color: '#553377', spells: [{ spell: 'shadow_drain', chance: 0.2, damage: [6, 12], lifesteal: 0.3 }] },
    void_horror:      { name: 'Void Horror',       hp: [120, 180],damage: [12, 18],sprite: 'void_horror', color: '#442266', spells: [{ spell: 'void_blast', chance: 0.25, damage: [10, 18], aoe: true }] },
    oblivion_spawn:   { name: 'Oblivion Spawn',    hp: [150, 230],damage: [14, 21],sprite: 'oblivion_spawn', color: '#331155', spells: [{ spell: 'annihilate', chance: 0.15, damage: [15, 25] }] },

    // Kingdom chain
    kingdom_guard:    { name: 'Kingdom Guard',     hp: [35, 55],  damage: [5, 8],  sprite: 'kingdom_guard', color: '#ccaa44' },
    knight:           { name: 'Knight',            hp: [60, 90],  damage: [7, 12], sprite: 'knight', color: '#bbaa33' },
    crusader:         { name: 'Crusader',          hp: [80, 120], damage: [9, 14], sprite: 'crusader', color: '#ddcc44' },
    royal_mage:       { name: 'Royal Mage',        hp: [50, 75],  damage: [10, 16],sprite: 'royal_mage', color: '#ffcc66', spells: [{ spell: 'holy_smite', chance: 0.3, damage: [8, 14] }, { spell: 'heal', chance: 0.2, healPct: 0.15 }] },
    palace_champion:  { name: 'Palace Champion',   hp: [100, 150],damage: [12, 18],sprite: 'palace_champion', color: '#ffdd88' },
};

// Exploration / realms. Used by exploration.js.
export const REALMS = {
    crystal_caves: {
        name: 'Crystal Caves', difficulty: 1,
        chain: 'crystal', chainOrder: 1,
        duration: [220, 380], encounters: 5, combatEncounters: [1, 2],
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        loot: [
            { resource: 'stone', weight: 40, amount: [5, 12] },
            { resource: 'runite', weight: 30, amount: [2, 5] },
            { resource: 'void_essence', weight: 10, amount: [1, 3] },
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'crystal_bat', weight: 50 },
            { key: 'shard_spider', weight: 30 },
            { key: 'crystal_golem', weight: 20 },
        ] },
        events: {
            ambient: [
                '{name} marvels at crystalline formations pulsing with light.',
                'The cave walls hum with resonant energy.',
                '{name} traces veins of glowing runite through the rock.',
                'Luminescent fungi illuminate a side passage.',
                'A crystal chime echoes from deep below.',
            ],
            discoveries: [
                '{name} cracks open a geode — raw runite inside!',
                '{name} finds a vein of pure crystal ore.',
                'A collapsed mining cart still holds usable stone.',
            ],
            traps: [
                'A crystal shard explodes near {name}!',
                '{name} slips on smooth crystal — hard landing!',
                'Unstable ceiling crystals rain down on {name}!',
            ],
            rare: [
                { chance: 0.05, text: '{name} discovers a resonating crystal chamber — bonus runite!', loot: { resource: 'runite', amount: [3, 6] } },
                { chance: 0.03, text: '{name} finds an ancient dwarven cache!', loot: { resource: 'stone', amount: [8, 15] } },
                { chance: 0.02, text: '{name} finds a strange compass embedded in crystal — it pulses with greed!', loot: { item: 'compass_of_greed' } },
            ],
        },
    },
    crystal_mines: {
        name: 'Crystal Mines', difficulty: 2,
        chain: 'crystal', chainOrder: 2,
        duration: [350, 550], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        requiresRealm: 'crystal_caves',
        loot: [
            { resource: 'runite', weight: 35, amount: [4, 9] },
            { resource: 'stone', weight: 25, amount: [6, 14] },
            { resource: 'void_essence', weight: 15, amount: [2, 5] },
            { item: 'drum_of_rallying', weight: 3 },
        ],
        enemies: { count: [3, 5], types: [
            { key: 'crystal_bat', weight: 20 },
            { key: 'shard_spider', weight: 35 },
            { key: 'crystal_golem', weight: 35 },
            { key: 'runite_elemental', weight: 10 },
        ] },
        events: {
            ambient: [
                '{name} hears the echoing clink of ancient pickaxes.',
                'The mineshaft vibrates with deep seismic rumbling.',
                '{name} passes collapsed tunnels sealed by crystal growth.',
                'Rail tracks rusted shut stretch deeper into the dark.',
                'Luminescent veins pulse in time with an unseen heartbeat.',
                '{name} finds old miner graffiti scratched into the wall.',
            ],
            discoveries: [
                '{name} breaks through a sealed chamber — pristine runite!',
                'An abandoned mine cart still holds a rich payload.',
                '{name} digs into a pocket of concentrated crystal ore.',
            ],
            traps: [
                'A ceiling collapse rains rubble on {name}!',
                '{name} triggers a tripwire — a pickaxe swings from the wall!',
                'Unstable ground gives way beneath {name}!',
                'A pressurized gas pocket bursts near {name}!',
            ],
            rare: [
                { chance: 0.04, text: '{name} finds a deep runite motherload!', loot: { resource: 'runite', amount: [6, 12] } },
                { chance: 0.03, text: '{name} discovers a crystallized void pocket deep underground!', loot: { resource: 'void_essence', amount: [4, 8] } },
                { chance: 0.015, text: '{name} unearths an ancient mining golem core — still humming with power!', loot: { item: 'boots_of_haste' } },
                { chance: 0.015, text: '{name} pries a ward stone from a sealed vault door!', loot: { item: 'ward_of_the_sentinel' } },
            ],
        },
    },
    crystal_depths: {
        name: 'Crystal Depths', difficulty: 3,
        chain: 'crystal', chainOrder: 3,
        duration: [500, 750], encounters: 8, combatEncounters: [2, 4],
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        requiresRealm: 'crystal_mines',
        loot: [
            { resource: 'runite', weight: 40, amount: [6, 14] },
            { resource: 'void_essence', weight: 25, amount: [3, 7] },
            { resource: 'stone', weight: 15, amount: [8, 18] },
            { item: 'ward_of_the_sentinel', weight: 3 },
        ],
        enemies: { count: [4, 7], types: [
            { key: 'shard_spider', weight: 15 },
            { key: 'crystal_golem', weight: 30 },
            { key: 'runite_elemental', weight: 35 },
            { key: 'crystal_wurm', weight: 20 },
        ] },
        boss: {
            name: 'The Crystal Colossus',
            hp: 500, damage: 25,
            enrageThreshold: 0.3, enrageDamageMult: 1.5,
            color: '#4488ff', enragedColor: '#ff2222',
            sprite: 'boss_crystal_colossus', enragedSprite: 'boss_crystal_colossus_enraged',
            guaranteedLoot: [
                { item: 'crystal_aegis', chance: 0.5 },
                { item: 'runite_hammer', chance: 0.5 },
            ],
            bonusResources: { runite: 8, void_essence: 4 },
            defeatText: 'The Crystal Colossus shatters into a thousand gleaming shards!',
            enrageText: 'The Crystal Colossus cracks and glows red! It becomes enraged!',
            approachText: 'A massive crystalline figure rises from the depths, blocking the path!',
        },
        events: {
            ambient: [
                '{name} feels immense pressure from the rock above.',
                'Crystals here grow in impossible spirals, defying gravity.',
                '{name} passes through a chamber lit entirely by runite veins.',
                'The air is thick with mineral dust that sparkles in torchlight.',
                'A low vibration pulses through the stone — something massive shifts below.',
                '{name} notices the crystals here are warm to the touch.',
            ],
            discoveries: [
                '{name} cracks open a massive geode — a motherlode of runite!',
                'A sealed dwarven vault still holds its treasures.',
                '{name} finds a vein of crystal so pure it hums with energy.',
            ],
            traps: [
                'A crystal stalactite shatters and rains razor shards on {name}!',
                '{name} triggers a pressure plate — the walls begin closing!',
                'Superheated steam vents from a crack, scalding {name}!',
                'The floor collapses into a crystal-lined sinkhole beneath {name}!',
            ],
            rare: [
                { chance: 0.04, text: '{name} discovers the legendary Crystal Heart — a massive runite formation!', loot: { resource: 'runite', amount: [10, 18] } },
                { chance: 0.03, text: '{name} finds a sealed primordial chamber full of void-infused crystal!', loot: { resource: 'void_essence', amount: [6, 12] } },
                { chance: 0.015, text: '{name} pries a shimmering gem from the deepest wall — it pulses with protective energy!', loot: { item: 'crystal_aegis' } },
                { chance: 0.01, text: '{name} uncovers an ancient crystalline forge still burning with arcane fire!', loot: { item: 'runite_hammer' } },
            ],
        },
    },
    verdant_depths: {
        name: 'Verdant Depths', difficulty: 1,
        chain: 'verdant', chainOrder: 1,
        duration: [150, 280], encounters: 4, combatEncounters: [1, 1],
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
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
            ambient: [
                '{name} pushes through thick vine curtains.',
                'Bioluminescent flowers line the path.',
                '{name} hears birdsong from an impossible direction.',
                'Giant mushrooms tower overhead, releasing spores.',
                'A stream of crystal-clear water crosses the trail.',
            ],
            discoveries: [
                '{name} finds a grove bursting with ripe fruit.',
                'Fallen timber lies ready for harvest.',
                '{name} discovers a hidden garden still bearing crops.',
            ],
            traps: [
                'A thorny vine snaps around {name}\'s leg!',
                '{name} stumbles into a pitcher plant — acid burns!',
                'Toxic pollen bursts from a flower near {name}!',
            ],
            rare: [
                { chance: 0.06, text: '{name} discovers a fertile seed cache — rare crops!', loot: { resource: 'potatoes', amount: [6, 10] } },
                { chance: 0.04, text: '{name} finds a druid\'s abandoned herb stash!', loot: { resource: 'berries', amount: [8, 12] } },
                { chance: 0.02, text: '{name} finds a golden charm shaped like a cornucopia!', loot: { item: 'cornucopia_charm' } },
            ],
        },
    },
    fungal_hollows: {
        name: 'Fungal Hollows', difficulty: 2,
        chain: 'verdant', chainOrder: 2,
        duration: [280, 450], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
        requiresRealm: 'verdant_depths',
        loot: [
            { resource: 'wood', weight: 35, amount: [10, 20] },
            { resource: 'berries', weight: 25, amount: [6, 12] },
            { resource: 'potatoes', weight: 20, amount: [5, 10] },
            { item: 'cornucopia_charm', weight: 3 },
        ],
        enemies: { count: [2, 5], types: [
            { key: 'vine_creeper', weight: 15 },
            { key: 'thorn_beast', weight: 30 },
            { key: 'spore_walker', weight: 30 },
            { key: 'fungal_horror', weight: 25 },
        ] },
        events: {
            ambient: [
                '{name} ducks under a canopy of phosphorescent mushroom caps.',
                'Spore clouds drift lazily through the cavern.',
                '{name} hears the squelch of something moving in the mycelium.',
                'Bioluminescent tendrils pulse in waves along the walls.',
                'The air is warm and humid, thick with the scent of decay and growth.',
                '{name} notices mushrooms growing visibly before their eyes.',
            ],
            discoveries: [
                '{name} finds a cluster of edible fungi — enormous and ripe.',
                'A fallen log teems with harvestable growth.',
                '{name} discovers a fungal garden tended by some long-gone cultivator.',
            ],
            traps: [
                'A puffball mushroom explodes in {name}\'s face — choking spores!',
                '{name} steps on a cap that snaps shut like a jaw!',
                'Acidic sap drips from above onto {name}!',
                'A vine whips out from the fungal mass, striking {name}!',
            ],
            rare: [
                { chance: 0.05, text: '{name} discovers a grove of giant truffles — incredibly valuable!', loot: { resource: 'potatoes', amount: [8, 14] } },
                { chance: 0.04, text: '{name} finds a cache of preserved seeds in a hollow tree!', loot: { resource: 'wheat', amount: [10, 16] } },
                { chance: 0.02, text: '{name} finds a living staff of intertwined roots that still grows!', loot: { item: 'staff_of_regrowth' } },
                { chance: 0.015, text: '{name} discovers a symbiotic fungal crown that enhances the mind!', loot: { item: 'mycelium_crown' } },
            ],
        },
    },
    primeval_canopy: {
        name: 'Primeval Canopy', difficulty: 3,
        chain: 'verdant', chainOrder: 3,
        duration: [400, 600], encounters: 7, combatEncounters: [2, 3],
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
        requiresRealm: 'fungal_hollows',
        loot: [
            { resource: 'wood', weight: 30, amount: [12, 24] },
            { resource: 'berries', weight: 20, amount: [8, 16] },
            { resource: 'potatoes', weight: 15, amount: [6, 12] },
            { resource: 'void_essence', weight: 10, amount: [2, 5] },
            { item: 'staff_of_regrowth', weight: 3 },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'thorn_beast', weight: 15 },
            { key: 'spore_walker', weight: 20 },
            { key: 'fungal_horror', weight: 35 },
            { key: 'canopy_stalker', weight: 30 },
        ] },
        boss: {
            name: 'The Ancient Treant',
            hp: 450, damage: 22,
            enrageThreshold: 0.3, enrageDamageMult: 1.5,
            color: '#22aa66', enragedColor: '#ff4400',
            sprite: 'boss_ancient_treant', enragedSprite: 'boss_ancient_treant_enraged',
            guaranteedLoot: [
                { item: 'living_bark_armor', chance: 0.5 },
                { item: 'heartwood_staff', chance: 0.5 },
            ],
            bonusResources: { wood: 15, berries: 10 },
            defeatText: 'The Ancient Treant groans and collapses, returning to the earth!',
            enrageText: 'The Ancient Treant roars! Roots erupt from the ground as it enrages!',
            approachText: 'The canopy shudders as an enormous living tree rises to block the party!',
        },
        events: {
            ambient: [
                '{name} climbs through roots thicker than castle walls.',
                'The canopy above blocks all sky — only bioluminescence lights the way.',
                '{name} hears the call of creatures that haven\'t existed for millennia.',
                'Ancient bark carvings depict a civilization built among these branches.',
                'A waterfall cascades from somewhere impossibly high above.',
                '{name} feels the forest watching them with a patient intelligence.',
            ],
            discoveries: [
                '{name} finds a treehouse larder still stocked with preserved fruit.',
                'A massive seed pod cracks open, revealing usable materials.',
                '{name} discovers a natural spring with restorative waters.',
            ],
            traps: [
                'A carnivorous flower snaps its petals around {name}!',
                '{name} disturbs a wasp nest the size of a cart!',
                'The branch beneath {name} snaps — long fall!',
                'Paralytic pollen fills the air around {name}!',
            ],
            rare: [
                { chance: 0.04, text: '{name} discovers the World-Root — a nexus of primal nature energy!', loot: { resource: 'void_essence', amount: [5, 9] } },
                { chance: 0.03, text: '{name} harvests from the legendary Ever-Fruit tree!', loot: { resource: 'berries', amount: [12, 20] } },
                { chance: 0.015, text: '{name} bonds with a seed of the World-Tree — it grows into living armor!', loot: { item: 'living_bark_armor' } },
                { chance: 0.01, text: '{name} discovers an ancient druid\'s heartwood staff, still thrumming with life magic!', loot: { item: 'heartwood_staff' } },
            ],
        },
    },
    arcane_library: {
        name: 'Arcane Library', difficulty: 2,
        chain: 'arcane', chainOrder: 1,
        duration: [180, 320], encounters: 4, combatEncounters: [1, 1],
        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        loot: [
            { resource: 'tome_of_magic_missile', weight: 20, amount: [1, 1] },
            { resource: 'tome_of_heal', weight: 20, amount: [1, 1] },
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
        research: 'arcane_studies',
        events: {
            ambient: [
                '{name} reads a passage from a floating book.',
                'Spectral librarians drift silently between shelves.',
                '{name} feels arcane knowledge pressing at the edges of their mind.',
                'A book flies off its shelf as the party passes.',
                'The smell of ancient parchment fills the air.',
                '{name} spots equations writing themselves on a chalkboard.',
            ],
            discoveries: [
                '{name} finds a scroll hidden between two heavy tomes.',
                'A secret shelf clicks open, revealing stored materials.',
                '{name} deciphers a map leading to a hidden alcove.',
            ],
            traps: [
                'A warded book shocks {name} upon touch!',
                '{name} triggers a glyph on the floor — arcane blast!',
                'An animated tome attacks {name} with paper cuts!',
            ],
            rare: [
                { chance: 0.05, text: '{name} discovers a sealed headmaster\'s vault — rare tome inside!', loot: { resource: 'tome_of_magic_missile', amount: [1, 1] } },
                { chance: 0.04, text: '{name} finds a cache of enchanting runite!', loot: { resource: 'runite', amount: [3, 5] } },
                { chance: 0.015, text: '{name} finds a glowing codex that shares its knowledge with all who stand near!', loot: { item: 'tome_of_shared_wisdom' } },
                { chance: 0.02, text: '{name} discovers a crystalline apparatus in a forgotten research alcove — it amplifies mana storage!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    ancient_university: {
        name: 'Ancient University', difficulty: 3,
        chain: 'arcane', chainOrder: 2,
        duration: [320, 500], encounters: 6, combatEncounters: [1, 3],
        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        requiresRealm: 'arcane_library',
        research: 'arcane_studies',
        loot: [
            { resource: 'tome_of_magic_missile', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_heal', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 10, amount: [1, 1] },
            { resource: 'runite', weight: 25, amount: [3, 7] },
            { item: 'tome_of_shared_wisdom', weight: 3 },
        ],
        enemies: { count: [2, 5], types: [
            { key: 'arcane_wisp', weight: 15 },
            { key: 'tome_guardian', weight: 30 },
            { key: 'spell_wraith', weight: 35 },
            { key: 'construct', weight: 20 },
        ] },
        events: {
            ambient: [
                '{name} passes through a grand lecture hall where spectral students still sit.',
                'Enchanted chalk writes formulas endlessly across ancient blackboards.',
                '{name} feels raw magical energy crackling along the corridors.',
                'A golem proctor patrols the halls, still enforcing long-dead rules.',
                'Alchemical apparatus bubbles and steams in an abandoned laboratory wing.',
                '{name} hears a distant bell tolling class changes for no one.',
            ],
            discoveries: [
                '{name} finds a professor\'s private collection hidden behind a false wall.',
                'A sealed examination vault still contains graded manuscripts of power.',
                '{name} deciphers a master thesis containing a spell formula.',
            ],
            traps: [
                'A failed experiment reactivates as {name} passes — explosion!',
                '{name} triggers a student\'s old ward — lightning arcs!',
                'An animated suit of armor swings at {name}!',
                'A containment circle breaks, releasing stored energy at {name}!',
            ],
            rare: [
                { chance: 0.04, text: '{name} discovers the Dean\'s private vault — advanced tome inside!', loot: { resource: 'tome_of_haste', amount: [1, 1] } },
                { chance: 0.03, text: '{name} finds an enchanted runite cache in the alchemy wing!', loot: { resource: 'runite', amount: [5, 9] } },
                { chance: 0.02, text: '{name} finds a set of spectacles that reveal hidden truths!', loot: { item: 'scholars_spectacles' } },
                { chance: 0.015, text: '{name} discovers a thesis on mana crystallization with a working prototype!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    abandoned_laboratory: {
        name: 'Abandoned Laboratory', difficulty: 4,
        chain: 'arcane', chainOrder: 3,
        duration: [450, 680], encounters: 8, combatEncounters: [2, 4],
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        requiresRealm: 'ancient_university',
        research: 'arcane_studies',
        loot: [
            { resource: 'tome_of_magic_missile', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_heal', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 12, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 12, amount: [1, 1] },
            { resource: 'runite', weight: 20, amount: [4, 9] },
            { resource: 'void_essence', weight: 15, amount: [2, 6] },
            { item: 'scholars_spectacles', weight: 2 },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'spell_wraith', weight: 15 },
            { key: 'construct', weight: 35 },
            { key: 'lab_abomination', weight: 35 },
            { key: 'tome_guardian', weight: 15 },
        ] },
        boss: {
            name: 'The Arcane Construct',
            hp: 480, damage: 24,
            enrageThreshold: 0.3, enrageDamageMult: 1.5,
            color: '#ff8844', enragedColor: '#ff0000',
            sprite: 'boss_arcane_construct', enragedSprite: 'boss_arcane_construct_enraged',
            guaranteedLoot: [
                { item: 'arcane_amplifier', chance: 0.5 },
                { item: 'staff_of_distortion', chance: 0.5 },
            ],
            bonusResources: { runite: 6, void_essence: 5 },
            defeatText: 'The Arcane Construct overloads and detonates in a shower of sparks!',
            enrageText: 'The Arcane Construct overclocks — its attacks become erratic and deadly!',
            approachText: 'A half-finished golem lurches to life, crackling with unstable magic!',
        },
        events: {
            ambient: [
                '{name} passes containment chambers — most are cracked and empty.',
                'Unstable magical fields distort the air like heat shimmer.',
                '{name} reads warning signs in a dozen languages on every door.',
                'A half-finished construct twitches as the party passes.',
                'Arcane waste pools glow an unsettling green in side chambers.',
                '{name} hears the hum of a still-running experiment deep below.',
            ],
            discoveries: [
                '{name} finds an intact experimental prototype in a sealed chamber.',
                'A researcher\'s emergency stash — hidden for a quick escape that never came.',
                '{name} recovers usable materials from a decommissioned experiment.',
            ],
            traps: [
                'A containment breach floods the corridor with raw magic — {name} is hit!',
                '{name} steps on a pressure plate — an experimental weapon fires!',
                'A mutated specimen breaks free from stasis as {name} passes!',
                'Unstable reagents combust near {name}!',
                'A temporal anomaly snaps shut on {name} — disorienting!',
            ],
            rare: [
                { chance: 0.04, text: '{name} accesses the head researcher\'s personal vault — forbidden knowledge!', loot: { resource: 'tome_of_circle_of_growth', amount: [1, 1] } },
                { chance: 0.03, text: '{name} finds concentrated void essence in a sealed containment jar!', loot: { resource: 'void_essence', amount: [6, 10] } },
                { chance: 0.015, text: '{name} recovers an experimental amplification gauntlet — still functional!', loot: { item: 'arcane_amplifier' } },
                { chance: 0.01, text: '{name} discovers the masterwork of a mad researcher — a staff that bends reality!', loot: { item: 'staff_of_distortion' } },
            ],
        },
    },
    shadow_realm: {
        name: 'Shadow Realm', difficulty: 3,
        chain: 'shadow', chainOrder: 1,
        duration: [400, 650], encounters: 7, combatEncounters: [2, 3],
        vis: { wall: 'void_wall', floor: 'stone_floor' },
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
        research: 'deep_delving',
        events: {
            ambient: [
                'Reality flickers — {name} sees double for a moment.',
                'Whispers from nowhere fill {name}\'s ears.',
                'The shadows themselves seem to breathe.',
                '{name} feels the void pulling at their mana.',
                'A rift in space opens briefly, showing another world.',
                'The ground shifts underfoot — nothing is solid here.',
            ],
            discoveries: [
                '{name} finds crystallized void essence on a dead creature.',
                'A pocket dimension collapses, dropping its contents.',
                '{name} absorbs residual energy from a fading rift.',
            ],
            traps: [
                'A void tendril lashes out at {name}!',
                '{name} steps through a spatial fold — disorienting impact!',
                'Shadow claws rake at {name} from the darkness!',
                'A gravity inversion slams {name} into the ceiling!',
            ],
            rare: [
                { chance: 0.04, text: '{name} absorbs a collapsing void crystal — pure essence!', loot: { resource: 'void_essence', amount: [4, 8] } },
                { chance: 0.02, text: '{name} finds a sealed void reliquary!', loot: { resource: 'void_essence', amount: [6, 10] } },
                { chance: 0.015, text: '{name} pulls a glowing lantern from the void — it never goes dark!', loot: { item: 'voidwalkers_lantern' } },
                { chance: 0.015, text: '{name} wraps themselves in living shadow — a cloak of concealment!', loot: { item: 'cloak_of_shadows' } },
                { chance: 0.02, text: '{name} finds a pulsing crystal device that hums with containment magic!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    void_abyss: {
        name: 'Void Abyss', difficulty: 4,
        chain: 'shadow', chainOrder: 2,
        duration: [550, 800], encounters: 7, combatEncounters: [3, 5],
        vis: { wall: 'void_wall', floor: 'stone_floor' },
        requiresRealm: 'shadow_realm',
        research: 'deep_delving',
        loot: [
            { resource: 'void_essence', weight: 45, amount: [5, 10] },
            { resource: 'runite', weight: 20, amount: [4, 8] },
            { item: 'voidwalkers_lantern', weight: 3 },
        ],
        enemies: { count: [4, 7], types: [
            { key: 'void_stalker', weight: 20 },
            { key: 'shade', weight: 30 },
            { key: 'void_horror', weight: 35 },
            { key: 'oblivion_spawn', weight: 15 },
        ] },
        events: {
            ambient: [
                '{name} cannot tell if they are walking on ground or floating.',
                'The void here is so deep that sound ceases to propagate.',
                '{name} sees echoes of themselves from other timelines.',
                'Space folds back on itself — the party passes the same point twice.',
                'A black sun burns overhead, radiating darkness instead of light.',
                '{name} feels their thoughts being pulled apart by the emptiness.',
            ],
            discoveries: [
                '{name} collects crystallized void from a collapsed pocket dimension.',
                'The remains of another expedition float by — their supplies are intact.',
                '{name} absorbs energy from a dying rift nexus.',
            ],
            traps: [
                'A gravity well inverts — {name} slams into the ceiling then back down!',
                '{name} is caught in a temporal loop — experiencing the same pain twice!',
                'A void creature phases through {name}, draining their life force!',
                'Reality tears open beneath {name} — they barely avoid falling into nothing!',
                'An anti-magic pulse hits {name}, disrupting their defenses!',
            ],
            rare: [
                { chance: 0.04, text: '{name} finds a concentrated void crystal — pure primordial essence!', loot: { resource: 'void_essence', amount: [8, 14] } },
                { chance: 0.03, text: '{name} collects runite that has been void-tempered for aeons!', loot: { resource: 'runite', amount: [6, 12] } },
                { chance: 0.015, text: '{name} wrests a blade from the void itself — it cuts through reality!', loot: { item: 'void_blade' } },
                { chance: 0.01, text: '{name} discovers an orb containing a trapped dimension — incredible power!', loot: { item: 'dimensional_orb' } },
            ],
        },
    },
    oblivion_rift: {
        name: 'Oblivion Rift', difficulty: 5,
        chain: 'shadow', chainOrder: 3,
        duration: [700, 1000], encounters: 9, combatEncounters: [3, 6],
        vis: { wall: 'void_wall', floor: 'void_wall' },
        requiresRealm: 'void_abyss',
        research: 'deep_delving',
        loot: [
            { resource: 'void_essence', weight: 50, amount: [7, 14] },
            { resource: 'runite', weight: 20, amount: [5, 10] },
            { item: 'cloak_of_shadows', weight: 3 },
        ],
        enemies: { count: [4, 8], types: [
            { key: 'shade', weight: 15 },
            { key: 'void_horror', weight: 35 },
            { key: 'oblivion_spawn', weight: 50 },
        ] },
        boss: {
            name: 'The Void Sovereign',
            hp: 600, damage: 30,
            enrageThreshold: 0.3, enrageDamageMult: 1.5,
            color: '#7722cc', enragedColor: '#ff0000',
            sprite: 'boss_void_sovereign', enragedSprite: 'boss_void_sovereign_enraged',
            guaranteedLoot: [
                { item: 'shard_of_oblivion', chance: 0.4 },
                { item: 'voidheart', chance: 0.3 },
                { item: 'armor_of_the_abyss', chance: 0.3 },
            ],
            bonusResources: { void_essence: 10 },
            defeatText: 'The Void Sovereign collapses into nothingness, leaving only silence!',
            enrageText: 'The Void Sovereign tears reality apart around it — enraged!',
            approachText: 'A being of pure void materializes, its gaze alone warping the air!',
        },
        events: {
            ambient: [
                '{name} walks on platforms of solidified nothingness.',
                'The concept of direction has no meaning here — only forward.',
                '{name} sees the end of all things and looks away quickly.',
                'Reality is a thin membrane here — the party can see through it.',
                'Entities vast beyond comprehension move in the distance, unaware of the party.',
                '{name} feels time flowing backwards, forwards, and sideways simultaneously.',
            ],
            discoveries: [
                '{name} gathers void essence that has crystallized into impossible geometries.',
                'A fragment of a destroyed world drifts by — {name} salvages from it.',
                '{name} absorbs raw creation energy from the space between realities.',
            ],
            traps: [
                'An oblivion wave washes over {name} — they briefly cease to exist!',
                '{name} is caught between colliding reality fragments — crushed!',
                'A void lord notices {name} — its gaze alone causes agony!',
                'The ground unmakes itself beneath {name}!',
                'A paradox storm engulfs {name} — existing and not existing hurts!',
                '{name} is struck by a shard of broken time!',
            ],
            rare: [
                { chance: 0.04, text: '{name} finds a tear in reality leading to a void essence wellspring!', loot: { resource: 'void_essence', amount: [10, 18] } },
                { chance: 0.02, text: '{name} claims a fragment of pure oblivion — it annihilates anything it touches!', loot: { item: 'shard_of_oblivion' } },
                { chance: 0.01, text: '{name} binds a fraction of the void\'s power into their very soul!', loot: { item: 'voidheart' } },
                { chance: 0.01, text: '{name} finds armor forged from the boundary between existence and nothing!', loot: { item: 'armor_of_the_abyss' } },
            ],
        },
    },
    kingdom_outskirts: {
        name: 'Kingdom Outskirts', difficulty: 5,
        chain: 'kingdom', chainOrder: 1,
        duration: [700, 1000], encounters: 9, combatEncounters: [3, 6],

        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        research: 'deep_delving',
        requiresEvent: 'crusader_raid_defeated',
        loot: [
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [2, 4], types: [
            { key: 'kingdom_guard', weight: 50 },
            { key: 'knight', weight: 35 },
            { key: 'royal_mage', weight: 15 },
        ] },
        events: {
            ambient: [
                'TODO: {name} marvels at crystalline formations pulsing with light.',
            ],
            discoveries: [
                'TODO: {name} cracks open a geode — raw runite inside!',
            ],
            traps: [
                'TODO: {name} slips on smooth crystal — hard landing!',
            ],
            rare: [
                { chance: 0.02, text: 'TODO: {name} finds a strange compass embedded in crystal — it pulses with greed!', loot: { item: 'compass_of_greed' } },
            ],
        },
    },
    crusader_barracks: {
        name: 'Crusader Barracks', difficulty: 7,
        chain: 'kingdom', chainOrder: 2,
        duration: [700, 1000], encounters: 9, combatEncounters: [4, 6],
        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        research: 'deep_delving',
        requiresRealm: 'kingdom_outskirts',
        loot: [
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [3, 5], types: [
            { key: 'kingdom_guard', weight: 15 },
            { key: 'knight', weight: 30 },
            { key: 'crusader', weight: 35 },
            { key: 'royal_mage', weight: 20 },
        ] },
        events: {
            ambient: [
                'TODO: {name} marvels at crystalline formations pulsing with light.',
            ],
            discoveries: [
                'TODO: {name} cracks open a geode — raw runite inside!',
            ],
            traps: [
                'TODO: {name} slips on smooth crystal — hard landing!',
            ],
            rare: [
                { chance: 0.02, text: 'TODO: {name} finds a strange compass embedded in crystal — it pulses with greed!', loot: { item: 'compass_of_greed' } },
            ],
        },
    },
    palace_fortress: {
        name: 'Palace Fortress', difficulty: 9,
        chain: 'kingdom', chainOrder: 3,
        duration: [700, 1000], encounters: 9, combatEncounters: [5, 7],
        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        research: 'deep_delving',
        requiresRealm: 'crusader_barracks',
        loot: [
            { item: 'map_fragment', weight: 3 },
        ],
        enemies: { count: [3, 6], types: [
            { key: 'knight', weight: 15 },
            { key: 'crusader', weight: 30 },
            { key: 'royal_mage', weight: 25 },
            { key: 'palace_champion', weight: 30 },
        ] },
        boss: {
            name: 'The High King',
            hp: 700, damage: 35,
            enrageThreshold: 0.3, enrageDamageMult: 1.5,
            color: '#ddaa22', enragedColor: '#ff2200',
            sprite: 'boss_high_king', enragedSprite: 'boss_high_king_enraged',
            guaranteedLoot: [
                { item: 'shard_of_oblivion', chance: 0.5 },
                { item: 'voidheart', chance: 0.5 },
            ],
            bonusResources: { gold: 50, void_essence: 8 },
            defeatText: 'The High King falls to his knees, his crown clattering across the stone floor!',
            enrageText: 'The High King draws a second blade! His fury is unrelenting!',
            approachText: 'The throne room doors burst open. The High King rises, blade drawn, eyes burning with conviction!',
        },
        events: {
            ambient: [
                'TODO: {name} marvels at crystalline formations pulsing with light.',
            ],
            discoveries: [
                'TODO: {name} cracks open a geode — raw runite inside!',
            ],
            traps: [
                'TODO: {name} slips on smooth crystal — hard landing!',
            ],
            rare: [
                { chance: 0.02, text: 'TODO: {name} finds a strange compass embedded in crystal — it pulses with greed!', loot: { item: 'compass_of_greed' } },
            ],
        },
    },
};

export const EXPLORATION_CONFIG = {
    returnTimeMult: 1.3,
    retreatTicks: 200,
    encounterSpacing: 0.2,
    baseFistDamage: 5,
    combatRoundTicks: 8,
    bossTriggerPercent: 0.7,
    microEventChance: 0.04,
    trapDamageRange: [5, 15],
    trapChance: 0.3,
    findItemChance: 0.3,
    ambientChance: 0.4,
};

export const EXPEDITION_DIFFICULTY = {
    1: { name: 'Normal', enemyHpMult: 1, enemyDmgMult: 1, enemyCountMult: 1, trapDmgMult: 1, lootAmountMult: 1, rareLootMult: 1, extraEncounters: 0 },
    2: { name: 'Dangerous', enemyHpMult: 1.3, enemyDmgMult: 1.2, enemyCountMult: 1.25, trapDmgMult: 1.3, lootAmountMult: 1.5, rareLootMult: 1.5, extraEncounters: 1 },
    3: { name: 'Perilous', enemyHpMult: 1.7, enemyDmgMult: 1.5, enemyCountMult: 1.5, trapDmgMult: 1.7, lootAmountMult: 2.0, rareLootMult: 2.5, extraEncounters: 2 },
    4: { name: 'Deadly', enemyHpMult: 2.2, enemyDmgMult: 1.8, enemyCountMult: 1.75, trapDmgMult: 2.0, lootAmountMult: 3.0, rareLootMult: 4.0, extraEncounters: 3 },
    5: { name: 'Suicidal', enemyHpMult: 3.0, enemyDmgMult: 2.2, enemyCountMult: 2.0, trapDmgMult: 2.5, lootAmountMult: 4.0, rareLootMult: 6.0, extraEncounters: 4 },
};

export const EXPLORATION_EVENTS = {
    ambient: [
        '{name} notices strange runes on the walls.',
        '{name} hears distant echoes ahead.',
        'The party passes through a narrow passage.',
        '{name} spots glowing crystals in the ceiling.',
        'A cold draft blows from deeper in.',
        '{name} finds old bones scattered on the ground.',
        'The air grows thick with arcane energy.',
        '{name} pauses to study an ancient mural.',
        'Water drips from the ceiling above.',
        'The path splits — the party chooses the left fork.',
        '{name} feels a strange presence watching them.',
        'Faint music drifts from somewhere ahead.',
    ],
    traps: [
        '{name} triggers a hidden spike trap!',
        'A burst of arcane fire singes {name}!',
        '{name} steps on a pressure plate — darts fly!',
        'The floor gives way under {name}!',
        '{name} walks into a magical ward — shock!',
        'Poisoned needles spring from the wall at {name}!',
    ],
    discoveries: [
        '{name} finds a small cache behind a loose stone.',
        'The party discovers an old supply stash.',
        '{name} pries a gem from a wall socket.',
        'An abandoned pack contains useful supplies.',
        '{name} spots something glinting in the rubble.',
    ],
    combatStart: [
        'Hostile creatures emerge from the darkness!',
        'The party is ambushed!',
        'Enemies block the path ahead!',
        'Shadows coalesce into hostile forms!',
    ],
    combatHit: [
        '{attacker} strikes {target} for {dmg} damage.',
        '{attacker} lands a blow on {target} ({dmg} dmg).',
        '{attacker} hits {target} hard ({dmg} dmg).',
    ],
    combatMiss: [
        '{attacker} swings at {target} but misses.',
        '{target} dodges {attacker}\'s attack.',
    ],
    combatDefeat: [
        '{name} collapses from their wounds!',
        '{name} is knocked unconscious!',
    ],
};

// Formation: front/back row positioning for expedition parties.
export const FORMATION_CONFIG = {
    rows: {
        front: {
            name: 'Front Row',
            damageTakenMult: 1.3,
            meleeDamageMult: 1.2,
            spellDamageMult: 1.0,
            targetPriorityMod: 5,
        },
        back: {
            name: 'Back Row',
            damageTakenMult: 0.7,
            meleeDamageMult: 0.6,
            spellDamageMult: 1.15,
            targetPriorityMod: -5,
        },
    },
    maxPerRow: 3,
    defaultAssignment: 'front',
};

// Trap types.
export const EXPEDITION_TRAPS = {
    rockfall: {
        name: 'Rockfall',
        text: 'The ceiling groans — loose rocks begin to shift above!',
        damageType: 'instant',
        initialDamage: [5, 15],
        checks: [
            {
                label: 'Shore up the ceiling',
                description: 'Use building skill to brace the rocks',
                skill: 'building', minLevel: 3,
                traitBonus: ['tough', 'sturdy'],
                successText: '{name} braces the ceiling — rocks held!',
                failText: '{name} tries to brace it but rocks crash down!',
            },
            {
                label: 'Dodge through quickly',
                description: 'Sprint past the danger zone',
                skill: null, traitAny: ['quick', 'lucky'],
                successText: 'The party dashes through just in time!',
                failText: 'Too slow — falling rocks strike the party!',
            },
        ],
    },
    poison_trap: {
        name: 'Poison Trap',
        text: 'A faint hissing sound — poison darts are primed in the walls!',
        damageType: 'dot',
        initialDamage: [3, 8],
        dotDamage: [2, 4], dotTicks: 5, dotInterval: 10,
        checks: [
            {
                label: 'Identify and neutralize',
                description: 'Use research knowledge to disarm the mechanism',
                skill: 'research', minLevel: 3,
                traitBonus: ['scholar'],
                successText: '{name} carefully disarms the dart mechanism!',
                failText: '{name} fumbles — darts fire from the walls!',
            },
            {
                label: 'Craft a quick antidote',
                description: 'Prepare herbal protection with cooking skill',
                skill: 'cooking', minLevel: 3,
                traitBonus: ['iron_stomach'],
                successText: '{name} brews a quick antidote — poison neutralized!',
                failText: '{name} can\'t prepare it fast enough — the darts strike!',
            },
        ],
    },
    disarm_trap: {
        name: 'Disarm Trap',
        text: 'A magnetic mechanism hums — it could rip equipment loose!',
        damageType: 'equipment',
        initialDamage: [2, 5],
        effect: { disableRandomSlot: true, disableDuration: 3 },
        checks: [
            {
                label: 'Dismantle the mechanism',
                description: 'Use crafting skill to safely take it apart',
                skill: 'crafting', minLevel: 3,
                traitBonus: ['sturdy'],
                successText: '{name} dismantles the mechanism with expert precision!',
                failText: '{name} triggers it — equipment ripped loose!',
            },
            {
                label: 'Shield equipment with padding',
                description: 'Use animal hides to insulate gear',
                skill: 'animals', minLevel: 3,
                traitBonus: ['sturdy'],
                successText: '{name} wraps the gear safely — the pulse passes harmlessly!',
                failText: 'The padding isn\'t enough — the magnetic pulse hits!',
            },
        ],
    },
    mana_siphon: {
        name: 'Mana Siphon',
        text: 'Glowing runes on the floor pulse hungrily — a mana drain!',
        damageType: 'mana',
        initialDamage: [0, 2],
        manaDrain: [10, 25],
        checks: [
            {
                label: 'Overload the runes',
                description: 'Channel research knowledge to short-circuit the trap',
                skill: 'research', minLevel: 4,
                traitBonus: ['scholar'],
                successText: '{name} overloads the runes — they shatter harmlessly!',
                failText: '{name} can\'t contain it — mana drained!',
            },
            {
                label: 'Cover the runes with earth',
                description: 'Use farming knowledge to smother the trap',
                skill: 'farming', minLevel: 3,
                traitBonus: ['green_thumb'],
                successText: '{name} packs earth over the runes — the glow fades!',
                failText: 'The earth isn\'t enough — the siphon activates!',
            },
        ],
    },
};

// Elite enemy modifiers.
export const ELITE_MODIFIERS = {
    regenerating: {
        name: 'Regenerating', prefix: 'Regenerating', color: '#44ff44',
        hpMult: 1.2, regenPerRound: 0.05, lootBonusMult: 1.5,
    },
    shielded: {
        name: 'Shielded', prefix: 'Shielded', color: '#4488ff',
        hpMult: 1.0, damageReduction: 0.3, lootBonusMult: 1.4,
    },
    vampiric: {
        name: 'Vampiric', prefix: 'Vampiric', color: '#cc0044',
        hpMult: 0.9, lifeSteal: 0.5, lootBonusMult: 1.6,
    },
    explosive: {
        name: 'Explosive', prefix: 'Explosive', color: '#ff6600',
        hpMult: 0.8, onDeath: { aoe: true, damage: [10, 20] }, lootBonusMult: 1.3,
    },
    swift: {
        name: 'Swift', prefix: 'Swift', color: '#ffff44',
        hpMult: 0.9, extraAttacks: 1, dodgeChance: 0.2, lootBonusMult: 1.4,
    },
};

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
        text: 'The passage splits into two tunnels.',
        triggerChance: 0.35,
        realmFilter: null,
        minDifficulty: 1,
        choices: [
            {
                label: 'Left tunnel — narrow and dark',
                description: 'More enemies, but rare loot chance doubled',
                effects: { spawnCombat: { countMult: 1.5 }, nextLootRareMult: 2.0 },
                logText: 'The party squeezes through the narrow left tunnel...',
            },
            {
                label: 'Right path — wider, well-lit',
                description: 'Safer passage, partial healing',
                effects: { healParty: 0.15 },
                logText: 'The party takes the wider right path...',
            },
        ],
    },
    mysterious_shrine: {
        text: 'An ancient shrine glows with faint energy.',
        triggerChance: 0.2,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        minDifficulty: 1,
        choices: [
            {
                label: 'Pray at the shrine',
                description: 'Restore mana, risk a trap',
                effects: { restoreMana: 0.5, trapRisk: 0.3 },
                logText: '{name} kneels before the shrine...',
            },
            {
                label: 'Smash the shrine',
                description: 'Guaranteed loot, enemies buffed',
                effects: { grantLoot: { type: 'realm_roll', mult: 1.5 }, buffEnemies: { hpMult: 1.2 } },
                logText: '{name} shatters the shrine with a heavy blow!',
            },
            {
                label: 'Ignore it',
                description: 'Play it safe',
                effects: {},
                logText: 'The party cautiously passes the shrine.',
            },
        ],
    },
    trapped_chest: {
        text: 'A chest sits in the middle of the room, suspiciously obvious.',
        triggerChance: 0.25,
        realmFilter: null,
        minDifficulty: 1,
        choices: [
            {
                label: 'Open it carefully',
                description: 'Decent loot if no trap triggers',
                effects: { grantLoot: { type: 'realm_roll', mult: 1.0 }, trapRisk: 0.4 },
                logText: 'The party carefully pries open the chest...',
            },
            {
                label: 'Leave it alone',
                description: 'No risk, no reward',
                effects: {},
                logText: 'The party leaves the chest untouched.',
            },
        ],
    },
    echoing_cry: {
        text: 'A distant cry for help echoes through the passage.',
        triggerChance: 0.2,
        realmFilter: null,
        minDifficulty: 1,
        choices: [
            {
                label: 'Investigate',
                description: 'Could be an ally or a trap',
                effects: { npcChance: 0.6, trapRisk: 0.4 },
                logText: 'The party follows the voice...',
            },
            {
                label: 'Press on',
                description: 'Stay focused on the mission',
                effects: {},
                logText: 'The party ignores the cry and continues forward.',
            },
        ],
    },
};

// Puzzle encounters.
export const PUZZLE_ENCOUNTERS = {
    ancient_runes: {
        text: 'Ancient runes cover a sealed door.',
        triggerWeight: 10,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        checks: [
            {
                label: 'Decipher the runes',
                requirement: { skill: 'research', minLevel: 5 },
                traitBonus: ['scholar'],
                success: { text: '{name} deciphers the runes — the door swings open!', reward: { type: 'bonus_loot', mult: 2.0 } },
                failure: { text: '{name} triggers a ward — arcane backlash!', penalty: { type: 'damage', amount: [10, 20] } },
            },
            {
                label: 'Break through the door',
                requirement: { skill: 'building', minLevel: 3 },
                traitBonus: ['tough', 'sturdy'],
                success: { text: '{name} smashes through — but alerts nearby enemies!', reward: { type: 'bonus_loot', mult: 1.0 }, penalty: { type: 'spawn_combat' } },
                failure: { text: '{name} injures themselves on the reinforced door.', penalty: { type: 'damage', amount: [5, 15] } },
            },
        ],
    },
    unstable_bridge: {
        text: 'A crumbling bridge spans a dark chasm.',
        triggerWeight: 8,
        realmFilter: null,
        checks: [
            {
                label: 'Carefully cross',
                requirement: { traitAny: ['quick', 'lucky'] },
                success: { text: 'The party nimbly crosses the bridge!', reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { text: '{name} slips — the bridge collapses!', penalty: { type: 'damage_all', amount: [5, 10] } },
            },
            {
                label: 'Find another way around',
                requirement: null,
                success: { text: 'The party finds another way around safely.', reward: null },
                failure: null,
            },
        ],
    },
    crystal_lock: {
        text: 'A crystal-powered lock seals a vault door.',
        triggerWeight: 7,
        realmFilter: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        checks: [
            {
                label: 'Attune to the crystals',
                requirement: { skill: 'research', minLevel: 4 },
                traitBonus: ['scholar'],
                success: { text: '{name} resonates with the crystal lock — it opens!', reward: { type: 'bonus_loot', mult: 2.5 } },
                failure: { text: 'The crystal shatters — {name} is cut by the shards!', penalty: { type: 'damage', amount: [8, 16] } },
            },
            {
                label: 'Force the lock',
                requirement: { skill: 'crafting', minLevel: 4 },
                traitBonus: ['creative'],
                success: { text: '{name} pries the lock open with finesse!', reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { text: 'The mechanism jams — {name} strains a muscle.', penalty: { type: 'damage', amount: [3, 8] } },
            },
        ],
    },
    overgrown_path: {
        text: 'Dense vegetation blocks the primary route.',
        triggerWeight: 8,
        realmFilter: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        checks: [
            {
                label: 'Clear a path with tools',
                requirement: { skill: 'farming', minLevel: 4 },
                traitBonus: ['green_thumb'],
                success: { text: '{name} expertly clears the growth — uncovering a hidden cache!', reward: { type: 'bonus_loot', mult: 1.5 } },
                failure: { text: 'Thorny vines lash back at {name}!', penalty: { type: 'damage', amount: [5, 12] } },
            },
            {
                label: 'Push through',
                requirement: null,
                traitBonus: ['tough'],
                success: { text: 'The party forces through, scratched but intact.', reward: null },
                failure: { text: 'The vegetation fights back — everyone takes scratches.', penalty: { type: 'damage_all', amount: [3, 6] } },
            },
        ],
    },
};

// NPC encounters.
export const NPC_ENCOUNTERS = {
    wounded_traveler: {
        text: 'A wounded traveler lies beside the path.',
        triggerWeight: 6,
        realmFilter: null,
        choices: [
            {
                label: 'Heal them',
                requirement: { spellAny: ['mend', 'heal'] },
                cost: { mana: 10 },
                result: { text: '{name} heals the traveler, who offers a reward.', reward: { type: 'realm_roll', mult: 2.0 } },
            },
            {
                label: 'Share supplies',
                cost: { potionSlots: 1 },
                result: { text: 'The traveler shares what they know of the realm.', reward: { type: 'reveal_encounters', count: 2 } },
            },
            {
                label: 'Leave them',
                result: { text: 'The party passes by without stopping.' },
            },
        ],
    },
    mercenary: {
        text: 'A sellsword offers their blade, for a price.',
        triggerWeight: 4,
        realmFilter: null,
        choices: [
            {
                label: 'Hire them',
                cost: { loot: { resource: 'runite', amount: 3 } },
                result: {
                    text: 'The mercenary joins for the next 2 combats.',
                    reward: { type: 'temp_ally', ally: { name: 'Mercenary', hp: 80, damage: 12, char: 'M', color: '#ccaa44', duration: 2 } },
                },
            },
            {
                label: 'Decline',
                result: { text: 'The sellsword shrugs and disappears into the shadows.' },
            },
        ],
    },
    lost_scholar: {
        text: 'A disoriented scholar clutches a bundle of notes.',
        triggerWeight: 5,
        realmFilter: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        choices: [
            {
                label: 'Escort them to safety',
                result: {
                    text: 'The grateful scholar shares their research notes.',
                    reward: { type: 'bonus_loot', mult: 1.5 },
                },
            },
            {
                label: 'Trade supplies for notes',
                cost: { potionSlots: 1 },
                result: { text: 'You exchange a potion for valuable notes.', reward: { type: 'bonus_loot', mult: 2.0 } },
            },
            {
                label: 'Wish them luck',
                result: { text: 'The scholar nods nervously and hurries away.' },
            },
        ],
    },
    shadow_merchant: {
        text: 'A cloaked figure materializes from the darkness, wares floating around them.',
        triggerWeight: 3,
        realmFilter: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        choices: [
            {
                label: 'Trade void essence for healing',
                cost: { loot: { resource: 'void_essence', amount: 2 } },
                result: { text: 'The merchant weaves void energy into restorative magic.', reward: { type: 'heal_party', amount: 0.3 } },
            },
            {
                label: 'Trade void essence for power',
                cost: { loot: { resource: 'void_essence', amount: 3 } },
                result: { text: 'The merchant imbues the party with dark strength.', reward: { type: 'buff_party', damageMult: 1.3, duration: 2 } },
            },
            {
                label: 'Decline',
                result: { text: 'The figure fades back into the void.' },
            },
        ],
    },
};

// Expedition potions.
export const EXPEDITION_POTIONS = {
    health_potion: {
        name: 'Health Potion', resource: 'health_potion',
        maxCarry: 5, useCondition: 'combat',
        effect: { healTarget: 0.5 },
        autoUse: { hpThreshold: 0.3 },
        logText: '{name} drinks a health potion!',
    },
    mana_potion: {
        name: 'Mana Potion', resource: 'mana_potion',
        maxCarry: 5, useCondition: 'combat',
        effect: { restoreMana: 0.5 },
        autoUse: { manaThreshold: 0.2 },
        logText: '{name} drinks a mana potion!',
    },
    antidote: {
        name: 'Antidote', resource: 'antidote',
        maxCarry: 5, useCondition: 'any',
        effect: { clearDot: true },
        autoUse: { hasDot: true },
        logText: '{name} drinks an antidote!',
    },
};

export const POTION_CARRY_CONFIG = {
    packAnimalBonus: 2,
};

// Expedition mutators.
export const EXPEDITION_MUTATORS = {
    dense_fog: {
        name: 'Dense Fog',
        description: '-20% accuracy for both sides, +30% loot',
        effects: { missChanceMod: 0.2, lootAmountMult: 1.3 },
        incompatible: [],
    },
    blood_moon: {
        name: 'Blood Moon',
        description: '+50% enemy damage, +50% rare loot',
        effects: { enemyDmgMult: 1.5, rareLootMult: 1.5 },
        incompatible: [],
    },
    veterans_march: {
        name: "Veteran's March",
        description: '-30% duration, +25% enemy HP',
        effects: { durationMult: 0.7, enemyHpMult: 1.25 },
        incompatible: [],
    },
    arcane_surge: {
        name: 'Arcane Surge',
        description: '+50% spell damage, enemies resist 20% physical',
        effects: { spellDamageMult: 1.5, enemyPhysicalResist: 0.2 },
        incompatible: [],
    },
    thorns_aura: {
        name: 'Thorns Aura',
        description: 'Enemies take 5 damage when they attack, +20% enemy HP',
        effects: { globalThorns: 5, enemyHpMult: 1.2 },
        incompatible: [],
    },
    packmasters_bounty: {
        name: "Packmaster's Bounty",
        description: '+2 loot per drop, -20% party damage',
        effects: { lootBonusFlat: 2, partyDamageMult: 0.8 },
        incompatible: [],
    },
};

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
        name: 'Cartographer',
        uniqueRealmsForBonus: 3,
        lootMult: 1.25,
        rareLootMult: 1.5,
    },
};

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
        10: { ability: 'veteran' },
    },
};

// Realm events.
export const REALM_EVENTS = {
    crystal_surge: {
        name: 'Crystal Surge',
        description: 'Double runite drops, +50% enemy HP',
        realms: ['crystal_caves', 'crystal_mines', 'crystal_depths'],
        effects: { resourceMult: { runite: 2.0 }, enemyHpMult: 1.5 },
        duration: [2000, 4000],
        weight: 10,
    },
    void_tide: {
        name: 'Void Tide',
        description: 'Void essence +75%, enemies deal splash damage',
        realms: ['shadow_realm', 'void_abyss', 'oblivion_rift'],
        effects: { resourceMult: { void_essence: 1.75 }, enemyAoEChance: 0.15, enemyAoEDamage: [3, 6] },
        duration: [2500, 5000],
        weight: 8,
    },
    arcane_residue: {
        name: 'Arcane Residue',
        description: 'Mana regen doubled, +30% tome drops',
        realms: ['arcane_library', 'ancient_university', 'abandoned_laboratory'],
        effects: { manaRegenMult: 2.0, lootAmountMult: 1.3 },
        duration: [1500, 3000],
        weight: 8,
    },
    verdant_bloom: {
        name: 'Verdant Bloom',
        description: '+50% food drops, enemies regenerate',
        realms: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'],
        effects: { resourceMult: { berries: 1.5, potatoes: 1.5, wheat: 1.5 }, enemyRegenPerRound: 0.03 },
        duration: [2000, 3500],
        weight: 8,
    },
};

export const REALM_EVENT_CONFIG = {
    checkInterval: 500,
    maxActiveEvents: 2,
    baseChance: 0.15,
};

// Bestiary.
export const BESTIARY_CONFIG = {
    categories: {
        regular: { name: 'Enemies', color: '#ff4444' },
        elite: { name: 'Elites', color: '#ff8844' },
        boss: { name: 'Bosses', color: '#ffcc44' },
        npc: { name: 'Encounters', color: '#44ccff' },
    },
    completionRewards: {
        25: { type: 'loot_bonus', value: 1.05, description: '+5% expedition loot' },
        50: { type: 'loot_bonus', value: 1.1, description: '+10% expedition loot' },
        75: { type: 'rare_bonus', value: 1.15, description: '+15% rare finds' },
        100: { type: 'title', value: 'Master Explorer', description: 'Bestiary complete!' },
    },
};

// Node map.
export const NODE_MAP_CONFIG = {
    nodeTypes: {
        combat:   { icon: '⚔', color: '#ff4444', label: 'Combat' },
        loot:     { icon: '◆', color: '#ffcc44', label: 'Treasure' },
        decision: { icon: '?', color: '#44ccff', label: 'Choice' },
        puzzle:   { icon: '⊕', color: '#aa88ff', label: 'Puzzle' },
        npc:      { icon: '☺', color: '#88ff88', label: 'NPC' },
        boss:     { icon: '☠', color: '#ff8844', label: 'Boss' },
    },
    canvasHeight: 60,
    nodeRadius: 10,
    nodeSpacing: 50,
    lineColor: '#333',
    completedColor: '#666',
    currentColor: '#ffffff',
    futureColor: '#444',
};

// Wave defense (void nexus) tuning. Used by waves.js.
export const WAVE_CONFIG = {
    baseEnemies: 4,              // enemies in wave 1
    enemiesPerWave: 2,           // additional enemies per wave after wave 1
    baseHp: 60,                  // enemy HP in wave 1
    hpPerWave: 15,               // additional HP per wave
    baseDamage: 6,               // enemy damage in wave 1
    damagePerWave: 2,            // additional damage per wave
    spawnInterval: 15,           // ticks between enemy spawns during a wave
    essencePerKill: 1,           // void essence earned per kill
    nexusHp: 200,                // starting HP of the void nexus
    nexusHpPerWave: 0,           // additional nexus HP per wave (0 = static)
    colonistCapBase: 3,          // starting colonist cap before any waves
    colonistCapScale: 2.5,       // scaling factor for cap increase per wave completed
    colonistCapMax: 12,          // maximum colonist cap
    enemySpeed: 0.45,            // wave enemy movement speed (lower = slower)
    enemyChar: 'E',              // character displayed for wave enemies
    enemyColor: '#ff2222',       // color of wave enemies
    repathInterval: 20,          // ticks before wave enemies recalculate path
    spawnDistance: { near: 25, far: 50, offsetRange: 10 }, // portal spawn distances from nexus
    maxPathNodes: 2000,          // A* node limit for wave enemy pathfinding
    bonusEssencePerWave: 2,      // multiplied by wave number for completion bonus
};

// ============================================================================
// STORY MILESTONES — SPOILER WARNING!
// The text below contains narrative spoilers for Rifthold.
// Do not read ahead if you want to experience the story organically in-game.
// ============================================================================

export const STORY_MILESTONES = {
    // -----------------------------------------------------------------------
    // Colony tab — narrative story beats about your colony's journey
    // -----------------------------------------------------------------------
    first_building: {
        tab: 'colony',
        title: 'First Foundation',
        trigger: 'first_building_placed',
        text: `<img class="pixel-art" src="portraits/first_building.png" alt="A drawing depicting a brand new colony">
        Your group has staked their claim in the wild frontier. Few others live in 
        these parts, but you'll keep your doors open for traders and wanderers who 
        stumble past.
        <br><br>
        With this seclusion you hope to build a thriving community while you wait out 
        the growing crusade in your home lands. Here we will be able to practice magic 
        freely and attempt to reclaim knowledge that's been lost to time.`,
    },
    colony_5: {
        tab: 'colony',
        title: 'A Settlement Forms',
        trigger: 'colonist_count_5',
        text: `
        Your community is still small, but growth is steady. You anticipate more will
        join as you advance your ability to harness magic. Until then, you do what you
        can for those who've already made this colony their home.
        <br><br>
        Despite the progress, you still find yourself thinking back to The Crusade each 
        night. One day you hope to bring your new friends back to the homes that were 
        taken from them.`,
    },
    colony_10: {
        tab: 'colony',
        title: 'A Thriving Community',
        trigger: 'colonist_count_10',
        text: `
        You think back to how this community began. We were small and scared, nearly 
        starving through our first winter. You've all grown much stronger, in body, 
        mind, and spirit. Your efforts to lead this community are paying off in spades.
        <br><br>
        You still have to keep pushing. The Crusade is looming on the horizon and your
        community needs to be ready to face them when the time comes.`,
    },
    first_raid_survived: {
        tab: 'colony',
        title: 'Into the Fire',
        trigger: 'first_raid_survived',
        text: `
        Not all people are friendly out in the frontier. For every group of traders is 
        a gang of raiders ready to take what they need by force.
        <br><br>
        Your small group has held off their attackers today, but you know there will be more
        in the future. Though no one wants to fight their fellow man, many colonists 
        admit that better weapons and armor would go a long way to make them feel safer.`,
    },
    first_crusader_raid_survived: {
        tab: 'colony',
        title: 'Closing In',
        trigger: 'first_crusader_raid_survived',
        text: `
        You hadn't anticipated crusaders making it this deep into the frontier. 
        Thankfully you were prepared, pushing back the invaders for the time being.
        <br><br>
        Their presence shakes the whole colony. Rumors spread that greater forces will 
        be sent our way in the near future. We'll need to be prepared for anything.
        <br><br>
        It may even be time to use our progress to slow down the crusade. Perhaps we 
        could open a rift right into the heart of the kingdom and cut off their supplies 
        from there? The dangers will be colossal, but we'll do what we must to keep our 
        frontier safe.`,
    },
    first_mental_break: {
        tab: 'colony',
        title: 'The Breaking Point',
        trigger: 'first_mental_break',
        text: `
        Today a colonist has lost control of themselves. We all knew that life on the 
        frontier would be difficult, but the constant toil is often too much to bear.
        <br><br>
        Perhaps we can find ways to keep everyone happy? Better sleeping quarters 
        and consistent access to cooked food is a good starting point.`,
    },
    first_death: {
        tab: 'colony',
        title: 'The First Marker',
        trigger: 'first_colonist_death',
        text: `
        Today a colonist has died. This will take a major toll on the friends they've 
        made over their time here. Another may one day take their place in the colony, 
        but this loss will be felt for a very long time.
        <br><br>
        We'll do what we can to keep the remaining colonists safe. Fight in groups, always 
        wear armor, try out ranged weapons, and keep an abundant supply of healing potions.`,
    },
    first_tame: {
        tab: 'colony',
        title: 'Kindred Spirits',
        trigger: 'first_animal_tamed',
        text: `
        The Binding Circle was a huge success! Your colony's first animal companion 
        has joined the flock and now lives among us. This animal will provide a lot 
        to our community as long as we care for it properly.`,
    },
    first_trade: {
        tab: 'colony',
        title: 'Wandering Traders',
        trigger: 'first_trade_completed',
        text: `
        The trader was one of the first friendly faces your colonists had seen in some
        time. They were excited by all of the trader's goods, but such luxuries would
        remain out of reach for some time.`,
    },
    first_spell: {
        tab: 'colony',
        title: 'The Spark of Magic',
        trigger: 'first_spell_cast',
        text: `
        One of your colonists cast their first spell. Whether innate or learned, you 
        are excited by the results. You plan to write more tomes and help everyone 
        get to the point where they can cast their very own spells for the first time.`,
    },
    first_friend: {
        tab: 'colony',
        title: 'Friendly Neighbors',
        trigger: 'first_friend_made',
        text: `
        Some of your colonists have become fast friends. You see these two chatting 
        often, keeping each other sane during these unstable times.`,
    },
    first_love: {
        tab: 'colony',
        title: 'Love on the Frontier',
        trigger: 'first_lover_made',
        text: `
        You overheard some talks of romance among the colonists. It's beautiful to 
        think that they're able to find love so far from home. You can only hope that 
        this relationship helps these two weather the tribulations of The Frontier.`,
    },
    first_wave_complete: {
        tab: 'colony',
        title: 'Horrors from the Void',
        trigger: 'first_wave_completed',
        text: `
        It was horrifying, but opening these rifts may just be a worthwhile endeavour. 
        Your colonists held fast against the horde of fleshy monsters that poured from 
        the portals, finding time to harvest a shadowy material from beyond the rift.
        <br><br>
        Some of the colonists have turned to calling this material <i>Void Essence</i> 
        which was only fitting for something taken from such unnatural creatures. Your 
        initial tests show that this essence will be of great use to the colony, but it 
        seems that the only way to get it is to re-open the rifts to this terrifying place.
        <br><br>
        You ponder the dangers, afraid that the only way forward is to once again invite 
        these monsters into your home. Perhaps with enough study the essence will give 
        your colonists what they need to face these beasts with confidence.`,
    },
    // -----------------------------------------------------------------------
    // Research tab — knowledge and technology discoveries
    // -----------------------------------------------------------------------
    research_runecraft: {
        tab: 'research',
        title: 'Runecraft',
        trigger: 'research_runecraft',
        text: `
        Runes are the main way to channel magical energies into equipment. Though 
        a metal sword may be stronger than a stone, a stone with the right rune engraved 
        into it might just turn the tide.
        <br><br>
        You're certain that runes will be used in all sorts of equipment and workstations 
        going forward, so giving your colonists a good understanding of the fundamentals 
        is a must.`,
    },
    research_druidcraft: {
        tab: 'research',
        title: 'Druidcraft',
        trigger: 'research_druidcraft',
        text: `
        Much like the Nympha, nature is inherently magical. By working with this 
        magic you'll find your crops growing taller and the wildlife around you becoming 
        less hostile.`,
    },
    research_beast_binding: {
        tab: 'research',
        title: 'Beast Binding',
        trigger: 'research_beast_binding',
        text: `
        The ancient Ferini were known for their perfection of beast binding, but those
        arts are largely lost to you. Using the Binding Circle you are able to salvage  
        a portion of that art and work alongside the wildlife of the frontier.
        <br><br>
        As you practice this art you wonder what else the Ferini knew that you'll have 
        to rediscover.`,
    },
    research_ley_channeling: {
        tab: 'research',
        title: 'Ley Channeling',
        trigger: 'research_ley_channeling',
        text: `
        These lands are rich in untapped leylines full of magical energies. 
        Tapping into that energy is a top priority. Using your knowledge of runes, you 
        develop engraved crystals that will help spread magical energies throughout 
        your colony.`,
    },
    research_arcane_studies: {
        tab: 'research',
        title: 'Arcane Studies',
        trigger: 'research_arcane_studies',
        text: `
        You find that your colonists are quickly out growing the simple tomes 
        they create in the workshop. Perhaps this knowledge will satisfy their desire 
        to learn.`,
    },
    research_void_summoning: {
        tab: 'research',
        title: 'Void Summoning',
        trigger: 'research_void_summoning',
        text: `
        Progress in your colony has rapidly slowed. Perhaps it's time to seek 
        something new to continue your growth. Using your knowledge of rifts, you think 
        you may have found a way to tap into the void itself without ever having to 
        leave your realm. The solution: summon it directly to you.`,
    },
    research_planar_rift: {
        tab: 'research',
        title: 'Planar Rift',
        trigger: 'research_planar_rift',
        text: `
        While you find great success opening rifts to your colony, you wonder
        what may lie beyond these portals. You quickly find a way to maintain a rift
        to other realms for your colonists to explore, though it'll take a toll on your
        mana reserves.`,
    },
    research_deep_delving: {
        tab: 'research',
        title: 'Deep Delving',
        trigger: 'research_deep_delving',
        text: `
        In spite of the dangers you find yourself sending colonists deeper into 
        these hostile realms. The deeper they go the greater the rewards become, but 
        how will we keep up with the dangers ahead?`,
    },
    research_golem_craft: {
        tab: 'research',
        title: 'Golem Craft',
        trigger: 'research_golem_craft',
        text: `
        With the creative use of runes and void essence, you find ways to 
        automate the tasks your colonists have been stuck doing for all this time. 
        These golems are great at each task you built them for, but after construction 
        you find yourself unable to change their objectives.`,
    },
    research_herbalism: {
        tab: 'research',
        title: 'Herbalism',
        trigger: 'research_herbalism',
        text: `
        With some effort you find yourself not only able to work with the magic 
        in nature, but strengthen it. Your crops are hardier and somehow grow even 
        faster than they did before!`,
    },
    research_void_architecture: {
        tab: 'research',
        title: 'Void Architecture',
        trigger: 'research_void_architecture',
        text: `
        You find more and more uses for void essence every day. Ignoring their 
        magical potential, they make for an amazing building material, creating 
        walls and doors that are much more difficult to break during battle.`,
    },
    research_mana_reservoir: {
        tab: 'research',
        title: 'Mana Reservoir',
        trigger: 'research_mana_reservoir',
        text: `
        With new buildings that use up your colony's mana reserves, you find 
        innovative ways to stretch the mana even further. You're now able to 
        maintain more generating crystals and get more energy out of each one.`,
    },
    research_alchemy: {
        tab: 'research',
        title: 'Alchemy',
        trigger: 'research_alchemy',
        text: `
        Who would've guessed that your crops would have more uses than just 
        cooking? You excitedly write up recipes for potions based on each plant's 
        properties.`,
    },
    research_trade_routes: {
        tab: 'research',
        title: 'Trade Routes',
        trigger: 'research_trade_routes',
        text: `
        You've learned from your encounters with traders in the past. You know 
        what they like, what they don't, and how to push them towards better deals. 
        Beyond that your community has become better known and has been included 
        as an important stop on the major trade routes in the frontier.`,
    },
    research_arcane_infusion: {
        tab: 'research',
        title: 'Arcane Infusion',
        trigger: 'research_arcane_infusion',
        text: `
        You colony can now create their first Enchanting Table. You're excited 
        about the possibilities this brings, letting you start enchanting your 
        existing equipment to further boost your colonists.`,
    },
    research_warding: {
        tab: 'research',
        title: 'Warding',
        trigger: 'research_warding',
        text: `
        Your first ward: The Arcane Sentinel.
        <br><br>
        For only a small amount of mana you can properly protect your colony 
        from attacks. You feel that this will come in handy if your colony 
        ever decides to open their gates to dangerous enemies.`,
    },
    research_void_forging: {
        tab: 'research',
        title: 'Void Forging',
        trigger: 'research_void_forging',
        text: `
        Harnessing void essence to its full potential, you can now create equipment 
        to rival the weaponry of the far off crusaders. It'll be difficult to find 
        enough of this material to supply your entire colony, but its not impossible.`,
    },
    research_masterwork: {
        tab: 'research',
        title: 'Masterwork',
        trigger: 'research_masterwork',
        text: `
        Your colonists have become masters at their craft. Your equipment is of pristine 
        quality and even distant traders struggle to offer you anything you couldn't 
        simply make for yourself.`,
    },
    research_advanced_arcana: {
        tab: 'research',
        title: 'Advanced Arcana',
        trigger: 'research_advanced_arcana',
        text: `
        Your community is learning quickly with the help of your tomes. You discover more 
        magical spells and put them to paper for your colonists to grow even further.`,
    },
    research_mana_weaving: {
        tab: 'research',
        title: 'Mana Weaving',
        trigger: 'research_mana_weaving',
        text: `
        Many of your colonists complain about the weight of their metal armors and the 
        toll they take on their ability to control their mana flow. You've come up with 
        a clever solution by infusing lighter fabric with pure mana, increasing their 
        protective capabilities tenfold.
        <br><br>
        While not quite as protective as runite plates, these robes get the job done. 
        As a bonus they even help the wearer with their own mana control, boosting their 
        magical abilities.`,
    },
    research_void_sorcery: {
        tab: 'research',
        title: 'Void Sorcery',
        trigger: 'research_void_sorcery',
        text: `
        While some focus on the brute strength of swords and clubs, 
        you find yourself pondering more delicate options. By manipulating void essence 
        in just the right way, you can use it to enhance a colonist's magical abilities.
        <br><br>
        Whether using a wand, stave, or dagger, you know these powerful casters will 
        accomplish great things for their colony going forward.`,
    },

    // -----------------------------------------------------------------------
    // Races tab — lore about the peoples of the world
    // -----------------------------------------------------------------------
    first_bufos_colonist: {
        tab: 'races',
        title: 'The Bufoi',
        trigger: 'first_bufos_colonist_arrived',
        text: `<img class="pixel-art" src="portraits/bufoi.png" alt="A drawing depicting the Bufoi">
        A foreign presence in the world. The Bufoi are a group of people that resemble 
        frogs, salamanders, or even occasionally fish, but with a more human-like body plan.
        They are by far the furthest removed group of people from the other races, with humans 
        having little understanding of how the bufoi live their lives. Some even go as far 
        as assuming the bufoi are not truly intelligent beings, though anyone who's lived among 
        them knows that this is preposterous.
        <br><br>
        Despite not being inherently magical beings themselves, the bufoi still found their 
        communities targeted by the spreading Crusade. Flushed from their homes and forced to 
        move downstream, into the far reaches of The Frontier. While the newly formed communities 
        there are willing to take in these bufoi, their strange behaviors are quickly seen in full.
        <br><br>
        It is unclear if the bufoi are amphibious, like the animals they resemble. Regardless, 
        it is well known that they tend to live near fresh water sources like rivers and 
        lakes. Their society is often viewed as the most foreign part about them, even moreso 
        than their physical appearance. For example, their courtship traditions are known to 
        confuse and often frighten humans who find themselves in the wrong place at the wrong 
        time. Despite these differences, the bufoi have had little trouble fitting in among 
        communities in The Frontier. Some may find it odd when they spend their leisure time 
        soaking in nearby rivers or fall asleep at odd hours of the day, but their friendly 
        nature tends to make them seem normal among their community of outcasts. So friendly 
        in fact that rumors have begun to spread of a bufos finding his true love among the 
        ferini people.
        <br><br>
        It can often be difficult to guess how a bufos is feeling, but overall, much like
        the ferini, they always seem content living in the far off parts of The Frontier. They 
        almost always enjoy life among their newly found community and seem to take great joy 
        in teaching their interested neighbors about their people.`,
    },
    first_kobalos_colonist: {
        tab: 'races',
        title: 'The Kobaloi',
        trigger: 'first_kobalos_colonist_arrived',
        text: `<img class="pixel-art" src="portraits/kobaloi.png" alt="A drawing depicting the Kobaloi">
        A roguish people known for their bright chromatic skin tones and ears as wide as 
        their own heads. For most humans, the kobaloi are best known for their depictions 
        in myths and stories. For them, a kobalos is a mischievous figure that's as likely 
        to pull a prank on you as they are to eat you whole, especially if you're a child 
        exploring the woods all alone.
        <br><br>
        In spite of these stories, the kobaloi are a rather peaceful people. Embodying the idea 
        that it takes a village to raise a child, they take any opportunity to help their community.
        It is clear that they take great pride in their large families and friendly neighbors.
        <br><br>
        The human kingdoms refused to see this reality and it was only a matter of time before The 
        Crusade made its way to the kobaloi's doors. They defended their communities fiercely, with
        several groups of kobaloi continuing to fight back against the Crusaders today. While lacking 
        in numbers compared to their attackers, they make great use of their knack for tricks by leading
        groups of Crusaders into traps and winning battles through ambush tactics.
        <br><br>
        The many kobaloi who were unable to continue fighting found themselves pushed deep into The 
        Frontier. Their once thriving communities were shattered and each individual is left to pick 
        up the pieces. It wasn't long before many new communities were established, often consisting 
        of complete strangers. These kobaloi continue to be protective of their community, regardless 
        of how different their new neighbors might be.`,
    },
    first_ferin_colonist: {
        tab: 'races',
        title: 'The Ferini',
        trigger: 'first_ferin_colonist_arrived',
        text: `<img class="pixel-art" src="portraits/ferini.png" alt="A drawing depicting the Ferini">
        A people with a strong connection to the wilderness. The ferini have always found 
        themselves on the outskirts of society, living among themselves and the animals they 
        befriend in far off lands. The Frontier is comfortable for the ferini, acting as many 
        community's home for years already.
        <br><br>
        The ferini largely live their lives unseen by other groups of people, content to 
        live among their own and let the land provide for them all that they need. Ferini 
        communities tend to differ a lot between one another, with some making their homes 
        in steep mountains among the goats, others with deer in the woods, all sharing 
        a reverence for nature.
        <br><br>
        This deep understanding of nature has manifested in the ferini through gifts from 
        the world. They find themselves gifted with traits much like the animals they live 
        among and the ability to communicate directly with the wild things around them. The 
        few humans who are aware of the ferini outside of myths treat these gifts as curses, 
        shunning the ferini from human society completely.
        <br><br>
        As The Crusade spreads, the ferini find their homes encroached upon by fearful humans. 
        To keep themselves safe they've moved deeper into The Frontier, further from the 
        homes they've grown alongside. They hope to one day return to these homes regardless 
        of the damage the Crusaders continue to inflict upon the land. For the time 
        being they find themselves joining new settlements, helping their small communities 
        of strangers work alongside the unfamiliar nature that surrounds them.`,
    },
    first_nymph_colonist: {
        tab: 'races',
        title: 'The Nympha',
        trigger: 'first_nymph_colonist_arrived',
        text: `<img class="pixel-art" src="portraits/nympha.png" alt="A drawing depicting the Nympha">
        A secretive presence throughout recorded history. The nympha are a group of very 
        few, with their hidden communities making them appear even smaller to those unfamiliar 
        with their communities. Living among forest canopies, the nympha are truly one with 
        the magic of the world they live in. Just as the world has become less magical, the 
        nympha have dropped in number, being only a small fraction of what they used to be.
        <br><br>
        Among modern humans the visage of the nympha brings to mind long standing fears 
        of the unknown, seeing them as symbols of the wicked magic that they've been raised to 
        distrust. One reason often cited for their fears is the nympha's uncanny appearance, 
        with many sightings by humans describing their beauty being otherworldly. Some even 
        fear that nympha may be able to live silently among their communities, acting as a 
        curse upon their friends and family.
        <br><br>
        In the far past it was not uncommon to see a nymph working alongside humans. While not 
        quite as physically capable as the average human farmhand, the nympha used their magic 
        creatively to bridge the gap. Nympha were sought after by many among humanity's most 
        powerful at that time, making use of the nympha's many talents. It was not uncommon to 
        see a nympha employed as bookkeepers, court magicians, or even concubines. 
        Some especially long-lived nympha have fond memories of their time among humans. 
        These nympha still hold out hope for humanity, taking in the exiles that wander 
        into The Frontier.
        <br><br>
        The many humans that continue to fear the nympha continue to drive them further from 
        their homes in the woods outside of the human kingdoms. The Frontier remains one of the 
        only safe havens for these people, letting them rebuild their communities that were 
        shaken by The Crusade.`,
    },
    first_human_colonist: {
        tab: 'races',
        title: 'Humanity',
        trigger: 'first_human_colonist_arrived',
        text: `<img class="pixel-art" src="portraits/humanity.png" alt="A drawing depicting Humanity">
        A dominating presence in the world. Humanity makes up the largest portion of the 
        known world, living in kingdoms that span huge swaths of land. Known for their 
        strict rules and social boundaries, humans tend to have a skewed perception of 
        the world outside of their borders that fails to conform to their requirements.
        <br><br>
        With these codes of conduct came an air of superiority over the other. This arrogance 
        has led the kingdoms to outlaw magic completely, along with those who are born 
        with it. Their passion to enforce their rules has culminated in The Crusade, an 
        attempt by humanity to rid their world of magic completely.
        <br><br>
        Nearly all of the kingdoms throughout the realm have pushed aside their grudges 
        to work together on this common goal. It has been rather easy to convince the 
        people under these rulers to contribute to the cause, with many being taught from 
        a young age to be fearful of the other. With the ever expanding Crusade on their 
        heels, most magical races have gone into hiding deep within The Frontier, where 
        no kingdom has claimed as its own.
        <br><br>
        While all Crusaders are human, not all humans are supportive of their actions. 
        Some remember happier times where they had toiled alongside magical beings. Some 
        simply remain unconvinced that further eradication is necessary now that these 
        beings have fled into hiding. Speaking out against The Crusade is forbidden, with 
        those accused of such actions often finding themselves among those they tried to 
        defend in The Frontier. Thankfully these humans are welcomed into their new 
        communities with open arms.
        <br><br>
        Humans tend to be very unique from one another, often being some of the first 
        people to pick up a new skill if they have enough interest in it. With enough 
        effort any human can become a valuable asset to their community. Interestingly 
        humans have no issues learning how to control magic and cast spells despite 
        their lack of innate magical gifts. Truly humans are capable of anything as long 
        as they have the right support from those around them.
        <br><br>
        We can only hope that these kinder humans are able to prosper.`,
    },
    // -----------------------------------------------------------------------
    // Realms tab — exploration journals from other worlds
    // -----------------------------------------------------------------------
    realm_crystal_caves: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        title: 'Crystal Caves',
        trigger: 'realm_crystal_caves',
        text: `
        You tore open a rift between your colony and a distant land. Without practice you 
        had little control over just where this hole in space would open. Thankfully you 
        were greeted by a large cavern lined with beautiful translucent crystals.
        <br><br>
        After making sure the rift would stay open long enough to allow for exploration, 
        you and a small team of colonists ventured into this unknown cave. The crystals 
        provided ample light for navigation, their faint glow giving you a sense of safety 
        in this unfamiliar place.
        <br><br>
        Despite this feeling you still found the quietness of the cavern off-putting. You 
        had hoped to hear a bat fly by or some insects scuttle to their hiding places, but
        instead you were met with only the sound of your own footsteps echoing through the
        dimly lit cave.
        <br><br>
        In the silence you collected stray rocks and crystal samples to bring back to 
        the colony. Sadly it seemed that this cave didn't have a lot to offer you, but
        you continued on your march regardless.
        <br><br>
        As you continued to walk you noticed the cave walls slowly closing in to a tight 
        opening. It was easy enough to crawl through the opening as you entered into a deep 
        hallway-like passage. Suddenly you heard something different coming from the end of
        the hallway. The sounds of quick footsteps making their way toward you, four feet 
        moving efficiently through the tight corridor.
        <br><br>
        You stood ready to face the creature, not knowing what you expected to see. Your 
        curiosity was answered when the monster stepped into your line of sight, glowing 
        with the same dim light as the crystals throughout the cave system. The dim light 
        made it hard to parse the being's exact features, looking almost like a wolf or a
        wild cat. As it moved closer it became clear that its glow came from crystals of its 
        own that seemed to be embedded into its body.
        <br><br>
        With some quick thinking you were able to drive the creature away by throwing loose 
        stones and scraping your weapon against the cave walls. You pursued the creature in 
        hopes of driving it further from the safe portion of the cavern you've already explored. 
        While you ran as fast as you could, it was still able to out pace you, disappearing into 
        the darkness of the cave tunnels.
        <br><br>
        As you caught your breath you took a moment to look around your new surroundings. A 
        wooden plank held up against the tunnel wall caught your attention. Clearly someone 
        was here before you. You noted down this finding as you walked back towards the open 
        rift. Maybe there will be something useful to find deep within these caves after all?
        `,
    },
    realm_crystal_mines: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        title: 'Crystal Mines',
        trigger: 'realm_crystal_mines',
        text: 'TODO: Write lore text for exploring the Crystal Mines.',
    },
    realm_crystal_depths: {
        tab: 'realms',
        realmGroup: 'Crystal Caverns',
        title: 'Crystal Depths',
        trigger: 'realm_crystal_depths',
        text: 'TODO: Write lore text for exploring the Crystal Depths.',
    },
    realm_verdant_depths: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        title: 'Verdant Depths',
        trigger: 'realm_verdant_depths',
        text: 'TODO: Write lore text for exploring the Verdant Depths.',
    },
    realm_fungal_hollows: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        title: 'Fungal Hollows',
        trigger: 'realm_fungal_hollows',
        text: 'TODO: Write lore text for exploring the Fungal Hollows.',
    },
    realm_primeval_canopy: {
        tab: 'realms',
        realmGroup: 'Verdant Wilds',
        title: 'Primeval Canopy',
        trigger: 'realm_primeval_canopy',
        text: 'TODO: Write lore text for exploring the Primeval Canopy.',
    },
    realm_arcane_library: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        title: 'Arcane Library',
        trigger: 'realm_arcane_library',
        text: `
        The Arcane Library was once home to hundreds of prospective mages. 
        With bans on magic the bustling halls quickly became silent. It's
        disappointing to see such a beautiful building slowly rot without
        its inhabitants.
        <br><br>
        Despite the lack of librarians, the shelves continue to be organized 
        and re-stocked with books of all kinds. The deeper sections of the library 
        carry fading magic energies that might be contributing to these remaining 
        traces of order. We'll try to use this space while we can and keep it clear 
        of those who'd like to see its knowledge stay forever trapped within these 
        decaying walls.
        <br><br>
        Some sections of the library remain locked off with magical wards. You'd 
        guess that these sections hide long lost magical lore that would greatly 
        benefit your colony. Perhaps we can find a way in through the larger university 
        grounds that the library sits on?`,
    },
    realm_ancient_university: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        title: 'Ancient University',
        trigger: 'realm_ancient_university',
        text: `
        Just as you anticipated, the university grounds contained the answer to 
        the locked off library sections you hoped to explore.
        <br><br>
        Finding the key to these wards was not easy. The university has stood for 
        hundreds of years, becoming a labyrinth of buildings and squares. The streets 
        were also less empty than expected, with patrols of crusaders keeping wanderers
        from getting close to the library. You were glad you decided to open the initial
        rift directly into the library as they seemed to be unwilling to enter.
        <br><br>
        By moving carefully right under their noses you were able to take your time with
        the cache of once-locked-away tomes.
        <br><br>
        You found among these hidden works a collection of notes. While it was difficult to
        understand what exactly they meant, you gleaned that there was a fundamental aspect
        of magic that the university was researching. The notes led you to a building
        at the far end of the university grounds. This laboratory was clearly long
        abandoned, much like the rest of the buildings, but magical energy seemed
        to still linger in the air from their experiments. Their findings may be just
        what we needed to uncover some lost art or a powerful spell!`,
    },
    realm_abandoned_laboratory: {
        tab: 'realms',
        realmGroup: 'University Ruins',
        title: 'Abandoned Laboratory',
        trigger: 'realm_abandoned_laboratory',
        text: `
        As you entered the laboratory the lingering magic grew rapidly in strength. 
        After just a dozen steps into the main hallway the energy started to become 
        overwhelming. You pushed through, walking quickly towards the source of this 
        thick haze of magic.
        <br><br>
        As the haze grew in density the hallways became less and less cohesive. It was 
        as if a fundamental chaos had intruded on this space, twisting the halls into 
        impossible shapes. Stairs ran on for far too long and you found yourself questioning 
        your ability to make your way back out of this maze.
        <br><br>
        Just as you started to grow frightened, you came to a proper antechamber free 
        from the entropy affecting the rest of the building. Just past this lay a large
        room that appeared more pristine than even the untouched sections of the library. 
        It was clear in an instant that this is where the experiments must have taken place.
        <br><br>
        The room wasn't all that impressive at a glance. The walls were lined with bookshelves
        and alchemical equipment dotted the many worktables. Along with these beakers and vials
        sat piles and piles of parchment, all beautifully hand written and precisely sorted.
        Within these pages you found the secrets to the control of magic. If you understood it
        correctly, you believed that order and chaos were the underlying aspects of magic. With
        the right balance you could easily master a spell of enormous strength.
        <br><br>
        Frantically you began to write notes of your own. These notes easily turned to full 
        spell tomes within the room, like the order had seeped into your own writings. As you 
        step out of the room back into the chaos you found the knowledge you'd learned slipping.
        However your tomes remained untouched, surviving the trek back to the rift.
        <br><br>
        You feel compelled to return to this place and continue your research, even if you can't 
        bring it all home with you. You'll at least try to write up something useful for the 
        colony whenever you visit.`,
    },
    realm_shadow_realm: {
        tab: 'realms',
        realmGroup: 'The Void',
        title: 'Shadow Realm',
        trigger: 'realm_shadow_realm',
        text: 'TODO: Write lore text for exploring the Shadow Realm.',
    },
    realm_void_abyss: {
        tab: 'realms',
        realmGroup: 'The Void',
        title: 'Void Abyss',
        trigger: 'realm_void_abyss',
        text: 'TODO: Write lore text for exploring the Void Abyss.',
    },
    realm_oblivion_rift: {
        tab: 'realms',
        realmGroup: 'The Void',
        title: 'Oblivion Rift',
        trigger: 'realm_oblivion_rift',
        text: 'TODO: Write lore text for exploring the Oblivion Rift.',
    },
    realm_kingdom_outskirts: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        title: 'Kingdom Outskirts',
        trigger: 'realm_kingdom_outskirts',
        text: 'TODO: Write lore text for exploring the Kingdom.',
    },
    realm_crusader_barracks: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        title: 'Crusader Barracks',
        trigger: 'realm_crusader_barracks',
        text: 'TODO: Write lore text for exploring the Kingdom.',
    },
    realm_palace_fortress: {
        tab: 'realms',
        realmGroup: 'The Kingdom',
        title: 'Palace Fortress',
        trigger: 'realm_palace_fortress',
        text: `
        TODO: Write lore text for exploring the Kingdom.
        <br><br>
        <div style="text-align:center;margin-top:12px;">
            <button onclick="window.game.startOutro()" style="padding:8px 20px;background:#44331a;color:#ffcc44;border:1px solid #665522;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px;">Return Home (Epilogue)</button>
        </div>`,
    },
};

// Exploration / realms. Used by exploration.js.
export const REALMS = {
    crystal_caves: {
        name: 'Crystal Caves', difficulty: 1,
        chain: 'crystal', chainOrder: 1,
        duration: [220, 380], encounters: 3,
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        loot: [
            { resource: 'stone', weight: 40, amount: [5, 12] },
            { resource: 'runite', weight: 30, amount: [2, 5] },
            { resource: 'void_essence', weight: 10, amount: [1, 3] },
            { artifact: 'map_fragment', weight: 3 },
        ],
        enemies: { hp: [40, 60], damage: [5, 8], count: [2, 4] },
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
                { chance: 0.02, text: '{name} finds a strange compass embedded in crystal — it pulses with greed!', loot: { artifact: 'compass_of_greed' } },
            ],
        },
    },
    crystal_mines: {
        name: 'Crystal Mines', difficulty: 2,
        chain: 'crystal', chainOrder: 2,
        duration: [350, 550], encounters: 4,
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        requiresRealm: 'crystal_caves',
        loot: [
            { resource: 'runite', weight: 35, amount: [4, 9] },
            { resource: 'stone', weight: 25, amount: [6, 14] },
            { resource: 'void_essence', weight: 15, amount: [2, 5] },
            { artifact: 'drum_of_rallying', weight: 3 },
        ],
        enemies: { hp: [70, 110], damage: [7, 12], count: [3, 5] },
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
                { chance: 0.015, text: '{name} unearths an ancient mining golem core — still humming with power!', loot: { artifact: 'boots_of_haste' } },
                { chance: 0.015, text: '{name} pries a ward stone from a sealed vault door!', loot: { artifact: 'ward_of_the_sentinel' } },
            ],
        },
    },
    verdant_depths: {
        name: 'Verdant Depths', difficulty: 1,
        chain: 'verdant', chainOrder: 1,
        duration: [150, 280], encounters: 2,
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
        loot: [
            { resource: 'wood', weight: 50, amount: [8, 15] },
            { resource: 'wheat', weight: 20, amount: [5, 10] },
            { resource: 'berries', weight: 20, amount: [4, 8] },
            { artifact: 'map_fragment', weight: 3 },
        ],
        enemies: { hp: [30, 50], damage: [4, 6], count: [1, 3] },
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
                { chance: 0.02, text: '{name} finds a golden charm shaped like a cornucopia!', loot: { artifact: 'cornucopia_charm' } },
            ],
        },
    },
    shadow_realm: {
        name: 'Shadow Realm', difficulty: 3,
        chain: 'shadow', chainOrder: 1,
        duration: [400, 650], encounters: 5,
        vis: { wall: 'void_wall', floor: 'stone_floor' },
        loot: [
            { resource: 'void_essence', weight: 40, amount: [3, 7] },
            { resource: 'runite', weight: 25, amount: [3, 6] },
            { artifact: 'map_fragment', weight: 3 },
        ],
        enemies: { hp: [80, 120], damage: [8, 14], count: [3, 6] },
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
                { chance: 0.015, text: '{name} pulls a glowing lantern from the void — it never goes dark!', loot: { artifact: 'voidwalkers_lantern' } },
                { chance: 0.015, text: '{name} wraps themselves in living shadow — a cloak of concealment!', loot: { artifact: 'cloak_of_shadows' } },
                { chance: 0.02, text: '{name} finds a pulsing crystal device that hums with containment magic!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    arcane_library: {
        name: 'Arcane Library', difficulty: 2,
        chain: 'arcane', chainOrder: 1,
        duration: [180, 320], encounters: 2,
        vis: { wall: 'stone_wall', floor: 'wood_floor' },
        loot: [
            { resource: 'tome_of_magic_missile', weight: 20, amount: [1, 1] },
            { resource: 'tome_of_heal', weight: 20, amount: [1, 1] },
            { resource: 'tome_of_haste', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_warp', weight: 15, amount: [1, 1] },
            { resource: 'tome_of_circle_of_growth', weight: 10, amount: [1, 1] },
            { resource: 'runite', weight: 20, amount: [2, 4] },
            { artifact: 'map_fragment', weight: 3 },
        ],
        enemies: { hp: [30, 50], damage: [4, 7], count: [1, 3] },
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
                { chance: 0.015, text: '{name} finds a glowing codex that shares its knowledge with all who stand near!', loot: { artifact: 'tome_of_shared_wisdom' } },
                { chance: 0.02, text: '{name} discovers a crystalline apparatus in a forgotten research alcove — it amplifies mana storage!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    crystal_depths: {
        name: 'Crystal Depths', difficulty: 3,
        chain: 'crystal', chainOrder: 3,
        duration: [500, 750], encounters: 6,
        vis: { wall: 'stone_wall', floor: 'stone_floor' },
        requiresRealm: 'crystal_mines',
        loot: [
            { resource: 'runite', weight: 40, amount: [6, 14] },
            { resource: 'void_essence', weight: 25, amount: [3, 7] },
            { resource: 'stone', weight: 15, amount: [8, 18] },
            { artifact: 'ward_of_the_sentinel', weight: 3 },
        ],
        enemies: { hp: [100, 160], damage: [11, 17], count: [4, 7] },
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
                { chance: 0.015, text: '{name} pries a shimmering gem from the deepest wall — it pulses with protective energy!', loot: { artifact: 'crystal_aegis' } },
                { chance: 0.01, text: '{name} uncovers an ancient crystalline forge still burning with arcane fire!', loot: { artifact: 'runite_hammer' } },
            ],
        },
    },
    fungal_hollows: {
        name: 'Fungal Hollows', difficulty: 2,
        chain: 'verdant', chainOrder: 2,
        duration: [280, 450], encounters: 4,
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
        requiresRealm: 'verdant_depths',
        loot: [
            { resource: 'wood', weight: 35, amount: [10, 20] },
            { resource: 'berries', weight: 25, amount: [6, 12] },
            { resource: 'potatoes', weight: 20, amount: [5, 10] },
            { artifact: 'cornucopia_charm', weight: 3 },
        ],
        enemies: { hp: [55, 85], damage: [6, 10], count: [2, 5] },
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
                { chance: 0.02, text: '{name} finds a living staff of intertwined roots that still grows!', loot: { artifact: 'staff_of_regrowth' } },
                { chance: 0.015, text: '{name} discovers a symbiotic fungal crown that enhances the mind!', loot: { artifact: 'mycelium_crown' } },
            ],
        },
    },
    primeval_canopy: {
        name: 'Primeval Canopy', difficulty: 3,
        chain: 'verdant', chainOrder: 3,
        duration: [400, 600], encounters: 5,
        vis: { wall: 'wood_wall', floor: 'wood_floor' },
        requiresRealm: 'fungal_hollows',
        loot: [
            { resource: 'wood', weight: 30, amount: [12, 24] },
            { resource: 'berries', weight: 20, amount: [8, 16] },
            { resource: 'potatoes', weight: 15, amount: [6, 12] },
            { resource: 'void_essence', weight: 10, amount: [2, 5] },
            { artifact: 'staff_of_regrowth', weight: 3 },
        ],
        enemies: { hp: [80, 130], damage: [9, 14], count: [3, 6] },
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
                { chance: 0.015, text: '{name} bonds with a seed of the World-Tree — it grows into living armor!', loot: { artifact: 'living_bark_armor' } },
                { chance: 0.01, text: '{name} discovers an ancient druid\'s heartwood staff, still thrumming with life magic!', loot: { artifact: 'heartwood_staff' } },
            ],
        },
    },
    ancient_university: {
        name: 'Ancient University', difficulty: 3,
        chain: 'arcane', chainOrder: 2,
        duration: [320, 500], encounters: 4,
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
            { artifact: 'tome_of_shared_wisdom', weight: 3 },
        ],
        enemies: { hp: [60, 100], damage: [7, 12], count: [2, 5] },
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
                { chance: 0.02, text: '{name} finds a set of spectacles that reveal hidden truths!', loot: { artifact: 'scholars_spectacles' } },
                { chance: 0.015, text: '{name} discovers a thesis on mana crystallization with a working prototype!', loot: { item: 'crystal_capacitor' } },
            ],
        },
    },
    abandoned_laboratory: {
        name: 'Abandoned Laboratory', difficulty: 4,
        chain: 'arcane', chainOrder: 3,
        duration: [450, 680], encounters: 6,
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
            { artifact: 'scholars_spectacles', weight: 2 },
        ],
        enemies: { hp: [90, 150], damage: [10, 16], count: [3, 6] },
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
                { chance: 0.015, text: '{name} recovers an experimental amplification gauntlet — still functional!', loot: { artifact: 'arcane_amplifier' } },
                { chance: 0.01, text: '{name} discovers the masterwork of a mad researcher — a staff that bends reality!', loot: { artifact: 'staff_of_distortion' } },
            ],
        },
    },
    void_abyss: {
        name: 'Void Abyss', difficulty: 4,
        chain: 'shadow', chainOrder: 2,
        duration: [550, 800], encounters: 6,
        vis: { wall: 'void_wall', floor: 'stone_floor' },
        requiresRealm: 'shadow_realm',
        research: 'deep_delving',
        loot: [
            { resource: 'void_essence', weight: 45, amount: [5, 10] },
            { resource: 'runite', weight: 20, amount: [4, 8] },
            { artifact: 'voidwalkers_lantern', weight: 3 },
        ],
        enemies: { hp: [120, 180], damage: [12, 18], count: [4, 7] },
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
                { chance: 0.015, text: '{name} wrests a blade from the void itself — it cuts through reality!', loot: { artifact: 'void_blade' } },
                { chance: 0.01, text: '{name} discovers an orb containing a trapped dimension — incredible power!', loot: { artifact: 'dimensional_orb' } },
            ],
        },
    },
    oblivion_rift: {
        name: 'Oblivion Rift', difficulty: 5,
        chain: 'shadow', chainOrder: 3,
        duration: [700, 1000], encounters: 8,
        vis: { wall: 'void_wall', floor: 'void_wall' },
        requiresRealm: 'void_abyss',
        research: 'deep_delving',
        loot: [
            { resource: 'void_essence', weight: 50, amount: [7, 14] },
            { resource: 'runite', weight: 20, amount: [5, 10] },
            { artifact: 'cloak_of_shadows', weight: 3 },
        ],
        enemies: { hp: [160, 240], damage: [15, 22], count: [4, 8] },
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
                { chance: 0.02, text: '{name} claims a fragment of pure oblivion — it annihilates anything it touches!', loot: { artifact: 'shard_of_oblivion' } },
                { chance: 0.01, text: '{name} binds a fraction of the void\'s power into their very soul!', loot: { artifact: 'voidheart' } },
                { chance: 0.01, text: '{name} finds armor forged from the boundary between existence and nothing!', loot: { artifact: 'armor_of_the_abyss' } },
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
// The text below contains narrative spoilers for Arcanum: Rifts & Ruins.
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
        text: 'TODO: Write story text for placing your first building.',
    },
    colony_5: {
        tab: 'colony',
        title: 'A Settlement Forms',
        trigger: 'colonist_count_5',
        text: 'TODO: Write story text for reaching 5 colonists.',
    },
    colony_10: {
        tab: 'colony',
        title: 'A Thriving Community',
        trigger: 'colonist_count_10',
        text: 'TODO: Write story text for reaching 10 colonists.',
    },
    first_raid_survived: {
        tab: 'colony',
        title: 'Baptism of Steel',
        trigger: 'first_raid_survived',
        text: 'TODO: Write story text for surviving your first raid.',
    },
    first_mental_break: {
        tab: 'colony',
        title: 'The Breaking Point',
        trigger: 'first_mental_break',
        text: 'TODO: Write story text for first colonist mental break.',
    },
    first_death: {
        tab: 'colony',
        title: 'The First Marker',
        trigger: 'first_colonist_death',
        text: 'TODO: Write story text for first colonist death.',
    },
    first_tame: {
        tab: 'colony',
        title: 'Kindred Spirits',
        trigger: 'first_animal_tamed',
        text: 'TODO: Write story text for taming your first animal.',
    },
    first_trade: {
        tab: 'colony',
        title: 'Commerce Begins',
        trigger: 'first_trade_completed',
        text: 'TODO: Write story text for completing your first trade.',
    },
    first_spell: {
        tab: 'colony',
        title: 'The Spark of Magic',
        trigger: 'first_spell_cast',
        text: 'TODO: Write story text for casting your first spell.',
    },
    first_wave_complete: {
        tab: 'colony',
        title: 'Void Triumphant',
        trigger: 'first_wave_completed',
        text: 'TODO: Write story text for completing your first void wave.',
    },

    // -----------------------------------------------------------------------
    // World tab — lore and worldbuilding (research unlocks)
    // -----------------------------------------------------------------------
    research_runecraft: {
        tab: 'world',
        title: 'Runecraft',
        trigger: 'research_runecraft',
        text: 'TODO: Write lore text for runecraft research.',
    },
    research_druidcraft: {
        tab: 'world',
        title: 'Druidcraft',
        trigger: 'research_druidcraft',
        text: 'TODO: Write lore text for druidcraft research.',
    },
    research_beast_binding: {
        tab: 'world',
        title: 'Beast Binding',
        trigger: 'research_beast_binding',
        text: 'TODO: Write lore text for beast binding research.',
    },
    research_ley_channeling: {
        tab: 'world',
        title: 'Ley Channeling',
        trigger: 'research_ley_channeling',
        text: 'TODO: Write lore text for ley channeling research.',
    },
    research_arcane_studies: {
        tab: 'world',
        title: 'Arcane Studies',
        trigger: 'research_arcane_studies',
        text: 'TODO: Write lore text for arcane studies research.',
    },
    research_void_summoning: {
        tab: 'world',
        title: 'Void Summoning',
        trigger: 'research_void_summoning',
        text: 'TODO: Write lore text for void summoning research.',
    },
    research_planar_rift: {
        tab: 'world',
        title: 'Planar Rift',
        trigger: 'research_planar_rift',
        text: 'TODO: Write lore text for planar rift research.',
    },
    research_deep_delving: {
        tab: 'world',
        title: 'Deep Delving',
        trigger: 'research_deep_delving',
        text: 'TODO: Write lore text for deep delving research.',
    },
    research_golem_craft: {
        tab: 'world',
        title: 'Golem Craft',
        trigger: 'research_golem_craft',
        text: 'TODO: Write lore text for golem craft research.',
    },
    research_herbalism: {
        tab: 'world',
        title: 'Herbalism',
        trigger: 'research_herbalism',
        text: 'TODO: Write lore text for herbalism research.',
    },
    research_void_architecture: {
        tab: 'world',
        title: 'Void Architecture',
        trigger: 'research_void_architecture',
        text: 'TODO: Write lore text for void architecture research.',
    },
    research_mana_reservoir: {
        tab: 'world',
        title: 'Mana Reservoir',
        trigger: 'research_mana_reservoir',
        text: 'TODO: Write lore text for mana reservoir research.',
    },
    research_alchemy: {
        tab: 'world',
        title: 'Alchemy',
        trigger: 'research_alchemy',
        text: 'TODO: Write lore text for alchemy research.',
    },
    research_trade_routes: {
        tab: 'world',
        title: 'Trade Routes',
        trigger: 'research_trade_routes',
        text: 'TODO: Write lore text for trade routes research.',
    },
    research_arcane_infusion: {
        tab: 'world',
        title: 'Arcane Infusion',
        trigger: 'research_arcane_infusion',
        text: 'TODO: Write lore text for arcane infusion research.',
    },
    research_warding: {
        tab: 'world',
        title: 'Warding',
        trigger: 'research_warding',
        text: 'TODO: Write lore text for warding research.',
    },
    research_void_forging: {
        tab: 'world',
        title: 'Void Forging',
        trigger: 'research_void_forging',
        text: 'TODO: Write lore text for void forging research.',
    },
    research_masterwork: {
        tab: 'world',
        title: 'Masterwork',
        trigger: 'research_masterwork',
        text: 'TODO: Write lore text for masterwork research.',
    },
    research_advanced_arcana: {
        tab: 'world',
        title: 'Advanced Arcana',
        trigger: 'research_advanced_arcana',
        text: 'TODO: Write lore text for advanced arcana research.',
    },
    research_mana_weaving: {
        tab: 'world',
        title: 'Mana Weaving',
        trigger: 'research_mana_weaving',
        text: 'TODO: Write lore text for mana weaving research.',
    },
    research_void_sorcery: {
        tab: 'world',
        title: 'Void Sorcery',
        trigger: 'research_void_sorcery',
        text: 'TODO: Write lore text for void sorcery research.',
    },

    // -----------------------------------------------------------------------
    // World tab — lore and worldbuilding (realm exploration)
    // -----------------------------------------------------------------------
    realm_crystal_caves: {
        tab: 'world',
        title: 'Crystal Caves',
        trigger: 'realm_crystal_caves',
        text: 'TODO: Write lore text for exploring the Crystal Caves.',
    },
    realm_crystal_mines: {
        tab: 'world',
        title: 'Crystal Mines',
        trigger: 'realm_crystal_mines',
        text: 'TODO: Write lore text for exploring the Crystal Mines.',
    },
    realm_crystal_depths: {
        tab: 'world',
        title: 'Crystal Depths',
        trigger: 'realm_crystal_depths',
        text: 'TODO: Write lore text for exploring the Crystal Depths.',
    },
    realm_verdant_depths: {
        tab: 'world',
        title: 'Verdant Depths',
        trigger: 'realm_verdant_depths',
        text: 'TODO: Write lore text for exploring the Verdant Depths.',
    },
    realm_fungal_hollows: {
        tab: 'world',
        title: 'Fungal Hollows',
        trigger: 'realm_fungal_hollows',
        text: 'TODO: Write lore text for exploring the Fungal Hollows.',
    },
    realm_primeval_canopy: {
        tab: 'world',
        title: 'Primeval Canopy',
        trigger: 'realm_primeval_canopy',
        text: 'TODO: Write lore text for exploring the Primeval Canopy.',
    },
    realm_arcane_library: {
        tab: 'world',
        title: 'Arcane Library',
        trigger: 'realm_arcane_library',
        text: 'TODO: Write lore text for exploring the Arcane Library.',
    },
    realm_ancient_university: {
        tab: 'world',
        title: 'Ancient University',
        trigger: 'realm_ancient_university',
        text: 'TODO: Write lore text for exploring the Ancient University.',
    },
    realm_abandoned_laboratory: {
        tab: 'world',
        title: 'Abandoned Laboratory',
        trigger: 'realm_abandoned_laboratory',
        text: 'TODO: Write lore text for exploring the Abandoned Laboratory.',
    },
    realm_shadow_realm: {
        tab: 'world',
        title: 'Shadow Realm',
        trigger: 'realm_shadow_realm',
        text: 'TODO: Write lore text for exploring the Shadow Realm.',
    },
    realm_void_abyss: {
        tab: 'world',
        title: 'Void Abyss',
        trigger: 'realm_void_abyss',
        text: 'TODO: Write lore text for exploring the Void Abyss.',
    },
    realm_oblivion_rift: {
        tab: 'world',
        title: 'Oblivion Rift',
        trigger: 'realm_oblivion_rift',
        text: 'TODO: Write lore text for exploring the Oblivion Rift.',
    },
};

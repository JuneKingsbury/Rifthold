export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_ADVANCE_NOTICE = {
    spring: 'Spring arrives tomorrow. Crops can be planted again and food decay will return to normal.',
    summer: 'Summer arrives tomorrow. Crops will grow faster but food spoils more quickly in the heat.',
    autumn: 'Autumn arrives tomorrow. Crop growth will slow. Harvest before winter.',
    winter: 'Winter arrives tomorrow. Crop growth halts. Ensure colonists have warm clothing and food is stocked.',
};

export const SEASON_EFFECTS = {
    spring: { cropGrowthMult: 1.0, animalSpawnRate: 0.04, tempRange: [10, 20], bgColor: '#000000', grassColor: '#85a643', grassBg: '#85a643' },
    summer: { cropGrowthMult: 1.5, animalSpawnRate: 0.035, tempRange: [20, 35], bgColor: '#000000', grassColor: '#85a643', grassBg: '#85a643' },
    autumn: { cropGrowthMult: 0.8, animalSpawnRate: 0.015, tempRange: [5, 15], bgColor: '#000000', grassColor: '#e4b91b', grassBg: '#e4b91b' },
    winter: { cropGrowthMult: 0, animalSpawnRate: 0.01, tempRange: [-10, 5], bgColor: '#000000', grassColor: '#f7ffff', grassBg: '#f7ffff' },
};

// Winter feast: once per year, when winter arrives, if the colony has stored up
// a comfortable surplus of food it holds a feast that consumes some of that food
// and grants everyone a lasting mood buff. A small warm beat in the coldest
// season. moodDuration is in ticks (TICKS_PER_DAY = 480, so this is ~2 days).
export const WINTER_FEAST_CONFIG = {
    foodThreshold: 80,   // minimum stored foodstuffs required to trigger a feast
    foodConsumed: 40,    // foodstuffs eaten by the feast
    moodBonus: 12,       // mood effect of the "Winter feast" thought
    moodDuration: 960,   // how long the thought lasts, in ticks
    thoughtText: 'Warmed by the winter feast',
};

export const TERRAIN = {
    grass:       { char: '.', color: '#6aad44', bg: '#1a2a12', moveCost: 8,        passable: { colonist: true, animal: true,  enemy: true  } },
    dirt:        { char: ',', color: '#bb8850', bg: '#2a1e14', moveCost: 8,        passable: { colonist: true, animal: true,  enemy: true  } },
    sand:        { char: '∙', color: '#e0c878', bg: '#2a2618', moveCost: 12,       passable: { colonist: true, animal: true,  enemy: true  } },
    gravel:      { char: ':', color: '#a09888', bg: '#1e1c1a', moveCost: 10,       passable: { colonist: true, animal: true,  enemy: true  } },
    rock:        { char: '#', color: '#999999', bg: '#222222', moveCost: 20,       passable: { colonist: true, animal: false, enemy: true  } },
    tall_rock:   { char: '▲', color: '#777777', bg: '#1a1a1a', moveCost: Infinity, passable: { colonist: false, animal: false, enemy: false } },
    water:       { char: '~', color: '#55aaff', bg: '#0a1a2e', moveCost: 16,       passable: { colonist: true, animal: false, enemy: true  } },
    mud:          { char: '≈', color: '#7a6040', bg: '#1a140a', moveCost: 14,      passable: { colonist: true, animal: true,  enemy: true  } },
    shallow_water:{ char: '~', color: '#4499cc', bg: '#0a1825', moveCost: 12,      passable: { colonist: true, animal: true,  enemy: true  } },
    red_rock:    { char: '#', color: '#cc5533', bg: '#2a1008', moveCost: 18,       passable: { colonist: true, animal: false, enemy: true  } },
    snow_ground: { char: '.', color: '#ddeeff', bg: '#1a2030', moveCost: 10,       passable: { colonist: true, animal: true,  enemy: true  } },
    forest_grass:{ char: '.', color: '#4f9a3a', bg: '#16260f', moveCost: 8,        passable: { colonist: true, animal: true,  enemy: true  } },
    swamp_grass: { char: '"', color: '#5a8a3a', bg: '#141f10', moveCost: 10,       passable: { colonist: true, animal: true,  enemy: true  } },
};

// Terrain nothing can be built on: deep and shallow water, and impassable cliffs.
// Every other terrain (rock included) is buildable.
export const UNBUILDABLE_TERRAIN = new Set(['water', 'shallow_water', 'tall_rock']);

// Terrain a farm zone can be designated on.
export const FARMABLE_TERRAIN = new Set(['grass', 'forest_grass', 'dirt', 'swamp_grass']);

// The grass terrains: all get animated tufts, autumn variants, winter snow cover,
// trees, and the disturbed-when-walked-through sway.
export const GRASS_TERRAIN = new Set(['grass', 'forest_grass', 'swamp_grass']);

export const RESOURCES = {
    tree:       { char: 'T', color: '#8B6B3A', springColor: '#55cc44', summerColor: '#338822', autumnColor: '#cc8822', winterColor: '#667788', designation: 'chop', work: 12, yield: { wood: 1 }, perAmount: true },
    stone:      { char: 'o', color: '#999', designation: 'mine', work: 18, yield: { stone: 1 }, perAmount: true },
    iron_ore:   { char: 'o', color: '#cc8844', designation: 'mine', work: 20, yield: { iron_ore: 1 }, perAmount: true },
    runite_ore: { char: 'o', color: '#44cccc', designation: 'mine', work: 22, yield: { runite_ore: 1 }, perAmount: true },
};

export const WEATHER_TYPES = {
    clear:        { display: 'Clear', growthMult: 1.0 },
    rain:         { display: 'Rain', growthMult: 1.3, extinguishesFire: true },
    thunderstorm: { display: 'Storm', growthMult: 1.0, extinguishesFire: true, fireChance: true },
    snow:         { display: 'Snow', growthMult: 0.5 },
    blizzard:     { display: 'Blizzard', growthMult: 0 },
    heatwave:     { display: 'Heat Wave', growthMult: 0.7 },
};

export const SEASON_WEATHER = {
    spring: [
        ['thunderstorm', 0.10, [10, 24]],
        ['rain', 0.25, [25, 64]],
    ],
    summer: [
        ['thunderstorm', 0.05, [15, 34]],
        ['rain', 0.15, [20, 49]],
        ['heatwave', 0.25, [40, 99]],
    ],
    autumn: [
        ['thunderstorm', 0.10, [10, 24]],
        ['rain', 0.25, [25, 64]],
    ],
    winter: [
        ['blizzard', 0.10, [30, 69]],
        ['snow', 0.30, [40, 99]],
    ],
};

// Biome definitions: terrain mix, resource density and shoreline terrain. Consumed
// by generateBiomeLayout in map.js. (Which landmark ruins belong to a biome is set
// by the `biome` field of each LANDMARK_BLUEPRINTS entry.)
//
// terrainWeights are the target share of each terrain within the biome. Terrain
// is painted as coherent patches from a smooth noise field, so KEY ORDER MATTERS:
// neighbouring keys are neighbouring bands of the field and end up touching each
// other on the map (swamp_grass -> mud -> shallow_water reads as a bog edge).
// patchScale is the approximate patch size in tiles.
//
// areaWeight (default 1) scales how much of the map the biome claims when the
// regions are carved up: above 1 grows its territory, below 1 shrinks it.
//
// shore is what ponds and rivers paint around their water: `inner` hugs the
// water, `outer` is an optional sparser ring beyond it (null = none).
export const BIOMES = {
    grassland: {
        terrainWeights: { grass: 0.80, dirt: 0.20 },
        patchScale: 14,
        areaWeight: 0.98,
        treeDensity: 0.10,
        shore: { inner: 'sand', outer: 'gravel' },
    },
    forest: {
        terrainWeights: { forest_grass: 0.70, dirt: 0.30 },
        patchScale: 12,
        areaWeight: 1.23,
        treeDensity: 0.35,
        shore: { inner: 'sand', outer: 'gravel' },
    },
    mountain: {
        terrainWeights: { gravel: 0.20, rock: 0.55, tall_rock: 0.25 },
        patchScale: 10,
        areaWeight: 0.76,
        treeDensity: 0.01,
        rockResources: true,
        shore: { inner: 'gravel', outer: null },
    },
    swamp: {
        terrainWeights: { swamp_grass: 0.25, mud: 0.50, shallow_water: 0.25 },
        patchScale: 9,
        areaWeight: 1.17,
        treeDensity: 0.05,
        shore: { inner: 'mud', outer: null },
    },
    desert: {
        terrainWeights: { sand: 0.60, gravel: 0.15, red_rock: 0.25 },
        patchScale: 16,
        areaWeight: 1.05,
        treeDensity: 0.0,
        desertResources: true,
        shore: { inner: 'sand', outer: null },
    },
    tundra: {
        terrainWeights: { snow_ground: 0.65, gravel: 0.15, rock: 0.20 },
        patchScale: 14,
        areaWeight: 0.81,
        treeDensity: 0.03,
        tundraResources: true,
        shore: { inner: 'gravel', outer: null },
    },
};

// Terrain used as a narrow neutral strip where two clashing biomes meet, so e.g.
// sand never butts directly against snow. Keys are the two biome names sorted
// alphabetically and joined with '|'. Pairs not listed meet in a plain ragged
// line (the terrain-sprite blending softens those).
export const BIOME_TRANSITIONS = {
    'desert|tundra': 'gravel',
    'desert|swamp':  'gravel',
    'desert|forest': 'dirt',
    'swamp|tundra':  'gravel',
};

export const MAP_GENERATORS = [
    {
        name: 'biome_layout',
        enabled: true,
        params: {
            innerRadius: 0.22,    // average normalized radius of central guaranteed grassland
            grasslandSeeds: 3,    // extra grassland regions around the centre, each joined to it
            innerJitter: 0.30,    // how far the grassland edge wanders in/out (fraction of innerRadius)
            innerCell: 14,        // size in tiles of the lobes along that edge (higher = broader)
            seedsPerBiome: 2,     // Voronoi seed points per outer biome
            warpScale: 28,        // domain-warp displacement in tiles (higher = blobier)
            warpCell: 32,         // size in tiles of the smooth noise that drives the warp
            oasisTilesPer: 1800,  // roughly one desert oasis per this many desert tiles
            transitionWidth: 2,   // max half-width in tiles of the strip between clashing biomes
        },
    },
    {
        name: 'dirt_patches',
        enabled: true,
        params: {
            count: 12,
            radiusRange: [2, 5],
            fillChance: 0.6,
        },
    },
    {
        name: 'rock_formations',
        enabled: true,
        params: {
            count: 6,
            sizeRange: [2, 4],
            fillChance: 0.7,
            resourceChance: 0.5,
            runiteChance: 0.15,
            ironChance: 0.30,
            stoneAmount: [3, 5],
            ironAmount: [2, 4],
            runiteAmount: [2, 3],
        },
    },
    {
        name: 'mountain_ranges',
        enabled: true,
        params: {
            chance: 0.4,
            lengthRange: [15, 40],
            widthRange: [3, 6],
            tallRockChance: 0.4,
            resourceChance: 0.3,
            runiteChance: 0.25,
            ironChance: 0.30,
            stoneAmount: [3, 5],
            ironAmount: [2, 4],
            runiteAmount: [2, 4],
        },
    },
    {
        name: 'trees',
        enabled: true,
        params: {
            density: 0.12,
            amountRange: [3, 5],
        },
    },
    {
        name: 'river',
        enabled: true,
        params: {
            widthRange: [2, 3],
            bankChance: 0.85,
            gravelChance: 0.5,
        },
    },
    {
        name: 'ruins',
        enabled: true,
        params: {
            tilesPer: 4000,       // one generic ruin per this many map tiles (small 4, medium 16, large 37)
            minCount: 2,          // floor on generic ruins per map
            chance: 1,
            margin: 30,
            decayChance: 0.33,
            floorDecayChance: 0.15,
            blueprints: [
                {
                    name: 'temple',
                    width: 9,
                    height: 7,
                    floorTerrain: 'dirt',
                    layout: (() => {
                        const l = [];
                        for (let x = 0; x < 9; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 6, type: 'stone_wall' }); }
                        for (let y = 1; y < 6; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 8, y, type: 'stone_wall' }); }
                        l.push({ x: 4, y: 6, type: 'door' });
                        for (let y = 1; y < 6; y++) { for (let x = 1; x < 8; x++) { l.push({ x, y, type: 'stone_floor' }); } }
                        l.push({ x: 2, y: 2, type: 'stone_wall' });
                        l.push({ x: 6, y: 2, type: 'stone_wall' });
                        l.push({ x: 2, y: 4, type: 'stone_wall' });
                        l.push({ x: 6, y: 4, type: 'stone_wall' });
                        return l;
                    })(),
                },
                {
                    name: 'watchtower',
                    width: 5,
                    height: 5,
                    floorTerrain: 'gravel',
                    layout: (() => {
                        const l = [];
                        for (let x = 0; x < 5; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 4, type: 'stone_wall' }); }
                        for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 4, y, type: 'stone_wall' }); }
                        l.push({ x: 2, y: 4, type: 'door' });
                        for (let y = 1; y < 4; y++) { for (let x = 1; x < 4; x++) { l.push({ x, y, type: 'stone_floor' }); } }
                        return l;
                    })(),
                },
            ],
        },
    },
    // Sealed crypts: counts, tiers and placement rules live in CRYPT_CONFIG. Must run
    // after 'ruins' so crypts keep clear of generic ruins as well as landmarks.
    { name: 'crypts', enabled: true, params: {} },
];

// Landmark blueprint library: the ruins that hold the world's Arcane Cores. There
// is one per COMPLEX_STRUCTURES shape (8), and ALL of them spawn on every map,
// whatever its size; placeBiomeLandmarks in map.js tries to put each inside its
// `biome` and falls back to the nearest free space. The generic temple/watchtower
// ruins in MAP_GENERATORS are the random, space-scaled ones and hold no core.
//
// Each landmark centres on an 'arcane_core' ringed by a deliberately unfinished
// 'ritual_chalk' pattern of the shape named in its comment. Cores are the only ones
// in the world: the player cannot build or destroy them, only finish the chalk.
// Core and chalk are exempt from ruin decay so the authored gaps are the only gaps.
// Keep every partial pattern from completing a different shape (see patternMatches).
export const LANDMARK_BLUEPRINTS = {
    // Grassland: Waystone Shrine — 5×5 stone ring, core with 3 of 4 Scholar's Ring chalk
    waystone_shrine: {
        biome: 'grassland',
        name: 'Waystone Shrine',
        width: 5, height: 5,
        floorTerrain: 'dirt',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 5; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 4, type: 'stone_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 4, y, type: 'stone_wall' }); }
            l.push({ x: 2, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 4; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 2, type: 'arcane_core' });
            l.push({ x: 2, y: 1, type: 'ritual_chalk' }); l.push({ x: 1, y: 2, type: 'ritual_chalk' }); l.push({ x: 3, y: 2, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Forest: Woodcutter's Lodge — 7×5 wood cabin, core with 3 of 5 Harvest Sigil chalk
    woodcutters_lodge: {
        biome: 'forest',
        name: "Woodcutter's Lodge",
        width: 7, height: 5,
        floorTerrain: 'dirt',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 7; x++) { l.push({ x, y: 0, type: 'wood_wall' }); l.push({ x, y: 4, type: 'wood_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'wood_wall' }); l.push({ x: 6, y, type: 'wood_wall' }); }
            l.push({ x: 3, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 2, type: 'arcane_core' });
            l.push({ x: 3, y: 2, type: 'ritual_chalk' }); l.push({ x: 4, y: 2, type: 'ritual_chalk' }); l.push({ x: 5, y: 1, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Mountain: Dwarven Vault — 11×9, stone outer wall, brick inner vault, reinforced door, core with 3 of 4 Anvil Shrine chalk
    dwarven_vault: {
        biome: 'mountain',
        name: 'Dwarven Vault',
        width: 11, height: 9,
        floorTerrain: 'gravel',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 11; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 8, type: 'stone_wall' }); }
            for (let y = 1; y < 8; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 10, y, type: 'stone_wall' }); }
            l.push({ x: 5, y: 8, type: 'door' });
            for (let y = 1; y < 8; y++) { for (let x = 1; x < 10; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            for (let x = 3; x < 8; x++) { l.push({ x, y: 2, type: 'brick_wall' }); l.push({ x, y: 6, type: 'brick_wall' }); }
            for (let y = 3; y < 6; y++) { l.push({ x: 3, y, type: 'brick_wall' }); l.push({ x: 7, y, type: 'brick_wall' }); }
            l.push({ x: 5, y: 6, type: 'reinforced_door' });
            l.push({ x: 5, y: 4, type: 'arcane_core' });
            l.push({ x: 4, y: 3, type: 'ritual_chalk' }); l.push({ x: 5, y: 3, type: 'ritual_chalk' }); l.push({ x: 5, y: 5, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Swamp: Witch's Hut — 7×7 wood hut, irregular shape, core with 5 of 8 Ritual Circle chalk
    witchs_hut: {
        biome: 'swamp',
        name: "Witch's Hut",
        width: 7, height: 7,
        floorTerrain: 'mud',
        layout: (() => {
            const l = [];
            for (let x = 1; x < 6; x++) { l.push({ x, y: 0, type: 'wood_wall' }); l.push({ x, y: 6, type: 'wood_wall' }); }
            for (let y = 1; y < 6; y++) { l.push({ x: 0, y, type: 'wood_wall' }); l.push({ x: 6, y, type: 'wood_wall' }); }
            l.push({ x: 0, y: 0, type: 'wood_wall' }); l.push({ x: 6, y: 0, type: 'wood_wall' });
            l.push({ x: 0, y: 6, type: 'wood_wall' }); l.push({ x: 6, y: 6, type: 'wood_wall' });
            l.push({ x: 3, y: 6, type: 'door' });
            for (let y = 1; y < 6; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 3, y: 3, type: 'arcane_core' });
            l.push({ x: 3, y: 1, type: 'ritual_chalk' });
            l.push({ x: 2, y: 2, type: 'ritual_chalk' }); l.push({ x: 4, y: 2, type: 'ritual_chalk' });
            l.push({ x: 2, y: 4, type: 'ritual_chalk' }); l.push({ x: 4, y: 4, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Desert: Desert Obelisk — 5×9 brick tower, core with 6 of 8 Great Forge chalk (side tiles missing)
    desert_obelisk: {
        biome: 'desert',
        name: 'Desert Obelisk',
        width: 5, height: 9,
        floorTerrain: 'sand',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 5; x++) { l.push({ x, y: 0, type: 'brick_wall' }); l.push({ x, y: 8, type: 'brick_wall' }); }
            for (let y = 1; y < 8; y++) { l.push({ x: 0, y, type: 'brick_wall' }); l.push({ x: 4, y, type: 'brick_wall' }); }
            l.push({ x: 2, y: 8, type: 'door' });
            for (let y = 1; y < 8; y++) { for (let x = 1; x < 4; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 4, type: 'arcane_core' });
            l.push({ x: 1, y: 3, type: 'ritual_chalk' }); l.push({ x: 2, y: 3, type: 'ritual_chalk' }); l.push({ x: 3, y: 3, type: 'ritual_chalk' });
            l.push({ x: 1, y: 5, type: 'ritual_chalk' }); l.push({ x: 2, y: 5, type: 'ritual_chalk' }); l.push({ x: 3, y: 5, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Tundra: Frozen Cairn — 7×5 stone ruin, open roof feel, core with 1 of 2 Watcher's Eye chalk
    frozen_cairn: {
        biome: 'tundra',
        name: 'Frozen Cairn',
        width: 7, height: 5,
        floorTerrain: 'gravel',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 7; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 4, type: 'stone_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 6, y, type: 'stone_wall' }); }
            l.push({ x: 3, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 3, y: 2, type: 'arcane_core' });
            l.push({ x: 3, y: 1, type: 'ritual_chalk' });
            l.push({ x: 1, y: 1, type: 'stone_wall' }); l.push({ x: 5, y: 1, type: 'stone_wall' });
            l.push({ x: 1, y: 3, type: 'stone_wall' }); l.push({ x: 5, y: 3, type: 'stone_wall' });
            return l;
        })(),
    },
    // Mountain: Sentinel Ring — 7×7 open ring of standing stones, core with 3 of 4 Star Ward chalk
    sentinel_ring: {
        biome: 'mountain',
        name: 'Sentinel Ring',
        width: 7, height: 7,
        floorTerrain: 'gravel',
        layout: (() => {
            const l = [];
            for (let y = 1; y < 6; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            for (const [x, y] of [[0, 0], [3, 0], [6, 0], [0, 3], [6, 3], [0, 6], [3, 6], [6, 6]]) { l.push({ x, y, type: 'stone_wall' }); }
            l.push({ x: 3, y: 3, type: 'arcane_core' });
            l.push({ x: 3, y: 1, type: 'ritual_chalk' }); l.push({ x: 1, y: 3, type: 'ritual_chalk' }); l.push({ x: 5, y: 3, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Desert: Sun Altar — 9×9 brick terrace, core with 5 of 8 Grand Altar chalk
    sun_altar: {
        biome: 'desert',
        name: 'Sun Altar',
        width: 9, height: 9,
        floorTerrain: 'sand',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 9; x++) { l.push({ x, y: 0, type: 'brick_wall' }); l.push({ x, y: 8, type: 'brick_wall' }); }
            for (let y = 1; y < 8; y++) { l.push({ x: 0, y, type: 'brick_wall' }); l.push({ x: 8, y, type: 'brick_wall' }); }
            l.push({ x: 4, y: 8, type: 'door' });
            for (let y = 1; y < 8; y++) { for (let x = 1; x < 8; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 4, y: 4, type: 'arcane_core' });
            for (const [x, y] of [[2, 2], [3, 3], [5, 3], [6, 2], [3, 5]]) { l.push({ x, y, type: 'ritual_chalk' }); }
            return l;
        })(),
    },
};

// Sealed crypts: walled blocks with no door. The interior stays dark (tile.sealed)
// until a wall ring tile is opened, which wakes the guardians and exposes the
// chests and traps. They are separate from the generic ruins and landmarks so that
// danger never stands between a player and an Arcane Core.
//
// Every map gets one anchor crypt per gated realm chain. Its rift anchor, once
// attuned by a colonist, unlocks that chain for the Rift Gate (see RuinSystem.
// isChainAttuned). `tier` is the crypt's danger, so deeper chains sit behind harder
// crypts, and the one `starter` crypt (the first chain a player is likely to want)
// is placed near the start. `extras` adds loot-only crypts, keyed by map width
// (small / medium / large), as tier numbers. Any other width gets extras up to one
// crypt per `fallbackTilesPer` tiles. Larger tiers are placed first.
export const CRYPT_CONFIG = {
    anchors: [
        { chain: 'crystal',   tier: 1, starter: true },
        { chain: 'verdant',   tier: 1 },
        { chain: 'arcane',    tier: 2 },
        { chain: 'shadow',    tier: 2 },
        { chain: 'void_pact', tier: 2 },
        { chain: 'chaos',     tier: 3 },
        { chain: 'kingdom',   tier: 3 },
    ],
    extras: {
        128: [],
        256: [1, 1],
        384: [1, 1, 1, 2, 2],
    },
    chainNames: {
        crystal: 'Crystal', verdant: 'Verdant', arcane: 'Arcane', shadow: 'Shadow',
        void_pact: 'Void Pact', chaos: 'Chaos', kingdom: 'Kingdom',
    },
    // Per-chain look and contents of an anchor crypt. `biome` is where it is placed
    // (falling back to anywhere on the map if the biome has no room). `wall` and
    // `floor` replace the blueprint's stone ones. `guardians` fill the blueprint's
    // light (crypt_warden) and heavy (bone_sentinel) slots. `loot` entries are added
    // to the tier's chest table so the chain's own materials show up. Crypts without
    // a chain (the extras) use `default`.
    themes: {
        default:   { wall: 'stone_wall', floor: 'stone_floor', terrain: 'dirt', guardians: { light: 'crypt_warden', heavy: 'bone_sentinel' }, loot: [] },
        verdant:   { biome: 'forest',    wall: 'wood_wall',  floor: 'wood_floor',  terrain: 'forest_grass', guardians: { light: 'thorn_warden',    heavy: 'briar_sentinel' },   loot: [{ resource: 'planks', weight: 25, amount: [4, 8] }, { resource: 'leather', weight: 20, amount: [2, 5] }] },
        crystal:   { biome: 'mountain',  wall: 'stone_wall', floor: 'stone_floor', terrain: 'gravel',       guardians: { light: 'crystal_warden',  heavy: 'crystal_sentinel' }, loot: [{ resource: 'runite_ore', weight: 25, amount: [3, 6] }, { resource: 'fracture_dust', weight: 15, amount: [1, 3] }] },
        arcane:    { biome: 'grassland', wall: 'brick_wall', floor: 'brick_floor', terrain: 'dirt',         guardians: { light: 'rune_automaton',  heavy: 'arcane_sentinel' },  loot: [{ resource: 'runite', weight: 25, amount: [1, 3] }, { resource: 'cloth', weight: 20, amount: [3, 6] }] },
        shadow:    { biome: 'swamp',     wall: 'stone_wall', floor: 'stone_floor', terrain: 'mud',          guardians: { light: 'shade_warden',    heavy: 'gloom_sentinel' },   loot: [{ resource: 'void_essence', weight: 25, amount: [1, 3] }, { resource: 'gold', weight: 20, amount: [3, 6] }] },
        void_pact: { biome: 'tundra',    wall: 'void_wall',  floor: 'stone_floor', terrain: 'snow_ground',  guardians: { light: 'void_acolyte',    heavy: 'void_sentinel' },    loot: [{ resource: 'void_essence', weight: 35, amount: [2, 5] }, { resource: 'runite', weight: 15, amount: [1, 3] }] },
        chaos:     { biome: 'desert',    wall: 'brick_wall', floor: 'brick_floor', terrain: 'red_rock',     guardians: { light: 'fracture_wraith', heavy: 'fracture_horror' },  loot: [{ resource: 'fracture_dust', weight: 35, amount: [2, 5] }, { resource: 'void_essence', weight: 15, amount: [1, 2] }] },
        kingdom:   { biome: 'grassland', wall: 'stone_wall', floor: 'brick_floor', terrain: 'grass',        guardians: { light: 'palace_husk',     heavy: 'revenant_knight' },  loot: [{ resource: 'gold', weight: 30, amount: [4, 9] }, { resource: 'iron', weight: 20, amount: [3, 6] }] },
    },
    fallbackTilesPer: 14700,
    // Crypts are warded (ring walls indestructible) until the named chain's boss realm
    // has been completed, which makes the crypts a straight progression ladder from the
    // two open starters (verdant, crystal). `wardedBy` is keyed by an anchor crypt's
    // chain, `extraWardedBy` by a loot-only crypt's tier. A missing key means no ward.
    wardedBy: { arcane: 'crystal', shadow: 'arcane', void_pact: 'shadow', kingdom: 'void_pact', chaos: 'kingdom' },
    extraWardedBy: { 2: 'crystal', 3: 'void_pact' },
    startKeepOut: 12,        // tiles from map centre where no crypt may stand
    starterRange: [16, 45],  // the starter crypt sits this far from map centre when its biome allows
    deepVaultMinDist: 0.25,  // tier 3 stands at least this fraction of the map's short side from centre
    padding: 3,
    margin: 8,
    guardianHpMult: { 1: 1, 2: 1.4, 3: 1.9 },
    trapDamage: { 1: 8, 2: 12, 3: 16 },
};

// Weighted chest contents per tier, rolled once at generation and stored on the
// ruin (a reload must not reroll). `amount` is [min, max].
export const RUIN_LOOT = {
    1: {
        rolls: [2, 3],
        entries: [
            { resource: 'iron', weight: 30, amount: [3, 6] },
            { resource: 'gold', weight: 20, amount: [2, 4] },
            { resource: 'bricks', weight: 20, amount: [6, 12] },
            { resource: 'runite_ore', weight: 20, amount: [2, 4] },
            { resource: 'fracture_dust', weight: 10, amount: [1, 2] },
        ],
    },
    2: {
        rolls: [3, 4],
        entries: [
            { resource: 'iron', weight: 20, amount: [5, 9] },
            { resource: 'gold', weight: 25, amount: [4, 8] },
            { resource: 'runite', weight: 25, amount: [2, 4] },
            { resource: 'fracture_dust', weight: 15, amount: [2, 4] },
            { resource: 'void_essence', weight: 15, amount: [1, 3] },
        ],
    },
    3: {
        rolls: [3, 5],
        entries: [
            { resource: 'gold', weight: 25, amount: [8, 14] },
            { resource: 'runite', weight: 30, amount: [4, 7] },
            { resource: 'fracture_dust', weight: 15, amount: [3, 6] },
            { resource: 'void_essence', weight: 30, amount: [3, 6] },
        ],
    },
};

/**
 * Tiles of a crypt's wall ring and sealed interior, relative to its bounding box.
 * A rect crypt is the box's perimeter around a rectangular interior. A circle crypt
 * (w == h == diameter, odd) has every tile within `innerRadius` of the centre as
 * interior, and its ring is every other tile that touches the interior, including
 * diagonally, so the interior is closed even against diagonal movement.
 *
 * @param {string} shape 'rect' or 'circle'.
 * @param {number} w Bounding box width in tiles.
 * @param {number} h Bounding box height in tiles.
 * @param {number} [innerRadius] Circle only: interior radius in tiles.
 * @return {{ring: Array<{x: number, y: number}>, interior: Array<{x: number, y: number}>}}
 */
export function getCryptTiles(shape, w, h, innerRadius = 0) {
    const ring = [], interior = [];
    if (shape === 'circle') {
        const c = (w - 1) / 2;
        const inside = (x, y) => Math.hypot(x - c, y - c) <= innerRadius;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (inside(x, y)) { interior.push({ x, y }); continue; }
                let touches = false;
                for (let dy = -1; dy <= 1 && !touches; dy++) {
                    for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy)) { touches = true; break; }
                }
                if (touches) ring.push({ x, y });
            }
        }
        return { ring, interior };
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? ring : interior).push({ x, y });
        }
    }
    return { ring, interior };
}

// Builds a crypt blueprint: a door-less wall ring around a stone-floored interior,
// optional interior pillars, and the chest, guardian and trap positions (relative
// to the blueprint origin), plus the `anchor` spot used only by anchor crypts. Chests, guardians, traps and the anchor are stamped by
// generateCrypts, not by `layout`, so they are never lost to decay.
function makeCrypt({ name, tier, width, height, pillars = [], chests, guardians, traps, anchor }) {
    const layout = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ring = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            layout.push({ x, y, type: ring ? 'stone_wall' : 'stone_floor' });
        }
    }
    for (const p of pillars) layout.push({ x: p.x, y: p.y, type: 'stone_wall' });
    return {
        name, tier, width, height, floorTerrain: 'dirt', layout, shape: 'rect',
        ...getCryptTiles('rect', width, height),
        chests, guardians, traps, anchor,
    };
}

// Round variant of makeCrypt. `diameter` is the bounding box side and `innerRadius`
// the interior radius (see getCryptTiles). Every chest, guardian, trap, pillar and
// the anchor must sit on an interior tile, checked here so a typo fails at load.
function makeCircleCrypt({ name, tier, diameter, innerRadius, pillars = [], chests, guardians, traps, anchor }) {
    const { ring, interior } = getCryptTiles('circle', diameter, diameter, innerRadius);
    const isInterior = new Set(interior.map(t => `${t.x},${t.y}`));
    for (const p of [...pillars, ...chests, ...guardians, ...traps, anchor]) {
        if (!isInterior.has(`${p.x},${p.y}`)) throw new Error(`${name}: (${p.x},${p.y}) is not on an interior tile`);
    }
    const layout = [
        ...ring.map(t => ({ ...t, type: 'stone_wall' })),
        ...interior.map(t => ({ ...t, type: 'stone_floor' })),
        ...pillars.map(p => ({ x: p.x, y: p.y, type: 'stone_wall' })),
    ];
    return {
        name, tier, width: diameter, height: diameter, floorTerrain: 'dirt', layout,
        shape: 'circle', innerRadius, ring, interior,
        chests, guardians, traps, anchor,
    };
}

export const CRYPT_BLUEPRINTS = {
    1: [makeCrypt({
        name: 'barrow_crypt', tier: 1, width: 7, height: 7,
        pillars: [{ x: 2, y: 3 }, { x: 4, y: 3 }],
        chests: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
        guardians: [{ x: 3, y: 3, type: 'crypt_warden' }],
        traps: [{ x: 3, y: 1 }, { x: 3, y: 5 }],
        anchor: { x: 3, y: 2 },
    }), makeCircleCrypt({
        name: 'round_barrow', tier: 1, diameter: 9, innerRadius: 3.2,
        chests: [{ x: 2, y: 5 }, { x: 6, y: 5 }],
        guardians: [{ x: 4, y: 4, type: 'crypt_warden' }],
        traps: [{ x: 4, y: 3 }, { x: 4, y: 6 }],
        anchor: { x: 4, y: 2 },
    })],
    2: [makeCrypt({
        name: 'bone_vault', tier: 2, width: 9, height: 7,
        pillars: [{ x: 3, y: 2 }, { x: 5, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 4 }],
        chests: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 4, y: 5 }],
        guardians: [{ x: 4, y: 3, type: 'bone_sentinel' }, { x: 2, y: 3, type: 'crypt_warden' }],
        traps: [{ x: 4, y: 1 }, { x: 2, y: 5 }, { x: 6, y: 5 }],
        anchor: { x: 4, y: 2 },
    }), makeCircleCrypt({
        name: 'moon_vault', tier: 2, diameter: 11, innerRadius: 4.2,
        pillars: [{ x: 3, y: 3 }, { x: 7, y: 3 }],
        chests: [{ x: 2, y: 6 }, { x: 8, y: 6 }, { x: 5, y: 8 }],
        guardians: [{ x: 5, y: 5, type: 'bone_sentinel' }, { x: 3, y: 5, type: 'crypt_warden' }],
        traps: [{ x: 5, y: 3 }, { x: 3, y: 7 }, { x: 7, y: 7 }],
        anchor: { x: 5, y: 2 },
    })],
    3: [makeCrypt({
        name: 'deep_vault', tier: 3, width: 11, height: 9,
        pillars: [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 3, y: 5 }, { x: 7, y: 5 }],
        chests: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 5, y: 7 }],
        guardians: [{ x: 5, y: 4, type: 'bone_sentinel' }, { x: 3, y: 4, type: 'bone_sentinel' }, { x: 7, y: 4, type: 'crypt_warden' }],
        traps: [{ x: 5, y: 1 }, { x: 2, y: 7 }, { x: 8, y: 7 }, { x: 5, y: 6 }],
        anchor: { x: 5, y: 2 },
    }), makeCircleCrypt({
        name: 'great_rotunda', tier: 3, diameter: 13, innerRadius: 5.2,
        pillars: [{ x: 4, y: 4 }, { x: 8, y: 4 }, { x: 4, y: 8 }, { x: 8, y: 8 }],
        chests: [{ x: 2, y: 6 }, { x: 10, y: 6 }, { x: 6, y: 10 }],
        guardians: [{ x: 6, y: 6, type: 'bone_sentinel' }, { x: 4, y: 6, type: 'bone_sentinel' }, { x: 8, y: 6, type: 'crypt_warden' }],
        traps: [{ x: 6, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 6, y: 8 }],
        anchor: { x: 6, y: 2 },
    })],
};

export const FOODSTUFFS =['wheat', 'berries', 'corn', 'potatoes', 'moonbloom', 'meat', 'eggs', 'milk'];

export const NON_FOOD_CROPS = ['cotton'];

export const FOOD_DECAY_CONFIG = {
    decayInterval: 50,
    baseDecayRate: 0.02,
    decayMultipliers: {
        milk: 2.5,
        berries: 2.0,
        meat: 1.8,
        eggs: 1.5,
        moonbloom: 1.0,
        potatoes: 0.7,
        corn: 0.6,
        wheat: 0.5,
        food: 0.3,
    },
    seasonDecayMult: {
        spring: 1.0,
        summer: 1.5,
        autumn: 1.0,
        winter: 0.5,
    },
    foodChestReduction: 0.15,
    foodChestMaxReduction: 0.6,
    iceBoxReduction: 0.4,
    maxTotalReduction: 0.9,
};

export const CROPS = {
    wheat: { growthTicks: 200, harvestYield: 3, seasons: ['spring', 'summer', 'autumn'], char: '%', readyChar: '⌂', color: '#ccaa00' },
    berries: { growthTicks: 150, harvestYield: 2, seasons: ['spring', 'summer', 'autumn'], char: '♣', readyChar: '●', color: '#cc44aa' },
    cotton: { growthTicks: 200, harvestYield: 3, seasons: ['spring', 'summer'], char: '♠', readyChar: '⊙', color: '#eeeeee', research: 'textiles' },
    corn: { growthTicks: 250, harvestYield: 4, seasons: ['summer'], char: '↑', readyChar: '⌠', color: '#ffcc00', research: 'alchemy' },
    potatoes: { growthTicks: 180, harvestYield: 3, seasons: ['spring', 'autumn', 'winter'], char: '~', readyChar: '◘', color: '#aa7744', research: 'alchemy' },
    moonbloom: { growthTicks: 220, harvestYield: 2, seasons: ['spring', 'summer', 'autumn', 'winter'], char: '✿', readyChar: '❀', color: '#cc88ff', research: 'herbalism' },
};

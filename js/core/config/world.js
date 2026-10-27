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

// Biome definitions: terrain mix, resource density, shoreline terrain, and which
// landmark ruin to guarantee inside that biome. Consumed by generateBiomeLayout
// in map.js.
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
        landmark: 'waystone_shrine',
        terrainWeights: { grass: 0.80, dirt: 0.20 },
        patchScale: 14,
        areaWeight: 0.98,
        treeDensity: 0.10,
        shore: { inner: 'sand', outer: 'gravel' },
    },
    forest: {
        landmark: 'woodcutters_lodge',
        terrainWeights: { forest_grass: 0.70, dirt: 0.30 },
        patchScale: 12,
        areaWeight: 1.23,
        treeDensity: 0.35,
        shore: { inner: 'sand', outer: 'gravel' },
    },
    mountain: {
        landmark: 'dwarven_vault',
        terrainWeights: { gravel: 0.20, rock: 0.55, tall_rock: 0.25 },
        patchScale: 10,
        areaWeight: 0.76,
        treeDensity: 0.01,
        rockResources: true,
        shore: { inner: 'gravel', outer: null },
    },
    swamp: {
        landmark: 'witchs_hut',
        terrainWeights: { swamp_grass: 0.25, mud: 0.50, shallow_water: 0.25 },
        patchScale: 9,
        areaWeight: 1.17,
        treeDensity: 0.05,
        shore: { inner: 'mud', outer: null },
    },
    desert: {
        landmark: 'desert_obelisk',
        terrainWeights: { sand: 0.60, gravel: 0.15, red_rock: 0.25 },
        patchScale: 16,
        areaWeight: 1.05,
        treeDensity: 0.0,
        desertResources: true,
        shore: { inner: 'sand', outer: null },
    },
    tundra: {
        landmark: 'frozen_cairn',
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
            count: 1,
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
];

// Landmark blueprint library — one per biome, placed by generateBiomeLayout.
// Keyed by the landmark name in BIOMES above.
export const LANDMARK_BLUEPRINTS = {
    // Grassland: Waystone Shrine — 5×5 stone ring, open center, pedestal
    waystone_shrine: {
        name: 'Waystone Shrine',
        width: 5, height: 5,
        floorTerrain: 'dirt',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 5; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 4, type: 'stone_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 4, y, type: 'stone_wall' }); }
            l.push({ x: 2, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 4; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 2, type: 'artifact_pedestal' });
            return l;
        })(),
    },
    // Forest: Woodcutter's Lodge — 7×5 wood cabin, door, workbench inside
    woodcutters_lodge: {
        name: "Woodcutter's Lodge",
        width: 7, height: 5,
        floorTerrain: 'dirt',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 7; x++) { l.push({ x, y: 0, type: 'wood_wall' }); l.push({ x, y: 4, type: 'wood_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'wood_wall' }); l.push({ x: 6, y, type: 'wood_wall' }); }
            l.push({ x: 3, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 2, type: 'workbench' });
            return l;
        })(),
    },
    // Mountain: Dwarven Vault — 11×9, stone outer wall, brick inner vault, reinforced door, anvil
    dwarven_vault: {
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
            l.push({ x: 5, y: 4, type: 'anvil' });
            return l;
        })(),
    },
    // Swamp: Witch's Hut — 7×7 wood hut, irregular shape, alchemy table
    witchs_hut: {
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
            l.push({ x: 3, y: 2, type: 'alchemy_table' });
            return l;
        })(),
    },
    // Desert: Desert Obelisk — 5×9 brick tower, ritual chalk at base
    desert_obelisk: {
        name: 'Desert Obelisk',
        width: 5, height: 9,
        floorTerrain: 'sand',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 5; x++) { l.push({ x, y: 0, type: 'brick_wall' }); l.push({ x, y: 8, type: 'brick_wall' }); }
            for (let y = 1; y < 8; y++) { l.push({ x: 0, y, type: 'brick_wall' }); l.push({ x: 4, y, type: 'brick_wall' }); }
            l.push({ x: 2, y: 8, type: 'door' });
            for (let y = 1; y < 8; y++) { for (let x = 1; x < 4; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 2, y: 4, type: 'artifact_pedestal' });
            l.push({ x: 1, y: 3, type: 'ritual_chalk' }); l.push({ x: 2, y: 3, type: 'ritual_chalk' }); l.push({ x: 3, y: 3, type: 'ritual_chalk' });
            l.push({ x: 1, y: 5, type: 'ritual_chalk' }); l.push({ x: 2, y: 5, type: 'ritual_chalk' }); l.push({ x: 3, y: 5, type: 'ritual_chalk' });
            return l;
        })(),
    },
    // Tundra: Frozen Cairn — 7×5 stone ruin, open roof feel, pedestal center
    frozen_cairn: {
        name: 'Frozen Cairn',
        width: 7, height: 5,
        floorTerrain: 'gravel',
        layout: (() => {
            const l = [];
            for (let x = 0; x < 7; x++) { l.push({ x, y: 0, type: 'stone_wall' }); l.push({ x, y: 4, type: 'stone_wall' }); }
            for (let y = 1; y < 4; y++) { l.push({ x: 0, y, type: 'stone_wall' }); l.push({ x: 6, y, type: 'stone_wall' }); }
            l.push({ x: 3, y: 4, type: 'door' });
            for (let y = 1; y < 4; y++) { for (let x = 1; x < 6; x++) { l.push({ x, y, type: 'stone_floor' }); } }
            l.push({ x: 3, y: 2, type: 'artifact_pedestal' });
            l.push({ x: 1, y: 1, type: 'stone_wall' }); l.push({ x: 5, y: 1, type: 'stone_wall' });
            l.push({ x: 1, y: 3, type: 'stone_wall' }); l.push({ x: 5, y: 3, type: 'stone_wall' });
            return l;
        })(),
    },
};

export const FOODSTUFFS = ['wheat', 'berries', 'corn', 'potatoes', 'moonbloom', 'meat', 'eggs', 'milk'];

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

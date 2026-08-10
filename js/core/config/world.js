export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_EFFECTS = {
    spring: { cropGrowthMult: 1.0, animalSpawnRate: 0.04, tempRange: [10, 20] },
    summer: { cropGrowthMult: 1.5, animalSpawnRate: 0.035, tempRange: [20, 35] },
    autumn: { cropGrowthMult: 0.8, animalSpawnRate: 0.015, tempRange: [5, 15] },
    winter: { cropGrowthMult: 0, animalSpawnRate: 0.004, tempRange: [-10, 5] },
};

export const TERRAIN = {
    grass:  { char: '.', color: '#6aad44', bg: '#1a2a12', moveCost: 8, passable: { colonist: true, animal: true, enemy: true } },
    dirt:   { char: ',', color: '#bb8850', bg: '#2a1e14', moveCost: 8, passable: { colonist: true, animal: true, enemy: true } },
    sand:   { char: '∙', color: '#e0c878', bg: '#2a2618', moveCost: 12, passable: { colonist: true, animal: true, enemy: true } },
    gravel: { char: ':', color: '#a09888', bg: '#1e1c1a', moveCost: 10, passable: { colonist: true, animal: true, enemy: true } },
    rock:      { char: '#', color: '#999', bg: '#222', moveCost: 20, passable: { colonist: true, animal: false, enemy: true } },
    tall_rock: { char: '▲', color: '#777', bg: '#1a1a1a', moveCost: Infinity, passable: { colonist: false, animal: false, enemy: false } },
    water:     { char: '~', color: '#55aaff', bg: '#0a1a2e', moveCost: 16, passable: { colonist: true, animal: false, enemy: true } },
};

export const RESOURCES = {
    tree:       { char: 'T', color: '#8B6B3A', springColor: '#55cc44', summerColor: '#338822', autumnColor: '#cc8822', winterColor: '#667788', designation: 'chop', work: 12, yield: { wood: 1 }, perAmount: true },
    stone:      { char: 'o', color: '#999', designation: 'mine', work: 18, yield: { stone: 1 }, perAmount: true },
    iron_ore:   { char: 'o', color: '#cc8844', designation: 'mine', work: 20, yield: { iron_ore: 1 }, perAmount: true },
    runite_ore: { char: 'o', color: '#44cccc', designation: 'mine', work: 22, yield: { runite: 1 }, perAmount: true },
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

export const MAP_GENERATORS = [
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

export const FOODSTUFFS = ['wheat', 'berries', 'corn', 'potatoes', 'moonbloom', 'meat', 'eggs', 'milk'];

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
    corn: { growthTicks: 250, harvestYield: 4, seasons: ['summer'], char: '↑', readyChar: '⌠', color: '#ffcc00', research: 'druidcraft' },
    potatoes: { growthTicks: 180, harvestYield: 3, seasons: ['spring', 'autumn', 'winter'], char: '~', readyChar: '◘', color: '#aa7744', research: 'druidcraft' },
    moonbloom: { growthTicks: 220, harvestYield: 2, seasons: ['spring', 'summer', 'autumn', 'winter'], char: '✿', readyChar: '❀', color: '#cc88ff', research: 'herbalism' },
};

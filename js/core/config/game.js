export const GAME_VERSION = '0.1.0';

export const CONFIG = {
    MAP_WIDTH: 128,
    MAP_HEIGHT: 128,
    VIEWPORT_WIDTH: 80,
    VIEWPORT_HEIGHT: 40,
    TICK_RATE: 200,
    TICKS_PER_SEASON: 2400,
    TICKS_PER_DAY: 480,
    START_RESOURCES: { wood: 25, stone: 15, planks: 5, food: 20, meat: 0, wheat: 0, berries: 0, corn: 0, potatoes: 0, moonbloom: 0, bricks: 0, hides: 0, leather: 0, iron_ore: 0, iron: 0, runite: 0, eggs: 0, milk: 0, wool: 0, void_essence: 0, gold: 0 },
    PEACEFUL_MODE: false,
    GAME_SPEED: 1,
    STOCKPILE_ALERTS: { wood: 5, stone: 5, food: 5 },
};

export const DAY_NIGHT = { nightStart: 0.7, dayStart: 0.2 };

export const EVENTS = {
    wanderer: { weight: 10, minTick: 480, cooldown: 1280, effect: 'custom' },
    caravan: { weight: 6, minTick: 640, cooldown: 1600, effect: 'custom' },
    fire: { weight: 4, minTick: 320, cooldown: 640, seasons: ['summer'], effect: 'custom' },
    blight: {
        weight: 8, minTick: 320, cooldown: 960, seasons: ['summer', 'autumn'],
        effect: 'crop_damage',
        chance: 0.4,
        thought: 'Crops died', moodChange: -15, moodDuration: 480,
        notification: 'Crop blight! {count} plants destroyed.',
        logMessage: 'Crop blight destroyed {count} plants', logType: 'danger',
    },
    cold_snap: {
        weight: 7, minTick: 160, cooldown: 960, seasons: ['winter'],
        effect: 'crop_damage',
        chance: 1.0,
        thought: 'Freezing cold snap', moodChange: -12, moodDuration: 480,
        notification: 'Cold snap! All outdoor crops frozen.',
        logMessage: 'Cold snap froze all outdoor crops', logType: 'danger',
    },
    windfall: {
        weight: 5, minTick: 800, cooldown: 1920,
        effect: 'deposit',
        location: 'anywhere', radius: 1, terrain: ['grass'], fillChance: 0.6,
        deposits: [{ type: 'stone', amount: [3, 5] }],
        notification: 'Mineral vein discovered! {count} new stone deposits.',
        logMessage: 'Mineral windfall: {count} new stone deposits', logType: 'event',
    },
    meteorite: {
        weight: 5, minTick: 960, cooldown: 2400,
        effect: 'deposit',
        location: 'edge', radius: 2, terrain: ['grass', 'dirt'], fillChance: 0.5,
        deposits: [
            { type: 'runite_ore', weight: 3, amount: [2, 3] },
            { type: 'stone', weight: 7, amount: [4, 7] },
        ],
        notification: 'Meteorite impact! {count} deposits found.',
        logMessage: 'Meteorite: {count} deposits at map edge', logType: 'event',
    },
    forest_growth: {
        weight: 7, minTick: 640, cooldown: 1600,
        effect: 'deposit',
        location: 'edge', radius: 3, terrain: ['grass'], fillChance: 0.55,
        deposits: [{ type: 'tree', amount: [3, 5] }],
        notification: 'Forest growth! {count} new trees appeared.',
        logMessage: 'Forest growth: {count} new trees near map edge', logType: 'event',
    },
    migration: {
        weight: 8, minTick: 480, cooldown: 1280, seasons: ['autumn', 'spring'],
        effect: 'spawn_animals',
        animals: [{ type: 'deer', count: [4, 7] }],
        notification: 'Animal migration! {count} deer passing through.',
        logMessage: 'Animal migration: {count} deer passing through', logType: 'event',
    },
    inspiration: {
        weight: 12, minTick: 160, cooldown: 480,
        effect: 'mood',
        thought: 'Feeling inspired!', moodChange: 25, moodDuration: 480,
        notification: '{name} is feeling inspired!',
        logMessage: '{name} is feeling inspired!', logType: 'success',
    },
};

export const FIRE_CONFIG = {
    initialLifespan: 20,
    spreadChance: 0.05,
    spreadTimerMin: 15,
    spreadTimerMax: 25,
};

// CARAVAN_TRADES moved to ./trade.js (still re-exported via index.js).

export const PATHFINDING_CONFIG = {
    maxNodes: 20000,
    raiderRepathInterval: 15,
    raiderSearchRadius: 100,
    breakableCostPenalty: 10,
};

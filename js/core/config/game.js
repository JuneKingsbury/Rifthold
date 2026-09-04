export const GAME_VERSION = '0.2.0';

export const CONFIG = {
    MAP_WIDTH: 128,
    MAP_HEIGHT: 128,
    VIEWPORT_WIDTH: 80,
    VIEWPORT_HEIGHT: 40,
    TICK_RATE: 200,
    // Upper bound on per-frame simulation time (ms). Caps catch-up ticks after a
    // stall/backgrounded tab so the loop can't enter a spiral of death.
    MAX_FRAME_DELTA: 250,
    TICKS_PER_SEASON: 2400,
    TICKS_PER_DAY: 480,
    START_RESOURCES: { wood: 25, stone: 15, planks: 5, food: 20, meat: 0, wheat: 0, berries: 0, corn: 0, potatoes: 0, moonbloom: 0, cotton: 0, bricks: 0, hides: 0, leather: 0, iron_ore: 0, iron: 0, runite: 0, cloth: 0, eggs: 0, milk: 0, wool: 0, void_essence: 0, gold: 0 },
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
        weight: 7, minTick: 400, cooldown: 1200, seasons: ['spring', 'summer'],
        effect: 'creeping_miasma',
        initialTiles: [1, 3],
        thought: 'Blight in the fields', moodChange: -8, moodDuration: 300,
        notification: 'Dark spores settle on your crops! {count} tiles infected.',
        logMessage: 'Creeping miasma infected {count} crop tiles', logType: 'danger',
    },
    blight_bloom: {
        weight: 5, minTick: 600, cooldown: 1600, seasons: ['summer', 'autumn'],
        effect: 'spawn_blight_bloom',
        spawnCount: [1, 2],
        thought: 'Blight has taken root', moodChange: -10, moodDuration: 200,
        notification: 'Blight blooms have erupted in your fields!',
        logMessage: 'Blight blooms spawned in the fields', logType: 'danger',
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
    pleasant_weather: {
        weight: 9, minTick: 320, cooldown: 640, seasons: ['spring', 'summer'],
        effect: 'mood',
        thought: 'Enjoyed the weather', moodChange: 6, moodDuration: 400,
        notification: '{name} is enjoying the weather.',
        logMessage: '{name} enjoyed the pleasant weather', logType: 'success',
    },
    shooting_star: {
        weight: 5, minTick: 480, cooldown: 1280,
        effect: 'mood',
        thought: 'Saw a shooting star', moodChange: 8, moodDuration: 400,
        notification: '{name} saw a shooting star!',
        logMessage: '{name} saw a shooting star', logType: 'success',
    },
    found_trinket: {
        weight: 6, minTick: 320, cooldown: 960,
        effect: 'mood',
        thought: 'Found a lucky trinket', moodChange: 5, moodDuration: 350,
        notification: '{name} found a lucky trinket.',
        logMessage: '{name} found a lucky trinket', logType: 'success',
    },
};

export const FIRE_CONFIG = {
    initialLifespan: 20,
    spreadChance: 0.05,
    spreadTimerMin: 15,
    spreadTimerMax: 25,
};

export const BLIGHT_CONFIG = {
    decayPerTick: 2,
    spreadChance: 0.12,
    maxSpreads: 3,
    cleanseWork: 10,
    bloomHp: 30,
    bloomDamageRadius: 3,
    bloomKillChance: 0.3,
    bloomReproduceTicks: 120,
    bloomReproduceChance: 0.25,
    bloomPassiveDamageInterval: 10,
    bloomPedestalDamage: 2,
    bloomDamageReductionAura: 0.5,
};

// CARAVAN_TRADES moved to ./trade.js (still re-exported via index.js).

export const PATHFINDING_CONFIG = {
    maxNodes: 20000,
    raiderRepathInterval: 15,
    raiderSearchRadius: 100,
    breakableCostPenalty: 10,
    // Soft penalty added to the move-cost of a tile currently occupied by another
    // entity. Occupied tiles stay traversable so a path is always found, but this
    // makes A* route around other colonists (and pick distinct standing tiles)
    // whenever an alternative of comparable length exists. Stepping onto an
    // occupied tile only as a last resort. Tuned so a detour of a few tiles is
    // preferred over overlapping, while a long detour still yields to walking through.
    occupiedCostPenalty: 8,
    // Soft penalty added to the move-cost of a tile holding walkable furniture (a
    // bed, chair, workbench, etc.). Entities stay able to walk through furniture so
    // a path is always found, but this biases A* toward routing around it whenever a
    // comparable-length open-tile alternative exists, cutting through furniture only
    // when it's the shortest option by a wide margin. The path's own endpoint is
    // exempt so a colonist can still target the furniture tile itself (sleep, craft).
    furnitureCostPenalty: 6,
};

import { CONFIG, ENTITIES } from './config.js';
import { syncEntityIdCounter } from '../entities/entity-factory.js';
import { ensureEntityRoles } from '../entities/roles.js';

const SAVE_KEY = 'colony_save';
const SAVE_VERSION = 7;

export function saveGame(game) {
    const layout = captureLayout();
    const data = {
        version: SAVE_VERSION,
        tick: game.tick,
        timeOfDay: game.timeOfDay,
        speed: game.speed,
        settings: game.settings,
        peaceful: CONFIG.PEACEFUL_MODE,
        layout,

        map: serializeMap(game.map),
        colonists: game.colonists,
        entities: game.entities,
        raiders: game.raiders,

        resources: {
            stockpile: game.resources.stockpile,
            weapons: game.resources.weapons,
            armors: game.resources.armors,
            helmets: game.resources.helmets,
            tools: game.resources.tools,
            artifacts: game.resources.artifacts,
            potions: game.resources.potions,
            tomes: game.resources.tomes,
            consumables: game.resources.consumables,
            _decayAccumulators: game.resources._decayAccumulators,
            reservedFoodstuffs: game.resources.reservedFoodstuffs,
        },

        weather: {
            season: game.weather.season,
            seasonIndex: game.weather.seasonIndex,
            seasonTick: game.weather.seasonTick,
            temperature: game.weather.temperature,
            currentWeather: game.weather.currentWeather,
            weatherTimer: game.weather.weatherTimer,
            year: game.weather.year,
        },

        combat: {
            nextRaidTick: game.combat.nextRaidTick,
            raidActive: game.combat.raidActive,
            raidStartTick: game.combat.raidStartTick,
        },

        divinationModifiers: game.divinationModifiers || [],

        waves: {
            highestWaveCompleted: game.waves.highestWaveCompleted,
            active: game.waves.active,
            currentWave: game.waves.currentWave,
            nexusPosition: game.waves.nexusPosition,
            nexusHp: game.waves.nexusHp,
            nexusMaxHp: game.waves.nexusMaxHp,
            enemies: game.waves.enemies,
            enemiesSpawned: game.waves.enemiesSpawned,
            enemiesToSpawn: game.waves.enemiesToSpawn,
            spawnTimer: game.waves.spawnTimer,
            portals: game.waves.portals,
        },

        events: {
            cooldowns: game.events.cooldowns,
        },

        exploration: {
            expeditions: game.exploration.expeditions,
            completedExpeditions: game.exploration.completedExpeditions,
            completedRealms: [...(game.exploration.completedRealms || [])],
        },

        research: {
            completed: [...game.research.completed],
            activeResearch: game.research.activeResearch,
            progress: game.research.progress,
        },

        stats: game.stats,
        manaCrystalBonus: game.manaCrystalBonus || 0,
        discoveredLoot: [...(game.discoveredLoot || [])],

        story: {
            unlocked: Object.fromEntries(game.story.unlocked),
            viewed: [...game.story.viewed],
        },

        tutorial: game.tutorial ? {
            currentStep: game.tutorial.currentStep,
            completed: [...game.tutorial.completed],
            flags: { ...game.tutorial.flags },
        } : { currentStep: 0, completed: [], flags: {} },

        tasks: game.taskQueue.getAll(),
        eventLog: game.eventLog.entries,
    };

    const json = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value);
    localStorage.setItem(SAVE_KEY, json);
    return true;
}

export function loadGame(game) {
    try {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return false;

        const data = JSON.parse(json);

        // Saves are not migrated across versions; a mismatch is discarded and the
        // caller falls back to starting a fresh game.
        if (data.version !== SAVE_VERSION) {
            console.warn(`Incompatible save version ${data.version}, expected ${SAVE_VERSION}. Starting fresh.`);
            localStorage.removeItem(SAVE_KEY);
            return false;
        }

        CONFIG.PEACEFUL_MODE = data.peaceful;
        game.tick = data.tick;
        game.timeOfDay = data.timeOfDay;
        game.speed = data.speed;
        game.settings = { ...game.settings, ...data.settings };

        deserializeMap(game.map, data.map);

        game.colonists = data.colonists;
        game.rebuildColonistIndex();
        game.entities = data.entities || [];
        game.raiders = data.raiders || [];

        game.resources.stockpile = data.resources.stockpile;
        game.resources.weapons = data.resources.weapons;
        game.resources.armors = data.resources.armors || [];
        game.resources.helmets = data.resources.helmets || [];
        game.resources.tools = data.resources.tools || [];
        game.resources.artifacts = data.resources.artifacts || [];
        game.resources.potions = data.resources.potions || [];
        game.resources.tomes = data.resources.tomes || [];
        game.resources.consumables = data.resources.consumables || [];
        game.resources._decayAccumulators = data.resources._decayAccumulators || {};
        game.resources.reservedFoodstuffs = data.resources.reservedFoodstuffs || {};

        game.weather.season = data.weather.season;
        game.weather.seasonIndex = data.weather.seasonIndex;
        game.weather.seasonTick = data.weather.seasonTick;
        game.weather.temperature = data.weather.temperature;
        game.weather.currentWeather = data.weather.currentWeather;
        game.weather.weatherTimer = data.weather.weatherTimer;
        game.weather.year = data.weather.year;

        game.combat.nextRaidTick = data.combat.nextRaidTick;
        game.combat.raidActive = data.combat.raidActive;
        game.combat.raidStartTick = data.combat.raidStartTick;
        game.divinationModifiers = data.divinationModifiers || [];

        game.events.cooldowns = data.events.cooldowns;

        if (data.waves) {
            game.waves.highestWaveCompleted = data.waves.highestWaveCompleted || 0;
            game.waves.active = data.waves.active || false;
            game.waves.currentWave = data.waves.currentWave || 0;
            game.waves.nexusPosition = data.waves.nexusPosition || null;
            game.waves.nexusHp = data.waves.nexusHp || 0;
            game.waves.nexusMaxHp = data.waves.nexusMaxHp || 0;
            game.waves.enemies = data.waves.enemies || [];
            game.waves.enemiesSpawned = data.waves.enemiesSpawned || 0;
            game.waves.enemiesToSpawn = data.waves.enemiesToSpawn || 0;
            game.waves.spawnTimer = data.waves.spawnTimer || 0;
            game.waves.portals = data.waves.portals || [];
        }

        game.research.completed = new Set(data.research.completed);
        game.research.activeResearch = data.research.activeResearch || null;
        game.research.progress = data.research.progress || {};

        if (data.exploration) {
            game.exploration.expeditions = data.exploration.expeditions || [];
            game.exploration.completedExpeditions = data.exploration.completedExpeditions || [];
            game.exploration.completedRealms = new Set(data.exploration.completedRealms || []);
        }

        if (data.stats) {
            Object.assign(game.stats, data.stats);
        }
        game.manaCrystalBonus = data.manaCrystalBonus || 0;
        game.discoveredLoot = new Set(data.discoveredLoot || []);

        if (data.story) {
            game.story.unlocked = new Map(Object.entries(data.story.unlocked || {}));
            game.story.viewed = new Set(data.story.viewed || []);
        }

        if (data.tutorial && game.tutorial) {
            game.tutorial.currentStep = data.tutorial.currentStep || 0;
            game.tutorial.completed = new Set(data.tutorial.completed || []);
            game.tutorial.flags = data.tutorial.flags || {};
        }

        game.taskQueue.tasks = data.tasks || [];
        game.taskQueue.syncIdCounter();
        game.eventLog.entries = data.eventLog || [];

        syncEntityIdCounter([...game.colonists, ...game.entities, ...game.raiders]);

        // Backfill roles/roleState for every deserialized entity (tamed animals,
        // raiders, and wave enemies share the same normalization).
        for (const entity of game.entities) {
            ensureEntityRoles(entity, ENTITIES[entity.type]);
        }
        for (const raider of game.raiders) {
            ensureEntityRoles(raider, ENTITIES[raider.type]);
        }
        if (game.waves && game.waves.enemies) {
            for (const enemy of game.waves.enemies) {
                ensureEntityRoles(enemy, ENTITIES[enemy.type]);
            }
        }

        game.roomsDirty = true;

        if (data.layout) {
            restoreLayout(data.layout);
        }

        return true;
    } catch (e) {
        console.error('Failed to load save:', e);
        return false;
    }
}

export function hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
}

export function exportSave() {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return false;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colony_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

export function importSave(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.version !== SAVE_VERSION || !data.map || !data.colonists) {
                    resolve(false);
                    return;
                }
                localStorage.setItem(SAVE_KEY, e.target.result);
                resolve(true);
            } catch {
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
}

function serializeMap(map) {
    const rows = [];
    for (let y = 0; y < map.length; y++) {
        const row = [];
        for (let x = 0; x < map[y].length; x++) {
            const tile = map[y][x];
            const t = {
                t: tile.terrain,
                p: tile.passable ? 1 : 0,
            };
            if (tile.structure) t.s = tile.structure;
            if (tile.floor) t.fl = tile.floor;
            if (tile.structureHp !== undefined) t.shp = tile.structureHp;
            if (tile.resource) t.r = tile.resource;
            if (tile.designation) t.d = tile.designation;
            if (tile.zone) t.z = tile.zone;
            if (tile.onFire) { t.f = 1; t.ft = tile.fireTimer; }
            if (tile.snowCovered) t.sn = 1;
            if (tile.pedestalArtifact) t.pa = tile.pedestalArtifact;
            row.push(t);
        }
        rows.push(row);
    }
    return rows;
}

function deserializeMap(map, data) {
    for (let y = 0; y < data.length; y++) {
        for (let x = 0; x < data[y].length; x++) {
            const t = data[y][x];
            const tile = map[y][x];
            tile.terrain = t.t;
            tile.passable = t.p === 1;
            tile.structure = t.s || null;
            tile.floor = t.fl || null;
            tile.structureHp = t.shp !== undefined ? t.shp : undefined;
            tile.resource = t.r || null;
            tile.designation = t.d || null;
            tile.zone = t.z || null;
            tile.onFire = t.f === 1;
            tile.fireTimer = t.ft || 0;
            tile.snowCovered = t.sn === 1;
            tile.pedestalArtifact = t.pa || null;
            tile.roomId = null;
            tile.items = [];
        }
    }
}

function captureLayout() {
    const container = document.getElementById('game-container');
    const footer = document.getElementById('game-footer');
    const colonistHud = document.getElementById('colonist-hud');
    const eventLog = document.getElementById('event-log');
    const uiFontSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-size')) || 12;

    return {
        gridColumns: container?.style.gridTemplateColumns || null,
        footerHeight: footer?.style.height || null,
        colonistHudFlex: colonistHud?.style.flex || null,
        eventLogFlex: eventLog?.style.flex || null,
        uiFontSize,
    };
}

function restoreLayout(layout) {
    if (!layout) return;
    const container = document.getElementById('game-container');
    const footer = document.getElementById('game-footer');
    const colonistHud = document.getElementById('colonist-hud');
    const eventLog = document.getElementById('event-log');

    if (layout.gridColumns) container.style.gridTemplateColumns = layout.gridColumns;
    if (layout.footerHeight) footer.style.height = layout.footerHeight;
    if (layout.colonistHudFlex) colonistHud.style.flex = layout.colonistHudFlex;
    if (layout.eventLogFlex) eventLog.style.flex = layout.eventLogFlex;
    if (layout.uiFontSize) window.setUIFontSize(layout.uiFontSize);
}

// Shared fixtures for the unit tests. These build the minimal plain-data
// structures the game's pure functions operate on, so tests can exercise real
// modules (no browser/DOM) without booting the whole engine.
import { CONFIG } from '../js/core/config.js';
import { TaskQueue } from '../js/core/tasks.js';
import { MapIndex } from '../js/world/mapindex.js';

/**
 * Build a full MAP_HEIGHT x MAP_WIDTH grid of open floor tiles.
 * detectRooms/calculateRoomQualities iterate the entire configured map, so a
 * fixture must be full-size or those loops read undefined tiles.
 */
export function makeMap() {
    const map = [];
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            row.push({ terrain: 'grass', structure: null, floor: null, passable: true, roomId: null });
        }
        map.push(row);
    }
    return map;
}

/**
 * Stamp a hollow rectangle of wall structures onto the map, enclosing the
 * interior. Returns the interior bounds (inclusive) for convenience.
 */
export function enclose(map, x0, y0, x1, y1, wall = 'wood_wall') {
    for (let x = x0; x <= x1; x++) {
        map[y0][x].structure = wall; map[y0][x].passable = false;
        map[y1][x].structure = wall; map[y1][x].passable = false;
    }
    for (let y = y0; y <= y1; y++) {
        map[y][x0].structure = wall; map[y][x0].passable = false;
        map[y][x1].structure = wall; map[y][x1].passable = false;
    }
    return { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
}

/** Minimal colonist stub carrying only the fields findBestTask reads. */
export function makeColonist({ x = 0, y = 0, priorities = {}, failedTasks = null } = {}) {
    return { x, y, priorities, _failedTasks: failedTasks };
}

/**
 * Install the browser globals save.js touches (localStorage + a stub DOM) so
 * saveGame/loadGame can run under Node. localStorage is a plain in-memory Map
 * shim; the DOM getters return nulls/defaults so captureLayout/restoreLayout
 * are no-ops. Call once at the top of a test file that imports save.js.
 */
export function installBrowserShims() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
    globalThis.document = { getElementById: () => null };
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
    globalThis.window = { setUIFontSize: () => {} };
    return store;
}

/**
 * Build a minimally-complete game object with every field saveGame reads and
 * loadGame writes back. Only the state model matters here (no engine/DOM), so
 * this is a plain-data stand-in wired with a real TaskQueue and a small map.
 */
export function makeGame(mapSize = 4) {
    const map = [];
    for (let y = 0; y < mapSize; y++) {
        const row = [];
        for (let x = 0; x < mapSize; x++) {
            row.push({
                terrain: 'grass', passable: true, structure: null, floor: null,
                structureHp: undefined, resource: null, designation: null, zone: null,
                onFire: false, fireTimer: 0, snowCovered: false, pedestalArtifact: null,
                roomId: null, items: [],
            });
        }
        map.push(row);
    }
    // Real MapIndex, rebuilt from the fixture map so structure-scanning tick
    // functions (auto-repair, pedestals) see the same {x,y,type} snapshot the
    // engine produces. Call game.mapIndex.rebuild(game.map) after mutating
    // structures in a test.
    const mapIndex = new MapIndex();
    mapIndex.rebuild(map);
    return {
        tick: 0, timeOfDay: 0.5, speed: 1,
        settings: {},
        map, mapIndex,
        colonists: [], entities: [], raiders: [],
        resources: {
            stockpile: {}, weapons: [], armors: [], helmets: [], tools: [],
            artifacts: [], potions: [], tomes: [], consumables: [],
            _decayAccumulators: {}, reservedFoodstuffs: {},
        },
        weather: {
            season: 'spring', seasonIndex: 0, seasonTick: 0, temperature: 15,
            currentWeather: 'clear', weatherTimer: 0, year: 1,
        },
        combat: { nextRaidTick: 0, raidActive: false, raidStartTick: 0 },
        divinationModifiers: [],
        waves: {
            highestWaveCompleted: 0, active: false, currentWave: 0, nexusPosition: null,
            nexusHp: 0, nexusMaxHp: 0, enemies: [], enemiesSpawned: 0, enemiesToSpawn: 0,
            spawnTimer: 0, portals: [],
        },
        events: { cooldowns: {} },
        exploration: { expeditions: [], completedExpeditions: [], completedRealms: new Set() },
        research: { completed: new Set(), activeResearch: null, progress: {} },
        manaCrystalBonus: 0,
        discoveredLoot: new Set(),
        story: { unlocked: new Map(), viewed: new Set() },
        taskQueue: new TaskQueue(),
        eventLog: { entries: [] },
        rebuildColonistIndex() {},
        roomsDirty: false,
    };
}

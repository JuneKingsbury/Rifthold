import { CONFIG, ENTITIES } from './config.js';
import { syncEntityIdCounter } from '../entities/entity-factory.js';
import { ensureEntityRoles } from '../entities/roles.js';
import { recalcMaxMana, invalidateEquipStatCache, TRANSIENT_COLONIST_FIELDS, TRANSIENT_COLONIST_DEFAULTS } from '../entities/colonist.js';
import * as gdriveWeb from './gdrive-web.js';

const SAVE_KEY = 'colony_save';
const GDRIVE_LAST_SYNC_KEY = 'gdrive_last_sync_ts';
// v11 is the first version of the compressed, migration-laddered format. Saves at
// versions below 11 predate the ladder and are discarded one final time on load
// (see _applyLoadData). From v11 onward, schema changes add a MIGRATIONS step and
// bump SAVE_VERSION instead of invalidating saves.
const SAVE_VERSION = 11;
const SLOT_META_KEY = 'colony_slot_meta';
const SLOT_AUTO_NEXT_KEY = 'colony_slot_auto_next';

// Stored-string format markers. The first bytes of a stored slot tell the loader
// how to decode it, so compressed, uncompressed, and legacy raw-JSON saves can
// coexist without ambiguity.
const COMPRESS_MAGIC = 'RHc1:';   // COMPRESS_MAGIC + base64(deflate-raw(json))
const PLAIN_MAGIC = 'RHj1:';      // PLAIN_MAGIC + json (fallback when compression unavailable)

// Entities and raiders share these movement-only transient fields (see
// entity-factory.js). They are re-derived at runtime, so they are stripped on save
// and re-seeded to these defaults on load (simulation code assumes they exist).
const TRANSIENT_ENTITY_DEFAULTS = { path: null, pathAge: 0, moveCooldown: 0 };
const TRANSIENT_ENTITY_FIELDS = Object.keys(TRANSIENT_ENTITY_DEFAULTS);

let _compressSupport = null;
function _canCompress() {
    if (_compressSupport !== null) return _compressSupport;
    try {
        _compressSupport = typeof CompressionStream !== 'undefined'
            && typeof DecompressionStream !== 'undefined'
            && !!new CompressionStream('deflate-raw');
    } catch {
        _compressSupport = false;
    }
    return _compressSupport;
}

// Chunked base64 so btoa / String.fromCharCode never overflow the call stack on
// large save buffers (a developed colony compresses to tens of KB of bytes).
function _bytesToBase64(bytes) {
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function _base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// Encode a JSON string into the stored form: compressed when the platform supports
// CompressionStream, otherwise a plain-text fallback that still carries a format
// marker so the loader stays format-aware.
async function _encodeSave(json) {
    if (!_canCompress()) return PLAIN_MAGIC + json;
    try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buf = new Uint8Array(await new Response(stream).arrayBuffer());
        return COMPRESS_MAGIC + _bytesToBase64(buf);
    } catch (e) {
        console.warn('Save compression failed, storing uncompressed:', e);
        return PLAIN_MAGIC + json;
    }
}

// Inverse of _encodeSave. Accepts compressed, plain-marked, or legacy raw-JSON
// (starts with '{') strings and returns the decoded JSON text.
async function _decodeSave(stored) {
    if (stored.startsWith(COMPRESS_MAGIC)) {
        const bytes = _base64ToBytes(stored.slice(COMPRESS_MAGIC.length));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(stream).text();
    }
    if (stored.startsWith(PLAIN_MAGIC)) return stored.slice(PLAIN_MAGIC.length);
    return stored;   // legacy raw JSON (pre-v11)
}

// Shallow-copy an object minus the given transient fields and any _-prefixed keys
// (render/state caches). Non-destructive: the live game object is untouched.
function _stripTransient(obj, transientFields) {
    const out = {};
    for (const key of Object.keys(obj)) {
        if (key.startsWith('_')) continue;
        if (transientFields.includes(key)) continue;
        out[key] = obj[key];
    }
    return out;
}

// Re-seed transient fields that _stripTransient dropped on save. Simulation code
// assumes these always exist (e.g. updateMoving reads colonist.path.length), so a
// loaded object must have them restored to their factory defaults. Array/object
// defaults are cloned so instances never share a reference.
function _restoreTransient(obj, defaults) {
    for (const [key, def] of Object.entries(defaults)) {
        if (obj[key] !== undefined) continue;
        obj[key] = Array.isArray(def) ? [] : (def && typeof def === 'object' ? { ...def } : def);
    }
}

function _steamCloud() {
    return window.electronAPI?.steam;
}

// Returns the GDrive API surface regardless of context:
//   - Electron: the IPC bridge exposed via preload.js
//   - Browser: the PKCE web implementation in gdrive-web.js
// Capacitor (native Android) has neither, and gdriveWeb.enabled() returns false
// there too, so sync silently no-ops on mobile.
function _gdriveCloud() {
    return window.electronAPI?.gdrive || gdriveWeb;
}

export async function syncSlotToCloud(slotKey) {
    const steam = _steamCloud();
    if (steam && (await steam.available())) {
        const json = localStorage.getItem(slotKey);
        if (json) steam.cloudWrite(`${slotKey}.json`, json);
        const metaJson = localStorage.getItem(SLOT_META_KEY);
        if (metaJson) steam.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
    }
    const gdrive = _gdriveCloud();
    if (gdrive && (await gdrive.enabled())) {
        const json = localStorage.getItem(slotKey);
        if (json) await gdrive.cloudWrite(`${slotKey}.json`, json);
        const metaJson = localStorage.getItem(SLOT_META_KEY);
        if (metaJson) await gdrive.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
        localStorage.setItem(GDRIVE_LAST_SYNC_KEY, String(Date.now()));
    }
}

export async function syncAllFromCloud() {
    const steam = _steamCloud();
    if (steam && (await steam.available()) && (await steam.cloudEnabled())) {
        const cloudMetaRaw = await steam.cloudRead(`${SLOT_META_KEY}.json`);
        if (cloudMetaRaw) {
            let cloudMeta;
            try { cloudMeta = JSON.parse(cloudMetaRaw); } catch { cloudMeta = null; }
            if (cloudMeta) {
                const localMeta = getAllSlotsMeta();
                for (const [slotKey, cloudEntry] of Object.entries(cloudMeta)) {
                    const localEntry = localMeta[slotKey];
                    if (localEntry && localEntry.timestamp >= cloudEntry.timestamp) continue;
                    const slotData = await steam.cloudRead(`${slotKey}.json`);
                    if (slotData) {
                        localStorage.setItem(slotKey, slotData);
                        localMeta[slotKey] = cloudEntry;
                    }
                }
                localStorage.setItem(SLOT_META_KEY, JSON.stringify(localMeta));
            }
        }
    }
    const gdrive = _gdriveCloud();
    if (gdrive && (await gdrive.enabled())) {
        const cloudMetaRaw = await gdrive.cloudRead(`${SLOT_META_KEY}.json`);
        if (cloudMetaRaw) {
            let cloudMeta;
            try { cloudMeta = JSON.parse(cloudMetaRaw); } catch { cloudMeta = null; }
            if (cloudMeta) {
                const localMeta = getAllSlotsMeta();
                for (const [slotKey, cloudEntry] of Object.entries(cloudMeta)) {
                    const localEntry = localMeta[slotKey];
                    if (localEntry && localEntry.timestamp >= cloudEntry.timestamp) continue;
                    const slotData = await gdrive.cloudRead(`${slotKey}.json`);
                    if (slotData) {
                        localStorage.setItem(slotKey, slotData);
                        localMeta[slotKey] = cloudEntry;
                    }
                }
                localStorage.setItem(SLOT_META_KEY, JSON.stringify(localMeta));
                localStorage.setItem(GDRIVE_LAST_SYNC_KEY, String(Date.now()));
            }
        }
    }
}

export function getLastSyncTime() {
    const raw = localStorage.getItem(GDRIVE_LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
}

export async function forceSyncNow() {
    const gdrive = _gdriveCloud();
    const gdriveEnabled = gdrive && (await gdrive.enabled().catch(() => false));
    const steam = _steamCloud();
    const steamEnabled = steam && (await steam.available().catch(() => false));
    if (!gdriveEnabled && !steamEnabled) return 'no-cloud';
    await syncAllFromCloud();
    const meta = getAllSlotsMeta();
    for (const slotKey of Object.keys(meta)) {
        await syncSlotToCloud(slotKey);
    }
    if (gdriveEnabled) {
        localStorage.setItem(GDRIVE_LAST_SYNC_KEY, String(Date.now()));
    }
    return 'ok';
}

async function _cloudDeleteSlot(slotKey) {
    const steam = _steamCloud();
    if (steam && (await steam.available())) {
        steam.cloudDelete(`${slotKey}.json`);
        const metaJson = localStorage.getItem(SLOT_META_KEY);
        if (metaJson) steam.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
    }
    const gdrive = _gdriveCloud();
    if (gdrive && (await gdrive.enabled())) {
        gdrive.cloudDelete(`${slotKey}.json`);
        const metaJson = localStorage.getItem(SLOT_META_KEY);
        if (metaJson) gdrive.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
    }
}

function _buildSaveData(game) {
    const layout = captureLayout();
    return {
        version: SAVE_VERSION,
        tick: game.tick,
        timeOfDay: game.timeOfDay,
        speed: game.speed,
        settings: game.settings,
        peaceful: CONFIG.PEACEFUL_MODE,
        layout,

        map: serializeMap(game.map),
        colonists: game.colonists.map(c => _stripTransient(c, TRANSIENT_COLONIST_FIELDS)),
        entities: game.entities.map(e => _stripTransient(e, TRANSIENT_ENTITY_FIELDS)),
        raiders: game.raiders.map(r => _stripTransient(r, TRANSIENT_ENTITY_FIELDS)),

        resources: {
            stockpile: game.resources.stockpile,
            weapons: game.resources.weapons,
            armors: game.resources.armors,
            helmets: game.resources.helmets,
            clothes: game.resources.clothes,
            tools: game.resources.tools,
            trinkets: game.resources.trinkets,
            boots: game.resources.boots,
            potions: game.resources.potions,
            tomes: game.resources.tomes,
            consumables: game.resources.consumables,
            // Serialized without a leading underscore: the JSON replacer below strips every
            // _-prefixed key (transient render/state caches), which silently dropped the decay
            // progress so slow-spoiling items reset their fractional timer on every load.
            decayAccumulators: game.resources._decayAccumulators,
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
            activeRaidType: game.combat.activeRaidType,
            crusaderRaidTriggered: game.combat.crusaderRaidTriggered,
            crusaderRaidDefeated: game.combat.crusaderRaidDefeated,
            crusaderRaidWarned: game.combat.crusaderRaidWarned,
        },

        divinationModifiers: game.divinationModifiers || [],

        ritualCooldowns: game.ritualCooldowns || {},
        lastFeastYear: game.lastFeastYear || 0,

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
            bestiary: Object.fromEntries(game.exploration.bestiary || new Map()),
            wildlifeKills: Object.fromEntries(game.exploration.wildlifeKills || new Map()),
            raiderKills: Object.fromEntries(game.exploration.raiderKills || new Map()),
            summonsSeen: Object.fromEntries(game.exploration.summonsSeen || new Map()),
            expeditionXP: game.exploration.expeditionXP || {},
            fatigueCooldowns: game.exploration.fatigueCooldowns || {},
            realmHistory: game.exploration.realmHistory || [],
            partyPresets: game.exploration.partyPresets || [],
            activeRealmEvents: game.exploration.activeRealmEvents || [],
            pendingAutoSummaries: game.exploration.pendingAutoSummaries || [],
            realmScries: game.exploration.realmScries || {},
        },

        research: {
            completed: [...game.research.completed],
            activeResearch: game.research.activeResearch,
            progress: game.research.progress,
        },

        tradeRift: {
            requests: game.tradeRift.requests,
            nextId: game.tradeRift.nextId,
            seeded: game.tradeRift.seeded,
            lastRefreshYear: game.tradeRift.lastRefreshYear,
        },

        stats: game.stats,
        manaCrystalBonus: game.manaCrystalBonus || 0,
        hearthShrineBonus: game.hearthShrineBonus || 0,
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
}

export function extractMeta(data) {
    // CONFIG.TICKS_PER_DAY = 480
    const dayOfSeason = Math.floor((data.weather?.seasonTick || 0) / 480) + 1;
    return {
        colonistCount: (data.colonists || []).length,
        season: data.weather?.season || 'spring',
        year: data.weather?.year || 1,
        dayOfSeason,
        timestamp: Date.now(),
    };
}

export function captureThumbnail(game) {
    try {
        const src = document.getElementById('game-canvas');
        if (!src || !src.width || !src.height) return null;
        const W = 240, H = 160;
        const offscreen = document.createElement('canvas');
        offscreen.width = W;
        offscreen.height = H;
        const cropW = src.width * 0.75;
        const cropH = src.height * 0.75;
        const cropX = (src.width - cropW) / 2;
        const cropY = (src.height - cropH) / 2;
        offscreen.getContext('2d').drawImage(src, cropX, cropY, cropW, cropH, 0, 0, W, H);
        // JPEG at 0.7 quality: thumbnails are screenshot-like, so this cuts the
        // meta-index payload substantially versus PNG with no meaningful loss at 240x160.
        return offscreen.toDataURL('image/jpeg', 0.7);
    } catch {
        return null;
    }
}

export function getAllSlotsMeta() {
    try {
        return JSON.parse(localStorage.getItem(SLOT_META_KEY) || '{}');
    } catch {
        return {};
    }
}

function _writeMeta(slotKey, metaEntry) {
    const all = getAllSlotsMeta();
    all[slotKey] = metaEntry;
    localStorage.setItem(SLOT_META_KEY, JSON.stringify(all));
}

export async function saveToSlot(game, slotKey, opts = {}) {
    const data = _buildSaveData(game);
    const json = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value);
    const stored = await _encodeSave(json);
    localStorage.setItem(slotKey, stored);
    const meta = extractMeta(data);
    meta.timestamp = Date.now();
    if (opts.label) meta.label = opts.label;
    meta.thumbnail = captureThumbnail(game);
    _writeMeta(slotKey, meta);
    syncSlotToCloud(slotKey);
    return true;
}

export async function loadFromSlot(game, slotKey) {
    try {
        const stored = localStorage.getItem(slotKey);
        if (!stored) return false;
        const data = JSON.parse(await _decodeSave(stored));
        return _applyLoadData(game, data);
    } catch (e) {
        console.error('Failed to load slot:', slotKey, e);
        return false;
    }
}

export async function saveAutoSlot(game) {
    const next = parseInt(localStorage.getItem(SLOT_AUTO_NEXT_KEY) || '0') % 3;
    const slotKey = `colony_slot_auto_${next}`;
    const result = await saveToSlot(game, slotKey, { label: `Auto-save ${next + 1}` });
    localStorage.setItem(SLOT_AUTO_NEXT_KEY, String((next + 1) % 3));
    return result;
}

export function deleteSlot(slotKey) {
    localStorage.removeItem(slotKey);
    const all = getAllSlotsMeta();
    delete all[slotKey];
    localStorage.setItem(SLOT_META_KEY, JSON.stringify(all));
    _cloudDeleteSlot(slotKey);
}

export function migrateColonySave() {
    const existing = localStorage.getItem(SAVE_KEY);
    if (!existing) return;
    if (localStorage.getItem(SLOT_META_KEY)) return;
    // Migrate old single save to manual slot 0
    localStorage.setItem('colony_slot_manual_0', existing);
    try {
        const data = JSON.parse(existing);
        const meta = extractMeta(data);
        meta.label = 'Migrated Save';
        const all = {};
        all['colony_slot_manual_0'] = meta;
        localStorage.setItem(SLOT_META_KEY, JSON.stringify(all));
    } catch {
        localStorage.setItem(SLOT_META_KEY, '{}');
    }
    localStorage.removeItem(SAVE_KEY);
}

export async function saveGame(game) {
    const data = _buildSaveData(game);
    const json = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value);
    const stored = await _encodeSave(json);
    localStorage.setItem(SAVE_KEY, stored);
    return true;
}

// Sequential save migrations. Each key N is a function that upgrades a v(N-1)
// save object in place to vN. To evolve the schema: write the transform that
// makes an old save match the new shape, add it here keyed by the NEW version,
// and bump SAVE_VERSION. _migrate walks these in order so a very old save is
// carried forward one step at a time.
//
// Example (when adding v12):
//   12: (d) => { d.someNewField = d.someNewField || []; },
const MIGRATIONS = {};

// Walk `data` up the migration ladder to SAVE_VERSION, applying each step in
// order. A missing step is a no-op (versions with no schema change). Returns the
// migrated object.
function _migrate(data) {
    let v = data.version || 0;
    while (v < SAVE_VERSION) {
        const step = MIGRATIONS[v + 1];
        if (step) step(data);
        v++;
    }
    data.version = Math.max(data.version || 0, v);
    return data;
}

function _applyLoadData(game, data) {
    try {

        // Saves below v11 predate the migration ladder and the compressed format.
        // They are discarded one final time (with an export-backup offer) and the
        // caller falls back to starting a fresh game. This is the LAST version at
        // which any save is ever discarded; from v11 up, MIGRATIONS carries them
        // forward.
        if (!(data.version >= 11)) {
            console.warn(`Incompatible save version ${data.version}. Starting fresh.`);
            const wantExport = window.confirm(
                `Your save was made with an older game version (v${data.version}) and cannot be loaded.\n\nWould you like to export a backup of your save file before starting a new game?`
            );
            if (wantExport) {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `rifthold_backup_v${data.version}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
            return false;
        }

        // Saves from a newer client (e.g. Steam cloud synced from an updated
        // machine) are NOT hard-rejected. We warn and load best-effort: the
        // explicit `|| default` fallbacks below and the transient-field handling
        // mean unknown newer fields are simply ignored rather than crashing.
        if (data.version > SAVE_VERSION) {
            console.warn(`Save version ${data.version} is newer than supported ${SAVE_VERSION}; loading best-effort.`);
        } else {
            _migrate(data);
        }

        CONFIG.PEACEFUL_MODE = data.peaceful;
        game.tick = data.tick;
        game.timeOfDay = data.timeOfDay;
        game.speed = data.speed;
        game.settings = { ...game.settings, ...data.settings };

        deserializeMap(game.map, data.map);
        // deserializeMap rebuilds tiles but never touches mapIndex. Rebuild it
        // explicitly so the index reflects the loaded map. Previously the index
        // was only repopulated as a side effect of the periodic roomsDirty
        // rebuild, which has been removed from the recompute hot path.
        if (game.mapIndex) game.mapIndex.rebuild(game.map);

        game.colonists = data.colonists;
        for (const c of game.colonists) {
            _restoreTransient(c, TRANSIENT_COLONIST_DEFAULTS);
            recalcMaxMana(c);
            invalidateEquipStatCache(c);
        }
        game.rebuildColonistIndex();
        game.entities = data.entities || [];
        game.raiders = data.raiders || [];
        for (const e of game.entities) _restoreTransient(e, TRANSIENT_ENTITY_DEFAULTS);
        for (const r of game.raiders) _restoreTransient(r, TRANSIENT_ENTITY_DEFAULTS);

        game.resources.stockpile = data.resources.stockpile;
        game.resources.weapons = data.resources.weapons;
        game.resources.armors = data.resources.armors || [];
        game.resources.helmets = data.resources.helmets || [];
        game.resources.clothes = data.resources.clothes || [];
        game.resources.tools = data.resources.tools || [];
        game.resources.trinkets = data.resources.trinkets || [];
        game.resources.boots = data.resources.boots || [];
        game.resources.potions = data.resources.potions || [];
        game.resources.tomes = data.resources.tomes || [];
        game.resources.consumables = data.resources.consumables || [];
        game.resources._decayAccumulators = data.resources.decayAccumulators || {};
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
        game.combat.activeRaidType = data.combat.activeRaidType || null;
        game.combat.crusaderRaidTriggered = data.combat.crusaderRaidTriggered || false;
        game.combat.crusaderRaidDefeated = data.combat.crusaderRaidDefeated || false;
        game.combat.crusaderRaidWarned = data.combat.crusaderRaidWarned || false;
        game.divinationModifiers = data.divinationModifiers || [];
        game.ritualCooldowns = data.ritualCooldowns || {};
        game.lastFeastYear = data.lastFeastYear || 0;

        game.events.cooldowns = data.events.cooldowns || {};

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
            game.exploration.bestiary = new Map(Object.entries(data.exploration.bestiary || {}));
            game.exploration.wildlifeKills = new Map(Object.entries(data.exploration.wildlifeKills || {}));
            game.exploration.raiderKills = new Map(Object.entries(data.exploration.raiderKills || {}));
            game.exploration.summonsSeen = new Map(Object.entries(data.exploration.summonsSeen || {}));
            game.exploration.expeditionXP = data.exploration.expeditionXP || {};
            game.exploration.fatigueCooldowns = data.exploration.fatigueCooldowns || {};
            game.exploration.realmHistory = data.exploration.realmHistory || [];
            game.exploration.partyPresets = data.exploration.partyPresets || [];
            game.exploration.activeRealmEvents = data.exploration.activeRealmEvents || [];
            game.exploration.pendingAutoSummaries = data.exploration.pendingAutoSummaries || [];
            game.exploration.realmScries = data.exploration.realmScries || {};
            game.exploration.syncIdCounter();
        }

        if (data.tradeRift) {
            game.tradeRift.requests = data.tradeRift.requests || [];
            game.tradeRift.nextId = data.tradeRift.nextId || 1;
            game.tradeRift.seeded = data.tradeRift.seeded || false;
            game.tradeRift.lastRefreshYear = data.tradeRift.lastRefreshYear || 0;
        }

        if (data.stats) {
            Object.assign(game.stats, data.stats);
        }
        game.manaCrystalBonus = data.manaCrystalBonus || 0;
        game.hearthShrineBonus = data.hearthShrineBonus || 0;
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

        // Compute rooms promptly on the first post-load tick (bypass the build
        // coalescing delay) so a loaded game shows correct room state immediately.
        game.roomsDirtyTick = game.tick;
        game.roomsDirtyDeadline = game.tick;
        game._complexStructuresInitialized = false;

        if (data.layout) {
            restoreLayout(data.layout);
        }

        return true;
    } catch (e) {
        console.error('Failed to load save:', e);
        return false;
    }
}

export async function loadGame(game) {
    try {
        const stored = localStorage.getItem(SAVE_KEY);
        if (!stored) return false;
        const data = JSON.parse(await _decodeSave(stored));
        return _applyLoadData(game, data);
    } catch (e) {
        console.error('Failed to load save:', e);
        return false;
    }
}

export function hasSave() {
    const meta = getAllSlotsMeta();
    return Object.keys(meta).length > 0;
}

async function _mobileExport(json, filename) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const result = await Filesystem.writeFile({
        path: filename,
        data: btoa(unescape(encodeURIComponent(json))),
        directory: Directory.Cache,
    });
    await Share.share({ title: 'Rifthold Save', url: result.uri });
}

function _downloadJson(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Exports decode the stored (possibly compressed) form back to readable JSON so
// the downloaded .json file is human-readable and portable, matching the backup
// blob written on the clean-break discard path.
export async function exportSave() {
    const stored = localStorage.getItem(SAVE_KEY);
    if (!stored) return false;
    const json = await _decodeSave(stored);
    const filename = `colony_save_${Date.now()}.json`;
    if (window.Capacitor?.isNativePlatform()) {
        _mobileExport(json, filename).catch(e => console.error('Mobile export failed:', e));
    } else {
        _downloadJson(json, filename);
    }
    return true;
}

export async function exportSlot(slotKey) {
    const stored = localStorage.getItem(slotKey);
    if (!stored) return false;
    const json = await _decodeSave(stored);
    const filename = `${slotKey}_${Date.now()}.json`;
    if (window.Capacitor?.isNativePlatform()) {
        _mobileExport(json, filename).catch(e => console.error('Mobile export failed:', e));
    } else {
        _downloadJson(json, filename);
    }
    return true;
}

// Accepts an exported file in any form: readable JSON, or a compressed/plain
// marked string. The parsed save is re-encoded into storage so the imported slot
// matches the current on-disk format.
export function importSave(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = await _decodeSave(e.target.result);
                const data = JSON.parse(json);
                if (!(data.version >= 11) || data.version > SAVE_VERSION || !data.map || !data.colonists) {
                    resolve(false);
                    return;
                }
                const slotKey = 'colony_slot_manual_0';
                localStorage.setItem(slotKey, await _encodeSave(json));
                const meta = extractMeta(data);
                meta.label = 'Imported Save';
                _writeMeta(slotKey, meta);
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
    const uiFontScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1;

    return {
        gridColumns: container?.style.gridTemplateColumns || null,
        footerHeight: footer?.style.height || null,
        colonistHudFlex: colonistHud?.style.flex || null,
        eventLogFlex: eventLog?.style.flex || null,
        uiFontScale,
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
    if (layout.uiFontScale) window.setUIFontScale?.(layout.uiFontScale);
    else if (layout.uiFontSize) window.setUIFontScale?.(layout.uiFontSize / 12);
}

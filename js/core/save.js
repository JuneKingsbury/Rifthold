import { CONFIG, ENTITIES, ALL_ITEMS } from './config.js';
import { syncEntityIdCounter } from '../entities/entity-factory.js';
import { ensureEntityRoles } from '../entities/roles.js';
import { recalcMaxMana, invalidateEquipStatCache, defaultAttunedSchools } from '../entities/colonist.js';

const SAVE_KEY = 'colony_save';
const SAVE_VERSION = 10;
const SLOT_META_KEY = 'colony_slot_meta';
const SLOT_AUTO_NEXT_KEY = 'colony_slot_auto_next';

function _steamCloud() {
    return window.electronAPI?.steam;
}

export async function syncSlotToCloud(slotKey) {
    const steam = _steamCloud();
    if (!steam || !(await steam.available())) return;
    const json = localStorage.getItem(slotKey);
    if (json) steam.cloudWrite(`${slotKey}.json`, json);
    const metaJson = localStorage.getItem(SLOT_META_KEY);
    if (metaJson) steam.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
}

export async function syncAllFromCloud() {
    const steam = _steamCloud();
    if (!steam || !(await steam.available()) || !(await steam.cloudEnabled())) return;
    const cloudMetaRaw = await steam.cloudRead(`${SLOT_META_KEY}.json`);
    if (!cloudMetaRaw) return;
    let cloudMeta;
    try { cloudMeta = JSON.parse(cloudMetaRaw); } catch { return; }
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

async function _cloudDeleteSlot(slotKey) {
    const steam = _steamCloud();
    if (!steam || !(await steam.available())) return;
    steam.cloudDelete(`${slotKey}.json`);
    const metaJson = localStorage.getItem(SLOT_META_KEY);
    if (metaJson) steam.cloudWrite(`${SLOT_META_KEY}.json`, metaJson);
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
        colonists: game.colonists,
        entities: game.entities,
        raiders: game.raiders,

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
        return offscreen.toDataURL('image/png');
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

export function saveToSlot(game, slotKey, opts = {}) {
    const data = _buildSaveData(game);
    const json = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value);
    localStorage.setItem(slotKey, json);
    const meta = extractMeta(data);
    meta.timestamp = Date.now();
    if (opts.label) meta.label = opts.label;
    meta.thumbnail = captureThumbnail(game);
    _writeMeta(slotKey, meta);
    syncSlotToCloud(slotKey);
    return true;
}

export function loadFromSlot(game, slotKey) {
    try {
        const json = localStorage.getItem(slotKey);
        if (!json) return false;
        const data = JSON.parse(json);
        return _applyLoadData(game, data);
    } catch (e) {
        console.error('Failed to load slot:', slotKey, e);
        return false;
    }
}

export function saveAutoSlot(game) {
    const next = parseInt(localStorage.getItem(SLOT_AUTO_NEXT_KEY) || '0') % 3;
    const slotKey = `colony_slot_auto_${next}`;
    const result = saveToSlot(game, slotKey, { label: `Auto-save ${next + 1}` });
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

export function saveGame(game) {
    const data = _buildSaveData(game);
    const json = JSON.stringify(data, (key, value) => key.startsWith('_') ? undefined : value);
    localStorage.setItem(SAVE_KEY, json);
    return true;
}

function _applyLoadData(game, data) {
    try {

        // Saves are not migrated across versions. A mismatch is discarded and the
        // caller falls back to starting a fresh game.
        if (data.version !== SAVE_VERSION) {
            console.warn(`Incompatible save version ${data.version}, expected ${SAVE_VERSION}. Starting fresh.`);
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

        CONFIG.PEACEFUL_MODE = data.peaceful;
        game.tick = data.tick;
        game.timeOfDay = data.timeOfDay;
        game.speed = data.speed;
        game.settings = { ...game.settings, ...data.settings };

        deserializeMap(game.map, data.map);

        game.colonists = data.colonists;
        for (const c of game.colonists) {
            recalcMaxMana(c);
            invalidateEquipStatCache(c);
            // Migration: default attunement for saves predating the attunement system.
            // Pick the colonist's highest-level schools up to the slot count.
            if (!Array.isArray(c.attunedSchools)) {
                c.attunedSchools = defaultAttunedSchools(c);
            }
        }
        game.rebuildColonistIndex();
        game.entities = data.entities || [];
        game.raiders = data.raiders || [];

        // Migration: rename artifacts -> trinkets, route re-categorized items, add boots
        if (data.resources.artifacts && !data.resources.trinkets) {
            data.resources.trinkets = [];
            data.resources.boots = data.resources.boots || [];
            for (const item of data.resources.artifacts) {
                const def = ALL_ITEMS[item.key];
                if (!def) { data.resources.trinkets.push(item); continue; }
                switch (def.type) {
                    case 'boots': data.resources.boots.push(item); break;
                    case 'tool': (data.resources.tools = data.resources.tools || []).push(item); break;
                    case 'armor': (data.resources.armors = data.resources.armors || []).push(item); break;
                    case 'helmet': (data.resources.helmets = data.resources.helmets || []).push(item); break;
                    case 'clothes': (data.resources.clothes = data.resources.clothes || []).push(item); break;
                    default: data.resources.trinkets.push(item); break;
                }
            }
            delete data.resources.artifacts;
        }
        data.resources.boots = data.resources.boots || [];

        // Migration: colonist artifact -> trinket (route re-categorized equipped items), add boots
        for (const c of (data.colonists || [])) {
            if (c.artifact !== undefined && c.trinket === undefined) {
                const equipped = c.artifact;
                if (equipped) {
                    const def = ALL_ITEMS[equipped.key];
                    const newType = def?.type || 'trinket';
                    if (newType === 'trinket') {
                        c.trinket = equipped;
                    } else {
                        c.trinket = null;
                        const listMap = { boots: 'boots', tool: 'tools', armor: 'armors', helmet: 'helmets', clothes: 'clothes' };
                        const listName = listMap[newType] || 'trinkets';
                        data.resources[listName] = data.resources[listName] || [];
                        data.resources[listName].push(equipped);
                    }
                } else {
                    c.trinket = null;
                }
                delete c.artifact;
                c.trinketBroken = c.artifactBroken || false;
                delete c.artifactBroken;
            }
            c.boots = c.boots || null;
            c.hiddenEquipmentSlots = c.hiddenEquipmentSlots || {};
            if (!c.equipmentSets) {
                c.equipmentSets = {
                    Colony:     { weapon: null, armor: null, helmet: null, clothes: null, tool: null, trinket: null, boots: null },
                    Expedition: { weapon: null, armor: null, helmet: null, clothes: null, tool: null, trinket: null, boots: null },
                };
            }
            c.activeSet = c.activeSet || 'Colony';
        }

        // Migration: flatten item.combat stats to top-level
        const _flattenCombat = (item) => {
            if (!item || !item.combat) return;
            for (const [k, v] of Object.entries(item.combat)) {
                if (v && item[k] === undefined) item[k] = v;
            }
            delete item.combat;
        };
        const _itemLists = ['weapons', 'armors', 'helmets', 'clothes', 'tools', 'trinkets', 'boots'];
        for (const list of _itemLists) {
            for (const item of (data.resources[list] || [])) _flattenCombat(item);
        }
        const _equipSlots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
        for (const c of (data.colonists || [])) {
            for (const slot of _equipSlots) _flattenCombat(c[slot]);
            for (const setName of Object.keys(c.equipmentSets || {})) {
                for (const slot of _equipSlots) _flattenCombat(c.equipmentSets[setName][slot]);
            }
        }
        for (const exp of (data.exploration?.expeditions || [])) {
            for (const member of (exp.partySnapshot || [])) {
                for (const slot of _equipSlots) _flattenCombat(member[slot]);
            }
        }

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

        for (const row of game.map) {
            for (const tile of row) {
                if (tile.structure === 'forge_core' || tile.structure === 'ritual_core') {
                    tile.structure = 'arcane_core';
                }
            }
        }

        game.roomsDirty = true;
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

export function loadGame(game) {
    try {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return false;
        const data = JSON.parse(json);
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

export function exportSave() {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return false;
    const filename = `colony_save_${Date.now()}.json`;
    if (window.Capacitor?.isNativePlatform()) {
        _mobileExport(json, filename).catch(e => console.error('Mobile export failed:', e));
    } else {
        _downloadJson(json, filename);
    }
    return true;
}

export function exportSlot(slotKey) {
    const json = localStorage.getItem(slotKey);
    if (!json) return false;
    const filename = `${slotKey}_${Date.now()}.json`;
    if (window.Capacitor?.isNativePlatform()) {
        _mobileExport(json, filename).catch(e => console.error('Mobile export failed:', e));
    } else {
        _downloadJson(json, filename);
    }
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
                const slotKey = 'colony_slot_manual_0';
                localStorage.setItem(slotKey, e.target.result);
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

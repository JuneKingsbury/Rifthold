import {
    WEAPONS, ARMORS, HELMETS, CLOTHES, BOOTS, TOOLS, TRINKETS, POTIONS, CONSUMABLES,
    ALL_ITEMS, RECIPES,
    REALMS, RESEARCH, RESEARCH_TABS, TRAITS, RACES,
    ENTITIES, ANIMALS, TAMED_ANIMALS, RAID_TYPES,
    EXPEDITION_ENEMIES,
    NPC_ENCOUNTERS, EXPEDITION_DECISIONS, EXPEDITION_TRAPS, PUZZLE_ENCOUNTERS,
    ELITE_MODIFIERS, REALM_EVENTS, EXPEDITION_MUTATORS, THOUGHTS, STORY_MILESTONES,
    EVENTS,
    SPELLS, SPELL_TOMES, RITUALS,
    CROPS, FOODSTUFFS, NON_FOOD_CROPS,
    BUILDINGS, IMPASSABLE_STRUCTURES, ENEMY_BLOCKED_STRUCTURES, BREAKABLE_STRUCTURES,
    WALL_STRUCTURES, FURNITURE_STRUCTURES, DOOR_STRUCTURES, TILE_CHARS, TILE_COLORS,
} from './config.js';
import { SOUND_MANIFEST } from './sound-manifest.js';
import {
    isModEnabled, recordDiscoveredManifests, recordLoadedManifests, recordWarning,
    registerModPortrait, getModsBaseUrl, getModLoadOrder,
    getLocalDirHandle, loadLocalDirHandle,
} from './mod-registry.js';

// Resolve a slash-separated relative path inside a FileSystemDirectoryHandle.
async function _resolveHandlePath(rootHandle, relPath) {
    const parts = relPath.replace(/^\/+/, '').split('/').filter(Boolean);
    let current = rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        try { current = await current.getDirectoryHandle(parts[i]); }
        catch { return null; }
    }
    try { return await current.getFileHandle(parts[parts.length - 1]); }
    catch { return null; }
}

async function _readJsonFromHandle(rootHandle, relPath) {
    try {
        const fileHandle = await _resolveHandlePath(rootHandle, relPath);
        if (!fileHandle) return null;
        const file = await fileHandle.getFile();
        return JSON.parse(await file.text());
    } catch { return null; }
}

async function _readTextFromHandle(rootHandle, relPath) {
    try {
        const fileHandle = await _resolveHandlePath(rootHandle, relPath);
        if (!fileHandle) return null;
        const file = await fileHandle.getFile();
        return await file.text();
    } catch { return null; }
}

async function _scanHandleForMods(rootHandle) {
    const ids = [];
    for await (const [name, entry] of rootHandle.entries()) {
        if (entry.kind !== 'directory') continue;
        try {
            await entry.getFileHandle('manifest.json');
            ids.push(name);
        } catch { /* no manifest, skip */ }
    }
    return ids.sort();
}

// Resolves a blob URL from a file inside the directory handle so that
// <img src> and audio can consume it.
async function _blobUrlFromHandle(rootHandle, relPath) {
    try {
        const fileHandle = await _resolveHandlePath(rootHandle, relPath);
        if (!fileHandle) return null;
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
    } catch { return null; }
}

// Snapshot of all baseline keys before any mod merges, to prevent overwriting base data.
const _baselineKeys = new Set();

function _snapshotBaseline() {
    const sources = [WEAPONS, ARMORS, HELMETS, CLOTHES, BOOTS, TOOLS, TRINKETS, POTIONS, CONSUMABLES,
        ALL_ITEMS, RECIPES, REALMS, RESEARCH, TRAITS, RACES, ENTITIES, RAID_TYPES, EXPEDITION_ENEMIES,
        // Note: RESEARCH_TABS baseline keys are tracked separately (it's an array, not an object)
        NPC_ENCOUNTERS, EXPEDITION_DECISIONS, EXPEDITION_TRAPS, PUZZLE_ENCOUNTERS,
        ELITE_MODIFIERS, REALM_EVENTS, EXPEDITION_MUTATORS, THOUGHTS, STORY_MILESTONES,
        EVENTS, SPELLS, SPELL_TOMES, RITUALS, CROPS, BUILDINGS];
    for (const obj of sources) {
        for (const key of Object.keys(obj)) _baselineKeys.add(key);
    }
    for (const key of [...FOODSTUFFS, ...NON_FOOD_CROPS]) _baselineKeys.add(key);
}

function _safeSet(target, key, value, modId, context) {
    if (_baselineKeys.has(key)) {
        recordWarning(`Mod "${modId}": key "${key}" in ${context} exists in base game. Skipping.`);
        return false;
    }
    if (key in target) {
        recordWarning(`Mod "${modId}": key "${key}" in ${context} already defined by another mod. Overwriting.`);
    }
    target[key] = value;
    return true;
}

function _translateEffects(def) {
    if (!def.effects || !def.effects.length) return def;
    const out = { ...def };
    delete out.effects;
    for (const eff of def.effects) {
        switch (eff.type) {
            case 'dot_on_hit': {
                const prop = eff.dotType === 'burn' ? 'burnOnHit'
                    : eff.dotType === 'bleed' ? 'bleedOnHit'
                    : 'poisonOnHit';
                out[prop] = { damage: eff.damage, ticks: eff.ticks, interval: eff.interval };
                break;
            }
            case 'burn_on_hit':
                out.burnOnHit = { damage: eff.damage, ticks: eff.ticks, interval: eff.interval };
                break;
            case 'slow_on_hit':
                out.onHit = {
                    effect: 'slow',
                    duration: eff.duration,
                    moveSpeedMalus: eff.moveSpeedMalus,
                    attackSlowMult: eff.attackSlowMult ?? 0.7,
                    rounds: eff.rounds ?? 1,
                };
                break;
            case 'dot_on_attacker':
                out._thornsDoT = { dotType: eff.dotType, damage: eff.damage, ticks: eff.ticks, interval: eff.interval };
                break;
            case 'cleave':
                out.cleave = true;
                break;
            case 'stat_bonus':
                out[eff.stat] = (out[eff.stat] || 0) + eff.value;
                break;
            default:
                recordWarning(`Unknown effect type "${eff.type}" in mod effects, skipped.`);
        }
    }
    return out;
}

const _ITEM_CATEGORY_MAP = {
    weapons:     { target: WEAPONS,     type: 'weapon',     prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Weapons' } },
    armors:      { target: ARMORS,      type: 'armor',      prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Armor' } },
    helmets:     { target: HELMETS,     type: 'helmet',     prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Armor' } },
    clothes:     { target: CLOTHES,     type: 'clothes',    prefix: 'craft_', defaults: { skill: 'crafting', station: 'loom',      category: 'Clothing' } },
    boots:       { target: BOOTS,       type: 'boots',      prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Armor' } },
    tools:       { target: TOOLS,       type: 'tool',       prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Tools' } },
    trinkets:    { target: TRINKETS,    type: 'trinket',    prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Trinkets' } },
    potions:     { target: POTIONS,     type: 'potion',     prefix: 'brew_',  defaults: { skill: 'cooking',  station: 'alchemy_table', category: 'Food & Potions' } },
    consumables: { target: CONSUMABLES, type: 'consumable', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench', category: 'Materials' } },
};

function _mergeItems(modId, data) {
    for (const [catKey, items] of Object.entries(data)) {
        const catInfo = _ITEM_CATEGORY_MAP[catKey];
        if (!catInfo) {
            recordWarning(`Mod "${modId}": unknown item category "${catKey}". Skipping.`);
            continue;
        }
        for (const [key, rawDef] of Object.entries(items)) {
            const def = _translateEffects(rawDef);
            if (!_safeSet(catInfo.target, key, def, modId, `items.${catKey}`)) continue;
            ALL_ITEMS[key] = { ...def, type: catInfo.type };
            if (def.recipe) {
                const r = def.recipe;
                const recipeKey = `${catInfo.prefix}${key}`;
                RECIPES[recipeKey] = {
                    input: r.input,
                    output: { [key]: 1 },
                    skill: r.skill || catInfo.defaults.skill,
                    ticks: r.ticks,
                    station: r.station || catInfo.defaults.station,
                    category: catInfo.defaults.category,
                    ...(r.research ? { research: r.research } : {}),
                };
            }
        }
    }
}

function _mergeRealms(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        _safeSet(REALMS, key, def, modId, 'realms');
    }
}

function _mergeResearch(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        _safeSet(RESEARCH, key, def, modId, 'research');
    }
}

function _mergeResearchTabs(modId, data) {
    const existingKeys = new Set(RESEARCH_TABS.map(t => t.key));
    for (const [key, def] of Object.entries(data)) {
        if (existingKeys.has(key)) {
            recordWarning(`Mod "${modId}": research tab "${key}" already exists. Skipping.`);
            continue;
        }
        RESEARCH_TABS.push({ key, name: def.name || key });
        existingKeys.add(key);
    }
}

function _mergeTraits(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        _safeSet(TRAITS, key, def, modId, 'traits');
    }
}

function _mergeEnemies(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        _safeSet(EXPEDITION_ENEMIES, key, def, modId, 'enemies');
    }
}

function _mergeEntities(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(ENTITIES, key, def, modId, 'entities')) continue;
        if (def.category === 'animal') {
            ANIMALS[key] = def;
            if (def.tameable) {
                const role = (def.roles || []).find(r => r.type === 'guard') || {};
                TAMED_ANIMALS[key] = {
                    name: def.name, char: def.char, color: def.color,
                    hp: def.hp, damage: def.damage, speed: def.speed,
                    duration: def.summonDuration,
                    guardRadius: role.guardRadius,
                    patrolRadius: role.patrolRadius,
                };
            }
        }
    }
}

function _mergeRaidTypes(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        _safeSet(RAID_TYPES, key, def, modId, 'raid_types');
    }
}

function _mergeRaces(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(RACES, key, def, modId, 'races')) continue;
        // Races are injected into colonist.traits as the race key, so the trait
        // tooltip system needs a matching TRAITS entry to show the race description.
        if (!_baselineKeys.has(key) && !(key in TRAITS)) {
            TRAITS[key] = {
                name: def.name,
                description: def.description || '',
                weight: 0,
                value: 0,
            };
        }
    }
}

// --- Tier 1: pure key-to-object mergers ---

function _mergeNpcEncounters(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(NPC_ENCOUNTERS, key, def, modId, 'npc_encounters');
}
function _mergeExpeditionDecisions(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(EXPEDITION_DECISIONS, key, def, modId, 'expedition_decisions');
}
function _mergeExpeditionTraps(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(EXPEDITION_TRAPS, key, def, modId, 'expedition_traps');
}
function _mergePuzzleEncounters(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(PUZZLE_ENCOUNTERS, key, def, modId, 'puzzle_encounters');
}
function _mergeEliteModifiers(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(ELITE_MODIFIERS, key, def, modId, 'elite_modifiers');
}
function _mergeRealmEvents(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(REALM_EVENTS, key, def, modId, 'realm_events');
}
function _mergeExpeditionMutators(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(EXPEDITION_MUTATORS, key, def, modId, 'expedition_mutators');
}
function _mergeThoughts(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(THOUGHTS, key, def, modId, 'thoughts');
}
function _mergeStoryMilestones(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(STORY_MILESTONES, key, def, modId, 'story_milestones');
}

// --- Tier 2: mergers with minor side effects ---

function _mergeEvents(modId, data) {
    const KNOWN_EFFECTS = new Set([
        'mood', 'deposit', 'spawn_animals', 'custom', 'trinket_find',
        'research_boost', 'colony_damage', 'raid', 'trait_add', 'colonist_leave',
    ]);
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(EVENTS, key, def, modId, 'events')) continue;
        if (def.effect && !KNOWN_EFFECTS.has(def.effect)) {
            recordWarning(`Mod "${modId}": event "${key}" uses unknown effect type "${def.effect}". It will be ignored by the events system.`);
        }
    }
}

function _mergeSpells(modId, data) {
    for (const [key, def] of Object.entries(data)) _safeSet(SPELLS, key, def, modId, 'spells');
}

function _mergeSpellTomes(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(SPELL_TOMES, key, def, modId, 'spell_tomes')) continue;
        ALL_ITEMS[key] = { ...def, type: 'tome' };
        if (def.recipe) {
            const r = def.recipe;
            RECIPES[`craft_${key}`] = {
                input: r.input,
                output: { [key]: 1 },
                skill: r.skill || 'crafting',
                ticks: r.ticks,
                station: r.station || 'scriptorium',
                category: 'Tomes',
                ...(r.research ? { research: r.research } : {}),
            };
        }
    }
}

function _mergeRituals(modId, data) {
    const KNOWN_EFFECTS = new Set(['mass_heal', 'weather_bias', 'raid_ward', 'ripen_crops']);
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(RITUALS, key, def, modId, 'rituals')) continue;
        if (def.effect && !KNOWN_EFFECTS.has(def.effect)) {
            recordWarning(`Mod "${modId}": ritual "${key}" uses unknown effect type "${def.effect}". It will be ignored by the ritual system.`);
        }
    }
}

function _mergeCrops(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(CROPS, key, def, modId, 'crops')) continue;
        if (def.food === false) {
            NON_FOOD_CROPS.push(key);
        } else {
            FOODSTUFFS.push(key);
        }
    }
}

function _mergeBuildings(modId, data) {
    for (const [key, def] of Object.entries(data)) {
        if (!_safeSet(BUILDINGS, key, def, modId, 'buildings')) continue;
        TILE_CHARS[key] = def.char;
        TILE_COLORS[key] = def.color;
        if (def.passable && !def.passable.colonist) IMPASSABLE_STRUCTURES.add(key);
        if (def.passable && !def.passable.enemy) ENEMY_BLOCKED_STRUCTURES.add(key);
        if (def.breakable) BREAKABLE_STRUCTURES.add(key);
        if (def.structureType === 'wall') WALL_STRUCTURES.add(key);
        if (def.structureType === 'furniture') FURNITURE_STRUCTURES.add(key);
        if (def.structureType === 'door') DOOR_STRUCTURES.add(key);
    }
}

const _DATA_MERGERS = {
    items:                  _mergeItems,
    realms:                 _mergeRealms,
    research:               _mergeResearch,
    research_tabs:          _mergeResearchTabs,
    traits:                 _mergeTraits,
    enemies:                _mergeEnemies,
    entities:               _mergeEntities,
    raid_types:             _mergeRaidTypes,
    races:                  _mergeRaces,
    npc_encounters:         _mergeNpcEncounters,
    expedition_decisions:   _mergeExpeditionDecisions,
    expedition_traps:       _mergeExpeditionTraps,
    puzzle_encounters:      _mergePuzzleEncounters,
    elite_modifiers:        _mergeEliteModifiers,
    realm_events:           _mergeRealmEvents,
    expedition_mutators:    _mergeExpeditionMutators,
    thoughts:               _mergeThoughts,
    story_milestones:       _mergeStoryMilestones,
    events:                 _mergeEvents,
    spells:                 _mergeSpells,
    spell_tomes:            _mergeSpellTomes,
    rituals:                _mergeRituals,
    crops:                  _mergeCrops,
    buildings:              _mergeBuildings,
};

// Pending sprite manifests consumed by SkinManager.loadModSprites() after skin load.
export const pendingModSprites = [];

const _modPortraitBases = new Map();

function _registerAssets(modId, baseUrl, assets, modDirHandle) {
    if (!assets) return;

    if (assets.sprites) {
        pendingModSprites.push({ modId, baseUrl, spritesBase: `${baseUrl}/${assets.sprites}`, modDirHandle: modDirHandle || null });
    }

    if (assets.audio) {
        const audioLoader = modDirHandle
            ? _readJsonFromHandle(modDirHandle, assets.audio)
            : _fetchJson(`${baseUrl}/${assets.audio}`);
        audioLoader.then(manifest => {
            if (!manifest) return;
            for (const [type, tracks] of Object.entries(manifest)) {
                if (!SOUND_MANIFEST[type]) SOUND_MANIFEST[type] = {};
                for (const [key, relPath] of Object.entries(tracks)) {
                    if (!relPath) continue;
                    if (modDirHandle) {
                        // Resolve to a blob URL so the audio engine can load it.
                        _blobUrlFromHandle(modDirHandle, relPath).then(url => {
                            if (url) SOUND_MANIFEST[type][key] = url;
                        });
                    } else {
                        SOUND_MANIFEST[type][key] = `${baseUrl}/${relPath}`;
                    }
                }
            }
        }).catch(() => {});
    }

    if (assets.portraits) {
        _modPortraitBases.set(modId, { base: `${baseUrl}/${assets.portraits}`, dirHandle: modDirHandle || null });
    }

}

function _registerPortraits(modId, dataFiles, modDirHandle) {
    const entry = _modPortraitBases.get(modId);
    if (!entry) return;
    const { base, dirHandle } = entry;

    // Collect portrait keys from realms, races, and chain icons derived from realm chains.
    const portraitKeys = [
        ...Object.values(dataFiles.realms || {}).map(d => d.portrait),
        ...Object.values(dataFiles.races || {}).map(d => d.portrait),
    ].filter(Boolean);

    // Auto-register chain icons: for each unique chain name in mod realms,
    // look for chain_<key>.png in the portraits folder.
    const chainKeys = [...new Set(
        Object.values(dataFiles.realms || {})
            .map(d => d.chain)
            .filter(Boolean)
            .map(c => `chain_${c.toLowerCase().replace(/\s+/g, '_')}`)
    )];

    const allKeys = [...portraitKeys, ...chainKeys];

    for (const key of allKeys) {
        if (dirHandle) {
            _blobUrlFromHandle(dirHandle, `assets/portraits/${key}.png`).then(url => {
                if (url) registerModPortrait(key, url);
            });
        } else {
            registerModPortrait(key, `${base}/${key}.png`);
        }
    }
}

function _resolveLoadOrder(manifests) {
    const inDegree = new Map(manifests.map(m => [m.id, 0]));
    const graph = new Map(manifests.map(m => [m.id, []]));
    const idSet = new Set(manifests.map(m => m.id));

    for (const m of manifests) {
        for (const dep of m.dependencies || []) {
            const depId = typeof dep === 'string' ? dep : dep.id;
            if (idSet.has(depId)) {
                graph.get(depId).push(m.id);
                inDegree.set(m.id, inDegree.get(m.id) + 1);
            } else {
                recordWarning(`Mod "${m.id}": dependency "${depId}" not found or not enabled.`);
            }
        }
    }

    const userOrder = getModLoadOrder();
    const userOrderIndex = id => { const i = userOrder.indexOf(id); return i === -1 ? Infinity : i; };
    const byLoadOrder = (a, b) => {
        const ui = userOrderIndex(a.id) - userOrderIndex(b.id);
        if (ui !== 0) return ui;
        return (a.loadOrder || 50) - (b.loadOrder || 50);
    };
    const queue = manifests.filter(m => inDegree.get(m.id) === 0).sort(byLoadOrder);
    const sorted = [];

    while (queue.length) {
        const m = queue.shift();
        sorted.push(m);
        for (const depId of graph.get(m.id) || []) {
            inDegree.set(depId, inDegree.get(depId) - 1);
            if (inDegree.get(depId) === 0) {
                const dep = manifests.find(x => x.id === depId);
                if (dep) { queue.push(dep); queue.sort(byLoadOrder); }
            }
        }
    }

    if (sorted.length < manifests.length) {
        recordWarning('Circular dependency detected in mods. Some mods may load in an unexpected order.');
        for (const m of manifests) {
            if (!sorted.includes(m)) sorted.push(m);
        }
    }

    return sorted;
}

async function _fetchJson(url) {
    try {
        if (url.startsWith('file://') && typeof window !== 'undefined' && window.electronAPI?.readModFile) {
            const text = await window.electronAPI.readModFile(url);
            if (text == null) return null;
            return JSON.parse(text);
        }
        const resp = await fetch(url);
        if (!resp.ok) return null;
        return await resp.json();
    } catch {
        return null;
    }
}

async function _discoverModIds(baseUrl, dirHandle) {
    if (dirHandle) {
        const index = await _readJsonFromHandle(dirHandle, 'index.json');
        if (Array.isArray(index) && index.length > 0) return index;
        return _scanHandleForMods(dirHandle);
    }

    const index = await _fetchJson(`${baseUrl}/index.json`);
    if (Array.isArray(index) && index.length > 0) return index;

    if (typeof window !== 'undefined' && window.electronAPI?.scanModsDir) {
        const ids = await window.electronAPI.scanModsDir(baseUrl).catch(() => []);
        if (ids && ids.length > 0) return ids;
    }

    return [];
}

export async function runModLoader() {
    // Try to restore a previously chosen local directory handle (browser FSAPI mode).
    await loadLocalDirHandle();
    const dirHandle = getLocalDirHandle();

    // Request permission if we have a stored handle but haven't confirmed access yet.
    if (dirHandle) {
        try {
            const perm = await dirHandle.requestPermission({ mode: 'read' });
            if (perm !== 'granted') {
                recordWarning('Permission denied for local mods folder. Falling back to URL-based path.');
            }
        } catch { /* API unavailable or denied, will fall back */ }
    }

    const baseUrl = getModsBaseUrl();
    const activeHandle = getLocalDirHandle();

    const index = await _discoverModIds(baseUrl, activeHandle);
    if (!index || index.length === 0) return;

    const manifestResults = await Promise.all(
        index.map(id => _fetchJson(`${baseUrl}/${id}/manifest.json`).then(m => m ? { ...m, id } : null))
    );
    const allManifests = manifestResults.filter(Boolean);
    recordDiscoveredManifests(allManifests);

    const enabled = allManifests.filter(m => isModEnabled(m.id, m.defaultEnabled !== false));
    if (enabled.length === 0) return;

    // Enforce conflict rules (disable the later mod in load order).
    const enabledIds = new Set(enabled.map(m => m.id));
    for (const m of enabled) {
        for (const conflictId of m.conflicts || []) {
            if (enabledIds.has(conflictId)) {
                recordWarning(`Mod "${m.id}" conflicts with "${conflictId}". Disabling "${conflictId}".`);
                enabledIds.delete(conflictId);
            }
        }
    }
    const active = enabled.filter(m => enabledIds.has(m.id));
    const ordered = _resolveLoadOrder(active);
    recordLoadedManifests(ordered);

    _snapshotBaseline();

    for (const manifest of ordered) {
        const modBaseUrl = `${baseUrl}/${manifest.id}`;
        let modDirHandle = null;
        if (activeHandle) {
            try { modDirHandle = await activeHandle.getDirectoryHandle(manifest.id); } catch {}
        }
        const dataSpec = manifest.data || {};

        const dataEntries = await Promise.all(
            Object.entries(dataSpec).map(([type, relPath]) => {
                const loader = modDirHandle
                    ? _readJsonFromHandle(modDirHandle, relPath)
                    : _fetchJson(`${modBaseUrl}/${relPath}`);
                return loader.then(data => [type, data]);
            })
        );

        const dataFiles = {};
        for (const [type, data] of dataEntries) {
            if (data) dataFiles[type] = data;
        }

        for (const [type, data] of Object.entries(dataFiles)) {
            const merger = _DATA_MERGERS[type];
            if (merger) {
                try { merger(manifest.id, data); }
                catch (err) { recordWarning(`Mod "${manifest.id}": error merging "${type}": ${err.message}`); }
            } else {
                recordWarning(`Mod "${manifest.id}": unknown data type "${type}". Skipping.`);
            }
        }

        _registerAssets(manifest.id, modBaseUrl, manifest.assets, modDirHandle);
        _registerPortraits(manifest.id, dataFiles, modDirHandle);
    }
}

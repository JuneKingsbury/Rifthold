const STORAGE_KEY_ENABLED = 'rifthold_enabled_mods';
const STORAGE_KEY_PATH = 'rifthold_mods_base_url';
const STORAGE_KEY_MODS_INITIALIZED = 'rifthold_mods_initialized';
const IDB_DB = 'rifthold_mods';
const IDB_STORE = 'handles';
const IDB_KEY = 'local_dir';

let _discoveredManifests = [];
let _loadedManifests = [];
let _loadWarnings = [];
const _modPortraitMap = new Map();

// In-memory FileSystemDirectoryHandle for browser local-folder mode.
let _localDirHandle = null;

export function getLocalDirHandle() { return _localDirHandle; }
export function setLocalDirHandle(handle) { _localDirHandle = handle; }

function _openIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveLocalDirHandle(handle) {
    _localDirHandle = handle;
    try {
        const db = await _openIdb();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        db.close();
    } catch { /* IndexedDB unavailable; session-only */ }
}

export async function loadLocalDirHandle() {
    try {
        const db = await _openIdb();
        const tx = db.transaction(IDB_STORE, 'readonly');
        const handle = await new Promise((res, rej) => {
            const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
            req.onsuccess = () => res(req.result);
            req.onerror = rej;
        });
        db.close();
        if (handle) _localDirHandle = handle;
        return handle || null;
    } catch { return null; }
}

export async function clearLocalDirHandle() {
    _localDirHandle = null;
    try {
        const db = await _openIdb();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        db.close();
    } catch {}
}

export function getModsBaseUrl() {
    return localStorage.getItem(STORAGE_KEY_PATH) || './mods';
}

export function setModsBaseUrl(url) {
    localStorage.setItem(STORAGE_KEY_PATH, url.replace(/\/+$/, ''));
}

export function getEnabledMods() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_ENABLED) || '{}');
    } catch {
        return {};
    }
}

export function hasModsBeenInitialized() {
    return localStorage.getItem(STORAGE_KEY_MODS_INITIALIZED) === '1';
}

export function markModsInitialized() {
    localStorage.setItem(STORAGE_KEY_MODS_INITIALIZED, '1');
}

export function isModEnabled(id, defaultEnabled = true) {
    if (!hasModsBeenInitialized()) return false;
    const map = getEnabledMods();
    return id in map ? map[id] : defaultEnabled;
}

export function setModEnabled(id, enabled) {
    markModsInitialized();
    const map = getEnabledMods();
    map[id] = enabled;
    localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(map));
}

export function recordDiscoveredManifests(manifests) {
    _discoveredManifests = manifests;
}

const STORAGE_KEY_ORDER = 'rifthold_mod_order';

export function getModLoadOrder() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_ORDER) || '[]'); }
    catch { return []; }
}

export function setModLoadOrder(ids) {
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(ids));
}

export function getDiscoveredManifests() {
    return _discoveredManifests;
}

export function recordLoadedManifests(manifests) {
    _loadedManifests = manifests;
}

export function getLoadedManifests() {
    return _loadedManifests;
}

export function recordWarning(msg) {
    _loadWarnings.push(msg);
    console.warn('[ModLoader]', msg);
}

export function getLoadWarnings() {
    return _loadWarnings;
}

export function registerModPortrait(key, url) {
    _modPortraitMap.set(key, url);
}

export function resolvePortraitSrc(key) {
    return _modPortraitMap.get(key) || `portraits/${key}.png`;
}

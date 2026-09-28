let steamworks;
try {
    steamworks = require('steamworks.js');
    steamworks.electronEnableSteamOverlay();
} catch {
    steamworks = null;
}

let client = null;
let steamAvailable = false;

const STEAM_ACHIEVEMENTS = new Set([
    'first_building', 'colony_5', 'colony_10', 'first_raid_survived', 'first_crusader_raid_survived',
    'first_death', 'first_love', 'first_winter_feast', 'first_wave_complete',
    'realm_crystal_caves', 'realm_crystal_mines', 'realm_crystal_depths', 'realm_verdant_depths', 'realm_fungal_hollows',
    'realm_primeval_canopy', 'realm_arcane_library', 'realm_ancient_university', 'realm_abandoned_laboratory',
    'realm_shadow_realm', 'realm_void_abyss', 'realm_oblivion_rift', 'realm_void_hollow', 'realm_void_sanctum', 'realm_void_heart',
    'realm_fracture_gate', 'realm_shifting_labyrinth', 'realm_unraveling_core',
    'realm_kingdom_outskirts', 'realm_crusader_barracks', 'realm_palace_fortress',
]);

function initialize(appId) {
    if (!steamworks) return;
    try {
        client = steamworks.init(appId);
        steamAvailable = true;
        console.log('[Steam] Initialized — player:', client.localplayer.getName());
    } catch (e) {
        console.warn('[Steam] Init failed (game will run without Steam):', e.message);
        client = null;
        steamAvailable = false;
    }
}

function shutdown() {
    client = null;
    steamAvailable = false;
}

function getPlayerInfo() {
    if (!client) return { name: null, steamId: null };
    try {
        return { name: client.localplayer.getName(), steamId: client.localplayer.getSteamId() };
    } catch { return { name: null, steamId: null }; }
}

function activateAchievement(name) {
    if (!client || !STEAM_ACHIEVEMENTS.has(name)) return false;
    try { return client.achievement.activate(name); }
    catch { return false; }
}

function clearAchievement(name) {
    if (!client) return false;
    try { return client.achievement.clear(name); }
    catch { return false; }
}

function getAchievements() {
    if (!client) return [];
    try {
        return [...STEAM_ACHIEVEMENTS].map(name => ({
            name,
            achieved: client.achievement.isActivated(name),
        }));
    } catch { return []; }
}

function getStatInt(name) {
    if (!client) return 0;
    try { return client.stats.getInt(name); }
    catch { return 0; }
}

function setStatInt(name, value) {
    if (!client) return;
    try { client.stats.setInt(name, value); }
    catch {}
}

function storeStats() {
    if (!client) return;
    try { client.stats.store(); }
    catch {}
}

function cloudRead(filename) {
    if (!client) return null;
    try { return client.cloud.readFile(filename); }
    catch { return null; }
}

function cloudWrite(filename, data) {
    if (!client) return false;
    try { return client.cloud.writeFile(filename, data); }
    catch { return false; }
}

function cloudDelete(filename) {
    if (!client) return false;
    try { return client.cloud.deleteFile(filename); }
    catch { return false; }
}

function cloudList() {
    if (!client) return [];
    try { return client.cloud.getFileNames(); }
    catch { return []; }
}

function cloudEnabled() {
    if (!client) return false;
    try { return client.cloud.isEnabledForApp(); }
    catch { return false; }
}

function openOverlayStore() {
    if (!client) return;
    try { client.overlay.activateToStore(); }
    catch {}
}

function openOverlayUrl(url) {
    if (!client) return;
    try { client.overlay.activateToWebPage(url); }
    catch {}
}

module.exports = {
    get steamAvailable() { return steamAvailable; },
    initialize,
    shutdown,
    getPlayerInfo,
    activateAchievement,
    clearAchievement,
    getAchievements,
    getStatInt,
    setStatInt,
    storeStats,
    cloudRead,
    cloudWrite,
    cloudDelete,
    cloudList,
    cloudEnabled,
    openOverlayStore,
    openOverlayUrl,
};

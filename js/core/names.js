// Display names for things referenced by key (stockpile resources, buildings,
// creatures). Config entries get their `name` from locale/en.json when config
// loads (stampLoc in i18n.js), so these read it from the entry. The fallback,
// the key with underscores as spaces, only shows for mod content that has no
// name and no locale entry.

import { ALL_ITEMS, BUILDINGS, ENTITIES, RESOURCES, CROPS, TERRAIN, RACES } from './config.js';
import { t, ref, defRef } from './i18n.js';

const humanize = (key) => String(key ?? '').replace(/_/g, ' ');

/** Name of a stockpile resource or item key (wood, iron_ore, health_potion). */
export function resourceName(key) {
    return ALL_ITEMS[key]?.name ?? RESOURCES[key]?.name ?? CROPS[key]?.name ?? humanize(key);
}

/** Name of a building or structure type. */
export function buildingName(type) {
    return BUILDINGS[type]?.name ?? humanize(type);
}

/** Name of a creature type (animals, enemies, golems, summons). */
export function entityName(type) {
    return ENTITIES[type]?.name ?? humanize(type);
}

/** Name of a terrain type. */
export function terrainName(type) {
    return TERRAIN[type]?.name ?? humanize(type);
}

/** Name of a colonist race. */
export function raceName(race) {
    return RACES[race]?.name ?? humanize(race);
}

/**
 * Log/notification params that name a resource, building or creature by key.
 * Saved log entries keep the reference, so the name follows the language.
 */
export function resourceRef(key) {
    const def = ALL_ITEMS[key] || RESOURCES[key] || CROPS[key];
    return def ? defRef(def) : humanize(key);
}
export function buildingRef(type) {
    return BUILDINGS[type] ? defRef(BUILDINGS[type]) : humanize(type);
}
export function entityRef(type) {
    return ENTITIES[type] ? defRef(ENTITIES[type]) : humanize(type);
}

// Re-exported so callers building log params need one import.
export { ref, defRef };

// Some config values are English labels that also serve as ids (build menu
// categories, recipe categories, story realm groups). They stay as ids; their
// display text is looked up under `<prefix>.<slug>`, falling back to the id.
const slug = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Display label for an id that is an English label: idLabel('build_category', 'Walls & Floors'). */
export function idLabel(prefix, id) {
    return t(`${prefix}.${slug(id)}`, null, humanize(id));
}

/** Build menu category label (BUILD_CATEGORIES entry or a building's `category`). */
export const buildCategoryName = (cat) => idLabel('build_category', cat);
/** Crafting tab label (RECIPE_CATEGORIES entry). */
export const recipeCategoryName = (cat) => idLabel('recipe_category', cat);
/** Story milestone realm group label (STORY_MILESTONES[...].realmGroup). */
export const realmGroupName = (group) => idLabel('realm_group', group);
/** Built-in priority profile label (PRIORITY_PROFILES key; player-made profiles show as named). */
export const priorityProfileName = (name) => idLabel('priority_profile', name);
/** Workshop group label (STATION_GROUPS value). */
export const stationGroupName = (group) => idLabel('station_group', group);

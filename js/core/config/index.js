// Config hub: every subsystem imports from '../core/config.js', which surfaces
// this module. Symbols are grouped into feature-cohesive source files and
// re-exported here so consumer import paths stay stable regardless of which file
// a symbol physically lives in. Feature files: social.js (thoughts,
// relationships, interactions), quality.js (quality tiers, salvage),
// trade.js (merchants, caravan, trade values). Move a symbol between files
// freely — only this hub needs to know where it lives.
export { GAME_VERSION, CONFIG, DAY_NIGHT, EVENTS, FIRE_CONFIG, PATHFINDING_CONFIG } from './game.js';
export { SKILLS, TRAITS, TRAIT_EXCLUSIONS, COLONIST_CONFIG, COLONIST_NAMES, COLONIST_APPEARANCE, NEED_DECAY, MOOD_THRESHOLDS, MOOD_SPEED_MULT, WORK_CONFIG, MAGIC_STUDY_CONFIG, TASK_CONFIG, TASK_SPEED_STATS } from './colonists.js';
export { THOUGHTS, RELATIONSHIP_TIERS, SOCIAL_INTERACTIONS, SOCIAL_CONFIG } from './social.js';
export { QUALITY_TIERS, SALVAGE_RATE, ROOM_QUALITY_TIERS, WORKSHOP_QUALITY_TIERS, STATION_GROUPS, FLOOR_QUALITY_VALUES } from './quality.js';
export { CARAVAN_TRADES, MERCHANTS, TRADE_VALUES, TRADER_MARKUP, TRADER_DISCOUNT } from './trade.js';
export { BUILD_CATEGORIES, BUILDINGS, TILE_CHARS, TILE_COLORS, IMPASSABLE_STRUCTURES, ENEMY_BLOCKED_STRUCTURES, BREAKABLE_STRUCTURES, WALL_STRUCTURES, DOOR_STRUCTURES, DRAG_BUILD_TYPES, COMPLEX_STRUCTURES } from './buildings.js';
export { STAT_META, formatStatValue, getItemStatLines, getNestedEffectLines } from './effects.js';
import { ALL_ITEMS as _BASE_ALL_ITEMS, RECIPE_CATEGORIES, MATERIALS, WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS, POTIONS, CONSUMABLES, ITEM_CHARS, EQUIPMENT_OVERLAY_OFFSETS, RECIPES } from './equipment.js';
import { MAGIC_SKILLS, MANA_CONFIG, SPELLS, SPELL_TOMES, RESEARCH_TABS, RESEARCH, DEMO_LOCKED_RESEARCH } from './magic.js';

// Merge tomes into ALL_ITEMS so the registry covers every non-stackable item type.
export const ALL_ITEMS = { ..._BASE_ALL_ITEMS };
for (const [key, def] of Object.entries(SPELL_TOMES)) {
    ALL_ITEMS[key] = { ...def, type: 'tome' };
}

export { RECIPE_CATEGORIES, MATERIALS, WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS, POTIONS, CONSUMABLES, ITEM_CHARS, EQUIPMENT_OVERLAY_OFFSETS, RECIPES };
export { MAGIC_SKILLS, MANA_CONFIG, SPELLS, SPELL_TOMES, RESEARCH_TABS, RESEARCH, DEMO_LOCKED_RESEARCH };
export { ENTITIES, ANIMALS, TAMED_ANIMALS, GOLEM_TYPES, SUMMON_TYPES, RAID_TYPES, WAVE_TYPES, WILDLIFE_CONFIG, RAID_CONFIG } from './entities.js';
export { REALMS, EXPLORATION_CONFIG, EXPEDITION_DIFFICULTY, EXPLORATION_EVENTS, WAVE_CONFIG, STORY_MILESTONES } from './exploration.js';
export { SEASONS, SEASON_EFFECTS, TERRAIN, RESOURCES, WEATHER_TYPES, SEASON_WEATHER, MAP_GENERATORS, FOODSTUFFS, FOOD_DECAY_CONFIG, CROPS } from './world.js';
export { RENDER_CONFIG, COMBAT_VISUALS, LOG_COLORS } from './rendering.js';

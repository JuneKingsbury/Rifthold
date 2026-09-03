/**
 * Quality tiers and scoring: crafted-item quality bands, room and workshop
 * quality tiers (mood / speed / bonus by score), the station→workshop grouping,
 * floor-material quality contributions, and the salvage return rate. Consumed by
 * crafting, room-quality, and workshop-quality code. Re-exported through the
 * config hub (index.js) so consumers import from '../core/config.js'.
 */

export const ENCHANT_COST_BY_TIER = {
    1: { resource: 'runite',       amount: 2  },
    2: { resource: 'runite',       amount: 5  },
    3: { resource: 'runite',       amount: 10 },
    4: { resource: 'void_essence', amount: 3  },
};

export const ENCHANTMENT_TIERS = [
    { key: 'I',   multiplier: 1, baseChance: 0.60, perSkill: -0.05 },
    { key: 'II',  multiplier: 2, baseChance: 0.25, perSkill: 0 },
    { key: 'III', multiplier: 3, baseChance: 0.10, perSkill: 0.02 },
    { key: 'VI',  multiplier: 4, baseChance: 0.05, perSkill: 0.01 },
];

export const QUALITY_TIERS = [
    { key: 'poor', prefix: 'Crude', multiplier: 0.85, color: '#888888', baseChance: 0.20, perSkill: -0.03 },
    { key: 'normal', prefix: '', multiplier: 1.00, color: '#cccccc', baseChance: 0.60, perSkill: 0 },
    { key: 'fine', prefix: 'Fine', multiplier: 1.10, color: '#44cc44', baseChance: 0.15, perSkill: 0.02 },
    { key: 'superior', prefix: 'Superior', multiplier: 1.20, color: '#4488ff', baseChance: 0.05, perSkill: 0.01 },
];

export const ROOM_QUALITY_TIERS = [
    { key: 'bare', name: 'Bare room', minScore: 0, moodEffect: 10, duration: 300 },
    { key: 'cozy', name: 'Cozy bedroom', minScore: 20, moodEffect: 14, duration: 350 },
    { key: 'comfortable', name: 'Comfortable bedroom', minScore: 40, moodEffect: 18, duration: 400 },
    { key: 'luxurious', name: 'Luxurious bedroom', minScore: 60, moodEffect: 22, duration: 450 },
    { key: 'opulent', name: 'Opulent quarters', minScore: 80, moodEffect: 26, duration: 500 },
];

export const TOWN_HALL_QUALITY_TIERS = [
    { key: 'plain',     name: 'Plain hall',     minScore: 0,  moodEffect: 8,  duration: 250 },
    { key: 'welcoming', name: 'Welcoming hall', minScore: 25, moodEffect: 11, duration: 300 },
    { key: 'grand',     name: 'Grand hall',     minScore: 50, moodEffect: 15, duration: 350 },
    { key: 'majestic',  name: 'Majestic hall',  minScore: 75, moodEffect: 19, duration: 400 },
];

export const WORKSHOP_QUALITY_TIERS = [
    { key: 'makeshift', name: 'Makeshift', minScore: 0, speedMult: 1.0, qualityBonus: 0 },
    { key: 'functional', name: 'Functional', minScore: 25, speedMult: 1.1, qualityBonus: 0 },
    { key: 'professional', name: 'Professional', minScore: 50, speedMult: 1.15, qualityBonus: 1 },
    { key: 'master', name: 'Master', minScore: 70, speedMult: 1.2, qualityBonus: 2 },
    { key: 'legendary', name: 'Legendary', minScore: 90, speedMult: 1.25, qualityBonus: 3 },
];

export const STATION_GROUPS = {
    anvil: 'Smithy',
    cauldron: 'Kitchen',
    alchemy_table: 'Kitchen',
    workbench: 'Workshop',
    enchanting_table: 'Workshop',
    scriptorium: 'Scriptorium',
    research_desk: 'Laboratory',
    loom: 'Clothier',
};

export const FLOOR_QUALITY_VALUES = {
    wood_floor: 15,
    stone_floor: 20,
    brick_floor: 25,
};

export const SALVAGE_RATE = 0.5;

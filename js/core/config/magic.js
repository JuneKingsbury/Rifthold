import { BUILDINGS } from './buildings.js';
import { RECIPES } from './equipment.js';
import { CROPS } from './world.js';

export const MAGIC_SKILLS = {
    evocation:     { name: 'Evocation', baseLevel: [0, 0], biasBonus: 2, color: '#ff6644', description: 'Ranged combat magic' },
    enchantment:   { name: 'Enchantment', baseLevel: [0, 0], biasBonus: 2, color: '#88ffff', description: 'Support spells and golem animation' },
    abjuration:    { name: 'Abjuration', baseLevel: [0, 0], biasBonus: 2, color: '#44ff44', description: 'Healing and protective magic' },
    conjuration:   { name: 'Conjuration', baseLevel: [0, 0], biasBonus: 2, color: '#9966ff', description: 'Summoning and teleportation' },
    transmutation: { name: 'Transmutation', baseLevel: [0, 0], biasBonus: 2, color: '#88ff88', description: 'Environmental and growth magic' },
    divination:    { name: 'Divination', baseLevel: [0, 0], biasBonus: 2, color: '#ccaaff', description: 'Predicting and influencing fate' },
};

export const MANA_CONFIG = {
    baseMana: 20,
    manaPerMagicLevel: 5,
    baseRegen: 0.05,
    regenPerMagicLevel: 0.01,
    regenWhileIdle: 2.0,
    regenWhileSleeping: 3.0,
};

export const SPELLS = {
    spark: { name: 'Spark', school: 'evocation', minLevel: 0, manaCost: 4, cooldown: 25, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 6, range: 4, projectileColor: '#ffaa33', projectileChar: '.' },
    mend: { name: 'Mend', school: 'abjuration', minLevel: 0, manaCost: 5, cooldown: 60, castType: 'auto', trigger: 'lowHealth', effect: 'heal', healAmount: 8, targetSelf: true },
    quicken: { name: 'Quicken', school: 'enchantment', minLevel: 0, manaCost: 6, cooldown: 80, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', moveSpeedBonus: 0, workSpeedBonus: 1.2, duration: 40 },
    phase_step: { name: 'Phase Step', school: 'conjuration', minLevel: 0, manaCost: 6, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'buff_speed', moveSpeedBonus: 2, workSpeedBonus: 1.0, duration: 20 },
    nurture: { name: 'Nurture', school: 'transmutation', minLevel: 0, manaCost: 8, cooldown: 200, castType: 'targeted', effect: 'boost_crops', range: 5, radius: 1, growthMult: 1.5, duration: 100 },
    magic_missile: { name: 'Magic Missile', school: 'evocation', minLevel: 1, manaCost: 8, cooldown: 30, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 15, range: 6, projectileColor: '#ff44ff', projectileChar: '*' },
    smite: { name: 'Smite', school: 'evocation', minLevel: 1, manaCost: 6, cooldown: 20, castType: 'auto', trigger: 'inCombat', effect: 'melee_damage', damage: 12, range: 1, projectileColor: '#ffffaa', projectileChar: '✝' },
    fireball: { name: 'Fireball', school: 'evocation', minLevel: 3, manaCost: 18, cooldown: 60, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_aoe', damage: 12, range: 7, radius: 2, projectileColor: '#ff6600', projectileChar: '●' },
    haste: { name: 'Haste', school: 'enchantment', minLevel: 2, manaCost: 12, cooldown: 200, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', moveSpeedBonus: 0.4, workSpeedBonus: 1.2, duration: 80, idleExclude: true },
    heal: { name: 'Heal', school: 'abjuration', minLevel: 1, manaCost: 10, cooldown: 60, castType: 'auto', trigger: 'lowHealth', hpThreshold: 0.5, effect: 'heal', healAmount: 30, targetSelf: true },
    shield: { name: 'Shield', school: 'abjuration', minLevel: 3, manaCost: 15, cooldown: 150, castType: 'auto', trigger: 'inCombat', effect: 'buff_defense', damageReduction: 0.3, duration: 60 },
    warp: { name: 'Warp', school: 'conjuration', minLevel: 2, manaCost: 15, cooldown: 100, castType: 'targeted', effect: 'teleport', range: 20 },
    summon_familiar: { name: 'Summon Familiar', school: 'conjuration', minLevel: 3, manaCost: 25, cooldown: 400, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'familiar' },
    summon_ghost: { name: 'Summon Ghost', school: 'conjuration', minLevel: 4, manaCost: 35, cooldown: 500, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'ghost' },
    circle_of_growth: { name: 'Circle of Growth', school: 'transmutation', minLevel: 2, manaCost: 20, cooldown: 400, castType: 'targeted', effect: 'boost_crops', range: 10, radius: 3, growthMult: 2.0, duration: 200 },
    level_field: { name: 'Level Field', school: 'transmutation', minLevel: 4, manaCost: 30, cooldown: 600, castType: 'targeted', effect: 'terraform', range: 8, radius: 3, targetTerrain: 'grass' },
    foresight: { name: 'Foresight', school: 'divination', minLevel: 0, manaCost: 6, cooldown: 300, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { raidDelay: 200 }, duration: 300 },
    fair_winds: { name: 'Fair Winds', school: 'divination', minLevel: 1, manaCost: 10, cooldown: 400, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { weatherBias: 'clear' }, duration: 200 },
    merchants_omen: { name: "Merchant's Omen", school: 'divination', minLevel: 2, manaCost: 15, cooldown: 600, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'caravan', eventMult: 3.0 }, duration: 400 },
    ward_of_calamity: { name: 'Ward of Calamity', school: 'divination', minLevel: 3, manaCost: 20, cooldown: 800, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { suppressEvents: ['blight', 'cold_snap', 'fire'] }, duration: 500 },
    fortunate_discovery: { name: 'Fortunate Discovery', school: 'divination', minLevel: 4, manaCost: 25, cooldown: 1000, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'meteorite', eventMult: 5.0 }, duration: 600 },
};

export const SPELL_TOMES = {
    tome_of_spark: { name: 'Tome of Spark', tradeValue: 12, spell: 'spark', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a basic bolt of fire at nearby foes.' },
    tome_of_mend: { name: 'Tome of Mend', tradeValue: 12, spell: 'mend', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a minor self-healing incantation.' },
    tome_of_quicken: { name: 'Tome of Quicken', tradeValue: 12, spell: 'quicken', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a spell to hasten work speed.' },
    tome_of_phase_step: { name: 'Tome of Phase Step', tradeValue: 12, spell: 'phase_step', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a burst of supernatural movement speed.' },
    tome_of_nurture: { name: 'Tome of Nurture', tradeValue: 12, spell: 'nurture', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a spell to accelerate crop growth.' },
    tome_of_smite: { name: 'Tome of Smite', tradeValue: 22, spell: 'smite', learningWork: 120, minSchoolLevel: 1, description: 'Teaches a powerful melee strike of holy energy.' },
    tome_of_magic_missile: { name: 'Tome of Magic Missile', tradeValue: 28, spell: 'magic_missile', learningWork: 150, minSchoolLevel: 1, description: 'Teaches a potent ranged arcane bolt.' },
    tome_of_fireball: { name: 'Tome of Fireball', tradeValue: 58, spell: 'fireball', learningWork: 350, minSchoolLevel: 3, description: 'Teaches an explosive fireball that damages an area.' },
    tome_of_haste: { name: 'Tome of Haste', tradeValue: 45, spell: 'haste', learningWork: 280, minSchoolLevel: 2, description: 'Teaches a powerful speed enhancement spell.' },
    tome_of_heal: { name: 'Tome of Heal', tradeValue: 32, spell: 'heal', learningWork: 180, minSchoolLevel: 1, description: 'Teaches a strong healing spell.' },
    tome_of_shield: { name: 'Tome of Shield', tradeValue: 52, spell: 'shield', learningWork: 320, minSchoolLevel: 3, description: 'Teaches a protective barrier that reduces damage.' },
    tome_of_warp: { name: 'Tome of Warp', tradeValue: 38, spell: 'warp', learningWork: 230, minSchoolLevel: 2, description: 'Teaches instant teleportation to a target location.' },
    tome_of_summon_familiar: { name: 'Tome of Summon Familiar', tradeValue: 62, spell: 'summon_familiar', learningWork: 380, minSchoolLevel: 3, description: 'Teaches summoning a familiar to fight alongside.' },
    tome_of_summon_ghost: { name: 'Tome of Summon Ghost', tradeValue: 70, spell: 'summon_ghost', learningWork: 440, minSchoolLevel: 4, description: 'Teaches summoning a spectral warrior.' },
    tome_of_circle_of_growth: { name: 'Tome of Circle of Growth', tradeValue: 40, spell: 'circle_of_growth', learningWork: 240, minSchoolLevel: 2, description: 'Teaches a wide-area crop growth enhancement.' },
    tome_of_level_field: { name: 'Tome of Level Field', tradeValue: 70, spell: 'level_field', learningWork: 440, minSchoolLevel: 4, description: 'Teaches terrain-shaping transmutation magic.' },
    tome_of_foresight: { name: 'Tome of Foresight', tradeValue: 12, spell: 'foresight', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a divination that delays enemy raids.' },
    tome_of_fair_winds: { name: 'Tome of Fair Winds', tradeValue: 28, spell: 'fair_winds', learningWork: 150, minSchoolLevel: 1, description: 'Teaches a spell that biases weather toward clear skies.' },
    tome_of_merchants_omen: { name: "Tome of Merchant's Omen", tradeValue: 40, spell: 'merchants_omen', learningWork: 240, minSchoolLevel: 2, description: 'Teaches a divination that attracts caravans.' },
    tome_of_ward_of_calamity: { name: 'Tome of Ward of Calamity', tradeValue: 58, spell: 'ward_of_calamity', learningWork: 350, minSchoolLevel: 3, description: 'Teaches a ward that suppresses natural disasters.' },
    tome_of_fortunate_discovery: { name: 'Tome of Fortunate Discovery', tradeValue: 70, spell: 'fortunate_discovery', learningWork: 440, minSchoolLevel: 4, description: 'Teaches a divination that attracts meteorites.' },
};

export const RESEARCH_TABS = [
    { key: 'foundations', name: 'Foundations & Nature' },
    { key: 'arcane', name: 'Arcane & Mana' },
    { key: 'crafting', name: 'Crafting & Lore' },
    { key: 'void', name: 'Void & Exploration' },
];

export const RESEARCH = {
    // Foundations & Nature
    stonework: { name: 'Stonework', cost: 100, requires: [], tab: 'foundations', description: 'Brick construction and faster mining' },
    runecraft: { name: 'Runecraft', cost: 80, requires: [], tab: 'foundations', description: 'Etch runes into stone weapons' },
    druidcraft: { name: 'Druidcraft', cost: 110, requires: [], tab: 'foundations', description: 'Unlock corn and potatoes' },
    alchemy: { name: 'Alchemy', cost: 150, requires: ['stonework'], tab: 'foundations', description: 'Cooking produces +2 bonus food per meal' },
    irrigation: { name: 'Irrigation', cost: 250, requires: ['druidcraft'], tab: 'foundations', description: 'Crops grow in winter at half speed; water-adjacent farms grow 20% faster' },
    beast_binding: { name: 'Beast Binding', cost: 280, requires: ['druidcraft'], tab: 'foundations', description: 'Bind and pen creatures' },
    trade_routes: { name: 'Trade Routes', cost: 300, requires: ['alchemy'], tab: 'foundations', description: 'Caravans arrive more often and offer better prices' },
    husbandry: { name: 'Husbandry', cost: 350, requires: ['beast_binding'], tab: 'foundations', description: 'Tamed animals produce 50% more and can breed' },
    wolf_mastery: { name: 'Wolf Mastery', cost: 350, requires: ['beast_binding'], tab: 'foundations', description: 'Wolf tame chance +20%, tamed wolves deal +4 damage' },
    herbalism: { name: 'Herbalism', cost: 350, requires: ['alchemy', 'druidcraft'], tab: 'foundations', description: 'Grow moonbloom and brew mana/resistance potions' },
    verdant_growth: { name: 'Verdant Growth', cost: 500, requires: ['herbalism', 'beast_binding'], tab: 'foundations', description: 'All crops gain +1 harvest yield; moonbloom grows 30% faster', requiresTabCount: 4 },

    // Arcane & Mana
    ley_channeling: { name: 'Ley Channeling', cost: 300, requires: ['runecraft', 'stonework'], tab: 'arcane', description: 'Tap leylines for mana', requiresBuildings: { anvil: 1 } },
    luminance: { name: 'Luminance', cost: 200, requires: ['ley_channeling'], tab: 'arcane', description: 'Mana-powered light' },
    brilliance: { name: 'Brilliance', cost: 500, requires: ['luminance'], tab: 'arcane', description: 'Radiant beacon lights large areas', requiresTabCount: 3 },
    arcane_conduits: { name: 'Arcane Conduits', cost: 400, requires: ['luminance'], tab: 'arcane', description: 'Mana relays reduce nearby building consumption' },
    ember_magic: { name: 'Ember Magic', cost: 250, requires: ['ley_channeling'], tab: 'arcane', description: 'Warmth wards for winter' },
    arcane_infusion: { name: 'Arcane Infusion', cost: 450, requires: ['ley_channeling', 'alchemy'], tab: 'arcane', description: 'Faster enchanted crafting', requiresBuildings: { mana_crystal: 2 } },
    mana_reservoir: { name: 'Mana Reservoir', cost: 600, requires: ['arcane_infusion'], tab: 'arcane', description: 'Mana crystal cap +3 and each generates +1 mana', requiresTabCount: 3 },
    mana_weaving: { name: 'Mana Weaving', cost: 650, requires: ['arcane_infusion'], tab: 'arcane', description: 'Weave mana into protective garb', requiresTabCount: 3 },
    pyroclasm: { name: 'Pyroclasm', cost: 750, requires: ['ember_magic', 'warding'], tab: 'arcane', description: 'Fire ward incinerates nearby foes', requiresTabCount: 3 },

    // Crafting & Lore
    marksmanship: { name: 'Marksmanship', cost: 250, requires: ['runecraft'], tab: 'crafting', description: 'Crossbow crafting and +1 range to all ranged weapons' },
    arcane_studies: { name: 'Arcane Studies', cost: 180, requires: ['runecraft'], tab: 'crafting', description: 'Study and craft basic spell tomes' },
    arcane_implements: { name: 'Arcane Implements', cost: 250, requires: ['runecraft', 'ley_channeling'], tab: 'crafting', description: 'Craft wands and staves for spellcasters' },
    artisans_touch: { name: "Artisan's Touch", cost: 450, requires: ['runeforging'], tab: 'crafting', description: 'Better crafting quality odds; salvage returns 75%' },
    advanced_arcana: { name: 'Advanced Arcana', cost: 550, requires: ['arcane_studies', 'arcane_infusion'], tab: 'crafting', description: 'Craft advanced spell tomes', requiresBuildings: { scriptorium: 1 } },
    void_sorcery: { name: 'Void Sorcery', cost: 600, requires: ['advanced_arcana'], tab: 'crafting', description: 'Craft runic wands, void staves, and void daggers', requiresTabCount: 3 },
    runeforging: { name: 'Runeforging', cost: 350, requires: ['runecraft'], tab: 'crafting', description: 'Forge runic weapons' },
    masterwork: { name: 'Masterwork', cost: 800, requires: ['runeforging', 'arcane_infusion', 'artisans_touch'], tab: 'crafting', description: 'Forge legendary enchanted weapons', requiresBuildings: { enchanting_table: 1 }, requiresMilestone: { stat: 'superiorItemsCrafted', min: 1 }, requiresTabCount: 3 },
    golem_craft: { name: 'Golem Craft', cost: 1000, requires: ['arcane_infusion', 'void_forging', 'mana_reservoir'], tab: 'crafting', description: 'Animate stone golems to serve as tireless workers', requiresBuildings: { forge_core: 1 }, requiresMilestone: { stat: 'itemsEnchanted', min: 3 }, requiresTabCount: 3 },

    // Void & Exploration
    warding: { name: 'Warding', cost: 250, requires: ['runecraft'], tab: 'void', description: 'Conjure defensive wards' },
    fortification: { name: 'Fortification', cost: 350, requires: ['warding', 'stonework'], tab: 'void', description: 'Reinforced doors and faster wall auto-repair' },
    void_summoning: { name: 'Void Summoning', cost: 550, requires: ['ley_channeling', 'warding', 'fortification'], tab: 'void', description: 'Open portals to summon waves of enemies', requiresBuildings: { arcane_sentinel: 1 }, requiresMilestone: { stat: 'raidsDefeated', min: 1 } },
    void_architecture: { name: 'Void Architecture', cost: 400, requires: ['void_summoning'], tab: 'void', description: 'Build void-reinforced walls and doors' },
    void_forging: { name: 'Void Forging', cost: 750, requires: ['void_architecture', 'runeforging'], tab: 'void', description: 'Forge void essence into powerful gear', requiresTabCount: 3 },
    planar_rift: { name: 'Planar Rift', cost: 800, requires: ['void_summoning', 'arcane_infusion'], tab: 'void', description: 'Open stable rifts for exploration expeditions', requiresMilestone: { stat: 'wavesCompleted', min: 1 } },
    deep_delving: { name: 'Deep Delving', cost: 1200, requires: ['planar_rift'], tab: 'void', description: 'Access deeper, more dangerous realms', requiresBuildings: { rift_gate: 1 }, requiresMilestone: { stat: 'expeditionsCompleted', min: 1 }, requiresTabCount: 3 },
};

export const DEMO_LOCKED_RESEARCH = new Set([
    'advanced_arcana', 'void_sorcery', 'masterwork', 'golem_craft', 'mana_weaving',
    'mana_reservoir', 'brilliance', 'pyroclasm', 'void_summoning', 'void_architecture',
    'void_forging', 'planar_rift', 'deep_delving'
]);

// Auto-derive unlocks from the 'research' field on buildings, recipes, and crops.
for (const [key, tech] of Object.entries(RESEARCH)) {
    tech.unlocks = { buildings: [], recipes: [], crops: [] };
}
for (const [name, b] of Object.entries(BUILDINGS)) {
    if (b.research && RESEARCH[b.research]) RESEARCH[b.research].unlocks.buildings.push(name);
}
for (const [name, r] of Object.entries(RECIPES)) {
    if (r.research && RESEARCH[r.research]) RESEARCH[r.research].unlocks.recipes.push(name);
}
for (const [name, c] of Object.entries(CROPS)) {
    if (c.research && RESEARCH[c.research]) RESEARCH[c.research].unlocks.crops.push(name);
}

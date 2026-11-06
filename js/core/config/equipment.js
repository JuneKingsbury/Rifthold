import { stampLoc } from '../i18n.js';

export const RECIPE_CATEGORIES = ['Materials', 'Weapons', 'Armor', 'Clothing', 'Tools', 'Trinkets', 'Food & Potions', 'Tomes'];

export const MATERIALS = {
    wood: { },
    stone: { },
    food: { },
    meat: { },
    wheat: { },
    berries: { },
    corn: { },
    potatoes: { },
    moonbloom: { },
    hides: { },
    iron_ore: { },
    runite_ore: {  },
    eggs: { },
    milk: { },
    wool: { },
    cotton: { },
    void_essence: { },
    abyss_sliver: { },
    gold: {  },
    planks: { recipe: { input: { wood: 2 }, output: 3, ticks: 10 } },
    bricks: { recipe: { input: { stone: 2 }, output: 3, ticks: 12 } },
    leather: { recipe: { input: { hides: 2 }, output: 2, ticks: 10 } },
    cloth: { recipe: { input: { cotton: 2 }, output: 3, ticks: 10, research: 'textiles', station: 'loom' } },
    iron: { recipe: { input: { iron_ore: 2 }, output: 2, ticks: 12, research: 'metalworking', station: 'anvil' } },
    runite: { recipe: { input: { runite_ore: 2 }, output: 2, ticks: 14, research: 'runeforging', station: 'anvil' } },
};
stampLoc(MATERIALS, 'item');

const BASE_RECIPES = {
    repair_trinket: { input: { runite: 1 }, output: {}, skill: 'crafting', ticks: 40, station: 'anvil', category: 'Materials', special: 'repair' },
    cook_meal: { input: { foodstuffs: 6 }, output: { food: 3 }, skill: 'cooking', ticks: 8, station: 'cooking_pot', category: 'Food & Potions' },

    // Evocation
    craft_tome_of_spark: { input: { planks: 2, stone: 1 }, output: { tome_of_spark: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_singe: { input: { planks: 2, stone: 1 }, output: { tome_of_singe: 1 }, skill: 'crafting', ticks: 18, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_smite: { input: { planks: 2, runite: 1, iron: 1 }, output: { tome_of_smite: 1 }, skill: 'crafting', ticks: 20, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_magic_missile: { input: { planks: 3, runite: 1 }, output: { tome_of_magic_missile: 1 }, skill: 'crafting', ticks: 30, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_hex_bolt: { input: { planks: 3, runite: 1 }, output: { tome_of_hex_bolt: 1 }, skill: 'crafting', ticks: 28, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_arcane_blast: { input: { planks: 4, runite: 2, stone: 2 }, output: { tome_of_arcane_blast: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_frost_lance: { input: { planks: 4, runite: 2 }, output: { tome_of_frost_lance: 1 }, skill: 'crafting', ticks: 40, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_chain_lightning: { input: { planks: 5, runite: 3, void_essence: 1 }, output: { tome_of_chain_lightning: 1 }, skill: 'crafting', ticks: 48, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_fireball: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_fireball: 1 }, skill: 'crafting', ticks: 58, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Abjuration
    craft_tome_of_mend: { input: { planks: 2, berries: 2 }, output: { tome_of_mend: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_cleanse: { input: { planks: 2, berries: 2 }, output: { tome_of_cleanse: 1 }, skill: 'crafting', ticks: 18, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_fortify: { input: { planks: 3, runite: 1, stone: 1 }, output: { tome_of_fortify: 1 }, skill: 'crafting', ticks: 28, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_mending_aura: { input: { planks: 3, runite: 1, berries: 2 }, output: { tome_of_mending_aura: 1 }, skill: 'crafting', ticks: 30, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_renewal: { input: { planks: 4, runite: 2, berries: 3 }, output: { tome_of_renewal: 1 }, skill: 'crafting', ticks: 40, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_guardian_ward: { input: { planks: 4, runite: 3 }, output: { tome_of_guardian_ward: 1 }, skill: 'crafting', ticks: 45, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_shield: { input: { planks: 4, runite: 3, stone: 3 }, output: { tome_of_shield: 1 }, skill: 'crafting', ticks: 48, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_chain_heal: { input: { planks: 5, runite: 3, berries: 3 }, output: { tome_of_chain_heal: 1 }, skill: 'crafting', ticks: 55, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Enchantment
    craft_tome_of_quicken: { input: { planks: 2, stone: 1 }, output: { tome_of_quicken: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_diligence: { input: { planks: 2, stone: 1 }, output: { tome_of_diligence: 1 }, skill: 'crafting', ticks: 18, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_haste: { input: { planks: 4, runite: 2 }, output: { tome_of_haste: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_tireless: { input: { planks: 3, runite: 1 }, output: { tome_of_tireless: 1 }, skill: 'crafting', ticks: 30, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_mind_shroud: { input: { planks: 4, runite: 2 }, output: { tome_of_mind_shroud: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_mesmerize: { input: { planks: 4, runite: 2 }, output: { tome_of_mesmerize: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_inspire: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_inspire: 1 }, skill: 'crafting', ticks: 50, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_spellbind: { input: { planks: 6, runite: 4, void_essence: 3 }, output: { tome_of_spellbind: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Conjuration
    craft_tome_of_phase_step: { input: { planks: 2, stone: 1 }, output: { tome_of_phase_step: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_conjure_decoy: { input: { planks: 2, stone: 1 }, output: { tome_of_conjure_decoy: 1 }, skill: 'crafting', ticks: 18, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_summon_familiar: { input: { planks: 2, wheat: 2 }, output: { tome_of_summon_familiar: 1 }, skill: 'crafting', ticks: 22, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_warp: { input: { planks: 4, runite: 2, void_essence: 1 }, output: { tome_of_warp: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_summon_ghost: { input: { planks: 4, runite: 2, void_essence: 1 }, output: { tome_of_summon_ghost: 1 }, skill: 'crafting', ticks: 48, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_spectral_swarm: { input: { planks: 4, runite: 2, void_essence: 1 }, output: { tome_of_spectral_swarm: 1 }, skill: 'crafting', ticks: 48, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_gate: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_gate: 1 }, skill: 'crafting', ticks: 50, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_summon_monster: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_summon_monster: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Transmutation
    craft_tome_of_nurture: { input: { planks: 2, wheat: 2 }, output: { tome_of_nurture: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_enrich_soil: { input: { planks: 2, wheat: 2 }, output: { tome_of_enrich_soil: 1 }, skill: 'crafting', ticks: 18, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_transmute_stone: { input: { planks: 2, stone: 2 }, output: { tome_of_transmute_stone: 1 }, skill: 'crafting', ticks: 20, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_stone_shape: { input: { planks: 3, runite: 1, stone: 2 }, output: { tome_of_stone_shape: 1 }, skill: 'crafting', ticks: 32, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_circle_of_growth: { input: { planks: 4, runite: 2, wheat: 3 }, output: { tome_of_circle_of_growth: 1 }, skill: 'crafting', ticks: 40, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_transmute_iron: { input: { planks: 4, runite: 2, stone: 2 }, output: { tome_of_transmute_iron: 1 }, skill: 'crafting', ticks: 42, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_level_field: { input: { planks: 5, runite: 4, void_essence: 3 }, output: { tome_of_level_field: 1 }, skill: 'crafting', ticks: 55, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_verdant_bloom: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_verdant_bloom: 1 }, skill: 'crafting', ticks: 55, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_transmute_runite: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_transmute_runite: 1 }, skill: 'crafting', ticks: 58, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Divination
    craft_tome_of_foresight: { input: { planks: 2, berries: 1 }, output: { tome_of_foresight: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_augury: { input: { planks: 2, berries: 1 }, output: { tome_of_augury: 1 }, skill: 'crafting', ticks: 14, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_fair_winds: { input: { planks: 3, runite: 1 }, output: { tome_of_fair_winds: 1 }, skill: 'crafting', ticks: 20, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_ill_omen: { input: { planks: 3, runite: 1 }, output: { tome_of_ill_omen: 1 }, skill: 'crafting', ticks: 28, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_merchants_omen: { input: { planks: 4, runite: 2 }, output: { tome_of_merchants_omen: 1 }, skill: 'crafting', ticks: 25, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_ward_of_calamity: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_ward_of_calamity: 1 }, skill: 'crafting', ticks: 50, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_fortunate_discovery: { input: { planks: 5, runite: 4, void_essence: 3 }, output: { tome_of_fortunate_discovery: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
};

export const WEAPONS = {
    // ── Tier 0 ──
    fists: { damage: 5, tier: 0, order: 1, attackAnim: 'Swing' },
    // ── Tier 1: melee → ranged → magic ──
    stone_spear: { damage: 8, tier: 1, order: 2, attackCooldown: 2, critChance: 0.15, attackAnim: 'Stab', recipe: { input: { stone: 2, wood: 1 }, ticks: 12 } },
    wooden_club: { damage: 20, tier: 1, order: 3, attackCooldown: 5, attackAnim: 'Swing', onHit: { effect: 'slow', moveSpeedMalus: -0.2, attackSlowMult: 0.8, duration: 15, rounds: 1 }, recipe: { input: { wood: 2, planks: 1 }, ticks: 15 } },
    short_bow: { damage: 7, tier: 1, order: 4, ranged: true, range: 5, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', recipe: { input: { wood: 3, leather: 1 }, ticks: 14 } },
    wooden_wand: { damage: 3, tier: 1, order: 5, attackCooldown: 2, spellDamageBonus: 0.2, manaRegen: 0.02, ranged: true, range: 5, projectileChar: '·', projectileColor: '#aaccff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', recipe: { input: { wood: 3, planks: 1 }, ticks: 12, research: 'arcane_studies' } },
    // ── Tier 2: melee → ranged → magic ──
    iron_sword: { tradeValue: 28, damage: 15, tier: 2, order: 6, attackAnim: 'Swing', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    etched_axe: { damage: 21, tier: 2, order: 7, attackCooldown: 4, critChance: 0.10, attackAnim: 'Swing', recipe: { input: { iron: 2, planks: 1, stone: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    etched_mace: { damage: 24, tier: 2, order: 8, attackCooldown: 5, attackAnim: 'Swing', onHit: { effect: 'slow', moveSpeedMalus: -0.35, attackSlowMult: 0.7, duration: 20, rounds: 1 }, recipe: { input: { iron: 3, planks: 1 }, ticks: 24, research: 'metalworking', station: 'anvil' } },
    tempered_blade: { damage: 18, tier: 2, order: 8.5, attackAnim: 'Swing', recipe: { input: { iron: 3, planks: 2 }, ticks: 26, research: ['metalworking', 'warrior_training'], station: 'anvil' } },
    poison_tipped_spear: { damage: 9, tier: 2, order: 9, attackCooldown: 2, attackAnim: 'Stab', poisonOnHit: { damage: 1, ticks: 6, interval: 10 }, recipe: { input: { stone: 2, wood: 1, moonbloom: 2 }, ticks: 20, research: 'herbalism' } },
    hunting_bow: { damage: 10, tier: 2, order: 10, ranged: true, range: 6, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', recipe: { input: { planks: 2, leather: 2, iron: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    iron_crossbow: { tradeValue: 38, damage: 22, tier: 2, order: 11, attackCooldown: 5, ranged: true, range: 7, projectileChar: '→', projectileColor: '#aaddff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', recipe: { input: { iron: 3, planks: 2, leather: 1 }, ticks: 30, research: 'marksmanship', station: 'anvil' } },
    crystal_staff: { damage: 13, tier: 2, order: 12, attackCooldown: 4, spellDamageBonus: 0.35, maxManaBonus: 10, spellCooldownReduction: 0.05, ranged: true, range: 6, projectileChar: '✦', projectileColor: '#88ddff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', recipe: { input: { iron: 2, planks: 2, runite: 1 }, ticks: 28, research: 'arcane_implements', station: 'anvil' } },
    war_axe: { damage: 26, tier: 2, order: 12.5, attackCooldown: 4, attackAnim: 'Swing', recipe: { input: { iron: 4, planks: 2 }, ticks: 32, research: 'warrior_training', station: 'anvil' } },
    // ── Tier 3: melee → ranged → magic → drop-only ──
    enchanted_glaive: { damage: 26, tier: 3, order: 13, attackCooldown: 4, spellDamageBonus: 0.25, attackAnim: 'Swing', recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 38, research: 'mana_weaving', station: 'enchanting_table' } },
    runic_blade: { tradeValue: 45, damage: 28, tier: 3, order: 14, attackAnim: 'Swing', recipe: { input: { runite: 2, planks: 1 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    barbed_blade: { damage: 22, tier: 3, order: 15, attackAnim: 'Swing', bleedOnHit: { damage: 2, ticks: 5, interval: 8 }, recipe: { input: { runite: 2, iron: 1, planks: 1 }, ticks: 38, research: 'runeforging', station: 'enchanting_table' } },
    sweeping_glaive: { damage: 30, tier: 3, order: 16, attackCooldown: 4, attackAnim: 'Swing', cleave: true, recipe: { input: { runite: 2, iron: 2, planks: 2 }, ticks: 42, research: 'runeforging', station: 'enchanting_table' } },
    runic_crossbow: { damage: 30, tier: 3, order: 17, attackCooldown: 5, ranged: true, range: 8, projectileChar: '→', projectileColor: '#bb99ff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', recipe: { input: { runite: 3, iron: 2, planks: 2 }, ticks: 42, research: ['marksmanship', 'runeforging'], station: 'enchanting_table' } },
    runic_wand: { damage: 7, tier: 3, order: 18, attackCooldown: 2, spellDamageBonus: 0.5, manaRegen: 0.04, ranged: true, range: 7, projectileChar: '·', projectileColor: '#dd88ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', recipe: { input: { runite: 2, planks: 2 }, ticks: 35, research: 'void_sorcery', station: 'enchanting_table' } },
    frostfang_wand: { damage: 6, tier: 3, order: 19, attackCooldown: 2, spellDamageBonus: 0.4, manaRegen: 0.03, evocationBonus: 0.25, ranged: true, range: 6, projectileChar: '❄', projectileColor: '#88eeff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', onHit: { effect: 'slow', moveSpeedMalus: -0.3, attackSlowMult: 0.6, duration: 40, rounds: 1 }, recipe: { input: { runite: 2, void_essence: 1, planks: 2 }, ticks: 40, research: 'void_sorcery', station: 'enchanting_table' } },
    ashen_staff: { damage: 15, tier: 3, order: 20, attackCooldown: 4, spellDamageBonus: 0.3, maxManaBonus: 15, spellCooldownReduction: 0.1, evocationBonus: 0.15, ranged: true, range: 6, projectileChar: '🔥', projectileColor: '#ff6622', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', burnOnHit: { damage: 2, ticks: 4, interval: 10 }, tradeValue: 50, textColor: '#4488ff' },
    soulbond_scepter: { damage: 11, tier: 3, order: 21, attackCooldown: 4, spellDamageBonus: 0.2, maxManaBonus: 10, spellCooldownReduction: 0.2, conjurationBonus: 0.3, summonHpBonus: 0.25, ranged: true, range: 5, projectileChar: '✦', projectileColor: '#9966ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', tradeValue: 55, textColor: '#4488ff' },
    // ── Tier 4: melee → ranged → magic ──
    // ── Tier 4: void_essence weapons ──
    void_edge: { damage: 36, tier: 4, order: 22, attackAnim: 'Swing', recipe: { input: { void_essence: 3, runite: 3, planks: 1 }, ticks: 45, research: 'void_forging', station: 'enchanting_table' } },
    void_glaive: { damage: 40, tier: 4, order: 23, attackCooldown: 4, cleave: true, attackAnim: 'Swing', recipe: { input: { void_essence: 4, runite: 2, planks: 2 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    void_recurve: { damage: 36, tier: 4, order: 24, ranged: true, range: 9, projectileChar: '⟶', projectileColor: '#cc00ff', skinKey: 'projectile_void', attackAnim: 'DrawAndShoot', recipe: { input: { void_essence: 3, runite: 2, planks: 3 }, ticks: 48, research: 'void_forging', station: 'enchanting_table' } },
    void_wand: { damage: 16, tier: 4, order: 25, attackCooldown: 2, spellDamageBonus: 0.55, manaRegen: 0.06, ranged: true, range: 7, projectileChar: '·', projectileColor: '#cc00ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', recipe: { input: { void_essence: 3, runite: 2, planks: 2 }, ticks: 45, research: 'void_sorcery', station: 'enchanting_table' } },
    sovereign_blade: { textColor: '#f944ff', tradeValue: 80, damage: 44, tier: 4, order: 25.5, attackAnim: 'Swing', armoredDamageBonus: 0.20, critChance: 0.12 },
    // ── Tier 5: abyss_sliver weapons ──
    fracture_edge: { textColor: '#ff4444', tradeValue: 90, damage: 50, tier: 5, order: 26.5, attackCooldown: 3, attackAnim: 'Swing', bleedOnHit: { damage: 3, ticks: 5, interval: 8 }, onHit: { effect: 'slow', moveSpeedMalus: -0.25, attackSlowMult: 0.75, duration: 20, rounds: 1 } },
    abyssal_blade: { damage: 55, tier: 5, order: 26, attackCooldown: 5, attackAnim: 'Swing', recipe: { input: { abyss_sliver: 3, void_essence: 3, planks: 1 }, ticks: 60, research: 'abyss_smithing', station: 'enchanting_table' } },
    abyssal_greatsword: { damage: 62, tier: 5, order: 27, attackCooldown: 5, armoredDamageBonus: 0.10, attackAnim: 'Swing', recipe: { input: { abyss_sliver: 4, runite: 2, planks: 2 }, ticks: 65, research: 'abyss_smithing', station: 'enchanting_table' } },
    abyssal_piercer: { damage: 38, tier: 5, order: 28, attackCooldown: 2, attackAnim: 'Stab', armoredDamageBonus: 0.35, recipe: { input: { abyss_sliver: 3, runite: 3, iron: 1 }, ticks: 55, research: 'abyss_smithing', station: 'enchanting_table' } },
    abyssal_longbow: { damage: 44, tier: 5, order: 29, ranged: true, range: 10, projectileChar: '⟶', projectileColor: '#9900cc', skinKey: 'projectile_void', attackAnim: 'DrawAndShoot', recipe: { input: { abyss_sliver: 3, void_essence: 2, planks: 3 }, ticks: 58, research: 'abyss_smithing', station: 'enchanting_table' } },
    abyssal_dagger: { damage: 16, tier: 5, order: 30, attackCooldown: 2, spellDamageBonus: 0.58, attackAnim: 'Stab', recipe: { input: { abyss_sliver: 2, void_essence: 2, planks: 1 }, ticks: 50, research: 'abyss_smithing', station: 'enchanting_table' } },
    abyssal_staff: { damage: 40, tier: 5, order: 31, attackCooldown: 4, spellDamageBonus: 0.65, maxManaBonus: 25, spellCooldownReduction: 0.15, ranged: true, range: 8, projectileChar: '✦', projectileColor: '#9900cc', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', recipe: { input: { abyss_sliver: 4, void_essence: 2, planks: 2 }, ticks: 65, research: 'abyss_smithing', station: 'enchanting_table' } },
};
stampLoc(WEAPONS, 'item');

// `order` groups a set's pieces together within a tier in the crafting menu
// (the helmet/boots sharing the same number sit next to the matching body).
// It is a within-tier tiebreaker only. Tier remains the primary sort key.
// Helmets, armors, and boots share the "Armor" crafting category, so their
// order values interleave to keep matching sets adjacent.
export const ARMORS = {
    // ── Tier 1 ──
    leather_vest: { damageReduction: 0.10, tier: 1, order: 4, recipe: { input: { leather: 3 }, ticks: 18 } },
    padded_scout_vest: { damageReduction: 0.07, tier: 1, order: 5, dodgeChance: 0.05, recipe: { input: { leather: 2, cloth: 1 }, ticks: 16 } },
    iron_brigandine: { damageReduction: 0.12, tier: 1, order: 6, recipe: { input: { iron: 2 }, ticks: 14, research: 'metalworking', station: 'anvil' } },
    // ── Tier 2 ──
    iron_chainmail: { damageReduction: 0.16, tier: 2, order: 8, recipe: { input: { iron: 4, leather: 2 }, ticks: 30, research: 'metalworking', station: 'anvil' } },
    huntsmans_leathers: { damageReduction: 0.11, tier: 2, order: 12, critChance: 0.08, dodgeChance: 0.06, recipe: { input: { leather: 3, iron: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    barbed_chaincoat: { damageReduction: 0.14, tier: 2, order: 14, thornsDamage: 3, recipe: { input: { iron: 4, leather: 1 }, ticks: 28, research: 'metalworking', station: 'anvil' } },
    enchanted_tunic: { damageReduction: 0.12, tier: 2, order: 11, spellDamageBonus: 0.10, recipe: { input: { leather: 2, planks: 2, iron: 1 }, ticks: 24, research: 'arcane_infusion', station: 'enchanting_table' } },
    thornweave_vest: { damageReduction: 0.12, thornsDamage: 2, tier: 2, order: 13, recipe: { input: { cloth: 3, iron: 1, leather: 1 }, ticks: 22, research: 'textiles', station: 'loom' } },
    // ── Tier 3 ──
    runic_plate: { tradeValue: 48, damageReduction: 0.24, tier: 3, order: 15, recipe: { input: { runite: 3, iron: 2, leather: 1 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    channelers_wraps: { damageReduction: 0.16, tier: 3, order: 19, spellDamageBonus: 0.10, manaRegen: 0.06, recipe: { input: { runite: 2, leather: 2, iron: 1 }, ticks: 40, research: 'mana_weaving', station: 'enchanting_table' } },
    mana_weave_robe: { damageReduction: 0.18, tier: 3, order: 18, spellDamageBonus: 0.15, manaRegen: 0.05, recipe: { input: { runite: 2, leather: 2, iron: 1 }, ticks: 40, research: 'mana_weaving', station: 'enchanting_table' } },
    frostplate: { damageReduction: 0.20, coldResistance: 0.8, heatResistance: -0.3, tier: 3, order: 20, recipe: { input: { runite: 3, iron: 2, wool: 2 }, ticks: 44, research: 'runeforging', station: 'enchanting_table' } },
    duelists_silks: { tier: 3, order: 21, dodgeChance: 0.15, moveSpeedBonus: 0.1, recipe: { input: { cloth: 3, runite: 1, void_essence: 1 }, ticks: 34, research: 'mana_weaving', station: 'enchanting_table' } },
    shadowstrike_vest: { damageReduction: 0.14, tier: 3, order: 22, critChance: 0.12, dodgeChance: 0.10, recipe: { input: { runite: 2, leather: 2, cloth: 1 }, ticks: 38, research: 'mana_weaving', station: 'enchanting_table' } },
    foreman_apron: { damageReduction: 0.10, tier: 3, order: 24, workSpeedBonus: 0.15, craftingSpeed: 1.10, recipe: { input: { cloth: 3, runite: 1, leather: 1 }, ticks: 32, research: 'textiles', station: 'loom' } },
    living_bark_armor: { textColor: '#4488ff', tradeValue: 55, damageReduction: 0.30, tier: 3, order: 23, healthRegen: 0.07 },
    // ── Tier 4 ──
    void_armor: { damageReduction: 0.38, tier: 4, order: 27, recipe: { input: { void_essence: 5, runite: 2, iron: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    voidweave_robes: { damageReduction: 0.25, tier: 4, order: 28, spellDamageBonus: 0.25, recipe: { input: { void_essence: 4, runite: 2, cloth: 1 }, ticks: 55, research: 'void_weaving', station: 'enchanting_table' } },
    aether_mantle: { damageReduction: 0.20, tier: 4, order: 29, spellDamageBonus: 0.15, manaRegen: 0.08, recipe: { input: { void_essence: 4, runite: 2, leather: 1 }, ticks: 55, research: 'void_weaving', station: 'enchanting_table' } },
    shadow_wraps: { damageReduction: 0.06, tier: 4, order: 32, critChance: 0.18, dodgeChance: 0.20, recipe: { input: { void_essence: 3, runite: 1, cloth: 2 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    abyssal_bramble_plate: { damageReduction: 0.30, tier: 4, order: 34, thornsDamage: 5, recipe: { input: { void_essence: 4, runite: 3, iron: 1 }, ticks: 58, research: 'void_forging', station: 'enchanting_table' } },
    armor_of_the_abyss: { textColor: '#ff4444', tradeValue: 70, damageReduction: 0.45, tier: 4, order: 31, targetPriority: 10 },
    chaos_wrought_plate: { textColor: '#ff4444', tradeValue: 85, damageReduction: 0.35, tier: 4, order: 36, thornsDamage: 4, chaosResistance: 0.25, expedition: { partyDamageMult: 1.1, trapDamageMult: 1.15 } },
};
stampLoc(ARMORS, 'item');

// `order` mirrors the matching body armor's value so a helmet renders next to
// its set's chest piece within the tier (see ARMORS above).
export const HELMETS = {
    // ── Tier 1 ──
    wool_cap: { damageReduction: 0.02, tier: 1, order: 1, coldResistance: 0.4, moodBonus: 3, recipe: { input: { wool: 3 }, ticks: 10 } },
    cotton_cap: { damageReduction: 0.02, tier: 1, order: 2, coldResistance: 0.2, moodBonus: 2, recipe: { input: { cotton: 3 }, ticks: 10, research: 'textiles', station: 'loom' } },
    leather_cap: { damageReduction: 0.05, tier: 1, order: 3, recipe: { input: { leather: 2 }, ticks: 12 } },
    scouts_hood: { damageReduction: 0.03, tier: 1, order: 4, dodgeChance: 0.05, recipe: { input: { leather: 2 }, ticks: 12 } },
    // ── Tier 2 ──
    iron_helmet: { damageReduction: 0.08, tier: 2, order: 7, recipe: { input: { iron: 3 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    mages_circlet: { damageReduction: 0.06, tier: 2, order: 10, spellDamageBonus: 0.08, recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'arcane_implements', station: 'anvil' } },
    spiritweave_hat: { damageReduction: 0.05, tier: 2, order: 11, spellDamageBonus: 0.05, manaRegen: 0.04, recipe: { input: { cloth: 2, iron: 1, planks: 1 }, ticks: 20, research: 'arcane_implements', station: 'anvil' } },
    shadowweave_cowl: { damageReduction: 0.05, tier: 2, order: 13, dodgeChance: 0.08, critChance: 0.05, recipe: { input: { cloth: 2, leather: 1 }, ticks: 18, research: 'textiles', station: 'loom' } },
    scholars_spectacles: { textColor: '#4488ff', tradeValue: 45, damageReduction: 0.04, tier: 2, order: 25, workSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 2, skillGrowthBonus: 0.1 } },
    // ── Tier 3 ──
    runic_helm: { tradeValue: 38, damageReduction: 0.14, tier: 3, order: 14, recipe: { input: { runite: 2, iron: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    spiked_iron_coif: { damageReduction: 0.08, tier: 3, order: 16, thornsDamage: 2, recipe: { input: { runite: 1, iron: 2, leather: 1 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    runic_hood: { damageReduction: 0.10, tier: 3, order: 17, spellDamageBonus: 0.10, manaRegen: 0.03, recipe: { input: { runite: 2, leather: 1 }, ticks: 32, research: 'mana_weaving', station: 'enchanting_table' } },
    sharpshooters_visor: { damageReduction: 0.10, tier: 3, order: 19, critChance: 0.15, recipe: { input: { runite: 2, iron: 1, leather: 1 }, ticks: 34, research: 'marksmanship', station: 'enchanting_table' } },
    ironbark_hat: { damageReduction: 0.12, tier: 3, order: 24, healthRegen: 0.04, recipe: { input: { runite: 2, planks: 2 }, ticks: 34, research: 'runeforging', station: 'enchanting_table' } },
    runic_furskin_hood: { damageReduction: 0.10, tier: 3, order: 25, coldResistance: 0.60, moodBonus: 2, recipe: { input: { runite: 2, wool: 2 }, ticks: 32, research: 'runeforging', station: 'enchanting_table' } },
    mycelium_crown: { textColor: '#4488ff', tradeValue: 50, damageReduction: 0.08, tier: 3, order: 24, workSpeedBonus: 0.15, pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.15 }, expedition: { trapDamageMult: 0.6 } },
    // ── Tier 4 ──
    void_crown: { damageReduction: 0.18, tier: 4, order: 26, spellDamageBonus: 0.15, recipe: { input: { void_essence: 4, runite: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    voidpulse_circlet: { damageReduction: 0.15, tier: 4, order: 27, spellDamageBonus: 0.10, manaRegen: 0.10, recipe: { input: { void_essence: 3, runite: 2, cloth: 1 }, ticks: 50, research: 'void_weaving', station: 'enchanting_table' } },
    void_hunters_cowl: { damageReduction: 0.12, critChance: 0.18, tier: 4, order: 29, recipe: { input: { void_essence: 3, runite: 2, leather: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    void_dancers_mask: { damageReduction: 0.09, tier: 4, order: 33, dodgeChance: 0.18, critChance: 0.12, recipe: { input: { void_essence: 3, runite: 1, cloth: 1, leather: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    abyss_wardens_helm: { damageReduction: 0.22, tier: 4, order: 35, targetPriority: 5, recipe: { input: { void_essence: 3, runite: 2, iron: 2 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    void_sages_tiara: { damageReduction: 0.12, tier: 4, order: 36, workSpeedBonus: 0.20, skillGrowthBonus: 0.15, recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    unravelers_eye: { textColor: '#ff4444', damageReduction: 0.15, critChance: 0.12, tier: 4, order: 30, tradeValue: 90, expedition: { partyDamageMult: 1.15, trapDamageMult: 0.8 } },
    commanders_crown: { textColor: '#f944ff', tradeValue: 85, damageReduction: 0.25, tier: 4, order: 37, targetPriority: 8, expedition: { partyDamageMult: 1.15 } },
};
stampLoc(HELMETS, 'item');

export const CLOTHES = {
    // ── Tier 1 ──
    leather_cloak: { tier: 1, order: 0, coldResistance: 0.25, recipe: { input: { leather: 3 }, ticks: 14, station: 'workbench' } },
    cotton_shirt: { tier: 1, order: 1, coldResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.05, recipe: { input: { cloth: 3 }, ticks: 14, research: 'textiles', station: 'loom' } },
    wool_tunic: { tier: 1, order: 2, coldResistance: 0.5, moodBonus: 3, recipe: { input: { wool: 4, cloth: 1 }, ticks: 18, research: 'textiles', station: 'loom' } },
    cotton_tunic: { tier: 1, order: 3, coldResistance: 0.3, moodBonus: 2, recipe: { input: { cotton: 4 }, ticks: 18, research: 'textiles', station: 'loom' } },
    // ── Tier 2 ──
    leather_jerkin: { tier: 2, order: 4, coldResistance: 0.3, heatResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.1, recipe: { input: { leather: 3, cloth: 2 }, ticks: 24, research: 'textiles', station: 'loom' } },
    // ── Tier 3 ──
    ashwalkers_cloak: { tier: 3, order: 5, heatResistance: 0.7, coldResistance: -0.2, moodBonus: 2, recipe: { input: { leather: 3, cloth: 2, void_essence: 1 }, ticks: 26, research: 'mana_weaving', station: 'loom' } },
    mana_silk_vestments: { tier: 3, order: 6, coldResistance: 0.4, heatResistance: 0.3, moodBonus: 4, workSpeedBonus: 0.15, recipe: { input: { cloth: 3, runite: 1, moonbloom: 1 }, ticks: 32, research: 'mana_weaving', station: 'loom' } },
    cloak_of_shadows: { tier: 3, order: 7, textColor: '#4488ff', tradeValue: 45, targetPriority: -10 },
    berserkers_wraps: { tier: 3, order: 8, textColor: '#4488ff', tradeValue: 45, lowHpDamageBonus: 0.3 },
};
stampLoc(CLOTHES, 'item');

export const BOOTS = {
    // ── Tier 1 ──
    leather_boots: { moveSpeedBonus: 0.1, tier: 1, order: 5, recipe: { input: { leather: 2, planks: 1 }, ticks: 14 } },
    // ── Tier 2 ──
    iron_greaves: { moveSpeedBonus: 0.08, damageReduction: 0.05, tier: 2, order: 9, recipe: { input: { iron: 2, leather: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    enchanted_sandals: { moveSpeedBonus: 0.15, tier: 2, order: 12, recipe: { input: { cloth: 2, leather: 1, iron: 1 }, ticks: 22, research: 'mana_weaving', station: 'loom' } },
    // ── Tier 3 ──
    runic_striders: { moveSpeedBonus: 0.2, tier: 3, order: 16, recipe: { input: { runite: 2, leather: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    striders_greaves: { moveSpeedBonus: 0.12, dodgeChance: 0.06, tier: 3, order: 22, recipe: { input: { runite: 1, iron: 2, leather: 1 }, ticks: 22, research: 'runeforging', station: 'enchanting_table' } },
    // ── Tier 4 ──
    void_treads: { moveSpeedBonus: 0.35, damageReduction: 0.06, tier: 4, order: 28, recipe: { input: { void_essence: 3, runite: 1, leather: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    boots_of_haste: { textColor: '#4488ff', tradeValue: 55, moveSpeedBonus: 0.4, tier: 4, order: 30, expedition: { durationMult: 0.85 }, recipe: { input: { void_essence: 3, planks: 2, runite: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
};
stampLoc(BOOTS, 'item');

export const EQUIPMENT_OVERLAY_OFFSETS = {
    helmet: { offsetX: 0, offsetY: 0 },
    armor: { offsetX: 0, offsetY: 0 },
    clothes: { offsetX: 0, offsetY: 0 },
    weapon: { offsetX: 0, offsetY: 0 },
    tool: { offsetX: 0, offsetY: 0 },
    boots: { offsetX: 0, offsetY: 0 },
};

// Tool items can also include Offhand items that appear in the colonist's hand on their sprite.
export const TOOLS = {
    // ── Pickaxes (mining) ──
    stone_pickaxe: { miningSpeed: 1.25, tier: 1, order: 1, recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_pickaxe: { miningSpeed: 1.45, tier: 2, order: 2, recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_pickaxe: { miningSpeed: 1.7, tier: 3, order: 3, recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_pickaxe: { miningSpeed: 2.0, tier: 4, order: 4, recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Axes (chopping) ──
    stone_axe: { choppingSpeed: 1.25, tier: 1, order: 5, recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_axe: { choppingSpeed: 1.45, tier: 2, order: 6, recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_axe: { choppingSpeed: 1.7, tier: 3, order: 7, recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_axe: { choppingSpeed: 2.0, tier: 4, order: 8, recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Sickles (farming) ──
    stone_sickle: { farmingSpeed: 1.25, tier: 1, order: 9, recipe: { input: { stone: 1, planks: 1 }, ticks: 12 } },
    iron_sickle: { farmingSpeed: 1.45, tier: 2, order: 10, recipe: { input: { iron: 1, planks: 1 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    runic_sickle: { farmingSpeed: 1.7, tier: 3, order: 11, recipe: { input: { runite: 1, planks: 1 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    void_sickle: { farmingSpeed: 2.0, tier: 4, order: 12, recipe: { input: { void_essence: 3, runite: 1, planks: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    // ── Hammers (crafting) ──
    stone_hammer: { craftingSpeed: 1.25, tier: 1, order: 13, recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_hammer: { craftingSpeed: 1.45, tier: 2, order: 14, recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_hammer: { craftingSpeed: 1.7, tier: 3, order: 15, recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_hammer: { craftingSpeed: 2.0, tier: 4, order: 16, recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Mattocks (multi-purpose) ──
    stone_mattock: { miningSpeed: 1.15, choppingSpeed: 1.15, tier: 1, order: 17, recipe: { input: { stone: 3, planks: 2 }, ticks: 18 } },
    iron_mattock: { miningSpeed: 1.3, choppingSpeed: 1.3, tier: 2, order: 18, recipe: { input: { iron: 3, planks: 2 }, ticks: 26, research: 'metalworking', station: 'anvil' } },
    runic_mattock: { miningSpeed: 1.5, choppingSpeed: 1.5, tier: 3, order: 19, recipe: { input: { runite: 3, planks: 2 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    void_mattock: { miningSpeed: 1.7, choppingSpeed: 1.7, tier: 4, order: 20, recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Utility & offhand ──
    lantern: { lightRadius: 4, tier: 1, order: 21, recipe: { input: { iron: 1, planks: 2 }, ticks: 12, research: 'metalworking', station: 'anvil' } },
    iron_shield: { tradeValue: 15, tier: 1, order: 22, targetPriority: 5, damageReduction: 0.1, recipe: { input: { iron: 2, planks: 2 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    parrying_dagger: { tradeValue: 15, tier: 1, order: 23, dodgeChance: 0.08, moveSpeedBonus: 0.1, recipe: { input: { iron: 1, leather: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    hunters_quiver: { tradeValue: 15, tier: 1, order: 24, critChance: 0.05, attackSpeed: 0.05, recipe: { input: { iron: 1, leather: 1, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    bottomless_quiver: { textColor:'#44cc44', tradeValue: 50, tier: 2, order: 25, critChance: 0.1, attackSpeed: 0.1, recipe: { input: { runite: 1, leather: 2, planks: 1 }, ticks: 30, research: 'marksmanship', station: 'enchanting_table' } },
    runic_buckler: { tier: 3, order: 26, targetPriority: 5, damageReduction: 0.18, recipe: { input: { runite: 2, iron: 2, planks: 1 }, ticks: 38, research: 'runeforging', station: 'enchanting_table' } },
    drum_of_rallying: { textColor: '#4488ff', tradeValue: 50, tier: 3, order: 27, attackSpeed: 0.15, pedestal: { radius: 8, manaCost: 3, damageBonusMult: 1.15 }, expedition: { partyDamageMult: 1.15 }, recipe: { input: { wood: 6, runite: 2, planks: 3 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    // ── Drop-only pedestal/offhand items ──
    crystalline_hammer: { textColor: '#4488ff', tradeValue: 50, order: 28, workSpeedBonus: 0.35, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.2 } },
    heartwood_staff: { textColor: '#4488ff', tradeValue: 55, order: 29, spellDamageBonus: 0.3, pedestal: { radius: 7, manaCost: 3, skillGrowthBonus: 0.1 } },
    staff_of_regrowth: { textColor: '#4488ff', tradeValue: 45, order: 30, spellDamageBonus: 0.2, pedestal: { radius: 6, manaCost: 2, blightImmunity: true, blightDamageReduction: 0.5 } },
    staff_of_distortion: { textColor: '#f944ff', tradeValue: 60, order: 31, spellDamageBonus: 0.4, targetPriority: -5, expedition: { partyDamageMult: 1.2, trapDamageMult: 1.3 } },
    aegis_of_the_vanguard: { textColor: '#f944ff', tradeValue: 60, order: 32, targetPriority: 10, damageReduction: 0.3 },
    crystal_aegis: { textColor: '#f944ff', tradeValue: 60, order: 33, damageReduction: 0.28, thornsDamage: 2 },
};
stampLoc(TOOLS, 'item');

/*
textColor denotes an item's RARITY BAND (not derived from tradeValue). Bands,
low -> high rarity: grey -> green -> blue -> magenta -> red.
'#cccccc' grey    — common
'#44cc44' green   — uncommon
'#4488ff' blue    — rare
'#f944ff' magenta — epic
'#ff4444' red     — legendary

Trinket trade values are anchored to this band (+ tier), spanning 25 -> 120 so a
build-defining relic outvalues mid-tier gear. Per-band trinket targets:
  grey 25 · green 40–50 · blue 60–72 · magenta 85 · red 95–120.
(The pedestal/expedition artifacts defined above predate this scale and keep
their original 45–60 values; only the TRINKETS block below follows it.)
*/
export const TRINKETS = {
    // ── Tier 1 ──
    wanderers_rations_pouch: { textColor:'#cccccc', tradeValue: 25, tier: 1, order: 1, hungerDecayMult: 0.8, expedition: { fatigueMult: 0.70 }, recipe: { input: { leather: 2, planks: 1 }, ticks: 14 } },
    hearthstone_pendant: { textColor:'#cccccc', tradeValue: 25, tier: 1, order: 2, moodBonus: 4, coldResistance: 0.25, recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    sharpened_fang_necklace: { textColor:'#cccccc', tradeValue: 25, tier: 1, order: 3, thornsDamage: 3, bleedOnHit: { damage: 1, ticks: 4, interval: 10 }, recipe: { input: { stone: 1, leather: 2 }, ticks: 12 } },
    rabbits_paw: { textColor:'#cccccc', tradeValue: 18, tier: 1, order: 4, skillGrowthBonus: 0.04, expedition: { lootMult: 1.15 } },
    iron_clad_effigy: { textColor:'#cccccc', tradeValue: 28, tier: 1, order: 5, targetPriority: 2, damageReduction: 0.05, thornsDamage: 2 },
    // ── Tier 2: expedition → combat → utility/economy ──
    map_fragment: { textColor:'#cccccc', tradeValue: 25, tier: 2, order: 11, consumable: true, expedition: { durationMult: 0.7, lootMult: 1.4 } },
    compass_of_greed: { textColor:'#44cc44', tradeValue: 40, tier: 2, order: 12, expedition: { lootMult: 1.5, trapDamageMult: 1.2 }, recipe: { input: { iron: 2, runite: 1, hides: 1 }, ticks: 28, research: 'runeforging', station: 'enchanting_table' } },
    jewelers_loupe: { textColor:'#44cc44', tradeValue: 44, tier: 2, order: 13, expedition: { puzzleSuccessBonus: 0.4, xpMult: 1.2 } },
    venom_vial: { textColor:'#44cc44', tradeValue: 42, tier: 2, order: 14, poisonOnHit: { damage: 1, ticks: 5, interval: 10 }, expedition: { trapDamageMult: 0.9, partyDamageMult: 1.05 }, recipe: { input: { moonbloom: 3, leather: 1, planks: 1 }, ticks: 25, research: 'herbalism', station: 'alchemy_table' } },
    burnished_relic: { textColor:'#44cc44', tradeValue: 44, tier: 2, order: 15, farmingSpeed: 1.1, pedestal: { radius: 6, manaCost: 2, harvestYieldBonus: 1 }, recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    emberstep_anklet: { textColor:'#44cc44', tradeValue: 42, tier: 2, order: 16, coldResistance: 0.4, moveSpeedBonus: 0.12, moodBonus: 2 },
    jesters_bauble: { textColor:'#44cc44', tradeValue: 40, tier: 2, order: 17, moodBonus: 8, pedestal: { radius: 5, manaCost: 1, moodBonus: 4 }, recipe: { input: { planks: 2, cloth: 1, iron: 1 }, ticks: 18, research: 'textiles', station: 'loom' } },
    hagglers_coin: { textColor:'#44cc44', tradeValue: 48, tier: 2, order: 18, moodBonus: 3, pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.85 } },
    merchants_ring: { textColor:'#44cc44', tradeValue: 40, tier: 2, order: 19, moodBonus: 2, workSpeedBonus: 0.06, pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.88 } },
    cornucopia_charm: { textColor:'#44cc44', tradeValue: 48, tier: 2, order: 20, hungerDecayMult: 0.85, pedestal: { radius: 'global', manaCost: 1, cookingBonusFood: 1 }, recipe: { input: { wheat: 3, berries: 2, planks: 2 }, ticks: 28, research: 'alchemy', station: 'cooking_pot' } },
    amulet_of_fortune: { textColor:'#44cc44', tradeValue: 50, tier: 2, order: 21, skillGrowthBonus: 0.10, pedestal: { radius: 'global', manaCost: 1, skillGrowthBonus: 0.2 } },
    // ── Tier 3: combat ──
    ghost_step_charm: { textColor:'#4488ff', tradeValue: 65, tier: 3, order: 31, dodgeChance: 0.20, recipe: { input: { cloth: 2, runite: 1, void_essence: 1 }, ticks: 38, research: 'mana_weaving', station: 'enchanting_table' } },
    bloodstone_gauntlet: { textColor:'#4488ff', tradeValue: 68, tier: 3, order: 32, lifeSteal: 0.12, expedition: { partyDamageMult: 1.05 }, recipe: { input: { runite: 2, iron: 1, hides: 1 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    sanguine_fang: { textColor:'#4488ff', tradeValue: 66, tier: 3, order: 33, lifeSteal: 0.10, bleedOnHit: { damage: 2, ticks: 4, interval: 10 } },
    strikers_band: { textColor:'#4488ff', tradeValue: 62, tier: 3, order: 34, moveSpeedBonus: 0.1, postMoveAttackBonus: 0.20, critChance: 0.05, dodgeChance: 0.10, recipe: { input: { runite: 2, leather: 2, planks: 1 }, ticks: 36, research: 'runeforging', station: 'enchanting_table' } },
    blight_seedpod: { textColor:'#4488ff', tradeValue: 60, tier: 3, order: 35, poisonImmunity: true, thornsDamage: 4 },
    rune_of_splitting: { textColor:'#4488ff', tradeValue: 64, tier: 3, order: 36, armoredDamageBonus: 0.20, pedestal: { radius: 6, manaCost: 2, armoredDamageBonus: 0.10 }, recipe: { input: { runite: 2, iron: 2, planks: 1 }, ticks: 36, research: 'runeforging', station: 'enchanting_table' } },
    ward_of_the_sentinel: { textColor:'#f944ff', tradeValue: 85, tier: 4, order: 75, autoReviveHp: 0.5, durability: { max: 1, breakOnUse: true }, recipe: { input: { void_essence: 4, runite: 3, stone: 2 }, ticks: 65, research: 'void_forging', station: 'enchanting_table' } },
    // ── Tier 3: expedition ──
    rallying_standard: { textColor:'#4488ff', tradeValue: 62, tier: 3, order: 41, pedestal: { radius: 6, manaCost: 1, moodBonus: 4 }, expedition: { rallyChance: 0.25, rallyHeal: 0.12 } },
    warlords_banner: { textColor:'#4488ff', tradeValue: 72, tier: 3, order: 42, expedition: { partyDamageMult: 1.2, rallyChance: 0.15, rallyHeal: 0.08 } },
    expedition_spellbook: { textColor:'#4488ff', tradeValue: 66, tier: 3, order: 43, skillGrowthBonus: 0.05, expedition: { spellDamageMult: 1.3 }, recipe: { input: { runite: 2, planks: 3, moonbloom: 1 }, ticks: 40, research: 'arcane_studies', station: 'scriptorium' } },
    arcane_amplifier: { textColor:'#4488ff', tradeValue: 65, tier: 3, order: 44, spellDamageBonus: 0.25, expedition: { partyDamageMult: 1.1 } },
    voidwalkers_lantern: { textColor:'#4488ff', tradeValue: 60, tier: 3, order: 45, expedition: { rareEncounterMult: 2.0 }, pedestal: { radius: 6, manaCost: 2, lightRadius: 4, manaRegen: 0.05 } },
    // ── Tier 3: economy/utility ──
    hourglass_of_diligence: { textColor:'#4488ff', tradeValue: 65, tier: 3, order: 51, workSpeedBonus: 0.25, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.15 }, recipe: { input: { iron: 2, runite: 2, planks: 2 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    tome_of_shared_wisdom: { textColor:'#4488ff', tradeValue: 65, tier: 3, order: 52, skillGrowthBonus: 0.12, pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.1 }, recipe: { input: { planks: 4, runite: 2, moonbloom: 1 }, ticks: 42, research: 'arcane_studies', station: 'scriptorium' } },
    abundance_charm: { textColor:'#4488ff', tradeValue: 65, tier: 3, order: 53, workSpeedBonus: 0.15, pedestal: { radius: 5, manaCost: 2, craftOutputBonus: 1 } },
    lodestone_of_prosperity: { textColor:'#44cc44', tradeValue: 50, tier: 3, order: 54, moodBonus: 3, pedestal: { radius: 'global', manaCost: 2, wandererChanceMult: 1.15, traderChanceMult: 1.15 }, recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    seedkeepers_locket: { textColor:'#4488ff', tradeValue: 72, tier: 3, order: 55, pedestal: { radius: 8, manaCost: 1, blightImmunity: true, blightBloomDamage: 2 }, expedition: { trapDamageMult: 0.7 } },
    warden_censer: { textColor:'#4488ff', tradeValue: 68, tier: 3, order: 56, healthRegen: 0.08, pedestal: { radius: 6, manaCost: 2, healthRegen: 0.06 }, recipe: { input: { runite: 2, moonbloom: 3, planks: 2 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    ley_battery: { textColor:'#4488ff', tradeValue: 70, tier: 3, order: 57, manaRegen: 0.08, spellCostReduction: 0.12, recipe: { input: { runite: 2, moonbloom: 2, void_essence: 1 }, ticks: 42, research: 'void_sorcery', station: 'enchanting_table' } },
    // ── Tier 3: school-focused trinkets ──
    // Each pushes ONE school hard via a `<school>Bonus` stat (read alongside the
    // generic spellDamageBonus by getEquipmentSchoolBonus), rewarding a colonist
    // who commits to that school. A couple also carry non-damage spell stats
    // (spellHealBonus, spellDurationBonus, spellCooldownReduction) so gear can
    // amplify heals/buffs/recast rate, not just damage.
    ember_sigil: { textColor:'#ff6644', tradeValue: 68, tier: 3, order: 61, evocationBonus: 0.4, recipe: { input: { runite: 2, void_essence: 1, planks: 2 }, ticks: 40, research: 'void_sorcery', station: 'enchanting_table' } },
    verdant_talisman: { textColor:'#88ff88', tradeValue: 62, tier: 3, order: 62, transmutationBonus: 0.35, spellDurationBonus: 0.25, recipe: { input: { moonbloom: 3, runite: 1, planks: 2 }, ticks: 40, research: 'advanced_arcana', station: 'enchanting_table' } },
    healers_pendant: { textColor:'#44ff44', tradeValue: 66, tier: 3, order: 63, abjurationBonus: 0.3, spellHealBonus: 0.3, recipe: { input: { moonbloom: 3, runite: 2, planks: 1 }, ticks: 42, research: 'advanced_arcana', station: 'enchanting_table' } },
    charmweave_band: { textColor:'#88ffff', tradeValue: 60, tier: 3, order: 64, enchantmentBonus: 0.3, spellDurationBonus: 0.3, recipe: { input: { runite: 2, leather: 2, moonbloom: 1 }, ticks: 38, research: 'advanced_arcana', station: 'enchanting_table' } },
    summoners_focus: { textColor:'#9966ff', tradeValue: 74, tier: 3, order: 65, conjurationBonus: 0.35, spellCooldownReduction: 0.2, recipe: { input: { void_essence: 2, runite: 2, planks: 1 }, ticks: 44, research: 'void_sorcery', station: 'enchanting_table' } },
    seers_eye: { textColor:'#ccaaff', tradeValue: 70, tier: 3, order: 66, spellDurationBonus: 0.25, spellCooldownReduction: 0.25, recipe: { input: { moonbloom: 2, void_essence: 2, planks: 1 }, ticks: 44, research: 'advanced_arcana', station: 'enchanting_table' } },
    stitched_poppet: { textColor:'#4488ff', tradeValue: 68, tier: 3, order: 67, summonHpBonus: 0.45, summonDamageBonus: 0.2, summonDurationBonus: 0.3, recipe: { input: { cloth: 3, runite: 1, moonbloom: 1 }, ticks: 38, research: 'advanced_arcana', station: 'enchanting_table' } },
    // ── Tier 4 ──
    void_charm: { textColor:'#ff4444', tradeValue: 95, tier: 4, order: 71, targetPriority: 5, damageReduction: 0.1, expedition: { partyDamageMult: 1.25 } },
    shard_of_oblivion: { textColor:'#ff4444', tradeValue: 95, tier: 4, order: 72, targetPriority: 5, expedition: { partyDamageMult: 1.4, trapDamageMult: 1.3 } },
    dimensional_orb: { textColor:'#ff4444', tradeValue: 105, tier: 4, order: 73, expedition: { durationMult: 0.6, rareEncounterMult: 2.5 }, pedestal: { radius: 'global', manaCost: 3, skillGrowthBonus: 0.25 } },
    voidheart: { textColor:'#ff4444', tradeValue: 120, tier: 4, order: 74, spellDamageBonus: 0.5, moveSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 4, damageBonusMult: 1.2 } },
    void_contract: { textColor:'#ff4444', tradeValue: 100, tier: 4, order: 77, voidEssenceGainMult: 1.35, spellDamageBonus: 0.2, expedition: { partyDamageMult: 1.05 } },
    arbiters_ledger: { textColor:'#f944ff', tradeValue: 85, tier: 4, order: 78, expedition: { puzzleSuccessBonus: 0.4, lootMult: 1.3 } },
    chaos_shard: { textColor:'#ff4444', tradeValue: 95, tier: 4, order: 79, chaosResistance: 0.3, spellDamageBonus: 0.15, expedition: { partyDamageMult: 1.25 } },
};
stampLoc(TRINKETS, 'item');

export const POTIONS = {
    health_potion: { trigger: 'lowHealth', hpThreshold: 0.4, effect: 'heal', healAmount: 50, cooldown: 30, recipe: { input: { berries: 3, wheat: 1 }, skill: 'cooking', ticks: 16, station: 'alchemy_table', research: 'alchemy' } },
    speed_potion: { trigger: 'hasTask', effect: 'speed', moveSpeedBonus: 0.5, workSpeedBonus: 0.3, duration: 100, cooldown: 400, recipe: { input: { corn: 2, potatoes: 2, berries: 1 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'alchemy' } },
    mana_potion: { trigger: 'lowMana', manaThreshold: 0.3, effect: 'restoreMana', manaAmount: 30, cooldown: 300, recipe: { input: { moonbloom: 3, runite: 1 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'herbalism' } },
    resistance_potion: { trigger: 'inCombat', effect: 'resistance', damageReduction: 0.25, duration: 80, cooldown: 500, recipe: { input: { moonbloom: 2, stone: 2, iron: 1 }, skill: 'cooking', ticks: 25, station: 'alchemy_table', research: 'herbalism' } },
    vitality_brew: { trigger: 'inCombat', effect: 'healthRegen', regenPerTick: 2, duration: 120, cooldown: 450, recipe: { input: { berries: 2, wheat: 2, iron: 1 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'alchemy' } },
    morale_tonic: { trigger: 'lowMood', moodThreshold: 35, effect: 'mood', moodBonus: 20, duration: 200, cooldown: 600, recipe: { input: { berries: 3, corn: 2 }, skill: 'cooking', ticks: 18, station: 'alchemy_table', research: 'alchemy' } },
    warmth_elixir: { trigger: 'coldSeason', effect: 'warmth', coldResistanceBonus: 0.4, duration: 200, cooldown: 500, recipe: { input: { berries: 2, iron: 1, wheat: 2 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'domestic_alchemy' } },
    blight_ward: { trigger: 'farming', effect: 'blightWard', duration: 150, cooldown: 600, recipe: { input: { moonbloom: 2, stone: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'domestic_alchemy' } },
    scholars_draught: { trigger: 'isStudying', effect: 'scholarship', skillGrowthBonus: 0.4, researchSpeedBonus: 0.25, duration: 100, cooldown: 500, recipe: { input: { moonbloom: 2, wheat: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'domestic_alchemy' } },
    focus_brew: { trigger: 'isCrafting', effect: 'focus', craftSpeedBonus: 0.3, duration: 120, cooldown: 400, recipe: { input: { corn: 2, moonbloom: 1 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'domestic_alchemy' } },
    // Expedition-only potions (no trigger here, never auto-used in the main game).
    antidote: { expeditionOnly: true, recipe: { input: { moonbloom: 2, berries: 2 }, skill: 'cooking', ticks: 18, station: 'alchemy_table', research: 'herbalism' } },
    battle_tonic: { expeditionOnly: true, recipe: { input: { iron: 1, corn: 2, potatoes: 2 }, skill: 'cooking', ticks: 24, station: 'alchemy_table', research: 'battle_brewing' } },
    smoke_draught: { expeditionOnly: true, recipe: { input: { moonbloom: 2, stone: 1, berries: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'battle_brewing' } },
    lifesteal_elixir: { expeditionOnly: true, recipe: { input: { moonbloom: 2, iron: 1, runite: 1 }, skill: 'cooking', ticks: 26, station: 'alchemy_table', research: 'battle_brewing' } },
    loot_elixir: { expeditionOnly: true, recipe: { input: { moonbloom: 3, runite: 2, berries: 2 }, skill: 'cooking', ticks: 30, station: 'alchemy_table', research: 'battle_brewing' } },
    rally_brew: { expeditionOnly: true, recipe: { input: { moonbloom: 2, wheat: 2, berries: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'battle_brewing' } },
    mana_surge: { expeditionOnly: true, recipe: { input: { moonbloom: 3, runite: 1 }, skill: 'cooking', ticks: 24, station: 'alchemy_table', research: 'battle_brewing' } },
};
stampLoc(POTIONS, 'item');

export const CONSUMABLES = {
    crystal_capacitor: { char: '◆', charColor: '#aa44ff', tradeValue: 65 },
};
stampLoc(CONSUMABLES, 'item');

export const ITEM_CHARS = {
    weapon: { char: '/', color: '#cccccc' },
    armor: { char: '[', color: '#6688cc' },
    helmet: { char: '^', color: '#7799cc' },
    clothes: { char: '♦', color: '#cc8866' },
    boots: { char: '∟', color: '#aa8855' },
    tool: { char: '\\', color: '#bb8844' },
    trinket: { char: '*', color: '#cc44ff' },
    potion: { char: '!', color: '#44cc44' },
    tome: { char: '~', color: '#4488ff' },
    consumable: { char: '◆', color: '#aa44ff' },
};

export const WEAPON_ENCHANTMENT_EFFECTS = {
    sharpness: { damageMultiplier: 1.15 },
    witchery: { spellDamageBonus: 0.15 },
    piercing: { critChance: 0.15 },
    vampirism: { lifeSteal: 0.15 },
    // distance: { suffix: 'of Distance', description: 'Enchanted with distance, increasing attack range by 15% per enchantment tier, even for melee weapons.', attackRangeMultiplier: 1.15 },
    // velocity { suffix: 'of Velocity', description: 'Enchanted with velocity, increasing attack speed by 15% per enchantment tier.', attackSpeed: 0.15 },
    // greed { suffix: 'of Greed', description: 'Enchanted with greed, increasing exploration loot rarity by 15% per enchantment tier.', lootRarityMultiplier: 1.15 },
};

export const ARMOR_ENCHANTMENT_EFFECTS = {
    protection: { defenseMultiplier: 1.15 },
    wisdom: { manaRegenBonus: 0.15 },
    barbs: { thornsDamage: 0.15 },
    // free_movement { suffix: 'of Free Movement', description: 'Enchanted with free movement, increasing movement and exploration speed by 10% per enchantment tier.', moveSpeedBonus: 0.10 },
    // dodgeChance { suffix: 'of Barbs', description: 'Enchanted with barbs, increasing dodge chance by 10% per enchantment tier.', dodgeChance: 0.10 },
};

export const CLOTHES_ENCHANTMENT_EFFECTS = {
    wisdom: { manaRegenBonus: 0.15 },
    barbs: { thornsDamage: 0.15 },
    productivity: { workSpeedBonus: 0.15 },
    renewal: { healthRegenBonus: 0.15 },
};

export const TOOL_ENCHANTMENT_EFFECTS = {
    productivity: { workSpeedBonus: 0.15 },
    renewal: { healthRegenBonus: 0.15 },
    // windfall: { suffix: 'of Windfall', description: 'Enchanted with windfall, increasing materials gained while gathering by 20% per enchantment tier.', gatheringMatMultiplier: 1.20 },
    // spellCostReduction
};

export const BOOTS_ENCHANTMENT_EFFECTS = {
    swiftness: { moveSpeedBonus: 0.10 },
};

stampLoc(WEAPON_ENCHANTMENT_EFFECTS, 'enchant.weapon');
stampLoc(ARMOR_ENCHANTMENT_EFFECTS, 'enchant.armor');
stampLoc(CLOTHES_ENCHANTMENT_EFFECTS, 'enchant.clothes');
stampLoc(TOOL_ENCHANTMENT_EFFECTS, 'enchant.tool');
stampLoc(BOOTS_ENCHANTMENT_EFFECTS, 'enchant.boots');

// Unified item registry. Every non-stackable item with its type and optional tradeValue.
// Built by merging all item dicts. SPELL_TOMES are merged in config/index.js after import.
export const ALL_ITEMS = {};

const _ITEM_SOURCES = [
    ['weapon',     WEAPONS],
    ['armor',      ARMORS],
    ['helmet',     HELMETS],
    ['clothes',    CLOTHES],
    ['boots',      BOOTS],
    ['tool',       TOOLS],
    ['trinket',    TRINKETS],
    ['potion',     POTIONS],
    ['material',   MATERIALS],
    ['consumable', CONSUMABLES],
];
for (const [type, dict] of _ITEM_SOURCES) {
    for (const [key, def] of Object.entries(dict)) {
        ALL_ITEMS[key] = { ...def, type };
    }
}

// MERCHANTS moved to ./trade.js (still re-exported via index.js).

const EQUIPMENT_RECIPE_SOURCES = [
    { items: WEAPONS, category: 'Weapons', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: HELMETS, category: 'Armor', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: ARMORS, category: 'Armor', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: CLOTHES, category: 'Clothing', prefix: 'craft_', defaults: { skill: 'crafting', station: 'loom' } },
    { items: BOOTS, category: 'Armor', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: TOOLS, category: 'Tools', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: TRINKETS, category: 'Trinkets', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },
    { items: POTIONS, category: 'Food & Potions', prefix: 'brew_', defaults: { skill: 'cooking', station: 'alchemy_table' } },
];

export const RECIPES = {};

for (const [key, mat] of Object.entries(MATERIALS)) {
    if (!mat.recipe) continue;
    const r = mat.recipe;
    RECIPES[`${r.prefix || 'craft_'}${key}`] = {
        input: r.input, output: { [key]: r.output },
        skill: 'crafting', ticks: r.ticks, station: r.station || 'workbench', category: 'Materials',
        ...(r.research ? { research: r.research } : {}),
    };
}

Object.assign(RECIPES, BASE_RECIPES);

for (const { items, category, prefix, defaults } of EQUIPMENT_RECIPE_SOURCES) {
    for (const [key, item] of Object.entries(items)) {
        if (!item.recipe) continue;
        const r = item.recipe;
        RECIPES[`${prefix}${key}`] = {
            input: r.input, output: { [key]: 1 },
            skill: r.skill || defaults.skill, ticks: r.ticks,
            station: r.station || defaults.station, category,
            ...(r.research ? { research: r.research } : {}),
        };
    }
}

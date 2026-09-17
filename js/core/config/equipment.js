export const RECIPE_CATEGORIES = ['Materials', 'Weapons', 'Armor', 'Clothing', 'Tools', 'Trinkets', 'Food & Potions', 'Tomes'];

export const MATERIALS = {
    wood: { name: 'Wood'},
    stone: { name: 'Stone'},
    food: { name: 'Food'},
    meat: { name: 'Meat'},
    wheat: { name: 'Wheat'},
    berries: { name: 'Berries'},
    corn: { name: 'Corn'},
    potatoes: { name: 'Potatoes'},
    moonbloom: { name: 'Moonbloom'},
    hides: { name: 'Hides'},
    iron_ore: { name: 'Iron Ore'},
    runite: { name: 'Runite'},
    eggs: { name: 'Eggs'},
    milk: { name: 'Milk'},
    wool: { name: 'Wool'},
    cotton: { name: 'Cotton'},
    void_essence: { name: 'Void Essence'},
    gold: { name: 'Gold' },
    planks: { name: 'Planks', recipe: { input: { wood: 2 }, output: 3, ticks: 10, prefix: 'craft_' } },
    bricks: { name: 'Bricks', recipe: { input: { stone: 2 }, output: 3, ticks: 12, prefix: 'craft_' } },
    iron: { name: 'Iron', recipe: { input: { iron_ore: 2 }, output: 2, ticks: 12, prefix: 'smelt_', research: 'metalworking', station: 'anvil' } },
    leather: { name: 'Leather', recipe: { input: { hides: 2 }, output: 2, ticks: 10, prefix: 'tan_' } },
    cloth: { name: 'Cloth', recipe: { input: { cotton: 2 }, output: 3, ticks: 10, prefix: 'weave_', research: 'textiles', station: 'loom' } },
};

const BASE_RECIPES = {
    repair_trinket: { input: { runite: 1 }, output: {}, skill: 'crafting', ticks: 40, station: 'anvil', category: 'Materials', special: 'repair' },
    cook_meal: { input: { foodstuffs: 5 }, output: { food: 4 }, skill: 'cooking', ticks: 8, station: 'cooking_pot', category: 'Food & Potions' },

    // Evocation
    craft_tome_of_spark: { input: { planks: 2, stone: 1 }, output: { tome_of_spark: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_smite: { input: { planks: 2, runite: 1, iron: 1 }, output: { tome_of_smite: 1 }, skill: 'crafting', ticks: 20, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_magic_missile: { input: { planks: 3, runite: 1 }, output: { tome_of_magic_missile: 1 }, skill: 'crafting', ticks: 30, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_fireball: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_fireball: 1 }, skill: 'crafting', ticks: 50, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Abjuration
    craft_tome_of_mend: { input: { planks: 2, berries: 2 }, output: { tome_of_mend: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_renewal: { input: { planks: 4, runite: 2, berries: 3 }, output: { tome_of_renewal: 1 }, skill: 'crafting', ticks: 40, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_shield: { input: { planks: 4, runite: 3, stone: 3 }, output: { tome_of_shield: 1 }, skill: 'crafting', ticks: 45, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Enchantment
    craft_tome_of_quicken: { input: { planks: 2, stone: 1 }, output: { tome_of_quicken: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_haste: { input: { planks: 4, runite: 2 }, output: { tome_of_haste: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },

    // Conjuration
    craft_tome_of_phase_step: { input: { planks: 2, stone: 1 }, output: { tome_of_phase_step: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_summon_familiar: { input: { planks: 2, wheat: 2 }, output: { tome_of_summon_familiar: 1 }, skill: 'crafting', ticks: 55, station: 'workbench', category: 'Tomes' },
    craft_tome_of_warp: { input: { planks: 4, runite: 2, void_essence: 1 }, output: { tome_of_warp: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_summon_ghost: { input: { planks: 4, runite: 2, void_essence: 1 }, output: { tome_of_summon_ghost: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_gate: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_gate: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_summon_monster: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_summon_monster: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Transmutation
    craft_tome_of_nurture: { input: { planks: 2, wheat: 2 }, output: { tome_of_nurture: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_circle_of_growth: { input: { planks: 4, runite: 2, wheat: 3 }, output: { tome_of_circle_of_growth: 1 }, skill: 'crafting', ticks: 40, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_level_field: { input: { planks: 5, runite: 4, void_essence: 3 }, output: { tome_of_level_field: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

    // Divination
    craft_tome_of_foresight: { input: { planks: 2, berries: 1 }, output: { tome_of_foresight: 1 }, skill: 'crafting', ticks: 12, station: 'workbench', category: 'Tomes' },
    craft_tome_of_fair_winds: { input: { planks: 3, runite: 1 }, output: { tome_of_fair_winds: 1 }, skill: 'crafting', ticks: 20, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_merchants_omen: { input: { planks: 4, runite: 2 }, output: { tome_of_merchants_omen: 1 }, skill: 'crafting', ticks: 25, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_ward_of_calamity: { input: { planks: 5, runite: 3, void_essence: 2 }, output: { tome_of_ward_of_calamity: 1 }, skill: 'crafting', ticks: 50, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
    craft_tome_of_fortunate_discovery: { input: { planks: 5, runite: 4, void_essence: 3 }, output: { tome_of_fortunate_discovery: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },
};

export const WEAPONS = {
    // ── Tier 0 ──
    fists: { name: 'Fists', damage: 5, tier: 0, order: 1, attackAnim: 'Swing', description: 'Bare fists.' },
    // ── Tier 1: melee → ranged → magic ──
    stone_spear: { name: 'Stone Spear', damage: 7, tier: 1, order: 2, attackCooldown: 2, critChance: 0.15, attackAnim: 'Stab', description: 'A sharpened stone lashed to a stick. Attacks quickly and precisely, with a chance to land a critical hit.', recipe: { input: { stone: 2, wood: 1 }, ticks: 12 } },
    wooden_club: { name: 'Wooden Club', damage: 11, tier: 1, order: 3, attackAnim: 'Swing', description: 'A heavy wooden bludgeon. High raw damage, no tricks.', recipe: { input: { wood: 2, planks: 1 }, ticks: 15 } },
    short_bow: { name: 'Short Bow', damage: 7, tier: 1, order: 4, ranged: true, range: 5, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', description: 'A simple short-range bow.', recipe: { input: { wood: 3, leather: 1 }, ticks: 14 } },
    wooden_wand: { name: 'Wooden Wand', damage: 3, tier: 1, order: 5, attackCooldown: 2, spellDamageBonus: 0.2, ranged: true, range: 5, projectileChar: '·', projectileColor: '#aaccff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A basic wand for aspiring mages. Attacks quickly.', recipe: { input: { wood: 3, planks: 1 }, ticks: 12, research: 'arcane_implements' } },
    // ── Tier 2: melee → ranged → magic ──
    iron_sword: { name: 'Iron Sword', tradeValue: 28, damage: 15, tier: 2, order: 6, attackAnim: 'Swing', description: 'A reliable iron blade.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    etched_axe: { name: 'Etched Axe', damage: 16, tier: 2, order: 7, attackAnim: 'Swing', description: 'An axe inscribed with runes of sharpness.', recipe: { input: { iron: 2, planks: 1, stone: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    etched_mace: { name: 'Etched Mace', damage: 16, tier: 2, order: 8, attackAnim: 'Swing', description: 'A heavy mace with runes that make it heavier.', recipe: { input: { iron: 3, planks: 1 }, ticks: 24, research: 'metalworking', station: 'anvil' } },
    poison_tipped_spear: { name: 'Poison-tipped Spear', damage: 9, tier: 2, order: 9, attackCooldown: 2, attackAnim: 'Stab', poisonOnHit: { damage: 1, ticks: 6, interval: 10 }, description: 'A spear coated in toxin. Applies poison on hit.', recipe: { input: { stone: 2, wood: 1, moonbloom: 2 }, ticks: 20, research: 'herbalism' } },
    hunting_bow: { name: 'Hunting Bow', damage: 10, tier: 2, order: 10, ranged: true, range: 6, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', description: 'A sturdy bow made for hunting.', recipe: { input: { planks: 2, leather: 2, iron: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    iron_crossbow: { name: 'Iron Crossbow', tradeValue: 38, damage: 22, tier: 2, order: 11, attackCooldown: 5, ranged: true, range: 7, projectileChar: '→', projectileColor: '#aaddff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', description: 'A mechanical crossbow with iron bolts. Slow but powerful.', recipe: { input: { iron: 3, planks: 2, leather: 1 }, ticks: 30, research: 'marksmanship', station: 'anvil' } },
    crystal_staff: { name: 'Crystal Staff', damage: 8, tier: 2, order: 12, spellDamageBonus: 0.35, ranged: true, range: 6, projectileChar: '✦', projectileColor: '#88ddff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A staff topped with a focusing crystal.', recipe: { input: { iron: 2, planks: 2, runite: 1 }, ticks: 28, research: 'arcane_implements', station: 'anvil' } },
    // ── Tier 3: melee → ranged → magic → drop-only ──
    enchanted_glaive: { name: 'Enchanted Glaive', damage: 18, tier: 3, order: 13, spellDamageBonus: 0.25, attackAnim: 'Swing', description: 'A long blade humming with arcane energy.', recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 38, research: 'mana_weaving', station: 'enchanting_table' } },
    runic_blade: { name: 'Runic Blade', tradeValue: 45, damage: 22, tier: 3, order: 14, attackAnim: 'Swing', description: 'A blade etched with powerful runes.', recipe: { input: { runite: 2, planks: 1 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    barbed_blade: { name: 'Barbed Blade', damage: 18, tier: 3, order: 15, attackAnim: 'Swing', bleedOnHit: { damage: 2, ticks: 5, interval: 8 }, description: 'A serrated blade with deep barbs. Causes bleeding wounds.', recipe: { input: { runite: 2, iron: 1, planks: 1 }, ticks: 38, research: 'runeforging', station: 'enchanting_table' } },
    sweeping_glaive: { name: 'Sweeping Glaive', damage: 20, tier: 3, order: 16, attackCooldown: 4, attackAnim: 'Swing', cleave: true, description: 'A long-bladed glaive. Strikes in a wide arc, hitting all adjacent foes.', recipe: { input: { runite: 2, iron: 2, planks: 2 }, ticks: 42, research: 'runeforging', station: 'enchanting_table' } },
    runic_crossbow: { name: 'Runic Crossbow', damage: 30, tier: 3, order: 17, attackCooldown: 5, ranged: true, range: 8, projectileChar: '→', projectileColor: '#bb99ff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', description: 'A crossbow enhanced with runic power. Slow but devastating.', recipe: { input: { runite: 3, iron: 2, planks: 2 }, ticks: 42, research: 'runeforging', station: 'enchanting_table' } },
    runic_wand: { name: 'Runic Wand', damage: 7, tier: 3, order: 18, attackCooldown: 2, spellDamageBonus: 0.5, ranged: true, range: 7, projectileChar: '·', projectileColor: '#dd88ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A wand inscribed with potent spell-amplifying runes. Attacks quickly.', recipe: { input: { runite: 2, planks: 2 }, ticks: 35, research: 'void_sorcery', station: 'enchanting_table' } },
    frostfang_wand: { name: 'Frostfang Wand', damage: 6, tier: 3, order: 19, attackCooldown: 2, spellDamageBonus: 0.4, evocationBonus: 0.25, ranged: true, range: 6, projectileChar: '❄', projectileColor: '#88eeff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', onHit: { effect: 'slow', moveSpeedMalus: -0.3, attackSlowMult: 0.6, duration: 40, rounds: 1 }, description: 'A wand that crackles with frost. Amplifies Evocation spells and slows targets on hit.', recipe: { input: { runite: 2, void_essence: 1, planks: 2 }, ticks: 40, research: 'void_sorcery', station: 'enchanting_table' } },
    ashen_staff: { name: 'Ashen Staff', damage: 10, tier: 3, order: 20, spellDamageBonus: 0.3, evocationBonus: 0.15, ranged: true, range: 6, projectileChar: '🔥', projectileColor: '#ff6622', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', burnOnHit: { damage: 2, ticks: 4, interval: 10 }, description: 'A staff smouldering with inner fire. Burns targets on hit.', tradeValue: 50, textColor: '#4488ff' },
    soulbond_scepter: { name: 'Soulbond Scepter', damage: 8, tier: 3, order: 21, spellDamageBonus: 0.2, conjurationBonus: 0.3, summonHpBonus: 0.25, ranged: true, range: 5, projectileChar: '✦', projectileColor: '#9966ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A scepter bound to the spirit realm. Strengthens summoned allies.', tradeValue: 55, textColor: '#4488ff' },
    // ── Tier 4: melee → ranged → magic ──
    void_blade: { name: 'Void Blade', damage: 52, tier: 4, order: 22, attackCooldown: 5, attackAnim: 'Swing', description: 'A blade forged in the Abyss. It feels heavier than it looks.', recipe: { input: { void_essence: 6, runite: 2, planks: 1 }, ticks: 60, research: 'void_forging', station: 'enchanting_table' } },
    runic_greatsword: { name: 'Runic Greatsword', damage: 55, tier: 4, order: 23, attackCooldown: 5, armoredDamageBonus: 0.10, attackAnim: 'Swing', description: 'A massive two-handed sword. Slow but devastating, with runes tuned to pierce armored foes (+10% damage vs armored enemies).', recipe: { input: { runite: 4, iron: 2, planks: 2 }, ticks: 50, research: 'masterwork', station: 'enchanting_table' } },
    world_piercer: { name: 'World Piercer', damage: 28, tier: 4, order: 24, attackCooldown: 3, attackAnim: 'Stab', armoredDamageBonus: 0.35, description: 'A legendary lance that punches through armored foes.', recipe: { input: { void_essence: 4, runite: 3, iron: 1 }, ticks: 58, research: 'void_forging', station: 'enchanting_table' } },
    void_longbow: { name: 'Void Longbow', damage: 24, tier: 4, order: 25, ranged: true, range: 10, projectileChar: '⟶', projectileColor: '#cc00ff', skinKey: 'projectile_void', attackAnim: 'DrawAndShoot', description: 'A longbow that fires arrows of pure void.', recipe: { input: { void_essence: 4, runite: 2, planks: 3 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    void_dagger: { name: 'Void Dagger', damage: 16, tier: 4, order: 26, attackCooldown: 2, spellDamageBonus: 0.40, attackAnim: 'Stab', description: 'A dagger forged from void essence. Strikes fast and amplifies spells.', recipe: { input: { void_essence: 2, runite: 2, planks: 1 }, ticks: 45, research: 'void_forging', station: 'enchanting_table' } },
    void_staff: { name: 'Void Staff', damage: 16, tier: 4, order: 27, spellDamageBonus: 0.65, ranged: true, range: 8, projectileChar: '✦', projectileColor: '#cc00ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A staff channeling raw void energy.', recipe: { input: { void_essence: 5, runite: 2, planks: 2 }, ticks: 55, research: 'void_sorcery', station: 'enchanting_table' } },
};

// `order` groups a set's pieces together within a tier in the crafting menu
// (the helmet/boots sharing the same number sit next to the matching body).
// It is a within-tier tiebreaker only. Tier remains the primary sort key.
// Helmets, armors, and boots share the "Armor" crafting category, so their
// order values interleave to keep matching sets adjacent.
export const ARMORS = {
    // ── Tier 1 ──
    leather_vest: { name: 'Leather Vest', damageReduction: 0.10, tier: 1, order: 4, description: 'A sturdy leather vest.', recipe: { input: { leather: 3 }, ticks: 18 } },
    iron_brigandine: { name: 'Iron Brigandine', damageReduction: 0.12, tier: 1, order: 6, description: 'Light iron armor offering basic protection.', recipe: { input: { iron: 2 }, ticks: 14, research: 'metalworking', station: 'anvil' } },
    // ── Tier 2 ──
    iron_chainmail: { name: 'Iron Chainmail', damageReduction: 0.16, tier: 2, order: 8, description: 'Interlocking iron rings for solid protection.', recipe: { input: { iron: 4, leather: 2 }, ticks: 30, research: 'metalworking', station: 'anvil' } },
    enchanted_tunic: { name: 'Enchanted Tunic', damageReduction: 0.12, tier: 2, order: 11, spellDamageBonus: 0.10, description: 'A leather tunic woven with mana threads. Light protection with arcane attunement.', recipe: { input: { leather: 2, planks: 2, iron: 1 }, ticks: 24, research: 'mana_weaving', station: 'enchanting_table' } },
    thornweave_vest: { name: 'Thornweave Vest', damageReduction: 0.12, thornsDamage: 2, tier: 2, order: 13, description: 'A vest woven with barbed wire. Punishes attackers.', recipe: { input: { cloth: 3, iron: 1, leather: 1 }, ticks: 22, research: 'textiles', station: 'loom' } },
    // ── Tier 3 ──
    runic_plate: { name: 'Runic Plate', tradeValue: 48, damageReduction: 0.24, tier: 3, order: 15, description: 'Heavy plate armor inscribed with protective runes.', recipe: { input: { runite: 3, iron: 2, leather: 1 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    mana_weave_robe: { name: 'Mana-Weave Robe', damageReduction: 0.18, tier: 3, order: 18, spellDamageBonus: 0.20, description: 'A robe woven with mana threads. Boosts spell damage.', recipe: { input: { runite: 2, leather: 2, iron: 1 }, ticks: 40, research: 'mana_weaving', station: 'enchanting_table' } },
    frostplate: { name: 'Frostplate', damageReduction: 0.20, coldResistance: 0.8, heatResistance: -0.3, tier: 3, order: 20, description: 'Heavy armour of ice-forged runite. Supreme cold protection, but you feel the heat worse.', recipe: { input: { runite: 3, iron: 2, wool: 2 }, ticks: 44, research: 'runeforging', station: 'enchanting_table' } },
    duelists_silks: { name: "Duelist's Silks", tier: 3, order: 21, dodgeChance: 0.15, moveSpeedBonus: 0.1, description: 'Featherlight enchanted silks that let the wearer slip aside from incoming blows.', recipe: { input: { cloth: 3, runite: 1, void_essence: 1 }, ticks: 34, research: 'mana_weaving', station: 'enchanting_table' } },
    living_bark_armor: { name: 'Living Bark Armor', textColor: '#4488ff', tradeValue: 55, damageReduction: 0.30, tier: 3, order: 23, description: 'Armor grown from a living tree. Regenerates the wearer.', healthRegen: 0.07 },
    // ── Tier 4 ──
    void_armor: { name: 'Void Armor', damageReduction: 0.38, tier: 4, order: 27, description: 'Armor forged from void essence. Maximum protection.', recipe: { input: { void_essence: 5, runite: 2, iron: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    armor_of_the_abyss: { name: 'Armor of the Abyss', textColor: '#ff4444', tradeValue: 70, damageReduction: 0.45, tier: 4, order: 31, description: 'Abyssal armor that draws fire and shrugs off blows.', targetPriority: 10 },
};

// `order` mirrors the matching body armor's value so a helmet renders next to
// its set's chest piece within the tier (see ARMORS above).
export const HELMETS = {
    // ── Tier 1 ──
    wool_cap: { name: 'Wool Cap', damageReduction: 0.02, tier: 1, order: 1, coldResistance: 0.4, moodBonus: 3, description: 'A cozy wool cap. Keeps spirits and warmth up.', recipe: { input: { wool: 3 }, ticks: 10 } },
    leather_cap: { name: 'Leather Cap', damageReduction: 0.05, tier: 1, order: 3, description: 'A simple leather skullcap.', recipe: { input: { leather: 2 }, ticks: 12 } },
    // ── Tier 2 ──
    iron_helmet: { name: 'Iron Helmet', damageReduction: 0.08, tier: 2, order: 7, description: 'A solid iron helmet.', recipe: { input: { iron: 3 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    mages_circlet: { name: "Mage's Circlet", damageReduction: 0.06, tier: 2, order: 10, spellDamageBonus: 0.08, description: 'A circlet of woven iron and crystal. Focuses magical energy.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'arcane_implements', station: 'anvil' } },
    scholars_spectacles: { name: "Scholar's Spectacles", textColor: '#4488ff', tradeValue: 45, damageReduction: 0.04, tier: 2, order: 25, description: 'Enchanted lenses that sharpen the mind.', workSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 2, skillGrowthBonus: 0.1 } },
    // ── Tier 3 ──
    runic_helm: { name: 'Runic Helm', tradeValue: 38, damageReduction: 0.14, tier: 3, order: 14, description: 'A helm etched with protective runes.', recipe: { input: { runite: 2, iron: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    runic_hood: { name: 'Runic Hood', damageReduction: 0.10, tier: 3, order: 17, spellDamageBonus: 0.12, description: 'A hood inscribed with runes of clarity. Amplifies spellcraft.', recipe: { input: { runite: 2, leather: 1 }, ticks: 32, research: 'mana_weaving', station: 'enchanting_table' } },
    sharpshooters_visor: { name: "Sharpshooter's Visor", damageReduction: 0.10, tier: 3, order: 19, critChance: 0.15, description: 'A visor with an enchanted lens that guides every shot to its mark.', recipe: { input: { runite: 2, iron: 1, leather: 1 }, ticks: 34, research: 'marksmanship', station: 'enchanting_table' } },
    mycelium_crown: { name: 'Mycelium Crown', textColor: '#4488ff', tradeValue: 50, damageReduction: 0.08, tier: 3, order: 24, description: 'A crown woven from fungal threads. Enhances growth.', workSpeedBonus: 0.15, pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.15 }, expedition: { trapDamageMult: 0.6 } },
    // ── Tier 4 ──
    void_crown: { name: 'Void Crown', damageReduction: 0.18, tier: 4, order: 26, spellDamageBonus: 0.15, description: 'A crown of void energy. Boosts spells and protection.', recipe: { input: { void_essence: 4, runite: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    void_hunters_cowl: { name: "Void Hunter's Cowl", damageReduction: 0.12, critChance: 0.18, tier: 4, order: 29, description: 'A void-stitched cowl that locks in on targets, massively boosting critical strike chance.', recipe: { input: { void_essence: 3, runite: 2, leather: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
};

export const CLOTHES = {
    // ── Tier 1 ──
    cotton_shirt: { name: 'Cotton Shirt', tier: 1, order: 1, coldResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.05, description: 'A light cotton shirt. Comfortable for work.', recipe: { input: { cloth: 3 }, ticks: 14, research: 'textiles', station: 'loom' } },
    wool_tunic: { name: 'Wool Tunic', tier: 1, order: 2, coldResistance: 0.5, moodBonus: 3, description: 'A warm wool tunic. Good protection from the cold.', recipe: { input: { wool: 4, cloth: 1 }, ticks: 18, research: 'textiles', station: 'loom' } },
    // ── Tier 2 ──
    leather_jerkin: { name: 'Leather Jerkin', tier: 2, order: 3, coldResistance: 0.3, heatResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.1, description: 'A rugged leather jerkin. Versatile in all seasons.', recipe: { input: { leather: 3, cloth: 2 }, ticks: 24, research: 'textiles', station: 'loom' } },
    // ── Tier 3 ──
    ashwalkers_cloak: { name: "Ashwalker's Cloak", tier: 3, order: 4, heatResistance: 0.7, coldResistance: -0.2, moodBonus: 2, description: 'A fire-treated cloak woven for desert scouts. Shrugs off heat but offers no warmth.', recipe: { input: { leather: 3, cloth: 2, void_essence: 1 }, ticks: 26, research: 'mana_weaving', station: 'loom' } },
    mana_silk_vestments: { name: 'Mana-Silk Vestments', tier: 3, order: 5, coldResistance: 0.4, heatResistance: 0.3, moodBonus: 4, workSpeedBonus: 0.15, description: 'Robes woven from mana-infused silk. Comfortable in any climate and invigorating to work in.', recipe: { input: { cloth: 3, runite: 1, moonbloom: 1 }, ticks: 32, research: 'mana_weaving', station: 'loom' } },
    cloak_of_shadows: { name: 'Cloak of Shadows', tier: 3, order: 6, textColor: '#4488ff', tradeValue: 45, description: 'A cloak that makes the wearer harder to target.', targetPriority: -10 },
    berserkers_wraps: { name: "Berserker's Wraps", tier: 3, order: 7, textColor: '#4488ff', tradeValue: 45, lowHpDamageBonus: 0.3, description: 'Savage wraps that awaken something primal. Deal 30% more damage below 40% HP.' },
};

export const BOOTS = {
    // ── Tier 1 ──
    leather_boots: { name: 'Leather Boots', moveSpeedBonus: 0.1, tier: 1, order: 5, description: 'Sturdy leather boots for travel.', recipe: { input: { leather: 2, planks: 1 }, ticks: 14 } },
    // ── Tier 2 ──
    iron_greaves: { name: 'Iron Greaves', moveSpeedBonus: 0.08, damageReduction: 0.05, tier: 2, order: 9, description: 'Heavy iron greaves. Solid protection for the legs.', recipe: { input: { iron: 2, leather: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    enchanted_sandals: { name: 'Enchanted Sandals', moveSpeedBonus: 0.15, tier: 2, order: 12, description: 'Sandals woven with minor enchantments that quicken the step.', recipe: { input: { cloth: 2, leather: 1, iron: 1 }, ticks: 22, research: 'mana_weaving', station: 'loom' } },
    // ── Tier 3 ──
    runic_striders: { name: 'Runic Striders', moveSpeedBonus: 0.2, tier: 3, order: 16, description: 'Boots inscribed with runes of swiftness.', recipe: { input: { runite: 2, leather: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    striders_greaves: { name: "Strider's Greaves", moveSpeedBonus: 0.12, dodgeChance: 0.06, tier: 3, order: 22, description: 'Magically-enhanced greaves that keep the wearer on the move and harder to pin down.', recipe: { input: { runite: 1, iron: 2, leather: 1 }, ticks: 22, research: 'runeforging', station: 'enchanting_table' } },
    // ── Tier 4 ──
    void_treads: { name: 'Void Treads', moveSpeedBonus: 0.35, damageReduction: 0.06, tier: 4, order: 28, description: 'Boots forged from void essence. Swift and protective.', recipe: { input: { void_essence: 3, runite: 1, leather: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    boots_of_haste: { name: 'Boots of Haste', textColor: '#4488ff', tradeValue: 55, moveSpeedBonus: 0.4, tier: 4, order: 30, description: 'Enchanted boots that quicken the wearer.', expedition: { durationMult: 0.85 }, recipe: { input: { void_essence: 3, planks: 2, runite: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
};

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
    stone_pickaxe: { name: 'Stone Pickaxe', miningSpeed: 1.25, tier: 1, order: 1, description: 'The simplest pickaxe capable of breaking rocks.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_pickaxe: { name: 'Iron Pickaxe', miningSpeed: 1.45, tier: 2, order: 2, description: 'A competent pickaxe that easily breaks stone.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_pickaxe: { name: 'Runic Pickaxe', miningSpeed: 1.7, tier: 3, order: 3, description: 'A magically-enhanced pickaxe that helps pulverize boulders.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_pickaxe: { name: 'Void Pickaxe', miningSpeed: 2.0, tier: 4, order: 4, description: 'A pickaxe infused with void energy. Tears through rock and sometimes yields double ore.', recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Axes (chopping) ──
    stone_axe: { name: 'Stone Axe', choppingSpeed: 1.25, tier: 1, order: 5, description: 'The simplest axe capable of chopping wood.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_axe: { name: 'Iron Axe', choppingSpeed: 1.45, tier: 2, order: 6, description: 'A competent axe that easily fells trees.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_axe: { name: 'Runic Axe', choppingSpeed: 1.7, tier: 3, order: 7, description: 'A magically-enhanced axe that helps level forests.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_axe: { name: 'Void Axe', choppingSpeed: 2.0, tier: 4, order: 8, description: 'An axe that phases through wood grain. Occasionally fells a tree in a single blow.', recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Sickles (farming) ──
    stone_sickle: { name: 'Stone Sickle', farmingSpeed: 1.25, tier: 1, order: 9, description: 'The simplest sickle capable of harvesting crops.', recipe: { input: { stone: 1, planks: 1 }, ticks: 12 } },
    iron_sickle: { name: 'Iron Sickle', farmingSpeed: 1.45, tier: 2, order: 10, description: 'A competent sickle that easily harvests crops.', recipe: { input: { iron: 1, planks: 1 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    runic_sickle: { name: 'Runic Sickle', farmingSpeed: 1.7, tier: 3, order: 11, description: 'A magically-enhanced sickle that helps reap entire fields.', recipe: { input: { runite: 1, planks: 1 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    void_sickle: { name: 'Void Sickle', farmingSpeed: 2.0, tier: 4, order: 12, description: 'A sickle attuned to growth energy. Harvests entire rows at once.', recipe: { input: { void_essence: 3, runite: 1, planks: 1 }, ticks: 52, research: 'void_forging', station: 'enchanting_table' } },
    // ── Hammers (crafting) ──
    stone_hammer: { name: 'Stone Hammer', craftingSpeed: 1.25, tier: 1, order: 13, description: 'The simplest hammer capable of carpentry.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_hammer: { name: 'Iron Hammer', craftingSpeed: 1.45, tier: 2, order: 14, description: 'A competent hammer that easily drives nails through boards.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_hammer: { name: 'Runic Hammer', craftingSpeed: 1.7, tier: 3, order: 15, description: 'A magically-enhanced hammer prized by any blacksmith.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    void_hammer: { name: 'Void Hammer', craftingSpeed: 2.0, tier: 4, order: 16, description: 'A hammer that shapes materials at the atomic level. Drastically speeds all crafting.', recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Mattocks (multi-purpose) ──
    stone_mattock: { name: 'Stone Mattock', miningSpeed: 1.15, choppingSpeed: 1.15, tier: 1, order: 17, description: 'A versatile tool for mining and chopping.', recipe: { input: { stone: 3, planks: 2 }, ticks: 18 } },
    iron_mattock: { name: 'Iron Mattock', miningSpeed: 1.3, choppingSpeed: 1.3, tier: 2, order: 18, description: 'An iron mattock. Good at both mining and chopping.', recipe: { input: { iron: 3, planks: 2 }, ticks: 26, research: 'metalworking', station: 'anvil' } },
    runic_mattock: { name: 'Runic Mattock', miningSpeed: 1.5, choppingSpeed: 1.5, tier: 3, order: 19, description: 'A runic mattock. Excellent at mining and chopping.', recipe: { input: { runite: 3, planks: 2 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    void_mattock: { name: 'Void Mattock', miningSpeed: 1.7, choppingSpeed: 1.7, tier: 4, order: 20, description: 'The perfect combination of axes and picks.', recipe: { input: { void_essence: 3, runite: 2, planks: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    // ── Utility & offhand ──
    lantern: { name: 'Lantern', lightRadius: 4, tier: 1, order: 21, description: 'A handheld lantern. Illuminates the area around the carrier.', recipe: { input: { iron: 1, planks: 2 }, ticks: 12, research: 'metalworking', station: 'anvil' } },
    iron_shield: { name: 'Iron Shield', tradeValue: 15, tier: 1, order: 22, description: 'A simple shield that blocks attacks.', targetPriority: 5, damageReduction: 0.1, recipe: { input: { iron: 2, planks: 2 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    parrying_dagger: { name: "Parrying Dagger", tradeValue: 15, tier: 1, order: 23, dodgeChance: 0.05, moveSpeedBonus: 0.1, expedition: { dodgeChanceMod: 0.05 }, description: 'A light off-hand blade for deflecting blows.', recipe: { input: { iron: 1, leather: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    hunters_quiver: { name: "Hunter's Quiver", tradeValue: 15, tier: 1, order: 24, critChance: 0.05, attackSpeed: 0.05, description: 'A simple quiver carried by hunters.', recipe: { input: { iron: 1, leather: 1, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    bottomless_quiver: { name: 'Bottomless Quiver', textColor:'#44cc44', tradeValue: 50, tier: 2, order: 25, critChance: 0.1, attackSpeed: 0.1, description: 'An enchanted quiver whose arrows never run short.', recipe: { input: { runite: 1, leather: 2, planks: 1 }, ticks: 30, research: 'marksmanship', station: 'enchanting_table' } },
    runic_buckler: { name: 'Runic Buckler', tier: 3, order: 26, targetPriority: 5, damageReduction: 0.18, description: 'A compact shield reinforced with protective runes.', recipe: { input: { runite: 2, iron: 2, planks: 1 }, ticks: 38, research: 'runeforging', station: 'enchanting_table' } },
    drum_of_rallying: { name: 'Drum of Rallying', textColor: '#4488ff', tradeValue: 50, tier: 3, order: 27, description: 'War drums that inspire nearby fighters.', attackSpeed: 0.15, pedestal: { radius: 8, manaCost: 3, damageBonusMult: 1.15 }, expedition: { partyDamageMult: 1.15 }, recipe: { input: { wood: 6, runite: 2, planks: 3 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    // ── Drop-only pedestal/offhand items ──
    crystalline_hammer: { name: 'Crystalline Hammer', textColor: '#4488ff', tradeValue: 50, order: 28, description: 'A hammer pulsing with crystalline energy. Greatly speeds work.', workSpeedBonus: 0.35, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.2 } },
    heartwood_staff: { name: 'Heartwood Staff', textColor: '#4488ff', tradeValue: 55, order: 29, description: 'A staff carved from ancient heartwood. Strong magic focus.', spellDamageBonus: 0.3, pedestal: { radius: 7, manaCost: 3, skillGrowthBonus: 0.1 } },
    staff_of_regrowth: { name: 'Staff of Regrowth', textColor: '#4488ff', tradeValue: 45, order: 30, description: 'A living staff that protects crops and amplifies spells.', spellDamageBonus: 0.2, pedestal: { radius: 6, manaCost: 2, blightImmunity: true, blightDamageReduction: 0.5 } },
    staff_of_distortion: { name: 'Staff of Distortion', textColor: '#f944ff', tradeValue: 60, order: 31, description: 'A staff that warps space, confusing enemies.', spellDamageBonus: 0.4, targetPriority: -5, expedition: { partyDamageMult: 1.2, trapDamageMult: 1.3 } },
    aegis_of_the_vanguard: { name: 'Aegis of the Vanguard', textColor: '#f944ff', tradeValue: 60, order: 32, description: 'A heavy shield that draws attacks and absorbs blows.', targetPriority: 10, damageReduction: 0.3 },
    crystal_aegis: { name: 'Crystal Aegis', textColor: '#f944ff', tradeValue: 60, order: 33, description: 'A crystalline shield that reflects damage.', damageReduction: 0.28, thornsDamage: 2 },
};

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
    wanderers_rations_pouch: { name: "Wanderer's Rations Pouch", textColor:'#cccccc', tradeValue: 25, tier: 1, order: 1, description: 'A pouch of preserved rations that stave off hunger and fatigue on long journeys.', hungerDecayMult: 0.8, expedition: { fatigueMult: 0.85 }, recipe: { input: { leather: 2, planks: 1 }, ticks: 14 } },
    hearthstone_pendant: { name: 'Hearthstone Pendant', textColor:'#cccccc', tradeValue: 25, tier: 1, order: 2, moodBonus: 4, coldResistance: 0.1, description: 'A smooth river stone, warm to the touch. Comforts the wearer.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    sharpened_fang_necklace: { name: 'Sharpened Fang Necklace', textColor:'#cccccc', tradeValue: 25, tier: 1, order: 3, thornsDamage: 3, description: 'A necklace of sharpened fangs that punishes anyone who strikes the wearer.', recipe: { input: { stone: 1, leather: 2 }, ticks: 12 } },
    rabbits_paw: { name: "Rabbit's Paw", textColor:'#cccccc', tradeValue: 18, tier: 1, order: 4, description: 'A dried rabbit\'s paw worn for luck. Slightly improves expedition loot.', expedition: { lootMult: 1.15 } },
    iron_clad_effigy: { name: 'Iron-Clad Effigy', textColor:'#cccccc', tradeValue: 28, tier: 1, order: 5, description: 'A crude iron figurine worn as a ward. Damages enemies that strike the bearer.', thornsDamage: 3 },
    // ── Tier 2: expedition → combat → utility/economy ──
    map_fragment: { name: 'Map Fragment', textColor:'#cccccc', tradeValue: 25, tier: 2, order: 11, description: 'A torn piece of an ancient map. Shortens expeditions.', consumable: true, expedition: { durationMult: 0.7 } },
    compass_of_greed: { name: 'Compass of Greed', textColor:'#44cc44', tradeValue: 40, tier: 2, order: 12, description: 'Points toward treasure, but attracts danger.', expedition: { lootMult: 1.5, trapDamageMult: 1.2 } },
    jewelers_loupe: { name: "Jeweler's Loupe", textColor:'#44cc44', tradeValue: 44, tier: 2, order: 13, description: 'A fine magnifying lens for appraising gems. Its keen focus improves puzzle outcomes and sharpens learning on expeditions.', expedition: { puzzleSuccessBonus: 0.3, xpMult: 1.2 } },
    venom_vial: { name: 'Venom Vial', textColor:'#44cc44', tradeValue: 42, tier: 2, order: 14, description: 'A vial of concentrated toxin. Applies an additional layer of poison on each attack.', poisonOnHit: { damage: 1, ticks: 5, interval: 10 }, expedition: { trapDamageMult: 0.9, partyDamageMult: 1.05 }, recipe: { input: { moonbloom: 3, leather: 1, planks: 1 }, ticks: 25, research: 'herbalism', station: 'alchemy_table' } },
    burnished_relic: { name: 'Burnished Relic', textColor:'#44cc44', tradeValue: 44, tier: 2, order: 15, description: 'An ancient idol that blesses gatherers. Improves loot and gathering yields.', pedestal: { radius: 6, manaCost: 2, harvestYieldBonus: 1 }, expedition: { lootMult: 1.2 }, recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    emberstep_anklet: { name: 'Emberstep Anklet', textColor:'#44cc44', tradeValue: 42, tier: 2, order: 16, description: 'Warm iron rings that keep the blood moving and the cold at bay.', coldResistance: 0.4, moveSpeedBonus: 0.08 },
    jesters_bauble: { name: "Jester's Bauble", textColor:'#44cc44', tradeValue: 40, tier: 2, order: 17, description: 'A shiny, ridiculous trinket that somehow lifts the spirits of everyone nearby.', moodBonus: 8, pedestal: { radius: 5, manaCost: 1, moodBonus: 4 }, recipe: { input: { planks: 2, cloth: 1, iron: 1 }, ticks: 18, research: 'textiles', station: 'loom' } },
    hagglers_coin: { name: "Haggler's Coin", textColor:'#44cc44', tradeValue: 48, tier: 2, order: 18, description: 'A lucky coin that improves trade deals.', pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.85 } },
    merchants_ring: { name: "Merchant's Ring", textColor:'#44cc44', tradeValue: 40, tier: 2, order: 19, description: 'A ring favored by traders. Slightly improves deals.', pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.9 } },
    cornucopia_charm: { name: 'Cornucopia Charm', textColor:'#44cc44', tradeValue: 48, tier: 2, order: 20, description: 'A charm of abundance. Cooking yields extra food.', pedestal: { radius: 'global', manaCost: 1, cookingBonusFood: 1 }, recipe: { input: { wheat: 3, berries: 2, planks: 2 }, ticks: 28, research: 'alchemy', station: 'cooking_pot' } },
    amulet_of_fortune: { name: 'Amulet of Fortune', textColor:'#44cc44', tradeValue: 50, tier: 2, order: 21, description: 'A lucky amulet that accelerates learning.', pedestal: { radius: 'global', manaCost: 1, skillGrowthBonus: 0.2 } },
    // ── Tier 3: combat ──
    ghost_step_charm: { name: 'Ghost-Step Charm', textColor:'#4488ff', tradeValue: 65, tier: 3, order: 31, description: 'A charm carved with the rune of evasion. The bearer seems to flicker out of the way at the last moment.', dodgeChance: 0.12, expedition: { dodgeChanceMod: 0.15 } },
    bloodstone_gauntlet: { name: 'Bloodstone Gauntlet', textColor:'#4488ff', tradeValue: 68, tier: 3, order: 32, description: 'A deep-red gem embedded within a gauntlet, siphoning life back to the bearer.', lifeSteal: 0.12, expedition: { partyDamageMult: 1.05 } },
    sanguine_fang: { name: 'Sanguine Fang', textColor:'#4488ff', tradeValue: 66, tier: 3, order: 33, description: 'A serrated fang soaked in cursed blood. Causes bleeding and drains life.', lifeSteal: 0.08, bleedOnHit: { damage: 1, ticks: 4, interval: 10 } },
    strikers_band: { name: "Striker's Band", textColor:'#4488ff', tradeValue: 62, tier: 3, order: 34, description: 'A band that sharpens reflexes mid-sprint. Deals bonus damage on the first strike after moving.', moveSpeedBonus: 0.1, postMoveAttackBonus: 0.15, expedition: { dodgeChanceMod: 0.1 } },
    blight_seedpod: { name: 'Blight Seedpod', textColor:'#4488ff', tradeValue: 60, tier: 3, order: 35, description: 'A volatile seedpod from a blight bloom. The bearer is immune to blight and poison. Its thorns punish attackers.', poisonImmunity: true, thornsDamage: 2 },
    rune_of_splitting: { name: 'Rune of Splitting', textColor:'#4488ff', tradeValue: 64, tier: 3, order: 36, description: 'A rune that cuts through enemy defenses. Boosts damage against armored foes.', armoredDamageBonus: 0.20, pedestal: { radius: 6, manaCost: 2, armoredDamageBonus: 0.10 } },
    ward_of_the_sentinel: { name: 'Ward of the Sentinel', textColor:'#f944ff', tradeValue: 85, tier: 4, order: 75, description: 'A one-use ward that revives the bearer from death.', autoReviveHp: 0.5, durability: { max: 1, breakOnUse: true }, recipe: { input: { void_essence: 4, runite: 3, stone: 2 }, ticks: 65, research: 'void_forging', station: 'enchanting_table' } },
    // ── Tier 3: expedition ──
    rallying_standard: { name: 'Rallying Standard', textColor:'#4488ff', tradeValue: 62, tier: 3, order: 41, description: 'A tiny battle standard that inspires the party to recover after each fight.', expedition: { rallyChance: 0.25, rallyHeal: 0.12 } },
    warlords_banner: { name: "Warlord's Banner", textColor:'#4488ff', tradeValue: 72, tier: 3, order: 42, description: 'A tiny battle standard that unites the party. Boosts all damage and rally.', expedition: { partyDamageMult: 1.2, rallyChance: 0.15, rallyHeal: 0.08 } },
    expedition_spellbook: { name: 'Expedition Spellbook', textColor:'#4488ff', tradeValue: 66, tier: 3, order: 43, description: 'A condensed field tome that sharpens spellcraft under pressure.', expedition: { spellDamageMult: 1.3 }, recipe: { input: { runite: 2, planks: 3, moonbloom: 1 }, ticks: 40, research: 'arcane_studies', station: 'scriptorium' } },
    arcane_amplifier: { name: 'Arcane Amplifier', textColor:'#ff4444', tradeValue: 95, tier: 4, order: 76, description: 'A crystal that amplifies all magical output.', spellDamageBonus: 0.35, expedition: { partyDamageMult: 1.1 } },
    voidwalkers_lantern: { name: "Voidwalker's Lantern", textColor:'#4488ff', tradeValue: 60, tier: 3, order: 45, description: 'A lantern fueled by void energy. Reveals hidden paths.', expedition: { rareEncounterMult: 2.0 }, pedestal: { radius: 6, manaCost: 2, lightRadius: 4 } },
    // ── Tier 3: economy/utility ──
    hourglass_of_diligence: { name: 'Hourglass of Diligence', textColor:'#4488ff', tradeValue: 65, tier: 3, order: 51, description: 'Time bends around this hourglass, hastening all labor.', workSpeedBonus: 0.25, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.15 }, recipe: { input: { iron: 2, runite: 2, planks: 2 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    tome_of_shared_wisdom: { name: 'Tome of Shared Wisdom', textColor:'#4488ff', tradeValue: 65, tier: 3, order: 52, description: 'A tome that accelerates skill growth for those nearby.', skillGrowthBonus: 0.05, pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.1 }, recipe: { input: { planks: 4, runite: 2, moonbloom: 1 }, ticks: 42, research: 'arcane_studies', station: 'scriptorium' } },
    abundance_charm: { name: 'Abundance Charm', textColor:'#44cc44', tradeValue: 46, tier: 3, order: 53, description: 'A charm that coaxes extra output from craftspeople at their benches.', workSpeedBonus: 0.05, pedestal: { radius: 5, manaCost: 2, craftOutputBonus: 1 } },
    lodestone_of_prosperity: { name: 'Lodestone of Prosperity', textColor:'#44cc44', tradeValue: 50, tier: 3, order: 54, description: 'A magnetic stone that draws wanderers and traders to your colony.', pedestal: { radius: 'global', manaCost: 2, wandererChanceMult: 1.15, traderChanceMult: 1.15 }, recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    seedkeepers_locket: { name: "Seedkeeper's Locket", textColor:'#4488ff', tradeValue: 72, tier: 3, order: 55, description: 'A locket blessed by druids. Protects crops from blight and damages blight blooms.', pedestal: { radius: 8, manaCost: 1, blightImmunity: true, blightBloomDamage: 2 }, expedition: { trapDamageMult: 0.7 } },
    warden_censer: { name: "Warden's Censer", textColor:'#4488ff', tradeValue: 68, tier: 3, order: 56, description: 'A censer of blessed smoke that knits the wounds of the bearer and nearby allies.', healthRegen: 0.05, pedestal: { radius: 6, manaCost: 2, healthRegen: 0.05 }, recipe: { input: { runite: 2, moonbloom: 3, planks: 2 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    ley_battery: { name: 'Ley Battery', textColor:'#4488ff', tradeValue: 70, tier: 3, order: 57, description: 'A crystal that siphons ambient ley energy, sustaining a caster mid-battle.', manaRegen: 0.08, spellCostReduction: 0.12, recipe: { input: { runite: 2, moonbloom: 2, void_essence: 1 }, ticks: 42, research: 'void_sorcery', station: 'enchanting_table' } },
    // ── Tier 3: school-focused trinkets ──
    // Each pushes ONE school hard via a `<school>Bonus` stat (read alongside the
    // generic spellDamageBonus by getEquipmentSchoolBonus), rewarding a colonist
    // who commits to that school. A couple also carry non-damage spell stats
    // (spellHealBonus, spellDurationBonus, spellCooldownReduction) so gear can
    // amplify heals/buffs/recast rate, not just damage.
    ember_sigil: { name: 'Ember Sigil', textColor:'#ff6644', tradeValue: 68, tier: 3, order: 61, description: 'A searing rune that concentrates destructive fire. Amplifies Evocation spells.', evocationBonus: 0.4, recipe: { input: { runite: 2, void_essence: 1, planks: 2 }, ticks: 40, research: 'void_sorcery', station: 'enchanting_table' } },
    verdant_talisman: { name: 'Verdant Talisman', textColor:'#88ff88', tradeValue: 62, tier: 3, order: 62, description: 'A talisman pulsing with growth. Strengthens and prolongs Transmutation magic.', transmutationBonus: 0.35, spellDurationBonus: 0.25, recipe: { input: { moonbloom: 3, runite: 1, planks: 2 }, ticks: 40, research: 'advanced_arcana', station: 'enchanting_table' } },
    healers_pendant: { name: "Healer's Pendant", textColor:'#44ff44', tradeValue: 66, tier: 3, order: 63, description: 'A blessed pendant that magnifies restorative magic. Boosts Abjuration and healing.', abjurationBonus: 0.3, spellHealBonus: 0.3, recipe: { input: { moonbloom: 3, runite: 2, planks: 1 }, ticks: 42, research: 'advanced_arcana', station: 'enchanting_table' } },
    charmweave_band: { name: 'Charmweave Band', textColor:'#88ffff', tradeValue: 60, tier: 3, order: 64, description: 'A woven band that extends the reach of supportive magic. Boosts Enchantment.', enchantmentBonus: 0.3, spellDurationBonus: 0.3, recipe: { input: { runite: 2, leather: 2, moonbloom: 1 }, ticks: 38, research: 'advanced_arcana', station: 'enchanting_table' } },
    summoners_focus: { name: "Summoner's Focus", textColor:'#9966ff', tradeValue: 74, tier: 3, order: 65, description: 'A focus stone that quickens the summoner\'s art. Boosts Conjuration and recast speed.', conjurationBonus: 0.35, spellCooldownReduction: 0.2, recipe: { input: { void_essence: 2, runite: 2, planks: 1 }, ticks: 44, research: 'void_sorcery', station: 'enchanting_table' } },
    seers_eye: { name: "Seer's Eye", textColor:'#ccaaff', tradeValue: 70, tier: 3, order: 66, description: 'An unblinking eye that sharpens fate-magic, letting divinations be woven more often.', divinationBonus: 0.2, spellCooldownReduction: 0.25, recipe: { input: { moonbloom: 2, void_essence: 2, planks: 1 }, ticks: 44, research: 'advanced_arcana', station: 'enchanting_table' } },
    stitched_poppet: { name: 'Stitched Poppet', textColor:'#4488ff', tradeValue: 68, tier: 3, order: 67, description: 'A simple doll that shares its vitality with your summons. Boosts summoned ally HP and damage.', conjurationBonus: 0.2, summonHpBonus: 0.3, summonDamageBonus: 0.2 },
    // ── Tier 4 ──
    void_charm: { name: 'Void Charm', textColor:'#ff4444', tradeValue: 95, tier: 4, order: 71, description: 'A charm that seems to make your weapons cut through dimensions.', targetPriority: 5, damageReduction: 0.1, expedition: { partyDamageMult: 1.25 } },
    shard_of_oblivion: { name: 'Shard of Oblivion', textColor:'#ff4444', tradeValue: 95, tier: 4, order: 72, description: 'A shard of pure destruction. Devastating but dangerous.', targetPriority: 5, expedition: { partyDamageMult: 1.4, trapDamageMult: 1.5 } },
    dimensional_orb: { name: 'Dimensional Orb', textColor:'#ff4444', tradeValue: 105, tier: 4, order: 73, description: 'An orb that bends space. Shortens journeys dramatically.', expedition: { durationMult: 0.6, rareEncounterMult: 2.5 }, pedestal: { radius: 'global', manaCost: 3, wandererChanceMult: 1.3 } },
    voidheart: { name: 'Voidheart', textColor:'#ff4444', tradeValue: 120, tier: 4, order: 74, description: 'The heart of the void itself. Ultimate arcane power.', spellDamageBonus: 0.5, moveSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 4, damageBonusMult: 1.2 } },
};

export const POTIONS = {
    health_potion: { name: 'Health Potion', trigger: 'lowHealth', hpThreshold: 0.4, effect: 'heal', healAmount: 50, cooldown: 30, description: 'A restorative brew that mends wounds.', recipe: { input: { berries: 3, wheat: 1 }, skill: 'cooking', ticks: 16, station: 'alchemy_table', research: 'alchemy' } },
    speed_potion: { name: 'Speed Potion', trigger: 'hasTask', effect: 'speed', moveSpeedBonus: 0.5, workSpeedBonus: 0.3, duration: 100, cooldown: 400, description: 'An invigorating tonic that quickens body and mind.', recipe: { input: { corn: 2, potatoes: 2, berries: 1 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'alchemy' } },
    mana_potion: { name: 'Mana Potion', trigger: 'lowMana', manaThreshold: 0.3, effect: 'restoreMana', manaAmount: 30, cooldown: 300, description: 'A shimmering elixir that restores magical energy.', recipe: { input: { moonbloom: 3, runite: 1 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'herbalism' } },
    resistance_potion: { name: 'Resistance Potion', trigger: 'inCombat', effect: 'resistance', damageReduction: 0.25, duration: 80, cooldown: 500, description: 'A thick draught that hardens the body against blows.', recipe: { input: { moonbloom: 2, stone: 2, iron: 1 }, skill: 'cooking', ticks: 25, station: 'alchemy_table', research: 'herbalism' } },
    vitality_brew: { name: 'Vitality Brew', trigger: 'inCombat', effect: 'healthRegen', regenPerTick: 2, duration: 120, cooldown: 450, description: 'A slow-burning brew that regenerates health over time during battle.', recipe: { input: { berries: 2, wheat: 2, iron: 1 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'alchemy' } },
    morale_tonic: { name: 'Morale Tonic', trigger: 'lowMood', moodThreshold: 35, effect: 'mood', moodBonus: 20, duration: 200, cooldown: 600, description: 'A cheerful tonic that lifts the spirits of a downcast colonist.', recipe: { input: { berries: 3, corn: 2 }, skill: 'cooking', ticks: 18, station: 'alchemy_table', research: 'alchemy' } },
    warmth_elixir: { name: 'Warmth Elixir', trigger: 'coldSeason', effect: 'warmth', coldResistanceBonus: 0.4, duration: 200, cooldown: 500, description: 'A fiery elixir that wards off winter cold.', recipe: { input: { berries: 2, iron: 1, wheat: 2 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'domestic_alchemy' } },
    blight_ward: { name: 'Blight Ward', trigger: 'farming', effect: 'blightWard', duration: 150, cooldown: 600, description: 'A murky brew that temporarily shields crops from blight.', recipe: { input: { moonbloom: 2, stone: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'domestic_alchemy' } },
    scholars_draught: { name: "Scholar's Draught", trigger: 'isStudying', effect: 'scholarship', skillGrowthBonus: 0.4, researchSpeedBonus: 0.25, duration: 100, cooldown: 500, description: 'A potent tonic that sharpens the mind and speeds learning.', recipe: { input: { moonbloom: 2, wheat: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'domestic_alchemy' } },
    focus_brew: { name: 'Focus Brew', trigger: 'isCrafting', effect: 'focus', craftSpeedBonus: 0.3, duration: 120, cooldown: 400, description: 'A brew that channels concentration into craft, speeding all production work.', recipe: { input: { corn: 2, moonbloom: 1 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'domestic_alchemy' } },
    // Expedition-only potions (no trigger here, never auto-used in the main game).
    antidote: { name: 'Antidote', expeditionOnly: true, description: 'Clears all damage-over-time effects on an expedition member.', recipe: { input: { moonbloom: 2, berries: 2 }, skill: 'cooking', ticks: 18, station: 'alchemy_table', research: 'herbalism' } },
    battle_tonic: { name: 'Battle Tonic', expeditionOnly: true, description: 'Boosts attack speed and critical strike chance for several combat rounds.', recipe: { input: { iron: 1, corn: 2, potatoes: 2 }, skill: 'cooking', ticks: 24, station: 'alchemy_table', research: 'battle_brewing' } },
    smoke_draught: { name: 'Smoke Draught', expeditionOnly: true, description: 'Greatly increases dodge chance for several combat rounds.', recipe: { input: { moonbloom: 2, stone: 1, berries: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'battle_brewing' } },
    lifesteal_elixir: { name: 'Lifesteal Elixir', expeditionOnly: true, description: 'Grants a large HP-on-kill bonus for several combat rounds.', recipe: { input: { moonbloom: 2, iron: 1, runite: 1 }, skill: 'cooking', ticks: 26, station: 'alchemy_table', research: 'battle_brewing' } },
    loot_elixir: { name: 'Loot Elixir', expeditionOnly: true, description: 'Consumed at expedition entry, greatly boosting loot and rare encounter rates.', recipe: { input: { moonbloom: 3, runite: 2, berries: 2 }, skill: 'cooking', ticks: 30, station: 'alchemy_table', research: 'battle_brewing' } },
    rally_brew: { name: 'Rally Brew', expeditionOnly: true, description: 'Clears slows and restores 20% HP for all party members.', recipe: { input: { moonbloom: 2, wheat: 2, berries: 2 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'battle_brewing' } },
    mana_surge: { name: 'Mana Surge', expeditionOnly: true, description: 'Restores 30% mana and reduces spell costs for several combat rounds.', recipe: { input: { moonbloom: 3, runite: 1 }, skill: 'cooking', ticks: 24, station: 'alchemy_table', research: 'battle_brewing' } },
};

export const CONSUMABLES = {
    crystal_capacitor: { name: 'Crystal Capacitor', char: '◆', charColor: '#aa44ff', description: 'Use to permanently increase your mana crystal limit by 1.', tradeValue: 65 },
};

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
    sharpness: { suffix: 'of Sharpness', description: 'Enchanted with sharpness, increasing attack damage by 15% per enchantment tier.', damageMultiplier: 1.15 },
    witchery: { suffix: 'of Witchery', description: 'Enchanted with witchery, increasing spell damage by 15% per enchantment tier.', spellDamageBonus: 0.15 },
    piercing: { suffix: 'of Piercing', description: 'Enchanted with piercing, increasing the chance of critical strikes by 15% per enchantment tier.', critChance: 0.15 },
    vampirism: { suffix: 'of Vampirism', description: 'Enchanted with vampirism, healing for 15% of damage dealt per enchantment tier.', lifeSteal: 0.15 },
    // distance: { suffix: 'of Distance', description: 'Enchanted with distance, increasing attack range by 15% per enchantment tier, even for melee weapons.', attackRangeMultiplier: 1.15 },
    // velocity { suffix: 'of Velocity', description: 'Enchanted with velocity, increasing attack speed by 15% per enchantment tier.', attackSpeed: 0.15 },
    // greed { suffix: 'of Greed', description: 'Enchanted with greed, increasing exploration loot rarity by 15% per enchantment tier.', lootRarityMultiplier: 1.15 },
};

export const ARMOR_ENCHANTMENT_EFFECTS = {
    protection: { suffix: 'of Protection', description: 'Enchanted with protection, increasing defense by 15% per enchantment tier.', defenseMultiplier: 1.15 },
    wisdom: { suffix: 'of Wisdom', description: 'Enchanted with wisdom, increasing mana regeneration by 15% per enchantment tier.', manaRegenBonus: 0.15 },
    barbs: { suffix: 'of Barbs', description: 'Enchanted with barbs, increasing thorns damage on enemy attacks by 15% per enchantment tier.', thornsDamage: 0.15 },
    // free_movement { suffix: 'of Free Movement', description: 'Enchanted with free movement, increasing movement and exploration speed by 10% per enchantment tier.', moveSpeedBonus: 0.10 },
    // dodgeChance { suffix: 'of Barbs', description: 'Enchanted with barbs, increasing dodge chance by 10% per enchantment tier.', dodgeChance: 0.10 },
};

export const CLOTHES_ENCHANTMENT_EFFECTS = {
    wisdom: { suffix: 'of Wisdom', description: 'Enchanted with wisdom, increasing mana regeneration by 15% per enchantment tier.', manaRegenBonus: 0.15 },
    barbs: { suffix: 'of Barbs', description: 'Enchanted with barbs, increasing thorns damage on enemy attacks by 15% per enchantment tier.', thornsDamage: 0.15 },
    productivity: { suffix: 'of Productivity', description: 'Enchanted with productivity, increasing work speed by 15% per enchantment tier.', workSpeedBonus: 0.15 },
    renewal: { suffix: 'of Renewal', description: 'Enchanted with renewal, increasing health regeneration 15% per enchantment tier.', healthRegenBonus: 0.15 },
};

export const TOOL_ENCHANTMENT_EFFECTS = {
    productivity: { suffix: 'of Productivity', description: 'Enchanted with productivity, increasing work speed by 15% per enchantment tier.', workSpeedBonus: 0.15 },
    renewal: { suffix: 'of Renewal', description: 'Enchanted with renewal, increasing health regeneration 15% per enchantment tier.', healthRegenBonus: 0.15 },
    // windfall: { suffix: 'of Windfall', description: 'Enchanted with windfall, increasing materials gained while gathering by 20% per enchantment tier.', gatheringMatMultiplier: 1.20 },
    // spellCostReduction
};

export const BOOTS_ENCHANTMENT_EFFECTS = {
    swiftness: { suffix: 'of Swiftness', description: 'Enchanted with swiftness, increasing movement speed by 10% per enchantment tier.', moveSpeedBonus: 0.10 },
};

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

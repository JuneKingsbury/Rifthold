export const RECIPE_CATEGORIES = ['Materials', 'Weapons', 'Armor', 'Clothing', 'Tools', 'Trinkets', 'Repair', 'Food & Potions', 'Tomes'];

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
    cloth: { name: 'Cloth', recipe: { input: { cotton: 2 }, output: 3, ticks: 10, prefix: 'weave_', station: 'loom' } },
    planks: { name: 'Planks', recipe: { input: { wood: 2 }, output: 3, ticks: 10, prefix: 'craft_' } },
    bricks: { name: 'Bricks', recipe: { input: { stone: 2 }, output: 3, ticks: 12, prefix: 'craft_' } },
    leather: { name: 'Leather', recipe: { input: { hides: 2 }, output: 2, ticks: 10, prefix: 'tan_' } },
    iron: { name: 'Iron', recipe: { input: { iron_ore: 2 }, output: 2, ticks: 12, prefix: 'smelt_', research: 'metalworking', station: 'anvil' } },
};

const BASE_RECIPES = {
    repair_trinket: { input: { runite: 1 }, output: {}, skill: 'crafting', ticks: 40, station: 'anvil', category: 'Repair', special: 'repair' },
    cook_meal: { input: { foodstuffs: 5 }, output: { food: 4 }, skill: 'cooking', ticks: 8, station: 'cauldron', category: 'Food & Potions' },

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
    craft_tome_of_gate: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_warp: 1 }, skill: 'crafting', ticks: 38, station: 'scriptorium', research: 'arcane_studies', category: 'Tomes' },
    craft_tome_of_summon_monster: { input: { planks: 6, runite: 4, void_essence: 4 }, output: { tome_of_summon_ghost: 1 }, skill: 'crafting', ticks: 60, station: 'scriptorium', research: 'advanced_arcana', category: 'Tomes' },

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
    fists: { name: 'Fists', damage: 5, tier: 0, attackAnim: 'Swing', description: 'Bare fists.' },
    stone_spear: { name: 'Stone Spear', damage: 8, tier: 1, attackAnim: 'Stab', description: 'A sharpened stone lashed to a stick.', recipe: { input: { stone: 2, wood: 1 }, ticks: 12 } },
    wooden_club: { name: 'Wooden Club', damage: 10, tier: 1, attackAnim: 'Swing', description: 'A heavy wooden bludgeon.', recipe: { input: { wood: 2, planks: 1 }, ticks: 15 } },
    iron_sword: { name: 'Iron Sword', tradeValue: 28, damage: 14, tier: 2, attackAnim: 'Swing', description: 'A reliable iron blade.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    etched_axe: { name: 'Etched Axe', damage: 15, tier: 2, attackAnim: 'Swing', description: 'An axe inscribed with runes of sharpness.', recipe: { input: { iron: 2, planks: 1, stone: 1 }, ticks: 22, research: 'runecraft', station: 'anvil' } },
    etched_mace: { name: 'Etched Mace', damage: 17, tier: 2, attackAnim: 'Swing', description: 'A heavy mace with runes that make it heavier.', recipe: { input: { iron: 3, planks: 1 }, ticks: 24, research: 'runecraft', station: 'anvil' } },
    enchanted_glaive: { name: 'Enchanted Glaive', damage: 18, tier: 3, spellDamageBonus: 0.25, attackAnim: 'Swing', description: 'A long blade humming with arcane energy.', recipe: { input: { iron: 2, runite: 1, planks: 2 }, ticks: 38, research: 'mana_weaving', station: 'enchanting_table' } },
    void_dagger: { name: 'Void Dagger', damage: 16, tier: 4, attackCooldown: 2, spellDamageBonus: 0.40, attackAnim: 'Stab', description: 'A dagger forged from void essence. Strikes fast and amplifies spells.', recipe: { input: { void_essence: 2, runite: 2, planks: 1 }, ticks: 45, research: 'void_forging', station: 'enchanting_table' } },
    runic_blade: { name: 'Runic Blade', tradeValue: 45, damage: 22, tier: 3, attackAnim: 'Swing', description: 'A blade etched with powerful runes.', recipe: { input: { runite: 2, planks: 1 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    runic_greatsword: { name: 'Runic Greatsword', damage: 45, tier: 4, attackCooldown: 5, attackAnim: 'Swing', description: 'A massive two-handed runic sword. Slow but devastating.', recipe: { input: { runite: 4, iron: 2, planks: 2 }, ticks: 50, research: 'masterwork', station: 'enchanting_table' } },
    wooden_wand: { name: 'Wooden Wand', damage: 3, tier: 1, attackCooldown: 2, spellDamageBonus: 0.2, ranged: true, range: 5, projectileChar: '·', projectileColor: '#aaccff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A basic wand for aspiring mages. Attacks quickly.', recipe: { input: { wood: 3, planks: 1 }, ticks: 12, research: 'arcane_implements' } },
    crystal_staff: { name: 'Crystal Staff', damage: 8, tier: 2, spellDamageBonus: 0.35, ranged: true, range: 6, projectileChar: '✦', projectileColor: '#88ddff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A staff topped with a focusing crystal.', recipe: { input: { iron: 2, planks: 2, runite: 1 }, ticks: 28, research: 'arcane_implements', station: 'anvil' } },
    runic_wand: { name: 'Runic Wand', damage: 7, tier: 3, attackCooldown: 2, spellDamageBonus: 0.5, ranged: true, range: 7, projectileChar: '·', projectileColor: '#dd88ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A wand inscribed with potent spell-amplifying runes. Attacks quickly.', recipe: { input: { runite: 2, planks: 2 }, ticks: 35, research: 'void_sorcery', station: 'enchanting_table' } },
    void_staff: { name: 'Void Staff', damage: 16, tier: 4, spellDamageBonus: 0.65, ranged: true, range: 8, projectileChar: '✦', projectileColor: '#cc00ff', skinKey: 'projectile_spell', attackAnim: 'DrawAndShoot', description: 'A staff channeling raw void energy.', recipe: { input: { void_essence: 5, runite: 2, planks: 2 }, ticks: 55, research: 'void_sorcery', station: 'enchanting_table' } },
    short_bow: { name: 'Short Bow', damage: 7, tier: 1, ranged: true, range: 5, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', description: 'A simple short-range bow.', recipe: { input: { wood: 3, leather: 1 }, ticks: 14 } },
    hunting_bow: { name: 'Hunting Bow', damage: 10, tier: 2, ranged: true, range: 6, projectileChar: '-', projectileColor: '#ffaa33', skinKey: 'projectile_arrow', attackAnim: 'DrawAndShoot', description: 'A sturdy bow made for hunting.', recipe: { input: { planks: 2, leather: 2, iron: 1 }, ticks: 22, research: 'metalworking', station: 'anvil' } },
    iron_crossbow: { name: 'Iron Crossbow', tradeValue: 38, damage: 22, tier: 2, attackCooldown: 5, ranged: true, range: 7, projectileChar: '→', projectileColor: '#aaddff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', description: 'A mechanical crossbow with iron bolts. Slow but powerful.', recipe: { input: { iron: 3, planks: 2, leather: 1 }, ticks: 30, research: 'marksmanship', station: 'anvil' } },
    runic_crossbow: { name: 'Runic Crossbow', damage: 30, tier: 3, attackCooldown: 5, ranged: true, range: 8, projectileChar: '→', projectileColor: '#bb99ff', skinKey: 'projectile_bolt', attackAnim: 'DrawAndShoot', description: 'A crossbow enhanced with runic power. Slow but devastating.', recipe: { input: { runite: 3, iron: 2, planks: 2 }, ticks: 42, research: 'runeforging', station: 'enchanting_table' } },
    void_longbow: { name: 'Void Longbow', damage: 24, tier: 4, ranged: true, range: 10, projectileChar: '⟶', projectileColor: '#cc00ff', skinKey: 'projectile_void', attackAnim: 'DrawAndShoot', description: 'A longbow that fires arrows of pure void.', recipe: { input: { void_essence: 4, runite: 2, planks: 3 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    void_blade: { name: 'Void Blade', damage: 52, tier: 4, attackCooldown: 5, attackAnim: 'Swing', description: 'The ultimate melee weapon, forged in the void. Slow but devastating.', recipe: { input: { void_essence: 6, runite: 2, planks: 1 }, ticks: 60, research: 'void_forging', station: 'enchanting_table' } },
};

// `order` groups a set's pieces together within a tier in the crafting menu
// (the helmet/boots sharing the same number sit next to the matching body).
// It is a within-tier tiebreaker only — tier remains the primary sort key.
export const ARMORS = {
    wool_parka: { name: 'Wool Parka', damageReduction: 0.04, tier: 1, order: 1, coldResistance: 0.7, hungerReduction: 0.1, description: 'Warm wool parka. Resists cold and reduces hunger.', recipe: { input: { wool: 4, leather: 1 }, ticks: 16 } },
    iron_brigandine: { name: 'Iron Brigandine', damageReduction: 0.08, tier: 1, order: 3, description: 'Light iron armor offering basic protection.', recipe: { input: { iron: 2 }, ticks: 14, research: 'metalworking', station: 'anvil' } },
    leather_vest: { name: 'Leather Vest', damageReduction: 0.10, tier: 1, order: 2, description: 'A sturdy leather vest.', recipe: { input: { leather: 3 }, ticks: 18 } },
    enchanted_tunic: { name: 'Enchanted Tunic', damageReduction: 0.12, tier: 2, order: 4, spellDamageBonus: 0.10, description: 'A leather tunic woven with mana threads. Light protection with arcane attunement.', recipe: { input: { leather: 2, planks: 2, iron: 1 }, ticks: 24, research: 'mana_weaving', station: 'enchanting_table' } },
    mana_weave_robe: { name: 'Mana-Weave Robe', damageReduction: 0.18, tier: 3, order: 6, spellDamageBonus: 0.20, description: 'A robe woven with mana threads. Boosts spell damage.', recipe: { input: { runite: 2, leather: 2, iron: 1 }, ticks: 40, research: 'mana_weaving', station: 'enchanting_table' } },
    iron_chainmail: { name: 'Iron Chainmail', damageReduction: 0.16, tier: 2, order: 3, description: 'Interlocking iron rings for solid protection.', recipe: { input: { iron: 4, leather: 2 }, ticks: 30, research: 'metalworking', station: 'anvil' } },
    runic_plate: { name: 'Runic Plate', tradeValue: 48, damageReduction: 0.24, tier: 3, order: 5, description: 'Heavy plate armor inscribed with protective runes.', recipe: { input: { runite: 3, iron: 2, leather: 1 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    void_armor: { name: 'Void Armor', damageReduction: 0.38, tier: 4, order: 8, description: 'Armor forged from void essence. Maximum protection.', recipe: { input: { void_essence: 5, runite: 2, iron: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    living_bark_armor: { name: 'Living Bark Armor', textColor: '#4488ff', tradeValue: 55, damageReduction: 0.35, tier: 3, order: 9, description: 'Armor grown from a living tree. Regenerates the wearer.', healthRegen: 0.07 },
    duelists_silks: { name: "Duelist's Silks", tier: 3, order: 7, dodgeChance: 0.15, moveSpeedBonus: 0.1, description: 'Featherlight enchanted silks that let the wearer slip aside from incoming blows.', recipe: { input: { cloth: 3, runite: 1, void_essence: 1 }, ticks: 34, research: 'mana_weaving', station: 'enchanting_table' } },
    armor_of_the_abyss: { name: 'Armor of the Abyss', textColor: '#ff4444', tradeValue: 70, damageReduction: 0.45, tier: 4, order: 10, description: 'Abyssal armor that draws fire and shrugs off blows.', targetPriority: 10 },
};

// `order` mirrors the matching body armor's value so a helmet renders next to
// its set's chest piece within the tier (see ARMORS above).
export const HELMETS = {
    wool_cap: { name: 'Wool Cap', damageReduction: 0.02, tier: 1, order: 1, coldResistance: 0.4, moodBonus: 3, description: 'A cozy wool cap. Keeps spirits and warmth up.', recipe: { input: { wool: 3 }, ticks: 10 } },
    leather_cap: { name: 'Leather Cap', damageReduction: 0.05, tier: 1, order: 2, description: 'A simple leather skullcap.', recipe: { input: { leather: 2 }, ticks: 12 } },
    iron_helmet: { name: 'Iron Helmet', damageReduction: 0.08, tier: 2, order: 3, description: 'A solid iron helmet.', recipe: { input: { iron: 3 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    mages_circlet: { name: "Mage's Circlet", damageReduction: 0.06, tier: 2, order: 4, spellDamageBonus: 0.08, description: 'A circlet of woven iron and crystal. Focuses magical energy.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'arcane_implements', station: 'anvil' } },
    runic_helm: { name: 'Runic Helm', tradeValue: 38, damageReduction: 0.14, tier: 3, order: 5, description: 'A helm etched with protective runes.', recipe: { input: { runite: 2, iron: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    runic_hood: { name: 'Runic Hood', damageReduction: 0.10, tier: 3, order: 6, spellDamageBonus: 0.12, description: 'A hood inscribed with runes of clarity. Amplifies spellcraft.', recipe: { input: { runite: 2, leather: 1 }, ticks: 32, research: 'mana_weaving', station: 'enchanting_table' } },
    void_crown: { name: 'Void Crown', damageReduction: 0.18, tier: 4, order: 8, spellDamageBonus: 0.15, description: 'A crown of void energy. Boosts spells and protection.', recipe: { input: { void_essence: 4, runite: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
    mycelium_crown: { name: 'Mycelium Crown', textColor: '#4488ff', tradeValue: 50, damageReduction: 0.08, tier: 3, order: 9, description: 'A crown woven from fungal threads. Enhances growth.', workSpeedBonus: 0.15, pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.15 }, expedition: { trapDamageMult: 0.6 } },
    scholars_spectacles: { name: "Scholar's Spectacles", textColor: '#4488ff', tradeValue: 45, damageReduction: 0.04, tier: 2, order: 10, description: 'Enchanted lenses that sharpen the mind.', workSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 2, skillGrowthBonus: 0.1 } },
    sharpshooters_visor: { name: "Sharpshooter's Visor", damageReduction: 0.10, tier: 3, order: 7, critChance: 0.15, description: 'A visor with an enchanted lens that guides every shot to its mark.', recipe: { input: { runite: 2, iron: 1, leather: 1 }, ticks: 34, research: 'marksmanship', station: 'enchanting_table' } },
};

export const CLOTHES = {
    cotton_shirt: { name: 'Cotton Shirt', tier: 1, coldResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.05, description: 'A light cotton shirt. Comfortable for work.', recipe: { input: { cloth: 3 }, ticks: 14, station: 'loom' } },
    wool_tunic: { name: 'Wool Tunic', tier: 1, coldResistance: 0.5, moodBonus: 3, description: 'A warm wool tunic. Good protection from the cold.', recipe: { input: { wool: 4, cloth: 1 }, ticks: 18, station: 'loom' } },
    leather_jerkin: { name: 'Leather Jerkin', tier: 2, coldResistance: 0.3, heatResistance: 0.2, moodBonus: 2, workSpeedBonus: 0.1, description: 'A rugged leather jerkin. Versatile in all seasons.', recipe: { input: { leather: 3, cloth: 2 }, ticks: 24, station: 'loom' } },
    cloak_of_shadows: { name: 'Cloak of Shadows', tier: 3, textColor: '#4488ff', tradeValue: 45, description: 'A cloak that makes the wearer harder to target.', targetPriority: -10 },
};

export const BOOTS = {
    leather_boots: { name: 'Leather Boots', moveSpeedBonus: 0.1, tier: 1, description: 'Sturdy leather boots for travel.', recipe: { input: { leather: 2, planks: 1 }, ticks: 14 } },
    iron_greaves: { name: 'Iron Greaves', moveSpeedBonus: 0.05, damageReduction: 0.04, tier: 2, description: 'Heavy iron greaves. Solid protection for the legs.', recipe: { input: { iron: 2, leather: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_striders: { name: 'Runic Striders', moveSpeedBonus: 0.2, tier: 3, description: 'Boots inscribed with runes of swiftness.', recipe: { input: { runite: 2, leather: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    boots_of_haste: { name: 'Boots of Haste', textColor: '#4488ff', tradeValue: 55, moveSpeedBonus: 0.5, tier: 4, description: 'Enchanted boots that quicken the wearer.', expedition: { durationMult: 0.85 }, recipe: { input: { void_essence: 3, planks: 2, runite: 1 }, ticks: 55, research: 'void_forging', station: 'enchanting_table' } },
    void_treads: { name: 'Void Treads', moveSpeedBonus: 0.35, damageReduction: 0.06, tier: 4, description: 'Boots forged from void essence. Swift and protective.', recipe: { input: { void_essence: 3, runite: 1, leather: 1 }, ticks: 50, research: 'void_forging', station: 'enchanting_table' } },
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
    stone_pickaxe: { name: 'Stone Pickaxe', miningSpeed: 1.25, tier: 1, description: 'A basic stone pickaxe for mining.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_pickaxe: { name: 'Iron Pickaxe', miningSpeed: 1.45, tier: 2, description: 'An iron pickaxe. Mines faster.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_pickaxe: { name: 'Runic Pickaxe', miningSpeed: 1.7, tier: 3, description: 'A pickaxe enhanced with runes. Superior mining.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    stone_axe: { name: 'Stone Axe', choppingSpeed: 1.25, tier: 1, description: 'A basic stone axe for chopping.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_axe: { name: 'Iron Axe', choppingSpeed: 1.45, tier: 2, description: 'An iron axe. Chops faster.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_axe: { name: 'Runic Axe', choppingSpeed: 1.7, tier: 3, description: 'A runic axe. Superior chopping.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    stone_sickle: { name: 'Stone Sickle', farmingSpeed: 1.25, tier: 1, description: 'A basic stone sickle for farming.', recipe: { input: { stone: 1, planks: 1 }, ticks: 12 } },
    iron_sickle: { name: 'Iron Sickle', farmingSpeed: 1.45, tier: 2, description: 'An iron sickle. Farms faster.', recipe: { input: { iron: 1, planks: 1 }, ticks: 18, research: 'metalworking', station: 'anvil' } },
    runic_sickle: { name: 'Runic Sickle', farmingSpeed: 1.7, tier: 3, description: 'A runic sickle. Superior farming.', recipe: { input: { runite: 1, planks: 1 }, ticks: 30, research: 'runeforging', station: 'enchanting_table' } },
    stone_hammer: { name: 'Stone Hammer', craftingSpeed: 1.25, tier: 1, description: 'A basic stone hammer for crafting.', recipe: { input: { stone: 2, planks: 1 }, ticks: 14 } },
    iron_hammer: { name: 'Iron Hammer', craftingSpeed: 1.45, tier: 2, description: 'An iron hammer. Crafts faster.', recipe: { input: { iron: 2, planks: 1 }, ticks: 20, research: 'metalworking', station: 'anvil' } },
    runic_hammer: { name: 'Runic Hammer', craftingSpeed: 1.7, tier: 3, description: 'A runic hammer. Superior crafting.', recipe: { input: { runite: 2, planks: 1 }, ticks: 35, research: 'runeforging', station: 'enchanting_table' } },
    stone_mattock: { name: 'Stone Mattock', miningSpeed: 1.15, choppingSpeed: 1.15, tier: 1, description: 'A versatile tool for mining and chopping.', recipe: { input: { stone: 3, planks: 2 }, ticks: 18 } },
    iron_mattock: { name: 'Iron Mattock', miningSpeed: 1.3, choppingSpeed: 1.3, tier: 2, description: 'An iron mattock. Good at both mining and chopping.', recipe: { input: { iron: 3, planks: 2 }, ticks: 26, research: 'metalworking', station: 'anvil' } },
    runic_mattock: { name: 'Runic Mattock', miningSpeed: 1.5, choppingSpeed: 1.5, tier: 3, description: 'A runic mattock. Excellent at mining and chopping.', recipe: { input: { runite: 3, planks: 2 }, ticks: 40, research: 'runeforging', station: 'enchanting_table' } },
    lantern: { name: 'Lantern', lightRadius: 4, tier: 1, description: 'A handheld lantern. Illuminates the area around the carrier.', recipe: { input: { iron: 1, planks: 2 }, ticks: 12, research: 'metalworking', station: 'anvil' } },
    aegis_of_the_vanguard: { name: 'Aegis of the Vanguard', textColor: '#f944ff', tradeValue: 60, description: 'A heavy shield that draws attacks and absorbs blows.', targetPriority: 10, damageReduction: 0.3 },
    crystal_aegis: { name: 'Crystal Aegis', textColor: '#f944ff', tradeValue: 60, description: 'A crystalline shield that reflects damage.', damageReduction: 0.28, thornsDamage: 2 },
    drum_of_rallying: { name: 'Drum of Rallying', textColor: '#4488ff', tradeValue: 50, description: 'War drums that inspire nearby fighters.', attackSpeed: 0.15, pedestal: { radius: 8, manaCost: 3, damageBonusMult: 1.15 }, expedition: { partyDamageMult: 1.15 }, recipe: { input: { wood: 6, runite: 2, planks: 3 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    runite_hammer: { name: 'Runite Hammer', textColor: '#4488ff', tradeValue: 50, description: 'A hammer pulsing with runic energy. Greatly speeds work.', workSpeedBonus: 0.35, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.2 } },
    heartwood_staff: { name: 'Heartwood Staff', textColor: '#4488ff', tradeValue: 55, description: 'A staff carved from ancient heartwood. Strong magic focus.', spellDamageBonus: 0.3, pedestal: { radius: 7, manaCost: 3, skillGrowthBonus: 0.1 } },
    staff_of_regrowth: { name: 'Staff of Regrowth', textColor: '#4488ff', tradeValue: 45, description: 'A living staff that protects crops and amplifies spells.', spellDamageBonus: 0.2, pedestal: { radius: 6, manaCost: 2, blightImmunity: true } },
    staff_of_distortion: { name: 'Staff of Distortion', textColor: '#f944ff', tradeValue: 60, description: 'A staff that warps space, confusing enemies.', spellDamageBonus: 0.4, targetPriority: -5, expedition: { partyDamageMult: 1.2, trapDamageMult: 1.3 } },
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
    seedkeepers_locket: { name: "Seedkeeper's Locket", textColor:'#4488ff', tradeValue: 72, tier: 3, description: 'A locket blessed by druids. Protects crops from blight.', pedestal: { radius: 8, manaCost: 1, blightImmunity: true }, expedition: { trapDamageMult: 0.7 } },
    hourglass_of_diligence: { name: 'Hourglass of Diligence', textColor:'#4488ff', tradeValue: 65, tier: 3, description: 'Time bends around this hourglass, hastening all labor.', workSpeedBonus: 0.25, pedestal: { radius: 5, manaCost: 2, workSpeedBonus: 0.15 } },
    lodestone_of_prosperity: { name: 'Lodestone of Prosperity', textColor:'#4488ff', tradeValue: 60, tier: 3, description: 'A magnetic stone that draws wanderers and traders to your colony.', pedestal: { radius: 'global', manaCost: 2, wandererChanceMult: 1.25, traderChanceMult: 1.25 } },
    cornucopia_charm: { name: 'Cornucopia Charm', textColor:'#44cc44', tradeValue: 48, tier: 2, description: 'A charm of abundance. Cooking yields extra food.', pedestal: { radius: 'global', manaCost: 1, cookingBonusFood: 1 } },
    compass_of_greed: { name: 'Compass of Greed', textColor:'#44cc44', tradeValue: 40, tier: 2, description: 'Points toward treasure, but attracts danger.', expedition: { lootMult: 1.5, trapDamageMult: 1.2 } },
    voidwalkers_lantern: { name: "Voidwalker's Lantern", textColor:'#4488ff', tradeValue: 60, tier: 3, description: 'A lantern fueled by void energy. Reveals hidden paths.', expedition: { rareEncounterMult: 2.0 }, pedestal: { radius: 6, manaCost: 2, lightRadius: 4 } },
    map_fragment: { name: 'Map Fragment', textColor:'#cccccc', tradeValue: 25, tier: 2, description: 'A torn piece of an ancient map. Shortens expeditions.', consumable: true, expedition: { durationMult: 0.7 } },
    ward_of_the_sentinel: { name: 'Ward of the Sentinel', textColor:'#f944ff', tradeValue: 85, tier: 3, description: 'A one-use ward that revives the bearer from death.', autoReviveHp: 0.5, durability: { max: 1, breakOnUse: true }, recipe: { input: { void_essence: 4, runite: 3, stone: 2 }, ticks: 65, research: 'void_forging', station: 'enchanting_table' } },
    hagglers_coin: { name: "Haggler's Coin", textColor:'#44cc44', tradeValue: 48, tier: 2, description: 'A lucky coin that improves trade deals.', pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.85 } },
    tome_of_shared_wisdom: { name: 'Tome of Shared Wisdom', textColor:'#4488ff', tradeValue: 65, tier: 3, description: 'A tome that accelerates skill growth for those nearby.', pedestal: { radius: 5, manaCost: 2, skillGrowthBonus: 0.1 } },
    arcane_amplifier: { name: 'Arcane Amplifier', textColor:'#4488ff', tradeValue: 72, tier: 3, description: 'A crystal that amplifies all magical output.', spellDamageBonus: 0.35, expedition: { partyDamageMult: 1.1 } },
    void_charm: { name: 'Void Charm', textColor:'#ff4444', tradeValue: 95, tier: 4, description: 'A charm that seems to make your weapons cut through dimensions.', targetPriority: 5, damageReduction: 0.1, expedition: { partyDamageMult: 1.25 } },
    dimensional_orb: { name: 'Dimensional Orb', textColor:'#ff4444', tradeValue: 105, tier: 4, description: 'An orb that bends space. Shortens journeys dramatically.', expedition: { durationMult: 0.6, rareEncounterMult: 2.5 }, pedestal: { radius: 'global', manaCost: 3, wandererChanceMult: 1.3 } },
    shard_of_oblivion: { name: 'Shard of Oblivion', textColor:'#ff4444', tradeValue: 95, tier: 4, description: 'A shard of pure destruction. Devastating but dangerous.', targetPriority: 5, expedition: { partyDamageMult: 1.4, trapDamageMult: 1.5 } },
    voidheart: { name: 'Voidheart', textColor:'#ff4444', tradeValue: 120, tier: 4, description: 'The heart of the void itself. Ultimate arcane power.', spellDamageBonus: 0.5, moveSpeedBonus: 0.2, pedestal: { radius: 'global', manaCost: 4, damageBonusMult: 1.2 } },
    amulet_of_fortune: { name: 'Amulet of Fortune', textColor:'#44cc44', tradeValue: 50, tier: 2, description: 'A lucky amulet that accelerates learning.', pedestal: { radius: 'global', manaCost: 1, skillGrowthBonus: 0.2 } },
    merchants_ring: { name: "Merchant's Ring", textColor:'#44cc44', tradeValue: 40, tier: 2, description: 'A ring favored by traders. Slightly improves deals.', pedestal: { radius: 'global', manaCost: 1, tradeMarkupMult: 0.9 } },
    warden_censer: { name: "Warden's Censer", textColor:'#4488ff', tradeValue: 68, tier: 3, description: 'A censer of blessed smoke that knits the wounds of the bearer and nearby allies.', healthRegen: 0.05, pedestal: { radius: 6, manaCost: 2, healthRegen: 0.05 }, recipe: { input: { runite: 2, moonbloom: 3, planks: 2 }, ticks: 45, research: 'runeforging', station: 'enchanting_table' } },
    ley_battery: { name: 'Ley Battery', textColor:'#4488ff', tradeValue: 70, tier: 3, description: 'A crystal that siphons ambient ley energy, sustaining a caster mid-battle.', manaRegen: 0.08, spellCostReduction: 0.12, recipe: { input: { runite: 2, moonbloom: 2, void_essence: 1 }, ticks: 42, research: 'void_sorcery', station: 'enchanting_table' } },
    hunters_quiver: { name: "Hunter's Quiver", textColor:'#44cc44', tradeValue: 50, tier: 2, critChance: 0.1, attackSpeed: 0.1, description: 'An enchanted quiver whose arrows never run short.', recipe: { input: { runite: 1, leather: 3, planks: 1 }, ticks: 30, research: 'marksmanship', station: 'enchanting_table' } },

    // ── School-focused trinkets ──
    // Each pushes ONE school hard via a `<school>Bonus` stat (read alongside the
    // generic spellDamageBonus by getEquipmentSchoolBonus), rewarding a colonist
    // who commits to that school. A couple also carry non-damage spell stats
    // (spellHealBonus, spellDurationBonus, spellCooldownReduction) so gear can
    // amplify heals/buffs/recast rate, not just damage.
    ember_sigil: { name: 'Ember Sigil', textColor:'#ff6644', tradeValue: 68, tier: 3, description: 'A searing rune that concentrates destructive fire. Amplifies Evocation spells.', evocationBonus: 0.4, recipe: { input: { runite: 2, void_essence: 1, planks: 2 }, ticks: 40, research: 'void_sorcery', station: 'enchanting_table' } },
    verdant_talisman: { name: 'Verdant Talisman', textColor:'#88ff88', tradeValue: 62, tier: 3, description: 'A talisman pulsing with growth. Strengthens and prolongs Transmutation magic.', transmutationBonus: 0.35, spellDurationBonus: 0.25, recipe: { input: { moonbloom: 3, runite: 1, planks: 2 }, ticks: 40, research: 'advanced_arcana', station: 'enchanting_table' } },
    healers_pendant: { name: "Healer's Pendant", textColor:'#44ff44', tradeValue: 66, tier: 3, description: 'A blessed pendant that magnifies restorative magic. Boosts Abjuration and healing.', abjurationBonus: 0.3, spellHealBonus: 0.3, recipe: { input: { moonbloom: 3, runite: 2, planks: 1 }, ticks: 42, research: 'advanced_arcana', station: 'enchanting_table' } },
    charmweave_band: { name: 'Charmweave Band', textColor:'#88ffff', tradeValue: 60, tier: 3, description: 'A woven band that extends the reach of supportive magic. Boosts Enchantment.', enchantmentBonus: 0.3, spellDurationBonus: 0.3, recipe: { input: { runite: 2, leather: 2, moonbloom: 1 }, ticks: 38, research: 'advanced_arcana', station: 'enchanting_table' } },
    summoners_focus: { name: "Summoner's Focus", textColor:'#9966ff', tradeValue: 74, tier: 3, description: 'A focus stone that quickens the summoner\'s art. Boosts Conjuration and recast speed.', conjurationBonus: 0.35, spellCooldownReduction: 0.2, recipe: { input: { void_essence: 2, runite: 2, planks: 1 }, ticks: 44, research: 'void_sorcery', station: 'enchanting_table' } },
    seers_eye: { name: "Seer's Eye", textColor:'#ccaaff', tradeValue: 70, tier: 3, description: 'An unblinking eye that sharpens fate-magic, letting divinations be woven more often.', divinationBonus: 0.2, spellCooldownReduction: 0.25, recipe: { input: { moonbloom: 2, void_essence: 2, planks: 1 }, ticks: 44, research: 'advanced_arcana', station: 'enchanting_table' } },
};

export const POTIONS = {
    health_potion: { name: 'Health Potion', trigger: 'lowHealth', hpThreshold: 0.4, effect: 'heal', healAmount: 50, cooldown: 30, description: 'A restorative brew that mends wounds.', recipe: { input: { berries: 3, wheat: 1 }, skill: 'cooking', ticks: 16, station: 'alchemy_table', research: 'alchemy' } },
    speed_potion: { name: 'Speed Potion', trigger: 'hasTask', effect: 'speed', moveSpeedBonus: 0.5, workSpeedBonus: 0.3, duration: 100, cooldown: 400, description: 'An invigorating tonic that quickens body and mind.', recipe: { input: { corn: 2, potatoes: 2, berries: 1 }, skill: 'cooking', ticks: 20, station: 'alchemy_table', research: 'alchemy' } },
    mana_potion: { name: 'Mana Potion', trigger: 'lowMana', manaThreshold: 0.3, effect: 'restoreMana', manaAmount: 30, cooldown: 300, description: 'A shimmering elixir that restores magical energy.', recipe: { input: { moonbloom: 3, runite: 1 }, skill: 'cooking', ticks: 22, station: 'alchemy_table', research: 'herbalism' } },
    resistance_potion: { name: 'Resistance Potion', trigger: 'inCombat', effect: 'resistance', damageReduction: 0.25, duration: 80, cooldown: 500, description: 'A thick draught that hardens the body against blows.', recipe: { input: { moonbloom: 2, stone: 2, iron: 1 }, skill: 'cooking', ticks: 25, station: 'alchemy_table', research: 'herbalism' } },
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

// Unified item registry — every non-stackable item with its type and optional tradeValue.
// Built by merging all item dicts; SPELL_TOMES are merged in config/index.js after import.
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

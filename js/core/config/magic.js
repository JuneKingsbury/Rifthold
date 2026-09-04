import { BUILDINGS } from './buildings.js';
import { RECIPES } from './equipment.js';
import { CROPS } from './world.js';

export const MAGIC_SKILLS = {
    evocation:     { name: 'Evocation', baseLevel: [0, 0], biasBonus: 2, color: '#ff6644', description: 'Combat magic' },
    enchantment:   { name: 'Enchantment', baseLevel: [0, 0], biasBonus: 2, color: '#88ffff', description: 'Supportive magic' },
    abjuration:    { name: 'Abjuration', baseLevel: [0, 0], biasBonus: 2, color: '#44ff44', description: 'Healing and protective magic' },
    conjuration:   { name: 'Conjuration', baseLevel: [0, 0], biasBonus: 2, color: '#9966ff', description: 'Summoning and teleportation magic' },
    transmutation: { name: 'Transmutation', baseLevel: [0, 0], biasBonus: 2, color: '#88ff88', description: 'Environmental and growth magic' },
    divination:    { name: 'Divination', baseLevel: [0, 0], biasBonus: 2, color: '#ccaaff', description: 'Influencing fate with magic' },
};

export const MANA_CONFIG = {
    baseMana: 20,
    manaPerMagicLevel: 5,
    // Mana pool is driven by the colonist's HIGHEST school. Levels in other schools
    // contribute only at manaFocusFactor of the rate. This makes focusing one school
    // grow the pool faster than spreading levels across many.
    manaFocusFactor: 0.5,
    baseRegen: 0.05,
    regenPerMagicLevel: 0.01,
    regenWhileIdle: 2.0,
    regenWhileSleeping: 3.0,
};

export const SPELLS = {
    // Evocation
    spark: { name: 'Spark', school: 'evocation', minLevel: 0, manaCost: 4, cooldown: 25, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 6, range: 4, projectileColor: '#ffaa33', projectileChar: '.' },
    magic_missile: { name: 'Magic Missile', school: 'evocation', minLevel: 2, manaCost: 8, cooldown: 30, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage', damage: 15, range: 6, projectileColor: '#ff44ff', projectileChar: '*' },
    smite: { name: 'Smite', school: 'evocation', minLevel: 2, manaCost: 6, cooldown: 20, castType: 'auto', trigger: 'inCombat', effect: 'melee_damage', damage: 12, range: 1, projectileColor: '#ffffaa', projectileChar: '✝' },
    fireball: { name: 'Fireball', school: 'evocation', minLevel: 4, manaCost: 18, cooldown: 60, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_aoe', damage: 12, range: 7, radius: 3, projectileColor: '#ff6600', projectileChar: '●' },
    // Chain Lightning arcs from the primary target to nearby foes, each arc dealing
    // chainFalloff× the previous hit's damage. chainTargets counts the primary hit.
    chain_lightning: { name: 'Chain Lightning', school: 'evocation', minLevel: 3, manaCost: 14, cooldown: 45, castType: 'auto', trigger: 'inCombat', effect: 'chain_damage', damage: 11, range: 6, chainTargets: 3, chainFalloff: 0.6, chainRange: 4, projectileColor: '#88ddff', projectileChar: '⚡' },
    // Frost Lance deals damage and slows the target (movement + attack cadence). Slow is
    // soft CC: slowMult scales speed in the colony, slowRounds skips no turn but adds a
    // "slowed" status in expeditions that reduces the enemy's attacks that round.
    frost_lance: { name: 'Frost Lance', school: 'evocation', minLevel: 3, manaCost: 12, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'ranged_damage_slow', damage: 12, range: 6, slowMult: 0.5, slowDuration: 60, slowRounds: 2, projectileColor: '#aaddff', projectileChar: '❄' },

    // Abjuration
    mend: { name: 'Mend', school: 'abjuration', minLevel: 0, manaCost: 5, cooldown: 60, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.5, effect: 'heal', healAmount: 8, range: 4 },
    renewal: { name: 'Renewal', school: 'abjuration', minLevel: 3, manaCost: 14, cooldown: 90, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.6, effect: 'heal', healAmount: 28, range: 6 },
    shield: { name: 'Shield', school: 'abjuration', minLevel: 4, manaCost: 15, cooldown: 150, castType: 'auto', trigger: 'inCombat', effect: 'buff_defense', damageReduction: 0.3, duration: 60, radius: 4 },
    // Chain Heal is the abjuration counterpart to Chain Lightning: it mends the most
    // wounded ally, then bounces to further wounded allies, each bounce healing
    // chainFalloff× the previous. chainTargets counts the primary heal.
    chain_heal: { name: 'Chain Heal', school: 'abjuration', minLevel: 4, manaCost: 18, cooldown: 100, castType: 'auto', trigger: 'woundedNearby', hpThreshold: 0.7, effect: 'chain_heal', healAmount: 16, range: 6, chainTargets: 3, chainFalloff: 0.6, chainRange: 5 },
    // Cleanse strips harmful statuses (bleed/poison/burn/slow/debuff DoTs) from the most
    // afflicted ally in range. Fires whenever an ally nearby is suffering a debuff.
    cleanse: { name: 'Cleanse', school: 'abjuration', minLevel: 1, manaCost: 8, cooldown: 50, castType: 'auto', trigger: 'debuffNearby', effect: 'cleanse', range: 6 },
    // Guardian Ward grants a flat HP absorb-shield bubble that soaks damage before HP.
    // Scales with school mastery. Distinct from Shield's percentage damage reduction.
    guardian_ward: { name: 'Guardian Ward', school: 'abjuration', minLevel: 3, manaCost: 16, cooldown: 140, castType: 'auto', trigger: 'inCombat', effect: 'absorb_shield', absorbAmount: 30, duration: 120, radius: 4 },

    // Enchantment
    quicken: { name: 'Quicken', school: 'enchantment', minLevel: 0, manaCost: 6, cooldown: 80, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', moveSpeedBonus: 0, workSpeedBonus: 0.2, duration: 40, radius: 3 },
    haste: { name: 'Haste', school: 'enchantment', minLevel: 2, manaCost: 12, cooldown: 200, castType: 'auto', trigger: 'hasTask', effect: 'buff_speed', moveSpeedBonus: 0.4, workSpeedBonus: 0.2, duration: 80, idleExclude: true, radius: 5 },
    // Diligence: aura that improves craft/build quality odds for working allies (read in
    // task-executor applyQuality via a 'quality' activeEffect). Fires while working.
    diligence: { name: 'Diligence', school: 'enchantment', minLevel: 1, manaCost: 8, cooldown: 120, castType: 'auto', trigger: 'hasTask', effect: 'buff_quality', qualityBonus: 3, duration: 150, radius: 4 },
    // Tireless: slows rest-need decay for allies (read in updateNeeds via a 'rest' effect).
    tireless: { name: 'Tireless', school: 'enchantment', minLevel: 2, manaCost: 12, cooldown: 300, castType: 'auto', trigger: 'always', effect: 'buff_rest', restDecayMult: 0.4, duration: 300, idleExclude: true, radius: 5 },
    // Mesmerize: brief stun/pacify on a foe (skips its turn / freezes it). Light CC.
    mesmerize: { name: 'Mesmerize', school: 'enchantment', minLevel: 3, manaCost: 12, cooldown: 90, castType: 'auto', trigger: 'inCombat', effect: 'stun', range: 6, stunDuration: 45, stunRounds: 1, projectileColor: '#ffccff', projectileChar: '✦' },

    // Conjuration
    phase_step: { name: 'Phase Step', school: 'conjuration', minLevel: 0, manaCost: 6, cooldown: 50, castType: 'auto', trigger: 'inCombat', effect: 'teleport', range: 5 },
    summon_familiar: { name: 'Summon Familiar', school: 'conjuration', minLevel: 0, manaCost: 15, cooldown: 400, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'familiar' },
    warp: { name: 'Warp', school: 'conjuration', minLevel: 2, manaCost: 15, cooldown: 100, castType: 'targeted', effect: 'teleport', range: 15 },
    summon_ghost: { name: 'Summon Ghost', school: 'conjuration', minLevel: 2, manaCost: 25, cooldown: 300, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'ghost' },
    gate: { name: 'Gate', school: 'conjuration', minLevel: 4, manaCost: 25, cooldown: 200, castType: 'targeted', effect: 'teleport', range: 30 },
    summon_monster: { name: 'Summon Monster', school: 'conjuration', minLevel: 4, manaCost: 40, cooldown: 600, castType: 'auto', trigger: 'inCombat', effect: 'summon', summonType: 'monster' },
    // Spectral Swarm conjures several weak, short-lived skirmishers at once (vs. the single
    // summon of the other conjuration spells). swarmCount uses the spectral_wisp entity.
    spectral_swarm: { name: 'Spectral Swarm', school: 'conjuration', minLevel: 3, manaCost: 22, cooldown: 350, castType: 'auto', trigger: 'inCombat', effect: 'summon_swarm', summonType: 'spectral_wisp', swarmCount: 3 },

    // Transmutation
    nurture: { name: 'Nurture', school: 'transmutation', minLevel: 0, manaCost: 8, cooldown: 600, castType: 'auto', trigger: 'cropsNearby', effect: 'boost_crops', range: 5, radius: 1, growthMult: 1.5, duration: 100 },
    circle_of_growth: { name: 'Circle of Growth', school: 'transmutation', minLevel: 2, manaCost: 20, cooldown: 1200, castType: 'auto', trigger: 'cropsNearby', effect: 'boost_crops', range: 10, radius: 3, growthMult: 2.0, duration: 200 },
    level_field: { name: 'Level Field', school: 'transmutation', minLevel: 4, manaCost: 30, cooldown: 600, castType: 'targeted', effect: 'terraform', range: 8, radius: 3, targetTerrain: 'grass' },
    // Stone Shape instantly completes a targeted construction (build task) or repairs a
    // damaged structure, matter shaped to will. Targeted so the player picks the tile.
    stone_shape: { name: 'Stone Shape', school: 'transmutation', minLevel: 2, manaCost: 18, cooldown: 200, castType: 'targeted', effect: 'finish_construction', range: 12 },
    // Transmutation alchemy of the colony's stores, split into three tiers that each
    // auto-cast (trigger 'canTransmute') only when the conversion is actually possible,
    // i.e. enough of the input material is stockpiled. A missing `fromResource` means the
    // output is conjured from nothing (Transmute Stone). Cheaper/faster at the low tier,
    // costlier/slower and stingier at the high tier so runite stays scarce.
    transmute_stone: { name: 'Transmute Stone', school: 'transmutation', minLevel: 2, manaCost: 10, cooldown: 200, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', toResource: 'stone', outputAmount: 8 },
    transmute_iron: { name: 'Transmute Iron', school: 'transmutation', minLevel: 3, manaCost: 18, cooldown: 300, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', fromResource: 'stone', inputAmount: 10, toResource: 'iron_ore', outputAmount: 6 },
    transmute_runite: { name: 'Transmute Runite', school: 'transmutation', minLevel: 4, manaCost: 28, cooldown: 500, castType: 'auto', trigger: 'canTransmute', effect: 'transmute', fromResource: 'iron', inputAmount: 8, toResource: 'runite', outputAmount: 2 },
    // Verdant Bloom instantly ripens all mature growing crops in radius (sets them ready to
    // harvest). Targeted burst of growth, the payoff transmutation capstone for farms.
    verdant_bloom: { name: 'Verdant Bloom', school: 'transmutation', minLevel: 4, manaCost: 28, cooldown: 500, castType: 'targeted', effect: 'ripen_crops', range: 10, radius: 3, ripenThreshold: 0.5 },

    // Divination
    foresight: { name: 'Foresight', school: 'divination', minLevel: 0, manaCost: 6, cooldown: 300, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { raidDelay: 200 }, duration: 300 },
    fair_winds: { name: 'Fair Winds', school: 'divination', minLevel: 2, manaCost: 10, cooldown: 400, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { weatherBias: 'clear' }, duration: 200 },
    merchants_omen: { name: "Merchant's Omen", school: 'divination', minLevel: 3, manaCost: 15, cooldown: 600, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'caravan', eventMult: 3.0 }, duration: 400 },
    ward_of_calamity: { name: 'Ward of Calamity', school: 'divination', minLevel: 4, manaCost: 20, cooldown: 800, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { suppressEvents: ['blight_bloom', 'cold_snap', 'fire'], blightSpreadSuppressed: true }, duration: 500 },
    fortunate_discovery: { name: 'Fortunate Discovery', school: 'divination', minLevel: 5, manaCost: 25, cooldown: 1000, castType: 'auto', trigger: 'always', effect: 'divination_modifier', modifiers: { eventBoost: 'meteorite', eventMult: 5.0 }, duration: 600 },
};

export const SPELL_TOMES = {
    // Evocation
    tome_of_spark: { name: 'Tome of Spark', tradeValue: 12, spell: 'spark', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a basic bolt of fire at nearby foes.' },
    tome_of_smite: { name: 'Tome of Smite', tradeValue: 22, spell: 'smite', learningWork: 120, minSchoolLevel: 2, description: 'Teaches a powerful melee strike of holy energy.' },
    tome_of_magic_missile: { name: 'Tome of Magic Missile', tradeValue: 28, spell: 'magic_missile', learningWork: 150, minSchoolLevel: 2, description: 'Teaches a potent ranged arcane bolt.' },
    tome_of_fireball: { name: 'Tome of Fireball', tradeValue: 58, spell: 'fireball', learningWork: 350, minSchoolLevel: 4, description: 'Teaches an explosive fireball that damages an area.' },
    tome_of_chain_lightning: { name: 'Tome of Chain Lightning', tradeValue: 44, spell: 'chain_lightning', learningWork: 260, minSchoolLevel: 3, description: 'Teaches lightning that arcs between multiple nearby foes.' },
    tome_of_frost_lance: { name: 'Tome of Frost Lance', tradeValue: 40, spell: 'frost_lance', learningWork: 240, minSchoolLevel: 3, description: 'Teaches a frozen lance that wounds and slows its target.' },

    // Abjuration
    tome_of_mend: { name: 'Tome of Mend', tradeValue: 12, spell: 'mend', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a healing incantation that mends the most wounded nearby (self or ally).' },
    tome_of_renewal: { name: 'Tome of Renewal', tradeValue: 40, spell: 'renewal', learningWork: 230, minSchoolLevel: 3, description: 'Teaches potent healing magic that mends the most wounded nearby (self or ally).' },
    tome_of_shield: { name: 'Tome of Shield', tradeValue: 52, spell: 'shield', learningWork: 320, minSchoolLevel: 4, description: 'Teaches a protective barrier that reduces damage.' },
    tome_of_chain_heal: { name: 'Tome of Chain Heal', tradeValue: 54, spell: 'chain_heal', learningWork: 330, minSchoolLevel: 4, description: 'Teaches healing that leaps between wounded allies.' },
    tome_of_cleanse: { name: 'Tome of Cleanse', tradeValue: 20, spell: 'cleanse', learningWork: 110, minSchoolLevel: 1, description: 'Teaches a purifying spell that removes poison, bleed and other afflictions.' },
    tome_of_guardian_ward: { name: 'Tome of Guardian Ward', tradeValue: 46, spell: 'guardian_ward', learningWork: 280, minSchoolLevel: 3, description: 'Teaches an absorbing barrier that soaks a burst of damage.' },

    // Enchantment
    tome_of_quicken: { name: 'Tome of Quicken', tradeValue: 12, spell: 'quicken', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a spell to hasten work speed.' },
    tome_of_haste: { name: 'Tome of Haste', tradeValue: 45, spell: 'haste', learningWork: 280, minSchoolLevel: 2, description: 'Teaches a powerful speed enhancement spell.' },
    tome_of_diligence: { name: 'Tome of Diligence', tradeValue: 22, spell: 'diligence', learningWork: 120, minSchoolLevel: 1, description: 'Teaches an aura that sharpens the craft of nearby workers.' },
    tome_of_tireless: { name: 'Tome of Tireless', tradeValue: 38, spell: 'tireless', learningWork: 220, minSchoolLevel: 2, description: 'Teaches a spell that staves off fatigue in allies.' },
    tome_of_mesmerize: { name: 'Tome of Mesmerize', tradeValue: 40, spell: 'mesmerize', learningWork: 240, minSchoolLevel: 3, description: 'Teaches an enchantment that briefly stuns a foe.' },

    // Conjuration
    tome_of_phase_step: { name: 'Tome of Phase Step', tradeValue: 12, spell: 'phase_step', learningWork: 60, minSchoolLevel: 0, description: 'Teaches instant teleportation a short distance away.' },
    tome_of_summon_familiar: { name: 'Tome of Summon Familiar', tradeValue: 24, spell: 'summon_familiar', learningWork: 120, minSchoolLevel: 0, description: 'Teaches summoning a familiar to fight alongside.' },
    tome_of_warp: { name: 'Tome of Warp', tradeValue: 38, spell: 'warp', learningWork: 230, minSchoolLevel: 2, description: 'Teaches instant teleportation to a target location.' },
    tome_of_summon_ghost: { name: 'Tome of Summon Ghost', tradeValue: 70, spell: 'summon_ghost', learningWork: 440, minSchoolLevel: 2, description: 'Teaches summoning a spectral warrior.' },
    tome_of_gate: { name: 'Tome of Gate', tradeValue: 38, spell: 'gate', learningWork: 440, minSchoolLevel: 4, description: 'Teaches instant teleportation to a distant location.' },
    tome_of_summon_monster: { name: 'Tome of Summon Monster', tradeValue: 70, spell: 'summon_monster', learningWork: 650, minSchoolLevel: 4, description: 'Teaches summoning a monster under your control.' },
    tome_of_spectral_swarm: { name: 'Tome of Spectral Swarm', tradeValue: 56, spell: 'spectral_swarm', learningWork: 340, minSchoolLevel: 3, description: 'Teaches summoning a swarm of fleeting spectral skirmishers.' },

    // Transmuation
    tome_of_nurture: { name: 'Tome of Nurture', tradeValue: 12, spell: 'nurture', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a spell to accelerate crop growth.' },
    tome_of_circle_of_growth: { name: 'Tome of Circle of Growth', tradeValue: 40, spell: 'circle_of_growth', learningWork: 240, minSchoolLevel: 2, description: 'Teaches a wide-area crop growth enhancement.' },
    tome_of_level_field: { name: 'Tome of Level Field', tradeValue: 70, spell: 'level_field', learningWork: 440, minSchoolLevel: 4, description: 'Teaches terrain-shaping transmutation magic.' },
    tome_of_stone_shape: { name: 'Tome of Stone Shape', tradeValue: 44, spell: 'stone_shape', learningWork: 260, minSchoolLevel: 2, description: 'Teaches shaping matter to finish or mend a structure instantly.' },
    tome_of_transmute_stone: { name: 'Tome of Transmute Stone', tradeValue: 30, spell: 'transmute_stone', learningWork: 180, minSchoolLevel: 2, description: 'Teaches conjuring usable stone from raw earth.' },
    tome_of_transmute_iron: { name: 'Tome of Transmute Iron', tradeValue: 50, spell: 'transmute_iron', learningWork: 300, minSchoolLevel: 3, description: 'Teaches transmuting stone into raw iron chunks.' },
    tome_of_transmute_runite: { name: 'Tome of Transmute Runite', tradeValue: 68, spell: 'transmute_runite', learningWork: 420, minSchoolLevel: 4, description: 'Teaches transmuting iron bars into precious runite.' },
    tome_of_verdant_bloom: { name: 'Tome of Verdant Bloom', tradeValue: 66, spell: 'verdant_bloom', learningWork: 420, minSchoolLevel: 4, description: 'Teaches a surge of growth that ripens crops at once.' },

    // Divination
    tome_of_foresight: { name: 'Tome of Foresight', tradeValue: 12, spell: 'foresight', learningWork: 60, minSchoolLevel: 0, description: 'Teaches a divination that delays enemy raids.' },
    tome_of_fair_winds: { name: 'Tome of Fair Winds', tradeValue: 28, spell: 'fair_winds', learningWork: 150, minSchoolLevel: 2, description: 'Teaches a spell that biases weather toward clear skies.' },
    tome_of_merchants_omen: { name: "Tome of Merchant's Omen", tradeValue: 40, spell: 'merchants_omen', learningWork: 240, minSchoolLevel: 3, description: 'Teaches a divination that attracts caravans.' },
    tome_of_ward_of_calamity: { name: 'Tome of Ward of Calamity', tradeValue: 58, spell: 'ward_of_calamity', learningWork: 350, minSchoolLevel: 4, description: 'Teaches a ward that suppresses natural disasters.' },
    tome_of_fortunate_discovery: { name: 'Tome of Fortunate Discovery', tradeValue: 70, spell: 'fortunate_discovery', learningWork: 440, minSchoolLevel: 5, description: 'Teaches a divination that attracts meteorites.' },
};

export const RESEARCH_TABS = [
    { key: 'foundations', name: 'Foundations' },
    { key: 'nature', name: 'Nature' },
    { key: 'mana', name: 'Mana' },
    { key: 'crafting', name: 'Crafting' },
    { key: 'magic', name: 'Magic' },
    { key: 'rifts', name: 'Rifts' },
];

export const RESEARCH = {
    // Foundations
    runecraft: { name: 'Runecraft', cost: 80, requires: [], tab: 'foundations', description: 'Etch runes into stone weapons'},
    metalworking: { name: 'Metalworking', cost: 100, requires: [], tab: 'foundations', description: 'Smelting metal and crafting gear at anvils' },
    ley_channeling: { name: 'Ley Channeling', cost: 300, requires: ['runecraft', 'metalworking'], tab: 'foundations', description: 'Tap leylines for mana', requiresBuildings: { anvil: 1 } },
    alchemy: { name: 'Alchemy', cost: 150, requires: ['metalworking'], tab: 'foundations', description: 'Learn how to brew potions. Cooking also produces +2 bonus food per meal' },
    trade_routes: { name: 'Trade Routes', cost: 300, requires: ['alchemy'], tab: 'foundations', description: 'Caravans arrive more often and offer better prices' },
    trade_rifts: { name: 'Trade Rifts', cost: 450, requires: ['trade_routes', 'void_summoning'], tab: 'foundations', description: 'Open Trade Rifts to barter materials with far-off traders for mystery goods' },
    domestic_alchemy: { name: 'Domestic Alchemy', cost: 280, requires: ['alchemy'], tab: 'foundations', description: 'Brew tonics for use around the colony' },
    battle_brewing: { name: 'Battle Brewing', cost: 500, requires: ['domestic_alchemy', 'herbalism'], tab: 'foundations', description: 'Brew potions for expeditions, making it easier for your colonists to go further' },

    // Wildlife
    beast_binding: { name: 'Beast Binding', cost: 280, requires: ['druidcraft'], tab: 'nature', description: 'Bind and pen creatures' },
    husbandry: { name: 'Husbandry', cost: 350, requires: ['beast_binding'], tab: 'nature', description: 'Tamed animals produce 50% more resources' },
    wolf_mastery: { name: 'Wolf Mastery', cost: 350, requires: ['husbandry'], tab: 'nature', description: 'Wolf tame chance +20%, tamed wolves deal +4 damage' },
    druidcraft: { name: 'Druidcraft', cost: 110, requires: [], tab: 'nature', description: 'Unlock corn and potatoes' },
    textiles: { name: 'Textiles', cost: 150, requires: [], tab: 'nature', description: 'Grow cotton and weave cloth into clothing at the loom' },
    irrigation: { name: 'Irrigation', cost: 250, requires: ['druidcraft'], tab: 'nature', description: 'Crops grow in winter at half speed; water-adjacent farms grow 20% faster' },
    herbalism: { name: 'Herbalism', cost: 350, requires: ['alchemy', 'irrigation'], tab: 'nature', description: 'Grow moonbloom and brew mana/resistance potions' },
    verdant_growth: { name: 'Verdant Growth', cost: 500, requires: ['herbalism'], tab: 'nature', description: 'All crops gain +1 harvest yield; moonbloom grows 30% faster' },

    // Crafting
    marksmanship: { name: 'Marksmanship', cost: 250, requires: ['runecraft'], tab: 'crafting', description: 'Crossbow crafting and +1 range to all ranged weapons' },
    arcane_implements: { name: 'Arcane Implements', cost: 250, requires: ['runecraft', 'ley_channeling'], tab: 'crafting', description: 'Craft wands and staves for spellcasters' },
    artisans_touch: { name: "Artisan's Touch", cost: 450, requires: ['arcane_implements'], tab: 'crafting', description: 'Better crafting quality odds; salvage returns 75%' },
    runeforging: { name: 'Runeforging', cost: 350, requires: ['arcane_implements'], tab: 'crafting', description: 'Forge runic weapons' },
    masterwork: { name: 'Masterwork', cost: 800, requires: ['runeforging', 'arcane_infusion', 'artisans_touch'], tab: 'crafting', description: 'Forge legendary enchanted weapons', requiresBuildings: { enchanting_table: 1 }, requiresMilestone: { stat: 'superiorItemsCrafted', min: 1 }, requiresTabCount: 3 },
    golem_craft: { name: 'Golem Craft', cost: 1000, requires: ['arcane_infusion', 'void_forging', 'mana_reservoir', 'runeforging'], tab: 'crafting', description: 'Animate stone golems to serve as tireless workers', requiresBuildings: { enchanting_table: 1 }, requiresTabCount: 3 },

    // Spells
    arcane_studies: { name: 'Arcane Studies', cost: 180, requires: ['runecraft'], tab: 'magic', description: 'Study and craft basic spell tomes' },
    arcane_infusion: { name: 'Arcane Infusion', cost: 450, requires: ['ley_channeling', 'alchemy'], tab: 'magic', description: 'Enchant equipment and craft faster by infusing magic into the process', requiresBuildings: { mana_crystal: 2 } },
    advanced_arcana: { name: 'Advanced Arcana', cost: 550, requires: ['arcane_studies', 'arcane_infusion'], tab: 'magic', description: 'Craft advanced spell tomes', requiresBuildings: { scriptorium: 1 } },
    void_sorcery: { name: 'Void Sorcery', cost: 600, requires: ['advanced_arcana'], tab: 'magic', description: 'Craft runic wands and void staves', requiresTabCount: 3 },
    mana_weaving: { name: 'Mana Weaving', cost: 650, requires: ['arcane_infusion', 'textiles'], tab: 'magic', description: 'Weave mana into protective garb', requiresTabCount: 3 },

    // Mana
    luminance: { name: 'Luminance', cost: 200, requires: ['ley_channeling'], tab: 'mana', description: 'Mana-powered light' },
    brilliance: { name: 'Brilliance', cost: 500, requires: ['ember_magic'], tab: 'mana', description: 'Radiant beacon lights large areas', requiresTabCount: 3 },
    arcane_conduits: { name: 'Arcane Conduits', cost: 400, requires: ['ley_channeling'], tab: 'mana', description: 'Mana relays reduce nearby building consumption' },
    ember_magic: { name: 'Ember Magic', cost: 250, requires: ['luminance'], tab: 'mana', description: 'Ember Beacons: smart warmth that only draws mana in winter' },
    mana_reservoir: { name: 'Mana Reservoir', cost: 600, requires: ['arcane_conduits'], tab: 'mana', description: 'Mana crystal cap +3 and each generates +1 mana', requiresTabCount: 3 },
    pyroclasm: { name: 'Pyroclasm', cost: 750, requires: ['brilliance'], tab: 'mana', description: 'Fire ward incinerates nearby foes', requiresTabCount: 3 },

    // Rifts
    warding: { name: 'Warding', cost: 250, requires: ['runecraft'], tab: 'rifts', description: 'Conjure defensive wards and build tougher structures using bricks' },
    fortification: { name: 'Fortification', cost: 350, requires: ['warding', 'metalworking'], tab: 'rifts', description: 'Reinforced doors and faster wall auto-repair' },
    void_summoning: { name: 'Unstable Rifts', cost: 550, requires: ['ley_channeling', 'warding'], tab: 'rifts', description: 'Open unstable rifts to summon waves of enemies', requiresMilestone: { stat: 'raidsDefeated', min: 1 } },
    void_architecture: { name: 'Void Architecture', cost: 400, requires: ['void_summoning'], tab: 'rifts', description: 'Build void-reinforced walls and doors' },
    void_forging: { name: 'Void Forging', cost: 750, requires: ['void_architecture', 'runeforging'], tab: 'rifts', description: 'Forge void essence into powerful gear', requiresTabCount: 3 },
    planar_rift: { name: 'Planar Rifts', cost: 800, requires: ['void_summoning', 'arcane_infusion'], tab: 'rifts', description: 'Open stable rifts for exploration expeditions', requiresMilestone: { stat: 'wavesCompleted', min: 1 } },
    deep_delving: { name: 'Deep Delving', cost: 1200, requires: ['planar_rift'], tab: 'rifts', description: 'Access deeper, more dangerous realms', requiresBuildings: { rift_gate: 1 }, requiresMilestone: { stat: 'expeditionsCompleted', min: 1 }, requiresTabCount: 3 },
};

export const DEMO_LOCKED_RESEARCH = new Set([
    'advanced_arcana', 'void_sorcery', 'masterwork', 'golem_craft', 'mana_weaving',
    'mana_reservoir', 'brilliance', 'pyroclasm', 'void_architecture',
    'void_forging', 'deep_delving', 'trade_rifts'
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

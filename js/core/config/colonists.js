export const SKILLS = {
    building: { name: 'Building', baseLevel: [2, 4], biasBonus: 3, description: 'Construction, mining, chopping, and repairs' },
    farming:  { name: 'Farming', baseLevel: [2, 4], biasBonus: 3, description: 'Planting and harvesting crops' },
    crafting: { name: 'Crafting', baseLevel: [2, 4], biasBonus: 3, description: 'Crafting items at workbenches' },
    cooking:  { name: 'Cooking', baseLevel: [2, 4], biasBonus: 3, description: 'Cooking meals at cauldrons' },
    animals:  { name: 'Animals', baseLevel: [1, 3], biasBonus: 3, description: 'Taming and handling animals' },
    research: { name: 'Research', baseLevel: [1, 2], biasBonus: 3, description: 'Studying and discovering new knowledge' },
};

// THOUGHTS moved to ./social.js (still re-exported via index.js).

// Mutually exclusive trait pairs. Colonists cannot spawn with both.
export const TRAIT_EXCLUSIONS = [
    ['hard_worker', 'lazy'],
    ['night_owl', 'early_bird'],
    ['socialite', 'loner'],
    ['optimist', 'pessimist'],
    ['brave', 'pacifist'],
    ['iron_stomach', 'gluttonous'],
    ['quick', 'sturdy'],
    ['light_sleeper', 'deep_sleeper'],
    ['brave', 'coward'],
    ['coward', 'pacifist'],
    ['workaholic', 'lazy'],
    ['workaholic', 'hard_worker'],
    ['optimist', 'volatile'],
    ['pessimist', 'volatile'],
    ['attuned', 'magically_inept'],
    ['scholar', 'magically_inept'],
    ['charismatic', 'abrasive'],
    // Combat temperament: berserkers charge in, cowards break early.
    ['berserker', 'coward'],
    // Pacifists refuse to attack. No offensive-combat prowess traits.
    ['berserker', 'pacifist'],
    ['deadeye', 'pacifist'],
    ['spellsword', 'pacifist'],
    // Animals: a beast whisperer is not skittish around beasts.
    ['beast_whisperer', 'skittish'],
    // Food: gourmands can't stand raw food. A foraging gut is unbothered by it.
    ['gourmand', 'foraging_gut'],
    // Magically Inept is mutually exclusive with every magic-positive trait.
    ['prodigy', 'magically_inept'],
    ['magically_gifted', 'magically_inept'],
    ['spellsword', 'magically_inept'],
    // Temperament & sleep: resilient vs. volatile, restless vs. deep sleeper.
    ['steadfast', 'volatile'],
    ['insomniac', 'deep_sleeper'],
];

export const TRAITS = {
    // ── Common ──────────────────────────────────────────────────────────────
    hard_worker:   { name: 'Hard Worker',   weight: 10, value:  3, workSpeedBonus: 0.2,   description: '+20% work speed', expedition: { fatigueMult: 0.9 } },
    lazy:          { name: 'Lazy',          weight: 10, value: -2, workSpeedBonus: -0.15, idleMoodBonus: 5, description: '-15% work speed, happy when idle', expedition: { fatigueMult: 1.3 } },
    night_owl:     { name: 'Night Owl',     weight: 10, value:  1, nightSpeedMult: 1.2, daySpeedMult: 0.9, description: '+20% at night, -10% during day', expedition: { realmBonus: { shadow_realm: { damageMult: 1.2 }, void_abyss: { damageMult: 1.15 }, oblivion_rift: { damageMult: 1.1 } } } },
    early_bird:    { name: 'Early Bird',    weight: 10, value:  1, daySpeedMult: 1.2,   nightSpeedMult: 0.9, description: '+20% during day, -10% at night' },
    socialite:     { name: 'Socialite',     weight: 10, value:  1, nearOthersMoodBonus: 8, aloneMoodPenalty: -5, description: 'Happy near others, sad alone' },
    loner:         { name: 'Loner',         weight: 10, value:  0, aloneMoodBonus: 8,   nearOthersMoodPenalty: -5, description: 'Happy alone, stressed near others' },
    optimist:      { name: 'Optimist',      weight: 10, value:  2, positiveThoughtMult: 1.5, description: 'Positive thoughts 50% stronger' },
    pessimist:     { name: 'Pessimist',     weight: 10, value: -2, negativeThoughtMult: 1.5, description: 'Negative thoughts 50% stronger' },
    gourmand:      { name: 'Gourmand',      weight: 10, value: -1, cookedFoodMoodBonus: 8, rawFoodMoodPenalty: -12, description: '+8 mood from cooked meals, -12 mood from raw food' },
    // ── Uncommon ────────────────────────────────────────────────────────────
    green_thumb:   { name: 'Green Thumb',   weight: 7,  value:  2, farmingSpeedMult: 1.3, description: '+30% farming speed', expedition: { realmBonus: { verdant_depths: { lootMult: 1.2 }, fungal_hollows: { lootMult: 1.15 }, primeval_canopy: { lootMult: 1.1 } } } },
    iron_stomach:  { name: 'Iron Stomach',  weight: 7,  value:  2, hungerDecayMult: 0.5,  description: 'Gets hungry half as fast' },
    tough:         { name: 'Tough',         weight: 7,  value:  3, damageReduction: 0.3,  description: 'Takes 30% less damage', expedition: { trapDamageMult: 0.7, fatigueMult: 0.8 } },
    brave:         { name: 'Brave',         weight: 6,  value:  2, fleeHpMult: 0.3,       description: 'Only flees at very low HP', expedition: { rallyChance: 0.1, rallyHeal: 0.05 } },
    quick:         { name: 'Quick',         weight: 7,  value:  2, moveSpeedBonus: 0.25,  description: 'Moves 25% faster', expedition: { durationMult: 0.95, dodgeChanceMod: 0.05 } },
    sturdy:        { name: 'Sturdy',        weight: 6,  value:  1, damageReduction: 0.15, workSpeedBonus: -0.1, description: 'Takes 15% less damage, -10% work speed' },
    light_sleeper: { name: 'Light Sleeper', weight: 7,  value:  0, restDecayMult: 1.4, sleepRestMult: 1.5, description: 'Gets tired faster, but recovers faster while sleeping' },
    deep_sleeper:  { name: 'Deep Sleeper',  weight: 7,  value:  0, restDecayMult: 0.7, sleepRestMult: 0.7, description: 'Gets tired slower, but recovers slower while sleeping' },
    creative:      { name: 'Creative',      weight: 6,  value:  3, craftingSpeedMult: 1.2, qualityBonus: 1, description: '+20% crafting speed, +1 quality tier chance' },
    scholar:       { name: 'Scholar',       weight: 6,  value:  3, researchSpeedMult: 1.2, magicXpMult: 1.2, description: '+20% research speed, +20% magic XP gain', expedition: { puzzleSuccessBonus: 0.2 } },
    gluttonous:    { name: 'Gluttonous',    weight: 6,  value: -2, hungerDecayMult: 1.6,  description: 'Gets hungry 60% faster' },
    // ── Rare ────────────────────────────────────────────────────────────────
    lucky:         { name: 'Lucky',         weight: 3,  value:  4, qualityBonus: 2, description: '+2 quality tier chance on all crafted items', expedition: { rareEncounterMult: 1.3 } },
    pyromaniac:    { name: 'Pyromaniac',    weight: 2,  value: -3, fireChance: 0.001, description: 'Rare chance to start fires' },
    // ── Very Rare ───────────────────────────────────────────────────────────
    pacifist:         { name: 'Pacifist',         weight: 1, value: -2, description: 'Refuses to attack enemies, only flees' },
    prodigy:          { name: 'Prodigy',          weight: 1, value:  5, allSkillXpMult: 1.2, magicXpMult: 1.2, description: 'Gains all XP 20% faster', expedition: { xpMult: 1.3 } },
    magically_gifted: { name: 'Magically Gifted', weight: 2, value:  3, description: 'Starts with 2 levels in a random magic school and knows its starter spell' },

    // ── New: Direct combat (Gap A) ────────────────────────────────────────────
    duelist:       { name: 'Duelist',       weight: 6, value:  2, dodgeChance: 0.12, description: '+12% chance to dodge attacks in combat' },
    deadeye:       { name: 'Deadeye',        weight: 6, value:  2, critChance: 0.12, description: '+12% critical hit chance in combat' },
    berserker:     { name: 'Berserker',      weight: 3, value:  2, lowHpDamageMult: 1.25, lowHpThreshold: 0.4, damageReduction: -0.1, description: '+25% damage dealt below 40% HP, but takes +10% damage' },
    coward:        { name: 'Coward',         weight: 10, value: -2, fleeHpMult: 0.4, description: 'Flees from combat at much higher HP' },

    // ── New: Taming & animals (Gap B) ─────────────────────────────────────────
    beast_whisperer: { name: 'Beast Whisperer', weight: 6, value:  2, tameChanceBonus: 0.3, animalWorkMult: 1.2, description: '+30% taming success, +20% animal handling speed' },
    menagerist:      { name: 'Menagerist',      weight: 5, value:  2, tamedAnimalMoodAura: 4, description: 'Cheered by nearby tamed animals' },
    skittish:        { name: 'Skittish',        weight: 10, value: -1, tameChancePenalty: 0.25, description: '-25% taming success, unnerved by wild beasts' },

    // ── New: Trade / gold (Gap C) ─────────────────────────────────────────────
    silver_tongue:  { name: 'Silver Tongue',  weight: 6, value:  2, tradeMarkupMult: 0.9, description: 'Better trade prices while in the colony' },
    merchants_eye:  { name: "Merchant's Eye", weight: 3, value:  3, tradeRewardQualityBonus: 1, description: 'Trade Rift rewards arrive at higher quality' },
    scavenger:      { name: 'Scavenger',      weight: 6, value:  2, scavengeChance: 0.12, description: 'Chance to find bonus materials while gathering' },

    // ── New: Cooking / food (Gap D) ───────────────────────────────────────────
    chef:          { name: 'Chef',           weight: 6, value:  2, cookingBonusFood: 1, mealMoodDurationMult: 1.5, description: '+1 food per cook, meals lift mood longer' },
    comfort_eater: { name: 'Comfort Eater',  weight: 10, value:  0, mealMoodBonus: 6, hungerDecayMult: 1.15, description: 'Eating restores extra mood, but gets hungry 15% faster' },
    foraging_gut:  { name: 'Foraging Gut',   weight: 6, value:  2, rawFoodMoodPenalty: 0, description: 'No mood penalty from eating raw food' },

    // ── New: Magic / mana (Gap E) ─────────────────────────────────────────────
    attuned:        { name: 'Attuned',        weight: 6, value:  2, manaRegenBonus: 0.2, maxManaMult: 1.1, description: '+20% mana regen, +10% max mana' },
    spellsword:     { name: 'Spellsword',     weight: 3, value:  3, spellDamageBonus: 0.15, description: '+15% spell damage', expedition: { spellDamageMult: 1.15 } },
    magically_inept:{ name: 'Magically Inept', weight: 10, value: -2, magicXpMult: 0.7, mundaneXpMult: 1.1, description: '-30% magic XP, but +10% mundane skill XP' },

    // ── New: Expedition layer (Gap F) ─────────────────────────────────────────
    trailblazer:    { name: 'Trailblazer',    weight: 6, value:  2, description: 'Faster, more evasive on expeditions', expedition: { durationMult: 0.9, dodgeChanceMod: 0.05 } },
    treasure_hunter:{ name: 'Treasure Hunter', weight: 3, value:  3, description: 'Finds more loot and rarer encounters on expeditions', expedition: { lootMult: 1.2, rareEncounterMult: 1.15 } },
    trapsmith:      { name: 'Trapsmith',      weight: 6, value:  2, description: 'Takes far less trap damage; can disarm traps', expedition: { trapDamageMult: 0.6 } },
    inspiring:      { name: 'Inspiring',      weight: 3, value:  3, description: 'Rallies the party more often and heals more', expedition: { rallyChance: 0.15, rallyHeal: 0.08 } },
    void_touched:   { name: 'Void-Touched',   weight: 3, value:  2, description: 'Empowered within the shadowed realms', expedition: { realmBonus: { shadow_realm: { partyDamageMult: 1.2 }, void_abyss: { partyDamageMult: 1.15 }, oblivion_rift: { partyDamageMult: 1.1 } } } },

    // ── New: Social / relationships (Gap G) ───────────────────────────────────
    charismatic:    { name: 'Charismatic',    weight: 6, value:  2, positiveInteractionMult: 1.5, description: 'Builds friendships faster' },
    abrasive:       { name: 'Abrasive',       weight: 10, value: -2, negativeInteractionMult: 1.5, description: 'Sours relationships faster' },
    loyal:          { name: 'Loyal',          weight: 6, value:  2, loyalWorkMult: 1.1, description: 'Works harder near a friend or lover' },

    // ── New: Mental resilience & flavor (Gap H) ───────────────────────────────
    steadfast:      { name: 'Steadfast',      weight: 6, value:  2, breakThresholdMult: 0.6, description: 'Far more resistant to mental breaks' },
    volatile:       { name: 'Volatile',       weight: 10, value: -1, positiveThoughtMult: 1.4, negativeThoughtMult: 1.4, description: 'Mood swings harder in both directions' },
    workaholic:     { name: 'Workaholic',     weight: 6, value:  2, workSpeedBonus: 0.15, idleMoodPenalty: -5, description: '+15% work speed, but restless when idle' },
    insomniac:      { name: 'Insomniac',      weight: 10, value: -1, sleepRestMult: 0.7, workSpeedBonus: 0.05, description: 'Recovers slowly from sleep, but always a bit more productive' },

    // ── Race-specific ────────────────────────────────────────────────────────
    human:   { name: 'Human',   weight: 0, value:  10, allSkillXpMult: 1.15, magicXpMult: 1.15, description: 'A versatile member of Humanity (learns all skills, magic and mundane, 15% faster)' },
    nymph:   { name: 'Nymph',   weight: 0, value:  10, magicXpMult: 1.3, workSpeedBonus: -0.15, description: 'A mystical member of the Nympha (+30% magic skill XP, but physically frail: -15% work speed)' },
    ferin:   { name: 'Ferin',   weight: 0, value:  10, farmingSpeedMult: 1.2, animalXpMult: 1.5, animalWorkMult: 1.3, indoorMoodPenalty: -6, description: 'A wild member of the Ferini (+20% farming, gifted with animals, restless indoors)' },
    kobalos: { name: 'Kobalos', weight: 0, value:  10, moveSpeedBonus: 0.10, allyDamageReduction: 0.05, allyDamageReductionCap: 0.20, isolatedMoodPenalty: -6, rawFoodMoodPenalty: 0, description: 'A pack-minded member of the Kobaloi (+10% move speed, tougher near allies, no raw-food penalty, but rattled alone)' },
    bufos:   { name: 'Bufos',   weight: 0, value:  10, daySpeedMult: 1.15, nightSpeedMult: 0.85, restDecayMult: 0.85, description: 'A cold-blooded member of the Bufoi (+15% work by day, -15% by night, but rests efficiently)' },
};

export const RACES = {
    human: {},
    nymph: {},
    ferin: {},
    kobalos: {},
    bufos: {},
}

export const COLONIST_CONFIG = {
    initialHunger: [80, 100],
    initialRest: [80, 100],
    initialMood: 60,
    maxHp: 100,
    baseMood: 50,
    hungerMoodThreshold: 20,
    hungerMoodPenalty: -15,
    restMoodThreshold: 20,
    restMoodPenalty: -10,
    bedMoodBonus: 5,
    sleepDuration: 30,
    sleepAfterMoveDuration: 25,
    restPerTick: 3,
    breakingWanderDuration: [30, 50],
    wanderCooldown: [5, 15],
    wanderChance: 0.3,
    relaxChance: 0.04,          // per-eligible-tick roll to start relaxing while idle
    relaxCooldown: [200, 500],  // ticks before a colonist may roll to relax again
    relaxDuration: [40, 90],    // ticks a relaxation activity lasts
    relaxMoodBonus: 4,          // generic fallback mood on completing a relax
    relaxMoodDuration: 200,
    hangOutSearchRadius: 40,    // max manhattan dist to seek a Town Hall for Hang Out
    fightEngageDistance: 8,
    fleeHpThreshold: 20,
    fleeDisengageDistance: 8,
    hostileSearchRadius: 30,
    socialRange: 3,
    skillWorkBonus: 0.12,
    deconstructRecovery: 0.5,
    baseAttackCooldown: 3,
    combatDamageVariance: 3,
    victoryMoodBonus: 5,
    victoryMoodDuration: 200,
    cookedFoodRestore: 100,
    rawFoodRestore: 35,
    mealMoodBonus: 5,
    mealMoodDuration: 150,
    rawFoodMoodPenalty: -4,
    rawFoodMoodDuration: 100,
    starvingMoodPenalty: -20,
    starvingMoodDuration: 100,
    sleptInRoomMoodBonus: 10,
    sleptInRoomMoodDuration: 300,
    sleptInBedMoodBonus: 5,
    sleptInBedMoodDuration: 200,
    sleptOnGroundMoodPenalty: -15,
    sleptOnGroundMoodDuration: 400,
    deathMoodPenalty: -40,
    deathMoodDuration: 2000,
    nameColors: ['#ff3300', '#00ff00', '#00ffff', '#ffff00', '#a600ff', '#ababab'],
    magicBiasChance: 0.3,
    baseHealthRegen: 0.03,
    healthRegenWhileIdle: 2.0,
    healthRegenWhileSleeping: 3.0,
    skillMaxLevel: 10,
    skillXpPerTask: 1,
    skillXpToLevel: 8,
    skillXpScalePerLevel: 4,
};

export const HUMAN_NAMES = [
    'Bob', 'Cal', 'Finn', 'Hank', 'Jake', 'Max', 'Otto',
    'Davis', 'Hugh', 'Matt', 'Paul', 'Jim', 'Rex', 'Liam',  
    'Ada', 'Dee', 'Eve', 'Gail', 'Iris', 'Lena', 'Nora', 'Pia',
    'Mia', 'Tara', 'Uma', 'Xia', 'Wren', 'Faye', 'Opal', 'Ruth',
    'Kit', 'Quinn', 'Sage', 'Morgan', 'Sam', 'Owen', 'Noah',
    'Perry', 'Harper', 'Jules', 'Kris', 'Ash', 'Rowan', 'Ember',
];

export const NYMPH_NAMES = [
    'Syvis', 'Sanev', 'Aimer', 'Venali', 'Bellas', 'Leena',
    'Belanor', 'Nym', 'Ryul', 'Slyvar', 'Dilya', 'Amra',
];

export const FERIN_NAMES = [
    'Puf', 'Pim', 'Rheh', 'Sam', 'Vrefa', 'Refe', 'Gemi',
    'Kupi', 'Dhib', 'Stag', 'Kroh', 'Fif', 'Rhit', 'Gul',
];

export const KOBALOS_NAMES = [
    'Burm', 'Orm', 'Plio', 'Giox', 'Prigs', 'Gnert',
    'Poshi', 'Tuil', 'Nols', 'Ong', 'Qunk', 'Greenie',
];

export const BUFOS_NAMES = [
    'Gilly', 'Sprout', 'Hopper', 'Clover', 'Lily', 'Moss',
    'Pickle', 'Brook', 'Groda', 'Kaeru', 'Kikker', 'Pogo',
];

// Sprite layer counts come from the active skin pack at runtime.
export const COLONIST_APPEARANCE = {
    bodyCount: 1,
    hairCount: 1,
    shirtCount: 1,
};

export const NEED_DECAY = {
    hunger: 0.25,
    rest: 0.1,
};

export const MOOD_THRESHOLDS = {
    inspired: 75,
    content: 40,
    stressed: 20,
    breaking: 0,
};

export const MOOD_SPEED_MULT = {
    inspired: 1.2,
    content: 1.0,
    stressed: 0.7,
    breaking: 0,
};

export const WORK_CONFIG = {
    plantWork: 5,
    harvestWork: 8,
    researchWork: 60,
    deconstructWork: 10,
    tameWork: 20,
    dangerousTameWork: 30,
    tameSkillChanceBonus: 0.06,
    poweredWorkbenchDivisor: 1.5,
    alchemyFoodBonus: 2,
    stoneworkMiningMult: 1.25,
    husbandryProductionMult: 1.5,
    artisanQualityBonus: 1,
    artisanSalvageRate: 0.75,
    fortificationRepairMult: 1.5,
    wealthPerWeapon: 10,
    guardPatrolRadius: 6,
    guardEngageRadius: 10,
    guardReturnThreshold: 12,
};

export const MAGIC_STUDY_CONFIG = {
    studyTicksPerProgress: 1,
    tomeStudyBonus: 2,
    xpPerStudyTick: 0.025,
    xpPerCast: 0.015,
    magicXpToLevel: 0.8,
    magicXpScalePerLevel: 0.25,
    // Specialization tuning. Each school level above a spell's minLevel makes that
    // spell stronger, cheaper and faster to recast, rewarding deep single-school
    // investment. Starting values: playtest and balance against SPELLS numbers.
    spellPowerPerLevel: 0.08,          // +8% effect magnitude per level over minLevel
    manaCostReductionPerLevel: 0.03,   // -3% mana cost per level over minLevel
    manaCostReductionCap: 0.4,
    cooldownReductionPerLevel: 0.02,   // -2% cooldown per level over minLevel
    cooldownReductionCap: 0.3,
    breadthLearningPenalty: 0.15,      // +15% tome work per other school already known
    // How many schools a colonist can actively autocast from at once.
    attunementSlots: 2,
};

export const TASK_CONFIG = {
    unreachableFailThreshold: 3,
    unreachableCheckInterval: 60,
};

// QUALITY_TIERS, ROOM_QUALITY_TIERS, WORKSHOP_QUALITY_TIERS, STATION_GROUPS,
// FLOOR_QUALITY_VALUES, SALVAGE_RATE moved to ./quality.js.
// RELATIONSHIP_TIERS, SOCIAL_INTERACTIONS, SOCIAL_CONFIG moved to ./social.js.
// (All still re-exported via index.js.)

export const TASK_SPEED_STATS = {
    mine: 'miningSpeed',
    chop: 'choppingSpeed',
    plant: 'farmingSpeed',
    harvest: 'farmingSpeed',
    craft: 'craftingSpeed',
    cook: 'cookingSpeed',
    build: 'buildSpeed',
    research: 'researchSpeed',
};

export const EASTER_EGG_COLONISTS = {
    'Carson': {
        nameColor: '#0be47b',
        race: 'human',
        bodyVariant: 1,
        hairVariant: 18,
        shirtVariant: 2,
        skills: { building: 2, farming: 2, crafting: 2, cooking: 4, animals: 4, research: 4 },
        traits: ['pacifist', 'iron_stomach', 'tough']
    },
    'Mars': {
        nameColor: '#e8da12',
        race: 'ferin',
        bodyVariant: 2,
        hairVariant: 9,
        shirtVariant: 5,
        skills: { building: 2, farming: 3, crafting: 5, cooking: 2, animals: 3, research: 3 },
        traits: ['socialite', 'optimist']
    },
    'Robby': {
        nameColor: '#125de8',
        race: 'human',
        bodyVariant: 1,
        hairVariant: 8,
        shirtVariant: 3,
        skills: { building: 3, farming: 2, crafting: 4, cooking: 2, animals: 2, research: 3 },
        traits: ['magically_gifted', 'creative', 'early_bird']
    },
};
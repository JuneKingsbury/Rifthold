export const SKILLS = {
    building: { name: 'Building', baseLevel: [2, 4], biasBonus: 3, description: 'Construction, mining, chopping, and repairs' },
    farming:  { name: 'Farming', baseLevel: [2, 4], biasBonus: 3, description: 'Planting and harvesting crops' },
    crafting: { name: 'Crafting', baseLevel: [2, 4], biasBonus: 3, description: 'Crafting items at workbenches' },
    cooking:  { name: 'Cooking', baseLevel: [2, 4], biasBonus: 3, description: 'Cooking meals at cauldrons' },
    animals:  { name: 'Animals', baseLevel: [1, 3], biasBonus: 3, description: 'Taming and handling animals' },
    research: { name: 'Research', baseLevel: [1, 2], biasBonus: 3, description: 'Studying and discovering new knowledge' },
};

// THOUGHTS moved to ./social.js (still re-exported via index.js).

// Mutually exclusive trait pairs — colonists cannot spawn with both.
export const TRAIT_EXCLUSIONS = [
    ['hard_worker', 'lazy'],
    ['night_owl', 'early_bird'],
    ['socialite', 'loner'],
    ['optimist', 'pessimist'],
    ['brave', 'pacifist'],
    ['iron_stomach', 'gluttonous'],
    ['quick', 'sturdy'],
    ['light_sleeper', 'deep_sleeper'],
];

export const TRAITS = {
    // ── Common ──────────────────────────────────────────────────────────────
    hard_worker:   { name: 'Hard Worker',   weight: 10, value:  3, workSpeedMult: 1.2,  description: '+20% work speed' },
    lazy:          { name: 'Lazy',          weight: 10, value: -2, workSpeedMult: 0.85, idleMoodBonus: 5, description: '-15% work speed, happy when idle' },
    night_owl:     { name: 'Night Owl',     weight: 10, value:  1, nightSpeedMult: 1.2, daySpeedMult: 0.9, description: '+20% at night, -10% during day' },
    early_bird:    { name: 'Early Bird',    weight: 10, value:  1, daySpeedMult: 1.2,   nightSpeedMult: 0.9, description: '+20% during day, -10% at night' },
    socialite:     { name: 'Socialite',     weight: 10, value:  1, nearOthersMoodBonus: 8, aloneMoodPenalty: -5, description: 'Happy near others, sad alone' },
    loner:         { name: 'Loner',         weight: 10, value:  0, aloneMoodBonus: 8,   nearOthersMoodPenalty: -5, description: 'Happy alone, stressed near others' },
    optimist:      { name: 'Optimist',      weight: 10, value:  2, positiveThoughtMult: 1.5, description: 'Positive thoughts 50% stronger' },
    pessimist:     { name: 'Pessimist',     weight: 10, value: -2, negativeThoughtMult: 1.5, description: 'Negative thoughts 50% stronger' },
    gourmand:      { name: 'Gourmand',      weight: 10, value: -1, cookedFoodMoodBonus: 8, rawFoodMoodPenalty: -12, description: '+8 mood from cooked meals, -12 mood from raw food' },
    // ── Uncommon ────────────────────────────────────────────────────────────
    green_thumb:   { name: 'Green Thumb',   weight: 7,  value:  2, farmingSpeedMult: 1.3, description: '+30% farming speed' },
    iron_stomach:  { name: 'Iron Stomach',  weight: 7,  value:  2, hungerDecayMult: 0.5,  description: 'Gets hungry half as fast' },
    tough:         { name: 'Tough',         weight: 7,  value:  3, damageTakenMult: 0.7,  description: 'Takes 30% less damage' },
    brave:         { name: 'Brave',         weight: 6,  value:  2, fleeHpMult: 0.3,       description: 'Only flees at very low HP' },
    quick:         { name: 'Quick',         weight: 7,  value:  2, moveSpeedBonus: 0.25,  description: 'Moves 25% faster' },
    sturdy:        { name: 'Sturdy',        weight: 6,  value:  1, damageTakenMult: 0.85, workSpeedMult: 0.9, description: 'Takes 15% less damage, -10% work speed' },
    light_sleeper: { name: 'Light Sleeper', weight: 7,  value:  0, restDecayMult: 1.4, sleepRestMult: 1.5, description: 'Gets tired faster, but recovers faster while sleeping' },
    deep_sleeper:  { name: 'Deep Sleeper',  weight: 7,  value:  0, restDecayMult: 0.7, sleepRestMult: 0.7, description: 'Gets tired slower, but recovers slower while sleeping' },
    creative:      { name: 'Creative',      weight: 6,  value:  3, craftingSpeedMult: 1.2, qualityBonus: 1, description: '+20% crafting speed, +1 quality tier chance' },
    scholar:       { name: 'Scholar',       weight: 6,  value:  3, researchSpeedMult: 1.2, magicXpMult: 1.2, description: '+20% research speed, +20% magic XP gain' },
    gluttonous:    { name: 'Gluttonous',    weight: 6,  value: -2, hungerDecayMult: 1.6,  description: 'Gets hungry 60% faster' },
    // ── Rare ────────────────────────────────────────────────────────────────
    lucky:         { name: 'Lucky',         weight: 3,  value:  4, qualityBonus: 2, description: '+2 quality tier chance on all crafted items' },
    pyromaniac:    { name: 'Pyromaniac',    weight: 2,  value: -3, fireChance: 0.001, description: 'Rare chance to start fires' },
    // ── Very Rare ───────────────────────────────────────────────────────────
    pacifist:         { name: 'Pacifist',         weight: 1, value: -2, description: 'Refuses to attack enemies, only flees' },
    prodigy:          { name: 'Prodigy',          weight: 1, value:  5, allSkillXpMult: 1.2, magicXpMult: 1.2, description: 'Gains all XP 20% faster' },
    magically_gifted: { name: 'Magically Gifted', weight: 2, value:  3, description: 'Starts with 2 levels in a random magic school and knows its starter spell' },
};

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

export const COLONIST_NAMES = [
    'Bob', 'Cal', 'Finn', 'Hank', 'Jake', 'Max', 'Otto',
    'Davis', 'Hugh', 'Matt', 'Paul', 'Jim', 'Rex', 'Liam', 'Noah', 'Owen',
    'Ada', 'Dee', 'Eve', 'Gail', 'Iris', 'Lena', 'Nora', 'Pia',
    'Mia', 'Tara', 'Uma', 'Xia', 'Wren', 'Faye', 'Opal', 'Ruth',
    'Kit', 'Quinn', 'Sage', 'Vex', 'Morgan', 'Sam',
    'Perry', 'Harper', 'Jules', 'Kris', 'Ash', 'Rowan', 'Ember', 'Lux',
];

// Expected sprite layer counts — actual counts come from the active skin pack at runtime.
export const COLONIST_APPEARANCE = {
    bodyCount: 4,
    hairCount: 6,
    shirtCount: 4,
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

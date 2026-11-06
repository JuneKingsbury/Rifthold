import { stampLoc } from '../i18n.js';

export const SKILLS = {
    building: { baseLevel: [0, 2], biasBonus: 3 },
    farming:  { baseLevel: [0, 2], biasBonus: 3 },
    crafting: { baseLevel: [0, 2], biasBonus: 3 },
    cooking:  { baseLevel: [0, 2], biasBonus: 3 },
    animals:  { baseLevel: [0, 2], biasBonus: 3 },
    research: { baseLevel: [0, 2], biasBonus: 3 },
};
stampLoc(SKILLS, 'skill');

export const SKILL_MILESTONES = {
    building: {
        5:  { type: 'deconstructSpeed', value: 0.15 },
        10: { type: 'deconstructRefund', value: 0.15 },
    },
    farming: {
        5:  { type: 'harvestBonus', value: 5 },
        10: { type: 'harvestDouble', value: 0.20 },
    },
    crafting: {
        5:  { type: 'craftFreeChance', value: 0.10 },
        10: { type: 'craftMinQuality', value: 'fine' },
    },
    cooking: {
        5:  { type: 'mealWorkBuff', value: 0.15, duration: 30 },
        10: { type: 'mealWorkBuffColony', value: 0.10, duration: 30 },
    },
    animals: {
        5:  { type: 'tameWorkReduction', value: 0.20 },
        10: { type: 'bondedAnimalDamage', value: 1 },
    },
    research: {
        5:  { type: 'researchSpeedBonus', value: 0.10 },
        10: { type: 'tomeResearchEfficiency', value: 0.75 },
    },
};
stampLoc(SKILL_MILESTONES, 'skill_milestone');

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
    hard_worker:   { weight: 10, value:  3, workSpeedBonus: 0.2,   expedition: { fatigueMult: 0.9 } },
    lazy:          { weight: 10, value: -2, workSpeedBonus: -0.15, idleMoodBonus: 5, expedition: { fatigueMult: 1.3 } },
    night_owl:     { weight: 10, value:  1, nightSpeedMult: 1.2, daySpeedMult: 0.9, expedition: { realmBonus: { shadow_realm: { damageMult: 1.2 }, void_abyss: { damageMult: 1.15 }, oblivion_rift: { damageMult: 1.1 } } } },
    early_bird:    { weight: 10, value:  1, daySpeedMult: 1.2,   nightSpeedMult: 0.9 },
    socialite:     { weight: 10, value:  1, nearOthersMoodBonus: 8, aloneMoodPenalty: -5 },
    loner:         { weight: 10, value:  0, aloneMoodBonus: 8,   nearOthersMoodPenalty: -5 },
    optimist:      { weight: 10, value:  2, positiveThoughtMult: 1.5 },
    pessimist:     { weight: 10, value: -2, negativeThoughtMult: 1.5 },
    gourmand:      { weight: 10, value: -1, cookedFoodMoodBonus: 8, rawFoodMoodPenalty: -12 },
    // ── Uncommon ────────────────────────────────────────────────────────────
    green_thumb:   { weight: 7,  value:  2, farmingSpeedMult: 1.3, expedition: { realmBonus: { verdant_depths: { lootMult: 1.2 }, fungal_hollows: { lootMult: 1.15 }, primeval_canopy: { lootMult: 1.1 } } } },
    iron_stomach:  { weight: 7,  value:  2, hungerDecayMult: 0.5 },
    tough:         { weight: 7,  value:  3, damageReduction: 0.3,  expedition: { trapDamageMult: 0.7, fatigueMult: 0.8 } },
    brave:         { weight: 6,  value:  2, fleeHpMult: 0.10,      expedition: { rallyChance: 0.1, rallyHeal: 0.05 } },
    quick:         { weight: 7,  value:  2, moveSpeedBonus: 0.25,  expedition: { durationMult: 0.95, dodgeChanceMod: 0.05 } },
    sturdy:        { weight: 6,  value:  1, damageReduction: 0.15, workSpeedBonus: -0.1 },
    light_sleeper: { weight: 7,  value:  0, restDecayMult: 1.4, sleepRestMult: 1.5 },
    deep_sleeper:  { weight: 7,  value:  0, restDecayMult: 0.7, sleepRestMult: 0.7 },
    creative:      { weight: 6,  value:  3, craftingSpeedMult: 1.2, qualityBonus: 1 },
    scholar:       { weight: 6,  value:  3, researchSpeedMult: 1.2, magicXpMult: 1.2, expedition: { puzzleSuccessBonus: 0.2 } },
    gluttonous:    { weight: 6,  value: -2, hungerDecayMult: 1.6 },
    // ── Rare ────────────────────────────────────────────────────────────────
    lucky:         { weight: 3,  value:  4, qualityBonus: 2, expedition: { rareEncounterMult: 1.3 } },
    // ── Very Rare ───────────────────────────────────────────────────────────
    pacifist:         { weight: 1, value: -2 },
    prodigy:          { weight: 1, value:  5, allSkillXpMult: 1.2, magicXpMult: 1.2, expedition: { xpMult: 1.3 } },
    magically_gifted: { weight: 2, value:  3 },

    // ── New: Direct combat (Gap A) ────────────────────────────────────────────
    duelist:       { weight: 6, value:  2, dodgeChance: 0.12 },
    deadeye:       { weight: 6, value:  2, critChance: 0.12 },
    berserker:     { weight: 3, value:  2, lowHpDamageMult: 1.25, lowHpThreshold: 0.4, damageReduction: -0.1 },
    coward:        { weight: 10, value: -2, fleeHpMult: 0.4 },

    // ── New: Taming & animals (Gap B) ─────────────────────────────────────────
    beast_whisperer: { weight: 6, value:  2, tameChanceBonus: 0.3, animalWorkMult: 1.2 },
    menagerist:      { weight: 5, value:  2, tamedAnimalMoodAura: 4 },
    skittish:        { weight: 10, value: -1, tameChancePenalty: 0.25 },

    // ── New: Trade / gold (Gap C) ─────────────────────────────────────────────
    silver_tongue:  { weight: 6, value:  2, tradeMarkupMult: 0.9 },
    merchants_eye:  { weight: 3, value:  3, tradeRewardQualityBonus: 1 },
    scavenger:      { weight: 6, value:  2, scavengeChance: 0.12 },

    // ── New: Cooking / food (Gap D) ───────────────────────────────────────────
    chef:          { weight: 6, value:  2, cookingBonusFood: 1, mealMoodDurationMult: 1.5 },
    comfort_eater: { weight: 10, value:  0, mealMoodBonus: 6, hungerDecayMult: 1.15 },
    foraging_gut:  { weight: 6, value:  2, rawFoodMoodPenalty: 0 },

    // ── New: Magic / mana (Gap E) ─────────────────────────────────────────────
    attuned:        { weight: 6, value:  2, manaRegenBonus: 0.2, maxManaMult: 1.1 },
    spellsword:     { weight: 3, value:  3, spellDamageBonus: 0.15, expedition: { spellDamageMult: 1.15 } },
    magically_inept:{ weight: 10, value: -2, magicXpMult: 0.7, mundaneXpMult: 1.1 },

    // ── New: Expedition layer (Gap F) ─────────────────────────────────────────
    trailblazer:    { weight: 6, value:  2, expedition: { durationMult: 0.9, dodgeChanceMod: 0.05 } },
    treasure_hunter:{ weight: 3, value:  3, expedition: { lootMult: 1.2, rareEncounterMult: 1.15 } },
    trapsmith:      { weight: 6, value:  2, expedition: { trapDamageMult: 0.6 } },
    inspiring:      { weight: 3, value:  3, expedition: { rallyChance: 0.15, rallyHeal: 0.08 } },
    void_touched:   { weight: 3, value:  2, expedition: { realmBonus: { shadow_realm: { partyDamageMult: 1.2 }, void_abyss: { partyDamageMult: 1.15 }, oblivion_rift: { partyDamageMult: 1.1 } } } },

    // ── New: Social / relationships (Gap G) ───────────────────────────────────
    charismatic:    { weight: 6, value:  2, positiveInteractionMult: 1.5 },
    abrasive:       { weight: 10, value: -2, negativeInteractionMult: 1.5 },
    loyal:          { weight: 6, value:  2, loyalWorkMult: 1.1 },

    // ── New: Mental resilience & flavor (Gap H) ───────────────────────────────
    steadfast:      { weight: 6, value:  2, breakThresholdMult: 0.6 },
    volatile:       { weight: 10, value: -1, positiveThoughtMult: 1.4, negativeThoughtMult: 1.4 },
    workaholic:     { weight: 6, value:  2, workSpeedBonus: 0.15, idleMoodPenalty: -5 },
    insomniac:      { weight: 10, value: -1, sleepRestMult: 0.7, workSpeedBonus: 0.05 },

    // ── Race-specific ────────────────────────────────────────────────────────
    human:   { weight: 0, value:  10, allSkillXpMult: 1.15, magicXpMult: 1.15 },
    nymph:   { weight: 0, value:  10, magicXpMult: 1.3, workSpeedBonus: -0.15 },
    ferin:   { weight: 0, value:  10, farmingSpeedMult: 1.2, animalXpMult: 1.5, animalWorkMult: 1.3, indoorMoodPenalty: -6 },
    kobalos: { weight: 0, value:  10, moveSpeedBonus: 0.10, allyDamageReduction: 0.05, allyDamageReductionCap: 0.20, isolatedMoodPenalty: -6, rawFoodMoodPenalty: 0 },
    bufos:   { weight: 0, value:  10, daySpeedMult: 1.15, nightSpeedMult: 0.85, restDecayMult: 0.85 },
};
stampLoc(TRAITS, 'trait');

export const RACES = {
    human: {},
    nymph: {},
    ferin: {},
    kobalos: {},
    bufos: {},
}
stampLoc(RACES, 'race');

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
    // Milder while the colony has no beds at all: nobody expects one on day one.
    sleptOnGroundNoBedsMoodPenalty: -8,
    sleptOnGroundMoodDuration: 400,
    // Starting colonists arrive hopeful: a mood buffer for the first three days,
    // before shelter and routines exist. Playtests saw first mental breaks on day 1-3.
    freshStartMoodBonus: 15,
    freshStartMoodDuration: 1440,
    deathMoodPenalty: -40,
    deathMoodDuration: 2000,
    nameColors: ['#ff3300', '#00ff00', '#00ffff', '#ffff00', '#a600ff', '#ababab'],
    magicBiasChance: 0.3,
    baseHealthRegen: 0.03,
    healthRegenWhileIdle: 2.0,
    healthRegenWhileSleeping: 3.0,
    seekRestHpThreshold: 0.4,    // seek bed to heal when HP drops below this fraction of maxHp
    skillMaxLevel: 10,
    skillXpPerTask: 1,
    skillXpToLevel: 15,
    skillXpScalePerLevel: 15,
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

export const PRIORITY_PROFILES = {
    'All-Rounder': { building: 3, farming: 3, crafting: 3, cooking: 3, animals: 3, research: 3 },
    'Builder':     { building: 1, farming: 4, crafting: 4, cooking: 4, animals: 4, research: 5 },
    'Farmer':      { building: 4, farming: 1, crafting: 4, cooking: 4, animals: 4, research: 5 },
    'Crafter':     { building: 4, farming: 4, crafting: 1, cooking: 4, animals: 4, research: 5 },
    'Scholar':     { building: 5, farming: 5, crafting: 3, cooking: 4, animals: 5, research: 1 },
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
    // One research task is a longer sitting worth researchSessionsPerTask of the old
    // 60-work tasks (RP and tome study scale with it), so colonists walk to the desk a
    // third as often for the same research rate.
    researchSessionsPerTask: 3,
    researchWork: 180,
    deconstructWork: 10,
    lootChestWork: 8,
    attuneAnchorWork: 20,
    tameWork: 20,
    dangerousTameWork: 30,
    tameSkillChanceBonus: 0.06,
    poweredWorkbenchDivisor: 1.5,
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
    // How many schools a colonist can actively autocast from at once. One, so each
    // caster commits to a role (evoker, healer, summoner...); switching is free.
    attunementSlots: 1,
};

export const TASK_CONFIG = {
    unreachableFailThreshold: 3,
    // Path attempts that ran out of search budget before a task is cancelled as
    // unreachable. Higher than the definitive-failure threshold because running out
    // of budget can just mean the target is far away.
    budgetFailThreshold: 9,
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
    cleanse_blight: 'farmingSpeed',
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
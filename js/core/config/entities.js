import { stampLoc } from '../i18n.js';

export const ENTITIES = {
    // === Animals ===
    deer:    { char: 'd', color: '#bb8855', hp: 40, speed: 0.22, category: 'animal', hostile: false, meatYield: 3, hideYield: 2, fleeRange: 5, spawnWeight: 15, tameable: true, tamed: { foodToTame: 4, courage: 0.3, petDamage: 2, roles: [{ type: 'pack', expeditionSpeedBonus: 0.05 }, { type: 'wander' }], effects: [] } },
    rabbit:  { char: 'r', color: '#ccaa88', hp: 10, speed: 0.3, category: 'animal', hostile: false, meatYield: 1, fleeRange: 4, spawnWeight: 12, tameable: true, tamed: { foodToTame: 1, courage: 0.05, petDamage: 1, roles: [{ type: 'wander' }], effects: [{ type: 'mood_aura', scope: 'aura', radius: 3, moodBonus: 2 }] } },
    wolf:    { char: 'w', color: '#555555', hp: 60, speed: 0.26, category: 'animal', hostile: true, meatYield: 2, hideYield: 1, damage: 8, aggroRange: 6, spawnWeight: 0, spawnCondition: 'hostileNight', tameable: true, tamed: { foodToTame: 6, dangerousTame: true, baseTameChance: 0.40, retaliationDamage: 12, roles: [{ type: 'guard', guardRadius: 8, guardDamage: 8 }, { type: 'war', beastHp: 35, beastDamage: 12 }], effects: [] } },
    chicken: { char: 'c', color: '#ddaa44', hp: 15, speed: 0.15, category: 'animal', hostile: false, meatYield: 1, fleeRange: 3, spawnWeight: 13, tameable: true, tamed: { foodToTame: 2, hungerRate: 200, hungerThreshold: 3, roles: [{ type: 'production', produces: 'eggs', produceRate: 80, produceAmount: 1 }, { type: 'wander' }], effects: [] } },
    cow:     { char: 'C', color: '#aa7744', hp: 80, speed: 0.11, category: 'animal', hostile: false, meatYield: 4, hideYield: 3, fleeRange: 4, spawnWeight: 13, tameable: true, tamed: { foodToTame: 4, hungerRate: 200, hungerThreshold: 3, roles: [{ type: 'production', produces: 'milk', produceRate: 100, produceAmount: 2 }, { type: 'wander' }], effects: [] } },
    sheep:   { char: 's', color: '#cccccc', hp: 40, speed: 0.14, category: 'animal', hostile: false, meatYield: 2, woolYield: 1, fleeRange: 4, spawnWeight: 13, tameable: true, tamed: { foodToTame: 3, hungerRate: 200, hungerThreshold: 3, roles: [{ type: 'production', produces: 'wool', produceRate: 120, produceAmount: 1 }, { type: 'wander' }], effects: [] } },
    okapi:   { char: 'O', color: '#b3562e', hp: 100, speed: 0.34, category: 'animal', hostile: false, meatYield: 1, fleeRange: 4, spawnWeight: 11, tameable: true, tamed: { foodToTame: 5, courage: 0.4, petDamage: 3, roles: [{ type: 'pack', expeditionSpeedBonus: 0.13 }, { type: 'wander' }], effects: [] } },
    tapir:   { char: 't', color: '#f2e6e6', hp: 60, speed: 0.11, category: 'animal', hostile: false, meatYield: 1, fleeRange: 4, spawnWeight: 11, tameable: true, tamed: { foodToTame: 3, courage: 0.2, petDamage: 1, roles: [{ type: 'wander' }], effects: [{ type: 'mood_aura', scope: 'aura', radius: 4, moodBonus: 5 }] } },
    goose:   { char: 'n', color: '#e0e0cc', hp: 20, speed: 0.18, category: 'animal', hostile: false, meatYield: 1, fleeRange: 6, spawnWeight: 11, tameable: true, tamed: { foodToTame: 2, roles: [{ type: 'guard', guardRadius: 12, guardDamage: 3 }, { type: 'wander' }], effects: [] } },
    boar:    { char: 'b', color: '#7a5c44', hp: 70, speed: 0.18, category: 'animal', hostile: false, meatYield: 3, hideYield: 1, fleeRange: 5, spawnWeight: 10, tameable: true, tamed: { foodToTame: 5, dangerousTame: true, baseTameChance: 0.55, retaliationDamage: 10, courage: 0.8, petDamage: 6, roles: [{ type: 'war', beastHp: 45, beastDamage: 10 }], effects: [] } },

    // === Crypt guardians ===
    // Hostile "animals" so the wildlife AI drives them (chase colonists inside aggroRange).
    // spawnWeight 0 keeps them out of the wild spawn table: only a breached crypt makes them.
    crypt_warden:    { char: 'W', color: '#9988aa', hp: 45, speed: 0.2, category: 'animal', hostile: true, guardian: true, meatYield: 0, damage: 6, aggroRange: 5, spawnWeight: 0 },
    bone_sentinel:   { char: 'S', color: '#ddd8c4', hp: 85, speed: 0.22, category: 'animal', hostile: true, guardian: true, meatYield: 0, damage: 11, aggroRange: 6, spawnWeight: 0 },

    // === Summons ===
    familiar: { char: 'f', color: '#9966ff', hp: 40, speed: 0.5, category: 'summon', damage: 8, summonDuration: 60, roles: [{ type: 'guard', guardRadius: 6, patrolRadius: 3 }, { type: 'summoned' }] },
    ghost:    { char: 'g', color: '#88ccff', hp: 25, speed: 0.7, category: 'summon', damage: 14, summonDuration: 80, roles: [{ type: 'guard', guardRadius: 8, patrolRadius: 4 }, { type: 'summoned' }] },
    monster:  { char: 'M', color: '#ff4466', hp: 60, speed: 0.4, category: 'summon', damage: 20, summonDuration: 100, roles: [{ type: 'guard', guardRadius: 10, patrolRadius: 5 }, { type: 'summoned' }] },
    spectral_wisp: { char: 'w', color: '#aaccff', hp: 12, speed: 0.6, category: 'summon', damage: 5, summonDuration: 45, roles: [{ type: 'guard', guardRadius: 7, patrolRadius: 4 }, { type: 'summoned' }] },
    decoy:         { char: '◈', color: '#aaaaaa', hp: 14, speed: 0.0, category: 'summon', damage: 0, summonDuration: 60, threatMult: 5, roles: [{ type: 'guard', guardRadius: 0, patrolRadius: 0 }, { type: 'summoned' }] },

    // === Golems ===
    farmer_golem:    { char: 'G', color: '#55aa33', hp: 150, speed: 0.3, category: 'golem', traits: ['pacifist', 'green_thumb'], roles: [{ type: 'worker', specialty: 'farming', skillLevel: 6 }], cost: { stone: 10, runite: 3, void_essence: 2 }, craftTicks: 80 },
    builder_golem:   { char: 'G', color: '#888888', hp: 180, speed: 0.25, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'building', skillLevel: 6 }], cost: { stone: 12, runite: 4, void_essence: 2 }, craftTicks: 90 },
    cook_golem:      { char: 'G', color: '#cc7722', hp: 140, speed: 0.32, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'cooking', skillLevel: 6 }], cost: { stone: 9, runite: 2, void_essence: 1 }, craftTicks: 75 },
    herder_golem:    { char: 'G', color: '#88aa33', hp: 170, speed: 0.29, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'animals', skillLevel: 6 }], cost: { stone: 11, runite: 3, void_essence: 2 }, craftTicks: 85 },

    // === Enemies ===
    raider_brute:    { char: 'R', color: '#ff3333', hp: 50, speed: 0.28, category: 'enemy', hostile: true, damage: 5, aggroRange: 30, roles: [{ type: 'melee_charger' }], attackAnim: 'Swing', loot: [] },
    raider_archer:   { char: 'R', color: '#ff6633', hp: 35, speed: 0.18, category: 'enemy', hostile: true, damage:2, aggroRange: 30, roles: [{ type: 'ranged_attacker', range: 5, preferDistance: 4 }], ranged: true, projectileChar: '-', projectileColor: '#ffaa33', attackAnim: 'DrawAndShoot', loot: [] },
    crusader:        { char: 'C', color: '#d6d216', hp: 80, speed: 0.32, category: 'enemy', hostile: true, damage: 10, aggroRange: 40, noFlee: true, roles: [{ type: 'melee_charger' }], attackAnim: 'Swing', damageReduction: 0.2, loot: [] },
    crusader_archer: { char: 'C', color: '#d6a816', hp: 50, speed: 0.24, category: 'enemy', hostile: true, damage: 4, aggroRange: 40, noFlee: true, roles: [{ type: 'ranged_attacker', range: 7, preferDistance: 5 }], ranged: true, projectileChar: '-', projectileColor: '#d6d216', attackAnim: 'DrawAndShoot', damageReduction: 0.1, loot: [] },
    raider_hexer:    { char: 'R', color: '#cc44ff', hp: 30, speed: 0.22, category: 'enemy', hostile: true, damage: 1, aggroRange: 30, roles: [{ type: 'ranged_attacker', range: 6, preferDistance: 5 }], ranged: true, projectileChar: '*', projectileColor: '#cc44ff', attackAnim: 'DrawAndShoot', onHit: { effect: 'slow', duration: 50, moveSpeedMalus: -0.5 }, loot: [] },
    raider_poisoner: { char: 'R', color: '#44cc44', hp: 40, speed: 0.20, category: 'enemy', hostile: true, damage: 2, aggroRange: 30, roles: [{ type: 'ranged_attacker', range: 5, preferDistance: 4 }], ranged: true, projectileChar: '-', projectileColor: '#44cc44', attackAnim: 'DrawAndShoot', onHit: { effect: 'dot', tickDamage: 1, tickInterval: 5, duration: 60 }, loot: [] },
    void_walker:     { char: 'V', color: '#aa33ff', hp: 30, speed: 0.21, category: 'enemy', hostile: true, damage: 4, roles: [{ type: 'nexus_target' }], attackAnim: 'Swing', loot: [] },
    void_brute:      { char: 'V', color: '#7722cc', hp: 80, speed: 0.14, category: 'enemy', hostile: true, damage: 10, roles: [{ type: 'nexus_target' }, { type: 'structure_breaker', breakSpeed: 2 }], attackAnim: 'Swing', loot: [] },

    // === Expedition Bosses ===
    boss_crystal_colossus:          { char: '▲', color: '#4488ff', category: 'boss' },
    boss_crystal_colossus_enraged:  { char: '▲', color: '#ff2222', category: 'boss' },
    boss_ancient_treant:            { char: '▲', color: '#22aa66', category: 'boss' },
    boss_ancient_treant_enraged:    { char: '▲', color: '#ff4400', category: 'boss' },
    boss_arcane_construct:          { char: '▲', color: '#ff8844', category: 'boss' },
    boss_arcane_construct_enraged:  { char: '▲', color: '#ff0000', category: 'boss' },
    boss_void_sovereign:            { char: '▲', color: '#7722cc', category: 'boss' },
    boss_void_sovereign_enraged:    { char: '▲', color: '#ff0000', category: 'boss' },
    boss_high_king:                 { char: '▲', color: '#ddaa22', category: 'boss' },
    boss_high_king_enraged:         { char: '▲', color: '#ff2200', category: 'boss' },
};

// Themed crypt guardians, two per realm chain (see CRYPT_CONFIG.themes). Same stats
// as crypt_warden (light) and bone_sentinel (heavy), so the chain only changes the
// look and lore. Hostile "animals" so the wildlife AI drives them.
const GUARDIAN_STATS = {
    light: { hp: 45, speed: 0.2, damage: 6, aggroRange: 5 },
    heavy: { hp: 85, speed: 0.22, damage: 11, aggroRange: 6 },
};
const CHAIN_GUARDIANS = {
    thorn_warden:     ['light', 'T', '#6fbf5a'],
    briar_sentinel:   ['heavy', 'B', '#3f8f3a'],
    crystal_warden:   ['light', 'c', '#8fd8ff'],
    crystal_sentinel: ['heavy', 'C', '#58b8ee'],
    rune_automaton:   ['light', 'r', '#ffaa66'],
    arcane_sentinel:  ['heavy', 'A', '#ff8844'],
    shade_warden:     ['light', 's', '#8877bb'],
    gloom_sentinel:   ['heavy', 'G', '#5d4f99'],
    void_acolyte:     ['light', 'v', '#aa66ee'],
    void_sentinel:    ['heavy', 'V', '#7722cc'],
    fracture_wraith:  ['light', 'f', '#ff7766'],
    fracture_horror:  ['heavy', 'F', '#ee3355'],
    palace_husk:      ['light', 'p', '#ddc060'],
    revenant_knight:  ['heavy', 'K', '#c9a227'],
};
// Added before stampLoc(ENTITIES) so their name and lore come from the table.
for (const [key, [weight, char, color]] of Object.entries(CHAIN_GUARDIANS)) {
    ENTITIES[key] = { char, color, ...GUARDIAN_STATS[weight], category: 'animal', hostile: true, guardian: true, meatYield: 0, spawnWeight: 0 };
}
stampLoc(ENTITIES, 'entity');

export const ANIMALS = Object.fromEntries(
    Object.entries(ENTITIES).filter(([, e]) => e.category === 'animal')
);

// Live derived view: flattens each tameable animal's structured `tamed`
// roles/effects into the flat property shape (guardAnimal, produces, packAnimal,
// happinessAura, …) that the taming and animal-handling code reads. Regenerated
// from ENTITIES on load. Edit ENTITIES, not this.
export const TAMED_ANIMALS = Object.fromEntries(
    Object.entries(ANIMALS).filter(([, a]) => a.tameable).map(([k, a]) => {
        const t = a.tamed;
        const flat = { char: a.char, color: a.color, hp: a.hp, foodToTame: t.foodToTame };
        if (t.dangerousTame) { flat.dangerousTame = true; flat.baseTameChance = t.baseTameChance; flat.retaliationDamage = t.retaliationDamage; }
        if (t.hungerRate) { flat.hungerRate = t.hungerRate; flat.hungerThreshold = t.hungerThreshold; }
        for (const role of (t.roles || [])) {
            if (role.type === 'guard') { flat.guardAnimal = true; flat.guardRadius = role.guardRadius; flat.guardDamage = role.guardDamage; }
            if (role.type === 'production') { flat.produces = role.produces; flat.produceRate = role.produceRate; flat.produceAmount = role.produceAmount; }
            if (role.type === 'pack') { flat.packAnimal = true; flat.expeditionSpeedBonus = role.expeditionSpeedBonus; }
            // War beasts can occupy an expedition party slot and fight alongside
            // colonists as a persistent combatant (see exploration.js). beastHp /
            // beastDamage default to the animal's own hp and a light melee value.
            if (role.type === 'war') { flat.warBeast = true; flat.beastHp = role.beastHp || a.hp; flat.beastDamage = role.beastDamage || a.damage || 8; }
        }
        for (const effect of (t.effects || [])) {
            if (effect.type === 'mood_aura') { flat.happinessAura = true; flat.auraRadius = effect.radius; flat.auraMoodBonus = effect.moodBonus; }
        }
        if (t.courage !== undefined) flat.courage = t.courage;
        if (t.petDamage !== undefined) flat.petDamage = t.petDamage;
        return [k, flat];
    })
);

export const GOLEM_TYPES = Object.fromEntries(
    Object.entries(ENTITIES).filter(([, e]) => e.category === 'golem').map(([k, e]) => {
        const role = (e.roles || []).find(r => r.type === 'worker') || {};
        return [k, { name: e.name, char: e.char, color: e.color, hp: e.hp, speed: e.speed, damage: e.damage, specialty: role.specialty, skillLevel: role.skillLevel, traits: e.traits || [], cost: e.cost, craftTicks: e.craftTicks }];
    })
);

export const SUMMON_TYPES = Object.fromEntries(
    Object.entries(ENTITIES).filter(([, e]) => e.category === 'summon').map(([k, e]) => {
        const role = (e.roles || []).find(r => r.type === 'guard') || {};
        return [k, { name: e.name, char: e.char, color: e.color, hp: e.hp, damage: e.damage, speed: e.speed, duration: e.summonDuration, guardRadius: role.guardRadius, patrolRadius: role.patrolRadius }];
    })
);

export const RAID_TYPES = {
    bandit_raid: {
        composition: [
            { entity: 'raider_brute', count: [2, 4] },
            { entity: 'raider_archer', count: [0, 2], minRaidLevel: 4 },
        ],
        scaling: { hpMult: 0.1, damageMult: 0.05 },
    },
    crusader_raid: {
        scripted: true,
        composition: [
            { entity: 'crusader',        count: [5, 5] },
            { entity: 'crusader_archer', count: [3, 3] },
        ],
        scaling: { hpMult: 0.15, damageMult: 0.08 },
    },
    // Fired once by the tutorial to teach drafting. Scripted, so it never joins the random raid pool.
    training_raid: {
        scripted: true,
        composition: [
            { entity: 'raider_brute', count: [2, 2] },
        ],
        scaling: { hpMult: 0.1, damageMult: 0.05 },
    },
    warband_raid: {
        composition: [
            { entity: 'raider_brute',    count: [2, 3] },
            { entity: 'raider_hexer',    count: [1, 2], minRaidLevel: 6 },
            { entity: 'raider_poisoner', count: [1, 2], minRaidLevel: 6 },
        ],
        scaling: { hpMult: 0.1, damageMult: 0.05 },
    },
};
stampLoc(RAID_TYPES, 'raid_type');

export const WAVE_TYPES = {
    void_wave: {
        composition: [
            { entity: 'void_walker', weight: 3 },
            { entity: 'void_brute', weight: 0.5, minWave: 3 },
        ],
    },
};
stampLoc(WAVE_TYPES, 'wave_type');

export const WILDLIFE_CONFIG = {
    maxCount: 30,
    passiveMoveChance: 0.3,
    hostileIdleMoveChance: 0.2,
    animalSearchRadius: 20,
    wolfNightThreshold: 0.75,
};

export const RAID_CONFIG = {
    firstRaidTick: 3000,
    minInterval: 1500,
    maxInterval: 4000,
    baseRaiders: 1,
    wealthScaling: 0.004,
    timeScalingPeak: 18000,
    raiderHp: 50,
    raiderDamage: 5,
    raiderSpeed: 0.35,
    fleeHpFraction: 0.15,
    routThreshold: 0.8,
    timeout: 900,
    // Raids this small skip the auto-pause popup and spawn this many tiles from the
    // colony instead of at the map edge, so a lone raider doesn't idle a drafted
    // colony for a whole day while it walks in.
    smallRaidSize: 2,
    smallRaidSpawnDistance: 40,
};

// How much each stockpiled resource contributes to raid attraction.
// Lower than TRADE_VALUES for bulk materials raiders can't easily carry;
// higher for portable, high-fence-value goods.
export const RAID_WEALTH_WEIGHTS = {
    wood:      0.10,
    stone:     0.05,
    planks:    0.15,
    bricks:    0.05,
    food:      0.25,
    wheat:     0.15,
    corn:      0.15,
    potatoes:  0.15,
    berries:   0.15,
    meat:      0.25,
    eggs:      0.10,
    milk:      0.10,
    hides:     0.50,
    leather:   0.70,
    wool:      0.35,
    cotton:    0.15,
    cloth:     0.50,
    iron_ore:  0.35,
    iron:      0.90,
    runite:    1.00,
    moonbloom: 0.80,
    void_essence: 1.00,
    gold:      1.00,
};

// TRADE_VALUES, TRADER_MARKUP, TRADER_DISCOUNT moved to ./trade.js
// (still re-exported via index.js).

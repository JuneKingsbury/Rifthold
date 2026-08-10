export const ENTITIES = {
    // === Animals ===
    deer:    { char: 'd', color: '#bb8855', hp: 40, speed: 0.22, category: 'animal', hostile: false, meatYield: 3, hideYield: 2, fleeRange: 5, spawnWeight: 15 },
    rabbit:  { char: 'r', color: '#ccaa88', hp: 10, speed: 0.3, category: 'animal', hostile: false, meatYield: 1, fleeRange: 4, spawnWeight: 12 },
    wolf:    { char: 'w', color: '#555555', hp: 60, speed: 0.26, category: 'animal', hostile: true, meatYield: 2, hideYield: 1, damage: 8, aggroRange: 6, spawnWeight: 0, spawnCondition: 'hostileNight', tameable: true, tamed: { foodToTame: 6, dangerousTame: true, baseTameChance: 0.40, retaliationDamage: 12, roles: [{ type: 'guard', guardRadius: 8, guardDamage: 8 }], effects: [] } },
    chicken: { char: 'c', color: '#ddaa44', hp: 15, speed: 0.15, category: 'animal', hostile: false, meatYield: 1, fleeRange: 3, spawnWeight: 13, tameable: true, tamed: { foodToTame: 2, roles: [{ type: 'production', produces: 'eggs', produceRate: 80, produceAmount: 1 }, { type: 'wander' }], effects: [] } },
    cow:     { char: 'C', color: '#aa7744', hp: 80, speed: 0.11, category: 'animal', hostile: false, meatYield: 4, hideYield: 3, fleeRange: 4, spawnWeight: 13, tameable: true, tamed: { foodToTame: 4, roles: [{ type: 'production', produces: 'milk', produceRate: 100, produceAmount: 2 }, { type: 'wander' }], effects: [] } },
    sheep:   { char: 's', color: '#cccccc', hp: 40, speed: 0.14, category: 'animal', hostile: false, meatYield: 2, fleeRange: 4, spawnWeight: 13, tameable: true, tamed: { foodToTame: 3, roles: [{ type: 'production', produces: 'wool', produceRate: 120, produceAmount: 1 }, { type: 'wander' }], effects: [] } },
    okapi:   { char: 'O', color: '#b3562e', hp: 100, speed: 0.34, category: 'animal', hostile: false, meatYield: 5, hideYield: 3, fleeRange: 4, spawnWeight: 11, tameable: true, tamed: { foodToTame: 5, roles: [{ type: 'pack', expeditionSpeedBonus: 0.25 }, { type: 'wander' }], effects: [] } },
    tapir:   { char: 't', color: '#f2e6e6', hp: 60, speed: 0.11, category: 'animal', hostile: false, meatYield: 4, hideYield: 2, fleeRange: 4, spawnWeight: 11, tameable: true, tamed: { foodToTame: 3, roles: [{ type: 'wander' }], effects: [{ type: 'mood_aura', scope: 'aura', radius: 4, moodBonus: 5 }] } },

    // === Summons ===
    familiar: { name: 'Familiar', char: 'f', color: '#9966ff', hp: 40, speed: 0.5, category: 'summon', damage: 8, summonDuration: 80, roles: [{ type: 'guard', guardRadius: 6, patrolRadius: 3 }, { type: 'summoned' }] },
    ghost:    { name: 'Ghost',    char: 'g', color: '#88ccff', hp: 25, speed: 0.7, category: 'summon', damage: 14, summonDuration: 60, roles: [{ type: 'guard', guardRadius: 8, patrolRadius: 4 }, { type: 'summoned' }] },

    // === Golems ===
    farmer_golem:    { name: 'Farmer Golem', char: 'G', color: '#55aa33', hp: 150, speed: 0.3, category: 'golem', traits: ['pacifist', 'green_thumb'], roles: [{ type: 'worker', specialty: 'farming', skillLevel: 6 }], cost: { stone: 10, runite: 3, void_essence: 2 }, craftTicks: 80 },
    builder_golem:   { name: 'Builder Golem', char: 'G', color: '#888888', hp: 180, speed: 0.25, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'building', skillLevel: 6 }], cost: { stone: 12, runite: 4, void_essence: 2 }, craftTicks: 90 },
    crafter_golem:   { name: 'Crafter Golem', char: 'G', color: '#aa6633', hp: 160, speed: 0.28, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'crafting', skillLevel: 6 }], cost: { stone: 11, runite: 3, void_essence: 2 }, craftTicks: 85 },
    cook_golem:      { name: 'Cook Golem', char: 'G', color: '#cc7722', hp: 140, speed: 0.32, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'cooking', skillLevel: 6 }], cost: { stone: 9, runite: 2, void_essence: 1 }, craftTicks: 75 },
    herder_golem:    { name: 'Herder Golem', char: 'G', color: '#88aa33', hp: 170, speed: 0.29, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'animals', skillLevel: 6 }], cost: { stone: 11, runite: 3, void_essence: 2 }, craftTicks: 85 },
    scholar_golem:   { name: 'Scholar Golem', char: 'G', color: '#4488ff', hp: 130, speed: 0.26, category: 'golem', traits: ['pacifist'], roles: [{ type: 'worker', specialty: 'research', skillLevel: 6 }], cost: { stone: 8, runite: 2, void_essence: 2 }, craftTicks: 70 },
    combat_golem:    { name: 'Combat Golem', char: 'G', color: '#cc4444', hp: 250, speed: 0.35, category: 'golem', traits: ['tough'], damage: 20, roles: [{ type: 'worker', specialty: 'combat', skillLevel: 6 }], cost: { stone: 15, runite: 5, void_essence: 4 }, craftTicks: 110 },

    // === Enemies ===
    raider_brute:    { name: 'Raider', char: 'R', color: '#ff3333', hp: 50, speed: 0.28, category: 'enemy', hostile: true, damage: 5, aggroRange: 10, roles: [{ type: 'melee_charger' }], loot: [] },
    raider_archer:   { name: 'Raider Archer', char: 'R', color: '#ff6633', hp: 35, speed: 0.30, category: 'enemy', hostile: true, damage: 4, aggroRange: 12, roles: [{ type: 'ranged_attacker', range: 7, preferDistance: 5 }], ranged: true, projectileChar: '-', projectileColor: '#ffaa33', loot: [] },
    void_walker:     { name: 'Void Walker', char: 'V', color: '#aa33ff', hp: 30, speed: 0.21, category: 'enemy', hostile: true, damage: 4, roles: [{ type: 'nexus_target' }], loot: [] },
    void_brute:      { name: 'Void Brute', char: 'V', color: '#7722cc', hp: 80, speed: 0.14, category: 'enemy', hostile: true, damage: 10, roles: [{ type: 'nexus_target' }, { type: 'structure_breaker', breakSpeed: 2 }], loot: [] },
};

export const ANIMALS = Object.fromEntries(
    Object.entries(ENTITIES).filter(([, e]) => e.category === 'animal')
);

// Live derived view: flattens each tameable animal's structured `tamed`
// roles/effects into the flat property shape (guardAnimal, produces, packAnimal,
// happinessAura, …) that the taming and animal-handling code reads. Regenerated
// from ENTITIES on load; edit ENTITIES, not this.
export const TAMED_ANIMALS = Object.fromEntries(
    Object.entries(ANIMALS).filter(([, a]) => a.tameable).map(([k, a]) => {
        const t = a.tamed;
        const flat = { char: a.char, color: a.color, hp: a.hp, foodToTame: t.foodToTame };
        if (t.dangerousTame) { flat.dangerousTame = true; flat.baseTameChance = t.baseTameChance; flat.retaliationDamage = t.retaliationDamage; }
        for (const role of (t.roles || [])) {
            if (role.type === 'guard') { flat.guardAnimal = true; flat.guardRadius = role.guardRadius; flat.guardDamage = role.guardDamage; }
            if (role.type === 'production') { flat.produces = role.produces; flat.produceRate = role.produceRate; flat.produceAmount = role.produceAmount; }
            if (role.type === 'pack') { flat.packAnimal = true; flat.expeditionSpeedBonus = role.expeditionSpeedBonus; }
        }
        for (const effect of (t.effects || [])) {
            if (effect.type === 'mood_aura') { flat.happinessAura = true; flat.auraRadius = effect.radius; flat.auraMoodBonus = effect.moodBonus; }
        }
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
        name: 'Bandit Raid',
        composition: [
            { entity: 'raider_brute', count: [2, 4] },
            { entity: 'raider_archer', count: [0, 2], minRaidLevel: 3 },
        ],
        scaling: { hpMult: 0.1, damageMult: 0.05 },
    },
};

export const WAVE_TYPES = {
    void_wave: {
        name: 'Void Wave',
        composition: [
            { entity: 'void_walker', weight: 3 },
            { entity: 'void_brute', weight: 0.5, minWave: 3 },
        ],
    },
};

export const WILDLIFE_CONFIG = {
    maxCount: 15,
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
    wealthScaling: 0.003,
    timeScalingPeak: 18000,
    raiderHp: 50,
    raiderDamage: 5,
    raiderSpeed: 0.35,
    fleeHpFraction: 0.15,
    routThreshold: 0.8,
    timeout: 900,
};

// TRADE_VALUES, TRADER_MARKUP, TRADER_DISCOUNT moved to ./trade.js
// (still re-exported via index.js).

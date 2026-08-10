import { ENTITIES } from '../core/config.js';
import { initEntityRoles } from './roles.js';

let nextEntityId = 1;

export function getNextId() {
    return nextEntityId++;
}

export function syncEntityIdCounter(entities) {
    const maxId = entities.reduce((max, e) => Math.max(max, e.id || 0), 0);
    if (maxId >= nextEntityId) nextEntityId = maxId + 1;
}

export function createEntity(type, x, y, options = {}) {
    const def = ENTITIES[type];
    if (!def) return null;

    const scalingHp = options.hpMult ? Math.floor(def.hp * (1 + options.hpMult)) : def.hp;
    const scalingDmg = options.damageMult ? Math.floor((def.damage || 0) * (1 + options.damageMult)) : (def.damage || 0);

    const entity = {
        id: nextEntityId++,
        type,
        category: def.category,
        x, y,
        hp: scalingHp,
        maxHp: scalingHp,
        speed: def.speed,
        moveCooldown: 0,
        char: def.char,
        color: def.color,
        hostile: def.hostile || false,
        damage: scalingDmg,
        roles: (def.roles || []).map(r => ({ ...r })),
        effects: (def.effects || []).map(e => ({ ...e })),
        roleState: {},
        fleeing: false,
        path: null,
        pathAge: 0,
    };

    if (def.aggroRange) entity.aggroRange = def.aggroRange;
    if (def.ranged) {
        entity.ranged = true;
        entity.projectileChar = def.projectileChar;
        entity.projectileColor = def.projectileColor;
    }
    if (def.loot) entity.loot = def.loot;

    if (options.ownerId !== undefined) entity.ownerId = options.ownerId;
    if (options.expiresAt !== undefined) {
        entity.expiresAt = options.expiresAt;
    } else if (def.summonDuration || options.duration) {
        entity.expiresAt = (options.currentTick || 0) + (options.duration || def.summonDuration);
    }

    initEntityRoles(entity);

    return entity;
}

export function createWildAnimal(type, x, y) {
    const def = ENTITIES[type];
    if (!def || def.category !== 'animal') return null;

    return {
        id: nextEntityId++,
        type,
        category: 'animal',
        x, y,
        hp: def.hp,
        maxHp: def.hp,
        hostile: def.hostile || false,
        speed: def.speed,
        moveCooldown: 0,
        fleeing: false,
        fleeTarget: null,
        char: def.char,
        color: def.color,
        damage: def.damage || 0,
        aggroRange: def.aggroRange || 0,
    };
}

export function createTamedEntity(type, x, y) {
    const def = ENTITIES[type];
    if (!def || !def.tameable) return null;
    const tamed = def.tamed;

    const entity = {
        id: nextEntityId++,
        type,
        category: 'animal',
        x, y,
        hp: def.hp,
        maxHp: def.hp,
        speed: def.speed || 0.3,
        moveCooldown: 0,
        char: def.char,
        color: def.color,
        hostile: false,
        tamed: true,
        roles: (tamed.roles || []).map(r => ({ ...r })),
        effects: (tamed.effects || []).map(e => ({ ...e })),
        roleState: {},
        produceCooldown: ((tamed.roles || []).find(r => r.type === 'production') || {}).produceRate || 0,
        penX: x,
        penY: y,
    };

    initEntityRoles(entity);

    return entity;
}

export function createRaidEntity(type, x, y, raidLevel, scaling) {
    const hpMult = scaling ? (raidLevel - 1) * (scaling.hpMult || 0) : 0;
    const damageMult = scaling ? (raidLevel - 1) * (scaling.damageMult || 0) : 0;

    const entity = createEntity(type, x, y, { hpMult, damageMult });
    if (entity) entity.fleeing = false;
    return entity;
}

export function createWaveEntity(type, x, y, waveNumber) {
    const def = ENTITIES[type];
    if (!def) return null;

    const hpMult = (waveNumber - 1) * 0.15;
    const damageMult = (waveNumber - 1) * 0.1;

    return createEntity(type, x, y, { hpMult, damageMult });
}

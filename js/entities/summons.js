import { ENTITIES, SUMMON_TYPES, COMBAT_VISUALS } from '../core/config.js';
import { createEntity } from './entity-factory.js';
import { updateEntityRoles } from './roles.js';
import { isPassable } from '../world/map.js';

// Picks where a summon actually appears: the requested tile when it is walkable
// and free, otherwise the nearest walkable tile within a few steps (free tiles
// preferred). Returns null when there is nowhere to stand, so callers never
// place a summon inside a wall, in water, or off the map.
function findSummonTile(game, x, y) {
    const free = (tx, ty) => isPassable(game.map, tx, ty) && !game.isTileOccupied(tx, ty);
    if (free(x, y)) return { x, y };
    let fallback = isPassable(game.map, x, y) ? { x, y } : null;
    for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const tx = x + dx, ty = y + dy;
                if (free(tx, ty)) return { x: tx, y: ty };
                if (!fallback && isPassable(game.map, tx, ty)) fallback = { x: tx, y: ty };
            }
        }
    }
    return fallback;
}

export function spawnSummon(summonType, x, y, ownerId, game, hpMult = 1, damageMult = 1, durationMult = 1) {
    const def = SUMMON_TYPES[summonType];
    if (!def) return null;
    const spot = findSummonTile(game, x, y);
    if (!spot) return null;
    x = spot.x;
    y = spot.y;
    const summon = createEntity(summonType, x, y, {
        ownerId,
        expiresAt: game.tick + Math.round(def.duration * durationMult),
    });
    if (summon && (hpMult !== 1 || damageMult !== 1)) {
        if (hpMult !== 1) { summon.hp = Math.round(summon.hp * hpMult); summon.maxHp = summon.hp; }
        if (damageMult !== 1) { summon.damage = Math.round(summon.damage * damageMult); }
    }
    if (!summon) return null;
    emitSparkles(game, x, y, def.color);
    game.combatEffects.push({ x, y, char: COMBAT_VISUALS.summonArriveChar, color: COMBAT_VISUALS.summonArriveColor, ttl: COMBAT_VISUALS.summonArriveTtl });
    window.soundManager?.playSFXAt('summon_arrival', x, y);
    game.entities.push(summon);
    if (game.exploration && !game.exploration.summonsSeen.has(summonType)) {
        const entityDef = ENTITIES[summonType];
        game.exploration.summonsSeen.set(summonType, {
            name: def.name || summonType,
            char: entityDef?.char || def.char || '?',
            color: def.color || '#9966ff',
            sprite: summonType,
            lore: entityDef?.lore || '',
        });
    }
    return summon;
}

export function updateSummons(game) {
    for (let i = game.entities.length - 1; i >= 0; i--) {
        const summon = game.entities[i];
        if (summon.category !== 'summon') continue;
        if (game.tick >= summon.expiresAt || summon.hp <= 0) {
            emitSparkles(game, summon.x, summon.y, summon.color);
            game.entities.splice(i, 1);
            continue;
        }
        summon.moveCooldown -= summon.speed;
        if (summon.moveCooldown > 0) continue;
        summon.moveCooldown = 1;
        updateEntityRoles(summon, game);
    }
}

function emitSparkles(game, x, y, color) {
    const chars = ['*', '✦', '·'];
    for (let i = 0; i < 3; i++) {
        const ox = x + Math.floor(Math.random() * 3) - 1;
        const oy = y + Math.floor(Math.random() * 3) - 1;
        game.combatEffects.push({
            x: ox, y: oy,
            char: chars[Math.floor(Math.random() * chars.length)],
            color,
            ttl: 3 + Math.floor(Math.random() * 3),
        });
    }
}

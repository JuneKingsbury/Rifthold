import { SUMMON_TYPES, COMBAT_VISUALS } from '../core/config.js';
import { createEntity } from './entity-factory.js';
import { updateEntityRoles } from './roles.js';

export function spawnSummon(summonType, x, y, ownerId, game) {
    const def = SUMMON_TYPES[summonType];
    if (!def) return null;
    const summon = createEntity(summonType, x, y, {
        ownerId,
        expiresAt: game.tick + def.duration,
    });
    if (!summon) return null;
    emitSparkles(game, x, y, def.color);
    game.combatEffects.push({ x, y, char: COMBAT_VISUALS.summonArriveChar, color: COMBAT_VISUALS.summonArriveColor, ttl: COMBAT_VISUALS.summonArriveTtl });
    window.soundManager?.playSFX('summon_arrival');
    game.entities.push(summon);
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

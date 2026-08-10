import { CONFIG } from '../core/config.js';

export function moveEntity(entity, newX, newY, durationMs) {
    if (entity.x === newX && entity.y === newY) return;
    entity._prevX = entity.x;
    entity._prevY = entity.y;
    entity._moveStartTime = performance.now();
    entity._moveDuration = durationMs;
    entity.x = newX;
    entity.y = newY;
}

export function teleportEntity(entity, newX, newY) {
    entity._prevX = null;
    entity._prevY = null;
    entity._moveStartTime = 0;
    entity._moveDuration = 0;
    entity.x = newX;
    entity.y = newY;
}

const _pos = { x: 0, y: 0 };

export function getEntityRenderPos(entity, now) {
    if (entity._prevX == null || entity._moveDuration <= 0) {
        _pos.x = entity.x;
        _pos.y = entity.y;
        return _pos;
    }
    const elapsed = now - entity._moveStartTime;
    if (elapsed >= entity._moveDuration) {
        entity._prevX = null;
        entity._prevY = null;
        _pos.x = entity.x;
        _pos.y = entity.y;
        return _pos;
    }
    const t = elapsed / entity._moveDuration;
    const eased = t * (2 - t);
    _pos.x = entity._prevX + (entity.x - entity._prevX) * eased;
    _pos.y = entity._prevY + (entity.y - entity._prevY) * eased;
    return _pos;
}

export function isEntityMoving(entity) {
    return entity._prevX != null;
}

export function computeMoveCooldown(terrainCost, moveBonus) {
    let cooldown = Math.max(0, Math.floor((terrainCost - 1) / 3));
    if (moveBonus > 0 && cooldown > 0) {
        cooldown = Math.max(0, Math.round(cooldown * (1 - moveBonus)));
    }
    return cooldown;
}

export function computeMoveDuration(terrainCost, moveBonus, gameSpeed) {
    const cooldown = computeMoveCooldown(terrainCost, moveBonus);
    return (1 + cooldown) * CONFIG.TICK_RATE / gameSpeed;
}

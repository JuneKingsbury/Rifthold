import { CONFIG, BUILDINGS, COMBAT_VISUALS, COLONIST_CONFIG } from '../core/config.js';
import { manhattanDist } from '../world/pathfinding.js';
import { isPassable, isPassableForEnemies, isBreakableByEnemies } from '../world/map.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { colonistTakeDamage } from './colonist.js';

function canAttack(entity, game) {
    const cooldown = entity.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
    if (game.tick - (entity._lastAttackTick || 0) < cooldown) return false;
    entity._lastAttackTick = game.tick;
    return true;
}

export const ROLE_HANDLERS = {
    guard: {
        init(entity, role) {
            entity.roleState.guard = { state: 'patrolling', target: null };
        },
        info(entity, role) {
            const rs = entity.roleState.guard || {};
            const state = rs.state || 'patrolling';
            const stateColor = state === 'engaging' ? '#ff4444' : state === 'retreating' ? '#ffaa00' : '#44cc44';
            return `<div class="info-row" style="color:${stateColor}">Guard: ${state.charAt(0).toUpperCase() + state.slice(1)} (radius ${role.guardRadius || 8}, ${role.guardDamage || 8} dmg)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.guard;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
            const radius = role.guardRadius || 8;
            const damage = role.guardDamage || entity.damage || 8;

            if (rs.state === 'retreating') {
                const anchor = findAnchor(entity, game);
                if (!anchor) { rs.state = 'patrolling'; return; }
                if (manhattanDist(entity.x, entity.y, anchor.x, anchor.y) <= 2) {
                    rs.state = 'patrolling';
                    return;
                }
                moveToward(entity, anchor, game.map, dur, game);
                return;
            }

            if (entity.hp < entity.maxHp * 0.2) {
                rs.state = 'retreating';
                rs.target = null;
                return;
            }

            const hostiles = getHostiles(game, entity);
            let target = null;
            let minDist = radius;
            for (const h of hostiles) {
                const d = manhattanDist(entity.x, entity.y, h.x, h.y);
                if (d < minDist) { minDist = d; target = h; }
            }

            if (target) {
                rs.state = 'engaging';
                rs.target = { x: target.x, y: target.y };
                const dist = manhattanDist(entity.x, entity.y, target.x, target.y);
                if (dist <= 1) {
                    if (canAttack(entity, game)) {
                        target.hp -= damage;
                        game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: entity.color, ttl: COMBAT_VISUALS.hitTtl });
                    }
                } else {
                    moveToward(entity, target, game.map, dur, game);
                }
            } else {
                rs.state = 'patrolling';
                rs.target = null;
                const anchor = findAnchor(entity, game);
                if (anchor) {
                    const dist = manhattanDist(entity.x, entity.y, anchor.x, anchor.y);
                    const patrolRadius = role.patrolRadius || 3;
                    if (dist > patrolRadius) {
                        moveToward(entity, anchor, game.map, dur, game);
                    } else if (Math.random() < 0.1) {
                        randomMoveNear(entity, anchor, game.map, dur, patrolRadius, game);
                    }
                }
            }
        },
    },

    production: {
        init(entity, role) {
            entity.roleState.production = { cooldown: role.produceRate || 80 };
        },
        info(entity, role) {
            const rs = entity.roleState.production || {};
            const next = rs.cooldown || 0;
            return `<div class="info-row" style="color:#88cc88">Produces: ${role.produces} (every ${role.produceRate || 80} ticks, next in ${next})</div>`;
        },
        update(entity, role, game) {
            if (entity.onExpedition) return;
            const rs = entity.roleState.production;
            rs.cooldown--;
            if (rs.cooldown <= 0) {
                const output = {};
                output[role.produces] = role.produceAmount || 1;
                game.resources.add(output);
                rs.cooldown = role.produceRate || 80;
            }
        },
    },

    pack: {
        init() {},
        info(entity, role) {
            const bonus = role.expeditionSpeedBonus || 0.25;
            return `<div class="info-row" style="color:#bbaa44">Pack Animal (+${Math.round(bonus * 100)}% expedition speed)</div>`;
        },
        update() {},
    },

    ranged_attacker: {
        init(entity, role) {
            entity.roleState.ranged_attacker = { state: 'approaching', cooldown: 0 };
        },
        info(entity, role) {
            return `<div class="info-row" style="color:#ffaa33">Ranged Attacker (range ${role.range || 6}, prefers distance ${role.preferDistance || 4})</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.ranged_attacker;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
            const range = role.range || 6;
            const preferDist = role.preferDistance || 4;

            const targets = getTargets(entity, game);
            let target = null;
            let minDist = range + 2;
            for (const t of targets) {
                const d = manhattanDist(entity.x, entity.y, t.x, t.y);
                if (d < minDist) { minDist = d; target = t; }
            }

            if (!target) {
                moveTowardCenter(entity, game.map, dur, game);
                return;
            }

            const dist = manhattanDist(entity.x, entity.y, target.x, target.y);

            if (dist <= range && dist >= 2) {
                if (canAttack(entity, game)) {
                    target.hp -= entity.damage;
                    target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
                    const projDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
                    game.projectiles.push({
                        fromX: entity.x, fromY: entity.y, toX: target.x, toY: target.y,
                        char: entity.projectileChar || '-',
                        color: entity.projectileColor || entity.color,
                        skinKey: 'projectile_arrow',
                        _startTime: performance.now(), _duration: projDuration,
                    });
                }
                if (dist < preferDist) {
                    fleeFrom(entity, target, game.map, dur, game);
                }
            } else if (dist > range) {
                moveToward(entity, target, game.map, dur, game);
            } else {
                fleeFrom(entity, target, game.map, dur, game);
            }
        },
    },

    melee_charger: {
        init(entity, role) {
            entity.roleState.melee_charger = { charged: false };
        },
        info(entity, role) {
            const rs = entity.roleState.melee_charger || {};
            const status = rs.charged ? 'Engaged' : 'Charging';
            return `<div class="info-row" style="color:#ff6644">Melee Charger: ${status} (+${role.chargeBonus || 5} first hit bonus)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.melee_charger;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);

            const targets = getTargets(entity, game);
            let target = null;
            let minDist = (entity.aggroRange || 10);
            for (const t of targets) {
                const d = manhattanDist(entity.x, entity.y, t.x, t.y);
                if (d < minDist) { minDist = d; target = t; }
            }

            if (!target) {
                moveTowardCenter(entity, game.map, dur, game);
                return;
            }

            const dist = manhattanDist(entity.x, entity.y, target.x, target.y);
            if (dist <= 1) {
                if (canAttack(entity, game)) {
                    const bonus = !rs.charged ? (role.chargeBonus || 5) : 0;
                    rs.charged = true;
                    const dmg = entity.damage + bonus;
                    if (target.hp !== undefined) {
                        target.hp -= dmg;
                        game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: entity.color, ttl: COMBAT_VISUALS.hitTtl });
                    } else {
                        colonistTakeDamage(target, dmg, game, entity);
                    }
                }
            } else {
                moveToward(entity, target, game.map, dur, game);
            }
        },
    },

    nexus_target: {
        init(entity) {
            entity.roleState.nexus_target = { state: 'moving' };
        },
        info(entity, role) {
            return `<div class="info-row" style="color:#aa33ff">Nexus Target: Attacking the Void Nexus</div>`;
        },
        update(entity, role, game) {
            if (!game.waves || !game.waves.active || !game.waves.nexusPosition) return;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
            const nexus = game.waves.nexusPosition;

            const nearbyColonists = game.spatial
                ? game.spatial.colonists.query(entity.x, entity.y, 1)
                : game.colonists.filter(c => c.hp > 0 && manhattanDist(entity.x, entity.y, c.x, c.y) <= 1);

            for (const c of nearbyColonists) {
                if (c.hp <= 0) continue;
                if (manhattanDist(entity.x, entity.y, c.x, c.y) <= 1) {
                    if (canAttack(entity, game)) {
                        colonistTakeDamage(c, entity.damage, game, entity);
                    }
                    return;
                }
            }

            const dist = manhattanDist(entity.x, entity.y, nexus.x, nexus.y);
            if (dist <= 1) {
                if (canAttack(entity, game)) {
                    game.waves.nexusHp -= entity.damage;
                    game.combatEffects.push({ x: nexus.x, y: nexus.y, char: COMBAT_VISUALS.hitChar, color: '#aa33ff', ttl: COMBAT_VISUALS.hitTtl });
                }
                return;
            }

            moveTowardPassable(entity, nexus, game.map, dur, game);
        },
    },

    structure_breaker: {
        init(entity) {
            entity.roleState.structure_breaker = {};
        },
        info(entity, role) {
            return `<div class="info-row" style="color:#ffaa00">Structure Breaker (${role.breakSpeed || 1}x break speed)</div>`;
        },
        update(entity, role, game) {
            if (!entity.path || entity.path.length === 0) return;
            const next = entity.path[0];
            if (isBreakableByEnemies(game.map, next.x, next.y)) {
                const tile = game.map[next.y][next.x];
                if (tile.structureHp === undefined) {
                    tile.structureHp = BUILDINGS[tile.structure]?.hp || 50;
                }
                const breakDmg = entity.damage * (role.breakSpeed || 1);
                tile.structureHp -= breakDmg;
                game.combatEffects.push({ x: next.x, y: next.y, char: '*', color: '#ffaa00', ttl: 2 });
                if (tile.structureHp <= 0) {
                    const old = tile.structure;
                    tile.structure = null;
                    tile.structureHp = undefined;
                    tile.passable = true;
                    if (game.mapIndex) game.mapIndex.removeStructure(next.x, next.y, old);
                    game.roomsDirty = true;
                    entity.path = null;
                }
            }
        },
    },

    boss: {
        init(entity, role) {
            entity.roleState.boss = { enraged: false };
        },
        info(entity, role) {
            const rs = entity.roleState.boss || {};
            const status = rs.enraged ? '<span style="color:#ff0000">ENRAGED</span>' : 'Normal';
            return `<div class="info-row" style="color:#ff8800">Boss: ${status} (enrage at ${Math.round((role.enrageThreshold || 0.3) * 100)}% HP, ${role.enrageDamageMult || 1.5}x damage)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.boss;
            const threshold = role.enrageThreshold || 0.3;
            if (!rs.enraged && entity.hp / entity.maxHp <= threshold) {
                rs.enraged = true;
                entity.damage = Math.floor(entity.damage * (role.enrageDamageMult || 1.5));
                entity.speed = Math.min(1, entity.speed * 1.2);
                game.combatEffects.push({ x: entity.x, y: entity.y, char: COMBAT_VISUALS.hitChar, color: '#ff0000', ttl: COMBAT_VISUALS.hitTtl });
            }
        },
    },

    wander: {
        init() {},
        info(entity, role) {
            return `<div class="info-row" style="color:#aabb88">Wanders near pen</div>`;
        },
        update(entity, role, game) {
            if (entity.onExpedition) return;
            if (Math.random() >= (role.moveChance || 0.1)) return;
            const pen = findPen(entity, game);
            if (!pen) return;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
            const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            const dir = dirs[Math.floor(Math.random() * 4)];
            const nx = entity.x + dir[0];
            const ny = entity.y + dir[1];
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) return;
            const wanderRadius = role.wanderRadius || 3;
            if (manhattanDist(nx, ny, pen.x, pen.y) <= wanderRadius && isPassable(game.map, nx, ny) && !game.isTileOccupied(nx, ny)) {
                moveEntity(entity, nx, ny, dur);
            }
        },
    },

    worker: {
        init() {},
        info(entity, role) {
            return `<div class="info-row" style="color:#88aaff">Worker: ${(role.specialty || 'general').charAt(0).toUpperCase() + (role.specialty || 'general').slice(1)} (skill ${role.skillLevel || 6})</div>`;
        },
        update() {},
    },

    flee_on_damage: {
        init(entity, role) {
            entity.roleState.flee_on_damage = { fleeing: false };
        },
        info(entity, role) {
            const rs = entity.roleState.flee_on_damage || {};
            const status = rs.fleeing ? '<span style="color:#ffaa00">Fleeing!</span>' : 'Normal';
            return `<div class="info-row" style="color:#cccc44">Flee on Damage: ${status} (threshold ${Math.round((role.fleeThreshold || 0.3) * 100)}% HP)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.flee_on_damage;
            const threshold = role.fleeThreshold || 0.3;
            if (!rs.fleeing && entity.hp / entity.maxHp <= threshold) {
                rs.fleeing = true;
                entity.fleeing = true;
            }
            if (entity.fleeing) {
                const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
                moveToEdge(entity, game.map, dur, game);
            }
        },
    },

    summoned: {
        init() {},
        info(entity, role) {
            const remaining = entity.expiresAt ? Math.max(0, entity.expiresAt - (window.game?.tick || 0)) : '?';
            return `<div class="info-row" style="color:#9966ff">Summoned (${remaining} ticks remaining)</div>`;
        },
        update(entity, role, game) {
            if (entity.expiresAt && game.tick >= entity.expiresAt) {
                entity.hp = 0;
            }
        },
    },
};

export function updateEntityRoles(entity, game) {
    for (const role of entity.roles) {
        const handler = ROLE_HANDLERS[role.type];
        if (handler && handler.update) {
            handler.update(entity, role, game);
        }
    }
}

export function initEntityRoles(entity) {
    if (!entity.roleState) entity.roleState = {};
    for (const role of entity.roles) {
        if (entity.roleState[role.type]) continue;
        const handler = ROLE_HANDLERS[role.type];
        if (handler && handler.init) {
            handler.init(entity, role);
        }
    }
}

/**
 * Ensure a deserialized entity has its roles + roleState populated, then init.
 *
 * Older/partial saves may omit `roles` (or store an empty array), so we
 * backfill from the entity definition. Tamed animals draw their roles from
 * `def.tamed.roles` rather than `def.roles` (a wild wolf fights; a tamed one
 * hauls/produces) — that branch only fires when both the entity is tamed and
 * the def declares a tamed variant. Role objects are shallow-cloned so per-
 * entity role tweaks never mutate the shared config.
 *
 * @param entity  The deserialized entity to normalize (mutated in place).
 * @param def     Its definition from ENTITIES[type], or undefined if unknown.
 */
export function ensureEntityRoles(entity, def) {
    if (!entity.roles || entity.roles.length === 0) {
        const roles = entity.tamed && def && def.tamed ? def.tamed.roles : def && def.roles;
        entity.roles = (roles || []).map(r => ({ ...r }));
    }
    if (!entity.roleState) entity.roleState = {};
    initEntityRoles(entity);
}

export function getRoleInfoHtml(entity) {
    if (!entity.roles || entity.roles.length === 0) return '';
    let html = '';
    for (const role of entity.roles) {
        const handler = ROLE_HANDLERS[role.type];
        if (handler && handler.info) {
            html += handler.info(entity, role);
        }
    }
    return html;
}

export function getEffectInfoHtml(entity) {
    if (!entity.effects || entity.effects.length === 0) return '';
    let html = '';
    for (const effect of entity.effects) {
        const handler = EFFECT_HANDLERS[effect.type];
        if (handler) html += handler.info(entity, effect);
    }
    return html;
}

export function updateEntityEffects(entity, game) {
    if (!entity.effects || entity.effects.length === 0) return;
    for (const effect of entity.effects) {
        const handler = EFFECT_HANDLERS[effect.type];
        if (handler) handler.update(entity, effect, game);
    }
}

const EFFECT_HANDLERS = {
    mood_aura: {
        info(entity, effect) {
            const bonus = effect.moodBonus || 5;
            const scope = effect.scope || 'aura';
            if (scope === 'self') return `<div class="info-row" style="color:#ffaacc">Mood: +${bonus} (self)</div>`;
            if (scope === 'global') return `<div class="info-row" style="color:#ffaacc">Mood: +${bonus} (all colonists)</div>`;
            return `<div class="info-row" style="color:#ffaacc">Mood Aura: +${bonus} (${effect.radius || 4} tile radius)</div>`;
        },
        update(entity, effect, game) {
            if (entity.onExpedition) return;
            const bonus = (effect.moodBonus || 5) * 0.01;
            const scope = effect.scope || 'aura';

            if (scope === 'self') {
                if (entity.mood !== undefined) entity.mood = Math.min(100, entity.mood + bonus);
                return;
            }
            if (scope === 'global') {
                for (const c of game.colonists) {
                    if (c.hp > 0) c.mood = Math.min(100, c.mood + bonus);
                }
                return;
            }
            const radius = effect.radius || 4;
            for (const c of game.colonists) {
                if (c.hp <= 0) continue;
                const dist = manhattanDist(c.x, c.y, entity.x, entity.y);
                if (dist <= radius) c.mood = Math.min(100, c.mood + bonus);
            }
        },
    },
};

function getHostiles(game, entity) {
    const hostiles = [];
    for (const r of game.raiders) { if (r.hp > 0) hostiles.push(r); }
    if (game.waves && game.waves.enemies) {
        for (const e of game.waves.enemies) { if (e.hp > 0) hostiles.push(e); }
    }
    for (const w of game.entities) { if (w.category === 'animal' && !w.tamed && w.hostile && w.hp > 0) hostiles.push(w); }
    return hostiles;
}

function getTargets(entity, game) {
    if (entity.hostile) {
        return game.colonists.filter(c => c.hp > 0);
    }
    return getHostiles(game, entity);
}

function findAnchor(entity, game) {
    if (entity.ownerId) {
        const owner = game.colonists.find(c => c.id === entity.ownerId && c.hp > 0);
        if (owner) return owner;
    }
    if (entity.penX !== undefined) return { x: entity.penX, y: entity.penY };
    const nearest = game.colonists.find(c => c.hp > 0);
    return nearest || null;
}

function findPen(entity, game) {
    return game.mapIndex.findNearest('beast_circle', entity.x, entity.y);
}

function moveToward(entity, target, map, dur, game) {
    const dx = Math.sign(target.x - entity.x);
    const dy = Math.sign(target.y - entity.y);
    const passCheck = entity.hostile ? isPassableForEnemies : isPassable;
    const candidates = [];
    if (dx !== 0 && passCheck(map, entity.x + dx, entity.y)) candidates.push([entity.x + dx, entity.y]);
    if (dy !== 0 && passCheck(map, entity.x, entity.y + dy)) candidates.push([entity.x, entity.y + dy]);
    if (candidates.length === 0) return;
    if (game) {
        const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
        if (unoccupied.length > 0) {
            const pick = unoccupied[Math.floor(Math.random() * unoccupied.length)];
            moveEntity(entity, pick[0], pick[1], dur);
            return;
        }
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    moveEntity(entity, pick[0], pick[1], dur);
}

function moveTowardPassable(entity, target, map, dur, game) {
    const dx = Math.sign(target.x - entity.x);
    const dy = Math.sign(target.y - entity.y);
    const candidates = [];
    if (dx !== 0 && isPassableForEnemies(map, entity.x + dx, entity.y)) candidates.push([entity.x + dx, entity.y]);
    if (dy !== 0 && isPassableForEnemies(map, entity.x, entity.y + dy)) candidates.push([entity.x, entity.y + dy]);
    if (candidates.length === 0) return;
    if (game) {
        const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
        if (unoccupied.length > 0) {
            const pick = unoccupied[Math.floor(Math.random() * unoccupied.length)];
            moveEntity(entity, pick[0], pick[1], dur);
            return;
        }
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    moveEntity(entity, pick[0], pick[1], dur);
}

function moveTowardCenter(entity, map, dur, game) {
    const cx = Math.floor(CONFIG.MAP_WIDTH / 2);
    const cy = Math.floor(CONFIG.MAP_HEIGHT / 2);
    moveToward(entity, { x: cx, y: cy }, map, dur, game);
}

function fleeFrom(entity, threat, map, dur, game) {
    const dx = Math.sign(entity.x - threat.x);
    const dy = Math.sign(entity.y - threat.y);
    const passCheck = entity.hostile ? isPassableForEnemies : isPassable;
    const candidates = [];
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (passCheck(map, nx, ny)) candidates.push([nx, ny]);
    if (dx !== 0 && passCheck(map, entity.x + dx, entity.y) && !(entity.x + dx === nx && entity.y === ny)) candidates.push([entity.x + dx, entity.y]);
    if (dy !== 0 && passCheck(map, entity.x, entity.y + dy) && !(entity.x === nx && entity.y + dy === ny)) candidates.push([entity.x, entity.y + dy]);
    if (candidates.length === 0) return;
    if (game) {
        const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
        if (unoccupied.length > 0) {
            moveEntity(entity, unoccupied[0][0], unoccupied[0][1], dur);
            return;
        }
    }
    moveEntity(entity, candidates[0][0], candidates[0][1], dur);
}

function moveToEdge(entity, map, dur, game) {
    const edges = [
        { x: 0, y: entity.y },
        { x: CONFIG.MAP_WIDTH - 1, y: entity.y },
        { x: entity.x, y: 0 },
        { x: entity.x, y: CONFIG.MAP_HEIGHT - 1 },
    ];
    edges.sort((a, b) =>
        manhattanDist(entity.x, entity.y, a.x, a.y) -
        manhattanDist(entity.x, entity.y, b.x, b.y)
    );
    moveToward(entity, edges[0], map, dur, game);
}

function randomMoveNear(entity, anchor, map, dur, radius, game) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const valid = dirs.filter(([ddx, ddy]) => {
        const nx = entity.x + ddx, ny = entity.y + ddy;
        if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) return false;
        return manhattanDist(nx, ny, anchor.x, anchor.y) <= radius && isPassable(map, nx, ny);
    });
    if (valid.length === 0) return;
    const unoccupied = game ? valid.filter(([ddx, ddy]) => !game.isTileOccupied(entity.x + ddx, entity.y + ddy)) : valid;
    const pool = unoccupied.length > 0 ? unoccupied : valid;
    const dir = pool[Math.floor(Math.random() * pool.length)];
    moveEntity(entity, entity.x + dir[0], entity.y + dir[1], dur);
}


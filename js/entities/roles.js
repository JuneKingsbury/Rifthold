import { CONFIG, BUILDINGS, COMBAT_VISUALS, COLONIST_CONFIG, WORK_CONFIG, TAMED_ANIMALS } from '../core/config.js';
import { manhattanDist, findPathForEnemies, findPathUniform, wasLastSearchExhausted } from '../world/pathfinding.js';
import { isPassable, isPassableForEnemies, isBreakableByEnemies, hasLineOfSight, findLineOfSightTile } from '../world/map.js';
import { moveEntity, computeMoveDuration, computeMoveCooldown } from '../systems/movement-lerp.js';
import { colonistTakeDamage, getMoveSpeedBonus, addThought } from './colonist.js';
import { spawnDamageText, spawnImpactSpray, spawnStructureCrumble } from '../ui/overlay-renderer.js';
import { escapeHtml as esc } from '../ui/ui-utils.js';

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
            const state = String(rs.state || 'patrolling');
            const stateColor = state === 'engaging' ? '#ff4444' : state === 'retreating' ? '#ffaa00' : '#44cc44';
            return `<div class="info-row" style="color:${stateColor}">Guard: ${esc(state.charAt(0).toUpperCase() + state.slice(1))} (radius ${esc(role.guardRadius || 8)}, ${esc(role.guardDamage || 8)} dmg)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.guard;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);
            const radius = role.guardRadius || 8;
            let damage = role.guardDamage || entity.damage || 8;
            let bondedColonist = null;
            if (entity.bondedColonistId) {
                bondedColonist = game.colonists?.find(c => c.id === entity.bondedColonistId && c.hp > 0);
                if (bondedColonist) damage += 1;
            }

            if (rs.state === 'retreating') {
                const anchor = findAnchor(entity, game);
                if (!anchor) { rs.state = 'patrolling'; return; }
                if (manhattanDist(entity.x, entity.y, anchor.x, anchor.y) <= 2) {
                    rs.state = 'patrolling';
                    return;
                }
                const retreatDur = bondedColonist ? _colonistFollowDur(bondedColonist, game) : dur;
                moveToward(entity, anchor, game.map, retreatDur, game);
                return;
            }

            if (entity.tamed && entity.type === 'wolf' && game.research.isResearched('wolf_mastery')) {
                damage += 4;
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
                        spawnDamageText(game, target.x, target.y, damage);
                        game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: entity.color, ttl: COMBAT_VISUALS.hitTtl });
                        if (game.settings?.showCombatParticles && !game.settings?.reduceMotion) {
                            spawnImpactSpray(game, target.x, target.y, Math.sign(target.x - entity.x), Math.sign(target.y - entity.y));
                        }
                    }
                } else {
                    const engageDur = bondedColonist ? _colonistFollowDur(bondedColonist, game) : dur;
                    moveToward(entity, target, game.map, engageDur, game);
                }
            } else {
                rs.state = 'patrolling';
                rs.target = null;
                const anchor = findAnchor(entity, game);
                if (anchor) {
                    const dist = manhattanDist(entity.x, entity.y, anchor.x, anchor.y);
                    const patrolRadius = role.patrolRadius || 3;
                    if (dist > patrolRadius) {
                        const patrolDur = bondedColonist ? _colonistFollowDur(bondedColonist, game) : dur;
                        moveToward(entity, anchor, game.map, patrolDur, game);
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
            const tamedDef = TAMED_ANIMALS[entity.type];
            const threshold = tamedDef?.hungerThreshold || 3;
            const hungerStr = (entity.hunger || 0) >= threshold ? ' <span style="color:#ff6644">Hungry!</span>' : '';
            return `<div class="info-row" style="color:#88cc88">Produces: ${esc(role.produces)} (every ${esc(role.produceRate || 80)} ticks, next in ${esc(next)})${hungerStr}</div>`;
        },
        update(entity, role, game) {
            if (entity.onExpedition) return;
            const rs = entity.roleState.production;
            const tamedDef = TAMED_ANIMALS[entity.type];
            const threshold = tamedDef?.hungerThreshold || 3;
            if ((entity.hunger || 0) >= threshold) return;
            rs.cooldown--;
            if (rs.cooldown <= 0) {
                const output = {};
                let amount = role.produceAmount || 1;
                if (game.research.isResearched('husbandry')) {
                    amount = Math.ceil(amount * WORK_CONFIG.husbandryProductionMult);
                }
                if (entity.bondedColonistId) {
                    const bonded = game.colonists?.find(c => c.id === entity.bondedColonistId && c.hp > 0);
                    if (bonded) amount = Math.ceil(amount * 1.1);
                }
                output[role.produces] = amount;
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
            return `<div class="info-row" style="color:#ffaa33">Ranged Attacker (range ${esc(role.range || 6)}, prefers distance ${esc(role.preferDistance || 4)})</div>`;
        },
        update(entity, role, game, combatSystem) {
            const rs = entity.roleState.ranged_attacker;
            const marchSpeed = (combatSystem && !combatSystem.raidEngaged && combatSystem.raidMarchSpeed)
                ? combatSystem.raidMarchSpeed : entity.speed;
            const dur = CONFIG.TICK_RATE / (Math.min(entity.speed, marchSpeed) * game.speed);
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
            const hasLos = hasLineOfSight(game.map, entity.x, entity.y, target.x, target.y);

            if (dist <= range && dist >= 2 && !hasLos) {
                // In range but a wall/door blocks the shot: step to a tile that
                // reclaims line of sight rather than standing still. If no shootable
                // tile is reachable (target sealed behind walls), lay siege and breach
                // toward it instead of idling.
                const losTile = findLineOfSightTile(game.map, entity.x, entity.y, target.x, target.y, range, isPassableForEnemies);
                if (losTile) {
                    moveToward(entity, losTile, game.map, dur, game);
                } else {
                    siegeMoveToward(entity, target, role, game.map, dur, game);
                }
            } else if (dist <= range && dist >= 2) {
                if (combatSystem) combatSystem.raidEngaged = true;
                if (canAttack(entity, game)) {
                    // A hostile entity's targets are colonists (see getTargets); they must take
                    // damage through colonistTakeDamage so armor/dodge/shield and the death path
                    // apply. Only non-colonist targets (hostiles) use raw hp subtraction.
                    const rangedWeaken = entity.activeEffects?.find(e => e.type === 'weaken' && game.tick < e.expiresAt);
                    const rangedDmg = rangedWeaken ? Math.max(1, Math.floor(entity.damage * (rangedWeaken.damageMult || 0.7))) : entity.damage;
                    if (entity.hostile) {
                        colonistTakeDamage(target, rangedDmg, game, entity);
                    } else {
                        // Friendly ranged (e.g. tamed/guard): colonistTakeDamage already
                        // shows a floater for the hostile branch, so only add one here.
                        target.hp -= rangedDmg;
                        spawnDamageText(game, target.x, target.y, rangedDmg);
                    }
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
                // Out of range: close in, breaching walls if the target is sealed off.
                siegeMoveToward(entity, target, role, game.map, dur, game);
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
            return `<div class="info-row" style="color:#ff6644">Melee Charger: ${status} (+${esc(role.chargeBonus || 5)} first hit bonus)</div>`;
        },
        update(entity, role, game, combatSystem) {
            const rs = entity.roleState.melee_charger;
            const marchSpeed = (combatSystem && !combatSystem.raidEngaged && combatSystem.raidMarchSpeed)
                ? combatSystem.raidMarchSpeed : entity.speed;
            const dur = CONFIG.TICK_RATE / (Math.min(entity.speed, marchSpeed) * game.speed);

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
                if (combatSystem) combatSystem.raidEngaged = true;
                if (canAttack(entity, game)) {
                    const bonus = !rs.charged ? (role.chargeBonus || 5) : 0;
                    rs.charged = true;
                    const weakenEff = entity.activeEffects?.find(e => e.type === 'weaken' && game.tick < e.expiresAt);
                    let dmg = entity.damage + bonus;
                    if (weakenEff) dmg = Math.max(1, Math.floor(dmg * (weakenEff.damageMult || 0.7)));
                    // Hostile entities target colonists (see getTargets) and must route through
                    // colonistTakeDamage for armor/dodge/shield and the death path. Non-colonist
                    // targets (hostiles) use raw hp subtraction.
                    if (entity.hostile) {
                        colonistTakeDamage(target, dmg, game, entity);
                    } else {
                        // Friendly melee (e.g. tamed/guard): colonistTakeDamage already
                        // shows a floater for the hostile branch, so only add one here.
                        target.hp -= dmg;
                        spawnDamageText(game, target.x, target.y, dmg);
                    }
                    game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: entity.color, ttl: COMBAT_VISUALS.hitTtl });
                    if (game.settings?.showCombatParticles && !game.settings?.reduceMotion) {
                        spawnImpactSpray(game, target.x, target.y, Math.sign(target.x - entity.x), Math.sign(target.y - entity.y));
                    }
                }
            } else {
                rs.charged = false;
                // Siege: route toward the target, breaching walls/doors when the
                // colonist is sealed off rather than freezing at the barrier.
                siegeMoveToward(entity, target, role, game.map, dur, game);
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
                if (c.hp <= 0 || c.onExpedition) continue;
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

            const breakerRole = entity.roles.find(r => r.type === 'structure_breaker');
            siegeMoveToward(entity, nexus, breakerRole || role, game.map, dur, game);
        },
    },

    structure_breaker: {
        init(entity) {
            entity.roleState.structure_breaker = {};
        },
        info(entity, role) {
            return `<div class="info-row" style="color:#ffaa00">Structure Breaker (${esc(role.breakSpeed || 1)}x break speed)</div>`;
        },
        update(entity, role, game) {
            if (!entity.path || entity.path.length === 0) return;
            const next = entity.path[0];
            if (isBreakableByEnemies(game.map, next.x, next.y)) {
                const breakDmg = entity.damage * (role.breakSpeed || 1);
                if (damageStructureTile(game.map, next.x, next.y, breakDmg, game)) {
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
            return `<div class="info-row" style="color:#ff8800">Boss: ${status} (enrage at ${Math.round((role.enrageThreshold || 0.3) * 100)}% HP, ${esc(role.enrageDamageMult || 1.5)}x damage)</div>`;
        },
        update(entity, role, game) {
            const rs = entity.roleState.boss;
            const threshold = role.enrageThreshold || 0.3;
            if (!rs.enraged && entity.hp / entity.maxHp <= threshold) {
                rs.enraged = true;
                const baseDmg = rs.prEnrageDamage ?? entity.damage;
                rs.prEnrageDamage = baseDmg;
                entity.damage = Math.floor(baseDmg * (role.enrageDamageMult || 1.5));
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

    pet: {
        init(entity) {
            entity.roleState.pet = { state: 'following', noHostileTicks: 0 };
        },
        info(entity) {
            const rs = entity.roleState.pet || {};
            const stateColor = rs.state === 'sheltering' ? '#ffaa00' : rs.state === 'fighting' ? '#ff4444' : '#aaddff';
            const stateLabel = rs.state === 'sheltering' ? 'Sheltering' : rs.state === 'fighting' ? 'Fighting!' : 'Following';
            return `<div class="info-row" style="color:${stateColor}">Pet: ${esc(stateLabel)}</div>`;
        },
        update(entity, role, game) {
            if (entity.onExpedition) return;
            const rs = entity.roleState.pet;
            const dur = CONFIG.TICK_RATE / (entity.speed * game.speed);

            const HOSTILE_DETECT_RADIUS = 6;
            const RESUME_FOLLOW_TICKS = 10;
            const FOLLOW_RANGE = 8;

            // If owner is on expedition, wait at pen instead of crowding the rift gate.
            if (entity.bondedColonistId) {
                const owner = game.colonists?.find(c => c.id === entity.bondedColonistId && c.hp > 0);
                if (owner && (owner.onExpedition || owner.expeditionPending)) {
                    const pen = findPen(entity, game);
                    if (pen) {
                        const penDist = manhattanDist(entity.x, entity.y, pen.x, pen.y);
                        if (penDist > 1) moveToward(entity, pen, game.map, dur, game);
                    }
                    rs.state = 'following';
                    return;
                }
            }

            // Fighting state: brave pets engage nearby hostiles.
            if (rs.state === 'fighting') {
                if (entity.hp < entity.maxHp * 0.2) {
                    rs.state = 'sheltering';
                    rs.noHostileTicks = 0;
                    return;
                }
                const hostiles = getHostiles(game, entity);
                let fightTarget = null;
                let minFightDist = HOSTILE_DETECT_RADIUS;
                for (const h of hostiles) {
                    const d = manhattanDist(entity.x, entity.y, h.x, h.y);
                    if (d < minFightDist) { minFightDist = d; fightTarget = h; }
                }
                if (!fightTarget) {
                    rs.state = 'following';
                    return;
                }
                if (minFightDist <= 1) {
                    if (canAttack(entity, game)) {
                        const dmg = entity.petDamage || 4;
                        fightTarget.hp -= dmg;
                        spawnDamageText(game, fightTarget.x, fightTarget.y, dmg);
                        game.combatEffects.push({ x: fightTarget.x, y: fightTarget.y, char: COMBAT_VISUALS.hitChar, color: entity.color, ttl: COMBAT_VISUALS.hitTtl });
                    }
                } else {
                    moveToward(entity, fightTarget, game.map, dur, game);
                }
                return;
            }

            // Check for nearby hostiles; brave pets fight, timid ones shelter.
            const hasHostile = _petHasNearbyHostile(entity, game, HOSTILE_DETECT_RADIUS);

            if (hasHostile) {
                if (entity.courage && Math.random() < entity.courage) {
                    rs.state = 'fighting';
                    rs.noHostileTicks = 0;
                    return;
                }
                rs.state = 'sheltering';
                rs.noHostileTicks = 0;
                const pen = findPen(entity, game);
                if (pen) moveToward(entity, pen, game.map, dur, game);
                return;
            }

            if (rs.state === 'sheltering') {
                rs.noHostileTicks = (rs.noHostileTicks || 0) + 1;
                if (rs.noHostileTicks < RESUME_FOLLOW_TICKS) {
                    const pen = findPen(entity, game);
                    if (pen) moveToward(entity, pen, game.map, dur, game);
                    return;
                }
                rs.state = 'following';
            }

            if (!entity.bondedColonistId) return;
            const owner = game.colonists?.find(c => c.id === entity.bondedColonistId && c.hp > 0);
            if (!owner) return;

            const dist = manhattanDist(entity.x, entity.y, owner.x, owner.y);
            if (dist > FOLLOW_RANGE) return;
            if (dist > 1) {
                const followDur = _colonistFollowDur(owner, game);
                moveToward(entity, owner, game.map, followDur, game);
            }

            // Per-species passive bonuses applied to bonded owner while following and in range.
            // Mood goes through a short, refreshed thought: computeMood rebuilds mood from
            // thoughts every tick, so a direct write to owner.mood would be discarded.
            switch (entity.type) {
                case 'rabbit': addThought(owner, 'Pet rabbit at my side', 4, 20, game.tick); break;
                case 'tapir':  addThought(owner, 'Pet tapir at my side', 6, 20, game.tick); break;
                case 'deer':   owner.activePetSpeedBonus = (owner.activePetSpeedBonus || 0) + 0.10; break;
                case 'okapi':  owner.activePetSpeedBonus = (owner.activePetSpeedBonus || 0) + 0.15; break;
                case 'boar':   owner.activePetDmgBonus   = (owner.activePetDmgBonus   || 0) + 1;    break;
            }
        },
    },

    worker: {
        init() {},
        info(entity, role) {
            return `<div class="info-row" style="color:#88aaff">Worker: ${esc(String(role.specialty || 'general').charAt(0).toUpperCase() + String(role.specialty || 'general').slice(1))} (skill ${esc(role.skillLevel || 6)})</div>`;
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
            return `<div class="info-row" style="color:#9966ff">Summoned (${esc(remaining)} ticks remaining)</div>`;
        },
        update(entity, role, game) {
            if (entity.expiresAt && game.tick >= entity.expiresAt) {
                entity.hp = 0;
            }
        },
    },
};

export function updateEntityRoles(entity, game, combatSystem) {
    // Crowd control (from colonist spells like Mesmerize): a stunned entity skips
    // its whole turn (no move, no attack). This is the single chokepoint shared
    // by raiders, void waves, and summons, so the stun-skip here covers every
    // entity that flows through role, including summons, whose loop calls this
    // directly. Slow is applied by the per-entity update wrappers at their
    // moveCooldown gate (the master AI clock), not here, to avoid stacking with it.
    if (entity._stunnedUntil && game.tick < entity._stunnedUntil) {
        if (game.tick % 6 === 0) {
            game.combatEffects.push({ x: entity.x, y: entity.y, char: '✦', color: '#ffccff', ttl: 4 });
        }
        return;
    }
    if (entity._slowUntil && game.tick < entity._slowUntil && game.tick % 8 === 0) {
        game.combatEffects.push({ x: entity.x, y: entity.y, char: '❄', color: '#aaddff', ttl: 3 });
    }
    for (const role of entity.roles) {
        const handler = ROLE_HANDLERS[role.type];
        if (handler && handler.update) {
            handler.update(entity, role, game, combatSystem);
            if (entity.hp <= 0) return;
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
 * hauls/produces. That branch only fires when both the entity is tamed and
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
    // Pet role is added dynamically at runtime, not in config. Restore it after load.
    if (entity.isPet && !entity.roles.some(r => r.type === 'pet')) {
        entity.roles.push({ type: 'pet' });
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
            if (scope === 'self') return `<div class="info-row" style="color:#ffaacc">Mood: +${esc(bonus)} (self)</div>`;
            if (scope === 'global') return `<div class="info-row" style="color:#ffaacc">Mood: +${esc(bonus)} (all colonists)</div>`;
            return `<div class="info-row" style="color:#ffaacc">Mood Aura: +${esc(bonus)} (${esc(effect.radius || 4)} tile radius)</div>`;
        },
        update(entity, effect, game) {
            if (entity.onExpedition) return;
            const bonus = effect.moodBonus || 5;
            const scope = effect.scope || 'aura';

            if (scope === 'self') {
                if (entity.mood !== undefined) entity.mood = Math.min(100, entity.mood + bonus * 0.01);
                return;
            }
            // Colonist mood is rebuilt from thoughts every tick (computeMood), so the
            // aura grants a short thought that is refreshed while the colonist stays in
            // range. One thought per animal type: several rabbits don't stack.
            const text = `Soothed by a ${entity.type}`;
            const radius = scope === 'global' ? Infinity : (effect.radius || 4);
            for (const c of game.colonists) {
                if (c.hp <= 0 || c.onExpedition || c.golem) continue;
                if (manhattanDist(c.x, c.y, entity.x, entity.y) <= radius) {
                    addThought(c, text, bonus, 20, game.tick);
                }
            }
        },
    },
};

function _petHasNearbyHostile(entity, game, radius) {
    for (const r of game.raiders) {
        if (r.hp > 0 && manhattanDist(entity.x, entity.y, r.x, r.y) <= radius) return true;
    }
    if (game.waves && game.waves.enemies) {
        for (const e of game.waves.enemies) {
            if (e.hp > 0 && manhattanDist(entity.x, entity.y, e.x, e.y) <= radius) return true;
        }
    }
    for (const w of game.entities) {
        if (w.category === 'animal' && !w.tamed && w.hostile && w.hp > 0 && manhattanDist(entity.x, entity.y, w.x, w.y) <= radius) return true;
    }
    return false;
}

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
        // Colonists away on an expedition keep their gate-tile position but are off-map.
        return game.colonists.filter(c => c.hp > 0 && !c.onExpedition);
    }
    return getHostiles(game, entity);
}

// Compute the move animation duration that matches a colonist's current effective
// speed, so following animals keep up visually when their owner has speed boosts.
function _colonistFollowDur(colonist, game) {
    const moveBonus = getMoveSpeedBonus(colonist);
    return computeMoveDuration(1, moveBonus, game.speed) * 0.75;
}

function findAnchor(entity, game) {
    if (entity.ownerId) {
        const owner = game.colonists.find(c => c.id === entity.ownerId && c.hp > 0);
        if (owner) return owner;
    }
    if (entity.bondedColonistId) {
        const bonded = game.colonists?.find(c => c.id === entity.bondedColonistId && c.hp > 0);
        if (bonded) return bonded;
    }
    if (entity.penX !== undefined) return { x: entity.penX, y: entity.penY };
    const nearest = game.colonists.find(c => c.hp > 0);
    return nearest || null;
}

function findPen(entity, game) {
    if (entity.penX !== undefined) return { x: entity.penX, y: entity.penY };
    if (!game.mapIndex) return null;
    return game.mapIndex.findNearest('beast_circle', entity.x, entity.y);
}

function moveTowardGreedy(entity, target, map, dur, game) {
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

// Node budget for role-driven searches. A target sealed behind walls (e.g. a
// walled map center) would otherwise flood the whole map on every move turn.
const ROLE_PATH_MAX_NODES = 6000;
// Ticks to wait before re-searching after a failed search.
const ROLE_PATH_RETRY_TICKS = 20;

// True when the cached next step can still be taken: it must be adjacent and
// either walkable or the goal itself. A wall built across the route, or the
// entity being displaced, invalidates the rest of the path.
function isStepValid(entity, step, target, passCheck, map) {
    if (Math.abs(step.x - entity.x) + Math.abs(step.y - entity.y) !== 1) return false;
    return (step.x === target.x && step.y === target.y) || passCheck(map, step.x, step.y);
}

function moveToward(entity, target, map, dur, game) {
    const passCheck = entity.hostile ? isPassableForEnemies : isPassable;
    const tick = game ? game.tick : 0;

    // Recompute path only when the target has moved, the next step is no longer
    // valid, or we have no path left.
    const targetMoved =
        !entity._pathTarget ||
        entity._pathTarget.x !== target.x ||
        entity._pathTarget.y !== target.y;
    const hasPath = entity._path && entity._path.length > 0;

    if (targetMoved || !hasPath || !isStepValid(entity, entity._path[0], target, passCheck, map)) {
        if (entity._pathRetryAt && tick < entity._pathRetryAt) {
            // Backing off after a failed search. If it only ran out of budget the
            // target may still be reachable, so keep closing in greedily.
            if (entity._pathExhausted) moveTowardGreedy(entity, target, map, dur, game);
            return;
        }
        const path = findPathUniform(map, entity.x, entity.y, target.x, target.y, passCheck, ROLE_PATH_MAX_NODES);
        entity._pathTarget = { x: target.x, y: target.y };
        if (path) {
            entity._path = path;
            entity._pathRetryAt = 0;
        } else {
            entity._path = [];
            entity._pathRetryAt = tick + ROLE_PATH_RETRY_TICKS;
            entity._pathExhausted = wasLastSearchExhausted();
            if (entity._pathExhausted) moveTowardGreedy(entity, target, map, dur, game);
            return;
        }
    }

    if (entity._path.length === 0) return;

    const next = entity._path[0];

    if (game && game.isTileOccupied(next.x, next.y)) return;

    entity._path.shift(); // consume the step.
    moveEntity(entity, next.x, next.y, dur);
}

// Applies breach damage to the breakable structure at (x,y). Lazily seeds
// structureHp from the building def, spawns a hit FX, and once HP is depleted
// removes the structure, reopens the tile, updates the map index, and flags
// rooms dirty. Returns true if the structure was destroyed this call. Shared by
// the structure_breaker role and the melee-charger siege fallback.
function damageStructureTile(map, x, y, breakDmg, game) {
    const tile = map[y][x];
    if (tile.structureHp === undefined) {
        tile.structureHp = BUILDINGS[tile.structure]?.hp || 50;
    }
    tile.structureHp -= breakDmg;
    game.combatEffects.push({ x, y, char: '*', color: '#ffaa00', ttl: 2 });
    if (tile.structureHp <= 0) {
        if (game.settings?.showCombatParticles && !game.settings?.reduceMotion) spawnStructureCrumble(game, x, y);
        const old = tile.structure;
        tile.structure = null;
        tile.structureHp = undefined;
        tile.passable = true;
        if (game.mapIndex) game.mapIndex.removeStructure(x, y, old);
        game.markRoomsDirty();
        // Clear dangling bed assignments and invalidate wave routing, matching
        // combat.js attackStructure so a breached tile is handled the same way
        // regardless of which breaker (raider siege, structure_breaker) opened it.
        if (old === 'bed') {
            for (const c of game.colonists) {
                if (c.assignedBed && c.assignedBed.x === x && c.assignedBed.y === y) {
                    c.assignedBed = null;
                }
            }
        }
        if (game.waves && game.waves.enemies) {
            for (const enemy of game.waves.enemies) { enemy.path = null; }
            game.waves.invalidatePathPreview();
        }
        return true;
    }
    return false;
}

// Siege-aware approach for hostiles: routes toward the target with
// findPathForEnemies, which prefers open ground but treats breakable walls/doors
// as high-cost passable tiles (see enemyPassability). When the cheapest route
// runs through a wall (i.e. the target is walled off and going around is too
// costly or impossible), so the attacker breaches that wall instead of freezing.
// Breaking is paced by the attacker's normal attack cooldown so it chips a wall
// at the same rate it strikes a colonist. Uses a dedicated `_siegePath` cache
// (distinct from moveToward's `_path`) so the two movers never consume each
// other's routes on entities that use both.
function siegeMoveToward(entity, target, role, map, dur, game) {
    const targetMoved =
        !entity._siegeTarget ||
        entity._siegeTarget.x !== target.x ||
        entity._siegeTarget.y !== target.y;
    const siegePass = (m, x, y) => isPassableForEnemies(m, x, y) || isBreakableByEnemies(m, x, y);
    const hasPath = entity._siegePath && entity._siegePath.length > 0;

    const backingOff = entity._siegeRetryAt && game.tick < entity._siegeRetryAt;
    if (!backingOff && (targetMoved || !hasPath || !isStepValid(entity, entity._siegePath[0], target, siegePass, map))) {
        const path = findPathForEnemies(map, entity.x, entity.y, target.x, target.y, ROLE_PATH_MAX_NODES);
        entity._siegePath = path ?? [];
        entity._siegeTarget = { x: target.x, y: target.y };
        entity._siegeRetryAt = path ? 0 : game.tick + ROLE_PATH_RETRY_TICKS;
        entity._siegeExhausted = !path && wasLastSearchExhausted();
    }

    // Out of search budget: the target may still be reachable, so close in greedily.
    if (entity._siegePath.length === 0 && entity._siegeRetryAt && game.tick < entity._siegeRetryAt) {
        if (entity._siegeExhausted) moveTowardGreedy(entity, target, map, dur, game);
        return;
    }

    if (entity._siegePath.length === 0) return;

    const next = entity._siegePath[0];

    // A wall/door lies on the cheapest route: breach it rather than walk through.
    if (isBreakableByEnemies(map, next.x, next.y)) {
        if (!canAttack(entity, game)) return;
        const breakDmg = entity.damage * (role.breakSpeed || 1);
        if (damageStructureTile(map, next.x, next.y, breakDmg, game)) {
            entity._siegePath = null; // route opened up, recompute next tick.
        }
        return;
    }

    if (game && game.isTileOccupied(next.x, next.y)) return;

    entity._siegePath.shift();
    moveEntity(entity, next.x, next.y, dur);
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
    // Cardinal moves only: entities never step diagonally. Build one candidate per
    // axis that points away from the threat (a diagonal retreat would combine both).
    const candidates = [];
    if (dx !== 0 && passCheck(map, entity.x + dx, entity.y)) candidates.push([entity.x + dx, entity.y]);
    if (dy !== 0 && passCheck(map, entity.x, entity.y + dy)) candidates.push([entity.x, entity.y + dy]);
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


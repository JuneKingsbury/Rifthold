import { CONFIG, ENTITIES, RAID_CONFIG, RAID_TYPES, BUILDINGS, COMBAT_VISUALS, PATHFINDING_CONFIG, COLONIST_CONFIG } from '../core/config.js';
import { spawnParticle } from '../ui/overlay-renderer.js';
import { isPassableForEnemies, isBreakableByEnemies } from '../world/map.js';
import { findPathForEnemies, manhattanDist } from '../world/pathfinding.js';
import { colonistTakeDamage } from './colonist.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { createRaidEntity } from './entity-factory.js';
import { updateEntityRoles } from './roles.js';

export class CombatSystem {
    constructor() {
        this.nextRaidTick = RAID_CONFIG.firstRaidTick;
        this.raidActive = false;
        this.raidStartTick = 0;
        this.activeRaidType = null;
        this.crusaderRaidTriggered = false;
        this.crusaderRaidDefeated = false;
    }

    update(game) {
        if (CONFIG.PEACEFUL_MODE) return;

        if (!this.raidActive && !this.crusaderRaidTriggered && !this.crusaderRaidDefeated &&
            game.weather.year === 8 && game.weather.season === 'spring') {
            this.startScriptedRaid(game, 'crusader_raid');
        }

        if (this.raidActive) {
            this.updateRaid(game);
        } else if (game.tick >= this.nextRaidTick) {
            const mods = game.divinationModifiers || [];
            const raidDelay = mods.reduce((sum, m) => sum + (m.raidDelay || 0), 0);
            if (raidDelay > 0) {
                this.nextRaidTick = game.tick + raidDelay;
            } else {
                this.startRaid(game);
            }
        }
    }

    startScriptedRaid(game, raidTypeKey) {
        const raidType = RAID_TYPES[raidTypeKey];
        if (!raidType) return;

        if (raidTypeKey === 'crusader_raid') this.crusaderRaidTriggered = true;

        const raidLevel = 8;
        const edge = Math.floor(Math.random() * 4);
        let spawned = 0;

        for (const entry of raidType.composition) {
            const [minCount, maxCount] = entry.count;
            const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
            for (let i = 0; i < count; i++) {
                const pos = getEdgePosition(edge, spawned);
                const entity = createRaidEntity(entry.entity, pos.x, pos.y, raidLevel, raidType.scaling);
                if (entity) {
                    game.raiders.push(entity);
                    spawned++;
                }
            }
        }

        if (spawned === 0) return;

        this.raidActive = true;
        this.raidStartTick = game.tick;
        this.activeRaidType = raidTypeKey;
        const raidPos = { x: game.raiders[0]?.x || 0, y: game.raiders[0]?.y || 0 };
        _startleNearbyColonists(game, raidPos.x, raidPos.y);
        game.alertRipple = { x: raidPos.x, y: raidPos.y, startTime: performance.now(), duration: 2000 };
        game.notifications.push({ text: `${raidType.name}! ${spawned} ${raidType.name === 'Crusader Raid' ? 'crusaders' : 'enemies'} approaching!`, tick: game.tick, type: 'danger' });
        game.eventLog.add(game, `${raidType.name}! ${spawned} enemies attacking!`, 'danger', { type: 'position', ...raidPos });

        game.events.pendingEvent = {
            type: 'raid',
            text: `${raidType.name}! ${spawned} enemies are approaching from the ${['north','east','south','west'][edge]}!`,
            choices: ['Go To Raiders', 'Dismiss'],
            data: raidPos,
        };

        if (game.settings.autoPauseHostile && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }

        this.nextRaidTick = game.tick + RAID_CONFIG.minInterval +
            Math.floor(Math.random() * (RAID_CONFIG.maxInterval - RAID_CONFIG.minInterval));
    }

    startRaid(game) {
        const wealth = game.resources.getWealth();
        const timeFactor = Math.min(1, game.tick / RAID_CONFIG.timeScalingPeak);
        const scaledRaiders = wealth * RAID_CONFIG.wealthScaling * timeFactor;
        const numRaiders = Math.max(RAID_CONFIG.baseRaiders,
            Math.floor(RAID_CONFIG.baseRaiders + scaledRaiders));

        const edge = Math.floor(Math.random() * 4);
        const raidTypeKeys = Object.keys(RAID_TYPES).filter(k => !RAID_TYPES[k].scripted);
        const raidType = raidTypeKeys.length > 0 ? RAID_TYPES[raidTypeKeys[Math.floor(Math.random() * raidTypeKeys.length)]] : null;

        const raidLevel = Math.floor(timeFactor * 10) + 1;
        let spawned = 0;

        if (raidType) {
            for (const entry of raidType.composition) {
                if (entry.minRaidLevel && raidLevel < entry.minRaidLevel) continue;
                const [minCount, maxCount] = entry.count;
                const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
                for (let i = 0; i < count && spawned < numRaiders; i++) {
                    const pos = getEdgePosition(edge, spawned);
                    const entity = createRaidEntity(entry.entity, pos.x, pos.y, raidLevel, raidType.scaling);
                    if (entity) {
                        game.raiders.push(entity);
                        spawned++;
                    }
                }
            }
        }

        if (spawned === 0) {
            for (let i = 0; i < numRaiders; i++) {
                const pos = getEdgePosition(edge, i);
                const entity = createRaidEntity('raider_brute', pos.x, pos.y, raidLevel, { hpMult: 0.1, damageMult: 0.05 });
                if (entity) game.raiders.push(entity);
            }
        }

        this.raidActive = true;
        this.raidStartTick = game.tick;
        const raidPos = { x: game.raiders[0]?.x || 0, y: game.raiders[0]?.y || 0 };
        _startleNearbyColonists(game, raidPos.x, raidPos.y);
        game.alertRipple = { x: raidPos.x, y: raidPos.y, startTime: performance.now(), duration: 2000 };
        game.notifications.push({ text: `Raid! ${numRaiders} raiders approaching!`, tick: game.tick, type: 'danger' });
        game.eventLog.add(game, `Raid! ${numRaiders} raiders attacking!`, 'danger', { type: 'position', ...raidPos });

        game.events.pendingEvent = {
            type: 'raid',
            text: `Raid! ${numRaiders} raiders are approaching from the ${['north','east','south','west'][edge]}!`,
            choices: ['Go To Raiders', 'Dismiss'],
            data: raidPos,
        };

        if (game.settings.autoPauseHostile && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }

        this.nextRaidTick = game.tick + RAID_CONFIG.minInterval +
            Math.floor(Math.random() * (RAID_CONFIG.maxInterval - RAID_CONFIG.minInterval));
    }

    updateRaid(game) {
        const aliveRaiders = game.raiders.filter(r => r.hp > 0);
        // Whether every raider was already dead at the start of this tick. Raiders are never
        // killed inside updateRaid (colonist attacks kill them elsewhere), so if any were alive
        // here the list can only empty via the flee/OOB cull below -> "Raiders fled!". We must
        // still fall through to the processing loop so the final batch of corpses gets its death
        // effects/loot and is spliced out; returning early here leaked them permanently.
        const allDead = aliveRaiders.length === 0;

        // Individual flee: each raider flees when critically wounded
        for (const raider of aliveRaiders) {
            if (!raider.noFlee && !raider.fleeing && raider.hp / raider.maxHp <= RAID_CONFIG.fleeHpFraction) {
                raider.fleeing = true;
            }
        }

        // Group rout: if 75% of the raid is dead or fleeing, the rest break
        const initialCount = game.raiders.length;
        const deadOrFleeing = initialCount - aliveRaiders.filter(r => !r.fleeing).length;
        if (deadOrFleeing >= Math.ceil(initialCount * RAID_CONFIG.routThreshold)) {
            for (const raider of aliveRaiders) {
                if (!raider.noFlee) raider.fleeing = true;
            }
        }

        // Safety timeout: all remaining raiders flee after a long time
        if (game.tick - this.raidStartTick > RAID_CONFIG.timeout) {
            for (const raider of aliveRaiders) {
                if (!raider.noFlee) raider.fleeing = true;
            }
        }

        for (let i = game.raiders.length - 1; i >= 0; i--) {
            const raider = game.raiders[i];
            if (raider.hp <= 0) {
                game.combatEffects.push({ x: raider.x, y: raider.y, char: COMBAT_VISUALS.deathChar, color: COMBAT_VISUALS.deathColor, ttl: COMBAT_VISUALS.deathTtl });
                window.soundManager?.playSFX('enemy_death');
                if (raider.loot) {
                    for (const drop of raider.loot) {
                        if (Math.random() < (drop.chance || 1)) {
                            game.resources.add({ [drop.item]: drop.amount || 1 });
                        }
                    }
                    game.combatEffects.push({ x: raider.x, y: raider.y, char: COMBAT_VISUALS.lootDropChar, color: COMBAT_VISUALS.lootDropColor, ttl: COMBAT_VISUALS.lootDropTtl });
                    // Loot arc particles: golden particles arc upward then fall
                    const numLootParticles = 2 + Math.floor(Math.random() * 2);
                    for (let lp = 0; lp < numLootParticles; lp++) {
                        spawnParticle(game, {
                            x: raider.x + 0.5 + (Math.random() - 0.5) * 0.3,
                            y: raider.y + 0.5,
                            vx: (Math.random() - 0.5) * 0.3,
                            vy: -0.6 - Math.random() * 0.3,
                            ay: 0.8,
                            decay: 0.025,
                            color: '#ffdd44',
                            size: 2.5,
                            alpha: 0.9,
                        });
                    }
                    window.soundManager?.playSFX('loot_drop');
                }
                if (game.exploration) {
                    const existing = game.exploration.raiderKills.get(raider.type);
                    if (existing) {
                        existing.count++;
                    } else {
                        const def = ENTITIES[raider.type];
                        const lootEntries = raider.loot || def?.loot || [];
                        const drops = lootEntries.map(d => `${d.amount || 1} ${d.item}${d.chance && d.chance < 1 ? ` (${Math.round(d.chance * 100)}%)` : ''}`);
                        game.exploration.raiderKills.set(raider.type, {
                            name: def?.name || raider.type,
                            char: def?.char || 'R',
                            color: def?.color || '#ff3333',
                            sprite: raider.type,
                            drops: drops.length ? drops.join(', ') : 'Nothing',
                            count: 1
                        });
                    }
                }
                game.raiders.splice(i, 1);
                continue;
            }
            updateRaider(raider, game);
            // Cull raiders that have left the map, and fleeing raiders that have reached a
            // border tile. moveToEdge parks a fleer on the edge (dx/dy become 0 there), so it
            // never crosses the < 0 bound — without this an escaped fleer lingers forever and
            // keeps raidActive true, permanently blocking all future raids.
            const atBorder = raider.x <= 0 || raider.x >= CONFIG.MAP_WIDTH - 1 ||
                raider.y <= 0 || raider.y >= CONFIG.MAP_HEIGHT - 1;
            if (raider.x < 0 || raider.x >= CONFIG.MAP_WIDTH ||
                raider.y < 0 || raider.y >= CONFIG.MAP_HEIGHT ||
                (raider.fleeing && atBorder)) {
                game.raiders.splice(i, 1);
            }
        }

        if (game.raiders.length === 0) {
            const wasScripted = this.activeRaidType;
            this.raidActive = false;
            this.activeRaidType = null;
            const text = allDead ? 'Raid defeated!' : 'Raiders fled!';
            game.notifications.push({ text, tick: game.tick, type: 'success' });
            game.eventLog.add(game, text, 'success', null);
            game.story.checkMilestone('first_raid_survived', game);
            if (wasScripted === 'crusader_raid' && allDead) {
                this.crusaderRaidDefeated = true;
                game.story.checkMilestone('first_crusader_raid_survived', game);
            }
            if (game.stats) game.stats.raidsDefeated++;
        }
    }
}

function updateRaider(raider, game) {
    // Stun (colonist CC): skip the entire turn while the deadline holds. The
    // visual pip is emitted by updateEntityRoles for role-based raiders; emit one
    // here too so role-less raiders still show the stun.
    if (raider._stunnedUntil && game.tick < raider._stunnedUntil) {
        if (game.tick % 6 === 0) game.combatEffects.push({ x: raider.x, y: raider.y, char: '✦', color: '#ffccff', ttl: 4 });
        return;
    }
    // Slow scales the effective speed used for both the cooldown gate and movement.
    const slowMult = (raider._slowUntil && game.tick < raider._slowUntil) ? (raider._slowMult || 0.5) : 1;
    const effSpeed = raider.speed * slowMult;
    raider.moveCooldown -= effSpeed;
    if (raider.moveCooldown > 0) return;
    raider.moveCooldown = 1;

    const dur = CONFIG.TICK_RATE / (effSpeed * game.speed);
    if (raider.fleeing) {
        moveToEdge(raider, game, dur);
        return;
    }

    if (raider.roles && raider.roles.length > 0) {
        updateEntityRoles(raider, game);
    }

    if (raider.roles && raider.roles.some(r => r.type === 'ranged_attacker' || r.type === 'melee_charger')) return;

    const nearest = findNearestColonist(raider, game);
    if (!nearest) {
        moveTowardCenter(raider, game, dur);
        return;
    }

    const dist = manhattanDist(raider.x, raider.y, nearest.x, nearest.y);
    if (dist <= 1) {
        const cooldown = raider.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
        if (game.tick - (raider._lastAttackTick || 0) >= cooldown) {
            raider._lastAttackTick = game.tick;
            raider._lastAttackKind = 'melee';
            raider._lastAttackDir = { dx: Math.sign(nearest.x - raider.x), dy: Math.sign(nearest.y - raider.y) };
            colonistTakeDamage(nearest, raider.damage, game, raider);
        }
        return;
    }

    raider.pathAge = (raider.pathAge || 0) + 1;
    const targetMoved = raider._lastTargetX !== undefined &&
        manhattanDist(nearest.x, nearest.y, raider._lastTargetX, raider._lastTargetY) > 3;
    if (!raider.path || raider.path.length === 0 || raider.pathAge > PATHFINDING_CONFIG.raiderRepathInterval || targetMoved) {
        raider.path = findPathForEnemies(game.map, raider.x, raider.y, nearest.x, nearest.y) || [];
        raider.pathAge = 0;
    }
    raider._lastTargetX = nearest.x;
    raider._lastTargetY = nearest.y;

    if (raider.path.length > 0) {
        const next = raider.path[0];
        if (isBreakableByEnemies(game.map, next.x, next.y)) {
            attackStructure(game, next.x, next.y, raider.damage);
            return;
        }
        if (isPassableForEnemies(game.map, next.x, next.y)) {
            if (game.isTileOccupied(next.x, next.y) && (raider._occupiedWait || 0) < 2) {
                raider._occupiedWait = (raider._occupiedWait || 0) + 1;
                return;
            }
            raider._occupiedWait = 0;
            moveEntity(raider, next.x, next.y, dur);
            raider.path.shift();
        } else {
            raider.path = [];
        }
    }
}

export function getColonistTargetPriority(colonist) {
    let priority = 0;
    for (const item of [colonist.weapon, colonist.armor, colonist.helmet, colonist.clothes, colonist.boots, colonist.tool, colonist.trinket].filter(Boolean)) {
        if (item === colonist.trinket && colonist.trinketBroken) continue;
        priority += item.targetPriority || 0;
    }
    return priority;
}

function findNearestColonist(raider, game) {
    let nearest = null;
    let minScore = Infinity;
    const radius = PATHFINDING_CONFIG.raiderSearchRadius;
    for (const c of game.colonists) {
        if (c.hp <= 0) continue;
        const dist = manhattanDist(raider.x, raider.y, c.x, c.y);
        if (dist > radius) continue;
        const score = dist - getColonistTargetPriority(c);
        if (score < minScore) {
            minScore = score;
            nearest = c;
        }
    }
    return nearest;
}

function moveTowardCenter(raider, game, dur) {
    const cx = Math.floor(CONFIG.MAP_WIDTH / 2);
    const cy = Math.floor(CONFIG.MAP_HEIGHT / 2);
    const dx = Math.sign(cx - raider.x);
    const dy = Math.sign(cy - raider.y);
    const candidates = [];
    if (dx !== 0 && isPassableForEnemies(game.map, raider.x + dx, raider.y)) candidates.push([raider.x + dx, raider.y]);
    if (dy !== 0 && isPassableForEnemies(game.map, raider.x, raider.y + dy)) candidates.push([raider.x, raider.y + dy]);
    if (candidates.length === 0) return;
    const unoccupied = candidates.filter(([cx2, cy2]) => !game.isTileOccupied(cx2, cy2));
    const pool = unoccupied.length > 0 ? unoccupied : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    moveEntity(raider, pick[0], pick[1], dur);
}

function moveToEdge(raider, game, dur) {
    const edges = [
        { x: 0, y: raider.y },
        { x: CONFIG.MAP_WIDTH - 1, y: raider.y },
        { x: raider.x, y: 0 },
        { x: raider.x, y: CONFIG.MAP_HEIGHT - 1 },
    ];
    edges.sort((a, b) =>
        manhattanDist(raider.x, raider.y, a.x, a.y) -
        manhattanDist(raider.x, raider.y, b.x, b.y)
    );
    const target = edges[0];
    const dx = Math.sign(target.x - raider.x);
    const dy = Math.sign(target.y - raider.y);
    const candidates = [];
    if (dx !== 0 && isPassableForEnemies(game.map, raider.x + dx, raider.y)) candidates.push([raider.x + dx, raider.y]);
    if (dy !== 0 && isPassableForEnemies(game.map, raider.x, raider.y + dy)) candidates.push([raider.x, raider.y + dy]);
    if (candidates.length === 0) return;
    const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
    const pool = unoccupied.length > 0 ? unoccupied : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    moveEntity(raider, pick[0], pick[1], dur);
}

export function attackStructure(game, x, y, damage) {
    const tile = game.map[y][x];
    if (!tile.structure) return;

    if (tile.structureHp === undefined) {
        tile.structureHp = BUILDINGS[tile.structure]?.hp || 50;
    }

    tile.structureHp -= damage;
    tile._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
    game.overlays.push({ type: 'floating_text', x, y, text: `-${damage}`, color: '#ff8800', fontSize: 11, ttl: 12, maxTtl: 12 });

    if (tile.structureHp <= 0) {
        game.combatEffects.push({ x, y, char: COMBAT_VISUALS.mineDustChar, color: COMBAT_VISUALS.mineDustColor, ttl: COMBAT_VISUALS.mineDustTtl });
        const oldStructure = tile.structure;
        tile.structure = null;
        tile.structureHp = undefined;
        tile.passable = true;
        if (game.mapIndex) game.mapIndex.removeStructure(x, y, oldStructure);
        game.roomsDirty = true;
        if (oldStructure === 'bed') {
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
    }
}

function getEdgePosition(side, offset) {
    const spread = offset * 2;
    switch (side) {
        case 0: return { x: Math.floor(CONFIG.MAP_WIDTH / 2) + spread, y: 0 };
        case 1: return { x: CONFIG.MAP_WIDTH - 1, y: Math.floor(CONFIG.MAP_HEIGHT / 2) + spread };
        case 2: return { x: Math.floor(CONFIG.MAP_WIDTH / 2) + spread, y: CONFIG.MAP_HEIGHT - 1 };
        case 3: return { x: 0, y: Math.floor(CONFIG.MAP_HEIGHT / 2) + spread };
    }
}

export function raiderTakeDamage(raider, damage) {
    raider.hp -= damage;
}

function _startleNearbyColonists(game, raidX, raidY) {
    const STARTLE_RADIUS = 10;
    for (const c of game.colonists) {
        if (c.hp <= 0 || c.onExpedition) continue;
        const dist = Math.abs(c.x - raidX) + Math.abs(c.y - raidY);
        if (dist > STARTLE_RADIUS) continue;
        // Closer colonists react more strongly and sooner
        const delay = dist * 2; // ticks of delay before startle triggers visually
        // Use a tick-based future stamp so the animation plays after a brief delay
        c._startleUntil = game.tick + delay + 1;
    }
}

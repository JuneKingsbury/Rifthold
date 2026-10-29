import { CONFIG, ANIMALS, SEASON_EFFECTS, WILDLIFE_CONFIG } from '../core/config.js';
import { isPassableForAnimals } from '../world/map.js';
import { manhattanDist } from '../world/pathfinding.js';
import { colonistTakeDamage } from './colonist.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { createWildAnimal } from './entity-factory.js';
import { tickHostileStatusEffects } from './combat.js';

export function updateWildlife(game) {
    maybeSpawnAnimal(game);
    syncAnimalTasks(game);
    // Built once per tick so each animal's checks are set lookups rather than
    // scans of every task.
    const ctx = buildAnimalTaskIndex(game);

    // Iterate the dedicated wild-animal subset to avoid scanning all entities.
    for (let i = game.wildAnimals.length - 1; i >= 0; i--) {
        const animal = game.wildAnimals[i];

        if (animal.tamed) {
            // Animal was just tamed: evict from wildAnimals only (entities handled by taming.js).
            game.wildAnimals.splice(i, 1);
            continue;
        }

        // Animal being led to pen: follow the colonist each tick.
        if (animal.pendingTame) {
            updatePendingLeadAnimal(animal, game, ctx);
            continue;
        }

        // Weapon DoTs and spell effects from colonists tick the same way as on raiders.
        if (animal.hp > 0) tickHostileStatusEffects(animal, game);

        if (animal.hp <= 0) {
            // Animals that wandered off the map die silently, no meat/hides. Only
            // hunted or combat-killed animals (which never set _leftMap) yield loot.
            if (!animal._leftMap) {
                const def = ANIMALS[animal.type];
                if (def) {
                    const yield_ = { meat: def.meatYield };
                    if (def.hideYield) yield_.hides = def.hideYield;
                    if (def.woolYield) yield_.wool = def.woolYield;
                    game.resources.add(yield_);
                }
                if (game.exploration) {
                    const existing = game.exploration.wildlifeKills.get(animal.type);
                    if (existing) {
                        existing.count++;
                    } else {
                        const d = ANIMALS[animal.type];
                        const drops = [];
                        if (d?.meatYield) drops.push(`${d.meatYield} meat`);
                        if (d?.hideYield) drops.push(`${d.hideYield} hides`);
                        if (d?.woolYield) drops.push(`${d.woolYield} wool`);
                        game.exploration.wildlifeKills.set(animal.type, {
                            name: d?.name || animal.type.charAt(0).toUpperCase() + animal.type.slice(1),
                            char: d?.char || '?',
                            color: d?.color || '#888888',
                            sprite: animal.type,
                            drops: drops.length ? drops.join(', ') : 'Nothing',
                            count: 1
                        });
                    }
                }
            }
            const entIdx = game.entities.indexOf(animal);
            if (entIdx >= 0) game.entities.splice(entIdx, 1);
            game.wildAnimals.splice(i, 1);
            continue;
        }
        updateAnimal(animal, game, ctx);
    }
}

function maybeSpawnAnimal(game) {
    const spawnRate = SEASON_EFFECTS[game.weather.season].animalSpawnRate;
    if (Math.random() > spawnRate) return;
    // Count using the dedicated subset — avoids scanning all entities.
    const wildCount = game.wildAnimals.filter(e => !e.pendingTame && !e.guardian).length;
    if (wildCount >= WILDLIFE_CONFIG.maxCount) return;

    let edge;
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = getRandomEdge();
        if (isPassableForAnimals(game.map, candidate.x, candidate.y)) {
            edge = candidate;
            break;
        }
    }
    if (!edge) return;

    const type = pickAnimalType(game);
    if (!type) return;
    if (ANIMALS[type].hostile && CONFIG.PEACEFUL_MODE) return;

    const animal = createWildAnimal(type, edge.x, edge.y);
    game.entities.push(animal);
    game.wildAnimals.push(animal);
}

const _spawnTable = (() => {
    const entries = [];
    let total = 0;
    for (const [type, def] of Object.entries(ANIMALS)) {
        if (def.spawnWeight > 0 && !def.spawnCondition) {
            total += def.spawnWeight;
            entries.push({ type, cumulative: total });
        }
    }
    return { entries, total };
})();

function pickAnimalType(game) {
    if (!CONFIG.PEACEFUL_MODE && (game.weather.season === 'winter' || game.timeOfDay / CONFIG.TICKS_PER_DAY > WILDLIFE_CONFIG.wolfNightThreshold)) {
        if (Math.random() < 0.3) return 'wolf';
    }
    const roll = Math.random() * _spawnTable.total;
    for (const entry of _spawnTable.entries) {
        if (roll < entry.cumulative) return entry.type;
    }
    return _spawnTable.entries[0]?.type || 'rabbit';
}

function getRandomEdge() {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: return { x: Math.floor(Math.random() * CONFIG.MAP_WIDTH), y: 0 };
        case 1: return { x: CONFIG.MAP_WIDTH - 1, y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT) };
        case 2: return { x: Math.floor(Math.random() * CONFIG.MAP_WIDTH), y: CONFIG.MAP_HEIGHT - 1 };
        case 3: return { x: 0, y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT) };
    }
}

function isEdgeExit(fromX, fromY, toX, toY) {
    if (toX >= 0 && toX < CONFIG.MAP_WIDTH && toY >= 0 && toY < CONFIG.MAP_HEIGHT) return false;
    return fromX === 0 || fromX === CONFIG.MAP_WIDTH - 1 || fromY === 0 || fromY === CONFIG.MAP_HEIGHT - 1;
}

function updateAnimal(animal, game, ctx) {
    // Colonist CC: a stunned animal skips its turn, a slowed one acts at reduced
    // speed (same deadlines the raider and void-wave AI read).
    if (animal._stunnedUntil && game.tick < animal._stunnedUntil) {
        if (game.tick % 6 === 0) game.combatEffects.push({ x: animal.x, y: animal.y, char: '✦', color: '#ffccff', ttl: 4 });
        return;
    }
    const slowMult = (animal._slowUntil && game.tick < animal._slowUntil) ? (animal._slowMult || 0.5) : 1;
    const effSpeed = animal.speed * slowMult;
    animal.moveCooldown -= effSpeed;
    if (animal.moveCooldown > 0) return;
    animal.moveCooldown = 1;

    const def = ANIMALS[animal.type];

    if (def.tameable && ctx.tamed.has(animal.id)) return;

    const dur = CONFIG.TICK_RATE / (effSpeed * game.speed);
    if (def.hostile) {
        updateHostileAnimal(animal, def, game, dur);
    } else {
        updatePassiveAnimal(animal, def, game, dur, ctx);
    }

    if (animal.x < 0 || animal.x >= CONFIG.MAP_WIDTH || animal.y < 0 || animal.y >= CONFIG.MAP_HEIGHT) {
        animal.hp = 0;
        animal._leftMap = true;
    }
}

const ANIMAL_TASK_TYPES = new Set(['hunt', 'tame', 'lead_animal', 'feed_animal', 'relocate_animal']);

function syncAnimalTasks(game) {
    let animalsById = null;
    // Iterate a copy: tasks for vanished animals are removed mid-loop.
    for (const task of game.taskQueue.getAll().slice()) {
        if (!ANIMAL_TASK_TYPES.has(task.type)) continue;
        if (!animalsById) {
            animalsById = new Map();
            for (const e of game.entities) if (e.category === 'animal') animalsById.set(e.id, e);
        }
        const animal = animalsById.get(task.targetAnimalId);
        if (!animal || animal.hp <= 0) {
            if (task.type === 'lead_animal' && animal) { animal.pendingTame = false; animal.leaderId = null; }
            if (task.type === 'feed_animal' && animal) animal._feedTaskQueued = false;
            if (task.type === 'relocate_animal' && animal) animal._relocateTaskQueued = false;
            game.taskQueue.remove(task.id);
        } else if (task.type === 'relocate_animal') {
            // Keep task x/y tracking the animal so the colonist can find it if it moves.
            if (task.x !== animal.x || task.y !== animal.y) {
                game.taskQueue.updatePosition(task, animal.x, animal.y);
            }
        } else if (task.type === 'hunt' || task.type === 'tame') {
            if (task.x !== animal.x || task.y !== animal.y) {
                game.taskQueue.updatePosition(task, animal.x, animal.y);
            }
        }
    }
}

// Per-tick lookup of which animals are targeted by tame/hunt/lead tasks, so the
// per-animal checks below don't each rescan the task list.
function buildAnimalTaskIndex(game) {
    const tamed = new Set();
    const hunted = new Set();
    const leadTasks = new Map();
    for (const t of game.taskQueue.getAll()) {
        if (t.type === 'tame') tamed.add(t.targetAnimalId);
        else if (t.type === 'hunt') hunted.add(t.targetAnimalId);
        else if (t.type === 'lead_animal' && t.assignedTo !== null && !leadTasks.has(t.targetAnimalId)) leadTasks.set(t.targetAnimalId, t);
    }
    for (const c of game.colonists) {
        if (c.state === 'hunting' && c.huntTargetId !== undefined) hunted.add(c.huntTargetId);
    }
    return { tamed, hunted, leadTasks };
}

function updatePendingLeadAnimal(animal, game, ctx) {
    // Sync leaderId to whoever currently holds the lead_animal task for this animal.
    // This handles the case where the original tamer dropped the task and another
    // colonist picked it up (or it was re-claimed after an interrupt).
    const leadTask = ctx.leadTasks.get(animal.id);
    if (leadTask) {
        animal.leaderId = leadTask.assignedTo;
    } else {
        // No active lead task: clear pending state so the animal is not stuck following.
        animal.pendingTame = false;
        animal.leaderId = null;
        return;
    }

    const leader = game.colonists.find(c => c.id === animal.leaderId && c.hp > 0);
    if (!leader) {
        animal.pendingTame = false;
        animal.leaderId = null;
        return;
    }
    const dur = CONFIG.TICK_RATE / ((animal.speed || 0.3) * game.speed);
    moveEntity(animal, leader.x, leader.y, dur);
}

function updatePassiveAnimal(animal, def, game, dur, ctx) {
    if (ctx.tamed.has(animal.id)) return;
    if (ctx.hunted.has(animal.id)) return;

    const nearestColonist = findNearestColonist(animal, game);
    if (nearestColonist && manhattanDist(animal.x, animal.y, nearestColonist.x, nearestColonist.y) <= def.fleeRange) {
        fleeFrom(animal, nearestColonist, game, dur);
        return;
    }

    if (Math.random() < WILDLIFE_CONFIG.passiveMoveChance) {
        randomMove(animal, game, dur);
    }
}

// Crypt guardians drift back to their post when idle, so a woken guardian does not
// wander the map once its prey is out of range.
const GUARDIAN_LEASH = 5;

function idleMove(animal, game, dur) {
    if (animal.home && manhattanDist(animal.x, animal.y, animal.home.x, animal.home.y) > GUARDIAN_LEASH) {
        moveToward(animal, animal.home, game, dur);
    } else if (Math.random() < WILDLIFE_CONFIG.hostileIdleMoveChance) {
        randomMove(animal, game, dur);
    }
}

function updateHostileAnimal(animal, def, game, dur) {
    const nearestColonist = findNearestColonist(animal, game);
    if (!nearestColonist) {
        if (animal.home) idleMove(animal, game, dur);
        else randomMove(animal, game, dur);
        return;
    }

    const dist = manhattanDist(animal.x, animal.y, nearestColonist.x, nearestColonist.y);

    if (dist <= 1) {
        colonistTakeDamage(nearestColonist, def.damage, game, animal);
    } else if (dist <= def.aggroRange) {
        moveToward(animal, nearestColonist, game, dur);
    } else {
        idleMove(animal, game, dur);
    }
}

// Colonists on an expedition keep their old map position but are away, so animals
// (and crypt guardians waiting beside a rift anchor) must not target them.
const notOnExpedition = c => !c.onExpedition;

function findNearestColonist(animal, game) {
    if (game.spatial) {
        return game.spatial.colonists.findNearest(animal.x, animal.y, WILDLIFE_CONFIG.animalSearchRadius, notOnExpedition);
    }
    let nearest = null;
    let minDist = Infinity;
    for (const c of game.colonists) {
        if (c.hp <= 0 || c.onExpedition) continue;
        const dist = manhattanDist(animal.x, animal.y, c.x, c.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = c;
        }
    }
    return nearest;
}

function fleeFrom(animal, threat, game, dur) {
    const dx = Math.sign(animal.x - threat.x);
    const dy = Math.sign(animal.y - threat.y);
    // Movement is cardinal only (no diagonals): step away along one axis. Try the
    // axis of greater separation first so the animal flees in its best direction.
    const steps = [];
    if (dx !== 0) steps.push([animal.x + dx, animal.y]);
    if (dy !== 0) steps.push([animal.x, animal.y + dy]);
    if (Math.abs(animal.y - threat.y) > Math.abs(animal.x - threat.x)) steps.reverse();
    for (const [nx, ny] of steps) {
        if (isPassableForAnimals(game.map, nx, ny) || isEdgeExit(animal.x, animal.y, nx, ny)) {
            moveEntity(animal, nx, ny, dur);
            return;
        }
    }
    randomMove(animal, game, dur);
}

function moveToward(animal, target, game, dur) {
    const dx = Math.sign(target.x - animal.x);
    const dy = Math.sign(target.y - animal.y);
    const candidates = [];
    if (dx !== 0 && isPassableForAnimals(game.map, animal.x + dx, animal.y)) candidates.push([animal.x + dx, animal.y]);
    if (dy !== 0 && isPassableForAnimals(game.map, animal.x, animal.y + dy)) candidates.push([animal.x, animal.y + dy]);
    if (candidates.length === 0) return;
    const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
    if (unoccupied.length > 0) {
        const pick = unoccupied[Math.floor(Math.random() * unoccupied.length)];
        moveEntity(animal, pick[0], pick[1], dur);
    } else {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        moveEntity(animal, pick[0], pick[1], dur);
    }
}

function randomMove(animal, game, dur) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const passable = dirs.filter(([ddx, ddy]) => {
        const nx = animal.x + ddx, ny = animal.y + ddy;
        return isPassableForAnimals(game.map, nx, ny);
    });
    const exits = dirs.filter(([ddx, ddy]) => {
        return isEdgeExit(animal.x, animal.y, animal.x + ddx, animal.y + ddy);
    });
    const candidates = [...passable, ...exits];
    if (candidates.length === 0) return;
    const unoccupied = candidates.filter(([ddx, ddy]) => {
        const nx = animal.x + ddx, ny = animal.y + ddy;
        if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) return true;
        return !game.isTileOccupied(nx, ny);
    });
    const pool = unoccupied.length > 0 ? unoccupied : candidates;
    const dir = pool[Math.floor(Math.random() * pool.length)];
    moveEntity(animal, animal.x + dir[0], animal.y + dir[1], dur);
}

export function designateHunt(game, animalId) {
    const animal = game.entities.find(a => a.id === animalId && a.category === 'animal' && !a.tamed);
    if (!animal) return false;

    game.taskQueue.add({
        type: 'hunt',
        skillRequired: 'animals',
        x: animal.x,
        y: animal.y,
        workAmount: 1,
        skillXpGain: 1,
        targetAnimalId: animalId,
    });
    return true;
}

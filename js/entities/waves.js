import { CONFIG, WAVE_CONFIG, WAVE_TYPES, COMBAT_VISUALS, COLONIST_CONFIG, BUILDINGS } from '../core/config.js';
import { isPassableForEnemies, isBreakableByEnemies } from '../world/map.js';
import { manhattanDist } from '../world/pathfinding.js';
import { colonistTakeDamage } from './colonist.js';
import { moveEntity } from '../systems/movement-lerp.js';
import { createWaveEntity } from './entity-factory.js';
import { updateEntityRoles } from './roles.js';
import { attackStructure } from './combat.js';


export class WaveSystem {
    constructor() {
        this.highestWaveCompleted = 0;
        this.active = false;
        this.currentWave = 0;
        this.nexusPosition = null;
        this.nexusHp = 0;
        this.nexusMaxHp = 0;
        this.enemies = [];
        this.enemiesSpawned = 0;
        this.enemiesToSpawn = 0;
        this.spawnTimer = 0;
        this.waveStartTick = 0;
        this.portals = [];
        this.lastWaveResult = null;
    }

    getColonistCap(game) {
        let base = WAVE_CONFIG.colonistCapBase;
        if (game && game.mapIndex) {
            for (const [key, def] of Object.entries(BUILDINGS)) {
                if (def.colonistCapBonus) {
                    const count = game.mapIndex.getStructurePositions(key).size;
                    base += def.colonistCapBonus * count;
                }
            }
        }
        if (this.highestWaveCompleted === 0) return base;
        const bonus = Math.floor(this.highestWaveCompleted / 2);
        return Math.min(WAVE_CONFIG.colonistCapMax, base + bonus);
    }

    canStartWave(game) {
        if (this.active) return false;
        return this.findNexus(game) !== null;
    }

    findNexus(game) {
        if (game.mapIndex) {
            return game.mapIndex.findFirst('void_nexus');
        }
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                if (game.map[y][x].structure === 'void_nexus') {
                    return { x, y };
                }
            }
        }
        return null;
    }

    startWave(game) {
        const nexus = this.findNexus(game);
        if (!nexus || this.active) return false;

        this.active = true;
        this.currentWave = this.highestWaveCompleted + 1;
        this.nexusPosition = nexus;
        this.nexusMaxHp = WAVE_CONFIG.nexusHp + WAVE_CONFIG.nexusHpPerWave * this.currentWave;
        this.nexusHp = this.nexusMaxHp;
        this.enemies = [];
        this.enemiesToSpawn = WAVE_CONFIG.baseEnemies + WAVE_CONFIG.enemiesPerWave * (this.currentWave - 1);
        this.enemiesSpawned = 0;
        this.spawnTimer = 0;
        this.waveStartTick = game.tick;
        this.portals = [
            getWaveSpawnPosition(0, nexus),
            getWaveSpawnPosition(1, nexus),
            getWaveSpawnPosition(2, nexus),
            getWaveSpawnPosition(3, nexus),
        ];

        game.notifications.push({ text: `Wave ${this.currentWave} begins! Defend the Void Nexus!`, tick: game.tick, type: 'danger' });
        game.eventLog.add(game, `Wave ${this.currentWave} started — ${this.enemiesToSpawn} enemies incoming!`, 'danger', { type: 'position', ...nexus });
        game.overlays.push({ type: 'screenFlash', color: COMBAT_VISUALS.waveAlertColor, alpha: 0.2, ttl: COMBAT_VISUALS.waveAlertTtl });
        window.soundManager?.playSFX('wave_alert');

        if (game.settings.autoPauseHostile && !game.paused) {
            game.togglePause();
        }

        return true;
    }

    update(game) {
        if (!this.active) return;

        if (this.enemiesSpawned < this.enemiesToSpawn) {
            this.spawnTimer++;
            if (this.spawnTimer >= WAVE_CONFIG.spawnInterval) {
                this.spawnTimer = 0;
                this.spawnEnemy(game);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.hp <= 0) {
                game.combatEffects.push({ x: enemy.x, y: enemy.y, char: COMBAT_VISUALS.deathChar, color: COMBAT_VISUALS.deathColor, ttl: COMBAT_VISUALS.deathTtl });
                game.combatEffects.push({ x: enemy.x, y: enemy.y, char: COMBAT_VISUALS.lootDropChar, color: COMBAT_VISUALS.lootDropColor, ttl: COMBAT_VISUALS.lootDropTtl });
                window.soundManager?.playSFX('enemy_death');
                game.resources.add({ void_essence: WAVE_CONFIG.essencePerKill });
                if (enemy.loot) {
                    for (const drop of enemy.loot) {
                        if (Math.random() < (drop.chance || 1)) {
                            game.resources.add({ [drop.item]: drop.amount || 1 });
                        }
                    }
                }
                this.enemies.splice(i, 1);
                continue;
            }
            this.updateEnemy(enemy, game);
        }

        if (this.nexusHp <= 0) {
            this.endWave(game, false);
            return;
        }

        if (this.enemiesSpawned >= this.enemiesToSpawn && this.enemies.length === 0) {
            this.endWave(game, true);
        }
    }

    spawnEnemy(game) {
        const portal = this.portals[Math.floor(Math.random() * this.portals.length)];
        const waveTypeKeys = Object.keys(WAVE_TYPES);
        const waveType = waveTypeKeys.length > 0 ? WAVE_TYPES[waveTypeKeys[0]] : null;

        let entityType = null;
        if (waveType) {
            entityType = pickFromComposition(waveType.composition, this.currentWave);
        }

        const entity = createWaveEntity(entityType || 'void_walker', portal.x, portal.y, this.currentWave);
        if (entity) {
            this.enemies.push(entity);
            this.enemiesSpawned++;
        }
    }

    updateEnemy(enemy, game) {
        enemy.moveCooldown -= enemy.speed;
        if (enemy.moveCooldown > 0) return;
        enemy.moveCooldown = 1;

        if (enemy.roles && enemy.roles.length > 0) {
            updateEntityRoles(enemy, game);
            if (enemy.roles.some(r => r.type === 'nexus_target' || r.type === 'ranged_attacker')) return;
        }

        const dur = CONFIG.TICK_RATE / (enemy.speed * game.speed);

        const nearbyColonists = game.spatial
            ? game.spatial.colonists.query(enemy.x, enemy.y, 1)
            : game.colonists.filter(c => c.hp > 0 && manhattanDist(enemy.x, enemy.y, c.x, c.y) <= 1);

        let bestTarget = null;
        let bestScore = -Infinity;
        for (const c of nearbyColonists) {
            if (c.hp <= 0) continue;
            if (manhattanDist(enemy.x, enemy.y, c.x, c.y) > 1) continue;
            const priority = (c.artifact && !c.artifactBroken) ? (c.artifact.combat?.targetPriority || 0) : 0;
            const score = priority;
            if (score > bestScore) { bestScore = score; bestTarget = c; }
        }
        if (bestTarget) {
            const cooldown = enemy.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            if (game.tick - (enemy._lastAttackTick || 0) < cooldown) return;
            enemy._lastAttackTick = game.tick;
            colonistTakeDamage(bestTarget, enemy.damage, game, enemy);
            return;
        }

        for (const c of nearbyColonists) {
            if (c.hp <= 0 || c.state !== 'fighting') continue;
            if (manhattanDist(enemy.x, enemy.y, c.x, c.y) <= 1) return;
        }

        const dist = manhattanDist(enemy.x, enemy.y, this.nexusPosition.x, this.nexusPosition.y);
        if (dist <= 1) {
            const cooldown = enemy.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            if (game.tick - (enemy._lastAttackTick || 0) < cooldown) return;
            enemy._lastAttackTick = game.tick;
            this.nexusHp -= enemy.damage;
            const nexusTile = game.map[this.nexusPosition.y]?.[this.nexusPosition.x];
            if (nexusTile) nexusTile._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            return;
        }

        if (!enemy.path || enemy.path.length === 0 || (enemy.pathAge || 0) > WAVE_CONFIG.repathInterval) {
            enemy.path = findEnemyPath(game.map, enemy.x, enemy.y, this.nexusPosition.x, this.nexusPosition.y);
            if (!enemy.path) {
                enemy.pathAge = WAVE_CONFIG.repathInterval - 3;
            } else {
                enemy.pathAge = 0;
            }
        }

        if (enemy.path && enemy.path.length > 0) {
            const next = enemy.path[0];
            if (isBreakableByEnemies(game.map, next.x, next.y)) {
                attackStructure(game, next.x, next.y, enemy.damage);
                enemy.pathAge = (enemy.pathAge || 0) + 1;
                return;
            }
            if (isPassableForEnemies(game.map, next.x, next.y)) {
                if (game.isTileOccupied(next.x, next.y) && (enemy._occupiedWait || 0) < 2) {
                    enemy._occupiedWait = (enemy._occupiedWait || 0) + 1;
                    return;
                }
                enemy._occupiedWait = 0;
                moveEntity(enemy, next.x, next.y, dur);
                enemy.path.shift();
                enemy.pathAge = (enemy.pathAge || 0) + 1;
            } else {
                enemy.path = null;
            }
        }
    }

    getPathPreview(game) {
        if (!this.active || !this.nexusPosition) return [];
        if (this._pathPreviewCache && this._pathPreviewAge < 30) {
            this._pathPreviewAge++;
            return this._pathPreviewCache;
        }
        const allPoints = [];
        for (const p of this.portals) {
            const path = findEnemyPath(game.map, p.x, p.y, this.nexusPosition.x, this.nexusPosition.y);
            if (path) {
                for (const pt of path) allPoints.push(pt);
            }
        }
        this._pathPreviewCache = allPoints;
        this._pathPreviewAge = 0;
        return allPoints;
    }

    invalidatePathPreview() {
        this._pathPreviewCache = null;
    }

    endWave(game, victory) {
        if (victory) {
            this.highestWaveCompleted = this.currentWave;
            const bonusEssence = this.currentWave * WAVE_CONFIG.bonusEssencePerWave;
            game.resources.add({ void_essence: bonusEssence });
            game.notifications.push({ text: `Wave ${this.currentWave} complete! +${bonusEssence} bonus void essence. Colony cap: ${this.getColonistCap(game)}`, tick: game.tick, type: 'success' });
            game.eventLog.add(game, `Wave ${this.currentWave} defeated! Colony can now support ${this.getColonistCap(game)} colonists.`, 'success', null);
            game.story.checkMilestone('first_wave_completed', game);
            if (game.stats) game.stats.wavesCompleted++;
        } else {
            game.notifications.push({ text: `Wave ${this.currentWave} failed — the Void Nexus was destroyed!`, tick: game.tick, type: 'danger' });
            game.eventLog.add(game, `The Void Nexus was destroyed during wave ${this.currentWave}!`, 'danger', { type: 'position', ...this.nexusPosition });
            const tile = game.map[this.nexusPosition.y][this.nexusPosition.x];
            tile.structure = null;
            tile.passable = true;
            if (game.mapIndex) game.mapIndex.removeStructure(this.nexusPosition.x, this.nexusPosition.y, 'void_nexus');
            game.roomsDirty = true;
        }

        this.lastWaveResult = { wave: this.currentWave, victory };
        this.active = false;
        this.enemies = [];
        this.portals = [];
    }
}

function pickFromComposition(composition, currentWave) {
    const eligible = composition.filter(c => !c.minWave || currentWave >= c.minWave);
    if (eligible.length === 0) return null;
    const totalWeight = eligible.reduce((sum, c) => sum + (c.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const entry of eligible) {
        roll -= (entry.weight || 1);
        if (roll <= 0) return entry.entity;
    }
    return eligible[eligible.length - 1].entity;
}

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ENEMY_MAX_NODES = WAVE_CONFIG.maxPathNodes;

class EnemyHeap {
    constructor() { this.data = []; }
    push(node) { this.data.push(node); this._up(this.data.length - 1); }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) { this.data[0] = last; this._down(0); }
        return top;
    }
    get length() { return this.data.length; }
    _up(i) {
        const node = this.data[i];
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].f <= node.f) break;
            this.data[i] = this.data[p];
            i = p;
        }
        this.data[i] = node;
    }
    _down(i) {
        const len = this.data.length;
        const node = this.data[i];
        while (true) {
            let s = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < len && this.data[l].f < this.data[s].f) s = l;
            if (r < len && this.data[r].f < this.data[s].f) s = r;
            if (s === i) break;
            this.data[i] = this.data[s];
            this.data[s] = node;
            i = s;
        }
    }
}

function getBreakCost(map, x, y) {
    const tile = map[y][x];
    const hp = tile.structureHp !== undefined ? tile.structureHp : (BUILDINGS[tile.structure]?.hp || 50);
    return Math.max(2, Math.ceil(hp / 5));
}

function findEnemyPath(map, startX, startY, endX, endY) {
    const open = new EnemyHeap();
    const closed = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    const key = (x, y) => (y << 16) | x;
    const start = key(startX, startY);

    gScore.set(start, 0);
    open.push({ x: startX, y: startY, f: manhattanDist(startX, startY, endX, endY) });

    let iterations = 0;
    while (open.length > 0 && iterations < ENEMY_MAX_NODES) {
        iterations++;
        const current = open.pop();
        const currentKey = key(current.x, current.y);

        if (closed.has(currentKey)) continue;

        if (manhattanDist(current.x, current.y, endX, endY) <= 1) {
            const path = [];
            let ck = currentKey;
            while (ck !== start) {
                path.push({ x: ck & 0xFFFF, y: ck >> 16 });
                const prev = cameFrom.get(ck);
                if (prev === undefined) break;
                ck = prev;
            }
            path.reverse();
            return path;
        }

        closed.add(currentKey);

        for (const [dx, dy] of DIRS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
            const nKey = key(nx, ny);
            if (closed.has(nKey)) continue;

            let cost = 1;
            if (isBreakableByEnemies(map, nx, ny)) {
                cost = getBreakCost(map, nx, ny);
            } else if (!isPassableForEnemies(map, nx, ny)) {
                continue;
            }

            const tentativeG = gScore.get(currentKey) + cost;
            if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentativeG);
                const f = tentativeG + manhattanDist(nx, ny, endX, endY);
                open.push({ x: nx, y: ny, f });
            }
        }
    }

    return null;
}


function getWaveSpawnPosition(side, nexus) {
    const { near, offsetRange } = WAVE_CONFIG.spawnDistance;
    const offset = Math.floor(Math.random() * offsetRange) - Math.floor(offsetRange / 2);
    switch (side) {
        case 0: return { x: Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, nexus.x + offset)), y: Math.max(0, nexus.y - near) };
        case 1: return { x: Math.min(CONFIG.MAP_WIDTH - 1, nexus.x + near), y: Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, nexus.y + offset)) };
        case 2: return { x: Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, nexus.x + offset)), y: Math.min(CONFIG.MAP_HEIGHT - 1, nexus.y + near) };
        case 3: return { x: Math.max(0, nexus.x - near), y: Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, nexus.y + offset)) };
    }
}

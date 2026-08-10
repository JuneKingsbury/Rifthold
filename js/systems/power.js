/**
 * Mana "power" grid: tallies generation vs consumption from placed buildings
 * and gates powered devices (heaters, lamps, turrets) on a net-positive supply.
 * PowerSystem.update runs every 10th simulation tick; updateTurrets runs every
 * tick while powered so defenses react quickly.
 */
import { BUILDINGS, COMBAT_VISUALS, ARTIFACTS } from '../core/config.js';
import { manhattanDist } from '../world/pathfinding.js';

export class PowerSystem {
    constructor() {
        this.totalGenerated = 0;
        this.totalConsumed = 0;
        this.powered = true;
        this.heaters = [];
        this.lamps = [];
        this.turrets = [];
        this.voidTurrets = [];
        this.aoeWards = [];
    }

    update(game) {
        this.totalGenerated = 0;
        this.totalConsumed = 0;
        this.heaters = [];
        this.lamps = [];
        this.poweredLamps = [];
        this.turrets = [];
        this.voidTurrets = [];
        this.aoeWards = [];

        const allStructures = game.mapIndex.getAllStructurePositions();
        const relays = [];
        const consumers = [];

        for (const { x, y, type } of allStructures) {
            const bDef = BUILDINGS[type];
            if (!bDef) continue;

            if (bDef.power) {
                const pwr = bDef.power;
                if (pwr.generates) {
                    let gen = pwr.generates;
                    if (type === 'mana_crystal' && game.research.isResearched('mana_reservoir')) gen += 1;
                    this.totalGenerated += gen;
                }
                if (pwr.consumes) {
                    consumers.push({ x, y, type, consumes: pwr.consumes });
                }
                if (type === 'mana_relay') relays.push({ x, y, radius: pwr.radius || 3 });

                if (pwr.warmRadius) this.heaters.push({ x, y, radius: pwr.warmRadius });
                if (pwr.damage && pwr.warmRadius) this.aoeWards.push({ x, y, radius: pwr.warmRadius, damage: pwr.damage });
                else if (pwr.damage && type === 'arcane_sentinel') this.turrets.push({ x, y });
                else if (pwr.damage && type === 'void_turret') this.voidTurrets.push({ x, y });
            }

            if (bDef.lightRadius) {
                if (bDef.power && bDef.power.consumes) {
                    this.poweredLamps.push({ x, y, radius: bDef.lightRadius });
                } else {
                    this.lamps.push({ x, y, radius: bDef.lightRadius });
                }
            }
        }

        for (const c of consumers) {
            let reduction = 0;
            for (const relay of relays) {
                if (c.type === 'mana_relay') continue;
                if (manhattanDist(c.x, c.y, relay.x, relay.y) <= relay.radius) {
                    reduction = 1;
                    break;
                }
            }
            this.totalConsumed += Math.max(1, c.consumes - reduction);
        }

        for (const { x, y, type } of allStructures) {
            if (type === 'artifact_pedestal') {
                const tile = game.map[y][x];
                if (tile.pedestalArtifact) {
                    const artDef = ARTIFACTS[tile.pedestalArtifact];
                    if (artDef?.pedestal?.manaCost) {
                        this.totalConsumed += artDef.pedestal.manaCost;
                    }
                    if (artDef?.pedestal?.lightRadius) {
                        this.poweredLamps.push({ x, y, radius: artDef.pedestal.lightRadius });
                    }
                }
            }
        }

        this.powered = this.totalGenerated >= this.totalConsumed;
        if (this.powered) {
            this.lamps.push(...this.poweredLamps);
        }
    }

    hasPower() {
        return this.powered;
    }

    getNetPower() {
        return this.totalGenerated - this.totalConsumed;
    }

    isTileWarmed(game, x, y) {
        if (!this.powered) return false;
        for (const h of this.heaters) {
            if (manhattanDist(x, y, h.x, h.y) <= h.radius) {
                return true;
            }
        }
        return false;
    }

    isTileLit(game, x, y) {
        for (const l of this.lamps) {
            if (manhattanDist(x, y, l.x, l.y) <= l.radius) {
                return true;
            }
        }
        return false;
    }

    updateTurrets(game) {
        if (!this.powered) return;

        for (const ward of this.aoeWards) {
            const wardTile = game.map[ward.y][ward.x];
            const wardCooldown = BUILDINGS[wardTile.structure]?.power?.attackCooldown || 3;
            if (game.tick - (wardTile._turretLastAttackTick || 0) < wardCooldown) continue;
            wardTile._turretLastAttackTick = game.tick;
            const enemies = [];
            for (const r of game.raiders) {
                if (r.hp > 0 && manhattanDist(ward.x, ward.y, r.x, r.y) <= ward.radius) enemies.push(r);
            }
            if (game.waves) {
                for (const e of game.waves.enemies) {
                    if (e.hp > 0 && manhattanDist(ward.x, ward.y, e.x, e.y) <= ward.radius) enemies.push(e);
                }
            }
            for (const e of enemies) {
                e.hp -= ward.damage;
                e._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            }
        }

        const allTurrets = [
            ...this.turrets.map(t => ({ ...t, type: 'arcane_sentinel' })),
            ...this.voidTurrets.map(t => ({ ...t, type: 'void_turret' })),
        ];

        for (const t of allTurrets) {
            const pwr = BUILDINGS[t.type].power;
            const cooldown = pwr.attackCooldown || 3;
            const tile = game.map[t.y][t.x];
            if (game.tick - (tile._turretLastAttackTick || 0) < cooldown) continue;
            const range = pwr.range;
            const damage = pwr.damage;

            let target = null;
            if (game.spatial) {
                target = game.spatial.hostiles.findNearest(t.x, t.y, range, null);
            } else {
                let bestDist = Infinity;
                for (const r of game.raiders) {
                    if (r.hp <= 0) continue;
                    const d = manhattanDist(t.x, t.y, r.x, r.y);
                    if (d <= range && d < bestDist) {
                        bestDist = d;
                        target = r;
                    }
                }
                if (!target && game.waves) {
                    for (const e of game.waves.enemies) {
                        if (e.hp <= 0) continue;
                        const d = manhattanDist(t.x, t.y, e.x, e.y);
                        if (d <= range && d < bestDist) {
                            bestDist = d;
                            target = e;
                        }
                    }
                }
                if (!target) {
                    for (const w of game.entities) {
                        if (w.category !== 'animal' || w.tamed || w.hp <= 0 || !w.hostile) continue;
                        const d = manhattanDist(t.x, t.y, w.x, w.y);
                        if (d <= range && d < bestDist) {
                            bestDist = d;
                            target = w;
                        }
                    }
                }
            }

            if (target && manhattanDist(t.x, t.y, target.x, target.y) <= range) {
                tile._turretLastAttackTick = game.tick;
                target.hp -= damage;
                target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
                window.soundManager?.playSFX('turret_fire');
                const color = t.type === 'void_turret' ? COMBAT_VISUALS.shotColorVoid : COMBAT_VISUALS.shotColorArcane;
                const dist = manhattanDist(t.x, t.y, target.x, target.y);
                const duration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
                game.projectiles.push({
                    fromX: t.x, fromY: t.y, toX: target.x, toY: target.y,
                    char: COMBAT_VISUALS.projectileChar, color,
                    skinKey: t.type === 'void_turret' ? 'projectile_void' : 'projectile_arcane',
                    _startTime: performance.now(), _duration: duration,
                });
            }
        }
    }
}

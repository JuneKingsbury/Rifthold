/**
 * Mana "power" grid: tallies generation vs demand from placed buildings and
 * powered pedestals, then hands out supply by priority tier (POWER_PRIORITY).
 * When supply runs short only the lowest-priority consumers that no longer fit
 * go dark, and each structure's state is queryable through isPowered(x, y).
 * PowerSystem.update runs every 10th simulation tick; updateTurrets runs every
 * tick so defenses react quickly.
 */
import { BUILDINGS, COMBAT_VISUALS, POWER_PRIORITY } from '../core/config.js';
import { manhattanDist } from '../world/pathfinding.js';
import { spawnDamageText } from '../ui/overlay-renderer.js';
import { getTilePedestalStats } from './artifacts.js';

const posKey = (x, y) => (y << 16) | x;

// Effective priority tier for a consumer: the tile override, else the building default.
export function getPowerTier(tile, type) {
    const override = tile?.powerPriority;
    if (override && POWER_PRIORITY.tiers.includes(override)) return override;
    return POWER_PRIORITY.byBuilding[type] || POWER_PRIORITY.defaultTier;
}

export class PowerSystem {
    constructor() {
        this.totalGenerated = 0;
        // Mana every consumer would draw if fully supplied (demand, not actual draw).
        this.totalConsumed = 0;
        this.totalDrawn = 0;
        // True only when every consumer is supplied; a shortfall leaves it false.
        this.powered = true;
        // False until the first update, so callers can fall back before any allocation exists.
        this.ready = false;
        this.poweredKeys = new Set();
        this.unpowered = [];
        this.heaters = [];
        this.passiveHeaters = [];
        this.lamps = [];
        this.poweredLamps = [];
        this.turrets = [];
        this.voidTurrets = [];
        this.aoeWards = [];
        this.relays = [];
        this.passiveLamps = [];
    }

    update(game) {
        this.totalGenerated = 0;
        this.totalConsumed = 0;
        this.poweredKeys = new Set();
        this.unpowered = [];
        this.heaters = [];
        this.passiveHeaters = [];
        this.lamps = [];
        this.poweredLamps = [];
        this.turrets = [];
        this.voidTurrets = [];
        this.aoeWards = [];
        this.relays = [];
        this.passiveLamps = [];

        const isWinter = game.weather.season === 'winter';
        const allStructures = game.mapIndex.getAllStructurePositions();
        const relays = [];
        const consumers = [];
        const pedestals = [];

        for (const { x, y, type } of allStructures) {
            const bDef = BUILDINGS[type];
            if (!bDef) continue;
            const tile = game.map[y][x];

            // Non-powered warmth sources (campfire etc.)
            if (bDef.warmRadius) {
                this.passiveHeaters.push({ x, y, radius: bDef.warmRadius });
            }

            if (bDef.power) {
                const pwr = bDef.power;
                if (pwr.generates) {
                    let gen = pwr.generates;
                    if (type === 'mana_crystal' && game.research.isResearched('mana_reservoir')) gen += 1;
                    this.totalGenerated += gen;
                }
                // seasonalHeat buildings (ember_heater) only draw mana and warm in winter
                if (pwr.consumes && (!pwr.seasonalHeat || isWinter)) {
                    const c = { x, y, type, base: pwr.consumes, tier: getPowerTier(tile, type) };
                    if (type === 'mana_relay') relays.push({ ...c, radius: pwr.radius || 3 });
                    else consumers.push(c);
                }
            }
            if (bDef.lightRadius && !bDef.power?.consumes) {
                this.lamps.push({ x, y, radius: bDef.lightRadius });
                this.passiveLamps.push({ x, y, radius: bDef.lightRadius });
            }

            if (type === 'artifact_pedestal' && tile.pedestalArtifact) {
                const stats = getTilePedestalStats(tile);
                const cost = stats?.manaCost || 0;
                if (cost > 0) {
                    const c = { x, y, type, base: cost, tier: getPowerTier(tile, type), pedestal: true, stats };
                    consumers.push(c);
                    pedestals.push(c);
                } else {
                    tile.pedestalInactive = false;
                    if (stats?.lightRadius) this._addLamp(x, y, stats.lightRadius);
                }
            }
        }

        let remaining = this.totalGenerated;
        const take = (c, cost) => {
            this.totalConsumed += cost;
            if (remaining >= cost) {
                remaining -= cost;
                this.poweredKeys.add(posKey(c.x, c.y));
                return true;
            }
            this.unpowered.push({ x: c.x, y: c.y, type: c.type, cost, tier: c.tier });
            return false;
        };

        // Relays are cheap and discount everything near them, so they draw first.
        const poweredRelays = [];
        for (const r of relays) {
            if (take(r, r.base)) {
                poweredRelays.push(r);
                this.relays.push({ x: r.x, y: r.y, radius: r.radius });
            }
        }

        const tierRank = (t) => POWER_PRIORITY.tiers.indexOf(t);
        // Stable sort: within a tier, structures keep map-scan order.
        consumers.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
        for (const c of consumers) {
            let cost = c.base;
            // Pedestals pay their trinket's full cost; relay discounts only cover buildings.
            if (!c.pedestal && poweredRelays.some(r => manhattanDist(c.x, c.y, r.x, r.y) <= r.radius)) {
                cost = Math.max(1, cost - 1);
            }
            const on = take(c, cost);
            if (c.pedestal) {
                game.map[c.y][c.x].pedestalInactive = !on;
                if (on && c.stats.lightRadius) this._addLamp(c.x, c.y, c.stats.lightRadius);
                continue;
            }
            if (!on) continue;
            const bDef = BUILDINGS[c.type];
            const pwr = bDef.power;
            if (pwr.warmRadius) this.heaters.push({ x: c.x, y: c.y, radius: pwr.warmRadius });
            if (pwr.damage && pwr.warmRadius) this.aoeWards.push({ x: c.x, y: c.y, radius: pwr.warmRadius, damage: pwr.damage });
            else if (pwr.damage && c.type === 'arcane_sentinel') this.turrets.push({ x: c.x, y: c.y, radius: pwr.range || 4, type: c.type });
            else if (pwr.damage && c.type === 'void_turret') this.voidTurrets.push({ x: c.x, y: c.y, radius: pwr.range || 5, type: c.type });
            if (bDef.lightRadius) this._addLamp(c.x, c.y, bDef.lightRadius);
        }

        this.totalDrawn = this.totalGenerated - remaining;
        this.powered = this.unpowered.length === 0;
        this.ready = true;
    }

    _addLamp(x, y, radius) {
        const lamp = { x, y, radius };
        this.poweredLamps.push(lamp);
        this.lamps.push(lamp);
    }

    // True when every consumer on the grid is supplied.
    hasPower() {
        return this.powered;
    }

    // Whether the mana consumer at (x, y) is supplied this cycle.
    isPowered(x, y) {
        return this.poweredKeys.has(posKey(x, y));
    }

    // Number of supplied structures of a given building type.
    countPowered(game, type) {
        let n = 0;
        for (const k of game.mapIndex.getStructurePositions(type)) {
            if (this.poweredKeys.has(k)) n++;
        }
        return n;
    }

    // Generation minus full demand; negative means some consumers are dark.
    getNetPower() {
        return this.totalGenerated - this.totalConsumed;
    }

    isTileWarmed(game, x, y) {
        for (const h of this.passiveHeaters) {
            if (manhattanDist(x, y, h.x, h.y) <= h.radius) return true;
        }
        // heaters holds only supplied heaters.
        for (const h of this.heaters) {
            if (manhattanDist(x, y, h.x, h.y) <= h.radius) return true;
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

    // Only supplied defenses are listed in aoeWards/turrets/voidTurrets, so a
    // shortfall silences just the ones that lost power.
    updateTurrets(game) {
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
                spawnDamageText(game, e.x, e.y, ward.damage);
                e._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            }
        }

        // Runs every tick: iterate both lists in place rather than building a
        // merged copy. Entries carry their structure type from update().
        for (const turretList of [this.turrets, this.voidTurrets]) for (const t of turretList) {
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
                spawnDamageText(game, target.x, target.y, damage);
                target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
                window.soundManager?.playSFXAt('turret_fire', t.x, t.y);
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

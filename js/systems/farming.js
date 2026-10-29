/**
 * Crop farming: designating farm zones (research-gated per crop) and advancing
 * crop growth/blight. updateFarming is called from simulationTick every 5th
 * tick; ready crops become harvest tasks for colonists.
 */
import { CONFIG, CROPS, TERRAIN, FARMABLE_TERRAIN, WORK_CONFIG, BLIGHT_CONFIG, PLANT_STRUCTURES } from '../core/config.js';
import { getFoodProductionMult } from './complexBuildings.js';

// Derived from the 'research' field on each crop entry
export const CROP_RESEARCH_REQS = Object.fromEntries(
    Object.entries(CROPS).filter(([, c]) => c.research).map(([k, c]) => [k, c.research])
);

export function designateFarmZone(game, x1, y1, x2, y2, cropType) {
    const crop = CROPS[cropType];
    if (!crop) return false;

    const req = CROP_RESEARCH_REQS[cropType];
    if (req && !game.research.isResearched(req)) return false;

    // Clamp to map bounds: getMouseTile only clamps the lower bound and screenToWorld adds the
    // camera offset with no upper clamp, so a drag released past the right/bottom edge yields
    // coords >= MAP_WIDTH/HEIGHT and game.map[y][x] would throw (as buildArea already guards).
    const minX = Math.max(0, Math.min(x1, x2)), maxX = Math.min(CONFIG.MAP_WIDTH - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2)), maxY = Math.min(CONFIG.MAP_HEIGHT - 1, Math.max(y1, y2));

    let count = 0;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const tile = game.map[y][x];
            if (!FARMABLE_TERRAIN.has(tile.terrain)) continue;
            // Decorative plants are cleared to make room; any other structure blocks.
            const isPlant = PLANT_STRUCTURES.has(tile.structure);
            if (tile.sealed || (tile.structure && !isPlant) || tile.resource || tile.zone) continue;
            if (isPlant) {
                if (tile.designation) continue;
                if (game.mapIndex) game.mapIndex.removeStructure(x, y, tile.structure);
                tile.structure = null;
            }

            tile.zone = {
                type: 'growing',
                crop: cropType,
                state: 'empty',
                growth: 0,
                harvestYield: crop.harvestYield,
            };
            if (game.mapIndex) game.mapIndex.addZone(x, y);
            count++;
        }
    }
    return count > 0;
}

export function removeFarmZone(game, x, y) {
    const tile = game.map[y][x];
    if (!tile.zone) return;
    tile.zone = null;
    if (game.mapIndex) game.mapIndex.removeZone(x, y);
    if (game.renderer) game.renderer.markTerrainDirty();
    for (const task of game.taskQueue.getAllByPosition(x, y)) {
        if (task.type === 'plant' || task.type === 'harvest' || task.type === 'cleanse_blight') {
            game.taskQueue.remove(task.id);
        }
    }
}

export function updateFarming(game) {
    const season = game.weather.season;
    const growthMult = game.weather.getGrowthMultiplier();

    const zonePositions = game.mapIndex ? game.mapIndex.getZonePositions() : null;

    if (zonePositions) {
        for (const { x, y } of zonePositions) {
            updateFarmTile(game, x, y, season, growthMult);
        }
    } else {
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                if (!game.map[y][x].zone) continue;
                updateFarmTile(game, x, y, season, growthMult);
            }
        }
    }
}

function updateFarmTile(game, x, y, season, growthMult) {
    const tile = game.map[y][x];
    if (!tile.zone) return;
    if (tile.structure) return;

    const crop = CROPS[tile.zone.crop];
    if (!crop) return;

    if (tile.zone.state === 'empty') {
        // Only plant what can actually grow now. Winter growth is zero unless
        // irrigation is researched, and even then only for winter crops (the
        // growth step below applies the same rule).
        const canGrow = crop.seasons.includes(season) &&
            (season !== 'winter' || game.research.isResearched('irrigation'));
        if (!canGrow) return;
        if (!game.taskQueue.hasTaskTypeAt(x, y, 'plant')) {
            game.taskQueue.add({
                type: 'plant',
                skillRequired: 'farming',
                x, y,
                workAmount: WORK_CONFIG.plantWork,
            });
        }
    } else if (tile.zone.state === 'growing') {
        if (tile.zone.blighted) {
            tile.zone.growth -= BLIGHT_CONFIG.decayPerTick;
            if (tile.zone.growth <= 0) {
                tile.zone.state = 'empty';
                tile.zone.growth = 0;
                tile.zone.blighted = false;
                delete tile.zone.blightSpreadCount;
                const task = game.taskQueue.getAllByPosition(x, y).find(t => t.type === 'cleanse_blight');
                if (task) game.taskQueue.remove(task.id);
            } else {
                spreadBlight(game, x, y, tile);
            }
            return;
        }

        let effectiveGrowthMult = growthMult;
        if (effectiveGrowthMult === 0 && game.research.isResearched('irrigation') && crop.seasons.includes(game.weather.season)) {
            effectiveGrowthMult = 0.5;
        }
        if (effectiveGrowthMult > 0) {
            let effectiveMult = effectiveGrowthMult;
            if (tile.zone._growthBoost && game.tick < tile.zone._growthBoost.expiresAt) {
                effectiveMult *= tile.zone._growthBoost.mult;
            }
            if (game.research.isResearched('irrigation') && isAdjacentToWater(game, x, y)) {
                effectiveMult *= 1.2;
            }
            if (tile.zone.crop === 'moonbloom' && game.research.isResearched('verdant_growth')) {
                effectiveMult *= 1.3;
            }
            tile.zone.growth += effectiveMult;
            if (tile.zone.growth >= crop.growthTicks) {
                tile.zone.state = 'ready';
                if (!game.taskQueue.hasTaskTypeAt(x, y, 'harvest')) {
                    game.taskQueue.add({
                        type: 'harvest',
                        skillRequired: 'farming',
                        x, y,
                        workAmount: WORK_CONFIG.harvestWork,
                    });
                }
            }
        }
    } else if (tile.zone.state === 'ready') {
        if (!game.taskQueue.hasTaskTypeAt(x, y, 'harvest')) {
            game.taskQueue.add({
                type: 'harvest',
                skillRequired: 'farming',
                x, y,
                workAmount: WORK_CONFIG.harvestWork,
            });
        }
    }
}

function isAdjacentToWater(game, x, y) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (ny >= 0 && ny < game.map.length && nx >= 0 && nx < game.map[0].length) {
            if (game.map[ny][nx].terrain === 'water' || game.map[ny][nx].terrain === 'shallow_water') return true;
        }
    }
    return false;
}

function spreadBlight(game, x, y, tile) {
    if ((tile.zone.blightSpreadCount || 0) >= BLIGHT_CONFIG.maxSpreads) return;
    const mods = game.divinationModifiers || [];
    if (mods.some(m => m.blightSpreadSuppressed)) return;
    if (Math.random() >= BLIGHT_CONFIG.spreadChance) return;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const nx = x + dir[0], ny = y + dir[1];
    if (ny < 0 || ny >= game.map.length || nx < 0 || nx >= game.map[0].length) return;

    const neighbor = game.map[ny][nx];
    if (!neighbor.zone || neighbor.zone.state !== 'growing' || neighbor.zone.blighted) return;
    if (neighbor.blightImmune) return;

    neighbor.zone.blighted = true;
    neighbor.zone.blightSpreadCount = 0;
    tile.zone.blightSpreadCount = (tile.zone.blightSpreadCount || 0) + 1;

    if (!game.taskQueue.hasTaskTypeAt(nx, ny, 'cleanse_blight')) {
        game.taskQueue.add({
            type: 'cleanse_blight',
            skillRequired: 'farming',
            x: nx, y: ny,
            workAmount: BLIGHT_CONFIG.cleanseWork,
        });
    }

    game.combatEffects.push({ x: nx, y: ny, char: '*', color: '#88aa44', ttl: 3 });
}

export function getHarvestYield(game, cropType) {
    const crop = CROPS[cropType];
    if (!crop) return 0;
    let yield_ = crop.harvestYield;
    if (game.research.isResearched('verdant_growth')) yield_ += 1;
    yield_ = Math.round(yield_ * getFoodProductionMult(game));
    return yield_;
}

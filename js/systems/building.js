/**
 * Placement and gathering designations: validates where a structure/floor can
 * be built (terrain, collision, research, per-type maxCount, resource cost) and
 * queues the resulting build/gather tasks. Driven by player input, not the tick
 * loop. Colonists later execute the queued tasks.
 */
import { BUILDINGS, RESOURCES, UNBUILDABLE_TERRAIN, WORK_CONFIG, INDESTRUCTIBLE_STRUCTURES } from '../core/config.js';

// Extra maxCount slots a building gets beyond its base def.maxCount: a
// research-driven bonus stored on game[maxCountBonusKey], plus a special-case
// +3 for mana crystals once mana_reservoir is researched. Kept in one place so
// the placement gate and every UI limit/at-max display agree.
export function getMaxCountBonus(def, buildType, game) {
    let bonus = def.maxCountBonusKey ? (game[def.maxCountBonusKey] || 0) : 0;
    if (buildType === 'mana_crystal' && game.research.isResearched('mana_reservoir')) bonus += 3;
    return bonus;
}

export function designateBuild(game, x, y, buildType) {
    const tile = game.map[y][x];
    if (tile.sealed) return false;
    if (tile.resource) return false;
    if (UNBUILDABLE_TERRAIN.has(tile.terrain)) return false;

    const def = BUILDINGS[buildType];
    if (!def || def.noBuild) return false;
    // The Rift Gate is legacy: maps where every chain has a rift anchor launch from those instead.
    if (def.legacy && !game.ruins.needsLegacyGate()) return false;

    // Building over an existing tile replaces its structure, so protected
    // structures (the Arcane Core) must be refused here rather than overwritten.
    if (INDESTRUCTIBLE_STRUCTURES.has(tile.structure)) return false;

    if (!game.resources.has(def.cost)) return false;

    if (def.research && !game.research.isResearched(def.research)) return false;

    if (def.maxCount !== undefined) {
        let count = 0;
        for (const row of game.map) {
            for (const t of row) {
                if (t.structure === buildType) count++;
                if (t.designation && t.designation.type === 'build' && t.designation.buildType === buildType) count++;
            }
        }
        const bonus = getMaxCountBonus(def, buildType, game);
        if (count >= def.maxCount + bonus) return false;
    }

    if (def.structureType === 'floor') {
        if (tile.floor) {
            if (!(tile && (tile.type === 'deconstruct' || tile.type === 'deconstruct_floor'))) {
                if (game.mapIndex) game.mapIndex.removeStructure(x, y, tile.floor);
                tile.floor = null;
            }
        }
    } else {
        if (tile.structure) {
            if (!(tile && tile.type === 'deconstruct')) {
                if (game.mapIndex) game.mapIndex.removeStructure(x, y, tile.structure);
                tile.structure = null;
                tile.passable = true;
            }
        }
    }
    if (!tile.passable) return false;

    game.resources.deduct(def.cost);
    tile.designation = { type: 'build', buildType };

    game.taskQueue.add({
        type: 'build',
        skillRequired: 'building',
        x, y,
        workAmount: def.work,
        buildType,
    });

    return true;
}

export function designateGather(game, x, y) {
    const tile = game.map[y][x];
    if (tile.sealed || !tile.resource || tile.designation) return false;

    const rDef = RESOURCES[tile.resource.type];
    if (!rDef) return false;

    tile.designation = { type: rDef.designation };
    game.taskQueue.add({
        type: rDef.designation,
        skillRequired: 'building',
        x, y,
        workAmount: rDef.work,
    });
    return true;
}

export function designateChop(game, x, y) {
    const tile = game.map[y][x];
    if (!tile.resource) return false;
    const rDef = RESOURCES[tile.resource.type];
    if (!rDef || rDef.designation !== 'chop') return false;
    return designateGather(game, x, y);
}

export function designateMine(game, x, y) {
    const tile = game.map[y][x];
    if (!tile.resource) return false;
    const rDef = RESOURCES[tile.resource.type];
    if (!rDef || rDef.designation !== 'mine') return false;
    return designateGather(game, x, y);
}

export function cancelDesignation(game, x, y) {
    const tile = game.map[y][x];
    if (tile.sealed) return;

    if (tile.designation) {
        if (tile.designation.type === 'build') {
            const def = BUILDINGS[tile.designation.buildType];
            if (def) game.resources.add(def.cost);
        }
        const task = game.taskQueue.getByPosition(x, y);
        if (task) game.taskQueue.remove(task.id);
        tile.designation = null;
        return;
    }

    // Right-click on a dormant rift anchor marks it for attuning (it can't be deconstructed).
    if (tile.structure === 'rift_anchor' && !tile.designation) {
        tile.designation = { type: 'attune_anchor' };
        game.taskQueue.add({
            type: 'attune_anchor',
            skillRequired: 'building',
            x, y,
            workAmount: WORK_CONFIG.attuneAnchorWork,
        });
        return;
    }

    // Right-click on an unlooted crypt chest marks it for looting (it can't be deconstructed).
    if (tile.structure === 'ancient_chest' && !tile.designation) {
        tile.designation = { type: 'loot_chest' };
        game.taskQueue.add({
            type: 'loot_chest',
            skillRequired: 'building',
            x, y,
            workAmount: WORK_CONFIG.lootChestWork,
        });
        return;
    }

    if ((tile.structure || tile.floor) && !tile.designation) {
        if (INDESTRUCTIBLE_STRUCTURES.has(tile.structure)) return;
        const existing = game.taskQueue.getByPosition(x, y);
        if (existing && existing.type === 'deconstruct') return;

        tile.designation = { type: 'deconstruct' };
        game.taskQueue.add({
            type: 'deconstruct',
            skillRequired: 'building',
            x, y,
            workAmount: WORK_CONFIG.deconstructWork,
        });
    }
}

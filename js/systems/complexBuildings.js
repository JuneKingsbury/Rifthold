import { COMPLEX_STRUCTURES, WALL_STRUCTURES, DOOR_STRUCTURES } from '../core/config.js';

export function checkComplexStructures(game) {
    const active = [];
    const activatedKeys = new Set();

    for (let y = 0; y < game.map.length; y++) {
        for (let x = 0; x < game.map[y].length; x++) {
            const tile = game.map[y][x];
            if (!tile.structure) continue;

            for (const [key, def] of Object.entries(COMPLEX_STRUCTURES)) {
                if (activatedKeys.has(key)) continue;
                if (tile.structure !== def.coreBuild) continue;
                if (def.research && !game.research.isResearched(def.research)) continue;

                if (patternMatches(game.map, x, y, def.layout)) {
                    active.push({ key, x, y, effect: def.effect });
                    activatedKeys.add(key);
                }
            }
        }
    }

    game.activeComplexStructures = active;
}

function patternMatches(map, cx, cy, layout) {
    // Check all required positions exist
    const requiredChalk = new Set();
    for (const cell of layout) {
        const tx = cx + cell.dx;
        const ty = cy + cell.dy;
        if (tx < 0 || ty < 0 || ty >= map.length || tx >= map[0].length) return false;
        const tile = map[ty][tx];
        if (cell.req === 'wall' && !WALL_STRUCTURES.has(tile.structure)) return false;
        if (cell.req === 'door' && !DOOR_STRUCTURES.has(tile.structure)) return false;
        if (cell.req && cell.req !== 'wall' && cell.req !== 'door' && tile.structure !== cell.req) return false;
        if (cell.req === 'ritual_chalk') requiredChalk.add(`${cell.dx},${cell.dy}`);
    }

    // Reject if any ritual_chalk exists in the bounding box that isn't required.
    // Bounding box is at least the 3x3 around the core so nearby extra chalk always
    // disqualifies a pattern, preventing smaller patterns from activating inside larger ones.
    const chalkCells = layout.filter(c => c.req === 'ritual_chalk');
    if (chalkCells.length > 0) {
        const minDx = Math.min(-1, ...chalkCells.map(c => c.dx));
        const maxDx = Math.max( 1, ...chalkCells.map(c => c.dx));
        const minDy = Math.min(-1, ...chalkCells.map(c => c.dy));
        const maxDy = Math.max( 1, ...chalkCells.map(c => c.dy));
        for (let dy = minDy; dy <= maxDy; dy++) {
            for (let dx = minDx; dx <= maxDx; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (requiredChalk.has(`${dx},${dy}`)) continue;
                const tx = cx + dx;
                const ty = cy + dy;
                if (tx < 0 || ty < 0 || ty >= map.length || tx >= map[0].length) continue;
                if (map[ty][tx].structure === 'ritual_chalk') return false;
            }
        }
    }

    return true;
}

export function getComplexStructureAt(game, x, y) {
    if (!game.activeComplexStructures) return null;
    return game.activeComplexStructures.find(s => s.x === x && s.y === y) || null;
}

export function getCraftSpeedBonus(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.craftSpeedMult) return s.effect.craftSpeedMult;
    }
    return 1;
}

export function getCraftQualityBonus(game) {
    if (!game.activeComplexStructures) return 0;
    for (const s of game.activeComplexStructures) {
        if (s.effect.qualityBonus) return s.effect.qualityBonus;
    }
    return 0;
}

export function getSpellCooldownMult(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.spellCooldownMult) return s.effect.spellCooldownMult;
    }
    return 1;
}

export function getGatherSpeedBonus(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.gatherSpeedMult) return s.effect.gatherSpeedMult;
    }
    return 1;
}

export function getDefenseBonusMult(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.defenseBonusMult) return s.effect.defenseBonusMult;
    }
    return 1;
}

export function getFoodProductionMult(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.foodProductionMult) return s.effect.foodProductionMult;
    }
    return 1;
}

export function getExpeditionLuckBonus(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.expeditionLuckMult) return s.effect.expeditionLuckMult;
    }
    return 1;
}

export function getResearchSpeedMult(game) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.researchSpeedMult) return s.effect.researchSpeedMult;
    }
    return 1;
}

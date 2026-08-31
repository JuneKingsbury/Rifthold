import { COMPLEX_STRUCTURES, WALL_STRUCTURES, DOOR_STRUCTURES } from '../core/config.js';

export function checkComplexStructures(game) {
    const active = [];

    for (let y = 0; y < game.map.length; y++) {
        for (let x = 0; x < game.map[y].length; x++) {
            const tile = game.map[y][x];
            if (!tile.structure) continue;

            for (const [key, def] of Object.entries(COMPLEX_STRUCTURES)) {
                if (tile.structure !== def.coreBuild) continue;
                if (def.research && !game.research.isResearched(def.research)) continue;

                if (patternMatches(game.map, x, y, def.layout)) {
                    active.push({ key, x, y, effect: def.effect });
                }
            }
        }
    }

    game.activeComplexStructures = active;
}

function patternMatches(map, cx, cy, layout) {
    for (const cell of layout) {
        const tx = cx + cell.dx;
        const ty = cy + cell.dy;
        if (tx < 0 || ty < 0 || ty >= map.length || tx >= map[0].length) return false;
        const tile = map[ty][tx];
        if (cell.req === 'wall' && !WALL_STRUCTURES.has(tile.structure)) return false;
        if (cell.req === 'door' && !DOOR_STRUCTURES.has(tile.structure)) return false;
        if (cell.req && cell.req !== 'wall' && cell.req !== 'door' && tile.structure !== cell.req) return false;
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

import { COMPLEX_STRUCTURES } from '../core/config.js';
import { manhattanDist } from '../world/pathfinding.js';

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
        if (cell.req === 'wall' && tile.structure !== 'wall' && tile.structure !== 'stone_wall') return false;
        if (cell.req === 'door' && tile.structure !== 'door' && tile.structure !== 'void_door') return false;
        if (cell.req && cell.req !== 'wall' && cell.req !== 'door' && tile.structure !== cell.req) return false;
    }
    return true;
}

export function getComplexStructureAt(game, x, y) {
    if (!game.activeComplexStructures) return null;
    return game.activeComplexStructures.find(s => s.x === x && s.y === y) || null;
}

export function getCraftSpeedBonus(game, colonist) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.craftSpeedMult && (s.effect.craftCategory || s.effect.craftCategories)) {
            const dist = manhattanDist(colonist.x, colonist.y, s.x, s.y);
            if (dist <= 3) return s.effect.craftSpeedMult;
        }
    }
    return 1;
}

export function getSpellCooldownMult(game, colonist) {
    if (!game.activeComplexStructures) return 1;
    for (const s of game.activeComplexStructures) {
        if (s.effect.spellCooldownMult) {
            const radius = s.effect.radius || 6;
            const dist = manhattanDist(colonist.x, colonist.y, s.x, s.y);
            if (dist <= radius) return s.effect.spellCooldownMult;
        }
    }
    return 1;
}

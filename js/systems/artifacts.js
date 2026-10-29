/**
 * Artifact pedestal effect queries. getPedestalEffect sums a given global-radius
 * pedestal effect (additive, or multiplicative for *Mult keys) across all active
 * pedestals, for systems that need the colony-wide modifier on demand. The
 * radius-based aura application to colonists lives in main.js (updatePedestals).
 */
import { ALL_ITEMS } from '../core/config.js';

export function getPedestalEffect(game, effectKey) {
    let value = effectKey.includes('Mult') ? 1.0 : 0;
    // Pedestal-only lookup: this runs per tick from the event roll, so avoid
    // materializing every structure position on the map.
    for (const k of game.mapIndex.getStructurePositions('artifact_pedestal')) {
        const tile = game.map[k >> 16][k & 0xFFFF];
        if (!tile.pedestalArtifact || tile.pedestalInactive) continue;
        const def = ALL_ITEMS[tile.pedestalArtifact];
        if (!def?.pedestal) continue;
        if (def.pedestal.radius !== 'global') continue;
        if (def.pedestal[effectKey] !== undefined) {
            if (effectKey.includes('Mult')) value *= def.pedestal[effectKey];
            else value += def.pedestal[effectKey];
        }
    }
    return value;
}

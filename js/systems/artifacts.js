/**
 * Artifact pedestal effect queries. getPedestalEffect sums a given global-radius
 * pedestal effect (additive, or multiplicative for *Mult keys) across all active
 * pedestals, for systems that need the colony-wide modifier on demand. The
 * radius-based aura application to colonists lives in main.js (updatePedestals).
 * Overcharge scaling (PEDESTAL_CHARGE) is applied here so every reader sees the
 * same charged numbers.
 */
import { ALL_ITEMS, PEDESTAL_CHARGE } from '../core/config.js';

// Trims float noise (0.06 * 1.5) so tooltips read cleanly.
const round3 = (v) => Math.round(v * 1000) / 1000;

// Highest charge level a trinket may run at: colony-wide trinkets are capped.
export function getMaxPedestalCharge(pedestal) {
    const top = PEDESTAL_CHARGE.levels.length - 1;
    return pedestal?.radius === 'global' ? Math.min(top, PEDESTAL_CHARGE.maxGlobalLevel) : top;
}

// The tile's charge level, clamped to what its current trinket allows.
export function getPedestalCharge(tile) {
    const pedestal = ALL_ITEMS[tile.pedestalArtifact]?.pedestal;
    if (!pedestal) return 0;
    return Math.max(0, Math.min(tile.pedestalCharge || 0, getMaxPedestalCharge(pedestal)));
}

// Returns the pedestal stats scaled to a charge level. Level 0 returns the
// original object, so uncharged pedestals cost nothing extra to read.
export function chargePedestalStats(pedestal, level) {
    if (!pedestal || !level) return pedestal;
    const lv = PEDESTAL_CHARGE.levels[level];
    if (!lv) return pedestal;
    const out = {};
    for (const [key, v] of Object.entries(pedestal)) {
        if (typeof v !== 'number') { out[key] = v; continue; }
        if (key === 'manaCost') out[key] = v * lv.costMult;
        else if (key === 'radius' || PEDESTAL_CHARGE.radiusKeys.includes(key)) out[key] = v + lv.radiusBonus;
        else if (PEDESTAL_CHARGE.flatKeys.includes(key)) out[key] = v + lv.flatBonus;
        // *Mult keys scale their distance from 1 so a 0.85 discount deepens and a 1.15 boost grows.
        else if (key.endsWith('Mult')) out[key] = round3(1 + (v - 1) * lv.strength);
        else if (Number.isInteger(v)) out[key] = Math.round(v * lv.strength);
        else out[key] = round3(v * lv.strength);
        if (PEDESTAL_CHARGE.caps[key] !== undefined) out[key] = Math.min(out[key], PEDESTAL_CHARGE.caps[key]);
    }
    return out;
}

// Charged stats for the trinket on a pedestal tile, or null if it holds none.
export function getTilePedestalStats(tile) {
    const pedestal = ALL_ITEMS[tile.pedestalArtifact]?.pedestal;
    if (!pedestal) return null;
    return chargePedestalStats(pedestal, getPedestalCharge(tile));
}

export function getPedestalEffect(game, effectKey) {
    let value = effectKey.includes('Mult') ? 1.0 : 0;
    // Pedestal-only lookup: this runs per tick from the event roll, so avoid
    // materializing every structure position on the map.
    for (const k of game.mapIndex.getStructurePositions('artifact_pedestal')) {
        const tile = game.map[k >> 16][k & 0xFFFF];
        if (!tile.pedestalArtifact || tile.pedestalInactive) continue;
        const stats = getTilePedestalStats(tile);
        if (!stats) continue;
        if (stats.radius !== 'global') continue;
        if (stats[effectKey] !== undefined) {
            if (effectKey.includes('Mult')) value *= stats[effectKey];
            else value += stats[effectKey];
        }
    }
    return value;
}

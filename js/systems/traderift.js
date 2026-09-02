/**
 * Trade Rift request board. A single game-level board (the Trade Rift building is
 * capped at one) holding barter requests from far-off traders. Each request wants
 * a quantity of surplus materials in exchange for a hidden reward, described only
 * vaguely. The concrete item is rolled at fulfillment time (see main.js).
 *
 * Requests come in two cadences that refresh independently:
 *   - 'season' requests regenerate on every season change (easier / cheaper).
 *   - 'year' requests regenerate at year rollover (harder / better rewards).
 * Fulfilled requests stay in place (greyed) until their cadence next refreshes.
 *
 * Reward KINDS (rolled per request from the cadence's kindWeights):
 *   - 'equipment' — {type, tier, quality, enchant}; quality is a FLOOR at fulfill.
 *   - 'tome'      — a random spell tome.
 *   - 'artifact'  — a random pedestal relic (yearly-only via kindWeights).
 */
import { ALL_ITEMS, QUALITY_TIERS, TRADE_VALUES, TRADE_RIFT_CONFIG } from '../core/config.js';

// Weighted pick from a {value: weight} map. Keys are returned as-is (strings);
// numeric keys (tiers) are coerced by the caller.
function weightedPick(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = Math.random() * total;
    for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1]?.[0];
}

function randInRange([min, max]) {
    return min + Math.random() * (max - min);
}

export class TradeRiftSystem {
    constructor() {
        this.requests = [];       // active requests (both cadences) in one array
        this.lastRefreshYear = 0; // year of last yearly refresh
        this.seeded = false;      // populated at least once (drives build-time seeding)
        this.nextId = 1;          // monotonic id — no leading underscore (save.js strips those)
    }

    /**
     * Rebuild only the slots of the given cadence ('season' | 'year'), leaving the
     * other cadence's requests (fulfilled or not) untouched.
     */
    regenerate(game, cadence) {
        const cfg = TRADE_RIFT_CONFIG[cadence];
        if (!cfg) return;
        this.requests = this.requests.filter(r => r.cadence !== cadence);
        for (let i = 0; i < cfg.count; i++) {
            const req = this._rollRequest(cadence, cfg);
            if (req) this.requests.push(req);
        }
        if (cadence === 'year') this.lastRefreshYear = game.weather.year;
        this.seeded = true;
    }

    _rollRequest(cadence, cfg) {
        const kind = weightedPick(cfg.kindWeights);
        if (kind === 'tome')     return this._rollTomeRequest(cadence, cfg);
        if (kind === 'artifact') return this._rollArtifactRequest(cadence, cfg);
        return this._rollEquipmentRequest(cadence, cfg);
    }

    _rollEquipmentRequest(cadence, cfg) {
        // Roll a reward spec, retrying the type/tier pair until it has candidates.
        let type, tier, candidates;
        for (let attempt = 0; attempt < 12; attempt++) {
            tier = parseInt(weightedPick(cfg.tierWeights), 10);
            type = TRADE_RIFT_CONFIG.rewardTypes[Math.floor(Math.random() * TRADE_RIFT_CONFIG.rewardTypes.length)];
            candidates = this._candidates(type, tier);
            if (candidates.length) break;
            candidates = null;
        }
        if (!candidates || !candidates.length) return null;

        // Trinkets have no quality-scaled stats and no enchant table, so they never
        // carry quality or enchantment — the mods would be name-only, misleading the
        // player and inflating the cost for a benefit that doesn't exist.
        const isTrinket = type === 'trinket';
        const quality = isTrinket ? 'normal' : weightedPick(cfg.qualityWeights);
        // Pre-enchant roll: some equipment rewards arrive enchanted (the key hook).
        let enchant = null;
        if (!isTrinket && Math.random() < cfg.enchantChance) {
            enchant = { tier: parseInt(weightedPick(cfg.enchantTierWeights), 10) };
        }

        // Estimate reward gold value and derive a material cost from it. An enchant
        // roughly adds its tier's worth of value on top of the base item.
        const qMult = QUALITY_TIERS.find(t => t.key === quality)?.multiplier || 1;
        let baseValue = (TRADE_RIFT_CONFIG.rewardTierValue[tier] || 20) * qMult;
        if (enchant) baseValue *= 1 + 0.25 * enchant.tier;
        const targetGold = baseValue * randInRange(cfg.costMargin);

        return {
            id: this.nextId++,
            cadence,
            cost: this._rollCost(targetGold, cfg),
            reward: { kind: 'equipment', type, tier, quality, enchant },
            vagueText: this._equipmentText(type, tier, quality, enchant),
            fulfilled: false,
        };
    }

    _rollTomeRequest(cadence, cfg) {
        const targetGold = TRADE_RIFT_CONFIG.tomeValue * randInRange(cfg.costMargin);
        return {
            id: this.nextId++,
            cadence,
            cost: this._rollCost(targetGold, cfg),
            reward: { kind: 'tome' },
            vagueText: 'an unknown spell tome',
            fulfilled: false,
        };
    }

    _rollArtifactRequest(cadence, cfg) {
        const targetGold = TRADE_RIFT_CONFIG.artifactValue * randInRange(cfg.costMargin);
        return {
            id: this.nextId++,
            cadence,
            cost: this._rollCost(targetGold, cfg),
            reward: { kind: 'artifact' },
            vagueText: 'a far-off relic of great power',
            fulfilled: false,
        };
    }

    // All items of the given type and tier. Must stay in sync with the
    // fulfillment candidate filter in main.js so every promise can be delivered.
    _candidates(type, tier) {
        return Object.entries(ALL_ITEMS).filter(([, d]) => d.type === type && d.tier === tier);
    }

    // Convert a target gold value into 1-2 material quantities from the cadence pool.
    _rollCost(targetGold, cfg) {
        const pool = cfg.costMaterials.filter(m => TRADE_VALUES[m]);
        const cost = {};
        const useTwo = pool.length > 1 && Math.random() < 0.4;
        const picks = [];
        const pick1 = pool[Math.floor(Math.random() * pool.length)];
        picks.push(pick1);
        if (useTwo) {
            const rest = pool.filter(m => m !== pick1);
            picks.push(rest[Math.floor(Math.random() * rest.length)]);
        }
        const share = targetGold / picks.length;
        for (const mat of picks) {
            const qty = Math.max(1, Math.round(share / TRADE_VALUES[mat]));
            cost[mat] = (cost[mat] || 0) + qty;
        }
        return cost;
    }

    _equipmentText(type, tier, quality, enchant) {
        const label = TRADE_RIFT_CONFIG.typeLabels[type] || type;
        const adj = TRADE_RIFT_CONFIG.qualityAdjective[quality];
        // Enchanted rewards read as "rune-touched" — the flavor that signals the perk.
        const enchantWord = enchant ? 'rune-touched ' : '';
        // 'standard' (normal) quality reads better without the trailing clause.
        if (quality === 'normal') return `an unknown ${enchantWord}Tier ${tier} ${label}`;
        return `an unknown ${enchantWord}Tier ${tier} ${label} of ${adj} quality`;
    }
}

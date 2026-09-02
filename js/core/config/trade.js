/**
 * Trade and commerce data: the caravan barter table, named merchant definitions
 * for the caravan event, per-unit base trade values, and the trader markup /
 * discount multipliers. Consumed by trading, merchant, and caravan code.
 * Re-exported through the config hub (index.js) so consumers import from
 * '../core/config.js'.
 */

export const CARAVAN_TRADES = [
    { give: { wood: 5 }, receive: { food: 4 } },
    { give: { stone: 3 }, receive: { wood: 4 } },
    { give: { food: 4 }, receive: { planks: 3 } },
    { give: { food: 6 }, receive: { stone: 5 } },
    { give: { stone: 8 }, receive: { runite: 2 } },
    { give: { runite: 3, food: 5 }, receive: { tome_of_magic_missile: 1 } },
    { give: { runite: 3, food: 6 }, receive: { tome_of_heal: 1 } },
    { give: { runite: 4, food: 8 }, receive: { tome_of_haste: 1 } },
    { give: { void_essence: 2, runite: 3 }, receive: { tome_of_shield: 1 } },
    { give: { void_essence: 3, runite: 4 }, receive: { tome_of_warp: 1 } },
];

// Named merchants for the caravan event. Each has its own resource pool and exclusive item list.
// exclusiveItems: pool to draw from. First item is always guaranteed; extraItemChances lists the
// probability of each additional slot (drawn without replacement from remaining pool items).
// buyCategories: item types this merchant will purchase from the player (null = anything).
// The merchant will NOT buy items of the same category they sell as exclusives.
export const MERCHANTS = [
    {
        name: 'Traveling Merchant',
        resourcePool: null,
        exclusiveItems: ['amulet_of_fortune', 'merchants_ring', 'hagglers_coin', 'seedkeepers_locket'],
        extraItemChances: [0.3],        // 1 guaranteed + up to 1 extra (30%)
        goldRange: [20, 49],
        buyCategories: ['weapon', 'armor', 'helmet', 'tool', 'tome', 'consumable'],
    },
    {
        name: 'Arms Dealer',
        resourcePool: ['iron', 'planks', 'leather', 'iron_ore', 'runite'],
        exclusiveItems: ['aegis_of_the_vanguard', 'iron_sword', 'runic_blade', 'iron_crossbow', 'runic_plate', 'runic_helm'],
        extraItemChances: [0.6, 0.3],   // 1 guaranteed + up to 2 extras (60%, then 30%)
        goldRange: [30, 60],
        buyCategories: ['trinket', 'tome', 'consumable'],
    },
    {
        name: 'Tome Peddler',
        resourcePool: ['planks', 'runite', 'wood'],
        exclusiveItems: ['tome_of_spark', 'tome_of_mend', 'tome_of_smite', 'tome_of_magic_missile', 'tome_of_heal'],
        extraItemChances: [0.6, 0.3],   // 1 guaranteed + up to 2 extras (60%, then 30%)
        goldRange: [15, 35],
        buyCategories: ['weapon', 'armor', 'helmet', 'trinket', 'consumable'],
    },
    {
        name: 'Wandering Alchemist',
        resourcePool: ['berries', 'wheat', 'moonbloom', 'corn', 'potatoes', 'food'],
        exclusiveItems: ['hourglass_of_diligence', 'lodestone_of_prosperity', 'crystal_capacitor'],
        extraItemChances: [0.3],        // 1 guaranteed + up to 1 extra (30%)
        goldRange: [20, 45],
        buyCategories: ['weapon', 'armor', 'helmet', 'tool', 'tome'],
    },
];

// Base gold value per unit. Used by both buy and sell calculations.
// Effective buy price = value × TRADER_MARKUP, effective sell price = value × TRADER_DISCOUNT.
// Gold itself is always 1:1 (not subject to markup/discount).
export const TRADE_VALUES = {
    wood: 1, stone: 1.5, planks: 2, food: 1.5, bricks: 3,
    hides: 1.5, leather: 3, iron_ore: 2, iron: 4,
    runite: 6, void_essence: 10, meat: 1, wheat: 0.7, berries: 0.6,
    corn: 0.8, potatoes: 0.7, moonbloom: 3, eggs: 1.5, milk: 2, wool: 2.5,
    cotton: 1, cloth: 2.5,
};

// TRADER_MARKUP: multiplier on base value when buying FROM the trader (higher = more expensive).
// TRADER_DISCOUNT: multiplier on base value when selling TO the trader (lower = less value).
// Effective ratio = MARKUP / DISCOUNT (currently 1.5:1). Must always be > 1 to prevent arbitrage.
// Modified at runtime by: Trade Routes research (see getTradeRates), pedestal items (tradeMarkupMult).
export const TRADER_MARKUP = 1.2;
export const TRADER_DISCOUNT = 0.8;

// Trade Rift request board. The board holds two independent groups of requests
// on different refresh cadences:
//   - 'season' requests refresh on every season change (easier, cheaper, lower tier).
//   - 'year' requests refresh only at year rollover (harder, pricier, better rewards).
//
// A request's reward is a hidden spec rolled into a concrete item only when the
// player fulfills it. Rewards come in three KINDS (rolled per request from the
// cadence's kindWeights):
//   - 'equipment' — a {type, tier, quality} spec; the promised quality is a FLOOR
//     (the fulfill roll can only surprise upward). May arrive pre-enchanted.
//   - 'tome'      — a random spell tome (dup-avoiding: prefers unlearned spells).
//   - 'artifact'  — a random pedestal-effect relic (dup-avoiding; yearly-only).
//
// DESIGN INTENT (why this is worth engaging vs. just crafting):
//   1. Cost is paid in SURPLUS COMMODITIES (wood/stone/food/…), not rare mats — so
//      even a gold-negative trade converts overflow into finished gear.
//   2. Promised quality is a floor, and equipment can arrive pre-enchanted —
//      something crafting can't cheaply guarantee.
//   3. Every fulfill has a JACKPOT chance to over-deliver (+tier / +quality /
//      +enchant), turning the mystery into upside-only anticipation.
// cost is sized from the reward's estimated gold value (rewardTierValue x quality
// multiplier x a random costMargin) converted to material quantities via TRADE_VALUES.
export const TRADE_RIFT_CONFIG = {
    rewardTypes: ['weapon', 'armor', 'helmet', 'tool', 'clothes', 'boots', 'trinket'],
    qualityAdjective: { poor: 'crude', normal: 'standard', fine: 'good', superior: 'excellent' },
    qualityOrder: ['poor', 'normal', 'fine', 'superior'],  // ascending; used for the quality FLOOR
    rewardTierValue: [10, 20, 40, 70, 110],   // approx gold value of a reward, indexed by tier 0-4
    typeLabels: { weapon: 'Weapon', armor: 'Armor', helmet: 'Helmet', tool: 'Tool', clothes: 'Garment', boots: 'Boots', trinket: 'Trinket' },
    tomeValue: 30,        // approx gold value used to size a tome request's cost
    artifactValue: 90,    // approx gold value used to size an artifact request's cost
    jackpotChance: 0.12,  // per-fulfill chance the rift over-delivers (both cadences)
    // Weighted outcomes when a jackpot fires (see main.js applyJackpot).
    jackpotWeights: { tier: 3, quality: 3, enchant: 4 },
    season: {                                  // EASY — refreshes each season
        count: 3,
        kindWeights: { equipment: 8, tome: 2, artifact: 0 },  // no relics in the cheap tier
        tierWeights: { 2: 3, 3: 2 },           // retiered up from {1,2} — matches mid-game unlock
        qualityWeights: { poor: 1, normal: 3, fine: 1 },
        enchantChance: 0.35,                   // chance an equipment reward is pre-enchanted
        enchantTierWeights: { 1: 3, 2: 1 },    // enchant strength (ENCHANTMENT_TIERS multiplier)
        costMargin: [0.9, 1.3],
        costMaterials: ['wood', 'stone', 'food', 'planks', 'hides', 'cotton'],
    },
    year: {                                    // HARD — refreshes at year rollover
        count: 2,
        kindWeights: { equipment: 6, tome: 2, artifact: 2 },  // artifacts are the yearly carrot
        tierWeights: { 3: 2, 4: 3 },           // leans into Tier 4
        qualityWeights: { fine: 3, superior: 2 },
        enchantChance: 0.75,
        enchantTierWeights: { 2: 2, 3: 1 },
        costMargin: [1.3, 1.8],
        costMaterials: ['planks', 'bricks', 'leather', 'iron', 'cloth', 'wool', 'stone'],
    },
};

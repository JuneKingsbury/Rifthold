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
        buyCategories: ['artifact', 'tome', 'consumable'],
    },
    {
        name: 'Tome Peddler',
        resourcePool: ['planks', 'runite', 'wood'],
        exclusiveItems: ['tome_of_spark', 'tome_of_mend', 'tome_of_smite', 'tome_of_magic_missile', 'tome_of_heal'],
        extraItemChances: [0.6, 0.3],   // 1 guaranteed + up to 2 extras (60%, then 30%)
        goldRange: [15, 35],
        buyCategories: ['weapon', 'armor', 'helmet', 'artifact', 'consumable'],
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
};

// TRADER_MARKUP: multiplier on base value when buying FROM the trader (higher = more expensive).
// TRADER_DISCOUNT: multiplier on base value when selling TO the trader (lower = less value).
// Effective ratio = MARKUP / DISCOUNT (currently 1.5:1). Must always be > 1 to prevent arbitrage.
// Modified at runtime by: Trade Routes research (see getTradeRates), pedestal artifacts (tradeMarkupMult).
export const TRADER_MARKUP = 1.2;
export const TRADER_DISCOUNT = 0.8;

/**
 * Shared item-rolling helpers. Centralizes deterministic quality application, the
 * per-type stat-key mapping, and colonist-free enchantment so both crafting
 * (task-executor.js) and the Trade Rift request board (systems/traderift.js) roll
 * items through one code path.
 */
import {
    ALL_ITEMS, QUALITY_TIERS, SPELL_TOMES, TRADE_VALUES,
    WEAPON_ENCHANTMENT_EFFECTS, ARMOR_ENCHANTMENT_EFFECTS,
    CLOTHES_ENCHANTMENT_EFFECTS, TOOL_ENCHANTMENT_EFFECTS, BOOTS_ENCHANTMENT_EFFECTS,
} from '../core/config.js';

const CRAFT_MARKUP = 1.25;                     // crafting premium over raw materials
const TIER_PREMIUM = [0, 2, 5, 10, 18];        // additive floor per tier (0-4), keeps tiers monotonic
const ARTIFACT_TIER_VALUE = [10, 25, 45, 70, 100]; // fallback for drop-only items with no recipe/override
const POTION_PREMIUM = 6;                      // flat craft premium for potions (their stat fields are
                                               // transient buff magnitudes, not permanent power).

// Per-stat gold premium for a permanent-power stat present on an item definition.
// Tool activity speeds are multipliers (1.0 = no bonus), so they score on (value-1).
const POWER_COEFF = {
    damage: 0.8, damageReduction: 90, spellDamageBonus: 30,
    moveSpeedBonus: 40, workSpeedBonus: 40,
    moodBonus: 1, coldResistance: 5, heatResistance: 5,
    healthRegen: 100, lightRadius: 2,
};
const TOOL_SPEED_KEYS = ['miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed'];
const TOOL_SPEED_COEFF = 25;

// Sum the recipe's material cost using the per-unit TRADE_VALUES table. Intermediate
// mats (planks, iron, …) already carry their own value, so no recursion is needed.
function materialCost(recipe) {
    if (!recipe?.input) return 0;
    let m = 0;
    for (const [mat, qty] of Object.entries(recipe.input)) m += (TRADE_VALUES[mat] || 0) * qty;
    return m;
}

// Sum the permanent-power premium from the stat fields present on a definition.
function powerValue(def) {
    let p = 0;
    for (const [stat, coeff] of Object.entries(POWER_COEFF)) {
        if (typeof def[stat] === 'number') p += def[stat] * coeff;
    }
    for (const stat of TOOL_SPEED_KEYS) {
        if (typeof def[stat] === 'number') p += Math.max(0, def[stat] - 1) * TOOL_SPEED_COEFF;
    }
    return p;
}

// The enchant multiplier for a rolled instance. Prefers the stamped enchantTier
// (see applyEnchantmentEffect); falls back to a flat estimate for legacy instances
// that only recorded the effect object, and 1 for un-enchanted items.
function enchantMultiplier(item) {
    if (typeof item.enchantTier === 'number') return 1 + 0.25 * item.enchantTier;
    if (item.enchantment) return 1.5;   // legacy: effect stored without its tier
    return 1;
}

/**
 * Resolve an item's trade value in gold. Accepts either a bare definition
 * (an ALL_ITEMS entry) or a rolled instance (carrying key/quality/enchant).
 *
 * Base value precedence:
 *   1. def.tradeValue         — authoritative override (drop-only relics, tomes, trinkets)
 *   2. potion rule            — CRAFT_MARKUP·M + POTION_PREMIUM (no POWER table)
 *   3. recipe formula         — CRAFT_MARKUP·M + POWER + TIER_PREMIUM[tier]
 *   4. artifact-tier fallback — ARTIFACT_TIER_VALUE[tier] (no recipe, no override)
 * Then scaled by the instance's quality and enchant multipliers.
 *
 * @param item A definition or rolled instance. May be null/undefined.
 * @return Integer gold value (>= 0). Returns 0 for null/unknown items.
 */
export function getItemTradeValue(item) {
    if (!item) return 0;
    // Prefer the definition for base stats (a rolled instance already scaled its
    // own stats by quality. Reading those would double-count. Price from the def
    // and apply the quality multiplier once, below).
    const def = (item.key && ALL_ITEMS[item.key]) || item;
    const tier = def.tier || 0;

    let base;
    if (typeof def.tradeValue === 'number') {
        base = def.tradeValue;
    } else if (def.type === 'potion') {
        base = CRAFT_MARKUP * materialCost(def.recipe) + POTION_PREMIUM;
    } else if (def.recipe) {
        base = CRAFT_MARKUP * materialCost(def.recipe) + powerValue(def) + (TIER_PREMIUM[tier] || 0);
    } else {
        base = ARTIFACT_TIER_VALUE[tier] || 0;
    }

    const qMult = QUALITY_TIERS.find(t => t.key === item.quality)?.multiplier || 1;
    return Math.round(base * qMult * enchantMultiplier(item));
}

// Which numeric stat fields scale with quality, keyed by item type. Mirrors the
// per-type branches in the craft/enchant cases of task-executor.js.
export const STAT_KEYS_BY_TYPE = {
    weapon: ['damage'],
    armor: ['damageReduction'],
    helmet: ['damageReduction'],
    tool: ['miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed'],
    clothes: ['workSpeedBonus', 'moodBonus', 'coldResistance', 'heatResistance'],
    boots: ['moveSpeedBonus', 'damageReduction'],
    trinket: [],
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Apply a named quality tier to an item deterministically (no skill-based roll).
 * Sets item.quality, prepends the tier prefix to item.name, and scales the given
 * stat keys by the tier multiplier. 'normal' is a no-op (unset, matching craft).
 */
export function applySpecificQuality(item, qualityTier, ...statKeys) {
    const tier = QUALITY_TIERS.find(t => t.key === qualityTier);
    if (!tier) return;
    if (tier.key === 'normal') return;
    item.quality = tier.key;
    item.name = `${tier.prefix} ${item.name}`;
    for (const stat of statKeys) {
        if (item[stat]) item[stat] = round2(item[stat] * tier.multiplier);
    }
}

/**
 * Build a fresh item instance for the given registry key at the given quality.
 * Returns null if the key is unknown. The type's quality-scaled stat keys are
 * resolved from STAT_KEYS_BY_TYPE.
 */
export function rollItem(key, quality) {
    const def = ALL_ITEMS[key];
    if (!def) return null;
    const item = { ...def, key };
    applySpecificQuality(item, quality, ...(STAT_KEYS_BY_TYPE[def.type] || []));
    return item;
}

// Map any type token (singular item type or plural resource-list name) to the
// enchant effect table that applies to it.
function enchantTableFor(type) {
    switch (type) {
        case 'weapon': case 'weapons': return WEAPON_ENCHANTMENT_EFFECTS;
        case 'armor': case 'armors':
        case 'helmet': case 'helmets': return ARMOR_ENCHANTMENT_EFFECTS;
        case 'clothes': return CLOTHES_ENCHANTMENT_EFFECTS;
        case 'tool': case 'tools': return TOOL_ENCHANTMENT_EFFECTS;
        case 'boots': return BOOTS_ENCHANTMENT_EFFECTS;
        default: return null;
    }
}

/**
 * Apply a randomly-chosen enchantment effect to an item, scaled by a given
 * enchantment tier. Colonist-free: the caller supplies the tier, so this is
 * shared by skill-based crafting (task-executor rolls tier from colonist skill)
 * and the Trade Rift (rolls its own tier from config). Behavior mirrors the
 * per-type application that previously lived inline in task-executor.js.
 *
 * @param item        The item to mutate (must already have base stats/name).
 * @param type        Item type token ('weapon'/'weapons'/…), selects the table.
 * @param enchantTier An ENCHANTMENT_TIERS entry ({ key, multiplier }).
 */
export function applyEnchantmentEffect(item, type, enchantTier) {
    const table = enchantTableFor(type);
    if (!table) return;
    const keys = Object.keys(table);
    if (!keys.length) return;
    const mult = enchantTier.multiplier;
    const effect = table[keys[Math.floor(Math.random() * keys.length)]];

    // All bonus effects are additive decimals (0.15 = +15%); the enchant tier
    // scales the magnitude via `mult`. defenseMultiplier / damageMultiplier remain
    // multiplicative because they scale a flat base stat (armor DR, weapon damage).
    // weapon effects
    if (effect.damageMultiplier) {
        item.damage = round2((item.damage || 0) * (effect.damageMultiplier * mult));
    } else if (effect.spellDamageBonus) {
        item.spellDamageBonus = round2((item.spellDamageBonus || 0) + effect.spellDamageBonus * mult);
    } else if (effect.critChance) {
        item.critChance = round2((item.critChance || 0) + effect.critChance * mult);
    } else if (effect.lifeSteal) {
        item.lifeSteal = round2((item.lifeSteal || 0) + effect.lifeSteal * mult);
    // armor / clothes effects
    } else if (effect.defenseMultiplier) {
        item.damageReduction = round2((item.damageReduction || 0) * (effect.defenseMultiplier * mult));
    } else if (effect.manaRegenBonus) {
        // Additive % boost consumed at runtime as ×(1 + Σbonus). Stored as a plain
        // bonus (not a live multiplier field) so getEquipmentStat's summing is correct.
        item.manaRegenBonus = round2((item.manaRegenBonus || 0) + effect.manaRegenBonus * mult);
    } else if (effect.thornsDamage) {
        item.thornsDamage = round2((item.thornsDamage || 0) + effect.thornsDamage * mult);
    } else if (effect.workSpeedBonus) {
        // Clothes carry a flat workSpeedBonus; tools carry per-activity speed
        // multipliers. Add the bonus to whichever fields the item already has.
        const b = effect.workSpeedBonus * mult;
        if (item.workSpeedBonus) item.workSpeedBonus = round2(item.workSpeedBonus + b);
        if (item.miningSpeed) item.miningSpeed = round2(item.miningSpeed + b);
        if (item.choppingSpeed) item.choppingSpeed = round2(item.choppingSpeed + b);
        if (item.farmingSpeed) item.farmingSpeed = round2(item.farmingSpeed + b);
        if (item.craftingSpeed) item.craftingSpeed = round2(item.craftingSpeed + b);
    } else if (effect.healthRegenBonus) {
        item.healthRegenBonus = round2((item.healthRegenBonus || 0) + effect.healthRegenBonus * mult);
    } else if (effect.moveSpeedBonus) {
        item.moveSpeedBonus = round2((item.moveSpeedBonus || 0) + effect.moveSpeedBonus * mult);
    }

    item.enchantment = effect;
    item.enchantTier = enchantTier.multiplier;   // retained so resale value can price the enchant (getItemTradeValue)
    item.description = `${item.description} ${effect.description}`;
    item.name = `${item.name} ${effect.suffix} ${enchantTier.key}`;
}

/**
 * Pick a spell-tome key, preferring tomes whose spell no colonist has learned yet
 * (dup-avoiding). Falls back to any tome if every spell is already known.
 * @param game Optional game (for colonist knownSpells); if absent, purely random.
 * @return A SPELL_TOMES key.
 */
export function pickTomeKey(game) {
    const allKeys = Object.keys(SPELL_TOMES);
    if (!allKeys.length) return null;
    const known = new Set();
    if (game && game.colonists) {
        for (const c of game.colonists) {
            for (const s of (c.knownSpells || [])) known.add(s);
        }
    }
    const fresh = allKeys.filter(k => !known.has(SPELL_TOMES[k].spell));
    const pool = fresh.length ? fresh : allKeys;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick a pedestal-artifact key, preferring relics the player does not already own
 * (dup-avoiding, checks inventory lists and placed pedestals). Falls back to any
 * pedestal item if all are owned.
 * @param game The game (for inventory + placed-pedestal ownership check).
 * @return An ALL_ITEMS key for a pedestal-effect item, or null if none exist.
 */
export function pickArtifactKey(game) {
    const artifactKeys = Object.entries(ALL_ITEMS)
        .filter(([, d]) => d.pedestal)
        .map(([k]) => k);
    if (!artifactKeys.length) return null;

    const owned = new Set();
    if (game && game.resources) {
        const lists = ['weapons', 'armors', 'helmets', 'clothes', 'tools', 'trinkets', 'boots'];
        for (const list of lists) {
            for (const it of (game.resources[list] || [])) owned.add(it.key);
        }
    }
    // Placed artifacts (on pedestals) count as owned too.
    if (game && game.map) {
        for (const row of game.map) {
            for (const tile of row) {
                if (tile.pedestalArtifact) owned.add(tile.pedestalArtifact);
            }
        }
    }
    const fresh = artifactKeys.filter(k => !owned.has(k));
    const pool = fresh.length ? fresh : artifactKeys;
    return pool[Math.floor(Math.random() * pool.length)];
}

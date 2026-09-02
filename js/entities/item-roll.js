/**
 * Shared item-rolling helpers. Centralizes deterministic quality application, the
 * per-type stat-key mapping, and colonist-free enchantment so both crafting
 * (task-executor.js) and the Trade Rift request board (systems/traderift.js) roll
 * items through one code path.
 */
import {
    ALL_ITEMS, QUALITY_TIERS, SPELL_TOMES,
    WEAPON_ENCHANTMENT_EFFECTS, ARMOR_ENCHANTMENT_EFFECTS,
    CLOTHES_ENCHANTMENT_EFFECTS, TOOL_ENCHANTMENT_EFFECTS, BOOTS_ENCHANTMENT_EFFECTS,
} from '../core/config.js';

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

    // weapon effects
    if (effect.damageMultiplier) {
        item.damage = round2((item.damage || 0) * (effect.damageMultiplier * mult));
    } else if (effect.spellDamageBonus) {
        item.spellDamageBonus = (item.spellDamageBonus || 0) + effect.spellDamageBonus * mult;
    } else if (effect.critChanceBonus) {
        item.critChance = (item.critChance || 0) + effect.critChanceBonus * mult;
    } else if (effect.lifeStealBonus) {
        item.lifeSteal = (item.lifeSteal || 0) + effect.lifeStealBonus * mult;
    // armor / clothes effects
    } else if (effect.defenseMultiplier) {
        item.damageReduction = round2((item.damageReduction || 0) * (effect.defenseMultiplier * mult));
    } else if (effect.manaRegenMultiplier) {
        if (item.manaRegenMultiplier === undefined) item.manaRegenMultiplier = 1;
        item.manaRegenMultiplier = round2(item.manaRegenMultiplier * (effect.manaRegenMultiplier * mult));
    } else if (effect.thornsDamageBonus) {
        item.thornsDamage = (item.thornsDamage || 0) + effect.thornsDamageBonus * mult;
    } else if (effect.workSpeedMultiplier) {
        // Clothes scale workSpeedBonus; tools scale the per-activity speeds.
        if (item.workSpeedBonus) item.workSpeedBonus = round2(item.workSpeedBonus * (effect.workSpeedMultiplier * mult));
        if (item.miningSpeed) item.miningSpeed = round2(item.miningSpeed * (effect.workSpeedMultiplier * mult));
        if (item.choppingSpeed) item.choppingSpeed = round2(item.choppingSpeed * (effect.workSpeedMultiplier * mult));
        if (item.farmingSpeed) item.farmingSpeed = round2(item.farmingSpeed * (effect.workSpeedMultiplier * mult));
        if (item.craftingSpeed) item.craftingSpeed = round2(item.craftingSpeed * (effect.workSpeedMultiplier * mult));
    } else if (effect.healthRegenMultiplier) {
        if (item.healthRegenMultiplier === undefined) item.healthRegenMultiplier = 1;
        item.healthRegenMultiplier = round2(item.healthRegenMultiplier * (effect.healthRegenMultiplier * mult));
    } else if (effect.speedMultiplier) {
        item.moveSpeedBonus = round2((item.moveSpeedBonus || 0) * (effect.speedMultiplier * mult));
    }

    item.enchantment = effect;
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

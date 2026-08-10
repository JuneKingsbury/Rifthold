export const STAT_META = {
    damage:             { label: 'Damage',           format: 'flat' },
    damageReduction:    { label: 'Damage Reduction', format: 'percent', aggregation: 'multiplicative' },
    critChance:         { label: 'Crit Chance',      format: 'percent' },
    dodgeChance:        { label: 'Dodge',            format: 'percent' },
    hpOnKill:           { label: 'HP on Kill',       format: 'plus_flat' },
    thornsDamage:       { label: 'Thorns',           format: 'flat' },
    spellDamageBonus:   { label: 'Spell Dmg',        format: 'plus_percent' },
    attackSpeed:        { label: 'Attack Speed',     format: 'plus_percent' },
    healthRegen:        { label: 'Health Regen',     format: 'plus_per_tick' },
    manaRegen:          { label: 'Mana Regen',       format: 'plus_per_tick' },
    spellCostReduction: { label: 'Spell Cost',       format: 'minus_percent' },
    tomeStudySpeed:     { label: 'Tome Speed',       format: 'multiplier' },
    researchSpeed:      { label: 'Research',         format: 'multiplier' },
    maxHpBonus:         { label: 'Max HP',           format: 'plus_flat' },
    moodBonus:          { label: 'Mood',             format: 'plus_flat' },
    hungerReduction:    { label: 'Hunger',           format: 'minus_percent' },
    coldResistance:     { label: 'Cold Res',         format: 'percent' },
    moveSpeedBonus:     { label: 'Move Speed',       format: 'plus_percent' },
    workSpeedBonus:     { label: 'Work Speed',       format: 'plus_percent' },
    miningSpeed:        { label: 'Mining',           format: 'mult_as_percent' },
    choppingSpeed:      { label: 'Chopping',         format: 'mult_as_percent' },
    farmingSpeed:       { label: 'Farming',          format: 'mult_as_percent' },
    craftingSpeed:      { label: 'Crafting',         format: 'mult_as_percent' },
    cookingSpeed:       { label: 'Cooking',          format: 'mult_as_percent' },
    buildSpeed:         { label: 'Building',         format: 'mult_as_percent' },
    lightRadius:        { label: 'Light Radius',     format: 'flat' },
    blightImmunity:     { label: 'Blight Immunity',  format: 'boolean', text: 'Crops immune to blight' },
    skillGrowthBonus:   { label: 'Skill Growth',     format: 'plus_percent' },
    damageBonusMult:    { label: 'Damage Bonus',     format: 'mult_as_percent' },
    wandererChanceMult: { label: 'Wanderer Chance',  format: 'mult_as_percent' },
    traderChanceMult:   { label: 'Trader Chance',    format: 'mult_as_percent' },
    cookingBonusFood:   { label: 'Bonus Food',       format: 'plus_flat', suffix: '/cook' },
    tradeMarkupMult:    { label: 'Trade Discount',   format: 'inverse_percent' },
    lootMult:           { label: 'Loot',             format: 'mult_as_percent' },
    trapDamageMult:     { label: 'Trap Damage',      format: 'trap_mult' },
    rareEncounterMult:  { label: 'Rare Encounters',  format: 'multiplier' },
    partyDamageMult:    { label: 'Party Damage',     format: 'mult_as_percent' },
    durationMult:       { label: 'Duration',         format: 'inverse_percent' },
    targetPriority:     { label: 'Target Priority',  format: 'threat' },
    autoReviveHp:       { label: 'Auto-Revive',      format: 'at_percent_hp' },
};

const ITEM_META_KEYS = new Set([
    'name', 'key', 'description', 'tier', 'ranged', 'range',
    'projectileChar', 'projectileColor', 'skinKey', 'attackCooldown',
    'pedestal', 'combat', 'expedition', 'durability', 'consumable',
    'trigger', 'hpThreshold', 'effect', 'healAmount', 'duration', 'cooldown',
    'manaThreshold', 'manaAmount', 'moveSpeedBonus_potion', 'workSpeedBonus_potion',
    'recipe',
]);

export function formatStatValue(statKey, value) {
    const meta = STAT_META[statKey];
    if (!meta) return `${value}`;
    switch (meta.format) {
        case 'flat':               return `${value}`;
        case 'plus_flat':          return `+${value}${meta.suffix || ''}`;
        case 'percent':            return `${Math.round(value * 100)}%`;
        case 'plus_percent':       return `+${Math.round(value * 100)}%`;
        case 'minus_percent':      return `-${Math.round(value * 100)}%`;
        case 'multiplier':         return `${value}x`;
        case 'mult_as_percent':    return `+${Math.round((value - 1) * 100)}%`;
        case 'inverse_percent':    return `-${Math.round((1 - value) * 100)}%`;
        case 'plus_per_tick':      return `+${value}/tick`;
        case 'boolean':            return meta.text || meta.label;
        case 'threat':             return value > 0 ? 'draws enemy fire' : 'enemies avoid you';
        case 'at_percent_hp':      return `at ${Math.round(value * 100)}% HP`;
        case 'trap_mult':          return value < 1 ? `-${Math.round((1 - value) * 100)}% trap dmg` : `+${Math.round((value - 1) * 100)}% trap dmg`;
        default:                   return `${value}`;
    }
}

export function getItemStatLines(item) {
    const lines = [];
    for (const [key, value] of Object.entries(item)) {
        if (ITEM_META_KEYS.has(key)) continue;
        if (value === undefined || value === null || value === 0 || value === false) continue;
        if (typeof value === 'object') continue;
        const meta = STAT_META[key];
        if (!meta) continue;
        if (meta.format === 'boolean') { lines.push(meta.text || meta.label); }
        else { lines.push(`${meta.label}: ${formatStatValue(key, value)}`); }
    }
    return lines;
}

export function getNestedEffectLines(obj) {
    if (!obj) return [];
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
        if (key === 'radius' || key === 'manaCost') continue;
        if (value === undefined || value === null || value === 0 || value === false) continue;
        const meta = STAT_META[key];
        if (!meta) continue;
        if (meta.format === 'boolean') { lines.push(meta.text || meta.label); }
        else { lines.push(`${meta.label}: ${formatStatValue(key, value)}`); }
    }
    return lines;
}

export const STAT_META = {
    // ── Combat ──
    damage:               { label: 'Damage',             format: 'flat' },
    damageReduction:      { label: 'Damage Reduction',   format: 'percent', aggregation: 'multiplicative' },
    critChance:           { label: 'Crit Chance',        format: 'percent' },
    dodgeChance:          { label: 'Dodge',              format: 'percent' },
    hpOnKill:             { label: 'HP on Kill',         format: 'plus_flat' },
    lifeSteal:            { label: 'Life Steal',         format: 'plus_percent' },
    thornsDamage:         { label: 'Thorns',             format: 'flat' },
    armoredDamageBonus:   { label: 'vs Armored',         format: 'plus_percent' },
    postMoveAttackBonus:  { label: 'First Strike',       format: 'plus_percent' },
    lowHpDamageBonus:     { label: 'Low HP Dmg',         format: 'plus_percent' },
    poisonImmunity:       { label: 'Poison Immune',      format: 'boolean', text: 'Poison Immune' },
    targetPriority:       { label: 'Target Priority',   format: 'threat' },
    autoReviveHp:         { label: 'Auto-Revive',        format: 'at_percent_hp' },
    attackSpeed:          { label: 'Attack Speed',       format: 'plus_percent' },
    // ── Magic ──
    spellDamageBonus:     { label: 'Spell Dmg',          format: 'plus_percent' },
    spellCostReduction:   { label: 'Spell Cost',         format: 'minus_percent' },
    spellCooldownReduction: { label: 'Spell Cooldown',   format: 'minus_percent' },
    spellDurationBonus:   { label: 'Spell Duration',     format: 'plus_percent' },
    spellHealBonus:       { label: 'Spell Heal',         format: 'plus_percent' },
    summonHpBonus:        { label: 'Summon HP',          format: 'plus_percent' },
    summonDamageBonus:    { label: 'Summon Dmg',         format: 'plus_percent' },
    summonDurationBonus:  { label: 'Summon Duration',    format: 'plus_percent' },
    evocationBonus:       { label: 'Evocation',          format: 'plus_percent' },
    transmutationBonus:   { label: 'Transmutation',      format: 'plus_percent' },
    abjurationBonus:      { label: 'Abjuration',         format: 'plus_percent' },
    enchantmentBonus:     { label: 'Enchantment',        format: 'plus_percent' },
    conjurationBonus:     { label: 'Conjuration',        format: 'plus_percent' },
    divinationBonus:      { label: 'Divination',         format: 'plus_percent' },
    manaRegen:            { label: 'Mana Regen',         format: 'plus_per_tick' },
    manaRegenBonus:       { label: 'Mana Regen',         format: 'plus_percent' },
    // ── Sustain ──
    healthRegen:          { label: 'Health Regen',       format: 'plus_per_tick' },
    healthRegenBonus:     { label: 'Health Regen',       format: 'plus_percent' },
    maxHpBonus:           { label: 'Max HP',             format: 'plus_flat' },
    // ── Movement & work ──
    moveSpeedBonus:       { label: 'Move Speed',         format: 'plus_percent' },
    workSpeedBonus:       { label: 'Work Speed',         format: 'plus_percent' },
    miningSpeed:          { label: 'Mining',             format: 'mult_as_percent' },
    choppingSpeed:        { label: 'Chopping',           format: 'mult_as_percent' },
    farmingSpeed:         { label: 'Farming',            format: 'mult_as_percent' },
    craftingSpeed:        { label: 'Crafting',           format: 'mult_as_percent' },
    cookingSpeed:         { label: 'Cooking',            format: 'mult_as_percent' },
    buildSpeed:           { label: 'Building',           format: 'mult_as_percent' },
    tomeStudySpeed:       { label: 'Tome Speed',         format: 'multiplier' },
    researchSpeed:        { label: 'Research',           format: 'multiplier' },
    skillGrowthBonus:     { label: 'Skill Growth',       format: 'plus_percent' },
    // ── Colonist comfort ──
    moodBonus:            { label: 'Mood',               format: 'plus_flat' },
    hungerReduction:      { label: 'Hunger',             format: 'minus_percent' },
    hungerDecayMult:      { label: 'Hunger Rate',        format: 'inverse_percent' },
    coldResistance:       { label: 'Cold Res',           format: 'percent' },
    heatResistance:       { label: 'Heat Res',           format: 'percent' },
    lightRadius:          { label: 'Light Radius',       format: 'flat' },
    // ── Colony economy ──
    damageBonusMult:      { label: 'Damage Bonus',       format: 'mult_as_percent' },
    wandererChanceMult:   { label: 'Wanderer Chance',    format: 'mult_as_percent' },
    traderChanceMult:     { label: 'Trader Chance',      format: 'mult_as_percent' },
    cookingBonusFood:     { label: 'Bonus Food',         format: 'plus_flat', suffix: '/cook' },
    harvestYieldBonus:    { label: 'Harvest Yield',      format: 'plus_flat', suffix: '/harvest' },
    craftOutputBonus:     { label: 'Craft Output',       format: 'plus_flat', suffix: '/craft' },
    tradeMarkupMult:      { label: 'Trade Discount',     format: 'inverse_percent' },
    voidEssenceGainMult:  { label: 'Void Essence',       format: 'mult_as_percent' },
    // ── Blight ──
    blightImmunity:       { label: 'Blight Immunity',    format: 'boolean', text: 'Crops immune to miasma' },
    blightDamageReduction: { label: 'Bloom Resistance',  format: 'plus_percent', text: 'Crops resist bloom kills' },
    blightBloomDamage:    { label: 'Bloom Damage',       format: 'flat', suffix: '/tick', text: 'Passively damages blight blooms' },
    // ── Expedition ──
    lootMult:             { label: 'Loot',               format: 'mult_as_percent' },
    trapDamageMult:       { label: 'Trap Damage',        format: 'trap_mult' },
    rareEncounterMult:    { label: 'Rare Encounters',    format: 'multiplier' },
    partyDamageMult:      { label: 'Party Damage',       format: 'mult_as_percent' },
    spellDamageMult:      { label: 'Spell Dmg',          format: 'mult_as_percent' },
    fatigueMult:          { label: 'Fatigue',            format: 'inverse_percent' },
    durationMult:         { label: 'Duration',           format: 'inverse_percent' },
    rallyChance:          { label: 'Rally Chance',       format: 'percent' },
    rallyHeal:            { label: 'Rally Heal',         format: 'plus_percent' },
    dodgeChanceMod:       { label: 'Dodge',              format: 'plus_percent' },
    xpMult:               { label: 'XP',                 format: 'mult_as_percent' },
    puzzleSuccessBonus:   { label: 'Puzzle Success',     format: 'plus_percent' },
    chaosResistance:      { label: 'Chaos Resist',       format: 'plus_percent' },
};

const ITEM_META_KEYS = new Set([
    'name', 'key', 'description', 'tier', 'ranged', 'range',
    'projectileChar', 'projectileColor', 'skinKey', 'attackCooldown',
    'pedestal', 'expedition', 'durability', 'consumable',
    'trigger', 'hpThreshold', 'effect', 'healAmount', 'duration', 'cooldown',
    'manaThreshold', 'manaAmount', 'moveSpeedBonus_potion', 'workSpeedBonus_potion',
    'recipe', 'type', 'tradeValue', 'textColor', 'quality', 'enchantment', 'enchantTier',
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

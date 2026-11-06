import { stampLoc, t } from '../i18n.js';

export const STAT_META = {
    // ── Combat ──
    damage:               { format: 'flat' },
    damageReduction:      { format: 'percent', aggregation: 'multiplicative' },
    critChance:           { format: 'percent' },
    dodgeChance:          { format: 'percent' },
    hpOnKill:             { format: 'plus_flat' },
    lifeSteal:            { format: 'plus_percent' },
    thornsDamage:         { format: 'flat' },
    armoredDamageBonus:   { format: 'plus_percent' },
    postMoveAttackBonus:  { format: 'plus_percent' },
    lowHpDamageBonus:     { format: 'plus_percent' },
    poisonImmunity:       { format: 'boolean' },
    targetPriority:       { format: 'threat' },
    autoReviveHp:         { format: 'at_percent_hp' },
    attackSpeed:          { format: 'plus_percent' },
    // ── Magic ──
    spellDamageBonus:     { format: 'plus_percent' },
    spellCostReduction:   { format: 'minus_percent' },
    spellCooldownReduction: { format: 'minus_percent' },
    spellDurationBonus:   { format: 'plus_percent' },
    spellHealBonus:       { format: 'plus_percent' },
    summonHpBonus:        { format: 'plus_percent' },
    summonDamageBonus:    { format: 'plus_percent' },
    summonDurationBonus:  { format: 'plus_percent' },
    evocationBonus:       { format: 'plus_percent' },
    transmutationBonus:   { format: 'plus_percent' },
    abjurationBonus:      { format: 'plus_percent' },
    enchantmentBonus:     { format: 'plus_percent' },
    conjurationBonus:     { format: 'plus_percent' },
    divinationBonus:      { format: 'plus_percent' },
    manaRegen:            { format: 'plus_per_tick' },
    manaRegenBonus:       { format: 'plus_percent' },
    maxManaBonus:         { format: 'plus_flat' },
    // ── Sustain ──
    healthRegen:          { format: 'plus_per_tick' },
    healthRegenBonus:     { format: 'plus_percent' },
    maxHpBonus:           { format: 'plus_flat' },
    // ── Movement & work ──
    moveSpeedBonus:       { format: 'plus_percent' },
    workSpeedBonus:       { format: 'plus_percent' },
    miningSpeed:          { format: 'mult_as_percent' },
    choppingSpeed:        { format: 'mult_as_percent' },
    farmingSpeed:         { format: 'mult_as_percent' },
    craftingSpeed:        { format: 'mult_as_percent' },
    cookingSpeed:         { format: 'mult_as_percent' },
    buildSpeed:           { format: 'mult_as_percent' },
    tomeStudySpeed:       { format: 'multiplier' },
    researchSpeed:        { format: 'multiplier' },
    skillGrowthBonus:     { format: 'plus_percent' },
    // ── Colonist comfort ──
    moodBonus:            { format: 'plus_flat' },
    hungerReduction:      { format: 'minus_percent' },
    hungerDecayMult:      { format: 'inverse_percent' },
    coldResistance:       { format: 'percent' },
    heatResistance:       { format: 'percent' },
    lightRadius:          { format: 'flat' },
    // ── Colony economy ──
    damageBonusMult:      { format: 'mult_as_percent' },
    wandererChanceMult:   { format: 'mult_as_percent' },
    traderChanceMult:     { format: 'mult_as_percent' },
    cookingBonusFood:     { format: 'plus_flat' },
    harvestYieldBonus:    { format: 'plus_flat' },
    craftOutputBonus:     { format: 'plus_flat' },
    tradeMarkupMult:      { format: 'inverse_percent' },
    voidEssenceGainMult:  { format: 'mult_as_percent' },
    // ── Blight ──
    blightImmunity:       { format: 'boolean' },
    blightDamageReduction: { format: 'plus_percent' },
    blightBloomDamage:    { format: 'flat' },
    // ── Expedition ──
    lootMult:             { format: 'mult_as_percent' },
    trapDamageMult:       { format: 'trap_mult' },
    rareEncounterMult:    { format: 'multiplier' },
    partyDamageMult:      { format: 'mult_as_percent' },
    spellDamageMult:      { format: 'mult_as_percent' },
    fatigueMult:          { format: 'inverse_percent' },
    durationMult:         { format: 'inverse_percent' },
    rallyChance:          { format: 'percent' },
    rallyHeal:            { format: 'plus_percent' },
    xpMult:               { format: 'mult_as_percent' },
    puzzleSuccessBonus:   { format: 'plus_percent' },
    chaosResistance:      { format: 'plus_percent' },
};
stampLoc(STAT_META, 'stat');

const ITEM_META_KEYS = new Set([
    'name', 'key', 'description', 'tier', 'ranged', 'range',
    'projectileChar', 'projectileColor', 'skinKey', 'attackCooldown',
    'pedestal', 'expedition', 'durability', 'consumable',
    'trigger', 'hpThreshold', 'effect', 'healAmount', 'duration', 'cooldown',
    'manaThreshold', 'manaAmount', 'moveSpeedBonus_potion', 'workSpeedBonus_potion',
    'recipe', 'type', 'tradeValue', 'textColor', 'quality', 'enchantment', 'enchantTier',
    'onHit', 'poisonOnHit', 'bleedOnHit', 'burnOnHit', 'cleave',
    'order', 'attackAnim',
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
        case 'multiplier':         return t('ui.stats.format.multiplier', { value });
        case 'mult_as_percent':    return `+${Math.round((value - 1) * 100)}%`;
        case 'inverse_percent':    return `-${Math.round((1 - value) * 100)}%`;
        case 'plus_per_tick':      return t('ui.stats.format.per_tick', { value });
        case 'boolean':            return meta.text || meta.label;
        case 'threat':             return t(value > 0 ? 'ui.stats.format.threat_draw' : 'ui.stats.format.threat_avoid');
        case 'at_percent_hp':      return t('ui.stats.format.at_percent_hp', { pct: Math.round(value * 100) });
        case 'trap_mult':          return value < 1
            ? t('ui.stats.format.trap_less', { pct: Math.round((1 - value) * 100) })
            : t('ui.stats.format.trap_more', { pct: Math.round((value - 1) * 100) });
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
        else { lines.push(t('ui.stats.line', { label: meta.label, value: formatStatValue(key, value) })); }
    }
    return lines;
}

export function getOnHitLines(item) {
    const lines = [];
    if (item.onHit?.effect === 'slow') {
        const speedPct = Math.round(Math.abs(item.onHit.moveSpeedMalus) * 100);
        const atkPct   = item.onHit.attackSlowMult != null ? Math.round((1 - item.onHit.attackSlowMult) * 100) : null;
        lines.push(atkPct
            ? t('ui.stats.on_hit.slow_attack', { move: speedPct, attack: atkPct })
            : t('ui.stats.on_hit.slow', { move: speedPct }));
    }
    if (item.poisonOnHit) {
        const p = item.poisonOnHit;
        lines.push(t('ui.stats.on_hit.poison', { damage: p.damage, ticks: p.ticks }));
    }
    if (item.bleedOnHit) {
        const b = item.bleedOnHit;
        lines.push(t('ui.stats.on_hit.bleed', { damage: b.damage, ticks: b.ticks }));
    }
    if (item.burnOnHit) {
        const b = item.burnOnHit;
        lines.push(t('ui.stats.on_hit.burn', { damage: b.damage, ticks: b.ticks }));
    }
    if (item.cleave) {
        lines.push(t('ui.stats.on_hit.cleave'));
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
        else { lines.push(t('ui.stats.line', { label: meta.label, value: formatStatValue(key, value) })); }
    }
    return lines;
}

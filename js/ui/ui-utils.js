// Small presentation helpers shared across the UI modules (ui.js, ui-arcane.js)
// and the exploration system. Kept dependency-free so any layer can import them.
import { EXPEDITION_XP_CONFIG } from '../core/config.js';

const ADVENTURER_ABILITY_DESCS = {
    scout:   'Scout: Reveals extra info about the next encounter before it starts.',
    rally:   'Rally: Chance to heal the party when a member falls in battle.',
    ambush:  'Ambush: First strike in combat, party attacks before enemies in round 1.',
    veteran: 'Veteran: Fatigue after expeditions is halved, so you can adventure again sooner.',
};

// Returns a multi-line tooltip string describing all active Adventurer level bonuses.
export function adventurerLevelTooltip(level) {
    if (!level || level <= 0) return 'No Adventurer levels yet.';
    const lines = [`Adventurer Level ${level} Active Bonuses:`];
    let damageMult = 1;
    let trapMult = 1;
    for (let lv = 1; lv <= level; lv++) {
        const b = EXPEDITION_XP_CONFIG.levelBonuses[lv];
        if (!b) continue;
        if (b.expeditionDamageMult) damageMult *= b.expeditionDamageMult;
        if (b.trapDamageMult) trapMult *= b.trapDamageMult;
        if (b.rareEncounterMult) lines.push(`Lv${lv}: +${Math.round((b.rareEncounterMult - 1) * 100)}% rare encounter chance`);
        if (b.ability) lines.push(`Lv${lv}: ${ADVENTURER_ABILITY_DESCS[b.ability] || b.ability}`);
    }
    if (damageMult > 1) lines.splice(1, 0, `Expedition damage: +${Math.round((damageMult - 1) * 100)}%`);
    if (trapMult < 1) lines.splice(damageMult > 1 ? 2 : 1, 0, `Trap damage taken: -${Math.round((1 - trapMult) * 100)}%`);
    const needed = EXPEDITION_XP_CONFIG.xpToLevel + level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
    if (level < EXPEDITION_XP_CONFIG.maxLevel) lines.push(`Next level at ${needed} XP.`);
    else lines.push('Maximum level reached.');
    return lines.join('\n');
}

export function getTargetPriority(x) {
    let priority = 0;
    for (const item of [x.weapon, x.armor, x.helmet, x.clothes, x.boots, x.tool, x.trinket].filter(Boolean)) {
        priority += item.targetPriority || 0;
    }
    return priority;
}

// Tally items into a plain { key: count } object. keyFn maps each item to its
// grouping key, used for inventory stacks (potions, tomes, tamed animals).
export function countByKey(items, keyFn) {
    const counts = {};
    for (const item of items) {
        const k = keyFn(item);
        counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
}

// The `[▲Threat]` / `[▼Threat]` colored span shown next to expedition party
// members. Returns '' for neutral (0) priority.
export function getThreatDisplayHtml(priority) {
    if (priority === 0) return '';
    const color = priority > 0 ? '#ff6644' : '#66aaff';
    const arrow = priority > 0 ? '▲' : '▼';
    return ` <span style="color:${color};font-size:0.85em;">[${arrow}Threat]</span>`;
}

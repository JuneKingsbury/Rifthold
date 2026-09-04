// Small presentation helpers shared across the UI modules (ui.js, ui-arcane.js)
// and the exploration system. Kept dependency-free so any layer can import them.

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

/**
 * Auto-repair: on a periodic tick, queue repair tasks for damaged structures
 * and repair_artifact tasks for colonists carrying a broken artifact (which
 * need an anvil). Extracted from the main loop so the queueing logic can be
 * unit-tested without booting the DOM-coupled engine.
 *
 * `structurePositions` is the shared per-tick snapshot from
 * mapIndex.getAllStructurePositions() — an array of { x, y, type }. It defaults
 * to a fresh scan when called standalone (e.g. from tests).
 */
import { BUILDINGS } from '../core/config.js';

export function updateAutoRepair(game, structurePositions = game.mapIndex.getAllStructurePositions()) {
    for (const { x, y } of structurePositions) {
        const tile = game.map[y][x];
        if (tile.structureHp === undefined) continue;
        const maxHp = BUILDINGS[tile.structure]?.hp;
        if (!maxHp || tile.structureHp >= maxHp) continue;
        const existing = game.taskQueue.getByPosition(x, y);
        if (existing) continue;
        game.taskQueue.add({
            type: 'repair',
            skillRequired: 'building',
            x, y,
            workAmount: 15,
        });
    }
    const anvils = structurePositions.filter(s => s.type === 'anvil');
    if (anvils.length === 0) return;
    for (const c of game.colonists) {
        if (c.hp <= 0 || !c.artifactBroken || !c.artifact) continue;
        if (c._repairQueued) continue;
        const anvil = anvils[0];
        const existing = game.taskQueue.getAll().find(t => t.type === 'repair_artifact' && t.colonistId === c.id);
        if (existing) continue;
        game.taskQueue.add({
            type: 'repair_artifact',
            skillRequired: 'crafting',
            x: anvil.x, y: anvil.y,
            workAmount: 40,
            colonistId: c.id,
            artifactKey: c.artifact,
        });
        c._repairQueued = true;
    }
}

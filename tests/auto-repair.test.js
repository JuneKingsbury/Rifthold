// Guards updateAutoRepair. Two behaviors: queue a 'repair' task for any damaged
// structure that has no pending task, and queue a 'repair_artifact' task (at an
// anvil) for each colonist carrying a broken artifact.
//
// The anvil path is a regression guard: a Phase-3c refactor renamed the
// function's structure list but missed the anvil scan, throwing a ReferenceError
// every 10th tick when a colonist held a broken artifact (fixed in b7a49ef).
// That bug survived because the makeGame fixture had no mapIndex — so this suite
// drives updateAutoRepair through the real structurePositions snapshot.
import { describe, it, expect } from 'vitest';
import { updateAutoRepair } from '../js/systems/auto-repair.js';
import { makeGame } from './helpers.js';

// Place a structure on the fixture map and refresh the MapIndex so
// getAllStructurePositions() reflects it.
function place(game, x, y, type, structureHp) {
    const tile = game.map[y][x];
    tile.structure = type;
    if (structureHp !== undefined) tile.structureHp = structureHp;
    game.mapIndex.rebuild(game.map);
}

describe('updateAutoRepair — structure repair', () => {
    it('queues a repair task for a damaged wall', () => {
        const game = makeGame();
        place(game, 1, 1, 'wood_wall', 10);   // wood_wall maxHp is 50
        updateAutoRepair(game);
        const task = game.taskQueue.getByPosition(1, 1);
        expect(task).toBeTruthy();
        expect(task.type).toBe('repair');
        expect(task.skillRequired).toBe('building');
    });

    it('does not queue a repair for a structure at full HP', () => {
        const game = makeGame();
        place(game, 1, 1, 'wood_wall', 50);
        updateAutoRepair(game);
        expect(game.taskQueue.getByPosition(1, 1)).toBeNull();
    });

    it('ignores structures with no structureHp (undamageable)', () => {
        const game = makeGame();
        place(game, 1, 1, 'wood_wall');   // structureHp left undefined
        updateAutoRepair(game);
        expect(game.taskQueue.getByPosition(1, 1)).toBeNull();
    });

    it('does not double-queue when a task already exists at that position', () => {
        const game = makeGame();
        place(game, 1, 1, 'wood_wall', 10);
        updateAutoRepair(game);
        updateAutoRepair(game);
        const repairTasks = game.taskQueue.getAll().filter(t => t.type === 'repair');
        expect(repairTasks.length).toBe(1);
    });
});

describe('updateAutoRepair — broken artifact repair (anvil path)', () => {
    it('queues a repair_artifact task at the anvil for a colonist with a broken artifact', () => {
        const game = makeGame();
        place(game, 2, 2, 'anvil');   // anvil is furniture with no hp
        game.colonists = [{ id: 1, hp: 100, artifactBroken: true, artifact: 'lucky_charm' }];

        updateAutoRepair(game);

        const task = game.taskQueue.getAll().find(t => t.type === 'repair_artifact');
        expect(task).toBeTruthy();
        expect(task.x).toBe(2);
        expect(task.y).toBe(2);
        expect(task.colonistId).toBe(1);
        expect(task.artifactKey).toBe('lucky_charm');
        expect(game.colonists[0]._repairQueued).toBe(true);
    });

    it('does not throw and queues nothing when there is no anvil', () => {
        const game = makeGame();
        game.colonists = [{ id: 1, hp: 100, artifactBroken: true, artifact: 'lucky_charm' }];
        // Regression: this path previously referenced a stale variable and threw.
        expect(() => updateAutoRepair(game)).not.toThrow();
        expect(game.taskQueue.getAll().some(t => t.type === 'repair_artifact')).toBe(false);
    });

    it('skips colonists that are dead, whole, or already queued', () => {
        const game = makeGame();
        place(game, 2, 2, 'anvil');
        game.colonists = [
            { id: 1, hp: 0, artifactBroken: true, artifact: 'a' },        // dead
            { id: 2, hp: 100, artifactBroken: false, artifact: 'b' },     // artifact intact
            { id: 3, hp: 100, artifactBroken: true, artifact: null },     // no artifact
            { id: 4, hp: 100, artifactBroken: true, artifact: 'c', _repairQueued: true },  // already queued
        ];
        updateAutoRepair(game);
        expect(game.taskQueue.getAll().some(t => t.type === 'repair_artifact')).toBe(false);
    });

    it('does not re-queue an artifact repair already in the queue for that colonist', () => {
        const game = makeGame();
        place(game, 2, 2, 'anvil');
        game.colonists = [{ id: 1, hp: 100, artifactBroken: true, artifact: 'a' }];
        updateAutoRepair(game);
        // Clear the per-colonist guard so re-queue would only be blocked by the
        // existing-task check, not the _repairQueued flag.
        game.colonists[0]._repairQueued = false;
        updateAutoRepair(game);
        const artifactTasks = game.taskQueue.getAll().filter(t => t.type === 'repair_artifact');
        expect(artifactTasks.length).toBe(1);
    });
});

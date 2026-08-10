// Guards TaskQueue.findBestTask scoring/selection. These tests pin the current
// behavior so the Phase-6a task-index optimization can be proven equivalent:
// score = priority*10000 + manhattanDistance, lower wins; priority dominates.
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue } from '../js/core/tasks.js';
import { makeColonist } from './helpers.js';

function addTask(q, { x, y, skill, type = 'build' }) {
    return q.add({ x, y, type, skillRequired: skill });
}

describe('TaskQueue.findBestTask', () => {
    let q;
    beforeEach(() => { q = new TaskQueue(); });

    it('returns null when there are no tasks', () => {
        const c = makeColonist({ priorities: { build: 3 } });
        expect(q.findBestTask(c, 0)).toBeNull();
    });

    it('skips tasks whose required skill has priority <= 0', () => {
        addTask(q, { x: 1, y: 0, skill: 'build' });
        const c = makeColonist({ priorities: { build: 0 } });
        expect(q.findBestTask(c, 0)).toBeNull();
    });

    it('prefers the nearest task when priorities are equal', () => {
        const near = addTask(q, { x: 2, y: 0, skill: 'build' });
        addTask(q, { x: 10, y: 0, skill: 'build' });
        const c = makeColonist({ x: 0, y: 0, priorities: { build: 3 } });
        expect(q.findBestTask(c, 0)).toBe(near);
    });

    it('lets priority dominate distance (lower priority number wins even if far)', () => {
        // farmTask is far but priority 1; buildTask is adjacent but priority 3.
        // 1*10000+20 = 10020 < 3*10000+1 = 30001, so the farm task wins.
        const farm = addTask(q, { x: 20, y: 0, skill: 'farm' });
        addTask(q, { x: 1, y: 0, skill: 'build' });
        const c = makeColonist({ x: 0, y: 0, priorities: { build: 3, farm: 1 } });
        expect(q.findBestTask(c, 0)).toBe(farm);
    });

    it('ignores tasks on a recent-failure cooldown (< 30 ticks)', () => {
        const t = addTask(q, { x: 1, y: 0, skill: 'build' });
        const c = makeColonist({ priorities: { build: 3 }, failedTasks: { [t.id]: 100 } });
        expect(q.findBestTask(c, 110)).toBeNull();      // 110-100 = 10 < 30 -> skipped
        expect(q.findBestTask(c, 140)).toBe(t);         // 140-100 = 40 >= 30 -> eligible
    });

    it('does not return an already-claimed task', () => {
        const t = addTask(q, { x: 1, y: 0, skill: 'build' });
        q.claim(t.id, 'colonist-1');
        const c = makeColonist({ priorities: { build: 3 } });
        expect(q.findBestTask(c, 0)).toBeNull();
    });

    it('skips craft/cook tasks whose station is busy', () => {
        const craft = addTask(q, { x: 5, y: 5, skill: 'craft', type: 'craft' });
        q.claim(craft.id, 'c1');   // claiming a craft marks the station busy
        const another = q.add({ x: 5, y: 5, type: 'craft', skillRequired: 'craft' });
        const c = makeColonist({ x: 5, y: 5, priorities: { craft: 3 } });
        // Both tasks share the busy station position -> none selectable.
        expect([craft, another]).not.toContain(q.findBestTask(c, 0));
        expect(q.findBestTask(c, 0)).toBeNull();
    });

    it('skips tasks whose required skill is absent from the colonist priorities', () => {
        // undefined <= 0 is false in JS, so an absent skill must still be
        // excluded — this pins that a missing priority is treated as ineligible.
        addTask(q, { x: 1, y: 0, skill: 'mining' });
        const c = makeColonist({ priorities: { build: 3 } });   // no 'mining' key
        expect(q.findBestTask(c, 0)).toBeNull();
    });

    it('reflects a task completed after the pending snapshot was built', () => {
        const a = addTask(q, { x: 1, y: 0, skill: 'build' });
        const b = addTask(q, { x: 2, y: 0, skill: 'build' });
        const c = makeColonist({ x: 0, y: 0, priorities: { build: 3 } });
        expect(q.findBestTask(c, 0)).toBe(a);   // builds the pending snapshot
        q.complete(a.id);                       // mutate after snapshot
        expect(q.findBestTask(c, 0)).toBe(b);   // dirty flag forces a rebuild
    });

    it('re-selects a released task on the next scan', () => {
        const t = addTask(q, { x: 1, y: 0, skill: 'build' });
        const c = makeColonist({ priorities: { build: 3 } });
        q.claim(t.id, 'c1');
        expect(q.findBestTask(c, 0)).toBeNull();
        q.release(t.id);
        expect(q.findBestTask(c, 0)).toBe(t);
    });

    it('picks the higher-priority skill across different task types', () => {
        const build = addTask(q, { x: 1, y: 0, skill: 'build' });
        const farm = addTask(q, { x: 1, y: 0, skill: 'farm' });
        // farm priority 1 beats build priority 5 regardless of equal distance.
        const c = makeColonist({ x: 0, y: 0, priorities: { build: 5, farm: 1 } });
        expect(q.findBestTask(c, 0)).toBe(farm);
        expect(q.findBestTask(c, 0)).not.toBe(build);
    });
});

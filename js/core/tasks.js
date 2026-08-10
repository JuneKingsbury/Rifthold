import { manhattanDist } from '../world/pathfinding.js';

let nextTaskId = 1;

export class TaskQueue {
    constructor() {
        this.tasks = [];
        this._byId = new Map();
        this._byPosition = new Map();
        this._busyStations = new Set();
        this._pending = [];
        this._pendingDirty = true;
    }

    _posKey(x, y) {
        return (y << 16) | x;
    }

    add(task) {
        task.id = nextTaskId++;
        task.workDone = 0;
        task.assignedTo = null;
        task.status = 'pending';
        this.tasks.push(task);
        this._byId.set(task.id, task);
        this._byPosition.set(this._posKey(task.x, task.y), task);
        this._pendingDirty = true;
        return task;
    }

    syncIdCounter() {
        const maxId = this.tasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
        if (maxId >= nextTaskId) nextTaskId = maxId + 1;
        this._rebuildIndices();
    }

    _rebuildIndices() {
        this._byId.clear();
        this._byPosition.clear();
        this._busyStations.clear();
        for (const t of this.tasks) {
            this._byId.set(t.id, t);
            this._byPosition.set(this._posKey(t.x, t.y), t);
            if ((t.type === 'craft' || t.type === 'cook') && t.status === 'in_progress') {
                this._busyStations.add(this._posKey(t.x, t.y));
            }
        }
        this._pendingDirty = true;
    }

    remove(taskId) {
        const task = this._byId.get(taskId);
        if (!task) return;
        const idx = this.tasks.indexOf(task);
        if (idx >= 0) this.tasks.splice(idx, 1);
        this._byId.delete(taskId);
        this._byPosition.delete(this._posKey(task.x, task.y));
        this._busyStations.delete(this._posKey(task.x, task.y));
        this._pendingDirty = true;
    }

    // Called per colonist per tick. Linear scan over pending tasks; the winner
    // minimizes score = prio*10000 + dist, so colonist priority (lower number =
    // preferred) strictly dominates distance and distance only breaks ties within
    // a priority band. Any future spatial-index rewrite (Phase 6a) MUST reproduce
    // this exact ordering. _pending is a dirty-flagged snapshot, so status and
    // assignment are re-checked here in case they changed since it was built.
    findBestTask(colonist, tick) {
        const failedTasks = colonist._failedTasks;
        if (this._pendingDirty) {
            this._pending = this.tasks.filter(t => t.status === 'pending' && t.assignedTo === null);
            this._pendingDirty = false;
        }

        let best = null;
        let bestScore = Infinity;

        for (const t of this._pending) {
            // Re-check status since _pending is a cached snapshot
            if (t.status !== 'pending' || t.assignedTo !== null) continue;
            if (colonist.priorities[t.skillRequired] <= 0) continue;
            // Skip tasks this colonist recently failed to reach (30-tick cooldown)
            if (failedTasks && failedTasks[t.id] !== undefined && tick - failedTasks[t.id] < 30) continue;
            if ((t.type === 'craft' || t.type === 'cook') && this._busyStations.has(this._posKey(t.x, t.y))) continue;

            // Lower priority number = higher preference; multiplied to dominate over distance
            const prio = colonist.priorities[t.skillRequired];
            const dist = manhattanDist(colonist.x, colonist.y, t.x, t.y);
            const score = prio * 10000 + dist;

            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        }

        return best;
    }

    claim(taskId, colonistId) {
        const task = this._byId.get(taskId);
        if (task) {
            task.assignedTo = colonistId;
            task.status = 'in_progress';
            if (task.type === 'craft' || task.type === 'cook') {
                this._busyStations.add(this._posKey(task.x, task.y));
            }
            this._pendingDirty = true;
        }
    }

    release(taskId) {
        const task = this._byId.get(taskId);
        if (task) {
            if (task.type === 'craft' || task.type === 'cook') {
                this._busyStations.delete(this._posKey(task.x, task.y));
            }
            task.assignedTo = null;
            task.status = 'pending';
            task.workDone = 0;
            this._pendingDirty = true;
        }
    }

    complete(taskId) {
        const task = this._byId.get(taskId);
        if (!task) return;
        const idx = this.tasks.indexOf(task);
        if (idx >= 0) this.tasks.splice(idx, 1);
        this._byId.delete(taskId);
        this._byPosition.delete(this._posKey(task.x, task.y));
        this._busyStations.delete(this._posKey(task.x, task.y));
        this._pendingDirty = true;
    }

    getById(taskId) {
        return this._byId.get(taskId) || null;
    }

    getByPosition(x, y) {
        return this._byPosition.get(this._posKey(x, y)) || null;
    }

    getAssignedTo(colonistId) {
        return this.tasks.find(t => t.assignedTo === colonistId);
    }

    getPending() {
        return this.tasks.filter(t => t.status === 'pending');
    }

    getAll() {
        return this.tasks;
    }

    updatePosition(taskId, x, y) {
        const task = this._byId.get(taskId);
        if (task) {
            this._byPosition.delete(this._posKey(task.x, task.y));
            task.x = x;
            task.y = y;
            this._byPosition.set(this._posKey(x, y), task);
        }
    }
}

import { isPassable, getMoveCost, isPassableForEnemies, isBreakableByEnemies } from './map.js';
import { CONFIG, PATHFINDING_CONFIG } from '../core/config.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];//, [-1, -1], [1, 1], [1, -1], [-1, 1]];
const MAX_NODES = PATHFINDING_CONFIG.maxNodes;

// Binary min-heap keyed on f-score for A* open set.
// Duplicate entries are allowed: when a node's g-score improves, we push a new
// entry with the lower f. The stale duplicate is harmless — it will be popped
// later and skipped because the node is already in the closed set.
class MinHeap {
    constructor() {
        this.data = [];
    }

    push(node) {
        this.data.push(node);
        this._bubbleUp(this.data.length - 1);
    }

    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top;
    }

    get length() {
        return this.data.length;
    }

    _bubbleUp(i) {
        const node = this.data[i];
        while (i > 0) {
            const parentIdx = (i - 1) >> 1;
            if (this.data[parentIdx].f <= node.f) break;
            this.data[i] = this.data[parentIdx];
            i = parentIdx;
        }
        this.data[i] = node;
    }

    _sinkDown(i) {
        const length = this.data.length;
        const node = this.data[i];
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < length && this.data[left].f < this.data[smallest].f) smallest = left;
            if (right < length && this.data[right].f < this.data[smallest].f) smallest = right;
            if (smallest === i) break;
            this.data[i] = this.data[smallest];
            this.data[smallest] = node;
            i = smallest;
        }
    }
}

// Packs (x, y) into a single integer for use as a Map/Set key.
// Valid for coordinates 0..65535.
export function tileKey(x, y) {
    return (y << 16) | x;
}

export function manhattanDist(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// Core A* implementation. Accepts a passability/cost callback to support
// different movement rules (colonists, enemies, animals) without duplication.
// passabilityFn(map, x, y) => number|false:
//   - returns false if tile is impassable
//   - returns movement cost (>= 0) if passable
function findPathGeneric(map, startX, startY, endX, endY, passabilityFn) {
    if (startX === endX && startY === endY) return [];

    const open = new MinHeap();
    const closed = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    const start = tileKey(startX, startY);
    const end = tileKey(endX, endY);

    gScore.set(start, 0);
    open.push({ x: startX, y: startY, f: manhattanDist(startX, startY, endX, endY) });

    let iterations = 0;
    while (open.length > 0 && iterations < MAX_NODES) {
        iterations++;
        const current = open.pop();
        const currentKey = tileKey(current.x, current.y);

        // Skip stale duplicates that remained in the heap after a g-score update
        if (closed.has(currentKey)) continue;

        if (currentKey === end) {
            return reconstructPath(cameFrom, current.x, current.y, startX, startY);
        }

        closed.add(currentKey);

        for (const [dx, dy] of DIRS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const nKey = tileKey(nx, ny);

            if (closed.has(nKey)) continue;

            const cost = passabilityFn(map, nx, ny);
            if (cost === false) continue;

            const tentativeG = gScore.get(currentKey) + cost;
            if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentativeG);
                const f = tentativeG + manhattanDist(nx, ny, endX, endY);
                open.push({ x: nx, y: ny, f });
            }
        }
    }

    return null;
}

function colonistPassability(map, x, y) {
    if (!isPassable(map, x, y)) return false;
    return getMoveCost(map, x, y);
}

function enemyPassability(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    if (isBreakableByEnemies(map, x, y)) return getMoveCost(map, x, y) + PATHFINDING_CONFIG.breakableCostPenalty;
    if (!isPassableForEnemies(map, x, y)) return false;
    return getMoveCost(map, x, y);
}

export function findPath(map, startX, startY, endX, endY) {
    if (!isPassable(map, endX, endY)) return null;
    return findPathGeneric(map, startX, startY, endX, endY, colonistPassability);
}

export function findPathAdjacent(map, startX, startY, targetX, targetY) {
    let bestPath = null;
    for (const [dx, dy] of DIRS) {
        const ax = targetX + dx;
        const ay = targetY + dy;
        if (!isPassable(map, ax, ay)) continue;
        const path = findPath(map, startX, startY, ax, ay);
        if (path && (bestPath === null || path.length < bestPath.length)) {
            bestPath = path;
        }
    }
    return bestPath;
}

export function findPathForEnemies(map, startX, startY, endX, endY) {
    return findPathGeneric(map, startX, startY, endX, endY, enemyPassability);
}

function reconstructPath(cameFrom, endX, endY, startX, startY) {
    const path = [];
    const startKey = tileKey(startX, startY);
    let currentKey = tileKey(endX, endY);

    while (currentKey !== startKey) {
        path.push({ x: currentKey & 0xFFFF, y: currentKey >> 16 });
        const prev = cameFrom.get(currentKey);
        if (prev === undefined) break;
        currentKey = prev;
    }

    path.reverse();
    return path;
}

import { isPassable, getMoveCost, isPassableForEnemies, isBreakableByEnemies, isWalkableFurniture } from './map.js';
import { CONFIG, PATHFINDING_CONFIG, TERRAIN, BUILDINGS } from '../core/config.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];//, [-1, -1], [1, 1], [1, -1], [-1, 1]];
// Read live from config so runtime preset changes (world size selection) take effect.
function getMaxNodes() { return PATHFINDING_CONFIG.maxNodes; }

// Cheapest per-tile move cost anywhere in the game (terrain or floor). Terrain costs
// are 8+ per tile, so a raw Manhattan heuristic (1 per tile) is far below the true
// remaining cost and A* degenerates into Dijkstra, flooding a diamond of tiles as
// wide as the route is long. Scaling the heuristic by this lower bound keeps it
// admissible (paths stay optimal) while steering the search toward the goal.
let minMoveCost = null;
function getMinMoveCost() {
    if (minMoveCost !== null) return minMoveCost;
    let min = Infinity;
    for (const t of Object.values(TERRAIN)) {
        if (typeof t.moveCost === 'number' && t.moveCost > 0) min = Math.min(min, t.moveCost);
    }
    for (const b of Object.values(BUILDINGS)) {
        if (typeof b.moveCost === 'number' && b.moveCost > 0) min = Math.min(min, b.moveCost);
    }
    minMoveCost = Number.isFinite(min) ? min : 1;
    return minMoveCost;
}

// Set by every search: true when the last search gave up because it hit the node
// budget rather than because the goal is genuinely unreachable. Callers use it to
// avoid treating "too far to search" as "blocked" (see wasLastSearchExhausted).
let lastSearchExhausted = false;
export function wasLastSearchExhausted() { return lastSearchExhausted; }

// Binary min-heap keyed on f-score for A* open set.
// Duplicate entries are allowed: when a node's g-score improves, we push a new
// entry with the lower f. The stale duplicate is harmless. It will be popped
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
// The endpoint is exempt from any soft occupancy penalty inside the callback
// (see colonistPassability): we always want to reach the requested goal even
// if it happens to be occupied, and the penalty is only meant to bias the
// intermediate route around other entities.
//
// `goalKeys` (optional): Set of packed tile keys. When supplied the search ends at
// the first of them reached, and (endX, endY) is only the heuristic anchor: it
// must lie within 1 tile of every goal so `distance - 1` stays admissible.
function findPathGeneric(map, startX, startY, endX, endY, passabilityFn, goalKeys) {
    lastSearchExhausted = false;
    const start = tileKey(startX, startY);
    if (goalKeys ? goalKeys.has(start) : (startX === endX && startY === endY)) return [];

    const open = new MinHeap();
    const closed = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    const end = tileKey(endX, endY);
    const hScale = getMinMoveCost();
    const slack = goalKeys ? 1 : 0;
    const heuristic = (x, y) => Math.max(0, manhattanDist(x, y, endX, endY) - slack) * hScale;

    gScore.set(start, 0);
    open.push({ x: startX, y: startY, f: heuristic(startX, startY) });

    const maxNodes = getMaxNodes();
    let iterations = 0;
    while (open.length > 0) {
        if (iterations >= maxNodes) {
            lastSearchExhausted = true;
            return null;
        }
        iterations++;
        const current = open.pop();
        const currentKey = tileKey(current.x, current.y);

        // Skip stale duplicates that remained in the heap after a g-score update
        if (closed.has(currentKey)) continue;

        if (goalKeys ? goalKeys.has(currentKey) : currentKey === end) {
            return reconstructPath(cameFrom, current.x, current.y, startX, startY);
        }

        closed.add(currentKey);

        for (const [dx, dy] of DIRS) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const nKey = tileKey(nx, ny);

            if (closed.has(nKey)) continue;

            const cost = passabilityFn(map, nx, ny, endX, endY);
            if (cost === false) continue;

            const tentativeG = gScore.get(currentKey) + cost;
            if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentativeG);
                open.push({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny) });
            }
        }
    }

    return null;
}

// Soft penalty for walking through (walkable) furniture, so routes prefer open
// tiles and only cut through furniture when it's clearly the shortest option. The
// path's own endpoint is exempt: a colonist must still be able to target the
// furniture tile itself (e.g. a bed to sleep in, a workbench to craft at).
function furniturePenalty(map, x, y, endX, endY) {
    if ((x !== endX || y !== endY) && isWalkableFurniture(map, x, y)) {
        return PATHFINDING_CONFIG.furnitureCostPenalty;
    }
    return 0;
}

function colonistPassability(map, x, y, endX, endY) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    if (!isPassable(map, x, y)) return false;
    return getMoveCost(map, x, y) + furniturePenalty(map, x, y, endX, endY);
}

// Builds a colonist passability callback that adds a soft cost penalty to tiles
// currently occupied by another entity, so A* prefers routing around others but
// still walks through occupancy when no better route exists. The path's own
// endpoint is exempt. A colonist must still be able to reach a goal tile even
// if it is momentarily occupied. `occupied` is a Set of packed tile keys
// (see tileKey); when absent, behavior is identical to colonistPassability.
function makeColonistPassability(occupied) {
    if (!occupied) return colonistPassability;
    return function (map, x, y, endX, endY) {
        if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
        if (!isPassable(map, x, y)) return false;
        let cost = getMoveCost(map, x, y) + furniturePenalty(map, x, y, endX, endY);
        if ((x !== endX || y !== endY) && occupied.has(tileKey(x, y))) {
            cost += PATHFINDING_CONFIG.occupiedCostPenalty;
        }
        return cost;
    };
}

function enemyPassability(map, x, y, endX, endY) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    if (isBreakableByEnemies(map, x, y)) return getMoveCost(map, x, y) + PATHFINDING_CONFIG.breakableCostPenalty;
    if (x === endX && y === endY) return 1; // goal tile always reachable (e.g. void_nexus target)
    if (!isPassableForEnemies(map, x, y)) return false;
    return getMoveCost(map, x, y) + furniturePenalty(map, x, y, endX, endY);
}

// `occupied` (optional): Set of packed tile keys (see tileKey) currently held by
// other entities. When supplied, occupied tiles get a soft cost penalty so the
// route avoids them where possible, stepping through only as a last resort.
export function findPath(map, startX, startY, endX, endY, occupied) {
    if (!isPassable(map, endX, endY)) {
        lastSearchExhausted = false;
        return null;
    }
    return findPathGeneric(map, startX, startY, endX, endY, makeColonistPassability(occupied));
}

// `occupied` (optional): see findPath. One search runs to the nearest passable
// neighbour of the target (rather than one search per neighbour, which multiplied
// the cost of every failure by 4). The goal tiles get no endpoint exemption, so
// occupied or furniture-filled standing tiles pay their normal soft penalty and
// colonists spread across distinct adjacent tiles rather than stacking.
// Returns null when no neighbour is reachable; check wasLastSearchExhausted() to
// tell "blocked" from "search budget exhausted".
export function findPathAdjacent(map, startX, startY, targetX, targetY, occupied) {
    const goalKeys = new Set();
    for (const [dx, dy] of DIRS) {
        const ax = targetX + dx;
        const ay = targetY + dy;
        if (isPassable(map, ax, ay)) goalKeys.add(tileKey(ax, ay));
    }
    if (goalKeys.size === 0) {
        lastSearchExhausted = false;
        return null;
    }
    // (-1, -1) as the passability "endpoint" disables the endpoint exemption.
    const passability = makeColonistPassability(occupied);
    return findPathGeneric(map, startX, startY, targetX, targetY,
        (m, x, y) => passability(m, x, y, -1, -1), goalKeys);
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

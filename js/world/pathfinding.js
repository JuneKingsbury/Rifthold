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

// Binary min-heap keyed on f-score for A* open set, storing tile indices in
// parallel typed arrays so a search allocates nothing per push.
// Duplicate entries are allowed: when a node's g-score improves, we push a new
// entry with the lower f. The stale duplicate is harmless. It will be popped
// later and skipped because the node is already in the closed set.
class IndexMinHeap {
    constructor(capacity = 1024) {
        this.idx = new Int32Array(capacity);
        this.f = new Float64Array(capacity);
        this.length = 0;
    }

    clear() {
        this.length = 0;
    }

    _grow() {
        const idx = new Int32Array(this.idx.length * 2);
        const f = new Float64Array(this.f.length * 2);
        idx.set(this.idx);
        f.set(this.f);
        this.idx = idx;
        this.f = f;
    }

    push(node, f) {
        if (this.length === this.idx.length) this._grow();
        let i = this.length++;
        const idx = this.idx, fs = this.f;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (fs[p] <= f) break;
            idx[i] = idx[p];
            fs[i] = fs[p];
            i = p;
        }
        idx[i] = node;
        fs[i] = f;
    }

    // Removes and returns the tile index with the lowest f.
    pop() {
        const idx = this.idx, fs = this.f;
        const top = idx[0];
        const n = --this.length;
        if (n > 0) {
            const node = idx[n], f = fs[n];
            let i = 0;
            while (true) {
                const l = 2 * i + 1;
                const r = l + 1;
                let s = i;
                let sf = f;
                if (l < n && fs[l] < sf) { s = l; sf = fs[l]; }
                if (r < n && fs[r] < sf) { s = r; }
                if (s === i) break;
                idx[i] = idx[s];
                fs[i] = fs[s];
                i = s;
            }
            idx[i] = node;
            fs[i] = f;
        }
        return top;
    }
}

// Per-tile search state shared by every search (searches never nest), indexed
// y * W + x. `stamp` marks which search last touched a tile, so stale g-scores
// and closed flags from earlier searches are ignored without clearing the arrays.
let gridW = 0, gridH = 0;
let searchGen = 0;
let stamp = null;      // Uint32Array: search generation that wrote gScore/cameFrom
let closedGen = null;  // Uint32Array: search generation that closed the tile
let gScoreArr = null;  // Float64Array
let cameFromArr = null; // Int32Array
const openHeap = new IndexMinHeap();

function beginSearch(w, h) {
    if (w !== gridW || h !== gridH || !stamp) {
        gridW = w;
        gridH = h;
        const n = w * h;
        stamp = new Uint32Array(n);
        closedGen = new Uint32Array(n);
        gScoreArr = new Float64Array(n);
        cameFromArr = new Int32Array(n);
        searchGen = 0;
    }
    searchGen++;
    if (searchGen === 0xFFFFFFFF) {
        stamp.fill(0);
        closedGen.fill(0);
        searchGen = 1;
    }
    openHeap.clear();
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
//
// `opts` (optional): { hScale, goalStepCost, maxNodes }. hScale overrides the
// per-tile heuristic weight (default getMinMoveCost()). goalStepCost is a lower
// bound on the cost of stepping onto the goal when that is cheaper than hScale
// (enemy searches enter their goal at cost 1), keeping the heuristic admissible
// on the final step. maxNodes overrides the node budget.
function findPathGeneric(map, startX, startY, endX, endY, passabilityFn, goalKeys, opts) {
    lastSearchExhausted = false;
    if (goalKeys ? goalKeys.has(tileKey(startX, startY)) : (startX === endX && startY === endY)) return [];

    const H = map.length;
    const W = H > 0 ? map[0].length : 0;
    if (startX < 0 || startX >= W || startY < 0 || startY >= H) return null;
    beginSearch(W, H);
    const gen = searchGen;

    const hScale = opts && opts.hScale !== undefined ? opts.hScale : getMinMoveCost();
    const slack = goalKeys ? 1 : 0;
    const lastStep = opts && opts.goalStepCost !== undefined ? Math.min(opts.goalStepCost, hScale) : hScale;
    const heuristic = (x, y) => {
        const d = Math.max(0, Math.abs(x - endX) + Math.abs(y - endY) - slack);
        return d > 0 ? (d - 1) * hScale + lastStep : 0;
    };

    const start = startY * W + startX;
    const end = (endX >= 0 && endX < W && endY >= 0 && endY < H) ? endY * W + endX : -1;
    stamp[start] = gen;
    gScoreArr[start] = 0;
    cameFromArr[start] = -1;
    openHeap.push(start, heuristic(startX, startY));

    const maxNodes = opts && opts.maxNodes !== undefined ? Math.min(opts.maxNodes, getMaxNodes()) : getMaxNodes();
    let iterations = 0;
    while (openHeap.length > 0) {
        if (iterations >= maxNodes) {
            lastSearchExhausted = true;
            return null;
        }
        iterations++;
        const current = openHeap.pop();

        // Skip stale duplicates that remained in the heap after a g-score update
        if (closedGen[current] === gen) continue;

        const cx = current % W;
        const cy = (current - cx) / W;
        if (goalKeys ? goalKeys.has(tileKey(cx, cy)) : current === end) {
            return reconstructPath(current, start, W);
        }

        closedGen[current] = gen;
        const currentG = gScoreArr[current];

        for (let d = 0; d < DIRS.length; d++) {
            const nx = cx + DIRS[d][0];
            const ny = cy + DIRS[d][1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const n = ny * W + nx;

            if (closedGen[n] === gen) continue;

            const cost = passabilityFn(map, nx, ny, endX, endY);
            if (cost === false) continue;

            const tentativeG = currentG + cost;
            if (stamp[n] !== gen || tentativeG < gScoreArr[n]) {
                stamp[n] = gen;
                cameFromArr[n] = current;
                gScoreArr[n] = tentativeG;
                openHeap.push(n, tentativeG + heuristic(nx, ny));
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

// The goal tile is entered at cost 1 (see enemyPassability), below the usual
// per-tile heuristic weight, so the last step's heuristic is capped to match.
// `maxNodes` (optional) lowers the node budget for callers that search often.
export function findPathForEnemies(map, startX, startY, endX, endY, maxNodes) {
    return findPathGeneric(map, startX, startY, endX, endY, enemyPassability, null, { goalStepCost: 1, maxNodes });
}

// Unit-cost search for simple movers (role-driven raiders, guards, pets). Every
// step costs 1, `passCheck(map, x, y)` decides passability, and the goal tile is
// always enterable (it is usually occupied by the entity being approached).
// `maxNodes` bounds the search. Check wasLastSearchExhausted() on null. The
// heuristic is weighted by a hair over 1 so ties on open ground resolve toward
// the goal instead of flooding the bounding box; paths stay shortest for any
// route under 1000 steps.
export function findPathUniform(map, startX, startY, endX, endY, passCheck, maxNodes) {
    const passability = (m, x, y) => {
        if (x === endX && y === endY) return 1;
        return passCheck(m, x, y) ? 1 : false;
    };
    return findPathGeneric(map, startX, startY, endX, endY, passability, null, { hScale: 1.001, maxNodes });
}

function reconstructPath(endIdx, startIdx, W) {
    const path = [];
    let current = endIdx;

    while (current !== startIdx && current !== -1) {
        const x = current % W;
        path.push({ x, y: (current - x) / W });
        current = cameFromArr[current];
    }

    path.reverse();
    return path;
}

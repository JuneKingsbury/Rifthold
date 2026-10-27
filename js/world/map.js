import { CONFIG, WALL_STRUCTURES, DOOR_STRUCTURES, TILE_CHARS, TILE_COLORS, TERRAIN, RESOURCES, BUILDINGS, IMPASSABLE_STRUCTURES, ENEMY_BLOCKED_STRUCTURES, BREAKABLE_STRUCTURES, FURNITURE_STRUCTURES, MAP_GENERATORS, BIOMES, BIOME_TRANSITIONS, GRASS_TERRAIN, LANDMARK_BLUEPRINTS, CRYPT_CONFIG, CRYPT_BLUEPRINTS, RUIN_LOOT, CROPS } from '../core/config.js';

// Background of a sealed (unexplored) crypt tile, shared by the renderer.
export const SEALED_BG = '#050507';

export function createTile(terrain) {
    return {
        terrain,
        structure: null,
        floor: null,
        resource: null,
        designation: null,
        zone: null,
        items: [],
        passable: TERRAIN[terrain] ? TERRAIN[terrain].passable.colonist : true,
        roomId: null,
        onFire: false,
        fireTimer: 0,
        snowCovered: false,
    };
}

// --- Generator registry: add new generator functions here ---
const GENERATOR_FUNCTIONS = {
    biome_layout: generateBiomeLayout,
    dirt_patches: generateDirtPatches,
    rock_formations: generateRockFormations,
    mountain_ranges: generateMountainRanges,
    trees: generateTrees,
    river: generateRiver,
    ruins: generateRuins,
    crypts: generateCrypts,
};

// Footprints of every ruin the current generateMap run placed (landmarks and generic
// ruins). generateMap returns only the tile grid, so the game takes these through
// takeGeneratedRuins() to seed its saved ruin registry.
let generatedRuins = [];

export function takeGeneratedRuins() {
    const out = generatedRuins;
    generatedRuins = [];
    return out;
}

export function generateMap() {
    placedLandmarks = [];
    generatedRuins = [];
    const map = [];
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            map[y][x] = createTile('grass');
        }
    }

    for (const gen of MAP_GENERATORS) {
        if (!gen.enabled) continue;
        const fn = GENERATOR_FUNCTIONS[gen.name];
        if (fn) fn(map, gen.params);
    }

    clearStartingArea(map);
    restoreLandmarkRituals(map);
    // Last, so nothing painted above (start-area clearing, landmark and ruin floors)
    // can leave water touching normal terrain.
    generateWaterShores(map);
    return map;
}

// --- Generator implementations ---

// Cheap seeded value noise: maps (x,y,seed) → [0,1). No external deps.
function valueNoise(x, y, seed) {
    let h = (x * 1619 + y * 31337 + seed * 1000003) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
}

// Smooth value noise in [0,1): valueNoise on an integer lattice `cell` tiles
// apart, bilinearly interpolated with a smoothstep. Unlike raw valueNoise, nearby
// tiles get nearby values, so thresholding it yields coherent patches.
function smoothNoise(x, y, seed, cell) {
    const gx = x / cell, gy = y / cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = valueNoise(x0,     y0,     seed), b = valueNoise(x0 + 1, y0,     seed);
    const c = valueNoise(x0,     y0 + 1, seed), d = valueNoise(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

// Two octaves of smoothNoise (the second at half the cell size) for ragged,
// natural-looking edges on top of the broad shape. Result stays in [0,1).
function fbmNoise(x, y, seed, cell) {
    return (smoothNoise(x, y, seed, cell) + 0.5 * smoothNoise(x, y, seed + 1, cell / 2)) / 1.5;
}

// Weighted random pick from {key: weight} table using a [0,1) value.
function weightedPick(weights, rng) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let t = rng * total;
    for (const [k, w] of Object.entries(weights)) {
        t -= w;
        if (t <= 0) return k;
    }
    return Object.keys(weights)[0];
}

// Shuffles an array in-place using the given RNG function that returns [0,1).
function fisherYates(arr, rngFn) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rngFn() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// Main biome layout generator. Assigns tile.biome, paints terrain, places
// biome-specific resources, places biome river, and places one landmark ruin
// per biome. Runs before all other generators so they can layer on top.
//
// Biome assignment uses domain-warped Voronoi: scatter N seed points per biome
// across the map (outside the center grassland reserve), then for each tile
// displace its lookup coordinates with smooth low-frequency noise before finding the
// nearest seed. This produces organic blob-shaped biomes that can appear
// anywhere on the map (Terraria-style) rather than fixed angular wedges.
function generateBiomeLayout(map, params) {
    const W = CONFIG.MAP_WIDTH;
    const H = CONFIG.MAP_HEIGHT;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) / 2;
    const seed = (Math.random() * 0x7fffffff) | 0;

    // Spread Voronoi seed points for the 5 outer biomes.
    // Seeds are placed randomly across the map but must be outside the center
    // grassland reserve and at least (W/6) apart from each other to ensure
    // all biomes get reasonable territory.
    const outerBiomeKeys = ['forest', 'mountain', 'swamp', 'desert', 'tundra'];
    const N = params.seedsPerBiome;
    const minSeedDist = Math.min(W, H) / 6;
    const innerGuard = maxR * params.innerRadius * (1 + params.innerJitter) * 1.2; // keep seeds clear of the widest lobe
    const seeds = []; // [{x, y, biome}]

    let rngState = seed;
    const lcg = () => {
        rngState = (rngState * 1664525 + 1013904223) | 0;
        return (rngState >>> 0) / 0x100000000;
    };

    // Extra grassland regions sit on a ring around the centre, spread out by angle.
    // Placed first so the outer biomes' seeds keep clear of them.
    const grassCount = params.grasslandSeeds || 0;
    const grassAngle0 = lcg() * Math.PI * 2;
    for (let k = 0; k < grassCount; k++) {
        const a = grassAngle0 + k * (Math.PI * 2 / grassCount) + (lcg() - 0.5);
        const r = (0.38 + lcg() * 0.22) * maxR;
        const gx = Math.max(8, Math.min(W - 9, Math.round(cx + Math.cos(a) * r)));
        const gy = Math.max(8, Math.min(H - 9, Math.round(cy + Math.sin(a) * r)));
        seeds.push({ x: gx, y: gy, biome: 'grassland' });
    }

    for (const biomeKey of outerBiomeKeys) {
        let placed = 0;
        let attempts = 0;
        while (placed < N && attempts < 200) {
            attempts++;
            const sx = Math.floor(lcg() * W);
            const sy = Math.floor(lcg() * H);
            const distCenter = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
            if (distCenter < innerGuard) continue;
            // Reject if too close to any existing seed (prevents clumping).
            const tooClose = seeds.some(s => Math.sqrt((s.x - sx) ** 2 + (s.y - sy) ** 2) < minSeedDist);
            if (tooClose) continue;
            seeds.push({ x: sx, y: sy, biome: biomeKey });
            placed++;
        }
    }

    // Assign biome to every tile using domain-warped Voronoi.
    const warp = params.warpScale;
    const biomeMap = [];
    for (let y = 0; y < H; y++) {
        biomeMap[y] = [];
        for (let x = 0; x < W; x++) {
            const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            // The central grassland's edge wanders in and out with smooth noise
            // rather than following a perfect circle. fbmNoise clusters around 0.5,
            // so the (n - 0.5) * 2 term is scaled up to use the full jitter range.
            const edgeNoise = (fbmNoise(x, y, seed + 303, params.innerCell) - 0.5) * 2;
            const innerR = maxR * params.innerRadius * (1 + params.innerJitter * edgeNoise * 1.6);
            if (distCenter < innerR) {
                biomeMap[y][x] = 'grassland';
                continue;
            }

            // Domain warp: displace lookup coords with two noise samples.
            // Smooth noise (not per-tile hash noise) so neighbouring tiles are
            // displaced together; otherwise biome borders dissolve into speckle.
            const wx = x + (fbmNoise(x, y, seed + 101, params.warpCell) - 0.5) * 2 * warp;
            const wy = y + (fbmNoise(x, y, seed + 202, params.warpCell) - 0.5) * 2 * warp;

            // Nearest Voronoi seed in warped space.
            let nearestBiome = 'grassland';
            let nearestDist = Infinity;
            for (const s of seeds) {
                // Dividing by areaWeight^2 makes heavier biomes win more of the map.
                const w = BIOMES[s.biome].areaWeight ?? 1;
                const d = ((wx - s.x) ** 2 + (wy - s.y) ** 2) / (w * w);
                if (d < nearestDist) { nearestDist = d; nearestBiome = s.biome; }
            }
            biomeMap[y][x] = nearestBiome;
        }
    }

    // Guarantee every sizeable grassland region is attached to the centre. The
    // Voronoi cells (plus the warp) can leave a region, or a fragment of one, cut
    // off, so for each such region carve a wandering corridor from the centre to its
    // nearest tile. Fragments under MIN_REGION tiles are left as they are.
    const MIN_REGION = 80;
    for (let pass = 0; pass < 8; pass++) {
        const connected = _floodBiome(biomeMap, W, H, Math.round(cx), Math.round(cy), 'grassland');
        let target = null;
        for (let y = 0; y < H && !target; y++) {
            for (let x = 0; x < W && !target; x++) {
                if (biomeMap[y][x] !== 'grassland' || connected.has(y * W + x)) continue;
                const region = _floodBiome(biomeMap, W, H, x, y, 'grassland');
                if (region.size < MIN_REGION) {
                    // Too small to matter: mark seen by treating it as handled this pass.
                    for (const k of region) connected.add(k);
                    continue;
                }
                let best = Infinity;
                for (const k of region) {
                    const rx = k % W, ry = (k - rx) / W;
                    const d = (rx - cx) ** 2 + (ry - cy) ** 2;
                    if (d < best) { best = d; target = { x: rx, y: ry }; }
                }
            }
        }
        if (!target) break;
        _carveGrasslandCorridor(biomeMap, W, H, cx, cy, target.x, target.y, seed + pass);
    }

    // Paint terrain as coherent patches. Each tile gets a smooth noise value from
    // its own biome's field; within a biome the values are ranked and split at the
    // cumulative terrainWeights, so the mix matches the weights exactly while
    // each terrain forms contiguous patches rather than per-tile speckle.
    const biomeKeys = Object.keys(BIOMES);
    const field = [];
    const valuesByBiome = {};
    for (let y = 0; y < H; y++) {
        field[y] = [];
        for (let x = 0; x < W; x++) {
            const biome = biomeMap[y][x];
            const v = fbmNoise(x, y, seed + 500 * (biomeKeys.indexOf(biome) + 1), BIOMES[biome].patchScale);
            field[y][x] = v;
            (valuesByBiome[biome] ||= []).push(v);
        }
    }
    const bandCutoffs = {}; // biome -> [{terrain, max}], ascending
    for (const [biome, values] of Object.entries(valuesByBiome)) {
        values.sort((p, q) => p - q);
        const weights = BIOMES[biome].terrainWeights;
        const total = Object.values(weights).reduce((p, q) => p + q, 0);
        let cum = 0;
        bandCutoffs[biome] = Object.entries(weights).map(([terrain, w]) => {
            cum += w / total;
            return { terrain, max: values[Math.min(values.length - 1, Math.floor(cum * values.length))] };
        });
        bandCutoffs[biome][bandCutoffs[biome].length - 1].max = Infinity;
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            const biome = biomeMap[y][x];
            const terrainKey = bandCutoffs[biome].find(band => field[y][x] <= band.max).terrain;
            tile.terrain = terrainKey;
            tile.passable = TERRAIN[terrainKey].passable.colonist;
            tile.biome = biome;
        }
    }

    // Neutral strip between clashing biomes (see BIOME_TRANSITIONS). Width varies
    // per tile so the strip's edges stay ragged. Reads biomeMap only, so the
    // result doesn't depend on scan order.
    const tw = params.transitionWidth;
    if (tw > 0) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const biome = biomeMap[y][x];
                const reach = 1 + Math.floor(valueNoise(x + 20000, y + 20000, seed) * tw);
                let strip = null;
                for (let ny = Math.max(0, y - reach); ny <= Math.min(H - 1, y + reach) && !strip; ny++) {
                    for (let nx = Math.max(0, x - reach); nx <= Math.min(W - 1, x + reach); nx++) {
                        const nb = biomeMap[ny][nx];
                        if (nb === biome) continue;
                        strip = BIOME_TRANSITIONS[[biome, nb].sort().join('|')];
                        if (strip) break;
                    }
                }
                if (strip) {
                    map[y][x].terrain = strip;
                    map[y][x].passable = TERRAIN[strip].passable.colonist;
                }
            }
        }
    }

    // Place trees biome-specifically.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (!GRASS_TERRAIN.has(tile.terrain)) continue;
            const biomeDef = BIOMES[tile.biome];
            if (!biomeDef || !biomeDef.treeDensity) continue;
            if (valueNoise(x + 40000, y + 40000, seed) < biomeDef.treeDensity) {
                tile.resource = { type: 'tree', amount: 3 + Math.floor(valueNoise(x + 50000, y + 50000, seed) * 3) };
            }
        }
    }

    // Place rock resources in mountain biome (stone, iron, runite).
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.biome !== 'mountain') continue;
            if (tile.terrain !== 'rock') continue;
            if (valueNoise(x + 60000, y + 60000, seed) < 0.35) {
                const roll = valueNoise(x + 61000, y + 61000, seed);
                let type, amount;
                if (roll < 0.20) { type = 'runite_ore'; amount = 2 + Math.floor(valueNoise(x + 62000, y + 62000, seed) * 2); }
                else if (roll < 0.50) { type = 'iron_ore'; amount = 2 + Math.floor(valueNoise(x + 63000, y + 63000, seed) * 3); }
                else { type = 'stone'; amount = 3 + Math.floor(valueNoise(x + 64000, y + 64000, seed) * 3); }
                tile.resource = { type, amount };
            }
        }
    }

    // Desert: rare iron_ore in red_rock tiles.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.biome !== 'desert' || tile.terrain !== 'red_rock') continue;
            if (valueNoise(x + 70000, y + 70000, seed) < 0.15) {
                tile.resource = { type: 'iron_ore', amount: 2 + Math.floor(valueNoise(x + 71000, y + 71000, seed) * 2) };
            }
        }
    }

    // Tundra: stone deposits and rare runite on rock/gravel.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.biome !== 'tundra') continue;
            if (tile.terrain !== 'rock' && tile.terrain !== 'gravel') continue;
            if (valueNoise(x + 80000, y + 80000, seed) < 0.25) {
                const roll = valueNoise(x + 81000, y + 81000, seed);
                let type, amount;
                if (roll < 0.15) { type = 'runite_ore'; amount = 2 + Math.floor(valueNoise(x + 82000, y + 82000, seed) * 2); }
                else { type = 'stone'; amount = 3 + Math.floor(valueNoise(x + 83000, y + 83000, seed) * 3); }
                tile.resource = { type, amount };
            }
        }
    }

    // Place biome-scoped river: originate near mountain centroid, flow toward swamp centroid.
    _placeBiomeRiver(map, biomeMap, W, H, cx, cy);

    // On large maps (384+) add a second river on the forest→tundra axis.
    if (W >= 384) _placeBiomeRiver(map, biomeMap, W, H, cx, cy, 'forest', 'tundra');

    // Scatter ponds weighted by biome.
    _placePonds(map, biomeMap, W, H, seed);

    // Desert oases (water, grass, and trees in the sand).
    _placeOases(map, biomeMap, W, H, seed, params);

    // Place one landmark ruin per biome.
    _placeBiomeLandmarks(map, biomeMap, W, H, seed);
}

// Returns the set of tile indices (y * W + x) 4-connected to (sx, sy) that hold `biome`.
function _floodBiome(biomeMap, W, H, sx, sy, biome) {
    const seen = new Set();
    if (biomeMap[sy]?.[sx] !== biome) return seen;
    const stack = [sy * W + sx];
    seen.add(stack[0]);
    while (stack.length) {
        const idx = stack.pop();
        const x = idx % W, y = (idx - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const k = ny * W + nx;
            if (seen.has(k) || biomeMap[ny][nx] !== biome) continue;
            seen.add(k);
            stack.push(k);
        }
    }
    return seen;
}

// Paints a grassland corridor, about 6-9 tiles wide, from (x0, y0) to (x1, y1).
// The path wobbles sideways with smooth noise (zero at both ends) and its width
// varies, so it reads as a natural neck between two grassy areas, not a road.
function _carveGrasslandCorridor(biomeMap, W, H, x0, y0, x1, y1, seed) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len; // unit normal to the path
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const taper = Math.sin(t * Math.PI);
        const wobble = (smoothNoise(t * len, 0, seed + 404, 14) - 0.5) * 2 * 10 * taper;
        const px = x0 + (x1 - x0) * t + nx * wobble;
        const py = y0 + (y1 - y0) * t + ny * wobble;
        const r = 3.2 + smoothNoise(t * len, 7, seed + 505, 8) * 1.8;
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
            for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
                const tx = Math.round(px) + dx, ty = Math.round(py) + dy;
                if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
                if (dx * dx + dy * dy <= r * r) biomeMap[ty][tx] = 'grassland';
            }
        }
    }
}

// Computes the approximate centroid (x,y) of a biome region on the map.
function _biomeCentroid(biomeKey, biomeMap, W, H) {
    let sx = 0, sy = 0, count = 0;
    // Sample every 4th tile for speed.
    for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
            if (biomeMap[y][x] === biomeKey) { sx += x; sy += y; count++; }
        }
    }
    if (count === 0) return { x: Math.floor(W / 2), y: 0 };
    return { x: Math.floor(sx / count), y: Math.floor(sy / count) };
}

// Projects a point (px,py) outward from map center (cx,cy) until it hits a
// map edge, then clamps to [margin, dim-1-margin] on that edge.
function _projectToEdge(px, py, cx, cy, W, H, margin) {
    const dx = px - cx, dy = py - cy;
    if (dx === 0 && dy === 0) return { x: margin, y: margin };
    const tx = dx !== 0 ? (dx > 0 ? (W - 1 - cx) : -cx) / dx : Infinity;
    const ty = dy !== 0 ? (dy > 0 ? (H - 1 - cy) : -cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    return {
        x: Math.max(margin, Math.min(W - 1 - margin, Math.round(cx + dx * t))),
        y: Math.max(margin, Math.min(H - 1 - margin, Math.round(cy + dy * t))),
    };
}

// Returns which map edge ('top','bottom','left','right') a border point is on.
function _whichEdge(pt, margin, W, H) {
    if (pt.y <= margin)         return 'top';
    if (pt.y >= H - 1 - margin) return 'bottom';
    if (pt.x <= margin)         return 'left';
    return 'right';
}

// Snaps a point onto the edge opposite to `edge`, using the point's transverse
// coordinate to choose where along that edge it lands.
function _snapToOppositeEdge(pt, edge, margin, W, H) {
    switch (edge) {
        case 'top':    return { x: Math.max(margin, Math.min(W - 1 - margin, pt.x)), y: H - 1 - margin };
        case 'bottom': return { x: Math.max(margin, Math.min(W - 1 - margin, pt.x)), y: margin };
        case 'left':   return { x: W - 1 - margin, y: Math.max(margin, Math.min(H - 1 - margin, pt.y)) };
        case 'right':  return { x: margin,          y: Math.max(margin, Math.min(H - 1 - margin, pt.y)) };
    }
}

// Biome-aware river: enters from the map edge nearest sourceBiome and exits at
// the edge nearest targetBiome. Guaranteed to use two different edges so the
// river always crosses the map.
function _placeBiomeRiver(map, biomeMap, W, H, cx, cy, sourceBiome = 'mountain', targetBiome = 'swamp') {
    const mountain = _biomeCentroid(sourceBiome, biomeMap, W, H);
    const swamp    = _biomeCentroid(targetBiome, biomeMap, W, H);

    const margin = 3;
    const start     = _projectToEdge(mountain.x, mountain.y, cx, cy, W, H, margin);
    let   end       = _projectToEdge(swamp.x,    swamp.y,    cx, cy, W, H, margin);
    const startEdge = _whichEdge(start, margin, W, H);
    if (_whichEdge(end, margin, W, H) === startEdge) {
        end = _snapToOppositeEdge(end, startEdge, margin, W, H);
    }

    // Walk from start to end with a drunkard's meander biased toward the target.
    let rx = start.x, ry = start.y;
    const visited = new Set();

    // We need enough steps to cross the full diagonal.
    const maxSteps = (W + H) * 2;
    for (let step = 0; step < maxSteps; step++) {
        const width = 1 + Math.floor(Math.random() * 2);
        // Paint a perpendicular stripe at the current position.
        const horizontal = Math.abs(end.x - start.x) < Math.abs(end.y - start.y);
        for (let dw = -width; dw <= width; dw++) {
            const px = rx + (horizontal ? dw : 0);
            const py = ry + (horizontal ? 0 : dw);
            if (px >= 0 && px < W && py >= 0 && py < H) {
                map[py][px] = createTile('water');
                map[py][px].biome = biomeMap[py][px];
                visited.add((py << 16) | px);
            }
        }

        const distX = end.x - rx, distY = end.y - ry;
        if (Math.abs(distX) + Math.abs(distY) <= 1) break;

        // Advance one step toward the exit edge, with random perpendicular drift.
        if (Math.abs(distX) >= Math.abs(distY)) {
            rx += Math.sign(distX);
            ry += Math.floor(Math.random() * 3) - 1;
        } else {
            ry += Math.sign(distY);
            rx += Math.floor(Math.random() * 3) - 1;
        }
        rx = Math.max(0, Math.min(W - 1, rx));
        ry = Math.max(0, Math.min(H - 1, ry));
    }
    // Ensure we actually reach the exit tile.
    map[end.y][end.x] = createTile('water');
    map[end.y][end.x].biome = biomeMap[end.y][end.x];
    visited.add((end.y << 16) | end.x);

    // River banks, innermost first: a shallow-water rim hugging the deep channel,
    // then the biome's inner shore terrain, then its optional outer ring.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.terrain === 'water' || tile.terrain === 'rock' || tile.terrain === 'tall_rock' ||
                tile.terrain === 'mud' || tile.terrain === 'shallow_water') continue;
            let minDist = Infinity;
            for (let dy2 = -3; dy2 <= 3; dy2++) {
                for (let dx2 = -3; dx2 <= 3; dx2++) {
                    if (visited.has(((y + dy2) << 16) | (x + dx2))) {
                        const d = Math.abs(dx2) + Math.abs(dy2);
                        if (d < minDist) minDist = d;
                    }
                }
            }
            const shore = BIOMES[biomeMap[y][x]].shore;
            if (minDist === 1 && Math.random() < 0.9) { tile.terrain = 'shallow_water'; tile.resource = null; }
            else if (minDist === 2 && Math.random() < 0.85) { tile.terrain = shore.inner; tile.resource = null; }
            else if (minDist === 3 && shore.outer && Math.random() < 0.5) { tile.terrain = shore.outer; tile.resource = null; }
        }
    }
}

// Scatter ponds (circular water blobs) across the map, weighted by biome.
// Swamp and grassland get the most; mountain, desert, and tundra get very few.
const POND_BIOME_CHANCE = {
    swamp:     0.85,
    grassland: 0.55,
    forest:    0.45,
    tundra:    0.15,
    mountain:  0.08,
    desert:    0.05,
};

// Paints one organic body of deep water centred on (cx2, cy2) and returns the tiles
// it covers plus how far (in tiles) it can reach from the centre. `i` varies the
// shape between bodies of water.
function _paintOrganicWater(map, W, H, cx2, cy2, radius, i, seed) {
    // Organic outline: each pond is a circle stretched into an ellipse (random
    // angle, up to ~1.7:1), whose edge is then pushed in and out by smooth noise
    // so it forms lobes and bays. A little per-tile jitter keeps the rim ragged.
    const angle = valueNoise(i, 4, seed + 95000) * Math.PI;
    const squash = Math.sqrt(1 + valueNoise(i, 5, seed + 96000) * 0.7);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const lobeSeed = seed + 97000 + i * 13;
    const extent = Math.ceil(radius * 1.9) + 1;
    const waterTiles = [];
    for (let dy = -extent; dy <= extent; dy++) {
        for (let dx = -extent; dx <= extent; dx++) {
            const nx = cx2 + dx, ny = cy2 + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const u = dx * cosA + dy * sinA;
            const v = -dx * sinA + dy * cosA;
            const dist = Math.sqrt((u / squash) ** 2 + (v * squash) ** 2);
            const lobe = (smoothNoise(nx, ny, lobeSeed, 5) + 0.5 * smoothNoise(nx, ny, lobeSeed + 1, 2.5)) / 1.5;
            // Same -0.5 .. -0.75 average shrink the old circular ponds had, so
            // pond size stays about where it was.
            const edge = radius * (1 + 0.6 * (lobe - 0.5) * 2) - 0.5 - valueNoise(nx + 94000, ny + 94000, seed) * 0.5;
            if (dist > edge) continue;
            // Don't overwrite hard terrain.
            const t = map[ny][nx];
            if (t.terrain === 'tall_rock') continue;
            t.terrain = 'water';
            t.passable = TERRAIN.water.passable.colonist;
            t.resource = null;
            waterTiles.push({ x: nx, y: ny });
        }
    }
    return { waterTiles, extent };
}

function _placePonds(map, biomeMap, W, H, seed) {
    // Pond count scales with map area; base rate ~1 per 800 tiles.
    const count = Math.floor((W * H) / 800);
    const minMargin = 5;
    const placed = []; // [{cx,cy,r}] for overlap rejection

    for (let i = 0; i < count; i++) {
        const cx2 = minMargin + Math.floor(valueNoise(i, 0, seed + 90000) * (W - minMargin * 2));
        const cy2 = minMargin + Math.floor(valueNoise(i, 1, seed + 91000) * (H - minMargin * 2));
        const biome = biomeMap[cy2]?.[cx2] ?? 'grassland';
        const chance = POND_BIOME_CHANCE[biome] ?? 0.1;
        if (valueNoise(i, 2, seed + 92000) > chance) continue;

        const radius = 2 + Math.floor(valueNoise(i, 3, seed + 93000) * 4); // 2–5 tiles

        // Reject if too close to another pond. `r` is the pond's reach, which
        // allows for the stretch and lobes below (up to ~1.5x the base radius).
        const reach = Math.ceil(radius * 1.5);
        if (placed.some(p => Math.sqrt((p.cx - cx2) ** 2 + (p.cy - cy2) ** 2) < p.r + reach + 4)) continue;
        placed.push({ cx: cx2, cy: cy2, r: reach });

        const { waterTiles, extent } = _paintOrganicWater(map, W, H, cx2, cy2, radius, i, seed);
        if (waterTiles.length === 0) continue;

        // Shore rings, innermost first: shallow water hugging the deep pond, then the
        // biome's inner shore terrain, then its optional outer ring. Measured from the
        // nearest pond water tile (not the pond centre) so the rings follow the shape.
        const ring = extent + 4;
        for (let ny = Math.max(0, cy2 - ring); ny <= Math.min(H - 1, cy2 + ring); ny++) {
            for (let nx = Math.max(0, cx2 - ring); nx <= Math.min(W - 1, cx2 + ring); nx++) {
                const terrain = map[ny][nx].terrain;
                if (terrain === 'water' || terrain === 'shallow_water' || terrain === 'tall_rock') continue;
                let best = Infinity;
                for (const w of waterTiles) {
                    const d = (w.x - nx) ** 2 + (w.y - ny) ** 2;
                    if (d < best) best = d;
                }
                const dist = Math.sqrt(best);
                if (dist > 4) continue;
                const shore = BIOMES[biomeMap[ny][nx]].shore;
                if (dist <= 2) {
                    // Mostly shallow; the odd gap falls back to plain shore for a ragged rim.
                    map[ny][nx].terrain = Math.random() < 0.85 ? 'shallow_water' : shore.inner;
                    map[ny][nx].resource = null;
                } else if (dist <= 3 && Math.random() < 0.8) {
                    map[ny][nx].terrain = shore.inner; map[ny][nx].resource = null;
                } else if (shore.outer && Math.random() < 0.5) {
                    map[ny][nx].terrain = shore.outer; map[ny][nx].resource = null;
                }
            }
        }
    }
}

// Desert oases: a small pond ringed by a thin shallow-water and sand rim, then a
// patch of grass dotted with trees. Roughly one per params.oasisTilesPer desert
// tiles (the fractional part is a chance of one more), so small deserts may get none.
function _placeOases(map, biomeMap, W, H, seed, params) {
    const desertTiles = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) if (biomeMap[y][x] === 'desert') desertTiles.push({ x, y });
    }
    const expected = desertTiles.length / params.oasisTilesPer;
    const count = Math.floor(expected) + (Math.random() < expected - Math.floor(expected) ? 1 : 0);
    const placed = [];
    const margin = 7;                 // keeps the whole oasis (water + grass) on the map
    const clearRadius = 8;            // oasis footprint must be desert, dry, and clear of other oases

    for (let n = 0; n < count; n++) {
        let spot = null;
        for (let attempt = 0; attempt < 40 && !spot; attempt++) {
            const c = desertTiles[Math.floor(Math.random() * desertTiles.length)];
            if (c.x < margin || c.x >= W - margin || c.y < margin || c.y >= H - margin) continue;
            if (placed.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 20)) continue;
            let ok = true;
            for (let dy = -clearRadius; dy <= clearRadius && ok; dy += 2) {
                for (let dx = -clearRadius; dx <= clearRadius && ok; dx += 2) {
                    const t = map[c.y + dy]?.[c.x + dx];
                    if (!t || t.biome !== 'desert' || t.terrain === 'water' || t.terrain === 'shallow_water' || t.terrain === 'tall_rock') ok = false;
                }
            }
            if (ok) spot = c;
        }
        if (!spot) continue;
        placed.push(spot);

        const radius = 2 + Math.floor(Math.random() * 2); // 2-3 tiles
        const { waterTiles, extent } = _paintOrganicWater(map, W, H, spot.x, spot.y, radius, 1000 + n, seed);
        if (waterTiles.length === 0) continue;

        // Rings measured from the nearest water tile: shallow, a sand strip (the
        // final water_shores pass would force one anyway), then irregular grass
        // with trees. Anything beyond is left as the surrounding desert.
        const ring = extent + 6;
        for (let ny = Math.max(0, spot.y - ring); ny <= Math.min(H - 1, spot.y + ring); ny++) {
            for (let nx = Math.max(0, spot.x - ring); nx <= Math.min(W - 1, spot.x + ring); nx++) {
                const tile = map[ny][nx];
                if (tile.terrain === 'water' || tile.terrain === 'shallow_water' || tile.terrain === 'tall_rock') continue;
                let best = Infinity;
                for (const w of waterTiles) {
                    const d = (w.x - nx) ** 2 + (w.y - ny) ** 2;
                    if (d < best) best = d;
                }
                const dist = Math.sqrt(best);
                // Grass reach wobbles with smooth noise so the green patch isn't a clean band.
                const grassReach = 4.2 + (smoothNoise(nx, ny, seed + 98000 + n, 4) - 0.5) * 2 * 2.2;
                if (dist <= 1.5) {
                    tile.terrain = Math.random() < 0.9 ? 'shallow_water' : 'sand';
                    tile.resource = null;
                } else if (dist <= 2.5) {
                    tile.terrain = 'sand';
                    tile.resource = null;
                } else if (dist <= grassReach) {
                    tile.terrain = 'grass';
                    tile.resource = Math.random() < 0.3
                        ? { type: 'tree', amount: 3 + Math.floor(Math.random() * 3) }
                        : null;
                }
                tile.passable = TERRAIN[tile.terrain].passable.colonist;
            }
        }
    }
}

// Landmarks placed by the current generateMap run, so restoreLandmarkRituals can
// re-stamp their cores after the later generators have had their say.
let placedLandmarks = [];

// True for the authored pieces that must always survive generation.
function isRitualPiece(type) {
    return type === 'arcane_core' || type === 'ritual_chalk';
}

// Stamps one blueprint piece onto the map. Core and chalk are authored, never
// decayed, and override water: Arcane Cores exist only in these landmarks, so
// losing one would remove it from the world for good.
function _stampLandmarkPiece(map, W, H, blueprint, ox, oy, piece, decayChance, floorDecayChance) {
    const wx = ox + piece.x, wy = oy + piece.y;
    if (wx < 0 || wx >= W || wy < 0 || wy >= H) return;
    const tile = map[wy][wx];
    const ritual = isRitualPiece(piece.type);
    if (isWaterTerrain(tile.terrain)) {
        if (!ritual) return;
        tile.terrain = blueprint.floorTerrain || 'dirt';
    }
    const isFloor = BUILDINGS[piece.type] && BUILDINGS[piece.type].structureType === 'floor';
    const decay = isFloor ? floorDecayChance : decayChance;
    if (!ritual && Math.random() < decay) return;
    if (isFloor) {
        tile.floor = piece.type;
    } else {
        tile.structure = piece.type;
        tile.passable = !(IMPASSABLE_STRUCTURES.has(piece.type));
        if (BUILDINGS[piece.type] && BUILDINGS[piece.type].hp) {
            tile.structureHp = BUILDINGS[piece.type].hp;
        }
    }
    tile.resource = null;
}

// Places every LANDMARK_BLUEPRINTS ruin (one per ritual shape, each holding an
// Arcane Core) on every map, whatever its size. Each goes at a random position
// inside its blueprint's `biome`. Cores cannot be rebuilt, so placement must not
// fail: candidate positions are filtered exhaustively against earlier landmarks and
// the start area, widening from sampled in-biome spots, to every in-biome spot, to
// anywhere on the map (nearest the biome when it has any territory). Largest
// blueprints go first so the big ones are not squeezed out.
function _placeBiomeLandmarks(map, biomeMap, W, H, seed) {
    const placed = [];
    placedLandmarks = [];
    const padding = 4;
    const decayChance = 0.25;
    const floorDecayChance = 0.10;
    const startCx = Math.floor(W / 2), startCy = Math.floor(H / 2), startKeepOut = 7;

    const blueprints = Object.values(LANDMARK_BLUEPRINTS)
        .sort((a, b) => b.width * b.height - a.width * a.height);

    for (const blueprint of blueprints) {
        const biomeKey = blueprint.biome;

        // clearStartingArea runs last and wipes structures there, which would erase
        // the landmark's Arcane Core.
        const isFree = (x, y) =>
            !(x < startCx + startKeepOut + 1 && x + blueprint.width > startCx - startKeepOut &&
              y < startCy + startKeepOut + 1 && y + blueprint.height > startCy - startKeepOut) &&
            !placed.some(r =>
                x < r.x + r.w + padding && x + blueprint.width  + padding > r.x &&
                y < r.y + r.h + padding && y + blueprint.height + padding > r.y);

        const margin = blueprint.width + 4;
        const collect = (step, inBiomeOnly) => {
            const out = [];
            for (let y = margin; y < H - margin; y += step) {
                for (let x = margin; x < W - margin; x += step) {
                    if (inBiomeOnly && biomeMap[y][x] !== biomeKey) continue;
                    if (isFree(x, y)) out.push({ x, y });
                }
            }
            return out;
        };

        let candidates = collect(3, true);
        if (candidates.length === 0) candidates = collect(1, true);
        if (candidates.length === 0) {
            // Biome too small or crowded: take the free spot closest to its territory.
            const anywhere = collect(1, false);
            const biomeTiles = [];
            for (let y = 0; y < H; y += 3) {
                for (let x = 0; x < W; x += 3) if (biomeMap[y][x] === biomeKey) biomeTiles.push({ x, y });
            }
            if (biomeTiles.length > 0) {
                const target = biomeTiles[Math.floor(Math.random() * biomeTiles.length)];
                anywhere.sort((a, b) =>
                    Math.abs(a.x - target.x) + Math.abs(a.y - target.y) -
                    (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)));
                candidates = anywhere.slice(0, 1);
            } else {
                candidates = anywhere;
            }
        }
        if (candidates.length === 0) {
            console.warn(`Landmark ${blueprint.name} could not be placed: no free space on the map`);
            continue;
        }

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const cx2 = pick.x, cy2 = pick.y;
        placed.push({ x: cx2, y: cy2, w: blueprint.width, h: blueprint.height });
        placedLandmarks.push({ blueprint, x: cx2, y: cy2, w: blueprint.width, h: blueprint.height });
        generatedRuins.push({ kind: 'landmark', blueprint: blueprint.name, x: cx2, y: cy2, w: blueprint.width, h: blueprint.height });

        // Paint floor terrain under the footprint.
        if (blueprint.floorTerrain) {
            for (let dy = 0; dy < blueprint.height; dy++) {
                for (let dx = 0; dx < blueprint.width; dx++) {
                    const wx = cx2 + dx, wy = cy2 + dy;
                    if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
                    const tile = map[wy][wx];
                    if (isWaterTerrain(tile.terrain)) continue;
                    tile.terrain = blueprint.floorTerrain;
                    tile.resource = null;
                }
            }
        }

        // Place structures from the layout with decay.
        for (const piece of blueprint.layout) {
            _stampLandmarkPiece(map, W, H, blueprint, cx2, cy2, piece, decayChance, floorDecayChance);
        }
    }
}

// Re-stamps every landmark's Arcane Core and chalk. Generators that run after
// biome_layout (rivers, rock and mountain passes, generic ruins, the start-area
// clear) can paint over them; this runs after all of those so the world always
// ends up with one intact core per landmark.
function restoreLandmarkRituals(map) {
    const W = CONFIG.MAP_WIDTH, H = CONFIG.MAP_HEIGHT;
    for (const { blueprint, x, y } of placedLandmarks) {
        for (const piece of blueprint.layout) {
            if (isRitualPiece(piece.type)) _stampLandmarkPiece(map, W, H, blueprint, x, y, piece, 0, 0);
        }
    }
}

function isWaterTerrain(terrain) {
    return terrain === 'water' || terrain === 'shallow_water';
}

// Final safety net for water bodies (ponds, rivers, swamp pools): any land tile
// directly beside (up/down/left/right) water or shallow water must be a transition tile, so water never meets
// "normal" terrain (grass, dirt, snow, rock, ...) directly. The transition is the
// tile's biome shore terrain (sand, gravel, mud). Existing sand/gravel/mud is kept
// as is. tall_rock is left alone: it is an impassable cliff, and converting it
// would open a path through it. Called last from generateMap, after every pass that
// can paint terrain over a shoreline (dirt patches, rock formations, mountain
// ranges, start-area clearing, landmark and ruin floors).
function generateWaterShores(map) {
    if (map[0][0].biome === undefined) return; // non-biome fallback has its own banks
    const H = CONFIG.MAP_HEIGHT, W = CONFIG.MAP_WIDTH;
    const transition = new Set(['sand', 'gravel', 'mud']);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            const terrain = tile.terrain;
            if (isWaterTerrain(terrain) || terrain === 'tall_rock' || transition.has(terrain)) continue;
            // Orthogonal neighbours only: also converting diagonals squares off
            // the shoreline, so a tile touching water only at a corner is left alone.
            const touchesWater = (y > 0 && isWaterTerrain(map[y - 1][x].terrain))
                || (y < H - 1 && isWaterTerrain(map[y + 1][x].terrain))
                || (x > 0 && isWaterTerrain(map[y][x - 1].terrain))
                || (x < W - 1 && isWaterTerrain(map[y][x + 1].terrain));
            if (!touchesWater) continue;
            const shore = BIOMES[tile.biome]?.shore;
            if (!shore) continue;
            tile.terrain = shore.inner;
            tile.passable = TERRAIN[shore.inner].passable.colonist;
            tile.resource = null;
        }
    }
}

function generateDirtPatches(map, params) {
    const scale = (CONFIG.MAP_WIDTH * CONFIG.MAP_HEIGHT) / (100 * 80);
    const count = Math.floor(params.count * scale);
    const biomeActive = map[0][0].biome !== undefined;
    // When biomes are active, only paint dirt in grassland/forest tiles.
    const dirtBiomes = new Set(['grassland', 'forest']);
    for (let i = 0; i < count; i++) {
        const cx = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        const cy = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        if (biomeActive && !dirtBiomes.has(map[cy][cx].biome)) continue;
        const radius = params.radiusRange[0] + Math.floor(Math.random() * (params.radiusRange[1] - params.radiusRange[0] + 1));
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < CONFIG.MAP_WIDTH && ny >= 0 && ny < CONFIG.MAP_HEIGHT) {
                    if (biomeActive && !dirtBiomes.has(map[ny][nx].biome)) continue;
                    if (isWaterTerrain(map[ny][nx].terrain)) continue;
                    if (Math.random() < params.fillChance) {
                        map[ny][nx].terrain = 'dirt';
                    }
                }
            }
        }
    }
}

function generateRockFormations(map, params) {
    const scale = (CONFIG.MAP_WIDTH * CONFIG.MAP_HEIGHT) / (100 * 80);
    const count = Math.floor(params.count * scale);
    const biomeActive = map[0][0].biome !== undefined;
    for (let i = 0; i < count; i++) {
        const cx = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        const cy = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        if (biomeActive && map[cy][cx].biome !== 'mountain') continue;
        const size = params.sizeRange[0] + Math.floor(Math.random() * (params.sizeRange[1] - params.sizeRange[0] + 1));
        for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < CONFIG.MAP_WIDTH && ny >= 0 && ny < CONFIG.MAP_HEIGHT) {
                    if (Math.abs(dx) + Math.abs(dy) <= size && Math.random() < params.fillChance) {
                        if (isWaterTerrain(map[ny][nx].terrain)) continue;
                        map[ny][nx].terrain = 'rock';
                        map[ny][nx].passable = TERRAIN.rock.passable.colonist;
                        if (Math.random() < params.resourceChance) {
                            const roll = Math.random();
                            const ironChance = params.ironChance || 0.3;
                            const runiteChance = params.runiteChance;
                            let type, amount;
                            if (roll < runiteChance) {
                                type = 'runite_ore';
                                amount = params.runiteAmount[0] + Math.floor(Math.random() * (params.runiteAmount[1] - params.runiteAmount[0] + 1));
                            } else if (roll < runiteChance + ironChance) {
                                type = 'iron_ore';
                                amount = (params.ironAmount || params.stoneAmount)[0] + Math.floor(Math.random() * ((params.ironAmount || params.stoneAmount)[1] - (params.ironAmount || params.stoneAmount)[0] + 1));
                            } else {
                                type = 'stone';
                                amount = params.stoneAmount[0] + Math.floor(Math.random() * (params.stoneAmount[1] - params.stoneAmount[0] + 1));
                            }
                            map[ny][nx].resource = { type, amount };
                        }
                    }
                }
            }
        }
    }
}

function generateMountainRanges(map, params) {
    if (Math.random() > params.chance) return;
    // When biomes are active the mountain biome terrain is already painted;
    // mountain ranges still run to add density and tall_rock spires, but are
    // seeded to the mountain biome centroid region rather than purely random.

    const length = params.lengthRange[0] + Math.floor(Math.random() * (params.lengthRange[1] - params.lengthRange[0] + 1));
    const width = params.widthRange[0] + Math.floor(Math.random() * (params.widthRange[1] - params.widthRange[0] + 1));

    // Pick a random start point away from center. With biomes active it must lie
    // in the mountain biome, and the range is clipped to that biome below so
    // mountains never poke out into grassland, desert, or tundra.
    const margin = 20;
    const biomeActive = map[0][0].biome !== undefined;
    let sx = margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - 2 * margin));
    let sy = margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - 2 * margin));
    if (biomeActive) {
        const starts = [];
        for (let y = margin; y < CONFIG.MAP_HEIGHT - margin; y += 3) {
            for (let x = margin; x < CONFIG.MAP_WIDTH - margin; x += 3) {
                if (map[y][x].biome === 'mountain') starts.push({ x, y });
            }
        }
        if (starts.length === 0) return;
        ({ x: sx, y: sy } = starts[Math.floor(Math.random() * starts.length)]);
    }

    // Random direction for the spine
    const angle = Math.random() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    for (let step = 0; step < length; step++) {
        const cx = Math.round(sx + dirX * step + (Math.random() - 0.5) * 2);
        const cy = Math.round(sy + dirY * step + (Math.random() - 0.5) * 2);

        for (let dy = -width; dy <= width; dy++) {
            for (let dx = -width; dx <= width; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
                if (biomeActive && map[ny][nx].biome !== 'mountain') continue;
                if (isWaterTerrain(map[ny][nx].terrain)) continue;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > width) continue;

                const centerFactor = 1 - (dist / width);
                const isTallRock = centerFactor > 0.5 && Math.random() < params.tallRockChance;
                const terrain = isTallRock ? 'tall_rock' : 'rock';

                map[ny][nx].terrain = terrain;
                map[ny][nx].passable = TERRAIN[terrain].passable.colonist;
                map[ny][nx].resource = null;

                if (!isTallRock && Math.random() < params.resourceChance) {
                    const roll = Math.random();
                    const ironChance = params.ironChance || 0.3;
                    const runiteChance = params.runiteChance;
                    let type, amount;
                    if (roll < runiteChance) {
                        type = 'runite_ore';
                        amount = params.runiteAmount[0] + Math.floor(Math.random() * (params.runiteAmount[1] - params.runiteAmount[0] + 1));
                    } else if (roll < runiteChance + ironChance) {
                        type = 'iron_ore';
                        amount = (params.ironAmount || params.stoneAmount)[0] + Math.floor(Math.random() * ((params.ironAmount || params.stoneAmount)[1] - (params.ironAmount || params.stoneAmount)[0] + 1));
                    } else {
                        type = 'stone';
                        amount = params.stoneAmount[0] + Math.floor(Math.random() * (params.stoneAmount[1] - params.stoneAmount[0] + 1));
                    }
                    map[ny][nx].resource = { type, amount };
                }
            }
        }
    }
}

function generateTrees(map, params) {
    // biome_layout handles per-biome tree density when it runs; skip this pass.
    if (map[0][0].biome !== undefined) return;
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            if (map[y][x].terrain === 'grass' && Math.random() < params.density) {
                map[y][x].resource = {
                    type: 'tree',
                    amount: params.amountRange[0] + Math.floor(Math.random() * (params.amountRange[1] - params.amountRange[0] + 1))
                };
            }
        }
    }
}

function generateRiver(map, params) {
    // biome_layout places a biome-aware river; skip this fallback pass.
    if (map[0][0].biome !== undefined) return;
    let x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
    let y = 0;
    const targetX = Math.floor(Math.random() * CONFIG.MAP_WIDTH);

    for (; y < CONFIG.MAP_HEIGHT; y++) {
        const width = params.widthRange[0] + Math.floor(Math.random() * (params.widthRange[1] - params.widthRange[0] + 1));
        for (let dx = -width; dx <= width; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < CONFIG.MAP_WIDTH) {
                map[y][nx] = createTile('water');
            }
        }
        x += Math.sign(targetX - x) + Math.floor(Math.random() * 3) - 1;
        x = Math.max(2, Math.min(CONFIG.MAP_WIDTH - 3, x));
    }

    // River banks
    const waterTiles = new Set();
    for (let wy = 0; wy < CONFIG.MAP_HEIGHT; wy++) {
        for (let wx = 0; wx < CONFIG.MAP_WIDTH; wx++) {
            if (map[wy][wx].terrain === 'water') waterTiles.add((wy << 16) | wx);
        }
    }

    for (let by = 0; by < CONFIG.MAP_HEIGHT; by++) {
        for (let bx = 0; bx < CONFIG.MAP_WIDTH; bx++) {
            const tile = map[by][bx];
            if (tile.terrain === 'water' || tile.terrain === 'rock' || tile.terrain === 'tall_rock') continue;

            let minDist = Infinity;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (waterTiles.has(((by + dy) << 16) | (bx + dx))) {
                        const dist = Math.abs(dx) + Math.abs(dy);
                        if (dist < minDist) minDist = dist;
                    }
                }
            }

            if (minDist === 1 && Math.random() < params.bankChance) {
                tile.terrain = 'sand';
                tile.resource = null;
            } else if (minDist === 2 && Math.random() < params.gravelChance) {
                tile.terrain = 'gravel';
                tile.resource = null;
            }
        }
    }
}

// Generic (core-less) ruins. How many scales with map area (params.tilesPer), and
// each is placed only where it fits: they keep clear of the landmark ruins and each
// other, and a ruin that finds no room is skipped rather than forced.
function generateRuins(map, params) {
    const count = params.tilesPer
        ? Math.max(params.minCount ?? 1, Math.round(CONFIG.MAP_WIDTH * CONFIG.MAP_HEIGHT / params.tilesPer))
        : (params.count || 1);
    const placed = placedLandmarks.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
    const padding = 2;
    const maxAttempts = 60;

    for (let i = 0; i < count; i++) {
        if (Math.random() > (params.chance ?? 1.0)) continue;

        const margin = params.margin || 30;
        const blueprint = params.blueprints[Math.floor(Math.random() * params.blueprints.length)];

        let cx, cy, overlaps;
        let attempts = 0;
        do {
            cx = margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - 2 * margin));
            cy = margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - 2 * margin));
            overlaps = placed.some(r =>
                cx < r.x + r.w + padding && cx + blueprint.width + padding > r.x &&
                cy < r.y + r.h + padding && cy + blueprint.height + padding > r.y
            );
            attempts++;
        } while (overlaps && attempts < maxAttempts);
        if (overlaps) continue;

        placed.push({ x: cx, y: cy, w: blueprint.width, h: blueprint.height });
        generatedRuins.push({ kind: blueprint.name, blueprint: blueprint.name, x: cx, y: cy, w: blueprint.width, h: blueprint.height });

        const decayChance = params.decayChance ?? 0.33;
        const floorDecayChance = params.floorDecayChance ?? 0.15;

        // Place floor terrain under the whole footprint first
        if (blueprint.floorTerrain) {
            for (let dy = 0; dy < blueprint.height; dy++) {
                for (let dx = 0; dx < blueprint.width; dx++) {
                    const wx = cx + dx, wy = cy + dy;
                    if (wx < 0 || wx >= CONFIG.MAP_WIDTH || wy < 0 || wy >= CONFIG.MAP_HEIGHT) continue;
                    const tile = map[wy][wx];
                    if (isWaterTerrain(tile.terrain)) continue;
                    tile.terrain = blueprint.floorTerrain;
                    tile.resource = null;
                }
            }
        }

        // Place structures from the layout
        for (const piece of blueprint.layout) {
            const wx = cx + piece.x, wy = cy + piece.y;
            if (wx < 0 || wx >= CONFIG.MAP_WIDTH || wy < 0 || wy >= CONFIG.MAP_HEIGHT) continue;
            const tile = map[wy][wx];
            if (isWaterTerrain(tile.terrain)) continue;

            const isFloor = BUILDINGS[piece.type] && BUILDINGS[piece.type].structureType === 'floor';
            const decay = isFloor ? floorDecayChance : decayChance;
            if (Math.random() < decay) continue;

            if (isFloor) {
                tile.floor = piece.type;
            } else {
                tile.structure = piece.type;
                tile.passable = !(IMPASSABLE_STRUCTURES.has(piece.type));
                if (BUILDINGS[piece.type] && BUILDINGS[piece.type].hp) {
                    tile.structureHp = BUILDINGS[piece.type].hp;
                }
            }
            tile.resource = null;
        }
    }
}

// Rolls one chest's contents from RUIN_LOOT[tier] plus the crypt theme's own
// materials: a few weighted picks that merge into {resource: amount}. Stored on the
// ruin so a reload never rerolls.
function rollChestLoot(tier, themeLoot) {
    const entries = [...RUIN_LOOT[tier].entries, ...themeLoot];
    const [minRolls, maxRolls] = RUIN_LOOT[tier].rolls;
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    const rolls = minRolls + Math.floor(Math.random() * (maxRolls - minRolls + 1));
    const contents = {};
    for (let i = 0; i < rolls; i++) {
        let pick = Math.random() * totalWeight;
        const entry = entries.find(e => (pick -= e.weight) < 0) || entries[0];
        const amount = entry.amount[0] + Math.floor(Math.random() * (entry.amount[1] - entry.amount[0] + 1));
        contents[entry.resource] = (contents[entry.resource] || 0) + amount;
    }
    return contents;
}

// Sealed crypts (see CRYPT_CONFIG). Each is a door-less wall ring whose interior is
// flagged tile.sealed, so the renderer shows it dark until the ring is breached. Never
// decayed, and never placed on or beside water or near the start area or a landmark,
// so a crypt can neither start open nor stand between a player and an Arcane Core.
//
// Every gated realm chain gets one anchor crypt, placed in the chain's biome and
// dressed in its theme (walls, floor, guardians, loot). If a chain's biome has no room
// the crypt is placed elsewhere rather than dropped, since its chain would be locked.
function generateCrypts(map) {
    const W = CONFIG.MAP_WIDTH, H = CONFIG.MAP_HEIGHT;
    const cfg = CRYPT_CONFIG;
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);

    const extras = cfg.extras[W]
        ?? new Array(Math.max(0, Math.round(W * H / cfg.fallbackTilesPer) - cfg.anchors.length)).fill(1);

    // The starter is whichever tier 1 anchor chain has its biome nearest the start.
    const biomeDistToStart = (biome) => {
        let best = Infinity;
        for (let y = 0; y < H; y += 3) {
            for (let x = 0; x < W; x += 3) {
                if (map[y][x].biome === biome) best = Math.min(best, Math.max(Math.abs(x - cx), Math.abs(y - cy)));
            }
        }
        return best;
    };
    const tierOne = cfg.anchors.filter(a => a.tier === 1);
    const starterChain = tierOne.length
        ? tierOne.reduce((a, b) => biomeDistToStart(cfg.themes[a.chain].biome) <= biomeDistToStart(cfg.themes[b.chain].biome) ? a : b).chain
        : null;

    const plan = [
        ...cfg.anchors.map(a => ({ tier: a.tier, chain: a.chain, starter: a.chain === starterChain })),
        ...extras.map(tier => ({ tier })),
    ].sort((a, b) => b.tier - a.tier);

    const placed = placedLandmarks.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
    for (const r of generatedRuins) placed.push({ x: r.x, y: r.y, w: r.w, h: r.h });

    const startDist = (x, y, bp) => Math.max(Math.abs(x + bp.width / 2 - cx), Math.abs(y + bp.height / 2 - cy));
    const fits = (x, y, bp) => {
        if (x < cfg.margin || y < cfg.margin || x + bp.width > W - cfg.margin || y + bp.height > H - cfg.margin) return false;
        if (startDist(x, y, bp) < cfg.startKeepOut + Math.max(bp.width, bp.height) / 2) return false;
        if (placed.some(r =>
            x < r.x + r.w + cfg.padding && x + bp.width + cfg.padding > r.x &&
            y < r.y + r.h + cfg.padding && y + bp.height + cfg.padding > r.y)) return false;
        // The ring and a one-tile border must be dry, open ground.
        for (let dy = -1; dy <= bp.height; dy++) {
            for (let dx = -1; dx <= bp.width; dx++) {
                const t = map[y + dy][x + dx];
                if (isWaterTerrain(t.terrain) || t.terrain === 'tall_rock') return false;
            }
        }
        return true;
    };

    // Every legal spot for this blueprint, narrowed by `want`. Sampled every 2 tiles.
    const collect = (bp, want) => {
        const out = [];
        for (let y = cfg.margin; y < H - bp.height - cfg.margin; y += 2) {
            for (let x = cfg.margin; x < W - bp.width - cfg.margin; x += 2) {
                if (!want(x, y) || !fits(x, y, bp)) continue;
                out.push({ x, y });
            }
        }
        return out;
    };

    for (const { tier, chain, starter } of plan) {
        const theme = cfg.themes[chain] || cfg.themes.default;
        const options = CRYPT_BLUEPRINTS[tier];
        const bp = options[Math.floor(Math.random() * options.length)];
        const minDist = tier === 3 ? cfg.deepVaultMinDist * Math.min(W, H) : 0;

        const inBiome = (x, y) => !theme.biome || map[y + Math.floor(bp.height / 2)][x + Math.floor(bp.width / 2)].biome === theme.biome;
        const farEnough = (x, y) => startDist(x, y, bp) >= minDist;
        const nearStart = (x, y) => { const d = startDist(x, y, bp); return d >= cfg.starterRange[0] && d <= cfg.starterRange[1]; };

        // Widen the search until something fits: ideal rules first, then drop the
        // start-distance rules, then drop the biome.
        const attempts = [
            (x, y) => inBiome(x, y) && farEnough(x, y) && (!starter || nearStart(x, y)),
            (x, y) => inBiome(x, y) && farEnough(x, y),
            (x, y) => inBiome(x, y),
            () => true,
        ];
        let candidates = [];
        for (const want of attempts) {
            candidates = collect(bp, want);
            if (candidates.length > 0) break;
        }
        if (candidates.length === 0) {
            console.warn(`Crypt ${bp.name}${chain ? ' (' + chain + ' anchor)' : ''} could not be placed: no free space`);
            continue;
        }
        const spot = candidates[Math.floor(Math.random() * candidates.length)];

        placed.push({ x: spot.x, y: spot.y, w: bp.width, h: bp.height });

        // Only the crypt's own tiles change terrain, so a round crypt leaves the corners
        // of its bounding box as natural ground.
        for (const t of [...bp.ring, ...bp.interior]) {
            const tile = map[spot.y + t.y][spot.x + t.x];
            tile.terrain = theme.terrain;
            tile.resource = null;
        }
        // Blueprints are authored in stone: swap in the theme's wall and floor.
        const themed = { stone_wall: theme.wall, stone_floor: theme.floor };
        for (const piece of bp.layout) {
            const type = themed[piece.type] || piece.type;
            const tile = map[spot.y + piece.y][spot.x + piece.x];
            if (BUILDINGS[type].structureType === 'floor') {
                tile.floor = type;
            } else {
                tile.structure = type;
                tile.passable = !(IMPASSABLE_STRUCTURES.has(type));
                tile.structureHp = BUILDINGS[type].hp;
            }
        }
        for (const t of bp.interior) map[spot.y + t.y][spot.x + t.x].sealed = true;

        // Warded crypts get an unbreakable ring until their prerequisite chain is
        // completed (RuinSystem swaps the theme's wall back in).
        const wardChain = chain ? cfg.wardedBy[chain] : cfg.extraWardedBy[tier];
        if (wardChain) {
            for (const t of bp.ring) {
                const tile = map[spot.y + t.y][spot.x + t.x];
                tile.structure = 'warded_wall';
                tile.structureHp = BUILDINGS.warded_wall.hp;
            }
        }

        const loot = [];
        for (const c of bp.chests) {
            const tile = map[spot.y + c.y][spot.x + c.x];
            tile.structure = 'ancient_chest';
            tile.passable = !(IMPASSABLE_STRUCTURES.has('ancient_chest'));
            loot.push({ x: spot.x + c.x, y: spot.y + c.y, contents: rollChestLoot(tier, theme.loot), taken: false });
        }

        let anchor = null;
        if (chain) {
            const a = map[spot.y + bp.anchor.y][spot.x + bp.anchor.x];
            a.structure = 'rift_anchor';
            a.passable = !(IMPASSABLE_STRUCTURES.has('rift_anchor'));
            anchor = { x: spot.x + bp.anchor.x, y: spot.y + bp.anchor.y, chain, attuned: false };
        }

        // Blueprint guardian slots are 'crypt_warden' (light) and 'bone_sentinel' (heavy).
        const guardianType = (slot) => slot === 'bone_sentinel' ? theme.guardians.heavy : theme.guardians.light;

        generatedRuins.push({
            kind: 'crypt', blueprint: bp.name, tier, chain: chain || null, anchor,
            x: spot.x, y: spot.y, w: bp.width, h: bp.height,
            shape: bp.shape, innerRadius: bp.innerRadius ?? null,
            starter: !!starter,
            ward: wardChain ? { chain: wardChain, wall: theme.wall } : null,
            loot,
            traps: bp.traps.map(t => ({ x: spot.x + t.x, y: spot.y + t.y, armed: true })),
            guardians: bp.guardians.map(g => ({ type: guardianType(g.type), x: spot.x + g.x, y: spot.y + g.y })),
        });
    }
}

// --- Always runs last to ensure spawn area is clear ---
function clearStartingArea(map) {
    const cx = Math.floor(CONFIG.MAP_WIDTH / 2);
    const cy = Math.floor(CONFIG.MAP_HEIGHT / 2);
    const radius = 6;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < CONFIG.MAP_WIDTH && ny >= 0 && ny < CONFIG.MAP_HEIGHT) {
                if (Math.abs(dx) + Math.abs(dy) <= radius) {
                    map[ny][nx].terrain = 'grass';
                    map[ny][nx].resource = null;
                    map[ny][nx].structure = null;
                    map[ny][nx].passable = true;
                }
            }
        }
    }
}

// --- Tile query functions ---

// Combined other get calls as we always needed to do them together. This saves us
// from having to repeat these if-statements 3 times going through char, color, and bg.
//
// writeTileVisuals writes into a caller-owned scratch object and returns it, so the
// hot render loop (called for every visible tile every frame, ~16k times when zoomed
// out) can reuse one object instead of allocating a fresh {char,color,bg} per tile.
// getTileVisuals keeps the allocating signature for one-shot/menu callers.
export function writeTileVisuals(tile, season, out) {
    let char = '';
    let color = '';
    let bg = '';
    if (tile.sealed) {
        // Unexplored crypt interior: reveals nothing about what is inside.
        out.char = ' ';
        out.color = SEALED_BG;
        out.bg = SEALED_BG;
        return out;
    }
    if (tile.onFire) {
        char = '^';
        color = '#ff4400';
    }
    else if (tile.structure) {
        char = TILE_CHARS[tile.structure] || '?';
        color = TILE_COLORS[tile.structure] || '#fff';
        const bDef = BUILDINGS[tile.structure];
        if (bDef && bDef.bg) bg = bDef.bg;
    }
    else if (tile.zone) {
        if (tile.zone.state === 'ready') {
            const cropDef = tile.zone.crop && CROPS[tile.zone.crop];
            char = (cropDef && cropDef.readyChar) || TILE_CHARS.farm_ready;
            color = cropDef ? cropDef.color : '#ffdd00';
        }
        else if (tile.zone.state === 'growing') {
            const cropDef = tile.zone.crop && CROPS[tile.zone.crop];
            char = (cropDef && cropDef.char) || TILE_CHARS.farm_growing;
            color = tile.zone.blighted ? '#7a5599' : TILE_COLORS.farm_growing;
        }
        else {
            char = TILE_CHARS.farm_empty;
            color = TILE_COLORS.farm_empty;
        }
    }
    else if (tile.floor) {
        char = TILE_CHARS[tile.floor] || '·';
        color = TILE_COLORS[tile.floor] || '#888';
        const fDef = BUILDINGS[tile.floor];
        if (fDef && fDef.bg) bg = fDef.bg;
    }
    else if (tile.snowCovered && GRASS_TERRAIN.has(tile.terrain)) {
        char = TILE_CHARS.snow;
        color = TILE_COLORS.snow;
        bg = TILE_COLORS.snowBg
    }
    else if (tile.resource) {
        const rDef = RESOURCES[tile.resource.type];
        if (rDef) {
            char = rDef.char;
            // Trees shift color with the season (ASCII glyph + minimap); other
            // resources have no seasonal variants, so `<season>Color` is absent
            // and we fall back to the base color. In skin mode the tree draws a
            // sprite and this color is unused.
            const seasonColor = season && rDef[season + 'Color'];
            color = seasonColor || rDef.color;
        }
    }
    const tDef = TERRAIN[tile.terrain];
    if (char === '') char = tDef ? tDef.char : '?';
    if (color === '') color = tDef ? tDef.color : '#fff';
    if (bg === '') bg = tDef ? tDef.bg : null;

    out.char = char;
    out.color = color;
    out.bg = bg;
    return out;
}

export function getTileVisuals(tile, season) {
    return writeTileVisuals(tile, season, { char: '', color: '', bg: '' });
}


export function isPassable(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    const tile = map[y][x];
    if (!tile.passable || tile.sealed) return false;
    if (IMPASSABLE_STRUCTURES.has(tile.structure)) return false;
    return true;
}

export function getMoveCost(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return Infinity;
    const tile = map[y][x];
    const tDef = TERRAIN[tile.terrain];
    const terrainCost = tDef ? tDef.moveCost : 1;
    const fDef = tile.floor ? BUILDINGS[tile.floor] : null;
    if (fDef && typeof fDef.moveCost === 'number') {
        return Math.min(terrainCost, fDef.moveCost);
    }
    return terrainCost;
}

export function isPassableForAnimals(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    const tile = map[y][x];
    if (!tile.passable || tile.sealed) return false;
    const tDef = TERRAIN[tile.terrain];
    if (tDef && !tDef.passable.animal) return false;
    if (tile.structure) {
        const bDef = BUILDINGS[tile.structure];
        if (bDef && bDef.passable && !bDef.passable.animal) return false;
    }
    return true;
}

export function isPassableForEnemies(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    const tile = map[y][x];
    if (!tile.passable || tile.sealed) return false;
    const tDef = TERRAIN[tile.terrain];
    if (tDef && !tDef.passable.enemy) return false;
    if (ENEMY_BLOCKED_STRUCTURES.has(tile.structure)) return false;
    return true;
}

export function isBreakableByEnemies(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    return BREAKABLE_STRUCTURES.has(map[y][x].structure);
}

// True when the tile holds a furniture structure entities can walk through (beds,
// chairs, workbenches, etc.). Impassable furniture is excluded by isPassable
// before this is consulted, so callers use it only to add a soft routing penalty
// that biases movement around walkable furniture. Not a passability check.
export function isWalkableFurniture(map, x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) return false;
    return FURNITURE_STRUCTURES.has(map[y][x].structure);
}

export function hasLineOfSight(map, x0, y0, x1, y1) {
    if (x0 === x1 && y0 === y1) return true;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;

    while (true) {
        if (x === x1 && y === y1) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }

        if (x === x1 && y === y1) break;

        const tile = map[y]?.[x];
        if (!tile) return false;
        if (tile.passable === false) return false;
        if (WALL_STRUCTURES.has(tile.structure)) return false;
        if (DOOR_STRUCTURES.has(tile.structure)) return false;
    }

    return true;
}

// Finds the nearest tile the shooter can stand on that has line of sight to
// (tx,ty), for repositioning a ranged attacker whose current shot is blocked.
// Scans a box out to `radius` (the weapon's range), skips the shooter's own
// tile, and requires: passCheck(map,x,y) true (isPassable for colonists,
// isPassableForEnemies for hostiles), the tile within `radius` Manhattan of the
// target so a shot is still possible, and clear LOS from the tile to the target.
// Returns the closest qualifying tile by Manhattan distance to the shooter, or
// null when no such tile exists.
export function findLineOfSightTile(map, fromX, fromY, tx, ty, radius, passCheck) {
    let best = null;
    let bestDist = Infinity;
    for (let y = fromY - radius; y <= fromY + radius; y++) {
        for (let x = fromX - radius; x <= fromX + radius; x++) {
            if (x === fromX && y === fromY) continue;
            const shooterDist = Math.abs(x - fromX) + Math.abs(y - fromY);
            if (shooterDist > radius || shooterDist >= bestDist) continue;
            if (Math.abs(x - tx) + Math.abs(y - ty) > radius) continue;
            if (!passCheck(map, x, y)) continue;
            if (!hasLineOfSight(map, x, y, tx, ty)) continue;
            best = { x, y };
            bestDist = shooterDist;
        }
    }
    return best;
}

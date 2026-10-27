import { CONFIG, WALL_STRUCTURES, DOOR_STRUCTURES, TILE_CHARS, TILE_COLORS, TERRAIN, RESOURCES, BUILDINGS, IMPASSABLE_STRUCTURES, ENEMY_BLOCKED_STRUCTURES, BREAKABLE_STRUCTURES, FURNITURE_STRUCTURES, MAP_GENERATORS, BIOMES, LANDMARK_BLUEPRINTS, CROPS } from '../core/config.js';

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
};

export function generateMap() {
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
// displace its lookup coordinates with low-frequency noise before finding the
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
    const innerGuard = maxR * params.innerRadius * 1.5; // keep seeds away from center
    const seeds = []; // [{x, y, biome}]

    let rngState = seed;
    const lcg = () => {
        rngState = (rngState * 1664525 + 1013904223) | 0;
        return (rngState >>> 0) / 0x100000000;
    };

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
            if (distCenter < maxR * params.innerRadius) {
                biomeMap[y][x] = 'grassland';
                continue;
            }

            // Domain warp: displace lookup coords with two noise samples.
            const wx = x + (valueNoise(x, y, seed)           - 0.5) * 2 * warp;
            const wy = y + (valueNoise(x + 7919, y + 4999, seed) - 0.5) * 2 * warp;

            // Nearest Voronoi seed in warped space.
            let nearestBiome = 'grassland';
            let nearestDist = Infinity;
            for (const s of seeds) {
                const d = (wx - s.x) ** 2 + (wy - s.y) ** 2;
                if (d < nearestDist) { nearestDist = d; nearestBiome = s.biome; }
            }
            biomeMap[y][x] = nearestBiome;
        }
    }

    // Transition smoothing: for tiles near a biome boundary, blend terrain by
    // using the neighbor's biome terrain choice probabilistically.
    // (We do this implicitly during terrain painting below by sampling neighboring
    // biome assignment with a falloff, so no extra pass needed.)

    // Paint terrain based on biome assignment.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            const biome = biomeMap[y][x];
            const biomeDef = BIOMES[biome];

            // Near-boundary blending: tiles adjacent to a different biome have a
            // chance to take that neighbor's terrain weights for organic edges.
            let effectiveBiomeDef = biomeDef;
            let neighborBiome = null;
            let neighborCount = 0;
            for (let ny = y - 1; ny <= y + 1; ny++) {
                for (let nx = x - 1; nx <= x + 1; nx++) {
                    if (nx === x && ny === y) continue;
                    if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
                    const nb = biomeMap[ny][nx];
                    if (nb !== biome) { neighborBiome = nb; neighborCount++; }
                }
            }
            if (neighborCount >= 2 && neighborBiome) {
                const blendChance = neighborCount / 8;
                if (valueNoise(x + 20000, y + 20000, seed) < blendChance) {
                    effectiveBiomeDef = BIOMES[neighborBiome];
                }
            }

            const terrainKey = weightedPick(effectiveBiomeDef.terrainWeights, valueNoise(x + 30000, y + 30000, seed));
            const terrainDef = TERRAIN[terrainKey];
            if (terrainDef) {
                tile.terrain = terrainKey;
                tile.passable = terrainDef.passable.colonist;
            }
            tile.biome = biomeMap[y][x];
        }
    }

    // Place trees biome-specifically.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.terrain !== 'grass') continue;
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

    // Place one landmark ruin per biome.
    _placeBiomeLandmarks(map, biomeMap, W, H, seed);
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
    visited.add((end.y << 16) | end.x);

    // River banks: sand adjacent to water, gravel one step further.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const tile = map[y][x];
            if (tile.terrain === 'water' || tile.terrain === 'rock' || tile.terrain === 'tall_rock' ||
                tile.terrain === 'mud' || tile.terrain === 'shallow_water') continue;
            let minDist = Infinity;
            for (let dy2 = -2; dy2 <= 2; dy2++) {
                for (let dx2 = -2; dx2 <= 2; dx2++) {
                    if (visited.has(((y + dy2) << 16) | (x + dx2))) {
                        const d = Math.abs(dx2) + Math.abs(dy2);
                        if (d < minDist) minDist = d;
                    }
                }
            }
            if (minDist === 1 && Math.random() < 0.85) { tile.terrain = 'sand'; tile.resource = null; }
            else if (minDist === 2 && Math.random() < 0.5) { tile.terrain = 'gravel'; tile.resource = null; }
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

        // Reject if too close to another pond.
        if (placed.some(p => Math.sqrt((p.cx - cx2) ** 2 + (p.cy - cy2) ** 2) < p.r + radius + 4)) continue;
        placed.push({ cx: cx2, cy: cy2, r: radius });

        // Paint water in an irregular circle using per-tile noise to roughen the edge.
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = cx2 + dx, ny = cy2 + dy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Roughen edge: shrink effective radius slightly with noise.
                const jitter = valueNoise(nx + 94000, ny + 94000, seed) * 1.5;
                if (dist > radius - jitter) continue;
                // Don't overwrite existing water or hard terrain.
                const t = map[ny][nx];
                if (t.terrain === 'tall_rock') continue;
                t.terrain = 'water';
                t.passable = TERRAIN.water.passable.colonist;
                t.resource = null;
            }
        }

        // Shore ring: sand at dist radius, gravel at radius+1.
        for (let dy = -(radius + 2); dy <= radius + 2; dy++) {
            for (let dx = -(radius + 2); dx <= radius + 2; dx++) {
                const nx = cx2 + dx, ny = cy2 + dy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                if (map[ny][nx].terrain === 'water' || map[ny][nx].terrain === 'tall_rock') continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius + 1.2 && Math.random() < 0.8) {
                    map[ny][nx].terrain = 'sand'; map[ny][nx].resource = null;
                } else if (dist <= radius + 2.2 && Math.random() < 0.5) {
                    map[ny][nx].terrain = 'gravel'; map[ny][nx].resource = null;
                }
            }
        }
    }
}

// Places one landmark ruin per biome using the LANDMARK_BLUEPRINTS library.
// Each landmark is placed at a random position within its biome's territory.
function _placeBiomeLandmarks(map, biomeMap, W, H, seed) {
    const placed = [];
    const padding = 4;
    const maxAttempts = 40;
    const decayChance = 0.25;
    const floorDecayChance = 0.10;

    for (const [biomeKey, biomeDef] of Object.entries(BIOMES)) {
        const blueprintKey = biomeDef.landmark;
        const blueprint = LANDMARK_BLUEPRINTS[blueprintKey];
        if (!blueprint) continue;

        // Collect candidate tile positions inside this biome (not too close to edge).
        // Sample sparsely for speed then pick randomly.
        const margin = blueprint.width + 4;
        const candidates = [];
        for (let y = margin; y < H - margin; y += 3) {
            for (let x = margin; x < W - margin; x += 3) {
                if (biomeMap[y][x] === biomeKey) candidates.push({ x, y });
            }
        }
        if (candidates.length === 0) continue;

        let cx2, cy2, overlaps;
        let attempts = 0;
        do {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            cx2 = pick.x; cy2 = pick.y;
            overlaps = placed.some(r =>
                cx2 < r.x + r.w + padding && cx2 + blueprint.width  + padding > r.x &&
                cy2 < r.y + r.h + padding && cy2 + blueprint.height + padding > r.y
            );
            attempts++;
        } while (overlaps && attempts < maxAttempts);
        if (overlaps) continue;

        placed.push({ x: cx2, y: cy2, w: blueprint.width, h: blueprint.height });

        // Paint floor terrain under the footprint.
        if (blueprint.floorTerrain) {
            for (let dy = 0; dy < blueprint.height; dy++) {
                for (let dx = 0; dx < blueprint.width; dx++) {
                    const wx = cx2 + dx, wy = cy2 + dy;
                    if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
                    const tile = map[wy][wx];
                    if (tile.terrain === 'water') continue;
                    tile.terrain = blueprint.floorTerrain;
                    tile.resource = null;
                }
            }
        }

        // Place structures from the layout with decay.
        for (const piece of blueprint.layout) {
            const wx = cx2 + piece.x, wy = cy2 + piece.y;
            if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
            const tile = map[wy][wx];
            if (tile.terrain === 'water') continue;
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

    // Pick a random start point away from center
    const margin = 20;
    let sx = margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - 2 * margin));
    let sy = margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - 2 * margin));

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

function generateRuins(map, params) {
    const count = params.count || 1;
    const placed = [];
    const padding = 2;
    const maxAttempts = 20;

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

        const decayChance = params.decayChance ?? 0.33;
        const floorDecayChance = params.floorDecayChance ?? 0.15;

        // Place floor terrain under the whole footprint first
        if (blueprint.floorTerrain) {
            for (let dy = 0; dy < blueprint.height; dy++) {
                for (let dx = 0; dx < blueprint.width; dx++) {
                    const wx = cx + dx, wy = cy + dy;
                    if (wx < 0 || wx >= CONFIG.MAP_WIDTH || wy < 0 || wy >= CONFIG.MAP_HEIGHT) continue;
                    const tile = map[wy][wx];
                    if (tile.terrain === 'water') continue;
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
            if (tile.terrain === 'water') continue;

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
    else if (tile.snowCovered && tile.terrain === 'grass') {
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
    if (!tile.passable) return false;
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
    if (!tile.passable) return false;
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
    if (!tile.passable) return false;
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

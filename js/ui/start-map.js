import { TERRAIN } from '../core/config.js';

const WIDTH = 120;
const HEIGHT = 80;

function createTile(terrain) {
    return {
        terrain,
        structure: null,
        floor: null,
        resource: null,
        designation: null,
        zone: null,
        items: [],
        passable: true,
        roomId: null,
        onFire: false,
        fireTimer: 0,
        snowCovered: false,
    };
}

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 0xFFFFFFFF;
    };
}

export function generateStartMap() {
    const rand = seededRandom(42);
    const map = [];
    for (let y = 0; y < HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < WIDTH; x++) {
            map[y][x] = createTile('grass');
        }
    }

    // Scatter dirt patches
    for (let i = 0; i < 8; i++) {
        const cx = Math.floor(rand() * WIDTH);
        const cy = Math.floor(rand() * HEIGHT);
        const radius = 2 + Math.floor(rand() * 4);
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                    if (rand() < 0.55) map[ny][nx].terrain = 'dirt';
                }
            }
        }
    }

    // River on the left side, flowing top to bottom
    let riverX = 32;
    for (let y = 0; y < HEIGHT; y++) {
        const width = 2 + Math.floor(rand() * 2);
        for (let dx = -width; dx <= width; dx++) {
            const nx = riverX + dx;
            if (nx >= 0 && nx < WIDTH) {
                map[y][nx] = createTile('water');
            }
        }
        riverX += Math.floor(rand() * 3) - 1;
        riverX = Math.max(26, Math.min(38, riverX));
    }

    // River banks (sand and gravel)
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (map[y][x].terrain === 'water') continue;
            let nearWater = false;
            let dist2 = false;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny < 0 || ny >= HEIGHT || nx < 0 || nx >= WIDTH) continue;
                    if (map[ny][nx].terrain === 'water') {
                        const d = Math.abs(dx) + Math.abs(dy);
                        if (d <= 1) nearWater = true;
                        if (d === 2) dist2 = true;
                    }
                }
            }
            if (nearWater && rand() < 0.85) {
                map[y][x].terrain = 'sand';
                map[y][x].resource = null;
            } else if (dist2 && rand() < 0.5) {
                map[y][x].terrain = 'gravel';
                map[y][x].resource = null;
            }
        }
    }

    // Mountain range on the right side
    const mStartX = 80;
    const mStartY = 10;
    const mLength = 55;
    const mWidth = 4;
    const angle = Math.PI * 0.45;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    for (let step = 0; step < mLength; step++) {
        const cx = Math.round(mStartX + dirX * step + (rand() - 0.5) * 2);
        const cy = Math.round(mStartY + dirY * step + (rand() - 0.5) * 2);
        for (let dy = -mWidth; dy <= mWidth; dy++) {
            for (let dx = -mWidth; dx <= mWidth; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > mWidth) continue;
                const centerFactor = 1 - (dist / mWidth);
                const terrain = (centerFactor > 0.5 && rand() < 0.4) ? 'tall_rock' : 'rock';
                map[ny][nx].terrain = terrain;
                map[ny][nx].passable = TERRAIN[terrain].passable.colonist;
                map[ny][nx].resource = null;
                if (terrain === 'rock' && rand() < 0.3) {
                    const roll = rand();
                    if (roll < 0.05) {
                        map[ny][nx].resource = { type: 'runite_ore', amount: 3 };
                    } else if (roll < 0.25) {
                        map[ny][nx].resource = { type: 'iron_ore', amount: 5 };
                    } else {
                        map[ny][nx].resource = { type: 'stone', amount: 8 };
                    }
                }
            }
        }
    }

    // Ruins (temple-like structure) in the upper-right area
    const ruinX = 65;
    const ruinY = 15;
    const ruinW = 9;
    const ruinH = 7;
    const decayChance = 0.3;

    // Floor under ruins
    for (let dy = 0; dy < ruinH; dy++) {
        for (let dx = 0; dx < ruinW; dx++) {
            const nx = ruinX + dx, ny = ruinY + dy;
            if (nx < WIDTH && ny < HEIGHT) {
                map[ny][nx].terrain = 'dirt';
                map[ny][nx].resource = null;
            }
        }
    }

    // Walls around the perimeter with decay
    for (let dx = 0; dx < ruinW; dx++) {
        if (rand() > decayChance) { map[ruinY][ruinX + dx].structure = 'stone_wall'; map[ruinY][ruinX + dx].passable = false; }
        if (rand() > decayChance) { map[ruinY + ruinH - 1][ruinX + dx].structure = 'stone_wall'; map[ruinY + ruinH - 1][ruinX + dx].passable = false; }
    }
    for (let dy = 1; dy < ruinH - 1; dy++) {
        if (rand() > decayChance) { map[ruinY + dy][ruinX].structure = 'stone_wall'; map[ruinY + dy][ruinX].passable = false; }
        if (rand() > decayChance) { map[ruinY + dy][ruinX + ruinW - 1].structure = 'stone_wall'; map[ruinY + dy][ruinX + ruinW - 1].passable = false; }
    }

    // Door opening
    map[ruinY + ruinH - 1][ruinX + Math.floor(ruinW / 2)].structure = null;
    map[ruinY + ruinH - 1][ruinX + Math.floor(ruinW / 2)].passable = true;

    // Stone floor inside
    for (let dy = 1; dy < ruinH - 1; dy++) {
        for (let dx = 1; dx < ruinW - 1; dx++) {
            const nx = ruinX + dx, ny = ruinY + dy;
            if (rand() > 0.15) {
                map[ny][nx].floor = 'stone_floor';
            }
        }
    }

    // Second smaller ruin (watchtower) lower-right
    const towerX = 72;
    const towerY = 55;
    const towerSize = 5;
    for (let dy = 0; dy < towerSize; dy++) {
        for (let dx = 0; dx < towerSize; dx++) {
            const nx = towerX + dx, ny = towerY + dy;
            if (nx < WIDTH && ny < HEIGHT) {
                map[ny][nx].terrain = 'dirt';
                map[ny][nx].resource = null;
            }
        }
    }
    for (let dx = 0; dx < towerSize; dx++) {
        if (rand() > decayChance) { map[towerY][towerX + dx].structure = 'stone_wall'; map[towerY][towerX + dx].passable = false; }
        if (rand() > decayChance) { map[towerY + towerSize - 1][towerX + dx].structure = 'stone_wall'; map[towerY + towerSize - 1][towerX + dx].passable = false; }
    }
    for (let dy = 1; dy < towerSize - 1; dy++) {
        if (rand() > decayChance) { map[towerY + dy][towerX].structure = 'stone_wall'; map[towerY + dy][towerX].passable = false; }
        if (rand() > decayChance) { map[towerY + dy][towerX + towerSize - 1].structure = 'stone_wall'; map[towerY + dy][towerX + towerSize - 1].passable = false; }
    }

    // Scatter trees
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (map[y][x].terrain === 'grass' && !map[y][x].resource && !map[y][x].structure && rand() < 0.1) {
                map[y][x].resource = { type: 'tree', amount: 3 + Math.floor(rand() * 3) };
            }
        }
    }

    return { map, width: WIDTH, height: HEIGHT };
}

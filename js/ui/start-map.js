import { CONFIG, MAP_GENERATORS } from '../core/config.js';
import { generateMap, takeGeneratedRuins } from '../world/map.js';

// A small world (WORLD_PRESETS.small in main.js), so the start screen shows the
// same biomes, rivers and ruins a new game actually gets.
const WIDTH = 128;
const HEIGHT = 128;
// Picked for a visible mountain range, a river crossing the view, and all six biomes.
const SEED = 49;

// mulberry32: small seeded PRNG returning [0,1), stands in for Math.random.
function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Runs the real world generator with a fixed seed so the backdrop is the same every
// launch. generateMap reads the map size from CONFIG and draws from Math.random, so
// both are swapped in for the run and restored afterwards. Crypts are left out: their
// sealed interiors draw as large dark blocks that crowd the backdrop.
export function generateStartMap() {
    const savedW = CONFIG.MAP_WIDTH, savedH = CONFIG.MAP_HEIGHT, savedRandom = Math.random;
    const crypts = MAP_GENERATORS.find(g => g.name === 'crypts');
    const savedCrypts = crypts?.enabled;
    if (crypts) crypts.enabled = false;
    CONFIG.MAP_WIDTH = WIDTH;
    CONFIG.MAP_HEIGHT = HEIGHT;
    Math.random = seededRandom(SEED);
    let map;
    try {
        map = generateMap();
    } finally {
        // Discard the ruin registry so it can't leak into the next real game.
        takeGeneratedRuins();
        Math.random = savedRandom;
        if (crypts) crypts.enabled = savedCrypts;
        CONFIG.MAP_WIDTH = savedW;
        CONFIG.MAP_HEIGHT = savedH;
    }
    return { map, width: WIDTH, height: HEIGHT };
}

// Picks suggested map locations for tutorial pointers. Hints are tile-space
// rectangles { x, y, w, h, kind } drawn by OverlayRenderer.

const MAX_SEARCH_RADIUS = 30;

function colonyCenter(game) {
    const alive = game.colonists.filter(c => c.hp > 0);
    if (alive.length === 0) {
        return { x: Math.floor(game.map[0].length / 2), y: Math.floor(game.map.length / 2) };
    }
    const sum = alive.reduce((a, c) => ({ x: a.x + c.x, y: a.y + c.y }), { x: 0, y: 0 });
    return { x: Math.round(sum.x / alive.length), y: Math.round(sum.y / alive.length) };
}

function isOpenTile(game, x, y) {
    const tile = game.map[y]?.[x];
    if (!tile) return false;
    return (tile.terrain === 'grass' || tile.terrain === 'dirt')
        && !tile.structure && !tile.resource && !tile.zone && !tile.designation;
}

function isOpenRectTiles(game, x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            if (!isOpenTile(game, x + dx, y + dy)) return false;
        }
    }
    return true;
}

// Keeps the box off the colonists so it doesn't hide them. Only used when choosing a spot.
function isOpenRect(game, x, y, w, h) {
    if (game.colonists.some(c => c.hp > 0 && c.x >= x - 1 && c.x <= x + w && c.y >= y - 1 && c.y <= y + h)) return false;
    return isOpenRectTiles(game, x, y, w, h);
}

/**
 * Finds a free grass/dirt rectangle close to the colonists, searching in rings.
 * @returns {{x:number,y:number,w:number,h:number,kind:string}|null}
 */
export function findOpenRect(game, w, h) {
    const c = colonyCenter(game);
    // Start a couple of tiles away so the hint doesn't sit on top of the colonists.
    for (let r = 2; r <= MAX_SEARCH_RADIUS; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = c.x + dx;
                const y = c.y + dy;
                if (isOpenRect(game, x, y, w, h)) return { x, y, w, h, kind: 'open' };
            }
        }
    }
    return null;
}

/**
 * Finds the resource tile (e.g. a tree) nearest the colonists and returns a
 * 3x3 rectangle centered on it, which is a comfortable drag target.
 * @param {string[]} types Resource types to accept, e.g. ['tree'].
 */
export function findNearestResource(game, types) {
    const c = colonyCenter(game);
    let best = null;
    let bestDist = Infinity;
    for (let y = 0; y < game.map.length; y++) {
        const row = game.map[y];
        for (let x = 0; x < row.length; x++) {
            const res = row[x].resource;
            if (!res || !types.includes(res.type) || row[x].designation) continue;
            const d = Math.abs(x - c.x) + Math.abs(y - c.y);
            if (d < bestDist) { bestDist = d; best = { x, y }; }
        }
    }
    if (!best) return null;
    return { x: best.x - 1, y: best.y - 1, w: 3, h: 3, kind: 'resource', cx: best.x, cy: best.y, types };
}

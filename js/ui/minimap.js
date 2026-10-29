import { CONFIG, TILE_COLORS, BUILDINGS, ENTITIES, CRYPT_CONFIG } from '../core/config.js';

// Canvas pixels per tile for the footer minimap. The full-map panel picks its own.
const DEFAULT_SCALE = 2;

// One distinct colour per terrain, chosen so each biome reads at a glance:
// grassland bright yellow-green, forest deep emerald, swamp olive/brown/teal,
// desert pale sand and rust, mountain cool grey, tundra white-blue. Water is
// saturated blue so it stands out against all of them.
const TERRAIN_COLORS = {
    grass:          [110, 160, 62],
    forest_grass:   [38, 105, 50],
    swamp_grass:    [98, 118, 58],
    dirt:           [134, 96, 58],
    mud:            [88, 72, 50],
    sand:           [228, 200, 124],
    red_rock:       [178, 84, 52],
    gravel:         [150, 144, 134],
    rock:           [112, 112, 120],
    tall_rock:      [62, 62, 72],
    snow_ground:    [226, 236, 247],
    water:          [34, 82, 172],
    shallow_water:  [82, 150, 172],
};
const UNKNOWN_TERRAIN_COLOR = [30, 30, 30];

// Crypt whose rift anchor is attuned: teal, distinct from the blue of warded crypts.
const ATTUNED_COLOR = [32, 190, 170];

const TREE_LEAF_COLOR = [24, 92, 30];
const AUTUMN_LEAF_COLOR = [190, 115, 30];

/**
 * Toggleable detail layers of the full map. Each entry doubles as a key row: `color`
 * is the swatch, `desc` the meaning. The footer minimap ignores this list and shows
 * everything (with its white camera rectangle in place of the screen-center arrow).
 */
export const MAP_LAYERS = [
    { key: 'colonists', label: 'Colonists',        color: [255, 255, 0],   desc: 'Your living colonists' },
    { key: 'tamed',     label: 'Tamed animals',    color: [100, 200, 100], desc: 'Animals tamed by your colony' },
    { key: 'wildlife',  label: 'Wildlife',         color: [150, 120, 80],  desc: 'Wild animals that are not hostile' },
    { key: 'hostiles',  label: 'Hostiles',         color: [255, 50, 50],   desc: 'Raiders, wave enemies and predators (dark red)' },
    { key: 'trees',     label: 'Trees',            color: [24, 92, 30],    desc: 'Forests (orange in autumn)' },
    { key: 'ore',       label: 'Ore',              color: [196, 124, 78],  desc: 'Stone (grey), iron (copper) and runite (teal)' },
    { key: 'buildings', label: 'Buildings',        color: [180, 180, 180], desc: 'Walls (light grey), doors (brown), floors and furniture' },
    { key: 'farms',     label: 'Farm zones',       color: [60, 150, 30],   desc: 'Farm plots: brown when empty, green growing, gold ready' },
    { key: 'fires',     label: 'Fires',            color: [255, 68, 0],    desc: 'Tiles currently burning' },
    { key: 'crypts',    label: 'Crypts',           color: [190, 160, 230], desc: 'Discovered crypts, tinted by state. Attuned means its rift anchor is active' },
    { key: 'landmarks', label: 'Landmarks',        color: [214, 178, 96],  desc: 'Ancient ruins scattered across the map' },
    { key: 'camera',    label: 'Screen center',    color: [235, 40, 40],   desc: 'Red arrow pointing at the center of the main view' },
];

/** Terrain swatches for the key. Not toggleable: terrain is the map itself. */
export const MAP_TERRAIN_KEY = [
    { label: 'Grassland', color: TERRAIN_COLORS.grass },
    { label: 'Forest',    color: TERRAIN_COLORS.forest_grass },
    { label: 'Swamp',     color: TERRAIN_COLORS.swamp_grass },
    { label: 'Dirt',      color: TERRAIN_COLORS.dirt },
    { label: 'Desert',    color: TERRAIN_COLORS.sand },
    { label: 'Red rock',  color: TERRAIN_COLORS.red_rock },
    { label: 'Mountain',  color: TERRAIN_COLORS.rock },
    { label: 'Tundra',    color: TERRAIN_COLORS.snow_ground },
    { label: 'Water',     color: TERRAIN_COLORS.water },
    { label: 'Shallows',  color: TERRAIN_COLORS.shallow_water },
];

/** Crypt disc colours by state, shared by the map and its key. */
export const CRYPT_STATE_KEY = [
    { label: 'Sealed',    color: [190, 160, 230] },
    { label: 'Warded',    color: [110, 130, 200] },
    { label: 'Breached',  color: [230, 90, 90] },
    { label: 'Plundered', color: [90, 170, 90] },
    { label: 'Attuned',   color: ATTUNED_COLOR },
];

export const defaultMapLayers = () => Object.fromEntries(MAP_LAYERS.map(l => [l.key, true]));

// Ore colours follow the resource colours in the config (stone, iron, runite).
const ORE_COLORS = {
    stone:      [158, 158, 164],
    iron_ore:   [196, 124, 78],
    runite_ore: [68, 204, 204],
};

// Marker sizes are in canvas pixels and scale with map size: the canvas is fitted
// into a fixed panel, so on a 384-tile map every canvas pixel is shown smaller.
const BASE_MAP_WIDTH = 128;
const DOT_SIZE = 4;
const FRAME_WIDTH = 2;
const OUTLINE_COLOR = [10, 10, 14];
const CRYPT_ICON = 'icons/RiftholdIcon.png';
const LANDMARK_ICON = 'icons/RiftholdIcon2.png';
const LANDMARK_ICON_SCALE = 0.8;
const CRYPT_ICON_SIZE = 12;

// 'barrow_crypt' -> 'Barrow Crypt'; names that are already display text pass through.
// Only the start of each space-separated word is capitalised, so "witch's hut" doesn't become "Witch'S Hut".
const prettyName = (id) => String(id).replace(/_/g, ' ').replace(/(^|\s)[a-z]/g, m => m.toUpperCase());

// Attuned (its rift anchor is active) outranks every other state.
const cryptColor = (ruin) => ruin.anchor?.attuned ? ATTUNED_COLOR : ruin.ward ? [110, 130, 200] : ruin.state === 'sealed' ? [190, 160, 230] : ruin.state === 'cleared' ? [90, 170, 90] : [230, 90, 90];

// Nothing left to do at a crypt: every chest looted and, if it has a rift anchor, that anchor attuned.
export const isCryptComplete = (ruin) =>
    (ruin.loot ?? []).every(c => c.taken) && (!ruin.anchor || ruin.anchor.attuned) && (ruin.state === 'cleared' || !!ruin.anchor?.attuned);

const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
];

export class Minimap {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} game
     * @param {object} [options]
     * @param {number} [options.scale] Canvas pixels per tile.
     * @param {object} [options.layers] Live map of MAP_LAYERS key to boolean; a false entry hides that layer. Omit to show everything.
     * @param {boolean} [options.detailed] Outlined markers plus rift anchor and landmark markers (full map).
     * @param {Function} [options.onNavigate] Called after a click or touch recentres the camera.
     */
    constructor(canvas, game, options = {}) {
        this.canvas = canvas;
        this.game = game;
        this.ctx = canvas.getContext('2d');
        this.scale = options.scale ?? DEFAULT_SCALE;
        this.layers = options.layers ?? null;
        this.detailed = !!options.detailed;
        this.onNavigate = options.onNavigate ?? null;

        canvas.width = CONFIG.MAP_WIDTH * this.scale;
        canvas.height = CONFIG.MAP_HEIGHT * this.scale;
        canvas.style.maxHeight = '100%';
        canvas.style.maxWidth = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';

        // Static terrain layer. Only rebuilt when terrain/structures change.
        // Entity dots are composited on top each render call.
        this._terrainImageData = null;
        this._compositeImageData = null;
        this._terrainDirty = true;
        this._lastCamX = -1;
        this._lastCamY = -1;
        this._lastSeason = null;
        this._icons = new Map();
        this._tinted = new Map();

        canvas.addEventListener('mousedown', (e) => { e.stopPropagation(); this.onClick(e); });
        canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { e.stopPropagation(); this.onClick(e); }
        });
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onTouch(e); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); this.onTouch(e); }, { passive: false });
    }

    // Pixel multiplier that keeps markers a similar on-screen size across map sizes.
    markerScale() {
        return Math.max(1, CONFIG.MAP_WIDTH / BASE_MAP_WIDTH) * this.scale / DEFAULT_SCALE;
    }

    layerOn(key) {
        return !this.layers || this.layers[key] !== false;
    }

    /** Resizes the canvas to a new pixels-per-tile scale (e.g. the map size changed). */
    setScale(scale) {
        if (scale === this.scale && this.canvas.width === CONFIG.MAP_WIDTH * scale) return;
        this.scale = scale;
        this.canvas.width = CONFIG.MAP_WIDTH * scale;
        this.canvas.height = CONFIG.MAP_HEIGHT * scale;
        this._terrainImageData = null;
        this._compositeImageData = null;
        this._terrainDirty = true;
    }

    // Lazily loaded marker sprite, or null while loading / if it failed to load.
    getIcon(src) {
        let img = this._icons.get(src);
        if (!img) {
            img = new Image();
            img.src = src;
            this._icons.set(src, img);
        }
        return img.complete && img.naturalWidth > 0 ? img : null;
    }

    // Solid black copy of a sprite's shape, used to outline it. Cached per sprite.
    getSilhouette(src) {
        let canvas = this._tinted.get(`${src}|silhouette`);
        if (canvas) return canvas;
        const img = this.getIcon(src);
        if (!img) return null;
        canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0);
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = '#000000';
        c.fillRect(0, 0, canvas.width, canvas.height);
        this._tinted.set(`${src}|silhouette`, canvas);
        return canvas;
    }

    // Draws `icon` centred on (cx, cy) with a black border that follows the sprite's own outline:
    // the silhouette stamped in the eight directions around it, then the sprite on top.
    drawOutlinedIcon(icon, silhouette, cx, cy, size, border) {
        const ctx = this.ctx;
        if (silhouette) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx || dy) ctx.drawImage(silhouette, cx - size / 2 + dx * border, cy - size / 2 + dy * border, size, size);
                }
            }
        }
        ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
    }

    // Green checkmark with a black border, centred on (cx, cy).
    drawCheckmark(cx, cy, size, border) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.42, cy + size * 0.02);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.34);
        ctx.lineTo(cx + size * 0.44, cy - size * 0.34);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = size * 0.3 + border * 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgb(70,220,70)';
        ctx.lineWidth = size * 0.3;
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    // The grayscale crypt sprite recoloured to `color`: the 'color' blend keeps the sprite's
    // light/dark shading and takes the hue from the fill, and 'destination-in' restores its
    // transparent corners. Cached per colour.
    getTintedIcon(src, color) {
        const key = `${src}|${color.join(',')}`;
        let canvas = this._tinted.get(key);
        if (canvas) return canvas;
        const img = this.getIcon(src);
        if (!img) return null;
        canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0);
        c.globalCompositeOperation = 'color';
        c.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.globalCompositeOperation = 'destination-in';
        c.drawImage(img, 0, 0);
        this._tinted.set(key, canvas);
        return canvas;
    }

    /**
     * Names whatever is drawn under a screen point, honouring the layer checkboxes.
     * Markers (crypts, anchors, landmarks) win over units; among units the nearest wins.
     *
     * @param {number} clientX Mouse X in viewport pixels.
     * @param {number} clientY Mouse Y in viewport pixels.
     * @return {string|null} Display name, or null if nothing is there.
     */
    describeAt(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const tx = (clientX - rect.left) * (this.canvas.width / rect.width) / this.scale;
        const ty = (clientY - rect.top) * (this.canvas.height / rect.height) / this.scale;
        const ms = this.markerScale();
        // Marker sizes are in canvas px; convert to tiles.
        const iconR = CRYPT_ICON_SIZE * ms / 2 / this.scale;
        const landR = CRYPT_ICON_SIZE * ms * LANDMARK_ICON_SCALE / 2 / this.scale;
        const ruins = this.game.ruins.list;
        const near = (x, y, r) => Math.hypot(tx - x, ty - y) <= r;

        if (this.layerOn('crypts')) {
            for (const ruin of ruins) {
                if (ruin.kind !== 'crypt' || !ruin.discovered) continue;
                if (!near(ruin.x + Math.floor(ruin.w / 2) + 0.5, ruin.y + Math.floor(ruin.h / 2) + 0.5, iconR)) continue;
                const chain = ruin.chain ? `${CRYPT_CONFIG.chainNames[ruin.chain] || ruin.chain} ` : '';
                const state = ruin.anchor?.attuned ? 'attuned' : ruin.ward ? 'warded' : ruin.state === 'sealed' ? 'sealed' : ruin.state === 'cleared' ? 'plundered' : 'breached';
                return `${chain}Crypt (${state}${isCryptComplete(ruin) ? ', complete' : ''})`;
            }
        }
        if (this.detailed && this.layerOn('landmarks')) {
            for (const ruin of ruins) {
                if (ruin.kind !== 'landmark') continue;
                if (near(ruin.x + Math.floor(ruin.w / 2) + 0.5, ruin.y + Math.floor(ruin.h / 2) + 0.5, landR)) return prettyName(ruin.blueprint);
            }
        }

        // Units: hit radius is about one drawn dot.
        const unitR = Math.max(1, Math.round(DOT_SIZE * ms * 0.75) / this.scale);
        let best = null;
        let bestDist = unitR;
        const consider = (u, label) => {
            if (u.hp <= 0) return;
            const d = Math.hypot(tx - (u.x + 0.5), ty - (u.y + 0.5));
            if (d <= bestDist) { bestDist = d; best = label; }
        };
        const unitName = (u, fallback) => ENTITIES[u.type]?.name || (u.type ? prettyName(u.type) : fallback);
        if (this.layerOn('colonists')) for (const c of this.game.colonists) consider(c, c.name || 'Colonist');
        for (const e of this.game.entities) {
            if (e.tamed) {
                if (this.layerOn('tamed')) consider(e, `${e.name || unitName(e, 'Animal')} (tamed)`);
            } else if (e.category === 'animal' && this.layerOn(e.hostile ? 'hostiles' : 'wildlife')) {
                consider(e, unitName(e, 'Animal'));
            }
        }
        if (this.layerOn('hostiles')) {
            for (const r of this.game.raiders) consider(r, ENTITIES[r.type]?.name || (r.char === 'E' ? 'Void Enemy' : 'Raider'));
            if (this.detailed && this.game.waves) for (const en of this.game.waves.enemies) consider(en, unitName(en, 'Enemy'));
        }
        return best;
    }

    markTerrainDirty() {
        this._terrainDirty = true;
    }

    onTouch(e) {
        if (e.touches.length !== 1) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.touches[0].clientX - rect.left) * scaleX / this.scale);
        const y = Math.floor((e.touches[0].clientY - rect.top) * scaleY / this.scale);
        this.game.camera.centerOn(x, y);
        this.onNavigate?.();
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX / this.scale);
        const y = Math.floor((e.clientY - rect.top) * scaleY / this.scale);
        this.game.camera.centerOn(x, y);
        this.onNavigate?.();
    }

    render() {
        const { map, colonists, entities, raiders, camera, weather } = this.game;
        const ctx = this.ctx;
        const season = weather.season;
        const camX = camera.x;
        const camY = camera.y;
        const scale = this.scale;
        const w = CONFIG.MAP_WIDTH * scale;
        const h = CONFIG.MAP_HEIGHT * scale;

        // Rebuild static terrain layer only when something structural changed
        // (roomsDirty, season flip, fire/snow state) or on first render.
        const seasonChanged = season !== this._lastSeason;
        if (this._terrainDirty || seasonChanged) {
            if (!this._terrainImageData) this._terrainImageData = ctx.createImageData(w, h);
            const data = this._terrainImageData.data;
            const rowBytes = w * 4;

            for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
                const row = map[y];
                const rowStart = y * scale * rowBytes;
                // Fill the first pixel row of this tile row, then copy it down.
                for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                    const color = this.getTileColor(row[x], season);
                    let idx = rowStart + x * scale * 4;
                    for (let dx = 0; dx < scale; dx++, idx += 4) {
                        data[idx] = color[0]; data[idx+1] = color[1]; data[idx+2] = color[2]; data[idx+3] = 255;
                    }
                }
                for (let dy = 1; dy < scale; dy++) {
                    data.copyWithin(rowStart + dy * rowBytes, rowStart, rowStart + rowBytes);
                }
            }

            this._terrainDirty = false;
            this._lastSeason = season;
            // Composite buffer must also be regenerated
            this._compositeImageData = null;
        }

        // Composite = terrain + entity dots. Rebuild every render call since
        // entities move, but copying the terrain buffer is cheap (typed array copy).
        if (!this._compositeImageData) this._compositeImageData = ctx.createImageData(w, h);
        this._compositeImageData.data.set(this._terrainImageData.data);
        const data = this._compositeImageData.data;

        const markerScale = this.markerScale();
        // The full map outlines its dots (they sit on busier, larger terrain) and draws them slightly smaller.
        const dotSize = Math.max(3, Math.round(DOT_SIZE * markerScale * (this.detailed ? 0.75 : 1)));
        const outline = this.detailed;
        const showTamed = this.layerOn('tamed');
        const showWildlife = this.layerOn('wildlife');
        const showHostiles = this.layerOn('hostiles');
        // Hostiles and colonists are drawn last, over the ruin and crypt markers, so they never get lost under them.
        const topDots = [];
        for (const e of entities) {
            if (e.hp <= 0) continue;
            if (e.tamed) {
                if (showTamed) this.drawDot(data, e.x, e.y, [100, 200, 100], dotSize, outline);
            } else if (e.category === 'animal') {
                if (!(e.hostile ? showHostiles : showWildlife)) continue;
                if (e.hostile) topDots.push([e.x, e.y, [180, 50, 50]]);
                else this.drawDot(data, e.x, e.y, [150, 120, 80], dotSize, outline);
            }
        }
        if (showHostiles) {
            for (const r of raiders) {
                if (r.hp > 0) topDots.push([r.x, r.y, [255, 50, 50]]);
            }
            // Wave enemies are only shown on the full map; the footer minimap never drew them.
            if (this.detailed && this.game.waves) {
                for (const en of this.game.waves.enemies) {
                    if (en.hp > 0) topDots.push([en.x, en.y, [255, 50, 50]]);
                }
            }
        }
        if (this.layerOn('colonists')) {
            for (const c of colonists) {
                if (c.hp > 0) topDots.push([c.x, c.y, [255, 255, 0]]);
            }
        }

        ctx.putImageData(this._compositeImageData, 0, 0);

        const ruins = this.game.ruins.list;
        const lineWidth = Math.max(1, markerScale * 0.75);

        // Landmarks (full map only): the gold sprite on the centre of each ruin.
        ctx.imageSmoothingEnabled = false;
        if (this.detailed && this.layerOn('landmarks')) {
            const icon = this.getIcon(LANDMARK_ICON);
            const size = CRYPT_ICON_SIZE * markerScale * LANDMARK_ICON_SCALE;
            for (const ruin of ruins) {
                if (ruin.kind !== 'landmark') continue;
                const cx = (ruin.x + Math.floor(ruin.w / 2) + 0.5) * scale;
                const cy = (ruin.y + Math.floor(ruin.h / 2) + 0.5) * scale;
                if (icon) this.drawOutlinedIcon(icon, this.getSilhouette(LANDMARK_ICON), cx, cy, size, lineWidth * LANDMARK_ICON_SCALE);
            }
        }

        // Discovered crypts, drawn after the pixel layer: the grayscale crypt sprite
        // tinted by state (sealed, warded, breached, plundered).
        if (this.layerOn('crypts')) {
            const iconSize = CRYPT_ICON_SIZE * markerScale;
            for (const ruin of ruins) {
                if (ruin.kind !== 'crypt' || !ruin.discovered) continue;
                const icon = this.getTintedIcon(CRYPT_ICON, cryptColor(ruin));
                if (!icon) continue;
                const cx = (ruin.x + Math.floor(ruin.w / 2) + 0.5) * scale;
                const cy = (ruin.y + Math.floor(ruin.h / 2) + 0.5) * scale;
                this.drawOutlinedIcon(icon, this.getSilhouette(CRYPT_ICON), cx, cy, iconSize, lineWidth);
                if (isCryptComplete(ruin)) this.drawCheckmark(cx + iconSize * 0.3, cy + iconSize * 0.3, iconSize * 0.55, lineWidth);
            }
        }

        for (const [x, y, color] of topDots) this.drawDotOnCanvas(x, y, color, dotSize, outline);

        if (this.layerOn('camera')) {
            if (this.detailed) {
                // Full map: a red arrow whose tip sits on the tile at the centre of the main view.
                const tipX = (camX + CONFIG.VIEWPORT_WIDTH / 2) * scale;
                const tipY = (camY + CONFIG.VIEWPORT_HEIGHT / 2) * scale;
                const len = CRYPT_ICON_SIZE * markerScale * 0.55;
                const half = len * 0.4;
                const shaft = half * 0.45;
                const neck = len * 0.45;
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX + half, tipY - neck);
                ctx.lineTo(tipX + shaft, tipY - neck);
                ctx.lineTo(tipX + shaft, tipY - len);
                ctx.lineTo(tipX - shaft, tipY - len);
                ctx.lineTo(tipX - shaft, tipY - neck);
                ctx.lineTo(tipX - half, tipY - neck);
                ctx.closePath();
                ctx.fillStyle = 'rgb(235,40,40)';
                ctx.fill();
                ctx.lineWidth = lineWidth;
                ctx.lineJoin = 'miter';
                ctx.strokeStyle = '#000000';
                ctx.stroke();
            } else {
                // Footer minimap: camera rectangle, stroked inside its bounds so the thicker line isn't clipped.
                const frame = FRAME_WIDTH * markerScale;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = frame;
                ctx.strokeRect(
                    camX * scale + frame / 2,
                    camY * scale + frame / 2,
                    CONFIG.VIEWPORT_WIDTH * scale - frame,
                    CONFIG.VIEWPORT_HEIGHT * scale - frame
                );
            }
        }

        this._lastCamX = camX;
        this._lastCamY = camY;
    }

    // Square dot of `size` canvas pixels centred on the tile, with an optional 1px dark outline.
    drawDot(data, x, y, color, size = this.scale, outline = false) {
        const w = CONFIG.MAP_WIDTH * this.scale;
        const h = CONFIG.MAP_HEIGHT * this.scale;
        const x0 = Math.round((x + 0.5) * this.scale - size / 2);
        const y0 = Math.round((y + 0.5) * this.scale - size / 2);
        const pad = outline ? 1 : 0;
        for (let dy = -pad; dy < size + pad; dy++) {
            for (let dx = -pad; dx < size + pad; dx++) {
                const px = x0 + dx;
                const py = y0 + dy;
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                const edge = dx < 0 || dy < 0 || dx >= size || dy >= size;
                const c = edge ? OUTLINE_COLOR : color;
                const idx = (py * w + px) * 4;
                data[idx] = c[0];
                data[idx + 1] = c[1];
                data[idx + 2] = c[2];
                data[idx + 3] = 255;
            }
        }
    }

    // Same square as drawDot, painted on the canvas so it lands above the ruin markers.
    drawDotOnCanvas(x, y, color, size, outline) {
        const ctx = this.ctx;
        const x0 = Math.round((x + 0.5) * this.scale - size / 2);
        const y0 = Math.round((y + 0.5) * this.scale - size / 2);
        if (outline) {
            ctx.fillStyle = `rgb(${OUTLINE_COLOR[0]},${OUTLINE_COLOR[1]},${OUTLINE_COLOR[2]})`;
            ctx.fillRect(x0 - 1, y0 - 1, size + 2, size + 2);
        }
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        ctx.fillRect(x0, y0, size, size);
    }

    getTileColor(tile, season) {
        if (tile.sealed) return [8, 8, 12];
        if (tile.onFire && this.layerOn('fires')) return [255, 68, 0];
        // Decorative plants show the terrain beneath rather than a building pixel.
        if (tile.structure && this.layerOn('buildings') && BUILDINGS[tile.structure]?.structureType !== 'plant') {
            const bDef = BUILDINGS[tile.structure];
            if (bDef) {
                const type = bDef.structureType;
                if (type === 'wall') return [180, 180, 180];
                if (type === 'door') return [150, 120, 60];
            }
            return [120, 100, 60];
        }
        if (tile.floor && this.layerOn('buildings')) return [80, 80, 80];
        if (tile.zone && this.layerOn('farms')) {
            if (tile.zone.state === 'ready') return [220, 200, 0];
            if (tile.zone.state === 'growing') return [60, 150, 30];
            return [80, 60, 0];
        }
        const base = TERRAIN_COLORS[tile.terrain] || UNKNOWN_TERRAIN_COLOR;
        if (tile.resource) {
            if (tile.resource.type === 'tree') {
                if (this.layerOn('trees')) {
                    // Darkened terrain tinted leaf-green (or orange in autumn), so trees
                    // keep a hint of their biome instead of all looking the same.
                    const dark = base.map(c => Math.round(c * 0.55));
                    return mix(dark, season === 'autumn' ? AUTUMN_LEAF_COLOR : TREE_LEAF_COLOR, 0.55);
                }
            } else if (this.layerOn('ore')) {
                return ORE_COLORS[tile.resource.type] || [130, 130, 130];
            }
        }
        // Snow cover is near-white but keeps a faint tint of the ground beneath.
        if (tile.snowCovered) return mix([208, 214, 226], base, 0.18);
        return base;
    }
}

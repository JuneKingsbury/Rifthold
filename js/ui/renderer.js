import { CONFIG, GRASS_TERRAIN, TILE_COLORS, BUILDINGS, PLANT_STRUCTURES, ALL_ITEMS, RENDER_CONFIG, COMBAT_VISUALS, COMPLEX_STRUCTURES, SEASON_EFFECTS } from '../core/config.js';
import { writeTileVisuals, SEALED_BG } from '../world/map.js';
import { OverlayRenderer, spawnParticle, uiFontScale } from './overlay-renderer.js';
import { CrtRenderer } from './crt-renderer.js';
import { SkinManager } from './skin-manager.js';
import { getEntityRenderPos, isEntityMoving } from '../systems/movement-lerp.js';
import { getEntityTransform, getTreeSway, getGrassSway, getCropSway, getWaterWave, windStrengthFor, setSwayWind } from './entity-animation.js';

// The four cardinal neighbors checked per tile when dithering terrain edges.
// Hoisted to module scope so it isn't reallocated per tile, per frame.
const DITHER_DIRECTIONS = [
    { dir: 'north', dx: 0, dy: -1 },
    { dir: 'south', dx: 0, dy: 1 },
    { dir: 'west', dx: -1, dy: 0 },
    { dir: 'east', dx: 1, dy: 0 },
];
const DITHER_DISTANCE_MAP = { none: 0, minimal: 0.12, light: 0.2, normal: 0.3, heavy: 0.45, extreme: 0.6 };
const DITHER_QUALITY_MAP = { chunky: 4, low: 3, medium: 2, high: 1 };
const NEIGHBOR_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Static ground cache chunking (see _terrainChunks). A chunk is a square of
// tiles about TERRAIN_CHUNK_TARGET_PX physical pixels across, baked lazily the
// first time it is visible. Chunks off screen are evicted least-recently-used
// once all chunk canvases together exceed TERRAIN_CHUNK_BUDGET_PX pixels.
// Above TERRAIN_CACHE_MAX_TILE_PX per tile (far zoomed in, few tiles on
// screen) the cache is off and ground draws live, which is already cheap there.
const TERRAIN_CHUNK_TARGET_PX = 1024;
const TERRAIN_CHUNK_BUDGET_PX = 16 * 1024 * 1024;
const TERRAIN_CACHE_MAX_TILE_PX = 256;
// Per-frame time budget (ms) for baking newly visible chunks. At least one chunk
// bakes per frame; the rest of the visible tiles draw live until baked.
const TERRAIN_CHUNK_BAKE_BUDGET_MS = 6;

// Per-tile bake state flags for the static ground cache (see _bakedKind).
const BAKE_GROUND = 1;   // tile was baked as plain ground
const BAKE_SPRITE = 2;   // ...and its ground sprite existed, so the blit fully covers it
const BAKE_SNOW = 4;     // ...while snow covered

// Upper bound on live water ripples (rain impacts + footsteps).
const MAX_WATER_RIPPLES = 160;
// Ripples are bucketed by alpha so each bucket strokes as one path.
const RIPPLE_ALPHA_BUCKETS = 12;

// Memoized `<terrain>_autumn` sprite keys, so the live ground path doesn't
// concatenate a string per tile per frame.
const _autumnKeys = new Map();
function autumnKey(terrain) {
    let k = _autumnKeys.get(terrain);
    if (k === undefined) { k = terrain + '_autumn'; _autumnKeys.set(terrain, k); }
    return k;
}

// Memoized ground-variant keys for transparent floors (see _resolveFloorSprite),
// for the same reason: terrain -> (':snow' | season) -> key.
const _floorGroundKeys = new Map();
function floorGroundKey(terrain, snow, season) {
    let byVariant = _floorGroundKeys.get(terrain);
    if (!byVariant) { byVariant = new Map(); _floorGroundKeys.set(terrain, byVariant); }
    const variant = snow ? ':snow' : (season || '');
    let k = byVariant.get(variant);
    if (k === undefined) {
        k = terrain + (snow ? ':snow' : (season ? ':' + season : ''));
        byVariant.set(variant, k);
    }
    return k;
}

export class Renderer {
    constructor(container, skinManager) {
        this.container = container;
        this.skinManager = skinManager || new SkinManager();
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.style.display = 'block';
        container.innerHTML = '';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.overlayRenderer = new OverlayRenderer(container);
        this.crtRenderer = new CrtRenderer(container);
        this.crtRenderer.initWarpMap();

        this.charWidth = 0;
        this.charHeight = 0;
        this.fontSize = RENDER_CONFIG.fontSize;
        this._lastViewportW = 0;
        this._lastViewportH = 0;

        // Reusable Maps cleared each frame to avoid GC pressure
        this._entityMap = new Map();
        this._rallySet = new Map();
        this._portalMap = new Map();
        this._portalPathMap = new Map();
        this._effectMap = new Map();
        this._movingEntities = [];
        // Deferred melee attack effects (swing/stab). Because these are nudged toward
        // the target, they can extend into an adjacent tile that is painted later in
        // the tile loop. Collecting them here and drawing after all tiles/entities
        // keeps the effect on top of the target tile instead of being cut in half.
        this._attackFx = [];
        this._structureMap = new Map();

        // Reused scratch object for tile visuals so the hot tile loop doesn't
        // allocate a fresh {char,color,bg} per visible tile (~16k/frame zoomed out).
        this._tileVisuals = { char: '', color: '', bg: '' };

        // --- Static ground cache ---
        // Offscreen canvases that bake the static ground layer (terrain / floor /
        // snow sprite + terrain dither) for every "pure ground" tile: tiles with no
        // structure, resource, or zone. The visible chunks are blitted with one
        // drawImage each per frame, replacing thousands of per-tile ground draws +
        // up-to-4 dither composites each (measured at ~99% of frame time when
        // zoomed out). Everything dynamic (structures, resources, trees, crops,
        // entities, effects, tints) still draws live on top, so visuals are
        // identical. The map is split into chunks (see TERRAIN_CHUNK_*) baked
        // lazily when first visible, so the cache works on any map size and a full
        // invalidation only costs re-baking what is on screen.
        // markTerrainDirty() invalidates every chunk (season, skin, load);
        // markTileDirty() patches one tile. The bake is also self-healing: each
        // tile records what it was baked as (_bakedKind/_bakedFloor/_bakedTerrain),
        // and a visible tile whose current state disagrees draws live and is
        // re-patched before the next frame, so a missed invalidation never shows as
        // a hole. Chunks are in physical (device) pixels at the current cell size.
        this._terrainChunks = new Map();   // chunk index -> { canvas, ctx, lastUsed }
        this._chunkBaked = null;           // Uint8Array, 1 = chunk baked and current
        this._chunkTiles = 0;              // chunk side length in tiles
        this._chunksX = 0;
        this._chunkPx = 0;                 // total pixels across all chunk canvases
        this._frameNo = 0;
        this._terrainDirty = true;
        this._terrainKey = '';
        this._bakedKind = null;      // Uint8Array of BAKE_* flags per tile
        this._bakedFloor = null;     // floor key each tile was baked with
        this._bakedTerrain = null;   // terrain each tile was baked with
        this._bakedMap = null;       // map array the bake was built from
        this._bakeTileP = 0;         // physical px per tile in the bake
        this._bakeSeason = null;
        this._bakeDither = null;     // dither args the bake was built with
        this._pendingTilePatches = new Set();
        this._dpr = 1;
        // While the user is actively zooming, the cell size (and thus the bake key)
        // changes every step, and a full-map rebuild per step would be a burst of
        // heavy frames worse than just drawing the viewport live. So we defer baking:
        // measureFont() stamps _lastZoomChangeMs, and the cache is only (re)built once
        // zoom has been stable for _zoomSettleMs. During the settle window the tile
        // loop draws ground live (the pre-cache path), which is smooth for a single
        // viewport. Set to 0 to disable deferral. Uses performance.now() (wall clock),
        // independent of game tick/pause.
        this._lastZoomChangeMs = -Infinity;
        this._zoomSettleMs = 150;

        // Terrain dithering
        this._ditherMasks = null;
        this._ditherTileSize = 0;
        this._ditherCache = new Map();

        // Per-tile amplitude boost for disturbed grass (entity footstep wake)
        this._grassBoost = new Map();
        // Per-tile amplitude boost for disturbed crops (same mechanic as grass)
        this._cropBoost = new Map();
        // Water ripples (rain impacts + footsteps)
        this._waterRipples = [];
        // Brief flash when an entity enters a structure tile (door effect)
        this._doorFlash = new Map();
        // Set of "wx,wy" keys for buildings with a colonist actively working in them
        this._workingBuildingSet = new Set();

        this.measureFont(RENDER_CONFIG.fontSize);
    }

    measureFont(fontSize) {
        this.fontSize = fontSize;
        this.ctx.font = `${fontSize}px 'Courier New', monospace`;
        const metrics = this.ctx.measureText('M');
        this._textWidth = Math.ceil(metrics.width);
        const dpr = window.devicePixelRatio || 1;
        const logicalHeight = Math.ceil(fontSize * RENDER_CONFIG.fontHeightMult);
        const physHeight = Math.round(logicalHeight * dpr);  // integer physical pixels
        const prevCharWidth = this.charWidth;
        this._dpr = dpr;
        this._tileP = physHeight;                             // physical px per tile (integer)
        this.charHeight = physHeight / dpr;                   // CSS pixels (possibly fractional)
        this.charWidth = this.charHeight;
        this._textOffsetX = Math.floor((this.charWidth - this._textWidth) / 2);
        // Note when the zoom (cell size) actually changed, so the terrain cache can
        // defer its full-map rebuild until zooming settles (see _zoomSettleMs). The
        // initial measure (prevCharWidth === 0) is not a zoom gesture, so skip it.
        if (prevCharWidth !== 0 && this.charWidth !== prevCharWidth) {
            this._lastZoomChangeMs = performance.now();
        }
        this._resizeCanvas();
    }

    _resizeCanvas() {
        const dpr = this._dpr;
        const w = (CONFIG.VIEWPORT_WIDTH + 1) * this.charWidth;
        const h = (CONFIG.VIEWPORT_HEIGHT + 1) * this.charHeight;
        const bw = Math.round(w * dpr);
        const bh = Math.round(h * dpr);
        if (this.canvas.width !== bw || this.canvas.height !== bh || this._ctxDpr !== dpr) {
            this.canvas.width = bw;
            this.canvas.height = bh;
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this._ctxDpr = dpr;
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.font = `${this.fontSize}px 'Courier New', monospace`;
            this.ctx.textBaseline = 'top';
        }
        this.overlayRenderer.resize(w, h, dpr);
        this.crtRenderer.resize(w, h, dpr);
        // The overlay canvases are absolutely positioned, i.e. from the
        // container's padding edge, while the game canvas sits inside its padding.
        // Offset them by the padding so overlay pixels line up with the tiles.
        const cs = getComputedStyle(this.container);
        for (const c of [this.overlayRenderer.canvas, this.crtRenderer.canvas]) {
            c.style.left = cs.paddingLeft;
            c.style.top = cs.paddingTop;
        }
        this._lastViewportW = CONFIG.VIEWPORT_WIDTH;
        this._lastViewportH = CONFIG.VIEWPORT_HEIGHT;
    }

    _resolveSprite(tile, entity, season, highlight, tileKey) {
        const sm = this.skinManager;
        if (entity) {
            if (entity.type === 'colonist') {
                if (entity.sleeping) {
                    const key = entity.sleepingInBed ? 'colonist_sleeping' : 'colonist_sleeping_ground';
                    const s = sm.getSprite('entities', key) || sm.getColonistSleepingSprite();
                    if (s) return s;
                }
                if (entity.armorKey || entity.helmetKey || entity.clothesKey || entity.weaponKey || entity.toolKey) {
                    const comp = sm.getCompositedColonistSprite(entity.colonistId, entity.drafted, entity.race, entity.armorKey, entity.helmetKey, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, entity.weaponKey, entity.toolKey, entity.clothesKey, highlight);
                    if (comp) return comp;
                }
                return sm.getCompositedColonistSprite(entity.colonistId, entity.drafted, entity.race, null, null, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, null, null, null, highlight);
            }
            if (entity.type === 'golem') {
                if (entity.golemType) {
                    const specific = sm.getSprite('entities', entity.golemType);
                    if (specific) return specific;
                }
                return sm.getSprite('entities', 'golem');
            }
            if (entity.type === 'raider') {
                if (entity.entityType) {
                    const specific = sm.getSprite('entities', entity.entityType);
                    if (specific) return specific;
                }
                return sm.getSprite('entities', 'raider');
            }
            if (entity.type === 'wave_enemy') {
                if (entity.entityType) {
                    const specific = sm.getSprite('entities', entity.entityType);
                    if (specific) return specific;
                }
                return sm.getSprite('entities', 'wave_enemy') || sm.getSprite('entities', 'raider');
            }
            if (entity.type === 'rally') {
                return sm.getSprite('effects', 'rally');
            }
            if (entity.type) {
                return sm.getSprite('entities', entity.type);
            }
        }
        if (tile.structure) {
            if (tileKey !== undefined && this._doorFlash.get(tileKey) > 0
                && BUILDINGS[tile.structure]?.structureType === 'door') {
                const openSprite = sm.getSprite('buildings', tile.structure + '_open');
                if (openSprite) return openSprite;
            }
            if (PLANT_STRUCTURES.has(tile.structure)) return this._resolvePlantSprite(tile.structure, season);
            return sm.getSprite('buildings', tile.structure);
        }
        if (tile.zone) {
            const state = tile.zone.state || 'empty';
            if (tile.zone.crop && state !== 'empty') {
                // For non-empty planted tiles, return the static plot base so the
                // crop sprite is drawn separately as a swaying overlay on top.
                // Prefer farm_planted. Fall back to farm_empty so soil stays static.
                return sm.getSprite('farms', 'farm_planted') || sm.getSprite('farms', 'farm_empty');
            }
            return sm.getSprite('farms', 'farm_' + state);
        }
        if (tile.resource) return this._resolveResourceSprite(tile, season);
        if (tile.floor) return this._resolveFloorSprite(tile, season);
        const grassy = GRASS_TERRAIN.has(tile.terrain);
        if (tile.snowCovered && grassy) return sm.getSprite('effects', 'snow');
        if (season === 'autumn' && grassy) {
            return sm.getSprite('terrain', autumnKey(tile.terrain)) || sm.getSprite('terrain', tile.terrain);
        }
        return sm.getSprite('terrain', tile.terrain);
    }

    // Plants try `<key>_<season>` first, so a skin can draw seasonal variants for
    // only the plants it wants, then fall back to the plain `<key>` sprite.
    _resolvePlantSprite(key, season) {
        const sm = this.skinManager;
        return (season && sm.getSprite('buildings', key + '_' + season)) || sm.getSprite('buildings', key);
    }

    _resolveGroundSprite(tile, season) {
        if (tile.floor) {
            const floorSprite = this._resolveFloorSprite(tile, season);
            if (floorSprite) return floorSprite;
        }
        return this._resolveTerrainBaseSprite(tile, season);
    }

    // The bare terrain sprite a tile would show with no floor/structure/resource
    // on it (terrain itself, or its seasonal snow/autumn variant for grass).
    _resolveTerrainBaseSprite(tile, season) {
        const sm = this.skinManager;
        const grassy = GRASS_TERRAIN.has(tile.terrain);
        if ((tile.snowCovered || season === 'winter') && grassy) {
            return sm.getSprite('effects', 'snow') || sm.getSprite('terrain', tile.terrain);
        }
        if (season === 'autumn' && grassy) {
            return sm.getSprite('terrain', autumnKey(tile.terrain)) || sm.getSprite('terrain', tile.terrain);
        }
        return sm.getSprite('terrain', tile.terrain);
    }

    // A floor flagged transparentFloor (e.g. gravel/brick paths) only partially
    // covers its tile, so its sprite is composited over the terrain beneath it
    // rather than replacing it outright. Non-transparent floors (wood/stone/
    // brick) behave exactly as before: a plain lookup that fully replaces the
    // ground when present.
    _resolveFloorSprite(tile, season) {
        const fDef = BUILDINGS[tile.floor];
        if (!fDef || !fDef.transparentFloor) {
            return this.skinManager.getSprite('floors', tile.floor);
        }
        const groundSprite = this._resolveTerrainBaseSprite(tile, season);
        const groundKey = floorGroundKey(tile.terrain, tile.snowCovered, season);
        return this.skinManager.getFloorOverGroundSprite(tile.floor, groundKey, groundSprite);
    }

    _resolveMaterialSprite(tile, season) {
        const sm = this.skinManager;
        if (tile.resource) return this._resolveResourceSprite(tile, season);
        return null;
    }

    // Resource sprite for a tile, preferring a variant for where it stands:
    //   * trees in the swamp biome  -> `tree_swamp`  (and `tree_swamp_<season>`)
    //   * any resource on red rock  -> `<type>_red_rock`, e.g. `iron_ore_red_rock`
    // Each tries the season-specific art first, then the plain variant, and finally
    // falls back to the regular `<type>_<season>` / `<type>` sprite, so a skin
    // without the variant art looks exactly as before.
    _resolveResourceSprite(tile, season) {
        const sm = this.skinManager;
        const type = tile.resource.type;
        const variants = [];
        if (type === 'tree' && tile.biome === 'swamp') variants.push('tree_swamp');
        if (tile.terrain === 'red_rock') variants.push(type + '_red_rock');
        for (const key of variants) {
            const sprite = sm.getSprite('resources', key + '_' + season) || sm.getSprite('resources', key);
            if (sprite) return sprite;
        }
        return sm.getSprite('resources', type + '_' + season) || sm.getSprite('resources', type);
    }

    // A tile bakes into the static ground cache only when its ground layer is
    // fully static this frame: no structure, resource, or zone. Such a tile
    // draws exactly _resolveGroundSprite(tile) plus terrain dither, both of which
    // depend only on terrain/floor/snow and neighbor terrain, never on time or
    // entities. Tiles that fail this test (structures, trees/ore, farm plots)
    // keep drawing live so their dynamic parts stay correct.
    _isBakeableGround(tile) {
        return !tile.structure && !tile.resource && !tile.zone;
    }

    // Invalidate the whole static ground cache so it re-bakes on the next frame.
    // Cheap to call (just flips a flag), but the re-bake walks the entire map, so
    // prefer markTileDirty() when only known tiles changed. Use this for changes
    // that touch every tile: season, skin, or a replaced map.
    markTerrainDirty() {
        this._terrainDirty = true;
    }

    // Queue one tile of the static ground cache for a re-patch before the next
    // draw. Call when a tile's ground may look different: floor built/removed,
    // snow fell/melted, a structure/resource/zone added or cleared, terrain
    // changed (its neighbors' dither is re-patched too). A no-op while the cache
    // is off, a full invalidation is pending, or the tile's chunk isn't baked
    // (it will bake fresh). Missing a call is not fatal: the tile loop re-patches
    // any visible tile whose bake state is stale.
    markTileDirty(x, y) {
        if (!this._chunkBaked || this._terrainDirty) return;
        if (x < 0 || y < 0 || x >= CONFIG.MAP_WIDTH || y >= CONFIG.MAP_HEIGHT) return;
        this._pendingTilePatches.add(y * CONFIG.MAP_WIDTH + x);
    }

    // Chunk index of a tile (tile coords must be on the map).
    _chunkOf(wx, wy) {
        const C = this._chunkTiles;
        return ((wy / C) | 0) * this._chunksX + ((wx / C) | 0);
    }

    // Starts a fresh bake generation at the current cell size, season and dither
    // settings: every chunk is marked unbaked (canvases are kept for reuse when
    // their size still fits). Chunks then bake lazily as they become visible.
    // Returns false (cache off) when zoomed in past TERRAIN_CACHE_MAX_TILE_PX,
    // where live ground drawing is already cheap. Skin mode only: ASCII ground is
    // a single fillText/fillRect per tile, already the cheap path.
    _resetTerrainCache(game, season, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize) {
        const P = this._tileP;
        const mapW = CONFIG.MAP_WIDTH;
        const mapH = CONFIG.MAP_HEIGHT;
        this._pendingTilePatches.clear();
        this._terrainDirty = false;
        this._bakedMap = game.map;
        const mapResized = mapW !== this._bakeMapW || mapH !== this._bakeMapH;
        this._bakeMapW = mapW;
        this._bakeMapH = mapH;
        if (P > TERRAIN_CACHE_MAX_TILE_PX) {
            this._dropTerrainChunks();
            this._chunkBaked = null;
            return false;
        }
        const C = Math.max(4, Math.floor(TERRAIN_CHUNK_TARGET_PX / P));
        const chunksX = Math.ceil(mapW / C);
        const chunksY = Math.ceil(mapH / C);
        // Chunk canvases are sized from P, C and the map edge, so any change to
        // those drops them; otherwise they are simply re-baked in place.
        if (P !== this._bakeTileP || C !== this._chunkTiles || chunksX !== this._chunksX
            || !this._chunkBaked || this._chunkBaked.length !== chunksX * chunksY || mapResized) {
            this._dropTerrainChunks();
            this._chunkBaked = new Uint8Array(chunksX * chunksY);
        } else {
            this._chunkBaked.fill(0);
        }
        this._chunkTiles = C;
        this._chunksX = chunksX;
        const n = mapW * mapH;
        if (!this._bakedKind || this._bakedKind.length !== n) {
            this._bakedKind = new Uint8Array(n);
            this._bakedFloor = new Array(n);
            this._bakedTerrain = new Array(n);
        }
        this._bakeTileP = P;
        this._bakeSeason = season;
        this._bakeDither = [ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize];
        return true;
    }

    _dropTerrainChunks() {
        for (const chunk of this._terrainChunks.values()) chunk.canvas.width = 0;
        this._terrainChunks.clear();
        this._chunkPx = 0;
    }

    // Bakes every tile of chunk `ci` into its canvas (creating it if needed).
    _bakeChunk(game, ci) {
        const C = this._chunkTiles;
        const P = this._bakeTileP;
        const cx = ci % this._chunksX;
        const cy = (ci - cx) / this._chunksX;
        const x0 = cx * C;
        const y0 = cy * C;
        const x1 = Math.min(CONFIG.MAP_WIDTH, x0 + C);
        const y1 = Math.min(CONFIG.MAP_HEIGHT, y0 + C);
        let chunk = this._terrainChunks.get(ci);
        if (!chunk) {
            const canvas = document.createElement('canvas');
            canvas.width = (x1 - x0) * P;
            canvas.height = (y1 - y0) * P;
            const cctx = canvas.getContext('2d');
            cctx.imageSmoothingEnabled = false;
            chunk = { canvas, ctx: cctx, lastUsed: 0 };
            this._terrainChunks.set(ci, chunk);
            this._chunkPx += canvas.width * canvas.height;
        } else {
            chunk.ctx.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
        }
        for (let wy = y0; wy < y1; wy++) {
            for (let wx = x0; wx < x1; wx++) {
                this._bakeTile(game, wx, wy, chunk.ctx, (wx - x0) * P, (wy - y0) * P, false);
            }
        }
        this._chunkBaked[ci] = 1;
        return chunk;
    }

    // Evicts least-recently-used chunks that weren't drawn this frame until the
    // chunk canvases fit TERRAIN_CHUNK_BUDGET_PX (visible chunks are never evicted).
    _evictTerrainChunks() {
        while (this._chunkPx > TERRAIN_CHUNK_BUDGET_PX) {
            let oldestKey = -1;
            let oldest = null;
            for (const [k, chunk] of this._terrainChunks) {
                if (chunk.lastUsed === this._frameNo) continue;
                if (!oldest || chunk.lastUsed < oldest.lastUsed) { oldest = chunk; oldestKey = k; }
            }
            if (!oldest) return;
            this._chunkPx -= oldest.canvas.width * oldest.canvas.height;
            oldest.canvas.width = 0;
            this._terrainChunks.delete(oldestKey);
            this._chunkBaked[oldestKey] = 0;
        }
    }

    // Bakes one tile at (px, py) of `tctx` (physical pixels) and records the
    // state it was baked from, so the tile loop can tell when it goes stale.
    // Non-bakeable tiles are left transparent (they draw live). `clear` wipes the
    // tile first (needed when patching in place, not when baking a whole chunk).
    _bakeTile(game, wx, wy, tctx, px, py, clear) {
        const P = this._bakeTileP;
        const season = this._bakeSeason;
        const map = game.map;
        const tile = map[wy][wx];
        const k = wy * CONFIG.MAP_WIDTH + wx;
        if (clear) tctx.clearRect(px, py, P, P);
        this._bakedFloor[k] = tile.floor;
        this._bakedTerrain[k] = tile.terrain;
        if (!this._isBakeableGround(tile)) {
            this._bakedKind[k] = 0;
            return;
        }
        // Bake the terrain background color under the ground sprite, exactly
        // as the live path fills it before drawing the sprite. This keeps
        // output pixel-identical even if a terrain sprite is semi-transparent
        // (its gaps show the terrain bg, not the main canvas color).
        const tv = writeTileVisuals(tile, season, this._tileVisuals);
        let bakeBg = tv.bg;
        if (tile.terrain === 'grass' && !tile.snowCovered && season && SEASON_EFFECTS[season] && bakeBg === '#1a2a12') {
            bakeBg = SEASON_EFFECTS[season].grassBg;
        }
        if (bakeBg) {
            tctx.fillStyle = bakeBg;
            tctx.fillRect(px, py, P, P);
        }
        // The live path draws the shadow sprite under the ground sprite for
        // every bare tile (noShadow is false without a structure). Bake it
        // too so output matches even where the ground sprite has transparency.
        const shadow = this.skinManager.getSprite('effects', 'shadow');
        if (shadow) tctx.drawImage(shadow, px, py, P, P);
        const ground = this._resolveGroundSprite(tile, season);
        if (ground) tctx.drawImage(ground, px, py, P, P);
        // Dither only on bare terrain, matching the live path's `canDither`
        // (no structure/resource/zone/floor). Bakeable tiles already exclude
        // structure/resource/zone, so only the floor case must be excluded
        // here. Dither depends solely on neighbor terrain, so it is static.
        if (!tile.floor) {
            const [ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize] = this._bakeDither;
            this._drawTerrainDither(tctx, tile, wx, wy, px, py, P, P, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
        }
        this._bakedKind[k] = BAKE_GROUND | (ground ? BAKE_SPRITE : 0) | (tile.snowCovered ? BAKE_SNOW : 0);
    }

    // True when a tile no longer matches what the ground cache baked for it.
    _isBakeStale(tile, k) {
        if (tile.terrain !== this._bakedTerrain[k]) return true;
        const kind = this._bakedKind[k];
        if (!this._isBakeableGround(tile)) return kind !== 0;
        return (kind & BAKE_GROUND) === 0
            || tile.floor !== this._bakedFloor[k]
            || !!tile.snowCovered !== ((kind & BAKE_SNOW) !== 0);
    }

    // Applies queued single-tile patches (markTileDirty + stale tiles found by the
    // tile loop), at most `budget` per frame. Leftovers stay queued: until patched
    // those tiles are stale, so the tile loop keeps drawing them live.
    _flushTilePatches(game, budget) {
        const pending = this._pendingTilePatches;
        if (pending.size === 0) return;
        const mapW = CONFIG.MAP_WIDTH;
        const mapH = CONFIG.MAP_HEIGHT;
        let done = 0;
        for (const k of pending) {
            if (done >= budget) break;
            pending.delete(k);
            const wx = k % mapW;
            const wy = (k - wx) / mapW;
            // Tiles in an unbaked chunk get baked fresh with it; nothing to patch.
            const ci = this._chunkOf(wx, wy);
            if (!this._chunkBaked[ci]) continue;
            // A terrain change alters the dither of all four neighbors as well.
            if (game.map[wy][wx].terrain !== this._bakedTerrain[k]) {
                for (const [dx, dy] of NEIGHBOR_OFFSETS) {
                    const nx = wx + dx, ny = wy + dy;
                    if (nx >= 0 && ny >= 0 && nx < mapW && ny < mapH) pending.add(ny * mapW + nx);
                }
            }
            const C = this._chunkTiles;
            const P = this._bakeTileP;
            const chunk = this._terrainChunks.get(ci);
            this._bakeTile(game, wx, wy, chunk.ctx, (wx % C) * P, (wy % C) * P, true);
            done++;
        }
    }

    // Generates per-direction alpha masks for terrain edge dithering using ordered
    // (Bayer matrix) dithering. Each mask is a 1-tile canvas with white pixels where
    // the neighbor terrain should "bleed through". The 4x4 Bayer matrix provides a
    // perceptually even dot pattern that avoids banding artifacts at low densities.
    // The pattern is computed on an integer logical grid (the cell size in CSS
    // pixels, rounded) so per-pixel indexing is exact even when the CSS cell size
    // is fractional (non-integer DPR), then scaled nearest-neighbour up to the
    // physical tile size (_tileP) the bake and the live path draw at.
    _generateDitherMasks(ditherDepthFraction, blockSize) {
        const P = this._tileP;
        const cw = Math.max(1, Math.round(P / this._dpr));
        const ch = cw;
        const depthFrac = ditherDepthFraction ?? RENDER_CONFIG.ditherDepth;
        const bs = blockSize || 1;
        const depth = Math.max(1, Math.round(cw * depthFrac));
        this._ditherTileSize = P;
        this._ditherDepthFraction = depthFrac;
        this._ditherBlockSize = blockSize;
        this._ditherMasks = {};

        const bayer = [
            [ 0,  8,  2, 10],
            [12,  4, 14,  6],
            [ 3, 11,  1,  9],
            [15,  7, 13,  5],
        ];

        for (const dir of ['north', 'south', 'east', 'west']) {
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const mctx = canvas.getContext('2d');
            const imageData = mctx.createImageData(cw, ch);
            const data = imageData.data;

            for (let y = 0; y < ch; y++) {
                for (let x = 0; x < cw; x++) {
                    const bx = Math.floor(x / bs);
                    const by = Math.floor(y / bs);
                    let edgeDist;
                    if (dir === 'north') edgeDist = y;
                    else if (dir === 'south') edgeDist = (ch - 1) - y;
                    else if (dir === 'west') edgeDist = x;
                    else edgeDist = (cw - 1) - x;

                    if (edgeDist >= depth) continue;

                    // t=0 at the edge, t=1 at full depth. intensity peaks at 0.5
                    // at the border and fades to 0, creating a gradient from
                    // "half the pixels lit" at the seam to "none" deeper in.
                    const t = edgeDist / depth;
                    const intensity = 0.5 * (1 - t);
                    // Bayer threshold: each pixel's ordered-dither threshold (0..1).
                    // A pixel lights when its intensity exceeds its threshold,
                    // producing a perceptually even dot pattern without randomness.
                    const threshold = (bayer[by % 4][bx % 4] + 0.5) / 16;
                    if (intensity > threshold) {
                        const idx = (y * cw + x) * 4;
                        data[idx] = 255;
                        data[idx + 1] = 255;
                        data[idx + 2] = 255;
                        data[idx + 3] = 255;
                    }
                }
            }
            mctx.putImageData(imageData, 0, 0);
            let mask = canvas;
            if (cw !== P) {
                mask = document.createElement('canvas');
                mask.width = P;
                mask.height = P;
                const sctx = mask.getContext('2d');
                sctx.imageSmoothingEnabled = false;
                sctx.drawImage(canvas, 0, 0, P, P);
            }
            this._ditherMasks[dir] = mask;
        }
    }

    _getDitherTile(terrain, dir) {
        const key = terrain + ':' + dir;
        if (this._ditherCache.has(key)) return this._ditherCache.get(key);

        const cw = this._tileP;
        const ch = this._tileP;
        const sprite = this.skinManager.getSprite('terrain', terrain);
        if (!sprite) { this._ditherCache.set(key, null); return null; }

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const c = canvas.getContext('2d');
        c.drawImage(sprite, 0, 0, cw, ch);
        c.globalCompositeOperation = 'destination-in';
        c.drawImage(this._ditherMasks[dir], 0, 0, cw, ch);

        this._ditherCache.set(key, canvas);
        return canvas;
    }

    // Draws dithered terrain transitions on edges where a tile borders a different
    // terrain type. For each cardinal neighbor with a different terrain, composites
    // the neighbor's sprite through the directional dither mask (from _generateDitherMasks).
    _drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game, distSetting, depthFrac, qualSetting, blockSize) {
        if (!RENDER_CONFIG.terrainDithering) return;
        // Callers pass the resolved `ditherOn` flag here; false means 'none' (and
        // the masks were never generated).
        if (!distSetting || distSetting === 'none' || !this._ditherMasks) return;

        const baseTerrain = tile.terrain;

        for (const { dir, dx, dy } of DITHER_DIRECTIONS) {
            const nx = wx + dx;
            const ny = wy + dy;
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
            const neighbor = map[ny][nx];
            if (neighbor.terrain === baseTerrain) continue;

            const cached = this._getDitherTile(neighbor.terrain, dir);
            if (!cached) continue;

            ctx.drawImage(cached, px, py, cw, ch);
        }
    }

    // Draws the animated grass-tuft overlay (sways side-to-side in the wind about
    // its base) for one tile. Shared by bare-grass tiles and tree tiles (where the
    // tree sprite is later drawn on top). No-ops gracefully when the art is absent.
    // Returns true if a tuft was drawn.
    // Each grass terrain can have its own tuft art: `<terrain>_tuft` (and
    // `<terrain>_tuft_autumn` in autumn), e.g. swamp_grass_tuft, forest_grass_tuft.
    // When the skin lacks it the tuft falls back to the regular grass art, so every
    // grass terrain animates without new art.
    // Extra sway from an entity walking through or past the tile (0 when none).
    _grassBoostAt(now, tileKey) {
        const boostEntry = this._grassBoost.get(tileKey);
        if (!boostEntry) return 0;
        const t = Math.min((now - boostEntry.startTime) / boostEntry.duration, 1);
        return Math.sin(t * Math.PI) * boostEntry.amp;
    }

    // Wind rotation for a plant structure from its `plant.sway` profile: 'grass'
    // flutters like a tuft (and rustles when walked past), 'stiff' is the grass
    // flutter scaled down for rigid plants, 'shrub' leans like a tree, 'none'
    // stays still. Each is gated by its own animation setting.
    _plantSway(now, tileKey, structure, showTerrainDetail, showTreeSway, detailWind, treeWind) {
        const sway = BUILDINGS[structure]?.plant?.sway;
        if (sway === 'grass' && showTerrainDetail) return getGrassSway(now, tileKey, detailWind, this._grassBoostAt(now, tileKey));
        if (sway === 'stiff' && showTerrainDetail) return getGrassSway(now, tileKey, detailWind, this._grassBoostAt(now, tileKey)) * (RENDER_CONFIG.terrainDetail.stiffSwayScale ?? 0.35);
        if (sway === 'shrub' && showTreeSway) return getTreeSway(now, tileKey, treeWind);
        return 0;
    }

    _drawGrassTuft(ctx, now, tileKey, wind, px, py, cw, ch, season, terrain) {
        const sm = this.skinManager;
        const own = terrain && terrain !== 'grass';
        const tuft = (own && season === 'autumn' && sm.getSprite('effects', terrain + '_tuft_autumn'))
            || (own && sm.getSprite('effects', terrain + '_tuft'))
            || (season === 'autumn' && sm.getSprite('effects', 'grass_tuft_autumn'))
            || sm.getSprite('effects', 'grass_tuft');
        if (!tuft) return false;
        const rot = getGrassSway(now, tileKey, wind, this._grassBoostAt(now, tileKey));
        // Sway about the tuft base (bottom-center).
        this._drawSwayed(ctx, tuft, rot, px, py, cw, ch, px + cw / 2, py + ch);
        return true;
    }

    // Draws animated crop sway on a farm zone tile.
    _drawCropSway(ctx, now, tileKey, wind, px, py, cw, ch, sprite, boostAdd) {
        const boostEntry = this._cropBoost.get(tileKey);
        let boost = boostAdd || 0;
        if (boostEntry) {
            const t = Math.min((now - boostEntry.startTime) / boostEntry.duration, 1);
            boost += Math.sin(t * Math.PI) * boostEntry.amp;
        }
        const rot = getCropSway(now, tileKey, wind, boost);
        this._drawSwayed(ctx, sprite, rot, px, py, cw, ch, px + cw / 2, py + ch);
    }

    // Draw all active water ripples (rain impacts + footsteps). Growth and fade
    // are per second (tuned as per-frame at 60 fps), so refresh rate doesn't
    // change how they look. Ripples are bucketed by alpha and each bucket is
    // stroked as one path rather than one stroke per ripple.
    _drawWaterRipples(ctx, camera, cw, ch, dt) {
        const ripples = this._waterRipples;
        if (ripples.length === 0) return;
        const f = dt * 60;
        let usedBuckets = 0;
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.r += r.speed * f;
            r.alpha -= r.decay * f;
            if (r.alpha <= 0 || r.r > r.maxR) {
                ripples[i] = ripples[ripples.length - 1];
                ripples.length--;
                continue;
            }
            r.bucket = Math.min(RIPPLE_ALPHA_BUCKETS - 1, Math.floor(r.alpha / 0.6 * RIPPLE_ALPHA_BUCKETS));
            usedBuckets |= 1 << r.bucket;
        }
        if (usedBuckets === 0) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let bk = 0; bk < RIPPLE_ALPHA_BUCKETS; bk++) {
            if ((usedBuckets & (1 << bk)) === 0) continue;
            ctx.globalAlpha = (bk + 0.5) / RIPPLE_ALPHA_BUCKETS * 0.6;
            ctx.beginPath();
            for (const r of ripples) {
                if (r.bucket !== bk) continue;
                const sx = (r.x - camera.x + 0.5) * cw;
                const sy = (r.y - camera.y + 0.5) * ch;
                ctx.moveTo(sx + r.r, sy);
                ctx.ellipse(sx, sy, r.r, r.r * 0.4, 0, 0, Math.PI * 2);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _spawnWaterRipple(wx, wy, cw, maxRMult) {
        if (this._waterRipples.length >= MAX_WATER_RIPPLES) return;
        this._waterRipples.push({
            x: wx + (Math.random() - 0.5) * 0.6,
            y: wy + (Math.random() - 0.5) * 0.3,
            r: 1,
            maxR: cw * (maxRMult || 0.8),
            speed: cw * 0.025,
            alpha: 0.6,
            decay: 0.025,
            bucket: 0,
        });
    }

    // Draws the animated water-wave overlay (slow vertical bob + alpha shimmer) for
    // one water tile. Shared by bare-water tiles and water tiles that hold a swimming
    // entity (drawn behind the entity in that case). No-ops gracefully when the art
    // is absent. Returns true if the waves were drawn.
    // Shallow water uses its own `shallow_water_waves` art when the skin has it and
    // otherwise falls back to the regular water waves.
    _drawWaterWaves(ctx, now, tileKey, px, py, cw, ch, terrain) {
        const sm = this.skinManager;
        const waves = (terrain === 'shallow_water' && sm.getSprite('effects', 'shallow_water_waves'))
            || sm.getSprite('effects', 'water_waves');
        if (!waves) return false;
        const w = getWaterWave(now, tileKey);
        ctx.globalAlpha = w.alpha < 0 ? 0 : (w.alpha > 1 ? 1 : w.alpha);
        ctx.drawImage(waves, px, py + w.offsetY, cw, ch);
        ctx.globalAlpha = 1.0;
        return true;
    }

    // Draws a sprite swaying about its base (bottom-center), like a tree in wind.
    // `rot` is the sway rotation in radians. When 0 the sprite is drawn flat.
    // Main-canvas only: the rotation is written as one setTransform (with the DPR
    // scale folded in) and reset to the base DPR transform afterwards, which is
    // much cheaper per swaying tile than save/translate/rotate/restore.
    _drawSwayed(ctx, sprite, rot, dx, dy, dw, dh, pivotX, pivotY) {
        if (rot !== 0) {
            const d = this._dpr;
            const c = Math.cos(rot);
            const s = Math.sin(rot);
            ctx.setTransform(d * c, d * s, -d * s, d * c,
                d * (pivotX - c * pivotX + s * pivotY), d * (pivotY - s * pivotX - c * pivotY));
            ctx.drawImage(sprite, dx, dy, dw, dh);
            ctx.setTransform(d, 0, 0, d, 0, 0);
        } else {
            ctx.drawImage(sprite, dx, dy, dw, dh);
        }
    }

    // Draws an entity sprite under its composed action transform `xf` (see
    // getEntityTransform): translate(pivot + offset) · rotate · scale ·
    // translate(-pivot), pivoting on the feet. Same single-setTransform approach
    // as _drawSwayed, main canvas only.
    _drawEntityXf(ctx, sprite, xf, dx, dy, dw, dh, pivotX, pivotY) {
        const d = this._dpr;
        const c = Math.cos(xf.rotation);
        const s = Math.sin(xf.rotation);
        const a = c * xf.scaleX, b = s * xf.scaleX;
        const cc = -s * xf.scaleY, dd = c * xf.scaleY;
        ctx.setTransform(d * a, d * b, d * cc, d * dd,
            d * (pivotX + xf.offsetX - a * pivotX - cc * pivotY),
            d * (pivotY + xf.offsetY - b * pivotX - dd * pivotY));
        ctx.drawImage(sprite, dx, dy, dw, dh);
        ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    // Draws the melee attack effect over an attacking entity, chosen by the weapon's
    // motion class and aimed toward the target (rotated like a projectile). Swing
    // weapons use `attack_swing`, Stab weapons use `attack_stab`. DrawAndShoot weapons
    // draw no effect (their recoil + projectile already read as an attack). Legacy
    // 'melee'/'ranged' stamps are mapped. No-ops gracefully when the art is absent.
    _queueAttackEffect(simEnt, now, px, py, cw, ch) {
        if (!simEnt) return;
        let cls = simEnt._lastAttackKind || 'Swing';
        if (cls === 'melee') cls = 'Swing';
        else if (cls === 'ranged' || cls === 'bow' || cls === 'wand') cls = 'DrawAndShoot';
        if (cls === 'DrawAndShoot') return;
        const key = cls === 'Stab' ? 'attack_stab' : 'attack_swing';
        const sprite = this.skinManager.getSprite('effects', key);
        if (!sprite) return;
        const A = RENDER_CONFIG.entityActionAnim;
        // Latch a wall-clock start time to the attack tick so the effect plays once and
        // briefly, independent of the coarse attack-shake tick window. Scratch lives on
        // the persistent sim entity (the tile-loop's entity objects are rebuilt each tick).
        const tick = simEnt._lastAttackTick;
        if (tick == null) return;
        if (simEnt._atkFxSeen !== tick) { simEnt._atkFxSeen = tick; simEnt._atkFxStart = now; }
        const travel = A.attackEffectTravelMs || 150;
        const prog = (now - simEnt._atkFxStart) / travel;
        if (prog < 0 || prog >= 1) return;   // effect has already flown out and vanished
        // Fade the effect out over the final `attackEffectFadeFrac` of its travel.
        const fadeFrac = A.attackEffectFadeFrac || 0;
        const alpha = (fadeFrac > 0 && prog > 1 - fadeFrac)
            ? Math.max(0, (1 - prog) / fadeFrac) : 1;
        const dir = simEnt._lastAttackDir;
        if (dir && (dir.dx !== 0 || dir.dy !== 0)) {
            // Sprite art points east (angle 0). Rotate it to face the target, the same
            // convention projectiles use (atan2(dy, dx) in screen space, +y down).
            const angle = Math.atan2(dir.dy, dir.dx);
            // Slide from a small start offset out toward the target over the travel
            // window, like a short-range projectile: begins `attackEffectStartFrac` of a
            // tile ahead of the attacker's center and travels `attackEffectLeadFrac` more.
            const start = A.attackEffectStartFrac || 0;
            const lead = start + (A.attackEffectLeadFrac || 0) * prog;
            const cx = px + cw / 2 + dir.dx * cw * lead;
            const cy = py + ch / 2 + dir.dy * ch * lead;
            this._attackFx.push({ sprite, cx, cy, angle, cw, ch, alpha });
        } else {
            this._attackFx.push({ sprite, px, py, cw, ch, alpha });
        }
    }

    // A radial glow (color at the center fading to transparent at the edge) baked
    // once per color into a small canvas, so the per-frame working-building glow
    // is one scaled drawImage instead of a new gradient per building per frame.
    // A radial gradient scales with its radius, so drawing this at any size
    // matches a gradient built at that size.
    _getGlowSprite(color) {
        if (!this._glowSprites) this._glowSprites = new Map();
        let c = this._glowSprites.get(color);
        if (!c) {
            const size = 128;
            c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const r = size / 2;
            const grd = g.createRadialGradient(r, r, 0, r, r, r);
            grd.addColorStop(0, color);
            grd.addColorStop(1, 'transparent');
            g.fillStyle = grd;
            g.beginPath();
            g.arc(r, r, r, 0, Math.PI * 2);
            g.fill();
            this._glowSprites.set(color, c);
        }
        return c;
    }

    // Draws every deferred melee attack effect collected this frame, then clears the
    // queue. Called after all tiles and entities are painted so the effect sits on
    // top of the target tile (see `_attackFx`).
    _flushAttackEffects(ctx) {
        for (const fx of this._attackFx) {
            const fade = fx.alpha != null && fx.alpha < 1;
            if (fade) { ctx.save(); ctx.globalAlpha = fx.alpha; }
            if (fx.angle != null) {
                ctx.save();
                ctx.translate(fx.cx, fx.cy);
                ctx.rotate(fx.angle);
                ctx.drawImage(fx.sprite, -fx.cw / 2, -fx.ch / 2, fx.cw, fx.ch);
                ctx.restore();
            } else {
                ctx.drawImage(fx.sprite, fx.px, fx.py, fx.cw, fx.ch);
            }
            if (fade) ctx.restore();
        }
        this._attackFx.length = 0;
    }

    _resolveEffectSprite(effectOrKey) {
        if (typeof effectOrKey === 'string') {
            return this.skinManager.getSprite('effects', effectOrKey);
        }
        const e = effectOrKey;
        if (e.char === COMBAT_VISUALS.hitChar) {
            if (e.color === COMBAT_VISUALS.hitColor) return this.skinManager.getSprite('effects', 'hit');
            if (e.color === COMBAT_VISUALS.damageTakenColor) return this.skinManager.getSprite('effects', 'damage_taken');
            if (e.color === COMBAT_VISUALS.structureDamageColor) return this.skinManager.getSprite('effects', 'structure_damage');
            if (e.color === COMBAT_VISUALS.nexusDamageColor) return this.skinManager.getSprite('effects', 'structure_damage');
        }
        if (e.char === COMBAT_VISUALS.spellHealChar && e.color === COMBAT_VISUALS.spellHealColor) return this.skinManager.getSprite('effects', 'spell_heal');
        if (e.char === COMBAT_VISUALS.spellBuffChar && e.color === COMBAT_VISUALS.spellBuffColor) return this.skinManager.getSprite('effects', 'spell_buff');
        if (e.char === COMBAT_VISUALS.spellShieldChar && e.color === COMBAT_VISUALS.spellShieldColor) return this.skinManager.getSprite('effects', 'spell_shield');
        if (e.char === COMBAT_VISUALS.spellTeleportChar && e.color === COMBAT_VISUALS.spellTeleportColor) return this.skinManager.getSprite('effects', 'spell_teleport');
        if (e.char === COMBAT_VISUALS.spellGrowthChar && e.color === COMBAT_VISUALS.spellGrowthColor) return this.skinManager.getSprite('effects', 'spell_growth');
        if (e.char === COMBAT_VISUALS.spellTerraformChar && e.color === COMBAT_VISUALS.spellTerraformColor) return this.skinManager.getSprite('effects', 'spell_terraform');
        if (e.char === COMBAT_VISUALS.spellDivinationChar && e.color === COMBAT_VISUALS.spellDivinationColor) return this.skinManager.getSprite('effects', 'spell_divination');
        if (e.char === COMBAT_VISUALS.magicLevelUpChar) return this.skinManager.getSprite('effects', 'magic_levelup');
        if (e.char === COMBAT_VISUALS.spellCastChar) return this.skinManager.getSprite('effects', 'spell_cast');
        if (e.char === COMBAT_VISUALS.smiteChar) return this.skinManager.getSprite('effects', 'smite');
        if (e.char === COMBAT_VISUALS.craftCompleteChar) return this.skinManager.getSprite('effects', 'craft_complete');
        if (e.char === COMBAT_VISUALS.sleepChar && e.color === COMBAT_VISUALS.sleepColor) return this.skinManager.getSprite('effects', 'sleeping');
        if (e.char === COMBAT_VISUALS.buildCompleteChar) return this.skinManager.getSprite('effects', 'build_complete');
        if (e.char === COMBAT_VISUALS.harvestChar) return this.skinManager.getSprite('effects', 'harvest');
        if (e.char === COMBAT_VISUALS.mentalBreakChar && e.color === COMBAT_VISUALS.mentalBreakColor) return this.skinManager.getSprite('effects', 'mental_break');
        if (e.char === COMBAT_VISUALS.freezingChar && e.color === COMBAT_VISUALS.freezingColor) return this.skinManager.getSprite('effects', 'freezing');
        if (e.char === COMBAT_VISUALS.mineDustChar && e.color === COMBAT_VISUALS.mineDustColor) return this.skinManager.getSprite('effects', 'mine_dust');
        if (e.char === COMBAT_VISUALS.shieldBlockChar) return this.skinManager.getSprite('effects', 'shield_block');
        if (e.char === COMBAT_VISUALS.healthRegenChar && e.color === COMBAT_VISUALS.healthRegenColor) return this.skinManager.getSprite('effects', 'health_regen');
        if (e.char === COMBAT_VISUALS.manaRegenChar) return this.skinManager.getSprite('effects', 'mana_regen');
        if (e.char === COMBAT_VISUALS.deathChar && e.color === COMBAT_VISUALS.deathColor) return this.skinManager.getSprite('effects', 'death');
        if (e.char === COMBAT_VISUALS.summonArriveChar) return this.skinManager.getSprite('effects', 'summon_arrive');
        if (e.char === COMBAT_VISUALS.lootDropChar && e.color === COMBAT_VISUALS.lootDropColor) return this.skinManager.getSprite('effects', 'loot_drop');
        if (e.char === COMBAT_VISUALS.golemActivateChar) return this.skinManager.getSprite('effects', 'golem_activate');
        if (e.char === COMBAT_VISUALS.xpGainChar && e.color === COMBAT_VISUALS.xpGainColor) return this.skinManager.getSprite('effects', 'xp_gain');
        if (e.char === COMBAT_VISUALS.needCriticalChar && e.color === COMBAT_VISUALS.needCriticalColor) return this.skinManager.getSprite('effects', 'need_critical');
        if (e.char === COMBAT_VISUALS.researchCompleteChar && e.color === COMBAT_VISUALS.researchCompleteColor) return this.skinManager.getSprite('effects', 'research_complete');
        if (e.char === COMBAT_VISUALS.healTickChar && e.color === COMBAT_VISUALS.healTickColor) return this.skinManager.getSprite('effects', 'heal_tick');
        return null;
    }

    // Entity breathing (height-stretch) and walk-sway (pendulum rotation) are now
    // composed alongside the action animations in js/ui/entity-animation.js
    // (getEntityTransform). The expedition view keeps its own copies.

    getNightDarkness(timeOfDay, season) {
        const t = timeOfDay / CONFIG.TICKS_PER_DAY;
        const daylight = RENDER_CONFIG.seasonDaylight[season] || RENDER_CONFIG.seasonDaylight.default;
        const { dawn, dusk } = daylight;
        const duskEnd = dusk + RENDER_CONFIG.nightDawnDuskOffset.duskEnd;
        const dawnStart = dawn - RENDER_CONFIG.nightDawnDuskOffset.dawnStart;
        const maxDark = RENDER_CONFIG.nightMaxDarkness;

        if (t >= dawn && t <= dusk) return 0;
        if (t > dusk && t <= duskEnd) return ((t - dusk) / (duskEnd - dusk)) * maxDark;
        if (t >= dawnStart && t < dawn) return ((dawn - t) / (dawn - dawnStart)) * maxDark;
        return maxDark;
    }

    // "Golden hour" warmth factor (0..1) for the darkness overlay tint. Nonzero
    // only inside the twilight ramp windows (dusk→duskEnd, dawnStart→dawn), peaking
    // in the middle of each ramp (sun at the horizon) and fading to 0 at full day
    // and at deep night, via sin(π·rampProgress). Mirrors getNightDarkness's window
    // math so the warmth and the darkening stay phase-aligned.
    getDawnDuskWarmth(timeOfDay, season) {
        const t = timeOfDay / CONFIG.TICKS_PER_DAY;
        const daylight = RENDER_CONFIG.seasonDaylight[season] || RENDER_CONFIG.seasonDaylight.default;
        const { dawn, dusk } = daylight;
        const duskEnd = dusk + RENDER_CONFIG.nightDawnDuskOffset.duskEnd;
        const dawnStart = dawn - RENDER_CONFIG.nightDawnDuskOffset.dawnStart;
        let ramp = 0;
        if (t > dusk && t <= duskEnd) ramp = (t - dusk) / (duskEnd - dusk);
        else if (t >= dawnStart && t < dawn) ramp = (dawn - t) / (dawn - dawnStart);
        else return 0;
        return Math.sin(ramp * Math.PI);
    }

    render(game) {
        // Subdivide the frame's render cost into named sub-buckets.
        // Uses prof.add() with a local timestamp so it never touches
        // the shared _lastMark that the outer gameLoop uses for 'frame:renderer'.
        // Zero cost (a single branch, no allocation) unless startPerfProbe() ran.
        const rprof = game._profiler;
        let rmark = rprof ? performance.now() : 0;

        const { settings, tick, weather } = game;
        const vw = CONFIG.VIEWPORT_WIDTH;
        const vh = CONFIG.VIEWPORT_HEIGHT;
        if (this._lastViewportW !== vw || this._lastViewportH !== vh) {
            this._resizeCanvas();
        }

        const mapW = CONFIG.MAP_WIDTH;
        const season = weather.season;
        const showOverlays = settings.showOverlays;
        const showDamageFlash = settings.showDamageFlash;
        const enableScreenShake = settings.enableScreenShake;
        const showPortalPath = settings.showPortalPath;
        // Reduced-motion umbrella (accessibility): when on, ambient/idle channels
        // (breathing, walk/idle sway, tree/grass/crop sway, work bob, fidget,
        // building pulses) are damped or disabled, while essential gameplay
        // feedback (damage flash, projectiles, floaters, one-shot action beats)
        // still plays. Folds into the per-effect toggles rather than replacing them.
        const reduceMotion = !!settings.reduceMotion;
        const showBreathing = settings.showBreathing && !reduceMotion;
        const showWalkSway = settings.showWalkSway && !reduceMotion;
        const showActionAnimations = settings.showActionAnimations;
        // Reused per-frame flag bundle for the action-animation composer, so it
        // never touches game.settings in the hot loop. Mutated (not realloc'd).
        const animFlags = this._animFlags || (this._animFlags = {});
        animFlags.showBreathing = showBreathing;
        animFlags.showWalkSway = showWalkSway;
        animFlags.showActionAnimations = showActionAnimations;
        animFlags.reduceMotion = reduceMotion;
        // Weather body-language intensity (0..1) for the active weather, resolved
        // once per frame. 0 (or reduceMotion) disables the outdoor hunch/shiver.
        const wr = RENDER_CONFIG.weatherReaction;
        animFlags.weatherIntensity = (wr && wr.enabled && !reduceMotion)
            ? (wr.intensityByWeather[weather.currentWeather] || 0) : 0;
        // Tree sway: wind strength (0..1) from the active weather, resolved once
        // per frame. `showTreeSway` gates the whole effect.
        const showTreeSway = settings.showTreeSway && !reduceMotion && RENDER_CONFIG.treeSway && RENDER_CONFIG.treeSway.enabled;
        // Automatic zoom LOD: when cells are too small for sub-pixel animated detail
        // to be visible, skip it. Derived once per frame from the current cell size,
        // no user setting. At normal zoom `charWidth` far exceeds the threshold so
        // `detailLod` is always true and nothing changes.
        const lodMinCellPx = (RENDER_CONFIG.terrainDetail && RENDER_CONFIG.terrainDetail.lodMinCellPx) || 0;
        const detailLod = this.charWidth >= lodMinCellPx;
        const showTerrainDetail = detailLod && settings.showTerrainDetail && !reduceMotion && RENDER_CONFIG.terrainDetail && RENDER_CONFIG.terrainDetail.enabled;
        // treeWind and detailWind are set below after dt is available
        let treeWind = 0;
        let detailWind = 0;
        const sm = this.skinManager;
        const skinActive = sm.isActive;
        const atkShakePx = COMBAT_VISUALS.atkShakePx || 2;

        this.ctx.imageSmoothingEnabled = !skinActive;

        const { map, camera, colonists, entities, raiders, cursor } = game;
        // Entity/effect caches rebuild per tick, not per frame. Nothing in them
        // depends on the sub-tile camera offset, so key on the floored camera:
        // a camera gliding between tiles must not force a rebuild every frame.
        const camKey = `${Math.floor(camera.x)},${Math.floor(camera.y)},${game.tick},${CONFIG.VIEWPORT_WIDTH},${CONFIG.VIEWPORT_HEIGHT},${this.charWidth},${settings.showEquipmentOverlays}`;
        const settingsKey = `${showOverlays},${game.settings.showCombatParticles},${game.settings.showEquipmentOverlays}`;
        const ctx = this.ctx;
        const cw = this.charWidth;
        const ch = this.charHeight;
        // Wall-clock time for this frame. Used for smooth sub-tick motion
        // (movement interpolation, entity breathing) that must stay smooth at
        // 60fps and keep animating while the simulation is paused.
        const now = performance.now();
        const selectionRect = game.input.getSelectionRect();
        const buildDragPreview = game.input.getBuildDragPreview();
        const spellTargeting = game.input.spellTargeting;
        let spellRangeSet = null;
        if (spellTargeting) {
            const caster = game.getColonist(spellTargeting.colonistId);
            if (caster && caster.hp > 0) {
                spellRangeSet = new Set();
                const range = spellTargeting.spell.range || 1;
                for (let dy = -range; dy <= range; dy++) {
                    for (let dx = -range; dx <= range; dx++) {
                        if (Math.abs(dx) + Math.abs(dy) > range) continue;
                        const tx = caster.x + dx;
                        const ty = caster.y + dy;
                        if (tx >= 0 && ty >= 0 && tx < mapW && ty < CONFIG.MAP_HEIGHT) {
                            spellRangeSet.add(ty * mapW + tx);
                        }
                    }
                }
            }
        }

        // Compute delta time for per-frame decay effects (grass boost, door flash)
        const nowMs = now;
        const dt = this._lastFrameTime ? Math.min((nowMs - this._lastFrameTime) / 1000, 0.1) : 0.016;
        this._lastFrameTime = nowMs;
        // Ambient particle/ripple spawn chances below are tuned as per-frame odds
        // at 60 fps. Scaling them by dt*60 makes them per-second rates, so the
        // spawn rate doesn't depend on refresh rate. Nothing new spawns while the
        // game is paused (existing particles still play out).
        const spawnScale = game.paused ? 0 : dt * 60;

        // Notify sway phase continuity when wind changes so grass/crops don't jump
        const rawWind = windStrengthFor(weather.currentWeather);
        setSwayWind(rawWind, now, dt);
        treeWind = showTreeSway ? rawWind : 0;
        detailWind = showTerrainDetail ? rawWind : 0;

        // Expire grass and crop boost entries past their duration
        for (const [key, entry] of this._grassBoost) {
            if (now - entry.startTime >= entry.duration) this._grassBoost.delete(key);
        }
        for (const [key, entry] of this._cropBoost) {
            if (now - entry.startTime >= entry.duration) this._cropBoost.delete(key);
        }

        // Decay door flash map
        for (const [key, frames] of this._doorFlash) {
            this._doorFlash.set(key, frames - 1);
            if (frames <= 1) this._doorFlash.delete(key);
        }

        // Rebuild working building set from currently working colonists
        this._workingBuildingSet.clear();
        for (const c of game.colonists) {
            if (c.hp > 0 && !c.onExpedition && c.state === 'working' && c.currentTaskId != null) {
                const task = game.taskQueue.getById(c.currentTaskId);
                if (task && task.x != null && task.y != null) {
                    this._workingBuildingSet.add(task.y * mapW + task.x);
                }
            }
        }

        const seasonBg = season && SEASON_EFFECTS[season]?.bgColor;
        const bgColor = seasonBg || RENDER_CONFIG.bgColor;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dither settings are per-frame so we can do it once and re-use for all tiles.
        const ditherOn = RENDER_CONFIG.terrainDithering && (game.settings.ditherDistance || 'normal') !== 'none';
        const ditherDepthFrac = DITHER_DISTANCE_MAP[game.settings.ditherDistance || 'normal'] ?? 0.3; 
        const ditherQualSetting = (game && game.settings.ditherQuality) || 'high';
        const ditherBlockSize = DITHER_QUALITY_MAP[game.settings.ditherQuality] ?? 1;
        // Regenerate masks here, once, if inputs changed. Moved out of the per-tile call:
        if (ditherOn && (!this._ditherMasks || this._ditherTileSize !== this._tileP ||
            this._ditherDepthFraction !== ditherDepthFrac || this._ditherBlockSize !== ditherBlockSize)) {
            this._generateDitherMasks(ditherDepthFrac, ditherBlockSize);
            this._ditherCache.clear();
        }

        // --- Build entity/effect lookup maps (flat key = y*MAP_WIDTH + x) ---
        // These let the tile loop do O(1) lookups instead of scanning arrays per tile.
        // Moving entities (mid-lerp) are collected separately for fractional-position rendering.
        
        const entityMap = this._entityMap;
        const movingEntities = this._movingEntities;
        const rallySet = this._rallySet;
        const portalMap = this._portalMap;
        const portalPathMap = this._portalPathMap;
        if (!this._dyingEntities) this._dyingEntities = [];
        const dyingEntities = this._dyingEntities;

        if (this._lastEntityMapKey === camKey) {
            // entityMap, rallySet, portalMap, etc. are still valid, skip all the rebuild loops.
        } else {
            this._lastEntityMapKey = camKey;

            entityMap.clear();
            dyingEntities.length = 0;

            // Collect recently-dead entities for death dissolve animation
            const DEATH_DISSOLVE_MS = 600;
            const allEntities = [...entities, ...(game.waves?.enemies || []), ...raiders, ...game.colonists.filter(c => !c.onExpedition)];
            for (const e of allEntities) {
                if (e.hp > 0) continue;
                if (!e._dyingStart) e._dyingStart = now;
                if (now - e._dyingStart < DEATH_DISSOLVE_MS) {
                    dyingEntities.push(e);
                }
            }

            movingEntities.length = 0;
            for (const e of entities) {
                if (e.hp <= 0) continue;
                if (isEntityMoving(e)) {
                    movingEntities.push({ entity: e, char: e.char, color: e.color, type: e.type });
                } else {
                    entityMap.set(e.y * mapW + e.x, { char: e.char, color: e.color, type: e.type, entityId: e.id, _dmgFlashUntil: e._dmgFlashUntil, _sim: e });
                }
            }
            if (game.waves) {
                for (const e of game.waves.enemies) {
                    if (e.hp <= 0) continue;
                    if (isEntityMoving(e)) {
                        movingEntities.push({ entity: e, char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type });
                    } else {
                        entityMap.set(e.y * mapW + e.x, { char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type, entityId: e.id, _dmgFlashUntil: e._dmgFlashUntil, _sim: e });
                    }
                }
            }
            for (const r of raiders) {
                if (r.hp <= 0) continue;
                const rChar = r.char || 'R';
                const rColor = r.color || TILE_COLORS.raider;
                if (isEntityMoving(r)) {
                    movingEntities.push({ entity: r, char: rChar, color: rColor, type: 'raider', entityType: r.type });
                } else {
                    entityMap.set(r.y * mapW + r.x, { char: rChar, color: rColor, type: 'raider', entityType: r.type, entityId: r.id, _dmgFlashUntil: r._dmgFlashUntil, _sim: r });
                }
            }
            
            rallySet.clear();
            for (const c of colonists) {
                if (c.hp > 0 && !c.onExpedition) {
                    const drafted = c.drafted;
                    const pulse = drafted && (game.tick % RENDER_CONFIG.draftedPulsePeriod < RENDER_CONFIG.draftedPulseDuty);
                    let color;
                    if (drafted) {
                        color = pulse ? '#ff4444' : '#ff8888';
                    } else if (c.activeEffects && c.activeEffects.some(e => e.source === 'spell') && game.tick % RENDER_CONFIG.spellGlowPeriod < RENDER_CONFIG.spellGlowDuty) {
                        color = COMBAT_VISUALS.spellBuffColor;
                    } else {
                        color = c.nameColor || TILE_COLORS.colonist;
                    }
                    const showEq = game.settings.showEquipmentOverlays;
                    const isSleeping = c.state === 'sleeping';
                    const sleepingInBed = isSleeping && c.assignedBed && c.x === c.assignedBed.x && c.y === c.assignedBed.y;
                    const isFreezing = !c.golem && c.thoughts && c.thoughts.some(t => t.text === 'Freezing outside');
                    const entData = { char: c.golem ? 'G' : '@', color, type: c.golem ? 'golem' : 'colonist', colonistId: c.id, entityId: c.id, race: c.race, bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant, nameColor: c.nameColor, drafted, golemType: c.golemType, sleeping: isSleeping, sleepingInBed, freezing: isFreezing, _dmgFlashUntil: c._dmgFlashUntil, _atkShakeUntil: c._atkShakeUntil, _sim: c, armorKey: showEq && !(c.hiddenEquipmentSlots||{}).armor ? (c.armor?.key || null) : null, helmetKey: showEq && !(c.hiddenEquipmentSlots||{}).helmet ? (c.helmet?.key || null) : null, clothesKey: showEq && !(c.hiddenEquipmentSlots||{}).clothes ? (((!c.armor || (c.hiddenEquipmentSlots||{}).armor) && c.clothes) ? c.clothes.key : null) : null, weaponKey: showEq && !(c.hiddenEquipmentSlots||{}).weapon ? (c.weapon?.key || null) : null, toolKey: showEq && !(c.hiddenEquipmentSlots||{}).tool ? (c.tool?.key || null) : null };
                    if (isEntityMoving(c)) {
                        movingEntities.push({ entity: c, ...entData });
                    } else {
                        entityMap.set(c.y * mapW + c.x, entData);
                    }
                    if (drafted && c.draftTarget) {
                        rallySet.set(c.draftTarget.y * mapW + c.draftTarget.x, true);
                    }
                }
            }
            for (const [key] of rallySet) {
                if (!entityMap.has(key)) {
                    entityMap.set(key, { char: '⚑', color: '#ff4444', type: 'rally' });
                }
            }

            portalMap.clear();
            portalPathMap.clear();
            if (game.waves && game.waves.active && game.waves.portals.length > 0) {
                for (const p of game.waves.portals) {
                    portalMap.set(p.y * mapW + p.x, true);
                }
                // getPathPreview ages its cache per call; call it at most once per
                // tick so the preview refreshes on game time, not on cache rebuilds.
                if (this._pathPreviewTick !== game.tick || !this._pathPreviewPoints) {
                    this._pathPreviewTick = game.tick;
                    this._pathPreviewPoints = game.waves.getPathPreview(game);
                }
                const pathPoints = this._pathPreviewPoints;
                for (const pt of pathPoints) {
                    const key = pt.y * mapW + pt.x;
                    if (!portalMap.has(key)) portalPathMap.set(key, true);
                }
            }
        }

        const effectMap = this._effectMap;

        // effectMap needs its own cache key: `_lastEntityMapKey` is already set to
        // `camKey` by the entity-map rebuild above, so comparing against it here is
        // always true and the effect layer would never refresh. Key off settings +
        // camKey (which includes game.tick) in a dedicated field instead.
        const effectMapKey = `${settingsKey}|${camKey}`;
        if (this._lastEffectMapKey === effectMapKey) {
            // effectMap still valid, skip that loop.
        } else {
            this._lastEffectMapKey = effectMapKey;
            effectMap.clear();
            if (game.combatEffects && showOverlays && game.settings.showCombatParticles) {
                for (const e of game.combatEffects) {
                    const key = e.y * mapW + e.x;
                    // Death markers win their tile: an entity that dies while dropping
                    // loot pushes both a death and a loot-drop effect at the same tile.
                    // effectMap is one-per-tile, so without this the later loot star
                    // would mask the skull. The loot arc particles already show the
                    // drop, so the skull is what should linger on the corpse tile.
                    const existing = effectMap.get(key);
                    if (existing && existing.char === COMBAT_VISUALS.deathChar &&
                        existing.color === COMBAT_VISUALS.deathColor) {
                        continue;
                    }
                    effectMap.set(key, e);
                }
            }
        }
        
        if (rprof) { const t = performance.now(); rprof.add('render:setup+entityMap', t - rmark); rmark = t; }

        // --- Static ground cache: bake visible chunks if needed, then blit them ---
        // The baked chunks hold the static ground layer for every bakeable-ground
        // tile (see _isBakeableGround). When active, the tile loop skips the live
        // ground draw + dither for those tiles and relies on these blits instead.
        // Only in skin mode: ASCII ground is a single fill per tile, already cheap.
        // The key invalidates every chunk when the cell size, season, or dither
        // settings change (anything that alters every baked tile's appearance), as
        // does a replaced or resized map (load / new game). markTerrainDirty()
        // invalidates every chunk; markTileDirty() and stale tiles patch one tile.
        const dpr = this._dpr;
        const tileP = this._tileP;
        let terrainCacheActive = false;
        if (skinActive) {
            const terrainKey = `${tileP}|${season}|${ditherOn}|${ditherDepthFrac}|${ditherQualSetting}|${ditherBlockSize}`;
            if (terrainKey !== this._terrainKey) {
                this._terrainKey = terrainKey;
                this._terrainDirty = true;
            }
            if (this._bakedMap !== map || this._bakeMapW !== mapW || this._bakeMapH !== CONFIG.MAP_HEIGHT) {
                this._terrainDirty = true;
            }
            // Defer re-baking while zoom is still changing: a bake per zoom step is
            // a burst of heavy frames. Once zoom has been stable for _zoomSettleMs
            // the cache restarts and chunks bake as they are drawn. A dirty flag
            // from a content change (season, skin, load) has _lastZoomChangeMs far
            // in the past, so it restarts immediately (zoomSettled is true). While
            // dirty, terrainCacheActive stays false and ground draws live.
            const zoomSettled = (now - this._lastZoomChangeMs) >= this._zoomSettleMs;
            if (this._terrainDirty && zoomSettled) {
                this._resetTerrainCache(game, season, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
            }
            if (this._chunkBaked && !this._terrainDirty) {
                this._flushTilePatches(game, 2048);
                // Blit the visible chunks 1:1 in physical pixels. World tile (0,0)
                // lands at physical (camOffX, camOffY); the tile loop uses the same
                // offsets, so baked and live tiles share exact pixel edges. Chunks
                // not baked yet bake now within a small time budget; the rest of
                // their tiles draw live this frame (the loop checks _chunkBaked).
                const camOffX = Math.round(-camera.x * tileP);
                const camOffY = Math.round(-camera.y * tileP);
                const C = this._chunkTiles;
                const fx = Math.floor(camera.x), fy = Math.floor(camera.y);
                const cx0 = Math.max(0, Math.floor(fx / C));
                const cy0 = Math.max(0, Math.floor(fy / C));
                const cx1 = Math.min(this._chunksX - 1, Math.floor(Math.min(mapW - 1, fx + vw + 1) / C));
                const cy1 = Math.min(Math.ceil(CONFIG.MAP_HEIGHT / C) - 1, Math.floor(Math.min(CONFIG.MAP_HEIGHT - 1, fy + vh + 1) / C));
                const frame = ++this._frameNo;
                const bakeStart = performance.now();
                let baked = 0;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                for (let cy = cy0; cy <= cy1; cy++) {
                    for (let cx = cx0; cx <= cx1; cx++) {
                        const ci = cy * this._chunksX + cx;
                        let chunk = this._terrainChunks.get(ci);
                        if (!this._chunkBaked[ci]) {
                            if (baked > 0 && performance.now() - bakeStart > TERRAIN_CHUNK_BAKE_BUDGET_MS) continue;
                            chunk = this._bakeChunk(game, ci);
                            baked++;
                        }
                        chunk.lastUsed = frame;
                        ctx.drawImage(chunk.canvas, cx * C * tileP + camOffX, cy * C * tileP + camOffY);
                    }
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this._evictTerrainChunks();
                terrainCacheActive = true;
            }
        }

        // --- Tile rendering loop ---
        // Iterates over the visible viewport, drawing each tile as either a sprite
        // (skin active) or an ASCII character. Layering order for sprites:
        //   ground → structure/entity → dither → pedestal item overlay → designation tint
        // Effects (combat hits, shots, portals) draw as overlays on top of the base.
        // Tile positions are snapped in physical (device) pixels: world tile (0,0)
        // sits at physical (tileOffX, tileOffY) and each tile is exactly tileP
        // physical pixels (an integer), so adjacent tiles always share exact pixel
        // boundaries at any DPR or fractional camera, and match the baked ground
        // blit above. px/py/cw1/ch1 are those positions in CSS pixels (the context
        // is scaled by dpr).
        const tileOffX = Math.round(-camera.x * tileP);
        const tileOffY = Math.round(-camera.y * tileP);
        const cw1 = tileP / dpr;
        const ch1 = cw1;
        const bakedKind = this._bakedKind;
        const chunkBaked = this._chunkBaked;
        const chunkTiles = this._chunkTiles;
        const chunksX = this._chunksX;
        const pendingPatches = this._pendingTilePatches;
        let lastColor = '';
        for (let sy = 0; sy <= vh + 1; sy++) {
            for (let sx = 0; sx <= vw + 1; sx++) {
                // Keep track of the x,y coordinate for the tile we are currently drawing on and its relation to the player camera.
                const wx = Math.floor(camera.x) + sx;
                const wy = Math.floor(camera.y) + sy;
                const px = (wx * tileP + tileOffX) / dpr;
                const py = (wy * tileP + tileOffY) / dpr;

                if (wx < 0 || wx >= mapW || wy < 0 || wy >= CONFIG.MAP_HEIGHT) {
                    continue;
                }

                // Get ASCII info for this tile.
                const tile = map[wy][wx];

                // Unexplored crypt interior: paint over the baked ground and draw nothing else.
                if (tile.sealed) {
                    ctx.fillStyle = SEALED_BG;
                    ctx.fillRect(px, py, cw1, ch1);
                    lastColor = '';
                    continue;
                }
                const tv = writeTileVisuals(tile, season, this._tileVisuals);
                let char = tv.char, color = tv.color, bg = tv.bg;

                // Apply seasonal grass terrain colors.
                if (tile.terrain === 'grass' && !tile.snowCovered && season && SEASON_EFFECTS[season]) {
                    const se = SEASON_EFFECTS[season];
                    // bg '#1a2a12' is the default grass terrain bg; override it on all
                    // grass tiles (bare, resource, zone) so the tile background shifts.
                    if (bg === '#85a643') bg = se.grassBg;
                    // color '#85a643' only appears on bare grass tiles (no structure/
                    // resource/floor overriding it); safe to replace unconditionally.
                    if (color === '#85a643') color = se.grassColor;
                }

                // Update tile color based on work task designation if one exists (e.g. marked for destruction).
                if (tile.designation) {
                    color = TILE_COLORS[`designation_${tile.designation.type}`] || '#ffff00';
                }

                // Update tile color if this tile has a Rift Gate and it is actively being used.
                if ((tile.structure === 'rift_gate' || tile.structure === 'rift_anchor_active') && game.exploration && game.exploration.expeditions.length > 0) {
                    color = game.tick % RENDER_CONFIG.riftPulsePeriod < RENDER_CONFIG.riftPulseDuty ? '#33ccff' : '#1a6688';
                }

                // Get key for this tile to check against different maps (e.g. portalPathMap has a list of all tiles that Nexus Wave enemies plan to use for pathing).
                const tileKey = wy * mapW + wx;

                // Update tile color to indiciate Nexus Wave enemy paths if applicable.
                if (portalMap.has(tileKey)) {
                    char = COMBAT_VISUALS.portalChar;
                    color = COMBAT_VISUALS.portalColor;
                    bg = COMBAT_VISUALS.portalBg;
                } else if (showPortalPath && portalPathMap.has(tileKey)) {
                    color = COMBAT_VISUALS.portalPathColor;
                    bg = COMBAT_VISUALS.portalPathBg;
                }

                // Check if this tile contains an entity. Update ASCII char and color to that entity if it exists as it should be placed on top of the previous changes.
                const entity = entityMap.get(tileKey);
                if (entity) {
                    char = entity.char;
                    color = (showOverlays && showDamageFlash && entity._dmgFlashUntil > game.tick) ? COMBAT_VISUALS.dmgFlashColor : entity.color;
                } else if (tile.structure && showOverlays && showDamageFlash && tile._dmgFlashUntil > game.tick) {
                    color = COMBAT_VISUALS.dmgFlashColor;
                }

                // Check if an effect exists on this tile that needs to be drawn. This will take priority over entity char in ASCII mode.
                const effect = effectMap.get(tileKey);
                if (effect) {
                    char = effect.char;
                    color = effect.color;
                }
                // Death marker: drifts upward and fades over its lifetime so it is
                // clear where something died (colonists and raiders both push this
                // same char+color effect). Progress runs 0 (just died) → 1 (expiring),
                // driven off remaining ttl plus the intra-tick accumulator fraction so
                // it is smooth at any game speed and freezes while paused. Under
                // reduce-motion the marker holds still (no float) but still fades out.
                let deathFloatY = 0;
                let deathAlpha = 1;
                let deathScale = 1;
                const isDeathFx = effect && effect.char === COMBAT_VISUALS.deathChar && effect.color === COMBAT_VISUALS.deathColor;
                if (isDeathFx) {
                    const deathTtl = COMBAT_VISUALS.deathTtl || 1;
                    const accFrac = Math.min(1, (game.accumulator || 0) / CONFIG.TICK_RATE);
                    const prog = Math.min(1, Math.max(0, ((deathTtl - effect.ttl) + accFrac) / deathTtl));
                    if (!reduceMotion) deathFloatY = -prog * (COMBAT_VISUALS.deathFloatPx || 0);
                    // Ease the fade toward the end (stays legible for the first half).
                    deathAlpha = prog < 0.5 ? 1 : 1 - (prog - 0.5) / 0.5;
                    // Grow from half size to full size over the lifetime (reduce-motion
                    // holds it at full size, no growth).
                    if (!reduceMotion) {
                        const startScale = COMBAT_VISUALS.deathStartScale != null ? COMBAT_VISUALS.deathStartScale : 0.5;
                        deathScale = startScale + (1 - startScale) * prog;
                    }
                }

                if (spellRangeSet && spellRangeSet.has(tileKey)) {
                    bg = COMBAT_VISUALS.spellRangePreviewBg;
                }

                // Prep to draw drag selection and build preview.
                const inSelection = selectionRect &&
                    wx >= selectionRect.x1 && wx <= selectionRect.x2 &&
                    wy >= selectionRect.y1 && wy <= selectionRect.y2;

                if (inSelection && buildDragPreview) {
                    if (buildDragPreview.blocked && buildDragPreview.blocked.has(tileKey)) {
                        bg = '#3a1a1a';
                    } else if (buildDragPreview.affordable.has(tileKey)) {
                        bg = '#1a3a1a';
                    } else if (buildDragPreview.unaffordable.has(tileKey)) {
                        bg = '#3a1a1a';
                    } else {
                        bg = RENDER_CONFIG.selectionBgBuild;
                    }
                } else if (inSelection) {
                    bg = game.input.mode === 'zone' ? RENDER_CONFIG.selectionBgZone : RENDER_CONFIG.selectionBgBuild;
                } else if (cursor && cursor.x === wx && cursor.y === wy) {
                    bg = RENDER_CONFIG.cursorBg;
                }

                // Static ground cache: this tile's ground layer (terrain bg + terrain/
                // floor/snow sprite + dither) is already in the pre-loop blit, so the
                // live ground draw and base bg fill can be skipped. Restricted to
                // pristine tiles: cache active, skin mode, no entity/effect, a
                // bakeable-ground tile with a present ground sprite, and NO dynamic bg
                // source (portal, spell range, selection, cursor). Any tile failing
                // this draws fully live, exactly as before, so highlighted/occupied
                // tiles are pixel-identical. The common zoomed-out case (bare terrain)
                // takes the blit and skips the expensive per-tile ground + dither.
                // A tile whose bake is stale (it changed without markTileDirty) is
                // queued for a patch and drawn live this frame, never as a hole.
                const onCursor = !!(cursor && cursor.x === wx && cursor.y === wy);
                let bakeUsable = false;
                if (terrainCacheActive && chunkBaked[((wy / chunkTiles) | 0) * chunksX + ((wx / chunkTiles) | 0)]) {
                    if (this._isBakeStale(tile, tileKey)) pendingPatches.add(tileKey);
                    else bakeUsable = (bakedKind[tileKey] & BAKE_SPRITE) !== 0;
                }
                const bakedGround = bakeUsable && !entity && !effect
                    && !portalMap.has(tileKey)
                    && !(showPortalPath && portalPathMap.has(tileKey))
                    && !(spellRangeSet && spellRangeSet.has(tileKey))
                    && !inSelection && !onCursor;

                /*
                Each tile can contain several elements that may overlap. Most sprites will not take up the entire tile, so we
                need to draw the other sprites underneath it to fill the space properly. We draw elements in the following order:
                    1. Background color
                    2. Terrain
                    3. Floor
                    4. Structure (Walls & Furniture)
                    5. Entity
                    6. Effects (e.g. Particles, arrows, turret shots)
                */

                // Draw background color if it was set. Baked-ground tiles skip this:
                // their terrain bg is already in the pre-loop blit, and bakedGround is
                // false whenever any dynamic bg override applies, so nothing is lost.
                if (bg && !bakedGround) {
                    ctx.fillStyle = bg;
                    ctx.fillRect(px, py, cw1, ch1);
                    lastColor = '';
                }

                // Draw anything that has a sprite (floors, structures, entities, & effects).
                // If a sprite doesn't exist for that element we will instead draw using ASCII later.
                let spriteDrawn = false;
                if (skinActive) {
                    // Draw ground sprite (terrain, floor, or furniture) so it will appear underneath the colonist sprite.
                    const needsGround = tile.structure && BUILDINGS[tile.structure] &&
                        (BUILDINGS[tile.structure].structureType === 'furniture' ||
                         BUILDINGS[tile.structure].structureType === 'door' ||
                         BUILDINGS[tile.structure].showGround === true);
                    if (needsGround || entity) {
                        const ground = this._resolveGroundSprite(tile, season);
                        if (ground) ctx.drawImage(ground, px, py, cw1, ch1);
                        // Plants sit on open terrain, so blend biome edges beneath them
                        // like a bare tile (bare tiles dither after the sprite instead).
                        if (PLANT_STRUCTURES.has(tile.structure) && !tile.floor) {
                            this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw1, ch1, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        }
                        const material = this._resolveMaterialSprite(tile, season);
                        if (material) {
                            // A tree on a tile that also holds an entity sways behind the
                            // entity, just as a bare tree tile sways (drawn later below).
                            const matRot = (showTreeSway && tile.resource && tile.resource.type === 'tree')
                                ? getTreeSway(now, tileKey, treeWind) : 0;
                            this._drawSwayed(ctx, material, matRot, px, py, cw1, ch1, px + cw / 2, py + ch);
                        }
                    } else if (tile.resource) {
                        // Resources (trees, stone, ore) are not full-tile sprites, so
                        // without a ground pass they'd sit on the bare background. Draw
                        // the terrain beneath. The resource sprite itself is drawn by the
                        // main sprite path below (so it can carry the tree-sway transform).
                        const ground = this._resolveGroundSprite(tile, season);
                        if (ground) ctx.drawImage(ground, px, py, cw1, ch1);
                        // Grass tufts also sprout under trees on grass terrain: draw the
                        // swaying tuft here so the tree sprite (drawn below) covers it.
                        if (showTerrainDetail && tile.resource.type === 'tree'
                            && GRASS_TERRAIN.has(tile.terrain) && !tile.snowCovered) {
                            this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw1, ch1, season, tile.terrain);
                        }
                    } else if (tile.zone) {
                        // Farm plots sit on terrain: draw the seasonal ground first so the
                        // soil sprite composites over green/autumn/snowy grass correctly.
                        const ground = this._resolveGroundSprite(tile, season);
                        if (ground) ctx.drawImage(ground, px, py, cw1, ch1);
                    }
                    const canDither = !tile.structure && !tile.resource && !tile.zone && !tile.floor;
                    if (entity) {
                        if (canDither) this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw1, ch1, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        // Terrain detail behind an entity so it stands on the same
                        // animated ground as a bare tile: grass tufts on grass, water
                        // waves on water. Water also keeps its `in_water` overlay on top
                        // (drawn after the sprite), giving a swimmer both effects.
                        if (showTerrainDetail && !tile.structure && !tile.resource
                            && !tile.zone && !tile.floor) {
                            if (GRASS_TERRAIN.has(tile.terrain) && !tile.snowCovered) {
                                this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw1, ch1, season, tile.terrain);
                            } else if (tile.terrain === 'water' || tile.terrain === 'shallow_water') {
                                this._drawWaterWaves(ctx, now, tileKey, px, py, cw1, ch1, tile.terrain);
                            }
                        }
                        // Farm tiles are drawn behind the entity here so colonists
                        // appear on top of the plot, whether it's empty or planted.
                        if (tile.zone) {
                            const cropState = tile.zone.state || 'empty';
                            const isPlanted = tile.zone.crop && cropState !== 'empty';
                            const baseSprite = isPlanted
                                ? (sm.getSprite('farms', 'farm_planted') || sm.getSprite('farms', 'farm_empty'))
                                : sm.getSprite('farms', 'farm_' + cropState);
                            if (baseSprite) ctx.drawImage(baseSprite, px, py, cw1, ch1);
                            if (isPlanted) {
                                const cropSprite = sm.getSprite('farms', tile.zone.crop + '_' + cropState)
                                    || sm.getSprite('farms', 'farm_' + cropState);
                                if (cropSprite) {
                                    if (showTerrainDetail) {
                                        this._drawCropSway(ctx, now, tileKey, detailWind, px, py, cw1, ch1, cropSprite);
                                    } else {
                                        ctx.drawImage(cropSprite, px, py, cw1, ch1);
                                    }
                                }
                            }
                        }
                        if (tile.structure) {
                            const isDoorOpen = this._doorFlash.get(tileKey) > 0
                                && BUILDINGS[tile.structure]?.structureType === 'door';
                            const structSprite = (isDoorOpen && sm.getSprite('buildings', tile.structure + '_open'))
                                || (PLANT_STRUCTURES.has(tile.structure) && this._resolvePlantSprite(tile.structure, season))
                                || sm.getSprite('buildings', tile.structure);
                            if (structSprite) ctx.drawImage(structSprite, px, py, cw1, ch1);
                        }
                    }

                    // Determine if we have an entity sprite to draw on this tile.
                    const hl = !!(entity && entity.type === 'colonist' && game.settings.showColonistHighlight);
                    // Baked-ground tiles: shadow + ground sprite + dither are all in the
                    // pre-loop blit, and none of the sprite block's other draws apply
                    // (all gated on entity/structure/resource/zone/effects, which a
                    // bakeable pristine tile lacks). Skip the block and mark spriteDrawn
                    // so downstream overlays (grass tufts, ripples) still layer on top.
                    const sprite = bakedGround ? null : this._resolveSprite(tile, entity, season, hl, tileKey);
                    if (bakedGround) {
                        spriteDrawn = true;
                    }
                    if (sprite) {
                        // Draw entity shadow. Skip it for flat furniture (rugs, chalk) that
                        // sits on the ground and shouldn't cast a shadow. Only applies when the
                        // sprite is the structure itself, not an entity standing on the tile.
                        const noShadow = !entity && tile.structure && BUILDINGS[tile.structure]?.noShadow;
                        const shadowSprite = noShadow ? null : sm.getSprite('effects', 'shadow');
                        // A swimming entity has its shadow raised to the waterline so it
                        // reads as sitting on the surface (half-submerged illusion).
                        const detailCfg = RENDER_CONFIG.terrainDetail;
                        const submerge = !!(entity && tile.terrain === 'water' && showTerrainDetail
                            && detailCfg && detailCfg.enabled && detailCfg.submergeFrac > 0);
                        const shadowLift = submerge ? ch * detailCfg.submergeFrac : 0;
                        if (shadowSprite) ctx.drawImage(shadowSprite, px, py - shadowLift, cw1, ch1);
                        // Determine any shake effects that need to be applied to the entity sprite before we draw it.
                        const shakeActive = showOverlays && enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                        const shakePx = atkShakePx;
                        const shakeX = shakeActive ? ((game.tick * 7) % (shakePx * 2 + 1)) - shakePx : 0;
                        const shakeY = shakeActive ? ((game.tick * 13) % (shakePx + 1)) - Math.floor(shakePx / 2) : 0;
                        const hlOff = hl ? 1 : 0;
                        // Composed action-animation transform (breathe grow + one-shot
                        // lunge/recoil/cast/hit + work bob). Scratch/stamps live on the
                        // persistent sim entity (`_sim`). The per-tile map object is
                        // rebuilt every tick. Non-entity sprites get no transform.
                        const xf = entity ? getEntityTransform(entity._sim || entity, now, game, null, entity.entityId || 0, animFlags) : null;
                        // Tree sway: non-entity tree resource tiles rock slowly about
                        // their trunk base, faster and harder as the wind rises. Kept
                        // independent of the entity transform. A tile with an entity
                        // draws the entity sprite, not the tree, so they never coexist.
                        const isFlame = !entity && tile.structure && (tile.structure === 'candle' || tile.structure === 'campfire');
                        const flameAmp = tile.structure === 'campfire' ? 0.07 : 0.03;
                        const flameRot = isFlame
                            ? Math.sin(now * 0.0006 + (tileKey % 100) * 0.63) * flameAmp
                            : 0;
                        const isPlant = !entity && PLANT_STRUCTURES.has(tile.structure);
                        const treeRot = isPlant
                            ? this._plantSway(now, tileKey, tile.structure, showTerrainDetail, showTreeSway, detailWind, treeWind)
                            : flameRot || (!entity && showTreeSway
                                && tile.resource && tile.resource.type === 'tree')
                                ? flameRot || getTreeSway(now, tileKey, treeWind) : 0;
                        // Breathing: stretch height, anchor feet by nudging y up by the same amount.
                        const grow = xf ? xf.growPx : 0;
                        const dx = px + shakeX - hlOff;
                        const dy = py + shakeY - hlOff - grow;
                        const dw = cw1 + hlOff * 2;
                        const dh = ch1 + hlOff * 2 + grow;
                        // Submerged entities: clip the lower part of the sprite at a
                        // gently bobbing waterline so it reads as partially under water
                        // (the animated waves drawn behind show through the gap). This
                        // replaces the old `in_water` overlay drawn on top. The waterline
                        // shares the wave phase so the entity appears to ride the swell.
                        // (`detailCfg`/`submerge` computed above for the shadow lift.)
                        if (submerge) {
                            const wavePhase = (now / detailCfg.waterPeriodMs) * Math.PI * 2
                                + (tileKey % 1000) / 1000 * detailCfg.waterPhaseSpread;
                            const bob = Math.sin(wavePhase) * detailCfg.submergeBobPx;
                            const waterlineY = py + ch - ch * detailCfg.submergeFrac + bob;
                            const clipTop = py - ch - grow;   // generous: never clip the head
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(px - cw, clipTop, cw * 3, waterlineY - clipTop);
                            ctx.clip();
                        }
                        if (xf && !xf.identity) {
                            // Rotate/scale about the feet (bottom-center), translate by offset.
                            this._drawEntityXf(ctx, sprite, xf, dx, dy, dw, dh, px + cw / 2, py + ch);
                        } else {
                            // Tree tiles sway about the trunk base (bottom-center) so the
                            // canopy leans while the roots stay put. treeRot is 0 otherwise
                            // and the sprite draws flat.
                            this._drawSwayed(ctx, sprite, treeRot, dx, dy, dw, dh, px + cw / 2, isFlame ? py + ch * 0.5 : py + ch);
                        }
                        if (submerge) {
                            ctx.restore();
                        } else if (entity && tile.terrain === 'water') {
                            // Fallback for when terrain detail is off: the legacy "in
                            // water" overlay drawn on top of the entity.
                            const waterSprite = sm.getSprite('effects', 'in_water');
                            if (waterSprite) ctx.drawImage(waterSprite, px, py, cw1, ch1);
                        }
                        if (!entity && canDither) {
                            this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw1, ch1, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        }
                        if (showOverlays && showDamageFlash && entity && entity._dmgFlashUntil > game.tick) {
                            const flashSprite = sm.getSprite('effects', 'damage_flash');
                            if (flashSprite) {
                                ctx.drawImage(flashSprite, px + shakeX, py + shakeY, cw1, ch1);
                            } else {
                                ctx.globalAlpha = COMBAT_VISUALS.dmgFlashAlpha;
                                ctx.fillStyle = COMBAT_VISUALS.dmgFlashColor;
                                ctx.fillRect(px, py, cw1, ch1);
                                ctx.globalAlpha = 1.0;
                                lastColor = '';
                            }
                        }
                        // Freeze tint: persistent cyan overlay while colonist has the freezing thought
                        if (showOverlays && entity && entity.freezing) {
                            ctx.globalAlpha = 0.35;
                            ctx.fillStyle = '#88ddff';
                            ctx.fillRect(px, py, cw1, ch1);
                            ctx.globalAlpha = 1.0;
                            lastColor = '';
                        }
                        // If we are actively shaking after an attack begins, draw the
                        // per-weapon attack effect (aimed at the target, DrawAndShoot none).
                        if (entity && shakeActive) {
                            this._queueAttackEffect(entity._sim || entity, now, px, py, cw1, ch1);
                        }

                        // Mining/chopping debris particles
                        if (entity && entity._sim && entity._sim.state === 'working') {
                            if (Math.random() < 0.25 * spawnScale) {
                                    const sim2 = entity._sim;
                                    const task2 = (game.taskQueue && sim2.currentTaskId != null) ? game.taskQueue.getById(sim2.currentTaskId) : null;
                                    const taskType = task2 ? task2.type : null;
                                    if (taskType === 'mine') {
                                        for (let dp = 0; dp < 3; dp++) {
                                            const angle2 = Math.PI * 1.5 + (Math.random() - 0.5) * 1.2;
                                            spawnParticle(game, {
                                                x: task2.x + 0.5, y: task2.y + 0.7,
                                                vx: Math.cos(angle2) * (0.2 + Math.random() * 0.2),
                                                vy: Math.sin(angle2) * (0.2 + Math.random() * 0.2) - 0.1,
                                                ay: 0.4,
                                                decay: 0.06,
                                                color: Math.random() < 0.5 ? '#888888' : '#aaaaaa',
                                                size: 2.5,
                                                alpha: 0.85,
                                                shape: 'square',
                                                maxY: task2.y + 1,
                                            });
                                        }
                                    } else if (taskType === 'chop') {
                                        for (let dp = 0; dp < 2; dp++) {
                                            const angle2 = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
                                            spawnParticle(game, {
                                                x: task2.x + 0.5, y: task2.y + 0.4,
                                                vx: Math.cos(angle2) * (0.25 + Math.random() * 0.2),
                                                vy: Math.sin(angle2) * (0.2 + Math.random() * 0.15) - 0.15,
                                                ay: 0.4,
                                                decay: 0.05,
                                                color: Math.random() < 0.5 ? '#8B5E3C' : '#c49a6c',
                                                size: 3,
                                                alpha: 0.9,
                                                shape: 'square',
                                                maxY: task2.y + 1,
                                            });
                                        }
                                    }
                            }
                        }

                        // Status effect auras
                        if (entity && entity._sim) {
                            const sim = entity._sim;
                            if (sim.activeEffects) {
                                for (const eff of sim.activeEffects) {
                                    if (eff.type === 'burning' || eff.source === 'fire') {
                                        if (Math.random() < 0.08 * spawnScale) {
                                            spawnParticle(game, {
                                                x: wx + 0.3 + Math.random() * 0.4,
                                                y: wy + 0.1,
                                                vx: (Math.random() - 0.5) * 0.15,
                                                vy: -0.3 - Math.random() * 0.15,
                                                decay: 0.05,
                                                color: Math.random() < 0.5 ? '#ff6600' : '#ffaa00',
                                                size: 2 + Math.random(),
                                                alpha: 0.8,
                                                shape: 'square',
                                            });
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        // Eating crumb particles
                        if (entity && entity._sim && entity._sim.state === 'eating') {
                            if (Math.random() < 0.10 * spawnScale) {
                                const crumbColors = ['#c8a46e', '#e8c87a', '#b87040', '#d4905a', '#f0d090', '#a06828', '#d4b870'];
                                spawnParticle(game, {
                                    x: wx + 0.3 + Math.random() * 0.4,
                                    y: wy + 0.35 + Math.random() * 0.15,
                                    vx: (Math.random() - 0.5) * 0.3,
                                    vy: -0.08 - Math.random() * 0.1,
                                    ay: 0.5,
                                    decay: 0.12,
                                    color: crumbColors[Math.floor(Math.random() * crumbColors.length)],
                                    size: 1.5 + Math.random() * 2.5,
                                    alpha: 0.9,
                                    shape: 'square',
                                    maxY: wy + 1,
                                });
                            }
                        }

                        // Optional per-school cast overlay (null art → skipped gracefully).
                        if (xf && xf.overlayKey) {
                            const overlaySprite = sm.getSprite('effects', xf.overlayKey);
                            if (overlaySprite) {
                                ctx.globalAlpha = xf.overlayAlpha;
                                ctx.drawImage(overlaySprite, px, py, cw1, ch1);
                                ctx.globalAlpha = 1.0;
                            }
                        }
                        // Draw any combat effects relevant for this entity sprite.
                        if (showOverlays && showDamageFlash && !entity && tile.structure && tile._dmgFlashUntil > game.tick) {
                            const flashSprite = sm.getSprite('effects', 'damage_flash');
                            if (flashSprite) {
                                ctx.drawImage(flashSprite, px, py, cw1, ch1);
                            } else {
                                ctx.globalAlpha = COMBAT_VISUALS.dmgFlashAlpha;
                                ctx.fillStyle = COMBAT_VISUALS.dmgFlashColor;
                                ctx.fillRect(px, py, cw1, ch1);
                                ctx.globalAlpha = 1.0;
                                lastColor = '';
                            }
                        }
                        spriteDrawn = true;
                    }

                    // Animated terrain detail overlays on bare terrain (no entity,
                    // structure, resource, zone, or floor). Grass tufts sway in the
                    // wind. Water waves bob up and down. Both use new `effects`
                    // sprites and skip gracefully when the art is absent.
                    if (showTerrainDetail && !entity && !tile.structure && !tile.resource
                        && !tile.zone && !tile.floor) {
                        if (GRASS_TERRAIN.has(tile.terrain) && !tile.snowCovered) {
                            if (this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw1, ch1, season, tile.terrain)) {
                                spriteDrawn = true;
                            }
                        } else if (tile.terrain === 'water' || tile.terrain === 'shallow_water') {
                            if (this._drawWaterWaves(ctx, now, tileKey, px, py, cw1, ch1, tile.terrain)) {
                                spriteDrawn = true;
                                // Spawn rain ripples on water tiles during rain/thunderstorm
                                const rainChance = weather.currentWeather === 'thunderstorm' ? 0.04 : weather.currentWeather === 'rain' ? 0.02 : 0;
                                if (rainChance > 0 && Math.random() < rainChance * spawnScale) {
                                    this._spawnWaterRipple(wx, wy, cw, 0.8);
                                }
                            }
                        }
                    }

                    // Snow shimmer: random bright flecks on blizzard snow-covered tiles
                    if (detailLod && !entity && tile.snowCovered && weather.currentWeather === 'blizzard' && Math.random() < 0.005 * spawnScale) {
                        ctx.save();
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.beginPath();
                        ctx.arc(px + Math.random() * cw, py + Math.random() * ch, 1, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    // Crop sway: zone tiles with a planted crop sway in the wind (skip empty).
                    // The static plot base was already drawn by _resolveSprite; here we draw
                    // only the crop sprite on top so the soil doesn't sway with the plant.
                    // Tiles with an entity skip this: the ground pass above already drew them.
                    if (tile.zone && tile.zone.crop && tile.zone.state !== 'empty' && !entity) {
                        const cropState = tile.zone.state || 'empty';
                        const cropSprite = this.skinManager.getSprite('farms', tile.zone.crop + '_' + cropState)
                            || this.skinManager.getSprite('farms', 'farm_' + cropState);
                        if (cropSprite) {
                            if (showTerrainDetail) {
                                this._drawCropSway(ctx, now, tileKey, detailWind, px, py, cw1, ch1, cropSprite);
                            } else {
                                ctx.drawImage(cropSprite, px, py, cw1, ch1);
                            }
                        }
                    }

                    // Creeping miasma spore particles on blighted crop tiles
                    if (detailLod && tile.zone && tile.zone.blighted && Math.random() < 0.06 * spawnScale) {
                        spawnParticle(game, {
                            x: wx + 0.2 + Math.random() * 0.6,
                            y: wy + 0.2 + Math.random() * 0.4,
                            vx: (Math.random() - 0.5) * 0.08,
                            vy: -0.12 - Math.random() * 0.1,
                            decay: 0.03 + Math.random() * 0.02,
                            color: Math.random() < 0.5 ? '#9933cc' : '#bb44ff',
                            size: 2 + Math.random() * 2,
                            alpha: 0.55,
                            shape: 'square',
                        });
                    }

                    // Smoke emission from buildings: thin/gray while idle, thicker
                    // and warmer while a colonist is actively working here.
                    if (tile.structure && !entity) {
                        const bDef = BUILDINGS[tile.structure];
                        if (bDef && bDef.smokeEmitter) {
                            const smokeCfg = RENDER_CONFIG.chimneySmoke;
                            const active = this._workingBuildingSet.has(tileKey);
                            const sp = active ? smokeCfg.active : smokeCfg.idle;
                            if (Math.random() < sp.spawnChance * spawnScale) {
                                const windDrift = (detailWind - 0.5) * 0.3;
                                const [tr, tg, tb] = sp.tint;
                                const jit = () => Math.floor((Math.random() - 0.5) * 30);
                                spawnParticle(game, {
                                    x: wx + 0.5 + (Math.random() - 0.5) * 0.3,
                                    y: wy - 0.1,
                                    vx: windDrift / cw * 40,
                                    vy: -sp.rise - Math.random() * 0.2,
                                    decay: 0.05 + Math.random() * 0.03,
                                    color: `rgba(${tr + jit()},${tg + jit()},${tb + jit()},1)`,
                                    size: sp.size + Math.random() * 2,
                                    alpha: sp.alpha,
                                    shape: 'square',
                                });
                            }
                        }
                    }

                    // Candle wisp and campfire ember particles
                    if (tile.structure && !entity) {
                        const bDef = BUILDINGS[tile.structure];
                        if (bDef && bDef.candleEmitter && Math.random() < 0.03 * spawnScale) {
                            spawnParticle(game, {
                                x: wx + 0.4 + Math.random() * 0.2,
                                y: wy + 0.15 + Math.random() * 0.1,
                                vx: (Math.random() - 0.5) * 0.06,
                                vy: -0.18 - Math.random() * 0.1,
                                decay: 0.06,
                                color: Math.random() < 0.6 ? '#ffcc44' : '#ff8822',
                                size: 1 + Math.random(),
                                alpha: 0.7,
                                shape: 'square',
                            });
                        }
                        if (tile.structure === 'campfire' && Math.random() < 0.1 * spawnScale) {
                            spawnParticle(game, {
                                x: wx + 0.3 + Math.random() * 0.4,
                                y: wy + 0.2 + Math.random() * 0.2,
                                vx: (Math.random() - 0.5) * 0.12,
                                vy: -0.25 - Math.random() * 0.15,
                                decay: 0.05,
                                color: Math.random() < 0.5 ? '#ff6600' : '#ffaa00',
                                size: 1.5 + Math.random() * 1.5,
                                alpha: 0.75,
                                shape: 'square',
                            });
                        }
                    }

                    // Falling leaves: trees in autumn with enough wind
                    if (tile.resource && tile.resource.type === 'tree' && season === 'autumn'
                        && detailWind > 0.3 && Math.random() < 0.003 * spawnScale) {
                        const leafColors = ['#cc7722', '#dd9922', '#bb5511', '#eeaa22'];
                        spawnParticle(game, {
                            x: wx + 0.3 + Math.random() * 0.4,
                            y: wy + 0.3,
                            vx: (detailWind * 0.4 - 0.1) + (Math.random() - 0.5) * 0.15,
                            vy: 0.2 + Math.random() * 0.15,
                            decay: 0.004,
                            color: leafColors[Math.floor(Math.random() * leafColors.length)],
                            size: 2,
                            alpha: 0.85,
                            wobble: 6 + Math.random() * 4,
                            shape: 'square',
                        });
                    }

                    if (tile.structure) {

                        // Working building pulse glow
                        if (this._workingBuildingSet.has(tileKey)) {
                            const bDef = BUILDINGS[tile.structure];
                            // Reduced motion: hold the glow steady instead of pulsing.
                            const pulse = reduceMotion ? 0.8 : 0.6 + 0.4 * Math.sin(now * 0.004);
                            const glowColor = bDef?.workGlowColor || (tile.structure.includes('forge') || tile.structure.includes('smelter') ? '#ff8833' : tile.structure.includes('lab') || tile.structure.includes('library') ? '#4488ff' : tile.structure.includes('kitchen') || tile.structure.includes('cook') ? '#ffcc22' : '#88ff88');
                            const radius = cw * 0.9 * pulse;
                            const glow = this._getGlowSprite(glowColor);
                            ctx.save();
                            ctx.globalCompositeOperation = 'lighter';
                            ctx.globalAlpha = 0.18 * pulse;
                            ctx.imageSmoothingEnabled = true;
                            ctx.drawImage(glow, px + cw / 2 - radius, py + ch / 2 - radius, radius * 2, radius * 2);
                            ctx.restore();
                        }

                        // Construction shake: buildings being built wobble on hack-bob downstroke
                        if (tile.designation && tile.designation.type === 'build') {
                            const structSprite = this.skinManager.getSprite('buildings', tile.designation.buildType);
                            if (structSprite) {
                                const shakeAmt = reduceMotion ? 0 : 0.5;
                                const shakeX = Math.sin(now * 0.05) * shakeAmt;
                                const shakeY = reduceMotion ? 0 : Math.abs(Math.sin(now * 0.05)) * 0.3;
                                ctx.globalAlpha = 0.4;
                                ctx.drawImage(structSprite, px + shakeX, py + shakeY, cw1, ch1);
                                ctx.globalAlpha = 1;
                            }
                        }
                    }

                    // Draw the placed item image on top of its pedestal if applicable.
                    if (tile.pedestalArtifact) {
                        const itemSprite = sm.getSprite('items', tile.pedestalArtifact);
                        if (itemSprite) {
                            const iSize = Math.floor(cw * 0.6);
                            const iOff = Math.floor((cw - iSize) / 2);
                            const iOffY = 0;
                            ctx.drawImage(itemSprite, px + iOff, py + iOffY, iSize, iSize);
                        }
                    }

                    // Determine if an effect exists so it can be drawn on top of all other sprites.
                    let effectSprite = null;
                    if (effect) {
                        effectSprite = this._resolveEffectSprite(effect);
                    } else if (portalMap.has(tileKey)) {
                        effectSprite = this._resolveEffectSprite('portal');
                    }
                    if (effectSprite) {
                        // Finally draw the overlay effect on top of all other sprites.
                        // Death markers float up and fade (deathFloatY/deathAlpha above).
                        if (isDeathFx) {
                            const prevA = ctx.globalAlpha;
                            ctx.globalAlpha = prevA * deathAlpha;
                            // Scale about the tile center so the skull grows in place.
                            const dw = cw * deathScale;
                            const dh = ch * deathScale;
                            ctx.drawImage(effectSprite, px + (cw - dw) / 2, py + deathFloatY + (ch - dh) / 2, dw, dh);
                            ctx.globalAlpha = prevA;
                        } else {
                            ctx.drawImage(effectSprite, px, py, cw1, ch1);
                        }
                        spriteDrawn = true;
                    }

                    // Draw partially opaque color over tiles that are being actively selected or have some colonist
                    // task designation (e.g. marked for destruction).
                    if (tile.designation) {
                        if (tile.designation.type === 'build' && tile.designation.buildType && !game.input?._hideGhosts) {
                            const ghostSprite = sm.getSprite('buildings', tile.designation.buildType)
                                || sm.getSprite('floors', tile.designation.buildType);
                            if (ghostSprite) {
                                if (!spriteDrawn) {
                                    const ground = this._resolveGroundSprite(tile, season);
                                    if (ground) {
                                        ctx.drawImage(ground, px, py, cw1, ch1);
                                        spriteDrawn = true;
                                    }
                                }
                                ctx.globalAlpha = 0.4;
                                ctx.drawImage(ghostSprite, px, py, cw1, ch1);
                                ctx.globalAlpha = 1.0;
                                spriteDrawn = true;
                            }
                        } else if (spriteDrawn && !(tile.designation.type === 'build' && game.input?._hideGhosts)) {
                            const tintColor = TILE_COLORS[`designation_${tile.designation.type}`] || '#ffff00';
                            ctx.fillStyle = tintColor;
                            ctx.globalAlpha = 0.35;
                            ctx.fillRect(px, py, cw1, ch1);
                            ctx.globalAlpha = 1.0;
                            lastColor = '';
                        }
                    }
                }

                // If a sprite was not drawn because it either doesn't exist or we are in ASCII mode, draw the set ASCII character instead.
                if (!spriteDrawn) {
                    const asciiShake = showOverlays && enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                    const asciiShakePx = atkShakePx;
                    const asx = asciiShake ? ((game.tick * 7) % (asciiShakePx * 2 + 1)) - asciiShakePx : 0;
                    const asy = asciiShake ? ((game.tick * 13) % (asciiShakePx + 1)) - Math.floor(asciiShakePx / 2) : 0;
                    if (char === '█' || char === '▓' || char === '▒') {
                        if (color !== lastColor) {
                            ctx.fillStyle = color;
                            lastColor = color;
                        }
                        ctx.fillRect(px + asx, py + asy, cw1, ch1);
                    } else {
                        if (skinActive) {
                            const ground = this._resolveGroundSprite(tile, season);
                            if (ground) ctx.drawImage(ground, px, py, cw1, ch1);
                        }
                        if (color !== lastColor) {
                            ctx.fillStyle = color;
                            lastColor = color;
                        }
                        ctx.fillText(char, px + this._textOffsetX + asx, py + asy);
                    }
                    if (effect) {
                        // Death markers float up and fade; other effects draw flat.
                        if (isDeathFx) {
                            const prevA = ctx.globalAlpha;
                            ctx.globalAlpha = prevA * deathAlpha;
                            ctx.fillStyle = effect.color;
                            // Grow in place: scale the glyph font and recenter it.
                            const scaledFont = Math.max(1, this.fontSize * deathScale);
                            ctx.font = `${scaledFont}px 'Courier New', monospace`;
                            const growY = (this.fontSize - scaledFont) / 2;
                            ctx.fillText(effect.char, px + this._textOffsetX, py + deathFloatY + growY);
                            ctx.font = `${this.fontSize}px 'Courier New', monospace`;
                            ctx.globalAlpha = prevA;
                        } else {
                            ctx.fillStyle = effect.color;
                            ctx.fillText(effect.char, px + this._textOffsetX, py);
                        }
                        lastColor = '';
                    }
                }

                // If a sprite is underneath the Nexus Wave path then we should re-draw the background color at a lower opacity.
                if (spriteDrawn && showPortalPath && portalPathMap.has(tileKey)) {
                    ctx.fillStyle = COMBAT_VISUALS.portalPathColor;
                    ctx.globalAlpha = 0.35;
                    ctx.fillRect(px, py, cw1, ch1);
                    ctx.globalAlpha = 1.0;
                    lastColor = '';
                }

                // Draw click and drag selection and build preview background colors with a lower opacity if a sprite was already drawn on that tile.
                if (spriteDrawn && (inSelection || (cursor && cursor.x === wx && cursor.y === wy))) {
                    ctx.globalAlpha = 0.35;
                    if (inSelection && buildDragPreview) {
                        if (buildDragPreview.blocked && buildDragPreview.blocked.has(tileKey)) {
                            ctx.fillStyle = '#cc2222';
                        } else if (buildDragPreview.affordable.has(tileKey)) {
                            ctx.fillStyle = '#22cc22';
                        } else if (buildDragPreview.unaffordable.has(tileKey)) {
                            ctx.fillStyle = '#cc2222';
                        } else {
                            ctx.fillStyle = RENDER_CONFIG.selectionBgBuild;
                        }
                    } else if (inSelection) {
                        ctx.fillStyle = game.input.mode === 'zone' ? RENDER_CONFIG.selectionBgZone : RENDER_CONFIG.selectionBgBuild;
                    } else {
                        ctx.fillStyle = RENDER_CONFIG.cursorBg;
                    }
                    ctx.fillRect(px, py, cw1, ch1);
                    ctx.globalAlpha = 1.0;
                    lastColor = '';
                }

                // Pulsing selection outline on buildings under cursor
                if (spriteDrawn && cursor && cursor.x === wx && cursor.y === wy && tile.structure) {
                    const pulseAlpha = 0.5 + 0.5 * Math.sin(now * 0.006);
                    const pulseWidth = 1 + Math.sin(now * 0.006) * 0.5;
                    ctx.save();
                    ctx.strokeStyle = '#ffcc44';
                    ctx.lineWidth = pulseWidth;
                    ctx.globalAlpha = pulseAlpha;
                    ctx.strokeRect(px + 0.5, py + 0.5, cw1 - 1, ch1 - 1);
                    ctx.restore();
                    lastColor = '';
                }
            }
        }

        if (rprof) { const t = performance.now(); rprof.add('render:tileLoop', t - rmark); rmark = t; }

        // Draw water ripples on top of all tiles (rain impacts + footsteps)
        this._drawWaterRipples(ctx, camera, cw, ch, dt);

        // --- Tile-entry detection: detect when a lerping entity arrives at its destination ---
        // Used for footstep ripples, disturbed grass, and door flash.
        for (const me of movingEntities) {
            const ent = me.entity;
            const lastTile = ent._lastRenderedTile;
            // Water splash: fire at movement START (destination tile is ent.x/y once lerp begins)
            if (isEntityMoving(ent) && !ent._lastWasMoving) {
                const destTile = game.map[ent.y]?.[ent.x];
                if (destTile && (destTile.terrain === 'water' || destTile.terrain === 'shallow_water')) {
                    const numSplash = 4 + Math.floor(Math.random() * 3);
                    for (let sp = 0; sp < numSplash; sp++) {
                        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.6;
                        const speed = 0.35 + Math.random() * 0.35;
                        spawnParticle(game, {
                            x: ent.x + 0.3 + Math.random() * 0.4,
                            y: ent.y + 0.4 + Math.random() * 0.2,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            ay: 0.3,
                            decay: 0.45,
                            color: Math.random() < 0.5 ? '#88ccff' : '#aaddff',
                            size: 1.5 + Math.random(),
                            alpha: 0.75,
                            shape: 'square',
                            maxY: ent.y + 1,
                        });
                    }
                }
            }
            ent._lastWasMoving = isEntityMoving(ent);
            if (!isEntityMoving(ent)) {
                // Lerp just finished. ent.x/ent.y is the new tile.
                if (!lastTile || lastTile.x !== ent.x || lastTile.y !== ent.y) {
                    const destTile = game.map[ent.y]?.[ent.x];
                    if (destTile) {
                        const destKey = ent.y * CONFIG.MAP_WIDTH + ent.x;
                        if (GRASS_TERRAIN.has(destTile.terrain) && !destTile.snowCovered) {
                            this._grassBoost.set(destKey, { startTime: now, duration: 500, amp: (Math.random() < 0.5 ? 1 : -1) * 0.13 });
                            for (const [ndx, ndy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                                const nx = ent.x + ndx, ny = ent.y + ndy;
                                if (nx >= 0 && ny >= 0 && nx < CONFIG.MAP_WIDTH && ny < CONFIG.MAP_HEIGHT) {
                                    const nk = ny * CONFIG.MAP_WIDTH + nx;
                                    const existing = this._grassBoost.get(nk);
                                    if (!existing) {
                                        this._grassBoost.set(nk, { startTime: now, duration: 500, amp: (Math.random() < 0.5 ? 1 : -1) * 0.07 });
                                    }
                                }
                            }
                        }
                        if (destTile.zone && destTile.zone.crop && destTile.zone.state !== 'empty') {
                            this._cropBoost.set(destKey, { startTime: now, duration: 600, amp: (Math.random() < 0.5 ? 1 : -1) * 0.04 });
                        }
                        for (const [ndx, ndy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                            const nx = ent.x + ndx, ny = ent.y + ndy;
                            if (nx >= 0 && ny >= 0 && nx < CONFIG.MAP_WIDTH && ny < CONFIG.MAP_HEIGHT) {
                                const nk = ny * CONFIG.MAP_WIDTH + nx;
                                const adjTile = game.map[ny]?.[nx];
                                if (adjTile && adjTile.zone && adjTile.zone.crop && adjTile.zone.state !== 'empty' && !this._cropBoost.get(nk)) {
                                    this._cropBoost.set(nk, { startTime: now, duration: 600, amp: (Math.random() < 0.5 ? 1 : -1) * 0.025 });
                                }
                            }
                        }
                        if (destTile.structure) {
                            this._doorFlash.set(destKey, 8);
                        }
                    }
                    ent._lastRenderedTile = { x: ent.x, y: ent.y };
                }
            } else {
                // Still moving. Fire door flash at lerp start (destination tile just changed).
                if (!lastTile || lastTile.x !== ent.x || lastTile.y !== ent.y) {
                    const destTile = game.map[ent.y]?.[ent.x];
                    if (destTile && destTile.structure && BUILDINGS[destTile.structure]?.structureType === 'door') {
                        this._doorFlash.set(ent.y * CONFIG.MAP_WIDTH + ent.x, 8);
                    }
                    ent._lastRenderedTile = { x: ent.x, y: ent.y };
                }
            }
        }

        // Also detect tile entry for stationary entities that just finished moving
        for (const [, entData] of entityMap) {
            const ent = entData._sim;
            if (!ent) continue;
            const lastTile = ent._lastRenderedTile;
            if (!lastTile || lastTile.x !== ent.x || lastTile.y !== ent.y) {
                const destTile = game.map[ent.y]?.[ent.x];
                if (destTile) {
                    const destKey = ent.y * CONFIG.MAP_WIDTH + ent.x;
                    if (destTile.terrain === 'water' || destTile.terrain === 'shallow_water') {
                        this._spawnWaterRipple(ent.x, ent.y, cw, 1.5);
                    } else if (GRASS_TERRAIN.has(destTile.terrain) && !destTile.snowCovered) {
                        this._grassBoost.set(destKey, { startTime: now, duration: 500, amp: (Math.random() < 0.5 ? 1 : -1) * 0.13 });
                        for (const [ndx, ndy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                            const nx = ent.x + ndx, ny = ent.y + ndy;
                            if (nx >= 0 && ny >= 0 && nx < CONFIG.MAP_WIDTH && ny < CONFIG.MAP_HEIGHT) {
                                const nk = ny * CONFIG.MAP_WIDTH + nx;
                                const existing = this._grassBoost.get(nk);
                                if (!existing) {
                                    this._grassBoost.set(nk, { startTime: now, duration: 500, amp: (Math.random() < 0.5 ? 1 : -1) * 0.07 });
                                }
                            }
                        }
                    }
                    if (destTile.zone && destTile.zone.crop && destTile.zone.state !== 'empty') {
                        this._cropBoost.set(destKey, { startTime: now, duration: 600, amp: (Math.random() < 0.5 ? 1 : -1) * 0.04 });
                    }
                    for (const [ndx, ndy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                        const nx = ent.x + ndx, ny = ent.y + ndy;
                        if (nx >= 0 && ny >= 0 && nx < CONFIG.MAP_WIDTH && ny < CONFIG.MAP_HEIGHT) {
                            const nk = ny * CONFIG.MAP_WIDTH + nx;
                            const adjTile = game.map[ny]?.[nx];
                            if (adjTile && adjTile.zone && adjTile.zone.crop && adjTile.zone.state !== 'empty' && !this._cropBoost.get(nk)) {
                                this._cropBoost.set(nk, { startTime: now, duration: 600, amp: (Math.random() < 0.5 ? 1 : -1) * 0.025 });
                            }
                        }
                    }
                    if (destTile.structure) {
                        this._doorFlash.set(destKey, 8);
                    }
                }
                ent._lastRenderedTile = { x: ent.x, y: ent.y };
            }
        }

        // --- Draw moving entities at interpolated positions ---
        for (const me of movingEntities) {
            const pos = getEntityRenderPos(me.entity, now);
            const sx = pos.x - camera.x;
            const sy = pos.y - camera.y;
            if (sx < -1 || sx >= vw + 1 || sy < -1 || sy >= vh + 1) continue;
            const ent = me.entity;
            const shakeActive = showOverlays && enableScreenShake && ent._atkShakeUntil > game.tick;
            const sPxE = atkShakePx;
            const shakeX = shakeActive ? ((game.tick * 7) % (sPxE * 2 + 1)) - sPxE : 0;
            const shakeY = shakeActive ? ((game.tick * 13) % (sPxE + 1)) - Math.floor(sPxE / 2) : 0;
            // Snapped like the tile loop so a step ends exactly on its tile's pixels.
            const rpx = (Math.round(pos.x * tileP) + tileOffX) / dpr + shakeX;
            const rpy = (Math.round(pos.y * tileP) + tileOffY) / dpr + shakeY;
            if (skinActive) {
                const destTile = map[ent.y]?.[ent.x];
                const meHl = !!(me.type === 'colonist' && game.settings.showColonistHighlight);
                const sprite = this._resolveSprite(destTile || {}, me, season, meHl);
                if (sprite) {
                    // "In water" when stepping between two water tiles (both source and
                    // destination are water). If _prevX is null the entity is effectively
                    // standing, so fall back to just the destination tile.
                    const destWater = destTile && destTile.terrain === 'water';
                    const prevTile = (ent._prevX != null) ? map[ent._prevY]?.[ent._prevX] : null;
                    const inWater = destWater && (ent._prevX == null || (prevTile && prevTile.terrain === 'water'));
                    // Submerge: clip the lower part of the sprite at a bobbing waterline
                    // (matching the static path) so a swimmer reads as half-submerged.
                    const detailCfg = RENDER_CONFIG.terrainDetail;
                    const submerge = !!(inWater && showTerrainDetail
                        && detailCfg && detailCfg.enabled && detailCfg.submergeFrac > 0);
                    // Draw entity shadow, raised to the waterline while submerged.
                    const shadowSprite = sm.getSprite('effects', 'shadow');
                    const shadowLift = submerge ? ch * detailCfg.submergeFrac : 0;
                    if (shadowSprite) ctx.drawImage(shadowSprite, rpx, rpy - shadowLift, cw, ch);
                    // Draw entity.
                    const meHlOff = meHl ? 1 : 0;
                    // Move progress (0→1) drives the walk-sway. Recomputed here because
                    // getEntityRenderPos leaves _moveStartTime/_moveDuration intact.
                    // Clamp so a just-finished step reads 1 (upright).
                    const moveT = ent._moveDuration > 0
                        ? Math.min(1, Math.max(0, (now - ent._moveStartTime) / ent._moveDuration))
                        : 1;
                    // Composed transform: breathe grow + walk-sway + one-shot action + work bob.
                    // Wraps only the sprite draw so the shadow (above) and overlays (below) stay flat.
                    const xf = getEntityTransform(ent, now, game, moveT, ent.id || 0, animFlags);
                    const grow = xf.growPx;
                    if (submerge) {
                        const wavePhase = (now / detailCfg.waterPeriodMs) * Math.PI * 2
                            + ((ent.x + ent.y * mapW) % 1000) / 1000 * detailCfg.waterPhaseSpread;
                        const bob = Math.sin(wavePhase) * detailCfg.submergeBobPx;
                        const waterlineY = rpy + ch - ch * detailCfg.submergeFrac + bob;
                        const clipTop = rpy - ch - grow;   // generous: never clip the head
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(rpx - cw, clipTop, cw * 3, waterlineY - clipTop);
                        ctx.clip();
                    }
                    if (!xf.identity) {
                        this._drawEntityXf(ctx, sprite, xf, rpx - meHlOff, rpy - meHlOff - grow, cw + meHlOff * 2, ch + meHlOff * 2 + grow, rpx + cw / 2, rpy + ch);
                    } else {
                        ctx.drawImage(sprite, rpx - meHlOff, rpy - meHlOff - grow, cw + meHlOff * 2, ch + meHlOff * 2 + grow);
                    }
                    if (submerge) {
                        ctx.restore();
                    } else if (inWater) {
                        // Fallback when terrain detail is off: legacy overlay on top.
                        const waterSprite = sm.getSprite('effects', 'in_water');
                        if (waterSprite) ctx.drawImage(waterSprite, rpx, rpy, cw, ch);
                    }
                    // Optional per-school cast overlay (null art → skipped gracefully).
                    if (xf.overlayKey) {
                        const overlaySprite = sm.getSprite('effects', xf.overlayKey);
                        if (overlaySprite) {
                            ctx.globalAlpha = xf.overlayAlpha;
                            ctx.drawImage(overlaySprite, rpx, rpy, cw, ch);
                            ctx.globalAlpha = 1.0;
                        }
                    }
                } else {
                    ctx.fillStyle = me.color;
                    ctx.fillText(me.char, rpx + this._textOffsetX, rpy);
                }
                if (showOverlays && showDamageFlash && ent._dmgFlashUntil > game.tick) {
                    const flashSprite = sm.getSprite('effects', 'damage_flash');
                    if (flashSprite) {
                        ctx.drawImage(flashSprite, rpx, rpy, cw, ch);
                    } else {
                        ctx.globalAlpha = COMBAT_VISUALS.dmgFlashAlpha;
                        ctx.fillStyle = COMBAT_VISUALS.dmgFlashColor;
                        ctx.fillRect(rpx, rpy, cw, ch);
                        ctx.globalAlpha = 1.0;
                    }
                }
                if (showOverlays && me.freezing) {
                    ctx.globalAlpha = 0.35;
                    ctx.fillStyle = '#88ddff';
                    ctx.fillRect(rpx, rpy, cw, ch);
                    ctx.globalAlpha = 1.0;
                }
                if (shakeActive) {
                    this._queueAttackEffect(ent, now, rpx - shakeX, rpy - shakeY, cw, ch);
                }
            } else {
                ctx.fillStyle = (showOverlays && showDamageFlash && ent._dmgFlashUntil > game.tick) ? COMBAT_VISUALS.dmgFlashColor : me.color;
                ctx.fillText(me.char, rpx + this._textOffsetX, rpy);
            }
        }

        // --- Death dissolve: topple + fade for recently-dead entities ---
        if (skinActive && dyingEntities.length > 0) {
            const DEATH_DISSOLVE_MS = 600;
            for (const ent of dyingEntities) {
                const elapsed = now - (ent._dyingStart || now);
                const t = Math.min(1, elapsed / DEATH_DISSOLVE_MS);
                const sx = ent.x - camera.x;
                const sy = ent.y - camera.y;
                if (sx < -1 || sx >= vw + 1 || sy < -1 || sy >= vh + 1) continue;
                const rpx = (ent.x * tileP + tileOffX) / dpr;
                const rpy = (ent.y * tileP + tileOffY) / dpr;
                const sprite = this._resolveSprite(game.map[ent.y]?.[ent.x] || {}, { type: ent.type || 'raider', entityType: ent.type, char: ent.char, color: ent.color }, season, false);
                if (!sprite) continue;
                const toppleRot = t * 1.4;
                const alpha = 1 - t;
                ctx.save();
                ctx.globalAlpha = alpha;
                const pivotX = rpx + cw / 2;
                const pivotY = rpy + ch;
                ctx.translate(pivotX, pivotY);
                ctx.rotate(toppleRot);
                ctx.translate(-pivotX, -pivotY);
                ctx.drawImage(sprite, rpx, rpy - t * 2, cw, ch);
                ctx.restore();
            }
        }

        // Melee attack effects were deferred while the tile loop ran (an offset
        // effect would otherwise be painted over by the target's tile, which the
        // loop draws later). Flush them now, on top of every tile and entity.
        this._flushAttackEffects(ctx);

        // --- Draw projectiles at interpolated positions ---
        if (game.projectiles && showOverlays && game.settings.showProjectiles) {
            for (const p of game.projectiles) {
                const t = Math.min(1, (now - p._startTime) / p._duration);
                const px2 = p.fromX + (p.toX - p.fromX) * t;
                const py2 = p.fromY + (p.toY - p.fromY) * t;
                const screenX = (px2 - camera.x) * cw;
                const screenY = (py2 - camera.y) * ch;
                if (screenX < -cw || screenX > this.canvas.width || screenY < -ch || screenY > this.canvas.height) continue;
                if (skinActive) {
                    const sprite = p.skinKey ? sm.getSprite('effects', p.skinKey) : null;
                    if (sprite) {
                        const angle = Math.atan2(p.toY - p.fromY, p.toX - p.fromX);
                        const cx = Math.round(screenX) + cw / 2;
                        const cy = Math.round(screenY) + ch / 2;
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.rotate(angle);
                        ctx.drawImage(sprite, -cw / 2, -ch / 2, cw, ch);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = p.color;
                        ctx.fillText(p.char, Math.round(screenX) + this._textOffsetX, Math.round(screenY));
                    }
                } else {
                    ctx.fillStyle = p.color;
                    ctx.fillText(p.char, Math.round(screenX) + this._textOffsetX, Math.round(screenY));
                }
            }
        }

        const nameMode = game.settings.showColonistNames;
        if (nameMode === 'always' || nameMode === 'selected') {
            const nameFontSize = Math.max(8, this.fontSize * 0.6);
            if (!this._nameCache) this._nameCache = new Map();
            if (!this._pixelFontReady) {
                this._pixelFontReady = document.fonts.check(`${nameFontSize}px 'Pixelify Sans'`);
                if (!this._pixelFontReady) {
                    document.fonts.load(`${nameFontSize}px 'Pixelify Sans'`).then(() => {
                        this._pixelFontReady = true;
                        this._nameCache.clear();
                    });
                }
            }
            if (this._nameCacheFontSize !== nameFontSize) {
                this._nameCache.clear();
                this._nameCacheFontSize = nameFontSize;
            }
            ctx.save();
            ctx.globalAlpha = 0.8;
            for (const c of colonists) {
                if (c.hp <= 0 || c.onExpedition) continue;
                if (nameMode === 'selected' && c !== game.selectedColonist) continue;
                const pos = getEntityRenderPos(c, now);
                const sx = pos.x - camera.x;
                const sy = pos.y - camera.y;
                if (sx < 0 || sx >= vw || sy < 0 || sy >= vh) continue;
                const color = c.nameColor || '#ffff00';
                const cacheKey = `${c.id}:${c.name}:${color}`;
                let cached = this._nameCache.get(cacheKey);
                if (!cached) {
                    const nameFont = `${nameFontSize}px 'Pixelify Sans', monospace`;
                    const offscreen = document.createElement('canvas');
                    const offCtx = offscreen.getContext('2d');
                    offCtx.font = nameFont;
                    const tw = Math.ceil(offCtx.measureText(c.name).width) + 4;
                    const th = Math.ceil(nameFontSize) + 4;
                    offscreen.width = tw;
                    offscreen.height = th;
                    offCtx.font = nameFont;
                    offCtx.textBaseline = 'bottom';
                    const tx = 2, ty = th - 1;
                    offCtx.fillStyle = '#000000';
                    offCtx.fillText(c.name, tx - 1, ty - 1);
                    offCtx.fillText(c.name, tx + 1, ty - 1);
                    offCtx.fillText(c.name, tx - 1, ty + 1);
                    offCtx.fillText(c.name, tx + 1, ty + 1);
                    offCtx.fillStyle = color;
                    offCtx.fillText(c.name, tx, ty);
                    cached = { canvas: offscreen, ox: Math.round(tw / 2), oy: th - 1 };
                    this._nameCache.set(cacheKey, cached);
                }
                const nx = Math.round((sx + 0.5) * cw);
                const ny = Math.round(sy * ch) - 1;
                ctx.drawImage(cached.canvas, nx - cached.ox, ny - cached.oy);
            }
            ctx.restore();
        }

        // --- Active complex structure glow ---
        // A persistent, gently pulsing aura on each activated core so the player can
        // see at a glance that a Great Forge / Ritual Circle is live, visible in
        // daylight, complementing the night light source added in _getLightSources.
        if (game.activeComplexStructures && game.activeComplexStructures.length) {
            for (const s of game.activeComplexStructures) {
                const def = COMPLEX_STRUCTURES[s.key];
                if (!def || !def.activeLightRadius) continue;
                const coreDef = BUILDINGS[def.coreBuild];
                const cx = (s.x - camera.x + 0.5) * cw;
                const cy = (s.y - camera.y + 0.5) * ch;
                const pulse = 0.85 + 0.10 * Math.sin(now * 0.0031) + 0.07 * Math.sin(now * 0.0071);
                const radius = def.activeLightRadius * cw * 0.6 * pulse;
                if (cx < -radius || cy < -radius || cx > this.canvas.width + radius || cy > this.canvas.height + radius) continue;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.28 * pulse;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                gradient.addColorStop(0, coreDef?.color || '#ffffff');
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        if (rprof) { const t = performance.now(); rprof.add('render:entities+names+glow', t - rmark); rmark = t; }

        // --- Night overlay ---
        // Renders darkness as a per-tile alpha overlay. Uses a precomputed "light grid"
        // (Float32Array) so cost is O(viewport + sources*radius²) instead of
        // O(viewport * sources). Darkness is quantized into discrete alpha steps
        // (nightGradientSteps) to minimize fillStyle changes on the canvas context.
        const darkness = game.settings.showNightLighting ? this.getNightDarkness(game.timeOfDay, season) : 0;
        if (darkness > 0) {
            const { sources, mobileSources } = this._getLightSources(game, camera);
            const steps = RENDER_CONFIG.nightGradientSteps;
            let [nr, ng, nb] = RENDER_CONFIG.nightOverlayColor;
            // Dawn/dusk warmth: blend the cold night-blue overlay toward a warm
            // orange during the twilight ramp so the shadows read golden at sunrise
            // and sunset. Fades to the plain night color by deep night / full day.
            const warmthCfg = RENDER_CONFIG.dawnDuskWarmth;
            if (warmthCfg && warmthCfg.enabled) {
                const warmth = this.getDawnDuskWarmth(game.timeOfDay, season) * (warmthCfg.warmthPeak || 0);
                if (warmth > 0.001) {
                    const [wr, wg, wb] = warmthCfg.warmthTintColor;
                    nr = Math.round(nr + (wr - nr) * warmth);
                    ng = Math.round(ng + (wg - ng) * warmth);
                    nb = Math.round(nb + (wb - nb) * warmth);
                }
            }
            // Light grid: each cell holds the max illumination (0..1) from any source.
            // Sources stamp their radius using Manhattan distance (matches the game's
            // tile-based movement so light feels consistent with gameplay distances).
            // Grid covers vw+2 x vh+2 tiles (matching the night canvas) so the two
            // extra edge columns/rows have real light values rather than clamped copies.
            const nightW = vw + 2;
            const nightH = vh + 2;
            if (!this._lightGrid || this._lightGrid.length < nightW * nightH) {
                this._lightGrid = new Float32Array(nightW * nightH);
            }
            if (!this._staticLightGrid || this._staticLightGrid.length < nightW * nightH) {
                this._staticLightGrid = new Float32Array(nightW * nightH);
            }
            const lightGrid = this._lightGrid;

            // Cache static light grid
            // Use Math.floor(camera) for grid alignment: the light grid maps integer
            // indices 0..vw-1 to the viewport tiles starting at Math.floor(camera.x).
            // Fractional camera offsets only affect where the overlay is drawn on screen.
            const camFloorX = Math.floor(camera.x);
            const camFloorY = Math.floor(camera.y);
            const srcHash = sources.reduce((h, s) => h ^ (s.x * 7919 + s.y * 104729 + s.radius * 31), 0) ^ (camFloorX * 48611 + camFloorY * 96293) ^ (sources.length * 104723) ^ (vw * 40503 + vh * 27691);
            if (srcHash !== this._lastLightHash) {
                this._lastLightHash = srcHash;
                this._staticLightGrid.fill(0);
                for (const src of sources) {
                    const localX = src.x - camFloorX;
                    const localY = src.y - camFloorY;
                    const r = src.radius;
                    const yStart = Math.max(0, localY - r);
                    const yEnd = Math.min(nightH - 1, localY + r);
                    const xStart = Math.max(0, localX - r);
                    const xEnd = Math.min(nightW - 1, localX + r);
                    for (let sy = yStart; sy <= yEnd; sy++) {
                        const rowOff = sy * nightW;
                        const dy = Math.abs(sy - localY);
                        for (let sx = xStart; sx <= xEnd; sx++) {
                            const dist = dy + Math.abs(sx - localX);
                            if (dist > r) continue;
                            const falloff = 1 - (dist / (r + 1));
                            const idx = rowOff + sx;
                            if (falloff > this._staticLightGrid[idx])
                            this._staticLightGrid[idx] = falloff;
                        }
                    }
                }
            }

            // Each frame: copy static grid, then stamp mobile sources on top
            lightGrid.set(this._staticLightGrid);
            for (const src of mobileSources) {
                const localX = src.x - camFloorX;
                const localY = src.y - camFloorY;
                const r = src.radius;
                const yStart = Math.max(0, localY - r);
                const yEnd = Math.min(nightH - 1, localY + r);
                const xStart = Math.max(0, localX - r);
                const xEnd = Math.min(nightW - 1, localX + r);
                for (let sy = yStart; sy <= yEnd; sy++) {
                    const rowOff = sy * nightW;
                    const dy = Math.abs(sy - localY);
                    for (let sx = xStart; sx <= xEnd; sx++) {
                        const dist = dy + Math.abs(sx - localX);
                        if (dist > r) continue;
                        const falloff = 1 - (dist / (r + 1));
                        const idx = rowOff + sx;
                        if (falloff > lightGrid[idx]) lightGrid[idx] = falloff;
                    }
                }
            }

            // Draw the darkness overlay via an offscreen buffer: write alpha values
            // into a small tile-resolution ImageData, put it onto a tiny offscreen
            // canvas, then drawImage it scaled up onto the main canvas. This replaces
            // thousands of fillRect calls with one drawImage composite.
            if (!this._nightCanvas) {
                this._nightCanvas = document.createElement('canvas');
                this._nightCtx = this._nightCanvas.getContext('2d', { alpha: true });
            }
            if (this._nightCanvas.width !== nightW || this._nightCanvas.height !== nightH) {
                this._nightCanvas.width = nightW;
                this._nightCanvas.height = nightH;
            }
            if (!this._nightImageData || this._nightImageData.width !== nightW || this._nightImageData.height !== nightH) {
                this._nightImageData = this._nightCtx.createImageData(nightW, nightH);
            }
            const nightData = this._nightImageData.data;
            for (let sy = 0; sy < nightH; sy++) {
                const rowOff = sy * nightW;
                for (let sx = 0; sx < nightW; sx++) {
                    const shade = Math.round((1 - lightGrid[rowOff + sx]) * steps);
                    const pIdx = (sy * nightW + sx) * 4;
                    if (shade < 1) {
                        nightData[pIdx + 3] = 0;
                    } else {
                        nightData[pIdx] = nr;
                        nightData[pIdx + 1] = ng;
                        nightData[pIdx + 2] = nb;
                        nightData[pIdx + 3] = Math.round(darkness * shade / steps * 255);
                    }
                }
            }
            this._nightCtx.putImageData(this._nightImageData, 0, 0);
            const prevSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            // Shift the overlay by the sub-tile fractional camera offset so darkness
            // tiles align with the tile sprites (snapped the same way as the tile loop:
            // physical tile pitch tileP, world origin at physical tileOffX/tileOffY).
            const nightOffX = (camFloorX * tileP + tileOffX) / dpr;
            const nightOffY = (camFloorY * tileP + tileOffY) / dpr;
            ctx.drawImage(this._nightCanvas, 0, 0, nightW, nightH, nightOffX, nightOffY, nightW * cw1, nightH * ch1);
            ctx.imageSmoothingEnabled = prevSmoothing;
        }

        if (rprof) { const t = performance.now(); rprof.add('render:night', t - rmark); rmark = t; }

        this.overlayRenderer.render(game, cw, ch, game.camera);

        if (rprof) { const t = performance.now(); rprof.add('render:overlayRenderer', t - rmark); rmark = t; }

        this.crtRenderer.render(game.settings);
    }

    renderFps(fps) {
        const ctx = this.ctx;
        ctx.save();
        const fpsFontSize = Math.round(12 * uiFontScale());
        ctx.font = `bold ${fpsFontSize}px monospace`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'left';
        ctx.fillText(`${fps} FPS`, 4, 4);
        ctx.restore();
    }

    _getLightSources(game, camera) {
        const sources = [];
        const mobileSources = [];
        const margin = RENDER_CONFIG.lightSourceMargin;
        const x0 = camera.x - margin;
        const y0 = camera.y - margin;
        const x1 = camera.x + CONFIG.VIEWPORT_WIDTH + margin;
        const y1 = camera.y + CONFIG.VIEWPORT_HEIGHT + margin;
        // The structure list is world-wide (the bounds test below culls it), so it
        // only needs refreshing when the simulation ticks, not as the camera moves.
        if (this._lastStructureTick === game.tick && this._lastStructureIndex === game.mapIndex) {
            // allStructures is still valid, skip rebuilding them.
        } else {
            this._lastStructureTick = game.tick;
            this._lastStructureIndex = game.mapIndex;
            this._structureMap = game.mapIndex ? game.mapIndex.getAllStructurePositions() : [];
        }

        const allStructures = this._structureMap;
        const noPower = game.power && !game.power.powered;

        for (const { x, y, type } of allStructures) {
            if (x < x0 || x > x1 || y < y0 || y > y1) continue;
            const bDef = BUILDINGS[type];
            if (!bDef || !bDef.lightRadius) continue;
            if (bDef.power && bDef.power.consumes && noPower) continue;
            sources.push({ x, y, radius: bDef.lightRadius });
        }

        for (const { x, y, type } of allStructures) {
            if (type !== 'artifact_pedestal') continue;
            if (x < x0 || x > x1 || y < y0 || y > y1) continue;
            const tile = game.map[y][x];
            if (!tile.pedestalArtifact || tile.pedestalInactive) continue;
            const artDef = ALL_ITEMS[tile.pedestalArtifact];
            if (artDef?.pedestal?.lightRadius) {
                sources.push({ x, y, radius: artDef.pedestal.lightRadius });
            }
        }

        for (const c of game.colonists) {
            if (c.hp <= 0 || c.onExpedition) continue;
            if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
            let radius = 0;
            if (c.trinket && !c.trinketBroken && c.trinket.pedestal?.lightRadius) {
                radius = Math.max(radius, c.trinket.pedestal.lightRadius);
            }
            if (c.tool?.lightRadius) {
                radius = Math.max(radius, c.tool.lightRadius);
            }
            if (radius > 0) {
                mobileSources.push({ x: c.x, y: c.y, radius });
            }
        }

        // Active complex structures glow from their core so an activated Great Forge
        // or Ritual Circle is obvious even in daylight-dimmed night lighting.
        if (game.activeComplexStructures) {
            for (const s of game.activeComplexStructures) {
                if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
                const radius = COMPLEX_STRUCTURES[s.key]?.activeLightRadius;
                if (radius) sources.push({ x: s.x, y: s.y, radius });
            }
        }

        return { sources, mobileSources };
    }
}

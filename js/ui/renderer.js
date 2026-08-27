import { CONFIG, TILE_COLORS, BUILDINGS, ARTIFACTS, RENDER_CONFIG, COMBAT_VISUALS } from '../core/config.js';
import { getTileVisuals } from '../world/map.js';
import { OverlayRenderer } from './overlay-renderer.js';
import { SkinManager } from './skin-manager.js';
import { getEntityRenderPos, isEntityMoving } from '../systems/movement-lerp.js';

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
        this._structureMap = new Map();

        // Terrain dithering
        this._ditherMasks = null;
        this._ditherTileSize = 0;
        this._ditherCache = new Map();

        this.measureFont(RENDER_CONFIG.fontSize);
    }

    measureFont(fontSize) {
        this.fontSize = fontSize;
        this.ctx.font = `${fontSize}px 'Courier New', monospace`;
        const metrics = this.ctx.measureText('M');
        this._textWidth = Math.ceil(metrics.width);
        this.charHeight = Math.ceil(fontSize * RENDER_CONFIG.fontHeightMult);
        this.charWidth = this.charHeight;
        this._textOffsetX = Math.floor((this.charWidth - this._textWidth) / 2);
        this._resizeCanvas();
    }

    _resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const w = (CONFIG.VIEWPORT_WIDTH + 1) * this.charWidth;
        const h = (CONFIG.VIEWPORT_HEIGHT + 1) * this.charHeight;
        const bw = Math.round(w * dpr);
        const bh = Math.round(h * dpr);
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.font = `${this.fontSize}px 'Courier New', monospace`;
            this.ctx.textBaseline = 'top';
        }
        this.overlayRenderer.resize(w, h);
        this._lastViewportW = CONFIG.VIEWPORT_WIDTH;
        this._lastViewportH = CONFIG.VIEWPORT_HEIGHT;
    }

    _resolveSprite(tile, entity, season, highlight) {
        const sm = this.skinManager;
        if (entity) {
            if (entity.type === 'colonist') {
                if (entity.sleeping) {
                    const key = entity.sleepingInBed ? 'colonist_sleeping' : 'colonist_sleeping_ground';
                    const s = sm.getSprite('entities', key) || sm.getColonistSleepingSprite();
                    if (s) return s;
                }
                if (entity.armorKey || entity.helmetKey || entity.weaponKey || entity.toolKey) {
                    const comp = sm.getCompositedColonistSprite(entity.colonistId, entity.drafted, entity.race, entity.armorKey, entity.helmetKey, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, entity.weaponKey, entity.toolKey, highlight);
                    if (comp) return comp;
                }
                return sm.getCompositedColonistSprite(entity.colonistId, entity.drafted, entity.race, null, null, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, null, null, highlight);
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
        if (tile.onFire) return sm.getSprite('effects', 'fire');
        if (tile.structure) return sm.getSprite('buildings', tile.structure);
        if (tile.zone) {
            const state = tile.zone.state || 'empty';
            if (tile.zone.crop) {
                const cropSprite = sm.getSprite('farms', tile.zone.crop + '_' + state);
                if (cropSprite) return cropSprite;
            }
            return sm.getSprite('farms', 'farm_' + state);
        }
        if (tile.resource) {
            const seasonal = sm.getSprite('resources', tile.resource.type + '_' + season);
            if (seasonal) return seasonal;
            return sm.getSprite('resources', tile.resource.type);
        }
        if (tile.floor) return sm.getSprite('floors', tile.floor);
        if (tile.snowCovered && tile.terrain === 'grass') return sm.getSprite('effects', 'snow');
        return sm.getSprite('terrain', tile.terrain);
    }

    _resolveGroundSprite(tile, season) {
        const sm = this.skinManager;
        if (tile.floor) {
            const floorSprite = sm.getSprite('floors', tile.floor);
            if (floorSprite) return floorSprite;
        }
        if (tile.snowCovered && tile.terrain === 'grass') {
            return sm.getSprite('effects', 'snow') || sm.getSprite('terrain', tile.terrain);
        }
        return sm.getSprite('terrain', tile.terrain);
    }

    _resolveMaterialSprite(tile, season) {
        const sm = this.skinManager;
        if (tile.resource) {
            const resourceSprite = sm.getSprite('resources', tile.resource.type + '_' + season);
            return resourceSprite ? resourceSprite : sm.getSprite('resources', tile.resource.type);
        }
        return null;
    }

    // Generates per-direction alpha masks for terrain edge dithering using ordered
    // (Bayer matrix) dithering. Each mask is a 1-tile canvas with white pixels where
    // the neighbor terrain should "bleed through". The 4x4 Bayer matrix provides a
    // perceptually even dot pattern that avoids banding artifacts at low densities.
    _generateDitherMasks(ditherDepthFraction, blockSize) {
        const cw = this.charWidth;
        const ch = this.charHeight;
        const depthFrac = ditherDepthFraction ?? RENDER_CONFIG.ditherDepth;
        const bs = blockSize || 1;
        const depth = Math.max(1, Math.round(cw * depthFrac));
        this._ditherTileSize = cw;
        this._ditherDepthFraction = depthFrac;
        this._ditherBlockSize = bs;
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
                    // at the border and fades to 0 — this creates a gradient from
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
            this._ditherMasks[dir] = canvas;
        }
    }

    _getDitherTile(terrain, dir) {
        const key = terrain + ':' + dir;
        if (this._ditherCache.has(key)) return this._ditherCache.get(key);

        const cw = this.charWidth;
        const ch = this.charHeight;
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
        if (distSetting === 'none') return;

        const baseTerrain = tile.terrain;

        for (const { dir, dx, dy } of DITHER_DIRECTIONS) {
            const nx = wx + dx;
            const ny = wy + dy;
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
            const neighbor = map[ny][nx];
            if (neighbor.terrain === baseTerrain) continue;

            const cached = this._getDitherTile(neighbor.terrain, dir);
            if (!cached) continue;

            ctx.drawImage(cached, px, py);
        }
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
        if (e.char === COMBAT_VISUALS.fireIgniteChar && e.color === COMBAT_VISUALS.fireIgniteColor) return this.skinManager.getSprite('effects', 'fire_ignite');
        if (e.char === COMBAT_VISUALS.golemActivateChar) return this.skinManager.getSprite('effects', 'golem_activate');
        if (e.char === COMBAT_VISUALS.xpGainChar && e.color === COMBAT_VISUALS.xpGainColor) return this.skinManager.getSprite('effects', 'xp_gain');
        if (e.char === COMBAT_VISUALS.needCriticalChar && e.color === COMBAT_VISUALS.needCriticalColor) return this.skinManager.getSprite('effects', 'need_critical');
        if (e.char === COMBAT_VISUALS.researchCompleteChar && e.color === COMBAT_VISUALS.researchCompleteColor) return this.skinManager.getSprite('effects', 'research_complete');
        if (e.char === COMBAT_VISUALS.healTickChar && e.color === COMBAT_VISUALS.healTickColor) return this.skinManager.getSprite('effects', 'heal_tick');
        return null;
    }

    // Continuous sine "breath": returns px of extra sprite height this frame
    // (0..breatheAmplitudePx). Driven by `now` (performance.now()) so it stays
    // smooth at 60fps and continues while paused. `seed` decorrelates each
    // entity's phase so the colony doesn't pulse in unison. Sub-pixel (no rounding).
    _breatheGrow(now, seed) {
        if (!RENDER_CONFIG.entityBreathing) return 0;
        const phase = (now / RENDER_CONFIG.breathePeriodMs) * Math.PI * 2
            + (seed % 1000) / 1000 * RENDER_CONFIG.breathePhaseSpread;
        // 0.5 - 0.5*cos → smooth 0→1→0, peaks mid-cycle.
        return (0.5 - 0.5 * Math.cos(phase)) * RENDER_CONFIG.breatheAmplitudePx;
    }

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

    render(game) {
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
        const sm = this.skinManager;
        const skinActive = sm.isActive;
        const atkShakePx = COMBAT_VISUALS.atkShakePx || 2;

        this.ctx.imageSmoothingEnabled = !skinActive;

        const { map, camera, colonists, entities, raiders, cursor } = game;
        const camKey = `${camera.x},${camera.y},${game.tick},${CONFIG.VIEWPORT_WIDTH},${CONFIG.VIEWPORT_HEIGHT},${this.charWidth}`;
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

        ctx.fillStyle = RENDER_CONFIG.bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dither settings are per-frame so we can do it once and re-use for all tiles.
        const ditherOn = RENDER_CONFIG.terrainDithering && (game.settings.ditherDistance || 'normal') !== 'none';
        const ditherDepthFrac = DITHER_DISTANCE_MAP[game.settings.ditherDistance || 'normal'] ?? 0.3; 
        const ditherQualSetting = (game && game.settings.ditherQuality) || 'high';
        const ditherBlockSize = DITHER_QUALITY_MAP[game.settings.ditherQuality] ?? 1;
        // Regenerate masks here, once, if inputs changed — moved out of the per-tile call:
        if (ditherOn && (!this._ditherMasks || this._ditherTileSize !== cw ||
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

        if (this._lastEntityMapKey === camKey) {
            // entityMap, rallySet, portalMap, etc. are still valid, skip all the rebuild loops.
        } else {
            this._lastEntityMapKey = camKey;

            entityMap.clear();
            
            movingEntities.length = 0;
            for (const e of entities) {
                if (e.hp <= 0) continue;
                if (isEntityMoving(e)) {
                    movingEntities.push({ entity: e, char: e.char, color: e.color, type: e.type });
                } else {
                    entityMap.set(e.y * mapW + e.x, { char: e.char, color: e.color, type: e.type, entityId: e.id, _dmgFlashUntil: e._dmgFlashUntil });
                }
            }
            if (game.waves) {
                for (const e of game.waves.enemies) {
                    if (e.hp <= 0) continue;
                    if (isEntityMoving(e)) {
                        movingEntities.push({ entity: e, char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type });
                    } else {
                        entityMap.set(e.y * mapW + e.x, { char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type, entityId: e.id, _dmgFlashUntil: e._dmgFlashUntil });
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
                    entityMap.set(r.y * mapW + r.x, { char: rChar, color: rColor, type: 'raider', entityType: r.type, entityId: r.id, _dmgFlashUntil: r._dmgFlashUntil });
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
                    const entData = { char: c.golem ? 'G' : '@', color, type: c.golem ? 'golem' : 'colonist', colonistId: c.id, entityId: c.id, race: c.race, bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant, nameColor: c.nameColor, drafted, golemType: c.golemType, sleeping: isSleeping, sleepingInBed, _dmgFlashUntil: c._dmgFlashUntil, _atkShakeUntil: c._atkShakeUntil, armorKey: showEq ? (c.armor?.key || null) : null, helmetKey: showEq ? (c.helmet?.key || null) : null, weaponKey: showEq ? (c.weapon?.key || null) : null, toolKey: showEq ? (c.tool?.key || null) : null };
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
                const pathPoints = game.waves.getPathPreview(game);
                for (const pt of pathPoints) {
                    const key = pt.y * mapW + pt.x;
                    if (!portalMap.has(key)) portalPathMap.set(key, true);
                }
            }
        }

        const effectMap = this._effectMap;

        if (this._lastSettingsKey === settingsKey && this._lastEntityMapKey === camKey) {
            // effectMap still valid, skip that loop.
        } else {
            this._lastSettingsKey = settingsKey;
            effectMap.clear();
            if (game.combatEffects && showOverlays && game.settings.showCombatParticles) {
                for (const e of game.combatEffects) {
                    effectMap.set(e.y * mapW + e.x, e);
                }
            }
        }
        
        // --- Tile rendering loop ---
        // Iterates over the visible viewport, drawing each tile as either a sprite
        // (skin active) or an ASCII character. Layering order for sprites:
        //   ground → structure/entity → dither → artifact overlay → designation tint
        // Effects (combat hits, shots, portals) draw as overlays on top of the base.
        let lastColor = '';
        for (let sy = 0; sy <= vh; sy++) {
            for (let sx = 0; sx <= vw; sx++) {
                // Keep track of the x,y coordinate for the tile we are currently drawing on and its relation to the player camera.
                const wx = camera.x + sx;
                const wy = camera.y + sy;
                const px = sx * cw;
                const py = sy * ch;

                if (wx < 0 || wx >= mapW || wy < 0 || wy >= CONFIG.MAP_HEIGHT) {
                    continue;
                }

                // Get ASCII info for this tile.
                const tile = map[wy][wx];
                let {char, color, bg} = getTileVisuals(tile, season);

                // Update tile color based on work task designation if one exists (e.g. marked for destruction).
                if (tile.designation) {
                    color = TILE_COLORS[`designation_${tile.designation.type}`] || '#ffff00';
                }

                // Update tile color if this tile has a Rift Gate and it is actively being used.
                if (tile.structure === 'rift_gate' && game.exploration && game.exploration.expeditions.length > 0) {
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

                // Draw background color if it was set.
                if (bg) {
                    ctx.fillStyle = bg;
                    ctx.fillRect(px, py, cw, ch);
                    lastColor = '';
                }

                // Draw anything that has a sprite (floors, structures, entities, & effects).
                // If a sprite doesn't exist for that element we will instead draw using ASCII later.
                let spriteDrawn = false;
                if (skinActive) {
                    // Draw ground sprite (terrain, floor, or furniture) so it will appear underneath the colonist sprite.
                    const needsGround = tile.structure && BUILDINGS[tile.structure] && BUILDINGS[tile.structure].structureType === 'furniture';
                    if (needsGround || entity) {
                        const ground = this._resolveGroundSprite(tile, season);
                        if (ground) ctx.drawImage(ground, px, py, cw + 1, ch + 1);
                        const material = this._resolveMaterialSprite(tile, season);
                        if (material) ctx.drawImage(material, px, py, cw, ch);
                    }
                    const canDither = !tile.structure && !tile.resource && !tile.zone && !tile.floor;
                    if (entity) {
                        if (canDither) this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        if (tile.structure) {
                            const structSprite = sm.getSprite('buildings', tile.structure);
                            if (structSprite) ctx.drawImage(structSprite, px, py, cw, ch);
                        }
                    }

                    // Determine if we have an entity sprite to draw on this tile.
                    const hl = !!(entity && entity.type === 'colonist' && game.settings.showColonistHighlight);
                    const sprite = this._resolveSprite(tile, entity, season, hl);
                    if (sprite) {
                        // Draw entity shadow.
                        const shadowSprite = sm.getSprite('effects', 'shadow');
                        if (shadowSprite) ctx.drawImage(sm.getSprite('effects', 'shadow'), px, py, cw, ch);
                        // Determine any shake effects that need to be applied to the entity sprite before we draw it.
                        const shakeActive = showOverlays && enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                        const shakePx = atkShakePx;
                        const shakeX = shakeActive ? ((game.tick * 7) % (shakePx * 2 + 1)) - shakePx : 0;
                        const shakeY = shakeActive ? ((game.tick * 13) % (shakePx + 1)) - Math.floor(shakePx / 2) : 0;
                        const hlOff = hl ? 1 : 0;
                        const bleed = entity ? 0 : 1;
                        // Breathing: stretch height, anchor feet by nudging y up by the same amount.
                        // Seeded by entity id so phase is continuous across stationary/moving transitions.
                        const grow = entity ? this._breatheGrow(now, entity.entityId || 0) : 0;
                        ctx.drawImage(sprite, px + shakeX - hlOff, py + shakeY - hlOff - grow, cw + hlOff * 2 + bleed, ch + hlOff * 2 + bleed + grow);
                        if (!entity && canDither) {
                            this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        }
                        if (showOverlays && showDamageFlash && entity && entity._dmgFlashUntil > game.tick) {
                            const flashSprite = sm.getSprite('effects', 'damage_flash');
                            if (flashSprite) {
                                ctx.drawImage(flashSprite, px + shakeX, py + shakeY, cw, ch);
                            } else {
                                ctx.globalAlpha = COMBAT_VISUALS.dmgFlashAlpha;
                                ctx.fillStyle = COMBAT_VISUALS.dmgFlashColor;
                                ctx.fillRect(px, py, cw, ch);
                                ctx.globalAlpha = 1.0;
                                lastColor = '';
                            }
                        }
                        // If we are actively shaking after an attack begins, draw the attack_swing overlay effect.
                        if (entity && shakeActive) {
                            const swingSprite = sm.getSprite('effects', 'attack_swing');
                            if (swingSprite) ctx.drawImage(swingSprite, px, py, cw, ch);
                        }
                        // Draw any combat effects relevant for this entity sprite.
                        if (showOverlays && showDamageFlash && !entity && tile.structure && tile._dmgFlashUntil > game.tick) {
                            const flashSprite = sm.getSprite('effects', 'damage_flash');
                            if (flashSprite) {
                                ctx.drawImage(flashSprite, px, py, cw, ch);
                            } else {
                                ctx.globalAlpha = COMBAT_VISUALS.dmgFlashAlpha;
                                ctx.fillStyle = COMBAT_VISUALS.dmgFlashColor;
                                ctx.fillRect(px, py, cw, ch);
                                ctx.globalAlpha = 1.0;
                                lastColor = '';
                            }
                        }
                        spriteDrawn = true;
                    }

                    // Draw the placed artifact image on top of its pedestal if applicable.
                    if (tile.pedestalArtifact) {
                        const itemSprite = sm.getSprite('items', tile.pedestalArtifact);
                        if (itemSprite) {
                            const iSize = Math.floor(cw * 0.6);
                            const iOff = Math.floor((cw - iSize) / 2);
                            ctx.drawImage(itemSprite, px + iOff, py + iOff, iSize, iSize);
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
                        ctx.drawImage(effectSprite, px, py, cw, ch);
                        spriteDrawn = true;
                    }

                    // Draw partially opaque color over tiles that are being actively selected or have some colonist
                    // task designation (e.g. marked for destruction).
                    if (tile.designation) {
                        if (tile.designation.type === 'build' && tile.designation.buildType) {
                            const ghostSprite = sm.getSprite('buildings', tile.designation.buildType)
                                || sm.getSprite('floors', tile.designation.buildType);
                            if (ghostSprite) {
                                if (!spriteDrawn) {
                                    const ground = this._resolveGroundSprite(tile, season);
                                    if (ground) {
                                        ctx.drawImage(ground, px, py, cw + 1, ch + 1);
                                        spriteDrawn = true;
                                    }
                                }
                                ctx.globalAlpha = 0.4;
                                ctx.drawImage(ghostSprite, px, py, cw, ch);
                                ctx.globalAlpha = 1.0;
                                spriteDrawn = true;
                            }
                        } else if (spriteDrawn) {
                            const tintColor = TILE_COLORS[`designation_${tile.designation.type}`] || '#ffff00';
                            ctx.fillStyle = tintColor;
                            ctx.globalAlpha = 0.35;
                            ctx.fillRect(px, py, cw, ch);
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
                        ctx.fillRect(px + asx, py + asy, cw, ch);
                    } else {
                        if (skinActive) {
                            const ground = this._resolveGroundSprite(tile, season);
                            if (ground) ctx.drawImage(ground, px, py, cw + 1, ch + 1);
                        }
                        if (color !== lastColor) {
                            ctx.fillStyle = color;
                            lastColor = color;
                        }
                        ctx.fillText(char, px + this._textOffsetX + asx, py + asy);
                    }
                    if (effect) {
                        ctx.fillStyle = effect.color;
                        ctx.fillText(effect.char, px + this._textOffsetX, py);
                        lastColor = '';
                    }
                }

                // If a sprite is underneath the Nexus Wave path then we should re-draw the background color at a lower opacity.
                if (spriteDrawn && showPortalPath && portalPathMap.has(tileKey)) {
                    ctx.fillStyle = COMBAT_VISUALS.portalPathColor;
                    ctx.globalAlpha = 0.35;
                    ctx.fillRect(px, py, cw, ch);
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
                    ctx.fillRect(px, py, cw, ch);
                    ctx.globalAlpha = 1.0;
                    lastColor = '';
                }
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
            const rpx = Math.round(sx * cw) + shakeX;
            const rpy = Math.round(sy * ch) + shakeY;
            if (skinActive) {
                const destTile = map[ent.y]?.[ent.x];
                const meHl = !!(me.type === 'colonist' && game.settings.showColonistHighlight);
                const sprite = this._resolveSprite(destTile || {}, me, season, meHl);
                if (sprite) {
                    // Draw entity shadow.
                    const shadowSprite = sm.getSprite('effects', 'shadow');
                    if (shadowSprite) ctx.drawImage(sm.getSprite('effects', 'shadow'), rpx, rpy, cw, ch);
                    // Draw entity.
                    const meHlOff = meHl ? 1 : 0;
                    // Breathing: stretch height, anchor feet by nudging y up by the same amount.
                    const grow = this._breatheGrow(now, ent.id || 0);
                    ctx.drawImage(sprite, rpx - meHlOff, rpy - meHlOff - grow, cw + meHlOff * 2, ch + meHlOff * 2 + grow);
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
                if (shakeActive) {
                    const swingSprite = sm.getSprite('effects', 'attack_swing');
                    if (swingSprite) ctx.drawImage(swingSprite, rpx - shakeX, rpy - shakeY, cw, ch);
                }
            } else {
                ctx.fillStyle = (showOverlays && showDamageFlash && ent._dmgFlashUntil > game.tick) ? COMBAT_VISUALS.dmgFlashColor : me.color;
                ctx.fillText(me.char, rpx + this._textOffsetX, rpy);
            }
        }

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
                        ctx.drawImage(sprite, Math.round(screenX), Math.round(screenY), cw, ch);
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
            ctx.save();
            ctx.font = `${Math.max(8, this.fontSize * 0.6)}px monospace`;
            ctx.textBaseline = 'bottom';
            ctx.globalAlpha = 0.8;
            for (const c of colonists) {
                if (c.hp <= 0 || c.onExpedition) continue;
                if (nameMode === 'selected' && c !== game.selectedColonist) continue;
                const pos = getEntityRenderPos(c, now);
                const sx = pos.x - camera.x;
                const sy = pos.y - camera.y;
                if (sx < 0 || sx >= vw || sy < 0 || sy >= vh) continue;
                const nx = Math.round(sx * cw);
                const ny = Math.round(sy * ch) - 1;
                ctx.fillStyle = '#000000';
                ctx.fillText(c.name, nx - 1, ny - 1);
                ctx.fillText(c.name, nx + 1, ny - 1);
                ctx.fillText(c.name, nx - 1, ny + 1);
                ctx.fillText(c.name, nx + 1, ny + 1);
                ctx.fillStyle = c.nameColor || '#ffff00';
                ctx.fillText(c.name, nx, ny);
            }
            ctx.restore();
        }

        // --- Night overlay ---
        // Renders darkness as a per-tile alpha overlay. Uses a precomputed "light grid"
        // (Float32Array) so cost is O(viewport + sources*radius²) instead of
        // O(viewport * sources). Darkness is quantized into discrete alpha steps
        // (nightGradientSteps) to minimize fillStyle changes on the canvas context.
        const darkness = game.settings.showNightLighting ? this.getNightDarkness(game.timeOfDay, season) : 0;
        if (darkness > 0) {
            const { sources, mobileSources } = this._getLightSources(game, camera);
            const steps = RENDER_CONFIG.nightGradientSteps;
            const [nr, ng, nb] = RENDER_CONFIG.nightOverlayColor;
            // Pre-build the style strings for each quantized darkness level
            const darkStyles = [];
            for (let i = 1; i <= steps; i++) {
                darkStyles.push(`rgba(${nr},${ng},${nb},${(darkness * i / steps).toFixed(3)})`);
            }

            // Light grid: each cell holds the max illumination (0..1) from any source.
            // Sources stamp their radius using Manhattan distance (matches the game's
            // tile-based movement so light feels consistent with gameplay distances).
            if (!this._lightGrid || this._lightGrid.length < vw * vh) {
                this._lightGrid = new Float32Array(vw * vh);
            }
            if (!this._staticLightGrid || this._staticLightGrid.length < vw * vh) {
                this._staticLightGrid = new Float32Array(vw * vh);
            }
            const lightGrid = this._lightGrid;

            // Cache static light grid
            const srcHash = sources.reduce((h, s) => h ^ (s.x * 7919 + s.y * 104729 + s.radius * 31), 0) ^ (camera.x * 48611 + camera.y * 96293) ^ (sources.length * 104723) ^ (vw * 40503 + vh * 27691);
            if (srcHash !== this._lastLightHash) {
                this._lastLightHash = srcHash;
                this._staticLightGrid.fill(0);
                for (const src of sources) {
                    const localX = src.x - camera.x;
                    const localY = src.y - camera.y;
                    const r = src.radius;
                    const yStart = Math.max(0, localY - r);
                    const yEnd = Math.min(vh - 1, localY + r);
                    const xStart = Math.max(0, localX - r);
                    const xEnd = Math.min(vw - 1, localX + r);
                    for (let sy = yStart; sy <= yEnd; sy++) {
                        const rowOff = sy * vw;
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
                const localX = src.x - camera.x;
                const localY = src.y - camera.y;
                const r = src.radius;
                const yStart = Math.max(0, localY - r);
                const yEnd = Math.min(vh - 1, localY + r);
                const xStart = Math.max(0, localX - r);
                const xEnd = Math.min(vw - 1, localX + r);
                for (let sy = yStart; sy <= yEnd; sy++) {
                    const rowOff = sy * vw;
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

            // Draw the darkness overlay — skip fully-lit tiles (shade < 1)
            let lastDarkStyle = '';
            for (let sy = 0; sy <= vh; sy++) {
                const rowOff = sy * vw;
                for (let sx = 0; sx <= vw; sx++) {
                    const shade = Math.round((1 - lightGrid[rowOff + sx]) * steps);
                    if (shade < 1) continue;
                    const style = darkStyles[shade - 1];
                    if (style !== lastDarkStyle) {
                        ctx.fillStyle = style;
                        lastDarkStyle = style;
                    }
                    ctx.fillRect(sx * cw, sy * ch, cw, ch);
                }
            }
        }

        this.overlayRenderer.render(game, cw, ch, game.camera);
    }

    renderFps(fps) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 12px monospace';
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
        const structureCamKey = `${camera.x},${camera.y},${game.tick},${CONFIG.VIEWPORT_WIDTH},${CONFIG.VIEWPORT_HEIGHT},${this.charWidth}`;
        
        if (this._lastStructureCamKey === structureCamKey) {
            // allStructures is still valid, skip rebuilding them.
        } else {
            this._lastStructureCamKey = structureCamKey;
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
            const artDef = ARTIFACTS[tile.pedestalArtifact];
            if (artDef?.pedestal?.lightRadius) {
                sources.push({ x, y, radius: artDef.pedestal.lightRadius });
            }
        }

        for (const c of game.colonists) {
            if (c.hp <= 0 || c.onExpedition) continue;
            if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
            let radius = 0;
            if (c.artifact && !c.artifactBroken && c.artifact.pedestal?.lightRadius) {
                radius = Math.max(radius, c.artifact.pedestal.lightRadius);
            }
            if (c.tool?.lightRadius) {
                radius = Math.max(radius, c.tool.lightRadius);
            }
            if (radius > 0) {
                mobileSources.push({ x: c.x, y: c.y, radius });
            }
        }

        const firePositions = game.mapIndex ? game.mapIndex.getFirePositions() : null;
        if (firePositions) {
            for (const { x, y } of firePositions) {
                if (x < x0 || x > x1 || y < y0 || y > y1) continue;
                sources.push({ x, y, radius: RENDER_CONFIG.fireLightRadius });
            }
        }

        return { sources, mobileSources };
    }
}

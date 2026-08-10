import { CONFIG, TILE_COLORS, BUILDINGS, ARTIFACTS, RENDER_CONFIG, COMBAT_VISUALS } from '../core/config.js';
import { getTileChar, getTileColor, getTileBg } from '../world/map.js';
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
        const w = CONFIG.VIEWPORT_WIDTH * this.charWidth;
        const h = CONFIG.VIEWPORT_HEIGHT * this.charHeight;
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
                    const comp = sm.getCompositedColonistSprite(entity.colonistId, entity.drafted, entity.armorKey, entity.helmetKey, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, entity.weaponKey, entity.toolKey, highlight);
                    if (comp) return comp;
                }
                return sm.getColonistSprite(entity.colonistId, entity.drafted, entity.bodyVariant, entity.hairVariant, entity.shirtVariant, entity.nameColor, highlight);
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
    _drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game) {
        if (!RENDER_CONFIG.terrainDithering) return;
        const distanceMap = { none: 0, minimal: 0.12, light: 0.2, normal: 0.3, heavy: 0.45, extreme: 0.6 };
        const qualityMap = { chunky: 4, low: 3, medium: 2, high: 1 };
        const distSetting = (game && game.settings.ditherDistance) || 'normal';
        if (distSetting === 'none') return;
        const depthFrac = distanceMap[distSetting] ?? 0.3;
        const qualSetting = (game && game.settings.ditherQuality) || 'high';
        const blockSize = qualityMap[qualSetting] ?? 1;
        if (!this._ditherMasks || this._ditherTileSize !== cw || this._ditherDepthFraction !== depthFrac || this._ditherBlockSize !== blockSize) {
            this._generateDitherMasks(depthFrac, blockSize);
            this._ditherCache.clear();
        }

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
        if (e.char === '✝') return this.skinManager.getSprite('effects', 'smite');
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
        if (this._lastViewportW !== CONFIG.VIEWPORT_WIDTH || this._lastViewportH !== CONFIG.VIEWPORT_HEIGHT) {
            this._resizeCanvas();
        }

        this.ctx.imageSmoothingEnabled = !this.skinManager.isActive;

        const { map, camera, colonists, entities, raiders, cursor } = game;
        const ctx = this.ctx;
        const cw = this.charWidth;
        const ch = this.charHeight;
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
                        if (tx >= 0 && ty >= 0 && tx < CONFIG.MAP_WIDTH && ty < CONFIG.MAP_HEIGHT) {
                            spellRangeSet.add(ty * CONFIG.MAP_WIDTH + tx);
                        }
                    }
                }
            }
        }

        ctx.fillStyle = RENDER_CONFIG.bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // --- Build entity/effect lookup maps (flat key = y*MAP_WIDTH + x) ---
        // These let the tile loop do O(1) lookups instead of scanning arrays per tile.
        // Moving entities (mid-lerp) are collected separately for fractional-position rendering.
        const entityMap = this._entityMap;
        entityMap.clear();
        const movingEntities = this._movingEntities;
        movingEntities.length = 0;
        for (const e of entities) {
            if (e.hp <= 0) continue;
            if (isEntityMoving(e)) {
                movingEntities.push({ entity: e, char: e.char, color: e.color, type: e.type });
            } else {
                entityMap.set(e.y * CONFIG.MAP_WIDTH + e.x, { char: e.char, color: e.color, type: e.type, _dmgFlashUntil: e._dmgFlashUntil });
            }
        }
        if (game.waves) {
            for (const e of game.waves.enemies) {
                if (e.hp <= 0) continue;
                if (isEntityMoving(e)) {
                    movingEntities.push({ entity: e, char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type });
                } else {
                    entityMap.set(e.y * CONFIG.MAP_WIDTH + e.x, { char: e.char, color: e.color, type: 'wave_enemy', entityType: e.type, _dmgFlashUntil: e._dmgFlashUntil });
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
                entityMap.set(r.y * CONFIG.MAP_WIDTH + r.x, { char: rChar, color: rColor, type: 'raider', entityType: r.type, _dmgFlashUntil: r._dmgFlashUntil });
            }
        }
        const rallySet = this._rallySet;
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
                const entData = { char: c.golem ? 'G' : '@', color, type: c.golem ? 'golem' : 'colonist', colonistId: c.id, bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant, nameColor: c.nameColor, drafted, golemType: c.golemType, sleeping: isSleeping, sleepingInBed, _dmgFlashUntil: c._dmgFlashUntil, _atkShakeUntil: c._atkShakeUntil, armorKey: showEq ? (c.armor?.key || null) : null, helmetKey: showEq ? (c.helmet?.key || null) : null, weaponKey: showEq ? (c.weapon?.key || null) : null, toolKey: showEq ? (c.tool?.key || null) : null };
                if (isEntityMoving(c)) {
                    movingEntities.push({ entity: c, ...entData });
                } else {
                    entityMap.set(c.y * CONFIG.MAP_WIDTH + c.x, entData);
                }
                if (drafted && c.draftTarget) {
                    rallySet.set(c.draftTarget.y * CONFIG.MAP_WIDTH + c.draftTarget.x, true);
                }
            }
        }
        for (const [key] of rallySet) {
            if (!entityMap.has(key)) {
                entityMap.set(key, { char: '⚑', color: '#ff4444', type: 'rally' });
            }
        }

        const portalMap = this._portalMap;
        const portalPathMap = this._portalPathMap;
        portalMap.clear();
        portalPathMap.clear();
        if (game.waves && game.waves.active && game.waves.portals.length > 0) {
            for (const p of game.waves.portals) {
                portalMap.set(p.y * CONFIG.MAP_WIDTH + p.x, true);
            }
            const pathPoints = game.waves.getPathPreview(game);
            for (const pt of pathPoints) {
                const key = pt.y * CONFIG.MAP_WIDTH + pt.x;
                if (!portalMap.has(key)) portalPathMap.set(key, true);
            }
        }

        const effectMap = this._effectMap;
        effectMap.clear();
        if (game.combatEffects && game.settings.showOverlays && game.settings.showCombatParticles) {
            for (const e of game.combatEffects) {
                effectMap.set(e.y * CONFIG.MAP_WIDTH + e.x, e);
            }
        }

        // --- Tile rendering loop ---
        // Iterates over the visible viewport, drawing each tile as either a sprite
        // (skin active) or an ASCII character. Layering order for sprites:
        //   ground → structure/entity → dither → artifact overlay → designation tint
        // Effects (combat hits, shots, portals) draw as overlays on top of the base.
        let lastColor = '';
        for (let sy = 0; sy < CONFIG.VIEWPORT_HEIGHT; sy++) {
            for (let sx = 0; sx < CONFIG.VIEWPORT_WIDTH; sx++) {
                const wx = camera.x + sx;
                const wy = camera.y + sy;
                const px = sx * cw;
                const py = sy * ch;

                if (wx < 0 || wx >= CONFIG.MAP_WIDTH || wy < 0 || wy >= CONFIG.MAP_HEIGHT) {
                    continue;
                }

                const tile = map[wy][wx];
                let char = getTileChar(tile, game.weather.season);
                let color = getTileColor(tile, game.weather.season);
                let bg = getTileBg(tile);

                if (tile.designation) {
                    color = TILE_COLORS[`designation_${tile.designation.type}`] || '#ffff00';
                }

                if (tile.structure === 'rift_gate' && game.exploration && game.exploration.expeditions.length > 0) {
                    color = game.tick % RENDER_CONFIG.riftPulsePeriod < RENDER_CONFIG.riftPulseDuty ? '#33ccff' : '#1a6688';
                }

                const tileKey = wy * CONFIG.MAP_WIDTH + wx;

                if (portalMap.has(tileKey)) {
                    char = COMBAT_VISUALS.portalChar;
                    color = COMBAT_VISUALS.portalColor;
                    bg = COMBAT_VISUALS.portalBg;
                } else if (game.settings.showPortalPath && portalPathMap.has(tileKey)) {
                    color = COMBAT_VISUALS.portalPathColor;
                    bg = COMBAT_VISUALS.portalPathBg;
                }

                const entity = entityMap.get(tileKey);
                if (entity) {
                    char = entity.char;
                    color = (game.settings.showOverlays && game.settings.showDamageFlash && entity._dmgFlashUntil > game.tick) ? COMBAT_VISUALS.dmgFlashColor : entity.color;
                } else if (tile.structure && game.settings.showOverlays && game.settings.showDamageFlash && tile._dmgFlashUntil > game.tick) {
                    color = COMBAT_VISUALS.dmgFlashColor;
                }

                const effect = effectMap.get(tileKey);
                if (effect) {
                    char = effect.char;
                    color = effect.color;
                }

                if (spellRangeSet && spellRangeSet.has(tileKey)) {
                    bg = COMBAT_VISUALS.spellRangePreviewBg;
                }

                const inSelection = selectionRect &&
                    wx >= selectionRect.x1 && wx <= selectionRect.x2 &&
                    wy >= selectionRect.y1 && wy <= selectionRect.y2;

                if (inSelection && buildDragPreview) {
                    const tKey = wy * CONFIG.MAP_WIDTH + wx;
                    if (buildDragPreview.blocked && buildDragPreview.blocked.has(tKey)) {
                        bg = '#3a1a1a';
                    } else if (buildDragPreview.affordable.has(tKey)) {
                        bg = '#1a3a1a';
                    } else if (buildDragPreview.unaffordable.has(tKey)) {
                        bg = '#3a1a1a';
                    } else {
                        bg = RENDER_CONFIG.selectionBgBuild;
                    }
                } else if (inSelection) {
                    bg = game.input.mode === 'zone' ? RENDER_CONFIG.selectionBgZone : RENDER_CONFIG.selectionBgBuild;
                } else if (cursor && cursor.x === wx && cursor.y === wy) {
                    bg = RENDER_CONFIG.cursorBg;
                }

                if (bg) {
                    ctx.fillStyle = bg;
                    ctx.fillRect(px, py, cw, ch);
                    lastColor = '';
                }

                // Sprite rendering: overlays (effects, shots, portals) take priority over
                // the base sprite. "Furniture" structures need ground drawn beneath them
                // because their sprite doesn't fill the full tile.
                let spriteDrawn = false;
                if (this.skinManager.isActive) {
                    let overlaySprite = null;
                    if (effect) {
                        overlaySprite = this._resolveEffectSprite(effect);
                    } else if (portalMap.has(tileKey)) {
                        overlaySprite = this._resolveEffectSprite('portal');
                    }
                    if (overlaySprite) {
                        const ground = this._resolveGroundSprite(tile, game.weather.season);
                        if (ground) ctx.drawImage(ground, px, py, cw, ch);
                        if (tile.structure) {
                            const structSprite = this.skinManager.getSprite('buildings', tile.structure);
                            if (structSprite) ctx.drawImage(structSprite, px, py, cw, ch);
                        }
                        if (entity) {
                            const hl = !!(entity.type === 'colonist' && game.settings.showColonistHighlight);
                            const entitySprite = this._resolveSprite(tile, entity, game.weather.season, hl);
                            if (entitySprite) {
                                const shakeActive = game.settings.showOverlays && game.settings.enableScreenShake && entity._atkShakeUntil > game.tick;
                                const sPx = COMBAT_VISUALS.atkShakePx || 2;
                                const shakeX = shakeActive ? ((game.tick * 7) % (sPx * 2 + 1)) - sPx : 0;
                                const shakeY = shakeActive ? ((game.tick * 13) % (sPx + 1)) - Math.floor(sPx / 2) : 0;
                                const hlOff = hl ? 1 : 0;
                                ctx.drawImage(entitySprite, px + shakeX - hlOff, py + shakeY - hlOff, cw + hlOff * 2, ch + hlOff * 2);
                                if (game.settings.showOverlays && game.settings.showDamageFlash && entity._dmgFlashUntil > game.tick) {
                                    const flashSprite = this.skinManager.getSprite('effects', 'damage_flash');
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
                            }
                        } else {
                            const baseSprite = this._resolveSprite(tile, null, game.weather.season);
                            if (baseSprite) ctx.drawImage(baseSprite, px, py, cw, ch);
                        }
                        ctx.drawImage(overlaySprite, px, py, cw, ch);
                        spriteDrawn = true;
                    } else {
                        const hl = !!(entity && entity.type === 'colonist' && game.settings.showColonistHighlight);
                        const sprite = this._resolveSprite(tile, entity, game.weather.season, hl);
                        if (sprite) {
                            const needsGround = tile.structure && BUILDINGS[tile.structure] &&
                                BUILDINGS[tile.structure].structureType === 'furniture';
                            if (needsGround || entity) {
                                const ground = this._resolveGroundSprite(tile, game.weather.season);
                                if (ground) ctx.drawImage(ground, px, py, cw, ch);
                            }
                            const canDither = !tile.structure && !tile.resource && !tile.zone && !tile.floor;
                            if (entity) {
                                if (canDither) this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game);
                                if (tile.structure) {
                                    const structSprite = this.skinManager.getSprite('buildings', tile.structure);
                                    if (structSprite) ctx.drawImage(structSprite, px, py, cw, ch);
                                }
                            }
                            const shakeActive = game.settings.showOverlays && game.settings.enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                            const shakePx = COMBAT_VISUALS.atkShakePx || 2;
                            const shakeX = shakeActive ? ((game.tick * 7) % (shakePx * 2 + 1)) - shakePx : 0;
                            const shakeY = shakeActive ? ((game.tick * 13) % (shakePx + 1)) - Math.floor(shakePx / 2) : 0;
                            const hlOff = hl ? 1 : 0;
                            ctx.drawImage(sprite, px + shakeX - hlOff, py + shakeY - hlOff, cw + hlOff * 2, ch + hlOff * 2);
                            if (!entity && canDither) {
                                this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game);
                            }
                            if (game.settings.showOverlays && game.settings.showDamageFlash && entity && entity._dmgFlashUntil > game.tick) {
                                const flashSprite = this.skinManager.getSprite('effects', 'damage_flash');
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
                            if (entity && shakeActive) {
                                const swingSprite = this.skinManager.getSprite('effects', 'attack_swing');
                                if (swingSprite) ctx.drawImage(swingSprite, px, py, cw, ch);
                            }
                            if (game.settings.showOverlays && game.settings.showDamageFlash && !entity && tile.structure && tile._dmgFlashUntil > game.tick) {
                                const flashSprite = this.skinManager.getSprite('effects', 'damage_flash');
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
                            if (tile.pedestalArtifact) {
                                const itemSprite = this.skinManager.getSprite('items', tile.pedestalArtifact);
                                if (itemSprite) {
                                    const iSize = Math.floor(cw * 0.6);
                                    const iOff = Math.floor((cw - iSize) / 2);
                                    ctx.drawImage(itemSprite, px + iOff, py + iOff, iSize, iSize);
                                }
                            }
                            if (effect) {
                                ctx.fillStyle = effect.color;
                                ctx.fillText(effect.char, px + this._textOffsetX, py);
                                lastColor = '';
                            }
                            spriteDrawn = true;
                        }
                        if (tile.designation) {
                            if (tile.designation.type === 'build' && tile.designation.buildType) {
                                const ghostSprite = this.skinManager.getSprite('buildings', tile.designation.buildType)
                                    || this.skinManager.getSprite('floors', tile.designation.buildType);
                                if (ghostSprite) {
                                    if (!spriteDrawn) {
                                        const ground = this._resolveGroundSprite(tile, game.weather.season);
                                        if (ground) {
                                            ctx.drawImage(ground, px, py, cw, ch);
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
                }

                if (!spriteDrawn) {
                    const asciiShake = game.settings.showOverlays && game.settings.enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                    const asciiShakePx = COMBAT_VISUALS.atkShakePx || 2;
                    const asx = asciiShake ? ((game.tick * 7) % (asciiShakePx * 2 + 1)) - asciiShakePx : 0;
                    const asy = asciiShake ? ((game.tick * 13) % (asciiShakePx + 1)) - Math.floor(asciiShakePx / 2) : 0;
                    if (char === '█' || char === '▓' || char === '▒') {
                        if (color !== lastColor) {
                            ctx.fillStyle = color;
                            lastColor = color;
                        }
                        ctx.fillRect(px + asx, py + asy, cw, ch);
                    } else {
                        if (this.skinManager.isActive) {
                            const ground = this._resolveGroundSprite(tile, game.weather.season);
                            if (ground) ctx.drawImage(ground, px, py, cw, ch);
                        }
                        if (color !== lastColor) {
                            ctx.fillStyle = color;
                            lastColor = color;
                        }
                        ctx.fillText(char, px + this._textOffsetX + asx, py + asy);
                    }
                }

                if (spriteDrawn && game.settings.showPortalPath && portalPathMap.has(tileKey)) {
                    ctx.fillStyle = COMBAT_VISUALS.portalPathColor;
                    ctx.globalAlpha = 0.35;
                    ctx.fillRect(px, py, cw, ch);
                    ctx.globalAlpha = 1.0;
                    lastColor = '';
                }

                if (spriteDrawn && (inSelection || (cursor && cursor.x === wx && cursor.y === wy))) {
                    ctx.globalAlpha = 0.35;
                    if (inSelection && buildDragPreview) {
                        const tKey = wy * CONFIG.MAP_WIDTH + wx;
                        if (buildDragPreview.blocked && buildDragPreview.blocked.has(tKey)) {
                            ctx.fillStyle = '#cc2222';
                        } else if (buildDragPreview.affordable.has(tKey)) {
                            ctx.fillStyle = '#22cc22';
                        } else if (buildDragPreview.unaffordable.has(tKey)) {
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
        const now = performance.now();
        for (const me of movingEntities) {
            const pos = getEntityRenderPos(me.entity, now);
            const sx = pos.x - camera.x;
            const sy = pos.y - camera.y;
            if (sx < -1 || sx >= CONFIG.VIEWPORT_WIDTH + 1 || sy < -1 || sy >= CONFIG.VIEWPORT_HEIGHT + 1) continue;
            const ent = me.entity;
            const shakeActive = game.settings.showOverlays && game.settings.enableScreenShake && ent._atkShakeUntil > game.tick;
            const sPxE = COMBAT_VISUALS.atkShakePx || 2;
            const shakeX = shakeActive ? ((game.tick * 7) % (sPxE * 2 + 1)) - sPxE : 0;
            const shakeY = shakeActive ? ((game.tick * 13) % (sPxE + 1)) - Math.floor(sPxE / 2) : 0;
            const rpx = Math.round(sx * cw) + shakeX;
            const rpy = Math.round(sy * ch) + shakeY;
            if (this.skinManager.isActive) {
                const destTile = map[ent.y]?.[ent.x];
                const meHl = !!(me.type === 'colonist' && game.settings.showColonistHighlight);
                const sprite = this._resolveSprite(destTile || {}, me, game.weather.season, meHl);
                if (sprite) {
                    const meHlOff = meHl ? 1 : 0;
                    ctx.drawImage(sprite, rpx - meHlOff, rpy - meHlOff, cw + meHlOff * 2, ch + meHlOff * 2);
                } else {
                    ctx.fillStyle = me.color;
                    ctx.fillText(me.char, rpx + this._textOffsetX, rpy);
                }
                if (game.settings.showOverlays && game.settings.showDamageFlash && ent._dmgFlashUntil > game.tick) {
                    const flashSprite = this.skinManager.getSprite('effects', 'damage_flash');
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
                    const swingSprite = this.skinManager.getSprite('effects', 'attack_swing');
                    if (swingSprite) ctx.drawImage(swingSprite, rpx - shakeX, rpy - shakeY, cw, ch);
                }
            } else {
                ctx.fillStyle = (game.settings.showOverlays && game.settings.showDamageFlash && ent._dmgFlashUntil > game.tick) ? COMBAT_VISUALS.dmgFlashColor : me.color;
                ctx.fillText(me.char, rpx + this._textOffsetX, rpy);
            }
        }

        // --- Draw projectiles at interpolated positions ---
        if (game.projectiles && game.settings.showOverlays && game.settings.showProjectiles) {
            for (const p of game.projectiles) {
                const t = Math.min(1, (now - p._startTime) / p._duration);
                const px2 = p.fromX + (p.toX - p.fromX) * t;
                const py2 = p.fromY + (p.toY - p.fromY) * t;
                const screenX = (px2 - camera.x) * cw;
                const screenY = (py2 - camera.y) * ch;
                if (screenX < -cw || screenX > this.canvas.width || screenY < -ch || screenY > this.canvas.height) continue;
                if (this.skinManager.isActive) {
                    const sprite = p.skinKey ? this.skinManager.getSprite('effects', p.skinKey) : null;
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
                if (sx < 0 || sx >= CONFIG.VIEWPORT_WIDTH || sy < 0 || sy >= CONFIG.VIEWPORT_HEIGHT) continue;
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
        const darkness = game.settings.showNightLighting ? this.getNightDarkness(game.timeOfDay, game.weather.season) : 0;
        if (darkness > 0) {
            const lightSources = this._getLightSources(game, camera);
            const steps = RENDER_CONFIG.nightGradientSteps;
            const [nr, ng, nb] = RENDER_CONFIG.nightOverlayColor;
            // Pre-build the style strings for each quantized darkness level
            const darkStyles = [];
            for (let i = 1; i <= steps; i++) {
                darkStyles.push(`rgba(${nr},${ng},${nb},${(darkness * i / steps).toFixed(3)})`);
            }

            const vw = CONFIG.VIEWPORT_WIDTH;
            const vh = CONFIG.VIEWPORT_HEIGHT;

            // Light grid: each cell holds the max illumination (0..1) from any source.
            // Sources stamp their radius using Manhattan distance (matches the game's
            // tile-based movement so light feels consistent with gameplay distances).
            if (!this._lightGrid || this._lightGrid.length < vw * vh) {
                this._lightGrid = new Float32Array(vw * vh);
            }
            const lightGrid = this._lightGrid;
            lightGrid.fill(0);

            for (const src of lightSources) {
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
                        // Linear falloff: 1.0 at source, 0.0 at radius edge.
                        // The "+1" avoids falloff=0 exactly at dist==r (would leave a
                        // hard dark ring at the light boundary).
                        const falloff = 1 - (dist / (r + 1));
                        const idx = rowOff + sx;
                        if (falloff > lightGrid[idx]) lightGrid[idx] = falloff;
                    }
                }
            }

            // Draw the darkness overlay — skip fully-lit tiles (shade < 1)
            let lastDarkStyle = '';
            for (let sy = 0; sy < vh; sy++) {
                const rowOff = sy * vw;
                for (let sx = 0; sx < vw; sx++) {
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
        const margin = RENDER_CONFIG.lightSourceMargin;
        const x0 = camera.x - margin;
        const y0 = camera.y - margin;
        const x1 = camera.x + CONFIG.VIEWPORT_WIDTH + margin;
        const y1 = camera.y + CONFIG.VIEWPORT_HEIGHT + margin;

        const allStructures = game.mapIndex ? game.mapIndex.getAllStructurePositions() : [];
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
                sources.push({ x: c.x, y: c.y, radius });
            }
        }

        const firePositions = game.mapIndex ? game.mapIndex.getFirePositions() : null;
        if (firePositions) {
            for (const { x, y } of firePositions) {
                if (x < x0 || x > x1 || y < y0 || y > y1) continue;
                sources.push({ x, y, radius: RENDER_CONFIG.fireLightRadius });
            }
        }

        return sources;
    }
}

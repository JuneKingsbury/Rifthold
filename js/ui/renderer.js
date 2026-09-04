import { CONFIG, TILE_COLORS, BUILDINGS, ALL_ITEMS, RENDER_CONFIG, COMBAT_VISUALS, COMPLEX_STRUCTURES } from '../core/config.js';
import { getTileVisuals } from '../world/map.js';
import { OverlayRenderer, spawnParticle } from './overlay-renderer.js';
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
        // Deferred melee attack effects (swing/stab). Because these are nudged toward
        // the target, they can extend into an adjacent tile that is painted later in
        // the tile loop. Collecting them here and drawing after all tiles/entities
        // keeps the effect on top of the target tile instead of being cut in half.
        this._attackFx = [];
        this._structureMap = new Map();

        // Terrain dithering
        this._ditherMasks = null;
        this._ditherTileSize = 0;
        this._ditherCache = new Map();

        // Per-tile amplitude boost for disturbed grass (entity footstep wake)
        this._grassBoost = new Map();
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
        this.charHeight = physHeight / dpr;                   // CSS pixels (possibly fractional)
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

    // Draws the animated grass-tuft overlay (sways side-to-side in the wind about
    // its base) for one tile. Shared by bare-grass tiles and tree tiles (where the
    // tree sprite is later drawn on top). No-ops gracefully when the art is absent.
    // Returns true if a tuft was drawn.
    _drawGrassTuft(ctx, now, tileKey, wind, px, py, cw, ch) {
        const tuft = this.skinManager.getSprite('effects', 'grass_tuft');
        if (!tuft) return false;
        const boostEntry = this._grassBoost.get(tileKey);
        let boostAdd = 0;
        if (boostEntry) {
            const t = Math.min((now - boostEntry.startTime) / boostEntry.duration, 1);
            boostAdd = Math.sin(t * Math.PI) * boostEntry.amp;
        }
        const rot = getGrassSway(now, tileKey, wind, boostAdd);
        if (rot !== 0) {
            // Sway about the tuft base (bottom-center).
            const pivotX = px + cw / 2;
            const pivotY = py + ch;
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rot);
            ctx.translate(-pivotX, -pivotY);
            ctx.drawImage(tuft, px, py, cw, ch);
            ctx.restore();
        } else {
            ctx.drawImage(tuft, px, py, cw, ch);
        }
        return true;
    }

    // Draws animated crop sway on a farm zone tile.
    _drawCropSway(ctx, now, tileKey, wind, px, py, cw, ch, sprite) {
        const rot = getCropSway(now, tileKey, wind);
        if (rot !== 0) {
            const pivotX = px + cw / 2;
            const pivotY = py + ch;
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rot);
            ctx.translate(-pivotX, -pivotY);
            ctx.drawImage(sprite, px, py, cw, ch);
            ctx.restore();
        } else {
            ctx.drawImage(sprite, px, py, cw, ch);
        }
    }

    // Draw all active water ripples (rain impacts + footsteps).
    _drawWaterRipples(ctx, camera, cw, ch) {
        if (this._waterRipples.length === 0) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let i = this._waterRipples.length - 1; i >= 0; i--) {
            const r = this._waterRipples[i];
            r.r += r.speed;
            r.alpha -= r.decay;
            if (r.alpha <= 0 || r.r > r.maxR) {
                this._waterRipples[i] = this._waterRipples[this._waterRipples.length - 1];
                this._waterRipples.length--;
                continue;
            }
            const sx = (r.x - camera.x + 0.5) * cw;
            const sy = (r.y - camera.y + 0.5) * ch;
            ctx.globalAlpha = r.alpha;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r.r, r.r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _spawnWaterRipple(wx, wy, cw, maxRMult) {
        this._waterRipples.push({
            x: wx + (Math.random() - 0.5) * 0.6,
            y: wy + (Math.random() - 0.5) * 0.3,
            r: 1,
            maxR: cw * (maxRMult || 0.8),
            speed: cw * 0.025,
            alpha: 0.6,
            decay: 0.025,
        });
    }

    // Draws the animated water-wave overlay (slow vertical bob + alpha shimmer) for
    // one water tile. Shared by bare-water tiles and water tiles that hold a swimming
    // entity (drawn behind the entity in that case). No-ops gracefully when the art
    // is absent. Returns true if the waves were drawn.
    _drawWaterWaves(ctx, now, tileKey, px, py, cw, ch) {
        const waves = this.skinManager.getSprite('effects', 'water_waves');
        if (!waves) return false;
        const w = getWaterWave(now, tileKey);
        ctx.globalAlpha = w.alpha < 0 ? 0 : (w.alpha > 1 ? 1 : w.alpha);
        ctx.drawImage(waves, px, py + w.offsetY, cw, ch);
        ctx.globalAlpha = 1.0;
        return true;
    }

    // Draws a sprite swaying about its base (bottom-center), like a tree in wind.
    // `rot` is the sway rotation in radians. When 0 the sprite is drawn flat.
    _drawSwayed(ctx, sprite, rot, dx, dy, dw, dh, pivotX, pivotY) {
        if (rot !== 0) {
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(rot);
            ctx.translate(-pivotX, -pivotY);
            ctx.drawImage(sprite, dx, dy, dw, dh);
            ctx.restore();
        } else {
            ctx.drawImage(sprite, dx, dy, dw, dh);
        }
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
        if (e.char === COMBAT_VISUALS.fireIgniteChar && e.color === COMBAT_VISUALS.fireIgniteColor) return this.skinManager.getSprite('effects', 'fire_ignite');
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
        const showBreathing = settings.showBreathing;
        const showWalkSway = settings.showWalkSway;
        const showActionAnimations = settings.showActionAnimations;
        // Reused per-frame flag bundle for the action-animation composer, so it
        // never touches game.settings in the hot loop. Mutated (not realloc'd).
        const animFlags = this._animFlags || (this._animFlags = {});
        animFlags.showBreathing = showBreathing;
        animFlags.showWalkSway = showWalkSway;
        animFlags.showActionAnimations = showActionAnimations;
        // Tree sway: wind strength (0..1) from the active weather, resolved once
        // per frame. `showTreeSway` gates the whole effect.
        const showTreeSway = settings.showTreeSway && RENDER_CONFIG.treeSway && RENDER_CONFIG.treeSway.enabled;
        const showTerrainDetail = settings.showTerrainDetail && RENDER_CONFIG.terrainDetail && RENDER_CONFIG.terrainDetail.enabled;
        // treeWind and detailWind are set below after dt is available
        let treeWind = 0;
        let detailWind = 0;
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

        // Compute delta time for per-frame decay effects (grass boost, door flash)
        const nowMs = now;
        const dt = this._lastFrameTime ? Math.min((nowMs - this._lastFrameTime) / 1000, 0.1) : 0.016;
        this._lastFrameTime = nowMs;

        // Notify sway phase continuity when wind changes so grass/crops don't jump
        const rawWind = windStrengthFor(weather.currentWeather);
        setSwayWind(rawWind, now, dt);
        treeWind = showTreeSway ? rawWind : 0;
        detailWind = showTerrainDetail ? rawWind : 0;

        // Expire grass boost entries past their duration
        for (const [key, entry] of this._grassBoost) {
            if (now - entry.startTime >= entry.duration) this._grassBoost.delete(key);
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
                    this._workingBuildingSet.add(`${task.x},${task.y}`);
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
        // Regenerate masks here, once, if inputs changed. Moved out of the per-tile call:
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
                    const entData = { char: c.golem ? 'G' : '@', color, type: c.golem ? 'golem' : 'colonist', colonistId: c.id, entityId: c.id, race: c.race, bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant, nameColor: c.nameColor, drafted, golemType: c.golemType, sleeping: isSleeping, sleepingInBed, freezing: isFreezing, _dmgFlashUntil: c._dmgFlashUntil, _atkShakeUntil: c._atkShakeUntil, _sim: c, armorKey: showEq ? (c.armor?.key || null) : null, helmetKey: showEq ? (c.helmet?.key || null) : null, clothesKey: showEq ? ((!c.armor && c.clothes) ? c.clothes.key : null) : null, weaponKey: showEq ? (c.weapon?.key || null) : null, toolKey: showEq ? (c.tool?.key || null) : null };
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
        //   ground → structure/entity → dither → pedestal item overlay → designation tint
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
                        if (material) {
                            // A tree on a tile that also holds an entity sways behind the
                            // entity, just as a bare tree tile sways (drawn later below).
                            const matRot = (showTreeSway && tile.resource && tile.resource.type === 'tree')
                                ? getTreeSway(now, tileKey, treeWind) : 0;
                            this._drawSwayed(ctx, material, matRot, px, py, cw, ch, px + cw / 2, py + ch);
                        }
                    } else if (tile.resource) {
                        // Resources (trees, stone, ore) are not full-tile sprites, so
                        // without a ground pass they'd sit on the bare background. Draw
                        // the terrain beneath. The resource sprite itself is drawn by the
                        // main sprite path below (so it can carry the tree-sway transform).
                        const ground = this._resolveGroundSprite(tile, season);
                        if (ground) ctx.drawImage(ground, px, py, cw + 1, ch + 1);
                        // Grass tufts also sprout under trees on grass terrain: draw the
                        // swaying tuft here so the tree sprite (drawn below) covers it.
                        if (showTerrainDetail && tile.resource.type === 'tree'
                            && tile.terrain === 'grass' && !tile.snowCovered && !tile.onFire) {
                            this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw, ch);
                        }
                    }
                    const canDither = !tile.structure && !tile.resource && !tile.zone && !tile.floor;
                    if (entity) {
                        if (canDither) this._drawTerrainDither(ctx, tile, wx, wy, px, py, cw, ch, map, game, ditherOn, ditherDepthFrac, ditherQualSetting, ditherBlockSize);
                        // Terrain detail behind an entity so it stands on the same
                        // animated ground as a bare tile: grass tufts on grass, water
                        // waves on water. Water also keeps its `in_water` overlay on top
                        // (drawn after the sprite), giving a swimmer both effects.
                        if (showTerrainDetail && !tile.structure && !tile.resource
                            && !tile.zone && !tile.floor && !tile.onFire) {
                            if (tile.terrain === 'grass' && !tile.snowCovered) {
                                this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw, ch);
                            } else if (tile.terrain === 'water') {
                                this._drawWaterWaves(ctx, now, tileKey, px, py, cw, ch);
                            }
                        }
                        if (tile.structure) {
                            const structSprite = sm.getSprite('buildings', tile.structure);
                            if (structSprite) ctx.drawImage(structSprite, px, py, cw, ch);
                        }
                    }

                    // Determine if we have an entity sprite to draw on this tile.
                    const hl = !!(entity && entity.type === 'colonist' && game.settings.showColonistHighlight);
                    const sprite = this._resolveSprite(tile, entity, season, hl);
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
                        if (shadowSprite) ctx.drawImage(shadowSprite, px, py - shadowLift, cw, ch);
                        // Determine any shake effects that need to be applied to the entity sprite before we draw it.
                        const shakeActive = showOverlays && enableScreenShake && entity && entity._atkShakeUntil > game.tick;
                        const shakePx = atkShakePx;
                        const shakeX = shakeActive ? ((game.tick * 7) % (shakePx * 2 + 1)) - shakePx : 0;
                        const shakeY = shakeActive ? ((game.tick * 13) % (shakePx + 1)) - Math.floor(shakePx / 2) : 0;
                        const hlOff = hl ? 1 : 0;
                        const bleed = entity ? 0 : 1;
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
                        const treeRot = flameRot || (!entity && showTreeSway
                            && tile.resource && tile.resource.type === 'tree')
                            ? flameRot || getTreeSway(now, tileKey, treeWind) : 0;
                        // Breathing: stretch height, anchor feet by nudging y up by the same amount.
                        const grow = xf ? xf.growPx : 0;
                        const dx = px + shakeX - hlOff;
                        const dy = py + shakeY - hlOff - grow;
                        const dw = cw + hlOff * 2 + bleed;
                        const dh = ch + hlOff * 2 + bleed + grow;
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
                            const pivotX = px + cw / 2;
                            const pivotY = py + ch;
                            ctx.save();
                            ctx.translate(pivotX + xf.offsetX, pivotY + xf.offsetY);
                            if (xf.rotation !== 0) ctx.rotate(xf.rotation);
                            if (xf.scaleX !== 1 || xf.scaleY !== 1) ctx.scale(xf.scaleX, xf.scaleY);
                            ctx.translate(-pivotX, -pivotY);
                            ctx.drawImage(sprite, dx, dy, dw, dh);
                            ctx.restore();
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
                            if (waterSprite) ctx.drawImage(waterSprite, px, py, cw, ch);
                        }
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
                        // Freeze tint: persistent cyan overlay while colonist has the freezing thought
                        if (showOverlays && entity && entity.freezing) {
                            ctx.globalAlpha = 0.35;
                            ctx.fillStyle = '#88ddff';
                            ctx.fillRect(px, py, cw, ch);
                            ctx.globalAlpha = 1.0;
                            lastColor = '';
                        }
                        // If we are actively shaking after an attack begins, draw the
                        // per-weapon attack effect (aimed at the target, DrawAndShoot none).
                        if (entity && shakeActive) {
                            this._queueAttackEffect(entity._sim || entity, now, px, py, cw, ch);
                        }

                        // Mining/chopping debris particles
                        if (entity && entity._sim && entity._sim.state === 'working') {
                            if (Math.random() < 0.25) {
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
                                        if (Math.random() < 0.08) {
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
                            if (Math.random() < 0.10) {
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
                                ctx.drawImage(overlaySprite, px, py, cw, ch);
                                ctx.globalAlpha = 1.0;
                            }
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

                    // Animated terrain detail overlays on bare terrain (no entity,
                    // structure, resource, zone, or floor). Grass tufts sway in the
                    // wind. Water waves bob up and down. Both use new `effects`
                    // sprites and skip gracefully when the art is absent.
                    if (showTerrainDetail && !entity && !tile.structure && !tile.resource
                        && !tile.zone && !tile.floor && !tile.onFire) {
                        if (tile.terrain === 'grass' && !tile.snowCovered) {
                            if (this._drawGrassTuft(ctx, now, tileKey, detailWind, px, py, cw, ch)) {
                                spriteDrawn = true;
                            }
                        } else if (tile.terrain === 'water') {
                            if (this._drawWaterWaves(ctx, now, tileKey, px, py, cw, ch)) {
                                spriteDrawn = true;
                                // Spawn rain ripples on water tiles during rain/thunderstorm
                                const rainChance = weather.currentWeather === 'thunderstorm' ? 0.04 : weather.currentWeather === 'rain' ? 0.02 : 0;
                                if (rainChance > 0 && Math.random() < rainChance) {
                                    this._spawnWaterRipple(wx, wy, cw, 0.8);
                                }
                            }
                        }
                    }

                    // Snow shimmer: random bright flecks on blizzard snow-covered tiles
                    if (!entity && tile.snowCovered && weather.currentWeather === 'blizzard' && Math.random() < 0.005) {
                        ctx.save();
                        ctx.fillStyle = 'rgba(255,255,255,0.85)';
                        ctx.beginPath();
                        ctx.arc(px + Math.random() * cw, py + Math.random() * ch, 1, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    // Crop sway: zone tiles with a planted crop sway in the wind (skip empty)
                    if (tile.zone && tile.zone.crop && tile.zone.state !== 'empty' && showTerrainDetail) {
                        const cropState = tile.zone.state || 'empty';
                        const cropSprite = this.skinManager.getSprite('farms', tile.zone.crop + '_' + cropState)
                            || this.skinManager.getSprite('farms', 'farm_' + cropState);
                        if (cropSprite && !entity) {
                            this._drawCropSway(ctx, now, tileKey, detailWind, px, py, cw, ch, cropSprite);
                        }
                    }

                    // Creeping miasma spore particles on blighted crop tiles
                    if (tile.zone && tile.zone.blighted && Math.random() < 0.06) {
                        spawnParticle(game, {
                            x: wx + 0.2 + Math.random() * 0.6,
                            y: wy + 0.2 + Math.random() * 0.4,
                            vx: (Math.random() - 0.5) * 0.08,
                            vy: -0.12 - Math.random() * 0.1,
                            decay: 0.03 + Math.random() * 0.02,
                            color: Math.random() < 0.5 ? '#7a5599' : '#88aa44',
                            size: 2 + Math.random() * 2,
                            alpha: 0.55,
                            shape: 'square',
                        });
                    }

                    // Smoke emission from active buildings
                    if (tile.structure && !entity) {
                        const bDef = BUILDINGS[tile.structure];
                        if (bDef && bDef.smokeEmitter && Math.random() < 0.05) {
                            const windDrift = (detailWind - 0.5) * 0.3;
                            spawnParticle(game, {
                                x: wx + 0.5 + (Math.random() - 0.5) * 0.3,
                                y: wy - 0.1,
                                vx: windDrift / cw * 40,
                                vy: -0.35 - Math.random() * 0.2,
                                decay: 0.05 + Math.random() * 0.03,
                                color: `rgba(${140 + Math.floor(Math.random()*40)},${140 + Math.floor(Math.random()*40)},${140 + Math.floor(Math.random()*40)},1)`,
                                size: 3 + Math.random() * 2,
                                alpha: 0.45,
                                shape: 'square',
                            });
                        }
                    }

                    // Candle wisp and campfire ember particles
                    if (tile.structure && !entity) {
                        const bDef = BUILDINGS[tile.structure];
                        if (bDef && bDef.candleEmitter && Math.random() < 0.03) {
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
                        if (tile.structure === 'campfire' && Math.random() < 0.1) {
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
                        && detailWind > 0.3 && Math.random() < 0.003) {
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

                    // Door flash: brief white overlay when an entity just entered a structure tile
                    if (tile.structure) {
                        const flashFrames = this._doorFlash.get(tileKey);
                        if (flashFrames > 0) {
                            ctx.globalAlpha = Math.min(0.4, flashFrames / 8 * 0.4);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(px, py, cw, ch);
                            ctx.globalAlpha = 1;
                        }

                        // Working building pulse glow
                        if (this._workingBuildingSet.has(`${wx},${wy}`)) {
                            const bDef = BUILDINGS[tile.structure];
                            const pulse = 0.6 + 0.4 * Math.sin(now * 0.004);
                            const glowColor = bDef?.workGlowColor || (tile.structure.includes('forge') || tile.structure.includes('smelter') ? '#ff8833' : tile.structure.includes('lab') || tile.structure.includes('library') ? '#4488ff' : tile.structure.includes('kitchen') || tile.structure.includes('cook') ? '#ffcc22' : '#88ff88');
                            const radius = cw * 0.9 * pulse;
                            ctx.save();
                            ctx.globalCompositeOperation = 'lighter';
                            ctx.globalAlpha = 0.18 * pulse;
                            const wcx = px + cw / 2;
                            const wcy = py + ch / 2;
                            const grd = ctx.createRadialGradient(wcx, wcy, 0, wcx, wcy, radius);
                            grd.addColorStop(0, glowColor);
                            grd.addColorStop(1, 'transparent');
                            ctx.fillStyle = grd;
                            ctx.beginPath();
                            ctx.arc(wcx, wcy, radius, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        }

                        // Construction shake: buildings being built wobble on hack-bob downstroke
                        if (tile.designation && tile.designation.type === 'build') {
                            const structSprite = this.skinManager.getSprite('buildings', tile.designation.buildType);
                            if (structSprite) {
                                const shakeAmt = 0.5;
                                const shakeX = Math.sin(now * 0.05) * shakeAmt;
                                const shakeY = Math.abs(Math.sin(now * 0.05)) * 0.3;
                                ctx.globalAlpha = 0.4;
                                ctx.drawImage(structSprite, px + shakeX, py + shakeY, cw, ch);
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

                // Pulsing selection outline on buildings under cursor
                if (spriteDrawn && cursor && cursor.x === wx && cursor.y === wy && tile.structure) {
                    const pulseAlpha = 0.5 + 0.5 * Math.sin(now * 0.006);
                    const pulseWidth = 1 + Math.sin(now * 0.006) * 0.5;
                    ctx.save();
                    ctx.strokeStyle = '#ffcc44';
                    ctx.lineWidth = pulseWidth;
                    ctx.globalAlpha = pulseAlpha;
                    ctx.strokeRect(px + 0.5, py + 0.5, cw - 1, ch - 1);
                    ctx.restore();
                    lastColor = '';
                }
            }
        }

        // Draw water ripples on top of all tiles (rain impacts + footsteps)
        this._drawWaterRipples(ctx, camera, cw, ch);

        // --- Tile-entry detection: detect when a lerping entity arrives at its destination ---
        // Used for footstep ripples, disturbed grass, and door flash.
        for (const me of movingEntities) {
            const ent = me.entity;
            const lastTile = ent._lastRenderedTile;
            // Water splash: fire at movement START (destination tile is ent.x/y once lerp begins)
            if (isEntityMoving(ent) && !ent._lastWasMoving) {
                const destTile = game.map[ent.y]?.[ent.x];
                if (destTile && destTile.terrain === 'water') {
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
                        if (destTile.terrain === 'grass' && !destTile.snowCovered) {
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
                        if (destTile.structure) {
                            this._doorFlash.set(destKey, 8);
                        }
                    }
                    ent._lastRenderedTile = { x: ent.x, y: ent.y };
                }
            } else {
                // Still moving. Update last rendered tile to current destination so we
                // only fire on the NEXT arrival (not retroactively on every frame)
                if (!lastTile) ent._lastRenderedTile = { x: ent.x, y: ent.y };
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
                    if (destTile.terrain === 'water') {
                        this._spawnWaterRipple(ent.x, ent.y, cw, 1.5);
                    } else if (destTile.terrain === 'grass' && !destTile.snowCovered) {
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
            const rpx = Math.round(sx * cw) + shakeX;
            const rpy = Math.round(sy * ch) + shakeY;
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
                        const pivotX = rpx + cw / 2;
                        const pivotY = rpy + ch;
                        ctx.save();
                        ctx.translate(pivotX + xf.offsetX, pivotY + xf.offsetY);
                        if (xf.rotation !== 0) ctx.rotate(xf.rotation);
                        if (xf.scaleX !== 1 || xf.scaleY !== 1) ctx.scale(xf.scaleX, xf.scaleY);
                        ctx.translate(-pivotX, -pivotY);
                        ctx.drawImage(sprite, rpx - meHlOff, rpy - meHlOff - grow, cw + meHlOff * 2, ch + meHlOff * 2 + grow);
                        ctx.restore();
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
                const rpx = Math.round(sx * cw);
                const rpy = Math.round(sy * ch);
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
                    const nameFont = `${nameFontSize}px monospace`;
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

            // Draw the darkness overlay via an offscreen buffer: write alpha values
            // into a small tile-resolution ImageData, put it onto a tiny offscreen
            // canvas, then drawImage it scaled up onto the main canvas. This replaces
            // thousands of fillRect calls with one drawImage composite.
            const nightW = vw + 1;
            const nightH = vh + 1;
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
                const rowOff = sy * vw;
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
            ctx.drawImage(this._nightCanvas, 0, 0, nightW, nightH, 0, 0, nightW * cw, nightH * ch);
            ctx.imageSmoothingEnabled = prevSmoothing;
        }

        this.overlayRenderer.render(game, cw, ch, game.camera);
    }

    renderFps(fps) {
        const ctx = this.ctx;
        ctx.save();
        const fpsFontSize = Math.round(12 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1));
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

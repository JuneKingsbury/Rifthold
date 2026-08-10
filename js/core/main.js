import { CONFIG, GAME_VERSION, RESEARCH, FOOD_DECAY_CONFIG, SPELL_TOMES, SPELLS, COMBAT_VISUALS, GOLEM_TYPES, ARTIFACTS, WEAPONS, ARMORS, HELMETS, TOOLS, SKILLS, EVENTS, TERRAIN, RENDER_CONFIG, RECIPES, SALVAGE_RATE, COLONIST_CONFIG, ALL_ITEMS, TRAITS, TRAIT_EXCLUSIONS, COLONIST_NAMES } from './config.js';
import { generateMap, getTileChar, getTileColor, getTileBg } from '../world/map.js';
import { generateStartMap } from '../ui/start-map.js';
import { Camera } from '../ui/camera.js';
import { Renderer } from '../ui/renderer.js';
import { InputHandler } from '../ui/input.js';
import { SkinManager } from '../ui/skin-manager.js';
import { createColonist, createGolem, updateColonist, addThought, grantCastXp } from '../entities/colonist.js';
import { TaskQueue } from './tasks.js';
import { ResourceManager } from '../systems/resources.js';
import { detectRooms, calculateRoomQualities } from '../world/rooms.js';
import { updateFarming } from '../systems/farming.js';
import { queueCraftingOrder, updateAutoCook, updateAutoCraft } from '../systems/crafting.js';
import { Weather } from '../world/weather.js';
import { updateWildlife, designateHunt } from '../entities/wildlife.js';
import { CombatSystem } from '../entities/combat.js';
import { EventSystem, updateFires, getTradeRates, computeTradeValues } from '../systems/events.js';
import { SocialSystem } from '../systems/social.js';
import { UI } from '../ui/ui.js';
import { Minimap } from '../ui/minimap.js';
import { ResearchSystem, updateResearch } from '../systems/research.js';
import { updateTamedAnimals, designateTame } from '../entities/taming.js';
import { updateSummons } from '../entities/summons.js';
import { syncEntityIdCounter, createWildAnimal } from '../entities/entity-factory.js';
import { PowerSystem } from '../systems/power.js';
import { ExplorationSystem } from '../systems/exploration.js';
import { WaveSystem } from '../entities/waves.js';
import { EventLog } from '../ui/eventlog.js';
import { saveGame, loadGame, hasSave, exportSave, importSave } from './save.js';
import { initResizeHandles } from '../ui/resize.js';
import { SpatialHash } from '../world/spatial.js';
import { MapIndex } from '../world/mapindex.js';
import { teleportEntity, getEntityRenderPos } from '../systems/movement-lerp.js';
import { manhattanDist } from '../world/pathfinding.js';
import { renderGlossaryHTML, initGlossaryInteraction } from '../ui/glossary.js';
import { renderChangelogHTML, initChangelogInteraction, renderCreditsHTML } from '../ui/changelog.js';
import { checkComplexStructures } from '../systems/complexBuildings.js';
import { updateAutoRepair } from '../systems/auto-repair.js';
import { StorySystem } from '../systems/story.js';
import { TutorialSystem } from '../systems/tutorial.js';
import { SoundManager } from './sound.js';
import { TickProfiler } from './perf-probe.js';

class Game {
    constructor() {
        this.tick = 74;
        this.paused = false;
        this.speed = 1;
        this.accumulator = 0;
        this.lastTime = 0;
        this.timeOfDay = 75;
        this.settings = {
            autoPauseHostile: true,
            autoPauseEvent: true,
            pauseOnDeath: false,
            pauseOnResearch: true,
            uiFontSize: 12,
            autoCookTarget: 0,
            showOverlays: true,
            showNightLighting: true,
            showWeatherParticles: true,
            showColonistNames: 'selected',
            showMinimap: true,
            showFps: false,
            autoSaveInterval: 24,
            activeSkin: localStorage.getItem('convocation_skin') || '16x16_tiny_world',
            demoMode: false,
            darkenOnPause: true,
            toolbarMode: 'auto',
            largeClickTargets: false,
            pauseOnFocusLoss: true,
            enableScreenShake: true,
            colorblindMode: 'none',
            notificationDuration: 100,
            showDamageFlash: true,
            showCombatParticles: true,
            showProjectiles: true,
            showEquipmentOverlays: true,
            showProgressBars: true,
            showPortalPath: true,
            craftTargets: {},
            layoutMode: 'auto',
            musicVolume: 70,
            sfxVolume: 80,
            temperatureUnit: 'F',
            ditherDistance: 'light',
            ditherQuality: 'medium',
            showColonistHighlight: false,
            showTutorial: true,
        };
        try {
            const saved = JSON.parse(localStorage.getItem('colony_settings'));
            if (saved) Object.assign(this.settings, saved);
        } catch (e) {}
        this._fpsFrames = 0;
        this._fpsLastTime = 0;
        this._fpsDisplay = 0;

        this.map = generateMap();
        this.camera = new Camera();
        this.taskQueue = new TaskQueue();
        this.resources = new ResourceManager();
        this.weather = new Weather();
        this.combat = new CombatSystem();
        this.events = new EventSystem();
        this.social = new SocialSystem();
        this.research = new ResearchSystem();
        this.power = new PowerSystem();
        this.waves = new WaveSystem();
        this.exploration = new ExplorationSystem();
        this.eventLog = new EventLog();
        this.story = new StorySystem();
        this.tutorial = new TutorialSystem();

        this.manaCrystalBonus = 0;
        this.discoveredLoot = new Set();
        this.stats = { raidsDefeated: 0, wavesCompleted: 0, expeditionsCompleted: 0, superiorItemsCrafted: 0, itemsEnchanted: 0 };

        this.colonists = [];
        this._colonistById = new Map();
        this.entities = [];
        this.raiders = [];
        this.combatEffects = [];
        this.projectiles = [];
        this.divinationModifiers = [];
        this.activeComplexStructures = [];
        this.overlays = [];
        this.notifications = [];
        this.cursor = null;
        this.selectedColonist = null;
        this.selectedColonists = [];
        this.followingColonist = null;
        this.roomsDirty = true;
        this.roomQualities = {};
        this.workshopQualities = {};
        this._recipeCacheVersion = 0;

        this.spatial = {
            hostiles: new SpatialHash(),
            colonists: new SpatialHash(),
        };
        this.mapIndex = new MapIndex();

        this.spawnStartingWildlife();

        this.skinManager = window._sharedSkinManager || new SkinManager();
        const gameContainer = document.getElementById('game');
        this.renderer = new Renderer(gameContainer, this.skinManager);
        this.ui = new UI(this);
        this.input = new InputHandler(this, this.renderer.canvas);
        this.minimap = new Minimap(document.getElementById('minimap'), this);
        this.ui.updateModeDisplay(this.input);

        window.game = this;
        window.RENDER_CONFIG = RENDER_CONFIG;
        this.gameLoop = this.gameLoop.bind(this);
    }

    // O(1) colonist lookup by id — always use this instead of colonists.find()
    getColonist(id) {
        return this._colonistById.get(id) || null;
    }

    addColonist(colonist) {
        this.colonists.push(colonist);
        this._colonistById.set(colonist.id, colonist);
        if (!colonist.golem && !colonist.assignedBed) this._autoAssignBedFor(colonist);
    }

    _autoAssignBedFor(colonist) {
        if (!this.mapIndex) return;
        const bedKeys = this.mapIndex.getStructurePositions('bed');
        if (bedKeys.size === 0) return;
        const occupied = new Set();
        for (const c of this.colonists) {
            if (c.hp > 0 && c.assignedBed) occupied.add(`${c.assignedBed.x},${c.assignedBed.y}`);
        }
        let bestDist = Infinity, bestBed = null;
        for (const k of bedKeys) {
            const bx = k & 0xFFFF, by = k >> 16;
            if (occupied.has(`${bx},${by}`)) continue;
            const d = manhattanDist(colonist.x, colonist.y, bx, by);
            if (d < bestDist) { bestDist = d; bestBed = { x: bx, y: by }; }
        }
        if (bestBed) colonist.assignedBed = bestBed;
    }

    rebuildColonistIndex() {
        this._colonistById.clear();
        for (const c of this.colonists) this._colonistById.set(c.id, c);
    }


    spawnStartingColonists(customDefs = null) {
        const cx = Math.floor(CONFIG.MAP_WIDTH / 2);
        const cy = Math.floor(CONFIG.MAP_HEIGHT / 2);
        const biases = ['building', 'farming', 'crafting'];
        for (let i = 0; i < 3; i++) {
            const existingNames = this.colonists.map(c => c.name);
            const custom = customDefs?.[i];
            const c = createColonist(cx + i - 1, cy, biases[i], existingNames);
            if (custom) {
                if (custom.name) c.name = custom.name;
                if (custom.skills) Object.assign(c.skills, custom.skills);
                if (custom.traits) c.traits = [...custom.traits];
                if (custom.bodyVariant != null) c.bodyVariant = custom.bodyVariant;
                if (custom.hairVariant != null) c.hairVariant = custom.hairVariant;
                if (custom.shirtVariant != null) c.shirtVariant = custom.shirtVariant;
                if (custom.nameColor) c.nameColor = custom.nameColor;
            }
            c.priorities[biases[i]] = 1;
            this.addColonist(c);
        }
    }

    spawnStartingWildlife() {
        const types = ['deer', 'deer', 'rabbit', 'rabbit', 'rabbit', 'chicken', 'chicken', 'cow', 'sheep'];
        for (const type of types) {
            const x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
            const y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
            const tile = this.map[y][x];
            if (tile.terrain === 'water' || tile.terrain === 'rock' || tile.terrain === 'tall_rock' || tile.resource) continue;
            this.entities.push(createWildAnimal(type, x, y));
        }
    }

    start() {
        if (this.colonists.length === 0) {
            this.spawnStartingColonists(this._pendingCustomColonists || null);
        }
        this.paused = true;
        document.getElementById('game').classList.add('paused');
        document.getElementById('pause-overlay').style.display = 'block';
        this.mapIndex.rebuild(this.map);
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop);
        requestAnimationFrame(() => resetMinimapSize());

        this.skinManager.init().then(() => {
            if (this.settings.activeSkin !== 'ascii') {
                this.skinManager.switchSkin(this.settings.activeSkin);
            }
            this.ui.populateSkinDropdown();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.settings.pauseOnFocusLoss && !this.paused) {
                this.togglePause();
            }
        });
        window.addEventListener('blur', () => {
            if (this.settings.pauseOnFocusLoss && !this.paused) {
                this.togglePause();
            }
        });

        this.tutorial.update(this);
        this.ui.updateTutorialNote(this);
    }

    async switchSkin(skinName) {
        await this.skinManager.switchSkin(skinName);
        this.settings.activeSkin = skinName;
        localStorage.setItem('convocation_skin', skinName);
        this.renderer._ditherCache.clear();
        if (this.ui) this.ui._buildingSpriteCache = null;
    }

    setLayoutMode(mode) {
        if (mode === 'mobile') mode = 'tabbed';
        else if (mode === 'desktop') mode = 'separate';
        this.settings.layoutMode = mode;
        const body = document.body;
        body.classList.remove('force-tabbed', 'force-separate');
        if (mode === 'tabbed') body.classList.add('force-tabbed');
        else if (mode === 'separate') body.classList.add('force-separate');

        const shouldTab = mode === 'tabbed' || (mode === 'auto' && window.innerWidth <= 768);
        const footer = document.getElementById('game-footer');
        const isTabbed = footer && footer.classList.contains('tabbed');
        if (shouldTab && !isTabbed) setFooterMode(true);
        else if (!shouldTab && isTabbed) setFooterMode(false);

        const toolbar = document.getElementById('touch-toolbar');
        if (toolbar) {
            const tm = this.settings.toolbarMode || 'auto';
            if (tm === 'always') toolbar.style.display = 'flex';
            else if (tm === 'never') toolbar.style.display = 'none';
            else toolbar.style.display = '';
        }

        currentZoomFont = null;
        requestAnimationFrame(() => fitGameFont());
    }

    gameLoop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (!this.paused) {
            this.accumulator += dt * this.speed;
            while (this.accumulator >= CONFIG.TICK_RATE) {
                this.simulationTick();
                this.accumulator -= CONFIG.TICK_RATE;
            }

            if (this.settings.autoSaveInterval > 0) {
                const intervalTicks = Math.round(this.settings.autoSaveInterval / 24 * CONFIG.TICKS_PER_DAY);
                if (this._lastAutoSaveTick === undefined) this._lastAutoSaveTick = this.tick;
                if (this.tick - this._lastAutoSaveTick >= intervalTicks) {
                    this._lastAutoSaveTick = this.tick;
                    if (saveGame(this)) {
                        this.notifications.push({ text: 'Auto-saved', tick: this.tick, type: 'success' });
                    }
                }
            }
        }

        if (this.followingColonist) {
            const fc = this.getColonist(this.followingColonist);
            if (fc && fc.hp > 0) {
                const pos = getEntityRenderPos(fc, performance.now());
                this.camera.centerOn(Math.round(pos.x), Math.round(pos.y));
            } else {
                this.followingColonist = null;
            }
        }

        const prof = this._profiler;
        if (prof) { prof.countFrame(); prof.begin(); }

        this.renderer.render(this);
        if (prof) prof.mark('frame:renderer');
        if (this.settings.showFps) {
            this._fpsFrames++;
            if (timestamp - this._fpsLastTime >= 1000) {
                this._fpsDisplay = this._fpsFrames;
                this._fpsFrames = 0;
                this._fpsLastTime = timestamp;
            }
            this.renderer.renderFps(this._fpsDisplay);
        }
        if (this.settings.showMinimap) this.minimap.render();
        if (prof) prof.mark('frame:minimap');
        this.ui.update();
        if (prof) prof.mark('frame:ui.update');
        requestAnimationFrame(this.gameLoop);
    }

    // The heartbeat of the simulation, driven by gameLoop at a fixed cadence.
    // Work is spread across ticks to bound per-tick cost:
    //
    //   Every tick:  rebuild hostile + colonist spatial hashes; weather update;
    //                room/quality recompute WHEN roomsDirty; turrets (if powered);
    //                per-colonist update; summons; wildlife; combat; waves;
    //                exploration; events; social; fires; effect/projectile expiry.
    //   Every 5:     farming, research.
    //   Every 10:    power, tamed animals, auto-cook, auto-craft, auto-repair,
    //                pedestal auras (aura fields are cleared then reapplied here).
    //   Periodic:    music state (%30), snow (%50), food decay (FOOD_DECAY_CONFIG
    //                .decayInterval).
    //
    // Deliberately NOT optimized (see Phase 3 notes): the spatial hashes are
    // rebuilt from scratch every tick (entities move most ticks; n is small and
    // an incremental path risks desync); findBestTask stays a linear scan (a task
    // spatial index is a correctness risk that needs measurement first). Both are
    // revisited under Phase 6 only if a timing probe shows they matter.
    simulationTick() {
        this.tick++;
        this.timeOfDay = this.tick % CONFIG.TICKS_PER_DAY;

        // Phase 6 profiler hook — zero cost unless startPerfProbe() was called.
        const prof = this._profiler;
        if (prof) { prof.countTick(); prof.begin(); }

        if (this.tick % 30 === 0 && window.soundManager) {
            window.soundManager.updateMusicState(this);
        }

        const hostileEntities = [];
        for (const e of this.entities) { if (e.hostile && e.hp > 0 && !e.tamed) hostileEntities.push(e); }
        for (const r of this.raiders) { if (r.hp > 0) hostileEntities.push(r); }
        if (this.waves) { for (const e of this.waves.enemies) { if (e.hp > 0) hostileEntities.push(e); } }
        this.spatial.hostiles.rebuild(hostileEntities);
        this.spatial.colonists.rebuild(this.colonists);
        if (prof) prof.mark('spatial.rebuild');

        const prevSeason = this.weather.season;
        this.weather.update(this.tick, this.divinationModifiers);
        if (this.weather.season !== prevSeason) {
            this.eventLog.add(this, `Season changed to ${this.weather.season} (Year ${this.weather.year})`, 'event', null);
            this.weather.applySnow(this.map);
        } else if (this.tick % 50 === 0) {
            this.weather.applySnow(this.map);
        }

        if (this.tick % FOOD_DECAY_CONFIG.decayInterval === 0) {
            const lost = this.resources.decayFood(this);
            if (lost >= 5) {
                this.eventLog.add(this, `${lost} food spoiled`, 'warning', null);
            }
        }

        if (this.roomsDirty) {
            const roomCount = detectRooms(this.map);
            this.mapIndex.rebuild(this.map);
            checkComplexStructures(this);
            const qualities = calculateRoomQualities(this.map, roomCount);

            // Track room completions and quality changes for visual feedback
            for (let roomId = 0; roomId < roomCount; roomId++) {
                const prevQuality = this.roomQualities[roomId];
                const newQuality = qualities.roomQualities[roomId];
                if (newQuality && !prevQuality) {
                    // Room newly completed
                    const roomTiles = Array.from({ length: this.map.length }, (_, y) =>
                        Array.from({ length: this.map[y].length }, (_, x) =>
                            this.map[y][x].roomId === roomId ? { x, y } : null
                        ).filter(Boolean)
                    ).flat();
                    if (roomTiles.length > 0) {
                        const centerX = Math.floor(roomTiles.reduce((sum, t) => sum + t.x, 0) / roomTiles.length);
                        const centerY = Math.floor(roomTiles.reduce((sum, t) => sum + t.y, 0) / roomTiles.length);
                        this.overlays.push({ type: 'floating_text', x: centerX, y: centerY, text: 'Room complete', color: '#ffcc00', fontSize: 11, ttl: 25, maxTtl: 25 });
                    }
                } else if (newQuality && prevQuality && newQuality.tier > prevQuality.tier) {
                    // Room quality improved
                    const roomTiles = Array.from({ length: this.map.length }, (_, y) =>
                        Array.from({ length: this.map[y].length }, (_, x) =>
                            this.map[y][x].roomId === roomId ? { x, y } : null
                        ).filter(Boolean)
                    ).flat();
                    if (roomTiles.length > 0) {
                        const centerX = Math.floor(roomTiles.reduce((sum, t) => sum + t.x, 0) / roomTiles.length);
                        const centerY = Math.floor(roomTiles.reduce((sum, t) => sum + t.y, 0) / roomTiles.length);
                        this.overlays.push({ type: 'floating_text', x: centerX, y: centerY, text: `Room: ${newQuality.tier}`, color: '#44ff44', fontSize: 11, ttl: 25, maxTtl: 25 });
                    }
                }
            }

            this.roomQualities = qualities.roomQualities;
            this.workshopQualities = qualities.workshopQualities;
            this.roomsDirty = false;
        }
        if (prof) prof.mark('weather+decay+rooms');

        if (this.tick % 5 === 0) {
            updateFarming(this);
        }
        if (this.tick % 8 === 0) {
            updateResearch(this);
        }
        if (prof) prof.mark('farming+research');

        if (this.tick % 10 === 0) {
            this.power.update(this);
            updateTamedAnimals(this);
            updateAutoCook(this);
            updateAutoCraft(this);
            // Structure positions are stable within a tick; compute once and
            // share between auto-repair and pedestal scanning.
            const structurePositions = this.mapIndex.getAllStructurePositions();
            updateAutoRepair(this, structurePositions);
            for (const c of this.colonists) {
                c.pedestalWorkBonus = 0;
                c.pedestalDamageBonus = 1;
                c.pedestalSkillBonus = 0;
                c.activeAuras = [];
            }
            updatePedestals(this, structurePositions);
        }
        if (prof) prof.mark('power+tamed+auto+pedestals(%10)');

        if (this.power.hasPower()) {
            this.power.updateTurrets(this);
        }

        this._buildOccupancySet();
        if (prof) prof.mark('turrets+occupancy');

        for (const colonist of this.colonists) {
            if (colonist.hp > 0) {
                updateColonist(colonist, this);
            }
        }
        if (prof) prof.mark('colonists');

        updateSummons(this);
        if (prof) prof.mark('summons');

        this.combatEffects = this.combatEffects.filter(e => e.ttl-- > 0);
        const now = performance.now();
        this.projectiles = this.projectiles.filter(p => now < p._startTime + p._duration);
        if (this.divinationModifiers) {
            this.divinationModifiers = this.divinationModifiers.filter(m => m.expiresAt > this.tick);
        }
        this.overlays = this.overlays.filter(o => o.ttl !== undefined && o.ttl-- > 0);

        for (const c of this.colonists) {
            if (c.hp > 0 && c.state === 'working' && c.workProgress > 0) {
                this.overlays.push({
                    type: 'progress_bar', x: c.x, y: c.y,
                    progress: c.workProgress, color: '#44cc44', bgColor: '#222222',
                });
            }
        }
        if (prof) prof.mark('effect-expiry+progressbars');

        updateWildlife(this);
        if (prof) prof.mark('wildlife');
        this.combat.update(this);
        if (prof) prof.mark('combat');
        this.waves.update(this);
        if (prof) prof.mark('waves');
        this.exploration.update(this);
        if (prof) prof.mark('exploration');
        this.events.update(this);
        if (prof) prof.mark('events');
        this.social.update(this);
        if (prof) prof.mark('social');
        updateFires(this);
        if (prof) prof.mark('fires');

        this._recipeCacheVersion++;

        if (this.tick % 20 === 0) {
            this.tutorial.update(this);
        }

        if (!this._gameOver && this.colonists.length > 0 && this.colonists.every(c => c.hp <= 0)) {
            this._gameOver = true;
            this.paused = true;
            this.notifications.push({ text: 'All colonists have died. Game Over.', tick: this.tick, type: 'danger' });
            this.eventLog.add(this, 'All colonists have died. Game Over.', 'danger', null);
        }

        if (prof && this.tick % this._profilerReportEvery === 0) prof.report();
    }

    _buildOccupancySet() {
        const occ = this._occupiedTiles || (this._occupiedTiles = new Set());
        occ.clear();
        for (const c of this.colonists) {
            if (c.hp > 0) occ.add((c.y << 16) | c.x);
        }
        for (const e of this.entities) {
            if (e.hp > 0) occ.add((e.y << 16) | e.x);
        }
        if (this.waves) {
            for (const e of this.waves.enemies) {
                if (e.hp > 0) occ.add((e.y << 16) | e.x);
            }
        }
    }

    isTileOccupied(x, y) {
        return this._occupiedTiles ? this._occupiedTiles.has((y << 16) | x) : false;
    }

    togglePause() {
        this.paused = !this.paused;
        document.getElementById('game').classList.toggle('paused', this.paused && this.settings.darkenOnPause);
        document.getElementById('pause-overlay').style.display = this.paused ? 'block' : 'none';
    }

    speedUp() {
        this.speed = Math.min(5, this.speed + 1);
    }

    speedDown() {
        this.speed = Math.max(1, this.speed - 1);
    }

    setSpeed(val) {
        this.speed = Math.max(1, Math.min(5, val));
        if (this.paused) this.togglePause();
    }

    setMobileMode(mode) {
        this.input.setMode(mode);
    }

    cyclePriority(colonistId, skill) {
        const c = this.getColonist(colonistId);
        if (!c || c.golem) return;
        c.priorities[skill] = (c.priorities[skill] + 1) % 6;
    }

    toggleDraft(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c || c.hp <= 0) return;
        c.drafted = !c.drafted;
        if (c.drafted) {
            c.state = 'drafted';
            if (c.currentTaskId) {
                this.taskQueue.release(c.currentTaskId);
                c.currentTaskId = null;
            }
        } else {
            c.state = 'idle';
            c.draftTarget = null;
        }
        if (this.selectedColonists.length > 1) {
            this.ui.showMultiColonistInfo(this.selectedColonists);
        } else {
            this.ui.showColonistInfo(c);
        }
    }

    toggleGuard(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c || c.hp <= 0) return;
        c.guardMode = !c.guardMode;
        if (c.guardMode) {
            c.guardPost = { x: c.x, y: c.y };
            c.drafted = false;
            c.draftTarget = null;
            if (c.currentTaskId) {
                this.taskQueue.release(c.currentTaskId);
                c.currentTaskId = null;
            }
            c.state = 'idle';
        } else {
            c.guardPost = null;
            c.state = 'idle';
        }
        if (this.selectedColonists.length > 1) {
            this.ui.showMultiColonistInfo(this.selectedColonists);
        } else {
            this.ui.showColonistInfo(c);
        }
    }

    setGuardPost(colonistId, pos) {
        const c = this.getColonist(colonistId);
        if (!c || c.hp <= 0) return;
        if (c.guardMode) {
            c.guardPost = { x: pos.x, y: pos.y };
            this.notifications.push({ text: `${c.name}'s guard point set to (${pos.x}, ${pos.y})`, tick: this.tick, type: 'event' });
            if (this.selectedColonists.length > 1) {
                this.ui.showMultiColonistInfo(this.selectedColonists);
            } else {
                this.ui.showColonistInfo(c);
            }
        } else {
            this.notifications.push({ text: `${c.name} must be in Guard Mode first`, tick: this.tick, type: 'danger' });
        }
    }

    draftAllSelected() {
        for (const c of this.selectedColonists) {
            if (c.hp > 0 && !c.drafted) {
                this.toggleDraft(c.id);
            }
        }
    }

    undraftAllSelected() {
        for (const c of this.selectedColonists) {
            if (c.hp > 0 && c.drafted) {
                this.toggleDraft(c.id);
            }
        }
    }

    assignBedFromSelect(x, y, colonistIdStr) {
        const colonistId = parseInt(colonistIdStr);
        if (!colonistId) return;
        const c = this.getColonist(colonistId);
        if (!c) return;
        c.assignedBed = { x, y };
        this.notifications.push({ text: `${c.name} assigned to bed at (${x},${y})`, tick: this.tick, type: 'success' });
        const tile = this.map[y][x];
        this.ui.showTileInfo(tile, x, y);
    }

    unassignBed(x, y) {
        const c = this.colonists.find(col =>
            col.assignedBed && col.assignedBed.x === x && col.assignedBed.y === y
        );
        if (c) {
            c.assignedBed = null;
            this.notifications.push({ text: `${c.name} unassigned from bed`, tick: this.tick, type: 'success' });
            const tile = this.map[y][x];
            this.ui.showTileInfo(tile, x, y);
        }
    }

    placePedestalArtifact(x, y, artifactKey) {
        const tile = this.map[y][x];
        if (tile.structure !== 'artifact_pedestal' || tile.pedestalArtifact) return;
        if (!ARTIFACTS[artifactKey]?.pedestal) return;
        this.resources.removeArtifact(artifactKey);
        tile.pedestalArtifact = artifactKey;
        this.notifications.push({ text: `Placed ${ARTIFACTS[artifactKey].name} on pedestal`, tick: this.tick, type: 'success' });
        this.ui.showTileInfo(tile, x, y);
    }

    retrievePedestalArtifact(x, y) {
        const tile = this.map[y][x];
        if (tile.structure !== 'artifact_pedestal' || !tile.pedestalArtifact) return;
        const key = tile.pedestalArtifact;
        tile.pedestalArtifact = null;
        tile.pedestalInactive = false;
        this.resources.addArtifact({ ...ARTIFACTS[key], key });
        this.notifications.push({ text: `Retrieved ${ARTIFACTS[key]?.name || key} from pedestal`, tick: this.tick, type: 'success' });
        this.ui.showTileInfo(tile, x, y);
    }

    selectColonistById(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c || c.hp <= 0) return;
        this.selectedColonist = c;
        this.selectedColonists = [c];
        this.camera.centerOn(c.x, c.y);
        this.ui.showColonistInfo(c);
    }

    centerOnColonist(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c || c.hp <= 0) return;
        this.camera.centerOn(c.x, c.y);
    }

    setColonistColor(colonistId, color) {
        const c = this.getColonist(colonistId);
        if (!c) return;
        c.nameColor = color;
        this.ui.showColonistInfo(c);
    }

    toggleFollow(colonistId) {
        if (this.followingColonist === colonistId) {
            this.followingColonist = null;
            this.notifications.push({ text: 'Camera unfollowed', tick: this.tick, type: 'success' });
        } else {
            this.followingColonist = colonistId;
            const c = this.getColonist(colonistId);
            if (c) {
                this.notifications.push({ text: `Following ${c.name}`, tick: this.tick, type: 'success' });
            }
        }
        if (this.selectedColonist) this.ui.showColonistInfo(this.selectedColonist);
    }

    // Generic equip: takes item from inventory, swaps with colonist's slot
    _equipItem(colonistId, index, slot, listName, addMethod) {
        const c = this.getColonist(colonistId);
        if (!c) return;
        const list = this.resources[listName];
        if (index === undefined || index < 0 || index >= list.length) return;
        const item = list.splice(index, 1)[0];
        if (c[slot]) this.resources[addMethod](c[slot]);
        c[slot] = item;
        this._recalcEquipmentStats(c);
        if (slot === 'armor' || slot === 'helmet' || slot === 'weapon' || slot === 'tool') this.renderer?.skinManager?.invalidateComposite(colonistId);
        this.notifications.push({ text: `${c.name} equipped ${item.name}`, tick: this.tick, type: 'success' });
        if (slot === 'artifact') this._updateColonistRadiusHighlight(c);
        this.ui.showColonistInfo(c);
    }

    // Generic unequip: returns item to inventory, clears colonist slot
    _unequipItem(colonistId, slot, addMethod, label) {
        const c = this.getColonist(colonistId);
        if (!c || !c[slot]) return;
        this.resources[addMethod](c[slot]);
        c[slot] = null;
        this._recalcEquipmentStats(c);
        if (slot === 'armor' || slot === 'helmet' || slot === 'weapon' || slot === 'tool') this.renderer?.skinManager?.invalidateComposite(colonistId);
        this.notifications.push({ text: `${c.name} unequipped ${label}`, tick: this.tick, type: 'success' });
        if (slot === 'artifact') this._updateColonistRadiusHighlight(c);
        this.ui.showColonistInfo(c);
    }

    _recalcEquipmentStats(c) {
        const baseHp = c.golem ? (GOLEM_TYPES[c.golem]?.hp || c.maxHp) : COLONIST_CONFIG.maxHp;
        let bonus = 0;
        for (const item of [c.weapon, c.armor, c.helmet, c.tool, c.artifact].filter(Boolean)) {
            if (item.maxHpBonus) bonus += item.maxHpBonus;
        }
        c.maxHp = baseHp + bonus;
        if (c.hp > c.maxHp) c.hp = c.maxHp;
    }

    _updateColonistRadiusHighlight(c) {
        if (c.artifact && !c.artifactBroken && c.artifact.pedestal?.radius && c.artifact.pedestal.radius !== 'global') {
            this.radiusHighlight = { x: c.x, y: c.y, radius: c.artifact.pedestal.radius, color: '#ccaa4466' };
        } else {
            this.radiusHighlight = null;
        }
    }

    _discardItem(index, listName) {
        const list = this.resources[listName];
        if (index < 0 || index >= list.length) return;
        const item = list.splice(index, 1)[0];
        const recovered = {};
        const recipe = Object.values(RECIPES).find(r => {
            const outputKey = Object.keys(r.output)[0];
            return outputKey === item.key;
        });
        if (recipe) {
            for (const [res, amt] of Object.entries(recipe.input)) {
                recovered[res] = Math.max(1, Math.floor(amt * SALVAGE_RATE));
            }
        } else {
            recovered.planks = 1;
        }
        this.resources.add(recovered);
        const recoveredStr = Object.entries(recovered).map(([k, v]) => `${v} ${k}`).join(', ');
        this.notifications.push({ text: `Salvaged ${item.name} (${recoveredStr})`, tick: this.tick, type: 'event' });
        this.ui.updateInventoryPanel();
    }

    equipWeapon(colonistId, index) { this._equipItem(colonistId, index, 'weapon', 'weapons', 'addWeapon'); }
    unequipWeapon(colonistId) { this._unequipItem(colonistId, 'weapon', 'addWeapon', 'weapon'); }

    huntAnimal(animalId) {
        designateHunt(this, animalId);
    }

    setAutoCookTarget(value) {
        this.settings.autoCookTarget = Math.max(0, Math.min(200, value || 0));
    }

    craft(recipeKey) {
        if (queueCraftingOrder(this, recipeKey)) {
            this.notifications.push({ text: `Queued: ${recipeKey.replace(/_/g, ' ')}`, tick: this.tick, type: 'success' });
        }
    }

    craftMultiple(recipeKey, count) {
        let queued = 0;
        for (let i = 0; i < count; i++) {
            if (queueCraftingOrder(this, recipeKey)) queued++;
            else break;
        }
        if (queued > 0) {
            this.notifications.push({ text: `Queued ${queued}x: ${recipeKey.replace(/_/g, ' ')}`, tick: this.tick, type: 'success' });
        }
    }

    toggleCraftRepeat(recipeKey) {
        if (!this.settings.craftTargets[recipeKey]) {
            this.settings.craftTargets[recipeKey] = { repeat: false, target: 0 };
        }
        this.settings.craftTargets[recipeKey].repeat = !this.settings.craftTargets[recipeKey].repeat;
        const state = this.settings.craftTargets[recipeKey].repeat ? 'ON' : 'OFF';
        this.notifications.push({ text: `Auto-repeat ${recipeKey.replace(/_/g, ' ')}: ${state}`, tick: this.tick, type: 'info' });
    }

    setCraftTarget(recipeKey, value) {
        if (!this.settings.craftTargets[recipeKey]) {
            this.settings.craftTargets[recipeKey] = { repeat: false, target: 0 };
        }
        this.settings.craftTargets[recipeKey].target = Math.max(0, parseInt(value) || 0);
    }

    resolveEvent(choice) {
        const evt = this.events.pendingEvent;
        if (!evt) return;
        if (evt.type === 'wanderer') {
            this.events.resolveWanderer(this, choice === 0);
        } else if (evt.type === 'caravan' || evt.type === 'trade') {
            this.events.resolveCaravan(this, choice);
        } else if (evt.type === 'raid') {
            if (choice === 0) {
                this.camera.centerOn(evt.data.x, evt.data.y);
            }
            this.events.pendingEvent = null;
        } else if (evt.type === 'research_complete') {
            this.events.pendingEvent = null;
            if (choice === 1) {
                this._eventPaused = false;
                this.ui.toggleResearchPanel();
                return;
            }
        }
        this._unpauseFromEvent();
    }

    _unpauseFromEvent() {
        if (this._eventPaused && this.paused) {
            this.togglePause();
        }
        this._eventPaused = false;
    }

    // ─── Trade Panel State & Actions ───────────────────────────────────────
    // UI state lives on this.ui._trade*:
    //   _tradeOffer: { resource: amount } - what player is giving
    //   _tradeRequest: { resource: amount, __exclusive_N?: 1, __gold?: amount } - what player wants
    //   _tradeGoldOffer: number - gold the player is spending
    //   _tradeStep: 1|10|100 - increment for +/- buttons
    //   _tradeDirty: bool - triggers UI re-render

    openTradePanel() {
        this.ui._tradeOpen = true;
        this.ui._tradeOffer = {};
        this.ui._tradeRequest = {};
        this.ui._tradeGoldOffer = 0;
        this.ui._tradeStep = 1;
        this.ui._tradeDirty = true;
    }

    tradeOffer(resource, amount) {
        if (!this.ui._tradeOffer) this.ui._tradeOffer = {};
        if (resource.startsWith('__equip_')) {
            // Equipment items are single-unit — toggle on
            this.ui._tradeOffer[resource] = 1;
        } else {
            const max = this.resources.stockpile[resource] || 0;
            this.ui._tradeOffer[resource] = Math.min((this.ui._tradeOffer[resource] || 0) + amount, max);
        }
        this.ui._tradeDirty = true;
    }

    tradeRemoveOffer(resource, amount) {
        if (!this.ui._tradeOffer) return;
        if (resource.startsWith('__equip_')) {
            delete this.ui._tradeOffer[resource];
        } else {
            const cur = this.ui._tradeOffer[resource] || 0;
            const next = Math.max(0, cur - amount);
            if (next <= 0) {
                delete this.ui._tradeOffer[resource];
            } else {
                this.ui._tradeOffer[resource] = next;
            }
        }
        this.ui._tradeDirty = true;
    }

    tradeRequest(resource, amount) {
        if (!this.ui._tradeRequest) this.ui._tradeRequest = {};
        if (resource.startsWith('__exclusive_')) {
            this.ui._tradeRequest[resource] = 1;
        } else {
            const evt = this.events.pendingEvent;
            const max = evt?.data?.traderResources?.[resource] || 0;
            this.ui._tradeRequest[resource] = Math.min((this.ui._tradeRequest[resource] || 0) + amount, max);
        }
        this.ui._tradeDirty = true;
    }

    tradeRemoveRequest(resource, amount) {
        if (!this.ui._tradeRequest) return;
        if (resource.startsWith('__exclusive_')) {
            delete this.ui._tradeRequest[resource];
        } else {
            const cur = this.ui._tradeRequest[resource] || 0;
            const next = Math.max(0, cur - amount);
            if (next <= 0) {
                delete this.ui._tradeRequest[resource];
            } else {
                this.ui._tradeRequest[resource] = next;
            }
        }
        this.ui._tradeDirty = true;
    }

    confirmTrade() {
        const success = this.events.executeBarterTrade(this, this.ui._tradeOffer || {}, this.ui._tradeRequest || {}, this.ui._tradeGoldOffer || 0);
        if (success) {
            this.ui._tradeOffer = {};
            this.ui._tradeRequest = {};
            this.ui._tradeGoldOffer = 0;
        }
        this.ui._tradeDirty = true;
    }

    clearTradeSelection() {
        this.ui._tradeOffer = {};
        this.ui._tradeRequest = {};
        this.ui._tradeGoldOffer = 0;
        this.ui._tradeDirty = true;
    }

    // Adjust how much of the player's gold to offer (capped at what they have)
    tradeGold(amount) {
        const max = this.resources.stockpile.gold || 0;
        this.ui._tradeGoldOffer = Math.min(Math.max(0, (this.ui._tradeGoldOffer || 0) + amount), max);
        this.ui._tradeDirty = true;
    }

    // Adjust how much gold to request FROM the trader (capped at trader's current gold)
    tradeRequestGold(amount) {
        if (!this.ui._tradeRequest) this.ui._tradeRequest = {};
        const evt = this.events.pendingEvent;
        const max = evt?.data?.traderGold || 0;
        const cur = this.ui._tradeRequest.__gold || 0;
        const next = Math.min(Math.max(0, cur + amount), max);
        if (next <= 0) {
            delete this.ui._tradeRequest.__gold;
        } else {
            this.ui._tradeRequest.__gold = next;
        }
        this.ui._tradeDirty = true;
    }

    /**
     * Auto-balances the current trade with gold.
     * - If player's offer < request cost: adds player gold to cover the deficit.
     * - If player's resources > request cost: requests gold from trader to capture surplus.
     *   Only resource value (not player's gold offer) counts as claimable surplus,
     *   preventing the exploit of offering gold then requesting it back.
     */
    balanceTradeWithGold() {
        const evt = this.events.pendingEvent;
        if (!evt || evt.type !== 'trade') return;
        const data = evt.data;
        const offer = this.ui._tradeOffer || {};
        const request = this.ui._tradeRequest || {};
        const currentGoldOffer = this.ui._tradeGoldOffer || 0;
        const currentGoldRequest = request.__gold || 0;

        const rates = getTradeRates(this);
        const { offerVal, resourceOfferVal, reqVal } = computeTradeValues(offer, request, currentGoldOffer, rates, data, this);

        const diff = offerVal - reqVal;
        if (diff < 0) {
            // Deficit: spend player gold to cover it
            const available = (this.resources.stockpile.gold || 0) - currentGoldOffer;
            const goldToAdd = Math.min(-diff, available);
            if (goldToAdd > 0) {
                this.ui._tradeGoldOffer = currentGoldOffer + goldToAdd;
                this.ui._tradeDirty = true;
            }
        } else if (diff > 0) {
            // Surplus: request gold from trader (only for resource-based surplus)
            const claimable = Math.max(0, resourceOfferVal - reqVal);
            const traderAvailable = data.traderGold - currentGoldRequest;
            const goldToRequest = Math.min(claimable, traderAvailable);
            if (goldToRequest > 0) {
                this.ui._tradeRequest = { ...request, __gold: currentGoldRequest + goldToRequest };
                this.ui._tradeDirty = true;
            }
        }
    }

    dismissTrader() {
        this.events.dismissTrader();
        this.ui._tradeOpen = false;
        this.ui._tradeOffer = {};
        this.ui._tradeRequest = {};
        this.ui._tradeGoldOffer = 0;
        this._unpauseFromEvent();
    }

    toggleSettingsPanel() {
        this.ui.toggleSettingsPanel();
    }

    showGlossary() {
        const panel = document.getElementById('glossary-panel');
        const backdrop = document.getElementById('modal-backdrop');
        if (panel) panel.style.display = 'block';
        if (backdrop) backdrop.style.display = 'block';
        const search = document.getElementById('glossary-search');
        if (search) search.focus();
    }

    togglePeaceful() {
        CONFIG.PEACEFUL_MODE = !CONFIG.PEACEFUL_MODE;
        if (CONFIG.PEACEFUL_MODE) {
            this.raiders = [];
            this.entities = this.entities.filter(e => !(e.category === 'animal' && !e.tamed && e.hostile));
        }
    }

    selectResearch(techKey) {
        if (this.research.selectResearch(techKey)) {
            const name = techKey.replace(/_/g, ' ');
            this.notifications.push({ text: `Now researching: ${name}`, tick: this.tick, type: 'info' });
        }
    }

    cancelResearch() {
        if (this.research.activeResearch) {
            this.research.deselectResearch();
            this.notifications.push({ text: 'Research paused', tick: this.tick, type: 'info' });
        }
    }

    startWave() {
        if (this.waves.startWave(this)) {
            this.camera.centerOn(this.waves.nexusPosition.x, this.waves.nexusPosition.y);
        } else if (this.waves.active) {
            this.notifications.push({ text: 'A wave is already in progress!', tick: this.tick, type: 'danger' });
        } else {
            this.notifications.push({ text: 'Build a Void Nexus first!', tick: this.tick, type: 'danger' });
        }
    }

    showExpeditionSetup(realmKey) {
        const available = this.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.drafted);
        if (available.length === 0) {
            this.notifications.push({ text: 'No colonists available for expedition', tick: this.tick, type: 'danger' });
            return;
        }
        let html = `<div class="info-row" style="color:#33ccff;font-weight:bold;">Select Party</div>`;
        html += `<div class="info-row" style="color:#888;">Choose colonists to send:</div>`;
        for (const c of available) {
            const weaponInfo = c.weapon ? ` (${c.weapon.name})` : ' (unarmed)';
            html += `<div class="info-row"><label><input type="checkbox" class="exp-check" value="${c.id}"> ${c.name}${weaponInfo} HP:${c.hp}/${c.maxHp}</label></div>`;
        }
        const packAnimals = this.entities.filter(a => {
            return a.tamed && a.hp > 0 && !a.onExpedition &&
                a.roles && a.roles.some(r => r.type === 'pack');
        });
        if (packAnimals.length > 0) {
            html += `<div class="info-row" style="color:#bbaa44;margin-top:6px;"><b>Pack Animals:</b></div>`;
            for (const a of packAnimals) {
                const packRole = a.roles.find(r => r.type === 'pack');
                const speedBonus = packRole ? packRole.expeditionSpeedBonus || 0.25 : 0.25;
                html += `<div class="info-row"><label><input type="checkbox" class="exp-pack-check" value="${a.id}"> ${a.type} (+${Math.round(speedBonus * 100)}% speed)</label></div>`;
            }
        }
        html += `<div class="info-actions"><button onclick="window.game.launchExpedition('${realmKey}')" style="background:#1a4466;color:#88ddff;">Launch</button></div>`;
        this.ui.elements.infoPanel.innerHTML = html;
    }

    showExpeditionSetupInPanel(realmKey) {
        const available = this.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.drafted);
        if (available.length === 0) {
            this.notifications.push({ text: 'No colonists available for expedition', tick: this.tick, type: 'danger' });
            return;
        }
        this.ui._arcaneExpSetup = realmKey;
        this.ui._lastArcaneHtml = '';
        this.ui.updateArcanePanel();
    }

    launchExpeditionFromPanel(realmKey) {
        const panel = this.ui.elements.arcanePanel;
        const checks = panel.querySelectorAll('.exp-check:checked');
        const ids = Array.from(checks).map(cb => parseInt(cb.value));
        if (ids.length === 0) {
            this.notifications.push({ text: 'Select at least one colonist', tick: this.tick, type: 'danger' });
            return;
        }
        const packChecks = panel.querySelectorAll('.exp-pack-check:checked');
        const packIds = Array.from(packChecks).map(cb => parseInt(cb.value));
        const difficulty = this.ui._expDifficulty || 1;
        const result = this.exploration.sendExpedition(this, realmKey, ids, packIds, difficulty);
        if (result) {
            this.notifications.push({ text: `Expedition launched to ${result.realmName}!`, tick: this.tick, type: 'success' });
            this.ui._arcaneExpSetup = null;
            this.ui._lastArcaneHtml = '';
            this.ui._expVisState = { lastLogLen: 0, effects: [], partyX: 0 };
            this.ui.updateArcanePanel();
        } else {
            this.notifications.push({ text: 'Cannot launch expedition', tick: this.tick, type: 'danger' });
        }
    }

    launchExpedition(realmKey) {
        const checks = this.ui.elements.infoPanel.querySelectorAll('.exp-check:checked');
        const ids = Array.from(checks).map(cb => parseInt(cb.value));
        if (ids.length === 0) {
            this.notifications.push({ text: 'Select at least one colonist', tick: this.tick, type: 'danger' });
            return;
        }
        const packChecks = this.ui.elements.infoPanel.querySelectorAll('.exp-pack-check:checked');
        const packIds = Array.from(packChecks).map(cb => parseInt(cb.value));
        const result = this.exploration.sendExpedition(this, realmKey, ids, packIds);
        if (result) {
            this.notifications.push({ text: `Expedition launched to ${result.realmName}!`, tick: this.tick, type: 'success' });
            this.ui._viewingRiftGate = true;
            this.ui._viewingColonistId = null;
        } else {
            this.notifications.push({ text: 'Cannot launch expedition', tick: this.tick, type: 'danger' });
        }
    }

    equipArmor(colonistId, index) { this._equipItem(colonistId, index, 'armor', 'armors', 'addArmor'); }
    unequipArmor(colonistId) { this._unequipItem(colonistId, 'armor', 'addArmor', 'armor'); }
    equipHelmet(colonistId, index) { this._equipItem(colonistId, index, 'helmet', 'helmets', 'addHelmet'); }
    unequipHelmet(colonistId) { this._unequipItem(colonistId, 'helmet', 'addHelmet', 'helmet'); }
    discardWeapon(index) { this._discardItem(index, 'weapons'); }
    discardArmor(index) { this._discardItem(index, 'armors'); }
    discardHelmet(index) { this._discardItem(index, 'helmets'); }
    equipTool(colonistId, index) { this._equipItem(colonistId, index, 'tool', 'tools', 'addTool'); }
    unequipTool(colonistId) { this._unequipItem(colonistId, 'tool', 'addTool', 'tool'); }
    discardTool(index) { this._discardItem(index, 'tools'); }
    equipArtifact(colonistId, index) { this._equipItem(colonistId, index, 'artifact', 'artifacts', 'addArtifact'); }
    unequipArtifact(colonistId) { this._unequipItem(colonistId, 'artifact', 'addArtifact', 'artifact'); }

    equipTome(colonistId, index) {
        const c = this.getColonist(colonistId);
        if (!c) return;
        const tome = this.resources.takeTome(index);
        if (!tome) return;
        if (c.equippedTome) this.resources.addTome({ ...SPELL_TOMES[c.equippedTome], key: c.equippedTome });
        c.equippedTome = tome.key;
        this.notifications.push({ text: `${c.name} began studying ${tome.name}`, tick: this.tick, type: 'success' });
        this.ui.showColonistInfo(c);
    }

    unequipTome(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c || !c.equippedTome) return;
        this.resources.addTome({ ...SPELL_TOMES[c.equippedTome], key: c.equippedTome });
        c.equippedTome = null;
        this.notifications.push({ text: `${c.name} stopped studying`, tick: this.tick, type: 'success' });
        this.ui.showColonistInfo(c);
    }

    useConsumable(index) {
        const item = this.resources.takeConsumable(index);
        if (!item) return;
        this.useConsumableItem(item.key);
    }

    useConsumableItem(itemKey) {
        if (itemKey === 'crystal_capacitor') {
            this.manaCrystalBonus = (this.manaCrystalBonus || 0) + 1;
            const reservoirBonus = this.research.isResearched('mana_reservoir') ? 3 : 0;
            const newLimit = 4 + this.manaCrystalBonus + reservoirBonus;
            this.notifications.push({ text: `Crystal Capacitor used! Mana crystal limit: ${newLimit}`, tick: this.tick, type: 'success' });
            this.eventLog.add(this, `Used Crystal Capacitor — mana crystal limit increased to ${newLimit}`, 'event', null);
        }
    }

    startSpellTargeting(colonistId, spellKey) {
        this.input.startSpellTargeting(colonistId, spellKey);
    }

    toggleSpell(colonistId, spellKey) {
        const c = this.getColonist(colonistId);
        if (!c) return;
        if (!c.disabledSpells) c.disabledSpells = [];
        const idx = c.disabledSpells.indexOf(spellKey);
        if (idx >= 0) {
            c.disabledSpells.splice(idx, 1);
        } else {
            c.disabledSpells.push(spellKey);
        }
        this.ui.showColonistInfo(c);
    }

    castTargetedSpell(colonist, spell, pos) {
        switch (spell.effect) {
            case 'teleport': {
                teleportEntity(colonist, pos.x, pos.y);
                colonist.path = [];
                this.combatEffects.push({ x: pos.x, y: pos.y, char: COMBAT_VISUALS.spellTeleportChar, color: COMBAT_VISUALS.spellTeleportColor, ttl: 3 });
                window.soundManager?.playSFX('spell_teleport');
                this.notifications.push({ text: `${colonist.name} warped!`, tick: this.tick, type: 'success' });
                break;
            }
            case 'boost_crops': {
                let boosted = 0;
                for (let dy = -spell.radius; dy <= spell.radius; dy++) {
                    for (let dx = -spell.radius; dx <= spell.radius; dx++) {
                        const tx = pos.x + dx;
                        const ty = pos.y + dy;
                        if (tx < 0 || ty < 0 || tx >= CONFIG.MAP_WIDTH || ty >= CONFIG.MAP_HEIGHT) continue;
                        const tile = this.map[ty][tx];
                        if (tile.zone && tile.zone.state === 'growing') {
                            if (!tile.zone._growthBoost) tile.zone._growthBoost = { mult: 1, expiresAt: 0 };
                            tile.zone._growthBoost.mult = spell.growthMult;
                            tile.zone._growthBoost.expiresAt = this.tick + spell.duration;
                            boosted++;
                        }
                        this.combatEffects.push({ x: tx, y: ty, char: COMBAT_VISUALS.spellGrowthChar, color: COMBAT_VISUALS.spellGrowthColor, ttl: 4 });
                    }
                }
                window.soundManager?.playSFX('spell_growth');
                this.notifications.push({ text: `${colonist.name} cast ${spell.name} — ${boosted} crops boosted!`, tick: this.tick, type: 'success' });
                break;
            }
            case 'terraform': {
                let changed = 0;
                for (let dy = -spell.radius; dy <= spell.radius; dy++) {
                    for (let dx = -spell.radius; dx <= spell.radius; dx++) {
                        const tx = pos.x + dx;
                        const ty = pos.y + dy;
                        if (tx < 0 || ty < 0 || tx >= CONFIG.MAP_WIDTH || ty >= CONFIG.MAP_HEIGHT) continue;
                        const tile = this.map[ty][tx];
                        if (tile.terrain !== spell.targetTerrain && !tile.structure) {
                            tile.terrain = spell.targetTerrain;
                            tile.resource = null;
                            tile.passable = true;
                            changed++;
                        }
                        this.combatEffects.push({ x: tx, y: ty, char: COMBAT_VISUALS.spellTerraformChar, color: COMBAT_VISUALS.spellTerraformColor, ttl: 4 });
                    }
                }
                window.soundManager?.playSFX('spell_terraform');
                this.notifications.push({ text: `${colonist.name} cast ${spell.name} — ${changed} tiles transformed!`, tick: this.tick, type: 'success' });
                break;
            }
        }
        this.combatEffects.push({
            x: colonist.x, y: colonist.y,
            char: COMBAT_VISUALS.spellCastChar,
            color: spell.projectileColor || COMBAT_VISUALS.spellCastColor,
            ttl: 2,
        });
        this.overlays.push({
            type: 'glow',
            x: colonist.x, y: colonist.y,
            color: spell.projectileColor || COMBAT_VISUALS.spellCastColor,
            radius: 1.2, alpha: 0.35, ttl: 3,
        });
        grantCastXp(colonist, spell, this);
        addThought(colonist, 'Cast a spell', 3, 80, this.tick);
        this.story.checkMilestone('first_spell_cast', this);
    }

    discardArtifact(index) { this._discardItem(index, 'artifacts'); }

    cycleColonist(dir) {
        const alive = this.colonists.filter(c => c.hp > 0);
        if (alive.length === 0) return;
        const currentIdx = this.selectedColonist ? alive.indexOf(this.selectedColonist) : -1;
        const next = (currentIdx + dir + alive.length) % alive.length;
        this.selectColonistById(alive[next].id);
    }

    draftAll() {
        for (const c of this.colonists) {
            if (c.hp > 0 && !c.drafted) this.toggleDraft(c.id);
        }
    }

    undraftAll() {
        for (const c of this.colonists) {
            if (c.hp > 0 && c.drafted) this.toggleDraft(c.id);
        }
    }

    copyPriorities(toId, fromId) {
        const to = this.getColonist(toId);
        const from = this.getColonist(fromId);
        if (!to || !from) return;
        to.priorities = { ...from.priorities };
        this.notifications.push({ text: `${to.name} copied priorities from ${from.name}`, tick: this.tick, type: 'success' });
        this.ui.showColonistInfo(to);
    }

    rallyDrafted(x, y) {
        for (const c of this.colonists) {
            if (c.hp > 0 && c.drafted) {
                c.draftTarget = { x, y };
            }
        }
        this.notifications.push({ text: `Rally point set at (${x},${y})`, tick: this.tick, type: 'success' });
    }

    autoEquipBest(colonistId) {
        const c = this.getColonist(colonistId);
        if (!c) return;
        if (this.resources.weapons.length > 0) {
            const weaponDps = w => w.damage / (w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown);
            this.resources.weapons.sort((a, b) => weaponDps(b) - weaponDps(a));
            if (!c.weapon || weaponDps(this.resources.weapons[0]) > weaponDps(c.weapon)) {
                this.equipWeapon(colonistId, 0);
            }
        }
        if (this.resources.armors.length > 0) {
            this.resources.armors.sort((a, b) => b.damageReduction - a.damageReduction);
            if (!c.armor || this.resources.armors[0].damageReduction > c.armor.damageReduction) {
                this.equipArmor(colonistId, 0);
            }
        }
        if (this.resources.helmets.length > 0) {
            this.resources.helmets.sort((a, b) => b.damageReduction - a.damageReduction);
            if (!c.helmet || this.resources.helmets[0].damageReduction > c.helmet.damageReduction) {
                this.equipHelmet(colonistId, 0);
            }
        }
        if (this.resources.tools.length > 0 && !c.tool) {
            this.equipTool(colonistId, 0);
        }
        if (this.resources.artifacts.length > 0 && !c.artifact) {
            this.equipArtifact(colonistId, 0);
        }
        this.ui.showColonistInfo(c);
    }

    tameWildAnimal(animalId) {
        designateTame(this, animalId);
    }

    craftGolem(golemType) {
        if (!this.research.isResearched('golem_craft')) return;
        const def = GOLEM_TYPES[golemType];
        if (!def) return;
        if (!this.resources.has(def.cost)) {
            this.notifications.push({ text: 'Not enough resources for golem', tick: this.tick, type: 'warning' });
            return;
        }
        this.resources.deduct(def.cost);
        const forge = this.findBuilding('golem_forge');
        const x = forge ? forge.x : this.colonists[0]?.x || 128;
        const y = forge ? forge.y : this.colonists[0]?.y || 128;
        const golem = createGolem(golemType, x, y);
        this.addColonist(golem);
        this.notifications.push({ text: `${def.name} animated!`, tick: this.tick, type: 'success' });
        this.eventLog.add(this, `Crafted a ${def.name}`, 'success', { type: 'position', x, y });
        this.combatEffects.push({ x, y, char: COMBAT_VISUALS.golemActivateChar, color: COMBAT_VISUALS.golemActivateColor, ttl: COMBAT_VISUALS.golemActivateTtl });
        window.soundManager?.playSFX('golem_activate');
    }

    findBuilding(type) {
        return this.mapIndex.findFirst(type);
    }

    logEvent(text, type, linkedEntity) {
        this.eventLog.add(this, text, type, linkedEntity);
    }

    jumpToEntity(entityType, entityId) {
        if (entityType === 'colonist') {
            const c = this.getColonist(entityId);
            if (c) {
                this.camera.centerOn(c.x, c.y);
                this.selectedColonist = c;
                this.ui.showColonistInfo(c);
            }
        } else if (entityType === 'position') {
            this.camera.centerOn(entityId.x, entityId.y);
        }
    }

    saveSettingsToStorage() {
        try { localStorage.setItem('colony_settings', JSON.stringify(this.settings)); } catch (e) {}
    }

    save() {
        if (saveGame(this)) {
            this.notifications.push({ text: 'Game saved!', tick: this.tick, type: 'success' });
        }
    }

    load() {
        if (loadGame(this)) {
            this.notifications.push({ text: 'Game loaded!', tick: this.tick, type: 'success' });
            this.ui.updateModeDisplay(this.input);
            if (this.settings.layoutMode && this.settings.layoutMode !== 'auto') {
                this.setLayoutMode(this.settings.layoutMode);
            }
        }
    }

    exportSave() {
        this.save();
        if (exportSave()) {
            this.notifications.push({ text: 'Save exported!', tick: this.tick, type: 'success' });
        }
    }

    cheatResources() {
        for (const key of Object.keys(this.resources.stockpile)) {
            this.resources.stockpile[key] = 999;
        }
        this.notifications.push({ text: '[DEBUG] 999 of all resources granted', tick: this.tick, type: 'success' });
    }

    cheatGrantResearch() {
        for (const key of Object.keys(RESEARCH)) {
            this.research.completed.add(key);
        }
        this.research.activeResearch = null;
        this.research.progress = {};
        this.notifications.push({ text: '[DEBUG] All research completed', tick: this.tick, type: 'success' });
    }

    cheatGrantStarterSpells() {
        const starterSpells = Object.entries(SPELLS)
            .filter(([, spell]) => spell.minLevel === 0)
            .map(([key]) => key);
        let count = 0;
        for (const c of this.colonists) {
            if (c.golem || c.hp <= 0) continue;
            if (!c.knownSpells) c.knownSpells = [];
            for (const spellKey of starterSpells) {
                if (!c.knownSpells.includes(spellKey)) {
                    c.knownSpells.push(spellKey);
                }
            }
            for (const school of Object.keys(c.magicSkills || {})) {
                if (c.magicSkills[school] < 1) c.magicSkills[school] = 1;
            }
            count++;
        }
        this.notifications.push({ text: `[DEBUG] ${count} colonists granted ${starterSpells.length} starter spells + magic skills set to 1`, tick: this.tick, type: 'success' });
    }

    cheatSpawnItem(category, key) {
        const def = ALL_ITEMS[key];
        if (!def || def.type !== category) return;
        this.resources.addItem({ ...def, key });
        this.notifications.push({ text: `[DEBUG] Granted ${category}: ${def.name}`, tick: this.tick, type: 'success' });
    }

    cheatAddResource(key, amount) {
        this.resources.add({ [key]: amount });
        this.notifications.push({ text: `[DEBUG] Granted ${amount} ${key}`, tick: this.tick, type: 'success' });
    }

    cheatSpawnColonist() {
        const skillKeys = Object.keys(SKILLS);
        const bias = skillKeys[Math.floor(Math.random() * skillKeys.length)];
        const existingNames = this.colonists.map(c => c.name);
        const edge = { x: Math.floor(CONFIG.MAP_WIDTH / 2), y: Math.floor(CONFIG.MAP_HEIGHT / 2) };
        const c = createColonist(edge.x, edge.y, bias, existingNames);
        this.addColonist(c);
        this.notifications.push({ text: `[DEBUG] Granted colonist: ${c.name} (${bias})`, tick: this.tick, type: 'success' });
    }

    cheatTriggerEvent(eventKey) {
        this.events.triggerEvent(eventKey, this);
        this.notifications.push({ text: `[DEBUG] Triggered event: ${eventKey}`, tick: this.tick, type: 'success' });
    }

    cheatAdvanceTime(ticks) {
        this.tick += ticks;
        this.notifications.push({ text: `[DEBUG] Advanced ${ticks} ticks`, tick: this.tick, type: 'success' });
    }

    // Phase 6 perf investigation: attach an opt-in profiler and auto-report every
    // `reportEvery` ticks. Zero cost until this is called (hot paths guard on
    // this._profiler). See js/core/perf-probe.js for the console usage.
    startPerfProbe(reportEvery = 200) {
        this._profiler = new TickProfiler();
        this._profilerReportEvery = Math.max(1, reportEvery | 0);
        this.notifications.push({ text: `[PERF] Probe started (report every ${this._profilerReportEvery} ticks)`, tick: this.tick, type: 'info' });
        return this._profiler;
    }

    stopPerfProbe() {
        if (!this._profiler) return null;
        const snap = this._profiler.report();
        this._profiler = null;
        this.notifications.push({ text: '[PERF] Probe stopped', tick: this.tick, type: 'info' });
        return snap;
    }
}

function applyAuraToColonists(game, pedestal, radius, centerX, centerY, auraLabel) {
    // Query the colonist spatial hash (rebuilt every tick) for a cell-granular
    // superset, then keep the exact manhattan-radius filter. The 'global' radius
    // case is handled by the caller with a full colonist loop.
    for (const c of game.spatial.colonists.query(centerX, centerY, radius)) {
        if (c.hp <= 0) continue;
        if (manhattanDist(c.x, c.y, centerX, centerY) > radius) continue;
        if (pedestal.workSpeedBonus) c.pedestalWorkBonus += pedestal.workSpeedBonus;
        if (pedestal.damageBonusMult) c.pedestalDamageBonus *= pedestal.damageBonusMult;
        if (pedestal.skillGrowthBonus) c.pedestalSkillBonus += pedestal.skillGrowthBonus;
        c.activeAuras.push(auraLabel);
    }
}

function applyBlightImmunity(game, radius, centerX, centerY) {
    const mapHeight = game.map.length;
    const mapWidth = game.map[0].length;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > radius) continue;
            const ty = centerY + dy, tx = centerX + dx;
            if (ty < 0 || ty >= mapHeight || tx < 0 || tx >= mapWidth) continue;
            const cropTile = game.map[ty][tx];
            if (cropTile.crop) cropTile.blightImmune = true;
        }
    }
}

function updatePedestals(game, structurePositions = game.mapIndex.getAllStructurePositions()) {
    const pedestals = structurePositions.filter(({ x, y }) => {
        const tile = game.map[y][x];
        return tile.structure === 'artifact_pedestal' && tile.pedestalArtifact;
    });
    for (const { x, y } of pedestals) {
        const tile = game.map[y][x];
        const def = ARTIFACTS[tile.pedestalArtifact];
        if (!def?.pedestal) continue;
        const mana = def.pedestal.manaCost || 0;
        if (mana > 0 && !game.power.hasPower()) {
            tile.pedestalInactive = true;
            continue;
        }
        tile.pedestalInactive = false;
        const auraLabel = { name: def.name, key: tile.pedestalArtifact, sourceType: 'pedestal', x, y };
        if (def.pedestal.radius === 'global') {
            for (const c of game.colonists) {
                if (c.hp > 0) c.activeAuras.push(auraLabel);
            }
            continue;
        }
        const radius = def.pedestal.radius;
        applyAuraToColonists(game, def.pedestal, radius, x, y, auraLabel);
        if (def.pedestal.blightImmunity) applyBlightImmunity(game, radius, x, y);
    }

    for (const carrier of game.colonists) {
        if (carrier.hp <= 0 || carrier.artifactBroken || carrier.onExpedition) continue;
        const art = carrier.artifact;
        if (!art?.pedestal) continue;
        if (art.pedestal.radius === 'global' || typeof art.pedestal.radius !== 'number') continue;
        const radius = art.pedestal.radius;
        const auraLabel = { name: art.name, key: art.key, sourceType: 'colonist', colonistId: carrier.id };
        applyAuraToColonists(game, art.pedestal, radius, carrier.x, carrier.y, auraLabel);
        if (art.pedestal.blightImmunity) applyBlightImmunity(game, radius, carrier.x, carrier.y);
    }
}

const CHAR_RATIO = 0.6;
const LINE_HEIGHT = 1.15;
const MIN_FONT = 5;
const MAX_FONT = 48;
const ZOOM_STEP = 2;

let currentZoomFont = null;

function fitGameFont() {
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    const availWidth = gameArea.clientWidth - 4;
    const availHeight = gameArea.clientHeight - 4;

    if (currentZoomFont === null) {
        const layoutMode = window.game?.settings?.layoutMode || 'auto';
        const isSmall = layoutMode === 'tabbed' || (layoutMode === 'auto' && window.innerWidth <= 768);
        currentZoomFont = isSmall ? 8 : 14;
    }

    const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, currentZoomFont));
    currentZoomFont = fontSize;

    const cellSize = fontSize * LINE_HEIGHT;
    CONFIG.VIEWPORT_WIDTH = Math.max(20, Math.floor(availWidth / cellSize));
    CONFIG.VIEWPORT_HEIGHT = Math.max(10, Math.floor(availHeight / cellSize));

    document.documentElement.style.setProperty('--game-font-size', fontSize + 'px');

    if (window.game?.renderer) {
        window.game.renderer.measureFont(fontSize);
    }
    if (window.game?.input) {
        window.game.input.measureCharSize();
    }
    if (window.game?.camera) {
        window.game.camera.clamp();
    }
}

function zoomIn() {
    if (currentZoomFont === null) currentZoomFont = 14;
    currentZoomFont = Math.min(MAX_FONT, currentZoomFont + ZOOM_STEP);
    fitGameFont();
}

function zoomOut() {
    if (currentZoomFont === null) currentZoomFont = 14;
    currentZoomFont = Math.max(MIN_FONT, currentZoomFont - ZOOM_STEP);
    fitGameFont();
}

window.zoomIn = zoomIn;
window.zoomOut = zoomOut;

function resetMinimapSize() {
    const container = document.getElementById('minimap-container');
    const canvas = document.getElementById('minimap');
    const controls = document.getElementById('minimap-controls');
    if (!container || !canvas || !controls) return;

    const footerContent = document.getElementById('footer-content');
    const availHeight = footerContent.clientHeight - 10;
    const aspect = canvas.width / canvas.height;
    const fittedWidth = Math.ceil(availHeight * aspect);
    const minWidth = controls.offsetWidth + 14;
    const controlsWidth = controls.offsetWidth + 4 + 10;

    const totalWidth = footerContent.clientWidth;
    const resizeHandles = footerContent.querySelectorAll('.footer-panel-resize');
    const handleSpace = resizeHandles.length * 5;
    const panels = footerContent.querySelectorAll('.footer-panel');
    const gapTotal = 4 * (footerContent.children.length - 1);
    const minPanelSpace = panels.length * 60;
    const maxWidth = totalWidth - minPanelSpace - handleSpace - gapTotal;

    const idealWidth = Math.max(minWidth, Math.min(maxWidth, fittedWidth + controlsWidth));

    container.style.flex = `0 0 ${idealWidth}px`;
}

window.resetMinimapSize = resetMinimapSize;

function setUIFontSize(size) {
    document.documentElement.style.setProperty('--ui-font-size', size + 'px');
    const label = document.getElementById('ui-font-size-val');
    if (label) label.textContent = size + 'px';
    window.resetMinimapSize?.();
}

window.setUIFontSize = setUIFontSize;

function initFooterTabs() {
    const footer = document.getElementById('game-footer');
    const container = document.getElementById('game-container');
    const infoPanel = document.getElementById('info-panel');
    const footerContent = document.getElementById('footer-content');

    if (window.innerWidth <= 768) {
        container.classList.add('tabbed-mode');
        footerContent.insertBefore(infoPanel, footerContent.firstChild);
        infoPanel.classList.add('active');
        footer.querySelector('.footer-tab[data-tab="info"]').classList.add('active');
    }

    footer.addEventListener('transitionend', () => fitGameFont());

    footer.addEventListener('click', (e) => {
        const tab = e.target.closest('.footer-tab[data-tab]');
        if (!tab) return;

        const target = tab.dataset.tab;


        const isTabbed = footer.classList.contains('tabbed') || window.innerWidth <= 768;
        if (!isTabbed) return;

        if (footer.classList.contains('collapsed')) {
            footer.classList.remove('collapsed');
        }

        const tabs = footer.querySelectorAll('.footer-tab[data-tab]');
        const panels = footer.querySelectorAll('#footer-content > .footer-panel, #minimap-container');
        tabs.forEach(t => {
            if (t.dataset.tab !== 'collapse') t.classList.remove('active');
        });
        tab.classList.add('active');
        panels.forEach(p => p.classList.remove('active'));

        if (target === 'info') {
            infoPanel.classList.add('active');
        } else if (target === 'colonists') {
            document.getElementById('colonist-hud').classList.add('active');
        } else if (target === 'log') {
            document.getElementById('event-log').classList.add('active');
        } else if (target === 'minimap') {
            document.getElementById('minimap-container').classList.add('active');
        }
    });
}

function setFooterMode(tabbed) {
    const footer = document.getElementById('game-footer');
    const container = document.getElementById('game-container');
    const infoPanel = document.getElementById('info-panel');
    const footerContent = document.getElementById('footer-content');

    if (tabbed) {
        footer.classList.add('tabbed');
        container.classList.add('tabbed-mode');
        footerContent.insertBefore(infoPanel, footerContent.firstChild);
        const panels = footer.querySelectorAll('#footer-content > .footer-panel, #minimap-container');
        panels.forEach(p => p.classList.remove('active'));
        infoPanel.classList.add('active');
        const tabs = footer.querySelectorAll('.footer-tab[data-tab]');
        tabs.forEach(t => { if (t.dataset.tab !== 'collapse') t.classList.remove('active'); });
        footer.querySelector('.footer-tab[data-tab="info"]').classList.add('active');
    } else {
        footer.classList.remove('tabbed');
        container.classList.remove('tabbed-mode');
        container.insertBefore(infoPanel, footer);
        infoPanel.classList.remove('active');
    }
    fitGameFont();
}

window.setFooterMode = setFooterMode;

function initPanelOverlay() {
    const overlay = document.getElementById('panel-overlay');
    overlay.addEventListener('click', () => {
        if (!window.game?.ui) return;
        const ui = window.game.ui;
        if (ui.priorityPanelVisible) ui.togglePriorityPanel();
        if (ui.craftPanelVisible) ui.toggleCraftPanel();
        if (ui.researchPanelVisible) ui.toggleResearchPanel();
        if (ui.inventoryVisible) ui.toggleInventoryPanel();
        if (ui.settingsPanelVisible) ui.toggleSettingsPanel();
        if (ui.storyPanelVisible) ui.toggleStoryPanel();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const settingsPanel = document.getElementById('start-settings-panel');
    const loadBtn = document.getElementById('load-game');
    const exportBtn = document.getElementById('export-game');

    const versionLabel = document.getElementById('version-label');
    if (versionLabel) versionLabel.textContent = `v${GAME_VERSION}`;

    // Shared skin manager — created early so start screen and game use the same instance
    const sharedSkinManager = new SkinManager();
    window._sharedSkinManager = sharedSkinManager;

    // Populate start screen skin dropdown
    const startBgCanvas = document.getElementById('start-bg-canvas');
    let startBgData = null;

    // Dither state for start screen background
    let _startDitherMasks = null;
    let _startDitherSize = 0;
    const _startDitherCache = new Map();
    const START_DITHER_DIRS = [
        { dir: 'north', dx: 0, dy: -1 },
        { dir: 'south', dx: 0, dy: 1 },
        { dir: 'west', dx: -1, dy: 0 },
        { dir: 'east', dx: 1, dy: 0 },
    ];

    function _buildStartDitherMasks(size) {
        const depth = Math.max(1, Math.round(size * RENDER_CONFIG.ditherDepth));
        const bayer = [
            [ 0,  8,  2, 10],
            [12,  4, 14,  6],
            [ 3, 11,  1,  9],
            [15,  7, 13,  5],
        ];
        const masks = {};
        for (const dir of ['north', 'south', 'east', 'west']) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const mctx = canvas.getContext('2d');
            const imageData = mctx.createImageData(size, size);
            const data = imageData.data;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    let edgeDist;
                    if (dir === 'north') edgeDist = y;
                    else if (dir === 'south') edgeDist = (size - 1) - y;
                    else if (dir === 'west') edgeDist = x;
                    else edgeDist = (size - 1) - x;
                    if (edgeDist >= depth) continue;
                    const t = edgeDist / depth;
                    const intensity = 0.5 * (1 - t);
                    const threshold = (bayer[y % 4][x % 4] + 0.5) / 16;
                    if (intensity > threshold) {
                        const idx = (y * size + x) * 4;
                        data[idx] = 255;
                        data[idx + 1] = 255;
                        data[idx + 2] = 255;
                        data[idx + 3] = 255;
                    }
                }
            }
            mctx.putImageData(imageData, 0, 0);
            masks[dir] = canvas;
        }
        _startDitherMasks = masks;
        _startDitherSize = size;
        _startDitherCache.clear();
    }

    function _getStartDitherTile(terrain, dir, tileSize) {
        const key = terrain + ':' + dir;
        if (_startDitherCache.has(key)) return _startDitherCache.get(key);
        const sprite = sharedSkinManager.getSprite('terrain', terrain);
        if (!sprite) { _startDitherCache.set(key, null); return null; }
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const c = canvas.getContext('2d');
        c.drawImage(sprite, 0, 0, tileSize, tileSize);
        c.globalCompositeOperation = 'destination-in';
        c.drawImage(_startDitherMasks[dir], 0, 0, tileSize, tileSize);
        _startDitherCache.set(key, canvas);
        return canvas;
    }

    function renderStartBackground() {
        if (!startBgCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = startBgCanvas.clientWidth;
        const h = startBgCanvas.clientHeight;
        startBgCanvas.width = w * dpr;
        startBgCanvas.height = h * dpr;
        const ctx = startBgCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        if (!startBgData) {
            startBgData = generateStartMap();
        }
        const { map: bgMap, width: mapW, height: mapH } = startBgData;

        const useSpriteMode = sharedSkinManager.isActive;
        const tileSize = useSpriteMode ? 16 : 14;

        if (useSpriteMode) {
            const cols = Math.ceil(w / tileSize);
            const rows = Math.ceil(h / tileSize);
            const offsetX = Math.max(0, Math.floor((mapW - cols) / 2));
            const offsetY = Math.max(0, Math.floor((mapH - rows) / 2));

            ctx.imageSmoothingEnabled = false;
            if (RENDER_CONFIG.terrainDithering && (!_startDitherMasks || _startDitherSize !== tileSize)) {
                _buildStartDitherMasks(tileSize);
            }
            for (let sy = 0; sy < rows; sy++) {
                for (let sx = 0; sx < cols; sx++) {
                    const mx = offsetX + sx;
                    const my = offsetY + sy;
                    if (mx >= mapW || my >= mapH) continue;
                    const tile = bgMap[my][mx];
                    const px = sx * tileSize;
                    const py = sy * tileSize;

                    const groundSprite = sharedSkinManager.getSprite('terrain', tile.terrain);
                    if (groundSprite) ctx.drawImage(groundSprite, px, py, tileSize, tileSize);

                    if (RENDER_CONFIG.terrainDithering && _startDitherMasks && !tile.structure && !tile.floor && !tile.resource) {
                        for (const { dir, dx, dy } of START_DITHER_DIRS) {
                            const nx = mx + dx;
                            const ny = my + dy;
                            if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) continue;
                            const neighbor = bgMap[ny][nx];
                            if (neighbor.terrain === tile.terrain) continue;
                            const cached = _getStartDitherTile(neighbor.terrain, dir, tileSize);
                            if (cached) ctx.drawImage(cached, px, py);
                        }
                    }

                    if (tile.floor) {
                        const floorSprite = sharedSkinManager.getSprite('floors', tile.floor);
                        if (floorSprite) ctx.drawImage(floorSprite, px, py, tileSize, tileSize);
                    }
                    if (tile.structure) {
                        const structSprite = sharedSkinManager.getSprite('buildings', tile.structure);
                        if (structSprite) ctx.drawImage(structSprite, px, py, tileSize, tileSize);
                    }
                    if (tile.resource) {
                        const resSprite = sharedSkinManager.getSprite('resources', tile.resource.type);
                        if (resSprite) ctx.drawImage(resSprite, px, py, tileSize, tileSize);
                    }
                }
            }
        } else {
            const fontSize = RENDER_CONFIG.fontSize;
            const cellSize = Math.ceil(fontSize * RENDER_CONFIG.fontHeightMult);
            const cols = Math.ceil(w / cellSize);
            const rows = Math.ceil(h / cellSize);
            const offsetX = Math.max(0, Math.floor((mapW - cols) / 2));
            const offsetY = Math.max(0, Math.floor((mapH - rows) / 2));

            ctx.font = `${fontSize}px 'Courier New', monospace`;
            ctx.textBaseline = 'top';
            const textWidth = Math.ceil(ctx.measureText('M').width);
            const textOffsetX = Math.floor((cellSize - textWidth) / 2);

            for (let sy = 0; sy < rows; sy++) {
                for (let sx = 0; sx < cols; sx++) {
                    const mx = offsetX + sx;
                    const my = offsetY + sy;
                    if (mx >= mapW || my >= mapH) continue;
                    const tile = bgMap[my][mx];
                    const px = sx * cellSize;
                    const py = sy * cellSize;

                    const bg = getTileBg(tile);
                    if (bg) {
                        ctx.fillStyle = bg;
                        ctx.fillRect(px, py, cellSize, cellSize);
                    }
                    const char = getTileChar(tile, 'summer');
                    ctx.fillStyle = getTileColor(tile, 'summer');
                    if (char === '█' || char === '▓' || char === '▒') {
                        ctx.fillRect(px, py, cellSize, cellSize);
                    } else {
                        ctx.fillText(char, px + textOffsetX, py);
                    }
                }
            }
        }
    }

    const startSkinSelect = document.getElementById('start-skin');
    if (startSkinSelect) {
        const savedSkin = localStorage.getItem('convocation_skin') || '16x16_tiny_world';
        sharedSkinManager.init().then(async () => {
            const names = sharedSkinManager.getSkinNames();
            startSkinSelect.innerHTML = '';
            for (const name of names) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name === 'ascii' ? 'ASCII' : name.charAt(0).toUpperCase() + name.slice(1);
                opt.selected = name === savedSkin;
                startSkinSelect.appendChild(opt);
            }
            if (savedSkin !== 'ascii') {
                await sharedSkinManager.switchSkin(savedSkin);
            }
            renderStartBackground();
        });
        startSkinSelect.addEventListener('change', async () => {
            const skinName = startSkinSelect.value;
            localStorage.setItem('convocation_skin', skinName);
            await sharedSkinManager.switchSkin(skinName);
            _startDitherCache.clear();
            renderStartBackground();
            refreshColonistPanelSprites();
        });
    } else {
        sharedSkinManager.init().then(() => renderStartBackground());
    }
    window.addEventListener('resize', renderStartBackground);

    if (hasSave()) {
        loadBtn.disabled = false;
        exportBtn.disabled = false;
    }

    const glossaryPanel = document.getElementById('glossary-panel');
    const creditsPanel = document.getElementById('credits-panel');
    const changelogPanel = document.getElementById('changelog-panel');
    const devtoolsPanel = document.getElementById('devtools-panel');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const glossaryBody = document.getElementById('glossary-body');
    if (glossaryBody) {
        glossaryBody.innerHTML = renderGlossaryHTML();
        initGlossaryInteraction();
    }
    const creditsBody = document.getElementById('credits-body');
    if (creditsBody) {
        creditsBody.innerHTML = renderCreditsHTML();
    }
    const changelogBody = document.getElementById('changelog-body');
    if (changelogBody) {
        changelogBody.innerHTML = renderChangelogHTML();
        initChangelogInteraction();
    }

    function closeModals() {
        settingsPanel.style.display = 'none';
        glossaryPanel.style.display = 'none';
        creditsPanel.style.display = 'none';
        changelogPanel.style.display = 'none';
        devtoolsPanel.style.display = 'none';
        const colonistsPanelEl = document.getElementById('colonists-panel');
        if (colonistsPanelEl) colonistsPanelEl.style.display = 'none';
        modalBackdrop.style.display = 'none';
    }

    document.getElementById('start-settings').addEventListener('click', () => {
        const opening = settingsPanel.style.display === 'none';
        closeModals();
        if (opening) {
            loadStartSettings();
            settingsPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    document.getElementById('start-glossary').addEventListener('click', () => {
        const opening = glossaryPanel.style.display === 'none';
        closeModals();
        if (opening) {
            glossaryPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    document.getElementById('start-credits').addEventListener('click', () => {
        const opening = creditsPanel.style.display === 'none';
        closeModals();
        if (opening) {
            creditsPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    document.getElementById('start-changelog').addEventListener('click', () => {
        const opening = changelogPanel.style.display === 'none';
        closeModals();
        if (opening) {
            changelogPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    document.getElementById('start-devtools').addEventListener('click', () => {
        const opening = devtoolsPanel.style.display === 'none';
        closeModals();
        if (opening) {
            devtoolsPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    // ── Colonist Customization Panel ─────────────────────────────────────────

    const colonistsPanel = document.getElementById('colonists-panel');
    const colonistSlotsContainer = document.getElementById('colonist-slots-container');

    const SKILL_POINT_TOTAL = 18;
    const SKILL_MAX = 8;
    const TRAIT_VALUE_BUDGET = 3;
    const MAX_TRAITS = 3;

    const COLONIST_SLOTS_KEY = 'convocation_colonist_slots';

    function saveColonistSlots() {
        try {
            localStorage.setItem(COLONIST_SLOTS_KEY, JSON.stringify(colonistSlotStates));
        } catch (e) {}
    }

    function loadColonistSlots() {
        try {
            const saved = JSON.parse(localStorage.getItem(COLONIST_SLOTS_KEY));
            if (!Array.isArray(saved) || saved.length !== 3) return;
            for (let i = 0; i < 3; i++) {
                const s = saved[i];
                if (!s || typeof s !== 'object') continue;
                colonistSlotStates[i].custom = !!s.custom;
                colonistSlotStates[i].name = typeof s.name === 'string' ? s.name : '';
                colonistSlotStates[i].skills = (s.skills && typeof s.skills === 'object') ? { ...s.skills } : {};
                colonistSlotStates[i].traits = Array.isArray(s.traits) ? s.traits.filter(t => TRAITS[t]) : [];
                colonistSlotStates[i].bodyVariant = typeof s.bodyVariant === 'number' ? s.bodyVariant : null;
                colonistSlotStates[i].hairVariant = typeof s.hairVariant === 'number' ? s.hairVariant : null;
                colonistSlotStates[i].shirtVariant = typeof s.shirtVariant === 'number' ? s.shirtVariant : null;
                colonistSlotStates[i].nameColor = typeof s.nameColor === 'string' ? s.nameColor : null;
            }
        } catch (e) {}
    }

    // Holds the 3 slot states. bodyVariant/hairVariant/shirtVariant are explicit
    // appearance choices (null = random at spawn). nameColor is both the ASCII '@'
    // color and the shirt tint color.
    const colonistSlotStates = [
        { custom: false, name: '', skills: {}, traits: [], bodyVariant: null, hairVariant: null, shirtVariant: null, nameColor: null },
        { custom: false, name: '', skills: {}, traits: [], bodyVariant: null, hairVariant: null, shirtVariant: null, nameColor: null },
        { custom: false, name: '', skills: {}, traits: [], bodyVariant: null, hairVariant: null, shirtVariant: null, nameColor: null },
    ];
    loadColonistSlots();

    function initSlotState(idx) {
        const state = colonistSlotStates[idx];
        const skills = {};
        for (const key of Object.keys(SKILLS)) skills[key] = 2;
        state.skills = skills;
        state.traits = [];
        if (!state.name) {
            state.name = COLONIST_NAMES[idx % COLONIST_NAMES.length] || `Colonist ${idx + 1}`;
        }
    }

    function getSlotTraitValueSum(state) {
        return state.traits.reduce((sum, t) => sum + (TRAITS[t]?.value || 0), 0);
    }

    function getSlotSkillSum(state) {
        return Object.values(state.skills).reduce((s, v) => s + v, 0);
    }

    const COLONIST_COLORS = ['#ff3300', '#00ff00', '#00ffff', '#ffff00', '#a600ff', '#ababab'];

    function renderSlotSprite(canvas, slotIdx, state) {
        const size = canvas.width;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        const color = (state && state.nameColor) || COLONIST_COLORS[slotIdx % COLONIST_COLORS.length];
        if (sharedSkinManager.isActive) {
            const sprite = sharedSkinManager.getColonistSprite(
                slotIdx + 1, false,
                state?.bodyVariant, state?.hairVariant, state?.shirtVariant, color
            );
            if (sprite) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sprite, 0, 0, size, size);
                return;
            }
        }
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.floor(size * 0.65)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('@', size / 2, size / 2);
    }

    function renderSlotName(el, state, slotIdx) {
        const color = (state && state.nameColor) || COLONIST_COLORS[slotIdx % COLONIST_COLORS.length];
        const name = (state && state.name) || `Colonist ${slotIdx + 1}`;
        el.textContent = name;
        el.style.color = color;
        el.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    }

    function buildColonistSlotHTML(idx) {
        const state = colonistSlotStates[idx];
        const slotEl = document.createElement('div');
        slotEl.id = `colonist-slot-${idx}`;
        slotEl.style.cssText = 'flex:1; min-width:200px; max-width:220px; border:1px solid #444; border-radius:6px; padding:10px; background:#151528; display:flex; flex-direction:column;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:8px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `slot-custom-${idx}`;
        checkbox.checked = state.custom;
        checkbox.style.cssText = 'cursor:pointer; margin:0;';

        const label = document.createElement('label');
        label.htmlFor = `slot-custom-${idx}`;
        label.textContent = `Colonist ${idx + 1}`;
        label.style.cssText = 'color:#ffcc00; font-weight:bold; cursor:pointer; flex:1;';

        header.appendChild(checkbox);
        header.appendChild(label);
        slotEl.appendChild(header);

        // Random preview (shown when not custom)
        const randomView = document.createElement('div');
        randomView.id = `slot-random-${idx}`;
        randomView.style.cssText = 'text-align:center; padding:12px 0; display:' + (state.custom ? 'none' : 'block') + ';';
        const randomCanvas = document.createElement('canvas');
        randomCanvas.width = 48;
        randomCanvas.height = 48;
        randomCanvas.style.cssText = 'display:block; margin:0 auto; image-rendering:pixelated;';
        const randomHint = document.createElement('div');
        randomHint.style.cssText = 'font-size:11px; color:#666; margin-top:6px;';
        randomHint.textContent = 'Random';
        randomView.appendChild(randomCanvas);
        randomView.appendChild(randomHint);
        // Draw the ? fallback immediately; sprite may not exist
        (function() {
            const ctx = randomCanvas.getContext('2d');
            ctx.fillStyle = '#777';
            ctx.font = 'bold 32px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 24, 24);
        })();
        slotEl.appendChild(randomView);

        // Custom editor (shown when custom)
        const customView = document.createElement('div');
        customView.id = `slot-custom-view-${idx}`;
        customView.style.display = state.custom ? 'block' : 'none';
        customView.style.flex = '1';
        slotEl.appendChild(customView);

        // Swap arrow row — sits below the card content
        const arrowRow = document.createElement('div');
        arrowRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:4px;';
        const leftArrow = document.createElement('button');
        leftArrow.textContent = '◀';
        leftArrow.title = 'Shift left';
        leftArrow.style.cssText = 'flex:1; padding:3px 0; background:#2a2a40; border:1px solid #444; color:#ccc; border-radius:3px; cursor:pointer; font-size:11px;';
        leftArrow.disabled = idx === 0;
        leftArrow.style.opacity = idx === 0 ? '0.3' : '1';
        const rightArrow = document.createElement('button');
        rightArrow.textContent = '▶';
        rightArrow.title = 'Shift right';
        rightArrow.style.cssText = 'flex:1; padding:3px 0; background:#2a2a40; border:1px solid #444; color:#ccc; border-radius:3px; cursor:pointer; font-size:11px;';
        rightArrow.disabled = idx === colonistSlotStates.length - 1;
        rightArrow.style.opacity = idx === colonistSlotStates.length - 1 ? '0.3' : '1';
        leftArrow.addEventListener('click', () => {
            if (idx === 0) return;
            [colonistSlotStates[idx - 1], colonistSlotStates[idx]] = [colonistSlotStates[idx], colonistSlotStates[idx - 1]];
            buildColonistSlotsPanel();
        });
        rightArrow.addEventListener('click', () => {
            if (idx === colonistSlotStates.length - 1) return;
            [colonistSlotStates[idx], colonistSlotStates[idx + 1]] = [colonistSlotStates[idx + 1], colonistSlotStates[idx]];
            buildColonistSlotsPanel();
        });
        arrowRow.appendChild(leftArrow);
        arrowRow.appendChild(rightArrow);
        slotEl.appendChild(arrowRow);

        const mkTile = (selected) => {
            const t = document.createElement('div');
            t.style.cssText = 'width:26px; height:26px; border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:2px solid ' + (selected ? '#ffcc00' : '#444') + ';';
            return t;
        };

        // Build a single variant row (body, hair, or shirt) into `grid`.
        // `field` is 'bodyVariant' | 'hairVariant' | 'shirtVariant'.
        // `count` is the sprite count from the active skin pack.
        // `getSpriteForVariant(v)` returns the sprite to preview (or null).
        function rebuildVariantRow(grid, previewCanvas, field, count, getSpriteForVariant) {
            grid.innerHTML = '';

            const randomTile = mkTile(state[field] == null);
            randomTile.title = 'Random';
            randomTile.style.cssText += ' background:#1a1a2e; color:#888; font-size:14px;';
            randomTile.textContent = '?';
            randomTile.addEventListener('click', () => {
                state[field] = null;
                renderSlotSprite(previewCanvas, idx, state);
                grid.querySelectorAll('div').forEach((t, i) => {
                    t.style.borderColor = i === 0 ? '#ffcc00' : '#444';
                });
                saveColonistSlots();
            });
            grid.appendChild(randomTile);

            for (let v = 1; v <= count; v++) {
                const selected = state[field] === v;
                const tile = mkTile(selected);
                tile.style.background = '#0d0d1a';
                const cv = document.createElement('canvas');
                cv.width = 22; cv.height = 22;
                cv.style.cssText = 'image-rendering:pixelated;';
                const sprite = getSpriteForVariant(v);
                if (sprite) {
                    const cctx = cv.getContext('2d');
                    cctx.imageSmoothingEnabled = false;
                    cctx.drawImage(sprite, 0, 0, 22, 22);
                }
                tile.appendChild(cv);
                tile.addEventListener('click', () => {
                    state[field] = v;
                    renderSlotSprite(previewCanvas, idx, state);
                    rebuildVariantRow(grid, previewCanvas, field, count, getSpriteForVariant);
                    saveColonistSlots();
                });
                grid.appendChild(tile);
            }
        }

        function rebuildAppearancePickers(container, previewCanvas, nameEl) {
            container.innerHTML = '';
            const usingSprites = sharedSkinManager.isActive;
            const color = state.nameColor || COLONIST_COLORS[idx % COLONIST_COLORS.length];

            // Color picker — always shown; drives both name color and shirt tint
            const colorRow = document.createElement('div');
            colorRow.style.cssText = 'margin-bottom:6px;';
            const colorLabel = document.createElement('div');
            colorLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:3px;';
            colorLabel.textContent = 'Name & Clothing Color';
            colorRow.appendChild(colorLabel);
            const colorInputRow = document.createElement('div');
            colorInputRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = color;
            colorInput.style.cssText = 'width:44px; height:28px; padding:0; border:1px solid #555; border-radius:3px; background:none; cursor:pointer;';
            colorInput.title = 'Choose name & clothing color';
            // 'input' fires on every drag — only update the live preview, no DOM rebuild.
            colorInput.addEventListener('input', () => {
                state.nameColor = colorInput.value;
                renderSlotSprite(previewCanvas, idx, state);
                if (nameEl) renderSlotName(nameEl, state, idx);
            });
            // 'change' fires when the picker closes — rebuild shirt thumbnails and save.
            colorInput.addEventListener('change', () => {
                state.nameColor = colorInput.value;
                renderSlotSprite(previewCanvas, idx, state);
                if (nameEl) renderSlotName(nameEl, state, idx);
                if (usingSprites) rebuildAppearancePickers(container, previewCanvas, nameEl);
                saveColonistSlots();
            });
            const colorHint = document.createElement('div');
            colorHint.style.cssText = 'font-size:10px; color:#666; line-height:1.3;';
            colorHint.textContent = 'Sets both the name color\nand shirt color in game';
            colorHint.style.whiteSpace = 'pre-line';
            colorInputRow.appendChild(colorInput);
            colorInputRow.appendChild(colorHint);
            colorRow.appendChild(colorInputRow);
            container.appendChild(colorRow);

            if (!usingSprites) return;

            // Body picker
            const bodyRow = document.createElement('div');
            bodyRow.style.cssText = 'margin-bottom:6px;';
            const bodyLabel = document.createElement('div');
            bodyLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:3px;';
            bodyLabel.textContent = 'Body';
            bodyRow.appendChild(bodyLabel);
            const bodyGrid = document.createElement('div');
            bodyGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
            bodyRow.appendChild(bodyGrid);
            rebuildVariantRow(bodyGrid, previewCanvas, 'bodyVariant', sharedSkinManager.bodyCount,
                v => sharedSkinManager.getColonistSprite(idx + 1, false, v, 1, 1, color));
            container.appendChild(bodyRow);

            // Hair picker
            const hairRow = document.createElement('div');
            hairRow.style.cssText = 'margin-bottom:6px;';
            const hairLabel = document.createElement('div');
            hairLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:3px;';
            hairLabel.textContent = 'Hair';
            hairRow.appendChild(hairLabel);
            const hairGrid = document.createElement('div');
            hairGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
            hairRow.appendChild(hairGrid);
            rebuildVariantRow(hairGrid, previewCanvas, 'hairVariant', sharedSkinManager.hairCount,
                v => sharedSkinManager.getColonistSprite(idx + 1, false, 1, v, 1, color));
            container.appendChild(hairRow);

            // Shirt picker — previews with current color tint
            const shirtRow = document.createElement('div');
            shirtRow.style.cssText = 'margin-bottom:6px;';
            const shirtLabel = document.createElement('div');
            shirtLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:3px;';
            shirtLabel.textContent = 'Shirt';
            shirtRow.appendChild(shirtLabel);
            const shirtGrid = document.createElement('div');
            shirtGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
            shirtRow.appendChild(shirtGrid);
            rebuildVariantRow(shirtGrid, previewCanvas, 'shirtVariant', sharedSkinManager.shirtCount,
                v => sharedSkinManager.getColonistSprite(idx + 1, false, 1, 1, v, color));
            container.appendChild(shirtRow);
        }

        function rebuildCustomView() {
            customView.innerHTML = '';

            // Sprite preview at top of custom view, with colored name above it
            const spriteRow = document.createElement('div');
            spriteRow.style.cssText = 'text-align:center; margin-bottom:8px; background:#ffffff; border:1px solid #ccc; border-radius:6px; padding:10px;';
            const nameDisplay = document.createElement('div');
            nameDisplay.dataset.slotName = idx;
            nameDisplay.style.cssText = 'font-size:12px; font-weight:bold; margin-bottom:4px; font-family:monospace; min-height:16px;';
            renderSlotName(nameDisplay, state, idx);
            const spriteCanvas = document.createElement('canvas');
            spriteCanvas.width = 48;
            spriteCanvas.height = 48;
            spriteCanvas.style.cssText = 'display:block; margin:0 auto; image-rendering:pixelated;';
            spriteCanvas.dataset.slotSprite = idx;
            renderSlotSprite(spriteCanvas, idx, state);
            spriteRow.appendChild(nameDisplay);
            spriteRow.appendChild(spriteCanvas);
            customView.appendChild(spriteRow);

            // Appearance pickers (color + body/hair/shirt when a sprite pack is active)
            const appearanceSection = document.createElement('div');
            appearanceSection.style.cssText = 'margin-bottom:8px;';
            const appearanceLabel = document.createElement('div');
            appearanceLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:3px;';
            appearanceLabel.textContent = 'Appearance';
            appearanceSection.appendChild(appearanceLabel);
            const appearanceContainer = document.createElement('div');
            appearanceContainer.dataset.slotAppearance = idx;
            appearanceSection.appendChild(appearanceContainer);
            rebuildAppearancePickers(appearanceContainer, spriteCanvas, nameDisplay);
            customView.appendChild(appearanceSection);

            // Name
            const nameRow = document.createElement('div');
            nameRow.style.cssText = 'margin-bottom:8px;';
            const nameLabel = document.createElement('div');
            nameLabel.textContent = 'Name';
            nameLabel.style.cssText = 'font-size:10px; color:#888; margin-bottom:2px;';
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = state.name;
            nameInput.maxLength = 20;
            nameInput.style.cssText = 'width:100%; box-sizing:border-box; background:#1a1a2e; color:#ccc; border:1px solid #444; border-radius:3px; padding:3px 5px; font-family:inherit; font-size:11px;';
            nameInput.addEventListener('input', () => {
                state.name = nameInput.value.trim() || `Colonist ${idx + 1}`;
                renderSlotName(nameDisplay, state, idx);
                saveColonistSlots();
            });
            nameRow.appendChild(nameLabel);
            nameRow.appendChild(nameInput);
            customView.appendChild(nameRow);

            // Skills
            const skillsSection = document.createElement('div');
            skillsSection.style.cssText = 'margin-bottom:8px;';
            const skillsHeader = document.createElement('div');
            skillsHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
            const skillsLabel = document.createElement('div');
            skillsLabel.textContent = 'Skills';
            skillsLabel.style.cssText = 'font-size:10px; color:#888;';
            const skillsCount = document.createElement('div');
            skillsCount.id = `slot-skill-count-${idx}`;
            skillsCount.style.cssText = 'font-size:10px; color:#aaa;';
            skillsCount.textContent = `${getSlotSkillSum(state)} / ${SKILL_POINT_TOTAL}`;
            skillsHeader.appendChild(skillsLabel);
            skillsHeader.appendChild(skillsCount);
            skillsSection.appendChild(skillsHeader);

            for (const [skillKey, skillDef] of Object.entries(SKILLS)) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:3px;';
                const sLabel = document.createElement('div');
                sLabel.textContent = skillDef.name;
                sLabel.style.cssText = 'font-size:10px; color:#ccc; flex:1; min-width:0;';
                const decBtn = document.createElement('button');
                decBtn.textContent = '-';
                decBtn.style.cssText = 'width:18px; height:18px; padding:0; font-size:12px; line-height:1; background:#2a2a40; border:1px solid #444; color:#ccc; border-radius:2px; cursor:pointer; flex-shrink:0;';
                const valEl = document.createElement('div');
                valEl.style.cssText = 'width:18px; text-align:center; font-size:11px; color:#fff; flex-shrink:0;';
                valEl.textContent = state.skills[skillKey];
                const incBtn = document.createElement('button');
                incBtn.textContent = '+';
                incBtn.style.cssText = 'width:18px; height:18px; padding:0; font-size:12px; line-height:1; background:#2a2a40; border:1px solid #444; color:#ccc; border-radius:2px; cursor:pointer; flex-shrink:0;';

                decBtn.addEventListener('click', () => {
                    const minBase = SKILLS[skillKey].baseLevel[0];
                    if (state.skills[skillKey] > minBase) {
                        state.skills[skillKey]--;
                        valEl.textContent = state.skills[skillKey];
                        skillsCount.textContent = `${getSlotSkillSum(state)} / ${SKILL_POINT_TOTAL}`;
                        incBtn.disabled = false;
                        saveColonistSlots();
                    }
                    decBtn.disabled = state.skills[skillKey] <= minBase;
                });
                incBtn.addEventListener('click', () => {
                    const remaining = SKILL_POINT_TOTAL - getSlotSkillSum(state);
                    if (remaining > 0 && state.skills[skillKey] < SKILL_MAX) {
                        state.skills[skillKey]++;
                        valEl.textContent = state.skills[skillKey];
                        skillsCount.textContent = `${getSlotSkillSum(state)} / ${SKILL_POINT_TOTAL}`;
                        decBtn.disabled = false;
                        saveColonistSlots();
                    }
                    incBtn.disabled = (SKILL_POINT_TOTAL - getSlotSkillSum(state)) <= 0 || state.skills[skillKey] >= SKILL_MAX;
                });
                decBtn.disabled = state.skills[skillKey] <= SKILLS[skillKey].baseLevel[0];
                incBtn.disabled = (SKILL_POINT_TOTAL - getSlotSkillSum(state)) <= 0 || state.skills[skillKey] >= SKILL_MAX;

                row.appendChild(sLabel);
                row.appendChild(decBtn);
                row.appendChild(valEl);
                row.appendChild(incBtn);
                skillsSection.appendChild(row);
            }
            customView.appendChild(skillsSection);

            // Traits
            const traitsSection = document.createElement('div');
            const traitsHeader = document.createElement('div');
            traitsHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
            const traitsLabel = document.createElement('div');
            traitsLabel.textContent = 'Traits';
            traitsLabel.style.cssText = 'font-size:10px; color:#888;';
            const traitsBudget = document.createElement('div');
            traitsBudget.id = `slot-trait-budget-${idx}`;
            traitsBudget.style.cssText = 'font-size:10px; color:#aaa;';
            function updateTraitBudgetDisplay() {
                const used = getSlotTraitValueSum(state);
                traitsBudget.textContent = `${used} / ${TRAIT_VALUE_BUDGET} pts`;
                traitsBudget.style.color = used > TRAIT_VALUE_BUDGET ? '#ff6666' : '#aaa';
            }
            updateTraitBudgetDisplay();
            traitsHeader.appendChild(traitsLabel);
            traitsHeader.appendChild(traitsBudget);
            traitsSection.appendChild(traitsHeader);

            // Selected traits
            const selectedTraitsEl = document.createElement('div');
            selectedTraitsEl.id = `slot-selected-traits-${idx}`;
            selectedTraitsEl.style.cssText = 'display:flex; flex-wrap:wrap; gap:3px; min-height:20px; margin-bottom:4px;';

            function rebuildSelectedTraits() {
                selectedTraitsEl.innerHTML = '';
                for (const traitKey of state.traits) {
                    const def = TRAITS[traitKey];
                    if (!def) continue;
                    const chip = document.createElement('span');
                    const col = def.value > 0 ? '#44cc66' : def.value < 0 ? '#ff6666' : '#888';
                    chip.style.cssText = `background:#1a1a2e; border:1px solid ${col}; border-radius:3px; padding:1px 5px; font-size:10px; color:${col}; cursor:pointer; user-select:none;`;
                    chip.title = def.description || '';
                    chip.textContent = def.name + ' ×';
                    chip.addEventListener('click', () => {
                        state.traits = state.traits.filter(t => t !== traitKey);
                        rebuildSelectedTraits();
                        rebuildTraitPicker();
                        updateTraitBudgetDisplay();
                        saveColonistSlots();
                    });
                    selectedTraitsEl.appendChild(chip);
                }
                if (state.traits.length === 0) {
                    const none = document.createElement('span');
                    none.style.cssText = 'font-size:10px; color:#555; font-style:italic;';
                    none.textContent = 'No traits';
                    selectedTraitsEl.appendChild(none);
                }
            }
            rebuildSelectedTraits();
            traitsSection.appendChild(selectedTraitsEl);

            // Trait picker dropdown
            const pickerLabel = document.createElement('div');
            pickerLabel.style.cssText = 'font-size:10px; color:#666; margin-bottom:2px;';
            pickerLabel.textContent = 'Add trait:';
            traitsSection.appendChild(pickerLabel);

            const pickerSelect = document.createElement('select');
            pickerSelect.style.cssText = 'width:100%; background:#1a1a2e; color:#ccc; border:1px solid #444; border-radius:3px; padding:2px 4px; font-family:inherit; font-size:10px;';

            function rebuildTraitPicker() {
                pickerSelect.innerHTML = '';
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = '— select —';
                pickerSelect.appendChild(placeholder);

                const usedBudget = getSlotTraitValueSum(state);
                for (const [key, def] of Object.entries(TRAITS)) {
                    if (state.traits.includes(key)) continue;
                    if (state.traits.length >= MAX_TRAITS) continue;
                    // Check exclusions
                    const excluded = TRAIT_EXCLUSIONS.some(pair => pair.includes(key) && state.traits.some(t => pair.includes(t)));
                    if (excluded) continue;
                    // Check if adding this would exceed budget (only block strictly positive cost traits)
                    const newBudget = usedBudget + def.value;
                    if (newBudget > TRAIT_VALUE_BUDGET) continue;

                    const opt = document.createElement('option');
                    opt.value = key;
                    const sign = def.value > 0 ? `+${def.value}` : `${def.value}`;
                    const valStr = def.value !== 0 ? ` (${sign})` : ' (0)';
                    opt.textContent = `${def.name}${valStr}`;
                    pickerSelect.appendChild(opt);
                }
            }
            rebuildTraitPicker();

            pickerSelect.addEventListener('change', () => {
                const key = pickerSelect.value;
                if (!key) return;
                const def = TRAITS[key];
                if (!def) return;
                const newBudget = getSlotTraitValueSum(state) + def.value;
                if (newBudget > TRAIT_VALUE_BUDGET) return;
                if (state.traits.length >= MAX_TRAITS) return;
                state.traits.push(key);
                pickerSelect.value = '';
                rebuildSelectedTraits();
                rebuildTraitPicker();
                updateTraitBudgetDisplay();
                saveColonistSlots();
            });
            traitsSection.appendChild(pickerSelect);

            customView.appendChild(traitsSection);
        }

        rebuildCustomView();

        // Expose a refresh hook so buildColonistSlotsPanel can update sprites after skin load
        slotEl._refreshSprites = () => {
            renderSlotSprite(randomCanvas, idx, state);
            const sc = customView.querySelector('[data-slot-sprite]');
            if (sc) renderSlotSprite(sc, idx, state);
            // The active pack may have changed — rebuild the appearance pickers.
            const ac = customView.querySelector('[data-slot-appearance]');
            const nd = customView.querySelector('[data-slot-name]');
            if (ac && sc) rebuildAppearancePickers(ac, sc, nd);
        };

        checkbox.addEventListener('change', () => {
            state.custom = checkbox.checked;
            randomView.style.display = state.custom ? 'none' : 'block';
            customView.style.display = state.custom ? 'block' : 'none';
            if (state.custom) {
                initSlotState(idx);
                rebuildCustomView();
            } else {
                renderSlotSprite(randomCanvas, idx, state);
            }
            saveColonistSlots();
        });

        return slotEl;
    }

    function buildColonistSlotsPanel() {
        colonistSlotsContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            colonistSlotsContainer.appendChild(buildColonistSlotHTML(i));
        }
        saveColonistSlots();
    }

    function refreshColonistPanelSprites() {
        if (colonistsPanel.style.display === 'none') return;
        for (const el of colonistSlotsContainer.children) {
            el._refreshSprites?.();
        }
    }

    function readCustomColonistDefs() {
        const result = [];
        let anyCustom = false;
        for (const state of colonistSlotStates) {
            if (state.custom) {
                anyCustom = true;
                result.push({
                    name: state.name,
                    skills: { ...state.skills },
                    traits: [...state.traits],
                    bodyVariant: state.bodyVariant,
                    hairVariant: state.hairVariant,
                    shirtVariant: state.shirtVariant,
                    nameColor: state.nameColor,
                });
            } else {
                result.push(null);
            }
        }
        return anyCustom ? result : null;
    }

    document.getElementById('start-colonists').addEventListener('click', () => {
        const opening = colonistsPanel.style.display === 'none';
        closeModals();
        if (opening) {
            buildColonistSlotsPanel();
            colonistsPanel.style.display = 'block';
            modalBackdrop.style.display = 'block';
        }
    });

    modalBackdrop.addEventListener('click', closeModals);

    function saveStartSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('colony_settings') || '{}');
            s.autoPauseHostile = document.getElementById('start-autopause-hostile').checked;
            s.autoPauseEvent = document.getElementById('start-autopause-event').checked;
            s.pauseOnDeath = document.getElementById('start-pause-death').checked;
            s.pauseOnResearch = document.getElementById('start-pause-research').checked;
            s.demoMode = document.getElementById('start-demo-mode').checked;
            s.autoCookTarget = parseInt(document.getElementById('start-autocook').value) || 0;
            s.autoSaveInterval = parseInt(document.getElementById('start-autosave').value) || 0;
            s.showOverlays = document.getElementById('start-overlays').checked;
            s.showDamageFlash = document.getElementById('start-damage-flash').checked;
            s.enableScreenShake = document.getElementById('start-screen-shake').checked;
            s.showCombatParticles = document.getElementById('start-combat-particles').checked;
            s.showProjectiles = document.getElementById('start-projectiles').checked;
            s.showEquipmentOverlays = document.getElementById('start-equip-overlays').checked;
            s.showColonistHighlight = document.getElementById('start-colonist-highlight').checked;
            s.showProgressBars = document.getElementById('start-progress-bars').checked;
            s.showPortalPath = document.getElementById('start-portal-path').checked;
            s.showNightLighting = document.getElementById('start-night').checked;
            s.showWeatherParticles = document.getElementById('start-weather').checked;
            s.showMinimap = document.getElementById('start-minimap').checked;
            s.showFps = document.getElementById('start-fps').checked;
            s.ditherDistance = document.getElementById('start-dither-dist').value;
            s.ditherQuality = document.getElementById('start-dither-qual').value;
            s.darkenOnPause = document.getElementById('start-darken-pause').checked;
            s.toolbarMode = document.getElementById('start-toolbar-mode').value;
            s.largeClickTargets = document.getElementById('start-large-clicks').checked;
            s.pauseOnFocusLoss = document.getElementById('start-pause-focus').checked;
            s.colorblindMode = document.getElementById('start-colorblind').value;
            s.notificationDuration = parseInt(document.getElementById('start-notif-dur').value) || 100;
            s.layoutMode = document.getElementById('start-layout-mode').value;
            s.temperatureUnit = document.getElementById('start-temp-unit').value;
            s.musicVolume = parseInt(document.getElementById('start-music-vol').value) || 70;
            s.sfxVolume = parseInt(document.getElementById('start-sfx-vol').value) || 80;
            s.showColonistNames = document.getElementById('start-names').value;
            s.uiFontSize = parseInt(document.getElementById('start-ui-font-size').value) || 12;
            localStorage.setItem('colony_settings', JSON.stringify(s));
        } catch (e) {}
    }

    function loadStartSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('colony_settings'));
            if (!s) return;
            if (s.autoPauseHostile != null) document.getElementById('start-autopause-hostile').checked = s.autoPauseHostile;
            if (s.autoPauseEvent != null) document.getElementById('start-autopause-event').checked = s.autoPauseEvent;
            if (s.pauseOnDeath != null) document.getElementById('start-pause-death').checked = s.pauseOnDeath;
            if (s.pauseOnResearch != null) document.getElementById('start-pause-research').checked = s.pauseOnResearch;
            if (s.demoMode != null) document.getElementById('start-demo-mode').checked = s.demoMode;
            if (s.autoCookTarget != null) document.getElementById('start-autocook').value = s.autoCookTarget;
            if (s.autoSaveInterval != null) document.getElementById('start-autosave').value = s.autoSaveInterval;
            if (s.showOverlays != null) document.getElementById('start-overlays').checked = s.showOverlays;
            if (s.showDamageFlash != null) document.getElementById('start-damage-flash').checked = s.showDamageFlash;
            if (s.enableScreenShake != null) document.getElementById('start-screen-shake').checked = s.enableScreenShake;
            if (s.showCombatParticles != null) document.getElementById('start-combat-particles').checked = s.showCombatParticles;
            if (s.showProjectiles != null) document.getElementById('start-projectiles').checked = s.showProjectiles;
            if (s.showEquipmentOverlays != null) document.getElementById('start-equip-overlays').checked = s.showEquipmentOverlays;
            if (s.showColonistHighlight != null) document.getElementById('start-colonist-highlight').checked = s.showColonistHighlight;
            if (s.showProgressBars != null) document.getElementById('start-progress-bars').checked = s.showProgressBars;
            if (s.showPortalPath != null) document.getElementById('start-portal-path').checked = s.showPortalPath;
            if (s.showNightLighting != null) document.getElementById('start-night').checked = s.showNightLighting;
            if (s.showWeatherParticles != null) document.getElementById('start-weather').checked = s.showWeatherParticles;
            if (s.showMinimap != null) document.getElementById('start-minimap').checked = s.showMinimap;
            if (s.showFps != null) document.getElementById('start-fps').checked = s.showFps;
            if (s.ditherDistance) document.getElementById('start-dither-dist').value = s.ditherDistance;
            if (s.ditherQuality) document.getElementById('start-dither-qual').value = s.ditherQuality;
            if (s.darkenOnPause != null) document.getElementById('start-darken-pause').checked = s.darkenOnPause;
            if (s.toolbarMode) document.getElementById('start-toolbar-mode').value = s.toolbarMode;
            if (s.largeClickTargets != null) document.getElementById('start-large-clicks').checked = s.largeClickTargets;
            if (s.pauseOnFocusLoss != null) document.getElementById('start-pause-focus').checked = s.pauseOnFocusLoss;
            if (s.colorblindMode) document.getElementById('start-colorblind').value = s.colorblindMode;
            if (s.notificationDuration != null) document.getElementById('start-notif-dur').value = s.notificationDuration;
            if (s.layoutMode) document.getElementById('start-layout-mode').value = s.layoutMode;
            if (s.temperatureUnit) document.getElementById('start-temp-unit').value = s.temperatureUnit;
            if (s.musicVolume != null) { document.getElementById('start-music-vol').value = s.musicVolume; document.getElementById('start-music-vol-val').textContent = s.musicVolume; }
            if (s.sfxVolume != null) { document.getElementById('start-sfx-vol').value = s.sfxVolume; document.getElementById('start-sfx-vol-val').textContent = s.sfxVolume; }
            if (s.showColonistNames) document.getElementById('start-names').value = s.showColonistNames;
            if (s.uiFontSize) { document.getElementById('start-ui-font-size').value = s.uiFontSize; document.getElementById('start-ui-font-val').textContent = s.uiFontSize + 'px'; }
        } catch (e) {}
    }

    document.getElementById('start-settings-panel').addEventListener('change', saveStartSettings);
    document.getElementById('start-settings-panel').addEventListener('input', saveStartSettings);

    document.getElementById('start-reset-defaults').addEventListener('click', () => {
        document.getElementById('start-skin').value = 'ascii';
        document.getElementById('start-names').value = 'selected';
        document.getElementById('start-ui-font-size').value = 12;
        document.getElementById('start-ui-font-val').textContent = '12px';
        document.getElementById('start-autopause-hostile').checked = true;
        document.getElementById('start-autopause-event').checked = true;
        document.getElementById('start-pause-death').checked = false;
        document.getElementById('start-pause-research').checked = true;
        document.getElementById('start-peaceful-check').checked = false;
        document.getElementById('start-demo-mode').checked = false;
        document.getElementById('start-autocook').value = '0';
        document.getElementById('start-autosave').value = '24';
        document.getElementById('start-overlays').checked = true;
        document.getElementById('start-damage-flash').checked = true;
        document.getElementById('start-screen-shake').checked = true;
        document.getElementById('start-combat-particles').checked = true;
        document.getElementById('start-projectiles').checked = true;
        document.getElementById('start-progress-bars').checked = true;
        document.getElementById('start-portal-path').checked = true;
        document.getElementById('start-night').checked = true;
        document.getElementById('start-weather').checked = true;
        document.getElementById('start-minimap').checked = true;
        document.getElementById('start-equip-overlays').checked = true;
        document.getElementById('start-fps').checked = false;
        document.getElementById('start-dither-dist').value = 'light';
        document.getElementById('start-dither-qual').value = 'medium';
        document.getElementById('start-darken-pause').checked = true;
        document.getElementById('start-toolbar-mode').value = 'auto';
        document.getElementById('start-large-clicks').checked = false;
        document.getElementById('start-pause-focus').checked = true;
        document.getElementById('start-colorblind').value = 'none';
        document.getElementById('start-notif-dur').value = '100';
        document.getElementById('start-layout-mode').value = 'auto';
        document.getElementById('start-temp-unit').value = 'F';
        document.getElementById('start-music-vol').value = 70;
        document.getElementById('start-music-vol-val').textContent = '70';
        document.getElementById('start-sfx-vol').value = 80;
        document.getElementById('start-sfx-vol-val').textContent = '80';
        saveStartSettings();
    });

    // Shared transition from start screen into active game
    function launchGame(setup) {
        startScreen.style.display = 'none';
        gameContainer.style.display = 'grid';
        initFooterTabs();
        initPanelOverlay();
        initResizeHandles(fitGameFont);
        if (window.innerWidth <= 768) setFooterMode(true);
        SoundManager.init();
        window.soundManager = SoundManager;
        requestAnimationFrame(() => {
            fitGameFont();
            const game = new Game();
            setup(game);
            SoundManager.setMusicVolume(game.settings.musicVolume);
            SoundManager.setSFXVolume(game.settings.sfxVolume);
            const tm = game.settings.toolbarMode || (game.settings.alwaysShowToolbar ? 'always' : 'auto');
            game.settings.toolbarMode = tm;
            const toolbar = document.getElementById('touch-toolbar');
            if (tm === 'always') toolbar.style.display = 'flex';
            else if (tm === 'never') toolbar.style.display = 'none';
            if (game.settings.largeClickTargets) {
                document.getElementById('game-container').classList.add('large-targets');
            }
            if (game.settings.colorblindMode && game.settings.colorblindMode !== 'none') {
                document.getElementById('game-container').setAttribute('data-colorblind', game.settings.colorblindMode);
            }
            fitGameFont();
            game.start();
        });
    }

    document.getElementById('start-game').addEventListener('click', () => {
        CONFIG.PEACEFUL_MODE = document.getElementById('start-peaceful-check').checked;
        const startSettings = {
            autoPauseHostile: document.getElementById('start-autopause-hostile').checked,
            autoPauseEvent: document.getElementById('start-autopause-event').checked,
            pauseOnDeath: document.getElementById('start-pause-death').checked,
            pauseOnResearch: document.getElementById('start-pause-research').checked,
            autoCookTarget: parseInt(document.getElementById('start-autocook').value) || 0,
            autoSaveInterval: parseInt(document.getElementById('start-autosave').value) || 0,
            showOverlays: document.getElementById('start-overlays').checked,
            showDamageFlash: document.getElementById('start-damage-flash').checked,
            enableScreenShake: document.getElementById('start-screen-shake').checked,
            showCombatParticles: document.getElementById('start-combat-particles').checked,
            showProjectiles: document.getElementById('start-projectiles').checked,
            showEquipmentOverlays: document.getElementById('start-equip-overlays').checked,
            showProgressBars: document.getElementById('start-progress-bars').checked,
            showPortalPath: document.getElementById('start-portal-path').checked,
            showNightLighting: document.getElementById('start-night').checked,
            showWeatherParticles: document.getElementById('start-weather').checked,
            showMinimap: document.getElementById('start-minimap').checked,
            showFps: document.getElementById('start-fps').checked,
            ditherDistance: document.getElementById('start-dither-dist').value,
            ditherQuality: document.getElementById('start-dither-qual').value,
            showColonistNames: document.getElementById('start-names').value,
            uiFontSize: parseInt(document.getElementById('start-ui-font-size').value) || 12,
            activeSkin: document.getElementById('start-skin').value || '16x16_tiny_world',
            demoMode: document.getElementById('start-demo-mode').checked,
            darkenOnPause: document.getElementById('start-darken-pause').checked,
            toolbarMode: document.getElementById('start-toolbar-mode').value,
            largeClickTargets: document.getElementById('start-large-clicks').checked,
            pauseOnFocusLoss: document.getElementById('start-pause-focus').checked,
            colorblindMode: document.getElementById('start-colorblind').value,
            notificationDuration: parseInt(document.getElementById('start-notif-dur').value) || 100,
            layoutMode: document.getElementById('start-layout-mode').value,
            musicVolume: parseInt(document.getElementById('start-music-vol').value) || 70,
            sfxVolume: parseInt(document.getElementById('start-sfx-vol').value) || 80,
            temperatureUnit: document.getElementById('start-temp-unit').value || 'F',
        };
        setUIFontSize(startSettings.uiFontSize);
        localStorage.setItem('convocation_skin', startSettings.activeSkin);
        RENDER_CONFIG.terrainDithering = document.getElementById('start-dither-dist').value !== 'none';
        const customDefs = readCustomColonistDefs();
        launchGame(game => {
            Object.assign(game.settings, startSettings);
            if (startSettings.colorblindMode !== 'none') {
                document.getElementById('game-container').setAttribute('data-colorblind', startSettings.colorblindMode);
            }
            if (startSettings.layoutMode !== 'auto') {
                game.setLayoutMode(startSettings.layoutMode);
            }
            game._pendingCustomColonists = customDefs;
        });
    });

    loadBtn.addEventListener('click', () => {
        launchGame(game => game.load());
    });

    document.getElementById('start-blueprint').addEventListener('click', () => {
        import('../editor/blueprint-editor.js').then(({ launchBlueprintEditor }) => {
            launchBlueprintEditor();
        });
    });

    document.getElementById('start-skin-editor').addEventListener('click', () => {
        import('../editor/skin-editor.js').then(({ launchSkinEditor }) => {
            launchSkinEditor();
        });
    });

    document.getElementById('start-realm-editor').addEventListener('click', () => {
        import('../editor/realm-editor.js').then(({ launchRealmEditor }) => {
            launchRealmEditor();
        });
    });

    document.getElementById('start-entity-editor').addEventListener('click', () => {
        import('../editor/entity-editor.js').then(({ launchEntityEditor }) => {
            launchEntityEditor();
        });
    });

    document.getElementById('start-equipment-editor').addEventListener('click', () => {
        import('../editor/equipment-editor.js').then(({ launchEquipmentEditor }) => {
            launchEquipmentEditor();
        });
    });

    document.getElementById('start-spell-editor').addEventListener('click', () => {
        import('../editor/spell-editor.js').then(({ launchSpellEditor }) => {
            launchSpellEditor();
        });
    });

    document.getElementById('start-equipment-editor-pro').addEventListener('click', () => {
        import('../editor/equipment-editor-pro.js').then(m => m.launchEquipmentEditorPro());
    });
    document.getElementById('start-realm-editor-pro').addEventListener('click', () => {
        import('../editor/realm-editor-pro.js').then(m => m.launchRealmEditorPro());
    });

    const importFileInput = document.getElementById('import-file');
    document.getElementById('import-game').addEventListener('click', () => {
        importFileInput.click();
    });
    exportBtn.addEventListener('click', () => {
        exportSave();
    });

    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const success = await importSave(file);
        if (success) {
            loadBtn.disabled = false;
            exportBtn.disabled = false;
            launchGame(game => game.load());
        } else {
            alert('Invalid save file.');
        }
        importFileInput.value = '';
    });

    window.addEventListener('resize', () => {
        fitGameFont();
        const footer = document.getElementById('game-footer');
        if (!footer) return;
        const layoutMode = window.game?.settings?.layoutMode || 'auto';
        if (layoutMode !== 'auto') return;
        const isTabbed = footer.classList.contains('tabbed');
        const shouldTab = window.innerWidth <= 768;
        if (shouldTab && !isTabbed) setFooterMode(true);
        else if (!shouldTab && isTabbed) setFooterMode(false);
    });
});

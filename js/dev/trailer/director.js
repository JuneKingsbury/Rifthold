// Trailer Director (dev only).
//
// Sets up and plays scripted trailer scenes on one continuous colony. Each
// scene starts from a snapshot (IndexedDB, never a save slot or the cloud):
// "Keep take" saves the current state as the next scene's start, so the
// village, colonists and gear carry through the whole trailer.
//
// Flow: Alt+1..0 / Alt+- loads a scene (paused, framed). Alt+P plays it: enters
// recording mode, counts down off-screen, then runs. Alt+R resets for a retake.
// Alt+K keeps the take. The panel hides itself in recording mode.
//
// Loaded from boot.js when ?trailer is in the URL or the Debug menu toggle is on.

import { CONFIG, SEASONS } from '../../core/config.js';
import { serializeGame, applySerializedGame } from '../../core/save.js';
import { CineCamera } from './cine-camera.js';
import { Stage } from './stage.js';
import { SCENES } from './scenes.js';
import { showTitleCard, hideTitleCard, isTitleCardShowing } from './title-card.js';
import { ClipRecorder } from './recorder.js';

const PIXEL_SKIN = '16x16_tiny_world';
// Scene hotkeys: Alt+1..9, Alt+0, then Alt+- for an 11th scene.
const SCENE_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus'];
const sceneKey = (i) => `Alt+${(SCENE_CODES[i] || '').replace('Digit', '').replace('Minus', '-')}`;
const SETTINGS_KEY = 'rifthold_trailer_settings';
const SHOTS_KEY = 'rifthold_trailer_shots';
const TAKES_KEY = 'rifthold_trailer_takes';
const DB_NAME = 'rifthold_trailer';
const STORE = 'snapshots';

const DEFAULT_SETTINGS = {
    countdown: 3,            // seconds of held frame before the take starts
    takeSfxVolume: 30,       // SFX volume (%) while a take runs
    worldSize: 'medium',
    season: 'summer',
    noDeath: true,
    calm: true,              // no random events, raids, weather, mental breaks
    autoRecording: true,     // enter recording mode when a take plays
    titleCard: true,
    choiceHoldSeconds: 1.2,  // how long expedition choice nodes stay on screen before resolving
    bossHoldSeconds: 3.5,    // time on the boss before the cut to the title card
    expeditionView: 'cinema', // 'cinema' (big centered vis) or 'panel' (game's float panel)
    recordingHud: true,      // tiny status pill outside the 16:9 frame while recording
    recordClips: true,       // save every take as an MP4
    clipResolution: '1080p', // '1080p' | '1440p' | '2160p' | 'native'
    clipMbps: 30,            // video bitrate at 1080p (scaled up for larger sizes)
    clipAudioLevel: 100,     // recorded SFX level (%), independent of what you hear
    clipTailSeconds: 1.5,    // extra footage after a scene ends, as an edit handle
    clipConstantFps: true,   // re-encode to constant 60 fps with ffmpeg (safer in editors)
    crtScanlines: false,     // CRT scanlines on screen and in clips (barrel warp is always off)
    hideGhosts: true,        // hide not-yet-built blueprints in recording mode (the H toggle)
};

// Game settings forced while the director is on (restored on shutdown).
const FORCED_GAME_SETTINGS = {
    autoPauseHostile: false, autoPauseEvent: false, pauseOnDeath: false,
    pauseOnLowHealth: false, pauseOnResearch: false, pauseOnFocusLoss: false,
    autoSaveInterval: 0, showTutorial: false, showTutorialArrows: false,
    showFps: false, showEquipmentOverlays: true, showPortalPath: false,
};

class Cancelled extends Error {}

// ---- Snapshot store (IndexedDB: snapshots are far too big for localStorage) ----

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbOp(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(req?.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

const snapshots = {
    get: (id) => dbOp('readonly', s => s.get(id)),
    put: (id, rec) => dbOp('readwrite', s => s.put(rec, id)),
    del: (id) => dbOp('readwrite', s => s.delete(id)),
    keys: () => dbOp('readonly', s => s.getAllKeys()),
    all: async () => {
        const keys = await snapshots.keys();
        const out = {};
        for (const k of keys) out[k] = await snapshots.get(k);
        return out;
    },
};

// ---------------------------------------------------------------------------

class TrailerDirector {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS, ...this._loadJson(SETTINGS_KEY) };
        this.shots = this._loadJson(SHOTS_KEY);     // per-scene opening-shot overrides
        this.cine = new CineCamera();
        this.game = null;
        this.current = 0;
        this.state = 'idle';       // idle | loading | ready | countdown | running | done
        this.anchor = null;
        this.plan = {};
        this.beats = [];
        this.envActive = false;
        this._take = null;         // { cancelled, reject, timers }
        this._snapIds = new Set();
        this._savedGameSettings = null;
        this._savedSfx = null;
        this._cinemaEl = null;
        this._panelHidden = false;
        this.recorder = ClipRecorder.supported() ? new ClipRecorder(this) : null;
        this.takes = this._loadJson(TAKES_KEY);   // per-scene take counters
        this.lastClip = null;

        this._onKey = this._onKey.bind(this);
        this._frame = this._frame.bind(this);
        this._onUnload = () => this._restoreGameSettings();

        this._injectCss();
        this._buildPanel();
        window.addEventListener('keydown', this._onKey, true);
        window.addEventListener('beforeunload', this._onUnload);
        this._raf = requestAnimationFrame(this._frame);
        this._refreshSnapIds().then(() => this.render());
        this.status('Ready. Alt+1..0 / Alt+- loads a scene, or New colony to start fresh.');
    }

    shutdown() {
        this.recorder?.stop({ discard: true });
        this.cancelTake();
        this.cine.detach(this.game);
        this._unhook(this.game);
        this._restoreGameSettings();
        this._restoreSfx();
        this._closeExpeditionView();
        hideTitleCard();
        cancelAnimationFrame(this._raf);
        window.removeEventListener('keydown', this._onKey, true);
        window.removeEventListener('beforeunload', this._onUnload);
        this.panel?.remove();
        this.hud?.remove();
        document.getElementById('trailer-director-css')?.remove();
        if (this.game) this.game.devWorkMult = this.game.devNoDeath = undefined;
        window.trailerDirector = null;
    }

    // ---- Game attachment -------------------------------------------------------

    _attach(game) {
        if (this.game === game) return;
        if (this.game) { this.cancelTake(); this.cine.detach(this.game); this._unhook(this.game); }
        this.game = game;
        if (!game) return;
        this.cine.attach(game);
        this._hook(game);
        if (this.envActive) this._applyGameSettings();
    }

    _hook(game) {
        if (game._trailerHooks) return;
        const tick = game.simulationTick.bind(game);
        const events = game.events.update.bind(game.events);
        const render = game.renderer.render.bind(game.renderer);
        game._trailerHooks = { tick, events, render };
        game.simulationTick = () => { tick(); if (this.envActive && this.game === game) this._enforce(game); };
        // Clip frames are composited right after each game render.
        game.renderer.render = (...args) => { render(...args); if (this.recorder?.recording) this.recorder.drawFrame(); };
        game.events.update = (...args) => { if (this.envActive && this.settings.calm) return; return events(...args); };
    }

    _unhook(game) {
        const h = game?._trailerHooks;
        if (!h) return;
        game.simulationTick = h.tick;
        game.events.update = h.events;
        game.renderer.render = h.render;
        delete game._trailerHooks;
    }

    // Runs after every simulation tick while a scene is loaded.
    _enforce(game) {
        const scene = SCENES[this.current];
        const calm = this.settings.calm;
        for (const c of game.colonists) {
            if (c.hp <= 0) continue;
            if (c.needs) { c.needs.hunger = 100; c.needs.rest = 100; }
            if (calm && !c.activeEffects?.some(e => e.source === 'trailer_mood')) {
                (c.activeEffects ||= []).push({ type: 'mood', moodBonus: 40, source: 'trailer_mood', expiresAt: Number.MAX_SAFE_INTEGER });
            }
        }
        if (calm) {
            const w = game.weather;
            w.currentWeather = 'clear';
            w.weatherTimer = 1e9;
            w.seasonTick = Math.min(w.seasonTick, 100);
            game.combat.nextRaidTick = Math.max(game.combat.nextRaidTick, game.tick + 1e6);
        }
        if (scene && scene.timeOfDay != null) game.timeOfDay = Math.floor(scene.timeOfDay * CONFIG.TICKS_PER_DAY);
        if (this.settings.noDeath && game.waves.active && game.waves.nexusHp < game.waves.nexusMaxHp * 0.3) {
            game.waves.nexusHp = Math.ceil(game.waves.nexusMaxHp * 0.3);
        }
    }

    _applyGameSettings() {
        const s = this.game.settings;
        if (!this._savedGameSettings) {
            this._savedGameSettings = { showCrtWarp: s.showCrtWarp, showCrtScanlines: s.showCrtScanlines };
            for (const k of Object.keys(FORCED_GAME_SETTINGS)) this._savedGameSettings[k] = s[k];
        }
        Object.assign(s, FORCED_GAME_SETTINGS);
        this._applyCrt(false, this.settings.crtScanlines);
        this.game.ui?.updateTutorialNote?.(this.game);
        const note = document.getElementById('tutorial-note');
        if (note) note.style.display = 'none';
    }

    _restoreGameSettings() {
        if (!this._savedGameSettings || !this.game) return;
        const saved = this._savedGameSettings;
        Object.assign(this.game.settings, saved);
        this._applyCrt(saved.showCrtWarp, saved.showCrtScanlines);
        this._savedGameSettings = null;
        this.game.saveSettingsToStorage?.();
    }

    // Barrel warp is a CSS lens filter on the game area: clips can't show it and
    // the 16:9 crop would cut its curved edge, so it stays off while the
    // director is on. Scanlines follow the director setting.
    _applyCrt(warp, scanlines) {
        const s = this.game.settings;
        s.showCrtWarp = !!warp;
        document.getElementById('game-area')?.classList.toggle('crt-warp', !!warp);
        if (s.showCrtScanlines !== !!scanlines) {
            s.showCrtScanlines = !!scanlines;
            if (this.game.renderer?.crtRenderer) this.game.renderer.crtRenderer._scanlinePattern = null;
        }
    }

    async _applyEnvironment(scene) {
        const game = this.game;
        this.envActive = true;
        this._applyGameSettings();
        game.devNoDeath = this.settings.noDeath;
        game.devWorkMult = scene.workMult ?? 1;
        CONFIG.PEACEFUL_MODE = false;
        const season = scene.season || this.settings.season;
        if (this.settings.calm && game.weather.season !== season) {
            game.weather.season = season;
            game.weather.seasonIndex = SEASONS.indexOf(season);
            game.weather.seasonTick = 100;
        }
        if (this.settings.calm) { game.weather.currentWeather = 'clear'; game.weather.weatherTimer = 1e9; }
        if (scene.timeOfDay != null) game.timeOfDay = Math.floor(scene.timeOfDay * CONFIG.TICKS_PER_DAY);
        if (game.skinManager?.activeSkin !== PIXEL_SKIN) {
            // A switch superseded by another one may never settle; don't hang the load on it.
            await Promise.race([game.switchSkin(PIXEL_SKIN), new Promise(r => setTimeout(r, 4000))]);
        }
        game.renderer?.markTerrainDirty?.();
        game.minimap?.markTerrainDirty?.();
    }

    // ---- Scene lifecycle -------------------------------------------------------

    get recording() { return !!this.game?.input?._recordingMode; }

    _setRecording(on) {
        if (this.game && this.recording !== on) this.game.input._toggleRecordingMode();
    }

    _pause(on) {
        if (this.game && this.game.paused !== on) this.game.togglePause(true);
    }

    async newColony() {
        if (this.state === 'loading') return;
        if (this._snapIds.has(SCENES[0].id) && !confirm('Replace the current trailer colony with a fresh one?\n(Later scenes keep their snapshots until you re-keep them.)')) return;
        const dev = window.__riftholdDev;
        if (!dev) { this.status('Game not booted yet.', true); return; }
        this.cancelTake();
        this.state = 'loading';
        this.status('Generating a new colony…');
        this._setRecording(false);
        const old = window.game;
        localStorage.setItem('convocation_skin', PIXEL_SKIN);
        dev.applyWorldPreset(this.settings.worldSize);
        CONFIG.PEACEFUL_MODE = false;
        dev.launchGame(game => {
            game.settings.showTutorial = false;
            game.settings.activeSkin = PIXEL_SKIN;
            game.settings.primarySaveSlot = null;
            game.tutorial.setLevel('none');
        });
        const game = await this._waitFor(() => window.game && window.game !== old && window.game.colonists.length > 0 && window.game._rafId ? window.game : null, 20);
        if (!game) { this.state = 'idle'; this.status('New colony did not start (see console).', true); return; }
        this._attach(game);
        this.anchor = { x: Math.floor(CONFIG.MAP_WIDTH / 2), y: Math.floor(CONFIG.MAP_HEIGHT / 2) };
        this.plan = {};
        this.current = 0;
        await this._applyEnvironment(SCENES[0]);
        await this._saveSnapshot(SCENES[0].id);
        this.state = 'idle';
        await this.loadScene(0);
        this.status('New colony ready. Don\'t like the map? Press New colony again.\nHappy with it: Alt+P to shoot scene 1.');
    }

    async loadScene(index) {
        if (this.state === 'loading') return;
        const scene = SCENES[index];
        if (!scene) return;
        this._attach(window.game);
        const game = this.game;
        // A game mid-launch hasn't run start() yet; loading into it races its own setup.
        if (!game || !game.colonists || !game._rafId) { this.status('Start or load a game first (or New colony).', true); return; }
        this.cancelTake();
        hideTitleCard();
        this._closeExpeditionView();
        this._restoreSfx();
        this.state = 'loading';
        this.current = index;
        this.render();
        this.status(`Loading ${index + 1}. ${scene.name}…`);

        const wasRecording = this.recording;
        this._setRecording(false);   // a load restores DOM layout; don't fight recording mode
        this.cine.release();
        const rec = await snapshots.get(scene.id).catch(() => null);
        let note = '';
        if (rec) {
            const ok = await applySerializedGame(game, rec.data);
            if (!ok) { this.state = 'idle'; this.status('Snapshot failed to load (see console).', true); return; }
            game._resetTransientState();
            game.renderer?.markTerrainDirty?.();
            this.anchor = rec.anchor;
            this.plan = structuredClone(rec.plan || {});
        } else {
            this.anchor ||= this._colonyCenter(game);
            note = '\nNo snapshot for this scene yet: set up on the current state. Keep the previous scene\'s take to link them.';
        }

        await this._applyEnvironment(scene);
        const ctx = this._makeCtx(scene, null);
        try {
            await scene.prepare?.call(scene, ctx);
        } catch (e) {
            console.error('[trailer] prepare failed', e);
            note += `\nPrepare error: ${e.message}`;
        }
        // Takes start with everyone at full health, whatever the last take did.
        new Stage(game, this.anchor).healAll();
        game.speed = 1;
        this._pause(true);
        this._setRecording(wasRecording);
        this.cine.engage();
        this.cine.cut(this._openingShot(scene, ctx));
        this.state = 'ready';
        this.render();
        this.status(`${index + 1}. ${scene.name}: ready. Alt+P to roll.${note}`, !!note);
    }

    async play() {
        if (this.state === 'loading' || this.state === 'countdown' || this.state === 'running') return;
        if (this.state !== 'ready') await this.loadScene(this.current);
        if (this.state !== 'ready') return;
        const scene = SCENES[this.current];
        if (this.settings.autoRecording) this._setRecording(true);
        // Recording mode changes the viewport; re-cut so the frame is exact.
        const take = this._newTake();
        const ctx = this._makeCtx(scene, take);
        this.cine.cut(this._openingShot(scene, ctx));
        this._applySfx();
        this.beats = [];
        this.state = 'countdown';
        const record = this.settings.recordClips && this.recorder;
        this._clipStart = null;
        this._recordingName = null;
        try {
            // The clip starts one second before the roll: a held frame as an edit handle.
            const count = Math.max(0, Math.round(this.settings.countdown));
            for (let n = count; n > 0; n--) {
                this.status(`Rolling in ${n}…`);
                if (record && n === 1) await this._startClip(scene);
                await ctx.sleep(1);
            }
            if (record && !this.recorder.recording) { await this._startClip(scene); await ctx.sleep(1); }
            this.state = 'running';
            // Beats are timed from the start of the clip file when recording.
            this._t0 = this._clipStart ?? performance.now();
            this.status(`Rolling: ${scene.name}`);
            this._pause(false);
            await scene.run.call(scene, ctx);
            take.completed = true;
            this.state = 'done';
            if (record) {
                this.status('Take finished. Recording the tail…');
                await ctx.sleep(scene.tailSeconds ?? this.settings.clipTailSeconds);
                await this._finishClip(false);
            }
            this.status(`Take finished${this.lastClip ? `, saved ${this.lastClip}` : ''}. Alt+K keeps it (next scene starts here), Alt+R retakes.`);
        } catch (e) {
            if (!(e instanceof Cancelled)) {
                console.error('[trailer] take failed', e);
                this.state = 'done';
                this.status(`Take error: ${e.message}`, true);
            }
            // Cancelled: keep the clip if the scene had finished (cut short in its
            // tail) or the take was stopped on purpose; otherwise it's a retake.
            if (this.recorder?.recording) await this._finishClip(!(take.completed || take.keepClip));
        } finally {
            if (this._take === take) this._take = null;
            this.render();
        }
    }

    async _startClip(scene) {
        const index = SCENES.indexOf(scene);
        const n = (this.takes[scene.id] || 0) + 1;
        this.takes[scene.id] = n;
        this._saveJson(TAKES_KEY, this.takes);
        const name = `${String(index + 1).padStart(2, '0')}_${scene.id}_take${n}`;
        try {
            await this.recorder.start(name, {
                resolution: this.settings.clipResolution,
                mbps: this.settings.clipMbps,
                recordLevel: this.settings.clipAudioLevel,
                constantFps: this.settings.clipConstantFps,
            });
            this._recordingName = name;
            this._clipStart = performance.now();
        } catch (e) {
            console.error('[trailer] could not start recording', e);
            this.status(`Recording failed to start: ${e.message}`, true);
        }
    }

    // Stops the clip; saves it unless `discard`.
    async _finishClip(discard) {
        if (!this.recorder?.recording) return;
        const result = await this.recorder.stop({ discard });
        if (discard || !result) return;
        if (result.error) { this.status(`Saving the clip failed: ${result.error}`, true); return; }
        this.lastClip = result.path.split('/').pop();
        this._lastClipPath = result.path;
        console.log('[trailer] saved clip', result.path, result.remuxed === false ? '(not remuxed: ffmpeg not found)' : '');
        this.render();
    }

    openClipsFolder() {
        const api = window.electronAPI?.trailer;
        if (api) api.openFolder().catch(() => this.status('Clips folder is only available in the desktop app.', true));
        else this.status('In the browser, clips go to your Downloads folder.');
    }

    async reset() { await this.loadScene(this.current); }

    stop() {
        if (!this._take) return;
        this._take.keepClip = true;
        this.cancelTake();
        this.state = 'done';
        this.status('Stopped. Alt+R to reset, Alt+K to keep as is.');
        this.render();
    }

    async keep() {
        if (!this.game || this.state === 'loading') return;
        const next = SCENES[this.current + 1];
        if (!next) { this.status('Last scene: nothing after it to keep for.'); return; }
        if (this._take) this._take.keepClip = true;
        this.cancelTake();
        await this._saveSnapshot(next.id);
        this.status(`Kept. Scene ${this.current + 2} (${next.name}) now starts from here. ${sceneKey(this.current + 1)} to load it.`);
        this.render();
    }

    async saveAsCurrentStart() {
        if (!this.game) return;
        await this._saveSnapshot(SCENES[this.current].id);
        this.status(`Saved the current state as the start of scene ${this.current + 1}.`);
        this.render();
    }

    async _saveSnapshot(id) {
        const data = await serializeGame(this.game);
        await snapshots.put(id, { data, anchor: this.anchor, plan: this.plan, savedAt: Date.now() });
        this._snapIds.add(id);
    }

    async _refreshSnapIds() {
        try { this._snapIds = new Set(await snapshots.keys()); } catch (e) { console.warn('[trailer] snapshot store unavailable', e); }
    }

    // ---- Takes ---------------------------------------------------------------

    _newTake() {
        this.cancelTake();
        let reject;
        const cancelled = new Promise((_, r) => { reject = r; });
        cancelled.catch(() => {});
        this._take = { cancelled: false, cancelPromise: cancelled, reject, timers: new Set() };
        return this._take;
    }

    cancelTake() {
        const t = this._take;
        if (!t) return;
        t.cancelled = true;
        for (const id of t.timers) clearTimeout(id);
        t.reject(new Cancelled());
        this._take = null;
    }

    _makeCtx(scene, take) {
        const director = this;
        const game = this.game;
        const stage = new Stage(game, this.anchor);
        const guard = (p) => (take ? Promise.race([p, take.cancelPromise]) : p);
        const check = () => { if (take?.cancelled) throw new Cancelled(); };
        const sleep = (seconds) => guard(new Promise(resolve => {
            if (!take) { setTimeout(resolve, seconds * 1000); return; }
            const id = setTimeout(() => { take.timers.delete(id); resolve(); }, seconds * 1000);
            take.timers.add(id);
        }));

        // Calls into the stage after a cancel would keep changing the world under
        // the next take, so they throw instead.
        const guardedStage = new Proxy(stage, {
            get(target, prop) {
                const v = target[prop];
                if (typeof v !== 'function') return v;
                return (...args) => { check(); return v.apply(target, args); };
            },
        });
        const cam = this.cine;
        const guardedCam = {
            cut: (shot) => { check(); cam.cut(shot); },
            move: (shot, s, e) => { check(); return guard(cam.move(shot, s, e)); },
            drift: (dx, dy, s, o) => { check(); return guard(cam.drift(dx, dy, s, o)); },
            zoomTo: (z, s, e) => { check(); return guard(cam.zoomTo(z, s, e)); },
            follow: (t, o) => { check(); cam.follow(t, o); },
            stopFollow: () => cam.stopFollow(),
            shake: (s, a) => cam.shake(s, a),
            get shot() { return cam.shot; },
        };

        return {
            game, scene,
            stage: guardedStage,
            cam: guardedCam,
            anchor: this.anchor,
            plan: this.plan,
            settings: this.settings,
            sleep,
            // Resolves once pred() is true; gives up quietly after timeoutSeconds.
            until: (pred, timeoutSeconds = 30) => guard(new Promise(resolve => {
                const t0 = performance.now();
                const poll = () => {
                    if (take?.cancelled) return;
                    let ok = false;
                    try { ok = pred(); } catch { ok = false; }
                    if (ok || performance.now() - t0 > timeoutSeconds * 1000) { resolve(ok); return; }
                    const id = setTimeout(() => { take?.timers.delete(id); poll(); }, 100);
                    take?.timers.add(id);
                };
                poll();
            })),
            mark: (label) => {
                if (!take || take.cancelled) return;
                const t = (performance.now() - (director._t0 || performance.now())) / 1000;
                director.beats.push({ t, label });
                director._renderBeats();
            },
            speed: (n) => { check(); game.speed = n; if (n > (game.debugMaxSpeed || 3)) game.debugMaxSpeed = Math.max(n, 20); },
            work: (n) => { check(); game.devWorkMult = n; },
            freeze: () => director._pause(true),
            log: (msg) => director.status(msg, true),
            titleCard: () => { check(); return guard(showTitleCard()); },
            openExpeditionView: () => { check(); director._openExpeditionView(); },
        };
    }

    _openingShot(scene, ctx) {
        const override = this.shots[scene.id];
        if (override) return override;
        try { return scene.shot?.(ctx) || this.cine.shot; } catch (e) { console.warn('[trailer] shot failed', e); return this.cine.shot; }
    }

    _applySfx() {
        if (this._savedSfx == null) this._savedSfx = this.game.settings.sfxVolume;
        window.soundManager?.setSFXVolume?.(this.settings.takeSfxVolume);
    }

    _restoreSfx() {
        if (this._savedSfx == null) return;
        window.soundManager?.setSFXVolume?.(this._savedSfx);
        this._savedSfx = null;
    }

    // ---- Expedition view -------------------------------------------------------

    _openExpeditionView() {
        const ui = this.game.ui;
        ui._arcaneTab = 'expeditions';
        ui._arcaneExpSetup = null;
        ui._arcaneShowOverview = false;
        ui._expVisState._snapToCurrentProgress = true;
        const el = ui.elements.arcanePanel;
        const cinema = this.settings.expeditionView === 'cinema';
        if (this.recording) {
            ui.arcanePanelVisible = true;
            el.style.visibility = cinema ? 'hidden' : 'visible';
            ui._lastArcaneHtml = '';
            ui.updateArcanePanel();
        } else if (!ui.arcanePanelVisible) {
            ui.toggleArcanePanel('expeditions');
        }
        window.soundManager?.setExpeditionMode?.(true);
        if (cinema) this._openCinema();
    }

    // Mirrors the expedition visualizer canvas into a large centered view.
    _openCinema() {
        if (this._cinemaEl) return;
        const wrap = document.createElement('div');
        wrap.id = 'trailer-exp-cinema';
        Object.assign(wrap.style, {
            position: 'fixed', inset: '0', zIndex: '20000', background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            opacity: '0', transition: 'opacity 0.5s ease',
        });
        const canvas = document.createElement('canvas');
        canvas.width = 768; canvas.height = 192;
        Object.assign(canvas.style, { width: '96vw', imageRendering: 'pixelated' });
        wrap.appendChild(canvas);
        document.body.appendChild(wrap);
        requestAnimationFrame(() => { wrap.style.opacity = '1'; });
        this._cinemaEl = wrap;
        this._cinemaCanvas = canvas;
    }

    _closeExpeditionView() {
        this._cinemaEl?.remove();
        this._cinemaEl = null;
        this._cinemaCanvas = null;
        const ui = this.game?.ui;
        if (ui?.arcanePanelVisible) {
            if (this.recording) {
                ui.arcanePanelVisible = false;
                ui.elements.arcanePanel.style.visibility = 'hidden';
            } else {
                ui.toggleArcanePanel();
            }
        }
        window.soundManager?.setExpeditionMode?.(false);
    }

    // ---- Per-frame -----------------------------------------------------------

    _frame() {
        this._raf = requestAnimationFrame(this._frame);
        if (window.game !== this.game && window.game?.simulationTick) this._attach(window.game);
        this._resolveExpeditionChoices();
        if (this._cinemaCanvas && this.game) {
            const src = this.game.ui?.elements?.arcanePanel?.querySelector('.exp-vis-canvas');
            if (src) {
                const ctx = this._cinemaCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 768, 192);
                ctx.drawImage(src, 0, 0, 768, 192);
            }
        }
        const hide = this.recording;
        // Recording mode's ghost toggle (H) resets each time recording mode is
        // entered; keep it on for takes so blueprints only appear once built.
        if (hide && this.envActive && this.settings.hideGhosts && this.game?.input) this.game.input._hideGhosts = true;
        this.panel.classList.toggle('td-hidden', !!(hide || this._panelHidden));
        this._updateHud(hide);
    }

    // Choice, puzzle and parley nodes pause the whole game for manual
    // expeditions, so they're resolved here (the frame loop keeps running while
    // paused) after a short hold that lets the moment read on screen.
    _resolveExpeditionChoices() {
        if (!this.envActive || !this.game?.exploration) return;
        const expl = this.game.exploration;
        for (const exp of expl.expeditions) {
            if (!exp.pendingDecision) { exp._trailerChoiceAt = null; continue; }
            exp._trailerChoiceAt ??= performance.now();
            if (performance.now() - exp._trailerChoiceAt < this.settings.choiceHoldSeconds * 1000) continue;
            exp._trailerChoiceAt = null;
            expl._autoResolvePendingDecision(exp, this.game);
        }
    }

    // A small status pill below the 16:9 frame while recording, only if the
    // window has spare room there (so it never lands inside the shot).
    _updateHud(recording) {
        if (!this.hud) {
            this.hud = document.createElement('div');
            Object.assign(this.hud.style, {
                position: 'fixed', right: '8px', bottom: '6px', zIndex: '30000', pointerEvents: 'none',
                font: '14px VT323, monospace', color: '#887799', background: 'rgba(0,0,0,0.6)',
                padding: '1px 8px', borderRadius: '8px', display: 'none',
            });
            document.body.appendChild(this.hud);
        }
        const area = document.getElementById('game-area');
        const room = area ? window.innerHeight - area.getBoundingClientRect().bottom : 0;
        const show = recording && this.settings.recordingHud && room > 24 && !isTitleCardShowing();
        this.hud.style.display = show ? 'block' : 'none';
        if (show) {
            const label = ({ countdown: 'COUNTDOWN', running: '● ROLLING', ready: 'READY', done: 'DONE', loading: 'LOADING' }[this.state] || '')
                + (this.recorder?.recording ? '  ● REC' : '');
            const text = `${this.current + 1}. ${SCENES[this.current].name}  ${label}`;
            if (this.hud.textContent !== text) this.hud.textContent = text;
        }
    }

    // ---- Camera marks ----------------------------------------------------------

    _currentShot() {
        if (this.cine.active) return this.cine.shot;
        const cam = this.game.camera;
        return {
            x: +(cam.x + CONFIG.VIEWPORT_WIDTH / 2).toFixed(1),
            y: +(cam.y + CONFIG.VIEWPORT_HEIGHT / 2).toFixed(1),
            zoom: +(window.getZoomFont?.() ?? 14).toFixed(1),
        };
    }

    copyMark() {
        if (!this.game) return;
        const s = this._currentShot();
        const rel = this.anchor ? `  // anchor ${s.x - this.anchor.x >= 0 ? '+' : ''}${(s.x - this.anchor.x).toFixed(1)}, ${s.y - this.anchor.y >= 0 ? '+' : ''}${(s.y - this.anchor.y).toFixed(1)}` : '';
        const text = `{ x: ${s.x}, y: ${s.y}, zoom: ${s.zoom} }${rel}`;
        navigator.clipboard?.writeText(text).catch(() => {});
        console.log('[trailer] camera mark', text);
        this.status(`Camera mark copied: ${text}`);
    }

    // Free camera: hand control back to the normal pan/zoom keys to scout a shot.
    toggleFreeCam() {
        if (!this.game) return;
        if (this.cine.active) { this.cine.release(); this.status('Free camera: pan/zoom normally. Alt+F to hand control back.'); }
        else { this.cine.engage(); this.status('Director camera engaged.'); }
    }

    setOpeningShot() {
        if (!this.game) return;
        const scene = SCENES[this.current];
        this.shots[scene.id] = this._currentShot();
        this._saveJson(SHOTS_KEY, this.shots);
        this.status(`Scene ${this.current + 1} now opens on this framing.`);
        this.render();
    }

    clearOpeningShot() {
        delete this.shots[SCENES[this.current].id];
        this._saveJson(SHOTS_KEY, this.shots);
        this.status('Opening shot reset to the scene default.');
        this.render();
    }

    // ---- Snapshot backup -------------------------------------------------------

    async exportSnapshots() {
        const all = await snapshots.all();
        const blob = new Blob([JSON.stringify({ version: 1, shots: this.shots, snapshots: all })], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `rifthold_trailer_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    importSnapshots() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                const data = JSON.parse(await file.text());
                for (const [id, rec] of Object.entries(data.snapshots || {})) await snapshots.put(id, rec);
                if (data.shots) { this.shots = data.shots; this._saveJson(SHOTS_KEY, this.shots); }
                await this._refreshSnapIds();
                this.status('Snapshots imported.');
                this.render();
            } catch (e) {
                this.status(`Import failed: ${e.message}`, true);
            }
        };
        input.click();
    }

    async deleteSceneSnapshot() {
        const scene = SCENES[this.current];
        if (!confirm(`Delete the start snapshot for scene ${this.current + 1}?`)) return;
        await snapshots.del(scene.id);
        this._snapIds.delete(scene.id);
        this.render();
    }

    // ---- Hotkeys ---------------------------------------------------------------

    _onKey(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        const code = e.code;
        let handled = true;
        const sceneIndex = SCENE_CODES.indexOf(code);
        if (sceneIndex !== -1) this.loadScene(sceneIndex);
        else if (code === 'KeyP' || code === 'Enter') this.play();
        else if (code === 'KeyR') this.reset();
        else if (code === 'KeyS') this.stop();
        else if (code === 'KeyK') this.keep();
        else if (code === 'KeyM') this.copyMark();
        else if (code === 'KeyF') this.toggleFreeCam();
        else if (code === 'KeyT') { if (isTitleCardShowing()) hideTitleCard(); else showTitleCard(); }
        else if (code === 'KeyD') { this._panelHidden = !this._panelHidden; }
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    }

    // ---- Panel -----------------------------------------------------------------

    _injectCss() {
        if (document.getElementById('trailer-director-css')) return;
        const link = document.createElement('link');
        link.id = 'trailer-director-css';
        link.rel = 'stylesheet';
        link.href = new URL('./director.css', import.meta.url).href;
        document.head.appendChild(link);
    }

    _buildPanel() {
        const p = document.createElement('div');
        p.id = 'trailer-director';
        p.innerHTML = `
            <h3><span>🎬 Trailer Director</span><button data-act="hide" title="Hide panel (Alt+D)">–</button></h3>
            <div class="td-status"></div>
            <div class="td-scenes"></div>
            <div class="td-row">
                <button class="td-primary" data-act="play" title="Alt+P">▶ Play</button>
                <button data-act="reset" title="Alt+R">↺ Reset</button>
                <button data-act="stop" title="Alt+S">■ Stop</button>
                <button data-act="keep" title="Alt+K">Keep → next</button>
            </div>
            <div class="td-row">
                <button data-act="newColony">New colony</button>
                <button data-act="saveStart" title="Use the current state as this scene's start">Save as scene start</button>
            </div>
            <div class="td-row">
                <button data-act="freeCam" title="Alt+F">Free cam</button>
                <button data-act="mark" title="Alt+M">Copy cam mark</button>
                <button data-act="setShot">Use as opening shot</button>
                <button data-act="clearShot">Default shot</button>
            </div>
            <div class="td-row">
                <button data-act="openClips" title="Where recorded takes are saved">Open clips folder</button>
                <span class="td-lastclip"></span>
            </div>
            <details class="td-settings"><summary>Settings</summary><div class="td-settings-body"></div></details>
            <details><summary>Beats (for music sync)</summary>
                <div class="td-beats"></div>
                <div class="td-row"><button data-act="copyBeats">Copy beats</button></div>
            </details>
            <details><summary>Snapshots</summary>
                <div class="td-row">
                    <button data-act="export">Export all</button>
                    <button data-act="import">Import</button>
                    <button data-act="deleteSnap">Delete this scene's</button>
                </div>
            </details>
            <details><summary>Hotkeys</summary><div class="td-help">
                Alt+1..0, Alt+- load scene · Alt+P play · Alt+R reset<br>
                Alt+S stop · Alt+K keep take → next scene<br>
                Alt+F free cam · Alt+M copy camera mark<br>
                Alt+T preview title card · Alt+D hide panel<br>
                \\ recording mode (panel hides itself)
            </div></details>`;
        p.addEventListener('click', (e) => {
            const scene = e.target.closest('.td-scene');
            if (scene) { this.loadScene(parseInt(scene.dataset.index, 10)); return; }
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            const actions = {
                hide: () => { this._panelHidden = true; },
                play: () => this.play(), reset: () => this.reset(), stop: () => this.stop(), keep: () => this.keep(),
                newColony: () => this.newColony(), saveStart: () => this.saveAsCurrentStart(),
                freeCam: () => this.toggleFreeCam(), mark: () => this.copyMark(),
                setShot: () => this.setOpeningShot(), clearShot: () => this.clearOpeningShot(),
                copyBeats: () => this.copyBeats(), openClips: () => this.openClipsFolder(),
                export: () => this.exportSnapshots(), import: () => this.importSnapshots(), deleteSnap: () => this.deleteSceneSnapshot(),
            };
            actions[act]?.();
        });
        // Keep panel keystrokes (number inputs) away from game hotkeys.
        p.addEventListener('keydown', (e) => { if (e.target.matches('input, select')) e.stopPropagation(); });
        document.body.appendChild(p);
        this.panel = p;
        this._buildSettings();
    }

    _buildSettings() {
        const body = this.panel.querySelector('.td-settings-body');
        const fields = [
            ['countdown', 'Countdown (s)', 'number'],
            ['takeSfxVolume', 'Take SFX volume %', 'number'],
            ['choiceHoldSeconds', 'Expedition choice hold (s)', 'number'],
            ['bossHoldSeconds', 'Boss hold before cut (s)', 'number'],
            ['season', 'Season', ['spring', 'summer', 'autumn', 'winter']],
            ['worldSize', 'New colony size', ['small', 'medium', 'large']],
            ['expeditionView', 'Expedition view', ['cinema', 'panel']],
            ['titleCard', 'Title card at the end', 'bool'],
            ['noDeath', 'No deaths', 'bool'],
            ['calm', 'Calm world', 'bool'],
            ['autoRecording', 'Auto recording mode', 'bool'],
            ['recordingHud', 'Status pill while recording', 'bool'],
            ['recordClips', 'Save takes as MP4', 'bool'],
            ['clipResolution', 'Clip resolution', ['1080p', '1440p', '2160p', 'native']],
            ['clipMbps', 'Clip bitrate (Mbps @1080p)', 'number'],
            ['clipAudioLevel', 'Clip SFX level %', 'number'],
            ['clipTailSeconds', 'Clip tail (s)', 'number'],
            ['clipConstantFps', 'Constant 60 fps (ffmpeg)', 'bool'],
            ['crtScanlines', 'CRT scanlines', 'bool'],
            ['hideGhosts', 'Hide unbuilt blueprints', 'bool'],
        ];
        body.innerHTML = fields.map(([key, label, type]) => {
            const v = this.settings[key];
            let input;
            if (type === 'bool') input = `<input type="checkbox" data-set="${key}"${v ? ' checked' : ''}>`;
            else if (Array.isArray(type)) input = `<select data-set="${key}">${type.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
            else input = `<input type="number" step="0.5" data-set="${key}" value="${v}">`;
            return `<label>${label}${input}</label>`;
        }).join('');
        body.addEventListener('change', (e) => {
            const key = e.target.dataset.set;
            if (!key) return;
            this.settings[key] = e.target.type === 'checkbox' ? e.target.checked
                : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
            this._saveJson(SETTINGS_KEY, this.settings);
            if (this.game && this.envActive) {
                this.game.devNoDeath = this.settings.noDeath;
                this._applyCrt(false, this.settings.crtScanlines);
            }
        });
    }

    render() {
        const last = this.panel.querySelector('.td-lastclip');
        if (last) last.textContent = this.recorder ? (this.lastClip ? `Last: ${this.lastClip}` : '') : 'Recording unsupported here';
        const list = this.panel.querySelector('.td-scenes');
        list.innerHTML = SCENES.map((s, i) => {
            const has = this._snapIds.has(s.id);
            const shot = this.shots[s.id] ? ' 📷' : '';
            return `<div class="td-scene${i === this.current ? ' td-current' : ''}" data-index="${i}">
                <span class="td-key">${sceneKey(i)}</span>
                <span class="td-name">${i + 1}. ${s.name}${shot}</span>
                <span class="td-snap${has ? '' : ' td-none'}" title="${has ? 'Has a start snapshot' : 'No start snapshot yet'}">${has ? '●' : '○'}</span>
            </div>`;
        }).join('');
        this._renderBeats();
    }

    _renderBeats() {
        const el = this.panel.querySelector('.td-beats');
        if (el) el.textContent = this._beatsText() || '(play a take to log beats)';
    }

    _beatsText() {
        if (!this.beats.length) return '';
        const head = `${this.current + 1}. ${SCENES[this.current].name}${this._recordingName ? `  (${this._recordingName}, times from clip start)` : ''}`;
        return [head, ...this.beats.map(b => `  ${b.t.toFixed(2).padStart(6)}s  ${b.label}`)].join('\n');
    }

    copyBeats() {
        const text = this._beatsText();
        if (!text) return;
        navigator.clipboard?.writeText(text).catch(() => {});
        this.status('Beats copied.');
    }

    status(text, warn = false) {
        const el = this.panel?.querySelector('.td-status');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('td-warn', warn);
    }

    // ---- Utils -----------------------------------------------------------------

    _colonyCenter(game) {
        const alive = game.colonists.filter(c => c.hp > 0 && !c.onExpedition);
        if (!alive.length) return { x: Math.floor(CONFIG.MAP_WIDTH / 2), y: Math.floor(CONFIG.MAP_HEIGHT / 2) };
        return {
            x: Math.round(alive.reduce((s, c) => s + c.x, 0) / alive.length),
            y: Math.round(alive.reduce((s, c) => s + c.y, 0) / alive.length),
        };
    }

    _waitFor(pred, seconds) {
        return new Promise(resolve => {
            const t0 = performance.now();
            const poll = () => {
                const v = pred();
                if (v) resolve(v);
                else if (performance.now() - t0 > seconds * 1000) resolve(null);
                else setTimeout(poll, 100);
            };
            poll();
        });
    }

    _loadJson(key) {
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
    }

    _saveJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full: settings just don't persist */ }
    }
}

if (!window.trailerDirector) {
    const start = () => { window.trailerDirector = new TrailerDirector(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

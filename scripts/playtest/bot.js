// Runs inside the game page, imported by launch.js. Starts a colony, steps the
// simulation in tight batches, lets the profile's strategy play, and queues
// metrics, events and screenshot requests that launch.js collects via poll().
//
// The rAF game loop keeps running for rendering, but with game.speed = 0 it
// never ticks on its own: every simulation tick comes from this file. Combat
// damage is applied when an attack fires (projectiles are only visual), so
// stepping faster than real time does not change outcomes.

import { CONFIG, MOOD_THRESHOLDS, RESEARCH, REALMS } from '../../js/core/config.js';
import { createStrategy, PROFILES } from './strategies.js';

const SAMPLE_EVERY = 120;   // ticks between metric samples (a quarter day)
const STRATEGY_EVERY = 10;  // ticks between strategy steps
const BATCH_MS = 14;        // wall time spent ticking before yielding to the renderer
const MAX_SHOTS = 90;
const TPD = () => CONFIG.TICKS_PER_DAY;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); };
async function waitFor(pred, seconds) {
    const t0 = Date.now();
    while (Date.now() - t0 < seconds * 1000) {
        try { const v = pred(); if (v) return v; } catch { /* not ready yet */ }
        await sleep(100);
    }
    return null;
}

export async function run(opts) {
    const out = { metrics: [], events: [], logs: [], readyShot: null, done: false, summary: null, error: null };
    let shotResolve = null;
    window.__pt = {
        poll() {
            const r = { metrics: out.metrics, events: out.events, logs: out.logs, shot: out.readyShot, done: out.done, summary: out.summary, error: out.error };
            out.metrics = []; out.events = []; out.logs = []; out.readyShot = null;
            return r;
        },
        shotAck() { const r = shotResolve; shotResolve = null; r?.(); },
    };
    const log = (m) => out.logs.push(m);

    try {
        await play(opts, out, log, (r) => { shotResolve = r; });
    } catch (e) {
        out.error = String(e && e.stack || e);
        out.done = true;
    }
}

async function play(opts, out, log, setShotResolve) {
    const profile = PROFILES[opts.profile];
    if (!profile) throw new Error(`unknown profile "${opts.profile}" (have ${Object.keys(PROFILES).join(', ')})`);
    const wallStart = performance.now();

    const dev = await waitFor(() => window.__riftholdDev, 60);
    if (!dev) throw new Error('the game never exposed __riftholdDev');
    // Nobody is there to answer native dialogs.
    window.confirm = () => true;
    window.alert = () => {};
    // Skip the studio splash the same way a key press does, then drop it so it cannot cover screenshots.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('splash-overlay')?.remove();

    const world = opts.world || profile.world;
    dev.applyWorldPreset(world);
    CONFIG.PEACEFUL_MODE = !!profile.peaceful;
    const old = window.game;
    dev.launchGame(g => {
        Object.assign(g.settings, {
            autoSaveInterval: 0, pauseOnFocusLoss: false, darkenOnPause: false,
            musicVolume: 0, sfxVolume: 0, primarySaveSlot: null, showFps: false,
        });
        if (profile.tutorial) {
            g.settings.showTutorial = true;
            g.settings.tutorialLevel = profile.tutorial;
            g.tutorial.setLevel(profile.tutorial);
        } else {
            g.settings.showTutorial = false;
            g.tutorial.setLevel('none');
        }
        if (!profile.autoPause) {
            Object.assign(g.settings, { autoPauseHostile: false, autoPauseEvent: false, pauseOnDeath: false, pauseOnLowHealth: false, pauseOnResearch: false });
        }
    });
    const g = await waitFor(() => window.game !== old && window.game?._rafId && window.game.colonists.length && window.game, 60);
    if (!g) throw new Error('the game did not start');
    log(`started ${opts.profile} on a ${world} world (${CONFIG.MAP_WIDTH}x${CONFIG.MAP_HEIGHT}), peaceful=${CONFIG.PEACEFUL_MODE}`);

    // ---- Recording --------------------------------------------------------
    const summary = {
        profile: opts.profile, world, mapSize: CONFIG.MAP_WIDTH, peaceful: CONFIG.PEACEFUL_MODE,
        startedAt: new Date().toISOString(),
        milestones: {}, research: [], realms: [], deaths: [], breaks: [], expeditions: [], waves: [],
        raids: [], crypts: [], colonistCount: [], pauses: {}, tutorial: [], stalls: [], botNotes: {},
    };
    const tickNow = () => g.tick;
    const day = (t = g.tick) => +(t / TPD()).toFixed(2);
    const event = (kind, data = {}) => out.events.push({ tick: g.tick, day: day(), kind, ...data });
    const milestone = (key, data) => {
        if (summary.milestones[key] !== undefined) return false;
        summary.milestones[key] = { tick: g.tick, day: day(), ...(data || {}) };
        event('milestone', { key, ...(data || {}) });
        return true;
    };
    const note = (key) => { summary.botNotes[key] = (summary.botNotes[key] || 0) + 1; };

    const origAdd = g.eventLog.add.bind(g.eventLog);
    g.eventLog.add = (game, text, type, linked) => {
        out.events.push({ tick: g.tick, day: day(), kind: 'log', type, text: String(text).replace(/<[^>]+>/g, '') });
        return origAdd(game, text, type, linked);
    };

    let rpInterval = 0, rpTotal = 0;
    const origAddProgress = g.research.addProgress.bind(g.research);
    g.research.addProgress = (amount) => {
        const active = g.research.activeResearch;
        rpInterval += amount; rpTotal += amount;
        const done = origAddProgress(amount);
        if (done) {
            summary.research.push({ key: done, name: RESEARCH[done]?.name, tick: g.tick, day: day(), rpTotal });
            event('research_done', { key: done });
            milestone('first_research');
        }
        return done;
    };

    let renderMs = 0, renderFrames = 0;
    const origRender = g.renderer.render.bind(g.renderer);
    g.renderer.render = (game) => {
        const t0 = performance.now();
        const r = origRender(game);
        renderMs += performance.now() - t0; renderFrames++;
        return r;
    };

    // ---- Screenshots ------------------------------------------------------
    let shotsTaken = 0;
    const pendingShots = [];
    const requestShot = (name, prep) => {
        if (shotsTaken + pendingShots.length >= MAX_SHOTS) return;
        pendingShots.push({ name, prep });
    };
    const home = { x: Math.round(g.colonists.reduce((s, c) => s + c.x, 0) / g.colonists.length), y: Math.round(g.colonists.reduce((s, c) => s + c.y, 0) / g.colonists.length) };
    async function takeShot({ name, prep }) {
        let cleanup = null;
        try { cleanup = prep ? prep(g) : null; } catch (e) { log(`shot prep ${name} failed: ${e.message}`); }
        g._uiDirty = true;
        await frames(4);
        const done = new Promise(r => setShotResolve(r));
        out.readyShot = `${String(++shotsTaken).padStart(3, '0')}_d${Math.floor(day())}_${name}`.replace(/[^\w.-]/g, '_');
        await done;
        try { cleanup?.(); } catch { /* best effort */ }
        g._uiDirty = true;
        await frames(1);
    }

    // How generous is the map near the start? Nearest node of each resource and counts within 30 tiles.
    {
        const near = {};
        for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) {
            const r = g.map[y][x].resource;
            if (!r) continue;
            const d = Math.abs(x - home.x) + Math.abs(y - home.y);
            const e = near[r.type] || (near[r.type] = { nearest: Infinity, within30: 0, total: 0 });
            e.total++; if (d <= 30) e.within30++; if (d < e.nearest) e.nearest = d;
        }
        summary.startMap = { home, resources: near, crypts: g.ruins.list.filter(r => r.kind === 'crypt').map(r => ({ tier: r.tier, anchor: r.anchor?.chain || null, ward: r.ward?.chain || null, dist: Math.round(Math.abs(r.x + r.w / 2 - home.x) + Math.abs(r.y + r.h / 2 - home.y)) })) };
        log(`start map: ${JSON.stringify(near)}`);
    }

    // ---- Strategy ---------------------------------------------------------
    const api = { g, home, log, event, milestone, note, requestShot, day, profile, summary };
    const strategy = createStrategy(opts.profile, api);

    // ---- Per-tick bookkeeping ----------------------------------------------
    const prev = new Map(); // colonist id -> { hp, state, breaking }
    let stateCounts = {}, homeTicks = 0, idleTicks = 0;
    let simMs = 0, simTicks = 0;
    let lastWaveCompleted = 0, lastRaidActive = false, lastRealmCount = 0, lastAlive = g.colonists.length;
    let gameOverTick = null;

    function trackColonists() {
        for (const c of g.colonists) {
            const p = prev.get(c.id);
            if (!p) {
                prev.set(c.id, { hp: c.hp, state: c.state });
                if (g.tick > 1) { event('colonist_joined', { name: c.name }); }
                continue;
            }
            if (p.hp > 0 && c.hp <= 0) {
                const recent = out.events.filter(e => e.kind === 'log' && e.tick >= g.tick - 2).map(e => e.text).slice(-3);
                summary.deaths.push({ name: c.name, tick: g.tick, day: day(), onExpedition: !!c.onExpedition, context: recent });
                event('death', { name: c.name, onExpedition: !!c.onExpedition });
                if (milestone('first_death')) requestShot('first_death');
            }
            if (c.hp > 0 && c.state === 'wandering' && p.state !== 'wandering') {
                // Re-entering the wander within half a day is the same episode, not a new break.
                if (p.lastBreak !== undefined && g.tick - p.lastBreak < TPD() / 2) {
                    p.lastBreak = g.tick;
                    const b = summary.breaks.findLast(x => x.name === c.name);
                    if (b) { b.reentries = (b.reentries || 0) + 1; b.lastTick = g.tick; }
                } else {
                    p.lastBreak = g.tick;
                    const thoughts = (c.thoughts || []).map(t => `${t.text} (${Math.round(t.moodEffect)})`);
                    summary.breaks.push({ name: c.name, tick: g.tick, day: day(), mood: Math.round(c.mood), traits: c.traits, thoughts });
                    event('mental_break', { name: c.name, mood: Math.round(c.mood), thoughts });
                    if (milestone('first_mental_break')) requestShot('first_mental_break');
                }
            }
            p.hp = c.hp; p.state = c.state;
            if (c.hp > 0 && !c.onExpedition) {
                homeTicks++;
                stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
                if (c.state === 'idle' && !c.currentTaskId) idleTicks++;
            }
        }
    }

    function trackWorld() {
        const raid = !!g.combat.raidActive;
        if (raid && !lastRaidActive) {
            summary.raids.push({ tick: g.tick, day: day(), type: g.combat.activeRaidType || 'raid', raiders: g.raiders.length, scripted: !!g.tutorial.flags.trainingRaid && summary.raids.length === 0 && !!profile.tutorial });
            event('raid_start', { type: g.combat.activeRaidType, raiders: g.raiders.length });
            if (milestone('first_raid')) requestShot('first_raid', (gm) => { gm.camera.centerOn(home.x, home.y); });
        }
        if (!raid && lastRaidActive) {
            const r = summary.raids[summary.raids.length - 1];
            if (r) { r.endTick = g.tick; r.durationTicks = g.tick - r.tick; r.colonistsAlive = g.colonists.filter(c => c.hp > 0).length; }
            event('raid_end', {});
        }
        lastRaidActive = raid;

        if (g.waves.highestWaveCompleted > lastWaveCompleted) {
            lastWaveCompleted = g.waves.highestWaveCompleted;
            summary.waves.push({ wave: lastWaveCompleted, tick: g.tick, day: day(), result: g.waves.lastWaveResult ? JSON.parse(JSON.stringify(g.waves.lastWaveResult)) : null });
            milestone(`wave_${lastWaveCompleted}`);
        }
        const realms = g.exploration.completedRealms;
        if (realms.size > lastRealmCount) {
            for (const key of realms) {
                if (!summary.realms.some(r => r.key === key)) {
                    summary.realms.push({ key, name: REALMS[key]?.name, chain: REALMS[key]?.chain, difficulty: REALMS[key]?.difficulty, tick: g.tick, day: day() });
                    milestone(`realm_${key}`);
                }
            }
            lastRealmCount = realms.size;
        }
        const alive = g.colonists.filter(c => c.hp > 0).length;
        if (alive !== lastAlive) {
            summary.colonistCount.push({ tick: g.tick, day: day(), alive });
            if (alive > 3) milestone(`colonists_${alive}`);
            lastAlive = alive;
        }
    }

    // Why did the game just pause itself? Checked in priority order.
    function pauseReason() {
        const pe = g.events.pendingEvent;
        if (pe) return `event:${pe.type}`;
        for (const e of g.exploration.expeditions) {
            if (e.pendingDecision) return `expedition:${e.pendingDecision.type}`;
            if (e.pendingVoidPactChoice) return 'expedition:void_pact';
        }
        if (g._gameOver) return 'game_over';
        if (g.waves.active && g.tick - g.waves.waveStartTick < 3) return 'wave_start';
        if (g.combat.raidActive) return 'hostile';
        if (g.colonists.some(c => c.hp <= 0 && prev.get(c.id)?.hp > 0)) return 'death';
        if (g.colonists.some(c => c.hp > 0 && c.hp < c.maxHp * 0.3)) return 'low_health';
        return 'other';
    }

    let lastPauseReason = null;
    function checkPause() {
        if (!g.paused) return;
        const reason = pauseReason();
        if (reason === 'game_over') return;
        summary.pauses[reason] = (summary.pauses[reason] || 0) + 1;
        event('auto_pause', { reason });
        lastPauseReason = reason;
        g.togglePause(true);
    }

    // ---- Sampling & stall detection --------------------------------------
    const stalls = {};       // key -> { start, last, data }
    const stallShotDay = {}; // key -> day of the last screenshot
    function stall(key, active, data) {
        const s = stalls[key];
        if (active) {
            if (!s) {
                stalls[key] = { key, start: g.tick, startDay: day(), last: g.tick, data };
                event('stall_start', { key, ...(data || {}) });
                if (stallShotDay[key] === undefined || day() - stallShotDay[key] > 10) {
                    stallShotDay[key] = day();
                    requestShot(`stall_${key}`, strategy.shotPrepFor?.(key));
                }
            } else { s.last = g.tick; s.data = data; }
        } else if (s) {
            summary.stalls.push({ ...s, end: g.tick, endDay: day(), days: +((g.tick - s.start) / TPD()).toFixed(2) });
            event('stall_end', { key, days: +((g.tick - s.start) / TPD()).toFixed(2) });
            delete stalls[key];
        }
    }

    let lastResearchProgressTick = g.tick;
    let lastCapChangeTick = g.tick, lastCap = 0;
    let idleHighSamples = 0;

    let lastSample = null;
    function sample() {
        const alive = g.colonists.filter(c => c.hp > 0);
        const homeC = alive.filter(c => !c.onExpedition);
        const st = g.resources.stockpile;
        const food = st.food || 0;
        const foodstuffs = g.resources.getFoodstuffTotal();
        const consumption = Math.max(1, g.resources.estimateDailyFoodConsumption(g));
        const foodDays = (food + foodstuffs / 2) / consumption;
        const moods = homeC.map(c => c.mood);
        const cap = g.waves.getColonistCap(g);
        const pendingByType = {};
        for (const t of g.taskQueue.getPending()) pendingByType[t.type] = (pendingByType[t.type] || 0) + 1;
        const states = {};
        for (const [k, v] of Object.entries(stateCounts)) states[k] = +(v / Math.max(1, homeTicks)).toFixed(3);
        const active = g.research.activeResearch;
        const available = g.research.getAvailable().map(t => t.key);
        const m = {
            tick: g.tick, day: day(), season: g.weather.season, year: g.weather.year, weather: g.weather.currentWeather,
            alive: alive.length, home: homeC.length, cap,
            moodAvg: moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null,
            moodMin: moods.length ? Math.round(Math.min(...moods)) : null,
            stressed: homeC.filter(c => c.mood < MOOD_THRESHOLDS.stressed).length,
            breaking: homeC.filter(c => c.mood < MOOD_THRESHOLDS.breaking).length,
            hungerMin: homeC.length ? Math.round(Math.min(...homeC.map(c => c.needs.hunger))) : null,
            restMin: homeC.length ? Math.round(Math.min(...homeC.map(c => c.needs.rest))) : null,
            hpMinPct: homeC.length ? +Math.min(...homeC.map(c => c.hp / c.maxHp)).toFixed(2) : null,
            idleShare: +(idleTicks / Math.max(1, homeTicks)).toFixed(3), states,
            food, foodstuffs, consumption, foodDays: +foodDays.toFixed(2),
            res: Object.fromEntries(['wood', 'stone', 'planks', 'bricks', 'iron_ore', 'iron', 'runite_ore', 'runite', 'hides', 'leather', 'void_essence', 'gold', 'cotton', 'cloth'].map(k => [k, st[k] || 0])),
            weapons: g.resources.weapons.length, tomes: g.resources.tomes.length,
            armed: homeC.filter(c => c.weapon).length,
            tasks: g.taskQueue.getPendingCount(), pendingByType,
            research: { active, progress: active ? Math.round(g.research.getProgress(active)) : 0, cost: active ? RESEARCH[active].cost : 0, done: g.research.completed.size, available: available.length, rp: +rpInterval.toFixed(1) },
            power: { gen: g.power.totalGenerated, cons: g.power.totalConsumed, powered: g.power.powered },
            raid: !!g.combat.raidActive, nextRaidIn: g.combat.nextRaidTick ? g.combat.nextRaidTick - g.tick : null,
            waves: g.waves.highestWaveCompleted, waveActive: !!g.waves.active,
            exp: { active: g.exploration.expeditions.filter(e => e.status !== 'complete').length, done: g.stats.expeditionsCompleted || 0, realms: g.exploration.completedRealms.size },
            wealth: Math.round(g.resources.getWealth()),
            simMs: +(simMs / Math.max(1, simTicks)).toFixed(3), renderMs: +(renderMs / Math.max(1, renderFrames)).toFixed(2),
            entities: g.entities.length, raiders: g.raiders.length,
        };
        out.metrics.push(m);
        lastSample = m;

        // Stalls. Each one is a condition a player would feel as "nothing is happening".
        if (rpInterval > 0) lastResearchProgressTick = g.tick;
        const hasDesk = g.mapIndex.findFirst('research_desk');
        stall('no_research_selected', hasDesk && !active && available.length > 0, { available });
        stall('research_tree_blocked', hasDesk && !active && available.length === 0 && g.research.completed.size < Object.keys(RESEARCH).length,
            { blockedBy: describeBlockedResearch(g) });
        stall('research_not_progressing', !!active && g.tick - lastResearchProgressTick > 2 * TPD(), { active });
        stall('low_food', foodDays < 1, { foodDays: +foodDays.toFixed(2) });
        idleHighSamples = m.idleShare > 0.3 ? idleHighSamples + 1 : 0;
        stall('colonists_idle', idleHighSamples >= 4, { idleShare: m.idleShare });
        stall('mood_low', homeC.length > 0 && m.stressed >= Math.ceil(homeC.length / 2), { moodAvg: m.moodAvg });
        if (cap !== lastCap) { lastCap = cap; lastCapChangeTick = g.tick; }
        stall('colonist_cap_flat', g.tick - lastCapChangeTick > 9600 && alive.length >= cap, { cap });
        const blocked = strategy.blockedGoals?.() || [];
        stall('goal_blocked', blocked.length > 0, { goals: blocked });

        rpInterval = 0; stateCounts = {}; homeTicks = 0; idleTicks = 0; simMs = 0; simTicks = 0; renderMs = 0; renderFrames = 0;
    }

    // ---- Main loop ---------------------------------------------------------
    g.speed = 0;
    if (g.paused) g.togglePause(true);
    g.camera.centerOn(home.x, home.y);
    requestShot('start');
    const endTick = Math.round(opts.days * TPD());
    let nextPeriodicShot = (opts.shotsEvery || 5) * TPD();
    let periodicIndex = 0;

    while (true) {
        const t0 = performance.now();
        while (performance.now() - t0 < BATCH_MS && pendingShots.length === 0) {
            const s0 = performance.now();
            g.simulationTick();
            simMs += performance.now() - s0; simTicks++;
            strategy.handlePrompts?.();
            checkPause();
            trackColonists();
            if (g.tick % STRATEGY_EVERY === 0) {
                trackWorld();
                strategy.step();
            }
            if (g.tick % SAMPLE_EVERY === 0) sample();
            if (g.tick >= nextPeriodicShot) {
                nextPeriodicShot += (opts.shotsEvery || 5) * TPD();
                const panel = strategy.periodicPanels?.[periodicIndex++ % (strategy.periodicPanels?.length || 1)];
                requestShot(`periodic_${panel || 'map'}`, strategy.panelPrep?.(panel));
            }
            if (g._gameOver && gameOverTick === null) {
                gameOverTick = g.tick;
                milestone('game_over');
                requestShot('game_over');
            }
            if (g.tick >= endTick || (gameOverTick !== null && g.tick - gameOverTick > 2 * TPD()) || strategy.finished?.()) break;
        }
        // Housekeeping the renderer would normally do, kept bounded at high speed.
        if (g.notifications.length > 30) g.notifications.splice(0, g.notifications.length - 30);
        if (g.projectiles.length > 200) g.projectiles.length = 0;

        while (pendingShots.length) await takeShot(pendingShots.shift());
        if (g.tick >= endTick || (gameOverTick !== null && g.tick - gameOverTick > 2 * TPD()) || strategy.finished?.()) break;
        await sleep(0);
    }

    // ---- Wrap up -----------------------------------------------------------
    sample();
    for (const key of Object.keys(stalls)) stall(key, false);
    await takeShot({ name: 'final', prep: (gm) => gm.camera.centerOn(home.x, home.y) });
    summary.final = { ...lastSample, day: day() };
    summary.completedResearch = [...g.research.completed];
    summary.completedRealms = [...g.exploration.completedRealms];
    summary.storyUnlocked = [...g.story.unlocked.keys()];
    summary.stats = { ...g.stats };
    summary.strategy = strategy.report?.() || null;
    summary.wallSeconds = Math.round((performance.now() - wallStart) / 1000);
    out.summary = summary;
    out.done = true;
}

// Lists why each next-in-line tech is not researchable, for the research_tree_blocked stall.
function describeBlockedResearch(g) {
    const res = [];
    for (const [key, tech] of Object.entries(RESEARCH)) {
        if (g.research.completed.has(key)) continue;
        if (!tech.requires.every(r => g.research.completed.has(r))) continue;
        const why = [];
        if (tech.requiresBuildings) for (const [b, n] of Object.entries(tech.requiresBuildings)) {
            if (g.mapIndex.getStructurePositions(b).size < n) why.push(`${n} ${b}`);
        }
        if (tech.requiresMilestone) why.push(`${tech.requiresMilestone.stat}>=${tech.requiresMilestone.min}`);
        if (tech.requiresTabCount) why.push(`${tech.requiresTabCount} in ${tech.tab}`);
        if (g.research.isDemoLocked(key)) why.push('demo');
        res.push(`${key}: ${why.join(', ') || '?'}`);
    }
    return res;
}

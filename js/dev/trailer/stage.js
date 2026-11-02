// World helpers for trailer scenes ("stagehand"). Everything here drives the
// real game systems the way a player would (blueprints, designations, crafting
// orders, drafting), plus a few instant shortcuts for setting up a scene's
// preconditions off camera.

import {
    BUILDINGS, IMPASSABLE_STRUCTURES, UNBUILDABLE_TERRAIN, PLANT_STRUCTURES, RESOURCES, ALL_ITEMS, RECIPES, CONFIG, getCryptTiles,
} from '../../core/config.js';
import { designateBuild, designateChop, designateMine, cancelDesignation } from '../../systems/building.js';
import { queueCraftingOrder } from '../../systems/crafting.js';
import { designateFarmZone } from '../../systems/farming.js';
import { designateTame } from '../../entities/taming.js';
import { createWildAnimal } from '../../entities/entity-factory.js';
import { createColonist } from '../../entities/colonist.js';
import { teleportEntity } from '../../systems/movement-lerp.js';
import { isPassable } from '../../world/map.js';
import { spawnProjectileImpact } from '../../ui/overlay-renderer.js';

const ROCK_TYPES = new Set(['stone', 'iron_ore', 'runite_ore']);
const GEAR_SLOTS = {
    weapon:  { list: 'weapons', equip: 'equipWeapon',  unequip: 'unequipWeapon' },
    armor:   { list: 'armors',  equip: 'equipArmor',   unequip: 'unequipArmor' },
    helmet:  { list: 'helmets', equip: 'equipHelmet',  unequip: 'unequipHelmet' },
    clothes: { list: 'clothes', equip: 'equipClothes', unequip: 'unequipClothes' },
    boots:   { list: 'boots',   equip: 'equipBoots',   unequip: 'unequipBoots' },
    tool:    { list: 'tools',   equip: 'equipTool',    unequip: 'unequipTool' },
    trinket: { list: 'trinkets', equip: 'equipTrinket', unequip: 'unequipTrinket' },
};

// Research a full mid-game colony has. Granted wholesale by later scenes so
// they can be loaded on their own, without having played the earlier ones.
export const MIDGAME_RESEARCH = [
    'metalworking', 'runecraft', 'warding', 'ley_channeling', 'void_summoning',
    'arcane_implements', 'warrior_training', 'runeforging', 'fortification',
    'beast_binding', 'arcane_infusion', 'alchemy', 'arcane_studies', 'textiles', 'luminance',
];

export class Stage {
    constructor(game, anchor) {
        this.game = game;
        this.anchor = anchor;
    }

    // ---- Tiles and space -------------------------------------------------

    tile(x, y) { return this.game.map[y]?.[x]; }

    inBounds(x, y) { return x > 1 && y > 1 && x < CONFIG.MAP_WIDTH - 2 && y < CONFIG.MAP_HEIGHT - 2; }

    isOpen(x, y, { allowResource = false } = {}) {
        const t = this.tile(x, y);
        if (!t || !this.inBounds(x, y)) return false;
        if (UNBUILDABLE_TERRAIN.has(t.terrain)) return false;
        if (t.terrain === 'rock' || t.terrain === 'red_rock') return false;
        if (t.sealed || t.structure || t.zone || t.designation) return false;
        if (t.resource && !allowResource) return false;
        return true;
    }

    // Free w×h rectangle (with a 1-tile clear margin) nearest `near`, searching
    // outward in rings. `avoid` rects are kept clear too (planned buildings).
    findOpenRect(w, h, near = this.anchor, { minDist = 0, maxDist = 60, margin = 1, avoid = [], allowResource = false } = {}) {
        const fits = (x0, y0) => {
            for (let y = y0 - margin; y < y0 + h + margin; y++) {
                for (let x = x0 - margin; x < x0 + w + margin; x++) {
                    if (!this.isOpen(x, y, { allowResource })) return false;
                    if (this.game.colonists.some(c => c.hp > 0 && !c.onExpedition && c.x === x && c.y === y)) return false;
                }
            }
            for (const r of avoid) {
                if (x0 < r.x + r.w + margin && x0 + w + margin > r.x && y0 < r.y + r.h + margin && y0 + h + margin > r.y) return false;
            }
            return true;
        };
        for (let r = minDist; r <= maxDist; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = Math.round(near.x - w / 2 + dx);
                    const y = Math.round(near.y - h / 2 + dy);
                    if (fits(x, y)) return { x, y, w, h };
                }
            }
        }
        return null;
    }

    rectCenter(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

    // Nearest open, walkable tile to `p` (for spawning things that must stand somewhere).
    openNear(p) {
        const r = this.findOpenRect(1, 1, { x: Math.round(p.x), y: Math.round(p.y) }, { margin: 0, maxDist: 30, allowResource: false });
        return r ? { x: r.x, y: r.y } : { x: Math.round(p.x), y: Math.round(p.y) };
    }

    // ---- Biomes ------------------------------------------------------------------

    // Center of the nearest w×h area (at least minDist from `near`) where most
    // tiles belong to one of `biomes` and stand on usable ground. `buildable`
    // also rules out structures and unbuildable terrain (for building sites).
    // Returns { x, y, biome } or null if no such area is within maxDist.
    findBiomeSpot(biomes, near = this.anchor, { w = 12, h = 8, minDist = 10, maxDist = 70, minFrac = 0.7, buildable = false } = {}) {
        const want = new Set([].concat(biomes));
        const usable = (t) => t && !t.sealed && !UNBUILDABLE_TERRAIN.has(t.terrain)
            && (buildable ? (!t.structure || PLANT_STRUCTURES.has(t.structure)) : (t.passable !== false || t.resource));
        for (let r = minDist; r <= maxDist; r += 2) {
            let best = null;
            for (let dy = -r; dy <= r; dy += 2) {
                for (let dx = -r; dx <= r; dx += 2) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) < r - 1) continue;
                    const x0 = Math.round(near.x + dx - w / 2), y0 = Math.round(near.y + dy - h / 2);
                    if (!this.inBounds(x0, y0) || !this.inBounds(x0 + w, y0 + h)) continue;
                    let hits = 0, ok = 0;
                    const counts = {};
                    for (let y = y0; y < y0 + h; y++) {
                        for (let x = x0; x < x0 + w; x++) {
                            const t = this.tile(x, y);
                            if (!usable(t)) continue;
                            ok++;
                            if (want.has(t.biome)) { hits++; counts[t.biome] = (counts[t.biome] || 0) + 1; }
                        }
                    }
                    const area = w * h;
                    if (ok < area * (buildable ? 1 : minFrac) || hits < area * minFrac) continue;
                    if (!best || hits > best.hits) {
                        const biome = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                        best = { x: x0 + Math.floor(w / 2), y: y0 + Math.floor(h / 2), biome, hits };
                    }
                }
            }
            if (best) return { x: best.x, y: best.y, biome: best.biome };
        }
        return null;
    }

    // Tries each biome in order of preference; the first one found wins.
    findPreferredBiomeSpot(biomes, near, opts) {
        for (const b of biomes) {
            const spot = this.findBiomeSpot([b], near, opts);
            if (spot) return spot;
        }
        return null;
    }

    // Instantly clears trees, rocks and plants from a rectangle (off-camera prep).
    clearRect(r) {
        for (let y = r.y; y < r.y + r.h; y++) {
            for (let x = r.x; x < r.x + r.w; x++) {
                const t = this.tile(x, y);
                if (!t) continue;
                if (t.structure && PLANT_STRUCTURES.has(t.structure)) {
                    this.game.mapIndex.removeStructure(x, y, t.structure);
                    t.structure = null;
                    t.passable = true;
                }
                if (!t.resource) continue;
                t.resource = null;
                if (t.terrain === 'rock' || t.terrain === 'red_rock') { t.terrain = 'dirt'; t.passable = true; }
                if (t.designation?.type === 'chop' || t.designation?.type === 'mine') t.designation = null;
            }
        }
        this.game.taskQueue.tasks = this.game.taskQueue.tasks.filter(task =>
            !((task.type === 'chop' || task.type === 'mine') && task.x >= r.x && task.x < r.x + r.w && task.y >= r.y && task.y < r.y + r.h));
        this._dirty();
    }

    // ---- Resources and research -----------------------------------------

    grant(resources) { this.game.resources.add(resources); }

    // Makes sure the stockpile holds at least these amounts.
    stockAtLeast(resources) {
        const sp = this.game.resources.stockpile;
        for (const [k, v] of Object.entries(resources)) sp[k] = Math.max(sp[k] || 0, v);
    }

    emptyStockpile() {
        const sp = this.game.resources.stockpile;
        for (const k of Object.keys(sp)) sp[k] = 0;
    }

    research(keys) {
        for (const k of keys) this.game.research.completed.add(k);
        this.game.input?.refreshBuildOptions?.();
    }

    // ---- Buildings ---------------------------------------------------------

    // Places a finished structure instantly, with no colonist involved.
    place(x, y, type) {
        const game = this.game;
        const t = this.tile(x, y);
        const def = BUILDINGS[type];
        if (!t || !def) return false;
        t.resource = null;
        t.designation = null;
        if (def.structureType === 'floor') {
            t.floor = type;
        } else {
            if (t.structure) game.mapIndex.removeStructure(x, y, t.structure);
            t.structure = type;
            t.passable = !IMPASSABLE_STRUCTURES.has(type);
            if (def.hp) t.structureHp = def.hp;
            game.mapIndex.addStructure(x, y, type);
        }
        if (type === 'bed') for (const c of game.colonists) if (!c.golem && !c.assignedBed) game._autoAssignBedFor(c);
        game.markRoomsDirty();
        game.waves?.invalidatePathPreview?.();
        this._dirty();
        return true;
    }

    // Places a blueprint the way the player would. Pays the cost and grants the
    // research first so the order can never be refused mid-take.
    blueprint(x, y, type) {
        const def = BUILDINGS[type];
        if (!def) return false;
        if (def.cost) this.grant(def.cost);
        if (def.research) this.research([def.research]);
        const t = this.tile(x, y);
        if (t?.resource) { t.resource = null; this._dirty(); }
        return designateBuild(this.game, x, y, type) !== false;
    }

    // Finds an existing building of `type`, or instantly places one in open
    // ground near `near`. Returns its position.
    ensure(type, near = this.anchor, opts = {}) {
        const existing = this.find(type, near);
        if (existing) return existing;
        const spot = this.findOpenRect(1, 1, near, opts);
        if (!spot) return null;
        this.place(spot.x, spot.y, type);
        return { x: spot.x, y: spot.y };
    }

    // Nearest existing structure of `type` to `near`.
    find(type, near = this.anchor) {
        let best = null, bestD = Infinity;
        for (const key of this.game.mapIndex.getStructurePositions(type)) {
            const x = key & 0xFFFF, y = key >> 16;
            const d = Math.abs(x - near.x) + Math.abs(y - near.y);
            if (d < bestD) { bestD = d; best = { x, y }; }
        }
        return best;
    }

    count(type) { return this.game.mapIndex.getStructurePositions(type).size; }

    // Tile list for a walled room: perimeter walls in walking order (so placing
    // them one by one reads like a drag), a door on the given side, and
    // furniture slots inside. Floor tiles are the interior.
    roomPlan(r, { wall = 'wood_wall', door = 'door', doorSide = 'bottom', floor = null, furniture = [] } = {}) {
        const walls = [];
        for (let x = r.x; x < r.x + r.w; x++) walls.push({ x, y: r.y });
        for (let y = r.y + 1; y < r.y + r.h; y++) walls.push({ x: r.x + r.w - 1, y });
        for (let x = r.x + r.w - 2; x >= r.x; x--) walls.push({ x, y: r.y + r.h - 1 });
        for (let y = r.y + r.h - 2; y > r.y; y--) walls.push({ x: r.x, y });
        const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
        const doorPos = {
            bottom: { x: mid.x, y: r.y + r.h - 1 },
            top: { x: mid.x, y: r.y },
            left: { x: r.x, y: mid.y },
            right: { x: r.x + r.w - 1, y: mid.y },
        }[doorSide];
        const out = [];
        for (const p of walls) {
            const isDoor = p.x === doorPos.x && p.y === doorPos.y;
            out.push({ ...p, type: isDoor ? door : wall });
        }
        const interior = [];
        for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) interior.push({ x, y });
        if (floor) for (const p of interior) out.push({ ...p, type: floor });
        // Furniture along the back wall, left to right, skipping the door column.
        const slots = interior.filter(p => p.y === r.y + 1 && Math.abs(p.x - doorPos.x) > 0);
        furniture.forEach((type, i) => { if (slots[i]) out.push({ ...slots[i], type }); });
        return out;
    }

    // Instantly completes every pending build order (off-camera catch-up).
    finishBlueprints() {
        const game = this.game;
        for (let y = 0; y < game.map.length; y++) {
            const row = game.map[y];
            for (let x = 0; x < row.length; x++) {
                const d = row[x].designation;
                if (d?.type === 'build' && d.buildType) this.place(x, y, d.buildType);
            }
        }
        game.taskQueue.tasks = game.taskQueue.tasks.filter(t => t.type !== 'build');
        for (const c of game.colonists) {
            if (c.currentTaskId && !game.taskQueue.tasks.some(t => t.id === c.currentTaskId)) { c.currentTaskId = null; c.state = 'idle'; }
        }
    }

    pendingBuilds() { return this.game.taskQueue.tasks.filter(t => t.type === 'build').length; }

    // ---- Gathering ---------------------------------------------------------

    // Resource tiles near `near`, nearest first.
    findResources(kind, near = this.anchor, radius = 20) {
        const out = [];
        for (let y = Math.floor(near.y - radius); y <= near.y + radius; y++) {
            for (let x = Math.floor(near.x - radius); x <= near.x + radius; x++) {
                const t = this.tile(x, y);
                const type = t?.resource?.type;
                if (!type || t.designation || t.sealed) continue;
                if (kind === 'tree' ? type !== 'tree' : !ROCK_TYPES.has(type)) continue;
                out.push({ x, y, d: Math.hypot(x - near.x, y - near.y) });
            }
        }
        return out.sort((a, b) => a.d - b.d);
    }

    designate(tiles) {
        let n = 0;
        for (const p of tiles) {
            const type = this.tile(p.x, p.y)?.resource?.type;
            if (!type) continue;
            const ok = RESOURCES[type]?.designation === 'mine' ? designateMine(this.game, p.x, p.y) : designateChop(this.game, p.x, p.y);
            if (ok) n++;
        }
        return n;
    }

    farm(r, crop = 'wheat') {
        return designateFarmZone(this.game, r.x, r.y, r.x + r.w - 1, r.y + r.h - 1, crop);
    }

    // ---- Colonists -----------------------------------------------------------

    colonists() { return this.game.colonists.filter(c => c.hp > 0 && !c.golem && !c.onExpedition); }

    // Instantly moves a colonist (off-camera staging).
    teleport(c, x, y) {
        teleportEntity(c, x, y);
        c.path = [];
        c.draftTarget = null;
    }

    // Spreads colonists around a point (off-camera staging).
    gather(cols, near, spread = 1) {
        const spots = this.game.input.getSpreadPositions(Math.round(near.x), Math.round(near.y), cols.length * spread);
        cols.forEach((c, i) => { const p = spots[i * spread] || spots[0]; this.teleport(c, p.x, p.y); });
    }

    draft(c, on = true) { if (!!c.drafted !== on) this.game.toggleDraft(c.id); }

    // Walk a drafted colonist to a tile.
    walkTo(c, x, y) {
        this.draft(c, true);
        c.draftTarget = { x, y };
        c.path = [];
    }

    arrived(c, x, y, slack = 0) { return Math.abs(c.x - x) <= slack && Math.abs(c.y - y) <= slack && !c.draftTarget; }

    // Only the given colonist works `skill`; the others leave it alone.
    soloWorker(c, skill) {
        for (const o of this.colonists()) o.priorities[skill] = o === c ? 1 : 0;
    }

    priorities(c, values) { Object.assign(c.priorities, values); }

    // The colonist does nothing but `skill` (no wandering off to farm or haul).
    onlyWork(c, skill) {
        for (const k of Object.keys(c.priorities)) c.priorities[k] = 0;
        c.priorities[skill] = 1;
    }

    healAll() { for (const c of this.game.colonists) if (c.hp > 0) c.hp = c.maxHp; }

    spawnColonist(x, y, bias = 'building') {
        ({ x, y } = this.openNear({ x, y }));
        const c = createColonist(x, y, bias, this.game.colonists.map(o => o.name));
        this.game.addColonist(c);
        return c;
    }

    // ---- Gear ----------------------------------------------------------------

    hasItem(key) {
        const slot = GEAR_SLOTS[ALL_ITEMS[key]?.type];
        return !!slot && this.game.resources[slot.list].some(i => i.key === key);
    }

    giveItem(key) {
        const def = ALL_ITEMS[key];
        if (!def) { console.warn('[trailer] unknown item', key); return null; }
        const item = { ...def, key };
        this.game.resources.addItem(item);
        return item;
    }

    strip(c, slots = Object.keys(GEAR_SLOTS)) {
        for (const s of slots) if (c[s]) this.game[GEAR_SLOTS[s].unequip](c.id);
    }

    // Equips an item by key, granting it first if the stockpile has none.
    // `fx` adds a small sparkle at the colonist for on-camera equips.
    equip(c, key, { fx = false } = {}) {
        const def = ALL_ITEMS[key];
        const slot = def && GEAR_SLOTS[def.type];
        if (!slot) return false;
        const list = this.game.resources[slot.list];
        let idx = list.findIndex(i => i.key === key);
        if (idx === -1) { this.giveItem(key); idx = list.findIndex(i => i.key === key); }
        if (idx === -1) return false;
        this.game[slot.equip](c.id, idx);
        if (fx) {
            spawnProjectileImpact(this.game, c.x, c.y, '#ffdd66');
            window.soundManager?.playSFXPitched?.('spell_buff', 2);
        }
        return true;
    }

    kit(c, keys) { for (const k of keys) this.equip(c, k); }

    // Queues a crafting order, paying its inputs and research first.
    craft(recipeKey) {
        const r = RECIPES[recipeKey];
        if (!r) { console.warn('[trailer] unknown recipe', recipeKey); return false; }
        if (r.input) this.grant(r.input);
        if (r.research) this.research([].concat(r.research));
        return queueCraftingOrder(this.game, recipeKey) !== false;
    }

    recipeStation(recipeKey) { return RECIPES[recipeKey]?.station; }

    // ---- Animals -------------------------------------------------------------

    spawnAnimal(type, x, y) {
        ({ x, y } = this.openNear({ x, y }));
        const a = createWildAnimal(type, x, y);
        this.game.entities.push(a);
        this.game.wildAnimals.push(a);
        return a;
    }

    tame(animal) {
        this.research(['beast_binding']);
        this.grant({ food: 10 });
        return designateTame(this.game, animal.id);
    }

    // ---- Threats -------------------------------------------------------------

    // Starts a scripted raid and regroups the raiders around `from` so they
    // enter frame from a chosen direction instead of a random map edge.
    raid(type = 'warband_raid', from = null, level = 8) {
        const game = this.game;
        const before = new Set(game.raiders.map(r => r.id));
        game.combat.startScriptedRaid(game, type, level);
        game.events.pendingEvent = null;
        const fresh = game.raiders.filter(r => !before.has(r.id));
        if (from) {
            const spots = game.input.getSpreadPositions(Math.round(from.x), Math.round(from.y), fresh.length * 2);
            fresh.forEach((r, i) => { const p = spots[i * 2] || spots[i] || from; teleportEntity(r, p.x, p.y); r.path = []; });
            game.alertRipple = null;
        }
        return fresh;
    }

    raidOver() { return !this.game.combat.raidActive || this.game.raiders.every(r => r.hp <= 0 || r.fleeing); }

    // Starts a Nexus wave at a chosen wave number, optionally with hand-placed
    // portals. Restores the real wave record so the trailer doesn't count.
    wave(waveNumber = 4, portals = null) {
        const w = this.game.waves;
        const realBest = w.highestWaveCompleted;
        w.highestWaveCompleted = waveNumber - 1;
        const ok = w.startWave(this.game);
        w.highestWaveCompleted = realBest;
        if (!ok) return false;
        if (portals) { w.portals = portals.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })); w.invalidatePathPreview?.(); }
        return true;
    }

    waveOver() { return !this.game.waves.active; }

    // ---- Crypts ----------------------------------------------------------------

    // The anchor crypt for a chain (crystal and verdant are never warded).
    crypt(chain = 'crystal') {
        return this.game.ruins.list.find(r => r.kind === 'crypt' && r.chain === chain) || null;
    }

    // Ring wall tile to break in through: bottom of the center column, so the
    // gap opens straight onto the interior (movement is 4-directional).
    breachTile(ruin) {
        const { ring } = getCryptTiles(ruin.shape || 'rect', ruin.w, ruin.h, ruin.innerRadius || 0);
        const cx = Math.floor(ruin.w / 2);
        const col = ring.filter(t => t.x === cx).sort((a, b) => b.y - a.y);
        const t = col[0] || ring[0];
        return { x: ruin.x + t.x, y: ruin.y + t.y };
    }

    // The player's right-click order: breach a wall, loot a chest or attune an anchor.
    order(x, y) {
        if (this.tile(x, y)?.designation) return true;
        cancelDesignation(this.game, x, y);
        return !!this.tile(x, y)?.designation;
    }

    cryptGuardians(ruin) {
        return this.game.wildAnimals.filter(a => a.guardian && a.hp > 0 && a.home
            && a.home.x >= ruin.x && a.home.x < ruin.x + ruin.w && a.home.y >= ruin.y && a.home.y < ruin.y + ruin.h);
    }

    // ---- Expeditions -----------------------------------------------------------

    // Sends a manual expedition out of a specific gate tile.
    expedition(realm, cols, gate, { difficulty = 1 } = {}) {
        const expl = this.game.exploration;
        expl.fatigueCooldowns = {};
        // Chains with a crypt anchor need Planar Rifts before any launch.
        this.research(['planar_rift']);
        // Crystals placed during prepare haven't been counted yet (power updates on a tick cadence).
        this.game.power.update(this.game);
        for (const c of cols) this.draft(c, false);
        const origFind = expl.findLaunchPosition;
        expl.findLaunchPosition = () => ({ x: gate.x, y: gate.y });
        let exp;
        try {
            exp = expl.sendExpedition(this.game, realm, cols.map(c => c.id), [], difficulty, {});
        } finally {
            expl.findLaunchPosition = origFind;
        }
        return exp;
    }

    // Rebuilds the expedition route: the first `events` non-combat encounters,
    // then `fights` combats (weakened to `fightHp`), then the boss. Call before
    // the party departs.
    shapeExpedition(exp, { events = 3, fights = 1, fightHp = 1 } = {}) {
        const pickEvents = exp.encounters.filter(e => e.type !== 'combat').slice(0, events);
        const pickFights = exp.encounters.filter(e => e.type === 'combat' && !e.isBoss).slice(0, fights);
        for (const f of pickFights) for (const en of f.enemies || []) {
            en.hp = Math.max(1, Math.round(en.hp * fightHp));
            if (en.maxHp) en.maxHp = Math.max(1, Math.round(en.maxHp * fightHp));
        }
        exp.encounters = [...pickEvents, ...pickFights];
        exp.currentEncounter = 0;
        exp.nodeMap = this.game.exploration._generateNodeMap(exp.encounters, exp.bossEncounter);
    }

    // Drops every regular encounter so the next exploring tick starts the boss.
    skipToBoss(exp) {
        exp.encounters = [];
        exp.currentEncounter = 0;
        if (exp.nodeMap) exp.nodeMap = exp.nodeMap.filter(n => n.type === 'boss');
        exp.nextEncounterTick = this.game.tick;
    }

    // ---- Internals -------------------------------------------------------------

    _dirty() {
        this.game.renderer?.markTerrainDirty?.();
        this.game.minimap?.markTerrainDirty?.();
    }
}

export { isPassable };

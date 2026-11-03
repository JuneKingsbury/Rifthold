// Trailer scenes, in trailer order. Each scene is one take:
//
//   prepare(ctx)  Off-camera setup, run on load while paused. Makes the scene
//                 self-sufficient: anything it needs that an earlier take didn't
//                 leave behind is created instantly here.
//   shot(ctx)     Opening framing ({x, y, zoom}, world-center tiles).
//   run(ctx)      The take itself, after the countdown. Async; use ctx.sleep /
//                 ctx.until for timing and ctx.mark(label) for beats you want
//                 to sync music or edits to.
//
// Scene options: workMult (colonist work speed), timeOfDay (0..1 day fraction,
// null = natural day/night cycle), season, biomes (where the scene prefers to
// take place, in order of preference; it falls back to the village if the map
// has none of them nearby).
//
// Positions chosen by one scene (cabin, workbench, Nexus...) go in ctx.plan,
// which is saved with every snapshot, so later scenes reuse the same spots.

import { MIDGAME_RESEARCH } from './stage.js';
import { zoomToFit } from './cine-camera.js';

const at = (p, zoom) => ({ x: p.x + 0.5, y: p.y + 0.5, zoom });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// Shot framing every rect (with `margin` tiles around them), never closer than `maxZoom`.
function frameRects(rects, { margin = 2, maxZoom = 48 } = {}) {
    const x0 = Math.min(...rects.map(r => r.x)) - margin, x1 = Math.max(...rects.map(r => r.x + r.w)) + margin;
    const y0 = Math.min(...rects.map(r => r.y)) - margin, y1 = Math.max(...rects.map(r => r.y + r.h)) + margin;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.min(maxZoom, zoomToFit(x1 - x0, y1 - y0)) };
}
const centroid = (pts) => pts.length
    ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
    : null;

// The colonist the camera follows through crafting, gearing up and the raid.
function hero(ctx) {
    const cols = ctx.stage.colonists();
    let h = cols.find(c => c.id === ctx.plan.heroId);
    if (!h) {
        h = [...cols].sort((a, b) => (b.skills?.crafting || 0) - (a.skills?.crafting || 0))[0];
        if (h) ctx.plan.heroId = h.id;
    }
    return h;
}

// First cabin, campfire and workbench spots, chosen once and reused.
function homePlan(ctx) {
    const s = ctx.stage, p = ctx.plan;
    if (!p.cabin) p.cabin = s.findOpenRect(7, 5, ctx.anchor, { minDist: 3, margin: 2 }) || { x: ctx.anchor.x - 3, y: ctx.anchor.y - 8, w: 7, h: 5 };
    const c = p.cabin;
    if (!p.campfire) p.campfire = { x: c.x + 3, y: c.y + c.h + 2 };
    if (!p.workbench) p.workbench = { x: c.x + c.w + 2, y: c.y + c.h - 1 };
    if (!p.anvil) p.anvil = { x: p.workbench.x + 2, y: p.workbench.y };
    return p;
}

// Puts the first structures down instantly, for scenes loaded without the
// gathering take before them.
function ensureHome(ctx) {
    const s = ctx.stage, p = homePlan(ctx);
    // A take kept before its builds finished leaves blueprints behind.
    s.finishBlueprints();
    if (!s.find('bed')) {
        s.clearRect({ x: p.cabin.x - 1, y: p.cabin.y - 1, w: p.cabin.w + 2, h: p.cabin.h + 2 });
        for (const t of s.roomPlan(p.cabin, { furniture: ['bed', 'bed', 'bed'] })) s.place(t.x, t.y, t.type);
    }
    if (s.tile(p.campfire.x, p.campfire.y)?.structure !== 'campfire') s.place(p.campfire.x, p.campfire.y, 'campfire');
    if (s.tile(p.workbench.x, p.workbench.y)?.structure !== 'workbench') s.place(p.workbench.x, p.workbench.y, 'workbench');
}

function ensureForge(ctx) {
    const s = ctx.stage, p = homePlan(ctx);
    ensureHome(ctx);
    s.research(['metalworking']);
    if (s.tile(p.anvil.x, p.anvil.y)?.structure !== 'anvil') s.place(p.anvil.x, p.anvil.y, 'anvil');
}

const FIGHTER_KITS = [
    ['iron_sword', 'iron_chainmail', 'iron_helmet', 'leather_boots'],
    ['hunting_bow', 'leather_vest', 'leather_cap', 'leather_boots'],
    ['iron_sword', 'iron_brigandine', 'leather_cap', 'leather_boots'],
    ['hunting_bow', 'leather_vest', 'iron_helmet', 'leather_boots'],
];

// The raid's front three, one per fighting style: the hero keeps the sword
// forged and equipped in the earlier scenes, then a spear and a bow.
const RAID_KITS = [
    ['iron_sword', 'iron_chainmail', 'iron_helmet', 'leather_boots'],
    ['poison_tipped_spear', 'iron_brigandine', 'leather_cap', 'leather_boots'],
    ['hunting_bow', 'leather_vest', 'leather_cap', 'leather_boots'],
];

// Arms everyone who is missing a weapon, so later scenes always look geared up.
function armColony(ctx) {
    const s = ctx.stage;
    s.colonists().forEach((c, i) => { if (!c.weapon) s.kit(c, FIGHTER_KITS[i % FIGHTER_KITS.length]); });
}

function ensureMidgame(ctx) {
    const s = ctx.stage;
    s.research(MIDGAME_RESEARCH);
    s.stockAtLeast({ wood: 200, stone: 200, planks: 120, iron: 60, runite: 30, bricks: 40, leather: 40, food: 120, void_essence: 40 });
    ensureForge(ctx);
    // Power for turrets and the expedition gate.
    const p = ctx.plan;
    if (!p.crystals) {
        const spot = s.findOpenRect(4, 1, { x: p.cabin.x - 5, y: p.cabin.y + 2 }, { margin: 1 });
        p.crystals = spot ? [0, 1, 2, 3].map(i => ({ x: spot.x + i, y: spot.y })) : [];
    }
    for (const c of p.crystals) if (s.tile(c.x, c.y)?.structure !== 'mana_crystal') s.place(c.x, c.y, 'mana_crystal');
}

// Nexus site: a 13×13 buildable patch in a preferred biome, else north of the village.
function pickNexusSite(ctx, biomes) {
    const s = ctx.stage, v = s.rectCenter(homePlan(ctx).cabin);
    const spot = s.findPreferredBiomeSpot(biomes, v, { w: 13, h: 13, minDist: 16, maxDist: 70, minFrac: 0.75, buildable: true });
    if (spot) { ctx.plan.nexusBiome = spot.biome; return { x: spot.x, y: spot.y }; }
    const r = s.findOpenRect(11, 11, { x: v.x + 4, y: v.y - 22 }, { margin: 1, allowResource: true });
    ctx.plan.nexusBiome = 'village';
    return r ? { x: r.x + 5, y: r.y + 5 } : { x: Math.round(v.x), y: Math.round(v.y - 22) };
}

function undraftAll(ctx) { for (const c of ctx.stage.colonists()) ctx.stage.draft(c, false); }

export const SCENES = [
    // ------------------------------------------------------------------ 1
    {
        id: 'landing',
        name: 'Colonists arrive with nothing',
        timeOfDay: 0.24,          // early-morning warmth
        workMult: 1,
        prepare(ctx) {
            const s = ctx.stage;
            s.emptyStockpile();
            undraftAll(ctx);
            ctx.game.taskQueue.tasks = [];
            s.gather(s.colonists(), ctx.anchor, 2);
        },
        shot: ctx => at(ctx.anchor, 34),
        async run(ctx) {
            ctx.mark('open on colonists');
            // Slow pull-back revealing the untouched wilderness around them.
            await ctx.cam.move(at(ctx.anchor, 15), 10, 'sine');
            ctx.mark('wide');
            await ctx.sleep(1.5);
        },
    },

    // ------------------------------------------------------------------ 2
    {
        id: 'gathering',
        name: 'Speed chopping + first structures',
        timeOfDay: 0.4,
        workMult: 5,
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            undraftAll(ctx);
            for (const c of s.colonists()) s.priorities(c, { building: 1 });
            // Keep the build site itself clear so blueprints never fail.
            s.clearRect({ x: p.cabin.x - 1, y: p.cabin.y - 1, w: p.cabin.w + 2, h: p.cabin.h + 4 });
            s.clearRect({ x: p.workbench.x, y: p.workbench.y, w: 3, h: 1 });
            p.trees = s.findResources('tree', ctx.anchor, 22).slice(0, 14).map(({ x, y }) => ({ x, y }));
            // Mine at the edge of the mountains when they're in reach, for some rocky terrain in the shot.
            const rocks = s.findResources('rock', ctx.anchor, 30);
            const mountain = rocks.filter(r => s.tile(r.x, r.y)?.biome === 'mountain');
            p.rocks = (mountain.length >= 4 ? mountain : rocks).slice(0, 6).map(({ x, y }) => ({ x, y }));
        },
        shot(ctx) {
            const p = ctx.plan;
            const focus = centroid([...(p.trees || []), ...(p.rocks || [])]) || ctx.anchor;
            return at(mid(focus, ctx.stage.rectCenter(p.cabin)), 19);
        },
        async run(ctx) {
            const s = ctx.stage, p = ctx.plan;
            ctx.speed(2);
            // Designate in a left-to-right sweep, like a player dragging.
            const marks = [...p.trees, ...p.rocks].sort((a, b) => a.x - b.x);
            ctx.mark('chop orders');
            for (const m of marks) { s.designate([m]); await ctx.sleep(0.07); }
            await ctx.sleep(2.5);
            ctx.mark('blueprints');
            ctx.cam.move(at(s.rectCenter(p.cabin), 22), 14, 'sine');
            for (const t of s.roomPlan(p.cabin, { furniture: ['bed', 'bed', 'bed'] })) { s.blueprint(t.x, t.y, t.type); await ctx.sleep(0.05); }
            await ctx.sleep(0.3);
            s.blueprint(p.campfire.x, p.campfire.y, 'campfire');
            await ctx.sleep(0.3);
            s.blueprint(p.workbench.x, p.workbench.y, 'workbench');
            await ctx.until(() => s.pendingBuilds() === 0, 45);
            ctx.mark('village started');
            await ctx.sleep(2);
        },
    },

    // ------------------------------------------------------------------ 3
    {
        id: 'crafting',
        name: 'Crafting gear and gearing up',
        timeOfDay: 0.45,
        workMult: 1.5,
        // Crafted in order; each piece goes on the moment it comes off the station.
        gear: [
            { recipe: 'craft_iron_sword', item: 'iron_sword' },
            { recipe: 'craft_iron_helmet', item: 'iron_helmet' },
            { recipe: 'craft_iron_chainmail', item: 'iron_chainmail' },
            { recipe: 'craft_leather_boots', item: 'leather_boots' },
        ],
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureForge(ctx);
            undraftAll(ctx);
            const h = hero(ctx);
            s.strip(h);
            s.soloWorker(h, 'crafting');
            // Everyone else stays out of the shot doing other things.
            for (const c of s.colonists()) if (c !== h) s.priorities(c, { building: 1 });
            s.teleport(h, p.anvil.x - 3, p.anvil.y + 1);
            ctx.game.taskQueue.tasks = ctx.game.taskQueue.tasks.filter(t => t.type !== 'craft');
        },
        shot: ctx => at(ctx.plan.anvil, 34),
        async run(ctx) {
            const s = ctx.stage, h = hero(ctx);
            // Stay on the crafter as they move between the anvil and the workbench.
            ctx.cam.follow(h, { zoom: 40, lag: 0.6 });
            const game = ctx.game, gear = this.gear;
            const had = gear.map(g => s.itemCount(g.item));
            const order = (i) => { s.craft(gear[i].recipe); ctx.mark(`craft ${gear[i].item}`); };
            // True once the hero has picked up the order (it's no longer waiting in the queue).
            const claimed = () => !game.taskQueue.tasks.some(t => t.type === 'craft' && t.status === 'pending');
            order(0);
            for (let i = 0; i < gear.length; i++) {
                // Queue the next piece while this one is being made, so the hero
                // goes straight from one job to the next. With nothing queued they'd
                // go idle for a tick and wander off the tile between crafts.
                if (i + 1 < gear.length) {
                    await ctx.until(claimed, 20);
                    order(i + 1);
                }
                await ctx.until(() => s.itemCount(gear[i].item) > had[i], 40);
                s.equip(h, gear[i].item, { fx: true });
                ctx.mark(`equip ${gear[i].item}`);
            }
            await ctx.sleep(0.6);
            ctx.cam.move(at({ x: h.x, y: h.y }, 30), 3, 'inOut');
            await ctx.sleep(3);
        },
    },

    // ------------------------------------------------------------------ 4
    {
        id: 'raid',
        name: 'Fighting a raid',
        timeOfDay: 0.55,
        workMult: 1,
        raidType: 'warband_raid',
        raidDistance: 9,          // grid steps from the colonists' line to where the raiders appear
        // Exactly who shows up, every take: sword raiders and bow raiders.
        raidLineup: { raider_brute: 4, raider_archer: 2 },
        biomes: ['swamp', 'desert'],
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureHome(ctx);
            // Sword, spear and bow on the first three (hero first), whatever they carried before.
            const h = hero(ctx);
            const front = [h, ...s.colonists().filter(c => c !== h)].filter(Boolean).slice(0, RAID_KITS.length);
            front.forEach((c, i) => s.kit(c, RAID_KITS[i]));
            armColony(ctx);
            // Fast boots (+35% move speed) on the whole line, so they run down raiders instead of trailing them.
            for (const c of s.colonists()) s.equip(c, 'void_treads');
            const village = s.rectCenter(p.cabin);
            // Colonists head out to meet the raiders in the preferred biome;
            // without one nearby, they hold a line east of the village.
            // Open ground only: in a gap between rocks and water the fighters queue
            // single file and the ones behind never reach the raiders.
            const field = s.findPreferredBiomeSpot(this.biomes, village, { w: 20, h: 8, minDist: 12, maxDist: 60, minFrac: 0.6, open: true });
            const line = field || { x: village.x + 10, y: village.y + 2 };
            const dx = line.x - village.x, dy = line.y - village.y;
            const len = Math.hypot(dx, dy) || 1;
            p.raidBiome = field?.biome || 'village';
            p.raidLine = s.openNear(line);
            // `raidDistance` grid steps out (Manhattan, which is how the game
            // measures its 8-tile engage range), whichever direction they come from.
            const ux = dx / len, uy = dy / len, k = this.raidDistance / (Math.abs(ux) + Math.abs(uy));
            p.raidFrom = s.walkableNear({ x: p.raidLine.x + ux * k, y: p.raidLine.y + uy * k });
            const cols = s.colonists();
            // A battle line across the raiders' approach: melee side by side in
            // front, archers a row behind. Bunched any other way, whoever is at the
            // back of a column waits behind the colonist in front (colonists can't
            // walk through each other) while the rest are already fighting.
            const side = { x: -uy, y: ux };
            const rows = [cols.filter(c => !c.weapon?.ranged), cols.filter(c => c.weapon?.ranged)];
            const taken = new Set();
            rows.forEach((row, r) => row.forEach((c, i) => {
                const off = i - (row.length - 1) / 2;
                const spot = s.walkableNear({ x: p.raidLine.x + side.x * off - ux * r * 2, y: p.raidLine.y + side.y * off - uy * r * 2 }, 12, taken);
                s.teleport(c, spot.x, spot.y);
            }));
            // Undrafted, so the game's own raid response runs: each colonist takes
            // on raiders within reach and goes to help any friend fighting nearby,
            // which pulls the whole group in. (Drafted colonists hold position
            // unless a raider is within 8 tiles.) Held tasks are dropped so nobody
            // walks off to resume work first.
            for (const c of cols) {
                s.draft(c, false);
                if (c.currentTaskId) ctx.game.taskQueue.release(c.currentTaskId);
                c.currentTaskId = null;
                c.path = [];
                c.state = 'idle';
            }
        },
        shot: ctx => at(mid(ctx.plan.raidLine, ctx.plan.raidFrom), 28),
        async run(ctx) {
            const s = ctx.stage, p = ctx.plan, game = ctx.game;
            const raiders = s.raid(this.raidType, p.raidFrom, 8, { lineup: this.raidLineup });
            // Shorter fight: raiders are 40% as tough. Max HP shrinks with HP, so
            // they arrive at full health and only flee when the game normally would
            // (15% of max); cutting HP alone sent them fleeing after a hit or two.
            for (const r of raiders) { r.maxHp = r.hp = Math.ceil(r.maxHp * 0.4); }
            ctx.mark('raiders appear');
            ctx.cam.move(at(mid(p.raidLine, p.raidFrom), 34), 5, 'inOut');
            await ctx.until(() => game.raiders.some(r => game.colonists.some(c => c.hp > 0 && Math.abs(c.x - r.x) + Math.abs(c.y - r.y) <= 3)), 30);
            ctx.mark('clash');
            ctx.cam.shake(0.35, 0.3);
            // No scripted moves: the raiders start inside the drafted engage range,
            // so every colonist fights with their normal in-game behavior.
            // Frame the whole melee as it moves.
            ctx.cam.follow(() => centroid([...game.raiders, ...s.colonists()].filter(e => e.hp > 0)), { zoom: 34, lag: 1.2 });
            await ctx.until(() => s.raidOver(), 60);
            ctx.mark('raid defeated');
            await ctx.sleep(1);
            // Wounded colonists walk home to bed once undrafted; patch them up first.
            s.healAll();
            undraftAll(ctx);
            await ctx.sleep(2);
        },
    },

    // ------------------------------------------------------------------ 5
    {
        id: 'timelapse',
        name: 'Village time-lapse (buildings + taming)',
        timeOfDay: null,          // let day and night roll by
        workMult: 3,
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureHome(ctx);
            ensureMidgame(ctx);
            undraftAll(ctx);
            for (const c of s.colonists()) s.priorities(c, { building: 1, farming: 2, animals: 2 });
            const avoid = [p.cabin];
            const pick = (w, h, near, opts = {}) => {
                const r = s.findOpenRect(w, h, near, { margin: 1, avoid, ...opts });
                if (r) avoid.push(r);
                return r;
            };
            const v = s.rectCenter(p.cabin);
            p.expansion = {
                cabin2: pick(7, 5, { x: v.x - 9, y: v.y }),
                cabin3: pick(7, 5, { x: v.x + 9, y: v.y - 5 }),
                farm: pick(6, 4, { x: v.x - 7, y: v.y + 8 }),
                pen: pick(7, 6, { x: v.x + 9, y: v.y + 7 }),
                hall: pick(9, 6, { x: v.x, y: v.y - 9 }),
                workshop: pick(8, 6, { x: v.x - 10, y: v.y - 9 }),
            };
        },
        shot: ctx => at(ctx.stage.rectCenter(ctx.plan.cabin), 22),
        async run(ctx) {
            const s = ctx.stage, e = ctx.plan.expansion, game = ctx.game;
            const v = s.rectCenter(ctx.plan.cabin);
            ctx.speed(15);
            ctx.mark('timelapse start');
            // Long pull-back across the whole time-lapse, ending on a frame that
            // holds every new building. findOpenRect can push one well away from
            // its target spot when space is tight, so frame where they landed.
            const sites = [ctx.plan.cabin, ...Object.values(e).filter(Boolean)];
            if (e.pen) sites.push({ x: e.pen.x + e.pen.w + 3, y: e.pen.y + 1, w: 4, h: 4 });   // animals waiting to be tamed
            ctx.cam.move(frameRects(sites, { margin: 2, maxZoom: 16 }), 32, 'sine');
            const place = async (tiles) => { for (const t of tiles) { s.blueprint(t.x, t.y, t.type); await ctx.sleep(0.02); } };
            // Shell (walls, door, floor) first; the furniture goes in once the
            // floor under it is down, like a player furnishing a finished room.
            // These run alongside the rest of the take and are awaited at the end.
            const furnishing = [];
            const furnishWhenBuilt = (under, tiles) => {
                const job = (async () => {
                    await ctx.until(() => s.built(under), 40);
                    await place(typeof tiles === 'function' ? tiles() : tiles);
                })();
                job.catch(() => {});   // a cancelled take rejects it; the final await reports that
                furnishing.push(job);
            };
            const build = async (tiles) => {
                const furniture = tiles.filter(t => t.furniture);
                await place(tiles.filter(t => !t.furniture));
                if (furniture.length) furnishWhenBuilt(furniture, furniture);
            };
            if (e.cabin2) await build(s.roomPlan(e.cabin2, { doorSide: 'right', floor: 'wood_floor', furniture: ['bed', 'bed', 'nightstand', 'wardrobe', 'chair', 'candle'] }));
            await ctx.sleep(1.5);
            // Decorate the first cabin: floor it, then fill it out around the beds.
            ctx.mark('decorate bedroom');
            const firstFloor = s.floorPlan(ctx.plan.cabin, 'wood_floor');
            await place(firstFloor);
            furnishWhenBuilt(firstFloor, () => s.decorPlan(ctx.plan.cabin, ['wardrobe', 'nightstand', 'chair', 'rug', 'candle', 'potted_plant']));
            await ctx.sleep(1.5);
            if (e.farm) { s.farm(e.farm, 'wheat'); ctx.mark('farm'); }
            await ctx.sleep(1.5);
            if (e.pen) {
                ctx.mark('animal pen');
                await build(s.roomPlan(e.pen, { wall: 'fence', door: 'fence_gate', doorSide: 'left' }));
                s.blueprint(e.pen.x + 3, e.pen.y + 2, 'beast_circle');
            }
            await ctx.sleep(2);
            s.spawnColonist(Math.round(v.x - 30), Math.round(v.y + 4), 'farming');
            ctx.mark('newcomer');
            if (e.cabin3) await build(s.roomPlan(e.cabin3, { doorSide: 'left', floor: 'wood_floor', furniture: ['bed', 'bed', 'table', 'chair', 'shelf', 'candle'] }));
            // Animals to tame once the beast circle is up.
            const animals = e.pen ? ['cow', 'sheep', 'chicken', 'deer'].map((type, i) =>
                s.spawnAnimal(type, e.pen.x + e.pen.w + 3 + i, e.pen.y + 1 + (i % 2) * 3)) : [];
            await ctx.sleep(2);
            if (e.workshop) {
                ctx.mark('workshop');
                await build(s.roomPlan(e.workshop, { floor: 'wood_floor', furniture: ['workbench', 'loom', 'alchemy_table', 'tool_rack', 'crate', 'stool', 'candle'] }));
            }
            await ctx.sleep(1);
            if (e.hall) {
                ctx.mark('town hall');
                await build(s.roomPlan(e.hall, { wall: 'stone_wall', floor: 'wood_floor', furniture: ['town_hall_banner', 'statue', 'table', 'chair', 'chair', 'bench', 'bench', 'candle', 'potted_plant'] }));
            }
            if (e.pen) {
                await ctx.until(() => !!s.find('beast_circle'), 20);
                for (const a of animals) { s.tame(a); await ctx.sleep(0.3); }
                ctx.mark('taming');
            }
            await ctx.sleep(2);
            s.spawnColonist(Math.round(v.x + 30), Math.round(v.y - 2), 'crafting');
            await Promise.all(furnishing);
            await ctx.until(() => s.pendingBuilds() === 0 && animals.every(a => !game.entities.includes(a) || a.tamed), 30);
            ctx.mark('village grown');
            await ctx.sleep(2);
            ctx.speed(1);
        },
    },

    // ------------------------------------------------------------------ 6
    {
        id: 'nexus_build',
        name: 'Building the Nexus and defenses',
        timeOfDay: 0.62,
        workMult: 5,
        biomes: ['desert', 'tundra'],
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureMidgame(ctx);
            undraftAll(ctx);
            for (const c of s.colonists()) s.priorities(c, { building: 1 });
            if (!p.nexus) p.nexus = pickNexusSite(ctx, this.biomes);
            s.clearRect({ x: p.nexus.x - 6, y: p.nexus.y - 6, w: 13, h: 13 });
            // The builders are already on site when the shot opens.
            s.gather(s.colonists(), { x: p.nexus.x, y: p.nexus.y + 7 }, 1);
        },
        shot: ctx => at(ctx.plan.nexus, 20),
        async run(ctx) {
            const s = ctx.stage, n = ctx.plan.nexus;
            ctx.speed(3);
            ctx.mark('nexus blueprint');
            s.blueprint(n.x, n.y, 'void_nexus');
            await ctx.sleep(0.8);
            ctx.cam.move(at(n, 27), 16, 'sine');
            // Stone ring with four entrances, walled in a sweep.
            const ring = [];
            for (let d = -4; d <= 4; d++) {
                ring.push({ x: n.x + d, y: n.y - 4 }, { x: n.x + 4, y: n.y + d }, { x: n.x - d, y: n.y + 4 }, { x: n.x - 4, y: n.y - d });
            }
            const seen = new Set();
            for (const t of ring) {
                const k = `${t.x},${t.y}`;
                if (seen.has(k) || t.x === n.x || t.y === n.y) continue;   // gaps on the axes
                seen.add(k);
                s.blueprint(t.x, t.y, 'stone_wall');
                await ctx.sleep(0.03);
            }
            ctx.mark('walls');
            for (const [dx, dy] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) { s.blueprint(n.x + dx, n.y + dy, 'arcane_sentinel'); await ctx.sleep(0.25); }
            ctx.mark('sentinels');
            await ctx.until(() => s.pendingBuilds() === 0, 50);
            ctx.mark('defenses complete');
            await ctx.sleep(2.5);
        },
    },

    // ------------------------------------------------------------------ 7
    {
        id: 'nexus_defend',
        name: 'Protecting the Nexus',
        timeOfDay: 0.8,           // dusk for the void portals to pop
        workMult: 1,
        wave: 5,
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureMidgame(ctx);
            armColony(ctx);
            if (!p.nexus) p.nexus = pickNexusSite(ctx, SCENES.find(sc => sc.id === 'nexus_build').biomes);
            const n = p.nexus;
            if (!s.find('void_nexus')) {
                s.clearRect({ x: n.x - 6, y: n.y - 6, w: 13, h: 13 });
                s.place(n.x, n.y, 'void_nexus');
                for (const [dx, dy] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) s.place(n.x + dx, n.y + dy, 'arcane_sentinel');
            }
            const cols = s.colonists();
            s.gather(cols, { x: n.x, y: n.y + 2 }, 1);
            for (const c of cols) s.draft(c, true);
        },
        shot: ctx => at(ctx.plan.nexus, 17),
        async run(ctx) {
            const s = ctx.stage, n = ctx.plan.nexus;
            s.wave(this.wave, [s.openNear({ x: n.x - 18, y: n.y - 2 }), s.openNear({ x: n.x + 18, y: n.y + 3 })]);
            ctx.mark('wave begins');
            ctx.cam.move(at(n, 22), 20, 'sine');
            await ctx.until(() => s.waveOver(), 120);
            ctx.mark('wave cleared');
            await ctx.sleep(1);
            s.healAll();
            undraftAll(ctx);
            await ctx.sleep(2);
        },
    },

    // ------------------------------------------------------------------ 8
    {
        id: 'crypt',
        name: 'Breach & clear a crypt',
        timeOfDay: 0.68,
        workMult: 3,
        chain: 'crystal',
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx), game = ctx.game;
            ensureMidgame(ctx);
            armColony(ctx);
            undraftAll(ctx);
            const ruin = s.crypt(this.chain);
            if (!ruin) { ctx.log(`This map has no ${this.chain} crypt.`); return; }
            if (ruin.state !== 'sealed') ctx.log('This crypt was already breached in this snapshot. Load an earlier one to reshoot it.');
            // Traps fire at random on whoever steps on them; keep the take predictable.
            for (const t of ruin.traps || []) t.armed = false;
            p.crypt = { x: ruin.x, y: ruin.y, w: ruin.w, h: ruin.h };
            p.breach = s.breachTile(ruin);
            // Only the breacher works; the rest stand guard, drafted, behind them.
            const squad = s.colonists().slice(0, 4);
            p.squad = squad.map(c => c.id);
            game.taskQueue.tasks = game.taskQueue.tasks.filter(t => t.type === 'build');
            for (const c of s.colonists()) s.priorities(c, { building: 0 });
            s.onlyWork(squad[0], 'building');
            s.gather(squad, { x: p.breach.x, y: p.breach.y + 4 }, 1);
            for (const c of squad.slice(1)) s.draft(c, true);
        },
        shot(ctx) {
            const c = ctx.plan.crypt;
            return c ? at({ x: c.x + c.w / 2 - 0.5, y: c.y + c.h / 2 + 1 }, 26) : at(ctx.anchor, 22);
        },
        async run(ctx) {
            const s = ctx.stage, p = ctx.plan, game = ctx.game;
            const ruin = s.crypt(this.chain);
            if (!ruin || ruin.state !== 'sealed') { ctx.log('No sealed crypt to breach.'); return; }
            const squad = p.squad.map(id => game.getColonist(id)).filter(Boolean);
            const center = { x: ruin.x + ruin.w / 2 - 0.5, y: ruin.y + ruin.h / 2 - 0.5 };

            ctx.mark('breach order');
            s.order(p.breach.x, p.breach.y);
            ctx.cam.move(at({ x: center.x, y: center.y + 1 }, 30), 6, 'sine');
            await ctx.until(() => ruin.state === 'open', 25);
            ctx.mark('wall breached');
            ctx.cam.shake(0.4, 0.3);

            // Everyone storms the interior; drafted colonists fight what's in reach.
            await ctx.sleep(0.6);
            const inside = { x: p.breach.x, y: p.breach.y - 1 };
            squad.forEach((c, i) => s.walkTo(c, inside.x + (i % 2 ? 1 : -1) * Math.ceil(i / 2), inside.y - (i > 2 ? 1 : 0)));
            ctx.cam.follow(() => centroid([...s.cryptGuardians(ruin), ...squad]) || center, { zoom: 32, lag: 0.8 });
            await ctx.until(() => s.cryptGuardians(ruin).length === 0, 30);
            ctx.mark('guardians slain');
            await ctx.sleep(1);
            // Wounded colonists would walk home to bed instead of looting.
            s.healAll();

            // Loot, then wake the anchor.
            // Building is their only job now, or they drift off to the farm.
            for (const c of squad) { s.draft(c, false); s.onlyWork(c, 'building'); }
            ctx.cam.move(at(center, 32), 2, 'inOut');
            for (const chest of ruin.loot) { if (!chest.taken) s.order(chest.x, chest.y); await ctx.sleep(0.2); }
            await ctx.until(() => ruin.loot.every(l => l.taken), 25);
            ctx.mark('chests looted');
            await ctx.sleep(0.6);
            s.order(ruin.anchor.x, ruin.anchor.y);
            ctx.cam.move(at(ruin.anchor, 36), 5, 'sine');
            await ctx.until(() => ruin.anchor.attuned, 25);
            ctx.mark('anchor attuned');
            await ctx.sleep(3);
        },
    },

    // ------------------------------------------------------------------ 9
    {
        id: 'expedition',
        name: 'Expedition → Crystal Colossus → title card',
        tailSeconds: 4,           // let the title card hold at the end of the clip
        timeOfDay: 0.5,
        workMult: 1,
        realm: 'crystal_depths',
        // Node route: `events` non-combat nodes, then `fights` combats (enemies at
        // `fightHp` of normal health so they don't drag), then the boss.
        expedition: { events: 3, fights: 1, fightHp: 1, nodeGapSeconds: 2.5 },
        prepare(ctx) {
            const s = ctx.stage, p = homePlan(ctx);
            ensureMidgame(ctx);
            armColony(ctx);
            undraftAll(ctx);
            // Launch from the crypt anchor attuned in the crypt scene; fall back to a
            // rift gate by the village if this scene is shot on its own.
            const anchor = ctx.game.ruins.getAnchor('crystal');
            if (anchor?.attuned) {
                p.gate = { x: anchor.x, y: anchor.y };
            } else {
                if (!p.gate || s.tile(p.gate.x, p.gate.y)?.structure?.startsWith('rift_anchor')) {
                    const v = s.rectCenter(p.cabin);
                    const r = s.findOpenRect(1, 1, { x: v.x - 8, y: v.y - 10 }, { margin: 2 });
                    p.gate = r ? { x: r.x, y: r.y } : { x: Math.round(v.x - 8), y: Math.round(v.y - 10) };
                }
                if (s.tile(p.gate.x, p.gate.y)?.structure !== 'rift_gate') s.place(p.gate.x, p.gate.y, 'rift_gate');
            }
            ctx.game.exploration.expeditions = ctx.game.exploration.expeditions.filter(e => e.autoMode);
            ctx.game.exploration.pendingSummary = null;
            // Bring back anyone still away on the previous take's expedition
            // (stage.colonists() skips them, so go through the full list).
            for (const c of ctx.game.colonists) {
                if (!c.onExpedition && !c.expeditionPending) continue;
                c.onExpedition = false;
                c.expeditionPending = false;
                c._expeditionMove = false;
                c.state = 'idle';
            }
            s.gather(s.colonists(), { x: p.gate.x, y: p.gate.y + 5 }, 1);
        },
        shot: ctx => at({ x: ctx.plan.gate.x, y: ctx.plan.gate.y + 2 }, 30),
        async run(ctx) {
            const s = ctx.stage, gate = ctx.plan.gate, game = ctx.game, cfg = this.expedition;
            const party = s.colonists().slice(0, 4);
            const exp = s.expedition(this.realm, party, gate);
            if (!exp) { ctx.log('Expedition refused to launch (check the console).'); return; }
            // A handful of event nodes and one fight, in the order the realm rolled
            // them, then the boss. The game's own pacing runs the route; only the
            // walk between nodes is shortened.
            const gapTicks = Math.round(cfg.nodeGapSeconds * 5 * 2);   // 5 ticks/s at 1x, running at 2x
            s.shapeExpedition(exp, { events: cfg.events, fights: cfg.fights, fightHp: cfg.fightHp, gapTicks });
            ctx.mark('party heads to the rift');
            ctx.cam.move(at(gate, 36), 5, 'inOut');
            await ctx.until(() => exp.status !== 'gathering', 30);
            ctx.mark('through the rift');
            await ctx.sleep(0.6);
            ctx.openExpeditionView();
            ctx.mark('expedition view');
            ctx.speed(2);
            // The view starts the party's walk from the moment it opens, so the
            // first node waits a full gap from here too (no lurch on arrival).
            exp.nextEncounterTick = game.tick + gapTicks;

            // Choice nodes are held briefly on screen, then resolved by the director.
            let lastNode = -1;
            while (!exp.bossTriggered && exp.status === 'exploring') {
                if (exp.currentEncounter !== lastNode) {
                    lastNode = exp.currentEncounter;
                    const enc = exp.encounters[lastNode - 1];
                    if (enc) ctx.mark(enc.type === 'combat' ? 'fight' : `event: ${enc.type}`);
                }
                await ctx.sleep(0.1);
            }
            await ctx.until(() => exp.combat?.isBoss, 30);
            ctx.mark('boss appears');
            await ctx.sleep(ctx.settings.bossHoldSeconds);
            ctx.freeze();
            ctx.mark('cut');
            if (ctx.settings.titleCard) {
                await ctx.titleCard();
                ctx.mark('title card');
            }
        },
    },
];

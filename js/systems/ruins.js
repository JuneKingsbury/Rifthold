/**
 * Ruin registry: the saved record of every ruin on the map (landmarks with Arcane
 * Cores, generic temples and watchtowers, and sealed crypts). Tiles carry only the
 * terrain and structures a ruin was stamped with, so anything a ruin owns beyond
 * that (state, loot, traps, guardians) lives here and round-trips through the save.
 *
 * Crypts start sealed: their interior tiles carry tile.sealed and render dark. Any
 * gap in the wall ring (deconstructed, broken by an enemy, burned) breaches the
 * crypt, which wakes its guardians and arms its traps.
 */
import { CONFIG, CRYPT_CONFIG, REALMS, BUILDINGS, getCryptTiles } from '../core/config.js';
import { createWildAnimal } from '../entities/entity-factory.js';
import { colonistTakeDamage } from '../entities/colonist.js';

let nextRuinId = 1;

// How close (tiles) a colonist must come to mark a crypt as discovered on the minimap.
const DISCOVERY_RANGE = 10;
// Slow checks (ring scan, discovery) run on this tick interval. Traps run every tick,
// because a colonist crosses a tile faster than that.
const SCAN_INTERVAL = 10;

/**
 * Fills in every registry field a ruin record can carry, so later systems can rely
 * on the shape whatever created the record.
 *
 * @param {object} seed Generation-time record from map.js (kind, blueprint, footprint, and for crypts tier, interior, loot, traps, guardians).
 * @return {object} A complete ruin record with a fresh id.
 */
function createRuin(seed) {
    const isCrypt = seed.kind === 'crypt';
    return {
        ...seed,
        id: nextRuinId++,
        // Landmarks are always open: nothing may stand between a player and a core.
        state: isCrypt ? 'sealed' : 'open',
        discovered: !isCrypt,
    };
}

/**
 * @param {string} chain Realm chain key.
 * @return {string|null} Key of the chain's boss realm, whose completion finishes the chain.
 */
function bossRealmOf(chain) {
    const entry = Object.entries(REALMS).find(([, r]) => r.chain === chain && r.boss);
    return entry ? entry[0] : null;
}

function chainComplete(game, chain) {
    const boss = bossRealmOf(chain);
    return !!boss && !!game.exploration?.completedRealms.has(boss);
}

// A crypt's ring and interior as absolute map tiles, derived from its shape and size
// (see getCryptTiles) and cached per record, since sealed crypts are scanned often.
const tileCache = new WeakMap();
function cryptTiles(ruin) {
    let tiles = tileCache.get(ruin);
    if (!tiles) {
        const rel = getCryptTiles(ruin.shape || 'rect', ruin.w, ruin.h, ruin.innerRadius || 0);
        const abs = list => list.map(t => ({ x: ruin.x + t.x, y: ruin.y + t.y }));
        tiles = { ring: abs(rel.ring), interior: abs(rel.interior) };
        tileCache.set(ruin, tiles);
    }
    return tiles;
}

function ringBroken(map, ruin) {
    return cryptTiles(ruin).ring.some(({ x, y }) => {
        const tile = map[y][x];
        return !tile.structure || tile.passable;
    });
}

export class RuinSystem {
    /**
     * @param {Array<object>} generated Records from takeGeneratedRuins().
     */
    constructor(generated = []) {
        nextRuinId = 1;
        this.list = generated.map(createRuin);
    }

    /**
     * @param {number} x Tile x.
     * @param {number} y Tile y.
     * @return {object|null} The ruin whose footprint contains the tile, if any.
     */
    getRuinAt(x, y) {
        for (const r of this.list) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
        }
        return null;
    }

    /**
     * Per-tick upkeep: arms/fires traps every tick, and every SCAN_INTERVAL ticks
     * checks sealed crypts for a breach and marks nearby crypts discovered.
     *
     * @param {object} game Game instance.
     */
    update(game) {
        const scan = game.tick % SCAN_INTERVAL === 0;
        for (const ruin of this.list) {
            if (ruin.kind !== 'crypt') continue;
            if (ruin.state === 'sealed') {
                if (!scan) continue;
                if (ruin.ward) {
                    // A ward is unbreakable, so there is nothing to breach until it lifts.
                    if (chainComplete(game, ruin.ward.chain)) this._liftWard(game, ruin);
                    else this._checkDiscovery(game, ruin);
                    continue;
                }
                if (ringBroken(game.map, ruin)) this._breach(game, ruin);
                else this._checkDiscovery(game, ruin);
            } else {
                this._updateTraps(game, ruin);
            }
        }
    }

    /**
     * @param {object} ruin A crypt record with an active ward.
     * @return {string} Sentence naming the chain a ward is bound to and what lifts it.
     */
    wardText(ruin) {
        const chainName = CRYPT_CONFIG.chainNames[ruin.ward.chain] || ruin.ward.chain;
        const bossName = REALMS[bossRealmOf(ruin.ward.chain)]?.name;
        return `Its seal is bound to the ${chainName} rift${bossName ? ` and will fade once ${bossName} is cleared` : ''}.`;
    }

    _liftWard(game, ruin) {
        const wallType = ruin.ward.wall;
        for (const { x, y } of cryptTiles(ruin).ring) {
            const tile = game.map[y][x];
            if (tile.structure !== 'warded_wall') continue;
            if (game.mapIndex) {
                game.mapIndex.removeStructure(x, y, 'warded_wall');
                game.mapIndex.addStructure(x, y, wallType);
            }
            tile.structure = wallType;
            tile.structureHp = BUILDINGS[wallType].hp;
        }
        ruin.ward = null;
        game.markRoomsDirty();
        game.renderer?.markTerrainDirty();
        game.minimap?.markTerrainDirty();
        game.eventLog.add(game, 'A ward on an ancient crypt has faded. Its walls can be broken now.', 'event', { type: 'position', x: ruin.x, y: ruin.y });
    }

    _checkDiscovery(game, ruin) {
        if (ruin.discovered) return;
        const cx = ruin.x + ruin.w / 2, cy = ruin.y + ruin.h / 2;
        const reach = DISCOVERY_RANGE + Math.max(ruin.w, ruin.h) / 2;
        for (const c of game.colonists) {
            if (c.hp <= 0) continue;
            if (Math.abs(c.x - cx) <= reach && Math.abs(c.y - cy) <= reach) {
                ruin.discovered = true;
                game.minimap?.markTerrainDirty();
                let text = ruin.anchor
                    ? 'A sealed crypt hums with rift energy.'
                    : 'A sealed crypt stands here, its seal unbroken.';
                if (ruin.ward) text = `A warded crypt. ${this.wardText(ruin)}`;
                game.eventLog.add(game, text, 'event', { type: 'position', x: ruin.x, y: ruin.y });
                return;
            }
        }
    }

    _breach(game, ruin) {
        ruin.state = 'open';
        ruin.discovered = true;
        ruin.breachedTick = game.tick;

        for (const { x, y } of cryptTiles(ruin).interior) game.map[y][x].sealed = false;

        // Peaceful mode removes hostile wildlife, so a crypt's guardians and traps go with it.
        if (CONFIG.PEACEFUL_MODE) {
            ruin.guardians = [];
            for (const t of ruin.traps) t.armed = false;
        }

        const hpMult = CRYPT_CONFIG.guardianHpMult[ruin.tier] || 1;
        for (const g of ruin.guardians) {
            const guardian = createWildAnimal(g.type, g.x, g.y);
            if (!guardian) continue;
            guardian.guardian = true;
            guardian.home = { x: g.x, y: g.y };
            guardian.hp = guardian.maxHp = Math.round(guardian.maxHp * hpMult);
            game.entities.push(guardian);
            game.wildAnimals.push(guardian);
        }
        // Guardians are live entities from here on (and saved with them).
        ruin.guardians = [];

        game.markRoomsDirty();
        game.renderer?.markTerrainDirty();
        game.minimap?.markTerrainDirty();
        game.eventLog.add(game, 'A crypt has been breached! Something stirs inside.', 'warning', { type: 'position', x: ruin.x, y: ruin.y });
        window.soundManager?.playSFXAt('chop_hit', ruin.x, ruin.y);
    }

    _updateTraps(game, ruin) {
        for (const trap of ruin.traps) {
            if (!trap.armed) continue;
            const victim = game.colonists.find(c => c.hp > 0 && !c.onExpedition && c.x === trap.x && c.y === trap.y);
            if (!victim) continue;
            trap.armed = false;
            colonistTakeDamage(victim, CRYPT_CONFIG.trapDamage[ruin.tier] || 8, game, null);
            game.combatEffects.push({ x: trap.x, y: trap.y, char: '^', color: '#cc3333', ttl: 8 });
            game.overlays.push({ type: 'floating_text', x: trap.x, y: trap.y, text: 'Trap!', color: '#ff5555', fontSize: 11, ttl: 14, maxTtl: 14 });
        }
    }

    /**
     * Gives the party a chest's stored contents and empties the chest. A crypt is
     * cleared once every chest in it has been looted.
     *
     * @param {object} game Game instance.
     * @param {number} x Chest tile x.
     * @param {number} y Chest tile y.
     * @return {boolean} True if a chest was looted.
     */
    lootChest(game, x, y) {
        const ruin = this.getRuinAt(x, y);
        const chest = ruin?.loot?.find(c => c.x === x && c.y === y && !c.taken);
        if (!chest) return false;

        chest.taken = true;
        game.resources.add(chest.contents);

        const tile = game.map[y][x];
        if (game.mapIndex) {
            game.mapIndex.removeStructure(x, y, tile.structure);
            game.mapIndex.addStructure(x, y, 'ancient_chest_open');
        }
        tile.structure = 'ancient_chest_open';

        const summary = Object.entries(chest.contents).map(([res, amt]) => `${amt} ${res.replace(/_/g, ' ')}`).join(', ');
        game.eventLog.add(game, `Looted a crypt chest: ${summary}`, 'success', { type: 'position', x, y });
        game.overlays.push({ type: 'floating_text', x, y, text: summary, color: '#ffd24a', fontSize: 11, ttl: 20, maxTtl: 20 });

        if (ruin.loot.every(c => c.taken)) {
            ruin.state = 'cleared';
            game.eventLog.add(game, 'The crypt has been plundered.', 'event', { type: 'position', x: ruin.x, y: ruin.y });
        }
        return true;
    }

    /** @return {boolean} True if this map has any rift anchors (false for saves from before them). */
    hasAnchors() {
        return this.list.some(r => r.anchor);
    }

    /**
     * The legacy Rift Gate stays buildable while any expedition chain lacks an anchor:
     * all of them on saves from before anchors, and a modded chain or a chain whose
     * crypt could not be placed on an unusually small map.
     *
     * @return {boolean} True if the Rift Gate may still be built.
     */
    needsLegacyGate() {
        if (!this.hasAnchors()) return true;
        const chains = new Set(Object.values(REALMS).filter(r => !r.scoutingMode).map(r => r.chain));
        return [...chains].some(chain => !this.getAnchor(chain));
    }

    /**
     * @param {string} chain Realm chain key, e.g. 'verdant'.
     * @return {object|null} The chain's anchor record {x, y, chain, attuned}, if the map has one.
     */
    getAnchor(chain) {
        return this.list.find(r => r.anchor && r.anchor.chain === chain)?.anchor || null;
    }

    /**
     * Marks the anchor at a tile as attuned. Its tile becomes the portal where
     * expeditions to the anchor's realm chain assemble and depart.
     *
     * @param {object} game Game instance.
     * @param {number} x Anchor tile x.
     * @param {number} y Anchor tile y.
     * @return {boolean} True if an unattuned anchor was attuned.
     */
    attuneAnchor(game, x, y) {
        const ruin = this.getRuinAt(x, y);
        const anchor = ruin?.anchor;
        if (!anchor || anchor.attuned || anchor.x !== x || anchor.y !== y) return false;

        anchor.attuned = true;
        const tile = game.map[y][x];
        if (game.mapIndex) {
            game.mapIndex.removeStructure(x, y, tile.structure);
            game.mapIndex.addStructure(x, y, 'rift_anchor_active');
        }
        tile.structure = 'rift_anchor_active';

        const name = CRYPT_CONFIG.chainNames[anchor.chain] || anchor.chain;
        game.eventLog.add(game, `The ${name} rift anchor is attuned. Expeditions to the ${name} realms can now gather here.`, 'success', { type: 'position', x, y });
        game.overlays.push({ type: 'floating_text', x, y, text: `${name} rift open`, color: '#aaf0ff', fontSize: 11, ttl: 24, maxTtl: 24 });
        window.soundManager?.playSFXAt('chop_hit', x, y);
        return true;
    }

    serialize() {
        return JSON.parse(JSON.stringify(this.list));
    }

    /**
     * Restores the registry from a save. Old saves have none, which leaves the
     * registry empty rather than guessing at ruins the map no longer records.
     *
     * @param {Array<object>|undefined} data Value from the save's `ruins` field.
     */
    deserialize(data) {
        this.list = Array.isArray(data) ? JSON.parse(JSON.stringify(data)) : [];
        nextRuinId = this.list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    }
}

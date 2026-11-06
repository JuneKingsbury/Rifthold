import { CONFIG, EVENTS, THOUGHTS, SKILLS, TRADE_VALUES, TRADER_MARKUP, TRADER_DISCOUNT, TIER_BUY_MARKUP, ALL_ITEMS, MERCHANTS, BLIGHT_CONFIG, TRAITS, ARRIVAL_BONDS, PLANT_STRUCTURES, TERRAIN } from '../core/config.js';
import { rollItem, getItemTradeValue } from '../entities/item-roll.js';
import { createColonist, addThought, applyThought } from '../entities/colonist.js';
import { createWildAnimal, getNextId } from '../entities/entity-factory.js';
import { getPedestalEffect } from './artifacts.js';
import { isPassable } from '../world/map.js';
import { t, tp, hasKey, defMessage, defRef, defText } from '../core/i18n.js';

/**
 * Computes effective trade rates for the current game state.
 * Rates are affected by: Trade Routes research, pedestal items (Haggler's Coin, Merchant's Ring).
 *
 * @param {object} game - Game instance (needs game.research, pedestal effects)
 * @returns {{ markup: number, discount: number }}
 *   markup  - multiplier on item base value when BUYING from trader (higher = more expensive)
 *   discount - multiplier on item base value when SELLING to trader (lower = less value received)
 */
export function getTradeRates(game) {
    const markupMult = getPedestalEffect(game, 'tradeMarkupMult');
    const tradeRoutesMult = game.research.isResearched('trade_routes') ? (110 / 120) : 1;
    // A living Silver Tongue colonist improves deals colony-wide (one applies, no stacking).
    const silverTongue = game.colonists?.some(c => c.hp > 0 && !c.onExpedition && c.traits?.includes('silver_tongue'))
        ? TRAITS.silver_tongue.tradeMarkupMult
        : 1;
    return {
        markup: TRADER_MARKUP * markupMult * tradeRoutesMult * silverTongue,
        discount: (game.research.isResearched('trade_routes') ? 0.85 : TRADER_DISCOUNT) / silverTongue,
    };
}

// Weighted pick of a QUALITY_TIERS key from a { qualityKey: weight } map.
// Falls back to 'normal' if the map is empty/absent.
function weightedQuality(weights) {
    const entries = Object.entries(weights || {}).filter(([, w]) => w > 0);
    if (!entries.length) return 'normal';
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = Math.random() * total;
    for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

// Returns the average sell-value multiplier for selling `amount` units of `key`
// in this visit, accounting for units already sold (tradeData.saturation).
// Each unit sold in a visit reduces its value by 8%, floored at 40%.
function _saturationMult(tradeData, key, amount) {
    if (!tradeData) return 1;
    const sold = tradeData.saturation?.[key] || 0;
    let total = 0;
    for (let i = 0; i < amount; i++) {
        total += Math.max(0.4, 1.0 - (sold + i) * 0.05);
    }
    return total / amount;
}

/**
 * Calculates gold values for a trade offer and request.
 * Gold is always valued 1:1. Resources use base value × rate.
 * Special keys: '__exclusive_N' (trader's Nth unique item), '__gold' (direct gold request).
 *
 * @param {object} offer - { resource: amount } the player is giving
 * @param {object} request - { resource: amount } the player wants (may include __exclusive_N, __gold)
 * @param {number} goldOffer - gold the player is spending
 * @param {{ markup: number, discount: number }} rates - from getTradeRates()
 * @param {object} tradeData - pendingEvent.data (traderResources, exclusiveItems, traderGold)
 * @returns {{ offerVal: number, resourceOfferVal: number, reqVal: number }}
 */
export function computeTradeValues(offer, request, goldOffer, rates, tradeData, game) {
    let resourceOfferVal = 0;
    let equipOfferVal = 0;
    for (const [res, amt] of Object.entries(offer)) {
        if (amt <= 0) continue;
        if (res.startsWith('__equip_')) {
            // __equip_<type>_<index>: look up item's tradeValue
            const parts = res.split('_');
            const type = parts[3];
            const idx = parseInt(parts[4], 10);
            const arr = game?.resources.getItemArray(type) || [];
            const item = arr[idx];
            equipOfferVal += getItemTradeValue(item) * rates.discount;
        } else if (res.startsWith('__potion_')) {
            // Player sells a stack of potions. Priced from the definition (all
            // instances identical), like a stackable material.
            const key = res.slice('__potion_'.length);
            equipOfferVal += getItemTradeValue(ALL_ITEMS[key]) * amt * rates.discount;
        } else {
            resourceOfferVal += (TRADE_VALUES[res] || 1) * amt * rates.discount * _saturationMult(tradeData, res, amt);
        }
    }

    let reqVal = 0;
    for (const [res, amt] of Object.entries(request)) {
        if (amt <= 0) continue;
        if (res.startsWith('__exclusive_')) {
            const slotIdx = parseInt(res.split('_')[3], 10);
            const exclusiveItem = tradeData.exclusiveItems?.[slotIdx];
            const itemDef = (exclusiveItem?.key && ALL_ITEMS[exclusiveItem.key]) || exclusiveItem;
            const tierMarkup = TIER_BUY_MARKUP[itemDef?.tier || 0] || 1.0;
            // Tier markup applied on top of base markup to price high-tier gear appropriately.
            reqVal += getItemTradeValue(exclusiveItem) * rates.markup * tierMarkup;
        } else if (res.startsWith('__buypotion_')) {
            // Player buys a stack of potions from the merchant's potion stock.
            const key = res.slice('__buypotion_'.length);
            reqVal += getItemTradeValue(ALL_ITEMS[key]) * amt * rates.markup;
        } else if (res === '__gold') {
            reqVal += amt;
        } else {
            reqVal += (TRADE_VALUES[res] || 1) * amt * rates.markup;
        }
    }

    return {
        offerVal: resourceOfferVal + equipOfferVal + goldOffer,
        resourceOfferVal: resourceOfferVal + equipOfferVal,
        reqVal,
    };
}

export class EventSystem {
    constructor() {
        this.cooldowns = {};
        this.pendingEvent = null;
    }

    update(game) {
        if (this.pendingEvent) return;
        if (!game.voidWhisperStats) game.voidWhisperStats = { accepted: 0, refused: 0 };

        const mods = game.divinationModifiers || [];

        for (const [eventKey, eventDef] of Object.entries(EVENTS)) {
            if (game.tick < eventDef.minTick) continue;
            if (this.cooldowns[eventKey] && game.tick < this.cooldowns[eventKey]) continue;
            if (eventDef.seasons && !eventDef.seasons.includes(game.weather.season)) continue;

            if (mods.some(m => m.suppressEvents && m.suppressEvents.includes(eventKey))) continue;

            if (eventKey === 'void_whisper') {
                const hasNexus = game.mapIndex
                    ? game.mapIndex.getStructurePositions('void_nexus').size > 0
                    : (() => {
                        for (let y = 0; y < game.map.length; y++) {
                            for (let x = 0; x < game.map[y].length; x++) {
                                if (game.map[y][x].structure === 'void_nexus') return true;
                            }
                        }
                        return false;
                    })();
                if (!hasNexus) continue;
            }

            let chance = eventDef.weight / 5000;
            if (eventKey === 'wanderer') {
                const alive = game.colonists.filter(c => c.hp > 0);
                const avgMood = alive.length > 0 ? alive.reduce((s, c) => s + c.mood, 0) / alive.length : 50;
                chance *= Math.max(0.05, avgMood / 70);
                chance *= getPedestalEffect(game, 'wandererChanceMult');
            }
            if (eventKey === 'caravan') {
                chance *= getPedestalEffect(game, 'traderChanceMult');
            }

            for (const m of mods) {
                if (m.eventBoost === eventKey) chance *= m.eventMult;
            }

            if (Math.random() < chance) {
                this.triggerEvent(eventKey, game);
                let cd = eventDef.cooldown;
                if (eventKey === 'caravan' && game.research.isResearched('trade_routes')) cd *= 0.7;
                this.cooldowns[eventKey] = game.tick + cd;
                break;
            }
        }
    }

    triggerEvent(eventKey, game) {
        const def = EVENTS[eventKey];
        switch (def.effect) {
            case 'deposit': this.handleDeposit(def, game); break;
            case 'spawn_animals': this.handleSpawnAnimals(def, game); break;
            case 'mood': this.handleMood(def, game); break;
            case 'trinket_find': this.handleTrinketFind(def, game); break;
            case 'crop_damage': this.handleCropDamage(def, game); break;
            case 'creeping_miasma': this.handleCreepingMiasma(def, game); break;
            case 'spawn_blight_bloom': this.handleSpawnBlightBloom(def, game); break;
            case 'custom':
                switch (eventKey) {
                    case 'wanderer': this.eventWanderer(game); break;
                    case 'caravan': this.eventCaravan(game); break;
                    case 'void_whisper': this.eventVoidWhisper(game); break;
                }
                break;
        }
    }

    // ========================================================================
    // DATA-DRIVEN EFFECT HANDLERS
    // ========================================================================

    handleDeposit(def, game) {
        const center = def.location === 'edge' ? getRandomEdgeZone() : getRandomInterior();
        const r = def.radius;
        let count = 0;

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const nx = center.x + dx, ny = center.y + dy;
                if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
                const tile = game.map[ny][nx];
                if (!def.terrain.includes(tile.terrain)) continue;
                if (tile.resource || (tile.structure && !PLANT_STRUCTURES.has(tile.structure))) continue;
                // Leave player-owned and ruin ground alone: farms, floors, pending
                // build/gather designations, and sealed crypt interiors.
                if (tile.zone || tile.floor || tile.designation || tile.sealed) continue;
                if (Math.random() >= def.fillChance) continue;
                if (tile.structure) {
                    game.mapIndex?.removeStructure(nx, ny, tile.structure);
                    tile.structure = null;
                }

                const deposit = pickWeighted(def.deposits);
                tile.resource = { type: deposit.type, amount: randRange(deposit.amount) };
                count++;
            }
        }

        if (count > 0) {
            this._announce(game, def, { count }, 'event', { type: 'position', x: center.x, y: center.y });
        }
    }

    // Toast and event-log line for a config event. Mod events may leave out
    // `notification` or `logMessage`; whatever is missing is skipped.
    _announce(game, def, params, type, linked) {
        if (def.notification) {
            let msg = def.notification;
            for (const [k, v] of Object.entries(params)) msg = msg.replace(`{${k}}`, v);
            game.notifications.push({ text: msg, tick: game.tick, type });
        }
        if (def.logMessage) game.eventLog.add(game, defMessage(def, 'logMessage', params), def.logType, linked);
    }

    handleSpawnAnimals(def, game) {
        let totalCount = 0;
        for (const entry of def.animals) {
            const count = randRange(entry.count);
            for (let i = 0; i < count; i++) {
                const edge = getRandomEdge();
                const migrAnimal = createWildAnimal(entry.type, edge.x, edge.y);
                game.entities.push(migrAnimal);
                game.wildAnimals.push(migrAnimal);
            }
            totalCount += count;
        }
        this._announce(game, def, { count: totalCount }, 'event', null);
    }

    handleMood(def, game) {
        const alive = game.colonists.filter(c => c.hp > 0);
        if (alive.length === 0) return;
        const colonist = alive[Math.floor(Math.random() * alive.length)];
        addThought(colonist, def.thought, def.moodChange, def.moodDuration, game.tick);
        this._announce(game, def, { name: colonist.name }, 'success', { type: 'colonist', id: colonist.id });
    }

    handleTrinketFind(def, game) {
        const alive = game.colonists.filter(c => c.hp > 0);
        if (alive.length === 0) return;
        const colonist = alive[Math.floor(Math.random() * alive.length)];
        addThought(colonist, def.thought, def.moodChange, def.moodDuration, game.tick);
        if (def.trinketKey) {
            const item = rollItem(def.trinketKey, 'normal');
            if (item) {
                item.type = 'trinket';
                game.resources.addItem(item);
            }
        }
        this._announce(game, def, { name: colonist.name }, 'success', { type: 'colonist', id: colonist.id });
    }

    handleCropDamage(def, game) {
        let count = 0;
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                const tile = game.map[y][x];
                if (tile.zone && tile.zone.state === 'growing' && Math.random() < def.chance) {
                    tile.zone.state = 'empty';
                    tile.zone.growth = 0;
                    tile.zone.blighted = false;
                    delete tile.zone.blightSpreadCount;
                    this._removeFarmTasksAt(game, x, y);
                    count++;
                }
            }
        }
        if (count > 0) {
            this._announce(game, def, { count }, 'danger', null);
            if (def.thought) {
                for (const c of game.colonists) {
                    addThought(c, def.thought, def.moodChange, def.moodDuration, game.tick);
                }
            }
        }
    }

    // A crop reset to empty invalidates its pending harvest/cleanse tasks. Other
    // tasks can share the tile, so only the farm ones are dropped.
    _removeFarmTasksAt(game, x, y) {
        for (const t of game.taskQueue.getAllByPosition(x, y)) {
            if (t.type === 'harvest' || t.type === 'cleanse_blight') game.taskQueue.remove(t.id);
        }
    }

    handleCreepingMiasma(def, game) {
        const candidates = [];
        const zonePositions = game.mapIndex ? game.mapIndex.getZonePositions() : null;
        if (zonePositions) {
            for (const { x, y } of zonePositions) {
                const tile = game.map[y][x];
                if (tile.zone?.state === 'growing' && !tile.zone.blighted && !tile.blightImmune) {
                    candidates.push({ x, y });
                }
            }
        } else {
            for (let y = 0; y < game.map.length; y++) {
                for (let x = 0; x < game.map[y].length; x++) {
                    const tile = game.map[y][x];
                    if (tile.zone?.state === 'growing' && !tile.zone.blighted && !tile.blightImmune) {
                        candidates.push({ x, y });
                    }
                }
            }
        }
        if (candidates.length === 0) return;

        const [lo, hi] = def.initialTiles;
        const count = Math.min(candidates.length, lo + Math.floor(Math.random() * (hi - lo + 1)));
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const infected = candidates.slice(0, count);
        for (const { x, y } of infected) {
            const tile = game.map[y][x];
            tile.zone.blighted = true;
            tile.zone.blightSpreadCount = 0;
            game.taskQueue.add({
                type: 'cleanse_blight',
                skillRequired: 'farming',
                x, y,
                workAmount: BLIGHT_CONFIG.cleanseWork,
            });
        }

        this._announce(game, def, { count }, 'danger', infected[0] ? { type: 'position', x: infected[0].x, y: infected[0].y } : null);
        if (def.thought) {
            for (const c of game.colonists) {
                addThought(c, def.thought, def.moodChange, def.moodDuration, game.tick);
            }
        }
    }

    handleSpawnBlightBloom(def, game) {
        const candidates = [];
        const zonePositions = game.mapIndex ? game.mapIndex.getZonePositions() : null;
        if (zonePositions) {
            for (const { x, y } of zonePositions) {
                const tile = game.map[y][x];
                if (tile.zone?.state === 'growing') candidates.push({ x, y });
            }
        } else {
            for (let y = 0; y < game.map.length; y++) {
                for (let x = 0; x < game.map[y].length; x++) {
                    const tile = game.map[y][x];
                    if (tile.zone?.state === 'growing') candidates.push({ x, y });
                }
            }
        }
        if (candidates.length === 0) return;

        const [lo, hi] = def.spawnCount;
        const count = Math.min(candidates.length, lo + Math.floor(Math.random() * (hi - lo + 1)));
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const spawned = candidates.slice(0, count);
        for (const { x, y } of spawned) {
            const tile = game.map[y][x];
            tile.zone.state = 'empty';
            tile.zone.growth = 0;
            this._removeFarmTasksAt(game, x, y);
            game.entities.push({
                type: 'blight_bloom', category: 'blight_bloom',
                id: getNextId(),
                hp: BLIGHT_CONFIG.bloomHp, maxHp: BLIGHT_CONFIG.bloomHp,
                x, y, char: '☘', color: '#88aa22',
                hostile: true, damage: 0, speed: 0,
                rootedTick: game.tick,
            });
        }

        this._announce(game, def, {}, 'danger', spawned[0] ? { type: 'position', x: spawned[0].x, y: spawned[0].y } : null);
        if (def.thought) {
            for (const c of game.colonists) {
                addThought(c, def.thought, def.moodChange, def.moodDuration, game.tick);
            }
        }
    }

    // ========================================================================
    // CUSTOM EVENT HANDLERS (complex logic that can't be data-driven)
    // ========================================================================

    eventWanderer(game) {
        const aliveColonists = game.colonists.filter(c => c.hp > 0 && !c.golem);
        const cap = game.waves.getColonistCap(game);
        if (aliveColonists.length >= cap) {
            return;
        }

        const edge = getReachableEdge(game);
        const skillKeys = Object.keys(SKILLS);
        const bias = skillKeys[Math.floor(Math.random() * skillKeys.length)];
        const existingNames = game.colonists.map(c => c.name);
        const wanderer = createColonist(edge.x, edge.y, bias, existingNames);

        this.pendingEvent = {
            type: 'wanderer',
            text: t('msg.events.wanderer_offer', { name: wanderer.name, skill: SKILLS[bias]?.name ?? bias, n: aliveColonists.length + 1, cap }),
            choices: [t('msg.events.choice_accept'), t('msg.events.choice_reject')],
            data: wanderer,
        };
        game.notifications.push({ text: t('msg.events.wanderer_approaches'), tick: game.tick, type: 'event' });
        game.eventLog.add(game, { key: 'msg.events.wanderer_approaches_log', params: { name: wanderer.name } }, 'event', { type: 'position', x: edge.x, y: edge.y });
        if (game.settings.autoPauseEvent && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }
    }

    resolveWanderer(game, accept) {
        if (accept && this.pendingEvent?.data) {
            const aliveColonists = game.colonists.filter(c => c.hp > 0 && !c.golem);
            const cap = game.waves.getColonistCap(game);
            if (aliveColonists.length >= cap) {
                game.notifications.push({ text: t('msg.events.colony_at_capacity', { cap }), tick: game.tick, type: 'danger' });
                this.pendingEvent = null;
                return;
            }
            game.addColonist(this.pendingEvent.data);
            game.notifications.push({ text: t('msg.events.colonist_joined', { name: this.pendingEvent.data.name }), tick: game.tick, type: 'success' });
            game.eventLog.add(game, { key: 'msg.events.colonist_joined_log', params: { name: this.pendingEvent.data.name } }, 'success', { type: 'colonist', id: this.pendingEvent.data.id });
            game.story.checkPopulation(game);
            for (const c of game.colonists) {
                if (c.id !== this.pendingEvent.data.id) {
                    applyThought(c, 'new_colonist', game.tick);
                }
            }
            this._rollArrivalBond(game, this.pendingEvent.data);
        }
        this.pendingEvent = null;
    }

    /**
     * Gives a newly-arrived wanderer a chance to already know one existing
     * colonist, seeding a mutual opinion and a fitting mood thought for both.
     * Purely a social-texture flourish (see ARRIVAL_BONDS in social.js).
     *
     * @param {object} game     Game instance.
     * @param {object} newcomer The wanderer that just joined.
     */
    _rollArrivalBond(game, newcomer) {
        if (Math.random() >= ARRIVAL_BONDS.chance) return;
        const candidates = game.colonists.filter(c => c.hp > 0 && !c.golem && c.id !== newcomer.id);
        if (candidates.length === 0) return;
        const other = candidates[Math.floor(Math.random() * candidates.length)];

        const bonds = ARRIVAL_BONDS.bonds;
        const totalWeight = bonds.reduce((s, b) => s + b.weight, 0);
        let roll = Math.random() * totalWeight;
        let bond = bonds[bonds.length - 1];
        for (const b of bonds) { roll -= b.weight; if (roll < 0) { bond = b; break; } }

        newcomer.opinions = newcomer.opinions || {};
        other.opinions = other.opinions || {};
        newcomer.opinions[other.id] = bond.opinion;
        other.opinions[newcomer.id] = bond.opinion;

        const th = THOUGHTS[bond.thoughtKey];
        if (th) {
            addThought(newcomer, bond.thoughtKey, th.moodEffect, th.duration, game.tick);
            addThought(other, bond.thoughtKey, th.moodEffect, th.duration, game.tick);
        }
        const names = { a: newcomer.name, b: other.name };
        const type = bond.opinion >= 0 ? 'success' : 'warning';
        game.eventLog.add(game, defMessage(bond, 'arrivalText', names), type, { type: 'colonist', id: newcomer.id });
        game.notifications.push({ text: defText(bond, 'arrivalText', names), tick: game.tick, type: type === 'success' ? 'success' : 'event' });
    }

    /**
     * Draw items from one of a merchant's stock pools without replacement, rolling
     * each to a per-merchant quality, and return the rolled instances.
     *
     * @param {string[]} keys       Candidate item keys (the pool).
     * @param {number[]} drawChances Per-slot draw probabilities. The FIRST slot is
     *                               always drawn (its chance value is ignored);
     *                               each subsequent entry is a probability.
     * @param {object}   merchant    The merchant (for qualityWeights).
     * @return {object[]} Rolled item instances (may be shorter than drawChances).
     */
    _drawMerchantStock(keys, drawChances, merchant, game) {
        const pool = [...(keys || [])];
        const chances = drawChances || [];
        const out = [];
        for (let i = 0; i < chances.length; i++) {
            if (pool.length === 0) break;
            if (i > 0 && Math.random() >= chances[i]) continue;   // first slot guaranteed
            const idx = Math.floor(Math.random() * pool.length);
            const key = pool.splice(idx, 1)[0];
            out.push(this._rollMerchantItem(key, merchant, game));
        }
        return out;
    }

    // Roll a concrete merchant item. Gear takes a per-merchant quality roll. Item
    // types with no quality-scaled stats (trinket/tome/potion/consumable) stay
    // 'normal' so the prefix isn't a name-only lie (mirrors the Trade Rift rule).
    _rollMerchantItem(key, merchant, game) {
        const def = ALL_ITEMS[key];
        const QUALITY_SCALED = new Set(['weapon', 'armor', 'helmet', 'tool', 'clothes', 'boots']);
        const quality = (def && QUALITY_SCALED.has(def.type))
            ? weightedQuality(merchant.qualityWeights)
            : 'normal';
        const item = rollItem(key, quality);
        if (key === 'crystal_capacitor' && game) {
            item.tradeValue = 65 + (game.manaCrystalBonus || 0) * 20;
        }
        return item;
    }

    /**
     * Spawns a trade caravan event with randomized inventory.
     * Tuning knobs:
     *   - numItems: 3-6 resource types carried (change range for variety)
     *   - per-merchant lowDrawCount / highDrawChances: exclusive stock size & rarity
     *   - per-merchant qualityWeights: quality distribution on drawn gear
     *   - traderGold: goldRange per merchant (change for economy pacing)
     */
    eventCaravan(game) {
        const totalWeight = MERCHANTS.reduce((s, m) => s + (m.weight ?? 1), 0);
        let roll = Math.random() * totalWeight;
        const merchant = MERCHANTS.find(m => (roll -= (m.weight ?? 1)) < 0) ?? MERCHANTS[MERCHANTS.length - 1];
        const available = merchant.resourcePool ?? Object.keys(TRADE_VALUES);
        const traderResources = {};
        const numItems = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numItems; i++) {
            const res = available[Math.floor(Math.random() * available.length)];
            traderResources[res] = (traderResources[res] || 0) + 3 + Math.floor(Math.random() * 8);
        }
        delete traderResources['gold'];

        // Build the exclusive stock: a handful of low-tier items plus a few premium
        // ones, each drawn without replacement and rolled to a per-merchant quality.
        // Slots hold ROLLED INSTANCES (not key strings) so pricing/tooltips reflect
        // the rolled quality. (pendingEvent isn't serialized so
        // storing instances here needs no save-format change.)
        const exclusiveItems = [
            ...this._drawMerchantStock(merchant.lowTierItems, merchant.lowDrawCount, merchant, game),
            ...this._drawMerchantStock(merchant.highTierItems, merchant.highDrawChances, merchant, game),
        ];

        // Stackable potion stock, rolled per-visit from the merchant's potionStock
        // ranges. { key: count } traded in stacks like materials (see the
        // __buypotion_/__potion_ lanes in computeTradeValues / executeBarterTrade).
        const traderPotions = {};
        for (const [key, [lo, hi]] of Object.entries(merchant.potionStock || {})) {
            traderPotions[key] = lo + Math.floor(Math.random() * (hi - lo + 1));
        }

        const [gMin, gMax] = merchant.goldRange;
        const traderGold = gMin + Math.floor(Math.random() * (gMax - gMin + 1));

        // One whole sentence per merchant (the article depends on the name). Mod
        // merchants without one get a sentence with the bare name.
        const arrivesKey = `msg.events.merchant_arrives.${merchant.key}`;
        this.pendingEvent = {
            type: 'trade',
            text: merchant.key && hasKey(arrivesKey) ? t(arrivesKey) : t('msg.events.merchant_arrives_generic', { name: merchant.name }),
            choices: [t('msg.events.choice_open_trade'), t('msg.events.choice_dismiss')],
            data: { traderResources, exclusiveItems, traderPotions, traderGold, merchantName: merchant.name, merchantKey: merchant.key ?? null, buyCategories: merchant.buyCategories || null, merchantResourcePool: merchant.resourcePool || null, saturation: {} },
        };
        game.notifications.push({ text: t('msg.events.merchant_arrived', { name: merchant.name }), tick: game.tick, type: 'event' });
        game.eventLog.add(game, { key: 'msg.events.merchant_arrived_log', params: { name: defRef(merchant) } }, 'event', null);
        if (game.settings.autoPauseCaravan && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }
    }

    resolveCaravan(game, choice) {
        if (choice === 1 || choice === 'Dismiss') {
            this.pendingEvent = null;
            return;
        }
        // choice 0 = Open Trade, handled by UI, keep event open
    }

    /**
     * Executes a barter trade between the player and the caravan.
     * Validates availability of all resources/gold on both sides, then transfers.
     * Gold offered by the player goes to the trader's pool AFTER fulfilling requests
     * (prevents offering gold and immediately requesting it back).
     *
     * @param {object} game - Game instance
     * @param {object} offering - { resource: amount } player is giving
     * @param {object} requesting - { resource: amount, __exclusive?: 1, __gold?: amount }
     * @param {number} goldOffered - gold the player is spending (separate from resources)
     * @returns {boolean} true if trade succeeded
     */
    executeBarterTrade(game, offering, requesting, goldOffered) {
        if (!this.pendingEvent || this.pendingEvent.type !== 'trade') return false;
        const data = this.pendingEvent.data;
        const goldOffer = goldOffered || 0;

        // --- Validation: check both sides can fulfill the trade ---
        if (goldOffer > (game.resources.stockpile.gold || 0)) return false;

        for (const [res, amt] of Object.entries(offering)) {
            if (amt <= 0) continue;
            if (res.startsWith('__equip_')) {
                const parts = res.split('_');
                const type = parts[3];
                const idx = parseInt(parts[4], 10);
                const arr = game.resources.getItemArray(type) || [];
                if (!arr[idx]) return false;
            } else if (res.startsWith('__potion_')) {
                const key = res.slice('__potion_'.length);
                if (game.resources.getPotionCount(key) < amt) return false;
            } else {
                if ((game.resources.stockpile[res] || 0) < amt) return false;
            }
        }

        for (const [res, amt] of Object.entries(requesting)) {
            if (amt <= 0) continue;
            if (res.startsWith('__exclusive_')) {
                const slotIdx = parseInt(res.split('_')[3], 10);
                if (!data.exclusiveItems?.[slotIdx]) return false;
            } else if (res.startsWith('__buypotion_')) {
                const key = res.slice('__buypotion_'.length);
                if ((data.traderPotions?.[key] || 0) < amt) return false;
            } else if (res === '__gold') {
                if (amt > data.traderGold) return false;
            } else {
                if ((data.traderResources[res] || 0) < amt) return false;
            }
        }

        // Value check: player's offer must cover the request cost
        const rates = getTradeRates(game);
        const { offerVal, reqVal } = computeTradeValues(offering, requesting, goldOffer, rates, data, game);
        if (offerVal < reqVal) return false;

        // --- Execute: deduct from player ---
        if (goldOffer > 0) game.resources.deduct({ gold: goldOffer });
        // Collect __equip keys first, sorted by index descending so splices don't shift indices
        const equipOffers = Object.entries(offering)
            .filter(([res]) => res.startsWith('__equip_'))
            .sort((a, b) => parseInt(b[0].split('_')[4], 10) - parseInt(a[0].split('_')[4], 10));
        for (const [res] of equipOffers) {
            const parts = res.split('_');
            const type = parts[3];
            const idx = parseInt(parts[4], 10);
            const arr = game.resources.getItemArray(type);
            if (arr) arr.splice(idx, 1);
        }
        for (const [res, amt] of Object.entries(offering)) {
            if (res.startsWith('__equip_')) continue;
            if (amt <= 0) continue;
            if (res.startsWith('__potion_')) {
                const key = res.slice('__potion_'.length);
                for (let n = 0; n < amt; n++) game.resources.takePotion(key);
            } else {
                game.resources.deduct({ [res]: amt });
                // Track saturation for this visit so repeated sales of the same resource pay less.
                if (!data.saturation) data.saturation = {};
                data.saturation[res] = (data.saturation[res] || 0) + amt;
            }
        }

        // --- Execute: give player what they requested ---
        const goldRequested = requesting.__gold || 0;
        for (const [res, amt] of Object.entries(requesting)) {
            if (res.startsWith('__exclusive_')) {
                const slotIdx = parseInt(res.split('_')[3], 10);
                const rolled = data.exclusiveItems?.[slotIdx];   // a rolled instance (with quality)
                if (rolled) game.resources.addItem(rolled);
                if (data.exclusiveItems) data.exclusiveItems[slotIdx] = null;
            } else if (res.startsWith('__buypotion_')) {
                const key = res.slice('__buypotion_'.length);
                for (let n = 0; n < amt; n++) game.resources.addItem(rollItem(key, 'normal'));
                data.traderPotions[key] -= amt;
                if (data.traderPotions[key] <= 0) delete data.traderPotions[key];
            } else if (res === '__gold') {
                const goldAmt = Math.min(amt, data.traderGold);
                if (goldAmt > 0) {
                    game.resources.add({ gold: goldAmt });
                    data.traderGold -= goldAmt;
                }
            } else {
                game.resources.add({ [res]: amt });
                data.traderResources[res] -= amt;
                if (data.traderResources[res] <= 0) delete data.traderResources[res];
            }
        }

        // Player's gold enters trader's pool after requests (no same-trade recycling)
        if (goldOffer > 0) data.traderGold += goldOffer;

        const goldStr = goldRequested % 1 !== 0 ? goldRequested.toFixed(1) : String(goldRequested);
        game.notifications.push({ text: goldRequested > 0 ? t('msg.events.trade_complete_gold', { gold: goldStr }) : t('msg.events.trade_complete'), tick: game.tick, type: 'success' });
        game.story.checkMilestone('first_trade_completed', game);
        return true;
    }

    dismissTrader() {
        if (this.pendingEvent?.type === 'trade') {
            this.pendingEvent = null;
        }
    }

    _getVoidWhisper(game, key) {
        const whispers = this._buildVoidWhispers(game);
        const found = whispers.find(w => w.key === key);
        if (found) return found;
        const communion = this._buildVoidCommunionWhispers(game);
        return communion.find(w => w.key === key) || null;
    }

    _buildVoidWhispers(game) {
        return [
            {
                key: 'blood_tithe',
                title: t('msg.events.whisper.blood_tithe.title'),
                text: t('msg.events.whisper.blood_tithe.text'),
                ask: t('msg.events.whisper.blood_tithe.ask'),
                reward: t('msg.events.whisper.blood_tithe.reward'),
                condition: (g) => g.colonists.some(c => c.hp > 0 && !c.golem),
                apply: (g) => {
                    const alive = g.colonists.filter(c => c.hp > 0 && !c.golem);
                    const strongest = alive.reduce((best, c) => (c.maxHp > best.maxHp ? c : best), alive[0]);
                    strongest.hp = Math.max(1, strongest.hp - Math.floor(strongest.maxHp * 0.30));
                    g.resources.add({ void_essence: 8 });
                    g.eventLog.add(g, { key: 'msg.events.whisper.blood_tithe.log', params: { name: strongest.name } }, 'danger', { type: 'colonist', id: strongest.id });
                },
            },
            {
                key: 'dream_tax',
                title: t('msg.events.whisper.dream_tax.title'),
                text: t('msg.events.whisper.dream_tax.text'),
                ask: t('msg.events.whisper.dream_tax.ask'),
                reward: t('msg.events.whisper.dream_tax.reward'),
                apply: (g) => {
                    for (const c of g.colonists.filter(c => c.hp > 0)) {
                        c.needs.rest = Math.max(0, c.needs.rest - 30);
                    }
                    g._voidWhisperNextExpRareMult = (g._voidWhisperNextExpRareMult || 1) * 2.0;
                    g.eventLog.add(g, { key: 'msg.events.whisper.dream_tax.log' }, 'event', null);
                },
            },
            {
                key: 'name_price',
                title: t('msg.events.whisper.name_price.title'),
                text: t('msg.events.whisper.name_price.text'),
                ask: t('msg.events.whisper.name_price.ask'),
                reward: t('msg.events.whisper.name_price.reward'),
                condition: (g) => g.colonists.some(c => c.hp > 0),
                apply: (g) => {
                    const alive = g.colonists.filter(c => c.hp > 0);
                    const target = alive[Math.floor(Math.random() * alive.length)];
                    addThought(target, 'void_knows_name', -10, 960, g.tick);
                    const nextRaid = g.combat?.nextRaidTick;
                    const n = nextRaid ? Math.max(0, Math.round((nextRaid - g.tick) / 600)) : 0;
                    g.notifications.push({
                        text: nextRaid ? tp('msg.events.whisper.name_price.reveal_raid', n) : t('msg.events.whisper.name_price.reveal_no_raid'),
                        tick: g.tick, type: 'event',
                    });
                    g.eventLog.add(g, nextRaid
                        ? { key: 'msg.events.whisper.name_price.log_raid', params: { name: target.name, n } }
                        : { key: 'msg.events.whisper.name_price.log_no_raid', params: { name: target.name } },
                    'event', { type: 'colonist', id: target.id });
                },
            },
            {
                key: 'hunger_rite',
                title: t('msg.events.whisper.hunger_rite.title'),
                text: t('msg.events.whisper.hunger_rite.text'),
                ask: t('msg.events.whisper.hunger_rite.ask'),
                reward: t('msg.events.whisper.hunger_rite.reward'),
                condition: (g) => (g.resources.stockpile.food || 0) >= 15,
                apply: (g) => {
                    g.resources.deduct({ food: 15 });
                    if (!g.activeColonyBuffs) g.activeColonyBuffs = [];
                    g.activeColonyBuffs.push({ type: 'crafting_speed', mult: 1.25, expiresAt: g.tick + 2400 });
                    g.eventLog.add(g, { key: 'msg.events.whisper.hunger_rite.log' }, 'success', null);
                },
            },
            {
                key: 'silence_gift',
                title: t('msg.events.whisper.silence_gift.title'),
                text: t('msg.events.whisper.silence_gift.text'),
                ask: t('msg.events.whisper.silence_gift.ask'),
                reward: t('msg.events.whisper.silence_gift.reward'),
                condition: (g) => g.research && !g.research.paused,
                apply: (g) => {
                    g._voidWhisperResearchPauseUntil = g.tick + 600;
                    g.resources.add({ void_essence: 12 });
                    g.eventLog.add(g, { key: 'msg.events.whisper.silence_gift.log' }, 'event', null);
                },
            },
            {
                key: 'shaken_veil',
                title: t('msg.events.whisper.shaken_veil.title'),
                text: t('msg.events.whisper.shaken_veil.text'),
                ask: t('msg.events.whisper.shaken_veil.ask'),
                reward: t('msg.events.whisper.shaken_veil.reward'),
                condition: (g) => g.colonists.some(c => c.hp > 0),
                apply: (g) => {
                    const alive = g.colonists.filter(c => c.hp > 0);
                    const target = alive[Math.floor(Math.random() * alive.length)];
                    addThought(target, 'saw_beyond_veil', -15, 1440, g.tick);
                    g.story.checkMilestone('void_whisper_veil_parted', g);
                    g.eventLog.add(g, { key: 'msg.events.whisper.shaken_veil.log', params: { name: target.name } }, 'danger', { type: 'colonist', id: target.id });
                },
            },
            {
                key: 'offering_stone',
                title: t('msg.events.whisper.offering_stone.title'),
                text: t('msg.events.whisper.offering_stone.text'),
                ask: t('msg.events.whisper.offering_stone.ask'),
                reward: t('msg.events.whisper.offering_stone.reward'),
                apply: (g) => {
                    // Prefer a void wall, else a stone wall. Ruin walls are not the
                    // colony's to offer.
                    for (const type of ['void_wall', 'stone_wall']) {
                        const pos = g.mapIndex.findAll(type).find(p => !g.ruins.getRuinAt(p.x, p.y));
                        if (!pos) continue;
                        const tile = g.map[pos.y][pos.x];
                        // Drop the tile's tasks too, so a stale deconstruct/repair
                        // can't later act on a wall rebuilt here.
                        for (const t of g.taskQueue.getAllByPosition(pos.x, pos.y)) g.taskQueue.remove(t.id);
                        g.mapIndex.removeStructure(pos.x, pos.y, type);
                        tile.structure = null;
                        tile.structureHp = undefined;
                        tile.designation = null;
                        tile.passable = TERRAIN[tile.terrain]?.passable.colonist ?? true;
                        g.markRoomsDirty();
                        g.renderer?.markTerrainDirty();
                        g.minimap?.markTerrainDirty();
                        break;
                    }
                    g._voidWhisperWaveEnemyMult = (g._voidWhisperWaveEnemyMult || 1) * 0.80;
                    g.eventLog.add(g, { key: 'msg.events.whisper.offering_stone.log' }, 'event', null);
                },
            },
        ];
    }

    eventVoidWhisper(game) {
        if (!game.voidWhisperStats) game.voidWhisperStats = { accepted: 0, refused: 0 };

        const WHISPERS = this._buildVoidWhispers(game);
        const eligible = WHISPERS.filter(w => !w.condition || w.condition(game));
        if (eligible.length === 0) return;

        if (!game._voidWhisperLastKey) game._voidWhisperLastKey = null;
        const filtered = eligible.filter(w => w.key !== game._voidWhisperLastKey);
        const pool = filtered.length > 0 ? filtered : eligible;
        const whisper = pool[Math.floor(Math.random() * pool.length)];
        game._voidWhisperLastKey = whisper.key;

        this.pendingEvent = {
            type: 'void_whisper',
            title: whisper.title,
            text: whisper.text,
            askText: whisper.ask,
            rewardText: whisper.reward,
            choices: [t('msg.events.choice_accept'), t('msg.events.choice_refuse')],
            data: { whisperKey: whisper.key },
        };
        game.notifications.push({ text: t('msg.events.void_whisper_stirs', { wave: game.waves.highestWaveCompleted + 1 }), tick: game.tick, type: 'event' });
        game.eventLog.add(game, { key: 'msg.events.void_whisper_pulsed' }, 'event', null);
        if (game.settings?.autoPauseEvent && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }
    }

    resolveVoidWhisper(game, accept) {
        if (!this.pendingEvent || this.pendingEvent.type !== 'void_whisper') return;
        if (!game.voidWhisperStats) game.voidWhisperStats = { accepted: 0, refused: 0 };

        if (accept) {
            const whisperKey = this.pendingEvent.data.whisperKey;
            const whisper = this._getVoidWhisper(game, whisperKey);
            if (whisper) whisper.apply(game);
            game.voidWhisperStats.accepted++;
            game.story.checkMilestone('void_whisper_first_accepted', game);
            if (game.voidWhisperStats.accepted >= 5) game.story.checkMilestone('void_whisper_accepted_5', game);
        } else {
            game.voidWhisperStats.refused++;
            if (game.voidWhisperStats.refused >= 3) game.story.checkMilestone('void_whisper_refused_3', game);
            game.eventLog.add(game, { key: 'msg.events.void_whisper_refused' }, 'event', null);
        }

        this.pendingEvent = null;
    }

    _buildVoidCommunionWhispers(game) {
        return [
            {
                key: 'crucible',
                title: t('msg.events.whisper.crucible.title'),
                text: t('msg.events.whisper.crucible.text'),
                ask: t('msg.events.whisper.crucible.ask'),
                reward: t('msg.events.whisper.crucible.reward'),
                condition: (g) => !g.waves.active && g.waves.findNexus(g) !== null,
                apply: (g) => {
                    g._voidWhisperForcedWaveBonusMult = 1.5;
                    g.waves.startWave(g);
                    g.camera.centerOn(g.waves.nexusPosition.x, g.waves.nexusPosition.y);
                    g.eventLog.add(g, { key: 'msg.events.whisper.crucible.log' }, 'danger', null);
                },
            },
            {
                key: 'void_pact',
                title: t('msg.events.whisper.void_pact.title'),
                text: t('msg.events.whisper.void_pact.text'),
                ask: t('msg.events.whisper.void_pact.ask'),
                reward: t('msg.events.whisper.void_pact.reward'),
                condition: (g) => {
                    const eligible = g.colonists.filter(c => c.hp > 0 && !c.golem && !c.voidBound);
                    return eligible.length >= 2;
                },
                apply: (g) => {
                    const eligible = g.colonists.filter(c => c.hp > 0 && !c.golem && !c.voidBound);
                    const target = eligible.reduce((best, c) => {
                        const dmg = c.weapon?.damage || 0;
                        const bestDmg = best.weapon?.damage || 0;
                        return dmg > bestDmg ? c : best;
                    }, eligible[0]);
                    target.voidBound = true;
                    g._voidWhisperPactColonist = target.id;
                    addThought(target, 'feel_off', -5, 960, g.tick);
                    g.eventLog.add(g, { key: 'msg.events.whisper.void_pact.log', params: { name: target.name } }, 'event', { type: 'colonist', id: target.id });
                },
            },
            {
                key: 'fortification',
                title: t('msg.events.whisper.fortification.title'),
                text: t('msg.events.whisper.fortification.text'),
                ask: t('msg.events.whisper.fortification.ask'),
                reward: t('msg.events.whisper.fortification.reward'),
                condition: (g) => (g.resources.stockpile.stone || 0) >= 10 && (g.resources.stockpile.iron || 0) >= 5,
                apply: (g) => {
                    g.resources.deduct({ stone: 10, iron: 5 });
                    g._voidWhisperNexusHpMult = 1.5;
                    g.eventLog.add(g, { key: 'msg.events.whisper.fortification.log' }, 'success', null);
                },
            },
            {
                key: 'hastened_swarm',
                title: t('msg.events.whisper.hastened_swarm.title'),
                text: t('msg.events.whisper.hastened_swarm.text'),
                ask: t('msg.events.whisper.hastened_swarm.ask'),
                reward: t('msg.events.whisper.hastened_swarm.reward'),
                condition: (g) => g.waves.findNexus(g) !== null,
                apply: (g) => {
                    g._voidWhisperHastenedSwarm = true;
                    g.eventLog.add(g, { key: 'msg.events.whisper.hastened_swarm.log' }, 'event', null);
                },
            },
            {
                key: 'tide_caller',
                title: t('msg.events.whisper.tide_caller.title'),
                text: t('msg.events.whisper.tide_caller.text'),
                ask: t('msg.events.whisper.tide_caller.ask', { wave: game.waves.highestWaveCompleted + 3 }),
                reward: t('msg.events.whisper.tide_caller.reward'),
                condition: (g) => g.waves.findNexus(g) !== null && g.waves.highestWaveCompleted >= 1,
                apply: (g) => {
                    g._voidWhisperTideCallerActive = true;
                    g.eventLog.add(g, { key: 'msg.events.whisper.tide_caller.log' }, 'danger', null);
                },
            },
        ];
    }

    eventVoidCommunion(game) {
        if (!game.voidWhisperStats) game.voidWhisperStats = { accepted: 0, refused: 0 };

        const WHISPERS = this._buildVoidCommunionWhispers(game);
        const eligible = WHISPERS.filter(w => !w.condition || w.condition(game));
        if (eligible.length === 0) {
            game.notifications.push({ text: t('msg.events.void_communion_nothing'), tick: game.tick, type: 'event' });
            return;
        }

        if (!game._voidCommunionLastKey) game._voidCommunionLastKey = null;
        const filtered = eligible.filter(w => w.key !== game._voidCommunionLastKey);
        const pool = filtered.length > 0 ? filtered : eligible;
        const whisper = pool[Math.floor(Math.random() * pool.length)];
        game._voidCommunionLastKey = whisper.key;

        this.pendingEvent = {
            type: 'void_whisper',
            title: whisper.title,
            text: whisper.text,
            askText: whisper.ask,
            rewardText: whisper.reward,
            choices: [t('msg.events.choice_accept'), t('msg.events.choice_refuse')],
            data: { whisperKey: whisper.key },
        };
        game.notifications.push({ text: t('msg.events.void_communion_start', { wave: game.waves.highestWaveCompleted + 1 }), tick: game.tick, type: 'event' });
        game.eventLog.add(game, { key: 'msg.events.void_communion_answered' }, 'event', null);
        if (game.settings?.autoPauseEvent && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randRange(arr) {
    return arr[0] + Math.floor(Math.random() * (arr[1] - arr[0] + 1));
}

function pickWeighted(entries) {
    if (entries.length === 1) return entries[0];
    const totalWeight = entries.reduce((s, e) => s + (e.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
        roll -= entry.weight || 1;
        if (roll <= 0) return entry;
    }
    return entries[entries.length - 1];
}

function getRandomEdge() {
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: return { x: Math.floor(Math.random() * CONFIG.MAP_WIDTH), y: 0 };
        case 1: return { x: CONFIG.MAP_WIDTH - 1, y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT) };
        case 2: return { x: Math.floor(Math.random() * CONFIG.MAP_WIDTH), y: CONFIG.MAP_HEIGHT - 1 };
        case 3: return { x: 0, y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT) };
        default: return { x: Math.floor(CONFIG.MAP_WIDTH / 2), y: 0 };
    }
}

/**
 * A spawn tile for someone walking in to join the colony: a random map-border tile
 * that is connected on foot to the colony, so a wanderer never arrives somewhere
 * (across a river, behind mountains) they can't leave. Falls back to a connected
 * tile 30-60 tiles from the colony when its land doesn't reach the border, and to
 * a plain random edge if there are no colonists to measure from.
 *
 * @param {object} game Game instance.
 * @return {{x:number, y:number}} Spawn tile.
 */
function getReachableEdge(game) {
    const W = CONFIG.MAP_WIDTH, H = CONFIG.MAP_HEIGHT;
    const from = game.colonists.find(c => c.hp > 0 && !c.onExpedition && isPassable(game.map, c.x, c.y));
    if (!from) return getRandomEdge();
    // Flood the colony's walkable area (4-directional, like pathfinding). This runs
    // only when a wanderer event fires, so a full-map fill is affordable.
    const seen = new Uint8Array(W * H);
    const stack = [from.y * W + from.x];
    seen[stack[0]] = 1;
    const border = [], midRange = [];
    while (stack.length) {
        const i = stack.pop();
        const x = i % W, y = (i - x) / W;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border.push({ x, y });
        const d = Math.abs(x - from.x) + Math.abs(y - from.y);
        if (d >= 30 && d <= 60) midRange.push({ x, y });
        if (x > 0 && !seen[i - 1] && isPassable(game.map, x - 1, y)) { seen[i - 1] = 1; stack.push(i - 1); }
        if (x < W - 1 && !seen[i + 1] && isPassable(game.map, x + 1, y)) { seen[i + 1] = 1; stack.push(i + 1); }
        if (y > 0 && !seen[i - W] && isPassable(game.map, x, y - 1)) { seen[i - W] = 1; stack.push(i - W); }
        if (y < H - 1 && !seen[i + W] && isPassable(game.map, x, y + 1)) { seen[i + W] = 1; stack.push(i + W); }
    }
    const pool = border.length ? border : midRange;
    if (!pool.length) return { x: from.x, y: from.y };
    return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomEdgeZone() {
    const margin = 15;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: return { x: margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - margin * 2)), y: 3 + Math.floor(Math.random() * margin) };
        case 1: return { x: CONFIG.MAP_WIDTH - 3 - Math.floor(Math.random() * margin), y: margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - margin * 2)) };
        case 2: return { x: margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - margin * 2)), y: CONFIG.MAP_HEIGHT - 3 - Math.floor(Math.random() * margin) };
        case 3: return { x: 3 + Math.floor(Math.random() * margin), y: margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - margin * 2)) };
        default: return { x: Math.floor(CONFIG.MAP_WIDTH / 2), y: margin };
    }
}

function getRandomInterior() {
    return {
        x: Math.floor(Math.random() * CONFIG.MAP_WIDTH),
        y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT),
    };
}

import { CONFIG, EVENTS, WEATHER_TYPES, THOUGHTS, SKILLS, TRADE_VALUES, TRADER_MARKUP, TRADER_DISCOUNT, ALL_ITEMS, MERCHANTS, FIRE_CONFIG, COMBAT_VISUALS } from '../core/config.js';
import { createColonist, addThought } from '../entities/colonist.js';
import { createWildAnimal } from '../entities/entity-factory.js';
import { getPedestalEffect } from './artifacts.js';

/**
 * Computes effective trade rates for the current game state.
 * Rates are affected by: Trade Routes research, pedestal artifacts (Haggler's Coin, Merchant's Ring).
 *
 * @param {object} game - Game instance (needs game.research, pedestal effects)
 * @returns {{ markup: number, discount: number }}
 *   markup  - multiplier on item base value when BUYING from trader (higher = more expensive)
 *   discount - multiplier on item base value when SELLING to trader (lower = less value received)
 */
export function getTradeRates(game) {
    const markupMult = getPedestalEffect(game, 'tradeMarkupMult');
    const tradeRoutesMult = game.research.isResearched('trade_routes') ? (110 / 120) : 1;
    return {
        markup: TRADER_MARKUP * markupMult * tradeRoutesMult,
        discount: game.research.isResearched('trade_routes') ? 0.85 : TRADER_DISCOUNT,
    };
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
            // __equip_<type>_<index> — look up item's tradeValue
            const parts = res.split('_');
            const type = parts[3];
            const idx = parseInt(parts[4], 10);
            const arr = game?.resources[`${type}s`] || [];
            const item = arr[idx];
            equipOfferVal += (item?.tradeValue || 0) * rates.discount;
        } else {
            resourceOfferVal += (TRADE_VALUES[res] || 1) * amt * rates.discount;
        }
    }

    let reqVal = 0;
    for (const [res, amt] of Object.entries(request)) {
        if (amt <= 0) continue;
        if (res.startsWith('__exclusive_')) {
            const slotIdx = parseInt(res.split('_')[3], 10);
            reqVal += ALL_ITEMS[tradeData.exclusiveItems?.[slotIdx]]?.tradeValue || 0;
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

        const mods = game.divinationModifiers || [];

        for (const [eventKey, eventDef] of Object.entries(EVENTS)) {
            if (game.tick < eventDef.minTick) continue;
            if (this.cooldowns[eventKey] && game.tick < this.cooldowns[eventKey]) continue;
            if (eventDef.seasons && !eventDef.seasons.includes(game.weather.season)) continue;

            if (mods.some(m => m.suppressEvents && m.suppressEvents.includes(eventKey))) continue;

            if (eventKey === 'fire') {
                const wDef = WEATHER_TYPES[game.weather.currentWeather];
                if (!(wDef && wDef.fireChance) && Math.random() > 0.01) continue;
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
            case 'crop_damage': this.handleCropDamage(def, game); break;
            case 'custom':
                switch (eventKey) {
                    case 'wanderer': this.eventWanderer(game); break;
                    case 'caravan': this.eventCaravan(game); break;
                    case 'fire': this.eventFire(game); break;
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
                if (tile.resource || tile.structure) continue;
                if (Math.random() >= def.fillChance) continue;

                const deposit = pickWeighted(def.deposits);
                tile.resource = { type: deposit.type, amount: randRange(deposit.amount) };
                count++;
            }
        }

        if (count > 0) {
            const msg = def.notification.replace('{count}', count);
            game.notifications.push({ text: msg, tick: game.tick, type: 'event' });
            game.eventLog.add(game, def.logMessage.replace('{count}', count), def.logType, { type: 'position', x: center.x, y: center.y });
        }
    }

    handleSpawnAnimals(def, game) {
        let totalCount = 0;
        for (const entry of def.animals) {
            const count = randRange(entry.count);
            for (let i = 0; i < count; i++) {
                const edge = getRandomEdge();
                game.entities.push(createWildAnimal(entry.type, edge.x, edge.y));
            }
            totalCount += count;
        }
        const msg = def.notification.replace('{count}', totalCount);
        game.notifications.push({ text: msg, tick: game.tick, type: 'event' });
        game.eventLog.add(game, def.logMessage.replace('{count}', totalCount), def.logType, null);
    }

    handleMood(def, game) {
        const alive = game.colonists.filter(c => c.hp > 0);
        if (alive.length === 0) return;
        const colonist = alive[Math.floor(Math.random() * alive.length)];
        addThought(colonist, def.thought, def.moodChange, def.moodDuration, game.tick);
        const msg = def.notification.replace('{name}', colonist.name);
        game.notifications.push({ text: msg, tick: game.tick, type: 'success' });
        game.eventLog.add(game, def.logMessage.replace('{name}', colonist.name), def.logType, { type: 'colonist', id: colonist.id });
    }

    handleCropDamage(def, game) {
        let count = 0;
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                const tile = game.map[y][x];
                if (tile.zone && tile.zone.state === 'growing' && Math.random() < def.chance) {
                    tile.zone.state = 'empty';
                    tile.zone.growth = 0;
                    count++;
                }
            }
        }
        if (count > 0) {
            const msg = def.notification.replace('{count}', count);
            game.notifications.push({ text: msg, tick: game.tick, type: 'danger' });
            game.eventLog.add(game, def.logMessage.replace('{count}', count), def.logType, null);
            if (def.thought) {
                for (const c of game.colonists) {
                    addThought(c, def.thought, def.moodChange, def.moodDuration, game.tick);
                }
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

        const edge = getRandomEdge();
        const skillKeys = Object.keys(SKILLS);
        const bias = skillKeys[Math.floor(Math.random() * skillKeys.length)];
        const existingNames = game.colonists.map(c => c.name);
        const wanderer = createColonist(edge.x, edge.y, bias, existingNames);

        this.pendingEvent = {
            type: 'wanderer',
            text: `A wanderer named ${wanderer.name} (${bias}) wants to join your colony! (${aliveColonists.length + 1}/${cap} cap)`,
            choices: ['Accept', 'Reject'],
            data: wanderer,
        };
        game.notifications.push({ text: `A wanderer approaches!`, tick: game.tick, type: 'event' });
        game.eventLog.add(game, `A wanderer named ${wanderer.name} approaches`, 'event', { type: 'position', x: edge.x, y: edge.y });
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
                game.notifications.push({ text: `Colony is at capacity (${cap})! Complete more waves to expand.`, tick: game.tick, type: 'danger' });
                this.pendingEvent = null;
                return;
            }
            game.addColonist(this.pendingEvent.data);
            game.notifications.push({ text: `${this.pendingEvent.data.name} joined!`, tick: game.tick, type: 'success' });
            game.eventLog.add(game, `${this.pendingEvent.data.name} joined the colony`, 'success', { type: 'colonist', id: this.pendingEvent.data.id });
            game.story.checkPopulation(game);
            const t = THOUGHTS.new_colonist;
            for (const c of game.colonists) {
                if (c.id !== this.pendingEvent.data.id) {
                    addThought(c, t.text, t.moodEffect, t.duration, game.tick);
                }
            }
        }
        this.pendingEvent = null;
    }

    /**
     * Spawns a trade caravan event with randomized inventory.
     * Tuning knobs:
     *   - numItems: 3-6 resource types carried (change range for variety)
     *   - per-item quantity: 3-10 units each
     *   - exclusive item chance: 30% (change for rarity)
     *   - traderGold: 20-49g (change range for economy pacing)
     */
    eventCaravan(game) {
        const merchant = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
        const available = merchant.resourcePool ?? Object.keys(TRADE_VALUES);
        const traderResources = {};
        const numItems = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numItems; i++) {
            const res = available[Math.floor(Math.random() * available.length)];
            traderResources[res] = (traderResources[res] || 0) + 3 + Math.floor(Math.random() * 8);
        }

        // Build exclusive item list: 1 guaranteed + extra slots per extraItemChances.
        // Draw without replacement so the same item never appears twice.
        const pool = [...merchant.exclusiveItems];
        const exclusiveItems = [];
        if (pool.length > 0) {
            const firstIdx = Math.floor(Math.random() * pool.length);
            exclusiveItems.push(pool.splice(firstIdx, 1)[0]);
            for (const chance of (merchant.extraItemChances || [])) {
                if (pool.length === 0) break;
                if (Math.random() < chance) {
                    const idx = Math.floor(Math.random() * pool.length);
                    exclusiveItems.push(pool.splice(idx, 1)[0]);
                }
            }
        }

        const [gMin, gMax] = merchant.goldRange;
        const traderGold = gMin + Math.floor(Math.random() * (gMax - gMin + 1));

        this.pendingEvent = {
            type: 'trade',
            text: `A ${merchant.name} arrives! Barter resources with the merchant.`,
            choices: ['Open Trade', 'Dismiss'],
            data: { traderResources, exclusiveItems, traderGold, merchantName: merchant.name, buyCategories: merchant.buyCategories || null, merchantResourcePool: merchant.resourcePool || null },
        };
        game.notifications.push({ text: `${merchant.name} arrived!`, tick: game.tick, type: 'event' });
        game.eventLog.add(game, `${merchant.name} arrived`, 'event', null);
        if (game.settings.autoPauseEvent && !game.paused) {
            game.togglePause();
            game._eventPaused = true;
        }
    }

    resolveCaravan(game, choice) {
        if (choice === 1 || choice === 'Dismiss') {
            this.pendingEvent = null;
            return;
        }
        // choice 0 = Open Trade — handled by UI, keep event open
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
                const arr = game.resources[`${type}s`] || [];
                if (!arr[idx]) return false;
            } else {
                if ((game.resources.stockpile[res] || 0) < amt) return false;
            }
        }

        for (const [res, amt] of Object.entries(requesting)) {
            if (amt <= 0) continue;
            if (res.startsWith('__exclusive_')) {
                const slotIdx = parseInt(res.split('_')[3], 10);
                if (!data.exclusiveItems?.[slotIdx]) return false;
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
            const arr = game.resources[`${type}s`];
            if (arr) arr.splice(idx, 1);
        }
        for (const [res, amt] of Object.entries(offering)) {
            if (res.startsWith('__equip_')) continue;
            if (amt > 0) game.resources.deduct({ [res]: amt });
        }

        // --- Execute: give player what they requested ---
        const goldRequested = requesting.__gold || 0;
        for (const [res, amt] of Object.entries(requesting)) {
            if (res.startsWith('__exclusive_')) {
                const slotIdx = parseInt(res.split('_')[3], 10);
                const itemKey = data.exclusiveItems?.[slotIdx];
                const def = itemKey ? ALL_ITEMS[itemKey] : null;
                if (def) game.resources.addItem({ ...def, key: itemKey });
                if (data.exclusiveItems) data.exclusiveItems[slotIdx] = null;
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
        game.notifications.push({ text: `Trade complete!${goldRequested > 0 ? ` +${goldStr}g` : ''}`, tick: game.tick, type: 'success' });
        game.story.checkMilestone('first_trade_completed', game);
        return true;
    }

    dismissTrader() {
        if (this.pendingEvent?.type === 'trade') {
            this.pendingEvent = null;
        }
    }

    eventFire(game) {
        let fireX = -1, fireY = -1;
        for (let attempts = 0; attempts < 20; attempts++) {
            const x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
            const y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
            const tile = game.map[y][x];
            if (tile.resource?.type === 'tree' || (tile.structure && tile.structure !== 'wall')) {
                fireX = x; fireY = y;
                break;
            }
        }
        if (fireX >= 0) {
            game.map[fireY][fireX].onFire = true;
            game.map[fireY][fireX].fireTimer = FIRE_CONFIG.initialLifespan;
            if (game.mapIndex) game.mapIndex.addFire(fireX, fireY);
            window.soundManager?.playSFX('fire_ignite');
            game.notifications.push({ text: 'Fire has broken out!', tick: game.tick, type: 'danger' });
            game.eventLog.add(game, 'Fire has broken out!', 'danger', { type: 'position', x: fireX, y: fireY });
            const t = THOUGHTS.fire_panic;
            for (const c of game.colonists) {
                addThought(c, t.text, t.moodEffect, t.duration, game.tick);
            }
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
    }
}

function getRandomEdgeZone() {
    const margin = 15;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: return { x: margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - margin * 2)), y: 3 + Math.floor(Math.random() * margin) };
        case 1: return { x: CONFIG.MAP_WIDTH - 3 - Math.floor(Math.random() * margin), y: margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - margin * 2)) };
        case 2: return { x: margin + Math.floor(Math.random() * (CONFIG.MAP_WIDTH - margin * 2)), y: CONFIG.MAP_HEIGHT - 3 - Math.floor(Math.random() * margin) };
        case 3: return { x: 3 + Math.floor(Math.random() * margin), y: margin + Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - margin * 2)) };
    }
}

function getRandomInterior() {
    return {
        x: Math.floor(Math.random() * CONFIG.MAP_WIDTH),
        y: Math.floor(Math.random() * CONFIG.MAP_HEIGHT),
    };
}

export function updateFires(game) {
    const firePositions = game.mapIndex ? game.mapIndex.getFirePositions() : null;

    if (!firePositions) {
        _updateFiresFallback(game);
        return;
    }

    for (const { x, y } of firePositions) {
        const tile = game.map[y][x];
        if (!tile.onFire) {
            game.mapIndex.removeFire(x, y);
            continue;
        }

        tile.fireTimer--;

        const wDef = WEATHER_TYPES[game.weather.currentWeather];
        if (wDef && wDef.extinguishesFire) {
            tile.onFire = false;
            tile.fireTimer = 0;
            game.mapIndex.removeFire(x, y);
            continue;
        }

        if (tile.fireTimer <= 0) {
            tile.onFire = false;
            game.mapIndex.removeFire(x, y);
            if (tile.resource?.type === 'tree') {
                tile.resource = null;
            } else if (tile.structure && tile.structure !== 'wall') {
                const oldStructure = tile.structure;
                if (oldStructure === 'bed') {
                    for (const c of game.colonists) {
                        if (c.assignedBed && c.assignedBed.x === x && c.assignedBed.y === y) {
                            c.assignedBed = null;
                        }
                    }
                }
                tile.structure = null;
                game.mapIndex.removeStructure(x, y, oldStructure);
            }
        }

        if (tile.onFire && Math.random() < FIRE_CONFIG.spreadChance) {
            const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            const dir = dirs[Math.floor(Math.random() * 4)];
            const nx = x + dir[0], ny = y + dir[1];
            if (nx >= 0 && nx < CONFIG.MAP_WIDTH && ny >= 0 && ny < CONFIG.MAP_HEIGHT) {
                const neighbor = game.map[ny][nx];
                if (!neighbor.onFire && (neighbor.resource?.type === 'tree' || (neighbor.structure && neighbor.structure !== 'wall'))) {
                    neighbor.onFire = true;
                    neighbor.fireTimer = FIRE_CONFIG.spreadTimerMin + Math.floor(Math.random() * (FIRE_CONFIG.spreadTimerMax - FIRE_CONFIG.spreadTimerMin));
                    game.mapIndex.addFire(nx, ny);
                    game.combatEffects.push({ x: nx, y: ny, char: COMBAT_VISUALS.fireIgniteChar, color: COMBAT_VISUALS.fireIgniteColor, ttl: COMBAT_VISUALS.fireIgniteTtl });
                    window.soundManager?.playSFX('fire_ignite');
                }
            }
        }

        if (tile.onFire) {
            const existingTask = game.taskQueue.getByPosition(x, y);
            if (!existingTask) {
                game.taskQueue.add({
                    type: 'extinguish',
                    skillRequired: 'building',
                    x, y,
                    workAmount: 5,
                });
            }
        }
    }
}

function _updateFiresFallback(game) {
    for (let y = 0; y < game.map.length; y++) {
        for (let x = 0; x < game.map[y].length; x++) {
            const tile = game.map[y][x];
            if (!tile.onFire) continue;

            tile.fireTimer--;

            const wDef = WEATHER_TYPES[game.weather.currentWeather];
            if (wDef && wDef.extinguishesFire) {
                tile.onFire = false;
                tile.fireTimer = 0;
                continue;
            }

            if (tile.fireTimer <= 0) {
                tile.onFire = false;
                if (tile.resource?.type === 'tree') {
                    tile.resource = null;
                } else if (tile.structure && tile.structure !== 'wall') {
                    tile.structure = null;
                }
            }

            if (Math.random() < FIRE_CONFIG.spreadChance) {
                const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                const dir = dirs[Math.floor(Math.random() * 4)];
                const nx = x + dir[0], ny = y + dir[1];
                if (nx >= 0 && nx < CONFIG.MAP_WIDTH && ny >= 0 && ny < CONFIG.MAP_HEIGHT) {
                    const neighbor = game.map[ny][nx];
                    if (!neighbor.onFire && (neighbor.resource?.type === 'tree' || (neighbor.structure && neighbor.structure !== 'wall'))) {
                        neighbor.onFire = true;
                        neighbor.fireTimer = FIRE_CONFIG.spreadTimerMin + Math.floor(Math.random() * (FIRE_CONFIG.spreadTimerMax - FIRE_CONFIG.spreadTimerMin));
                        game.combatEffects.push({ x: nx, y: ny, char: COMBAT_VISUALS.fireIgniteChar, color: COMBAT_VISUALS.fireIgniteColor, ttl: COMBAT_VISUALS.fireIgniteTtl });
                    }
                }
            }

            const existingTask = game.taskQueue.getByPosition(x, y);
            if (!existingTask && tile.onFire) {
                game.taskQueue.add({
                    type: 'extinguish',
                    skillRequired: 'building',
                    x, y,
                    workAmount: 5,
                });
            }
        }
    }
}

import { REALMS, EXPLORATION_CONFIG, EXPEDITION_DIFFICULTY, EXPLORATION_EVENTS, SPELLS, TRINKETS, ALL_ITEMS, COLONIST_CONFIG, TRAITS, SUMMON_TYPES } from '../core/config.js';
import { getEquipmentStat, getEquippedItems, invalidateEquipStatCache } from '../entities/colonist.js';
import { findPathAdjacent, manhattanDist } from '../world/pathfinding.js';
import { getTargetPriority } from '../ui/ui-utils.js';
import { getSpellCooldownMult } from './complexBuildings.js';

let nextExpeditionId = 1;

export class ExplorationSystem {
    constructor() {
        this.expeditions = [];
        this.completedExpeditions = [];
        this.completedRealms = new Set();
    }

    canSend(game, realmKey) {
        const dim = REALMS[realmKey];
        if (!dim) return false;
        if (dim.research && !game.research.isResearched(dim.research)) return false;
        if (dim.requiresEvent && !this._checkEvent(game, dim.requiresEvent)) return false;
        if (!game.power || !game.power.powered) return false;
        if (!game.mapIndex || game.mapIndex.getStructurePositions('rift_gate').size === 0) return false;
        return true;
    }

    getAvailableRealms(game) {
        const results = [];
        for (const [key, dim] of Object.entries(REALMS)) {
            if (dim.research && !game.research.isResearched(dim.research)) continue;
            if (dim.requiresRealm && !this.completedRealms.has(dim.requiresRealm)) continue;
            if (dim.requiresEvent && !this._checkEvent(game, dim.requiresEvent)) continue;
            results.push({ key, ...dim });
        }
        return results;
    }

    _checkEvent(game, eventKey) {
        if (eventKey === 'crusader_raid_defeated') return game.combat.crusaderRaidDefeated;
        return false;
    }

    sendExpedition(game, realmKey, colonistIds, packAnimalIds = [], difficulty = 1) {
        if (!this.canSend(game, realmKey)) return null;
        if (colonistIds.length === 0) return null;

        const dim = REALMS[realmKey];
        const party = [];

        const cappedColonists = colonistIds.slice(0, 5);
        const cappedPacks = (packAnimalIds || []).slice(0, 2);

        for (const id of cappedColonists) {
            const c = game.getColonist(id);
            if (!c || c.hp <= 0 || c.onExpedition || c.drafted) continue;
            if (c.traits && c.traits.includes('pacifist')) continue;
            party.push(c);
        }

        if (party.length === 0) return null;

        const gatePos = this._findRiftGatePosition(game);
        if (!gatePos) return null;

        const packAnimals = [];
        for (const id of cappedPacks) {
            const a = game.entities.find(e => e.id === id && e.tamed);
            if (!a || a.hp <= 0) continue;
            const packRole = a.roles && a.roles.find(r => r.type === 'pack');
            if (packRole) {
                packAnimals.push({ id: a.id, type: a.type, speedBonus: packRole.expeditionSpeedBonus || 0.25 });
                a.onExpedition = true;
            }
        }

        for (const c of party) {
            c.expeditionPending = true;
            if (c.currentTaskId) {
                game.taskQueue.release(c.currentTaskId);
                c.currentTaskId = null;
            }
            const path = findPathAdjacent(game.map, c.x, c.y, gatePos.x, gatePos.y, game._occupiedTiles);
            if (path && path.length > 0) {
                c.path = path;
                c.state = 'moving';
                c._expeditionMove = true;
            }
        }

        let duration = randInt(dim.duration[0], dim.duration[1]);
        const totalSpeedBonus = packAnimals.reduce((sum, pa) => sum + pa.speedBonus, 0);
        if (totalSpeedBonus > 0) {
            duration = Math.max(Math.floor(duration * (1 - totalSpeedBonus)), Math.floor(duration * 0.5));
        }
        let durationMult = 1.0;
        for (const c of party) {
            for (const item of getEquippedItems(c)) {
                if (item.expedition?.durationMult) durationMult *= item.expedition.durationMult;
                if (item.consumable) {
                    game.resources.removeTrinket(item.key);
                    c.trinket = null;
                    invalidateEquipStatCache(c);
                    game.eventLog.add(game, `${c.name}'s ${item.name} crumbles to dust as the expedition begins`, 'event', null);
                }
            }
        }
        if (durationMult !== 1.0) duration = Math.floor(duration * durationMult);
        const diffSettings = EXPEDITION_DIFFICULTY[difficulty] || EXPEDITION_DIFFICULTY[1];
        const { encounters, bossEncounter } = this._generateEncounters(dim, diffSettings);

        const expedition = {
            id: nextExpeditionId++,
            realm: realmKey,
            realmName: dim.name,
            partyIds: party.map(c => c.id),
            packAnimals,
            partySnapshot: [],
            gatePos,
            startTick: null,
            duration,
            encounters,
            bossEncounter,
            bossTriggered: false,
            currentEncounter: 0,
            nextEncounterTick: null,
            status: 'gathering',
            loot: {},
            defeated: [],
            log: packAnimals.length > 0
                ? [{ tick: 0, text: `Party heading to Rift Gate (${packAnimals.length} pack animal${packAnimals.length > 1 ? 's' : ''})`, type: 'info' }]
                : [{ tick: 0, text: `Party heading to Rift Gate`, type: 'info' }],
            combat: null,
            summons: [],
            lastMicroEventTick: 0,
            difficulty,
            diffSettings,
        };

        this.expeditions.push(expedition);
        const diffLabel = diffSettings.name !== 'Normal' ? ` (${diffSettings.name})` : '';
        game.eventLog.add(game, `Expedition assembling for ${dim.name}${diffLabel}`, 'event', null);
        return expedition;
    }

    _findRiftGatePosition(game) {
        const positions = game.mapIndex.getStructurePositions('rift_gate');
        if (positions.size === 0) return null;
        const key = positions.values().next().value;
        return { x: key & 0xFFFF, y: key >> 16 };
    }

    update(game) {
        for (const exp of this.expeditions) {
            if (exp.status === 'complete') continue;

            if (exp.status === 'gathering') {
                this._updateGathering(exp, game);
                continue;
            }

            const elapsed = game.tick - exp.startTick;

            if (exp.status === 'exploring') {
                if (exp.combat) {
                    exp.startTick++;
                    this._updateCombat(exp, game);
                    continue;
                }

                this._regenMana(exp, game);
                this._tryHealSpells(exp, game);

                if (exp.summons && exp.summons.length > 0) {
                    for (let si = exp.summons.length - 1; si >= 0; si--) {
                        exp.summons[si].ticksRemaining--;
                        if (exp.summons[si].ticksRemaining <= 0) {
                            this._addLog(exp, game, `The ${exp.summons[si].name} fades away.`, 'info');
                            exp.summons.splice(si, 1);
                        }
                    }
                }

                const bossDue = exp.bossEncounter && !exp.bossTriggered
                    && elapsed >= exp.duration * EXPLORATION_CONFIG.bossTriggerPercent;

                if (bossDue && !exp.combat) {
                    exp.bossTriggered = true;
                    this._startEncounter(exp, game, exp.bossEncounter);
                } else if (game.tick >= exp.nextEncounterTick && exp.currentEncounter < exp.encounters.length) {
                    this._startEncounter(exp, game);
                    exp.currentEncounter++;
                    exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
                } else {
                    this._tryMicroEvent(exp, game);
                }

                const allDefeated = exp.partySnapshot.every(p => p.hp <= 0);
                if (allDefeated) {
                    exp.status = 'returning';
                    exp.retreatStartTick = game.tick;
                    exp.retreatTick = game.tick + EXPLORATION_CONFIG.retreatTicks;
                    this._addLog(exp, game, 'All explorers defeated — retreating empty-handed', 'danger');
                    exp.loot = {};
                }

                if (elapsed >= exp.duration && exp.status === 'exploring') {
                    exp.status = 'returning';
                    this._addLog(exp, game, 'Expedition complete — returning home', 'success');
                }
            }

            if (exp.status === 'returning') {
                const deadline = exp.retreatTick || (exp.startTick + Math.floor(exp.duration * EXPLORATION_CONFIG.returnTimeMult));
                if (game.tick >= deadline) {
                    this._completeExpedition(exp, game);
                }
            }
        }

        this.expeditions = this.expeditions.filter(e => e.status !== 'complete');
    }

    _addLog(exp, game, text, type = 'info') {
        const tick = game ? game.tick : 0;
        exp.log.push({ tick, text, type });
        if (exp.log.length > 50) exp.log.shift();
    }

    _checkExpeditionRevive(exp, member, game) {
        const slots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
        for (const slot of slots) {
            const item = member[slot];
            if (item?.autoReviveHp && !member._reviveUsed) {
                member.hp = Math.floor(member.maxHp * item.autoReviveHp);
                member._reviveUsed = true;
                member[slot] = null;
                this._addLog(exp, game, `${member.name}'s ${item.name} shatters, bringing them back!`, 'success');
                const colonist = game.getColonist(member.id);
                if (colonist) {
                    if (slot === 'trinket') {
                        colonist.trinketBroken = true;
                    } else {
                        colonist[slot] = null;
                    }
                    invalidateEquipStatCache(colonist);
                }
                return;
            }
        }
        exp.defeated.push(member.id);
        this._addLog(exp, game, pickRandom(EXPLORATION_EVENTS.combatDefeat).replace('{name}', member.name), 'danger');
    }

    _updateGathering(exp, game) {
        const gx = exp.gatePos.x;
        const gy = exp.gatePos.y;
        let allArrived = true;

        for (const id of exp.partyIds) {
            const c = game.getColonist(id);
            if (!c || c.onExpedition) continue;

            const dist = manhattanDist(c.x, c.y, gx, gy);
            if (dist <= 1) {
                if (!c.onExpedition) {
                    c.hp = c.maxHp;
                    if (c.maxMana) c.mana = c.maxMana;
                    c.onExpedition = true;
                    c.state = 'idle';
                    c.path = [];
                    delete c._expeditionMove;
                    delete c.expeditionPending;
                }
            } else {
                allArrived = false;
                if (c.state === 'idle' || (c.state === 'moving' && (!c.path || c.path.length === 0))) {
                    const path = findPathAdjacent(game.map, c.x, c.y, gx, gy, game._occupiedTiles);
                    if (path && path.length > 0) {
                        c.path = path;
                        c.state = 'moving';
                        c._expeditionMove = true;
                    }
                }
            }
        }

        if (allArrived) {
            exp.status = 'exploring';
            exp.startTick = game.tick;
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
            exp.partySnapshot = exp.partyIds.map(id => {
                const c = game.getColonist(id);
                const baseCd = (c.weapon && c.weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
                const atkSpeed = 1 + getEquipmentStat(c, 'attackSpeed');
                const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
                return {
                    id: c.id, name: c.name, hp: c.hp, maxHp: c.maxHp, raceKey: c.race,
                    bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant,
                    golem: c.golem, golemType: c.golemType,
                    weapon: c.weapon, armor: c.armor, helmet: c.helmet, clothes: c.clothes, tool: c.tool,
                    boots: c.boots,
                    trinket: c.trinketBroken ? null : c.trinket,
                    knownSpells: c.knownSpells ? c.knownSpells.filter(s => !c.disabledSpells || !c.disabledSpells.includes(s)) : [],
                    mana: c.mana || 0,
                    maxMana: c.maxMana || 0,
                    spellCooldowns: {},
                    spellDamageBonus: getEquipmentStat(c, 'spellDamageBonus'),
                    attackCooldown: baseCd,
                    effectiveCooldown: effCd,
                    shieldActive: false,
                    shieldReduction: 0,
                };
            });
            this._addLog(exp, game, `Party entered ${REALMS[exp.realm].name}`, 'info');
            game.eventLog.add(game, `Expedition entered ${exp.realmName}`, 'event', null);
            exp.lastMicroEventTick = game.tick;
        }
    }

    _generateEncounters(dim, diffSettings) {
        const encounters = [];
        const totalEncounters = dim.encounters + (diffSettings.extraEncounters || 0);
        for (let i = 0; i < totalEncounters; i++) {
            const isCombat = Math.random() < 0.6;
            if (isCombat) {
                const baseCount = randInt(dim.enemies.count[0], dim.enemies.count[1]);
                const count = Math.max(1, Math.round(baseCount * diffSettings.enemyCountMult));
                const enemies = [];
                for (let j = 0; j < count; j++) {
                    const baseHp = randInt(dim.enemies.hp[0], dim.enemies.hp[1]);
                    const baseDmg = randInt(dim.enemies.damage[0], dim.enemies.damage[1]);
                    enemies.push({
                        hp: Math.round(baseHp * diffSettings.enemyHpMult),
                        maxHp: 0,
                        damage: Math.round(baseDmg * diffSettings.enemyDmgMult),
                    });
                }
                for (const e of enemies) e.maxHp = e.hp;
                encounters.push({ type: 'combat', enemies });
            } else {
                const lootEntry = this._rollLoot(dim, diffSettings);
                encounters.push({ type: 'loot', ...lootEntry });
            }
        }

        let bossEncounter = null;
        if (dim.boss) {
            const bossHp = Math.round(dim.boss.hp * diffSettings.enemyHpMult);
            const bossDmg = Math.round(dim.boss.damage * diffSettings.enemyDmgMult);
            bossEncounter = {
                type: 'combat',
                isBoss: true,
                enemies: [{
                    hp: bossHp, maxHp: bossHp, damage: bossDmg,
                    isBoss: true, name: dim.boss.name,
                    enraged: false,
                    enrageThreshold: dim.boss.enrageThreshold,
                    enrageDamageMult: dim.boss.enrageDamageMult,
                    color: dim.boss.color,
                    enragedColor: dim.boss.enragedColor,
                    sprite: dim.boss.sprite,
                    enragedSprite: dim.boss.enragedSprite,
                }],
            };
        }

        return { encounters, bossEncounter };
    }

    _rollLoot(dim, diffSettings) {
        const lootMult = diffSettings ? diffSettings.lootAmountMult : 1;
        const totalWeight = dim.loot.reduce((s, l) => s + l.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const entry of dim.loot) {
            roll -= entry.weight;
            if (roll <= 0) {
                if (entry.item) return { item: entry.item };
                return { resource: entry.resource, amount: Math.round(randInt(entry.amount[0], entry.amount[1]) * lootMult) };
            }
        }
        const fallback = dim.loot[0];
        if (fallback.item) return { item: fallback.item };
        return { resource: fallback.resource, amount: Math.round(randInt(fallback.amount[0], fallback.amount[1]) * lootMult) };
    }

    _tryMicroEvent(exp, game) {
        if (game.tick - exp.lastMicroEventTick < 12) return;
        if (Math.random() > EXPLORATION_CONFIG.microEventChance) return;

        exp.lastMicroEventTick = game.tick;
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        if (alive.length === 0) return;

        const member = alive[randInt(0, alive.length - 1)];
        const dim = REALMS[exp.realm];
        const dimEvents = dim.events;

        const ds = exp.diffSettings || EXPEDITION_DIFFICULTY[1];
        if (dimEvents && dimEvents.rare) {
            const rareEncounterMult = getPartyExpeditionEffect(exp.partySnapshot, 'rareEncounterMult');
            for (const rare of dimEvents.rare) {
                if (Math.random() < rare.chance * rareEncounterMult * ds.rareLootMult) {
                    const msg = rare.text.replace('{name}', member.name);
                    if (rare.loot.item) {
                        if (!exp.loot._items) exp.loot._items = [];
                        exp.loot._items.push(rare.loot.item);
                        const itemName = ALL_ITEMS[rare.loot.item]?.name || rare.loot.item;
                        this._addLog(exp, game, `${msg} (found ${itemName}!)`, 'loot');
                    } else {
                        const amount = Math.round(randInt(rare.loot.amount[0], rare.loot.amount[1]) * ds.lootAmountMult);
                        exp.loot[rare.loot.resource] = (exp.loot[rare.loot.resource] || 0) + amount;
                        this._addLog(exp, game, `${msg} (+${amount} ${rare.loot.resource.replace(/_/g, ' ')})`, 'loot');
                    }
                    return;
                }
            }
        }

        const roll = Math.random();

        if (roll < EXPLORATION_CONFIG.trapChance) {
            const trapMult = getPartyExpeditionEffect(exp.partySnapshot, 'trapDamageMult');
            const baseDmg = randInt(EXPLORATION_CONFIG.trapDamageRange[0], EXPLORATION_CONFIG.trapDamageRange[1]);
            const dmg = Math.floor(baseDmg * trapMult * ds.trapDmgMult);
            member.hp -= dmg;
            const trapPool = (dimEvents && dimEvents.traps) || EXPLORATION_EVENTS.traps;
            const msg = pickRandom(trapPool).replace('{name}', member.name);
            this._addLog(exp, game, `${msg} (${dmg} dmg)`, 'danger');
            if (member.hp <= 0) {
                this._checkExpeditionRevive(exp, member, game);
            }
        } else if (roll < EXPLORATION_CONFIG.trapChance + EXPLORATION_CONFIG.findItemChance) {
            const lootEntry = this._rollLoot(dim, ds);
            const lootMult = getPartyExpeditionEffect(exp.partySnapshot, 'lootMult');
            const discPool = (dimEvents && dimEvents.discoveries) || EXPLORATION_EVENTS.discoveries;
            const msg = pickRandom(discPool).replace('{name}', member.name);
            if (lootEntry.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(lootEntry.item);
                const itemName = ALL_ITEMS[lootEntry.item]?.name || lootEntry.item;
                this._addLog(exp, game, `${msg} (found ${itemName}!)`, 'loot');
            } else {
                const boostedAmount = Math.floor(lootEntry.amount * lootMult);
                exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + boostedAmount;
                this._addLog(exp, game, `${msg} (+${boostedAmount} ${lootEntry.resource.replace(/_/g, ' ')})`, 'loot');
            }
        } else {
            const ambientPool = (dimEvents && dimEvents.ambient) || EXPLORATION_EVENTS.ambient;
            const msg = pickRandom(ambientPool).replace('{name}', member.name);
            this._addLog(exp, game, msg, 'ambient');
        }
    }

    // Initiates an encounter from the pre-generated encounter list.
    // Encounters are either 'loot' (immediate reward) or 'combat' (triggers
    // the round-based combat loop in _updateCombat).
    _startEncounter(exp, game, encounterOverride) {
        const encounter = encounterOverride || exp.encounters[exp.currentEncounter];
        if (!encounter) return;

        if (encounter.type === 'loot') {
            const member = exp.partySnapshot.find(p => p.hp > 0) || exp.partySnapshot[0];
            const dim = REALMS[exp.realm];
            const discPool = (dim.events && dim.events.discoveries) || EXPLORATION_EVENTS.discoveries;
            const msg = pickRandom(discPool).replace('{name}', member.name);
            // A loot roll can be an item ({ item }) with no resource/amount. Items
            // accumulate in exp.loot._items (matched to _completeExpedition); treating them
            // as a resource wrote stockpile['undefined'] = NaN and permanently poisoned wealth.
            // The previous .replace(encounter.resource) also threw on the item case, which is
            // why the log line was commented out.
            if (encounter.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(encounter.item);
                const itemName = ALL_ITEMS[encounter.item]?.name || encounter.item;
                this._addLog(exp, game, `${msg} (found ${itemName}!)`, 'loot');
            } else {
                exp.loot[encounter.resource] = (exp.loot[encounter.resource] || 0) + encounter.amount;
                this._addLog(exp, game, `${msg} (+${encounter.amount} ${encounter.resource.replace(/_/g, ' ')})`, 'loot');
            }
            return;
        }

        const enemies = encounter.enemies.map(e => ({ ...e }));

        if (encounter.isBoss) {
            const bossEnemy = enemies.find(e => e.isBoss);
            const dim = REALMS[exp.realm];
            const approachMsg = dim.boss?.approachText || `A powerful foe blocks the path: ${bossEnemy.name}!`;
            this._addLog(exp, game, approachMsg, 'danger');
        } else {
            const startMsg = pickRandom(EXPLORATION_EVENTS.combatStart);
            this._addLog(exp, game, `${startMsg} (${enemies.length} foes)`, 'combat');
        }

        exp.combat = {
            enemies,
            roundTick: game.tick + EXPLORATION_CONFIG.combatRoundTicks,
            round: 0,
            encounterIndex: exp.currentEncounter,
            isBoss: encounter.isBoss || false,
        };
    }

    // Round-based combat: runs one round per EXPLORATION_CONFIG.combatRoundTicks.
    // Each round: party attacks (multi-hit from low cooldown), party spell phase,
    // then enemies attack. Damage = base weapon + rand(0,3), modified by
    // equipment stats and difficulty multipliers. 15% flat miss chance on both sides.
    // Enemy targeting uses equipment targetPriority (taunt mechanic).
    _updateCombat(exp, game) {
        const combat = exp.combat;
        if (game.tick < combat.roundTick) return;

        combat.roundTick = game.tick + EXPLORATION_CONFIG.combatRoundTicks;
        combat.round++;

        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        const enemiesAlive = combat.enemies.filter(e => e.hp > 0);

        if (alive.length === 0 || enemiesAlive.length === 0) {
            this._finishCombat(exp, game);
            return;
        }

        const partyDmgMult = getPartyExpeditionEffect(exp.partySnapshot, 'partyDamageMult');
        for (const member of alive) {
            if (member.hp <= 0) continue;
            let weaponDmg = member.weapon ? member.weapon.damage : EXPLORATION_CONFIG.baseFistDamage;
            const memberItems = [member.weapon, member.armor, member.helmet, member.clothes, member.boots, member.tool, member.trinket].filter(Boolean);
            for (const item of memberItems) { if (item !== member.weapon && item.damage) weaponDmg += item.damage; }
            const critChance = memberItems.reduce((sum, it) => sum + (it.critChance || 0), 0);
            const hitsPerRound = Math.max(1, Math.round(member.attackCooldown / member.effectiveCooldown));
            for (let hit = 0; hit < hitsPerRound; hit++) {
                const target = combat.enemies.find(e => e.hp > 0);
                if (!target) break;
                const targetLabel = target.isBoss ? target.name : 'an enemy';
                let dmg = Math.floor((weaponDmg + randInt(0, 3)) * partyDmgMult);
                let critHit = false;
                if (critChance > 0 && Math.random() < critChance) { dmg *= 2; critHit = true; }

                if (Math.random() < 0.15) {
                    const msg = pickRandom(EXPLORATION_EVENTS.combatMiss)
                        .replace('{attacker}', member.name)
                        .replace('{target}', targetLabel);
                    this._addLog(exp, game, msg, 'combat');
                } else {
                    target.hp -= dmg;
                    const hitMsg = critHit ? `${member.name} lands a critical strike on ${targetLabel} for ${dmg} damage!` : null;
                    const msg = hitMsg || pickRandom(EXPLORATION_EVENTS.combatHit)
                        .replace('{attacker}', member.name)
                        .replace('{target}', targetLabel)
                        .replace('{dmg}', dmg);
                    this._addLog(exp, game, msg, 'combat');
                    const lifeSteal = memberItems.reduce((sum, it) => sum + (it.lifeSteal || 0), 0);
                    if (lifeSteal > 0) {
                        const healed = Math.floor(dmg * lifeSteal);
                        if (healed > 0) member.hp = Math.min(member.maxHp, member.hp + healed);
                    }
                    if (target.hp <= 0) {
                        const slayLabel = target.isBoss ? target.name : 'a foe';
                        this._addLog(exp, game, `${member.name} slays ${slayLabel}!`, 'success');
                        const hpOnKill = memberItems.reduce((sum, it) => sum + (it.hpOnKill || 0), 0);
                        if (hpOnKill > 0) member.hp = Math.min(member.maxHp, member.hp + hpOnKill);
                    }
                }
            }
        }

        this._tryCombatSpells(exp, game, alive, combat);

        if (exp.summons && exp.summons.length > 0) {
            for (let si = exp.summons.length - 1; si >= 0; si--) {
                const summon = exp.summons[si];
                summon.ticksRemaining -= EXPLORATION_CONFIG.combatRoundTicks;
                if (summon.ticksRemaining <= 0 || summon.hp <= 0) {
                    this._addLog(exp, game, `The ${summon.name} fades away.`, 'info');
                    exp.summons.splice(si, 1);
                    continue;
                }
                const summonTarget = combat.enemies.find(e => e.hp > 0);
                if (summonTarget) {
                    const sDmg = summon.damage + randInt(0, 2);
                    if (Math.random() < 0.1) {
                        this._addLog(exp, game, `The ${summon.name} misses!`, 'combat');
                    } else {
                        summonTarget.hp -= sDmg;
                        this._addLog(exp, game, `The ${summon.name} attacks for ${sDmg}!`, 'combat');
                        if (summonTarget.hp <= 0) this._addLog(exp, game, `The ${summon.name} slays a foe!`, 'success');
                    }
                }
            }
        }

        for (const enemy of combat.enemies) {
            if (enemy.hp <= 0) continue;
            if (enemy.isBoss && !enemy.enraged && enemy.hp / enemy.maxHp <= enemy.enrageThreshold) {
                enemy.enraged = true;
                enemy.damage = Math.floor(enemy.damage * enemy.enrageDamageMult);
                const dim = REALMS[exp.realm];
                this._addLog(exp, game, dim.boss?.enrageText || `${enemy.name} becomes enraged!`, 'danger');
            }
            const attackerLabel = enemy.isBoss ? enemy.name : 'An enemy';
            const enemyCd = enemy.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            const enemyHits = Math.max(1, Math.round(COLONIST_CONFIG.baseAttackCooldown / enemyCd));
            for (let hit = 0; hit < enemyHits; hit++) {
                const aliveSummons = exp.summons ? exp.summons.filter(s => s.hp > 0) : [];
                if (aliveSummons.length > 0 && Math.random() < 0.5) {
                    const targetSummon = aliveSummons[randInt(0, aliveSummons.length - 1)];
                    let dmg = enemy.damage + randInt(0, 2);
                    if (Math.random() < 0.15) {
                        this._addLog(exp, game, `${attackerLabel} misses the ${targetSummon.name}!`, 'combat');
                    } else {
                        targetSummon.hp -= dmg;
                        this._addLog(exp, game, `${attackerLabel} strikes the ${targetSummon.name} for ${dmg}!`, 'combat');
                        if (targetSummon.hp <= 0) {
                            this._addLog(exp, game, `The ${targetSummon.name} is slain!`, 'danger');
                            exp.summons.splice(exp.summons.indexOf(targetSummon), 1);
                        }
                    }
                    continue;
                }
                let target = null;
                let bestScore = Infinity;
                for (const p of alive) {
                    if (p.hp <= 0) continue;
                    const priority = getTargetPriority(p);
                    const score = -priority;
                    if (score < bestScore) { bestScore = score; target = p; }
                }
                if (!target) break;
                const targetItems = [target.weapon, target.armor, target.helmet, target.clothes, target.boots, target.tool, target.trinket].filter(Boolean);
                const dodgeChance = targetItems.reduce((sum, it) => sum + (it.dodgeChance || 0), 0);
                if (dodgeChance > 0 && Math.random() < dodgeChance) {
                    this._addLog(exp, game, `${target.name} dodges ${enemy.isBoss ? enemy.name + '\'s' : 'an'} attack!`, 'combat');
                    continue;
                }
                let dmg = enemy.damage + randInt(0, 2);
                for (const item of targetItems) {
                    if (item.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - item.damageReduction)));
                }
                if (target.shieldActive) {
                    dmg = Math.max(1, Math.floor(dmg * (1 - target.shieldReduction)));
                }

                if (Math.random() < 0.15) {
                    const msg = pickRandom(EXPLORATION_EVENTS.combatMiss)
                        .replace('{attacker}', attackerLabel)
                        .replace('{target}', target.name);
                    this._addLog(exp, game, msg, 'combat');
                } else {
                    target.hp -= dmg;
                    const msg = pickRandom(EXPLORATION_EVENTS.combatHit)
                        .replace('{attacker}', attackerLabel)
                        .replace('{target}', target.name)
                        .replace('{dmg}', dmg);
                    this._addLog(exp, game, msg, 'combat');
                    const thorns = targetItems.reduce((sum, it) => sum + (it.thornsDamage || 0), 0);
                    if (thorns > 0 && enemy.hp > 0) {
                        enemy.hp -= thorns;
                        this._addLog(exp, game, `Thorns deal ${thorns} damage back!`, 'combat');
                        if (enemy.hp <= 0) this._addLog(exp, game, `${attackerLabel} is slain by thorns!`, 'success');
                    }
                    if (target.hp <= 0) {
                        this._checkExpeditionRevive(exp, target, game);
                    }
                }
            }
        }

        if (combat.enemies.every(e => e.hp <= 0) || alive.every(p => p.hp <= 0)) {
            this._finishCombat(exp, game);
        }
    }

    _canCastSpell(member, spellKey, game) {
        const spell = SPELLS[spellKey];
        if (!spell) return false;
        if (member.mana < spell.manaCost) return false;
        const lastCast = member.spellCooldowns[spellKey] || 0;
        if (game.tick - lastCast < spell.cooldown * getSpellCooldownMult(game)) return false;
        return true;
    }

    _tryCombatSpells(exp, game, alive, combat) {
        for (const member of alive) {
            if (member.hp <= 0 || member.knownSpells.length === 0) continue;

            for (const spellKey of member.knownSpells) {
                const spell = SPELLS[spellKey];
                if (!spell || spell.trigger !== 'inCombat') continue;
                if (!this._canCastSpell(member, spellKey, game)) continue;

                member.mana -= spell.manaCost;
                member.spellCooldowns[spellKey] = game.tick;

                if (spell.effect === 'ranged_damage' || spell.effect === 'ranged_damage_aoe') {
                    let dmg = spell.damage;
                    if (member.spellDamageBonus) {
                        dmg = Math.floor(dmg * (1 + member.spellDamageBonus));
                    }
                    if (spell.effect === 'ranged_damage_aoe') {
                        const targets = combat.enemies.filter(e => e.hp > 0).slice(0, 3);
                        for (const t of targets) {
                            t.hp -= dmg;
                        }
                        this._addLog(exp, game, `${member.name} casts ${spell.name}! Hits ${targets.length} foes for ${dmg} each.`, 'combat');
                        game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                        for (const t of targets) {
                            if (t.hp <= 0) this._addLog(exp, game, `An enemy is destroyed by the blast!`, 'success');
                        }
                    } else {
                        const target = combat.enemies.find(e => e.hp > 0);
                        if (target) {
                            target.hp -= dmg;
                            this._addLog(exp, game, `${member.name} casts ${spell.name} at an enemy for ${dmg} damage!`, 'combat');
                            game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                            if (target.hp <= 0) this._addLog(exp, game, `${member.name}'s spell slays a foe!`, 'success');
                        }
                    }
                    break;
                } else if (spell.effect === 'buff_defense' && !member.shieldActive) {
                    member.shieldActive = true;
                    member.shieldReduction = spell.damageReduction;
                    this._addLog(exp, game, `${member.name} casts ${spell.name} — shielded!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    break;
                } else if (spell.effect === 'summon') {
                    if (!exp.summons) exp.summons = [];
                    if (exp.summons.some(s => s.ownerId === member.id && s.hp > 0)) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    exp.summons.push({
                        type: spell.summonType,
                        name: summonDef.name,
                        hp: summonDef.hp,
                        maxHp: summonDef.hp,
                        damage: summonDef.damage,
                        char: summonDef.char,
                        color: summonDef.color,
                        ownerId: member.id,
                        ticksRemaining: summonDef.duration,
                        maxDuration: summonDef.duration,
                    });
                    this._addLog(exp, game, `${member.name} summons a ${summonDef.name}!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    break;
                }
            }
        }
    }

    _tryHealSpells(exp, game) {
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        for (const member of alive) {
            if (member.knownSpells.length === 0) continue;
            const hpRatio = member.hp / member.maxHp;

            for (const spellKey of member.knownSpells) {
                const spell = SPELLS[spellKey];
                if (!spell || spell.effect !== 'heal') continue;
                const threshold = spell.hpThreshold || 0.5;
                if (hpRatio >= threshold) continue;
                if (!this._canCastSpell(member, spellKey, game)) continue;

                member.mana -= spell.manaCost;
                member.spellCooldowns[spellKey] = game.tick;
                const healed = Math.min(spell.healAmount, member.maxHp - member.hp);
                member.hp += healed;
                this._addLog(exp, game, `${member.name} casts ${spell.name} and heals for ${healed} HP.`, 'success');
                game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                break;
            }
        }
    }

    _regenMana(exp, game) {
        if (game.tick % 10 !== 0) return;
        for (const member of exp.partySnapshot) {
            if (member.hp <= 0) continue;
            if (member.mana < member.maxMana) {
                member.mana = Math.min(member.maxMana, member.mana + 1);
            }
        }
    }

    _finishCombat(exp, game) {
        const survived = exp.partySnapshot.filter(p => p.hp > 0).length;
        if (survived > 0) {
            const dim = REALMS[exp.realm];

            if (exp.combat.isBoss && dim.boss) {
                const boss = dim.boss;
                this._addLog(exp, game, boss.defeatText, 'success');
                if (!exp.loot._items) exp.loot._items = [];
                for (const lootEntry of boss.guaranteedLoot) {
                    if (Math.random() < lootEntry.chance) {
                        exp.loot._items.push(lootEntry.item);
                        const itemName = ALL_ITEMS[lootEntry.item]?.name || lootEntry.item;
                        this._addLog(exp, game, `Found ${itemName}!`, 'loot');
                        break;
                    }
                }
                for (const [res, amt] of Object.entries(boss.bonusResources)) {
                    exp.loot[res] = (exp.loot[res] || 0) + amt;
                    this._addLog(exp, game, `+${amt} ${res.replace(/_/g, ' ')} from the boss!`, 'loot');
                }
            }

            const lootMult = getPartyExpeditionEffect(exp.partySnapshot, 'lootMult');
            const dsCombat = exp.diffSettings || EXPEDITION_DIFFICULTY[1];
            const lootEntry = this._rollLoot(dim, dsCombat);
            if (lootEntry.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(lootEntry.item);
                const itemName = ALL_ITEMS[lootEntry.item]?.name || lootEntry.item;
                this._addLog(exp, game, `Victory! Found ${itemName}!`, 'success');
            } else {
                const amount = Math.floor(lootEntry.amount * lootMult);
                exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                this._addLog(exp, game, `Victory! Looted ${amount} ${lootEntry.resource.replace(/_/g, ' ')}.`, 'success');
            }
        } else {
            this._addLog(exp, game, 'The party has been overwhelmed...', 'danger');
        }
        for (const member of exp.partySnapshot) {
            member.shieldActive = false;
            member.shieldReduction = 0;
        }
        const combatBonus = Math.floor(exp.duration * 0.05);
        exp.startTick -= combatBonus;
        exp.combat = null;
    }

    _completeExpedition(exp, game) {
        exp.status = 'complete';

        const allDefeated = exp.partySnapshot.every(p => p.hp <= 0);
        if (!allDefeated) {
            this.completedRealms.add(exp.realm);
            game.story.checkMilestone(`realm_${exp.realm}`, game);
            if (game.stats) game.stats.expeditionsCompleted++;
        }
        const gx = exp.gatePos.x;
        const gy = exp.gatePos.y;

        for (const snapshot of exp.partySnapshot) {
            const colonist = game.getColonist(snapshot.id);
            if (!colonist) continue;
            colonist.onExpedition = false;
            colonist.x = gx;
            colonist.y = gy;
            if (snapshot.hp <= 0) {
                colonist.hp = 1;
            } else {
                colonist.hp = Math.min(colonist.maxHp, snapshot.hp);
            }
            colonist.mana = Math.min(colonist.maxMana, snapshot.mana);
            colonist.state = 'idle';
        }

        if (exp.packAnimals) {
            for (const pa of exp.packAnimals) {
                const animal = game.entities.find(a => a.id === pa.id);
                if (animal) animal.onExpedition = false;
            }
        }

        const items = exp.loot._items || [];
        delete exp.loot._items;
        game.resources.add(exp.loot);
        for (const itemKey of items) {
            game.resources.addItem({ ...ALL_ITEMS[itemKey], key: itemKey });
        }
        for (const [res, amt] of Object.entries(exp.loot)) {
            game.overlays.push({ type: 'floating_text', x: exp.gatePos.x, y: exp.gatePos.y, text: `+${amt}x ${ALL_ITEMS[res]?.name || res}`, color: '#ffdd44', fontSize: 10, ttl: 20, maxTtl: 20 });
        }
        if (game.discoveredLoot) {
            for (const res of Object.keys(exp.loot)) {
                game.discoveredLoot.add(`${exp.realm}:${res}`);
            }
            for (const itemKey of items) {
                game.discoveredLoot.add(`${exp.realm}:${itemKey}`);
            }
        }
        const parts = [];// = Object.entries(exp.loot).map(([k, v]) => `${v} ${k}`);
        for (const itemKey of items) {
            parts.push(ALL_ITEMS[itemKey]?.name || itemKey);
        }
        for (const [res, amt] of Object.entries(exp.loot)) {
            parts.push([`${amt}x ${ALL_ITEMS[res]?.name || res}`]);
        }
        const lootSummary = parts.join(', ');
        if (!allDefeated) {
            this._addLog(exp, game, `Returned with: ${lootSummary || 'nothing'}`, 'success');
            game.eventLog.add(game, `Expedition returned from ${exp.realmName}: ${lootSummary || 'nothing'}`, 'event', null);
        } else {
            this._addLog(exp, game, `Party defeated — salvaged: ${lootSummary || 'nothing'}`, 'danger');
            game.eventLog.add(game, `Expedition to ${exp.realmName} failed — salvaged: ${lootSummary || 'nothing'}`, 'warning', null);
        }

        this.completedExpeditions.push(exp);
        if (this.completedExpeditions.length > 10) {
            this.completedExpeditions.shift();
        }
    }
}

const PEDESTAL_TO_EXPEDITION = {
    damageBonusMult: 'partyDamageMult',
    workSpeedBonus: null,
    skillGrowthBonus: null,
    blightImmunity: null,
};

function getPartyExpeditionEffect(partySnapshot, effectKey) {
    let value = effectKey.includes('Mult') ? 1.0 : 0;
    for (const member of partySnapshot) {
        if (member.hp <= 0) continue;
        const items = [member.weapon, member.armor, member.helmet, member.clothes, member.boots, member.tool, member.trinket].filter(Boolean);
        for (const item of items) {
            if (item.expedition?.[effectKey]) {
                if (effectKey.includes('Mult')) value *= item.expedition[effectKey];
                else value += item.expedition[effectKey];
            }
            if (item.pedestal && typeof item.pedestal.radius === 'number') {
                for (const [pedestalKey, mappedKey] of Object.entries(PEDESTAL_TO_EXPEDITION)) {
                    if (mappedKey !== effectKey) continue;
                    if (!item.pedestal[pedestalKey]) continue;
                    if (effectKey.includes('Mult')) value *= item.pedestal[pedestalKey];
                    else value += item.pedestal[pedestalKey];
                }
            }
        }
    }
    return value;
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[randInt(0, arr.length - 1)];
}

export function estimatePartyStrength(game, colonistIds, realmKey, difficulty) {
    const realm = REALMS[realmKey];
    if (!realm) return null;
    const diff = EXPEDITION_DIFFICULTY[difficulty] || EXPEDITION_DIFFICULTY[1];

    let totalDmg = 0, totalHp = 0, drProduct = 1, size = 0;
    const members = [];
    const spellRoster = [];

    for (const id of colonistIds) {
        const c = game.getColonist(id);
        if (!c || c.hp <= 0) continue;
        size++;
        let dmg = c.weapon ? c.weapon.damage : EXPLORATION_CONFIG.baseFistDamage;
        const items = [c.weapon, c.armor, c.helmet, c.clothes, c.boots, c.tool, c.trinket].filter(Boolean);
        for (const item of items) {
            if (item !== c.weapon && item.damage) dmg += item.damage;
        }
        const baseCd = (c.weapon && c.weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
        const atkSpeed = 1 + getEquipmentStat(c, 'attackSpeed');
        const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
        const hitsPerRound = Math.max(1, Math.round(baseCd / effCd));
        const memberDmg = dmg * hitsPerRound;
        totalDmg += memberDmg;
        totalHp += c.maxHp;
        let dr = 1;
        for (const item of items) {
            if (item.damageReduction) dr *= (1 - item.damageReduction);
        }
        drProduct *= dr;

        const combatTraits = [];
        for (const traitKey of (c.traits || [])) {
            const t = TRAITS[traitKey];
            if (t && t.damageTakenMult) combatTraits.push({ name: t.name, description: t.description });
        }

        const memberSpells = [];
        for (const spellKey of (c.knownSpells || [])) {
            if (c.disabledSpells && c.disabledSpells.includes(spellKey)) continue;
            const spell = SPELLS[spellKey];
            if (!spell) continue;
            const isExpeditionRelevant = spell.trigger === 'inCombat' || spell.trigger === 'lowHealth';
            if (!isExpeditionRelevant) continue;
            memberSpells.push(spellKey);
            const existing = spellRoster.find(s => s.spellKey === spellKey);
            if (existing) {
                existing.casters.push(c.name);
            } else {
                let effectDesc;
                if (spell.effect === 'ranged_damage') effectDesc = `${spell.damage} dmg`;
                else if (spell.effect === 'ranged_damage_aoe') effectDesc = `${spell.damage} AOE dmg`;
                else if (spell.effect === 'melee_damage') effectDesc = `${spell.damage} melee dmg`;
                else if (spell.effect === 'heal') effectDesc = `heals ${spell.healAmount} HP`;
                else if (spell.effect === 'buff_defense') effectDesc = `${Math.round(spell.damageReduction * 100)}% DR shield`;
                else if (spell.effect === 'summon') {
                    const st = SUMMON_TYPES[spell.summonType];
                    effectDesc = st ? `summons ${st.name} (${st.hp} HP, ${st.damage} dmg)` : 'summons ally';
                } else effectDesc = spell.effect;
                let triggerDesc = spell.trigger === 'inCombat' ? 'in combat' : `HP < ${Math.round((spell.hpThreshold || 0.5) * 100)}%`;
                spellRoster.push({ spellKey, name: spell.name, school: spell.school, casters: [c.name], manaCost: spell.manaCost, triggerDesc, effectDesc });
            }
        }

        members.push({
            name: c.name, dmgPerRound: memberDmg, hitsPerRound, hp: c.maxHp,
            dr: Math.round((1 - dr) * 100), maxMana: c.maxMana || 0,
            traits: combatTraits, spells: memberSpells,
            trinketName: c.trinket?.name || null,
        });
    }

    if (size === 0) return null;
    const avgDR = 1 - Math.pow(drProduct, 1 / size);

    const partyEffects = {};
    const effectKeys = ['partyDamageMult', 'trapDamageMult', 'lootMult', 'rareEncounterMult', 'durationMult'];
    const mockSnapshot = colonistIds.map(id => {
        const c = game.getColonist(id);
        return c ? { hp: c.hp, weapon: c.weapon, armor: c.armor, helmet: c.helmet, clothes: c.clothes, boots: c.boots, tool: c.tool, trinket: c.trinketBroken ? null : c.trinket } : null;
    }).filter(Boolean);
    for (const key of effectKeys) {
        const val = getPartyExpeditionEffect(mockSnapshot, key);
        if (key.includes('Mult') && val !== 1.0) partyEffects[key] = val;
        else if (!key.includes('Mult') && val !== 0) partyEffects[key] = val;
    }
    const topLevelStats = ['autoReviveHp', 'healthRegen', 'lifeSteal', 'thornsDamage'];
    for (const key of topLevelStats) {
        let total = 0;
        for (const m of mockSnapshot) {
            if (m.hp <= 0) continue;
            const items = [m.weapon, m.armor, m.helmet, m.clothes, m.boots, m.tool, m.trinket].filter(Boolean);
            for (const item of items) { if (item[key]) total += item[key]; }
        }
        if (total > 0) partyEffects[key] = total;
    }

    const enemyCount = Math.round(((realm.enemies.count[0] + realm.enemies.count[1]) / 2) * diff.enemyCountMult);
    const enemyHp = ((realm.enemies.hp[0] + realm.enemies.hp[1]) / 2) * diff.enemyHpMult;
    const enemyDmg = ((realm.enemies.damage[0] + realm.enemies.damage[1]) / 2) * diff.enemyDmgMult;
    const combatEncounters = Math.ceil((realm.encounters + (diff.extraEncounters || 0)) * 0.6);

    const totalEnemyHp = enemyHp * enemyCount * combatEncounters;
    const roundsToKill = totalEnemyHp / Math.max(1, totalDmg + 1.5);
    const totalDmgToParty = roundsToKill * enemyDmg * enemyCount * (1 - avgDR) * 0.85;
    const ratio = totalHp / Math.max(1, totalDmgToParty);

    let rating, color;
    if (ratio > 3.0) { rating = 'Easy'; color = '#44cc44'; }
    else if (ratio > 1.5) { rating = 'Fair'; color = '#88cc44'; }
    else if (ratio > 0.8) { rating = 'Tough'; color = '#cccc44'; }
    else if (ratio > 0.4) { rating = 'Dangerous'; color = '#ff8844'; }
    else { rating = 'Suicidal'; color = '#ff4444'; }

    return { rating, color, totalDmg, totalHp, avgDR: Math.round(avgDR * 100), size, members, partyEffects, spellRoster };
}

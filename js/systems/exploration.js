import { REALMS, DEMO_ALLOWED_REALM_CHAINS, EXPLORATION_CONFIG, EXPEDITION_DIFFICULTY, EXPLORATION_EVENTS, SPELLS, MAGIC_SKILLS, MAGIC_STUDY_CONFIG, TRINKETS, ALL_ITEMS, COLONIST_CONFIG, TRAITS, ENTITIES, SUMMON_TYPES, SKILLS, ANIMALS,
    FORMATION_CONFIG, EXPEDITION_TRAPS, EXPEDITION_ENEMIES, ELITE_MODIFIERS, ELITE_CONFIG,
    EXPEDITION_DECISIONS, PUZZLE_ENCOUNTERS, NPC_ENCOUNTERS,
    EXPEDITION_POTIONS, POTION_CARRY_CONFIG, EXPEDITION_MUTATORS,
    FATIGUE_CONFIG, STREAK_CONFIG, EXPEDITION_XP_CONFIG, ANIMAL_XP_CONFIG,
    REALM_EVENTS, REALM_EVENT_CONFIG, BESTIARY_CONFIG, NODE_MAP_CONFIG, THOUGHTS, CRYPT_CONFIG, COMBAT_VISUALS,
} from '../core/config.js';
import { getEquipmentStat, getEquippedItems, invalidateEquipStatCache, isSpellAttuned, applyWeaponOnHit, addThought } from '../entities/colonist.js';
import { itemName, itemRef } from '../entities/item-roll.js';
import { setLogMessage } from '../ui/eventlog.js';
// `t` is aliased: this file uses `t` for traits and targets in many loops.
import { t as tr, tp, hasKey, ref, defRef, defMessage } from '../core/i18n.js';
import { resourceRef, entityRef, entityName } from '../core/names.js';
import { checkColonyMilestones } from '../entities/waves.js';
import { getBestDivinationLevel, generateRealmScry } from './omens.js';

// Precomputes a per-school equipment bonus map for a colonist so expedition combat can
// scale spell damage by school without live equipment access. Mirrors the in-world
// getEquipmentSchoolBonus: per-school `<school>Bonus` stats added to spellDamageBonus.
function buildSchoolBonuses(colonist) {
    const bonuses = {};
    const base = getEquipmentStat(colonist, 'spellDamageBonus');
    for (const school of Object.keys(MAGIC_SKILLS)) {
        bonuses[school] = base + getEquipmentStat(colonist, `${school}Bonus`);
    }
    return bonuses;
}

// Expedition-side spell effect multiplier from school mastery. Mirrors the in-world
// getSpellPower using the snapshot's magicSkills. Divination opts out.
function expeditionSpellPower(member, spell) {
    if (!spell || !spell.school) return 1;
    if (spell.powerScale === 0 || spell.effect === 'divination_modifier') return 1;
    const level = (member.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    const scale = spell.powerScale !== undefined ? spell.powerScale : MAGIC_STUDY_CONFIG.spellPowerPerLevel;
    return 1 + over * scale;
}

// School-level mana-cost reduction, mirroring colonist.js getEffectiveManaCost.
function expeditionCostReduction(member, spell) {
    const level = (member.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    return Math.min(MAGIC_STUDY_CONFIG.manaCostReductionCap, over * MAGIC_STUDY_CONFIG.manaCostReductionPerLevel);
}

// School-level cooldown multiplier, mirroring colonist.js getSpellCooldownFactor.
function expeditionCooldownFactor(member, spell) {
    const level = (member.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    const reduction = Math.min(MAGIC_STUDY_CONFIG.cooldownReductionCap, over * MAGIC_STUDY_CONFIG.cooldownReductionPerLevel);
    const gearReduction = member.spellCooldownReduction || 0;
    return Math.max(0.1, (1 - reduction) * (1 - gearReduction));
}
import { findPathAdjacent } from '../world/pathfinding.js';
import { getTargetPriority } from '../ui/ui-utils.js';
import { getSpellCooldownMult, getExpeditionLuckBonus } from './complexBuildings.js';

let nextExpeditionId = 1;

export class ExplorationSystem {
    constructor() {
        this.expeditions = [];
        this.completedExpeditions = [];
        this.completedRealms = new Set();
        this.bestiary = new Map();
        this.wildlifeKills = new Map();
        this.raiderKills = new Map();
        this.summonsSeen = new Map();
        this.expeditionXP = {};
        this.fatigueCooldowns = {};
        this.realmHistory = [];
        this.partyPresets = [];
        this.activeRealmEvents = [];
        this.pendingSummary = null;
        this.pendingAutoSummaries = [];
        // Scry hints keyed by realm key: { icon, title, text, tone } revealed by a
        // diviner before an expedition. Persist until that realm is next explored,
        // so a scried hint stays consistent while the player assembles a party.
        this.realmScries = {};
    }

    syncIdCounter() {
        let maxId = 0;
        for (const e of this.expeditions) if (e.id > maxId) maxId = e.id;
        for (const e of this.completedExpeditions) if (e.id > maxId) maxId = e.id;
        nextExpeditionId = maxId + 1;
    }

    // A realm is demo-locked when demo mode is on and its chain is not in the
    // demo allow-list. This is independent of research / event / prior-realm
    // gating, so an auto-unlock (e.g. crusader_raid_defeated) can never open a
    // non-allowed chain while the demo is active.
    _isRealmDemoLocked(game, dim) {
        if (!dim || !game.settings?.demoMode) return false;
        return !DEMO_ALLOWED_REALM_CHAINS.has(dim.chain);
    }

    isRealmDemoLocked(game, realmKey) {
        return this._isRealmDemoLocked(game, REALMS[realmKey]);
    }

    /**
     * Whether a realm's chain is open on a map with no crypt anchor for it (saves from
     * before anchors, which launch from the Rift Gate). Normally the chain's crypt ward
     * orders the chains; without an anchor, a chain with no research gate instead needs
     * the boss of the chain its ward is bound to cleared.
     *
     * @param {object} game Game instance.
     * @param {object} dim Realm definition from REALMS.
     * @return {boolean} True if the chain is open.
     */
    _chainOpen(game, dim) {
        if (dim.research || game.ruins.getAnchor(dim.chain)) return true;
        const prevChain = CRYPT_CONFIG.wardedBy[dim.chain];
        if (!prevChain) return true;
        const boss = Object.keys(REALMS).find(k => REALMS[k].chain === prevChain && REALMS[k].boss);
        return !boss || this.completedRealms.has(boss);
    }

    canSend(game, realmKey) {
        const dim = REALMS[realmKey];
        if (!dim) return false;
        if (this._isRealmDemoLocked(game, dim)) return false;
        if (dim.research && !game.research.isResearched(dim.research)) return false;
        if (!this._chainOpen(game, dim)) return false;
        if (dim.requiresEvent && !this._checkEvent(game, dim.requiresEvent)) return false;
        if (!this.findGatheringSpot(game)) return false;
        if (dim.scoutingMode) return true;
        // Anchors skip the Rift Gate (which needed Planar Rifts to build), so the
        // research gate moves to the launch itself and early chains don't open on day one.
        if (game.ruins.getAnchor(dim.chain) && !game.research.isResearched('planar_rift')) return false;
        return !!this.findLaunchPosition(game, dim);
    }

    getAvailableRealms(game) {
        const results = [];
        for (const [key, dim] of Object.entries(REALMS)) {
            if (this._isRealmDemoLocked(game, dim)) continue;
            if (dim.research && !game.research.isResearched(dim.research)) continue;
            if (!this._chainOpen(game, dim)) continue;
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

    // Whether the colony currently has a diviner able to scry a rift.
    canScry(game) {
        return getBestDivinationLevel(game) >= 1;
    }

    // Scry a realm: reveal one persistent hint about what it holds. Requires a
    // diviner (level >= 1). Higher divination reveals finer detail. Returns the
    // hint object (also cached on realmScries[realmKey]) or null if unavailable.
    scryRealm(game, realmKey) {
        const dim = REALMS[realmKey];
        if (!dim) return null;
        const level = getBestDivinationLevel(game);
        if (level < 1) return null;
        const hint = generateRealmScry(dim, level);
        if (!hint) return null;
        this.realmScries[realmKey] = hint;
        game.eventLog.add(game, { key: 'msg.exp.scry', params: { realm: defRef(dim), title: hint.titleKey ? ref(hint.titleKey, hint.title) : hint.title } }, 'event', null);
        return hint;
    }

    _getMaxAutoExpeditions(game) {
        if (!game.research.isResearched('auto_expedition')) return 0;
        if (game.research.isResearched('auto_expedition_iii')) return 3;
        if (game.research.isResearched('auto_expedition_ii')) return 2;
        return 1;
    }

    canSendAuto(game) {
        const max = this._getMaxAutoExpeditions(game);
        return max > 0 && this.expeditions.filter(e => e.autoMode).length < max;
    }

    sendExpedition(game, realmKey, colonistIds, packAnimalIds = [], difficulty = 1, options = {}) {
        if (!this.canSend(game, realmKey)) return null;
        if (colonistIds.length === 0) return null;

        const autoMode = !!options.autoMode;
        if (autoMode) {
            const max = this._getMaxAutoExpeditions(game);
            if (max === 0) return null;
            if (this.expeditions.filter(e => e.autoMode).length >= max) return null;
        } else {
            if (this.expeditions.filter(e => !e.autoMode).length >= 1) return null;
        }

        const dim = REALMS[realmKey];
        const party = [];

        const cappedColonists = colonistIds.slice(0, 5);
        const cappedPacks = (packAnimalIds || []).slice(0, 2);

        for (const id of cappedColonists) {
            const c = game.getColonist(id);
            if (!c || c.hp <= 0 || c.onExpedition || c.expeditionPending || c.drafted) continue;
            if (c.traits && c.traits.includes('pacifist')) continue;
            if (this.fatigueCooldowns[id] && game.tick < this.fatigueCooldowns[id]) continue;
            party.push(c);
        }

        if (party.length === 0) return null;

        let gatePos = dim.scoutingMode ? null : this.findLaunchPosition(game, dim);
        if (!dim.scoutingMode && !gatePos) return null;
        const gatherPos = this.findGatheringSpot(game);
        if (!gatherPos) return null;

        const packAnimals = [];
        for (const id of cappedPacks) {
            const a = game.entities.find(e => e.id === id && e.tamed);
            if (!a || a.hp <= 0 || a.onExpedition) continue;
            const packRole = a.roles && a.roles.find(r => r.type === 'pack');
            if (packRole) {
                const baseSpeed = packRole.expeditionSpeedBonus || 0.25;
                const speedLvlBonus = this._animalPackLevelBonus(a.level || 0);
                packAnimals.push({ id: a.id, type: a.type, speedBonus: baseSpeed + speedLvlBonus, level: a.level || 0 });
                a.onExpedition = true;
            }
        }

        // War beasts: tamed animals with a `war` role that fight alongside the party
        // as persistent combatants (they occupy a party slot, not a pack slot). Up to
        // two, mirroring the pack cap. Each becomes an entry in exp.warBeasts and is
        // spawned into combat as a party-side summon on each encounter.
        const cappedBeasts = (options.warBeastIds || []).slice(0, 2);
        const warBeasts = [];
        for (const id of cappedBeasts) {
            const a = game.entities.find(e => e.id === id && e.tamed);
            if (!a || a.hp <= 0 || a.onExpedition) continue;
            const warRole = a.roles && a.roles.find(r => r.type === 'war');
            if (warRole) {
                const baseHp  = warRole.beastHp  || a.hp;
                const baseDmg = warRole.beastDamage || a.damage || 8;
                const lvlBonus = this._animalWarBeastLevelBonus(a.level || 0);
                warBeasts.push({
                    id: a.id, type: a.type,
                    name: ANIMALS[a.type]?.name || a.type,
                    hp:     baseHp  + lvlBonus.hpBonus,
                    damage: baseDmg + lvlBonus.damageBonus,
                    char: a.char, color: a.color,
                    level: a.level || 0,
                });
                a.onExpedition = true;
            }
        }

        for (const c of party) {
            c.expeditionPending = true;
            if (c.currentTaskId) {
                const currentTask = game.taskQueue.getById(c.currentTaskId);
                if (!currentTask || currentTask.type !== 'lead_animal') {
                    game.taskQueue.release(c.currentTaskId);
                    c.currentTaskId = null;
                }
            }
            // Auto-switch to Expedition gear set when joining the party.
            if (c.equipmentSets?.Expedition && c.activeSet !== 'Expedition') {
                game.switchEquipmentSet(c.id, 'Expedition');
            }
            this._walkToGathering(game, c, gatherPos);
        }

        let duration = randInt(dim.duration[0], dim.duration[1]);
        const totalSpeedBonus = packAnimals.reduce((sum, pa) => sum + pa.speedBonus, 0);
        if (totalSpeedBonus > 0) {
            duration = Math.max(Math.floor(duration * (1 - totalSpeedBonus)), Math.floor(duration * 0.5));
        }
        let durationMult = 1.0;
        // Consumable trinkets crumble at launch, but their expedition effects (e.g.
        // a Map Fragment's lootMult) still apply for the whole run. Keyed by colonist id.
        const consumedItems = {};
        for (const c of party) {
            // Trait-based duration (e.g. Trailblazer). The expedition object doesn't
            // exist yet, so scan the party directly like the equipment loop below.
            for (const traitKey of (c.traits || [])) {
                const mult = TRAITS[traitKey]?.expedition?.durationMult;
                if (mult) durationMult *= mult;
            }
            for (const item of getEquippedItems(c)) {
                if (item.expedition?.durationMult) durationMult *= item.expedition.durationMult;
                if (item.consumable) {
                    // The equipped copy is the one consumed. It lives on the colonist,
                    // not in the store, so no store copy is removed.
                    (consumedItems[c.id] ||= []).push(item);
                    c.trinket = null;
                    invalidateEquipStatCache(c);
                    game.eventLog.add(game, { key: 'msg.exp.trinket_crumbles', params: { name: c.name, item: itemRef(item) } }, 'event', null);
                }
            }
        }

        const mutators = options.mutators || [];
        for (const mutKey of mutators) {
            const mut = EXPEDITION_MUTATORS[mutKey];
            if (mut?.effects?.durationMult) durationMult *= mut.effects.durationMult;
        }

        const formation = options.formation || { front: party.map(c => c.id), back: [] };

        if (durationMult !== 1.0) duration = Math.max(Math.floor(duration * durationMult), Math.floor(duration * 0.4));
        const diffSettings = EXPEDITION_DIFFICULTY[difficulty] || EXPEDITION_DIFFICULTY[1];
        const { encounters, bossEncounter } = this._generateEncounters(dim, diffSettings, mutators, realmKey);

        const nodeMap = this._generateNodeMap(encounters, bossEncounter);

        const potionSupply = {};
        if (options.potions) {
            for (const [potionKey, count] of Object.entries(options.potions)) {
                const def = EXPEDITION_POTIONS[potionKey];
                if (!def || count <= 0) continue;
                const available = game.resources.getPotionCount?.(def.resource) ?? 0;
                const packBonus = packAnimals.length * POTION_CARRY_CONFIG.packAnimalBonus;
                const take = Math.min(count, def.maxCarry + packBonus, available);
                for (let i = 0; i < take; i++) game.resources.takePotion(def.resource);
                if (take > 0) potionSupply[potionKey] = take;
            }
        }

        const streakMultiplier = this._getStreakMultiplier(realmKey);

        const expedition = {
            id: nextExpeditionId++,
            realm: realmKey,
            realmName: dim.name,
            partyIds: party.map(c => c.id),
            packAnimals,
            warBeasts,
            partySnapshot: [],
            gatePos,
            gatherPos,
            gatherStartTick: game.tick,
            consumedItems,
            enemyStatMults: computeEnemyStatMults(diffSettings, mutators, this.activeRealmEvents, realmKey),
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
                ? [setLogMessage({ tick: 0, type: 'info' }, { key: 'msg.exp.gathering_with_packs', params: { n: packAnimals.length } })]
                : [setLogMessage({ tick: 0, type: 'info' }, { key: 'msg.exp.gathering' })],
            combat: null,
            summons: [],
            lastMicroEventTick: 0,
            difficulty,
            diffSettings,
            formation,
            mutators,
            potionSupply,
            streakMultiplier,
            activeEffects: [],
            eliteKills: 0,
            bossPhase: 0,
            bossPhaseData: null,
            pendingDecision: null,
            discoveredEntries: [],
            xpEarned: {},
            animalXpEarned: {},
            nodeMap,
            autoMode,
            summary: {
                damageDealt: {}, damageTaken: {}, spellsCast: {},
                killCount: {}, healingDone: {},
                potionsUsed: 0, decisionsCount: 0, puzzlesSolved: 0,
                beastsDefeated: [],
            },
        };

        this.expeditions.push(expedition);
        // A launched expedition consumes any scry hint for that realm: the next
        // rift is freshly random, so the reveal shouldn't linger.
        delete this.realmScries[realmKey];
        // Difficulty and mutators are refs so the saved line follows the language.
        const params = { realm: defRef(dim) };
        let key = 'msg.exp.assembling';
        if (diffSettings !== EXPEDITION_DIFFICULTY[1]) { params.difficulty = defRef(diffSettings); key += '_diff'; }
        if (mutators.length > 0) {
            params.mutators = listRef(mutators.map(k => EXPEDITION_MUTATORS[k] ? defRef(EXPEDITION_MUTATORS[k]) : k));
            key += '_mut';
        }
        game.eventLog.add(game, { key, params }, 'event', null);
        return expedition;
    }

    /**
     * Where a party for this realm gathers and departs: the attuned rift anchor of the
     * realm's chain. Chains with no anchor on the map (saves from before anchors, or a
     * modded chain) fall back to the legacy Rift Gate.
     *
     * @param {object} game Game instance.
     * @param {object} dim Realm definition from REALMS.
     * @return {{x: number, y: number}|null} The launch tile, or null if the chain is locked.
     */
    findLaunchPosition(game, dim) {
        const anchor = game.ruins.getAnchor(dim.chain);
        if (anchor) return anchor.attuned ? { x: anchor.x, y: anchor.y } : null;
        return this._findRiftGatePosition(game);
    }

    /**
     * The colony's Gathering Circle, where every party assembles before teleporting
     * into the rift and where it reappears on return. Launching requires one.
     *
     * @param {object} game Game instance.
     * @return {{x: number, y: number}|null} The circle's tile, or null if none is built.
     */
    findGatheringSpot(game) {
        return game.mapIndex.findFirst('gathering_circle');
    }

    _findRiftGatePosition(game) {
        const positions = game.mapIndex.getStructurePositions('rift_gate');
        if (positions.size === 0) return null;
        const key = positions.values().next().value;
        return { x: key & 0xFFFF, y: key >> 16 };
    }

    update(game) {
        this._tickRealmEvents(game);

        for (const exp of this.expeditions) {
            if (exp.status === 'complete') continue;

            if (exp.status === 'gathering') {
                this._updateGathering(exp, game);
                continue;
            }

            if (exp.pendingDecision) {
                if (exp.autoMode) {
                    this._autoResolvePendingDecision(exp, game);
                    // fall through, pendingDecision is now null
                } else {
                    if (exp.startTick !== undefined) exp.startTick++;
                    if (!exp._wasPaused) {
                        exp._wasPaused = true;
                        if (!game.paused) game.togglePause();
                    }
                    continue;
                }
            }
            // Void pact mid-boss deal: pause combat until the player resolves the choice.
            // Auto-mode skips it (no choice possible) and just refuses.
            if (exp.pendingVoidPactChoice) {
                if (exp.autoMode) {
                    this.resolveVoidPactChoice(game, exp.id, false);
                } else {
                    if (exp.startTick !== undefined) exp.startTick++;
                    if (!exp._wasPaused) {
                        exp._wasPaused = true;
                        if (!game.paused) game.togglePause();
                    }
                    continue;
                }
            }
            if (exp._wasPaused) exp._wasPaused = false;

            const elapsed = game.tick - exp.startTick;

            if (exp.status === 'exploring') {
                if (exp.combat) {
                    exp.startTick++;
                    this._updateCombat(exp, game);
                    continue;
                }

                this._regenMana(exp, game);
                this._tryHealSpells(exp, game);
                this._updateActiveEffects(exp, game);
                this._checkTraitRally(exp, game);
                if (!exp._entryPotionsUsed) this._tryUsePotions(exp, game);

                if (exp.summons && exp.summons.length > 0) {
                    for (let si = exp.summons.length - 1; si >= 0; si--) {
                        exp.summons[si].ticksRemaining--;
                        if (exp.summons[si].ticksRemaining <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.summon_fades', params: { summon: companionRef(exp.summons[si]) } }, 'info', { fx: { kind: 'summon_end', summon: exp.summons[si].name } });
                            exp.summons.splice(si, 1);
                        }
                    }
                }

                const allEncountersDone = exp.currentEncounter >= exp.encounters.length;
                const bossDue = exp.bossEncounter && !exp.bossTriggered && allEncountersDone;

                if (bossDue && !exp.combat) {
                    exp.bossTriggered = true;
                    this._startEncounter(exp, game, exp.bossEncounter);
                } else if (!allEncountersDone && game.tick >= exp.nextEncounterTick) {
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
                    this._addLog(exp, game, { key: 'msg.exp.all_defeated' }, 'danger');
                    exp.loot = {};
                }

                const expeditionDone = exp.bossEncounter
                    ? (exp.bossTriggered && !exp.combat)
                    : (allEncountersDone && !exp.combat);
                if (expeditionDone && exp.status === 'exploring') {
                    exp.status = 'returning';
                    exp.walkOffTick = game.tick + (exp.bossEncounter ? 80 : 60);
                    this._addLog(exp, game, { key: 'msg.exp.complete' }, 'success');
                }
            }

            if (exp.status === 'returning') {
                const deadline = exp.retreatTick || exp.walkOffTick || (exp.startTick + Math.floor(exp.duration * EXPLORATION_CONFIG.returnTimeMult));
                if (game.tick >= deadline) {
                    this._completeExpedition(exp, game);
                }
            }
        }

        this.expeditions = this.expeditions.filter(e => e.status !== 'complete');
    }

    retreatExpedition(game, expId) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (exp?.status === 'gathering') {
            this._cancelGathering(exp, game, 'recalled');
            this.expeditions = this.expeditions.filter(e => e !== exp);
            return true;
        }
        if (!exp || exp.status !== 'exploring') return false;
        exp.status = 'returning';
        exp.manualRetreat = true;
        exp.retreatStartTick = game.tick;
        exp.retreatTick = game.tick + Math.floor(EXPLORATION_CONFIG.retreatTicks * 0.5);
        this._addLog(exp, game, { key: 'msg.exp.retreat_ordered' }, 'info');
        return true;
    }

    _unpauseAfterChoice(exp, game) {
        if (exp._wasPaused && !exp.pendingDecision) {
            exp._wasPaused = false;
            if (game.paused) game.togglePause();
        }
    }

    // Stamp an encounter-resolution outcome so the visualizer can pop a dedicated
    // success/fail burst over the party (distinct from generic loot). `ok` is the
    // pass/fail of a puzzle, parley, trap, or decision. Also fires a matching SFX.
    _stampResolution(exp, game, ok) {
        exp._lastResolutionTick = game.tick;
        exp._lastResolutionOutcome = ok ? 'success' : 'failure';
        window.soundManager?.playExpSFX(ok ? 'spell_divination' : 'wave_alert');
    }

    _autoResolvePendingDecision(exp, game) {
        const pd = exp.pendingDecision;
        if (!pd) return;
        if (pd.type === 'decision') {
            const decDef = EXPEDITION_DECISIONS[pd.decisionKey];
            let idx = decDef?.safeIndex ?? -1;
            if (idx < 0) {
                for (let i = pd.choices.length - 1; i >= 0; i--) {
                    const fx = pd.choices[i].effects;
                    if (!fx || Object.keys(fx).length === 0) { idx = i; break; }
                }
            }
            if (idx < 0) idx = pd.choices.length - 1;
            this.resolveDecision(game, exp.id, idx);
        } else if (pd.type === 'puzzle') {
            this.resolvePuzzle(game, exp.id, -1);
        } else if (pd.type === 'npc') {
            this.resolveNpc(game, exp.id, -1);
        } else if (pd.type === 'trap') {
            this.resolveTrap(game, exp.id, -1);
        }
    }

    resolveDecision(game, expId, choiceIndex) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingDecision) return false;
        const decision = exp.pendingDecision;
        const choice = decision.choices[choiceIndex];
        if (!choice) return false;

        const member = exp.partySnapshot.find(p => p.hp > 0) || exp.partySnapshot[0];
        if (choice.logText) this._addLog(exp, game, defMessage(choice, 'logText', { name: this._actorName(member) }), 'info');

        exp.pendingDecision = null;
        this._applyDecisionEffects(exp, game, choice.effects || {}, decision.encounterIndex);
        exp.summary.decisionsCount++;
        if (!exp.xpAwardedDecisions) exp.xpAwardedDecisions = [];
        if (!exp.xpAwardedDecisions.includes(decision.encounterIndex)) {
            exp.xpAwardedDecisions.push(decision.encounterIndex);
            this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerDecision);
        }

        if (!exp.pendingDecision && !exp.combat) {
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === decision.encounterIndex && !n.completed);
                if (node) node.completed = true;
            }
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
        }
        this._unpauseAfterChoice(exp, game);
        return true;
    }

    resolvePuzzle(game, expId, checkIndex) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingDecision || exp.pendingDecision.type !== 'puzzle') return false;
        const puzzle = exp.pendingDecision;

        if (checkIndex === -1) {
            this._addLog(exp, game, { key: 'msg.exp.puzzle_move_on' }, 'info');
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === puzzle.encounterIndex && !n.completed);
                if (node) node.completed = true;
            }
            exp.pendingDecision = null;
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
            this._unpauseAfterChoice(exp, game);
            return true;
        }

        const check = puzzle.checks[checkIndex];
        if (!check) return false;

        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        let bestMember = alive[0];
        let canPass = !check.requirement;

        if (check.requirement) {
            if (check.requirement.skill) {
                for (const m of alive) {
                    const col = game.getColonist(m.id);
                    if (col && col.skills?.[check.requirement.skill] >= check.requirement.minLevel) {
                        bestMember = m;
                        canPass = true;
                        break;
                    }
                }
            } else if (check.requirement.traitAny) {
                for (const m of alive) {
                    const col = game.getColonist(m.id);
                    if (col?.traits?.some(t => check.requirement.traitAny.includes(t))) {
                        bestMember = m;
                        canPass = true;
                        break;
                    }
                }
            }
        }

        let traitBonus = 0;
        if (check.traitBonus && bestMember) {
            const col = game.getColonist(bestMember.id);
            if (col?.traits) {
                for (const t of check.traitBonus) {
                    if (col.traits.includes(t)) traitBonus += 0.2;
                    const traitDef = TRAITS[t];
                    if (traitDef?.expedition?.puzzleSuccessBonus) traitBonus += traitDef.expedition.puzzleSuccessBonus;
                }
            }
        }

        const successChance = canPass ? Math.min(1, 0.7 + traitBonus) : 0.3;
        const success = Math.random() < successChance;

        if (success && check.success) {
            this._addLog(exp, game, defMessage(check.success, 'text', { name: this._actorName(bestMember) }), 'success');
            if (check.success.reward) this._applyPuzzleReward(exp, game, check.success.reward);
            if (check.success.penalty) this._applyPuzzlePenalty(exp, game, check.success.penalty, bestMember, puzzle.encounterIndex);
            exp.summary.puzzlesSolved++;
            this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerPuzzleSolved);
            this._stampResolution(exp, game, true);
        } else if (check.failure) {
            this._addLog(exp, game, defMessage(check.failure, 'text', { name: this._actorName(bestMember) }), 'danger');
            if (check.failure.penalty) this._applyPuzzlePenalty(exp, game, check.failure.penalty, bestMember, puzzle.encounterIndex);
            this._stampResolution(exp, game, false);
        }

        exp.pendingDecision = null;
        if (!exp.combat) {
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === puzzle.encounterIndex && !n.completed);
                if (node) node.completed = true;
            }
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
        }
        this._unpauseAfterChoice(exp, game);
        return true;
    }

    resolveNpc(game, expId, choiceIndex) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingDecision || exp.pendingDecision.type !== 'npc') return false;
        const npc = exp.pendingDecision;

        if (choiceIndex === -1) {
            this._addLog(exp, game, { key: 'msg.exp.npc_move_on' }, 'info');
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === npc.encounterIndex && !n.completed);
                if (node) node.completed = true;
            }
            exp.pendingDecision = null;
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
            this._unpauseAfterChoice(exp, game);
            return true;
        }

        const choice = npc.choices[choiceIndex];
        if (!choice) return false;

        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        if (choice.requirement) {
            const req = choice.requirement;
            if (req.spellAny) {
                const hasCaster = alive.some(m => m.knownSpells?.some(s => req.spellAny.includes(s)));
                if (!hasCaster) {
                    this._addLog(exp, game, { key: 'msg.exp.npc_no_one_can' }, 'info');
                    return false;
                }
            }
        }
        const member = alive[0] || exp.partySnapshot[0];

        if (choice.cost) {
            if (choice.cost.mana) {
                const caster = alive.find(m => m.mana >= choice.cost.mana);
                if (!caster) {
                    this._addLog(exp, game, { key: 'msg.exp.npc_no_mana' }, 'info');
                    return false;
                }
                caster.mana -= choice.cost.mana;
            }
            if (choice.cost.potionSlots) {
                const totalPotions = Object.values(exp.potionSupply || {}).reduce((s, v) => s + v, 0);
                if (totalPotions < choice.cost.potionSlots) {
                    this._addLog(exp, game, { key: 'msg.exp.npc_no_potions' }, 'info');
                    return false;
                }
                const potionKeys = Object.keys(exp.potionSupply || {});
                let slotsToUse = choice.cost.potionSlots;
                for (const pk of potionKeys) {
                    if (slotsToUse <= 0) break;
                    const take = Math.min(slotsToUse, exp.potionSupply[pk]);
                    exp.potionSupply[pk] -= take;
                    slotsToUse -= take;
                    if (exp.potionSupply[pk] <= 0) delete exp.potionSupply[pk];
                }
            }
            if (choice.cost.loot) {
                const res = choice.cost.loot.resource;
                const amt = choice.cost.loot.amount;
                if ((game.resources.stockpile[res] || 0) < amt) {
                    this._addLog(exp, game, { key: 'msg.exp.npc_no_resource', params: { resource: resourceRef(res) } }, 'info');
                    return false;
                }
                game.resources.deduct({ [res]: amt });
            }
        }

        if (choice.result) {
            this._addLog(exp, game, defMessage(choice.result, 'text', { name: this._actorName(member) }), choice.result.reward ? 'success' : 'info');
            if (choice.result.reward) this._applyNpcReward(exp, game, choice.result.reward);
            if (choice.result.penalty) this._applyPuzzlePenalty(exp, game, choice.result.penalty, member, npc.encounterIndex);
            // A rewarding parley reads as success; a penalty-only outcome as failure.
            if (choice.result.reward) this._stampResolution(exp, game, true);
            else if (choice.result.penalty) this._stampResolution(exp, game, false);
        }

        exp.pendingDecision = null;
        if (!exp.combat) {
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === npc.encounterIndex && !n.completed);
                if (node) node.completed = true;
            }
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
        }
        this._unpauseAfterChoice(exp, game);
        return true;
    }

    resolveTrap(game, expId, checkIndex) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingDecision || exp.pendingDecision.type !== 'trap') return false;
        const trap = exp.pendingDecision;
        const trapDef = EXPEDITION_TRAPS[trap.trapKey];
        if (!trapDef) { exp.pendingDecision = null; this._unpauseAfterChoice(exp, game); return true; }

        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        const ds = exp.diffSettings || EXPEDITION_DIFFICULTY[1];

        if (checkIndex === -1) {
            this._applyTrapDamage(exp, game, trapDef, alive, ds);
            const member = alive[randInt(0, alive.length - 1)];
            this._addLog(exp, game, { key: 'msg.exp.trap_brace' }, 'info');
            const remaining = trap.remainingTicks;
            exp.pendingDecision = null;
            exp.nextEncounterTick = game.tick + (remaining ?? Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing));
            this._unpauseAfterChoice(exp, game);
            return true;
        }

        const check = trap.checks[checkIndex];
        if (!check) return false;

        let bestMember = alive[0];
        let bestLevel = 0;

        if (check.skill) {
            for (const m of alive) {
                const col = game.getColonist(m.id);
                const lvl = col?.skills?.[check.skill] || 0;
                if (lvl > bestLevel) { bestLevel = lvl; bestMember = m; }
            }
        } else if (check.traitAny) {
            for (const m of alive) {
                const col = game.getColonist(m.id);
                if (col?.traits?.some(t => check.traitAny.includes(t))) {
                    bestMember = m;
                    bestLevel = check.minLevel || 1;
                    break;
                }
            }
        }

        let traitBonus = 0;
        if (check.traitBonus && bestMember) {
            const col = game.getColonist(bestMember.id);
            if (col?.traits) {
                for (const t of check.traitBonus) {
                    if (col.traits.includes(t)) traitBonus += 0.15;
                    const traitDef = TRAITS[t];
                    if (traitDef?.expedition?.puzzleSuccessBonus) traitBonus += traitDef.expedition.puzzleSuccessBonus;
                }
            }
        }

        const minLevel = check.minLevel || 1;
        const baseChance = check.skill
            ? Math.min(0.9, 0.3 + (bestLevel / (minLevel + 2)) * 0.4)
            : (bestLevel > 0 ? 0.7 : 0.4);
        const successChance = Math.min(1, baseChance + traitBonus);
        const success = Math.random() < successChance;

        if (success) {
            const name = this._actorName(bestMember);
            this._addLog(exp, game, check.successText ? defMessage(check, 'successText', { name }) : { key: 'msg.exp.trap_avoided' }, 'success');
            this._stampResolution(exp, game, true);
        } else {
            const name = this._actorName(bestMember);
            this._addLog(exp, game, check.failText ? defMessage(check, 'failText', { name }) : { key: 'msg.exp.trap_triggers' }, 'danger');
            this._applyTrapDamage(exp, game, trapDef, alive, ds);
            this._stampResolution(exp, game, false);
        }

        const remaining = trap.remainingTicks;
        exp.pendingDecision = null;
        exp.nextEncounterTick = game.tick + (remaining ?? Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing));
        this._unpauseAfterChoice(exp, game);
        return true;
    }

    _pickEnemyFromRealm(dim) {
        if (dim.enemies.types && dim.enemies.types.length > 0) {
            const totalWeight = dim.enemies.types.reduce((s, t) => s + t.weight, 0);
            let roll = Math.random() * totalWeight;
            for (const t of dim.enemies.types) {
                roll -= t.weight;
                if (roll <= 0 && EXPEDITION_ENEMIES[t.key]) {
                    return { ...EXPEDITION_ENEMIES[t.key], typeKey: t.key };
                }
            }
            const fb = dim.enemies.types[0];
            return { ...EXPEDITION_ENEMIES[fb.key], typeKey: fb.key };
        }
        return { hp: dim.enemies.hp || [30, 60], damage: dim.enemies.damage || [5, 10], name: null, sprite: null, color: null, typeKey: null };
    }

    _applyTrapDamage(exp, game, trapDef, alive, ds) {
        if (!alive.length) return;
        const member = alive[randInt(0, alive.length - 1)];
        const trapMult = getPartyExpeditionEffect(exp.partySnapshot, 'trapDamageMult', exp.realm);
        const xpTrapMult = this._getXpLevelBonus(member.id, 'trapDamageMult');
        const baseDmg = randInt(trapDef.initialDamage[0], trapDef.initialDamage[1]);
        const dmg = Math.max(0, Math.floor(baseDmg * trapMult * xpTrapMult * (ds.trapDmgMult || 1)));

        if (dmg > 0) {
            member.hp -= dmg;
            this._addLog(exp, game, { key: 'msg.exp.takes_damage', params: { name: member.name, dmg } }, 'danger');
            if (exp.summary) exp.summary.damageTaken[member.id] = (exp.summary.damageTaken[member.id] || 0) + dmg;
        }

        if (trapDef.damageType === 'dot' && trapDef.dotDamage) {
            if (this._memberHasPoisonImmunity(member)) {
                this._addLog(exp, game, { key: 'msg.exp.resists_poison', params: { name: member.name } }, 'combat');
            } else {
                exp.activeEffects.push({
                    type: 'dot', targetId: member.id,
                    damageRange: trapDef.dotDamage, ticksRemaining: trapDef.dotTicks,
                    interval: trapDef.dotInterval, lastTick: game.tick,
                });
                this._addLog(exp, game, { key: 'msg.exp.poisoned', params: { name: member.name } }, 'danger');
            }
        }
        if (trapDef.damageType === 'mana' && trapDef.manaDrain) {
            const drain = randInt(trapDef.manaDrain[0], trapDef.manaDrain[1]);
            member.mana = Math.max(0, member.mana - drain);
            this._addLog(exp, game, { key: 'msg.exp.loses_mana', params: { name: member.name, amount: drain } }, 'danger');
        }
        if (trapDef.damageType === 'equipment' && trapDef.effect?.disableRandomSlot) {
            const equipSlots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
            const equippedSlots = equipSlots.filter(s => member[s]);
            if (equippedSlots.length > 0) {
                const slot = equippedSlots[randInt(0, equippedSlots.length - 1)];
                if (!member._disabledSlots) member._disabledSlots = {};
                member._disabledSlots[slot] = (trapDef.effect.disableDuration || 3);
                this._addLog(exp, game, { key: 'msg.exp.slot_disabled', params: { name: member.name, slot: ref(`msg.exp.slot.${slot}`, slot) } }, 'danger');
            }
        }

        if (member.hp <= 0) {
            this._checkExpeditionRevive(exp, member, game);
        }
    }

    savePartyPreset(name, colonistIds, formation, potions, mutators, packAnimalIds = [], warBeastIds = []) {
        const existing = this.partyPresets.findIndex(p => p.name === name);
        const preset = {
            name,
            colonistIds: [...colonistIds],
            formation: formation ? { front: [...formation.front], back: [...formation.back] } : null,
            potions: potions ? { ...potions } : {},
            mutators: mutators ? [...mutators] : [],
            packAnimalIds: [...packAnimalIds],
            warBeastIds: [...warBeastIds],
        };
        if (existing >= 0) this.partyPresets[existing] = preset;
        else this.partyPresets.push(preset);
        if (this.partyPresets.length > 10) this.partyPresets.shift();
    }

    loadPartyPreset(name) {
        return this.partyPresets.find(p => p.name === name) || null;
    }

    deletePartyPreset(name) {
        this.partyPresets = this.partyPresets.filter(p => p.name !== name);
    }

    getActiveRealmEvents() {
        return this.activeRealmEvents;
    }

    getRealmEvent(realmKey) {
        return this.activeRealmEvents.find(e => e.realms.includes(realmKey)) || null;
    }

    isFatigued(colonistId, currentTick) {
        const cd = this.fatigueCooldowns[colonistId];
        return cd && currentTick < cd;
    }

    getFatigueRemaining(colonistId, currentTick) {
        const cd = this.fatigueCooldowns[colonistId];
        if (!cd || currentTick >= cd) return 0;
        return cd - currentTick;
    }

    getExpeditionLevel(colonistId) {
        const data = this.expeditionXP[colonistId];
        if (!data) return 0;
        return data.level || 0;
    }

    _getXpLevelBonus(colonistId, bonusKey) {
        const level = this.getExpeditionLevel(colonistId);
        let value = bonusKey.includes('Mult') ? 1.0 : 0;
        for (let lv = 1; lv <= level; lv++) {
            const bonus = EXPEDITION_XP_CONFIG.levelBonuses[lv];
            if (!bonus || bonus[bonusKey] === undefined) continue;
            if (bonusKey.includes('Mult')) value *= bonus[bonusKey];
            else value += bonus[bonusKey];
        }
        return value;
    }

    // `message` is { key, params } or a plain string; see js/ui/eventlog.js.
    // `meta` adds fields to the entry: itemKey for loot icons, and fx, a structured
    // description of combat lines for the expedition visualizer:
    //   { kind: 'cast', caster, effect: 'heal'|'shield'|'phase'|'damage'|'other', school, amount, area }
    //   { kind: 'summon', caster }      { kind: 'summon_end', summon }
    //   { kind: 'boss_phase', phaseName } { kind: 'boss_entrance' }
    //   { kind: 'kill', byParty }        { kind: 'hit', byParty, target, amount }
    //   { kind: 'miss', byParty, dodger }
    // caster, dodger and hit targets on the party side are party member names;
    // byParty is true when the party's side acts (or, for kills, an enemy dies).
    _addLog(exp, game, message, type = 'info', meta = null) {
        const tick = game ? game.tick : 0;
        const entry = setLogMessage({ tick, type }, message);
        if (meta) Object.assign(entry, meta);
        exp.log.push(entry);
    }

    // Name param for the member a log line is about, or "The party".
    _actorName(member) {
        return member?.name || ref('msg.exp.label.the_party', 'The party');
    }

    // A random discovery line for `member`: the realm's own, else the generic ones.
    _discoveryLine(dimEvents, member) {
        const params = { name: member.name };
        if (dimEvents && dimEvents.discoveries) return lineMessage(dimEvents, 'discoveries', randInt(0, dimEvents.discoveries.length - 1), params);
        return eventLine('discoveries', randInt(0, EXPLORATION_EVENTS.discoveries.length - 1), params);
    }

    _checkExpeditionRevive(exp, member, game) {
        // Dev-only no-death flag (trailer director). Unset in normal play.
        if (game?.devNoDeath) { member.hp = 1; return; }
        const slots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
        for (const slot of slots) {
            const item = member[slot];
            if (item?.autoReviveHp && !member._reviveUsed) {
                member.hp = Math.floor(member.maxHp * item.autoReviveHp);
                member._reviveUsed = true;
                member[slot] = null;
                this._addLog(exp, game, { key: 'msg.exp.revive_item', params: { name: member.name, item: itemRef(item) } }, 'success');
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
        this._addLog(exp, game, eventLine('combatDefeat', randInt(0, EXPLORATION_EVENTS.combatDefeat.length - 1), { name: member.name }), 'danger');
        window.soundManager?.playExpSFX('colonist_death');
    }

    // Snapshot of one departing colonist: the combat-relevant state the expedition
    // simulation reads instead of the live colonist. Consumable trinkets crumble at
    // launch, so they ride along in `consumedItems` for their expedition effects only.
    _buildSnapshotMember(exp, c) {
        const baseCd = (c.weapon && c.weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
        const atkSpeed = 1 + getEquipmentStat(c, 'attackSpeed');
        const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
        return {
            id: c.id, name: c.name, hp: c.hp, maxHp: c.maxHp, raceKey: c.race,
            // Snapshot this colonist's opinions of the others so party
            // synergies (friend/lover boost, rival penalty) can be computed
            // during combat without live colonist access. Shallow copy so a
            // mid-expedition opinion shift doesn't retroactively change it.
            opinions: { ...(c.opinions || {}) },
            bodyVariant: c.bodyVariant, hairVariant: c.hairVariant, shirtVariant: c.shirtVariant, nameColor: c.nameColor,
            golem: c.golem, golemType: c.golemType,
            weapon: c.weapon, armor: c.armor, helmet: c.helmet, clothes: c.clothes, tool: c.tool,
            boots: c.boots,
            trinket: c.trinketBroken ? null : c.trinket,
            traits: c.traits || [],
            // Only spells from attuned schools (and not manually disabled) are
            // usable on expeditions, matching in-world autocast behavior.
            knownSpells: (c.knownSpells || []).filter(s =>
                (!c.disabledSpells || !c.disabledSpells.includes(s)) &&
                isSpellAttuned(c, SPELLS[s])),
            magicSkills: { ...(c.magicSkills || {}) },
            mana: c.mana || 0,
            maxMana: c.maxMana || 0,
            spellCooldowns: {},
            spellDamageBonus: getEquipmentStat(c, 'spellDamageBonus'),
            schoolBonuses: buildSchoolBonuses(c),
            spellHealBonus: getEquipmentStat(c, 'spellHealBonus'),
            manaRegen: getEquipmentStat(c, 'manaRegen'),
            // Percent regen boosts (Wisdom enchantment, Attuned trait), as in the colony.
            manaRegenMult: 1 + getEquipmentStat(c, 'manaRegenBonus') + ((c.traits || []).includes('attuned') ? (TRAITS.attuned.manaRegenBonus || 0) : 0),
            spellCostReduction: getEquipmentStat(c, 'spellCostReduction'),
            spellCooldownReduction: getEquipmentStat(c, 'spellCooldownReduction'),
            healthRegen: getEquipmentStat(c, 'healthRegen'),
            attackCooldown: baseCd,
            effectiveCooldown: effCd,
            // Attack-animation speed: ratio of this fighter's effective
            // cooldown to the baseline. <1 for fast weapons (quick, snappy
            // motion), >1 for slow/heavy ones. The visual clamps it.
            _atkAnimMult: effCd / COLONIST_CONFIG.baseAttackCooldown,
            // Basic-attack motion class ('Swing' | 'Stab' | 'DrawAndShoot').
            attackAnim: (c.weapon && c.weapon.attackAnim) || (c.weapon && c.weapon.ranged ? 'DrawAndShoot' : 'Swing'),
            shieldActive: false,
            shieldReduction: 0,
            dodgeCharges: 0,
            chaosResistance: getEquipmentStat(c, 'chaosResistance'),
            consumedItems: exp.consumedItems?.[c.id] || [],
        };
    }

    // Living party members only: a colonist who died while walking to the gate
    // must not ride along (and be revived at 1 HP on return).
    _buildPartySnapshot(exp, game) {
        return exp.partyIds
            .map(id => game.getColonist(id))
            .filter(c => c && c.hp > 0)
            .map(c => this._buildSnapshotMember(exp, c));
    }

    // Drop a member who never left: clear the pending flags and the expedition
    // walk so they return to normal colony work, in their Colony gear. A member
    // who died on the way keeps the 'dead' state.
    _dropGatheringMember(exp, game, c) {
        exp.partyIds = exp.partyIds.filter(id => id !== c.id);
        delete c.expeditionPending;
        const wasWalking = !!c._expeditionMove;
        delete c._expeditionMove;
        delete c._gatherStranded;
        if (c.hp <= 0 || c.state === 'dead') return;
        if (wasWalking) {
            c.path = [];
            c.state = 'idle';
        }
        if (c.equipmentSets?.Colony && c.activeSet !== 'Colony') {
            game.switchEquipmentSet(c.id, 'Colony');
        }
    }

    // Abort an expedition that never left: release everyone (arrived members step
    // back out of the gate), free the animals and return the potions. Consumable
    // trinkets already crumbled at launch and are not refunded. `reason` picks the
    // log line: 'recalled' or 'no_survivors'.
    _cancelGathering(exp, game, reason) {
        for (const id of exp.partyIds) {
            const c = game.getColonist(id);
            if (!c) continue;
            if (c.onExpedition) {
                c.onExpedition = false;
                if (c.hp > 0 && c.state !== 'dead') {
                    c.state = 'idle';
                    c.path = [];
                }
            }
            this._dropGatheringMember(exp, game, c);
        }
        for (const a of [...(exp.packAnimals || []), ...(exp.warBeasts || [])]) {
            const animal = game.entities.find(e => e.id === a.id);
            if (animal) animal.onExpedition = false;
        }
        this._returnPotions(exp, game);
        exp.potionSupply = {};
        exp.status = 'complete';
        game.eventLog.add(game, { key: `msg.exp.called_off.${reason}`, params: { realm: realmRef(exp.realm, exp.realmName) } }, 'warning', null);
    }

    _returnPotions(exp, game) {
        if (!exp.potionSupply) return;
        for (const [potionKey, count] of Object.entries(exp.potionSupply)) {
            const def = EXPEDITION_POTIONS[potionKey];
            const resource = def?.resource || potionKey;
            for (let i = 0; i < count; i++) game.resources.addPotion({ key: resource, type: resource, name: def?.name || potionKey });
        }
    }

    // Send a gathering member toward the circle. Returns false when no path exists
    // (walled off), in which case the member waits in place to be pulled in.
    _walkToGathering(game, c, pos) {
        if (this._isGathered(c, pos)) return true;
        const path = findPathAdjacent(game.map, c.x, c.y, pos.x, pos.y, game._occupiedTiles);
        if (!path || path.length === 0) return false;
        c.path = path;
        c.state = 'moving';
        c._expeditionMove = true;
        return true;
    }

    _isGathered(c, pos) {
        const r = EXPLORATION_CONFIG.gatherRadius;
        return Math.abs(c.x - pos.x) <= r && Math.abs(c.y - pos.y) <= r;
    }

    // The party walks to the Gathering Circle and waits there, then everyone
    // teleports into the rift together. A member with no path, or still walking at
    // the timeout, is pulled in from where they stand so no one is left behind.
    // Expeditions saved mid-gather from before the circle existed depart at once.
    _updateGathering(exp, game) {
        const pos = exp.gatherPos;
        if (exp.gatherStartTick == null) exp.gatherStartTick = game.tick;
        const timedOut = !pos || game.tick - exp.gatherStartTick >= EXPLORATION_CONFIG.gatherTimeoutTicks;
        let allReady = true;

        for (const id of [...exp.partyIds]) {
            const c = game.getColonist(id);
            if (!c || c.hp <= 0) {
                // Colonist died or was removed before departure. Drop them from the
                // party and clear the pending flag so they aren't permanently locked
                // out of future tasks.
                if (c) { c.onExpedition = false; this._dropGatheringMember(exp, game, c); }
                else exp.partyIds = exp.partyIds.filter(pid => pid !== id);
                continue;
            }
            if (c.onExpedition || timedOut || c._gatherStranded) continue;
            if (this._isGathered(c, pos)) {
                if (c._expeditionMove) {
                    c.path = [];
                    c.state = 'idle';
                    delete c._expeditionMove;
                }
                continue;
            }
            if (c.state === 'idle' || (c.state === 'moving' && (!c.path || c.path.length === 0))) {
                if (!this._walkToGathering(game, c, pos)) { c._gatherStranded = true; continue; }
            }
            allReady = false;
        }

        if (exp.partyIds.length === 0) {
            this._cancelGathering(exp, game, 'no_survivors');
            return;
        }
        if (!allReady && !timedOut) return;

        for (const id of exp.partyIds) {
            const c = game.getColonist(id);
            if (!c || c.onExpedition) continue;
            game.combatEffects.push({ x: c.x, y: c.y, char: COMBAT_VISUALS.spellTeleportChar, color: COMBAT_VISUALS.spellTeleportColor, ttl: 3 });
            c.onExpedition = true;
            c.state = 'idle';
            c.path = [];
            delete c._expeditionMove;
            delete c._gatherStranded;
            delete c.expeditionPending;
        }
        if (pos) window.soundManager?.playSFXAt('spell_teleport', pos.x, pos.y);

        // Heal at departure rather than at launch, so a cancelled gathering
        // can't be used as a free full heal.
        for (const id of exp.partyIds) {
            const c = game.getColonist(id);
            if (!c) continue;
            c.hp = c.maxHp;
            if (c.maxMana) c.mana = c.maxMana;
        }
        exp.status = 'exploring';
        exp.startTick = game.tick;
        exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
        exp.partySnapshot = this._buildPartySnapshot(exp, game);
        this._addLog(exp, game, { key: 'msg.exp.teleported', params: { realm: realmRef(exp.realm) } }, 'info');
        game.eventLog.add(game, { key: 'msg.exp.entered', params: { realm: realmRef(exp.realm, exp.realmName) } }, 'event', null);
        exp.lastMicroEventTick = game.tick;
        // Consume void whisper rare loot bonus if one was promised.
        if (game._voidWhisperNextExpRareMult) {
            if (!exp.potionLootBoosts) exp.potionLootBoosts = { lootMult: 1, rareEncounterMult: 1 };
            exp.potionLootBoosts.rareEncounterMult = (exp.potionLootBoosts.rareEncounterMult || 1) * game._voidWhisperNextExpRareMult;
            game._voidWhisperNextExpRareMult = null;
        }
    }

    // Where a returning party reappears: the Gathering Circle, or the launch anchor
    // if the circle was torn down while they were away. Null keeps them in place.
    _returnPos(exp, game) {
        return this.findGatheringSpot(game) || exp.gatePos || null;
    }

    _generateEncounters(dim, diffSettings, mutators = [], realmKey = '') {
        const encounters = [];
        const totalEncounters = dim.encounters + (diffSettings.extraEncounters || 0);

        const { hp: hpMult, dmg: dmgMult } = computeEnemyStatMults(diffSettings, mutators, this.activeRealmEvents, realmKey);

        const decisionKeys = Object.keys(EXPEDITION_DECISIONS);
        const puzzleKeys = Object.keys(PUZZLE_ENCOUNTERS).filter(k => {
            const p = PUZZLE_ENCOUNTERS[k];
            return !p.realmFilter || p.realmFilter.includes(realmKey);
        });
        const npcKeys = Object.keys(NPC_ENCOUNTERS).filter(k => {
            const n = NPC_ENCOUNTERS[k];
            return !n.realmFilter || n.realmFilter.includes(realmKey);
        });

        const combatRange = dim.combatEncounters || [1, Math.ceil(totalEncounters * 0.6)];
        const combatCount = randInt(Math.min(combatRange[0], totalEncounters), Math.min(combatRange[1], totalEncounters));

        const pickEnemyType = (types) => {
            const totalWeight = types.reduce((s, t) => s + t.weight, 0);
            let roll = Math.random() * totalWeight;
            for (const t of types) {
                roll -= t.weight;
                if (roll <= 0) return EXPEDITION_ENEMIES[t.key] ? { ...EXPEDITION_ENEMIES[t.key], typeKey: t.key } : null;
            }
            const fallbackKey = types[0].key;
            return EXPEDITION_ENEMIES[fallbackKey] ? { ...EXPEDITION_ENEMIES[fallbackKey], typeKey: fallbackKey } : null;
        };

        const makeCombatEncounter = () => {
            const baseCount = randInt(dim.enemies.count[0], dim.enemies.count[1]);
            const count = Math.min(10, Math.max(1, Math.round(baseCount * diffSettings.enemyCountMult)));
            const enemies = [];
            for (let j = 0; j < count; j++) {
                const eDef = dim.enemies.types ? pickEnemyType(dim.enemies.types) : null;
                const baseHp = eDef ? randInt(eDef.hp[0], eDef.hp[1]) : randInt(dim.enemies.hp?.[0] || 30, dim.enemies.hp?.[1] || 60);
                const baseDmg = eDef ? randInt(eDef.damage[0], eDef.damage[1]) : randInt(dim.enemies.damage?.[0] || 5, dim.enemies.damage?.[1] || 10);
                const enemy = {
                    hp: Math.round(baseHp * hpMult),
                    maxHp: 0,
                    damage: Math.round(baseDmg * dmgMult),
                    name: eDef?.name || null,
                    sprite: eDef?.sprite || null,
                    color: eDef?.color || null,
                    typeKey: eDef?.typeKey || null,
                    spells: eDef?.spells || null,
                    // Basic-attack motion + ranged projectile art for the visual.
                    attackAnim: eDef?.attackAnim || 'Swing',
                    ranged: eDef?.attackAnim === 'DrawAndShoot' || !!eDef?.ranged,
                    projectileChar: eDef?.projectileChar || null,
                    projectileColor: eDef?.projectileColor || null,
                    damageReduction: eDef?.damageReduction || 0,
                    // Enables armoredDamageBonus gear (Sovereign Blade, Rune of Splitting).
                    armored: !!eDef?.armored,
                };
                enemy.maxHp = enemy.hp;
                this._rollEliteModifier(enemy, diffSettings);
                enemies.push(enemy);
            }
            return { type: 'combat', enemies };
        };

        for (let i = 0; i < combatCount; i++) {
            encounters.push(makeCombatEncounter());
        }

        for (let i = combatCount; i < totalEncounters; i++) {
            const roll = Math.random();

            if (roll < 0.18 && decisionKeys.length > 0) {
                const eligible = decisionKeys.filter(k => {
                    const d = EXPEDITION_DECISIONS[k];
                    return !d.realmFilter || d.realmFilter.includes(realmKey);
                });
                if (eligible.length > 0) {
                    const dKey = eligible[randInt(0, eligible.length - 1)];
                    encounters.push({ type: 'decision', decisionKey: dKey, ...EXPEDITION_DECISIONS[dKey] });
                    continue;
                }
            }

            if (roll < 0.30 && puzzleKeys.length > 0) {
                const totalWeight = puzzleKeys.reduce((s, k) => s + (PUZZLE_ENCOUNTERS[k].triggerWeight || 1), 0);
                let pRoll = Math.random() * totalWeight;
                let pKey = puzzleKeys[0];
                for (const k of puzzleKeys) {
                    pRoll -= (PUZZLE_ENCOUNTERS[k].triggerWeight || 1);
                    if (pRoll <= 0) { pKey = k; break; }
                }
                encounters.push({ type: 'puzzle', puzzleKey: pKey, ...PUZZLE_ENCOUNTERS[pKey] });
                continue;
            }

            if (roll < 0.40 && npcKeys.length > 0) {
                const totalWeight = npcKeys.reduce((s, k) => s + (NPC_ENCOUNTERS[k].triggerWeight || 1), 0);
                let nRoll = Math.random() * totalWeight;
                let nKey = npcKeys[0];
                for (const k of npcKeys) {
                    nRoll -= (NPC_ENCOUNTERS[k].triggerWeight || 1);
                    if (nRoll <= 0) { nKey = k; break; }
                }
                encounters.push({ type: 'npc', npcKey: nKey, ...NPC_ENCOUNTERS[nKey] });
                continue;
            }

            const lootEntry = this._rollLoot(dim, diffSettings);
            if (lootEntry) encounters.push({ type: 'loot', ...lootEntry });
        }

        for (let i = encounters.length - 1; i > 0; i--) {
            const j = randInt(0, i);
            [encounters[i], encounters[j]] = [encounters[j], encounters[i]];
        }

        // Chaos realms: stamp each encounter with a randomized vis and occasionally
        // inject decisions/events from entirely different realms to break expectations.
        if (dim.chain === 'chaos') {
            const allVisPairs = Object.values(REALMS)
                .filter(r => r.vis)
                .map(r => r.vis);
            const otherRealms = Object.entries(REALMS).filter(([k, r]) => r.chain !== 'chaos' && !r.boss);
            for (const enc of encounters) {
                enc.chaosVis = allVisPairs[Math.floor(Math.random() * allVisPairs.length)];
                // 20% chance: replace ambient/decision flavor with content from a random other realm
                if (enc.type !== 'combat' && Math.random() < 0.20 && otherRealms.length > 0) {
                    const [crossKey, crossDim] = otherRealms[Math.floor(Math.random() * otherRealms.length)];
                    enc._crossRealmKey = crossKey;
                    if (crossDim.events?.ambient?.length > 0) {
                        enc._crossRealmAmbient = crossDim.events.ambient;
                    }
                }
            }
        }

        let bossEncounter = null;
        if (dim.boss) {
            const boss = dim.boss;
            const maxPhases = diffSettings.bossPhases || 2;
            // The Unraveler generates its phase list at spawn: buffed "masks" of
            // other realm bosses followed by its true final form (see
            // _buildUnravelerMasks). Every other boss uses its static phases.
            const phases = boss.dynamicMasks
                ? this._buildUnravelerMasks(boss, maxPhases)
                : boss.phases.slice(0, maxPhases);
            const phase0 = phases[0];
            const bossHp = Math.round(phase0.hp * hpMult);
            const bossDmg = Math.round(phase0.damage * dmgMult);
            bossEncounter = {
                type: 'combat', isBoss: true,
                bossPhases: phases,
                enemies: [{
                    hp: bossHp, maxHp: bossHp, damage: bossDmg,
                    damageReduction: phase0.damageReduction || 0,
                    isBoss: true, name: (boss.dynamicMasks && phase0.displayName) ? phase0.displayName : boss.name,
                    nameRef: (boss.dynamicMasks && phase0.displayName) ? (phase0.displayNameRef || phase0.displayName) : defRef(boss),
                    maskKey: boss.dynamicMasks ? (phase0.maskKey ?? null) : null,
                    enraged: false,
                    color: phase0.color,
                    sprite: phase0.sprite,
                    attackAnim: boss.attackAnim || 'Swing',
                    abilities: phase0.abilities || [],
                }],
            };
        }

        return { encounters, bossEncounter };
    }

    // Damage multiplier applied to a borrowed boss "mask" phase. Masks inherit the
    // Unraveler's own per-slot HP (see _buildUnravelerMasks) so the fight's total
    // HP budget is unchanged; only their damage is nudged up to reflect that this
    // is a chaos-buffed impostor rather than the original realm boss.
    static get MASK_DAMAGE_BUFF() { return 1.2; }
    // Per-round chance, during an autoChaosTick phase, that the Unraveler flickers
    // into a different mask mid-fight (see _executeBossAbilities).
    static get MASK_SWAP_CHANCE() { return 0.12; }

    // Builds a visual/ability "mask" identity from another realm boss's opening
    // (phase-0) form. Only appearance and generic combat abilities are copied;
    // HP/damage come from the Unraveler's own phase budget, and realm-specific
    // hooks (e.g. voidPactChoice) are deliberately NOT carried over.
    // `realmKey` is the borrowed boss's realm: the mask's stable id.
    _buildBossMask(realmKey, otherBoss) {
        const p0 = otherBoss.phases?.[0] || {};
        return {
            maskKey: realmKey,
            // displayName is the HP-bar identity; label is the combat-log phase tag.
            displayName: tr('msg.exp.boss.unraveled', { boss: otherBoss.name }),
            displayNameRef: ref('msg.exp.boss.unraveled', null, { boss: defRef(otherBoss) }),
            label: otherBoss.name,
            labelRef: defRef(otherBoss),
            sprite: p0.sprite || otherBoss.sprite,
            color: p0.color || otherBoss.color || '#cc33cc',
            // Deep-copy abilities so a mid-fight mutation never aliases config.
            abilities: (p0.abilities || []).map(a => ({ ...a })),
        };
    }

    // Returns every available mask (all realm bosses except the Unraveler itself),
    // used both for the initial disguise phases and for mid-fight chaos swaps.
    // Built once per game (REALMS is fixed after mod load) since mask swaps roll
    // every round. Returns a fresh array; callers copy abilities before use.
    _buildAllMasks() {
        if (!this._allMasksCache) {
            this._allMasksCache = Object.entries(REALMS)
                .filter(([, r]) => r.boss && !r.boss.dynamicMasks && Array.isArray(r.boss.phases) && r.boss.phases.length > 0)
                .map(([k, r]) => this._buildBossMask(k, r.boss));
        }
        return this._allMasksCache.slice();
    }

    // Generates the Unraveler's phase list at spawn: (maxPhases - 1) buffed masks of
    // distinct other realm bosses, followed by the true final form (the last config
    // phase). The finale is ALWAYS the true Unraveler regardless of the difficulty
    // phase cap, so the "it drops the disguise" climax survives at every difficulty.
    _buildUnravelerMasks(boss, maxPhases) {
        const configPhases = boss.phases;
        // A static boss at this difficulty would use configPhases[0 .. maxPhases-1]
        // and END on configPhases[maxPhases-1]. Anchor the finale to THAT slot (not
        // the last config phase) so the fight's HP budget, damage curve, and which
        // phases carry autoChaosTick all match the static difficulty curve exactly.
        // Only its identity (sprite/name) is the true Unraveler.
        const kept = Math.min(maxPhases, configPhases.length);
        const finaleSlot = configPhases[kept - 1];
        const maskCount = Math.max(0, kept - 1);

        // Draw distinct masks; if fewer bosses exist than slots, allow repeats.
        const available = this._buildAllMasks();
        for (let i = available.length - 1; i > 0; i--) {
            const j = randInt(0, i);
            [available[i], available[j]] = [available[j], available[i]];
        }
        const chosen = [];
        for (let i = 0; i < maskCount; i++) {
            chosen.push(available.length > 0 ? available[i % available.length] : null);
        }

        const buff = ExplorationSystem.MASK_DAMAGE_BUFF;
        const phases = [];
        for (let i = 0; i < maskCount; i++) {
            const slot = configPhases[i] || finaleSlot; // slot supplies the HP budget + chaos flags
            const mask = chosen[i];
            const isLastMask = i === maskCount - 1;
            phases.push({
                // name = combat-log phase label; displayName = HP-bar identity.
                name: mask ? mask.label : slot.name,
                nameRef: mask ? mask.labelRef : phaseNameRef(slot),
                maskKey: mask ? mask.maskKey : null,
                displayName: mask ? mask.displayName : null,
                displayNameRef: mask ? mask.displayNameRef : null,
                hp: slot.hp,
                damage: Math.round(slot.damage * buff),
                damageReduction: slot.damageReduction || 0,
                color: mask ? mask.color : slot.color,
                sprite: mask ? mask.sprite : slot.sprite,
                abilities: mask ? mask.abilities.map(a => ({ ...a })) : (slot.abilities || []),
                autoChaosTick: slot.autoChaosTick || false,
                transitionText: tr(isLastMask ? 'msg.exp.boss.mask_drop' : 'msg.exp.boss.mask_shift'),
                transitionKey: isLastMask ? 'msg.exp.boss.mask_drop' : 'msg.exp.boss.mask_shift',
                armorText: slot.armorText || null,
                armorLoc: slot.armorText ? slot._loc : null,
            });
        }
        // Finale: the true, undisguised Unraveler. Uses the finale SLOT's stats (the
        // phase a static boss would end on at this difficulty) but restores the real
        // sprite/name so the disguise visibly drops for the climax.
        phases.push({ ...finaleSlot, displayName: boss.name, displayNameRef: defRef(boss) });
        return phases;
    }

    _rollLoot(dim, diffSettings) {
        if (!dim.loot || dim.loot.length === 0) return null;
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
            const xpRareMult = exp.partySnapshot.reduce((best, m) => Math.max(best, this._getXpLevelBonus(m.id, 'rareEncounterMult')), 1);
            const rareEncounterMult = getPartyExpeditionEffect(exp.partySnapshot, 'rareEncounterMult', exp.realm) * (exp.potionLootBoosts?.rareEncounterMult || 1) * xpRareMult;
            for (const rare of dimEvents.rare) {
                if (Math.random() < rare.chance * rareEncounterMult * ds.rareLootMult * this._getMutatorEffect(exp, 'rareLootMult')) {
                    const line = messageParam(defMessage(rare, 'text', { name: member.name }));
                    if (rare.loot.item) {
                        if (!exp.loot._items) exp.loot._items = [];
                        exp.loot._items.push(rare.loot.item);
                        this._addLog(exp, game, { key: 'msg.exp.loot_line_item', params: { line, item: resourceRef(rare.loot.item) } }, 'loot', { itemKey: rare.loot.item });
                    } else {
                        const amount = Math.round(randInt(rare.loot.amount[0], rare.loot.amount[1]) * ds.lootAmountMult * this._realmResourceMult(exp, rare.loot.resource));
                        exp.loot[rare.loot.resource] = (exp.loot[rare.loot.resource] || 0) + amount;
                        this._addLog(exp, game, { key: 'msg.exp.loot_line_resource', params: { line, amount, resource: resourceRef(rare.loot.resource) } }, 'loot', { itemKey: rare.loot.resource });
                    }
                    window.soundManager?.playExpSFX('loot_drop');
                    return;
                }
            }
        }

        const roll = Math.random();

        if (roll < EXPLORATION_CONFIG.trapChance) {
            const trapKeys = Object.keys(EXPEDITION_TRAPS);
            const trapKey = trapKeys[randInt(0, trapKeys.length - 1)];
            const trapDef = EXPEDITION_TRAPS[trapKey];

            exp.pendingDecision = {
                type: 'trap',
                trapKey,
                text: defMessage(trapDef, 'text'),
                _loc: trapDef._loc,
                checks: trapDef.checks,
                remainingTicks: Math.max(0, exp.nextEncounterTick - game.tick),
            };
            this._addLog(exp, game, defMessage(trapDef, 'text'), 'danger');
            window.soundManager?.playExpSFX('wave_alert');
        } else if (roll < EXPLORATION_CONFIG.trapChance + EXPLORATION_CONFIG.findItemChance) {
            const lootEntry = this._rollLoot(dim, ds);
            const lootMult = getPartyExpeditionEffect(exp.partySnapshot, 'lootMult', exp.realm) * (exp.potionLootBoosts?.lootMult || 1);
            const line = messageParam(this._discoveryLine(dimEvents, member));
            if (lootEntry) {
                if (lootEntry.item) {
                    if (!exp.loot._items) exp.loot._items = [];
                    exp.loot._items.push(lootEntry.item);
                    this._addLog(exp, game, { key: 'msg.exp.loot_line_item', params: { line, item: resourceRef(lootEntry.item) } }, 'loot', { itemKey: lootEntry.item });
                } else {
                    const boostedAmount = Math.floor(lootEntry.amount * lootMult * this._realmResourceMult(exp, lootEntry.resource));
                    exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + boostedAmount;
                    this._addLog(exp, game, { key: 'msg.exp.loot_line_resource', params: { line, amount: boostedAmount, resource: resourceRef(lootEntry.resource) } }, 'loot', { itemKey: lootEntry.resource });
                }
                window.soundManager?.playExpSFX('loot_drop');
            }
        } else {
            const currentEnc = exp.encounters[exp.currentEncounter];
            const crossAmbient = currentEnc?._crossRealmAmbient;
            const ambientPool = crossAmbient || (dimEvents && dimEvents.ambient) || EXPLORATION_EVENTS.ambient;
            const i = randInt(0, ambientPool.length - 1);
            const params = { name: member.name };
            let line;
            if (crossAmbient) {
                // The encounter saved the other realm's lines; key them by that realm.
                const crossEvents = REALMS[currentEnc._crossRealmKey]?.events;
                line = crossEvents?.ambient?.length === crossAmbient.length
                    ? lineMessage(crossEvents, 'ambient', i, params)
                    : lineMessage({ ambient: crossAmbient }, 'ambient', i, params);
            } else if (dimEvents && dimEvents.ambient) {
                line = lineMessage(dimEvents, 'ambient', i, params);
            } else {
                line = eventLine('ambient', i, params);
            }
            if (crossAmbient && currentEnc?._crossRealmKey) {
                const realm = REALMS[currentEnc._crossRealmKey] ? defRef(REALMS[currentEnc._crossRealmKey]) : ref('msg.exp.label.another_realm', 'another realm');
                line = { key: 'msg.exp.cross_realm_echo', params: { realm, line: messageParam(line) } };
            }
            this._addLog(exp, game, line, 'ambient');
        }
    }

    _startEncounter(exp, game, encounterOverride) {
        const encounter = encounterOverride || exp.encounters[exp.currentEncounter];
        if (!encounter) return;

        if (exp.nodeMap) {
            const isBoss = encounter === exp.bossEncounter;
            const node = isBoss
                ? exp.nodeMap.find(n => n.type === 'boss' && !n.completed)
                : exp.nodeMap.find(n => n.encounterIndex === exp.currentEncounter && !n.completed);
            if (node) node.current = true;
        }

        // XP once per encounter: a portal loop-back replays the same encounter.
        const encKey = encounter.isBoss ? 'boss' : exp.currentEncounter;
        if (!exp.xpAwardedEncounters) exp.xpAwardedEncounters = [];
        if (!exp.xpAwardedEncounters.includes(encKey)) {
            exp.xpAwardedEncounters.push(encKey);
            this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerEncounter);
            this._awardAnimalExpeditionXP(exp, ANIMAL_XP_CONFIG.xpPerCombatEncounter);
        }

        // Scout (Adventurer Lv3): any member with this ability previews what lies ahead.
        const hasScout = exp.partySnapshot.some(m => this.getExpeditionLevel(m.id) >= 3);
        if (hasScout) {
            const typeKey = ['combat', 'decision', 'puzzle', 'npc', 'loot'].includes(encounter.type) ? encounter.type : 'unknown';
            const isBoss = encounter.isBoss;
            this._addLog(exp, game, isBoss ? { key: 'msg.exp.scout_boss' } : { key: `msg.exp.scout.${typeKey}` }, 'info');
        }

        if (encounter.type === 'decision') {
            exp.pendingDecision = {
                type: 'decision',
                decisionKey: encounter.decisionKey,
                // { key, params } for the prompt; _loc keys the choice/check text too.
                text: defMessage(encounter, 'text'),
                _loc: encounter._loc,
                choices: encounter.choices,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, defMessage(encounter, 'text'), 'info');
            return;
        }

        if (encounter.type === 'puzzle') {
            exp.pendingDecision = {
                type: 'puzzle',
                puzzleKey: encounter.puzzleKey,
                // { key, params } for the prompt; _loc keys the choice/check text too.
                text: defMessage(encounter, 'text'),
                _loc: encounter._loc,
                checks: encounter.checks,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, defMessage(encounter, 'text'), 'info');
            return;
        }

        if (encounter.type === 'npc') {
            exp.pendingDecision = {
                type: 'npc',
                npcKey: encounter.npcKey,
                sprite: encounter.sprite || null,
                // { key, params } for the prompt; _loc keys the choice/check text too.
                text: defMessage(encounter, 'text'),
                _loc: encounter._loc,
                choices: encounter.choices,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, defMessage(encounter, 'text'), 'info');
            this._updateBestiary(exp, 'npc', encounter.npcKey, {
                name: encounter.name || encounter.text.slice(0, 40), lore: encounter.lore || '', sprite: encounter.sprite || null,
                nameRef: locRef(encounter, 'name'), loreRef: locRef(encounter, 'lore'),
            }, game);
            return;
        }

        if (encounter.type === 'loot') {
            const member = exp.partySnapshot.find(p => p.hp > 0) || exp.partySnapshot[0];
            const dim = REALMS[exp.realm];
            const line = messageParam(this._discoveryLine(dim.events, member));
            if (encounter.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(encounter.item);
                this._addLog(exp, game, { key: 'msg.exp.loot_line_item', params: { line, item: resourceRef(encounter.item) } }, 'loot', { itemKey: encounter.item });
            } else {
                const streakMult = exp.streakMultiplier || 1.0;
                const amount = Math.floor(encounter.amount * streakMult * this._realmResourceMult(exp, encounter.resource));
                exp.loot[encounter.resource] = (exp.loot[encounter.resource] || 0) + amount;
                this._addLog(exp, game, { key: 'msg.exp.loot_line_resource', params: { line, amount, resource: resourceRef(encounter.resource) } }, 'loot', { itemKey: encounter.resource });
            }
            window.soundManager?.playExpSFX('loot_drop');
            if (exp.nodeMap) {
                const node = exp.nodeMap.find(n => n.encounterIndex === exp.currentEncounter);
                if (node) node.completed = true;
            }
            exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
            return;
        }

        const enemies = encounter.enemies.map(e => ({ ...e }));

        if (encounter.isBoss) {
            const bossEnemy = enemies.find(e => e.isBoss);
            const dim = REALMS[exp.realm];
            const approachMsg = dim.boss?.approachText
                ? defMessage(dim.boss, 'approachText')
                : { key: 'msg.exp.boss_approach', params: { boss: enemyNameRef(bossEnemy) } };
            this._addLog(exp, game, approachMsg, 'danger', { fx: { kind: 'boss_entrance' } });
            window.soundManager?.playExpSFX('wave_alert');
            // Bestiary records the boss's TRUE identity. For dynamic-mask bosses the
            // spawned enemy starts disguised as a random mask, so recording
            // bossEnemy.name/sprite would key a bogus, per-fight-randomized entry
            // instead of one stable "The Unraveler". Use the config identity (and
            // the true final-phase sprite/color) for those.
            const trueFinale = dim.boss?.dynamicMasks ? dim.boss.phases[dim.boss.phases.length - 1] : null;
            const bestiaryName = trueFinale ? dim.boss.name : bossEnemy.name;
            const bestiarySprite = trueFinale ? (trueFinale.sprite || dim.boss?.sprite) : (bossEnemy.sprite || dim.boss?.sprite);
            const bestiaryColor = trueFinale ? (trueFinale.color || dim.boss?.color) : (bossEnemy.color || dim.boss?.color);
            // Keyed by realm (one boss per realm): the name follows the language.
            this._updateBestiary(exp, 'boss', exp.realm, {
                name: bestiaryName, sprite: bestiarySprite, color: bestiaryColor, lore: dim.boss?.lore || '', bossPhases: encounter.bossPhases || [],
                nameRef: trueFinale ? locRef(dim.boss, 'name') : (bossEnemy.nameRef || null), loreRef: locRef(dim.boss, 'lore'),
            }, game);

            if (encounter.bossPhases) {
                exp.bossPhaseData = {
                    currentPhaseIndex: 0,
                    phases: encounter.bossPhases,
                    // Re-armed each phase; drives the guaranteed first mask swap.
                    _swappedThisPhase: false,
                };
            }
        } else {
            const line = messageParam(eventLine('combatStart', randInt(0, EXPLORATION_EVENTS.combatStart.length - 1)));
            const elites = enemies.filter(e => e.elite).map(eliteRef);
            this._addLog(exp, game, elites.length > 0
                ? { key: 'msg.exp.combat_start_elite', params: { line, n: enemies.length, elites: listRef(elites) } }
                : { key: 'msg.exp.combat_start', params: { line, n: enemies.length } }, 'combat');
            window.soundManager?.playExpSFX('wave_alert');

            for (const e of enemies) {
                const bKey = e.typeKey || `enemy_${exp.realm}`;
                const bName = e.name || tr('msg.exp.label.realm_creature', { realm: REALMS[exp.realm]?.name || exp.realm });
                const catalogEntry = e.typeKey ? EXPEDITION_ENEMIES[e.typeKey] : null;
                this._updateBestiary(exp, 'regular', bKey, {
                    name: bName,
                    nameRef: e.name ? locRef(catalogEntry, 'name') : ref('msg.exp.label.realm_creature', bName, { realm: realmRef(exp.realm) }),
                    loreRef: locRef(catalogEntry, 'lore'),
                    sprite: e.sprite,
                    color: e.color || '#ff3333',
                    lore: catalogEntry?.lore || '',
                    eliteModifier: e.elite || null,
                    eliteName: e.eliteName || null,
                }, game);
            }
        }

        exp.combat = {
            enemies,
            round: 0,
            encounterIndex: exp.currentEncounter,
            isBoss: encounter.isBoss || false,
            ambushEndTick: game.tick + Math.max(...exp.partySnapshot.map(m => m.effectiveCooldown)),
        };
        exp.partySnapshot.forEach((m, i) => { m._nextAttackTick = game.tick + i; m._lastMoveTick = game.tick; });
        enemies.forEach((e, i) => { e._nextAttackTick = game.tick + 2 + i * 2; });
        this._attachWarBeasts(exp);
        (exp.combat.beasts || []).forEach((b, i) => { b._nextAttackTick = game.tick + i; });
        this._logSynergies(exp, game);
        this._rangedFirstStrike(exp, game, enemies);
        if (this._shouldApplyChaosEffect(exp)) {
            this._applyRandomChaosEffect(exp, game, exp.combat);
        }
    }

    // Party synergy notice: at combat start, tell the player which relationships
    // are shaping this fight (friends embolden, rivals bicker). One line per fight,
    // only when at least one synergy is actually in play.
    _logSynergies(exp, game) {
        const cfg = EXPLORATION_CONFIG.synergy;
        if (!cfg) return;
        let allies = 0;
        let rivals = 0;
        const party = exp.partySnapshot;
        for (let i = 0; i < party.length; i++) {
            for (let j = i + 1; j < party.length; j++) {
                const a = party[i], b = party[j];
                // Use the stronger of the two directional opinions for the pair.
                const opinion = Math.max(a.opinions?.[b.id] ?? 0, b.opinions?.[a.id] ?? 0);
                const worst = Math.min(a.opinions?.[b.id] ?? 0, b.opinions?.[a.id] ?? 0);
                if (opinion >= cfg.allyOpinion) allies++;
                else if (worst <= cfg.rivalOpinion) rivals++;
            }
        }
        if (allies > 0 && rivals > 0) {
            this._addLog(exp, game, { key: 'msg.exp.synergy_mixed' }, 'combat');
        } else if (allies > 0) {
            this._addLog(exp, game, { key: 'msg.exp.synergy_allies' }, 'success');
        } else if (rivals > 0) {
            this._addLog(exp, game, { key: 'msg.exp.synergy_rivals' }, 'combat');
        }
    }

    // Attach living war beasts to a freshly-started combat. combat.beasts holds
    // live references straight into exp.warBeasts, so damage taken during the fight
    // persists to the next encounter and a beast that dies stays dead. A beast at
    // 0 hp is skipped (it fell in an earlier encounter).
    _attachWarBeasts(exp) {
        if (!exp.warBeasts || exp.warBeasts.length === 0) return;
        exp.combat.beasts = exp.warBeasts.filter(b => b.hp > 0);
    }

    // Ranged first-strike: before the normal attack phase, every party member with
    // a ranged weapon fires one free opening shot at the nearest living enemy.
    // Gives bows/crossbows an identity in expeditions (skirmish before melee closes)
    // without changing their sustained dps. Enemies do not retaliate during this
    // window; it resolves entirely within combat setup.
    _rangedFirstStrike(exp, game, enemies) {
        const dmgMult = EXPLORATION_CONFIG.rangedFirstStrikeDamageMult ?? 1.0;
        const partyDmgMult = getPartyExpeditionEffect(exp.partySnapshot, 'partyDamageMult', exp.realm)
            * getPartyExpeditionEffect(exp.partySnapshot, 'expeditionDamageMult', exp.realm)
            * (exp._tempDamageMult || 1.0);
        for (const member of exp.partySnapshot) {
            if (member.hp <= 0) continue;
            const disabled = member._disabledSlots || {};
            if (!member.weapon || disabled.weapon || !member.weapon.ranged) continue;
            const target = enemies.find(e => e.hp > 0);
            if (!target) break;

            const slotNames = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
            const memberItems = slotNames.filter(s => member[s] && !disabled[s]).map(s => member[s]);
            let weaponDmg = member.weapon.damage;
            for (const item of memberItems) { if (item !== member.weapon && item.damage) weaponDmg += item.damage; }
            const synergyDmgMult = getSynergyDamageMult(member, exp.partySnapshot);
            const xpDmgMult = this._getXpLevelBonus(member.id, 'expeditionDamageMult');
            let dmg = Math.max(1, Math.round((weaponDmg + randInt(0, 3)) * partyDmgMult * xpDmgMult * synergyDmgMult * dmgMult));
            if (target.eliteDR) dmg = Math.max(1, Math.floor(dmg * (1 - target.eliteDR)));
            if (target.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - target.damageReduction)));

            // Drive the ranged attack visual + sfx, just like a normal ranged hit.
            member._lastAttackTick = game.tick;
            member._lastAttackKind = member.weapon.attackAnim || 'DrawAndShoot';
            target.hp -= dmg;
            applyWeaponOnHit(member.weapon, target, game);
            if (exp.summary) exp.summary.damageDealt[member.id] = (exp.summary.damageDealt[member.id] || 0) + dmg;
            const rangedSfx = member.weapon.skinKey === 'projectile_bolt' ? 'bolt_fire' : 'arrow_fire';
            window.soundManager?.playExpSFX(rangedSfx);
            this._addLog(exp, game, { key: 'msg.exp.opening_shot', params: { name: member.name, target: foeLabel(target), dmg } }, 'combat',
                { fx: { kind: 'hit', byParty: true, target: null, amount: dmg } });
            if (target.hp <= 0) {
                this._addLog(exp, game, { key: 'msg.exp.opening_shot_kill', params: { name: member.name, target: foeOrBoss(target) } }, 'success',
                    { fx: { kind: 'kill', byParty: true } });
                window.soundManager?.playExpSFX('enemy_death');
                if (exp.summary) exp.summary.killCount[member.id] = (exp.summary.killCount[member.id] || 0) + 1;
                if (target.elite) { exp.eliteKills++; this._processEliteOnDeath(target, exp, game); }
                this._processEnemyOnDeath(target, exp, game);
            }
        }
    }

    _updateCombat(exp, game) {
        const combat = exp.combat;

        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        const enemiesAlive = combat.enemies.filter(e => e.hp > 0);

        if (alive.length === 0 || enemiesAlive.length === 0) {
            this._finishCombat(exp, game);
            return;
        }

        // Combat runs per tick (everyone acts on their own attack cooldown), but
        // round-scoped effects advance once per combat round: one baseline attack
        // cycle of EXPLORATION_CONFIG.combatRoundTicks. The first round starts on the
        // first update; each later boundary bumps combat.round.
        let roundStart = false;
        if (combat.nextRoundTick == null) {
            combat.nextRoundTick = game.tick + EXPLORATION_CONFIG.combatRoundTicks;
        } else if (game.tick >= combat.nextRoundTick) {
            roundStart = true;
            combat.round++;
            combat.nextRoundTick = game.tick + EXPLORATION_CONFIG.combatRoundTicks;
        }

        // Apply DoTs and age out status effects at the top of the round, then
        // re-check for a wipe (poison can be lethal) before anyone acts.
        if (roundStart) {
            this._tickCombatStatus(exp, game, combat);
            // Realm-event downside (e.g. Verdant Bloom): enemies regenerate each round.
            const regenPerRound = this._getRealmEventEffect(exp, 'enemyRegenPerRound');
            if (regenPerRound > 0) {
                for (const e of combat.enemies) {
                    if (e.hp > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.floor(e.maxHp * regenPerRound)));
                }
            }
            if (exp.partySnapshot.every(p => p.hp <= 0) || combat.enemies.every(e => e.hp <= 0)) {
                this._finishCombat(exp, game);
                return;
            }
        }

        this._tryUsePotions(exp, game);

        const baseMissChance = 0.15 + this._getMutatorEffect(exp, 'missChanceMod');
        // Passing exp.realm lets realmBonus traits (e.g. Void-Touched) contribute their
        // realm-specific partyDamageMult here. Computed once, alongside items/flat traits.
        const partyDmgMult = getPartyExpeditionEffect(exp.partySnapshot, 'partyDamageMult', exp.realm)
            * this._getMutatorEffect(exp, 'partyDamageMult')
            * getPartyExpeditionEffect(exp.partySnapshot, 'expeditionDamageMult', exp.realm)
            * (exp._tempDamageMult || 1.0);
        const physResist = this._getMutatorEffect(exp, 'enemyPhysicalResist');
        const globalThorns = this._getMutatorEffect(exp, 'globalThorns');

        // -- Party attack phase --
        for (const member of alive) {
            if (member.hp <= 0) continue;
            const memberWeaken = this._combatStatusValue(member, 'weaken', 'mult', 1);
            const disabled = member._disabledSlots || {};
            let weaponDmg = (member.weapon && !disabled.weapon) ? member.weapon.damage : EXPLORATION_CONFIG.baseFistDamage;
            const slotNames = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
            const memberItems = slotNames.filter(s => member[s] && !disabled[s]).map(s => member[s]);
            for (const item of memberItems) { if (item !== member.weapon && item.damage) weaponDmg += item.damage; }
            let critChance = memberItems.reduce((sum, it) => sum + (it.critChance || 0), 0);
            critChance += this._combatStatusValue(member, 'buff_critChance', 'value', 0);
            critChance = Math.min(1.0, critChance);
            const atkSpeedBuff = 1 + this._combatStatusValue(member, 'buff_attackSpeed', 'value', 0);
            const effCd = Math.max(1, Math.round(member.effectiveCooldown / atkSpeedBuff));
            if (game.tick < (member._nextAttackTick || 0)) continue;
            member._nextAttackTick = game.tick + effCd;
            // Enemy-applied crowd control on the party (framework), checked on the
            // member's own turn: a stunned member forfeits it, a slowed one may.
            // Weaken scales its outgoing damage.
            if (this._loseTurnToCrowdControl(member)) {
                this._addLog(exp, game, { key: member._lostTurnTo === 'stun' ? 'msg.exp.member_stunned' : 'msg.exp.member_slowed', params: { name: member.name } }, 'danger');
                continue;
            }
            const isRanged = member.weapon && member.weapon.ranged;
            const formDmgMult = isRanged ? 1.0 : this._applyFormationModifier(exp, member.id, 'meleeDamageMult');
            const xpDmgMult = this._getXpLevelBonus(member.id, 'expeditionDamageMult');
            const synergyDmgMult = getSynergyDamageMult(member, exp.partySnapshot);

            const target = combat.enemies.find(e => e.hp > 0);
            if (!target) continue;
            // Stamp the basic-attack tick so the expedition visual can play an
            // attack animation. Set only on basic attacks, never spells. Kind
            // drives the motion class: melee = swing (rotation), ranged =
            // draw/thrust + projectile.
            member._lastAttackTick = game.tick;
            member._lastAttackKind = member.attackAnim
                || (member.weapon && member.weapon.attackAnim)
                || (member.weapon && member.weapon.ranged ? 'DrawAndShoot' : 'Swing');
            const targetLabel = foeLabel(target);

            if (target.eliteDodge && Math.random() < target.eliteDodge) {
                target._lastDodgeTick = game.tick;
                this._addLog(exp, game, { key: 'msg.exp.foe_dodges', params: { target: foeLabel(target, true), name: member.name } }, 'combat',
                    { fx: { kind: 'miss', byParty: true, dodger: null } });
                continue;
            }

            const totalArmoredBonus = target.armored ? memberItems.reduce((sum, it) => sum + (it.armoredDamageBonus || 0), 0) : 0;
            const armoredBonus = 1 + totalArmoredBonus;
            const chaosSurgeMult = this._combatStatusValue(member, 'chaos_surge', 'dmgMult', 1);
            const voidBlessedBonus = this._combatStatusValue(member, 'void_blessed', 'dmgBonus', 0);
            const vulnerableMult = this._combatStatusValue(target, 'vulnerable', 'damageMult', 1);
            const inspiredMult = this._combatStatusValue(member, 'inspired', 'dmgMult', 1);
            // First Strike (e.g. Striker's Band): the member's opening attack of the
            // fight, i.e. the first blow after moving into the encounter.
            if (!combat.struckIds) combat.struckIds = [];
            const firstStrike = !combat.struckIds.includes(member.id);
            if (firstStrike) combat.struckIds.push(member.id);
            const postMoveMult = firstStrike ? 1 + memberItems.reduce((s, it) => s + (it.postMoveAttackBonus || 0), 0) : 1;
            let dmg = Math.max(1, Math.round((weaponDmg + voidBlessedBonus + randInt(0, 3)) * partyDmgMult * formDmgMult * xpDmgMult * synergyDmgMult * memberWeaken * armoredBonus * (1 - physResist) * chaosSurgeMult * vulnerableMult * inspiredMult * postMoveMult));
            let critHit = false;
            if (critChance > 0 && Math.random() < critChance) { dmg *= 2; critHit = true; }
            if (target.eliteDR) dmg = Math.max(1, Math.floor(dmg * (1 - target.eliteDR)));
            if (target.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - target.damageReduction)));

            const memberBlindChance = this._combatStatusValue(member, 'blind', 'missChance', 0);
            if (Math.random() < baseMissChance + memberBlindChance) {
                const line = eventLine('combatMiss', randInt(0, EXPLORATION_EVENTS.combatMiss.length - 1), { attacker: member.name, target: targetLabel });
                this._addLog(exp, game, line, 'combat', { fx: { kind: 'miss', byParty: true, dodger: null } });
            } else {
                target.hp -= dmg;
                const attackWeapon = member.weapon && !disabled.weapon ? member.weapon : null;
                applyWeaponOnHit(attackWeapon, target, game);
                if (attackWeapon?.onHit?.effect === 'slow') {
                    this._applyCombatStatus(target, 'slow', attackWeapon.onHit.rounds || 1, { mult: attackWeapon.onHit.attackSlowMult ?? 0.6 });
                }
                // Cleave: deal 50% splash to all other living enemies this round.
                if (attackWeapon?.cleave) {
                    const cleaveDmg = Math.max(1, Math.floor(dmg * 0.5));
                    for (const e of combat.enemies) {
                        if (e === target || e.hp <= 0) continue;
                        e.hp -= cleaveDmg;
                        if (exp.summary) exp.summary.damageDealt[member.id] = (exp.summary.damageDealt[member.id] || 0) + cleaveDmg;
                        if (e.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.cleave_kill' }, 'success', { fx: { kind: 'kill', byParty: true } }); if (e.elite) { exp.eliteKills++; this._processEliteOnDeath(e, exp, game); } this._processEnemyOnDeath(e, exp, game); }
                    }
                    if (combat.enemies.filter(e => e.hp > 0).length < combat.enemies.length) this._addLog(exp, game, { key: 'msg.exp.cleave', params: { name: member.name } }, 'combat');
                }
                if (exp.summary) exp.summary.damageDealt[member.id] = (exp.summary.damageDealt[member.id] || 0) + dmg;
                if (critHit) member._lastCritTick = game.tick;
                const line = critHit
                    ? { key: 'msg.exp.critical_hit', params: { name: member.name, target: targetLabel, dmg } }
                    : eventLine('combatHit', randInt(0, EXPLORATION_EVENTS.combatHit.length - 1), { attacker: member.name, target: targetLabel, dmg });
                this._addLog(exp, game, line, 'combat', { fx: { kind: 'hit', byParty: true, target: null, amount: dmg } });
                const isRangedAttack = member.weapon && member.weapon.ranged;
                const rangedSfx = (member.weapon && member.weapon.skinKey === 'projectile_bolt') ? 'bolt_fire' : 'arrow_fire';
                window.soundManager?.playExpSFX(critHit ? 'critical_hit' : (isRangedAttack ? rangedSfx : 'colonist_damaged'));
                const lifeSteal = memberItems.reduce((sum, it) => sum + (it.lifeSteal || 0), 0);
                if (lifeSteal > 0) {
                    const healed = Math.floor(dmg * lifeSteal);
                    if (healed > 0) { member.hp = Math.min(member.maxHp, member.hp + healed); if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healed; }
                }
                if (target.hp <= 0) {
                    this._addLog(exp, game, { key: 'msg.exp.slays', params: { name: member.name, target: foeOrBoss(target) } }, 'success',
                        { fx: { kind: 'kill', byParty: true } });
                    window.soundManager?.playExpSFX('enemy_death');
                    if (exp.summary) exp.summary.killCount[member.id] = (exp.summary.killCount[member.id] || 0) + 1;
                    const hpOnKill = memberItems.reduce((sum, it) => sum + (it.hpOnKill || 0), 0)
                        + this._combatStatusValue(member, 'buff_hpOnKill', 'value', 0);
                    if (hpOnKill > 0) member.hp = Math.min(member.maxHp, member.hp + hpOnKill);
                    if (target.elite) { exp.eliteKills++; this._processEliteOnDeath(target, exp, game); }
                    this._processEnemyOnDeath(target, exp, game);
                }
            }
        }

        // -- Party spell phase --
        this._tryCombatSpells(exp, game, alive, combat);
        // Heals, cleanses and mana/health regen run in combat too, not only between
        // encounters. Members who just cast a combat spell wait for their next tick.
        this._tryHealSpells(exp, game, m => m._lastCastTick === game.tick);
        this._regenMana(exp, game);
        this._expireShields(exp, game);

        // Summons and war beasts swing on the baseline attack cooldown, like a
        // colonist with no weapon speed bonus.
        const companionCd = COLONIST_CONFIG.baseAttackCooldown;

        // -- Summons phase --
        if (exp.summons && exp.summons.length > 0) {
            for (let si = exp.summons.length - 1; si >= 0; si--) {
                const summon = exp.summons[si];
                summon.ticksRemaining -= 1;
                if (summon.ticksRemaining <= 0 || summon.hp <= 0) {
                    this._addLog(exp, game, { key: 'msg.exp.summon_fades', params: { summon: companionRef(summon) } }, 'info', { fx: { kind: 'summon_end', summon: summon.name } });
                    exp.summons.splice(si, 1);
                    continue;
                }
                if (game.tick < (summon._nextAttackTick || 0)) continue;
                summon._nextAttackTick = game.tick + companionCd;
                const summonTarget = combat.enemies.find(e => e.hp > 0);
                if (summonTarget) {
                    summon._lastAttackTick = game.tick;
                    summon._lastAttackKind = summon.attackAnim || (summon.ranged ? 'DrawAndShoot' : 'Swing');
                    const sDmg = summon.damage + randInt(0, 2);
                    if (Math.random() < 0.1) {
                        this._addLog(exp, game, { key: 'msg.exp.summon_misses', params: { summon: companionRef(summon) } }, 'combat', { fx: { kind: 'miss', byParty: true, dodger: null } });
                    } else {
                        summonTarget.hp -= sDmg;
                        this._addLog(exp, game, { key: 'msg.exp.summon_attacks', params: { summon: companionRef(summon), dmg: sDmg } }, 'combat',
                            { fx: { kind: 'hit', byParty: true, target: null, amount: sDmg } });
                        if (summonTarget.hp <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.summon_slays', params: { summon: companionRef(summon) } }, 'success', { fx: { kind: 'kill', byParty: true } });
                            if (summonTarget.elite) { exp.eliteKills++; this._processEliteOnDeath(summonTarget, exp, game); }
                            this._processEnemyOnDeath(summonTarget, exp, game);
                        }
                    }
                }
            }
        }

        // -- War beast phase --
        // Tamed war beasts fight each round like party members. Their HP persists on
        // exp.warBeasts across encounters (unlike round-scoped summons), and combat.beasts
        // is the live per-encounter view that the enemy phase can target.
        if (combat.beasts && combat.beasts.length > 0) {
            for (const beast of combat.beasts) {
                if (beast.hp <= 0) continue;
                if (game.tick < (beast._nextAttackTick || 0)) continue;
                beast._nextAttackTick = game.tick + companionCd;
                const beastTarget = combat.enemies.find(e => e.hp > 0);
                if (!beastTarget) break;
                beast._lastAttackTick = game.tick;
                beast._lastAttackKind = 'Swing';
                const bDmg = Math.max(1, beast.damage + randInt(0, 2));
                if (Math.random() < 0.1) {
                    this._addLog(exp, game, { key: 'msg.exp.beast_misses', params: { beast: companionRef(beast) } }, 'combat', { fx: { kind: 'miss', byParty: true, dodger: null } });
                } else {
                    beastTarget.hp -= bDmg;
                    this._addLog(exp, game, { key: 'msg.exp.beast_mauls', params: { beast: companionRef(beast), dmg: bDmg } }, 'combat',
                        { fx: { kind: 'hit', byParty: true, target: null, amount: bDmg } });
                    if (beastTarget.hp <= 0) {
                        this._addLog(exp, game, { key: 'msg.exp.beast_kills', params: { beast: companionRef(beast) } }, 'success', { fx: { kind: 'kill', byParty: true } });
                        window.soundManager?.playExpSFX('enemy_death');
                        if (beastTarget.elite) { exp.eliteKills++; this._processEliteOnDeath(beastTarget, exp, game); }
                        this._processEnemyOnDeath(beastTarget, exp, game);
                    }
                }
            }
        }

        // -- Elite and boss abilities phase (regen, AoE/summon rolls, chaos ticks,
        // mask swaps): once per round, so their per-round chances hold. --
        if (roundStart) {
            for (const enemy of combat.enemies) {
                if (enemy.hp > 0) this._processEliteAbilities(enemy, exp, game);
            }
            const bossEnemy = combat.enemies.find(e => e.isBoss && e.hp > 0);
            if (bossEnemy) {
                this._executeBossAbilities(bossEnemy, exp, game);
            }
        }
        // Realm-event downside (Void Tide, Seismic Tremor): once per round, a
        // chance that the realm lashes out through the enemies and splashes the
        // whole party.
        const realmAoEChance = roundStart ? this._getRealmEventEffect(exp, 'enemyAoEChance') : 0;
        if (realmAoEChance > 0 && combat.enemies.some(e => e.hp > 0) && Math.random() < realmAoEChance) {
            const range = this._getRealmEventAoEDamage(exp);
            const aoeDmg = randInt(range[0], range[1]);
            for (const p of alive) {
                if (p.hp <= 0) continue;
                const actual = Math.max(1, Math.floor(aoeDmg * this._applyFormationModifier(exp, p.id, 'damageTakenMult')));
                p.hp -= actual;
                if (exp.summary) exp.summary.damageTaken[p.id] = (exp.summary.damageTaken[p.id] || 0) + actual;
                if (p.hp <= 0) this._checkExpeditionRevive(exp, p, game);
            }
            this._addLog(exp, game, { key: 'msg.exp.realm_lashes', params: { dmg: aoeDmg } }, 'danger');
        }

        // -- Enemy attack phase --
        // Ambush (Adventurer Lv8): enemies cannot act until ambushEndTick has passed,
        // giving the party a free attack window at the start of combat.
        const inAmbush = game.tick <= (combat.ambushEndTick || 0) && exp.partySnapshot.some(m => this.getExpeditionLevel(m.id) >= 8);
        if (inAmbush && !combat._ambushLogged) {
            combat._ambushLogged = true;
            this._addLog(exp, game, { key: 'msg.exp.ambush' }, 'success');
        }
        for (const enemy of combat.enemies) {
            if (enemy.hp <= 0) continue;
            if (inAmbush) { enemy._lastAttackKind = enemy.attackAnim || 'Swing'; continue; }
            const attackerLabel = foeLabel(enemy, true);
            const enemyWeaken = this._combatStatusValue(enemy, 'weaken', 'mult', 1);
            const enemyCd = enemy.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            // Attack-animation speed (see party snapshot): <1 fast, >1 slow. The
            // visual clamps it. Here it's just the raw cooldown-to-baseline ratio.
            enemy._atkAnimMult = enemyCd / COLONIST_CONFIG.baseAttackCooldown;
            // Elite extra attacks reduce the effective cooldown proportionally.
            const eliteSpeedMult = enemy.eliteExtraAttacks ? 1 / (1 + enemy.eliteExtraAttacks) : 1;
            const effEnemyCd = Math.max(1, Math.floor(enemyCd * eliteSpeedMult));
            if (game.tick < (enemy._nextAttackTick || 0)) continue;
            enemy._nextAttackTick = game.tick + effEnemyCd;
            // Crowd control from party spells, checked on the enemy's own turn: a
            // stunned enemy forfeits it, a slowed one has a (1 - mult) chance to.
            // Weaken (above) scales the damage of whatever attacks it does land.
            if (this._loseTurnToCrowdControl(enemy)) {
                this._addLog(exp, game, { key: enemy._lostTurnTo === 'stun' ? 'msg.exp.foe_stunned' : 'msg.exp.foe_slowed', params: { foe: attackerLabel } }, 'combat');
                continue;
            }
            {
                if (enemy.spells) {
                    let castSpell = false;
                    for (const sp of enemy.spells) {
                        if (Math.random() < sp.chance) {
                            const spName = ref(`msg.exp.enemy_spell.${sp.spell}`, sp.spell.replace(/_/g, ' '));
                            const school = SPELLS[sp.spell]?.school ?? null;
                            if (sp.healPct) {
                                const allies = combat.enemies.filter(e => e.hp > 0 && e.hp < e.maxHp);
                                if (allies.length > 0) {
                                    const healTarget = allies[randInt(0, allies.length - 1)];
                                    const heal = Math.floor(healTarget.maxHp * sp.healPct);
                                    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
                                    this._addLog(exp, game, { key: 'msg.exp.foe_cast_heal', params: { foe: attackerLabel, spell: spName, amount: heal } }, 'danger',
                                        { fx: { kind: 'cast', caster: null, effect: 'heal', school, amount: heal, area: false } });
                                    castSpell = true; break;
                                }
                            }
                            if (sp.aoe) {
                                const dmg = randInt(sp.damage[0], sp.damage[1]);
                                for (const p of alive) {
                                    if (p.hp <= 0) continue;
                                    p.hp -= dmg;
                                    if (exp.summary) exp.summary.damageTaken[p.id] = (exp.summary.damageTaken[p.id] || 0) + dmg;
                                    if (p.hp <= 0) this._checkExpeditionRevive(exp, p, game);
                                }
                                this._addLog(exp, game, { key: 'msg.exp.foe_cast_aoe', params: { foe: attackerLabel, spell: spName, dmg } }, 'danger',
                                    { fx: { kind: 'cast', caster: null, effect: 'damage', school, amount: dmg, area: true } });
                            } else if (sp.damage) {
                                const spTarget = alive.filter(p => p.hp > 0)[randInt(0, Math.max(0, alive.filter(p => p.hp > 0).length - 1))];
                                if (spTarget) {
                                    const dmg = randInt(sp.damage[0], sp.damage[1]);
                                    spTarget.hp -= dmg;
                                    if (exp.summary) exp.summary.damageTaken[spTarget.id] = (exp.summary.damageTaken[spTarget.id] || 0) + dmg;
                                    this._addLog(exp, game, { key: 'msg.exp.foe_cast_hit', params: { foe: attackerLabel, spell: spName, name: spTarget.name, dmg } }, 'danger',
                                        { fx: { kind: 'cast', caster: null, effect: 'damage', school, amount: dmg, area: false } });
                                    if (sp.lifesteal && enemy.hp > 0) {
                                        const stolen = Math.floor(dmg * sp.lifesteal);
                                        enemy.hp = Math.min(enemy.maxHp, enemy.hp + stolen);
                                    }
                                    if (spTarget.hp <= 0) this._checkExpeditionRevive(exp, spTarget, game);
                                }
                            }
                            if (sp.dot && !sp.aoe) {
                                const spTarget = alive.filter(p => p.hp > 0)[0];
                                if (spTarget) {
                                    // Visible, round-scoped poison cleared at combat end.
                                    // Rounds default from the legacy tick count so existing
                                    // enemy configs keep their intended duration.
                                    const rounds = sp.dot.rounds || sp.dot.ticks || 3;
                                    const statusType = sp.dot.status || 'poison';
                                    if (statusType === 'poison' && this._memberHasPoisonImmunity(spTarget)) {
                                        this._addLog(exp, game, { key: 'msg.exp.resists_poison', params: { name: spTarget.name } }, 'combat');
                                    } else {
                                        this._applyCombatStatus(spTarget, statusType, rounds, { damageRange: sp.dot.damage });
                                        this._addLog(exp, game, { key: 'msg.exp.poisoned', params: { name: spTarget.name } }, 'danger');
                                    }
                                }
                            }
                            // Framework: data-driven enemy crowd control. An enemy/boss
                            // spell may carry a `cc` block to stun/slow/weaken the party.
                            if (sp.cc) {
                                const ccTargets = sp.cc.aoe ? alive.filter(p => p.hp > 0) : [alive.filter(p => p.hp > 0)[0]].filter(Boolean);
                                for (const t of ccTargets) {
                                    this._applyCombatStatus(t, sp.cc.type, sp.cc.rounds || 1, sp.cc.mult !== undefined ? { mult: sp.cc.mult } : {});
                                }
                                if (ccTargets.length > 0) {
                                    const verb = sp.cc.type === 'stun' ? 'stun' : sp.cc.type === 'slow' ? 'slow' : 'weaken';
                                    const target = sp.cc.aoe ? ref('msg.exp.label.the_party_lower', 'the party') : ccTargets[0].name;
                                    this._addLog(exp, game, { key: `msg.exp.foe_cast_cc.${verb}`, params: { foe: attackerLabel, spell: spName, target } }, 'danger',
                                        { fx: { kind: 'cast', caster: null, effect: 'other', school, amount: null, area: !!sp.cc.aoe } });
                                }
                            }
                            castSpell = true; break;
                        }
                    }
                    if (castSpell) continue;
                }

                // Basic-attack path begins here (spellcasts already `continue`d above).
                // Stamp the tick so the expedition visual can play an attack animation.
                enemy._lastAttackTick = game.tick;
                enemy._lastAttackKind = enemy.attackAnim || (enemy.ranged ? 'DrawAndShoot' : 'Swing');

                const aliveSummons = exp.summons ? exp.summons.filter(s => s.hp > 0) : [];
                // Decoys have a high threatMult. Enemies always prefer them over
                // other summons and usually prefer them over party members.
                const aliveDecoys = aliveSummons.filter(s => s.type === 'decoy');
                if (aliveDecoys.length > 0 && Math.random() < 0.85) {
                    const targetSummon = aliveDecoys[randInt(0, aliveDecoys.length - 1)];
                    let dmg = enemy.damage + randInt(0, 2);
                    if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                    if (Math.random() < baseMissChance) {
                        this._addLog(exp, game, { key: 'msg.exp.foe_misses_companion', params: { foe: attackerLabel, target: companionRef(targetSummon) } }, 'combat',
                            { fx: { kind: 'miss', byParty: false, dodger: null } });
                    } else {
                        targetSummon.hp -= dmg;
                        this._addLog(exp, game, { key: 'msg.exp.foe_strikes_companion', params: { foe: attackerLabel, target: companionRef(targetSummon), dmg } }, 'combat',
                            { fx: { kind: 'hit', byParty: false, target: null, amount: dmg } });
                        if (targetSummon.hp <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.summon_destroyed', params: { summon: companionRef(targetSummon) } }, 'danger',
                                { fx: { kind: 'summon_end', summon: targetSummon.name } });
                            exp.summons.splice(exp.summons.indexOf(targetSummon), 1);
                        }
                    }
                    continue;
                }
                if (aliveSummons.length > 0 && Math.random() < 0.5) {
                    const targetSummon = aliveSummons[randInt(0, aliveSummons.length - 1)];
                    let dmg = enemy.damage + randInt(0, 2);
                    if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                    if (Math.random() < baseMissChance) {
                        this._addLog(exp, game, { key: 'msg.exp.foe_misses_companion', params: { foe: attackerLabel, target: companionRef(targetSummon) } }, 'combat',
                            { fx: { kind: 'miss', byParty: false, dodger: null } });
                    } else {
                        targetSummon.hp -= dmg;
                        this._addLog(exp, game, { key: 'msg.exp.foe_strikes_companion', params: { foe: attackerLabel, target: companionRef(targetSummon), dmg } }, 'combat',
                            { fx: { kind: 'hit', byParty: false, target: null, amount: dmg } });
                        if (targetSummon.hp <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.summon_slain', params: { summon: companionRef(targetSummon) } }, 'danger',
                                { fx: { kind: 'summon_end', summon: targetSummon.name } });
                            exp.summons.splice(exp.summons.indexOf(targetSummon), 1);
                        }
                    }
                    continue;
                }

                // War beasts draw some enemy fire away from the colonists (a defensive
                // perk of bringing one). Same 50% diversion chance as summons.
                const aliveBeasts = combat.beasts ? combat.beasts.filter(b => b.hp > 0) : [];
                if (aliveBeasts.length > 0 && Math.random() < 0.5) {
                    const targetBeast = aliveBeasts[randInt(0, aliveBeasts.length - 1)];
                    let dmg = enemy.damage + randInt(0, 2);
                    if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                    if (Math.random() < baseMissChance) {
                        this._addLog(exp, game, { key: 'msg.exp.foe_misses_companion', params: { foe: attackerLabel, target: companionRef(targetBeast) } }, 'combat',
                            { fx: { kind: 'miss', byParty: false, dodger: null } });
                    } else {
                        targetBeast.hp -= dmg;
                        this._addLog(exp, game, { key: 'msg.exp.foe_strikes_companion', params: { foe: attackerLabel, target: companionRef(targetBeast), dmg } }, 'combat',
                            { fx: { kind: 'hit', byParty: false, target: null, amount: dmg } });
                        if (targetBeast.hp <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.beast_fallen', params: { beast: companionRef(targetBeast) } }, 'danger');
                            if (exp.summary) {
                                if (!exp.summary.beastsDefeated) exp.summary.beastsDefeated = [];
                                if (!exp.summary.beastsDefeated.includes(targetBeast.name)) {
                                    exp.summary.beastsDefeated.push(targetBeast.name);
                                    // Types too, so the summary can name them in the active language.
                                    (exp.summary.beastsDefeatedTypes ||= []).push(targetBeast.type);
                                }
                            }
                        }
                    }
                    continue;
                }

                // Softmax-weighted target selection: enemies strongly favor the
                // highest-priority member but can occasionally strike lower-priority
                // ones. Priority = equipment targetPriority + formation modifier.
                const weighted = [];
                let maxPr = -Infinity;
                for (const p of alive) {
                    if (p.hp <= 0) continue;
                    const pr = this._threatOf(exp, p);
                    weighted.push({ member: p, pr });
                    if (pr > maxPr) maxPr = pr;
                }
                if (weighted.length === 0) break;
                // Subtract maxPr for numerical stability (top member weight = 1.0).
                const temp = EXPLORATION_CONFIG.targetingTemperature;
                let totalWeight = 0;
                for (const w of weighted) {
                    w.weight = Math.exp((w.pr - maxPr) / temp);
                    totalWeight += w.weight;
                }
                let roll = Math.random() * totalWeight;
                let target = weighted[weighted.length - 1].member;
                for (const w of weighted) {
                    roll -= w.weight;
                    if (roll <= 0) { target = w.member; break; }
                }

                if (target.dodgeCharges > 0) {
                    target.dodgeCharges--;
                    target._lastDodgeTick = game.tick;
                    this._addLog(exp, game, enemy.isBoss
                        ? { key: 'msg.exp.phases_through_boss', params: { name: target.name, boss: enemyNameRef(enemy) } }
                        : { key: 'msg.exp.phases_through', params: { name: target.name } }, 'combat', { fx: { kind: 'miss', byParty: false, dodger: target.name } });
                    continue;
                }
                const targetItems = [target.weapon, target.armor, target.helmet, target.clothes, target.boots, target.tool, target.trinket].filter(Boolean);
                let dodgeChance = targetItems.reduce((sum, it) => sum + (it.dodgeChance || 0), 0);
                dodgeChance += this._combatStatusValue(target, 'buff_dodgeChance', 'value', 0);
                dodgeChance = Math.min(0.75, dodgeChance);
                if (dodgeChance > 0 && Math.random() < dodgeChance) {
                    target._lastDodgeTick = game.tick;
                    this._addLog(exp, game, enemy.isBoss
                        ? { key: 'msg.exp.dodges_boss', params: { name: target.name, boss: enemyNameRef(enemy) } }
                        : { key: 'msg.exp.dodges', params: { name: target.name } }, 'combat', { fx: { kind: 'miss', byParty: false, dodger: target.name } });
                    continue;
                }

                let dmg = enemy.damage + randInt(0, 2);
                if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                if (enemy.isBoss && exp._voidPactBossDmgMult) dmg = Math.max(1, Math.floor(dmg * exp._voidPactBossDmgMult));
                // Track the damage before armor/shield mitigation so the visual layer
                // can tell a fully-absorbed "block" from a clean hit (see _lastBlockTick).
                const preMitigationDmg = dmg;
                let didMitigate = false;
                for (const item of targetItems) {
                    if (item.damageReduction) { dmg = Math.max(1, Math.floor(dmg * (1 - item.damageReduction))); didMitigate = true; }
                }
                if (target.shieldActive) { dmg = Math.max(1, Math.floor(dmg * (1 - target.shieldReduction))); didMitigate = true; }
                const formDmgTaken = this._applyFormationModifier(exp, target.id, 'damageTakenMult');
                dmg = Math.max(1, Math.floor(dmg * formDmgTaken));

                if (Math.random() < baseMissChance) {
                    const line = eventLine('combatMiss', randInt(0, EXPLORATION_EVENTS.combatMiss.length - 1), { attacker: attackerLabel, target: target.name });
                    this._addLog(exp, game, line, 'combat', { fx: { kind: 'miss', byParty: false, dodger: target.name } });
                } else {
                    target.hp -= dmg;
                    if (exp.summary) exp.summary.damageTaken[target.id] = (exp.summary.damageTaken[target.id] || 0) + dmg;
                    const line = eventLine('combatHit', randInt(0, EXPLORATION_EVENTS.combatHit.length - 1), { attacker: attackerLabel, target: target.name, dmg });
                    this._addLog(exp, game, line, 'combat', { fx: { kind: 'hit', byParty: false, target: target.name, amount: dmg } });
                    window.soundManager?.playExpSFX('colonist_damaged');
                    // Flag a "block" for the visual layer when armor/shield absorbed a
                    // meaningful chunk (>=25%) of the blow. This drives the brace-and-spark
                    // one-shot, distinct from a dodge (which avoids the hit entirely).
                    if (didMitigate && dmg <= preMitigationDmg * 0.75) target._lastBlockTick = game.tick;

                    // Thorns from equipment + mutators
                    let thorns = targetItems.reduce((sum, it) => sum + (it.thornsDamage || 0), 0) + globalThorns;
                    if (thorns > 0 && enemy.hp > 0) {
                        enemy.hp -= thorns;
                        this._addLog(exp, game, { key: 'msg.exp.thorns', params: { dmg: thorns } }, 'combat');
                        if (enemy.hp <= 0) {
                            this._addLog(exp, game, { key: 'msg.exp.thorns_kill', params: { foe: attackerLabel } }, 'success', { fx: { kind: 'kill', byParty: true } });
                            if (enemy.elite) { exp.eliteKills++; this._processEliteOnDeath(enemy, exp, game); }
                            this._processEnemyOnDeath(enemy, exp, game);
                        }
                    }

                    // Vampiric elite life steal
                    if (enemy.eliteLifeSteal && enemy.hp > 0) {
                        const stolen = Math.floor(dmg * enemy.eliteLifeSteal);
                        enemy.hp = Math.min(enemy.maxHp, enemy.hp + stolen);
                    }

                    if (target.hp <= 0) {
                        this._checkExpeditionRevive(exp, target, game);
                    }
                }
            } // end single-attack block
        }

        // -- Boss phase check --
        this._updateBossPhase(exp, game);

        if (combat.enemies.every(e => e.hp <= 0) || alive.every(p => p.hp <= 0)) {
            this._finishCombat(exp, game);
        }
    }

    // Effective mana cost after the member's equipment spellCostReduction, mirroring
    // the colony-side calc in colonist.js (floor, min 1). All expedition cast paths
    // deduct through this so Ley Battery et al. discount spells on expeditions too.
    _spellManaCost(member, spell) {
        const gearReduction = member.spellCostReduction || 0;
        const potionReduction = this._combatStatusValue(member, 'buff_spellCostReduction', 'value', 0);
        const levelReduction = expeditionCostReduction(member, spell);
        const mult = Math.max(0, (1 - levelReduction) * (1 - gearReduction) * (1 - potionReduction));
        return Math.max(1, Math.floor(spell.manaCost * mult));
    }

    _canCastSpell(member, spellKey, game) {
        const spell = SPELLS[spellKey];
        if (!spell) return false;
        if (member.mana < this._spellManaCost(member, spell)) return false;
        const lastCast = member.spellCooldowns[spellKey] || 0;
        const effectiveCd = spell.cooldown * getSpellCooldownMult(game) * expeditionCooldownFactor(member, spell);
        if (game.tick - lastCast < effectiveCd) return false;
        return true;
    }

    _tryCombatSpells(exp, game, alive, combat) {
        // buff_speed and buff_inspire have trigger:'hasTask' in colony but are
        // meaningful in combat. Expedition fighting is the only task, so allow them.
        const combatBuffEffects = new Set(['buff_speed', 'buff_inspire']);
        for (const member of alive) {
            if (member.hp <= 0 || member.knownSpells.length === 0) continue;

            for (const spellKey of member.knownSpells) {
                const spell = SPELLS[spellKey];
                if (!spell || (spell.trigger !== 'inCombat' && !combatBuffEffects.has(spell.effect))) continue;
                if (!this._canCastSpell(member, spellKey, game)) continue;

                const dmgEffects = ['ranged_damage', 'ranged_damage_aoe', 'melee_damage', 'chain_damage', 'ranged_damage_slow'];
                if (dmgEffects.includes(spell.effect)) {
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const schoolBonus = (member.schoolBonuses && member.schoolBonuses[spell.school]) || member.spellDamageBonus || 0;
                    let dmg = Math.floor(spell.damage * expeditionSpellPower(member, spell) * (1 + schoolBonus));
                    dmg = Math.floor(dmg * this._getMutatorEffect(exp, 'spellDamageMult') * this._applyFormationModifier(exp, member.id, 'spellDamageMult'));
                    if (spell.effect === 'ranged_damage_aoe') {
                        // Expedition combat is abstract (no tile positions), so an AoE
                        // spell hits up to `radius * 2` foes instead of everything in a
                        // physical blast. Falls back to 1 if radius is unset.
                        const maxHits = (spell.radius || 1) * 2;
                        const targets = combat.enemies.filter(e => e.hp > 0).slice(0, maxHits);
                        for (const t of targets) {
                            t.hp -= dmg;
                        }
                        this._addLog(exp, game, { key: 'msg.exp.cast_aoe', params: { name: member.name, spell: defRef(spell), n: targets.length, dmg } }, 'combat',
                            { fx: { kind: 'cast', caster: member.name, effect: 'damage', school: spell.school, amount: dmg, area: false } });
                        game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                        window.soundManager?.playExpSFX('spell_cast');
                        for (const t of targets) {
                            if (t.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.blast_kill_enemy' }, 'success', { fx: { kind: 'kill', byParty: true } }); this._processEnemyOnDeath(t, exp, game); }
                        }
                    } else if (spell.effect === 'chain_damage') {
                        // Arc across up to chainTargets foes, losing chainFalloff of the
                        // damage each hop. Position-less expedition combat picks the next
                        // living foe in order rather than by distance.
                        const foes = combat.enemies.filter(e => e.hp > 0).slice(0, spell.chainTargets || 1);
                        let hopDmg = dmg;
                        let hitCount = 0;
                        for (const t of foes) {
                            const applied = Math.max(1, Math.floor(hopDmg));
                            t.hp -= applied;
                            hitCount++;
                            if (t.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.chain_kill', params: { name: member.name, spell: defRef(spell) } }, 'success', { fx: { kind: 'kill', byParty: true } }); this._processEnemyOnDeath(t, exp, game); }
                            hopDmg *= (spell.chainFalloff || 0.6);
                        }
                        this._addLog(exp, game, { key: 'msg.exp.cast_chain', params: { name: member.name, spell: defRef(spell), n: hitCount } }, 'combat',
                            { fx: { kind: 'cast', caster: member.name, effect: 'damage', school: spell.school, amount: null, area: false } });
                        game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                        window.soundManager?.playExpSFX('spell_cast');
                    } else {
                        const target = combat.enemies.find(e => e.hp > 0);
                        if (target) {
                            target.hp -= dmg;
                            this._addLog(exp, game, { key: 'msg.exp.cast_bolt', params: { name: member.name, spell: defRef(spell), dmg } }, 'combat',
                                { fx: { kind: 'cast', caster: member.name, effect: 'damage', school: spell.school, amount: dmg, area: false } });
                            game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                            window.soundManager?.playExpSFX('spell_cast');
                            // Frost Lance et al. slow the struck foe for a couple of rounds.
                            if (spell.effect === 'ranged_damage_slow' && target.hp > 0) {
                                this._applyCombatStatus(target, 'slow', spell.slowRounds || 2, { mult: spell.slowMult || 0.5 });
                                this._addLog(exp, game, { key: 'msg.exp.frost_slow' }, 'combat');
                            }
                            if (target.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.spell_kill', params: { name: member.name } }, 'success', { fx: { kind: 'kill', byParty: true } }); this._processEnemyOnDeath(target, exp, game); }
                        }
                    }
                    break;
                } else if (spell.effect === 'teleport') {
                    if (member.dodgeCharges > 0) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const charges = spell.range >= 15 ? 3 : spell.range >= 10 ? 2 : 1;
                    member.dodgeCharges = (member.dodgeCharges || 0) + charges;
                    this._addLog(exp, game, { key: 'msg.exp.cast_phase', params: { name: member.name, spell: defRef(spell) } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'phase', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_teleport');
                    break;
                } else if (spell.effect === 'buff_defense' || spell.effect === 'absorb_shield') {
                    // Who's covered follows spell.expeditionTarget (see _buffTargets):
                    // Shield guards the tank, Guardian Ward the whole party.
                    const targets = this._buffTargets(exp, member, spell, alive, p => !p.shieldActive);
                    if (targets.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    // Guardian Ward's flat absorb pool reads as a 50% reduction here.
                    const reduction = spell.effect === 'absorb_shield' ? 0.5 : Math.min(0.75, spell.damageReduction * expeditionSpellPower(member, spell));
                    for (const t of targets) {
                        t.shieldActive = true;
                        t.shieldExpiresTick = game.tick + (spell.duration || 60);
                        t.shieldReduction = reduction;
                    }
                    this._addLog(exp, game, this._buffMessage('msg.exp.cast_shield', member, spell, targets), 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'shield', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_shield');
                    break;
                } else if (spell.effect === 'summon') {
                    if (!exp.summons) exp.summons = [];
                    if (this._freeSummonSlots(exp) <= 0) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const st = this._summonStats(member, spell, summonDef);
                    exp.summons.push({
                        type: spell.summonType,
                        name: summonDef.name,
                        hp: st.hp,
                        maxHp: st.hp,
                        damage: st.damage,
                        char: summonDef.char,
                        color: summonDef.color,
                        ownerId: member.id,
                        ticksRemaining: st.duration,
                        maxDuration: st.duration,
                    });
                    if (!this.summonsSeen.has(spell.summonType)) {
                        const entityDef = ENTITIES[spell.summonType];
                        this.summonsSeen.set(spell.summonType, { name: summonDef.name, char: entityDef?.char || summonDef.char || '?', color: summonDef.color || '#9966ff', sprite: spell.summonType, lore: entityDef?.lore || '' });
                    }
                    this._addLog(exp, game, { key: 'msg.exp.summons', params: { name: member.name, summon: entityRef(spell.summonType) } }, 'combat',
                        { fx: { kind: 'summon', caster: member.name } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('summon_arrival');
                    break;
                } else if (spell.effect === 'summon_swarm') {
                    if (!exp.summons) exp.summons = [];
                    // The swarm fills whatever room the party's summon pool has, and
                    // isn't worth its mana for a lone wisp.
                    const free = this._freeSummonSlots(exp);
                    if (free < Math.min(2, spell.swarmCount || 3)) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const count = Math.min(spell.swarmCount || 3, free);
                    const st = this._summonStats(member, spell, summonDef);
                    for (let n = 0; n < count; n++) {
                        exp.summons.push({
                            type: spell.summonType,
                            name: summonDef.name,
                            hp: st.hp,
                            maxHp: st.hp,
                            damage: st.damage,
                            char: summonDef.char,
                            color: summonDef.color,
                            ownerId: member.id,
                            ticksRemaining: st.duration,
                            maxDuration: st.duration,
                        });
                    }
                    if (!this.summonsSeen.has(spell.summonType)) {
                        const entityDef = ENTITIES[spell.summonType];
                        this.summonsSeen.set(spell.summonType, { name: summonDef.name, char: entityDef?.char || summonDef.char || '?', color: summonDef.color || '#9966ff', sprite: spell.summonType, lore: entityDef?.lore || '' });
                    }
                    this._addLog(exp, game, { key: 'msg.exp.summon_swarm', params: { name: member.name, n: count, summon: entityRef(spell.summonType) } }, 'combat',
                        { fx: { kind: 'summon', caster: member.name } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('summon_arrival');
                    break;
                } else if (spell.effect === 'stun') {
                    // Mesmerize: stun the most dangerous foes (boss first, then the
                    // hardest hitters) for a round. Mastery catches one more foe
                    // every 3 levels over the spell's minimum.
                    const count = (spell.chainTargets || 1) + Math.floor(this._levelsOver(member, spell) / 3);
                    const foes = this._dangerousFoes(combat).slice(0, count);
                    if (foes.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    for (const t of foes) this._applyCombatStatus(t, 'stun', spell.stunRounds || 1);
                    this._addLog(exp, game, foes.length === 1
                        ? { key: 'msg.exp.cast_stun_one', params: { name: member.name, spell: defRef(spell), target: foeOrBoss(foes[0]) } }
                        : { key: 'msg.exp.cast_stun_many', params: { name: member.name, spell: defRef(spell), n: foes.length } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    break;
                } else if (spell.effect === 'dot_burn') {
                    const target = combat.enemies.find(e => e.hp > 0);
                    if (!target) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    this._applyCombatStatus(target, 'burn', spell.burnRounds || 3, { damage: spell.damage || 4 });
                    this._addLog(exp, game, { key: 'msg.exp.cast_burn', params: { name: member.name, spell: defRef(spell) } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    break;
                } else if (spell.effect === 'ranged_damage_hex') {
                    const target = combat.enemies.find(e => e.hp > 0);
                    if (!target) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const schoolBonus = (member.schoolBonuses && member.schoolBonuses[spell.school]) || member.spellDamageBonus || 0;
                    let hexDmg = Math.floor(spell.damage * expeditionSpellPower(member, spell) * (1 + schoolBonus));
                    hexDmg = Math.floor(hexDmg * this._getMutatorEffect(exp, 'spellDamageMult'));
                    target.hp -= hexDmg;
                    this._applyCombatStatus(target, 'vulnerable', spell.hexRounds || 3, { damageMult: spell.hexDamageMult || 1.2 });
                    this._addLog(exp, game, { key: 'msg.exp.cast_hex', params: { name: member.name, spell: defRef(spell), dmg: hexDmg } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'damage', school: spell.school, amount: hexDmg, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    if (target.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.spell_kill', params: { name: member.name } }, 'success', { fx: { kind: 'kill', byParty: true } }); this._processEnemyOnDeath(target, exp, game); }
                    break;
                } else if (spell.effect === 'knockback') {
                    const target = combat.enemies.find(e => e.hp > 0);
                    if (!target) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const schoolBonus = (member.schoolBonuses && member.schoolBonuses[spell.school]) || member.spellDamageBonus || 0;
                    let kbDmg = Math.floor(spell.damage * expeditionSpellPower(member, spell) * (1 + schoolBonus));
                    target.hp -= kbDmg;
                    this._applyCombatStatus(target, 'stun', spell.stunRounds || 1);
                    this._addLog(exp, game, { key: 'msg.exp.cast_knockback', params: { name: member.name, spell: defRef(spell), dmg: kbDmg } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'damage', school: spell.school, amount: kbDmg, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    if (target.hp <= 0) { this._addLog(exp, game, { key: 'msg.exp.blast_kill_foe' }, 'success', { fx: { kind: 'kill', byParty: true } }); this._processEnemyOnDeath(target, exp, game); }
                    break;
                } else if (spell.effect === 'buff_defense_self' && !member.shieldActive) {
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    member.shieldActive = true;
                    member.shieldExpiresTick = game.tick + (spell.duration || 60);
                    member.shieldReduction = Math.min(0.75, spell.damageReduction * expeditionSpellPower(member, spell));
                    this._addLog(exp, game, { key: 'msg.exp.cast_steel', params: { name: member.name, spell: defRef(spell) } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'shield', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_shield');
                    break;
                } else if (spell.effect === 'debuff_accuracy') {
                    const target = combat.enemies.find(e => e.hp > 0);
                    if (!target) continue;
                    if (this._hasCombatStatus(target, 'weaken')) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    this._applyCombatStatus(target, 'weaken', spell.weakenRounds || 3, { mult: spell.weakenMult || 0.7 });
                    this._addLog(exp, game, { key: 'msg.exp.cast_omen', params: { name: member.name, spell: defRef(spell) } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    break;
                } else if (spell.effect === 'buff_miss_chance') {
                    // Misdirection on the tank (spell.expeditionTarget): dodge charges
                    // that grow with Enchantment mastery.
                    const targets = this._buffTargets(exp, member, spell, alive, p => !(p.dodgeCharges > 0));
                    if (targets.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    const charges = Math.max(1, Math.round((spell.dodgeBonus || 0.25) * 8 * expeditionSpellPower(member, spell)));
                    for (const t of targets) t.dodgeCharges = (t.dodgeCharges || 0) + charges;
                    this._addLog(exp, game, this._buffMessage('msg.exp.cast_misdirection', member, spell, targets), 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                } else if (spell.effect === 'convert_enemy') {
                    // Spellbind holds the most dangerous foe; +1 round per 3 levels
                    // of mastery over the spell's minimum.
                    const target = this._dangerousFoes(combat)[0];
                    if (!target) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    const rounds = (spell.bindRounds || 2) + Math.floor(this._levelsOver(member, spell) / 3);
                    this._applyCombatStatus(target, 'stun', rounds);
                    this._addLog(exp, game, target.isBoss
                        ? { key: 'msg.exp.cast_bind_boss', params: { name: member.name, spell: defRef(spell), boss: enemyNameRef(target) } }
                        : { key: 'msg.exp.cast_bind', params: { name: member.name, spell: defRef(spell) } }, 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                } else if (spell.effect === 'summon_decoy') {
                    if (!exp.summons) exp.summons = [];
                    if (this._freeSummonSlots(exp) <= 0) continue;
                    if (exp.summons.some(s => s.ownerId === member.id && s.type === 'decoy' && s.hp > 0)) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    exp.summons.push({ type: 'decoy', name: summonDef.name, hp: summonDef.hp, maxHp: summonDef.hp, damage: 0, char: summonDef.char, color: summonDef.color, ownerId: member.id, ticksRemaining: summonDef.duration, maxDuration: summonDef.duration, threatMult: summonDef.threatMult || 5 });
                    if (!this.summonsSeen.has('decoy')) {
                        const entityDef = ENTITIES['decoy'];
                        this.summonsSeen.set('decoy', { name: summonDef.name, char: entityDef?.char || summonDef.char || '?', color: summonDef.color || '#9966ff', sprite: 'decoy', lore: entityDef?.lore || '' });
                    }
                    this._addLog(exp, game, { key: 'msg.exp.cast_decoy', params: { name: member.name } }, 'combat',
                        { fx: { kind: 'summon', caster: member.name } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('summon_arrival');
                    break;
                } else if (spell.effect === 'buff_speed' && spell.expeditionAttackSpeed) {
                    // Haste: the party (radius) swings faster for a few rounds.
                    const targets = this._buffTargets(exp, member, spell, alive, p => !this._hasCombatStatus(p, 'buff_attackSpeed'));
                    if (targets.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    const value = spell.expeditionAttackSpeed * expeditionSpellPower(member, spell);
                    for (const t of targets) this._applyCombatStatus(t, 'buff_attackSpeed', spell.expeditionRounds || 6, { value });
                    this._addLog(exp, game, this._buffMessage('msg.exp.cast_haste', member, spell, targets), 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                } else if (spell.effect === 'buff_speed') {
                    // Quicken: no positional movement in expedition combat, so speed
                    // becomes agility, dodge charges for the party (radius) that grow
                    // with Enchantment mastery.
                    const targets = this._buffTargets(exp, member, spell, alive, p => !(p.dodgeCharges > 0));
                    if (targets.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    const charges = Math.max(1, Math.round((Math.round((spell.workSpeedBonus || 0.2) * 5) + 1) * expeditionSpellPower(member, spell)));
                    for (const t of targets) t.dodgeCharges = (t.dodgeCharges || 0) + charges;
                    this._addLog(exp, game, this._buffMessage('msg.exp.cast_quicken', member, spell, targets), 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                } else if (spell.effect === 'buff_inspire') {
                    // Inspire: a damage multiplier for the party (radius) for a few
                    // rounds, stronger with mastery. The quality bonus has no
                    // expedition equivalent.
                    const targets = this._buffTargets(exp, member, spell, alive, p => !this._hasCombatStatus(p, 'inspired'));
                    if (targets.length === 0) continue;
                    this._payForSpell(member, spellKey, spell, game);
                    const dmgMult = 1 + (spell.workSpeedBonus || 0.3) * expeditionSpellPower(member, spell);
                    for (const t of targets) this._applyCombatStatus(t, 'inspired', spell.inspireRounds || 3, { dmgMult });
                    this._addLog(exp, game, this._buffMessage('msg.exp.cast_inspire', member, spell, targets), 'combat',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                }
            }
        }
    }

    // `skip(member)` lets the combat loop hold back members who already acted this tick.
    _tryHealSpells(exp, game, skip = null) {
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        for (const member of alive) {
            if (member.knownSpells.length === 0) continue;
            if (skip && skip(member)) continue;

            for (const spellKey of member.knownSpells) {
                const spell = SPELLS[spellKey];
                if (!spell) continue;

                if (spell.effect === 'heal') {
                    const threshold = spell.hpThreshold || 0.5;
                    // Heals mend the most-wounded party member below thresholdm which may
                    // be the caster themselves or any ally (expedition combat is abstract,
                    // so range isn't modelled). No wounded member means no cast.
                    const target = alive
                        .filter(p => p.hp / p.maxHp < threshold)
                        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
                    if (!target) continue;
                    if (!this._canCastSpell(member, spellKey, game)) continue;

                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const healPower = spell.healAmount * expeditionSpellPower(member, spell) * (1 + (member.spellHealBonus || 0));
                    const healed = Math.min(Math.round(healPower), target.maxHp - target.hp);
                    target.hp += healed;
                    this._addLog(exp, game, target === member
                        ? { key: 'msg.exp.cast_heal_self', params: { name: member.name, spell: defRef(spell), amount: healed } }
                        : { key: 'msg.exp.cast_heal', params: { name: member.name, spell: defRef(spell), target: target.name, amount: healed } }, 'success',
                        { fx: { kind: 'cast', caster: member.name, effect: 'heal', school: spell.school, amount: healed, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_heal');
                    break;
                } else if (spell.effect === 'chain_heal') {
                    const threshold = spell.hpThreshold || 0.7;
                    // Bounce heal: mend up to chainTargets most-wounded allies below
                    // threshold, losing chainFalloff of the potency per hop.
                    const wounded = alive
                        .filter(p => p.hp / p.maxHp < threshold && p.hp < p.maxHp)
                        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
                        .slice(0, spell.chainTargets || 1);
                    if (wounded.length === 0) continue;
                    if (!this._canCastSpell(member, spellKey, game)) continue;

                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    let power = spell.healAmount * expeditionSpellPower(member, spell) * (1 + (member.spellHealBonus || 0));
                    let total = 0;
                    for (const t of wounded) {
                        const healed = Math.min(Math.round(power), t.maxHp - t.hp);
                        t.hp += healed;
                        total += healed;
                        if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healed;
                        power *= (spell.chainFalloff || 0.6);
                    }
                    this._addLog(exp, game, { key: 'msg.exp.cast_chain_heal', params: { name: member.name, spell: defRef(spell), n: wounded.length, amount: total } }, 'success',
                        { fx: { kind: 'cast', caster: member.name, effect: 'heal', school: spell.school, amount: total, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_heal');
                    break;
                } else if (spell.effect === 'heal_aura') {
                    const threshold = spell.hpThreshold || 0.8;
                    const wounded = alive.filter(p => p.hp / p.maxHp < threshold && p.hp < p.maxHp);
                    if (wounded.length === 0) continue;
                    if (!this._canCastSpell(member, spellKey, game)) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const healPerTarget = spell.healPerRound || 4;
                    let total = 0;
                    for (const t of wounded) {
                        const healed = Math.min(healPerTarget, t.maxHp - t.hp);
                        t.hp += healed;
                        total += healed;
                        if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healed;
                    }
                    this._addLog(exp, game, { key: 'msg.exp.cast_heal_aura', params: { name: member.name, spell: defRef(spell), n: wounded.length, amount: total } }, 'success',
                        { fx: { kind: 'cast', caster: member.name, effect: 'heal', school: spell.school, amount: total, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_heal');
                    break;
                } else if (spell.effect === 'cleanse') {
                    // Strip harmful effects from the most-afflicted ally. Checks both
                    // exp.activeEffects (trap/env DoTs between encounters) and the
                    // in-combat statusEffects array written by _applyCombatStatus().
                    const harmfulStatusTypes = new Set(['burn', 'poison', 'slow', 'weaken', 'vulnerable']);
                    const afflicted = alive
                        .map(p => ({
                            p,
                            n: (exp.activeEffects || []).filter(e => e.targetId === p.id && e.type === 'dot').length
                              + (p.statusEffects || []).filter(e => harmfulStatusTypes.has(e.type)).length,
                        }))
                        .filter(x => x.n > 0)
                        .sort((a, b) => b.n - a.n)[0];
                    if (!afflicted) continue;
                    if (!this._canCastSpell(member, spellKey, game)) continue;

                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    exp.activeEffects = (exp.activeEffects || []).filter(e => !(e.targetId === afflicted.p.id && e.type === 'dot'));
                    afflicted.p.statusEffects = (afflicted.p.statusEffects || []).filter(e => !harmfulStatusTypes.has(e.type));
                    afflicted.p._lastCleanseTick = game.tick;
                    this._addLog(exp, game, { key: 'msg.exp.cast_cleanse', params: { name: member.name, spell: defRef(spell), target: afflicted.p.name } }, 'success',
                        { fx: { kind: 'cast', caster: member.name, effect: 'other', school: spell.school, amount: null, area: false } });
                    game.eventLog.add(game, { key: 'msg.exp.cast_event', params: { name: member.name, spell: defRef(spell), mp: spell.manaCost } }, 'info', null);
                    window.soundManager?.playExpSFX('spell_buff');
                    break;
                }
            }
        }
    }

    // How strongly enemies want to hit `p`: gear targetPriority plus the row's
    // modifier. Enemy targeting and tank-targeted buffs both read this.
    _threatOf(exp, p) {
        const formPriority = this._applyFormationModifier(exp, p.id, 'targetPriorityMod');
        return getTargetPriority(p) + (formPriority !== 1.0 ? formPriority : 0);
    }

    // Who a party buff lands on, by spell.expeditionTarget: 'self', 'party', or
    // 'tank' (the member enemies most want to hit; ties go to the most wounded).
    // Without the field, a spell with a colony radius covers the party and one
    // without covers the caster. `eligible(p)` excludes members already buffed.
    _buffTargets(exp, member, spell, alive, eligible) {
        const mode = spell.expeditionTarget || (spell.radius ? 'party' : 'self');
        if (mode === 'self') return member.hp > 0 && eligible(member) ? [member] : [];
        const living = alive.filter(p => p.hp > 0);
        if (mode === 'party') return living.filter(eligible);
        const top = Math.max(...living.map(p => this._threatOf(exp, p)));
        const tank = living
            .filter(p => this._threatOf(exp, p) === top && eligible(p))
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        return tank ? [tank] : [];
    }

    // Log line for a party buff, by who it covers: `<key>_party`, `<key>_self`
    // (the caster) or `<key>_ally` (one other member, as `target`).
    _buffMessage(key, member, spell, targets) {
        const params = { name: member.name, spell: defRef(spell) };
        if (targets.length > 1) return { key: `${key}_party`, params };
        if (targets[0] === member) return { key: `${key}_self`, params };
        return { key: `${key}_ally`, params: { ...params, target: targets[0].name } };
    }

    // Living, un-stunned foes, most dangerous first: the boss, then by damage.
    _dangerousFoes(combat) {
        return combat.enemies
            .filter(e => e.hp > 0 && !this._hasCombatStatus(e, 'stun'))
            .sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0) || (b.damage || 0) - (a.damage || 0));
    }

    // School levels the caster has above the spell's minimum.
    _levelsOver(member, spell) {
        return Math.max(0, (member.magicSkills?.[spell.school] || 0) - (spell.minLevel || 0));
    }

    // Spend a spell's mana and start its cooldown.
    _payForSpell(member, spellKey, spell, game) {
        member.mana -= this._spellManaCost(member, spell);
        member.spellCooldowns[spellKey] = game.tick;
        member._lastCastTick = game.tick;
    }

    // A summon's stats as cast by `member`: base SUMMON_TYPES stats scaled by the
    // caster's Conjuration mastery (same per-level power as damage spells) and by
    // summon gear (summonHpBonus / summonDamageBonus / summonDurationBonus).
    _summonStats(member, spell, summonDef) {
        const items = [member.weapon, member.armor, member.helmet, member.clothes, member.boots, member.tool, member.trinket].filter(Boolean);
        const gear = key => 1 + items.reduce((s, it) => s + (it[key] || 0), 0);
        const power = expeditionSpellPower(member, spell);
        return {
            hp: Math.round(summonDef.hp * power * gear('summonHpBonus')),
            damage: Math.round(summonDef.damage * power * gear('summonDamageBonus')),
            duration: Math.round(summonDef.duration * gear('summonDurationBonus')),
        };
    }

    // Room left in the party's shared summon pool (EXPLORATION_CONFIG.maxPartySummons).
    // Anything a party member conjured counts, from any caster; allies granted by
    // encounters (ownerId null) don't.
    _freeSummonSlots(exp) {
        const used = (exp.summons || []).filter(s => s.hp > 0 && s.ownerId != null).length;
        return (EXPLORATION_CONFIG.maxPartySummons ?? 3) - used;
    }

    // Shield, Fortify and Guardian Ward last their spell `duration` in ticks, as in
    // the colony, rather than for the rest of the fight. The spell's cooldown is
    // longer than its duration, so a caster cannot keep one up permanently.
    _expireShields(exp, game) {
        for (const member of exp.partySnapshot) {
            if (member.shieldActive && member.shieldExpiresTick != null && game.tick >= member.shieldExpiresTick) {
                member.shieldActive = false;
                member.shieldReduction = 0;
                member.shieldExpiresTick = null;
                if (member.hp > 0) this._addLog(exp, game, { key: 'msg.exp.shield_fades', params: { name: member.name } }, 'info');
            }
        }
    }

    _regenMana(exp, game) {
        if (game.tick % 10 !== 0) return;
        const regenMult = this._getRealmEventEffect(exp, 'manaRegenMult');
        // This runs once per 10 ticks. Equipment manaRegen/healthRegen are per-tick
        // magnitudes (as applied in the colony loops), so scale them by 10 to match
        // this cadence. Mana keeps its flat baseline of 1/interval on top.
        for (const member of exp.partySnapshot) {
            if (member.hp <= 0) continue;
            if (member.mana < member.maxMana) {
                // Fractional, like the colony's per-tick regen: rounding here made
                // small regen gear (+0.03) worth nothing and +0.06 worth double.
                const manaGain = (1 + (member.manaRegen || 0) * 10) * (member.manaRegenMult || 1) * regenMult;
                member.mana = Math.min(member.maxMana, member.mana + manaGain);
            }
            if (member.healthRegen && member.hp < member.maxHp) {
                member.hp = Math.min(member.maxHp, member.hp + member.healthRegen * 10);
            }
        }
    }

    _finishCombat(exp, game) {
        const survived = exp.partySnapshot.filter(p => p.hp > 0).length;
        if (survived > 0) {
            const dim = REALMS[exp.realm];
            const streakMult = exp.streakMultiplier || 1.0;
            // Passing exp.realm lets realmBonus traits (e.g. Green Thumb) contribute
            // their realm-specific lootMult. Items + flat traits + realmBonus, once.
            const lootMult = getPartyExpeditionEffect(exp.partySnapshot, 'lootMult', exp.realm)
                * streakMult * (exp.potionLootBoosts?.lootMult || 1) * getExpeditionLuckBonus(game);
            const lootBonusFlat = this._getMutatorEffect(exp, 'lootBonusFlat');
            const lootAmountMutMult = this._getMutatorEffect(exp, 'lootAmountMult')
                * this._getRealmEventEffect(exp, 'lootAmountMult');

            if (exp.combat.isBoss && dim.boss) {
                const boss = dim.boss;
                this._addLog(exp, game, defMessage(boss, 'defeatText'), 'success');
                if (!exp.loot._items) exp.loot._items = [];
                for (const lootEntry of boss.guaranteedLoot) {
                    if (Math.random() < lootEntry.chance) {
                        exp.loot._items.push(lootEntry.item);
                        this._addLog(exp, game, { key: 'msg.exp.found_item', params: { item: resourceRef(lootEntry.item) } }, 'loot', { itemKey: lootEntry.item });
                        break;
                    }
                }
                for (const [res, amt] of Object.entries(boss.bonusResources)) {
                    const boosted = Math.floor(amt * lootAmountMutMult * this._realmResourceMult(exp, res)) + lootBonusFlat;
                    exp.loot[res] = (exp.loot[res] || 0) + boosted;
                    this._addLog(exp, game, { key: 'msg.exp.boss_resource', params: { amount: boosted, resource: resourceRef(res) } }, 'loot', { itemKey: res });
                }
                this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerBossKill);
                this._awardAnimalExpeditionXP(exp, ANIMAL_XP_CONFIG.xpPerBossKill);
            }

            // Elite loot bonus
            let eliteLootMult = exp._nextRareMult || 1.0;
            if (exp._nextRareMult) exp._nextRareMult = null;
            for (const enemy of exp.combat.enemies) {
                if (enemy.hp <= 0 && enemy.elite) {
                    const mod = ELITE_MODIFIERS[enemy.elite];
                    if (mod?.lootBonusMult) eliteLootMult = Math.max(eliteLootMult, mod.lootBonusMult);
                }
            }

            const dsCombat = exp.diffSettings || EXPEDITION_DIFFICULTY[1];
            const lootEntry = this._rollLoot(dim, dsCombat);
            if (lootEntry) {
                if (lootEntry.item) {
                    if (!exp.loot._items) exp.loot._items = [];
                    exp.loot._items.push(lootEntry.item);
                    this._addLog(exp, game, { key: 'msg.exp.victory_item', params: { item: resourceRef(lootEntry.item) } }, 'success');
                } else {
                    const resMult = this._realmResourceMult(exp, lootEntry.resource);
                    const amount = Math.floor(lootEntry.amount * lootMult * eliteLootMult * lootAmountMutMult * resMult) + lootBonusFlat;
                    exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                    this._addLog(exp, game, { key: 'msg.exp.victory_resource', params: { amount, resource: resourceRef(lootEntry.resource) } }, 'success');
                }
                window.soundManager?.playExpSFX('loot_drop');
            }
        } else {
            this._addLog(exp, game, { key: 'msg.exp.overwhelmed' }, 'danger');
            window.soundManager?.playExpSFX('mental_break');
        }
        for (const member of exp.partySnapshot) {
            member.shieldActive = false;
            member.shieldReduction = 0;
            // Combat status effects are round-scoped: clear them so poison/slow/etc.
            // never carry between encounters. Rest-of-expedition statuses (e.g. the
            // altar's void_drained) stay. (Enemies are discarded with exp.combat.)
            this._clearCombatStatuses(member, st => st.expiresWithExpedition);
            if (member._disabledSlots) {
                for (const slot of Object.keys(member._disabledSlots)) {
                    member._disabledSlots[slot]--;
                    if (member._disabledSlots[slot] <= 0) delete member._disabledSlots[slot];
                }
            }
        }

        if (exp.nodeMap) {
            const node = exp.nodeMap.find(n => n.encounterIndex === exp.combat.encounterIndex);
            if (node) node.completed = true;
            const bossNode = exp.nodeMap.find(n => n.type === 'boss' && exp.combat.isBoss);
            if (bossNode) bossNode.completed = true;
        }

        if (exp._tempDamageBuffCombats && exp._tempDamageBuffCombats > 0) {
            exp._tempDamageBuffCombats--;
            if (exp._tempDamageBuffCombats <= 0) exp._tempDamageMult = 1.0;
        }

        exp.combat = null;
        exp.nextEncounterTick = game.tick + Math.floor(exp.duration * EXPLORATION_CONFIG.encounterSpacing);
    }

    _completeExpedition(exp, game) {
        exp.status = 'complete';
        // Stamp so the visualizer can droop a brief weariness glyph over survivors as
        // the party returns (fatigue cooldowns are assigned just below).
        exp._fatigueAppliedTick = game.tick;

        const allDefeated = exp.partySnapshot.every(p => p.hp <= 0);
        if (!allDefeated && !exp.manualRetreat) {
            this.completedRealms.add(exp.realm);
            game.story.checkMilestone(`realm_${exp.realm}`, game);
            if (game.stats) game.stats.expeditionsCompleted++;
            checkColonyMilestones(game);
        }
        const returnPos = this._returnPos(exp, game);
        const gx = returnPos ? returnPos.x : null;
        const gy = returnPos ? returnPos.y : null;

        const fatigueTicks = this._calculateFatigueCooldown(exp);
        for (const snapshot of exp.partySnapshot) {
            const colonist = game.getColonist(snapshot.id);
            if (!colonist) continue;
            colonist.onExpedition = false;
            // Died in the colony while away (e.g. at the gate): stays dead.
            if (colonist.state === 'dead') continue;
            // Switch back to Colony gear set on return.
            if (colonist.equipmentSets?.Colony && colonist.activeSet !== 'Colony') {
                game.switchEquipmentSet(colonist.id, 'Colony');
            }
            // Reappear at the Gathering Circle (or the anchor if it's gone).
            if (gx !== null && gy !== null) {
                colonist.x = gx;
                colonist.y = gy;
            }
            if (snapshot.hp <= 0) {
                colonist.hp = 1;
            } else {
                colonist.hp = Math.min(colonist.maxHp, snapshot.hp);
            }
            colonist.mana = Math.min(colonist.maxMana, snapshot.mana);
            colonist.state = 'idle';

            let personalFatigue = fatigueTicks;
            if (colonist.traits) {
                for (const traitKey of colonist.traits) {
                    const t = TRAITS[traitKey];
                    if (t?.expedition?.fatigueMult) personalFatigue = Math.floor(personalFatigue * t.expedition.fatigueMult);
                }
            }
            const xpFatigueMult = this._getXpLevelBonus(snapshot.id, 'fatigueMult');
            if (xpFatigueMult !== 1) personalFatigue = Math.floor(personalFatigue * xpFatigueMult);
            if (snapshot.hp <= 0) personalFatigue = Math.floor(personalFatigue * FATIGUE_CONFIG.defeatPenalty);
            this.fatigueCooldowns[snapshot.id] = game.tick + Math.min(personalFatigue, FATIGUE_CONFIG.maxCooldownTicks);

            const xpData = this.expeditionXP[snapshot.id] || { xp: 0, level: 0 };
            const earned = exp.xpEarned[snapshot.id] || 0;
            xpData.xp += earned;
            let needed = EXPEDITION_XP_CONFIG.xpToLevel + xpData.level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
            while (xpData.xp >= needed && xpData.level < EXPEDITION_XP_CONFIG.maxLevel) {
                xpData.xp -= needed;
                xpData.level++;
                this._addLog(exp, game, { key: 'msg.exp.adventurer_level', params: { name: snapshot.name, level: xpData.level } }, 'success');
                window.soundManager?.playExpSFX('magic_levelup');
                needed = EXPEDITION_XP_CONFIG.xpToLevel + xpData.level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
            }
            this.expeditionXP[snapshot.id] = xpData;
        }

        // Animal leveling: award XP and level up pack animals and war beasts.
        for (const animalSnap of [...(exp.packAnimals || []), ...(exp.warBeasts || [])]) {
            const animal = game.entities.find(a => a.id === animalSnap.id);
            if (!animal) continue;
            const earned = exp.animalXpEarned?.[animalSnap.id] || 0;
            if (!earned) continue;
            if (animal.level === undefined) animal.level = 0;
            if (animal.xp    === undefined) animal.xp    = 0;
            animal.xp += earned;
            let needed = ANIMAL_XP_CONFIG.xpToLevel + animal.level * ANIMAL_XP_CONFIG.xpScalePerLevel;
            while (animal.xp >= needed && animal.level < ANIMAL_XP_CONFIG.maxLevel) {
                animal.xp -= needed;
                animal.level++;
                this._addLog(exp, game, { key: 'msg.exp.animal_level', params: { name: animal.name || entityRef(animal.type), level: animal.level } }, 'success');
                window.soundManager?.playExpSFX('magic_levelup');
                needed = ANIMAL_XP_CONFIG.xpToLevel + animal.level * ANIMAL_XP_CONFIG.xpScalePerLevel;
            }
        }

        if (exp.packAnimals) {
            for (const pa of exp.packAnimals) {
                const animal = game.entities.find(a => a.id === pa.id);
                if (animal) animal.onExpedition = false;
            }
        }

        // Survivors return home and are freed for future expeditions.
        if (exp.warBeasts) {
            for (const beast of exp.warBeasts) {
                const idx = game.entities.findIndex(a => a.id === beast.id);
                if (idx < 0) continue;
                const animal = game.entities[idx];
                animal.onExpedition = false;
                animal.hp = Math.max(1, beast.hp); // carry battle wounds home
            }
        }

        this.realmHistory.push(exp.realm);
        if (this.realmHistory.length > STREAK_CONFIG.historyLength) this.realmHistory.shift();

        // How many boss phases did the player reach this run?
        const bossDepth = exp.bossPhaseData
            ? exp.bossPhaseData.currentPhaseIndex + 1
            : 0;

        for (const entry of exp.discoveredEntries) {
            const multiRealm = entry.category === 'regular' || entry.category === 'npc';
            if (!this.bestiary.has(entry.key)) {
                const newEntry = { ...entry, count: 1 };
                delete newEntry.eliteModifier;
                delete newEntry.eliteName;
                delete newEntry.bossPhases;
                if (entry.eliteModifier) {
                    newEntry.eliteCounts = { [entry.eliteModifier]: { name: entry.eliteName, count: 1 } };
                }
                if (!newEntry.lore) newEntry.lore = '';
                if (multiRealm) newEntry.realms = [entry.realm];
                if (entry.category === 'boss' && entry.bossPhases?.length) {
                    newEntry.phases = entry.bossPhases.slice(0, Math.max(1, bossDepth))
                        .map(p => ({ name: p.name || p.displayName || '', nameRef: bestiaryPhaseRef(p), sprite: p.sprite || null, color: p.color || null }));
                }
                this.bestiary.set(entry.key, newEntry);
            } else {
                const existing = this.bestiary.get(entry.key);
                existing.count++;
                if (!existing.nameRef && entry.nameRef) existing.nameRef = entry.nameRef;
                if (!existing.loreRef && entry.loreRef) existing.loreRef = entry.loreRef;
                if (!existing.sprite && entry.sprite) existing.sprite = entry.sprite;
                if (!existing.color && entry.color) existing.color = entry.color;
                if (multiRealm) {
                    if (!existing.realms) existing.realms = [existing.realm];
                    if (!existing.realms.includes(entry.realm)) existing.realms.push(entry.realm);
                }
                if (entry.category === 'boss' && entry.bossPhases?.length && bossDepth > 0) {
                    const seen = entry.bossPhases.slice(0, bossDepth)
                        .map(p => ({ name: p.name || p.displayName || '', nameRef: bestiaryPhaseRef(p), sprite: p.sprite || null, color: p.color || null }));
                    if (!existing.phases) {
                        existing.phases = seen;
                    } else {
                        for (let i = existing.phases.length; i < seen.length; i++) {
                            existing.phases.push(seen[i]);
                        }
                    }
                }
                if (entry.eliteModifier) {
                    if (!existing.eliteCounts) existing.eliteCounts = {};
                    if (!existing.eliteCounts[entry.eliteModifier]) {
                        existing.eliteCounts[entry.eliteModifier] = { name: entry.eliteName, count: 1 };
                    } else {
                        existing.eliteCounts[entry.eliteModifier].count++;
                    }
                }
            }
        }

        // Return any unused potions to the stockpile
        this._returnPotions(exp, game);

        const items = exp.loot._items || [];
        const lootResources = { ...exp.loot };
        delete lootResources._items;
        game.resources.add(lootResources);
        for (const itemKey of items) {
            game.resources.addItem({ ...ALL_ITEMS[itemKey], key: itemKey });
        }
        const lootPos = this._returnPos(exp, game);
        if (lootPos) {
            for (const [res, amt] of Object.entries(lootResources)) {
                game.overlays.push({ type: 'floating_text', x: lootPos.x, y: lootPos.y, text: tr('msg.exp.loot_float', { n: amt, item: resourceRef(res) }), color: '#ffdd44', fontSize: 10, ttl: 20, maxTtl: 20 });
            }
        }
        if (game.discoveredLoot) {
            for (const res of Object.keys(lootResources)) {
                game.discoveredLoot.add(`${exp.realm}:${res}`);
            }
            for (const itemKey of items) {
                game.discoveredLoot.add(`${exp.realm}:${itemKey}`);
            }
        }
        const parts = [];
        for (const itemKey of items) {
            parts.push(resourceRef(itemKey));
        }
        for (const [res, amt] of Object.entries(lootResources)) {
            parts.push(ref('msg.exp.loot_amount', null, { n: amt, item: resourceRef(res) }));
        }
        const loot = parts.length > 0 ? listRef(parts) : ref('msg.exp.loot_nothing', 'nothing');
        const realm = realmRef(exp.realm, exp.realmName);
        if (!allDefeated) {
            this._addLog(exp, game, { key: 'msg.exp.returned_with', params: { loot } }, 'success');
            game.eventLog.add(game, { key: 'msg.exp.returned_event', params: { realm, loot } }, 'event', null);
        } else {
            this._addLog(exp, game, { key: 'msg.exp.salvaged', params: { loot } }, 'danger');
            game.eventLog.add(game, { key: 'msg.exp.failed_event', params: { realm, loot } }, 'warning', null);
        }

        // Finished runs are kept (and saved) for their summaries, so bound both the
        // per-run log and the uncollected-summary queue.
        const logCap = EXPLORATION_CONFIG.completedLogCap;
        if (exp.log.length > logCap) exp.log = exp.log.slice(-logCap);
        this.completedExpeditions.push(exp);
        if (this.completedExpeditions.length > 10) {
            this.completedExpeditions.shift();
        }
        this.pendingAutoSummaries.push(exp);
        if (this.pendingAutoSummaries.length > EXPLORATION_CONFIG.maxPendingSummaries) {
            this.pendingAutoSummaries.shift();
        }
    }

    dismissSummary() {
        this.pendingSummary = null;
    }

    collectAutoExpedition(expId) {
        const idx = this.pendingAutoSummaries.findIndex(e => e.id === expId);
        if (idx < 0) return null;
        const [exp] = this.pendingAutoSummaries.splice(idx, 1);
        this.pendingSummary = exp;
        return exp;
    }


    _generateNodeMap(encounters, bossEncounter) {
        const nodes = [];
        for (let i = 0; i < encounters.length; i++) {
            nodes.push({ type: encounters[i].type === 'combat' ? 'combat' : (encounters[i].type || 'loot'), encounterIndex: i, completed: false, current: false });
        }
        if (bossEncounter) {
            nodes.push({ type: 'boss', encounterIndex: -1, completed: false, current: false });
        }
        return nodes;
    }

    _applyFormationModifier(exp, memberId, stat) {
        if (!exp.formation) return 1.0;
        const row = exp.formation.back?.includes(memberId) ? 'back' : 'front';
        const rowConfig = FORMATION_CONFIG.rows[row];
        return rowConfig?.[stat] || 1.0;
    }

    // -- Combat status effects (round-scoped) ------------------------------
    // A unified, visible status layer shared by both sides of expedition combat.
    // Player spells inflict slow/stun on enemies (Frost Lance, Mesmerize). Enemy
    // spells can inflict poison/stun/slow/weaken on the party (poison live today,
    // the rest framework-ready). Durations count combat ROUNDS (not ticks) since
    // expedition combat is round-based, and every status is cleared when combat
    // ends (see _finishCombat) so nothing leaks between encounters.
    //
    // Shape: target.statusEffects = [{ type, rounds, damage?, mult? }]
    //   poison/burn → deals `damage` HP per round
    //   stun        → target skips its action that round
    //   slow        → target has a (1 - mult) chance to lose its turn each round
    //   weaken      → target's outgoing damage is scaled by `mult`
    _applyCombatStatus(target, type, rounds, extra = {}) {
        if (!target.statusEffects) target.statusEffects = [];
        const existing = target.statusEffects.find(s => s.type === type);
        // Refresh-not-stack: keep the longer duration and adopt the new magnitude.
        if (existing) {
            existing.rounds = Math.max(existing.rounds, rounds);
            Object.assign(existing, extra);
        } else {
            const status = { type, rounds, ...extra };
            // Max-HP buffs (maxHpMult > 1, e.g. void_blessed) raise the cap and top
            // up by the same amount while active. Caps below 1 (void_drained) are
            // enforced in _tickCombatStatus instead.
            if (extra.maxHpMult > 1 && target.maxHp > 0) {
                status.hpBonus = Math.round(target.maxHp * (extra.maxHpMult - 1));
                target.maxHp += status.hpBonus;
                target.hp += status.hpBonus;
            }
            target.statusEffects.push(status);
        }
    }

    // Removes statuses, keeping those for which `keep(status)` is true (default:
    // none), and undoes any max-HP bonus the removed ones granted.
    _clearCombatStatuses(target, keep = () => false) {
        if (!target.statusEffects) return;
        const kept = [];
        for (const s of target.statusEffects) {
            if (keep(s)) { kept.push(s); continue; }
            if (s.hpBonus) {
                target.maxHp -= s.hpBonus;
                target.hp = Math.min(target.hp, target.maxHp);
            }
        }
        target.statusEffects = kept;
    }

    // ── Chaos effect system ───────────────────────────────────────────────
    // Triggered at the start of combat encounters in chaos-chain realms,
    // and on every phase transition / per-round tick for The Unraveler boss.
    // All effects apply equally to enemies and party members.
    _applyRandomChaosEffect(exp, game, combat, targetOverride = null) {
        const CHAOS_POOL = ['surge', 'drain', 'frenzy', 'restoration', 'blindness', 'duplication'];
        const effectKey = CHAOS_POOL[randInt(0, CHAOS_POOL.length - 1)];
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        const enemies = (combat?.enemies || []).filter(e => e.hp > 0);
        const allCombatants = [...alive, ...enemies];
        const chaosResistance = alive.reduce((sum, m) => sum + (m.chaosResistance || 0), 0) / Math.max(1, alive.length);

        switch (effectKey) {
            case 'surge': {
                this._addLog(exp, game, { key: 'msg.exp.chaos.surge' }, 'combat');
                for (const c of allCombatants) this._applyCombatStatus(c, 'chaos_surge', 2, { dmgMult: 2.0 });
                break;
            }
            case 'drain': {
                const lossPct = Math.max(0.05, 0.20 - chaosResistance * 0.20);
                this._addLog(exp, game, { key: 'msg.exp.chaos.drain', params: { pct: Math.round(lossPct * 100) } }, 'danger');
                for (const c of allCombatants) {
                    const loss = Math.floor(c.hp * lossPct);
                    c.hp = Math.max(1, c.hp - loss);
                }
                for (const m of alive) {
                    if (m.hp <= 0) this._checkExpeditionRevive(exp, m, game);
                }
                break;
            }
            case 'frenzy': {
                this._addLog(exp, game, { key: 'msg.exp.chaos.frenzy' }, 'combat');
                for (const c of allCombatants) this._applyCombatStatus(c, 'chaos_frenzy', 1, { extraAttack: true });
                break;
            }
            case 'restoration': {
                this._addLog(exp, game, { key: 'msg.exp.chaos.restoration' }, 'success');
                for (const c of allCombatants) c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * 0.25));
                break;
            }
            case 'blindness': {
                const rounds = 2;
                this._addLog(exp, game, { key: 'msg.exp.chaos.blindness', params: { n: rounds } }, 'combat');
                for (const c of allCombatants) this._applyCombatStatus(c, 'blind', rounds, { missChance: Math.max(0.1, 0.5 - chaosResistance * 0.3) });
                break;
            }
            case 'duplication': {
                if (enemies.length > 0) {
                    const source = enemies[randInt(0, enemies.length - 1)];
                    const clone = {
                        hp: Math.floor(source.maxHp * 0.5),
                        maxHp: Math.floor(source.maxHp * 0.5),
                        damage: source.damage,
                        name: source.name ? tr('msg.exp.chaos.echo_of', { name: source.name }) : tr('msg.exp.chaos.echo'),
                        nameRef: source.name ? ref('msg.exp.chaos.echo_of', null, { name: enemyNameRef(source) }) : ref('msg.exp.chaos.echo'),
                        sprite: source.sprite,
                        color: source.color || '#cc88ff',
                        typeKey: source.typeKey,
                        spells: null,
                        attackAnim: source.attackAnim || 'Swing',
                        ranged: source.ranged || false,
                        projectileChar: source.projectileChar || null,
                        projectileColor: source.projectileColor || null,
                        damageReduction: 0,
                        statusEffects: [],
                    };
                    clone._nextAttackTick = game.tick + 3;
                    if (combat) combat.enemies.push(clone);
                    this._addLog(exp, game, { key: 'msg.exp.chaos.duplication', params: { foe: source.name ? enemyNameRef(source) : ref('msg.exp.label.an_enemy_cap', 'An enemy') } }, 'danger');
                }
                break;
            }
        }
        return effectKey;
    }

    _shouldApplyChaosEffect(exp) {
        const dim = REALMS[exp.realm];
        if (!dim || dim.chain !== 'chaos') return false;
        return Math.random() < (dim.chaosEncounterChance || 0.30);
    }

    // Turn-scoped crowd control. Stun and slow count down per turn of the afflicted
    // combatant (not per round), so "stunned for 1 round" always costs exactly one
    // attack regardless of that combatant's attack speed. Returns true when the turn
    // is lost and records why in target._lostTurnTo for the log line.
    _loseTurnToCrowdControl(target) {
        if (!target.statusEffects) return false;
        const stun = target.statusEffects.find(s => s.type === 'stun' && s.rounds > 0);
        if (stun) {
            stun.rounds--;
            target._lostTurnTo = 'stun';
            return true;
        }
        const slow = target.statusEffects.find(s => s.type === 'slow' && s.rounds > 0);
        if (slow) {
            slow.rounds--;
            if (Math.random() > (slow.mult ?? 0.5)) {
                target._lostTurnTo = 'slow';
                return true;
            }
        }
        return false;
    }

    _hasCombatStatus(target, type) {
        return !!(target.statusEffects && target.statusEffects.some(s => s.type === type && s.rounds > 0));
    }

    _memberHasPoisonImmunity(member) {
        const slots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
        return slots.some(s => member[s]?.poisonImmunity);
    }

    // Magnitude field (e.g. 'mult') of an active status, or `def` when absent.
    _combatStatusValue(target, type, field, def) {
        const s = target.statusEffects && target.statusEffects.find(x => x.type === type && x.rounds > 0);
        return s && s[field] !== undefined ? s[field] : def;
    }

    // Runs once per combat round: applies DoT damage, then decrements and prunes
    // every combatant's status effects on both sides. Stun and slow are skipped
    // here (they count down per turn, see _loseTurnToCrowdControl), as are
    // statuses that last the whole expedition.
    _tickCombatStatus(exp, game, combat) {
        const tick = (combatant, isParty) => {
            if (!combatant.statusEffects || combatant.statusEffects.length === 0) return;
            if (combatant.hp <= 0) { this._clearCombatStatuses(combatant); return; }
            for (const s of combatant.statusEffects) {
                if (s.type === 'poison' || s.type === 'burn') {
                    // Per-round damage: a fixed `damage`, or a rolled `damageRange`.
                    const dmg = s.damageRange ? randInt(s.damageRange[0], s.damageRange[1]) : (s.damage || 0);
                    if (dmg > 0) {
                        combatant.hp -= dmg;
                        // Stamp the DoT tick so the visualizer can spawn a small mote on
                        // this combatant; frame-diff would misread the hp drop as recoil.
                        combatant._lastDotTick = game.tick;
                        combatant._lastDotType = s.type;
                        const label = s.type === 'poison' ? 'poison' : 'burning';
                        if (isParty) {
                            if (exp.summary) exp.summary.damageTaken[combatant.id] = (exp.summary.damageTaken[combatant.id] || 0) + dmg;
                            this._addLog(exp, game, { key: `msg.exp.dot.${label}.member_damage`, params: { name: combatant.name, dmg } }, 'danger');
                            if (combatant.hp <= 0) this._checkExpeditionRevive(exp, combatant, game);
                        } else {
                            this._addLog(exp, game, { key: `msg.exp.dot.${label}.enemy_damage`, params: { dmg } }, 'combat');
                            if (combatant.hp <= 0) this._addLog(exp, game, { key: `msg.exp.dot.${label}.enemy_dies` }, 'success', { fx: { kind: 'kill', byParty: true } });
                        }
                    }
                }
                if (s.type === 'stun' || s.type === 'slow' || s.expiresWithExpedition) continue;
                s.rounds--;
            }
            this._clearCombatStatuses(combatant, s => s.rounds > 0);
        };
        for (const enemy of combat.enemies) tick(enemy, false);
        for (const member of exp.partySnapshot) tick(member, true);

        // Enforce void_drained: cap HP to maxHpMult fraction of max HP.
        for (const member of exp.partySnapshot) {
            const drainStatus = member.statusEffects?.find(s => s.type === 'void_drained');
            if (drainStatus) {
                const cap = Math.floor(member.maxHp * (drainStatus.maxHpMult ?? 0.75));
                if (member.hp > cap) member.hp = cap;
            }
        }

        // Tick weapon on-hit DoT effects (poison/bleed/burn) on expedition enemies.
        for (const enemy of combat.enemies) {
            if (!enemy._dotEffects || enemy.hp <= 0) continue;
            enemy._dotEffects = enemy._dotEffects.filter(d => d.rounds > 0);
            for (const d of enemy._dotEffects) {
                enemy.hp -= d.damage;
                this._addLog(exp, game, this._weaponDotMessage(d.type, 'enemy_damage', { dmg: d.damage }), 'combat');
                if (enemy.hp <= 0) this._addLog(exp, game, this._weaponDotMessage(d.type, 'enemy_dies'), 'success', { fx: { kind: 'kill', byParty: true } });
                d.rounds--;
            }
        }
    }

    // Log line for a weapon on-hit DoT (poison, bleed, burn) ticking on an enemy.
    _weaponDotMessage(type, which, params) {
        const key = `msg.exp.dot.${type}.${which}`;
        return hasKey(key) ? { key, params } : { key: `msg.exp.dot.other.${which}`, params: { ...params, type } };
    }

    _updateActiveEffects(exp, game) {
        if (!exp.activeEffects || exp.activeEffects.length === 0) return;
        for (let i = exp.activeEffects.length - 1; i >= 0; i--) {
            const effect = exp.activeEffects[i];
            if (effect.type === 'dot' && game.tick - (effect.lastTick || 0) >= effect.interval) {
                effect.lastTick = game.tick;
                effect.ticksRemaining--;
                const member = exp.partySnapshot.find(p => p.id === effect.targetId);
                if (member && member.hp > 0) {
                    const dmg = randInt(effect.damageRange[0], effect.damageRange[1]);
                    member.hp -= dmg;
                    // Out-of-combat DoT (trap/enemy residue): stamp for a visual mote.
                    member._lastDotTick = game.tick;
                    member._lastDotType = effect.dotType || 'poison';
                    if (member.hp <= 0) this._checkExpeditionRevive(exp, member, game);
                }
            }
            if (effect.ticksRemaining <= 0) {
                exp.activeEffects.splice(i, 1);
            }
        }
    }

    _checkTraitRally(exp, game) {
        if (game.tick % 20 !== 0) return;
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        const baseRallyChance = 0.02;
        const baseRallyHeal = 0.03;
        for (const member of alive) {
            const col = game.getColonist(member.id);
            let rallyChance = baseRallyChance;
            let rallyHeal = baseRallyHeal;
            if (col?.traits) {
                for (const traitKey of col.traits) {
                    const t = TRAITS[traitKey];
                    if (t?.expedition?.rallyChance) rallyChance += t.expedition.rallyChance;
                    if (t?.expedition?.rallyHeal) rallyHeal += t.expedition.rallyHeal;
                }
            }
            const lvl = this.getExpeditionLevel(member.id);
            if (lvl >= 5) { rallyChance += 0.08; rallyHeal += 0.04; }
            if (Math.random() < rallyChance) {
                const healAmt = Math.floor(member.maxHp * rallyHeal);
                for (const m of alive) {
                    m.hp = Math.min(m.maxHp, m.hp + healAmt);
                    if (m.maxMana > 0) m.mana = Math.min(m.maxMana, m.mana + Math.floor(m.maxMana * 0.01));
                }
                this._addLog(exp, game, { key: 'msg.exp.rally', params: { name: member.name, amount: healAmt } }, 'success');
                if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healAmt * alive.length;
                // Distinct group beat over the whole party (F1 particles cover the
                // per-member heals; this adds a single uplifting flourish + SFX).
                exp._rallyTick = game.tick;
                window.soundManager?.playExpSFX('spell_buff');
                return;
            }
        }
    }

    _rollEliteModifier(enemy, diffSettings) {
        const chance = ELITE_CONFIG.baseChance + ((diffSettings.enemyHpMult - 1) / 0.3) * ELITE_CONFIG.difficultyChanceBonus;
        if (Math.random() >= chance) return;
        const modKeys = Object.keys(ELITE_MODIFIERS);
        const modKey = modKeys[randInt(0, modKeys.length - 1)];
        const mod = ELITE_MODIFIERS[modKey];
        enemy.elite = modKey;
        enemy.eliteName = mod.prefix;
        enemy.eliteColor = mod.color;
        if (mod.hpMult) { enemy.hp = Math.round(enemy.hp * mod.hpMult); enemy.maxHp = enemy.hp; }
        if (mod.damageReduction) enemy.eliteDR = mod.damageReduction;
        if (mod.dodgeChance) enemy.eliteDodge = mod.dodgeChance;
        if (mod.extraAttacks) enemy.eliteExtraAttacks = mod.extraAttacks;
        if (mod.lifeSteal) enemy.eliteLifeSteal = mod.lifeSteal;
        if (mod.regenPerRound) enemy.eliteRegen = mod.regenPerRound;
        if (mod.onDeath) enemy.eliteOnDeath = mod.onDeath;
    }

    _processEliteAbilities(enemy, exp, game) {
        if (!enemy.elite) return;
        if (enemy.eliteRegen && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
            const regen = Math.floor(enemy.maxHp * enemy.eliteRegen);
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + regen);
        }
    }

    _processEliteOnDeath(enemy, exp, game) {
        if (!enemy.eliteOnDeath) return;
        if (enemy.eliteOnDeath.aoe) {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            const dmg = randInt(enemy.eliteOnDeath.damage[0], enemy.eliteOnDeath.damage[1]);
            for (const m of alive) {
                m.hp -= dmg;
                if (m.hp <= 0) this._checkExpeditionRevive(exp, m, game);
            }
            this._addLog(exp, game, { key: 'msg.exp.elite_explodes', params: { elite: eliteRef(enemy), dmg } }, 'danger');
        }
    }

    _processEnemyOnDeath(enemy, exp, game) {
        if (!enemy.onDeath) return;
        if (enemy.onDeath.applyVoidDrained) {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            const rounds = enemy.onDeath.rounds ?? 2;
            for (const m of alive) this._applyCombatStatus(m, 'void_drained', rounds, { maxHpMult: 0.75 });
            this._addLog(exp, game, { key: 'msg.exp.void_release', params: { foe: enemyNameRef(enemy) } }, 'danger');
        }
    }

    _updateBossPhase(exp, game) {
        if (!exp.bossPhaseData || !exp.combat?.isBoss) return;
        const bossEnemy = exp.combat.enemies.find(e => e.isBoss);
        if (!bossEnemy || bossEnemy.hp > 0) return;

        const phases = exp.bossPhaseData.phases;
        const nextIdx = exp.bossPhaseData.currentPhaseIndex + 1;
        if (nextIdx >= phases.length) return;

        const nextPhase = phases[nextIdx];
        exp.bossPhaseData.currentPhaseIndex = nextIdx;
        // New phase: re-arm the guaranteed first mask swap (see _tryMaskSwap).
        exp.bossPhaseData._swappedThisPhase = false;

        const oldPhase = phases[nextIdx - 1];
        if (oldPhase.transitionText) {
            this._addLog(exp, game, oldPhase.transitionKey ? { key: oldPhase.transitionKey } : defMessage(oldPhase, 'transitionText'), 'danger');
        }

        bossEnemy.hp = Math.round(nextPhase.hp * this._enemyStatMults(exp).hp);
        bossEnemy.maxHp = bossEnemy.hp;
        bossEnemy.damage = Math.round(nextPhase.damage * this._enemyStatMults(exp).dmg);
        bossEnemy.damageReduction = nextPhase.damageReduction || 0;
        // Void pact damage reduction expires when the protected phase ends.
        exp._voidPactBossDmgMult = null;
        if (nextPhase.color) bossEnemy.color = nextPhase.color;
        if (nextPhase.sprite) bossEnemy.sprite = nextPhase.sprite;
        bossEnemy.abilities = nextPhase.abilities || [];
        bossEnemy.enraged = false;

        // For dynamic-mask bosses (the Unraveler) each phase carries a `displayName`
        // that IS the on-screen boss identity ("Crystal Colossus, Unraveled", or the
        // true name on the finale), so it follows the phase. Other bosses have no
        // displayName and keep their own name; their phase `name` is only a log label.
        if (nextPhase.displayName) {
            bossEnemy.name = nextPhase.displayName;
            bossEnemy.nameRef = nextPhase.displayNameRef || nextPhase.displayName;
            bossEnemy.maskKey = nextPhase.maskKey ?? null;
        }

        const phaseName = phaseNameRef(nextPhase);
        this._addLog(exp, game, { key: 'msg.exp.boss_phase', params: { boss: enemyNameRef(bossEnemy), phase: phaseName } }, 'danger',
            { fx: { kind: 'boss_phase', phaseName } });
        if (nextPhase.armorText && bossEnemy.damageReduction > 0) {
            const armorOwner = nextPhase._loc ? nextPhase : { _loc: nextPhase.armorLoc, armorText: nextPhase.armorText };
            this._addLog(exp, game, defMessage(armorOwner, 'armorText'), 'info');
        }

        // Chaos phase transition: apply a random chaos effect when entering new phase
        const dim = REALMS[exp.realm];
        if (dim?.boss?.chaosPhaseTransition) {
            this._applyRandomChaosEffect(exp, game, exp.combat);
        }

        // Void pact choice: pause combat with a deal prompt
        if (oldPhase.voidPactChoice && exp.partySnapshot.some(p => p.hp > 0)) {
            const pact = oldPhase.voidPactChoice;
            exp.pendingVoidPactChoice = {
                // The config entry's key prefix: promptText, logAccept and logRefuse
                // are under `<_loc>.<field>`.
                _loc: pact._loc,
                text: defMessage(pact, 'promptText'),
                acceptEffect: pact.acceptEffect,
                logAccept: pact.logAccept,
                logRefuse: pact.logRefuse,
                bossEnemy,
            };
        }
    }

    _executeBossAbilities(bossEnemy, exp, game) {
        // Auto-chaos tick: phases marked autoChaosTick trigger chaos every round.
        const currentPhase = exp.bossPhaseData?.phases?.[exp.bossPhaseData?.currentPhaseIndex];
        if (currentPhase?.autoChaosTick && exp.combat) {
            this._applyRandomChaosEffect(exp, game, exp.combat);
        }
        // Mid-fight disguise flicker. Independent of autoChaosTick so the Unraveler's
        // signature "wears stolen faces" mechanic is live at every difficulty (even
        // difficulty 1, where there is a single mask phase), not just where the
        // party-punishing chaos tick is unlocked.
        this._tryMaskSwap(bossEnemy, exp, game);
        if (!bossEnemy.abilities) return;
        for (const ability of bossEnemy.abilities) {
            if (ability.type === 'aoe' && Math.random() < (ability.chance || 0)) {
                const alive = exp.partySnapshot.filter(p => p.hp > 0);
                const dmg = randInt(ability.damage[0], ability.damage[1]);
                for (const m of alive) {
                    const formMult = this._applyFormationModifier(exp, m.id, 'damageTakenMult');
                    const actualDmg = Math.floor(dmg * formMult);
                    m.hp -= actualDmg;
                    if (exp.summary) exp.summary.damageTaken[m.id] = (exp.summary.damageTaken[m.id] || 0) + actualDmg;
                    if (m.hp <= 0) this._checkExpeditionRevive(exp, m, game);
                }
                this._addLog(exp, game, ability.text ? defMessage(ability, 'text') : { key: 'msg.exp.boss_unleashes', params: { boss: enemyNameRef(bossEnemy) } }, 'danger');
            } else if (ability.type === 'summon_adds' && Math.random() < (ability.chance || 0)) {
                const count = ability.count || 2;
                for (let i = 0; i < count; i++) {
                    exp.combat.enemies.push({
                        hp: Math.round(ability.hp * this._enemyStatMults(exp).hp),
                        maxHp: Math.round(ability.hp * this._enemyStatMults(exp).hp),
                        damage: Math.round(ability.damage * this._enemyStatMults(exp).dmg),
                    });
                }
                this._addLog(exp, game, ability.text ? defMessage(ability, 'text') : { key: 'msg.exp.boss_reinforcements', params: { boss: enemyNameRef(bossEnemy) } }, 'danger');
            }
        }
    }

    // Mid-fight disguise flicker for the Unraveler: each round of a non-finale mask
    // phase, a small chance (MASK_SWAP_CHANCE) to reskin the boss into a different
    // mask. HP is carried over as a FRACTION of max, and because every mask shares
    // the same per-phase HP budget (set in _updateBossPhase from the phase's `hp`),
    // the swap is neutral in absolute HP: the health bar stays honest and damage
    // already dealt is never refunded. Only appearance and abilities change;
    // hp/maxHp/damage are untouched.
    _tryMaskSwap(bossEnemy, exp, game) {
        if (!REALMS[exp.realm]?.boss?.dynamicMasks) return;
        if (bossEnemy.hp <= 0) return;
        // Never re-disguise during the finale: once the true Unraveler is revealed
        // (the last phase), the disguise has been dropped for good.
        const pd = exp.bossPhaseData;
        if (pd && pd.currentPhaseIndex >= pd.phases.length - 1) return;
        // Guarantee at least one swap per mask phase: the first time this phase's
        // boss-ability step runs, force a swap; every later round rolls the normal
        // chance. _swappedThisPhase is reset on each phase transition
        // (_updateBossPhase) and at combat start. If the party bursts a mask phase
        // to 0 in a single round the ability step never runs, so no swap is possible
        // that phase; that is the expected edge, not a missed guarantee.
        const forced = pd ? !pd._swappedThisPhase : false;
        if (!forced && Math.random() >= ExplorationSystem.MASK_SWAP_CHANCE) return;

        // Pick a mask different from the current one where possible.
        const masks = this._buildAllMasks();
        if (masks.length === 0) return;
        // By mask id, so a save reloaded in another language still excludes the
        // current mask. Bosses saved before maskKey existed compare names.
        const candidates = bossEnemy.maskKey !== undefined
            ? masks.filter(m => m.maskKey !== bossEnemy.maskKey)
            : masks.filter(m => m.displayName !== bossEnemy.name);
        const pool = candidates.length > 0 ? candidates : masks;
        const mask = pool[randInt(0, pool.length - 1)];

        // Preserve HP fraction; maxHp is unchanged (shared budget), so hp is too.
        const frac = bossEnemy.maxHp > 0 ? bossEnemy.hp / bossEnemy.maxHp : 1;
        bossEnemy.hp = Math.max(1, Math.round(bossEnemy.maxHp * frac));
        bossEnemy.sprite = mask.sprite;
        bossEnemy.color = mask.color;
        bossEnemy.name = mask.displayName;
        bossEnemy.nameRef = mask.displayNameRef;
        bossEnemy.maskKey = mask.maskKey;
        bossEnemy.abilities = mask.abilities.map(a => ({ ...a }));
        if (pd) pd._swappedThisPhase = true;

        this._addLog(exp, game, { key: 'msg.exp.chaos.mask_swap', params: { boss: mask.labelRef } }, 'danger');
    }

    _tryUsePotions(exp, game) {
        if (!exp.potionSupply) return;
        const alive = exp.partySnapshot.filter(p => p.hp > 0);

        // Entry-condition potions fire once at the start of exploring (before first encounter).
        if (exp.status === 'exploring' && !exp._entryPotionsUsed) {
            exp._entryPotionsUsed = true;
            for (const [potionKey, count] of Object.entries(exp.potionSupply)) {
                if (count <= 0) continue;
                const def = EXPEDITION_POTIONS[potionKey];
                if (!def || def.useCondition !== 'entry') continue;
                exp.potionSupply[potionKey]--;
                if (exp.potionSupply[potionKey] <= 0) delete exp.potionSupply[potionKey];
                if (def.effect.buffLoot) {
                    if (!exp.potionLootBoosts) exp.potionLootBoosts = { lootMult: 1, rareEncounterMult: 1 };
                    if (def.effect.buffLoot.lootMult) exp.potionLootBoosts.lootMult *= def.effect.buffLoot.lootMult;
                    if (def.effect.buffLoot.rareEncounterMult) exp.potionLootBoosts.rareEncounterMult *= def.effect.buffLoot.rareEncounterMult;
                }
                this._addLog(exp, game, defMessage(def, 'logText', { name: this._actorName(alive[0]) }), 'success');
                if (exp.summary) exp.summary.potionsUsed++;
            }
        }

        for (const [potionKey, count] of Object.entries(exp.potionSupply)) {
            if (count <= 0) continue;
            const def = EXPEDITION_POTIONS[potionKey];
            if (!def) continue;
            if (def.useCondition === 'combat' && !exp.combat) continue;
            if (def.useCondition === 'entry') continue;

            // Rally Brew: party-wide effect, uses on any slowed member
            if (def.autoUse.anyMemberSlowed) {
                const slowed = alive.find(p => this._hasCombatStatus(p, 'slow'));
                if (slowed) {
                    exp.potionSupply[potionKey]--;
                    if (exp.potionSupply[potionKey] <= 0) delete exp.potionSupply[potionKey];
                    if (def.effect.rallyParty) {
                        const healPct = def.effect.rallyParty.healPercent || 0;
                        for (const p of alive) {
                            if (healPct > 0) {
                                const heal = Math.floor(p.maxHp * healPct);
                                p.hp = Math.min(p.maxHp, p.hp + heal);
                                if (exp.summary) exp.summary.healingDone[p.id] = (exp.summary.healingDone[p.id] || 0) + heal;
                            }
                            if (def.effect.rallyParty.clearSlow) {
                                if (p.statusEffects) p.statusEffects = p.statusEffects.filter(s => s.type !== 'slow');
                            }
                        }
                    }
                    this._addLog(exp, game, defMessage(def, 'logText', { name: slowed.name }), 'success');
                    if (exp.summary) exp.summary.potionsUsed++;
                }
                continue;
            }

            // Statuses this potion grants. A member already under them doesn't drink
            // another; otherwise the trigger holds next tick and the whole stack is
            // gone in a few ticks for one buff's worth of effect.
            const grants = [];
            const bc = def.effect.buffCombat, bd = def.effect.buffDefense;
            if (bc?.attackSpeed) grants.push('buff_attackSpeed');
            if (bc?.critChance) grants.push('buff_critChance');
            if (bc?.hpOnKill) grants.push('buff_hpOnKill');
            if (bc?.spellCostReduction) grants.push('buff_spellCostReduction');
            if (bd?.dodgeChance) grants.push('buff_dodgeChance');

            for (const member of alive) {
                if (grants.length > 0 && grants.every(t => this._hasCombatStatus(member, t))) continue;
                let shouldUse = false;
                if (def.autoUse.hpThreshold && member.hp / member.maxHp <= def.autoUse.hpThreshold) shouldUse = true;
                if (def.autoUse.manaThreshold && member.maxMana > 0 && member.mana / member.maxMana <= def.autoUse.manaThreshold) shouldUse = true;
                if (def.autoUse.hasDot && (exp.activeEffects?.some(e => e.targetId === member.id && e.type === 'dot') || this._hasCombatStatus(member, 'poison'))) shouldUse = true;
                if (def.autoUse.anyMemberAtOrBelow) {
                    shouldUse = alive.some(p => p.hp / p.maxHp <= def.autoUse.anyMemberAtOrBelow);
                }
                if (def.autoUse.requiresMana && (!member.maxMana || member.maxMana <= 0)) continue;
                if (def.autoUse.onBoss && def.autoUse.hpAbove) {
                    shouldUse = exp.combat?.enemies?.some(e => e.isBoss && e.hp > 0)
                        && member.hp / member.maxHp >= def.autoUse.hpAbove;
                } else if (def.autoUse.hpAbove && def.autoUse.hpThreshold) {
                    shouldUse = member.hp / member.maxHp <= def.autoUse.hpThreshold
                        && member.hp / member.maxHp > def.autoUse.hpAbove;
                }

                if (shouldUse) {
                    exp.potionSupply[potionKey]--;
                    if (exp.potionSupply[potionKey] <= 0) delete exp.potionSupply[potionKey];
                    if (def.effect.healTarget) {
                        const heal = Math.floor(member.maxHp * def.effect.healTarget);
                        member.hp = Math.min(member.maxHp, member.hp + heal);
                        if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + heal;
                    }
                    if (def.effect.restoreMana) {
                        const restore = Math.floor(member.maxMana * def.effect.restoreMana);
                        member.mana = Math.min(member.maxMana, member.mana + restore);
                    }
                    if (def.effect.clearDot) {
                        exp.activeEffects = (exp.activeEffects || []).filter(e => e.targetId !== member.id || e.type !== 'dot');
                        // Also cures in-combat poison (enemy venom spells and the like).
                        if (member.statusEffects) member.statusEffects = member.statusEffects.filter(st => st.type !== 'poison');
                    }
                    if (def.effect.buffCombat) {
                        const b = def.effect.buffCombat;
                        const rounds = b.duration || 3;
                        if (b.attackSpeed) this._applyCombatStatus(member, 'buff_attackSpeed', rounds, { value: b.attackSpeed });
                        if (b.critChance) this._applyCombatStatus(member, 'buff_critChance', rounds, { value: b.critChance });
                        if (b.hpOnKill) this._applyCombatStatus(member, 'buff_hpOnKill', rounds, { value: b.hpOnKill });
                        if (b.spellCostReduction) this._applyCombatStatus(member, 'buff_spellCostReduction', rounds, { value: b.spellCostReduction });
                    }
                    if (def.effect.buffDefense) {
                        const b = def.effect.buffDefense;
                        const rounds = b.duration || 3;
                        if (b.dodgeChance) this._applyCombatStatus(member, 'buff_dodgeChance', rounds, { value: b.dodgeChance });
                    }
                    // Buff/utility potions don't move hp/mana, so F1's frame-diff can't
                    // see them; stamp a potion tick for a flask mote. HP/MP potions are
                    // already covered by the heal/mana gain particles.
                    if (!def.effect.healTarget && !def.effect.restoreMana) {
                        member._lastPotionTick = game.tick;
                        window.soundManager?.playExpSFX('spell_buff');
                    }
                    this._addLog(exp, game, defMessage(def, 'logText', { name: member.name }), 'success');
                    if (exp.summary) exp.summary.potionsUsed++;
                    break;
                }
            }
        }
    }

    _getMutatorEffect(exp, effectKey) {
        if (!exp.mutators) return effectKey.includes('Mult') ? 1.0 : 0;
        let value = effectKey.includes('Mult') ? 1.0 : 0;
        for (const mutKey of exp.mutators) {
            const mut = EXPEDITION_MUTATORS[mutKey];
            if (!mut?.effects?.[effectKey]) continue;
            if (effectKey.includes('Mult')) value *= mut.effects[effectKey];
            else value += mut.effects[effectKey];
        }
        return value;
    }

    _calculateFatigueCooldown(exp) {
        const base = FATIGUE_CONFIG.baseCooldownTicks;
        const diffMult = FATIGUE_CONFIG.difficultyMult[exp.difficulty] || 1.0;
        return Math.floor(base * diffMult);
    }

    _getStreakMultiplier(realmKey) {
        let consecutive = 0;
        for (let i = this.realmHistory.length - 1; i >= 0; i--) {
            if (this.realmHistory[i] === realmKey) consecutive++;
            else break;
        }
        const diminishing = STREAK_CONFIG.sameRealmDiminishing[Math.min(consecutive, 5)] || 1.0;

        const recent = this.realmHistory.slice(-STREAK_CONFIG.varietyBonus.uniqueRealmsForBonus);
        const unique = new Set(recent).size;
        const varietyMult = unique >= STREAK_CONFIG.varietyBonus.uniqueRealmsForBonus ? STREAK_CONFIG.varietyBonus.lootMult : 1.0;

        return diminishing * varietyMult;
    }

    _updateBestiary(exp, category, key, data, game) {
        const fullKey = `${category}:${key}`;
        // First sighting: the key is new to the persistent bestiary AND not already
        // queued this run. Stamp it so the visualizer pops a discovery flourish once.
        const already = this.bestiary.has(fullKey) || exp.discoveredEntries.some(e => e.key === fullKey);
        exp.discoveredEntries.push({
            key: fullKey,
            category,
            name: data.name || key,
            realm: exp.realm,
            sprite: data.sprite || null,
            color: data.color || null,
            lore: data.lore || '',
            // Refs for the name and lore, so the bestiary can show them in the
            // active language (name/lore are the text when discovered).
            nameRef: data.nameRef || null,
            loreRef: data.loreRef || null,
            eliteModifier: data.eliteModifier || null,
            eliteName: data.eliteName || null,
            bossPhases: data.bossPhases || null,
        });
        if (!already && game) {
            exp._lastDiscoveryTick = game.tick;
            exp._lastDiscoveryName = data.name || key;
            window.soundManager?.playExpSFX('spell_divination');
        }
    }

    /**
     * Renames bestiary entries keyed by a boss's display name (`boss:<name>`, saves
     * from before boss entries were keyed by realm) to `boss:<realmKey>`, using the
     * realm each entry records. Duplicates are merged: counts add, the longer phase
     * list and any missing refs, sprite, color and lore are kept. Safe to run on
     * every load; already-migrated data is left alone.
     * @param {Map<string, object>} bestiary The bestiary map, changed in place.
     * @return {Map<string, object>} The same map.
     */
    migrateBestiaryKeys(bestiary) {
        if (!bestiary) return bestiary;
        for (const [key, entry] of [...bestiary]) {
            if (!key.startsWith('boss:') || !entry || !REALMS[entry.realm]?.boss) continue;
            const newKey = `boss:${entry.realm}`;
            if (key === newKey) continue;
            bestiary.delete(key);
            entry.key = newKey;
            const existing = bestiary.get(newKey);
            if (!existing) {
                bestiary.set(newKey, entry);
                continue;
            }
            existing.count = (existing.count || 0) + (entry.count || 0);
            if ((entry.phases?.length || 0) > (existing.phases?.length || 0)) existing.phases = entry.phases;
            for (const f of ['nameRef', 'loreRef', 'sprite', 'color', 'lore']) {
                if (!existing[f] && entry[f]) existing[f] = entry[f];
            }
            if (entry.eliteCounts) {
                existing.eliteCounts ||= {};
                for (const [mod, ec] of Object.entries(entry.eliteCounts)) {
                    if (existing.eliteCounts[mod]) existing.eliteCounts[mod].count += ec.count || 0;
                    else existing.eliteCounts[mod] = ec;
                }
            }
        }
        return bestiary;
    }

    _awardAnimalExpeditionXP(exp, amount) {
        if (!exp.animalXpEarned) exp.animalXpEarned = {};
        for (const a of [...(exp.packAnimals || []), ...(exp.warBeasts || [])]) {
            exp.animalXpEarned[a.id] = (exp.animalXpEarned[a.id] || 0) + amount;
        }
    }

    _animalWarBeastLevelBonus(level) {
        const bonuses = ANIMAL_XP_CONFIG.levelBonuses.warBeast;
        let hpBonus = 0, damageBonus = 0;
        for (let lv = 1; lv <= (level || 0); lv++) {
            if (bonuses[lv]) { hpBonus += bonuses[lv].hpBonus; damageBonus += bonuses[lv].damageBonus; }
        }
        return { hpBonus, damageBonus };
    }

    _animalPackLevelBonus(level) {
        const bonuses = ANIMAL_XP_CONFIG.levelBonuses.packAnimal;
        let speedBonusAdd = 0;
        for (let lv = 1; lv <= (level || 0); lv++) {
            if (bonuses[lv]) speedBonusAdd += bonuses[lv].speedBonusAdd;
        }
        return speedBonusAdd;
    }

    _awardExpeditionXP(exp, game, amount) {
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        for (const m of alive) {
            let xp = amount;
            const col = game.getColonist(m.id);
            if (col?.traits) {
                for (const t of col.traits) {
                    const traitDef = TRAITS[t];
                    if (traitDef?.expedition?.xpMult) xp = Math.floor(xp * traitDef.expedition.xpMult);
                }
            }
            exp.xpEarned[m.id] = (exp.xpEarned[m.id] || 0) + xp;
        }
    }

    _applyDecisionEffects(exp, game, effects, sourceEncounterIndex) {
        const alive = exp.partySnapshot.filter(p => p.hp > 0);

        if (effects.sacrificeLootForAltarBless && alive.length > 0) {
            // Remove a random already-collected item from the loot pool (the offering).
            const lootItems = exp.loot._items;
            if (lootItems && lootItems.length > 0) {
                const sacrificedIdx = randInt(0, lootItems.length - 1);
                const sacrificed = lootItems.splice(sacrificedIdx, 1)[0];
                this._addLog(exp, game, { key: 'msg.exp.altar_offering', params: { item: resourceRef(sacrificed) } }, 'event');
            } else {
                this._addLog(exp, game, { key: 'msg.exp.altar_nothing' }, 'event');
            }
            // All living members receive void_blessed: +20% max HP and +1 dmg for 4 rounds.
            for (const m of alive) this._applyCombatStatus(m, 'void_blessed', 4, { maxHpMult: 1.20, dmgBonus: 1 });
            this._stampResolution(exp, game, true);
            return;
        }

        if (effects.voidDrainedSacrifice && alive.length > 0) {
            const weakest = alive.reduce((w, m) => m.hp < w.hp ? m : w, alive[0]);
            weakest.hp = Math.max(1, weakest.hp - effects.voidDrainedSacrifice);
            this._applyCombatStatus(weakest, 'void_drained', 99, { maxHpMult: 0.75, expiresWithExpedition: true });
            weakest._voidDrainedUntil = Infinity;
            this._addLog(exp, game, { key: 'msg.exp.altar_bleeds', params: { name: weakest.name } }, 'danger');
            if (weakest.hp <= 0) this._checkExpeditionRevive(exp, weakest, game);
            this._stampResolution(exp, game, false);
        }

        if (effects.partyDamagePercent && alive.length > 0) {
            const pct = effects.partyDamagePercent;
            for (const m of alive) {
                const loss = Math.floor(m.hp * pct);
                m.hp = Math.max(1, m.hp - loss);
            }
            this._addLog(exp, game, { key: 'msg.exp.party_pays_pct', params: { pct: Math.round(pct * 100) } }, 'danger');
            this._stampResolution(exp, game, false);
        }

        if (effects.expeditionWeaponBuff && alive.length > 0) {
            const buffTarget = alive[Math.floor(Math.random() * alive.length)];
            if (buffTarget.weapon) {
                buffTarget.weapon = { ...buffTarget.weapon, damage: (buffTarget.weapon.damage || 0) + effects.expeditionWeaponBuff };
                this._addLog(exp, game, { key: 'msg.exp.weapon_buff', params: { name: buffTarget.name, amount: effects.expeditionWeaponBuff } }, 'success');
            }
        }

        if (effects.randomPortal) {
            const roll = Math.random();
            if (roll < 0.33) {
                this._addLog(exp, game, { key: 'msg.exp.portal_forward' }, 'success');
                // No extra effect — just progress normally
            } else if (roll < 0.66) {
                this._addLog(exp, game, { key: 'msg.exp.portal_loop' }, 'danger');
                if (exp.currentEncounter > 0) exp.currentEncounter--;
            } else {
                this._addLog(exp, game, { key: 'msg.exp.portal_cache' }, 'event');
                if (effects.spawnCombat === undefined) {
                    const dim = REALMS[exp.realm];
                    const baseCount = randInt(dim.enemies.count[0], dim.enemies.count[1]);
                    const enemies = [];
                    for (let j = 0; j < baseCount; j++) {
                        const eDef = this._pickEnemyFromRealm(dim);
                        const hp = Math.round(randInt(eDef.hp[0], eDef.hp[1]) * this._enemyStatMults(exp).hp);
                        const dmg = Math.round(randInt(eDef.damage[0], eDef.damage[1]) * this._enemyStatMults(exp).dmg);
                        enemies.push({ hp, maxHp: hp, damage: dmg, name: eDef.name, sprite: eDef.sprite, color: eDef.color, typeKey: eDef.typeKey, spells: eDef.spells, attackAnim: eDef.attackAnim || 'Swing', ranged: eDef.attackAnim === 'DrawAndShoot', projectileChar: eDef.projectileChar, projectileColor: eDef.projectileColor, damageReduction: eDef.damageReduction || 0 });
                    }
                    exp.combat = { enemies, round: 0, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter, isBoss: false, ambushEndTick: game.tick + Math.max(...exp.partySnapshot.map(m => m.effectiveCooldown)) };
                    exp.partySnapshot.forEach((m, i) => { m._nextAttackTick = game.tick + i; });
                    enemies.forEach((e, i) => { e._nextAttackTick = game.tick + 2 + i * 2; });
                    exp._nextRareMult = 2.0;
                }
            }
            return;
        }

        if (effects.healParty && alive.length > 0) {
            const heal = Math.floor(alive[0].maxHp * effects.healParty);
            for (const m of alive) m.hp = Math.min(m.maxHp, m.hp + heal);
            this._addLog(exp, game, { key: 'msg.exp.party_healed_each', params: { amount: heal } }, 'success');
            this._stampResolution(exp, game, true);
        }
        if (effects.restoreMana) {
            for (const m of alive) {
                if (m.maxMana > 0) m.mana = Math.min(m.maxMana, m.mana + Math.floor(m.maxMana * effects.restoreMana));
            }
        }
        if (effects.trapRisk && Math.random() < effects.trapRisk) {
            const member = alive[randInt(0, alive.length - 1)];
            const dmg = randInt(EXPLORATION_CONFIG.trapDamageRange[0], EXPLORATION_CONFIG.trapDamageRange[1]);
            member.hp -= dmg;
            this._addLog(exp, game, { key: 'msg.exp.trap_springs', params: { name: member.name, dmg } }, 'danger');
            if (member.hp <= 0) this._checkExpeditionRevive(exp, member, game);
            this._stampResolution(exp, game, false);
        }
        if (effects.npcChance && exp.partySnapshot.some(p => p.hp > 0) && Math.random() < effects.npcChance) {
            const npcKeys = Object.keys(NPC_ENCOUNTERS).filter(k => {
                const n = NPC_ENCOUNTERS[k];
                return !n.realmFilter || n.realmFilter.includes(exp.realm);
            });
            if (npcKeys.length > 0) {
                const nKey = npcKeys[randInt(0, npcKeys.length - 1)];
                const npc = NPC_ENCOUNTERS[nKey];
                exp.pendingDecision = { type: 'npc', npcKey: nKey, text: defMessage(npc, 'text'), _loc: npc._loc, choices: npc.choices, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter };
                this._addLog(exp, game, defMessage(npc, 'text'), 'info');
            }
        }
        if (effects.grantLoot) {
            const dim = REALMS[exp.realm];
            const lootEntry = this._rollLoot(dim, exp.diffSettings);
            const mult = effects.grantLoot.mult || 1.0;
            if (lootEntry) {
                if (lootEntry.item) {
                    if (!exp.loot._items) exp.loot._items = [];
                    exp.loot._items.push(lootEntry.item);
                    this._addLog(exp, game, { key: 'msg.exp.found_item', params: { item: resourceRef(lootEntry.item) } }, 'loot', { itemKey: lootEntry.item });
                } else {
                    const amount = Math.floor(lootEntry.amount * mult * this._realmResourceMult(exp, lootEntry.resource));
                    exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                    this._addLog(exp, game, { key: 'msg.exp.found_resource', params: { amount, resource: resourceRef(lootEntry.resource) } }, 'loot', { itemKey: lootEntry.resource });
                }
                window.soundManager?.playExpSFX('loot_drop');
            }
        }
        if (effects.spawnCombat && exp.partySnapshot.some(p => p.hp > 0)) {
            const dim = REALMS[exp.realm];
            const countMult = effects.spawnCombat.countMult || 1.0;
            const baseCount = randInt(dim.enemies.count[0], dim.enemies.count[1]);
            const count = Math.min(10, Math.max(1, Math.round(baseCount * countMult * (exp.diffSettings?.enemyCountMult || 1))));
            const enemies = [];
            for (let j = 0; j < count; j++) {
                const eDef = this._pickEnemyFromRealm(dim);
                const hp = Math.round(randInt(eDef.hp[0], eDef.hp[1]) * this._enemyStatMults(exp).hp);
                const dmg = Math.round(randInt(eDef.damage[0], eDef.damage[1]) * this._enemyStatMults(exp).dmg);
                enemies.push({ hp, maxHp: hp, damage: dmg, name: eDef.name || null, sprite: eDef.sprite || null, color: eDef.color || null, typeKey: eDef.typeKey || null, spells: eDef.spells || null, attackAnim: eDef.attackAnim || 'Swing', ranged: eDef.attackAnim === 'DrawAndShoot' || !!eDef.ranged, projectileChar: eDef.projectileChar || null, projectileColor: eDef.projectileColor || null });
            }
            this._addLog(exp, game, { key: 'msg.exp.enemies_emerge', params: { n: count } }, 'combat');
            exp.combat = {
                enemies, round: 0, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter, isBoss: false,
                ambushEndTick: game.tick + Math.max(...exp.partySnapshot.map(m => m.effectiveCooldown)),
            };
            exp.partySnapshot.forEach((m, i) => { m._nextAttackTick = game.tick + i; });
            enemies.forEach((e, i) => { e._nextAttackTick = game.tick + 2 + i * 2; });
            this._attachWarBeasts(exp);
            this._logSynergies(exp, game);
            this._rangedFirstStrike(exp, game, enemies);
        }
        if (effects.nextLootRareMult) {
            exp._nextRareMult = effects.nextLootRareMult;
        }
        if (effects.buffEnemies) {
            for (const enc of exp.encounters.slice(exp.currentEncounter)) {
                if (enc.type === 'combat') {
                    for (const e of enc.enemies) {
                        if (effects.buffEnemies.hpMult) {
                            e.hp = Math.round(e.hp * effects.buffEnemies.hpMult);
                            e.maxHp = e.hp;
                        }
                    }
                }
            }
        }
    }

    resolveVoidPactChoice(game, expId, accept) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingVoidPactChoice) return;
        const pact = exp.pendingVoidPactChoice;
        exp.pendingVoidPactChoice = null;

        const alive = exp.partySnapshot.filter(p => p.hp > 0);

        if (accept) {
            this._addLog(exp, game, defMessage(pact, 'logAccept'), 'event');
            const fx = pact.acceptEffect;
            if (fx.partyDamage && alive.length > 0) {
                for (const m of alive) {
                    m.hp = Math.max(1, m.hp - fx.partyDamage);
                }
                this._addLog(exp, game, { key: 'msg.exp.pact_party_pays', params: { amount: fx.partyDamage } }, 'danger');
            }
            if (fx.nextPhaseDmgMult && exp.bossPhaseData) {
                exp._voidPactBossDmgMult = fx.nextPhaseDmgMult;
            }
            if (fx.weakestMemberDamage && alive.length > 0) {
                const weakest = alive.reduce((w, m) => m.hp < w.hp ? m : w, alive[0]);
                weakest.hp = Math.max(1, weakest.hp - fx.weakestMemberDamage);
                if (fx.applyVoidDrained) {
                    this._applyCombatStatus(weakest, 'void_drained', 3, { maxHpMult: 0.75 });
                }
                this._addLog(exp, game, { key: 'msg.exp.pact_weakest', params: { name: weakest.name } }, 'danger');
            }
            if (fx.bossDamage && pact.bossEnemy) {
                pact.bossEnemy.hp = Math.max(1, pact.bossEnemy.hp - fx.bossDamage);
                this._addLog(exp, game, { key: 'msg.exp.pact_boss_damage', params: { amount: fx.bossDamage } }, 'success');
            }
            if (fx.bossStun && pact.bossEnemy) {
                this._applyCombatStatus(pact.bossEnemy, 'stun', fx.bossStun);
            }
        } else {
            this._addLog(exp, game, defMessage(pact, 'logRefuse'), 'event');
        }
        this._unpauseAfterChoice(exp, game);
    }

    _applyPuzzleReward(exp, game, reward) {
        if (!reward) return;
        if (reward.type === 'bonus_loot') {
            const dim = REALMS[exp.realm];
            const lootEntry = this._rollLoot(dim, exp.diffSettings);
            if (lootEntry) {
                if (lootEntry.item) {
                    if (!exp.loot._items) exp.loot._items = [];
                    exp.loot._items.push(lootEntry.item);
                    this._addLog(exp, game, { key: 'msg.exp.found_item', params: { item: resourceRef(lootEntry.item) } }, 'loot', { itemKey: lootEntry.item });
                } else {
                    const amount = Math.floor(lootEntry.amount * (reward.mult || 1.0));
                    exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                    this._addLog(exp, game, { key: 'msg.exp.found_resource', params: { amount, resource: resourceRef(lootEntry.resource) } }, 'loot', { itemKey: lootEntry.resource });
                }
                window.soundManager?.playExpSFX('loot_drop');
            }
        }
    }

    _applyPuzzlePenalty(exp, game, penalty, member, sourceEncounterIndex) {
        if (!penalty) return;
        if (penalty.type === 'damage' && member) {
            const dmg = randInt(penalty.amount[0], penalty.amount[1]);
            member.hp -= dmg;
            if (member.hp <= 0) this._checkExpeditionRevive(exp, member, game);
        } else if (penalty.type === 'damage_all') {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            const dmg = randInt(penalty.amount[0], penalty.amount[1]);
            for (const m of alive) {
                m.hp -= dmg;
                if (m.hp <= 0) this._checkExpeditionRevive(exp, m, game);
            }
        } else if (penalty.type === 'spawn_combat') {
            const dim = REALMS[exp.realm];
            const count = Math.min(10, randInt(dim.enemies.count[0], dim.enemies.count[1]));
            const enemies = [];
            for (let j = 0; j < count; j++) {
                const eDef = this._pickEnemyFromRealm(dim);
                const hp = Math.round(randInt(eDef.hp[0], eDef.hp[1]) * this._enemyStatMults(exp).hp);
                const dmg = Math.round(randInt(eDef.damage[0], eDef.damage[1]) * this._enemyStatMults(exp).dmg);
                enemies.push({ hp, maxHp: hp, damage: dmg, name: eDef.name || null, sprite: eDef.sprite || null, color: eDef.color || null, typeKey: eDef.typeKey || null, spells: eDef.spells || null, attackAnim: eDef.attackAnim || 'Swing', ranged: eDef.attackAnim === 'DrawAndShoot' || !!eDef.ranged, projectileChar: eDef.projectileChar || null, projectileColor: eDef.projectileColor || null });
            }
            this._addLog(exp, game, { key: 'msg.exp.enemies_alerted', params: { n: count } }, 'combat');
            exp.combat = {
                enemies, round: 0, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter, isBoss: false,
                ambushEndTick: game.tick + Math.max(...exp.partySnapshot.map(m => m.effectiveCooldown)),
            };
            exp.partySnapshot.forEach((m, i) => { m._nextAttackTick = game.tick + i; });
            enemies.forEach((e, i) => { e._nextAttackTick = game.tick + 2 + i * 2; });
            this._attachWarBeasts(exp);
            this._logSynergies(exp, game);
            this._rangedFirstStrike(exp, game, enemies);
        }
    }

    _applyNpcReward(exp, game, reward) {
        if (!reward) return;
        if (reward.type === 'realm_roll') {
            this._applyPuzzleReward(exp, game, { type: 'bonus_loot', mult: reward.mult });
        } else if (reward.type === 'heal_party') {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            for (const m of alive) {
                const heal = Math.floor(m.maxHp * reward.amount);
                m.hp = Math.min(m.maxHp, m.hp + heal);
            }
            this._addLog(exp, game, { key: 'msg.exp.party_healed' }, 'success');
        } else if (reward.type === 'temp_ally' && reward.ally) {
            if (!exp.summons) exp.summons = [];
            exp.summons.push({
                type: 'npc_ally', name: reward.ally.name, nameRef: defRef(reward.ally),
                sprite: reward.ally.sprite || 'npc_ally',
                hp: reward.ally.hp, maxHp: reward.ally.hp,
                damage: reward.ally.damage,
                char: reward.ally.char || 'A', color: reward.ally.color || '#ccaa44',
                ownerId: null,
                ticksRemaining: (reward.ally.duration || 2) * 200,
                maxDuration: (reward.ally.duration || 2) * 200,
            });
            this._addLog(exp, game, { key: 'msg.exp.ally_joins', params: { ally: defRef(reward.ally) } }, 'success');
        } else if (reward.type === 'reveal_encounters') {
            const count = reward.count || 1;
            for (let i = 0; i < count && exp.currentEncounter + i < (exp.nodeMap?.length || 0); i++) {
                const node = exp.nodeMap[exp.currentEncounter + i];
                if (node) node.revealed = true;
            }
        } else if (reward.type === 'buff_party') {
            // Temporary damage buff stored on expedition
            exp._tempDamageMult = (exp._tempDamageMult || 1.0) * (reward.damageMult || 1.0);
            exp._tempDamageBuffCombats = (reward.duration || 2);
        } else if (reward.type === 'bonus_loot') {
            this._applyPuzzleReward(exp, game, reward);
        }
    }

    // Stat multipliers fixed at launch. Saves from before they were stored fall back
    // to the current difficulty, mutators and realm events.
    _enemyStatMults(exp) {
        if (!exp.enemyStatMults) {
            exp.enemyStatMults = computeEnemyStatMults(exp.diffSettings, exp.mutators, this.activeRealmEvents, exp.realm);
        }
        return exp.enemyStatMults;
    }

    // Realm-event resourceMult for one loot resource (e.g. Crystal Surge doubles
    // runite). Applied to every resource loot roll, not just combat victories.
    _realmResourceMult(exp, resource) {
        let mult = 1.0;
        for (const event of this.activeRealmEvents) {
            if (!event.realms?.includes(exp.realm)) continue;
            const m = event.effects?.resourceMult?.[resource];
            if (m) mult *= m;
        }
        return mult;
    }

    // [min, max] splash damage from the active realm events' enemyAoEDamage ranges
    // (summed when several events overlap a realm).
    _getRealmEventAoEDamage(exp) {
        let lo = 0, hi = 0;
        for (const event of this.activeRealmEvents) {
            if (!event.realms?.includes(exp.realm)) continue;
            const r = event.effects?.enemyAoEDamage;
            if (r) { lo += r[0]; hi += r[1]; }
        }
        return [lo, Math.max(lo, hi)];
    }

    _getRealmEventEffect(exp, effectKey) {
        let value = effectKey.includes('Mult') ? 1.0 : 0;
        for (const event of this.activeRealmEvents) {
            if (!event.realms?.includes(exp.realm)) continue;
            const val = event.effects?.[effectKey];
            if (val === undefined) continue;
            if (effectKey.includes('Mult')) value *= val;
            else value += val;
        }
        return value;
    }

    _tickRealmEvents(game) {
        if (game.tick % REALM_EVENT_CONFIG.checkInterval !== 0) return;

        for (let i = this.activeRealmEvents.length - 1; i >= 0; i--) {
            if (game.tick >= this.activeRealmEvents[i].endTick) {
                this.activeRealmEvents.splice(i, 1);
            }
        }

        if (this.activeRealmEvents.length >= REALM_EVENT_CONFIG.maxActiveEvents) return;
        if (Math.random() >= REALM_EVENT_CONFIG.baseChance) return;

        const keys = Object.keys(REALM_EVENTS);
        if (keys.length === 0) return;
        const totalWeight = keys.reduce((s, k) => s + (REALM_EVENTS[k].weight || 1), 0);
        let roll = Math.random() * totalWeight;
        for (const key of keys) {
            const event = REALM_EVENTS[key];
            roll -= (event.weight || 1);
            if (roll <= 0) {
                if (this.activeRealmEvents.some(e => e.key === key)) break;
                const duration = randInt(event.duration[0], event.duration[1]);
                this.activeRealmEvents.push({
                    key, name: event.name, description: event.description,
                    realms: event.realms, effects: event.effects,
                    startTick: game.tick, endTick: game.tick + duration,
                });
                break;
            }
        }
    }
}

const PEDESTAL_TO_EXPEDITION = {
    damageBonusMult: 'partyDamageMult',
    workSpeedBonus: null,
    skillGrowthBonus: null,
    blightImmunity: null,
};

// Enemy HP/damage multipliers for a run: difficulty x mutators x the realm events
// active in that realm. Shared by encounter generation and every later spawn
// (boss phases, summoned adds, decision/puzzle ambushes) so they scale alike.
function computeEnemyStatMults(diffSettings, mutators, activeRealmEvents, realmKey) {
    let hp = diffSettings?.enemyHpMult || 1;
    let dmg = diffSettings?.enemyDmgMult || 1;
    for (const mutKey of mutators || []) {
        const mut = EXPEDITION_MUTATORS[mutKey];
        if (mut?.effects?.enemyHpMult) hp *= mut.effects.enemyHpMult;
        if (mut?.effects?.enemyDmgMult) dmg *= mut.effects.enemyDmgMult;
    }
    for (const event of activeRealmEvents || []) {
        if (!event.realms?.includes(realmKey)) continue;
        if (event.effects?.enemyHpMult) hp *= event.effects.enemyHpMult;
        if (event.effects?.enemyDmgMult) dmg *= event.effects.enemyDmgMult;
    }
    return { hp, dmg };
}

// Single source of truth for a party-wide expedition effect. Aggregates, per living
// member: equipped-item bonuses, active pedestal bonuses (mapped keys), flat trait
// bonuses (expedition.<key>), and realm-specific trait bonuses
// (expedition.realmBonus.<realm>.<key>) when `realm` is supplied. Each contributor is
// counted exactly once. Do NOT also sum trait effects at the call site, or they double.
// 'Mult' keys compose multiplicatively (base 1.0), others sum (base 0).
function getPartyExpeditionEffect(partySnapshot, effectKey, realm) {
    const isMult = effectKey.includes('Mult');
    let value = isMult ? 1.0 : 0;
    const apply = (v) => { if (isMult) value *= v; else value += v; };
    for (const member of partySnapshot) {
        if (member.hp <= 0) continue;
        const items = [member.weapon, member.armor, member.helmet, member.clothes, member.boots, member.tool, member.trinket].filter(Boolean);
        for (const item of member.consumedItems || []) {
            if (item.expedition?.[effectKey]) apply(item.expedition[effectKey]);
        }
        for (const item of items) {
            if (item.expedition?.[effectKey]) apply(item.expedition[effectKey]);
            if (item.pedestal && typeof item.pedestal.radius === 'number') {
                for (const [pedestalKey, mappedKey] of Object.entries(PEDESTAL_TO_EXPEDITION)) {
                    if (mappedKey !== effectKey) continue;
                    if (!item.pedestal[pedestalKey]) continue;
                    apply(item.pedestal[pedestalKey]);
                }
            }
        }
        if (member.traits) {
            for (const traitKey of member.traits) {
                const t = TRAITS[traitKey];
                if (!t?.expedition) continue;
                if (t.expedition[effectKey]) apply(t.expedition[effectKey]);
                if (realm && t.expedition.realmBonus?.[realm]?.[effectKey]) apply(t.expedition.realmBonus[realm][effectKey]);
            }
        }
    }
    return value;
}

// Party synergy: a per-member outgoing-damage multiplier driven by how the member
// feels about the other living party members. Fighting beside friends/lovers (high
// opinion) emboldens them; fighting beside rivals (low opinion) makes them bicker.
// Bonuses and penalties stack across companions but each side is capped, and they
// net against each other, so a member with both a friend and a rival present ends
// up near neutral. Returns 1.0 when there is no one to synergize with.
function getSynergyDamageMult(member, partySnapshot) {
    const cfg = EXPLORATION_CONFIG.synergy;
    if (!cfg || !member.opinions) return 1.0;
    let bonus = 0;
    let penalty = 0;
    for (const other of partySnapshot) {
        if (other.id === member.id || other.hp <= 0) continue;
        const opinion = member.opinions[other.id] ?? 0;
        if (opinion >= cfg.allyOpinion) bonus += cfg.allyDamageBonus;
        else if (opinion <= cfg.rivalOpinion) penalty += cfg.rivalDamagePenalty;
    }
    bonus = Math.min(bonus, cfg.maxAllyBonus);
    penalty = Math.min(penalty, cfg.maxRivalPenalty);
    return Math.max(0.1, 1 + bonus - penalty);
}

// Message for line `i` of a config list of flavor lines (realm.events.ambient,
// EXPLORATION_EVENTS.combatHit, ...): `<owner._loc>.<field>.<i>`, or
// `<loc>.<field>.<i>` for a list whose owner isn't stamped. Falls back to the
// inline line with the params filled in (mod content without a locale key).
function lineMessage(owner, field, i, params, loc) {
    const prefix = owner?._loc || loc;
    if (prefix && hasKey(`${prefix}.${field}.${i}`)) return { key: `${prefix}.${field}.${i}`, params };
    return defMessage(owner, `${field}.${i}`, params);
}

// A ref to a config entry's text field, or null when it has none or isn't stamped.
function locRef(def, field) {
    return def?._loc && def[field] ? defRef(def, field) : null;
}

// A log message ({ key, params } or text) as a param of another message.
function messageParam(m) {
    return m && typeof m === 'object' ? ref(m.key, null, m.params) : (m ?? '');
}

// EXPLORATION_EVENTS is a map of lists, so its entries carry no `_loc`.
function eventLine(field, i, params) {
    return lineMessage(EXPLORATION_EVENTS, field, i, params, 'exp_event');
}

// One param for a comma-separated list of params, nested as "{a}, {b}" refs so
// each item is translated when shown.
function listRef(items) {
    if (items.length === 0) return '';
    return items.slice(0, -1).reduceRight((rest, item) => ref('msg.exp.list_join', null, { a: item, b: rest }), items[items.length - 1]);
}

// Log params naming things. They are refs, so saved logs show the active language.
function realmRef(key, fallback) {
    return REALMS[key] ? defRef(REALMS[key]) : (fallback || key);
}

function enemyNameRef(enemy) {
    if (enemy.nameRef) return enemy.nameRef;
    const def = !enemy.isBoss && enemy.typeKey ? EXPEDITION_ENEMIES[enemy.typeKey] : null;
    return def ? defRef(def) : (enemy.name || '');
}

function eliteRef(enemy) {
    const mod = ELITE_MODIFIERS[enemy.elite];
    return mod ? defRef(mod, 'prefix') : (enemy.eliteName || '');
}

// How the log names a foe: the boss by name, an elite by its modifier, others as
// "an enemy" (`capital` for the start of a sentence).
function foeLabel(enemy, capital = false) {
    if (enemy.isBoss) return enemyNameRef(enemy);
    if (enemy.elite) return ref('msg.exp.label.elite_enemy', `${enemy.eliteName} enemy`, { elite: eliteRef(enemy) });
    return capital ? ref('msg.exp.label.an_enemy_cap', 'An enemy') : ref('msg.exp.label.an_enemy', 'an enemy');
}

// A boss phase's log label. Mask phases (the Unraveler) carry their own ref.
function phaseNameRef(phase) {
    if (phase.nameRef) return phase.nameRef;
    return phase._loc ? defRef(phase) : (phase.name || '');
}

// Bestiary label of a boss phase: its name, else (mask phases) its display name.
function bestiaryPhaseRef(phase) {
    if (phase.name) return phaseNameRef(phase);
    return phase.displayNameRef || phase.displayName || null;
}

// "a foe", or the boss's name.
function foeOrBoss(enemy) {
    return enemy.isBoss ? enemyNameRef(enemy) : ref('msg.exp.label.a_foe', 'a foe');
}

// Summons, encounter allies and war beasts.
function companionRef(c) {
    if (c.nameRef) return c.nameRef;
    return ENTITIES[c.type] ? entityRef(c.type) : (c.name || '');
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Runs `fn` and then rewinds the expedition id counter, so sandboxed what-if
// expeditions (see expedition-forecast.js) don't consume real expedition ids.
export function withPreservedExpeditionIds(fn) {
    const saved = nextExpeditionId;
    try { return fn(); } finally { nextExpeditionId = saved; }
}

// Returns the item a colonist will have in a given slot once they enter an expedition.
// If they have an Expedition set override for that slot it takes priority; otherwise
// falls back to whatever is currently equipped.
export function getExpeditionSlotItem(c, slot) {
    const override = c.equipmentSets?.Expedition?.[slot];
    return override !== undefined && override !== null ? override : c[slot];
}

// Party summary for the expedition setup panel: per-member damage, HP, DR, spells
// and traits, party-wide gear effects and best skill-check holders. The success
// chance comes from createExpeditionForecast (expedition-forecast.js), which plays
// the real simulation instead of approximating it.
export function estimatePartyStrength(game, colonistIds, realmKey) {
    const realm = REALMS[realmKey];
    if (!realm) return null;

    // Precompute back-row set from the UI state (accessed via game.ui if available)
    const backRowIds = (game.ui && game.ui._expBackRowIds) ? game.ui._expBackRowIds : new Set();

    let totalDmg = 0, totalHp = 0, drProduct = 1, size = 0;
    const members = [];
    const spellRoster = [];

    for (const id of colonistIds) {
        const c = game.getColonist(id);
        if (!c || c.hp <= 0) continue;
        size++;
        const expWeapon = getExpeditionSlotItem(c, 'weapon');
        let dmg = expWeapon ? expWeapon.damage : EXPLORATION_CONFIG.baseFistDamage;
        const items = ['weapon','armor','helmet','clothes','boots','tool','trinket'].map(s => getExpeditionSlotItem(c, s)).filter(Boolean);
        for (const item of items) {
            if (item !== expWeapon && item.damage) dmg += item.damage;
        }
        const baseCd = (expWeapon && expWeapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
        const atkSpeed = 1 + items.reduce((sum, item) => sum + (item.attackSpeed || 0), 0);
        const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
        const hitsPerRound = Math.max(1, Math.round(baseCd / effCd));

        // Apply Sharpness (damageMultiplier) from enchantments
        const dmgMultiplier = items.reduce((prod, item) => item.damageMultiplier ? prod * item.damageMultiplier : prod, 1);
        // Crit chance increases effective DPS: each crit doubles the hit, net +critChance fraction of DPS
        const critChance = Math.min(1.0, items.reduce((sum, item) => sum + (item.critChance || 0), 0));
        // Formation bonus: back-row members deal less with melee weapons (ranged/casters in back are not penalised here)
        const isBackRow = backRowIds.has(id);
        const isRanged = expWeapon && expWeapon.ranged;
        const formDmgMult = isBackRow ? (isRanged ? 1.0 : FORMATION_CONFIG.rows.back.meleeDamageMult) : FORMATION_CONFIG.rows.front.meleeDamageMult;
        // Adventurer XP level damage bonus
        const xpDmgMult = game.exploration ? game.exploration._getXpLevelBonus(id, 'expeditionDamageMult') : 1.0;

        const memberDmg = Math.round(dmg * hitsPerRound * dmgMultiplier * (1 + critChance) * formDmgMult * xpDmgMult);
        totalDmg += memberDmg;
        const expMaxHp = COLONIST_CONFIG.maxHp + items.reduce((sum, item) => sum + (item.maxHpBonus || 0), 0);
        totalHp += expMaxHp;
        let dr = 1;
        for (const item of items) {
            if (item.damageReduction) dr *= (1 - item.damageReduction);
        }
        drProduct *= dr;

        const combatTraits = [];
        const expeditionTraits = [];
        for (const traitKey of (c.traits || [])) {
            const t = TRAITS[traitKey];
            if (t && t.damageReduction) combatTraits.push({ name: t.name, description: t.description });
            if (t?.expedition) expeditionTraits.push({ name: t.name, effects: Object.keys(t.expedition).join(', ') });
        }

        const expLevel = game.exploration?.getExpeditionLevel(id) || 0;
        const fatigue = game.exploration?.isFatigued(id, game.tick) || false;

        const memberSpells = [];
        for (const spellKey of (c.knownSpells || [])) {
            if (c.disabledSpells && c.disabledSpells.includes(spellKey)) continue;
            const spell = SPELLS[spellKey];
            if (!spell) continue;
            // Only attuned spells autocast on expeditions, so leave the rest out of the
            // roster preview. It should show what the party will actually cast.
            if (!isSpellAttuned(c, spell)) continue;
            const isExpeditionRelevant = spell.trigger === 'inCombat' || spell.trigger === 'lowHealth' || spell.trigger === 'woundedNearby' || spell.trigger === 'debuffNearby';
            if (!isExpeditionRelevant) continue;
            memberSpells.push(spellKey);
            const existing = spellRoster.find(s => s.spellKey === spellKey);
            if (existing) {
                existing.casters.push(c.name);
            } else {
                // Shown in the setup panel only (not saved), so plain text.
                const fd = (key, params) => tr(`msg.forecast.effect.${key}`, params);
                let effectDesc;
                if (spell.effect === 'ranged_damage') effectDesc = fd('ranged_damage', { dmg: spell.damage });
                else if (spell.effect === 'ranged_damage_aoe') effectDesc = fd('ranged_damage_aoe', { dmg: spell.damage });
                else if (spell.effect === 'melee_damage') effectDesc = fd('melee_damage', { dmg: spell.damage });
                else if (spell.effect === 'chain_damage') effectDesc = fd('chain_damage', { dmg: spell.damage, n: spell.chainTargets });
                else if (spell.effect === 'ranged_damage_slow') effectDesc = fd('ranged_damage_slow', { dmg: spell.damage });
                else if (spell.effect === 'heal') effectDesc = fd('heal', { hp: spell.healAmount });
                else if (spell.effect === 'chain_heal') effectDesc = fd('chain_heal', { hp: spell.healAmount, n: spell.chainTargets });
                else if (spell.effect === 'cleanse') effectDesc = fd('cleanse');
                else if (spell.effect === 'buff_defense') effectDesc = fd('buff_defense', { pct: Math.round(spell.damageReduction * 100) });
                else if (spell.effect === 'absorb_shield') effectDesc = fd('absorb_shield', { dmg: spell.absorbAmount });
                else if (spell.effect === 'stun') effectDesc = spell.chainTargets > 1 ? fd('stun_many', { n: spell.chainTargets }) : fd('stun_one');
                else if (spell.effect === 'teleport') {
                    const charges = spell.range >= 15 ? 3 : spell.range >= 10 ? 2 : 1;
                    effectDesc = tp('msg.forecast.effect.teleport', charges);
                } else if (spell.effect === 'summon') {
                    const st = SUMMON_TYPES[spell.summonType];
                    effectDesc = st ? fd('summon', { summon: entityName(spell.summonType), hp: st.hp, dmg: st.damage }) : fd('summon_ally');
                } else if (spell.effect === 'summon_swarm') {
                    const st = SUMMON_TYPES[spell.summonType];
                    effectDesc = st ? fd('summon_swarm', { n: spell.swarmCount, summon: entityName(spell.summonType) }) : fd('summon_swarm_generic');
                } else effectDesc = spell.effect;
                // '<' is a param because the table checker reads '<' in a value as markup.
                let triggerDesc = spell.trigger === 'inCombat' ? tr('msg.forecast.trigger.in_combat')
                    : spell.trigger === 'debuffNearby' ? tr('msg.forecast.trigger.debuffed')
                    : tr('msg.forecast.trigger.ally_hp_below', { lt: '<', pct: Math.round((spell.hpThreshold || 0.5) * 100) });
                spellRoster.push({ spellKey, name: spell.name, school: spell.school, casters: [c.name], manaCost: spell.manaCost, triggerDesc, effectDesc });
            }
        }

        const expTrinket = getExpeditionSlotItem(c, 'trinket');
        members.push({
            name: c.name, id: c.id, dmgPerRound: memberDmg, hitsPerRound, hp: expMaxHp,
            dr: Math.round((1 - dr) * 100), maxMana: c.maxMana || 0,
            traits: combatTraits, expeditionTraits, spells: memberSpells,
            trinketName: expTrinket ? (itemName(expTrinket) || null) : null,
            expLevel, fatigued: fatigue,
        });
    }

    if (size === 0) return null;
    const avgDR = 1 - Math.pow(drProduct, 1 / size);

    const partyEffects = {};
    const effectKeys = ['partyDamageMult', 'trapDamageMult', 'lootMult', 'rareEncounterMult', 'durationMult'];
    const mockSnapshot = colonistIds.map(id => {
        const c = game.getColonist(id);
        if (!c) return null;
        return {
            hp: c.hp, traits: c.traits || [],
            weapon:  getExpeditionSlotItem(c, 'weapon'),
            armor:   getExpeditionSlotItem(c, 'armor'),
            helmet:  getExpeditionSlotItem(c, 'helmet'),
            clothes: getExpeditionSlotItem(c, 'clothes'),
            boots:   getExpeditionSlotItem(c, 'boots'),
            tool:    getExpeditionSlotItem(c, 'tool'),
            trinket: c.trinketBroken ? null : getExpeditionSlotItem(c, 'trinket'),
        };
    }).filter(Boolean);
    for (const key of effectKeys) {
        const val = getPartyExpeditionEffect(mockSnapshot, key, realmKey);
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

    const skillChecks = {};
    const relevantSkills = new Set();
    for (const puzzle of Object.values(PUZZLE_ENCOUNTERS)) {
        if (puzzle.realmFilter && !puzzle.realmFilter.includes(realmKey)) continue;
        for (const check of (puzzle.checks || [])) {
            if (check.requirement?.skill) relevantSkills.add(check.requirement.skill);
        }
    }
    for (const skillKey of relevantSkills) {
        let best = 0, bestName = null;
        for (const id of colonistIds) {
            const c = game.getColonist(id);
            if (!c || c.hp <= 0) continue;
            const level = c.skills?.[skillKey] || 0;
            if (level > best) { best = level; bestName = c.name; }
        }
        if (best > 0) {
            const def = SKILLS[skillKey];
            skillChecks[skillKey] = { name: def?.name || skillKey, level: best, colonist: bestName };
        }
    }

    return { totalDmg, totalHp, avgDR: Math.round(avgDR * 100), size, members, partyEffects, spellRoster, skillChecks };
}

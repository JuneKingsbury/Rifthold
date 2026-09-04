import { REALMS, DEMO_ALLOWED_REALM_CHAINS, EXPLORATION_CONFIG, EXPEDITION_DIFFICULTY, EXPLORATION_EVENTS, SPELLS, MAGIC_SKILLS, MAGIC_STUDY_CONFIG, TRINKETS, ALL_ITEMS, COLONIST_CONFIG, TRAITS, SUMMON_TYPES, SKILLS,
    FORMATION_CONFIG, EXPEDITION_TRAPS, EXPEDITION_ENEMIES, ELITE_MODIFIERS, ELITE_CONFIG,
    EXPEDITION_DECISIONS, PUZZLE_ENCOUNTERS, NPC_ENCOUNTERS,
    EXPEDITION_POTIONS, POTION_CARRY_CONFIG, EXPEDITION_MUTATORS,
    FATIGUE_CONFIG, STREAK_CONFIG, EXPEDITION_XP_CONFIG,
    REALM_EVENTS, REALM_EVENT_CONFIG, BESTIARY_CONFIG, NODE_MAP_CONFIG,
} from '../core/config.js';
import { getEquipmentStat, getEquippedItems, invalidateEquipStatCache, isSpellAttuned } from '../entities/colonist.js';

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
import { findPathAdjacent, manhattanDist } from '../world/pathfinding.js';
import { getTargetPriority } from '../ui/ui-utils.js';
import { getSpellCooldownMult } from './complexBuildings.js';

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

    canSend(game, realmKey) {
        const dim = REALMS[realmKey];
        if (!dim) return false;
        if (this._isRealmDemoLocked(game, dim)) return false;
        if (dim.research && !game.research.isResearched(dim.research)) return false;
        if (dim.requiresEvent && !this._checkEvent(game, dim.requiresEvent)) return false;
        if (!game.power || !game.power.powered) return false;
        if (!game.mapIndex || game.mapIndex.getStructurePositions('rift_gate').size === 0) return false;
        return true;
    }

    getAvailableRealms(game) {
        const results = [];
        for (const [key, dim] of Object.entries(REALMS)) {
            if (this._isRealmDemoLocked(game, dim)) continue;
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

    sendExpedition(game, realmKey, colonistIds, packAnimalIds = [], difficulty = 1, options = {}) {
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
            if (this.fatigueCooldowns[id] && game.tick < this.fatigueCooldowns[id]) continue;
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
            // Trait-based duration (e.g. Trailblazer). The expedition object doesn't
            // exist yet, so scan the party directly like the equipment loop below.
            for (const traitKey of (c.traits || [])) {
                const mult = TRAITS[traitKey]?.expedition?.durationMult;
                if (mult) durationMult *= mult;
            }
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

        const mutators = options.mutators || [];
        for (const mutKey of mutators) {
            const mut = EXPEDITION_MUTATORS[mutKey];
            if (mut?.effects?.durationMult) durationMult *= mut.effects.durationMult;
        }

        const formation = options.formation || { front: party.map(c => c.id), back: [] };

        if (durationMult !== 1.0) duration = Math.floor(duration * durationMult);
        const diffSettings = EXPEDITION_DIFFICULTY[difficulty] || EXPEDITION_DIFFICULTY[1];
        const { encounters, bossEncounter } = this._generateEncounters(dim, diffSettings, mutators, realmKey);

        const nodeMap = this._generateNodeMap(encounters, bossEncounter);

        const potionSupply = {};
        if (options.potions) {
            for (const [potionKey, count] of Object.entries(options.potions)) {
                const def = EXPEDITION_POTIONS[potionKey];
                if (!def || count <= 0) continue;
                const available = game.resources.getPotionCount?.(def.resource) ?? 0;
                const take = Math.min(count, def.maxCarry, available);
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
            nodeMap,
            summary: {
                damageDealt: {}, damageTaken: {}, spellsCast: {},
                killCount: {}, healingDone: {},
                potionsUsed: 0, decisionsCount: 0, puzzlesSolved: 0,
            },
        };

        this.expeditions.push(expedition);
        const diffLabel = diffSettings.name !== 'Normal' ? ` (${diffSettings.name})` : '';
        const mutLabel = mutators.length > 0 ? ` [${mutators.map(k => EXPEDITION_MUTATORS[k]?.name || k).join(', ')}]` : '';
        game.eventLog.add(game, `Expedition assembling for ${dim.name}${diffLabel}${mutLabel}`, 'event', null);
        return expedition;
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
                exp.startTick++;
                if (!exp._wasPaused) {
                    exp._wasPaused = true;
                    if (!game.paused) game.togglePause();
                }
                continue;
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

                if (exp.summons && exp.summons.length > 0) {
                    for (let si = exp.summons.length - 1; si >= 0; si--) {
                        exp.summons[si].ticksRemaining--;
                        if (exp.summons[si].ticksRemaining <= 0) {
                            this._addLog(exp, game, `The ${exp.summons[si].name} fades away.`, 'info');
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
                    this._addLog(exp, game, 'All explorers defeated. Retreating empty-handed.', 'danger');
                    exp.loot = {};
                }

                const expeditionDone = exp.bossEncounter
                    ? (exp.bossTriggered && !exp.combat)
                    : (allEncountersDone && !exp.combat);
                if (expeditionDone && exp.status === 'exploring') {
                    exp.status = 'returning';
                    exp.walkOffTick = game.tick + (exp.bossEncounter ? 80 : 60);
                    this._addLog(exp, game, 'Expedition complete. Returning home.', 'success');
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
        if (!exp || exp.status !== 'exploring') return false;
        exp.status = 'returning';
        exp.manualRetreat = true;
        exp.retreatStartTick = game.tick;
        exp.retreatTick = game.tick + Math.floor(EXPLORATION_CONFIG.retreatTicks * 0.5);
        this._addLog(exp, game, 'Retreat ordered. Returning with collected loot.', 'info');
        return true;
    }

    _unpauseAfterChoice(exp, game) {
        if (exp._wasPaused && !exp.pendingDecision) {
            exp._wasPaused = false;
            if (game.paused) game.togglePause();
        }
    }

    resolveDecision(game, expId, choiceIndex) {
        const exp = this.expeditions.find(e => e.id === expId);
        if (!exp || !exp.pendingDecision) return false;
        const decision = exp.pendingDecision;
        const choice = decision.choices[choiceIndex];
        if (!choice) return false;

        const member = exp.partySnapshot.find(p => p.hp > 0) || exp.partySnapshot[0];
        const logText = (choice.logText || '').replace('{name}', member?.name || 'The party');
        if (logText) this._addLog(exp, game, logText, 'info');

        exp.pendingDecision = null;
        this._applyDecisionEffects(exp, game, choice.effects || {}, decision.encounterIndex);
        exp.summary.decisionsCount++;
        this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerDecision);

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
            this._addLog(exp, game, 'The party decides to move on.', 'info');
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
            const text = check.success.text.replace('{name}', bestMember?.name || 'The party');
            this._addLog(exp, game, text, 'success');
            if (check.success.reward) this._applyPuzzleReward(exp, game, check.success.reward);
            if (check.success.penalty) this._applyPuzzlePenalty(exp, game, check.success.penalty, bestMember, puzzle.encounterIndex);
            exp.summary.puzzlesSolved++;
            this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerPuzzleSolved);
        } else if (check.failure) {
            const text = check.failure.text.replace('{name}', bestMember?.name || 'The party');
            this._addLog(exp, game, text, 'danger');
            if (check.failure.penalty) this._applyPuzzlePenalty(exp, game, check.failure.penalty, bestMember, puzzle.encounterIndex);
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
            this._addLog(exp, game, 'The party moves on.', 'info');
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
                    this._addLog(exp, game, 'No one in the party can do that.', 'info');
                    return false;
                }
            }
        }
        const member = alive[0] || exp.partySnapshot[0];

        if (choice.cost) {
            if (choice.cost.mana) {
                const caster = alive.find(m => m.mana >= choice.cost.mana);
                if (!caster) {
                    this._addLog(exp, game, 'Not enough mana to do that.', 'info');
                    return false;
                }
                caster.mana -= choice.cost.mana;
            }
            if (choice.cost.potionSlots) {
                const totalPotions = Object.values(exp.potionSupply || {}).reduce((s, v) => s + v, 0);
                if (totalPotions < choice.cost.potionSlots) {
                    this._addLog(exp, game, 'Not enough potions to share.', 'info');
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
                    this._addLog(exp, game, `Not enough ${res.replace(/_/g, ' ')} to do that.`, 'info');
                    return false;
                }
                game.resources.deduct({ [res]: amt });
            }
        }

        if (choice.result) {
            const text = choice.result.text.replace('{name}', member?.name || 'The party');
            this._addLog(exp, game, text, choice.result.reward ? 'success' : 'info');
            if (choice.result.reward) this._applyNpcReward(exp, game, choice.result.reward);
            if (choice.result.penalty) this._applyPuzzlePenalty(exp, game, choice.result.penalty, member, npc.encounterIndex);
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
            this._addLog(exp, game, `The party braces for impact!`, 'info');
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
            const text = (check.successText || 'Trap avoided!').replace('{name}', bestMember?.name || 'The party');
            this._addLog(exp, game, text, 'success');
        } else {
            const text = (check.failText || 'The trap triggers!').replace('{name}', bestMember?.name || 'The party');
            this._addLog(exp, game, text, 'danger');
            this._applyTrapDamage(exp, game, trapDef, alive, ds);
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
        const member = alive[randInt(0, alive.length - 1)];
        const trapMult = getPartyExpeditionEffect(exp.partySnapshot, 'trapDamageMult', exp.realm);
        const xpTrapMult = this._getXpLevelBonus(member.id, 'trapDamageMult');
        const baseDmg = randInt(trapDef.initialDamage[0], trapDef.initialDamage[1]);
        const dmg = Math.max(0, Math.floor(baseDmg * trapMult * xpTrapMult * (ds.trapDmgMult || 1)));

        if (dmg > 0) {
            member.hp -= dmg;
            this._addLog(exp, game, `${member.name} takes ${dmg} damage!`, 'danger');
            if (exp.summary) exp.summary.damageTaken[member.id] = (exp.summary.damageTaken[member.id] || 0) + dmg;
        }

        if (trapDef.damageType === 'dot' && trapDef.dotDamage) {
            exp.activeEffects.push({
                type: 'dot', targetId: member.id,
                damageRange: trapDef.dotDamage, ticksRemaining: trapDef.dotTicks,
                interval: trapDef.dotInterval, lastTick: game.tick,
            });
            this._addLog(exp, game, `${member.name} is poisoned!`, 'danger');
        }
        if (trapDef.damageType === 'mana' && trapDef.manaDrain) {
            const drain = randInt(trapDef.manaDrain[0], trapDef.manaDrain[1]);
            member.mana = Math.max(0, member.mana - drain);
            this._addLog(exp, game, `${member.name} loses ${drain} mana!`, 'danger');
        }
        if (trapDef.damageType === 'equipment' && trapDef.effect?.disableRandomSlot) {
            const equipSlots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
            const equippedSlots = equipSlots.filter(s => member[s]);
            if (equippedSlots.length > 0) {
                const slot = equippedSlots[randInt(0, equippedSlots.length - 1)];
                if (!member._disabledSlots) member._disabledSlots = {};
                member._disabledSlots[slot] = (trapDef.effect.disableDuration || 3);
                this._addLog(exp, game, `${member.name}'s ${slot} was disabled!`, 'danger');
            }
        }

        if (member.hp <= 0) {
            this._checkExpeditionRevive(exp, member, game);
        }
    }

    savePartyPreset(name, colonistIds, formation, potions, mutators) {
        const existing = this.partyPresets.findIndex(p => p.name === name);
        const preset = {
            name,
            colonistIds: [...colonistIds],
            formation: formation ? { front: [...formation.front], back: [...formation.back] } : null,
            potions: potions ? { ...potions } : {},
            mutators: mutators ? [...mutators] : [],
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

    _addLog(exp, game, text, type = 'info') {
        const tick = game ? game.tick : 0;
        exp.log.push({ tick, text, type });
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
        window.soundManager?.playExpSFX('colonist_death');
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
                };
            });
            this._addLog(exp, game, `Party entered ${REALMS[exp.realm].name}`, 'info');
            game.eventLog.add(game, `Expedition entered ${exp.realmName}`, 'event', null);
            exp.lastMicroEventTick = game.tick;
        }
    }

    _generateEncounters(dim, diffSettings, mutators = [], realmKey = '') {
        const encounters = [];
        const totalEncounters = dim.encounters + (diffSettings.extraEncounters || 0);

        let mutEnemyHpMult = 1.0;
        let mutEnemyDmgMult = 1.0;
        for (const mutKey of mutators) {
            const mut = EXPEDITION_MUTATORS[mutKey];
            if (mut?.effects?.enemyHpMult) mutEnemyHpMult *= mut.effects.enemyHpMult;
            if (mut?.effects?.enemyDmgMult) mutEnemyDmgMult *= mut.effects.enemyDmgMult;
        }
        for (const event of this.activeRealmEvents) {
            if (!event.realms?.includes(realmKey)) continue;
            if (event.effects?.enemyHpMult) mutEnemyHpMult *= event.effects.enemyHpMult;
            if (event.effects?.enemyDmgMult) mutEnemyDmgMult *= event.effects.enemyDmgMult;
        }
        const hpMult = diffSettings.enemyHpMult * mutEnemyHpMult;
        const dmgMult = diffSettings.enemyDmgMult * mutEnemyDmgMult;

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
            encounters.push({ type: 'loot', ...lootEntry });
        }

        for (let i = encounters.length - 1; i > 0; i--) {
            const j = randInt(0, i);
            [encounters[i], encounters[j]] = [encounters[j], encounters[i]];
        }

        let bossEncounter = null;
        if (dim.boss) {
            const boss = dim.boss;
            const maxPhases = diffSettings.bossPhases || 2;
            const phases = boss.phases.slice(0, maxPhases);
            const phase0 = phases[0];
            const bossHp = Math.round(phase0.hp * hpMult);
            const bossDmg = Math.round(phase0.damage * dmgMult);
            bossEncounter = {
                type: 'combat', isBoss: true,
                bossPhases: phases,
                enemies: [{
                    hp: bossHp, maxHp: bossHp, damage: bossDmg,
                    isBoss: true, name: boss.name,
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
            const rareEncounterMult = getPartyExpeditionEffect(exp.partySnapshot, 'rareEncounterMult', exp.realm);
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
                text: trapDef.text,
                checks: trapDef.checks,
                remainingTicks: Math.max(0, exp.nextEncounterTick - game.tick),
            };
            this._addLog(exp, game, trapDef.text, 'danger');
            window.soundManager?.playExpSFX('wave_alert');
        } else if (roll < EXPLORATION_CONFIG.trapChance + EXPLORATION_CONFIG.findItemChance) {
            const lootEntry = this._rollLoot(dim, ds);
            const lootMult = getPartyExpeditionEffect(exp.partySnapshot, 'lootMult', exp.realm);
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
            window.soundManager?.playExpSFX('loot_drop');
        } else {
            const ambientPool = (dimEvents && dimEvents.ambient) || EXPLORATION_EVENTS.ambient;
            const msg = pickRandom(ambientPool).replace('{name}', member.name);
            this._addLog(exp, game, msg, 'ambient');
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

        this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerEncounter);

        if (encounter.type === 'decision') {
            exp.pendingDecision = {
                type: 'decision',
                decisionKey: encounter.decisionKey,
                text: encounter.text,
                choices: encounter.choices,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, encounter.text, 'info');
            return;
        }

        if (encounter.type === 'puzzle') {
            exp.pendingDecision = {
                type: 'puzzle',
                puzzleKey: encounter.puzzleKey,
                text: encounter.text,
                checks: encounter.checks,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, encounter.text, 'info');
            return;
        }

        if (encounter.type === 'npc') {
            exp.pendingDecision = {
                type: 'npc',
                npcKey: encounter.npcKey,
                text: encounter.text,
                choices: encounter.choices,
                encounterIndex: exp.currentEncounter,
            };
            this._addLog(exp, game, encounter.text, 'info');
            this._updateBestiary(exp, 'npc', encounter.npcKey, { name: encounter.name || encounter.text.slice(0, 40), lore: encounter.lore || '', sprite: encounter.sprite || null });
            return;
        }

        if (encounter.type === 'loot') {
            const member = exp.partySnapshot.find(p => p.hp > 0) || exp.partySnapshot[0];
            const dim = REALMS[exp.realm];
            const discPool = (dim.events && dim.events.discoveries) || EXPLORATION_EVENTS.discoveries;
            const msg = pickRandom(discPool).replace('{name}', member.name);
            if (encounter.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(encounter.item);
                const itemName = ALL_ITEMS[encounter.item]?.name || encounter.item;
                this._addLog(exp, game, `${msg} (found ${itemName}!)`, 'loot');
            } else {
                const streakMult = exp.streakMultiplier || 1.0;
                const amount = Math.floor(encounter.amount * streakMult);
                exp.loot[encounter.resource] = (exp.loot[encounter.resource] || 0) + amount;
                this._addLog(exp, game, `${msg} (+${amount} ${encounter.resource.replace(/_/g, ' ')})`, 'loot');
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
            const approachMsg = dim.boss?.approachText || `A powerful foe blocks the path: ${bossEnemy.name}!`;
            this._addLog(exp, game, approachMsg, 'danger');
            window.soundManager?.playExpSFX('wave_alert');
            this._updateBestiary(exp, 'boss', bossEnemy.name, { name: bossEnemy.name, sprite: bossEnemy.sprite || dim.boss?.sprite, color: bossEnemy.color || dim.boss?.color, lore: dim.boss?.lore || '' });

            if (encounter.bossPhases) {
                exp.bossPhaseData = {
                    currentPhaseIndex: 0,
                    phases: encounter.bossPhases,
                };
            }
        } else {
            const startMsg = pickRandom(EXPLORATION_EVENTS.combatStart);
            const eliteNames = enemies.filter(e => e.elite).map(e => e.eliteName);
            const eliteNote = eliteNames.length > 0 ? ` (includes ${eliteNames.join(', ')} elite!)` : '';
            this._addLog(exp, game, `${startMsg} (${enemies.length} foes)${eliteNote}`, 'combat');
            window.soundManager?.playExpSFX('wave_alert');

            for (const e of enemies) {
                const bKey = e.typeKey || `enemy_${exp.realm}`;
                const bName = e.name || `${REALMS[exp.realm]?.name || exp.realm} Creature`;
                const catalogEntry = e.typeKey ? EXPEDITION_ENEMIES[e.typeKey] : null;
                this._updateBestiary(exp, 'regular', bKey, {
                    name: bName,
                    sprite: e.sprite,
                    color: e.color || '#ff3333',
                    lore: catalogEntry?.lore || '',
                    eliteModifier: e.elite || null,
                    eliteName: e.eliteName || null,
                });
            }
        }

        exp.combat = {
            enemies,
            roundTick: game.tick + EXPLORATION_CONFIG.combatRoundTicks,
            round: 0,
            encounterIndex: exp.currentEncounter,
            isBoss: encounter.isBoss || false,
        };
    }

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

        // Apply DoTs and age out status effects at the top of the round, then
        // re-check for a wipe (poison can be lethal) before anyone acts.
        this._tickCombatStatus(exp, game, combat);
        if (exp.partySnapshot.every(p => p.hp <= 0) || combat.enemies.every(e => e.hp <= 0)) {
            this._finishCombat(exp, game);
            return;
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

        // ── Party attack phase ──
        for (const member of alive) {
            if (member.hp <= 0) continue;
            // Enemy-applied crowd control on the party (framework): a stunned member
            // can't attack this round. A slowed one may lose its turn. Weaken scales
            // its outgoing damage.
            if (this._hasCombatStatus(member, 'stun')) {
                this._addLog(exp, game, `${member.name} is stunned and cannot attack!`, 'danger');
                continue;
            }
            if (this._hasCombatStatus(member, 'slow')) {
                const slowMult = this._combatStatusValue(member, 'slow', 'mult', 0.5);
                if (Math.random() > slowMult) {
                    this._addLog(exp, game, `${member.name} is slowed and loses their turn!`, 'danger');
                    continue;
                }
            }
            const memberWeaken = this._combatStatusValue(member, 'weaken', 'mult', 1);
            const disabled = member._disabledSlots || {};
            let weaponDmg = (member.weapon && !disabled.weapon) ? member.weapon.damage : EXPLORATION_CONFIG.baseFistDamage;
            const slotNames = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
            const memberItems = slotNames.filter(s => member[s] && !disabled[s]).map(s => member[s]);
            for (const item of memberItems) { if (item !== member.weapon && item.damage) weaponDmg += item.damage; }
            const critChance = memberItems.reduce((sum, it) => sum + (it.critChance || 0), 0);
            // Attacks-per-round scales with weapon speed: combatRoundTicks is the
            // round's real-time span, so a fast weapon (low effective cooldown)
            // swings more times within it than a slow one. Per-hit damage is
            // weaponDmg/hitsPerRound, so total per-round output stays weaponDmg
            // (DPS-neutral). The only edge extra swings grant is more independent
            // crit rolls, which is exactly the payoff for a high-crit build.
            const hitsPerRound = Math.max(1, Math.round(EXPLORATION_CONFIG.combatRoundTicks / member.effectiveCooldown));
            const perHitDmg = weaponDmg / hitsPerRound;
            const formDmgMult = this._applyFormationModifier(exp, member.id, 'meleeDamageMult');
            const xpDmgMult = this._getXpLevelBonus(member.id, 'expeditionDamageMult');

            for (let hit = 0; hit < hitsPerRound; hit++) {
                const target = combat.enemies.find(e => e.hp > 0);
                if (!target) break;
                // Stamp the basic-attack tick so the expedition visual can play an
                // attack animation. Set only on basic attacks, never spells. Kind
                // drives the motion class: melee = swing (rotation), ranged =
                // draw/thrust + projectile.
                member._lastAttackTick = game.tick;
                // Motion class comes straight from the weapon's attackAnim
                // ('Swing' | 'Stab' | 'DrawAndShoot'). `member.attackAnim` was
                // resolved (with a ranged fallback) in the party snapshot.
                member._lastAttackKind = member.attackAnim
                    || (member.weapon && member.weapon.attackAnim)
                    || (member.weapon && member.weapon.ranged ? 'DrawAndShoot' : 'Swing');
                const targetLabel = target.isBoss ? target.name : (target.elite ? `${target.eliteName} enemy` : 'an enemy');

                if (target.eliteDodge && Math.random() < target.eliteDodge) {
                    target._lastDodgeTick = game.tick;
                    this._addLog(exp, game, `${targetLabel} dodges ${member.name}'s attack!`, 'combat');
                    continue;
                }

                // perHitDmg (= weaponDmg/hitsPerRound) keeps per-round output constant.
                // variance is likewise divided so a fast weapon's many swings don't
                // accumulate more bonus roll than a slow one. Round (not floor) the
                // per-hit value so splitting into more hits doesn't shave damage.
                let dmg = Math.max(1, Math.round((perHitDmg + randInt(0, 3) / hitsPerRound) * partyDmgMult * formDmgMult * xpDmgMult * memberWeaken * (1 - physResist)));
                let critHit = false;
                if (critChance > 0 && Math.random() < critChance) { dmg *= 2; critHit = true; }
                if (target.eliteDR) dmg = Math.max(1, Math.floor(dmg * (1 - target.eliteDR)));

                if (Math.random() < baseMissChance) {
                    const msg = pickRandom(EXPLORATION_EVENTS.combatMiss).replace('{attacker}', member.name).replace('{target}', targetLabel);
                    this._addLog(exp, game, msg, 'combat');
                } else {
                    target.hp -= dmg;
                    if (exp.summary) exp.summary.damageDealt[member.id] = (exp.summary.damageDealt[member.id] || 0) + dmg;
                    // Stamp crit tick so the visual can play a stronger swing + punch.
                    if (critHit) member._lastCritTick = game.tick;
                    const hitMsg = critHit ? `${member.name} lands a critical strike on ${targetLabel} for ${dmg} damage!` : null;
                    const msg = hitMsg || pickRandom(EXPLORATION_EVENTS.combatHit).replace('{attacker}', member.name).replace('{target}', targetLabel).replace('{dmg}', dmg);
                    this._addLog(exp, game, msg, 'combat');
                    window.soundManager?.playExpSFX(critHit ? 'critical_hit' : 'colonist_damaged');
                    const lifeSteal = memberItems.reduce((sum, it) => sum + (it.lifeSteal || 0), 0);
                    if (target.eliteLifeSteal && target.eliteLifeSteal > 0) {
                        // Vampiric enemies steal from the attacker
                    }
                    if (lifeSteal > 0) {
                        const healed = Math.floor(dmg * lifeSteal);
                        if (healed > 0) { member.hp = Math.min(member.maxHp, member.hp + healed); if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healed; }
                    }
                    if (target.hp <= 0) {
                        const slayLabel = target.isBoss ? target.name : 'a foe';
                        this._addLog(exp, game, `${member.name} slays ${slayLabel}!`, 'success');
                        window.soundManager?.playExpSFX('enemy_death');
                        if (exp.summary) exp.summary.killCount[member.id] = (exp.summary.killCount[member.id] || 0) + 1;
                        const hpOnKill = memberItems.reduce((sum, it) => sum + (it.hpOnKill || 0), 0);
                        if (hpOnKill > 0) member.hp = Math.min(member.maxHp, member.hp + hpOnKill);
                        if (target.elite) { exp.eliteKills++; this._processEliteOnDeath(target, exp, game); }
                    }
                }
            }
        }

        // ── Party spell phase ──
        this._tryCombatSpells(exp, game, alive, combat);

        // ── Summons phase ──
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
                    summon._lastAttackTick = game.tick;
                    summon._lastAttackKind = summon.attackAnim || (summon.ranged ? 'DrawAndShoot' : 'Swing');
                    const sDmg = summon.damage + randInt(0, 2);
                    if (Math.random() < 0.1) {
                        this._addLog(exp, game, `The ${summon.name} misses!`, 'combat');
                    } else {
                        summonTarget.hp -= sDmg;
                        this._addLog(exp, game, `The ${summon.name} attacks for ${sDmg}!`, 'combat');
                        if (summonTarget.hp <= 0) {
                            this._addLog(exp, game, `The ${summon.name} slays a foe!`, 'success');
                            if (summonTarget.elite) { exp.eliteKills++; this._processEliteOnDeath(summonTarget, exp, game); }
                        }
                    }
                }
            }
        }

        // ── Elite abilities phase (regen etc) ──
        for (const enemy of combat.enemies) {
            if (enemy.hp > 0) this._processEliteAbilities(enemy, exp, game);
        }

        // ── Boss abilities phase ──
        const bossEnemy = combat.enemies.find(e => e.isBoss && e.hp > 0);
        if (bossEnemy) {
            this._executeBossAbilities(bossEnemy, exp, game);
        }

        // ── Enemy attack phase ──
        for (const enemy of combat.enemies) {
            if (enemy.hp <= 0) continue;
            const attackerLabel = enemy.isBoss ? enemy.name : (enemy.elite ? `${enemy.eliteName} enemy` : 'An enemy');
            // Crowd control from party spells: a stunned enemy forfeits its turn. A
            // slowed one has a (1 - mult) chance to lose it. Weaken (below) scales the
            // damage of whatever attacks it does land.
            if (this._hasCombatStatus(enemy, 'stun')) {
                this._addLog(exp, game, `${attackerLabel} is stunned and cannot act!`, 'combat');
                continue;
            }
            if (this._hasCombatStatus(enemy, 'slow')) {
                const slowMult = this._combatStatusValue(enemy, 'slow', 'mult', 0.5);
                if (Math.random() > slowMult) {
                    this._addLog(exp, game, `${attackerLabel} is slowed and loses its turn!`, 'combat');
                    continue;
                }
            }
            const enemyWeaken = this._combatStatusValue(enemy, 'weaken', 'mult', 1);
            const enemyCd = enemy.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            // Attack-animation speed (see party snapshot): <1 fast, >1 slow. The
            // visual clamps it. Here it's just the raw cooldown-to-baseline ratio.
            enemy._atkAnimMult = enemyCd / COLONIST_CONFIG.baseAttackCooldown;
            let enemyHits = Math.max(1, Math.round(COLONIST_CONFIG.baseAttackCooldown / enemyCd));
            if (enemy.eliteExtraAttacks) enemyHits += enemy.eliteExtraAttacks;

            for (let hit = 0; hit < enemyHits; hit++) {
                if (enemy.spells && hit === 0) {
                    let castSpell = false;
                    for (const sp of enemy.spells) {
                        if (Math.random() < sp.chance) {
                            const spName = sp.spell.replace(/_/g, ' ');
                            if (sp.healPct) {
                                const allies = combat.enemies.filter(e => e.hp > 0 && e.hp < e.maxHp);
                                if (allies.length > 0) {
                                    const healTarget = allies[randInt(0, allies.length - 1)];
                                    const heal = Math.floor(healTarget.maxHp * sp.healPct);
                                    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
                                    this._addLog(exp, game, `${attackerLabel} casts ${spName}, healing for ${heal}!`, 'danger');
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
                                this._addLog(exp, game, `${attackerLabel} casts ${spName}, hitting all for ${dmg}!`, 'danger');
                            } else if (sp.damage) {
                                const spTarget = alive.filter(p => p.hp > 0)[randInt(0, Math.max(0, alive.filter(p => p.hp > 0).length - 1))];
                                if (spTarget) {
                                    const dmg = randInt(sp.damage[0], sp.damage[1]);
                                    spTarget.hp -= dmg;
                                    if (exp.summary) exp.summary.damageTaken[spTarget.id] = (exp.summary.damageTaken[spTarget.id] || 0) + dmg;
                                    this._addLog(exp, game, `${attackerLabel} casts ${spName} on ${spTarget.name} for ${dmg}!`, 'danger');
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
                                    this._applyCombatStatus(spTarget, sp.dot.status || 'poison', rounds, { damageRange: sp.dot.damage });
                                    this._addLog(exp, game, `${spTarget.name} is poisoned!`, 'danger');
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
                                    const verb = sp.cc.type === 'stun' ? 'stuns' : sp.cc.type === 'slow' ? 'slows' : 'weakens';
                                    this._addLog(exp, game, `${attackerLabel} casts ${spName} and ${verb} ${sp.cc.aoe ? 'the party' : ccTargets[0].name}!`, 'danger');
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
                if (aliveSummons.length > 0 && Math.random() < 0.5) {
                    const targetSummon = aliveSummons[randInt(0, aliveSummons.length - 1)];
                    let dmg = enemy.damage + randInt(0, 2);
                    if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                    if (Math.random() < baseMissChance) {
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

                // Softmax-weighted target selection: enemies strongly favor the
                // highest-priority member but can occasionally strike lower-priority
                // ones. Priority = equipment targetPriority + formation modifier.
                const weighted = [];
                let maxPr = -Infinity;
                for (const p of alive) {
                    if (p.hp <= 0) continue;
                    const formPriority = this._applyFormationModifier(exp, p.id, 'targetPriorityMod');
                    const pr = getTargetPriority(p) + (formPriority !== 1.0 ? formPriority : 0);
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
                    this._addLog(exp, game, `${target.name} phases through ${enemy.isBoss ? enemy.name + '\'s' : 'an'} attack!`, 'combat');
                    continue;
                }
                const targetItems = [target.weapon, target.armor, target.helmet, target.clothes, target.boots, target.tool, target.trinket].filter(Boolean);
                let dodgeChance = targetItems.reduce((sum, it) => sum + (it.dodgeChance || 0), 0);
                dodgeChance += getPartyExpeditionEffect(exp.partySnapshot, 'dodgeChanceMod', exp.realm);
                if (dodgeChance > 0 && Math.random() < dodgeChance) {
                    target._lastDodgeTick = game.tick;
                    this._addLog(exp, game, `${target.name} dodges ${enemy.isBoss ? enemy.name + '\'s' : 'an'} attack!`, 'combat');
                    continue;
                }

                let dmg = enemy.damage + randInt(0, 2);
                if (enemyWeaken !== 1) dmg = Math.max(1, Math.floor(dmg * enemyWeaken));
                for (const item of targetItems) {
                    if (item.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - item.damageReduction)));
                }
                if (target.shieldActive) dmg = Math.max(1, Math.floor(dmg * (1 - target.shieldReduction)));
                const formDmgTaken = this._applyFormationModifier(exp, target.id, 'damageTakenMult');
                dmg = Math.max(1, Math.floor(dmg * formDmgTaken));

                if (Math.random() < baseMissChance) {
                    const msg = pickRandom(EXPLORATION_EVENTS.combatMiss).replace('{attacker}', attackerLabel).replace('{target}', target.name);
                    this._addLog(exp, game, msg, 'combat');
                } else {
                    target.hp -= dmg;
                    if (exp.summary) exp.summary.damageTaken[target.id] = (exp.summary.damageTaken[target.id] || 0) + dmg;
                    const msg = pickRandom(EXPLORATION_EVENTS.combatHit).replace('{attacker}', attackerLabel).replace('{target}', target.name).replace('{dmg}', dmg);
                    this._addLog(exp, game, msg, 'combat');
                    window.soundManager?.playExpSFX('colonist_damaged');

                    // Thorns from equipment + mutators
                    let thorns = targetItems.reduce((sum, it) => sum + (it.thornsDamage || 0), 0) + globalThorns;
                    if (thorns > 0 && enemy.hp > 0) {
                        enemy.hp -= thorns;
                        this._addLog(exp, game, `Thorns deal ${thorns} damage back!`, 'combat');
                        if (enemy.hp <= 0) {
                            this._addLog(exp, game, `${attackerLabel} is slain by thorns!`, 'success');
                            if (enemy.elite) { exp.eliteKills++; this._processEliteOnDeath(enemy, exp, game); }
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
            }
        }

        // ── Boss phase check ──
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
        const levelReduction = expeditionCostReduction(member, spell);
        const mult = Math.max(0, (1 - levelReduction) * (1 - gearReduction));
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
        for (const member of alive) {
            if (member.hp <= 0 || member.knownSpells.length === 0) continue;

            for (const spellKey of member.knownSpells) {
                const spell = SPELLS[spellKey];
                if (!spell || spell.trigger !== 'inCombat') continue;
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
                        this._addLog(exp, game, `${member.name} casts ${spell.name}! Hits ${targets.length} foes for ${dmg} each.`, 'combat');
                        game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                        window.soundManager?.playExpSFX('spell_cast');
                        for (const t of targets) {
                            if (t.hp <= 0) this._addLog(exp, game, `An enemy is destroyed by the blast!`, 'success');
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
                            if (t.hp <= 0) this._addLog(exp, game, `${member.name}'s ${spell.name} arcs through a foe, slaying it!`, 'success');
                            hopDmg *= (spell.chainFalloff || 0.6);
                        }
                        this._addLog(exp, game, `${member.name} casts ${spell.name}, arcing through ${hitCount} ${hitCount === 1 ? 'foe' : 'foes'}!`, 'combat');
                        game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                        window.soundManager?.playExpSFX('spell_cast');
                    } else {
                        const target = combat.enemies.find(e => e.hp > 0);
                        if (target) {
                            target.hp -= dmg;
                            this._addLog(exp, game, `${member.name} casts ${spell.name} at an enemy for ${dmg} damage!`, 'combat');
                            game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                            window.soundManager?.playExpSFX('spell_cast');
                            // Frost Lance et al. slow the struck foe for a couple of rounds.
                            if (spell.effect === 'ranged_damage_slow' && target.hp > 0) {
                                this._applyCombatStatus(target, 'slow', spell.slowRounds || 2, { mult: spell.slowMult || 0.5 });
                                this._addLog(exp, game, `The enemy is slowed by frost!`, 'combat');
                            }
                            if (target.hp <= 0) this._addLog(exp, game, `${member.name}'s spell slays a foe!`, 'success');
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
                    this._addLog(exp, game, `${member.name} casts ${spell.name}, phasing through attacks!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('spell_teleport');
                    break;
                } else if (spell.effect === 'buff_defense' && !member.shieldActive) {
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    member.shieldActive = true;
                    member.shieldReduction = Math.min(0.75, spell.damageReduction * expeditionSpellPower(member, spell));
                    this._addLog(exp, game, `${member.name} casts ${spell.name} and raises a shield!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('spell_shield');
                    break;
                } else if (spell.effect === 'summon') {
                    if (!exp.summons) exp.summons = [];
                    if (exp.summons.some(s => s.ownerId === member.id && s.hp > 0)) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
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
                    window.soundManager?.playExpSFX('summon_arrival');
                    break;
                } else if (spell.effect === 'summon_swarm') {
                    if (!exp.summons) exp.summons = [];
                    if (exp.summons.some(s => s.ownerId === member.id && s.hp > 0)) continue;
                    const summonDef = SUMMON_TYPES[spell.summonType];
                    if (!summonDef) break;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    const count = spell.swarmCount || 3;
                    for (let n = 0; n < count; n++) {
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
                    }
                    this._addLog(exp, game, `${member.name} conjures a swarm of ${count} ${summonDef.name}s!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('summon_arrival');
                    break;
                } else if (spell.effect === 'absorb_shield' && !member.shieldActive) {
                    // Guardian Ward maps to the same shield channel as buff_defense in
                    // expedition combat (position-less, so a flat pool ≈ a % reduction).
                    // Its larger absorb reads as a higher DR here.
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    member.shieldActive = true;
                    member.shieldReduction = 0.5;
                    this._addLog(exp, game, `${member.name} casts ${spell.name}. A guardian ward absorbs incoming blows!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('spell_shield');
                    break;
                } else if (spell.effect === 'stun') {
                    // Mesmerize: stun the frontmost foe(s) for a round. chainTargets>1
                    // lets it catch a couple of enemies.
                    const foes = combat.enemies.filter(e => e.hp > 0).slice(0, spell.chainTargets || 1);
                    if (foes.length === 0) continue;
                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    for (const t of foes) this._applyCombatStatus(t, 'stun', spell.stunRounds || 1);
                    this._addLog(exp, game, `${member.name} casts ${spell.name}, stunning ${foes.length === 1 ? 'a foe' : foes.length + ' foes'}!`, 'combat');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('spell_cast');
                    break;
                }
            }
        }
    }

    _tryHealSpells(exp, game) {
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        for (const member of alive) {
            if (member.knownSpells.length === 0) continue;

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
                    const who = target === member ? '' : ` ${target.name}`;
                    this._addLog(exp, game, `${member.name} casts ${spell.name} and heals${who || ' themselves'} for ${healed} HP.`, 'success');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
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
                    this._addLog(exp, game, `${member.name} casts ${spell.name}, mending ${wounded.length} ${wounded.length === 1 ? 'ally' : 'allies'} for ${total} HP total.`, 'success');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    window.soundManager?.playExpSFX('spell_heal');
                    break;
                } else if (spell.effect === 'cleanse') {
                    // Strip lingering harmful effects. Between encounters the relevant
                    // debuffs are exp.activeEffects DoTs (trap/enemy poison). Clear them
                    // from the most-afflicted ally.
                    const afflicted = alive
                        .map(p => ({ p, n: (exp.activeEffects || []).filter(e => e.targetId === p.id && e.type === 'dot').length }))
                        .filter(x => x.n > 0)
                        .sort((a, b) => b.n - a.n)[0];
                    if (!afflicted) continue;
                    if (!this._canCastSpell(member, spellKey, game)) continue;

                    member.mana -= this._spellManaCost(member, spell);
                    member.spellCooldowns[spellKey] = game.tick;
                    member._lastCastTick = game.tick;
                    exp.activeEffects = (exp.activeEffects || []).filter(e => !(e.targetId === afflicted.p.id && e.type === 'dot'));
                    this._addLog(exp, game, `${member.name} casts ${spell.name}, cleansing ${afflicted.p.name} of afflictions!`, 'success');
                    game.eventLog.add(game, `${member.name} casts ${spell.name} (${spell.manaCost} MP)`, 'info', null);
                    break;
                }
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
                const manaGain = Math.max(1, Math.round((1 + (member.manaRegen || 0) * 10) * regenMult));
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
                * streakMult;
            const lootBonusFlat = this._getMutatorEffect(exp, 'lootBonusFlat');
            const lootAmountMutMult = this._getMutatorEffect(exp, 'lootAmountMult')
                * this._getRealmEventEffect(exp, 'lootAmountMult');

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
                    const boosted = Math.floor(amt * lootAmountMutMult) + lootBonusFlat;
                    exp.loot[res] = (exp.loot[res] || 0) + boosted;
                    this._addLog(exp, game, `+${boosted} ${res.replace(/_/g, ' ')} from the boss!`, 'loot');
                }
                this._awardExpeditionXP(exp, game, EXPEDITION_XP_CONFIG.xpPerBossKill);
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
            if (lootEntry.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(lootEntry.item);
                const itemName = ALL_ITEMS[lootEntry.item]?.name || lootEntry.item;
                this._addLog(exp, game, `Victory! Found ${itemName}!`, 'success');
                window.soundManager?.playExpSFX('loot_drop');
            } else {
                let resMult = 1.0;
                for (const event of this.activeRealmEvents) {
                    if (!event.realms?.includes(exp.realm)) continue;
                    if (event.effects?.resourceMult?.[lootEntry.resource]) resMult *= event.effects.resourceMult[lootEntry.resource];
                }
                const amount = Math.floor(lootEntry.amount * lootMult * eliteLootMult * lootAmountMutMult * resMult) + lootBonusFlat;
                exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                this._addLog(exp, game, `Victory! Looted ${amount} ${lootEntry.resource.replace(/_/g, ' ')}.`, 'success');
                window.soundManager?.playExpSFX('loot_drop');
            }
        } else {
            this._addLog(exp, game, 'The party has been overwhelmed...', 'danger');
            window.soundManager?.playExpSFX('mental_break');
        }
        for (const member of exp.partySnapshot) {
            member.shieldActive = false;
            member.shieldReduction = 0;
            // Combat status effects are round-scoped: clear them so poison/slow/etc.
            // never carry between encounters. (Enemies are discarded with exp.combat.)
            member.statusEffects = [];
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

        const allDefeated = exp.partySnapshot.every(p => p.hp <= 0);
        if (!allDefeated && !exp.manualRetreat) {
            this.completedRealms.add(exp.realm);
            game.story.checkMilestone(`realm_${exp.realm}`, game);
            if (game.stats) game.stats.expeditionsCompleted++;
        }
        const gx = exp.gatePos.x;
        const gy = exp.gatePos.y;

        const fatigueTicks = this._calculateFatigueCooldown(exp);
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

            let personalFatigue = fatigueTicks;
            if (colonist.traits) {
                for (const traitKey of colonist.traits) {
                    const t = TRAITS[traitKey];
                    if (t?.expedition?.fatigueMult) personalFatigue = Math.floor(personalFatigue * t.expedition.fatigueMult);
                }
            }
            if (snapshot.hp <= 0) personalFatigue = Math.floor(personalFatigue * FATIGUE_CONFIG.defeatPenalty);
            this.fatigueCooldowns[snapshot.id] = game.tick + Math.min(personalFatigue, FATIGUE_CONFIG.maxCooldownTicks);

            const xpData = this.expeditionXP[snapshot.id] || { xp: 0, level: 0 };
            const earned = exp.xpEarned[snapshot.id] || 0;
            xpData.xp += earned;
            let needed = EXPEDITION_XP_CONFIG.xpToLevel + xpData.level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
            while (xpData.xp >= needed && xpData.level < EXPEDITION_XP_CONFIG.maxLevel) {
                xpData.xp -= needed;
                xpData.level++;
                this._addLog(exp, game, `${snapshot.name} reached Adventurer level ${xpData.level}!`, 'success');
                window.soundManager?.playExpSFX('magic_levelup');
                needed = EXPEDITION_XP_CONFIG.xpToLevel + xpData.level * EXPEDITION_XP_CONFIG.xpScalePerLevel;
            }
            this.expeditionXP[snapshot.id] = xpData;
        }

        if (exp.packAnimals) {
            for (const pa of exp.packAnimals) {
                const animal = game.entities.find(a => a.id === pa.id);
                if (animal) animal.onExpedition = false;
            }
        }

        this.realmHistory.push(exp.realm);
        if (this.realmHistory.length > STREAK_CONFIG.historyLength) this.realmHistory.shift();

        for (const entry of exp.discoveredEntries) {
            if (!this.bestiary.has(entry.key)) {
                const newEntry = { ...entry, count: 1 };
                delete newEntry.eliteModifier;
                delete newEntry.eliteName;
                if (entry.eliteModifier) {
                    newEntry.eliteCounts = { [entry.eliteModifier]: { name: entry.eliteName, count: 1 } };
                }
                if (!newEntry.lore) newEntry.lore = '';
                this.bestiary.set(entry.key, newEntry);
            } else {
                const existing = this.bestiary.get(entry.key);
                existing.count++;
                if (!existing.sprite && entry.sprite) existing.sprite = entry.sprite;
                if (!existing.color && entry.color) existing.color = entry.color;
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

        const items = exp.loot._items || [];
        const lootResources = { ...exp.loot };
        delete lootResources._items;
        game.resources.add(lootResources);
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
        const parts = [];
        for (const itemKey of items) {
            parts.push(ALL_ITEMS[itemKey]?.name || itemKey);
        }
        for (const [res, amt] of Object.entries(exp.loot)) {
            parts.push(`${amt}x ${ALL_ITEMS[res]?.name || res}`);
        }
        const lootSummary = parts.join(', ');
        if (!allDefeated) {
            this._addLog(exp, game, `Returned with: ${lootSummary || 'nothing'}`, 'success');
            game.eventLog.add(game, `Expedition returned from ${exp.realmName}: ${lootSummary || 'nothing'}`, 'event', null);
        } else {
            this._addLog(exp, game, `Party defeated. Salvaged: ${lootSummary || 'nothing'}`, 'danger');
            game.eventLog.add(game, `Expedition to ${exp.realmName} failed. Salvaged: ${lootSummary || 'nothing'}`, 'warning', null);
        }

        this.completedExpeditions.push(exp);
        if (this.completedExpeditions.length > 10) {
            this.completedExpeditions.shift();
        }
        this.pendingSummary = exp;
    }

    dismissSummary() {
        this.pendingSummary = null;
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

    // ── Combat status effects (round-scoped) ──────────────────────────────
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
            target.statusEffects.push({ type, rounds, ...extra });
        }
    }

    _hasCombatStatus(target, type) {
        return !!(target.statusEffects && target.statusEffects.some(s => s.type === type && s.rounds > 0));
    }

    // Magnitude field (e.g. 'mult') of an active status, or `def` when absent.
    _combatStatusValue(target, type, field, def) {
        const s = target.statusEffects && target.statusEffects.find(x => x.type === type && x.rounds > 0);
        return s && s[field] !== undefined ? s[field] : def;
    }

    // Runs once per combat round: applies DoT damage, then decrements and prunes
    // every combatant's status effects on both sides.
    _tickCombatStatus(exp, game, combat) {
        const tick = (combatant, isParty) => {
            if (!combatant.statusEffects || combatant.statusEffects.length === 0) return;
            if (combatant.hp <= 0) { combatant.statusEffects = []; return; }
            for (const s of combatant.statusEffects) {
                if (s.type === 'poison' || s.type === 'burn') {
                    // Per-round damage: a fixed `damage`, or a rolled `damageRange`.
                    const dmg = s.damageRange ? randInt(s.damageRange[0], s.damageRange[1]) : (s.damage || 0);
                    if (dmg > 0) {
                        combatant.hp -= dmg;
                        const label = s.type === 'poison' ? 'poison' : 'burning';
                        if (isParty) {
                            if (exp.summary) exp.summary.damageTaken[combatant.id] = (exp.summary.damageTaken[combatant.id] || 0) + dmg;
                            this._addLog(exp, game, `${combatant.name} suffers ${dmg} ${label} damage!`, 'danger');
                            if (combatant.hp <= 0) this._checkExpeditionRevive(exp, combatant, game);
                        } else {
                            this._addLog(exp, game, `An enemy takes ${dmg} ${label} damage!`, 'combat');
                            if (combatant.hp <= 0) this._addLog(exp, game, `A foe succumbs to ${label}!`, 'success');
                        }
                    }
                }
                s.rounds--;
            }
            combatant.statusEffects = combatant.statusEffects.filter(s => s.rounds > 0);
        };
        for (const enemy of combat.enemies) tick(enemy, false);
        for (const member of exp.partySnapshot) tick(member, true);
    }

    _updateActiveEffects(exp, game) {
        if (!exp.activeEffects || exp.activeEffects.length === 0) return;
        for (let i = exp.activeEffects.length - 1; i >= 0; i--) {
            const effect = exp.activeEffects[i];
            if (effect.type === 'dot' && game.tick - (effect.lastTick || 0) >= effect.interval) {
                const member = exp.partySnapshot.find(p => p.id === effect.targetId);
                if (member && member.hp > 0) {
                    const dmg = randInt(effect.damageRange[0], effect.damageRange[1]);
                    member.hp -= dmg;
                    effect.lastTick = game.tick;
                    effect.ticksRemaining--;
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
            if (Math.random() < rallyChance) {
                const healAmt = Math.floor(member.maxHp * rallyHeal);
                for (const m of alive) {
                    m.hp = Math.min(m.maxHp, m.hp + healAmt);
                    if (m.maxMana > 0) m.mana = Math.min(m.maxMana, m.mana + Math.floor(m.maxMana * 0.01));
                }
                this._addLog(exp, game, `${member.name} rallies the party! (+${healAmt} HP each)`, 'success');
                if (exp.summary) exp.summary.healingDone[member.id] = (exp.summary.healingDone[member.id] || 0) + healAmt * alive.length;
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
            this._addLog(exp, game, `The ${enemy.eliteName} enemy explodes! (${dmg} damage to all)`, 'danger');
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

        const oldPhase = phases[nextIdx - 1];
        if (oldPhase.transitionText) {
            this._addLog(exp, game, oldPhase.transitionText, 'danger');
        }

        bossEnemy.hp = Math.round(nextPhase.hp * (exp.diffSettings?.enemyHpMult || 1));
        bossEnemy.maxHp = bossEnemy.hp;
        bossEnemy.damage = Math.round(nextPhase.damage * (exp.diffSettings?.enemyDmgMult || 1));
        if (nextPhase.color) bossEnemy.color = nextPhase.color;
        if (nextPhase.sprite) bossEnemy.sprite = nextPhase.sprite;
        bossEnemy.abilities = nextPhase.abilities || [];
        bossEnemy.enraged = false;

        this._addLog(exp, game, `${bossEnemy.name} enters phase: ${nextPhase.name}!`, 'danger');
    }

    _executeBossAbilities(bossEnemy, exp, game) {
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
                this._addLog(exp, game, ability.text || `${bossEnemy.name} unleashes a devastating attack!`, 'danger');
            } else if (ability.type === 'summon_adds' && Math.random() < (ability.chance || 0)) {
                const count = ability.count || 2;
                for (let i = 0; i < count; i++) {
                    exp.combat.enemies.push({
                        hp: Math.round(ability.hp * (exp.diffSettings?.enemyHpMult || 1)),
                        maxHp: Math.round(ability.hp * (exp.diffSettings?.enemyHpMult || 1)),
                        damage: Math.round(ability.damage * (exp.diffSettings?.enemyDmgMult || 1)),
                    });
                }
                this._addLog(exp, game, ability.text || `${bossEnemy.name} summons reinforcements!`, 'danger');
            }
        }
    }

    _tryUsePotions(exp, game) {
        if (!exp.potionSupply) return;
        const alive = exp.partySnapshot.filter(p => p.hp > 0);
        for (const [potionKey, count] of Object.entries(exp.potionSupply)) {
            if (count <= 0) continue;
            const def = EXPEDITION_POTIONS[potionKey];
            if (!def) continue;
            if (def.useCondition === 'combat' && !exp.combat) continue;

            for (const member of alive) {
                let shouldUse = false;
                if (def.autoUse.hpThreshold && member.hp / member.maxHp <= def.autoUse.hpThreshold) shouldUse = true;
                if (def.autoUse.manaThreshold && member.maxMana > 0 && member.mana / member.maxMana <= def.autoUse.manaThreshold) shouldUse = true;
                if (def.autoUse.hasDot && exp.activeEffects?.some(e => e.targetId === member.id && e.type === 'dot')) shouldUse = true;

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
                    }
                    this._addLog(exp, game, def.logText.replace('{name}', member.name), 'success');
                    exp.summary.potionsUsed++;
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

    _updateBestiary(exp, category, key, data) {
        exp.discoveredEntries.push({
            key: `${category}:${key}`,
            category,
            name: data.name || key,
            realm: exp.realm,
            sprite: data.sprite || null,
            color: data.color || null,
            lore: data.lore || '',
            eliteModifier: data.eliteModifier || null,
            eliteName: data.eliteName || null,
        });
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
        if (effects.healParty && alive.length > 0) {
            const heal = Math.floor(alive[0].maxHp * effects.healParty);
            for (const m of alive) m.hp = Math.min(m.maxHp, m.hp + heal);
            this._addLog(exp, game, `Party healed for ${heal} HP each.`, 'success');
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
            this._addLog(exp, game, `A trap springs! ${member.name} takes ${dmg} damage!`, 'danger');
            if (member.hp <= 0) this._checkExpeditionRevive(exp, member, game);
        }
        if (effects.npcChance && exp.partySnapshot.some(p => p.hp > 0) && Math.random() < effects.npcChance) {
            const npcKeys = Object.keys(NPC_ENCOUNTERS).filter(k => {
                const n = NPC_ENCOUNTERS[k];
                return !n.realmFilter || n.realmFilter.includes(exp.realm);
            });
            if (npcKeys.length > 0) {
                const nKey = npcKeys[randInt(0, npcKeys.length - 1)];
                const npc = NPC_ENCOUNTERS[nKey];
                exp.pendingDecision = { type: 'npc', npcKey: nKey, text: npc.text, choices: npc.choices, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter };
                this._addLog(exp, game, npc.text, 'info');
            }
        }
        if (effects.grantLoot) {
            const dim = REALMS[exp.realm];
            const lootEntry = this._rollLoot(dim, exp.diffSettings);
            const mult = effects.grantLoot.mult || 1.0;
            if (lootEntry.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(lootEntry.item);
                this._addLog(exp, game, `Found ${ALL_ITEMS[lootEntry.item]?.name || lootEntry.item}!`, 'loot');
            } else {
                const amount = Math.floor(lootEntry.amount * mult);
                exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                this._addLog(exp, game, `Found ${amount} ${lootEntry.resource.replace(/_/g, ' ')}!`, 'loot');
            }
            window.soundManager?.playExpSFX('loot_drop');
        }
        if (effects.spawnCombat && exp.partySnapshot.some(p => p.hp > 0)) {
            const dim = REALMS[exp.realm];
            const countMult = effects.spawnCombat.countMult || 1.0;
            const baseCount = randInt(dim.enemies.count[0], dim.enemies.count[1]);
            const count = Math.min(10, Math.max(1, Math.round(baseCount * countMult * (exp.diffSettings?.enemyCountMult || 1))));
            const enemies = [];
            for (let j = 0; j < count; j++) {
                const eDef = this._pickEnemyFromRealm(dim);
                const hp = Math.round(randInt(eDef.hp[0], eDef.hp[1]) * (exp.diffSettings?.enemyHpMult || 1));
                const dmg = Math.round(randInt(eDef.damage[0], eDef.damage[1]) * (exp.diffSettings?.enemyDmgMult || 1));
                enemies.push({ hp, maxHp: hp, damage: dmg, name: eDef.name || null, sprite: eDef.sprite || null, color: eDef.color || null, typeKey: eDef.typeKey || null, spells: eDef.spells || null, attackAnim: eDef.attackAnim || 'Swing', ranged: eDef.attackAnim === 'DrawAndShoot' || !!eDef.ranged, projectileChar: eDef.projectileChar || null, projectileColor: eDef.projectileColor || null });
            }
            this._addLog(exp, game, `Enemies emerge! (${count} foes)`, 'combat');
            exp.combat = {
                enemies, roundTick: game.tick + EXPLORATION_CONFIG.combatRoundTicks,
                round: 0, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter, isBoss: false,
            };
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

    _applyPuzzleReward(exp, game, reward) {
        if (!reward) return;
        if (reward.type === 'bonus_loot') {
            const dim = REALMS[exp.realm];
            const lootEntry = this._rollLoot(dim, exp.diffSettings);
            if (lootEntry.item) {
                if (!exp.loot._items) exp.loot._items = [];
                exp.loot._items.push(lootEntry.item);
                this._addLog(exp, game, `Found ${ALL_ITEMS[lootEntry.item]?.name || lootEntry.item}!`, 'loot');
            } else {
                const amount = Math.floor(lootEntry.amount * (reward.mult || 1.0));
                exp.loot[lootEntry.resource] = (exp.loot[lootEntry.resource] || 0) + amount;
                this._addLog(exp, game, `Found ${amount} ${lootEntry.resource.replace(/_/g, ' ')}!`, 'loot');
            }
            window.soundManager?.playExpSFX('loot_drop');
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
                const hp = Math.round(randInt(eDef.hp[0], eDef.hp[1]) * (exp.diffSettings?.enemyHpMult || 1));
                const dmg = Math.round(randInt(eDef.damage[0], eDef.damage[1]) * (exp.diffSettings?.enemyDmgMult || 1));
                enemies.push({ hp, maxHp: hp, damage: dmg, name: eDef.name || null, sprite: eDef.sprite || null, color: eDef.color || null, typeKey: eDef.typeKey || null, spells: eDef.spells || null, attackAnim: eDef.attackAnim || 'Swing', ranged: eDef.attackAnim === 'DrawAndShoot' || !!eDef.ranged, projectileChar: eDef.projectileChar || null, projectileColor: eDef.projectileColor || null });
            }
            this._addLog(exp, game, `Enemies alerted! (${count} foes)`, 'combat');
            exp.combat = {
                enemies, roundTick: game.tick + EXPLORATION_CONFIG.combatRoundTicks,
                round: 0, encounterIndex: sourceEncounterIndex ?? exp.currentEncounter, isBoss: false,
            };
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
            this._addLog(exp, game, `Party healed!`, 'success');
        } else if (reward.type === 'temp_ally' && reward.ally) {
            if (!exp.summons) exp.summons = [];
            exp.summons.push({
                type: 'npc_ally', name: reward.ally.name,
                hp: reward.ally.hp, maxHp: reward.ally.hp,
                damage: reward.ally.damage,
                char: reward.ally.char || 'A', color: reward.ally.color || '#ccaa44',
                ownerId: null,
                ticksRemaining: (reward.ally.duration || 2) * 200,
                maxDuration: (reward.ally.duration || 2) * 200,
            });
            this._addLog(exp, game, `${reward.ally.name} joins the party!`, 'success');
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

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[randInt(0, arr.length - 1)];
}

export function estimatePartyStrength(game, colonistIds, realmKey, difficulty, mutators = []) {
    const realm = REALMS[realmKey];
    if (!realm) return null;
    const diff = EXPEDITION_DIFFICULTY[difficulty] || EXPEDITION_DIFFICULTY[1];

    let mutEnemyHpMult = 1.0, mutEnemyDmgMult = 1.0, mutPartyDmgMult = 1.0;
    for (const mutKey of mutators) {
        const mut = EXPEDITION_MUTATORS[mutKey];
        if (mut?.effects?.enemyHpMult) mutEnemyHpMult *= mut.effects.enemyHpMult;
        if (mut?.effects?.enemyDmgMult) mutEnemyDmgMult *= mut.effects.enemyDmgMult;
        if (mut?.effects?.partyDamageMult) mutPartyDmgMult *= mut.effects.partyDamageMult;
    }

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
                let effectDesc;
                if (spell.effect === 'ranged_damage') effectDesc = `${spell.damage} dmg`;
                else if (spell.effect === 'ranged_damage_aoe') effectDesc = `${spell.damage} AOE dmg`;
                else if (spell.effect === 'melee_damage') effectDesc = `${spell.damage} melee dmg`;
                else if (spell.effect === 'chain_damage') effectDesc = `${spell.damage} dmg, arcs to ${spell.chainTargets} foes`;
                else if (spell.effect === 'ranged_damage_slow') effectDesc = `${spell.damage} dmg + slow`;
                else if (spell.effect === 'heal') effectDesc = `heals ${spell.healAmount} HP`;
                else if (spell.effect === 'chain_heal') effectDesc = `heals ${spell.healAmount} HP, chains to ${spell.chainTargets} allies`;
                else if (spell.effect === 'cleanse') effectDesc = `cleanses debuffs`;
                else if (spell.effect === 'buff_defense') effectDesc = `${Math.round(spell.damageReduction * 100)}% DR shield`;
                else if (spell.effect === 'absorb_shield') effectDesc = `absorb ${spell.absorbAmount} dmg`;
                else if (spell.effect === 'stun') effectDesc = `stuns ${spell.chainTargets > 1 ? spell.chainTargets + ' foes' : 'a foe'}`;
                else if (spell.effect === 'teleport') {
                    const charges = spell.range >= 15 ? 3 : spell.range >= 10 ? 2 : 1;
                    effectDesc = `dodge ${charges} attack${charges > 1 ? 's' : ''}`;
                } else if (spell.effect === 'summon') {
                    const st = SUMMON_TYPES[spell.summonType];
                    effectDesc = st ? `summons ${st.name} (${st.hp} HP, ${st.damage} dmg)` : 'summons ally';
                } else if (spell.effect === 'summon_swarm') {
                    const st = SUMMON_TYPES[spell.summonType];
                    effectDesc = st ? `summons ${spell.swarmCount}× ${st.name}` : 'summons swarm';
                } else effectDesc = spell.effect;
                let triggerDesc = spell.trigger === 'inCombat' ? 'in combat'
                    : spell.trigger === 'debuffNearby' ? 'when debuffed'
                    : `ally HP < ${Math.round((spell.hpThreshold || 0.5) * 100)}%`;
                spellRoster.push({ spellKey, name: spell.name, school: spell.school, casters: [c.name], manaCost: spell.manaCost, triggerDesc, effectDesc });
            }
        }

        members.push({
            name: c.name, id: c.id, dmgPerRound: memberDmg, hitsPerRound, hp: c.maxHp,
            dr: Math.round((1 - dr) * 100), maxMana: c.maxMana || 0,
            traits: combatTraits, expeditionTraits, spells: memberSpells,
            trinketName: c.trinket?.name || null,
            expLevel, fatigued: fatigue,
        });
    }

    if (size === 0) return null;
    const avgDR = 1 - Math.pow(drProduct, 1 / size);

    const partyEffects = {};
    const effectKeys = ['partyDamageMult', 'trapDamageMult', 'lootMult', 'rareEncounterMult', 'durationMult'];
    const mockSnapshot = colonistIds.map(id => {
        const c = game.getColonist(id);
        return c ? { hp: c.hp, traits: c.traits || [], weapon: c.weapon, armor: c.armor, helmet: c.helmet, clothes: c.clothes, boots: c.boots, tool: c.tool, trinket: c.trinketBroken ? null : c.trinket } : null;
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

    const enemyCount = Math.round(((realm.enemies.count[0] + realm.enemies.count[1]) / 2) * diff.enemyCountMult);
    let enemyHp, enemyDmg;
    if (realm.enemies.types && realm.enemies.types.length > 0) {
        const totalWeight = realm.enemies.types.reduce((s, t) => s + t.weight, 0);
        let avgHp = 0, avgDmg = 0;
        for (const t of realm.enemies.types) {
            const eDef = EXPEDITION_ENEMIES[t.key];
            if (!eDef) continue;
            const w = t.weight / totalWeight;
            avgHp += ((eDef.hp[0] + eDef.hp[1]) / 2) * w;
            avgDmg += ((eDef.damage[0] + eDef.damage[1]) / 2) * w;
        }
        enemyHp = avgHp * diff.enemyHpMult * mutEnemyHpMult;
        enemyDmg = avgDmg * diff.enemyDmgMult * mutEnemyDmgMult;
    } else {
        enemyHp = ((realm.enemies.hp?.[0] || 30) + (realm.enemies.hp?.[1] || 60)) / 2 * diff.enemyHpMult * mutEnemyHpMult;
        enemyDmg = ((realm.enemies.damage?.[0] || 5) + (realm.enemies.damage?.[1] || 10)) / 2 * diff.enemyDmgMult * mutEnemyDmgMult;
    }
    const combatRange = realm.combatEncounters || [1, Math.ceil(realm.encounters * 0.6)];
    const combatEncounters = Math.ceil(((combatRange[0] + combatRange[1]) / 2) + (diff.extraEncounters || 0));

    const totalEnemyHp = enemyHp * enemyCount * combatEncounters;
    const effectiveDmg = totalDmg * mutPartyDmgMult;
    const roundsToKill = totalEnemyHp / Math.max(1, effectiveDmg + 1.5);
    const totalDmgToParty = roundsToKill * enemyDmg * enemyCount * (1 - avgDR) * 0.85;
    const ratio = totalHp / Math.max(1, totalDmgToParty);

    let rating, color;
    if (ratio > 3.0) { rating = 'Easy'; color = '#44cc44'; }
    else if (ratio > 1.5) { rating = 'Fair'; color = '#88cc44'; }
    else if (ratio > 0.8) { rating = 'Tough'; color = '#cccc44'; }
    else if (ratio > 0.4) { rating = 'Dangerous'; color = '#ff8844'; }
    else { rating = 'Suicidal'; color = '#ff4444'; }

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

    return { rating, color, totalDmg, totalHp, avgDR: Math.round(avgDR * 100), size, members, partyEffects, spellRoster, skillChecks };
}

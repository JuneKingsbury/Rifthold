import { BUILDINGS, REALMS, ANIMALS, TAMED_ANIMALS, WEAPONS, ARMORS, HELMETS, CLOTHES, TOOLS, TRINKETS, POTIONS, SPELL_TOMES, ITEM_CHARS, EXPEDITION_DIFFICULTY, ALL_ITEMS, SPELLS,
    EXPEDITION_MUTATORS, EXPEDITION_POTIONS, POTION_CARRY_CONFIG, FORMATION_CONFIG,
    ELITE_MODIFIERS, NODE_MAP_CONFIG, EXPEDITION_XP_CONFIG, BESTIARY_CONFIG,
    getItemStatLines,
} from '../core/config.js';
import { estimatePartyStrength } from '../systems/exploration.js';
import { getTargetPriority, getThreatDisplayHtml } from './ui-utils.js';
import { getRelaxActivityLabel } from '../entities/colonist.js';

export function installArcanePanel(UI) {
    Object.assign(UI.prototype, arcaneMethods);
}

const arcaneMethods = {
    toggleArcanePanel(tab) {
        const opening = !this.arcanePanelVisible;
        this._closeAllPanels();
        this.arcanePanelVisible = opening;
        this.elements.arcanePanel.style.display = opening ? 'block' : 'none';
        if (tab) this._arcaneTab = tab;
        if (opening) {
            this._arcaneExpSetup = null;
            this._lastArcaneHtml = '';
            this._expVisState._snapToCurrentProgress = true;
            this.updateArcanePanel();
        }
        this._updateOverlay();
    },

    updateArcanePanel() {
        const tab = this._arcaneTab || 'defense';
        let html = '<div class="panel-close" data-panel-close="arcane">&times;</div>';
        html += '<h3 style="color:#aa44ff">Arcane Portal</h3>';
        html += '<div class="arcane-tabs">';
        html += `<button class="arcane-tab${tab === 'defense' ? ' active' : ''}" data-arcane-tab="defense">Defense</button>`;
        html += `<button class="arcane-tab${tab === 'expeditions' ? ' active' : ''}" data-arcane-tab="expeditions">Expeditions</button>`;
        html += '</div>';

        if (tab === 'defense') {
            html += this._buildDefenseTabHtml();
        } else {
            html += this._buildExpeditionsTabHtml();
        }

        if (html !== this._lastArcaneHtml) {
            let savedChecks = null;
            let savedPacks = null;
            if (tab === 'expeditions' && this._arcaneExpSetup) {
                savedChecks = [...this.elements.arcanePanel.querySelectorAll('.exp-check:checked')].map(cb => cb.value);
                savedPacks = [...this.elements.arcanePanel.querySelectorAll('.exp-pack-check:checked')].map(cb => cb.value);
                this._savedMutators = [...this.elements.arcanePanel.querySelectorAll('.exp-mutator:checked')].map(cb => cb.value);
                this._savedPotions = {};
                this.elements.arcanePanel.querySelectorAll('.exp-potion').forEach(input => {
                    const val = parseInt(input.value) || 0;
                    if (val > 0) this._savedPotions[input.dataset.potion] = val;
                });
            }
            this._lastArcaneHtml = html;
            this.elements.arcanePanel.innerHTML = html;
            if (tab === 'expeditions') {
                if (savedChecks && savedChecks.length > 0) {
                    for (const val of savedChecks) {
                        const cb = this.elements.arcanePanel.querySelector(`.exp-check[value="${val}"]`);
                        if (cb) cb.checked = true;
                    }
                    for (const val of savedPacks) {
                        const cb = this.elements.arcanePanel.querySelector(`.exp-pack-check[value="${val}"]`);
                        if (cb) cb.checked = true;
                    }
                }
                if (this._savedMutators) {
                    for (const mk of this._savedMutators) {
                        const cb = this.elements.arcanePanel.querySelector(`.exp-mutator[value="${mk}"]`);
                        if (cb) cb.checked = true;
                    }
                    this._savedMutators = null;
                }
                if (this._savedPotions) {
                    for (const [pk, count] of Object.entries(this._savedPotions)) {
                        const input = this.elements.arcanePanel.querySelector(`.exp-potion[data-potion="${pk}"]`);
                        if (input) input.value = Math.min(count, parseInt(input.max) || count);
                    }
                    this._savedPotions = null;
                }
                const logEl = this.elements.arcanePanel.querySelector('.exp-log-container');
                if (logEl) logEl.scrollTop = 0;
                this._setupExpCheckboxLimits();
            }
        }

        if (tab === 'expeditions') this._renderExpeditionVis();
    },

    _buildDefenseTabHtml() {
        let html = '';
        let hasNexus = false;
        for (const row of this.game.map) {
            for (const t of row) {
                if (t.structure === 'void_nexus') { hasNexus = true; break; }
            }
            if (hasNexus) break;
        }

        if (!hasNexus) {
            html += `<div class="arcane-section" style="color:#888;padding:20px 0;text-align:center;">`;
            html += `<div style="font-size:1.2em;color:#9933ff;margin-bottom:8px;">Void Nexus Required</div>`;
            html += `<div>Build a Void Nexus to defend your colony against waves of enemies.</div>`;
            html += `<div style="margin-top:6px;color:#666;">Enemies will attack the nexus — defend it to earn void essence and increase your colonist cap.</div>`;
            html += `</div>`;
            return html;
        }

        const waves = this.game.waves;
        html += `<div class="arcane-section">`;
        html += `<div class="info-row" style="color:#9933ff;font-weight:bold;font-size:1.1em;">Wave Defense</div>`;
        html += `<div class="info-row">Highest Wave Completed: <span style="color:#ffcc00">${waves.highestWaveCompleted}</span></div>`;
        html += `<div class="info-row">Colony Cap: <span style="color:#88ff88">${waves.getColonistCap(this.game)}</span></div>`;

        if (waves.active) {
            html += `<div class="info-row" style="color:#ff4444;font-weight:bold;margin-top:8px;">Wave ${waves.currentWave} In Progress</div>`;
            const hpPct = waves.nexusMaxHp > 0 ? Math.round((waves.nexusHp / waves.nexusMaxHp) * 100) : 0;
            const hpColor = hpPct > 60 ? '#44ff44' : hpPct > 30 ? '#ffaa44' : '#ff4444';
            html += `<div class="info-row">Nexus HP: ${waves.nexusHp}/${waves.nexusMaxHp} <span class="arcane-hp-track"><span class="arcane-hp-bar" style="width:${hpPct}%;background:${hpColor};"></span></span></div>`;
            html += `<div class="info-row">Enemies Alive: <span style="color:#ff6644">${waves.enemies.length}</span></div>`;
            const remaining = waves.enemiesToSpawn - waves.enemiesSpawned;
            if (remaining > 0) {
                html += `<div class="info-row">Enemies Spawning: <span style="color:#ff8844">${remaining}</span></div>`;
            }
        } else {
            const nextWave = waves.highestWaveCompleted + 1;
            html += `<div class="info-row" style="margin-top:8px;">Next: Wave ${nextWave} — ${this.getWavePreview(nextWave)}</div>`;
            html += `<div class="info-actions" style="margin-top:8px;"><button onclick="window.game.startWave()" style="background:#6622aa;color:white;padding:8px 16px;font-size:1em;cursor:pointer;border:none;border-radius:4px;">Start Wave ${nextWave}</button></div>`;
        }

        if (waves.lastWaveResult) {
            const r = waves.lastWaveResult;
            const color = r.victory ? '#44ff44' : '#ff4444';
            html += `<div class="info-row" style="margin-top:8px;color:${color};">Last Wave: ${r.victory ? 'Victory' : 'Defeat'} (Wave ${r.wave})</div>`;
        }

        html += `</div>`;
        return html;
    },

    _buildExpeditionsTabHtml() {
        let html = '';
        let hasGate = false;
        for (const row of this.game.map) {
            for (const t of row) {
                if (t.structure === 'rift_gate') { hasGate = true; break; }
            }
            if (hasGate) break;
        }

        if (!hasGate) {
            html += `<div class="arcane-section" style="color:#888;padding:20px 0;text-align:center;">`;
            html += `<div style="font-size:1.2em;color:#33ccff;margin-bottom:8px;">Rift Gate Required</div>`;
            html += `<div>Build a Rift Gate to send expeditions to other realms.</div>`;
            html += `<div style="margin-top:6px;color:#666;">Explore for treasure, rare items, and rare materials. Requires mana to operate.</div>`;
            html += `</div>`;
            return html;
        }

        if (this._arcaneExpSetup) {
            return this._buildExpeditionSetupHtml(this._arcaneExpSetup);
        }

        const expl = this.game.exploration;

        if (expl.pendingSummary) {
            return this._buildExpeditionSummaryScreen(expl.pendingSummary);
        }

        html += `<div class="arcane-section">`;

        if (expl.expeditions.length > 0) {
            for (const exp of expl.expeditions) {
                if (exp.status === 'gathering') {
                    const names = exp.partyIds.map(id => {
                        const c = this.game.getColonist(id);
                        return c ? c.name : '?';
                    }).join(', ');
                    html += `<div class="info-row" style="color:#aaddff;font-weight:bold;">${exp.realmName} — Assembling</div>`;
                    html += `<div class="info-row" style="color:#888;">Party: ${names}</div>`;
                } else {
                    const elapsed = this.game.tick - exp.startTick;
                    const totalDur = Math.floor(exp.duration * 1.2);
                    let pct = Math.min(100, Math.floor((elapsed / totalDur) * 100));
                    if (exp.status === 'returning' && !exp.retreatTick) pct = 100;
                    const statusLabel = exp.pendingDecision ? 'AWAITING CHOICE' : exp.combat ? 'COMBAT' : exp.status;
                    html += `<div class="info-row" style="color:#aaddff;font-weight:bold;">${exp.realmName} — ${statusLabel}</div>`;

                    // Mutator badges
                    if (exp.mutators && exp.mutators.length > 0) {
                        html += `<div class="info-row" style="font-size:0.8em;color:#cc88ff;">`;
                        for (const mk of exp.mutators) {
                            const mut = EXPEDITION_MUTATORS[mk];
                            html += `<span style="background:#2a1a3e;padding:1px 4px;border-radius:2px;margin-right:3px;">${mut?.name || mk}</span>`;
                        }
                        html += `</div>`;
                    }

                    // Node map
                    if (exp.nodeMap && exp.nodeMap.length > 0) {
                        html += this._buildNodeMapHtml(exp);
                    }

                    html += `<canvas class="exp-vis-canvas" width="768" height="192"></canvas>`;

                    // Pending decision/puzzle/NPC prompt
                    if (exp.pendingDecision) {
                        html += this._buildDecisionPromptHtml(exp);
                    }

                    const snapshot = exp.partySnapshot || [];
                    const aliveParty = snapshot.filter(p => p.hp > 0);
                    html += `<div class="info-row" style="color:#888;">Party (${aliveParty.length}/${snapshot.length} alive):</div>`;
                    for (const p of snapshot) {
                        const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
                        const color = p.hp <= 0 ? '#664444' : hpPct < 30 ? '#ff4444' : hpPct < 60 ? '#ffaa44' : '#88cc88';
                        const status = p.hp <= 0 ? ' [DOWN]' : '';
                        const manaStr = p.maxMana > 0 ? ` | ${Math.round(p.mana)}/${p.maxMana} MP` : '';
                        const threatStr = getThreatDisplayHtml(getTargetPriority(p));
                        const rowLabel = exp.formation?.back?.includes(p.id) ? ' <span style="color:#6688ff;font-size:0.8em;">[Back]</span>' : (exp.formation?.front?.includes(p.id) ? ' <span style="color:#ff8844;font-size:0.8em;">[Front]</span>' : '');
                        let buffs = '';
                        if (p.shieldActive) buffs += ' <span style="color:#4488ff;font-size:0.85em;">Shield</span>';
                        if (p.dodgeCharges > 0) buffs += ` <span style="color:#aa44ff;font-size:0.85em;">Phase: ${p.dodgeCharges}</span>`;
                        html += `<div class="info-row" style="color:${color}; padding-left:8px;">${p.name}${rowLabel} — ${Math.max(0, Math.round(p.hp))}/${p.maxHp} HP${manaStr}${buffs}${status}${threatStr}</div>`;
                    }

                    if (exp.combat) {
                        const enemiesAlive = exp.combat.enemies.filter(e => e.hp > 0);
                        html += `<div class="info-row" style="color:#ff8844;margin-top:4px;">Enemies: ${enemiesAlive.length}/${exp.combat.enemies.length}`;
                        const elites = enemiesAlive.filter(e => e.elite);
                        if (elites.length > 0) html += ` (<span style="color:${elites[0].eliteColor}">${elites.length} elite</span>)`;
                        html += `</div>`;
                    }

                    // Potion supply
                    if (exp.potionSupply && Object.keys(exp.potionSupply).length > 0) {
                        html += `<div class="info-row" style="color:#44cc88;font-size:0.85em;">Potions: `;
                        html += Object.entries(exp.potionSupply).map(([k, n]) => `${EXPEDITION_POTIONS[k]?.name || k} x${n}`).join(', ');
                        html += `</div>`;
                    }

                    // Retreat button (only during exploring, not already returning)
                    if (exp.status === 'exploring' && !exp.pendingDecision) {
                        html += `<div class="info-actions" style="margin-top:4px;">`;
                        html += `<button onclick="window.game.retreatExpedition(${exp.id})" style="background:#663322;color:#ffaa88;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:0.85em;">Retreat (keep loot)</button>`;
                        html += `</div>`;
                    }

                    html += `<div class="exp-log-container" style="max-height:200px;overflow-y:auto;" id="exp-log-active">`;
                    for (let li = exp.log.length - 1; li >= 0; li--) {
                        const entry = exp.log[li];
                        const color = this._expLogColor(entry.type);
                        html += `<div class="exp-log-entry" style="color:${color};">${entry.text}</div>`;
                    }
                    html += `</div>`;
                }
            }
        }

        const dims = expl.getAvailableRealms(this.game);
        if (expl.expeditions.length === 0) {
            if (dims.length > 0 && this.game.power.powered) {
                html += `<div class="info-row" style="margin-top:8px;font-weight:bold;color:#33ccff;">Send Expedition:</div>`;
                const allRealms = Object.entries(REALMS).map(([k, r]) => ({ key: k, ...r }));
                const chains = [...new Set(allRealms.map(r => r.chain))];
                for (const chain of chains) {
                    const chainRealms = allRealms.filter(r => r.chain === chain).sort((a, b) => a.chainOrder - b.chainOrder);
                    const completedCount = chainRealms.filter(r => expl.completedRealms.has(r.key)).length;
                    const anyVisible = chainRealms.some(r => dims.find(d => d.key === r.key) || expl.completedRealms.has(r.key));
                    if (!anyVisible && !chainRealms.some(r => !r.research || this.game.research.isResearched(r.research))) continue;
                    html += `<div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:6px;margin-bottom:2px;">${chain} <span style="color:#44cc44">${completedCount}/${chainRealms.length}</span></div>`;
                    for (const realm of chainRealms) {
                        const available = dims.find(d => d.key === realm.key);
                        const completed = expl.completedRealms.has(realm.key);
                        const badge = completed ? `<span style="color:#44cc44;font-size:0.8em;"> ✓</span>` : '';
                        const indentPx = (realm.chainOrder - 1) * 16;
                        const indent = indentPx > 0 ? `margin-left:${indentPx}px;border-left:2px solid #446;padding-left:8px;` : '';
                        if (available) {
                            html += `<div class="info-actions" style="${indent}"><button onclick="window.game.showExpeditionSetupInPanel('${realm.key}')" style="background:#1a4466;color:#88ddff;padding:6px 12px;border:none;border-radius:3px;cursor:pointer;margin:2px 0;">${realm.name} (Difficulty ${realm.difficulty})${badge}</button></div>`;
                        } else if (realm.requiresEvent && !expl._checkEvent(this.game, realm.requiresEvent)) {
                            html += `<div class="info-actions" style="${indent}border-left-color:#333;opacity:0.5;"><span style="color:#666;padding:6px 12px;display:inline-block;">${realm.name} — locked</span></div>`;
                        } else if (realm.requiresRealm && !expl.completedRealms.has(realm.requiresRealm) && (!realm.research || this.game.research.isResearched(realm.research))) {
                            const reqName = REALMS[realm.requiresRealm]?.name || realm.requiresRealm;
                            html += `<div class="info-actions" style="${indent}border-left-color:#333;opacity:0.5;"><span style="color:#666;padding:6px 12px;display:inline-block;">${realm.name} — complete ${reqName} to unlock</span></div>`;
                        }
                    }
                }
            } else if (!this.game.power.powered) {
                html += `<div class="info-row" style="color:#ff4444;margin-top:8px;">No mana — cannot send expeditions</div>`;
            } else {
                html += `<div class="info-row" style="color:#888;margin-top:8px;">No realms available yet</div>`;
            }

            // Active realm events
            const realmEvents = expl.getActiveRealmEvents();
            if (realmEvents.length > 0) {
                html += `<div style="margin-top:8px;padding:4px 6px;background:#1a1a2e;border-radius:3px;border-left:2px solid #cc88ff;">`;
                html += `<div style="color:#cc88ff;font-size:0.85em;font-weight:bold;">Active Realm Events</div>`;
                for (const evt of realmEvents) {
                    html += `<div style="color:#aaa;font-size:0.8em;margin:2px 0;"><span style="color:#ffcc44;">${evt.name}</span> — ${evt.description} <span style="color:#666;">(${evt.realms.join(', ')})</span></div>`;
                }
                html += `</div>`;
            }

            if (expl.completedExpeditions.length > 0) {
                const last = expl.completedExpeditions[expl.completedExpeditions.length - 1];
                html += `<div class="info-row" style="margin-top:10px;color:#88ccff;font-weight:bold;">Last: ${last.realmName}</div>`;

                // Summary stats for the last expedition
                if (last.summary) {
                    html += this._buildSummaryHtml(last);
                }

                html += `<div class="exp-log-container" style="max-height:200px;overflow-y:auto;" id="exp-log-last">`;
                for (let li = last.log.length - 1; li >= 0; li--) {
                    const entry = last.log[li];
                    const color = this._expLogColor(entry.type);
                    html += `<div class="exp-log-entry" style="color:${color};">${entry.text}</div>`;
                }
                html += `</div>`;
            }
        }

        html += `</div>`;
        return html;
    },

    _buildExpeditionSetupHtml(realmKey) {
        const expl = this.game.exploration;
        const available = this.game.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.drafted && !(c.traits && c.traits.includes('pacifist')));
        let html = `<div class="arcane-section">`;

        // Party presets
        if (expl.partyPresets.length > 0) {
            html += `<div style="margin-bottom:6px;">`;
            html += `<span style="color:#888;font-size:0.8em;">Presets: </span>`;
            for (const preset of expl.partyPresets) {
                const safeName = preset.name.replace(/'/g, "\\'");
                html += `<span style="display:inline-flex;align-items:center;margin-right:4px;background:#1a2e1a;border-radius:2px;">`;
                html += `<button onclick="window.game.loadExpeditionPreset('${safeName}')" style="background:none;color:#88cc88;padding:2px 6px;border:none;cursor:pointer;font-size:0.8em;">${preset.name}</button>`;
                html += `<button onclick="window.game.deleteExpeditionPreset('${safeName}')" style="background:none;color:#ff6644;padding:0 4px;border:none;border-left:1px solid #333;cursor:pointer;font-size:0.8em;" title="Delete preset">&times;</button>`;
                html += `</span>`;
            }
            html += `</div>`;
        }

        if (!this._expBackRowIds) this._expBackRowIds = new Set();
        html += `<div class="info-row" style="color:#33ccff;font-weight:bold;">Select Party</div>`;
        html += `<div class="info-row" style="color:#888;">Choose up to 5 colonists:</div>`;
        for (const c of available) {
            const dmg = c.weapon ? c.weapon.damage : 5;
            const def = c.armor ? Math.round(c.armor.damageReduction * 100) : 0;
            const priority = getTargetPriority(c);
            const priorityStr = priority !== 0 ? ` <span style="color:${priority > 0 ? '#ff6644' : '#66aaff'}">${priority > 0 ? '▲' : '▼'}Thr</span>` : '';
            const defStr = def > 0 ? ` Def:${def}%` : '';
            const expLvl = expl.getExpeditionLevel(c.id);
            const lvlStr = expLvl > 0 ? ` <span style="color:#ffcc44;font-size:0.8em;">Lv${expLvl}</span>` : '';
            const fatigued = expl.isFatigued(c.id, this.game.tick);
            const fatigueStr = fatigued ? ` <span style="color:#ff6644;font-size:0.8em;">[Fatigued]</span>` : '';
            const disabledAttr = fatigued ? ' disabled' : '';
            html += `<div class="info-row"><label><input type="checkbox" class="exp-check" value="${c.id}" data-max="5"${disabledAttr}> ${c.name}${lvlStr}${fatigueStr} <span style="color:#888;font-size:0.85em;">Dmg:${dmg}${defStr}${priorityStr}</span></label></div>`;
        }
        const packAnimals = this.game.entities.filter(a => {
            if (!a.tamed || a.hp <= 0 || a.onExpedition) return false;
            const def = TAMED_ANIMALS[a.type];
            return def && def.packAnimal;
        });
        if (packAnimals.length > 0) {
            html += `<div class="info-row" style="color:#bbaa44;margin-top:6px;"><b>Pack Animals (max 2):</b></div>`;
            for (const a of packAnimals) {
                const def = TAMED_ANIMALS[a.type];
                html += `<div class="info-row"><label><input type="checkbox" class="exp-pack-check" value="${a.id}" data-max="3"> ${a.type} (+${Math.round(def.expeditionSpeedBonus * 100)}% speed)</label></div>`;
            }
        }

        // Formation display
        html += `<div class="info-row" style="margin-top:10px;color:#6688ff;font-weight:bold;">Formation</div>`;
        html += `<div style="display:flex;gap:12px;margin:4px 0;font-size:0.85em;">`;
        html += `<div style="flex:1;border:1px solid #333;border-radius:3px;padding:4px;background:#111;">`;
        html += `<div style="color:#ff8844;font-weight:bold;font-size:0.85em;margin-bottom:2px;">Front Row <span style="color:#666;font-weight:normal;">+${Math.round((FORMATION_CONFIG.rows.front.meleeDamageMult - 1) * 100)}% melee, +${Math.round((FORMATION_CONFIG.rows.front.damageTakenMult - 1) * 100)}% dmg taken</span></div>`;
        html += `<div id="exp-front-row">`;
        for (const c of available) {
            if (this._expBackRowIds.has(c.id)) continue;
            html += `<div class="exp-formation-member" data-id="${c.id}" style="display:none;padding:1px 0;"><span style="color:#ccc;">${c.name}</span> <button onclick="window.game.ui._toggleFormationRow(${c.id})" style="background:#1a1a3e;color:#6688ff;border:1px solid #446;border-radius:2px;padding:0 4px;cursor:pointer;font-size:0.9em;" title="Move to back row">Back &#9658;</button></div>`;
        }
        html += `</div></div>`;
        html += `<div style="flex:1;border:1px solid #333;border-radius:3px;padding:4px;background:#111;">`;
        html += `<div style="color:#6688ff;font-weight:bold;font-size:0.85em;margin-bottom:2px;">Back Row <span style="color:#666;font-weight:normal;">-${Math.round((1 - FORMATION_CONFIG.rows.back.damageTakenMult) * 100)}% dmg taken, +${Math.round((FORMATION_CONFIG.rows.back.spellDamageMult - 1) * 100)}% spell</span></div>`;
        html += `<div id="exp-back-row">`;
        for (const c of available) {
            if (!this._expBackRowIds.has(c.id)) continue;
            html += `<div class="exp-formation-member" data-id="${c.id}" style="display:none;padding:1px 0;"><span style="color:#ccc;">${c.name}</span> <button onclick="window.game.ui._toggleFormationRow(${c.id})" style="background:#2e1a1a;color:#ff8844;border:1px solid #644;border-radius:2px;padding:0 4px;cursor:pointer;font-size:0.9em;" title="Move to front row">&#9668; Front</button></div>`;
        }
        html += `</div></div></div>`;

        // Mutator picker
        html += `<div class="info-row" style="margin-top:10px;color:#cc88ff;font-weight:bold;">Mutators <span style="color:#888;font-weight:normal;font-size:0.8em;">(optional modifiers)</span></div>`;
        for (const [mk, mut] of Object.entries(EXPEDITION_MUTATORS)) {
            html += `<div class="info-row"><label><input type="checkbox" class="exp-mutator" value="${mk}"> <span style="color:#cc88ff;">${mut.name}</span> <span style="color:#888;font-size:0.8em;">— ${mut.description}</span></label></div>`;
        }

        // Potion selector
        html += `<div class="info-row" style="margin-top:10px;color:#44cc88;font-weight:bold;">Potions</div>`;
        for (const [pk, pDef] of Object.entries(EXPEDITION_POTIONS)) {
            const stockCount = this.game.resources.getPotionCount?.(pDef.resource) || 0;
            if (stockCount <= 0) continue;
            const maxTake = Math.min(pDef.maxCarry, stockCount);
            html += `<div class="info-row" style="display:flex;align-items:center;gap:6px;font-size:0.85em;">`;
            html += `<span style="color:#44cc88;">${pDef.name}</span>`;
            html += `<span style="color:#888;">(${stockCount} in stock, max ${pDef.maxCarry})</span>`;
            html += `<input type="number" class="exp-potion" data-potion="${pk}" min="0" max="${maxTake}" value="0" style="width:40px;background:#1a1a2e;color:#ccc;border:1px solid #333;border-radius:2px;text-align:center;">`;
            html += `</div>`;
        }

        html += `<div class="info-row" style="margin-top:10px;color:#ffaa33;font-weight:bold;">Difficulty</div>`;
        html += `<div class="info-row" style="display:flex;align-items:center;gap:8px;">`;
        html += `<input type="range" id="exp-difficulty" min="1" max="5" value="${this._expDifficulty || 1}" style="flex:1;accent-color:#ffaa33;">`;
        html += `<span id="exp-diff-label" style="min-width:70px;color:#ffaa33;font-size:0.9em;"></span>`;
        html += `</div>`;
        html += `<div id="exp-diff-desc" style="color:#888;font-size:0.8em;padding:2px 4px;"></div>`;
        html += `<div id="exp-strength-preview" style="margin-top:8px;padding:6px 8px;background:#1a1a2e;border-radius:4px;font-size:0.9em;color:#666;">Select colonists to see party strength</div>`;
        html += this._buildRealmDropsHtml(realmKey);
        html += `<div class="info-actions" style="margin-top:8px;">`;
        html += `<button onclick="window.game.launchExpeditionFromPanel('${realmKey}')" style="background:#1a4466;color:#88ddff;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-size:1em;">Launch Expedition</button>`;
        html += `<input id="exp-preset-name" type="text" placeholder="Preset name" maxlength="20" style="margin-left:8px;width:100px;background:#1a1a2e;color:#ccc;border:1px solid #333;border-radius:3px;padding:4px 6px;font-size:0.85em;">`;
        html += `<button onclick="window.game.saveExpeditionPreset()" style="background:#1a2e1a;color:#88cc88;padding:8px 8px;border:none;border-radius:4px;cursor:pointer;margin-left:4px;font-size:0.9em;">Save Preset</button>`;
        html += `<button onclick="window.game.ui._arcaneExpSetup=null;window.game.ui._lastArcaneHtml='';window.game.ui.updateArcanePanel();" style="background:#333;color:#aaa;padding:8px 12px;border:none;border-radius:4px;cursor:pointer;margin-left:8px;">Cancel</button>`;
        html += `</div></div>`;
        return html;
    },

    _buildRealmDropsHtml(realmKey) {
        const dim = REALMS[realmKey];
        if (!dim) return '';
        const discovered = this.game.discoveredLoot || new Set();
        let html = `<div style="margin-top:10px;color:#ccaa44;font-weight:bold;font-size:0.9em;">Possible Drops</div>`;
        html += `<div style="margin-top:4px;padding:4px;background:#1a1a2e;border-radius:4px;">`;

        const totalWeight = dim.loot.reduce((s, l) => s + l.weight, 0);
        for (const entry of dim.loot) {
            const pct = Math.round(entry.weight / totalWeight * 100);
            const key = entry.item || entry.resource;
            const isFound = discovered.has(`${realmKey}:${key}`);
            const name = isFound ? (entry.item ? (ALL_ITEMS[entry.item]?.name || entry.item) : entry.resource.replace(/_/g, ' ')) : '??????';
            const icon = isFound ? this._itemIcon(key, entry.item ? (ALL_ITEMS[entry.item]?.type || 'trinket') : null) : '';
            const nameColor = isFound ? '#ccc' : '#555';
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;font-size:0.8em;">`;
            html += `<span style="color:${nameColor};">${icon}${name}</span>`;
            html += `<span style="color:#888;">${pct}%</span>`;
            html += `</div>`;
        }

        if (dim.events && dim.events.rare) {
            html += `<div style="color:#aa66cc;font-size:0.75em;margin-top:4px;padding-top:4px;border-top:1px solid #333;">Rare Encounters</div>`;
            for (const rare of dim.events.rare) {
                const pct = (rare.chance * 100).toFixed(1);
                let key, name, isFound;
                if (rare.loot.item) {
                    key = rare.loot.item;
                    isFound = discovered.has(`${realmKey}:${key}`);
                    name = isFound ? (ALL_ITEMS[key]?.name || key) : '??????';
                } else {
                    key = rare.loot.resource;
                    isFound = discovered.has(`${realmKey}:${key}`);
                    name = isFound ? key.replace(/_/g, ' ') : '??????';
                }
                const icon = isFound ? this._itemIcon(key, rare.loot.item ? (ALL_ITEMS[key]?.type || 'trinket') : null) : '';
                const nameColor = isFound ? '#ccc' : '#555';
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;font-size:0.8em;">`;
                html += `<span style="color:${nameColor};">${icon}${name}</span>`;
                html += `<span style="color:#aa66cc;">${pct}%</span>`;
                html += `</div>`;
            }
        }

        const totalDrops = dim.loot.length + (dim.events?.rare?.length || 0);
        const foundCount = [...dim.loot.map(e => e.item || e.resource), ...(dim.events?.rare || []).map(r => r.loot.item || r.loot.resource)].filter(k => discovered.has(`${realmKey}:${k}`)).length;
        html += `<div style="color:#666;font-size:0.7em;text-align:right;margin-top:4px;">${foundCount}/${totalDrops} discovered</div>`;
        html += `</div>`;
        return html;
    },

    _setupExpCheckboxLimits() {
        const panel = this.elements.arcanePanel;
        const realmKey = this._arcaneExpSetup;
        const updateStrength = () => this._updateStrengthPreview(realmKey);

        const enforce = (cls, max) => {
            const boxes = panel.querySelectorAll('.' + cls);
            if (!boxes.length) return;
            const handler = () => {
                const checked = panel.querySelectorAll('.' + cls + ':checked').length;
                boxes.forEach(el => { if (!el.checked) el.disabled = checked >= max; });
                updateStrength();
            };
            boxes.forEach(cb => { cb.addEventListener('change', handler); });
        };
        enforce('exp-check', 5);
        enforce('exp-pack-check', 3);

        const syncFormation = () => {
            const checkedIds = new Set([...panel.querySelectorAll('.exp-check:checked')].map(cb => parseInt(cb.value)));
            panel.querySelectorAll('.exp-formation-member').forEach(el => {
                const id = parseInt(el.dataset.id);
                el.style.display = checkedIds.has(id) ? '' : 'none';
            });
        };
        panel.querySelectorAll('.exp-check').forEach(cb => cb.addEventListener('change', syncFormation));
        syncFormation();

        const slider = panel.querySelector('#exp-difficulty');
        const label = panel.querySelector('#exp-diff-label');
        const desc = panel.querySelector('#exp-diff-desc');
        if (slider && label && desc) {
            const updateLabel = () => {
                const lvl = parseInt(slider.value);
                this._expDifficulty = lvl;
                const d = EXPEDITION_DIFFICULTY[lvl];
                label.textContent = `${lvl} - ${d.name}`;
                const lootPct = Math.round((d.lootAmountMult - 1) * 100);
                const rarePct = Math.round((d.rareLootMult - 1) * 100);
                if (lvl === 1) {
                    desc.textContent = 'Standard difficulty. No bonuses.';
                } else {
                    desc.textContent = `+${lootPct}% loot, +${rarePct}% rare find chance. Enemies & traps hit harder.`;
                }
                updateStrength();
            };
            slider.addEventListener('input', updateLabel);
            updateLabel();
        }

        panel.querySelectorAll('.exp-potion').forEach(input => {
            input.addEventListener('input', () => {
                const max = parseInt(input.max) || 0;
                const min = parseInt(input.min) || 0;
                let val = parseInt(input.value) || 0;
                if (val > max) { val = max; input.value = max; }
                if (val < min) { val = min; input.value = min; }
            });
        });

        if (this._expPresetPotions) {
            for (const [pk, count] of Object.entries(this._expPresetPotions)) {
                const input = panel.querySelector(`.exp-potion[data-potion="${pk}"]`);
                if (input) input.value = Math.min(count, parseInt(input.max) || count);
            }
            this._expPresetPotions = null;
        }
        if (this._expPresetMutators) {
            for (const mk of this._expPresetMutators) {
                const cb = panel.querySelector(`.exp-mutator[value="${mk}"]`);
                if (cb) cb.checked = true;
            }
            this._expPresetMutators = null;
        }
    },

    _toggleFormationRow(colonistId) {
        if (!this._expBackRowIds) this._expBackRowIds = new Set();
        if (this._expBackRowIds.has(colonistId)) {
            this._expBackRowIds.delete(colonistId);
        } else {
            this._expBackRowIds.add(colonistId);
        }
        this._lastArcaneHtml = '';
        this.updateArcanePanel();
    },

    _updateStrengthPreview(realmKey) {
        const el = document.getElementById('exp-strength-preview');
        if (!el) return;
        const ids = [...document.querySelectorAll('.exp-check:checked')].map(cb => parseInt(cb.value));
        const diff = this._expDifficulty || 1;
        if (ids.length === 0) {
            el.innerHTML = '<span style="color:#666;">Select colonists to see party strength</span>';
            return;
        }
        const result = estimatePartyStrength(this.game, ids, realmKey, diff);
        if (!result) { el.innerHTML = ''; return; }

        let html = `<div style="color:${result.color};font-weight:bold;font-size:1.1em;">${result.rating}</div>`;
        html += `<div style="color:#aaa;font-size:0.85em;margin-top:2px;">Dmg/round: ${result.totalDmg} | HP: ${result.totalHp} | DR: ${result.avgDR}%</div>`;

        html += '<div style="margin-top:6px;border-top:1px solid #333;padding-top:4px;">';
        for (const m of result.members) {
            const traitStr = m.traits.length > 0 ? ` <span style="color:#88cc88;">[${m.traits.map(t => t.name).join(', ')}]</span>` : '';
            const manaStr = m.maxMana > 0 ? ` | <span style="color:#6688ff;">${m.maxMana} MP</span>` : '';
            html += `<div style="font-size:0.8em;color:#ccc;margin:1px 0;">`
                + `<span style="color:#eee;">${m.name}</span>: ${m.dmgPerRound} dmg x${m.hitsPerRound}/rnd | ${m.hp} HP | ${m.dr}% DR${manaStr}${traitStr}</div>`;
        }
        html += '</div>';

        const fx = result.partyEffects;
        if (Object.keys(fx).length > 0) {
            html += '<div style="margin-top:4px;border-top:1px solid #333;padding-top:3px;font-size:0.8em;color:#cc88ff;">';
            if (fx.partyDamageMult) html += `<div>Party Dmg: x${fx.partyDamageMult.toFixed(2)}</div>`;
            if (fx.trapDamageMult) html += `<div>Trap Dmg: x${fx.trapDamageMult.toFixed(2)}</div>`;
            if (fx.lootMult) html += `<div>Loot: +${Math.round((fx.lootMult - 1) * 100)}%</div>`;
            if (fx.rareEncounterMult) html += `<div>Rare Finds: x${fx.rareEncounterMult.toFixed(1)}</div>`;
            if (fx.lifeSteal) html += `<div>Life Steal: ${Math.round(fx.lifeSteal * 100)}%</div>`;
            if (fx.thornsDamage) html += `<div>Thorns: ${fx.thornsDamage} dmg</div>`;
            if (fx.autoReviveHp) html += `<div>Auto-Revive: ${Math.round(fx.autoReviveHp * 100)}% HP</div>`;
            if (fx.healthRegen) html += `<div>Regen: +${fx.healthRegen}/tick</div>`;
            if (fx.durationMult) html += `<div>Duration: x${fx.durationMult.toFixed(2)}</div>`;
            html += '</div>';
        }

        const sc = result.skillChecks;
        if (sc && Object.keys(sc).length > 0) {
            html += '<div style="margin-top:4px;border-top:1px solid #333;padding-top:3px;font-size:0.8em;">';
            html += '<div style="color:#ffaa44;margin-bottom:2px;">Skill Checks:</div>';
            for (const [, info] of Object.entries(sc)) {
                html += `<div style="color:#bbb;margin:1px 0;"><span style="color:#eee;">${info.name}</span> `
                    + `Lv${info.level} <span style="color:#888;">(${info.colonist})</span></div>`;
            }
            html += '</div>';
        }

        if (result.spellRoster.length > 0) {
            html += '<div style="margin-top:4px;border-top:1px solid #333;padding-top:3px;font-size:0.8em;">';
            html += '<div style="color:#aa88ff;margin-bottom:2px;">Party Spells:</div>';
            for (const s of result.spellRoster) {
                const schoolColor = { evocation: '#ff8844', abjuration: '#44ff88', conjuration: '#aa66ff', enchantment: '#44aaff' }[s.school] || '#aaa';
                html += `<div style="color:#bbb;margin:1px 0;"><span style="color:${schoolColor};">${s.name}</span> `
                    + `<span style="color:#888;">(${s.casters.join(', ')})</span> — ${s.effectDesc}, ${s.manaCost} MP, ${s.triggerDesc}</div>`;
            }
            html += '</div>';
        }

        el.innerHTML = html;
    },

    _buildNodeMapHtml(exp) {
        const totalNodes = exp.nodeMap.length;
        const segments = totalNodes + 1;
        const segPct = 100 / segments;
        let html = `<div style="position:relative;height:28px;width:100%;font-size:0.8em;">`;
        for (let i = 0; i < totalNodes; i++) {
            const node = exp.nodeMap[i];
            const cfg = NODE_MAP_CONFIG.nodeTypes[node.type] || NODE_MAP_CONFIG.nodeTypes.combat;
            let bg = '#222';
            let border = '#444';
            if (node.completed) { bg = '#1a2a1a'; border = '#44cc44'; }
            else if (node.current) { bg = '#2a2a1a'; border = cfg.color; }
            const centerPct = (i + 1) * segPct;
            html += `<div style="position:absolute;left:${centerPct}%;transform:translateX(-50%);width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:${bg};border:1px solid ${border};border-radius:3px;top:2px;z-index:1;" title="${cfg.label}">`;
            html += `<span style="color:${node.completed ? '#44cc44' : cfg.color};">${cfg.icon}</span>`;
            html += `</div>`;
            const linePct = i * segPct;
            html += `<div style="position:absolute;left:${linePct}%;width:${segPct}%;top:13px;height:1px;background:#444;"></div>`;
        }
        const lastNode = exp.nodeMap[totalNodes - 1];
        if (!lastNode || lastNode.type !== 'boss') {
            const trailPct = totalNodes * segPct;
            html += `<div style="position:absolute;left:${trailPct}%;width:${segPct}%;top:13px;height:1px;background:#444;"></div>`;
        }
        html += `</div>`;
        return html;
    },

    _buildDecisionPromptHtml(exp) {
        const pending = exp.pendingDecision;
        if (!pending) return '';
        let html = `<div style="margin:8px 0;padding:8px;background:#1a1a2e;border-radius:4px;border-left:3px solid #44ccff;">`;
        html += `<div style="color:#44ccff;font-weight:bold;margin-bottom:4px;">${pending.text}</div>`;

        if (pending.type === 'decision') {
            for (let i = 0; i < pending.choices.length; i++) {
                const c = pending.choices[i];
                html += `<div style="margin:4px 0;">`;
                html += `<button onclick="window.game.resolveExpeditionDecision(${exp.id}, ${i})" style="background:#1a3344;color:#88ddff;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;">${c.label}</button>`;
                html += ` <span style="color:#888;font-size:0.8em;">${c.description || ''}</span>`;
                html += `</div>`;
            }
        } else if (pending.type === 'puzzle') {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            for (let i = 0; i < pending.checks.length; i++) {
                const c = pending.checks[i];
                let canAttempt = true;
                let reqText = '';
                if (c.requirement) {
                    if (c.requirement.skill) {
                        const skillName = c.requirement.skill;
                        const minLvl = c.requirement.minLevel;
                        const hasMember = alive.some(m => {
                            const col = this.game.getColonist(m.id);
                            return col && col.skills?.[skillName] >= minLvl;
                        });
                        reqText = `${skillName} ${minLvl}+`;
                        if (!hasMember) { canAttempt = false; reqText += ' (no one qualifies)'; }
                    } else if (c.requirement.traitAny) {
                        const hasMember = alive.some(m => {
                            const col = this.game.getColonist(m.id);
                            return col?.traits?.some(t => c.requirement.traitAny.includes(t));
                        });
                        reqText = `requires ${c.requirement.traitAny.join('/')}`;
                        if (!hasMember) { canAttempt = false; reqText += ' (no one qualifies)'; }
                    }
                }
                html += `<div style="margin:4px 0;">`;
                if (canAttempt) {
                    html += `<button onclick="window.game.resolveExpeditionPuzzle(${exp.id}, ${i})" style="background:#2a1a44;color:#aa88ff;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;">${c.label}</button>`;
                    html += ` <span style="color:#888;font-size:0.8em;">${reqText}</span>`;
                } else {
                    html += `<button disabled style="background:#1a1a1a;color:#555;padding:4px 10px;border:1px solid #333;border-radius:3px;font-size:0.9em;cursor:not-allowed;">${c.label}</button>`;
                    html += ` <span style="color:#664444;font-size:0.8em;">${reqText}</span>`;
                }
                html += `</div>`;
            }
            html += `<div style="margin:6px 0;border-top:1px solid #333;padding-top:4px;">`;
            html += `<button onclick="window.game.resolveExpeditionPuzzle(${exp.id}, -1)" style="background:#222;color:#888;padding:4px 10px;border:1px solid #444;border-radius:3px;cursor:pointer;font-size:0.9em;">Move on</button>`;
            html += ` <span style="color:#666;font-size:0.8em;">Skip this challenge</span>`;
            html += `</div>`;
        } else if (pending.type === 'npc') {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            for (let i = 0; i < pending.choices.length; i++) {
                const c = pending.choices[i];
                let canAfford = true;
                let reasonText = '';
                if (c.requirement?.spellAny) {
                    const hasCaster = alive.some(m => m.knownSpells?.some(s => c.requirement.spellAny.includes(s)));
                    if (!hasCaster) { canAfford = false; reasonText = 'requires spell: ' + c.requirement.spellAny.join('/'); }
                }
                if (canAfford && c.cost?.mana) {
                    const hasMana = alive.some(m => m.mana >= c.cost.mana);
                    if (!hasMana) { canAfford = false; reasonText = `need ${c.cost.mana} mana`; }
                }
                if (canAfford && c.cost?.potionSlots) {
                    const totalPotions = Object.values(exp.potionSupply || {}).reduce((s, v) => s + v, 0);
                    if (totalPotions < c.cost.potionSlots) { canAfford = false; reasonText = 'not enough potions'; }
                }
                if (canAfford && c.cost?.loot) {
                    if ((exp.loot[c.cost.loot.resource] || 0) < c.cost.loot.amount) { canAfford = false; reasonText = `need ${c.cost.loot.amount} ${c.cost.loot.resource.replace(/_/g, ' ')}`; }
                }
                const costParts = [];
                if (c.cost) {
                    for (const [k, v] of Object.entries(c.cost)) {
                        if (typeof v === 'object') costParts.push(`${v.amount} ${v.resource.replace(/_/g, ' ')}`);
                        else costParts.push(`${v} ${k.replace(/_/g, ' ')}`);
                    }
                }
                const costText = costParts.length > 0 ? ` (${costParts.join(', ')})` : '';
                html += `<div style="margin:4px 0;">`;
                if (canAfford) {
                    html += `<button onclick="window.game.resolveExpeditionNpc(${exp.id}, ${i})" style="background:#1a2e1a;color:#88cc88;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;">${c.label}</button>`;
                    html += ` <span style="color:#888;font-size:0.8em;">${costText}</span>`;
                } else {
                    html += `<button disabled style="background:#1a1a1a;color:#555;padding:4px 10px;border:1px solid #333;border-radius:3px;font-size:0.9em;cursor:not-allowed;">${c.label}</button>`;
                    html += ` <span style="color:#664444;font-size:0.8em;">${reasonText}${costText}</span>`;
                }
                html += `</div>`;
            }
            const hasFreeOption = pending.choices.some(c => !c.requirement && !c.cost);
            if (!hasFreeOption) {
                html += `<div style="margin:6px 0;border-top:1px solid #333;padding-top:4px;">`;
                html += `<button onclick="window.game.resolveExpeditionNpc(${exp.id}, -1)" style="background:#222;color:#888;padding:4px 10px;border:1px solid #444;border-radius:3px;cursor:pointer;font-size:0.9em;">Move on</button>`;
                html += ` <span style="color:#666;font-size:0.8em;">Ignore and continue</span>`;
                html += `</div>`;
            }
        } else if (pending.type === 'trap') {
            const alive = exp.partySnapshot.filter(p => p.hp > 0);
            for (let i = 0; i < pending.checks.length; i++) {
                const c = pending.checks[i];
                let bestLevel = 0;
                let canAttempt = false;
                let reqText = '';
                if (c.skill) {
                    const skillName = c.skill;
                    const minLvl = c.minLevel || 1;
                    for (const m of alive) {
                        const col = this.game.getColonist(m.id);
                        const lvl = col?.skills?.[skillName] || 0;
                        if (lvl > bestLevel) bestLevel = lvl;
                    }
                    canAttempt = bestLevel > 0;
                    const chancePct = Math.round(Math.min(90, 30 + (bestLevel / (minLvl + 2)) * 40));
                    reqText = canAttempt ? `${skillName} (best: ${bestLevel}, ~${chancePct}% chance)` : `${skillName} ${minLvl}+ (no one qualifies)`;
                } else if (c.traitAny) {
                    const hasTrait = alive.some(m => {
                        const col = this.game.getColonist(m.id);
                        return col?.traits?.some(t => c.traitAny.includes(t));
                    });
                    canAttempt = hasTrait;
                    reqText = canAttempt ? `${c.traitAny.join('/')} (~70% chance)` : `requires ${c.traitAny.join('/')} (no one qualifies)`;
                }
                html += `<div style="margin:4px 0;">`;
                if (canAttempt) {
                    html += `<button onclick="window.game.resolveExpeditionTrap(${exp.id}, ${i})" style="background:#2e2a1a;color:#ffcc44;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:0.9em;">${c.label}</button>`;
                    html += ` <span style="color:#888;font-size:0.8em;">${c.description} — ${reqText}</span>`;
                } else {
                    html += `<button disabled style="background:#1a1a1a;color:#555;padding:4px 10px;border:1px solid #333;border-radius:3px;font-size:0.9em;cursor:not-allowed;">${c.label}</button>`;
                    html += ` <span style="color:#664444;font-size:0.8em;">${c.description} — ${reqText}</span>`;
                }
                html += `</div>`;
            }
            html += `<div style="margin:6px 0;border-top:1px solid #333;padding-top:4px;">`;
            html += `<button onclick="window.game.resolveExpeditionTrap(${exp.id}, -1)" style="background:#2e1a1a;color:#ff6644;padding:4px 10px;border:1px solid #553333;border-radius:3px;cursor:pointer;font-size:0.9em;">Brace for impact</button>`;
            html += ` <span style="color:#666;font-size:0.8em;">Take the hit</span>`;
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    },

    _buildSummaryHtml(exp) {
        const s = exp.summary;
        if (!s) return '';
        let html = `<div style="margin:6px 0;padding:6px;background:#1a1a2e;border-radius:4px;font-size:0.8em;">`;
        html += `<div style="color:#ffcc44;font-weight:bold;margin-bottom:3px;">Expedition Summary</div>`;

        const partyNames = {};
        for (const p of (exp.partySnapshot || [])) partyNames[p.id] = p.name;

        // Per-member stats
        for (const p of (exp.partySnapshot || [])) {
            const dealt = s.damageDealt[p.id] || 0;
            const taken = s.damageTaken[p.id] || 0;
            const kills = s.killCount[p.id] || 0;
            const healed = s.healingDone[p.id] || 0;
            if (dealt === 0 && taken === 0 && kills === 0 && healed === 0) continue;
            html += `<div style="color:#ccc;margin:1px 0;">${p.name}: `;
            const parts = [];
            if (dealt > 0) parts.push(`${dealt} dmg dealt`);
            if (kills > 0) parts.push(`${kills} kills`);
            if (healed > 0) parts.push(`${healed} healed`);
            if (taken > 0) parts.push(`<span style="color:#ff8844;">${taken} dmg taken</span>`);
            html += parts.join(' | ');
            html += `</div>`;
        }

        // Aggregate stats
        const parts = [];
        if (s.potionsUsed > 0) parts.push(`Potions: ${s.potionsUsed}`);
        if (s.decisionsCount > 0) parts.push(`Decisions: ${s.decisionsCount}`);
        if (s.puzzlesSolved > 0) parts.push(`Puzzles: ${s.puzzlesSolved}`);
        if (exp.eliteKills > 0) parts.push(`Elites slain: ${exp.eliteKills}`);
        if (parts.length > 0) html += `<div style="color:#888;margin-top:3px;">${parts.join(' | ')}</div>`;

        // MVP
        let mvpId = null, mvpScore = 0;
        for (const [id, dealt] of Object.entries(s.damageDealt)) {
            const kills = s.killCount[id] || 0;
            const score = dealt + kills * 50;
            if (score > mvpScore) { mvpScore = score; mvpId = id; }
        }
        if (mvpId && partyNames[mvpId]) {
            html += `<div style="color:#ffcc44;margin-top:3px;">MVP: ${partyNames[mvpId]}</div>`;
        }

        html += `</div>`;
        return html;
    },

    _buildExpeditionSummaryScreen(exp) {
        const allDefeated = exp.partySnapshot.every(p => p.hp <= 0);
        const titleColor = allDefeated ? '#ff4444' : '#44cc44';
        const titleText = allDefeated ? 'Expedition Failed' : 'Expedition Complete';
        let html = `<div class="arcane-section" style="text-align:center;">`;
        html += `<div style="font-size:1.4em;color:${titleColor};font-weight:bold;margin:12px 0 4px;">${titleText}</div>`;
        html += `<div style="color:#88ccff;font-size:1.1em;margin-bottom:10px;">${exp.realmName}</div>`;

        // Loot summary
        const lootEntries = Object.entries(exp.loot || {}).filter(([k]) => k !== '_items');
        const items = exp.loot?._items || [];
        if (lootEntries.length > 0 || items.length > 0) {
            html += `<div style="margin:8px auto;padding:8px;background:#1a2a1a;border:1px solid #44cc44;border-radius:4px;display:inline-block;text-align:left;">`;
            html += `<div style="color:#44cc44;font-weight:bold;margin-bottom:4px;">Loot</div>`;
            for (const [res, amt] of lootEntries) {
                const resIcon = this._resourceIcon(res);
                html += `<div style="color:#ccc;">${resIcon}${res.replace(/_/g, ' ')}: <span style="color:#ffcc44;">${amt}</span></div>`;
            }
            for (const itemKey of items) {
                const itemDef = ALL_ITEMS[itemKey];
                const itemName = itemDef?.name || itemKey;
                const icon = this._itemIcon(itemKey);
                let tooltip = '';
                if (itemDef) {
                    const statLines = getItemStatLines(itemDef);
                    const parts = [];
                    if (itemDef.description) parts.push(itemDef.description);
                    if (statLines.length > 0) parts.push(statLines.join(', '));
                    if (parts.length > 0) tooltip = ` title="${parts.join(' — ').replace(/"/g, '&quot;')}"`;
                }
                html += `<div style="color:#aa88ff;cursor:default;"${tooltip}>${icon}${itemName}</div>`;
            }
            html += `</div>`;
        }

        // Per-member summary
        html += this._buildSummaryHtml(exp);

        // Full log (collapsible)
        html += `<details style="margin:8px 0;text-align:left;"><summary style="color:#88ccff;cursor:pointer;">Expedition Log (${exp.log.length} entries)</summary>`;
        html += `<div style="max-height:200px;overflow-y:auto;padding:4px;background:#111;border-radius:3px;">`;
        for (let li = exp.log.length - 1; li >= 0; li--) {
            const entry = exp.log[li];
            const color = this._expLogColor(entry.type);
            html += `<div style="color:${color};font-size:0.85em;">${entry.text}</div>`;
        }
        html += `</div></details>`;

        html += `<button onclick="window.game.exploration.dismissSummary()" style="margin:12px auto;display:block;background:#225588;color:#fff;padding:8px 24px;border:none;border-radius:4px;cursor:pointer;font-size:1em;">Continue</button>`;
        html += `</div>`;
        return html;
    },

    _renderExpeditionVis() {
        const canvas = this.elements.arcanePanel.querySelector('.exp-vis-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const W = canvas.width, H = canvas.height;
        const expl = this.game.exploration;
        const exp = expl.expeditions.find(e => e.status === 'exploring' || e.status === 'returning');
        if (!exp) {
            if (this._expVisState.finishing) {
                this._expVisState.finishFrame = (this._expVisState.finishFrame || 0) + 1;
                if (this._expVisState.finishFrame > 60) {
                    this._expVisState.finishing = false;
                    this._expVisState.finishExp = null;
                    ctx.clearRect(0, 0, W, H);
                    return;
                }
            } else if (this._expVisState.finishExp) {
                this._expVisState.finishing = true;
                this._expVisState.finishFrame = 0;
            } else {
                ctx.clearRect(0, 0, W, H);
                return;
            }
        } else {
            this._expVisState.finishExp = exp;
            this._expVisState.finishing = false;
            this._expVisState.finishFrame = 0;
        }

        const activeExp = exp || this._expVisState.finishExp;
        if (!activeExp || !activeExp.partySnapshot) { ctx.clearRect(0, 0, W, H); return; }

        const elapsed = this.game.tick - activeExp.startTick;
        let progress;
        if (activeExp.nodeMap && activeExp.nodeMap.length > 0) {
            const totalNodes = activeExp.nodeMap.length;
            const segments = totalNodes + 1;
            const completedNodes = activeExp.nodeMap.filter(n => n.completed).length;

            if (this._expVisState._snapToCurrentProgress) {
                delete this._expVisState._snapToCurrentProgress;
                const encIdx = activeExp.pendingDecision?.encounterIndex ?? activeExp.combat?.encounterIndex;
                const isAtNode = encIdx != null || (activeExp.combat && activeExp.combat.isBoss);
                let snapPos;
                if (activeExp.status === 'returning') {
                    snapPos = activeExp.bossEncounter ? (completedNodes / segments) : 1;
                } else if (isAtNode) {
                    const isBoss = activeExp.combat?.isBoss;
                    const nodeIdx = encIdx != null
                        ? activeExp.nodeMap.findIndex(n => n.encounterIndex === encIdx || (n.type === 'boss' && isBoss))
                        : completedNodes;
                    const stableIdx = nodeIdx >= 0 ? nodeIdx : completedNodes;
                    snapPos = (stableIdx + 1) / segments;
                    if (isBoss) snapPos = Math.min(snapPos, (W - 200) / W);
                } else {
                    snapPos = completedNodes / segments;
                }
                this._expVisState.smoothProgress = snapPos;
                this._expVisState._lastCompletedNodes = completedNodes;
                this._expVisState._walkTarget = null;
                this._expVisState._walkFromProgress = snapPos;
                this._expVisState._lastNodeTick = this.game.tick;
                this._expVisState._wasBossCombat = false;
                this._expVisState._celebrateStart = null;
            }

            const prevCompleted = this._expVisState._lastCompletedNodes ?? 0;
            const isBossCelebration = activeExp.status === 'returning' && !activeExp.retreatTick && !!activeExp.bossEncounter;
            if (isBossCelebration) {
                progress = this._expVisState.smoothProgress ?? (completedNodes / segments);
                this._expVisState._lastCompletedNodes = completedNodes;
            } else {
            if (completedNodes !== prevCompleted) {
                const smooth = this._expVisState.smoothProgress ?? 0;
                const justCompletedPos = completedNodes / segments;
                if (smooth < justCompletedPos - 0.01) {
                    this._expVisState._walkTarget = justCompletedPos;
                }
                this._expVisState._wasBossCombat = false;
                this._expVisState._walkFromProgress = smooth;
                this._expVisState._lastNodeTick = this.game.tick;
                this._expVisState._lastCompletedNodes = completedNodes;
            }
            const encIdx = activeExp.pendingDecision?.encounterIndex ?? activeExp.combat?.encounterIndex;
            const isAtNode = encIdx != null || (activeExp.combat && activeExp.combat.isBoss);
            const spacing = Math.floor(activeExp.duration * 0.2);
            const lastNodeTick = this._expVisState._lastNodeTick || activeExp.startTick;
            const walkElapsed = this.game.tick - lastNodeTick;
            if (this._expVisState._walkTarget != null) {
                const smooth = this._expVisState.smoothProgress ?? 0;
                if (smooth >= this._expVisState._walkTarget - 0.002) {
                    const arrivedAt = this._expVisState._walkTarget;
                    this._expVisState._walkTarget = null;
                    this._expVisState.smoothProgress = arrivedAt;
                    this._expVisState._walkFromProgress = arrivedAt;
                    this._expVisState._lastNodeTick = this.game.tick;
                }
            }
            let targetProgress;
            if (isAtNode) {
                const isBoss = activeExp.combat?.isBoss;
                const nodeIdx = encIdx != null
                    ? activeExp.nodeMap.findIndex(n => n.encounterIndex === encIdx || (n.type === 'boss' && isBoss))
                    : completedNodes;
                const stableIdx = nodeIdx >= 0 ? nodeIdx : completedNodes;
                targetProgress = (stableIdx + 1) / segments;
                if (isBoss) {
                    targetProgress = Math.min(targetProgress, (W - 200) / W);
                    this._expVisState._wasBossCombat = true;
                }
                this._expVisState._lastNodeTick = this.game.tick;
                this._expVisState._walkTarget = null;
            } else if (this._expVisState._walkTarget != null) {
                const walkFrom = this._expVisState._walkFromProgress ?? 0;
                const walkFrac = spacing > 0 ? Math.max(0, Math.min(1, walkElapsed / spacing)) : 0;
                targetProgress = walkFrom + walkFrac * (this._expVisState._walkTarget - walkFrom);
            } else if (completedNodes >= totalNodes) {
                const walkFrom = this._expVisState._walkFromProgress ?? (totalNodes / segments);
                const walkFrac = spacing > 0 ? Math.max(0, walkElapsed / spacing) : 0;
                targetProgress = walkFrom + walkFrac * (1.15 - walkFrom);
            } else {
                const walkFrom = this._expVisState._walkFromProgress ?? (completedNodes / segments);
                const walkFrac = spacing > 0 ? Math.max(0, Math.min(1, walkElapsed / spacing)) : 0;
                const nodePos = (completedNodes + 1) / segments;
                targetProgress = walkFrom + walkFrac * (nodePos - walkFrom);
            }
            if (this._expVisState.smoothProgress === undefined) this._expVisState.smoothProgress = 0;
            this._expVisState.smoothProgress += (targetProgress - this._expVisState.smoothProgress) * 0.25;
            if (Math.abs(targetProgress - this._expVisState.smoothProgress) < 0.002) {
                this._expVisState.smoothProgress = targetProgress;
            }
            progress = this._expVisState.smoothProgress;
            } // end else (not boss celebration)
        } else {
            progress = Math.min(1, elapsed / activeExp.duration);
        }
        if (activeExp.status === 'returning' && !activeExp.retreatTick && !(activeExp.nodeMap && activeExp.nodeMap.length > 0)) {
            progress = 1;
        }
        if (!exp && this._expVisState.finishing) {
            progress = 1;
        }

        const isRetreating = activeExp.status === 'returning' && !!activeExp.retreatTick;
        let retreatProgress = 0;
        if (isRetreating) {
            const retreatDur = activeExp.retreatTick - activeExp.retreatStartTick;
            const retreatElapsed = this.game.tick - activeExp.retreatStartTick;
            retreatProgress = Math.min(1, Math.max(0, retreatElapsed / (retreatDur || 1)));
        }

        const realmDef = REALMS[activeExp.realm];
        const vis = realmDef?.vis || { wall: 'stone_wall', floor: 'stone_floor' };
        const realmColors = {
            crystal_caves: { accent: '#4488ff' },
            crystal_mines: { accent: '#3366dd' },
            crystal_depths: { accent: '#2244aa' },
            verdant_depths: { accent: '#44cc44' },
            fungal_hollows: { accent: '#88aa44' },
            primeval_canopy: { accent: '#22aa66' },
            arcane_library: { accent: '#ffcc44' },
            ancient_university: { accent: '#ddaa22' },
            abandoned_laboratory: { accent: '#ff8844' },
            shadow_realm: { accent: '#aa44ff' },
            void_abyss: { accent: '#7722cc' },
            oblivion_rift: { accent: '#440088' },
        };
        const colors = realmColors[activeExp.realm] || realmColors.crystal_caves;

        const tileSize = 32;
        const wallRows = 1;
        const wallH = wallRows * tileSize;
        const skinMgrVis = this.game.skinManager;
        const useSkinVis = skinMgrVis && skinMgrVis.isActive;
        const wallDef = BUILDINGS[vis.wall];
        const floorDef = BUILDINGS[vis.floor];
        const wallSprite = useSkinVis ? (skinMgrVis.getSprite('buildings', vis.wall) || skinMgrVis.getSprite('floors', vis.wall)) : null;
        const floorSprite = useSkinVis ? (skinMgrVis.getSprite('floors', vis.floor) || skinMgrVis.getSprite('buildings', vis.floor)) : null;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, W, H);

        let shakeApplied = false;
        if (!this._expVisState.shakeFrames) this._expVisState.shakeFrames = 0;
        if (!this._expVisState.flashFrames) this._expVisState.flashFrames = 0;
        if (this._expVisState.shakeFrames > 0) {
            const intensity = this._expVisState.shakeFrames * 0.8;
            ctx.save();
            ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
            shakeApplied = true;
            this._expVisState.shakeFrames--;
        }

        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        const fullBlockChars = new Set(['█', '▓', '▒']);
        for (let tx = 0; tx < W; tx += tileSize) {
            for (let ty = 0; ty < wallH; ty += tileSize) {
                if (wallSprite) {
                    ctx.drawImage(wallSprite, tx, ty, tileSize, tileSize);
                } else if (wallDef) {
                    if (fullBlockChars.has(wallDef.char)) {
                        ctx.fillStyle = wallDef.color;
                        ctx.fillRect(tx, ty, tileSize, tileSize);
                    } else {
                        ctx.fillStyle = wallDef.bg || '#1a1a1a';
                        ctx.fillRect(tx, ty, tileSize, tileSize);
                        ctx.fillStyle = wallDef.color;
                        ctx.font = `${tileSize}px monospace`;
                        ctx.fillText(wallDef.char, tx, ty + tileSize - 1);
                    }
                }
            }
            for (let ty = wallH; ty < H - 16; ty += tileSize) {
                if (floorSprite) {
                    ctx.drawImage(floorSprite, tx, ty, tileSize, tileSize);
                } else if (floorDef) {
                    if (fullBlockChars.has(floorDef.char)) {
                        ctx.fillStyle = floorDef.color;
                        ctx.fillRect(tx, ty, tileSize, tileSize);
                    } else {
                        ctx.fillStyle = floorDef.bg || '#111';
                        ctx.fillRect(tx, ty, tileSize, tileSize);
                        ctx.fillStyle = floorDef.color;
                        ctx.font = `${tileSize}px monospace`;
                        ctx.fillText(floorDef.char, tx, ty + tileSize - 1);
                    }
                }
            }
        }

        const floorTop = wallH;
        const floorBottom = H - 16;
        const diagSlope = 0.4;
        const _now = performance.now();
        const _breathe = (seed) => {
            const phase = (_now / 3200) * Math.PI * 2 + (seed % 1000) / 1000 * 6.28;
            return (0.5 - 0.5 * Math.cos(phase)) * 1.4;
        };

        const roomCount = 8;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        const firstRx = (W / roomCount) - tileSize * 3;
        if (firstRx >= 0) {
            ctx.beginPath();
            ctx.moveTo(firstRx, 0);
            ctx.lineTo(firstRx, wallH);
            ctx.lineTo(firstRx + (floorBottom - wallH) * diagSlope, floorBottom);
            ctx.stroke();
        }
        for (let i = 1; i < roomCount; i++) {
            const rx = (W / roomCount) * i;
            ctx.beginPath();
            ctx.moveTo(rx, 0);
            ctx.lineTo(rx, wallH);
            ctx.lineTo(rx + (floorBottom - wallH) * diagSlope, floorBottom);
            ctx.stroke();
        }

        const hasBoss = !!activeExp.bossEncounter;
        if (!hasBoss) {
            const finishX = W - tileSize * 3;
            const checkSize = 8;
            for (let cy = 0; cy < floorTop; cy += checkSize) {
                for (let cx = 0; cx < tileSize; cx += checkSize) {
                    const isWhite = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
                    ctx.fillStyle = isWhite ? '#ffffff' : '#111111';
                    ctx.fillRect(finishX + cx, cy, checkSize, checkSize);
                }
            }
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, floorTop, W, floorBottom - floorTop);
            ctx.clip();
            ctx.transform(1, 0, diagSlope, 1, -diagSlope * floorTop, 0);
            for (let cy = floorTop; cy < floorBottom; cy += checkSize) {
                for (let cx = 0; cx < tileSize; cx += checkSize) {
                    const isWhite = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
                    ctx.fillStyle = isWhite ? '#ffffff' : '#111111';
                    ctx.fillRect(finishX + cx, cy, checkSize, checkSize);
                }
            }
            ctx.restore();
        } else {
            const voidX = W - tileSize * 2;
            ctx.fillStyle = '#000000';
            ctx.fillRect(voidX, 0, W - voidX, wallH);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, wallH, W, floorBottom - wallH);
            ctx.clip();
            ctx.transform(1, 0, diagSlope, 1, -diagSlope * wallH, 0);
            ctx.fillRect(voidX, wallH, W - voidX, floorBottom - wallH);
            ctx.restore();
        }
        const shadowW = 80;
        const leftStart = -tileSize * 2;
        const leftGrad = ctx.createLinearGradient(leftStart, 0, leftStart + shadowW, 0);
        leftGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
        leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(leftStart, 0, shadowW, wallH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, wallH, W, floorBottom - wallH);
        ctx.clip();
        ctx.transform(1, 0, diagSlope, 1, -diagSlope * wallH, 0);
        ctx.fillRect(leftStart, wallH, shadowW, floorBottom - wallH);
        ctx.restore();
        if (!hasBoss) {
            const rightGrad = ctx.createLinearGradient(W - shadowW, 0, W, 0);
            rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
            rightGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = rightGrad;
            ctx.fillRect(W - shadowW, 0, shadowW, wallH);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, wallH, W, floorBottom - wallH);
            ctx.clip();
            ctx.transform(1, 0, diagSlope, 1, -diagSlope * wallH, 0);
            ctx.fillRect(W - shadowW, wallH, shadowW, floorBottom - wallH);
            ctx.restore();
        }

        const ambientCfg = {
            crystal_caves: { shape: 'diamond', color: '#4488ff', dx: 0, dy: 0.3 },
            crystal_mines: { shape: 'diamond', color: '#3366dd', dx: 0, dy: 0.3 },
            crystal_depths: { shape: 'diamond', color: '#2244aa', dx: 0, dy: 0.4 },
            verdant_depths: { shape: 'circle', color: '#44cc44', dx: 0.1, dy: -0.2 },
            fungal_hollows: { shape: 'circle', color: '#88aa44', dx: 0.05, dy: -0.25 },
            primeval_canopy: { shape: 'circle', color: '#22aa66', dx: 0.1, dy: -0.15 },
            arcane_library: { shape: 'rune', color: '#ffcc44', dx: 0, dy: 0 },
            ancient_university: { shape: 'rune', color: '#ddaa22', dx: 0, dy: 0 },
            abandoned_laboratory: { shape: 'rune', color: '#ff8844', dx: 0, dy: 0 },
            shadow_realm: { shape: 'wisp', color: '#aa44ff', dx: 0.2, dy: 0 },
            void_abyss: { shape: 'wisp', color: '#7722cc', dx: 0.15, dy: 0 },
            oblivion_rift: { shape: 'wisp', color: '#440088', dx: 0.2, dy: 0 },
            kingdom_outskirts: { shape: 'dust', color: '#aa8866', dx: 0.1, dy: 0.1 },
            crusader_barracks: { shape: 'dust', color: '#887755', dx: 0.1, dy: 0.15 },
            palace_fortress: { shape: 'dust', color: '#998866', dx: 0.05, dy: 0.1 },
        };
        const ambCfg = ambientCfg[activeExp.realm] || ambientCfg.crystal_caves;
        if (!this._expVisState.ambientParticles) this._expVisState.ambientParticles = [];
        const particles = this._expVisState.ambientParticles;
        if (particles.length < 30 && Math.random() < 0.15) {
            particles.push({ x: Math.random() * W, y: ambCfg.dy <= 0 ? H - 20 : 5, life: 0, maxLife: 60 + Math.random() * 40, phase: Math.random() * Math.PI * 2 });
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.life++;
            if (pt.life >= pt.maxLife) { particles.splice(i, 1); continue; }
            pt.x += ambCfg.dx + (ambCfg.shape === 'wisp' ? Math.sin(pt.life * 0.08 + pt.phase) * 0.5 : 0);
            pt.y += ambCfg.dy || (ambCfg.shape === 'rune' ? 0 : 0.1);
            const ptAlpha = Math.sin((pt.life / pt.maxLife) * Math.PI) * 0.4;
            ctx.globalAlpha = ptAlpha;
            ctx.fillStyle = ambCfg.color;
            if (ambCfg.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y - 3); ctx.lineTo(pt.x - 2, pt.y); ctx.lineTo(pt.x, pt.y + 3); ctx.lineTo(pt.x + 2, pt.y);
                ctx.closePath(); ctx.fill();
            } else if (ambCfg.shape === 'circle') {
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
            } else if (ambCfg.shape === 'rune') {
                ctx.font = '8px monospace';
                const runes = '⊕⊗⊘⊙◈◇';
                ctx.fillText(runes[Math.floor(pt.phase * 3) % runes.length], pt.x, pt.y);
            } else if (ambCfg.shape === 'wisp') {
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 2 + Math.sin(pt.life * 0.1) * 1, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillRect(pt.x, pt.y, 2, 2);
            }
            ctx.globalAlpha = 1;
        }

        const barProgress = (activeExp.status === 'returning' && !activeExp.retreatTick) ? 1 : progress;
        ctx.fillStyle = '#222';
        ctx.fillRect(0, H - 16, W, 16);
        ctx.fillStyle = isRetreating ? '#ff4444' : barProgress >= 1 ? '#44cc44' : colors.accent;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, H - 16, isRetreating ? W : W * barProgress, 16);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ccc';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isRetreating ? 'RETREATING' : `${Math.floor(barProgress * 100)}%`, isRetreating ? W / 2 : W * barProgress - 20, H - 3);

        let targetX;
        if (!exp && this._expVisState.finishing) {
            targetX = W + 60;
        } else if (isRetreating) {
            const startX = W * progress;
            targetX = startX * (1 - retreatProgress);
        } else if (progress >= 1) {
            targetX = W + 60;
        } else {
            targetX = W * progress;
        }
        const walkSpeed = targetX > W ? 0.025 : isRetreating ? 0.1 : 0.25;
        this._expVisState.partyX += (targetX - this._expVisState.partyX) * walkSpeed;
        const partyX = this._expVisState.partyX;

        const party = activeExp.partySnapshot || [];
        const backRowIds = activeExp.formation?.back || [];
        const skinMgr = this.game.skinManager;
        const useSkins = skinMgr && skinMgr.isActive;
        const isCelebrating = activeExp.status === 'returning' && !activeExp.retreatTick && !!activeExp.bossEncounter;
        if (isCelebrating && !this._expVisState._celebrateStart) {
            this._expVisState._celebrateStart = Date.now();
        } else if (!isCelebrating) {
            this._expVisState._celebrateStart = null;
        }
        for (let i = 0; i < party.length; i++) {
            const p = party[i];
            const isBackRow = backRowIds.includes(p.id);
            const py = H / 2 + (i - party.length / 2) * 28 + 14;
            const px = partyX + (py - H / 2) * diagSlope - (isBackRow ? 24 : 0);
            const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
            let bounceY = 0;
            if (isCelebrating && p.hp > 0) {
                const t = (Date.now() - this._expVisState._celebrateStart) / 1000;
                bounceY = -Math.abs(Math.sin((t * 4) + i * 1.2)) * 8;
            }
            ctx.globalAlpha = p.hp <= 0 ? 0.15 : 0.25;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(px, py + 8, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            if (p.hp <= 0) {
                ctx.globalAlpha = 0.4;
            }
            if (useSkins) {
                let sprite;
                if (p.golem && p.golemType) {
                    sprite = skinMgr.getSprite('entities', p.golemType);
                } else {
                    if (p.armor || p.helmet || p.weapon || p.tool) {
                        let armorKey = '';
                        let helmetKey = '';
                        let weaponKey = '';
                        let toolKey = '';
                        if (p.armor) armorKey = p.armor.key;
                        if (p.helmet) helmetKey = p.helmet.key;
                        if (p.weapon) weaponKey = p.weapon.key;
                        if (p.tool) toolKey = p.tool.key;
                        sprite = skinMgr.getCompositedColonistSprite(p.id, false, p.raceKey, armorKey, helmetKey, p.bodyVariant, p.hairVariant, p.shirtVariant, p.nameColor, weaponKey, toolKey, false);
                    }
                    else {
                        sprite = skinMgr.getColonistSprite(p.id, false, p.raceKey, p.bodyVariant, p.hairVariant, p.shirtVariant, p.nameColor, false);
                    }
                }
                const grow = p.hp > 0 ? _breathe(p.id || i) : 0;
                if (sprite) {
                    ctx.drawImage(sprite, px - 16, py + bounceY - 16 - grow, 32, 32 + grow);
                } else {
                    ctx.font = 'bold 18px monospace';
                    ctx.fillStyle = '#ccc';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('@', px, py + bounceY - grow);
                }
            } else {
                const grow = p.hp > 0 ? _breathe(p.id || i) : 0;
                ctx.font = 'bold 18px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (hpPct < 0.3) {
                    ctx.fillStyle = '#ff4444';
                } else if (hpPct < 0.6) {
                    ctx.fillStyle = '#ffaa44';
                } else {
                    ctx.fillStyle = '#44ff44';
                }
                ctx.fillText(p.golem ? 'G' : '@', px, py + bounceY - grow);
            }
            ctx.globalAlpha = 1;
            if (p.hp > 0) {
                const barW = 16, barH = 2;
                const barX = px - barW / 2;
                const barY = py + bounceY - 15;
                ctx.fillStyle = '#222';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = hpPct > 0.6 ? '#44ff44' : hpPct > 0.3 ? '#ffaa44' : '#ff4444';
                ctx.fillRect(barX, barY, barW * hpPct, barH);
                if (p.maxMana > 0) {
                    const manaPct = p.mana / p.maxMana;
                    ctx.fillStyle = '#222';
                    ctx.fillRect(barX, barY + 3, barW, barH);
                    ctx.fillStyle = '#4466ff';
                    ctx.fillRect(barX, barY + 3, barW * manaPct, barH);
                }
            }
        }

        if (activeExp.packAnimals && activeExp.packAnimals.length > 0) {
            for (let i = 0; i < activeExp.packAnimals.length; i++) {
                const pa = activeExp.packAnimals[i];
                const pay = H / 2 + (i - activeExp.packAnimals.length / 2) * 28 + 14;
                const pax = partyX - 32 + (pay - H / 2) * diagSlope;
                const animalDef = ANIMALS[pa.type];
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.ellipse(pax, pay + 8, 10, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                const paGrow = _breathe(100 + i);
                if (useSkins) {
                    const sprite = skinMgr.getSprite('entities', pa.type);
                    if (sprite) {
                        ctx.drawImage(sprite, pax - 16, pay - 16 - paGrow, 32, 32 + paGrow);
                    } else {
                        ctx.font = 'bold 18px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = animalDef?.color || '#bbaa44';
                        ctx.fillText(animalDef?.char || 'a', pax, pay - paGrow);
                    }
                } else {
                    ctx.font = 'bold 18px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = animalDef?.color || '#bbaa44';
                    ctx.fillText(animalDef?.char || 'a', pax, pay - paGrow);
                }
            }
        }

        const activeSummons = (activeExp.summons || []).filter(s => s.hp > 0);
        for (let si = 0; si < activeSummons.length; si++) {
            const summon = activeSummons[si];
            const ownerIdx = party.findIndex(p => p.id === summon.ownerId);
            const oy = ownerIdx >= 0 ? H / 2 + (ownerIdx - party.length / 2) * 28 + 14 : H / 2 + si * 28 - 6;
            const sy = oy;
            const sx = partyX + 30 + (sy - H / 2) * diagSlope;
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(sx, sy + 8, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005 + si) * 0.15;
            ctx.strokeStyle = summon.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            const sumGrow = _breathe(200 + si);
            if (useSkins) {
                const sumSprite = skinMgr.getSprite('entities', summon.type);
                if (sumSprite) {
                    ctx.drawImage(sumSprite, sx - 16, sy - 16 - sumGrow, 32, 32 + sumGrow);
                } else {
                    ctx.font = 'bold 18px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = summon.color;
                    ctx.fillText(summon.char, sx, sy - sumGrow);
                }
            } else {
                ctx.font = 'bold 18px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = summon.color;
                ctx.fillText(summon.char, sx, sy - sumGrow);
            }
            const sHpPct = summon.hp / summon.maxHp;
            const sBarW = 18, sBarH = 2;
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - sBarW / 2, sy - 13, sBarW, sBarH);
            ctx.fillStyle = sHpPct > 0.6 ? '#44ff44' : sHpPct > 0.3 ? '#ffaa44' : '#ff4444';
            ctx.fillRect(sx - sBarW / 2, sy - 13, sBarW * sHpPct, sBarH);
            if (summon.maxDuration) {
                const dPct = summon.ticksRemaining / summon.maxDuration;
                ctx.fillStyle = '#222';
                ctx.fillRect(sx - sBarW / 2, sy - 10, sBarW, sBarH);
                ctx.fillStyle = '#ddcc44';
                ctx.fillRect(sx - sBarW / 2, sy - 10, sBarW * dPct, sBarH);
            }
        }

        if (activeExp.combat) {
            const enemies = activeExp.combat.enemies.filter(e => e.hp > 0);
            const enemySpriteKey = realmDef?.enemies?.sprite;
            const enemySprite = useSkins && enemySpriteKey ? skinMgr.getSprite('entities', enemySpriteKey) : null;
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                const isBackRow = i >= 5;
                const rowIdx = isBackRow ? i - 5 : i;
                const rowCount = isBackRow ? Math.min(enemies.length - 5, 5) : Math.min(enemies.length, 5);
                const ey = H / 2 + (rowIdx - rowCount / 2) * 28 + 14;
                const ex = partyX + 80 + (isBackRow ? 32 : 0) + (ey - H / 2) * diagSlope;
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                if (enemy.isBoss) {
                    ctx.ellipse(ex, ey + 16, 18, 6, 0, 0, Math.PI * 2);
                } else {
                    ctx.ellipse(ex, ey + 8, 10, 4, 0, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.globalAlpha = 1;
                if (enemy.isBoss) {
                    const bGrow = _breathe(400 + i);
                    const bossSpriteKey = enemy.enraged && enemy.enragedSprite ? enemy.enragedSprite : enemy.sprite;
                    const bossSprite = useSkins && bossSpriteKey ? skinMgr.getSprite('entities', bossSpriteKey) : null;
                    const bossColor = enemy.enraged ? (enemy.enragedColor || '#ff0000') : (enemy.color || '#ff8844');
                    const sz = 24;
                    if (bossSprite) {
                        ctx.drawImage(bossSprite, ex - sz, ey - sz - bGrow, sz * 2, sz * 2 + bGrow);
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(ex, ey - sz - bGrow);
                        ctx.lineTo(ex - sz * 0.85, ey + sz * 0.7);
                        ctx.lineTo(ex + sz * 0.85, ey + sz * 0.7);
                        ctx.closePath();
                        ctx.fillStyle = bossColor;
                        ctx.fill();
                        ctx.strokeStyle = enemy.enraged ? '#ff0000' : '#880000';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = enemy.enraged ? '#ff4444' : '#ffcc44';
                    ctx.fillText(enemy.name, ex, ey - sz - 10);
                    if (enemy.enraged) {
                        ctx.globalAlpha = 0.25 + Math.sin(Date.now() * 0.008) * 0.15;
                        ctx.fillStyle = '#ff0000';
                        ctx.beginPath();
                        ctx.arc(ex, ey, sz + 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                } else {
                    const eGrow = _breathe(300 + i);
                    const perEnemySpriteKey = enemy.sprite || enemySpriteKey;
                    const perEnemySprite = useSkins && perEnemySpriteKey ? skinMgr.getSprite('entities', perEnemySpriteKey) : null;
                    if (perEnemySprite) {
                        ctx.drawImage(perEnemySprite, ex - 16, ey - 16 - eGrow, 32, 32 + eGrow);
                    } else {
                        ctx.beginPath();
                        ctx.moveTo(ex, ey - 14 - eGrow);
                        ctx.lineTo(ex - 12, ey + 10);
                        ctx.lineTo(ex + 12, ey + 10);
                        ctx.closePath();
                        ctx.fillStyle = enemy.elite ? (enemy.eliteColor || '#ff8833') : (enemy.color || '#ff3333');
                        ctx.fill();
                        ctx.strokeStyle = enemy.elite ? '#ffffff' : '#aa0000';
                        ctx.lineWidth = enemy.elite ? 1.5 : 1;
                        ctx.stroke();
                    }
                }
                // Elite glow
                if (enemy.elite) {
                    ctx.globalAlpha = 0.2 + Math.sin(Date.now() * 0.006 + i) * 0.1;
                    ctx.fillStyle = enemy.eliteColor || '#ff8833';
                    ctx.beginPath();
                    ctx.arc(ex, ey, 18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.font = 'bold 8px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = enemy.eliteColor || '#ff8833';
                    ctx.fillText(enemy.eliteName || '', ex, ey - 20);
                }
                if (enemy.maxHp) {
                    const eHpPct = enemy.hp / enemy.maxHp;
                    const eBarW = enemy.isBoss ? 30 : 18;
                    const eBarH = enemy.isBoss ? 3 : 2;
                    const eBarY = enemy.isBoss ? ey - 32 : ey - 18;
                    ctx.fillStyle = '#222';
                    ctx.fillRect(ex - eBarW / 2, eBarY, eBarW, eBarH);
                    ctx.fillStyle = eHpPct > 0.6 ? '#ff6666' : eHpPct > 0.3 ? '#ff4444' : '#cc2222';
                    ctx.fillRect(ex - eBarW / 2, eBarY, eBarW * eHpPct, eBarH);
                }
            }

        }

        const logLen = activeExp.log.length;
        if (logLen > this._expVisState.lastLogLen) {
            const newEntries = activeExp.log.slice(this._expVisState.lastLogLen);
            const partyNames = activeExp.partySnapshot ? activeExp.partySnapshot.map(p => p.name) : [];
            const _casterPos = (name) => {
                const idx = partyNames.indexOf(name);
                if (idx < 0) return { x: partyX, y: H / 2 };
                const isBack = backRowIds.includes(party[idx]?.id);
                const cy = H / 2 + (idx - party.length / 2) * 28 + 14;
                const cx = partyX + (cy - H / 2) * diagSlope - (isBack ? 24 : 0);
                return { x: cx, y: cy };
            };
            const _findCaster = (text) => {
                for (const n of partyNames) {
                    if (text.startsWith(n)) return n;
                }
                return null;
            };
            for (const entry of newEntries) {
                const text = entry.text || '';
                const isCast = text.includes('casts');
                const casterName = isCast ? _findCaster(text) : null;
                const cp = casterName ? _casterPos(casterName) : { x: partyX, y: H / 2 };
                if (isCast && text.includes('heals')) {
                    this._expVisState.effects.push({ type: 'spell_heal', x: cp.x, y: cp.y - 5, frame: 0, maxFrames: 30 });
                    const healMatch = text.match(/(\d+) HP/);
                    if (healMatch) this._expVisState.effects.push({ type: 'damage_number', text: healMatch[1], color: '#44ff44', x: cp.x, y: cp.y - 10, frame: 0, maxFrames: 25 });
                } else if (isCast && text.includes('shielded')) {
                    this._expVisState.effects.push({ type: 'spell_shield', x: cp.x, y: cp.y, frame: 0, maxFrames: 35 });
                } else if (isCast && text.includes('phasing')) {
                    this._expVisState.effects.push({ type: 'spell_shield', x: cp.x, y: cp.y, frame: 0, maxFrames: 35 });
                } else if (isCast && (text.includes('damage') || text.includes('Hits'))) {
                    const school = this._detectSpellSchool(text);
                    this._expVisState.effects.push({ type: 'spell_attack', school, x: cp.x + 15, y: cp.y, frame: 0, maxFrames: 25 });
                    const dmgMatch = text.match(/for (\d+)/);
                    if (dmgMatch) this._expVisState.effects.push({ type: 'damage_number', text: dmgMatch[1], color: '#ffff44', x: partyX + 70 + Math.random() * 20, y: H / 2 - 10 + Math.random() * 15, frame: 0, maxFrames: 25 });
                } else if (text.includes('summons a')) {
                    const summonerName = _findCaster(text);
                    const sp = summonerName ? _casterPos(summonerName) : { x: partyX + 25, y: H / 2 };
                    this._expVisState.effects.push({ type: 'spell_summon', x: sp.x + 15, y: sp.y, frame: 0, maxFrames: 40 });
                } else if (text.includes('enters phase:')) {
                    const phaseName = text.match(/phase: (.+)!/)?.[1] || '';
                    this._expVisState.effects.push({ type: 'phase_transition', x: partyX + 80, y: H / 2, phaseName, frame: 0, maxFrames: 60 });
                    this._expVisState.shakeFrames = 15;
                    this._expVisState.flashFrames = 8;
                } else if (text.includes('powerful foe') || text.includes('blocks the path')) {
                    const bossEnemy = activeExp.combat?.enemies?.find(e => e.isBoss);
                    this._expVisState.effects.push({
                        type: 'boss_entrance', x: partyX + 80, y: H / 2,
                        bossName: bossEnemy?.name || 'Boss', bossColor: bossEnemy?.color || '#ff8844',
                        frame: 0, maxFrames: 90,
                    });
                    this._expVisState.shakeFrames = 12;
                } else if (text.includes('slays') || text.includes('is slain')) {
                    const isPartyKill = partyNames.some(n => text.startsWith(n));
                    const deathX = isPartyKill ? (partyX + 70 + Math.random() * 20) : (partyX + Math.random() * 15);
                    this._expVisState.effects.push({ type: 'death_anim', x: deathX, y: H / 2 - 5 + Math.random() * 10, frame: 0, maxFrames: 30, color: isPartyKill ? '#ff4444' : '#888888' });
                    if (!isPartyKill) {
                        this._expVisState.effects.push({ type: 'loot', x: partyX + Math.random() * 20, y: H / 2 - 20 + Math.random() * 10, frame: 0, maxFrames: 40 });
                    }
                } else if (entry.type === 'loot' || entry.type === 'success') {
                    this._expVisState.effects.push({ type: 'loot', x: partyX + Math.random() * 20, y: H / 2 - 20 + Math.random() * 10, frame: 0, maxFrames: 40 });
                } else if (entry.type === 'danger') {
                    this._expVisState.effects.push({ type: 'danger', x: partyX - 5 + Math.random() * 30, y: H / 2, frame: 0, maxFrames: 20 });
                    this._expVisState.shakeFrames = 6;
                    this._expVisState.flashFrames = 3;
                }
                if (entry.type === 'combat') {
                    const isHit = text.includes('for ');
                    const isPhase = text.includes('phases through');
                    const isMiss = !isHit && (text.includes('misses') || text.includes('dodges') || isPhase);
                    if (isHit || isMiss) {
                        const isPartyAttacking = partyNames.some(n => text.startsWith(n));
                        const isEnemyAttacking = !isPartyAttacking;
                        const dodgerName = (isMiss && !isPartyAttacking) ? _findCaster(text) : null;
                        const dodgerPos = dodgerName ? _casterPos(dodgerName) : null;
                        const targetX = dodgerPos ? dodgerPos.x : (isPartyAttacking ? (partyX + 75 + Math.random() * 15) : (partyX + Math.random() * 15));
                        const targetY = dodgerPos ? dodgerPos.y : (H / 2 - 5 + Math.random() * 15);
                        const slashDir = isPartyAttacking ? 1 : -1;
                        const slashColor = isMiss ? '#888888' : (isPartyAttacking ? '#ffff44' : '#ff4444');
                        this._expVisState.effects.push({
                            type: 'slash', x: targetX, y: targetY,
                            dir: slashDir, color: slashColor,
                            frame: 0, maxFrames: isMiss ? 10 : 15,
                        });
                        if (isHit) {
                            const dmgMatch = text.match(/for (\d+)/);
                            if (dmgMatch) {
                                const numColor = isEnemyAttacking ? '#ff6644' : '#ffff44';
                                this._expVisState.effects.push({ type: 'hit_flash', x: targetX, y: targetY, color: numColor, frame: 0, maxFrames: 8 });
                                this._expVisState.effects.push({ type: 'damage_number', text: dmgMatch[1], color: numColor, x: targetX, y: targetY, frame: 0, maxFrames: 25 });
                            }
                            if (isEnemyAttacking) this._expVisState.shakeFrames = Math.max(this._expVisState.shakeFrames, 3);
                        }
                    }
                }
            }
            this._expVisState.lastLogLen = logLen;
        }

        if (this._expVisState.flashFrames > 0) {
            ctx.fillStyle = '#ff0000';
            ctx.globalAlpha = 0.12;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
            this._expVisState.flashFrames--;
        }

        if (activeExp.pendingDecision) {
            const pulse = 0.06 + Math.sin(Date.now() * 0.004) * 0.04;
            ctx.fillStyle = '#44ccff';
            ctx.globalAlpha = pulse;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
            const borderPulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
            ctx.strokeStyle = '#44ccff';
            ctx.globalAlpha = borderPulse;
            ctx.lineWidth = 3;
            ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
            ctx.globalAlpha = 1;
        }

        for (let i = this._expVisState.effects.length - 1; i >= 0; i--) {
            const eff = this._expVisState.effects[i];
            eff.frame++;
            if (eff.frame >= eff.maxFrames) {
                this._expVisState.effects.splice(i, 1);
                continue;
            }
            const alpha = 1 - eff.frame / eff.maxFrames;
            ctx.globalAlpha = alpha;
            if (eff.type === 'slash') {
                const slashSprite = useSkins ? skinMgr.getSprite('effects', 'slash') : null;
                const d = eff.dir || 1;
                if (slashSprite) {
                    ctx.save();
                    ctx.translate(eff.x, eff.y);
                    if (d < 0) ctx.scale(-1, 1);
                    ctx.drawImage(slashSprite, -8, -8, 16, 16);
                    ctx.restore();
                } else {
                    ctx.strokeStyle = eff.color || '#ffff44';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(eff.x - 6 * d, eff.y - 6);
                    ctx.lineTo(eff.x + 6 * d, eff.y + 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(eff.x - 4 * d, eff.y + 4);
                    ctx.lineTo(eff.x + 4 * d, eff.y - 4);
                    ctx.stroke();
                }
            } else if (eff.type === 'loot') {
                const lootSprite = useSkins ? skinMgr.getSprite('effects', 'loot') : null;
                const dy = -eff.frame * 0.5;
                if (lootSprite) {
                    ctx.drawImage(lootSprite, eff.x - 8, eff.y + dy - 8, 16, 16);
                } else {
                    ctx.fillStyle = '#ffcc44';
                    ctx.beginPath();
                    ctx.moveTo(eff.x, eff.y + dy - 6);
                    ctx.lineTo(eff.x - 5, eff.y + dy);
                    ctx.lineTo(eff.x, eff.y + dy + 6);
                    ctx.lineTo(eff.x + 5, eff.y + dy);
                    ctx.closePath();
                    ctx.fill();
                }
            } else if (eff.type === 'danger') {
                const dangerSprite = useSkins ? skinMgr.getSprite('effects', 'danger') : null;
                if (dangerSprite) {
                    ctx.drawImage(dangerSprite, eff.x - 15, eff.y - 15, 30, 30);
                } else {
                    ctx.fillStyle = '#ff2222';
                    ctx.globalAlpha = alpha * 0.4;
                    ctx.fillRect(eff.x - 15, eff.y - 15, 30, 30);
                }
            } else if (eff.type === 'spell_heal') {
                const healSprite = useSkins ? skinMgr.getSprite('effects', 'spell_heal') : null;
                if (healSprite) {
                    ctx.drawImage(healSprite, eff.x - 8, eff.y - 8 - eff.frame * 0.8, 16, 16);
                } else {
                    ctx.fillStyle = '#44ff44';
                    ctx.font = 'bold 18px monospace';
                    ctx.fillText('+', eff.x, eff.y - eff.frame * 0.8);
                    for (let s = 0; s < 3; s++) {
                        ctx.globalAlpha = alpha * 0.5;
                        ctx.fillRect(eff.x - 4 + Math.sin(eff.frame * 0.3 + s * 2) * 6, eff.y - eff.frame * 0.6 - s * 3, 2, 2);
                    }
                }
            } else if (eff.type === 'spell_shield') {
                const shieldSprite = useSkins ? skinMgr.getSprite('effects', 'spell_shield') : null;
                if (shieldSprite) {
                    const sz = 16 + eff.frame * 0.6;
                    ctx.drawImage(shieldSprite, eff.x - sz / 2, eff.y - sz / 2, sz, sz);
                } else {
                    ctx.strokeStyle = '#4488ff';
                    ctx.lineWidth = 2;
                    const r = 8 + eff.frame * 0.3;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r * 0.7, Math.PI * 0.2, Math.PI * 0.8);
                    ctx.stroke();
                }
            } else if (eff.type === 'spell_attack') {
                const spellAtkSprite = useSkins ? skinMgr.getSprite('effects', 'spell_attack') : null;
                if (spellAtkSprite) {
                    const bx = eff.x + eff.frame * 3;
                    ctx.drawImage(spellAtkSprite, bx - 8, eff.y - 8, 16, 16);
                } else if (eff.school === 'evocation') {
                    const bx = eff.x + eff.frame * 3;
                    ctx.fillStyle = '#ff6600';
                    for (let s = 0; s < 3; s++) {
                        const sx = bx - s * 5;
                        const sr = 3 - s * 0.5;
                        ctx.globalAlpha = alpha * (1 - s * 0.25);
                        ctx.beginPath();
                        ctx.arc(sx, eff.y + Math.sin(eff.frame + s) * 2, sr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.fillStyle = '#ffaa33';
                    ctx.fillRect(eff.x, eff.y - 1, eff.frame * 3, 2);
                } else if (eff.school === 'conjuration') {
                    ctx.fillStyle = '#aa44ff';
                    ctx.strokeStyle = '#aa44ff';
                    ctx.lineWidth = 1;
                    const progress = eff.frame / eff.maxFrames;
                    for (let s = 0; s < 4; s++) {
                        const angle = (s / 4) * Math.PI * 2 + eff.frame * 0.15;
                        const dist = 12 * (1 - progress);
                        const px = eff.x + Math.cos(angle) * dist;
                        const py = eff.y + Math.sin(angle) * dist;
                        ctx.globalAlpha = alpha * 0.8;
                        ctx.beginPath();
                        ctx.arc(px, py, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    ctx.fillStyle = '#aa44ff';
                    const bx = eff.x + eff.frame * 2.5;
                    ctx.beginPath();
                    ctx.moveTo(bx, eff.y);
                    ctx.lineTo(bx - 5, eff.y - 3);
                    ctx.lineTo(bx - 5, eff.y + 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#dd88ff';
                    ctx.globalAlpha = alpha * 0.5;
                    ctx.fillRect(eff.x, eff.y - 1, eff.frame * 2.5, 2);
                }
            } else if (eff.type === 'spell_summon') {
                const summonSprite = useSkins ? skinMgr.getSprite('effects', 'spell_summon') : null;
                const progress = eff.frame / eff.maxFrames;
                if (summonSprite) {
                    const sz = 20 * (1 - progress * 0.3);
                    ctx.drawImage(summonSprite, eff.x - sz / 2, eff.y - sz / 2, sz, sz);
                } else {
                    ctx.strokeStyle = '#aa44ff';
                    ctx.lineWidth = 1.5;
                    const r = 10 * (1 - progress * 0.5);
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r * 0.6, 0, Math.PI * 2 * progress);
                    ctx.stroke();
                    if (progress > 0.5) {
                        ctx.globalAlpha = (progress - 0.5) * 2 * alpha;
                        ctx.fillStyle = '#ffaa22';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('★', eff.x, eff.y);
                    }
                }
            } else if (eff.type === 'damage_number') {
                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = eff.color;
                ctx.textAlign = 'center';
                ctx.fillText(eff.text, eff.x, eff.y - eff.frame * 0.7);
            } else if (eff.type === 'attack_line') {
                const progress = eff.frame / eff.maxFrames;
                const curX = eff.fromX + (eff.toX - eff.fromX) * Math.min(progress * 2, 1);
                ctx.strokeStyle = eff.color;
                ctx.lineWidth = 2 * alpha;
                ctx.beginPath();
                ctx.moveTo(eff.fromX, eff.y);
                ctx.lineTo(curX, eff.y + Math.sin(progress * Math.PI * 3) * 3);
                ctx.stroke();
            } else if (eff.type === 'hit_flash') {
                const hitSprite = useSkins ? skinMgr.getSprite('effects', 'hit_flash') : null;
                if (hitSprite) {
                    const sz = 12 + eff.frame * 1.5;
                    ctx.drawImage(hitSprite, eff.x - sz, eff.y - sz, sz * 2, sz * 2);
                } else {
                    const r = 6 + eff.frame * 1.5;
                    ctx.fillStyle = eff.color;
                    ctx.globalAlpha = alpha * 0.7;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    for (let s = 0; s < 4; s++) {
                        const angle = (s / 4) * Math.PI * 2 + eff.frame * 0.2;
                        ctx.beginPath();
                        ctx.moveTo(eff.x + Math.cos(angle) * r * 0.4, eff.y + Math.sin(angle) * r * 0.4);
                        ctx.lineTo(eff.x + Math.cos(angle) * r, eff.y + Math.sin(angle) * r);
                        ctx.stroke();
                    }
                }
            } else if (eff.type === 'death_anim') {
                const deathSprite = useSkins ? skinMgr.getSprite('effects', 'death') : null;
                const progress = eff.frame / eff.maxFrames;
                if (deathSprite) {
                    const sz = 16 * (1 - progress * 0.5);
                    ctx.drawImage(deathSprite, eff.x - sz / 2, eff.y - sz / 2, sz, sz);
                } else {
                    ctx.fillStyle = eff.color || '#ff4444';
                    for (let p = 0; p < 6; p++) {
                        const angle = (p / 6) * Math.PI * 2 + eff.frame * 0.1;
                        const dist = progress * 15;
                        const px = eff.x + Math.cos(angle) * dist;
                        const py = eff.y + Math.sin(angle) * dist + progress * 8;
                        ctx.globalAlpha = alpha * 0.8;
                        const sz = 2 * (1 - progress);
                        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
                    }
                    if (progress < 0.3) {
                        ctx.globalAlpha = (0.3 - progress) * 3 * 0.4;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(eff.x, eff.y, 8 + progress * 20, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (eff.type === 'boss_entrance') {
                const progress = eff.frame / eff.maxFrames;
                if (progress < 0.4) {
                    const fadeIn = progress / 0.4;
                    ctx.globalAlpha = fadeIn * 0.3;
                    ctx.fillStyle = eff.bossColor;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalAlpha = fadeIn;
                    const silhouetteR = 12 + fadeIn * 8;
                    ctx.fillStyle = '#000000';
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, silhouetteR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = eff.bossColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, silhouetteR + 2, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (progress < 0.7) {
                    const mid = (progress - 0.4) / 0.3;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = eff.bossColor;
                    ctx.font = 'bold 11px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(eff.bossName, eff.x, eff.y - 18);
                    ctx.strokeStyle = eff.bossColor;
                    ctx.lineWidth = 1;
                    const lineW = 30 * mid;
                    ctx.beginPath();
                    ctx.moveTo(eff.x - lineW, eff.y - 10);
                    ctx.lineTo(eff.x + lineW, eff.y - 10);
                    ctx.stroke();
                    ctx.fillStyle = '#000000';
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y + 2, 14, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = eff.bossColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y + 2, 15, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    const fadeOut = (progress - 0.7) / 0.3;
                    ctx.globalAlpha = 1 - fadeOut;
                    ctx.fillStyle = eff.bossColor;
                    ctx.font = 'bold 11px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(eff.bossName, eff.x, eff.y - 18);
                    const pulseR = 15 + Math.sin(eff.frame * 0.3) * 3;
                    ctx.strokeStyle = eff.bossColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y + 2, pulseR, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else if (eff.type === 'phase_transition') {
                const progress = eff.frame / eff.maxFrames;
                if (progress < 0.5) {
                    const intensity = progress / 0.5;
                    ctx.globalAlpha = intensity * 0.25;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalAlpha = intensity;
                    ctx.strokeStyle = '#ff4444';
                    ctx.lineWidth = 2;
                    for (let c = 0; c < 3; c++) {
                        const cr = (8 + c * 10) * intensity;
                        ctx.beginPath();
                        ctx.arc(eff.x, eff.y, cr, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                } else {
                    const fadeOut = (progress - 0.5) / 0.5;
                    ctx.globalAlpha = 1 - fadeOut;
                    ctx.fillStyle = '#ffcc44';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(eff.phaseName || 'Phase shift!', eff.x, eff.y - 15 - fadeOut * 10);
                    ctx.strokeStyle = '#ffcc44';
                    ctx.lineWidth = 1.5;
                    const r = 12 + fadeOut * 8;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
        }

        if (shakeApplied) ctx.restore();
    },

    _detectSpellSchool(text) {
        for (const spell of Object.values(SPELLS)) {
            if (text.includes(spell.name)) return spell.school;
        }
        return 'evocation';
    },

    _resourceIcon(resKey) {
        const mgr = this.game.skinManager;
        if (mgr && mgr.isActive) {
            const url = mgr.getItemSpriteDataURL(resKey);
            if (url) return `<img src="${url}" style="width:14px;height:14px;vertical-align:middle;margin-right:2px;image-rendering:pixelated;">`;
        }
        return '';
    },

    _itemIcon(itemKey, categoryHint) {
        const mgr = this.game.skinManager;
        if (mgr && mgr.isActive) {
            const url = mgr.getItemSpriteDataURL(itemKey);
            if (url) return `<img src="${url}" style="width:14px;height:14px;vertical-align:middle;margin-right:2px;image-rendering:pixelated;">`;
        }
        const cat = categoryHint || this._getItemCategory(itemKey);
        if (!cat) return '';
        const itemDef = (WEAPONS[itemKey] || ARMORS[itemKey] || HELMETS[itemKey] || CLOTHES[itemKey] || TOOLS[itemKey] || TRINKETS[itemKey] || POTIONS[itemKey] || SPELL_TOMES[itemKey] || ALL_ITEMS[itemKey]);
        const ch = itemDef?.char || ITEM_CHARS[cat]?.char;
        if (!ch) return '';
        const color = itemDef?.charColor || ITEM_CHARS[cat]?.color || '#aaa';
        return `<span style="color:${color};font-weight:bold;margin-right:2px;">${ch}</span>`;
    },

    _getItemCategory(itemKey) {
        if (WEAPONS[itemKey]) return 'weapon';
        if (ARMORS[itemKey]) return 'armor';
        if (HELMETS[itemKey]) return 'helmet';
        if (CLOTHES[itemKey]) return 'clothes';
        if (TOOLS[itemKey]) return 'tool';
        if (TRINKETS[itemKey]) return 'trinket';
        if (POTIONS[itemKey]) return 'potion';
        if (SPELL_TOMES[itemKey]) return 'tome';
        return ALL_ITEMS[itemKey]?.type || null;
    },

    getColonistTaskDescription(colonist) {
        const relaxLabel = getRelaxActivityLabel(colonist);
        if (relaxLabel) return `<span style="color:#88cc88;cursor:pointer" onclick="window.game.camera.centerOn(${colonist.x},${colonist.y})">${relaxLabel}</span>`;
        if (!colonist.currentTaskId) return `<span style="color:#666;cursor:pointer" onclick="window.game.camera.centerOn(${colonist.x},${colonist.y})">None</span>`;
        const task = this.game.taskQueue.getAll().find(t => t.id === colonist.currentTaskId);
        if (!task) return `<span style="color:#666;cursor:pointer" onclick="window.game.camera.centerOn(${colonist.x},${colonist.y})">None</span>`;
        let label;
        switch (task.type) {
            case 'build': label = `Building ${(task.buildType || '').replace(/_/g, ' ')}`; break;
            case 'mine': label = 'Mining'; break;
            case 'chop': label = 'Chopping tree'; break;
            case 'deconstruct': label = 'Deconstructing'; break;
            case 'plant': label = 'Planting'; break;
            case 'harvest': label = 'Harvesting'; break;
            case 'craft': label = `Crafting ${task.recipe?.name || 'item'}`; break;
            case 'cook': label = `Cooking ${task.recipe?.name || 'food'}`; break;
            default: label = task.type; break;
        }
        return `<span style="cursor:pointer;text-decoration:underline" onclick="window.game.camera.centerOn(${task.x},${task.y})">${label} at (${task.x},${task.y})</span>`;
    },
};

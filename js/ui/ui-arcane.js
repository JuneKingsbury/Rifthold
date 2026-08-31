import { BUILDINGS, REALMS, ANIMALS, TAMED_ANIMALS, WEAPONS, ARMORS, HELMETS, CLOTHES, TOOLS, TRINKETS, POTIONS, SPELL_TOMES, ITEM_CHARS, EXPEDITION_DIFFICULTY, ALL_ITEMS, SPELLS } from '../core/config.js';
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
                const logEl = this.elements.arcanePanel.querySelector('.exp-log-container');
                if (logEl) logEl.scrollTop = logEl.scrollHeight;
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
                    const pct = Math.min(100, Math.floor((elapsed / totalDur) * 100));
                    html += `<div class="info-row" style="color:#aaddff;font-weight:bold;">${exp.realmName} — ${exp.status}${exp.combat ? ' [COMBAT]' : ''}</div>`;
                    html += `<div class="info-row">Progress: <span style="color:#88ddff">${pct}%</span></div>`;

                    html += `<canvas class="exp-vis-canvas" width="720" height="140"></canvas>`;

                    const snapshot = exp.partySnapshot || [];
                    const aliveParty = snapshot.filter(p => p.hp > 0);
                    html += `<div class="info-row" style="color:#888;">Party (${aliveParty.length}/${snapshot.length} alive):</div>`;
                    for (const p of snapshot) {
                        const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
                        const color = p.hp <= 0 ? '#664444' : hpPct < 30 ? '#ff4444' : hpPct < 60 ? '#ffaa44' : '#88cc88';
                        const status = p.hp <= 0 ? ' [DOWN]' : '';
                        const manaStr = p.maxMana > 0 ? ` | ${Math.round(p.mana)}/${p.maxMana} MP` : '';
                        const threatStr = getThreatDisplayHtml(getTargetPriority(p));
                        html += `<div class="info-row" style="color:${color}; padding-left:8px;">${p.name} — ${Math.max(0, Math.round(p.hp))}/${p.maxHp} HP${manaStr}${status}${threatStr}</div>`;
                    }

                    if (exp.combat) {
                        const enemiesAlive = exp.combat.enemies.filter(e => e.hp > 0).length;
                        html += `<div class="info-row" style="color:#ff8844;margin-top:4px;">Enemies: ${enemiesAlive}/${exp.combat.enemies.length}</div>`;
                    }

                    html += `<div class="exp-log-container">`;
                    const logSlice = exp.log.slice(-15);
                    for (const entry of logSlice) {
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

            if (expl.completedExpeditions.length > 0) {
                const last = expl.completedExpeditions[expl.completedExpeditions.length - 1];
                html += `<div class="info-row" style="margin-top:10px;color:#88ccff;font-weight:bold;">Last: ${last.realmName}</div>`;
                html += `<div class="exp-log-container">`;
                const logSlice = last.log.slice(-10);
                for (const entry of logSlice) {
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
        const available = this.game.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.drafted && !(c.traits && c.traits.includes('pacifist')));
        let html = `<div class="arcane-section">`;
        html += `<div class="info-row" style="color:#33ccff;font-weight:bold;">Select Party</div>`;
        html += `<div class="info-row" style="color:#888;">Choose up to 5 colonists:</div>`;
        for (const c of available) {
            const dmg = c.weapon ? c.weapon.damage : 5;
            const def = c.armor ? Math.round(c.armor.damageReduction * 100) : 0;
            const priority = getTargetPriority(c);
            const priorityStr = priority !== 0 ? ` <span style="color:${priority > 0 ? '#ff6644' : '#66aaff'}">${priority > 0 ? '▲' : '▼'}Thr</span>` : '';
            const defStr = def > 0 ? ` Def:${def}%` : '';
            html += `<div class="info-row"><label><input type="checkbox" class="exp-check" value="${c.id}" data-max="5"> ${c.name} <span style="color:#888;font-size:0.85em;">Dmg:${dmg}${defStr}${priorityStr}</span></label></div>`;
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
                html += `<div class="info-row"><label><input type="checkbox" class="exp-pack-check" value="${a.id}" data-max="2"> ${a.type} (+${Math.round(def.expeditionSpeedBonus * 100)}% speed)</label></div>`;
            }
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
        enforce('exp-pack-check', 2);

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

    _renderExpeditionVis() {
        const canvas = this.elements.arcanePanel.querySelector('.exp-vis-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
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
        const totalDur = Math.floor(activeExp.duration * 1.2);
        let progress = Math.min(1, elapsed / totalDur);
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

        const tileSize = 12;
        const wallRows = 2;
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
            for (let ty = wallH; ty < H - 14; ty += tileSize) {
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
        const floorBottom = H - 14;
        const diagSlope = 0.4;

        const roomCount = 8;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        for (let i = 1; i < roomCount; i++) {
            const rx = (W / roomCount) * i;
            ctx.beginPath();
            ctx.moveTo(rx, 0);
            ctx.lineTo(rx, wallH);
            ctx.lineTo(rx + (floorBottom - wallH) * diagSlope, floorBottom);
            ctx.stroke();
        }

        const finishX = W - tileSize * 5;
        const checkSize = 6;
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

        ctx.fillStyle = '#222';
        ctx.fillRect(0, H - 14, W, 14);
        ctx.fillStyle = isRetreating ? '#ff4444' : colors.accent;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, H - 14, W * progress, 14);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ccc';
        ctx.font = '10px monospace';
        ctx.fillText(isRetreating ? 'RETREATING' : `${Math.floor(progress * 100)}%`, W * progress - 20, H - 3);

        let targetX;
        const finishLineX = W - tileSize * 5;
        if (!exp && this._expVisState.finishing) {
            targetX = W + 60;
        } else if (isRetreating) {
            const startX = 30 + progress * (finishLineX - 30);
            targetX = startX * (1 - retreatProgress);
        } else if (progress >= 1) {
            targetX = W + 60;
        } else {
            targetX = 30 + progress * (finishLineX - 30);
        }
        const walkSpeed = (targetX > W) ? 0.025 : 0.1;
        this._expVisState.partyX += (targetX - this._expVisState.partyX) * walkSpeed;
        const partyX = this._expVisState.partyX;

        const party = activeExp.partySnapshot || [];
        const skinMgr = this.game.skinManager;
        const useSkins = skinMgr && skinMgr.isActive;
        for (let i = 0; i < party.length; i++) {
            const p = party[i];
            const py = H / 2 + (i - party.length / 2) * 16 + 6;
            const px = partyX + (py - H / 2) * diagSlope;
            const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
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
                if (sprite) {
                    ctx.drawImage(sprite, px - 7, py - 7, 14, 14);
                } else {
                    ctx.font = 'bold 14px monospace';
                    ctx.fillStyle = '#ccc';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('@', px, py);
                }
            } else {
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (hpPct < 0.3) {
                    ctx.fillStyle = '#ff4444';
                } else if (hpPct < 0.6) {
                    ctx.fillStyle = '#ffaa44';
                } else {
                    ctx.fillStyle = '#44ff44';
                }
                ctx.fillText(p.golem ? 'G' : '@', px, py);
            }
            ctx.globalAlpha = 1;
            if (p.hp > 0) {
                const barW = 12, barH = 2;
                const barX = px - barW / 2;
                const barY = py - 11;
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
                const pay = H / 2 + (i - activeExp.packAnimals.length / 2) * 16;
                const pax = partyX - 24 + (pay - H / 2) * diagSlope;
                const animalDef = ANIMALS[pa.type];
                if (useSkins) {
                    const sprite = skinMgr.getSprite('entities', pa.type);
                    if (sprite) {
                        ctx.drawImage(sprite, pax - 6, pay - 6, 12, 12);
                    } else {
                        ctx.font = 'bold 12px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = animalDef?.color || '#bbaa44';
                        ctx.fillText(animalDef?.char || 'a', pax, pay);
                    }
                } else {
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = animalDef?.color || '#bbaa44';
                    ctx.fillText(animalDef?.char || 'a', pax, pay);
                }
            }
        }

        const activeSummons = (activeExp.summons || []).filter(s => s.hp > 0);
        for (let si = 0; si < activeSummons.length; si++) {
            const summon = activeSummons[si];
            const ownerIdx = party.findIndex(p => p.id === summon.ownerId);
            const oy = ownerIdx >= 0 ? H / 2 + (ownerIdx - party.length / 2) * 16 + 6 : H / 2 + si * 14;
            const sy = oy;
            const sx = partyX + 22 + (sy - H / 2) * diagSlope;
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005 + si) * 0.15;
            ctx.strokeStyle = summon.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            if (useSkins) {
                const sumSprite = skinMgr.getSprite('entities', summon.type);
                if (sumSprite) {
                    ctx.drawImage(sumSprite, sx - 5, sy - 5, 10, 10);
                } else {
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = summon.color;
                    ctx.fillText(summon.char, sx, sy);
                }
            } else {
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = summon.color;
                ctx.fillText(summon.char, sx, sy);
            }
            const sHpPct = summon.hp / summon.maxHp;
            const sBarW = 8, sBarH = 2;
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - sBarW / 2, sy - 9, sBarW, sBarH);
            ctx.fillStyle = sHpPct > 0.6 ? '#44ff44' : sHpPct > 0.3 ? '#ffaa44' : '#ff4444';
            ctx.fillRect(sx - sBarW / 2, sy - 9, sBarW * sHpPct, sBarH);
            if (summon.maxDuration) {
                const dPct = summon.ticksRemaining / summon.maxDuration;
                ctx.fillStyle = '#222';
                ctx.fillRect(sx - sBarW / 2, sy - 6, sBarW, sBarH);
                ctx.fillStyle = '#ddcc44';
                ctx.fillRect(sx - sBarW / 2, sy - 6, sBarW * dPct, sBarH);
            }
        }

        if (activeExp.combat) {
            const enemies = activeExp.combat.enemies.filter(e => e.hp > 0);
            const enemySpriteKey = realmDef?.enemies?.sprite;
            const enemySprite = useSkins && enemySpriteKey ? skinMgr.getSprite('entities', enemySpriteKey) : null;
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                const ey = H / 2 + (i - enemies.length / 2) * 16;
                const ex = partyX + 60 + (ey - H / 2) * diagSlope;
                if (enemySprite) {
                    ctx.drawImage(enemySprite, ex - 7, ey - 7, 14, 14);
                } else {
                    ctx.beginPath();
                    ctx.moveTo(ex, ey - 7);
                    ctx.lineTo(ex - 6, ey + 5);
                    ctx.lineTo(ex + 6, ey + 5);
                    ctx.closePath();
                    ctx.fillStyle = '#ff3333';
                    ctx.fill();
                    ctx.strokeStyle = '#aa0000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                if (enemy.maxHp) {
                    const eHpPct = enemy.hp / enemy.maxHp;
                    const eBarW = 10, eBarH = 2;
                    ctx.fillStyle = '#222';
                    ctx.fillRect(ex - eBarW / 2, ey - 11, eBarW, eBarH);
                    ctx.fillStyle = eHpPct > 0.6 ? '#ff6666' : eHpPct > 0.3 ? '#ff4444' : '#cc2222';
                    ctx.fillRect(ex - eBarW / 2, ey - 11, eBarW * eHpPct, eBarH);
                }
            }

            if (Math.random() < 0.3) {
                this._expVisState.effects.push({
                    type: 'slash',
                    x: partyX + 30 + Math.random() * 40,
                    y: H / 2 - 10 + Math.random() * 20,
                    frame: 0, maxFrames: 15
                });
            }
        }

        const logLen = activeExp.log.length;
        if (logLen > this._expVisState.lastLogLen) {
            const newEntries = activeExp.log.slice(this._expVisState.lastLogLen);
            for (const entry of newEntries) {
                const text = entry.text || '';
                const isCast = text.includes('casts');
                if (isCast && text.includes('heals')) {
                    this._expVisState.effects.push({ type: 'spell_heal', x: partyX + Math.random() * 20, y: H / 2 - 5 + Math.random() * 10, frame: 0, maxFrames: 30 });
                    const healMatch = text.match(/(\d+) HP/);
                    if (healMatch) this._expVisState.effects.push({ type: 'damage_number', text: healMatch[1], color: '#44ff44', x: partyX + Math.random() * 20, y: H / 2 - 5, frame: 0, maxFrames: 25 });
                } else if (isCast && text.includes('shielded')) {
                    this._expVisState.effects.push({ type: 'spell_shield', x: partyX + Math.random() * 20, y: H / 2, frame: 0, maxFrames: 35 });
                } else if (isCast && (text.includes('damage') || text.includes('Hits'))) {
                    const school = this._detectSpellSchool(text);
                    this._expVisState.effects.push({ type: 'spell_attack', school, x: partyX + 20, y: H / 2 - 10 + Math.random() * 20, frame: 0, maxFrames: 25 });
                    const dmgMatch = text.match(/for (\d+)/);
                    if (dmgMatch) this._expVisState.effects.push({ type: 'damage_number', text: dmgMatch[1], color: '#ffff44', x: partyX + 50 + Math.random() * 20, y: H / 2 - 10 + Math.random() * 15, frame: 0, maxFrames: 25 });
                } else if (text.includes('summons a')) {
                    this._expVisState.effects.push({ type: 'spell_summon', x: partyX + 25, y: H / 2, frame: 0, maxFrames: 40 });
                } else if (entry.type === 'loot' || entry.type === 'success') {
                    this._expVisState.effects.push({ type: 'loot', x: partyX + Math.random() * 20, y: H / 2 - 20 + Math.random() * 10, frame: 0, maxFrames: 40 });
                } else if (entry.type === 'danger') {
                    this._expVisState.effects.push({ type: 'danger', x: partyX - 5 + Math.random() * 30, y: H / 2, frame: 0, maxFrames: 20 });
                    this._expVisState.shakeFrames = 6;
                    this._expVisState.flashFrames = 3;
                } else if (entry.type === 'combat' && text.includes('for ')) {
                    const dmgMatch = text.match(/for (\d+)/);
                    if (dmgMatch) {
                        const isEnemyAttacking = text.startsWith('An enemy');
                        const numColor = isEnemyAttacking ? '#ff6644' : '#ffff44';
                        const numX = isEnemyAttacking ? (partyX + Math.random() * 20) : (partyX + 45 + Math.random() * 25);
                        this._expVisState.effects.push({ type: 'damage_number', text: dmgMatch[1], color: numColor, x: numX, y: H / 2 - 5 + Math.random() * 15, frame: 0, maxFrames: 25 });
                        if (isEnemyAttacking) this._expVisState.shakeFrames = Math.max(this._expVisState.shakeFrames, 3);
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
                ctx.strokeStyle = '#ffff44';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(eff.x - 6, eff.y - 4);
                ctx.lineTo(eff.x + 6, eff.y + 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(eff.x + 4, eff.y - 5);
                ctx.lineTo(eff.x - 4, eff.y + 5);
                ctx.stroke();
            } else if (eff.type === 'loot') {
                ctx.fillStyle = '#ffcc44';
                ctx.beginPath();
                const dy = -eff.frame * 0.5;
                ctx.moveTo(eff.x, eff.y + dy - 6);
                ctx.lineTo(eff.x - 5, eff.y + dy);
                ctx.lineTo(eff.x, eff.y + dy + 6);
                ctx.lineTo(eff.x + 5, eff.y + dy);
                ctx.closePath();
                ctx.fill();
            } else if (eff.type === 'danger') {
                ctx.fillStyle = '#ff2222';
                ctx.globalAlpha = alpha * 0.4;
                ctx.fillRect(eff.x - 15, eff.y - 15, 30, 30);
            } else if (eff.type === 'spell_heal') {
                ctx.fillStyle = '#44ff44';
                ctx.font = 'bold 14px monospace';
                ctx.fillText('+', eff.x, eff.y - eff.frame * 0.8);
                for (let s = 0; s < 3; s++) {
                    ctx.globalAlpha = alpha * 0.5;
                    ctx.fillRect(eff.x - 4 + Math.sin(eff.frame * 0.3 + s * 2) * 6, eff.y - eff.frame * 0.6 - s * 3, 2, 2);
                }
            } else if (eff.type === 'spell_shield') {
                ctx.strokeStyle = '#4488ff';
                ctx.lineWidth = 2;
                const r = 8 + eff.frame * 0.3;
                ctx.beginPath();
                ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(eff.x, eff.y, r * 0.7, Math.PI * 0.2, Math.PI * 0.8);
                ctx.stroke();
            } else if (eff.type === 'spell_attack') {
                if (eff.school === 'evocation') {
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
                const progress = eff.frame / eff.maxFrames;
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
            } else if (eff.type === 'damage_number') {
                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = eff.color;
                ctx.textAlign = 'center';
                ctx.fillText(eff.text, eff.x, eff.y - eff.frame * 0.7);
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

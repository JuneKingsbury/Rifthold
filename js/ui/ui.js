import { CONFIG, COLONIST_CONFIG, MAGIC_STUDY_CONFIG, TRAITS, BUILDINGS, BUILD_CATEGORIES, TILE_CHARS, TILE_COLORS, ANIMALS, TAMED_ANIMALS, WAVE_CONFIG, RECIPE_CATEGORIES, WEAPONS, ARMORS, HELMETS, CLOTHES, BOOTS, TOOLS, TRINKETS, POTIONS, SKILLS, MAGIC_SKILLS, SPELL_TOMES, SPELLS, FOODSTUFFS, WORK_CONFIG, GOLEM_TYPES, TRADE_VALUES, ALL_ITEMS, COMPLEX_STRUCTURES, EVENTS, STORY_MILESTONES, RENDER_CONFIG, LOG_COLORS, CROPS, ENTITIES, EXPEDITION_ENEMIES, NPC_ENCOUNTERS, STAT_META, formatStatValue, getItemStatLines, getNestedEffectLines, RELATIONSHIP_TIERS, RAID_TYPES, REALMS, ENCHANT_COST_BY_TIER } from '../core/config.js';
import { getRelationshipTier } from '../systems/social-utils.js';
import { getTradeRates, computeTradeValues } from '../systems/events.js';
import { getItemTradeValue } from '../entities/item-roll.js';
import { getComplexStructureAt, getSpellCooldownMult } from '../systems/complexBuildings.js';
import { getTameChance } from '../entities/taming.js';
import { getAvailableRecipes } from '../systems/crafting.js';
import { getMaxCountBonus } from '../systems/building.js';
import { getTargetPriority, getThreatDisplayHtml, countByKey } from './ui-utils.js';
import { CROP_RESEARCH_REQS } from '../systems/farming.js';
import { getPedestalEffect } from '../systems/artifacts.js';
import { getEquippedItems, getEquipmentStat } from '../entities/colonist.js';
import { getRoleInfoHtml, getEffectInfoHtml } from '../entities/roles.js';
import { keybindingRowsHtml, beginRebindCapture, formatKeyLabel } from './keybindings-ui.js';
import { installArcanePanel } from './ui-arcane.js';
import { installResearchPanel } from './ui-research.js';
import { installTutorialPanel } from './ui-tutorial.js';

const WEATHER_ICONS = { clear: '☀', rain: '☔', thunderstorm: '⛈', snow: '❄', blizzard: '❅', heatwave: '♨' };

// Skill/magic XP tooltip text, shared by the colonist tooltip refresh and the
// colonist info panel so both show identical "XP: x/y (z%)" (or "(MAX)") text.
function skillXpTip(def, level, xp) {
    const maxXp = COLONIST_CONFIG.skillXpToLevel + level * COLONIST_CONFIG.skillXpScalePerLevel;
    const pct = Math.floor((xp / maxXp) * 100);
    return level >= COLONIST_CONFIG.skillMaxLevel
        ? `${def.description} (MAX)`
        : `${def.description} — XP: ${xp}/${maxXp} (${pct}%)`;
}

// Magic XP is stored as an accumulator scaled to /100 (max level hardcoded at 10).
function magicXpTip(def, level, acc) {
    const maxXp = MAGIC_STUDY_CONFIG.magicXpToLevel + level * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    const pct = Math.floor((acc / maxXp) * 100);
    return level >= 10
        ? `${def.description} (MAX)`
        : `${def.description} — XP: ${pct}/100 (${pct}%)`;
}

export class UI {
    constructor(game) {
        this.game = game;
        this.priorityPanelVisible = false;
        this.craftPanelVisible = false;
        this.researchPanelVisible = false;
        this.inventoryVisible = false;
        this._invTab = 'resources';
        this._researchTab = 'foundations';
        this.settingsPanelVisible = false;
        this.arcanePanelVisible = false;
        this._arcaneTab = 'nexus';
        this._arcaneExpSetup = null;
        this._lastArcaneHtml = '';
        this._expVisState = { lastLogLen: 0, effects: [], partyX: 0, ambientParticles: [], shakeFrames: 0, flashFrames: 0 };
        this.storyPanelVisible = false;
        this._storyTab = 'colony';
        this._collapsedRealmGroups = new Set();
        this._collapsedBestiarySections = new Set();
        this._lastStoryHtml = '';
        this._lastStoryHasNew = false;
        this._lastResearchNeedsAttention = false;
        this.elements = {};
        this.initElements();
    }

    initElements() {
        this.elements.statusBar = document.getElementById('status-bar');
        document.getElementById('btn-cycle-back').addEventListener('click', () => this.game.cycleColonist(-1));
        document.getElementById('btn-cycle-forward').addEventListener('click', () => this.game.cycleColonist(1));
        document.getElementById('btn-zoom-in').addEventListener('click', () => window.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => window.zoomOut());
        document.getElementById('btn-pause').addEventListener('click', () => { if (!this.game.paused) this.game.togglePause(); });
        document.getElementById('btn-speed-1').addEventListener('click', () => this.game.setSpeed(1));
        document.getElementById('btn-speed-2').addEventListener('click', () => this.game.setSpeed(2));
        document.getElementById('btn-speed-3').addEventListener('click', () => this.game.setSpeed(3));
        document.getElementById('btn-settings').addEventListener('click', () => this.game.toggleSettingsPanel());
        this.elements.infoPanel = document.getElementById('info-content');
        this.elements.infoPanel.addEventListener('mouseleave', () => {
            if (this._pendingColonistInfoHtml) {
                this.elements.infoPanel.innerHTML = this._pendingColonistInfoHtml;
                this._pendingColonistInfoHtml = null;
            }
        });
        this.elements.modeBar = document.getElementById('mode-bar');
        this.elements.buildPanel = document.getElementById('build-panel');
        this.elements.notifications = document.getElementById('notifications');
        this.elements.priorityPanel = document.getElementById('priority-panel');
        this.elements.craftPanel = document.getElementById('craft-panel');
        this.elements.eventPanel = document.getElementById('event-panel');
        this.elements.colonistHud = document.getElementById('colonist-hud');
        this._colonistHudHovered = false;
        this.elements.colonistHud.addEventListener('mouseenter', () => { this._colonistHudHovered = true; });
        this.elements.colonistHud.addEventListener('mouseleave', () => {
            this._colonistHudHovered = false;
            if (this._pendingHudHtml) {
                this.elements.colonistHud.innerHTML = this._pendingHudHtml;
                this._pendingHudHtml = null;
            }
        });
        this.elements.researchPanel = document.getElementById('research-panel');
        this.elements.eventLog = document.getElementById('event-log');
        this.elements.inventoryPanel = document.getElementById('inventory-panel');
        this.elements.settingsPanel = document.getElementById('settings-panel');
        this.elements.arcanePanel = document.getElementById('arcane-panel');
        this.elements.storyPanel = document.getElementById('story-panel');

        this.initTutorialNote();

        this.elements.storyPanel.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-story-tab]');
            if (tab) {
                this._storyTab = tab.dataset.storyTab;
                this._lastStoryHtml = '';
                this.updateStoryPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const group = e.target.closest('[data-realm-group]');
            if (group) {
                const name = group.dataset.realmGroup;
                const wasCollapsed = this._collapsedRealmGroups.has(name);
                if (wasCollapsed) {
                    this._collapsedRealmGroups.delete(name);
                } else {
                    this._collapsedRealmGroups.add(name);
                }
                this._lastStoryHtml = '';
                this.updateStoryPanel();
                window.soundManager?.playSFXPitched('button_click', wasCollapsed ? 3 : -3);
            }
            const bSection = e.target.closest('[data-bestiary-section]');
            if (bSection) {
                const name = bSection.dataset.bestiarySection;
                const wasCollapsed = this._collapsedBestiarySections.has(name);
                if (wasCollapsed) {
                    this._collapsedBestiarySections.delete(name);
                } else {
                    this._collapsedBestiarySections.add(name);
                }
                this._lastStoryHtml = '';
                this.updateStoryPanel();
                window.soundManager?.playSFXPitched('button_click', wasCollapsed ? 3 : -3);
            }
        });

        this.elements.arcanePanel.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-arcane-tab]');
            if (tab) {
                this._arcaneTab = tab.dataset.arcaneTab;
                this._arcaneExpSetup = null;
                this._lastArcaneHtml = '';
                this.updateArcanePanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            if (e.target.closest('button')) {
                window.soundManager?.playSFXPitched('button_click', 0);
            }
        });

        this.elements.craftPanel.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-craft-tab]');
            if (tab) {
                this._craftTab = tab.dataset.craftTab;
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const tierBtn = e.target.closest('[data-craft-tier]');
            if (tierBtn) {
                if (!this._craftHiddenTiers) this._craftHiddenTiers = new Set();
                const t = parseInt(tierBtn.dataset.craftTier);
                if (this._craftHiddenTiers.has(t)) this._craftHiddenTiers.delete(t);
                else this._craftHiddenTiers.add(t);
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                return;
            }
            const tomeLvBtn = e.target.closest('[data-craft-tome-level]');
            if (tomeLvBtn) {
                if (!this._tomeHiddenLevels) this._tomeHiddenLevels = new Set();
                const lv = parseInt(tomeLvBtn.dataset.craftTomeLevel);
                if (this._tomeHiddenLevels.has(lv)) this._tomeHiddenLevels.delete(lv);
                else this._tomeHiddenLevels.add(lv);
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                return;
            }
        });

        this.elements.researchPanel.addEventListener('click', (e) => {
            const toggle = e.target.closest('[data-research-hide-toggle]');
            if (toggle) {
                this._researchHideCompleted = !this._researchHideCompleted;
                this._lastResearchHtml = null;
                this.updateResearchPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const tab = e.target.closest('[data-research-tab]');
            if (tab) {
                this._researchTab = tab.dataset.researchTab;
                this._lastResearchHtml = null;
                this.updateResearchPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const badge = e.target.closest('.research-cross-tab[data-jump-tab]');
            if (badge) {
                this._researchTab = badge.dataset.jumpTab;
                this._lastResearchHtml = null;
                this.updateResearchPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
            }
        });

        this.elements.colonistHud.addEventListener('click', (e) => {
            const row = e.target.closest('[data-colonist-id]');
            if (row) {
                this.game.selectColonistById(parseInt(row.dataset.colonistId));
            }
        });

        this.elements.eventLog.addEventListener('click', (e) => {
            const row = e.target.closest('[data-entity]');
            if (row) {
                const data = JSON.parse(row.dataset.entity);
                this.game.jumpToEntity(data.type, data.type === 'colonist' ? data.id : data);
            }
        });

        this.elements.modeBar.addEventListener('click', (e) => {
            const catOpt = e.target.closest('[data-build-cat]');
            if (catOpt) {
                this.game.input.setBuildCategory(catOpt.dataset.buildCat);
                return;
            }
            const cropOpt = e.target.closest('[data-crop-opt]');
            if (cropOpt) {
                this.game.input.cropType = cropOpt.dataset.cropOpt;
                this.updateModeDisplay(this.game.input);
                return;
            }
            const modeOpt = e.target.closest('[data-mode-action]');
            if (modeOpt) {
                const action = modeOpt.dataset.modeAction;
                switch (action) {
                    case 'back': this.game.input.setMode('normal'); break;
                    case 'build': this.game.input.setMode('build'); break;
                    case 'zone': this.game.input.setMode('zone'); break;
                    case 'gather': this.game.input.setMode('designate'); break;
                    case 'deconstruct': this.game.input.toggleDeconstructMode(); break;
                    case 'priority': this.togglePriorityPanel(); break;
                    case 'craft': this.toggleCraftPanel(); break;
                    case 'research': this.toggleResearchPanel(); break;
                    case 'inventory': this.toggleInventoryPanel(); break;
                    case 'settings': this.toggleSettingsPanel(); break;
                    case 'arcane': this.toggleArcanePanel(); break;
                    case 'story': this.toggleStoryPanel(); break;
                }
                return;
            }
            const desOpt = e.target.closest('[data-designate-mode]');
            if (desOpt) {
                this.game.input.designateMode = desOpt.dataset.designateMode;
                this.updateModeDisplay(this.game.input);
            }
        });

        this._buildTooltip = document.createElement('div');
        this._buildTooltip.id = 'build-tooltip';
        this._buildTooltip.style.display = 'none';
        document.body.appendChild(this._buildTooltip);
        this._buildTooltipTarget = null;

        const buildOptClick = (e) => {
            const closeBtn = e.target.closest('[data-mode-action="back"]');
            if (closeBtn) {
                this.game.input.setMode('normal');
                return;
            }
            const catTab = e.target.closest('[data-build-cat]');
            if (catTab) {
                this.game.input.setBuildCategory(catTab.dataset.buildCat);
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const cropOpt = e.target.closest('[data-crop-opt]');
            if (cropOpt) {
                this.game.input.cropType = cropOpt.dataset.cropOpt;
                this.updateModeDisplay(this.game.input);
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const desOpt = e.target.closest('[data-designate-mode]');
            if (desOpt) {
                this.game.input.designateMode = desOpt.dataset.designateMode;
                this.updateModeDisplay(this.game.input);
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const opt = e.target.closest('[data-build-opt]');
            if (!opt) return;
            const buildType = opt.dataset.buildOpt;
            if ('ontouchstart' in window && this._buildTooltipTarget !== buildType) {
                this._buildTooltipTarget = buildType;
                this._showBuildTooltip(opt);
                return;
            }
            this._buildTooltipTarget = null;
            this._hideBuildTooltip();
            this.game.input.buildType = buildType;
            this.updateModeDisplay(this.game.input);
            window.soundManager?.playSFXPitched('button_click', 0);
        };
        const buildOptHover = (e) => {
            const card = e.target.closest('[data-build-opt]');
            if (!card) { this._hideBuildTooltip(); return; }
            this._showBuildTooltip(card, e);
        };
        const buildOptOut = (e) => {
            if (!e.target.closest('[data-build-opt]')) return;
            const related = e.relatedTarget;
            if (related && related.closest && related.closest('[data-build-opt]') === e.target.closest('[data-build-opt]')) return;
            this._hideBuildTooltip();
        };
        const buildOptMove = (e) => {
            if (this._buildTooltip.style.display === 'none') return;
            this._positionBuildTooltip(e);
        };

        this.elements.buildPanel.addEventListener('click', buildOptClick);
        this.elements.buildPanel.addEventListener('mouseover', buildOptHover);
        this.elements.buildPanel.addEventListener('mouseout', buildOptOut);
        this.elements.buildPanel.addEventListener('mousemove', buildOptMove);

        this.elements.modeBar.addEventListener('mouseover', buildOptHover);
        this.elements.modeBar.addEventListener('mouseout', buildOptOut);
        this.elements.modeBar.addEventListener('mousemove', buildOptMove);

        this.elements.priorityPanel.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[data-prio-tab]');
            if (tabBtn) {
                this._prioTab = tabBtn.dataset.prioTab;
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const attuneCell = e.target.closest('[data-colonist-id][data-attune]');
            if (attuneCell) {
                const colonistId = parseInt(attuneCell.dataset.colonistId);
                this.game.toggleAttunement(colonistId, attuneCell.dataset.attune);
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                // sound fired inside toggleAttunement with pitch based on add/remove
                return;
            }
            const cell = e.target.closest('[data-colonist-id][data-skill]');
            if (cell) {
                const colonistId = parseInt(cell.dataset.colonistId);
                const skill = cell.dataset.skill;
                this.game.cyclePriority(colonistId, skill);
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                // sound fired inside cyclePriority with pitch based on new value
            }
        });

        this.elements.priorityPanel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const cell = e.target.closest('[data-colonist-id][data-skill]');
            if (cell) {
                const colonistId = parseInt(cell.dataset.colonistId);
                const skill = cell.dataset.skill;
                this.game.cycleBackPriority(colonistId, skill);
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                // sound fired inside cycleBackPriority with pitch based on new value
            }
        });

        this.elements.inventoryPanel.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[data-inv-tab]');
            if (tabBtn) {
                this._invTab = tabBtn.dataset.invTab;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                window.soundManager?.playSFXPitched('button_click', 0);
                return;
            }
            const btn = e.target.closest('[data-reserve-food]');
            if (btn) {
                const food = btn.dataset.reserveFood;
                const res = this.game.resources.reservedFoodstuffs;
                res[food] = !res[food];
                this.updateInventoryPanel();
            }
        });

        document.addEventListener('mousedown', (e) => {
            const closeBtn = e.target.closest('[data-panel-close]');
            if (!closeBtn) return;
            e.preventDefault();
            const panel = closeBtn.dataset.panelClose;
            switch (panel) {
                case 'priority': this.togglePriorityPanel(); break;
                case 'craft': this.toggleCraftPanel(); break;
                case 'research': this.toggleResearchPanel(); break;
                case 'inventory': this.toggleInventoryPanel(); break;
                case 'settings': this.toggleSettingsPanel(); break;
                case 'arcane': this.toggleArcanePanel(); break;
                case 'story': this.toggleStoryPanel(); break;
            }
        });

        const uiTooltip = document.getElementById('ui-tooltip');
        document.addEventListener('mouseover', (e) => {
            const tip = e.target.closest('.skill-tip[data-tip]');
            if (!tip) return;
            uiTooltip.textContent = tip.dataset.tip;
            uiTooltip.style.opacity = '1';
            const rect = tip.getBoundingClientRect();
            let left = rect.left + rect.width / 2 - uiTooltip.offsetWidth / 2;
            let top = rect.top - uiTooltip.offsetHeight - 6;
            if (top < 4) top = rect.bottom + 6;
            if (left < 4) left = 4;
            if (left + uiTooltip.offsetWidth > window.innerWidth - 4) {
                left = window.innerWidth - uiTooltip.offsetWidth - 4;
            }
            uiTooltip.style.left = left + 'px';
            uiTooltip.style.top = top + 'px';
        });
        document.addEventListener('mouseout', (e) => {
            const tip = e.target.closest('.skill-tip[data-tip]');
            if (!tip) return;
            const related = e.relatedTarget;
            if (related && related.closest && related.closest('.skill-tip[data-tip]')) return;
            uiTooltip.style.opacity = '0';
        });
    }

    update(skipArcane) {
        this.updateStatusBar();
        this.updateNotifications();
        this.updateEventPanel();
        if (this.priorityPanelVisible) this.updatePriorityPanel();
        if (this.craftPanelVisible) this.updateCraftPanel();
        if (this.researchPanelVisible) this.updateResearchPanel();
        this.updateColonistHud();
        this.updateEventLog();
        if (this.inventoryVisible) this.updateInventoryPanel();
        if (this.arcanePanelVisible && !skipArcane) this.updateArcanePanel();
        if (this.storyPanelVisible) this.updateStoryPanel();
        if (this._viewingRiftGate) this._refreshRiftGateInfo();
        if (this._viewingColonistId != null) this._refreshColonistInfo();
        const hasNew = this.game.story.hasUnviewed();
        const researchNeedsAtt = !this.game.research.activeResearch && this.game.research.hasAvailableResearch();
        const currentManaCrystalBonus = this.game.manaCrystalBonus || 0;
        const expPending = !!this.game.exploration?.expeditions?.some(e => e.pendingDecision);
        const modeBarChanged = hasNew !== this._lastStoryHasNew || researchNeedsAtt !== this._lastResearchNeedsAttention || currentManaCrystalBonus !== this._lastManaCrystalBonus || expPending !== this._lastExpPending;
        if (modeBarChanged) {
            this._lastStoryHasNew = hasNew;
            this._lastResearchNeedsAttention = researchNeedsAtt;
            this._lastManaCrystalBonus = currentManaCrystalBonus;
            this._lastExpPending = expPending;
            this.updateModeDisplay(this.game.input);
        }
    }

    forceStatusBarRefresh() {
        this._lastStatusTick = -1;
        this.updateStatusBar();
    }

    updateStatusBar() {
        const tickChanged = this.game.tick !== this._lastStatusTick || this._lastStatusPaused !== this.game.paused || this._lastStatusSpeed !== this.game.speed;
        if (!tickChanged) {
            this._updateSpeedButtons();
            return;
        }
        this._lastStatusTick = this.game.tick;
        this._lastStatusPaused = this.game.paused;
        this._lastStatusSpeed = this.game.speed;
        const r = this.game.resources.stockpile;
        const season = this.game.weather.getSeasonDisplay();
        const weather = this.game.weather.getWeatherDisplay();
        const tempC = Math.round(this.game.weather.temperature);
        const useF = this.game.settings.temperatureUnit === 'F';
        const temp = useF ? Math.round(tempC * 9 / 5 + 32) : tempC;
        const tempUnit = useF ? 'F' : 'C';
        const speed = this.game.paused ? 'PAUSED' : `${this.game.speed}x`;
        let alive = 0, aliveGolemCount = 0, moodSum = 0;
        for (const c of this.game.colonists) {
            if (c.hp > 0) {
                if (c.golem) { aliveGolemCount++; }
                else { alive++; moodSum += c.mood; }
            }
        }
        const avgMood = alive > 0 ? Math.round(moodSum / alive) : 0;
        const dayProgress = Math.floor((this.game.timeOfDay / CONFIG.TICKS_PER_DAY) * 24);
        const timeStr = `${String(dayProgress).padStart(2, '0')}:00`;
        const power = this.game.power;
        let manaStr = '';
        if (power.totalGenerated > 0) {
            const crystalCount = this.game.mapIndex.getStructurePositions('mana_crystal').size;
            const reservoirBonus = this.game.research.isResearched('mana_reservoir') ? 3 : 0;
            const crystalMax = 4 + (this.game.manaCrystalBonus || 0) + reservoirBonus;
            manaStr = `Mana:${power.getNetPower()} (${crystalCount}/${crystalMax})`;
        }
        const pendingTasks = this.game.taskQueue.getPendingCount();

        const waves = this.game.waves;
        const cap = waves.getColonistCap(this.game);
        const voidEssence = r.void_essence || 0;
        const waveStr = waves.active ? `Wave:${waves.currentWave}` : '';

        const alerts = CONFIG.STOCKPILE_ALERTS || {};
        const resStyle = (key, val) => (alerts[key] && val <= alerts[key]) ? ' style="color:#ff4444;font-weight:bold"' : '';
        const mgr = this.game.skinManager;
        const hasSkin = mgr && mgr.isActive;
        const RES_ABBR = { wood: 'W', stone: 'S', food: 'F', planks: 'P', bricks: 'Bk', iron_ore: 'Or', iron: 'Fe', runite: 'Ru', leather: 'Le', wool: 'Wl', void_essence: 'V', gold: 'Au' };
        const resIcon = (key, label, color) => {
            if (hasSkin) {
                const url = mgr.getItemSpriteDataURL(key);
                if (url) return `<img src="${url}" style="width:12px;height:12px;vertical-align:middle;image-rendering:pixelated;margin-right:1px;" title="${label}">`;
            }
            return `<span style="color:${color};font-weight:bold;margin-right:1px;" title="${label}">${RES_ABBR[key] || label.slice(0, 2)}</span>`;
        };
        const coreResources = [
            { key: 'gold', label: 'Gold', color: '#ffdd00' },
            { key: 'wood', label: 'Wood', color: '#8b6b3a', always: true },
            { key: 'stone', label: 'Stone', color: '#999', always: true },
            { key: 'food', label: 'Food', color: '#88cc44', always: true },
            { key: 'iron', label: 'Iron', color: '#aaa' },
            { key: 'runite', label: 'Runite', color: '#44ccff' },
            { key: 'void_essence', label: 'Void', color: '#9933ff' },
        ];
        let resHtml = '';
        for (const res of coreResources) {
            const raw = r[res.key] || 0;
            const val = res.key === 'gold' ? (raw % 1 !== 0 ? raw.toFixed(1) : raw) : Math.round(raw);
            if (!res.always && raw === 0) continue;
            const alertAttr = resStyle(res.key, raw);
            resHtml += `<span class="res"${alertAttr}>${resIcon(res.key, res.label, res.color)}${val}</span>`;
        }
        const html = resHtml +
            (manaStr ? `<span class="res" style="color:${power.hasPower() ? '#aa44ff' : '#ff6666'}">${manaStr}</span>` : '') +
            `<span class="sep">|</span>` +
            `<span class="info">${season}</span>` +
            `<span class="info status-extra">${this._getWeatherIcon()} ${weather} ${temp}°${tempUnit}</span>` +
            `<span class="info">${timeStr}</span>` +
            `<span class="sep status-extra">|</span>` +
            `<span class="info status-extra">Pop:${alive}/${cap}</span>` +
            (aliveGolemCount > 0 ? `<span class="info status-extra" style="color:#aaaaaa">Golems:${aliveGolemCount}</span>` : '') +
            `<span class="info status-extra">Mood:${avgMood}%</span>` +
            (waveStr ? `<span class="info" style="color:#cc00ff">${waveStr}</span>` : '') +
            (pendingTasks > 0 ? `<span class="info status-extra" style="color:#ccaa44">Tasks:${pendingTasks}</span>` : '') +
            (CONFIG.PEACEFUL_MODE ? `<span class="peaceful">PEACEFUL</span>` : '') +
            (this.game.settings.demoMode ? `<span class="demo-mode">DEMO</span>` : '');

        if (html !== this._lastStatusHtml) {
            this._lastStatusHtml = html;
            document.getElementById('status-info').innerHTML = html;
        }
        this._updateSpeedButtons();
    }

    _updateSpeedButtons() {
        const speedButtons = [
            { id: 'btn-pause', active: this.game.paused },
            { id: 'btn-speed-1', active: !this.game.paused && this.game.speed === 1 },
            { id: 'btn-speed-2', active: !this.game.paused && this.game.speed === 2 },
            { id: 'btn-speed-3', active: !this.game.paused && this.game.speed === 3 },
        ];
        for (const { id, active } of speedButtons) {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('speed-active', active);
        }
    }

    _getWeatherIcon() {
        const weatherType = this.game.weather.currentWeather;
        const sm = this.game.renderer.skinManager;
        if (sm.isActive) {
            const sprite = sm.getSprite('icons', weatherType);
            if (sprite) {
                if (!this._weatherIconCache) this._weatherIconCache = new Map();
                if (this._weatherIconCacheSkin !== sm.activeSkin) {
                    this._weatherIconCache.clear();
                    this._weatherIconCacheSkin = sm.activeSkin;
                }
                let url = this._weatherIconCache.get(weatherType);
                if (!url) {
                    const c = document.createElement('canvas');
                    c.width = sprite.width || sprite.naturalWidth || 16;
                    c.height = sprite.height || sprite.naturalHeight || 16;
                    c.getContext('2d').drawImage(sprite, 0, 0);
                    url = c.toDataURL('image/png');
                    this._weatherIconCache.set(weatherType, url);
                }
                return `<img src="${url}" style="width:12px;height:12px;vertical-align:middle;margin-right:2px">`;
            }
        }
        return WEATHER_ICONS[weatherType] || '';
    }

    updateModeDisplay(input) {
        this._buildTooltipTarget = null;
        this._hideBuildTooltip();
        if (input.spellTargeting) {
            const { spell } = input.spellTargeting;
            let html = `<span class="mode-label" style="color:#bb88ff">SPELL TARGET: ${spell.name}</span>`;
            html += `<span class="mode-hint" style="color:#aa88ff">Click target tile (range: ${spell.range || '∞'}) | [Esc] Cancel</span>`;
            this.elements.modeBar.innerHTML = html;
            return;
        }
        if (input.guardPointTargeting) {
            const colonist = this.game.getColonist(input.guardPointTargeting.colonistId);
            let html = `<span class="mode-label" style="color:#88ff88">SET GUARD POINT: ${colonist.name}</span>`;
            html += `<span class="mode-hint" style="color:#66ff66">Click passable tile to set guard point | [Esc] Cancel</span>`;
            this.elements.modeBar.innerHTML = html;
            return;
        }
        let html = `<span class="mode-label">Mode: ${input.mode.toUpperCase()}</span>`;
        if (input.mode === 'build') {
            html += '<span class="mode-opt mode-back" data-mode-action="back">[Esc]Back</span>';
            const deconActive = input.deconstructMode ? ' active' : '';
            html += `<span class="mode-opt${deconActive}" data-mode-action="deconstruct" style="margin-left:8px;color:#ff6666">[X]Deconstruct</span>`;
            html += '<span class="mode-hint">[Tab]Cycle category | Right-click to deconstruct</span>';
            this._updateBuildPanel(input);
        } else if (input.mode === 'zone') {
            html += '<span class="mode-opt mode-back" data-mode-action="back">[Esc]Back</span>';
            html += '<span class="mode-hint">Click+drag to designate farm area</span>';
            this._updateFarmPanel(input);
        } else if (input.mode === 'designate') {
            html += '<span class="mode-opt mode-back" data-mode-action="back">[Esc]Back</span>';
            html += '<span class="mode-hint">Click+drag to select area</span>';
            this._updateGatherPanel(input);
        } else {
            html += '<span class="mode-options">';
            html += `<span class="mode-opt" data-mode-action="build">[B]Build</span>`;
            html += `<span class="mode-opt" data-mode-action="zone">[F]Farm</span>`;
            html += `<span class="mode-opt" data-mode-action="gather">[G]Gather</span>`;
            html += `<span class="mode-opt" data-mode-action="priority">[P]Priority</span>`;
            html += `<span class="mode-opt" data-mode-action="craft">[C]Craft</span>`;
            const researchNeedsAttention = !this.game.research.activeResearch && this.game.research.hasAvailableResearch();
            const researchStyle = researchNeedsAttention ? ' style="color:#ffcc44"' : '';
            html += `<span class="mode-opt" data-mode-action="research"${researchStyle}>[R]Research${researchNeedsAttention ? ' •' : ''}</span>`;
            html += `<span class="mode-opt" data-mode-action="inventory">[I]Inventory</span>`;
            html += `<span class="mode-opt" data-mode-action="arcane">[V]Rifts</span>`;
            const storyNew = this.game.story.hasUnviewed() ? ' style="color:#ffcc44"' : '';
            html += `<span class="mode-opt" data-mode-action="story"${storyNew}>[J]Story${this.game.story.hasUnviewed() ? ' •' : ''}</span>`;
            html += '</span>';
        }
        if (input.mode !== 'build' && input.mode !== 'zone' && input.mode !== 'designate') this._hideBuildPanel();
        this.elements.modeBar.innerHTML = html;

        if (input.mode === 'normal' && this.game.settings.showTutorial && this.game.tutorial) {
            const hl = this.game.tutorial.getHighlight();
            if (hl) {
                const btn = this.elements.modeBar.querySelector(`[data-mode-action="${hl}"]`);
                if (btn) btn.classList.add('tutorial-highlight');
            }
        }
        if (this.game.exploration?.expeditions?.some(e => e.pendingDecision)) {
            const btn = this.elements.modeBar.querySelector('[data-mode-action="arcane"]');
            if (btn) btn.classList.add('tutorial-highlight');
        }
    }

    _updateBuildPanel(input) {
        const panel = this.elements.buildPanel;
        if (!panel) return;
        let html = '<div class="build-panel-header"><div class="build-panel-tabs">';
        BUILD_CATEGORIES.forEach(cat => {
            const active = cat === input.buildCategory ? ' active' : '';
            html += `<span class="build-tab${active}" data-build-cat="${cat}">${cat}</span>`;
        });
        html += '</div><span class="build-panel-close" data-mode-action="back">[Esc] Close</span></div>';
        html += '<div class="build-grid">';
        input.buildOptions.forEach((opt, i) => {
            const active = opt === input.buildType ? ' active' : '';
            const def = BUILDINGS[opt];
            const keyLabel = i < 9 ? i + 1 : (i === 9 ? '0' : '');
            const locked = this.isBuildingLocked(opt);
            const atMax = !locked && this.isBuildingAtMax(opt);
            const canAfford = !locked && !atMax && this.game.resources.has(def.cost);
            let stateClass = locked ? ' build-card--locked' : atMax ? ' build-card--maxed' : !canAfford ? ' build-card--unaffordable' : '';
            const bldSprite = this.game.skinManager?.isActive && this.game.skinManager.getSprite('buildings', opt);
            const bldIcon = bldSprite
                ? `<img src="${this._getBuildingSpriteURL(opt)}" class="build-card-icon--sprite">`
                : `<span style="color:${def.color}">${def.char}</span>`;
            const costHtml = Object.entries(def.cost).map(([k, v]) => this._buildCostChip(k, v)).join('');
            const overlayHtml = locked ? '<span class="build-card-overlay">LOCKED</span>' : atMax ? '<span class="build-card-overlay">MAX</span>' : '';
            html += `<div class="build-card${active}${stateClass}" data-build-opt="${opt}">`;
            html += `<div class="build-card-key">${keyLabel}</div>`;
            html += `<div class="build-card-icon-wrap">${bldIcon}</div>`;
            html += `<div class="build-card-name">${opt.replace(/_/g, ' ')}</div>`;
            html += `<div class="build-card-cost">${costHtml}</div>`;
            html += overlayHtml;
            html += `</div>`;
        });
        html += '</div>';
        panel.innerHTML = html;
        panel.style.display = 'block';
        const toolbar = document.getElementById('touch-toolbar');
        if (toolbar && toolbar.offsetHeight > 0 && getComputedStyle(toolbar).display !== 'none') {
            panel.style.bottom = toolbar.offsetHeight + 'px';
        } else {
            panel.style.bottom = '0';
        }
    }

    updateBuildPanel(input) {
        if (!input) return;
        if (input.mode === 'build') this._updateBuildPanel(input);
        else if (input.mode === 'zone') this._updateFarmPanel(input);
        else if (input.mode === 'designate') this._updateGatherPanel(input);
    }

    _updateFarmPanel(input) {
        const panel = this.elements.buildPanel;
        if (!panel) return;
        let html = '<div class="build-panel-header"><div class="build-panel-title">Farm Crops</div>';
        html += '<span class="build-panel-close" data-mode-action="back">[Esc] Close</span></div>';
        html += '<div class="build-grid">';
        input.cropOptions.forEach((opt, i) => {
            const crop = CROPS[opt];
            const req = CROP_RESEARCH_REQS[opt];
            const locked = req && !this.game.research.isResearched(req);
            const active = opt === input.cropType ? ' active' : '';
            const stateClass = locked ? ' build-card--locked' : '';
            const keyLabel = i < 9 ? i + 1 : (i === 9 ? '0' : '');
            const overlayHtml = locked ? '<span class="build-card-overlay">LOCKED</span>' : '';
            const seasons = crop.seasons.map(s => s.charAt(0).toUpperCase()).join('');
            html += `<div class="build-card${active}${stateClass}" data-crop-opt="${opt}">`;
            html += `<div class="build-card-key">${keyLabel}</div>`;
            html += `<div class="build-card-icon-wrap"><span style="color:${crop.color}">${crop.readyChar}</span></div>`;
            html += `<div class="build-card-name">${opt}</div>`;
            html += `<div class="build-card-cost"><span class="cost-chip" style="color:#88cc44">${crop.harvestYield}x</span><span class="cost-chip" style="color:#aaa">${seasons}</span></div>`;
            html += overlayHtml;
            html += `</div>`;
        });
        html += '</div>';
        panel.innerHTML = html;
        panel.style.display = 'block';
        const toolbar = document.getElementById('touch-toolbar');
        if (toolbar && toolbar.offsetHeight > 0 && getComputedStyle(toolbar).display !== 'none') {
            panel.style.bottom = toolbar.offsetHeight + 'px';
        } else {
            panel.style.bottom = '0';
        }
    }

    _updateGatherPanel(input) {
        const panel = this.elements.buildPanel;
        if (!panel) return;
        let html = '<div class="build-panel-header"><div class="build-panel-title">Gather</div>';
        html += '<span class="build-panel-close" data-mode-action="back">[Esc] Close</span></div>';
        html += '<div class="build-grid">';
        const chopActive = input.designateMode === 'chop' ? ' active' : '';
        const mineActive = input.designateMode === 'mine' ? ' active' : '';
        html += `<div class="build-card${chopActive}" data-designate-mode="chop">`;
        html += `<div class="build-card-key">1</div>`;
        html += `<div class="build-card-icon-wrap"><span style="color:#44aa22">♣</span></div>`;
        html += `<div class="build-card-name">Chop</div>`;
        html += `<div class="build-card-cost"><span class="cost-chip" style="color:#8b6b3a">Wood</span></div>`;
        html += `</div>`;
        html += `<div class="build-card${mineActive}" data-designate-mode="mine">`;
        html += `<div class="build-card-key">2</div>`;
        html += `<div class="build-card-icon-wrap"><span style="color:#999">▲</span></div>`;
        html += `<div class="build-card-name">Mine</div>`;
        html += `<div class="build-card-cost"><span class="cost-chip" style="color:#999">Stone</span></div>`;
        html += `</div>`;
        html += '</div>';
        panel.innerHTML = html;
        panel.style.display = 'block';
        const toolbar = document.getElementById('touch-toolbar');
        if (toolbar && toolbar.offsetHeight > 0 && getComputedStyle(toolbar).display !== 'none') {
            panel.style.bottom = toolbar.offsetHeight + 'px';
        } else {
            panel.style.bottom = '0';
        }
    }

    _hideBuildPanel() {
        const panel = this.elements.buildPanel;
        if (panel) panel.style.display = 'none';
    }

    getWavePreview(waveNum) {
        const enemies = WAVE_CONFIG.baseEnemies + WAVE_CONFIG.enemiesPerWave * (waveNum - 1);
        const hp = WAVE_CONFIG.baseHp + WAVE_CONFIG.hpPerWave * (waveNum - 1);
        return `${enemies} enemies, ${hp} HP each`;
    }

    _refreshRiftGateInfo() {
        if (!this.game.exploration) return;
        const hasActive = this.game.exploration.expeditions.length > 0;
        const hasCompleted = this.game.exploration.completedExpeditions.length > 0;
        if (!hasActive && !hasCompleted) return;
        const riftSection = this.elements.infoPanel.querySelector('[data-rift-info]');
        if (!riftSection) return;
        const html = this._buildRiftGateInnerHtml();
        if (html !== riftSection.innerHTML) {
            riftSection.innerHTML = html;
            const logContainer = riftSection.querySelector('.exp-log-container');
            if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    _refreshColonistInfo() {
        const colonist = this.game.getColonist(this._viewingColonistId);
        if (!colonist) {
            this._viewingColonistId = null;
            return;
        }
        const html = this.buildColonistInfoHtml(colonist);
        if (html !== this._lastColonistInfoHtml) {
            this._lastColonistInfoHtml = html;
            if (this.elements.infoPanel.matches(':hover')) {
                this._pendingColonistInfoHtml = html;
                this._updateSkillTooltips(colonist);
            } else {
                this.elements.infoPanel.innerHTML = html;
                this._pendingColonistInfoHtml = null;
            }
        }
    }

    _updateSkillTooltips(colonist) {
        const tips = this.elements.infoPanel.querySelectorAll('.skill-tip[data-tip]');
        for (const tip of tips) {
            const text = tip.textContent;
            const match = text.match(/^(.+):(\d+)$/);
            if (!match) continue;
            const name = match[1];
            const skillEntry = Object.entries(SKILLS).find(([, def]) => def.name === name);
            if (skillEntry) {
                const [k, def] = skillEntry;
                tip.dataset.tip = skillXpTip(def, colonist.skills[k] || 1, colonist.skillXp?.[k] || 0);
                continue;
            }
            const magicEntry = Object.entries(MAGIC_SKILLS).find(([, def]) => def.name === name);
            if (magicEntry) {
                const [k, def] = magicEntry;
                tip.dataset.tip = magicXpTip(def, colonist.magicSkills[k], colonist._magicXpAccumulator?.[k] || 0);
            }
        }
    }

    _buildGolemForgeHtml() {
        if (!this.game.research.isResearched('golem_craft')) {
            return `<div class="info-row" style="color:#888;">Requires Golem Craft research</div>`;
        }
        let html = `<div class="info-row" style="color:#cc8833;font-weight:bold;">Golem Forge</div>`;
        html += `<div class="info-row" style="margin-top:4px;"><b>Craft Golem:</b></div>`;
        for (const [key, def] of Object.entries(GOLEM_TYPES)) {
            const costStr = Object.entries(def.cost).map(([r, n]) => `${n} ${r}`).join(', ');
            const canAfford = this.game.resources.has(def.cost);
            html += `<div class="info-actions"><button ${canAfford ? '' : 'disabled'} onclick="window.game.craftGolem('${key}')" style="background:#553311;color:#ffcc88;">${def.name}</button> <span style="color:#aaa;font-size:0.85em">${costStr}</span></div>`;
            html += `<div class="info-row" style="color:#888;font-size:0.85em;margin-bottom:4px;">Specialty: ${def.specialty} (skill ${def.skillLevel || '-'}), HP: ${def.hp}</div>`;
        }
        return html;
    }

    _buildRiftGateHtml() {
        return `<div data-rift-info="1">${this._buildRiftGateInnerHtml()}</div>`;
    }

    _buildRiftGateInnerHtml() {
        const expl = this.game.exploration;
        let html = `<div class="info-row" style="color:#33ccff;font-weight:bold;">Rift Gate</div>`;

        if (expl.expeditions.length > 0) {
            for (const exp of expl.expeditions) {
                if (exp.status === 'gathering') {
                    const names = exp.partyIds.map(id => {
                        const c = this.game.getColonist(id);
                        return c ? c.name : '?';
                    }).join(', ');
                    html += `<div class="info-row" style="color:#aaddff;">${exp.realmName} — assembling</div>`;
                    html += `<div class="info-row" style="color:#888;">Party: ${names}</div>`;
                } else {
                    const elapsed = this.game.tick - exp.startTick;
                    const totalDur = Math.floor(exp.duration * 1.2);
                    const pct = Math.min(100, Math.floor((elapsed / totalDur) * 100));
                    html += `<div class="info-row" style="color:#aaddff;">${exp.realmName} — ${exp.status}${exp.combat ? ' [COMBAT]' : ''} (${pct}%)</div>`;

                    const aliveParty = exp.partySnapshot.filter(p => p.hp > 0);
                    html += `<div class="info-row" style="color:#888;">Party (${aliveParty.length}/${exp.partySnapshot.length} alive):</div>`;
                    for (const p of exp.partySnapshot) {
                        const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
                        const color = p.hp <= 0 ? '#664444' : hpPct < 30 ? '#ff4444' : hpPct < 60 ? '#ffaa44' : '#88cc88';
                        const status = p.hp <= 0 ? ' [DOWN]' : '';
                        const manaStr = p.maxMana > 0 ? ` | ${Math.round(p.mana)}/${p.maxMana} MP` : '';
                        const shieldStr = p.shieldActive ? ' 🛡' : '';
                        const threatStr = getThreatDisplayHtml(getTargetPriority(p));
                        html += `<div class="info-row" style="color:${color}; padding-left:8px;">${p.name} — ${Math.max(0, Math.round(p.hp))}/${p.maxHp} HP${manaStr}${shieldStr}${status}${threatStr}</div>`;
                    }

                    if (exp.combat) {
                        const enemiesAlive = exp.combat.enemies.filter(e => e.hp > 0).length;
                        html += `<div class="info-row" style="color:#ff8844; margin-top:4px;">Enemies remaining: ${enemiesAlive}/${exp.combat.enemies.length}</div>`;
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
        if (dims.length > 0 && this.game.power.powered) {
            html += `<div class="info-row" style="margin-top:6px;"><b>Send Expedition:</b></div>`;
            for (const dim of dims) {
                html += `<div class="info-actions"><button onclick="window.game.showExpeditionSetup('${dim.key}')" style="background:#1a4466;color:#88ddff;">${dim.name} (Diff ${dim.difficulty})</button></div>`;
            }
        } else if (!this.game.power.powered) {
            html += `<div class="info-row" style="color:#ff4444;">No mana — cannot send expeditions</div>`;
        }

        if (expl.completedExpeditions.length > 0 && expl.expeditions.length === 0) {
            const last = expl.completedExpeditions[expl.completedExpeditions.length - 1];
            html += `<div class="info-row" style="margin-top:6px;color:#88ccff;font-size:0.9em;">Last expedition: ${last.realmName}</div>`;
            html += `<div class="exp-log-container">`;
            const logSlice = last.log.slice(-10);
            for (const entry of logSlice) {
                const color = this._expLogColor(entry.type);
                html += `<div class="exp-log-entry" style="color:${color};">${entry.text}</div>`;
            }
            html += `</div>`;
        }

        return html;
    }

    _expLogColor(type) {
        return LOG_COLORS[type] || LOG_COLORS.default;
    }

    _spellTooltip(spell) {
        const parts = [spell.school.charAt(0).toUpperCase() + spell.school.slice(1)];
        switch (spell.effect) {
            case 'ranged_damage': parts.push(`${spell.damage} dmg, range ${spell.range}`); break;
            case 'ranged_damage_aoe': parts.push(`${spell.damage} AoE dmg, range ${spell.range}, radius ${spell.radius}`); break;
            case 'heal': parts.push(`Heals ${spell.healAmount} HP (self or ally) when below ${Math.round((spell.hpThreshold || 0.5) * 100)}%`); break;
            case 'buff_defense': parts.push(`-${Math.round(spell.damageReduction * 100)}% dmg taken, ${spell.duration}t`); break;
            case 'buff_speed': parts.push(`+${spell.workSpeedBonus > 1 ? Math.round((spell.workSpeedBonus - 1) * 100) + '% work speed' : ''}${spell.moveSpeedBonus ? ' +' + spell.moveSpeedBonus + ' move' : ''}, ${spell.duration}t`); break;
            case 'summon': parts.push(`Summon (${spell.summonHp} HP, ${spell.summonDamage} dmg, ${spell.summonDuration}t)`); break;
            case 'teleport': parts.push(`Teleport, range ${spell.range}`); break;
            case 'boost_crops': parts.push(`${spell.growthMult}x growth, radius ${spell.radius}, ${spell.duration}t`); break;
            case 'terraform': parts.push(`Flatten terrain, radius ${spell.radius}`); break;
            case 'divination_modifier': parts.push(`Passive divination effect, ${spell.duration}t`); break;
            case 'chain_damage': parts.push(`${spell.damage} dmg, arcs to ${spell.chainTargets} foes (${Math.round((spell.chainFalloff || 0.6) * 100)}% falloff), range ${spell.range}`); break;
            case 'ranged_damage_slow': parts.push(`${spell.damage} dmg + slow (${Math.round((1 - (spell.slowMult || 0.5)) * 100)}% slower), range ${spell.range}`); break;
            case 'chain_heal': parts.push(`Heals ${spell.healAmount} HP, arcs to ${spell.chainTargets} allies (${Math.round((spell.chainFalloff || 0.6) * 100)}% falloff)`); break;
            case 'cleanse': parts.push(`Removes poison/slow debuffs from an ally, range ${spell.range}`); break;
            case 'absorb_shield': parts.push(`Absorbs ${spell.absorbAmount} dmg, radius ${spell.radius}, ${spell.duration}t`); break;
            case 'buff_quality': parts.push(`+${spell.qualityBonus} work quality, radius ${spell.radius}, ${spell.duration}t`); break;
            case 'buff_rest': parts.push(`${Math.round((spell.restDecayMult || 1) * 100)}% rest decay, radius ${spell.radius}, ${spell.duration}t`); break;
            case 'stun': parts.push(`Stuns a foe (${spell.stunRounds || 1} rnd / ${spell.stunDuration}t), range ${spell.range}`); break;
            case 'summon_swarm': parts.push(`Summons ${spell.swarmCount} spectral wisps`); break;
            case 'finish_construction': parts.push(`Instantly completes a build, range ${spell.range}`); break;
            case 'transmute': parts.push(spell.fromResource
                ? `Converts ${spell.inputAmount} ${spell.fromResource.replace(/_/g, ' ')} → ${spell.outputAmount} ${spell.toResource.replace(/_/g, ' ')}`
                : `Conjures ${spell.outputAmount} ${spell.toResource.replace(/_/g, ' ')}`); break;
            case 'ripen_crops': parts.push(`Ripens crops past ${Math.round((spell.ripenThreshold || 0.5) * 100)}% growth, radius ${spell.radius}`); break;
            default: parts.push(spell.effect.replace(/_/g, ' '));
        }
        if (spell.trigger === 'inCombat') parts.push('Trigger: in combat');
        else if (spell.trigger === 'lowHealth') parts.push('Trigger: low HP');
        else if (spell.trigger === 'woundedNearby') parts.push('Trigger: self or ally hurt');
        else if (spell.trigger === 'hasTask') parts.push('Trigger: while working');
        else if (spell.trigger === 'debuffNearby') parts.push('Trigger: ally afflicted');
        else if (spell.trigger === 'canTransmute') parts.push('Trigger: when materials available');
        return parts.join(' | ');
    }

    getStructureDescription(structure) {
        const def = BUILDINGS[structure];
        if (!def) return '';
        const powered = this.game.power.hasPower();
        let html = '';
        if (def.description) {
            html += `<div class="info-row" style="color:#999;font-size:11px;">${def.description}</div>`;
        }
        if (def.maxCount) {
            const limit = def.maxCount + getMaxCountBonus(def, structure, this.game);
            let placed = 0;
            for (const row of this.game.map) for (const t of row) if (t.structure === structure) placed++;
            html += `<div class="info-row" style="color:#aa88ff;font-size:11px;">Placed: ${placed} / ${limit}</div>`;
        }
        if (def.power) {
            if (def.power.generates) {
                html += `<div class="info-row" style="color:#88ff88;">Generates ${def.power.generates} mana</div>`;
            }
            if (def.power.consumes) {
                const status = powered ? '<span style="color:#88ff88;">Powered</span>' : '<span style="color:#ff4444;">No power!</span>';
                html += `<div class="info-row">Consumes ${def.power.consumes} mana — ${status}</div>`;
            }
        }
        return html;
    }

    getPedestalEffectDescription(artDef) {
        if (!artDef?.pedestal) return '';
        const effects = getNestedEffectLines(artDef.pedestal);
        if (effects.length === 0) return '';
        return `<div class="info-row" style="color:#aaffaa;font-size:11px;">${effects.join(' | ')}</div>`;
    }

    _buildEquipmentEffectsHtml(colonist) {
        const items = getEquippedItems(colonist);
        if (items.length === 0) return '';
        const totals = {};
        const expeditionTotals = {};
        let drMult = 1;
        let expDrMult = 1;
        for (const item of items) {
            for (const stat of Object.keys(STAT_META)) {
                if (!item[stat]) continue;
                if (STAT_META[stat].aggregation === 'multiplicative') { drMult *= (1 - item[stat]); }
                else { totals[stat] = (totals[stat] || 0) + item[stat]; }
            }
            if (item.expedition) {
                for (const [stat, value] of Object.entries(item.expedition)) {
                    if (!STAT_META[stat] || !value) continue;
                    if (STAT_META[stat].aggregation === 'multiplicative') { expDrMult *= (1 - value); }
                    else { expeditionTotals[stat] = (expeditionTotals[stat] || 0) + value; }
                }
            }
        }
        if (drMult < 1) totals.damageReduction = 1 - drMult;
        if (expDrMult < 1) expeditionTotals.damageReduction = 1 - expDrMult;
        const sep = ' <span style="color:#333">|</span> ';
        const sections = [];
        const parts = [];
        for (const [stat, meta] of Object.entries(STAT_META)) {
            if (totals[stat]) parts.push(`<span style="color:#ccc">${meta.label}:</span> ${formatStatValue(stat, totals[stat])}`);
        }
        if (parts.length) sections.push(parts.join(sep));
        const expParts = [];
        for (const [stat, meta] of Object.entries(STAT_META)) {
            if (expeditionTotals[stat]) expParts.push(`<span style="color:#ccc">${meta.label}:</span> ${formatStatValue(stat, expeditionTotals[stat])}`);
        }
        if (expParts.length) sections.push(`<span style="color:#33ccff">Expedition:</span> ${expParts.join(sep)}`);
        return sections.join('<br>');
    }

    _getTrinketTooltip(art) {
        const lines = [];
        if (art.description) lines.push(art.description);
        const equipped = getItemStatLines(art);
        if (equipped.length) lines.push(`Equipped: ${equipped.join(', ')}`);
        if (art.pedestal) {
            const r = art.pedestal.radius === 'global' ? 'Colony-wide' : `Radius ${art.pedestal.radius}`;
            const parts = getNestedEffectLines(art.pedestal);
            if (parts.length) lines.push(`Aura (${r}): ${parts.join(', ')}`);
            if (art.pedestal.manaCost) lines.push(`Pedestal mana: -${art.pedestal.manaCost}`);
        }
        if (art.expedition) {
            const parts = getNestedEffectLines(art.expedition);
            if (parts.length) lines.push(`Expedition: ${parts.join(', ')}`);
        }
        if (art.durability) lines.push(`Breaks after ${art.durability.max} use(s). Repair at Anvil.`);
        if (art.consumable) lines.push('Consumed on use');
        return lines.join(' | ') || art.name;
    }

    _switchToInfoTab() {
        const container = document.getElementById('game-container');
        const isTabbed = container.classList.contains('tabbed-mode');
        if (!isTabbed) return;

        const footer = document.getElementById('game-footer');
        if (footer.classList.contains('collapsed')) {
            footer.classList.remove('collapsed');
        }
        const tabs = footer.querySelectorAll('.footer-tab[data-tab]');
        const panels = footer.querySelectorAll('#footer-content > .footer-panel, #minimap-container');
        tabs.forEach(t => { if (t.dataset.tab !== 'collapse') t.classList.remove('active'); });
        panels.forEach(p => p.classList.remove('active'));
        const infoTab = footer.querySelector('.footer-tab[data-tab="info"]');
        if (infoTab) infoTab.classList.add('active');
        const infoPanel = document.getElementById('info-panel');
        if (infoPanel) infoPanel.classList.add('active');
    }

    buildColonistInfoHtml(colonist) {
        const moodLevel = getMoodLabel(colonist.mood);
        const traitSpanArr = colonist.traits.map(t => {
            const trait = TRAITS[t];
            if (!trait) return t;
            return `<span class="skill-tip" data-tip="${trait.description}">${trait.name}</span>`;
        });
        const thoughts = colonist.thoughts.slice(-5).map(t =>
            `<span class="${t.moodEffect >= 0 ? 'positive' : 'negative'}">${t.text} (${t.moodEffect > 0 ? '+' : ''}${t.moodEffect.toFixed(0)})</span>`
        ).join('<br>');

        const weaponTip = colonist.weapon ? getWeaponTooltip(colonist) : 'No weapon equipped';
        const armorTip = colonist.armor ? `${colonist.armor.description || ''} ${getItemStatLines(colonist.armor).join(', ')}`.trim() : 'No armor equipped';
        const helmetTip = colonist.helmet ? `${colonist.helmet.description || ''} ${getItemStatLines(colonist.helmet).join(', ')}`.trim() : 'No helmet equipped';
        const clothesTip = colonist.clothes ? `${colonist.clothes.description || ''} ${getItemStatLines(colonist.clothes).join(', ')}`.trim() : 'No clothes equipped';
        const toolTip = colonist.tool ? `${colonist.tool.description || ''} ${getItemStatLines(colonist.tool).join(', ')}`.trim() : 'No tool equipped';
        const bootsTip = colonist.boots ? `${colonist.boots.description || ''} ${getItemStatLines(colonist.boots).join(', ')}`.trim() : 'No boots equipped';
        const trinketTip = colonist.trinket ? this._getTrinketTooltip(colonist.trinket) : 'No trinket equipped';

        const nc = colonist.nameColor || '#ffff00';
        const sectionHdr = 'color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;margin-top:8px;padding-bottom:2px;margin-bottom:3px';
        let html = `<div class="info-header" style="cursor:pointer;color:${nc}" onclick="window.game.selectColonistById(${colonist.id})">${colonist.name} ${colonist.drafted ? '[DRAFTED]' : ''}${colonist.guardMode ? '[GUARDING]' : ''}</div>`;

        // --- Status ---
        html += `<div style="${sectionHdr}">Status</div>`;
        html += `<div class="info-row">HP: ${Math.round(colonist.hp)}/${colonist.maxHp} | Mood: <span class="mood-${moodLevel}">${colonist.mood.toFixed(0)} (${moodLevel})</span></div>`;
        html += `<div class="info-row">Hunger: ${bar(colonist.needs.hunger)} Rest: ${bar(colonist.needs.rest)}</div>`;
        html += `<div class="info-row">State: ${colonist.state} | Task: ${this.getColonistTaskDescription(colonist)}</div>`;
        const allTraits = traitSpanArr.filter(Boolean).join(', ');
        if (allTraits) html += `<div class="info-row">Traits: ${allTraits}</div>`;
        html += `<div class="info-row">Bed: ${colonist.assignedBed ? `(${colonist.assignedBed.x},${colonist.assignedBed.y})` : 'None'}</div>`;
        if (this.game.exploration) {
            const expl = this.game.exploration;
            const expLvl = expl.getExpeditionLevel(colonist.id);
            const xpData = expl.expeditionXP[colonist.id];
            if (colonist.onExpedition) {
                html += `<div class="info-row"><span style="color:#cc88ff;">On Expedition</span></div>`;
            } else if (expl.isFatigued(colonist.id, this.game.tick)) {
                const remaining = expl.getFatigueRemaining(colonist.id, this.game.tick);
                const days = Math.ceil(remaining / CONFIG.TICKS_PER_DAY);
                html += `<div class="info-row"><span style="color:#ff6644;">Fatigued</span> <span style="color:#888;">(${days} day${days !== 1 ? 's' : ''} remaining)</span></div>`;
            }
            if (expLvl > 0 || xpData) {
                const xp = xpData?.xp || 0;
                const level = xpData?.level || 0;
                const needed = 10 + level * 5;
                html += `<div class="info-row">Adventurer Lv${level} <span style="color:#888;">(${xp}/${needed} XP)</span></div>`;
            }
        }

        // --- Skills ---
        html += `<div style="${sectionHdr}">Skills</div>`;
        html += `<div class="info-row">${Object.entries(SKILLS).map(([k, def]) => {
            const level = colonist.skills[k] || 1;
            const xpTip = skillXpTip(def, level, colonist.skillXp?.[k] || 0);
            return `<span class="skill-tip" data-tip="${xpTip}">${def.name}:${level}</span>`;
        }).join(' ')}</div>`;
        const hasMagic = colonist.magicSkills && Object.values(colonist.magicSkills).some(v => v > 0);
        if (hasMagic) {
            html += `<div class="info-row"><span style="color:#aa88ff">Mana: ${bar(colonist.mana / colonist.maxMana * 100)} ${Math.floor(colonist.mana)}/${colonist.maxMana}</span></div>`;
            const attunedSchools = Array.isArray(colonist.attunedSchools) ? colonist.attunedSchools : [];
            html += `<div class="info-row">Magic: ${Object.entries(MAGIC_SKILLS).filter(([k]) => colonist.magicSkills[k] > 0).map(([k, def]) => {
                const level = colonist.magicSkills[k];
                const isAttuned = attunedSchools.includes(k);
                const tip = magicXpTip(def, level, colonist._magicXpAccumulator?.[k] || 0) + (isAttuned ? ' — attuned' : '');
                const style = isAttuned ? `color:${def.color};font-weight:bold` : 'color:#bb88ff';
                return `<span class="skill-tip" data-tip="${tip}" style="${style}">${isAttuned ? '★' : ''}${def.name}:${level}</span>`;
            }).join(' ')}</div>`;
            if (attunedSchools.length > 0) {
                const names = attunedSchools.map(k => `<span style="color:${MAGIC_SKILLS[k].color}">${MAGIC_SKILLS[k].name}</span>`).join(', ');
                html += `<div class="info-row" style="font-size:0.85em">Attuned: ${names} <span style="color:#666">(only these autocast)</span></div>`;
            }
        }

        // --- Equipment ---
        html += `<div style="${sectionHdr}">Equipment</div>`;
        const id = colonist.id;
        const tomeName = colonist.equippedTome ? SPELL_TOMES[colonist.equippedTome]?.name : null;
        const tomeTip = tomeName ? (() => { const p = (colonist.tomeProgress?.[colonist.equippedTome] || 0); return `${tomeName} (${Math.floor(p / SPELL_TOMES[colonist.equippedTome].learningWork * 100)}%)`; })() : 'No tome equipped';
        const slotStyle = 'position:relative;border:1px solid #444;border-radius:4px;padding:4px 2px;background:#1a1a2e;cursor:pointer;min-height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;';
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin:4px 0 0 0;text-align:center;">`;
        // Row 1: Tome | Helmet | Armor | Trinket
        html += `<div class="skill-tip" data-tip="${tomeTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Tome</div>`;
        html += colonist.equippedTome ? `${this._itemIcon(colonist.equippedTome, 'tome')}` : `<span style="color:#333;font-size:14px">~</span>`;
        html += this._buildSlotSelect(colonist, 'tome');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${helmetTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Helmet</div>`;
        html += colonist.helmet ? `${this._itemIcon(colonist.helmet.key, 'helmet')}` : `<span style="color:#333;font-size:14px">^</span>`;
        html += this._buildSlotSelect(colonist, 'helmet');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${armorTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Armor</div>`;
        html += colonist.armor ? `${this._itemIcon(colonist.armor.key, 'armor')}` : `<span style="color:#333;font-size:14px">[]</span>`;
        html += this._buildSlotSelect(colonist, 'armor');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${trinketTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Trinket</div>`;
        html += colonist.trinket ? `${this._itemIcon(colonist.trinket.key, 'trinket')}` : `<span style="color:#333;font-size:14px">*</span>`;
        html += this._buildSlotSelect(colonist, 'trinket');
        html += `</div>`;
        html += `</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin:0 0 4px 0;text-align:center;">`;
        // Row 2: Weapon | Boots | Clothes | Offhand
        html += `<div class="skill-tip" data-tip="${weaponTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Weapon</div>`;
        html += colonist.weapon ? `${this._itemIcon(colonist.weapon.key, 'weapon')}` : `<span style="color:#333;font-size:14px">/</span>`;
        html += this._buildSlotSelect(colonist, 'weapon');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${bootsTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Boots</div>`;
        html += colonist.boots ? `${this._itemIcon(colonist.boots.key, 'boots')}` : `<span style="color:#333;font-size:14px">∟</span>`;
        html += this._buildSlotSelect(colonist, 'boots');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${clothesTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Clothes</div>`;
        html += colonist.clothes ? `${this._itemIcon(colonist.clothes.key, 'clothes')}` : `<span style="color:#333;font-size:14px">♦</span>`;
        html += this._buildSlotSelect(colonist, 'clothes');
        html += `</div>`;
        html += `<div class="skill-tip" data-tip="${toolTip}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">Offhand</div>`;
        html += colonist.tool ? `${this._itemIcon(colonist.tool.key, 'tool')}` : `<span style="color:#333;font-size:14px">\\</span>`;
        html += this._buildSlotSelect(colonist, 'tool');
        html += `</div>`;
        html += `</div>`;

        // --- Equipment Effects Summary ---
        const eqEffects = this._buildEquipmentEffectsHtml(colonist);
        if (eqEffects) {
            html += `<div style="margin:2px 0;padding:3px 6px;background:#111;border-radius:3px;font-size:11px;color:#aaa;line-height:1.5">${eqEffects}</div>`;
        }

        // --- Spells ---
        const hasSpells = (colonist.knownSpells && colonist.knownSpells.length > 0) || colonist.equippedTome;
        if (hasSpells || hasMagic) {
            html += `<div style="${sectionHdr}">Spells</div>`;
            if (colonist.equippedTome) {
                const tomeDef = SPELL_TOMES[colonist.equippedTome];
                const currentProgress = (colonist.tomeProgress && colonist.tomeProgress[colonist.equippedTome]) || 0;
                const progress = Math.floor((currentProgress / tomeDef.learningWork) * 100);
                html += `<div class="info-row"><span style="color:#bb88ff">Studying: ${tomeDef.name} (${progress}%)</span></div>`;
            }
            if (colonist.knownSpells && colonist.knownSpells.length > 0) {
                const attuned = Array.isArray(colonist.attunedSchools) ? colonist.attunedSchools : [];
                // A spell is "inactive" when it's an auto-cast spell whose school isn't
                // attuned. The colonist will never trigger it on its own. Targeted
                // spells are always player-castable, so attunement doesn't sideline them.
                const active = [];
                const inactive = [];
                for (const spellKey of colonist.knownSpells) {
                    const spell = SPELLS[spellKey];
                    if (!spell) continue;
                    const notAttuned = attuned.length > 0 && !attuned.includes(spell.school);
                    if (spell.castType === 'auto' && notAttuned) inactive.push(spellKey);
                    else active.push(spellKey);
                }

                const renderSpellRow = (spellKey, notAttuned) => {
                    const spell = SPELLS[spellKey];
                    const effectiveCd = spell.cooldown * getSpellCooldownMult(this.game);
                    const onCooldown = colonist._spellCooldowns?.[spellKey] && this.game.tick - colonist._spellCooldowns[spellKey] < effectiveCd;
                    const cdRemaining = onCooldown ? Math.ceil(effectiveCd - (this.game.tick - colonist._spellCooldowns[spellKey])) : 0;
                    const hasManaForSpell = colonist.mana >= spell.manaCost;
                    const isDisabled = colonist.disabledSpells && colonist.disabledSpells.includes(spellKey);
                    const greyed = isDisabled || notAttuned;
                    let spellHtml = '';
                    if (spell.castType === 'auto') {
                        const checked = !isDisabled ? 'checked' : '';
                        spellHtml += `<input type="checkbox" ${checked} onchange="window.game.toggleSpell(${colonist.id},'${spellKey}')" style="margin-right:4px;vertical-align:middle">`;
                    }
                    const tipDesc = this._spellTooltip(spell);
                    spellHtml += `<span class="skill-tip" data-tip="${tipDesc}" style="color:${greyed ? '#666' : '#bb88ff'}">${spell.name}</span> <span style="color:#666;font-size:0.85em">(${spell.manaCost} mana, ${spell.cooldown}t cd)</span>`;
                    if (spell.castType === 'targeted') {
                        const disabled = onCooldown || !hasManaForSpell;
                        const reason = onCooldown ? `${cdRemaining}t` : !hasManaForSpell ? 'low mana' : '';
                        spellHtml += disabled
                            ? ` <span style="color:#666">[${reason}]</span>`
                            : ` <button onclick="window.game.startSpellTargeting(${colonist.id},'${spellKey}')" style="font-size:0.8em">Cast</button>`;
                    } else if (notAttuned) {
                        spellHtml += ` <span style="color:#a66;font-size:0.8em">[not attuned]</span>`;
                    } else {
                        spellHtml += ` <span style="color:#555;font-size:0.8em">[auto${onCooldown ? `, ${cdRemaining}t` : ''}]</span>`;
                    }
                    return `<div class="info-row" style="padding-left:8px">${spellHtml}</div>`;
                };

                // Only draw the sub-headers when a split actually exists. A colonist
                // with no attunement (or all spells in-school) reads as a flat list.
                if (inactive.length > 0) {
                    html += `<div class="info-row" style="padding-left:4px;color:#88cc88;font-size:0.85em;font-weight:bold">Active</div>`;
                }
                for (const spellKey of active) html += renderSpellRow(spellKey, false);
                if (inactive.length > 0) {
                    html += `<div class="info-row" style="padding-left:4px;color:#a66;font-size:0.85em;font-weight:bold">Inactive — not attuned</div>`;
                    for (const spellKey of inactive) html += renderSpellRow(spellKey, true);
                }
            }
            if (colonist.activeEffects && colonist.activeEffects.length > 0) {
                const effects = colonist.activeEffects.map(e => {
                    const t = e.expiresAt - this.game.tick;
                    switch (e.type) {
                        case 'absorb': return `<span style="color:#88ccff">Ward (${e.absorbRemaining} absorb)</span>`;
                        case 'quality': return `<span style="color:#ffcc66">Diligence (+${e.qualityBonus} quality, ${t}t)</span>`;
                        case 'rest': return `<span style="color:#aaffcc">Tireless (${t}t)</span>`;
                        case 'shield': return `<span style="color:#88ccff">Shield (${t}t)</span>`;
                        case 'speed': return `<span style="color:#ffff88">Haste (${t}t)</span>`;
                        default: return `<span style="color:#88ffaa">${e.type} (${t}t)</span>`;
                    }
                }).join(', ');
                html += `<div class="info-row">Effects: ${effects}</div>`;
            }
            if (colonist.activeAuras && colonist.activeAuras.length > 0) {
                const auraSpans = colonist.activeAuras.map(a => {
                    const def = ALL_ITEMS[a.key];
                    const tip = def ? this._getTrinketTooltip(def) : a.name;
                    const clickAction = a.sourceType === 'pedestal'
                        ? `window.game.camera.centerOn(${a.x},${a.y})`
                        : `window.game.selectColonistById(${a.colonistId})`;
                    return `<span class="skill-tip" data-tip="${tip}" style="color:#ccaa44;cursor:pointer;text-decoration:underline" onclick="${clickAction}">${a.name}</span>`;
                }).join(', ');
                html += `<div class="info-row">Auras: ${auraSpans}</div>`;
            }
        }

        // --- Relationships ---
        const otherColonists = this.game.colonists.filter(c => c.id !== colonist.id && c.hp > 0);
        const notableRelationships = otherColonists
            .map(c => {
                const opinion = colonist.opinions?.[c.id] ?? 0;
                const tier = getRelationshipTier(opinion);
                return { colonist: c, tier, opinion };
            })
            .filter(r => r.tier.key !== 'stranger');
        notableRelationships.sort((a, b) => b.opinion - a.opinion);
        html += `<div style="${sectionHdr}">Relationships</div>`;
        if (notableRelationships.length === 0) {
            html += `<div class="info-row" style="color:#555">No notable relationships</div>`;
        } else {
            const relHtml = notableRelationships.map(r => {
                const tierDef = RELATIONSHIP_TIERS.find(t => t.key === r.tier.key) || r.tier;
                return `<span style="color:${tierDef.color}">[${tierDef.name}]</span> <span style="cursor:pointer;text-decoration:underline" onclick="window.game.selectColonistById(${r.colonist.id})">${r.colonist.name}</span> <span style="color:#555;font-size:0.85em">(${r.opinion > 0 ? '+' : ''}${r.opinion})</span>`;
            }).join('<br>');
            html += `<div class="info-row">${relHtml}</div>`;
        }

        // --- Thoughts ---
        if (thoughts) {
            html += `<div style="${sectionHdr}">Thoughts</div>`;
            html += `<div class="info-thoughts">${thoughts}</div>`;
        }

        // --- Actions ---
        html += `<div style="${sectionHdr}">Actions</div>`;
        html += `<div class="info-actions">`;
        html += `<button onclick="window.game.toggleDraft(${colonist.id})">${colonist.drafted ? 'Undraft' : 'Draft'}</button>`;
        html += `<button onclick="window.game.toggleGuard(${colonist.id})">${colonist.guardMode ? 'Unguard' : 'Guard'}</button>`;
        if (colonist.guardMode) html += `<button onclick="window.game.input.startGuardPointTargeting(${colonist.id})">Set Guard Point</button>`;
        html += `<button onclick="window.game.draftAll()">Draft All</button>`;
        html += `<button onclick="window.game.undraftAll()">Undraft All</button>`;
        html += `<button onclick="window.game.autoEquipBest(${colonist.id})">Auto-equip Best</button>`;
        const others = this.game.colonists.filter(c => c.hp > 0 && c.id !== colonist.id);
        if (others.length > 0) {
            html += `<select onchange="if(this.value)window.game.copyPriorities(${colonist.id},parseInt(this.value))"><option value="">Copy Priorities From...</option>`;
            for (const o of others) html += `<option value="${o.id}">${o.name}</option>`;
            html += `</select>`;
        }
        html += `<button onclick="window.game.centerOnColonist(${colonist.id})">Center Camera</button>`;
        const isFollowing = this.game.followingColonist === colonist.id;
        html += `<button onclick="window.game.toggleFollow(${colonist.id})">${isFollowing ? 'Unfollow' : 'Follow'}</button>`;
        html += `</div>`;
        html += `<div class="info-row">Color: <input type="color" value="${nc}" onchange="window.game.setColonistColor(${colonist.id}, this.value)"></div>`;
        return html;
    }

    showColonistInfo(colonist) {
        this._switchToInfoTab();
        this._viewingRiftGate = false;
        this._viewingColonistId = colonist.id;
        this.elements.infoPanel.innerHTML = this.buildColonistInfoHtml(colonist);
    }

    _buildSlotSelect(colonist, slot) {
        const overlayStyle = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
        const SLOT_CONFIG = {
            weapon: { listName: 'weapons', label: 'Weapon', fallback: 'Fists', equipFn: 'equipWeapon', unequipFn: 'unequipWeapon', statRenderer: w => { const cd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown; return `${w.damage}d (${(w.damage / cd).toFixed(1)} dps)`; } },
            armor: { listName: 'armors', label: 'Armor', fallback: 'None', equipFn: 'equipArmor', unequipFn: 'unequipArmor', statRenderer: a => getItemStatLines(a).join(', ') },
            helmet: { listName: 'helmets', label: 'Helmet', fallback: 'None', equipFn: 'equipHelmet', unequipFn: 'unequipHelmet', statRenderer: h => getItemStatLines(h).join(', ') },
            clothes: { listName: 'clothes', label: 'Clothes', fallback: 'None', equipFn: 'equipClothes', unequipFn: 'unequipClothes', statRenderer: c => getItemStatLines(c).join(', ') },
            tool: { listName: 'tools', label: 'Offhand', fallback: 'None', equipFn: 'equipTool', unequipFn: 'unequipTool', statRenderer: t => {
                const lines = getItemStatLines(t);
                if (t.expedition) { const el = getNestedEffectLines(t.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
            trinket: { listName: 'trinkets', label: 'Trinket', fallback: 'None', equipFn: 'equipTrinket', unequipFn: 'unequipTrinket', statRenderer: a => {
                const lines = getItemStatLines(a);
                if (a.expedition) { const el = getNestedEffectLines(a.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
            boots: { listName: 'boots', label: 'Boots', fallback: 'None', equipFn: 'equipBoots', unequipFn: 'unequipBoots', statRenderer: b => {
                const lines = getItemStatLines(b);
                if (b.expedition) { const el = getNestedEffectLines(b.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
        };
        if (slot === 'tome') {
            const tomes = this.game.resources.tomes || [];
            let html = `<select style="${overlayStyle}" id="eq-tome-${colonist.id}" onchange="if(this.value==='unequip'){window.game.unequipTome(${colonist.id})}else if(this.value!==''){window.game.equipTome(${colonist.id},parseInt(this.value))}">`;
            const currentTome = colonist.equippedTome ? SPELL_TOMES[colonist.equippedTome]?.name : 'None';
            html += `<option value="">Tome: ${currentTome}</option>`;
            if (colonist.equippedTome) html += `<option value="unequip">Unequip</option>`;
            tomes.forEach((t, i) => {
                const def = SPELL_TOMES[t.key];
                if (!def) return;
                const spell = SPELLS[def.spell];
                const canStudy = (colonist.magicSkills[spell?.school] || 0) >= def.minSchoolLevel;
                const alreadyKnown = colonist.knownSpells.includes(def.spell);
                if (alreadyKnown) return;
                html += `<option value="${i}" ${canStudy ? '' : 'disabled'}>${def.name}${canStudy ? '' : ` (need ${MAGIC_SKILLS[spell.school].name} ${def.minSchoolLevel})`}</option>`;
            });
            if (tomes.length === 0 && !colonist.equippedTome) html += `<option disabled>No tomes available</option>`;
            html += `</select>`;
            return html;
        }
        const cfg = SLOT_CONFIG[slot];
        const items = this.game.resources[cfg.listName];
        const current = colonist[slot];
        let html = `<select style="${overlayStyle}" id="eq-${slot}-${colonist.id}" onchange="if(this.value==='unequip'){window.game.${cfg.unequipFn}(${colonist.id})}else if(this.value!==''){window.game.${cfg.equipFn}(${colonist.id},parseInt(this.value))}">`;
        html += `<option value="">${cfg.label}: ${current?.name || cfg.fallback}</option>`;
        if (current) html += `<option value="unequip">Unequip ${current.name}</option>`;
        items.forEach((item, i) => {
            const stats = cfg.statRenderer(item);
            html += `<option value="${i}">${item.name}${stats ? ` (${stats})` : ''}</option>`;
        });
        if (items.length === 0 && !current) html += `<option disabled>No ${cfg.label.toLowerCase()}s available</option>`;
        html += `</select>`;
        return html;
    }

    _buildRoomQualityHtml(roomId) {
        let html = '';
        const rq = this.game.roomQualities[roomId];
        const wq = this.game.workshopQualities[roomId];
        const th = this.game.townHallQualities[roomId];
        if (!rq && !wq && !th) {
            html += `<div class="info-row">Room #${roomId}</div>`;
            return html;
        }
        if (th) {
            html += `<div class="info-row" style="color:#ffdd66;font-weight:bold;">Town Hall — ${th.tierName} (${th.total}/100)</div>`;
            html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">  → Mood +${th.moodEffect} for ${th.duration} ticks when relaxing here</div>`;
            const b = th.breakdown;
            if (b.size > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Size: +${b.size}</div>`;
            if (b.floor > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Flooring: +${b.floor}</div>`;
            if (b.light > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Lighting: +${b.light}</div>`;
            if (b.decor > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Decorations: +${b.decor} (${th.decorList.map(d => d.replace(/_/g, ' ')).join(', ')})</div>`;
            if (b.coherence > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Coherence: +${b.coherence}</div>`;
        }
        if (rq) {
            html += `<div class="info-row" style="color:#aaccff;font-weight:bold;">${rq.tierName} (${rq.total}/100)</div>`;
            html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">  → Mood +${rq.moodEffect} for ${rq.duration} ticks when sleeping here</div>`;
            const b = rq.breakdown;
            if (b.size > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Size: +${b.size}</div>`;
            if (b.floor > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Flooring: +${b.floor}</div>`;
            if (b.light > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Lighting: +${b.light}</div>`;
            if (b.decor > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Decorations: +${b.decor} (${rq.decorList.map(d => d.replace(/_/g, ' ')).join(', ')})</div>`;
            if (b.coherence > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Coherence: +${b.coherence}</div>`;
        }
        if (wq) {
            const label = wq.focusGroup ? `${wq.tierName} ${wq.focusGroup}` : wq.tierName;
            html += `<div class="info-row" style="color:#ffcc44;font-weight:bold;">Workshop — ${label} (${wq.total}/100)</div>`;
            const b = wq.breakdown;
            if (b.size > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Size: +${b.size}</div>`;
            if (b.floor > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Flooring: +${b.floor}</div>`;
            if (b.light > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Lighting: +${b.light}</div>`;
            if (b.focus > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Focus: +${b.focus}${wq.focusGroup ? ` (${wq.focusGroup})` : ''}</div>`;
            if (b.support > 0) html += `<div class="info-row" style="color:#888;font-size:0.85em;">  Support: +${b.support} (${wq.supportList.map(s => s.replace(/_/g, ' ')).join(', ')})</div>`;
            if (wq.speedMult > 1 || wq.qualityBonus > 0) {
                let bonusText = '';
                if (wq.speedMult > 1) bonusText += `Speed: +${Math.round((wq.speedMult - 1) * 100)}%`;
                if (wq.qualityBonus > 0) bonusText += `${bonusText ? ' | ' : ''}Quality: +${wq.qualityBonus} skill`;
                html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">  → ${bonusText}</div>`;
            }
        }
        return html;
    }

    _buildBedInfoHtml(tile, x, y) {
        let html = '';
        const assigned = this.game.colonists.find(c =>
            c.assignedBed && c.assignedBed.x === x && c.assignedBed.y === y && c.hp > 0
        );
        if (assigned) {
            html += `<div class="info-row">Assigned to: ${assigned.name}</div>`;
            html += `<div class="info-actions"><button onclick="window.game.unassignBed(${x},${y})">Unassign</button></div>`;
        } else {
            html += `<div class="info-row">Unassigned bed</div>`;
            html += `<div class="info-actions">`;
            html += `<label>Assign: </label>`;
            html += `<select id="bed-assign-select" onchange="window.game.assignBedFromSelect(${x},${y},this.value)">`;
            html += `<option value="">-- Select colonist --</option>`;
            for (const c of this.game.colonists) {
                if (c.hp <= 0) continue;
                const hasBed = c.assignedBed ? ` (has bed)` : '';
                html += `<option value="${c.id}">${c.name}${hasBed}</option>`;
            }
            html += `</select></div>`;
        }
        return html;
    }

    _buildNexusInfoHtml() {
        let html = '';
        const waves = this.game.waves;
        html += `<div class="info-row" style="color:#9933ff;font-weight:bold;">Void Nexus</div>`;
        html += `<div class="info-row">Highest Wave: ${waves.highestWaveCompleted} | Cap: ${waves.getColonistCap(this.game)}</div>`;
        if (waves.active) {
            html += `<div class="info-row" style="color:#ff4444;">Wave ${waves.currentWave} — ${waves.enemies.length} enemies alive</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('nexus')" style="background:#6622aa;color:white;">Open Rifts Panel</button></div>`;
        return html;
    }

    _buildPedestalInfoHtml(tile, x, y) {
        let html = '';
        if (tile.pedestalArtifact) {
            const artDef = ALL_ITEMS[tile.pedestalArtifact];
            const broken = tile.pedestalInactive ? ' <span style="color:#ff4444;">(No Power)</span>' : '';
            html += `<div class="info-row" style="color:#ccaa44;">Placed: ${this._itemIcon(tile.pedestalArtifact, artDef?.type || 'trinket')}${artDef?.name || tile.pedestalArtifact}${broken}</div>`;
            html += this.getPedestalEffectDescription(artDef);
            if (artDef?.pedestal?.radius && artDef.pedestal.radius !== 'global') {
                html += `<div class="info-row">Radius: ${artDef.pedestal.radius} | Mana: -${artDef.pedestal.manaCost || 0}</div>`;
            } else if (artDef?.pedestal?.radius === 'global') {
                html += `<div class="info-row">Effect: Colony-wide | Mana: -${artDef.pedestal.manaCost || 0}</div>`;
            }
            html += `<div class="info-actions"><button onclick="window.game.retrievePedestalItem(${x},${y})">Retrieve Item</button></div>`;
        } else {
            html += `<div class="info-row" style="color:#888;">Empty — place an item</div>`;
            const available = [
                ...this.game.resources.trinkets,
                ...this.game.resources.tools,
                ...this.game.resources.helmets,
                ...this.game.resources.armors,
                ...this.game.resources.boots,
            ].filter(a => a.pedestal);
            if (available.length > 0) {
                html += `<div class="info-actions"><select id="pedestal-select">`;
                for (const art of available) {
                    html += `<option value="${art.key}">${art.name}</option>`;
                }
                html += `</select>`;
                html += `<button onclick="window.game.placePedestalItem(${x},${y},document.getElementById('pedestal-select').value)">Place</button></div>`;
            } else {
                html += `<div class="info-row" style="color:#666;">No items with pedestal effects in inventory</div>`;
            }
        }
        return html;
    }

    _buildRiftGateInfoHtml() {
        let html = '';
        html += `<div class="info-row" style="color:#33ccff;font-weight:bold;">Rift Gate</div>`;
        const expl = this.game.exploration;
        if (expl.expeditions.length > 0) {
            const exp = expl.expeditions[0];
            const elapsed = this.game.tick - (exp.startTick || this.game.tick);
            const totalDur = Math.floor((exp.duration || 1) * 1.2);
            const pct = exp.status === 'gathering' ? 0 : Math.min(100, Math.floor((elapsed / totalDur) * 100));
            html += `<div class="info-row" style="color:#aaddff;">${exp.realmName} — ${exp.status} (${pct}%)</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('expeditions')" style="background:#1a4466;color:#88ddff;">Open Rifts Panel</button></div>`;
        return html;
    }

    _buildTradeRiftInfoHtml(tile, x, y) {
        let html = '';
        html += `<div class="info-row" style="color:#66ccaa;font-weight:bold;">Trade Rift</div>`;
        const requests = this.game.tradeRift.requests;
        const open = requests.filter(r => !r.fulfilled).length;
        html += `<div class="info-row">${open} open request${open === 1 ? '' : 's'}</div>`;
        if (!this.game.power.hasPower()) {
            html += `<div class="info-row" style="color:#ff8844;">Unpowered — no mana to open the rift.</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('requests')" style="background:#1a5544;color:#88ddcc;">Open Rifts Panel</button></div>`;
        return html;
    }


    getCraftOutputTip(outputKey) {
        if (WEAPONS[outputKey]) {
            const w = WEAPONS[outputKey];
            const baseCd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            const dpt = (w.damage / baseCd).toFixed(1);
            let tip = w.description ? `${w.description} ` : '';
            tip += `${w.damage}d (${dpt} dps)`;
            if (w.ranged) tip += `, range ${w.range}`;
            const extras = getItemStatLines({ ...w, damage: undefined, ranged: undefined, range: undefined });
            if (extras.length) tip += `, ${extras.join(', ')}`;
            return tip;
        }
        if (ARMORS[outputKey]) {
            const a = ARMORS[outputKey];
            let tip = a.description ? `${a.description} ` : '';
            tip += getItemStatLines(a).join(', ');
            return tip;
        }
        if (HELMETS[outputKey]) {
            const h = HELMETS[outputKey];
            let tip = h.description ? `${h.description} ` : '';
            tip += getItemStatLines(h).join(', ');
            return tip;
        }
        if (CLOTHES[outputKey]) {
            const c = CLOTHES[outputKey];
            let tip = c.description ? `${c.description} ` : '';
            tip += getItemStatLines(c).join(', ');
            return tip;
        }
        if (BOOTS[outputKey]) {
            const b = BOOTS[outputKey];
            let tip = b.description ? `${b.description} ` : '';
            tip += getItemStatLines(b).join(', ');
            return tip;
        }
        if (TOOLS[outputKey]) {
            const t = TOOLS[outputKey];
            let tip = t.description ? `${t.description} ` : '';
            tip += getItemStatLines(t).join(', ');
            return tip;
        }
        if (ALL_ITEMS[outputKey]?.type === 'trinket') {
            return this._getTrinketTooltip(ALL_ITEMS[outputKey]);
        }
        if (POTIONS[outputKey]) {
            const p = POTIONS[outputKey];
            let tip = p.description ? `${p.description} ` : '';
            if (p.effect === 'heal') tip += `Heals ${p.healAmount} HP`;
            else if (p.effect === 'speed') tip += `+${Math.round((p.workSpeedBonus - 1) * 100)}% work, +${Math.round(p.moveSpeedBonus * 100)}% move for ${p.duration} ticks`;
            else if (p.effect === 'restoreMana') tip += `Restores ${p.manaAmount} mana`;
            else if (p.effect === 'resistance') tip += `${Math.round(p.damageReduction * 100)}% damage reduction for ${p.duration} ticks`;
            return tip.trim();
        }
        if (SPELL_TOMES[outputKey]) {
            const t = SPELL_TOMES[outputKey];
            const spell = SPELLS[t.spell];
            let tip = t.description ? `${t.description} ` : '';
            tip += `School: ${spell.school}, Lv ${t.minSchoolLevel}`;
            if (spell.manaCost) tip += `, ${spell.manaCost} mana`;
            if (spell.damage) tip += `, ${spell.damage} dmg`;
            if (spell.healAmount) tip += `, heals ${spell.healAmount}`;
            if (spell.range) tip += `, range ${spell.range}`;
            return tip;
        }
        return null;
    }

    showAnimalInfo(animal) {
        this._switchToInfoTab();
        this._viewingColonistId = null;
        const def = ANIMALS[animal.type];
        let html = `<div class="info-header">${animal.type}</div>`;
        html += `<div class="info-row">HP: ${animal.hp}/${animal.maxHp}</div>`;
        html += `<div class="info-row">${animal.hostile ? 'Hostile' : 'Passive'}</div>`;
        if (def?.meatYield) html += `<div class="info-row">Meat yield: ${def.meatYield}</div>`;
        if (def?.hideYield) html += `<div class="info-row">Hide yield: ${def.hideYield}</div>`;
        html += `<div class="info-actions">`;
        if (!animal.hostile) {
            html += `<button onclick="window.game.huntAnimal(${animal.id})">Hunt</button>`;
        }
        html += `</div>`;
        this.elements.infoPanel.innerHTML = html;
    }

    showTileInfo(tile, x, y) {
        this._switchToInfoTab();
        this._viewingColonistId = null;
        this._viewingRiftGate = (tile.structure === 'rift_gate');
        let html = `<div class="info-header">Tile (${x},${y})</div>`;
        html += `<div class="info-row">Terrain: ${tile.terrain}</div>`;
        if (tile.structure) {
            html += `<div class="info-row" style="color:#ddd;font-weight:bold;">${tile.structure.replace(/_/g,' ')}</div>`;
            const maxHp = BUILDINGS[tile.structure]?.hp;
            if (maxHp) {
                const currentHp = tile.structureHp !== undefined ? tile.structureHp : maxHp;
                const hpColor = currentHp >= maxHp ? '#88ff88' : currentHp > maxHp * 0.5 ? '#ffcc00' : '#ff4444';
                html += `<div class="info-row" style="color:${hpColor}">HP: ${currentHp} / ${maxHp}</div>`;
            }
            html += this.getStructureDescription(tile.structure);
        }
        if (tile.floor) {
            html += `<div class="info-row" style="color:#999">Floor: ${tile.floor.replace(/_/g,' ')}</div>`;
        }
        if (tile.resource) html += `<div class="info-row">Resource: ${tile.resource.type} (${tile.resource.amount})</div>`;
        if (tile.zone) {
            html += `<div class="info-row">Zone: ${tile.zone.crop} (${tile.zone.state})</div>`;
            if (tile.zone.state === 'growing') {
                const cropDef = CROPS[tile.zone.crop];
                if (cropDef) {
                    const pct = Math.min(100, Math.round((tile.zone.growth / cropDef.growthTicks) * 100));
                    html += `<div class="info-row" style="color:#88cc44">Growth: ${pct}%</div>`;
                }
            }
        }
        if (tile.roomId !== null) html += this._buildRoomQualityHtml(tile.roomId);
        if (tile.onFire) html += `<div class="info-row fire">ON FIRE!</div>`;

        if (tile.structure === 'bed') {
            html += this._buildBedInfoHtml(tile, x, y);
        }

        if (tile.structure === 'void_nexus') {
            html += this._buildNexusInfoHtml();
        }

        if (tile.structure === 'artifact_pedestal') {
            html += this._buildPedestalInfoHtml(tile, x, y);
        }

        if (tile.structure === 'rift_gate') {
            html += this._buildRiftGateInfoHtml();
        }

        if (tile.structure === 'trade_rift') {
            html += this._buildTradeRiftInfoHtml(tile, x, y);
        }

        if (tile.structure === 'golem_forge') {
            html += this._buildGolemForgeHtml();
        }

        if (tile.structure === 'forge_core' || tile.structure === 'ritual_core') {
            const cs = getComplexStructureAt(this.game, x, y);
            if (cs) {
                html += `<div class="info-row" style="color:#44ff44;font-weight:bold;">Pattern Active!</div>`;
                const def = COMPLEX_STRUCTURES[cs.key];
                if (def) html += `<div class="info-row" style="color:#88ff88;">${def.description}</div>`;
            } else {
                html += `<div class="info-row" style="color:#ff8844;">Pattern incomplete — surround with the required layout to activate</div>`;
            }
        }

        this.elements.infoPanel.innerHTML = html;
    }

    showTileEntities(tile, x, y, colonists, animals, raiders = [], tamedAnimals = [], summons = []) {
        this._switchToInfoTab();
        this._viewingRiftGate = (tile.structure === 'rift_gate');
        this._viewingColonistId = (colonists.length === 1 && animals.length === 0 && raiders.length === 0 && tamedAnimals.length === 0 && summons.length === 0)
            ? colonists[0].id : null;
        let html = '';

        for (const r of raiders) {
            const def = ENTITIES[r.type];
            const label = def?.name || (r.char === 'E' ? 'Void Enemy' : 'Raider');
            const color = def?.color || (r.char === 'E' ? '#cc00ff' : '#ff3333');
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${color};">${label}</div>`;
            html += `<div class="info-row">HP: ${r.hp}/${r.maxHp}</div>`;
            html += `<div class="info-row">Damage: ${r.weapon?.name ? r.weapon.name + ' ' : ''}${r.damage}d (${(r.damage / (r.attackCooldown || COLONIST_CONFIG.baseAttackCooldown)).toFixed(1)} dps)</div>`;
            html += `<div class="info-row">State: ${r.fleeing ? 'Fleeing' : 'Attacking'}</div>`;
            if (r.roles && r.roles.length > 0) html += getRoleInfoHtml(r);
            html += `</div>`;
        }

        for (const c of colonists) {
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += this.buildColonistInfoHtml(c);
            html += `</div>`;
        }

        for (const a of animals) {
            const def = ANIMALS[a.type];
            const color = def?.color || '#ccaa88';
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${color};">${a.type}${a.hostile ? ' (hostile)' : ''}${def?.tameable ? ' (tameable)' : ''}</div>`;
            html += `<div class="info-row">HP: ${a.hp}/${a.maxHp}</div>`;
            if (def?.meatYield) html += `<div class="info-row">Meat yield: ${def.meatYield}</div>`;
            if (def?.hideYield) html += `<div class="info-row">Hide yield: ${def.hideYield}</div>`;
            if (a.hostile && def?.damage) html += `<div class="info-row">Damage: ${def.damage}</div>`;
            if (def?.tameable) {
                const tamedDef = TAMED_ANIMALS[a.type];
                if (tamedDef?.produces) html += `<div class="info-row" style="color:#88cc88">Produces: ${tamedDef.produces} (every ${tamedDef.produceRate} ticks)</div>`;
                if (tamedDef?.packAnimal) html += `<div class="info-row" style="color:#bbaa44">Pack animal (+${Math.round(tamedDef.expeditionSpeedBonus * 100)}% expedition speed)</div>`;
                if (tamedDef?.happinessAura) html += `<div class="info-row" style="color:#ff88cc">Happiness aura (radius ${tamedDef.auraRadius})</div>`;
            }
            html += `<div class="info-row">Speed: ${def?.speed || a.speed}</div>`;
            html += `<div class="info-actions">`;
            html += `<button onclick="window.game.huntAnimal(${a.id})">Hunt</button>`;
            if (def?.tameable && this.game.research.isResearched('beast_binding')) {
                const tamedDef = TAMED_ANIMALS[a.type];
                const canAfford = tamedDef && this.game.resources.has({ food: tamedDef.foodToTame });
                if (tamedDef?.dangerousTame) {
                    const bestTamer = this.game.colonists.filter(c => c.hp > 0).sort((a, b) => (b.skills.animals || 0) - (a.skills.animals || 0))[0];
                    const chance = bestTamer ? Math.round(getTameChance(bestTamer, a.type, this.game) * 100) : Math.round((tamedDef.baseTameChance || 0.4) * 100);
                    html += `<button ${canAfford ? '' : 'disabled'} onclick="window.game.tameWildAnimal(${a.id})">Tame (${tamedDef.foodToTame} food) — ${chance}%</button>`;
                    html += `<div class="info-row" style="color:#ff6644;font-size:0.85em">⚠ Dangerous! Retaliation: ${tamedDef.retaliationDamage} dmg on failure</div>`;
                } else {
                    html += `<button ${canAfford ? '' : 'disabled'} onclick="window.game.tameWildAnimal(${a.id})">Tame (${tamedDef?.foodToTame || '?'} food)</button>`;
                }
            }
            html += `</div></div>`;
        }

        for (const a of tamedAnimals) {
            const def = TAMED_ANIMALS[a.type];
            const color = def?.color || '#ccaa88';
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${color};">${a.type} (tamed)</div>`;
            html += `<div class="info-row">HP: ${a.hp}/${a.maxHp}</div>`;
            if (a.roles && a.roles.length > 0) {
                html += getRoleInfoHtml(a);
            } else {
                if (def?.produces) {
                    html += `<div class="info-row">Produces: ${def.produces} (every ${def.produceRate} ticks)</div>`;
                    html += `<div class="info-row">Next in: ${a.produceCooldown} ticks</div>`;
                }
                if (def?.guardAnimal) {
                    const stateColor = a.guardState === 'engaging' ? '#ff4444' : a.guardState === 'retreating' ? '#ffaa00' : '#44cc44';
                    html += `<div class="info-row" style="color:${stateColor}">Guard: ${(a.guardState || 'patrolling').charAt(0).toUpperCase() + (a.guardState || 'patrolling').slice(1)}</div>`;
                }
                if (def?.packAnimal) html += `<div class="info-row" style="color:#bbaa44">Pack animal (+${Math.round(def.expeditionSpeedBonus * 100)}% expedition speed)</div>`;
                if (def?.happinessAura) html += `<div class="info-row" style="color:#ff88cc">Happiness aura (radius ${def.auraRadius})</div>`;
            }
            html += getEffectInfoHtml(a);
            if (a.onExpedition) html += `<div class="info-row" style="color:#33ccff">On expedition</div>`;
            html += `</div>`;
        }

        for (const s of summons) {
            const def = ENTITIES[s.type];
            const color = def?.color || s.color || '#9966ff';
            const name = def?.name || s.type || 'Summon';
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${color};">${name}</div>`;
            html += `<div class="info-row">HP: ${s.hp}/${s.maxHp}</div>`;
            html += `<div class="info-row">Damage: ${s.damage}d (${(s.damage / (s.attackCooldown || COLONIST_CONFIG.baseAttackCooldown)).toFixed(1)} dps)</div>`;
            if (s.roles && s.roles.length > 0) {
                html += getRoleInfoHtml(s);
            } else {
                const remaining = s.expiresAt ? Math.max(0, s.expiresAt - (this.game.tick || 0)) : '?';
                html += `<div class="info-row" style="color:#9966ff">Expires in ${remaining} ticks</div>`;
                html += `<div class="info-row">State: ${s.guardState || 'idle'}</div>`;
            }
            html += `</div>`;
        }

        html += `<div class="info-header" style="font-size:11px;color:#aaa;">Tile (${x},${y})</div>`;
        if (tile.onFire) html += `<div class="info-row fire">ON FIRE!</div>`;
        if (tile.structure) {
            html += `<div class="info-row" style="color:#ddd;font-weight:bold;">${tile.structure.replace(/_/g,' ')}</div>`;
            const maxHp = BUILDINGS[tile.structure]?.hp;
            if (maxHp) {
                const currentHp = tile.structureHp !== undefined ? tile.structureHp : maxHp;
                const hpColor = currentHp >= maxHp ? '#88ff88' : currentHp > maxHp * 0.5 ? '#ffcc00' : '#ff4444';
                html += `<div class="info-row" style="color:${hpColor}">HP: ${currentHp} / ${maxHp}</div>`;
            }
            html += this.getStructureDescription(tile.structure);
            if (tile.structure === 'forge_core' || tile.structure === 'ritual_core') {
                const cs = getComplexStructureAt(this.game, x, y);
                if (cs) {
                    html += `<div class="info-row" style="color:#44ff44;font-weight:bold;">Pattern Active!</div>`;
                    const def = COMPLEX_STRUCTURES[cs.key];
                    if (def && tile.structure === 'forge_core')  html += `<div class="info-row" style="color:#88ff88;">x2.5 equipment craft speed, +2 equipment quality bonus</div>`;
                    if (def && tile.structure === 'ritual_core') html += `<div class="info-row" style="color:#88ff88;">30% spell cooldown reduction</div>`;
                } else {
                    html += `<div class="info-row" style="color:#ff8844;">Pattern incomplete, surround with the required layout to activate</div>`;
                }
            }
        }
        if (tile.floor) html += `<div class="info-row" style="color:#999">Floor: ${tile.floor.replace(/_/g,' ')}</div>`;
        if (tile.zone) {
            html += `<div class="info-row">Zone: ${tile.zone.crop} (${tile.zone.state})</div>`;
            if (tile.zone.state === 'growing') {
                const cropDef = CROPS[tile.zone.crop];
                if (cropDef) {
                    const pct = Math.min(100, Math.round((tile.zone.growth / cropDef.growthTicks) * 100));
                    html += `<div class="info-row" style="color:#88cc44">Growth: ${pct}%</div>`;
                }
            }
        }
        if (tile.resource) html += `<div class="info-row">Resource: ${tile.resource.type} (${tile.resource.amount})</div>`;
        html += `<div class="info-row">Terrain: ${tile.terrain}</div>`;
        if (tile.roomId !== null) html += this._buildRoomQualityHtml(tile.roomId);

        if (tile.structure === 'bed') {
            html += this._buildBedInfoHtml(tile, x, y);
        }

        if (tile.structure === 'void_nexus') {
            html += this._buildNexusInfoHtml();
        }

        if (tile.structure === 'artifact_pedestal') {
            html += this._buildPedestalInfoHtml(tile, x, y);
        }

        if (tile.structure === 'rift_gate') {
            html += this._buildRiftGateInfoHtml();
        }

        if (tile.structure === 'trade_rift') {
            html += this._buildTradeRiftInfoHtml(tile, x, y);
        }

        if (tile.structure === 'golem_forge') {
            html += this._buildGolemForgeHtml();
        }

        this.elements.infoPanel.innerHTML = html;
    }

    showMultiColonistInfo(colonists) {
        this._switchToInfoTab();
        this._viewingColonistId = null;
        const draftedCount = colonists.filter(c => c.drafted).length;
        let html = `<div class="info-header">${colonists.length} Colonists Selected</div>`;
        html += `<div class="info-actions" style="margin-bottom:8px;">`;
        html += `<button onclick="window.game.draftAllSelected()">Draft All</button>`;
        html += `<button onclick="window.game.undraftAllSelected()">Undraft All</button>`;
        html += `</div>`;
        html += `<div class="info-row" style="color:#888">${draftedCount} drafted</div>`;

        for (const c of colonists) {
            const moodLevel = getMoodLabel(c.mood);
            html += `<div style="border-top:1px solid #333;margin-top:4px;padding-top:4px;">`;
            html += `<span class="info-header" style="cursor:pointer;color:${c.nameColor || '#ffff00'}" onclick="window.game.selectColonistById(${c.id})">${c.name}</span>`;
            html += ` <span class="mood-${moodLevel}">${c.mood.toFixed(0)}</span>`;
            html += ` <span style="color:#888">${c.state}${c._relaxActivity ? ' [relaxing]' : ''}${c.drafted ? ' [D]' : ''}${c.guardMode ? ' [G]' : ''}${c.golem ? ' [Golem]' : ''}</span>`;
            html += `<div class="info-row">HP:${Math.round(c.hp)} H:${c.needs.hunger.toFixed(0)} R:${c.needs.rest.toFixed(0)}</div>`;
            html += `<div class="info-actions">`;
            html += `<button onclick="window.game.selectColonistById(${c.id})">Focus</button>`;
            html += `<button onclick="window.game.toggleDraft(${c.id})">${c.drafted ? 'Undraft' : 'Draft'}</button>`;
            html += `<button onclick="window.game.toggleGuard(${c.id})">${c.guardMode ? 'Unguard' : 'Guard'}</button>`;
            if (c.guardMode) html += `<button onclick="window.game.input.startGuardPointTargeting(${c.id})">Set Guard Point</button>`;
            html += `</div></div>`;
        }

        this.elements.infoPanel.innerHTML = html;
    }

    _updateOverlay() {
        const anyOpen = this.priorityPanelVisible || this.craftPanelVisible ||
            this.researchPanelVisible || this.inventoryVisible ||
            this.settingsPanelVisible ||
            this.arcanePanelVisible || this.storyPanelVisible;
        const overlay = document.getElementById('panel-overlay');
        if (overlay) overlay.classList.toggle('visible', anyOpen);
    }

    _closeAllPanels() {
        if (this.priorityPanelVisible) {
            this.priorityPanelVisible = false;
            this.elements.priorityPanel.style.display = 'none';
        }
        if (this.craftPanelVisible) {
            this.craftPanelVisible = false;
            this.elements.craftPanel.style.display = 'none';
        }
        if (this.researchPanelVisible) {
            this.researchPanelVisible = false;
            this.elements.researchPanel.style.display = 'none';
        }
        if (this.inventoryVisible) {
            this.inventoryVisible = false;
            this.elements.inventoryPanel.style.display = 'none';
        }
        if (this.settingsPanelVisible) {
            this.settingsPanelVisible = false;
            this.elements.settingsPanel.style.display = 'none';
        }
        if (this.arcanePanelVisible) {
            this.arcanePanelVisible = false;
            this.elements.arcanePanel.style.display = 'none';
        }
        if (this.storyPanelVisible) {
            this.storyPanelVisible = false;
            this.elements.storyPanel.style.display = 'none';
        }
    }

    _panelPause(opening) {
        if (opening) {
            if (!this._panelSessionActive) {
                this._panelSessionActive = true;
                this._wasPausedBeforePanel = this.game.paused;
                if (!this.game.paused) this.game.togglePause(true);
            }
        } else {
            this._panelSessionActive = false;
            if (!this._wasPausedBeforePanel && this.game.paused) this.game.togglePause(true);
        }
    }

    togglePriorityPanel() {
        const opening = !this.priorityPanelVisible;
        this._closeAllPanels();
        this.priorityPanelVisible = opening;
        this._panelPause(opening);
        this.elements.priorityPanel.style.display = opening ? 'block' : 'none';
        if (opening) this.updatePriorityPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    updatePriorityPanel() {
        if (!this._prioTab) this._prioTab = 'work';
        const tabs =
            '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
            `<button class="craft-tab${this._prioTab === 'work' ? ' active' : ''}" data-prio-tab="work">Work Priorities</button>` +
            `<button class="craft-tab${this._prioTab === 'attune' ? ' active' : ''}" data-prio-tab="attune">Attunement</button>` +
            '</div>';

        const body = this._prioTab === 'attune' ? this._attunementGridHtml() : this._workPriorityGridHtml();
        const heading = this._prioTab === 'attune'
            ? `<h3>Magic Attunement (click to toggle, max ${MAGIC_STUDY_CONFIG.attunementSlots})</h3><div style="color: #888; font-size: 0.9em; margin-bottom: 8px;">Only spells from attuned schools autocast in the world and on expeditions. Free to change anytime.</div>`
            : '<h3>Work Priorities (click to cycle, -=disabled)</h3><div style="color: #888; font-size: 0.9em; margin-bottom: 8px;">Note: Golem priorities are locked to their specialization</div>';
        const fullHtml = '<div class="panel-close" data-panel-close="priority">&times;</div>' + tabs + heading + body;
        if (fullHtml !== this._lastPrioHtml) {
            this._lastPrioHtml = fullHtml;
            this.elements.priorityPanel.innerHTML = fullHtml;
        }
    }

    _workPriorityGridHtml() {
        const skills = Object.keys(SKILLS);
        let html = '<table><tr><th>Colonist</th>';
        skills.forEach(s => { html += `<th>${s.substring(0, 8)}</th>`; });
        html += '</tr>';

        for (const c of this.game.colonists) {
            if (c.hp <= 0) continue;
            html += `<tr><td style="color:${c.nameColor || '#ffff00'}">${c.name}</td>`;
            for (const s of skills) {
                const val = c.priorities[s];
                const display = val === 0 ? '-' : val;
                const isGolem = c.golem;
                const currentSkillLevel = c.skills[s];
                const colorFromLevel = currentSkillLevel === 1 ? '#ff4444' : currentSkillLevel === 2 ? '#ff3c00' : currentSkillLevel === 3 ? '#ff7b00' : currentSkillLevel === 4 ? '#ffc800' : currentSkillLevel === 5 ? '#fff700' : currentSkillLevel === 6 ? '#ddff00' : currentSkillLevel === 7 ? '#ccff00' : currentSkillLevel === 8 ? '#80ff00' : currentSkillLevel === 9 ? '#91ff00' : currentSkillLevel === 10 ? '#80ff00' : '#666';
                const cellClass = isGolem ? 'prio-cell golem-locked' : 'prio-cell';
                const cellStyle = isGolem ? 'opacity: 0.6; cursor: not-allowed;' : `background-color:${colorFromLevel};color:white;text-shadow:-1px -1px 0.5px #000, 1px -1px 0.5px #000, -1px  1px 0.5px #000, 1px  1px 0.5px #000;`;
                html += `<td class="${cellClass}" data-colonist-id="${c.id}" data-skill="${s}" style="${cellStyle}">${display}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        return html;
    }

    _attunementGridHtml() {
        const schools = Object.keys(MAGIC_SKILLS);
        let html = '<table><tr><th>Colonist</th>';
        schools.forEach(s => { html += `<th>${MAGIC_SKILLS[s].name.substring(0, 8)}</th>`; });
        html += '</tr>';

        for (const c of this.game.colonists) {
            if (c.hp <= 0 || c.golem) continue;
            html += `<tr><td style="color:${c.nameColor || '#ffff00'}">${c.name}</td>`;
            const attuned = Array.isArray(c.attunedSchools) ? c.attunedSchools : [];
            for (const s of schools) {
                const level = (c.magicSkills && c.magicSkills[s]) || 0;
                const isAttuned = attuned.includes(s);
                const schoolColor = MAGIC_SKILLS[s].color;
                const cellStyle = isAttuned
                    ? `background-color:${schoolColor};color:#000;font-weight:bold;text-shadow:none;`
                    : 'background-color:#1a1a2e;color:#666;';
                const mark = isAttuned ? '★' : (level > 0 ? level : '-');
                html += `<td class="prio-cell" data-colonist-id="${c.id}" data-attune="${s}" title="${MAGIC_SKILLS[s].name} (level ${level})" style="${cellStyle}">${mark}</td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        return html;
    }

    toggleCraftPanel() {
        const opening = !this.craftPanelVisible;
        this._closeAllPanels();
        this.craftPanelVisible = opening;
        this._panelPause(opening);
        this.elements.craftPanel.style.display = opening ? 'block' : 'none';
        if (opening) this.updateCraftPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    updateCraftPanel() {
        if (!this._craftTab) this._craftTab = RECIPE_CATEGORIES[0];
        const recipes = getAvailableRecipes(this.game);
        const tabsContainer = this.elements.craftPanel.querySelector('.craft-tabs');
        const craftTabsScroll = tabsContainer ? tabsContainer.scrollLeft : 0;
        let html = '<div class="panel-close" data-panel-close="craft">&times;</div><h3>Crafting Orders</h3>';
        html += '<div class="craft-tabs">';
        for (const cat of RECIPE_CATEGORIES) {
            const active = cat === this._craftTab ? ' active' : '';
            html += `<button class="craft-tab${active}" data-craft-tab="${cat}">${cat}</button>`;
        }
        html += '</div>';
        const hasEquipTiers = ['Weapons', 'Armor', 'Clothing', 'Tools'].includes(this._craftTab);
        const hasTomeFilter = this._craftTab === 'Tomes';
        if (hasEquipTiers) {
            if (this._craftHiddenTiers === undefined) this._craftHiddenTiers = new Set();
            const tiers = [1, 2, 3, 4];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += '<span style="color:#888;font-size:0.82em;">Show tiers:</span>';
            for (const t of tiers) {
                const hidden = this._craftHiddenTiers.has(t);
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-tier="${t}" style="padding:1px 6px;font-size:0.82em;background:${hidden ? '#1a1a2e' : '#336633'};color:${hidden ? '#666' : '#ccc'};border:1px solid ${hidden ? '#444' : '#4a4'};border-radius:3px;cursor:pointer;">T${t}</button>`;
            }
            html += '</div>';
        }
        if (hasTomeFilter) {
            if (this._tomeSchoolFilter === undefined) this._tomeSchoolFilter = 'All';
            if (this._tomeHiddenLevels === undefined) this._tomeHiddenLevels = new Set();
            const schools = ['All', ...Object.keys(MAGIC_SKILLS)];
            const levels = [0, 1, 2, 3, 4];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += '<span style="color:#888;font-size:0.82em;">School:</span>';
            html += `<select onchange="window.game.ui._tomeSchoolFilter=this.value;window.game.ui.updateCraftPanel()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;border-radius:3px;padding:1px 4px;font-size:0.82em;">`;
            for (const s of schools) {
                const label = s === 'All' ? 'All' : MAGIC_SKILLS[s].name;
                html += `<option value="${s}"${s === this._tomeSchoolFilter ? ' selected' : ''}>${label}</option>`;
            }
            html += '</select>';
            html += '<span style="color:#888;font-size:0.82em;margin-left:6px;">Min level:</span>';
            for (const lv of levels) {
                const hidden = this._tomeHiddenLevels.has(lv);
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-tome-level="${lv}" style="padding:1px 6px;font-size:0.82em;background:${hidden ? '#1a1a2e' : '#336633'};color:${hidden ? '#666' : '#ccc'};border:1px solid ${hidden ? '#444' : '#4a4'};border-radius:3px;cursor:pointer;">${lv}</button>`;
            }
            html += '</div>';
        }
        let filtered = recipes.filter(r => (r.recipe.category || 'Materials') === this._craftTab);
        if (hasEquipTiers && this._craftHiddenTiers && this._craftHiddenTiers.size > 0) {
            filtered = filtered.filter(r => {
                const outputKey = Object.keys(r.recipe.output)[0];
                const def = WEAPONS[outputKey] || ARMORS[outputKey] || HELMETS[outputKey] || CLOTHES[outputKey] || BOOTS[outputKey] || TOOLS[outputKey];
                if (!def || def.tier === undefined) return true;
                return !this._craftHiddenTiers.has(def.tier);
            });
        }
        if (hasTomeFilter) {
            if (this._tomeSchoolFilter && this._tomeSchoolFilter !== 'All') {
                filtered = filtered.filter(r => {
                    const outputKey = Object.keys(r.recipe.output)[0];
                    const tome = SPELL_TOMES[outputKey];
                    if (!tome) return true;
                    const spell = SPELLS[tome.spell];
                    return spell && spell.school === this._tomeSchoolFilter;
                });
            }
            if (this._tomeHiddenLevels && this._tomeHiddenLevels.size > 0) {
                filtered = filtered.filter(r => {
                    const outputKey = Object.keys(r.recipe.output)[0];
                    const tome = SPELL_TOMES[outputKey];
                    if (!tome) return true;
                    return !this._tomeHiddenLevels.has(tome.minSchoolLevel);
                });
            }
        }
        if (hasEquipTiers) {
            filtered.sort((a, b) => {
                const aKey = Object.keys(a.recipe.output)[0];
                const bKey = Object.keys(b.recipe.output)[0];
                const aDef = WEAPONS[aKey] || ARMORS[aKey] || HELMETS[aKey] || CLOTHES[aKey] || BOOTS[aKey] || TOOLS[aKey];
                const bDef = WEAPONS[bKey] || ARMORS[bKey] || HELMETS[bKey] || CLOTHES[bKey] || BOOTS[bKey] || TOOLS[bKey];
                // Tier is the primary grouping; `order` arranges set pieces within
                // a tier (e.g. a helmet next to its matching body armor). Items
                // without `order` sort last within their tier but keep insertion
                // order among themselves (Array.sort is stable).
                const tierDiff = (aDef?.tier || 0) - (bDef?.tier || 0);
                if (tierDiff !== 0) return tierDiff;
                return (aDef?.order ?? Infinity) - (bDef?.order ?? Infinity);
            });
        }
        for (const { key, recipe, canCraft, hasStation } of filtered) {
            const inputStr = Object.entries(recipe.input).map(([k, v]) => {
                if (k === 'foodstuffs') return `${v} foodstuffs (have ${this.game.resources.getFoodstuffTotal()})`;
                return `${k}:${v}`;
            }).join(' + ');
            const outputStr = Object.entries(recipe.output).map(([k, v]) => {
                const tip = this.getCraftOutputTip(k);
                if (tip) return `${this._itemIcon(k)}<span class="skill-tip" data-tip="${tip}">${k.replace(/_/g, ' ')}${v > 1 ? ':' + v : ''}</span>`;
                return `${k}:${v}`;
            }).join('+');
            const cls = canCraft ? 'craft-available' : 'craft-unavailable';
            const ct = this.game.settings.craftTargets[key] || {};
            const repeatCls = ct.repeat ? 'craft-repeat active' : 'craft-repeat';
            html += `<div class="craft-row ${cls}">`;
            html += `<button ${canCraft ? '' : 'disabled'} onclick="window.game.craft('${key}')">${key.replace(/_/g, ' ')}</button>`;
            html += `<button ${canCraft ? '' : 'disabled'} onclick="window.game.craftMultiple('${key}',5)" class="craft-multi">x5</button>`;
            html += `<button onclick="window.game.toggleCraftRepeat('${key}')" class="craft-multi ${repeatCls}" title="Auto-repeat">&#x27F3;</button>`;
            html += `<input type="number" min="0" max="999" value="${ct.target || 0}" onchange="window.game.setCraftTarget('${key}',this.value)" title="Maintain stock target (0=off)" style="width:35px;background:#1a1a2e;color:#ccc;border:1px solid #444;border-radius:3px;padding:1px 2px;text-align:center;font-size:0.85em;">`;
            html += `<span>${inputStr} → ${outputStr}</span>`;
            if (!hasStation) {
                const stationName = (recipe.station || 'workbench').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                html += `<span style="color:#ff4444;font-size:0.85em;margin-left:auto;">Needs ${stationName}</span>`;
            }
            html += `</div>`;
        }
        if (filtered.length === 0) {
            html += '<div style="color:#666; padding:8px;">No recipes available in this category.</div>';
        }
        if (this._craftTab === 'Food & Potions') {
            const target = this.game.settings.autoCookTarget || 0;
            html += '<div style="margin-top:12px; padding-top:8px; border-top:1px solid #444;">';
            html += `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">`;
            html += `<label style="color:#ccc; white-space:nowrap;">Auto-cook target:</label>`;
            html += `<div style="display:flex; align-items:center; gap:2px;">`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-10)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">-10</button>`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-1)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">-1</button>`;
            html += `<input type="number" id="set-autocook" min="0" max="200" value="${target}" onchange="window.game.setAutoCookTarget(parseInt(this.value)||0)" style="width:45px;text-align:center;background:#1a1a2e;color:#88cc88;border:1px solid #555;border-radius:3px;padding:2px;font-weight:bold;">`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+1)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">+1</button>`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+10)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">+10</button>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div style="color:#777; font-size:0.83em; margin-top:4px;">Automatically queues cooking when food drops below target. Set 0 to disable.</div>`;
            html += '</div>';
        }
        if (html !== this._lastCraftHtml) {
            this._lastCraftHtml = html;
            this.elements.craftPanel.innerHTML = html;
            const newTabsContainer = this.elements.craftPanel.querySelector('.craft-tabs');
            if (newTabsContainer) {
                newTabsContainer.scrollLeft = craftTabsScroll;
            }
        }
    }

    updateColonistHud() {
        const colonists = this.game.colonists.filter(c => !c.golem);
        const golems = this.game.colonists.filter(c => c.golem);

        let html = '<div class="footer-panel-header">Colonists</div>';
        // Show alive colonists first, dead at the bottom
        const sorted = [...colonists].sort((a, b) => (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0));
        for (const c of sorted) {
            if (c.hp <= 0) {
                html += `<div class="hud-colonist dead"><span class="hud-name" style="color:${c.nameColor || '#ffff00'}">${c.name}</span> <span style="color:#cc4444">DEAD</span></div>`;
                continue;
            }
            if (c.onExpedition) {
                html += `<div class="hud-colonist" data-colonist-id="${c.id}"><span class="hud-name" style="color:${c.nameColor || '#ffff00'}">${c.name}</span> <span style="color:#33ccff">EXPLORING</span></div>`;
                continue;
            }
            const moodLevel = getMoodLabel(c.mood);
            const moodColor = moodLevel === 'inspired' ? '#66ffcc' : moodLevel === 'content' ? '#88cc88' : moodLevel === 'stressed' ? '#cccc44' : '#ff4444';
            const hungerColor = statColor(c.needs.hunger);
            const restColor = statColor(c.needs.rest);
            const hpColor = statColor(c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 100);
            const weaponIcon = c.weapon ? this._itemIcon(c.weapon.key, 'weapon') : '';
            const weapon = c.weapon?.name || 'Fists';
            html += `<div class="hud-colonist" data-colonist-id="${c.id}">`;
            const needsDots = `<span class="hud-dots"><span style="color:${moodColor}">●</span><span style="color:${hungerColor}">●</span><span style="color:${restColor}">●</span><span style="color:${hpColor}">●</span></span>`;
            const fatigueTag = this.game.exploration?.isFatigued(c.id, this.game.tick) ? ' <span style="color:#ff6644">[Fatigued]</span>' : '';
            html += `<span class="hud-name" style="color:${c.nameColor || '#ffff00'}">${c.name}</span> ${needsDots} <span class="hud-weapon">${weaponIcon}${weapon}</span> <span class="hud-state">${c.state}${c._relaxActivity ? ' [relaxing]' : ''}${c.drafted ? ' [D]' : ''}${c.guardMode ? ' [G]' : ''}${fatigueTag}</span>`;
            html += `<div class="hud-bars">Mood: <span style="color:${moodColor}">${c.mood.toFixed(0)} (${moodLevel})</span> | Hunger: <span style="color:${hungerColor}">${c.needs.hunger.toFixed(0)}</span> | Rest: <span style="color:${restColor}">${c.needs.rest.toFixed(0)}</span> | HP: <span style="color:${hpColor}">${Math.round(c.hp)}/${c.maxHp}</span></div>`;
            html += `</div>`;
        }

        if (golems.length > 0) {
            html += '<div class="footer-panel-header" style="margin-top: 12px;">Golems</div>';
            const sortedGolems = [...golems].sort((a, b) => (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0));
            for (const g of sortedGolems) {
                if (g.hp <= 0) {
                    html += `<div class="hud-colonist dead"><span class="hud-name" style="color:${g.nameColor || '#ffff00'}">${g.name}</span> <span style="color:#cc4444">DESTROYED</span></div>`;
                    continue;
                }
                if (g.onExpedition) {
                    html += `<div class="hud-colonist" data-colonist-id="${g.id}"><span class="hud-name" style="color:${g.nameColor || '#ffff00'}">${g.name}</span> <span style="color:#33ccff">EXPLORING</span></div>`;
                    continue;
                }
                const hpColor = statColor(g.maxHp > 0 ? (g.hp / g.maxHp) * 100 : 100);
                const weaponIcon = g.weapon ? this._itemIcon(g.weapon.key, 'weapon') : '';
                const weapon = g.weapon?.name || 'None';
                html += `<div class="hud-colonist" data-colonist-id="${g.id}">`;
                html += `<span class="hud-name" style="color:${g.nameColor || '#ffff00'}">${g.name}</span> <span class="hud-dots"><span style="color:${hpColor}">●</span></span> <span class="hud-weapon">${weaponIcon}${weapon}</span> <span class="hud-state">${g.state}${g.drafted ? ' [D]' : ''}</span>`;
                html += `<div class="hud-bars">HP: <span style="color:${hpColor}">${Math.round(g.hp)}/${g.maxHp}</span></div>`;
                html += `</div>`;
            }
        }

        if (html !== this._lastHudHtml) {
            this._lastHudHtml = html;
            if (this._colonistHudHovered) {
                this._pendingHudHtml = html;
            } else {
                this.elements.colonistHud.innerHTML = html;
                this._pendingHudHtml = null;
            }
        }
    }

    toggleEventLog() {}

    updateEventLog() {
        const entries = this.game.eventLog.getRecent(10);
        let html = '<div class="footer-panel-header">Event Log</div>';
        if (entries.length === 0) {
            html += '<div class="event-log-row" style="color:#666">No events yet.</div>';
        }
        for (let i = entries.length - 1; i >= 0; i--) {
            const e = entries[i];
            const colorStyle = e.type === 'danger' ? 'color:#ff6666' : e.type === 'success' ? 'color:#66ff66' : 'color:#ffcc44';
            if (e.linkedEntity) {
                const entityJson = JSON.stringify(e.linkedEntity).replace(/"/g, '&quot;');
                html += `<div class="event-log-row" style="cursor:pointer;${colorStyle}" data-entity="${entityJson}">`;
            } else {
                html += `<div class="event-log-row" style="${colorStyle}">`;
            }
            html += `<span class="event-log-time">[${e.time}]</span> ${e.text}`;
            html += `</div>`;
        }
        if (html !== this._lastEventLogHtml) {
            this._lastEventLogHtml = html;
            this.elements.eventLog.innerHTML = html;
        }
    }

    toggleInventoryPanel() {
        const opening = !this.inventoryVisible;
        this._closeAllPanels();
        this.inventoryVisible = opening;
        this._panelPause(opening);
        this.elements.inventoryPanel.style.display = opening ? 'block' : 'none';
        if (opening) this.updateInventoryPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    updateInventoryPanel() {
        const activeTab = this._invTab || 'resources';
        const r = this.game.resources.stockpile;
        const weapons = this.game.resources.weapons;
        const armors = this.game.resources.armors;
        const tools = this.game.resources.tools;
        const trinkets = this.game.resources.trinkets;
        const potions = this.game.resources.potions;
        const tomes = this.game.resources.tomes;
        const consumables = this.game.resources.consumables;
        const tamed = this.game.entities.filter(e => e.tamed);

        const helmets = this.game.resources.helmets;
        const clothes = this.game.resources.clothes;
        const boots = this.game.resources.boots;
        const equipCount = weapons.length + armors.length + helmets.length + clothes.length + tools.length + boots.length + trinkets.length;
        const consumeCount = potions.length + tomes.length;

        let html = '<div class="panel-close" data-panel-close="inventory">&times;</div><h3>Inventory</h3>';

        html += '<div class="inv-tabs">';
        html += `<button class="inv-tab-btn${activeTab === 'resources' ? ' active' : ''}" data-inv-tab="resources">Resources</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'equipment' ? ' active' : ''}" data-inv-tab="equipment">Equipment${equipCount ? ` (${equipCount})` : ''}</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'consumables' ? ' active' : ''}" data-inv-tab="consumables">Consumables${consumeCount ? ` (${consumeCount})` : ''}</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'animals' ? ' active' : ''}" data-inv-tab="animals">Animals${tamed.length ? ` (${tamed.length})` : ''}</button>`;
        html += '</div>';

        html += '<div class="inv-tab-content">';
        if (activeTab === 'resources') {
            html += this._buildInvResources(r);
        } else if (activeTab === 'equipment') {
            html += this._buildInvEquipment(weapons, armors, helmets, clothes, tools, boots, trinkets);
        } else if (activeTab === 'consumables') {
            html += this._buildInvConsumables(potions, tomes, consumables);
        } else if (activeTab === 'animals') {
            html += this._buildInvAnimals(tamed);
        }
        html += '</div>';

        if (html !== this._lastInvHtml) {
            this._lastInvHtml = html;
            this.elements.inventoryPanel.innerHTML = html;
        }
    }

    _buildInvResources(r) {
        let html = '';
        const foodChestCount = this.game.mapIndex ? this.game.mapIndex.getStructurePositions('food_chest').size : 0;
        const iceBoxCount = this.game.mapIndex ? this.game.mapIndex.getStructurePositions('ice_box').size : 0;
        const noPower = this.game.power && !this.game.power.powered;
        if (foodChestCount > 0 || iceBoxCount > 0) {
            let reduction = Math.min(0.6, foodChestCount * 0.15);
            if (!noPower) reduction += iceBoxCount * 0.4;
            reduction = Math.min(0.9, reduction);
            const pct = Math.round(reduction * 100);
            const seasonLabel = this.game.weather.season === 'summer' ? ' (summer +50% rot)' : this.game.weather.season === 'winter' ? ' (winter -50% rot)' : '';
            html += `<div class="info-row" style="color:#aa8844;font-size:0.9em;">Food preservation: -${pct}% spoilage${seasonLabel}</div>`;
        }

        const buildingMats = ['wood', 'stone', 'planks', 'bricks', 'hides', 'leather', 'iron_ore', 'iron', 'runite', 'wool', 'cotton', 'cloth', 'void_essence'];
        const foodKeys = [...FOODSTUFFS, 'food'];
        const reserved = this.game.resources.reservedFoodstuffs;

        const buildingEntries = Object.entries(r).filter(([k, v]) => v > 0 && buildingMats.includes(k));
        const foodEntries = Object.entries(r).filter(([k, v]) => v > 0 && foodKeys.includes(k));
        const otherEntries = Object.entries(r).filter(([k, v]) => v > 0 && !buildingMats.includes(k) && !foodKeys.includes(k));

        if (buildingEntries.length > 0) {
            html += '<div class="info-row" style="color:#aa8844;margin-bottom:4px;"><b>Building Materials</b></div>';
            for (const [key, amount] of buildingEntries) {
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${key.replace(/_/g, ' ')}</span><span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (foodEntries.length > 0) {
            html += '<div class="info-row" style="color:#66aa44;margin-top:8px;margin-bottom:4px;"><b>Foodstuffs</b></div>';
            for (const [key, amount] of foodEntries) {
                const isFood = FOODSTUFFS.includes(key);
                const isReserved = reserved[key];
                let extra = '';
                if (isFood) {
                    const cls = isReserved ? 'inv-reserve active' : 'inv-reserve';
                    extra = `<button class="${cls}" data-reserve-food="${key}" title="${isReserved ? 'Unreserve — allow cooking' : 'Reserve — protect from cooking'}">${isReserved ? '🔒' : '🔓'}</button>`;
                }
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${key.replace(/_/g, ' ')}</span>${extra}<span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (otherEntries.length > 0) {
            html += '<div class="info-row" style="color:#8888cc;margin-top:8px;margin-bottom:4px;"><b>Other</b></div>';
            for (const [key, amount] of otherEntries) {
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${key.replace(/_/g, ' ')}</span><span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (!html) html = '<div class="info-row" style="color:#666;">No resources.</div>';
        return html;
    }

    _qualityColor(item) {
        if (!item.quality) return '#cccccc';
        const colors = { poor: '#888888', fine: '#44cc44', superior: '#4488ff' };
        return colors[item.quality] || '#cccccc';
    }

    _enchantmentGlow(item) {
        return item.enchantment ? ' enchanted-text' : '';
    }

    _getBuildingSpriteURL(buildingKey) {
        if (!this._buildingSpriteCache) this._buildingSpriteCache = new Map();
        if (this._buildingSpriteCache.has(buildingKey)) return this._buildingSpriteCache.get(buildingKey);
        const sprite = this.game.skinManager.getSprite('buildings', buildingKey);
        if (!sprite) { this._buildingSpriteCache.set(buildingKey, null); return null; }
        const c = document.createElement('canvas');
        c.width = sprite.width || sprite.naturalWidth || 16;
        c.height = sprite.height || sprite.naturalHeight || 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(sprite, 0, 0);
        const url = c.toDataURL('image/png');
        this._buildingSpriteCache.set(buildingKey, url);
        return url;
    }

    _buildCostChip(key, amount) {
        const colors = {
            wood: '#8b6b3a', stone: '#999', food: '#88cc44', planks: '#c89648',
            bricks: '#cc6633', iron_ore: '#887766', iron: '#aaa', runite: '#44ccff',
            void_essence: '#9933ff', hides: '#8b7355', leather: '#a0522d',
            gold: '#ffdd00',
        };
        const abbr = {
            wood: 'W', stone: 'S', food: 'F', planks: 'P', bricks: 'Bk',
            iron_ore: 'Or', iron: 'Fe', runite: 'Ru', leather: 'Le',
            void_essence: 'Ve', hides: 'Hi', gold: 'Au',
        };
        const color = colors[key] || '#aaa';
        const label = abbr[key] || key.charAt(0).toUpperCase();
        return `<span class="cost-chip" style="color:${color}">${label}${amount}</span>`;
    }

    _showBuildTooltip(card, e) {
        const buildType = card.dataset.buildOpt;
        const def = BUILDINGS[buildType];
        if (!def) return;
        let html = `<div class="build-tip-name">${buildType.replace(/_/g, ' ')}</div>`;
        html += `<div class="build-tip-desc">${def.description || ''}</div>`;
        if (def.research) {
            const unlocked = this.game.research.isResearched(def.research);
            html += `<div class="build-tip-meta" style="color:${unlocked ? '#66cc66' : '#cc6666'}">Research: ${def.research.replace(/_/g, ' ')}${unlocked ? ' (done)' : ''}</div>`;
        }
        if (def.power) {
            if (def.power.generates) html += `<div class="build-tip-meta" style="color:#aa44ff">Generates ${def.power.generates} mana</div>`;
            if (def.power.consumes) html += `<div class="build-tip-meta" style="color:#ff8844">Consumes ${def.power.consumes} mana</div>`;
            if (def.power.damage) html += `<div class="build-tip-meta" style="color:#ff4444">Damage: ${def.power.damage} (range ${def.power.range || '?'})</div>`;
        }
        if (def.maxCount) {
            html += `<div class="build-tip-meta" style="color:#aaa">Max: ${def.maxCount + getMaxCountBonus(def, buildType, this.game)}</div>`;
        }
        this._buildTooltip.innerHTML = html;
        this._buildTooltip.style.display = 'block';
        if (e) this._positionBuildTooltip(e);
        else {
            const rect = card.getBoundingClientRect();
            this._buildTooltip.style.left = rect.left + 'px';
            this._buildTooltip.style.top = (rect.bottom + 4) + 'px';
        }
    }

    _hideBuildTooltip() {
        if (this._buildTooltip) this._buildTooltip.style.display = 'none';
    }

    _positionBuildTooltip(e) {
        const tt = this._buildTooltip;
        const x = (e.clientX || 0) + 12;
        const y = (e.clientY || 0) - tt.offsetHeight - 8;
        tt.style.left = Math.min(x, window.innerWidth - tt.offsetWidth - 8) + 'px';
        tt.style.top = Math.max(y, 4) + 'px';
    }

    _buildInvEquipment(weapons, armors, helmets, clothes, tools, boots, trinkets) {
        let html = '';
        if (weapons.length > 0) {
            html += '<div class="info-row" style="color:#cc8888;margin-bottom:4px;"><b>Weapons:</b></div>';
            weapons.forEach((w, i) => {
                const extras = getItemStatLines({ ...w, damage: undefined });
                const cd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
                let stats = `${w.damage}d (${(w.damage / cd).toFixed(1)} dps)`;
                if (extras.length) stats += `, ${extras.join(', ')}`;
                const tip = w.description || '';
                const wec = ENCHANT_COST_BY_TIER[w.tier] ?? { resource: 'runite', amount: 5 };
                const wecLabel = `${wec.amount} ${wec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(w)}" data-tip="${tip}" style="color:${this._qualityColor(w)}">${this._itemIcon(w.key, 'weapon')}${w.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${w.name.replace(/'/g, "\\\\'")} for ${wecLabel}?')){window.game.enchantWeapon(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${w.name.replace(/'/g, "\\\\'")}?')){window.game.discardWeapon(${i})}">♻</button></div>`;
            });
        }
        if (armors.length > 0) {
            html += '<div class="info-row" style="color:#9966cc;margin-top:8px;margin-bottom:4px;"><b>Armor:</b></div>';
            armors.forEach((a, i) => {
                const stats = getItemStatLines(a).join(', ');
                const tip = a.description || '';
                const aec = ENCHANT_COST_BY_TIER[a.tier] ?? { resource: 'runite', amount: 5 };
                const aecLabel = `${aec.amount} ${aec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(a)}" data-tip="${tip}" style="color:${this._qualityColor(a)}">${this._itemIcon(a.key, 'armor')}${a.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${a.name.replace(/'/g, "\\\\'")} for ${aecLabel}?')){window.game.enchantArmor(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${a.name.replace(/'/g, "\\\\'")}?')){window.game.discardArmor(${i})}">♻</button></div>`;
            });
        }
        if (helmets.length > 0) {
            html += '<div class="info-row" style="color:#7799cc;margin-top:8px;margin-bottom:4px;"><b>Helmets:</b></div>';
            helmets.forEach((h, i) => {
                const stats = getItemStatLines(h).join(', ');
                const tip = h.description || '';
                const hec = ENCHANT_COST_BY_TIER[h.tier] ?? { resource: 'runite', amount: 5 };
                const hecLabel = `${hec.amount} ${hec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(h)}" data-tip="${tip}" style="color:${this._qualityColor(h)}">${this._itemIcon(h.key, 'helmet')}${h.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${h.name.replace(/'/g, "\\\\'")} for ${hecLabel}?')){window.game.enchantHelmet(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${h.name.replace(/'/g, "\\\\'")}?')){window.game.discardHelmet(${i})}">♻</button></div>`;
            });
        }
        if (boots.length > 0) {
            html += '<div class="info-row" style="color:#aa8855;margin-top:8px;margin-bottom:4px;"><b>Boots:</b></div>';
            boots.forEach((b, i) => {
                const stats = getItemStatLines(b).join(', ');
                const tip = b.description || '';
                const bec = ENCHANT_COST_BY_TIER[b.tier] ?? { resource: 'runite', amount: 5 };
                const becLabel = `${bec.amount} ${bec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(b)}" data-tip="${tip}" style="color:${this._qualityColor(b)}">${this._itemIcon(b.key, 'boots')}${b.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${b.name.replace(/'/g, "\\\\'")} for ${becLabel}?')){window.game.enchantBoots(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${b.name.replace(/'/g, "\\\\'")}?')){window.game.discardBoots(${i})}">♻</button></div>`;
            });
        }
        if (clothes.length > 0) {
            html += '<div class="info-row" style="color:#cc8866;margin-top:8px;margin-bottom:4px;"><b>Clothes:</b></div>';
            clothes.forEach((c, i) => {
                const stats = getItemStatLines(c).join(', ');
                const tip = c.description || '';
                const cec = ENCHANT_COST_BY_TIER[c.tier] ?? { resource: 'runite', amount: 5 };
                const cecLabel = `${cec.amount} ${cec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(c)}" data-tip="${tip}" style="color:${this._qualityColor(c)}">${this._itemIcon(c.key, 'clothes')}${c.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${c.name.replace(/'/g, "\\\\'")} for ${cecLabel}?')){window.game.enchantClothes(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${c.name.replace(/'/g, "\\\\'")}?')){window.game.discardClothes(${i})}">♻</button></div>`;
            });
        }
        if (tools.length > 0) {
            html += '<div class="info-row" style="color:#88aacc;margin-top:8px;margin-bottom:4px;"><b>Tools:</b></div>';
            tools.forEach((t, i) => {
                const stats = getItemStatLines(t).join(', ');
                const tip = t.description || '';
                const tec = ENCHANT_COST_BY_TIER[t.tier] ?? { resource: 'runite', amount: 5 };
                const tecLabel = `${tec.amount} ${tec.resource.replace(/_/g, ' ')}`;
                html += `<div class="inv-row"><span class="inv-name skill-tip ${this._enchantmentGlow(t)}" data-tip="${tip}" style="color:${this._qualityColor(t)}">${this._itemIcon(t.key, 'tool')}${t.name}</span>
                        <span class="inv-amount">${stats}</span>
                        <button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert('Arcane Infusion is required before you can Enchant your equipment!');}else if(confirm('Enchant ${t.name.replace(/'/g, "\\\\'")} for ${tecLabel}?')){window.game.enchantTool(${i});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm('Salvage ${t.name.replace(/'/g, "\\\\'")}?')){window.game.discardTool(${i})}">♻</button></div>`;
            });
        }
        if (trinkets.length > 0) {
            html += '<div class="info-row" style="color:#ccaa44;margin-top:8px;margin-bottom:4px;"><b>Trinkets:</b></div>';
            trinkets.forEach((a, i) => {
                const tip = this._getTrinketTooltip(a);
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${tip}" style="color:${a.textColor || "#d3d597"}">${this._itemIcon(a.key, 'trinket')}${a.name}</span><button class="inv-delete" onclick="if(confirm('Salvage ${a.name.replace(/'/g, "\\\\'")}?')){window.game.discardTrinket(${i})}">♻</button></div>`;
            });
        }
        if (!html) html = '<div class="info-row" style="color:#666;">No equipment in storage.</div>';
        return html;
    }

    _buildInvConsumables(potions, tomes, consumables) {
        let html = '';
        if (consumables && consumables.length > 0) {
            html += '<div class="info-row" style="color:#aa44ff;margin-bottom:4px;"><b>Usable Items:</b></div>';
            for (let i = 0; i < consumables.length; i++) {
                const c = consumables[i];
                const def = ALL_ITEMS[c.key];
                const desc = def?.description || '';
                const icon = this._itemIcon(c.key);
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${desc}">${icon}${c.name}</span><button class="inv-use" onclick="window.game.useConsumable(${i})">Use</button></div>`;
            }
        }
        if (potions.length > 0) {
            html += '<div class="info-row" style="color:#cc88aa;margin-top:8px;margin-bottom:4px;"><b>Potions:</b> <span style="color:#666;font-size:0.8em;margin-left:4px;">Auto-use by colonists</span></div>';
            const potionCounts = countByKey(potions, p => p.key ?? p.type);
            for (const [type, count] of Object.entries(potionCounts)) {
                const def = POTIONS[type];
                const potionTip = this.getCraftOutputTip(type) || '';
                const autoUse = this.game.settings.potionAutoUse || {};
                const isEnabled = autoUse[type] !== false;
                html += `<div class="inv-row" style="display:flex;align-items:center;gap:6px;">`;
                html += `<span class="inv-name skill-tip" data-tip="${potionTip}" style="flex:1;">${this._itemIcon(type, 'potion')}${def ? def.name : type}</span>`;
                html += `<span class="inv-amount">x${count}</span>`;
                html += `<label style="display:flex;align-items:center;gap:3px;font-size:0.8em;color:#aaa;white-space:nowrap;cursor:pointer;" title="Allow colonists to auto-use this potion">`;
                html += `<input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.game.setPotionAutoUse('${type}', this.checked)" style="cursor:pointer;accent-color:#44cc88;">`;
                html += `</label>`;
                html += `</div>`;
            }
        }
        if (tomes.length > 0) {
            html += '<div class="info-row" style="color:#bb88ff;margin-top:8px;margin-bottom:4px;"><b>Spell Tomes:</b></div>';
            const tomeCounts = countByKey(tomes, t => t.key);
            for (const [key, count] of Object.entries(tomeCounts)) {
                const def = SPELL_TOMES[key];
                const spell = def ? SPELLS[def.spell] : null;
                const schoolName = spell ? MAGIC_SKILLS[spell.school]?.name : '';
                const tomeTip = this.getCraftOutputTip(key) || '';
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${tomeTip}">${this._itemIcon(key, 'tome')}${def ? def.name : key}</span><span class="inv-amount">x${count}${schoolName ? ` (${schoolName})` : ''}</span></div>`;
            }
        }
        if (!html) html = '<div class="info-row" style="color:#666;">No consumables.</div>';
        return html;
    }

    _buildInvAnimals(tamed) {
        let html = '';
        if (tamed.length > 0) {
            const counts = countByKey(tamed, a => a.type);
            for (const [type, count] of Object.entries(counts)) {
                const def = TAMED_ANIMALS[type];
                let role = def.produces ? `produces: ${def.produces}` : def.packAnimal ? 'pack animal' : def.happinessAura ? 'happiness aura' : def.guardAnimal ? 'guard' : '';
                html += `<div class="inv-row"><span class="inv-name">${type}</span><span class="inv-amount">x${count}${role ? ` (${role})` : ''}</span></div>`;
            }
        }
        if (!html) html = '<div class="info-row" style="color:#666;">No tamed animals.</div>';
        return html;
    }

    toggleSettingsPanel() {
        const opening = !this.settingsPanelVisible;
        this._closeAllPanels();
        this.settingsPanelVisible = opening;
        this._panelPause(opening);
        this.elements.settingsPanel.style.display = opening ? 'block' : 'none';
        if (opening) this.updateSettingsPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    populateSkinDropdown() {
        const el = document.getElementById('set-skin');
        if (!el) return;
        const skinNames = this.game.skinManager.getSkinNames();
        el.innerHTML = '';
        for (const name of skinNames) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name === 'ascii' ? 'ASCII' : name.charAt(0).toUpperCase() + name.slice(1);
            opt.selected = this.game.settings.activeSkin === name;
            el.appendChild(opt);
        }
    }

    updateSettingsPanel() {
        const s = this.game.settings;
        if (!this._settingsTab) this._settingsTab = 'general';
        const tab = this._settingsTab;
        let html = '<div class="panel-close" data-panel-close="settings">&times;</div><h3>Settings</h3>';

        // Tab bar (General / Graphics / Controls)
        const tabs = [['general', 'General'], ['graphics', 'Graphics'], ['controls', 'Controls']];
        html += `<div class="settings-tabs" style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #444;">`;
        for (const [key, label] of tabs) {
            const active = tab === key;
            html += `<button onclick="window.game.ui._setSettingsTab('${key}')" class="settings-tab-btn${active ? ' active' : ''}" style="flex:1;padding:5px 8px;background:${active ? '#2a2a4e' : '#16162a'};color:${active ? '#ffcc00' : '#999'};border:1px solid #444;border-bottom:none;border-radius:4px 4px 0 0;cursor:pointer;font-family:inherit;font-size:inherit;">${label}</button>`;
        }
        html += `</div>`;

        // ===== GENERAL TAB =====
        let general = '';
        general += `<div class="settings-section"><div class="settings-section-title">Save / Load</div>`;
        general += `<div class="settings-row" style="gap:8px;">`;
        general += `<button onclick="window.game.save()" class="settings-btn settings-btn-green">Save Game</button>`;
        general += `<button onclick="window.game.exportSave()" class="settings-btn settings-btn-blue">Export Save</button>`;
        general += `</div></div>`;

        general += `<div class="settings-section"><button onclick="window.game.showGlossary()" class="settings-btn settings-btn-purple">View Glossary</button></div>`;

        // ===== GRAPHICS TAB =====
        let graphics = '';
        graphics += `<div class="settings-section"><div class="settings-section-title">Visual</div>`;
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-skin">Tile Skin:</label>`;
        graphics += `<select id="set-skin" onchange="window.game.switchSkin(this.value)" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        const skinNames = this.game.skinManager.getSkinNames();
        for (const name of skinNames) {
            const display = name === 'ascii' ? 'ASCII' : name.charAt(0).toUpperCase() + name.slice(1);
            graphics += `<option value="${name}" ${s.activeSkin === name ? 'selected' : ''}>${display}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-names">Colonist names:</label>`;
        graphics += `<select id="set-names" onchange="window.game.settings.showColonistNames=this.value" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        for (const val of ['off', 'selected', 'always']) {
            graphics += `<option value="${val}" ${s.showColonistNames === val ? 'selected' : ''}>${val.charAt(0).toUpperCase() + val.slice(1)}</option>`;
        }
        graphics += `</select></div>`;
        const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1;
        const uiScaleLabel = uiScale <= 0.8 ? 'Small' : uiScale >= 1.2 ? 'Large' : 'Medium';
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-ui-font-size">UI Font Size: <span id="ui-font-size-val">${uiScaleLabel}</span></label>`;
        graphics += `<input type="range" id="set-ui-font-size" min="0.75" max="1.4" step="0.05" value="${uiScale}" style="width:80px" oninput="const lbl=this.value<=0.8?'Small':this.value>=1.2?'Large':'Medium';document.getElementById('ui-font-size-val').textContent=lbl;window.setUIFontScale(this.value);window.game.settings.uiFontScale=parseFloat(this.value);window.game.saveSettingsToStorage()">`;
        graphics += `</div>`;
        graphics += `<div class="settings-row"><label for="set-temp-unit">Temperature unit:</label><select id="set-temp-unit" onchange="window.game.settings.temperatureUnit=this.value" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['F','Fahrenheit (°F)'],['C','Celsius (°C)']]) {
            graphics += `<option value="${val}"${s.temperatureUnit === val ? ' selected' : ''}>${label}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `</div>`;

        general += `<div class="settings-section"><div class="settings-section-title">Audio</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-music-vol">Music Volume: <span id="music-vol-val">${s.musicVolume}</span></label>`;
        general += `<input type="range" id="set-music-vol" min="0" max="100" value="${s.musicVolume}" style="width:80px" oninput="document.getElementById('music-vol-val').textContent=this.value;window.game.settings.musicVolume=parseInt(this.value);if(window.soundManager)window.soundManager.setMusicVolume(parseInt(this.value))">`;
        general += `</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-sfx-vol">SFX Volume: <span id="sfx-vol-val">${s.sfxVolume}</span></label>`;
        general += `<input type="range" id="set-sfx-vol" min="0" max="100" value="${s.sfxVolume}" style="width:80px" oninput="document.getElementById('sfx-vol-val').textContent=this.value;window.game.settings.sfxVolume=parseInt(this.value);if(window.soundManager)window.soundManager.setSFXVolume(parseInt(this.value))">`;
        general += `</div></div>`;

        general += `<div class="settings-section"><div class="settings-section-title">Gameplay</div>`;
        general += `<div class="settings-row" style="gap:4px;">`;
        general += `<label>Auto-cook target:</label>`;
        general += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-10)" style="padding:1px 5px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;">-10</button>`;
        general += `<input type="number" min="0" max="200" value="${s.autoCookTarget||0}" onchange="window.game.setAutoCookTarget(parseInt(this.value)||0)" style="width:42px;text-align:center;background:#1a1a2e;color:#88cc88;border:1px solid #555;border-radius:3px;padding:1px;">`;
        general += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+10)" style="padding:1px 5px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;">+10</button>`;
        general += `</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-autosave">Auto-save interval:</label>`;
        general += `<select id="set-autosave" onchange="window.game.settings.autoSaveInterval=parseInt(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        for (const [val, label] of [[0, 'Off'], [12, 'Every 12 hours'], [24, 'Every 24 hours'], [48, 'Every 48 hours']]) {
            general += `<option value="${val}" ${s.autoSaveInterval === val ? 'selected' : ''}>${label}</option>`;
        }
        general += `</select></div>`;
        general += this._settingsCheck('set-pause-hostile', s.autoPauseHostile, 'window.game.settings.autoPauseHostile=this.checked', 'Auto-pause on hostile event (raids)');
        general += this._settingsCheck('set-pause-event', s.autoPauseEvent, 'window.game.settings.autoPauseEvent=this.checked', 'Auto-pause on choice events (wanderers, caravans)');
        general += this._settingsCheck('set-pause-death', s.pauseOnDeath, 'window.game.settings.pauseOnDeath=this.checked', 'Auto-pause on colonist death');
        general += this._settingsCheck('set-pause-research', s.pauseOnResearch, 'window.game.settings.pauseOnResearch=this.checked', 'Auto-pause on research complete');
        general += this._settingsCheck('set-peaceful', CONFIG.PEACEFUL_MODE, 'window.game.togglePeaceful()', 'Peaceful mode (no raids/hostile animals)');
        general += this._settingsCheck('set-tutorial', s.showTutorial, 'window.game.settings.showTutorial=this.checked;window.game.saveSettingsToStorage();window.game.ui.updateTutorialNote(window.game)', 'Show tutorial hints');
        general += `</div>`;

        general += `<div class="settings-section"><div class="settings-section-title">Accessibility</div>`;
        general += this._settingsCheck('set-darken-pause', s.darkenOnPause, 'window.game.settings.darkenOnPause=this.checked;if(window.game.paused)document.getElementById("game").classList.toggle("paused",this.checked)', 'Darken screen when paused');
        general += this._settingsCheck('set-pause-focus', s.pauseOnFocusLoss, 'window.game.settings.pauseOnFocusLoss=this.checked', 'Pause when window loses focus');
        general += `<div class="settings-row"><label for="set-toolbar-mode">Mobile button bar:</label><select id="set-toolbar-mode" onchange="window.game.settings.toolbarMode=this.value;const tb=document.getElementById('touch-toolbar');if(this.value==='always')tb.style.display='flex';else if(this.value==='never')tb.style.display='none';else tb.style.display='';window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['auto','Auto'],['always','Always'],['never','Never']]) {
            general += `<option value="${val}"${(s.toolbarMode || 'auto') === val ? ' selected' : ''}>${label}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-layout-mode">Layout mode:</label><select id="set-layout-mode" onchange="window.game.setLayoutMode(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['auto','Auto (detect screen size)'],['separate','Separate'],['tabbed','Tabbed']]) {
            general += `<option value="${val}"${s.layoutMode === val ? ' selected' : ''}>${label}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-notif-dur">Notification duration:</label><select id="set-notif-dur" onchange="window.game.settings.notificationDuration=parseInt(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['50','Short (50 ticks)'],['100','Normal (100 ticks)'],['200','Long (200 ticks)'],['500','Persistent (500 ticks)']]) {
            general += `<option value="${val}"${s.notificationDuration === parseInt(val) ? ' selected' : ''}>${label}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-colorblind">Colorblind mode:</label><select id="set-colorblind" onchange="window.game.settings.colorblindMode=this.value;document.getElementById('game-container').setAttribute('data-colorblind',this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['none','None'],['protanopia','Protanopia (red-blind)'],['deuteranopia','Deuteranopia (green-blind)'],['tritanopia','Tritanopia (blue-blind)']]) {
            general += `<option value="${val}"${s.colorblindMode === val ? ' selected' : ''}>${label}</option>`;
        }
        general += `</select></div>`;
        general += this._settingsCheck('set-colonist-highlight', s.showColonistHighlight, 'window.game.settings.showColonistHighlight=this.checked;window.game.renderer?.skinManager?._compositeCache.clear()', 'Show colonist color outline (sprite mode)');
        general += this._settingsCheck('set-large-clicks', s.largeClickTargets, 'window.game.settings.largeClickTargets=this.checked;document.getElementById("game-container").classList.toggle("large-targets",this.checked)', 'Larger click targets (buttons & checkboxes)');
        graphics += `<div class="settings-section"><div class="settings-section-title">Effects & Performance</div>`;
        graphics += this._settingsCheck('set-overlays', s.showOverlays, 'window.game.ui._toggleAllEffects(this.checked)', 'Master toggle: all combat/overlay effects');
        graphics += this._settingsCheck('set-night', s.showNightLighting, 'window.game.settings.showNightLighting=this.checked', 'Show night lighting/darkness (High Performance Impact)');
        graphics += this._settingsCheck('set-weather', s.showWeatherParticles, 'window.game.settings.showWeatherParticles=this.checked', 'Show weather particles');
        graphics += `<div class="settings-row"><label for="set-particle-density">Particle Density: <span id="particle-density-val">${s.particleDensity || 100}%</span></label>`;
        graphics += `<input type="range" id="set-particle-density" min="10" max="100" step="10" value="${s.particleDensity || 100}" style="width:80px" oninput="document.getElementById('particle-density-val').textContent=this.value+'%';window.game.settings.particleDensity=parseInt(this.value);window.game.saveSettingsToStorage()">`;
        graphics += `</div>`;
        graphics += this._settingsCheck('set-damage-flash', s.showDamageFlash, 'window.game.settings.showDamageFlash=this.checked', 'Damage flash on hit');
        graphics += this._settingsCheck('set-screen-shake', s.enableScreenShake, 'window.game.settings.enableScreenShake=this.checked', 'Enable screen shake');
        graphics += this._settingsCheck('set-combat-particles', s.showCombatParticles, 'window.game.settings.showCombatParticles=this.checked', 'Combat/action particles (sparks, skulls)');
        graphics += this._settingsCheck('set-projectiles', s.showProjectiles, 'window.game.settings.showProjectiles=this.checked', 'Projectile trails (arrows, bolts)');
        graphics += this._settingsCheck('set-equip-overlays', s.showEquipmentOverlays, 'window.game.settings.showEquipmentOverlays=this.checked;window.game.renderer?.skinManager?._compositeCache.clear()', 'Show equipped armor/helmets on colonists (sprite mode)');
        graphics += this._settingsCheck('set-progress-bars', s.showProgressBars, 'window.game.settings.showProgressBars=this.checked', 'Progress & health bars');
        graphics += this._settingsCheck('set-portal-path', s.showPortalPath, 'window.game.settings.showPortalPath=this.checked', 'Portal path highlighting');
        graphics += this._settingsCheck('set-breathing', s.showBreathing, 'window.game.settings.showBreathing=this.checked', 'Entity breathing animation');
        graphics += this._settingsCheck('set-walk-sway', s.showWalkSway, 'window.game.settings.showWalkSway=this.checked', 'Walking sway animation');
        graphics += this._settingsCheck('set-attack-swing', s.showAttackSwing, 'window.game.settings.showAttackSwing=this.checked', 'Attack swing animation');
        graphics += this._settingsCheck('set-action-anims', s.showActionAnimations, 'window.game.settings.showActionAnimations=this.checked', 'Action animations (attack, cast, work, hit)');
        graphics += this._settingsCheck('set-tree-sway', s.showTreeSway, 'window.game.settings.showTreeSway=this.checked', 'Tree sway (wind, stronger in storms)');
        graphics += this._settingsCheck('set-terrain-detail', s.showTerrainDetail, 'window.game.settings.showTerrainDetail=this.checked', 'Terrain detail (grass tufts, water waves)');
        graphics += this._settingsCheck('set-expedition-extras', s.showExpeditionExtras, 'window.game.settings.showExpeditionExtras=this.checked', 'Expedition extra animations');
        graphics += this._settingsCheck('set-minimap', s.showMinimap, 'window.game.settings.showMinimap=this.checked;document.getElementById("minimap-container").style.display=this.checked?"":"none"', 'Show minimap');
        graphics += `<div class="settings-row"><label for="set-dither-dist">Dithering Distance:</label><select id="set-dither-dist" onchange="window.game.settings.ditherDistance=this.value;window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['none','Off'],['minimal','Minimal'],['light','Light (default)'],['normal','Normal'],['heavy','Heavy'],['extreme','Extreme']]) {
            graphics += `<option value="${val}"${(s.ditherDistance || 'light') === val ? ' selected' : ''}>${label}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `<div class="settings-row"><label for="set-dither-qual">Dithering Quality:</label><select id="set-dither-qual" onchange="window.game.settings.ditherQuality=this.value;window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['chunky','Chunky (4x4 blocks)'],['low','Low (3x3 blocks)'],['medium','Medium (2x2 blocks, default)'],['high','High (single pixels)']]) {
            graphics += `<option value="${val}"${(s.ditherQuality || 'medium') === val ? ' selected' : ''}>${label}</option>`;
        }
        graphics += `</select></div>`;
        graphics += this._settingsCheck('set-fps', s.showFps, 'window.game.settings.showFps=this.checked', 'Show FPS counter (top-right of game grid)');
        graphics += this._settingsCheck('set-fps-cap', s.fpsCap === 30, 'window.game.settings.fpsCap=this.checked?30:60', 'Cap framerate to 30 FPS (reduces CPU/GPU usage)');
        graphics += `</div>`;

        // ===== CONTROLS TAB =====
        let controls = this._keybindingsSectionHtml();

        if (!this.game.settings.demoMode) {
        general += `<details class="settings-section settings-debug"><summary class="settings-section-title" style="color:#ff6666;cursor:pointer;list-style:revert;">Debug / Testing</summary>`;
        general += `<button onclick="if(confirm('Grant 999 of all resources?'))window.game.cheatResources()" class="settings-btn settings-btn-danger" style="margin-top:8px;">Grant 999 Resources</button>`;
        general += `<button onclick="if(confirm('Complete all research?'))window.game.cheatGrantResearch()" class="settings-btn settings-btn-danger">Grant All Research</button>`;
        general += `<button onclick="if(confirm('Grant all starter spells (level 0) to every colonist and set magic skills to 1?'))window.game.cheatGrantStarterSpells()" class="settings-btn settings-btn-danger">Grant All Starter Spells + Magic Lvl 1</button>`;
        general += `<button onclick="if(confirm('Grant all spells to every colonist and set magic skills to 8?'))window.game.cheatGrantAllSpells()" class="settings-btn settings-btn-danger">Grant All Spells + Magic Lvl 8</button>`;
        general += `<button onclick="window.game.cheatSpawnColonist()" class="settings-btn settings-btn-danger">Grant New Colonist</button>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-trinket-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(TRINKETS)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('trinket',document.getElementById('debug-trinket-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Trinket</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-boots-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(BOOTS)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('boots',document.getElementById('debug-boots-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Boots</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-weapon-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(WEAPONS)) {
            if (key === 'fists') continue;
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('weapon',document.getElementById('debug-weapon-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Weapon</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-armor-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(ARMORS)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('armor',document.getElementById('debug-armor-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Armor</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-tool-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(TOOLS)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('tool',document.getElementById('debug-tool-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Tool</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-helmet-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(HELMETS)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('helmet',document.getElementById('debug-helmet-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Helmet</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-clothes-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(CLOTHES)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('clothes',document.getElementById('debug-clothes-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Clothes</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-resource-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:80px;">`;
        for (const key of Object.keys(this.game.resources.stockpile)) {
            general += `<option value="${key}">${key.replace(/_/g, ' ')}</option>`;
        }
        general += `</select>`;
        general += `<input id="debug-resource-amount" type="number" value="50" min="1" max="999" style="width:50px;background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        general += `<button onclick="window.game.cheatAddResource(document.getElementById('debug-resource-select').value, parseInt(document.getElementById('debug-resource-amount').value)||50)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Grant Resource</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-event-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const key of Object.keys(EVENTS)) {
            general += `<option value="${key}">${key.replace(/_/g, ' ')}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatTriggerEvent(document.getElementById('debug-event-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Trigger Event</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-raid-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(RAID_TYPES)) {
            general += `<option value="${key}">${def.name}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatTriggerRaid(document.getElementById('debug-raid-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Trigger Raid</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<input id="debug-time-amount" type="number" value="300" min="1" max="9999" style="width:60px;background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        general += `<button onclick="window.game.cheatAdvanceTime(parseInt(document.getElementById('debug-time-amount').value)||300)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">Advance Ticks</button>`;
        general += `<span style="color:#666;font-size:10px;">(300=1 day)</span>`;
        general += `</div>`;
        general += `<button onclick="window.game.cheatUnlockAllStory()" class="settings-btn settings-btn-danger">Unlock All Story Milestones</button>`;
        general += `</details>`;
        }

        general += `<div class="settings-section" style="text-align:center;"><button onclick="if(confirm('Reset all settings to their default values? (Keybindings are reset separately on the Controls tab.)'))window.game.resetAllSettings()" class="settings-btn settings-btn-danger">Reset all settings to Default</button></div>`;

        html += tab === 'graphics' ? graphics : tab === 'controls' ? controls : general;
        this.elements.settingsPanel.innerHTML = html;
    }

    // Switch the active settings tab and re-render the panel.
    _setSettingsTab(tab) {
        this._settingsTab = tab;
        this.updateSettingsPanel();
        window.soundManager?.playSFXPitched('button_click', 0);
    }

    // Controls tab body: grouped rebindable keys + reset button. Delegates row
    // rendering to the shared keybindings-ui helper (also used by the start screen).
    _keybindingsSectionHtml() {
        let html = `<div class="settings-section"><div class="settings-section-title">Controls / Keybindings</div>`;
        html += keybindingRowsHtml('window.game.ui._startRebind', 'window.game.ui._resetRebind');
        html += `<div class="settings-row" style="margin-top:6px;"><button onclick="window.game.resetKeyBindings()" class="settings-btn settings-btn-danger">Reset all keybinds to Default</button></div>`;
        html += `</div>`;
        return html;
    }

    // Capture the next keypress and assign it to the given action, then re-apply
    // to the live InputHandler and re-render. A second click cancels a pending
    // capture. Reserved structural keys are rejected with a notification.
    _startRebind(action, btn) {
        beginRebindCapture(
            action, btn,
            (_action, key) => { this.game.setKeyBinding(action, key); },
            (key) => { this.game.notifications.push({ text: `"${formatKeyLabel(key)}" is reserved and cannot be rebound`, tick: this.game.tick, type: 'danger' }); }
        );
    }

    // Revert a single action to its default key and re-apply live + re-render.
    _resetRebind(action) {
        this.game.resetKeyBinding(action);
    }

    _settingsCheck(id, checked, onchange, label) {
        const safeHandler = (onchange + ';window.game.saveSettingsToStorage()').replace(/"/g, '&quot;');
        return `<div class="settings-row"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${safeHandler}"><label for="${id}">${label}</label></div>`;
    }

    _toggleAllEffects(on) {
        const s = this.game.settings;
        s.showOverlays = on;
        s.showNightLighting = on;
        s.showWeatherParticles = on;
        s.showDamageFlash = on;
        s.enableScreenShake = on;
        s.showCombatParticles = on;
        s.showProjectiles = on;
        s.showEquipmentOverlays = on;
        s.showProgressBars = on;
        s.showPortalPath = on;
        s.showBreathing = on;
        s.showWalkSway = on;
        s.showAttackSwing = on;
        s.showActionAnimations = on;
        s.showTreeSway = on;
        s.showTerrainDetail = on;
        s.showExpeditionExtras = on;
        s.showMinimap = on;
        window.RENDER_CONFIG.terrainDithering = on;
        document.getElementById('minimap-container').style.display = on ? '' : 'none';
        if (!on) this.game.renderer?.skinManager?._compositeCache.clear();
        const ids = ['set-night','set-weather','set-damage-flash','set-screen-shake','set-combat-particles','set-projectiles','set-equip-overlays','set-progress-bars','set-portal-path','set-breathing','set-walk-sway','set-attack-swing','set-action-anims','set-tree-sway','set-terrain-detail','set-expedition-extras','set-minimap'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.checked = on;
        }
    }

    updateTileTooltip(x, y, e) {
        const tooltip = document.getElementById('tile-tooltip');
        const tile = this.game.map[y][x];
        const parts = [`(${x},${y}) ${tile.terrain}`];
        if (tile.structure) parts.push(`Structure: ${tile.structure.replace(/_/g, ' ')}`);
        if (tile.resource) parts.push(`Resource: ${tile.resource.type}${tile.resource.amount > 1 ? ' x' + tile.resource.amount : ''}`);
        if (tile.designation) parts.push(`[${tile.designation.type}]`);
        if (tile.zone) parts.push(`Farm: ${tile.zone.crop}`);
        const nameMode = this.game.settings.showColonistNames;
        if (nameMode === 'selected' || nameMode === 'always') {
            const colHere = this.game.colonists.find(c => c.x === x && c.y === y && c.hp > 0 && !c.onExpedition);
            if (colHere) parts.push(colHere.name);
        }
        tooltip.textContent = parts.join(' | ');
        tooltip.style.display = 'block';
        tooltip.style.left = (e.offsetX + 12) + 'px';
        tooltip.style.top = (e.offsetY - 24) + 'px';
    }

    hideTileTooltip() {
        document.getElementById('tile-tooltip').style.display = 'none';
    }

    isBuildingLocked(buildType) {
        const def = BUILDINGS[buildType];
        return def?.research && !this.game.research.isResearched(def.research);
    }

    isBuildingAtMax(buildType) {
        const def = BUILDINGS[buildType];
        if (!def || !def.maxCount) return false;
        let count = 0;
        for (const row of this.game.map) {
            for (const t of row) {
                if (t.structure === buildType) count++;
                if (t.designation && t.designation.type === 'build' && t.designation.buildType === buildType) count++;
            }
        }
        return count >= def.maxCount + getMaxCountBonus(def, buildType, this.game);
    }

    updateNotifications() {
        const duration = this.game.settings.notificationDuration || 100;
        const recent = this.game.notifications.filter(n => this.game.tick - n.tick < duration);
        this.game.notifications = recent;
        this.elements.notifications.innerHTML = recent.slice(-4).map(n =>
            `<div class="notif notif-${n.type}">${n.text}</div>`
        ).join('');
    }

    updateEventPanel() {
        const evt = this.game.events.pendingEvent;
        if (!evt) {
            if (this._lastEventId) {
                this.elements.eventPanel.style.display = 'none';
                this.elements.eventPanel.className = '';
                this._lastEventId = null;
                this._tradeOpen = false;
                window.soundManager?.playSFXPitched('open_close_click', -3);
            }
            return;
        }

        if (evt.type === 'trade' && this._tradeOpen) {
            if (this._tradeDirty) {
                this._tradeDirty = false;
                this._updateTradePanel(evt);
            }
            return;
        }

        const eventId = evt.type + evt.text;
        if (this._lastEventId === eventId) return;
        this._lastEventId = eventId;
        this.elements.eventPanel.style.display = 'block';
        window.soundManager?.playSFXPitched('open_close_click', 3);
        this.elements.eventPanel.className = evt.type === 'raid' ? 'event-panel-raid' : '';
        let html = `<div class="event-text">${evt.text}</div><div class="event-choices">`;
        if (evt.type === 'trade') {
            html += `<button onclick="window.game.openTradePanel()">Open Trade</button>`;
            html += `<button onclick="window.game.dismissTrader()">Dismiss</button>`;
        } else {
            evt.choices.forEach((choice, i) => {
                html += `<button onclick="window.game.resolveEvent(${i})">${choice}</button>`;
            });
        }
        html += '</div>';
        this.elements.eventPanel.innerHTML = html;
    }

    _formatResourceName(key) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    _tradeResIcon(key) {
        const mgr = this.game.skinManager;
        if (mgr && mgr.isActive) {
            const url = mgr.getItemSpriteDataURL(key);
            if (url) return `<img src="${url}" style="width:14px;height:14px;vertical-align:middle;image-rendering:pixelated;margin-right:3px;">`;
        }
        const colors = {
            wood: '#8b6b3a', stone: '#999', food: '#88cc44', planks: '#c89648',
            bricks: '#cc6633', iron_ore: '#887766', iron: '#aaa', runite: '#44ccff',
            void_essence: '#9933ff', hides: '#8b7355', leather: '#a0522d',
            meat: '#cc6666', wheat: '#daa520', berries: '#cc4488', corn: '#ccaa22',
            potatoes: '#c8a060', moonbloom: '#cc88ff', eggs: '#eecc88',
            milk: '#eeeedd', wool: '#ddd', gold: '#ffdd00',
        };
        const abbr = { wood: 'W', stone: 'S', food: 'F', planks: 'P', bricks: 'Bk', iron_ore: 'Or', iron: 'Fe', runite: 'Ru', leather: 'Le', wool: 'Wl', void_essence: 'V', hides: 'Hi', meat: 'Mt', wheat: 'Wh', berries: 'Be', corn: 'Cn', potatoes: 'Po', moonbloom: 'Mb', eggs: 'Eg', milk: 'Mk', gold: 'Au' };
        const color = colors[key] || '#aaa';
        const ch = abbr[key] || this._formatResourceName(key).slice(0, 2);
        return `<span style="color:${color};font-weight:bold;margin-right:3px;font-size:0.9em;">${ch}</span>`;
    }

    _getExclusiveItemTooltip(item) {
        if (!item) return '';
        if (item.type === 'trinket') return this._getTrinketTooltip(item);
        const lines = [];
        if (item.description) lines.push(item.description);
        const stats = getItemStatLines(item);
        if (stats.length) lines.push(stats.join(', '));
        return lines.join(' | ') || item.name;
    }

    _updateTradePanel(evt) {
        const data = evt.data;
        const stock = this.game.resources.stockpile;
        const offer = this._tradeOffer || {};
        const request = this._tradeRequest || {};
        const step = this._tradeStep || 1;
        const goldOffer = this._tradeGoldOffer || 0;
        const playerGold = stock.gold || 0;
        const fmtGold = v => v % 1 !== 0 ? v.toFixed(1) : v;

        this.elements.eventPanel.className = 'trade-panel-active';

        // Compute effective trade rates and values (shared with executeBarterTrade and balanceTradeWithGold)
        const rates = getTradeRates(this.game);
        const effectiveMarkup = rates.markup;
        const effectiveDiscount = rates.discount;
        const { offerVal, resourceOfferVal, reqVal } = computeTradeValues(offer, request, goldOffer, rates, data, this.game);

        const ratio = (effectiveMarkup / effectiveDiscount).toFixed(2);
        let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">`;
        html += `<div class="event-text" style="font-size:0.95em;margin:0;">${data.merchantName || 'Trade Caravan'}</div>`;
        html += `<div class="trade-step-selector">`;
        for (const s of [1, 10, 100]) {
            html += `<button class="trade-step-btn${step === s ? ' active' : ''}" onclick="window.game.ui._tradeStep=${s};window.game.ui._tradeDirty=true;">±${s}</button>`;
        }
        html += `</div></div>`;

        html += `<div class="trade-ratio-bar">Trade ratio: <b>${ratio}:1</b> — sell at <b>${Math.round(effectiveDiscount * 100)}%</b>, buy at <b>${Math.round(effectiveMarkup * 100)}%</b></div>`;

        const bonuses = [];
        if (this.game.research.isResearched('trade_routes')) bonuses.push('Trade Routes');
        const artMult = getPedestalEffect(this.game, 'tradeMarkupMult');
        if (artMult < 1) bonuses.push(`Trinket: ${Math.round((1 - artMult) * 100)}% off`);
        if (bonuses.length > 0) {
            html += `<div class="trade-bonuses">${bonuses.join(' | ')}</div>`;
        }

        html += `<div class="trade-grid">`;

        // Trader sells column
        const goldReqAmt = request.__gold || 0;
        html += `<div class="trade-column">`;
        html += `<div class="trade-column-header sell">Trader Sells</div>`;
        html += `<div class="trade-item-row${goldReqAmt > 0 ? ' selected' : ''}">`;
        html += `<div class="trade-item-name">${this._tradeResIcon('gold')}Gold <span style="color:#888;">×${fmtGold(data.traderGold)}</span>`;
        if (goldReqAmt > 0) html += `<span class="trade-item-badge">${fmtGold(goldReqAmt)}</span>`;
        html += `</div>`;
        html += `<div class="trade-item-value" style="color:#ffdd00;">1.0g</div>`;
        html += `<div class="trade-item-buttons">`;
        html += `<button class="trade-btn" onclick="window.game.tradeRequestGold(-${step})">−</button>`;
        html += `<button class="trade-btn" onclick="window.game.tradeRequestGold(${step})">+</button>`;
        html += `</div></div>`;
        for (const [res, amt] of Object.entries(data.traderResources)) {
            const val = ((TRADE_VALUES[res] || 1) * effectiveMarkup).toFixed(1);
            const reqAmt = request[res] || 0;
            const selected = reqAmt > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon(res)}${this._formatResourceName(res)} <span style="color:#888;">×${amt}</span>`;
            if (reqAmt > 0) html += `<span class="trade-item-badge">${reqAmt}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value">${val}g</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.game.tradeRemoveRequest('${res}',${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.game.tradeRequest('${res}',${step})">+</button>`;
            html += `</div></div>`;
        }
        if (data.exclusiveItems?.length > 0) {
            for (let si = 0; si < data.exclusiveItems.length; si++) {
                const item = data.exclusiveItems[si];   // a rolled instance (with quality) or null
                if (!item) continue;  // already purchased this slot
                const slotKey = `__exclusive_${si}`;
                const isSelected = request[slotKey] ? ' active' : '';
                const tip = this._getExclusiveItemTooltip(item);
                const exIcon = this._itemIcon(item.key, item.type);
                // Priced at face value to match computeTradeValues' exclusive-slot cost.
                const price = getItemTradeValue(item);
                html += `<div class="trade-exclusive-row skill-tip" data-tip="${tip.replace(/"/g, '&quot;')}">`;
                html += `<div class="trade-item-name">${exIcon}${item.name || item.key}</div>`;
                html += `<div class="trade-item-value">${price}g</div>`;
                html += `<button class="trade-exclusive-toggle${isSelected}" onclick="window.game.${request[slotKey] ? 'tradeRemoveRequest' : 'tradeRequest'}('${slotKey}',1)">${request[slotKey] ? 'Remove' : 'Buy'}</button>`;
                html += `</div>`;
            }
        }
        // Stackable potions the merchant sells (traded like materials).
        if (data.traderPotions && Object.keys(data.traderPotions).length > 0) {
            for (const [key, amt] of Object.entries(data.traderPotions)) {
                if (amt <= 0) continue;
                const def = ALL_ITEMS[key];
                const reqKey = `__buypotion_${key}`;
                const reqAmt = request[reqKey] || 0;
                const val = (getItemTradeValue(def) * effectiveMarkup).toFixed(1);
                const selected = reqAmt > 0 ? ' selected' : '';
                html += `<div class="trade-item-row${selected}">`;
                html += `<div class="trade-item-name">${this._itemIcon(key, 'potion')}${def?.name || key} <span style="color:#888;">×${amt}</span>`;
                if (reqAmt > 0) html += `<span class="trade-item-badge">${reqAmt}</span>`;
                html += `</div>`;
                html += `<div class="trade-item-value">${val}g</div>`;
                html += `<div class="trade-item-buttons">`;
                html += `<button class="trade-btn" onclick="window.game.tradeRemoveRequest('${reqKey}',${step})">−</button>`;
                html += `<button class="trade-btn" onclick="window.game.tradeRequest('${reqKey}',${step})">+</button>`;
                html += `</div></div>`;
            }
        }
        html += `<div style="height:12px;"></div></div>`;

        // You offer column - sorted by value descending
        // Exclude resources in the merchant's pool (they don't buy what they sell)
        const merchantResourcePool = data.merchantResourcePool ? new Set(data.merchantResourcePool) : null;
        const tradableStock = Object.entries(stock)
            .filter(([res, amt]) => typeof amt === 'number' && amt > 0 && !res.startsWith('_') && TRADE_VALUES[res] && (!merchantResourcePool || !merchantResourcePool.has(res)))
            .sort((a, b) => (TRADE_VALUES[b[0]] || 0) - (TRADE_VALUES[a[0]] || 0));

        // Equipment items the merchant will buy, filtered by buyCategories
        const buyCategories = data.buyCategories ? new Set(data.buyCategories) : null;
        const EQUIP_ARRAYS = ['weapon', 'armor', 'helmet', 'tool', 'trinket', 'boots', 'tome', 'consumable'];
        const offerableEquip = [];
        for (const type of EQUIP_ARRAYS) {
            if (buyCategories && !buyCategories.has(type)) continue;
            const arr = this.game.resources[`${type}s`] || [];
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (getItemTradeValue(item) > 0) offerableEquip.push({ key: `__equip_${type}_${i}`, item, type });
            }
        }

        html += `<div class="trade-column">`;
        html += `<div class="trade-column-header offer">You Offer</div>`;

        // Gold offer row (always shown if player has gold)
        if (playerGold > 0) {
            const selected = goldOffer > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon('gold')}Gold <span style="color:#888;">×${fmtGold(playerGold)}</span>`;
            if (goldOffer > 0) html += `<span class="trade-item-badge">${fmtGold(goldOffer)}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value" style="color:#ffdd00;">1.0g</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.game.tradeGold(-${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.game.tradeGold(${step})">+</button>`;
            html += `</div></div>`;
        }

        for (const [res, amt] of tradableStock) {
            const val = ((TRADE_VALUES[res] || 1) * effectiveDiscount).toFixed(1);
            const offAmt = offer[res] || 0;
            const selected = offAmt > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon(res)}${this._formatResourceName(res)} <span style="color:#888;">×${amt}</span>`;
            if (offAmt > 0) html += `<span class="trade-item-badge">${offAmt}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value">${val}g</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.game.tradeRemoveOffer('${res}',${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.game.tradeOffer('${res}',${step})">+</button>`;
            html += `</div></div>`;
        }

        // Equipment items player can sell
        if (offerableEquip.length > 0) {
            html += `<div class="trade-section-label" style="color:#aaa;font-size:0.8em;padding:4px 0 2px;border-top:1px solid #333;margin-top:4px;">Equipment</div>`;
            for (const { key, item, type } of offerableEquip) {
                const val = (getItemTradeValue(item) * effectiveDiscount).toFixed(1);
                const isOffered = !!offer[key];
                const selected = isOffered ? ' selected' : '';
                const icon = this._itemIcon(item.key || key, type);
                html += `<div class="trade-item-row${selected}">`;
                html += `<div class="trade-item-name">${icon}${item.name}`;
                if (isOffered) html += `<span class="trade-item-badge">1</span>`;
                html += `</div>`;
                html += `<div class="trade-item-value">${val}g</div>`;
                html += `<div class="trade-item-buttons">`;
                if (isOffered) {
                    html += `<button class="trade-btn" onclick="window.game.tradeRemoveOffer('${key}',1)">−</button>`;
                } else {
                    html += `<button class="trade-btn" onclick="window.game.tradeOffer('${key}',1)">+</button>`;
                }
                html += `</div></div>`;
            }
        }

        // Stackable potions the player can sell (only to merchants that buy potions).
        if (!buyCategories || buyCategories.has('potion')) {
            const potionCounts = {};
            for (const p of (this.game.resources.potions || [])) {
                const k = p.key ?? p.type;
                potionCounts[k] = (potionCounts[k] || 0) + 1;
            }
            const sellablePotions = Object.entries(potionCounts).filter(([, c]) => c > 0);
            if (sellablePotions.length > 0) {
                html += `<div class="trade-section-label" style="color:#aaa;font-size:0.8em;padding:4px 0 2px;border-top:1px solid #333;margin-top:4px;">Potions</div>`;
                for (const [key, count] of sellablePotions) {
                    const def = ALL_ITEMS[key];
                    const offKey = `__potion_${key}`;
                    const offAmt = offer[offKey] || 0;
                    const val = (getItemTradeValue(def) * effectiveDiscount).toFixed(1);
                    const selected = offAmt > 0 ? ' selected' : '';
                    html += `<div class="trade-item-row${selected}">`;
                    html += `<div class="trade-item-name">${this._itemIcon(key, 'potion')}${def?.name || key} <span style="color:#888;">×${count}</span>`;
                    if (offAmt > 0) html += `<span class="trade-item-badge">${offAmt}</span>`;
                    html += `</div>`;
                    html += `<div class="trade-item-value">${val}g</div>`;
                    html += `<div class="trade-item-buttons">`;
                    html += `<button class="trade-btn" onclick="window.game.tradeRemoveOffer('${offKey}',${step})">−</button>`;
                    html += `<button class="trade-btn" onclick="window.game.tradeOffer('${offKey}',${step})">+</button>`;
                    html += `</div></div>`;
                }
            }
        }

        html += `<div style="height:12px;"></div></div></div>`;

        // Deal meter. Trade is valid when player is offering something and offer value covers request.
        const hasOffer = offerVal > 0;
        const hasRequest = reqVal > 0;
        const canTrade = hasOffer && offerVal >= reqVal;
        const meterPercent = reqVal > 0 ? Math.min(100, (offerVal / reqVal) * 100) : 0;
        const diff = offerVal - reqVal;
        const overpay = diff > 0 ? diff : 0;

        html += `<div class="trade-deal-meter">`;
        html += `<div class="trade-meter-bar"><div class="trade-meter-fill ${canTrade ? (overpay > 0 ? 'warning' : 'valid') : 'invalid'}" style="width:${meterPercent}%"></div></div>`;
        html += `<div class="trade-meter-text">`;
        html += `<span class="offer-val">Offer: ${offerVal.toFixed(1)}g</span>`;
        if (reqVal > 0 || hasOffer) {
            if (diff > 0) {
                html += `<span class="deficit">Overpay: −${diff.toFixed(1)}g</span>`;
            } else if (diff < 0) {
                html += `<span class="deficit">Need: ${Math.abs(diff).toFixed(1)}g</span>`;
            } else if (diff === 0 && hasRequest) {
                html += `<span class="surplus">Even trade</span>`;
            }
        }
        html += `<span class="request-val">Cost: ${reqVal.toFixed(1)}g</span>`;
        html += `</div>`;
        if (overpay > 0) {
            html += `<div class="trade-meter-warning">You will lose ${overpay.toFixed(1)}g in value!</div>`;
        }
        html += `</div>`;

        // Action buttons
        const goldReqCurrent = request.__gold || 0;
        const traderGoldAvailable = data.traderGold - goldReqCurrent;
        const resourceSurplus = Math.max(0, resourceOfferVal - reqVal);
        const canBalanceDeficit = diff < 0 && (-diff) <= (playerGold - goldOffer);
        const canBalanceSurplus = resourceSurplus > 0 && traderGoldAvailable > 0;
        const canBalance = canBalanceDeficit || canBalanceSurplus;
        let balanceLabel = 'Balance';
        if (canBalanceDeficit) balanceLabel = `Balance (+${(-diff).toFixed(1)}g)`;
        else if (canBalanceSurplus) balanceLabel = `Balance (get ${Math.min(resourceSurplus, traderGoldAvailable).toFixed(1)}g)`;
        html += `<div class="trade-actions">`;
        if (overpay > 0) {
            html += `<button class="confirm" ${canTrade ? '' : 'disabled'} onclick="window.game.confirmTrade()" style="border-color:#aa4400;color:#ffaa66;">Confirm (lose ${overpay.toFixed(1)}g)</button>`;
        } else {
            html += `<button class="confirm" ${canTrade ? '' : 'disabled'} onclick="window.game.confirmTrade()">Confirm Trade</button>`;
        }
        html += `<button ${canBalance ? '' : 'disabled'} onclick="window.game.balanceTradeWithGold()" style="border-color:#aa8800;color:#ffdd88;">${balanceLabel}</button>`;
        html += `<button onclick="window.game.clearTradeSelection()">Clear</button>`;
        html += `<button onclick="window.game.dismissTrader()">Done</button>`;
        html += `</div>`;

        const scrollEl = this.elements.eventPanel.querySelector('.trade-grid');
        const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
        this.elements.eventPanel.innerHTML = html;
        const newScrollEl = this.elements.eventPanel.querySelector('.trade-grid');
        if (newScrollEl) newScrollEl.scrollTop = scrollTop;
    }


    toggleStoryPanel() {
        const opening = !this.storyPanelVisible;
        this._closeAllPanels();
        this.storyPanelVisible = opening;
        this._panelPause(opening);
        this.elements.storyPanel.style.display = opening ? 'block' : 'none';
        if (opening) {
            this.game.story.markAllViewed();
            this._lastStoryHtml = '';
            this.updateStoryPanel();
        }
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    updateStoryPanel() {
        const tab = this._storyTab || 'colony';
        const unlocked = this.game.story.unlocked;

        let html = '<div class="panel-close" data-panel-close="story">&times;</div>';
        html += '<h3 style="color:#ffcc44">Story</h3>';
        const tabCounts = {};
        for (const [key, m] of Object.entries(STORY_MILESTONES)) {
            if (!tabCounts[m.tab]) tabCounts[m.tab] = { total: 0, unlocked: 0 };
            tabCounts[m.tab].total++;
            if (unlocked.has(key)) tabCounts[m.tab].unlocked++;
        }
        const tabLabel = (name, label) => {
            const c = tabCounts[name] || { unlocked: 0, total: 0 };
            return `${label} (${c.unlocked}/${c.total})`;
        };

        html += '<div class="story-tabs">';
        html += `<button class="story-tab-btn${tab === 'colony' ? ' active' : ''}" data-story-tab="colony">${tabLabel('colony', 'Colony')}</button>`;
        html += `<button class="story-tab-btn${tab === 'research' ? ' active' : ''}" data-story-tab="research">${tabLabel('research', 'Research')}</button>`;
        html += `<button class="story-tab-btn${tab === 'races' ? ' active' : ''}" data-story-tab="races">${tabLabel('races', 'Races')}</button>`;
        html += `<button class="story-tab-btn${tab === 'realms' ? ' active' : ''}" data-story-tab="realms">${tabLabel('realms', 'Realms')}</button>`;
        const bestiarySize = (this.game.exploration?.bestiary?.size || 0) +
            (this.game.exploration?.wildlifeKills?.size || 0) +
            (this.game.exploration?.raiderKills?.size || 0) +
            (this.game.exploration?.summonsSeen?.size || 0);
        html += `<button class="story-tab-btn${tab === 'bestiary' ? ' active' : ''}" data-story-tab="bestiary">Bestiary (${bestiarySize})</button>`;
        html += '</div>';

        const entries = Object.entries(STORY_MILESTONES)
            .filter(([, m]) => m.tab === tab);

        html += '<div class="story-entries">';

        if (tab === 'bestiary') {
            const bestiary = this.game.exploration?.bestiary;
            const _bestiaryEntryHtml = (entry, spriteHtml) => {
                const realmName = REALMS[entry.realm]?.name || entry.realm;
                const entryTypeKey = entry.key?.split(':')[1];
                const lore = entry.lore || EXPEDITION_ENEMIES[entryTypeKey]?.lore || NPC_ENCOUNTERS[entryTypeKey]?.lore || '';
                const catColors = { regular: '#ff4444', boss: '#ffcc44', npc: '#44ccff' };
                const catKey = entry.category === 'elite' ? 'regular' : (entry.category || 'regular');
                if (!spriteHtml) {
                    const color = entry.color || catColors[catKey] || '#ff4444';
                    const symbol = catKey === 'boss' ? '&#9650;' : catKey === 'npc' ? '&#9786;' : '&#9668;';
                    spriteHtml = `<span style="display:inline-block;width:24px;text-align:center;font-size:1.2em;color:${color};vertical-align:middle;margin-right:6px;">${symbol}</span>`;
                }
                let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div>`;
                h += `<div class="story-entry-title" style="font-size:0.9em;">${entry.name}</div>`;
                h += `<div class="story-entry-text" style="font-size:0.8em;">Found in: ${realmName} | Encountered: ${entry.count}x</div>`;
                if (entry.eliteCounts && Object.keys(entry.eliteCounts).length > 0) {
                    const eliteParts = Object.values(entry.eliteCounts).map(e => `${e.name} ×${e.count}`);
                    h += `<div class="story-entry-text" style="font-size:0.75em;color:#ff8844;">Elites: ${eliteParts.join(', ')}</div>`;
                }
                if (lore) h += `<div class="story-entry-text" style="font-size:0.8em;font-style:italic;color:#aaa;margin-top:2px;">${lore}</div>`;
                return h + `</div></div>`;
            };
            const _killEntryHtml = (entry, spriteHtml, lore, showTamed) => {
                if (!spriteHtml) {
                    spriteHtml = `<span style="display:inline-block;width:24px;text-align:center;font-size:1.2em;color:${entry.color};vertical-align:middle;margin-right:6px;">${entry.char}</span>`;
                }
                let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div>`;
                h += `<div class="story-entry-title" style="font-size:0.9em;">${entry.name}</div>`;
                let statLine = `Killed: ${entry.count}x | Drops: ${entry.drops || 'Nothing'}`;
                if (showTamed && entry.tameCount) statLine += ` | Tamed: ${entry.tameCount}x`;
                h += `<div class="story-entry-text" style="font-size:0.8em;">${statLine}</div>`;
                if (lore) h += `<div class="story-entry-text" style="font-size:0.8em;font-style:italic;color:#aaa;margin-top:2px;">${lore}</div>`;
                return h + `</div></div>`;
            };
            const _getSpriteHtml = (sprite) => {
                const sm = this.game.skinManager;
                if (sm?.isActive && sprite) {
                    const img = sm.getSprite('entities', sprite);
                    if (img) {
                        const c = document.createElement('canvas');
                        c.width = img.width || img.naturalWidth || 16;
                        c.height = img.height || img.naturalHeight || 16;
                        c.getContext('2d').drawImage(img, 0, 0);
                        return `<img src="${c.toDataURL('image/png')}" style="width:24px;height:24px;image-rendering:pixelated;vertical-align:middle;margin-right:6px;">`;
                    }
                }
                return '';
            };
            const _sectionHeader = (key, label, color, count) => {
                const collapsed = this._collapsedBestiarySections.has(key);
                const arrow = collapsed ? '&#9654;' : '&#9660;';
                const countStr = count > 0 ? ` (${count})` : '';
                return `<div class="realm-group-header" data-bestiary-section="${key}" style="color:${color};">${arrow} ${label}${countStr}</div>`;
            };
            const _emptyHint = (msg) =>
                `<div class="story-entry locked" style="margin:2px 0;"><div class="story-entry-text">${msg}</div></div>`;

            // Expedition sections
            const categories = { regular: [], boss: [], npc: [] };
            for (const [, entry] of (bestiary || [])) {
                const cat = entry.category === 'elite' ? 'regular' : (entry.category || 'regular');
                if (categories[cat]) categories[cat].push(entry);
            }
            const catColors = { regular: '#ff4444', boss: '#ffcc44', npc: '#44ccff' };
            const catNames = { regular: 'Enemies', boss: 'Bosses', npc: 'Encounters' };
            const catHints = {
                regular: 'Send colonists on expeditions to encounter enemies.',
                boss:    'Reach the final encounter of an expedition chain to face a boss.',
                npc:     'Some expedition events end with a peaceful encounter instead of combat.',
            };
            for (const catKey of ['regular', 'boss', 'npc']) {
                const catEntries = categories[catKey];
                html += _sectionHeader(`exp_${catKey}`, catNames[catKey], catColors[catKey], catEntries.length);
                if (!this._collapsedBestiarySections.has(`exp_${catKey}`)) {
                    if (catEntries.length === 0) {
                        html += _emptyHint(catHints[catKey]);
                    } else {
                        for (const entry of catEntries) {
                            html += _bestiaryEntryHtml(entry, _getSpriteHtml(entry.sprite));
                        }
                    }
                }
            }

            // Wildlife section
            const wildlifeKills = [...(this.game.exploration?.wildlifeKills?.values() || [])];
            html += _sectionHeader('wildlife', 'Wildlife', '#88cc44', wildlifeKills.length);
            if (!this._collapsedBestiarySections.has('wildlife')) {
                if (wildlifeKills.length === 0) {
                    html += _emptyHint('Hunt or tame a wild animal to add it here.');
                } else {
                    for (const entry of wildlifeKills) {
                        html += _killEntryHtml(entry, _getSpriteHtml(entry.sprite), ANIMALS[entry.sprite]?.lore || entry.lore || '', true);
                    }
                }
            }

            // Raider section
            const raiderKills = [...(this.game.exploration?.raiderKills?.values() || [])];
            html += _sectionHeader('raiders', 'Raiders', '#ff6644', raiderKills.length);
            if (!this._collapsedBestiarySections.has('raiders')) {
                if (raiderKills.length === 0) {
                    html += _emptyHint('Survive a raid and defeat enemy raiders to add them here.');
                } else {
                    for (const entry of raiderKills) {
                        html += _killEntryHtml(entry, _getSpriteHtml(entry.sprite), ENTITIES[entry.sprite]?.lore || entry.lore || '');
                    }
                }
            }

            // Summons section
            const summonsSeen = [...(this.game.exploration?.summonsSeen?.values() || [])];
            html += _sectionHeader('summons', 'Summons', '#9966ff', summonsSeen.length);
            if (!this._collapsedBestiarySections.has('summons')) {
                if (summonsSeen.length === 0) {
                    html += _emptyHint('Summon creatures during combat to add them here.');
                } else {
                    for (const entry of summonsSeen) {
                        const lore = ENTITIES[entry.sprite]?.lore || entry.lore || '';
                        const spriteHtml = _getSpriteHtml(entry.sprite) ||
                            `<span style="display:inline-block;width:24px;text-align:center;font-size:1.2em;color:${entry.color};vertical-align:middle;margin-right:6px;">${entry.char}</span>`;
                        let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div>`;
                        h += `<div class="story-entry-title" style="font-size:0.9em;">${entry.name}</div>`;
                        if (lore) h += `<div class="story-entry-text" style="font-size:0.8em;font-style:italic;color:#aaa;margin-top:2px;">${lore}</div>`;
                        html += h + `</div></div>`;
                    }
                }
            }
        } else if (tab === 'realms') {
            const groups = [];
            const groupMap = new Map();
            for (const [key, milestone] of entries) {
                const g = milestone.realmGroup;
                if (!groupMap.has(g)) {
                    const group = { name: g, entries: [] };
                    groupMap.set(g, group);
                    groups.push(group);
                }
                groupMap.get(g).entries.push([key, milestone]);
            }
            for (const group of groups) {
                const groupUnlocked = group.entries.filter(([k]) => unlocked.has(k)).length;
                const collapsed = this._collapsedRealmGroups.has(group.name);
                const arrow = collapsed ? '&#9654;' : '&#9660;';
                html += `<div class="realm-group-header" data-realm-group="${group.name}">${arrow} ${group.name} (${groupUnlocked}/${group.entries.length})</div>`;
                if (!collapsed) {
                    for (const [key, milestone] of group.entries) {
                        if (unlocked.has(key)) {
                            const info = unlocked.get(key);
                            const dateStr = info ? `Year ${info.year}, ${info.season.charAt(0).toUpperCase() + info.season.slice(1)}` : '';
                            html += `<div class="story-entry unlocked">`;
                            if (dateStr) html += `<div style="color:#888;font-size:10px;margin-bottom:2px;">${dateStr}</div>`;
                            html += `<div class="story-entry-title">${milestone.title}</div>`;
                            html += `<div class="story-entry-text">${milestone.text}</div>`;
                            html += `</div>`;
                        } else {
                            html += `<div class="story-entry locked">`;
                            html += `<div class="story-entry-title">???</div>`;
                            html += `<div class="story-entry-text">This tale has yet to unfold...</div>`;
                            html += `</div>`;
                        }
                    }
                }
            }
        } else {
            const unlockedEntries = entries.filter(([k]) => unlocked.has(k)).reverse();
            const lockedEntries = entries.filter(([k]) => !unlocked.has(k));
            for (const [key, milestone] of unlockedEntries) {
                const info = unlocked.get(key);
                const dateStr = info ? `Year ${info.year}, ${info.season.charAt(0).toUpperCase() + info.season.slice(1)}` : '';
                html += `<div class="story-entry unlocked">`;
                if (dateStr) html += `<div style="color:#888;font-size:10px;margin-bottom:2px;">${dateStr}</div>`;
                html += `<div class="story-entry-title">${milestone.title}</div>`;
                html += `<div class="story-entry-text">${milestone.text}</div>`;
                html += `</div>`;
            }
            for (const [,] of lockedEntries) {
                html += `<div class="story-entry locked">`;
                html += `<div class="story-entry-title">???</div>`;
                html += `<div class="story-entry-text">This tale has yet to unfold...</div>`;
                html += `</div>`;
            }
        }

        html += '</div>';

        if (html !== this._lastStoryHtml) {
            this._lastStoryHtml = html;
            this.elements.storyPanel.innerHTML = html;
        }
    }
}

function bar(value) {
    const filled = Math.round(value / 10);
    return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

function getMoodLabel(mood) {
    if (mood >= 75) return 'inspired';
    if (mood >= 40) return 'content';
    if (mood >= 20) return 'stressed';
    return 'breaking';
}

function statColor(value) {
    if (value >= 70) return '#88cc88';
    if (value >= 40) return '#cccc44';
    if (value >= 20) return '#cc8844';
    return '#cc4444';
}

function getWeaponTooltip(colonist) {
    const w = colonist.weapon;
    const baseCd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
    const atkSpeed = 1 + getEquipmentStat(colonist, 'attackSpeed');
    const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
    const baseDpt = (w.damage / baseCd).toFixed(1);
    let tip = w.description ? `${w.description} ` : '';
    tip += `${w.damage}d`;
    if (baseCd !== effCd) {
        const effDpt = (w.damage / effCd).toFixed(1);
        tip += `, ${baseDpt} dps → ${effDpt} dps`;
    } else {
        tip += ` (${baseDpt} dps)`;
    }
    if (w.ranged) tip += `, range ${w.range}`;
    const extras = getItemStatLines({ ...w, damage: undefined, ranged: undefined, range: undefined });
    if (extras.length) tip += `, ${extras.join(', ')}`;
    return tip;
}

installArcanePanel(UI);
installResearchPanel(UI);
installTutorialPanel(UI);

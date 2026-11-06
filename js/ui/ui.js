import { CONFIG, CRYPT_CONFIG, COLONIST_CONFIG, MAGIC_STUDY_CONFIG, TRAITS, BUILDINGS, BUILD_CATEGORIES, TILE_CHARS, TILE_COLORS, ANIMALS, TAMED_ANIMALS, WAVE_CONFIG, RECIPE_CATEGORIES, WEAPONS, ARMORS, HELMETS, CLOTHES, BOOTS, TOOLS, TRINKETS, POTIONS, SKILLS, SKILL_MILESTONES, MAGIC_SKILLS, SPELL_TOMES, SPELLS, FOODSTUFFS, WORK_CONFIG, GOLEM_TYPES, TRADE_VALUES, TIER_BUY_MARKUP, ALL_ITEMS, COMPLEX_STRUCTURES, EVENTS, STORY_MILESTONES, RENDER_CONFIG, LOG_COLORS, LOG_STYLES, CROPS, ENTITIES, EXPEDITION_ENEMIES, NPC_ENCOUNTERS, STAT_META, formatStatValue, getItemStatLines, getNestedEffectLines, getOnHitLines, RELATIONSHIP_TIERS, RAID_TYPES, REALMS, ENCHANT_COST_BY_TIER, RITUALS, RECIPES, SALVAGE_RATE, PRIORITY_PROFILES, EXPLORATION_CONFIG, WAVE_TYPES, WORLD_SIZE_COLONY } from '../core/config.js';
import { ROOM_SCORE_CAPS, ROOM_SIZE_BANDS, furnitureCountsFor } from '../world/rooms.js';
import { FURNITURE_TYPES, POWER_PRIORITY, PEDESTAL_CHARGE, RESEARCH } from '../core/config.js';
import { getRelationshipTier } from '../systems/social-utils.js';
import { getTradeRates, computeTradeValues } from '../systems/events.js';
import { getItemTradeValue, itemName, itemDescription } from '../entities/item-roll.js';
import { getComplexStructureAt, getSpellCooldownMult, hasRitualAltar } from '../systems/complexBuildings.js';
import { getTameChance } from '../entities/taming.js';
import { getAvailableRecipes } from '../systems/crafting.js';
import { getMaxCountBonus } from '../systems/building.js';
import { getTargetPriority, getThreatDisplayHtml, countByKey, adventurerLevelTooltip, animalLevelTooltip, escapeHtml, escapeAttr, jsArg, escapeHtmlKeepEntities, sanitizeHtml, isTouchUI, isCompactLayout, keyHint, haptic } from './ui-utils.js';
import { CROP_RESEARCH_REQS } from '../systems/farming.js';
import { t, tp, tHtml, defName, getLanguage, getAvailableLanguages } from '../core/i18n.js';
import { resourceName, buildingName, entityName, terrainName, buildCategoryName, recipeCategoryName, realmGroupName, priorityProfileName, stationGroupName } from '../core/names.js';
import { logEntryText, logEntryTime } from './eventlog.js';
import { getPedestalEffect, getPedestalCharge, getMaxPedestalCharge, getTilePedestalStats } from '../systems/artifacts.js';
import { getPowerTier } from '../systems/power.js';
import { getEquippedItems, getEquipmentStat, thoughtText } from '../entities/colonist.js';
import { getRoleInfoHtml, getEffectInfoHtml } from '../entities/roles.js';
import { waveScaling } from '../entities/entity-factory.js';
import { keybindingRowsHtml, beginRebindCapture, cancelRebindCapture, formatKeyLabel } from './keybindings-ui.js';
import { statBarHtml, runStatBarPass, statBarFactors } from './stat-bar.js';
import { installArcanePanel } from './ui-arcane.js';
import { getGdriveAPI } from '../core/gdrive-web.js';
import { installResearchPanel } from './ui-research.js';
import { installTutorialPanel } from './ui-tutorial.js';
import { installMapPanel } from './ui-map.js';
import { getAllSlotsMeta, exportSlot, getLastSyncTime, forceSyncNow } from '../core/save.js';

// How long the cursor must rest on a tile before its info tooltip appears.
const TILE_TOOLTIP_DELAY_MS = 600;
// Touch: hold time for a long press on the interface, and how far down from a bottom
// sheet's top edge a drag resizes the sheet rather than scrolling it.
const UI_LONG_PRESS_MS = 450;
const SHEET_GRAB_PX = 28;
// Where a long press stands in for right-click (priority cells cycle backwards).
const PRESS_MENU_TARGETS = '#priority-panel [data-colonist-id][data-skill], #priority-panel [data-profile-skill]';
const SHEET_PANELS = '#priority-panel, #craft-panel, #research-panel, #inventory-panel, #taming-panel, #settings-panel, #arcane-panel, #story-panel, #map-panel, #save-slot-ingame-panel';
// Mode-bar buttons that stay on the bar on narrow screens. The rest go in the More menu.
const COMPACT_NAV_PRIMARY = ['build', 'zone', 'gather', 'craft', 'research'];
const WEATHER_ICONS = { clear: '☀', rain: '☔', thunderstorm: '⛈', snow: '❄', blizzard: '❅', heatwave: '♨' };

// Skill/magic XP tooltip text, shared by the colonist tooltip refresh and the
// colonist info panel so both show identical "XP: x/y (z%)" (or "(MAX)") text.
function skillXpTip(def, skillKey, level, xp) {
    const maxXp = COLONIST_CONFIG.skillXpToLevel + level * COLONIST_CONFIG.skillXpScalePerLevel;
    const pct = Math.floor((xp / maxXp) * 100);
    const milestones = SKILL_MILESTONES[skillKey] || {};
    const lines = [];
    if (level >= COLONIST_CONFIG.skillMaxLevel) {
        lines.push(t('ui.colonist.skill_tip_max', { desc: def.description }));
    } else {
        lines.push(t('ui.colonist.skill_tip_xp', { desc: def.description, xp, max: maxXp, pct }));
    }
    for (const [threshold, m] of Object.entries(milestones).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const lvl = Number(threshold);
        const unlocked = level >= lvl;
        lines.push(t(unlocked ? 'ui.colonist.skill_milestone_done' : 'ui.colonist.skill_milestone', { lvl, desc: m.description }));
    }
    return lines.join('\n');
}

// Magic XP is stored as an accumulator scaled to /100 (max level hardcoded at 10).
function magicXpTip(def, level, acc) {
    const maxXp = MAGIC_STUDY_CONFIG.magicXpToLevel + level * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    const pct = Math.floor((acc / maxXp) * 100);
    return level >= 10
        ? t('ui.colonist.skill_tip_max', { desc: def.description })
        : t('ui.colonist.magic_tip_progress', { desc: def.description, pct });
}

function salvagePreview(item, game) {
    const recipe = Object.values(RECIPES).find(r => Object.keys(r.output)[0] === item.key);
    if (!recipe) return t('ui.inv.salvage_part', { n: 1, name: resourceName('planks') });
    const rate = game.research.isResearched('artisans_touch') ? WORK_CONFIG.artisanSalvageRate : SALVAGE_RATE;
    return Object.entries(recipe.input)
        .map(([res, amt]) => t('ui.inv.salvage_part', { n: Math.max(1, Math.floor(amt * rate)), name: resourceName(res) }))
        .join(', ');
}

// Realm name of an expedition. Saved expeditions keep an English realmName;
// read the realm's config name so it follows the language.
function expRealmName(exp) {
    return REALMS[exp.realm]?.name ?? exp.realmName ?? '';
}

// Display text for an expedition status id (gathering, exploring, returning, complete).
function expStatusName(status) {
    const names = { gathering: t('ui.info.exp_status_gathering'), exploring: t('ui.info.exp_status_exploring'), returning: t('ui.info.exp_status_returning'), complete: t('ui.info.exp_status_complete') };
    return names[status] || status;
}

// Colonist state ids (colonist.state) as display text.
function colonistStateName(state) {
    const names = {
        idle: t('ui.colonist.state_idle'), fighting: t('ui.colonist.state_fighting'), moving: t('ui.colonist.state_moving'),
        working: t('ui.colonist.state_working'), patrolling: t('ui.colonist.state_patrolling'), following: t('ui.colonist.state_following'),
        sleeping: t('ui.colonist.state_sleeping'), sheltering: t('ui.colonist.state_sheltering'), hunting: t('ui.colonist.state_hunting'),
        drafted: t('ui.colonist.state_drafted'), dead: t('ui.colonist.state_dead'), wandering: t('ui.colonist.state_wandering'),
        retreating: t('ui.colonist.state_retreating'), fleeing: t('ui.colonist.state_fleeing'), engaging: t('ui.colonist.state_engaging'),
        eating: t('ui.colonist.state_eating'),
    };
    return names[state] || state;
}

// Mood level ids from getMoodLabel() (also CSS classes) as display text.
function moodName(level) {
    const names = { inspired: t('ui.colonist.mood_inspired'), content: t('ui.colonist.mood_content'), stressed: t('ui.colonist.mood_stressed'), breaking: t('ui.colonist.mood_breaking') };
    return names[level] || level;
}

// Room quality tier name (rooms.js results carry the tier's locale prefix).
function roomTierName(q) {
    return defName({ _loc: q.tierLoc, name: q.tierName });
}

// Workshop focus group: one STATION_GROUPS label, or two joined with '/'.
function focusGroupName(group) {
    return String(group).split('/').map(g => stationGroupName(g)).join('/');
}

// Name of a tamed animal's species (tamed config, then wild config, then entity).
function tamedTypeName(type) {
    return TAMED_ANIMALS[type]?.name || ANIMALS[type]?.name || entityName(type);
}

// Button label for a recipe. Recipe keys are a verb plus the output
// (craft_iron_sword, brew_antidote), so the label is the verb's text with the
// output item's name.
function recipeLabel(key, recipe) {
    if (key === 'cook_meal') return t('ui.craft.recipe_cook_meal');
    if (key === 'repair_trinket') return t('ui.craft.recipe_repair_trinket');
    const verbs = {
        craft: 'ui.craft.recipe_craft', brew: 'ui.craft.recipe_brew', smelt: 'ui.craft.recipe_smelt',
        tan: 'ui.craft.recipe_tan', weave: 'ui.craft.recipe_weave', cook: 'ui.craft.recipe_cook',
    };
    const verb = key.split('_')[0];
    const output = Object.keys(recipe.output || {})[0];
    if (verbs[verb] && output) return t(verbs[verb], { item: resourceName(output) });
    return output ? resourceName(output) : key.replace(/_/g, ' ');
}

// Text of a saved ref ({ $t, p, fb } from ref()/defRef()) or plain string, with a
// fallback for older saves that only have the English text.
function refText(r, fallback) {
    if (r && typeof r === 'object' && typeof r.$t === 'string') return t(r.$t, r.p, r.fb ?? fallback);
    if (typeof r === 'string' && r) return r;
    return fallback ?? '';
}

// Bestiary kill records (wildlife, guardians, raiders, summons) are keyed by
// creature type in `sprite`; read the config name so it follows the language.
function killEntryName(entry) {
    if (entry.nameRef) return refText(entry.nameRef, entry.name);
    if (ENTITIES[entry.sprite]) return entityName(entry.sprite);
    return ANIMALS[entry.sprite]?.name || entry.name || '';
}

// Drops line of a bestiary kill record: the structured dropList when present,
// else the English `drops` string older saves stored.
function killDropsText(entry) {
    if (Array.isArray(entry.dropList)) {
        if (!entry.dropList.length) return t('ui.story.bestiary_drops_nothing');
        return entry.dropList.map(d => (d.chance != null
            ? t('ui.story.bestiary_drop_chance', { amount: d.amount, name: resourceName(d.item), pct: Math.round(d.chance * 100) })
            : t('ui.story.bestiary_drop', { amount: d.amount, name: resourceName(d.item) }))).join(t('msg.main.list_separator'));
    }
    return refText(entry.dropsRef, entry.drops || t('ui.story.bestiary_drops_nothing'));
}

// "Year 2, Spring" for a story milestone's unlock info.
function storyDate(info) {
    const s = String(info.season ?? '');
    return t('ui.story.unlock_date', { year: info.year, season: t(`season.${s}.name`, null, s.charAt(0).toUpperCase() + s.slice(1)) });
}

// Equipment set names are ids ('Colony', 'Expedition'); show them translated.
function equipSetName(name) {
    if (name === 'Colony') return t('ui.colonist.set_colony');
    if (name === 'Expedition') return t('ui.colonist.set_expedition');
    return name;
}

// Expedition canvas animation state, reset on a new game or load.
function freshExpVisState() {
    return { lastLogLen: 0, effects: [], partyX: 0, ambientParticles: [], shakeFrames: 0, flashFrames: 0, _prevExpStatus: null, _arriveFrame: 0, _seenDiscoveryTick: 0, _seenResolutionTick: 0, _seenFatigueTick: 0, _seenRallyTick: 0, summonLastPos: {} };
}

export class UI {
    constructor(game) {
        this.game = game;
        this.priorityPanelVisible = false;
        this.craftPanelVisible = false;
        this._colonistHudLocked = false;
        this.researchPanelVisible = false;
        this.inventoryVisible = false;
        this._invTab = 'resources';
        this._researchTab = 'foundations';
        this.settingsPanelVisible = false;
        this.saveSlotPanelVisible = false;
        this.arcanePanelVisible = false;
        this._arcaneTab = 'expeditions';
        this._arcaneExpSetup = null;
        this._lastArcaneHtml = '';
        this._expVisState = freshExpVisState();
        this.storyPanelVisible = false;
        this.mapPanelVisible = false;
        this._storyTab = 'colony';
        this._collapsedRealmGroups = new Set();
        this._collapsedBestiarySections = new Set();
        this._bossPhaseView = new Map();
        this._lastStoryHtml = '';
        this._storyNewAtOpen = new Set();
        this._lastStoryHasNew = false;
        this._lastResearchNeedsAttention = false;
        // Persistent per-bar animation state for live stat bars (see stat-bar.js),
        // keyed by globally-unique bar key. Survives the per-frame innerHTML swaps.
        this._statBarState = new Map();
        // The Colony Summary is a persistent footer in the info panel, shown
        // whenever the subject is not a living entity (i.e. nothing selected, or
        // a tile/structure is selected). Boots visible with nothing selected.
        this._summaryVisible = true;
        this.elements = {};
        this.initElements();
    }

    // addEventListener that records the listener so destroy() can remove it.
    // Use for anything outliving this UI instance: document, window, and the
    // persistent index.html panels (a new UI is built for every game).
    _listen(target, type, fn, opts) {
        if (!target) return;
        target.addEventListener(type, fn, opts);
        (this._listeners || (this._listeners = [])).push([target, type, fn, opts]);
    }

    initElements() {
        this.elements.statusBar = document.getElementById('status-bar');
        this._listen(document.getElementById('btn-pause'), 'click', () => { if (!this.game.paused) this.game.togglePause(); });
        this._listen(document.getElementById('btn-speed-1'), 'click', () => this.game.setSpeed(1));
        this._listen(document.getElementById('btn-speed-2'), 'click', () => this.game.setSpeed(2));
        this._listen(document.getElementById('btn-speed-3'), 'click', () => this.game.setSpeed(3));
        this._listen(document.getElementById('btn-settings'), 'click', () => this.game.toggleSettingsPanel());
        this.elements.infoPanel = document.getElementById('info-content');
        this.elements.colonySummary = document.getElementById('colony-summary');
        this._listen(this.elements.infoPanel, 'mouseleave', () => {
            // Only flush if the deferred HTML still belongs to the viewed colonist:
            // a selection change since it was queued makes it stale.
            if (this._pendingColonistInfoHtml && this._pendingColonistInfoId === this._viewingColonistId) {
                this.elements.infoPanel.innerHTML = this._pendingColonistInfoHtml;
                this._pendingColonistInfoHtml = null;
                // Set bar widths on the freshly-swapped elements right away so
                // they don't paint one static frame before the next pass.
                this.animateStatBars(0);
            }
        });
        this._listen(this.elements.infoPanel, 'click', (e) => {
            if (e.target.closest('[data-open-attune]')) {
                this._prioTab = 'attune';
                if (!this.priorityPanelVisible) this.togglePriorityPanel();
                else this.updatePriorityPanel();
            }
        });
        // The persistent Colony Summary defers its rebuild while hovered (so a
        // click on an alert row isn't lost to a mid-hover swap), then flushes.
        this._listen(this.elements.colonySummary, 'mouseleave', () => {
            if (this._pendingSummaryHtml) {
                this.elements.colonySummary.innerHTML = this._pendingSummaryHtml;
                this._pendingSummaryHtml = null;
                this.animateStatBars(0);
            }
        });
        // Colony Summary alert rows jump to the flagged colonist.
        this._listen(this.elements.colonySummary, 'click', (e) => {
            const alertRow = e.target.closest('.overview-alert[data-colonist-id]');
            if (alertRow) {
                this.game.selectColonistById(parseInt(alertRow.dataset.colonistId));
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
        this._listen(this.elements.colonistHud, 'mouseenter', () => { this._colonistHudHovered = true; });
        this._listen(this.elements.colonistHud, 'mouseleave', () => {
            this._colonistHudHovered = false;
            if (this._pendingHudHtml) {
                this.elements.colonistHud.innerHTML = this._pendingHudHtml;
                this._pendingHudHtml = null;
                this.animateStatBars(0);
            }
        });
        this.elements.researchPanel = document.getElementById('research-panel');
        this.elements.eventLog = document.getElementById('event-log');
        this.elements.inventoryPanel = document.getElementById('inventory-panel');
        this.elements.settingsPanel = document.getElementById('settings-panel');
        this.elements.arcanePanel = document.getElementById('arcane-panel');
        this.elements.storyPanel = document.getElementById('story-panel');
        this.elements.mapPanel = document.getElementById('map-panel');
        this.elements.saveSlotPanel = document.getElementById('save-slot-ingame-panel');

        this.initTutorialNote();

        this._listen(this.elements.storyPanel, 'click', (e) => {
            if (e.target.closest('[data-story-action="outro"]')) {
                this.game.startOutro();
                return;
            }
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
            const phaseNav = e.target.closest('[data-boss-phase-nav]');
            if (phaseNav) {
                e.stopPropagation();
                const key = phaseNav.dataset.bossPhaseNav;
                const dir = parseInt(phaseNav.dataset.bossPhaseDir, 10);
                const entry = this.game.exploration?.bestiary?.get(key);
                if (entry?.phases?.length) {
                    const cur = this._bossPhaseView.get(key) || 0;
                    const next = Math.max(0, Math.min(entry.phases.length - 1, cur + dir));
                    this._bossPhaseView.set(key, next);
                    this._lastStoryHtml = '';
                    this.updateStoryPanel();
                    window.soundManager?.playSFXPitched('button_click', dir > 0 ? 2 : -2);
                }
            }
        });

        this._listen(this.elements.arcanePanel, 'click', (e) => {
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

        this._listen(this.elements.craftPanel, 'click', (e) => {
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
            const tomeSchoolBtn = e.target.closest('[data-craft-tome-school]');
            if (tomeSchoolBtn) {
                if (!this._tomeHiddenSchools) this._tomeHiddenSchools = new Set();
                const s = tomeSchoolBtn.dataset.craftTomeSchool;
                if (this._tomeHiddenSchools.has(s)) this._tomeHiddenSchools.delete(s);
                else this._tomeHiddenSchools.add(s);
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                return;
            }
            const weaponTypeBtn = e.target.closest('[data-craft-weapon-type]');
            if (weaponTypeBtn) {
                if (!this._weaponHiddenTypes) this._weaponHiddenTypes = new Set();
                const t = weaponTypeBtn.dataset.craftWeaponType;
                if (this._weaponHiddenTypes.has(t)) this._weaponHiddenTypes.delete(t);
                else this._weaponHiddenTypes.add(t);
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                return;
            }
            const armorTypeBtn = e.target.closest('[data-craft-armor-type]');
            if (armorTypeBtn) {
                if (!this._armorHiddenTypes) this._armorHiddenTypes = new Set();
                const t = armorTypeBtn.dataset.craftArmorType;
                if (this._armorHiddenTypes.has(t)) this._armorHiddenTypes.delete(t);
                else this._armorHiddenTypes.add(t);
                this._lastCraftHtml = '';
                this.updateCraftPanel();
                return;
            }
        });

        this._listen(this.elements.researchPanel, 'click', (e) => {
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

        this._listen(this.elements.colonistHud, 'click', (e) => {
            const row = e.target.closest('[data-colonist-id]');
            if (row) {
                this.game.selectColonistById(parseInt(row.dataset.colonistId));
            }
        });

        this._listen(this.elements.notifications, 'click', (e) => this._onNotificationTap(e));

        // Drag-to-reorder colonist rows
        let _dragColonistId = null;
        this._listen(this.elements.colonistHud, 'dragstart', (e) => {
            const row = e.target.closest('[data-drag-colonist-id]');
            if (!row) return;
            if (this._colonistHudLocked) { e.preventDefault(); return; }
            _dragColonistId = parseInt(row.dataset.dragColonistId);
            row.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });
        const _clearDropIndicators = () => {
            this.elements.colonistHud.querySelectorAll('.hud-drop-before, .hud-drop-after, .hud-drop-target').forEach(el => {
                el.classList.remove('hud-drop-before', 'hud-drop-after', 'hud-drop-target');
            });
        };
        this._listen(this.elements.colonistHud, 'dragend', (e) => {
            const row = e.target.closest('[data-drag-colonist-id]');
            if (row) row.style.opacity = '';
            _dragColonistId = null;
            _clearDropIndicators();
        });
        this._listen(this.elements.colonistHud, 'dragover', (e) => {
            if (_dragColonistId == null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            _clearDropIndicators();
            const groupHeader = e.target.closest('.hud-group-header');
            if (groupHeader) {
                groupHeader.classList.add('hud-drop-target');
                return;
            }
            const target = e.target.closest('[data-drag-colonist-id]');
            if (target) {
                const rect = target.getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                target.classList.add(before ? 'hud-drop-before' : 'hud-drop-after');
            }
        });
        this._listen(this.elements.colonistHud, 'dragleave', (e) => {
            if (!this.elements.colonistHud.contains(e.relatedTarget)) {
                _clearDropIndicators();
            }
        });
        this._listen(this.elements.colonistHud, 'drop', (e) => {
            e.preventDefault();
            _clearDropIndicators();
            if (_dragColonistId == null) return;
            this._applyColonistDrop(_dragColonistId, e.target, e.clientY);
        });

        // Touch has no HTML5 drag-and-drop: hold a row to pick it up, slide, and lift to drop.
        // The list holds its re-renders while a row is up, as it does under a hovering mouse.
        let touchDrag = null;
        const indicateDropAt = (x, y) => {
            _clearDropIndicators();
            const el = document.elementFromPoint(x, y);
            const header = el?.closest('#colonist-hud .hud-group-header');
            if (header) { header.classList.add('hud-drop-target'); return; }
            const row = el?.closest('#colonist-hud [data-drag-colonist-id]');
            if (!row) return;
            const r = row.getBoundingClientRect();
            row.classList.add(y < r.top + r.height / 2 ? 'hud-drop-before' : 'hud-drop-after');
        };
        const endTouchDrag = () => {
            if (!touchDrag) return;
            clearTimeout(touchDrag.timer);
            touchDrag.row.style.opacity = '';
            _clearDropIndicators();
            if (touchDrag.lifted) {
                this._colonistHudHovered = false;
                if (this._pendingHudHtml) {
                    this.elements.colonistHud.innerHTML = this._pendingHudHtml;
                    this._pendingHudHtml = null;
                }
            }
            touchDrag = null;
        };
        this._listen(this.elements.colonistHud, 'touchstart', (e) => {
            endTouchDrag();
            if (e.touches.length !== 1 || this._colonistHudLocked) return;
            const row = e.target.closest('[data-drag-colonist-id]');
            if (!row) return;
            const t = e.touches[0];
            const drag = { id: parseInt(row.dataset.dragColonistId), row, x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY, lifted: false };
            drag.timer = setTimeout(() => {
                drag.lifted = true;
                this._colonistHudHovered = true;
                row.style.opacity = '0.4';
                this._suppressClickUntil = performance.now() + 5000;
                haptic(15);
            }, UI_LONG_PRESS_MS);
            touchDrag = drag;
        }, { passive: true });
        this._listen(this.elements.colonistHud, 'touchmove', (e) => {
            if (!touchDrag) return;
            const t = e.touches[0];
            if (!touchDrag.lifted) {
                // Moving before the hold completes is a scroll, not a pick-up.
                if (Math.hypot(t.clientX - touchDrag.startX, t.clientY - touchDrag.startY) > 8) endTouchDrag();
                return;
            }
            e.preventDefault();
            touchDrag.x = t.clientX;
            touchDrag.y = t.clientY;
            indicateDropAt(t.clientX, t.clientY);
        }, { passive: false });
        this._listen(this.elements.colonistHud, 'touchend', (e) => {
            if (!touchDrag) return;
            const { lifted, id, x, y } = touchDrag;
            endTouchDrag();
            if (!lifted) return;
            e.preventDefault();
            this._suppressClickUntil = performance.now() + 350;
            const el = document.elementFromPoint(x, y);
            if (el && this.elements.colonistHud.contains(el)) this._applyColonistDrop(id, el, y);
        }, { passive: false });
        this._listen(this.elements.colonistHud, 'touchcancel', endTouchDrag, { passive: true });

        this._listen(this.elements.eventLog, 'click', (e) => {
            const row = e.target.closest('[data-entity]');
            if (row) {
                const data = JSON.parse(row.dataset.entity);
                this.game.jumpToEntity(data.type, data.type === 'colonist' ? data.id : data);
            }
        });

        this._listen(this.elements.modeBar, 'click', (e) => {
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
            const overlayOpt = e.target.closest('[data-overlay]');
            if (overlayOpt) {
                this.game.input.actions[`toggle${overlayOpt.dataset.overlay}`]?.();
                this.updateModeDisplay(this.game.input);
                return;
            }
            const modeOpt = e.target.closest('[data-mode-action]');
            if (modeOpt) {
                this._runModeAction(modeOpt.dataset.modeAction);
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
        this._buildTooltipTimer = null;

        const buildOptClick = (e) => {
            if (e.target.closest('[data-mode-action="pan"]')) {
                this.game.input.toggleTouchPanMode();
                return;
            }
            if (e.target.closest('[data-mode-action="undo"]')) {
                this.game.input.undoLastPlacement();
                return;
            }
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
            this._buildTooltipTarget = null;
            this._hideBuildTooltip();
            this.game.input.buildType = buildType;
            this.updateModeDisplay(this.game.input);
            window.soundManager?.playSFXPitched('button_click', 0);
            if (isTouchUI() || 'ontouchstart' in window) {
                // No hover on touch: the tip stays up until the next touch elsewhere.
                clearTimeout(this._buildTooltipTimer);
                this._showBuildTooltip(opt);
                this._touchTipShown = true;
            }
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

        this._listen(this.elements.buildPanel, 'click', buildOptClick);
        this._listen(this.elements.buildPanel, 'mouseover', buildOptHover);
        this._listen(this.elements.buildPanel, 'mouseout', buildOptOut);
        this._listen(this.elements.buildPanel, 'mousemove', buildOptMove);

        this._listen(this.elements.modeBar, 'mouseover', buildOptHover);
        this._listen(this.elements.modeBar, 'mouseout', buildOptOut);
        this._listen(this.elements.modeBar, 'mousemove', buildOptMove);

        this._listen(this.elements.priorityPanel, 'click', (e) => {
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
                return;
            }
            const profileCell = e.target.closest('[data-profile-skill]');
            if (profileCell) {
                const skill = profileCell.dataset.profileSkill;
                if (!this._prioProfileDraft) return;
                const cur = this._prioProfileDraft[skill] ?? 3;
                this._prioProfileDraft[skill] = cur >= 5 ? 0 : cur + 1;
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
            }
            const delGroup = e.target.closest('[data-delete-group]');
            if (delGroup) {
                this.game.deleteColonistGroup(delGroup.dataset.deleteGroup);
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                return;
            }
            const addGroupBtn = e.target.closest('[data-add-group-confirm]');
            if (addGroupBtn) {
                const input = this.elements.priorityPanel.querySelector('[data-add-group-input]');
                const name = input ? input.value.trim() : '';
                if (name) {
                    this.game.createColonistGroup(null, name);
                    if (input) input.value = '';
                }
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                return;
            }
        });

        this._listen(this.elements.priorityPanel, 'contextmenu', (e) => {
            e.preventDefault();
            const cell = e.target.closest('[data-colonist-id][data-skill]');
            if (cell) {
                const colonistId = parseInt(cell.dataset.colonistId);
                const skill = cell.dataset.skill;
                this.game.cycleBackPriority(colonistId, skill);
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
                // sound fired inside cycleBackPriority with pitch based on new value
                return;
            }
            const profileCell = e.target.closest('[data-profile-skill]');
            if (profileCell) {
                const skill = profileCell.dataset.profileSkill;
                if (!this._prioProfileDraft) return;
                const cur = this._prioProfileDraft[skill] ?? 3;
                this._prioProfileDraft[skill] = cur <= 0 ? 5 : cur - 1;
                this._lastPrioHtml = null;
                this.updatePriorityPanel();
            }
        });

        this._listen(this.elements.priorityPanel, 'keydown', (e) => {
            if (e.key === 'Enter') {
                const input = e.target.closest('[data-add-group-input]');
                if (input) {
                    const name = input.value.trim();
                    if (name) this.game.createColonistGroup(null, name);
                    input.value = '';
                    this._lastPrioHtml = null;
                    this.updatePriorityPanel();
                }
            }
        });

        this._listen(this.elements.inventoryPanel, 'click', (e) => {
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
                return;
            }
            const gotoBtn = e.target.closest('[data-animal-goto]');
            if (gotoBtn) {
                window.game.centerOnAnimal(parseInt(gotoBtn.dataset.animalGoto));
                return;
            }
            const renameBtn = e.target.closest('[data-animal-rename]');
            if (renameBtn) {
                this._renamingAnimalId = parseInt(renameBtn.dataset.animalRename);
                this._releasingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                // Focus the input after render
                const input = this.elements.inventoryPanel.querySelector('[data-animal-rename-input]');
                if (input) { input.focus(); input.select(); }
                return;
            }
            const renameConfirm = e.target.closest('[data-animal-rename-confirm]');
            if (renameConfirm) {
                const id = parseInt(renameConfirm.dataset.animalRenameConfirm);
                const input = this.elements.inventoryPanel.querySelector(`[data-animal-rename-input="${id}"]`);
                if (input) this.game.renameAnimal(id, input.value);
                this._renamingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const renameCancel = e.target.closest('[data-animal-rename-cancel]');
            if (renameCancel) {
                this._renamingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const releaseBtn = e.target.closest('[data-animal-release]');
            if (releaseBtn) {
                this._releasingAnimalId = parseInt(releaseBtn.dataset.animalRelease);
                this._renamingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const releaseConfirm = e.target.closest('[data-animal-release-confirm]');
            if (releaseConfirm) {
                const id = parseInt(releaseConfirm.dataset.animalReleaseConfirm);
                this.game.releaseAnimalToWild(id);
                this._releasingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const releaseCancel = e.target.closest('[data-animal-release-cancel]');
            if (releaseCancel) {
                this._releasingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
        });

        this._listen(this.elements.inventoryPanel, 'change', (e) => {
            const rebondSel = e.target.closest('[data-animal-rebond]');
            if (rebondSel) {
                this.game.rebondAnimal(parseInt(rebondSel.dataset.animalRebond), parseInt(rebondSel.value));
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const rebondPetSel = e.target.closest('[data-animal-rebond-pet]');
            if (rebondPetSel) {
                this.game.rebondPet(parseInt(rebondPetSel.dataset.animalRebondPet), parseInt(rebondPetSel.value));
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                return;
            }
            const penSel = e.target.closest('[data-animal-pen]');
            if (penSel) {
                const [px, py] = penSel.value.split(',').map(Number);
                this.game.directAssignAnimalPen(parseInt(penSel.dataset.animalPen), px, py);
                this._lastInvHtml = null;
                this.updateInventoryPanel();
            }
        });

        this._listen(this.elements.inventoryPanel, 'keydown', (e) => {
            const input = e.target.closest('[data-animal-rename-input]');
            if (!input) return;
            if (e.key === 'Enter') {
                const id = parseInt(input.dataset.animalRenameInput);
                this.game.renameAnimal(id, input.value);
                this._renamingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                this._renamingAnimalId = null;
                this._lastInvHtml = null;
                this.updateInventoryPanel();
                e.preventDefault();
            }
        });

        this._listen(document, 'mousedown', (e) => {
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
                case 'map': this.toggleMapPanel(); break;
            }
        });

        const uiTooltip = document.getElementById('ui-tooltip');
        const _positionTooltip = (rect) => {
            let left = rect.left + rect.width / 2 - uiTooltip.offsetWidth / 2;
            let top = rect.top - uiTooltip.offsetHeight - 6;
            if (top < 4) top = rect.bottom + 6;
            if (left < 4) left = 4;
            if (left + uiTooltip.offsetWidth > window.innerWidth - 4) {
                left = window.innerWidth - uiTooltip.offsetWidth - 4;
            }
            uiTooltip.style.left = left + 'px';
            uiTooltip.style.top = top + 'px';
        };
        this._listen(document, 'mouseover', (e) => {
            const compareTip = e.target.closest('.skill-tip[data-compare]');
            if (compareTip) {
                uiTooltip.innerHTML = compareTip.dataset.compare;
                uiTooltip.style.opacity = '1';
                _positionTooltip(compareTip.getBoundingClientRect());
                return;
            }
            const tip = e.target.closest('.skill-tip[data-tip]');
            if (!tip) return;
            uiTooltip.textContent = tip.dataset.tip;
            uiTooltip.style.opacity = '1';
            _positionTooltip(tip.getBoundingClientRect());
        });
        this._listen(document, 'mouseout', (e) => {
            const compareTip = e.target.closest('.skill-tip[data-compare]');
            if (compareTip) {
                const related = e.relatedTarget;
                if (related && related.closest && related.closest('.skill-tip[data-compare]')) return;
                uiTooltip.style.opacity = '0';
                return;
            }
            const tip = e.target.closest('.skill-tip[data-tip]');
            if (!tip) return;
            const related = e.relatedTarget;
            if (related && related.closest && related.closest('.skill-tip[data-tip]')) return;
            uiTooltip.style.opacity = '0';
        });
        this._initTouchHelpers(uiTooltip, _positionTooltip);
    }

    // Touch has no hover and no right button. A held finger shows the tooltip a mouse would
    // get on hover (it stays until the next touch), and on a priority cell it lowers the
    // value the way right-click does. Bottom-sheet panels can be dragged by their top edge.
    _initTouchHelpers(uiTooltip, positionTooltip) {
        let press = null;
        let sheetDrag = null;
        this._touchTipShown = false;
        this._suppressContextMenuUntil = 0;
        const cancel = () => { if (press) clearTimeout(press.timer); press = null; };
        const fire = () => {
            const { el, kind, x, y } = press;
            press.fired = true;
            // Swallow the click the release may still produce (until shortly after touchend).
            this._suppressClickUntil = performance.now() + 5000;
            haptic(10);
            if (kind === 'menu') {
                this._suppressContextMenuUntil = performance.now() + 1000;
                // The panel may have re-rendered during the hold, so find the cell under the finger again.
                const cell = document.elementFromPoint(x, y)?.closest(PRESS_MENU_TARGETS);
                if (!cell) return;
                cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
                return;
            }
            if (kind === 'build') {
                this._showBuildTooltip(el);
                this._touchTipShown = true;
                return;
            }
            if (el.dataset.compare) uiTooltip.innerHTML = el.dataset.compare;
            else uiTooltip.textContent = el.dataset.tip || el.getAttribute('title') || '';
            if (!uiTooltip.textContent.trim()) return;
            uiTooltip.style.opacity = '1';
            positionTooltip(el.getBoundingClientRect());
            this._touchTipShown = true;
        };
        this._listen(document, 'touchstart', (e) => {
            cancel();
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            if (!e.target.closest?.('#ui-tooltip, #build-tooltip, #tile-tooltip')) this.dismissTouchTooltips();
            const sheet = isCompactLayout() && e.target.closest?.(SHEET_PANELS);
            if (sheet && t.clientY - sheet.getBoundingClientRect().top <= SHEET_GRAB_PX) {
                sheetDrag = { sheet, startY: t.clientY, startH: sheet.getBoundingClientRect().height, moved: false };
            }
            // Colonist rows use the hold to pick the row up (see the colonist list's touch drag).
            if (!this._colonistHudLocked && e.target.closest?.('#colonist-hud [data-drag-colonist-id]')) return;
            const menuEl = e.target.closest?.(PRESS_MENU_TARGETS);
            const tipEl = !menuEl && e.target.closest?.('.skill-tip[data-tip], .skill-tip[data-compare], .research-node[data-tip], [data-build-opt], [title]');
            const el = menuEl || tipEl;
            if (!el) return;
            const kind = menuEl ? 'menu' : el.dataset.buildOpt ? 'build' : 'tip';
            press = { el, kind, x: t.clientX, y: t.clientY, fired: false, timer: setTimeout(fire, UI_LONG_PRESS_MS) };
        }, { capture: true, passive: true });
        this._listen(document, 'touchmove', (e) => {
            const t = e.touches[0];
            if (press && !press.fired && Math.hypot(t.clientX - press.x, t.clientY - press.y) > 8) cancel();
            if (!sheetDrag) return;
            // The top strip is the handle: it never scrolls the sheet's content.
            e.preventDefault();
            const dy = t.clientY - sheetDrag.startY;
            if (!sheetDrag.moved && Math.abs(dy) < 8) return;
            sheetDrag.moved = true;
            const h = Math.max(120, Math.min(window.innerHeight * 0.94, sheetDrag.startH - dy));
            this._setSheetHeight(sheetDrag.sheet, h);
        }, { capture: true, passive: false });
        const end = (e) => {
            if (press?.fired) {
                e.preventDefault(); // the long press acted, so no click follows
                this._suppressClickUntil = performance.now() + 350;
            }
            cancel();
            if (sheetDrag?.moved) {
                const h = sheetDrag.sheet.getBoundingClientRect().height;
                // Dragged well down: treat it as a swipe to close.
                if (h < sheetDrag.startH * 0.55) {
                    this._setSheetHeight(sheetDrag.sheet, null);
                    this.game.input.handleEscape();
                }
            }
            sheetDrag = null;
        };
        this._listen(document, 'touchend', end, { capture: true, passive: false });
        this._listen(document, 'touchcancel', () => { cancel(); sheetDrag = null; }, { capture: true, passive: true });
        this._listen(document, 'click', (e) => {
            if (performance.now() >= (this._suppressClickUntil || 0)) return;
            this._suppressClickUntil = 0;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, { capture: true });
        // Android also fires its own contextmenu on a long press. One decrement is enough.
        this._listen(document, 'contextmenu', (e) => {
            if (e.isTrusted && performance.now() < this._suppressContextMenuUntil) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, { capture: true });
        // A tap outside the More menu closes it.
        this._listen(document, 'pointerdown', (e) => {
            if (this._moreMenuOpen && !e.target.closest?.('.more-menu, [data-mode-action="more"]')) this.closeMoreMenu();
        }, { capture: true });
    }

    // Moves a dragged colonist row to where it was dropped: onto a group header (top of that
    // group) or onto another row (before or after it, by which half `clientY` is in).
    _applyColonistDrop(draggedId, target, clientY) {
        const draggedColonist = this.game.getColonist(draggedId);
        if (!draggedColonist) return;

        // Drop onto a group header → move colonist to top of that group
        const groupHeader = target.closest('.hud-group-header[data-group-name]');
        if (groupHeader) {
            const groupName = groupHeader.dataset.groupName;
            draggedColonist.group = groupName || null;
            // Move dragged colonist to just after the first member of that group (or end)
            const cols = this.game.colonists;
            const fromIdx = cols.indexOf(draggedColonist);
            if (fromIdx !== -1) cols.splice(fromIdx, 1);
            const firstMemberIdx = cols.findIndex(c => c.group === (groupName || null));
            cols.splice(firstMemberIdx === -1 ? cols.length : firstMemberIdx, 0, draggedColonist);
            this.game.rebuildColonistIndex();
            this.forceUpdateColonistHud();
            if (this.game.selectedColonist) this.game.ui.showColonistInfo(this.game.selectedColonist);
            return;
        }

        // Drop onto another colonist row → place before/after that colonist and take their group
        const targetRow = target.closest('[data-drag-colonist-id]');
        if (targetRow) {
            const targetId = parseInt(targetRow.dataset.dragColonistId);
            if (targetId === draggedId) return;
            const targetColonist = this.game.getColonist(targetId);
            if (!targetColonist) return;

            // Determine insert before or after based on mouse Y within the target row
            const rect = targetRow.getBoundingClientRect();
            const insertBefore = clientY < rect.top + rect.height / 2;

            draggedColonist.group = targetColonist.group || null;

            const cols = this.game.colonists;
            const fromIdx = cols.indexOf(draggedColonist);
            if (fromIdx !== -1) cols.splice(fromIdx, 1);
            let toIdx = cols.indexOf(targetColonist);
            if (!insertBefore) toIdx += 1;
            cols.splice(toIdx, 0, draggedColonist);

            this.game.rebuildColonistIndex();
            this.forceUpdateColonistHud();
            if (this.game.selectedColonist) this.game.ui.showColonistInfo(this.game.selectedColonist);
        }
    }

    // Back to the stylesheet's sheet heights (used when leaving the narrow layout).
    resetSheetHeights() {
        for (const sheet of document.querySelectorAll(SHEET_PANELS)) this._setSheetHeight(sheet, null);
    }

    _setSheetHeight(sheet, h) {
        sheet.style.height = h == null ? '' : `${h}px`;
        sheet.style.maxHeight = h == null ? '' : `${h}px`;
        if (h == null) sheet.style.removeProperty('--sheet-h');
        else sheet.style.setProperty('--sheet-h', `${h}px`);
    }

    // Hides tooltips a long press (or a tap on a build card) left open.
    dismissTouchTooltips() {
        if (this._touchTipShown) {
            this._touchTipShown = false;
            const uiTooltip = document.getElementById('ui-tooltip');
            if (uiTooltip) uiTooltip.style.opacity = '0';
            this._hideBuildTooltip();
        }
        if (this._tileTipFromTouch) {
            this._tileTipFromTouch = false;
            this.hideTileTooltip();
        }
    }

    // Tile info for a long press on the map. px/py are relative to the map element.
    showTileTooltipAt(x, y, px, py) {
        this.hideTileTooltip();
        this._tipTile = { x, y };
        this._tipPos = { left: `${Math.max(4, px - 60)}px`, top: `${Math.max(4, py - 56)}px` };
        this._showTileTooltip(x, y);
        this._tileTipFromTouch = true;
        const tip = document.getElementById('tile-tooltip');
        const area = document.getElementById('game-area');
        if (tip && area) {
            const maxLeft = area.clientWidth - tip.offsetWidth - 4;
            tip.style.left = `${Math.max(4, Math.min(px - tip.offsetWidth / 2, maxLeft))}px`;
        }
    }

    // Tear down the listeners (document and persistent panels) and body-level
    // elements this instance added, so a UI from a finished game doesn't keep
    // reacting after Game.destroy().
    destroy() {
        cancelRebindCapture();
        this._removeResearchKeyboard?.();
        for (const [target, type, fn, opts] of this._listeners || []) target.removeEventListener(type, fn, opts);
        this._listeners = [];
        clearTimeout(this._tipTimer);
        clearTimeout(this._buildTooltipTimer);
        // Detach but keep the reference: listeners on persistent panel elements
        // may still touch it.
        this._buildTooltip?.remove();
        const uiTooltip = document.getElementById('ui-tooltip');
        if (uiTooltip) uiTooltip.style.opacity = '0';
    }

    // Reset all per-game UI view state after a load or new game, so nothing from
    // the previous game (selection, deferred panel HTML, cached panel strings,
    // open selection-dependent panels, half-done trades) leaks into this one.
    // Called by Game after the new state is in place.
    onGameLoaded() {
        cancelRebindCapture();
        this._closeAllPanels();
        // End any panel pause session without touching the loaded pause state.
        this._panelSessionActive = false;
        this._wasPausedBeforePanel = false;
        this._updateOverlay();
        this.hideTileTooltip();
        this._hideBuildTooltip();

        // Selection and deferred info-panel HTML.
        this._viewingColonistId = null;
        this._pendingColonistInfoHtml = null;
        this._pendingColonistInfoId = null;
        this._lastColonistInfoHtml = null;
        this._viewingRiftGate = false;
        this._viewingRitualAltar = false;
        this._riftPortalChain = null;
        this._lastTileInfo = null;
        this._colonistViewingSet = {};
        this._renamingAnimalId = null;
        this._releasingAnimalId = null;
        this._pendingSummaryHtml = null;
        this._lastSummaryHtml = null;
        this._pendingHudHtml = null;
        this._lastHudHtml = null;

        // Cached panel HTML / change-detection signatures.
        this._lastPrioHtml = null;
        this._prioProfileDraft = null;
        this._prioProfileDraftSource = null;
        this._lastCraftHtml = null;
        this._lastInvHtml = null;
        this._lastEventLogHtml = null;
        this._lastResearchHtml = null;
        this._lastStoryHtml = '';
        this._storyNewAtOpen = new Set();
        this._lastStoryHasNew = false;
        this._lastResearchNeedsAttention = false;
        this._lastManaCrystalBonus = undefined;
        this._lastExpPending = undefined;
        this._lastResHtml = null;
        this._lastColonyHtml = null;
        this._lastDatetimeHtml = null;
        this._lastStatusTick = -1;
        this._resPunchValues = {};
        this._notifSig = null;
        this._notifKeys = new Set();
        this._bossPhaseView.clear();
        this._statBarState.clear();

        // Event / trade panel.
        this._lastEventId = null;
        this._tradeOpen = false;
        this._tradeDirty = false;
        this._tradeOffer = null;
        this._tradeRequest = null;
        this._tradeGoldOffer = 0;
        if (this.elements.eventPanel) {
            this.elements.eventPanel.style.display = 'none';
            this.elements.eventPanel.className = '';
        }
        document.body.classList.remove('event-open');

        // Arcane / expedition panel.
        this._lastArcaneHtml = '';
        this._arcaneExpSetup = null;
        this._savedMutators = null;
        this._savedPotions = null;
        this._expVisState = freshExpVisState();

        // Rebuild what's always visible from the new state.
        this.showColonyOverview();
        this.forceStatusBarRefresh();
        this.forceUpdateColonistHud();
        if (this.game.input) this.updateModeDisplay(this.game.input);
    }

    update(skipArcane) {
        this.updateStatusBar();
        this.updateTouchToolbar();
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
        if (this.mapPanelVisible) this.updateMapPanel();
        if (this._viewingRiftGate) this._refreshRiftGateInfo();
        if (this._viewingColonistId != null) this._refreshColonistInfo();
        if (this._viewingRitualAltar) this._refreshRitualAltarInfo();
        if (this._summaryVisible) this._refreshColonySummary();
        const hasNew = this.game.story.hasUnviewed();
        const researchNeedsAtt = !this.game.research.activeResearch && this.game.research.hasAvailableResearch();
        const currentManaCrystalBonus = this.game.manaCrystalBonus || 0;
        const expPending = !!this.game.exploration?.expeditions?.some(e => !e.autoMode && (e.pendingDecision || e.pendingVoidPactChoice));
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

    // Advance every live stat bar one frame. Called unconditionally from the
    // game loop after all panel innerHTML swaps and before paint, so the
    // white-ghost recede keeps playing on frames with no value change and
    // freshly recreated bar elements are corrected from persisted state without
    // flashing. dt is the frame delta in ms (keeps 30/60fps durations equal).
    animateStatBars(dt) {
        const { fillK, leadK } = statBarFactors(dt);
        const seen = new Set();
        runStatBarPass(this.elements.infoPanel, this._statBarState, fillK, leadK, seen);
        runStatBarPass(this.elements.colonySummary, this._statBarState, fillK, leadK, seen);
        runStatBarPass(this.elements.colonistHud, this._statBarState, fillK, leadK, seen);
        if (this.arcanePanelVisible) {
            runStatBarPass(this.elements.arcanePanel, this._statBarState, fillK, leadK, seen);
        }
        // Prune state for bars that no longer exist in the DOM (entity died,
        // left the party, panel closed) so the Map can't grow without bound.
        for (const key of this._statBarState.keys()) {
            if (!seen.has(key)) this._statBarState.delete(key);
        }
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
        // Weather fields come from the save, so escape them before innerHTML.
        const season = escapeHtml(this.game.weather.getSeasonDisplay());
        const dayStr = escapeHtml(this.game.weather.getDayDisplay());
        const weather = escapeHtml(this.game.weather.getWeatherDisplay());
        const tempC = Math.round(this.game.weather.temperature);
        const useF = this.game.settings.temperatureUnit === 'F';
        const temp = useF ? Math.round(tempC * 9 / 5 + 32) : tempC;
        const tempUnit = useF ? 'F' : 'C';
        const speed = this.game.paused ? t('ui.main.paused') : t('ui.main.speed', { n: this.game.speed });
        const dayProgress = Math.floor((this.game.timeOfDay / CONFIG.TICKS_PER_DAY) * 24);
        const timeStr = `${String(dayProgress).padStart(2, '0')}:00`;
        const power = this.game.power;
        let manaStr = '';
        if (power.totalGenerated > 0) {
            const crystalCount = this.game.mapIndex.getStructurePositions('mana_crystal').size;
            const reservoirBonus = this.game.research.isResearched('mana_reservoir') ? 3 : 0;
            const crystalMax = 4 + (this.game.manaCrystalBonus || 0) + reservoirBonus;
            manaStr = power.unpowered.length > 0
                ? t('ui.main.mana_status_dark', { net: power.getNetPower(), crystals: crystalCount, max: crystalMax, dark: power.unpowered.length })
                : t('ui.main.mana_status', { net: power.getNetPower(), crystals: crystalCount, max: crystalMax });
        }
        const waves = this.game.waves;
        const voidEssence = r.void_essence || 0;
        const waveStr = waves.active ? t('ui.main.wave_status', { n: waves.currentWave }) : '';

        const alerts = CONFIG.STOCKPILE_ALERTS || {};
        const resStyle = (key, val) => (alerts[key] && val <= alerts[key]) ? ' style="color:#ff4444;font-weight:bold"' : '';
        const mgr = this.game.skinManager;
        const hasSkin = mgr && mgr.isActive;
        const RES_ABBR = { wood: t('ui.main.res_abbr_wood'), stone: t('ui.main.res_abbr_stone'), food: t('ui.main.res_abbr_food'), planks: t('ui.main.res_abbr_planks'), bricks: t('ui.main.res_abbr_bricks'), iron_ore: t('ui.main.res_abbr_iron_ore'), runite_ore: t('ui.main.res_abbr_runite_ore'), iron: t('ui.main.res_abbr_iron'), runite: t('ui.main.res_abbr_runite'), leather: t('ui.main.res_abbr_leather'), wool: t('ui.main.res_abbr_wool'), void_essence: t('ui.main.res_abbr_void_essence'), gold: t('ui.main.res_abbr_gold'), abyss_sliver: t('ui.main.res_abbr_abyss_sliver') };
        const resIcon = (key, label, color) => {
            if (hasSkin) {
                const url = mgr.getItemSpriteDataURL(key);
                if (url) return `<img src="${url}" style="width:12px;height:12px;vertical-align:middle;image-rendering:pixelated;margin-right:1px;" title="${escapeAttr(label)}">`;
            }
            return `<span style="color:${color};font-weight:bold;margin-right:1px;" title="${escapeAttr(label)}">${escapeHtml(RES_ABBR[key] || label.slice(0, 2))}</span>`;
        };
        const coreResources = [
            { key: 'gold', label: resourceName('gold'), color: '#ffdd00' },
            { key: 'wood', label: resourceName('wood'), color: '#8b6b3a', always: true },
            { key: 'stone', label: resourceName('stone'), color: '#999', always: true },
            { key: 'food', label: resourceName('food'), color: '#88cc44', always: true },
            { key: 'iron', label: resourceName('iron'), color: '#aaa' },
            { key: 'runite', label: resourceName('runite'), color: '#44ccff' },
            { key: 'void_essence', label: resourceName('void_essence'), color: '#9933ff' },
            { key: 'abyss_sliver', label: resourceName('abyss_sliver'), color: '#6600cc' },
        ];
        // Resource-counter punch: note which core resources changed value this
        // update so we can replay a quick grow/shrink on their span once the DOM
        // is rebuilt below. Compare the displayed (rounded) value so sub-integer
        // gold drips don't punch every tick. First sighting just seeds the value.
        if (!this._resPunchValues) this._resPunchValues = {};
        const punchedKeys = [];
        let resHtml = '';
        for (const res of coreResources) {
            const raw = r[res.key] || 0;
            const val = res.key === 'gold' ? (raw % 1 !== 0 ? raw.toFixed(1) : raw) : Math.round(raw);
            if (!res.always && raw === 0) continue;
            const prevVal = this._resPunchValues[res.key];
            if (prevVal !== undefined && prevVal !== val) punchedKeys.push(res.key);
            this._resPunchValues[res.key] = val;
            const alertAttr = resStyle(res.key, raw);
            let spoilSuffix = '';
            if (res.key === 'food') {
                const spoilPerDay = this.game.resources.estimateDailyCookedFoodSpoilage(this.game);
                const eatPerDay = this.game.resources.estimateDailyFoodConsumption(this.game);
                const totalPerDay = spoilPerDay + eatPerDay;
                if (totalPerDay > 0) {
                    const spoilClass = totalPerDay > eatPerDay * 1.25 ? 'spoil-warn' : 'spoil-ok';
                    const tip = t('ui.main.food_use_tip', { eaten: eatPerDay, spoiled: spoilPerDay });
                    spoilSuffix = `<span class="${spoilClass}" title="${escapeAttr(tip)}">${escapeHtml(t('ui.main.food_use_per_day', { n: totalPerDay }))}</span>`;
                }
            }
            resHtml += `<span class="res" data-res="${res.key}"${alertAttr}>${resIcon(res.key, res.label, res.color)}${val}${spoilSuffix}</span>`;
        }
        // Resources pod: the core resource chips plus mana (if generating).
        const resPodHtml = resHtml +
            (manaStr ? `<span class="res" style="color:${power.hasPower() ? '#aa44ff' : '#ff6666'}">${escapeHtml(manaStr)}</span>` : '');

        // Datetime pod: season/year, day, time, plus wave/badges.
        const datetimePodHtml =
            `<span class="info">${season}</span>` +
            `<span class="info status-extra">${dayStr}</span>` +
            `<span class="info">${timeStr}</span>` +
            (waveStr ? `<span class="info" style="color:#cc00ff">${escapeHtml(waveStr)}</span>` : '') +
            (CONFIG.PEACEFUL_MODE ? `<span class="peaceful">${escapeHtml(t('ui.main.badge_peaceful'))}</span>` : '') +
            (this.game.settings.demoMode ? `<span class="demo-mode">${escapeHtml(t('ui.main.badge_demo'))}</span>` : '');

        // Weather pod: icon, condition, temperature.
        const colonyPodHtml =
            `<span class="info status-extra">${this._getWeatherIcon()} ${weather} ${temp}°${tempUnit}</span>`;

        if (resPodHtml !== this._lastResHtml) {
            this._lastResHtml = resPodHtml;
            const resEl = document.getElementById('status-resources');
            if (resEl) {
                resEl.innerHTML = resPodHtml;
                // Punch the counters whose value just changed (skip under reduced
                // motion). innerHTML was just rebuilt, so each span is a fresh DOM
                // element; adding the class plays the keyframe once. The next value
                // change rebuilds the span again, which re-triggers it.
                if (punchedKeys.length && !this.game.settings.reduceMotion) {
                    for (const key of punchedKeys) {
                        const span = resEl.querySelector(`.res[data-res="${key}"]`);
                        if (span) span.classList.add('res-punch');
                    }
                }
            }
        }
        if (colonyPodHtml !== this._lastColonyHtml) {
            this._lastColonyHtml = colonyPodHtml;
            const weatherEl = document.getElementById('status-weather');
            if (weatherEl) weatherEl.innerHTML = colonyPodHtml;
        }
        if (datetimePodHtml !== this._lastDatetimeHtml) {
            this._lastDatetimeHtml = datetimePodHtml;
            const datetimeEl = document.getElementById('status-datetime');
            if (datetimeEl) datetimeEl.innerHTML = datetimePodHtml;
        }
        this._updateSpeedButtons();
    }

    _updateSpeedButtons() {
        const max = this.game.debugMaxSpeed || 3;
        const speedButtons = [{ id: 'btn-pause', active: this.game.paused }];
        for (let i = 1; i <= max; i++) {
            speedButtons.push({ id: `btn-speed-${i}`, active: !this.game.paused && this.game.speed === i });
        }
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
        this.updateTouchToolbar(true);
        const touch = isTouchUI();
        // No Esc key on a phone, so targeting gets a button to back out.
        const cancelBtn = touch ? `<span class="mode-opt mode-back" data-mode-action="cancel-target">${escapeHtml(t('common.cancel'))}</span>` : '';
        if (input.spellTargeting) {
            const { spell } = input.spellTargeting;
            let html = `<span class="mode-label" style="color:#bb88ff">${escapeHtml(t('ui.main.spell_target', { name: spell.name }))}</span>${cancelBtn}`;
            html += `<span class="mode-hint" style="color:#aa88ff">${escapeHtml(t(touch ? 'ui.main.spell_target_hint_touch' : 'ui.main.spell_target_hint', { range: spell.range || '∞' }))}</span>`;
            this.elements.modeBar.innerHTML = html;
            return;
        }
        if (input.guardPointTargeting) {
            const colonist = this.game.getColonist(input.guardPointTargeting.colonistId);
            let html = `<span class="mode-label" style="color:#88ff88">${escapeHtml(t('ui.main.guard_point_target', { name: colonist.name }))}</span>${cancelBtn}`;
            html += `<span class="mode-hint" style="color:#66ff66">${escapeHtml(t(touch ? 'ui.main.guard_point_hint_touch' : 'ui.main.guard_point_hint'))}</span>`;
            this.elements.modeBar.innerHTML = html;
            return;
        }
        if (input.mode !== 'normal') this._moreMenuOpen = false;
        const modeNames = { normal: t('ui.main.mode_normal'), build: t('ui.main.mode_build'), zone: t('ui.main.mode_zone'), designate: t('ui.main.mode_designate') };
        let html = `<span class="mode-label">${escapeHtml(t('ui.main.mode_label', { mode: modeNames[input.mode] || input.mode.toUpperCase() }))}</span>`;
        const backBtn = `<span class="mode-opt mode-back" data-mode-action="back">${keyHint('Esc')}${escapeHtml(t('common.back'))}</span>`;
        if (input.mode === 'build') {
            html += backBtn;
            const deconActive = input.deconstructMode ? ' active' : '';
            html += `<span class="mode-opt${deconActive}" data-mode-action="deconstruct" style="margin-left:8px;color:#ff6666">${keyHint('X')}${escapeHtml(t('ui.build.deconstruct'))}</span>`;
            html += `<span class="mode-hint">${escapeHtml(t(touch ? 'ui.build.mode_hint_touch' : 'ui.build.mode_hint'))}</span>`;
            this._updateBuildPanel(input);
        } else if (input.mode === 'zone') {
            html += backBtn;
            html += `<span class="mode-hint">${escapeHtml(t(touch ? 'ui.build.farm_hint_touch' : 'ui.build.farm_hint'))}</span>`;
            this._updateFarmPanel(input);
        } else if (input.mode === 'designate') {
            html += backBtn;
            html += `<span class="mode-hint">${escapeHtml(t(touch ? 'ui.build.gather_hint_touch' : 'ui.build.gather_hint'))}</span>`;
            this._updateGatherPanel(input);
        } else if (isCompactLayout()) {
            html = this._compactNavHtml();
        } else {
            const nav = this._navItems();
            html += '<span class="mode-options">';
            for (const item of nav) {
                const pulse = item.action === 'story' && item.badge ? ' story-new-pulse' : '';
                html += `<span class="mode-opt${pulse}" data-mode-action="${item.action}"${item.style ? ` style="${item.style}"` : ''}>${keyHint(item.key)}${escapeHtml(item.label)}${item.badgeHtml || ''}</span>`;
            }
            html += '</span>';
        }
        if (input.mode !== 'build' && input.mode !== 'zone' && input.mode !== 'designate') this._hideBuildPanel();
        this.elements.modeBar.innerHTML = html;
        if (this._moreMenuOpen) this._positionMoreMenu();

        const highlight = (action) => {
            const btn = this.elements.modeBar.querySelector(`[data-mode-action="${action}"]`)
                || this.elements.modeBar.querySelector('[data-mode-action="more"]');
            if (btn) btn.classList.add('tutorial-highlight');
        };
        if (input.mode === 'normal' && this.game.settings.showTutorial && this.game.tutorial) {
            const hl = this.game.tutorial.getHighlight();
            if (hl) highlight(hl);
        }
        if (this.game.exploration?.expeditions?.some(e => !e.autoMode && (e.pendingDecision || e.pendingVoidPactChoice))) {
            highlight('arcane');
        }
    }

    // The normal-mode buttons, in mode-bar order, with whatever badge each needs right now.
    _navItems() {
        const storyNew = this.game.story.hasUnviewed();
        const researchNeedsAttention = !this.game.research.activeResearch && this.game.research.hasAvailableResearch();
        const pendingAutoCount = this.game.exploration?.pendingAutoSummaries?.length || 0;
        return [
            { action: 'story', key: 'J', label: t('ui.main.nav_story'), badge: storyNew, badgeHtml: storyNew ? ' ✦' : '' },
            { action: 'build', key: 'B', label: t('ui.main.nav_build') },
            { action: 'zone', key: 'F', label: t('ui.main.nav_farm') },
            { action: 'gather', key: 'G', label: t('ui.main.nav_gather') },
            { action: 'priority', key: 'P', label: t('ui.main.nav_priority') },
            { action: 'craft', key: 'C', label: t('ui.main.nav_craft') },
            { action: 'research', key: 'R', label: t('ui.main.nav_research'), badge: researchNeedsAttention, style: researchNeedsAttention ? 'color:#ffcc44' : '', badgeHtml: researchNeedsAttention ? ' •' : '' },
            { action: 'inventory', key: 'I', label: t('ui.main.nav_inventory') },
            {
                action: 'arcane', key: 'V', label: t('ui.main.nav_rifts'), badge: pendingAutoCount > 0, style: pendingAutoCount > 0 ? 'color:#44ff88' : '',
                badgeHtml: pendingAutoCount > 0 ? ` <span style="background:#44ff88;color:#000;border-radius:8px;padding:0 4px;font-size:0.75em;">${pendingAutoCount}</span>` : '',
            },
            { action: 'map', key: 'M', label: t('ui.main.nav_map') },
        ];
    }

    // Narrow screens: one row of buttons that fits, with the rest (and the map overlays,
    // which otherwise only have hotkeys) in a More menu. The menu lives inside #mode-bar
    // so the tutorial's mode-bar selectors still find its items when it is open.
    _compactNavHtml() {
        const items = this._navItems();
        const primary = items.filter(i => COMPACT_NAV_PRIMARY.includes(i.action));
        const rest = items.filter(i => !COMPACT_NAV_PRIMARY.includes(i.action));
        const btn = (i) => `<button class="nav-btn" data-mode-action="${i.action}"${i.style ? ` style="${i.style}"` : ''}>${escapeHtml(i.label)}${i.badgeHtml || ''}</button>`;
        let html = '<div class="compact-nav">' + primary.map(btn).join('');
        const moreBadge = rest.some(i => i.badge) ? ' •' : '';
        html += `<button class="nav-btn${this._moreMenuOpen ? ' active' : ''}" data-mode-action="more"${moreBadge ? ' style="color:#ffcc44"' : ''}>${escapeHtml(t('ui.main.nav_more'))}${moreBadge}</button></div>`;
        if (this._moreMenuOpen) {
            const s = this.game.settings;
            html += '<div class="more-menu">';
            html += '<div class="more-menu-grid">' + rest.map(btn).join('') + '</div>';
            html += `<div class="more-menu-title">${escapeHtml(t('ui.main.map_overlays'))}</div><div class="more-menu-grid">`;
            for (const [name, label, on] of [
                ['WarmthOverlay', t('ui.main.overlay_warmth'), s.showWarmthOverlay], ['DefenseOverlay', t('ui.main.overlay_defense'), s.showDefenseOverlay],
                ['RoomOverlay', t('ui.main.overlay_rooms'), s.showRoomOverlay], ['AuraOverlay', t('ui.main.overlay_auras'), s.showAuraOverlay],
            ]) {
                html += `<button class="nav-btn${on ? ' active' : ''}" data-overlay="${name}">${escapeHtml(label)}</button>`;
            }
            html += `</div><div class="more-menu-grid"><button class="nav-btn" data-mode-action="settings">${escapeHtml(t('ui.main.nav_settings'))}</button></div></div>`;
        }
        return html;
    }

    _positionMoreMenu() {
        const menu = this.elements.modeBar.querySelector('.more-menu');
        if (menu) menu.style.bottom = `${Math.max(0, window.innerHeight - this.elements.modeBar.getBoundingClientRect().top) + 4}px`;
    }

    // Returns true if the menu was open (so Esc / Back stops there).
    closeMoreMenu() {
        if (!this._moreMenuOpen) return false;
        this._moreMenuOpen = false;
        this.updateModeDisplay(this.game.input);
        return true;
    }

    _runModeAction(action) {
        const input = this.game.input;
        if (action !== 'more' && this._moreMenuOpen) {
            this._moreMenuOpen = false;
            this.updateModeDisplay(input);
        }
        switch (action) {
            case 'more': this._moreMenuOpen = !this._moreMenuOpen; this.updateModeDisplay(input); break;
            case 'back': input.setMode('normal'); break;
            case 'cancel-target': input.handleEscape(); break;
            case 'pan': input.toggleTouchPanMode(); break;
            case 'undo': input.undoLastPlacement(); break;
            case 'build': input.setMode('build'); break;
            case 'zone': input.setMode('zone'); break;
            case 'gather': input.setMode('designate'); break;
            case 'deconstruct': input.toggleDeconstructMode(); break;
            case 'priority': this.togglePriorityPanel(); break;
            case 'craft': this.toggleCraftPanel(); break;
            case 'research': this.toggleResearchPanel(); break;
            case 'inventory': this.toggleInventoryPanel(); break;
            case 'settings': this.toggleSettingsPanel(); break;
            case 'arcane': this.toggleArcanePanel(); break;
            case 'story': this.toggleStoryPanel(); break;
            case 'map': this.toggleMapPanel(); break;
        }
    }

    // Phone button bar: only the buttons that do something right now, so it stays one row.
    // `force` re-applies even if nothing changed (after the layout or mode changes).
    updateTouchToolbar(force) {
        const bar = document.getElementById('touch-toolbar');
        if (!bar) return;
        const input = this.game.input;
        const selected = (this.game.selectedColonists || []).filter(c => c.hp > 0);
        const hasSel = selected.length > 0;
        const allDrafted = hasSel && selected.every(c => c.drafted);
        const mode = input?.mode || 'normal';
        const sig = `${mode}|${hasSel}|${allDrafted}|${input?.rallyMode}|${input?.destroyMode}`;
        if (!force && sig === this._toolbarSig) return;
        this._toolbarSig = sig;
        const normal = mode === 'normal';
        const show = (id, on) => { const b = document.getElementById(id); if (b) b.hidden = !on; };
        show('touch-destroy-btn', normal && !hasSel);
        show('touch-selectall-btn', normal && !hasSel);
        show('touch-rally-btn', normal && (hasSel || input?.rallyMode));
        show('touch-draft-btn', normal && hasSel);
        show('touch-prev-btn', normal && hasSel);
        show('touch-next-btn', normal && hasSel);
        show('touch-center-btn', normal && hasSel);
        show('touch-idle-btn', normal);
        const draft = document.getElementById('touch-draft-btn');
        if (draft) draft.textContent = allDrafted ? t('ui.main.undraft') : t('ui.main.draft');
        // Build, farm and gather have their own bottom panel.
        bar.classList.toggle('toolbar-hidden', !normal);
    }

    _updateBuildPanel(input) {
        const panel = this.elements.buildPanel;
        if (!panel) return;
        let html = '<div class="build-panel-header"><div class="build-panel-tabs">';
        BUILD_CATEGORIES.forEach(cat => {
            const active = cat === input.buildCategory ? ' active' : '';
            html += `<span class="build-tab${active}" data-build-cat="${escapeAttr(cat)}">${escapeHtml(buildCategoryName(cat))}</span>`;
        });
        html += '</div>' + this._buildPanelControls() + '</div>';
        html += '<div class="build-grid">';
        input.buildOptions.forEach((opt, i) => {
            const active = opt === input.buildType ? ' active' : '';
            const def = BUILDINGS[opt];
            const keyLabel = i < 9 ? i + 1 : (i === 9 ? '0' : '');
            const locked = this.isBuildingLocked(opt);
            const atMax = !locked && this.isBuildingAtMax(opt);
            const canAfford = !locked && !atMax && this.game.resources.has(def.cost);
            let stateClass = locked ? ' build-card--locked' : atMax ? ' build-card--maxed' : !canAfford ? ' build-card--unaffordable' : '';
            const isFloorType = def.structureType === 'floor';
            const bldSprite = this.game.skinManager?.isActive && (
                isFloorType
                    ? this.game.skinManager.getSprite('floors', opt)
                    : this.game.skinManager.getSprite('buildings', opt)
            );
            const bldIcon = bldSprite
                ? `<img src="${this._getBuildingSpriteURL(opt, isFloorType)}" class="build-card-icon--sprite">`
                : `<span style="color:${escapeAttr(def.color)}">${escapeHtml(def.char)}</span>`;
            const costHtml = Object.entries(def.cost).map(([k, v]) => this._buildCostChip(k, v)).join('');
            const overlayHtml = locked ? `<span class="build-card-overlay">${escapeHtml(t('ui.build.card_locked'))}</span>` : atMax ? `<span class="build-card-overlay">${escapeHtml(t('ui.build.card_max'))}</span>` : '';
            html += `<div class="build-card${active}${stateClass}" data-build-opt="${escapeAttr(opt)}">`;
            html += `<div class="build-card-key">${keyLabel}</div>`;
            html += `<div class="build-card-icon-wrap">${bldIcon}</div>`;
            html += `<div class="build-card-name">${escapeHtml(buildingName(opt))}</div>`;
            html += `<div class="build-card-cost">${costHtml}</div>`;
            html += overlayHtml;
            html += `</div>`;
        });
        html += '</div>';
        if (input.buildType === 'arcane_core') {
            const availableStructures = Object.entries(COMPLEX_STRUCTURES).filter(([, def]) =>
                !def.research || this.game.research.isResearched(def.research)
            );
            if (availableStructures.length > 0) {
                const current = input._complexStructurePreview || '';
                const opts = availableStructures.map(([k, def]) =>
                    `<option value="${escapeAttr(k)}"${current === k ? ' selected' : ''}>${escapeHtml(def.name)}</option>`
                ).join('');
                html += `<div style="padding:6px 8px;background:#1a1a2e;border-top:1px solid #333;">` +
                    `<div style="color:#888;font-size:10px;margin-bottom:3px;">${escapeHtml(t('ui.build.preview_chalk'))}</div>` +
                    `<select id="complex-struct-select" style="width:100%;background:#222;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 4px;font-size:12px;" onchange="window.game.input._complexStructurePreview=this.value">` +
                    `<option value="">${escapeHtml(t('ui.build.preview_chalk_none'))}</option>${opts}</select></div>`;
            }
        }
        const savedBuildScroll = panel.querySelector('.build-grid')?.scrollTop ?? 0;
        panel.innerHTML = html;
        const buildGrid = panel.querySelector('.build-grid');
        if (buildGrid) buildGrid.scrollTop = savedBuildScroll;
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
        let html = `<div class="build-panel-header"><div class="build-panel-title">${escapeHtml(t('ui.build.farm_title'))}</div>`;
        html += this._buildPanelControls() + '</div>';
        html += '<div class="build-grid">';
        input.cropOptions.forEach((opt, i) => {
            const crop = CROPS[opt];
            const req = CROP_RESEARCH_REQS[opt];
            const locked = req && !this.game.research.isResearched(req);
            const active = opt === input.cropType ? ' active' : '';
            const stateClass = locked ? ' build-card--locked' : '';
            const keyLabel = i < 9 ? i + 1 : (i === 9 ? '0' : '');
            const overlayHtml = locked ? `<span class="build-card-overlay">${escapeHtml(t('ui.build.card_locked'))}</span>` : '';
            const seasons = crop.seasons.map(s => t(`season.${s}.name`, null, s).charAt(0).toUpperCase()).join('');
            html += `<div class="build-card${active}${stateClass}" data-crop-opt="${opt}">`;
            html += `<div class="build-card-key">${keyLabel}</div>`;
            const cropSpriteURL = this.game.skinManager?.isActive && this._getCropSpriteURL(opt + '_ready');
            const cropIcon = cropSpriteURL
                ? `<img src="${cropSpriteURL}" class="build-card-icon--sprite">`
                : `<span style="color:${crop.color}">${crop.readyChar}</span>`;
            html += `<div class="build-card-icon-wrap">${cropIcon}</div>`;
            html += `<div class="build-card-name">${escapeHtml(crop.name || resourceName(opt))}</div>`;
            html += `<div class="build-card-cost"><span class="cost-chip" style="color:#88cc44">${escapeHtml(t('ui.build.crop_yield', { n: crop.harvestYield }))}</span><span class="cost-chip" style="color:#aaa">${escapeHtml(seasons)}</span></div>`;
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
        let html = `<div class="build-panel-header"><div class="build-panel-title">${escapeHtml(t('ui.build.gather_title'))}</div>`;
        html += this._buildPanelControls() + '</div>';
        html += '<div class="build-grid">';
        const chopActive = input.designateMode === 'chop' ? ' active' : '';
        const mineActive = input.designateMode === 'mine' ? ' active' : '';
        const axeURL = this.game.skinManager?.isActive && this.game.skinManager.getItemSpriteDataURL('iron_axe');
        const chopIcon = axeURL
            ? `<img src="${axeURL}" class="build-card-icon--sprite">`
            : `<span style="color:#44aa22">♣</span>`;
        html += `<div class="build-card${chopActive}" data-designate-mode="chop">`;
        html += `<div class="build-card-key">1</div>`;
        html += `<div class="build-card-icon-wrap">${chopIcon}</div>`;
        html += `<div class="build-card-name">${escapeHtml(t('ui.build.gather_chop'))}</div>`;
        html += `<div class="build-card-cost"><span class="cost-chip" style="color:#8b6b3a">${escapeHtml(resourceName('wood'))}</span></div>`;
        html += `</div>`;
        const pickURL = this.game.skinManager?.isActive && this.game.skinManager.getItemSpriteDataURL('iron_pickaxe');
        const mineIcon = pickURL
            ? `<img src="${pickURL}" class="build-card-icon--sprite">`
            : `<span style="color:#999">▲</span>`;
        html += `<div class="build-card${mineActive}" data-designate-mode="mine">`;
        html += `<div class="build-card-key">2</div>`;
        html += `<div class="build-card-icon-wrap">${mineIcon}</div>`;
        html += `<div class="build-card-name">${escapeHtml(t('ui.build.gather_mine'))}</div>`;
        html += `<div class="build-card-cost"><span class="cost-chip" style="color:#999">${escapeHtml(resourceName('stone'))}</span></div>`;
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

    // Header buttons for the build, farm and gather panels. On touch a Pan toggle lets one
    // finger move the map instead of drawing a selection (two fingers always pan).
    _buildPanelControls() {
        const pan = isTouchUI()
            ? `<span class="build-panel-pan${this.game.input?.touchPanMode ? ' active' : ''}" data-mode-action="pan">${escapeHtml(t('ui.build.pan'))}</span>`
            : '';
        const undo = isTouchUI() && this.game.input?.canUndoPlacement
            ? `<span class="build-panel-undo" data-mode-action="undo">${escapeHtml(t('ui.build.undo'))}</span>`
            : '';
        return `${undo}${pan}<span class="build-panel-close" data-mode-action="back">${keyHint('Esc')}${isTouchUI() ? '' : ' '}${escapeHtml(t('common.close'))}</span>`;
    }

    _hideBuildPanel() {
        const panel = this.elements.buildPanel;
        if (panel) panel.style.display = 'none';
    }

    // Enemy count, per-type HP and a rough threat rating for a wave. Uses the same
    // composition (WAVE_TYPES) and scaling (waveScaling) as the spawner.
    getWavePreview(waveNum) {
        const enemies = WAVE_CONFIG.baseEnemies + WAVE_CONFIG.enemiesPerWave * (waveNum - 1);
        const { hpMult, damageMult } = waveScaling(waveNum);
        // Every wave type's eligible entries, weighted, as the spawner rolls them.
        const weights = {};
        for (const wt of Object.values(WAVE_TYPES)) {
            for (const c of wt.composition) {
                if (c.minWave && waveNum < c.minWave) continue;
                weights[c.entity] = (weights[c.entity] || 0) + (c.weight || 1);
            }
        }
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
        const parts = [];
        let wavePower = 0;
        for (const [type, w] of Object.entries(weights)) {
            const def = ENTITIES[type];
            if (!def) continue;
            const hp = Math.floor(def.hp * (1 + hpMult));
            const dmg = Math.floor((def.damage || 0) * (1 + damageMult));
            parts.push(t('ui.main.wave_preview_part', { name: def.name, hp }));
            wavePower += enemies * (w / totalWeight) * hp * dmg;
        }
        let text = escapeHtml(t('ui.main.wave_preview', { n: enemies, parts: parts.join(', ') }));
        // Threat compares wave HP x damage against the fighters at home (HP x weapon DPS).
        // It ignores turrets, spells and terrain, so it is a rough guide, not a forecast.
        const fighters = this.game.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.golem);
        const colonyPower = fighters.reduce((sum, c) => {
            const w = c.weapon || WEAPONS.fists;
            return sum + c.maxHp * (w.damage / (w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown));
        }, 0);
        if (colonyPower > 0 && wavePower > 0) {
            const ratio = wavePower / colonyPower;
            const [label, color] = ratio < 0.5 ? [t('ui.main.threat_low'), '#66dd66'] : ratio < 1 ? [t('ui.main.threat_manageable'), '#ccdd55'] : ratio < 2 ? [t('ui.main.threat_risky'), '#ffaa44'] : [t('ui.main.threat_deadly'), '#ff4444'];
            text += ` <span style="color:${color}">${escapeHtml(t('ui.main.threat_rating', { label, ratio: ratio.toFixed(1) }))}</span>`;
        }
        return text;
    }

    _refreshRiftGateInfo() {
        if (!this.game.exploration) return;
        const hasActive = this.game.exploration.expeditions.length > 0;
        const hasCompleted = this.game.exploration.completedExpeditions.length > 0;
        if (!hasActive && !hasCompleted) return;
        const riftSection = this.elements.infoPanel.querySelector('[data-rift-info]');
        if (!riftSection) return;
        // Compare against the last built string (innerHTML re-serializes, so it
        // never matches), and hold the swap while a button is hovered so a
        // progress tick can't replace it mid-click.
        const html = this._buildRiftGateInnerHtml();
        if (html === riftSection._lastHtml || riftSection.querySelector('button:hover')) return;
        const firstRefresh = riftSection._lastHtml === undefined;
        riftSection._lastHtml = html;
        // Keep each log's scroll position; only follow new entries when the
        // reader was already at the bottom.
        const logs = [...riftSection.querySelectorAll('.exp-log-container')].map(el => ({
            top: el.scrollTop,
            atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4,
        }));
        riftSection.innerHTML = html;
        riftSection.querySelectorAll('.exp-log-container').forEach((el, i) => {
            const prev = logs[i];
            el.scrollTop = firstRefresh || !prev || prev.atBottom ? el.scrollHeight : prev.top;
        });
    }

    _refreshColonistInfo() {
        const colonist = this.game.getColonist(this._viewingColonistId);
        if (!colonist) {
            // The viewed colonist died or was removed: fall back to the summary.
            this._viewingColonistId = null;
            this.showColonyOverview();
            return;
        }
        const html = this.buildColonistInfoHtml(colonist);
        if (html !== this._lastColonistInfoHtml) {
            this._lastColonistInfoHtml = html;
            if (this.elements.infoPanel.matches(':hover')) {
                this._pendingColonistInfoHtml = html;
                this._pendingColonistInfoId = colonist.id;
                this._updateSkillTooltips(colonist);
            } else {
                this.elements.infoPanel.innerHTML = html;
                this._pendingColonistInfoHtml = null;
            }
        }
    }

    _updateSkillTooltips(colonist) {
        // Spans carry the skill key (data-skill / data-magic); matching on the
        // displayed name would break once names are translated.
        const tips = this.elements.infoPanel.querySelectorAll('.skill-tip[data-tip]');
        for (const tip of tips) {
            const k = tip.dataset.skill;
            if (k && SKILLS[k]) {
                tip.dataset.tip = skillXpTip(SKILLS[k], k, colonist.skills[k] || 1, colonist.skillXp?.[k] || 0);
                continue;
            }
            const m = tip.dataset.magic;
            if (m && MAGIC_SKILLS[m]) {
                tip.dataset.tip = magicXpTip(MAGIC_SKILLS[m], colonist.magicSkills[m], colonist.magicXpAccumulator?.[m] || 0) + (tip.dataset.attuned ? t('ui.colonist.attuned_suffix') : '');
            }
        }
    }

    _buildGolemForgeHtml() {
        if (!this.game.research.isResearched('golem_craft')) {
            return `<div class="info-row" style="color:#888;">${escapeHtml(t('ui.tile.golem_requires_research'))}</div>`;
        }
        let html = `<div class="info-row" style="color:#cc8833;font-weight:bold;">${escapeHtml(t('ui.tile.golem_forge'))}</div>`;
        html += `<div class="info-row" style="margin-top:4px;"><b>${escapeHtml(t('ui.tile.golem_craft'))}</b></div>`;
        for (const [key, def] of Object.entries(GOLEM_TYPES)) {
            const costStr = Object.entries(def.cost).map(([r, n]) => t('ui.inv.salvage_part', { n, name: resourceName(r) })).join(', ');
            const canAfford = this.game.resources.has(def.cost);
            html += `<div class="info-actions"><button ${canAfford ? '' : 'disabled'} onclick="window.game.craftGolem('${key}')" style="background:#553311;color:#ffcc88;">${escapeHtml(def.name)}</button> <span style="color:#aaa;font-size:0.85em">${escapeHtml(costStr)}</span></div>`;
            html += `<div class="info-row" style="color:#888;font-size:0.85em;margin-bottom:4px;">${escapeHtml(t('ui.tile.golem_specialty', { specialty: SKILLS[def.specialty]?.name || def.specialty, skill: def.skillLevel || '-', hp: def.hp }))}</div>`;
        }
        return html;
    }

    // Records which realm chain the selected portal serves (null for the legacy Rift
    // Gate, which serves all of them) and returns whether a portal is selected.
    // Short help lines for the crypt structures (chest, anchor, ward) on a selected tile.
    _buildCryptInfoHtml(tile, x, y) {
        if (tile.sealed) return '';
        const ruin = this.game.ruins.getRuinAt(x, y);
        if (!ruin) return '';
        let text = '';
        if (tile.structure === 'ancient_chest') {
            text = tile.designation ? t('ui.tile.chest_marked') : t('ui.tile.chest_sealed');
        } else if (tile.structure === 'rift_anchor') {
            const name = CRYPT_CONFIG.chainNames[ruin.anchor?.chain];
            text = tile.designation
                ? t('ui.tile.anchor_marked')
                : name ? t('ui.tile.anchor_dormant', { name }) : t('ui.tile.anchor_dormant_unknown');
        } else if (tile.structure === 'warded_wall' && ruin.ward) {
            text = t('ui.tile.warded_wall', { ward: this.game.ruins.wardText(ruin) });
        }
        return text ? `<div class="info-row" style="color:#d4a84a;">${escapeHtml(text)}</div>` : '';
    }

    _setRiftPortal(tile, x, y) {
        this._riftPortalChain = tile.structure === 'rift_anchor_active'
            ? (this.game.ruins.getRuinAt(x, y)?.anchor?.chain || null)
            : null;
        this._riftPortalTitle = tile.structure === 'gathering_circle' ? t('ui.tile.portal_gathering_circle')
            : this._riftPortalChain ? t('ui.tile.portal_rift_anchor') : t('ui.tile.portal_rift_gate');
        return tile.structure === 'rift_gate' || tile.structure === 'rift_anchor_active' || tile.structure === 'gathering_circle';
    }

    _buildRiftGateHtml() {
        return `<div data-rift-info="1">${this._buildRiftGateInnerHtml()}</div>`;
    }

    _buildRiftGateInnerHtml() {
        const expl = this.game.exploration;
        let html = `<div class="info-row" style="color:#33ccff;font-weight:bold;">${escapeHtml(this._riftPortalTitle || t('ui.tile.portal_rift_gate'))}</div>`;

        const watchedExps = expl.expeditions.filter(e => !e.autoMode);
        const autoRunning = expl.expeditions.filter(e => e.autoMode).length;
        if (watchedExps.length > 0) {
            for (const exp of watchedExps) {
                if (exp.status === 'gathering') {
                    const names = exp.partyIds.map(id => {
                        const c = this.game.getColonist(id);
                        return c ? c.name : '?';
                    }).join(', ');
                    html += `<div class="info-row" style="color:#aaddff;">${escapeHtml(t('ui.tile.exp_assembling', { realm: expRealmName(exp) }))}</div>`;
                    html += `<div class="info-row" style="color:#888;">${escapeHtml(t('ui.tile.exp_party', { names }))}</div>`;
                } else {
                    const elapsed = this.game.tick - exp.startTick;
                    const totalDur = Math.floor(exp.duration * 1.2);
                    const pct = Math.min(100, Math.floor((elapsed / totalDur) * 100));
                    const statusText = expStatusName(exp.status);
                    html += `<div class="info-row" style="color:#aaddff;">${escapeHtml(t(exp.combat ? 'ui.tile.exp_progress_combat' : 'ui.tile.exp_progress', { realm: expRealmName(exp), status: statusText, pct }))}</div>`;

                    const aliveParty = exp.partySnapshot.filter(p => p.hp > 0);
                    html += `<div class="info-row" style="color:#888;">${escapeHtml(t('ui.tile.exp_party_alive', { alive: aliveParty.length, total: exp.partySnapshot.length }))}</div>`;
                    for (const p of exp.partySnapshot) {
                        const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
                        const color = p.hp <= 0 ? '#664444' : hpPct < 30 ? '#ff4444' : hpPct < 60 ? '#ffaa44' : '#88cc88';
                        const status = p.hp <= 0 ? t('ui.tile.exp_member_down') : '';
                        const manaStr = p.maxMana > 0 ? t('ui.tile.exp_member_mp', { mp: Math.round(p.mana), max: p.maxMana }) : '';
                        const shieldStr = p.shieldActive ? ' 🛡' : '';
                        const threatStr = getThreatDisplayHtml(getTargetPriority(p));
                        html += `<div class="info-row" style="color:${color}; padding-left:8px;">${escapeHtml(t('ui.tile.exp_member_hp', { name: p.name, hp: Math.max(0, Math.round(p.hp)), max: p.maxHp }))}${escapeHtml(manaStr)}${shieldStr}${escapeHtml(status)}${threatStr}</div>`;
                    }

                    if (exp.combat) {
                        const enemiesAlive = exp.combat.enemies.filter(e => e.hp > 0).length;
                        html += `<div class="info-row" style="color:#ff8844; margin-top:4px;">${escapeHtml(t('ui.tile.exp_enemies_remaining', { n: enemiesAlive, total: exp.combat.enemies.length }))}</div>`;
                    }

                    html += `<div class="exp-log-container">`;
                    const logSlice = exp.log.slice(-25);
                    for (const entry of logSlice) {
                        const color = this._expLogColor(entry.type);
                        const st = this._expLogStyle(entry.type);
                        const styleAttr = [
                            `color:${color}`,
                            st.bold   ? 'font-weight:bold'  : '',
                            st.italic ? 'font-style:italic' : '',
                        ].filter(Boolean).join(';');
                        html += `<div class="exp-log-entry" style="${styleAttr};">${st.prefix}${escapeHtml(logEntryText(entry))}</div>`;
                    }
                    html += `</div>`;
                }
            }
        }
        if (autoRunning > 0) {
            const pendingCollect = expl.pendingAutoSummaries?.length || 0;
            html += `<div class="info-row" style="color:#66ccaa;font-size:0.9em;">${escapeHtml(tp('ui.tile.exp_auto_running', autoRunning))}${pendingCollect > 0 ? ` — <span style="color:#44ff88">${escapeHtml(t('ui.tile.exp_ready_to_collect', { n: pendingCollect }))}</span>` : ''}</div>`;
        }

        const dims = expl.getAvailableRealms(this.game)
            .filter(d => expl.canSend(this.game, d.key) && (!this._riftPortalChain || d.chain === this._riftPortalChain));
        if (dims.length > 0) {
            html += `<div class="info-row" style="margin-top:6px;"><b>${escapeHtml(t('ui.tile.send_expedition'))}</b></div>`;
            const sortedDims = dims.slice().sort((a, b) => a.difficulty - b.difficulty);
            for (const dim of sortedDims) {
                html += `<div class="info-actions"><button onclick="window.game.showExpeditionSetup(${jsArg(dim.key)})" style="background:#1a4466;color:#88ddff;">${escapeHtml(t('ui.tile.send_expedition_realm', { name: dim.name, diff: dim.difficulty }))}</button></div>`;
            }
        }

        if (expl.completedExpeditions.length > 0 && expl.expeditions.length === 0) {
            const last = expl.completedExpeditions[expl.completedExpeditions.length - 1];
            html += `<div class="info-row" style="margin-top:6px;color:#88ccff;font-size:0.9em;">${escapeHtml(t('ui.tile.last_expedition', { realm: expRealmName(last) }))}</div>`;
            html += `<div class="exp-log-container">`;
            const logSlice = last.log.slice(-10);
            for (const entry of logSlice) {
                const color = this._expLogColor(entry.type);
                const st = this._expLogStyle(entry.type);
                const styleAttr = [
                    `color:${color}`,
                    st.bold   ? 'font-weight:bold'  : '',
                    st.italic ? 'font-style:italic' : '',
                ].filter(Boolean).join(';');
                html += `<div class="exp-log-entry" style="${styleAttr};">${st.prefix}${escapeHtml(logEntryText(entry))}</div>`;
            }
            html += `</div>`;
        }

        return html;
    }

    _expLogColor(type) {
        return LOG_COLORS[type] || LOG_COLORS.default;
    }

    _expLogStyle(type) {
        return LOG_STYLES[type] || LOG_STYLES.info;
    }

    _spellTooltip(spell) {
        const parts = [MAGIC_SKILLS[spell.school]?.name || spell.school.charAt(0).toUpperCase() + spell.school.slice(1)];
        const pct = (v) => Math.round(v * 100);
        switch (spell.effect) {
            case 'ranged_damage': parts.push(t('ui.colonist.spell_ranged_damage', { dmg: spell.damage, range: spell.range })); break;
            case 'ranged_damage_aoe': parts.push(t('ui.colonist.spell_ranged_damage_aoe', { dmg: spell.damage, range: spell.range, radius: spell.radius })); break;
            case 'heal': parts.push(t('ui.colonist.spell_heal', { hp: spell.healAmount, pct: pct(spell.hpThreshold || 0.5) })); break;
            case 'buff_defense': parts.push(t('ui.colonist.spell_buff_defense', { pct: pct(spell.damageReduction), t: spell.duration })); break;
            case 'buff_speed': {
                const work = spell.workSpeedBonus > 1 ? t('ui.colonist.spell_buff_speed_work', { pct: pct(spell.workSpeedBonus - 1) }) : '';
                const move = spell.moveSpeedBonus ? t('ui.colonist.spell_buff_speed_move', { n: spell.moveSpeedBonus }) : '';
                parts.push(t('ui.colonist.spell_buff_speed', { work, move, t: spell.duration }));
                break;
            }
            case 'summon': parts.push(t('ui.colonist.spell_summon', { hp: spell.summonHp, dmg: spell.summonDamage, t: spell.summonDuration })); break;
            case 'teleport': parts.push(t('ui.colonist.spell_teleport', { range: spell.range })); break;
            case 'boost_crops': parts.push(t('ui.colonist.spell_boost_crops', { mult: spell.growthMult, radius: spell.radius, t: spell.duration })); break;
            case 'terraform': parts.push(t('ui.colonist.spell_terraform', { radius: spell.radius })); break;
            case 'divination_modifier': parts.push(t('ui.colonist.spell_divination_modifier', { t: spell.duration })); break;
            case 'chain_damage': parts.push(t('ui.colonist.spell_chain_damage', { dmg: spell.damage, n: spell.chainTargets, falloff: pct(spell.chainFalloff || 0.6), range: spell.range })); break;
            case 'ranged_damage_slow': parts.push(t('ui.colonist.spell_ranged_damage_slow', { dmg: spell.damage, pct: pct(1 - (spell.slowMult || 0.5)), range: spell.range })); break;
            case 'chain_heal': parts.push(t('ui.colonist.spell_chain_heal', { hp: spell.healAmount, n: spell.chainTargets, falloff: pct(spell.chainFalloff || 0.6) })); break;
            case 'cleanse': parts.push(t('ui.colonist.spell_cleanse', { range: spell.range })); break;
            case 'absorb_shield': parts.push(t('ui.colonist.spell_absorb_shield', { n: spell.absorbAmount, radius: spell.radius, t: spell.duration })); break;
            case 'buff_quality': parts.push(t('ui.colonist.spell_buff_quality', { n: spell.qualityBonus, radius: spell.radius, t: spell.duration })); break;
            case 'buff_rest': parts.push(t('ui.colonist.spell_buff_rest', { pct: pct(spell.restDecayMult || 1), radius: spell.radius, t: spell.duration })); break;
            case 'stun': parts.push(t('ui.colonist.spell_stun', { rounds: spell.stunRounds || 1, t: spell.stunDuration, range: spell.range })); break;
            case 'summon_swarm': parts.push(t('ui.colonist.spell_summon_swarm', { n: spell.swarmCount })); break;
            case 'finish_construction': parts.push(t('ui.colonist.spell_finish_construction', { range: spell.range })); break;
            case 'transmute': parts.push(spell.fromResource
                ? t('ui.colonist.spell_transmute', { inN: spell.inputAmount, from: resourceName(spell.fromResource), outN: spell.outputAmount, to: resourceName(spell.toResource) })
                : t('ui.colonist.spell_conjure', { n: spell.outputAmount, to: resourceName(spell.toResource) })); break;
            case 'ripen_crops': parts.push(t('ui.colonist.spell_ripen_crops', { pct: pct(spell.ripenThreshold || 0.5), radius: spell.radius })); break;
            default: parts.push(spell.effect.replace(/_/g, ' '));
        }
        const triggers = {
            inCombat: 'ui.colonist.spell_trigger_in_combat', lowHealth: 'ui.colonist.spell_trigger_low_health',
            woundedNearby: 'ui.colonist.spell_trigger_wounded_nearby', hasTask: 'ui.colonist.spell_trigger_has_task',
            debuffNearby: 'ui.colonist.spell_trigger_debuff_nearby', canTransmute: 'ui.colonist.spell_trigger_can_transmute',
        };
        if (triggers[spell.trigger]) parts.push(t(triggers[spell.trigger]));
        return parts.join(' | ');
    }

    getStructureDescription(structure, x, y) {
        const def = BUILDINGS[structure];
        if (!def) return '';
        let html = '';
        if (def.description) {
            html += `<div class="info-row" style="color:#999;font-size:11px;">${escapeHtml(def.description)}</div>`;
        }
        if (def.maxCount !== undefined) {
            const limit = def.maxCount + getMaxCountBonus(def, structure, this.game);
            let placed = 0;
            for (const row of this.game.map) for (const t of row) if (t.structure === structure) placed++;
            html += `<div class="info-row" style="color:#aa88ff;font-size:11px;">${escapeHtml(t('ui.tile.placed_count', { n: placed, max: limit }))}</div>`;
        }
        if (def.power) {
            if (def.power.generates) {
                html += `<div class="info-row" style="color:#88ff88;">${escapeHtml(t('ui.tile.power_generates', { n: def.power.generates }))}</div>`;
            }
            if (def.power.consumes) {
                const isWinter = this.game.weather.season === 'winter';
                let status;
                if (def.power.seasonalHeat && !isWinter) status = `<span style="color:#888;">${escapeHtml(t('ui.tile.power_idle_winter'))}</span>`;
                else if (x === undefined) status = '';
                else if (this.game.power.isPowered(x, y)) status = `<span style="color:#88ff88;">${escapeHtml(t('ui.tile.power_powered'))}</span>`;
                else status = `<span style="color:#ff4444;">${escapeHtml(t('ui.tile.power_unpowered'))}</span>`;
                html += `<div class="info-row">${escapeHtml(t('ui.tile.power_consumes', { n: def.power.consumes }))}${status ? ` — ${status}` : ''}</div>`;
                if (x !== undefined) html += this._buildPowerPriorityHtml(structure, x, y);
            }
        }
        return html;
    }

    // Segmented button row; the active option is highlighted and inert.
    _choiceButtonsHtml(options, activeValue, onclickFor) {
        const btns = options.map(o => {
            const active = o.value === activeValue;
            const style = active
                ? `background:#3a3355;color:${o.color || '#ffffff'};border:1px solid ${o.color || '#aa88ff'};`
                : 'opacity:0.75;';
            const title = o.title ? ` title="${escapeAttr(o.title)}"` : '';
            return `<button${title} style="${style}" ${active ? 'disabled' : `onclick="${onclickFor(o.value)}"`}>${escapeHtml(o.label)}</button>`;
        });
        return `<div class="info-actions">${btns.join(' ')}</div>`;
    }

    // Power priority picker for a mana consumer. Relays always draw first, so they get none.
    _buildPowerPriorityHtml(structure, x, y) {
        if (structure === 'mana_relay') return `<div class="info-row" style="color:#888;font-size:11px;">${escapeHtml(t('ui.tile.power_relay_first'))}</div>`;
        const tile = this.game.map[y][x];
        const current = getPowerTier(tile, structure);
        const fallback = POWER_PRIORITY.byBuilding[structure] || POWER_PRIORITY.defaultTier;
        let html = `<div class="info-row" style="font-size:11px;color:#aa88ff;">${escapeHtml(t(tile.powerPriority ? 'ui.tile.power_priority' : 'ui.tile.power_priority_default'))}</div>`;
        const options = POWER_PRIORITY.tiers.map(tier => ({
            value: tier,
            label: POWER_PRIORITY.labels[tier] + (tier === fallback ? '*' : ''),
            title: tier === fallback ? t('ui.tile.power_priority_default_tip') : '',
        }));
        // Picking the default tier clears the override so later default changes still apply.
        html += this._choiceButtonsHtml(options, current, t =>
            `window.game.setPowerPriority(${x},${y},${t === fallback ? 'null' : jsArg(t)})`);
        return html;
    }

    getPedestalEffectDescription(artDef) {
        if (!artDef?.pedestal) return '';
        const effects = getNestedEffectLines(artDef.pedestal);
        if (effects.length === 0) return '';
        return `<div class="info-row" style="color:#aaffaa;font-size:11px;">${effects.join(' | ')}</div>`;
    }

    // Returns HTML string for an equipment stat tooltip.
    // When candidateItem is provided, shows a side-by-side comparison.
    // When candidateItem is null, shows just the equipped item's stats as a reference.
    _buildEquipCompareHtml(slotLabel, equippedItem, candidateItem) {
        const SKIP = new Set(['key', 'name', 'description', 'tier', 'textColor', 'char', 'pedestal', 'expedition', 'enchantment', 'enchantmentTier', 'enchantmentEffect', 'rarity']);
        const getStats = (item) => {
            if (!item) return {};
            const stats = {};
            for (const [k, v] of Object.entries(item)) {
                if (SKIP.has(k) || typeof v !== 'number') continue;
                if (STAT_META[k]) stats[k] = v;
            }
            return stats;
        };
        const weaponSummary = (item) => {
            if (!item?.damage) return null;
            const cd = item.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            return { dps: item.damage / cd, speed: weaponSpeedLabel(cd) };
        };
        const higherIsBetter = new Set([
            'damageReduction', 'moodBonus', 'workSpeedBonus', 'moveSpeedBonus', 'damage', 'spellDamageBonus',
            'manaRegen', 'maxMana', 'warmth', 'critChance', 'critMultiplier', 'blockChance', 'gatherBonus',
            'craftSpeedBonus', 'qualityBonus', 'lightRadius', 'maxHpBonus', 'maxManaBonus', 'spellCooldownReduction',
        ]);
        if (!equippedItem && !candidateItem) return escapeHtml(t('ui.colonist.slot_empty', { slot: slotLabel }));
        if (!candidateItem) {
            const ws = weaponSummary(equippedItem);
            const weaponRows = ws
                ? `<tr><td style="color:#888;padding-right:8px;">${escapeHtml(t('ui.colonist.compare_speed'))}</td><td style="color:#aaa;">${escapeHtml(t('ui.colonist.compare_speed_value', { speed: ws.speed, dps: ws.dps.toFixed(1) }))}</td></tr>`
                : '';
            const stats = getStats(equippedItem);
            const rows = Object.entries(stats).map(([k, v]) => {
                const meta = STAT_META[k];
                if (!meta) return '';
                return `<tr><td style="color:#888;padding-right:8px;">${meta.label}</td><td style="color:#aaa;">${formatStatValue(k, v)}</td></tr>`;
            }).filter(Boolean).join('');
            const onHitRows = getOnHitLines(equippedItem).map(line =>
                `<tr><td colspan="2" style="color:#ffaa55;">${line}</td></tr>`
            ).join('');
            const fallback = !weaponRows && !rows ? `<tr><td style="color:#666;">${escapeHtml(t('ui.colonist.compare_no_stats'))}</td></tr>` : '';
            const eqDesc = itemDescription(equippedItem);
            return `<div style="min-width:160px;"><div style="color:#ffdd88;margin-bottom:4px;font-weight:bold;">${escapeHtml(itemName(equippedItem))}</div>` +
                (eqDesc ? `<div style="color:#888;font-size:10px;margin-bottom:4px;">${escapeHtml(eqDesc)}</div>` : '') +
                `<table style="border-collapse:collapse;font-size:11px;">${weaponRows}${rows}${onHitRows}${fallback}</table></div>`;
        }
        const eqWs = weaponSummary(equippedItem);
        const cWs  = weaponSummary(candidateItem);
        const weaponCompareRows = (eqWs || cWs) ? (() => {
            const eqStr = eqWs ? escapeHtml(t('ui.colonist.compare_dps_value', { dps: eqWs.dps.toFixed(1), speed: eqWs.speed })) : '-';
            const cStr  = cWs  ? escapeHtml(t('ui.colonist.compare_dps_value', { dps: cWs.dps.toFixed(1), speed: cWs.speed }))   : '-';
            let dpsColor = '#aaa';
            if (eqWs && cWs && eqWs.dps !== cWs.dps) {
                dpsColor = cWs.dps > eqWs.dps ? '#66cc66' : '#cc6644';
            }
            return `<tr><td style="color:#888;padding-right:6px;">${escapeHtml(t('ui.colonist.compare_dps'))}</td><td style="color:#aaa;">${eqStr}</td><td style="color:${dpsColor};font-weight:bold;">${cStr}</td></tr>`;
        })() : '';
        const eqStats = getStats(equippedItem);
        const cStats  = getStats(candidateItem);
        const allKeys = new Set([...Object.keys(eqStats), ...Object.keys(cStats)]);
        const rowsHtml = [...allKeys].map(k => {
            const meta = STAT_META[k];
            if (!meta) return '';
            const eqVal = eqStats[k];
            const cVal = cStats[k];
            const eqStr = eqVal !== undefined ? formatStatValue(k, eqVal) : '-';
            const cStr = cVal !== undefined ? formatStatValue(k, cVal) : '-';
            let color = '#aaa';
            if (eqVal !== undefined && cVal !== undefined && eqVal !== cVal) {
                const better = higherIsBetter.has(k) ? cVal > eqVal : cVal < eqVal;
                color = better ? '#66cc66' : '#cc6644';
            }
            return `<tr><td style="color:#888;padding-right:6px;">${meta.label}</td><td style="color:#aaa;">${eqStr}</td><td style="color:${color};font-weight:bold;">${cStr}</td></tr>`;
        }).filter(Boolean).join('');
        const eqOnHit = getOnHitLines(equippedItem || {});
        const cOnHit  = getOnHitLines(candidateItem);
        const onHitCompareRows = [...new Set([...eqOnHit, ...cOnHit])].map(line => {
            const inEq = eqOnHit.includes(line);
            const inC  = cOnHit.includes(line);
            return `<tr><td style="color:#888;padding-right:6px;">${line}</td>` +
                `<td style="color:${inEq ? '#ffaa55' : '#444'};">${inEq ? '✓' : '-'}</td>` +
                `<td style="color:${inC ? '#ffaa55' : '#444'};">${inC ? '✓' : '-'}</td></tr>`;
        }).join('');
        const fallbackRow = !weaponCompareRows && !rowsHtml ? `<tr><td colspan="3" style="color:#666;">${escapeHtml(t('ui.colonist.compare_no_differences'))}</td></tr>` : '';
        const eqName = equippedItem ? itemName(equippedItem) : t('ui.colonist.compare_empty');
        return `<div style="min-width:200px;"><table style="border-collapse:collapse;font-size:11px;width:100%;">` +
            `<tr><th style="color:#666;text-align:left;padding-bottom:3px;">${escapeHtml(slotLabel)}</th><th style="color:#aaa;text-align:left;padding-right:6px;">${escapeHtml(eqName)}</th><th style="color:#ffdd88;text-align:left;">${escapeHtml(itemName(candidateItem))}</th></tr>` +
            weaponCompareRows + rowsHtml + onHitCompareRows + fallbackRow +
            `</table></div>`;
    }

    _buildEquipmentEffectsHtml(colonist, viewingSet) {
        const SLOTS = ['weapon', 'armor', 'helmet', 'clothes', 'tool', 'trinket', 'boots'];
        const isViewingInactive = viewingSet && viewingSet !== (colonist.activeSet || 'Colony');
        const items = isViewingInactive
            ? SLOTS.map(s => colonist.equipmentSets?.[viewingSet]?.[s] ?? colonist[s]).filter(Boolean)
            : getEquippedItems(colonist);
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
        const weaponItem = items.find(i => i.damage);
        if (weaponItem) {
            const cd = weaponItem.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            const dps = (weaponItem.damage / cd).toFixed(1);
            parts.push(`<span style="color:#ccc">${escapeHtml(t('ui.colonist.effects_dps_label'))}</span> ${escapeHtml(t('ui.colonist.effects_dps_value', { dps, dmg: weaponItem.damage, speed: weaponSpeedLabel(cd) }))}`);
        }
        for (const [stat, meta] of Object.entries(STAT_META)) {
            if (stat === 'damage') continue;
            if (totals[stat]) parts.push(`<span style="color:#ccc">${escapeHtml(t('ui.colonist.stat_label', { label: meta.label }))}</span> ${formatStatValue(stat, totals[stat])}`);
        }
        for (const item of items) {
            for (const line of getOnHitLines(item)) {
                parts.push(`<span style="color:#ccc">${line}</span>`);
            }
        }
        if (parts.length) {
            const prefix = isViewingInactive ? `<span style="color:#5566aa">${escapeHtml(t('ui.colonist.effects_set_prefix', { set: equipSetName(viewingSet) }))}</span> ` : '';
            sections.push(prefix + parts.join(sep));
        }
        const expParts = [];
        for (const [stat, meta] of Object.entries(STAT_META)) {
            if (expeditionTotals[stat]) expParts.push(`<span style="color:#ccc">${escapeHtml(t('ui.colonist.stat_label', { label: meta.label }))}</span> ${formatStatValue(stat, expeditionTotals[stat])}`);
        }
        if (expParts.length) sections.push(`<span style="color:#33ccff">${escapeHtml(t('ui.colonist.effects_expedition'))}</span> ${expParts.join(sep)}`);
        return sections.join('<br>');
    }

    _getTrinketTooltip(art) {
        const lines = [];
        const desc = itemDescription(art);
        if (desc) lines.push(desc);
        const equipped = getItemStatLines(art);
        if (equipped.length) lines.push(t('ui.colonist.trinket_equipped', { effects: equipped.join(', ') }));
        if (art.pedestal) {
            const parts = getNestedEffectLines(art.pedestal);
            if (art.pedestal.radius === 'global') {
                if (parts.length) lines.push(t('ui.colonist.trinket_pedestal_global', { effects: parts.join(', ') }));
            } else {
                if (parts.length) lines.push(t('ui.colonist.trinket_aura', { radius: art.pedestal.radius, effects: parts.join(', ') }));
            }
            if (art.pedestal.manaCost) lines.push(t('ui.colonist.trinket_pedestal_mana', { n: art.pedestal.manaCost }));
        }
        if (art.expedition) {
            const parts = getNestedEffectLines(art.expedition);
            if (parts.length) lines.push(t('ui.colonist.trinket_expedition', { effects: parts.join(', ') }));
        }
        if (art.durability) lines.push(t('ui.colonist.trinket_durability', { n: art.durability.max }));
        if (art.consumable) lines.push(t('ui.colonist.trinket_consumable'));
        return lines.join(' | ') || itemName(art);
    }

    // `expand`: also unfold a collapsed footer. The colony overview (shown on start and
    // when tapping bare ground) doesn't, so it never pops the footer open over the map.
    _switchToInfoTab(expand = true) {
        const container = document.getElementById('game-container');
        const isTabbed = container.classList.contains('tabbed-mode');
        if (!isTabbed) return;

        const footer = document.getElementById('game-footer');
        if (expand && footer.classList.contains('collapsed')) {
            footer.classList.remove('collapsed');
            window.updateFooterSizeButton?.(footer);
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
            if (!trait) return escapeHtml(t);
            return `<span class="skill-tip" data-tip="${escapeAttr(trait.description)}">${escapeHtml(trait.name)}</span>`;
        });
        const thoughts = colonist.thoughts.slice(-5).map(t =>
            `<span class="${t.moodEffect >= 0 ? 'positive' : 'negative'}">${escapeHtml(thoughtText(t))} (${t.moodEffect > 0 ? '+' : ''}${t.moodEffect.toFixed(0)})</span>`
        ).join('<br>');

        const gearTip = (item) => `${itemDescription(item)} ${getItemStatLines(item).join(', ')}`.trim();
        const weaponTip = colonist.weapon ? getWeaponTooltip(colonist) : t('ui.colonist.no_weapon');
        const armorTip = colonist.armor ? gearTip(colonist.armor) : t('ui.colonist.no_armor');
        const helmetTip = colonist.helmet ? gearTip(colonist.helmet) : t('ui.colonist.no_helmet');
        const clothesTip = colonist.clothes ? gearTip(colonist.clothes) : t('ui.colonist.no_clothes');
        const toolTip = colonist.tool ? gearTip(colonist.tool) : t('ui.colonist.no_tool');
        const bootsTip = colonist.boots ? gearTip(colonist.boots) : t('ui.colonist.no_boots');
        const trinketTip = colonist.trinket ? this._getTrinketTooltip(colonist.trinket) : t('ui.colonist.no_trinket');

        const nc = escapeAttr(colonist.nameColor || '#ffff00');
        const sectionHdr = 'color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;margin-top:8px;padding-bottom:2px;margin-bottom:3px';
        let html = `<div class="info-header" style="cursor:pointer;color:${nc}" onclick="window.game.selectColonistById(${colonist.id})">${escapeHtml(colonist.name)} ${colonist.drafted ? escapeHtml(t('ui.colonist.tag_drafted')) : ''}${colonist.guardMode ? escapeHtml(t('ui.colonist.tag_guarding')) : ''}</div>`;

        // --- Status ---
        html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_status'))}</div>`;
        const hpPct = colonist.maxHp > 0 ? (colonist.hp / colonist.maxHp) * 100 : 100;
        const hpBar = statBarHtml({ key: `info:hp:${colonist.id}`, pct: hpPct, color: statColor(hpPct), max: colonist.maxHp, width: 90 });
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: Math.round(colonist.hp), max: colonist.maxHp }))} ${hpBar} | ${escapeHtml(t('ui.colonist.mood_label'))} <span class="mood-${moodLevel}">${escapeHtml(t('ui.colonist.mood_value', { n: colonist.mood.toFixed(0), mood: moodName(moodLevel) }))}</span></div>`;
        const hungerBar = statBarHtml({ key: `info:hunger:${colonist.id}`, pct: colonist.needs.hunger, color: statColor(colonist.needs.hunger), max: 100, width: 90 });
        const restBar = statBarHtml({ key: `info:rest:${colonist.id}`, pct: colonist.needs.rest, color: statColor(colonist.needs.rest), max: 100, width: 90 });
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.hunger', { n: colonist.needs.hunger.toFixed(0) }))} ${hungerBar} ${escapeHtml(t('ui.colonist.rest', { n: colonist.needs.rest.toFixed(0) }))} ${restBar}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.state', { state: colonistStateName(colonist.state) }))} | ${escapeHtml(t('ui.colonist.task_label'))} ${this.getColonistTaskDescription(colonist)}</div>`;
        const allTraits = traitSpanArr.filter(Boolean).join(', ');
        if (allTraits) html += `<div class="info-row">${escapeHtml(t('ui.colonist.traits_label'))} ${allTraits}</div>`;
        if (colonist.voidBound) {
            html += `<div class="info-row"><span style="color:#bb66ff">${escapeHtml(t('ui.colonist.void_bound'))}</span> <span style="color:#888;font-size:0.85em">${escapeHtml(t('ui.colonist.void_bound_effect'))}</span></div>`;
        }
        const groups = this.game.colonistGroups || [];
        const groupOptions = `<option value="">${escapeHtml(t('ui.colonist.group_none'))}</option>` + groups.map(g => `<option value="${escapeAttr(g)}"${colonist.group === g ? ' selected' : ''}>${escapeHtml(g)}</option>`).join('');
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.group_label'))} <select onchange="window.game.setColonistGroup(${colonist.id},this.value)">${groupOptions}</select></div>`;
        html += `<div class="info-row">${escapeHtml(colonist.assignedBed ? t('ui.colonist.bed_at', { x: colonist.assignedBed.x, y: colonist.assignedBed.y }) : t('ui.colonist.bed_none'))}</div>`;
        if (this.game.exploration) {
            const expl = this.game.exploration;
            const expLvl = expl.getExpeditionLevel(colonist.id);
            const xpData = expl.expeditionXP[colonist.id];
            if (colonist.onExpedition) {
                html += `<div class="info-row"><span style="color:#cc88ff;">${escapeHtml(t('ui.colonist.on_expedition'))}</span></div>`;
            } else if (expl.isFatigued(colonist.id, this.game.tick)) {
                const remaining = expl.getFatigueRemaining(colonist.id, this.game.tick);
                const days = Math.ceil(remaining / CONFIG.TICKS_PER_DAY);
                html += `<div class="info-row"><span style="color:#ff6644;">${escapeHtml(t('ui.colonist.fatigued'))}</span> <span style="color:#888;">${escapeHtml(tp('ui.colonist.fatigue_days', days))}</span></div>`;
            }
            if (expLvl > 0 || xpData) {
                const xp = xpData?.xp || 0;
                const level = xpData?.level || 0;
                const needed = 10 + level * 5;
                const tip = adventurerLevelTooltip(level).replace(/"/g, '&quot;');
                html += `<div class="info-row"><span class="skill-tip" data-tip="${tip}" style="color:#ffcc44;cursor:help;">${escapeHtml(t('ui.colonist.adventurer_level', { n: level }))}</span> <span style="color:#888;">${escapeHtml(t('ui.colonist.adventurer_xp', { xp, max: needed }))}</span></div>`;
            }
        }

        // --- Skills ---
        html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_skills'))}</div>`;
        html += `<div class="info-row">${Object.entries(SKILLS).map(([k, def]) => {
            const level = colonist.skills[k] || 1;
            const xpTip = skillXpTip(def, k, level, colonist.skillXp?.[k] || 0);
            return `<span class="skill-tip" data-skill="${escapeAttr(k)}" data-tip="${escapeAttr(xpTip)}">${escapeHtml(t('ui.colonist.skill_level', { name: def.name, n: level }))}</span>`;
        }).join(' ')}</div>`;
        const hasMagic = colonist.magicSkills && Object.values(colonist.magicSkills).some(v => v > 0);
        if (hasMagic) {
            const manaPct = colonist.maxMana > 0 ? (colonist.mana / colonist.maxMana) * 100 : 0;
            const manaBar = statBarHtml({ key: `info:mana:${colonist.id}`, pct: manaPct, color: '#aa88ff', max: colonist.maxMana, width: 90 });
            html += `<div class="info-row"><span style="color:#aa88ff">${escapeHtml(t('ui.colonist.mana_label'))} ${manaBar} ${Math.floor(colonist.mana)}/${colonist.maxMana}</span></div>`;
            const attunedSchools = Array.isArray(colonist.attunedSchools) ? colonist.attunedSchools : [];
            html += `<div class="info-row">${escapeHtml(t('ui.colonist.magic_label'))} ${Object.entries(MAGIC_SKILLS).filter(([k]) => colonist.magicSkills[k] > 0).map(([k, def]) => {
                const level = colonist.magicSkills[k];
                const isAttuned = attunedSchools.includes(k);
                const tip = magicXpTip(def, level, colonist.magicXpAccumulator?.[k] || 0) + (isAttuned ? t('ui.colonist.attuned_suffix') : '');
                const style = isAttuned ? `color:${def.color};font-weight:bold` : 'color:#bb88ff';
                return `<span class="skill-tip" data-magic="${escapeAttr(k)}"${isAttuned ? ' data-attuned="1"' : ''} data-tip="${escapeAttr(tip)}" style="${style}">${isAttuned ? '★' : ''}${escapeHtml(t('ui.colonist.skill_level', { name: def.name, n: level }))}</span>`;
            }).join(' ')}</div>`;
            if (attunedSchools.length > 0) {
                const names = attunedSchools.map(k => `<span style="color:${MAGIC_SKILLS[k].color}">${escapeHtml(MAGIC_SKILLS[k].name)}</span>`).join(', ');
                html += `<div class="info-row" style="font-size:0.85em">${escapeHtml(t('ui.colonist.attuned_label'))} ${names} <span style="color:#666">${escapeHtml(t('ui.colonist.attuned_note'))}</span></div>`;
            }
            if (attunedSchools.length < MAGIC_STUDY_CONFIG.attunementSlots) {
                const missing = MAGIC_STUDY_CONFIG.attunementSlots - attunedSchools.length;
                html += `<div class="info-row" style="color:#ff8844;font-size:0.85em">&#9888; ${escapeHtml(tp('ui.colonist.attune_slots_unfilled', missing))} <span data-open-attune style="text-decoration:underline;cursor:pointer">${escapeHtml(t('ui.colonist.attune_set_link'))}</span></div>`;
            }
        }

        // --- Equipment ---
        if (!colonist.golem) {
        html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_equipment'))}</div>`;
        const id = colonist.id;
        // Determine which set tab the player is currently viewing (may differ from activeSet while browsing).
        const viewingSet = this._colonistViewingSet?.[colonist.id] || colonist.activeSet || 'Colony';
        const isViewingActive = viewingSet === (colonist.activeSet || 'Colony');
        const setNames = Object.keys(colonist.equipmentSets || { Colony: {}, Expedition: {} });

        // Set tab switcher
        html += `<div style="display:flex;gap:4px;margin:4px 0 2px 0;">`;
        for (const sn of setNames) {
            const isActive = sn === (colonist.activeSet || 'Colony');
            const isViewing = sn === viewingSet;
            const bg = isViewing ? '#2a2a4e' : '#111';
            const border = isViewing ? (isActive ? '#88aaff' : '#5566aa') : '#333';
            const label = escapeHtml(isActive ? `${equipSetName(sn)} ◆` : equipSetName(sn));
            html += `<button onclick="window.game.ui._setColonistViewingSet(${colonist.id},${jsArg(sn)})" style="flex:1;padding:2px 4px;background:${bg};border:1px solid ${border};border-radius:3px;color:${isViewing ? '#ddd' : '#888'};font-size:11px;cursor:pointer;">${label}</button>`;
        }
        html += `</div>`;
        if (!isViewingActive) {
            html += `<div style="font-size:10px;color:#5566aa;margin-bottom:3px;">${escapeHtml(t('ui.colonist.set_preview_note', { set: equipSetName(viewingSet), active: equipSetName(colonist.activeSet || 'Colony') }))}</div>`;
        }

        const tomeName = colonist.equippedTome ? SPELL_TOMES[colonist.equippedTome]?.name : null;
        const tomeTip = tomeName ? (() => { const p = (colonist.tomeProgress?.[colonist.equippedTome] || 0); return t('ui.colonist.tome_progress', { name: tomeName, pct: Math.floor(p / SPELL_TOMES[colonist.equippedTome].learningWork * 100) }); })() : t('ui.colonist.no_tome');
        const slotStyle = 'position:relative;border:1px solid #444;border-radius:4px;padding:4px 2px;background:#1a1a2e;cursor:pointer;min-height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;';

        const _buildSetSlotHtml = (slot, label, fallbackChar, tipText) => {
            if (isViewingActive) {
                // Active set: render normally using existing slot select mechanism.
                const item = colonist[slot];
                let inner = item ? this._itemIcon(item.key, slot) : `<span style="color:#333;font-size:14px">${fallbackChar}</span>`;
                // data-compare is decoded then set as innerHTML, so attribute-escape
                // the whole (already HTML-safe) fragment, ampersands included.
                const compareHtml = escapeAttr(this._buildEquipCompareHtml(label, item, null));
                const tipAttr = item
                    ? `data-compare="${compareHtml}"`
                    : `data-tip="${escapeAttr(tipText)}"`;
                return `<div class="skill-tip" data-tut-slot="${slot}" ${tipAttr} style="${slotStyle}"><div style="color:#666;font-size:10px">${escapeHtml(label)}</div>${inner}${this._buildSlotSelect(colonist, slot)}</div>`;
            }
            // Inactive set: show set-specific override or shared fallback.
            const setItem = (colonist.equipmentSets?.[viewingSet])?.[slot] || null;
            const sharedItem = colonist[slot]; // currently equipped (shared if setItem is null)
            const SLOT_LIST = { weapon: 'weapons', armor: 'armors', helmet: 'helmets', clothes: 'clothes', tool: 'tools', trinket: 'trinkets', boots: 'boots' };
            const listName = SLOT_LIST[slot];
            if (setItem) {
                // This set owns a dedicated item for this slot.
                const compareHtml = escapeAttr(this._buildEquipCompareHtml(t('ui.colonist.set_override_label', { slot: label, set: equipSetName(viewingSet) }), setItem, null));
                const removeBtn = `<span onclick="window.game.removeItemFromSet(${colonist.id},${jsArg(viewingSet)},'${slot}')" style="position:absolute;top:1px;right:2px;color:#cc4444;font-size:10px;cursor:pointer;z-index:10;" title="${escapeAttr(t('ui.colonist.set_return_to_inventory'))}">x</span>`;
                const assignSelect = this._buildSetAssignSelect(colonist, viewingSet, slot, listName);
                return `<div class="skill-tip" data-compare="${compareHtml}" style="${slotStyle}">${removeBtn}<div style="color:#666;font-size:10px">${escapeHtml(label)}</div>${this._itemIcon(setItem.key, slot)}${assignSelect}</div>`;
            } else {
                // Shared: dim the currently-equipped item and show chain icon.
                const inner = sharedItem
                    ? `<span style="opacity:0.4;">${this._itemIcon(sharedItem.key, slot)}</span><span style="position:absolute;bottom:2px;right:3px;font-size:9px;color:#5566aa;" title="${escapeAttr(t('ui.colonist.set_shared_from', { set: equipSetName(colonist.activeSet || 'Colony') }))}">⛓</span>`
                    : `<span style="color:#222;font-size:14px">${fallbackChar}</span>`;
                const tip = sharedItem ? t('ui.colonist.set_shared_tip', { item: itemName(sharedItem), set: equipSetName(colonist.activeSet || 'Colony') }) : t('ui.colonist.set_no_item_tip');
                const assignSelect = this._buildSetAssignSelect(colonist, viewingSet, slot, listName);
                return `<div class="skill-tip" data-tip="${escapeAttr(tip)}" style="${slotStyle}"><div style="color:#666;font-size:10px">${escapeHtml(label)}</div>${inner}${assignSelect}</div>`;
            }
        };

        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin:4px 0 0 0;text-align:center;">`;
        // Row 1: Tome | Helmet | Armor | Trinket
        // Tome always uses the normal select (not part of equipment sets).
        html += `<div class="skill-tip" data-tut-slot="tome" data-tip="${escapeAttr(tomeTip)}" style="${slotStyle}">`;
        html += `<div style="color:#666;font-size:10px">${escapeHtml(t('ui.colonist.slot_tome'))}</div>`;
        html += colonist.equippedTome ? `${this._itemIcon(colonist.equippedTome, 'tome')}` : `<span style="color:#333;font-size:14px">~</span>`;
        html += this._buildSlotSelect(colonist, 'tome');
        html += `</div>`;
        html += _buildSetSlotHtml('helmet', t('ui.colonist.slot_helmet'), '^', helmetTip);
        html += _buildSetSlotHtml('armor', t('ui.colonist.slot_armor'), '[]', armorTip);
        html += _buildSetSlotHtml('trinket', t('ui.colonist.slot_trinket'), '*', trinketTip);
        html += `</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin:0 0 4px 0;text-align:center;">`;
        // Row 2: Weapon | Boots | Clothes | Offhand
        html += _buildSetSlotHtml('weapon', t('ui.colonist.slot_weapon'), '/', weaponTip);
        html += _buildSetSlotHtml('boots', t('ui.colonist.slot_boots'), '⌟', bootsTip);
        html += _buildSetSlotHtml('clothes', t('ui.colonist.slot_clothes'), '◆', clothesTip);
        html += _buildSetSlotHtml('tool', t('ui.colonist.slot_offhand'), '\\', toolTip);
        html += `</div>`;

        // --- Equipment Effects Summary ---
        const eqEffects = this._buildEquipmentEffectsHtml(colonist, viewingSet);
        if (eqEffects) {
            html += `<div style="margin:2px 0;padding:3px 6px;background:#111;border-radius:3px;font-size:11px;color:#aaa;line-height:1.5">${eqEffects}</div>`;
        }

        // --- Sprite Layer Visibility Toggles ---
        {
            const VISUAL_SLOTS = [
                { key: 'armor',   label: t('ui.colonist.slot_armor')   },
                { key: 'helmet',  label: t('ui.colonist.slot_helmet')  },
                { key: 'clothes', label: t('ui.colonist.slot_clothes') },
                { key: 'weapon',  label: t('ui.colonist.slot_weapon')  },
                { key: 'tool',    label: t('ui.colonist.slot_tool')    },
            ];
            const hiddenSlots = colonist.hiddenEquipmentSlots || {};
            const togglesHtml = VISUAL_SLOTS.map(s => {
                const checked = !hiddenSlots[s.key] ? 'checked' : '';
                return `<label class="eq-vis-toggle"><input type="checkbox" ${checked} onchange="window.game.toggleEquipmentSlotVisibility(${colonist.id},'${s.key}');window.game.ui.showColonistInfo(window.game.colonists.find(c=>c.id===${colonist.id}))">${escapeHtml(s.label)}</label>`;
            }).join('');
            html += `<div class="eq-vis-row"><span class="eq-vis-label">${escapeHtml(t('ui.colonist.show_layers'))}</span>${togglesHtml}</div>`;
        }
        } // end !colonist.golem equipment block

        // --- Spells ---
        const hasSpells = (colonist.knownSpells && colonist.knownSpells.length > 0) || colonist.equippedTome;
        if (hasSpells || hasMagic) {
            html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_spells'))}</div>`;
            if (colonist.equippedTome) {
                const tomeDef = SPELL_TOMES[colonist.equippedTome];
                const currentProgress = (colonist.tomeProgress && colonist.tomeProgress[colonist.equippedTome]) || 0;
                const progress = Math.floor((currentProgress / tomeDef.learningWork) * 100);
                html += `<div class="info-row"><span style="color:#bb88ff">${escapeHtml(t('ui.colonist.studying', { name: tomeDef.name, pct: progress }))}</span></div>`;
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
                        spellHtml += `<input type="checkbox" ${checked} onchange="window.game.toggleSpell(${colonist.id},${jsArg(spellKey)})" style="margin-right:4px;vertical-align:middle">`;
                    }
                    const tipDesc = this._spellTooltip(spell);
                    spellHtml += `<span class="skill-tip" data-tip="${escapeAttr(tipDesc)}" style="color:${greyed ? '#666' : '#bb88ff'}">${escapeHtml(spell.name)}</span> <span style="color:#666;font-size:0.85em">${escapeHtml(t('ui.colonist.spell_cost', { mana: spell.manaCost, cd: spell.cooldown }))}</span>`;
                    if (spell.castType === 'targeted') {
                        const disabled = onCooldown || !hasManaForSpell;
                        const reason = onCooldown ? t('ui.colonist.spell_cd_ticks', { n: cdRemaining }) : !hasManaForSpell ? t('ui.colonist.spell_low_mana') : '';
                        spellHtml += disabled
                            ? ` <span style="color:#666">[${escapeHtml(reason)}]</span>`
                            : ` <button onclick="window.game.startSpellTargeting(${colonist.id},${jsArg(spellKey)})" style="font-size:0.8em">${escapeHtml(t('ui.colonist.spell_cast'))}</button>`;
                    } else if (notAttuned) {
                        spellHtml += ` <span style="color:#a66;font-size:0.8em">${escapeHtml(t('ui.colonist.spell_not_attuned'))}</span>`;
                    } else {
                        spellHtml += ` <span style="color:#555;font-size:0.8em">${escapeHtml(onCooldown ? t('ui.colonist.spell_auto_cd', { n: cdRemaining }) : t('ui.colonist.spell_auto'))}</span>`;
                    }
                    return `<div class="info-row" style="padding-left:8px">${spellHtml}</div>`;
                };

                // Only draw the sub-headers when a split actually exists. A colonist
                // with no attunement (or all spells in-school) reads as a flat list.
                if (inactive.length > 0) {
                    html += `<div class="info-row" style="padding-left:4px;color:#88cc88;font-size:0.85em;font-weight:bold">${escapeHtml(t('ui.colonist.spells_active'))}</div>`;
                }
                for (const spellKey of active) html += renderSpellRow(spellKey, false);
                if (inactive.length > 0) {
                    html += `<div class="info-row" style="padding-left:4px;color:#a66;font-size:0.85em;font-weight:bold">${escapeHtml(t('ui.colonist.spells_inactive'))}</div>`;
                    for (const spellKey of inactive) html += renderSpellRow(spellKey, true);
                }
            }
            if (colonist.activeEffects && colonist.activeEffects.length > 0) {
                const effects = colonist.activeEffects.map(e => {
                    const left = e.expiresAt - this.game.tick;
                    switch (e.type) {
                        case 'absorb': return `<span style="color:#88ccff">${escapeHtml(t('ui.colonist.effect_absorb', { n: e.absorbRemaining }))}</span>`;
                        case 'quality': return `<span style="color:#ffcc66">${escapeHtml(t('ui.colonist.effect_quality', { n: e.qualityBonus, t: left }))}</span>`;
                        case 'rest': return `<span style="color:#aaffcc">${escapeHtml(t('ui.colonist.effect_rest', { t: left }))}</span>`;
                        case 'shield': return `<span style="color:#88ccff">${escapeHtml(t('ui.colonist.effect_shield', { t: left }))}</span>`;
                        case 'speed': return `<span style="color:#ffff88">${escapeHtml(t('ui.colonist.effect_speed', { t: left }))}</span>`;
                        default: return `<span style="color:#88ffaa">${escapeHtml(t('ui.colonist.effect_other', { name: e.type, t: left }))}</span>`;
                    }
                }).join(', ');
                html += `<div class="info-row">${escapeHtml(t('ui.colonist.effects_label'))} ${effects}</div>`;
            }
            if (colonist.activeAuras && colonist.activeAuras.length > 0) {
                const auraSpans = colonist.activeAuras.map(a => {
                    const def = ALL_ITEMS[a.key];
                    const auraName = def ? itemName(def) : a.name;
                    const tip = def ? this._getTrinketTooltip(def) : auraName;
                    const clickAction = a.sourceType === 'pedestal'
                        ? `window.game.camera.centerOn(${a.x},${a.y})`
                        : `window.game.selectColonistById(${a.colonistId})`;
                    return `<span class="skill-tip" data-tip="${escapeAttr(tip)}" style="color:#ccaa44;cursor:pointer;text-decoration:underline" onclick="${clickAction}">${escapeHtml(auraName)}</span>`;
                }).join(', ');
                html += `<div class="info-row">${escapeHtml(t('ui.colonist.auras_label'))} ${auraSpans}</div>`;
            }
        }

        // --- Relationships ---
        const otherColonists = this.game.colonists.filter(c => c.id !== colonist.id && c.hp > 0);
        const notableRelationships = otherColonists
            .map(c => {
                const opinion = colonist.opinions?.[c.id] ?? 0;
                const storedKey = colonist.relationships?.[c.id];
                const tier = storedKey
                    ? (RELATIONSHIP_TIERS.find(t => t.key === storedKey) ?? getRelationshipTier(opinion))
                    : getRelationshipTier(opinion);
                return { colonist: c, tier, opinion };
            })
            .filter(r => r.tier.key !== 'stranger');
        notableRelationships.sort((a, b) => b.opinion - a.opinion);
        html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_relationships'))}</div>`;
        if (notableRelationships.length === 0) {
            html += `<div class="info-row" style="color:#555">${escapeHtml(t('ui.colonist.no_relationships'))}</div>`;
        } else {
            const relHtml = notableRelationships.map(r => {
                const tierDef = RELATIONSHIP_TIERS.find(t => t.key === r.tier.key) || r.tier;
                return `<span style="color:${tierDef.color}">[${escapeHtml(tierDef.name)}]</span> <span style="cursor:pointer;text-decoration:underline" onclick="window.game.selectColonistById(${r.colonist.id})">${escapeHtml(r.colonist.name)}</span> <span style="color:#555;font-size:0.85em">(${r.opinion > 0 ? '+' : ''}${r.opinion})</span>`;
            }).join('<br>');
            html += `<div class="info-row">${relHtml}</div>`;
        }

        // --- Thoughts ---
        if (thoughts) {
            html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_thoughts'))}</div>`;
            html += `<div class="info-thoughts">${thoughts}</div>`;
        }

        // --- Actions ---
        html += `<div style="${sectionHdr}">${escapeHtml(t('ui.colonist.section_actions'))}</div>`;
        html += `<div class="info-actions">`;
        html += `<button onclick="window.game.toggleDraft(${colonist.id})">${escapeHtml(colonist.drafted ? t('ui.main.undraft') : t('ui.main.draft'))}</button>`;
        html += `<button onclick="window.game.toggleGuard(${colonist.id})">${escapeHtml(colonist.guardMode ? t('ui.colonist.unguard') : t('ui.colonist.guard'))}</button>`;
        if (colonist.guardMode) html += `<button onclick="window.game.input.startGuardPointTargeting(${colonist.id})">${escapeHtml(t('ui.colonist.set_guard_point'))}</button>`;
        html += `<button onclick="window.game.draftAll()">${escapeHtml(t('ui.colonist.draft_all'))}</button>`;
        html += `<button onclick="window.game.undraftAll()">${escapeHtml(t('ui.colonist.undraft_all'))}</button>`;
        html += `<button onclick="window.game.autoEquipBest(${colonist.id})" title="${escapeAttr(t('ui.colonist.auto_equip_tip', { set: equipSetName(colonist.activeSet || 'Colony') }))}">${escapeHtml(t('ui.colonist.auto_equip'))}</button>`;
        const others = this.game.colonists.filter(c => c.hp > 0 && c.id !== colonist.id);
        if (others.length > 0) {
            html += `<select onchange="if(this.value)window.game.copyPriorities(${colonist.id},parseInt(this.value))"><option value="">${escapeHtml(t('ui.colonist.copy_priorities'))}</option>`;
            for (const o of others) html += `<option value="${o.id}">${escapeHtml(o.name)}</option>`;
            html += `</select>`;
        }
        html += `<button onclick="window.game.centerOnColonist(${colonist.id})">${escapeHtml(t('ui.colonist.center_camera'))}</button>`;
        const isFollowing = this.game.followingColonist === colonist.id;
        html += `<button onclick="window.game.toggleFollow(${colonist.id})">${escapeHtml(isFollowing ? t('ui.colonist.unfollow') : t('ui.colonist.follow'))}</button>`;
        html += `</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.color_label'))} <input type="color" value="${nc}" onchange="window.game.setColonistColor(${colonist.id}, this.value)"></div>`;
        return html;
    }

    showColonistInfo(colonist) {
        this._switchToInfoTab();
        this._viewingRiftGate = false;
        this.setSummaryVisible(false);
        this._viewingColonistId = colonist.id;
        this._pendingColonistInfoHtml = null;
        const html = this.buildColonistInfoHtml(colonist);
        this._lastColonistInfoHtml = html;
        this.elements.infoPanel.innerHTML = html;
    }

    // Live colony summary shown in the Info panel whenever nothing is selected.
    // Surfaces population, average mood, and actionable alerts (threats, hurt/
    // hungry/exhausted/idle colonists, pending tasks). Read-only; the optional
    // .overview-alert rows jump to the first matching colonist when clicked.
    buildColonyOverviewHtml() {
        let alive = 0, aliveGolems = 0, moodSum = 0;
        let idle = 0, hungry = 0, lowRest = 0, lowHp = 0, homeless = 0, noTome = 0, missingAttune = 0;
        let idleId = null, hungryId = null, lowRestId = null, lowHpId = null, homelessId = null, noTomeId = null, missingAttuneId = null;
        for (const c of this.game.colonists) {
            if (c.hp <= 0) continue;
            if (c.golem) { aliveGolems++; continue; }
            alive++;
            moodSum += c.mood;
            if (!c.drafted && !c.currentTaskId && c.state !== 'working') { idle++; if (idleId === null) idleId = c.id; }
            if (c.needs.hunger <= 25) { hungry++; if (hungryId === null) hungryId = c.id; }
            if (c.needs.rest <= 25) { lowRest++; if (lowRestId === null) lowRestId = c.id; }
            if (c.maxHp > 0 && c.hp / c.maxHp <= 0.35) { lowHp++; if (lowHpId === null) lowHpId = c.id; }
            if (!c.assignedBed) { homeless++; if (homelessId === null) homelessId = c.id; }
            if (!c.equippedTome) { noTome++; if (noTomeId === null) noTomeId = c.id; }
            const hasMagic = c.magicSkills && Object.values(c.magicSkills).some(v => v > 0);
            if (hasMagic) {
                const attuned = Array.isArray(c.attunedSchools) ? c.attunedSchools : [];
                if (attuned.length < MAGIC_STUDY_CONFIG.attunementSlots) { missingAttune++; if (missingAttuneId === null) missingAttuneId = c.id; }
            }
        }
        const avgMood = alive > 0 ? Math.round(moodSum / alive) : 0;
        const moodLevel = getMoodLabel(avgMood);
        const cap = this.game.waves.getColonistCap(this.game);
        const pendingTasks = this.game.taskQueue.getPendingCount();
        const waves = this.game.waves;
        const raiderCount = this.game.raiders.filter(r => r.hp > 0).length;

        let html = `<div class="info-header">${escapeHtml(t('ui.info.summary_title'))}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.info.population', { n: alive, cap }))}${aliveGolems > 0 ? ` <span style="color:#aaa">${escapeHtml(tp('ui.info.population_golems', aliveGolems))}</span>` : ''}</div>`;
        const moodColor = avgMood >= 60 ? '#88cc44' : avgMood >= 35 ? '#ccaa44' : '#ff6644';
        const moodBar = statBarHtml({ key: 'overview:mood', pct: avgMood, color: moodColor, max: 100, width: 90 });
        html += `<div class="info-row">${escapeHtml(t('ui.info.mood', { n: avgMood }))} ${moodBar} <span style="color:${moodColor}">${escapeHtml(t('ui.info.mood_level', { mood: moodName(moodLevel) }))}</span></div>`;

        html += `<div class="info-row" style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #333;margin-top:8px;padding-bottom:2px">${escapeHtml(t('ui.info.alerts'))}</div>`;
        const alerts = [];
        if (waves.active) {
            const hpPct = waves.nexusMaxHp > 0 ? Math.round((waves.nexusHp / waves.nexusMaxHp) * 100) : 0;
            const hpColor = hpPct > 60 ? '#44ff44' : hpPct > 30 ? '#ffaa44' : '#ff4444';
            const hpBar = statBarHtml({ key: 'overview:nexushp', pct: hpPct, color: hpColor, max: waves.nexusMaxHp, width: 70 });
            const remaining = waves.enemiesToSpawn - waves.enemiesSpawned;
            alerts.push(`<div class="info-row" style="color:#ff6644;font-weight:bold">${escapeHtml(t('ui.info.alert_wave_active', { n: waves.currentWave }))}</div>`);
            alerts.push(`<div class="info-row" style="color:#bb88ff">${escapeHtml(t('ui.info.alert_nexus_hp', { hp: waves.nexusHp, max: waves.nexusMaxHp }))} ${hpBar}</div>`);
            alerts.push(`<div class="info-row" style="color:#ff8844">${escapeHtml(remaining > 0 ? t('ui.info.alert_enemies_spawning', { n: waves.enemies.length, spawning: remaining }) : t('ui.info.alert_enemies', { n: waves.enemies.length }))}</div>`);
        }
        if (raiderCount > 0) alerts.push(`<div class="info-row" style="color:#ff6644">${escapeHtml(tp('ui.info.alert_hostiles', raiderCount))}</div>`);
        if (lowHp > 0) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${lowHpId}" style="color:#ff4444;cursor:pointer">${escapeHtml(t('ui.info.alert_hurt', { n: lowHp }))}</div>`);
        if (hungry > 0) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${hungryId}" style="color:#ccaa44;cursor:pointer">${escapeHtml(t('ui.info.alert_hungry', { n: hungry }))}</div>`);
        if (lowRest > 0) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${lowRestId}" style="color:#ccaa44;cursor:pointer">${escapeHtml(t('ui.info.alert_exhausted', { n: lowRest }))}</div>`);
        if (idle > 0) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${idleId}" style="color:#88aaff;cursor:pointer">${escapeHtml(t('ui.info.alert_idle', { n: idle }))}</div>`);
        // Housing, tome and attunement alerts wait out the first day, and while the
        // walkthrough is on they wait until it has taught that topic, so a new colony
        // doesn't open on a list of things the player hasn't been shown yet.
        const tut = this.game.tutorial;
        const walkthrough = this.game.settings.showTutorial && tut && !tut.isChecklist && !tut.isFinished();
        const taught = (...ids) => !walkthrough || ids.some(id => tut.completed.has(id));
        const settled = this.game.tick >= CONFIG.TICKS_PER_DAY;
        if (homeless > 0 && settled && taught('bedroom', 'bedroom_bed')) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${homelessId}" style="color:#ccaa44;cursor:pointer">${escapeHtml(t('ui.info.alert_homeless', { n: homeless }))}</div>`);
        if (noTome > 0 && settled && taught('tome')) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${noTomeId}" style="color:#88aaff;cursor:pointer">${escapeHtml(t('ui.info.alert_no_tome', { n: noTome }))}</div>`);
        // At the cap, wanderers get turned away; point at the way to grow.
        if (alive >= cap && settled && taught('colony_growth') && cap < (WORLD_SIZE_COLONY[this.game.map[0].length]?.capMax ?? Infinity)) {
            alerts.push(`<div class="info-row" style="color:#ff8866">${escapeHtml(t('ui.info.alert_cap', { n: alive, cap }))}</div>`);
        }
        if (missingAttune > 0 && settled && taught('attunement')) alerts.push(`<div class="info-row overview-alert" data-colonist-id="${missingAttuneId}" style="color:#bb88ff;cursor:pointer">${escapeHtml(tp('ui.info.alert_missing_attune', missingAttune))}</div>`);
        if (pendingTasks > 0) alerts.push(`<div class="info-row" style="color:#ccaa44">${escapeHtml(tp('ui.info.alert_pending_tasks', pendingTasks))}</div>`);
        if (alerts.length === 0) alerts.push(`<div class="info-row" style="color:#88cc44">${escapeHtml(t('ui.info.alert_all_well'))}</div>`);
        html += alerts.join('');
        return html;
    }

    // Select nothing: clear the info panel and let the persistent summary footer
    // stand on its own. The summary itself is driven every frame by update().
    showColonyOverview() {
        this._switchToInfoTab(false);
        this._viewingColonistId = null;
        this._pendingColonistInfoHtml = null;
        this._viewingRiftGate = false;
        this._viewingRitualAltar = false;
        this._lastTileInfo = null;
        if (this.elements.infoPanel.innerHTML !== '') this.elements.infoPanel.innerHTML = '';
        this._lastColonistInfoHtml = null;
        this.setSummaryVisible(true);
    }

    // Show or hide the persistent Colony Summary footer, and keep its contents
    // live while visible. `visible` is set by the show* methods: false whenever
    // a living entity (colonist/animal/raider/tamed/summon) is the subject, true
    // otherwise (nothing selected, or a tile/structure is selected).
    setSummaryVisible(visible) {
        this._summaryVisible = visible;
        if (!visible) {
            if (this.elements.colonySummary.innerHTML !== '') this.elements.colonySummary.innerHTML = '';
            this.elements.colonySummary.style.display = 'none';
            this._lastSummaryHtml = null;
            this._pendingSummaryHtml = null;
        } else {
            this.elements.colonySummary.style.display = '';
            this._refreshColonySummary();
        }
    }

    _refreshColonySummary() {
        if (!this._summaryVisible) return;
        const html = this.buildColonyOverviewHtml();
        if (html !== this._lastSummaryHtml) {
            this._lastSummaryHtml = html;
            if (this.elements.colonySummary.matches(':hover')) {
                this._pendingSummaryHtml = html;
            } else {
                this.elements.colonySummary.innerHTML = html;
                this._pendingSummaryHtml = null;
            }
        }
    }

    _buildSlotSelect(colonist, slot) {
        const overlayStyle = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
        const SLOT_CONFIG = {
            weapon: { listName: 'weapons', label: t('ui.colonist.slot_weapon'), fallback: t('ui.colonist.fists'), equipFn: 'equipWeapon', unequipFn: 'unequipWeapon', statRenderer: w => { const cd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown; const parts = [t('ui.colonist.weapon_stats', { dmg: w.damage, dps: (w.damage / cd).toFixed(1), speed: weaponSpeedLabel(cd) })]; parts.push(...getOnHitLines(w)); return parts.join(', '); } },
            armor: { listName: 'armors', label: t('ui.colonist.slot_armor'), fallback: t('common.none'), equipFn: 'equipArmor', unequipFn: 'unequipArmor', statRenderer: a => getItemStatLines(a).join(', ') },
            helmet: { listName: 'helmets', label: t('ui.colonist.slot_helmet'), fallback: t('common.none'), equipFn: 'equipHelmet', unequipFn: 'unequipHelmet', statRenderer: h => getItemStatLines(h).join(', ') },
            clothes: { listName: 'clothes', label: t('ui.colonist.slot_clothes'), fallback: t('common.none'), equipFn: 'equipClothes', unequipFn: 'unequipClothes', statRenderer: c => getItemStatLines(c).join(', ') },
            tool: { listName: 'tools', label: t('ui.colonist.slot_offhand'), fallback: t('common.none'), equipFn: 'equipTool', unequipFn: 'unequipTool', statRenderer: tool => {
                const lines = getItemStatLines(tool);
                if (tool.expedition) { const el = getNestedEffectLines(tool.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
            trinket: { listName: 'trinkets', label: t('ui.colonist.slot_trinket'), fallback: t('common.none'), equipFn: 'equipTrinket', unequipFn: 'unequipTrinket', statRenderer: a => {
                const lines = getItemStatLines(a);
                if (a.expedition) { const el = getNestedEffectLines(a.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
            boots: { listName: 'boots', label: t('ui.colonist.slot_boots'), fallback: t('common.none'), equipFn: 'equipBoots', unequipFn: 'unequipBoots', statRenderer: b => {
                const lines = getItemStatLines(b);
                if (b.expedition) { const el = getNestedEffectLines(b.expedition); if (el.length) lines.push(...el); }
                return lines.join(', ');
            } },
        };
        if (slot === 'tome') {
            const tomes = this.game.resources.tomes || [];
            let html = `<select style="${overlayStyle}" id="eq-tome-${colonist.id}" onchange="if(this.value==='unequip'){window.game.unequipTome(${colonist.id})}else if(this.value!==''){const i=window.game.ui._resolveSelectItemIndex(this,'tomes');if(i>=0)window.game.equipTome(${colonist.id},i)}">`;
            const currentTome = colonist.equippedTome ? SPELL_TOMES[colonist.equippedTome]?.name : t('common.none');
            html += `<option value="">${escapeHtml(t('ui.colonist.slot_current', { slot: t('ui.colonist.slot_tome'), item: currentTome }))}</option>`;
            if (colonist.equippedTome) html += `<option value="unequip">${escapeHtml(t('ui.colonist.unequip'))}</option>`;

            const attuned = Array.isArray(colonist.attunedSchools) ? colonist.attunedSchools : [];
            const attunedEntries = [];
            const otherEntries = [];

            tomes.forEach((tome, i) => {
                const def = SPELL_TOMES[tome.key];
                if (!def) return;
                const spell = SPELLS[def.spell];
                if (!spell) return;
                if (colonist.knownSpells.includes(def.spell)) return;
                const canStudy = (colonist.magicSkills[spell.school] || 0) >= def.minSchoolLevel;
                const label = escapeHtml(canStudy
                    ? t('ui.colonist.tome_option', { name: def.name, lv: def.minSchoolLevel })
                    : t('ui.colonist.tome_option_locked', { name: def.name, lv: def.minSchoolLevel, school: MAGIC_SKILLS[spell.school]?.name }));
                const entry = { i, def, spell, canStudy, label, sig: this._itemSig(tome) };
                if (attuned.includes(spell.school)) attunedEntries.push(entry);
                else otherEntries.push(entry);
            });

            attunedEntries.sort((a, b) => a.def.minSchoolLevel - b.def.minSchoolLevel);
            otherEntries.sort((a, b) => a.def.minSchoolLevel - b.def.minSchoolLevel);

            if (attunedEntries.length > 0) {
                html += `<optgroup label="${escapeAttr(t('ui.colonist.tome_group_attuned'))}">`;
                attunedEntries.forEach(({ i, canStudy, label, sig }) => {
                    html += `<option value="${i}" data-sig="${sig}"${canStudy ? '' : ' disabled'}>${label}</option>`;
                });
                html += `</optgroup>`;
            }
            if (otherEntries.length > 0) {
                html += `<optgroup label="${escapeAttr(t('ui.colonist.tome_group_other'))}">`;
                otherEntries.forEach(({ i, canStudy, label, sig }) => {
                    html += `<option value="${i}" data-sig="${sig}"${canStudy ? '' : ' disabled'}>${label}</option>`;
                });
                html += `</optgroup>`;
            }
            if (tomes.length === 0 && !colonist.equippedTome) html += `<option disabled>${escapeHtml(t('ui.colonist.no_tomes_available'))}</option>`;
            html += `</select>`;
            return html;
        }
        const cfg = SLOT_CONFIG[slot];
        const items = this.game.resources[cfg.listName];
        const current = colonist[slot];
        let html = `<select style="${overlayStyle}" id="eq-${slot}-${colonist.id}" onchange="if(this.value==='unequip'){window.game.${cfg.unequipFn}(${colonist.id})}else if(this.value!==''){const i=window.game.ui._resolveSelectItemIndex(this,'${cfg.listName}');if(i>=0)window.game.${cfg.equipFn}(${colonist.id},i)}">`;
        html += `<option value="">${escapeHtml(t('ui.colonist.slot_current', { slot: cfg.label, item: current ? itemName(current) : cfg.fallback }))}</option>`;
        if (current) html += `<option value="unequip">${escapeHtml(t('ui.colonist.unequip_item', { item: itemName(current) }))}</option>`;
        items.forEach((item, i) => {
            const stats = cfg.statRenderer(item);
            html += `<option value="${i}" data-sig="${this._itemSig(item)}">${escapeHtml(itemName(item))}${stats ? ` (${escapeHtml(stats)})` : ''}</option>`;
        });
        if (items.length === 0 && !current) html += `<option disabled>${escapeHtml(t({ weapon: 'ui.colonist.no_slot_items_weapon', armor: 'ui.colonist.no_slot_items_armor', helmet: 'ui.colonist.no_slot_items_helmet', clothes: 'ui.colonist.no_slot_items_clothes', tool: 'ui.colonist.no_slot_items_tool', trinket: 'ui.colonist.no_slot_items_trinket', boots: 'ui.colonist.no_slot_items_boots' }[slot]))}</option>`;
        html += `</select>`;
        return html;
    }

    // Short fingerprint of an inventory item (its primitive fields), stamped on
    // equip <option>s. The colonist panel defers its rebuild while hovered, so
    // an option's index can be stale by the time it's picked.
    _itemSig(item) {
        let src = '';
        for (const [k, v] of Object.entries(item || {})) {
            if (v === null || typeof v !== 'object') src += `${k}=${v};`;
        }
        let h = 5381;
        for (let i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
        return h.toString(36);
    }

    // Map a picked equip <option> back to the item's current index in the live
    // inventory list: keep its index if the item there still matches, else find
    // the matching item elsewhere. Returns -1 (and refreshes) if it's gone.
    _resolveSelectItemIndex(select, listName) {
        const opt = select.selectedOptions[0];
        const list = this.game.resources[listName] || [];
        const idx = parseInt(select.value);
        const sig = opt?.dataset.sig;
        if (!sig) return idx;
        if (list[idx] && this._itemSig(list[idx]) === sig) return idx;
        const found = list.findIndex(it => this._itemSig(it) === sig);
        if (found < 0) {
            select.value = '';
            if (this._viewingColonistId != null) {
                const c = this.game.getColonist(this._viewingColonistId);
                if (c) this.showColonistInfo(c);
            }
        }
        return found;
    }

    // Track which equipment set tab each colonist is viewing in the UI.
    _setColonistViewingSet(colonistId, setName) {
        if (!this._colonistViewingSet) this._colonistViewingSet = {};
        this._colonistViewingSet[colonistId] = setName;
        const c = this.game.getColonist(colonistId);
        if (c) this.showColonistInfo(c);
    }

    // Build an invisible select overlay for assigning items from global inventory into an
    // inactive set slot. Selecting an item calls assignItemToSet; selecting "none" is a no-op.
    _buildSetAssignSelect(colonist, setName, slot, listName) {
        const overlayStyle = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
        const items = this.game.resources[listName] || [];
        const SLOT_CONFIG_LABELS = {
            weapon: { label: t('ui.colonist.slot_weapon'), statRenderer: w => { const cd = w.attackCooldown || 20; return t('ui.colonist.weapon_stats_short', { dmg: w.damage, dps: (w.damage/cd).toFixed(1) }); } },
            armor:   { label: t('ui.colonist.slot_armor'),   statRenderer: a => getItemStatLines(a).join(', ') },
            helmet:  { label: t('ui.colonist.slot_helmet'),  statRenderer: h => getItemStatLines(h).join(', ') },
            clothes: { label: t('ui.colonist.slot_clothes'), statRenderer: c => getItemStatLines(c).join(', ') },
            tool:    { label: t('ui.colonist.slot_offhand'), statRenderer: tool => getItemStatLines(tool).join(', ') },
            trinket: { label: t('ui.colonist.slot_trinket'), statRenderer: a => getItemStatLines(a).join(', ') },
            boots:   { label: t('ui.colonist.slot_boots'),   statRenderer: b => getItemStatLines(b).join(', ') },
        };
        const cfg = SLOT_CONFIG_LABELS[slot];
        let html = `<select style="${overlayStyle}" onchange="if(this.value!==''){const i=window.game.ui._resolveSelectItemIndex(this,'${listName}');if(i>=0)window.game.assignItemToSet(${colonist.id},${jsArg(setName)},'${slot}','${listName}',i);this.value=''}">`;
        html += `<option value="">${escapeHtml(t('ui.colonist.assign_slot', { slot: cfg.label }))}</option>`;
        items.forEach((item, i) => {
            const stats = cfg.statRenderer(item);
            html += `<option value="${i}" data-sig="${this._itemSig(item)}">${escapeHtml(itemName(item))}${stats ? ` (${escapeHtml(stats)})` : ''}</option>`;
        });
        if (items.length === 0) html += `<option disabled>${escapeHtml(t('ui.colonist.no_items_available'))}</option>`;
        html += `</select>`;
        return html;
    }

    // Size row for a room section: points earned plus the room's actual size
    // and the ideal range for its type, so players can see what to aim for.
    _roomSizeRowHtml(q, roomType, cap) {
        const sz = q.size;
        const band = ROOM_SIZE_BANDS[roomType];
        const tiles = tp('ui.tile.room_tiles', sz.tiles);
        let actual = tiles;
        if (band.metric !== 'total') {
            const per = Math.round(sz.value * 10) / 10;
            const count = tp(roomType === 'bedroom' ? 'ui.tile.room_beds' : 'ui.tile.room_stations', sz.count, { per });
            actual = t('ui.tile.room_size_actual', { tiles, count });
        }
        const range = sz.idealMax === Infinity ? t('ui.tile.room_range_open', { min: sz.idealMin }) : t('ui.tile.room_range', { min: sz.idealMin, max: sz.idealMax });
        const idealKey = { perBed: 'ui.tile.room_ideal_per_bed', perStation: 'ui.tile.room_ideal_per_station' }[band.metric] || 'ui.tile.room_ideal_tiles';
        const ok = sz.verdict === 'ideal';
        const verdictName = { 'too small': t('ui.tile.room_too_small'), 'too large': t('ui.tile.room_too_large') }[sz.verdict] || sz.verdict;
        const verdict = ok ? '' : ` <span style="color:#ffaa44;">(${escapeHtml(verdictName)})</span>`;
        return `<div class="info-row" style="color:#888;font-size:0.85em;">${escapeHtml(t('ui.tile.room_size', { score: sz.score, cap, actual }))} <span style="color:${ok ? '#88ff88' : '#888'};">${escapeHtml(t(idealKey, { range }))}</span>${verdict}</div>`;
    }

    // Required-furniture checklist for a room section. Missing entries list the
    // pieces that would satisfy them in this room type.
    _roomRequirementsHtml(q, roomType) {
        const req = q.requirements;
        let html = `<div class="info-row" style="color:#888;font-size:0.85em;">${escapeHtml(t('ui.tile.room_required_furniture'))}</div>`;
        for (const r of req.list) {
            const label = escapeHtml(FURNITURE_TYPES[r.type] || r.type);
            if (r.met) {
                html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">    ✓ ${label} ${r.have}/${r.need}</div>`;
            } else {
                const options = Object.entries(BUILDINGS)
                    .filter(([, b]) => b.furnitureType === r.type && !b.noBuild && furnitureCountsFor(b, roomType))
                    .map(([k]) => buildingName(k));
                html += `<div class="info-row" style="color:#ff7766;font-size:0.85em;">    ✗ ${label} ${r.have}/${r.need}${options.length ? ` (${escapeHtml(options.join(', '))})` : ''}</div>`;
            }
        }
        if (!req.allMet) {
            html += `<div class="info-row" style="color:#ffaa44;font-size:0.85em;">${escapeHtml(t('ui.tile.room_quality_ceiling', { n: req.ceiling }))}</div>`;
        }
        return html;
    }

    _buildRoomQualityHtml(roomId) {
        let html = '';
        const rq = this.game.roomQualities[roomId];
        const wq = this.game.workshopQualities[roomId];
        const th = this.game.townHallQualities[roomId];
        if (!rq && !wq && !th) {
            html += `<div class="info-row">${escapeHtml(t('ui.tile.room_id', { id: roomId }))}</div>`;
            return html;
        }
        if (th) {
            html += `<div class="info-row" style="color:#ffdd66;font-weight:bold;">${escapeHtml(t('ui.tile.room_townhall_title', { tier: roomTierName(th), n: th.total }))}</div>`;
            html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">${escapeHtml(t('ui.tile.room_townhall_mood', { n: th.moodEffect, ticks: th.duration }))}</div>`;
            const b = th.breakdown;
            const thCaps = ROOM_SCORE_CAPS.townhall;
            html += this._roomRequirementsHtml(th, 'townhall');
            html += this._roomSizeRowHtml(th, 'townhall', thCaps.size);
            html += this._roomScoreRowsHtml(b, thCaps, th.decorList);
        }
        if (rq) {
            html += `<div class="info-row" style="color:#aaccff;font-weight:bold;">${escapeHtml(t('ui.tile.room_bedroom_title', { tier: roomTierName(rq), n: rq.total }))}</div>`;
            html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">${escapeHtml(t('ui.tile.room_bedroom_mood', { n: rq.moodEffect, ticks: rq.duration }))}</div>`;
            const b = rq.breakdown;
            const rqCaps = ROOM_SCORE_CAPS.bedroom;
            html += this._roomRequirementsHtml(rq, 'bedroom');
            html += this._roomSizeRowHtml(rq, 'bedroom', rqCaps.size);
            html += this._roomScoreRowsHtml(b, rqCaps, rq.decorList);
        }
        if (wq) {
            const label = wq.focusGroup ? t('ui.tile.room_workshop_label', { tier: roomTierName(wq), group: focusGroupName(wq.focusGroup) }) : roomTierName(wq);
            html += `<div class="info-row" style="color:#ffcc44;font-weight:bold;">${escapeHtml(t('ui.tile.room_workshop_title', { label, n: wq.total }))}</div>`;
            const b = wq.breakdown;
            const wqCaps = ROOM_SCORE_CAPS.workshop;
            html += this._roomRequirementsHtml(wq, 'workshop');
            html += this._roomSizeRowHtml(wq, 'workshop', wqCaps.size);
            const row = (text) => `<div class="info-row" style="color:#888;font-size:0.85em;">${escapeHtml(text)}</div>`;
            if (b.floor > 0) html += row(t('ui.tile.room_flooring', { n: b.floor, cap: wqCaps.floor }));
            if (b.light > 0) html += row(t('ui.tile.room_lighting', { n: b.light, cap: wqCaps.light }));
            if (b.focus > 0) html += row(wq.focusGroup ? t('ui.tile.room_focus_group', { n: b.focus, cap: wqCaps.focus, group: focusGroupName(wq.focusGroup) }) : t('ui.tile.room_focus', { n: b.focus, cap: wqCaps.focus }));
            if (b.support > 0) html += row(t('ui.tile.room_support', { n: b.support, cap: wqCaps.support, list: wq.supportList.map(s => buildingName(s)).join(', ') }));
            if (wq.speedMult > 1 || wq.qualityBonus > 0) {
                const bonusParts = [];
                if (wq.speedMult > 1) bonusParts.push(t('ui.tile.room_bonus_speed', { pct: Math.round((wq.speedMult - 1) * 100) }));
                if (wq.qualityBonus > 0) bonusParts.push(t('ui.tile.room_bonus_quality', { n: wq.qualityBonus }));
                html += `<div class="info-row" style="color:#88ff88;font-size:0.85em;">${escapeHtml(t('ui.tile.room_bonus', { bonus: bonusParts.join(' | ') }))}</div>`;
            }
        }
        return html;
    }

    // Flooring / lighting / decor / coherence score rows shared by the bedroom
    // and town hall sections.
    _roomScoreRowsHtml(b, caps, decorList) {
        const row = (text) => `<div class="info-row" style="color:#888;font-size:0.85em;">${escapeHtml(text)}</div>`;
        let html = '';
        if (b.floor > 0) html += row(t('ui.tile.room_flooring', { n: b.floor, cap: caps.floor }));
        if (b.light > 0) html += row(t('ui.tile.room_lighting', { n: b.light, cap: caps.light }));
        if (b.decor > 0) html += row(t('ui.tile.room_decor', { n: b.decor, cap: caps.decor, list: decorList.map(d => buildingName(d)).join(', ') }));
        if (b.coherence > 0) html += row(t('ui.tile.room_coherence', { n: b.coherence, cap: caps.coherence }));
        return html;
    }

    _buildBedInfoHtml(tile, x, y) {
        let html = '';
        const assigned = this.game.colonists.find(c =>
            c.assignedBed && c.assignedBed.x === x && c.assignedBed.y === y && c.hp > 0
        );
        if (assigned) {
            html += `<div class="info-row">${escapeHtml(t('ui.tile.bed_assigned_to', { name: assigned.name }))}</div>`;
            html += `<div class="info-actions"><button onclick="window.game.unassignBed(${x},${y})">${escapeHtml(t('ui.tile.bed_unassign'))}</button></div>`;
        } else {
            html += `<div class="info-row">${escapeHtml(t('ui.tile.bed_unassigned'))}</div>`;
            html += `<div class="info-actions">`;
            html += `<label>${escapeHtml(t('ui.tile.bed_assign_label'))} </label>`;
            html += `<select id="bed-assign-select" onchange="window.game.assignBedFromSelect(${x},${y},this.value)">`;
            html += `<option value="">${escapeHtml(t('ui.tile.bed_select_colonist'))}</option>`;
            for (const c of this.game.colonists) {
                if (c.hp <= 0) continue;
                html += `<option value="${c.id}">${escapeHtml(c.assignedBed ? t('ui.tile.bed_option_has_bed', { name: c.name }) : c.name)}</option>`;
            }
            html += `</select></div>`;
        }
        return html;
    }

    _buildNexusInfoHtml() {
        let html = '';
        const waves = this.game.waves;
        html += `<div class="info-row" style="color:#9933ff;font-weight:bold;">${escapeHtml(t('ui.tile.nexus_title'))}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.tile.nexus_stats', { wave: waves.highestWaveCompleted, cap: waves.getColonistCap(this.game) }))}</div>`;
        if (waves.active) {
            html += `<div class="info-row" style="color:#ff4444;">${escapeHtml(t('ui.tile.nexus_wave_active', { n: waves.currentWave, alive: waves.enemies.length }))}</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('nexus')" style="background:#6622aa;color:white;">${escapeHtml(t('ui.tile.open_rifts_panel'))}</button></div>`;
        return html;
    }

    _buildPedestalInfoHtml(tile, x, y) {
        let html = '';
        if (tile.pedestalArtifact) {
            const artDef = ALL_ITEMS[tile.pedestalArtifact];
            const broken = tile.pedestalInactive ? ` <span style="color:#ff4444;">${escapeHtml(t('ui.tile.pedestal_no_power'))}</span>` : '';
            const stats = getTilePedestalStats(tile);
            const level = getPedestalCharge(tile);
            const lv = PEDESTAL_CHARGE.levels[level];
            const chargeTag = level > 0 ? ` <span style="color:${lv.color};">[${escapeHtml(lv.name)}]</span>` : '';
            html += `<div class="info-row" style="color:#ccaa44;">${escapeHtml(t('ui.tile.pedestal_placed_label'))} ${this._itemIcon(tile.pedestalArtifact, artDef?.type || 'trinket')}${escapeHtml(artDef ? itemName(artDef) : tile.pedestalArtifact)}${chargeTag}${broken}</div>`;
            html += this.getPedestalEffectDescription({ pedestal: stats });
            if (stats?.radius && stats.radius !== 'global') {
                html += `<div class="info-row">${escapeHtml(t('ui.tile.pedestal_radius', { radius: stats.radius, mana: stats.manaCost || 0 }))}</div>`;
            } else if (stats?.radius === 'global') {
                html += `<div class="info-row">${escapeHtml(t('ui.tile.pedestal_global', { mana: stats.manaCost || 0 }))}</div>`;
            }
            html += this._buildPedestalChargeHtml(artDef?.pedestal, level, x, y);
            if (stats?.manaCost) html += this._buildPowerPriorityHtml('artifact_pedestal', x, y);
            html += `<div class="info-actions"><button onclick="window.game.retrievePedestalItem(${x},${y})">${escapeHtml(t('ui.tile.pedestal_retrieve'))}</button></div>`;
        } else {
            html += `<div class="info-row" style="color:#888;">${escapeHtml(t('ui.tile.pedestal_empty'))}</div>`;
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
                    html += `<option value="${escapeAttr(art.key)}">${escapeHtml(itemName(art))}</option>`;
                }
                html += `</select>`;
                html += `<button onclick="window.game.placePedestalItem(${x},${y},document.getElementById('pedestal-select').value)">${escapeHtml(t('ui.tile.pedestal_place'))}</button></div>`;
            } else {
                html += `<div class="info-row" style="color:#666;">${escapeHtml(t('ui.tile.pedestal_none_available'))}</div>`;
            }
        }
        return html;
    }

    _buildRiftGateInfoHtml() {
        let html = '';
        html += `<div class="info-row" style="color:#33ccff;font-weight:bold;">${escapeHtml(this._riftPortalTitle || t('ui.tile.portal_rift_gate'))}</div>`;
        const expl = this.game.exploration;
        const watchedExp = expl.expeditions.find(e => !e.autoMode);
        const autoCount = expl.expeditions.filter(e => e.autoMode).length;
        if (watchedExp) {
            const elapsed = this.game.tick - (watchedExp.startTick || this.game.tick);
            const totalDur = Math.floor((watchedExp.duration || 1) * 1.2);
            const pct = watchedExp.status === 'gathering' ? 0 : Math.min(100, Math.floor((elapsed / totalDur) * 100));
            html += `<div class="info-row" style="color:#aaddff;">${escapeHtml(t('ui.tile.exp_progress', { realm: expRealmName(watchedExp), status: expStatusName(watchedExp.status), pct }))}</div>`;
        }
        if (autoCount > 0) {
            html += `<div class="info-row" style="color:#66ccaa;font-size:0.9em;">${escapeHtml(t('ui.tile.exp_auto_count', { n: autoCount }))}</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('expeditions')" style="background:#1a4466;color:#88ddff;">${escapeHtml(t('ui.tile.open_rifts_panel'))}</button></div>`;
        return html;
    }

    // Overcharge picker: each level shows its mana cost so the trade-off is visible up front.
    _buildPedestalChargeHtml(pedestal, level, x, y) {
        if (!pedestal?.manaCost) return '';
        const max = getMaxPedestalCharge(pedestal);
        const options = PEDESTAL_CHARGE.levels.slice(0, max + 1).map((lv, i) => ({
            value: i,
            label: t('ui.tile.charge_option', { name: lv.name, mana: pedestal.manaCost * lv.costMult }),
            color: lv.color,
            title: i === 0 ? t('ui.tile.charge_base')
                : pedestal.radius !== 'global' ? t('ui.tile.charge_tip_radius', { mult: lv.costMult, strength: lv.strength, radius: lv.radiusBonus })
                    : t('ui.tile.charge_tip', { mult: lv.costMult, strength: lv.strength }),
        }));
        let html = `<div class="info-row" style="font-size:11px;color:#ccaa44;">${escapeHtml(t('ui.tile.charge_label'))}</div>`;
        html += this._choiceButtonsHtml(options, level, i => `window.game.setPedestalCharge(${x},${y},${i})`);
        if (max < PEDESTAL_CHARGE.levels.length - 1) {
            html += `<div class="info-row" style="color:#888;font-size:11px;">${escapeHtml(t('ui.tile.charge_global_cap', { name: PEDESTAL_CHARGE.levels[max].name }))}</div>`;
        }
        return html;
    }

    _buildTradeRiftInfoHtml(tile, x, y) {
        let html = '';
        html += `<div class="info-row" style="color:#66ccaa;font-weight:bold;">${escapeHtml(t('ui.tile.trade_rift_title'))}</div>`;
        const requests = this.game.tradeRift.requests;
        const open = requests.filter(r => !r.fulfilled).length;
        html += `<div class="info-row">${escapeHtml(tp('ui.tile.trade_rift_open', open))}</div>`;
        if (!this.game.power.isPowered(x, y)) {
            html += `<div class="info-row" style="color:#ff8844;">${escapeHtml(t('ui.tile.trade_rift_unpowered'))}</div>`;
        }
        html += `<div class="info-actions"><button onclick="window.game.ui.toggleArcanePanel('requests')" style="background:#1a5544;color:#88ddcc;">${escapeHtml(t('ui.tile.open_rifts_panel'))}</button></div>`;
        return html;
    }


    getCraftOutputTip(outputKey) {
        if (WEAPONS[outputKey]) {
            const w = WEAPONS[outputKey];
            const baseCd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            const dpt = (w.damage / baseCd).toFixed(1);
            let tip = w.description ? `${w.description} ` : '';
            tip += t('ui.colonist.weapon_stats', { dmg: w.damage, dps: dpt, speed: weaponSpeedLabel(baseCd) });
            if (w.ranged) tip += t('ui.craft.tip_range', { n: w.range });
            const extras = getItemStatLines({ ...w, damage: undefined, ranged: undefined, range: undefined });
            if (extras.length) tip += `, ${extras.join(', ')}`;
            const onHit = getOnHitLines(w);
            if (onHit.length) tip += `, ${onHit.join(', ')}`;
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
            const tool = TOOLS[outputKey];
            let tip = tool.description ? `${tool.description} ` : '';
            tip += getItemStatLines(tool).join(', ');
            return tip;
        }
        if (ALL_ITEMS[outputKey]?.type === 'trinket') {
            return this._getTrinketTooltip(ALL_ITEMS[outputKey]);
        }
        if (POTIONS[outputKey]) {
            const p = POTIONS[outputKey];
            let tip = p.description ? `${p.description} ` : '';
            if (p.effect === 'heal') tip += t('ui.craft.potion_heal', { n: p.healAmount });
            else if (p.effect === 'speed') tip += t('ui.craft.potion_speed', { work: Math.round((p.workSpeedBonus - 1) * 100), move: Math.round(p.moveSpeedBonus * 100), ticks: p.duration });
            else if (p.effect === 'restoreMana') tip += t('ui.craft.potion_mana', { n: p.manaAmount });
            else if (p.effect === 'resistance') tip += t('ui.craft.potion_resistance', { pct: Math.round(p.damageReduction * 100), ticks: p.duration });
            return tip.trim();
        }
        if (SPELL_TOMES[outputKey]) {
            const tome = SPELL_TOMES[outputKey];
            const spell = SPELLS[tome.spell];
            let tip = tome.description ? `${tome.description} ` : '';
            tip += t('ui.craft.tome_school', { school: MAGIC_SKILLS[spell.school]?.name || spell.school, lv: tome.minSchoolLevel });
            if (spell.manaCost) tip += t('ui.craft.tome_mana', { n: spell.manaCost });
            if (spell.damage) tip += t('ui.craft.tome_damage', { n: spell.damage });
            if (spell.healAmount) tip += t('ui.craft.tome_heals', { n: spell.healAmount });
            if (spell.range) tip += t('ui.craft.tip_range', { n: spell.range });
            return tip;
        }
        return null;
    }

    // Display name for a wild animal type: its configured name (crypt guardians have
    // one, e.g. "Crypt Warden"), else the type with underscores read as spaces.
    // Returned HTML-escaped (mods define animal names).
    _animalDisplayName(type) {
        const name = ANIMALS[type]?.name || entityName(type);
        return escapeHtml(name.charAt(0).toUpperCase() + name.slice(1));
    }

    showAnimalInfo(animal) {
        this._switchToInfoTab();
        this._viewingColonistId = null;
        this._pendingColonistInfoHtml = null;
        this.setSummaryVisible(false);
        const def = ANIMALS[animal.type];
        let html = `<div class="info-header">${this._animalDisplayName(animal.type)}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: animal.hp, max: animal.maxHp }))}</div>`;
        html += `<div class="info-row">${escapeHtml(animal.hostile ? t('ui.info.animal_hostile') : t('ui.info.animal_passive'))}</div>`;
        if (def?.meatYield) html += `<div class="info-row">${escapeHtml(t('ui.info.animal_meat_yield', { n: def.meatYield }))}</div>`;
        if (def?.hideYield) html += `<div class="info-row">${escapeHtml(t('ui.info.animal_hide_yield', { n: def.hideYield }))}</div>`;
        html += `<div class="info-actions">`;
        if (!animal.hostile) {
            html += `<button onclick="window.game.huntAnimal(${animal.id})">${escapeHtml(t('ui.info.animal_hunt'))}</button>`;
        }
        html += `</div>`;
        this.elements.infoPanel.innerHTML = html;
    }

    refreshInfoPanel() {
        const last = this._lastTileInfo;
        if (last && last.tile) this.showTileInfo(last.tile, last.x, last.y);
    }

    _refreshRitualAltarInfo() {
        const el = this.elements.infoPanel.querySelector('#ritual-altar-section');
        if (!el) { this._viewingRitualAltar = false; return; }
        // Only swap when the content changed (e.g. the cooldown second ticks
        // over), so the Perform button isn't replaced mid-click every frame.
        const html = this._buildRitualHtml(true);
        if (html !== el._lastHtml) {
            el._lastHtml = html;
            el.innerHTML = html;
        }
    }

    _buildRitualHtml(inner = false) {
        let html = inner ? '' : `<div id="ritual-altar-section">`;
        html += `<div class="info-row" style="color:#cc99ff;font-weight:bold;margin-top:6px;">${escapeHtml(t('ui.tile.rituals_title'))}</div>`;
        for (const [key, ritual] of Object.entries(RITUALS)) {
            const readyAt = this.game.ritualCooldowns[key] || 0;
            const onCooldown = this.game.tick < readyAt;
            const canAfford = this.game.resources.has(ritual.cost);
            const costStr = Object.entries(ritual.cost).map(([r, n]) => t('ui.inv.salvage_part', { n, name: resourceName(r) })).join(', ');
            const disabled = onCooldown || !canAfford ? 'disabled' : '';
            let note = '';
            if (onCooldown) {
                const ticksPerSec = (1000 / CONFIG.TICK_RATE) * this.game.speed;
                const remaining = Math.ceil((readyAt - this.game.tick) / ticksPerSec);
                note = `<span style="color:#cc7744;font-size:0.85em">${escapeHtml(t('ui.tile.ritual_recovering', { n: remaining }))}</span>`;
            } else if (!canAfford) {
                note = `<span style="color:#cc7744;font-size:0.85em">${escapeHtml(t('ui.tile.ritual_need', { cost: costStr }))}</span>`;
            }
            html += `<div class="info-row" style="border-top:1px solid #333;padding-top:4px;">`;
            html += `<div style="color:${escapeAttr(ritual.color)};font-weight:bold;">${escapeHtml(ritual.icon)} ${escapeHtml(ritual.name)}</div>`;
            html += `<div style="color:#aaa;font-size:0.85em">${escapeHtml(ritual.description)}</div>`;
            html += `<div style="color:#999;font-size:0.8em">${escapeHtml(t('ui.tile.ritual_cost', { cost: costStr }))}</div>`;
            html += `<div class="info-actions"><button ${disabled} onclick="window.game.triggerRitual(${jsArg(key)})" style="background:#3a2a55;color:#cc99ff;">${escapeHtml(t('ui.tile.ritual_perform'))}</button>${note}</div>`;
            html += `</div>`;
        }
        if (!inner) html += `</div>`;
        return html;
    }

    showTileInfo(tile, x, y) {
        this._switchToInfoTab();
        this._lastTileInfo = { tile, x, y };
        this._viewingColonistId = null;
        this._pendingColonistInfoHtml = null;
        this.setSummaryVisible(true);
        this._viewingRiftGate = this._setRiftPortal(tile, x, y);
        let html = `<div class="info-header">${escapeHtml(t('ui.tile.title', { x, y }))}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.tile.terrain', { name: terrainName(tile.terrain) }))}</div>`;
        if (tile.structure) {
            html += `<div class="info-row" style="color:#ddd;font-weight:bold;">${escapeHtml(buildingName(tile.structure))}</div>`;
            const maxHp = BUILDINGS[tile.structure]?.hp;
            if (maxHp) {
                const currentHp = tile.structureHp !== undefined ? tile.structureHp : maxHp;
                const hpColor = currentHp >= maxHp ? '#88ff88' : currentHp > maxHp * 0.5 ? '#ffcc00' : '#ff4444';
                html += `<div class="info-row" style="color:${hpColor}">${escapeHtml(t('ui.tile.structure_hp', { hp: currentHp, max: maxHp }))}</div>`;
            }
            html += this.getStructureDescription(tile.structure, x, y);
        }
        if (tile.floor) {
            html += `<div class="info-row" style="color:#999">${escapeHtml(t('ui.tile.floor', { name: buildingName(tile.floor) }))}</div>`;
        }
        if (tile.resource) html += `<div class="info-row">${escapeHtml(t('ui.tile.resource', { name: resourceName(tile.resource.type), n: tile.resource.amount }))}</div>`;
        if (tile.zone) {
            const zoneStates = { empty: t('ui.tile.zone_empty'), growing: t('ui.tile.zone_growing'), ready: t('ui.tile.zone_ready') };
            html += `<div class="info-row">${escapeHtml(t('ui.tile.zone', { crop: CROPS[tile.zone.crop]?.name || resourceName(tile.zone.crop), state: zoneStates[tile.zone.state] || tile.zone.state }))}</div>`;
            if (tile.zone.state === 'growing') {
                const cropDef = CROPS[tile.zone.crop];
                if (cropDef) {
                    const pct = Math.min(100, Math.round((tile.zone.growth / cropDef.growthTicks) * 100));
                    html += `<div class="info-row" style="color:#88cc44">${escapeHtml(t('ui.tile.zone_growth', { pct }))}</div>`;
                }
            }
        }
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

        if (tile.structure === 'rift_gate' || tile.structure === 'rift_anchor_active' || tile.structure === 'gathering_circle') {
            html += this._buildRiftGateInfoHtml();
        }
        html += this._buildCryptInfoHtml(tile, x, y);

        if (tile.structure === 'trade_rift') {
            html += this._buildTradeRiftInfoHtml(tile, x, y);
        }

        if (tile.structure === 'golem_forge') {
            html += this._buildGolemForgeHtml();
        }

        if (tile.structure === 'arcane_core') {
            const cs = getComplexStructureAt(this.game, x, y);
            if (cs) {
                html += `<div class="info-row" style="color:#44ff44;font-weight:bold;">${escapeHtml(t('ui.tile.pattern_active'))}</div>`;
                const def = COMPLEX_STRUCTURES[cs.key];
                if (def) html += `<div class="info-row" style="color:#88ff88;">${escapeHtml(def.description)}</div>`;
                if (cs.effect.ritualAltar) { html += this._buildRitualHtml(); this._viewingRitualAltar = true; }
            } else {
                this._viewingRitualAltar = false;
                html += `<div class="info-row" style="color:#ff8844;">${escapeHtml(t('ui.tile.pattern_incomplete'))}</div>`;
            }
        } else {
            this._viewingRitualAltar = false;
        }

        this.elements.infoPanel.innerHTML = html;
    }

    renameAnimalInPanel(animalId) {
        const animal = this.game.entities.find(a => a.id === animalId && a.tamed);
        if (!animal) return;
        const header = this.elements.infoPanel.querySelector(`[data-animal-header="${animalId}"]`);
        if (!header) return;
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        const currentName = animal.name || cap(tamedTypeName(animal.type));
        const color = header.style.color;
        header.innerHTML = `<input id="animal-rename-input-${animalId}" type="text" value="" placeholder="${escapeAttr(currentName)}" maxlength="24" style="background:#222;color:#eee;border:1px solid #666;padding:1px 4px;font-size:0.9em;width:110px;">` +
            `<button onclick="window.game.ui._confirmAnimalRename(${animalId})" style="background:#333;color:#ccc;border:1px solid #555;padding:1px 5px;font-size:0.8em;cursor:pointer;margin-left:4px;">${escapeHtml(t('common.ok'))}</button>` +
            `<button onclick="window.game.ui._cancelAnimalRename(${animalId})" style="background:#333;color:#ccc;border:1px solid #555;padding:1px 5px;font-size:0.8em;cursor:pointer;margin-left:2px;">✕</button>`;
        const input = document.getElementById(`animal-rename-input-${animalId}`);
        if (input) {
            input.focus();
            input.select();
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this._confirmAnimalRename(animalId); }
                else if (e.key === 'Escape') { e.preventDefault(); this._cancelAnimalRename(animalId); }
            });
        }
    }

    _confirmAnimalRename(animalId) {
        const input = document.getElementById(`animal-rename-input-${animalId}`);
        if (input) this.game.renameAnimal(animalId, input.value);
        this._restoreAnimalPanelHeader(animalId);
    }

    _cancelAnimalRename(animalId) {
        this._restoreAnimalPanelHeader(animalId);
    }

    _restoreAnimalPanelHeader(animalId) {
        const animal = this.game.entities.find(a => a.id === animalId && a.tamed);
        const header = this.elements.infoPanel.querySelector(`[data-animal-header="${animalId}"]`);
        if (!animal || !header) return;
        const def = TAMED_ANIMALS[animal.type];
        const color = def?.color || '#ccaa88';
        header.style.color = color;
        const cap = s => escapeHtml(s.charAt(0).toUpperCase() + s.slice(1));
        const headerName = animal.name ? `${escapeHtml(animal.name)} <span style="color:#888;font-size:0.85em;">(${cap(tamedTypeName(animal.type))})</span>` : cap(tamedTypeName(animal.type));
        const petLabel = animal.isPet ? ` <span style="color:#aaddff">${escapeHtml(t('ui.info.pet_tag'))}</span>` : '';
        const renameStyle = 'background:#333;color:#ccc;border:1px solid #555;padding:1px 5px;font-size:0.8em;cursor:pointer;margin-left:6px;vertical-align:middle;';
        header.innerHTML = `${headerName} <span style="color:#888;font-size:0.85em;">${escapeHtml(t('ui.info.tamed_tag'))}</span>${petLabel}<button style="${renameStyle}" onclick="window.game.ui.renameAnimalInPanel(${animalId})">${escapeHtml(t('ui.info.rename'))}</button>`;
    }

    showTileEntities(tile, x, y, colonists, animals, raiders = [], tamedAnimals = [], summons = []) {
        this._switchToInfoTab();
        // Living entities suppress the summary; a tile-only selection keeps it.
        const hasEntities = colonists.length > 0 || animals.length > 0 || raiders.length > 0
            || tamedAnimals.length > 0 || summons.length > 0;
        this.setSummaryVisible(!hasEntities);
        this._viewingRiftGate = this._setRiftPortal(tile, x, y);
        this._viewingColonistId = (colonists.length === 1 && animals.length === 0 && raiders.length === 0 && tamedAnimals.length === 0 && summons.length === 0)
            ? colonists[0].id : null;
        this._pendingColonistInfoHtml = null;
        let html = '';

        for (const r of raiders) {
            const def = ENTITIES[r.type];
            const label = def?.name || (r.char === 'E' ? t('ui.info.void_enemy') : t('ui.info.raider'));
            const color = def?.color || (r.char === 'E' ? '#cc00ff' : '#ff3333');
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${escapeAttr(color)};">${escapeHtml(label)}</div>`;
            html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: r.hp, max: r.maxHp }))}</div>`;
            const rDps = (r.damage / (r.attackCooldown || COLONIST_CONFIG.baseAttackCooldown)).toFixed(1);
            html += `<div class="info-row">${escapeHtml(r.weapon?.name ? t('ui.info.damage_weapon', { weapon: itemName(r.weapon), dmg: r.damage, dps: rDps }) : t('ui.info.damage', { dmg: r.damage, dps: rDps }))}</div>`;
            if (r.damageReduction) html += `<div class="info-row" style="color:#aaddff;">${escapeHtml(t('ui.info.damage_reduction', { pct: Math.round(r.damageReduction * 100) }))}</div>`;
            html += `<div class="info-row">${escapeHtml(r.fleeing ? t('ui.info.raider_fleeing') : t('ui.info.raider_attacking'))}</div>`;
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
            html += `<div class="info-header" style="color:${escapeAttr(color)};">${this._animalDisplayName(a.type)}${a.hostile ? escapeHtml(t('ui.info.hostile_tag')) : ''}</div>`;
            html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: a.hp, max: a.maxHp }))}</div>`;
            if (def?.meatYield) html += `<div class="info-row">${escapeHtml(t('ui.info.animal_meat_yield', { n: def.meatYield }))}</div>`;
            if (def?.hideYield) html += `<div class="info-row">${escapeHtml(t('ui.info.animal_hide_yield', { n: def.hideYield }))}</div>`;
            if (a.hostile && def?.damage) html += `<div class="info-row">${escapeHtml(t('ui.info.animal_damage', { n: def.damage }))}</div>`;
            if (def?.tameable) {
                const tamedDef = TAMED_ANIMALS[a.type];
                if (tamedDef?.produces) html += `<div class="info-row" style="color:#88cc88">${escapeHtml(t('ui.info.animal_produces', { name: resourceName(tamedDef.produces), n: tamedDef.produceRate }))}</div>`;
                if (tamedDef?.packAnimal) html += `<div class="info-row" style="color:#bbaa44">${escapeHtml(t('ui.info.animal_pack', { pct: Math.round(tamedDef.expeditionSpeedBonus * 100) }))}</div>`;
                if (tamedDef?.happinessAura) html += `<div class="info-row" style="color:#ff88cc">${escapeHtml(t('ui.info.animal_happiness_aura', { n: tamedDef.auraRadius }))}</div>`;
            }
            html += `<div class="info-row">${escapeHtml(t('ui.info.animal_speed', { n: def?.speed || a.speed }))}</div>`;
            html += `<div class="info-actions">`;
            html += `<button onclick="window.game.huntAnimal(${a.id})">${escapeHtml(t('ui.info.animal_hunt'))}</button>`;
            if (def?.tameable && this.game.research.isResearched('beast_binding')) {
                const tamedDef = TAMED_ANIMALS[a.type];
                const canAfford = tamedDef && this.game.resources.has({ food: tamedDef.foodToTame });
                if (tamedDef?.dangerousTame) {
                    const bestTamer = this.game.colonists.filter(c => c.hp > 0).sort((a, b) => (b.skills.animals || 0) - (a.skills.animals || 0))[0];
                    const chance = bestTamer ? Math.round(getTameChance(bestTamer, a.type, this.game) * 100) : Math.round((tamedDef.baseTameChance || 0.4) * 100);
                    html += `<button ${canAfford ? '' : 'disabled'} onclick="window.game.tameWildAnimal(${a.id})">${escapeHtml(t('ui.info.tame_chance', { food: tamedDef.foodToTame, pct: chance }))}</button>`;
                    html += `<div class="info-row" style="color:#ff6644;font-size:0.85em">${escapeHtml(t('ui.info.tame_dangerous', { n: tamedDef.retaliationDamage }))}</div>`;
                } else {
                    html += `<button ${canAfford ? '' : 'disabled'} onclick="window.game.tameWildAnimal(${a.id})">${escapeHtml(t('ui.info.tame', { food: tamedDef?.foodToTame || '?' }))}</button>`;
                }
            }
            html += `</div></div>`;
        }

        for (const a of tamedAnimals) {
            const def = TAMED_ANIMALS[a.type];
            const color = def?.color || '#ccaa88';
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            const petLabel = a.isPet ? ` <span style="color:#aaddff">${escapeHtml(t('ui.info.pet_tag'))}</span>` : '';
            const cap = s => escapeHtml(s.charAt(0).toUpperCase() + s.slice(1));
            const headerName = a.name ? `${escapeHtml(a.name)} <span style="color:#888;font-size:0.85em;">(${cap(tamedTypeName(a.type))})</span>` : cap(tamedTypeName(a.type));
            const renameStyle = 'background:#333;color:#ccc;border:1px solid #555;padding:1px 5px;font-size:0.8em;cursor:pointer;margin-left:6px;vertical-align:middle;';
            html += `<div class="info-header" style="color:${escapeAttr(color)};" data-animal-header="${a.id}">${headerName} <span style="color:#888;font-size:0.85em;">${escapeHtml(t('ui.info.tamed_tag'))}</span>${petLabel}<button style="${renameStyle}" onclick="window.game.ui.renameAnimalInPanel(${a.id})">${escapeHtml(t('ui.info.rename'))}</button></div>`;
            html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: a.hp, max: a.maxHp }))}</div>`;
            if (a.level > 0) {
                const lvlTip = escapeAttr(animalLevelTooltip(a.level, a.type)).replace(/\n/g, '&#10;');
                html += `<div class="info-row" style="color:#ffcc44;" title="${lvlTip}">${escapeHtml(t(a.level >= 5 ? 'ui.info.animal_level_max' : 'ui.info.animal_level', { n: a.level }))}</div>`;
            }
            if (a.bondedColonistId) {
                const bonded = this.game.colonists.find(c => c.id === a.bondedColonistId);
                const bondName = bonded ? bonded.name : t('common.unknown');
                const PET_BOND_THRESHOLD = 5;
                const bondDisplay = a.isPet ? t('ui.info.bonded_pet', { name: bondName }) : t('ui.info.bonded_level', { name: bondName, n: a.bondLevel || 0, max: PET_BOND_THRESHOLD });
                html += `<div class="info-row" style="color:#aaddff">${escapeHtml(bondDisplay)}</div>`;
            }
            if (def?.hungerRate) {
                const threshold = def.hungerThreshold || 3;
                const hunger = a.hunger || 0;
                if (hunger >= threshold) {
                    html += `<div class="info-row" style="color:#ff6644">${escapeHtml(t('ui.info.animal_hungry', { n: hunger, max: threshold }))}</div>`;
                } else if (hunger > 0) {
                    html += `<div class="info-row" style="color:#ddaa44">${escapeHtml(t('ui.info.animal_hunger', { n: hunger, max: threshold }))}</div>`;
                }
            }
            if (a.roles && a.roles.length > 0) {
                html += getRoleInfoHtml(a);
            } else {
                if (def?.produces) {
                    html += `<div class="info-row">${escapeHtml(t('ui.info.animal_produces', { name: resourceName(def.produces), n: def.produceRate }))}</div>`;
                    html += `<div class="info-row">${escapeHtml(t('ui.info.animal_next_in', { n: a.produceCooldown }))}</div>`;
                }
                if (def?.guardAnimal) {
                    const stateColor = a.guardState === 'engaging' ? '#ff4444' : a.guardState === 'retreating' ? '#ffaa00' : '#44cc44';
                    const guardState = colonistStateName(a.guardState || 'patrolling');
                    html += `<div class="info-row" style="color:${stateColor}">${escapeHtml(t('ui.info.animal_guard_state', { state: guardState.charAt(0).toUpperCase() + guardState.slice(1) }))}</div>`;
                }
                if (def?.packAnimal) html += `<div class="info-row" style="color:#bbaa44">${escapeHtml(t('ui.info.animal_pack', { pct: Math.round(def.expeditionSpeedBonus * 100) }))}</div>`;
                if (def?.happinessAura) html += `<div class="info-row" style="color:#ff88cc">${escapeHtml(t('ui.info.animal_happiness_aura', { n: def.auraRadius }))}</div>`;
            }
            html += getEffectInfoHtml(a);
            if (a.onExpedition) html += `<div class="info-row" style="color:#33ccff">${escapeHtml(t('ui.info.animal_on_expedition'))}</div>`;
            const isGuardAnimal = a.roles?.some(r => r.type === 'guard') || def?.guardAnimal;
            if (isGuardAnimal && !a.isPet) {
                const aliveColonists = this.game.colonists.filter(c => c.hp > 0);
                if (aliveColonists.length > 0) {
                    const opts = aliveColonists.map(c =>
                        `<option value="${c.id}"${c.id === a.bondedColonistId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
                    ).join('');
                    html += `<div class="info-row" style="margin-top:4px;">`;
                    html += `<label style="color:#aaaaaa;font-size:0.85em;">${escapeHtml(t('ui.info.animal_defends'))} </label>`;
                    html += `<select onchange="window.game.rebondAnimal(${a.id}, parseInt(this.value))" style="background:#222;color:#eee;border:1px solid #555;padding:1px 3px;font-size:0.85em;">${opts}</select>`;
                    html += `</div>`;
                }
            } else if (a.isPet) {
                const aliveColonists = this.game.colonists.filter(c => c.hp > 0);
                if (aliveColonists.length > 0) {
                    const maxPets = this.game.research?.isResearched('pack_binding') ? 2 : 1;
                    const ownerPetCount = a.bondedColonistId
                        ? this.game.entities.filter(e => e.tamed && e.isPet && e.bondedColonistId === a.bondedColonistId).length
                        : 0;
                    const opts = aliveColonists.map(c =>
                        `<option value="${c.id}"${c.id === a.bondedColonistId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
                    ).join('');
                    html += `<div class="info-row" style="margin-top:4px;">`;
                    html += `<label style="color:#aaaaaa;font-size:0.85em;">${escapeHtml(t('ui.info.animal_pet_owner', { n: ownerPetCount, max: maxPets }))} </label>`;
                    html += `<select onchange="window.game.rebondPet(${a.id}, parseInt(this.value))" style="background:#222;color:#eee;border:1px solid #555;padding:1px 3px;font-size:0.85em;">${opts}</select>`;
                    html += `</div>`;
                }
            } else {
                const penPositions = this.game.mapIndex
                    ? [...this.game.mapIndex.getStructurePositions('beast_circle')].map(k => ({ x: k & 0xFFFF, y: k >> 16 }))
                    : [];
                if (penPositions.length > 0) {
                    const penOpts = penPositions.map(p => {
                        const isCurrent = p.x === a.penX && p.y === a.penY;
                        return `<option value="${p.x},${p.y}"${isCurrent ? ' selected' : ''}>${escapeHtml(t('ui.info.animal_pen_option', { x: p.x, y: p.y }))}</option>`;
                    }).join('');
                    html += `<div class="info-row" style="margin-top:4px;">`;
                    html += `<label style="color:#aaaaaa;font-size:0.85em;">${escapeHtml(t('ui.info.animal_pen_label'))} </label>`;
                    html += `<select onchange="const [px,py]=this.value.split(',').map(Number);window.game.directAssignAnimalPen(${a.id},px,py)" style="background:#222;color:#eee;border:1px solid #555;padding:1px 3px;font-size:0.85em;">${penOpts}</select>`;
                    html += `</div>`;
                } else {
                    html += `<button onclick="window.game.reassignAnimalPen(${a.id})">${escapeHtml(t('ui.info.animal_reassign_pen'))}</button>`;
                }
            }
            html += `</div>`;
        }

        for (const s of summons) {
            const def = ENTITIES[s.type];
            const color = def?.color || s.color || '#9966ff';
            const name = def?.name || (s.type ? entityName(s.type) : t('ui.info.summon'));
            html += `<div style="border-bottom:1px solid #444;margin-bottom:6px;padding-bottom:6px;">`;
            html += `<div class="info-header" style="color:${escapeAttr(color)};">${escapeHtml(name)}</div>`;
            html += `<div class="info-row">${escapeHtml(t('ui.colonist.hp', { hp: s.hp, max: s.maxHp }))}</div>`;
            html += `<div class="info-row">${escapeHtml(t('ui.info.damage', { dmg: s.damage, dps: (s.damage / (s.attackCooldown || COLONIST_CONFIG.baseAttackCooldown)).toFixed(1) }))}</div>`;
            if (s.roles && s.roles.length > 0) {
                html += getRoleInfoHtml(s);
            } else {
                const remaining = s.expiresAt ? Math.max(0, s.expiresAt - (this.game.tick || 0)) : '?';
                html += `<div class="info-row" style="color:#9966ff">${escapeHtml(t('ui.info.summon_expires', { n: remaining }))}</div>`;
                html += `<div class="info-row">${escapeHtml(t('ui.colonist.state', { state: colonistStateName(s.guardState || 'idle') }))}</div>`;
            }
            html += `</div>`;
        }

        html += `<div class="info-header" style="font-size:11px;color:#aaa;">${escapeHtml(t('ui.tile.title', { x, y }))}</div>`;
        if (tile.structure) {
            html += `<div class="info-row" style="color:#ddd;font-weight:bold;">${escapeHtml(buildingName(tile.structure))}</div>`;
            const maxHp = BUILDINGS[tile.structure]?.hp;
            if (maxHp) {
                const currentHp = tile.structureHp !== undefined ? tile.structureHp : maxHp;
                const hpColor = currentHp >= maxHp ? '#88ff88' : currentHp > maxHp * 0.5 ? '#ffcc00' : '#ff4444';
                html += `<div class="info-row" style="color:${hpColor}">${escapeHtml(t('ui.tile.structure_hp', { hp: currentHp, max: maxHp }))}</div>`;
            }
            html += this.getStructureDescription(tile.structure, x, y);
            if (tile.structure === 'arcane_core') {
                const cs = getComplexStructureAt(this.game, x, y);
                if (cs) {
                    html += `<div class="info-row" style="color:#44ff44;font-weight:bold;">${escapeHtml(t('ui.tile.pattern_active'))}</div>`;
                    const def = COMPLEX_STRUCTURES[cs.key];
                    if (def) html += `<div class="info-row" style="color:#88ff88;">${escapeHtml(def.description)}</div>`;
                    if (cs.effect.ritualAltar) { html += this._buildRitualHtml(); this._viewingRitualAltar = true; }
                } else {
                    this._viewingRitualAltar = false;
                    html += `<div class="info-row" style="color:#ff8844;">${escapeHtml(t('ui.tile.pattern_incomplete'))}</div>`;
                }
            }
        }
        if (tile.floor) html += `<div class="info-row" style="color:#999">${escapeHtml(t('ui.tile.floor', { name: buildingName(tile.floor) }))}</div>`;
        if (tile.zone) {
            const zoneStates = { empty: t('ui.tile.zone_empty'), growing: t('ui.tile.zone_growing'), ready: t('ui.tile.zone_ready') };
            html += `<div class="info-row">${escapeHtml(t('ui.tile.zone', { crop: CROPS[tile.zone.crop]?.name || resourceName(tile.zone.crop), state: zoneStates[tile.zone.state] || tile.zone.state }))}</div>`;
            if (tile.zone.state === 'growing') {
                const cropDef = CROPS[tile.zone.crop];
                if (cropDef) {
                    const pct = Math.min(100, Math.round((tile.zone.growth / cropDef.growthTicks) * 100));
                    html += `<div class="info-row" style="color:#88cc44">${escapeHtml(t('ui.tile.zone_growth', { pct }))}</div>`;
                }
            }
        }
        if (tile.resource) html += `<div class="info-row">${escapeHtml(t('ui.tile.resource', { name: resourceName(tile.resource.type), n: tile.resource.amount }))}</div>`;
        html += `<div class="info-row">${escapeHtml(t('ui.tile.terrain', { name: terrainName(tile.terrain) }))}</div>`;
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

        if (tile.structure === 'rift_gate' || tile.structure === 'rift_anchor_active' || tile.structure === 'gathering_circle') {
            html += this._buildRiftGateInfoHtml();
        }
        html += this._buildCryptInfoHtml(tile, x, y);

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
        this._pendingColonistInfoHtml = null;
        this.setSummaryVisible(false);
        const draftedCount = colonists.filter(c => c.drafted).length;
        let html = `<div class="info-header">${escapeHtml(t('ui.info.multi_selected', { n: colonists.length }))}</div>`;
        html += `<div class="info-actions" style="margin-bottom:8px;">`;
        html += `<button onclick="window.game.draftAllSelected()">${escapeHtml(t('ui.colonist.draft_all'))}</button>`;
        html += `<button onclick="window.game.undraftAllSelected()">${escapeHtml(t('ui.colonist.undraft_all'))}</button>`;
        html += `</div>`;
        html += `<div class="info-row" style="color:#888">${escapeHtml(t('ui.info.multi_drafted', { n: draftedCount }))}</div>`;

        for (const c of colonists) {
            const moodLevel = getMoodLabel(c.mood);
            html += `<div style="border-top:1px solid #333;margin-top:4px;padding-top:4px;">`;
            html += `<span class="info-header" style="cursor:pointer;color:${escapeAttr(c.nameColor || '#ffff00')}" onclick="window.game.selectColonistById(${c.id})">${escapeHtml(c.name)}</span>`;
            html += ` <span class="mood-${moodLevel}">${c.mood.toFixed(0)}</span>`;
            const tags = (c._relaxActivity ? t('ui.info.multi_tag_relaxing') : '') + (c.drafted ? t('ui.info.multi_tag_drafted') : '')
                + (c.guardMode ? t('ui.info.multi_tag_guard') : '') + (c.golem ? t('ui.info.multi_tag_golem') : '');
            html += ` <span style="color:#888">${escapeHtml(colonistStateName(c.state))}${escapeHtml(tags)}</span>`;
            html += `<div class="info-row">${escapeHtml(t('ui.info.multi_stats', { hp: Math.round(c.hp), hunger: c.needs.hunger.toFixed(0), rest: c.needs.rest.toFixed(0) }))}</div>`;
            html += `<div class="info-actions">`;
            html += `<button onclick="window.game.selectColonistById(${c.id})">${escapeHtml(t('ui.info.multi_focus'))}</button>`;
            html += `<button onclick="window.game.toggleDraft(${c.id})">${escapeHtml(c.drafted ? t('ui.main.undraft') : t('ui.main.draft'))}</button>`;
            html += `<button onclick="window.game.toggleGuard(${c.id})">${escapeHtml(c.guardMode ? t('ui.colonist.unguard') : t('ui.colonist.guard'))}</button>`;
            if (c.guardMode) html += `<button onclick="window.game.input.startGuardPointTargeting(${c.id})">${escapeHtml(t('ui.colonist.set_guard_point'))}</button>`;
            html += `</div></div>`;
        }

        this.elements.infoPanel.innerHTML = html;
    }

    _updateOverlay() {
        const anyOpen = this.priorityPanelVisible || this.craftPanelVisible ||
            this.researchPanelVisible || this.inventoryVisible ||
            this.settingsPanelVisible || this.saveSlotPanelVisible ||
            this.arcanePanelVisible || this.storyPanelVisible || this.mapPanelVisible;
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
            // A pending key-rebind must not outlive the panel.
            cancelRebindCapture();
        }
        if (this.arcanePanelVisible) {
            this.arcanePanelVisible = false;
            this.elements.arcanePanel.style.display = 'none';
        }
        if (this.storyPanelVisible) {
            this.storyPanelVisible = false;
            this.elements.storyPanel.style.display = 'none';
        }
        if (this.mapPanelVisible) {
            this.mapPanelVisible = false;
            this.elements.mapPanel.style.display = 'none';
        }
        if (this.saveSlotPanelVisible) {
            this.saveSlotPanelVisible = false;
            this.elements.saveSlotPanel.style.display = 'none';
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
            // Only restore when a pausing panel actually started a session, so a
            // non-pausing panel (Arcane) can call this safely to end one.
            if (!this._panelSessionActive) return;
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
        const underAttuned = this.game.colonists.filter(c => {
            if (c.hp <= 0 || c.golem) return false;
            const hasMagic = c.magicSkills && Object.values(c.magicSkills).some(v => v > 0);
            if (!hasMagic) return false;
            const attuned = Array.isArray(c.attunedSchools) ? c.attunedSchools : [];
            return attuned.length < MAGIC_STUDY_CONFIG.attunementSlots;
        }).length;
        const attuneBadge = underAttuned > 0 ? ` <span style="color:#ff8844;font-size:0.85em">(${underAttuned})</span>` : '';
        const tabs =
            '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
            `<button class="craft-tab${this._prioTab === 'work' ? ' active' : ''}" data-prio-tab="work">${escapeHtml(t('ui.panel.prio_tab_work'))}</button>` +
            `<button class="craft-tab${this._prioTab === 'attune' ? ' active' : ''}" data-prio-tab="attune">${escapeHtml(t('ui.panel.prio_tab_attune'))}${attuneBadge}</button>` +
            `<button class="craft-tab${this._prioTab === 'groups' ? ' active' : ''}" data-prio-tab="groups">${escapeHtml(t('ui.panel.prio_tab_groups'))}</button>` +
            '</div>';

        const body = this._prioTab === 'attune' ? this._attunementGridHtml() : this._prioTab === 'groups' ? this._colonistGroupsHtml() : this._workPriorityGridHtml();
        const heading = this._prioTab === 'attune'
            ? `<h3>${escapeHtml(MAGIC_STUDY_CONFIG.attunementSlots === 1 ? t('ui.panel.attune_heading_one') : t('ui.panel.attune_heading_many', { n: MAGIC_STUDY_CONFIG.attunementSlots }))}</h3><div style="color: #888; font-size: 0.9em; margin-bottom: 8px;">${escapeHtml(t('ui.panel.attune_note'))}</div>`
            : this._prioTab === 'groups' ? ''
            : `<h3>${escapeHtml(t(isTouchUI() ? 'ui.panel.prio_heading_touch' : 'ui.panel.prio_heading'))}</h3><div style="color: #888; font-size: 0.9em; margin-bottom: 8px;">${escapeHtml(t('ui.panel.prio_note'))}</div>`;
        let profileToolbar = '';
        if (this._prioTab === 'work') {
            const customProfiles = this.game.priorityProfiles || {};
            // Every custom profile, whatever it was renamed to (not just "Custom N").
            const allProfileNames = [
                ...Object.keys(PRIORITY_PROFILES),
                ...Object.keys(customProfiles).filter(k => !PRIORITY_PROFILES[k]),
            ];
            const selectedName = this._prioSelectedProfile || '';
            const profileOptions = allProfileNames
                .map(name => `<option value="${escapeAttr(name)}"${name === selectedName ? ' selected' : ''}>${escapeHtml(PRIORITY_PROFILES[name] ? priorityProfileName(name) : name)}</option>`)
                .join('');

            // Load draft from selected profile if selection changed or draft missing.
            if (selectedName) {
                const source = PRIORITY_PROFILES[selectedName] || customProfiles[selectedName] || {};
                if (!this._prioProfileDraft || this._prioProfileDraftSource !== selectedName) {
                    this._prioProfileDraft = { ...source };
                    this._prioProfileDraftSource = selectedName;
                }
            } else {
                this._prioProfileDraft = null;
                this._prioProfileDraftSource = null;
            }

            const skills = Object.keys(SKILLS);
            const isBuiltIn = selectedName && !!PRIORITY_PROFILES[selectedName];

            // Profile value row.
            let profileValueRow = '';
            if (this._prioProfileDraft) {
                const hint = isBuiltIn
                    ? `<span style="color:#666;font-size:10px;">${escapeHtml(t('ui.panel.profile_builtin'))}</span>`
                    : `<span style="color:#666;font-size:10px;">${escapeHtml(t(isTouchUI() ? 'ui.panel.profile_hint_touch' : 'ui.panel.profile_hint'))}</span>`;
                const cells = skills.map(s => {
                    const v = this._prioProfileDraft[s] ?? 0;
                    const display = v === 0 ? '-' : v;
                    const style = isBuiltIn
                        ? 'background:#1a1a1a;color:#888;padding:2px 6px;border-radius:2px;font-size:12px;'
                        : 'background:#2a2a2a;color:#ccc;padding:2px 6px;border-radius:2px;font-size:12px;cursor:pointer;border:1px solid #444;';
                    const attr = isBuiltIn ? '' : `data-profile-skill="${s}"`;
                    return `<td ${attr} style="${style}">${display}</td>`;
                }).join('');
                const nameInput = isBuiltIn ? '' :
                    `<input id="prio-profile-name" value="${escapeAttr(selectedName)}" maxlength="20" style="background:#222;color:#ccc;border:1px solid #444;border-radius:3px;padding:2px 6px;font-size:12px;width:110px;" />`;
                const saveBtn = isBuiltIn ? '' :
                    `<button onclick="window.game.ui._saveProfileDraft()" style="background:#2a3a2a;color:#88dd88;border:1px solid #4a6a4a;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:12px;">${escapeHtml(t('ui.panel.profile_save'))}</button>`;
                profileValueRow =
                    `<div style="margin-bottom:6px;">${hint}</div>` +
                    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">` +
                    `<table style="border-collapse:collapse;"><tr><td style="font-size:11px;color:#888;padding-right:6px;">${escapeHtml(t('ui.panel.profile_values'))}</td>${cells}</tr></table>` +
                    `${nameInput}${saveBtn}` +
                    `</div>`;
            }

            profileToolbar =
                `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">` +
                `<select id="prio-profile-select" onchange="window.game.ui._onProfileSelectChange(this.value)" style="background:#222;color:#ccc;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:12px;">` +
                `<option value="">${escapeHtml(t('ui.panel.profile_select'))}</option>${profileOptions}</select>` +
                `<button onclick="window.game.ui._applyProfileToAll()" style="background:#2a2a4e;color:#88aaff;border:1px solid #445;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:12px;">${escapeHtml(t('ui.panel.profile_apply_all'))}</button>` +
                `<button onclick="window.game.ui._newCustomProfile()" style="background:#2a3a2a;color:#88dd88;border:1px solid #4a6a4a;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:12px;">${escapeHtml(t('ui.panel.profile_new'))}</button>` +
                `</div>` +
                profileValueRow;
        }
        const fullHtml = '<div class="panel-close" data-panel-close="priority">&times;</div>' + tabs + heading + profileToolbar + body;
        if (fullHtml !== this._lastPrioHtml) {
            this._lastPrioHtml = fullHtml;
            // The grid scrolls sideways on narrow screens. Keep its place across re-renders.
            const scrollLeft = this.elements.priorityPanel.querySelector('.prio-grid')?.scrollLeft ?? 0;
            this.elements.priorityPanel.innerHTML = fullHtml;
            const grid = this.elements.priorityPanel.querySelector('.prio-grid');
            if (grid) grid.scrollLeft = scrollLeft;
        }
    }

    _onProfileSelectChange(value) {
        this._prioSelectedProfile = value;
        this._prioProfileDraft = null;
        this._prioProfileDraftSource = null;
        this._lastPrioHtml = null;
        this.updatePriorityPanel();
    }

    _applyProfileToAll() {
        if (!this._prioProfileDraft) return;
        for (const c of this.game.colonists) {
            if (c.hp > 0 && !c.golem) {
                for (const skill of Object.keys(SKILLS)) {
                    if (this._prioProfileDraft[skill] !== undefined) c.priorities[skill] = this._prioProfileDraft[skill];
                }
            }
        }
        this._lastPrioHtml = null;
        this.updatePriorityPanel();
    }

    _applyProfileToColonist(colonistId) {
        if (!this._prioProfileDraft) return;
        const c = this.game.getColonist(colonistId);
        if (!c || c.golem) return;
        for (const skill of Object.keys(SKILLS)) {
            if (this._prioProfileDraft[skill] !== undefined) c.priorities[skill] = this._prioProfileDraft[skill];
        }
        this._lastPrioHtml = null;
        this.updatePriorityPanel();
    }

    _newCustomProfile() {
        // First free "Custom N", so a new profile never overwrites an existing one.
        const existing = this.game.priorityProfiles || {};
        let n = 1;
        while (existing[`Custom ${n}`] || PRIORITY_PROFILES[`Custom ${n}`]) n++;
        const name = `Custom ${n}`;
        if (!this.game.settings.priorityProfiles) this.game.settings.priorityProfiles = {};
        this.game.settings.priorityProfiles[name] = { building: 3, farming: 3, crafting: 3, cooking: 3, animals: 3, research: 3 };
        // Profiles are a global preference; persist now so a reload keeps them.
        this.game.saveSettingsToStorage();
        this._prioSelectedProfile = name;
        this._prioProfileDraft = null;
        this._prioProfileDraftSource = null;
        this._lastPrioHtml = null;
        this.updatePriorityPanel();
    }

    _saveProfileDraft() {
        if (!this._prioProfileDraft || !this._prioProfileDraftSource) return;
        const nameInput = document.getElementById('prio-profile-name');
        const newName = nameInput ? nameInput.value.trim() : this._prioProfileDraftSource;
        if (!newName) return;
        if (!this.game.settings.priorityProfiles) this.game.settings.priorityProfiles = {};
        // Renaming onto a built-in or another custom profile would shadow or
        // overwrite it; refuse instead.
        if (newName !== this._prioProfileDraftSource
            && (PRIORITY_PROFILES[newName] || this.game.settings.priorityProfiles[newName])) {
            this.game.notifications.push({ text: t('ui.panel.profile_exists', { name: newName }), tick: this.game.tick, type: 'danger' });
            return;
        }
        if (newName !== this._prioProfileDraftSource) {
            delete this.game.settings.priorityProfiles[this._prioProfileDraftSource];
        }
        this.game.settings.priorityProfiles[newName] = { ...this._prioProfileDraft };
        this.game.saveSettingsToStorage();
        this._prioSelectedProfile = newName;
        this._prioProfileDraftSource = newName;
        this._lastPrioHtml = null;
        this.updatePriorityPanel();
    }

    _colonistGroupsHtml() {
        const groups = this.game.colonistGroups || [];
        const colonists = this.game.colonists.filter(c => !c.golem && c.hp > 0);
        let html = `<h3>${escapeHtml(t('ui.panel.groups_title'))}</h3>`;
        html += `<div style="color:#888;font-size:0.9em;margin-bottom:10px;">${escapeHtml(t('ui.panel.groups_note'))}</div>`;

        if (groups.length === 0) {
            html += `<div style="color:#666;font-style:italic;margin-bottom:10px;">${escapeHtml(t('ui.panel.groups_none'))}</div>`;
        } else {
            html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">';
            html += `<tr><th style="text-align:left;color:#888;font-size:0.8em;padding-bottom:4px;">${escapeHtml(t('ui.panel.groups_col_group'))}</th><th style="text-align:left;color:#888;font-size:0.8em;padding-bottom:4px;">${escapeHtml(t('ui.panel.groups_col_members'))}</th><th></th></tr>`;
            for (const g of groups) {
                const members = colonists.filter(c => c.group === g);
                const memberNames = members.length > 0 ? members.map(c => `<span style="color:${escapeAttr(c.nameColor || '#ffcc00')}">${escapeHtml(c.name)}</span>`).join(', ') : '<span style="color:#555">—</span>';
                html += `<tr>`;
                html += `<td style="padding:4px 8px 4px 0;font-weight:bold;color:#ffcc44;white-space:nowrap;">${escapeHtml(g)}</td>`;
                html += `<td style="padding:4px 8px;font-size:0.88em;line-height:1.5;">${memberNames}</td>`;
                html += `<td style="padding:4px 0;white-space:nowrap;">`;
                html += `<button data-delete-group="${escapeAttr(g)}" style="background:none;border:1px solid #552222;color:#cc4444;border-radius:3px;padding:1px 7px;cursor:pointer;font-size:0.85em;" title="${escapeAttr(t('ui.panel.groups_delete_tip'))}">${escapeHtml(t('ui.panel.groups_delete'))}</button>`;
                html += `</td>`;
                html += `</tr>`;
            }
            html += '</table>';
        }

        html += '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">';
        html += `<input data-add-group-input type="text" placeholder="${escapeAttr(t('ui.panel.groups_new_placeholder'))}" maxlength="32" style="background:#222;color:#eee;border:1px solid #555;border-radius:3px;padding:3px 6px;font-size:0.9em;flex:1;">`;
        html += `<button data-add-group-confirm style="background:#2a3a2a;color:#88dd88;border:1px solid #4a6a4a;border-radius:3px;padding:3px 10px;cursor:pointer;font-size:0.9em;">${escapeHtml(t('ui.panel.groups_add'))}</button>`;
        html += '</div>';
        return html;
    }

    _workPriorityGridHtml() {
        const skills = Object.keys(SKILLS);
        let html = `<table class="prio-grid"><tr><th>${escapeHtml(t('ui.panel.prio_col_colonist'))}</th>`;
        skills.forEach(s => { html += `<th>${escapeHtml((SKILLS[s].name || s).substring(0, 8))}</th>`; });
        html += '<th></th></tr>';

        for (const c of this.game.colonists) {
            if (c.hp <= 0) continue;
            html += `<tr><td style="color:${escapeAttr(c.nameColor || '#ffff00')}">${escapeHtml(c.name)}</td>`;
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
            if (!c.golem) {
                html += `<td><button onclick="window.game.ui._applyProfileToColonist(${c.id})" style="background:#2a2a4e;color:#88aaff;border:1px solid #445;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:11px;">${escapeHtml(t('ui.panel.profile_apply'))}</button></td>`;
            } else {
                html += '<td></td>';
            }
            html += '</tr>';
        }
        html += '</table>';
        return html;
    }

    _attunementGridHtml() {
        const schools = Object.keys(MAGIC_SKILLS);
        let html = `<table class="prio-grid"><tr><th>${escapeHtml(t('ui.panel.prio_col_colonist'))}</th>`;
        schools.forEach(s => { html += `<th><span class="skill-tip" data-tip="${escapeAttr(MAGIC_SKILLS[s].summary || MAGIC_SKILLS[s].description)}" style="color:${MAGIC_SKILLS[s].color}">${escapeHtml(MAGIC_SKILLS[s].name.substring(0, 8))}</span></th>`; });
        html += '</tr>';

        for (const c of this.game.colonists) {
            if (c.hp <= 0 || c.golem) continue;
            const attuned = Array.isArray(c.attunedSchools) ? c.attunedSchools : [];
            const hasMagic = c.magicSkills && Object.values(c.magicSkills).some(v => v > 0);
            const isUnderAttuned = hasMagic && attuned.length < MAGIC_STUDY_CONFIG.attunementSlots;
            const nameCellStyle = isUnderAttuned
                ? `color:${escapeAttr(c.nameColor || '#ffff00')};background:#2a1a00;`
                : `color:${escapeAttr(c.nameColor || '#ffff00')}`;
            const nameLabel = isUnderAttuned ? `${escapeHtml(c.name)} <span style="color:#ff8844;font-size:0.85em" title="${escapeAttr(t('ui.panel.attune_missing_tip'))}">⚠</span>` : escapeHtml(c.name);
            html += `<tr><td style="${nameCellStyle}">${nameLabel}</td>`;
            for (const s of schools) {
                const level = (c.magicSkills && c.magicSkills[s]) || 0;
                const isAttuned = attuned.includes(s);
                const schoolColor = MAGIC_SKILLS[s].color;
                const cellStyle = isAttuned
                    ? `background-color:${schoolColor};color:#000;font-weight:bold;text-shadow:none;`
                    : 'background-color:#1a1a2e;color:#666;';
                const mark = isAttuned ? '★' : (level > 0 ? level : '-');
                html += `<td class="prio-cell" data-colonist-id="${c.id}" data-attune="${s}" title="${escapeAttr(t('ui.panel.attune_cell_tip', { name: MAGIC_SKILLS[s].name, n: level }))}" style="${cellStyle}">${mark}</td>`;
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
        let html = `<div class="panel-close" data-panel-close="craft">&times;</div><h3>${escapeHtml(t('ui.craft.title'))}</h3>`;
        html += '<div class="craft-tabs">';
        for (const cat of RECIPE_CATEGORIES) {
            const active = cat === this._craftTab ? ' active' : '';
            html += `<button class="craft-tab${active}" data-craft-tab="${escapeAttr(cat)}">${escapeHtml(recipeCategoryName(cat))}</button>`;
        }
        html += '</div>';
        const hasEquipTiers = ['Weapons', 'Armor', 'Clothing', 'Tools', 'Trinkets'].includes(this._craftTab);
        const hasTomeFilter = this._craftTab === 'Tomes';
        const hasWeaponFilter = this._craftTab === 'Weapons';
        const hasArmorFilter = this._craftTab === 'Armor';
        function getArmorCategories(def) {
            const cats = new Set();
            if (!def) return cats;
            if (def.spellDamageBonus || def.manaRegen) cats.add('mage');
            if (def.critChance || def.dodgeChance) cats.add('rogue');
            if (def.workSpeedBonus || def.skillGrowthBonus || def.moodBonus || def.coldResistance) cats.add('support');
            if (cats.size === 0) cats.add('tank');
            if (def.damageReduction >= 0.20 || def.healthRegen || def.targetPriority || def.thornsDamage) cats.add('tank');
            return cats;
        }
        function getWeaponCategories(def) {
            const cats = new Set();
            if (!def) return cats;
            const hasRangedProjectile = def.ranged && def.skinKey !== 'projectile_spell';
            if (hasRangedProjectile) cats.add('ranged');
            if (def.spellDamageBonus || def.evocationBonus || def.conjurationBonus ||
                def.abjurationBonus || def.transmutationBonus || def.divinationBonus) cats.add('magic');
            if (!def.ranged) cats.add('melee');
            return cats;
        }
        if (hasEquipTiers) {
            if (this._craftHiddenTiers === undefined) this._craftHiddenTiers = new Set();
            const tiers = [1, 2, 3, 4];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;flex-wrap:wrap;">';
            html += `<span style="color:#888;font-size:0.82em;">${escapeHtml(t('ui.craft.show_tiers'))}</span>`;
            for (const tier of tiers) {
                const hidden = this._craftHiddenTiers.has(tier);
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-tier="${tier}" style="padding:1px 6px;font-size:0.82em;background:${hidden ? '#1a1a2e' : '#336633'};color:${hidden ? '#666' : '#ccc'};border:1px solid ${hidden ? '#444' : '#4a4'};border-radius:3px;cursor:pointer;">${escapeHtml(t('ui.craft.tier_label', { n: tier }))}</button>`;
            }
            html += '</div>';
        }
        if (hasWeaponFilter) {
            if (this._weaponHiddenTypes === undefined) this._weaponHiddenTypes = new Set();
            const weaponTypes = [
                { key: 'melee',  label: t('ui.craft.weapon_melee'),  color: '#c8a04a' },
                { key: 'ranged', label: t('ui.craft.weapon_ranged'), color: '#4ac8a0' },
                { key: 'magic',  label: t('ui.craft.weapon_magic'),  color: '#a04ac8' },
            ];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += `<span style="color:#888;font-size:0.82em;">${escapeHtml(t('ui.craft.filter_type'))}</span>`;
            for (const { key, label, color } of weaponTypes) {
                const hidden = this._weaponHiddenTypes.has(key);
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-weapon-type="${key}" style="padding:1px 6px;font-size:0.82em;background:#1a1a2e;color:${hidden ? '#555' : color};border:1px solid ${hidden ? '#444' : color};border-radius:3px;cursor:pointer;">${escapeHtml(label)}</button>`;
            }
            html += '</div>';
        }
        if (hasArmorFilter) {
            if (this._armorHiddenTypes === undefined) this._armorHiddenTypes = new Set();
            const armorTypes = [
                { key: 'tank',    label: t('ui.craft.armor_tank'),    color: '#c8a04a' },
                { key: 'mage',    label: t('ui.craft.armor_mage'),    color: '#a04ac8' },
                { key: 'rogue',   label: t('ui.craft.armor_rogue'),   color: '#4ac8a0' },
                { key: 'support', label: t('ui.craft.armor_support'), color: '#c84a4a' },
            ];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += `<span style="color:#888;font-size:0.82em;">${escapeHtml(t('ui.craft.filter_type'))}</span>`;
            for (const { key, label, color } of armorTypes) {
                const hidden = this._armorHiddenTypes.has(key);
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-armor-type="${key}" style="padding:1px 6px;font-size:0.82em;background:#1a1a2e;color:${hidden ? '#555' : color};border:1px solid ${hidden ? '#444' : color};border-radius:3px;cursor:pointer;">${escapeHtml(label)}</button>`;
            }
            html += '</div>';
        }
        if (hasTomeFilter) {
            if (this._tomeHiddenLevels === undefined) this._tomeHiddenLevels = new Set();
            if (this._tomeHiddenSchools === undefined) this._tomeHiddenSchools = new Set();
            const levels = [0, 1, 2, 3, 4];
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += `<span style="color:#888;font-size:0.82em;">${escapeHtml(t('ui.craft.filter_schools'))}</span>`;
            for (const [sk, sd] of Object.entries(MAGIC_SKILLS)) {
                const hidden = this._tomeHiddenSchools.has(sk);
                const col = hidden ? '#444' : sd.color;
                html += `<button class="craft-tier-btn${hidden ? '' : ' active'}" data-craft-tome-school="${sk}" style="padding:1px 6px;font-size:0.82em;background:${hidden ? '#1a1a2e' : '#1a1a2e'};color:${hidden ? '#555' : sd.color};border:1px solid ${col};border-radius:3px;cursor:pointer;">${escapeHtml(sd.name)}</button>`;
            }
            html += '</div>';
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #333;flex-wrap:wrap;">';
            html += `<span style="color:#888;font-size:0.82em;">${escapeHtml(t('ui.craft.filter_min_level'))}</span>`;
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
                const def = WEAPONS[outputKey] || ARMORS[outputKey] || HELMETS[outputKey] || CLOTHES[outputKey] || BOOTS[outputKey] || TOOLS[outputKey] || TRINKETS[outputKey];
                if (!def || def.tier === undefined) return true;
                return !this._craftHiddenTiers.has(def.tier);
            });
        }
        if (hasWeaponFilter && this._weaponHiddenTypes && this._weaponHiddenTypes.size > 0) {
            filtered = filtered.filter(r => {
                const outputKey = Object.keys(r.recipe.output)[0];
                const def = WEAPONS[outputKey];
                if (!def) return true;
                const cats = getWeaponCategories(def);
                return [...cats].some(c => !this._weaponHiddenTypes.has(c));
            });
        }
        if (hasArmorFilter && this._armorHiddenTypes && this._armorHiddenTypes.size > 0) {
            filtered = filtered.filter(r => {
                const outputKey = Object.keys(r.recipe.output)[0];
                const def = ARMORS[outputKey] || HELMETS[outputKey] || BOOTS[outputKey];
                if (!def) return true;
                const cats = getArmorCategories(def);
                return [...cats].some(c => !this._armorHiddenTypes.has(c));
            });
        }
        if (hasTomeFilter) {
            if (this._tomeHiddenSchools && this._tomeHiddenSchools.size > 0) {
                filtered = filtered.filter(r => {
                    const outputKey = Object.keys(r.recipe.output)[0];
                    const tome = SPELL_TOMES[outputKey];
                    if (!tome) return true;
                    const spell = SPELLS[tome.spell];
                    return !spell || !this._tomeHiddenSchools.has(spell.school);
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
            const schoolOrder = Object.keys(MAGIC_SKILLS);
            filtered.sort((a, b) => {
                const aKey = Object.keys(a.recipe.output)[0];
                const bKey = Object.keys(b.recipe.output)[0];
                const aTome = SPELL_TOMES[aKey];
                const bTome = SPELL_TOMES[bKey];
                const aSchool = SPELLS[aTome?.spell]?.school;
                const bSchool = SPELLS[bTome?.spell]?.school;
                const schoolDiff = (schoolOrder.indexOf(aSchool) ?? 999) - (schoolOrder.indexOf(bSchool) ?? 999);
                if (schoolDiff !== 0) return schoolDiff;
                return (aTome?.minSchoolLevel ?? 0) - (bTome?.minSchoolLevel ?? 0);
            });
        }
        if (hasEquipTiers) {
            filtered.sort((a, b) => {
                const aKey = Object.keys(a.recipe.output)[0];
                const bKey = Object.keys(b.recipe.output)[0];
                const aDef = WEAPONS[aKey] || ARMORS[aKey] || HELMETS[aKey] || CLOTHES[aKey] || BOOTS[aKey] || TOOLS[aKey] || TRINKETS[aKey];
                const bDef = WEAPONS[bKey] || ARMORS[bKey] || HELMETS[bKey] || CLOTHES[bKey] || BOOTS[bKey] || TOOLS[bKey] || TRINKETS[bKey];
                // Tier is the primary grouping; `order` arranges set pieces within
                // a tier (e.g. a helmet next to its matching body armor). Items
                // without `order` sort last within their tier but keep insertion
                // order among themselves (Array.sort is stable).
                const tierDiff = (aDef?.tier || 0) - (bDef?.tier || 0);
                if (tierDiff !== 0) return tierDiff;
                return (aDef?.order ?? Infinity) - (bDef?.order ?? Infinity);
            });
        }
        const EQUIP_TIER_NAMES = ['', t('ui.craft.tier_primitive'), t('ui.craft.tier_iron'), t('ui.craft.tier_runic'), t('ui.craft.tier_void')];
        const carpentry = t('ui.craft.group_carpentry'), textiles = t('ui.craft.group_textiles'), smithing = t('ui.craft.group_smithing');
        const MATERIALS_GROUPS = {
            craft_planks: carpentry, craft_bricks: carpentry,
            tan_leather: textiles, weave_cloth: textiles,
            smelt_iron: smithing, smelt_runite: smithing, repair_trinket: smithing,
        };
        let lastTier = null;
        let lastMaterialsGroup = null;
        let lastTomeSchool = null;
        for (const { key, recipe, canCraft, hasStation } of filtered) {
            if (hasEquipTiers) {
                const outputKey = Object.keys(recipe.output)[0];
                const def = WEAPONS[outputKey] || ARMORS[outputKey] || HELMETS[outputKey] || CLOTHES[outputKey] || BOOTS[outputKey] || TOOLS[outputKey] || TRINKETS[outputKey];
                const tier = def?.tier;
                if (tier !== undefined && tier !== lastTier) {
                    const label = EQUIP_TIER_NAMES[tier] || t('ui.craft.tier_n', { n: tier });
                    html += `<div style="padding:3px 8px;margin-top:4px;font-size:0.8em;color:#888;border-top:1px solid #333;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t('ui.craft.tier_header', { n: tier, name: label }))}</div>`;
                    lastTier = tier;
                }
            }
            if (hasTomeFilter) {
                const outputKey = Object.keys(recipe.output)[0];
                const tome = SPELL_TOMES[outputKey];
                const school = tome ? SPELLS[tome.spell]?.school : null;
                if (school && school !== lastTomeSchool) {
                    const schoolDef = MAGIC_SKILLS[school];
                    const color = schoolDef?.color || '#aaa';
                    html += `<div style="padding:3px 8px;margin-top:4px;font-size:0.8em;border-top:1px solid #333;letter-spacing:0.08em;text-transform:uppercase;color:${color};">${escapeHtml(schoolDef?.name || school)}</div>`;
                    lastTomeSchool = school;
                }
            }
            if (this._craftTab === 'Materials') {
                const group = MATERIALS_GROUPS[key];
                if (group && group !== lastMaterialsGroup) {
                    html += `<div style="padding:3px 8px;margin-top:4px;font-size:0.8em;color:#888;border-top:1px solid #333;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(group)}</div>`;
                    lastMaterialsGroup = group;
                }
            }
            const inputStr = Object.entries(recipe.input).map(([k, v]) => {
                if (k === 'foodstuffs') return escapeHtml(t('ui.craft.input_foodstuffs', { n: v, have: this.game.resources.getFoodstuffTotal() }));
                return escapeHtml(t('ui.craft.amount', { name: resourceName(k), n: v }));
            }).join(' + ');
            const outputStr = Object.entries(recipe.output).map(([k, v]) => {
                const tip = this.getCraftOutputTip(k);
                if (tip) return `${this._itemIcon(k)}<span class="skill-tip" data-tip="${escapeAttr(tip)}">${escapeHtml(v > 1 ? t('ui.craft.amount', { name: resourceName(k), n: v }) : resourceName(k))}</span>`;
                return escapeHtml(t('ui.craft.amount', { name: resourceName(k), n: v }));
            }).join('+');
            const cls = canCraft ? 'craft-available' : 'craft-unavailable';
            const ct = this.game.settings.craftTargets[key] || {};
            const repeatCls = ct.repeat ? 'craft-repeat active' : 'craft-repeat';
            html += `<div class="craft-row ${cls}">`;
            html += `<button ${canCraft ? '' : 'disabled'} data-craft-recipe="${escapeAttr(key)}" onclick="window.game.craft(${jsArg(key)})">${escapeHtml(recipeLabel(key, recipe))}</button>`;
            html += `<button ${canCraft ? '' : 'disabled'} onclick="window.game.craftMultiple(${jsArg(key)},5)" class="craft-multi">x5</button>`;
            html += `<button onclick="window.game.toggleCraftRepeat(${jsArg(key)})" class="craft-multi ${repeatCls}" title="${escapeAttr(t('ui.craft.auto_repeat'))}">&#x27F3;</button>`;
            html += `<input type="number" min="0" max="999" value="${parseInt(ct.target) || 0}" onchange="window.game.setCraftTarget(${jsArg(key)},this.value)" title="${escapeAttr(t('ui.craft.stock_target_tip'))}" style="width:35px;background:#1a1a2e;color:#ccc;border:1px solid #444;border-radius:3px;padding:1px 2px;text-align:center;font-size:0.85em;">`;
            html += `<span>${inputStr} → ${outputStr}</span>`;
            if (!hasStation) {
                const stationName = buildingName(recipe.station || 'workbench');
                html += `<span style="color:#ff4444;font-size:0.85em;margin-left:auto;">${escapeHtml(t('ui.craft.needs_station', { name: stationName }))}</span>`;
            }
            html += `</div>`;
        }
        if (filtered.length === 0) {
            html += `<div style="color:#666; padding:8px;">${escapeHtml(t('ui.craft.no_recipes'))}</div>`;
        }
        if (this._craftTab === 'Food & Potions') {
            const target = this.game.settings.autoCookTarget || 0;
            html += '<div style="margin-top:12px; padding-top:8px; border-top:1px solid #444;">';
            html += `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">`;
            html += `<label style="color:#ccc; white-space:nowrap;">${escapeHtml(t('ui.craft.autocook_label'))}</label>`;
            html += `<div style="display:flex; align-items:center; gap:2px;">`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-10)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">-10</button>`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-1)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">-1</button>`;
            html += `<input type="number" id="set-autocook" min="0" max="200" value="${target}" onchange="window.game.setAutoCookTarget(parseInt(this.value)||0)" style="width:45px;text-align:center;background:#1a1a2e;color:#88cc88;border:1px solid #555;border-radius:3px;padding:2px;font-weight:bold;">`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+1)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">+1</button>`;
            html += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+10)" style="padding:2px 6px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;">+10</button>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div style="color:#777; font-size:0.83em; margin-top:4px;">${escapeHtml(t('ui.craft.autocook_note'))}</div>`;
            html += '</div>';
        }
        const inputFocused = this.elements.craftPanel.contains(document.activeElement) &&
            document.activeElement.tagName === 'INPUT';
        if (!inputFocused && html !== this._lastCraftHtml) {
            this._lastCraftHtml = html;
            this.elements.craftPanel.innerHTML = html;
            const newTabsContainer = this.elements.craftPanel.querySelector('.craft-tabs');
            if (newTabsContainer) {
                newTabsContainer.scrollLeft = craftTabsScroll;
            }
        }
    }

    _moodSparklineSvg(colonist) {
        const history = colonist.moodHistory;
        if (!history || history.length < 3) return '';
        const W = 32, H = 6;
        const pts = history.slice(-32);
        const min = 0, max = 100;
        const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
        const ys = pts.map(v => H - ((v - min) / (max - min)) * H);
        const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
        const last8 = pts.slice(-8);
        const trending = last8.length >= 2 ? last8[last8.length - 1] - last8[0] : 0;
        const strokeColor = trending <= -8 ? '#ff8844' : '#888';
        return `<svg width="${W}" height="${H}" style="vertical-align:middle;margin-left:3px;overflow:visible;" xmlns="http://www.w3.org/2000/svg"><polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="1.2"/></svg>`;
    }

    _hudColonistRow(c) {
        const draggable = this._colonistHudLocked ? '' : ' draggable="true"';
        const dragId = this._colonistHudLocked ? '' : ` data-drag-colonist-id="${c.id}"`;
        if (c.hp <= 0) {
            return `<div class="hud-colonist dead"><span class="hud-name" style="color:${escapeAttr(c.nameColor || '#ffff00')}">${escapeHtml(c.name)}</span> <span style="color:#cc4444">${escapeHtml(t('ui.colonist.hud_dead'))}</span></div>`;
        }
        if (c.onExpedition) {
            return `<div class="hud-colonist"${draggable} data-colonist-id="${c.id}"${dragId}><span class="hud-name" style="color:${escapeAttr(c.nameColor || '#ffff00')}">${escapeHtml(c.name)}</span> <span style="color:#33ccff">${escapeHtml(t('ui.colonist.hud_exploring'))}</span></div>`;
        }
        const moodLevel = getMoodLabel(c.mood);
        const moodColor = moodLevel === 'inspired' ? '#66ffcc' : moodLevel === 'content' ? '#88cc88' : moodLevel === 'stressed' ? '#cccc44' : '#ff4444';
        const hungerColor = statColor(c.needs.hunger);
        const restColor = statColor(c.needs.rest);
        const hpColor = statColor(c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 100);
        const weaponIcon = c.weapon ? this._itemIcon(c.weapon.key, 'weapon') : '';
        const weapon = escapeHtml(c.weapon ? itemName(c.weapon) : t('ui.colonist.fists'));
        const fatigueTag = this.game.exploration?.isFatigued(c.id, this.game.tick) ? ` <span style="color:#ff6644">${escapeHtml(t('ui.colonist.hud_fatigued'))}</span>` : '';
        const dot = (label, color) => `<span class="hud-stat"><span class="hud-stat-dot" style="color:${color}">●</span>${label}</span>`;
        const cManaPct = c.maxMana > 0 ? (c.mana / c.maxMana) * 100 : 0;
        const sparkline = this._moodSparklineSvg(c);
        const moodThoughtLines = (c.thoughts || []).slice(-5).map(t => `${t.moodEffect > 0 ? '+' : ''}${t.moodEffect.toFixed(0)}: ${escapeAttr(thoughtText(t))}`).join('&#10;');
        const moodTip = `${escapeAttr(t('ui.colonist.hud_mood_tip', { n: c.mood.toFixed(0), mood: moodName(moodLevel) }))}${moodThoughtLines ? '&#10;' + moodThoughtLines : ''}`;
        const tags = (c._relaxActivity ? t('ui.info.multi_tag_relaxing') : '') + (c.drafted ? t('ui.info.multi_tag_drafted') : '') + (c.guardMode ? t('ui.info.multi_tag_guard') : '');
        let row = `<div class="hud-colonist"${draggable} data-colonist-id="${c.id}"${dragId}>`;
        row += `<span class="hud-name" style="color:${escapeAttr(c.nameColor || '#ffff00')}">${escapeHtml(c.name)}</span> <span class="hud-weapon">${weaponIcon}${weapon}</span> <span class="hud-state">${escapeHtml(colonistStateName(c.state))}${escapeHtml(tags)}${fatigueTag}</span>`;
        row += `<div class="hud-dots">`;
        row += `<span class="hud-stat skill-tip" data-tip="${moodTip}"><span class="hud-stat-dot" style="color:${moodColor}">●</span>${escapeHtml(t('ui.colonist.hud_mood'))}${sparkline}</span>`;
        row += dot(escapeHtml(t('ui.colonist.hud_food')), hungerColor);
        row += dot(escapeHtml(t('ui.colonist.hud_rest')), restColor);
        row += dot(escapeHtml(t('ui.colonist.hud_hp')), hpColor);
        if (c.maxMana > 0) row += dot(escapeHtml(t('ui.colonist.hud_mp')), statColor(cManaPct));
        row += `</div></div>`;
        return row;
    }

    forceUpdateColonistHud() {
        this._lastHudHtml = null;
        this._pendingHudHtml = null;
        // Temporarily suppress the hover gate so updateColonistHud writes to DOM immediately
        const wasHovered = this._colonistHudHovered;
        this._colonistHudHovered = false;
        this.updateColonistHud();
        this._colonistHudHovered = wasHovered;
    }

    updateColonistHud() {
        const colonists = this.game.colonists.filter(c => !c.golem);
        const golems = this.game.colonists.filter(c => c.golem);
        const groups = this.game.colonistGroups || [];

        const locked = this._colonistHudLocked;
        const lockBtn = `<button class="hud-lock-btn${locked ? ' locked' : ''}" onclick="window.game.ui._colonistHudLocked=!window.game.ui._colonistHudLocked;window.game.ui.forceUpdateColonistHud()" title="${escapeAttr(locked ? t('ui.colonist.hud_unlock') : t('ui.colonist.hud_lock'))}">${locked ? '🔒' : '🔓'}</button>`;
        let html = `<div class="footer-panel-header" style="display:flex;justify-content:space-between;align-items:center;">${escapeHtml(t('ui.colonist.hud_title'))}${lockBtn}</div>`;

        // Build buckets: one per named group (in order) + ungrouped
        const buckets = new Map(); // groupName -> colonist[]
        for (const g of groups) buckets.set(g, []);
        buckets.set(null, []); // ungrouped

        for (const c of colonists) {
            const key = (c.group && groups.includes(c.group)) ? c.group : null;
            buckets.get(key).push(c);
        }

        // Sort each bucket: alive first, dead last
        for (const [, members] of buckets) {
            members.sort((a, b) => (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0));
        }

        for (const [groupName, members] of buckets) {
            if (members.length === 0) continue;
            if (groupName !== null) {
                html += `<div class="hud-group-header" data-group-name="${escapeAttr(groupName)}">`;
                html += `<span class="hud-group-name">${escapeHtml(groupName)}</span>`;
                if (!locked) {
                    html += `<span class="hud-group-actions">`;
                    html += `<button class="hud-group-btn" onclick="event.stopPropagation();window.game.moveColonistGroupUp(${jsArg(groupName)})" title="${escapeAttr(t('ui.colonist.hud_group_up'))}">▲</button>`;
                    html += `<button class="hud-group-btn" onclick="event.stopPropagation();window.game.moveColonistGroupDown(${jsArg(groupName)})" title="${escapeAttr(t('ui.colonist.hud_group_down'))}">▼</button>`;
                    html += `</span>`;
                }
                html += `</div>`;
            } else if (groups.length > 0) {
                html += `<div class="hud-group-header" style="color:#888;">${escapeHtml(t('ui.colonist.hud_ungrouped'))}</div>`;
            }
            for (const c of members) {
                html += this._hudColonistRow(c);
            }
        }

        if (golems.length > 0) {
            html += `<div class="footer-panel-header" style="margin-top: 12px;">${escapeHtml(t('ui.colonist.hud_golems'))}</div>`;
            const sortedGolems = [...golems].sort((a, b) => (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0));
            for (const g of sortedGolems) {
                if (g.hp <= 0) {
                    html += `<div class="hud-colonist dead"><span class="hud-name" style="color:${escapeAttr(g.nameColor || '#ffff00')}">${escapeHtml(g.name)}</span> <span style="color:#cc4444">${escapeHtml(t('ui.colonist.hud_destroyed'))}</span></div>`;
                    continue;
                }
                if (g.onExpedition) {
                    html += `<div class="hud-colonist" data-colonist-id="${g.id}"><span class="hud-name" style="color:${escapeAttr(g.nameColor || '#ffff00')}">${escapeHtml(g.name)}</span> <span style="color:#33ccff">${escapeHtml(t('ui.colonist.hud_exploring'))}</span></div>`;
                    continue;
                }
                const hpColor = statColor(g.maxHp > 0 ? (g.hp / g.maxHp) * 100 : 100);
                const weaponIcon = g.weapon ? this._itemIcon(g.weapon.key, 'weapon') : '';
                const weapon = escapeHtml(g.weapon ? itemName(g.weapon) : t('common.none'));
                html += `<div class="hud-colonist" data-colonist-id="${g.id}">`;
                html += `<span class="hud-name" style="color:${escapeAttr(g.nameColor || '#ffff00')}">${escapeHtml(g.name)}</span> <span class="hud-weapon">${weaponIcon}${weapon}</span> <span class="hud-state">${escapeHtml(colonistStateName(g.state))}${g.drafted ? escapeHtml(t('ui.info.multi_tag_drafted')) : ''}</span>`;
                const gDot = (label, color) => `<span class="hud-stat"><span class="hud-stat-dot" style="color:${color}">●</span>${label}</span>`;
                html += `<div class="hud-dots">${gDot(escapeHtml(t('ui.colonist.hud_hp')), hpColor)}</div>`;
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

    toggleEventLog() {
        const el = this.elements.eventLog;
        if (!el) return;
        const hidden = el.style.display === 'none';
        el.style.display = hidden ? '' : 'none';
    }

    updateEventLog() {
        const entries = this.game.eventLog.getRecent(10);
        let html = `<div class="footer-panel-header">${escapeHtml(t('ui.main.event_log_title'))}</div>`;
        if (entries.length === 0) {
            html += `<div class="event-log-row" style="color:#666">${escapeHtml(t('ui.main.event_log_empty'))}</div>`;
        }
        for (let i = entries.length - 1; i >= 0; i--) {
            const e = entries[i];
            const colorStyle = e.type === 'danger' ? 'color:#ff6666' : e.type === 'success' ? 'color:#66ff66' : 'color:#ffcc44';
            if (e.linkedEntity) {
                const entityJson = escapeAttr(JSON.stringify(e.linkedEntity));
                html += `<div class="event-log-row" style="cursor:pointer;${colorStyle}" data-entity="${entityJson}">`;
            } else {
                html += `<div class="event-log-row" style="${colorStyle}">`;
            }
            html += `<span class="event-log-time">[${escapeHtml(logEntryTime(e))}]</span> ${escapeHtmlKeepEntities(logEntryText(e))}`;
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
        if (!opening) this._renamingAnimalId = null;
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

        let html = `<div class="panel-close" data-panel-close="inventory">&times;</div><h3>${escapeHtml(t('ui.inv.title'))}</h3>`;

        const tabLabel = (key, n) => escapeHtml(n ? t('ui.inv.tab_count', { name: t(key), n }) : t(key));
        html += '<div class="inv-tabs">';
        html += `<button class="inv-tab-btn${activeTab === 'resources' ? ' active' : ''}" data-inv-tab="resources">${tabLabel('ui.inv.tab_resources')}</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'equipment' ? ' active' : ''}" data-inv-tab="equipment">${tabLabel('ui.inv.tab_equipment', equipCount)}</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'consumables' ? ' active' : ''}" data-inv-tab="consumables">${tabLabel('ui.inv.tab_consumables', consumeCount)}</button>`;
        html += `<button class="inv-tab-btn${activeTab === 'animals' ? ' active' : ''}" data-inv-tab="animals">${tabLabel('ui.inv.tab_animals', tamed.length)}</button>`;
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
        const poweredIceBoxes = this.game.power?.ready ? this.game.power.countPowered(this.game, 'ice_box') : iceBoxCount;
        if (foodChestCount > 0 || iceBoxCount > 0) {
            let reduction = Math.min(0.6, foodChestCount * 0.15);
            reduction += poweredIceBoxes * 0.4;
            reduction = Math.min(0.9, reduction);
            const pct = Math.round(reduction * 100);
            const season = this.game.weather.season;
            const prKey = season === 'summer' ? 'ui.inv.preservation_summer' : season === 'winter' ? 'ui.inv.preservation_winter' : 'ui.inv.preservation';
            html += `<div class="info-row" style="color:#aa8844;font-size:0.9em;">${escapeHtml(t(prKey, { pct }))}</div>`;
        }

        const buildingMats = ['wood', 'stone', 'planks', 'bricks', 'hides', 'leather', 'iron_ore', 'iron', 'runite_ore', 'runite', 'wool', 'cotton', 'cloth', 'void_essence'];
        const foodKeys = [...FOODSTUFFS, 'food'];
        const reserved = this.game.resources.reservedFoodstuffs;

        const buildingEntries = Object.entries(r).filter(([k, v]) => v > 0 && buildingMats.includes(k));
        const foodEntries = Object.entries(r).filter(([k, v]) => v > 0 && foodKeys.includes(k));
        const otherEntries = Object.entries(r).filter(([k, v]) => v > 0 && !buildingMats.includes(k) && !foodKeys.includes(k));

        if (buildingEntries.length > 0) {
            html += `<div class="info-row" style="color:#aa8844;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_building_materials'))}</b></div>`;
            for (const [key, amount] of buildingEntries) {
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${escapeHtml(resourceName(key))}</span><span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (foodEntries.length > 0) {
            const spoilPerDay = this.game.resources.estimateDailyFoodSpoilage(this.game);
            const spoilLabel = spoilPerDay > 0
                ? ` <span style="color:#cc6644;font-size:0.9em;">${escapeHtml(t('ui.inv.spoilage_per_day', { n: spoilPerDay }))}</span>`
                : '';
            html += `<div class="info-row" style="color:#66aa44;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_foodstuffs'))}</b>${spoilLabel}</div>`;
            for (const [key, amount] of foodEntries) {
                const isFood = FOODSTUFFS.includes(key);
                const isReserved = reserved[key];
                let extra = '';
                if (isFood) {
                    const cls = isReserved ? 'inv-reserve active' : 'inv-reserve';
                    extra = `<button class="${cls}" data-reserve-food="${key}" title="${escapeAttr(isReserved ? t('ui.inv.unreserve_tip') : t('ui.inv.reserve_tip'))}">${isReserved ? '🔒' : '🔓'}</button>`;
                }
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${escapeHtml(resourceName(key))}</span>${extra}<span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (otherEntries.length > 0) {
            html += `<div class="info-row" style="color:#8888cc;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_other'))}</b></div>`;
            for (const [key, amount] of otherEntries) {
                html += `<div class="inv-row"><span class="inv-name">${this._itemIcon(key, 'material')}${escapeHtml(resourceName(key))}</span><span class="inv-amount">${Math.round(amount)}</span></div>`;
            }
        }

        if (!html) html = `<div class="info-row" style="color:#666;">${escapeHtml(t('ui.inv.no_resources'))}</div>`;
        return html;
    }

    _qualityColor(item) {
        if (!item.quality) return '#cccccc';
        const colors = { poor: '#888888', fine: '#44cc44', superior: '#4488ff', masterwork: '#ffcc44' };
        return colors[item.quality] || '#cccccc';
    }

    _enchantmentGlow(item) {
        return item.enchantment ? ' enchanted-text' : '';
    }

    _getBuildingSpriteURL(buildingKey, isFloor) {
        if (!this._buildingSpriteCache) this._buildingSpriteCache = new Map();
        if (this._buildingSpriteCache.has(buildingKey)) return this._buildingSpriteCache.get(buildingKey);
        const category = isFloor ? 'floors' : 'buildings';
        const sprite = this.game.skinManager.getSprite(category, buildingKey);
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

    _getCropSpriteURL(cropKey) {
        if (!this._cropSpriteCache) this._cropSpriteCache = new Map();
        if (this._cropSpriteCache.has(cropKey)) return this._cropSpriteCache.get(cropKey);
        const sprite = this.game.skinManager.getSprite('farms', cropKey)
                    || this.game.skinManager.getSprite('farms', 'farm_ready');
        if (!sprite) { this._cropSpriteCache.set(cropKey, null); return null; }
        const c = document.createElement('canvas');
        c.width = sprite.width || sprite.naturalWidth || 16;
        c.height = sprite.height || sprite.naturalHeight || 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(sprite, 0, 0);
        const url = c.toDataURL('image/png');
        this._cropSpriteCache.set(cropKey, url);
        return url;
    }

    _buildCostChip(key, amount) {
        if (this.game.skinManager?.isActive) {
            const url = this.game.skinManager.getItemSpriteDataURL(key);
            if (url) return `<span class="cost-chip"><img src="${url}" style="width:12px;height:12px;vertical-align:middle;image-rendering:pixelated;" title="${escapeAttr(resourceName(key))}">${amount}</span>`;
        }
        const colors = {
            wood: '#8b6b3a', stone: '#999', food: '#88cc44', planks: '#c89648',
            bricks: '#cc6633', iron_ore: '#887766', runite_ore: '#2aaa88', iron: '#aaa', runite: '#44ccff',
            void_essence: '#9933ff', hides: '#8b7355', leather: '#a0522d',
            gold: '#ffdd00',
        };
        const abbr = {
            wood: 'ui.main.res_abbr_wood', stone: 'ui.main.res_abbr_stone', food: 'ui.main.res_abbr_food', planks: 'ui.main.res_abbr_planks', bricks: 'ui.main.res_abbr_bricks',
            iron_ore: 'ui.main.res_abbr_iron_ore', runite_ore: 'ui.main.res_abbr_runite_ore', iron: 'ui.main.res_abbr_iron', runite: 'ui.main.res_abbr_runite', leather: 'ui.main.res_abbr_leather',
            void_essence: 'ui.build.cost_abbr_void_essence', hides: 'ui.build.cost_abbr_hides', gold: 'ui.main.res_abbr_gold',
        };
        const color = colors[key] || '#aaa';
        const label = escapeHtml(abbr[key] ? t(abbr[key]) : resourceName(key).charAt(0).toUpperCase());
        return `<span class="cost-chip" style="color:${color}">${label}${amount}</span>`;
    }

    _showBuildTooltip(card, e) {
        const buildType = card.dataset.buildOpt;
        const def = BUILDINGS[buildType];
        if (!def) return;
        let html = `<div class="build-tip-name">${escapeHtml(buildingName(buildType))}</div>`;
        html += `<div class="build-tip-desc">${escapeHtml(def.description || '')}</div>`;
        if (def.research) {
            const unlocked = this.game.research.isResearched(def.research);
            const researchName = RESEARCH[def.research]?.name || def.research.replace(/_/g, ' ');
            html += `<div class="build-tip-meta" style="color:${unlocked ? '#66cc66' : '#cc6666'}">${escapeHtml(t(unlocked ? 'ui.build.tip_research_done' : 'ui.build.tip_research', { name: researchName }))}</div>`;
        }
        if (def.power) {
            if (def.power.generates) html += `<div class="build-tip-meta" style="color:#aa44ff">${escapeHtml(t('ui.tile.power_generates', { n: def.power.generates }))}</div>`;
            if (def.power.consumes) html += `<div class="build-tip-meta" style="color:#ff8844">${escapeHtml(t('ui.tile.power_consumes', { n: def.power.consumes }))}</div>`;
            if (def.power.damage) html += `<div class="build-tip-meta" style="color:#ff4444">${escapeHtml(t('ui.build.tip_damage', { n: def.power.damage, range: def.power.range || '?' }))}</div>`;
        }
        if (def.maxCount !== undefined) {
            html += `<div class="build-tip-meta" style="color:#aaa">${escapeHtml(t('ui.build.tip_max', { n: def.maxCount + getMaxCountBonus(def, buildType, this.game) }))}</div>`;
        }
        this._buildTooltip.innerHTML = html;
        this._buildTooltip.style.display = 'block';
        if (e) this._positionBuildTooltip(e);
        else {
            // No pointer position (a tap): sit above the card, since the build panel is at the
            // bottom of the screen, and keep the tip inside the window.
            const rect = card.getBoundingClientRect();
            const tt = this._buildTooltip;
            const above = rect.top - tt.offsetHeight - 4;
            tt.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - tt.offsetWidth - 4)) + 'px';
            tt.style.top = (above >= 4 ? above : rect.bottom + 4) + 'px';
        }
    }

    _hideBuildTooltip() {
        if (this._buildTooltip) this._buildTooltip.style.display = 'none';
        clearTimeout(this._buildTooltipTimer);
        this._buildTooltipTimer = null;
    }

    _positionBuildTooltip(e) {
        const tt = this._buildTooltip;
        const x = (e.clientX || 0) + 12;
        const y = (e.clientY || 0) - tt.offsetHeight - 8;
        tt.style.left = Math.min(x, window.innerWidth - tt.offsetWidth - 8) + 'px';
        tt.style.top = Math.max(y, 4) + 'px';
    }

    _invTierDivider(tier, hasAbove) {
        const TIER_NAMES = ['', t('ui.craft.tier_primitive'), t('ui.craft.tier_iron'), t('ui.craft.tier_runic'), t('ui.craft.tier_void')];
        const label = TIER_NAMES[tier] || t('ui.craft.tier_n', { n: tier });
        const mt = hasAbove ? 'margin-top:6px;' : '';
        return `<div style="padding:2px 0;${mt}font-size:0.78em;color:#666;border-top:1px solid #2a2a2a;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t('ui.inv.tier_divider', { n: tier, name: label }))}</div>`;
    }

    _buildInvEquipment(weapons, armors, helmets, clothes, tools, boots, trinkets) {
        const sortByTier = arr => [...arr].sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity));
        let html = '';
        if (weapons.length > 0) {
            html += `<div class="info-row" style="color:#cc8888;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_weapons'))}</b></div>`;
            let lastTier = null;
            sortByTier(weapons).forEach((w) => {
                if (w.tier !== undefined && w.tier !== lastTier) {
                    html += this._invTierDivider(w.tier, lastTier !== null);
                    lastTier = w.tier;
                }
                const extras = getItemStatLines({ ...w, damage: undefined });
                const cd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
                let stats = t('ui.colonist.weapon_stats', { dmg: w.damage, dps: (w.damage / cd).toFixed(1), speed: weaponSpeedLabel(cd) });
                if (extras.length) stats += `, ${extras.join(', ')}`;
                const onHitStats = getOnHitLines(w);
                if (onHitStats.length) stats += `, ${onHitStats.join(', ')}`;
                const tip = itemDescription(w);
                const wec = ENCHANT_COST_BY_TIER[w.tier] ?? { resource: 'runite', amount: 5 };
                const wecLabel = t('ui.inv.salvage_part', { n: wec.amount, name: resourceName(wec.resource) });
                const wi = weapons.indexOf(w);
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(w)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(w)}">${this._itemIcon(w.key, 'weapon')}${escapeHtml(itemName(w))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(w), cost: wecLabel }))})){window.game.enchantWeapon(${wi});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(w), returns: salvagePreview(w, this.game) }))})){window.game.discardWeapon(${wi})}">♻</button></span></div>`;
            });
        }
        if (armors.length > 0) {
            html += `<div class="info-row" style="color:#9966cc;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_armor'))}</b></div>`;
            let lastTier = null;
            sortByTier(armors).forEach((a) => {
                if (a.tier !== undefined && a.tier !== lastTier) {
                    html += this._invTierDivider(a.tier, lastTier !== null);
                    lastTier = a.tier;
                }
                const stats = getItemStatLines(a).join(', ');
                const tip = itemDescription(a);
                const aec = ENCHANT_COST_BY_TIER[a.tier] ?? { resource: 'runite', amount: 5 };
                const aecLabel = t('ui.inv.salvage_part', { n: aec.amount, name: resourceName(aec.resource) });
                const ai = armors.indexOf(a);
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(a)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(a)}">${this._itemIcon(a.key, 'armor')}${escapeHtml(itemName(a))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(a), cost: aecLabel }))})){window.game.enchantArmor(${ai});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(a), returns: salvagePreview(a, this.game) }))})){window.game.discardArmor(${ai})}">♻</button></span></div>`;
            });
        }
        if (helmets.length > 0) {
            html += `<div class="info-row" style="color:#7799cc;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_helmets'))}</b></div>`;
            let lastTier = null;
            sortByTier(helmets).forEach((h) => {
                if (h.tier !== undefined && h.tier !== lastTier) {
                    html += this._invTierDivider(h.tier, lastTier !== null);
                    lastTier = h.tier;
                }
                const stats = getItemStatLines(h).join(', ');
                const tip = itemDescription(h);
                const hec = ENCHANT_COST_BY_TIER[h.tier] ?? { resource: 'runite', amount: 5 };
                const hecLabel = t('ui.inv.salvage_part', { n: hec.amount, name: resourceName(hec.resource) });
                const hi = helmets.indexOf(h);
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(h)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(h)}">${this._itemIcon(h.key, 'helmet')}${escapeHtml(itemName(h))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(h), cost: hecLabel }))})){window.game.enchantHelmet(${hi});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(h), returns: salvagePreview(h, this.game) }))})){window.game.discardHelmet(${hi})}">♻</button></span></div>`;
            });
        }
        if (boots.length > 0) {
            html += `<div class="info-row" style="color:#aa8855;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_boots'))}</b></div>`;
            let lastTier = null;
            sortByTier(boots).forEach((b) => {
                if (b.tier !== undefined && b.tier !== lastTier) {
                    html += this._invTierDivider(b.tier, lastTier !== null);
                    lastTier = b.tier;
                }
                const stats = getItemStatLines(b).join(', ');
                const tip = itemDescription(b);
                const bec = ENCHANT_COST_BY_TIER[b.tier] ?? { resource: 'runite', amount: 5 };
                const becLabel = t('ui.inv.salvage_part', { n: bec.amount, name: resourceName(bec.resource) });
                const bi = boots.indexOf(b);
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(b)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(b)}">${this._itemIcon(b.key, 'boots')}${escapeHtml(itemName(b))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(b), cost: becLabel }))})){window.game.enchantBoots(${bi});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(b), returns: salvagePreview(b, this.game) }))})){window.game.discardBoots(${bi})}">♻</button></span></div>`;
            });
        }
        if (clothes.length > 0) {
            html += `<div class="info-row" style="color:#cc8866;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_clothes'))}</b></div>`;
            let lastTier = null;
            sortByTier(clothes).forEach((c) => {
                if (c.tier !== undefined && c.tier !== lastTier) {
                    html += this._invTierDivider(c.tier, lastTier !== null);
                    lastTier = c.tier;
                }
                const stats = getItemStatLines(c).join(', ');
                const tip = itemDescription(c);
                const cec = ENCHANT_COST_BY_TIER[c.tier] ?? { resource: 'runite', amount: 5 };
                const cecLabel = t('ui.inv.salvage_part', { n: cec.amount, name: resourceName(cec.resource) });
                const ci = clothes.indexOf(c);
                html += `<div class="inv-row"><span class="inv-name skill-tip${this._enchantmentGlow(c)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(c)}">${this._itemIcon(c.key, 'clothes')}${escapeHtml(itemName(c))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(c), cost: cecLabel }))})){window.game.enchantClothes(${ci});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(c), returns: salvagePreview(c, this.game) }))})){window.game.discardClothes(${ci})}">♻</button></span></div>`;
            });
        }
        if (tools.length > 0) {
            html += `<div class="info-row" style="color:#88aacc;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_tools'))}</b></div>`;
            let lastTier = null;
            sortByTier(tools).forEach((tool) => {
                if (tool.tier !== undefined && tool.tier !== lastTier) {
                    html += this._invTierDivider(tool.tier, lastTier !== null);
                    lastTier = tool.tier;
                }
                const stats = getItemStatLines(tool).join(', ');
                const tip = itemDescription(tool);
                const tec = ENCHANT_COST_BY_TIER[tool.tier] ?? { resource: 'runite', amount: 5 };
                const tecLabel = t('ui.inv.salvage_part', { n: tec.amount, name: resourceName(tec.resource) });
                const ti = tools.indexOf(tool);
                html += `<div class="inv-row"><span class="inv-name skill-tip ${this._enchantmentGlow(tool)}" data-tip="${escapeAttr(tip)}" style="color:${this._qualityColor(tool)}">${this._itemIcon(tool.key, 'tool')}${escapeHtml(itemName(tool))}</span>
                        <span class="inv-amount">${stats}</span>
                        <span class="inv-actions"><button class="inv-enchant" onclick="if(!window.game.research.isResearched('arcane_infusion')){alert(${jsArg(t('ui.inv.enchant_requires'))});}else if(confirm(${jsArg(t('ui.inv.enchant_confirm', { item: itemName(tool), cost: tecLabel }))})){window.game.enchantTool(${ti});}">✦</button>
                        <button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(tool), returns: salvagePreview(tool, this.game) }))})){window.game.discardTool(${ti})}">♻</button></span></div>`;
            });
        }
        if (trinkets.length > 0) {
            html += `<div class="info-row" style="color:#ccaa44;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_trinkets'))}</b></div>`;
            let lastTier = null;
            sortByTier(trinkets).forEach((a) => {
                if (a.tier !== undefined && a.tier !== lastTier) {
                    html += this._invTierDivider(a.tier, lastTier !== null);
                    lastTier = a.tier;
                }
                const tip = this._getTrinketTooltip(a);
                const ai = trinkets.indexOf(a);
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${escapeAttr(tip)}" style="color:${escapeAttr(a.textColor || "#d3d597")}">${this._itemIcon(a.key, 'trinket')}${escapeHtml(itemName(a))}</span><span class="inv-amount"></span><span class="inv-actions"><button class="inv-delete" onclick="if(confirm(${jsArg(t('ui.inv.salvage_confirm', { item: itemName(a), returns: salvagePreview(a, this.game) }))})){window.game.discardTrinket(${ai})}">♻</button></span></div>`;
            });
        }
        if (!html) html = `<div class="info-row" style="color:#666;">${escapeHtml(t('ui.inv.no_equipment'))}</div>`;
        return html;
    }

    _buildInvConsumables(potions, tomes, consumables) {
        let html = '';
        if (consumables && consumables.length > 0) {
            html += `<div class="info-row" style="color:#aa44ff;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_usable'))}</b></div>`;
            for (let i = 0; i < consumables.length; i++) {
                const c = consumables[i];
                const desc = itemDescription(c);
                const icon = this._itemIcon(c.key);
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${escapeAttr(desc)}">${icon}${escapeHtml(itemName(c))}</span><button class="inv-use" onclick="window.game.useConsumable(${i})">${escapeHtml(t('ui.inv.use'))}</button></div>`;
            }
        }
        if (potions.length > 0) {
            html += `<div class="info-row" style="color:#cc88aa;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_potions'))}</b> <span style="color:#666;font-size:0.8em;margin-left:4px;">${escapeHtml(t('ui.inv.potions_auto_use'))}</span></div>`;
            const potionCounts = countByKey(potions, p => p.key ?? p.type);
            for (const [type, count] of Object.entries(potionCounts)) {
                const def = POTIONS[type];
                const potionTip = this.getCraftOutputTip(type) || '';
                const autoUse = this.game.settings.potionAutoUse || {};
                const isEnabled = autoUse[type] !== false;
                html += `<div class="inv-row" style="display:flex;align-items:center;gap:6px;">`;
                html += `<span class="inv-name skill-tip" data-tip="${escapeAttr(potionTip)}" style="flex:1;">${this._itemIcon(type, 'potion')}${escapeHtml(def ? def.name : type)}</span>`;
                html += `<span class="inv-amount">x${count}</span>`;
                html += `<label style="display:flex;align-items:center;gap:3px;font-size:0.8em;color:#aaa;white-space:nowrap;cursor:pointer;" title="${escapeAttr(t('ui.inv.potion_auto_use_tip'))}">`;
                html += `<input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.game.setPotionAutoUse(${jsArg(type)}, this.checked)" style="cursor:pointer;accent-color:#44cc88;">`;
                html += `</label>`;
                html += `</div>`;
            }
        }
        if (tomes.length > 0) {
            html += `<div class="info-row" style="color:#bb88ff;margin-top:8px;margin-bottom:4px;"><b>${escapeHtml(t('ui.inv.head_tomes'))}</b></div>`;
            const tomeCounts = countByKey(tomes, t => t.key);
            for (const [key, count] of Object.entries(tomeCounts)) {
                const def = SPELL_TOMES[key];
                const spell = def ? SPELLS[def.spell] : null;
                const schoolName = spell ? MAGIC_SKILLS[spell.school]?.name : '';
                const tomeTip = this.getCraftOutputTip(key) || '';
                html += `<div class="inv-row"><span class="inv-name skill-tip" data-tip="${escapeAttr(tomeTip)}">${this._itemIcon(key, 'tome')}${escapeHtml(def ? def.name : key)}</span><span class="inv-amount">x${count}${schoolName ? ` (${escapeHtml(schoolName)})` : ''}</span></div>`;
            }
        }
        if (!html) html = `<div class="info-row" style="color:#666;">${escapeHtml(t('ui.inv.no_consumables'))}</div>`;
        return html;
    }

    _buildInvAnimals(tamed) {
        if (!tamed.length) return `<div class="info-row" style="color:#666;">${escapeHtml(t('ui.inv.no_tamed'))}</div>`;

        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        const PET_BOND_THRESHOLD = 5;
        const selectStyle = 'background:#222;color:#eee;border:1px solid #555;padding:1px 3px;font-size:0.85em;';
        const btnStyle = 'background:#333;color:#ccc;border:1px solid #555;padding:1px 5px;font-size:0.8em;cursor:pointer;';
        const nameBtnStyle = 'background:none;border:none;color:#999;cursor:pointer;font-size:0.8em;padding:0 4px;';

        // group by type while preserving first-seen order
        const groups = {};
        const order = [];
        for (const a of tamed) {
            if (!groups[a.type]) { groups[a.type] = []; order.push(a.type); }
            groups[a.type].push(a);
        }

        let html = '';
        for (const type of order) {
            const animals = groups[type];
            const def = TAMED_ANIMALS[type] || {};
            const color = escapeAttr(def.color || '#ccaa88');
            html += `<div style="margin-bottom:8px;">`;
            const typeLabel = escapeHtml(t('ui.inv.animal_group', { name: cap(tamedTypeName(type)), n: animals.length }));
            html += `<div style="color:${color};font-weight:bold;border-bottom:1px solid #333;margin-bottom:4px;padding-bottom:2px;">${typeLabel}</div>`;

            for (const a of animals) {
                const displayName = escapeHtml(a.name || cap(tamedTypeName(a.type)));
                html += `<div style="padding:4px 0 4px 8px;border-bottom:1px solid #2a2a2a;">`;

                // name row: clickable name + rename button / inline input when editing
                html += `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">`;
                if (this._renamingAnimalId === a.id) {
                    html += `<input data-animal-rename-input="${a.id}" type="text" value="" placeholder="${displayName}" style="background:#222;color:#eee;border:1px solid #666;padding:1px 4px;font-size:0.9em;width:100px;" maxlength="24" autofocus>`;
                    html += `<button data-animal-rename-confirm="${a.id}" style="${btnStyle}">${escapeHtml(t('common.ok'))}</button>`;
                    html += `<button data-animal-rename-cancel style="${btnStyle}">✕</button>`;
                } else if (this._releasingAnimalId === a.id) {
                    html += `<span style="color:#eee;font-weight:bold;">${displayName}</span>`;
                    html += `<span style="color:#ff9944;font-size:0.85em;margin-left:4px;">${escapeHtml(t('ui.inv.release_confirm'))}</span>`;
                    html += `<span style="margin-left:auto;display:flex;gap:4px;">`;
                    html += `<button data-animal-release-confirm="${a.id}" style="${btnStyle.replace('#333','#882200')}">${escapeHtml(t('common.yes'))}</button>`;
                    html += `<button data-animal-release-cancel style="${btnStyle}">${escapeHtml(t('common.no'))}</button>`;
                    html += `</span>`;
                } else {
                    html += `<span data-animal-goto="${a.id}" style="cursor:pointer;color:#eee;text-decoration:underline dotted;font-weight:bold;" title="${escapeAttr(t('ui.inv.locate_tip'))}">${displayName}</span>`;
                    html += `<button data-animal-rename="${a.id}" style="${btnStyle}" title="${escapeAttr(t('ui.info.rename'))}">${escapeHtml(t('ui.info.rename'))}</button>`;
                    html += `<button data-animal-release="${a.id}" style="margin-left:auto;${btnStyle}" title="${escapeAttr(t('ui.inv.release_tip'))}">${escapeHtml(t('ui.inv.release'))}</button>`;
                }
                html += `</div>`;

                // level
                if (a.level > 0) {
                    const lvlTip = escapeAttr(animalLevelTooltip(a.level, a.type)).replace(/\n/g, '&#10;');
                    html += `<div class="info-row" style="color:#ffcc44;font-size:0.9em;" title="${lvlTip}">${escapeHtml(t(a.level >= 5 ? 'ui.info.animal_level_max' : 'ui.info.animal_level', { n: a.level }))}</div>`;
                }

                // bond
                if (a.bondedColonistId) {
                    const bonded = this.game.colonists.find(c => c.id === a.bondedColonistId);
                    const bondName = bonded ? bonded.name : t('common.unknown');
                    const bondDisplay = a.isPet ? t('ui.info.bonded_pet', { name: bondName }) : t('ui.info.bonded_level', { name: bondName, n: a.bondLevel || 0, max: PET_BOND_THRESHOLD });
                    html += `<div class="info-row" style="color:#aaddff;font-size:0.9em;">${escapeHtml(bondDisplay)}</div>`;
                }

                // hunger
                if (def.hungerRate) {
                    const threshold = def.hungerThreshold || 3;
                    const hunger = a.hunger || 0;
                    if (hunger >= threshold) {
                        html += `<div class="info-row" style="color:#ff6644;font-size:0.9em;">${escapeHtml(t('ui.inv.animal_hungry', { n: hunger, max: threshold }))}</div>`;
                    } else if (hunger > 0) {
                        html += `<div class="info-row" style="color:#ddaa44;font-size:0.9em;">${escapeHtml(t('ui.info.animal_hunger', { n: hunger, max: threshold }))}</div>`;
                    }
                }

                if (a.onExpedition) {
                    html += `<div class="info-row" style="color:#33ccff;font-size:0.9em;">${escapeHtml(t('ui.info.animal_on_expedition'))}</div>`;
                } else {
                    const isGuard = a.roles && a.roles.some(r => r.type === 'guard');
                    if (isGuard && !a.isPet) {
                        const aliveColonists = this.game.colonists.filter(c => c.hp > 0);
                        if (aliveColonists.length > 0) {
                            const opts = aliveColonists.map(c =>
                                `<option value="${c.id}"${c.id === a.bondedColonistId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
                            ).join('');
                            html += `<div class="info-row" style="font-size:0.9em;margin-top:2px;">`;
                            html += `<label style="color:#aaaaaa;">${escapeHtml(t('ui.info.animal_defends'))} </label>`;
                            html += `<select data-animal-rebond="${a.id}" style="${selectStyle}">${opts}</select>`;
                            html += `</div>`;
                        }
                    } else if (a.isPet) {
                        const aliveColonists = this.game.colonists.filter(c => c.hp > 0);
                        if (aliveColonists.length > 0) {
                            const maxPets = this.game.research?.isResearched('pack_binding') ? 2 : 1;
                            const ownerPetCount = a.bondedColonistId
                                ? this.game.entities.filter(e => e.tamed && e.isPet && e.bondedColonistId === a.bondedColonistId).length
                                : 0;
                            const opts = aliveColonists.map(c =>
                                `<option value="${c.id}"${c.id === a.bondedColonistId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
                            ).join('');
                            html += `<div class="info-row" style="font-size:0.9em;margin-top:2px;">`;
                            html += `<label style="color:#aaaaaa;">${escapeHtml(t('ui.info.animal_pet_owner', { n: ownerPetCount, max: maxPets }))} </label>`;
                            html += `<select data-animal-rebond-pet="${a.id}" style="${selectStyle}">${opts}</select>`;
                            html += `</div>`;
                        }
                    } else {
                        const penPositions = this.game.mapIndex
                            ? [...this.game.mapIndex.getStructurePositions('beast_circle')].map(k => ({ x: k & 0xFFFF, y: k >> 16 }))
                            : [];
                        if (penPositions.length > 0) {
                            const penOpts = penPositions.map(p => {
                                const isCurrent = p.x === a.penX && p.y === a.penY;
                                return `<option value="${p.x},${p.y}"${isCurrent ? ' selected' : ''}>${escapeHtml(t('ui.info.animal_pen_option', { x: p.x, y: p.y }))}</option>`;
                            }).join('');
                            html += `<div class="info-row" style="font-size:0.9em;margin-top:2px;">`;
                            html += `<label style="color:#aaaaaa;">${escapeHtml(t('ui.info.animal_pen_label'))} </label>`;
                            html += `<select data-animal-pen="${a.id}" style="${selectStyle}">${penOpts}</select>`;
                            html += `</div>`;
                        } else {
                            html += `<div class="info-row" style="color:#666;font-size:0.85em;">${escapeHtml(t('ui.inv.no_beast_circles'))}</div>`;
                        }
                    }
                }

                html += `</div>`;
            }
            html += `</div>`;
        }
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

    toggleSaveSlotPanel() {
        const opening = !this.saveSlotPanelVisible;
        this._closeAllPanels();
        this.saveSlotPanelVisible = opening;
        this._panelPause(opening);
        this.elements.saveSlotPanel.style.display = opening ? 'block' : 'none';
        if (opening) this.updateSaveSlotPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    updateSaveSlotPanel() {
        const meta = getAllSlotsMeta();
        const primary = this.game.settings.primarySaveSlot;
        let html = `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.slots_title'))}</div>`;
        html += `<div style="color:#aaa;font-size:11px;margin-bottom:8px;">${tHtml('ui.settings.slots_note_html')}</div>`;
        for (let i = 0; i < 10; i++) {
            const key = `colony_slot_manual_${i}`;
            const m = meta[key] || null;
            const isPrimary = key === primary;
            // Slot metadata can come from an imported or cloud save: escape it all.
            const seasonRaw = m ? String(m.season ?? '') : '';
            const season = t(`season.${seasonRaw}.name`, null, seasonRaw.charAt(0).toUpperCase() + seasonRaw.slice(1));
            const gameStr = m ? escapeHtml(tp('ui.settings.slot_meta', m.colonistCount, { season, year: m.year, day: m.dayOfSeason })) : '';
            const dateStr = m ? escapeHtml(new Date(m.timestamp).toLocaleString()) : '';
            const thumbHtml = typeof m?.thumbnail === 'string' && m.thumbnail.startsWith('data:image/')
                ? `<img class="slot-thumbnail" src="${escapeAttr(m.thumbnail)}" alt="">`
                : `<div class="slot-thumbnail-placeholder"></div>`;
            const nameVal = escapeAttr(m?.label || '');
            const primaryBadge = isPrimary ? `<span style="color:#ffcc00;font-size:10px;margin-right:4px;" title="${escapeAttr(t('ui.settings.slot_active_tip'))}">&#9733; ${escapeHtml(t('ui.settings.slot_active'))}</span>` : '';
            html += `<div class="slot-card${m ? '' : ' slot-empty'}${isPrimary ? ' slot-primary' : ''}">
                ${thumbHtml}
                <div class="slot-label">${escapeHtml(t('ui.settings.slot_n', { n: i + 1 }))}${isPrimary ? `<br><span style="color:#ffcc00;font-size:9px;">&#9733; ${escapeHtml(t('ui.settings.slot_active_badge'))}</span>` : ''}</div>
                <div class="slot-meta">${m ? `${gameStr}<br><span class="slot-timestamp">${dateStr}</span>` : `<span style="color:#555">${escapeHtml(t('ui.settings.slot_empty'))}</span>`}</div>
                <input class="slot-name-input" type="text" placeholder="${escapeAttr(t('ui.settings.slot_name_placeholder'))}" value="${nameVal}" data-slot-name-key="${key}" maxlength="30" style="margin-right:4px;">
                <button class="slot-save-btn" data-slot-save-key="${key}">${escapeHtml(t('ui.settings.slot_save'))}</button>
                <button class="slot-export-btn" ${m ? '' : 'disabled'} data-slot-export-key="${key}">${escapeHtml(t('ui.settings.slot_export'))}</button>
                <button class="slot-load-btn" ${m ? '' : 'disabled'} data-slot-load-key="${key}">${escapeHtml(t('ui.settings.slot_load'))}</button>
            </div>`;
        }
        html += `</div>`;
        this.elements.saveSlotPanel.innerHTML = html;

        if (!this._saveSlotPanelListenerAdded) {
            this._saveSlotPanelListenerAdded = true;
            this._listen(this.elements.saveSlotPanel, 'click', (e) => {
                const saveBtn = e.target.closest('.slot-save-btn[data-slot-save-key]');
                if (saveBtn) {
                    const key = saveBtn.dataset.slotSaveKey;
                    const nameInput = this.elements.saveSlotPanel.querySelector(`[data-slot-name-key="${key}"]`);
                    const label = nameInput?.value.trim() || '';
                    this.game.saveToSlot(key, label ? { label } : {}).then(() => this.updateSaveSlotPanel());
                    return;
                }
                const exportBtnEl = e.target.closest('.slot-export-btn[data-slot-export-key]');
                if (exportBtnEl && !exportBtnEl.disabled) {
                    exportSlot(exportBtnEl.dataset.slotExportKey);
                    return;
                }
                const loadBtnEl = e.target.closest('.slot-load-btn[data-slot-load-key]');
                if (loadBtnEl && !loadBtnEl.disabled) {
                    const key = loadBtnEl.dataset.slotLoadKey;
                    this.toggleSaveSlotPanel();
                    this.game.loadFromSlot(key);
                }
            });
        }
    }

    populateSkinDropdown() {
        const el = document.getElementById('set-skin');
        if (!el) return;
        const skinNames = this.game.skinManager.getSkinNames();
        el.innerHTML = '';
        for (const name of skinNames) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name === 'ascii' ? t('ui.settings.skin_ascii') : name.charAt(0).toUpperCase() + name.slice(1);
            opt.selected = this.game.settings.activeSkin === name;
            el.appendChild(opt);
        }
    }

    updateSettingsPanel() {
        const s = this.game.settings;
        if (!this._settingsTab) this._settingsTab = 'general';
        const tab = this._settingsTab;
        let html = `<div class="panel-close" data-panel-close="settings">&times;</div><h3>${escapeHtml(t('ui.settings.title'))}</h3>`;

        // Tab bar (General / Graphics / Controls)
        const tabs = [['general', t('ui.settings.tab_general')], ['graphics', t('ui.settings.tab_graphics')], ['controls', t('ui.settings.tab_controls')]];
        html += `<div class="settings-tabs" style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #444;">`;
        for (const [key, label] of tabs) {
            const active = tab === key;
            html += `<button onclick="window.game.ui._setSettingsTab('${key}')" class="settings-tab-btn${active ? ' active' : ''}" style="flex:1;padding:5px 8px;background:${active ? '#2a2a4e' : '#16162a'};color:${active ? '#ffcc00' : '#999'};border:1px solid #444;border-bottom:none;border-radius:4px 4px 0 0;cursor:pointer;font-family:inherit;font-size:inherit;">${escapeHtml(label)}</button>`;
        }
        html += `</div>`;

        // ===== GENERAL TAB =====
        let general = '';
        // Language applies on restart (boot.js loads the table once). Unlike the
        // start screen there is no restart button here: it would drop unsaved progress.
        general += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.language_title'))}</div>`;
        general += `<div class="settings-row"><label for="set-language">${escapeHtml(t('ui.settings.language'))}</label><select id="set-language" onchange="window.setGameLanguage(this.value);window.game.ui.updateSettingsPanel()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        const chosenLanguage = s.language || getLanguage();
        for (const lang of getAvailableLanguages()) {
            general += `<option value="${escapeAttr(lang.code)}"${lang.code === chosenLanguage ? ' selected' : ''}>${escapeHtml(lang.label)}</option>`;
        }
        general += `</select></div>`;
        if (chosenLanguage !== getLanguage()) general += `<div style="color:#aaa;font-size:11px;">${escapeHtml(t('ui.settings.language_restart_note'))}</div>`;
        general += `</div>`;
        general += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_save'))}</div>`;
        const primarySlot = this.game.settings.primarySaveSlot;
        const primaryLabel = primarySlot ? t('ui.settings.slot_n', { n: parseInt(primarySlot.slice(-1)) + 1 }) : t('ui.settings.active_slot_none');
        general += `<div style="color:#aaa;font-size:11px;margin-bottom:6px;">${escapeHtml(t('ui.settings.active_slot_label'))} <span style="color:${primarySlot ? '#ffcc00' : '#666'}">${escapeHtml(primaryLabel)}</span></div>`;
        general += `<div class="settings-row" style="gap:8px;">`;
        general += `<button onclick="window.game.save()" class="settings-btn settings-btn-green"${primarySlot ? '' : ` title="${escapeAttr(t('ui.settings.no_active_slot'))}"`}>${escapeHtml(t('ui.settings.save_game'))}</button>`;
        general += `<button onclick="window.game.exportSave()" class="settings-btn settings-btn-blue">${escapeHtml(t('ui.settings.export_save'))}</button>`;
        general += `<button onclick="window.game.toggleSaveSlotPanel()" class="settings-btn">${escapeHtml(t('ui.settings.save_to_slot'))}</button>`;
        general += `</div></div>`;

        {
            general += `<div class="settings-section" id="gdrive-settings-section">`;
            general += `<div class="settings-section-title">${escapeHtml(t('ui.settings.cloud_title'))}</div>`;
            general += `<div id="gdrive-status-row" style="min-height:28px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`;
            general += `<span id="gdrive-status-label" style="color:#aaa;font-size:11px;">${escapeHtml(t('ui.settings.cloud_checking'))}</span>`;
            general += `</div>`;
            general += `<div style="font-size:10px;color:#888;margin-top:4px;"><a href="privacy.html" target="_blank" rel="noopener" style="color:#bb99dd;">${escapeHtml(t('ui.settings.privacy_policy'))}</a> &#183; <a href="terms.html" target="_blank" rel="noopener" style="color:#bb99dd;">${escapeHtml(t('ui.settings.terms'))}</a></div>`;
            general += `</div>`;
        }

        general += `<div class="settings-section"><button onclick="window.game.showGlossary()" class="settings-btn settings-btn-purple">${escapeHtml(t('ui.settings.view_glossary'))}</button></div>`;

        // ===== GRAPHICS TAB =====
        let graphics = '';
        graphics += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_visual'))}</div>`;
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-skin">${escapeHtml(t('ui.settings.tile_skin'))}</label>`;
        graphics += `<select id="set-skin" onchange="window.game.switchSkin(this.value)" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        const skinNames = this.game.skinManager.getSkinNames();
        for (const name of skinNames) {
            const display = name === 'ascii' ? t('ui.settings.skin_ascii') : name.charAt(0).toUpperCase() + name.slice(1);
            graphics += `<option value="${escapeAttr(name)}" ${s.activeSkin === name ? 'selected' : ''}>${escapeHtml(display)}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-names">${escapeHtml(t('ui.settings.colonist_names'))}</label>`;
        graphics += `<select id="set-names" onchange="window.game.settings.showColonistNames=this.value" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        for (const [val, label] of [['off', t('ui.settings.names_off')], ['selected', t('ui.settings.names_selected')], ['always', t('ui.settings.names_always')]]) {
            graphics += `<option value="${val}" ${s.showColonistNames === val ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }
        graphics += `</select></div>`;
        const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1;
        const [scaleSmall, scaleMedium, scaleLarge] = [t('ui.settings.font_small'), t('ui.settings.font_medium'), t('ui.settings.font_large')];
        const uiScaleLabel = uiScale <= 0.8 ? scaleSmall : uiScale >= 1.2 ? scaleLarge : scaleMedium;
        graphics += `<div class="settings-row">`;
        graphics += `<label for="set-ui-font-size">${escapeHtml(t('ui.settings.ui_font_size'))} <span id="ui-font-size-val">${escapeHtml(uiScaleLabel)}</span></label>`;
        graphics += `<input type="range" id="set-ui-font-size" min="0.75" max="1.4" step="0.05" value="${uiScale}" style="width:80px" oninput="const lbl=this.value<=0.8?${jsArg(scaleSmall)}:this.value>=1.2?${jsArg(scaleLarge)}:${jsArg(scaleMedium)};document.getElementById('ui-font-size-val').textContent=lbl;window.setUIFontScale(this.value);window.game.settings.uiFontScale=parseFloat(this.value);window.game.saveSettingsToStorage()">`;
        graphics += `</div>`;
        graphics += `<div class="settings-row"><label for="set-temp-unit">${escapeHtml(t('ui.settings.temp_unit'))}</label><select id="set-temp-unit" onchange="window.game.settings.temperatureUnit=this.value" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['F', t('ui.settings.temp_f')], ['C', t('ui.settings.temp_c')]]) {
            graphics += `<option value="${val}"${s.temperatureUnit === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `</div>`;

        general += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_audio'))}</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-music-vol">${escapeHtml(t('ui.settings.music_volume'))} <span id="music-vol-val">${s.musicVolume}</span></label>`;
        general += `<input type="range" id="set-music-vol" min="0" max="100" value="${s.musicVolume}" style="width:80px" oninput="document.getElementById('music-vol-val').textContent=this.value;window.game.settings.musicVolume=parseInt(this.value);if(window.soundManager)window.soundManager.setMusicVolume(parseInt(this.value))">`;
        general += `</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-sfx-vol">${escapeHtml(t('ui.settings.sfx_volume'))} <span id="sfx-vol-val">${s.sfxVolume}</span></label>`;
        general += `<input type="range" id="set-sfx-vol" min="0" max="100" value="${s.sfxVolume}" style="width:80px" oninput="document.getElementById('sfx-vol-val').textContent=this.value;window.game.settings.sfxVolume=parseInt(this.value);if(window.soundManager)window.soundManager.setSFXVolume(parseInt(this.value))">`;
        general += `</div></div>`;

        general += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_gameplay'))}</div>`;
        general += `<div class="settings-row" style="gap:4px;">`;
        general += `<label>${escapeHtml(t('ui.craft.autocook_label'))}</label>`;
        general += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)-10)" style="padding:1px 5px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;">-10</button>`;
        general += `<input type="number" min="0" max="200" value="${s.autoCookTarget||0}" onchange="window.game.setAutoCookTarget(parseInt(this.value)||0)" style="width:42px;text-align:center;background:#1a1a2e;color:#88cc88;border:1px solid #555;border-radius:3px;padding:1px;">`;
        general += `<button onclick="window.game.setAutoCookTarget((window.game.settings.autoCookTarget||0)+10)" style="padding:1px 5px;background:#2a2a3e;color:#ccc;border:1px solid #555;border-radius:3px;">+10</button>`;
        general += `</div>`;
        general += `<div class="settings-row">`;
        general += `<label for="set-autosave">${escapeHtml(t('ui.settings.autosave'))}</label>`;
        general += `<select id="set-autosave" onchange="window.game.settings.autoSaveInterval=parseInt(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        for (const [val, label] of [[0, t('ui.settings.autosave_off')], [12, t('ui.settings.autosave_hours', { n: 12 })], [24, t('ui.settings.autosave_hours', { n: 24 })], [48, t('ui.settings.autosave_hours', { n: 48 })]]) {
            general += `<option value="${val}" ${s.autoSaveInterval === val ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }
        general += `</select></div>`;
        general += this._settingsCheck('set-pause-hostile', s.autoPauseHostile, 'window.game.settings.autoPauseHostile=this.checked', t('ui.settings.opt_pause_hostile'));
        general += this._settingsCheck('set-pause-event', s.autoPauseEvent, 'window.game.settings.autoPauseEvent=this.checked', t('ui.settings.opt_pause_event'));
        general += this._settingsCheck('set-pause-caravan', s.autoPauseCaravan, 'window.game.settings.autoPauseCaravan=this.checked', t('ui.settings.opt_pause_caravan'));
        general += this._settingsCheck('set-pause-death', s.pauseOnDeath, 'window.game.settings.pauseOnDeath=this.checked', t('ui.settings.opt_pause_death'));
        general += this._settingsCheck('set-pause-low-health', s.pauseOnLowHealth, 'window.game.settings.pauseOnLowHealth=this.checked', t('ui.settings.opt_pause_low_health'));
        general += this._settingsCheck('set-pause-research', s.pauseOnResearch, 'window.game.settings.pauseOnResearch=this.checked', t('ui.settings.opt_pause_research'));
        general += this._settingsCheck('set-peaceful', CONFIG.PEACEFUL_MODE, 'window.game.togglePeaceful()', t('ui.settings.opt_peaceful'));
        general += this._settingsCheck('set-tutorial', s.showTutorial, 'window.game.settings.showTutorial=this.checked;window.game.saveSettingsToStorage();window.game.ui.updateTutorialNote(window.game)', t('ui.settings.opt_tutorial'));
        const tutLevel = this.game.tutorial.level;
        general += `<div class="settings-row"><label for="set-tutorial-level">${escapeHtml(t('ui.settings.tutorial_style'))}</label><select id="set-tutorial-level" onchange="window.game.tutorial.changeLevel(window.game,this.value)" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`
            + [['none', t('ui.settings.tutorial_none')], ['some', t('ui.settings.tutorial_some')], ['veteran', t('ui.settings.tutorial_veteran')]]
                .map(([v, label]) => `<option value="${v}"${tutLevel === v ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')
            + `</select></div>`;
        general += this._settingsCheck('set-tutorial-arrows', s.showTutorialArrows !== false, 'window.game.settings.showTutorialArrows=this.checked;window.game.saveSettingsToStorage()', t('ui.settings.opt_tutorial_arrows'));
        general += `</div>`;

        general += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_accessibility'))}</div>`;
        general += this._settingsCheck('set-darken-pause', s.darkenOnPause, 'window.game.settings.darkenOnPause=this.checked;if(window.game.paused)document.getElementById("game").classList.toggle("paused",this.checked)', t('ui.settings.opt_darken_pause'));
        general += this._settingsCheck('set-pause-focus', s.pauseOnFocusLoss, 'window.game.settings.pauseOnFocusLoss=this.checked', t('ui.settings.opt_pause_focus'));
        general += this._settingsCheck('set-haptics', s.haptics !== false, 'window.game.settings.haptics=this.checked', t('ui.settings.opt_haptics'));
        if (navigator.wakeLock) general += this._settingsCheck('set-keep-awake', s.keepScreenAwake, 'window.game.settings.keepScreenAwake=this.checked;window.game._syncWakeLock()', t('ui.settings.opt_keep_awake'));
        general += `<div class="settings-row"><label for="set-toolbar-mode">${escapeHtml(t('ui.settings.toolbar_mode'))}</label><select id="set-toolbar-mode" onchange="window.game.settings.toolbarMode=this.value;const tb=document.getElementById('touch-toolbar');if(this.value==='always')tb.style.display='flex';else if(this.value==='never')tb.style.display='none';else tb.style.display='';window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['auto', t('ui.settings.toolbar_auto')], ['always', t('ui.settings.toolbar_always')], ['never', t('ui.settings.toolbar_never')]]) {
            general += `<option value="${val}"${(s.toolbarMode || 'auto') === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-layout-mode">${escapeHtml(t('ui.settings.layout_mode'))}</label><select id="set-layout-mode" onchange="window.game.setLayoutMode(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['auto', t('ui.settings.layout_auto')], ['separate', t('ui.settings.layout_separate')], ['tabbed', t('ui.settings.layout_tabbed')]]) {
            general += `<option value="${val}"${s.layoutMode === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-notif-dur">${escapeHtml(t('ui.settings.notif_duration'))}</label><select id="set-notif-dur" onchange="window.game.settings.notificationDuration=parseInt(this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['50', t('ui.settings.notif_short')], ['100', t('ui.settings.notif_normal')], ['200', t('ui.settings.notif_long')], ['500', t('ui.settings.notif_persistent')]]) {
            general += `<option value="${val}"${s.notificationDuration === parseInt(val) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        general += `</select></div>`;
        general += `<div class="settings-row"><label for="set-colorblind">${escapeHtml(t('ui.settings.colorblind'))}</label><select id="set-colorblind" onchange="window.game.settings.colorblindMode=this.value;document.getElementById('game-container').setAttribute('data-colorblind',this.value);window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['none', t('common.none')], ['protanopia', t('ui.settings.colorblind_protanopia')], ['deuteranopia', t('ui.settings.colorblind_deuteranopia')], ['tritanopia', t('ui.settings.colorblind_tritanopia')]]) {
            general += `<option value="${val}"${s.colorblindMode === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        general += `</select></div>`;
        general += this._settingsCheck('set-colonist-highlight', s.showColonistHighlight, 'window.game.settings.showColonistHighlight=this.checked;window.game.renderer?.skinManager?._compositeCache.clear()', t('ui.settings.opt_colonist_highlight'));
        general += this._settingsCheck('set-large-clicks', s.largeClickTargets, 'window.game.settings.largeClickTargets=this.checked;document.getElementById("game-container").classList.toggle("large-targets",this.checked)', t('ui.settings.opt_large_clicks'));
        graphics += `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.section_effects'))}</div>`;
        graphics += this._settingsCheck('set-overlays', s.showOverlays, 'window.game.ui._toggleAllEffects(this.checked)', t('ui.settings.opt_overlays'));
        graphics += this._settingsCheck('set-night', s.showNightLighting, 'window.game.settings.showNightLighting=this.checked', t('ui.settings.opt_night'));
        graphics += this._settingsCheck('set-weather', s.showWeatherParticles, 'window.game.settings.showWeatherParticles=this.checked', t('ui.settings.opt_weather'));
        graphics += `<div class="settings-row"><label for="set-particle-density">${escapeHtml(t('ui.settings.particle_density'))} <span id="particle-density-val">${s.particleDensity || 100}%</span></label>`;
        graphics += `<input type="range" id="set-particle-density" min="10" max="100" step="10" value="${s.particleDensity || 100}" style="width:80px" oninput="document.getElementById('particle-density-val').textContent=this.value+'%';window.game.settings.particleDensity=parseInt(this.value);window.game.saveSettingsToStorage()">`;
        graphics += `</div>`;
        graphics += this._settingsCheck('set-damage-flash', s.showDamageFlash, 'window.game.settings.showDamageFlash=this.checked', t('ui.settings.opt_damage_flash'));
        graphics += this._settingsCheck('set-screen-shake', s.enableScreenShake, 'window.game.settings.enableScreenShake=this.checked', t('ui.settings.opt_screen_shake'));
        graphics += this._settingsCheck('set-combat-particles', s.showCombatParticles, 'window.game.settings.showCombatParticles=this.checked', t('ui.settings.opt_combat_particles'));
        graphics += this._settingsCheck('set-projectiles', s.showProjectiles, 'window.game.settings.showProjectiles=this.checked', t('ui.settings.opt_projectiles'));
        graphics += this._settingsCheck('set-equip-overlays', s.showEquipmentOverlays, 'window.game.settings.showEquipmentOverlays=this.checked;window.game.renderer?.skinManager?._compositeCache.clear()', t('ui.settings.opt_equip_overlays'));
        graphics += this._settingsCheck('set-progress-bars', s.showProgressBars, 'window.game.settings.showProgressBars=this.checked', t('ui.settings.opt_progress_bars'));
        graphics += this._settingsCheck('set-portal-path', s.showPortalPath, 'window.game.settings.showPortalPath=this.checked', t('ui.settings.opt_portal_path'));
        graphics += this._settingsCheck('set-breathing', s.showBreathing, 'window.game.settings.showBreathing=this.checked', t('ui.settings.opt_breathing'));
        graphics += this._settingsCheck('set-walk-sway', s.showWalkSway, 'window.game.settings.showWalkSway=this.checked', t('ui.settings.opt_walk_sway'));
        graphics += this._settingsCheck('set-attack-swing', s.showAttackSwing, 'window.game.settings.showAttackSwing=this.checked', t('ui.settings.opt_attack_swing'));
        graphics += this._settingsCheck('set-action-anims', s.showActionAnimations, 'window.game.settings.showActionAnimations=this.checked', t('ui.settings.opt_action_anims'));
        graphics += this._settingsCheck('set-tree-sway', s.showTreeSway, 'window.game.settings.showTreeSway=this.checked', t('ui.settings.opt_tree_sway'));
        graphics += this._settingsCheck('set-terrain-detail', s.showTerrainDetail, 'window.game.settings.showTerrainDetail=this.checked', t('ui.settings.opt_terrain_detail'));
        graphics += this._settingsCheck('set-expedition-extras', s.showExpeditionExtras, 'window.game.settings.showExpeditionExtras=this.checked', t('ui.settings.opt_expedition_extras'));
        graphics += this._settingsCheck('set-reduce-motion', s.reduceMotion, 'window.game.settings.reduceMotion=this.checked', t('ui.settings.opt_reduce_motion'));
        graphics += this._settingsCheck('set-minimap', s.showMinimap, 'window.game.settings.showMinimap=this.checked;document.getElementById("minimap-container").style.display=this.checked?"":"none"', t('ui.settings.opt_minimap'));
        graphics += `<div class="settings-row"><label for="set-dither-dist">${escapeHtml(t('ui.settings.dither_distance'))}</label><select id="set-dither-dist" onchange="window.game.settings.ditherDistance=this.value;window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['none', t('ui.settings.dither_off')], ['minimal', t('ui.settings.dither_minimal')], ['light', t('ui.settings.dither_light')], ['normal', t('ui.settings.dither_normal')], ['heavy', t('ui.settings.dither_heavy')], ['extreme', t('ui.settings.dither_extreme')]]) {
            graphics += `<option value="${val}"${(s.ditherDistance || 'light') === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        graphics += `</select></div>`;
        graphics += `<div class="settings-row"><label for="set-dither-qual">${escapeHtml(t('ui.settings.dither_quality'))}</label><select id="set-dither-qual" onchange="window.game.settings.ditherQuality=this.value;window.game.saveSettingsToStorage()" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">`;
        for (const [val, label] of [['chunky', t('ui.settings.dither_chunky')], ['low', t('ui.settings.dither_low')], ['medium', t('ui.settings.dither_medium')], ['high', t('ui.settings.dither_high')]]) {
            graphics += `<option value="${val}"${(s.ditherQuality || 'medium') === val ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }
        graphics += `</select></div>`;
        graphics += this._settingsCheck('set-fullscreen', s.enableFullscreen, 'window.game.settings.enableFullscreen=this.checked;if(window.electronAPI?.setFullscreen){window.electronAPI.setFullscreen(this.checked)}else if(this.checked){document.documentElement.requestFullscreen().catch(()=>{})}else if(document.fullscreenElement){document.exitFullscreen().catch(()=>{})}', t('ui.settings.opt_fullscreen'));
        graphics += this._settingsCheck('set-fps', s.showFps, 'window.game.settings.showFps=this.checked', t('ui.settings.opt_fps'));
        graphics += this._settingsCheck('set-fps-cap', s.fpsCap === 30, 'window.game.settings.fpsCap=this.checked?30:60', t('ui.settings.opt_fps_cap'));
        graphics += this._settingsCheck('set-crt-scanlines', s.showCrtScanlines, 'window.game.settings.showCrtScanlines=this.checked;if(window.game.renderer?.crtRenderer)window.game.renderer.crtRenderer._scanlinePattern=null;window.game.saveSettingsToStorage()', t('ui.settings.opt_crt_scanlines'));
        graphics += this._settingsCheck('set-crt-warp', s.showCrtWarp, 'window.game.settings.showCrtWarp=this.checked;document.getElementById("game-area")?.classList.toggle("crt-warp",this.checked);window.game.saveSettingsToStorage()', t('ui.settings.opt_crt_warp'));
        graphics += `</div>`;

        // ===== CONTROLS TAB =====
        let controls = this._keybindingsSectionHtml();

        if (!this.game.settings.demoMode) {
        general += `<details class="settings-section settings-debug"><summary class="settings-section-title" style="color:#ff6666;cursor:pointer;list-style:revert;">${escapeHtml(t('ui.settings.debug_title'))}</summary>`;
        general += `<button onclick="if(confirm(${jsArg(t('ui.settings.debug_confirm_1'))}))window.game.cheatResources()" class="settings-btn settings-btn-danger" style="margin-top:8px;">${escapeHtml(t('ui.settings.debug_grant_999_resources'))}</button>`;
        general += `<button onclick="if(confirm(${jsArg(t('ui.settings.debug_confirm_2'))}))window.game.cheatGrantResearch()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_grant_all_research'))}</button>`;
        general += `<button onclick="if(confirm(${jsArg(t('ui.settings.debug_confirm_3'))}))window.game.cheatGrantStarterSpells()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_grant_all_starter_spells_magic_lvl_1'))}</button>`;
        general += `<button onclick="if(confirm(${jsArg(t('ui.settings.debug_confirm_4'))}))window.game.cheatGrantAllSpells()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_grant_all_spells_magic_lvl_8'))}</button>`;
        general += `<button onclick="if(confirm(${jsArg(t('ui.settings.debug_confirm_5'))}))window.game.cheatGrantAdventurerLv10()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_set_adventurer_lv10'))}</button>`;
        general += `<button onclick="window.game.cheatSpawnColonist()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_grant_new_colonist'))}</button>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-trinket-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(TRINKETS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('trinket',document.getElementById('debug-trinket-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_trinket'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-boots-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(BOOTS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('boots',document.getElementById('debug-boots-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_boots'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-weapon-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(WEAPONS)) {
            if (key === 'fists') continue;
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('weapon',document.getElementById('debug-weapon-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_weapon'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-armor-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(ARMORS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('armor',document.getElementById('debug-armor-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_armor'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-tool-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(TOOLS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('tool',document.getElementById('debug-tool-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_tool'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:4px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-helmet-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(HELMETS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('helmet',document.getElementById('debug-helmet-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_helmet'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-clothes-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(CLOTHES)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatSpawnItem('clothes',document.getElementById('debug-clothes-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_clothes'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-resource-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:80px;">`;
        for (const key of Object.keys(this.game.resources.stockpile)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(resourceName(key))}</option>`;
        }
        general += `</select>`;
        general += `<input id="debug-resource-amount" type="number" value="50" min="1" max="999" style="width:50px;background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        general += `<button onclick="window.game.cheatAddResource(document.getElementById('debug-resource-select').value, parseInt(document.getElementById('debug-resource-amount').value)||50)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_grant_resource'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-event-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const key of Object.keys(EVENTS)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(EVENTS[key]?.name || key.replace(/_/g, ' '))}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatTriggerEvent(document.getElementById('debug-event-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_trigger_event'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<select id="debug-raid-select" style="background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;flex:1;min-width:120px;">`;
        for (const [key, def] of Object.entries(RAID_TYPES)) {
            general += `<option value="${escapeAttr(key)}">${escapeHtml(def.name)}</option>`;
        }
        general += `</select>`;
        general += `<button onclick="window.game.cheatTriggerRaid(document.getElementById('debug-raid-select').value)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_trigger_raid'))}</button>`;
        general += `</div>`;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;flex-wrap:wrap;">`;
        general += `<input id="debug-time-amount" type="number" value="300" min="1" max="9999" style="width:60px;background:#1a1a2e;color:#ccc;border:1px solid #444;padding:2px 4px;">`;
        general += `<button onclick="window.game.cheatAdvanceTime(parseInt(document.getElementById('debug-time-amount').value)||300)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_advance_ticks'))}</button>`;
        general += `<span style="color:#666;font-size:10px;">${escapeHtml(t('ui.settings.debug_ticks_note'))}</span>`;
        general += `</div>`;
        if (window.trailerDirectorAvailable) general += `<button onclick="window.toggleTrailerDirector?.()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_toggle_trailer_director'))}</button>`;
        general += `<button onclick="window.game.cheatUnlockAllStory()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_unlock_all_story_milestones'))}</button>`;
        general += `<button onclick="window.game.cheatUnlockAllBestiary()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.debug_unlock_all_bestiary_entries'))}</button>`;
        const curMax = this.game.debugMaxSpeed || 3;
        general += `<div class="settings-row" style="margin-top:8px;gap:4px;align-items:center;">`;
        general += `<label for="debug-max-speed">${escapeHtml(t('ui.settings.debug_max_speed'))}</label>`;
        general += `<input id="debug-max-speed" type="number" min="1" max="10" value="${curMax}" style="width:42px;background:#1a1a2e;color:#ffaaaa;border:1px solid #555;border-radius:3px;padding:1px;text-align:center;">`;
        general += `<button onclick="window.game.setDebugMaxSpeed(parseInt(document.getElementById('debug-max-speed').value)||3)" class="settings-btn settings-btn-danger" style="white-space:nowrap;">${escapeHtml(t('ui.settings.debug_set_max_speed'))}</button>`;
        general += `<span style="color:#666;font-size:10px;">${escapeHtml(t('ui.settings.debug_speed_note'))}</span>`;
        general += `</div>`;
        general += `</details>`;
        }

        general += `<div class="settings-section" style="text-align:center;"><button onclick="if(confirm(${jsArg(t('ui.settings.reset_confirm'))}))window.game.resetAllSettings()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.reset_all'))}</button></div>`;

        html += tab === 'graphics' ? graphics : tab === 'controls' ? controls : general;
        this.elements.settingsPanel.innerHTML = html;
        if (tab === 'general' || !tab) this._updateGdriveStatus();
    }

    async _updateGdriveStatus() {
        const row = document.getElementById('gdrive-status-row');
        if (!row) return;
        const api = getGdriveAPI();
        const connected = await api.enabled().catch(() => false);
        if (connected) {
            const ts = getLastSyncTime();
            const syncLabel = ts ? new Date(ts).toLocaleString() : t('ui.settings.cloud_never');
            row.innerHTML = `<span style="color:#66ff99;font-size:11px;">&#10003; ${escapeHtml(t('ui.settings.cloud_connected'))}</span><span style="color:#888;font-size:10px;">${escapeHtml(t('ui.settings.cloud_auto_sync'))}</span><span id="gdrive-last-sync-label" style="color:#aaa;font-size:10px;flex:1;">${escapeHtml(t('ui.settings.cloud_last_synced', { time: syncLabel }))}</span><button id="gdrive-sync-now-btn" onclick="window.game.ui._forceSyncNow()" class="settings-btn settings-btn-blue" style="padding:2px 8px;font-size:11px;">${escapeHtml(t('ui.settings.cloud_sync_now'))}</button><button onclick="window.game.ui._disconnectGdrive()" class="settings-btn settings-btn-danger" style="padding:2px 8px;font-size:11px;">${escapeHtml(t('ui.settings.cloud_disconnect'))}</button>`;
        } else {
            row.innerHTML = `<span style="color:#aaa;font-size:11px;flex:1;">${escapeHtml(t('ui.settings.cloud_not_connected'))}</span><button onclick="window.game.ui._connectGdrive()" class="settings-btn settings-btn-blue" style="padding:2px 8px;font-size:11px;">${escapeHtml(t('ui.settings.cloud_connect'))}</button>`;
        }
    }

    async _connectGdrive() {
        const row = document.getElementById('gdrive-status-row');
        if (row) row.innerHTML = `<span style="color:#ffcc00;font-size:11px;">${escapeHtml(t('ui.settings.cloud_opening'))}</span>`;
        try {
            await getGdriveAPI().beginAuth();
            this._updateGdriveStatus();
        } catch (e) {
            if (row) row.innerHTML = `<span style="color:#ff6666;font-size:11px;">${escapeHtml(t('ui.settings.cloud_failed'))}</span><button onclick="window.game.ui._connectGdrive()" class="settings-btn settings-btn-blue" style="padding:2px 8px;font-size:11px;">${escapeHtml(t('ui.settings.cloud_retry'))}</button>`;
        }
    }

    async _disconnectGdrive() {
        if (!confirm(t('ui.settings.cloud_disconnect_confirm'))) return;
        await getGdriveAPI().revoke().catch(() => {});
        this._updateGdriveStatus();
    }

    async _forceSyncNow() {
        const label = document.getElementById('gdrive-last-sync-label');
        const btn = document.getElementById('gdrive-sync-now-btn');
        if (label) label.textContent = t('ui.settings.cloud_syncing');
        if (btn) btn.disabled = true;
        try {
            await forceSyncNow();
        } catch {
            // _updateGdriveStatus below will show current stored timestamp
        }
        await this._updateGdriveStatus();
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
        let html = `<div class="settings-section"><div class="settings-section-title">${escapeHtml(t('ui.settings.controls_title'))}</div>`;
        html += keybindingRowsHtml('window.game.ui._startRebind', 'window.game.ui._resetRebind');
        html += `<div class="settings-row" style="margin-top:6px;"><button onclick="window.game.resetKeyBindings()" class="settings-btn settings-btn-danger">${escapeHtml(t('ui.settings.reset_keybinds'))}</button></div>`;
        html += `</div>`;
        html += `<div class="settings-section">`;
        html += `<div class="settings-section-title">${escapeHtml(t('ui.settings.recording_title'))}</div>`;
        html += `<div style="opacity:0.7;font-size:0.85em;margin-bottom:6px;">${tHtml('ui.settings.recording_note_html')}</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:0.9em;">`;
        const rows = [
            ['T', t('ui.settings.rec_timelapse')],
            ['C', t('ui.settings.rec_cinematic')],
            ['G', t('ui.settings.rec_equip_next')],
            ['H', t('ui.settings.rec_ghosts')],
            ['V', t('ui.settings.rec_expedition')],
            [', / .', t('ui.settings.rec_speed')],
        ];
        for (const [key, desc] of rows) {
            html += `<tr><td style="padding:3px 8px 3px 0;white-space:nowrap;"><kbd style="background:#333;padding:1px 5px;border-radius:3px;color:#ffcc00;">${key}</kbd></td><td style="padding:3px 0;opacity:0.85;">${escapeHtml(desc)}</td></tr>`;
        }
        html += `</table>`;
        html += `</div>`;
        return html;
    }

    // Capture the next keypress and assign it to the given action, then re-apply
    // to the live InputHandler and re-render. A second click cancels a pending
    // capture. Reserved structural keys are rejected with a notification.
    _startRebind(action, btn) {
        beginRebindCapture(
            action, btn,
            (_action, key, keys, conflicts) => {
                // Store the full list (setKeyBinding keeps only the new key, which
                // would drop the action's secondary keys), then re-apply live.
                const s = this.game.settings;
                if (!s.keyBindings) s.keyBindings = {};
                s.keyBindings[action] = keys;
                this.game.saveSettingsToStorage();
                this.game.input.applyKeyBindings();
                this.updateSettingsPanel();
                if (conflicts.length) {
                    this.game.notifications.push({ text: t('ui.settings.rebind_conflict', { key: formatKeyLabel(key), actions: conflicts.join(', ') }), tick: this.game.tick, type: 'danger' });
                }
            },
            (key) => { this.game.notifications.push({ text: t('ui.settings.rebind_reserved', { key: formatKeyLabel(key) }), tick: this.game.tick, type: 'danger' }); }
        );
    }

    // Revert a single action to its default key and re-apply live + re-render.
    _resetRebind(action) {
        this.game.resetKeyBinding(action);
    }

    _settingsCheck(id, checked, onchange, label) {
        const safeHandler = (onchange + ';window.game.saveSettingsToStorage()').replace(/"/g, '&quot;');
        return `<div class="settings-row"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${safeHandler}"><label for="${id}">${escapeHtml(label)}</label></div>`;
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

    // The tooltip only appears after the cursor rests on one tile for
    // TILE_TOOLTIP_DELAY_MS; moving to another tile hides it and restarts the wait.
    updateTileTooltip(x, y, e) {
        const tooltip = document.getElementById('tile-tooltip');
        const pos = { left: (e.offsetX + 12) + 'px', top: (e.offsetY - 24) + 'px' };
        if (this._tipTile?.x === x && this._tipTile?.y === y) {
            // Same tile: follow the cursor if already visible, else keep waiting.
            this._tipPos = pos;
            if (tooltip.style.display === 'block') {
                tooltip.style.left = pos.left;
                tooltip.style.top = pos.top;
            }
            return;
        }
        this.hideTileTooltip();
        this._tipTile = { x, y };
        this._tipPos = pos;
        this._tipTimer = setTimeout(() => {
            this._tipTimer = null;
            this._showTileTooltip(x, y);
        }, TILE_TOOLTIP_DELAY_MS);
    }

    _showTileTooltip(x, y) {
        const tooltip = document.getElementById('tile-tooltip');
        const tile = this.game.map[y][x];
        const parts = [tile.sealed ? t('ui.tile.tip_unexplored', { x, y }) : t('ui.tile.tip_terrain', { x, y, terrain: terrainName(tile.terrain) })];
        if (tile.structure && !tile.sealed) parts.push(t('ui.tile.tip_structure', { name: buildingName(tile.structure) }));
        if (tile.resource) parts.push(tile.resource.amount > 1
            ? t('ui.tile.tip_resource_amount', { name: resourceName(tile.resource.type), n: tile.resource.amount })
            : t('ui.tile.tip_resource', { name: resourceName(tile.resource.type) }));
        if (tile.designation) {
            const task = this.game.taskQueue.getAllByPosition(x, y).find(tk => tk.type === tile.designation.type);
            const desNames = {
                build: t('ui.tile.des_build'), chop: t('ui.tile.des_chop'), mine: t('ui.tile.des_mine'),
                deconstruct: t('ui.tile.des_deconstruct'), loot_chest: t('ui.tile.des_loot_chest'), attune_anchor: t('ui.tile.des_attune_anchor'),
            };
            const des = desNames[tile.designation.type] || tile.designation.type;
            parts.push(task?.doFirst ? t('ui.tile.tip_designation_first', { des })
                : t(isTouchUI() ? 'ui.tile.tip_designation_touch' : 'ui.tile.tip_designation', { des }));
        }
        if (tile.zone) parts.push(t('ui.tile.tip_farm', { crop: CROPS[tile.zone.crop]?.name || resourceName(tile.zone.crop) }));
        const nameMode = this.game.settings.showColonistNames;
        if (nameMode === 'selected' || nameMode === 'always') {
            const colHere = this.game.colonists.find(c => c.x === x && c.y === y && c.hp > 0 && !c.onExpedition);
            if (colHere) parts.push(colHere.name);
        }
        tooltip.textContent = parts.join(' | ');
        tooltip.style.display = 'block';
        tooltip.style.left = this._tipPos.left;
        tooltip.style.top = this._tipPos.top;
    }

    hideTileTooltip() {
        clearTimeout(this._tipTimer);
        this._tipTimer = null;
        this._tipTile = null;
        document.getElementById('tile-tooltip').style.display = 'none';
    }

    isBuildingLocked(buildType) {
        const def = BUILDINGS[buildType];
        return def?.research && !this.game.research.isResearched(def.research);
    }

    isBuildingAtMax(buildType) {
        const def = BUILDINGS[buildType];
        if (!def || def.maxCount === undefined) return false;
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
        // Narrow screens show only the newest toast plus a count, so the stack doesn't
        // cover the map. Everything still lands in the Log tab.
        const compact = isCompactLayout();
        const shown = recent.slice(compact ? -1 : -4);
        const hiddenCount = recent.length - shown.length;
        // `update()` runs every frame, so rebuild the notification DOM only when the
        // visible set actually changes. Otherwise the CSS enter animation would
        // restart every frame and the whole stack would flicker. Each notif has a
        // stable key (tick + text). A signature of the visible keys detects change.
        const sig = shown.map(n => `${n.tick}${n.text}`).join('') + (compact ? `${hiddenCount}` : '');
        if (sig === this._notifSig) return;
        const prevKeys = this._notifKeys || (this._notifKeys = new Set());
        // Reduced motion (item 24): skip the slide-in, render statically.
        const reduceMotion = !!this.game.settings.reduceMotion;
        this.elements.notifications.innerHTML = shown.map((n, i) => {
            const key = `${n.tick}${n.text}`;
            // Only notifs that weren't shown last render get the enter animation.
            const enter = (!reduceMotion && !prevKeys.has(key)) ? ' notif-enter' : '';
            return `<div class="notif notif-${escapeAttr(n.type)}${enter}" data-notif-index="${i}">${escapeHtmlKeepEntities(n.text)}</div>`;
        }).join('') + (compact && hiddenCount > 0 ? `<div class="notif notif-more">${escapeHtml(t('ui.main.notif_more', { n: hiddenCount }))}</div>` : '');
        this._notifKeys = new Set(shown.map(n => `${n.tick}${n.text}`));
        this._notifSig = sig;
        this._notifShown = shown;
    }

    // Where a toast points: its own `linked` entity, else the event-log entry logged with it
    // (same tick, with a location). Most alerts push a toast and a linked log line together.
    _notificationLink(n) {
        if (n.linked) return n.linked;
        const sameTick = this.game.eventLog.entries.filter(e => e.tick === n.tick && e.linkedEntity);
        if (sameTick.length <= 1) return sameTick[0]?.linkedEntity || null;
        const words = (t) => new Set(String(t).replace(/<[^>]+>|&[a-z#0-9]+;/gi, ' ').toLowerCase().split(/\W+/).filter(w => w.length > 2));
        const mine = words(n.text);
        let best = null;
        let bestScore = 0;
        for (const e of sameTick) {
            const score = [...words(logEntryText(e))].filter(w => mine.has(w)).length;
            if (score > bestScore) { bestScore = score; best = e.linkedEntity; }
        }
        return best;
    }

    // Tapping a toast jumps to what it is about. Toasts with nowhere to go open the Log.
    _onNotificationTap(e) {
        const el = e.target.closest('.notif');
        if (!el) return;
        const n = this._notifShown?.[parseInt(el.dataset.notifIndex)];
        const link = n && this._notificationLink(n);
        if (link) {
            this.game.jumpToEntity(link.type, link.type === 'colonist' ? link.id : link);
            return;
        }
        if (isCompactLayout()) document.querySelector('#footer-tabs .footer-tab[data-tab="log"]')?.click();
    }

    updateEventPanel() {
        const evt = this.game.events.pendingEvent;
        if (!evt) {
            if (this._lastEventId) {
                document.body.classList.remove('event-open');
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
        // Lets narrow layouts hide the tutorial card while a prompt needs an answer.
        document.body.classList.add('event-open');
        window.soundManager?.playSFXPitched('open_close_click', 3);
        this.elements.eventPanel.className = evt.type === 'raid' ? 'event-panel-raid' : evt.type === 'void_whisper' ? 'event-panel-void' : '';
        let html = '';
        if (evt.type === 'void_whisper') {
            html += `<div class="event-text">◈ ${escapeHtmlKeepEntities(evt.title)} ◈</div>`;
            const waves = this.game.waves;
            const waveCtx = waves.active
                ? t('ui.panel.whisper_wave_active', { n: waves.currentWave })
                : t('ui.panel.whisper_wave_next', { n: waves.highestWaveCompleted + 1 });
            html += `<div class="void-whisper-context">◈ ${escapeHtml(waveCtx)} ◈</div>`;
            html += `<div style="color:#aa88cc;font-size:0.9em;margin-bottom:6px;">${escapeHtmlKeepEntities(evt.text)}</div>`;
            html += `<div class="void-whisper-body">`;
            html += `<div style="color:#cc66ff;font-size:0.85em;margin-bottom:3px;"><b>${escapeHtml(t('ui.panel.whisper_asks'))}</b> ${escapeHtmlKeepEntities(evt.askText)}</div>`;
            html += `<div style="color:#88ddaa;font-size:0.85em;"><b>${escapeHtml(t('ui.panel.whisper_offers'))}</b> ${escapeHtmlKeepEntities(evt.rewardText)}</div>`;
            html += `</div>`;
        } else {
            html += `<div class="event-text">${escapeHtmlKeepEntities(evt.text)}</div>`;
        }
        html += `<div class="event-choices">`;
        if (evt.type === 'trade') {
            html += `<button onclick="window.game.openTradePanel()">${escapeHtml(t('ui.trade.open'))}</button>`;
            html += `<button onclick="window.game.dismissTrader()">${escapeHtml(t('ui.trade.dismiss'))}</button>`;
        } else {
            evt.choices.forEach((choice, i) => {
                html += `<button onclick="window.game.resolveEvent(${i})">${escapeHtmlKeepEntities(choice)}</button>`;
            });
        }
        html += '</div>';
        this.elements.eventPanel.innerHTML = html;
    }

    _formatResourceName(key) {
        return resourceName(key);
    }

    _tradeResIcon(key) {
        const mgr = this.game.skinManager;
        if (mgr && mgr.isActive) {
            const url = mgr.getItemSpriteDataURL(key);
            if (url) return `<img src="${escapeAttr(url)}" style="width:14px;height:14px;vertical-align:middle;image-rendering:pixelated;margin-right:3px;">`;
        }
        const colors = {
            wood: '#8b6b3a', stone: '#999', food: '#88cc44', planks: '#c89648',
            bricks: '#cc6633', iron_ore: '#887766', runite_ore: '#2aaa88', iron: '#aaa', runite: '#44ccff',
            void_essence: '#9933ff', hides: '#8b7355', leather: '#a0522d',
            meat: '#cc6666', wheat: '#daa520', berries: '#cc4488', corn: '#ccaa22',
            potatoes: '#c8a060', moonbloom: '#cc88ff', eggs: '#eecc88',
            milk: '#eeeedd', wool: '#ddd', gold: '#ffdd00',
        };
        const abbr = {
            wood: 'ui.main.res_abbr_wood', stone: 'ui.main.res_abbr_stone', food: 'ui.main.res_abbr_food', planks: 'ui.main.res_abbr_planks', bricks: 'ui.main.res_abbr_bricks',
            iron_ore: 'ui.main.res_abbr_iron_ore', runite_ore: 'ui.main.res_abbr_runite_ore', iron: 'ui.main.res_abbr_iron', runite: 'ui.main.res_abbr_runite', leather: 'ui.main.res_abbr_leather',
            wool: 'ui.main.res_abbr_wool', void_essence: 'ui.main.res_abbr_void_essence', hides: 'ui.build.cost_abbr_hides', meat: 'ui.trade.abbr_meat', wheat: 'ui.trade.abbr_wheat',
            berries: 'ui.trade.abbr_berries', corn: 'ui.trade.abbr_corn', potatoes: 'ui.trade.abbr_potatoes', moonbloom: 'ui.trade.abbr_moonbloom', eggs: 'ui.trade.abbr_eggs',
            milk: 'ui.trade.abbr_milk', gold: 'ui.main.res_abbr_gold',
        };
        const color = colors[key] || '#aaa';
        const ch = escapeHtml(abbr[key] ? t(abbr[key]) : this._formatResourceName(key).slice(0, 2));
        return `<span style="color:${color};font-weight:bold;margin-right:3px;font-size:0.9em;">${ch}</span>`;
    }

    _getEquipmentTooltip(item) {
        if (!item) return '';
        if (item.type === 'trinket') return this._getTrinketTooltip(item);
        const lines = [];
        const desc = itemDescription(item);
        if (desc) lines.push(desc);
        if (item.type === 'weapon') {
            const cd = item.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
            let statStr = t('ui.colonist.weapon_stats', { dmg: item.damage, dps: (item.damage / cd).toFixed(1), speed: weaponSpeedLabel(cd) });
            if (item.ranged) statStr += t('ui.craft.tip_range', { n: item.range });
            const extras = getItemStatLines({ ...item, damage: undefined, ranged: undefined, range: undefined });
            if (extras.length) statStr += `, ${extras.join(', ')}`;
            const onHit = getOnHitLines(item);
            if (onHit.length) statStr += `, ${onHit.join(', ')}`;
            lines.push(statStr);
        } else {
            const stats = getItemStatLines(item);
            if (stats.length) lines.push(stats.join(', '));
        }
        return lines.join(' | ') || itemName(item);
    }

    _getExclusiveItemTooltip(item) {
        return this._getEquipmentTooltip(item);
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
        html += `<div class="event-text" style="font-size:0.95em;margin:0;">${escapeHtml(data.merchantName || t('ui.trade.caravan'))}</div>`;
        html += `<div class="trade-step-selector">`;
        for (const s of [1, 10, 100]) {
            html += `<button class="trade-step-btn${step === s ? ' active' : ''}" onclick="window.game.ui._tradeStep=${s};window.game.ui._tradeDirty=true;">±${s}</button>`;
        }
        html += `</div></div>`;

        html += `<div class="trade-ratio-bar">${tHtml('ui.trade.ratio_html', { ratio, sell: Math.round(effectiveDiscount * 100), buy: Math.round(effectiveMarkup * 100) })}</div>`;

        const bonuses = [];
        if (this.game.research.isResearched('trade_routes')) bonuses.push(RESEARCH.trade_routes?.name || t('ui.trade.bonus_trade_routes'));
        const artMult = getPedestalEffect(this.game, 'tradeMarkupMult');
        if (artMult < 1) bonuses.push(t('ui.trade.bonus_trinket', { pct: Math.round((1 - artMult) * 100) }));
        if (bonuses.length > 0) {
            html += `<div class="trade-bonuses">${escapeHtml(bonuses.join(' | '))}</div>`;
        }

        html += `<div class="trade-grid">`;

        // Trader sells column
        const goldReqAmt = request.__gold || 0;
        html += `<div class="trade-column">`;
        html += `<div class="trade-column-header sell">${escapeHtml(t('ui.trade.trader_sells'))}</div>`;
        html += `<div class="trade-item-row${goldReqAmt > 0 ? ' selected' : ''}">`;
        html += `<div class="trade-item-name">${this._tradeResIcon('gold')}${escapeHtml(resourceName('gold'))} <span style="color:#888;">×${fmtGold(data.traderGold)}</span>`;
        if (goldReqAmt > 0) html += `<span class="trade-item-badge">${fmtGold(goldReqAmt)}</span>`;
        html += `</div>`;
        html += `<div class="trade-item-value" style="color:#ffdd00;">${escapeHtml(t('ui.trade.gold_value', { n: '1.0' }))}</div>`;
        html += `<div class="trade-item-buttons">`;
        html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRequestGold(-${step})">−</button>`;
        html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeRequestGold(${step})">+</button>`;
        html += `</div></div>`;
        for (const [res, amt] of Object.entries(data.traderResources)) {
            const val = ((TRADE_VALUES[res] || 1) * effectiveMarkup).toFixed(1);
            const reqAmt = request[res] || 0;
            const selected = reqAmt > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon(res)}${escapeHtml(this._formatResourceName(res))} <span style="color:#888;">×${amt}</span>`;
            if (reqAmt > 0) html += `<span class="trade-item-badge">${reqAmt}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: val }))}</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRemoveRequest(${jsArg(res)},${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeRequest(${jsArg(res)},${step})">+</button>`;
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
                // Displayed price matches computeTradeValues: base × markup × tier scaling.
                const exDef = (item?.key && ALL_ITEMS[item.key]) || item;
                const exTierMarkup = TIER_BUY_MARKUP[exDef?.tier || 0] || 1.0;
                const price = Math.round(getItemTradeValue(item) * effectiveMarkup * exTierMarkup);
                const exPitch = request[slotKey] ? -3 : 3;
                html += `<div class="trade-exclusive-row skill-tip" data-tip="${escapeAttr(tip)}">`;
                html += `<div class="trade-item-name">${exIcon}${escapeHtml(itemName(item) || item.key)}</div>`;
                html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: price }))}</div>`;
                html += `<button class="trade-exclusive-toggle${isSelected}" onclick="window.soundManager?.playSFXPitched('button_click',${exPitch});window.game.${request[slotKey] ? 'tradeRemoveRequest' : 'tradeRequest'}('${slotKey}',1)">${escapeHtml(request[slotKey] ? t('ui.trade.remove') : t('ui.trade.buy'))}</button>`;
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
                html += `<div class="trade-item-name">${this._itemIcon(key, 'potion')}${escapeHtml(def ? itemName(def) : key)} <span style="color:#888;">×${amt}</span>`;
                if (reqAmt > 0) html += `<span class="trade-item-badge">${reqAmt}</span>`;
                html += `</div>`;
                html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: val }))}</div>`;
                html += `<div class="trade-item-buttons">`;
                html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRemoveRequest(${jsArg(reqKey)},${step})">−</button>`;
                html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeRequest(${jsArg(reqKey)},${step})">+</button>`;
                html += `</div></div>`;
            }
        }
        html += `<div style="height:12px;"></div></div>`;

        // You offer column - sorted by value descending
        // Exclude resources in the merchant's pool (they don't buy what they sell)
        const merchantResourcePool = data.merchantResourcePool ? new Set(data.merchantResourcePool) : null;
        const tradableStock = Object.entries(stock)
            .filter(([res, amt]) => typeof amt === 'number' && amt > 0 && !res.startsWith('_') && res !== 'gold' && TRADE_VALUES[res] && (!merchantResourcePool || !merchantResourcePool.has(res)))
            .sort((a, b) => (TRADE_VALUES[b[0]] || 0) - (TRADE_VALUES[a[0]] || 0));

        // Equipment items the merchant will buy, filtered by buyCategories
        const buyCategories = data.buyCategories ? new Set(data.buyCategories) : null;
        const EQUIP_ARRAYS = ['weapon', 'armor', 'helmet', 'clothes', 'tool', 'trinket', 'boots', 'tome', 'consumable'];
        const offerableEquip = [];
        for (const type of EQUIP_ARRAYS) {
            if (buyCategories && !buyCategories.has(type)) continue;
            // getItemArray, not `${type}s`: that makes 'bootss' / 'clothess'.
            const arr = this.game.resources.getItemArray(type) || [];
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (getItemTradeValue(item) > 0) offerableEquip.push({ key: `__equip_${type}_${i}`, item, type });
            }
        }

        html += `<div class="trade-column">`;
        html += `<div class="trade-column-header offer">${escapeHtml(t('ui.trade.you_offer'))}</div>`;

        // Gold offer row (always shown if player has gold)
        if (playerGold > 0) {
            const selected = goldOffer > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon('gold')}${escapeHtml(resourceName('gold'))} <span style="color:#888;">×${fmtGold(playerGold)}</span>`;
            if (goldOffer > 0) html += `<span class="trade-item-badge">${fmtGold(goldOffer)}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value" style="color:#ffdd00;">${escapeHtml(t('ui.trade.gold_value', { n: '1.0' }))}</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeGold(-${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeGold(${step})">+</button>`;
            html += `</div></div>`;
        }

        for (const [res, amt] of tradableStock) {
            const baseVal = (TRADE_VALUES[res] || 1) * effectiveDiscount;
            const offAmt = offer[res] || 0;
            // Show marginal value of the next unit: accounts for already-confirmed sales
            // this visit (data.saturation) plus units currently queued in the offer.
            const alreadySold = (data.saturation?.[res] || 0) + offAmt;
            const nextMult = Math.max(0.4, 1.0 - alreadySold * 0.05);
            const val = (baseVal * nextMult).toFixed(1);
            const selected = offAmt > 0 ? ' selected' : '';
            html += `<div class="trade-item-row${selected}">`;
            html += `<div class="trade-item-name">${this._tradeResIcon(res)}${escapeHtml(this._formatResourceName(res))} <span style="color:#888;">×${amt}</span>`;
            if (offAmt > 0) html += `<span class="trade-item-badge">${offAmt}</span>`;
            html += `</div>`;
            html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: val }))}</div>`;
            html += `<div class="trade-item-buttons">`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRemoveOffer(${jsArg(res)},${step})">−</button>`;
            html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeOffer(${jsArg(res)},${step})">+</button>`;
            html += `</div></div>`;
        }

        // Equipment items player can sell
        if (offerableEquip.length > 0) {
            html += `<div class="trade-section-label" style="color:#aaa;font-size:0.8em;padding:4px 0 2px;border-top:1px solid #333;margin-top:4px;">${escapeHtml(t('ui.trade.section_equipment'))}</div>`;
            for (const { key, item, type } of offerableEquip) {
                const val = (getItemTradeValue(item) * effectiveDiscount).toFixed(1);
                const isOffered = !!offer[key];
                const selected = isOffered ? ' selected' : '';
                const icon = this._itemIcon(item.key || key, type);
                const tip = escapeAttr(this._getEquipmentTooltip(item));
                html += `<div class="trade-item-row${selected}">`;
                html += `<div class="trade-item-name skill-tip" data-tip="${tip}">${icon}${escapeHtml(itemName(item))}`;
                if (isOffered) html += `<span class="trade-item-badge">1</span>`;
                html += `</div>`;
                html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: val }))}</div>`;
                html += `<div class="trade-item-buttons">`;
                if (isOffered) {
                    html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRemoveOffer('${key}',1)">−</button>`;
                } else {
                    html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeOffer('${key}',1)">+</button>`;
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
                html += `<div class="trade-section-label" style="color:#aaa;font-size:0.8em;padding:4px 0 2px;border-top:1px solid #333;margin-top:4px;">${escapeHtml(t('ui.trade.section_potions'))}</div>`;
                for (const [key, count] of sellablePotions) {
                    const def = ALL_ITEMS[key];
                    const offKey = `__potion_${key}`;
                    const offAmt = offer[offKey] || 0;
                    const val = (getItemTradeValue(def) * effectiveDiscount).toFixed(1);
                    const selected = offAmt > 0 ? ' selected' : '';
                    html += `<div class="trade-item-row${selected}">`;
                    html += `<div class="trade-item-name">${this._itemIcon(key, 'potion')}${escapeHtml(def ? itemName(def) : key)} <span style="color:#888;">×${count}</span>`;
                    if (offAmt > 0) html += `<span class="trade-item-badge">${offAmt}</span>`;
                    html += `</div>`;
                    html += `<div class="trade-item-value">${escapeHtml(t('ui.trade.gold_value', { n: val }))}</div>`;
                    html += `<div class="trade-item-buttons">`;
                    html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.tradeRemoveOffer(${jsArg(offKey)},${step})">−</button>`;
                    html += `<button class="trade-btn" onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.tradeOffer(${jsArg(offKey)},${step})">+</button>`;
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
        html += `<span class="offer-val">${escapeHtml(t('ui.trade.meter_offer', { n: offerVal.toFixed(1) }))}</span>`;
        if (reqVal > 0 || hasOffer) {
            if (diff > 0) {
                html += `<span class="deficit">${escapeHtml(t('ui.trade.meter_overpay', { n: diff.toFixed(1) }))}</span>`;
            } else if (diff < 0) {
                html += `<span class="deficit">${escapeHtml(t('ui.trade.meter_need', { n: Math.abs(diff).toFixed(1) }))}</span>`;
            } else if (diff === 0 && hasRequest) {
                html += `<span class="surplus">${escapeHtml(t('ui.trade.meter_even'))}</span>`;
            }
        }
        html += `<span class="request-val">${escapeHtml(t('ui.trade.meter_cost', { n: reqVal.toFixed(1) }))}</span>`;
        html += `</div>`;
        if (overpay > 0) {
            html += `<div class="trade-meter-warning">${escapeHtml(t('ui.trade.meter_lose_warning', { n: overpay.toFixed(1) }))}</div>`;
        }
        html += `</div>`;

        // Action buttons
        const goldReqCurrent = request.__gold || 0;
        const traderGoldAvailable = data.traderGold - goldReqCurrent;
        const resourceSurplus = Math.max(0, resourceOfferVal - reqVal);
        const canBalanceDeficit = diff < 0 && (-diff) <= (playerGold - goldOffer);
        const canBalanceSurplus = resourceSurplus > 0 && traderGoldAvailable > 0;
        const canBalance = canBalanceDeficit || canBalanceSurplus;
        let balanceLabel = t('ui.trade.balance');
        if (canBalanceDeficit) balanceLabel = t('ui.trade.balance_pay', { n: (-diff).toFixed(1) });
        else if (canBalanceSurplus) balanceLabel = t('ui.trade.balance_get', { n: Math.min(resourceSurplus, traderGoldAvailable).toFixed(1) });
        html += `<div class="trade-actions">`;
        if (overpay > 0) {
            html += `<button class="confirm" ${canTrade ? '' : 'disabled'} onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.confirmTrade()" style="border-color:#aa4400;color:#ffaa66;">${escapeHtml(t('ui.trade.confirm_lose', { n: overpay.toFixed(1) }))}</button>`;
        } else {
            html += `<button class="confirm" ${canTrade ? '' : 'disabled'} onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.confirmTrade()">${escapeHtml(t('ui.trade.confirm'))}</button>`;
        }
        html += `<button ${canBalance ? '' : 'disabled'} onclick="window.soundManager?.playSFXPitched('button_click',3);window.game.balanceTradeWithGold()" style="border-color:#aa8800;color:#ffdd88;">${escapeHtml(balanceLabel)}</button>`;
        html += `<button onclick="window.soundManager?.playSFXPitched('button_click',-3);window.game.clearTradeSelection()">${escapeHtml(t('ui.trade.clear'))}</button>`;
        html += `<button onclick="window.soundManager?.playSFXPitched('open_close_click',-3);window.game.dismissTrader()">${escapeHtml(t('ui.trade.done'))}</button>`;
        html += `</div>`;

        const panelScrollTop = this.elements.eventPanel.scrollTop;
        const scrollEl = this.elements.eventPanel.querySelector('.trade-grid');
        const gridScrollTop = scrollEl ? scrollEl.scrollTop : 0;
        this.elements.eventPanel.innerHTML = html;
        this.elements.eventPanel.scrollTop = panelScrollTop;
        const newScrollEl = this.elements.eventPanel.querySelector('.trade-grid');
        if (newScrollEl) newScrollEl.scrollTop = gridScrollTop;
    }


    toggleStoryPanel() {
        const opening = !this.storyPanelVisible;
        this._closeAllPanels();
        this.storyPanelVisible = opening;
        this._panelPause(opening);
        this.elements.storyPanel.style.display = opening ? 'block' : 'none';
        if (opening) {
            this._storyNewAtOpen = new Set(
                [...this.game.story.unlocked.keys()].filter(k => !this.game.story.viewed.has(k))
            );
            if (this._storyNewAtOpen.size > 0) {
                const tabOrder = ['colony', 'research', 'races', 'realms', 'bestiary'];
                const firstNewTab = tabOrder.find(t =>
                    [...this._storyNewAtOpen].some(k => STORY_MILESTONES[k]?.tab === t)
                );
                if (firstNewTab) this._storyTab = firstNewTab;
            }
            this.game.story.markAllViewed();
            this._lastStoryHtml = '';
            this.updateStoryPanel();
        } else {
            this._storyNewAtOpen = new Set();
        }
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    }

    _buildSocialSummaryHtml() {
        const colonists = this.game.colonists.filter(c => c.hp > 0 && !c.golem);
        if (colonists.length < 2) return `<div style="color:#666;padding:8px;">${escapeHtml(t('ui.story.social_not_enough'))}</div>`;

        const TIER_COLORS = {
            lovers:       '#ff88cc',
            close_friend: '#66dd88',
            friend:       '#44bb66',
            acquaintance: '#888',
            stranger:     '#555',
            adversary:    '#dd8844',
            rival:        '#dd4444',
        };

        const pairs = [];
        for (let i = 0; i < colonists.length; i++) {
            for (let j = i + 1; j < colonists.length; j++) {
                const a = colonists[i], b = colonists[j];
                const score = a.opinions?.[b.id] ?? 0;
                pairs.push({ a, b, score });
            }
        }
        pairs.sort((x, y) => Math.abs(y.score) - Math.abs(x.score));

        const synCfg = EXPLORATION_CONFIG.synergy;

        let html = '<div style="display:flex;flex-direction:column;gap:3px;">';
        for (const { a, b, score } of pairs) {
            const tier = getRelationshipTier(score);
            const color = TIER_COLORS[tier.key] || '#555';
            const sign = score > 0 ? '+' : '';
            const tipLines = [];
            for (const src of [a, b]) {
                const other = src === a ? b : a;
                if (src.thoughts) {
                    src.thoughts
                        .filter(th => th.targetId === other.id)
                        .slice(-2)
                        .forEach(th => tipLines.push(escapeAttr(t('ui.story.social_thought_line', { name: src.name, n: `${th.moodEffect > 0 ? '+' : ''}${th.moodEffect.toFixed(0)}`, text: thoughtText(th) }))));
                }
            }
            const tip = tipLines.length ? tipLines.join('&#10;') : '';
            const tipAttr = tip ? `class="skill-tip" data-tip="${tip}"` : '';

            let synergyTag = '';
            if (synCfg) {
                if (score >= synCfg.allyOpinion) {
                    const pct = Math.round(synCfg.allyDamageBonus * 100);
                    synergyTag = `<span style="color:#66dd88;font-size:10px;" title="${escapeAttr(t('ui.story.synergy_ally_tip', { pct }))}">${escapeHtml(t('ui.story.synergy_ally', { pct }))}</span>`;
                } else if (score <= synCfg.rivalOpinion) {
                    const pct = Math.round(synCfg.rivalDamagePenalty * 100);
                    synergyTag = `<span style="color:#dd4444;font-size:10px;" title="${escapeAttr(t('ui.story.synergy_rival_tip', { pct }))}">${escapeHtml(t('ui.story.synergy_rival', { pct }))}</span>`;
                }
            }

            html += `<div ${tipAttr} style="display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:3px;background:#1a1a1a;cursor:${tip ? 'help' : 'default'};">` +
                `<span style="color:${escapeAttr(a.nameColor || '#ffff00')};font-size:11px;min-width:70px;">${escapeHtml(a.name)}</span>` +
                `<span style="color:${color};font-size:10px;min-width:80px;text-align:center;">${escapeHtml(tier.name || tier.key.replace('_', ' '))}</span>` +
                `<span style="color:${escapeAttr(b.nameColor || '#ffff00')};font-size:11px;min-width:70px;">${escapeHtml(b.name)}</span>` +
                `<span style="color:${color};font-size:10px;">${sign}${score}</span>` +
                (synergyTag ? `<span style="margin-left:auto;">${synergyTag}</span>` : '') +
                `</div>`;
        }
        html += '</div>';
        return html;
    }

    updateStoryPanel() {
        const tab = this._storyTab || 'colony';
        const unlocked = this.game.story.unlocked;

        let html = '<div class="panel-close" data-panel-close="story">&times;</div>';
        html += `<h3 style="color:#ffcc44">${escapeHtml(t('ui.story.title'))}</h3>`;
        const tabCounts = {};
        for (const [key, m] of Object.entries(STORY_MILESTONES)) {
            if (!tabCounts[m.tab]) tabCounts[m.tab] = { total: 0, unlocked: 0 };
            tabCounts[m.tab].total++;
            if (unlocked.has(key)) tabCounts[m.tab].unlocked++;
        }
        const newAtOpen = this._storyNewAtOpen;
        const tabHasNew = (name) => {
            for (const [key, m] of Object.entries(STORY_MILESTONES)) {
                if (m.tab === name && newAtOpen.has(key)) return true;
            }
            return false;
        };
        const newBadge = `<span style="color:#ffcc44"> •</span>`;
        const tabLabel = (name, label) => {
            const c = tabCounts[name] || { unlocked: 0, total: 0 };
            const badge = tabHasNew(name) ? newBadge : '';
            return `${escapeHtml(t('ui.story.tab_count', { name: label, n: c.unlocked, total: c.total }))}${badge}`;
        };

        const FIXED_TABS = [
            { key: 'colony',   label: t('ui.story.tab_colony') },
            { key: 'research', label: t('ui.story.tab_research') },
            { key: 'races',    label: t('ui.story.tab_races') },
            { key: 'realms',   label: t('ui.story.tab_realms') },
            { key: 'combat',   label: t('ui.story.tab_combat') },
        ];
        const SPECIAL_TABS = new Set(['bestiary', 'social']);
        const fixedTabKeys = new Set(FIXED_TABS.map(ft => ft.key));
        const modTabs = [...new Set(
            Object.values(STORY_MILESTONES)
                .map(m => m.tab)
                .filter(tb => tb && !fixedTabKeys.has(tb) && !SPECIAL_TABS.has(tb))
        )].map(key => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));

        const bestiarySize = (this.game.exploration?.bestiary?.size || 0) +
            (this.game.exploration?.wildlifeKills?.size || 0) +
            (this.game.exploration?.raiderKills?.size || 0) +
            (this.game.exploration?.summonsSeen?.size || 0);

        html += '<div class="story-tabs">';
        for (const { key, label } of FIXED_TABS) {
            if (!tabCounts[key]) continue;
            html += `<button class="story-tab-btn${tab === key ? ' active' : ''}" data-story-tab="${escapeAttr(key)}">${tabLabel(key, label)}</button>`;
        }
        html += `<button class="story-tab-btn${tab === 'bestiary' ? ' active' : ''}" data-story-tab="bestiary">${escapeHtml(t('ui.story.tab_bestiary', { n: bestiarySize }))}</button>`;
        html += `<button class="story-tab-btn${tab === 'social' ? ' active' : ''}" data-story-tab="social">${escapeHtml(t('ui.story.tab_social'))}</button>`;
        for (const { key, label } of modTabs) {
            html += `<button class="story-tab-btn${tab === key ? ' active' : ''}" data-story-tab="${escapeAttr(key)}">${tabLabel(key, label)}</button>`;
        }
        html += '</div>';

        const entries = Object.entries(STORY_MILESTONES)
            .filter(([, m]) => m.tab === tab);

        html += '<div class="story-entries">';

        if (tab === 'bestiary') {
            const bestiary = this.game.exploration?.bestiary;
            const _bestiaryEntryHtml = (entry, spriteHtml) => {
                const realmName = entry.realms
                    ? entry.realms.map(r => REALMS[r]?.name || r).join(', ')
                    : (REALMS[entry.realm]?.name || entry.realm);
                const entryTypeKey = entry.key?.split(':')[1];
                const lore = escapeHtml(refText(entry.loreRef, entry.lore || EXPEDITION_ENEMIES[entryTypeKey]?.lore || NPC_ENCOUNTERS[entryTypeKey]?.lore || ''));
                const catColors = { regular: '#ff4444', boss: '#ffcc44', npc: '#44ccff' };
                const catKey = entry.category === 'elite' ? 'regular' : (entry.category || 'regular');
                if (!spriteHtml) {
                    const color = entry.color || catColors[catKey] || '#ff4444';
                    const symbol = catKey === 'boss' ? '&#9650;' : catKey === 'npc' ? '&#9786;' : '&#9668;';
                    spriteHtml = `<span style="display:inline-block;width:48px;text-align:center;font-size:2em;color:${escapeAttr(color)};vertical-align:middle;margin-right:6px;">${symbol}</span>`;
                }
                let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div style="flex:1;">`;
                h += `<div class="story-entry-title" style="font-size:0.9em;">${escapeHtml(refText(entry.nameRef, entry.name))}</div>`;
                h += `<div class="story-entry-text" style="font-size:0.8em;">${tHtml('ui.story.bestiary_found_html', { realms: realmName, n: entry.count })}</div>`;
                if (entry.category === 'boss' && entry.phases?.length > 1) {
                    const phaseIdx = this._bossPhaseView.get(entry.key) || 0;
                    const phase = entry.phases[phaseIdx];
                    const canPrev = phaseIdx > 0;
                    const canNext = phaseIdx < entry.phases.length - 1;
                    const btnStyle = 'background:none;border:1px solid #555;color:#ccc;cursor:pointer;padding:1px 6px;border-radius:3px;font-size:0.85em;';
                    const disabledStyle = 'background:none;border:1px solid #333;color:#555;padding:1px 6px;border-radius:3px;font-size:0.85em;';
                    h += `<div style="font-size:0.8em;color:#aaa;margin-top:2px;display:flex;align-items:center;gap:6px;">`;
                    h += canPrev
                        ? `<button style="${btnStyle}" data-boss-phase-nav="${escapeAttr(entry.key)}" data-boss-phase-dir="-1">&#9664;</button>`
                        : `<span style="${disabledStyle}">&#9664;</span>`;
                    h += `<span style="color:#ffcc44;">${escapeHtml(t('ui.story.bestiary_phase', { n: phaseIdx + 1, total: entry.phases.length, name: refText(phase.nameRef, phase.name || '') }))}</span>`;
                    h += canNext
                        ? `<button style="${btnStyle}" data-boss-phase-nav="${escapeAttr(entry.key)}" data-boss-phase-dir="1">&#9654;</button>`
                        : `<span style="${disabledStyle}">&#9654;</span>`;
                    h += `</div>`;
                }
                if (entry.eliteCounts && Object.keys(entry.eliteCounts).length > 0) {
                    const eliteParts = Object.values(entry.eliteCounts).map(e => t('ui.story.bestiary_elite_count', { name: refText(e.nameRef, e.name), n: e.count }));
                    h += `<div class="story-entry-text" style="font-size:0.75em;color:#ff8844;">${escapeHtml(t('ui.story.bestiary_elites', { list: eliteParts.join(', ') }))}</div>`;
                }
                if (lore) h += `<div class="story-entry-text" style="font-size:0.8em;font-style:italic;color:#aaa;margin-top:2px;">${lore}</div>`;
                return h + `</div></div>`;
            };
            const _killEntryHtml = (entry, spriteHtml, lore, showTamed, hideDrops) => {
                if (!spriteHtml) {
                    spriteHtml = `<span style="display:inline-block;width:48px;text-align:center;font-size:2em;color:${escapeAttr(entry.color)};vertical-align:middle;margin-right:6px;">${escapeHtml(entry.char)}</span>`;
                }
                let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div>`;
                h += `<div class="story-entry-title" style="font-size:0.9em;">${escapeHtml(killEntryName(entry))}</div>`;
                let statLine = hideDrops ? t('ui.story.bestiary_defeated', { n: entry.count }) : t('ui.story.bestiary_killed', { n: entry.count, drops: killDropsText(entry) });
                if (showTamed && entry.tameCount) statLine = t('ui.story.bestiary_with_tamed', { line: statLine, n: entry.tameCount });
                h += `<div class="story-entry-text" style="font-size:0.8em;">${escapeHtml(statLine)}</div>`;
                if (lore) h += `<div class="story-entry-text" style="font-size:0.8em;font-style:italic;color:#aaa;margin-top:2px;">${escapeHtml(lore)}</div>`;
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
                        return `<img src="${c.toDataURL('image/png')}" style="width:48px;height:48px;image-rendering:pixelated;vertical-align:middle;margin-right:6px;">`;
                    }
                }
                return '';
            };
            const _sectionHeader = (key, label, color, count) => {
                const collapsed = this._collapsedBestiarySections.has(key);
                const arrow = collapsed ? '&#9654;' : '&#9660;';
                const countStr = count > 0 ? ` (${count})` : '';
                return `<div class="realm-group-header" data-bestiary-section="${key}" style="color:${color};">${arrow} ${escapeHtml(label)}${countStr}</div>`;
            };
            const _emptyHint = (msg) =>
                `<div class="story-entry locked" style="margin:2px 0;"><div class="story-entry-text">${escapeHtml(msg)}</div></div>`;

            // Expedition sections
            const categories = { regular: [], boss: [], npc: [] };
            for (const [, entry] of (bestiary || [])) {
                const cat = entry.category === 'elite' ? 'regular' : (entry.category || 'regular');
                if (categories[cat]) categories[cat].push(entry);
            }
            const catColors = { regular: '#ff4444', boss: '#ffcc44', npc: '#44ccff' };
            const catNames = { regular: t('ui.story.bestiary_enemies'), boss: t('ui.story.bestiary_bosses'), npc: t('ui.story.bestiary_encounters') };
            const catHints = {
                regular: t('ui.story.bestiary_hint_enemies'),
                boss:    t('ui.story.bestiary_hint_bosses'),
                npc:     t('ui.story.bestiary_hint_encounters'),
            };
            for (const catKey of ['regular', 'boss', 'npc']) {
                const catEntries = categories[catKey];
                html += _sectionHeader(`exp_${catKey}`, catNames[catKey], catColors[catKey], catEntries.length);
                if (!this._collapsedBestiarySections.has(`exp_${catKey}`)) {
                    if (catEntries.length === 0) {
                        html += _emptyHint(catHints[catKey]);
                    } else {
                        for (const entry of catEntries) {
                            let viewSprite = entry.sprite;
                            if (entry.category === 'boss' && entry.phases?.length) {
                                const phaseIdx = this._bossPhaseView.get(entry.key) || 0;
                                viewSprite = entry.phases[phaseIdx]?.sprite || entry.sprite;
                            }
                            html += _bestiaryEntryHtml(entry, _getSpriteHtml(viewSprite));
                        }
                    }
                }
            }

            // Wildlife section
            // Kills of every wild-animal type share one record. Crypt guardians are
            // animals to the AI, but belong in their own bestiary section.
            const animalKills = [...(this.game.exploration?.wildlifeKills?.values() || [])];
            const isGuardianKill = e => !!ANIMALS[e.sprite]?.guardian;
            const wildlifeKills = animalKills.filter(e => !isGuardianKill(e));
            const guardianKills = animalKills.filter(isGuardianKill);
            html += _sectionHeader('wildlife', t('ui.story.bestiary_wildlife'), '#88cc44', wildlifeKills.length);
            if (!this._collapsedBestiarySections.has('wildlife')) {
                if (wildlifeKills.length === 0) {
                    html += _emptyHint(t('ui.story.bestiary_hint_wildlife'));
                } else {
                    for (const entry of wildlifeKills) {
                        html += _killEntryHtml(entry, _getSpriteHtml(entry.sprite), ANIMALS[entry.sprite]?.lore || entry.lore || '', true);
                    }
                }
            }

            // Crypt guardians section
            html += _sectionHeader('crypt_guardians', t('ui.story.bestiary_guardians'), '#bba0e0', guardianKills.length);
            if (!this._collapsedBestiarySections.has('crypt_guardians')) {
                if (guardianKills.length === 0) {
                    html += _emptyHint(t('ui.story.bestiary_hint_guardians'));
                } else {
                    for (const entry of guardianKills) {
                        html += _killEntryHtml(entry, _getSpriteHtml(entry.sprite), ANIMALS[entry.sprite]?.lore || entry.lore || '', false, true);
                    }
                }
            }

            // Raider section
            const raiderKills = [...(this.game.exploration?.raiderKills?.values() || [])];
            html += _sectionHeader('raiders', t('ui.story.bestiary_raiders'), '#ff6644', raiderKills.length);
            if (!this._collapsedBestiarySections.has('raiders')) {
                if (raiderKills.length === 0) {
                    html += _emptyHint(t('ui.story.bestiary_hint_raiders'));
                } else {
                    for (const entry of raiderKills) {
                        html += _killEntryHtml(entry, _getSpriteHtml(entry.sprite), ENTITIES[entry.sprite]?.lore || entry.lore || '');
                    }
                }
            }

            // Summons section
            const summonsSeen = [...(this.game.exploration?.summonsSeen?.values() || [])];
            html += _sectionHeader('summons', t('ui.story.bestiary_summons'), '#9966ff', summonsSeen.length);
            if (!this._collapsedBestiarySections.has('summons')) {
                if (summonsSeen.length === 0) {
                    html += _emptyHint(t('ui.story.bestiary_hint_summons'));
                } else {
                    for (const entry of summonsSeen) {
                        const lore = escapeHtml(ENTITIES[entry.sprite]?.lore || entry.lore || '');
                        const spriteHtml = _getSpriteHtml(entry.sprite) ||
                            `<span style="display:inline-block;width:24px;text-align:center;font-size:1.2em;color:${escapeAttr(entry.color)};vertical-align:middle;margin-right:6px;">${escapeHtml(entry.char)}</span>`;
                        let h = `<div class="story-entry unlocked" style="padding:4px 8px;display:flex;align-items:center;">${spriteHtml}<div>`;
                        h += `<div class="story-entry-title" style="font-size:0.9em;">${escapeHtml(killEntryName(entry))}</div>`;
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
                html += `<div class="realm-group-header" data-realm-group="${escapeAttr(group.name)}">${arrow} ${escapeHtml(t('ui.story.tab_count', { name: realmGroupName(group.name), n: groupUnlocked, total: group.entries.length }))}</div>`;
                if (!collapsed) {
                    for (const [key, milestone] of group.entries) {
                        if (unlocked.has(key)) {
                            const info = unlocked.get(key);
                            const dateStr = info ? escapeHtml(storyDate(info)) : '';
                            const isNew = newAtOpen.has(key);
                            html += `<div class="story-entry unlocked${isNew ? ' story-entry-new' : ''}">`;
                            if (dateStr) html += `<div style="color:#888;font-size:10px;margin-bottom:2px;">${dateStr}</div>`;
                            const realmNewBadge = isNew ? `<span class="story-new-badge">${escapeHtml(t('ui.story.new_badge'))}</span> ` : '';
                            html += `<div class="story-entry-title">${realmNewBadge}${escapeHtml(milestone.title)}</div>`;
                            html += `<div class="story-entry-text">${sanitizeHtml(milestone.text)}</div>`;
                            if (milestone.epilogueButton) {
                                html += `<div style="text-align:center;margin-top:12px;"><button data-story-action="outro" style="padding:8px 20px;background:#44331a;color:#ffcc44;border:1px solid #665522;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px;">${escapeHtml(t('ui.story.epilogue_button'))}</button></div>`;
                            }
                            html += `</div>`;
                        } else {
                            html += `<div class="story-entry locked">`;
                            html += `<div class="story-entry-title">${escapeHtml(t('ui.story.locked_title'))}</div>`;
                            html += `<div class="story-entry-text">${escapeHtml(t('ui.story.locked_text'))}</div>`;
                            html += `</div>`;
                        }
                    }
                }
            }
        } else if (tab === 'social') {
            html += this._buildSocialSummaryHtml();
        } else {
            const seasonOrder = { spring: 0, summer: 1, autumn: 2, winter: 3 };
            const unlockedEntries = entries.filter(([k]) => unlocked.has(k));
            unlockedEntries.sort(([ka], [kb]) => {
                const ia = unlocked.get(ka);
                const ib = unlocked.get(kb);
                if (!ia && !ib) return 0;
                if (!ia) return 1;
                if (!ib) return -1;
                if (ib.year !== ia.year) return ib.year - ia.year;
                return (seasonOrder[ib.season] ?? 0) - (seasonOrder[ia.season] ?? 0);
            });
            const lockedEntries = entries.filter(([k]) => !unlocked.has(k));
            for (const [key, milestone] of unlockedEntries) {
                const info = unlocked.get(key);
                const dateStr = info ? escapeHtml(storyDate(info)) : '';
                const isNew = newAtOpen.has(key);
                html += `<div class="story-entry unlocked${isNew ? ' story-entry-new' : ''}">`;
                if (dateStr) html += `<div style="color:#888;font-size:10px;margin-bottom:2px;">${dateStr}</div>`;
                const newBadge = isNew ? `<span class="story-new-badge">${escapeHtml(t('ui.story.new_badge'))}</span> ` : '';
                html += `<div class="story-entry-title">${newBadge}${escapeHtml(milestone.title)}</div>`;
                html += `<div class="story-entry-text">${sanitizeHtml(milestone.text)}</div>`;
                html += `</div>`;
            }
            for (const [,] of lockedEntries) {
                html += `<div class="story-entry locked">`;
                html += `<div class="story-entry-title">${escapeHtml(t('ui.story.locked_title'))}</div>`;
                html += `<div class="story-entry-text">${escapeHtml(t('ui.story.locked_text'))}</div>`;
                html += `</div>`;
            }
        }

        html += '</div>';

        if (html !== this._lastStoryHtml) {
            this._lastStoryHtml = html;
            this.elements.storyPanel.innerHTML = html;
            if (this._storyNewAtOpen?.size > 0) {
                const firstNew = this.elements.storyPanel.querySelector('.story-entry-new');
                firstNew?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
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

function weaponSpeedLabel(cd) {
    if (cd <= 2) return t('ui.colonist.weapon_speed_fast');
    if (cd >= 5) return t('ui.colonist.weapon_speed_slow');
    return t('ui.colonist.weapon_speed_normal');
}

function getWeaponTooltip(colonist) {
    const w = colonist.weapon;
    const baseCd = w.attackCooldown || COLONIST_CONFIG.baseAttackCooldown;
    const atkSpeed = 1 + getEquipmentStat(colonist, 'attackSpeed');
    const effCd = Math.max(1, Math.round(baseCd / atkSpeed));
    const baseDpt = (w.damage / baseCd).toFixed(1);
    const desc = itemDescription(w);
    let tip = desc ? `${desc} ` : '';
    if (baseCd !== effCd) {
        tip += t('ui.colonist.weapon_tip_haste', { dmg: w.damage, dps: baseDpt, eff: (w.damage / effCd).toFixed(1) });
    } else {
        tip += t('ui.colonist.weapon_stats', { dmg: w.damage, dps: baseDpt, speed: weaponSpeedLabel(baseCd) });
    }
    if (w.ranged) tip += t('ui.craft.tip_range', { n: w.range });
    const extras = getItemStatLines({ ...w, damage: undefined, ranged: undefined, range: undefined });
    if (extras.length) tip += `, ${extras.join(', ')}`;
    const onHit = getOnHitLines(w);
    if (onHit.length) tip += `, ${onHit.join(', ')}`;
    return tip;
}

installArcanePanel(UI);
installResearchPanel(UI);
installTutorialPanel(UI);
installMapPanel(UI);

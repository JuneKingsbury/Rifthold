import { ITEM_CHARS, RECIPES } from '../core/config.js';
import { RESEARCH } from '../core/config/magic.js';
import { STAT_META, formatStatValue, getItemStatLines, getNestedEffectLines } from '../core/config/effects.js';
import { escapeHtml, escapeAttr } from '../ui/ui-utils.js';
import { getLoadedManifests } from '../core/mod-registry.js';
import { importPristineConfig, fetchConfigSource, spliceExportObject, toJsLiteral } from './config-source.js';

const STORAGE_KEY = 'convocation_equip_pro';

// Base (unmodded) item tables, so exports never bake mod content into equipment.js.
const PRISTINE = await importPristineConfig('equipment.js');
const EQUIP = PRISTINE || await import('../core/config/equipment.js');
// Without the unmodded copy the editor shows live config, which includes any loaded mods' content.
const MODDED_FALLBACK = !PRISTINE && getLoadedManifests().length > 0;

const CATEGORIES = {
    weapon: { label: 'Weapons', exportName: 'WEAPONS', config: EQUIP.WEAPONS, headerColor: '#cc8888' },
    armor: { label: 'Armor', exportName: 'ARMORS', config: EQUIP.ARMORS, headerColor: '#9966cc' },
    helmet: { label: 'Helmets', exportName: 'HELMETS', config: EQUIP.HELMETS, headerColor: '#7799cc' },
    clothes: { label: 'Clothes', exportName: 'CLOTHES', config: EQUIP.CLOTHES, headerColor: '#77aa77' },
    boots: { label: 'Boots', exportName: 'BOOTS', config: EQUIP.BOOTS, headerColor: '#aa8855' },
    tool: { label: 'Tools', exportName: 'TOOLS', config: EQUIP.TOOLS, headerColor: '#88aacc' },
    trinket: { label: 'Trinkets', exportName: 'TRINKETS', config: EQUIP.TRINKETS, headerColor: '#ccaa44' },
};

// Matches the per-category recipe defaults in equipment.js (EQUIPMENT_RECIPE_SOURCES).
const DEFAULT_STATION = { clothes: 'loom' };
const defaultStation = (cat) => DEFAULT_STATION[cat] || 'workbench';

// Station and resource choices come from the real recipes, so no existing value is missing from a dropdown.
const STATIONS = [...new Set([
    ...Object.values(RECIPES).map(r => r.station),
    ...Object.values(CATEGORIES).flatMap(c => Object.values(c.config).map(d => d.recipe?.station)),
].filter(Boolean))].sort();
const RESOURCES = [...new Set([
    ...Object.keys(EQUIP.MATERIALS),
    ...Object.values(RECIPES).flatMap(r => Object.keys(r.input || {})),
])].sort();
const SKIN_KEYS = ['projectile_spell', 'projectile_arrow', 'projectile_bolt', 'projectile_void'];
const TIER_COLORS = ['#666', '#88cc88', '#4488ff', '#cc88ff', '#ffaa33', '#ff4444'];
const MAX_TIER = TIER_COLORS.length - 1;
// Select value standing for a multi-research requirement (an array), which the single select can't edit.
const KEEP_RESEARCH = '__keep__';
const QUALITY_MAP = { 0: null, 1: null, 2: 'fine', 3: 'superior', 4: 'superior' };

const TRINKET_EQUIP_STATS = ['moveSpeedBonus', 'workSpeedBonus', 'damageReduction', 'healthRegen', 'spellDamageBonus'];
const PEDESTAL_STATS = ['workSpeedBonus', 'skillGrowthBonus', 'wandererChanceMult', 'blightImmunity', 'cookingBonusFood', 'tradeMarkupMult', 'damageBonusMult', 'lightRadius'];
const EXPEDITION_STATS = ['lootMult', 'trapDamageMult', 'durationMult', 'rareEncounterMult', 'partyDamageMult'];

// Fields each category's form section edits. On a category change the old section's
// fields are dropped so they don't leak into the new category's export.
const DEFENSE_FIELDS = ['damageReduction', 'coldResistance', 'hungerReduction', 'spellDamageBonus', 'moodBonus'];
const CATEGORY_FIELDS = {
    weapon: ['damage', 'choppingSpeed', 'miningSpeed', 'spellDamageBonus', 'ranged', 'range', 'projectileChar', 'projectileColor', 'skinKey'],
    armor: DEFENSE_FIELDS,
    helmet: DEFENSE_FIELDS,
    tool: ['miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed', 'cookingSpeed', 'buildSpeed'],
    trinket: [...TRINKET_EQUIP_STATS, 'consumable', 'pedestal', 'expedition', 'durability'],
};

let editorInstance = null;

export function launchEquipmentEditorPro() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) editorInstance = new EquipmentEditorPro();
    editorInstance.show();
}

class EquipmentEditorPro {
    constructor() {
        this.items = new Map();
        this.originalItems = new Map();
        this.selectedKey = null;
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('equipment-editor-pro');
        this._loadFromConfig();
        this._loadFromStorage();
        this._buildDOM();
        this._bindEvents();
        this._pushUndoState();
    }

    show() { this.container.style.display = 'flex'; }
    hide() { this.container.style.display = 'none'; }
    _goBack() { this.hide(); document.getElementById('start-screen').style.display = ''; }

    _loadFromConfig() {
        for (const [cat, { config }] of Object.entries(CATEGORIES)) {
            for (const [key, def] of Object.entries(config)) {
                const item = { ...def, category: cat, key };
                this.items.set(key, item);
                this.originalItems.set(key, JSON.stringify(item));
            }
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.items) {
                for (const [key, item] of Object.entries(saved.items)) {
                    // Drafts from before v2 were saved by a lossy form; restore the
                    // fields it dropped from the base definition.
                    const base = saved.v >= 2 ? null : this.originalItems.get(key);
                    this.items.set(key, base ? { ...JSON.parse(base), ...item } : item);
                }
            }
            if (saved.deleted) {
                for (const key of saved.deleted) this.items.delete(key);
            }
        } catch {}
    }

    _saveToStorage() {
        const modified = {};
        const deleted = [];
        for (const [key, item] of this.items) {
            if (JSON.stringify(item) !== this.originalItems.get(key)) modified[key] = item;
        }
        for (const key of this.originalItems.keys()) {
            if (!this.items.has(key)) deleted.push(key);
        }
        for (const [key, item] of this.items) {
            if (!this.originalItems.has(key)) modified[key] = item;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, items: modified, deleted }));
        } catch (err) {
            console.warn('Equipment editor: draft autosave failed', err);
        }
    }

    _buildDOM() {
        this.container.className = 'form-editor';
        this.container.innerHTML = '';

        const toolbar = document.createElement('div');
        toolbar.className = 'fe-toolbar';
        toolbar.innerHTML = `
            <button id="eqp-back">← Back</button>
            <span class="fe-sep"></span>
            <button id="eqp-undo" title="Undo (Ctrl+Z)">↩</button>
            <button id="eqp-redo" title="Redo (Ctrl+Y)">↪</button>
            <span class="fe-sep"></span>
            <button id="eqp-export">Export equipment.js</button>
            ${MODDED_FALLBACK ? '<span style="color:#ff8844;font-size:10px;margin-left:8px;">Could not load base data separately from mods: showing modded data, full-file export disabled.</span>' : ''}
            <span style="margin-left:auto;color:#666;font-size:10px;">${this.items.size} items loaded</span>
        `;
        this.container.appendChild(toolbar);

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace-pro';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel-pro';
        formPanel.id = 'eqp-form';
        formPanel.innerHTML = this._buildSelectorHtml() + '<div id="eqp-fields" style="color:#666;text-align:center;padding:40px 20px;">Select an item from the dropdown above to edit it, or click "+ New" to create one.</div>';

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel-pro';
        previewPanel.id = 'eqp-preview';

        workspace.appendChild(formPanel);
        workspace.appendChild(previewPanel);
        this.container.appendChild(workspace);
    }

    _buildSelectorHtml() {
        let options = '';
        for (const [cat, { label }] of Object.entries(CATEGORIES)) {
            const items = [...this.items.entries()].filter(([, v]) => v.category === cat);
            if (items.length === 0) continue;
            options += `<optgroup label="${label}">`;
            for (const [key, item] of items) {
                const dirty = this._isDirty(key) ? ' •' : '';
                const sel = key === this.selectedKey ? ' selected' : '';
                options += `<option value="${escapeAttr(key)}"${sel}>${escapeHtml(item.name || key)}${dirty}</option>`;
            }
            options += `</optgroup>`;
        }
        return `<div class="fe-item-selector">
            <select id="eqp-select">${options ? `<option value="">(choose item...)</option>${options}` : '<option value="">(no items)</option>'}</select>
            <button class="fe-sel-btn" id="eqp-new">+ New</button>
            <button class="fe-sel-btn danger" id="eqp-delete">Delete</button>
        </div>`;
    }

    _rebuildSelector() {
        const selectorDiv = this.container.querySelector('.fe-item-selector');
        if (selectorDiv) selectorDiv.outerHTML = this._buildSelectorHtml();
        this._bindSelectorEvents();
    }

    _bindEvents() {
        document.getElementById('eqp-back').addEventListener('click', () => this._goBack());
        document.getElementById('eqp-undo').addEventListener('click', () => this._undo());
        document.getElementById('eqp-redo').addEventListener('click', () => this._redo());
        document.getElementById('eqp-export').addEventListener('click', () => this._showExportModal());
        this._bindSelectorEvents();

        // Form listeners are bound once: #eqp-fields survives re-renders (only its innerHTML is replaced).
        const fields = document.getElementById('eqp-fields');
        fields.addEventListener('input', () => this._scheduleUpdate());
        fields.addEventListener('change', () => this._scheduleUpdate());

        window.addEventListener('keydown', (e) => {
            if (this.container.style.display === 'none') return;
            // Leave typing keys to the focused field: native text undo and Esc to blur.
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this._undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this._redo(); }
            if (e.key === 'Escape' && !this.container.querySelector('.fe-export-modal')) this._goBack();
        });
    }

    _bindSelectorEvents() {
        const sel = document.getElementById('eqp-select');
        if (sel) sel.addEventListener('change', () => {
            if (sel.value) this._selectItem(sel.value);
        });
        const newBtn = document.getElementById('eqp-new');
        if (newBtn) newBtn.addEventListener('click', () => this._showNewItemDialog());
        const delBtn = document.getElementById('eqp-delete');
        if (delBtn) delBtn.addEventListener('click', () => {
            if (this.selectedKey && confirm(`Delete "${this.selectedKey}"?`)) this._deleteItem(this.selectedKey);
        });
    }

    _isDirty(key) {
        const item = this.items.get(key);
        if (!item) return false;
        return JSON.stringify(item) !== this.originalItems.get(key);
    }

    _selectItem(key) {
        this.selectedKey = key;
        this._rebuildSelector();
        this._renderForm();
        this._renderPreview();
    }

    _showNewItemDialog() {
        const cat = prompt('Category? (weapon, armor, helmet, clothes, boots, tool, trinket)', 'weapon');
        if (!cat || !CATEGORIES[cat]) return;
        let base = `new_${cat}`;
        let key = base;
        let i = 1;
        while (this.items.has(key)) { key = `${base}_${i++}`; }
        const item = { key, category: cat, name: `New ${CATEGORIES[cat].label.replace(/s$/, '')}` };
        if (cat === 'weapon') item.damage = 5;
        if (cat === 'armor' || cat === 'helmet') item.damageReduction = 0.05;
        if (cat === 'tool') item.miningSpeed = 1.25;
        this.items.set(key, item);
        this._selectItem(key);
        this._onDataChange();
    }

    _deleteItem(key) {
        this.items.delete(key);
        this.selectedKey = null;
        this._rebuildSelector();
        document.getElementById('eqp-fields').innerHTML = '<div style="color:#666;text-align:center;padding:40px 20px;">Item deleted. Select another item.</div>';
        document.getElementById('eqp-preview').innerHTML = '';
        this._onDataChange();
    }

    _renderForm() {
        const item = this.items.get(this.selectedKey);
        if (!item) return;
        const cat = item.category;

        let html = `
            <div class="fe-section-title">Item Info</div>
            <div class="fe-row">
                <div class="fe-field"><label>Key (snake_case)</label><input type="text" id="eqp-key" value="${escapeAttr(item.key)}"></div>
                <div class="fe-field"><label>Name</label><input type="text" id="eqp-name" value="${escapeAttr(item.name ?? '')}"></div>
            </div>
            <div class="fe-row">
                <div class="fe-field"><label>Category</label>
                    <select id="eqp-category">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}"${k === cat ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
                </div>
                <div class="fe-field"><label>Tier</label><input type="number" id="eqp-tier" min="0" max="${MAX_TIER}" value="${escapeAttr(item.tier || 0)}"></div>
            </div>
            <div class="fe-field"><label>Description</label><input type="text" id="eqp-desc" value="${escapeAttr(item.description || '')}"></div>
        `;

        if (cat === 'weapon') {
            html += `<div class="fe-section-title">Weapon Stats</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Damage</label><input type="number" id="eqp-damage" value="${item.damage || 0}"></div>`;
            html += `<div class="fe-field"><label>Chopping Speed</label><input type="number" id="eqp-choppingSpeed" step="0.05" value="${item.choppingSpeed ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Mining Speed</label><input type="number" id="eqp-miningSpeed" step="0.05" value="${item.miningSpeed ?? ''}"></div>`;
            html += `</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Spell Dmg Bonus</label><input type="number" id="eqp-spellDamageBonus" step="0.05" value="${item.spellDamageBonus ?? ''}"></div>`;
            html += `</div>`;
            html += `<div class="fe-section-title">Ranged</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field" style="flex:0 0 auto;"><label>Ranged</label><input type="checkbox" id="eqp-ranged" style="width:auto;margin-top:6px;" ${item.ranged ? 'checked' : ''}></div>`;
            html += `<div class="fe-field"><label>Range</label><input type="number" id="eqp-range" value="${item.range || 5}"></div>`;
            html += `<div class="fe-field" style="flex:0 0 60px;"><label>Proj Char</label><input type="text" id="eqp-projChar" maxlength="2" value="${escapeAttr(item.projectileChar ?? '')}"></div>`;
            html += `<div class="fe-field" style="flex:0 0 60px;"><label>Proj Color</label><input type="color" id="eqp-projColor" value="${escapeAttr(item.projectileColor || '#ffaa33')}"></div>`;
            html += `</div>`;
            html += `<div class="fe-row"><div class="fe-field"><label>Skin Key</label><select id="eqp-skinKey"><option value="">(none)</option>
                ${[...new Set([...SKIN_KEYS, item.skinKey].filter(Boolean))].map(k => `<option value="${escapeAttr(k)}"${item.skinKey === k ? ' selected' : ''}>${escapeHtml(k)}</option>`).join('')}
            </select></div></div>`;
        } else if (cat === 'armor' || cat === 'helmet') {
            html += `<div class="fe-section-title">Defense Stats</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Damage Reduction</label><input type="number" id="eqp-damageReduction" step="0.01" value="${item.damageReduction ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Cold Resistance</label><input type="number" id="eqp-coldResistance" step="0.1" value="${item.coldResistance ?? ''}"></div>`;
            html += `</div><div class="fe-row">`;
            html += `<div class="fe-field"><label>Hunger Reduction</label><input type="number" id="eqp-hungerReduction" step="0.05" value="${item.hungerReduction ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Spell Dmg Bonus</label><input type="number" id="eqp-spellDamageBonus" step="0.05" value="${item.spellDamageBonus ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Mood Bonus</label><input type="number" id="eqp-moodBonus" value="${item.moodBonus ?? ''}"></div>`;
            html += `</div>`;
        } else if (cat === 'tool') {
            html += `<div class="fe-section-title">Tool Speeds</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Mining</label><input type="number" id="eqp-miningSpeed" step="0.05" value="${item.miningSpeed ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Chopping</label><input type="number" id="eqp-choppingSpeed" step="0.05" value="${item.choppingSpeed ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Farming</label><input type="number" id="eqp-farmingSpeed" step="0.05" value="${item.farmingSpeed ?? ''}"></div>`;
            html += `</div><div class="fe-row">`;
            html += `<div class="fe-field"><label>Crafting</label><input type="number" id="eqp-craftingSpeed" step="0.05" value="${item.craftingSpeed ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Cooking</label><input type="number" id="eqp-cookingSpeed" step="0.05" value="${item.cookingSpeed ?? ''}"></div>`;
            html += `<div class="fe-field"><label>Building</label><input type="number" id="eqp-buildSpeed" step="0.05" value="${item.buildSpeed ?? ''}"></div>`;
            html += `</div>`;
        } else if (cat === 'trinket') {
            html += `<div class="fe-section-title">Equipped Stats</div>`;
            html += `<div class="fe-row">`;
            for (const stat of TRINKET_EQUIP_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="number" id="eqp-${stat}" step="0.05" value="${item[stat] ?? ''}"></div>`;
            }
            html += `</div>`;
            html += `<div class="fe-row"><div class="fe-field" style="flex:0 0 auto;"><label>Consumable</label><input type="checkbox" id="eqp-consumable" style="width:auto;margin-top:6px;" ${item.consumable ? 'checked' : ''}></div></div>`;

            html += `<div class="fe-section-title">Pedestal <input type="checkbox" id="eqp-pedestal-toggle" style="width:auto;vertical-align:middle;" ${item.pedestal ? 'checked' : ''}></div>`;
            html += `<div id="eqp-pedestal-fields" style="display:${item.pedestal ? 'block' : 'none'};">`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Radius</label><input type="text" id="eqp-ped-radius" value="${escapeAttr(item.pedestal?.radius ?? 5)}"></div>`;
            html += `<div class="fe-field"><label>Mana Cost</label><input type="number" id="eqp-ped-manaCost" value="${item.pedestal?.manaCost || 1}"></div>`;
            html += `</div><div class="fe-row">`;
            for (const stat of PEDESTAL_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="${meta?.format === 'boolean' ? 'checkbox' : 'number'}" id="eqp-ped-${stat}" ${meta?.format === 'boolean' ? (item.pedestal?.[stat] ? 'checked' : '') + ' style="width:auto;margin-top:6px;"' : `step="0.05" value="${item.pedestal?.[stat] ?? ''}"`}></div>`;
            }
            html += `</div></div>`;

            html += `<div class="fe-section-title">Expedition <input type="checkbox" id="eqp-expedition-toggle" style="width:auto;vertical-align:middle;" ${item.expedition ? 'checked' : ''}></div>`;
            html += `<div id="eqp-expedition-fields" style="display:${item.expedition ? 'block' : 'none'};"><div class="fe-row">`;
            for (const stat of EXPEDITION_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="number" id="eqp-exp-${stat}" step="0.05" value="${item.expedition?.[stat] ?? ''}"></div>`;
            }
            html += `</div></div>`;

            html += `<div class="fe-section-title">Durability <input type="checkbox" id="eqp-durability-toggle" style="width:auto;vertical-align:middle;" ${item.durability ? 'checked' : ''}></div>`;
            html += `<div id="eqp-durability-fields" style="display:${item.durability ? 'block' : 'none'};"><div class="fe-row">`;
            html += `<div class="fe-field"><label>Max</label><input type="number" id="eqp-dur-max" value="${item.durability?.max || 1}"></div>`;
            html += `<div class="fe-field" style="flex:0 0 auto;"><label>Break On Use</label><input type="checkbox" id="eqp-dur-breakOnUse" style="width:auto;margin-top:6px;" ${item.durability?.breakOnUse ? 'checked' : ''}></div>`;
            html += `</div></div>`;
        }

        html += `<div class="fe-section-title">Recipe <input type="checkbox" id="eqp-recipe-toggle" style="width:auto;vertical-align:middle;" ${item.recipe ? 'checked' : ''}></div>`;
        html += `<div id="eqp-recipe-fields" style="display:${item.recipe ? 'block' : 'none'};">`;
        html += `<div class="fe-row">`;
        html += `<div class="fe-field"><label>Ticks</label><input type="number" id="eqp-recipe-ticks" value="${item.recipe?.ticks || 20}"></div>`;
        const station = item.recipe?.station || defaultStation(cat);
        html += `<div class="fe-field"><label>Station</label><select id="eqp-recipe-station">${[...new Set([...STATIONS, station])].map(s => `<option value="${escapeAttr(s)}"${station === s ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>`;
        const research = item.recipe?.research;
        let researchKeys = Object.entries(RESEARCH);
        if (Array.isArray(research)) researchKeys = [[KEEP_RESEARCH, { name: research.map(r => RESEARCH[r]?.name || r).join(' + ') }], ...researchKeys];
        else if (research && !Object.hasOwn(RESEARCH, research)) researchKeys = [[research, { name: research }], ...researchKeys];
        const researchSel = Array.isArray(research) ? KEEP_RESEARCH : research;
        html += `<div class="fe-field"><label>Research</label><select id="eqp-recipe-research"><option value="">(none)</option>${researchKeys.map(([k, r]) => `<option value="${escapeAttr(k)}"${researchSel === k ? ' selected' : ''}>${escapeHtml(r.name || k)}</option>`).join('')}</select></div>`;
        html += `</div>`;
        html += `<div class="fe-section-title" style="font-size:10px;margin-top:8px;">Input Resources</div>`;
        html += `<div id="eqp-recipe-inputs">`;
        const inputs = item.recipe?.input || {};
        for (const [res, amt] of Object.entries(inputs)) {
            html += this._recipeInputRowHtml(res, amt);
        }
        html += `</div>`;
        html += `<button class="fe-add-btn" id="eqp-add-recipe-input" style="margin-top:4px;">+ Resource</button>`;
        html += `</div>`;

        document.getElementById('eqp-fields').innerHTML = html;
        this._bindFormEvents();
    }

    _recipeInputRowHtml(res, amt) {
        return `<div class="fe-list-row" style="margin-bottom:4px;">
            <select class="eqp-res-key" style="flex:1;">${[...new Set([...RESOURCES, res])].map(r => `<option value="${escapeAttr(r)}"${r === res ? ' selected' : ''}>${escapeHtml(r)}</option>`).join('')}</select>
            <input type="number" class="eqp-res-amt" value="${escapeAttr(amt)}" min="1" style="width:50px;">
            <button class="fe-remove-btn eqp-res-del">✕</button>
        </div>`;
    }

    _bindFormEvents() {
        const recipeToggle = document.getElementById('eqp-recipe-toggle');
        if (recipeToggle) recipeToggle.addEventListener('change', () => {
            document.getElementById('eqp-recipe-fields').style.display = recipeToggle.checked ? 'block' : 'none';
            this._scheduleUpdate();
        });

        const pedestalToggle = document.getElementById('eqp-pedestal-toggle');
        if (pedestalToggle) pedestalToggle.addEventListener('change', () => {
            document.getElementById('eqp-pedestal-fields').style.display = pedestalToggle.checked ? 'block' : 'none';
            this._scheduleUpdate();
        });
        const expToggle = document.getElementById('eqp-expedition-toggle');
        if (expToggle) expToggle.addEventListener('change', () => {
            document.getElementById('eqp-expedition-fields').style.display = expToggle.checked ? 'block' : 'none';
            this._scheduleUpdate();
        });
        const comToggle = document.getElementById('eqp-combat-toggle');
        if (comToggle) comToggle.addEventListener('change', () => {
            document.getElementById('eqp-combat-fields').style.display = comToggle.checked ? 'block' : 'none';
            this._scheduleUpdate();
        });
        const durToggle = document.getElementById('eqp-durability-toggle');
        if (durToggle) durToggle.addEventListener('change', () => {
            document.getElementById('eqp-durability-fields').style.display = durToggle.checked ? 'block' : 'none';
            this._scheduleUpdate();
        });

        const addInput = document.getElementById('eqp-add-recipe-input');
        if (addInput) addInput.addEventListener('click', () => {
            const container = document.getElementById('eqp-recipe-inputs');
            container.insertAdjacentHTML('beforeend', this._recipeInputRowHtml('wood', 1));
            this._bindRecipeInputDel();
            this._scheduleUpdate();
        });
        this._bindRecipeInputDel();
    }

    _bindRecipeInputDel() {
        document.getElementById('eqp-recipe-inputs')?.querySelectorAll('.eqp-res-del').forEach(btn => {
            btn.onclick = () => { btn.closest('.fe-list-row').remove(); this._scheduleUpdate(); };
        });
    }

    _scheduleUpdate() {
        clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this._collectAndSave();
            this._renderPreview();
            this._rebuildSelector();
            this._scheduleUndoPush();
        }, 80);
    }

    _collectAndSave() {
        if (!this.selectedKey) return;
        const base = this.items.get(this.selectedKey) || {};
        const item = this._collectFormData();
        if (!item) return;

        const oldKey = this.selectedKey;
        const keyInput = document.getElementById('eqp-key');
        if (item.key !== oldKey && this.items.has(item.key)) {
            // Refuse a rename onto another item's key; keep editing under the old key.
            keyInput.style.borderColor = '#ff4444';
            keyInput.title = `"${item.key}" is already used by another item`;
            item.key = oldKey;
        } else if (keyInput) {
            keyInput.style.borderColor = '';
            keyInput.title = '';
        }
        if (item.key !== oldKey) {
            this.items.delete(oldKey);
            this.selectedKey = item.key;
        }
        this.items.set(item.key, item);
        this._saveToStorage();
        // Show the new category's stat fields.
        if (item.category !== base.category) this._renderForm();
    }

    // Form values are merged over the item being edited, so fields the form
    // doesn't show (attackAnim, onHit, tradeValue, ...) survive the round-trip.
    _collectFormData() {
        const key = document.getElementById('eqp-key')?.value.trim();
        if (!key) return null;
        const base = this.items.get(this.selectedKey) || {};
        const cat = document.getElementById('eqp-category')?.value || base.category || 'weapon';

        const item = { ...base, key, category: cat };
        if (base.category && cat !== base.category) {
            const keep = new Set(CATEGORY_FIELDS[cat] || []);
            for (const f of CATEGORY_FIELDS[base.category] || []) if (!keep.has(f)) delete item[f];
        }
        item.name = document.getElementById('eqp-name')?.value.trim() || key;
        const desc = document.getElementById('eqp-desc')?.value.trim();
        if (desc) item.description = desc; else delete item.description;
        this._collectNumericStat(item, base, 'tier', document.getElementById('eqp-tier'));

        if (cat === 'weapon') {
            this._collectNumericStat(item, base, 'damage');
            this._collectNumericStat(item, base, 'choppingSpeed');
            this._collectNumericStat(item, base, 'miningSpeed');
            this._collectNumericStat(item, base, 'spellDamageBonus');
            if (document.getElementById('eqp-ranged')?.checked) {
                item.ranged = true;
                item.range = parseInt(document.getElementById('eqp-range')?.value) || 5;
                item.projectileChar = document.getElementById('eqp-projChar')?.value || '·';
                item.projectileColor = document.getElementById('eqp-projColor')?.value || '#ffaa33';
                const sk = document.getElementById('eqp-skinKey')?.value;
                if (sk) item.skinKey = sk; else delete item.skinKey;
            } else {
                for (const k of ['ranged', 'range', 'projectileChar', 'projectileColor', 'skinKey']) delete item[k];
            }
        } else if (cat === 'armor' || cat === 'helmet') {
            for (const stat of ['damageReduction', 'coldResistance', 'hungerReduction', 'spellDamageBonus', 'moodBonus']) {
                this._collectNumericStat(item, base, stat);
            }
        } else if (cat === 'tool') {
            for (const stat of ['miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed', 'cookingSpeed', 'buildSpeed']) {
                this._collectNumericStat(item, base, stat);
            }
        } else if (cat === 'trinket') {
            for (const stat of TRINKET_EQUIP_STATS) this._collectNumericStat(item, base, stat);
            if (document.getElementById('eqp-consumable')?.checked) item.consumable = true; else delete item.consumable;

            if (document.getElementById('eqp-pedestal-toggle')?.checked) {
                const ped = { ...base.pedestal };
                const radiusVal = document.getElementById('eqp-ped-radius')?.value.trim();
                ped.radius = radiusVal === 'global' ? 'global' : (parseInt(radiusVal) || 5);
                ped.manaCost = parseInt(document.getElementById('eqp-ped-manaCost')?.value) || 1;
                for (const stat of PEDESTAL_STATS) {
                    const el = document.getElementById(`eqp-ped-${stat}`);
                    if (STAT_META[stat]?.format === 'boolean') {
                        if (el?.checked) ped[stat] = true; else delete ped[stat];
                    } else {
                        this._collectNumericStat(ped, base.pedestal || {}, stat, el);
                    }
                }
                item.pedestal = ped;
            } else {
                delete item.pedestal;
            }
            if (document.getElementById('eqp-expedition-toggle')?.checked) {
                const exp = { ...base.expedition };
                for (const stat of EXPEDITION_STATS) {
                    this._collectNumericStat(exp, base.expedition || {}, stat, document.getElementById(`eqp-exp-${stat}`));
                }
                if (Object.keys(exp).length) item.expedition = exp; else delete item.expedition;
            } else {
                delete item.expedition;
            }
            if (document.getElementById('eqp-durability-toggle')?.checked) {
                item.durability = { ...base.durability, max: parseInt(document.getElementById('eqp-dur-max')?.value) || 1 };
                if (document.getElementById('eqp-dur-breakOnUse')?.checked) item.durability.breakOnUse = true;
                else delete item.durability.breakOnUse;
            } else {
                delete item.durability;
            }
        }

        if (document.getElementById('eqp-recipe-toggle')?.checked) {
            const recipe = { ...base.recipe };
            recipe.input = {};
            document.getElementById('eqp-recipe-inputs')?.querySelectorAll('.fe-list-row').forEach(row => {
                const res = row.querySelector('.eqp-res-key')?.value;
                const amt = parseInt(row.querySelector('.eqp-res-amt')?.value) || 1;
                if (res) recipe.input[res] = amt;
            });
            recipe.ticks = parseInt(document.getElementById('eqp-recipe-ticks')?.value) || 20;
            // Omit the station when it equals the category default, unless the original spelled it out.
            const station = document.getElementById('eqp-recipe-station')?.value;
            if (station && (station !== defaultStation(cat) || base.recipe?.station)) recipe.station = station;
            else delete recipe.station;
            const research = document.getElementById('eqp-recipe-research')?.value;
            if (research === KEEP_RESEARCH) recipe.research = base.recipe?.research;
            else if (research) recipe.research = research;
            else delete recipe.research;
            item.recipe = recipe;
        } else {
            delete item.recipe;
        }

        return item;
    }

    // A blank field removes the stat; an explicit 0 is kept only if the original had the field.
    _collectNumericStat(item, base, stat, el = document.getElementById(`eqp-${stat}`)) {
        if (!el) return;
        const v = parseFloat(el.value);
        if (Number.isFinite(v) && (v !== 0 || Object.hasOwn(base, stat))) item[stat] = v;
        else delete item[stat];
    }

    _renderPreview() {
        const item = this.items.get(this.selectedKey);
        const panel = document.getElementById('eqp-preview');
        if (!item) { panel.innerHTML = ''; return; }

        let html = '';

        html += `<div class="fe-preview-section-title">In-Game Appearance</div>`;
        html += `<div class="fe-preview-ingame">`;
        html += this._renderInventoryRow(item);
        html += `</div>`;

        html += `<div class="fe-preview-section-title">Info</div>`;
        html += `<div class="fe-preview-badges">`;
        const tier = Math.min(MAX_TIER, Math.max(0, parseInt(item.tier) || 0));
        const tierBar = '█'.repeat(tier) + '░'.repeat(MAX_TIER - tier);
        html += `<span class="fe-preview-badge tier" style="color:${TIER_COLORS[tier]}">Tier ${tier}/${MAX_TIER} ${tierBar}</span>`;
        if (item.recipe?.research) {
            const rName = [].concat(item.recipe.research).map(r => RESEARCH[r]?.name || r).join(' + ');
            html += `<span class="fe-preview-badge research">📖 ${escapeHtml(rName)}</span>`;
        }
        if (item.ranged) html += `<span class="fe-preview-badge ranged">${escapeHtml(item.projectileChar || '·')} Range: ${escapeHtml(item.range || 5)}</span>`;
        if (item.recipe) {
            const costs = Object.entries(item.recipe.input || {}).map(([r, a]) => `${r}×${a}`).join(', ');
            if (costs) html += `<span class="fe-preview-badge recipe">⚒ ${escapeHtml(costs)}</span>`;
        }
        html += `</div>`;

        if (item.category === 'trinket') {
            html += `<div class="fe-preview-section-title">Trinket Details</div>`;
            html += `<div class="fe-preview-ingame" style="font-size:11px;">`;
            const equipped = getItemStatLines(item);
            if (equipped.length) html += `<div style="color:#ccc;margin-bottom:4px;">${escapeHtml(equipped.join(', '))}</div>`;
            if (item.pedestal) {
                const pedLines = getNestedEffectLines(item.pedestal);
                const radius = item.pedestal.radius === 'global' ? 'global' : `${item.pedestal.radius} tiles`;
                html += `<div style="color:#88ccff;margin-top:4px;">Pedestal (${escapeHtml(radius)}, ${escapeHtml(item.pedestal.manaCost)} mana/tick):</div>`;
                html += `<div style="color:#aaa;padding-left:8px;">${escapeHtml(pedLines.join(', ') || 'none')}</div>`;
            }
            if (item.expedition) {
                const expLines = getNestedEffectLines(item.expedition);
                html += `<div style="color:#ffaa33;margin-top:4px;">Expedition:</div>`;
                html += `<div style="color:#aaa;padding-left:8px;">${escapeHtml(expLines.join(', '))}</div>`;
            }
            if (item.durability) html += `<div style="color:#cc6666;margin-top:4px;">Durability: ${escapeHtml(item.durability.max)}${item.durability.breakOnUse ? ' (breaks on use)' : ''}</div>`;
            if (item.consumable) html += `<div style="color:#aa44ff;margin-top:4px;">Consumable (single use)</div>`;
            html += `</div>`;
        }

        html += `<div class="fe-preview-section-title">Code</div>`;
        html += `<div class="fe-preview-code" style="margin:0 12px 12px;padding:10px;font-size:10px;max-height:200px;overflow-y:auto;white-space:pre;">${escapeHtml(this._serializeItem(item.key, item))}</div>`;

        panel.innerHTML = html;
    }

    _renderInventoryRow(item) {
        const cat = item.category;
        const icon = ITEM_CHARS[cat] || { char: '?', color: '#aaa' };
        const quality = QUALITY_MAP[item.tier || 0];
        const qColor = quality === 'fine' ? '#44cc44' : quality === 'superior' ? '#4488ff' : '#cccccc';

        let stats = '';
        if (cat === 'weapon') {
            stats = `Dmg: ${item.damage || 0}`;
            const extras = getItemStatLines({ ...item, damage: undefined, ranged: undefined, range: undefined });
            if (extras.length) stats += `, ${extras.join(', ')}`;
        } else if (cat === 'trinket') {
            stats = item.description || '';
        } else {
            stats = getItemStatLines(item).join(', ');
        }
        stats = escapeHtml(stats);

        return `<div style="color:${CATEGORIES[cat].headerColor};margin-bottom:4px;font-size:11px;"><b>${CATEGORIES[cat].label}:</b></div>` +
            `<div class="inv-row"><span class="inv-name" style="color:${qColor}"><span style="color:${icon.color};font-weight:bold;margin-right:2px;">${escapeHtml(icon.char)}</span>${escapeHtml(item.name || item.key)}</span><span class="inv-amount">${stats}</span></div>`;
    }

    // Config definition without the editor's own bookkeeping fields.
    _toDef(item) {
        const { key, category, ...def } = item;
        return def;
    }

    _serializeItem(key, item) {
        return `${key}: ${toJsLiteral(this._toDef(item))},`;
    }

    async _showExportModal() {
        if (MODDED_FALLBACK) {
            alert('Export disabled: base equipment.js data could not be loaded separately from the enabled mods, so the file would include mod content. Disable mods and reload to export.');
            return;
        }
        let output;
        try {
            output = await this._generateFullFile();
        } catch (err) {
            alert(`Export failed: ${err.message}`);
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content" style="width:800px;">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export equipment.js (${this.items.size} items)</div>
                <textarea readonly style="min-height:400px;">${escapeHtml(output)}</textarea>
                <div class="fe-modal-actions">
                    <button id="eqp-modal-download">Download File</button>
                    <button id="eqp-modal-copy">Copy to Clipboard</button>
                    <button id="eqp-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('eqp-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('eqp-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('eqp-modal-download').addEventListener('click', () => {
            const blob = new Blob([output], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'equipment.js'; a.click();
            URL.revokeObjectURL(url);
        });
        document.getElementById('eqp-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // Start from the real equipment.js source and splice in only the entries the
    // user changed, so every other export, comment and the derived ALL_ITEMS /
    // RECIPES code stay exactly as shipped.
    async _generateFullFile() {
        let out = await fetchConfigSource('equipment.js');
        for (const [cat, { exportName, config }] of Object.entries(CATEGORIES)) {
            const changed = new Map(), removed = new Set(), added = new Map();
            for (const key of Object.keys(config)) {
                const item = this.items.get(key);
                if (!item || item.category !== cat) removed.add(key);
                else if (this._isDirty(key)) changed.set(key, this._toDef(item));
            }
            for (const [key, item] of this.items) {
                if (item.category === cat && !Object.hasOwn(config, key)) added.set(key, this._toDef(item));
            }
            out = spliceExportObject(out, exportName, { changed, removed, added });
        }
        return out;
    }

    _pushUndoState() {
        const snap = JSON.stringify([...this.items]);
        if (this.undoStack[this.undoIndex] === snap) return;
        this.undoStack = this.undoStack.slice(0, this.undoIndex + 1);
        this.undoStack.push(snap);
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.undoIndex = this.undoStack.length - 1;
    }

    _scheduleUndoPush() {
        clearTimeout(this._undoTimer);
        this._undoTimer = setTimeout(() => this._pushUndoState(), 800);
    }

    _undo() {
        if (this.undoIndex <= 0) return;
        this.undoIndex--;
        this._restoreSnapshot(this.undoStack[this.undoIndex]);
    }

    _redo() {
        if (this.undoIndex >= this.undoStack.length - 1) return;
        this.undoIndex++;
        this._restoreSnapshot(this.undoStack[this.undoIndex]);
    }

    _restoreSnapshot(snap) {
        this.items = new Map(JSON.parse(snap));
        this._saveToStorage();
        this._rebuildSelector();
        if (this.selectedKey && this.items.has(this.selectedKey)) {
            this._renderForm();
            this._renderPreview();
        } else {
            this.selectedKey = null;
            document.getElementById('eqp-fields').innerHTML = '<div style="color:#666;text-align:center;padding:40px 20px;">Select an item from the dropdown above.</div>';
            document.getElementById('eqp-preview').innerHTML = '';
        }
    }

    _onDataChange() {
        this._saveToStorage();
        this._rebuildSelector();
        this._scheduleUndoPush();
    }
}

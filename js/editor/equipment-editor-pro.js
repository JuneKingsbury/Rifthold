import { WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS, POTIONS, ITEM_CHARS, RECIPES, MATERIALS, RECIPE_CATEGORIES } from '../core/config.js';
import { RESEARCH } from '../core/config/magic.js';
import { STAT_META, formatStatValue, getItemStatLines, getNestedEffectLines } from '../core/config/effects.js';

const STORAGE_KEY = 'convocation_equip_pro';

const CATEGORIES = {
    weapon: { label: 'Weapons', config: WEAPONS, headerColor: '#cc8888' },
    armor: { label: 'Armor', config: ARMORS, headerColor: '#9966cc' },
    helmet: { label: 'Helmets', config: HELMETS, headerColor: '#7799cc' },
    tool: { label: 'Tools', config: TOOLS, headerColor: '#88aacc' },
    artifact: { label: 'Artifacts', config: ARTIFACTS, headerColor: '#ccaa44' },
};

const STATIONS = ['workbench', 'anvil', 'cauldron', 'enchanting_table'];
const RESOURCES = ['wood', 'stone', 'planks', 'bricks', 'iron_ore', 'iron', 'leather', 'hides', 'runite', 'void_essence', 'wool', 'berries', 'wheat', 'corn', 'potatoes', 'moonbloom'];
const TIER_COLORS = ['#666', '#88cc88', '#4488ff', '#cc88ff', '#ffaa33'];
const QUALITY_MAP = { 0: null, 1: null, 2: 'fine', 3: 'superior', 4: 'superior' };

const ARTIFACT_EQUIP_STATS = ['moveSpeedBonus', 'workSpeedBonus', 'damageReduction', 'healthRegen', 'spellDamageBonus'];
const PEDESTAL_STATS = ['workSpeedBonus', 'skillGrowthBonus', 'wandererChanceMult', 'blightImmunity', 'cookingBonusFood', 'tradeMarkupMult', 'damageBonusMult', 'lightRadius'];
const EXPEDITION_STATS = ['lootMult', 'trapDamageMult', 'durationMult', 'rareEncounterMult', 'partyDamageMult', 'targetPriority', 'autoReviveHp', 'damageReduction', 'healthRegen'];
const COMBAT_STATS = ['targetPriority', 'damageReduction', 'autoReviveHp', 'healthRegen'];

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
                    this.items.set(key, item);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: modified, deleted }));
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
                options += `<option value="${key}"${sel}>${item.name || key}${dirty}</option>`;
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

        window.addEventListener('keydown', (e) => {
            if (this.container.style.display === 'none') return;
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
        const cat = prompt('Category? (weapon, armor, helmet, tool, artifact)', 'weapon');
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
                <div class="fe-field"><label>Key (snake_case)</label><input type="text" id="eqp-key" value="${item.key}"></div>
                <div class="fe-field"><label>Name</label><input type="text" id="eqp-name" value="${item.name || ''}"></div>
            </div>
            <div class="fe-row">
                <div class="fe-field"><label>Category</label>
                    <select id="eqp-category">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}"${k === cat ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
                </div>
                <div class="fe-field"><label>Tier</label><input type="number" id="eqp-tier" min="0" max="4" value="${item.tier || 0}"></div>
            </div>
            <div class="fe-field"><label>Description</label><input type="text" id="eqp-desc" value="${(item.description || '').replace(/"/g, '&quot;')}"></div>
        `;

        if (cat === 'weapon') {
            html += `<div class="fe-section-title">Weapon Stats</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Damage</label><input type="number" id="eqp-damage" value="${item.damage || 0}"></div>`;
            html += `<div class="fe-field"><label>Chopping Speed</label><input type="number" id="eqp-choppingSpeed" step="0.05" value="${item.choppingSpeed || ''}"></div>`;
            html += `<div class="fe-field"><label>Mining Speed</label><input type="number" id="eqp-miningSpeed" step="0.05" value="${item.miningSpeed || ''}"></div>`;
            html += `</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Spell Dmg Bonus</label><input type="number" id="eqp-spellDamageBonus" step="0.05" value="${item.spellDamageBonus || ''}"></div>`;
            html += `</div>`;
            html += `<div class="fe-section-title">Ranged</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field" style="flex:0 0 auto;"><label>Ranged</label><input type="checkbox" id="eqp-ranged" style="width:auto;margin-top:6px;" ${item.ranged ? 'checked' : ''}></div>`;
            html += `<div class="fe-field"><label>Range</label><input type="number" id="eqp-range" value="${item.range || 5}"></div>`;
            html += `<div class="fe-field" style="flex:0 0 60px;"><label>Proj Char</label><input type="text" id="eqp-projChar" maxlength="2" value="${item.projectileChar || ''}"></div>`;
            html += `<div class="fe-field" style="flex:0 0 60px;"><label>Proj Color</label><input type="color" id="eqp-projColor" value="${item.projectileColor || '#ffaa33'}"></div>`;
            html += `</div>`;
            html += `<div class="fe-row"><div class="fe-field"><label>Skin Key</label><select id="eqp-skinKey"><option value="">(none)</option>
                <option value="projectile_spell"${item.skinKey === 'projectile_spell' ? ' selected' : ''}>projectile_spell</option>
                <option value="projectile_arrow"${item.skinKey === 'projectile_arrow' ? ' selected' : ''}>projectile_arrow</option>
                <option value="projectile_bolt"${item.skinKey === 'projectile_bolt' ? ' selected' : ''}>projectile_bolt</option>
                <option value="projectile_void"${item.skinKey === 'projectile_void' ? ' selected' : ''}>projectile_void</option>
            </select></div></div>`;
        } else if (cat === 'armor' || cat === 'helmet') {
            html += `<div class="fe-section-title">Defense Stats</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Damage Reduction</label><input type="number" id="eqp-damageReduction" step="0.01" value="${item.damageReduction || ''}"></div>`;
            html += `<div class="fe-field"><label>Cold Resistance</label><input type="number" id="eqp-coldResistance" step="0.1" value="${item.coldResistance || ''}"></div>`;
            html += `</div><div class="fe-row">`;
            html += `<div class="fe-field"><label>Hunger Reduction</label><input type="number" id="eqp-hungerReduction" step="0.05" value="${item.hungerReduction || ''}"></div>`;
            html += `<div class="fe-field"><label>Spell Dmg Bonus</label><input type="number" id="eqp-spellDamageBonus" step="0.05" value="${item.spellDamageBonus || ''}"></div>`;
            html += `<div class="fe-field"><label>Mood Bonus</label><input type="number" id="eqp-moodBonus" value="${item.moodBonus || ''}"></div>`;
            html += `</div>`;
        } else if (cat === 'tool') {
            html += `<div class="fe-section-title">Tool Speeds</div>`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Mining</label><input type="number" id="eqp-miningSpeed" step="0.05" value="${item.miningSpeed || ''}"></div>`;
            html += `<div class="fe-field"><label>Chopping</label><input type="number" id="eqp-choppingSpeed" step="0.05" value="${item.choppingSpeed || ''}"></div>`;
            html += `<div class="fe-field"><label>Farming</label><input type="number" id="eqp-farmingSpeed" step="0.05" value="${item.farmingSpeed || ''}"></div>`;
            html += `</div><div class="fe-row">`;
            html += `<div class="fe-field"><label>Crafting</label><input type="number" id="eqp-craftingSpeed" step="0.05" value="${item.craftingSpeed || ''}"></div>`;
            html += `<div class="fe-field"><label>Cooking</label><input type="number" id="eqp-cookingSpeed" step="0.05" value="${item.cookingSpeed || ''}"></div>`;
            html += `<div class="fe-field"><label>Building</label><input type="number" id="eqp-buildSpeed" step="0.05" value="${item.buildSpeed || ''}"></div>`;
            html += `</div>`;
        } else if (cat === 'artifact') {
            html += `<div class="fe-section-title">Equipped Stats</div>`;
            html += `<div class="fe-row">`;
            for (const stat of ARTIFACT_EQUIP_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="number" id="eqp-${stat}" step="0.05" value="${item[stat] || ''}"></div>`;
            }
            html += `</div>`;
            html += `<div class="fe-row"><div class="fe-field" style="flex:0 0 auto;"><label>Consumable</label><input type="checkbox" id="eqp-consumable" style="width:auto;margin-top:6px;" ${item.consumable ? 'checked' : ''}></div></div>`;

            html += `<div class="fe-section-title">Pedestal <input type="checkbox" id="eqp-pedestal-toggle" style="width:auto;vertical-align:middle;" ${item.pedestal ? 'checked' : ''}></div>`;
            html += `<div id="eqp-pedestal-fields" style="display:${item.pedestal ? 'block' : 'none'};">`;
            html += `<div class="fe-row">`;
            html += `<div class="fe-field"><label>Radius</label><input type="text" id="eqp-ped-radius" value="${item.pedestal?.radius || 5}"></div>`;
            html += `<div class="fe-field"><label>Mana Cost</label><input type="number" id="eqp-ped-manaCost" value="${item.pedestal?.manaCost || 1}"></div>`;
            html += `</div><div class="fe-row">`;
            for (const stat of PEDESTAL_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="${meta?.format === 'boolean' ? 'checkbox' : 'number'}" id="eqp-ped-${stat}" ${meta?.format === 'boolean' ? (item.pedestal?.[stat] ? 'checked' : '') + ' style="width:auto;margin-top:6px;"' : `step="0.05" value="${item.pedestal?.[stat] || ''}"`}></div>`;
            }
            html += `</div></div>`;

            html += `<div class="fe-section-title">Expedition <input type="checkbox" id="eqp-expedition-toggle" style="width:auto;vertical-align:middle;" ${item.expedition ? 'checked' : ''}></div>`;
            html += `<div id="eqp-expedition-fields" style="display:${item.expedition ? 'block' : 'none'};"><div class="fe-row">`;
            for (const stat of EXPEDITION_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="number" id="eqp-exp-${stat}" step="0.05" value="${item.expedition?.[stat] || ''}"></div>`;
            }
            html += `</div></div>`;

            html += `<div class="fe-section-title">Combat <input type="checkbox" id="eqp-combat-toggle" style="width:auto;vertical-align:middle;" ${item.combat ? 'checked' : ''}></div>`;
            html += `<div id="eqp-combat-fields" style="display:${item.combat ? 'block' : 'none'};"><div class="fe-row">`;
            for (const stat of COMBAT_STATS) {
                const meta = STAT_META[stat];
                html += `<div class="fe-field"><label>${meta?.label || stat}</label><input type="number" id="eqp-com-${stat}" step="0.05" value="${item.combat?.[stat] || ''}"></div>`;
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
        html += `<div class="fe-field"><label>Station</label><select id="eqp-recipe-station">${STATIONS.map(s => `<option value="${s}"${(item.recipe?.station || 'workbench') === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>`;
        html += `<div class="fe-field"><label>Research</label><select id="eqp-recipe-research"><option value="">(none)</option>${Object.entries(RESEARCH).map(([k, r]) => `<option value="${k}"${item.recipe?.research === k ? ' selected' : ''}>${r.name}</option>`).join('')}</select></div>`;
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
            <select class="eqp-res-key" style="flex:1;">${RESOURCES.map(r => `<option value="${r}"${r === res ? ' selected' : ''}>${r}</option>`).join('')}</select>
            <input type="number" class="eqp-res-amt" value="${amt}" min="1" style="width:50px;">
            <button class="fe-remove-btn eqp-res-del">✕</button>
        </div>`;
    }

    _bindFormEvents() {
        const fields = document.getElementById('eqp-fields');
        fields.addEventListener('input', () => this._scheduleUpdate());
        fields.addEventListener('change', () => this._scheduleUpdate());

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
        const item = this._collectFormData();
        if (!item) return;

        const oldKey = this.selectedKey;
        if (item.key !== oldKey) {
            this.items.delete(oldKey);
            this.selectedKey = item.key;
        }
        this.items.set(item.key, item);
        this._saveToStorage();
    }

    _collectFormData() {
        const key = document.getElementById('eqp-key')?.value.trim();
        if (!key) return null;
        const cat = document.getElementById('eqp-category')?.value || 'weapon';

        const item = { key, category: cat };
        item.name = document.getElementById('eqp-name')?.value.trim() || key;
        const desc = document.getElementById('eqp-desc')?.value.trim();
        if (desc) item.description = desc;
        const tier = parseInt(document.getElementById('eqp-tier')?.value);
        if (tier > 0) item.tier = tier;

        if (cat === 'weapon') {
            const dmg = parseInt(document.getElementById('eqp-damage')?.value);
            if (dmg) item.damage = dmg;
            this._collectNumericStat(item, 'choppingSpeed');
            this._collectNumericStat(item, 'miningSpeed');
            this._collectNumericStat(item, 'spellDamageBonus');
            if (document.getElementById('eqp-ranged')?.checked) {
                item.ranged = true;
                item.range = parseInt(document.getElementById('eqp-range')?.value) || 5;
                item.projectileChar = document.getElementById('eqp-projChar')?.value || '·';
                item.projectileColor = document.getElementById('eqp-projColor')?.value || '#ffaa33';
                const sk = document.getElementById('eqp-skinKey')?.value;
                if (sk) item.skinKey = sk;
            }
        } else if (cat === 'armor' || cat === 'helmet') {
            this._collectNumericStat(item, 'damageReduction');
            this._collectNumericStat(item, 'coldResistance');
            this._collectNumericStat(item, 'hungerReduction');
            this._collectNumericStat(item, 'spellDamageBonus');
            this._collectNumericStat(item, 'moodBonus');
        } else if (cat === 'tool') {
            for (const stat of ['miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed', 'cookingSpeed', 'buildSpeed']) {
                this._collectNumericStat(item, stat);
            }
        } else if (cat === 'artifact') {
            for (const stat of ARTIFACT_EQUIP_STATS) this._collectNumericStat(item, stat);
            if (document.getElementById('eqp-consumable')?.checked) item.consumable = true;

            if (document.getElementById('eqp-pedestal-toggle')?.checked) {
                const ped = {};
                const radiusVal = document.getElementById('eqp-ped-radius')?.value.trim();
                ped.radius = radiusVal === 'global' ? 'global' : (parseInt(radiusVal) || 5);
                ped.manaCost = parseInt(document.getElementById('eqp-ped-manaCost')?.value) || 1;
                for (const stat of PEDESTAL_STATS) {
                    const meta = STAT_META[stat];
                    if (meta?.format === 'boolean') {
                        if (document.getElementById(`eqp-ped-${stat}`)?.checked) ped[stat] = true;
                    } else {
                        const v = parseFloat(document.getElementById(`eqp-ped-${stat}`)?.value);
                        if (v) ped[stat] = v;
                    }
                }
                item.pedestal = ped;
            }
            if (document.getElementById('eqp-expedition-toggle')?.checked) {
                const exp = {};
                for (const stat of EXPEDITION_STATS) {
                    const v = parseFloat(document.getElementById(`eqp-exp-${stat}`)?.value);
                    if (v) exp[stat] = v;
                }
                if (Object.keys(exp).length) item.expedition = exp;
            }
            if (document.getElementById('eqp-combat-toggle')?.checked) {
                const com = {};
                for (const stat of COMBAT_STATS) {
                    const v = parseFloat(document.getElementById(`eqp-com-${stat}`)?.value);
                    if (v) com[stat] = v;
                }
                if (Object.keys(com).length) item.combat = com;
            }
            if (document.getElementById('eqp-durability-toggle')?.checked) {
                item.durability = { max: parseInt(document.getElementById('eqp-dur-max')?.value) || 1 };
                if (document.getElementById('eqp-dur-breakOnUse')?.checked) item.durability.breakOnUse = true;
            }
        }

        if (document.getElementById('eqp-recipe-toggle')?.checked) {
            const recipe = {};
            recipe.input = {};
            document.getElementById('eqp-recipe-inputs')?.querySelectorAll('.fe-list-row').forEach(row => {
                const res = row.querySelector('.eqp-res-key')?.value;
                const amt = parseInt(row.querySelector('.eqp-res-amt')?.value) || 1;
                if (res) recipe.input[res] = amt;
            });
            recipe.ticks = parseInt(document.getElementById('eqp-recipe-ticks')?.value) || 20;
            const station = document.getElementById('eqp-recipe-station')?.value;
            if (station && station !== 'workbench') recipe.station = station;
            const research = document.getElementById('eqp-recipe-research')?.value;
            if (research) recipe.research = research;
            item.recipe = recipe;
        }

        return item;
    }

    _collectNumericStat(item, stat) {
        const v = parseFloat(document.getElementById(`eqp-${stat}`)?.value);
        if (v) item[stat] = v;
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
        const tier = item.tier || 0;
        const tierBar = '█'.repeat(tier) + '░'.repeat(4 - tier);
        html += `<span class="fe-preview-badge tier" style="color:${TIER_COLORS[tier]}">Tier ${tier}/4 ${tierBar}</span>`;
        if (item.recipe?.research) {
            const rName = RESEARCH[item.recipe.research]?.name || item.recipe.research;
            html += `<span class="fe-preview-badge research">📖 ${rName}</span>`;
        }
        if (item.ranged) html += `<span class="fe-preview-badge ranged">${item.projectileChar || '·'} Range: ${item.range || 5}</span>`;
        if (item.recipe) {
            const costs = Object.entries(item.recipe.input || {}).map(([r, a]) => `${r}×${a}`).join(', ');
            if (costs) html += `<span class="fe-preview-badge recipe">⚒ ${costs}</span>`;
        }
        html += `</div>`;

        if (item.category === 'artifact') {
            html += `<div class="fe-preview-section-title">Artifact Details</div>`;
            html += `<div class="fe-preview-ingame" style="font-size:11px;">`;
            const equipped = getItemStatLines(item);
            if (equipped.length) html += `<div style="color:#ccc;margin-bottom:4px;">${equipped.join(', ')}</div>`;
            if (item.pedestal) {
                const pedLines = getNestedEffectLines(item.pedestal);
                const radius = item.pedestal.radius === 'global' ? 'global' : `${item.pedestal.radius} tiles`;
                html += `<div style="color:#88ccff;margin-top:4px;">Pedestal (${radius}, ${item.pedestal.manaCost} mana/tick):</div>`;
                html += `<div style="color:#aaa;padding-left:8px;">${pedLines.join(', ') || 'none'}</div>`;
            }
            if (item.expedition) {
                const expLines = getNestedEffectLines(item.expedition);
                html += `<div style="color:#ffaa33;margin-top:4px;">Expedition:</div>`;
                html += `<div style="color:#aaa;padding-left:8px;">${expLines.join(', ')}</div>`;
            }
            if (item.combat) {
                const comLines = getNestedEffectLines(item.combat);
                html += `<div style="color:#ff8844;margin-top:4px;">Combat:</div>`;
                html += `<div style="color:#aaa;padding-left:8px;">${comLines.join(', ')}</div>`;
            }
            if (item.durability) html += `<div style="color:#cc6666;margin-top:4px;">Durability: ${item.durability.max}${item.durability.breakOnUse ? ' (breaks on use)' : ''}</div>`;
            if (item.consumable) html += `<div style="color:#aa44ff;margin-top:4px;">Consumable (single use)</div>`;
            html += `</div>`;
        }

        html += `<div class="fe-preview-section-title">Code</div>`;
        html += `<div class="fe-preview-code" style="margin:0 12px 12px;padding:10px;font-size:10px;max-height:200px;overflow-y:auto;">${this._serializeItem(item.key, item)}</div>`;

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
        } else if (cat === 'artifact') {
            stats = item.description || '';
        } else {
            stats = getItemStatLines(item).join(', ');
        }

        return `<div style="color:${CATEGORIES[cat].headerColor};margin-bottom:4px;font-size:11px;"><b>${CATEGORIES[cat].label}:</b></div>` +
            `<div class="inv-row"><span class="inv-name" style="color:${qColor}"><span style="color:${icon.color};font-weight:bold;margin-right:2px;">${icon.char}</span>${item.name || item.key}</span><span class="inv-amount">${stats}</span></div>`;
    }

    _serializeItem(key, item) {
        const lines = [];
        lines.push(`${key}: {`);
        lines.push(`    name: '${(item.name || key).replace(/'/g, "\\'")}',`);
        if (item.damage !== undefined) lines.push(`    damage: ${item.damage},`);
        if (item.damageReduction) lines.push(`    damageReduction: ${item.damageReduction},`);
        if (item.tier) lines.push(`    tier: ${item.tier},`);

        const statKeys = [...Object.keys(STAT_META)];
        for (const sk of statKeys) {
            if (sk === 'damage' || sk === 'damageReduction') continue;
            if (item[sk] !== undefined && item[sk] !== null && item[sk] !== 0 && item[sk] !== false) {
                if (typeof item[sk] === 'boolean') lines.push(`    ${sk}: true,`);
                else lines.push(`    ${sk}: ${item[sk]},`);
            }
        }

        if (item.consumable) lines.push(`    consumable: true,`);
        if (item.ranged) {
            lines.push(`    ranged: true,`);
            lines.push(`    range: ${item.range || 5},`);
            lines.push(`    projectileChar: '${item.projectileChar || '·'}',`);
            lines.push(`    projectileColor: '${item.projectileColor || '#ffaa33'}',`);
            if (item.skinKey) lines.push(`    skinKey: '${item.skinKey}',`);
        }
        if (item.description) lines.push(`    description: '${item.description.replace(/'/g, "\\'")}',`);

        if (item.pedestal) {
            const pp = [];
            pp.push(`radius: ${item.pedestal.radius === 'global' ? "'global'" : item.pedestal.radius}`);
            pp.push(`manaCost: ${item.pedestal.manaCost}`);
            for (const [k, v] of Object.entries(item.pedestal)) {
                if (k === 'radius' || k === 'manaCost') continue;
                if (v === true) pp.push(`${k}: true`);
                else if (v) pp.push(`${k}: ${v}`);
            }
            lines.push(`    pedestal: { ${pp.join(', ')} },`);
        }
        if (item.expedition) {
            const pp = Object.entries(item.expedition).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
            lines.push(`    expedition: { ${pp.join(', ')} },`);
        }
        if (item.combat) {
            const pp = Object.entries(item.combat).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
            lines.push(`    combat: { ${pp.join(', ')} },`);
        }
        if (item.durability) {
            const pp = [`max: ${item.durability.max}`];
            if (item.durability.breakOnUse) pp.push('breakOnUse: true');
            lines.push(`    durability: { ${pp.join(', ')} },`);
        }

        if (item.recipe) {
            const r = item.recipe;
            const inputParts = Object.entries(r.input || {}).map(([k, v]) => `${k}: ${v}`);
            let recipeLine = `    recipe: { input: { ${inputParts.join(', ')} }, ticks: ${r.ticks || 20}`;
            if (r.station && r.station !== 'workbench') recipeLine += `, station: '${r.station}'`;
            if (r.research) recipeLine += `, research: '${r.research}'`;
            recipeLine += ` },`;
            lines.push(recipeLine);
        }

        lines.push(`},`);
        return lines.join('\n');
    }

    _showExportModal() {
        const output = this._generateFullFile();
        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content" style="width:800px;">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export equipment.js (${this.items.size} items)</div>
                <textarea readonly style="min-height:400px;">${output}</textarea>
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

    _generateFullFile() {
        let out = '';
        out += `export const RECIPE_CATEGORIES = ${JSON.stringify(RECIPE_CATEGORIES)};\n\n`;
        out += `export const MATERIALS = {\n`;
        for (const [key, mat] of Object.entries(MATERIALS)) {
            const r = mat.recipe;
            out += `    ${key}: { name: '${mat.name}', recipe: { input: { ${Object.entries(r.input).map(([k,v])=>`${k}: ${v}`).join(', ')} }, output: ${r.output}, ticks: ${r.ticks}, prefix: '${r.prefix}' } },\n`;
        }
        out += `};\n\n`;

        out += `const BASE_RECIPES = {\n`;
        for (const [key, r] of Object.entries(RECIPES)) {
            if (key.startsWith('craft_') || key.startsWith('brew_') || key.startsWith('smelt_') || key.startsWith('tan_')) continue;
            const parts = [`input: { ${Object.entries(r.input).map(([k,v])=>`${k}: ${v}`).join(', ')} }`];
            parts.push(`output: { ${Object.entries(r.output).map(([k,v])=>`${k}: ${v}`).join(', ')} }`);
            parts.push(`skill: '${r.skill}'`);
            parts.push(`ticks: ${r.ticks}`);
            parts.push(`station: '${r.station}'`);
            parts.push(`category: '${r.category}'`);
            if (r.research) parts.push(`research: '${r.research}'`);
            if (r.special) parts.push(`special: '${r.special}'`);
            out += `    ${key}: { ${parts.join(', ')} },\n`;
        }
        out += `};\n\n`;

        const cats = ['weapon', 'armor', 'helmet', 'tool', 'artifact'];
        const exports = { weapon: 'WEAPONS', armor: 'ARMORS', helmet: 'HELMETS', tool: 'TOOLS', artifact: 'ARTIFACTS' };

        for (const cat of cats) {
            const exportName = exports[cat];
            const items = [...this.items.entries()].filter(([, v]) => v.category === cat);
            out += `export const ${exportName} = {\n`;
            for (const [key, item] of items) {
                out += '    ' + this._serializeItem(key, item).replace(/\n/g, '\n    ').replace(/\n    $/, '\n');
            }
            out += `};\n\n`;
            if (cat === 'helmet') {
                out += `export const EQUIPMENT_OVERLAY_OFFSETS = {\n    helmet: { offsetY: -0.25 },\n    armor: { offsetY: 0 },\n};\n\n`;
            }
        }

        out += `export const POTIONS = {\n`;
        for (const [key, p] of Object.entries(POTIONS)) {
            const parts = [`name: '${p.name}'`];
            parts.push(`trigger: '${p.trigger}'`);
            if (p.hpThreshold) parts.push(`hpThreshold: ${p.hpThreshold}`);
            if (p.manaThreshold) parts.push(`manaThreshold: ${p.manaThreshold}`);
            parts.push(`effect: '${p.effect}'`);
            if (p.healAmount) parts.push(`healAmount: ${p.healAmount}`);
            if (p.manaAmount) parts.push(`manaAmount: ${p.manaAmount}`);
            if (p.moveSpeedBonus) parts.push(`moveSpeedBonus: ${p.moveSpeedBonus}`);
            if (p.workSpeedBonus) parts.push(`workSpeedBonus: ${p.workSpeedBonus}`);
            if (p.damageReduction) parts.push(`damageReduction: ${p.damageReduction}`);
            if (p.duration) parts.push(`duration: ${p.duration}`);
            if (p.cooldown) parts.push(`cooldown: ${p.cooldown}`);
            if (p.recipe) {
                const r = p.recipe;
                let rParts = `input: { ${Object.entries(r.input).map(([k,v])=>`${k}: ${v}`).join(', ')} }, skill: '${r.skill}', ticks: ${r.ticks}, station: '${r.station}'`;
                if (r.research) rParts += `, research: '${r.research}'`;
                parts.push(`recipe: { ${rParts} }`);
            }
            out += `    ${key}: { ${parts.join(', ')} },\n`;
        }
        out += `};\n\n`;

        out += `export const ITEM_CHARS = {\n`;
        for (const [k, v] of Object.entries(ITEM_CHARS)) {
            out += `    ${k}: { char: '${v.char === '\\' ? '\\\\' : v.char}', color: '${v.color}' },\n`;
        }
        out += `};\n\n`;

        const armorItems = [...this.items.entries()].filter(([, v]) => v.category === 'armor');
        const helmetItems = [...this.items.entries()].filter(([, v]) => v.category === 'helmet');
        out += `const ARMOR_PAIRS = [\n`;
        for (const [key] of helmetItems) out += `    ['${key}', HELMETS],\n`;
        for (const [key] of armorItems) out += `    ['${key}', ARMORS],\n`;
        out += `];\n`;

        out += `const EQUIPMENT_RECIPE_SOURCES = [\n`;
        out += `    { items: WEAPONS, category: 'Weapons', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },\n`;
        out += `    { items: ARMOR_PAIRS, category: 'Armor', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' }, paired: true },\n`;
        out += `    { items: TOOLS, category: 'Tools', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },\n`;
        out += `    { items: ARTIFACTS, category: 'Artifacts', prefix: 'craft_', defaults: { skill: 'crafting', station: 'workbench' } },\n`;
        out += `    { items: POTIONS, category: 'Food & Potions', prefix: 'brew_', defaults: { skill: 'cooking', station: 'cauldron' } },\n`;
        out += `];\n\n`;

        out += `export const RECIPES = {};\n\n`;
        out += `for (const [key, mat] of Object.entries(MATERIALS)) {\n`;
        out += `    if (!mat.recipe) continue;\n`;
        out += `    const r = mat.recipe;\n`;
        out += `    RECIPES[\`\${r.prefix || 'craft_'}\${key}\`] = {\n`;
        out += `        input: r.input, output: { [key]: r.output },\n`;
        out += `        skill: 'crafting', ticks: r.ticks, station: 'workbench', category: 'Materials',\n`;
        out += `        ...(r.research ? { research: r.research } : {}),\n`;
        out += `    };\n`;
        out += `}\n\n`;
        out += `Object.assign(RECIPES, BASE_RECIPES);\n\n`;
        out += `for (const { items, category, prefix, defaults, paired } of EQUIPMENT_RECIPE_SOURCES) {\n`;
        out += `    if (paired) {\n`;
        out += `        for (const [key, source] of items) {\n`;
        out += `            const item = source[key];\n`;
        out += `            if (!item?.recipe) continue;\n`;
        out += `            const r = item.recipe;\n`;
        out += `            RECIPES[\`\${prefix}\${key}\`] = {\n`;
        out += `                input: r.input, output: { [key]: 1 },\n`;
        out += `                skill: r.skill || defaults.skill, ticks: r.ticks,\n`;
        out += `                station: r.station || defaults.station, category,\n`;
        out += `                ...(r.research ? { research: r.research } : {}),\n`;
        out += `            };\n`;
        out += `        }\n`;
        out += `    } else {\n`;
        out += `        for (const [key, item] of Object.entries(items)) {\n`;
        out += `            if (!item.recipe) continue;\n`;
        out += `            const r = item.recipe;\n`;
        out += `            RECIPES[\`\${prefix}\${key}\`] = {\n`;
        out += `                input: r.input, output: { [key]: 1 },\n`;
        out += `                skill: r.skill || defaults.skill, ticks: r.ticks,\n`;
        out += `                station: r.station || defaults.station, category,\n`;
        out += `                ...(r.research ? { research: r.research } : {}),\n`;
        out += `            };\n`;
        out += `        }\n`;
        out += `    }\n`;
        out += `}\n`;

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

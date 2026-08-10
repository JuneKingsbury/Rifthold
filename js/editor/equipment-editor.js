import { WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS } from '../core/config.js';
import { EffectPicker, formatEffectsCode, STAT_KEYS } from './effect-picker.js';

const STORAGE_KEY = 'convocation_equipment_drafts';

const CATEGORIES = {
    weapon: { label: 'Weapon', config: 'WEAPONS' },
    armor: { label: 'Armor', config: 'ARMORS' },
    helmet: { label: 'Helmet', config: 'HELMETS' },
    tool: { label: 'Tool', config: 'TOOLS' },
    artifact: { label: 'Artifact', config: 'ARTIFACTS' },
};

const CONFIG_EQUIPMENT = {
    weapon: WEAPONS,
    armor: ARMORS,
    helmet: HELMETS,
    tool: TOOLS,
    artifact: ARTIFACTS,
};

let editorInstance = null;

export function launchEquipmentEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new EquipmentEditor();
    }
    editorInstance.show();
}

class EquipmentEditor {
    constructor() {
        this.category = 'weapon';
        this.batchItems = [];
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('equipment-editor');
        this._buildDOM();
        this._bindEvents();
        this._refreshLoadDropdown();
        this._refreshConfigDropdown();
        this._autoRestore();
        this._switchCategory(this.category);
        this._pushUndoState();
    }

    show() {
        this.container.style.display = 'flex';
    }

    hide() {
        this.container.style.display = 'none';
    }

    _goBack() {
        this.hide();
        document.getElementById('start-screen').style.display = '';
    }

    _buildDOM() {
        this.container.className = 'form-editor';
        this.container.innerHTML = '';

        const toolbar = document.createElement('div');
        toolbar.className = 'fe-toolbar';
        toolbar.innerHTML = `
            <button id="eq-back">← Back</button>
            <span class="fe-sep"></span>
            <select id="eq-load-config"><option value="">Load from Config...</option></select>
            <select id="eq-load-select"><option value="">Load draft...</option></select>
            <button id="eq-save">Save</button>
            <button id="eq-delete">Delete</button>
            <button id="eq-duplicate">Duplicate</button>
            <span class="fe-sep"></span>
            <button id="eq-export">Export All</button>
        `;
        this.container.appendChild(toolbar);

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel';
        formPanel.id = 'eq-form';

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel';
        previewPanel.innerHTML = `
            <div class="fe-preview-tabs">
                <button class="fe-tab-btn active" data-tab="preview">Preview</button>
                <button class="fe-tab-btn" data-tab="reference">Reference</button>
            </div>
            <div class="fe-preview-content">
                <div id="eq-char-preview" style="text-align:center;padding:16px;font-size:48px;font-family:'Courier New',monospace;background:#0a0a14;border-bottom:1px solid #333;">/</div>
                <div class="fe-preview-header">
                    <span>Live Preview</span>
                    <button id="eq-copy-preview" style="font-size:10px;padding:2px 8px;">Copy</button>
                </div>
                <div class="fe-preview-code" id="eq-preview"></div>
            </div>
            <div class="fe-reference-content" id="eq-reference"></div>
        `;

        workspace.appendChild(formPanel);
        workspace.appendChild(previewPanel);
        this.container.appendChild(workspace);

        this._buildForm();
    }

    _buildForm() {
        const form = document.getElementById('eq-form');
        form.innerHTML = `
            <div class="fe-section-title">Item Info</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Key (snake_case)</label>
                    <input type="text" id="eq-key" placeholder="iron_sword">
                </div>
                <div class="fe-field">
                    <label>Display Name</label>
                    <input type="text" id="eq-name" placeholder="Iron Sword">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Category</label>
                    <select id="eq-category">
                        ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                    </select>
                </div>
                <div class="fe-field" style="flex:0 0 60px;">
                    <label>Char</label>
                    <input type="text" id="eq-char" maxlength="2" placeholder="/">
                </div>
                <div class="fe-field" style="flex:0 0 60px;">
                    <label>Color</label>
                    <input type="color" id="eq-color" value="#cccccc">
                </div>
            </div>

            <div class="fe-section-title" id="eq-ranged-section" style="display:none;">Ranged</div>
            <div id="eq-ranged-fields" style="display:none;">
                <div class="fe-row">
                    <div class="fe-field" style="flex:0 0 auto;">
                        <label>Ranged Weapon</label>
                        <input type="checkbox" id="eq-ranged" style="width:auto;margin-top:6px;">
                    </div>
                    <div class="fe-field">
                        <label>Range</label>
                        <input type="number" id="eq-range" value="5" min="1" max="20">
                    </div>
                    <div class="fe-field" style="flex:0 0 60px;">
                        <label>Proj Char</label>
                        <input type="text" id="eq-projChar" maxlength="2" placeholder="·">
                    </div>
                    <div class="fe-field" style="flex:0 0 60px;">
                        <label>Proj Color</label>
                        <input type="color" id="eq-projColor" value="#ffaa33">
                    </div>
                </div>
                <div class="fe-row">
                    <div class="fe-field">
                        <label>Skin Key</label>
                        <select id="eq-skinKey">
                            <option value="">(none)</option>
                            <option value="projectile_spell">projectile_spell</option>
                            <option value="projectile_arrow">projectile_arrow</option>
                            <option value="projectile_bolt">projectile_bolt</option>
                            <option value="projectile_void">projectile_void</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="fe-section-title">Effects</div>
            <div id="eq-effects-container"></div>

            <div style="margin-top:16px;">
                <button id="eq-add-batch" class="fe-add-btn" style="padding:6px 16px;font-size:12px;">+ Add to Batch</button>
            </div>

            <div class="fe-section-title" style="margin-top:24px;">Batch Items</div>
            <div id="eq-batch-list"></div>
        `;

        this._effectPicker = new EffectPicker(document.getElementById('eq-effects-container'), {
            allowedContexts: ['passive', 'aura', 'buff', 'on_hit'],
            onChange: () => this._schedulePreview(),
        });
    }

    _bindEvents() {
        document.getElementById('eq-back').addEventListener('click', () => this._goBack());
        document.getElementById('eq-save').addEventListener('click', () => this._saveDraft());
        document.getElementById('eq-delete').addEventListener('click', () => this._deleteDraft());
        document.getElementById('eq-duplicate').addEventListener('click', () => this._duplicateDraft());
        document.getElementById('eq-export').addEventListener('click', () => this._showExportModal());
        document.getElementById('eq-add-batch').addEventListener('click', () => this._addToBatch());
        document.getElementById('eq-copy-preview').addEventListener('click', () => this._copyPreview());

        document.getElementById('eq-load-select').addEventListener('change', (e) => {
            if (e.target.value) this._loadDraft(e.target.value);
        });
        document.getElementById('eq-load-config').addEventListener('change', (e) => {
            if (e.target.value) this._loadFromConfig(e.target.value);
            e.target.value = '';
        });

        document.getElementById('eq-char').addEventListener('input', () => this._updateCharPreview());
        document.getElementById('eq-color').addEventListener('input', () => this._updateCharPreview());
        document.getElementById('eq-category').addEventListener('change', (e) => this._switchCategory(e.target.value));

        this.container.querySelectorAll('.fe-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });


        this.container.addEventListener('input', () => this._schedulePreview());
        this.container.addEventListener('change', () => this._schedulePreview());

        window.addEventListener('keydown', (e) => {
            if (this.container.style.display === 'none') return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this._undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this._redo();
                return;
            }
            if (e.key === 'Escape') this._goBack();
        });
    }

    _switchCategory(cat) {
        this.category = cat;
        const dropdown = document.getElementById('eq-category');
        if (dropdown) dropdown.value = cat;
        const showRanged = cat === 'weapon';
        const rangedSection = document.getElementById('eq-ranged-section');
        const rangedFields = document.getElementById('eq-ranged-fields');
        if (rangedSection) rangedSection.style.display = showRanged ? '' : 'none';
        if (rangedFields) rangedFields.style.display = showRanged ? '' : 'none';
        this._refreshConfigDropdown();
        this._schedulePreview();
    }

    _schedulePreview() {
        clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => {
            this._updatePreview();
            this._autoSave();
            this._scheduleUndoPush();
        }, 50);
    }

    _updatePreview() {
        this._updateCharPreview();
        this._validateForm();
        const data = this._collectFormData();
        const code = this._formatItem(data);
        document.getElementById('eq-preview').textContent = code || '// Fill in fields to see preview';
    }

    _updateCharPreview() {
        const char = document.getElementById('eq-char').value || this._getDefaultChar();
        const color = document.getElementById('eq-color').value;
        const preview = document.getElementById('eq-char-preview');
        if (preview) {
            preview.textContent = char;
            preview.style.color = color;
        }
    }

    _getDefaultChar() {
        const chars = { weapon: '/', armor: '[', helmet: '^', tool: '\\', artifact: '*' };
        return chars[this.category] || '?';
    }

    _autoSave() {
        try {
            const state = {
                category: this.category,
                form: this._collectFormData(),
                batch: this.batchItems,
            };
            localStorage.setItem(STORAGE_KEY + '_autosave', JSON.stringify(state));
        } catch {}
    }

    _autoRestore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY + '_autosave');
            if (!raw) return;
            const state = JSON.parse(raw);
            if (state.batch && state.batch.length) this.batchItems = state.batch;
            this._renderBatchList();
            if (state.category) this._switchCategory(state.category);
            if (state.form && state.form.key) {
                document.getElementById('eq-key').value = state.form.key;
                document.getElementById('eq-name').value = state.form.name || '';
                if (state.form.effects && this._effectPicker) {
                    this._effectPicker.setEffects(state.form.effects);
                }
            }
        } catch {}
    }

    _collectFormData() {
        const key = document.getElementById('eq-key').value.trim();
        const name = document.getElementById('eq-name').value.trim();
        if (!key && !name) return null;

        const item = { key, name, category: this.category };
        item.effects = this._effectPicker ? this._effectPicker.getEffects() : [];

        if (this.category === 'weapon' && document.getElementById('eq-ranged').checked) {
            item.ranged = true;
            item.range = parseInt(document.getElementById('eq-range').value) || 5;
            item.projectileChar = document.getElementById('eq-projChar').value || '·';
            item.projectileColor = document.getElementById('eq-projColor').value || '#ffaa33';
            const skinKey = document.getElementById('eq-skinKey').value;
            if (skinKey) item.skinKey = skinKey;
        }
        return item;
    }

    _formatItem(item) {
        if (!item || !item.key) return '';
        let out = `${item.key}: {\n`;
        out += `    name: '${item.name || item.key}',\n`;
        if (item.effects && item.effects.length) {
            out += formatEffectsCode(item.effects) + ',\n';
        }
        if (item.ranged) {
            out += `    ranged: true,\n`;
            out += `    range: ${item.range || 5},\n`;
            out += `    projectileChar: '${item.projectileChar || '·'}',\n`;
            out += `    projectileColor: '${item.projectileColor || '#ffaa33'}',\n`;
            if (item.skinKey) out += `    skinKey: '${item.skinKey}',\n`;
        }
        out += `},`;
        return out;
    }

    _addToBatch() {
        const data = this._collectFormData();
        if (!data || !data.key) {
            this._validateForm();
            return;
        }
        if (!data.name) data.name = data.key;

        const existing = this.batchItems.findIndex(i => i.key === data.key);
        if (existing >= 0) {
            this.batchItems[existing] = data;
        } else {
            this.batchItems.push(data);
        }

        this._clearForm();
        this._renderBatchList();
        this._schedulePreview();
    }

    _clearForm() {
        document.getElementById('eq-key').value = '';
        document.getElementById('eq-name').value = '';
        document.getElementById('eq-char').value = '';
        document.getElementById('eq-color').value = '#cccccc';
        document.getElementById('eq-ranged').checked = false;
        document.getElementById('eq-range').value = '5';
        document.getElementById('eq-projChar').value = '';
        document.getElementById('eq-projColor').value = '#ffaa33';
        document.getElementById('eq-skinKey').value = '';
        if (this._effectPicker) this._effectPicker.clear();
    }

    _editBatchItem(index) {
        const item = this.batchItems[index];
        if (!item) return;

        this._switchCategory(item.category);
        document.getElementById('eq-key').value = item.key;
        document.getElementById('eq-name').value = item.name;
        if (this._effectPicker) this._effectPicker.setEffects(item.effects || []);

        if (item.category === 'weapon' && item.ranged) {
            document.getElementById('eq-ranged').checked = true;
            document.getElementById('eq-range').value = item.range || 5;
            document.getElementById('eq-projChar').value = item.projectileChar || '';
            document.getElementById('eq-projColor').value = item.projectileColor || '#ffaa33';
            document.getElementById('eq-skinKey').value = item.skinKey || '';
        }

        this.batchItems.splice(index, 1);
        this._renderBatchList();
        this._schedulePreview();
    }

    _removeBatchItem(index) {
        this.batchItems.splice(index, 1);
        this._renderBatchList();
        this._schedulePreview();
    }

    _renderBatchList() {
        const container = document.getElementById('eq-batch-list');
        if (!this.batchItems.length) {
            container.innerHTML = '<div style="color:#666;font-size:11px;">No items in batch yet. Fill in the form and click "+ Add to Batch".</div>';
            return;
        }
        let html = `<table class="fe-batch-table"><thead><tr>
            <th>Category</th><th>Key</th><th>Name</th><th>Effects</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.batchItems.forEach((item, i) => {
            const effectSummary = (item.effects || []).map(e => e.type).join(', ') || '-';
            html += `<tr>
                <td>${CATEGORIES[item.category].label}</td>
                <td>${item.key}</td>
                <td>${item.name}</td>
                <td>${effectSummary}</td>
                <td>
                    <button data-edit="${i}">Edit</button>
                    <button data-remove="${i}">✕</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => this._editBatchItem(parseInt(btn.dataset.edit)));
        });
        container.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => this._removeBatchItem(parseInt(btn.dataset.remove)));
        });
    }


    _formatBatchExport() {
        const grouped = {};
        this.batchItems.forEach(item => {
            const cat = item.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });

        let output = '';
        for (const [cat, items] of Object.entries(grouped)) {
            output += `// === Add to ${CATEGORIES[cat].config} in config.js ===\n`;
            items.forEach(item => {
                output += this._formatItem(item) + '\n';
            });
            output += '\n';
        }
        return output.trimEnd();
    }

    _copyPreview() {
        const text = document.getElementById('eq-preview').textContent;
        navigator.clipboard.writeText(text);
    }

    _showExportModal() {
        if (!this.batchItems.length) return;
        const output = this._formatBatchExport();

        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export Equipment (${this.batchItems.length} items)</div>
                <textarea readonly>${output}</textarea>
                <div class="fe-modal-actions">
                    <button id="eq-modal-copy">Copy to Clipboard</button>
                    <button id="eq-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('eq-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('eq-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('eq-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }


    _switchTab(tab) {
        this.container.querySelectorAll('.fe-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        this.container.querySelector('.fe-preview-content').style.display = tab === 'preview' ? '' : 'none';
        const ref = this.container.querySelector('.fe-reference-content');
        ref.classList.toggle('visible', tab === 'reference');
        if (tab === 'reference' && !ref.dataset.built) {
            this._buildReference();
            ref.dataset.built = '1';
        }
    }

    _buildReference() {
        const container = document.getElementById('eq-reference');
        const categories = [
            { title: 'Available Stats', ids: STAT_KEYS.map(s => s.value) },
        ];

        let html = `<input type="text" class="fe-ref-search" placeholder="Search stats..." id="eq-ref-search">`;
        html += `<div id="eq-ref-list">`;
        for (const cat of categories) {
            html += `<div class="fe-ref-category" data-cat-title="${cat.title.toLowerCase()}">`;
            html += `<div class="fe-ref-category-title">${cat.title}</div>`;
            for (const id of cat.ids) {
                html += `<span class="fe-ref-id" data-ref-id="${id}">${id}</span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;

        container.addEventListener('click', (e) => {
            const pill = e.target.closest('.fe-ref-id');
            if (!pill) return;
            navigator.clipboard.writeText(pill.dataset.refId);
            pill.classList.add('copied');
            setTimeout(() => pill.classList.remove('copied'), 600);
        });

        document.getElementById('eq-ref-search').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            container.querySelectorAll('.fe-ref-id').forEach(el => {
                el.style.display = el.dataset.refId.includes(q) ? '' : 'none';
            });
            container.querySelectorAll('.fe-ref-category').forEach(cat => {
                const hasVisible = [...cat.querySelectorAll('.fe-ref-id')].some(el => el.style.display !== 'none');
                cat.style.display = hasVisible ? '' : 'none';
            });
        });
    }

    _saveDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        const saved = this._getSaved();
        const idx = saved.findIndex(s => s.key === data.key);
        if (idx >= 0) saved[idx] = data;
        else saved.push(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        this._refreshLoadDropdown();
    }

    _loadDraft(key) {
        const saved = this._getSaved();
        const item = saved.find(s => s.key === key);
        if (!item) return;
        this._editBatchItem(-1);
        this._switchCategory(item.category);
        document.getElementById('eq-key').value = item.key;
        document.getElementById('eq-name').value = item.name;

        if (item.category === 'artifact') {
            ARTIFACT_EQUIPPED_STATS.forEach(f => {
                document.getElementById(`eq-arteq-${f.key}`).value = item[f.key] || '';
            });
            document.getElementById('eq-art-consumable').checked = !!item.consumable;
            if (item.pedestal) {
                document.getElementById('eq-art-pedestal-toggle').checked = true;
                ARTIFACT_PEDESTAL_FIELDS.forEach(f => {
                    const el = document.getElementById(`eq-ped-${f.key}`);
                    if (f.type === 'checkbox') el.checked = !!item.pedestal[f.key];
                    else el.value = item.pedestal[f.key] || '';
                });
            }
            if (item.expedition) {
                document.getElementById('eq-art-expedition-toggle').checked = true;
                ARTIFACT_EXPEDITION_FIELDS.forEach(f => {
                    document.getElementById(`eq-exp-${f.key}`).value = item.expedition[f.key] || '';
                });
            }
            if (item.combat) {
                document.getElementById('eq-art-combat-toggle').checked = true;
                ARTIFACT_COMBAT_FIELDS.forEach(f => {
                    document.getElementById(`eq-com-${f.key}`).value = item.combat[f.key] || '';
                });
            }
            if (item.durability) {
                document.getElementById('eq-art-durability-toggle').checked = true;
                document.getElementById('eq-dur-max').value = item.durability.max || '';
                document.getElementById('eq-dur-breakOnUse').checked = !!item.durability.breakOnUse;
            }
            this._updateConditionals();
        } else {
            const fields = STAT_FIELDS[item.category];
            if (fields) fields.forEach(f => {
                const el = document.getElementById(`eq-stat-${f.key}`);
                if (el) el.value = item[f.key] || '';
            });
        }
        this._schedulePreview();
        document.getElementById('eq-load-select').value = '';
    }

    _deleteDraft() {
        const key = document.getElementById('eq-key').value.trim();
        if (!key) return;
        const saved = this._getSaved().filter(s => s.key !== key);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        this._refreshLoadDropdown();
    }

    _getSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }

    _refreshLoadDropdown() {
        const select = document.getElementById('eq-load-select');
        const saved = this._getSaved();
        select.innerHTML = '<option value="">Load draft...</option>' +
            saved.map(s => `<option value="${s.key}">${s.name || s.key} (${s.category})</option>`).join('');
    }

    _refreshConfigDropdown() {
        const select = document.getElementById('eq-load-config');
        if (!select) return;
        const items = CONFIG_EQUIPMENT[this.category] || {};
        select.innerHTML = '<option value="">Load from Config...</option>' +
            Object.entries(items).map(([k, v]) => `<option value="${k}">${v.name || k}</option>`).join('');
    }

    _loadFromConfig(key) {
        const items = CONFIG_EQUIPMENT[this.category];
        const def = items && items[key];
        if (!def) return;
        this._clearForm();
        document.getElementById('eq-key').value = key;
        document.getElementById('eq-name').value = def.name || key;

        if (this.category === 'weapon' && def.ranged) {
            document.getElementById('eq-ranged').checked = true;
            document.getElementById('eq-range').value = def.range || 5;
            document.getElementById('eq-projChar').value = def.projectileChar || '';
            document.getElementById('eq-projColor').value = def.projectileColor || '#ffaa33';
            document.getElementById('eq-skinKey').value = def.skinKey || '';
        }

        if (def.effects) {
            this._effectPicker.setEffects(def.effects);
        } else {
            this._effectPicker.setEffects(this._legacyToEffects(def));
        }
        this._schedulePreview();
        this._pushUndoState();
    }

    _legacyToEffects(def) {
        const effects = [];
        const statKeys = STAT_KEYS.map(s => s.value);
        const skipKeys = new Set(['ranged', 'range', 'projectileChar', 'projectileColor', 'skinKey']);
        for (const key of statKeys) {
            if (skipKeys.has(key)) continue;
            if (def[key] !== undefined && def[key] !== 0) {
                effects.push({ type: 'stat_bonus', stat: key, value: def[key], context: 'passive' });
            }
        }
        if (def.pedestal) {
            for (const [k, v] of Object.entries(def.pedestal)) {
                if (k === 'radius' || k === 'manaCost') continue;
                if (typeof v === 'boolean') continue;
                effects.push({
                    type: 'stat_bonus', stat: k, value: v,
                    context: 'aura', radius: def.pedestal.radius === 'global' ? 99 : (def.pedestal.radius || 8),
                });
            }
        }
        return effects;
    }

    _duplicateDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        document.getElementById('eq-key').value = data.key + '_copy';
        document.getElementById('eq-name').value = (data.name || data.key) + ' Copy';
        this._schedulePreview();
        this._pushUndoState();
    }

    _validateForm() {
        const keyField = document.getElementById('eq-key');
        const nameField = document.getElementById('eq-name');
        keyField.closest('.fe-field').classList.toggle('fe-error', !keyField.value.trim());
        nameField.closest('.fe-field').classList.toggle('fe-error', !nameField.value.trim());
    }

    _getFormSnapshot() {
        const inputs = this.container.querySelectorAll('#eq-form input, #eq-form select, #eq-form textarea');
        const snap = {};
        inputs.forEach(el => {
            const id = el.id;
            if (!id) return;
            if (el.type === 'checkbox') snap[id] = el.checked;
            else snap[id] = el.value;
        });
        snap._effects = this._effectPicker ? this._effectPicker.getEffects() : [];
        return JSON.stringify(snap);
    }

    _restoreFormSnapshot(json) {
        const snap = JSON.parse(json);
        const effects = snap._effects || [];
        delete snap._effects;
        for (const [id, val] of Object.entries(snap)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = val;
            else el.value = val;
        }
        if (this._effectPicker) this._effectPicker.setEffects(effects);
        this._updatePreview();
    }

    _pushUndoState() {
        const snap = this._getFormSnapshot();
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
        this._restoreFormSnapshot(this.undoStack[this.undoIndex]);
    }

    _redo() {
        if (this.undoIndex >= this.undoStack.length - 1) return;
        this.undoIndex++;
        this._restoreFormSnapshot(this.undoStack[this.undoIndex]);
    }
}

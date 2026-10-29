import { SPELLS, SPELL_TOMES, RESEARCH, CONFIG, SUMMON_TYPES, RECIPES } from '../core/config.js';
import { escapeHtml, escapeAttr } from '../ui/ui-utils.js';
import { toJsLiteral } from './config-source.js';

const STORAGE_KEY = 'convocation_spell_drafts';

const SCHOOLS = ['evocation', 'abjuration', 'enchantment', 'conjuration', 'transmutation', 'divination'];
const CAST_TYPES = ['auto', 'targeted'];
const TRIGGER_LABELS = {
    inCombat: 'In Combat',
    lowHealth: 'Low Health',
    woundedNearby: 'Wounded Nearby (self/ally)',
    hasTask: 'Has Task',
    always: 'Always',
    debuffNearby: 'Ally Afflicted',
    cropsNearby: 'Crops Nearby',
    canTransmute: 'Materials Available',
};

// Fields the form edits directly. Everything else on a spell def is an
// effect parameter, read by the handler for that spell's `effect` string.
const CORE_FIELDS = ['name', 'school', 'minLevel', 'manaCost', 'cooldown', 'castType', 'trigger', 'effect'];

// The game dispatches on `spell.effect` (colonist.js castSpell, main.js
// castTargetedSpell, ui.js _spellTooltip). Offer every effect the config
// already uses, with the first spell's params as the template.
const EFFECT_TEMPLATES = {};
for (const def of Object.values(SPELLS)) {
    if (!def.effect || EFFECT_TEMPLATES[def.effect]) continue;
    const params = {};
    for (const [k, v] of Object.entries(def)) if (!CORE_FIELDS.includes(k)) params[k] = v;
    EFFECT_TEMPLATES[def.effect] = params;
}
const TRIGGERS = [...new Set([...Object.keys(TRIGGER_LABELS), ...Object.values(SPELLS).map(s => s.trigger).filter(Boolean)])]
    .map(value => ({ value, label: TRIGGER_LABELS[value] || value }));

// Tome recipes live in BASE_RECIPES (equipment.js) as craft_<tomeKey>.
const TOME_STATIONS = [...new Set(['scriptorium', 'workbench',
    ...Object.values(RECIPES).filter(r => r.category === 'Tomes').map(r => r.station).filter(Boolean)])];

const REFERENCE_DATA = [
    { title: 'Spell IDs', ids: Object.keys(SPELLS) },
    { title: 'Tome IDs', ids: Object.keys(SPELL_TOMES) },
    { title: 'Summon Types', ids: Object.keys(SUMMON_TYPES) },
    { title: 'Research IDs', ids: Object.keys(RESEARCH) },
    { title: 'Resource IDs', ids: Object.keys(CONFIG.START_RESOURCES) },
];

const tomeKeyFor = (spellKey) => `tome_of_${spellKey}`;

// Param values are typed as JSON (numbers, booleans, arrays, objects); any
// other text is a plain string.
function parseParamValue(raw) {
    const s = raw.trim();
    if (s === '') return undefined;
    try { return JSON.parse(s); } catch { return raw; }
}

function formatParamValue(v) {
    if (typeof v !== 'string') return JSON.stringify(v);
    // Keep strings bare unless they would re-parse as a different JSON type.
    try { JSON.parse(v); return JSON.stringify(v); } catch { return v; }
}

let editorInstance = null;

export function launchSpellEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new SpellEditor();
    }
    editorInstance.show();
}

class SpellEditor {
    constructor() {
        this.batchItems = [];
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('spell-editor');
        this._buildDOM();
        this._bindEvents();
        this._setEffect('ranged_damage', EFFECT_TEMPLATES.ranged_damage || {});
        this._autoRestore();
        this._updateCastTypeVisibility();
        this._schedulePreview();
        this._pushUndoState();
    }

    show() { this.container.style.display = 'flex'; }
    hide() { this.container.style.display = 'none'; }

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
            <button id="sp-back">← Back</button>
            <span class="fe-sep"></span>
            <select id="sp-load-config"><option value="">Load from Config...</option></select>
            <button id="sp-duplicate">Duplicate</button>
            <span class="fe-sep"></span>
            <button id="sp-export">Export All</button>
            <button id="sp-copy">Copy Current</button>
        `;
        this.container.appendChild(toolbar);

        const configSelect = document.getElementById('sp-load-config');
        Object.entries(SPELLS).forEach(([key, def]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${def.name || key}`;
            configSelect.appendChild(opt);
        });

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel';
        formPanel.id = 'sp-form';
        formPanel.innerHTML = this._buildFormHTML();

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel';
        previewPanel.innerHTML = `
            <div class="fe-preview-tabs">
                <button class="fe-tab-btn active" data-tab="preview">Preview</button>
                <button class="fe-tab-btn" data-tab="reference">Reference</button>
            </div>
            <div class="fe-preview-content">
                <div id="sp-char-preview" style="text-align:center;padding:16px;font-size:48px;font-family:'Courier New',monospace;background:#0a0a14;border-bottom:1px solid #333;">*</div>
                <div class="fe-preview-header">
                    <span>Live Preview</span>
                    <button id="sp-copy-preview" style="font-size:10px;padding:2px 8px;">Copy</button>
                </div>
                <div class="fe-preview-code" id="sp-preview"></div>
            </div>
            <div class="fe-reference-content" id="sp-reference"></div>
        `;

        workspace.appendChild(formPanel);
        workspace.appendChild(previewPanel);
        this.container.appendChild(workspace);
    }

    _buildFormHTML() {
        return `
            <div class="fe-section-title">Spell Info</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Key (snake_case)</label>
                    <input type="text" id="sp-key" placeholder="frost_bolt">
                </div>
                <div class="fe-field">
                    <label>Display Name</label>
                    <input type="text" id="sp-name" placeholder="Frost Bolt">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>School</label>
                    <select id="sp-school">
                        ${SCHOOLS.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="fe-field">
                    <label>Min Level</label>
                    <input type="number" id="sp-minLevel" value="0" min="0" max="10">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Mana Cost</label>
                    <input type="number" id="sp-manaCost" value="8" min="1">
                </div>
                <div class="fe-field">
                    <label>Cooldown (ticks)</label>
                    <input type="number" id="sp-cooldown" value="60" min="1">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Cast Type</label>
                    <select id="sp-castType">
                        ${CAST_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div class="fe-field">
                    <label>Trigger (auto only)</label>
                    <select id="sp-trigger">
                        ${TRIGGERS.map(t => `<option value="${escapeAttr(t.value)}">${escapeHtml(t.label)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="fe-section-title">Effect</div>
            <div class="fe-field">
                <label>Effect (handler the game runs)</label>
                <select id="sp-effect">
                    ${Object.keys(EFFECT_TEMPLATES).map(k => `<option value="${escapeAttr(k)}">${escapeHtml(k)}</option>`).join('')}
                </select>
            </div>
            <div style="color:#666;font-size:10px;margin:4px 0;">Params are flat fields on the spell. Values are JSON (numbers, true/false, [..], {..}); anything else is text.</div>
            <div id="sp-params"></div>
            <button id="sp-add-param" class="fe-add-btn" style="margin-top:4px;">+ Param</button>

            <div class="fe-section-title">Tome</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Tome Name</label>
                    <input type="text" id="sp-tomeName" placeholder="Tome of Frost Bolt">
                </div>
                <div class="fe-field">
                    <label>Trade Value</label>
                    <input type="number" id="sp-tradeValue" value="20" min="0">
                </div>
            </div>
            <div class="fe-field">
                <label>Tome Description</label>
                <input type="text" id="sp-tomeDesc" placeholder="Teaches ...">
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Learning Work (ticks)</label>
                    <input type="number" id="sp-learningWork" value="60" min="1">
                </div>
                <div class="fe-field">
                    <label>Min School Level</label>
                    <input type="number" id="sp-tomeMinLevel" value="0" min="0">
                </div>
            </div>

            <div class="fe-section-title">Tome Recipe</div>
            <div class="fe-field">
                <label>Craft Cost (e.g. planks:3, runite:1)</label>
                <input type="text" id="sp-craftCost" placeholder="planks:3, runite:1">
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Craft Ticks</label>
                    <input type="number" id="sp-craftTicks" value="30" min="1">
                </div>
                <div class="fe-field">
                    <label>Station</label>
                    <select id="sp-station">
                        ${TOME_STATIONS.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="fe-field">
                    <label>Research Required</label>
                    <input type="text" id="sp-research" placeholder="arcane_studies" value="arcane_studies">
                </div>
            </div>

            <div style="margin-top:16px;">
                <button id="sp-add-batch" class="fe-add-btn" style="padding:6px 16px;font-size:12px;">+ Add to Batch</button>
            </div>

            <div class="fe-section-title" style="margin-top:24px;">Batch Items</div>
            <div id="sp-batch-list"></div>
        `;
    }

    _bindEvents() {
        document.getElementById('sp-back').addEventListener('click', () => this._goBack());
        document.getElementById('sp-duplicate').addEventListener('click', () => this._duplicateDraft());
        document.getElementById('sp-export').addEventListener('click', () => this._showExportModal());
        document.getElementById('sp-copy').addEventListener('click', () => this._copyPreview());
        document.getElementById('sp-copy-preview').addEventListener('click', () => this._copyPreview());
        document.getElementById('sp-add-batch').addEventListener('click', () => this._addToBatch());

        document.getElementById('sp-load-config').addEventListener('change', (e) => {
            if (e.target.value) this._loadFromConfig(e.target.value);
            e.target.value = '';
        });

        document.getElementById('sp-castType').addEventListener('change', () => this._updateCastTypeVisibility());

        // Switching effect swaps in that effect's template params, keeping any
        // value the user already set for a param of the same name.
        document.getElementById('sp-effect').addEventListener('change', (e) => {
            const current = this._collectParams();
            const template = EFFECT_TEMPLATES[e.target.value] || {};
            const merged = {};
            for (const k of Object.keys(template)) merged[k] = k in current ? current[k] : template[k];
            this._setEffect(e.target.value, merged);
        });

        document.getElementById('sp-add-param').addEventListener('click', () => {
            document.getElementById('sp-params').insertAdjacentHTML('beforeend', this._paramRowHtml('', ''));
        });
        document.getElementById('sp-params').addEventListener('click', (e) => {
            if (!e.target.classList.contains('sp-param-del')) return;
            e.target.closest('.fe-list-row').remove();
            this._schedulePreview();
        });

        this.container.querySelectorAll('.fe-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        this.container.addEventListener('input', () => this._schedulePreview());
        this.container.addEventListener('change', () => this._schedulePreview());

        window.addEventListener('keydown', (e) => {
            if (this.container.style.display === 'none') return;
            const t = e.target;
            const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
            // Leave Ctrl+Z / Ctrl+Y to the browser's native text undo while typing.
            if (typing) return;
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
            if (e.key === 'Escape' && !this.container.querySelector('.fe-export-modal')) this._goBack();
        });
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
        const container = document.getElementById('sp-reference');
        let html = `<input type="text" class="fe-ref-search" placeholder="Search IDs..." id="sp-ref-search">`;
        html += `<div id="sp-ref-list">`;
        for (const cat of REFERENCE_DATA) {
            html += `<div class="fe-ref-category">`;
            html += `<div class="fe-ref-category-title">${cat.title}</div>`;
            for (const id of cat.ids) {
                html += `<span class="fe-ref-id" data-ref-id="${escapeAttr(id)}">${escapeHtml(id)}</span>`;
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

        document.getElementById('sp-ref-search').addEventListener('input', (e) => {
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

    _updateCastTypeVisibility() {
        const castType = document.getElementById('sp-castType').value;
        document.getElementById('sp-trigger').closest('.fe-field').style.display = castType === 'auto' ? '' : 'none';
    }

    _paramRowHtml(key, value) {
        return `<div class="fe-list-row" style="margin-bottom:4px;">
            <input type="text" class="sp-param-key" value="${escapeAttr(key)}" placeholder="param" style="width:130px;">
            <input type="text" class="sp-param-val" value="${escapeAttr(value)}" placeholder="value" style="flex:1;">
            <button class="fe-remove-btn sp-param-del">✕</button>
        </div>`;
    }

    _setEffect(effect, params) {
        const sel = document.getElementById('sp-effect');
        if (effect && ![...sel.options].some(o => o.value === effect)) {
            // Effect not used by any base spell (e.g. from a mod draft): keep it selectable.
            const opt = document.createElement('option');
            opt.value = effect;
            opt.textContent = effect;
            sel.appendChild(opt);
        }
        sel.value = effect;
        document.getElementById('sp-params').innerHTML = Object.entries(params || {})
            .map(([k, v]) => this._paramRowHtml(k, formatParamValue(v))).join('');
        this._schedulePreview();
    }

    _collectParams() {
        const params = {};
        document.querySelectorAll('#sp-params .fe-list-row').forEach(row => {
            const k = row.querySelector('.sp-param-key').value.trim();
            if (!k || CORE_FIELDS.includes(k)) return;
            const v = parseParamValue(row.querySelector('.sp-param-val').value);
            if (v !== undefined) params[k] = v;
        });
        return params;
    }

    _updateCharPreview() {
        const params = this._collectParams();
        const preview = document.getElementById('sp-char-preview');
        if (preview) {
            preview.textContent = typeof params.projectileChar === 'string' ? params.projectileChar : '*';
            preview.style.color = typeof params.projectileColor === 'string' ? params.projectileColor : '#ffaa33';
        }
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
        const code = data ? this._formatOutput(data) : '// Fill in fields to see preview';
        document.getElementById('sp-preview').textContent = code;
    }

    _validateForm() {
        const key = document.getElementById('sp-key');
        const name = document.getElementById('sp-name');
        key.closest('.fe-field').classList.toggle('fe-error', !key.value.trim());
        name.closest('.fe-field').classList.toggle('fe-error', !name.value.trim());
    }

    _collectFormData() {
        const key = document.getElementById('sp-key').value.trim();
        const name = document.getElementById('sp-name').value.trim();
        if (!key) return null;

        const data = {
            key,
            name: name || key,
            school: document.getElementById('sp-school').value,
            minLevel: parseInt(document.getElementById('sp-minLevel').value) || 0,
            manaCost: parseInt(document.getElementById('sp-manaCost').value) || 8,
            cooldown: parseInt(document.getElementById('sp-cooldown').value) || 60,
            castType: document.getElementById('sp-castType').value,
        };

        if (data.castType === 'auto') {
            data.trigger = document.getElementById('sp-trigger').value;
        }

        data.effect = document.getElementById('sp-effect').value;
        data.params = this._collectParams();

        data.tome = {
            name: document.getElementById('sp-tomeName').value.trim() || `Tome of ${data.name}`,
            tradeValue: parseInt(document.getElementById('sp-tradeValue').value) || 0,
            description: document.getElementById('sp-tomeDesc').value.trim(),
            learningWork: parseInt(document.getElementById('sp-learningWork').value) || 60,
            minSchoolLevel: parseInt(document.getElementById('sp-tomeMinLevel').value) || 0,
            craftCost: this._parseCost(document.getElementById('sp-craftCost').value),
            craftTicks: parseInt(document.getElementById('sp-craftTicks').value) || 30,
            station: document.getElementById('sp-station').value || 'scriptorium',
            research: document.getElementById('sp-research').value.trim(),
        };

        return data;
    }

    _parseCost(str) {
        const cost = {};
        if (!str.trim()) return cost;
        str.split(',').forEach(part => {
            const [k, v] = part.split(':').map(s => s.trim());
            if (k && v) cost[k] = parseInt(v) || 1;
        });
        return cost;
    }

    // Build the three config entries in the shape the game reads.
    _buildEntries(data) {
        const spell = {};
        for (const f of ['name', 'school', 'minLevel', 'manaCost', 'cooldown', 'castType', 'trigger', 'effect']) {
            if (data[f] !== undefined) spell[f] = data[f];
        }
        Object.assign(spell, data.params || {});

        const t = data.tome || {};
        const tomeKey = tomeKeyFor(data.key);
        const tome = { name: t.name || `Tome of ${data.name}` };
        if (t.tradeValue) tome.tradeValue = t.tradeValue;
        tome.spell = data.key;
        tome.learningWork = t.learningWork || 60;
        tome.minSchoolLevel = t.minSchoolLevel || 0;
        if (t.description) tome.description = t.description;

        const recipe = { input: t.craftCost || {}, output: { [tomeKey]: 1 }, skill: 'crafting', ticks: t.craftTicks || 30, station: t.station || 'scriptorium' };
        if (t.research) recipe.research = t.research;
        recipe.category = 'Tomes';

        return { spell, tomeKey, tome, recipeKey: `craft_${tomeKey}`, recipe };
    }

    _entryLine(key, value) {
        return `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${toJsLiteral(value, { inline: true })},\n`;
    }

    _formatOutput(data) {
        if (!data) return '';
        const e = this._buildEntries(data);
        let out = '// === Add to SPELLS in js/core/config/magic.js ===\n';
        out += this._entryLine(data.key, e.spell) + '\n';
        out += '// === Add to SPELL_TOMES in js/core/config/magic.js ===\n';
        out += this._entryLine(e.tomeKey, e.tome) + '\n';
        out += '// === Add to BASE_RECIPES in js/core/config/equipment.js ===\n';
        out += this._entryLine(e.recipeKey, e.recipe);
        return out;
    }

    _addToBatch() {
        const data = this._collectFormData();
        if (!data || !data.key) {
            this._validateForm();
            return;
        }

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
        document.getElementById('sp-key').value = '';
        document.getElementById('sp-name').value = '';
        document.getElementById('sp-school').value = 'evocation';
        document.getElementById('sp-minLevel').value = '0';
        document.getElementById('sp-manaCost').value = '8';
        document.getElementById('sp-cooldown').value = '60';
        document.getElementById('sp-castType').value = 'auto';
        document.getElementById('sp-trigger').value = 'inCombat';
        document.getElementById('sp-tomeName').value = '';
        document.getElementById('sp-tradeValue').value = '20';
        document.getElementById('sp-tomeDesc').value = '';
        document.getElementById('sp-learningWork').value = '60';
        document.getElementById('sp-tomeMinLevel').value = '0';
        document.getElementById('sp-craftCost').value = '';
        document.getElementById('sp-craftTicks').value = '30';
        document.getElementById('sp-station').value = 'scriptorium';
        document.getElementById('sp-research').value = 'arcane_studies';
        this._setEffect('ranged_damage', EFFECT_TEMPLATES.ranged_damage || {});
        this._updateCastTypeVisibility();
    }

    _renderBatchList() {
        const container = document.getElementById('sp-batch-list');
        if (!this.batchItems.length) {
            container.innerHTML = '<div style="color:#666;font-size:11px;">No spells in batch yet.</div>';
            return;
        }
        let html = `<table class="fe-batch-table"><thead><tr>
            <th>School</th><th>Key</th><th>Name</th><th>Effect</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.batchItems.forEach((item, i) => {
            html += `<tr>
                <td>${escapeHtml(item.school)}</td>
                <td>${escapeHtml(item.key)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.effect || '-')}</td>
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

    _editBatchItem(index) {
        const item = this.batchItems[index];
        if (!item) return;
        this._populateForm(item);
        this.batchItems.splice(index, 1);
        this._renderBatchList();
        this._schedulePreview();
    }

    _removeBatchItem(index) {
        this.batchItems.splice(index, 1);
        this._renderBatchList();
        this._schedulePreview();
    }

    _populateForm(data) {
        data = this._upgradeLegacyDraft(data);
        document.getElementById('sp-key').value = data.key || '';
        document.getElementById('sp-name').value = data.name || '';
        document.getElementById('sp-school').value = data.school || 'evocation';
        document.getElementById('sp-minLevel').value = data.minLevel || 0;
        document.getElementById('sp-manaCost').value = data.manaCost || 8;
        document.getElementById('sp-cooldown').value = data.cooldown || 60;
        document.getElementById('sp-castType').value = data.castType || 'auto';
        const trig = document.getElementById('sp-trigger');
        if (data.trigger && ![...trig.options].some(o => o.value === data.trigger)) {
            const opt = document.createElement('option');
            opt.value = data.trigger;
            opt.textContent = data.trigger;
            trig.appendChild(opt);
        }
        trig.value = data.trigger || 'inCombat';

        this._setEffect(data.effect || 'ranged_damage', data.params || {});

        const t = data.tome || {};
        document.getElementById('sp-tomeName').value = t.name || '';
        document.getElementById('sp-tradeValue').value = t.tradeValue ?? 20;
        document.getElementById('sp-tomeDesc').value = t.description || '';
        document.getElementById('sp-learningWork').value = t.learningWork || 60;
        document.getElementById('sp-tomeMinLevel').value = t.minSchoolLevel || 0;
        document.getElementById('sp-craftCost').value = Object.entries(t.craftCost || {}).map(([k, v]) => `${k}:${v}`).join(', ');
        document.getElementById('sp-craftTicks').value = t.craftTicks || 30;
        const station = document.getElementById('sp-station');
        if (t.station && ![...station.options].some(o => o.value === t.station)) {
            const opt = document.createElement('option');
            opt.value = t.station;
            opt.textContent = t.station;
            station.appendChild(opt);
        }
        station.value = t.station || 'scriptorium';
        document.getElementById('sp-research').value = t.research ?? 'arcane_studies';

        this._updateCastTypeVisibility();
        this._schedulePreview();
    }

    // Drafts saved by the old editor used an `effects: [...]` array and a
    // tome without station. Map the first effect onto the flat schema.
    _upgradeLegacyDraft(data) {
        if (data.effect || !Array.isArray(data.effects)) return data;
        const out = { ...data };
        delete out.effects;
        const e = data.effects[0];
        if (e) {
            const params = { ...e };
            delete params.type; delete params.context; delete params.stacking;
            if (e.type === 'damage') {
                out.effect = e.radius ? 'ranged_damage_aoe' : 'ranged_damage';
                params.damage = params.value; delete params.value;
            } else if (e.type === 'heal') {
                out.effect = 'heal';
                params.healAmount = params.value; delete params.value;
            } else if (e.type === 'divination') {
                out.effect = 'divination_modifier';
            } else {
                out.effect = e.type;
            }
            out.params = params;
        }
        return out;
    }

    _loadFromConfig(key) {
        const def = SPELLS[key];
        if (!def) return;
        const data = { key, params: {} };
        for (const [k, v] of Object.entries(def)) {
            if (CORE_FIELDS.includes(k)) data[k] = v;
            else data.params[k] = v;
        }
        const tomeKey = Object.keys(SPELL_TOMES).find(k => SPELL_TOMES[k].spell === key) || tomeKeyFor(key);
        const tome = SPELL_TOMES[tomeKey];
        const recipe = RECIPES[`craft_${tomeKey}`];
        data.tome = {
            // Leave the standard name blank so it keeps following the spell name.
            name: tome?.name && tome.name !== `Tome of ${def.name}` ? tome.name : '',
            tradeValue: tome?.tradeValue ?? 20,
            description: tome?.description || '',
            learningWork: tome?.learningWork || 60,
            minSchoolLevel: tome?.minSchoolLevel || 0,
            craftCost: recipe ? { ...recipe.input } : {},
            craftTicks: recipe?.ticks || 30,
            station: recipe?.station || 'scriptorium',
            research: recipe ? (recipe.research || '') : 'arcane_studies',
        };
        this._populateForm(data);
        this._pushUndoState();
    }

    _duplicateDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        document.getElementById('sp-key').value = data.key + '_copy';
        document.getElementById('sp-name').value = (data.name || data.key) + ' Copy';
        this._schedulePreview();
        this._pushUndoState();
    }

    _copyPreview() {
        const text = document.getElementById('sp-preview').textContent;
        navigator.clipboard.writeText(text);
    }

    _showExportModal() {
        if (!this.batchItems.length) return;
        const entries = this.batchItems.map(item => [item, this._buildEntries(item)]);
        let output = '';
        output += '// === Add to SPELLS in js/core/config/magic.js ===\n';
        for (const [item, e] of entries) output += this._entryLine(item.key, e.spell);
        output += '\n// === Add to SPELL_TOMES in js/core/config/magic.js ===\n';
        for (const [, e] of entries) output += this._entryLine(e.tomeKey, e.tome);
        output += '\n// === Add to BASE_RECIPES in js/core/config/equipment.js ===\n';
        for (const [, e] of entries) output += this._entryLine(e.recipeKey, e.recipe);

        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export All Spells (${this.batchItems.length} items)</div>
                <textarea readonly>${escapeHtml(output)}</textarea>
                <div class="fe-modal-actions">
                    <button id="sp-modal-copy">Copy to Clipboard</button>
                    <button id="sp-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('sp-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('sp-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('sp-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    _autoSave() {
        try {
            const state = {
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
            if (state.batch && state.batch.length) this.batchItems = state.batch.map(b => this._upgradeLegacyDraft(b));
            this._renderBatchList();
            if (state.form && state.form.key) {
                this._populateForm(state.form);
            }
        } catch {}
    }

    _getFormSnapshot() {
        const inputs = this.container.querySelectorAll('#sp-form input[id], #sp-form select[id]');
        const snap = {};
        inputs.forEach(el => {
            if (el.type === 'checkbox') snap[el.id] = el.checked;
            else snap[el.id] = el.value;
        });
        snap._params = [...document.querySelectorAll('#sp-params .fe-list-row')].map(row =>
            [row.querySelector('.sp-param-key').value, row.querySelector('.sp-param-val').value]);
        return JSON.stringify(snap);
    }

    _restoreFormSnapshot(json) {
        const snap = JSON.parse(json);
        const params = snap._params || [];
        delete snap._params;
        for (const [id, val] of Object.entries(snap)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = val;
            else el.value = val;
        }
        document.getElementById('sp-params').innerHTML = params.map(([k, v]) => this._paramRowHtml(k, v)).join('');
        this._updateCastTypeVisibility();
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

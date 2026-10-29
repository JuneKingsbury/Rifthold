import { ENTITIES, ANIMALS, SPELLS, RESEARCH, CONFIG, SUMMON_TYPES, GOLEM_TYPES, RAID_TYPES, WAVE_TYPES } from '../core/config.js';
import { EffectPicker, formatEffectsCode } from './effect-picker.js';
import { RolePicker, formatRolesCode } from './role-picker.js';
import { escapeHtml, escapeAttr } from '../ui/ui-utils.js';
import { toJsLiteral } from './config-source.js';

const STORAGE_KEY = 'convocation_entity_drafts';

const CATEGORIES = [
    { value: 'animal', label: 'Animal' },
    { value: 'enemy', label: 'Enemy' },
    { value: 'summon', label: 'Summon' },
    { value: 'golem', label: 'Golem' },
];

const SPAWN_CONDITIONS = [
    { value: '', label: 'None (always)' },
    { value: 'hostileNight', label: 'Hostile at Night/Winter' },
    { value: 'hostileWinter', label: 'Hostile in Winter' },
];

const REFERENCE_DATA = [
    { title: 'Entity IDs', ids: Object.keys(ENTITIES) },
    { title: 'Resource IDs', ids: Object.keys(CONFIG.START_RESOURCES) },
    { title: 'Spell IDs', ids: Object.keys(SPELLS) },
    { title: 'Research IDs', ids: Object.keys(RESEARCH) },
];

const CONFIG_ENTITIES = Object.entries(ENTITIES).map(([key, def]) => ({ key, ...def }));

// Entity effects are run by EFFECT_HANDLERS in entities/roles.js, which only
// implements mood_aura. Offer just that so the editor can't author no-op effects.
const ENTITY_EFFECT_TYPES = ['mood_aura'];

// Fields the form owns. Collecting starts from the def being edited, drops
// these, then re-adds them from the form, so every other field survives.
const MANAGED_FIELDS = ['name', 'category', 'char', 'color', 'hp', 'speed', 'damage', 'hostile', 'aggroRange',
    'spawnWeight', 'spawnCondition', 'meatYield', 'hideYield', 'fleeRange', 'roles', 'effects', 'tameable', 'tamed'];
// Only owned while their section is shown for the chosen category.
const SECTION_FIELDS = {
    ranged: { cats: ['enemy', 'summon'], fields: ['ranged', 'projectileChar', 'projectileColor'] },
    summon: { cats: ['summon'], fields: ['summonDuration'] },
    golem: { cats: ['golem'], fields: ['craftTicks', 'cost'] },
    loot: { cats: ['enemy'], fields: ['loot'] },
};
const MANAGED_TAMED_FIELDS = ['foodToTame', 'dangerousTame', 'baseTameChance', 'retaliationDamage', 'roles', 'effects'];

let editorInstance = null;

export function launchEntityEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new EntityEditor();
    }
    editorInstance.show();
}

class EntityEditor {
    constructor() {
        this.activeDraftKey = null;
        this._base = {};
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('entity-editor');
        this._buildDOM();
        this._bindEvents();
        this._autoRestore();
        this._updateConditionals();
        this._renderDraftList();
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
            <button id="en-back">← Back</button>
            <span class="fe-sep"></span>
            <button id="en-new">+ New</button>
            <button id="en-duplicate">Duplicate</button>
            <span class="fe-sep"></span>
            <select id="en-load-config"><option value="">Load from Config...</option></select>
            <span class="fe-sep"></span>
            <button id="en-export-all">Export All</button>
            <button id="en-copy">Copy Current</button>
        `;
        this.container.appendChild(toolbar);

        const configSelect = toolbar.querySelector('#en-load-config');
        CONFIG_ENTITIES.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.key;
            opt.textContent = `[${e.category}] ${e.char || '?'} ${e.key}`;
            configSelect.appendChild(opt);
        });

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel';
        formPanel.id = 'en-form';
        formPanel.innerHTML = this._buildFormHTML();

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel';
        previewPanel.innerHTML = `
            <div class="fe-preview-tabs">
                <button class="fe-tab-btn active" data-tab="preview">Preview</button>
                <button class="fe-tab-btn" data-tab="reference">Reference</button>
            </div>
            <div class="fe-preview-content">
                <div id="en-char-preview" style="text-align:center;padding:16px;font-size:48px;font-family:'Courier New',monospace;background:#0a0a14;border-bottom:1px solid #333;">?</div>
                <div class="fe-preview-code" id="en-preview"></div>
            </div>
            <div class="fe-reference-content" id="en-reference"></div>
        `;

        workspace.appendChild(formPanel);
        workspace.appendChild(previewPanel);
        this.container.appendChild(workspace);
    }

    _buildFormHTML() {
        return `
            <div class="fe-section-title">Basic Info</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Key (snake_case)</label>
                    <input type="text" id="en-key" placeholder="skeleton_archer">
                </div>
                <div class="fe-field">
                    <label>Category</label>
                    <select id="en-category">
                        ${CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Name (display)</label>
                    <input type="text" id="en-name" placeholder="Skeleton Archer">
                </div>
                <div class="fe-field" style="flex:0 0 60px;">
                    <label>Char</label>
                    <input type="text" id="en-char" maxlength="2" placeholder="s">
                </div>
                <div class="fe-field" style="flex:0 0 60px;">
                    <label>Color</label>
                    <input type="color" id="en-color" value="#bb8855">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>HP</label>
                    <input type="number" id="en-hp" value="40">
                </div>
                <div class="fe-field">
                    <label>Speed (0-1)</label>
                    <input type="number" id="en-speed" value="0.5" step="0.05">
                </div>
                <div class="fe-field">
                    <label>Damage</label>
                    <input type="number" id="en-damage" value="0">
                </div>
            </div>

            <div class="fe-section-title">Combat / Behavior</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Aggro Range</label>
                    <input type="number" id="en-aggroRange" value="6">
                </div>
                <div class="fe-field">
                    <label>Spawn Weight</label>
                    <input type="number" id="en-spawnWeight" value="0">
                </div>
                <div class="fe-field">
                    <label>Spawn Condition</label>
                    <select id="en-spawnCondition">
                        ${SPAWN_CONDITIONS.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="fe-checkbox-row">
                <input type="checkbox" id="en-hostile">
                <label for="en-hostile">Hostile</label>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Meat Yield</label>
                    <input type="number" id="en-meatYield" value="0">
                </div>
                <div class="fe-field">
                    <label>Hide Yield</label>
                    <input type="number" id="en-hideYield" value="0">
                </div>
                <div class="fe-field">
                    <label>Flee Range</label>
                    <input type="number" id="en-fleeRange" value="0">
                </div>
            </div>

            <div id="en-ranged-section" class="fe-conditional">
                <div class="fe-checkbox-row">
                    <input type="checkbox" id="en-ranged">
                    <label for="en-ranged">Ranged Attack</label>
                </div>
                <div id="en-ranged-fields" class="fe-conditional">
                    <div class="fe-row">
                        <div class="fe-field" style="flex:0 0 60px;">
                            <label>Proj Char</label>
                            <input type="text" id="en-projectileChar" maxlength="2" value="-">
                        </div>
                        <div class="fe-field" style="flex:0 0 60px;">
                            <label>Color</label>
                            <input type="color" id="en-projectileColor" value="#ffaa33">
                        </div>
                    </div>
                </div>
            </div>

            <div id="en-summon-section" class="fe-conditional">
                <div class="fe-section-title">Summon Settings</div>
                <div class="fe-field">
                    <label>Summon Duration (ticks)</label>
                    <input type="number" id="en-summonDuration" value="80">
                </div>
            </div>

            <div id="en-golem-section" class="fe-conditional">
                <div class="fe-section-title">Golem Crafting</div>
                <div class="fe-field">
                    <label>Craft Ticks</label>
                    <input type="number" id="en-craftTicks" value="80">
                </div>
                <div class="fe-field">
                    <label>Cost (JSON)</label>
                    <input type="text" id="en-cost" value='{"stone":10,"runite":3,"void_essence":2}'>
                </div>
            </div>

            <div id="en-loot-section" class="fe-conditional">
                <div class="fe-section-title">Loot Table</div>
                <div class="fe-field">
                    <label>Loot (JSON array)</label>
                    <input type="text" id="en-loot" value='[]' placeholder='[{"item":"bone","chance":0.5}]'>
                </div>
            </div>

            <div id="en-tame-section" class="fe-conditional">
                <div class="fe-section-title">Taming</div>
                <div class="fe-checkbox-row">
                    <input type="checkbox" id="en-tameable">
                    <label for="en-tameable">Tameable</label>
                </div>
                <div id="en-tame-fields" class="fe-conditional">
                    <div class="fe-field">
                        <label>Food to Tame</label>
                        <input type="number" id="en-tame-foodToTame" value="4">
                    </div>
                    <div class="fe-checkbox-row">
                        <input type="checkbox" id="en-tame-dangerousTame">
                        <label for="en-tame-dangerousTame">Dangerous to Tame</label>
                    </div>
                    <div id="en-tame-danger-fields" class="fe-conditional">
                        <div class="fe-row">
                            <div class="fe-field">
                                <label>Base Tame Chance (0-1)</label>
                                <input type="number" id="en-tame-baseTameChance" value="0.4" step="0.05">
                            </div>
                            <div class="fe-field">
                                <label>Retaliation Damage</label>
                                <input type="number" id="en-tame-retaliationDamage" value="12">
                            </div>
                        </div>
                    </div>
                    <div class="fe-section-title" style="margin-top:8px;">Tamed Roles</div>
                    <div id="en-tame-roles"></div>
                    <div class="fe-section-title" style="margin-top:8px;">Tamed Effects</div>
                    <div id="en-tame-effects"></div>
                </div>
            </div>

            <div class="fe-section-title">Roles</div>
            <div id="en-roles"></div>

            <div class="fe-section-title">Effects</div>
            <div id="en-effects"></div>

            <div class="fe-section-title">Saved Drafts</div>
            <div id="en-draft-list" class="fe-draft-list"></div>
        `;
    }

    _bindEvents() {
        document.getElementById('en-back').addEventListener('click', () => this._goBack());
        document.getElementById('en-new').addEventListener('click', () => this._newDraft());
        document.getElementById('en-duplicate').addEventListener('click', () => this._duplicateDraft());
        document.getElementById('en-export-all').addEventListener('click', () => this._exportAll());
        document.getElementById('en-copy').addEventListener('click', () => this._copyPreview());
        document.getElementById('en-load-config').addEventListener('change', (e) => {
            if (e.target.value) this._loadFromConfig(e.target.value);
            e.target.value = '';
        });

        document.getElementById('en-category').addEventListener('change', () => this._updateConditionals());
        document.getElementById('en-hostile').addEventListener('change', () => this._updateConditionals());
        document.getElementById('en-tameable').addEventListener('change', () => this._updateConditionals());
        document.getElementById('en-tame-dangerousTame').addEventListener('change', () => this._updateConditionals());
        document.getElementById('en-ranged').addEventListener('change', () => this._updateConditionals());

        document.getElementById('en-char').addEventListener('input', () => this._updateCharPreview());
        document.getElementById('en-color').addEventListener('input', () => this._updateCharPreview());

        const onChange = () => this._schedulePreview();

        this._rolePicker = new RolePicker(document.getElementById('en-roles'), {
            category: document.getElementById('en-category').value,
            onChange,
        });

        this._effectPicker = new EffectPicker(document.getElementById('en-effects'), {
            allowedContexts: ['passive', 'aura', 'buff', 'on_hit', 'on_cast'],
            allowedTypes: ENTITY_EFFECT_TYPES,
            onChange,
        });

        this._tamedRolePicker = new RolePicker(document.getElementById('en-tame-roles'), {
            category: 'animal',
            onChange,
        });

        this._tamedEffectPicker = new EffectPicker(document.getElementById('en-tame-effects'), {
            allowedContexts: ['passive', 'aura'],
            allowedTypes: ENTITY_EFFECT_TYPES,
            onChange,
        });

        this.container.querySelectorAll('.fe-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        this.container.addEventListener('input', () => this._schedulePreview());
        this.container.addEventListener('change', () => this._schedulePreview());

        window.addEventListener('keydown', (e) => {
            if (this.container.style.display === 'none') return;
            const t = e.target;
            // Leave Ctrl+Z / Ctrl+Y to native text undo while typing.
            if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this._undo(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this._redo(); return; }
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
        const container = document.getElementById('en-reference');
        let html = `<input type="text" class="fe-ref-search" placeholder="Search IDs..." id="en-ref-search">`;
        html += `<div id="en-ref-list">`;
        for (const cat of REFERENCE_DATA) {
            html += `<div class="fe-ref-category"><div class="fe-ref-category-title">${cat.title}</div>`;
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

        document.getElementById('en-ref-search').addEventListener('input', (e) => {
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

    _updateConditionals() {
        const category = document.getElementById('en-category').value;

        document.getElementById('en-tame-section').classList.toggle('visible', category === 'animal');
        document.getElementById('en-summon-section').classList.toggle('visible', category === 'summon');
        document.getElementById('en-golem-section').classList.toggle('visible', category === 'golem');
        document.getElementById('en-loot-section').classList.toggle('visible', category === 'enemy');
        document.getElementById('en-ranged-section').classList.toggle('visible', category === 'enemy' || category === 'summon');

        const tameable = document.getElementById('en-tameable').checked;
        document.getElementById('en-tame-fields').classList.toggle('visible', tameable);

        const dangerous = document.getElementById('en-tame-dangerousTame').checked;
        document.getElementById('en-tame-danger-fields').classList.toggle('visible', dangerous);

        const ranged = document.getElementById('en-ranged').checked;
        document.getElementById('en-ranged-fields').classList.toggle('visible', ranged);

        this._rolePicker.setCategory(category);
    }

    _updateCharPreview() {
        const char = document.getElementById('en-char').value || '?';
        const color = document.getElementById('en-color').value;
        const preview = document.getElementById('en-char-preview');
        preview.textContent = char;
        preview.style.color = color;
    }

    _schedulePreview() {
        clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => {
            this._updatePreview();
            this._scheduleDraftSave();
            this._scheduleUndoPush();
        }, 50);
    }

    _scheduleDraftSave() {
        clearTimeout(this._draftSaveTimer);
        this._draftSaveTimer = setTimeout(() => this._autoSaveDraft(), 500);
    }

    _updatePreview() {
        this._updateCharPreview();
        this._validateForm();
        const data = this._collectFormData();
        const code = data ? this._formatOutput(data) : '// Fill in fields to see preview';
        document.getElementById('en-preview').textContent = code;
    }

    _autoSaveDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        const saved = this._getSaved();
        const prevKey = this.activeDraftKey;
        const keyField = document.getElementById('en-key').closest('.fe-field');
        // Renaming onto another draft's key would silently replace that draft.
        const clash = prevKey != null && prevKey !== data.key && saved.some(s => s.key === data.key);
        keyField.classList.toggle('fe-error', clash);
        keyField.title = clash ? `A draft named "${data.key}" already exists` : '';
        if (clash) return;
        // A key edit renames the active draft instead of leaving the old one orphaned.
        const idx = saved.findIndex(s => s.key === (prevKey ?? data.key));
        if (idx >= 0) saved[idx] = data;
        else saved.push(data);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { return; }
        this.activeDraftKey = data.key;
        this._renderDraftList();
        try { localStorage.setItem(STORAGE_KEY + '_active', data.key); } catch {}
    }

    _autoRestore() {
        try {
            const activeKey = localStorage.getItem(STORAGE_KEY + '_active');
            if (activeKey) {
                const saved = this._getSaved();
                const item = saved.find(s => s.key === activeKey);
                if (item) {
                    this.activeDraftKey = activeKey;
                    this._populateForm(item);
                    return;
                }
            }
        } catch {}
    }

    _newDraft() {
        this._autoSaveDraft();
        this._clearForm();
        this.activeDraftKey = null;
        localStorage.removeItem(STORAGE_KEY + '_active');
        this._renderDraftList();
        this._schedulePreview();
    }

    _clearForm() {
        document.getElementById('en-key').value = '';
        document.getElementById('en-name').value = '';
        document.getElementById('en-category').value = 'animal';
        document.getElementById('en-char').value = '';
        document.getElementById('en-color').value = '#bb8855';
        document.getElementById('en-hp').value = '40';
        document.getElementById('en-speed').value = '0.5';
        document.getElementById('en-damage').value = '0';
        document.getElementById('en-aggroRange').value = '6';
        document.getElementById('en-spawnWeight').value = '0';
        document.getElementById('en-spawnCondition').value = '';
        document.getElementById('en-hostile').checked = false;
        document.getElementById('en-meatYield').value = '0';
        document.getElementById('en-hideYield').value = '0';
        document.getElementById('en-fleeRange').value = '0';
        document.getElementById('en-ranged').checked = false;
        document.getElementById('en-projectileChar').value = '-';
        document.getElementById('en-projectileColor').value = '#ffaa33';
        document.getElementById('en-summonDuration').value = '80';
        document.getElementById('en-craftTicks').value = '80';
        document.getElementById('en-cost').value = '{"stone":10,"runite":3,"void_essence":2}';
        document.getElementById('en-loot').value = '[]';
        document.getElementById('en-tameable').checked = false;
        document.getElementById('en-tame-foodToTame').value = '4';
        document.getElementById('en-tame-dangerousTame').checked = false;
        document.getElementById('en-tame-baseTameChance').value = '0.4';
        document.getElementById('en-tame-retaliationDamage').value = '12';
        this._base = {};
        this._rolePicker.clear();
        this._effectPicker.clear();
        this._tamedRolePicker.clear();
        this._tamedEffectPicker.clear();
        this._updateConditionals();
    }

    _renderDraftList() {
        const container = document.getElementById('en-draft-list');
        const saved = this._getSaved();
        if (!saved.length) {
            container.innerHTML = '<div style="color:#666;font-size:11px;">No drafts yet.</div>';
            return;
        }
        container.innerHTML = saved.map(item => `
            <div class="fe-draft-row${item.key === this.activeDraftKey ? ' active' : ''}" data-draft-key="${escapeAttr(item.key)}">
                <span class="fe-draft-char" style="color:${escapeAttr(item.color || '#ccc')}">${escapeHtml(item.char || '?')}</span>
                <span class="fe-draft-key">[${escapeHtml(item.category || '?')}] ${escapeHtml(item.key)}</span>
                <span class="fe-draft-actions">
                    <button data-draft-load="${escapeAttr(item.key)}">Edit</button>
                    <button data-draft-del="${escapeAttr(item.key)}" class="fe-draft-del">✕</button>
                </span>
            </div>
        `).join('');

        container.querySelectorAll('[data-draft-load]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._loadDraft(btn.dataset.draftLoad); });
        });
        container.querySelectorAll('[data-draft-del]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._deleteDraft(btn.dataset.draftDel); });
        });
    }

    _loadDraft(key) {
        const saved = this._getSaved();
        const item = saved.find(s => s.key === key);
        if (!item) return;
        this.activeDraftKey = key;
        this._populateForm(item);
        this._renderDraftList();
        localStorage.setItem(STORAGE_KEY + '_active', key);
    }

    _deleteDraft(key) {
        const saved = this._getSaved().filter(s => s.key !== key);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        if (this.activeDraftKey === key) {
            this.activeDraftKey = null;
            localStorage.removeItem(STORAGE_KEY + '_active');
        }
        this._renderDraftList();
    }

    _collectFormData() {
        const key = document.getElementById('en-key').value.trim();
        if (!key) return null;

        const category = document.getElementById('en-category').value;
        const base = this._base || {};
        const data = { ...base, key };
        for (const f of MANAGED_FIELDS) delete data[f];
        for (const { cats, fields } of Object.values(SECTION_FIELDS)) {
            if (cats.includes(category)) for (const f of fields) delete data[f];
        }

        data.name = document.getElementById('en-name').value.trim() || undefined;
        data.category = category;
        data.char = document.getElementById('en-char').value.trim() || '?';
        // A def loaded from config/drafts only gains a field the user actually set:
        // an untouched form default is not written onto a def that never had it.
        const loaded = Object.keys(base).length > 1;
        const color = document.getElementById('en-color').value;
        if ('color' in base || !loaded || color !== '#bb8855') data.color = color;
        // Zero is omitted unless the def had the field, so explicit zeros survive.
        const num = (field, id, def, required = false) => {
            const v = parseFloat(document.getElementById(id).value);
            if (!Number.isFinite(v)) { if (required && !loaded) data[field] = def; return; }
            if (field in base) { data[field] = v; return; }
            if (loaded && v === def) return;
            if (v !== 0 || required) data[field] = v;
        };
        num('hp', 'en-hp', 40, true);
        num('speed', 'en-speed', 0.5, true);
        num('damage', 'en-damage', 0);

        const hostile = document.getElementById('en-hostile').checked;
        if (hostile) data.hostile = true;
        else if ('hostile' in base) data.hostile = false;

        if (hostile || 'aggroRange' in base) num('aggroRange', 'en-aggroRange', 6);
        num('spawnWeight', 'en-spawnWeight', 0);

        const spawnCondition = document.getElementById('en-spawnCondition').value;
        if (spawnCondition) data.spawnCondition = spawnCondition;

        num('meatYield', 'en-meatYield', 0);
        num('hideYield', 'en-hideYield', 0);
        num('fleeRange', 'en-fleeRange', 0);

        if (category === 'enemy' || category === 'summon') {
            const ranged = document.getElementById('en-ranged').checked;
            if (ranged) {
                data.ranged = true;
                data.projectileChar = document.getElementById('en-projectileChar').value || '-';
                data.projectileColor = document.getElementById('en-projectileColor').value;
            }
        }

        if (category === 'summon') {
            data.summonDuration = parseInt(document.getElementById('en-summonDuration').value) || 80;
        }

        if (category === 'golem') {
            data.craftTicks = parseInt(document.getElementById('en-craftTicks').value) || 80;
            try { data.cost = JSON.parse(document.getElementById('en-cost').value); } catch { data.cost = base.cost ?? {}; }
        }

        if (category === 'enemy') {
            try { data.loot = JSON.parse(document.getElementById('en-loot').value); } catch { data.loot = base.loot ?? []; }
        }

        const roles = this._rolePicker.getRoles();
        if (roles.length || 'roles' in base) data.roles = roles;

        const effects = this._effectPicker.getEffects();
        if (effects.length || 'effects' in base) data.effects = effects;

        if (category === 'animal') {
            const tameable = document.getElementById('en-tameable').checked;
            if (tameable) {
                data.tameable = true;
                const tamed = { ...(base.tamed || {}) };
                for (const f of MANAGED_TAMED_FIELDS) delete tamed[f];
                tamed.foodToTame = parseInt(document.getElementById('en-tame-foodToTame').value) || 4;
                if (document.getElementById('en-tame-dangerousTame').checked) {
                    tamed.dangerousTame = true;
                    tamed.baseTameChance = parseFloat(document.getElementById('en-tame-baseTameChance').value) || 0.4;
                    tamed.retaliationDamage = parseInt(document.getElementById('en-tame-retaliationDamage').value) || 12;
                }
                const tamedRoles = this._tamedRolePicker.getRoles();
                if (tamedRoles.length || 'roles' in (base.tamed || {})) tamed.roles = tamedRoles;
                const tamedEffects = this._tamedEffectPicker.getEffects();
                if (tamedEffects.length || 'effects' in (base.tamed || {})) tamed.effects = tamedEffects;
                data.tamed = tamed;
            }
        } else {
            // Taming isn't editable outside the animal category; keep what the def had.
            if ('tameable' in base) data.tameable = base.tameable;
            if ('tamed' in base) data.tamed = base.tamed;
        }

        return data;
    }

    _formatOutput(data) {
        if (!data) return '';
        const def = { ...data };
        delete def.key;
        const key = /^[A-Za-z_$][\w$]*$/.test(data.key) ? data.key : JSON.stringify(data.key);
        return `${key}: ${toJsLiteral(def)},`;
    }

    _copyPreview() {
        const text = document.getElementById('en-preview').textContent;
        navigator.clipboard.writeText(text);
    }

    _exportAll() {
        const saved = this._getSaved();
        if (!saved.length) return;
        let output = '// === Add to ENTITIES in config.js ===\n';
        saved.forEach(item => { output += this._formatOutput(item) + '\n\n'; });
        output = output.trimEnd();

        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export All Entities (${saved.length} items)</div>
                <textarea readonly>${escapeHtml(output)}</textarea>
                <div class="fe-modal-actions">
                    <button id="en-modal-copy">Copy to Clipboard</button>
                    <button id="en-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('en-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('en-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('en-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    _populateForm(data) {
        this._base = { ...data };
        document.getElementById('en-key').value = data.key || '';
        document.getElementById('en-name').value = data.name || '';
        const catSel = document.getElementById('en-category');
        if (data.category && ![...catSel.options].some(o => o.value === data.category)) {
            // e.g. 'boss' defs: keep their category rather than blanking it.
            const opt = document.createElement('option');
            opt.value = data.category;
            opt.textContent = data.category;
            catSel.appendChild(opt);
        }
        catSel.value = data.category || 'animal';
        document.getElementById('en-char').value = data.char || '';
        document.getElementById('en-color').value = data.color || '#bb8855';
        document.getElementById('en-hp').value = data.hp ?? 40;
        document.getElementById('en-speed').value = data.speed ?? 0.5;
        document.getElementById('en-damage').value = data.damage ?? 0;
        document.getElementById('en-hostile').checked = !!data.hostile;
        document.getElementById('en-aggroRange').value = data.aggroRange ?? 6;
        document.getElementById('en-spawnWeight').value = data.spawnWeight ?? 0;
        document.getElementById('en-spawnCondition').value = data.spawnCondition || '';
        document.getElementById('en-meatYield').value = data.meatYield ?? 0;
        document.getElementById('en-hideYield').value = data.hideYield ?? 0;
        document.getElementById('en-fleeRange').value = data.fleeRange ?? 0;
        document.getElementById('en-ranged').checked = !!data.ranged;
        document.getElementById('en-projectileChar').value = data.projectileChar || '-';
        document.getElementById('en-projectileColor').value = data.projectileColor || '#ffaa33';
        document.getElementById('en-summonDuration').value = data.summonDuration || 80;
        document.getElementById('en-craftTicks').value = data.craftTicks || 80;
        document.getElementById('en-cost').value = JSON.stringify(data.cost || {});
        document.getElementById('en-loot').value = JSON.stringify(data.loot || []);

        this._rolePicker.setCategory(data.category || 'animal');
        this._rolePicker.setRoles(data.roles || []);
        this._effectPicker.setEffects(data.effects || []);

        document.getElementById('en-tameable').checked = !!data.tameable;
        if (data.tamed) {
            document.getElementById('en-tame-foodToTame').value = data.tamed.foodToTame || 4;
            document.getElementById('en-tame-dangerousTame').checked = !!data.tamed.dangerousTame;
            if (data.tamed.dangerousTame) {
                document.getElementById('en-tame-baseTameChance').value = data.tamed.baseTameChance || 0.4;
                document.getElementById('en-tame-retaliationDamage').value = data.tamed.retaliationDamage || 12;
            }
            this._tamedRolePicker.setRoles(data.tamed.roles || this._legacyToRoles(data.tamed));
            this._tamedEffectPicker.setEffects(data.tamed.effects || this._legacyToEffects(data.tamed));
        } else {
            this._tamedRolePicker.clear();
            this._tamedEffectPicker.clear();
        }

        this._updateConditionals();
        this._schedulePreview();
    }

    _loadFromConfig(key) {
        const def = ENTITIES[key];
        if (!def) return;
        const data = { key, ...def };
        if (def.tamed) data.tameable = true;
        this._populateForm(data);
        this.activeDraftKey = null;
        this._renderDraftList();
        this._schedulePreview();
        this._pushUndoState();
    }

    _legacyToRoles(tamed) {
        const roles = [];
        if (tamed.guardAnimal) roles.push({ type: 'guard', guardRadius: tamed.guardRadius || 8, guardDamage: tamed.guardDamage || 8 });
        if (tamed.produces) roles.push({ type: 'production', produces: tamed.produces, produceRate: tamed.produceRate || 80, produceAmount: tamed.produceAmount || 1 });
        if (tamed.packAnimal) roles.push({ type: 'pack', expeditionSpeedBonus: tamed.expeditionSpeedBonus || 0.25 });
        return roles;
    }

    _legacyToEffects(tamed) {
        const effects = [];
        if (tamed.happinessAura) {
            effects.push({ type: 'mood_aura', scope: 'aura', radius: tamed.auraRadius || 5, moodBonus: tamed.auraMoodBonus || 5 });
        }
        return effects;
    }

    _duplicateDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        data.key = data.key + '_copy';
        this._populateForm(data);
        this.activeDraftKey = null;
        this._renderDraftList();
        this._schedulePreview();
        this._pushUndoState();
    }

    _getFormSnapshot() {
        const inputs = this.container.querySelectorAll('#en-form input, #en-form select');
        const snap = {};
        inputs.forEach(el => {
            const id = el.id;
            if (!id) return;
            if (el.type === 'checkbox') snap[id] = el.checked;
            else snap[id] = el.value;
        });
        snap._roles = this._rolePicker.getRoles();
        snap._effects = this._effectPicker.getEffects();
        snap._tamedRoles = this._tamedRolePicker.getRoles();
        snap._tamedEffects = this._tamedEffectPicker.getEffects();
        snap._base = this._base;
        snap._activeDraftKey = this.activeDraftKey;
        return JSON.stringify(snap);
    }

    _restoreFormSnapshot(json) {
        const snap = JSON.parse(json);
        const roles = snap._roles || [];
        const effects = snap._effects || [];
        const tamedRoles = snap._tamedRoles || [];
        const tamedEffects = snap._tamedEffects || [];
        delete snap._roles;
        delete snap._effects;
        delete snap._tamedRoles;
        delete snap._tamedEffects;
        this._base = snap._base || {};
        this.activeDraftKey = snap._activeDraftKey ?? this.activeDraftKey;
        delete snap._base;
        delete snap._activeDraftKey;
        for (const [id, val] of Object.entries(snap)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = val;
            else el.value = val;
        }
        this._rolePicker.setRoles(roles);
        this._effectPicker.setEffects(effects);
        this._tamedRolePicker.setRoles(tamedRoles);
        this._tamedEffectPicker.setEffects(tamedEffects);
        this._updateConditionals();
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

    _validateForm() {
        const key = document.getElementById('en-key');
        const char = document.getElementById('en-char');
        key.closest('.fe-field').classList.toggle('fe-error', !key.value.trim());
        char.closest('.fe-field').classList.toggle('fe-error', !char.value.trim());
    }

    _getSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }
}

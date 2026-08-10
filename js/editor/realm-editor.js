import { WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS, REALMS, RESEARCH, CONFIG } from '../core/config.js';

const STORAGE_KEY = 'convocation_realm_drafts';

const REFERENCE_DATA = [
    { title: 'Resource IDs', ids: Object.keys(CONFIG.START_RESOURCES) },
    { title: 'Artifact IDs', ids: Object.keys(ARTIFACTS) },
    { title: 'Weapon IDs', ids: Object.keys(WEAPONS) },
    { title: 'Armor IDs', ids: Object.keys(ARMORS) },
    { title: 'Helmet IDs', ids: Object.keys(HELMETS) },
    { title: 'Tool IDs', ids: Object.keys(TOOLS) },
    { title: 'Realm IDs', ids: Object.keys(REALMS) },
    { title: 'Research IDs', ids: Object.keys(RESEARCH) },
];

const CONFIG_REALMS = Object.entries(REALMS).map(([key, def]) => ({ key, ...def }));

let editorInstance = null;

export function launchRealmEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new RealmEditor();
    }
    editorInstance.show();
}

class RealmEditor {
    constructor() {
        this.lootRows = [];
        this.rareEvents = [];
        this.activeDraftKey = null;
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('realm-editor');
        this._buildDOM();
        this._bindEvents();
        this._autoRestore();
        if (!this.lootRows.length) this._addLootRow();
        else { this._renderLootList(); this._renderRareList(); }
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
            <button id="re-back">← Back</button>
            <span class="fe-sep"></span>
            <button id="re-new">+ New</button>
            <button id="re-duplicate">Duplicate</button>
            <span class="fe-sep"></span>
            <select id="re-load-config"><option value="">Load from Config...</option></select>
            <span class="fe-sep"></span>
            <button id="re-export-all">Export All</button>
            <button id="re-copy">Copy Current</button>
        `;
        this.container.appendChild(toolbar);

        const configSelect = document.getElementById('re-load-config');
        CONFIG_REALMS.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.key;
            opt.textContent = `${r.name || r.key} (${r.difficulty || 1})`;
            configSelect.appendChild(opt);
        });

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel';
        formPanel.id = 're-form';
        formPanel.innerHTML = this._buildFormHTML();

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel';
        previewPanel.innerHTML = `
            <div class="fe-preview-tabs">
                <button class="fe-tab-btn active" data-tab="preview">Preview</button>
                <button class="fe-tab-btn" data-tab="reference">Reference</button>
            </div>
            <div class="fe-preview-content">
                <div class="fe-preview-header">
                    <span>Live Preview</span>
                </div>
                <div class="fe-preview-code" id="re-preview"></div>
            </div>
            <div class="fe-reference-content" id="re-reference"></div>
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
                    <input type="text" id="re-key" placeholder="crystal_caves">
                </div>
                <div class="fe-field">
                    <label>Display Name</label>
                    <input type="text" id="re-name" placeholder="Crystal Caves">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Difficulty (1-5)</label>
                    <input type="number" id="re-difficulty" value="1" min="1" max="5">
                </div>
                <div class="fe-field">
                    <label>Chain</label>
                    <input type="text" id="re-chain" placeholder="crystal">
                </div>
                <div class="fe-field">
                    <label>Chain Order</label>
                    <input type="number" id="re-chainOrder" value="1" min="1">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Duration Min (ticks)</label>
                    <input type="number" id="re-durationMin" value="200" min="1">
                </div>
                <div class="fe-field">
                    <label>Duration Max (ticks)</label>
                    <input type="number" id="re-durationMax" value="400" min="1">
                </div>
                <div class="fe-field">
                    <label>Encounters</label>
                    <input type="number" id="re-encounters" value="3" min="1">
                </div>
            </div>

            <div class="fe-section-title">Prerequisites (optional)</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Research Required</label>
                    <input type="text" id="re-research" placeholder="e.g. deep_delving">
                </div>
                <div class="fe-field">
                    <label>Requires Realm</label>
                    <input type="text" id="re-requiresRealm" placeholder="e.g. crystal_mines">
                </div>
            </div>

            <div class="fe-section-title">Visuals</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Wall Building Key</label>
                    <input type="text" id="re-visWall" placeholder="stone_wall">
                </div>
                <div class="fe-field">
                    <label>Floor Building Key</label>
                    <input type="text" id="re-visFloor" placeholder="stone_floor">
                </div>
            </div>

            <div class="fe-section-title">Enemies</div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>HP Min</label>
                    <input type="number" id="re-enemyHpMin" value="40" min="1">
                </div>
                <div class="fe-field">
                    <label>HP Max</label>
                    <input type="number" id="re-enemyHpMax" value="60" min="1">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Damage Min</label>
                    <input type="number" id="re-enemyDmgMin" value="5" min="1">
                </div>
                <div class="fe-field">
                    <label>Damage Max</label>
                    <input type="number" id="re-enemyDmgMax" value="8" min="1">
                </div>
            </div>
            <div class="fe-row">
                <div class="fe-field">
                    <label>Count Min</label>
                    <input type="number" id="re-enemyCountMin" value="2" min="1">
                </div>
                <div class="fe-field">
                    <label>Count Max</label>
                    <input type="number" id="re-enemyCountMax" value="4" min="1">
                </div>
            </div>

            <div class="fe-section-title">Loot Table</div>
            <div id="re-loot-list"></div>
            <button class="fe-add-btn" id="re-add-loot">+ Add Loot Row</button>

            <div class="fe-section-title">Events</div>
            <div class="fe-field">
                <label>Ambient (one per line)</label>
                <textarea id="re-events-ambient" placeholder="The crystals hum softly...&#10;A cool breeze drifts through..."></textarea>
            </div>
            <div class="fe-field">
                <label>Discoveries (one per line)</label>
                <textarea id="re-events-discoveries" placeholder="You find a hidden vein of ore!&#10;A cache of supplies lies forgotten."></textarea>
            </div>
            <div class="fe-field">
                <label>Traps (one per line)</label>
                <textarea id="re-events-traps" placeholder="A rock falls from above!&#10;The floor gives way!"></textarea>
            </div>

            <div class="fe-section-title">Rare Events</div>
            <div id="re-rare-list"></div>
            <button class="fe-add-btn" id="re-add-rare">+ Add Rare Event</button>

            <div class="fe-section-title">Saved Drafts</div>
            <div id="re-draft-list" class="fe-draft-list"></div>
        `;
    }

    _bindEvents() {
        document.getElementById('re-back').addEventListener('click', () => this._goBack());
        document.getElementById('re-new').addEventListener('click', () => this._newDraft());
        document.getElementById('re-duplicate').addEventListener('click', () => this._duplicateDraft());
        document.getElementById('re-export-all').addEventListener('click', () => this._exportAll());
        document.getElementById('re-copy').addEventListener('click', () => this._copyPreview());
        document.getElementById('re-add-loot').addEventListener('click', () => { this._addLootRow(); this._schedulePreview(); });
        document.getElementById('re-add-rare').addEventListener('click', () => { this._addRareEvent(); this._schedulePreview(); });
        document.getElementById('re-load-config').addEventListener('change', (e) => {
            if (e.target.value) this._loadFromConfig(e.target.value);
            e.target.value = '';
        });

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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'Escape') this._goBack();
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
        const container = document.getElementById('re-reference');
        let html = `<input type="text" class="fe-ref-search" placeholder="Search IDs..." id="re-ref-search">`;
        html += `<div id="re-ref-list">`;
        for (const cat of REFERENCE_DATA) {
            html += `<div class="fe-ref-category">`;
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

        document.getElementById('re-ref-search').addEventListener('input', (e) => {
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

    _addLootRow(data) {
        this.lootRows.push(data || { type: 'resource', key: '', weight: 30, amountMin: 1, amountMax: 5 });
        this._renderLootList();
    }

    _removeLootRow(idx) {
        this.lootRows.splice(idx, 1);
        this._renderLootList();
        this._schedulePreview();
    }

    _renderLootList() {
        const container = document.getElementById('re-loot-list');
        container.innerHTML = this.lootRows.map((row, i) => `
            <div class="fe-list-row">
                <select data-loot-type="${i}" style="width:90px;">
                    <option value="resource" ${row.type === 'resource' ? 'selected' : ''}>Resource</option>
                    <option value="artifact" ${row.type === 'artifact' ? 'selected' : ''}>Artifact</option>
                </select>
                <input type="text" data-loot-key="${i}" value="${row.key}" placeholder="key" style="flex:1;">
                <input type="number" data-loot-weight="${i}" value="${row.weight}" placeholder="wt" style="width:50px;" min="1">
                <input type="number" data-loot-min="${i}" value="${row.amountMin || ''}" placeholder="min" style="width:50px;">
                <input type="number" data-loot-max="${i}" value="${row.amountMax || ''}" placeholder="max" style="width:50px;">
                <button class="fe-remove-btn" data-remove-loot="${i}">✕</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-remove-loot]').forEach(btn => {
            btn.addEventListener('click', () => this._removeLootRow(parseInt(btn.dataset.removeLoot)));
        });

        container.querySelectorAll('[data-loot-type]').forEach(el => {
            el.addEventListener('change', () => { this.lootRows[el.dataset.lootType].type = el.value; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-loot-key]').forEach(el => {
            el.addEventListener('input', () => { this.lootRows[el.dataset.lootKey].key = el.value; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-loot-weight]').forEach(el => {
            el.addEventListener('input', () => { this.lootRows[el.dataset.lootWeight].weight = parseInt(el.value) || 0; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-loot-min]').forEach(el => {
            el.addEventListener('input', () => { this.lootRows[el.dataset.lootMin].amountMin = parseInt(el.value) || 0; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-loot-max]').forEach(el => {
            el.addEventListener('input', () => { this.lootRows[el.dataset.lootMax].amountMax = parseInt(el.value) || 0; this._schedulePreview(); });
        });
    }

    _addRareEvent(data) {
        this.rareEvents.push(data || { chance: 0.05, text: '', lootType: 'resource', lootKey: '', lootMin: 1, lootMax: 3 });
        this._renderRareList();
    }

    _removeRareEvent(idx) {
        this.rareEvents.splice(idx, 1);
        this._renderRareList();
        this._schedulePreview();
    }

    _renderRareList() {
        const container = document.getElementById('re-rare-list');
        container.innerHTML = this.rareEvents.map((row, i) => `
            <div class="fe-list-row" style="flex-wrap:wrap;">
                <input type="number" data-rare-chance="${i}" value="${row.chance}" placeholder="chance" style="width:60px;" min="0" max="1" step="0.01">
                <input type="text" data-rare-text="${i}" value="${row.text}" placeholder="Event text..." style="flex:1;min-width:200px;">
                <button class="fe-remove-btn" data-remove-rare="${i}">✕</button>
                <div style="width:100%;display:flex;gap:6px;margin-top:4px;">
                    <select data-rare-loottype="${i}" style="width:80px;">
                        <option value="resource" ${row.lootType === 'resource' ? 'selected' : ''}>resource</option>
                        <option value="artifact" ${row.lootType === 'artifact' ? 'selected' : ''}>artifact</option>
                    </select>
                    <input type="text" data-rare-lootkey="${i}" value="${row.lootKey}" placeholder="loot key" style="flex:1;">
                    <input type="number" data-rare-lootmin="${i}" value="${row.lootMin || ''}" placeholder="min" style="width:50px;">
                    <input type="number" data-rare-lootmax="${i}" value="${row.lootMax || ''}" placeholder="max" style="width:50px;">
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-remove-rare]').forEach(btn => {
            btn.addEventListener('click', () => this._removeRareEvent(parseInt(btn.dataset.removeRare)));
        });
        container.querySelectorAll('[data-rare-chance]').forEach(el => {
            el.addEventListener('input', () => { this.rareEvents[el.dataset.rareChance].chance = parseFloat(el.value) || 0; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-rare-text]').forEach(el => {
            el.addEventListener('input', () => { this.rareEvents[el.dataset.rareText].text = el.value; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-rare-loottype]').forEach(el => {
            el.addEventListener('change', () => { this.rareEvents[el.dataset.rareLoottype].lootType = el.value; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-rare-lootkey]').forEach(el => {
            el.addEventListener('input', () => { this.rareEvents[el.dataset.rareLootkey].lootKey = el.value; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-rare-lootmin]').forEach(el => {
            el.addEventListener('input', () => { this.rareEvents[el.dataset.rareLootmin].lootMin = parseInt(el.value) || 0; this._schedulePreview(); });
        });
        container.querySelectorAll('[data-rare-lootmax]').forEach(el => {
            el.addEventListener('input', () => { this.rareEvents[el.dataset.rareLootmax].lootMax = parseInt(el.value) || 0; this._schedulePreview(); });
        });
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
        this._validateForm();
        const data = this._collectFormData();
        const code = data ? this._formatOutput(data) : '// Fill in fields to see preview';
        document.getElementById('re-preview').textContent = code;
    }

    _autoSaveDraft() {
        const data = this._collectFormData();
        if (!data || !data.key) return;
        data._lootRows = this.lootRows;
        data._rareEvents = this.rareEvents;
        data._ambient = document.getElementById('re-events-ambient').value;
        data._discoveries = document.getElementById('re-events-discoveries').value;
        data._traps = document.getElementById('re-events-traps').value;

        const saved = this._getSaved();
        const idx = saved.findIndex(s => s.key === data.key);
        if (idx >= 0) saved[idx] = data;
        else saved.push(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        this.activeDraftKey = data.key;
        this._renderDraftList();
        try {
            localStorage.setItem(STORAGE_KEY + '_active', data.key);
        } catch {}
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
            const raw = localStorage.getItem(STORAGE_KEY + '_autosave');
            if (!raw) return;
            const s = JSON.parse(raw);
            if (!s || !s.key) return;
            this.activeDraftKey = s.key;
            this._populateFormFromLegacy(s);
        } catch {}
    }

    _populateFormFromLegacy(s) {
        document.getElementById('re-key').value = s.key || '';
        document.getElementById('re-name').value = s.name || '';
        document.getElementById('re-difficulty').value = s.difficulty || 1;
        document.getElementById('re-chain').value = s.chain || '';
        document.getElementById('re-chainOrder').value = s.chainOrder || 1;
        document.getElementById('re-durationMin').value = s.durationMin || 200;
        document.getElementById('re-durationMax').value = s.durationMax || 400;
        document.getElementById('re-encounters').value = s.encounters || 3;
        document.getElementById('re-research').value = s.research || '';
        document.getElementById('re-requiresRealm').value = s.requiresRealm || '';
        document.getElementById('re-visWall').value = s.visWall || '';
        document.getElementById('re-visFloor').value = s.visFloor || '';
        document.getElementById('re-enemyHpMin').value = s.enemyHpMin || 40;
        document.getElementById('re-enemyHpMax').value = s.enemyHpMax || 60;
        document.getElementById('re-enemyDmgMin').value = s.enemyDmgMin || 5;
        document.getElementById('re-enemyDmgMax').value = s.enemyDmgMax || 8;
        document.getElementById('re-enemyCountMin').value = s.enemyCountMin || 2;
        document.getElementById('re-enemyCountMax').value = s.enemyCountMax || 4;
        document.getElementById('re-events-ambient').value = s.ambient || '';
        document.getElementById('re-events-discoveries').value = s.discoveries || '';
        document.getElementById('re-events-traps').value = s.traps || '';
        if (s.lootRows && s.lootRows.length) this.lootRows = s.lootRows;
        if (s.rareEvents && s.rareEvents.length) this.rareEvents = s.rareEvents;
        this._renderLootList();
        this._renderRareList();
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
        document.getElementById('re-key').value = '';
        document.getElementById('re-name').value = '';
        document.getElementById('re-difficulty').value = '1';
        document.getElementById('re-chain').value = '';
        document.getElementById('re-chainOrder').value = '1';
        document.getElementById('re-durationMin').value = '200';
        document.getElementById('re-durationMax').value = '400';
        document.getElementById('re-encounters').value = '3';
        document.getElementById('re-research').value = '';
        document.getElementById('re-requiresRealm').value = '';
        document.getElementById('re-visWall').value = '';
        document.getElementById('re-visFloor').value = '';
        document.getElementById('re-enemyHpMin').value = '40';
        document.getElementById('re-enemyHpMax').value = '60';
        document.getElementById('re-enemyDmgMin').value = '5';
        document.getElementById('re-enemyDmgMax').value = '8';
        document.getElementById('re-enemyCountMin').value = '2';
        document.getElementById('re-enemyCountMax').value = '4';
        document.getElementById('re-events-ambient').value = '';
        document.getElementById('re-events-discoveries').value = '';
        document.getElementById('re-events-traps').value = '';
        this.lootRows = [{ type: 'resource', key: '', weight: 30, amountMin: 1, amountMax: 5 }];
        this.rareEvents = [];
        this._renderLootList();
        this._renderRareList();
    }

    _renderDraftList() {
        const container = document.getElementById('re-draft-list');
        const saved = this._getSaved();
        if (!saved.length) {
            container.innerHTML = '<div style="color:#666;font-size:11px;">No drafts yet. Start filling in the form above.</div>';
            return;
        }
        container.innerHTML = saved.map(item => `
            <div class="fe-draft-row${item.key === this.activeDraftKey ? ' active' : ''}" data-draft-key="${item.key}">
                <span class="fe-draft-char" style="color:#cc88ff">⬡</span>
                <span class="fe-draft-key">${item.key}${item.name && item.name !== item.key ? ` — ${item.name}` : ''}</span>
                <span class="fe-draft-actions">
                    <button data-draft-load="${item.key}">Edit</button>
                    <button data-draft-del="${item.key}" class="fe-draft-del">✕</button>
                </span>
            </div>
        `).join('');

        container.querySelectorAll('[data-draft-load]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._loadDraft(btn.dataset.draftLoad);
            });
        });
        container.querySelectorAll('[data-draft-del]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteDraft(btn.dataset.draftDel);
            });
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

    _populateForm(data) {
        document.getElementById('re-key').value = data.key || '';
        document.getElementById('re-name').value = data.name || '';
        document.getElementById('re-difficulty').value = data.difficulty || 1;
        document.getElementById('re-chain').value = data.chain || '';
        document.getElementById('re-chainOrder').value = data.chainOrder || 1;
        document.getElementById('re-durationMin').value = data.duration ? data.duration[0] : 200;
        document.getElementById('re-durationMax').value = data.duration ? data.duration[1] : 400;
        document.getElementById('re-encounters').value = data.encounters || 3;
        document.getElementById('re-research').value = data.research || '';
        document.getElementById('re-requiresRealm').value = data.requiresRealm || '';
        document.getElementById('re-visWall').value = data.vis ? data.vis.wall : '';
        document.getElementById('re-visFloor').value = data.vis ? data.vis.floor : '';
        document.getElementById('re-enemyHpMin').value = data.enemies ? data.enemies.hp[0] : 40;
        document.getElementById('re-enemyHpMax').value = data.enemies ? data.enemies.hp[1] : 60;
        document.getElementById('re-enemyDmgMin').value = data.enemies ? data.enemies.damage[0] : 5;
        document.getElementById('re-enemyDmgMax').value = data.enemies ? data.enemies.damage[1] : 8;
        document.getElementById('re-enemyCountMin').value = data.enemies ? data.enemies.count[0] : 2;
        document.getElementById('re-enemyCountMax').value = data.enemies ? data.enemies.count[1] : 4;

        document.getElementById('re-events-ambient').value = data._ambient || '';
        document.getElementById('re-events-discoveries').value = data._discoveries || '';
        document.getElementById('re-events-traps').value = data._traps || '';

        this.lootRows = data._lootRows || [];
        this.rareEvents = data._rareEvents || [];
        if (!this.lootRows.length) this.lootRows.push({ type: 'resource', key: '', weight: 30, amountMin: 1, amountMax: 5 });
        this._renderLootList();
        this._renderRareList();
        this._schedulePreview();
    }

    _collectFormData() {
        const key = document.getElementById('re-key').value.trim();
        if (!key) return null;

        const data = {
            key,
            name: document.getElementById('re-name').value.trim() || key,
            difficulty: parseInt(document.getElementById('re-difficulty').value) || 1,
            chain: document.getElementById('re-chain').value.trim(),
            chainOrder: parseInt(document.getElementById('re-chainOrder').value) || 1,
            duration: [
                parseInt(document.getElementById('re-durationMin').value) || 200,
                parseInt(document.getElementById('re-durationMax').value) || 400,
            ],
            encounters: parseInt(document.getElementById('re-encounters').value) || 3,
            vis: {
                wall: document.getElementById('re-visWall').value.trim() || 'stone_wall',
                floor: document.getElementById('re-visFloor').value.trim() || 'stone_floor',
            },
            enemies: {
                hp: [
                    parseInt(document.getElementById('re-enemyHpMin').value) || 40,
                    parseInt(document.getElementById('re-enemyHpMax').value) || 60,
                ],
                damage: [
                    parseInt(document.getElementById('re-enemyDmgMin').value) || 5,
                    parseInt(document.getElementById('re-enemyDmgMax').value) || 8,
                ],
                count: [
                    parseInt(document.getElementById('re-enemyCountMin').value) || 2,
                    parseInt(document.getElementById('re-enemyCountMax').value) || 4,
                ],
            },
        };

        const research = document.getElementById('re-research').value.trim();
        if (research) data.research = research;
        const requiresRealm = document.getElementById('re-requiresRealm').value.trim();
        if (requiresRealm) data.requiresRealm = requiresRealm;

        data.loot = this.lootRows.filter(r => r.key).map(r => {
            const entry = {};
            entry[r.type] = r.key;
            entry.weight = r.weight;
            if (r.amountMin && r.amountMax) entry.amount = [r.amountMin, r.amountMax];
            return entry;
        });

        const ambient = this._parseTextarea('re-events-ambient');
        const discoveries = this._parseTextarea('re-events-discoveries');
        const traps = this._parseTextarea('re-events-traps');
        const rare = this.rareEvents.filter(r => r.text).map(r => {
            const entry = { chance: r.chance, text: r.text };
            if (r.lootKey) {
                entry.loot = { [r.lootType]: r.lootKey };
                if (r.lootMin && r.lootMax) entry.loot.amount = [r.lootMin, r.lootMax];
            }
            return entry;
        });

        data.events = { ambient, discoveries, traps, rare };

        return data;
    }

    _parseTextarea(id) {
        return document.getElementById(id).value.split('\n').map(l => l.trim()).filter(Boolean);
    }

    _formatOutput(data) {
        if (!data) return '';
        let out = `${data.key}: {\n`;
        out += `    name: '${data.name}',\n`;
        out += `    difficulty: ${data.difficulty},\n`;
        out += `    chain: '${data.chain}',\n`;
        out += `    chainOrder: ${data.chainOrder},\n`;
        out += `    duration: [${data.duration[0]}, ${data.duration[1]}],\n`;
        out += `    encounters: ${data.encounters},\n`;
        if (data.research) out += `    research: '${data.research}',\n`;
        if (data.requiresRealm) out += `    requiresRealm: '${data.requiresRealm}',\n`;
        out += `    vis: { wall: '${data.vis.wall}', floor: '${data.vis.floor}' },\n`;

        out += `    loot: [\n`;
        data.loot.forEach(l => {
            const parts = [];
            if (l.resource) parts.push(`resource: '${l.resource}'`);
            if (l.artifact) parts.push(`artifact: '${l.artifact}'`);
            parts.push(`weight: ${l.weight}`);
            if (l.amount) parts.push(`amount: [${l.amount[0]}, ${l.amount[1]}]`);
            out += `        { ${parts.join(', ')} },\n`;
        });
        out += `    ],\n`;

        out += `    enemies: { hp: [${data.enemies.hp.join(', ')}], damage: [${data.enemies.damage.join(', ')}], count: [${data.enemies.count.join(', ')}] },\n`;

        out += `    events: {\n`;
        out += `        ambient: [\n`;
        data.events.ambient.forEach(t => { out += `            '${this._escapeStr(t)}',\n`; });
        out += `        ],\n`;
        out += `        discoveries: [\n`;
        data.events.discoveries.forEach(t => { out += `            '${this._escapeStr(t)}',\n`; });
        out += `        ],\n`;
        out += `        traps: [\n`;
        data.events.traps.forEach(t => { out += `            '${this._escapeStr(t)}',\n`; });
        out += `        ],\n`;
        out += `        rare: [\n`;
        data.events.rare.forEach(r => {
            let lootStr = '';
            if (r.loot) {
                const lootParts = [];
                if (r.loot.resource) lootParts.push(`resource: '${r.loot.resource}'`);
                if (r.loot.artifact) lootParts.push(`artifact: '${r.loot.artifact}'`);
                if (r.loot.amount) lootParts.push(`amount: [${r.loot.amount[0]}, ${r.loot.amount[1]}]`);
                lootStr = `, loot: { ${lootParts.join(', ')} }`;
            }
            out += `            { chance: ${r.chance}, text: '${this._escapeStr(r.text)}'${lootStr} },\n`;
        });
        out += `        ],\n`;
        out += `    },\n`;
        out += `},`;

        return out;
    }

    _escapeStr(s) {
        return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    _copyPreview() {
        const text = document.getElementById('re-preview').textContent;
        navigator.clipboard.writeText(text);
    }

    _exportAll() {
        const saved = this._getSaved();
        if (!saved.length) return;
        let output = '// === Add to REALMS in config.js ===\n';
        saved.forEach(item => {
            const data = this._buildExportData(item);
            if (data) output += this._formatOutput(data) + '\n\n';
        });
        output = output.trimEnd();

        const modal = document.createElement('div');
        modal.className = 'fe-export-modal';
        modal.innerHTML = `
            <div class="fe-export-modal-content">
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export All Realms (${saved.length} items)</div>
                <textarea readonly>${output}</textarea>
                <div class="fe-modal-actions">
                    <button id="re-modal-copy">Copy to Clipboard</button>
                    <button id="re-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('re-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('re-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('re-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    _buildExportData(saved) {
        if (!saved || !saved.key) return null;
        const lootRows = saved._lootRows || [];
        const rareEvents = saved._rareEvents || [];
        const ambient = (saved._ambient || '').split('\n').map(l => l.trim()).filter(Boolean);
        const discoveries = (saved._discoveries || '').split('\n').map(l => l.trim()).filter(Boolean);
        const traps = (saved._traps || '').split('\n').map(l => l.trim()).filter(Boolean);

        const loot = lootRows.filter(r => r.key).map(r => {
            const entry = {};
            entry[r.type] = r.key;
            entry.weight = r.weight;
            if (r.amountMin && r.amountMax) entry.amount = [r.amountMin, r.amountMax];
            return entry;
        });

        const rare = rareEvents.filter(r => r.text).map(r => {
            const entry = { chance: r.chance, text: r.text };
            if (r.lootKey) {
                entry.loot = { [r.lootType]: r.lootKey };
                if (r.lootMin && r.lootMax) entry.loot.amount = [r.lootMin, r.lootMax];
            }
            return entry;
        });

        return {
            ...saved,
            loot,
            events: { ambient, discoveries, traps, rare },
        };
    }

    _getSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }

    _loadFromConfig(key) {
        const def = REALMS[key];
        if (!def) return;
        this._clearForm();
        document.getElementById('re-key').value = key;
        document.getElementById('re-name').value = def.name || key;
        document.getElementById('re-difficulty').value = def.difficulty || 1;
        document.getElementById('re-chain').value = def.chain || '';
        document.getElementById('re-chainOrder').value = def.chainOrder || 1;
        if (def.duration) {
            document.getElementById('re-durationMin').value = def.duration[0];
            document.getElementById('re-durationMax').value = def.duration[1];
        }
        document.getElementById('re-encounters').value = def.encounters || 3;
        document.getElementById('re-research').value = def.research || '';
        document.getElementById('re-requiresRealm').value = def.requiresRealm || '';
        if (def.vis) {
            document.getElementById('re-visWall').value = def.vis.wall || '';
            document.getElementById('re-visFloor').value = def.vis.floor || '';
        }
        if (def.enemies) {
            document.getElementById('re-enemyHpMin').value = def.enemies.hp[0];
            document.getElementById('re-enemyHpMax').value = def.enemies.hp[1];
            document.getElementById('re-enemyDmgMin').value = def.enemies.damage[0];
            document.getElementById('re-enemyDmgMax').value = def.enemies.damage[1];
            document.getElementById('re-enemyCountMin').value = def.enemies.count[0];
            document.getElementById('re-enemyCountMax').value = def.enemies.count[1];
        }
        if (def.loot) {
            this.lootRows = def.loot.map(l => ({
                type: l.artifact ? 'artifact' : 'resource',
                key: l.resource || l.artifact || '',
                weight: l.weight || 10,
                amountMin: l.amount ? l.amount[0] : 1,
                amountMax: l.amount ? l.amount[1] : 1,
            }));
        }
        if (def.events) {
            if (def.events.ambient) document.getElementById('re-events-ambient').value = def.events.ambient.join('\n');
            if (def.events.discoveries) document.getElementById('re-events-discoveries').value = def.events.discoveries.join('\n');
            if (def.events.traps) document.getElementById('re-events-traps').value = def.events.traps.join('\n');
            if (def.events.rare) {
                this.rareEvents = def.events.rare.map(r => ({
                    chance: r.chance || 0.05,
                    text: r.text || '',
                    lootType: r.loot ? (r.loot.artifact ? 'artifact' : 'resource') : 'resource',
                    lootKey: r.loot ? (r.loot.resource || r.loot.artifact || '') : '',
                    lootMin: r.loot && r.loot.amount ? r.loot.amount[0] : 1,
                    lootMax: r.loot && r.loot.amount ? r.loot.amount[1] : 3,
                }));
            }
        }
        this._renderLootList();
        this._renderRareList();
        this.activeDraftKey = null;
        this._renderDraftList();
        this._schedulePreview();
        this._pushUndoState();
    }

    _duplicateDraft() {
        const key = document.getElementById('re-key').value.trim();
        if (!key) return;
        document.getElementById('re-key').value = key + '_copy';
        const name = document.getElementById('re-name').value.trim();
        document.getElementById('re-name').value = (name || key) + ' Copy';
        this.activeDraftKey = null;
        this._renderDraftList();
        this._schedulePreview();
        this._pushUndoState();
    }

    _validateForm() {
        const key = document.getElementById('re-key');
        const name = document.getElementById('re-name');
        const chain = document.getElementById('re-chain');
        key.closest('.fe-field').classList.toggle('fe-error', !key.value.trim());
        name.closest('.fe-field').classList.toggle('fe-error', !name.value.trim());
        chain.closest('.fe-field').classList.toggle('fe-error', !chain.value.trim());
    }

    _getFormSnapshot() {
        const inputs = this.container.querySelectorAll('#re-form input, #re-form select, #re-form textarea');
        const snap = {};
        inputs.forEach(el => {
            const id = el.id;
            if (!id) return;
            snap[id] = el.value;
        });
        snap._lootRows = JSON.stringify(this.lootRows);
        snap._rareEvents = JSON.stringify(this.rareEvents);
        return JSON.stringify(snap);
    }

    _restoreFormSnapshot(json) {
        const snap = JSON.parse(json);
        for (const [id, val] of Object.entries(snap)) {
            if (id === '_lootRows') { this.lootRows = JSON.parse(val); continue; }
            if (id === '_rareEvents') { this.rareEvents = JSON.parse(val); continue; }
            const el = document.getElementById(id);
            if (!el) continue;
            el.value = val;
        }
        this._renderLootList();
        this._renderRareList();
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

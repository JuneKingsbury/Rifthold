import { RESEARCH } from '../core/config/magic.js';
import { escapeHtml, escapeAttr } from '../ui/ui-utils.js';
import { getLoadedManifests } from '../core/mod-registry.js';
import { importPristineConfig, fetchConfigSource, spliceExportObject, toJsLiteral } from './config-source.js';

const STORAGE_KEY = 'convocation_realm_pro';

// Base (unmodded) realms and enemies, so exports never bake mod content into exploration.js.
const PRISTINE = await importPristineConfig('exploration.js');
const EXPLORATION = PRISTINE || await import('../core/config/exploration.js');
// Without the unmodded copy the editor shows live config, which includes any loaded mods' content.
const MODDED_FALLBACK = !PRISTINE && getLoadedManifests().length > 0;
const { REALMS, EXPEDITION_ENEMIES } = EXPLORATION;
const CHAIN_COLORS = { crystal: '#88ccff', verdant: '#66cc66', arcane: '#cc88ff', shadow: '#aa66cc' };
const DIFFICULTY_COLORS = ['', '#66cc66', '#cccc44', '#ff8844', '#ff4444', '#cc33cc'];
const DIFFICULTY_LABELS = ['', 'Easy', 'Normal', 'Hard', 'Deadly', 'Extreme'];

let editorInstance = null;

// Point a loot entry at `key`, keeping its field order when the loot type is unchanged.
function setLootKey(entry, type, key) {
    if (!(type in entry)) {
        delete entry.resource; delete entry.item; delete entry.artifact;
    }
    entry[type] = key;
}

export function launchRealmEditorPro() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) editorInstance = new RealmEditorPro();
    editorInstance.show();
}

class RealmEditorPro {
    constructor() {
        this.realms = new Map();
        this.originalRealms = new Map();
        this.selectedKey = null;
        this.undoStack = [];
        this.undoIndex = -1;
        this.container = document.getElementById('realm-editor-pro');
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
        for (const [key, def] of Object.entries(REALMS)) {
            const realm = { ...def, key };
            this.realms.set(key, realm);
            this.originalRealms.set(key, JSON.stringify(realm));
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.realms) {
                for (const [key, realm] of Object.entries(saved.realms)) {
                    // Drafts from before v2 were saved by a lossy form (old enemies
                    // schema, no boss); restore what it dropped from the base realm.
                    const base = saved.v >= 2 ? null : this.originalRealms.get(key);
                    if (base) {
                        const orig = JSON.parse(base);
                        this.realms.set(key, { ...orig, ...realm, enemies: orig.enemies });
                    } else {
                        this.realms.set(key, realm);
                    }
                }
            }
            if (saved.deleted) {
                for (const key of saved.deleted) this.realms.delete(key);
            }
        } catch {}
    }

    _saveToStorage() {
        const modified = {};
        const deleted = [];
        for (const [key, realm] of this.realms) {
            if (JSON.stringify(realm) !== this.originalRealms.get(key)) modified[key] = realm;
        }
        for (const key of this.originalRealms.keys()) {
            if (!this.realms.has(key)) deleted.push(key);
        }
        for (const [key, realm] of this.realms) {
            if (!this.originalRealms.has(key)) modified[key] = realm;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, realms: modified, deleted }));
        } catch (err) {
            console.warn('Realm editor: draft autosave failed', err);
        }
    }

    _buildDOM() {
        this.container.className = 'form-editor';
        this.container.innerHTML = '';

        const toolbar = document.createElement('div');
        toolbar.className = 'fe-toolbar';
        toolbar.innerHTML = `
            <button id="rlm-back">← Back</button>
            <span class="fe-sep"></span>
            <button id="rlm-undo" title="Undo (Ctrl+Z)">↩</button>
            <button id="rlm-redo" title="Redo (Ctrl+Y)">↪</button>
            <span class="fe-sep"></span>
            <button id="rlm-export">Export exploration.js</button>
            ${MODDED_FALLBACK ? '<span style="color:#ff8844;font-size:10px;margin-left:8px;">Could not load base data separately from mods: showing modded data, full-file export disabled.</span>' : ''}
            <span id="rlm-status" style="margin-left:12px;color:#ccaa44;font-size:10px;"></span>
            <span style="margin-left:auto;color:#666;font-size:10px;">${this.realms.size} realms loaded</span>
        `;
        this.container.appendChild(toolbar);

        const workspace = document.createElement('div');
        workspace.className = 'fe-workspace-pro';

        const formPanel = document.createElement('div');
        formPanel.className = 'fe-form-panel-pro';
        formPanel.id = 'rlm-form';
        formPanel.innerHTML = this._buildSelectorHtml() + '<div id="rlm-fields" style="color:#666;text-align:center;padding:40px 20px;">Select a realm from the dropdown above to edit it, or click "+ New" to create one.</div>';

        const previewPanel = document.createElement('div');
        previewPanel.className = 'fe-preview-panel-pro';
        previewPanel.id = 'rlm-preview';

        workspace.appendChild(formPanel);
        workspace.appendChild(previewPanel);
        this.container.appendChild(workspace);
    }

    _buildSelectorHtml() {
        const chains = this._getChains();
        let options = '';
        for (const [chain, realms] of chains) {
            const color = CHAIN_COLORS[chain] || '#aaa';
            options += `<optgroup label="${escapeAttr(chain.charAt(0).toUpperCase() + chain.slice(1))} Chain">`;
            for (const [key, realm] of realms) {
                const dirty = this._isDirty(key) ? ' •' : '';
                const sel = key === this.selectedKey ? ' selected' : '';
                options += `<option value="${escapeAttr(key)}"${sel}>${escapeHtml(realm.name || key)} (${escapeHtml(realm.difficulty || 1)})${dirty}</option>`;
            }
            options += `</optgroup>`;
        }
        return `<div class="fe-item-selector">
            <select id="rlm-select">${options ? `<option value="">(choose realm...)</option>${options}` : '<option value="">(no realms)</option>'}</select>
            <button class="fe-sel-btn" id="rlm-new">+ New</button>
            <button class="fe-sel-btn danger" id="rlm-delete">Delete</button>
        </div>`;
    }

    _rebuildSelector() {
        const selectorDiv = this.container.querySelector('.fe-item-selector');
        if (selectorDiv) selectorDiv.outerHTML = this._buildSelectorHtml();
        this._bindSelectorEvents();
    }

    _getChains() {
        const chains = new Map();
        for (const [key, realm] of this.realms) {
            const chain = realm.chain || 'unknown';
            if (!chains.has(chain)) chains.set(chain, []);
            chains.get(chain).push([key, realm]);
        }
        for (const [, arr] of chains) arr.sort((a, b) => (a[1].chainOrder || 0) - (b[1].chainOrder || 0));
        return chains;
    }

    _bindEvents() {
        document.getElementById('rlm-back').addEventListener('click', () => this._goBack());
        document.getElementById('rlm-undo').addEventListener('click', () => this._undo());
        document.getElementById('rlm-redo').addEventListener('click', () => this._redo());
        document.getElementById('rlm-export').addEventListener('click', () => this._showExportModal());
        this._bindSelectorEvents();

        // Form listeners are bound once: #rlm-fields survives re-renders (only its innerHTML is replaced).
        const fields = document.getElementById('rlm-fields');
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
        const sel = document.getElementById('rlm-select');
        if (sel) sel.addEventListener('change', () => {
            if (sel.value) this._selectRealm(sel.value);
        });
        const newBtn = document.getElementById('rlm-new');
        if (newBtn) newBtn.addEventListener('click', () => this._showNewRealmDialog());
        const delBtn = document.getElementById('rlm-delete');
        if (delBtn) delBtn.addEventListener('click', () => {
            if (this.selectedKey && confirm(`Delete realm "${this.selectedKey}"?`)) this._deleteRealm(this.selectedKey);
        });
    }

    _isDirty(key) {
        const realm = this.realms.get(key);
        if (!realm) return false;
        return JSON.stringify(realm) !== this.originalRealms.get(key);
    }

    _selectRealm(key) {
        this.selectedKey = key;
        this._rebuildSelector();
        this._renderForm();
        this._renderPreview();
    }

    _showNewRealmDialog() {
        const chain = prompt('Chain name? (crystal, verdant, arcane, shadow, or new)', 'crystal');
        if (!chain) return;
        let base = `new_${chain.toLowerCase().trim()}_realm`;
        let key = base;
        let i = 1;
        while (this.realms.has(key)) { key = `${base}_${i++}`; }
        const chainRealms = [...this.realms.values()].filter(r => r.chain === chain.toLowerCase().trim());
        const maxOrder = chainRealms.reduce((m, r) => Math.max(m, r.chainOrder || 0), 0);
        const realm = {
            key, name: `New ${chain.charAt(0).toUpperCase() + chain.slice(1)} Realm`,
            difficulty: 1, chain: chain.toLowerCase().trim(), chainOrder: maxOrder + 1,
            duration: [200, 400], encounters: 3,
            vis: { wall: 'stone_wall', floor: 'stone_floor' },
            combatEncounters: [1, 2],
            loot: [], enemies: { count: [2, 4], types: [{ key: Object.keys(EXPEDITION_ENEMIES)[0], weight: 100 }] },
            events: { ambient: [], discoveries: [], traps: [], rare: [] },
        };
        this.realms.set(key, realm);
        this._selectRealm(key);
        this._onDataChange();
    }

    _deleteRealm(key) {
        this.realms.delete(key);
        this.selectedKey = null;
        this._rebuildSelector();
        document.getElementById('rlm-fields').innerHTML = '<div style="color:#666;text-align:center;padding:40px 20px;">Realm deleted. Select another realm.</div>';
        document.getElementById('rlm-preview').innerHTML = '';
        this._onDataChange();
    }

    _renderForm() {
        const realm = this.realms.get(this.selectedKey);
        if (!realm) return;

        const realmOptions = [...this.realms.entries()].filter(([k]) => k !== this.selectedKey).map(([k, r]) => `<option value="${escapeAttr(k)}"${realm.requiresRealm === k ? ' selected' : ''}>${escapeHtml(r.name || k)}</option>`).join('');
        const researchOptions = Object.entries(RESEARCH).map(([k, r]) => `<option value="${escapeAttr(k)}"${realm.research === k ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
        const textareaStyle = 'width:100%;background:#1a1a2e;color:#ccc;border:1px solid #333;font-size:11px;font-family:monospace;box-sizing:border-box;';

        let html = `
            <div class="fe-section-title">Realm Info</div>
            <div class="fe-row">
                <div class="fe-field"><label>Key</label><input type="text" id="rlm-key" value="${escapeAttr(realm.key)}"></div>
                <div class="fe-field"><label>Name</label><input type="text" id="rlm-name" value="${escapeAttr(realm.name || '')}"></div>
            </div>
            <div class="fe-row">
                <div class="fe-field"><label>Chain</label><input type="text" id="rlm-chain" value="${escapeAttr(realm.chain || '')}"></div>
                <div class="fe-field"><label>Chain Order</label><input type="number" id="rlm-chainOrder" min="1" value="${escapeAttr(realm.chainOrder || 1)}"></div>
                <div class="fe-field"><label>Difficulty (1-5)</label><input type="number" id="rlm-difficulty" min="1" max="5" value="${escapeAttr(realm.difficulty || 1)}"></div>
            </div>
            <div class="fe-row">
                <div class="fe-field"><label>Requires Realm</label><select id="rlm-requiresRealm"><option value="">(none)</option>${realmOptions}</select></div>
                <div class="fe-field"><label>Research Required</label><select id="rlm-research"><option value="">(none)</option>${researchOptions}</select></div>
            </div>

            <div class="fe-section-title">Timing & Encounters</div>
            <div class="fe-row">
                <div class="fe-field"><label>Duration Min</label><input type="number" id="rlm-durMin" value="${escapeAttr(realm.duration?.[0] || 200)}"></div>
                <div class="fe-field"><label>Duration Max</label><input type="number" id="rlm-durMax" value="${escapeAttr(realm.duration?.[1] || 400)}"></div>
                <div class="fe-field"><label>Encounters</label><input type="number" id="rlm-encounters" value="${escapeAttr(realm.encounters || 3)}"></div>
            </div>

            <div class="fe-section-title">Visuals</div>
            <div class="fe-row">
                <div class="fe-field"><label>Wall Type</label><input type="text" id="rlm-visWall" value="${escapeAttr(realm.vis?.wall || 'stone_wall')}"></div>
                <div class="fe-field"><label>Floor Type</label><input type="text" id="rlm-visFloor" value="${escapeAttr(realm.vis?.floor || 'stone_floor')}"></div>
            </div>

            <div class="fe-section-title">Enemies${realm.boss ? ` <span style="color:#888;font-size:10px;">(boss: ${escapeHtml(realm.boss.name || '?')}, kept as-is)</span>` : ''}</div>
            <div class="fe-row">
                <div class="fe-field"><label>Count Min</label><input type="number" id="rlm-enemyCntMin" value="${escapeAttr(realm.enemies?.count?.[0] ?? 2)}"></div>
                <div class="fe-field"><label>Count Max</label><input type="number" id="rlm-enemyCntMax" value="${escapeAttr(realm.enemies?.count?.[1] ?? 4)}"></div>
            </div>
            <div id="rlm-enemy-rows">`;

        // Per-render copies of the list entries; rows reference them by index so
        // fields the row doesn't show are merged back on collect.
        this._enemyOrig = (realm.enemies?.types || []).slice();
        this._lootOrig = (realm.loot || []).slice();
        this._rareOrig = (realm.events?.rare || []).slice();

        this._enemyOrig.forEach((t, i) => { html += this._enemyRowHtml(t, i); });
        html += `</div>`;
        html += `<button class="fe-add-btn" id="rlm-add-enemy" style="margin-top:4px;">+ Enemy Type</button>`;

        html += `<div class="fe-section-title">Loot Table</div>
            <div id="rlm-loot-rows">`;
        this._lootOrig.forEach((loot, i) => { html += this._lootRowHtml(loot, i); });
        html += `</div>`;
        html += `<button class="fe-add-btn" id="rlm-add-loot" style="margin-top:4px;">+ Loot Entry</button>`;

        html += `<div class="fe-section-title">Events — Ambient</div>`;
        html += `<textarea id="rlm-ambient" rows="4" style="${textareaStyle}">${escapeHtml((realm.events?.ambient || []).join('\n'))}</textarea>`;

        html += `<div class="fe-section-title">Events — Discoveries</div>`;
        html += `<textarea id="rlm-discoveries" rows="3" style="${textareaStyle}">${escapeHtml((realm.events?.discoveries || []).join('\n'))}</textarea>`;

        html += `<div class="fe-section-title">Events — Traps</div>`;
        html += `<textarea id="rlm-traps" rows="3" style="${textareaStyle}">${escapeHtml((realm.events?.traps || []).join('\n'))}</textarea>`;

        html += `<div class="fe-section-title">Rare Events</div>`;
        html += `<div id="rlm-rare-rows">`;
        this._rareOrig.forEach((r, i) => { html += this._rareRowHtml(r, i); });
        html += `</div>`;
        html += `<button class="fe-add-btn" id="rlm-add-rare" style="margin-top:4px;">+ Rare Event</button>`;

        document.getElementById('rlm-fields').innerHTML = html;
        this._bindFormEvents();
    }

    _enemyRowHtml(t, i) {
        const keys = [...new Set([...Object.keys(EXPEDITION_ENEMIES), t.key].filter(Boolean))];
        return `<div class="fe-list-row" data-idx="${i}" style="margin-bottom:4px;align-items:center;">
            <select class="rlm-enemy-key" style="flex:1;">${keys.map(k => `<option value="${escapeAttr(k)}"${k === t.key ? ' selected' : ''}>${escapeHtml(EXPEDITION_ENEMIES[k]?.name || k)}</option>`).join('')}</select>
            <input type="number" class="rlm-enemy-weight" value="${escapeAttr(t.weight ?? 10)}" title="Weight" style="width:50px;">
            <button class="fe-remove-btn rlm-enemy-del">✕</button>
        </div>`;
    }

    _lootRowHtml(loot, i) {
        const type = loot.resource ? 'resource' : 'item';
        const key = loot.resource || loot.artifact || loot.item || '';
        const weight = loot.weight || 10;
        const amtMin = loot.amount ? loot.amount[0] : 1;
        const amtMax = loot.amount ? loot.amount[1] : 1;
        return `<div class="fe-list-row" data-idx="${i}" style="margin-bottom:4px;align-items:center;">
            <select class="rlm-loot-type" style="width:70px;"><option value="resource"${type === 'resource' ? ' selected' : ''}>Resource</option><option value="item"${type === 'item' ? ' selected' : ''}>Item</option></select>
            <input type="text" class="rlm-loot-key" value="${escapeAttr(key)}" placeholder="key" style="flex:1;">
            <input type="number" class="rlm-loot-weight" value="${escapeAttr(weight)}" title="Weight" style="width:45px;">
            <input type="number" class="rlm-loot-min" value="${escapeAttr(amtMin)}" title="Min" style="width:40px;">
            <input type="number" class="rlm-loot-max" value="${escapeAttr(amtMax)}" title="Max" style="width:40px;">
            <button class="fe-remove-btn rlm-loot-del">✕</button>
        </div>`;
    }

    _rareRowHtml(r, i) {
        const type = r.loot?.resource ? 'resource' : 'item';
        const key = r.loot?.resource || r.loot?.artifact || r.loot?.item || '';
        const amtMin = r.loot?.amount ? r.loot.amount[0] : 1;
        const amtMax = r.loot?.amount ? r.loot.amount[1] : 1;
        return `<div class="fe-list-row" data-idx="${i}" style="margin-bottom:6px;flex-wrap:wrap;">
            <input type="number" class="rlm-rare-chance" value="${escapeAttr(r.chance || 0.05)}" step="0.005" title="Chance" style="width:55px;">
            <input type="text" class="rlm-rare-text" value="${escapeAttr(r.text || '')}" placeholder="Event text..." style="flex:1;min-width:200px;">
            <select class="rlm-rare-type" style="width:70px;"><option value="resource"${type === 'resource' ? ' selected' : ''}>Resource</option><option value="item"${type === 'item' ? ' selected' : ''}>Item</option></select>
            <input type="text" class="rlm-rare-key" value="${escapeAttr(key)}" placeholder="key" style="width:100px;">
            <input type="number" class="rlm-rare-min" value="${escapeAttr(amtMin)}" style="width:35px;">
            <input type="number" class="rlm-rare-max" value="${escapeAttr(amtMax)}" style="width:35px;">
            <button class="fe-remove-btn rlm-rare-del">✕</button>
        </div>`;
    }

    _bindFormEvents() {
        document.getElementById('rlm-add-enemy')?.addEventListener('click', () => {
            const container = document.getElementById('rlm-enemy-rows');
            container.insertAdjacentHTML('beforeend', this._enemyRowHtml({ key: Object.keys(EXPEDITION_ENEMIES)[0], weight: 10 }, -1));
            this._bindRowDelEvents();
            this._scheduleUpdate();
        });
        document.getElementById('rlm-add-loot')?.addEventListener('click', () => {
            const container = document.getElementById('rlm-loot-rows');
            container.insertAdjacentHTML('beforeend', this._lootRowHtml({ resource: 'stone', weight: 10, amount: [1, 5] }, -1));
            this._bindRowDelEvents();
            this._scheduleUpdate();
        });
        document.getElementById('rlm-add-rare')?.addEventListener('click', () => {
            const container = document.getElementById('rlm-rare-rows');
            container.insertAdjacentHTML('beforeend', this._rareRowHtml({ chance: 0.05, text: '{name} finds something...', loot: { resource: 'stone', amount: [1, 3] } }, -1));
            this._bindRowDelEvents();
            this._scheduleUpdate();
        });
        this._bindRowDelEvents();
    }

    _bindRowDelEvents() {
        document.getElementById('rlm-fields')?.querySelectorAll('.rlm-enemy-del, .rlm-loot-del, .rlm-rare-del').forEach(btn => {
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
        const realm = this._collectFormData();
        if (!realm) return;
        const oldKey = this.selectedKey;
        const keyInput = document.getElementById('rlm-key');
        if (realm.key !== oldKey && this.realms.has(realm.key)) {
            // Refuse a rename onto another realm's key; keep editing under the old key.
            keyInput.style.borderColor = '#ff4444';
            keyInput.title = `"${realm.key}" is already used by another realm`;
            realm.key = oldKey;
        } else if (keyInput) {
            keyInput.style.borderColor = '';
            keyInput.title = '';
        }
        if (realm.key !== oldKey) {
            this._renameRealm(oldKey, realm);
        } else {
            this.realms.set(realm.key, realm);
        }
        this._saveToStorage();
    }

    // Rename in place: the realm keeps its slot in the list and, via _origKey, its
    // position in exploration.js. Other realms' requiresRealm links follow it.
    _renameRealm(oldKey, realm) {
        const origKey = realm._origKey ?? (Object.hasOwn(REALMS, oldKey) ? oldKey : undefined);
        if (origKey && origKey !== realm.key) realm._origKey = origKey;
        else delete realm._origKey;
        this.realms = new Map([...this.realms].map(([k, v]) => (k === oldKey ? [realm.key, realm] : [k, v])));
        this.selectedKey = realm.key;

        let links = 0;
        for (const r of this.realms.values()) {
            if (r.requiresRealm === oldKey) { r.requiresRealm = realm.key; links++; }
        }
        const notes = [];
        if (links) notes.push(`updated ${links} requiresRealm link(s)`);
        const story = Object.values(EXPLORATION.STORY_MILESTONES || {}).filter(m => m.trigger === `realm_${oldKey}`).length;
        if (story) notes.push(`${story} story milestone(s) still trigger on "realm_${oldKey}" and need a manual update`);
        const status = document.getElementById('rlm-status');
        if (status) status.textContent = `Renamed "${oldKey}" to "${realm.key}"${notes.length ? `: ${notes.join('; ')}` : ''}. Code that names the old key is not updated.`;
    }

    // Form values are merged over the realm being edited, so fields the form
    // doesn't show (boss, combatEncounters, scoutingMode, ...) survive the round-trip.
    _collectFormData() {
        const key = document.getElementById('rlm-key')?.value.trim();
        if (!key) return null;
        const base = this.realms.get(this.selectedKey) || {};
        const realm = { ...base, key };
        realm.name = document.getElementById('rlm-name')?.value.trim() || key;
        realm.difficulty = parseInt(document.getElementById('rlm-difficulty')?.value) || 1;
        realm.chain = document.getElementById('rlm-chain')?.value.trim() || 'unknown';
        realm.chainOrder = parseInt(document.getElementById('rlm-chainOrder')?.value) || 1;
        realm.duration = [
            parseInt(document.getElementById('rlm-durMin')?.value) || 200,
            parseInt(document.getElementById('rlm-durMax')?.value) || 400,
        ];
        realm.encounters = parseInt(document.getElementById('rlm-encounters')?.value) || 3;
        realm.vis = {
            ...base.vis,
            wall: document.getElementById('rlm-visWall')?.value.trim() || 'stone_wall',
            floor: document.getElementById('rlm-visFloor')?.value.trim() || 'stone_floor',
        };

        const reqRealm = document.getElementById('rlm-requiresRealm')?.value;
        if (reqRealm) realm.requiresRealm = reqRealm; else delete realm.requiresRealm;
        const research = document.getElementById('rlm-research')?.value;
        if (research) realm.research = research; else delete realm.research;

        const types = [];
        document.getElementById('rlm-enemy-rows')?.querySelectorAll('.fe-list-row').forEach(row => {
            const orig = this._enemyOrig?.[row.dataset.idx] || {};
            const enemyKey = row.querySelector('.rlm-enemy-key')?.value;
            if (!enemyKey) return;
            types.push({ ...orig, key: enemyKey, weight: parseInt(row.querySelector('.rlm-enemy-weight')?.value) || 10 });
        });
        realm.enemies = {
            ...base.enemies,
            count: [parseInt(document.getElementById('rlm-enemyCntMin')?.value) || 2, parseInt(document.getElementById('rlm-enemyCntMax')?.value) || 4],
            types,
        };

        realm.loot = [];
        document.getElementById('rlm-loot-rows')?.querySelectorAll('.fe-list-row').forEach(row => {
            const orig = this._lootOrig?.[row.dataset.idx] || {};
            const type = row.querySelector('.rlm-loot-type')?.value || 'resource';
            const lootKey = row.querySelector('.rlm-loot-key')?.value.trim();
            if (!lootKey) return;
            const entry = { ...orig };
            setLootKey(entry, type, lootKey);
            entry.weight = parseInt(row.querySelector('.rlm-loot-weight')?.value) || 10;
            const min = parseInt(row.querySelector('.rlm-loot-min')?.value) || 1;
            const max = parseInt(row.querySelector('.rlm-loot-max')?.value) || 1;
            // Single items carry no amount in config; only write one when it says something.
            if (orig.amount || min !== 1 || max !== 1) entry.amount = [min, max];
            else delete entry.amount;
            realm.loot.push(entry);
        });

        realm.events = { ...base.events };
        const lines = (id) => (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
        realm.events.ambient = lines('rlm-ambient');
        realm.events.discoveries = lines('rlm-discoveries');
        realm.events.traps = lines('rlm-traps');

        realm.events.rare = [];
        document.getElementById('rlm-rare-rows')?.querySelectorAll('.fe-list-row').forEach(row => {
            const orig = this._rareOrig?.[row.dataset.idx] || {};
            const chance = parseFloat(row.querySelector('.rlm-rare-chance')?.value) || 0.05;
            const text = row.querySelector('.rlm-rare-text')?.value || '';
            const type = row.querySelector('.rlm-rare-type')?.value || 'resource';
            const rareKey = row.querySelector('.rlm-rare-key')?.value.trim();
            const min = parseInt(row.querySelector('.rlm-rare-min')?.value) || 1;
            const max = parseInt(row.querySelector('.rlm-rare-max')?.value) || 1;
            if (!text) return;
            const entry = { ...orig, chance, text };
            if (rareKey) {
                const loot = { ...orig.loot };
                setLootKey(loot, type, rareKey);
                if (orig.loot?.amount || min !== 1 || max !== 1) loot.amount = [min, max];
                else delete loot.amount;
                entry.loot = loot;
            } else {
                delete entry.loot;
            }
            realm.events.rare.push(entry);
        });

        return realm;
    }

    _renderPreview() {
        const realm = this.realms.get(this.selectedKey);
        const panel = document.getElementById('rlm-preview');
        if (!realm) { panel.innerHTML = ''; return; }

        const chainColor = CHAIN_COLORS[realm.chain] || '#aaa';
        const diff = Math.min(5, Math.max(1, parseInt(realm.difficulty) || 1));
        const diffColor = DIFFICULTY_COLORS[diff];
        const diffLabel = DIFFICULTY_LABELS[diff];

        let html = '';

        html += `<div class="fe-preview-section-title">Rifts Panel View</div>`;
        html += `<div class="fe-preview-ingame" style="padding:12px;">`;
        html += `<div style="color:${chainColor};font-weight:bold;margin-bottom:8px;">${escapeHtml((realm.chain || 'unknown').toUpperCase())} CHAIN</div>`;

        const chainRealms = [...this.realms.values()].filter(r => r.chain === realm.chain).sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
        for (const cr of chainRealms) {
            const isSelf = cr.key === realm.key;
            const indent = ((cr.chainOrder || 1) - 1) * 12;
            const bg = isSelf ? '#1a4466' : '#111';
            const border = isSelf ? `border:1px solid ${chainColor}` : 'border:1px solid #333';
            const nameColor = isSelf ? '#88ddff' : '#666';
            html += `<div style="margin-left:${indent}px;margin-bottom:4px;padding:4px 8px;background:${bg};${border};border-radius:3px;">`;
            html += `<span style="color:${nameColor};">${escapeHtml(cr.name || cr.key)}</span>`;
            html += `<span style="color:${DIFFICULTY_COLORS[cr.difficulty] || '#aaa'};font-size:10px;margin-left:6px;">(${escapeHtml(cr.difficulty || 1)})</span>`;
            if (cr.requiresRealm) {
                const reqName = this.realms.get(cr.requiresRealm)?.name || cr.requiresRealm;
                html += `<span style="color:#666;font-size:9px;margin-left:6px;">🔒 ${escapeHtml(reqName)}</span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;

        html += `<div class="fe-preview-section-title">Requirements & Info</div>`;
        html += `<div class="fe-preview-badges">`;
        html += `<span class="fe-preview-badge difficulty" style="color:${diffColor}">${'★'.repeat(diff)}${'☆'.repeat(5 - diff)} ${diffLabel}</span>`;
        if (realm.research) {
            const rName = RESEARCH[realm.research]?.name || realm.research;
            html += `<span class="fe-preview-badge research">🔬 ${escapeHtml(rName)}</span>`;
        }
        if (realm.requiresRealm) {
            const reqName = this.realms.get(realm.requiresRealm)?.name || realm.requiresRealm;
            html += `<span class="fe-preview-badge realm-req">🔗 ${escapeHtml(reqName)}</span>`;
        }
        html += `</div>`;

        html += `<div class="fe-preview-section-title">Chain Position</div>`;
        html += `<div class="fe-chain-tree">`;
        for (let i = 0; i < chainRealms.length; i++) {
            const cr = chainRealms[i];
            const isSelf = cr.key === realm.key;
            html += `<span style="color:${isSelf ? chainColor : '#555'};font-weight:${isSelf ? 'bold' : 'normal'};">${escapeHtml(cr.name || cr.key)}</span>`;
            if (i < chainRealms.length - 1) html += `<span style="color:#444;"> → </span>`;
        }
        html += `</div>`;

        html += `<div class="fe-preview-section-title">Possible Drops</div>`;
        html += `<div class="fe-drops-preview">`;
        const totalWeight = (realm.loot || []).reduce((s, l) => s + (l.weight || 0), 0);
        for (const loot of (realm.loot || [])) {
            const type = loot.resource ? 'resource' : 'item';
            const lootKey = loot.resource || loot.artifact || loot.item || '?';
            const pct = totalWeight > 0 ? ((loot.weight / totalWeight) * 100).toFixed(1) : '0';
            const color = type === 'item' ? '#88ccff' : '#ccc';
            const amt = loot.amount ? `(${loot.amount[0]}-${loot.amount[1]})` : '';
            html += `<div style="display:flex;justify-content:space-between;padding:2px 0;">`;
            html += `<span style="color:${color};">${escapeHtml(lootKey)} ${escapeHtml(amt)}</span>`;
            html += `<span style="color:#888;">${pct}%</span>`;
            html += `</div>`;
        }
        if (realm.events?.rare?.length) {
            html += `<div style="margin-top:8px;color:#aa66cc;font-size:10px;font-weight:bold;">Rare Encounters:</div>`;
            for (const r of realm.events.rare) {
                const rKey = r.loot?.resource || r.loot?.item || '';
                html += `<div style="color:#886;font-size:10px;padding:1px 0;">`;
                html += `<span style="color:#aa66cc;">${(Number(r.chance) * 100).toFixed(1)}%</span> `;
                html += `${escapeHtml(rKey)}`;
                html += `</div>`;
            }
        }
        html += `</div>`;

        html += `<div class="fe-preview-section-title">Code</div>`;
        html += `<div class="fe-preview-code" style="margin:0 12px 12px;padding:10px;font-size:10px;max-height:180px;overflow-y:auto;white-space:pre;">${escapeHtml(this._serializeRealm(realm.key, realm))}</div>`;

        panel.innerHTML = html;
    }

    // Config definition without the editor's own bookkeeping field.
    _toDef(realm) {
        const { key, _origKey, ...def } = realm;
        return def;
    }

    _serializeRealm(key, realm) {
        return `${key}: ${toJsLiteral(this._toDef(realm))},`;
    }

    async _showExportModal() {
        if (MODDED_FALLBACK) {
            alert('Export disabled: base exploration.js data could not be loaded separately from the enabled mods, so the file would include mod content. Disable mods and reload to export.');
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
                <div style="color:#ffcc00;font-weight:bold;margin-bottom:12px;">Export exploration.js (${this.realms.size} realms)</div>
                <textarea readonly style="min-height:400px;">${escapeHtml(output)}</textarea>
                <div class="fe-modal-actions">
                    <button id="rlm-modal-download">Download File</button>
                    <button id="rlm-modal-copy">Copy to Clipboard</button>
                    <button id="rlm-modal-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('rlm-modal-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(output);
            document.getElementById('rlm-modal-copy').textContent = 'Copied!';
        });
        document.getElementById('rlm-modal-download').addEventListener('click', () => {
            const blob = new Blob([output], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'exploration.js'; a.click();
            URL.revokeObjectURL(url);
        });
        document.getElementById('rlm-modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // Start from the real exploration.js source and splice in only the realms the
    // user changed, so every other export (enemies, events, story, helpers) and
    // all comments stay exactly as shipped.
    async _generateFullFile() {
        const src = await fetchConfigSource('exploration.js');
        const changed = new Map(), removed = new Set(), added = new Map(), renamed = new Map();
        const byOrigKey = new Map([...this.realms].filter(([k, r]) => r._origKey && r._origKey !== k).map(([k, r]) => [r._origKey, [k, r]]));
        for (const key of Object.keys(REALMS)) {
            if (this.realms.has(key)) {
                if (this._isDirty(key)) changed.set(key, this._toDef(this.realms.get(key)));
            } else if (byOrigKey.has(key)) {
                const [newKey, realm] = byOrigKey.get(key);
                renamed.set(key, { key: newKey, value: this._toDef(realm) });
            } else {
                removed.add(key);
            }
        }
        for (const [key, realm] of this.realms) {
            if (!Object.hasOwn(REALMS, key) && !(realm._origKey && renamed.get(realm._origKey)?.key === key)) added.set(key, this._toDef(realm));
        }
        return spliceExportObject(src, 'REALMS', { changed, removed, added, renamed, multiline: true });
    }

    _pushUndoState() {
        const snap = JSON.stringify([...this.realms]);
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
        this.realms = new Map(JSON.parse(snap));
        this._saveToStorage();
        this._rebuildSelector();
        if (this.selectedKey && this.realms.has(this.selectedKey)) {
            this._renderForm();
            this._renderPreview();
        } else {
            this.selectedKey = null;
            document.getElementById('rlm-fields').innerHTML = '<div style="color:#666;text-align:center;padding:40px 20px;">Select a realm from the dropdown above.</div>';
            document.getElementById('rlm-preview').innerHTML = '';
        }
    }

    _onDataChange() {
        this._saveToStorage();
        this._rebuildSelector();
        this._scheduleUndoPush();
    }
}

import { getDiscoveredManifests, getLoadWarnings, isModEnabled, setModEnabled, getModsBaseUrl, setModsBaseUrl, saveLocalDirHandle, clearLocalDirHandle, getLocalDirHandle, getModLoadOrder, setModLoadOrder, hasModsBeenInitialized, markModsInitialized } from '../core/mod-registry.js';

const PANEL_ID = 'mods-panel';
let _restartNeeded = false;

function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _markRestart() {
    _restartNeeded = true;
    const banner = document.getElementById('mods-restart-banner');
    if (banner) banner.style.display = 'flex';
}

function _renderModsList() {
    const manifests = getDiscoveredManifests();
    const warnings = getLoadWarnings();
    const container = document.getElementById('mods-list');
    if (!container) return;

    if (manifests.length === 0) {
        container.innerHTML = '<div style="color:#888;font-size:11px;padding:8px 0;">No mods found. Add mod folders to the mods path and list them in index.json.</div>';
        return;
    }

    // Sort by user load order, then manifest loadOrder.
    const userOrder = getModLoadOrder();
    const userIdx = id => { const i = userOrder.indexOf(id); return i === -1 ? Infinity : i; };
    const sorted = [...manifests].sort((a, b) => {
        const u = userIdx(a.id) - userIdx(b.id);
        return u !== 0 ? u : (a.loadOrder || 50) - (b.loadOrder || 50);
    });

    let html = '';
    for (const m of sorted) {
        const enabled = isModEnabled(m.id, m.defaultEnabled !== false);
        const modWarnings = warnings.filter(w => w.includes(`"${m.id}"`));
        html += `
            <div class="mod-row" data-mod-id="${_esc(m.id)}" draggable="true"
                style="padding:8px 0; border-bottom:1px solid #2a2a44; display:flex; align-items:flex-start; gap:8px; cursor:default;">
                <span class="mod-drag-handle" title="Drag to reorder"
                    style="flex-shrink:0; color:#555; font-size:14px; cursor:grab; padding:2px 4px; margin-top:1px; user-select:none;">&#9776;</span>
                <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; flex:1; min-width:0;">
                    <input type="checkbox" data-mod-id="${_esc(m.id)}" ${enabled ? 'checked' : ''}
                        style="margin-top:2px; flex-shrink:0; accent-color:#ffcc00;">
                    <div style="min-width:0;">
                        <div style="color:#ffcc00; font-weight:bold; font-size:12px;">
                            ${_esc(m.name)} <span style="color:#666; font-weight:normal; font-size:10px;">v${_esc(m.version || '?')} by ${_esc(m.author || '?')}</span>
                        </div>
                        <div style="color:#aaa; font-size:11px; margin-top:2px;">${_esc(m.description || '')}</div>
                        ${m.dependencies && m.dependencies.length ? `<div style="color:#888; font-size:10px; margin-top:3px;">Requires: ${m.dependencies.map(d => _esc(typeof d === 'string' ? d : d.id)).join(', ')}</div>` : ''}
                        ${modWarnings.map(w => `<div style="color:#ffaa33; font-size:10px; margin-top:2px;">! ${_esc(w)}</div>`).join('')}
                    </div>
                </label>
            </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('input[data-mod-id]').forEach(cb => {
        cb.addEventListener('change', () => {
            setModEnabled(cb.dataset.modId, cb.checked);
            _markRestart();
        });
    });

    _initDragToReorder(container);
}

function _initDragToReorder(container) {
    let dragSrc = null;

    container.addEventListener('dragstart', e => {
        const row = e.target.closest('.mod-row');
        if (!row) return;
        dragSrc = row;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => row.style.opacity = '0.4', 0);
    });

    container.addEventListener('dragend', e => {
        const row = e.target.closest('.mod-row');
        if (row) row.style.opacity = '';
        container.querySelectorAll('.mod-row').forEach(r => r.style.background = '');
        dragSrc = null;
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const row = e.target.closest('.mod-row');
        if (!row || row === dragSrc) return;
        container.querySelectorAll('.mod-row').forEach(r => r.style.background = '');
        row.style.background = '#2a2a44';
    });

    container.addEventListener('drop', e => {
        e.preventDefault();
        const target = e.target.closest('.mod-row');
        if (!target || target === dragSrc || !dragSrc) return;
        const rows = [...container.querySelectorAll('.mod-row')];
        const srcIdx = rows.indexOf(dragSrc);
        const tgtIdx = rows.indexOf(target);
        if (srcIdx === -1 || tgtIdx === -1) return;
        if (srcIdx < tgtIdx) target.after(dragSrc);
        else target.before(dragSrc);
        container.querySelectorAll('.mod-row').forEach(r => r.style.background = '');
        dragSrc.style.opacity = '';

        const newOrder = [...container.querySelectorAll('.mod-row')].map(r => r.dataset.modId);
        setModLoadOrder(newOrder);
        _markRestart();
    });
}

export function openModsPanel() {
    const panel = document.getElementById(PANEL_ID);
    const backdrop = document.getElementById('modal-backdrop');
    if (!panel) return;

    const isElectron = typeof window !== 'undefined' && window.electronAPI;
    const hasFSAPI = !isElectron && typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
    const currentPath = getModsBaseUrl();
    const currentHandle = getLocalDirHandle();
    const localLabel = currentHandle ? `Local folder: ${_esc(currentHandle.name)}` : 'No local folder selected';

    const pathRow = isElectron
        ? `<div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
               <span id="mods-path-display" style="color:#ccc; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${_esc(currentPath)}">${_esc(currentPath)}</span>
               <button id="mods-path-browse" style="flex-shrink:0; padding:2px 8px; background:#2a2a4e; color:#aaa; border:1px solid #444; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Browse</button>
           </div>`
        : hasFSAPI
        ? `<div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0; flex-wrap:wrap;">
               <span id="mods-local-label" style="color:#ccc; font-size:11px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${localLabel}</span>
               <button id="mods-local-browse" style="flex-shrink:0; padding:2px 8px; background:#2a2a4e; color:#aaa; border:1px solid #444; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Browse local folder</button>
               ${currentHandle ? `<button id="mods-local-clear" style="flex-shrink:0; padding:2px 8px; background:#16162a; color:#888; border:1px solid #333; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Clear</button>` : ''}
               <div style="width:100%; color:#666; font-size:10px; margin-top:2px;">Or use a URL:</div>
               <input id="mods-path-input" type="text" value="${_esc(currentPath)}"
                   style="flex:1; padding:3px 6px; background:#16162a; color:#ccc; border:1px solid #444; border-radius:3px; font-family:inherit; font-size:11px; min-width:120px;"
                   placeholder="./mods or http://localhost:8080/mods">
               <button id="mods-path-save" style="flex-shrink:0; padding:2px 8px; background:#2a2a4e; color:#aaa; border:1px solid #444; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Set URL</button>
           </div>`
        : `<input id="mods-path-input" type="text" value="${_esc(currentPath)}"
               style="flex:1; padding:3px 6px; background:#16162a; color:#ccc; border:1px solid #444; border-radius:3px; font-family:inherit; font-size:11px; min-width:0;"
               placeholder="./mods or http://localhost:8080/mods">
           <button id="mods-path-save" style="flex-shrink:0; padding:2px 8px; background:#2a2a4e; color:#aaa; border:1px solid #444; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Set</button>`;

    panel.innerHTML = `
        <button data-modal-close onclick="document.getElementById('${PANEL_ID}').style.display='none';document.getElementById('modal-backdrop').style.display='none'"
            style="position:absolute; top:8px; right:12px; background:none; border:none; color:#aaa; font-size:18px; cursor:pointer; z-index:1;">&times;</button>
        <div style="margin-bottom:12px; padding-right:24px;">
            <div style="color:#ffcc00; font-weight:bold;">Mods</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
            <span style="color:#888; font-size:11px; flex-shrink:0;">Mods path:</span>
            ${pathRow}
            <button id="mods-path-reset" style="flex-shrink:0; padding:2px 8px; background:#16162a; color:#888; border:1px solid #333; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px;">Reset</button>
        </div>
        <div id="mods-restart-banner" style="display:${_restartNeeded ? 'flex' : 'none'}; align-items:center; justify-content:space-between; gap:10px; background:#3a2800; color:#ffaa33; padding:6px 10px; border-radius:4px; font-size:11px; margin-bottom:10px; border:1px solid #664400;">
            <span>Restart the game to apply changes.</span>
            <button id="mods-restart-btn" style="padding:2px 10px; background:#664400; color:#ffcc00; border:1px solid #aa6600; border-radius:3px; cursor:pointer; font-family:inherit; font-size:11px; white-space:nowrap;">Restart now</button>
        </div>
        <div id="mods-list"></div>
        <div style="color:#666; font-size:10px; margin-top:10px; line-height:1.5;">
            Add mod folders to the mods path and list their IDs in index.json. Drag rows to reorder load order.
        </div>`;

    // Opening the panel counts as initialization: from here on, enabled state is
    // explicit rather than defaulting all mods to off on every load.
    if (!hasModsBeenInitialized()) {
        markModsInitialized();
    }

    _renderModsList();

    document.getElementById('mods-restart-btn')?.addEventListener('click', () => location.reload());

    if (isElectron) {
        document.getElementById('mods-path-browse').addEventListener('click', async () => {
            let chosen;
            try {
                chosen = await window.electronAPI.pickModsFolder();
            } catch (err) {
                console.error('[Mods] pickModsFolder error:', err);
                return;
            }
            if (chosen) {
                setModsBaseUrl(chosen);
                const display = document.getElementById('mods-path-display');
                if (display) { display.textContent = chosen; display.title = chosen; }
                _markRestart();
            }
        });
    } else if (hasFSAPI) {
        document.getElementById('mods-local-browse').addEventListener('click', async () => {
            let handle;
            try {
                handle = await window.showDirectoryPicker({ mode: 'read' });
            } catch (e) {
                if (e.name !== 'AbortError') console.warn('[Mods] Folder picker error:', e);
                return;
            }
            const label = document.getElementById('mods-local-label');
            if (label) label.textContent = `Local folder: ${handle.name}`;
            _markRestart();
            saveLocalDirHandle(handle).catch(e => console.warn('[Mods] Failed to persist handle:', e));
        });
        const clearBtn = document.getElementById('mods-local-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                await clearLocalDirHandle();
                document.getElementById('mods-local-label').textContent = 'No local folder selected';
                clearBtn.remove();
                _markRestart();
            });
        }
        document.getElementById('mods-path-save').addEventListener('click', () => {
            const val = document.getElementById('mods-path-input').value.trim();
            if (val) { setModsBaseUrl(val); _markRestart(); }
        });
    } else {
        document.getElementById('mods-path-save').addEventListener('click', () => {
            const val = document.getElementById('mods-path-input').value.trim();
            if (val) { setModsBaseUrl(val); _markRestart(); }
        });
    }

    document.getElementById('mods-path-reset').addEventListener('click', async () => {
        let defaultPath = './mods';
        if (typeof window !== 'undefined' && window.electronAPI) {
            defaultPath = await window.electronAPI.getDefaultModsPath().catch(() => './mods');
        }
        setModsBaseUrl(defaultPath);
        const input = document.getElementById('mods-path-input');
        const display = document.getElementById('mods-path-display');
        if (input) input.value = defaultPath;
        if (display) { display.textContent = defaultPath; display.title = defaultPath; }
        _markRestart();
    });

    panel.style.display = 'block';
    if (backdrop) backdrop.style.display = 'block';
}

export function initModsUI() {
    const startBtn = document.getElementById('start-mods');
    if (startBtn) {
        startBtn.addEventListener('click', openModsPanel);
    }
}

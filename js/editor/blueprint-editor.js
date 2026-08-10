import { BUILDINGS, BUILD_CATEGORIES, RESEARCH } from '../core/config.js';

const STRUCTURE_EFFECT_KEYS = [
    'craftSpeedMult', 'manaCostReduction', 'spellCooldownMult', 'researchSpeedMult',
    'manaGenBonus', 'tradeDiscount', 'healingBonus', 'warmthRadius',
    'workSpeedBonus', 'damageBonusMult', 'lightRadius',
];
import { EditorRenderer } from './editor-renderer.js';

const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;
const MIN_ZOOM = 8;
const MAX_ZOOM = 24;
const PAN_SPEED = 1;
const STORAGE_KEY = 'convocation_blueprints';

let editorInstance = null;

export function launchBlueprintEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new BlueprintEditor();
    }
    editorInstance.show();
}

class BlueprintEditor {
    constructor() {
        this.grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            this.grid[y] = new Array(GRID_WIDTH).fill(null);
        }
        this.camera = { x: 45, y: 45 };
        this.zoom = 14;
        this.tool = 'place';
        this.activeBrush = { buildingKey: 'wood_wall' };
        this.coreCell = null;
        this.hoveredCell = null;
        this.selectedCell = null;
        this.blueprintName = '';
        this.blueprintId = '';
        this.structureResearch = '';
        this.structureDescription = '';
        this.structureEffects = '';
        this.customBuildings = [];
        this.categoryFilter = 'All';
        this.reqOverrides = {};

        this._keysDown = new Set();
        this._mouseDown = false;
        this._middleDown = false;
        this._lastDragPos = null;
        this._animFrame = null;
        this._lastAction = null;
        this._strokeCells = null;

        this._buildDOM();
        this._bindEvents();
        this._autoRestore();
    }

    show() {
        this.container.style.display = 'flex';
        requestAnimationFrame(() => {
            this._resizeCanvas();
            if (!this._animFrame) this._startLoop();
        });
    }

    hide() {
        this.container.style.display = 'none';
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
    }

    _buildDOM() {
        this.container = document.getElementById('blueprint-editor');
        this.container.innerHTML = '';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.id = 'bp-toolbar';
        toolbar.innerHTML = `
            <button id="bp-back">← Back</button>
            <span class="bp-sep"></span>
            <label>Name: <input type="text" id="bp-name" placeholder="My Structure" maxlength="40"></label>
            <label>ID: <input type="text" id="bp-id" placeholder="my_structure" maxlength="40"></label>
            <span class="bp-sep"></span>
            <button id="bp-tool-place" class="bp-tool active" data-tool="place" title="Place (1)">Place</button>
            <button id="bp-tool-erase" class="bp-tool" data-tool="erase" title="Erase (2)">Erase</button>
            <button id="bp-tool-pick" class="bp-tool" data-tool="pick" title="Pick (3)">Pick</button>
            <button id="bp-tool-core" class="bp-tool" data-tool="setCore" title="Set Core (4)">Set Core</button>
            <span class="bp-sep"></span>
            <button id="bp-clear">Clear</button>
            <button id="bp-export">Export</button>
            <span class="bp-sep"></span>
            <select id="bp-load-select"><option value="">Load Blueprint...</option></select>
            <button id="bp-save">Save</button>
            <button id="bp-delete">Delete</button>
        `;
        this.container.appendChild(toolbar);

        // Workspace
        const workspace = document.createElement('div');
        workspace.id = 'bp-workspace';

        // Canvas area
        const canvasArea = document.createElement('div');
        canvasArea.id = 'bp-canvas-area';
        const canvas = document.createElement('canvas');
        canvas.id = 'bp-canvas';
        canvasArea.appendChild(canvas);

        const coordsBar = document.createElement('div');
        coordsBar.id = 'bp-coords';
        coordsBar.textContent = 'x: 0, y: 0 | Zoom: 14';
        canvasArea.appendChild(coordsBar);
        workspace.appendChild(canvasArea);

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.id = 'bp-sidebar';
        sidebar.innerHTML = `
            <div id="bp-sidebar-tabs">
                <button class="active" data-bp-tab="tools">Tools</button>
                <button data-bp-tab="export">Export</button>
            </div>
            <div id="bp-sidebar-tools">
                <div class="bp-section">
                    <div class="bp-section-title">Building Palette</div>
                    <div id="bp-category-filter">
                        <button class="bp-cat active" data-cat="All">All</button>
                        ${BUILD_CATEGORIES.map(c => `<button class="bp-cat" data-cat="${c}">${c}</button>`).join('')}
                    </div>
                    <div id="bp-palette"></div>
                    <button id="bp-new-building">+ New Building</button>
                </div>
                <div class="bp-section">
                    <div class="bp-section-title">Cell Properties</div>
                    <div id="bp-cell-props">
                        <div class="bp-muted">Select a placed cell to see properties</div>
                    </div>
                </div>
                <div class="bp-section">
                    <div class="bp-section-title">Structure Properties</div>
                    <div id="bp-struct-props">
                        <label>Research: <input type="text" id="bp-struct-research" placeholder="tech_key"></label>
                        <label>Effects (JSON): <input type="text" id="bp-struct-effects" placeholder='{"craftSpeedMult": 2.0}'></label>
                        <label>Description: <textarea id="bp-struct-desc" rows="2" placeholder="Description..."></textarea></label>
                    </div>
                </div>
                <div class="bp-section">
                    <div class="bp-section-title">ID Reference</div>
                    <input type="text" class="bp-ref-search" id="bp-ref-search" placeholder="Search IDs...">
                    <div id="bp-ref-list"></div>
                </div>
            </div>
            <div id="bp-sidebar-export">
                <div class="bp-export-header">
                    <span style="color:#ffcc00;font-size:11px;font-weight:bold;">LIVE EXPORT</span>
                    <button id="bp-copy-live">Copy</button>
                </div>
                <div id="bp-export-live">// Place buildings to see export</div>
            </div>
        `;
        workspace.appendChild(sidebar);
        this.container.appendChild(workspace);

        this.canvas = canvas;
        this.renderer = new EditorRenderer(canvas);
        this._buildPalette();
        this._buildReferencePanel();
        this._refreshSavedList();
    }

    _buildPalette() {
        const palette = document.getElementById('bp-palette');
        let html = '';

        // Custom buildings first
        for (let i = 0; i < this.customBuildings.length; i++) {
            const def = this.customBuildings[i];
            if (this.categoryFilter !== 'All' && def.category !== this.categoryFilter) continue;
            const active = this.activeBrush?.isCustom && this.activeBrush.customIndex === i ? ' active' : '';
            html += `<div class="bp-palette-item${active}" data-custom="${i}" title="${def.description || def.key}">
                <span style="color:${def.color}">${def.char}</span> <span class="bp-custom-tag">✦</span>${def.key}
            </div>`;
        }

        // Existing buildings
        for (const [key, def] of Object.entries(BUILDINGS)) {
            if (this.categoryFilter !== 'All' && def.category !== this.categoryFilter) continue;
            const active = !this.activeBrush?.isCustom && this.activeBrush?.buildingKey === key ? ' active' : '';
            html += `<div class="bp-palette-item${active}" data-key="${key}" title="${def.description}">
                <span style="color:${def.color}">${def.char}</span> ${key.replace(/_/g, ' ')}
            </div>`;
        }
        palette.innerHTML = html;
    }

    _bindEvents() {
        // Toolbar
        document.getElementById('bp-back').addEventListener('click', () => this._goBack());
        document.getElementById('bp-clear').addEventListener('click', () => this._clearGrid());
        document.getElementById('bp-export').addEventListener('click', () => this._export());
        document.getElementById('bp-save').addEventListener('click', () => this._save());
        document.getElementById('bp-delete').addEventListener('click', () => this._deleteSaved());
        document.getElementById('bp-load-select').addEventListener('change', (e) => this._loadBlueprint(e.target.value));
        document.getElementById('bp-new-building').addEventListener('click', () => this._showNewBuildingForm());

        document.getElementById('bp-name').addEventListener('input', (e) => { this.blueprintName = e.target.value; this._autoSave(); this._updateLiveExport(); });
        document.getElementById('bp-id').addEventListener('input', (e) => { this.blueprintId = e.target.value; this._autoSave(); this._updateLiveExport(); });
        document.getElementById('bp-struct-research').addEventListener('input', (e) => { this.structureResearch = e.target.value; this._autoSave(); this._updateLiveExport(); });
        document.getElementById('bp-struct-effects').addEventListener('input', (e) => { this.structureEffects = e.target.value; this._autoSave(); this._updateLiveExport(); });
        document.getElementById('bp-struct-desc').addEventListener('input', (e) => { this.structureDescription = e.target.value; this._autoSave(); this._updateLiveExport(); });

        document.getElementById('bp-sidebar-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bp-tab]');
            if (!btn) return;
            const tab = btn.dataset.bpTab;
            document.querySelectorAll('#bp-sidebar-tabs button').forEach(b => b.classList.toggle('active', b.dataset.bpTab === tab));
            document.getElementById('bp-sidebar-tools').classList.toggle('hidden', tab !== 'tools');
            const exportPanel = document.getElementById('bp-sidebar-export');
            exportPanel.classList.toggle('visible', tab === 'export');
            if (tab === 'export') this._updateLiveExport();
        });

        document.getElementById('bp-copy-live').addEventListener('click', () => {
            const text = document.getElementById('bp-export-live').textContent;
            navigator.clipboard.writeText(text);
            const btn = document.getElementById('bp-copy-live');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1000);
        });

        // Tool buttons
        this.container.querySelectorAll('.bp-tool').forEach(btn => {
            btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
        });

        // Category filter
        document.getElementById('bp-category-filter').addEventListener('click', (e) => {
            const btn = e.target.closest('.bp-cat');
            if (!btn) return;
            this.categoryFilter = btn.dataset.cat;
            document.querySelectorAll('.bp-cat').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._buildPalette();
        });

        // Palette clicks
        document.getElementById('bp-palette').addEventListener('click', (e) => {
            const item = e.target.closest('.bp-palette-item');
            if (!item) return;
            if (item.dataset.key) {
                this.activeBrush = { buildingKey: item.dataset.key };
            } else if (item.dataset.custom !== undefined) {
                const idx = parseInt(item.dataset.custom);
                this.activeBrush = { isCustom: true, customIndex: idx, customDef: this.customBuildings[idx] };
            }
            this._setTool('place');
            this._buildPalette();
        });

        // Canvas events
        const canvas = this.canvas;
        canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        canvas.addEventListener('mouseleave', () => { this.hoveredCell = null; this._mouseDown = false; this._middleDown = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); this._onWheel(e); });

        // Keyboard
        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup', (e) => this._onKeyUp(e));

        // Resize
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    _onMouseDown(e) {
        if (e.button === 1) {
            this._middleDown = true;
            this._lastDragPos = { x: e.clientX, y: e.clientY };
            return;
        }
        if (e.button === 2) {
            this._mouseDown = true;
            this._strokeCells = new Map();
            const pos = this._eventToGrid(e);
            if (pos) this._eraseAt(pos.x, pos.y);
            return;
        }
        this._mouseDown = true;
        this._strokeCells = new Map();
        const pos = this._eventToGrid(e);
        if (pos) this._applyTool(pos.x, pos.y);
    }

    _onMouseMove(e) {
        if (this._middleDown && this._lastDragPos) {
            const dx = e.clientX - this._lastDragPos.x;
            const dy = e.clientY - this._lastDragPos.y;
            const cellsMoved = { x: Math.round(-dx / this.renderer.charWidth), y: Math.round(-dy / this.renderer.charHeight) };
            if (cellsMoved.x !== 0 || cellsMoved.y !== 0) {
                this.camera.x += cellsMoved.x;
                this.camera.y += cellsMoved.y;
                this._clampCamera();
                this._lastDragPos = { x: e.clientX, y: e.clientY };
            }
            return;
        }

        const pos = this._eventToGrid(e);
        this.hoveredCell = pos;
        this._updateCoords(pos);

        if (this._mouseDown && pos) {
            if (e.buttons === 2) {
                this._eraseAt(pos.x, pos.y);
            } else {
                this._applyTool(pos.x, pos.y);
            }
        }
    }

    _onMouseUp(e) {
        if (e.button === 1) { this._middleDown = false; this._lastDragPos = null; return; }
        this._mouseDown = false;
        if (this._strokeCells && this._strokeCells.size > 0) {
            const after = new Map();
            for (const [key] of this._strokeCells) {
                const [x, y] = key.split(',').map(Number);
                after.set(key, this.grid[y][x] ? { ...this.grid[y][x] } : null);
            }
            this._lastAction = { before: this._strokeCells, after, undone: false };
            this._autoSave();
            this._updateLiveExport();
        }
        this._strokeCells = null;
    }

    _onWheel(e) {
        const delta = e.deltaY > 0 ? -1 : 1;
        this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta));
        this.renderer.measureFont(this.zoom);
        this._resizeCanvas();
    }

    _onKeyDown(e) {
        if (this.container.style.display === 'none') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this._toggleUndo();
            return;
        }

        this._keysDown.add(e.key);
        switch (e.key) {
            case '1': this._setTool('place'); break;
            case '2': this._setTool('erase'); break;
            case '3': this._setTool('pick'); break;
            case '4': this._setTool('setCore'); break;
            case '+': case '=': this.zoom = Math.min(MAX_ZOOM, this.zoom + 1); this.renderer.measureFont(this.zoom); this._resizeCanvas(); break;
            case '-': this.zoom = Math.max(MIN_ZOOM, this.zoom - 1); this.renderer.measureFont(this.zoom); this._resizeCanvas(); break;
            case 'Escape': this._goBack(); break;
        }
    }

    _toggleUndo() {
        if (!this._lastAction) return;
        const { before, after, undone } = this._lastAction;
        const restoreTo = undone ? after : before;
        for (const [key, cell] of restoreTo) {
            const [x, y] = key.split(',').map(Number);
            this.grid[y][x] = cell ? { ...cell } : null;
        }
        this._lastAction.undone = !undone;
        this._updateLiveExport();
    }

    _onKeyUp(e) {
        this._keysDown.delete(e.key);
    }

    _eventToGrid(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const pos = this.renderer.screenToGrid(sx, sy, this.camera);
        if (pos.x < 0 || pos.x >= GRID_WIDTH || pos.y < 0 || pos.y >= GRID_HEIGHT) return null;
        return pos;
    }

    _snapshotCell(x, y) {
        if (!this._strokeCells) return;
        const key = `${x},${y}`;
        if (!this._strokeCells.has(key)) {
            const cell = this.grid[y][x];
            this._strokeCells.set(key, cell ? { ...cell } : null);
        }
    }

    _applyTool(x, y) {
        switch (this.tool) {
            case 'place':
                if (this.activeBrush) {
                    this._snapshotCell(x, y);
                    const brushDef = this.activeBrush.isCustom ? this.activeBrush.customDef : BUILDINGS[this.activeBrush.buildingKey];
                    const isFloor = brushDef && brushDef.structureType === 'floor';
                    const existing = this.grid[y][x];

                    if (isFloor) {
                        const floorData = this.activeBrush.isCustom
                            ? { isCustom: true, customDef: this.activeBrush.customDef, customIndex: this.activeBrush.customIndex }
                            : { buildingKey: this.activeBrush.buildingKey };
                        if (existing && this._cellIsStructure(existing)) {
                            existing.floorKey = floorData;
                        } else {
                            this.grid[y][x] = { ...floorData, _floorOnly: true };
                        }
                    } else {
                        const floorKey = existing?.floorKey || (existing?._floorOnly ? this._extractFloorData(existing) : null);
                        if (this.activeBrush.isCustom) {
                            this.grid[y][x] = { isCustom: true, customDef: this.activeBrush.customDef, customIndex: this.activeBrush.customIndex };
                        } else {
                            this.grid[y][x] = { buildingKey: this.activeBrush.buildingKey };
                        }
                        if (floorKey) this.grid[y][x].floorKey = floorKey;
                    }
                }
                break;
            case 'erase':
                this._eraseAt(x, y);
                break;
            case 'pick':
                const cell = this.grid[y][x];
                if (cell) {
                    if (cell.isCustom) {
                        this.activeBrush = { isCustom: true, customIndex: cell.customIndex, customDef: cell.customDef };
                    } else {
                        this.activeBrush = { buildingKey: cell.buildingKey };
                    }
                    this._buildPalette();
                }
                this.selectedCell = { x, y };
                this._updateCellProps();
                break;
            case 'setCore':
                this.coreCell = { x, y };
                this._updateLiveExport();
                break;
        }
        if (this.tool === 'place' || this.tool === 'erase') {
            this.selectedCell = { x, y };
            this._updateCellProps();
        }
    }

    _eraseAt(x, y) {
        this._snapshotCell(x, y);
        this.grid[y][x] = null;
        if (this.coreCell && this.coreCell.x === x && this.coreCell.y === y) {
            this.coreCell = null;
        }
        const key = `${x},${y}`;
        delete this.reqOverrides[key];
    }

    _cellIsStructure(cell) {
        if (!cell || cell._floorOnly) return false;
        const def = cell.isCustom ? cell.customDef : BUILDINGS[cell.buildingKey];
        return def && def.structureType !== 'floor';
    }

    _extractFloorData(cell) {
        if (!cell) return null;
        const { _floorOnly, ...data } = cell;
        return data;
    }

    _setTool(tool) {
        this.tool = tool;
        this.container.querySelectorAll('.bp-tool').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    _updateCoords(pos) {
        const bar = document.getElementById('bp-coords');
        if (pos) {
            bar.textContent = `x: ${pos.x}, y: ${pos.y} | Zoom: ${this.zoom}`;
        } else {
            bar.textContent = `Zoom: ${this.zoom}`;
        }
    }

    _updateCellProps() {
        const panel = document.getElementById('bp-cell-props');
        if (!this.selectedCell) {
            panel.innerHTML = '<div class="bp-muted">Select a placed cell to see properties</div>';
            return;
        }
        const { x, y } = this.selectedCell;
        const cell = this.grid[y]?.[x];
        if (!cell) {
            panel.innerHTML = '<div class="bp-muted">Empty cell</div>';
            return;
        }

        const def = cell.isCustom ? cell.customDef : BUILDINGS[cell.buildingKey];
        const key = cell.isCustom ? cell.customDef.key : cell.buildingKey;
        const isCore = this.coreCell && this.coreCell.x === x && this.coreCell.y === y;
        const reqKey = `${x},${y}`;
        const currentReq = this.reqOverrides[reqKey] || key;

        let html = '';
        if (cell._floorOnly) {
            html += `<div><span style="color:${def.color}">${def.char}</span> <strong>${key.replace(/_/g, ' ')}</strong> <span style="color:#999">(floor)</span></div>`;
            html += `<div class="bp-muted">floor | ${def.category || 'Walls & Floors'}</div>`;
        } else {
            html += `<div><span style="color:${def.color}">${def.char}</span> <strong>${key.replace(/_/g, ' ')}</strong>`;
            if (isCore) html += ` <span class="bp-core-badge">CORE</span>`;
            html += `</div>`;
            html += `<div class="bp-muted">${def.structureType} | ${def.category}</div>`;

            if (cell.floorKey) {
                const floorDef = cell.floorKey.isCustom ? cell.floorKey.customDef : BUILDINGS[cell.floorKey.buildingKey];
                const floorName = cell.floorKey.isCustom ? cell.floorKey.customDef.key : cell.floorKey.buildingKey;
                if (floorDef) {
                    html += `<div style="margin-top:4px;color:#999;font-size:0.85em">Floor: <span style="color:${floorDef.color}">${floorDef.char}</span> ${floorName.replace(/_/g, ' ')}</div>`;
                }
            }
        }

        html += `<label>Layout req:
            <select id="bp-req-override" data-pos="${reqKey}">
                <option value="${key}"${currentReq === key ? ' selected' : ''}>Specific: ${key}</option>
                <option value="wall"${currentReq === 'wall' ? ' selected' : ''}>Any wall</option>
                <option value="door"${currentReq === 'door' ? ' selected' : ''}>Any door</option>
                <option value="floor"${currentReq === 'floor' ? ' selected' : ''}>Any floor</option>
            </select>
        </label>`;

        panel.innerHTML = html;

        document.getElementById('bp-req-override')?.addEventListener('change', (e) => {
            const pos = e.target.dataset.pos;
            const val = e.target.value;
            const cellKey = cell.isCustom ? cell.customDef.key : cell.buildingKey;
            if (val === cellKey) {
                delete this.reqOverrides[pos];
            } else {
                this.reqOverrides[pos] = val;
            }
        });
    }

    _clearGrid() {
        if (!confirm('Clear the entire grid?')) return;
        for (let y = 0; y < GRID_HEIGHT; y++) {
            this.grid[y] = new Array(GRID_WIDTH).fill(null);
        }
        this.coreCell = null;
        this.selectedCell = null;
        this.reqOverrides = {};
        this._updateCellProps();
        this._updateLiveExport();
    }

    _clampCamera() {
        this.camera.x = Math.max(0, Math.min(GRID_WIDTH - 1, this.camera.x));
        this.camera.y = Math.max(0, Math.min(GRID_HEIGHT - 1, this.camera.y));
    }

    _resizeCanvas() {
        const area = document.getElementById('bp-canvas-area');
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const coordsBar = document.getElementById('bp-coords');
        const coordsH = coordsBar ? coordsBar.offsetHeight : 28;
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height) - coordsH;
        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    _startLoop() {
        let panAccum = 0;
        const loop = () => {
            if (this.container.style.display === 'none') { this._animFrame = null; return; }

            // Keyboard panning (throttled to ~10 cells/sec)
            panAccum++;
            if (panAccum >= 6 && this._keysDown.size > 0) {
                panAccum = 0;
                if (this._keysDown.has('w') || this._keysDown.has('ArrowUp')) { this.camera.y -= PAN_SPEED; this._clampCamera(); }
                if (this._keysDown.has('s') || this._keysDown.has('ArrowDown')) { this.camera.y += PAN_SPEED; this._clampCamera(); }
                if (this._keysDown.has('a') || this._keysDown.has('ArrowLeft')) { this.camera.x -= PAN_SPEED; this._clampCamera(); }
                if (this._keysDown.has('d') || this._keysDown.has('ArrowRight')) { this.camera.x += PAN_SPEED; this._clampCamera(); }
            }

            this.renderer.render({
                grid: this.grid,
                gridWidth: GRID_WIDTH,
                gridHeight: GRID_HEIGHT,
                camera: this.camera,
                hoveredCell: this.hoveredCell,
                selectedCell: this.selectedCell,
                coreCell: this.coreCell,
                buildings: BUILDINGS
            });

            this._animFrame = requestAnimationFrame(loop);
        };
        this._animFrame = requestAnimationFrame(loop);
    }

    _goBack() {
        this.hide();
        document.getElementById('start-screen').style.display = '';
    }

    _buildReferencePanel() {
        const container = document.getElementById('bp-ref-list');
        const categories = [
            { title: 'Effect Keys', ids: STRUCTURE_EFFECT_KEYS },
            { title: 'Research IDs', ids: Object.keys(RESEARCH) },
            { title: 'Building IDs', ids: Object.keys(BUILDINGS) },
        ];

        let html = '';
        for (const cat of categories) {
            html += `<div class="bp-ref-category-title">${cat.title}</div>`;
            for (const id of cat.ids) {
                html += `<span class="bp-ref-id" data-ref-id="${id}">${id}</span>`;
            }
        }
        container.innerHTML = html;

        container.addEventListener('click', (e) => {
            const pill = e.target.closest('.bp-ref-id');
            if (!pill) return;
            navigator.clipboard.writeText(pill.dataset.refId);
            pill.classList.add('copied');
            setTimeout(() => pill.classList.remove('copied'), 600);
        });

        document.getElementById('bp-ref-search').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            container.querySelectorAll('.bp-ref-id').forEach(el => {
                el.style.display = el.dataset.refId.includes(q) ? '' : 'none';
            });
        });
    }

    _updateLiveExport() {
        const el = document.getElementById('bp-export-live');
        if (!el) return;
        const code = this._generateExportCode();
        el.textContent = code;
    }

    _generateExportCode() {
        const cells = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x]) cells.push({ x, y, cell: this.grid[y][x] });
            }
        }
        if (cells.length === 0) return '// Place buildings to see export';

        const name = this.blueprintName || 'unnamed_structure';
        const id = this.blueprintId || name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        let output = '';

        const usedCustoms = new Set();
        cells.forEach(c => {
            if (c.cell.isCustom) usedCustoms.add(c.cell.customIndex);
            if (c.cell.floorKey?.isCustom) usedCustoms.add(c.cell.floorKey.customIndex);
        });
        if (usedCustoms.size > 0) {
            output += '// === Add to BUILDINGS in config.js ===\n';
            for (const idx of usedCustoms) {
                const def = this.customBuildings[idx];
                output += this._formatBuildingDef(def) + '\n';
            }
            output += '\n';
        }

        if (cells.length === 1 && !cells[0].cell.isCustom) {
            const key = cells[0].cell.buildingKey;
            output += `// Single building: ${key} (already exists in config)\n`;
            return output;
        }
        if (cells.length === 1 && cells[0].cell.isCustom) {
            return output || '// Custom building defined above';
        }

        if (!this.coreCell || !this.grid[this.coreCell.y]?.[this.coreCell.x]) {
            return output + '// Set a core cell (tool 4) for multi-cell export';
        }

        const coreCell = this.grid[this.coreCell.y][this.coreCell.x];
        const coreBuild = coreCell.isCustom ? coreCell.customDef.key : coreCell.buildingKey;

        const layout = [];
        for (const { x, y, cell } of cells) {
            if (x === this.coreCell.x && y === this.coreCell.y) continue;
            const dx = x - this.coreCell.x;
            const dy = y - this.coreCell.y;
            const posKey = `${x},${y}`;
            const req = this.reqOverrides[posKey] || (cell.isCustom ? cell.customDef.key : cell.buildingKey);
            const entry = { dx, dy, req };
            if (cell.floorKey) {
                entry.floor = cell.floorKey.isCustom ? cell.floorKey.customDef.key : cell.floorKey.buildingKey;
            }
            layout.push(entry);
        }

        layout.sort((a, b) => a.dy - b.dy || a.dx - b.dx);

        let effectStr = '{}';
        if (this.structureEffects.trim()) {
            try { JSON.parse(this.structureEffects); effectStr = this.structureEffects.trim(); }
            catch { effectStr = '{ /* invalid JSON */ }'; }
        }

        output += '// === Add to COMPLEX_STRUCTURES in config.js ===\n';
        output += `${id}: {\n`;
        output += `    name: '${name.replace(/'/g, "\\'")}',\n`;
        if (this.structureResearch) output += `    research: '${this.structureResearch}',\n`;
        output += `    coreBuild: '${coreBuild}',\n`;
        if (coreCell.floorKey) {
            const coreFloor = coreCell.floorKey.isCustom ? coreCell.floorKey.customDef.key : coreCell.floorKey.buildingKey;
            output += `    coreFloor: '${coreFloor}',\n`;
        }
        output += `    layout: [\n`;
        for (const l of layout) {
            let line = `        { dx: ${l.dx}, dy: ${l.dy}, req: '${l.req}'`;
            if (l.floor) line += `, floor: '${l.floor}'`;
            line += ` },`;
            output += line + '\n';
        }
        output += `    ],\n`;
        output += `    effect: ${effectStr},\n`;
        output += `    description: '${(this.structureDescription || '').replace(/'/g, "\\'")}',\n`;
        output += `},\n`;

        return output;
    }

    // --- New Building Form ---
    _showNewBuildingForm() {
        const existing = document.getElementById('bp-new-building-form');
        if (existing) { existing.remove(); return; }

        const form = document.createElement('div');
        form.id = 'bp-new-building-form';
        form.className = 'bp-modal';
        form.innerHTML = `
            <div class="bp-modal-content">
                <h3>New Custom Building</h3>
                <label>Key (snake_case): <input type="text" id="nbf-key" placeholder="my_building"></label>
                <label>Character: <input type="text" id="nbf-char" maxlength="2" value="X" style="width:30px"></label>
                <label>Color: <input type="color" id="nbf-color" value="#ff8844"></label>
                <label>Background: <input type="color" id="nbf-bg" value="#000000"> <input type="checkbox" id="nbf-bg-none" checked> None</label>
                <label>Structure Type:
                    <select id="nbf-type">
                        <option value="furniture">Furniture</option>
                        <option value="wall">Wall</option>
                        <option value="floor">Floor</option>
                        <option value="door">Door</option>
                    </select>
                </label>
                <label>Category:
                    <select id="nbf-category">
                        ${BUILD_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </label>
                <label>Cost (e.g. wood:5, stone:3): <input type="text" id="nbf-cost" placeholder="wood:5, stone:3"></label>
                <label>Work (ticks): <input type="number" id="nbf-work" value="30" min="1"></label>
                <label>HP: <input type="number" id="nbf-hp" value="0" min="0"> (0 = none)</label>
                <label>Light Radius: <input type="number" id="nbf-light" value="0" min="0"></label>
                <label>Research: <input type="text" id="nbf-research" placeholder="(optional)"></label>
                <label>Description: <input type="text" id="nbf-desc" placeholder="What it does"></label>
                <div class="bp-form-passable">
                    <span>Passable:</span>
                    <label><input type="checkbox" id="nbf-pass-col"> Colonist</label>
                    <label><input type="checkbox" id="nbf-pass-ani"> Animal</label>
                    <label><input type="checkbox" id="nbf-pass-ene"> Enemy</label>
                </div>
                <label><input type="checkbox" id="nbf-breakable"> Breakable</label>
                <div style="margin-top:8px">
                    <button id="nbf-add">Add Building</button>
                    <button id="nbf-cancel">Cancel</button>
                </div>
            </div>
        `;
        this.container.appendChild(form);

        document.getElementById('nbf-add').addEventListener('click', () => this._addCustomBuilding(form));
        document.getElementById('nbf-cancel').addEventListener('click', () => form.remove());
    }

    _addCustomBuilding(form) {
        const key = document.getElementById('nbf-key').value.trim();
        if (!key || BUILDINGS[key]) {
            alert(key ? `Building "${key}" already exists in config.` : 'Key is required.');
            return;
        }
        const def = {
            key,
            char: document.getElementById('nbf-char').value || 'X',
            color: document.getElementById('nbf-color').value,
            cost: this._parseCost(document.getElementById('nbf-cost').value),
            work: parseInt(document.getElementById('nbf-work').value) || 30,
            structureType: document.getElementById('nbf-type').value,
            category: document.getElementById('nbf-category').value,
            description: document.getElementById('nbf-desc').value || '',
        };
        if (!document.getElementById('nbf-bg-none').checked) {
            def.bg = document.getElementById('nbf-bg').value;
        }
        const hp = parseInt(document.getElementById('nbf-hp').value);
        if (hp > 0) def.hp = hp;
        const light = parseInt(document.getElementById('nbf-light').value);
        if (light > 0) def.lightRadius = light;
        const research = document.getElementById('nbf-research').value.trim();
        if (research) def.research = research;
        const passCol = document.getElementById('nbf-pass-col').checked;
        const passAni = document.getElementById('nbf-pass-ani').checked;
        const passEne = document.getElementById('nbf-pass-ene').checked;
        if (!passCol || !passAni || !passEne) {
            def.passable = { colonist: passCol, animal: passAni, enemy: passEne };
        }
        if (document.getElementById('nbf-breakable').checked) def.breakable = true;

        this.customBuildings.push(def);
        this.activeBrush = { isCustom: true, customIndex: this.customBuildings.length - 1, customDef: def };
        this._buildPalette();
        form.remove();
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

    // --- Export ---
    _export() {
        const cells = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x]) cells.push({ x, y, cell: this.grid[y][x] });
            }
        }
        if (cells.length === 0) { alert('Nothing to export — place some buildings first.'); return; }

        const name = this.blueprintName || 'unnamed_structure';
        const id = this.blueprintId || name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        let output = '';

        // Export custom building definitions
        const usedCustoms = new Set();
        cells.forEach(c => {
            if (c.cell.isCustom) usedCustoms.add(c.cell.customIndex);
            if (c.cell.floorKey?.isCustom) usedCustoms.add(c.cell.floorKey.customIndex);
        });
        if (usedCustoms.size > 0) {
            output += '// === Add to BUILDINGS in config.js ===\n';
            for (const idx of usedCustoms) {
                const def = this.customBuildings[idx];
                output += this._formatBuildingDef(def) + '\n';
            }
            output += '\n';
        }

        // Single cell export (just a building definition)
        if (cells.length === 1 && !cells[0].cell.isCustom) {
            const key = cells[0].cell.buildingKey;
            output += `// Single building: ${key} (already exists in config)\n`;
            output += `// No export needed — use existing "${key}" definition.\n`;
            this._showExportModal(output);
            return;
        }
        if (cells.length === 1 && cells[0].cell.isCustom) {
            if (!output) output += '// === Add to BUILDINGS in config.js ===\n';
            this._showExportModal(output);
            return;
        }

        // Multi-cell: complex structure
        if (!this.coreCell || !this.grid[this.coreCell.y]?.[this.coreCell.x]) {
            alert('Set a core cell first (tool 4) — it defines the center of the complex structure.');
            this._setTool('setCore');
            return;
        }

        const coreCell = this.grid[this.coreCell.y][this.coreCell.x];
        const coreBuild = coreCell.isCustom ? coreCell.customDef.key : coreCell.buildingKey;

        const layout = [];
        for (const { x, y, cell } of cells) {
            if (x === this.coreCell.x && y === this.coreCell.y) continue;
            const dx = x - this.coreCell.x;
            const dy = y - this.coreCell.y;
            const posKey = `${x},${y}`;
            const req = this.reqOverrides[posKey] || (cell.isCustom ? cell.customDef.key : cell.buildingKey);
            const entry = { dx, dy, req };
            if (cell.floorKey) {
                entry.floor = cell.floorKey.isCustom ? cell.floorKey.customDef.key : cell.floorKey.buildingKey;
            }
            layout.push(entry);
        }

        layout.sort((a, b) => a.dy - b.dy || a.dx - b.dx);

        let effectStr = '{}';
        if (this.structureEffects.trim()) {
            try { JSON.parse(this.structureEffects); effectStr = this.structureEffects.trim(); }
            catch { effectStr = '{ /* invalid JSON — fix manually */ }'; }
        }

        output += '// === Add to COMPLEX_STRUCTURES in config.js ===\n';
        output += `${id}: {\n`;
        output += `    name: '${name.replace(/'/g, "\\'")}',\n`;
        if (this.structureResearch) output += `    research: '${this.structureResearch}',\n`;
        output += `    coreBuild: '${coreBuild}',\n`;
        if (coreCell.floorKey) {
            const coreFloor = coreCell.floorKey.isCustom ? coreCell.floorKey.customDef.key : coreCell.floorKey.buildingKey;
            output += `    coreFloor: '${coreFloor}',\n`;
        }
        output += `    layout: [\n`;
        for (const l of layout) {
            let line = `        { dx: ${l.dx}, dy: ${l.dy}, req: '${l.req}'`;
            if (l.floor) line += `, floor: '${l.floor}'`;
            line += ` },`;
            output += line + '\n';
        }
        output += `    ],\n`;
        output += `    effect: ${effectStr},\n`;
        output += `    description: '${(this.structureDescription || '').replace(/'/g, "\\'")}',\n`;
        output += `},\n`;

        this._showExportModal(output);
    }

    _formatBuildingDef(def) {
        let parts = [];
        parts.push(`char: '${def.char}'`);
        parts.push(`color: '${def.color}'`);
        if (def.bg) parts.push(`bg: '${def.bg}'`);
        parts.push(`cost: ${JSON.stringify(def.cost)}`);
        parts.push(`work: ${def.work}`);
        if (def.hp) parts.push(`hp: ${def.hp}`);
        parts.push(`structureType: '${def.structureType}'`);
        parts.push(`category: '${def.category}'`);
        if (def.passable) parts.push(`passable: ${JSON.stringify(def.passable)}`);
        if (def.breakable) parts.push(`breakable: true`);
        if (def.lightRadius) parts.push(`lightRadius: ${def.lightRadius}`);
        if (def.research) parts.push(`research: '${def.research}'`);
        parts.push(`description: '${(def.description || '').replace(/'/g, "\\'")}'`);
        return `${def.key}: { ${parts.join(', ')} },`;
    }

    _showExportModal(text) {
        const existing = document.getElementById('bp-export-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'bp-export-modal';
        modal.className = 'bp-modal';
        modal.innerHTML = `
            <div class="bp-modal-content bp-export-content">
                <h3>Export — Copy to config.js</h3>
                <textarea id="bp-export-text" rows="20" readonly>${text}</textarea>
                <div style="margin-top:8px">
                    <button id="bp-export-copy">Copy to Clipboard</button>
                    <button id="bp-export-close">Close</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        document.getElementById('bp-export-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                document.getElementById('bp-export-copy').textContent = 'Copied!';
                setTimeout(() => { document.getElementById('bp-export-copy').textContent = 'Copy to Clipboard'; }, 1500);
            });
        });
        document.getElementById('bp-export-close').addEventListener('click', () => modal.remove());
    }

    // --- Save/Load ---
    _save() {
        const name = this.blueprintName || 'unnamed';
        const id = this.blueprintId || name.toLowerCase().replace(/\s+/g, '_');
        const data = {
            id, name,
            grid: this._serializeGrid(),
            coreCell: this.coreCell,
            reqOverrides: this.reqOverrides,
            customBuildings: this.customBuildings,
            structureResearch: this.structureResearch,
            structureEffects: this.structureEffects,
            structureDescription: this.structureDescription,
        };
        const saved = this._getSaved();
        const existingIdx = saved.findIndex(s => s.id === id);
        if (existingIdx >= 0) saved[existingIdx] = data;
        else saved.push(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        this._refreshSavedList();
        alert(`Blueprint "${name}" saved.`);
    }

    _loadBlueprint(id) {
        if (!id) return;
        const saved = this._getSaved();
        const bp = saved.find(s => s.id === id);
        if (!bp) return;

        this._clearGridSilent();
        this.blueprintName = bp.name || '';
        this.blueprintId = bp.id || '';
        this.coreCell = bp.coreCell || null;
        this.reqOverrides = bp.reqOverrides || {};
        this.customBuildings = bp.customBuildings || [];
        this.structureResearch = bp.structureResearch || '';
        this.structureEffects = bp.structureEffects || '';
        this.structureDescription = bp.structureDescription || '';

        document.getElementById('bp-name').value = this.blueprintName;
        document.getElementById('bp-id').value = this.blueprintId;
        document.getElementById('bp-struct-research').value = this.structureResearch;
        document.getElementById('bp-struct-effects').value = this.structureEffects;
        document.getElementById('bp-struct-desc').value = this.structureDescription;

        this._deserializeGrid(bp.grid);
        this._buildPalette();
        this._updateCellProps();

        document.getElementById('bp-load-select').value = '';
    }

    _deleteSaved() {
        const id = this.blueprintId || document.getElementById('bp-load-select').value;
        if (!id) { alert('Enter an ID or select a blueprint to delete.'); return; }
        const saved = this._getSaved();
        const idx = saved.findIndex(s => s.id === id);
        if (idx < 0) { alert(`No saved blueprint with id "${id}".`); return; }
        if (!confirm(`Delete blueprint "${saved[idx].name}"?`)) return;
        saved.splice(idx, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        this._refreshSavedList();
    }

    _getSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }

    _refreshSavedList() {
        const sel = document.getElementById('bp-load-select');
        if (!sel) return;
        const saved = this._getSaved();
        sel.innerHTML = '<option value="">Load Blueprint...</option>' +
            saved.map(s => `<option value="${s.id}">${s.name || s.id}</option>`).join('');
    }

    _serializeGrid() {
        const cells = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x]) cells.push({ x, y, cell: this.grid[y][x] });
            }
        }
        return cells;
    }

    _deserializeGrid(cells) {
        if (!cells) return;
        for (const { x, y, cell } of cells) {
            if (y < GRID_HEIGHT && x < GRID_WIDTH) {
                this.grid[y][x] = cell;
            }
        }
    }

    _clearGridSilent() {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            this.grid[y] = new Array(GRID_WIDTH).fill(null);
        }
        this.coreCell = null;
        this.selectedCell = null;
        this.reqOverrides = {};
    }

    _autoSave() {
        try {
            const data = {
                grid: this._serializeGrid(),
                coreCell: this.coreCell,
                reqOverrides: this.reqOverrides,
                customBuildings: this.customBuildings,
                blueprintName: this.blueprintName,
                blueprintId: this.blueprintId,
                structureResearch: this.structureResearch,
                structureEffects: this.structureEffects,
                structureDescription: this.structureDescription,
                camera: this.camera,
                zoom: this.zoom,
            };
            localStorage.setItem(STORAGE_KEY + '_autosave', JSON.stringify(data));
        } catch {}
    }

    _autoRestore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY + '_autosave');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || !data.grid || !data.grid.length) return;
            this._deserializeGrid(data.grid);
            this.coreCell = data.coreCell || null;
            this.reqOverrides = data.reqOverrides || {};
            this.customBuildings = data.customBuildings || [];
            this.blueprintName = data.blueprintName || '';
            this.blueprintId = data.blueprintId || '';
            this.structureResearch = data.structureResearch || '';
            this.structureEffects = data.structureEffects || '';
            this.structureDescription = data.structureDescription || '';
            if (data.camera) this.camera = data.camera;
            if (data.zoom) this.zoom = data.zoom;
            document.getElementById('bp-name').value = this.blueprintName;
            document.getElementById('bp-id').value = this.blueprintId;
            const resEl = document.getElementById('bp-struct-research');
            const effEl = document.getElementById('bp-struct-effects');
            const descEl = document.getElementById('bp-struct-desc');
            if (resEl) resEl.value = this.structureResearch;
            if (effEl) effEl.value = this.structureEffects;
            if (descEl) descEl.value = this.structureDescription;
            this._buildPalette();
        } catch {}
    }
}

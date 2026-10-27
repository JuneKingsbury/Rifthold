import { CONFIG } from '../core/config.js';
import { Minimap, MAP_LAYERS, MAP_TERRAIN_KEY, CRYPT_STATE_KEY, defaultMapLayers } from './minimap.js';

const LAYER_STORAGE_KEY = 'rifthold_fullmap_layers';

// Canvas pixels per tile target: ~1000px across on the default map, never below 3 so a
// large map still has more detail than the footer minimap.
const TARGET_CANVAS_WIDTH = 1000;
const MIN_SCALE = 3;
const MAX_SCALE = 8;

const swatch = (c) => `<span class="map-swatch" style="background:rgb(${c[0]},${c[1]},${c[2]})"></span>`;

function loadLayers() {
    const layers = defaultMapLayers();
    try {
        const saved = JSON.parse(localStorage.getItem(LAYER_STORAGE_KEY) || '{}');
        for (const key of Object.keys(layers)) {
            if (typeof saved[key] === 'boolean') layers[key] = saved[key];
        }
    } catch (e) {
        // Unreadable or unavailable storage: fall back to showing everything.
    }
    return layers;
}

function saveLayers(layers) {
    try {
        localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(layers));
    } catch (e) {
        // Preference just won't persist this session.
    }
}

const mapPanelMethods = {
    toggleMapPanel() {
        const opening = !this.mapPanelVisible;
        this._closeAllPanels();
        this.mapPanelVisible = opening;
        if (!opening) this._hideMapTooltip?.();
        this._panelPause(opening);
        this.elements.mapPanel.style.display = opening ? 'block' : 'none';
        if (opening) this._openMapPanel();
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    },

    // Builds the panel the first time it opens; later opens reuse the DOM and canvas.
    _openMapPanel() {
        if (!this._mapLayers) this._mapLayers = loadLayers();
        const panel = this.elements.mapPanel;
        if (!this.fullMap) {
            panel.innerHTML = this._mapPanelHtml();
            const canvas = panel.querySelector('#fullmap-canvas');
            this.fullMap = new Minimap(canvas, this.game, {
                scale: this._fullMapScale(),
                layers: this._mapLayers,
                detailed: true,
                onNavigate: () => this.toggleMapPanel(),
            });
            // The Minimap constructor fits the canvas to its container; the panel sizes it by height instead.
            canvas.style.maxHeight = '';
            canvas.style.maxWidth = '';
            canvas.style.width = '';
            canvas.style.height = '';
            this._wireMapTooltip(canvas);
            panel.addEventListener('change', (e) => {
                const box = e.target.closest('[data-map-layer]');
                if (!box) return;
                this._mapLayers[box.dataset.mapLayer] = box.checked;
                saveLayers(this._mapLayers);
                // Terrain colours depend on the tree/ore/building/farm/fire layers.
                this.fullMap.markTerrainDirty();
                this.updateMapPanel();
            });
            panel.addEventListener('click', (e) => {
                const action = e.target.closest('[data-map-action]')?.dataset.mapAction;
                if (!action) return;
                for (const l of MAP_LAYERS) this._mapLayers[l.key] = action === 'all';
                saveLayers(this._mapLayers);
                for (const box of panel.querySelectorAll('[data-map-layer]')) box.checked = this._mapLayers[box.dataset.mapLayer];
                this.fullMap.markTerrainDirty();
                this.updateMapPanel();
            });
        }
        this.fullMap.setScale(this._fullMapScale());
        this.fullMap.markTerrainDirty();
        this.updateMapPanel();
    },

    // Hover tooltip naming the unit, crypt, anchor or landmark under the cursor.
    _wireMapTooltip(canvas) {
        const tip = document.createElement('div');
        tip.id = 'fullmap-tooltip';
        document.body.appendChild(tip);
        const hide = () => { tip.style.display = 'none'; };
        canvas.addEventListener('mousemove', (e) => {
            const label = this.fullMap.describeAt(e.clientX, e.clientY);
            if (!label) { hide(); return; }
            tip.textContent = label;
            tip.style.display = 'block';
            const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 4);
            const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 4);
            tip.style.left = `${x}px`;
            tip.style.top = `${y}px`;
        });
        canvas.addEventListener('mouseleave', hide);
        // The panel closing (Esc, backdrop) leaves no mouseleave behind.
        this._hideMapTooltip = hide;
    },

    _fullMapScale() {
        return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(TARGET_CANVAS_WIDTH / CONFIG.MAP_WIDTH)));
    },

    _mapPanelHtml() {
        const layerRows = MAP_LAYERS.map(l =>
            `<label class="map-layer-row" title="${l.desc}">` +
            `<input type="checkbox" data-map-layer="${l.key}"${this._mapLayers[l.key] ? ' checked' : ''}>` +
            `${swatch(l.color)}<span class="map-layer-text"><b>${l.label}</b><small>${l.desc}</small></span></label>`
        ).join('');
        const terrainRows = MAP_TERRAIN_KEY.map(t => `<span class="map-key-item">${swatch(t.color)}${t.label}</span>`).join('');
        const cryptRows = CRYPT_STATE_KEY.map(t => `<span class="map-key-item">${swatch(t.color)}${t.label}</span>`).join('');
        const doneRow = '<span class="map-key-item" title="All chests opened and, if it has one, its rift anchor attuned"><span class="map-check">&#10003;</span>Complete</span>';
        return '<div class="panel-close" data-panel-close="map">&times;</div>' +
            '<h3>World Map</h3>' +
            '<div class="map-body">' +
            '<div class="map-canvas-wrap"><canvas id="fullmap-canvas"></canvas>' +
            '<div class="map-hint">Click anywhere on the map to jump the camera there.</div></div>' +
            '<div class="map-side">' +
            '<div class="map-side-head">Show on map' +
            '<span><button data-map-action="all">All</button><button data-map-action="none">None</button></span></div>' +
            layerRows +
            '<div class="map-side-head">Terrain</div><div class="map-key-grid">' + terrainRows + '</div>' +
            '<div class="map-side-head">Crypt states</div><div class="map-key-grid">' + cryptRows + doneRow + '</div>' +
            '</div></div>';
    },

    updateMapPanel() {
        this.fullMap?.render();
    },
};

export function installMapPanel(UI) {
    Object.assign(UI.prototype, mapPanelMethods);
}

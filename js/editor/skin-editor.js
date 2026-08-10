import { BUILDINGS, TERRAIN, RESOURCES, ANIMALS, GOLEM_TYPES, CROPS, COMBAT_VISUALS, WEAPONS, ARMORS, HELMETS, TOOLS, ARTIFACTS, POTIONS, CONSUMABLES, SPELL_TOMES, ITEM_CHARS, WEATHER_TYPES, EQUIPMENT_OVERLAY_OFFSETS } from '../core/config.js';

const MATERIAL_ITEMS = [
    { key: 'wood', char: '≡', color: '#8b6b3a', desc: 'Wood resource' },
    { key: 'stone', char: '○', color: '#999999', desc: 'Stone resource' },
    { key: 'planks', char: '=', color: '#cc9944', desc: 'Planks (crafted from wood)' },
    { key: 'bricks', char: '#', color: '#b2463c', desc: 'Bricks (crafted from stone)' },
    { key: 'iron_ore', char: '●', color: '#887766', desc: 'Raw iron ore' },
    { key: 'iron', char: '■', color: '#aaaaaa', desc: 'Smelted iron' },
    { key: 'runite', char: '◆', color: '#44ccff', desc: 'Runite (magical metal)' },
    { key: 'leather', char: '~', color: '#8b5e3c', desc: 'Leather (tanned from hides)' },
    { key: 'hides', char: '~', color: '#6b4e2c', desc: 'Raw animal hides' },
    { key: 'wool', char: '○', color: '#eeeecc', desc: 'Wool (from sheep)' },
    { key: 'void_essence', char: '✦', color: '#9933ff', desc: 'Void essence (from nexus waves)' },
    { key: 'food', char: '♦', color: '#88cc44', desc: 'Cooked food' },
    { key: 'meat', char: '♦', color: '#cc5544', desc: 'Raw meat' },
    { key: 'wheat', char: '|', color: '#ddaa33', desc: 'Wheat (farm crop)' },
    { key: 'berries', char: '●', color: '#cc3366', desc: 'Berries (farm crop)' },
    { key: 'corn', char: '|', color: '#eebb33', desc: 'Corn (farm crop)' },
    { key: 'potatoes', char: '●', color: '#bb8844', desc: 'Potatoes (farm crop)' },
    { key: 'moonbloom', char: '❀', color: '#aaccff', desc: 'Moonbloom (rare crop)' },
    { key: 'eggs', char: '○', color: '#ffffcc', desc: 'Eggs (from chickens)' },
    { key: 'milk', char: '○', color: '#ffffff', desc: 'Milk (from cows)' },
];

const CANVAS_SIZES = [8, 16, 32, 64, 128];
const STORAGE_PREFIX = 'convocation_skin_editor_';
const CHECKERBOARD_LIGHT = '#3a3a3a';
const CHECKERBOARD_DARK = '#2a2a2a';
const MIN_ZOOM = 2;
const MAX_ZOOM = 64;

const ENTITY_SPECIALS = [
    { key: 'colonist_drafted', char: '@', color: '#ff4444', desc: 'Colonist in combat mode' },
    { key: 'colonist_sleeping', char: '@', color: '#6688cc', desc: 'Colonist sleeping in bed' },
    { key: 'colonist_sleeping_ground', char: '@', color: '#445588', desc: 'Colonist sleeping on ground (no bed)' },
    { key: 'golem', char: 'G', color: '#cc8833', desc: 'Default golem sprite' },
    { key: 'farmer_golem', char: 'G', color: '#55aa33', desc: 'Farmer Golem' },
    { key: 'builder_golem', char: 'G', color: '#888888', desc: 'Builder Golem' },
    { key: 'crafter_golem', char: 'G', color: '#aa6633', desc: 'Crafter Golem' },
    { key: 'cook_golem', char: 'G', color: '#cc7722', desc: 'Cook Golem' },
    { key: 'herder_golem', char: 'G', color: '#88aa33', desc: 'Herder Golem' },
    { key: 'scholar_golem', char: 'G', color: '#4488ff', desc: 'Scholar Golem' },
    { key: 'combat_golem', char: 'G', color: '#cc4444', desc: 'Combat Golem' },
    { key: 'familiar', char: 'f', color: '#9966ff', desc: 'Summoned familiar' },
    { key: 'ghost', char: 'g', color: '#88ccff', desc: 'Summoned ghost' },
    { key: 'raider', char: 'R', color: '#ff3333', desc: 'Enemy raider (fallback)' },
    { key: 'raider_brute', char: 'R', color: '#ff3333', desc: 'Raider Brute' },
    { key: 'raider_archer', char: 'R', color: '#ff6633', desc: 'Raider Archer' },
    { key: 'wave_enemy', char: 'V', color: '#aa33ff', desc: 'Wave enemy (fallback)' },
    { key: 'void_walker', char: 'V', color: '#aa33ff', desc: 'Void Walker' },
    { key: 'void_brute', char: 'V', color: '#7722cc', desc: 'Void Brute' },
];

const VARIANT_COLORS = ['#ffff00', '#00ffff', '#00ff00', '#ff88ff', '#ffaa00', '#88ffaa', '#ff8888', '#aaaaff'];

const ICON_ITEMS = [
    { key: 'clear', char: '☀', color: '#ffdd44', desc: 'Clear weather icon' },
    { key: 'rain', char: '🌧', color: '#6699cc', desc: 'Rain weather icon' },
    { key: 'thunderstorm', char: '⛈', color: '#9966cc', desc: 'Thunderstorm weather icon' },
    { key: 'snow', char: '❄', color: '#aaddff', desc: 'Snow weather icon' },
    { key: 'blizzard', char: '❆', color: '#ffffff', desc: 'Blizzard weather icon' },
    { key: 'heatwave', char: '♨', color: '#ff6633', desc: 'Heat wave weather icon' },
];

const OVERLAY_ITEMS = [
    { key: 'progress_bar', char: '▬', color: '#00ff00', desc: 'Progress bar overlay (crafting, building)' },
    { key: 'health_bar', char: '▬', color: '#ff4444', desc: 'Health bar overlay' },
    { key: 'beam', char: '/', color: '#ff4444', desc: 'Beam effect (spell link between tiles)' },
    { key: 'glow', char: '○', color: '#ffffff', desc: 'Glow effect (aura around tiles)' },
    { key: 'screen_flash', char: '█', color: '#ff0000', desc: 'Screen flash effect (damage, alerts)' },
];

const EFFECT_ITEMS = [
    { key: 'fire', char: '^', color: '#ff4400', desc: 'Tile on fire' },
    { key: 'portal', char: 'Ø', color: '#ff55ff', desc: 'Void nexus portal' },
    { key: 'snow', char: '*', color: '#ffffff', desc: 'Snow overlay (winter grass)' },
    { key: 'rally', char: '⚑', color: '#ff4444', desc: 'Draft rally point' },
    { key: 'hit', char: '!', color: '#ffff00', desc: 'Melee hit / combat strike' },
    { key: 'damage_taken', char: '!', color: '#ff3333', desc: 'Colonist takes damage' },
    { key: 'structure_damage', char: '!', color: '#ff8800', desc: 'Structure being attacked' },
    { key: 'turret_shot', char: '*', color: '#ff4444', desc: 'Turret/sentinel shot projectile' },
    { key: 'spell_heal', char: '+', color: '#44ff44', desc: 'Healing spell effect' },
    { key: 'spell_buff', char: '>', color: '#88ffff', desc: 'Buff spell effect' },
    { key: 'spell_shield', char: 'O', color: '#4488ff', desc: 'Shield spell effect' },
    { key: 'spell_teleport', char: '@', color: '#33ccff', desc: 'Teleport spell effect' },
    { key: 'spell_growth', char: '%', color: '#44ff44', desc: 'Growth spell effect' },
    { key: 'spell_terraform', char: '.', color: '#88ff88', desc: 'Terraform spell effect' },
    { key: 'spell_divination', char: '?', color: '#ccaaff', desc: 'Divination spell effect' },
    { key: 'summon_sparkle', char: '✦', color: '#9966ff', desc: 'Summon appear/disappear sparkle' },
    { key: 'magic_levelup', char: '★', color: '#ffdd44', desc: 'Magic skill level-up icon' },
    { key: 'spell_cast', char: '◇', color: '#cc88ff', desc: 'Spell casting visual at caster' },
    { key: 'damage_flash', char: '█', color: '#ff2222', desc: 'Damage taken overlay (tints entity red)' },
    { key: 'attack_swing', char: '/', color: '#ffffff', desc: 'Melee attack swing overlay' },
    { key: 'projectile_arcane', char: '•', color: '#ff4444', desc: 'Arcane sentinel projectile' },
    { key: 'projectile_void', char: '•', color: '#cc00ff', desc: 'Void turret projectile' },
    { key: 'projectile_arrow', char: '-', color: '#ffaa33', desc: 'Arrow/ranged attack projectile' },
    { key: 'projectile_spell', char: '*', color: '#ff44ff', desc: 'Spell projectile (evocation)' },
    { key: 'projectile_bolt', char: '→', color: '#aaddff', desc: 'Crossbow bolt projectile' },
    { key: 'smite', char: '✝', color: '#ffffaa', desc: 'Smite melee spell hit effect' },
    { key: 'craft_complete', char: '✧', color: '#ffcc44', desc: 'Crafting finished sparks' },
    { key: 'need_critical', char: '!', color: '#ff4444', desc: 'Critical need warning (hunger)' },
    { key: 'sleeping', char: 'z', color: '#6688cc', desc: 'Sleep Zzz bubble' },
    { key: 'heal_tick', char: '+', color: '#44ff44', desc: 'Healing tick (potion/regen)' },
    { key: 'research_complete', char: '!', color: '#44ffff', desc: 'Research eureka moment' },
    { key: 'build_complete', char: '✓', color: '#ffffff', desc: 'Structure built dust puff' },
    { key: 'harvest', char: '⌂', color: '#66cc44', desc: 'Crop harvest leaf scatter' },
    { key: 'mental_break', char: '☠', color: '#cc2222', desc: 'Mental break indicator' },
    { key: 'freezing', char: '~', color: '#88ddff', desc: 'Freezing frost particles' },
    { key: 'mine_dust', char: '·', color: '#999999', desc: 'Mining dust cloud' },
    { key: 'shield_block', char: '○', color: '#4488ff', desc: 'Shield spell absorb flash' },
    { key: 'mana_regen', char: '∴', color: '#aa66ff', desc: 'Mana regeneration wisps' },
    { key: 'death', char: '☠', color: '#ffffff', desc: 'Entity death skull' },
    { key: 'summon_arrive', char: '◊', color: '#cc44ff', desc: 'Summon arrival swirl' },
    { key: 'loot_drop', char: '$', color: '#ffdd44', desc: 'Loot drop sparkle' },
    { key: 'speed_trail', char: '·', color: '#88ffff', desc: 'Speed buff afterimage trail' },
    { key: 'fire_ignite', char: '^', color: '#ff6600', desc: 'Fire spread ignition' },
    { key: 'wave_alert', char: '!', color: '#ff2222', desc: 'Wave incoming screen flash' },
    { key: 'golem_activate', char: '⚡', color: '#44ffff', desc: 'Golem activation burst' },
    { key: 'xp_gain', char: '·', color: '#88ff88', desc: 'XP gain particle' },
    { key: 'health_regen', char: '♥', color: '#66ff66', desc: 'Natural health regeneration' },
];

let editorInstance = null;

export function launchSkinEditor() {
    document.getElementById('start-screen').style.display = 'none';
    if (!editorInstance) {
        editorInstance = new SkinEditor();
    }
    editorInstance.show();
}

class SkinEditor {
    constructor() {
        this.canvasSize = 16;
        this.pixels = new Uint8ClampedArray(16 * 16 * 4);
        this.activeObject = null;
        this.skinName = 'my_skin';
        this.tool = 'draw';
        this.color = { r: 255, g: 255, b: 255, a: 255 };
        this.recentColors = [];
        this.showGrid = true;
        this.hoveredPixel = null;
        this.savedSprites = {};
        this.categoryFilter = 'Buildings';
        this.bodyVariants = 3;
        this.hairVariants = 3;
        this.shirtVariants = 3;
        this.clipboard = null;
        this._undoStack = [];
        this._redoStack = [];
        this._maxUndo = 50;
        this._strokeSnapshot = null;
        this.zoom = 16;
        this.panX = 0;
        this.panY = 0;

        this._mouseDown = false;
        this._middleDown = false;
        this._lastDragPos = null;
        this._animFrame = null;

        // Selection state
        this.selection = null; // { x, y, w, h }
        this._selStart = null;
        this._selPixels = null; // Uint8ClampedArray of selected region
        this._selMoving = false;
        this._selMoveStart = null;
        this._selOrigPos = null;

        // Shape tool preview state
        this._shapeStart = null;
        this._shapePreview = null; // array of {x, y} pixels to draw on release

        // Region clipboard (for Ctrl+C/V on selections)
        this._regionClipboard = null;

        // Brush size
        this.brushSize = 1;

        // Mirror mode: null, 'h', 'v', 'both'
        this.mirrorMode = null;

        // Transparency lock
        this.transparencyLock = false;

        // Custom palette (6 saveable color slots)
        this.customPalette = JSON.parse(localStorage.getItem('convocation_skin_custom_palette') || 'null') || [
            { r: 0, g: 0, b: 0, a: 255 },
            { r: 255, g: 255, b: 255, a: 255 },
            { r: 200, g: 50, b: 50, a: 255 },
            { r: 50, g: 200, b: 50, a: 255 },
            { r: 50, g: 100, b: 200, a: 255 },
            { r: 200, g: 180, b: 50, a: 255 },
        ];

        // Onion skin overlay
        this._onionSkinKey = null; // spriteKey of overlay sprite
        this._onionSkinData = null; // ImageData or pixel array
        this._onionSkinOpacity = 0.3;
        this._onionSkinOffsetX = 0;
        this._onionSkinOffsetY = 0;

        // Tile preview
        this._showTilePreview = false;

        // Reference image
        this._refImage = null; // HTMLImageElement
        this._showRefImage = false;

        // Spritesheet picker state
        this._sheetImage = null;
        this._sheetPickerOpen = false;
        this._sheetPanX = 0;
        this._sheetPanY = 0;
        this._sheetZoom = 1;
        this._sheetDragging = false;
        this._sheetDragStart = null;
        this._sheetPanStart = null;
        this._sheetAnimFrame = null;
        this._sheetSnapToGrid = false;

        // Secondary color (used by gradient + dither tools)
        this._secondaryColor = { r: 0, g: 0, b: 0, a: 255 };

        this._buildDOM();
        this._bindEvents();
        this._loadSkinData();
    }

    show() {
        this.container.style.display = 'flex';
        requestAnimationFrame(() => {
            this._recalcZoom();
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
        this.container = document.getElementById('skin-editor');
        this.container.innerHTML = '';

        const toolbar = document.createElement('div');
        toolbar.id = 'se-toolbar';
        toolbar.innerHTML = `
            <button id="se-back" title="Return to start screen (Esc)">← Back</button>
            <span class="bp-sep"></span>
            <label title="Name of the skin pack">Skin: <input type="text" id="se-skin-name" value="${this.skinName}" placeholder="my_skin" maxlength="30"></label>
            <span class="bp-sep"></span>
            <label title="Canvas resolution for each sprite">Size:
                <select id="se-canvas-size">
                    ${CANVAS_SIZES.map(s => `<option value="${s}" ${s === this.canvasSize ? 'selected' : ''}>${s}x${s}</option>`).join('')}
                    <option value="custom">Custom...</option>
                </select>
            </label>
            <input type="number" id="se-custom-size" min="4" max="256" style="display:none;width:44px;background:#1a1a2e;color:#ccc;border:1px solid #444;border-radius:3px;text-align:center;font-size:11px;padding:2px;" title="Enter custom canvas size (4-256)" placeholder="px">
            <span class="bp-sep"></span>
            <button id="se-tool-draw" class="se-tool active" data-tool="draw" title="Draw — paint pixels with current color&#10;Shortcut: 1">Draw</button>
            <button id="se-tool-erase" class="se-tool" data-tool="erase" title="Erase — remove pixels (set transparent)&#10;Shortcut: 2">Erase</button>
            <button id="se-tool-fill" class="se-tool" data-tool="fill" title="Fill — flood-fill contiguous area with current color&#10;Shortcut: 3">Fill</button>
            <button id="se-tool-pick" class="se-tool" data-tool="pick" title="Pick Color — sample a pixel's color from the canvas&#10;Shortcut: 4">Pick</button>
            <button id="se-tool-select" class="se-tool" data-tool="select" title="Select — drag to select a region, then move/copy/delete/fill it&#10;Shortcut: 5 | Del=delete | F=fill | Ctrl+C=copy | Ctrl+V=paste">Select</button>
            <button id="se-tool-line" class="se-tool" data-tool="line" title="Line — click and drag to draw a straight line&#10;Shortcut: 6">Line</button>
            <button id="se-tool-circle" class="se-tool" data-tool="circle" title="Circle — click center, drag to set radius&#10;Shortcut: 7">Circle</button>
            <button id="se-tool-lighten" class="se-tool" data-tool="lighten" title="Lighten — brighten pixels without changing hue&#10;Shortcut: 8">Light</button>
            <button id="se-tool-darken" class="se-tool" data-tool="darken" title="Darken — darken pixels without changing hue&#10;Shortcut: 9">Dark</button>
            <span class="bp-sep"></span>
            <label title="Brush size for draw/erase/lighten/darken tools&#10;Shortcut: [ smaller, ] larger" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#aaa;">
                Size: <input type="number" id="se-brush-size" min="1" max="16" value="1" style="width:36px;background:#1a1a2e;color:#ccc;border:1px solid #444;border-radius:3px;text-align:center;font-size:11px;padding:2px;">
            </label>
            <button id="se-brush-down" title="Decrease brush size&#10;Shortcut: [">-</button>
            <button id="se-brush-up" title="Increase brush size&#10;Shortcut: ]">+</button>
            <span class="bp-sep"></span>
            <button id="se-toggle-mirror" title="Mirror mode — auto-mirror strokes horizontally, vertically, or both&#10;Click to cycle: Off → H → V → Both&#10;Shortcut: M">Mirror</button>
            <button id="se-toggle-tlock" title="Transparency Lock — only paint on non-transparent pixels (protects silhouette)&#10;Shortcut: T">T-Lock</button>
            <button id="se-toggle-grid" class="se-tool active" title="Toggle pixel grid overlay&#10;Shortcut: G">Grid</button>
            <span class="bp-sep"></span>
            <button id="se-flip-h" title="Flip Horizontal — mirror the entire sprite left-to-right">FlipH</button>
            <button id="se-flip-v" title="Flip Vertical — mirror the entire sprite top-to-bottom">FlipV</button>
            <button id="se-rotate-cw" title="Rotate 90° Clockwise — rotate the entire sprite">Rot</button>
            <button id="se-replace-color" title="Replace Color — swap all pixels matching last-picked color with current color&#10;Workflow: Pick target color (4), set new color, click Replace">Replace</button>
            <button id="se-outline" title="Outline — add a 1px outline around all non-transparent pixels using current color">Outline</button>
            <button id="se-extract-palette" title="Extract Palette — pull all unique colors from sprite into the custom palette slots">Extract</button>
            <span class="bp-sep"></span>
            <button id="se-tool-dither" class="se-tool" data-tool="dither" title="Dither Fill — fill area with checkerboard pattern using current color + secondary color&#10;Right-click the custom palette to set secondary">Dither</button>
            <button id="se-tool-gradient" class="se-tool" data-tool="gradient" title="Gradient — drag to draw a linear gradient between current color and secondary color&#10;Uses last-picked color as secondary">Gradient</button>
            <span class="bp-sep"></span>
            <button id="se-toggle-onion" title="Onion Skin — show a ghost overlay of another sprite for reference&#10;Select an object from the palette while this is on">Onion</button>
            <button id="se-toggle-tile" title="Tile Preview — show sprite repeated in a 3x3 grid to check seamless tiling">Tile</button>
            <button id="se-toggle-ref" title="Reference Image — load a PNG to overlay as a tracing guide&#10;Click to toggle on/off, loads file on first click">Ref</button>
            <input type="file" id="se-ref-file" accept="image/*" style="display:none">
            <button id="se-sheet-pick" title="Spritesheet Picker — upload a spritesheet and pick a sprite to import">Sheet</button>
            <input type="file" id="se-sheet-file" accept="image/*" style="display:none">
            <span class="bp-sep"></span>
            <button id="se-sel-delete" title="Delete Selection — erase all pixels in selection&#10;Shortcut: Delete/Backspace">SelDel</button>
            <button id="se-sel-fill" title="Fill Selection — fill selection with current color&#10;Shortcut: F (while selection active)">SelFill</button>
            <button id="se-sel-copy" title="Copy Selection — copy selected region to clipboard&#10;Shortcut: Ctrl+C">SelCopy</button>
            <button id="se-sel-paste" title="Paste Selection — paste clipboard as floating selection&#10;Shortcut: Ctrl+V">SelPaste</button>
            <span class="bp-sep"></span>
            <button id="se-zoom-in" title="Zoom In&#10;Shortcut: + or =">+</button>
            <button id="se-zoom-out" title="Zoom Out&#10;Shortcut: -">-</button>
            <button id="se-zoom-reset" title="Reset Zoom to fit canvas&#10;Shortcut: 0">Fit</button>
            <span class="bp-sep"></span>
            <button id="se-undo" title="Undo last action&#10;Shortcut: Ctrl+Z">Undo</button>
            <button id="se-redo" title="Redo last undone action&#10;Shortcut: Ctrl+Y">Redo</button>
            <button id="se-copy" title="Copy entire sprite to clipboard (for pasting into another object)&#10;Shortcut: C">Copy</button>
            <button id="se-paste" title="Paste entire sprite from clipboard&#10;Shortcut: V">Paste</button>
            <span class="bp-sep"></span>
            <button id="se-clear" title="Clear the entire canvas (confirmation required)">Clear</button>
            <button id="se-save" title="Save sprite to skin data and download as PNG file">Save PNG</button>
            <button id="se-export-skin" title="Export all sprites as a .skin.zip file for sharing">Export .zip</button>
            <button id="se-import-zip" title="Import a .skin.zip file to load sprites">Import .zip</button>
            <span class="bp-sep"></span>
            <select id="se-load-skin" title="Load a previously saved skin by name"><option value="">Load Skin...</option></select>
            <input type="file" id="se-import-file" accept=".zip" style="display:none">
        `;
        this.container.appendChild(toolbar);

        const workspace = document.createElement('div');
        workspace.id = 'se-workspace';

        const canvasArea = document.createElement('div');
        canvasArea.id = 'se-canvas-area';

        const canvasWrap = document.createElement('div');
        canvasWrap.id = 'se-canvas-wrap';
        const canvas = document.createElement('canvas');
        canvas.id = 'se-canvas';
        canvasWrap.appendChild(canvas);
        canvasArea.appendChild(canvasWrap);

        const previewArea = document.createElement('div');
        previewArea.id = 'se-preview-area';
        previewArea.innerHTML = `
            <div class="se-preview-label">Preview</div>
            <canvas id="se-preview-canvas"></canvas>
            <div id="se-active-object">No object selected</div>
        `;
        canvasArea.appendChild(previewArea);

        const statusBar = document.createElement('div');
        statusBar.id = 'se-status';
        statusBar.textContent = 'x: 0, y: 0';
        canvasArea.appendChild(statusBar);

        const paletteBar = document.createElement('div');
        paletteBar.id = 'se-custom-palette';
        paletteBar.title = 'Custom palette — Left-click to pick, Right-click to set slot to current color';
        paletteBar.innerHTML = this._buildCustomPaletteHTML();
        canvasArea.appendChild(paletteBar);

        workspace.appendChild(canvasArea);

        const sidebar = document.createElement('div');
        sidebar.id = 'se-sidebar';
        sidebar.innerHTML = `
            <div class="bp-section">
                <div class="bp-section-title">Color</div>
                <div id="se-color-section">
                    <div class="se-color-row">
                        <input type="color" id="se-color-picker" value="#ffffff">
                        <input type="text" id="se-color-hex" value="#ffffff" maxlength="7" style="width:70px">
                    </div>
                    <div class="se-color-row">
                        <label>Opacity: <span id="se-alpha-val">255</span></label>
                        <input type="range" id="se-alpha-slider" min="0" max="255" value="255" style="width:100%">
                    </div>
                    <div class="se-color-row">
                        <label style="font-size:10px;color:#888;">H: <span id="se-hsl-h-val">0</span>°</label>
                        <input type="range" id="se-hsl-h" min="0" max="360" value="0" style="width:100%">
                    </div>
                    <div class="se-color-row">
                        <label style="font-size:10px;color:#888;">S: <span id="se-hsl-s-val">0</span>%</label>
                        <input type="range" id="se-hsl-s" min="0" max="100" value="0" style="width:100%">
                    </div>
                    <div class="se-color-row">
                        <label style="font-size:10px;color:#888;">L: <span id="se-hsl-l-val">100</span>%</label>
                        <input type="range" id="se-hsl-l" min="0" max="100" value="100" style="width:100%">
                    </div>
                    <div class="se-color-row" style="gap:3px;">
                        <button id="se-color-darker" style="flex:1;font-size:10px;padding:2px 4px;" title="Darken current color 10%">Darker</button>
                        <button id="se-color-lighter" style="flex:1;font-size:10px;padding:2px 4px;" title="Lighten current color 10%">Lighter</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;margin:4px 0;">
                        <div id="se-current-color" title="Primary color (left-click to pick)" style="flex:1;height:24px;border:2px solid #888;border-radius:3px;cursor:pointer;"></div>
                        <button id="se-swap-colors" title="Swap primary/secondary" style="font-size:11px;padding:2px 5px;line-height:1;">&#8644;</button>
                        <div id="se-secondary-color" title="Secondary color (for gradient/dither)" style="flex:1;height:24px;border:2px solid #555;border-radius:3px;cursor:pointer;background:#000;"></div>
                    </div>
                    <div class="se-color-row" style="margin-top:2px;">
                        <label style="font-size:10px;color:#888;">Secondary:</label>
                        <input type="color" id="se-secondary-picker" value="#000000" style="width:32px;height:20px;border:1px solid #444;padding:0;cursor:pointer;">
                        <button id="se-set-secondary" style="font-size:10px;padding:2px 6px;" title="Set current color as secondary">Use Current</button>
                    </div>
                    <div id="se-recent-colors"></div>
                </div>
            </div>
            <div class="bp-section">
                <div class="bp-section-title">Objects</div>
                <div id="se-category-filter"></div>
                <div id="se-palette"></div>
            </div>
            <div class="bp-section">
                <div class="bp-section-title">Saved Sprites</div>
                <div id="se-saved-list"></div>
            </div>
        `;
        workspace.appendChild(sidebar);
        this.container.appendChild(workspace);

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.previewCanvas = document.getElementById('se-preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        this._buildCategoryFilter();
        this._buildPalette();
        this._refreshSavedList();
        this._refreshLoadDropdown();
        this._updateCurrentColor();
        this._updateSecondaryColorSwatch();
    }

    _buildCategoryFilter() {
        const categories = ['Buildings', 'Terrain', 'Resources', 'Entities', 'Items', 'Materials', 'Floors', 'Farms', 'Effects', 'Icons', 'Overlays', 'Equipment Worn'];
        const container = document.getElementById('se-category-filter');
        container.innerHTML = categories.map(c =>
            `<button class="bp-cat${c === this.categoryFilter ? ' active' : ''}" data-cat="${c}">${c}</button>`
        ).join('');
    }

    _buildPalette() {
        const palette = document.getElementById('se-palette');
        let items = [];

        switch (this.categoryFilter) {
            case 'Buildings':
                for (const [key, def] of Object.entries(BUILDINGS)) {
                    if (def.structureType === 'floor') continue;
                    items.push({ key, char: def.char, color: def.color, desc: def.description || key, category: 'buildings' });
                }
                break;
            case 'Terrain':
                for (const [key, def] of Object.entries(TERRAIN)) {
                    items.push({ key, char: def.char, color: def.color, desc: key, category: 'terrain' });
                }
                break;
            case 'Resources':
                for (const [key, def] of Object.entries(RESOURCES)) {
                    items.push({ key, char: def.char, color: def.color, desc: key, category: 'resources' });
                    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
                        if (def[season + 'Color']) {
                            items.push({ key: key + '_' + season, char: def.char, color: def[season + 'Color'], desc: `${key} (${season})`, category: 'resources' });
                        }
                    }
                }
                break;
            case 'Entities':
                for (let i = 1; i <= this.bodyVariants; i++) {
                    const color = VARIANT_COLORS[(i - 1) % VARIANT_COLORS.length];
                    items.push({ key: `colonist_body_${i}`, char: '@', color, desc: `Colonist body (skin tone) ${i}`, category: 'entities', isVariant: i > 1, variantGroup: 'body' });
                }
                items.push({ key: '__add_body__', char: '+', color: '#888888', desc: 'Add another body variant', category: 'entities', isAction: true, variantGroup: 'body' });
                for (let i = 1; i <= this.hairVariants; i++) {
                    const color = VARIANT_COLORS[(i - 1) % VARIANT_COLORS.length];
                    items.push({ key: `colonist_hair_${i}`, char: '@', color, desc: `Colonist hair style ${i}`, category: 'entities', isVariant: i > 1, variantGroup: 'hair' });
                }
                items.push({ key: '__add_hair__', char: '+', color: '#888888', desc: 'Add another hair variant', category: 'entities', isAction: true, variantGroup: 'hair' });
                for (let i = 1; i <= this.shirtVariants; i++) {
                    const color = VARIANT_COLORS[(i - 1) % VARIANT_COLORS.length];
                    items.push({ key: `colonist_shirt_${i}`, char: '@', color, desc: `Colonist shirt ${i} (grayscale, tinted in-game)`, category: 'entities', isVariant: i > 1, variantGroup: 'shirt' });
                }
                items.push({ key: '__add_shirt__', char: '+', color: '#888888', desc: 'Add another shirt variant', category: 'entities', isAction: true, variantGroup: 'shirt' });
                for (const e of ENTITY_SPECIALS) {
                    items.push({ key: e.key, char: e.char, color: e.color, desc: e.desc, category: 'entities' });
                }
                for (const [key, def] of Object.entries(ANIMALS)) {
                    items.push({ key, char: def.char, color: def.color, desc: key, category: 'entities' });
                }
                break;
            case 'Items':
                for (const [key, def] of Object.entries(WEAPONS)) {
                    if (key === 'fists') continue;
                    items.push({ key, char: def.char || ITEM_CHARS.weapon.char, color: def.charColor || ITEM_CHARS.weapon.color, desc: `Weapon: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(ARMORS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.armor.char, color: def.charColor || ITEM_CHARS.armor.color, desc: `Armor: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(HELMETS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.helmet.char, color: def.charColor || ITEM_CHARS.helmet.color, desc: `Helmet: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(TOOLS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.tool.char, color: def.charColor || ITEM_CHARS.tool.color, desc: `Tool: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(ARTIFACTS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.artifact.char, color: def.charColor || ITEM_CHARS.artifact.color, desc: `Artifact: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(POTIONS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.potion.char, color: def.charColor || ITEM_CHARS.potion.color, desc: `Potion: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(SPELL_TOMES)) {
                    items.push({ key, char: def.char || ITEM_CHARS.tome.char, color: def.charColor || ITEM_CHARS.tome.color, desc: `Tome: ${def.name}`, category: 'items' });
                }
                for (const [key, def] of Object.entries(CONSUMABLES)) {
                    items.push({ key, char: def.char || ITEM_CHARS.consumable.char, color: def.charColor || ITEM_CHARS.consumable.color, desc: `Consumable: ${def.name}`, category: 'items' });
                }
                break;
            case 'Materials':
                for (const item of MATERIAL_ITEMS) {
                    items.push({ key: item.key, char: item.char, color: item.color, desc: item.desc, category: 'materials' });
                }
                break;
            case 'Floors':
                for (const [key, def] of Object.entries(BUILDINGS)) {
                    if (def.structureType !== 'floor') continue;
                    items.push({ key, char: def.char, color: def.color, desc: def.description || key, category: 'floors' });
                }
                break;
            case 'Farms':
                items.push({ key: 'farm_empty', char: '=', color: '#8b6b3a', desc: 'Empty farm plot (generic)', category: 'farms' });
                items.push({ key: 'farm_growing', char: '%', color: '#55aa33', desc: 'Growing crop (generic)', category: 'farms' });
                items.push({ key: 'farm_ready', char: '*', color: '#ffdd00', desc: 'Ready to harvest (generic)', category: 'farms' });
                for (const [key, def] of Object.entries(CROPS)) {
                    items.push({ key: key + '_growing', char: def.char, color: def.color, desc: key + ' (growing)', category: 'farms' });
                    items.push({ key: key + '_ready', char: def.readyChar, color: def.color, desc: key + ' (ready)', category: 'farms' });
                }
                break;
            case 'Effects':
                for (const e of EFFECT_ITEMS) {
                    items.push({ key: e.key, char: e.char, color: e.color, desc: e.desc, category: 'effects' });
                }
                break;
            case 'Icons':
                for (const e of ICON_ITEMS) {
                    items.push({ key: e.key, char: e.char, color: e.color, desc: e.desc, category: 'icons' });
                }
                break;
            case 'Overlays':
                for (const e of OVERLAY_ITEMS) {
                    items.push({ key: e.key, char: e.char, color: e.color, desc: e.desc, category: 'overlays' });
                }
                break;
            case 'Equipment Worn':
                for (const [key, def] of Object.entries(ARMORS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.armor.char, color: def.charColor || ITEM_CHARS.armor.color, desc: `Worn: ${def.name}`, category: 'equipment_worn' });
                }
                for (const [key, def] of Object.entries(HELMETS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.helmet.char, color: def.charColor || ITEM_CHARS.helmet.color, desc: `Worn: ${def.name}`, category: 'equipment_worn' });
                }
                for (const [key, def] of Object.entries(WEAPONS)) {
                    if (key === 'fists') continue;
                    items.push({ key, char: def.char || ITEM_CHARS.weapon.char, color: def.charColor || ITEM_CHARS.weapon.color, desc: `Worn: ${def.name}`, category: 'equipment_worn' });
                }
                for (const [key, def] of Object.entries(TOOLS)) {
                    items.push({ key, char: def.char || ITEM_CHARS.tool.char, color: def.charColor || ITEM_CHARS.tool.color, desc: `Worn: ${def.name}`, category: 'equipment_worn' });
                }
                break;
        }

        let html = '';
        for (const item of items) {
            if (item.isAction) {
                html += `<div class="bp-palette-item se-add-variant" data-action="add-variant" data-variant-group="${item.variantGroup || ''}" title="${item.desc}">
                    <span style="color:${item.color}">${item.char}</span> ${item.desc}
                </div>`;
                continue;
            }
            const active = this.activeObject && this.activeObject.key === item.key && this.activeObject.category === item.category ? ' active' : '';
            const spriteKey = `${item.category}:${item.key}`;
            const saved = this.savedSprites[spriteKey];
            const removeBtn = item.isVariant ? ` <span class="se-remove-variant" data-variant-key="${item.key}" title="Remove variant">✕</span>` : '';
            const icon = saved
                ? `<img src="${saved.data}" style="width:16px;height:16px;image-rendering:pixelated;vertical-align:middle;">`
                : `<span style="color:${item.color}">${item.char}</span>`;
            html += `<div class="bp-palette-item${active}" data-key="${item.key}" data-category="${item.category}" title="${item.desc}">
                ${icon} ${item.key.replace(/_/g, ' ')}${removeBtn}
            </div>`;
        }
        palette.innerHTML = html;
    }

    _bindEvents() {
        document.getElementById('se-back').addEventListener('click', () => this._goBack());
        document.getElementById('se-clear').addEventListener('click', () => this._clearCanvas());
        document.getElementById('se-save').addEventListener('click', () => this._savePNG());
        document.getElementById('se-export-skin').addEventListener('click', () => this._exportToSkinsFolder());
        document.getElementById('se-import-zip').addEventListener('click', () => document.getElementById('se-import-file').click());
        document.getElementById('se-import-file').addEventListener('change', (e) => this._importZip(e));
        document.getElementById('se-toggle-grid').addEventListener('click', () => this._toggleGrid());
        document.getElementById('se-undo').addEventListener('click', () => this._undo());
        document.getElementById('se-redo').addEventListener('click', () => this._redo());
        document.getElementById('se-copy').addEventListener('click', () => this._copySprite());
        document.getElementById('se-paste').addEventListener('click', () => this._pasteSprite());
        document.getElementById('se-zoom-in').addEventListener('click', () => this._zoomIn());
        document.getElementById('se-zoom-out').addEventListener('click', () => this._zoomOut());
        document.getElementById('se-zoom-reset').addEventListener('click', () => this._resetZoom());

        document.getElementById('se-skin-name').addEventListener('change', (e) => {
            this.skinName = e.target.value.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
            e.target.value = this.skinName;
            this.savedSprites = {};
            this._loadSkinData();
            this._refreshSavedList();
            this._buildPalette();
        });

        document.getElementById('se-canvas-size').addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                const input = document.getElementById('se-custom-size');
                input.style.display = 'inline-block';
                input.value = this.canvasSize;
                input.focus();
                input.select();
            } else {
                document.getElementById('se-custom-size').style.display = 'none';
                this._setCanvasSize(parseInt(e.target.value));
            }
        });
        document.getElementById('se-custom-size').addEventListener('change', (e) => {
            const val = Math.max(4, Math.min(256, parseInt(e.target.value) || 16));
            e.target.value = val;
            this._setCanvasSize(val);
        });

        document.getElementById('se-load-skin').addEventListener('change', (e) => {
            if (e.target.value) this._loadSkinByName(e.target.value);
            e.target.value = '';
        });

        // Tools
        this.container.querySelectorAll('.se-tool[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
        });

        // Brush size
        document.getElementById('se-brush-size').addEventListener('input', (e) => {
            this.brushSize = Math.max(1, Math.min(16, parseInt(e.target.value) || 1));
        });
        document.getElementById('se-brush-down').addEventListener('click', () => this._adjustBrushSize(-1));
        document.getElementById('se-brush-up').addEventListener('click', () => this._adjustBrushSize(1));

        // Selection action buttons
        document.getElementById('se-sel-delete').addEventListener('click', () => this._deleteSelection());
        document.getElementById('se-sel-fill').addEventListener('click', () => this._fillSelection());
        document.getElementById('se-sel-copy').addEventListener('click', () => this._copySelection());
        document.getElementById('se-sel-paste').addEventListener('click', () => this._pasteSelection());

        // Mirror mode
        document.getElementById('se-toggle-mirror').addEventListener('click', () => this._cycleMirror());

        // Transparency lock
        document.getElementById('se-toggle-tlock').addEventListener('click', () => this._toggleTransparencyLock());

        // Flip & rotate
        document.getElementById('se-flip-h').addEventListener('click', () => this._flipHorizontal());
        document.getElementById('se-flip-v').addEventListener('click', () => this._flipVertical());
        document.getElementById('se-rotate-cw').addEventListener('click', () => this._rotateCW());

        // Replace color
        document.getElementById('se-replace-color').addEventListener('click', () => this._replaceColor());

        // Outline
        document.getElementById('se-outline').addEventListener('click', () => this._generateOutline());

        // Extract palette
        document.getElementById('se-extract-palette').addEventListener('click', () => this._extractPalette());

        // Onion skin
        document.getElementById('se-toggle-onion').addEventListener('click', () => this._toggleOnionSkin());

        // Tile preview
        document.getElementById('se-toggle-tile').addEventListener('click', () => this._toggleTilePreview());

        // Reference image
        document.getElementById('se-toggle-ref').addEventListener('click', () => this._toggleRefImage());
        document.getElementById('se-ref-file').addEventListener('change', (e) => this._loadRefImage(e));

        // Spritesheet picker
        document.getElementById('se-sheet-pick').addEventListener('click', () => this._openSheetPicker());
        document.getElementById('se-sheet-file').addEventListener('change', (e) => this._loadSheetImage(e));

        // Custom palette
        document.getElementById('se-custom-palette').addEventListener('mousedown', (e) => {
            const slot = e.target.closest('.se-palette-slot');
            if (!slot) return;
            e.preventDefault();
            const idx = parseInt(slot.dataset.idx);
            if (e.button === 2) {
                this.customPalette[idx] = { ...this.color };
                this._saveCustomPalette();
                this._refreshCustomPalette();
            } else {
                const c = this.customPalette[idx];
                this.color = { ...c };
                this._syncColorUI();
            }
        });
        document.getElementById('se-custom-palette').addEventListener('contextmenu', (e) => e.preventDefault());

        // Category filter
        document.getElementById('se-category-filter').addEventListener('click', (e) => {
            const btn = e.target.closest('.bp-cat');
            if (!btn) return;
            this.categoryFilter = btn.dataset.cat;
            document.querySelectorAll('#se-category-filter .bp-cat').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._buildPalette();
        });

        // Palette
        document.getElementById('se-palette').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.se-remove-variant');
            if (removeBtn) {
                e.stopPropagation();
                this._removeVariant(removeBtn.dataset.variantKey);
                return;
            }
            const item = e.target.closest('.bp-palette-item');
            if (!item) return;
            if (item.dataset.action === 'add-variant') {
                this._addVariant(item.dataset.variantGroup);
                return;
            }
            this._selectObject(item.dataset.key, item.dataset.category);
        });

        // Color picker
        document.getElementById('se-color-picker').addEventListener('input', (e) => {
            this._setColorFromHex(e.target.value);
        });
        document.getElementById('se-color-hex').addEventListener('change', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9a-f]{6}$/i.test(val)) {
                this._setColorFromHex(val);
            }
        });
        document.getElementById('se-alpha-slider').addEventListener('input', (e) => {
            this.color.a = parseInt(e.target.value);
            document.getElementById('se-alpha-val').textContent = this.color.a;
            this._updateCurrentColor();
        });

        // HSL sliders
        document.getElementById('se-hsl-h').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('se-hsl-h-val').textContent = val;
            const hsl = this._rgbToHsl(this.color.r, this.color.g, this.color.b);
            hsl.h = val;
            const rgb = this._hslToRgb(hsl.h, hsl.s, hsl.l);
            this.color.r = rgb.r; this.color.g = rgb.g; this.color.b = rgb.b;
            this._syncColorUI(true);
        });
        document.getElementById('se-hsl-s').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('se-hsl-s-val').textContent = val;
            const hsl = this._rgbToHsl(this.color.r, this.color.g, this.color.b);
            hsl.s = val;
            const rgb = this._hslToRgb(hsl.h, hsl.s, hsl.l);
            this.color.r = rgb.r; this.color.g = rgb.g; this.color.b = rgb.b;
            this._syncColorUI(true);
        });
        document.getElementById('se-hsl-l').addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('se-hsl-l-val').textContent = val;
            const hsl = this._rgbToHsl(this.color.r, this.color.g, this.color.b);
            hsl.l = val;
            const rgb = this._hslToRgb(hsl.h, hsl.s, hsl.l);
            this.color.r = rgb.r; this.color.g = rgb.g; this.color.b = rgb.b;
            this._syncColorUI(true);
        });

        // Darker/Lighter buttons
        document.getElementById('se-color-darker').addEventListener('click', () => this._shiftColorLightness(-10));
        document.getElementById('se-color-lighter').addEventListener('click', () => this._shiftColorLightness(10));

        // Secondary color controls
        document.getElementById('se-secondary-picker').addEventListener('input', (e) => {
            const hex = e.target.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            this._secondaryColor = { r, g, b, a: this._secondaryColor.a };
            this._updateSecondaryColorSwatch();
        });
        document.getElementById('se-set-secondary').addEventListener('click', () => {
            this._secondaryColor = { ...this.color };
            this._updateSecondaryColorSwatch();
        });
        document.getElementById('se-swap-colors').addEventListener('click', () => {
            const temp = { ...this.color };
            this.color = { ...this._secondaryColor };
            this._secondaryColor = temp;
            this._syncColorUI();
            this._updateSecondaryColorSwatch();
        });
        document.getElementById('se-secondary-color').addEventListener('click', () => {
            const temp = { ...this.color };
            this.color = { ...this._secondaryColor };
            this._secondaryColor = temp;
            this._syncColorUI();
            this._updateSecondaryColorSwatch();
        });

        // Recent colors
        document.getElementById('se-recent-colors').addEventListener('click', (e) => {
            const swatch = e.target.closest('.se-swatch');
            if (!swatch) return;
            const { r, g, b, a } = JSON.parse(swatch.dataset.color);
            this.color = { r, g, b, a };
            this._syncColorUI();
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => { this.hoveredPixel = null; this._mouseDown = false; this._middleDown = false; });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

        // Keyboard
        window.addEventListener('keydown', (e) => this._onKeyDown(e));

        // Resize
        window.addEventListener('resize', () => this._onResize());
    }

    _onMouseDown(e) {
        e.preventDefault();
        if (e.button === 1) {
            this._middleDown = true;
            this._lastDragPos = { x: e.clientX, y: e.clientY };
            return;
        }
        this._mouseDown = true;
        const pos = this._eventToPixel(e);
        if (!pos) return;

        if (this.tool === 'select') {
            if (this.selection && this._posInSelection(pos) && e.button === 0) {
                this._selMoving = true;
                this._selMoveStart = { x: pos.x, y: pos.y };
                this._selOrigPos = { x: this.selection.x, y: this.selection.y };
                if (!this._selPixels) this._liftSelection();
            } else {
                this._commitSelection();
                this._selStart = { x: pos.x, y: pos.y };
                this.selection = null;
            }
            return;
        }

        if (this.tool === 'line' || this.tool === 'circle' || this.tool === 'gradient') {
            this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
            this._shapeStart = { x: pos.x, y: pos.y };
            this._shapePreview = [];
            return;
        }

        this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
        if (e.button === 2) {
            this._erasePixel(pos.x, pos.y);
        } else {
            this._applyTool(pos.x, pos.y);
        }
    }

    _onMouseMove(e) {
        if (this._middleDown) {
            const dx = e.clientX - this._lastDragPos.x;
            const dy = e.clientY - this._lastDragPos.y;
            this.panX += dx;
            this.panY += dy;
            this._lastDragPos = { x: e.clientX, y: e.clientY };
            return;
        }

        const pos = this._eventToPixel(e);
        this.hoveredPixel = pos;
        this._updateStatus(pos);

        if (this._mouseDown && pos) {
            if (this.tool === 'select') {
                if (this._selMoving) {
                    const dx = pos.x - this._selMoveStart.x;
                    const dy = pos.y - this._selMoveStart.y;
                    this.selection.x = this._selOrigPos.x + dx;
                    this.selection.y = this._selOrigPos.y + dy;
                } else if (this._selStart) {
                    const x = Math.min(this._selStart.x, pos.x);
                    const y = Math.min(this._selStart.y, pos.y);
                    const w = Math.abs(pos.x - this._selStart.x) + 1;
                    const h = Math.abs(pos.y - this._selStart.y) + 1;
                    this.selection = { x, y, w, h };
                }
                return;
            }

            if ((this.tool === 'line' || this.tool === 'circle' || this.tool === 'gradient') && this._shapeStart) {
                if (this.tool === 'gradient') {
                    this._shapePreview = this._computeGradientPixels(this._shapeStart.x, this._shapeStart.y, pos.x, pos.y);
                } else {
                    this._shapePreview = this.tool === 'line'
                        ? this._computeLinePixels(this._shapeStart.x, this._shapeStart.y, pos.x, pos.y)
                        : this._computeCirclePixels(this._shapeStart.x, this._shapeStart.y, pos.x, pos.y);
                }
                return;
            }

            if (e.buttons === 2) {
                this._erasePixel(pos.x, pos.y);
            } else {
                this._applyToolContinuous(pos.x, pos.y);
            }
        }
    }

    _onMouseUp(e) {
        if (e.button === 1) {
            this._middleDown = false;
            this._lastDragPos = null;
            return;
        }
        if (this._mouseDown) {
            this._mouseDown = false;

            if (this.tool === 'select') {
                this._selMoving = false;
                this._selStart = null;
                return;
            }

            if ((this.tool === 'line' || this.tool === 'circle' || this.tool === 'gradient') && this._shapeStart && this._shapePreview) {
                for (const p of this._shapePreview) {
                    if (p.x >= 0 && p.x < this.canvasSize && p.y >= 0 && p.y < this.canvasSize) {
                        if (p.r !== undefined) {
                            this._setPixel(p.x, p.y, p.r, p.g, p.b, p.a);
                        } else {
                            this._setPixel(p.x, p.y, this.color.r, this.color.g, this.color.b, this.color.a);
                        }
                    }
                }
                this._shapeStart = null;
                this._shapePreview = null;
                this._addRecentColor();
                this._pushUndo();
                this._autoSave();
                return;
            }

            this._pushUndo();
            this._autoSave();
        }
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldZoom = this.zoom;
        const delta = e.deltaY > 0 ? -1 : 1;
        let newZoom = this.zoom + delta * Math.max(1, Math.floor(this.zoom * 0.15));
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        if (newZoom === oldZoom) return;

        const pixelX = (mouseX - this.panX) / oldZoom;
        const pixelY = (mouseY - this.panY) / oldZoom;
        this.zoom = newZoom;
        this.panX = mouseX - pixelX * newZoom;
        this.panY = mouseY - pixelY * newZoom;
    }

    _onResize() {
        const area = document.getElementById('se-canvas-wrap');
        if (!area) return;
        const rect = area.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    _onKeyDown(e) {
        if (this.container.style.display === 'none') return;
        if (this._sheetPickerOpen) {
            if (e.key === 'Escape') this._closeSheetPicker();
            return;
        }
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this._undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            this._redo();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this._copySelection();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            this._pasteSelection();
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selection) { this._deleteSelection(); return; }
        }

        switch (e.key) {
            case '1': this._setTool('draw'); break;
            case '2': this._setTool('erase'); break;
            case '3': this._setTool('fill'); break;
            case '4': this._setTool('pick'); break;
            case '5': this._setTool('select'); break;
            case '6': this._setTool('line'); break;
            case '7': this._setTool('circle'); break;
            case '8': this._setTool('lighten'); break;
            case '9': this._setTool('darken'); break;
            case 'f': case 'F':
                if (this.selection) this._fillSelection();
                break;
            case 'm': case 'M': this._cycleMirror(); break;
            case 't': case 'T': this._toggleTransparencyLock(); break;
            case 'g': case 'G': this._toggleGrid(); break;
            case 'c': case 'C': this._copySprite(); break;
            case 'v': case 'V': this._pasteSprite(); break;
            case '=': case '+': this._zoomIn(); break;
            case '-': case '_': this._zoomOut(); break;
            case '0': this._resetZoom(); break;
            case '[': this._adjustBrushSize(-1); break;
            case ']': this._adjustBrushSize(1); break;
            case 'Escape':
                if (this.selection) { this._commitSelection(); this.selection = null; }
                else this._goBack();
                break;
        }
    }

    _zoomIn() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const oldZoom = this.zoom;
        const newZoom = Math.min(MAX_ZOOM, this.zoom + Math.max(1, Math.floor(this.zoom * 0.25)));
        if (newZoom === oldZoom) return;
        const pixelX = (cx - this.panX) / oldZoom;
        const pixelY = (cy - this.panY) / oldZoom;
        this.zoom = newZoom;
        this.panX = cx - pixelX * newZoom;
        this.panY = cy - pixelY * newZoom;
    }

    _zoomOut() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const oldZoom = this.zoom;
        const newZoom = Math.max(MIN_ZOOM, this.zoom - Math.max(1, Math.floor(this.zoom * 0.25)));
        if (newZoom === oldZoom) return;
        const pixelX = (cx - this.panX) / oldZoom;
        const pixelY = (cy - this.panY) / oldZoom;
        this.zoom = newZoom;
        this.panX = cx - pixelX * newZoom;
        this.panY = cy - pixelY * newZoom;
    }

    _resetZoom() {
        const area = document.getElementById('se-canvas-wrap');
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const maxDim = Math.min(rect.width, rect.height) - 4;
        this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(maxDim / this.canvasSize)));
        this.panX = (rect.width - this.canvasSize * this.zoom) / 2;
        this.panY = (rect.height - this.canvasSize * this.zoom) / 2;
    }

    _eventToPixel(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left - this.panX) / this.zoom);
        const y = Math.floor((e.clientY - rect.top - this.panY) / this.zoom);
        if (x < 0 || x >= this.canvasSize || y < 0 || y >= this.canvasSize) return null;
        return { x, y };
    }

    _applyTool(x, y) {
        switch (this.tool) {
            case 'draw':
                this._drawBrush(x, y);
                this._addRecentColor();
                break;
            case 'erase':
                this._eraseBrush(x, y);
                break;
            case 'fill':
                this._floodFill(x, y);
                this._addRecentColor();
                break;
            case 'pick':
                this._pickColor(x, y);
                break;
            case 'lighten':
                this._lightenBrush(x, y);
                break;
            case 'darken':
                this._darkenBrush(x, y);
                break;
            case 'dither':
                this._ditherFill(x, y);
                break;
        }
    }

    _applyToolContinuous(x, y) {
        if (this.tool === 'draw') {
            this._drawBrush(x, y);
        } else if (this.tool === 'erase') {
            this._eraseBrush(x, y);
        } else if (this.tool === 'lighten') {
            this._lightenBrush(x, y);
        } else if (this.tool === 'darken') {
            this._darkenBrush(x, y);
        }
    }

    _getMirrorPoints(cx, cy) {
        const points = [[cx, cy]];
        const s = this.canvasSize;
        if (this.mirrorMode === 'h' || this.mirrorMode === 'both') {
            points.push([s - 1 - cx, cy]);
        }
        if (this.mirrorMode === 'v' || this.mirrorMode === 'both') {
            points.push([cx, s - 1 - cy]);
        }
        if (this.mirrorMode === 'both') {
            points.push([s - 1 - cx, s - 1 - cy]);
        }
        return points;
    }

    _drawBrush(cx, cy) {
        const bs = this.brushSize || 1;
        const r = Math.floor(bs / 2);
        for (const [mx, my] of this._getMirrorPoints(cx, cy)) {
            for (let dy = -r; dy < bs - r; dy++) {
                for (let dx = -r; dx < bs - r; dx++) {
                    const px = mx + dx, py = my + dy;
                    if (px >= 0 && px < this.canvasSize && py >= 0 && py < this.canvasSize) {
                        this._setPixel(px, py, this.color.r, this.color.g, this.color.b, this.color.a);
                    }
                }
            }
        }
    }

    _eraseBrush(cx, cy) {
        const bs = this.brushSize || 1;
        const r = Math.floor(bs / 2);
        for (const [mx, my] of this._getMirrorPoints(cx, cy)) {
            for (let dy = -r; dy < bs - r; dy++) {
                for (let dx = -r; dx < bs - r; dx++) {
                    const px = mx + dx, py = my + dy;
                    if (px >= 0 && px < this.canvasSize && py >= 0 && py < this.canvasSize) {
                        this._erasePixel(px, py);
                    }
                }
            }
        }
    }

    _lightenBrush(cx, cy) {
        const bs = this.brushSize || 1;
        const r = Math.floor(bs / 2);
        for (const [mx, my] of this._getMirrorPoints(cx, cy)) {
            for (let dy = -r; dy < bs - r; dy++) {
                for (let dx = -r; dx < bs - r; dx++) {
                    const px = mx + dx, py = my + dy;
                    if (px >= 0 && px < this.canvasSize && py >= 0 && py < this.canvasSize) {
                        this._shiftBrightness(px, py, 20);
                    }
                }
            }
        }
    }

    _darkenBrush(cx, cy) {
        const bs = this.brushSize || 1;
        const r = Math.floor(bs / 2);
        for (const [mx, my] of this._getMirrorPoints(cx, cy)) {
            for (let dy = -r; dy < bs - r; dy++) {
                for (let dx = -r; dx < bs - r; dx++) {
                    const px = mx + dx, py = my + dy;
                    if (px >= 0 && px < this.canvasSize && py >= 0 && py < this.canvasSize) {
                        this._shiftBrightness(px, py, -20);
                    }
                }
            }
        }
    }

    _shiftBrightness(x, y, amount) {
        const i = (y * this.canvasSize + x) * 4;
        if (this.pixels[i + 3] === 0) return;
        this.pixels[i] = Math.max(0, Math.min(255, this.pixels[i] + amount));
        this.pixels[i + 1] = Math.max(0, Math.min(255, this.pixels[i + 1] + amount));
        this.pixels[i + 2] = Math.max(0, Math.min(255, this.pixels[i + 2] + amount));
    }

    _setPixel(x, y, r, g, b, a) {
        const i = (y * this.canvasSize + x) * 4;
        if (this.transparencyLock && this.pixels[i + 3] === 0) return;
        this.pixels[i] = r;
        this.pixels[i + 1] = g;
        this.pixels[i + 2] = b;
        this.pixels[i + 3] = a;
    }

    _getPixel(x, y) {
        const i = (y * this.canvasSize + x) * 4;
        return { r: this.pixels[i], g: this.pixels[i + 1], b: this.pixels[i + 2], a: this.pixels[i + 3] };
    }

    _erasePixel(x, y) {
        this._setPixel(x, y, 0, 0, 0, 0);
    }

    _pickColor(x, y) {
        const { r, g, b, a } = this._getPixel(x, y);
        this._secondaryColor = { ...this.color };
        this._updateSecondaryColorSwatch();
        this.color = { r, g, b, a };
        this._syncColorUI();
        this._setTool('draw');
    }

    _floodFill(startX, startY) {
        const target = this._getPixel(startX, startY);
        const fill = { ...this.color };
        if (target.r === fill.r && target.g === fill.g && target.b === fill.b && target.a === fill.a) return;

        const size = this.canvasSize;
        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            const key = y * size + x;
            if (visited.has(key)) continue;
            visited.add(key);

            const px = this._getPixel(x, y);
            if (px.r !== target.r || px.g !== target.g || px.b !== target.b || px.a !== target.a) continue;

            this._setPixel(x, y, fill.r, fill.g, fill.b, fill.a);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    _setTool(tool) {
        if (this.tool === 'select' && tool !== 'select') {
            this._commitSelection();
            this.selection = null;
        }
        this.tool = tool;
        this.container.querySelectorAll('.se-tool[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    _toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('se-toggle-grid').classList.toggle('active', this.showGrid);
    }

    _setCanvasSize(size) {
        if (size === this.canvasSize) return;
        const oldPixels = this.pixels;
        const oldSize = this.canvasSize;
        this.canvasSize = size;
        this.pixels = new Uint8ClampedArray(size * size * 4);

        // Copy what fits from old canvas
        const copySize = Math.min(oldSize, size);
        for (let y = 0; y < copySize; y++) {
            for (let x = 0; x < copySize; x++) {
                const oldI = (y * oldSize + x) * 4;
                const newI = (y * size + x) * 4;
                this.pixels[newI] = oldPixels[oldI];
                this.pixels[newI + 1] = oldPixels[oldI + 1];
                this.pixels[newI + 2] = oldPixels[oldI + 2];
                this.pixels[newI + 3] = oldPixels[oldI + 3];
            }
        }
        this._recalcZoom();
    }

    _recalcZoom() {
        const area = document.getElementById('se-canvas-wrap');
        if (!area) return;
        const rect = area.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        const maxDim = Math.min(rect.width, rect.height) - 4;
        this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(maxDim / this.canvasSize)));
        this.panX = (rect.width - this.canvasSize * this.zoom) / 2;
        this.panY = (rect.height - this.canvasSize * this.zoom) / 2;
        this.previewCanvas.width = this.canvasSize;
        this.previewCanvas.height = this.canvasSize;
    }

    _selectObject(key, category) {
        const prevSpriteKey = this.activeObject ? `${this.activeObject.category}:${this.activeObject.key}` : null;

        this._autoSave();
        this._clearUndoHistory();
        this.activeObject = { key, category };
        const spriteKey = `${category}:${key}`;
        const saved = this.savedSprites[spriteKey];
        if (saved) {
            this._loadPixelsFromDataURL(saved.data, saved.size);
        } else {
            this.pixels = new Uint8ClampedArray(this.canvasSize * this.canvasSize * 4);
        }

        if (this._onionSkinKey === '__pending__' && prevSpriteKey && prevSpriteKey !== spriteKey) {
            this._setOnionSkinFromSprite(prevSpriteKey);
        }

        if (category === 'equipment_worn') {
            const colonistSprite = this.savedSprites['entities:colonist_body_1'];
            if (colonistSprite) {
                this._onionSkinOpacity = 1.0;
                const slotType = HELMETS[key] ? 'helmet' : WEAPONS[key] ? 'weapon' : TOOLS[key] ? 'tool' : 'armor';
                const offsets = EQUIPMENT_OVERLAY_OFFSETS[slotType] || {};
                this._onionSkinOffsetX = -(offsets.offsetX || 0);
                this._onionSkinOffsetY = -(offsets.offsetY || 0);
                if (slotType === 'weapon' || slotType === 'tool') {
                    this._setOnionSkinComposite('entities:colonist_body_1');
                } else {
                    this._setOnionSkinFromSprite('entities:colonist_body_1');
                }
            }
        } else if (this._onionSkinOpacity === 1.0) {
            this._onionSkinOpacity = 0.3;
            this._onionSkinOffsetX = 0;
            this._onionSkinOffsetY = 0;
            if (this._onionSkinKey && this._onionSkinKey !== '__pending__') {
                this._onionSkinKey = null;
                this._onionSkinData = null;
            }
        }

        this._buildPalette();
        this._refreshSavedList();
        this._updateActiveObjectDisplay();
    }

    _updateActiveObjectDisplay() {
        const el = document.getElementById('se-active-object');
        if (!this.activeObject) {
            el.textContent = 'No object selected';
            return;
        }
        const { key, category } = this.activeObject;
        el.innerHTML = `<strong>${category}/${key}</strong>`;
    }

    _loadPixelsFromDataURL(dataURL, savedSize) {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvasSize;
            tempCanvas.height = this.canvasSize;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(img, 0, 0, this.canvasSize, this.canvasSize);
            const imageData = tempCtx.getImageData(0, 0, this.canvasSize, this.canvasSize);
            this.pixels = new Uint8ClampedArray(imageData.data);
        };
        img.src = dataURL;
    }

    // --- Color Management ---
    _setColorFromHex(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        this.color.r = r;
        this.color.g = g;
        this.color.b = b;
        this._syncColorUI();
    }

    _syncColorUI(skipHSL) {
        const hex = '#' + [this.color.r, this.color.g, this.color.b].map(c => c.toString(16).padStart(2, '0')).join('');
        document.getElementById('se-color-picker').value = hex;
        document.getElementById('se-color-hex').value = hex;
        document.getElementById('se-alpha-slider').value = this.color.a;
        document.getElementById('se-alpha-val').textContent = this.color.a;
        if (!skipHSL) {
            const hsl = this._rgbToHsl(this.color.r, this.color.g, this.color.b);
            document.getElementById('se-hsl-h').value = hsl.h;
            document.getElementById('se-hsl-s').value = hsl.s;
            document.getElementById('se-hsl-l').value = hsl.l;
            document.getElementById('se-hsl-h-val').textContent = hsl.h;
            document.getElementById('se-hsl-s-val').textContent = hsl.s;
            document.getElementById('se-hsl-l-val').textContent = hsl.l;
        }
        this._updateCurrentColor();
    }

    _updateCurrentColor() {
        const el = document.getElementById('se-current-color');
        if (!el) return;
        const { r, g, b, a } = this.color;
        el.style.background = `rgba(${r},${g},${b},${a / 255})`;
    }

    _updateSecondaryColorSwatch() {
        const el = document.getElementById('se-secondary-color');
        if (!el) return;
        const { r, g, b, a } = this._secondaryColor;
        el.style.background = `rgba(${r},${g},${b},${a / 255})`;
        const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        const picker = document.getElementById('se-secondary-picker');
        if (picker) picker.value = hex;
    }

    _rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    _hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    _shiftColorLightness(amount) {
        const hsl = this._rgbToHsl(this.color.r, this.color.g, this.color.b);
        hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
        const rgb = this._hslToRgb(hsl.h, hsl.s, hsl.l);
        this.color.r = rgb.r; this.color.g = rgb.g; this.color.b = rgb.b;
        this._syncColorUI();
    }

    _addRecentColor() {
        const c = { ...this.color };
        const key = `${c.r},${c.g},${c.b},${c.a}`;
        this.recentColors = this.recentColors.filter(rc => `${rc.r},${rc.g},${rc.b},${rc.a}` !== key);
        this.recentColors.unshift(c);
        if (this.recentColors.length > 16) this.recentColors.pop();
        this._renderRecentColors();
    }

    _renderRecentColors() {
        const el = document.getElementById('se-recent-colors');
        if (!el) return;
        el.innerHTML = this.recentColors.map(c =>
            `<div class="se-swatch" data-color='${JSON.stringify(c)}' style="background:rgba(${c.r},${c.g},${c.b},${c.a / 255})" title="rgba(${c.r},${c.g},${c.b},${c.a})"></div>`
        ).join('');
    }

    // --- Rendering ---
    _startLoop() {
        const loop = () => {
            if (this.container.style.display === 'none') { this._animFrame = null; return; }
            this._render();
            this._renderPreview();
            this._animFrame = requestAnimationFrame(loop);
        };
        this._animFrame = requestAnimationFrame(loop);
    }

    _render() {
        const ctx = this.ctx;
        const size = this.canvasSize;
        const z = this.zoom;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const ox = this.panX;
        const oy = this.panY;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, cw, ch);

        // Checkerboard background within the pixel grid area
        const gridW = size * z;
        const gridH = size * z;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, gridW, gridH);
        ctx.clip();
        const checkSize = Math.max(1, Math.floor(z / 2));
        for (let y = 0; y < gridH; y += checkSize) {
            for (let x = 0; x < gridW; x += checkSize) {
                const cx = Math.floor(x / checkSize);
                const cy = Math.floor(y / checkSize);
                ctx.fillStyle = (cx + cy) % 2 === 0 ? CHECKERBOARD_LIGHT : CHECKERBOARD_DARK;
                ctx.fillRect(ox + x, oy + y, checkSize, checkSize);
            }
        }
        ctx.restore();

        // Reference image overlay (behind pixels)
        if (this._showRefImage && this._refImage) {
            ctx.globalAlpha = 0.3;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this._refImage, ox, oy, gridW, gridH);
            ctx.globalAlpha = 1.0;
        }

        // Onion skin overlay (behind pixels)
        if (this._onionSkinKey && this._onionSkinData) {
            ctx.globalAlpha = this._onionSkinOpacity;
            ctx.imageSmoothingEnabled = false;
            const onionOffX = this._onionSkinOffsetX ? Math.floor(gridW * this._onionSkinOffsetX) : 0;
            const onionOffY = this._onionSkinOffsetY ? Math.floor(gridH * this._onionSkinOffsetY) : 0;
            ctx.drawImage(this._onionSkinData, ox + onionOffX, oy + onionOffY, gridW, gridH);
            ctx.globalAlpha = 1.0;
        }

        // Draw pixels
        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                const i = (py * size + px) * 4;
                const a = this.pixels[i + 3];
                if (a === 0) continue;
                const r = this.pixels[i];
                const g = this.pixels[i + 1];
                const b = this.pixels[i + 2];
                ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
                ctx.fillRect(ox + px * z, oy + py * z, z, z);
            }
        }

        // Grid lines
        if (this.showGrid && z >= 4) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= size; i++) {
                ctx.moveTo(ox + i * z + 0.5, oy);
                ctx.lineTo(ox + i * z + 0.5, oy + gridH);
                ctx.moveTo(ox, oy + i * z + 0.5);
                ctx.lineTo(ox + gridW, oy + i * z + 0.5);
            }
            ctx.stroke();
        }

        // Border around the pixel grid
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox - 0.5, oy - 0.5, gridW + 1, gridH + 1);

        // Draw lifted selection pixels (floating above canvas)
        if (this._selPixels && this.selection) {
            const s = this.selection;
            for (let dy = 0; dy < s.h; dy++) {
                for (let dx = 0; dx < s.w; dx++) {
                    const i = (dy * s.w + dx) * 4;
                    const a = this._selPixels[i + 3];
                    if (a === 0) continue;
                    const px = s.x + dx, py = s.y + dy;
                    ctx.fillStyle = `rgba(${this._selPixels[i]},${this._selPixels[i + 1]},${this._selPixels[i + 2]},${a / 255})`;
                    ctx.fillRect(ox + px * z, oy + py * z, z, z);
                }
            }
        }

        // Shape preview (line/circle/gradient)
        if (this._shapePreview && this._shapePreview.length > 0) {
            for (const p of this._shapePreview) {
                if (p.x >= 0 && p.x < size && p.y >= 0 && p.y < size) {
                    if (p.r !== undefined) {
                        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.a / 255})`;
                    } else {
                        ctx.fillStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},${this.color.a / 255})`;
                    }
                    ctx.fillRect(ox + p.x * z, oy + p.y * z, z, z);
                }
            }
        }

        // Selection rectangle
        if (this.selection) {
            const s = this.selection;
            ctx.strokeStyle = 'rgba(0,200,255,0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(ox + s.x * z, oy + s.y * z, s.w * z, s.h * z);
            ctx.setLineDash([]);
        }

        // Cursor highlight (respects brush size)
        if (this.hoveredPixel) {
            const { x, y } = this.hoveredPixel;
            const bs = this.brushSize || 1;
            const r = Math.floor(bs / 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 2;
            if (bs === 1) {
                ctx.strokeRect(ox + x * z + 1, oy + y * z + 1, z - 2, z - 2);
            } else {
                ctx.strokeRect(ox + (x - r) * z + 1, oy + (y - r) * z + 1, bs * z - 2, bs * z - 2);
            }
        }
    }

    _renderPreview() {
        const ctx = this.previewCtx;
        const size = this.canvasSize;
        const pw = this.previewCanvas.width;
        const ph = this.previewCanvas.height;

        if (this._showTilePreview) {
            this.previewCanvas.width = size * 3;
            this.previewCanvas.height = size * 3;
            ctx.clearRect(0, 0, size * 3, size * 3);
            const imageData = new ImageData(this.pixels.slice(), size, size);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            for (let ty = 0; ty < 3; ty++) {
                for (let tx = 0; tx < 3; tx++) {
                    ctx.drawImage(tempCanvas, tx * size, ty * size);
                }
            }
        } else {
            if (this.previewCanvas.width !== size || this.previewCanvas.height !== size) {
                this.previewCanvas.width = size;
                this.previewCanvas.height = size;
            }
            ctx.clearRect(0, 0, size, size);
            if (this.activeObject?.category === 'equipment_worn' && this._onionSkinData) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(this._onionSkinData, 0, 0, size, size);
            }
            const imageData = new ImageData(this.pixels.slice(), size, size);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            const previewOffX = (this.activeObject?.category === 'equipment_worn' && this._onionSkinOffsetX)
                ? -Math.floor(size * this._onionSkinOffsetX) : 0;
            const previewOffY = (this.activeObject?.category === 'equipment_worn' && this._onionSkinOffsetY)
                ? -Math.floor(size * this._onionSkinOffsetY) : 0;
            ctx.drawImage(tempCanvas, previewOffX, previewOffY);
        }
    }

    _updateStatus(pos) {
        const el = document.getElementById('se-status');
        if (pos) {
            const px = this._getPixel(pos.x, pos.y);
            el.textContent = `x: ${pos.x}, y: ${pos.y} | rgba(${px.r}, ${px.g}, ${px.b}, ${px.a}) | Zoom: ${this.zoom}x`;
        } else {
            el.textContent = `${this.canvasSize}x${this.canvasSize} | ${this.tool} | Zoom: ${this.zoom}x | Scroll=Zoom, Middle-drag=Pan, 0=Reset`;
        }
    }

    // --- Undo/Redo ---
    _pushUndo() {
        if (!this._strokeSnapshot) return;
        let changed = false;
        for (let i = 0; i < this._strokeSnapshot.length; i++) {
            if (this._strokeSnapshot[i] !== this.pixels[i]) { changed = true; break; }
        }
        if (!changed) { this._strokeSnapshot = null; return; }
        this._undoStack.push(this._strokeSnapshot);
        if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
        this._redoStack.length = 0;
        this._strokeSnapshot = null;
    }

    _pushUndoSnapshot() {
        this._undoStack.push(new Uint8ClampedArray(this.pixels));
        if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
        this._redoStack.length = 0;
    }

    _undo() {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(new Uint8ClampedArray(this.pixels));
        this.pixels = this._undoStack.pop();
        this._autoSave();
    }

    _redo() {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(new Uint8ClampedArray(this.pixels));
        this.pixels = this._redoStack.pop();
        this._autoSave();
    }

    _clearUndoHistory() {
        this._undoStack.length = 0;
        this._redoStack.length = 0;
        this._strokeSnapshot = null;
    }

    // --- Copy/Paste ---
    _copySprite() {
        this.clipboard = {
            size: this.canvasSize,
            pixels: new Uint8ClampedArray(this.pixels)
        };
        const el = document.getElementById('se-status');
        el.textContent = 'Sprite copied to clipboard';
    }

    _pasteSprite() {
        if (!this.clipboard) {
            const el = document.getElementById('se-status');
            el.textContent = 'Nothing to paste — copy a sprite first (C)';
            return;
        }
        this._pushUndoSnapshot();
        if (this.clipboard.size !== this.canvasSize) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.clipboard.size;
            tempCanvas.height = this.clipboard.size;
            const tempCtx = tempCanvas.getContext('2d');
            const imageData = new ImageData(new Uint8ClampedArray(this.clipboard.pixels), this.clipboard.size, this.clipboard.size);
            tempCtx.putImageData(imageData, 0, 0);
            const destCanvas = document.createElement('canvas');
            destCanvas.width = this.canvasSize;
            destCanvas.height = this.canvasSize;
            const destCtx = destCanvas.getContext('2d');
            destCtx.imageSmoothingEnabled = false;
            destCtx.drawImage(tempCanvas, 0, 0, this.canvasSize, this.canvasSize);
            const destData = destCtx.getImageData(0, 0, this.canvasSize, this.canvasSize);
            this.pixels = new Uint8ClampedArray(destData.data);
        } else {
            this.pixels = new Uint8ClampedArray(this.clipboard.pixels);
        }
        this._autoSave();
        const el = document.getElementById('se-status');
        el.textContent = 'Sprite pasted from clipboard';
    }

    // --- Selection Tools ---
    _posInSelection(pos) {
        if (!this.selection) return false;
        const s = this.selection;
        return pos.x >= s.x && pos.x < s.x + s.w && pos.y >= s.y && pos.y < s.y + s.h;
    }

    _liftSelection() {
        const s = this.selection;
        this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
        this._selPixels = new Uint8ClampedArray(s.w * s.h * 4);
        for (let dy = 0; dy < s.h; dy++) {
            for (let dx = 0; dx < s.w; dx++) {
                const sx = s.x + dx, sy = s.y + dy;
                if (sx < 0 || sx >= this.canvasSize || sy < 0 || sy >= this.canvasSize) continue;
                const srcI = (sy * this.canvasSize + sx) * 4;
                const dstI = (dy * s.w + dx) * 4;
                this._selPixels[dstI] = this.pixels[srcI];
                this._selPixels[dstI + 1] = this.pixels[srcI + 1];
                this._selPixels[dstI + 2] = this.pixels[srcI + 2];
                this._selPixels[dstI + 3] = this.pixels[srcI + 3];
                this.pixels[srcI] = 0;
                this.pixels[srcI + 1] = 0;
                this.pixels[srcI + 2] = 0;
                this.pixels[srcI + 3] = 0;
            }
        }
    }

    _commitSelection() {
        if (!this._selPixels || !this.selection) return;
        const s = this.selection;
        for (let dy = 0; dy < s.h; dy++) {
            for (let dx = 0; dx < s.w; dx++) {
                const tx = s.x + dx, ty = s.y + dy;
                if (tx < 0 || tx >= this.canvasSize || ty < 0 || ty >= this.canvasSize) continue;
                const srcI = (dy * s.w + dx) * 4;
                if (this._selPixels[srcI + 3] === 0) continue;
                const dstI = (ty * this.canvasSize + tx) * 4;
                this.pixels[dstI] = this._selPixels[srcI];
                this.pixels[dstI + 1] = this._selPixels[srcI + 1];
                this.pixels[dstI + 2] = this._selPixels[srcI + 2];
                this.pixels[dstI + 3] = this._selPixels[srcI + 3];
            }
        }
        this._selPixels = null;
        this._pushUndo();
        this._autoSave();
    }

    _copySelection() {
        if (!this.selection) return;
        const s = this.selection;
        const data = new Uint8ClampedArray(s.w * s.h * 4);
        const src = this._selPixels || this.pixels;
        for (let dy = 0; dy < s.h; dy++) {
            for (let dx = 0; dx < s.w; dx++) {
                let srcI;
                if (this._selPixels) {
                    srcI = (dy * s.w + dx) * 4;
                } else {
                    const sx = s.x + dx, sy = s.y + dy;
                    if (sx < 0 || sx >= this.canvasSize || sy < 0 || sy >= this.canvasSize) continue;
                    srcI = (sy * this.canvasSize + sx) * 4;
                }
                const dstI = (dy * s.w + dx) * 4;
                data[dstI] = src[srcI];
                data[dstI + 1] = src[srcI + 1];
                data[dstI + 2] = src[srcI + 2];
                data[dstI + 3] = src[srcI + 3];
            }
        }
        this._regionClipboard = { w: s.w, h: s.h, pixels: data };
        document.getElementById('se-status').textContent = `Copied ${s.w}x${s.h} region`;
    }

    _pasteSelection() {
        if (!this._regionClipboard) {
            document.getElementById('se-status').textContent = 'Nothing to paste — select and Ctrl+C first';
            return;
        }
        this._commitSelection();
        const clip = this._regionClipboard;
        this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
        this.selection = { x: 0, y: 0, w: clip.w, h: clip.h };
        this._selPixels = new Uint8ClampedArray(clip.pixels);
        this._setTool('select');
        document.getElementById('se-status').textContent = `Pasted ${clip.w}x${clip.h} region — drag to position, Esc to commit`;
    }

    _deleteSelection() {
        if (!this.selection) return;
        if (this._selPixels) {
            this._selPixels = null;
            this._pushUndo();
            this._autoSave();
            this.selection = null;
            return;
        }
        const s = this.selection;
        this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
        for (let dy = 0; dy < s.h; dy++) {
            for (let dx = 0; dx < s.w; dx++) {
                const tx = s.x + dx, ty = s.y + dy;
                if (tx < 0 || tx >= this.canvasSize || ty < 0 || ty >= this.canvasSize) continue;
                this._erasePixel(tx, ty);
            }
        }
        this.selection = null;
        this._pushUndo();
        this._autoSave();
    }

    _fillSelection() {
        if (!this.selection) return;
        const s = this.selection;
        this._strokeSnapshot = new Uint8ClampedArray(this.pixels);
        if (this._selPixels) {
            for (let dy = 0; dy < s.h; dy++) {
                for (let dx = 0; dx < s.w; dx++) {
                    const i = (dy * s.w + dx) * 4;
                    this._selPixels[i] = this.color.r;
                    this._selPixels[i + 1] = this.color.g;
                    this._selPixels[i + 2] = this.color.b;
                    this._selPixels[i + 3] = this.color.a;
                }
            }
        } else {
            for (let dy = 0; dy < s.h; dy++) {
                for (let dx = 0; dx < s.w; dx++) {
                    const tx = s.x + dx, ty = s.y + dy;
                    if (tx < 0 || tx >= this.canvasSize || ty < 0 || ty >= this.canvasSize) continue;
                    this._setPixel(tx, ty, this.color.r, this.color.g, this.color.b, this.color.a);
                }
            }
        }
        this._pushUndo();
        this._autoSave();
    }

    // --- Shape Tools ---
    _computeLinePixels(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let cx = x0, cy = y0;
        while (true) {
            points.push({ x: cx, y: cy });
            if (cx === x1 && cy === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 < dx) { err += dx; cy += sy; }
        }
        return points;
    }

    _computeCirclePixels(cx, cy, ex, ey) {
        const points = [];
        const r = Math.round(Math.sqrt((ex - cx) ** 2 + (ey - cy) ** 2));
        if (r === 0) return [{ x: cx, y: cy }];
        let x = r, y = 0, d = 1 - r;
        const addSymmetric = (px, py) => {
            points.push({ x: cx + px, y: cy + py });
            points.push({ x: cx - px, y: cy + py });
            points.push({ x: cx + px, y: cy - py });
            points.push({ x: cx - px, y: cy - py });
            points.push({ x: cx + py, y: cy + px });
            points.push({ x: cx - py, y: cy + px });
            points.push({ x: cx + py, y: cy - px });
            points.push({ x: cx - py, y: cy - px });
        };
        while (x >= y) {
            addSymmetric(x, y);
            y++;
            if (d <= 0) {
                d += 2 * y + 1;
            } else {
                x--;
                d += 2 * (y - x) + 1;
            }
        }
        return points;
    }

    // --- Brush Size ---
    _adjustBrushSize(delta) {
        this.brushSize = Math.max(1, Math.min(16, (this.brushSize || 1) + delta));
        const input = document.getElementById('se-brush-size');
        if (input) input.value = this.brushSize;
        document.getElementById('se-status').textContent = `Brush size: ${this.brushSize}`;
    }

    // --- Mirror Mode ---
    _cycleMirror() {
        const modes = [null, 'h', 'v', 'both'];
        const idx = modes.indexOf(this.mirrorMode);
        this.mirrorMode = modes[(idx + 1) % modes.length];
        const btn = document.getElementById('se-toggle-mirror');
        const labels = { null: 'Mirror', h: 'Mirror-H', v: 'Mirror-V', both: 'Mirror-HV' };
        btn.textContent = labels[this.mirrorMode] || 'Mirror';
        btn.classList.toggle('active', this.mirrorMode !== null);
        document.getElementById('se-status').textContent = this.mirrorMode
            ? `Mirror: ${this.mirrorMode === 'h' ? 'Horizontal' : this.mirrorMode === 'v' ? 'Vertical' : 'Both'}`
            : 'Mirror off';
    }

    // --- Transparency Lock ---
    _toggleTransparencyLock() {
        this.transparencyLock = !this.transparencyLock;
        const btn = document.getElementById('se-toggle-tlock');
        btn.classList.toggle('active', this.transparencyLock);
        document.getElementById('se-status').textContent = this.transparencyLock
            ? 'Transparency lock ON — only draws on non-transparent pixels'
            : 'Transparency lock OFF';
    }

    // --- Flip & Rotate ---
    _flipHorizontal() {
        this._pushUndoSnapshot();
        const s = this.canvasSize;
        const flipped = new Uint8ClampedArray(this.pixels.length);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const srcI = (y * s + x) * 4;
                const dstI = (y * s + (s - 1 - x)) * 4;
                flipped[dstI] = this.pixels[srcI];
                flipped[dstI + 1] = this.pixels[srcI + 1];
                flipped[dstI + 2] = this.pixels[srcI + 2];
                flipped[dstI + 3] = this.pixels[srcI + 3];
            }
        }
        this.pixels = flipped;
        this._autoSave();
    }

    _flipVertical() {
        this._pushUndoSnapshot();
        const s = this.canvasSize;
        const flipped = new Uint8ClampedArray(this.pixels.length);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const srcI = (y * s + x) * 4;
                const dstI = ((s - 1 - y) * s + x) * 4;
                flipped[dstI] = this.pixels[srcI];
                flipped[dstI + 1] = this.pixels[srcI + 1];
                flipped[dstI + 2] = this.pixels[srcI + 2];
                flipped[dstI + 3] = this.pixels[srcI + 3];
            }
        }
        this.pixels = flipped;
        this._autoSave();
    }

    _rotateCW() {
        this._pushUndoSnapshot();
        const s = this.canvasSize;
        const rotated = new Uint8ClampedArray(this.pixels.length);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const srcI = (y * s + x) * 4;
                const dstI = (x * s + (s - 1 - y)) * 4;
                rotated[dstI] = this.pixels[srcI];
                rotated[dstI + 1] = this.pixels[srcI + 1];
                rotated[dstI + 2] = this.pixels[srcI + 2];
                rotated[dstI + 3] = this.pixels[srcI + 3];
            }
        }
        this.pixels = rotated;
        this._autoSave();
    }

    // --- Replace Color ---
    _replaceColor() {
        const target = this._secondaryColor;
        const fill = this.color;
        if (target.r === fill.r && target.g === fill.g && target.b === fill.b && target.a === fill.a) {
            document.getElementById('se-status').textContent = 'Source and target colors are the same';
            return;
        }
        this._pushUndoSnapshot();
        const s = this.canvasSize;
        let count = 0;
        for (let i = 0; i < s * s * 4; i += 4) {
            if (this.pixels[i] === target.r && this.pixels[i + 1] === target.g &&
                this.pixels[i + 2] === target.b && this.pixels[i + 3] === target.a) {
                this.pixels[i] = fill.r;
                this.pixels[i + 1] = fill.g;
                this.pixels[i + 2] = fill.b;
                this.pixels[i + 3] = fill.a;
                count++;
            }
        }
        this._autoSave();
        document.getElementById('se-status').textContent = `Replaced ${count} pixel(s)`;
    }

    // --- Custom Palette ---
    _buildCustomPaletteHTML() {
        return `<div style="display:flex;gap:4px;align-items:center;padding:4px 8px;">
            <span style="font-size:10px;color:#888;margin-right:4px;">Palette:</span>
            ${this.customPalette.map((c, i) =>
                `<div class="se-palette-slot" data-idx="${i}" style="width:24px;height:24px;border-radius:3px;border:2px solid #555;cursor:pointer;background:rgba(${c.r},${c.g},${c.b},${c.a / 255})" title="Left-click: pick | Right-click: set to current color"></div>`
            ).join('')}
        </div>`;
    }

    _refreshCustomPalette() {
        const el = document.getElementById('se-custom-palette');
        if (el) el.innerHTML = this._buildCustomPaletteHTML();
    }

    _saveCustomPalette() {
        localStorage.setItem('convocation_skin_custom_palette', JSON.stringify(this.customPalette));
    }

    // --- Dither Fill ---
    _ditherFill(x, y) {
        const target = this._getPixel(x, y);
        const c1 = this.color;
        const c2 = this._secondaryColor;
        if (target.r === c1.r && target.g === c1.g && target.b === c1.b && target.a === c1.a) return;

        const size = this.canvasSize;
        const stack = [[x, y]];
        const visited = new Set();

        while (stack.length > 0) {
            const [fx, fy] = stack.pop();
            if (fx < 0 || fx >= size || fy < 0 || fy >= size) continue;
            const key = fy * size + fx;
            if (visited.has(key)) continue;
            visited.add(key);

            const px = this._getPixel(fx, fy);
            if (px.r !== target.r || px.g !== target.g || px.b !== target.b || px.a !== target.a) continue;

            const useC1 = (fx + fy) % 2 === 0;
            const c = useC1 ? c1 : c2;
            this._setPixel(fx, fy, c.r, c.g, c.b, c.a);
            stack.push([fx + 1, fy], [fx - 1, fy], [fx, fy + 1], [fx, fy - 1]);
        }
    }

    // --- Gradient Tool ---
    _computeGradientPixels(x0, y0, x1, y1) {
        const c1 = this.color;
        const c2 = this._secondaryColor;
        const pixels = [];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return [{ x: x0, y: y0, r: c1.r, g: c1.g, b: c1.b, a: c1.a }];

        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const proj = ((px - x0) * dx + (py - y0) * dy) / (len * len);
                const t = Math.max(0, Math.min(1, proj));
                pixels.push({
                    x: px, y: py,
                    r: Math.round(c1.r + (c2.r - c1.r) * t),
                    g: Math.round(c1.g + (c2.g - c1.g) * t),
                    b: Math.round(c1.b + (c2.b - c1.b) * t),
                    a: Math.round(c1.a + (c2.a - c1.a) * t),
                });
            }
        }
        return pixels;
    }

    // --- Outline Generator ---
    _generateOutline() {
        const size = this.canvasSize;
        const hasPixel = (x, y) => {
            if (x < 0 || x >= size || y < 0 || y >= size) return false;
            return this.pixels[(y * size + x) * 4 + 3] > 0;
        };

        this._pushUndoSnapshot();
        const outlinePixels = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (hasPixel(x, y)) continue;
                if (hasPixel(x - 1, y) || hasPixel(x + 1, y) || hasPixel(x, y - 1) || hasPixel(x, y + 1)) {
                    outlinePixels.push([x, y]);
                }
            }
        }
        for (const [x, y] of outlinePixels) {
            this._setPixel(x, y, this.color.r, this.color.g, this.color.b, this.color.a);
        }
        this._autoSave();
        document.getElementById('se-status').textContent = `Added outline: ${outlinePixels.length} pixel(s)`;
    }

    // --- Extract Palette ---
    _extractPalette() {
        const size = this.canvasSize;
        const colorSet = new Map();
        for (let i = 0; i < size * size * 4; i += 4) {
            if (this.pixels[i + 3] === 0) continue;
            const key = `${this.pixels[i]},${this.pixels[i + 1]},${this.pixels[i + 2]},${this.pixels[i + 3]}`;
            if (!colorSet.has(key)) {
                colorSet.set(key, { r: this.pixels[i], g: this.pixels[i + 1], b: this.pixels[i + 2], a: this.pixels[i + 3] });
            }
        }
        const colors = [...colorSet.values()];
        if (colors.length === 0) {
            document.getElementById('se-status').textContent = 'No colors to extract (canvas is empty)';
            return;
        }
        for (let i = 0; i < 6 && i < colors.length; i++) {
            this.customPalette[i] = colors[i];
        }
        this._saveCustomPalette();
        this._refreshCustomPalette();
        document.getElementById('se-status').textContent = `Extracted ${Math.min(6, colors.length)} color(s) to palette${colors.length > 6 ? ` (${colors.length} total, showing first 6)` : ''}`;
    }

    // --- Onion Skin ---
    _toggleOnionSkin() {
        if (this._onionSkinKey) {
            this._onionSkinKey = null;
            this._onionSkinData = null;
            document.getElementById('se-toggle-onion').classList.remove('active');
            document.getElementById('se-status').textContent = 'Onion skin OFF';
        } else {
            document.getElementById('se-toggle-onion').classList.add('active');
            document.getElementById('se-status').textContent = 'Onion skin ON — select an object from palette to use as overlay';
            this._onionSkinKey = '__pending__';
        }
    }

    _setOnionSkinFromSprite(spriteKey) {
        const saved = this.savedSprites[spriteKey];
        if (!saved) {
            this._onionSkinKey = null;
            this._onionSkinData = null;
            return;
        }
        this._onionSkinKey = spriteKey;
        const img = new Image();
        img.onload = () => { this._onionSkinData = img; };
        img.src = saved.data;
    }

    _setOnionSkinComposite(colonistSpriteKey) {
        const colonistSaved = this.savedSprites[colonistSpriteKey];
        if (!colonistSaved) {
            this._setOnionSkinFromSprite(colonistSpriteKey);
            return;
        }
        this._onionSkinKey = colonistSpriteKey;
        const size = this.canvasSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const drawLayer = (dataURL, offsetY) => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    const offY = Math.floor(size * (offsetY || 0));
                    ctx.drawImage(img, 0, offY, size, size);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = dataURL;
            });
        };

        const armorKeys = Object.keys(ARMORS);
        const helmetKeys = Object.keys(HELMETS);
        const firstArmor = armorKeys.find(k => this.savedSprites['equipment_worn:' + k]);
        const firstHelmet = helmetKeys.find(k => this.savedSprites['equipment_worn:' + k]);

        drawLayer(colonistSaved.data, 0).then(() => {
            const layers = [];
            if (firstArmor) {
                layers.push(drawLayer(this.savedSprites['equipment_worn:' + firstArmor].data, EQUIPMENT_OVERLAY_OFFSETS.armor.offsetY));
            }
            if (firstHelmet) {
                layers.push(drawLayer(this.savedSprites['equipment_worn:' + firstHelmet].data, EQUIPMENT_OVERLAY_OFFSETS.helmet.offsetY));
            }
            return Promise.all(layers);
        }).then(() => {
            this._onionSkinData = canvas;
        });
    }

    // --- Tile Preview ---
    _toggleTilePreview() {
        this._showTilePreview = !this._showTilePreview;
        document.getElementById('se-toggle-tile').classList.toggle('active', this._showTilePreview);
        document.getElementById('se-status').textContent = this._showTilePreview
            ? 'Tile preview ON — preview shows 3x3 tiled grid'
            : 'Tile preview OFF';
    }

    // --- Reference Image ---
    _toggleRefImage() {
        if (!this._refImage) {
            document.getElementById('se-ref-file').click();
            return;
        }
        this._showRefImage = !this._showRefImage;
        document.getElementById('se-toggle-ref').classList.toggle('active', this._showRefImage);
        document.getElementById('se-status').textContent = this._showRefImage
            ? 'Reference image ON — shown behind canvas at 30% opacity'
            : 'Reference image OFF';
    }

    _loadRefImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                this._refImage = img;
                this._showRefImage = true;
                document.getElementById('se-toggle-ref').classList.add('active');
                document.getElementById('se-status').textContent = `Reference image loaded (${img.width}x${img.height})`;
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    // --- Spritesheet Picker ---
    _openSheetPicker() {
        if (!this.activeObject) {
            document.getElementById('se-status').textContent = 'Select an object from the palette before importing from a spritesheet.';
            return;
        }
        document.getElementById('se-sheet-file').click();
    }

    _loadSheetImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                this._sheetImage = img;
                this._showSheetPicker();
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    _showSheetPicker() {
        const existing = document.getElementById('se-sheet-picker');
        if (existing) existing.remove();

        this._sheetPickerOpen = true;

        const modal = document.createElement('div');
        modal.id = 'se-sheet-picker';
        modal.innerHTML = `
            <div class="se-sheet-picker-content">
                <h3>Spritesheet Picker</h3>
                <div class="se-sheet-info">
                    <span id="se-sheet-status">Drag the sheet to position a sprite under the selection box</span>
                </div>
                <div class="se-sheet-viewport">
                    <canvas id="se-sheet-canvas"></canvas>
                </div>
                <div class="se-sheet-controls">
                    <button id="se-sheet-zoom-in" title="Zoom in">+</button>
                    <button id="se-sheet-zoom-out" title="Zoom out">-</button>
                    <button id="se-sheet-fit" title="Fit sheet to viewport">Fit</button>
                    <span class="bp-sep"></span>
                    <button id="se-sheet-snap" title="Snap to grid (align to canvasSize boundaries)">Snap Grid</button>
                    <span class="bp-sep"></span>
                    <button id="se-sheet-import">Import Selection</button>
                    <button id="se-sheet-cancel">Cancel</button>
                </div>
            </div>
        `;
        this.container.appendChild(modal);

        const viewport = modal.querySelector('.se-sheet-viewport');
        const canvas = document.getElementById('se-sheet-canvas');
        const rect = viewport.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const fitZoom = Math.min(
            (rect.width * 0.8) / this._sheetImage.width,
            (rect.height * 0.8) / this._sheetImage.height
        );
        this._sheetZoom = Math.max(1, Math.round(fitZoom));
        this._sheetPanX = (canvas.width - this._sheetImage.width * this._sheetZoom) / 2;
        this._sheetPanY = (canvas.height - this._sheetImage.height * this._sheetZoom) / 2;
        this._sheetSnapToGrid = false;

        canvas.addEventListener('mousedown', (e) => this._sheetDragStartHandler(e));
        window.addEventListener('mousemove', this._sheetDragMoveRef = (e) => this._sheetDragMoveHandler(e));
        window.addEventListener('mouseup', this._sheetDragEndRef = () => this._sheetDragEndHandler());
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._sheetPickerZoom(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });

        document.getElementById('se-sheet-zoom-in').addEventListener('click', () => this._sheetPickerZoom(1));
        document.getElementById('se-sheet-zoom-out').addEventListener('click', () => this._sheetPickerZoom(-1));
        document.getElementById('se-sheet-fit').addEventListener('click', () => this._sheetPickerFit());
        document.getElementById('se-sheet-snap').addEventListener('click', () => this._sheetToggleSnap());
        document.getElementById('se-sheet-import').addEventListener('click', () => this._sheetPickerImport());
        document.getElementById('se-sheet-cancel').addEventListener('click', () => this._closeSheetPicker());

        this._sheetAnimFrame = requestAnimationFrame(() => this._renderSheetPicker());
    }

    _renderSheetPicker() {
        const canvas = document.getElementById('se-sheet-canvas');
        if (!canvas || !this._sheetPickerOpen) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, w, h);

        ctx.imageSmoothingEnabled = false;
        const imgW = this._sheetImage.width * this._sheetZoom;
        const imgH = this._sheetImage.height * this._sheetZoom;
        ctx.drawImage(this._sheetImage, this._sheetPanX, this._sheetPanY, imgW, imgH);

        if (this._sheetSnapToGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            const gridPx = this.canvasSize * this._sheetZoom;
            const startX = ((this._sheetPanX % gridPx) + gridPx) % gridPx;
            for (let x = startX; x < w; x += gridPx) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            const startY = ((this._sheetPanY % gridPx) + gridPx) % gridPx;
            for (let y = startY; y < h; y += gridPx) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
        }

        const selSize = this.canvasSize * this._sheetZoom;
        const selX = (w - selSize) / 2;
        const selY = (h - selSize) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, w, selY);
        ctx.fillRect(0, selY + selSize, w, h - selY - selSize);
        ctx.fillRect(0, selY, selX, selSize);
        ctx.fillRect(selX + selSize, selY, w - selX - selSize, selSize);

        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(selX, selY, selSize, selSize);

        const srcX = Math.round((selX - this._sheetPanX) / this._sheetZoom);
        const srcY = Math.round((selY - this._sheetPanY) / this._sheetZoom);
        const statusEl = document.getElementById('se-sheet-status');
        if (statusEl) {
            statusEl.textContent = `Sheet: ${this._sheetImage.width}x${this._sheetImage.height} | Selection at (${srcX}, ${srcY}) | Zoom: ${this._sheetZoom}x`;
        }

        this._sheetAnimFrame = requestAnimationFrame(() => this._renderSheetPicker());
    }

    _sheetDragStartHandler(e) {
        if (e.button !== 0) return;
        this._sheetDragging = true;
        this._sheetDragStart = { x: e.clientX, y: e.clientY };
        this._sheetPanStart = { x: this._sheetPanX, y: this._sheetPanY };
    }

    _sheetDragMoveHandler(e) {
        if (!this._sheetDragging) return;
        this._sheetPanX = this._sheetPanStart.x + (e.clientX - this._sheetDragStart.x);
        this._sheetPanY = this._sheetPanStart.y + (e.clientY - this._sheetDragStart.y);
    }

    _sheetDragEndHandler() {
        if (!this._sheetDragging) return;
        this._sheetDragging = false;
        if (this._sheetSnapToGrid) this._sheetSnapPan();
    }

    _sheetSnapPan() {
        const canvas = document.getElementById('se-sheet-canvas');
        if (!canvas) return;
        const selX = (canvas.width - this.canvasSize * this._sheetZoom) / 2;
        const selY = (canvas.height - this.canvasSize * this._sheetZoom) / 2;
        const gridPx = this.canvasSize * this._sheetZoom;
        const offsetX = (this._sheetPanX - selX) % gridPx;
        const offsetY = (this._sheetPanY - selY) % gridPx;
        const snapX = Math.abs(offsetX) < gridPx / 2 ? -offsetX : (offsetX > 0 ? gridPx - offsetX : -(gridPx + offsetX));
        const snapY = Math.abs(offsetY) < gridPx / 2 ? -offsetY : (offsetY > 0 ? gridPx - offsetY : -(gridPx + offsetY));
        this._sheetPanX += snapX;
        this._sheetPanY += snapY;
    }

    _sheetPickerZoom(delta) {
        const canvas = document.getElementById('se-sheet-canvas');
        if (!canvas) return;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const oldZoom = this._sheetZoom;
        let newZoom = oldZoom + delta;
        newZoom = Math.max(1, Math.min(32, newZoom));
        if (newZoom === oldZoom) return;

        const imgX = (cx - this._sheetPanX) / oldZoom;
        const imgY = (cy - this._sheetPanY) / oldZoom;
        this._sheetZoom = newZoom;
        this._sheetPanX = cx - imgX * newZoom;
        this._sheetPanY = cy - imgY * newZoom;
    }

    _sheetPickerFit() {
        const canvas = document.getElementById('se-sheet-canvas');
        if (!canvas) return;
        const fitZoom = Math.min(
            (canvas.width * 0.8) / this._sheetImage.width,
            (canvas.height * 0.8) / this._sheetImage.height
        );
        this._sheetZoom = Math.max(1, Math.round(fitZoom));
        this._sheetPanX = (canvas.width - this._sheetImage.width * this._sheetZoom) / 2;
        this._sheetPanY = (canvas.height - this._sheetImage.height * this._sheetZoom) / 2;
    }

    _sheetToggleSnap() {
        this._sheetSnapToGrid = !this._sheetSnapToGrid;
        const btn = document.getElementById('se-sheet-snap');
        if (btn) btn.classList.toggle('active', this._sheetSnapToGrid);
        if (this._sheetSnapToGrid) this._sheetSnapPan();
    }

    _sheetPickerImport() {
        if (!this._sheetImage) return;
        const canvas = document.getElementById('se-sheet-canvas');
        if (!canvas) return;

        const selSize = this.canvasSize * this._sheetZoom;
        const selX = (canvas.width - selSize) / 2;
        const selY = (canvas.height - selSize) / 2;

        const srcX = (selX - this._sheetPanX) / this._sheetZoom;
        const srcY = (selY - this._sheetPanY) / this._sheetZoom;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvasSize;
        tempCanvas.height = this.canvasSize;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.drawImage(
            this._sheetImage,
            srcX, srcY, this.canvasSize, this.canvasSize,
            0, 0, this.canvasSize, this.canvasSize
        );

        const imageData = tempCtx.getImageData(0, 0, this.canvasSize, this.canvasSize);
        this._pushUndoSnapshot();
        this.pixels = new Uint8ClampedArray(imageData.data);
        this._autoSave();
        this._closeSheetPicker();
        document.getElementById('se-status').textContent =
            `Imported ${this.canvasSize}x${this.canvasSize} region from spritesheet at (${Math.round(srcX)}, ${Math.round(srcY)})`;
    }

    _closeSheetPicker() {
        if (this._sheetAnimFrame) {
            cancelAnimationFrame(this._sheetAnimFrame);
            this._sheetAnimFrame = null;
        }
        if (this._sheetDragMoveRef) {
            window.removeEventListener('mousemove', this._sheetDragMoveRef);
            window.removeEventListener('mouseup', this._sheetDragEndRef);
            this._sheetDragMoveRef = null;
            this._sheetDragEndRef = null;
        }
        const modal = document.getElementById('se-sheet-picker');
        if (modal) modal.remove();
        this._sheetPickerOpen = false;
        this._sheetDragging = false;
    }

    // --- Colonist Variants ---
    _addVariant(group) {
        if (group === 'body') this.bodyVariants++;
        else if (group === 'hair') this.hairVariants++;
        else if (group === 'shirt') this.shirtVariants++;
        this._persistSkinData();
        this._buildPalette();
    }

    _removeVariant(variantKey) {
        // variantKey is like 'colonist_body_2', 'colonist_hair_1', 'colonist_shirt_3'
        const parts = variantKey.split('_');
        const group = parts[1]; // 'body' | 'hair' | 'shirt'
        const num = parseInt(parts[2]);
        const countProp = group === 'body' ? 'bodyVariants' : group === 'hair' ? 'hairVariants' : 'shirtVariants';
        if (!num || num > this[countProp] || this[countProp] <= 1) return;
        delete this.savedSprites[`entities:${variantKey}`];
        for (let i = num; i < this[countProp]; i++) {
            const nextKey = `entities:colonist_${group}_${i + 1}`;
            const curKey = `entities:colonist_${group}_${i}`;
            if (this.savedSprites[nextKey]) {
                this.savedSprites[curKey] = this.savedSprites[nextKey];
            } else {
                delete this.savedSprites[curKey];
            }
        }
        delete this.savedSprites[`entities:colonist_${group}_${this[countProp]}`];
        this[countProp]--;
        if (this.activeObject && this.activeObject.key === variantKey) {
            this.activeObject = null;
            this.pixels = new Uint8ClampedArray(this.canvasSize * this.canvasSize * 4);
            this._updateActiveObjectDisplay();
        }
        this._persistSkinData();
        this._refreshSavedList();
        this._buildPalette();
    }

    // --- Save/Load ---
    _savePNG() {
        if (!this.activeObject) {
            alert('Select an object from the palette first.');
            return;
        }
        const { key, category } = this.activeObject;
        const size = this.canvasSize;

        // Save to localStorage
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');
        const imageData = new ImageData(this.pixels.slice(), size, size);
        tempCtx.putImageData(imageData, 0, 0);

        const dataURL = tempCanvas.toDataURL('image/png');
        this.savedSprites[`${category}:${key}`] = { size, data: dataURL };
        this._persistSkinData();
        this._refreshSavedList();
        this._buildPalette();

        // Trigger download
        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${key}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    async _exportToSkinsFolder() {
        const keys = Object.keys(this.savedSprites);
        if (keys.length === 0) {
            alert('No sprites saved yet.');
            return;
        }

        const zip = new JSZip();
        const manifest = {};

        for (const spriteKey of keys) {
            const { data } = this.savedSprites[spriteKey];
            const [category, key] = spriteKey.split(':');
            const base64 = data.split(',')[1];
            zip.file(`${category}/${key}.png`, base64, { base64: true });
            if (!manifest[category]) manifest[category] = [];
            manifest[category].push(key);
        }

        zip.file('manifest.json', JSON.stringify({ sprites: manifest, bodyVariants: this.bodyVariants, hairVariants: this.hairVariants, shirtVariants: this.shirtVariants }, null, 2));

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.skinName}.skin.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async _importZip(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        if (typeof JSZip === 'undefined') {
            alert('JSZip not loaded.');
            return;
        }

        try {
            const buf = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(buf);

            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                alert('No manifest.json found in zip.');
                return;
            }
            const manifest = JSON.parse(await manifestFile.async('string'));

            let name = file.name.replace(/\.skin\.zip$/i, '').replace(/\.zip$/i, '');
            name = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
            this.skinName = name;
            document.getElementById('se-skin-name').value = name;
            this.savedSprites = {};

            let count = 0;
            for (const [category, keys] of Object.entries(manifest.sprites || {})) {
                for (const key of keys) {
                    const zipFile = zip.file(`${category}/${key}.png`);
                    if (!zipFile) continue;
                    const blob = await zipFile.async('blob');
                    const dataURL = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    const img = await new Promise(resolve => {
                        const i = new Image();
                        i.onload = () => resolve(i);
                        i.onerror = () => resolve(null);
                        i.src = dataURL;
                    });
                    const size = img ? img.width : this.canvasSize;
                    this.savedSprites[`${category}:${key}`] = { size, data: dataURL };
                    count++;
                }
            }

            if (manifest.bodyVariants != null) {
                this.bodyVariants = manifest.bodyVariants;
            } else {
                let v = 0;
                while (this.savedSprites[`entities:colonist_body_${v + 1}`]) v++;
                this.bodyVariants = Math.max(v, this.bodyVariants);
            }
            if (manifest.hairVariants != null) {
                this.hairVariants = manifest.hairVariants;
            } else {
                let v = 0;
                while (this.savedSprites[`entities:colonist_hair_${v + 1}`]) v++;
                this.hairVariants = Math.max(v, this.hairVariants);
            }
            if (manifest.shirtVariants != null) {
                this.shirtVariants = manifest.shirtVariants;
            } else {
                let v = 0;
                while (this.savedSprites[`entities:colonist_shirt_${v + 1}`]) v++;
                this.shirtVariants = Math.max(v, this.shirtVariants);
            }

            this._persistSkinData();
            this._refreshSavedList();
            this._refreshLoadDropdown();
            this._buildPalette();
            this._clearUndoHistory();

            if (this.activeObject) {
                const spriteKey = `${this.activeObject.category}:${this.activeObject.key}`;
                const saved = this.savedSprites[spriteKey];
                if (saved) {
                    this._loadPixelsFromDataURL(saved.data, saved.size);
                } else {
                    this.pixels = new Uint8ClampedArray(this.canvasSize * this.canvasSize * 4);
                }
            }

            const el = document.getElementById('se-status');
            el.textContent = `Imported ${count} sprite(s) from ${file.name}`;
        } catch (err) {
            alert('Failed to import zip: ' + err.message);
        }
    }

    _clearCanvas() {
        if (!confirm('Clear the current sprite?')) return;
        this._pushUndoSnapshot();
        this.pixels = new Uint8ClampedArray(this.canvasSize * this.canvasSize * 4);
        this._autoSave();
    }

    _autoSave() {
        if (!this.activeObject) return;
        const hasContent = this.pixels.some((v, i) => i % 4 === 3 && v > 0);
        const spriteKey = `${this.activeObject.category}:${this.activeObject.key}`;
        if (!hasContent) {
            delete this.savedSprites[spriteKey];
        } else {
            const size = this.canvasSize;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tempCtx = tempCanvas.getContext('2d');
            const imageData = new ImageData(this.pixels.slice(), size, size);
            tempCtx.putImageData(imageData, 0, 0);
            this.savedSprites[spriteKey] = { size, data: tempCanvas.toDataURL('image/png') };
        }
        this._persistSkinData();
    }

    _persistSkinData() {
        const data = { sprites: this.savedSprites, bodyVariants: this.bodyVariants, hairVariants: this.hairVariants, shirtVariants: this.shirtVariants };
        localStorage.setItem(STORAGE_PREFIX + this.skinName, JSON.stringify(data));
    }

    _loadSkinData() {
        const data = localStorage.getItem(STORAGE_PREFIX + this.skinName);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.savedSprites = parsed.sprites || {};
                if (typeof parsed.bodyVariants === 'number') this.bodyVariants = parsed.bodyVariants;
                if (typeof parsed.hairVariants === 'number') this.hairVariants = parsed.hairVariants;
                if (typeof parsed.shirtVariants === 'number') this.shirtVariants = parsed.shirtVariants;
            } catch { /* ignore */ }
        }
    }

    _loadSkinByName(name) {
        this.skinName = name;
        document.getElementById('se-skin-name').value = name;
        this.savedSprites = {};
        this._loadSkinData();
        this._refreshSavedList();
        this._buildPalette();
        if (this.activeObject) {
            const spriteKey = `${this.activeObject.category}:${this.activeObject.key}`;
            const saved = this.savedSprites[spriteKey];
            if (saved) {
                this._loadPixelsFromDataURL(saved.data, saved.size);
            } else {
                this.pixels = new Uint8ClampedArray(this.canvasSize * this.canvasSize * 4);
            }
        }
    }

    _refreshLoadDropdown() {
        const sel = document.getElementById('se-load-skin');
        if (!sel) return;
        const skins = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                skins.push(key.slice(STORAGE_PREFIX.length));
            }
        }
        sel.innerHTML = '<option value="">Load Skin...</option>' +
            skins.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    _refreshSavedList() {
        const el = document.getElementById('se-saved-list');
        if (!el) return;
        const keys = Object.keys(this.savedSprites);
        if (keys.length === 0) {
            el.innerHTML = '<div class="bp-muted">No sprites saved yet</div>';
            return;
        }
        el.innerHTML = keys.map(k => {
            const { data } = this.savedSprites[k];
            const [cat, name] = k.split(':');
            return `<div class="se-saved-item" data-sprite-key="${k}" title="${cat}/${name}">
                <img src="${data}" class="se-saved-thumb">
                <span>${name}</span>
            </div>`;
        }).join('');

        el.querySelectorAll('.se-saved-item').forEach(item => {
            item.addEventListener('click', () => {
                const [cat, key] = item.dataset.spriteKey.split(':');
                this._selectObject(key, cat);
            });
        });
    }

    _goBack() {
        this._commitSelection();
        this.selection = null;
        this._shapePreview = null;
        this._shapeStart = null;
        this.hide();
        document.getElementById('start-screen').style.display = '';
    }
}

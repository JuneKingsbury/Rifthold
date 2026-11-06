import { stampLoc } from '../i18n.js';

// Keyboard bindings for the main game input handler.
//
// DEFAULT_KEYMAP maps a stable *action name* to the list of lowercased key
// strings (matching `KeyboardEvent.key.toLowerCase()`) that trigger it. The
// InputHandler builds a reverse key->action lookup from this (merged with any
// per-user overrides in game.settings.keyBindings) so bindings can be remapped
// at runtime without touching handler code.
//
// Number keys (0-9), Tab and Escape are handled structurally in the input
// handler and are intentionally NOT rebindable here.
export const DEFAULT_KEYMAP = {
    panUp: ['w', 'arrowup'],
    panDown: ['s', 'arrowdown'],
    panLeft: ['a', 'arrowleft'],
    panRight: ['d', 'arrowright'],

    toggleBuild: ['b'],
    toggleZone: ['f'],
    toggleDesignate: ['g'],
    deconstruct: ['x'],

    togglePriority: ['p'],
    toggleCraft: ['c'],
    toggleResearch: ['r'],
    toggleInventory: ['i'],
    toggleArcane: ['v'],
    toggleStory: ['j'],
    toggleMap: ['m'],
    toggleWarmthOverlay: ['h'],
    toggleDefenseOverlay: ['y'],
    toggleRoomOverlay: ['u'],
    toggleAuraOverlay: ['k'],

    pause: [' '],
    speedUp: ['.', '>'],
    speedDown: [',', '<'],
    zoomIn: ['=', '+'],
    zoomOut: ['-'],
    resetMinimap: ['/'],

    cyclePrev: ['['],
    cycleNext: [']'],
    draftToggle: ['q'],
    selectAll: ['e'],
    nextIdle: ['n'],
    centerSelection: ['home'],

    toggleRecordingMode: ['\\'],
    timelapseToggle: ['t'],
};

// Ordered, grouped metadata for the rebinding settings UI. `action` matches a
// key in DEFAULT_KEYMAP; `label` is the human-facing description.
export const KEYBIND_ACTIONS = [
    { items: [
        { action: 'panUp' },
        { action: 'panDown' },
        { action: 'panLeft' },
        { action: 'panRight' },
    ] },
    { items: [
        { action: 'toggleBuild' },
        { action: 'toggleZone' },
        { action: 'toggleDesignate' },
        { action: 'deconstruct' },
    ] },
    { items: [
        { action: 'togglePriority' },
        { action: 'toggleCraft' },
        { action: 'toggleResearch' },
        { action: 'toggleInventory' },
        { action: 'toggleArcane' },
        { action: 'toggleStory' },
        { action: 'toggleMap' },
        { action: 'toggleWarmthOverlay' },
        { action: 'toggleDefenseOverlay' },
        { action: 'toggleRoomOverlay' },
        { action: 'toggleAuraOverlay' },
    ] },
    { items: [
        { action: 'pause' },
        { action: 'speedUp' },
        { action: 'speedDown' },
        { action: 'zoomIn' },
        { action: 'zoomOut' },
        { action: 'resetMinimap' },
        { action: 'toggleRecordingMode' },
        { action: 'timelapseToggle' },
    ] },
    { items: [
        { action: 'cyclePrev' },
        { action: 'cycleNext' },
        { action: 'draftToggle' },
        { action: 'selectAll' },
        { action: 'nextIdle' },
        { action: 'centerSelection' },
    ] },
];
stampLoc({ keybinds: KEYBIND_ACTIONS }, 'config', { fields: ['label', 'group'] });

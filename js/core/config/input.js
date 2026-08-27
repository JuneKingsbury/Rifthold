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
};

// Ordered, grouped metadata for the rebinding settings UI. `action` matches a
// key in DEFAULT_KEYMAP; `label` is the human-facing description.
export const KEYBIND_ACTIONS = [
    { group: 'Movement', items: [
        { action: 'panUp', label: 'Pan up' },
        { action: 'panDown', label: 'Pan down' },
        { action: 'panLeft', label: 'Pan left' },
        { action: 'panRight', label: 'Pan right' },
    ] },
    { group: 'Modes', items: [
        { action: 'toggleBuild', label: 'Build mode' },
        { action: 'toggleZone', label: 'Farm zone mode' },
        { action: 'toggleDesignate', label: 'Gather/designate mode' },
        { action: 'deconstruct', label: 'Deconstruct (in build mode)' },
    ] },
    { group: 'Panels', items: [
        { action: 'togglePriority', label: 'Priorities panel' },
        { action: 'toggleCraft', label: 'Craft panel' },
        { action: 'toggleResearch', label: 'Research panel' },
        { action: 'toggleInventory', label: 'Inventory panel' },
        { action: 'toggleArcane', label: 'Arcane panel' },
        { action: 'toggleStory', label: 'Story panel' },
    ] },
    { group: 'Time & View', items: [
        { action: 'pause', label: 'Pause / unpause' },
        { action: 'speedUp', label: 'Speed up' },
        { action: 'speedDown', label: 'Speed down' },
        { action: 'zoomIn', label: 'Zoom in' },
        { action: 'zoomOut', label: 'Zoom out' },
        { action: 'resetMinimap', label: 'Reset minimap size' },
    ] },
    { group: 'Colonists', items: [
        { action: 'cyclePrev', label: 'Select previous colonist' },
        { action: 'cycleNext', label: 'Select next colonist' },
        { action: 'draftToggle', label: 'Draft / undraft selected' },
        { action: 'selectAll', label: 'Select all colonists' },
        { action: 'nextIdle', label: 'Jump to next idle colonist' },
        { action: 'centerSelection', label: 'Center camera on selection' },
    ] },
];

// Shared keybinding UI helpers used by both the in-game settings panel and the
// start-screen settings panel. The start screen has no Game instance, so these
// helpers read/write bindings directly from localStorage ('colony_settings')
// rather than through game.settings. The in-game panel passes an onApply
// callback so it can additionally re-apply bindings to the live InputHandler.
import { DEFAULT_KEYMAP, KEYBIND_ACTIONS } from '../core/config.js';

const SETTINGS_KEY = 'colony_settings';
// Keys handled structurally by the input handler; not rebindable.
const RESERVED_KEYS = ['tab', 'escape', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function readSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function writeSettings(s) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {}
}

export function getStoredBindings() {
    return readSettings().keyBindings || {};
}

export function setStoredBinding(action, key) {
    const s = readSettings();
    if (!s.keyBindings) s.keyBindings = {};
    s.keyBindings[action] = [key.toLowerCase()];
    writeSettings(s);
}

export function clearStoredBindings() {
    const s = readSettings();
    s.keyBindings = {};
    writeSettings(s);
}

// Remove the override for a single action, reverting it to its DEFAULT_KEYMAP value.
export function resetStoredBinding(action) {
    const s = readSettings();
    if (s.keyBindings) delete s.keyBindings[action];
    writeSettings(s);
}

// The effective keys for an action = its override if present, else the default.
function effectiveKeys(action, overrides) {
    return overrides[action] || DEFAULT_KEYMAP[action] || [];
}

// Build a set of keys that are bound to more than one action across the full
// keymap (conflicts). Keys are compared case-insensitively as stored.
function conflictingKeys(overrides) {
    const counts = {};
    for (const group of KEYBIND_ACTIONS) {
        for (const { action } of group.items) {
            for (const key of effectiveKeys(action, overrides)) {
                counts[key] = (counts[key] || 0) + 1;
            }
        }
    }
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
}

// Human-readable label for a stored key string.
export function formatKeyLabel(key) {
    const names = { ' ': 'Space', 'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→', 'home': 'Home', 'escape': 'Esc', 'tab': 'Tab' };
    if (names[key]) return names[key];
    return key.length === 1 ? key.toUpperCase() : key;
}

export function isReservedKey(key) {
    return RESERVED_KEYS.includes(key.toLowerCase());
}

// Build the grouped keybinding rows. `rebindExpr` is the JS expression string
// placed in each rebind button's inline onclick; it receives the action name and
// the button element, e.g. "window.game.ui._startRebind" or "window.startRebindKey".
// `resetExpr` is the expression for the per-row "Default" button; it receives the
// action name only. A trailing "(...)" call is appended to each automatically.
// Keys bound to more than one action are highlighted in red as conflicts.
export function keybindingRowsHtml(rebindExpr, resetExpr) {
    const overrides = getStoredBindings();
    const conflicts = conflictingKeys(overrides);
    let html = `<div style="color:#888;font-size:10px;margin-bottom:6px;">Click a key, then press the new key. Number keys, Tab and Esc are fixed. <span style="color:#ff6666;">Red</span> = key bound to more than one action.</div>`;
    for (const group of KEYBIND_ACTIONS) {
        html += `<div style="color:#88aaff;font-size:11px;margin:4px 0 2px;">${group.group}</div>`;
        for (const { action, label } of group.items) {
            const keys = effectiveKeys(action, overrides);
            const keyLabel = keys.map(k => formatKeyLabel(k)).join(' / ') || '—';
            const hasConflict = keys.some(k => conflicts.has(k));
            const color = hasConflict ? '#ff6666' : '#ffcc00';
            const border = hasConflict ? '#aa3333' : '#555';
            html += `<div class="settings-row" style="justify-content:space-between;gap:6px;">`;
            html += `<label style="flex:1;">${label}</label>`;
            html += `<button data-rebind-action="${action}"${hasConflict ? ' title="Conflicts with another action"' : ''} onclick="${rebindExpr}('${action}', this)" style="min-width:54px;background:#1a1a2e;color:${color};border:1px solid ${border};border-radius:3px;padding:2px 8px;cursor:pointer;font-family:inherit;">${keyLabel}</button>`;
            html += `<button title="Reset to default" onclick="${resetExpr}('${action}')" style="background:#2a2a3e;color:#aaa;border:1px solid #555;border-radius:3px;padding:2px 6px;cursor:pointer;font-family:inherit;font-size:10px;">Default</button>`;
            html += `</div>`;
        }
    }
    return html;
}

// Capture the next keypress for `action` and persist it. `onApply(action, key)`
// runs after a successful bind (e.g. to re-apply live and re-render). `onError`
// runs when a reserved key is pressed. A pending capture is stored on the module
// so a second click cancels/replaces it.
let _pendingCapture = null;

export function beginRebindCapture(action, btn, onApply, onError) {
    if (_pendingCapture) {
        document.removeEventListener('keydown', _pendingCapture, true);
        _pendingCapture = null;
    }
    const prevLabel = btn.textContent;
    btn.textContent = 'Press…';
    btn.style.color = '#ff8888';
    const capture = (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.removeEventListener('keydown', capture, true);
        _pendingCapture = null;
        const key = e.key.toLowerCase();
        if (isReservedKey(key)) {
            btn.textContent = prevLabel;
            btn.style.color = '#ffcc00';
            if (onError) onError(key);
            return;
        }
        setStoredBinding(action, key);
        if (onApply) onApply(action, key);
    };
    _pendingCapture = capture;
    document.addEventListener('keydown', capture, true);
}

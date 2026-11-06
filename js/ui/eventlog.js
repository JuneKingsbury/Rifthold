import { CONFIG } from '../core/config.js';
import { t, ref } from '../core/i18n.js';

// Log entries are saved with the colony, so they store a locale key and params
// ({ key, params }) and are turned into text only when shown. That way a saved
// log reads in whatever language the player has chosen. Params must be ids or
// raw values; use ref()/defRef()/itemRef() for anything that needs translating.
// A plain string is still accepted (older saves, mods) and is shown as-is.
// The expedition log (ExplorationSystem._addLog) uses the same entry shape.

/** Text of a log entry (event log or expedition log), in the active language. */
export function logEntryText(entry) {
    if (!entry) return '';
    if (entry.key) return t(entry.key, entry.params, entry.text);
    return entry.text ?? '';
}

/** Timestamp of an event log entry, e.g. "Y2 Spring 06:30". */
export function logEntryTime(entry) {
    const time = entry?.time;
    if (!time || typeof time === 'string') return time || '';   // older saves: preformatted English
    const clock = `${String(Math.floor(time.minutes / 60)).padStart(2, '0')}:${String(time.minutes % 60).padStart(2, '0')}`;
    return t('log.timestamp', { year: time.year, season: ref(`season.${time.season}.name`, time.season), time: clock });
}

/**
 * Sets the text fields of a log entry from a message: a string (shown as-is)
 * or { key, params }.
 */
export function setLogMessage(entry, message) {
    if (message && typeof message === 'object') {
        entry.key = message.key;
        if (message.params) entry.params = message.params;
    } else {
        entry.text = message;
    }
    return entry;
}

export class EventLog {
    constructor() {
        this.entries = [];
        this.maxEntries = 50;
    }

    /**
     * @param {object} game
     * @param {string|{key: string, params?: object}} message Log line; see above.
     * @param {string} type 'event' | 'success' | 'danger' | 'info' ...
     * @param {object} [linkedEntity] What clicking the line jumps to.
     */
    add(game, message, type, linkedEntity) {
        // timeOfDay is tick % TICKS_PER_DAY (0 .. TICKS_PER_DAY-1), not a 0-100 value.
        // Map it onto a 24h clock. Dividing by 100 produced hours like 114:00.
        const fractionOfDay = game.timeOfDay / CONFIG.TICKS_PER_DAY;
        const minutes = Math.floor(fractionOfDay * 24 * 60);

        this.entries.push(setLogMessage({
            type,
            time: { year: game.weather.year, season: game.weather.season, minutes },
            tick: game.tick,
            linkedEntity,
        }, message));

        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
    }

    getRecent(count) {
        return this.entries.slice(-count);
    }
}

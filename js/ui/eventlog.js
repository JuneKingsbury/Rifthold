import { CONFIG } from '../core/config.js';

export class EventLog {
    constructor() {
        this.entries = [];
        this.maxEntries = 50;
    }

    add(game, text, type, linkedEntity) {
        // timeOfDay is tick % TICKS_PER_DAY (0 .. TICKS_PER_DAY-1), not a 0-100 value.
        // Map it onto a 24h clock; dividing by 100 produced hours like 114:00.
        const fractionOfDay = game.timeOfDay / CONFIG.TICKS_PER_DAY;
        const totalMinutes = Math.floor(fractionOfDay * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const season = game.weather.season;
        const year = game.weather.year;

        this.entries.push({
            text,
            type,
            time: `Y${year} ${season} ${timeStr}`,
            tick: game.tick,
            linkedEntity,
        });

        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
    }

    getRecent(count) {
        return this.entries.slice(-count);
    }
}

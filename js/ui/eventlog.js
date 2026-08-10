export class EventLog {
    constructor() {
        this.entries = [];
        this.maxEntries = 50;
    }

    add(game, text, type, linkedEntity) {
        const dayProgress = Math.floor((game.timeOfDay / 100) * 24);
        const timeStr = `${String(dayProgress).padStart(2, '0')}:00`;
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

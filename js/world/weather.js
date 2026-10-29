import { CONFIG, GRASS_TERRAIN, PLANT_STRUCTURES, SEASONS, SEASON_EFFECTS, WEATHER_TYPES, SEASON_WEATHER } from '../core/config.js';

export class Weather {
    constructor() {
        this.season = 'spring';
        this.seasonIndex = 0;
        this.seasonTick = 0;
        this.temperature = 15;
        this.currentWeather = 'clear';
        this.weatherTimer = 0;
        this.year = 1;
        this._maybeSnow = true;
    }

    update(tick, divinationModifiers) {
        this.seasonTick++;
        if (this.seasonTick >= CONFIG.TICKS_PER_SEASON) {
            this.seasonTick = 0;
            this.seasonIndex = (this.seasonIndex + 1) % 4;
            this.season = SEASONS[this.seasonIndex];
            if (this.seasonIndex === 0) this.year++;
        }

        const effects = SEASON_EFFECTS[this.season];
        const [minTemp, maxTemp] = effects.tempRange;
        const seasonProgress = this.seasonTick / CONFIG.TICKS_PER_SEASON;
        this.temperature = minTemp + (maxTemp - minTemp) * (0.5 + 0.3 * Math.sin(seasonProgress * Math.PI));
        this.temperature += (Math.random() - 0.5) * 3;

        this.weatherTimer--;
        if (this.weatherTimer <= 0) {
            this.rollWeather(divinationModifiers);
        }
    }

    rollWeather(divinationModifiers) {
        const mods = divinationModifiers || [];
        const weatherBias = mods.find(m => m.weatherBias)?.weatherBias;

        if (weatherBias) {
            this.currentWeather = weatherBias;
            this.weatherTimer = 50 + Math.floor(Math.random() * 100);
            return;
        }

        const table = SEASON_WEATHER[this.season] || [];
        const roll = Math.random();
        let cumulative = 0;
        for (const [type, prob, durRange] of table) {
            cumulative += prob;
            if (roll < cumulative) {
                this.currentWeather = type;
                this.weatherTimer = durRange[0] + Math.floor(Math.random() * (durRange[1] - durRange[0] + 1));
                return;
            }
        }
        this.currentWeather = 'clear';
        this.weatherTimer = 50 + Math.floor(Math.random() * 100);
    }

    getGrowthMultiplier() {
        let mult = SEASON_EFFECTS[this.season].cropGrowthMult;
        const wDef = WEATHER_TYPES[this.currentWeather];
        if (wDef && wDef.growthMult !== undefined) {
            mult *= wDef.growthMult;
        }
        return mult;
    }

    // Updates tile.snowCovered and returns the tiles whose snow state changed
    // ([{x, y}]) so the caller can patch only those. Outside winter the full-map
    // pass runs once to melt everything, then is skipped until snow can return.
    // _maybeSnow starts true (unknown, e.g. right after a load) to force that pass.
    applySnow(map) {
        const changed = [];
        if (this.season === 'winter') {
            this._maybeSnow = true;
            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    const tile = map[y][x];
                    if (!tile.snowCovered && GRASS_TERRAIN.has(tile.terrain) && (!tile.structure || PLANT_STRUCTURES.has(tile.structure)) && !tile.zone) {
                        tile.snowCovered = true;
                        changed.push({ x, y });
                    }
                }
            }
        } else if (this._maybeSnow) {
            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    if (map[y][x].snowCovered) {
                        map[y][x].snowCovered = false;
                        changed.push({ x, y });
                    }
                }
            }
            this._maybeSnow = false;
        }
        return changed;
    }

    getSeasonDisplay() {
        const seasonName = this.season.charAt(0).toUpperCase() + this.season.slice(1);
        return `${seasonName} Y${this.year}`;
    }

    // Current day within the season (1-based) and the season's total day count,
    // derived from the tick constants so it tracks any config change.
    getDayDisplay() {
        const daysPerSeason = Math.max(1, Math.round(CONFIG.TICKS_PER_SEASON / CONFIG.TICKS_PER_DAY));
        const dayOfSeason = Math.min(daysPerSeason, Math.floor(this.seasonTick / CONFIG.TICKS_PER_DAY) + 1);
        return `Day ${dayOfSeason}/${daysPerSeason}`;
    }

    getWeatherDisplay() {
        const wDef = WEATHER_TYPES[this.currentWeather];
        return wDef ? wDef.display : this.currentWeather;
    }
}

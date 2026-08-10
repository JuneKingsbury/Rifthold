import { CONFIG, SEASONS, SEASON_EFFECTS, WEATHER_TYPES, SEASON_WEATHER } from '../core/config.js';

export class Weather {
    constructor() {
        this.season = 'spring';
        this.seasonIndex = 0;
        this.seasonTick = 0;
        this.temperature = 15;
        this.currentWeather = 'clear';
        this.weatherTimer = 0;
        this.year = 1;
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

    applySnow(map) {
        if (this.season === 'winter') {
            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    const tile = map[y][x];
                    if (tile.terrain === 'grass' && !tile.structure && !tile.zone) {
                        tile.snowCovered = true;
                    }
                }
            }
        } else {
            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    map[y][x].snowCovered = false;
                }
            }
        }
    }

    getSeasonDisplay() {
        return `${this.season.charAt(0).toUpperCase() + this.season.slice(1)} Y${this.year}`;
    }

    getWeatherDisplay() {
        const wDef = WEATHER_TYPES[this.currentWeather];
        return wDef ? wDef.display : this.currentWeather;
    }
}

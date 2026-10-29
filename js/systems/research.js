/**
 * Tech tree: tracks completed research and advances the active project's
 * progress. updateResearch is called from simulationTick every 8th tick;
 * completing a project unlocks buildings, crops, and recipes gated on it.
 */
import { RESEARCH, WORK_CONFIG, DEMO_LOCKED_RESEARCH } from '../core/config.js';

export class ResearchSystem {
    constructor() {
        this.completed = new Set();
        this.activeResearch = null;
        this.progress = {};
    }

    isDemoLocked(key) {
        return window.game?.settings?.demoMode && DEMO_LOCKED_RESEARCH.has(key);
    }

    _checkGates(tech) {
        const game = window.game;
        if (!game) return true;

        if (tech.requiresBuildings) {
            for (const [building, count] of Object.entries(tech.requiresBuildings)) {
                if (game.mapIndex.getStructurePositions(building).size < count) return false;
            }
        }

        if (tech.requiresMilestone) {
            const { stat, min } = tech.requiresMilestone;
            if (!game.stats || (game.stats[stat] || 0) < min) return false;
        }

        if (tech.requiresTabCount) {
            let tabCompleted = 0;
            for (const [k, t] of Object.entries(RESEARCH)) {
                if (t.tab === tech.tab && this.completed.has(k)) tabCompleted++;
            }
            if (tabCompleted < tech.requiresTabCount) return false;
        }

        return true;
    }

    getAvailable() {
        const available = [];
        for (const [key, tech] of Object.entries(RESEARCH)) {
            if (this.completed.has(key)) continue;
            if (this.isDemoLocked(key)) continue;
            const prereqsMet = tech.requires.every(r => this.completed.has(r));
            if (!prereqsMet) continue;
            if (!this._checkGates(tech)) continue;
            available.push({ key, ...tech });
        }
        return available;
    }

    hasAvailableResearch() {
        for (const [key, tech] of Object.entries(RESEARCH)) {
            if (this.completed.has(key)) continue;
            if (this.isDemoLocked(key)) continue;
            if (!tech.requires.every(r => this.completed.has(r))) continue;
            if (!this._checkGates(tech)) continue;
            return true;
        }
        return false;
    }

    selectResearch(key) {
        const tech = RESEARCH[key];
        if (!tech || this.completed.has(key)) return false;
        if (this.isDemoLocked(key)) return false;
        if (!tech.requires.every(r => this.completed.has(r))) return false;
        if (!this._checkGates(tech)) return false;
        this.activeResearch = key;
        return true;
    }

    deselectResearch() {
        this.activeResearch = null;
    }

    addProgress(amount) {
        if (!this.activeResearch) return null;
        if (!this.progress[this.activeResearch]) this.progress[this.activeResearch] = 0;
        this.progress[this.activeResearch] += amount;
        const tech = RESEARCH[this.activeResearch];
        if (this.progress[this.activeResearch] >= tech.cost) {
            this.completed.add(this.activeResearch);
            delete this.progress[this.activeResearch];
            const completedKey = this.activeResearch;
            this.activeResearch = null;
            return completedKey;
        }
        return null;
    }

    getProgress(key) {
        return this.progress[key] || 0;
    }

    isResearched(key) {
        return this.completed.has(key);
    }
}

// Desks in row-major map order (stable, so the same desks stay "full" rather
// than diminished). Index lookup: this runs every 8 ticks and from the HUD.
export function findResearchDesks(game) {
    return game.mapIndex.findAll('research_desk').sort((a, b) => a.y - b.y || a.x - b.x);
}

const MAX_FULL_DESKS = 2;

export function updateResearch(game) {
    const desks = findResearchDesks(game);
    if (!desks.length) return;

    let activeCount = 0;
    for (const desk of desks) {
        if (!game.taskQueue.hasTaskTypeAt(desk.x, desk.y, 'research')) {
            const diminished = activeCount >= MAX_FULL_DESKS;
            game.taskQueue.add({
                type: 'research',
                skillRequired: 'research',
                x: desk.x,
                y: desk.y,
                workAmount: WORK_CONFIG.researchWork,
                diminished,
            });
        }
        activeCount++;
    }
}

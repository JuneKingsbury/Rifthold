import { STORY_MILESTONES } from '../core/config.js';

export class StorySystem {
    constructor() {
        this.unlocked = new Map();
        this.viewed = new Set();
    }

    checkMilestone(triggerKey, game) {
        for (const [key, milestone] of Object.entries(STORY_MILESTONES)) {
            if (milestone.trigger !== triggerKey) continue;
            if (this.unlocked.has(key)) continue;
            this.unlocked.set(key, {
                year: game.weather.year,
                season: game.weather.season,
            });
            game.notifications.push({ text: 'New story entry unlocked!', tick: game.tick, type: 'event' });
            game.eventLog.add(game, `Story unlocked: ${milestone.title}`, 'event', null);
            return true;
        }
        return false;
    }

    hasUnviewed() {
        for (const key of this.unlocked.keys()) {
            if (!this.viewed.has(key)) return true;
        }
        return false;
    }

    markAllViewed() {
        for (const key of this.unlocked.keys()) {
            this.viewed.add(key);
        }
    }

    checkPopulation(game) {
        const alive = game.colonists.filter(c => c.hp > 0 && !c.golem).length;
        if (alive >= 5) this.checkMilestone('colonist_count_5', game);
        if (alive >= 10) this.checkMilestone('colonist_count_10', game);
    }
}

/**
 * Divination omens: turns the colony's passive future state (scheduled raids,
 * upcoming season, current weather spell, event pressure) into a readable set of
 * prophecies for the Rifts > Omens tab. The clarity of each omen scales with the
 * colony's best Divination skill level: a novice sees vague hunches, a master
 * reads exact timings. Purely a read of live game state, no side effects.
 */
import { CONFIG, RAID_CONFIG } from '../core/config.js';

// Divination clarity tiers keyed off the best diviner's school level. Higher
// tiers reveal finer timing detail and unlock more omen categories.
const CLARITY = [
    { minLevel: 1, key: 'faint',    label: 'Faint',    raidWindow: true,  weather: false, seasonHint: true,  events: false },
    { minLevel: 3, key: 'clear',    label: 'Clear',    raidWindow: true,  weather: true,  seasonHint: true,  events: true },
    { minLevel: 6, key: 'profound', label: 'Profound', raidWindow: false, weather: true,  seasonHint: true,  events: true },
];

/**
 * The highest Divination level across living, non-golem colonists.
 *
 * @param {object} game Game instance.
 * @return {number} Best divination level (0 if no diviner present).
 */
export function getBestDivinationLevel(game) {
    let best = 0;
    for (const c of game.colonists) {
        if (c.hp <= 0 || c.golem) continue;
        const lvl = (c.magicSkills && c.magicSkills.divination) || 0;
        if (lvl > best) best = lvl;
    }
    return best;
}

// Resolve the clarity tier for a given divination level (null below level 1).
function clarityFor(level) {
    let tier = null;
    for (const c of CLARITY) {
        if (level >= c.minLevel) tier = c;
    }
    return tier;
}

// Convert a tick count into a coarse "soon / a while / far off" phrase or, at high
// clarity, an approximate day count. days = ticks / TICKS_PER_DAY.
function describeDelay(ticks, exact) {
    if (ticks <= 0) return 'imminent';
    const days = ticks / CONFIG.TICKS_PER_DAY;
    if (exact) {
        if (days < 1) return 'within a day';
        return `in about ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
    }
    if (days < 2) return 'very soon';
    if (days < 5) return 'before long';
    return 'in the distance';
}

/**
 * Build the list of omens visible to the colony at its current divination level.
 * Each omen is { icon, title, text, tone } where tone is 'good'|'bad'|'neutral'.
 *
 * @param {object} game Game instance.
 * @return {{ level: number, tier: (object|null), omens: object[] }}
 */
export function getOmens(game) {
    const level = getBestDivinationLevel(game);
    const tier = clarityFor(level);
    const omens = [];
    if (!tier) return { level, tier: null, omens };

    // Raid foresight. The exact timing is only legible at lower "windowed" tiers;
    // profound seers instead sense the *shape* of the coming assault.
    if (game.combat && !game.combat.raidActive && !CONFIG.PEACEFUL_MODE) {
        const ticksUntil = game.combat.nextRaidTick - game.tick;
        const exact = level >= 6;
        if (ticksUntil > 0) {
            omens.push({
                icon: '⚔',
                title: 'A Gathering Threat',
                text: `Raiders will descend upon the colony ${describeDelay(ticksUntil, exact)}.`,
                tone: 'bad',
            });
        }
    }

    // The scripted crusader assault (year 10 spring) is a fixed prophecy any seer feels.
    if (game.combat && !game.combat.crusaderRaidDefeated && !game.combat.crusaderRaidTriggered) {
        if (game.weather.year >= 8) {
            omens.push({
                icon: '✝',
                title: 'The Crusade Comes',
                text: 'A crusader host marches from the kingdom. It will arrive in the spring of the tenth year.',
                tone: 'bad',
            });
        }
    }

    // Seasonal turning. Everyone with the sight feels the wheel turn.
    if (tier.seasonHint) {
        const ticksLeft = CONFIG.TICKS_PER_SEASON - game.weather.seasonTick;
        const nextIdx = (game.weather.seasonIndex + 1) % 4;
        const nextSeason = ['spring', 'summer', 'autumn', 'winter'][nextIdx];
        omens.push({
            icon: '❂',
            title: 'The Turning Season',
            text: `${cap(nextSeason)} approaches, ${describeDelay(ticksLeft, level >= 6)}.`,
            tone: 'neutral',
        });
    }

    // Weather-shaping divinations currently in effect (Fair Winds etc).
    if (tier.weather) {
        const mods = game.divinationModifiers || [];
        const biasMod = mods.find(m => m.weatherBias);
        if (biasMod) {
            omens.push({
                icon: '☀',
                title: 'Skies Bent to Will',
                text: `A divination holds the skies ${biasMod.weatherBias} for now.`,
                tone: 'good',
            });
        }
    }

    // Event-pressure omens: active divination modifiers that court or ward events.
    if (tier.events) {
        const mods = game.divinationModifiers || [];
        for (const m of mods) {
            if (m.eventBoost === 'caravan') {
                omens.push({ icon: '☼', title: 'Merchants on the Wind', text: 'Traders are drawn toward the colony. Expect a caravan soon.', tone: 'good' });
            } else if (m.eventBoost === 'meteorite') {
                omens.push({ icon: '★', title: 'A Falling Fortune', text: 'The heavens will soon shed a gift upon the land.', tone: 'good' });
            }
            if (m.suppressEvents && m.suppressEvents.length > 0) {
                omens.push({ icon: '⛨', title: 'Calamity Warded', text: 'Ill fortunes are held at bay by an active ward.', tone: 'good' });
            }
        }
    }

    return { level, tier, omens };
}

function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Human-readable resource names for scry hints (falls back to the raw key).
const RESOURCE_LABELS = {
    stone: 'stone', runite: 'runite', void_essence: 'void essence',
    wood: 'timber', herbs: 'herbs', crystal: 'crystal',
};

function resourceLabel(key) {
    return RESOURCE_LABELS[key] || key.replace(/_/g, ' ');
}

/**
 * Generate a single scry hint about a realm: one revealed "modifier" (a rich
 * loot vein, an elite presence, a lurking guardian, a rare cache, or a teeming
 * horde) drawn from that realm's own config. The hint is a one-shot reveal, not
 * a spawn change: it tells the player what the rift already holds. Which hint is
 * chosen is random at scry time; the caller persists the result so it stays
 * consistent until the party launches.
 *
 * @param {object} dim   A REALMS entry (the target realm's config).
 * @param {number} level Best divination level (higher unlocks finer detail).
 * @return {{ icon: string, title: string, text: string, tone: string }|null}
 */
export function generateRealmScry(dim, level) {
    if (!dim) return null;
    const candidates = [];

    // Rich vein: name the realm's most abundant resource drop.
    const resourceLoot = (dim.loot || []).filter(l => l.resource && l.amount);
    if (resourceLoot.length > 0) {
        const richest = resourceLoot.reduce((a, b) => (b.amount[1] || 0) > (a.amount[1] || 0) ? b : a);
        candidates.push({
            weight: 3,
            hint: {
                icon: '⛏', title: 'A Rich Vein', tone: 'good',
                text: `The scrying pool shows veins of ${resourceLabel(richest.resource)} running rich through this rift.`,
            },
        });
    }

    // Rare cache: a rare loot item lies waiting somewhere in the realm.
    const rareItems = (dim.events?.rare || []).filter(r => r.loot?.item);
    if (rareItems.length > 0) {
        candidates.push({
            weight: 2,
            hint: {
                icon: '✦', title: 'A Hidden Cache', tone: 'good',
                text: 'A rare treasure lies hidden here, waiting to be found.',
            },
        });
    }

    // Lurking guardian: the realm has a boss. Higher clarity reveals its phases.
    if (dim.boss) {
        const phaseNote = level >= 3 && dim.boss.phases
            ? ` It will shift through ${dim.boss.phases.length} forms before it falls.`
            : '';
        candidates.push({
            weight: 2,
            hint: {
                icon: '☠', title: 'A Lurking Guardian', tone: 'bad',
                text: `A great ${dim.boss.name || 'guardian'} slumbers in the depths of this rift.${phaseNote}`,
            },
        });
    }

    // Elite presence: harder realms are likelier to field elite foes.
    if ((dim.difficulty || 1) >= 2) {
        candidates.push({
            weight: 2,
            hint: {
                icon: '★', title: 'Elite Presence', tone: 'bad',
                text: 'The vision flickers with dread. Elite creatures prowl this rift.',
            },
        });
    }

    // Teeming horde: the realm can spawn large enemy packs.
    const maxCount = dim.enemies?.count?.[1] || 0;
    if (maxCount >= 4) {
        candidates.push({
            weight: 2,
            hint: {
                icon: '⚔', title: 'A Teeming Horde', tone: 'bad',
                text: 'You glimpse the rift swarming. Expect foes in great number.',
            },
        });
    }

    if (candidates.length === 0) return null;

    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) return c.hint;
    }
    return candidates[candidates.length - 1].hint;
}

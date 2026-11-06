/**
 * Divination omens: turns the colony's passive future state (scheduled raids,
 * upcoming season, current weather spell, event pressure) into a readable set of
 * prophecies for the Rifts > Omens tab. The clarity of each omen scales with the
 * colony's best Divination skill level: a novice sees vague hunches, a master
 * reads exact timings. Purely a read of live game state, no side effects.
 */
import { CONFIG, RAID_CONFIG, WEATHER_TYPES } from '../core/config.js';
import { t, tp, ref, defRef } from '../core/i18n.js';

// Divination clarity tiers keyed off the best diviner's school level. Higher
// tiers reveal finer timing detail and unlock more omen categories.
const CLARITY = [
    { minLevel: 1, key: 'faint',    label: t('msg.omens.clarity_faint'),    raidWindow: true,  weather: false, seasonHint: true,  events: false },
    { minLevel: 3, key: 'clear',    label: t('msg.omens.clarity_clear'),    raidWindow: true,  weather: true,  seasonHint: true,  events: true },
    { minLevel: 6, key: 'profound', label: t('msg.omens.clarity_profound'), raidWindow: false, weather: true,  seasonHint: true,  events: true },
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

// The raid omen's sentence: a coarse "soon / a while / far off" phrase or, at high
// clarity, an approximate day count. days = ticks / TICKS_PER_DAY.
function describeRaid(ticks, exact) {
    if (ticks <= 0) return t('msg.omens.raid_imminent');
    const days = ticks / CONFIG.TICKS_PER_DAY;
    if (exact) {
        if (days < 1) return t('msg.omens.raid_within_day');
        return tp('msg.omens.raid_in_days', Math.round(days));
    }
    if (days < 2) return t('msg.omens.raid_very_soon');
    if (days < 5) return t('msg.omens.raid_before_long');
    return t('msg.omens.raid_distant');
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
                title: t('msg.omens.raid_title'),
                text: describeRaid(ticksUntil, exact),
                tone: 'bad',
            });
        }
    }

    if (game.combat && game.combat.crusaderRaidArmed &&
        !game.combat.crusaderRaidDefeated && !game.combat.crusaderRaidTriggered) {
        omens.push({
            icon: '✝',
            title: t('msg.omens.crusade_title'),
            text: t('msg.omens.crusade_text'),
            tone: 'bad',
        });
    }

    // Foresight: a raidDelay modifier means the spell is actively deferring the next assault.
    const allMods = game.divinationModifiers || [];
    const delayMod = allMods.find(m => m.raidDelay);
    if (delayMod) {
        omens.push({
            icon: '✦',
            title: t('msg.omens.forestalled_title'),
            text: t('msg.omens.forestalled_text'),
            tone: 'good',
        });
    }

    // Weather-shaping divinations currently in effect (Fair Winds etc).
    if (tier.weather) {
        const mods = game.divinationModifiers || [];
        const biasMod = mods.find(m => m.weatherBias);
        if (biasMod) {
            omens.push({
                icon: '☀',
                title: t('msg.omens.skies_title'),
                text: t('msg.omens.skies_text', { weather: weatherWord(biasMod.weatherBias) }),
                tone: 'good',
            });
        }
    }

    // Event-pressure omens: active divination modifiers that court or ward events.
    if (tier.events) {
        const mods = game.divinationModifiers || [];
        for (const m of mods) {
            if (m.eventBoost === 'caravan') {
                omens.push({ icon: '☼', title: t('msg.omens.merchants_title'), text: t('msg.omens.merchants_text'), tone: 'good' });
            } else if (m.eventBoost === 'meteorite') {
                omens.push({ icon: '★', title: t('msg.omens.fortune_title'), text: t('msg.omens.fortune_text'), tone: 'good' });
            }
            if (m.suppressEvents && m.suppressEvents.length > 0) {
                omens.push({ icon: '⛨', title: t('msg.omens.warded_title'), text: t('msg.omens.warded_text'), tone: 'good' });
            }
        }

        // Augury: scan colonists for an active mood aura cast by a spell.
        const auguryActive = game.colonists.some(c =>
            c.hp > 0 && !c.golem &&
            (c.activeEffects || []).some(e => e.type === 'mood' && e.source === 'spell' && e.expiresAt > game.tick)
        );
        if (auguryActive) {
            omens.push({
                icon: '♦',
                title: t('msg.omens.blessed_title'),
                text: t('msg.omens.blessed_text'),
                tone: 'good',
            });
        }
    }

    return { level, tier, omens };
}

function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// The weather a Fair Winds bias leans toward, lowercase as it sits mid-sentence.
// Falls back to the weather type's own name, then the raw key.
function weatherWord(key) {
    return t(`msg.omens.weather.${key}`, null, WEATHER_TYPES[key]?.name ?? key);
}

// Scry hint wording for a resource, as a log/save param (lowercase, mid-sentence;
// "timber" rather than "wood"). Falls back to the key with spaces.
function resourceLabelRef(key) {
    return ref(`msg.omens.resource.${key}`, key.replace(/_/g, ' '));
}

/**
 * Display title of a scry hint. Hints are saved (exploration.realmScries), so new
 * ones keep keys and params; older saves have finished `title`/`text` strings.
 *
 * @param {object} hint A hint from generateRealmScry.
 * @return {string}
 */
export function scryTitle(hint) {
    if (hint?.titleKey) return t(hint.titleKey);
    return hint?.title ?? '';
}

/** Display text of a scry hint (see scryTitle). */
export function scryText(hint) {
    if (hint?.textKey) return t(hint.textKey, hint.params);
    return hint?.text ?? '';
}

// A saved hint: keys and params, plus the text in the current language for
// readers that still show `title`/`text` directly.
function scryHint(icon, tone, name, params) {
    const titleKey = `msg.omens.scry_${name}_title`;
    const textKey = `msg.omens.scry_${name}_text`;
    const hint = { icon, tone, titleKey, textKey };
    if (params) hint.params = params;
    hint.title = scryTitle(hint);
    hint.text = scryText(hint);
    return hint;
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
            hint: () => scryHint('⛏', 'good', 'rich_vein', { resource: resourceLabelRef(richest.resource) }),
        });
    }

    // Rare cache: a rare loot item lies waiting somewhere in the realm.
    const rareItems = (dim.events?.rare || []).filter(r => r.loot?.item);
    if (rareItems.length > 0) {
        candidates.push({
            weight: 2,
            hint: () => scryHint('✦', 'good', 'hidden_cache'),
        });
    }

    // Lurking guardian: the realm has a boss. Higher clarity reveals its phases.
    if (dim.boss) {
        const boss = dim.boss.name ? defRef(dim.boss) : ref('msg.omens.scry_guardian_fallback');
        const phases = level >= 3 && dim.boss.phases;
        candidates.push({
            weight: 2,
            hint: () => (phases
                ? scryHint('☠', 'bad', 'guardian_phases', { boss, n: dim.boss.phases.length })
                : scryHint('☠', 'bad', 'guardian', { boss })),
        });
    }

    // Elite presence: harder realms are likelier to field elite foes.
    if ((dim.difficulty || 1) >= 2) {
        candidates.push({
            weight: 2,
            hint: () => scryHint('★', 'bad', 'elite'),
        });
    }

    // Teeming horde: the realm can spawn large enemy packs.
    const maxCount = dim.enemies?.count?.[1] || 0;
    if (maxCount >= 4) {
        candidates.push({
            weight: 2,
            hint: () => scryHint('⚔', 'bad', 'horde'),
        });
    }

    if (candidates.length === 0) return null;

    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) return c.hint();
    }
    return candidates[candidates.length - 1].hint();
}

/**
 * Colonist relationships: nearby colonists periodically interact, shifting
 * pairwise opinions that roll up into named relationship tiers and mood thoughts
 * (see THOUGHTS / SOCIAL_CONFIG). SocialSystem.update is called every simulation
 * tick but self-throttles: opinion decay and the interaction scan are gated on
 * SOCIAL_CONFIG intervals, and each colonist pair has an interaction cooldown.
 */
import { SOCIAL_INTERACTIONS, SOCIAL_CONFIG, THOUGHTS, TRAITS, GROUP_ACTIVITIES } from '../core/config.js';
import { getRelationshipTier } from './social-utils.js';
import { applyThought } from '../entities/colonist.js';
import { manhattanDist } from '../world/pathfinding.js';
import { t, defText } from '../core/i18n.js';

export { getRelationshipTier };

function getOpinion(colonist, otherId) {
    return colonist.opinions?.[otherId] ?? 0;
}

function setOpinion(colonist, otherId, value) {
    if (!colonist.opinions) colonist.opinions = {};
    colonist.opinions[otherId] = Math.max(-100, Math.min(100, value));
}

function weightedRandom(interactions) {
    const total = interactions.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const interaction of interactions) {
        r -= interaction.weight;
        if (r <= 0) return interaction;
    }
    return interactions[interactions.length - 1];
}

function checkRelationshipChange(colonist, other, prevTierKey, game) {
    const newOpinion = getOpinion(colonist, other.id);
    const newTier = getRelationshipTier(newOpinion);
    const newTierKey = newTier.key;

    if (!colonist.relationships) colonist.relationships = {};
    const storedTier = colonist.relationships[other.id] || 'stranger';

    if (newTierKey === storedTier) return;

    // Prevent either side from ending up with multiple lovers. If the computed tier
    // would be 'lovers' but colonist OR other already has a different lover, cap at
    // close_friend. Checking both sides here prevents the force-mutual write below
    // from bypassing the cap on the other colonist.
    let effectiveTierKey = newTierKey;
    if (newTierKey === 'lovers') {
        const colonistHasOtherLover = Object.entries(colonist.relationships || {}).some(([id, t]) => t === 'lovers' && id !== String(other.id));
        const otherHasOtherLover = Object.entries(other.relationships || {}).some(([id, t]) => t === 'lovers' && id !== String(colonist.id));
        if (colonistHasOtherLover || otherHasOtherLover) effectiveTierKey = 'close_friend';
    }

    colonist.relationships[other.id] = effectiveTierKey;

    // Milestone thoughts and notifications
    if (effectiveTierKey === 'friend' && (storedTier === 'stranger' || storedTier === 'acquaintance')) {
        applyThought(colonist, 'made_friend', game.tick);
        game.notifications.push({ text: t('msg.social.became_friends', { a: colonist.name, b: other.name }), tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: t('msg.social.float_friends'), color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: t('msg.social.float_friends'), color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.story.checkMilestone('first_friend_made', game);
    } else if (effectiveTierKey === 'close_friend' && storedTier !== 'lovers') {
        game.notifications.push({ text: t('msg.social.became_close_friends', { a: colonist.name, b: other.name }), tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: t('msg.social.float_close_friends'), color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: t('msg.social.float_close_friends'), color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (effectiveTierKey === 'lovers') {
        // Force mutual lovers: set the other side immediately so both always match.
        if (!other.relationships) other.relationships = {};
        const otherHadLovers = Object.values(other.relationships).includes('lovers');
        other.relationships[colonist.id] = 'lovers';

        applyThought(colonist, 'fell_in_love', game.tick);
        applyThought(other, 'fell_in_love', game.tick);
        if (!otherHadLovers) {
            game.notifications.push({ text: t('msg.social.fell_in_love', { a: colonist.name, b: other.name }), tick: game.tick, type: 'success' });
            game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: t('msg.social.float_lovers'), color: '#ff88cc', fontSize: 11, ttl: 15, maxTtl: 15 });
            game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: t('msg.social.float_lovers'), color: '#ff88cc', fontSize: 11, ttl: 15, maxTtl: 15 });
            game.story.checkMilestone('first_lover_made', game);
        }
    } else if (effectiveTierKey === 'rival') {
        applyThought(colonist, 'became_rivals', game.tick);
        if (storedTier === 'friend' || storedTier === 'close_friend' || storedTier === 'lovers') {
            applyThought(colonist, 'friendship_ended', game.tick);
        }
        game.notifications.push({ text: t('msg.social.became_rivals', { a: colonist.name, b: other.name }), tick: game.tick, type: 'danger' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: t('msg.social.float_rivals'), color: '#ff4444', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: t('msg.social.float_rivals'), color: '#ff4444', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'adversary') {
        applyThought(colonist, 'became_adversaries', game.tick);
        if (storedTier === 'friend' || storedTier === 'close_friend' || storedTier === 'lovers') {
            applyThought(colonist, 'friendship_ended', game.tick);
        }
        game.notifications.push({ text: t('msg.social.became_adversaries', { a: colonist.name, b: other.name }), tick: game.tick, type: 'danger' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: t('msg.social.float_adversaries'), color: '#ff9d34', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: t('msg.social.float_adversaries'), color: '#ff9d34', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'stranger' && (storedTier === 'friend' || storedTier === 'close_friend' || storedTier === 'lovers')) {
        applyThought(colonist, 'friendship_ended', game.tick);
    }
}

// Scale an interaction's opinion delta by the actor's social traits. Charismatic
// boosts positive deltas. Abrasive deepens negative ones. Valence 0 is untouched.
function scaleOpinionDelta(colonist, interaction) {
    let delta = interaction.opinionDelta;
    if (interaction.opinionDelta > 0 && colonist.traits?.includes('charismatic')) {
        delta *= TRAITS.charismatic.positiveInteractionMult;
    } else if (interaction.opinionDelta < 0 && colonist.traits?.includes('abrasive')) {
        delta *= TRAITS.abrasive.negativeInteractionMult;
    }
    return Math.round(delta);
}

function applyInteraction(a, b, interaction, game) {
    const prevTierA = getRelationshipTier(getOpinion(a, b.id)).key;
    const prevTierB = getRelationshipTier(getOpinion(b, a.id)).key;

    // Average both colonists' trait-scaled deltas so opinions always move by the
    // same amount and can never diverge into one-sided tiers. Charismatic/abrasive
    // traits still influence the outcome; they just do so symmetrically.
    const sharedDelta = Math.round((scaleOpinionDelta(a, interaction) + scaleOpinionDelta(b, interaction)) / 2);
    setOpinion(a, b.id, getOpinion(a, b.id) + sharedDelta);
    setOpinion(b, a.id, getOpinion(b, a.id) + sharedDelta);

    if (interaction.thoughtKey && THOUGHTS[interaction.thoughtKey]) {
        applyThought(a, interaction.thoughtKey, game.tick);
        applyThought(b, interaction.thoughtKey, game.tick);
    }

    const text = defText(interaction, 'text', { a: a.name, b: b.name });
    game.notifications.push({ text, tick: game.tick, type: interaction.type });

    // Chat bubbles above both colonists
    const bubbleText = interaction.valence > 0 ? ':)' : interaction.valence < 0 ? ':(' : '...';
    const bubbleColor = interaction.valence > 0 ? '#44ff88' : interaction.valence < 0 ? '#ff4444' : '#aaaaaa';
    game.overlays.push({ type: 'chat_bubble', x: a.x, y: a.y, text: bubbleText, color: bubbleColor, ttl: 25, maxTtl: 25 });
    game.overlays.push({ type: 'chat_bubble', x: b.x, y: b.y, text: bubbleText, color: bubbleColor, ttl: 25, maxTtl: 25 });

    checkRelationshipChange(a, b, prevTierA, game);
    checkRelationshipChange(b, a, prevTierB, game);
}

export class SocialSystem {
    update(game) {
        const decayDue = game.tick % SOCIAL_CONFIG.opinionDecayInterval === 0;
        const checkDue = game.tick % SOCIAL_CONFIG.checkInterval === 0;
        if (!decayDue && !checkDue) return;
        const colonists = game.colonists.filter(c => c.hp > 0 && !c.onExpedition && !c.golem);

        // Passive opinion decay
        if (decayDue) {
            for (const c of colonists) {
                if (!c.opinions) continue;
                for (const id of Object.keys(c.opinions)) {
                    const val = c.opinions[id];
                    if (val > 0) c.opinions[id] = Math.max(0, val - SOCIAL_CONFIG.opinionDecayAmount);
                    else if (val < 0) c.opinions[id] = Math.min(0, val + SOCIAL_CONFIG.opinionDecayAmount);
                }
            }
        }

        if (!checkDue) return;

        for (let i = 0; i < colonists.length; i++) {
            for (let j = i + 1; j < colonists.length; j++) {
                const a = colonists[i];
                const b = colonists[j];

                // Check cooldown
                const cooldownKey = Math.min(a.id, b.id) + '_' + Math.max(a.id, b.id);
                if (!game._socialCooldowns) game._socialCooldowns = {};
                if (game._socialCooldowns[cooldownKey] && game.tick < game._socialCooldowns[cooldownKey]) continue;

                if (manhattanDist(a.x, a.y, b.x, b.y) > SOCIAL_CONFIG.interactionRange) continue;

                // Group activity: both are hanging out together at the Town Hall.
                // Runs a stronger bonding interaction at an elevated chance with a
                // shorter cooldown, turning the hall into a relationship engine.
                const bothHangingOut = a._relaxActivity === 'hang_out' && b._relaxActivity === 'hang_out';
                if (bothHangingOut) {
                    if (Math.random() > SOCIAL_CONFIG.groupActivityChance) continue;
                    const activity = weightedRandom(GROUP_ACTIVITIES);
                    applyInteraction(a, b, activity, game);
                    game._socialCooldowns[cooldownKey] = game.tick + SOCIAL_CONFIG.groupActivityCooldown;
                    continue;
                }

                // Compute chance with trait modifiers
                let chanceA = SOCIAL_CONFIG.baseInteractionChance;
                let chanceB = SOCIAL_CONFIG.baseInteractionChance;
                if (a.traits.includes('socialite')) chanceA *= SOCIAL_CONFIG.socialiteChanceMult;
                if (a.traits.includes('loner')) chanceA *= SOCIAL_CONFIG.lonerChanceMult;
                if (b.traits.includes('socialite')) chanceB *= SOCIAL_CONFIG.socialiteChanceMult;
                if (b.traits.includes('loner')) chanceB *= SOCIAL_CONFIG.lonerChanceMult;
                const chance = (chanceA + chanceB) / 2;

                if (Math.random() > chance) continue;

                const interaction = weightedRandom(SOCIAL_INTERACTIONS);
                applyInteraction(a, b, interaction, game);
                game._socialCooldowns[cooldownKey] = game.tick + SOCIAL_CONFIG.interactionCooldown;
            }
        }
    }
}

/**
 * Colonist relationships: nearby colonists periodically interact, shifting
 * pairwise opinions that roll up into named relationship tiers and mood thoughts
 * (see THOUGHTS / SOCIAL_CONFIG). SocialSystem.update is called every simulation
 * tick but self-throttles: opinion decay and the interaction scan are gated on
 * SOCIAL_CONFIG intervals, and each colonist pair has an interaction cooldown.
 */
import { SOCIAL_INTERACTIONS, SOCIAL_CONFIG, THOUGHTS } from '../core/config.js';
import { getRelationshipTier } from './social-utils.js';
import { addThought } from '../entities/colonist.js';
import { manhattanDist } from '../world/pathfinding.js';

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

    colonist.relationships[other.id] = newTierKey;

    // Milestone thoughts and notifications
    if (newTierKey === 'friend' && (storedTier === 'stranger' || storedTier === 'acquaintance')) {
        addThought(colonist, THOUGHTS.made_friend.text, THOUGHTS.made_friend.moodEffect, THOUGHTS.made_friend.duration, game.tick);
        game.notifications.push({ text: `${colonist.name} and ${other.name} became friends!`, tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Friends!', color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: 'Friends!', color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'close_friend' && storedTier !== 'lovers') {
        game.notifications.push({ text: `${colonist.name} and ${other.name} are now close friends!`, tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Close Friends!', color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: 'Close Friends!', color: '#44ff88', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'lovers') {
        addThought(colonist, THOUGHTS.fell_in_love.text, THOUGHTS.fell_in_love.moodEffect, THOUGHTS.fell_in_love.duration, game.tick);
        game.notifications.push({ text: `${colonist.name} has fallen in love with ${other.name}!`, tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Lovers!', color: '#ff88cc', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: 'Lovers!', color: '#ff88cc', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'rival') {
        addThought(colonist, THOUGHTS.became_rivals.text, THOUGHTS.became_rivals.moodEffect, THOUGHTS.became_rivals.duration, game.tick);
        if (storedTier === 'friend' || storedTier === 'close_friend' || storedTier === 'lovers') {
            addThought(colonist, THOUGHTS.friendship_ended.text, THOUGHTS.friendship_ended.moodEffect, THOUGHTS.friendship_ended.duration, game.tick);
        }
        game.notifications.push({ text: `${colonist.name} and ${other.name} have become rivals!`, tick: game.tick, type: 'danger' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Rivals!', color: '#ff4444', fontSize: 11, ttl: 15, maxTtl: 15 });
        game.overlays.push({ type: 'floating_text', x: other.x, y: other.y, text: 'Rivals!', color: '#ff4444', fontSize: 11, ttl: 15, maxTtl: 15 });
    } else if (newTierKey === 'stranger' && (storedTier === 'friend' || storedTier === 'close_friend' || storedTier === 'lovers')) {
        addThought(colonist, THOUGHTS.friendship_ended.text, THOUGHTS.friendship_ended.moodEffect, THOUGHTS.friendship_ended.duration, game.tick);
    }
}

function applyInteraction(a, b, interaction, game) {
    const prevTierA = getRelationshipTier(getOpinion(a, b.id)).key;
    const prevTierB = getRelationshipTier(getOpinion(b, a.id)).key;

    setOpinion(a, b.id, getOpinion(a, b.id) + interaction.opinionDelta);
    setOpinion(b, a.id, getOpinion(b, a.id) + interaction.opinionDelta);

    if (interaction.thoughtKey && THOUGHTS[interaction.thoughtKey]) {
        const t = THOUGHTS[interaction.thoughtKey];
        addThought(a, t.text, t.moodEffect, t.duration, game.tick);
        addThought(b, t.text, t.moodEffect, t.duration, game.tick);
    }

    const text = interaction.text
        .replace('{a}', a.name)
        .replace('{b}', b.name);
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
        const colonists = game.colonists.filter(c => c.hp > 0 && !c.onExpedition);

        // Passive opinion decay
        if (game.tick % SOCIAL_CONFIG.opinionDecayInterval === 0) {
            for (const c of colonists) {
                if (!c.opinions) continue;
                for (const id of Object.keys(c.opinions)) {
                    const val = c.opinions[id];
                    if (val > 0) c.opinions[id] = Math.max(0, val - SOCIAL_CONFIG.opinionDecayAmount);
                    else if (val < 0) c.opinions[id] = Math.min(0, val + SOCIAL_CONFIG.opinionDecayAmount);
                }
            }
        }

        if (game.tick % SOCIAL_CONFIG.checkInterval !== 0) return;

        for (let i = 0; i < colonists.length; i++) {
            for (let j = i + 1; j < colonists.length; j++) {
                const a = colonists[i];
                const b = colonists[j];

                // Check cooldown
                const cooldownKey = Math.min(a.id, b.id) + '_' + Math.max(a.id, b.id);
                if (!game._socialCooldowns) game._socialCooldowns = {};
                if (game._socialCooldowns[cooldownKey] && game.tick < game._socialCooldowns[cooldownKey]) continue;

                if (manhattanDist(a.x, a.y, b.x, b.y) > SOCIAL_CONFIG.interactionRange) continue;

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

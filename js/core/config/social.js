/**
 * Social simulation data: colonist mood thoughts, relationship tiers, the
 * weighted table of pairwise interactions, and the tuning knobs that gate how
 * often colonists interact and how opinions decay. Consumed by the social
 * system (js/systems/social.js) and colonist mood code. Re-exported through
 * the config hub (index.js) so consumers import from '../core/config.js'.
 */

export const THOUGHTS = {
    built_something:   { text: 'Built something', moodEffect: 3, duration: 100 },
    good_work:         { text: 'Good honest work', moodEffect: 2, duration: 80 },
    harvested:         { text: 'Harvested crops', moodEffect: 3, duration: 100 },
    crafted:           { text: 'Crafted something', moodEffect: 4, duration: 120 },
    cooked:            { text: 'Cooked a meal', moodEffect: 3, duration: 100 },
    tamed_animal:      { text: 'Tamed an animal', moodEffect: 6, duration: 150 },
    put_out_fire:      { text: 'Put out a fire', moodEffect: 5, duration: 150 },
    repaired:          { text: 'Repaired a structure', moodEffect: 3, duration: 100 },
    deconstructed:     { text: 'Tore something down', moodEffect: 2, duration: 80 },
    new_colonist:      { text: 'New colonist arrived', moodEffect: 5, duration: 200 },
    freezing:          { text: 'Freezing outside', moodEffect: -8, duration: 50 },
    fire_panic:        { text: 'Colony on fire!', moodEffect: -20, duration: 200 },
    crops_died:        { text: 'Crops died', moodEffect: -15, duration: 300 },
    cold_snap:         { text: 'Freezing cold snap', moodEffect: -12, duration: 300 },
    inspired:          { text: 'Feeling inspired!', moodEffect: 25, duration: 300 },
    food_spoiled:      { text: 'Food is rotting', moodEffect: -5, duration: 150 },
    learned_spell:     { text: 'Learned a new spell!', moodEffect: 8, duration: 200 },
    cast_spell:        { text: 'Cast a spell', moodEffect: 3, duration: 80 },
    tame_failed:       { text: 'Failed taming attempt!', moodEffect: -8, duration: 150 },
    wolf_retaliated:   { text: 'Wolf attacked during taming!', moodEffect: -12, duration: 200 },
    // Social thoughts
    made_friend:       { text: 'Made a new friend!', moodEffect: 12, duration: 300 },
    became_rivals:     { text: 'Made an enemy', moodEffect: -10, duration: 250 },
    good_conversation: { text: 'Had a nice chat', moodEffect: 4, duration: 80 },
    had_argument:      { text: 'Had an argument', moodEffect: -6, duration: 120 },
    fell_in_love:      { text: 'Found love!', moodEffect: 20, duration: 500 },
    friendship_ended:  { text: 'Lost a friend', moodEffect: -8, duration: 200 },
    acquaintance_died: { text: 'Someone I knew has died', moodEffect: -20, duration: 1500 },
    friend_died:       { text: 'A friend has died', moodEffect: -60, duration: 3000 },
    close_friend_died: { text: 'A close friend has died', moodEffect: -80, duration: 4000 },
    rival_died:        { text: 'A rival has died', moodEffect: 5, duration: 500 },
    lover_died:        { text: 'My love has died', moodEffect: -100, duration: 5000 },
};

export const RELATIONSHIP_TIERS = [
    { key: 'rival',        minOpinion: -100, name: 'Rival',        color: '#ff4444' },
    { key: 'stranger',     minOpinion: -25,  name: 'Stranger',     color: '#888888' },
    { key: 'acquaintance', minOpinion: 15,   name: 'Acquaintance', color: '#aaaaaa' },
    { key: 'friend',       minOpinion: 40,   name: 'Friend',       color: '#44cc44' },
    { key: 'close_friend', minOpinion: 65,   name: 'Close Friend', color: '#44aaff' },
    { key: 'lovers',       minOpinion: 85,   name: 'Lovers',       color: '#ff88cc' },
];

export const SOCIAL_INTERACTIONS = [
    { key: 'pleasant_chat',   text: '{a} and {b} had a pleasant chat.',       weight: 40, opinionDelta: 5,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'shared_meal',     text: '{a} and {b} shared a meal together.',    weight: 30, opinionDelta: 8,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'helped_work',     text: '{a} helped {b} with their work.',        weight: 25, opinionDelta: 10, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'funny_story',     text: '{a} told {b} a funny story.',            weight: 25, opinionDelta: 4,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'encouraged',      text: '{a} and {b} encouraged each other.',     weight: 20, opinionDelta: 7,  thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'nodded',          text: '{a} and {b} exchanged a nod.',           weight: 15, opinionDelta: 1,  thoughtKey: null,                type: 'info',    valence: 0 },
    { key: 'disagreement',    text: '{a} and {b} had a disagreement.',        weight: 10, opinionDelta: -8, thoughtKey: 'had_argument',      type: 'warning', valence: -1 },
    { key: 'argument',        text: '{a} and {b} argued loudly.',             weight: 6,  opinionDelta: -15,thoughtKey: 'had_argument',      type: 'warning', valence: -1 },
    { key: 'annoyed',         text: '{a} got on {b}\'s nerves.',              weight: 8,  opinionDelta: -5, thoughtKey: null,                type: 'warning', valence: -1 },
];

export const SOCIAL_CONFIG = {
    checkInterval: 15,
    interactionRange: 6,
    baseInteractionChance: 0.12,
    socialiteChanceMult: 1.8,
    lonerChanceMult: 0.3,
    interactionCooldown: 200,
    opinionDecayInterval: 500,
    opinionDecayAmount: 1,
};

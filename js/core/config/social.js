/**
 * Social simulation data: colonist mood thoughts, relationship tiers, the
 * weighted table of pairwise interactions, and the tuning knobs that gate how
 * often colonists interact and how opinions decay. Consumed by the social
 * system (js/systems/social.js) and colonist mood code. Re-exported through
 * the config hub (index.js) so consumers import from '../core/config.js'.
 */

import { stampLoc } from '../i18n.js';

export const THOUGHTS = {
    built_something:   { moodEffect: 3, duration: 100 },
    good_work:         { moodEffect: 2, duration: 80 },
    harvested:         { moodEffect: 3, duration: 100 },
    crafted:           { moodEffect: 4, duration: 120 },
    cooked:            { moodEffect: 3, duration: 100 },
    tamed_animal:      { moodEffect: 6, duration: 150 },
    repaired:          { moodEffect: 3, duration: 100 },
    deconstructed:     { moodEffect: 2, duration: 80 },
    new_colonist:      { moodEffect: 5, duration: 200 },
    unwanted:          { moodEffect: -10, duration: 20 },
    freezing:          { moodEffect: -8, duration: 50 },
    overheating:       { moodEffect: -6, duration: 80 },
    crops_died:        { moodEffect: -15, duration: 250 },
    cold_snap:         { moodEffect: -12, duration: 300 },
    inspired:          { moodEffect: 25, duration: 300 },
    food_spoiled:      { moodEffect: -5, duration: 150 },
    learned_spell:     { moodEffect: 8, duration: 200 },
    cast_spell:        { moodEffect: 3, duration: 80 },
    tame_failed:       { moodEffect: -8, duration: 150 },
    wolf_retaliated:   { moodEffect: -12, duration: 200 },
    fed_animal:        { moodEffect: 3, duration: 100 },
    animal_died:       { moodEffect: -8, duration: 150 },
    pet_died:          { moodEffect: -15, duration: 300 },
    animal_escaped:    { moodEffect: -5, duration: 150 },
    // Relaxation thoughts
    relaxed:           { moodEffect: 4, duration: 200 },
    hung_out:          { moodEffect: 8, duration: 250 },
    stargazed:         { moodEffect: 6, duration: 220 },
    cloud_watched:     { moodEffect: 5, duration: 200 },
    strolled:          { moodEffect: 3, duration: 150 },
    warmed_by_fire:    { moodEffect: 6, duration: 200 },
    people_watched:    { moodEffect: 5, duration: 200 },
    skipped_stones:    { moodEffect: 5, duration: 200 },
    smelled_flowers:   { moodEffect: 5, duration: 200 },
    // Ambient mood events
    enjoyed_weather:   { moodEffect: 6, duration: 400 },
    saw_shooting_star: { moodEffect: 8, duration: 400 },
    found_trinket:     { moodEffect: 5, duration: 350 },
    // Arrival-bond thoughts (a wanderer arrives already knowing someone here)
    reunited_friend:   { moodEffect: 10, duration: 300 },
    reunited_rival:    { moodEffect: -8, duration: 250 },
    // Social thoughts
    made_friend:       { moodEffect: 12, duration: 300 },
    became_adversaries:{ moodEffect: -5, duration: 150 },
    became_rivals:     { moodEffect: -10, duration: 250 },
    good_conversation: { moodEffect: 4, duration: 120 },
    had_argument:      { moodEffect: -6, duration: 120 },
    fell_in_love:      { moodEffect: 20, duration: 500 },
    friendship_ended:  { moodEffect: -8, duration: 200 },
    acquaintance_died: { moodEffect: -20, duration: 1500 },
    friend_died:       { moodEffect: -60, duration: 3000 },
    close_friend_died: { moodEffect: -80, duration: 4000 },
    rival_died:        { moodEffect: 5, duration: 500 },
    lover_died:        { moodEffect: -100, duration: 5000 },
    // Text-only thoughts: the caller supplies the mood effect and duration,
    // usually from a trait or COLONIST_CONFIG value.
    fresh_start:          {  },
    destroyed_bloom:      {  },
    void_knows_name:      {  },
    saw_beyond_veil:      {  },
    feel_off:             {  },
    pet_rabbit_near:      {  },
    pet_tapir_near:       {  },
    soothed_by_animal:    {  },
    colonist_died:        {  },
    enjoying_company:     {  },
    feeling_lonely:       {  },
    peaceful_solitude:    {  },
    too_crowded:          {  },
    relaxing:             {  },
    restless_idle:        {  },
    comforted_by_animals: {  },
    restless_indoors:     {  },
    at_home_outdoors:     {  },
    rattled_alone:        {  },
    ate_meal:             {  },
    delicious_meal:       {  },
    ate_raw_food:         {  },
    starving:             {  },
    slept_in_room:        {  },
    slept_in_bed:         {  },
    slept_on_ground:      {  },
    won_fight:            {  },
    winter_feast:         {  },
    blight_fields:        {  },
    blight_rooted:        {  },
};
stampLoc(THOUGHTS, 'thought');

export const RELATIONSHIP_TIERS = [
    { key: 'rival',        minOpinion: -75,  color: '#ff4444' },
    { key: 'adversary',    minOpinion: -50,  color: '#ff9d34' },
    { key: 'stranger',     minOpinion: -25,  color: '#888888' },
    { key: 'acquaintance', minOpinion: 15,   color: '#aaaaaa' },
    { key: 'friend',       minOpinion: 40,   color: '#44cc44' },
    { key: 'close_friend', minOpinion: 65,   color: '#44aaff' },
    { key: 'lovers',       minOpinion: 85,   color: '#ff88cc' },
];
stampLoc(RELATIONSHIP_TIERS, 'relationship_tier');

// Two-colonist activities that run when both are hanging out together at the
// Town Hall. Larger opinion deltas than passive interactions make the hall a
// relationship engine, not just a mood pad. Consumed by social.js (SocialSystem).
export const GROUP_ACTIVITIES = [
    { key: 'played_game',   weight: 30, opinionDelta: 14, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'told_stories',  weight: 28, opinionDelta: 12, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'shared_drink',  weight: 22, opinionDelta: 16, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'sang_together', weight: 20, opinionDelta: 13, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
];
stampLoc(GROUP_ACTIVITIES, 'group_activity');

export const SOCIAL_INTERACTIONS = [
    { key: 'pleasant_chat',   weight: 40, opinionDelta: 5,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'shared_meal',     weight: 30, opinionDelta: 8,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'helped_work',     weight: 25, opinionDelta: 10, thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'funny_story',     weight: 25, opinionDelta: 4,  thoughtKey: 'good_conversation', type: 'info',    valence: 1 },
    { key: 'encouraged',      weight: 20, opinionDelta: 7,  thoughtKey: 'good_conversation', type: 'success', valence: 1 },
    { key: 'nodded',          weight: 15, opinionDelta: 1,  thoughtKey: null,                type: 'info',    valence: 0 },
    { key: 'disagreement',    weight: 10, opinionDelta: -8, thoughtKey: 'had_argument',      type: 'warning', valence: -1 },
    { key: 'argument',        weight: 6,  opinionDelta: -15,thoughtKey: 'had_argument',      type: 'warning', valence: -1 },
    { key: 'annoyed',         weight: 8,  opinionDelta: -5, thoughtKey: null,                type: 'warning', valence: -1 },
];
stampLoc(SOCIAL_INTERACTIONS, 'social_interaction');

export const SOCIAL_CONFIG = {
    checkInterval: 15,
    interactionRange: 4,
    baseInteractionChance: 0.12,
    socialiteChanceMult: 1.8,
    lonerChanceMult: 0.3,
    interactionCooldown: 200,
    opinionDecayInterval: 500,
    opinionDecayAmount: 1,
    // Group activities: when both colonists of a pair are hanging out at the Town
    // Hall, they run a GROUP_ACTIVITIES interaction at this (higher) chance instead
    // of a normal one, building bonds faster. Shorter cooldown so the hall stays lively.
    groupActivityChance: 0.5,
    groupActivityCooldown: 120,
};

// A newly-arrived wanderer has a chance to already know one existing colonist,
// arriving with a pre-set mutual opinion. Adds instant social texture at zero
// ongoing cost. Consumed by events.js resolveWanderer. `chance` gates whether a
// bond forms at all; when it does, one of `bonds` is picked by weight.
export const ARRIVAL_BONDS = {
    chance: 0.4,
    bonds: [
        { key: 'old_friend',      weight: 5, opinion: 55,  thoughtKey: 'reunited_friend' },
        { key: 'close_friend',    weight: 2, opinion: 70,  thoughtKey: 'reunited_friend' },
        { key: 'estranged',       weight: 3, opinion: -55, thoughtKey: 'reunited_rival' },
        { key: 'bitter_rival',    weight: 1, opinion: -70, thoughtKey: 'reunited_rival' },
    ],
};
stampLoc({ arrival_bonds: ARRIVAL_BONDS }, 'config');

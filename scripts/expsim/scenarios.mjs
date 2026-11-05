// Party building blocks and a random scenario generator for the expedition sim.

export const GEAR = {
    1: { melee: 'stone_spear', ranged: 'short_bow', staff: 'wooden_wand', armor: 'leather_vest', robe: 'leather_vest', helmet: 'leather_cap', boots: 'leather_boots' },
    2: { melee: 'iron_sword', ranged: 'hunting_bow', staff: 'crystal_staff', armor: 'iron_chainmail', robe: 'enchanted_tunic', helmet: 'iron_helmet', boots: 'iron_greaves' },
    3: { melee: 'runic_blade', ranged: 'runic_crossbow', staff: 'ashen_staff', armor: 'runic_plate', robe: 'mana_weave_robe', helmet: 'runic_helm', boots: 'striders_greaves' },
    4: { melee: 'void_edge', ranged: 'void_recurve', staff: 'void_wand', armor: 'void_armor', robe: 'voidweave_robes', helmet: 'void_crown', boots: 'void_treads' },
    5: { melee: 'abyssal_greatsword', ranged: 'abyssal_longbow', staff: 'abyssal_staff', armor: 'armor_of_the_abyss', robe: 'voidweave_robes', helmet: 'commanders_crown', boots: 'void_treads' },
};

// Spells by role and rough power tier (1..3).
export const SPELLBOOK = {
    evoker:   { 1: ['spark', 'smite'], 2: ['magic_missile', 'hex_bolt', 'smite'], 3: ['fireball', 'chain_lightning', 'magic_missile'] },
    healer:   { 1: ['mend'], 2: ['mend', 'fortify', 'mending_aura'], 3: ['renewal', 'chain_heal', 'shield'] },
    summoner: { 1: ['summon_familiar', 'phase_step'], 2: ['summon_ghost', 'conjure_decoy'], 3: ['summon_monster', 'spectral_swarm'] },
};

export const ROLES = ['melee', 'melee', 'ranged', 'evoker', 'healer', 'summoner', 'tank'];

/** A colonist spec for a role at a gear tier. */
export function member(role, tier, name) {
    const g = GEAR[tier];
    const spellTier = Math.min(3, Math.max(1, tier - 1));
    switch (role) {
        case 'melee':  return { name, weapon: g.melee, armor: g.armor, helmet: g.helmet, boots: g.boots };
        case 'tank':   return { name, weapon: g.melee, armor: g.armor, helmet: tier >= 4 ? 'commanders_crown' : g.helmet, boots: g.boots, trinket: tier >= 3 ? 'iron_clad_effigy' : null };
        case 'ranged': return { name, weapon: g.ranged, armor: g.robe, helmet: g.helmet, boots: g.boots };
        case 'evoker': case 'healer': case 'summoner': {
            const spells = SPELLBOOK[role][spellTier];
            const school = role === 'evoker' ? 'evocation' : role === 'healer' ? 'abjuration' : 'conjuration';
            return { name, weapon: g.staff, armor: g.robe, helmet: g.helmet, boots: g.boots, spells, magic: { [school]: spellTier * 2 + 1 } };
        }
    }
    throw new Error(role);
}

export const REALM_TIER = {
    wild_frontiers: 1, crystal_caves: 1, verdant_depths: 1, arcane_library: 1,
    crystal_mines: 2, fungal_hollows: 2, ancient_university: 2,
    crystal_depths: 3, primeval_canopy: 3, abandoned_laboratory: 3, shadow_realm: 3,
    void_hollow: 3, fracture_gate: 3,
    void_abyss: 4, void_sanctum: 4, shifting_labyrinth: 4, kingdom_outskirts: 4, crusader_barracks: 4,
    oblivion_rift: 5, void_heart: 5, unraveling_core: 5, palace_fortress: 5,
};

const POTION_KEYS = ['health_potion', 'battle_tonic', 'smoke_draught', 'lifesteal_elixir', 'rally_brew', 'antidote', 'mana_potion'];

function ri(a, b, rnd) { return a + Math.floor(rnd() * (b - a + 1)); }

/** A seeded PRNG so a sweep's scenario list is reproducible. */
export function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/** One random but plausible scenario. */
export function randomScenario(rnd) {
    const realms = Object.keys(REALM_TIER);
    const realm = realms[ri(0, realms.length - 1, rnd)];
    const rt = REALM_TIER[realm];
    const size = ri(1, 5, rnd);
    const party = [];
    const back = [];
    const tierBase = Math.min(5, Math.max(1, rt + ri(-1, 1, rnd)));
    for (let i = 0; i < size; i++) {
        const role = ROLES[ri(0, ROLES.length - 1, rnd)];
        const tier = Math.min(5, Math.max(1, tierBase + (rnd() < 0.25 ? ri(-1, 1, rnd) : 0)));
        party.push({ ...member(role, tier, `M${i}`), _role: role, _tier: tier });
        if (['ranged', 'evoker', 'healer', 'summoner'].includes(role) && rnd() < 0.6 && back.length < 3) back.push(i);
    }
    const beasts = [];
    const nb = rnd() < 0.5 ? 0 : ri(1, 2, rnd);
    for (let i = 0; i < nb; i++) beasts.push({ type: rnd() < 0.5 ? 'wolf' : 'boar', level: ri(0, 5, rnd) });
    const potions = {};
    if (rnd() < 0.6) {
        for (const k of POTION_KEYS) if (rnd() < 0.3) potions[k] = ri(1, 3, rnd);
    }
    const difficulty = rnd() < 0.6 ? 1 : ri(2, 3, rnd);
    return { realm, difficulty, party, back, beasts, potions };
}

// One-factor-at-a-time: from a base party, change one thing and report how the
// simulated win rate and remaining HP move, next to what the estimator predicts.
//   node scripts/expsim/factors.mjs [runs=400]
import { trial } from './harness.mjs';
import { member } from './scenarios.mjs';

const runs = Number(process.argv[2] || 400);

const BASES = {
    'mid: 2x T2 melee, Crystal Mines': { realm: 'crystal_mines', tier: 2, party: ['melee', 'melee'] },
    'boss: 3x T3 melee, Primeval Canopy': { realm: 'primeval_canopy', tier: 3, party: ['melee', 'melee', 'melee'] },
    'late: 3x T4 melee, Void Abyss': { realm: 'void_abyss', tier: 4, party: ['melee', 'melee', 'melee'] },
};

function build(b, mod = {}) {
    const roles = [...b.party, ...(mod.add || [])];
    const party = roles.map((r, i) => member(r, i === 0 && mod.leadTier ? mod.leadTier : (mod.tier || b.tier), `M${i}`));
    if (mod.patch) mod.patch(party);
    const back = mod.back ? roles.map((r, i) => i).filter(i => !['melee', 'tank'].includes(roles[i])) : [];
    return { realm: b.realm, difficulty: mod.difficulty || 1, party, back, beasts: mod.beasts || [], potions: mod.potions || {} };
}

const VARIANTS = [
    ['base', {}],
    ['+1 melee', { add: ['melee'] }],
    ['+1 tank', { add: ['tank'] }],
    ['+1 ranged', { add: ['ranged'] }],
    ['+1 ranged (back row)', { add: ['ranged'], back: true }],
    ['+1 evoker', { add: ['evoker'] }],
    ['+1 evoker (back row)', { add: ['evoker'], back: true }],
    ['+1 healer', { add: ['healer'] }],
    ['+1 healer (back row)', { add: ['healer'], back: true }],
    ['+1 summoner', { add: ['summoner'] }],
    ['+1 wolf', { beasts: ['wolf'] }],
    ['+2 wolves', { beasts: ['wolf', 'wolf'] }],
    ['+1 boar', { beasts: ['boar'] }],
    ['+5 health potions', { potions: { health_potion: 5 } }],
    ['+3 battle tonic', { potions: { battle_tonic: 3 } }],
    ['+3 smoke draught', { potions: { smoke_draught: 3 } }],
    ['+3 lifesteal elixir', { potions: { lifesteal_elixir: 3 } }],
    ['+3 rally brew', { potions: { rally_brew: 3 } }],
    ['all gear +1 tier', { tierUp: 1 }],
    ['weapons +1 tier', { patch: null, weaponUp: true }],
    ['armor +1 tier', { armorUp: true }],
    ['difficulty 2', { difficulty: 2 }],
];

import { GEAR } from './scenarios.mjs';
for (const [bname, b] of Object.entries(BASES)) {
    console.log(`\n## ${bname}`);
    console.log('variant | sim win | est | HP left | deaths');
    for (const [vname, v] of VARIANTS) {
        const mod = { ...v };
        if (v.tierUp) mod.tier = Math.min(5, b.tier + 1);
        const up = GEAR[Math.min(5, b.tier + 1)];
        if (v.weaponUp) mod.patch = party => party.forEach(p => { p.weapon = up.melee; });
        if (v.armorUp) mod.patch = party => party.forEach(p => { p.armor = up.armor; p.helmet = up.helmet; p.boots = up.boots; });
        const r = trial(build(b, mod), runs);
        console.log(`${vname} | ${(r.winRate * 100).toFixed(0)}% | ${(r.est * 100).toFixed(0)}% | ${(r.avgHpLeft * 100).toFixed(0)}% | ${r.avgDeaths.toFixed(2)}`);
    }
}

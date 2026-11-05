// Tries candidate balance tweaks by patching config at runtime, then measures the
// simulated win rate before and after. Nothing is written to config files.
//   node --no-warnings scripts/expsim/tweaks.mjs [runs=300]
import { CFG, trial } from './harness.mjs';
import { member } from './scenarios.mjs';

const runs = Number(process.argv[2] || 300);
const pct = r => `${Math.round(r.winRate * 100)}%`.padStart(4);
const party = (roles, tier, patch) => roles.map((r, i) => ({ ...member(r, tier, `M${i}`), ...(patch?.[i] || {}) }));

// Applies `fn` (which mutates config), runs `measure`, then restores config.
function withTweak(fn, measure) {
    const saved = structuredClone({ p: CFG.EXPEDITION_POTIONS, d: CFG.EXPEDITION_DIFFICULTY, w: CFG.ALL_ITEMS, s: CFG.SUMMON_TYPES, b: CFG.ANIMAL_XP_CONFIG.levelBonuses.warBeast });
    fn();
    try { return measure(); } finally {
        Object.assign(CFG.EXPEDITION_POTIONS, saved.p);
        Object.assign(CFG.EXPEDITION_DIFFICULTY, saved.d);
        for (const k of Object.keys(saved.w)) CFG.ALL_ITEMS[k] = saved.w[k];
        Object.assign(CFG.SUMMON_TYPES, saved.s);
        Object.assign(CFG.ANIMAL_XP_CONFIG.levelBonuses.warBeast, saved.b);
    }
}

const MID = { realm: 'crystal_mines', party: party(['melee', 'melee'], 2) };
const BOSS = { realm: 'primeval_canopy', party: party(['melee', 'melee', 'melee'], 3) };
const LATE = { realm: 'void_abyss', party: party(['melee', 'melee', 'melee'], 4) };
const BASES = { MID, BOSS, LATE };

function potionRow(label) {
    const cells = [];
    for (const [bn, b] of Object.entries(BASES)) {
        const base = trial(b, runs);
        const row = [`${bn} base ${pct(base)}`];
        for (const k of ['battle_tonic', 'smoke_draught', 'lifesteal_elixir', 'rally_brew', 'health_potion']) {
            const n = k === 'health_potion' ? 3 : 3;
            row.push(`${k.replace(/_.*/, '')}+${n} ${pct(trial({ ...b, potions: { [k]: n } }, runs))}`);
        }
        cells.push(row.join(' | '));
    }
    console.log(`\n### potions: ${label}`);
    for (const c of cells) console.log(c);
}

console.log(`runs per cell: ${runs}`);
potionRow('current');
withTweak(() => {
    const P = CFG.EXPEDITION_POTIONS;
    P.battle_tonic.autoUse = { hpThreshold: 1.0 }; // any fight; the re-drink guard keeps it to one per buff
    P.battle_tonic.effect.buffCombat.duration = 12;
    P.smoke_draught.effect.buffDefense.duration = 12;
    P.lifesteal_elixir.effect.buffCombat.duration = 12;
}, () => potionRow('tonic any fight, buff durations 5 -> 12 rounds'));

// Weapons: same party, swap weapon only.
console.log('\n### weapons (3x T2 melee kit in Crystal Mines, weapon swapped)');
const weaponRow = () => {
    const out = [];
    for (const w of ['iron_sword', 'tempered_blade', 'etched_axe', 'etched_mace', 'war_axe']) {
        out.push(`${w} ${pct(trial({ realm: 'crystal_mines', difficulty: 2, party: party(['melee', 'melee', 'melee'], 2, [{ weapon: w }, { weapon: w }, { weapon: w }]) }, runs))}`);
    }
    for (const w of ['void_edge', 'sovereign_blade', 'fracture_edge', 'abyssal_greatsword', 'abyssal_blade']) {
        out.push(`${w} ${pct(trial({ realm: 'void_abyss', party: party(['melee', 'melee', 'melee', 'tank'], 4, [{ weapon: w }, { weapon: w }, { weapon: w }]) }, runs))}`);
    }
    console.log(out.join(' | '));
};
weaponRow();
withTweak(() => {
    // Slow non-cleave melee weapons: damage per tick matches the tier's 3-tick
    // blade, +10% for the overkill a big hit wastes. Colonists copy items from
    // ALL_ITEMS (built from WEAPONS at load), so that's the table to patch.
    const blade = { 2: 18, 3: 28, 4: 36, 5: 50 };
    for (const w of Object.values(CFG.ALL_ITEMS)) {
        const cd = w.attackCooldown || 3;
        if (w.type !== 'weapon' || w.ranged || w.cleave || w.spellDamageBonus || !blade[w.tier] || cd < 4) continue;
        w.damage = Math.max(w.damage, Math.round(blade[w.tier] * cd / 3 * 1.1));
    }
}, () => { console.log('slow melee weapons at damage-per-tick parity +10%:'); weaponRow(); });

// War beasts: level scaling.
console.log('\n### war beasts (lvl 5 wolf x2)');
const beastRow = () => console.log(Object.entries(BASES).map(([bn, b]) =>
    `${bn} ${pct(trial(b, runs))} -> ${pct(trial({ ...b, beasts: [{ type: 'wolf', level: 5 }, { type: 'wolf', level: 5 }] }, runs))}`).join(' | '));
beastRow();
withTweak(() => {
    const B = CFG.ANIMAL_XP_CONFIG.levelBonuses.warBeast;
    for (const lv of Object.keys(B)) { B[lv].hpBonus *= 2; B[lv].damageBonus = 3; }
}, () => { console.log('level bonuses: HP x2, +3 dmg/level:'); beastRow(); });

// Summons: scale with the late game.
console.log('\n### summoner (+1 T4 summoner to LATE)');
const sumRow = () => console.log(`LATE +summoner ${pct(trial({ ...LATE, party: [...LATE.party, member('summoner', 4, 'S')] }, runs))}  vs +evoker ${pct(trial({ ...LATE, party: [...LATE.party, member('evoker', 4, 'E')] }, runs))}`);
sumRow();
withTweak(() => {
    const S = CFG.SUMMON_TYPES;
    S.monster.hp = 90; S.monster.damage = 30; S.spectral_wisp.hp = 18; S.spectral_wisp.damage = 8;
}, () => { console.log('monster 60/20 -> 90/30, wisp 12/5 -> 18/8:'); sumRow(); });

// Difficulty curve: a party that's comfortable at difficulty 1.
console.log('\n### difficulty curve (parties that are comfortable at difficulty 1)');
const COMFY = [
    ['3x T2 Crystal Mines', { realm: 'crystal_mines', party: party(['melee', 'melee', 'melee'], 2) }],
    ['4x T3 Primeval Canopy', { realm: 'primeval_canopy', party: party(['melee', 'tank', 'evoker', 'healer'], 3) }],
    ['4x T4 Void Abyss', { realm: 'void_abyss', party: party(['melee', 'tank', 'evoker', 'evoker'], 4) }],
];
const diffRow = () => { for (const [n, sc] of COMFY) console.log(`${n}: ` + [1, 2, 3].map(d => `d${d} ${pct(trial({ ...sc, difficulty: d }, runs))}`).join(' ')); };
diffRow();
withTweak(() => {
    const D = CFG.EXPEDITION_DIFFICULTY;
    Object.assign(D[2], { enemyHpMult: 1.15, enemyDmgMult: 1.1, enemyCountMult: 1.15, extraEncounters: 0 });
    Object.assign(D[3], { enemyHpMult: 1.35, enemyDmgMult: 1.25, enemyCountMult: 1.3, extraEncounters: 1 });
}, () => { console.log('gentler d2/d3:'); diffRow(); });

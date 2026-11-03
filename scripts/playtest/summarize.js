// Summarizes playtest runs: a milestone timeline per run, where colonist time
// went, stalls, pauses and deaths, plus a side-by-side table of all runs.
//
//   node scripts/playtest/summarize.js [run dir ...]     (default: every run in out/)
//
// Writes nothing; prints Markdown to stdout.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
const dirs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(OUT).map(d => path.join(OUT, d)).filter(d => fs.existsSync(path.join(d, 'summary.json')));

const MIN_PER_DAY_1X = 480 * 0.2 / 60; // 480 ticks of 200 ms
const fmtDay = (d) => d === undefined || d === null ? '-' : `d${(+d).toFixed(1)}`;
const realTime = (d) => d === undefined || d === null ? '' : ` (${Math.round(d * MIN_PER_DAY_1X)}m@1x)`;

function readJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function analyse(dir) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
    const metrics = readJsonl(path.join(dir, 'metrics.jsonl'));
    const events = readJsonl(path.join(dir, 'events.jsonl'));
    const share = {};
    for (const m of metrics) {
        for (const [k, v] of Object.entries(m.states || {})) share[`state:${k}`] = (share[`state:${k}`] || 0) + v;
        for (const [k, v] of Object.entries(m.tasksShare || {})) share[k] = (share[k] || 0) + v;
    }
    for (const k of Object.keys(share)) share[k] /= Math.max(1, metrics.length);
    const rpPerDay = [];
    for (let i = 0; i < metrics.length; i += 4) {
        const slice = metrics.slice(i, i + 4);
        rpPerDay.push(slice.reduce((a, m) => a + (m.research?.rp || 0), 0));
    }
    const perf = metrics.filter(m => m.simMs).map(m => m.simMs).sort((a, b) => a - b);
    const p95 = perf.length ? perf[Math.floor(perf.length * 0.95)] : null;
    const lowFoodDays = metrics.filter(m => m.foodDays < 1).length / 4;
    const moodAvg = metrics.length ? metrics.reduce((a, m) => a + (m.moodAvg || 0), 0) / metrics.length : null;
    return { dir, s, metrics, events, share, rpPerDay, p95, lowFoodDays, moodAvg };
}

const runs = dirs.map(analyse);
const lines = [];
const p = (x = '') => lines.push(x);

// ---- Side-by-side -----------------------------------------------------------
const KEYS = [
    ['first_research', 'First research'], ['first_raid', 'First raid'], ['first_expedition_sent', 'First expedition'],
    ['tutorial_finished', 'Tutorial done'], ['first_crypt_breached', 'First crypt open'], ['colonists_4', '4th colonist'],
    ['first_wave_started', 'First wave'], ['realm_verdant_depths', 'Verdant Depths'], ['realm_crystal_caves', 'Crystal Caves'],
    ['realm_arcane_library', 'Arcane Library'], ['realm_shadow_realm', 'Shadow Realm'], ['realm_void_heart', 'Void Heart'],
    ['first_death', 'First death'], ['first_mental_break', 'First break'], ['game_over', 'Game over'],
];
p('## Runs side by side');
p();
p(`| | ${runs.map(r => path.basename(r.dir).replace(/^\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d-/, '')).join(' | ')} |`);
p(`|---|${runs.map(() => '---').join('|')}|`);
p(`| World | ${runs.map(r => `${r.s.mapSize}${r.s.peaceful ? ' peaceful' : ''}`).join(' | ')} |`);
p(`| Days played | ${runs.map(r => (+r.s.final.day).toFixed(0)).join(' | ')} |`);
for (const [k, label] of KEYS) p(`| ${label} | ${runs.map(r => fmtDay(r.s.milestones[k]?.day)).join(' | ')} |`);
p(`| Techs done (of 46) | ${runs.map(r => r.s.completedResearch.length).join(' | ')} |`);
p(`| Realms cleared | ${runs.map(r => r.s.completedRealms.length).join(' | ')} |`);
p(`| Waves completed | ${runs.map(r => r.s.final.waves).join(' | ')} |`);
p(`| Colonists at end / cap | ${runs.map(r => `${r.s.final.alive}/${r.s.final.cap}`).join(' | ')} |`);
p(`| Deaths | ${runs.map(r => r.s.deaths.length).join(' | ')} |`);
p(`| Mental breaks | ${runs.map(r => r.s.breaks.length).join(' | ')} |`);
p(`| Avg mood | ${runs.map(r => r.moodAvg?.toFixed(0)).join(' | ')} |`);
p(`| Days with <1 day food | ${runs.map(r => r.lowFoodDays.toFixed(1)).join(' | ')} |`);
p(`| Auto-pauses | ${runs.map(r => Object.values(r.s.pauses).reduce((a, b) => a + b, 0)).join(' | ')} |`);
p(`| Sim ms/tick p95 | ${runs.map(r => r.p95?.toFixed(2)).join(' | ')} |`);
p();

// ---- Per run --------------------------------------------------------------------
for (const r of runs) {
    const s = r.s;
    p(`## ${path.basename(r.dir)}`);
    p();
    p(`Profile **${s.profile}**, ${s.mapSize}x${s.mapSize}${s.peaceful ? ', peaceful' : ''}, ${(+s.final.day).toFixed(0)} days in ${s.wallSeconds}s.`);
    if (s.startMap) p(`Start: nearest stone ${s.startMap.resources.stone?.nearest}, iron ${s.startMap.resources.iron_ore?.nearest}, runite ${s.startMap.resources.runite_ore?.nearest} tiles; trees within 30: ${s.startMap.resources.tree?.within30}.`);
    p();
    p('**Research:** ' + s.research.map(x => `${x.name} ${fmtDay(x.day)}`).join(', '));
    p();
    p('**Realms:** ' + (s.realms.map(x => `${x.name} ${fmtDay(x.day)}`).join(', ') || 'none'));
    p();
    if (s.tutorial?.length) {
        p('**Tutorial steps (game days each):** ' + s.tutorial.map(t => `${t.id} ${(t.ticks / 480).toFixed(1)}${t.stuckHelpShown ? '*' : ''}`).join(', ') + ' (* = "stuck" help shown)');
        p();
    }
    const top = Object.entries(r.share).sort((a, b) => b[1] - a[1]).slice(0, 14);
    p('**Colonist time:** ' + top.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(', '));
    p();
    const rp = r.rpPerDay;
    const buckets = [];
    for (let i = 0; i < rp.length; i += 10) buckets.push((rp.slice(i, i + 10).reduce((a, b) => a + b, 0) / Math.max(1, rp.slice(i, i + 10).length)).toFixed(0));
    p('**RP per day, by 10-day block:** ' + buckets.join(' / '));
    p();
    const stalls = {};
    for (const st of s.stalls) { const e = stalls[st.key] || (stalls[st.key] = { n: 0, days: 0, longest: 0, at: null }); e.n++; e.days += st.days; if (st.days > e.longest) { e.longest = st.days; e.at = st.startDay; } }
    p('**Stalls:** ' + (Object.entries(stalls).map(([k, v]) => `${k} x${v.n} (${v.days.toFixed(1)}d total, longest ${v.longest.toFixed(1)}d from d${v.at})`).join('; ') || 'none'));
    p();
    p('**Pauses:** ' + (JSON.stringify(s.pauses)));
    p();
    if (s.deaths.length) { p('**Deaths:** ' + s.deaths.map(d => `${d.name} ${fmtDay(d.day)}${d.onExpedition ? ' (expedition)' : ''}: ${(d.context || []).join(' / ')}`).join('; ')); p(); }
    if (s.breaks.length) {
        const causes = {};
        for (const b of s.breaks) for (const t of b.thoughts || []) { const k = t.replace(/ \(.*/, ''); causes[k] = (causes[k] || 0) + 1; }
        p(`**Breaks:** ${s.breaks.length}; thoughts present: ` + Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(', '));
        p();
    }
    if (s.expeditions.length) {
        const byRealm = {};
        for (const e of s.expeditions) { const k = e.realm || '?'; const b = byRealm[k] || (byRealm[k] = { n: 0, wiped: 0, dead: 0 }); b.n++; const dead = e.party.filter(x => x.hp <= 0).length; b.dead += dead; if (dead === e.party.length) b.wiped++; }
        p('**Expeditions:** ' + Object.entries(byRealm).map(([k, v]) => `${k} x${v.n}${v.wiped ? ` (${v.wiped} wiped)` : ''}${v.dead ? ` ${v.dead} downed` : ''}`).join(', '));
        p();
    }
    if (s.stuckFighting?.length) { p(`**Stuck fighting:** ${s.stuckFighting.length} times, unreachable target in ${s.stuckFighting.filter(x => x.nearest && !x.nearest.reachable).length}`); p(); }
    p('**Bot notes:** ' + JSON.stringify(s.botNotes));
    p();
}

console.log(lines.join('\n'));

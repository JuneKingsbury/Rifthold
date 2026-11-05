// Random sweep: compares estimatePartyStrength() against the simulated win rate.
//   node scripts/expsim/sweep.mjs [count=400] [runs=150] [seed=1] [out.jsonl]
import fs from 'fs';
import { trial } from './harness.mjs';
import { randomScenario, mulberry32 } from './scenarios.mjs';

const [count = 400, runs = 150, seed = 1, out] = process.argv.slice(2).map((v, i) => i < 3 ? Number(v) : v);
const rnd = mulberry32(seed);
const rows = [];
const t0 = Date.now();
for (let i = 0; i < count; i++) {
    const sc = randomScenario(rnd);
    const r = trial(sc, runs);
    rows.push({ sc, ...r });
}
if (out) fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n'));

// Calibration buckets by estimate, plus overall error.
let brier = 0, mae = 0, interesting = 0;
const buckets = Array.from({ length: 10 }, () => ({ n: 0, est: 0, act: 0 }));
for (const r of rows) {
    brier += (r.est - r.winRate) ** 2;
    mae += Math.abs(r.est - r.winRate);
    if (r.winRate > 0.02 && r.winRate < 0.98) interesting++;
    const b = buckets[Math.min(9, Math.floor(r.est * 10))];
    b.n++; b.est += r.est; b.act += r.winRate;
}
console.log(`scenarios=${rows.length} runs=${runs} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`MAE=${(mae / rows.length * 100).toFixed(1)}pts  RMSE=${(Math.sqrt(brier / rows.length) * 100).toFixed(1)}pts  non-trivial=${interesting}`);
console.log('estimate bucket | n | mean est | mean actual');
for (let i = 0; i < 10; i++) {
    const b = buckets[i];
    if (!b.n) continue;
    console.log(`${i * 10}-${i * 10 + 10}% | ${b.n} | ${(b.est / b.n * 100).toFixed(0)}% | ${(b.act / b.n * 100).toFixed(0)}%`);
}

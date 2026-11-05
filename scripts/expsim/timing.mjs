import { simulate } from './harness.mjs';
import { member } from './scenarios.mjs';
for (const [realm, tier, diff] of [['crystal_caves',1,1],['crystal_depths',3,1],['oblivion_rift',5,1],['palace_fortress',5,3],['unraveling_core',5,3],['oblivion_rift',5,5]]) {
  const sc = { realm, difficulty: diff, party: ['melee','tank','evoker','healer','summoner'].map((r,i)=>member(r,tier,'M'+i)), beasts: ['wolf','boar'], potions: { health_potion: 5 } };
  const n = 100; const t0 = performance.now(); let w = 0;
  for (let i = 0; i < n; i++) w += simulate(sc).win ? 1 : 0;
  console.log(realm, 'd'+diff, ((performance.now()-t0)/n).toFixed(2)+'ms/run', 'win', w/n);
}

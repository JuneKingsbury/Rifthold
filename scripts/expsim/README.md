# Expedition simulator

Plays expeditions headlessly in Node using the real combat code (`js/systems/exploration.js`) against a stub game, so a party can be run through a realm hundreds of times in a second. Use it to see how a balance change moves real win rates, and to check the in-game forecast.

The in-game success chance on the Rifts setup panel comes from `js/systems/expedition-forecast.js`, which runs the same simulation on a sandboxed copy of the party. Nothing here ships: `scripts/expsim/` is excluded from desktop and web builds.

## Running it

From the repo root:

```sh
npm run expsim                                    # one-change-at-a-time impact table (factors.mjs)
node --no-warnings scripts/expsim/factors.mjs 800 # more runs per row
node --no-warnings scripts/expsim/sweep.mjs 400 150 1 out.jsonl   # random parties: forecast vs simulation
node --no-warnings scripts/expsim/timing.mjs      # ms per simulated expedition, worst cases
npm run playtest -- --bot=scripts/expsim/inapp-probe.js --label=forecast-probe   # in-app leak + UI check
```

## Files

- `harness.mjs`: stub game, colonist/beast builders, `simulate()` (one run), `trial()` (many runs plus the forecast).
- `scenarios.mjs`: gear tiers, spell loadouts by role, realm tiers and a seeded random party generator.
- `factors.mjs`: from a few base parties, changes one thing (member, beast, potion, gear, row, difficulty) and reports win rate, HP left and knockouts.
- `sweep.mjs`: random parties; compares the forecast with independent simulation runs and prints calibration buckets.
- `tweaks.mjs`: patches config at runtime to try candidate balance changes (potions, slow weapons, beast levels, summons, difficulty) and prints before/after win rates. Patch `ALL_ITEMS` for gear, since colonists copy items from it.
- `timing.mjs`: simulation cost for large late-game parties.
- `attune-probe.js`: in-game check that old saves with two attuned schools load with one (the stronger) plus a notice, and that attuning swaps.
- `inapp-probe.js`: runs inside the real game via the playtest launcher. Checks that a forecast leaves no trace on live colonists, potions, XP or sound, that it is deterministic, and that the setup panel renders it.

Decisions, puzzles and traps take the safe automatic choice, since the player's own picks can't be known in advance.

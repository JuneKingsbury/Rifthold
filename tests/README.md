# Tests

The game itself runs as plain ES modules loaded by `index.html` — **no build step, no
tooling required to play**. This `tests/` directory is a separate, optional layer that
lets you verify the game's core logic hasn't regressed. It never affects how the game
loads in the browser; the test runner just imports the same `js/` files directly.

## One-time setup

You need [Node.js](https://nodejs.org) installed (this repo was set up with Node 26, but
any recent LTS works). If `node --version` prints a version, you're good.

Then install the dev-only test dependencies once:

```sh
npm install
```

This creates `node_modules/` (git-ignored). These packages are **only** used for testing —
nothing here ships to the browser game.

## Running the tests

| Command | What it does |
|---------|--------------|
| `npm test` | Run the whole unit-test suite once and report pass/fail. This is the everyday command. |
| `npm run test:watch` | Re-run tests automatically as you edit files. Handy while refactoring. |
| `npm run test:e2e` | Run the headless browser smoke test (Playwright). Requires a one-time `npx playwright install chromium`; serves the site with vite and boots a real game. |

Example:

```sh
npm test
```

You'll see one line per test file with a ✓ (pass) or ✗ (fail), then a summary like
`Tests  21 passed (21)`. A failing test prints the file, the assertion, and a diff of
expected-vs-received so you can see exactly what changed.

## What's covered

These are **unit tests** for the pure-ish logic that doesn't need a browser. They import
the real modules — no mock game engine — using small plain-data fixtures from
`helpers.js`.

| File | Guards |
|------|--------|
| `tasks.test.js` | `TaskQueue.findBestTask` scoring/selection (priority beats distance, cooldowns, claimed/busy/released tasks, dirty-snapshot re-check). |
| `rooms.test.js` | `detectRooms` flood-fill + `calculateRoomQualities` scoring on hand-built maps. |
| `roles.test.js` | `initEntityRoles` — role-handler state init and the "don't clobber existing state" guard. |
| `save.test.js` | Full `saveGame` → `loadGame` round-trip, plus version-mismatch rejection. |
| `building.test.js` | `getMaxCountBonus` — the research bonus + the `mana_crystal`/`mana_reservoir` +3 special case. |
| `ui-utils.test.js` | `getTargetPriority` (expedition→combat fallback), `countByKey`, `getThreatDisplayHtml`. |
| `auto-repair.test.js` | `updateAutoRepair` — damaged-structure repair tasks and the anvil broken-artifact path (regression guard for b7a49ef). |

The Playwright smoke test lives in `tests/e2e/smoke.spec.js` (boots the page, starts a
new game, asserts the map/colonists/canvas come up and ticks advance with no console
errors). It's excluded from the vitest run by `vitest.config.js`.

`helpers.js` provides the shared fixtures: `makeMap`, `enclose`, `makeColonist`,
`makeGame`, and `installBrowserShims` (an in-memory `localStorage` + stub DOM so
`save.js` runs under Node).

## Adding a test

1. Create `tests/<thing>.test.js`.
2. `import { describe, it, expect } from 'vitest';` and import the real module under test.
3. Build inputs with the `helpers.js` fixtures (or add a new fixture there if several
   tests need it).
4. `npm test` to run it.

Rule of thumb: test **behavior at the module's public seam** (what a caller observes),
not private internals — a correct rewrite of the module should still pass.

## Sanity check: does a test actually catch bugs?

To trust the suite, prove a test can fail: temporarily break one line of product code
(e.g. flip a comparison in `tasks.js`), run `npm test`, confirm a test goes red, then
revert. A test that never fails isn't guarding anything.

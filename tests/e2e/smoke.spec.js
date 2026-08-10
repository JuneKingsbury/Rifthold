// Boot smoke test: loads index.html, starts a New Game, and verifies the engine
// comes up and ticks — without any uncaught console errors or page exceptions.
// This is the coarse integration net the unit suite can't provide: it exercises
// the full ES-module import graph and real DOM/canvas wiring that fail to load
// under Node.
import { test, expect } from '@playwright/test';

test('boots a new game with no console errors and advancing ticks', async ({ page }) => {
    const errors = [];
    // Collect anything that would indicate a broken boot: console.error output
    // and uncaught exceptions on the page.
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto('/index.html');

    // Start screen is up; the New Game button should be present and enabled.
    const newGame = page.locator('#start-game');
    await expect(newGame).toBeVisible();
    await newGame.click();

    // The game container replaces the start screen and the engine publishes
    // itself as window.game once launchGame's rAF callback runs.
    await expect(page.locator('#game-container')).toBeVisible();
    await page.waitForFunction(() => !!window.game, null, { timeout: 10_000 });

    // A booted game has a map and at least one colonist.
    const state = await page.evaluate(() => ({
        colonists: window.game.colonists.length,
        mapRows: window.game.map.length,
        tick: window.game.tick,
    }));
    expect(state.colonists).toBeGreaterThan(0);
    expect(state.mapRows).toBeGreaterThan(0);

    // The renderer creates a <canvas id="game-canvas"> inside #game and sizes it
    // on a rAF frame; poll for a canvas with non-zero backing dimensions.
    await page.waitForFunction(
        () => {
            const c = document.getElementById('game-canvas');
            return !!c && c.width > 0 && c.height > 0;
        },
        null,
        { timeout: 10_000 }
    );

    // The game boots paused (with the pause overlay). Unpause it and confirm the
    // simulation is live by watching the tick counter advance.
    const startTick = state.tick;
    await page.evaluate(() => { window.game.paused = false; });
    await page.waitForFunction(
        (t) => window.game.tick > t,
        startTick,
        { timeout: 10_000 }
    );

    // No console errors or uncaught exceptions during boot + first ticks.
    expect(errors).toEqual([]);
});

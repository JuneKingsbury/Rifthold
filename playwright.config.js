import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke config. The game is served over HTTP (ES modules won't load
// from file://) by a throwaway static server that Playwright starts and stops.
// Run with `npm run test:e2e` — browsers must be installed once via
// `npx playwright install chromium`.
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    // Serve the site with vite (already present via vitest) — it serves the
    // repo root statically and handles the raw ES modules with no build step.
    webServer: {
        command: 'npx vite --port 4173 --strictPort',
        url: 'http://localhost:4173/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});

import { defineConfig } from 'vitest/config';

// Unit tests only. The Playwright e2e specs under tests/e2e/ import
// @playwright/test and must not be collected by vitest (they run via
// `npm run test:e2e`).
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        exclude: ['tests/e2e/**', 'node_modules/**'],
    },
});

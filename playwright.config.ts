import { defineConfig } from '@playwright/test';

/**
 * Playwright config for Electron E2E tests.
 *
 * Run with: npm run test:e2e
 *
 * Prerequisite: a built app must exist before running tests. The `package`
 * step in electron-forge produces the bundle we point Playwright at. We
 * require it as a manual setup step instead of running it in globalSetup
 * because it takes ~30s and shouldn't run on every `vitest` invocation.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  // Electron tests can't run in parallel — they all spawn the same
  // executable and share the same OS-level Electron binary cache.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});

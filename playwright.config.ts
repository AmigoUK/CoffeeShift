import { defineConfig } from '@playwright/test';

/**
 * E2E tests run against two servers:
 *  - dev (VITE_PORT, default 5173): gameplay specs rely on the dev-only __COFFEE_SHIFT hook
 *  - preview (PREVIEW_PORT, default 4173): PWA specs exercise the production build + service worker
 * `npm run build` runs first (pretest:e2e) so the preview server has a dist/.
 */
const DEV_PORT = process.env.VITE_PORT ?? '5173';
const PREVIEW_PORT = process.env.PREVIEW_PORT ?? '4173';
const DEV_URL = `http://localhost:${DEV_PORT}`;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // The guided-flow specs stop a shot on a fixed 27.2 s of brew time against a 24-31 s
  // grading band, so a stalled main thread can push it out of band. One retry keeps CI
  // honest — Playwright still reports the test as flaky rather than hiding it.
  retries: process.env.CI != null ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 390, height: 844 },
    baseURL: DEV_URL,
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: [
    {
      command: 'npm run dev',
      url: DEV_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npm run preview -- --port ${PREVIEW_PORT} --host 127.0.0.1`,
      url: PREVIEW_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});

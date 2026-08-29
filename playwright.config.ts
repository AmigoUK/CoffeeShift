import { defineConfig } from '@playwright/test';

/**
 * E2E tests run against two servers:
 *  - dev (5173): gameplay specs rely on the dev-only __COFFEE_SHIFT hook
 *  - preview (4173): PWA specs exercise the production build + service worker
 * `npm run build` runs first (pretest:e2e) so the preview server has a dist/.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 390, height: 844 },
    baseURL: 'http://localhost:5173',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run preview -- --port 4173 --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});

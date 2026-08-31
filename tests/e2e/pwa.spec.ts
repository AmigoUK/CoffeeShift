import { expect, test } from '@playwright/test';

const BASE = `http://127.0.0.1:${process.env.PREVIEW_PORT ?? '4173'}`;

test.describe('PWA (production preview)', () => {
  test('service worker controls the page and the manifest is linked', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('[data-screen="menu"]')).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        registered: reg != null,
        controlled: navigator.serviceWorker.controller != null,
        scope: reg?.scope ?? null,
      };
    });
    expect(sw.registered).toBe(true);
    expect(sw.scope).toBe(`${BASE}/`);

    for (const icon of [
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/maskable-192.png',
      'icons/maskable-512.png',
    ]) {
      const res = await page.request.get(`${BASE}/${icon}`);
      expect(res.status(), icon).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });

  test('page still boots to the menu when offline', async ({ page, context }) => {
    await page.goto(BASE);
    await expect(page.locator('[data-screen="menu"]')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update?.();
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.app-footer')).toBeVisible();
    await context.setOffline(false);
  });
});

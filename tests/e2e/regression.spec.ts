import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { callHook, sceneSatisfies, tap, waitForBoot } from './helpers';

// Button positions in 390x844 game coordinates.
const DOSE = [65, 712] as const;
const SERVE = [320, 812] as const;
const EXIT_MENU = [360, 24] as const;

/**
 * Station status text lives inside the stationView container, not on the scene
 * display list — a scene-level lookup by name silently returns null.
 */
async function stationText(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const w = window as unknown as Record<string, unknown>;
    const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } } | undefined;
    if (hook == null) throw new Error('__COFFEE_SHIFT dev hook missing — is this the dev server?');
    const scene = hook.game.scene.getScene('game') as {
      stationView?: { getByName: (n: string) => { text?: string } | null };
    };
    return scene.stationView?.getByName(n)?.text ?? '';
  }, name);
}

async function startLevel(page: Page, levelId: string): Promise<void> {
  await callHook<unknown>(page, 'startLevel', levelId);
  await sceneSatisfies(page, (s) => s.level?.id === levelId, 15_000);
  await page.waitForTimeout(400);
}

test.describe('regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.evaluate(() => localStorage.removeItem('coffee-shift.save.v1'));
  });

  test('the DOM shell is styled and its primary action fits the first screen', async ({ page }) => {
    // src/style.css reaches the bundle only through main.ts; without that import the
    // shell renders unstyled and Play drops far below the fold. The viewport meta is
    // what keeps the layout viewport at device width instead of 980px.
    await expect(page.locator('head meta[name="viewport"]')).toHaveCount(1);

    const shell = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="mode"]');
      const rect = btn?.getBoundingClientRect();
      return {
        sheets: document.styleSheets.length,
        layoutWidth: document.documentElement.clientWidth,
        horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        height: rect != null ? Math.round(rect.height) : null,
        top: rect != null ? Math.round(rect.top) : null,
      };
    });

    expect(shell.sheets).toBeGreaterThan(0);
    expect(shell.layoutWidth).toBe(390);
    expect(shell.horizontalScroll).toBe(false);
    expect(shell.height).toBeGreaterThanOrEqual(44);
    expect(shell.top).toBeLessThan(844);
  });

  test('station status lines render and track state', async ({ page }) => {
    await startLevel(page, 'L1');

    const before = await stationText(page, 'ext-status');
    expect(before).toContain('dose');

    await tap(page, DOSE[0], DOSE[1]);
    const after = await stationText(page, 'ext-status');
    expect(after).not.toBe(before);
    const dose = (await sceneSatisfies(page, () => true)).ext.doseGrams;
    expect(after).toContain(`dose ${dose} g`);
  });

  test('leaving with the feedback card open does not lock the next level', async ({ page }) => {
    await startLevel(page, 'L1');

    // Serving an empty cup grades badly but opens the feedback card, which is all
    // this regression needs.
    await tap(page, SERVE[0], SERVE[1]);
    await sceneSatisfies(page, (s) => s.feedbackCard != null, 10_000);

    // Exit to the menu with the card still up, then start the level again.
    await tap(page, EXIT_MENU[0], EXIT_MENU[1]);
    await page.waitForTimeout(500);
    await startLevel(page, 'L1');

    // A stale feedbackCard would make serve() and update() return early forever.
    const scene = await sceneSatisfies(page, () => true);
    expect(scene.feedbackCard).toBeNull();
    expect(await stationText(page, 'ext-status')).toContain('dose');

    // Serving still works, proving the level is playable.
    await tap(page, SERVE[0], SERVE[1]);
    await sceneSatisfies(page, (s) => s.feedbackCard != null, 10_000);
  });
});

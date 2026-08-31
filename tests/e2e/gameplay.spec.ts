import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activeScene, callHook, clearSave, hold, holdUntil, hookData, readSave, sceneSatisfies, tap, waitForBoot, writeSave } from './helpers';
import { BAR_Y, COL_X, FEEDBACK, ROW_Y, TABS_Y } from '../../src/game/layout';

// Button positions derived from the scene's own layout module, so a layout change moves
// the tests with it instead of silently making them tap empty canvas.
const DOSE = [COL_X[0], ROW_Y[1]] as const;
const TAMP = [COL_X[1], ROW_Y[1]] as const;
const BREW = [COL_X[2], ROW_Y[1]] as const;
const TAB_MILK = [COL_X[1], TABS_Y] as const;
const TAB_ASSEMBLY = [COL_X[2], TABS_Y] as const;
const LARGE_JUG = [COL_X[1], ROW_Y[0]] as const;
const FILL = [COL_X[0], ROW_Y[1]] as const;
const PURGE = [COL_X[1], ROW_Y[1]] as const;
const STEAM = [COL_X[2], ROW_Y[1]] as const;
const DEMITASSE = [COL_X[0], ROW_Y[0]] as const;
const LATTE_GLASS = [COL_X[0], ROW_Y[1]] as const;
const ADD_ESPRESSO = [COL_X[0], ROW_Y[2]] as const;
const POUR_MILK = [COL_X[2], ROW_Y[2]] as const;
const SERVE = [320, BAR_Y] as const;
const FEEDBACK_NEXT = [FEEDBACK.x, FEEDBACK.y + FEEDBACK.nextOffsetY] as const;

async function startLevel(page: Page, levelId: string): Promise<void> {
  // The first call also loads the Phaser chunk, which a cold dev server compiles on demand.
  await callHook<unknown>(page, 'startLevel', levelId);
  await sceneSatisfies(page, (s) => s.level?.id === levelId, 40_000);
  await page.waitForTimeout(400);
}

/** Dose 18 g, tamp in-band, brew to 26.5-28 s, stop — one good shot. Tamp retries because
 * evaluate latency can release the hold just past the 15-20 kg band on a slow box. */
async function pullGoodShot(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) await tap(page, DOSE[0], DOSE[1]);
  let tampGood = false;
  for (let attempt = 0; attempt < 5 && !tampGood; attempt++) {
    // Fixed 2200 ms hold ≈ 17.6 kg (ramp 8 kg/s): mid-band even with event jitter.
    // Predicate-driven release is unusable here — evaluate latency overshoots the band.
    await hold(page, TAMP[0], TAMP[1], 2200);
    tampGood = (await sceneSatisfies(page, () => true)).ext.tampGood;
  }
  if (!tampGood) throw new Error('could not land a tamp inside the 15-20 kg band');
  await tap(page, BREW[0], BREW[1]);
  // Stop on a fixed 27.2 s of brew time. The grading band is 24-31 s, so ±3 s of
  // event/frame jitter still lands in-band; polling for a tight window can skip
  // it entirely when the main thread stalls between samples.
  await page.waitForTimeout(27_200);
  await tap(page, BREW[0], BREW[1]);
  const afterStop = await sceneSatisfies(page, (s) => !s.ext.brewing && s.ext.pulls.length > 0);
  const shot = afterStop.ext.pulls[0];
  if (shot == null || shot.seconds < 24 || shot.seconds > 31) {
    throw new Error(`shot outside the 24-31 s band: ${JSON.stringify(afterStop.ext.pulls)}`);
  }
}

test.describe('gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await clearSave(page);
  });

  test('Learn L1: guided espresso flow scores ≥98 and reaches the summary', async ({ page }) => {
    test.slow();
    await startLevel(page, 'L1');

    await pullGoodShot(page);
    await tap(page, TAB_ASSEMBLY[0], TAB_ASSEMBLY[1]);
    await tap(page, DEMITASSE[0], DEMITASSE[1]);
    await tap(page, ADD_ESPRESSO[0], ADD_ESPRESSO[1]);

    // No DOM footer during Phaser gameplay.
    const overlayHidden = await page.evaluate(() => document.getElementById('overlay')?.hidden);
    expect(overlayHidden).toBe(true);

    await tap(page, SERVE[0], SERVE[1]);
    await sceneSatisfies(page, (s) => s.feedbackCard != null);
    const report = (await hookData(page)).lastReport;
    expect(report).not.toBeNull();
    expect(report!.total).toBeGreaterThanOrEqual(98);
    expect(['PERFECT_ORDER', 'CORRECT_DRINK']).toContain(report!.feedback[0]);

    // Dismiss the card → summary screen with stars and Retry that restarts the level.
    await tap(page, FEEDBACK_NEXT[0], FEEDBACK_NEXT[1]);
    await expect(page.locator('[data-screen="summary"]')).toBeVisible();
    await expect(page.locator('.stars')).toHaveAttribute('aria-label', /\d of 3 stars/);
    await page.click('[data-action="retry"]');
    await sceneSatisfies(page, (s) => s.level?.id === 'L1', 15_000);
  });

  test('Learn L3: overheated, over-foamed latte reports Milk Too Hot and Foam Too Thick', async ({ page }) => {
    test.slow();
    await startLevel(page, 'L3');
    const order = (await activeScene(page)).orders[0];
    if (order == null) throw new Error('L3 produced no order');

    await pullGoodShot(page);

    // Milk: large jug (latte small = 180 ml > 150), fill to line, purge, steam past 70 °C with shallow wand.
    await tap(page, TAB_MILK[0], TAB_MILK[1]);
    await tap(page, LARGE_JUG[0], LARGE_JUG[1]);
    await holdUntil(page, FILL[0], FILL[1], (s) => s.milk.fillMl >= 158);
    await tap(page, PURGE[0], PURGE[1]);
    await tap(page, STEAM[0], STEAM[1]);
    // Detect at 69.3 °C: with ~0.4 s tap latency at 3 °C/s the jug comes off just past 70 °C
    // (MILK_TOO_HOT threshold) while staying under the 75 °C scorch point.
    await sceneSatisfies(page, (s) => s.milk.tempC >= 69.3, 60_000);
    await tap(page, STEAM[0], STEAM[1]); // remove jug while too hot but not scorched
    await sceneSatisfies(page, (s) => !s.milk.steaming && !s.milk.ruined);
    // Assembly: latte glass, shots, milk, serve.
    await tap(page, TAB_ASSEMBLY[0], TAB_ASSEMBLY[1]);
    await tap(page, LATTE_GLASS[0], LATTE_GLASS[1]);
    for (let i = 0; i < order.shots; i++) await tap(page, ADD_ESPRESSO[0], ADD_ESPRESSO[1]);
    await hold(page, POUR_MILK[0], POUR_MILK[1], 200);
    await tap(page, SERVE[0], SERVE[1]);

    await sceneSatisfies(page, (s) => s.feedbackCard != null);
    const report = (await hookData(page)).lastReport;
    expect(report!.feedback).toContain('MILK_TOO_HOT');
    expect(report!.feedback).toContain('FOAM_TOO_THICK');
    // The domain reports faults as data now; the wording is asserted in tests/summary-copy.
    // FOAM_TOO_THICK is the clause that names the drink, which is what this used to check
    // by looking for "latte" in the finished sentence.
    expect(report!.summary.clauses).toContain('FOAM_TOO_THICK');
  });

  test('Shift meta: S1 unlocks after Learn, serves, records progress and Retry works', async ({ page }) => {
    test.slow();
    // Dev shortcut: mark all Learn lessons complete.
    const save = (await readSave<{ progress?: { learn?: number[] } }>(page)) ?? { progress: {} };
    save.progress = save.progress ?? {};
    save.progress.learn = [100, 100, 100, 100, 100];
    await writeSave(page, save);
    await startLevel(page, 'S1');
    const orders = (await activeScene(page)).orders;
    expect(orders.length).toBe(3);

    for (let i = 0; i < orders.length; i++) {
      await tap(page, SERVE[0], SERVE[1]);
      await sceneSatisfies(page, (s) => s.feedbackCard != null, 20_000);
      await tap(page, FEEDBACK_NEXT[0], FEEDBACK_NEXT[1]);
      await page.waitForTimeout(500);
    }
    await expect(page.locator('[data-screen="summary"]')).toBeVisible();
    await expect(page.locator('.screen__title')).toHaveText('Shift complete!');

    const stored = await readSave<{ progress?: { shift?: { stars: number; best: number }[] } }>(page);
    const shiftProgress = stored?.progress?.shift?.[0] ?? null;
    expect(shiftProgress).not.toBeNull();
    expect(shiftProgress!.best).toBeGreaterThanOrEqual(0);
    expect(shiftProgress!.stars).toBeGreaterThanOrEqual(0);
    await expect(page.locator('[data-action="retry"]')).toBeVisible();
  });
});

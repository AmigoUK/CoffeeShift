import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { callHook, canvasScale, sceneSatisfies, tap, waitForBoot } from './helpers';

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

  test('a hostile mastery key from storage is not rendered as HTML', async ({ page }) => {
    // The summary falls back to the raw key when it is not a known drink, and that key comes
    // straight out of localStorage. Anything with page access could plant markup there.
    await page.evaluate(() => {
      localStorage.setItem('coffee-shift.save.v1', JSON.stringify({
        version: 1,
        settings: { sound: false, vibration: false, reduceAnimations: true },
        progress: { learn: [], practice: [], shift: [] },
        rank: 'trainee',
        mastery: { 'drink:<img src=x onerror="window.__pwned=1">': 50 },
        errorTagCounts: {},
        stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
      }));
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { events: { emit: (n: string, p: unknown) => void } } };
      hook.game.events.emit('level-complete', { levelId: 'L1', reports: [], masteryBefore: {} });
    });
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => ({
      pwned: (window as unknown as Record<string, unknown>).__pwned ?? null,
      injectedNodes: document.querySelectorAll('#overlay img').length,
      shownLiterally: document.getElementById('overlay')?.textContent?.includes('<img src=x') ?? false,
    }));

    expect(result.pwned).toBeNull();
    expect(result.injectedNodes).toBe(0);
    expect(result.shownLiterally).toBe(true);
  });

  test('changing a setting keeps progress written by the game', async ({ page }) => {
    // screens.ts caches the save at module load. The game writes its own copy after every
    // serve, so a setting toggled afterwards used to write the stale cache back and wipe it.
    await page.evaluate(() => {
      // A complete save: loadSave() rejects anything without version === 1, so a partial
      // object here would be replaced by defaults and prove nothing.
      localStorage.setItem('coffee-shift.save.v1', JSON.stringify({
        version: 1,
        settings: { sound: true, vibration: true, reduceAnimations: false },
        progress: { learn: [96, 0, 0, 0, 0], practice: [], shift: [] },
        rank: 'trainee',
        mastery: { 'drink:latte': 88 },
        errorTagCounts: {},
        stats: { drinksServed: 4, perfectOrders: 2, shiftsPlayed: 1 },
      }));
    });

    await page.click('[data-action="settings"]');
    await page.locator('#set-sound').click();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const raw = localStorage.getItem('coffee-shift.save.v1');
      return raw != null ? JSON.parse(raw) : null;
    });
    expect(after?.mastery?.['drink:latte']).toBe(88);
    expect(after?.stats?.drinksServed).toBe(4);
  });

  test('switching station mid-hold does not leave the milk pouring for ever', async ({ page }) => {
    await startLevel(page, 'L3');
    await tap(page, 195, 290);        // milk station
    await tap(page, 195, 655);        // large jug

    // Start pouring and let some milk in.
    const { left, top, sx, sy } = await canvasScale(page);
    await page.mouse.move(left + 65 * sx, top + 712 * sy);
    await page.mouse.down();
    await sceneSatisfies(page, (s2) => s2.milk.fillMl > 10, 10_000);

    // The controls are destroyed under the finger — the button can no longer emit
    // pointerup, so the scene has to clear the flag itself.
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } };
      const scene = hook.game.scene.getScene('game') as { switchStation: (id: string) => void };
      scene.switchStation('espresso');
    });
    await page.mouse.up();

    const settled = await sceneSatisfies(page, () => true);
    expect(settled.milk.filling).toBe(false);

    // And the volume must stop growing.
    const before = settled.milk.fillMl;
    await page.waitForTimeout(1200);
    const after = (await sceneSatisfies(page, () => true)).milk.fillMl;
    expect(after).toBeCloseTo(before, 1);
  });

  test('the queue counter reflects real customers on a multi-drink level', async ({ page }) => {
    // multiDrink is presentation only: generateOrders ignores it, and each order gets
    // its own customer, its own patience and its own lost-customer path. The counter
    // must not halve them.
    await page.evaluate(() => {
      localStorage.setItem('coffee-shift.save.v1', JSON.stringify({
        version: 1,
        settings: { sound: false, vibration: false, reduceAnimations: true },
        progress: {
          learn: [100, 100, 100, 100, 100],
          practice: [100, 100, 100, 100, 100],
          shift: Array.from({ length: 9 }, () => ({ stars: 1, best: 70 })),
        },
        rank: 'barista', mastery: {}, errorTagCounts: {},
        stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
      }));
    });
    await startLevel(page, 'S9');

    const queue = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } };
      const scene = hook.game.scene.getScene('game') as {
        orders: unknown[];
        drinkIndex: number;
        renderTicket: () => void;
        children: { getByName: (n: string) => { text?: string } | null };
      };
      const order = (drink: string) => ({
        drink, size: 'small', shots: 1, milk: 'whole', extraHot: false, takeaway: false,
      });
      scene.orders = Array.from({ length: 7 }, () => order('espresso'));
      const read = (index: number): string => {
        scene.drinkIndex = index;
        scene.renderTicket();
        return scene.children.getByName('queue-label')?.text ?? '';
      };
      return { atStart: read(0), midway: read(3), last: read(6) };
    });

    expect(queue.atStart).toContain('6');
    expect(queue.midway).toContain('3');
    expect(queue.last).toContain('0');
  });

  test('a multi-drink ticket shows the pair being worked on, not the first pair', async ({ page }) => {
    // S9 is a multiDrink level. Unlock the shift levels, then pin a known set of
    // orders so the assertions cannot be satisfied by a coincidental repeat.
    await page.evaluate(() => {
      localStorage.setItem('coffee-shift.save.v1', JSON.stringify({
        version: 1,
        settings: { sound: false, vibration: false, reduceAnimations: true },
        progress: {
          learn: [100, 100, 100, 100, 100],
          practice: [100, 100, 100, 100, 100],
          shift: Array.from({ length: 9 }, () => ({ stars: 1, best: 70 })),
        },
        rank: 'barista', mastery: {}, errorTagCounts: {},
        stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
      }));
    });
    await startLevel(page, 'S9');

    const ticket = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } };
      const scene = hook.game.scene.getScene('game') as {
        orders: unknown[];
        drinkIndex: number;
        ticketFields: Record<string, { text: string }>;
        renderTicket: () => void;
      };
      const order = (drink: string) => ({
        drink, size: 'small', shots: 1, milk: 'whole', extraHot: false, takeaway: false,
      });
      scene.orders = [order('espresso'), order('latte'), order('americano'), order('cappuccino')];
      scene.drinkIndex = 2; // second pair, first drink
      scene.renderTicket();
      return { first: scene.ticketFields['drink']?.text ?? '', second: scene.ticketFields['second']?.text ?? '' };
    });

    // The drink actually being made must be on the ticket.
    expect(ticket.first).toContain('americano');
    expect(ticket.second).toContain('cappuccino');
    // The already-served first pair must not be presented as the current work.
    expect(ticket.first).not.toContain('espresso');
    expect(ticket.second).not.toContain('latte');
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

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the page explains itself instead of showing a blank background', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('noscript').textContent();
    expect(text).toContain('JavaScript');
  });
});

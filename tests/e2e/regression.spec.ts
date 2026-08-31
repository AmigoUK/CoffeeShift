import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { callHook, canvasScale, clearSave, readSave, sceneSatisfies, shiftUnlockedSave, tap, waitForBoot, writeSave } from './helpers';
import { BAR_Y, COL_X, ROW_Y, TABS_Y } from '../../src/game/layout';

// Button positions come from the scene's layout module, not from copied numbers.
const DOSE = [COL_X[0], ROW_Y[1]] as const;
const SERVE = [320, BAR_Y] as const;
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
    await clearSave(page);
  });

  test('the feedback card renders a phrased summary, not raw fault ids', async ({ page }) => {
    // The domain reports faults as data and the copy layer phrases them. Every other test
    // checks one side or the other; this one checks that the two meet on screen.
    await startLevel(page, 'L1');
    await tap(page, SERVE[0], SERVE[1]);
    await sceneSatisfies(page, (s2) => s2.feedbackCard != null, 10_000);

    const texts = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } };
      const scene = hook.game.scene.getScene('game') as {
        feedbackCard?: { list: { type: string; text?: string }[] } | null;
      };
      return (scene.feedbackCard?.list ?? []).filter((o) => o.type === 'Text').map((o) => o.text ?? '');
    });

    const sentence = texts.find((t) => t.includes('.') && t.split(' ').length > 3) ?? '';
    expect(sentence).not.toMatch(/[A-Z]{3,}_[A-Z]/);   // no raw fault ids leaking through
    expect(sentence).toMatch(/^[A-Z]/);
    expect(sentence.trim().endsWith('.')).toBe(true);
    expect(texts.some((t) => t.includes('Order match'))).toBe(true);
  });

  test('binning a drink needs a second tap and can be undone', async ({ page }) => {
    await startLevel(page, 'L1');
    await tap(page, COL_X[2], TABS_Y);   // assembly station
    await tap(page, COL_X[0], ROW_Y[0]); // demitasse
    expect((await sceneSatisfies(page, (s2) => s2.asm.vessel != null)).asm.vessel).toBe('demitasse');

    // First tap only arms the button — a stray thumb must not destroy the drink.
    await tap(page, 195, BAR_Y);
    await page.waitForTimeout(200);
    expect((await sceneSatisfies(page, () => true)).asm.vessel).toBe('demitasse');

    // Second tap actually bins it.
    await tap(page, 195, BAR_Y);
    await sceneSatisfies(page, (s2) => s2.asm.vessel == null, 5_000);

    // And Undo brings it back: binning used to wipe the undo stack with the assembly.
    await tap(page, 60, BAR_Y);
    const restored = await sceneSatisfies(page, (s2) => s2.asm.vessel != null, 5_000);
    expect(restored.asm.vessel).toBe('demitasse');
  });

  test('the feedback card blocks taps on the controls beneath it', async ({ page }) => {
    await startLevel(page, 'L1');
    await tap(page, COL_X[2], TABS_Y);   // assembly station
    await tap(page, COL_X[0], ROW_Y[0]); // demitasse
    const chosen = await sceneSatisfies(page, (s2) => s2.asm.vessel != null, 10_000);
    expect(chosen.asm.vessel).toBe('demitasse');

    await tap(page, SERVE[0], SERVE[1]);
    await sceneSatisfies(page, (s2) => s2.feedbackCard != null, 10_000);

    // Bin & restart sits under the card. A tap there must not reach it.
    await tap(page, 195, BAR_Y);
    await page.waitForTimeout(400);

    const after = await sceneSatisfies(page, () => true);
    expect(after.feedbackCard).not.toBeNull();
    expect(after.asm.vessel).toBe('demitasse');
  });

  test('a hostile mastery key from storage is not rendered as HTML', async ({ page }) => {
    // The summary falls back to the raw key when it is not a known drink, and that key comes
    // straight out of localStorage. Anything with page access could plant markup there.
    await writeSave(page, {
      version: 1,
      settings: { sound: false, vibration: false, reduceAnimations: true },
      progress: { learn: [], practice: [], shift: [] },
      rank: 'trainee',
      mastery: { 'drink:<img src=x onerror="window.__pwned=1">': 50 },
      errorTagCounts: {},
      stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
    });
    await page.evaluate(() => {
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
    // A complete save: loadSave() rejects anything without version === 1, so a partial
    // object here would be replaced by defaults and prove nothing.
    await writeSave(page, {
      version: 1,
      settings: { sound: true, vibration: true, reduceAnimations: false },
      progress: { learn: [96, 0, 0, 0, 0], practice: [], shift: [] },
      rank: 'trainee',
      mastery: { 'drink:latte': 88 },
      errorTagCounts: {},
      stats: { drinksServed: 4, perfectOrders: 2, shiftsPlayed: 1 },
    });

    await page.click('[data-action="settings"]');
    await page.locator('#set-sound').click();
    await page.waitForTimeout(300);

    const after = await readSave<{ mastery?: Record<string, number>; stats?: { drinksServed?: number } }>(page);
    expect(after?.mastery?.['drink:latte']).toBe(88);
    expect(after?.stats?.drinksServed).toBe(4);
  });

  test('switching station mid-hold does not leave the milk pouring for ever', async ({ page }) => {
    await startLevel(page, 'L3');
    await tap(page, COL_X[1], TABS_Y);   // milk station
    await tap(page, COL_X[1], ROW_Y[0]); // large jug

    // Start pouring and let some milk in.
    const { left, top, sx, sy } = await canvasScale(page);
    await page.mouse.move(left + COL_X[0] * sx, top + ROW_Y[1] * sy);
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
    await writeSave(page, shiftUnlockedSave());
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
    await writeSave(page, shiftUnlockedSave());
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

test.describe('touch targets on the smallest supported phone', () => {
  // iPhone SE scales the 390x844 canvas by 667/844 = 0.79, the worst case we support.
  test.use({ viewport: { width: 375, height: 667 } });

  test('every control clears 44px and no two rows overlap', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await clearSave(page);
    await startLevel(page, 'L3');

    const controls = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT as { game: { scene: { getScene: (k: string) => unknown } } };
      const scene = hook.game.scene.getScene('game') as {
        controlsView?: { list: { x: number; y: number; list: { type: string; width: number; height: number; text?: string }[] }[] };
        children: { getByName: (n: string) => { x: number; getBounds: () => { y: number; width: number; height: number } } | null };
      };
      const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width / 390;
      const sy = rect.height / 844;
      const out: { label: string; w: number; h: number; top: number; bottom: number }[] = [];
      for (const obj of scene.controlsView?.list ?? []) {
        const bg = obj.list.find((c) => c.type === 'Rectangle');
        if (bg == null) continue;
        const label = obj.list.find((c) => c.type === 'Text')?.text ?? '?';
        out.push({
          label, w: bg.width * sx, h: bg.height * sy,
          top: (obj.y - bg.height / 2) * sy, bottom: (obj.y + bg.height / 2) * sy,
        });
      }
      for (const id of ['espresso', 'milk', 'assembly']) {
        const tab = scene.children.getByName(`tab-${id}`);
        if (tab == null) continue;
        const b = tab.getBounds();
        out.push({ label: `tab:${id}`, w: b.width * sx, h: b.height * sy, top: b.y * sy, bottom: (b.y + b.height) * sy });
      }
      return { controls: out, canvasHeight: rect.height, viewportHeight: window.innerHeight };
    });

    expect(controls.controls.length).toBeGreaterThan(10);

    const tooSmall = controls.controls.filter((c) => c.w < 44 || c.h < 44);
    expect(tooSmall.map((c) => `${c.label} ${c.w.toFixed(1)}x${c.h.toFixed(1)}`)).toEqual([]);

    // Rows that overlap let a tap land on the control underneath — the bug that once made
    // "Wand depth" trigger "Bin & restart".
    const rows = [...new Set(controls.controls.map((c) => Math.round(c.top)))].sort((a, b) => a - b);
    const overlaps: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const above = controls.controls.filter((c) => Math.round(c.top) === rows[i - 1]);
      const below = controls.controls.filter((c) => Math.round(c.top) === rows[i]);
      const lowestAbove = Math.max(...above.map((c) => c.bottom));
      const highestBelow = Math.min(...below.map((c) => c.top));
      if (lowestAbove > highestBelow) overlaps.push(`${rows[i - 1]} -> ${rows[i]}`);
    }
    expect(overlaps).toEqual([]);
  });
});

test.describe('contrast', () => {
  test('text in the DOM shell meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    const measure = async (): Promise<string[]> => page.evaluate(() => {
      const parse = (c: string): [number, number, number] => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (m == null) return [0, 0, 0];
        const [r, g, b] = (m[1] ?? '').split(',').map((v) => parseFloat(v));
        return [r ?? 0, g ?? 0, b ?? 0];
      };
      const lum = ([r, g, b]: [number, number, number]): number => {
        const f = (v: number): number => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el: Element): [number, number, number] => {
        let node: Element | null = el;
        while (node != null) {
          const bg = getComputedStyle(node).backgroundColor;
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return parse(bg);
          node = node.parentElement;
        }
        return [253, 246, 236];
      };
      const out: string[] = [];
      const seen = new Set<string>();
      for (const el of document.querySelectorAll('#overlay *')) {
        const text = (el.textContent ?? '').trim();
        if (text.length === 0 || el.children.length > 0) continue;
        // Decorative separators carry no information and are aria-hidden, so WCAG's
        // contrast minimum does not apply to them.
        if (el.closest('[aria-hidden="true"]') != null) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        const size = parseFloat(style.fontSize);
        const bold = parseInt(style.fontWeight, 10) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        const la = lum(parse(style.color));
        const lb = lum(bgOf(el));
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        const key = `${style.color}|${size}`;
        if (ratio < need && !seen.has(key)) {
          seen.add(key);
          out.push(`"${text.slice(0, 24)}" ${style.color} ${size}px -> ${ratio.toFixed(2)}:1 (wymagane ${need})`);
        }
      }
      return out;
    });

    const failures: string[] = [];
    failures.push(...await measure());
    for (const [action, back] of [['mode', true], ['recipe-book', true], ['settings', true]] as const) {
      await page.click(`[data-action="${action}"]`);
      await page.waitForTimeout(250);
      failures.push(...await measure());
      if (back) {
        await page.goto('/');
        await waitForBoot(page);
      }
    }

    expect([...new Set(failures)]).toEqual([]);
  });
});

test.describe('browser history', () => {
  test('Back moves between screens instead of leaving the app', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
    await page.click('[data-action="mode"]');
    await expect(page.locator('[data-screen="mode"]')).toBeVisible();
    await page.click('[data-mode="learn"]');
    await expect(page.locator('[data-screen="levels"]')).toBeVisible();

    // On Android this is the hardware Back button. Without history entries it unloads the
    // page and the player is dumped out of the game.
    await page.goBack();
    await expect(page.locator('[data-screen="mode"]')).toBeVisible();

    await page.goBack();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    expect(page.url()).not.toContain('about:blank');
  });
});

test.describe('accessibility', () => {
  test('the shell manages focus, labels the canvas and announces game messages', async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);

    // The canvas is opaque to assistive technology, so it must at least identify itself.
    const canvas = page.locator('#game-canvas canvas');
    await expect(canvas).toHaveAttribute('role', 'img');
    expect((await canvas.getAttribute('aria-label')) ?? '').toContain('Coffee Shift');

    // Changing screen must not drop focus back to <body>.
    await page.click('[data-action="mode"]');
    await page.waitForTimeout(250);
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? null,
      cls: document.activeElement?.className ?? null,
    }));
    expect(focused.tag).not.toBe('BODY');
    expect(focused.cls).toContain('screen__title');

    // Toasts are drawn on the canvas, so they are mirrored into a live region.
    await page.goto('/');
    await waitForBoot(page);
    await clearSave(page);
    await startLevel(page, 'L1');
    await tap(page, 195, BAR_Y);   // arms Bin, which toasts
    await page.waitForTimeout(400);
    const live = page.locator('#a11y-live');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    expect((await live.textContent()) ?? '').toContain('Bin');
  });
});

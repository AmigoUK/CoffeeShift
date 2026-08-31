import type { Page } from '@playwright/test';
import { SAVE_KEY } from '../../src/domain/save';

/** Snapshot of the dev-only data hook injected by src/main.ts on the dev server. */
export interface HookData {
  booted: boolean;
  lastReport: {
    total: number;
    breakdown: { orderMatch: number; recipe: number; technique: number; time: number; waste: number };
    feedback: string[];
    summary: { opener: string; clauses: string[] };
  } | null;
}

export interface SceneState {
  level: { id: string } | null;
  orders: { drink: string; size: string; shots: number }[];
  ext: {
    tampKg: number; tampPeakKg: number; tampGood: boolean; brewing: boolean;
    brewSeconds: number; pulls: { tampOk: boolean; seconds: number }[]; doseGrams: number;
  };
  milk: { fillMl: number; tempC: number; foamCm: number; steaming: boolean; ruined: boolean; used: boolean; filling: boolean; jug: string | null };
  asm: { vessel: string | null; shotsUsed: number; actions: string[]; waterMl: number | null };
  feedbackCard: unknown;
}

type HookMethod = 'startLevel' | 'activeScene' | 'canvasRect';

/**
 * Invoke a method on the page's __COFFEE_SHIFT hook. Only serialisable args —
 * function arguments do not survive page.evaluate, so the method is looked up
 * inside the page context.
 */
export async function callHook<T>(page: Page, method: HookMethod, arg?: string): Promise<T> {
  return page.evaluate<T, { method: HookMethod; arg?: string }>(({ method: name, arg: value }) => {
    const w = window as unknown as Record<string, unknown>;
    const hook = w.__COFFEE_SHIFT;
    if (hook == null || typeof hook !== 'object' || !(name in hook)) {
      throw new Error(`__COFFEE_SHIFT.${name} unavailable — is this the dev server?`);
    }
    const fn = (hook as Record<string, unknown>)[name];
    if (typeof fn !== 'function') throw new Error(`__COFFEE_SHIFT.${name} is not a function`);
    return (fn as (a?: string) => T)(value) as T;
  }, { method, arg });
}

/** Snapshot of the hook's data properties (functions are not cloneable). */
export async function hookData(page: Page): Promise<HookData> {
  const raw = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return w.__COFFEE_SHIFT ?? null;
  });
  if (raw == null || typeof raw !== 'object' || !('booted' in raw)) {
    throw new Error('__COFFEE_SHIFT dev hook missing — is this the dev server?');
  }
  return raw as HookData;
}

export async function waitForBoot(page: Page): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const ready = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const hook = w.__COFFEE_SHIFT;
      if (hook != null && typeof hook === 'object' && 'booted' in hook && hook.booted === true) return true;
      return document.querySelector('[data-screen="menu"]') != null;
    });
    if (ready) return;
    await page.waitForTimeout(200);
  }
  throw new Error('game did not boot within 20s');
}

export async function activeScene(page: Page): Promise<SceneState> {
  return callHook<SceneState>(page, 'activeScene');
}

export async function canvasScale(page: Page): Promise<{ left: number; top: number; sx: number; sy: number }> {
  const rect = await callHook<{ left: number; top: number; width: number; height: number }>(page, 'canvasRect');
  return { left: rect.left, top: rect.top, sx: rect.width / 390, sy: rect.height / 844 };
}

/** Tap game coordinates (390x844 logical) on the FIT-scaled canvas. */
export async function tap(page: Page, gx: number, gy: number): Promise<void> {
  const { left, top, sx, sy } = await canvasScale(page);
  await page.mouse.click(left + gx * sx, top + gy * sy);
  await page.waitForTimeout(120);
}

/** Poll scene state until the predicate passes. */
export async function sceneSatisfies(page: Page, predicate: (s: SceneState) => boolean, timeoutMs = 40_000): Promise<SceneState> {
  const start = Date.now();
  for (;;) {
    const scene = await activeScene(page);
    if (predicate(scene)) return scene;
    if (Date.now() - start > timeoutMs) throw new Error('sceneSatisfies: predicate not met in time');
    await page.waitForTimeout(150);
  }
}

/** Hold a button until the predicate over scene state passes, then release. */
export async function holdUntil(page: Page, gx: number, gy: number, predicate: (s: SceneState) => boolean, timeoutMs = 40_000): Promise<void> {
  const { left, top, sx, sy } = await canvasScale(page);
  await page.mouse.move(left + gx * sx, top + gy * sy);
  await page.mouse.down();
  try {
    await sceneSatisfies(page, predicate, timeoutMs);
  } finally {
    await page.mouse.up();
  }
  await page.waitForTimeout(120);
}

export async function hold(page: Page, gx: number, gy: number, ms: number): Promise<void> {
  const { left, top, sx, sy } = await canvasScale(page);
  await page.mouse.move(left + gx * sx, top + gy * sy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

/**
 * Save helpers. SAVE_KEY cannot be referenced inside page.evaluate — that body runs in the
 * browser, where a Node-side binding does not exist — so it is passed in as an argument.
 */
export async function clearSave(page: Page): Promise<void> {
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
}

export async function readSave<T = Record<string, unknown>>(page: Page): Promise<T | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as unknown) : null;
  }, SAVE_KEY) as Promise<T | null>;
}

export async function writeSave(page: Page, save: unknown): Promise<void> {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, JSON.stringify(save)] as const);
}

/** A completed-Learn save that unlocks the Shift levels, used by several specs. */
export function shiftUnlockedSave(): Record<string, unknown> {
  return {
    version: 1,
    settings: { sound: false, vibration: false, reduceAnimations: true },
    progress: {
      learn: [100, 100, 100, 100, 100],
      practice: [100, 100, 100, 100, 100],
      shift: Array.from({ length: 9 }, () => ({ stars: 1, best: 70 })),
    },
    rank: 'barista',
    mastery: {},
    errorTagCounts: {},
    stats: { drinksServed: 0, perfectOrders: 0, shiftsPlayed: 0 },
  };
}

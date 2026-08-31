/**
 * Captures repo screenshots from the production container (port 4180)
 * by driving the real UI — no dev hooks. Output: docs/screenshots/*.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = `http://127.0.0.1:${process.env.APP_PORT ?? 4180}`;
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-screen="menu"]', { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
await shot('01-menu');

await page.click('[data-action="mode"]');
await page.waitForSelector('[data-screen="mode"]');
await page.waitForTimeout(400);
await shot('02-modes');

await page.click('[data-mode="learn"]');
await page.waitForSelector('[data-screen="levels"]');
await page.waitForTimeout(400);
await shot('03-levels');

await page.click('[data-action="mode"]');
await page.waitForSelector('[data-screen="mode"]');
await page.click('[data-action="menu"]');
await page.waitForSelector('[data-screen="menu"]');
await page.click('[data-action="recipe-book"]');
await page.waitForSelector('[data-screen="recipe-book"]');
await page.waitForTimeout(400);
await shot('04-recipe-book');

await page.click('[data-action="menu"]');
await page.waitForSelector('[data-screen="menu"]');
await page.click('[data-action="settings"]');
await page.waitForSelector('[data-screen="settings"]');
await page.waitForTimeout(400);
await shot('05-settings');

// Gameplay: Learn L1 through the real UI
await page.click('[data-action="menu"]');
await page.waitForSelector('[data-screen="menu"]');
await page.click('[data-action="mode"]');
await page.waitForSelector('[data-screen="mode"]');
await page.click('[data-mode="learn"]');
await page.waitForSelector('[data-screen="levels"]');
await page.click('[data-level="L1"]');
await page.waitForTimeout(2500); // boot scene + first order render

const canvas = page.locator('#game-canvas canvas');
await shot('06-game-espresso');
// milk + assembly tabs (text buttons at 65/195/325, y 290 in 390x844 game space)
const rect = await canvas.boundingBox();
const tapGame = async (gx, gy) => {
  await page.mouse.click(rect.x + (gx / 390) * rect.width, rect.y + (gy / 844) * rect.height);
  await page.waitForTimeout(600);
};
await tapGame(195, 290); // Milk tab
await shot('07-game-milk');
await tapGame(325, 290); // Assembly tab
await shot('08-game-assembly');

await browser.close();
console.log(`screenshots saved to ${OUT}`);

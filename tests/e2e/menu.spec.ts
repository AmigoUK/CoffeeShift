import { expect, test } from '@playwright/test';
import { waitForBoot } from './helpers';

test.describe('DOM shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
  });

  test('main menu shows title, version chip and credit footer', async ({ page }) => {
    await expect(page.locator('.screen__title')).toHaveText('Coffee Shift');
    await expect(page.locator('.version-chip')).toHaveText(/^v\d+\.\d+\.\d+$/);
    const footer = page.locator('.app-footer');
    await expect(footer).toContainText('dev@attv.uk');
    await expect(footer).toContainText('Project & Development: Tomasz');
    await expect(footer).toContainText('www.attv.uk');
    await expect(footer).toContainText('GitHub');
    await expect(footer.locator('a[href="mailto:dev@attv.uk"]')).toHaveCount(1);
    await expect(footer.locator('a[href="https://www.attv.uk"]')).toHaveCount(1);
    await expect(footer.locator('a[href="https://github.com/AmigoUK/CoffeeShift"]')).toHaveCount(1);
  });

  test('mode select locks Practise and Shift until Learn is done', async ({ page }) => {
    await page.click('[data-action="mode"]');
    await expect(page.locator('[data-screen="mode"]')).toBeVisible();
    const cards = page.locator('.mode-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).not.toBeDisabled();
    await expect(cards.nth(1)).toBeDisabled();
    await expect(cards.nth(2)).toBeDisabled();
  });

  test('level select shows L1 open and the rest locked', async ({ page }) => {
    await page.click('[data-action="mode"]');
    await page.click('[data-mode="learn"]');
    await expect(page.locator('[data-screen="levels"]')).toBeVisible();
    const levels = page.locator('.level-card');
    await expect(levels).toHaveCount(5);
    await expect(levels.nth(0)).not.toBeDisabled();
    for (let i = 1; i < 5; i++) {
      await expect(levels.nth(i)).toBeDisabled();
    }
  });

  test('recipe book renders all five drinks plus House Standard notes', async ({ page }) => {
    await page.click('[data-action="recipe-book"]');
    await expect(page.locator('[data-screen="recipe-book"]')).toBeVisible();
    await expect(page.locator('.recipe-card h3')).toHaveText([
      'Espresso', 'Americano', 'Latte', 'Cappuccino', 'Flat white',
    ]);
    const disclaimers = page.locator('.disclaimer');
    expect(await disclaimers.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('[data-screen="recipe-book"]')).toContainText('Long Black is traditionally made water-first');
  });

  test('settings toggles persist across a reload', async ({ page }) => {
    await page.click('[data-action="settings"]');
    await expect(page.locator('[data-screen="settings"]')).toBeVisible();
    await page.click('#set-sound');
    await page.click('#set-reduce');
    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem('coffee-shift.save.v1');
      if (raw == null) return null;
      const parsed = JSON.parse(raw) as { settings?: { sound?: boolean; reduceAnimations?: boolean } };
      return parsed.settings ?? null;
    });
    expect(persisted).toMatchObject({ sound: false, reduceAnimations: true });

    await page.reload();
    await waitForBoot(page);
    await page.click('[data-action="settings"]');
    await expect(page.locator('#set-sound')).not.toBeChecked();
    await expect(page.locator('#set-reduce')).toBeChecked();
    await expect(page.locator('#set-vibration')).toBeChecked();
  });
});

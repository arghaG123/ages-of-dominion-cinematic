/**
 * Playwright viewport smoke flows — title → new game → realm primary actions.
 * Run: npx playwright test
 */
import { test, expect } from 'playwright/test';

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '412x915', width: 412, height: 915 },
];

for (const vp of VIEWPORTS) {
  test(`first session chrome @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ages of Dominion' })).toBeVisible();
    const newGame = page.getByRole('button', { name: 'New Game' });
    await expect(newGame).toBeVisible();
    const box = await newGame.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await newGame.click();
    await expect(page.getByRole('heading', { name: 'Choose your commander' })).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).click();
    await expect(page.getByRole('button', { name: /To the realm|Build Quarry|Continue/i }).first()).toBeVisible({ timeout: 5000 });
  });
}

test('a11y primary targets on title', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  for (const name of ['New Game', 'Load Game', 'Saves & Backups']) {
    const btn = page.getByRole('button', { name });
    const box = await btn.boundingBox();
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
});


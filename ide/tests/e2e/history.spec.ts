import { test, expect } from '../fixtures';

test.describe('History Tab', () => {
  test('should load without errors', async ({ page, nexus }) => {
    await page.route('**/api/vibe/history', async (route) => {
      await route.fulfill({ json: { history: [] } });
    });
    await nexus.goto();
    await nexus.navigateTo('History');
    await page.waitForTimeout(2000);
    // The tab should at minimum have the main content area
    const main = page.locator('main').first();
    await expect(main).toBeVisible({ timeout: 8000 });
  });

  test('should handle empty history gracefully', async ({ page, nexus }) => {
    await page.route('**/api/vibe/history', async (route) => {
      await route.fulfill({ json: { history: [] } });
    });
    await nexus.goto();
    await nexus.navigateTo('History');
    await page.waitForTimeout(1000);
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });
});

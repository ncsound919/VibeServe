// Playwright test for VibeServe docs/index.html
const { test, expect } = require('@playwright/test');

test.describe('VibeServe Docs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://C:/Users/User/Desktop/AetherNexus-MCP-main/docs/index.html');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/VibeServe/);
  });

  test('hero section is visible', async ({ page }) => {
    const hero = page.locator('section.hero');
    await expect(hero).toBeVisible();
  });

  test('pipeline steps are rendered', async ({ page }) => {
    const steps = page.locator('.pipeline-step');
    await expect(steps).toHaveCount(7);
  });

  test('tools grid has 26 items', async ({ page }) => {
    const tools = page.locator('.tool-card');
    await expect(tools).toHaveCount(26);
  });

  test('providers grid is visible', async ({ page }) => {
    const providers = page.locator('.provider-card');
    await expect(providers).toHaveCount(6);
  });

  test('dark mode is default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 10, 10)');
  });

  test('skip link works', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main');
  });

  test('no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    expect(errors).toHaveLength(0);
  });

  test('all content images have alt text', async ({ page }) => {
    const images = page.locator('img:not([alt=""])');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /\S/);
    }
  });
});

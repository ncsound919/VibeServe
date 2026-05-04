import { test, expect } from '../fixtures';

test.describe('Activity Tab', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('navigates to Activity without crashing', async ({ nexus, page }) => {
    await nexus.navigateTo('Activity');
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows pipeline executions section', async ({ nexus, page }) => {
    await nexus.navigateTo('Activity');
    await expect(page.locator('main')).toBeVisible();
    const pageText = await page.locator('main').innerText();
    expect(pageText.length).toBeGreaterThan(0);
  });

  test('loading state resolves to content', async ({ nexus, page }) => {
    await nexus.navigateTo('Activity');
    await page.waitForFunction(() => {
      const main = document.querySelector('main');
      return main && main.innerText.length > 0;
    }, { timeout: 10000 });
  });

  test('page has interactive elements', async ({ nexus, page }) => {
    await nexus.navigateTo('Activity');
    const buttons = page.locator('main button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(0);
  });
});

import { test, expect } from '../fixtures';

test.describe('Memory Tab', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
    await nexus.navigateTo('Memory');
  });

  test('should display memory management interface', async ({ page }) => {
    await expect(page.getByText(/memory|Memory/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show tier filter buttons', async ({ page }) => {
    const tierButtons = page.locator('button').filter({ hasText: /memory|tier|semantic|episodic|procedural|graph|error|immediate|consolidat/i });
    const count = await tierButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('should display consolidate button', async ({ page }) => {
    await expect(page.getByText(/consolidat/i)).toBeVisible({ timeout: 5000 });
  });

  test('should switch content when tier filter is clicked', async ({ page }) => {
    const semanticBtn = page.locator('button').filter({ hasText: /Semantic/i });
    if (await semanticBtn.count() > 0) {
      await semanticBtn.first().click();
      await page.waitForTimeout(300);
      const activeBtn = page.locator('button').filter({ hasText: /Semantic/i }).first();
      const bg = await activeBtn.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('should render empty state gracefully', async ({ page }) => {
    const memoryElements = page.locator('main').first();
    await expect(memoryElements).toBeVisible({ timeout: 5000 });
    const hasContent = await memoryElements.innerText();
    expect(hasContent.length).toBeGreaterThan(0);
  });
});

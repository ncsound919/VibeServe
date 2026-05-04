import { test, expect } from '../fixtures';

test.describe('Performance & Resilience', () => {
  test('page loads within 8 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForFunction(
      () => document.body.innerText.length > 100 && !document.body.innerText.includes('Initializing Nexus'),
      { timeout: 15000 },
    );
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  test('no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForFunction(
      () => document.body.innerText.length > 100 && !document.body.innerText.includes('Initializing Nexus'),
      { timeout: 15000 },
    );
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    const critical = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('extension') &&
        !e.includes('net::ERR') &&
        !e.includes('WebSocket') &&
        !e.includes('429'),
    );
    expect(critical).toEqual([]);
  });

  test('navigation tab switch completes in under 2 seconds', async ({ nexus, page }) => {
    await nexus.goto();
    const tabs = ['Pipeline', 'YouTube Pulse', 'Repo Analysis', 'Settings'] as const;
    for (const tab of tabs) {
      const start = Date.now();
      await nexus.navigateTo(tab);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    }
  });

  test('stat cards render within 5 seconds of page load', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const cards = page.locator('[data-testid="stat-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('app renders without unhandled promise rejections', async ({ page }) => {
    const rejections: string[] = [];
    page.on('pageerror', (err) => rejections.push(err.message));
    await page.goto('/');
    await page.waitForFunction(
      () => document.body.innerText.length > 100 && !document.body.innerText.includes('Initializing Nexus'),
      { timeout: 15000 },
    );
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    const critical = rejections.filter(
      (r) => !r.includes('WebSocket') && !r.includes('fetch'),
    );
    expect(critical).toEqual([]);
  });

  test('page has reasonable DOM size', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.body.innerText.length > 100 && !document.body.innerText.includes('Initializing Nexus'),
      { timeout: 15000 },
    );
    const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(elementCount).toBeLessThan(2000);
  });
});

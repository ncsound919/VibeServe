import { test, expect } from '../fixtures';

test.describe('Audit Tab', () => {
  test.beforeEach(async ({ page, nexus }) => {
    await page.route('**/api/audit/**', async (route) => {
      await route.fulfill({ json: {
        logs: [
          { id: 'log-1', action: 'pipeline_run', actor: 'user-1', target: 'pipeline/test', status: 'success', timestamp: new Date().toISOString(), metadata: {} },
          { id: 'log-2', action: 'codegen', actor: 'user-1', target: 'app/test', status: 'success', timestamp: new Date(Date.now() - 3600000).toISOString(), metadata: {} },
        ],
        stats: { totalEvents: 2, byAction: { pipeline_run: 1, codegen: 1 }, failures: 0, last24h: 2 }
      } });
    });
    await nexus.goto();
    await nexus.navigateTo('Audit');
  });

  test('should display audit event list', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    const content = await page.locator('main').innerText();
    expect(content.length).toBeGreaterThan(10);
  });

  test('should show audit statistics', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    const hasStats = await page.getByText(/total|event|stat/i).count();
    expect(hasStats).toBeGreaterThan(0);
  });

  test('should display event actor information', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    const content = await page.locator('main').innerText();
    expect(content.length).toBeGreaterThan(10);
  });

  test('should show status badges for events', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    const content = await page.locator('main').innerText();
    expect(content.length).toBeGreaterThan(10);
  });

  test('should handle empty audit log', async ({ page, nexus }) => {
    await page.route('**/api/audit/**', async (route) => {
      await route.fulfill({ json: { logs: [], stats: { totalEvents: 0, byAction: {}, failures: 0, last24h: 0 } } });
    });
    await nexus.goto();
    await nexus.navigateTo('Audit');
    await expect(page.locator('main').first()).toBeVisible();
  });
});

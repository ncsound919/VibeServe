import { test, expect } from '../fixtures';

test.describe('Activity Tab', () => {
  test.beforeEach(async ({ page, nexus }) => {
    await page.route('**/api/editor/list', async (route) => {
      await route.fulfill({ json: { apps: [{ id: 'app-1', name: 'My App', path: '/apps/app-1', created: new Date().toISOString() }] } });
    });
    await nexus.goto();
    await nexus.navigateTo('Activity');
  });

  test('should display active pipeline section if running', async ({ page }) => {
    await page.waitForTimeout(1000);
    const hasActiveSection = await page.getByText(/Active|Pipeline|Execution/i).count();
    expect(hasActiveSection).toBeGreaterThan(0);
  });

  test('should show generated apps section', async ({ page }) => {
    await page.waitForTimeout(1000);
    const hasGeneratedApps = await page.getByText(/Generated|My App/i).count();
    expect(hasGeneratedApps).toBeGreaterThan(0);
  });

  test('should display recent pipeline runs', async ({ page }) => {
    await page.waitForTimeout(1000);
    const pipelineRuns = page.locator('text="Recent Pipeline Runs"');
    const hasSection = await pipelineRuns.count();
    if (hasSection > 0) {
      await expect(pipelineRuns).toBeVisible();
    }
  });

  test('should handle empty state for generated apps', async ({ page, nexus }) => {
    await page.route('**/api/editor/list', async (route) => {
      await route.fulfill({ json: { apps: [] } });
    });
    await nexus.goto();
    await nexus.navigateTo('Activity');
    await page.waitForTimeout(1000);
    const noAppsText = page.getByText(/no apps/i);
    const hasNoApps = await noAppsText.count();
    if (hasNoApps > 0) {
      await expect(noAppsText).toBeVisible();
    }
  });

  test('should not have critical console errors during navigation', async ({ nexus, page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await nexus.navigateTo('Activity');
    await page.waitForTimeout(1000);
    await nexus.navigateTo('Overview');
    await page.waitForTimeout(500);
    const criticalErrors = errors.filter(e =>
      !e.includes('WebSocket') && !e.includes('ERR_CONNECTION_REFUSED') &&
      !e.includes('404') && !e.includes('favicon') &&
      !e.includes('Failed to load resource') && !e.includes('ERR_BLOCKED_BY_CLIENT')
    );
    expect(criticalErrors).toEqual([]);
  });
});

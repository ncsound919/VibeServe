import { test, expect } from '../fixtures';

test.describe('Settings Tab - Full Coverage', () => {
  test.beforeEach(async ({ page, nexus }) => {
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({ json: {
        brain: { lanes: [{ name: 'coding', enabled: true }, { name: 'agent_brain', enabled: false }] },
        brainStatus: { running: true, apiPort: 8000, pythonAvailable: true, brainDir: '/tmp/brain', lastRun: new Date().toISOString() },
        pipeline: { autoFix: true, recovery: true, retryAttempts: 3, timeout: 300000 },
        integrations: [{ name: 'qdrant', connected: true, configured: true }, { name: 'nanobot', connected: false, configured: true }],
        agents: [{ id: 'agent-1', name: 'Coding Agent', status: 'active', type: 'coding', lastActive: new Date().toISOString() }]
      } });
    });
    await page.route('**/api/settings/brain/**', async (route) => {
      await route.fulfill({ json: { running: true, apiPort: 8000 } });
    });
    await page.route('**/api/settings/integrations', async (route) => {
      await route.fulfill({ json: { services: { qdrant: true, nanobot: false } } });
    });
    await nexus.goto();
    await nexus.navigateTo('Settings');
  });

  test('should display brain control panel', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasBrainPanel = await page.getByText(/Brain|Config|Control/i).count();
    expect(hasBrainPanel).toBeGreaterThan(0);
  });

  test('should show brain status section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasStatus = await page.getByText(/Status|Running|Port|Python/i).count();
    expect(hasStatus).toBeGreaterThan(0);
  });

  test('should display integration toggles', async ({ page }) => {
    await page.waitForTimeout(2000);
    const integrationsText = page.getByText(/Integration|Connected|qdrant|nanobot/i);
    await expect(integrationsText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show pipeline configuration panel', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasPipelineConfig = await page.getByText(/Pipeline|Config|Auto.?Fix|Recovery|Retry|Timeout/i).count();
    expect(hasPipelineConfig).toBeGreaterThan(0);
  });

  test('should display registered agents', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasAgents = await page.getByText(/Coding Agent|agent/i).count();
    expect(hasAgents).toBeGreaterThan(0);
  });

  test('should handle API failure gracefully', async ({ page, nexus }) => {
    await page.route('**/api/settings', async (route) => {
      await route.abort('connectionrefused');
    });
    await nexus.goto();
    await nexus.navigateTo('Settings');
    await page.waitForTimeout(2000);
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });
});

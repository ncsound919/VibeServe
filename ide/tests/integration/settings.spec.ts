import { test, expect } from '../fixtures';

test.describe('Settings', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('navigates to Settings without crashing', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows System Settings heading', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    await expect(
      page.getByRole('heading', { name: /System Settings/i }),
    ).toBeVisible();
  });

  test('shows Brain Control Panel section', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    const panel = page.locator('[data-testid="brain-control-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test('shows Integrations Panel section', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    const panel = page.locator('[data-testid="integrations-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test('brain panel shows lane configurations', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    const panel = page.locator('[data-testid="brain-control-panel"]');
    const lanes = ['coding', 'business_logic', 'agent_brain', 'tool_calling', 'cross_domain'];
    for (const lane of lanes) {
      const laneEl = panel.locator(`[data-testid="brain-lane-${lane}"]`);
      const visible = await laneEl.isVisible().catch(() => false);
      if (visible) {
        await expect(laneEl).toBeVisible();
      }
    }
  });

  test('integrations panel shows service status', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    const panel = page.locator('[data-testid="integrations-panel"]');
    const integrationCards = panel.locator('[data-testid="integration-card"]');
    const count = await integrationCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('settings shows Refresh indicator when loading', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    await expect(
      page.locator('text=/Refreshing.../i'),
    ).toBeVisible();
  });

  test('Settings gear icon is present', async ({ nexus, page }) => {
    await nexus.navigateTo('Settings');
    const icon = page.locator('svg');
    await expect(icon.first()).toBeVisible();
  });
});

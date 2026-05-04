import { test, expect } from '../fixtures';

test.describe('Dashboard (Overview)', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('displays Executive Dashboard heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Executive Dashboard/i }),
    ).toBeVisible();
  });

  test('shows 5 stat cards with numeric values', async ({ page }) => {
    const cards = page.locator('[data-testid="stat-card"]');
    await expect(cards).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i).locator('[data-testid="stat-value"]')).toBeVisible();
    }
  });

  test('stat cards display correct titles', async ({ page }) => {
    const expected = [
      /Intelligence Growth/i,
      /Active Contributors/i,
      /Synthesized Clusters/i,
      /Context Servers/i,
    ];
    const cards = page.locator('[data-testid="stat-card"]');
    for (let i = 0; i < expected.length; i++) {
      const title = cards.nth(i).locator('[data-testid="stat-title"]');
      await expect(title).toContainText(expected[i]);
    }
  });

  test('shows Nexus Progression section', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Nexus Progression/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows Error Tracking dashboard section', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Error Tracking/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows VibeCoder Quality Score section', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /VibeCoder/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows engine optimizations grid', async ({ page }) => {
    const optimizations = page.locator('[data-testid="engine-optimization"]');
    await expect(optimizations).toHaveCount(4);
  });

  test('shows quick action buttons', async ({ page }) => {
    const actions = page.locator('[data-testid="quick-action"]');
    await expect(actions).toHaveCount(3);
  });

  test('quick action navigates to target tab', async ({ nexus, page }) => {
    const discoveryBtn = page.locator('[data-testid="quick-action"]').first();
    await discoveryBtn.click();
    await expect(page.locator('#nav-item-repo-analysis')).toHaveClass(/text-emerald-400/);
  });

  test('shows Growth Trajectory chart', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Growth Trajectory/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows Predictive Analysis cards', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Predictive Analysis/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows API Signal Stream', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /API Signal Stream/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows Analysis Feed', async ({ page }) => {
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Analysis Feed/i,
    });
    await expect(section).toBeVisible();
  });

  test('shows Neural Link Active status indicator', async ({ page }) => {
    await expect(
      page.locator('text=/Neural Link Active/i'),
    ).toBeVisible();
  });

  test('system status indicator renders', async ({ page }) => {
    const status = page.locator('text=/Nexus_IDLE|Nexus_AGENT_SYNC|Nexus_DATA_FETCH|Nexus_TEAM_DEV/i');
    await expect(status).toBeVisible();
  });

  test('autonomous integrity score is visible on desktop', async ({ page }) => {
    await expect(page.locator('text=/Autonomous Integrity/i')).toBeVisible();
    await expect(page.locator('text=/99.98%/i')).toBeVisible();
  });
});

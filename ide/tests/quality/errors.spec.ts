import { test, expect } from '../fixtures';

test.describe('Error Tracking & Self-Healing', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('Error Tracking section header is visible', async ({ page }) => {
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /Error Tracking/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows 4 error stat cards', async ({ page }) => {
    const cards = page.locator('[data-testid="error-stat-card"]');
    await expect(cards).toHaveCount(4);
  });

  test('shows total errors count', async ({ page }) => {
    const totalCard = page.locator('[data-testid="error-stat-card"]').first();
    await expect(totalCard).toContainText(/Total/i);
    await expect(totalCard.locator('[data-testid="error-stat-value"]')).toContainText(/\d+/);
  });

  test('shows failure streak', async ({ page }) => {
    const streakCard = page.locator('[data-testid="error-stat-card"]').nth(1);
    await expect(streakCard).toContainText(/Failure Streak/i);
  });

  test('shows recent 24h failures', async ({ page }) => {
    const recentCard = page.locator('[data-testid="error-stat-card"]').nth(2);
    await expect(recentCard).toContainText(/Recent 24h/i);
  });

  test('shows recovery rate', async ({ page }) => {
    const recoveryCard = page.locator('[data-testid="error-stat-card"]').nth(3);
    await expect(recoveryCard).toContainText(/Recovery Rate/i);
  });

  test('shows errors by category breakdown', async ({ page }) => {
    const section = page.locator('text=/By Category/i');
    await expect(section).toBeVisible();
    const categories = ['network', 'build', 'api', 'system'];
    for (const cat of categories) {
      await expect(page.locator(`text=/${cat}/i`).first()).toBeVisible();
    }
  });

  test('shows errors by severity breakdown', async ({ page }) => {
    const section = page.locator('text=/By Severity/i');
    await expect(section).toBeVisible();
    await expect(page.locator('text=/low/i')).toBeVisible();
    await expect(page.locator('text=/medium/i')).toBeVisible();
    await expect(page.locator('text=/high/i')).toBeVisible();
  });

  test('shows recent errors list with severity badges', async ({ page }) => {
    const errorItems = page.locator('[data-testid="error-item"]');
    await expect(errorItems.first()).toBeVisible();
    await expect(errorItems.first().locator('[data-testid="error-severity"]')).toBeVisible();
  });

  test('unresolved errors show Resolve button', async ({ page }) => {
    const unresolvedItem = page.locator('[data-testid="error-item"]').first();
    const resolveBtn = unresolvedItem.locator('button', { hasText: /Resolve/i });
    await expect(resolveBtn).toBeVisible();
  });

  test('resolved errors show check icon', async ({ page }) => {
    const resolvedItems = page.locator('[data-testid="error-item"][data-resolved="true"]');
    await expect(resolvedItems.first()).toBeVisible();
  });

  test('shows recovery patterns section when available', async ({ page }) => {
    const header = page.locator('text=/Recovery Patterns/i');
    await expect(header).toBeVisible();
    const patterns = page.locator('[data-testid="recovery-pattern"]');
    await expect(patterns.first()).toBeVisible();
  });

  test('active failures badge shows when streak > 0', async ({ page }) => {
    await expect(
      page.locator('text=/Active Failures/i'),
    ).toBeVisible();
  });
});

import { test, expect } from '../fixtures';

test.describe('Repo Analysis', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('navigates to Repo Analysis without crashing', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows Source Intelligence header', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /Source Intelligence/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows repo count in subtitle', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    await expect(
      page.locator('text=/\d+ repos/i'),
    ).toBeVisible();
  });

  test('SCAN TRENDS button is present', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    await expect(
      page.locator('button', { hasText: /SCAN TRENDS/i }),
    ).toBeVisible();
  });

  test('DEEPSEEK CURATED badge is visible', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    await expect(
      page.locator('text=/DEEPSEEK CURATED/i'),
    ).toBeVisible();
  });

  test('displays repo cards with analysis data', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const cards = page.locator('[data-testid="repo-card"]');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().locator('[data-testid="repo-name"]')).toBeVisible();
    await expect(cards.first().locator('[data-testid="repo-analysis-text"]')).toBeVisible();
  });

  test('repo cards show star count and growth', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const card = page.locator('[data-testid="repo-card"]').first();
    await expect(card.locator('[data-testid="repo-stars"]')).toBeVisible();
    await expect(card.locator('[data-testid="repo-growth"]')).toBeVisible();
  });

  test('repo cards show stack and utility info', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const card = page.locator('[data-testid="repo-card"]').first();
    await expect(card).toContainText(/Stack Spectrum/i);
    await expect(card).toContainText(/Functional Utility/i);
  });

  test('selecting repo shows selection indicator', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const card = page.locator('[data-testid="repo-card"]').first();
    await card.click();
    await expect(
      page.locator('text=/\d+ Repos Ready/i'),
    ).toBeVisible();
  });

  test('synth action bar appears after selection', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const card = page.locator('[data-testid="repo-card"]').first();
    await card.click();
    await expect(
      page.locator('button', { hasText: /Synthesize & Build/i }),
    ).toBeVisible();
  });

  test('RESET SELECTION clears selected repos', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    await page.locator('[data-testid="repo-card"]').first().click();
    await expect(page.locator('text=/\d+ Repos Ready/i')).toBeVisible();
    await page.locator('button', { hasText: /RESET_SELECTION/i }).first().click();
    await expect(page.locator('text=/\d+ Repos Ready/i')).toHaveCount(0);
  });

  test('repo cards display tags', async ({ nexus, page }) => {
    await nexus.navigateTo('Repo Analysis');
    const tags = page.locator('[data-testid="repo-tag"]');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });
});

import { test, expect } from '../fixtures';

test.describe('VibeCoder Tab Prompt', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('shows VibeCoder prompt as default landing page', async ({ page }) => {
    await expect(page.getByText('What do you want to build?')).toBeVisible({ timeout: 10000 });
  });

  test('has 5 example suggestion chips', async ({ page }) => {
    await expect(page.getByText('A landing page for my startup')).toBeVisible();
    await expect(page.getByText('A todo app with login')).toBeVisible();
    await expect(page.getByText('An e-commerce store')).toBeVisible();
    await expect(page.getByText('A blog with a CMS')).toBeVisible();
    await expect(page.getByText('A SaaS dashboard')).toBeVisible();
  });

  test('can type in the prompt textarea', async ({ page }) => {
    const textarea = page.getByLabel('App description');
    await textarea.fill('A weather dashboard');
    await expect(textarea).toHaveValue('A weather dashboard');
  });

  test('suggestion chip auto-fills textarea', async ({ page }) => {
    await page.getByText('A todo app with login').click();
    const textarea = page.getByLabel('App description');
    await expect(textarea).toHaveValue('A todo app with login');
  });

  test('generate button is accessible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /generate/i });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Generate app');
  });

  test('generate button disabled when textarea is empty', async ({ page }) => {
    const textarea = page.getByLabel('App description');
    await textarea.fill('');
    const btn = page.getByRole('button', { name: /generate/i });
    await expect(btn).toBeDisabled();
  });

  test('generate button enabled when textarea has content', async ({ page }) => {
    const textarea = page.getByLabel('App description');
    await textarea.fill('test app');
    const btn = page.getByRole('button', { name: /generate/i });
    await expect(btn).toBeEnabled();
  });
});

test.describe('VibeCoder Quality Score', () => {
  test.beforeEach(async ({ nexus, page }) => {
    await nexus.goto();
    await page.getByRole('button', { name: /Advanced/i }).click();
    await page.locator('#nav-item-overview').click();
    await page.waitForTimeout(500);
  });

  test('VibeCoder section header is visible', async ({ page }) => {
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /VibeCoder Quality Score/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows build count badge when builds exist', async ({ page }) => {
    const badge = page.locator('text=/\d+ build\(s\)/i');
    await expect(badge).toBeVisible();
  });

  test('displays grade letter in hero card', async ({ page }) => {
    const gradeLetter = page.locator('[data-testid="vibe-grade-letter"]');
    await expect(gradeLetter).toBeVisible();
  });

  test('shows total score out of max', async ({ page }) => {
    await expect(
      page.locator('text=/points/i'),
    ).toBeVisible();
  });

  test('displays quality gate cards from API', async ({ page }) => {
    const gates = page.locator('[data-testid="vibe-gate"]');
    await expect(gates).toHaveCount(5);
  });

  test('gate cards show pass/fail status', async ({ page }) => {
    const gates = page.locator('[data-testid="vibe-gate"]');
    const firstGate = gates.first();
    await expect(firstGate.locator('[data-testid="gate-score"]')).toBeVisible();
    await expect(firstGate.locator('[data-testid="gate-name"]')).toBeVisible();
  });

  test('shows Re-Check button', async ({ page }) => {
    const recheckBtn = page.locator('button', { hasText: /Re-Check/i });
    await expect(recheckBtn).toBeVisible();
  });

  test('shows AI improvement insights section', async ({ page }) => {
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /AI Improvement Insights/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows history stats: best, average, streak', async ({ page }) => {
    const stats = page.locator('[data-testid="vibe-stat"]');
    await expect(stats).toHaveCount(3);
    await expect(stats.nth(0)).toContainText(/Best Score/i);
    await expect(stats.nth(1)).toContainText(/Average/i);
    await expect(stats.nth(2)).toContainText(/Streak/i);
  });

  test('shows score trend chart when multiple builds exist', async ({ page }) => {
    const trend = page.locator('[data-testid="vibe-trend"]');
    await expect(trend).toBeVisible();
  });

  test('progress bar shows correct percentage', async ({ page }) => {
    const bar = page.locator('[data-testid="vibe-progress-bar"]');
    await expect(bar).toBeVisible();
    const inner = bar.locator('div');
    await expect(inner).toHaveAttribute('style', /width:/);
  });
});

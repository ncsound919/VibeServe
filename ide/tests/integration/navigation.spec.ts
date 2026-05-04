import { test, expect } from '../fixtures';

test.describe('Navigation - Tabs', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('VibeCoder tab is the default landing tab', async ({ page }) => {
    const vibeTab = page.locator('#nav-item-vibecoder');
    await expect(vibeTab).toBeVisible();
    await expect(vibeTab).toHaveClass(/text-emerald-400/);
  });

  test('all sidebar navigation tabs are present after expanding Advanced', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    const tabs = [
      'VibeCoder',
      'Overview',
      'Pipeline',
      'Activity',
      'History',
      'Command Center',
      'Settings',
    ];
    for (const tab of tabs) {
      const id = `#nav-item-${tab.toLowerCase().replace(/\s+/g, '-')}`;
      await expect(page.locator(id)).toBeVisible();
    }
  });

  test('navigating to each tab preserves main content', async ({ nexus, page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    const tabs = [
      'Overview',
      'Pipeline',
      'Activity',
      'History',
      'Command Center',
      'Settings',
    ] as const;
    for (const tab of tabs) {
      await nexus.navigateTo(tab);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('active tab has correct visual style', async ({ nexus, page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    await nexus.navigateTo('Pipeline');
    const pipelineTab = page.locator('#nav-item-pipeline');
    await expect(pipelineTab).toHaveClass(/text-emerald-400/);
  });

  test('no console errors during navigation through all tabs', async ({ nexus, page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const tabs = [
      'Overview',
      'Pipeline',
      'Activity',
      'History',
      'Command Center',
      'Settings',
      'VibeCoder',
    ] as const;
    for (const tab of tabs) {
      await nexus.navigateTo(tab);
    }

    const critical = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('extension') &&
        !e.includes('net::ERR') &&
        !e.includes('WebSocket') &&
        !e.includes('429') &&
        !e.includes('Supabase'),
    );
    expect(critical).toEqual([]);
  });
});

test.describe('Navigation - Advanced Section', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('Advanced section is initially collapsed', async ({ page }) => {
    const advancedBtn = page.getByRole('button', { name: /Advanced/i });
    await expect(advancedBtn).toBeVisible({ timeout: 10000 });
    await expect(advancedBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#nav-item-overview')).not.toBeVisible();
  });

  test('Advanced section can be expanded', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    await expect(page.locator('#nav-item-overview')).toBeVisible();
    await expect(page.locator('#nav-item-pipeline')).toBeVisible();
    await expect(page.locator('#nav-item-settings')).toBeVisible();
  });

  test('can navigate to Settings tab through Advanced', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    await page.locator('#nav-item-settings').click();
    await expect(page.getByText(/System Settings/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Privacy Mode/i)).toBeVisible();
  });

  test('can navigate to Pipeline tab through Advanced', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    await page.locator('#nav-item-pipeline').click();
    await expect(page.getByText('Nexus Automated Pipeline')).toBeVisible({ timeout: 10000 });
  });

  test('collapsing Advanced hides sub-tabs', async ({ page }) => {
    const advancedBtn = page.getByRole('button', { name: /Advanced/i });
    await advancedBtn.click();
    await expect(page.locator('#nav-item-overview')).toBeVisible();
    await advancedBtn.click();
    await expect(advancedBtn).toHaveAttribute('aria-expanded', 'false');
  });
});

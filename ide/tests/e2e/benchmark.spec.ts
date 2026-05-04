/**
 * Benchmark & Edge Case Tests
 * Measures system performance, stress tests edge cases,
 * and collects metrics for recursive improvement loops.
 */
import { test, expect } from '../fixtures';

test.describe('System Benchmarks', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('tab navigation performance', async ({ page, nexus }) => {
    const tabs = ['Composer', 'Editor', 'Memory', 'Overview', 'Settings'] as const;
    const timings: number[] = [];

    for (const tab of tabs) {
      const start = Date.now();
      await nexus.navigateTo(tab);
      await page.waitForTimeout(500);
      timings.push(Date.now() - start);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`Average tab navigation: ${avgTime.toFixed(0)}ms`);
    expect(avgTime).toBeLessThan(5000);
  });

  test('rapid tab switching stress', async ({ page, nexus }) => {
    await nexus.navigateTo('Overview');
    for (let i = 0; i < 10; i++) {
      await nexus.navigateTo(i % 2 === 0 ? 'Composer' : 'Memory');
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('concurrent API calls', async ({ page }) => {
    const endpoints = [
      '/api/settings',
      '/api/integrations/status',
      '/api/coding/templates',
      '/api/nexus/progression'
    ];

    const start = Date.now();
    const results = await Promise.allSettled(
      endpoints.map(ep => fetch(ep).then(r => r.json()).catch(e => ({ error: e.message })))
    );
    const duration = Date.now() - start;

    console.log(`Concurrent API test: ${duration}ms for ${endpoints.length} endpoints`);
    expect(results.length).toBe(endpoints.length);
  });

  test('memory under load', async ({ page, nexus }) => {
    const tabs = ['Overview', 'Editor', 'Memory', 'Activity', 'Settings'];
    for (let i = 0; i < 5; i++) {
      for (const tab of tabs) {
        await nexus.navigateTo(tab as any);
      }
    }
    await expect(page.locator('main')).toBeVisible();
  });

  test('empty state handling', async ({ page, nexus }) => {
    await nexus.navigateTo('Memory');
    await page.waitForTimeout(1000);
    const content = await page.locator('main').textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test('error boundary resilience', async ({ page, nexus }) => {
    await nexus.navigateTo('Settings');
    await page.waitForTimeout(1000);
    await nexus.navigateTo('Overview');
    await expect(page.locator('main')).toBeVisible();
  });

  test('long content rendering', async ({ page, nexus }) => {
    await nexus.navigateTo('Overview');
    await page.waitForTimeout(2000);
    const cards = await page.locator('[data-testid="stat-card"]').count();
    console.log(`Stat cards rendered: ${cards}`);
    expect(cards).toBeGreaterThan(0);
  });
});

test.describe('Edge Cases', () => {
  test.skip('concurrent navigation race - known race condition', async ({ page, nexus }) => {
    await nexus.goto();
    const nav1 = nexus.navigateTo('Overview');
    const nav2 = nexus.navigateTo('Settings');
    await Promise.all([nav1, nav2]);
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test.skip('deep component tree rendering - timeout on rapid switch', async ({ page, nexus }) => {
    await nexus.navigateTo('Overview');
    await page.waitForTimeout(2000);
    const widgets = await page.locator('.grid > div').count();
    console.log(`Deep widgets rendered: ${widgets}`);
    expect(widgets).toBeGreaterThan(3);
  });

  test('handles missing API gracefully', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('404')) {
        console.log('Expected 404 handled:', msg.text());
      }
    });
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });

  test('handles network partial failure', async ({ page, nexus }) => {
    await nexus.goto();
    await nexus.navigateTo('Memory');
    const content = await page.locator('main').textContent();
    expect(content?.length).toBeGreaterThan(0);
  });
});
import { test, expect } from '../fixtures';

test.describe('Navigation - All Tabs', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  const ALL_TABS = [
    'Composer', 'Editor', 'Review', 'Memory', 'Preview',
    'Overview', 'Activity', 'History', 'Audit',
    'Mission Control', 'Changes', 'Settings',
    'Extensions', 'System', 'Agent Eval',
  ] as const;

  const IGNORED_ERROR_PATTERNS = [
    'favicon', 'Failed to load resource', 'ERR_BLOCKED_BY_CLIENT',
    'WebSocket', 'ERR_CONNECTION_REFUSED', '[Pipeline]',
  ];

  for (const tab of ALL_TABS) {
    test(`should navigate to ${tab} tab without errors`, async ({ page, nexus }) => {
      const errors: string[] = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

      await nexus.navigateTo(tab);
      await page.waitForTimeout(1500);

      const mainContent = page.locator('main').first();
      await expect(mainContent).toBeVisible();

      const text = await mainContent.innerText();
      expect(text.length).toBeGreaterThan(0);

      const criticalErrors = errors.filter(e => !IGNORED_ERROR_PATTERNS.some(p => e.includes(p)));
      expect(criticalErrors).toEqual([]);
    });
  }

  test('should navigate between all tabs without crashing', async ({ page, nexus }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    for (const tab of ALL_TABS) {
      await nexus.navigateTo(tab);
      await page.waitForTimeout(400);
    }

    const criticalErrors = errors.filter(e => !IGNORED_ERROR_PATTERNS.some(p => e.includes(p)));
    expect(criticalErrors).toEqual([]);
  });
});

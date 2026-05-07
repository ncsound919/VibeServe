import { test, expect } from '@playwright/test';

test.describe('Generated Apps Test', () => {
  test('should load generated apps from API', async ({ page }) => {
    // Mock the API response
    await page.route('**/api/coding-agent/apps', async (route) => {
      await route.fulfill({
        json: { apps: [{ id: 'test-app-1', name: 'Test App', path: '/apps/test-app-1', createdAt: new Date().toISOString() }] }
      });
    });
    
    // Go to the app
    await page.goto('/');
    
    // Navigate to Activity tab (where Generated Apps is)
    await page.click('text=Activity');
    
    // Check if Generated Apps section is visible
    const generatedAppsHeader = page.locator('text=Generated Apps');
    await expect(generatedAppsHeader).toBeVisible();
    
    // Check if the app is listed
    const appItem = page.locator('text=Test App');
    await expect(appItem).toBeVisible();
  });
  
  test('should show empty state when no apps', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/coding-agent/apps', async (route) => {
      await route.fulfill({ json: { apps: [] } });
    });
    
    await page.goto('/');
    await page.click('text=Activity');
    
    // Should show empty state
    const noAppsText = page.locator('text=No apps generated yet');
    await expect(noAppsText).toBeVisible();
  });
});
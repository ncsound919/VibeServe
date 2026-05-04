import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Wait for React to hydrate before checking
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 10000 });
  await expect(page.locator('#root')).toBeVisible();
});

test('nexus logo is visible', async ({ page }) => {
  await page.goto('/');
  // Wait for React to fully hydrate
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 10000 });
  // Now check for the Nexus Alpha branding after hydration
  await expect(page.getByRole('heading', { name: /Nexus Alpha/i })).toBeVisible({ timeout: 10000 });
});

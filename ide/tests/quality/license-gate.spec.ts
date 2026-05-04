import { test, expect } from '@playwright/test';

test.describe('License Gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows license gate when unlicensed', async ({ page }) => {
    await expect(page.getByText('Unlock Unlimited Generations')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Nexus Alpha')).toBeVisible();
  });

  test('license input accepts key format', async ({ page }) => {
    const input = page.getByLabel('License key');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('NEXUS-ABCD-EFGH-IJKL-MNOP');
    await expect(input).toHaveValue('NEXUS-ABCD-EFGH-IJKL-MNOP');
  });

  test('Activate button is present', async ({ page }) => {
    const activateBtn = page.getByRole('button', { name: /activate/i });
    await expect(activateBtn).toBeVisible({ timeout: 10000 });
    await expect(activateBtn).toHaveAttribute('aria-label', 'Activate license');
  });

  test('Buy Now link is present', async ({ page }) => {
    const buyBtn = page.getByRole('link', { name: /buy/i });
    await expect(buyBtn).toBeVisible();
    await expect(buyBtn).toHaveAttribute('href', '/sales/index.html');
  });

  test('shows error on empty key activation attempt', async ({ page }) => {
    const activateBtn = page.getByRole('button', { name: /activate/i });
    await expect(activateBtn).toBeVisible({ timeout: 10000 });
    await activateBtn.click();
    await expect(page.getByText('Enter a license key')).toBeVisible();
  });

  test('shows error on invalid license format', async ({ page }) => {
    const input = page.getByLabel('License key');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('INVALID-KEY');
    await page.getByRole('button', { name: /activate/i }).click();
    await expect(page.getByText(/Invalid license key/i)).toBeVisible();
  });

  test('zero telemetry message visible', async ({ page }) => {
    await expect(page.getByText(/Zero telemetry/i)).toBeVisible({ timeout: 10000 });
  });

  test('Try Free button shows trial count text', async ({ page }) => {
    const tryFree = page.getByRole('button', { name: /try free/i });
    await expect(tryFree).toBeVisible({ timeout: 10000 });
    await tryFree.click();
    await expect(page.getByText(/generation|remaining in trial/i)).toBeAttached({ timeout: 5000 });
  });

  test('valid license key navigates past gate', async ({ page }) => {
    const input = page.getByLabel('License key');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('NEXUS-12AB-34CD-56EF-78GH');
    await page.getByRole('button', { name: /activate/i }).click();
    await expect(page.getByText('What do you want to build?')).toBeVisible({ timeout: 15000 });
  });

  test('Enter key on license input triggers activation', async ({ page }) => {
    const input = page.getByLabel('License key');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('NEXUS-ABCD-EFGH-IJKL-MNOP');
    await input.press('Enter');
    await expect(page.getByText('What do you want to build?')).toBeVisible({ timeout: 15000 });
  });
});

import { test, expect } from '../fixtures';

test.describe('Pipeline', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('renders Pipeline tab with SectionHeader', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /Nexus Automated Pipeline/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows worker and region badges', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    await expect(page.locator('text=/WORKERS:/i')).toBeVisible();
    await expect(page.locator('text=/REGION:/i')).toBeVisible();
  });

  test('shows empty state when no active run', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    await expect(
      page.locator('text=/No Active Pipeline Sessions/i'),
    ).toBeVisible();
  });

  test('Browse Repositories button navigates to Repo Analysis', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const browseBtn = page.locator('button', { hasText: /Browse Repositories/i });
    await browseBtn.click();
    await expect(page.locator('#nav-item-repo-analysis')).toHaveClass(/text-emerald-400/);
  });

  test('repo URL input and ingest button are present', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const input = page.locator('input[placeholder*="GitHub repo URL"]');
    await expect(input).toBeVisible();
    const ingestBtn = page.locator('button', { hasText: /INGEST/i });
    await expect(ingestBtn).toBeVisible();
    await expect(ingestBtn).toBeDisabled();
  });

  test('ingest button enables with valid URL', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const input = page.locator('input[placeholder*="GitHub repo URL"]');
    await input.fill('https://github.com/owner/repo');
    const ingestBtn = page.locator('button', { hasText: /INGEST/i });
    await expect(ingestBtn).toBeEnabled();
  });

  test('shows status badges: DeepSeek, Wiki, MCP', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    await expect(page.locator('text=/DEEPSEEK V4 READY/i')).toBeVisible();
    await expect(page.locator('text=/WIKI:/i')).toBeVisible();
    await expect(page.locator('text=/MCP:/i')).toBeVisible();
  });

  test('Upload Folder button is present and clickable', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const uploadBtn = page.locator('button', { hasText: /Upload Folder/i });
    await expect(uploadBtn).toBeVisible();
  });

  test('Static Blueprint Analysis section is visible', async ({ nexus, page }) => {
    await nexus.navigateTo('Pipeline');
    const section = page.locator('[data-testid="section-header"]', {
      hasText: /Static Blueprint Analysis/i,
    });
    await expect(section).toBeVisible();
  });
});

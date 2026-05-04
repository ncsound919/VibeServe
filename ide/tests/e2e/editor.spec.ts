import { test, expect } from '../fixtures';

test.describe('Editor Tab', () => {
  test.beforeEach(async ({ page, nexus }) => {
    await page.route('**/api/editor/list', async (route) => {
      await route.fulfill({ json: { apps: [{ id: 'app-1', name: 'test-app' }] } });
    });
    await page.route('**/api/editor/tree/app-1', async (route) => {
      await route.fulfill({ json: { tree: [{ name: 'src', path: 'src', type: 'directory', children: [{ name: 'index.ts', type: 'file', path: 'src/index.ts' }] }] } });
    });
    await page.route('**/api/editor/file?path=*', async (route) => {
      await route.fulfill({ json: { content: '// sample code\nconst x = 1;\n' } });
    });
    await nexus.goto();
    await nexus.navigateTo('Editor');
  });

  test('should display project registry header', async ({ page }) => {
    await expect(page.getByText('Project Registry')).toBeVisible({ timeout: 5000 });
  });

  test('should show app option in selector', async ({ page }) => {
    const editorSelect = page.locator('select').nth(1);
    await expect(editorSelect).toBeVisible({ timeout: 5000 });
    await expect(editorSelect.locator('option')).toHaveText('app-1');
  });

  test('should show file tree after selecting an app', async ({ page }) => {
    const editorSelect = page.locator('select').nth(1);
    await editorSelect.selectOption('app-1');
    await expect(page.getByText('src')).toBeVisible({ timeout: 5000 });
  });

  test('should show file tree with directory and file entries', async ({ page }) => {
    const editorSelect = page.locator('select').nth(1);
    await editorSelect.selectOption('app-1');
    await expect(page.getByText('src')).toBeVisible({ timeout: 5000 });
    // Click to expand directory
    await page.getByText('src').first().click();
    // Verify tree contains file entries after expansion
    await expect(page.getByText('index.ts')).toBeVisible({ timeout: 5000 });
  });

  test('should show refresh button', async ({ page }) => {
    const refreshBtn = page.locator('button:has(svg.lucide-refresh-cw)');
    await expect(refreshBtn.first()).toBeVisible();
  });

  test('should handle empty app list gracefully', async ({ nexus, page }) => {
    await page.route('**/api/editor/list', async (route) => {
      await route.fulfill({ json: { apps: [] } });
    });
    await nexus.goto();
    await nexus.navigateTo('Editor');
    const editorSelect = page.locator('select').nth(1);
    await expect(editorSelect).toBeVisible({ timeout: 5000 });
    const optionText = await editorSelect.locator('option').textContent();
    expect(optionText).toContain('No apps found');
  });
});

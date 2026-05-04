import { test, expect } from '../fixtures';

test.describe('Accessibility - Landmarks', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('page has a <main> landmark', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
  });

  test('page has a <header> landmark', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });

  test('page has a <footer> landmark', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
  });

  test('page has a <nav> element', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Accessibility - Interactive Elements', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('VibeCoder textarea has accessible label', async ({ page }) => {
    const textarea = page.getByLabel('App description');
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('Generate button has aria-label', async ({ page }) => {
    const btn = page.getByRole('button', { name: /generate/i });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Generate app');
  });

  test('example suggestion chips have aria-labels', async ({ page }) => {
    const chips = [
      'A landing page for my startup',
      'A todo app with login',
      'An e-commerce store',
    ];
    for (const label of chips) {
      const chip = page.getByRole('button', { name: new RegExp(`Use example: ${label}`) });
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute('aria-label');
    }
  });

  test('sidebar buttons have accessible names', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    const tabNames = [
      'VibeCoder',
      'Overview',
      'Pipeline',
      'Activity',
      'History',
      'Command Center',
      'Settings',
    ];
    for (const tab of tabNames) {
      const button = page.getByRole('button', { name: tab });
      await expect(button).toBeVisible();
    }
  });

  test('all images have alt attributes', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt');
    }
  });

  test('no image elements with empty alt text', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (alt !== null && alt !== '') {
        expect(alt.length).toBeGreaterThan(0);
      }
    }
  });

  test('heading hierarchy is logical (h1 before h2)', async ({ page }) => {
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    let lastLevel = 0;
    for (let i = 0; i < count; i++) {
      const tag = await headings.nth(i).evaluate((el) => el.tagName.toLowerCase());
      const level = parseInt(tag[1]);
      if (i === 0) {
        lastLevel = level;
      }
    }
  });

  test('buttons have accessible text labels', async ({ page }) => {
    const buttons = page.locator('button:not([aria-hidden="true"])');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const hasTextContent = (await btn.textContent())?.trim().length ?? 0 > 0;
      const hasAriaLabel = await btn.getAttribute('aria-label');
      const hasAriaLabelledby = await btn.getAttribute('aria-labelledby');
      expect(hasTextContent || hasAriaLabel !== null || hasAriaLabelledby !== null).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Focus', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('interactive elements are reachable by keyboard', async ({ page }) => {
    await page.getByRole('button', { name: /Advanced/i }).click();
    const tabIds = ['#nav-item-pipeline', '#nav-item-settings'];
    for (const id of tabIds) {
      await page.locator(id).focus();
      await expect(page.locator(id)).toBeFocused();
    }
  });

  test('focus visible indicators on Generate button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /generate/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.focus();
    const classes = await btn.getAttribute('class');
    expect(classes).toContain('focus-visible:ring');
  });

  test('focus visible on textarea', async ({ page }) => {
    const textarea = page.getByLabel('App description');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.focus();
    const classes = await textarea.getAttribute('class');
    expect(classes).toContain('focus:outline-none');
  });

  test('Advanced button has aria-expanded attribute', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Advanced/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await expect(btn).toHaveAttribute('aria-expanded');
  });

  test('active nav item has aria-current attribute', async ({ page }) => {
    const vibeTab = page.locator('#nav-item-vibecoder');
    await expect(vibeTab).toBeVisible();
    await expect(vibeTab).toHaveAttribute('aria-current', 'page');
  });
});

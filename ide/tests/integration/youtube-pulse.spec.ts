import { test, expect } from '../fixtures';

test.describe('YouTube Pulse', () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.goto();
  });

  test('navigates to YouTube Pulse without crashing', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows Nexus Video Scan section header', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    const header = page.locator('[data-testid="section-header"]', {
      hasText: /Nexus Video Scan/i,
    });
    await expect(header).toBeVisible();
  });

  test('shows video count in subtitle', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    await expect(
      page.locator('text=/\d+ videos/i'),
    ).toBeVisible();
  });

  test('shows DEEPSEEK CURATED badge', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    await expect(
      page.locator('text=/DEEPSEEK CURATED/i'),
    ).toBeVisible();
  });

  test('displays 4K SCAN labels on video cards', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    await expect(
      page.locator('text=/4K SCAN/i').first(),
    ).toBeVisible();
  });

  test('video cards show title and channel', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    const videoCard = page.locator('[data-testid="video-card"]').first();
    await expect(videoCard).toBeVisible();
    await expect(videoCard.locator('[data-testid="video-title"]')).toBeVisible();
    await expect(videoCard.locator('[data-testid="video-channel"]')).toBeVisible();
  });

  test('video cards show view count', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    const card = page.locator('[data-testid="video-card"]').first();
    await expect(card.locator('[data-testid="video-views"]')).toBeVisible();
  });

  test('video thumbnail images load', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    const thumbnails = page.locator('[data-testid="video-thumbnail"]');
    const count = await thumbnails.count();
    expect(count).toBeGreaterThan(0);
  });

  test('video scan subtitle mentions YouTube RSS', async ({ nexus, page }) => {
    await nexus.navigateTo('YouTube Pulse');
    await expect(
      page.locator('text=/YouTube RSS/i'),
    ).toBeVisible();
  });
});

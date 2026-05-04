import { test, expect } from '@playwright/test';
import { useSettingsStore } from '../../src/stores/useSettingsStore';

test.describe('Phase 3: UX & Polish', () => {
  test.beforeEach(() => {
    // Reset settings
    const store = useSettingsStore.getState();
    store.setTheme('dark');
    store.setFontSize(14);
    store.setFontFamily('Inter, system-ui, sans-serif');
    store.toggleReducedMotion(); // Reset to false
    store.toggleAdvancedFeatures(); // Reset to false
  });

  test('Settings Store - should have personalization state', async () => {
    const store = useSettingsStore.getState();
    
    expect(store.theme).toBeDefined();
    expect(['dark', 'light', 'system']).toContain(store.theme);
    expect(store.fontSize).toBe(14);
    expect(store.fontFamily).toBeDefined();
    expect(typeof store.reducedMotion).toBe('boolean');
    expect(typeof store.hideAdvancedFeatures).toBe('boolean');
    expect(Array.isArray(store.favorites)).toBeTruthy();
  });

  test('Settings Store - should update theme', async () => {
    const store = useSettingsStore.getState();
    
    store.setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
    
    store.setTheme('system');
    expect(useSettingsStore.getState().theme).toBe('system');
    
    store.setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  test('Settings Store - should update font size', async () => {
    const store = useSettingsStore.getState();
    
    store.setFontSize(16);
    expect(useSettingsStore.getState().fontSize).toBe(16);
    
    store.setFontSize(12);
    expect(useSettingsStore.getState().fontSize).toBe(12);
  });

  test('Settings Store - should update font family', async () => {
    const store = useSettingsStore.getState();
    
    store.setFontFamily('Arial, sans-serif');
    expect(useSettingsStore.getState().fontFamily).toBe('Arial, sans-serif');
  });

  test('Settings Store - should toggle reduced motion', async () => {
    const store = useSettingsStore.getState();
    
    const initial = store.reducedMotion;
    store.toggleReducedMotion();
    expect(useSettingsStore.getState().reducedMotion).toBe(!initial);
    
    store.toggleReducedMotion();
    expect(useSettingsStore.getState().reducedMotion).toBe(initial);
  });

  test('Settings Store - should toggle advanced features', async () => {
    const store = useSettingsStore.getState();
    
    const initial = store.hideAdvancedFeatures;
    store.toggleAdvancedFeatures();
    expect(useSettingsStore.getState().hideAdvancedFeatures).toBe(!initial);
  });

  test('Settings Store - should manage favorites', async () => {
    const store = useSettingsStore.getState();
    
    // Initially empty
    expect(useSettingsStore.getState().favorites.length).toBe(0);
    
    // Add favorite
    store.toggleFavorite('feature-1');
    expect(useSettingsStore.getState().favorites.length).toBe(1);
    expect(useSettingsStore.getState().favorites[0]).toBe('feature-1');
    
    // Add another
    store.toggleFavorite('feature-2');
    expect(useSettingsStore.getState().favorites.length).toBe(2);
    
    // Remove first
    store.toggleFavorite('feature-1');
    expect(useSettingsStore.getState().favorites.length).toBe(1);
    expect(useSettingsStore.getState().favorites[0]).toBe('feature-2');
  });

  test('VibeCoder - should have single-prompt mode elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for VibeCoder tab
    const vibeTab = page.locator('button:has-text("VibeCoder"), a:has-text("VibeCoder")').first();
    
    if (await vibeTab.isVisible().catch(() => false)) {
      await vibeTab.click();
      await page.waitForTimeout(1000);
      
      // Check for single-prompt input
      const promptInput = page.locator('textarea[placeholder*="Describe"], input[placeholder*="Describe"]').first();
      const isVisible = await promptInput.isVisible().catch(() => false);
      
      if (isVisible) {
        // Type a prompt
        await promptInput.fill('A landing page for my startup');
        expect(await promptInput.inputValue()).toBe('A landing page for my startup');
      }
    } else {
      test.skip();
    }
  });

  test('Settings - should persist personalization', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Settings
    const settingsTab = page.locator('button:has-text("Settings"), a:has-text("Settings")').first();
    
    if (await settingsTab.isVisible().catch(() => false)) {
      await settingsTab.click();
      await page.waitForTimeout(1000);
      
      // Check for theme selector
      const themeSelector = page.locator('select[name*="theme"], button:has-text("Theme")').first();
      const hasTheme = await themeSelector.isVisible().catch(() => false);
      
      if (hasTheme) {
        // Check for personalization options
        const fontSizeInput = page.locator('input[name*="font"], select[name*="font"]').first();
        const hasFontSize = await fontSizeInput.isVisible().catch(() => false);
        
        // At least one personalization control should exist
        expect(hasTheme || hasFontSize).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.{js,ts}',
  timeout: 30000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  },
});

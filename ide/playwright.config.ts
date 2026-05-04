import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Run tests in a single worker to simplify server access in Windows environments */
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    // Allow running Playwright tests in CI without a display server
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  timeout: 60000,
  retries: 1,
  projects: [
    { 
      name: 'CI: Critical', 
      testMatch: /tests\/critical\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Integration', 
      testMatch: /tests\/integration\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Quality', 
      testMatch: /tests\/quality\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: E2E', 
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Authz & Security', 
      testMatch: /tests\/e2e\/authz.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Collaboration', 
      testMatch: /tests\/e2e\/collab.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Review & Approval', 
      testMatch: /tests\/e2e\/review.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Retrieval & RAG', 
      testMatch: /tests\/e2e\/retrieval.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Auto-fix', 
      testMatch: /tests\/e2e\/autofix.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Race & Concurrency', 
      testMatch: /tests\/e2e\/race.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
    { 
      name: 'CI: Desktop', 
      testMatch: /tests\/e2e\/desktop.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] } 
    },
  ],
  webServer: [
    {
      command: 'cross-env NEXUS_AUTH_BYPASS=false NEXUS_API_KEY=nexus-alpha-dev-key AUTO_APPROVE=true npm run server',
      port: 3002,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

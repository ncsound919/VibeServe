import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npm run dev:all",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
  }
});
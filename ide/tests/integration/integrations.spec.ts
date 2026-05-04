/**
 * Nexus Alpha - Integration E2E Tests
 * Tests the new integration features: Nanobot, Mem0, Qdrant, Firecrawl, Tavily, Langfuse
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function gotoApp(page: Page, path?: string) {
  const url = path ? `${BASE_URL}${path}` : BASE_URL;
  await page.goto(url);
  // Wait for DOM to be ready
  await page.waitForLoadState("domcontentloaded");
  // Wait for React hydration (app signals readiness with specific element)
  await page.waitForFunction(() => {
    const app = document.querySelector('#root') || document.querySelector('.min-h-screen');
    if (!app) return false;
    // Wait for hydration marker or any interactive element
    return document.body.innerText.length > 50;
  }, { timeout: 15000 });
  // Now wait for header - should be hydrated
  await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
}

async function navigateToTab(page: Page, tabName: string) {
  const tabId = `#nav-item-${tabName.toLowerCase().replace(/\s+/g, '-')}`;
  const tab = page.locator(tabId);
  await tab.click();
  await page.waitForTimeout(500);
}

// ─── Integration Status API ───────────────────────────────────────────────────

test.describe("Integration API Endpoints", () => {
  test("status endpoint returns service states", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/integrations/status`, { timeout: 10000 });
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("services");
    expect(data).toHaveProperty("ts");
  });

  test("web search endpoint works", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integrations/search/web`, {
      data: { query: "AI agents 2026" },
      timeout: 15000
    });
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("ts");
  });

  test("trace endpoint works", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integrations/trace`, {
      data: { 
        name: "test-trace",
        metadata: { source: "playwright-test" }
      },
      timeout: 10000
    });
    // Should return 200 or 503 depending on Langfuse config
    expect([200, 503]).toContain(response.status());
  });
});

// ─── Command Center - Integration Hub ───────────────────────────────────────────

test.describe("Integration Hub Panel", () => {
  test("loads Command Center tab", async ({ page }) => {
    await gotoApp(page);
    await navigateToTab(page, "Command Center");
    
    // Check for Command Center specific content (e.g., terminal/cli area)
    await expect(page.locator("textarea, input").first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Navigation Tests ─────────────────────────────────────────────────────────

test.describe("Navigation & Tabs", () => {
  test("overview tab loads", async ({ page }) => {
    await gotoApp(page);
    await navigateToTab(page, "Overview");
    
    // Verify we can see some content in main
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("pipeline tab loads", async ({ page }) => {
    await gotoApp(page);
    await navigateToTab(page, "Pipeline");
    
    // Verify we can see some content in main
    await expect(page.locator("main").first()).toBeVisible();
  });
});

// ─── Pipeline Integration ─────────────────────────────────────────────────────

test.describe("Pipeline with Integrations", () => {
  test("can trigger pipeline via API", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/pipeline/run`, {
      data: {
        repos: ["test/repo"],
        agentId: "test-agent"
      },
      timeout: 15000
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("started", true);
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────

test.describe("Performance", () => {
  test("page loads within 10 seconds", async ({ page }) => {
    const start = Date.now();
    await gotoApp(page);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test("no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    
    await gotoApp(page);
    
    // Filter benign errors including React dev warnings
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("extension") && !e.includes("net::") && !e.includes("404") && !e.includes("Each child in a list") && !e.includes('unique "key" prop') && !e.includes("WebSocket") && !e.includes("status of 5")
    );
    
    expect(criticalErrors.length).toBe(0);
  });
});

// ─── Build Validation ─────────────────────────────────────────────────────────

test.describe("Build Pipeline Validation", () => {
  test("app loads and renders content", async ({ page }) => {
    await gotoApp(page);
    
    // Check that the app renders Header (which is checked in gotoApp)
    await expect(page.locator("header")).toBeVisible();
    
    // Should have some content rendered in main
    await expect(page.locator("main")).toBeVisible();
  });
});

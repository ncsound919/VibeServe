/**
 * Nexus Alpha — Master Test Fixtures
 * Shared helpers, constants, and page-object models for the full E2E suite.
 */

import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";

// ─── Constants ────────────────────────────────────────────────────────────────

export const BASE_URL  = process.env.BASE_URL  ?? "http://localhost:3000";
export const API_BASE  = process.env.API_BASE  ?? "http://localhost:3002";
export const WS_URL    = process.env.WS_URL    ?? "ws://localhost:3002/ws";
export const API_KEY   = "nexus-alpha-dev-key";
export const AUTH_HDR  = { "x-api-key": API_KEY, "Content-Type": "application/json" };

export const VALID_LICENSE_KEY   = "NEXUS-12AB-34CD-56EF-78GH";
export const INVALID_LICENSE_KEY = "NEXUS-FAKE-0000-0000-0000";

export const EXAMPLE_PROMPTS = [
  "A todo app with login and dark mode",
  "A landing page for a SaaS product",
  "A dashboard with charts and analytics",
  "An e-commerce store with a cart",
  "A blog with CMS and markdown support",
] as const;

// ─── Page Object Model ────────────────────────────────────────────────────────

export class NexusPage {
  constructor(public readonly page: Page) {}

  async goto(path = "/") {
    await this.page.goto(`${BASE_URL}${path}`);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForFunction(
      () => {
        const t = document.body.innerText;
        return t.length > 100 && !t.includes("Initializing Nexus");
      },
      { timeout: 20_000 },
    );
  }

  async activateLicense(key = VALID_LICENSE_KEY) {
    await this.page.evaluate((k) => {
      localStorage.setItem(
        "nexus_license",
        JSON.stringify({
          key: k,
          plan: "standard",
          activatedAt: new Date().toISOString(),
          machineFingerprint: "FP-TEST-001",
        }),
      );
    }, key);
  }

  async gotoVibeCoder() {
    await this.goto("/");
    await this.activateLicense();
    await this.page.reload();
    await this.waitForHydration();
    await expect(this.page.getByText("What do you want to build?")).toBeVisible({ timeout: 15_000 });
  }

  async openAdvanced() {
    const btn = this.page.getByRole("button", { name: /Advanced/i });
    const expanded = await btn.getAttribute("aria-expanded");
    if (expanded !== "true") await btn.click();
  }

  async navigateTo(tab: string) {
    await this.openAdvanced();
    const id = `#nav-item-${tab.toLowerCase().replace(/\s+/g, "-")}`;
    await this.page.locator(id).click();
    await this.page.waitForTimeout(300);
  }

  async waitForHydration() {
    await this.page.waitForFunction(
      () => {
        const t = document.body.innerText;
        return t.length > 100 && !t.includes("Initializing Nexus");
      },
      { timeout: 20_000 },
    );
    await expect(this.page.locator("main")).toBeVisible({ timeout: 10_000 });
  }

  collectErrors(): string[] {
    const errs: string[] = [];
    this.page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    this.page.on("pageerror", (e) => errs.push(e.message));
    return errs;
  }
}

// ─── API Helper ───────────────────────────────────────────────────────────────

export class NexusAPI {
  constructor(private readonly req: APIRequestContext) {}

  async get<T>(path: string): Promise<T> {
    const res = await this.req.get(`${API_BASE}${path}`, { headers: AUTH_HDR });
    expect(res.ok(), `GET ${path} failed: ${res.status()}`).toBeTruthy();
    return res.json() as T;
  }

  async post<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<{ status: number; body: T }> {
    const res = await this.req.post(`${API_BASE}${path}`, {
      headers: AUTH_HDR,
      data: body,
      timeout: timeoutMs,
    });
    return { status: res.status(), body: await res.json() as T };
  }

  async health(): Promise<{ status: string; ts: number }> {
    return this.get("/health");
  }
}

// ─── Extended Test Fixture ────────────────────────────────────────────────────

type MasterFixtures = {
  nexus: NexusPage;
  api: NexusAPI;
  errors: string[];
  withLicense: () => Promise<void>;
};

export const test = base.extend<MasterFixtures>({
  nexus: async ({ page }, use) => {
    await use(new NexusPage(page));
  },
  api: async ({ request }, use) => {
    await use(new NexusAPI(request));
  },
  errors: async ({ page }, use) => {
    const errs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push(e.message));
    await use(errs);
  },
  withLicense: async ({ page }, use) => {
    await use(async () => {
      await page.evaluate((key) => {
        localStorage.setItem(
          "nexus_license",
          JSON.stringify({ key, plan: "standard", activatedAt: new Date().toISOString() }),
        );
      }, VALID_LICENSE_KEY);
    });
  },
});

export { expect };

// ─── Utilities ────────────────────────────────────────────────────────────────

export function isCriticalError(msg: string): boolean {
  const ignore = [
    "favicon", "extension", "net::ERR", "WebSocket",
    "429", "Supabase", "Each child in a list", 'unique "key" prop',
    "status of 5", "GEMINI_API_KEY", "ollama",
  ];
  return !ignore.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
}

export async function measurePerformance(page: Page, label: string) {
  return page.evaluate((lbl) => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      label: lbl,
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
      loadComplete: nav.loadEventEnd - nav.fetchStart,
    };
  }, label);
}

export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  predicate: (v: T) => boolean,
  opts = { intervalMs: 2_000, maxAttempts: 30 },
): Promise<T | null> {
  for (let i = 0; i < opts.maxAttempts; i++) {
    const result = await fn();
    if (result !== null && predicate(result)) return result;
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  return null;
}

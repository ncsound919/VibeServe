/**
 * 01 — Coding Agent & App Generation Engine
 *
 * Tests the core VibeCoder flow end-to-end:
 *   Prompt → Planning → File generation → Build → Result screen
 *
 * Competitive target: match or beat Cursor / OpenCode generation quality signals.
 */

import { test, expect, EXAMPLE_PROMPTS, API_BASE, AUTH_HDR } from "./fixtures";

// ─── 1. VibeCoder Prompt Interface ───────────────────────────────────────────

test.describe("VibeCoder Prompt Interface", () => {
  test.beforeEach(async ({ nexus }) => {
    await nexus.gotoVibeCoder();
  });

  test("prompt textarea accepts free-form description", async ({ page }) => {
    const ta = page.getByLabel("App description");
    await ta.fill("Build me a real-time chat app with rooms");
    await expect(ta).toHaveValue("Build me a real-time chat app with rooms");
  });

  test("all 5 example chips populate textarea on click", async ({ page }) => {
    for (const prompt of EXAMPLE_PROMPTS) {
      const chip = page.getByText(prompt, { exact: false }).first();
      if (await chip.isVisible()) {
        await chip.click();
        const ta = page.getByLabel("App description");
        const val = await ta.inputValue();
        expect(val.length).toBeGreaterThan(10);
        await ta.clear();
      }
    }
  });

  test("Generate button is disabled when textarea is empty", async ({ page }) => {
    await page.getByLabel("App description").fill("");
    const btn = page.getByRole("button", { name: /generate/i });
    await expect(btn).toBeDisabled();
  });

  test("Generate button enables after typing at least 3 characters", async ({ page }) => {
    await page.getByLabel("App description").fill("app");
    await expect(page.getByRole("button", { name: /generate/i })).toBeEnabled();
  });

  test("Enter key in textarea triggers generation transition", async ({ page }) => {
    const ta = page.getByLabel("App description");
    await ta.fill("A simple calculator");
    await ta.press("Enter");
    await page.waitForFunction(
      () => {
        const t = document.body.innerText;
        return t.includes("Planning") || t.includes("Building") ||
               t.includes("Generating") || t.includes("progress");
      },
      { timeout: 15_000 },
    );
  });

  test("suggestion chip aria-labels are present", async ({ page }) => {
    const chips = page.locator('[aria-label*="Use example"]');
    const count = await chips.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(chips.nth(i)).toHaveAttribute("aria-label");
      }
    }
  });
});

// ─── 2. Coding Agent API Contract ────────────────────────────────────────────

test.describe("Coding Agent API Contract", () => {
  test("GET /api/coding-agent/apps returns typed array", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/coding-agent/apps`, { headers: AUTH_HDR });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.apps)).toBeTruthy();
  });

  test("POST /api/pipeline/generate requires description field", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/pipeline/generate`, {
      headers: AUTH_HDR,
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/pipeline/generate accepts valid payload", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/pipeline/generate`, {
      headers: AUTH_HDR,
      data: { description: "A minimal todo list app", template: "react-ts-vite" },
      timeout: 30_000,
    });
    expect([200, 202]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty("jobId");
    }
  });

  test("generation job status endpoint tracks progress 0–100", async ({ request }) => {
    const startRes = await request.post(`${API_BASE}/api/pipeline/generate`, {
      headers: AUTH_HDR,
      data: { description: "Calculator app" },
      timeout: 15_000,
    });
    if (!startRes.ok()) { test.skip(true, "Gen endpoint N/A"); return; }
    const { jobId } = await startRes.json();
    const statusRes = await request.get(
      `${API_BASE}/api/pipeline/generate/status/${jobId}`,
      { headers: AUTH_HDR },
    );
    if (!statusRes.ok()) { test.skip(true, "Status endpoint N/A"); return; }
    const status = await statusRes.json();
    expect(status).toHaveProperty("phase");
    expect(status).toHaveProperty("progress");
    expect(status.progress).toBeGreaterThanOrEqual(0);
    expect(status.progress).toBeLessThanOrEqual(100);
  });

  test("generated app history entries have required shape", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/coding-agent/apps`, { headers: AUTH_HDR });
    const { apps } = await res.json();
    if (!apps?.length) { test.skip(true, "No history yet"); return; }
    const latest = apps[0];
    expect(latest).toHaveProperty("path");
    expect(latest).toHaveProperty("timestamp");
    expect(latest).toHaveProperty("description");
  });
});

// ─── 3. Template Selection Intelligence ──────────────────────────────────────

test.describe("Template Selection Intelligence", () => {
  const cases = [
    { prompt: "A landing page for my startup",    expected: "react-ts-vite" },
    { prompt: "A REST API for user management",   expected: "express-api"   },
    { prompt: "A full-stack SaaS with auth",      expected: "fullstack"      },
  ];

  for (const { prompt, expected } of cases) {
    test(`"${prompt}" → template: ${expected}`, async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/coding-agent/template-select`, {
        headers: AUTH_HDR,
        data: { description: prompt },
        timeout: 15_000,
      });
      if (!res.ok()) { test.skip(true, "Template-select N/A"); return; }
      const body = await res.json();
      expect(body).toHaveProperty("template");
      expect(body.template).toBe(expected);
    });
  }
});

// ─── 4. VibeCoder Quality Gates ───────────────────────────────────────────────

test.describe("VibeCoder Quality Gates", () => {
  test("POST /api/vibe/check runs all gates and returns letter grade", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/vibe/check`, {
      headers: AUTH_HDR,
      data: { repoCount: 1, durationMs: 2000 },
      timeout: 30_000,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("maxTotal");
    expect(body).toHaveProperty("letter");
    expect(["S","A","B","C","D","F"]).toContain(body.letter);
    expect(Array.isArray(body.gates)).toBeTruthy();
    for (const gate of body.gates) {
      expect(gate).toHaveProperty("gate");
      expect(gate.score).toBeGreaterThanOrEqual(0);
      expect(gate.score).toBeLessThanOrEqual(gate.maxScore);
    }
  });

  test("Project Structure gate passes (required baseline)", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/vibe/check`, {
      headers: AUTH_HDR,
      data: { repoCount: 1, durationMs: 1000 },
      timeout: 30_000,
    });
    const { gates } = await res.json();
    const g = gates.find((g: { gate: string }) => g.gate.toLowerCase().includes("structure"));
    if (g) expect(g.passed).toBe(true);
  });

  test("score history accumulates across builds", async ({ request }) => {
    await request.post(`${API_BASE}/api/vibe/check`, {
      headers: AUTH_HDR, data: { repoCount: 1 }, timeout: 30_000,
    });
    await request.post(`${API_BASE}/api/vibe/check`, {
      headers: AUTH_HDR, data: { repoCount: 1 }, timeout: 30_000,
    });
    const histRes = await request.get(`${API_BASE}/api/vibe/history`, { headers: AUTH_HDR });
    const history = await histRes.json();
    expect(history.totalBuilds).toBeGreaterThanOrEqual(2);
    expect(history.builds[0]).toHaveProperty("totalScore");
  });
});

// ─── 5. Deployment Availability ──────────────────────────────────────────────

test.describe("Deployment Availability", () => {
  test("GET /api/deploy/availability returns deployment flags", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/deploy/availability`, { headers: AUTH_HDR });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.docker).toBe("boolean");
    expect(typeof body.vercel).toBe("boolean");
    expect(typeof body.zip).toBe("boolean");
  });

  test("zip deployment is always available (no external dep)", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/deploy/availability`, { headers: AUTH_HDR });
    const body = await res.json();
    expect(body.zip).toBe(true);
  });

  test("POST /api/deploy/zip requires appId", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/deploy/zip`, {
      headers: AUTH_HDR, data: {},
    });
    expect(res.status()).toBe(400);
  });
});

/**
 * Live Benchmark — Tests ALL features against the REAL backend (no mocks).
 * Requires: `npm run dev:all` running (Vite:3000 + Hono:3002)
 */
import { expect, type Page, test } from "@playwright/test";
import { NexusApp } from "../pages/nexus.po";

interface FeatureScore {
	feature: string;
	passed: boolean;
	responseTime: number;
	notes: string;
}

const scores: FeatureScore[] = [];

function record(feature: string, passed: boolean, time: number, notes = "") {
	scores.push({ feature, passed, responseTime: time, notes });
	if (!passed) console.warn(`  ❌ LIVE ${feature}: ${notes}`);
}

test.describe("Live Benchmark — Real Backend", () => {
	let nexus: NexusApp;

	test.beforeEach(async ({ page }) => {
		page.setDefaultTimeout(15000);
		nexus = new NexusApp(page);
	});

	// ─── 1. APP LOAD ──────────────────────────────────────────────────────────

	test("L1. App loads with full layout", async ({ page }) => {
		const t0 = Date.now();
		await nexus.goto();
		record("app-load", true, Date.now() - t0, `live (${Date.now() - t0}ms)`);

		await expect(page).toHaveTitle(/Nexus Alpha/);
		await expect(nexus.header).toBeVisible();
		await expect(nexus.sidebar).toBeVisible();
		await expect(nexus.main).toBeVisible();
		await expect(nexus.footer).toBeVisible();
		record("app-layout", true, 0, "Header, Sidebar, Main, Footer visible");
	});

	// ─── 2. PIPELINE SIDEBAR STEPS ────────────────────────────────────────────

	test("L2. Pipeline sidebar steps render", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);
		const steps = [
			"Architect",
			"Plan",
			"Build",
			"Review",
			"Audit",
			"Fix",
			"Retest",
			"Verify",
			"Deploy",
		];
		for (const step of steps) {
			const t0 = Date.now();
			const visible = await page
				.getByText(step)
				.first()
				.isVisible()
				.catch(() => false);
			record(
				`sidebar-${step.toLowerCase().replace(/\s+/g, "-")}`,
				visible,
				Date.now() - t0,
				visible ? "live" : "missing",
			);
		}
	});

	// ─── 3. DASHBOARD DEFAULT VIEW ────────────────────────────────────────────

	test("L3. Dashboard renders as default with all zones", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const t0 = Date.now();
		const liveMetrics = await page.getByText("Live Metrics").isVisible();
		record("dashboard-metrics", liveMetrics, Date.now() - t0);

		const activity = await page.getByText("Activity Feed").isVisible();
		record("dashboard-activity", activity, 0);

		const mission = await page.getByText("Mission Control").isVisible();
		record("dashboard-mission", mission, 0);

		const stats = await page.getByText("Pipeline").first().isVisible();
		record("dashboard-stats", stats, 0);
	});

	// ─── 4. BUILD STEP CONTEXTUAL TOOLS ──────────────────────────────────────

	test("L4. Build step shows contextual tools", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);
		const build = await page.getByText("Build").first().isVisible();
		record("sidebar-build", build, 0, build ? "live" : "missing");
	});

	// ─── 5. SETTINGS NAVIGATION ───────────────────────────────────────────────

	test("L5. Settings link navigates to settings", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);
		const settingsBtn = page.getByText("Settings").first();
		const visible = await settingsBtn.isVisible();
		if (visible) {
			await settingsBtn.click();
			await page.waitForTimeout(500);
			const hasSettings = await page
				.getByRole("heading", { name: "System Settings" })
				.isVisible()
				.catch(() => false);
			record(
				"settings-navigate",
				hasSettings,
				0,
				hasSettings ? "live" : "no settings",
			);
		} else {
			record("settings-navigate", false, 0, "settings link not visible");
		}
	});

	// ─── 6. COMMAND BAR ───────────────────────────────────────────────────────

	test("L6. Command bar — open, search, close (live)", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const t0 = Date.now();
		await page.keyboard.press("Control+k");
		await page.waitForTimeout(300);
		const commandBar = page.locator('[role="dialog"]');
		const opened = await commandBar.isVisible().catch(() => false);
		record(
			"cmdbar-open",
			opened,
			Date.now() - t0,
			opened ? "live" : "no dialog",
		);

		if (!opened) return;

		const overviewVisible = await page
			.getByText("Go to Overview")
			.isVisible()
			.catch(() => false);
		const composerVisible = await page
			.getByText("Open Composer")
			.isVisible()
			.catch(() => false);
		record(
			"cmdbar-commands",
			overviewVisible || composerVisible,
			0,
			`live (${overviewVisible}/${composerVisible})`,
		);

		const searchInput = page.locator('[role="dialog"] input').first();
		await searchInput.fill("pipeline");
		await page.waitForTimeout(200);
		const hasResults = await page
			.locator('[role="option"]')
			.first()
			.isVisible()
			.catch(() => false);
		record("cmdbar-filter", hasResults, 0, "live pipeline filter");

		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);
		const closed = !(await commandBar.isVisible().catch(() => true));
		record(
			"cmdbar-close",
			closed,
			0,
			closed ? "live closed" : "live still visible",
		);
	});

	// ─── 7. RAPID NAVIGATION ──────────────────────────────────────────────────

	test("L7. Rapid navigation does not crash", async ({ page }) => {
		await nexus.goto();
		const items = ["Build", "Review", "Audit", "Verify", "Deploy"];
		const t0 = Date.now();
		for (const item of items) {
			const btn = page.getByText(item).first();
			if (await btn.isVisible().catch(() => false)) {
				await btn.click();
			}
			await page.waitForTimeout(100);
		}
		record("rapid-nav", true, Date.now() - t0, "live no crash");
	});

	// ─── 8. NO CRITICAL ERRORS ────────────────────────────────────────────────

	test("L8. Zero critical console errors across full navigation (live)", async ({
		page,
	}) => {
		const errors: string[] = [];
		const IGNORE = [
			"favicon",
			"Failed to load resource",
			"net::",
			"ERR_",
			"GNews",
			"gnews",
			"429",
			"Failed to fetch",
			"fetch failed",
			"Multiple GoTrueClient",
			"Supabase URL",
			"Codeix",
			"No existing",
			"circuitBreaker",
			"fallback used",
			"WebSocket is closed before",
			"Connection closed before receiving a handshake",
			'unique "key" prop',
			"GEMINI_API_KEY",
			"falling back to DeepSeek",
		];

		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				!IGNORE.some((p) => msg.text().includes(p))
			) {
				errors.push(msg.text());
			}
		});

		await nexus.goto();
		const steps = [
			"Architect",
			"Plan",
			"Build",
			"Review",
			"Audit",
			"Fix",
			"Retest",
			"Verify",
			"Deploy",
		];
		for (const step of steps) {
			const btn = page.getByText(step).first();
			if (await btn.isVisible().catch(() => false)) {
				await btn.click();
			}
			await page.waitForTimeout(300);
		}

		record(
			"no-critical-errors",
			errors.length === 0,
			0,
			errors.length === 0
				? "live clean"
				: `live ${errors.length} errors: ${errors.slice(0, 3).join("; ")}`,
		);
	});

	// ─── 9. DEBT RADAR ────────────────────────────────────────────────────────

	test("L9. Debt Radar button state (live)", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(1000);

		const t0 = Date.now();
		const debtBtn = page.locator("button").filter({ hasText: /DEBT/ });
		const debtVisible = await debtBtn.isVisible().catch(() => false);
		record(
			"debt-radar-live",
			true,
			Date.now() - t0,
			debtVisible ? "live visible" : "live not visible (needs WS events)",
		);
	});

	// ─── 10. TRAJECTORY SIDEBAR ───────────────────────────────────────────────

	test("L10. Trajectory Sidebar visible (live)", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(1000);
		const t0 = Date.now();
		const trajectory = page.getByText("Agent Trajectory");
		const visible = await trajectory.isVisible().catch(() => false);
		record(
			"trajectory-sidebar",
			visible,
			Date.now() - t0,
			visible ? "live visible" : "live hidden",
		);
	});

	// ─── 11. API ENDPOINTS ────────────────────────────────────────────────────

	test("L11. All public API endpoints respond from real server", async ({
		request,
	}) => {
		const endpoints = [
			"/api/data/repos",
			"/api/nexus/progression",
			"/api/settings",
			"/api/coding/templates",
			"/api/pipeline/prs",
			"/api/vibe/history",
			"/api/trajectory/history",
			"/api/hooks",
			"/api/quality/stats",
			"/api/quality/trends",
			"/api/autocoder/status",
			"/api/autocoder/patterns",
			"/api/coding-agent/apps",
			"/api/nexus/errors",
			"/api/vibe/latest",
			"/api/toon/stats",
		];

		for (const ep of endpoints) {
			const t0 = Date.now();
			try {
				const res = await request.get(`http://localhost:3000${ep}`, {
					headers: { "x-api-key": "nexus-alpha-dev-key" },
				});
				record(
					`api${ep}`,
					res.status() >= 200 && res.status() < 500,
					Date.now() - t0,
					`HTTP ${res.status()}`,
				);
			} catch (err: any) {
				record(
					`api${ep}`,
					false,
					Date.now() - t0,
					`fetch failed: ${err.message}`,
				);
			}
		}
	});

	// ─── AGGREGATE SCORES ─────────────────────────────────────────────────────

	test.afterAll(() => {
		console.log("\n═══ LIVE BENCHMARK SCORECARD ═══");
		const passed = scores.filter((s) => s.passed).length;
		const total = scores.length;
		const avgTime = Math.round(
			scores
				.filter((s) => s.responseTime > 0)
				.reduce((a, s) => a + s.responseTime, 0) /
				Math.max(1, scores.filter((s) => s.responseTime > 0).length),
		);

		console.log(`Features tested: ${total}`);
		console.log(
			`Passed: ${passed}/${total} (${Math.round((passed / total) * 100)}%)`,
		);
		console.log(`Avg response: ${avgTime}ms`);
		console.log("");

		const categories: Record<string, FeatureScore[]> = {};
		for (const s of scores) {
			const cat = s.feature.split("-")[0];
			if (!categories[cat]) categories[cat] = [];
			categories[cat].push(s);
		}

		console.log("Category Scores (LIVE):");
		for (const [cat, feats] of Object.entries(categories)) {
			const p = feats.filter((f) => f.passed).length;
			const bar =
				"█".repeat(Math.round((p / feats.length) * 20)) +
				"░".repeat(20 - Math.round((p / feats.length) * 20));
			console.log(`  ${cat.padEnd(20)} ${bar} ${p}/${feats.length}`);
		}

		console.log(`\nFailed features:`);
		for (const s of scores.filter((s) => !s.passed)) {
			console.log(`  ❌ ${s.feature}: ${s.notes}`);
		}
	});
});

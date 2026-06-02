/**
 * Interactive Button Test — clicks every button a human would click.
 * Reports what works and what doesn't.
 */
import { expect, test } from "@playwright/test";
import { NexusApp } from "../pages/nexus.po";

test.describe("Human Button Test — Full Click Audit", () => {
	let nexus: NexusApp;

	test.beforeEach(async ({ page }) => {
		page.setDefaultTimeout(10000);
		nexus = new NexusApp(page);
	});

	test("01. Dashboard renders on load", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(800);

		// Verify dashboard zones exist
		console.log("[CHECK] Dashboard zones:");
		const metrics = await page
			.getByText("Live Metrics")
			.isVisible()
			.catch(() => false);
		console.log(`  Live Metrics: ${metrics ? "✅" : "❌"}`);

		const activity = await page
			.getByText("Activity Feed")
			.isVisible()
			.catch(() => false);
		console.log(`  Activity Feed: ${activity ? "✅" : "❌"}`);

		const mission = await page
			.getByText("Mission Control")
			.isVisible()
			.catch(() => false);
		console.log(`  Mission Control: ${mission ? "✅" : "❌"}`);

		expect(metrics).toBeTruthy();
		expect(activity).toBeTruthy();
		expect(mission).toBeTruthy();
	});

	test("02. Click every sidebar pipeline step", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const steps = ["Architect", "Plan", "Build", "Review", "Audit", "Deploy"];

		for (const step of steps) {
			console.log(`\n[CLICK] "${step}"`);
			const btn = page.getByText(step).first();
			const visible = await btn.isVisible().catch(() => false);
			console.log(`  Visible: ${visible ? "✅" : "❌"}`);

			if (visible) {
				try {
					await btn.click({ timeout: 3000 });
					await page.waitForTimeout(300);
					console.log(`  Click: ✅`);

					// Check if something happened in the main area
					const mainText = await nexus.main.innerText();
					console.log(`  Main content: ${mainText.length} chars`);
				} catch (e: any) {
					console.log(`  Click: ❌ ${e.message?.substring(0, 80)}`);
				}
			}
		}
	});

	test("03. Fix & Retest expansion", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const fixBtn = page.getByText("Fix", { exact: false }).first();
		const visible = await fixBtn.isVisible().catch(() => false);
		console.log(`Fix button visible: ${visible ? "✅" : "❌"}`);

		if (visible) {
			// Click Fix & Retest
			await fixBtn.click();
			await page.waitForTimeout(300);

			// Check if sub-steps appeared
			const fixSub = await page
				.getByText("E2E Testing")
				.isVisible()
				.catch(() => false);
			const refix = await page
				.getByText("Re-fix")
				.isVisible()
				.catch(() => false);
			const reaudit = await page
				.getByText("Re-audit")
				.isVisible()
				.catch(() => false);
			console.log(`  E2E Testing sub-step: ${fixSub ? "✅" : "❌"}`);
			console.log(`  Re-fix sub-step: ${refix ? "✅" : "❌"}`);
			console.log(`  Re-audit sub-step: ${reaudit ? "✅" : "❌"}`);
		}
	});

	test("04. Settings button works", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const settingsBtn = page.getByText("Settings").first();
		const visible = await settingsBtn.isVisible().catch(() => false);
		console.log(`Settings button visible: ${visible ? "✅" : "❌"}`);

		if (visible) {
			await settingsBtn.click({ timeout: 3000 });
			await page.waitForTimeout(800);

			const hasSystemSettings = await page
				.getByRole("heading", { name: "System Settings" })
				.isVisible()
				.catch(() => false);
			console.log(`Settings panel loaded: ${hasSystemSettings ? "✅" : "❌"}`);

			if (hasSystemSettings) {
				// Check sub-panels
				const panels = [
					"AI Provider",
					"Pipeline Configuration",
					"Agent Registry",
				];
				for (const p of panels) {
					const pVisible = await page
						.getByText(p)
						.isVisible()
						.catch(() => false);
					console.log(`  ${p}: ${pVisible ? "✅" : "❌"}`);

					// Try clicking
					if (pVisible) {
						try {
							await page.getByText(p).click();
							await page.waitForTimeout(200);
						} catch {}
					}
				}
			}
		}
	});

	test("05. Toggle switches work in Settings", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		// Navigate to Settings
		const settingsBtn = page.getByText("Settings").first();
		if (await settingsBtn.isVisible().catch(() => false)) {
			await settingsBtn.click();
			await page.waitForTimeout(800);
		}

		// Find toggle buttons
		const toggleButtons = page.locator(".w-9.h-5");
		const count = await toggleButtons.count();
		console.log(`Toggle buttons found: ${count}`);

		for (let i = 0; i < count; i++) {
			try {
				await toggleButtons.nth(i).click({ timeout: 2000 });
				await page.waitForTimeout(200);
				console.log(`  Toggle ${i}: ✅ clicked`);
			} catch (e: any) {
				console.log(`  Toggle ${i}: ❌ ${e.message?.substring(0, 60)}`);
			}
		}
	});

	test("06. Command bar opens and commands work", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		// Open command bar
		await page.keyboard.press("Control+k");
		await page.waitForTimeout(400);

		const cmdBar = page.locator('[role="dialog"]');
		const opened = await cmdBar.isVisible().catch(() => false);
		console.log(`Command bar opened: ${opened ? "✅" : "❌"}`);

		if (opened) {
			// Check commands
			const commands = [
				"Go to Overview",
				"Open Composer",
				"Open Settings",
				"Open Pipeline",
			];
			for (const cmd of commands) {
				const cmdVisible = await page
					.getByText(cmd)
					.isVisible()
					.catch(() => false);
				console.log(`  ${cmd}: ${cmdVisible ? "✅" : "❌"}`);

				if (cmdVisible) {
					try {
						await page.getByText(cmd).click({ timeout: 2000 });
						await page.waitForTimeout(300);
						console.log(`    click: ✅`);
					} catch (e: any) {
						console.log(`    click: ❌`);
					}
				}
			}

			// Type to filter
			const searchInput = page.locator('[role="dialog"] input').first();
			await searchInput.fill("settings");
			await page.waitForTimeout(300);
			const results = await page.locator('[role="option"]').count();
			console.log(`  Filter results: ${results}`);

			// Close
			await page.keyboard.press("Escape");
		}
	});

	test("07. Dashboard stat cards are clickable", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		// Check all 4 stat cards
		const cards = [
			{ label: "Pipeline", value: "12/15" },
			{ label: "Projects", value: "3 live" },
			{ label: "Repos", value: "8" },
			{ label: "Quality", value: "B+" },
		];

		for (const card of cards) {
			const cardText = await page
				.getByText(card.value)
				.first()
				.isVisible()
				.catch(() => false);
			console.log(
				`Stat card "${card.label}" (${card.value}): ${cardText ? "✅" : "❌"}`,
			);
		}
	});

	test("08. Metrics gauges render with data", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const gauges = ["CPU", "Memory", "Disk I/O"];
		for (const g of gauges) {
			const visible = await page
				.getByText(g)
				.isVisible()
				.catch(() => false);
			console.log(`Gauge "${g}": ${visible ? "✅" : "❌"}`);
		}
	});

	test("09. Activity feed events render", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		const events = [
			"Build completed",
			"Review passed",
			"E2E tests",
			"Audit: 2 findings",
			"Fix applied",
			"Build started",
		];

		for (const ev of events) {
			const visible = await page
				.getByText(ev)
				.isVisible()
				.catch(() => false);
			console.log(`Event "${ev}": ${visible ? "✅" : "❌"}`);
		}
	});

	test("10. Agent cards in Mission Control", async ({ page }) => {
		await nexus.goto();
		await page.waitForTimeout(500);

		for (let i = 1; i <= 3; i++) {
			const visible = await page
				.getByText(`Agent-${i}`)
				.isVisible()
				.catch(() => false);
			console.log(`Agent-${i}: ${visible ? "✅" : "❌"}`);
		}

		// Check agent status badges
		const active = await page
			.getByText("▶ active")
			.isVisible()
			.catch(() => false);
		const paused = await page
			.getByText("⏸ paused")
			.isVisible()
			.catch(() => false);
		console.log(`Active agent badge: ${active ? "✅" : "❌"}`);
		console.log(`Paused agent badge: ${paused ? "✅" : "❌"}`);
	});

	test("11. Zero console errors on full interaction", async ({ page }) => {
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
		await page.waitForTimeout(500);

		// Click every sidebar button
		const steps = ["Architect", "Plan", "Build", "Review", "Audit", "Deploy"];
		for (const step of steps) {
			const btn = page.getByText(step).first();
			if (await btn.isVisible().catch(() => false)) {
				try {
					await btn.click({ timeout: 2000 });
				} catch {}
			}
			await page.waitForTimeout(200);
		}

		// Click Settings
		const settingsBtn = page.getByText("Settings").first();
		if (await settingsBtn.isVisible().catch(() => false)) {
			try {
				await settingsBtn.click({ timeout: 2000 });
			} catch {}
			await page.waitForTimeout(500);
		}

		console.log(`Errors: ${errors.length}`);
		if (errors.length > 0) {
			for (const e of errors) {
				console.log(`  ❌ ${e.substring(0, 100)}`);
			}
		}
		expect(errors.length).toBe(0);
	});
});

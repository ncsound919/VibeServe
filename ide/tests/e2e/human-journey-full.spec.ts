import { expect, test } from "../fixtures";

test.describe("Full User Journey - E2E Acceptance", () => {
	test("1. App loads and shows main UI layout", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await expect(page).toHaveTitle(/Nexus Alpha/);
		await expect(nexus.header).toBeVisible();
		await expect(nexus.sidebar).toBeVisible();
		await expect(nexus.main).toBeVisible();
		await expect(nexus.footer).toBeVisible();
	});

	test("2. All primary sidebar tabs are clickable and render content", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();

		const primaryTabs = [
			"Composer",
			"Editor",
			"Review",
			"Memory",
			"Preview",
		] as const;
		for (const tab of primaryTabs) {
			await nexus.navigateTo(tab);
			await page.waitForTimeout(500);
			const content = await nexus.main.innerText();
			expect(content.length, `Tab ${tab} should have content`).toBeGreaterThan(
				5,
			);
		}
	});

	test("3. Advanced section expands and shows all advanced tabs", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();

		// Open advanced section
		const advancedToggle = page.getByLabel(/toggle advanced/i);
		await advancedToggle.click();
		await page.waitForTimeout(500);

		// Verify advanced tabs are now visible
		const advancedTabs = [
			"Settings",
			"Overview",
			"Pipeline",
			"History",
		] as const;
		for (const tab of advancedTabs) {
			const id = `nav-item-${tab.toLowerCase().replace(/\s+/g, "-")}`;
			await expect(page.locator(`#${id}`)).toBeVisible({ timeout: 5000 });
		}
	});

	test("4. Advanced tabs render content without crashing", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();

		const tabsToTest = ["History", "Audit", "Settings", "System"] as const;
		for (const tab of tabsToTest) {
			await nexus.navigateTo(tab);
			await page.waitForTimeout(1000);
			const content = await nexus.main.innerText();
			expect(content.length, `Tab ${tab} should have content`).toBeGreaterThan(
				3,
			);
		}
	});

	test("5. Composer - can type prompt and see generate button enable", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.navigateTo("Composer");
		await page.waitForTimeout(800);

		// Find the prompt input
		const promptInput = page.getByPlaceholder(/What should I build/);
		await expect(promptInput).toBeVisible({ timeout: 10000 });

		// Button should be disabled when empty
		const generateBtn = page.getByRole("button", { name: /Generate Project/ });
		await expect(generateBtn).toBeVisible({ timeout: 5000 });
		await expect(generateBtn).toBeDisabled();

		// Fill prompt and verify button enables
		await promptInput.fill("Build a real-time analytics dashboard with React");
		await expect(generateBtn).toBeEnabled();
	});

	test("6. Settings tab loads all sub-panels", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();
		await nexus.navigateTo("Settings");
		await page.waitForTimeout(3000);

		// Check for key settings panels
		const mainText = await nexus.main.innerText();
		expect(mainText).toContain("System Settings");
		expect(mainText).toContain("AI Provider");
		expect(mainText).toContain("Pipeline Configuration");
		expect(mainText).toContain("Agent Registry");
	});

	test("7. Pipeline tab shows pipeline UI", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();
		await nexus.navigateTo("Pipeline");
		await page.waitForTimeout(2000);

		const content = await nexus.main.innerText();
		expect(content.length).toBeGreaterThan(20);
	});

	test("8. Overview tab loads dashboard data", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();
		await nexus.navigateTo("Overview");
		await page.waitForTimeout(2000);

		const content = await nexus.main.innerText();
		expect(content.length).toBeGreaterThan(50);
	});

	test("9. Activity tab renders without errors", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();
		await nexus.navigateTo("Activity");
		await page.waitForTimeout(1500);

		await expect(nexus.main).toBeVisible();
	});

	test("10. Global command bar opens with Ctrl+K", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await page.waitForTimeout(1000);

		// Open command bar
		await page.keyboard.press("Control+k");
		await page.waitForTimeout(500);

		// Command bar should be visible
		const commandBar = page.locator('[role="dialog"]');
		await expect(commandBar).toBeVisible({ timeout: 5000 });

		// Should contain commands
		await expect(page.getByText("Go to Overview")).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByText("Open Composer")).toBeVisible({
			timeout: 3000,
		});

		// Close with Escape
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		await expect(commandBar).not.toBeVisible({ timeout: 3000 });
	});

	test("11. No critical console errors across all navigation", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		const criticalErrors: string[] = [];
		const IGNORE_PATTERNS = [
			"favicon",
			"Failed to load resource",
			"net::",
			"ERR_BLOCKED_BY_CLIENT",
			"ERR_CONNECTION_REFUSED",
			"key prop",
			'unique "key" prop',
			"GNews",
			"gnews.io",
			"429",
			"Failed to fetch",
			"Multiple GoTrueClient",
			"Supabase URL",
			"Codeix",
			"No existing Codeix",
			"circuitBreaker",
			"fallback used",
			"WebSocket is closed before",
			"Connection closed before receiving a handshake",
		];

		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				!IGNORE_PATTERNS.some((p) => msg.text().includes(p))
			) {
				criticalErrors.push(msg.text());
			}
		});

		await nexus.goto();

		const allTabs = [
			"Composer",
			"Editor",
			"Review",
			"Memory",
			"Preview",
			"Overview",
			"Pipeline",
			"Activity",
			"History",
			"Audit",
			"Mission Control",
			"Changes",
			"Settings",
			"System",
			"Agent Eval",
		];

		for (const tab of allTabs) {
			await nexus.openAdvancedSection();
			await nexus.navigateTo(tab);
			await page.waitForTimeout(600);
		}

		if (criticalErrors.length > 0) {
			console.error("CRITICAL ERRORS:", criticalErrors);
		}
		expect(criticalErrors).toEqual([]);
	});

	test("12. Quick navigation between 5 tabs does not crash", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") errors.push(msg.text());
		});

		const rapidTabs = ["Composer", "Review", "Memory", "Preview", "Composer"];
		for (const tab of rapidTabs) {
			await nexus.navigateTo(tab);
			await page.waitForTimeout(200);
		}

		const critical = errors.filter(
			(e) =>
				![
					"Failed to load resource",
					"WebSocket",
					"ERR_",
					"Failed to fetch",
				].some((p) => e.includes(p)),
		);
		expect(critical).toEqual([]);
	});

	test("13. Nav identifier tags match Sidebar TabName source-of-truth", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();

		const primaryTabs = ["Composer", "Editor", "Review", "Memory", "Preview"];
		for (const tab of primaryTabs) {
			const id = `nav-item-${tab.toLowerCase().replace(/\s+/g, "-")}`;
			await expect(page.locator(`#${id}`)).toBeVisible({ timeout: 5000 });
		}
	});

	test("14. Activity tab renders without errors", async ({
		page,
		nexus,
		mockDashboard,
	}) => {
		await nexus.goto();
		await nexus.openAdvancedSection();
		await nexus.navigateTo("Activity");
		await page.waitForTimeout(1500);
		await expect(nexus.main).toBeVisible();
	});
});

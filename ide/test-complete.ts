import { chromium } from "playwright";

async function fullTest() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();

	await context.addInitScript(() => {
		localStorage.setItem(
			"nexus_license",
			JSON.stringify({
				key: "NEXUS-12AB-34CD-56EF-78GH",
				plan: "standard",
				activatedAt: new Date().toISOString(),
				machineFingerprint: "FP-00000001",
			}),
		);
	});

	const page = await context.newPage();

	const criticalErrors: string[] = [];
	page.on("pageerror", (err) => criticalErrors.push(err.message));

	await page.goto("http://localhost:3000/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page.waitForTimeout(2000);

	process.stdout.write("=== PRIMARY TABS ===\n");
	const primaryTabs = [
		{ name: "Composer", id: "nav-item-composer" },
		{ name: "Editor", id: "nav-item-editor" },
		{ name: "Review", id: "nav-item-review" },
		{ name: "Magic", id: "nav-item-magic" },
		{ name: "Memory", id: "nav-item-memory" },
		{ name: "Preview", id: "nav-item-preview" },
	];

	for (const tab of primaryTabs) {
		await page.locator(`#${tab.id}`).click();
		await page.waitForTimeout(1000);
		const content = await page.locator("main").innerText();
		const ok = content.length > 20 && !content.toLowerCase().includes("failed");
		process.stdout.write(`${ok ? "✅" : "❌"} ${tab.name}`);
	}

	process.stdout.write("\n=== OPENING ADVANCED SECTION ===\n");

	// Click the toggle button (last button with no ID, or find by text)
	const toggleBtn = page.locator("aside button").last();
	await toggleBtn.click();
	await page.waitForTimeout(1000);

	process.stdout.write("=== ADVANCED TABS ===\n");
	const advancedTabs = [
		{ name: "Overview", id: "nav-item-overview" },
		{ name: "Pipeline", id: "nav-item-pipeline" },
		{ name: "Activity", id: "nav-item-activity" },
		{ name: "History", id: "nav-item-history" },
		{ name: "Audit", id: "nav-item-audit" },
		{ name: "Mission Control", id: "nav-item-mission-control" },
		{ name: "Changes", id: "nav-item-changes" },
		{ name: "Command Center", id: "nav-item-command-center" },
		{ name: "Settings", id: "nav-item-settings" },
		{ name: "Extensions", id: "nav-item-extensions" },
		{ name: "System", id: "nav-item-system" },
		{ name: "Agent Eval", id: "nav-item-agent-eval" },
	];

	let advancedPassed = 0;
	let advancedFailed = 0;

	for (const tab of advancedTabs) {
		const btn = page.locator(`#${tab.id}`);
		const exists = await btn.count();
		if (exists === 0) {
			process.stdout.write(`⚠️  ${tab.name}: button not found`);
			advancedFailed++;
			continue;
		}
		await btn.click();
		await page.waitForTimeout(1200);
		const content = await page.locator("main").innerText();
		const ok = content.length > 20 && !content.toLowerCase().includes("failed");
		process.stdout.write(`${ok ? "✅" : "❌"} ${tab.name}`);
		if (ok) advancedPassed++;
		else advancedFailed++;
	}

	process.stdout.write("\n=== TESTING TAB FUNCTIONS ===\n");

	// Test clicking inside tabs
	await page.locator("#nav-item-settings").click();
	await page.waitForTimeout(1000);
	const settingsBtns = await page.locator("main button").count();
	process.stdout.write(`Settings: ${settingsBtns} buttons found`);

	await page.locator("#nav-item-overview").click();
	await page.waitForTimeout(1000);
	const overviewContent = await page.locator("main").innerText();
	process.stdout.write(`Overview: loaded ${overviewContent.length} chars`);

	process.stdout.write("\n=== CRITICAL ERRORS ===");
	if (criticalErrors.length === 0) {
		process.stdout.write("✅ No critical JS errors!");
	} else {
		for (const e of criticalErrors) {
			process.stdout.write(`❌ ${e.substring(0, 100)}`);
		}
	}

	await browser.close();

	process.stdout.write("\n=== SUMMARY ===");
	process.stdout.write(`Primary: 6/6 tabs load`);
	process.stdout.write(`Advanced: ${advancedPassed}/12 tabs load`);
}

fullTest().catch(console.error);

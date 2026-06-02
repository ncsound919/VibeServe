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

	await page.goto("http://localhost:3000/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page.waitForTimeout(2000);

	console.log("=== PRIMARY TABS ===");
	const primaryTabs = [
		"Composer",
		"Editor",
		"Review",
		"Magic",
		"Memory",
		"Preview",
	];
	for (const name of primaryTabs) {
		const id = `nav-item-${name.toLowerCase()}`;
		await page.locator(`#${id}`).click();
		await page.waitForTimeout(1000);
		const content = await page.locator("main").innerText();
		const ok = content.length > 20 && !content.includes("failed to load");
		console.log(`${ok ? "✅" : "❌"} ${name}: ${content.substring(0, 50)}`);
	}

	console.log("\n=== CLICKING ADVANCED SECTION ===");
	await page.locator('button:has-text("Toggle advanced")').click();
	await page.waitForTimeout(500);

	const advancedButtons = await page.locator("aside button").all();
	console.log(`Now have ${advancedButtons.length} buttons in sidebar`);

	console.log("\n=== ADVANCED TABS ===");
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

	for (const tab of advancedTabs) {
		const btn = page.locator(`#${tab.id}`);
		const exists = await btn.count();
		if (exists === 0) {
			console.log(`⚠️  ${tab.name}: button #${tab.id} not found`);
			continue;
		}
		await btn.click();
		await page.waitForTimeout(1500);
		const content = await page.locator("main").innerText();
		const ok = content.length > 20 && !content.includes("failed to load");
		console.log(`${ok ? "✅" : "❌"} ${tab.name}: ${content.substring(0, 50)}`);
	}

	console.log("\n=== TESTING BUTTONS INSIDE TABS ===");

	// Test settings buttons
	await page.locator("#nav-item-settings").click();
	await page.waitForTimeout(1000);

	const settingsButtons = await page.locator("main button").all();
	console.log(`Settings tab has ${settingsButtons.length} buttons`);

	for (const btn of settingsButtons.slice(0, 5)) {
		const label = await btn.textContent();
		if (label && label.trim().length > 0) {
			console.log(`  Button: ${label.substring(0, 30)}`);
		}
	}

	// Test overview buttons
	await page.locator("#nav-item-overview").click();
	await page.waitForTimeout(1000);

	const overviewButtons = await page.locator("main button").all();
	console.log(`\nOverview tab has ${overviewButtons.length} buttons`);

	await browser.close();
	console.log("\n✅ TEST COMPLETE");
}

fullTest().catch(console.error);

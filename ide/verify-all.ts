import { chromium } from "playwright";

async function verifyAll() {
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

	await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

	// Primary tabs
	const primary = [
		"Composer",
		"Editor",
		"Review",
		"Magic",
		"Memory",
		"Preview",
	];
	console.log("=== PRIMARY TABS ===");
	for (const name of primary) {
		const id = `nav-item-${name.toLowerCase()}`;
		await page.locator(`#${id}`).click();
		await page.waitForTimeout(800);
		const content = await page.locator("main").innerText();
		const ok = content.length > 20;
		console.log(`${ok ? "✅" : "❌"} ${name}`);
	}

	// Advanced
	await page.locator("aside button").last().click();
	await page.waitForTimeout(300);

	const advanced = [
		"Overview",
		"Pipeline",
		"Activity",
		"History",
		"Audit",
		"Mission Control",
		"Changes",
		"Command Center",
		"Settings",
		"Extensions",
		"System",
		"Agent Eval",
	];
	console.log("\n=== ADVANCED TABS ===");
	for (const name of advanced) {
		const id = `nav-item-${name.toLowerCase().replace(" ", "-")}`;
		const btn = page.locator(`#${id}`);
		if ((await btn.count()) === 0) {
			console.log(`⚠️  ${name} (not found)`);
			continue;
		}
		await btn.click();
		await page.waitForTimeout(1000);
		const content = await page.locator("main").innerText();
		// Check for actual error messages (not "failed to load" text)
		const hasError =
			content.toLowerCase().includes("failed to load") && content.length < 200;
		console.log(`${!hasError ? "✅" : "❌"} ${name}`);
	}

	await browser.close();
}

verifyAll().catch(console.error);

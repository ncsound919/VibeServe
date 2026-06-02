import { chromium } from "playwright";

async function check() {
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

	const errors: string[] = [];
	page.on("pageerror", (err) => errors.push(err.message));

	await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
	await page.locator("aside button").last().click();
	await page.waitForTimeout(500);

	// Check each tab
	const tabs = [
		"#nav-item-pipeline",
		"#nav-item-activity",
		"#nav-item-settings",
	];

	for (const tabId of tabs) {
		await page.locator(tabId).click();
		await page.waitForTimeout(1500);
		const content = await page.locator("main").innerText();
		const hasRealError =
			content.toLowerCase().includes("failed to load") && content.length < 200;
		console.log(
			`${tabId}: ${content.substring(0, 80)} (len=${content.length})`,
		);
	}

	console.log("\n=== JS ERRORS ===");
	console.log(errors);

	await browser.close();
}

check().catch(console.error);

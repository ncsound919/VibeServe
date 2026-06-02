import { chromium } from "playwright";

async function debugError() {
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

	const logs: string[] = [];
	page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
	page.on("pageerror", (err) => logs.push(`PAGE ERROR: ${err.message}`));

	await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

	// Open advanced
	await page.locator("aside button").last().click();
	await page.waitForTimeout(500);

	// Click Overview
	await page.locator("#nav-item-overview").click();
	await page.waitForTimeout(2000);

	console.log("=== CONSOLE LOGS ===");
	const errorLogs = logs.filter(
		(l) => l.includes("error") || l.includes("Error") || l.includes("ERROR"),
	);
	for (const l of errorLogs) {
		console.log(l);
	}

	await browser.close();
}

debugError().catch(console.error);

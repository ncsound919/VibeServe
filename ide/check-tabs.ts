import { chromium } from "playwright";

async function checkAdvancedTab() {
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
	await page.waitForTimeout(1000);

	// Open advanced
	const toggleBtn = page.locator("aside button").last();
	await toggleBtn.click();
	await page.waitForTimeout(500);

	// Check Overview
	console.log("=== OVERVIEW TAB ===");
	await page.locator("#nav-item-overview").click();
	await page.waitForTimeout(1500);
	const overview = await page.locator("main").innerText();
	console.log(overview.substring(0, 300));

	// Check Settings
	console.log("\n=== SETTINGS TAB ===");
	await page.locator("#nav-item-settings").click();
	await page.waitForTimeout(1500);
	const settings = await page.locator("main").innerText();
	console.log(settings.substring(0, 300));

	// Check Pipeline
	console.log("\n=== PIPELINE TAB ===");
	await page.locator("#nav-item-pipeline").click();
	await page.waitForTimeout(1500);
	const pipeline = await page.locator("main").innerText();
	console.log(pipeline.substring(0, 300));

	await browser.close();
}

checkAdvancedTab().catch(console.error);

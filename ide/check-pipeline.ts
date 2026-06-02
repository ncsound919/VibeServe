import { chromium } from "playwright";

async function checkPipeline() {
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

	// Open advanced
	await page.locator("aside button").last().click();
	await page.waitForTimeout(500);

	// Click Pipeline
	await page.locator("#nav-item-pipeline").click();
	await page.waitForTimeout(2000);

	console.log("=== ERRORS ===");
	for (const e of errors) {
		console.log(e.substring(0, 150));
	}

	// Check if error overlay exists
	const overlay = await page.locator("vite-error-overlay").count();
	console.log(`\nError overlay present: ${overlay > 0}`);

	// Get main content anyway
	const content = await page
		.locator("main")
		.innerText()
		.catch(() => "NO CONTENT");
	console.log(`\nContent: ${content.substring(0, 200)}`);

	await browser.close();
}

checkPipeline().catch(console.error);

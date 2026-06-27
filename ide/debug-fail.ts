import { chromium } from "playwright";

async function debugFailures() {
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

	const jsErrors: string[] = [];
	page.on("pageerror", (err) => jsErrors.push(err.message));

	await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
	await page.locator("aside button").last().click();
	await page.waitForTimeout(500);

	const failing = [
		"#nav-item-mission-control",
		"#nav-item-changes",
		"#nav-item-command-center",
		"#nav-item-settings",
	];

	for (const tabId of failing) {
		jsErrors.length = 0;
		await page.locator(tabId).click();
		await page.waitForTimeout(2000);
		const content = await page.locator("main").innerText();
		process.stdout.write(`\n=== ${tabId} ===`);
		process.stdout.write(`Content: ${content.substring(0, 100)}`);
		process.stdout.write(
			`Errors: ${jsErrors.map((e) => e.substring(0, 60)).join(", ")}`,
		);
	}

	await browser.close();
}

debugFailures().catch(console.error);

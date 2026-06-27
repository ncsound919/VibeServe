import { chromium } from "playwright";

async function finalCheck() {
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

	const tabs = [
		"#nav-item-audit",
		"#nav-item-command-center",
		"#nav-item-settings",
		"#nav-item-extensions",
		"#nav-item-system",
		"#nav-item-agent-eval",
	];

	for (const tabId of tabs) {
		jsErrors.length = 0;
		await page.locator(tabId).click();
		await page.waitForTimeout(2000);
		const content = await page.locator("main").innerText();
		const isOk = content.length > 30 && !content.includes("failed");
		process.stdout.write(`${tabId}: ${isOk ? "OK" : "FAIL"}`);
		if (jsErrors.length > 0) {
			process.stdout.write(`  ERROR: ${jsErrors[0].substring(0, 80)}`);
		}
	}

	await browser.close();
}

finalCheck().catch(console.error);

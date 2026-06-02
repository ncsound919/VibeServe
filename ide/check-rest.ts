import { chromium } from "playwright";

async function checkAuditChanges() {
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

	const tabs = [
		"#nav-item-audit",
		"#nav-item-changes",
		"#nav-item-command-center",
		"#nav-item-settings",
		"#nav-item-extensions",
		"#nav-item-system",
		"#nav-item-agent-eval",
	];

	for (const tabId of tabs) {
		errors.length = 0;
		await page.locator(tabId).click();
		await page.waitForTimeout(2000);
		const content = await page.locator("main").innerText();
		const hasContent =
			content.length > 30 && !content.includes("failed to load");
		console.log(
			`${tabId}: ${hasContent ? "OK" : "FAIL"} - ${errors[0]?.substring(0, 60) || content.substring(0, 50)}`,
		);
	}

	await browser.close();
}

checkAuditChanges().catch(console.error);

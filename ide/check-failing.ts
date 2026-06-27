import { chromium } from "playwright";

async function checkFailing() {
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
		{ id: "#nav-item-activity", name: "Activity" },
		{ id: "#nav-item-audit", name: "Audit" },
		{ id: "#nav-item-mission-control", name: "MissionControl" },
		{ id: "#nav-item-changes", name: "Changes" },
		{ id: "#nav-item-command-center", name: "CommandCenter" },
		{ id: "#nav-item-settings", name: "Settings" },
	];

	for (const tab of tabs) {
		errors.length = 0;
		await page.locator(tab.id).click();
		await page.waitForTimeout(1500);
		const content = await page.locator("main").innerText();
		const hasError =
			errors.length > 0 || content.toLowerCase().includes("failed");
		process.stdout.write(
			`${tab.name}: ${hasError ? "FAIL" : "OK"} - ${errors[0]?.substring(0, 60) || content.substring(0, 40)}`,
		);
	}

	await browser.close();
}

checkFailing().catch(console.error);

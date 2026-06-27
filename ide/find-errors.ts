import { chromium } from "playwright";

async function findErrors() {
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

	const errors: { tab: string; error: string }[] = [];
	page.on("pageerror", (err) => {
		const msg = err.message;
		if (!msg.includes("json") && !msg.includes("fetch")) {
			errors.push({ tab: "", error: msg });
		}
	});

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
		{ id: "#nav-item-extensions", name: "Extensions" },
		{ id: "#nav-item-system", name: "System" },
		{ id: "#nav-item-agent-eval", name: "AgentEval" },
		{ id: "#nav-item-history", name: "History" },
	];

	for (const tab of tabs) {
		errors.length = 0;
		await page.locator(tab.id).click();
		await page.waitForTimeout(2000);

		const content = await page.locator("main").innerText();
		const hasContent =
			content.length > 30 && !content.includes("failed to load");

		process.stdout.write(`${tab.name}: ${hasContent ? "OK" : "FAIL"}`);
		if (errors.length > 0) {
			for (const e of errors) {
				process.stdout.write(`  ERROR: ${e.error.substring(0, 80)}`);
			}
		}
	}

	await browser.close();
}

findErrors().catch(console.error);

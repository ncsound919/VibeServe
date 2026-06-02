import { chromium } from "playwright";

async function debugFail() {
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
	page.on("console", (msg) => {
		if (
			msg.type() === "error" &&
			!msg.text().includes("500") &&
			!msg.text().includes("favicon")
		) {
			errors.push(msg.text());
		}
	});
	page.on("pageerror", (err) => errors.push(`PAGE: ${err.message}`));

	await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
	await page.locator("aside button").last().click();
	await page.waitForTimeout(500);

	await page.locator("#nav-item-command-center").click();
	await page.waitForTimeout(2000);

	const content = await page.locator("main").innerText();
	console.log("Command Center:");
	console.log(content.substring(0, 200));
	console.log(
		"\nErrors:",
		errors.filter((e) => !e.includes("500")).slice(0, 3),
	);

	await browser.close();
}

debugFail().catch(console.error);

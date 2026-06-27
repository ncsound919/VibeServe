import { chromium } from "playwright";

async function testMemoryAndAdvanced() {
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
		if (msg.type() === "error") errors.push(msg.text());
	});
	page.on("pageerror", (err) => errors.push(`PAGE: ${err.message}`));

	await page.goto("http://localhost:3000/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page.waitForTimeout(2000);

	process.stdout.write("=== CHECKING ACTUAL BUTTON IDs ===\n");

	// Get all buttons in sidebar
	const sidebarButtons = await page.locator("aside button").all();
	process.stdout.write(`Found ${sidebarButtons.length} buttons in sidebar`);

	for (const btn of sidebarButtons.slice(0, 20)) {
		const id = await btn.getAttribute("id");
		const label =
			(await btn.getAttribute("aria-label")) || (await btn.textContent());
		process.stdout.write(`  ID: ${id}, Label: ${label?.substring(0, 30)}`);
	}

	process.stdout.write("\n=== CLICKING MEMORY ===");
	await page.locator("#nav-item-memory").click();
	await page.waitForTimeout(2000);

	const memoryContent = await page.locator("main").innerText();
	process.stdout.write(
		`Memory content (first 300 chars): ${memoryContent.substring(0, 300)}`,
	);

	process.stdout.write(
		"\nErrors:",
		errors
			.filter(
				(e) =>
					!e.includes("favicon") &&
					!e.includes("WebSocket") &&
					!e.includes("500"),
			)
			.slice(0, 5),
	);

	await browser.close();
}

testMemoryAndAdvanced().catch(console.error);

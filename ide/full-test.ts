import { chromium } from "playwright";

const ALL_TABS = [
	{ name: "Composer", id: "nav-item-composer" },
	{ name: "Editor", id: "nav-item-editor" },
	{ name: "Review", id: "nav-item-review" },
	{ name: "Magic", id: "nav-item-magic" },
	{ name: "Memory", id: "nav-item-memory" },
	{ name: "Preview", id: "nav-item-preview" },
	{ name: "Overview", id: "nav-item-overview" },
	{ name: "Pipeline", id: "nav-item-pipeline" },
	{ name: "Activity", id: "nav-item-activity" },
	{ name: "History", id: "nav-item-history" },
	{ name: "Audit", id: "nav-item-audit" },
	{ name: "Mission Control", id: "nav-item-mission-control" },
	{ name: "Changes", id: "nav-item-changes" },
	{ name: "Command Center", id: "nav-item-command-center" },
	{ name: "Settings", id: "nav-item-settings" },
	{ name: "Extensions", id: "nav-item-extensions" },
	{ name: "System", id: "nav-item-system" },
	{ name: "Agent Eval", id: "nav-item-agent-eval" },
];

async function testAllTabs() {
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

	const allErrors: { tab: string; error: string }[] = [];

	page.on("console", (msg) => {
		if (msg.type() === "error") {
			const text = msg.text();
			if (
				!text.includes("favicon") &&
				!text.includes("ERR_BLOCKED") &&
				!text.includes("WebSocket") &&
				!text.includes("ws://") &&
				!text.includes("500") &&
				!text.includes("ERR_CONNECTION_REFUSED") &&
				!text.includes("proxy error")
			) {
				allErrors.push({ tab: "GLOBAL", error: text });
			}
		}
	});

	page.on("pageerror", (err) => {
		allErrors.push({ tab: "GLOBAL", error: `PAGE ERROR: ${err.message}` });
	});

	console.log("Loading app...\n");

	await page.goto("http://localhost:3000/", {
		waitUntil: "networkidle",
		timeout: 30000,
	});
	await page.waitForTimeout(3000);

	const bodyText = await page.locator("body").innerText();
	if (bodyText.length < 50) {
		console.log("❌ App failed to load");
		console.log("Body:", bodyText);
		await browser.close();
		return;
	}
	console.log("✅ App loaded\n");

	console.log("=== TESTING ALL TABS ===\n");

	const results: {
		tab: string;
		status: string;
		content: string;
		errors: string[];
	}[] = [];

	for (const tab of ALL_TABS) {
		const tabErrors: string[] = [];
		const handler = (msg: any) => {
			if (msg.type() === "error") {
				const text = msg.text();
				if (
					!text.includes("favicon") &&
					!text.includes("ERR_BLOCKED") &&
					!text.includes("WebSocket") &&
					!text.includes("ws://") &&
					!text.includes("500") &&
					!text.includes("ERR_CONNECTION_REFUSED") &&
					!text.includes("proxy error")
				) {
					tabErrors.push(text);
				}
			}
		};
		page.on("console", handler);

		console.log(`Testing ${tab.name}...`);

		const btn = page.locator(`#${tab.id}`);
		const exists = await btn.count();

		if (exists === 0) {
			console.log(`  ⚠️  Button not found: #${tab.id}`);
			results.push({
				tab: tab.name,
				status: "BUTTON NOT FOUND",
				content: "",
				errors: [],
			});
			page.off("console", handler);
			continue;
		}

		await btn.click();
		await page.waitForTimeout(2000);

		const mainContent = await page
			.locator("main")
			.innerText()
			.catch(() => "");
		const hasContent = mainContent.length > 10;

		const hasError =
			mainContent.includes("failed to load") || mainContent.includes("Error");

		page.off("console", handler);

		if (!hasContent || hasError) {
			console.log(`  ❌ No content or error`);
			results.push({
				tab: tab.name,
				status: "FAILED",
				content: mainContent.substring(0, 100),
				errors: tabErrors,
			});
		} else {
			console.log(`  ✅ OK (${mainContent.length} chars)`);
			results.push({
				tab: tab.name,
				status: "OK",
				content: mainContent.substring(0, 100),
				errors: tabErrors.slice(0, 3),
			});
		}
	}

	console.log("\n=== RESULTS ===\n");

	const failed = results.filter((r) => r.status !== "OK");

	if (failed.length === 0) {
		console.log("🎉 ALL TABS WORK!");
	} else {
		console.log(`❌ ${failed.length} tabs failed:\n`);
		for (const f of failed) {
			console.log(`- ${f.tab}: ${f.status}`);
			if (f.errors.length > 0) {
				console.log(`  Errors: ${f.errors[0].substring(0, 80)}`);
			}
		}
	}

	console.log("\n=== ALL ERRORS ===\n");
	const uniqueErrors = [...new Set(allErrors.map((e) => e.error))];
	for (const e of uniqueErrors.slice(0, 10)) {
		console.log(`- ${e.substring(0, 150)}`);
	}

	await browser.close();
}

testAllTabs().catch(console.error);

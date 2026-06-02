import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const errors = [];
const logs = [];

page.on("console", (msg) => {
	const text = msg.text();
	logs.push(`[${msg.type()}] ${text}`);
	if (msg.type() === "error") errors.push(text);
});

page.on("pageerror", (err) => {
	errors.push(`PAGE ERROR: ${err.message}`);
});

console.log("=== NAVIGATING ===");
await page.goto("http://localhost:3011", { waitUntil: "load", timeout: 20000 });

console.log("=== WAITING ===");
await page.waitForTimeout(4000);

console.log("\n=== ROOT CHECK ===");
const rootHTML = await page.locator("#root").innerHTML();
console.log("Root length:", rootHTML.length);
console.log("Root preview:", rootHTML.substring(0, 200));

console.log("\n=== ERRORS ===");
errors.forEach((e) => console.log(e));

console.log("\n=== CHECKING SAFE_SHELL ===");
const hasSafeShell = await page.evaluate(() => {
	// Try to access window and see if safeShell is imported
	return typeof window !== "undefined";
});
console.log("Window exists:", hasSafeShell);

// Check for any module errors
console.log("\n=== LOGS (last 20) ===");
logs.slice(-20).forEach((l) => console.log(l));

// await browser.close();

import { expect, test } from "../fixtures";

test.describe("UI Professionalization", () => {
	test("Pipeline sidebar renders all 8 steps + settings", async ({
		nexus,
		mockDashboard,
		page,
	}) => {
		await nexus.goto();
		await page.waitForTimeout(500);
		const steps = [
			"Architect",
			"Plan",
			"Build",
			"Review",
			"Audit",
			"Fix",
			"Retest",
			"Verify",
			"Deploy",
		];
		for (const step of steps) {
			await expect(page.getByText(step).first()).toBeVisible({ timeout: 5000 });
		}
		await expect(page.getByText("Settings").first()).toBeVisible();
	});

	test("Sidebar step has visual states", async ({
		nexus,
		mockDashboard,
		page,
	}) => {
		await nexus.goto();
		const statusDots = page.locator(".rounded-full");
		const count = await statusDots.count();
		expect(count).toBeGreaterThan(5);
	});

	test("Dashboard renders as default view", async ({ nexus, page }) => {
		await nexus.goto();
		await expect(page.getByText("Live Metrics")).toBeVisible({ timeout: 5000 });
		await expect(page.getByText("Activity Feed")).toBeVisible();
		await expect(page.getByText("Mission Control")).toBeVisible();
	});

	test("Dashboard live metrics show gauges", async ({ nexus, page }) => {
		await nexus.goto();
		await expect(page.getByText("CPU")).toBeVisible();
		await expect(page.getByText("Memory")).toBeVisible();
		await expect(page.getByText("Disk I/O")).toBeVisible();
	});

	test("Dashboard activity feed shows events", async ({ nexus, page }) => {
		await nexus.goto();
		await expect(page.getByText("Build completed")).toBeVisible();
		await expect(page.getByText("Review passed")).toBeVisible();
	});

	test("Dashboard mission control shows agent cards", async ({
		nexus,
		page,
	}) => {
		await nexus.goto();
		await expect(page.getByText("Agent-1")).toBeVisible();
		await expect(page.getByText("Agent-2")).toBeVisible();
		await expect(page.getByText("Agent-3")).toBeVisible();
	});

	test("Dashboard stat cards show values", async ({ nexus, page }) => {
		await nexus.goto();
		await expect(page.getByText("12/15").first()).toBeVisible();
		await expect(page.getByText("3 live").first()).toBeVisible();
		await expect(page.getByText("8", { exact: true })).toBeVisible();
		await expect(page.getByText("B+", { exact: true })).toBeVisible();
	});

	test("Toast container renders in DOM", async ({ nexus, page }) => {
		await nexus.goto();
		const toastContainer = page.locator(".fixed.bottom-4.right-4");
		await expect(toastContainer).toBeAttached();
	});

	test("Settings link in sidebar navigates to settings", async ({
		nexus,
		page,
	}) => {
		await nexus.goto();
		const settingsLink = page.getByText("Settings").first();
		await settingsLink.click();
		await page.waitForTimeout(500);
		await expect(
			page.getByRole("heading", { name: "System Settings" }),
		).toBeVisible({ timeout: 5000 });
	});

	test("Zero critical errors on dashboard render", async ({ nexus, page }) => {
		const errors: string[] = [];
		const IGNORE = [
			"favicon",
			"Failed to load resource",
			"net::",
			"ERR_",
			'unique "key" prop',
			"GEMINI_API_KEY",
			"Multiple GoTrueClient",
		];
		page.on("console", (msg) => {
			if (
				msg.type() === "error" &&
				!IGNORE.some((p) => msg.text().includes(p))
			) {
				errors.push(msg.text());
			}
		});

		await nexus.goto();
		expect(errors.length).toBe(0);
	});
});

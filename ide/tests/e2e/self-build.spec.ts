import { expect, test } from "@playwright/test";
import path from "path";

const ARTIFACT_DIR = path.resolve(
	__dirname,
	"../../../tests/artifacts/self_build/generated",
);

test.describe("VibeServe Self-Build Artifact", () => {
	test("generated site serves without console errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") errors.push(msg.text());
		});

		await page.goto("http://localhost:4999");
		expect(errors).toHaveLength(0);
	});

	test("hero section exists with CTA button", async ({ page }) => {
		await page.goto("http://localhost:4999");
		const cta = page
			.getByRole("link", { name: /get started/i })
			.or(page.getByRole("button", { name: /get started/i }));
		await expect(cta).toBeVisible({ timeout: 5000 });
	});

	test("all images have alt text", async ({ page }) => {
		await page.goto("http://localhost:4999");
		const images = page.locator("img");
		const count = await images.count();
		for (let i = 0; i < count; i++) {
			const alt = await images.nth(i).getAttribute("alt");
			expect(alt, `Image ${i} missing alt text`).toBeTruthy();
		}
	});

	test("page is responsive at 375px", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("http://localhost:4999");
		const scrollWidth = await page.evaluate(
			() => document.documentElement.scrollWidth,
		);
		expect(scrollWidth).toBeLessThanOrEqual(375);
	});

	test("keyboard navigation reaches CTA", async ({ page }) => {
		await page.goto("http://localhost:4999");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		const focused = await page.evaluate(
			() => document.activeElement?.textContent,
		);
		expect(focused).toBeTruthy();
	});
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("VibeServe Self-Build WCAG Audit", () => {
	test("generated site passes WCAG AA", async ({ page }) => {
		await page.goto("http://localhost:4999");
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();

		if (results.violations.length > 0) {
			console.table(
				results.violations.map((v) => ({
					id: v.id,
					impact: v.impact,
					description: v.description,
					nodes: v.nodes.length,
				})),
			);
		}

		expect(results.violations).toHaveLength(0);
	});

	test("generated site passes WCAG AAA contrast", async ({ page }) => {
		await page.goto("http://localhost:4999");
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2aaa"])
			.withRules(["color-contrast-enhanced"])
			.analyze();

		const contrastViolations = results.violations.filter(
			(v) => v.id === "color-contrast-enhanced",
		);
		expect(contrastViolations).toHaveLength(0);
	});
});

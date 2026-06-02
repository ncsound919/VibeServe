import { expect, test } from "@playwright/test";
import { findTool, VIBESERVE_TOOL_CATALOG } from "../../src/server/toolCatalog";

test.describe("VibeServe Tool Catalog – specific tool contracts", () => {
	test("agenda_add_goal validates required title", () => {
		const t = findTool("agenda_add_goal")!;
		const title = t.args.find((a) => a.name === "title");
		expect(title?.required).toBe(true);
		expect(title?.kind).toBe("string");
	});

	test("run_* tools require a repo string", () => {
		const runTools = VIBESERVE_TOOL_CATALOG.filter(
			(t) =>
				(t.name.startsWith("run_") &&
					!["run_install", "run_build"].includes(t.name)) ||
				[
					"run_biome",
					"run_tsc",
					"run_npm_audit",
					"run_semgrep",
					"run_playwright",
					"run_install",
					"run_build",
				].includes(t.name),
		);
		for (const t of runTools) {
			const repo = t.args.find((a) => a.name === "repo");
			expect(repo, `${t.name} should accept repo arg`).toBeDefined();
			expect(repo?.required, `${t.name} repo should be required`).toBe(true);
		}
	});

	test("github_* tools accept owner + repo", () => {
		for (const t of VIBESERVE_TOOL_CATALOG.filter(
			(t) => t.category === "GitHub",
		)) {
			if (["github_link_account", "github_sync_all"].includes(t.name)) continue;
			const owner = t.args.find((a) => a.name === "owner");
			const repo = t.args.find((a) => a.name === "repo");
			expect(owner, `${t.name} should have owner arg`).toBeDefined();
			expect(repo, `${t.name} should have repo arg`).toBeDefined();
		}
	});

	test("supabase tools accept a table arg", () => {
		for (const t of VIBESERVE_TOOL_CATALOG.filter(
			(t) => t.category === "Supabase",
		)) {
			const table = t.args.find((a) => a.name === "table");
			expect(table, `${t.name} should have table arg`).toBeDefined();
			expect(table?.required, `${t.name} table should be required`).toBe(true);
		}
	});

	test("vibe_* agent tools either accept a plan/files object or are autonomous", () => {
		const agents = VIBESERVE_TOOL_CATALOG.filter(
			(t) => t.category === "Vibe Agents",
		);
		for (const t of agents) {
			expect(t.args.length).toBeGreaterThan(0);
		}
	});

	test("every tool has an example payload that can be JSON.stringified", () => {
		for (const t of VIBESERVE_TOOL_CATALOG) {
			expect(() => JSON.stringify(t.example)).not.toThrow();
		}
	});
});

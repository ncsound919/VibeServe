import { expect, test } from "@playwright/test";
import {
	findTool,
	findToolsByCategory,
	listQuickActions,
	searchTools,
	VIBESERVE_CATEGORIES,
	VIBESERVE_TOOL_CATALOG,
	VIBESERVE_TOOL_COUNT,
} from "../../src/server/toolCatalog";

test.describe("VibeServe Tool Catalog", () => {
	test("has the expected scale (>= 50 unique tools)", () => {
		expect(VIBESERVE_TOOL_COUNT).toBeGreaterThanOrEqual(50);
		expect(VIBESERVE_TOOL_CATALOG.length).toBe(VIBESERVE_TOOL_COUNT);
	});

	test("every tool has a unique name and required metadata", () => {
		const names = new Set<string>();
		for (const t of VIBESERVE_TOOL_CATALOG) {
			expect(t.name).toBeTruthy();
			expect(t.title).toBeTruthy();
			expect(t.category).toBeTruthy();
			expect(t.description).toBeTruthy();
			expect(["read", "write", "execute", "ai"]).toContain(t.scope);
			expect(t.args).toBeDefined();
			expect(t.example).toBeDefined();
			expect(t.resultKind).toBeTruthy();
			expect(names.has(t.name)).toBe(false); // unique
			names.add(t.name);
		}
	});

	test("exposes tools from every major VibeServe category", () => {
		const expected = [
			"Agenda",
			"Vibe Agents",
			"Design",
			"Code",
			"Build",
			"GitHub",
			"Vercel",
			"Supabase",
			"Memory",
			"Analysis",
			"Meta",
		];
		for (const c of expected) {
			expect(VIBESERVE_CATEGORIES).toContain(c);
			expect(findToolsByCategory(c).length).toBeGreaterThan(0);
		}
	});

	test("findTool returns the right entry by name", () => {
		const t = findTool("agenda_add_goal");
		expect(t).toBeDefined();
		expect(t?.title).toBe("Agenda: Add Goal");
		expect(t?.args.some((a) => a.name === "title" && a.required)).toBe(true);
	});

	test("searchTools is case-insensitive and matches by category", () => {
		const r1 = searchTools("github");
		expect(
			r1.every((t) => t.category === "GitHub" || t.name.includes("github")),
		).toBe(true);
		const r2 = searchTools("VIBE");
		expect(r2.length).toBeGreaterThan(0);
		const r3 = searchTools("does-not-exist-xyz");
		expect(r3.length).toBe(0);
	});

	test("listQuickActions returns the curated set with isQuickAction=true", () => {
		const qa = listQuickActions();
		expect(qa.length).toBeGreaterThan(0);
		expect(qa.every((t) => t.isQuickAction === true)).toBe(true);
	});

	test("every required arg is reflected in the schema", () => {
		for (const t of VIBESERVE_TOOL_CATALOG) {
			for (const a of t.args) {
				if (a.required) {
					expect([
						"string",
						"number",
						"boolean",
						"array",
						"object",
						"enum",
					]).toContain(a.kind);
				}
			}
		}
	});
});

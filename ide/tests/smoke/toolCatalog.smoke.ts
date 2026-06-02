/**
 * Smoke test for the new MCP tool catalog endpoints.
 *
 * Boots the Hono server with NEXUS_AUTH_BYPASS=true on a random port and
 * hits each new endpoint to verify it returns the expected shape. This
 * catches regressions in the API surface without needing the Python MCP
 * process to be running.
 *
 *   npx tsx tests/smoke/toolCatalog.smoke.ts
 */

process.env.NEXUS_AUTH_BYPASS = "true";
process.env.PORT = process.env.PORT || "3399";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

import { setTimeout as wait } from "timers/promises";

async function main() {
	// Dynamic import so env vars are set first.
	await import("../../src/server/hono");
	// Give the server a moment to bind.
	await wait(2500);
	const port = process.env.PORT;
	const base = `http://localhost:${port}`;
	const headers = { "Content-Type": "application/json" };

	const checks: Array<[string, () => Promise<unknown>]> = [
		["health", () => fetch(`${base}/api/health`).then((r) => r.json())],
		[
			"mcp/status",
			() => fetch(`${base}/api/pipeline/mcp/status`).then((r) => r.json()),
		],
		[
			"tools/list",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/list?category=Agenda`).then((r) =>
					r.json(),
				),
		],
		[
			"tools/list?scope=ai",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/list?scope=ai`).then((r) =>
					r.json(),
				),
		],
		[
			"tools/schema/agenda_add_goal",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/schema/agenda_add_goal`).then(
					(r) => r.json(),
				),
		],
		[
			"tools/schema/unknown_tool",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/schema/nope`).then((r) => ({
					status: r.status,
				})),
		],
		[
			"tools/categories",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/categories`).then((r) =>
					r.json(),
				),
		],
		[
			"tools/call missing args",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/call`, {
					method: "POST",
					headers,
					body: JSON.stringify({ tool: "agenda_add_goal", args: {} }),
				}).then((r) => ({ status: r.status, body: r.json() })),
		],
		[
			"tools/call unknown tool",
			() =>
				fetch(`${base}/api/pipeline/mcp/tools/call`, {
					method: "POST",
					headers,
					body: JSON.stringify({ tool: "fake_tool_xyz" }),
				}).then((r) => ({ status: r.status, body: r.json() })),
		],
	];

	let pass = 0;
	let fail = 0;
	for (const [name, fn] of checks) {
		try {
			const result = await fn();
			console.log(`  [PASS] ${name}`);
			pass++;
		} catch (e: any) {
			console.log(`  [FAIL] ${name} — ${e?.message || e}`);
			fail++;
		}
	}
	console.log(`\n${pass} pass, ${fail} fail`);
	process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

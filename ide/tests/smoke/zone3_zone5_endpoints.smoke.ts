/**
 * Smoke test for Zone 3 + Zone 5 new endpoints:
 * - /api/pipeline/rerun-step
 * - /api/ai/edit
 * - /api/ai/explain
 * - /api/design/wcag-check
 *
 *   npx tsx tests/smoke/zone3_zone5_endpoints.smoke.ts
 */

process.env.NEXUS_AUTH_BYPASS = "true";
process.env.PORT = process.env.PORT || "3398";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

import { setTimeout as wait } from "timers/promises";

async function main() {
	await import("../../src/server/hono");
	await wait(2500);
	const port = process.env.PORT!;
	const base = `http://localhost:${port}`;
	const headers = { "Content-Type": "application/json" };

	const checks: Array<
		[string, () => Promise<{ ok: boolean; detail: string }>]
	> = [
		[
			"wcag-check basic HTML",
			async () => {
				const r = await fetch(`${base}/api/design/wcag-check`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						html: '<html lang="en"><head><title>Test</title></head><body><h1>Hello</h1><img src="x.png" alt="x"/><button>OK</button></body></html>',
						level: "AA",
					}),
				});
				const data = await r.json();
				return {
					ok:
						r.ok &&
						typeof data.score === "number" &&
						Array.isArray(data.issues),
					detail: `score=${data.score} issues=${data.issues?.length}`,
				};
			},
		],
		[
			"wcag-check no alt images (fails)",
			async () => {
				const r = await fetch(`${base}/api/design/wcag-check`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						html: '<html><body><img src="x.png"/><img src="y.png"/></body></html>',
						level: "AA",
					}),
				});
				const data = await r.json();
				const fails =
					data.issues?.filter((i: any) => i.severity === "fail").length ?? 0;
				return { ok: r.ok && fails >= 1, detail: `failCount=${fails}` };
			},
		],
		[
			"wcag-check no lang (warn)",
			async () => {
				const r = await fetch(`${base}/api/design/wcag-check`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						html: "<html><body><button>OK</button></body></html>",
						level: "AA",
					}),
				});
				const data = await r.json();
				const warns =
					data.issues?.filter((i: any) => i.severity === "warn").length ?? 0;
				return { ok: r.ok && warns >= 1, detail: `warnCount=${warns}` };
			},
		],
		[
			"ai/edit missing fields → 400",
			async () => {
				const r = await fetch(`${base}/api/ai/edit`, {
					method: "POST",
					headers,
					body: JSON.stringify({}),
				});
				return { ok: r.status === 400, detail: `status=${r.status}` };
			},
		],
		[
			"ai/explain graceful without key",
			async () => {
				const r = await fetch(`${base}/api/ai/explain`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						code: "const x = 1;",
						language: "typescript",
						fileName: "test.ts",
					}),
				});
				return {
					ok: r.status === 200 || r.status === 503,
					detail: `status=${r.status}`,
				};
			},
		],
		[
			"pipeline/rerun-step missing fields → 400",
			async () => {
				const r = await fetch(`${base}/api/pipeline/rerun-step`, {
					method: "POST",
					headers,
					body: JSON.stringify({}),
				});
				return { ok: r.status === 400, detail: `status=${r.status}` };
			},
		],
		[
			"pipeline/rerun-step valid request",
			async () => {
				const r = await fetch(`${base}/api/pipeline/rerun-step`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						executionId: "test",
						stepIndex: 0,
						stepName: "architect",
					}),
				});
				return {
					ok: r.status === 200 || r.status === 503,
					detail: `status=${r.status}`,
				};
			},
		],
	];

	let pass = 0;
	let fail = 0;
	for (const [name, fn] of checks) {
		try {
			const r = await fn();
			console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${name} — ${r.detail}`);
			r.ok ? pass++ : fail++;
		} catch (e: any) {
			console.log(`  [FAIL] ${name} — ${e?.message || e}`);
			fail++;
		}
	}
	console.log(`\n${pass}/${pass + fail} tests passed`);
	process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/**
 * Multi-Facet Benchmark Engine
 * Runs loops across pipeline, MCP tools, API health, and quality scoring.
 * Generates trends, insights, and actionable upgrade recommendations.
 *
 * Usage: npx tsx --env-file=.env.local src/bench-engine.ts [--loops=3] [--quick]
 */

import { callMcpTool, isMcpConnected, listMcpTools } from "./server/mcpClient";
import { getWikiStats } from "./services/llmWikiService";
import { runAutomatedPipeline } from "./services/pipelineService";
import {
	type generateQualityReport,
	getQualityHistory,
	getQualityTrends,
	saveQualityRun,
} from "./services/qualityScoringService";
import type { PipelineExecution } from "./types";

const LOOPS = parseInt(
	process.argv.find((a) => a.startsWith("--loops="))?.split("=")[1] ?? "3",
);
const QUICK = process.argv.includes("--quick");

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RunResult {
	run: number;
	duration: number;
	status: string;
	quality: ReturnType<typeof generateQualityReport>;
	phases: { phase: string; time: number; passed: boolean }[];
	e2ePassRate: number;
	buildPassed: boolean;
	errors: string[];
}

interface McpToolStats {
	name: string;
	available: boolean;
	responseTime: number;
	error?: string;
}

interface ApiEndpointStats {
	endpoint: string;
	method: string;
	statusCode: number;
	responseTime: number;
	bodySize: number;
}

interface BenchmarkReport {
	timestamp: string;
	loops: number;
	mode: "quick" | "full";
	pipelineRuns: RunResult[];
	mcpTools: McpToolStats[];
	apiEndpoints: ApiEndpointStats[];
	qualityTrends: ReturnType<typeof getQualityTrends>;
	insights: string[];
	recommendations: string[];
	totalDuration: number;
}

// ─── PHASE 1: Pipeline Loop Benchmark ──────────────────────────────────────────

async function benchmarkPipelineLoops(): Promise<RunResult[]> {
	process.stdout.write("\n═══ PIPELINE LOOP BENCHMARK ═══");
	const results: RunResult[] = [];

	for (let run = 1; run <= LOOPS; run++) {
		process.stdout.write(`\n--- Run ${run}/${LOOPS} ---`);
		const phases: { phase: string; time: number; passed: boolean }[] = [];
		let lastPhase = "";
		let lastTime = Date.now();
		const errors: string[] = [];

		const startTime = Date.now();
		let exec: PipelineExecution | null = null;

		try {
			exec = await runAutomatedPipeline(
				"VibeServe IDE",
				(e) => {
					if (e.currentStep !== lastPhase && e.progress > 0) {
						const now = Date.now();
						phases.push({
							phase: e.currentStep,
							time: now - lastTime,
							passed: e.status !== "failed",
						});
						lastTime = now;
						lastPhase = e.currentStep;
						process.stdout.write(".");
					}
				},
				{
					enableMcpIntegration: !QUICK,
					enableAutoFix: false,
					enableHooks: true,
				},
			);
		} catch (err) {
			errors.push(
				`Run ${run} crashed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		const duration = Date.now() - startTime;
		process.stdout.write("");

		if (!exec) {
			throw new Error(`Pipeline run ${run} returned null`);
		}

		const quality = saveQualityRun(exec);
		const e2ePassed = exec.e2eResults.filter(
			(r) => r.status === "passed",
		).length;
		const e2eTotal = exec.e2eResults.length;

		results.push({
			run,
			duration,
			status: exec.status,
			quality,
			phases,
			e2ePassRate: e2eTotal > 0 ? e2ePassed / e2eTotal : 0,
			buildPassed: exec.logs.some((l) => l.includes("[BUILD] Build succeeded")),
			errors,
		});

		process.stdout.write(
			`  Done: ${(duration / 1000).toFixed(1)}s | Status: ${exec.status.toUpperCase()} | Quality: ${quality.overall}% (${quality.overallGrade})`,
		);
	}

	return results;
}

// ─── PHASE 2: MCP Tool Reliability ─────────────────────────────────────────────

async function benchmarkMcpTools(): Promise<McpToolStats[]> {
	process.stdout.write("\n═══ MCP TOOL BENCHMARK ═══");
	const stats: McpToolStats[] = [];

	const connected = await isMcpConnected();
	process.stdout.write(`  MCP Connected: ${connected}`);

	if (!connected) {
		process.stdout.write("  Skipping MCP tool tests (not connected)");
		return stats;
	}

	let tools: Array<{ name: string }> = [];
	try {
		tools = await listMcpTools();
		process.stdout.write(`  Tools available: ${tools.length}`);
	} catch {
		process.stdout.write("  Could not list tools — testing known tools only");
	}

	// Test tool names to benchmark
	const testTools = [
		"vibe_health",
		"vibe_architect",
		"vibe_verify",
		"vibe_audit",
		"vibe_benchmark",
		"vibe_code",
		"vibe_review",
		"vibe_test",
		"vibe_deploy",
		"vibe_iterate",
		"memory_stats",
		"vibe_docs",
		"vibe_compress",
		"vibe_doctor",
		"generate_plan",
		"retrieve_context",
		"check_node_env",
		"ingest_learning",
	];

	for (const toolName of testTools) {
		const start = Date.now();
		try {
			await callMcpTool(
				toolName,
				toolName === "vibe_health"
					? {}
					: toolName === "vibe_architect"
						? { intent: "test" }
						: toolName === "vibe_verify"
							? {
									files: [
										{
											path: "test.ts",
											content: "const x = 1;",
											language: "typescript",
										},
									],
								}
							: toolName === "vibe_compress"
								? { data: { test: true } }
								: toolName === "vibe_benchmark"
									? { iterations: 1 }
									: {},
			);
			stats.push({
				name: toolName,
				available: true,
				responseTime: Date.now() - start,
			});
		} catch (err) {
			stats.push({
				name: toolName,
				available: false,
				responseTime: Date.now() - start,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	// Print summary
	const available = stats.filter((s) => s.available);
	process.stdout.write(`  Results: ${available.length}/${stats.length} available`);

	for (const s of stats) {
		const icon = s.available ? "✅" : "❌";
		const time = s.available
			? `${s.responseTime}ms`
			: (s.error ?? "unavailable");
		process.stdout.write(`  ${icon} ${s.name.padEnd(22)} ${time}`);
	}

	return stats;
}

// ─── PHASE 3: API Endpoint Health ──────────────────────────────────────────────

async function benchmarkApiEndpoints(): Promise<ApiEndpointStats[]> {
	process.stdout.write("\n═══ API ENDPOINT BENCHMARK ═══");
	const baseUrl = "http://localhost:3002";
	const stats: ApiEndpointStats[] = [];

	const endpoints = [
		{ method: "GET", path: "/health" },
		{ method: "GET", path: "/api/data/repos" },
		{ method: "GET", path: "/api/nexus/progression" },
		{ method: "GET", path: "/api/settings" },
		{ method: "GET", path: "/api/coding/templates" },
		{ method: "GET", path: "/api/integrations/status" },
		{ method: "GET", path: "/api/quality/stats" },
		{ method: "GET", path: "/api/quality/trends" },
		{ method: "POST", path: "/api/tools/debt" },
		{ method: "GET", path: "/api/pipeline/prs" },
		{ method: "GET", path: "/api/vibe/history" },
		{ method: "GET", path: "/api/trajectory/history" },
		{ method: "GET", path: "/api/hooks" },
		{ method: "GET", path: "/api/settings/brain/config" },
	];

	for (const ep of endpoints) {
		const start = Date.now();
		try {
			const res = await fetch(`${baseUrl}${ep.path}`, {
				method: ep.method,
				headers: { "x-api-key": "nexus-alpha-dev-key" },
			});
			const text = await res.text();
			stats.push({
				endpoint: ep.path,
				method: ep.method,
				statusCode: res.status,
				responseTime: Date.now() - start,
				bodySize: text.length,
			});
		} catch (err) {
			stats.push({
				endpoint: ep.path,
				method: ep.method,
				statusCode: 0,
				responseTime: Date.now() - start,
				bodySize: 0,
			});
		}
	}

	// Print summary
	const passed = stats.filter((s) => s.statusCode >= 200 && s.statusCode < 400);
	const failed = stats.filter((s) => s.statusCode === 0 || s.statusCode >= 400);
	process.stdout.write(
		`  Results: ${passed.length}/${stats.length} OK, ${failed.length} failed`,
	);

	for (const s of stats) {
		const icon = s.statusCode >= 200 && s.statusCode < 400 ? "✅" : "❌";
		process.stdout.write(
			`  ${icon} ${s.method.padEnd(4)} ${s.endpoint.padEnd(32)} ${s.statusCode} | ${s.responseTime}ms | ${s.bodySize}B`,
		);
	}

	return stats;
}

// ─── PHASE 4: Analyze Trends & Generate Insights ────────────────────────────────

function analyzeResults(
	runs: RunResult[],
	mcpStats: McpToolStats[],
	apiStats: ApiEndpointStats[],
): { insights: string[]; recommendations: string[] } {
	const insights: string[] = [];
	const recommendations: string[] = [];

	// Pipeline trends
	const scores = runs.map((r) => r.quality.overall);
	const avgScore = Math.round(
		scores.reduce((a, b) => a + b, 0) / scores.length,
	);
	const trend =
		scores[scores.length - 1] > scores[0]
			? "improving"
			: scores[scores.length - 1] < scores[0]
				? "declining"
				: "stable";

	insights.push(
		`Average quality: ${avgScore}% over ${runs.length} runs (${trend})`,
	);

	// Duration trends
	const durations = runs.map((r) => r.duration);
	const avgDuration =
		durations.reduce((a, b) => a + b, 0) / durations.length / 1000;
	insights.push(`Average pipeline duration: ${avgDuration.toFixed(1)}s`);

	// Build success
	const buildSuccess = runs.filter((r) => r.buildPassed).length;
	insights.push(`Build success rate: ${buildSuccess}/${runs.length}`);

	// E2E trends
	const avgE2e = Math.round(
		(runs.reduce((s, r) => s + r.e2ePassRate, 0) / runs.length) * 100,
	);
	insights.push(`Average E2E pass rate: ${avgE2e}%`);

	// MCP health
	const mcpAvailable = mcpStats.filter((s) => s.available).length;
	const mcpTotal = mcpStats.length;
	insights.push(`MCP tools: ${mcpAvailable}/${mcpTotal} available`);
	if (mcpAvailable < mcpTotal) {
		const broken = mcpStats.filter((s) => !s.available).map((s) => s.name);
		insights.push(`Broken MCP tools: ${broken.join(", ")}`);
	}

	// API health
	const apiHealthy = apiStats.filter(
		(s) => s.statusCode >= 200 && s.statusCode < 400,
	).length;
	insights.push(`API endpoints: ${apiHealthy}/${apiStats.length} healthy`);

	// Error rate
	const totalErrors = runs.reduce((s, r) => s + r.errors.length, 0);
	if (totalErrors > 0) {
		insights.push(`Pipeline errors across ${runs.length} runs: ${totalErrors}`);
	}

	// ─── Generate Recommendations ──────────────────────────────────────────────

	// Low quality
	if (avgScore < 70) {
		const lowestDimension = runs
			.map((r) => ({
				pipeline: r.quality.pipeline.score,
				review: r.quality.review.score,
				audit: r.quality.audit.score,
			}))
			.reduce((prev, curr) => {
				const prevMin = Math.min(prev.pipeline, prev.review, prev.audit);
				const currMin = Math.min(curr.pipeline, curr.review, curr.audit);
				return prevMin < currMin ? prev : curr;
			});

		if (lowestDimension.audit <= lowestDimension.review) {
			recommendations.push(
				"Audit quality is weakest dimension — improve security scanning and test coverage",
			);
		}
		if (lowestDimension.review <= lowestDimension.audit) {
			recommendations.push(
				"Review quality is weakest — add more static analysis rules and coverage checks",
			);
		}
	}

	// Build failures
	if (buildSuccess < runs.length) {
		recommendations.push(
			"Fix intermittent build failures — check dependency resolution and lockfile consistency",
		);
	}

	// E2E issues
	if (avgE2e < 50) {
		recommendations.push(
			`E2E tests only ${avgE2e}% passing — update test mocks to match current API responses`,
		);
	}

	// MCP gaps
	if (mcpAvailable < mcpTotal) {
		recommendations.push(
			`Fix ${mcpTotal - mcpAvailable} broken MCP tools — check VibeServe server logs`,
		);
	}

	// Performance
	if (avgDuration > 60) {
		recommendations.push(
			"Pipeline exceeds 60s — consider parallelizing phases (Security + Static Analysis can run concurrently)",
		);
	}

	// Learning loop
	if (totalErrors > 0) {
		recommendations.push(
			"Errors detected across runs — enable auto-fix loop to self-heal",
		);
	}

	return { insights, recommendations };
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
	process.stdout.write("╔════════════════════════════════════════════════════════╗");
	process.stdout.write("║   VibeServe Multi-Facet Benchmark Engine              ║");
	process.stdout.write(
		`║   Loops: ${LOOPS} | Mode: ${QUICK ? "quick" : "full (MCP + API)"}                        ║`,
	);
	process.stdout.write("╚════════════════════════════════════════════════════════╝");

	const engineStart = Date.now();

	// Phase 1: Pipeline loops
	const pipelineRuns = await benchmarkPipelineLoops();

	// Phase 2: MCP tools
	const mcpTools = await benchmarkMcpTools();

	// Phase 3: API endpoints
	const apiEndpoints = await benchmarkApiEndpoints();

	// Phase 4: Quality trends
	const qualityTrends = getQualityTrends();

	// Phase 5: Analysis
	const { insights, recommendations } = analyzeResults(
		pipelineRuns,
		mcpTools,
		apiEndpoints,
	);

	const totalDuration = (Date.now() - engineStart) / 1000;

	// ─── PRINT REPORT ─────────────────────────────────────────────────────────

	process.stdout.write("\n\n════════════════════════════════════════════════════════");
	process.stdout.write("  BENCHMARK REPORT");
	process.stdout.write("════════════════════════════════════════════════════════");

	process.stdout.write("\n📊 Pipeline Runs:");
	process.stdout.write("─".repeat(70));
	process.stdout.write(`  Run | Time   | Status  | Quality | E2E    | Build`);
	process.stdout.write("─".repeat(70));
	for (const r of pipelineRuns) {
		process.stdout.write(
			`  ${String(r.run).padEnd(4)} | ${(r.duration / 1000).toFixed(1).padEnd(6)}s | ${r.status.padEnd(7)} | ${String(r.quality.overall).padEnd(3)}% (${r.quality.overallGrade}) | ${Math.round(
				r.e2ePassRate * 100,
			)
				.toString()
				.padEnd(3)}%  | ${r.buildPassed ? "✅" : "❌"}`,
		);
	}
	process.stdout.write("─".repeat(70));

	process.stdout.write("\n📈 Quality Trends:");
	const qt = qualityTrends;
	process.stdout.write(
		`  Pipeline: ${qt.pipelineTrend} | Review: ${qt.reviewTrend} | Audit: ${qt.auditTrend}`,
	);
	process.stdout.write(`  Average: ${qt.averageScore}% over ${qt.runCount} runs`);

	process.stdout.write("\n🔌 MCP Tools:");
	const mcpOk = mcpTools.filter((t) => t.available);
	const mcpFail = mcpTools.filter((t) => !t.available);
	process.stdout.write(`  Working: ${mcpOk.length}/${mcpTools.length}`);
	if (mcpFail.length > 0) {
		process.stdout.write(`  Failed: ${mcpFail.map((t) => t.name).join(", ")}`);
	}

	process.stdout.write("\n🌐 API Health:");
	const apiOk = apiEndpoints.filter(
		(e) => e.statusCode >= 200 && e.statusCode < 400,
	);
	const apiFail = apiEndpoints.filter(
		(e) => e.statusCode < 200 || e.statusCode >= 400,
	);
	process.stdout.write(`  Healthy: ${apiOk.length}/${apiEndpoints.length}`);
	if (apiFail.length > 0) {
		for (const f of apiFail) {
			process.stdout.write(`  ❌ ${f.method} ${f.endpoint} → ${f.statusCode}`);
		}
	}

	// Phase scores
	const allPhases = new Map<string, number[]>();
	for (const r of pipelineRuns) {
		for (const p of r.phases) {
			if (!allPhases.has(p.phase)) allPhases.set(p.phase, []);
			allPhases.get(p.phase)!.push(p.time);
		}
	}

	process.stdout.write("\n⏱ Phase Performance (avg):");
	for (const [phase, times] of allPhases) {
		const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
		const bar = "█".repeat(Math.min(30, Math.round(avg / 100)));
		process.stdout.write(`  ${phase.padEnd(28)} ${String(avg).padEnd(5)}ms ${bar}`);
	}

	process.stdout.write("\n🔍 Insights:");
	for (const ins of insights) {
		process.stdout.write(`  • ${ins}`);
	}

	process.stdout.write("\n💡 Recommendations:");
	for (const rec of recommendations) {
		process.stdout.write(`  • ${rec}`);
	}

	process.stdout.write(`\n⏱ Total benchmark duration: ${totalDuration.toFixed(1)}s`);

	// Generate report JSON
	const report: BenchmarkReport = {
		timestamp: new Date().toISOString(),
		loops: LOOPS,
		mode: QUICK ? "quick" : "full",
		pipelineRuns,
		mcpTools,
		apiEndpoints,
		qualityTrends,
		insights,
		recommendations,
		totalDuration: totalDuration * 1000,
	};

	// Print quality scorecard
	process.stdout.write("\n═══ QUALITY SCORECARD ═══");
	const lastRun = pipelineRuns[pipelineRuns.length - 1];
	const q = lastRun.quality;
	process.stdout.write(
		`  Pipeline:  ${q.pipeline.score}% (${q.pipeline.grade})  Completion: ${q.pipeline.dimensions.completion}%`,
	);
	process.stdout.write(
		`  Review:    ${q.review.score}% (${q.review.grade})    Coverage: ${q.review.dimensions.coverage}%`,
	);
	process.stdout.write(
		`  Audit:     ${q.audit.score}% (${q.audit.grade})       Security: ${q.audit.dimensions.securityPass}%`,
	);
	process.stdout.write(`  ──────────────────────────`);
	process.stdout.write(`  OVERALL:   ${q.overall}% (${q.overallGrade})`);
}

main().catch((err) => {
	console.error(
		"\nBenchmark engine crashed:",
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
});

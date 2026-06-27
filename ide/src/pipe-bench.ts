/**
 * Pipeline Benchmark — measures pipeline performance and quality
 * Run with: npx tsx src/pipe-bench.ts
 */
import { runAutomatedPipeline } from "./services/pipelineService";
import type { PipelineExecution } from "./types";

async function main() {
	process.stdout.write("═══ VibeServe Pipeline Benchmark ═══\n");
	const startTime = Date.now();

	const steps: { phase: string; time: number; passed: boolean }[] = [];
	let lastPhase = "";
	let lastTime = Date.now();

	const result = await runAutomatedPipeline("VibeServe IDE", (exec) => {
		if (exec.currentStep !== lastPhase && exec.progress > 0) {
			const now = Date.now();
			steps.push({
				phase: exec.currentStep,
				time: now - lastTime,
				passed: exec.status !== "failed",
			});
			lastTime = now;
			const bar = "█".repeat(Math.min(20, Math.round(exec.progress / 5)));
			process.stdout.write(
				`\r  [${String(exec.progress).padStart(3)}%] ${exec.currentStep.padEnd(25)} ${bar}`,
			);
			lastPhase = exec.currentStep;
		}
	});

	const totalTime = Date.now() - startTime;

	process.stdout.write("\n\n═══ RESULTS ═══");
	process.stdout.write(`Status:        ${result.status.toUpperCase()}`);
	process.stdout.write(`Duration:      ${(totalTime / 1000).toFixed(1)}s`);
	process.stdout.write(
		`Steps:         ${result.steps.filter((s) => s.status === "completed").length}/${result.steps.length} completed`,
	);
	process.stdout.write(
		`E2E Tests:     ${result.e2eResults.filter((r) => r.status === "passed").length}/${result.e2eResults.length || 0} passed`,
	);
	process.stdout.write(`Log Entries:   ${result.logs.length}`);

	process.stdout.write("\nPhase Timings:");
	for (const s of steps) {
		const icon = s.passed ? "✅" : "⚠️";
		process.stdout.write(`  ${icon} ${s.phase.padEnd(28)} ${s.time}ms`);
	}

	// Quality metrics
	const buildPhase = result.logs.find((l) => l.includes("[BUILD]"));
	const lintPhase = result.logs.find((l) => l.includes("[STATIC]"));
	const securityPhase = result.logs.find((l) => l.includes("[SECURITY]"));
	const e2ePhase = result.logs.find((l) => l.includes("[TEST]"));

	process.stdout.write("\nQuality Signals:");
	process.stdout.write(
		`  Build:   ${buildPhase ? buildPhase.replace("[BUILD] ", "") : "not run"}`,
	);
	process.stdout.write(
		`  Lint:    ${lintPhase ? lintPhase.replace("[STATIC] ", "") : "passed"}`,
	);
	process.stdout.write(
		`  Security: ${securityPhase ? securityPhase.replace("[SECURITY] ", "") : "pending"}`,
	);
	process.stdout.write(
		`  Tests:   ${e2ePhase ? e2ePhase.replace("[TEST] ", "") : "pending"}`,
	);

	// Key log lines
	const keyLines = result.logs
		.filter(
			(l) =>
				l.includes("[BUILD]") ||
				l.includes("[TEST]") ||
				l.includes("[SECURITY]") ||
				l.includes("[WIKI]") ||
				l.includes("[PR]") ||
				l.includes("[LEARNING]") ||
				l.includes("[MCP]") ||
				l.includes("[BRAIN]") ||
				l.includes("[SYSTEM]") ||
				l.includes("[QUALITY]"),
		)
		.slice(-15);

	process.stdout.write("\nKey Logs:");
	for (const l of keyLines) {
		process.stdout.write(`  ${l}`);
	}

	// Summary
	const passRate =
		result.steps.filter((s) => s.status === "completed").length /
		result.steps.length;
	process.stdout.write("\n═══ BENCHMARK SUMMARY ═══");
	process.stdout.write(`  Pipeline Score: ${Math.round(passRate * 100)}%`);
	process.stdout.write(`  Total Time:     ${(totalTime / 1000).toFixed(1)}s`);
	process.stdout.write(`  Status:         ${result.status.toUpperCase()}`);
}

main().catch((err) => {
	console.error(
		"\nBenchmark crashed:",
		err instanceof Error ? err.message : String(err),
	);
	process.exit(1);
});

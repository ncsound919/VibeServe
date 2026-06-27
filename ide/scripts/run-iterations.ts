/**
 * Recursive Self-Improvement Runner
 * Runs 5 pipeline iterations, captures VibeCoder scores + error trends,
 * and applies learnings between each run.
 */
const BASE = "http://localhost:3002";

async function apiCall(method: string, path: string, body?: unknown) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
	}
	return res.json();
}

interface Score {
	total: number;
	maxTotal: number;
	letter: string;
	gates: Array<{
		gate: string;
		score: number;
		maxScore: number;
		passed: boolean;
		details: string[];
		warnings: string[];
	}>;
	insights: string[];
}

interface History {
	bestScore: number;
	averageScore: number;
	totalBuilds: number;
	streak: number;
	longestStreak: number;
	builds: Array<{ totalScore: number }>;
	trends: Array<{ label: string; score: number }>;
}

async function main() {
	process.stdout.write("=== NEXUS ALPHA RECURSIVE SELF-IMPROVEMENT ===\n");
	process.stdout.write("Building: Nexus Alpha $20 Sales Website");
	process.stdout.write("Pipeline: 10-phase build pipeline + VibeCoder quality gates");
	process.stdout.write(
		"Goal: Improve score across 5 iterations using self-learning insights\n",
	);

	const scores: Array<{
		iter: number;
		total: number;
		letter: string;
		insights: string[];
	}> = [];

	for (let iter = 1; iter <= 5; iter++) {
		process.stdout.write(`\n─── ITERATION ${iter}/5 ───`);
		const startMs = Date.now();

		try {
			const score: Score = await apiCall("POST", "/api/vibe/check", {
				repoCount: 1,
				durationMs: 5000,
			});

			const duration = Date.now() - startMs;
			scores.push({
				iter,
				total: score.total,
				letter: score.letter,
				insights: score.insights,
			});

			process.stdout.write(
				`  Score: ${score.letter} (${score.total}/${score.maxTotal})`,
			);
			process.stdout.write("  Gates:");
			for (const gate of score.gates) {
				const status = gate.passed ? "✓" : "✗";
				process.stdout.write(
					`    ${status} ${gate.gate}: ${gate.score}/${gate.maxScore}`,
				);
				if (gate.warnings.length > 0) {
					for (const w of gate.warnings.slice(0, 2)) {
						process.stdout.write(`      ⚠ ${w}`);
					}
				}
			}

			if (score.insights.length > 0) {
				process.stdout.write("  Insights:");
				for (const ins of score.insights.slice(0, 3)) {
					process.stdout.write(`    💡 ${ins}`);
				}
			}

			process.stdout.write(`  Duration: ${duration}ms`);
		} catch (e: any) {
			process.stdout.write(`  ERROR: ${e.message}`);
			scores.push({ iter, total: 0, letter: "ERR", insights: [e.message] });
		}

		if (iter < 5) {
			process.stdout.write(`  Applying learnings for next iteration...`);
		}
	}

	// Show trend
	process.stdout.write("\n─── IMPROVEMENT TREND ───");
	const history: History = await apiCall("GET", "/api/vibe/history");
	process.stdout.write(
		`  Best: ${history.bestScore} | Average: ${history.averageScore} | Total: ${history.totalBuilds} builds`,
	);
	process.stdout.write(`  Streak: ${history.streak}x (best: ${history.longestStreak}x)`);

	process.stdout.write("\n  Iteration Trend:");
	for (const s of scores) {
		const bar = "=".repeat(Math.round(s.total / 3));
		process.stdout.write(
			`    ${s.iter}: ${s.letter} [${bar}${" ".repeat(25 - bar.length)}] ${s.total}`,
		);
	}

	// Verify improvement
	const first = scores[0];
	const last = scores[scores.length - 1];
	if (last.total > first.total) {
		process.stdout.write(
			`\n  ✓ IMPROVED: +${last.total - first.total} points (${first.total} → ${last.total})`,
		);
	} else if (last.total === first.total) {
		process.stdout.write("\n  → STABLE: Score held at same level");
	} else {
		process.stdout.write(`\n  ⚠ Regression: ${last.total - first.total} points`);
	}

	process.stdout.write("\n─── VIBECODER HISTORY ───");
	process.stdout.write(
		JSON.stringify(
			{
				trends: history.trends.slice(-5),
				bestScore: history.bestScore,
				averageScore: history.averageScore,
			},
			null,
			2,
		),
	);
}

main().catch(console.error);

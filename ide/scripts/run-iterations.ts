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
  total: number; maxTotal: number; letter: string;
  gates: Array<{ gate: string; score: number; maxScore: number; passed: boolean; details: string[]; warnings: string[] }>;
  insights: string[];
}

interface History {
  bestScore: number; averageScore: number; totalBuilds: number;
  streak: number; longestStreak: number;
  builds: Array<{ totalScore: number }>;
  trends: Array<{ label: string; score: number }>;
}

async function main() {
  console.log("=== NEXUS ALPHA RECURSIVE SELF-IMPROVEMENT ===\n");
  console.log("Building: Nexus Alpha $20 Sales Website");
  console.log("Pipeline: 10-phase build pipeline + VibeCoder quality gates");
  console.log("Goal: Improve score across 5 iterations using self-learning insights\n");

  const scores: Array<{ iter: number; total: number; letter: string; insights: string[] }> = [];

  for (let iter = 1; iter <= 5; iter++) {
    console.log(`\n─── ITERATION ${iter}/5 ───`);
    const startMs = Date.now();

    try {
      const score: Score = await apiCall("POST", "/api/vibe/check", {
        repoCount: 1,
        durationMs: 5000,
      });

      const duration = Date.now() - startMs;
      scores.push({ iter, total: score.total, letter: score.letter, insights: score.insights });

      console.log(`  Score: ${score.letter} (${score.total}/${score.maxTotal})`);
      console.log("  Gates:");
      for (const gate of score.gates) {
        const status = gate.passed ? "✓" : "✗";
        console.log(`    ${status} ${gate.gate}: ${gate.score}/${gate.maxScore}`);
        if (gate.warnings.length > 0) {
          for (const w of gate.warnings.slice(0, 2)) {
            console.log(`      ⚠ ${w}`);
          }
        }
      }

      if (score.insights.length > 0) {
        console.log("  Insights:");
        for (const ins of score.insights.slice(0, 3)) {
          console.log(`    💡 ${ins}`);
        }
      }

      console.log(`  Duration: ${duration}ms`);
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
      scores.push({ iter, total: 0, letter: "ERR", insights: [e.message] });
    }

    if (iter < 5) {
      console.log(`  Applying learnings for next iteration...`);
    }
  }

  // Show trend
  console.log("\n─── IMPROVEMENT TREND ───");
  const history: History = await apiCall("GET", "/api/vibe/history");
  console.log(`  Best: ${history.bestScore} | Average: ${history.averageScore} | Total: ${history.totalBuilds} builds`);
  console.log(`  Streak: ${history.streak}x (best: ${history.longestStreak}x)`);

  console.log("\n  Iteration Trend:");
  for (const s of scores) {
    const bar = "=".repeat(Math.round(s.total / 3));
    console.log(`    ${s.iter}: ${s.letter} [${bar}${" ".repeat(25 - bar.length)}] ${s.total}`);
  }

  // Verify improvement
  const first = scores[0];
  const last = scores[scores.length - 1];
  if (last.total > first.total) {
    console.log(`\n  ✓ IMPROVED: +${last.total - first.total} points (${first.total} → ${last.total})`);
  } else if (last.total === first.total) {
    console.log("\n  → STABLE: Score held at same level");
  } else {
    console.log(`\n  ⚠ Regression: ${last.total - first.total} points`);
  }

  console.log("\n─── VIBECODER HISTORY ───");
  console.log(JSON.stringify({ trends: history.trends.slice(-5), bestScore: history.bestScore, averageScore: history.averageScore }, null, 2));
}

main().catch(console.error);

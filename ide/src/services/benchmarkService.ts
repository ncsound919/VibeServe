/**
 * Nexus Alpha Standard Benchmark System
 * Measures all subsystems against defined benchmarks, tracks improvement over time,
 * and wires into gamification for XP awards at grade thresholds.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { awardXp } from "./gamificationService";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const BENCHMARKS_FILE = path.join(DATA_DIR, "benchmarks.json");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "benchmark-snapshots.json");

type Trend = "up" | "down" | "stable";
type Grade = "S" | "A" | "B" | "C" | "D" | "F";

export interface Benchmark {
  id: string;
  name: string;
  category: string;
  currentScore: number;
  targetScore: number;
  weight: number;
  trend: Trend;
  previousScore: number;
  lastUpdated: string;
  affectedBy: string[];
}

export interface BenchmarkSnapshot {
  timestamp: string;
  benchmarks: Benchmark[];
  overallScore: number;
  grade: Grade;
}

export interface ToolImpact {
  toolName: string;
  benchmarksAffected: string[];
  estimatedImprovement: number;
  confidence: number;
}

// ─── Default benchmark definitions ───────────────────────────────────────────

function getDefaultBenchmarks(): Benchmark[] {
  return [
    {
      id: "TYPE_SAFETY",
      name: "TypeScript Compilation",
      category: "Quality",
      currentScore: 0,
      targetScore: 95,
      weight: 0.8,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Sequential-Thinking-MCP"],
    },
    {
      id: "BUNDLE_SIZE",
      name: "Bundle Health",
      category: "Performance",
      currentScore: 0,
      targetScore: 100,
      weight: 0.7,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Knip"],
    },
    {
      id: "DEPS_AUDIT",
      name: "Unused Dependencies",
      category: "Maintenance",
      currentScore: 0,
      targetScore: 100,
      weight: 0.7,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Knip"],
    },
    {
      id: "SECURITY",
      name: "Security Vulnerabilities",
      category: "Security",
      currentScore: 0,
      targetScore: 100,
      weight: 1.0,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Trivy", "Semgrep", "Gitleaks"],
    },
    {
      id: "LINT_SCORE",
      name: "Lint Errors",
      category: "Quality",
      currentScore: 0,
      targetScore: 100,
      weight: 0.8,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Biome", "Biome static analysis"],
    },
    {
      id: "TEST_COVERAGE",
      name: "E2E Pass Rate",
      category: "Testing",
      currentScore: 0,
      targetScore: 100,
      weight: 0.9,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["E2E Playwright"],
    },
    {
      id: "ACCESSIBILITY",
      name: "A11y Score",
      category: "Quality",
      currentScore: 0,
      targetScore: 90,
      weight: 0.6,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: [],
    },
    {
      id: "PERF_SCORE",
      name: "Build & Bundle Performance",
      category: "Performance",
      currentScore: 0,
      targetScore: 90,
      weight: 0.7,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Biome", "Sequential-Thinking-MCP"],
    },
    {
      id: "STRUCTURE",
      name: "Project Structure",
      category: "Architecture",
      currentScore: 0,
      targetScore: 100,
      weight: 0.6,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: [],
    },
    {
      id: "TOKEN_EFFICIENCY",
      name: "Token Efficiency",
      category: "Optimization",
      currentScore: 0,
      targetScore: 80,
      weight: 0.5,
      trend: "stable",
      previousScore: 0,
      lastUpdated: new Date().toISOString(),
      affectedBy: ["Graphify", "TOON"],
    },
  ];
}

// ─── Tool impact registry ───────────────────────────────────────────────────

function getDefaultToolImpacts(): ToolImpact[] {
  return [
    { toolName: "Biome", benchmarksAffected: ["LINT_SCORE", "PERF_SCORE"], estimatedImprovement: 80, confidence: 0.9 },
    { toolName: "Trivy", benchmarksAffected: ["SECURITY"], estimatedImprovement: 60, confidence: 0.85 },
    { toolName: "Semgrep", benchmarksAffected: ["SECURITY"], estimatedImprovement: 30, confidence: 0.75 },
    { toolName: "Gitleaks", benchmarksAffected: ["SECURITY"], estimatedImprovement: 20, confidence: 0.8 },
    { toolName: "Knip", benchmarksAffected: ["DEPS_AUDIT", "BUNDLE_SIZE"], estimatedImprovement: 60, confidence: 0.85 },
    { toolName: "Graphify", benchmarksAffected: ["TOKEN_EFFICIENCY"], estimatedImprovement: 70, confidence: 0.8 },
    { toolName: "TOON", benchmarksAffected: ["TOKEN_EFFICIENCY"], estimatedImprovement: 40, confidence: 0.75 },
    { toolName: "Biome static analysis", benchmarksAffected: ["LINT_SCORE"], estimatedImprovement: 30, confidence: 0.85 },
    { toolName: "E2E Playwright", benchmarksAffected: ["TEST_COVERAGE"], estimatedImprovement: 50, confidence: 0.9 },
    { toolName: "Sequential-Thinking-MCP", benchmarksAffected: ["TYPE_SAFETY", "PERF_SCORE"], estimatedImprovement: 15, confidence: 0.7 },
  ];
}

// ─── Persistence helpers ────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadBenchmarks(): Benchmark[] {
  ensureDir();
  if (!existsSync(BENCHMARKS_FILE)) {
    const defaults = getDefaultBenchmarks();
    saveBenchmarks(defaults);
    return defaults;
  }
  try {
    return JSON.parse(readFileSync(BENCHMARKS_FILE, "utf-8"));
  } catch {
    return getDefaultBenchmarks();
  }
}

function saveBenchmarks(benchmarks: Benchmark[]) {
  ensureDir();
  writeFileSync(BENCHMARKS_FILE, JSON.stringify(benchmarks, null, 2), "utf-8");
}

function loadSnapshots(): BenchmarkSnapshot[] {
  ensureDir();
  if (!existsSync(SNAPSHOTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(SNAPSHOTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: BenchmarkSnapshot[]) {
  ensureDir();
  writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2), "utf-8");
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function calculateOverallScore(benchmarks: Benchmark[]): number {
  if (benchmarks.length === 0) return 0;
  const totalWeight = benchmarks.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = benchmarks.reduce((sum, b) => {
    const normalized = b.targetScore > 0 ? Math.min(b.currentScore / b.targetScore, 1) : 0;
    return sum + normalized * b.weight;
  }, 0);
  return Math.round((weightedSum / totalWeight) * 100);
}

function deriveGrade(overallScore: number): Grade {
  if (overallScore >= 95) return "S";
  if (overallScore >= 85) return "A";
  if (overallScore >= 70) return "B";
  if (overallScore >= 55) return "C";
  if (overallScore >= 40) return "D";
  return "F";
}

function deriveTrend(current: number, previous: number): Trend {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "stable";
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getAllBenchmarks(): Benchmark[] {
  return loadBenchmarks();
}

export function updateBenchmark(id: string, score: number): BenchmarkSnapshot {
  const benchmarks = loadBenchmarks();
  const idx = benchmarks.findIndex((b) => b.id === id);
  if (idx === -1) return getBenchmarkSnapshot();

  const previousGrade = getCurrentGrade();
  const now = new Date().toISOString();

  benchmarks[idx] = {
    ...benchmarks[idx],
    previousScore: benchmarks[idx].currentScore,
    currentScore: Math.max(0, Math.min(score, benchmarks[idx].targetScore)),
    trend: deriveTrend(score, benchmarks[idx].currentScore),
    lastUpdated: now,
  };

  saveBenchmarks(benchmarks);

  const snapshot = captureSnapshot(benchmarks);

  applyBenchmarkToGamification(previousGrade, snapshot.grade);

  return snapshot;
}

function getCurrentGrade(): Grade {
  const benchmarks = loadBenchmarks();
  return deriveGrade(calculateOverallScore(benchmarks));
}

export function getBenchmarkSnapshot(): BenchmarkSnapshot {
  const benchmarks = loadBenchmarks();
  return captureSnapshot(benchmarks);
}

function captureSnapshot(benchmarks: Benchmark[]): BenchmarkSnapshot {
  const overallScore = calculateOverallScore(benchmarks);
  const grade = deriveGrade(overallScore);
  const snapshot: BenchmarkSnapshot = {
    timestamp: new Date().toISOString(),
    benchmarks: benchmarks.map((b) => ({ ...b })),
    overallScore,
    grade,
  };

  const snapshots = loadSnapshots();
  const last = snapshots[snapshots.length - 1];
  if (!last || last.overallScore !== overallScore || last.grade !== grade) {
    snapshots.push(snapshot);
    if (snapshots.length > 100) snapshots.shift();
    saveSnapshots(snapshots);
  }

  return snapshot;
}

export function getToolImpact(toolName: string): ToolImpact | null {
  const impacts = getDefaultToolImpacts();
  return impacts.find((t) => t.toolName === toolName) ?? null;
}

export function getImprovementHistory(): BenchmarkSnapshot[] {
  return loadSnapshots();
}

export function suggestNextImprovement(): {
  benchmark: Benchmark;
  potentialGradeBoost: string;
  toolsToApply: string[];
} | null {
  const benchmarks = loadBenchmarks();
  const currentGrade = deriveGrade(calculateOverallScore(benchmarks));

  let bestCandidate: Benchmark | null = null;
  let bestImprovement = -Infinity;

  for (const b of benchmarks) {
    if (b.currentScore >= b.targetScore) continue;
    const gap = b.targetScore - b.currentScore;
    const weightedGap = (gap / b.targetScore) * b.weight;
    if (weightedGap > bestImprovement) {
      bestImprovement = weightedGap;
      bestCandidate = b;
    }
  }

  if (!bestCandidate) return null;

  const improvedBenchmarks = benchmarks.map((b) =>
    b.id === bestCandidate!.id ? { ...b, currentScore: b.targetScore } : b
  );
  const newGrade = deriveGrade(calculateOverallScore(improvedBenchmarks));

  const gradeBoost =
    newGrade !== currentGrade
      ? `${currentGrade} → ${newGrade}`
      : `Stay at ${currentGrade} (score increase)`;

  return {
    benchmark: bestCandidate,
    potentialGradeBoost: gradeBoost,
    toolsToApply: bestCandidate.affectedBy,
  };
}

export function applyBenchmarkToGamification(
  previousGrade?: Grade,
  currentGrade?: Grade,
): { xpAwarded: number; achievedGrade?: Grade } {
  const grade = currentGrade ?? getCurrentGrade();

  if (!previousGrade) {
    const snapshots = loadSnapshots();
    previousGrade = snapshots.length >= 2
      ? snapshots[snapshots.length - 2].grade
      : "F";
  }

  const gradeHierarchy: Grade[] = ["F", "D", "C", "B", "A", "S"];
  const prevIdx = gradeHierarchy.indexOf(previousGrade);
  const currIdx = gradeHierarchy.indexOf(grade);

  if (currIdx <= prevIdx) return { xpAwarded: 0 };

  const gradeXpMap: Record<Grade, number> = {
    F: 0,
    D: 0,
    C: 0,
    B: 500,
    A: 1000,
    S: 2500,
  };

  const unlockSequence: Grade[] = ["B", "A", "S"];
  let xpAwarded = 0;
  let achievedGrade: Grade | undefined;

  for (const g of unlockSequence) {
    const gIdx = gradeHierarchy.indexOf(g);
    if (gIdx > prevIdx && gIdx <= currIdx) {
      xpAwarded += gradeXpMap[g];
      achievedGrade = g;
    }
  }

  if (xpAwarded > 0) {
    awardXp(xpAwarded, `Benchmark grade reached: ${achievedGrade}`);
  }

  return { xpAwarded, achievedGrade };
}

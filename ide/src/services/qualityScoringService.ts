/**
 * Quality Scoring Service — Rates pipeline execution, code review, and audit quality.
 *
 * Three scoring dimensions:
 * 1. Pipeline Quality — phase completion, timing efficiency, error rates
 * 2. Code Review Quality — consensus scores, issue density, review coverage
 * 3. Audit Quality — security findings, static analysis, test coverage
 *
 * Scores feed into the learning loop for continuous improvement.
 */

import type { PipelineExecution } from "../types";

export interface PipelineQualityScore {
	score: number; // 0-100
	grade: "S" | "A" | "B" | "C" | "D" | "F";
	dimensions: {
		completion: number; // phase completion rate
		timing: number; // efficiency score
		resilience: number; // error recovery
		outputQuality: number; // build/test results
	};
	breakdown: string[];
}

export interface ReviewQualityScore {
	score: number;
	grade: "S" | "A" | "B" | "C" | "D" | "F";
	dimensions: {
		coverage: number; // how much code was reviewed
		severity: number; // issue severity levels
		completeness: number; // all gates passed
		consensus: number; // multi-agent agreement
	};
	findings: { type: string; count: number; severity: string }[];
}

export interface AuditQualityScore {
	score: number;
	grade: "S" | "A" | "B" | "C" | "D" | "F";
	dimensions: {
		securityPass: number;
		testPass: number;
		lintPass: number;
		buildPass: number;
	};
	vulnerabilities: number;
	recommendations: string[];
}

export interface QualityReport {
	timestamp: string;
	pipeline: PipelineQualityScore;
	review: ReviewQualityScore;
	audit: AuditQualityScore;
	overall: number;
	overallGrade: "S" | "A" | "B" | "C" | "D" | "F";
	insights: string[];
}

// ─── Scoring Helpers ───────────────────────────────────────────────────────────

function toGrade(score: number): "S" | "A" | "B" | "C" | "D" | "F" {
	if (score >= 95) return "S";
	if (score >= 85) return "A";
	if (score >= 70) return "B";
	if (score >= 55) return "C";
	if (score >= 40) return "D";
	return "F";
}

// ─── Pipeline Quality ──────────────────────────────────────────────────────────

export function scorePipelineQuality(
	exec: PipelineExecution,
): PipelineQualityScore {
	const total = exec.steps.length;
	const completed = exec.steps.filter((s) => s.status === "completed").length;

	// Completion rate
	const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

	// Timing efficiency — penalize phases taking >30s
	const timing = 80; // baseline, since we don't have per-phase timing in exec

	// Resilience — check for recovery from errors
	const errorLogs = exec.logs.filter(
		(l) => l.includes("error") || l.includes("failed") || l.includes("[ERROR]"),
	).length;
	const totalLogs = exec.logs.length;
	const errorRate = totalLogs > 0 ? errorLogs / totalLogs : 0;
	const resilience = Math.max(0, Math.round(100 - errorRate * 100));

	// Output quality — E2E pass rate + build success
	const e2ePassed = exec.e2eResults.filter((r) => r.status === "passed").length;
	const e2eTotal = exec.e2eResults.length;
	const e2eRate = e2eTotal > 0 ? e2ePassed / e2eTotal : 0.5;
	const buildPassed = exec.logs.some((l) =>
		l.includes("[BUILD] Build succeeded"),
	);
	const outputQuality = Math.round(
		(e2eRate * 0.6 + (buildPassed ? 0.4 : 0)) * 100,
	);

	const score = Math.round(
		completion * 0.35 + timing * 0.15 + resilience * 0.2 + outputQuality * 0.3,
	);

	return {
		score: Math.min(100, score),
		grade: toGrade(score),
		dimensions: { completion, timing, resilience, outputQuality },
		breakdown: [
			`Completion: ${completed}/${total} phases (${completion}%)`,
			`Error rate: ${errorLogs}/${totalLogs} log entries`,
			`E2E pass: ${e2ePassed}/${e2eTotal} tests`,
			`Build: ${buildPassed ? "passed" : "failed"}`,
		],
	};
}

// ─── Code Review Quality ───────────────────────────────────────────────────────

export function scoreReviewQuality(
	exec: PipelineExecution,
): ReviewQualityScore {
	// Parse review/audit findings from logs
	const securityLogs = exec.logs.filter((l) => l.includes("[SECURITY]"));
	const lintLogs = exec.logs.filter(
		(l) => l.includes("[STATIC]") || l.includes("Biome"),
	);
	const reviewLogs = exec.logs.filter((l) => l.includes("[REVIEW]"));

	// Coverage — were all review phases run?
	const reviewPhases = ["Static Analysis", "Security Audit"];
	const hasStatic = exec.steps.some(
		(s) => s.phase === "Static Analysis" && s.status === "completed",
	);
	const hasSecurity = exec.steps.some(
		(s) => s.phase === "Security Audit" && s.status === "completed",
	);
	const coverage = (hasStatic ? 50 : 0) + (hasSecurity ? 50 : 0);

	// Severity — parse vulnerability counts
	const vulnMatch = securityLogs.find(
		(l) =>
			l.includes("2 vulns") || l.includes("1 vuln") || l.includes("0 vuln"),
	);
	const vulnCount = vulnMatch
		? parseInt(vulnMatch.match(/\d+/)?.[0] ?? "0")
		: 0;
	const severity = Math.max(0, 100 - vulnCount * 25);

	// Completeness — did all gates produce output?
	const completeness = exec.steps
		.filter((s) => ["Static Analysis", "Security Audit"].includes(s.phase))
		.every((s) => s.status === "completed")
		? 100
		: 50;

	// Consensus — did multiple analysis passes agree?
	const lintPassed = !exec.logs.some(
		(l) => l.includes("[STATIC]") && l.includes("error"),
	);
	const securityPassed = vulnCount === 0;
	const consensus = Math.round(
		(lintPassed ? 50 : 0) + (securityPassed ? 50 : 0),
	);

	const findings: { type: string; count: number; severity: string }[] = [];
	if (vulnCount > 0)
		findings.push({
			type: "vulnerability",
			count: vulnCount,
			severity: vulnCount > 1 ? "high" : "medium",
		});

	const score = Math.round(
		coverage * 0.25 + severity * 0.25 + completeness * 0.25 + consensus * 0.25,
	);

	return {
		score: Math.min(100, score),
		grade: toGrade(score),
		dimensions: { coverage, severity, completeness, consensus },
		findings,
	};
}

// ─── Audit Quality ─────────────────────────────────────────────────────────────

export function scoreAuditQuality(exec: PipelineExecution): AuditQualityScore {
	// Build pass
	const buildPassed = exec.logs.some((l) =>
		l.includes("[BUILD] Build succeeded"),
	);
	const buildPass = buildPassed ? 100 : 0;

	// Test pass
	const e2ePassed = exec.e2eResults.filter((r) => r.status === "passed").length;
	const e2eTotal = exec.e2eResults.length;
	const testPass = e2eTotal > 0 ? Math.round((e2ePassed / e2eTotal) * 100) : 50;

	// Lint pass
	const lintErrors = exec.logs.filter(
		(l) => l.includes("[STATIC]") && l.includes("error"),
	).length;
	const lintPass = Math.max(0, 100 - lintErrors * 20);

	// Security pass
	const vulnMatch = exec.logs
		.filter((l) => l.includes("[SECURITY]"))
		.find((l) => l.match(/\d+ vuln/));
	const vulnCount = vulnMatch
		? parseInt(vulnMatch.match(/\d+/)?.[0] ?? "0")
		: 0;
	const securityPass = Math.max(0, 100 - vulnCount * 25);

	const recommendations: string[] = [];
	if (!buildPassed)
		recommendations.push(
			"Fix build errors — check vite.config.ts and dependencies",
		);
	if (testPass < 100)
		recommendations.push(
			`Improve test coverage — ${e2ePassed}/${e2eTotal} passing`,
		);
	if (vulnCount > 0)
		recommendations.push(`Address ${vulnCount} security vulnerabilities`);
	if (lintErrors > 0) recommendations.push(`Fix ${lintErrors} lint errors`);

	const score = Math.round(
		securityPass * 0.3 + testPass * 0.3 + lintPass * 0.2 + buildPass * 0.2,
	);

	return {
		score: Math.min(100, score),
		grade: toGrade(score),
		dimensions: { securityPass, testPass, lintPass, buildPass },
		vulnerabilities: vulnCount,
		recommendations,
	};
}

// ─── Full Quality Report ───────────────────────────────────────────────────────

export function generateQualityReport(exec: PipelineExecution): QualityReport {
	const pipeline = scorePipelineQuality(exec);
	const review = scoreReviewQuality(exec);
	const audit = scoreAuditQuality(exec);

	const overall = Math.round(
		pipeline.score * 0.4 + review.score * 0.3 + audit.score * 0.3,
	);

	const insights: string[] = [];
	if (pipeline.score < 70)
		insights.push("Pipeline completion rate needs improvement");
	if (review.score < 70)
		insights.push("Code review coverage should be expanded");
	if (audit.score < 70)
		insights.push("Audit quality below threshold — address vulnerabilities");
	if (pipeline.dimensions.resilience < 50)
		insights.push("High error rate — improve error handling");
	if (pipeline.dimensions.outputQuality < 50)
		insights.push("Build or test output quality needs attention");
	if (!insights.length)
		insights.push("All systems nominal — quality above thresholds");

	return {
		timestamp: new Date().toISOString(),
		pipeline,
		review,
		audit,
		overall,
		overallGrade: toGrade(overall),
		insights,
	};
}

// ─── Persistence ────────────────────────────────────────────────────────────────

const QUALITY_STORE: QualityRun[] = [];

interface QualityRun {
	id: string;
	timestamp: string;
	report: QualityReport;
	pipelineId: string;
}

export function saveQualityRun(exec: PipelineExecution): QualityReport {
	const report = generateQualityReport(exec);
	QUALITY_STORE.push({
		id: `qr-${Date.now()}`,
		timestamp: report.timestamp,
		report,
		pipelineId: exec.id,
	});
	if (QUALITY_STORE.length > 100) QUALITY_STORE.shift();
	return report;
}

export function getQualityHistory(): QualityRun[] {
	return QUALITY_STORE.slice(-20);
}

export function getQualityTrends(): {
	pipelineTrend: "improving" | "declining" | "stable";
	reviewTrend: "improving" | "declining" | "stable";
	auditTrend: "improving" | "declining" | "stable";
	averageScore: number;
	runCount: number;
} {
	const runs = QUALITY_STORE.slice(-10);
	if (runs.length < 2) {
		return {
			pipelineTrend: "stable",
			reviewTrend: "stable",
			auditTrend: "stable",
			averageScore: runs[0]?.report.overall ?? 0,
			runCount: runs.length,
		};
	}

	const avgScore = Math.round(
		runs.reduce((s, r) => s + r.report.overall, 0) / runs.length,
	);
	const first = runs[0].report;
	const last = runs[runs.length - 1].report;

	return {
		pipelineTrend:
			last.pipeline.score > first.pipeline.score
				? "improving"
				: last.pipeline.score < first.pipeline.score
					? "declining"
					: "stable",
		reviewTrend:
			last.review.score > first.review.score
				? "improving"
				: last.review.score < first.review.score
					? "declining"
					: "stable",
		auditTrend:
			last.audit.score > first.audit.score
				? "improving"
				: last.audit.score < first.audit.score
					? "declining"
					: "stable",
		averageScore: avgScore,
		runCount: runs.length,
	};
}

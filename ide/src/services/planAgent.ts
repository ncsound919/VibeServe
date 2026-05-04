/**
 * PlanAgent — Read-only analysis agent that runs BEFORE the build agent.
 * Modeled on OpenCode's Plan agent (edit/deny, bash/deny) and Claude Code's Plan mode.
 *
 * The PlanAgent:
 * 1. Analyzes the task scope and source repos
 * 2. Creates a structured execution plan with phases, dependencies, and risks
 * 3. Generates a spec document that gets validated
 * 4. Requires approval before the build pipeline proceeds
 */

import { callGeminiProxy } from "./apiClient";
import { logger } from "../lib/logger";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus", "plans");

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  estimatedDuration: string;
  risks: string[];
  expectedOutput: string;
  validationCriteria: string;
}

export interface PipelinePlan {
  id: string;
  title: string;
  description: string;
  sourceRepos: string[];
  phases: PlanPhase[];
  overallRisk: "low" | "medium" | "high";
  estimatedTotalDuration: string;
  recommendations: string[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  specVersion: string;
}

export interface PlanAnalysisResult {
  plan: PipelinePlan;
  summary: string;
  warnings: string[];
  confidence: number;
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getPlanPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

// ─── Plan Generation ────────────────────────────────────────────────────

export async function generatePlan(
  sourceRepos: string[],
  taskDescription?: string
): Promise<PlanAnalysisResult> {
  ensureDir();
  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const prompt = `You are a build pipeline planner. Create a structured execution plan for the following task:

SOURCE REPOS: ${sourceRepos.join(", ")}
${taskDescription ? `TASK: ${taskDescription}` : ""}

Analyze what phases are needed and respond with JSON:
{
  "title": "plan title",
  "description": "what this plan achieves",
  "phases": [
    {
      "id": "1",
      "name": "Phase Name",
      "description": "what happens",
      "dependencies": ["phase ids this depends on"],
      "estimatedDuration": "Xs or Xm",
      "risks": ["potential issues"],
      "expectedOutput": "what this produces",
      "validationCriteria": "how to verify success"
    }
  ],
  "overallRisk": "low|medium|high",
  "estimatedTotalDuration": "Xm",
  "recommendations": ["best practices", "optimizations"],
  "warnings": ["potential pitfalls to avoid"],
  "summary": "1-2 sentence plan overview"
}`;

    const response = await callGeminiProxy(prompt, "gemini-2.0-flash");

    let parsed: Record<string, unknown> = {};
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      const lines = response.split("\n").filter(Boolean);
      parsed = { title: lines[0]?.replace(/^[#*]+\s*/, "") || "Pipeline Plan", description: lines[1] || "", phases: [] };
    }

    const phases: PlanPhase[] = Array.isArray(parsed.phases)
      ? parsed.phases.map((p: Record<string, unknown>, i: number) => ({
          id: String(p.id || i + 1),
          name: String(p.name || `Phase ${i + 1}`),
          description: String(p.description || ""),
          dependencies: Array.isArray(p.dependencies) ? p.dependencies.map(String) : [],
          estimatedDuration: String(p.estimatedDuration || "30s"),
          risks: Array.isArray(p.risks) ? p.risks.map(String) : [],
          expectedOutput: String(p.expectedOutput || ""),
          validationCriteria: String(p.validationCriteria || ""),
        }))
      : [];

    const plan: PipelinePlan = {
      id: planId,
      title: String(parsed.title || "Generated Pipeline Plan"),
      description: String(parsed.description || `Plan for ${sourceRepos.join(", ")}`),
      sourceRepos,
      phases: phases.length > 0 ? phases : getDefaultPhases(sourceRepos),
      overallRisk: (parsed.overallRisk as PipelinePlan["overallRisk"]) || "medium",
      estimatedTotalDuration: String(parsed.estimatedTotalDuration || "5m"),
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
      approved: false,
      createdAt: new Date().toISOString(),
      specVersion: "1.0.0",
    };

    writeFileSync(getPlanPath(planId), JSON.stringify(plan, null, 2), "utf-8");
    logger.info("PlanAgent", `Plan generated: ${plan.title} (${plan.phases.length} phases)`);

    return {
      plan,
      summary: String(parsed.summary || `Plan: ${plan.title}`),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      confidence: phases.length > 0 ? 0.8 : 0.4,
    };
  } catch (err) {
    logger.warn("PlanAgent", `Plan generation failed: ${err instanceof Error ? err.message : String(err)}, using default`);

    const plan: PipelinePlan = {
      id: planId,
      title: `Pipeline Plan: ${sourceRepos.join(", ")}`,
      description: "Default plan for standard pipeline execution",
      sourceRepos,
      phases: getDefaultPhases(sourceRepos),
      overallRisk: "medium",
      estimatedTotalDuration: "5m",
      recommendations: ["Run lint before build", "Verify dependencies", "Run E2E tests"],
      approved: false,
      createdAt: new Date().toISOString(),
      specVersion: "1.0.0",
    };

    writeFileSync(getPlanPath(planId), JSON.stringify(plan, null, 2), "utf-8");

    return {
      plan,
      summary: "Default plan (AI planning unavailable)",
      warnings: ["AI-generated plan unavailable — using standard phase template"],
      confidence: 0.3,
    };
  }
}

function getDefaultPhases(sourceRepos: string[]): PlanPhase[] {
  const phases: PlanPhase[] = [
    {
      id: "1", name: "Environment Setup", description: "Initialize build environment and verify prerequisites",
      dependencies: [], estimatedDuration: "30s",
      risks: ["Node.js version mismatch", "Missing environment variables"],
      expectedOutput: "Ready build environment", validationCriteria: "All env vars present, Node.js v20+",
    },
    {
      id: "2", name: "Dependency Resolution", description: "Install and verify all project dependencies",
      dependencies: ["1"], estimatedDuration: "1m",
      risks: ["Network timeout", "Incompatible peer deps", "Package integrity failure"],
      expectedOutput: "Installed node_modules with verified integrity", validationCriteria: "npm ci success, no audit issues",
    },
    {
      id: "3", name: "Static Analysis", description: "Run TypeScript type checking and lint rules",
      dependencies: ["2"], estimatedDuration: "30s",
      risks: ["Type errors in source code", "Unused variables"],
      expectedOutput: "Type-checked and linted codebase", validationCriteria: "tsc --noEmit passes, biome reports clean",
    },
    {
      id: "4", name: "Build & Compile", description: "Bundle the application for production",
      dependencies: ["3"], estimatedDuration: "1m",
      risks: ["Bundle size exceeds threshold", "Chunk splitting issues"],
      expectedOutput: "Optimized production bundle in dist/", validationCriteria: "vite build succeeds, bundle < 2MB",
    },
    {
      id: "5", name: "Security Audit", description: "Scan for vulnerabilities and secrets",
      dependencies: ["4"], estimatedDuration: "1m",
      risks: ["High-severity CVE in dependency", "Leaked secrets in source"],
      expectedOutput: "Security audit report", validationCriteria: "0 critical/high vulnerabilities",
    },
    {
      id: "6", name: "E2E Testing", description: "Run end-to-end tests with Playwright",
      dependencies: ["4"], estimatedDuration: "2m",
      risks: ["Flaky tests", "Browser compatibility issues"],
      expectedOutput: "Test report with pass/fail", validationCriteria: "All critical tests pass",
    },
    {
      id: "7", name: "Finalizing", description: "Generate reports and sync artifacts",
      dependencies: ["5", "6"], estimatedDuration: "30s",
      risks: ["Artifact upload failure"],
      expectedOutput: "Complete pipeline report", validationCriteria: "All artifacts synced",
    },
  ];
  return phases;
}

// ─── Plan Management ────────────────────────────────────────────────────

export function getPlan(planId: string): PipelinePlan | null {
  const planPath = getPlanPath(planId);
  if (!existsSync(planPath)) return null;
  try { return JSON.parse(readFileSync(planPath, "utf-8")); }
  catch { return null; }
}

export function approvePlan(planId: string, approvedBy?: string): PipelinePlan | null {
  const plan = getPlan(planId);
  if (!plan) return null;
  plan.approved = true;
  plan.approvedBy = approvedBy || "system";
  plan.approvedAt = new Date().toISOString();
  writeFileSync(getPlanPath(planId), JSON.stringify(plan, null, 2), "utf-8");
  logger.info("PlanAgent", `Plan approved: ${plan.title}`);
  return plan;
}

export function rejectPlan(planId: string, reason?: string): PipelinePlan | null {
  const plan = getPlan(planId);
  if (!plan) return null;
  plan.approved = false;
  writeFileSync(getPlanPath(planId), JSON.stringify(plan, null, 2), "utf-8");
  logger.info("PlanAgent", `Plan rejected: ${plan.title}${reason ? ` — ${reason}` : ""}`);
  return plan;
}

export function listPlans(): PipelinePlan[] {
  ensureDir();
  const { readdirSync } = require("fs");
  const files = readdirSync(DATA_DIR).filter((f: string) => f.endsWith(".json"));
  return files
    .map((f: string) => {
      try { return JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf-8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a: PipelinePlan, b: PipelinePlan) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function validatePlan(plan: PipelinePlan): Promise<{
  valid: boolean;
  issues: string[];
  score: number;
}> {
  const issues: string[] = [];

  if (!plan.title) issues.push("Plan has no title");
  if (plan.phases.length === 0) issues.push("Plan has no phases");
  if (plan.phases.length > 20) issues.push("Too many phases — consider grouping");

  for (const phase of plan.phases) {
    if (!phase.name) issues.push(`Phase ${phase.id} has no name`);
    if (!phase.validationCriteria) issues.push(`Phase "${phase.name}" has no validation criteria`);
    for (const dep of phase.dependencies) {
      if (!plan.phases.some(p => p.id === dep)) {
        issues.push(`Phase "${phase.name}" depends on missing phase "${dep}"`);
      }
    }
  }

  const depIds = new Set<string>();
  const findCycle = (id: string, visited: Set<string> = new Set()): boolean => {
    if (visited.has(id)) return true;
    visited.add(id);
    const phase = plan.phases.find(p => p.id === id);
    if (!phase) return false;
    for (const dep of phase.dependencies) {
      if (findCycle(dep, visited)) return true;
    }
    return false;
  };
  for (const phase of plan.phases) {
    if (findCycle(phase.id)) {
      issues.push(`Dependency cycle detected involving phase "${phase.name}"`);
      break;
    }
  }

  const score = Math.max(0, 100 - issues.length * 10);

  return {
    valid: issues.length === 0,
    issues,
    score,
  };
}

/**
 * Autoresearch Service
 * Karpathy-style autonomous iteration loop.
 * Runs pipeline → evaluates results → suggests improvements → re-runs.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { runAutomatedPipeline } from "./pipelineService";
import type { PipelineExecution } from "../types";
import { ingestRaw, compileAllRaw } from "./llmWikiService";

const LOGBOOK_DIR = path.resolve(process.cwd(), "uploads", "wiki");
const LOG_FILE = path.join(LOGBOOK_DIR, "autoresearch-log.json");

interface IterationRecord {
  iteration: number;
  timestamp: string;
  pipelineId: string;
  status: string;
  e2ePassRate: number;
  totalDuration: number;
  stepsCompleted: number;
  evalScore: number;
  improvement: string;
  sourceRepos: string[];
}

interface AutoresearchState {
  enabled: boolean;
  currentIteration: number;
  maxIterations: number;
  passThreshold: number;
  history: IterationRecord[];
}

function ensureLog(): AutoresearchState {
  if (!existsSync(LOGBOOK_DIR)) mkdirSync(LOGBOOK_DIR, { recursive: true });
  if (!existsSync(LOG_FILE)) {
    const initial: AutoresearchState = {
      enabled: true,
      currentIteration: 0,
      maxIterations: 5,
      passThreshold: 0.8,
      history: [],
    };
    writeFileSync(LOG_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  return JSON.parse(readFileSync(LOG_FILE, "utf-8")) as AutoresearchState;
}

function saveState(state: AutoresearchState) {
  writeFileSync(LOG_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ─── DeepSeek evaluation caller ─────────────────────────────────────────────────

async function evaluateWithDeepSeek(
  iteration: number,
  exec: PipelineExecution
): Promise<{ score: number; improvement: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    // Simulated evaluation when no DeepSeek key
    const passCount = exec.e2eResults.filter((r) => r.status === "passed").length;
    const totalTests = exec.e2eResults.length || 1;
    const score = passCount / totalTests;
    const suggestions = [
      "Add caching layer to E2E test setup",
      "Parallelize test execution across 4 workers",
      "Pre-warm Redis cache before test suite",
    ];
    return {
      score,
      improvement: score >= 0.8
        ? "All systems nominal. Consider adding integration tests for remaining services."
        : suggestions[Math.floor(Math.random() * suggestions.length)],
    };
  }

  const summary = {
    status: exec.status,
    stepsCompleted: exec.steps.filter((s) => s.status === "completed").length,
    totalSteps: exec.steps.length,
    e2eResults: exec.e2eResults.map((r) => ({ name: r.testName, status: r.status })),
    logs: exec.logs.slice(-10),
  };

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are an autonomous research evaluation agent. Given a pipeline execution report, " +
              "score it 0.0-1.0 and suggest ONE specific improvement for the next iteration. " +
              "Respond with JSON only: {\"score\": number, \"improvement\": string}",
          },
          {
            role: "user",
            content: `Evaluate iteration ${iteration}:\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { score: number; improvement: string };
    return { score: Math.max(0, Math.min(1, parsed.score)), improvement: parsed.improvement || "No suggestion" };
  } catch {
    const passCount = exec.e2eResults.filter((r) => r.status === "passed").length;
    const totalTests = exec.e2eResults.length || 1;
    return { score: passCount / totalTests, improvement: "Review E2E test configuration for stability" };
  }
}

// ─── Autonomous loop ──────────────────────────────────────────────────────────────

export async function runAutonomousLoop(
  sourceRepos: string[],
  onIteration: (record: IterationRecord, exec: PipelineExecution) => void,
  maxIterations?: number
): Promise<AutoresearchState> {
  const state = ensureLog();
  state.enabled = true;
  state.maxIterations = maxIterations ?? state.maxIterations;
  saveState(state);

  for (let i = state.currentIteration; i < state.maxIterations; i++) {
    state.currentIteration = i;
    saveState(state);

    // Execute pipeline
    const exec = await runAutomatedPipeline(sourceRepos.join(" + "), () => {});

    // Ingest results into wiki
    const resultMd = [
      `# Pipeline Run ${i + 1}`,
      `**Status:** ${exec.status}`,
      `**Sources:** ${exec.sourceRepos.join(", ")}`,
      `**Steps:** ${exec.steps.filter((s) => s.status === "completed").length}/${exec.steps.length}`,
      "",
      "## E2E Results",
      ...exec.e2eResults.map((r) => `- ${r.testName}: ${r.status} (${r.duration}ms)`),
      "",
      "## Logs",
      ...exec.logs.slice(-15).map((l) => `> ${l}`),
    ].join("\n");
    ingestRaw(`pipeline-iteration-${i + 1}`, resultMd, { iteration: i + 1, status: exec.status });

    // Evaluate
    const { score, improvement } = await evaluateWithDeepSeek(i, exec);

    const passCount = exec.e2eResults.filter((r) => r.status === "passed").length;
    const totalTests = exec.e2eResults.length || 1;
    const record: IterationRecord = {
      iteration: i + 1,
      timestamp: new Date().toISOString(),
      pipelineId: exec.id,
      status: exec.status,
      e2ePassRate: passCount / totalTests,
      totalDuration: exec.duration ?? 0,
      stepsCompleted: exec.steps.filter((s) => s.status === "completed").length,
      evalScore: score,
      improvement,
      sourceRepos: [...exec.sourceRepos],
    };
    state.history.push(record);
    saveState(state);

    onIteration(record, exec);

    // Compile wiki from accumulated raw sources
    if (i === state.maxIterations - 1 || (i > 0 && i % 2 === 1)) {
      await compileAllRaw();
    }

    // Stop if score exceeds threshold
    if (score >= state.passThreshold) {
      state.enabled = false;
      saveState(state);
      break;
    }
  }

  state.enabled = false;
  saveState(state);
  return state;
}

// ─── Status ───────────────────────────────────────────────────────────────────────

export function getAutoresearchStatus(): AutoresearchState {
  return ensureLog();
}

export function resetAutoresearchLog(): void {
  const initial: AutoresearchState = {
    enabled: false,
    currentIteration: 0,
    maxIterations: 5,
    passThreshold: 0.8,
    history: [],
  };
  saveState(initial);
}

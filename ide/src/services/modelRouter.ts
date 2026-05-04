/**
 * ModelRouter — Intelligent provider routing based on task complexity.
 * Modeled on Cursor's multi-model support: route simple tasks to fast/cheap models,
 * complex tasks to powerful models.
 *
 * Supports: Gemini, OpenRouter, DeepSeek, OpenCode with auto-routing.
 */

import { callGeminiProxy } from "./apiClient";
import { ollamaService } from "./ollamaService";
import { usePricingStore } from "./pricingService";
import { logger } from "../lib/logger";

export type Provider = "gemini" | "openrouter" | "deepseek" | "opencode" | "ollama";
export type TaskComplexity = "simple" | "moderate" | "complex" | "critical";

export interface ProviderModel {
  provider: Provider;
  modelId: string;
  complexity: TaskComplexity[];
  contextWindow: number;
  costWeight: number;
  speedWeight: number;
}

export interface RoutingDecision {
  provider: Provider;
  modelId: string;
  reason: string;
  alternatives: string[];
}

// ─── Provider Registry ──────────────────────────────────────────────────

const PROVIDER_REGISTRY: ProviderModel[] = [
  {
    provider: "gemini",
    modelId: "gemini-2.0-flash",
    complexity: ["simple", "moderate"],
    contextWindow: 1_000_000,
    costWeight: 10,
    speedWeight: 10,
  },
  {
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    complexity: ["simple", "moderate", "complex"],
    contextWindow: 1_000_000,
    costWeight: 8,
    speedWeight: 9,
  },
  {
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    complexity: ["complex", "critical"],
    contextWindow: 2_000_000,
    costWeight: 5,
    speedWeight: 6,
  },
  {
    provider: "openrouter",
    modelId: "google/gemini-2.0-flash-001",
    complexity: ["simple", "moderate"],
    contextWindow: 1_000_000,
    costWeight: 9,
    speedWeight: 8,
  },
  {
    provider: "openrouter",
    modelId: "anthropic/claude-sonnet-4",
    complexity: ["moderate", "complex"],
    contextWindow: 200_000,
    costWeight: 6,
    speedWeight: 7,
  },
  {
    provider: "deepseek",
    modelId: "deepseek-chat",
    complexity: ["simple", "moderate", "complex"],
    contextWindow: 128_000,
    costWeight: 9,
    speedWeight: 8,
  },
  {
    provider: "deepseek",
    modelId: "deepseek-reasoner",
    complexity: ["complex", "critical"],
    contextWindow: 128_000,
    costWeight: 5,
    speedWeight: 5,
  },
  {
    provider: "ollama",
    modelId: "llama3.1",
    complexity: ["simple", "moderate"],
    contextWindow: 128_000,
    costWeight: 10,
    speedWeight: 6,
  },
  {
    provider: "ollama",
    modelId: "qwen2.5",
    complexity: ["simple", "moderate"],
    contextWindow: 32_000,
    costWeight: 10,
    speedWeight: 7,
  },
  {
    provider: "ollama",
    modelId: "codellama",
    complexity: ["simple", "moderate"],
    contextWindow: 100_000,
    costWeight: 10,
    speedWeight: 6,
  },
];

// ─── Complexity Classification ──────────────────────────────────────────

export function classifyTaskComplexity(
  task: string,
  context?: { codeSize?: number; fileCount?: number; isSecurity?: boolean; isPlanning?: boolean }
): TaskComplexity {
  const lower = task.toLowerCase();

  if (context?.isSecurity) return "critical";
  if (context?.isPlanning) return "moderate";

  if (
    lower.includes("refactor") ||
    lower.includes("architecture") ||
    lower.includes("migrate") ||
    lower.includes("redesign")
  ) {
    return "complex";
  }

  if (
    lower.includes("security") ||
    lower.includes("vulnerability") ||
    lower.includes("critical") ||
    lower.includes("urgent")
  ) {
    return "critical";
  }

  if (
    lower.includes("analyze") ||
    lower.includes("review") ||
    lower.includes("test") ||
    lower.includes("deploy") ||
    (context?.fileCount && context.fileCount > 5)
  ) {
    return "moderate";
  }

  if (context?.codeSize && context.codeSize > 10000) return "moderate";

  return "simple";
}

// ─── Routing Logic ──────────────────────────────────────────────────────

export function routeTask(
  task: string,
  preferredProvider?: Provider,
  context?: { codeSize?: number; fileCount?: number; isSecurity?: boolean; isPlanning?: boolean }
): RoutingDecision {
  const complexity = classifyTaskComplexity(task, context);

  let candidates = PROVIDER_REGISTRY.filter((m) =>
    m.complexity.includes(complexity)
  );

  if (preferredProvider) {
    const pref = candidates.filter((m) => m.provider === preferredProvider);
    if (pref.length > 0) candidates = pref;
  }

  // Score: balance cost and speed
  candidates.sort((a, b) => {
    const scoreA = a.costWeight * 0.4 + a.speedWeight * 0.6;
    const scoreB = b.costWeight * 0.4 + b.speedWeight * 0.6;
    return scoreB - scoreA;
  });

  const chosen = candidates[0] || PROVIDER_REGISTRY[0];
  const alternatives = candidates.slice(1, 3).map((c) => `${c.provider}/${c.modelId}`);

  const decision: RoutingDecision = {
    provider: chosen.provider,
    modelId: chosen.modelId,
    reason: `Complexity=${complexity}, Provider=${chosen.provider}, Model=${chosen.modelId}`,
    alternatives,
  };

  logger.info("ModelRouter", `Routed "${task.substring(0, 50)}..." → ${decision.provider}/${decision.modelId} (${complexity})`);
  return decision;
}

export async function executeWithRouting(
  prompt: string,
  taskType: string,
  context?: { codeSize?: number; fileCount?: number; isSecurity?: boolean; isPlanning?: boolean }
): Promise<string> {
  const decision = routeTask(taskType, undefined, context);

  if (decision.provider === 'ollama') {
    try {
      return await ollamaService.generate({
        model: decision.modelId,
        prompt: prompt,
      });
    } catch (error) {
      logger.warn("ModelRouter", `Ollama failed, falling back to Gemini: ${error}`);
      return callGeminiProxy(prompt, "gemini-2.0-flash");
    }
  }

  // Fallback to Gemini proxy
  const result = await callGeminiProxy(prompt, decision.modelId);

  // Track usage
  try {
    usePricingStore.getState().trackUsage({
      tokens: prompt.length / 4 + result.length / 4, // Simple estimation
      model: decision.modelId,
      provider: decision.provider,
      complexity: classifyTaskComplexity(taskType, context),
    });
  } catch (e) { /* ignore */ }

  return result;
}

export function getAvailableModels(): ProviderModel[] {
  return PROVIDER_REGISTRY;
}

export function getModelsForComplexity(complexity: TaskComplexity): ProviderModel[] {
  return PROVIDER_REGISTRY.filter((m) => m.complexity.includes(complexity));
}

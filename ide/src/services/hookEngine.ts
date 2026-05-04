/**
 * HookEngine — Lifecycle hook system for pipeline phase interception
 * Modeled on Claude Code's PreToolUse / PostToolUse hooks with allow/block/warn semantics.
 *
 * Hooks intercept phase execution at three points:
 *   pre     — runs BEFORE the phase (validate deps, check disk space, lint pre-check)
 *   post    — runs AFTER the phase (verify output, run tests, lint post-check)
 *   on_error — runs on phase failure (log, notify, trigger auto-fix)
 *
 * Each hook returns { passed, blocked, warnings }.
 * A blocked hook halts the pipeline immediately.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";
import type { HookConfig, HookResult } from "../types/hooks";
import { safeExecLegacy } from "../lib/safeShell";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const HOOKS_FILE = path.join(DATA_DIR, "hooks.json");

function ensureDir(): void {
  const { existsSync: e, mkdirSync: m } = require("fs");
  if (!e(DATA_DIR)) m(DATA_DIR, { recursive: true });
}

function loadHooks(): HookConfig[] {
  ensureDir();
  if (!existsSync(HOOKS_FILE)) return getDefaultHooks();
  try {
    return JSON.parse(readFileSync(HOOKS_FILE, "utf-8"));
  } catch {
    return getDefaultHooks();
  }
}

function saveHooks(hooks: HookConfig[]): void {
  ensureDir();
  const { writeFileSync: w } = require("fs");
  w(HOOKS_FILE, JSON.stringify(hooks, null, 2), "utf-8");
}

function getDefaultHooks(): HookConfig[] {
  return [
    {
      id: "pre-lint-check",
      name: "Pre-Phase Lint Check",
      phase: "pre",
      pipelinePhase: "*",
      action: "warn",
      condition: "tsc --noEmit --pretty false 2>&1 | head -20",
      enabled: true,
    },
    {
      id: "post-test-verify",
      name: "Post-Build Test Verification",
      phase: "post",
      pipelinePhase: "Build & Compile",
      action: "block",
      condition: "npx playwright test --reporter=line 2>&1 | tail -5",
      enabled: true,
    },
    {
      id: "post-security-check",
      name: "Post-Security Dependency Audit",
      phase: "post",
      pipelinePhase: "Security Audit",
      action: "warn",
      condition: "npm audit --audit-level=high 2>&1",
      enabled: true,
    },
    {
      id: "pre-deps-verify",
      name: "Pre-Dependency Package Lock Check",
      phase: "pre",
      pipelinePhase: "Dependency Resolution",
      action: "block",
      condition: "test -f package-lock.json || test -f yarn.lock || test -f pnpm-lock.yaml",
      enabled: true,
    },
    {
      id: "error-notify-discord",
      name: "Error Notification",
      phase: "on_error",
      pipelinePhase: "*",
      action: "warn",
      enabled: true,
    },
    {
      id: "post-bundle-size",
      name: "Post-Build Bundle Size Gate",
      phase: "post",
      pipelinePhase: "Build & Compile",
      action: "warn",
      condition: "du -sh dist/ 2>/dev/null | awk '{print $1}'",
      enabled: true,
    },
  ];
}

// ─── Regex-based condition matching ──────────────────────────────────────

function matchPhase(hookPhase: string, currentPhase: string): boolean {
  if (hookPhase === "*") return true;
  const escaped = hookPhase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.split("*").join(".*")}$`, "i");
  return regex.test(currentPhase);
}

// ─── Public API ──────────────────────────────────────────────────────────

export function getHooks(): HookConfig[] {
  return loadHooks();
}

export function getHooksForPhase(
  pipelinePhase: string,
  hookPhase?: "pre" | "post" | "on_error"
): HookConfig[] {
  return loadHooks().filter(
    (h) =>
      h.enabled &&
      matchPhase(h.pipelinePhase, pipelinePhase) &&
      (!hookPhase || h.phase === hookPhase)
  );
}

export function addHook(config: Omit<HookConfig, "id">): HookConfig {
  const hooks = loadHooks();
  const hook: HookConfig = {
    ...config,
    id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  hooks.push(hook);
  saveHooks(hooks);
  logger.info("HookEngine", `Registered hook: ${hook.name} [${hook.phase}:${hook.pipelinePhase}]`);
  return hook;
}

export function updateHook(id: string, updates: Partial<HookConfig>): HookConfig | null {
  const hooks = loadHooks();
  const idx = hooks.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  hooks[idx] = { ...hooks[idx], ...updates };
  saveHooks(hooks);
  return hooks[idx];
}

export function removeHook(id: string): boolean {
  const hooks = loadHooks();
  const filtered = hooks.filter((h) => h.id !== id);
  if (filtered.length === hooks.length) return false;
  saveHooks(filtered);
  return true;
}

export function toggleHook(id: string): HookConfig | null {
  const hooks = loadHooks();
  const idx = hooks.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  hooks[idx].enabled = !hooks[idx].enabled;
  saveHooks(hooks);
  return hooks[idx];
}

// ─── Hook Execution Engine ───────────────────────────────────────────────

export async function executeHook(
  hook: HookConfig,
  pipelinePhase: string,
  context?: Record<string, unknown>
): Promise<HookResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const logs: string[] = [];
  let passed = true;
  let blocked = false;

  logs.push(`[HOOK:${hook.id}] Executing ${hook.name} (${hook.phase})`);

  if (hook.script) {
    logs.push(`[HOOK:${hook.id}] Running script: ${hook.script}`);
    try {
      const output = safeExecLegacy(hook.script, {
        timeout: 30000,
        stdio: "pipe",
      });
      logs.push(`[HOOK:${hook.id}] Script output: ${output.trim().substring(0, 200)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(`[HOOK:${hook.id}] Script failed: ${msg}`);
      warnings.push(`Hook script "${hook.name}" failed: ${msg}`);
      if (hook.action === "block") {
        passed = false;
        blocked = true;
      }
    }
  }

  if (hook.condition) {
    logs.push(`[HOOK:${hook.id}] Evaluating condition: ${hook.condition}`);
    try {
      try {
        safeExecLegacy(hook.condition, {
          timeout: 15000,
          stdio: "pipe",
        });
        logs.push(`[HOOK:${hook.id}] Condition passed`);
      } catch {
        logs.push(`[HOOK:${hook.id}] Condition failed`);
        warnings.push(`Hook condition "${hook.name}" not met`);
        if (hook.action === "block") {
          passed = false;
          blocked = true;
        } else if (hook.action === "warn") {
          warnings.push(`[WARN] Hook ${hook.name}: condition not met for phase "${pipelinePhase}"`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Hook "${hook.name}" condition eval error: ${msg}`);
      logs.push(`[HOOK:${hook.id}] Condition evaluation error: ${msg}`);
    }
  }

  if (blocked) {
    logs.push(`[HOOK:${hook.id}] BLOCKED — pipeline phase halted`);
    logger.warn("HookEngine", `Phase "${pipelinePhase}" blocked by hook "${hook.name}"`);
  }

  return {
    hookId: hook.id,
    hookName: hook.name,
    phase: hook.phase,
    pipelinePhase,
    passed,
    blocked,
    warnings,
    logs,
    durationMs: Date.now() - start,
  };
}

export async function executeHooksForPhase(
  pipelinePhase: string,
  hookPhase: "pre" | "post" | "on_error",
  context?: Record<string, unknown>
): Promise<HookResult[]> {
  const hooks = getHooksForPhase(pipelinePhase, hookPhase);
  const results: HookResult[] = [];

  for (const hook of hooks) {
    const result = await executeHook(hook, pipelinePhase, context);
    results.push(result);
    if (result.blocked) break; // Stop on first block
  }

  return results;
}

export function getHookStats(): {
  total: number;
  enabled: number;
  byPhase: Record<string, number>;
  byPipelinePhase: Record<string, number>;
} {
  const hooks = loadHooks();
  const byPhase: Record<string, number> = { pre: 0, post: 0, on_error: 0 };
  const byPipelinePhase: Record<string, number> = {};

  for (const h of hooks) {
    if (h.enabled) {
      byPhase[h.phase] = (byPhase[h.phase] || 0) + 1;
      byPipelinePhase[h.pipelinePhase] = (byPipelinePhase[h.pipelinePhase] || 0) + 1;
    }
  }

  return {
    total: hooks.length,
    enabled: hooks.filter((h) => h.enabled).length,
    byPhase,
    byPipelinePhase,
  };
}

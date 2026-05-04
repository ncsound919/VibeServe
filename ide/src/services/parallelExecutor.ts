/**
 * ParallelExecutor — Multi-agent parallel dispatch system.
 * Modeled on Claude Code's subagent teams and Windsurf's simultaneous Cascades.
 *
 * Splits independent pipeline phases into parallel work units,
 * dispatches to multiple agents/workers, and merges results.
 */

import { logger } from "../lib/logger";

export interface WorkUnit {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
}

export interface ParallelJob {
  id: string;
  name: string;
  workUnits: WorkUnit[];
  maxParallel: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
}

export interface ParallelExecutorOptions {
  maxParallel?: number;
  timeoutMs?: number;
  onUnitStart?: (unit: WorkUnit) => void;
  onUnitComplete?: (unit: WorkUnit) => void;
  onUnitError?: (unit: WorkUnit, error: Error) => void;
}

// ─── Dependency-aware parallel execution ───────────────────────────────

export async function executeInParallel<T>(
  job: ParallelJob,
  executor: (unit: WorkUnit) => Promise<T>,
  options: ParallelExecutorOptions = {}
): Promise<{
  results: Map<string, T>;
  completed: WorkUnit[];
  failed: WorkUnit[];
}> {
  const {
    maxParallel = 4,
    timeoutMs = 300000,
    onUnitStart,
    onUnitComplete,
    onUnitError,
  } = options;

  const results = new Map<string, T>();
  const completed: WorkUnit[] = [];
  const failed: WorkUnit[] = [];
  const running = new Set<string>();
  let pending = [...job.workUnits];

  job.status = "running";
  job.startedAt = new Date().toISOString();

  logger.info("ParallelExecutor", `Starting parallel job "${job.name}" with ${job.workUnits.length} units (max ${maxParallel} parallel)`);

  while (pending.length > 0 || running.size > 0) {
    const ready = pending.filter((unit) =>
      unit.dependencies.every((depId) => {
        const dep = completed.find((c) => c.id === depId);
        return dep && dep.status === "completed";
      })
    );

    const available = ready.filter((u) => !running.has(u.id));

    for (const unit of available.slice(0, maxParallel - running.size)) {
      running.add(unit.id);
      unit.status = "running";
      unit.startTime = new Date().toISOString();

      if (onUnitStart) onUnitStart(unit);

      const workPromise = (async () => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${unit.name}`)), timeoutMs)
          );

          const result = await Promise.race([executor(unit), timeoutPromise]);
          results.set(unit.id, result);
          unit.result = result;
          unit.status = "completed";
          unit.endTime = new Date().toISOString();
          unit.durationMs = new Date(unit.endTime).getTime() - new Date(unit.startTime!).getTime();
          completed.push(unit);
          if (onUnitComplete) onUnitComplete(unit);
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          unit.status = "failed";
          unit.error = error.message;
          unit.endTime = new Date().toISOString();
          unit.durationMs = new Date(unit.endTime).getTime() - new Date(unit.startTime!).getTime();
          failed.push(unit);
          if (onUnitError) onUnitError(unit, error);
        } finally {
          running.delete(unit.id);
        }
      })();

      workPromise.catch(() => {}); // Unhandled rejection safety
    }

    pending = pending.filter((u) => running.has(u.id) || !ready.includes(u));

    if (running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  job.status = failed.length > 0 && completed.length === 0 ? "failed" : "completed";
  job.completedAt = new Date().toISOString();

  logger.info("ParallelExecutor", `Job "${job.name}" done: ${completed.length} completed, ${failed.length} failed`);

  return { results, completed, failed };
}

// ─── Build DAG from phases ─────────────────────────────────────────────

export function createParallelJob(
  name: string,
  phases: Array<{ id: string; name: string; dependencies?: string[] }>,
  maxParallel?: number
): ParallelJob {
  const workUnits: WorkUnit[] = phases.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.name,
    dependencies: p.dependencies || [],
    status: "pending",
  }));

  return {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    workUnits,
    maxParallel: maxParallel || 4,
    status: "pending",
  };
}

// ─── Topological sort for execution order ──────────────────────────────

export function topologicalSort(
  units: WorkUnit[]
): WorkUnit[][] {
  const levels: WorkUnit[][] = [];
  const remaining = new Set(units.map((u) => u.id));
  const depCount = new Map<string, number>();

  for (const unit of units) {
    depCount.set(unit.id, unit.dependencies.length);
  }

  while (remaining.size > 0) {
    const level: WorkUnit[] = [];

    for (const unit of units) {
      if (remaining.has(unit.id) && depCount.get(unit.id) === 0) {
        level.push(unit);
        remaining.delete(unit.id);
      }
    }

    if (level.length === 0 && remaining.size > 0) {
      // Cycle detected — include remaining in one level
      for (const id of remaining) {
        const unit = units.find((u) => u.id === id);
        if (unit) level.push(unit);
      }
      remaining.clear();
    }

    // Decrease dependency counts
    for (const unit of level) {
      for (const other of units) {
        if (other.dependencies.includes(unit.id)) {
          depCount.set(other.id, (depCount.get(other.id) || 1) - 1);
        }
      }
    }

    if (level.length > 0) levels.push(level);
  }

  return levels;
}

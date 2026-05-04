/**
 * SessionCheckpoint — Filesystem snapshots for pipeline safety.
 * Modeled on Claude Code's checkpoint system and OpenCode's /undo /redo.
 *
 * Captures file state before risky operations, enables rollback.
 * Stores snapshots as JSON with file contents + metadata.
 * Supports restore for safe undo operations.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus", "checkpoints");

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: string;
  files: Record<string, string>;
  metadata: Record<string, unknown>;
  phase?: string;
  executionId?: string;
}

interface CheckpointIndex {
  checkpoints: Array<{ id: string; label: string; timestamp: string; fileCount: number }>;
  currentId?: string;
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function getIndexPath(): string {
  return path.join(DATA_DIR, "index.json");
}

function getCheckpointPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

function loadIndex(): CheckpointIndex {
  ensureDir();
  const indexPath = getIndexPath();
  if (!existsSync(indexPath)) return { checkpoints: [] };
  try { return JSON.parse(readFileSync(indexPath, "utf-8")); }
  catch { return { checkpoints: [] }; }
}

function saveIndex(index: CheckpointIndex): void {
  ensureDir();
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), "utf-8");
}

const WATCH_FILES = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  ".env.local",
  "src/",
];

export function createCheckpoint(
  label: string,
  metadata?: Record<string, unknown>
): Checkpoint | null {
  try {
    ensureDir();
    const checkpointId = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const files: Record<string, string> = {};
    const cwd = process.cwd();

    for (const watchPath of WATCH_FILES) {
      try {
        const fullPath = path.join(cwd, watchPath);
        if (existsSync(fullPath)) {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            walkDir(fullPath, (filePath, content) => {
              files[path.relative(cwd, filePath).replace(/\\/g, "/")] = content;
            });
          } else {
            files[watchPath] = readFileSync(fullPath, "utf-8");
          }
        }
      } catch {
        // File not found or unreadable — skip
      }
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      label,
      timestamp: new Date().toISOString(),
      files,
      metadata: metadata || {},
    };

    writeFileSync(getCheckpointPath(checkpointId), JSON.stringify(checkpoint, null, 2), "utf-8");

    const index = loadIndex();
    index.checkpoints.unshift({
      id: checkpointId,
      label,
      timestamp: checkpoint.timestamp,
      fileCount: Object.keys(files).length,
    });
    index.currentId = checkpointId;

    if (index.checkpoints.length > 20) {
      const oldest = index.checkpoints.splice(20);
      for (const old of oldest) {
        try { unlinkSync(getCheckpointPath(old.id)); } catch {}
      }
    }
    saveIndex(index);

    logger.info("SessionCheckpoint", `Checkpoint "${label}" created: ${checkpointId} (${Object.keys(files).length} files)`);
    return checkpoint;
  } catch (err) {
    logger.error("SessionCheckpoint", `Checkpoint creation failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function walkDir(dir: string, callback: (filePath: string, content: string) => void, maxDepth = 5): void {
  if (maxDepth <= 0) return;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith(".") && entry !== ".env.local") continue;
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      const fullPath = path.join(dir, entry);
      try {
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          walkDir(fullPath, callback, maxDepth - 1);
        } else if (stats.isFile() && stats.size < 1024 * 1024) {
          callback(fullPath, readFileSync(fullPath, "utf-8"));
        }
      } catch { /* skip inaccessible */ }
    }
  } catch { /* skip */ }
}

export function restoreCheckpoint(checkpointId: string): boolean {
  try {
    const checkpointPath = getCheckpointPath(checkpointId);
    if (!existsSync(checkpointPath)) {
      logger.warn("SessionCheckpoint", `Checkpoint not found: ${checkpointId}`);
      return false;
    }

    const checkpoint: Checkpoint = JSON.parse(readFileSync(checkpointPath, "utf-8"));
    const cwd = process.cwd();

    let restored = 0;
    for (const [relativePath, content] of Object.entries(checkpoint.files)) {
      try {
        const fullPath = path.join(cwd, relativePath);
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
        restored++;
      } catch { /* skip */ }
    }

    const index = loadIndex();
    index.currentId = checkpointId;
    saveIndex(index);

    logger.info("SessionCheckpoint", `Checkpoint "${checkpoint.label}" restored: ${restored} files`);
    return true;
  } catch (err) {
    logger.error("SessionCheckpoint", `Checkpoint restore failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export function getCheckpoint(checkpointId: string): Checkpoint | null {
  const checkpointPath = getCheckpointPath(checkpointId);
  if (!existsSync(checkpointPath)) return null;
  try { return JSON.parse(readFileSync(checkpointPath, "utf-8")); }
  catch { return null; }
}

export function listCheckpoints(): CheckpointIndex["checkpoints"] {
  return loadIndex().checkpoints;
}

export function getCurrentCheckpointId(): string | undefined {
  return loadIndex().currentId;
}

export function deleteCheckpoint(checkpointId: string): boolean {
  const checkpointPath = getCheckpointPath(checkpointId);
  if (!existsSync(checkpointPath)) return false;
  try {
    unlinkSync(checkpointPath);
    const index = loadIndex();
    index.checkpoints = index.checkpoints.filter(c => c.id !== checkpointId);
    if (index.currentId === checkpointId) index.currentId = undefined;
    saveIndex(index);
    return true;
  } catch {
    return false;
  }
}

export function createPrePhaseCheckpoint(executionId: string, phase: string): Checkpoint | null {
  return createCheckpoint(`${executionId}:${phase}`, {
    executionId,
    phase,
    type: "pre-phase",
  });
}

export function createPostPhaseCheckpoint(executionId: string, phase: string): Checkpoint | null {
  return createCheckpoint(`${executionId}:${phase}:done`, {
    executionId,
    phase,
    type: "post-phase",
  });
}

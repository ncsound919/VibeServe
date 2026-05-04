/**
 * Nexus Alpha Error Tracking & Self-Healing Service
 * Captures, tracks, and learns from pipeline errors with retry logic and recovery patterns.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const ERRORS_FILE = path.join(DATA_DIR, "errors.json");
const RECOVERY_FILE = path.join(DATA_DIR, "recovery.json");

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory = "network" | "build" | "dependency" | "api" | "security" | "system" | "unknown";
export type RecoveryAction = "retry" | "skip" | "fallback" | "repair" | "escalate";
export type InsightCandidate = { pattern: string; category: string; message: string; confidence: number };

export interface TrackedError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  phase: string;
  timestamp: string;
  context?: Record<string, unknown>;
  stack?: string;
  resolved: boolean;
  resolvedAt?: string;
  recoveryAttempts: number;
  recoveryAction?: RecoveryAction;
}

export interface RecoveryPattern {
  id: string;
  errorPattern: string;
  category: ErrorCategory;
  action: RecoveryAction;
  successRate: number;
  totalAttempts: number;
  lastAttempt?: string;
}

export interface ErrorStats {
  totalErrors: number;
  resolvedErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentFailureCount: number;
  currentFailureStreak: number;
  longestFailureStreak: number;
  lastError?: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadErrors(): TrackedError[] {
  ensureDir();
  if (!existsSync(ERRORS_FILE)) return [];
  try { return JSON.parse(readFileSync(ERRORS_FILE, "utf-8")); }
  catch { return []; }
}

function saveErrors(errors: TrackedError[]) {
  ensureDir();
  writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2), "utf-8");
}

function loadRecovery(): RecoveryPattern[] {
  ensureDir();
  if (!existsSync(RECOVERY_FILE)) return getDefaultRecovery();
  try { return JSON.parse(readFileSync(RECOVERY_FILE, "utf-8")); }
  catch { return getDefaultRecovery(); }
}

function saveRecovery(patterns: RecoveryPattern[]) {
  ensureDir();
  writeFileSync(RECOVERY_FILE, JSON.stringify(patterns, null, 2), "utf-8");
}

function getDefaultRecovery(): RecoveryPattern[] {
  return [
    { id: "network-timeout", errorPattern: "ECONNREFUSED|ETIMEDOUT|ENOTFOUND", category: "network", action: "retry", successRate: 0, totalAttempts: 0 },
    { id: "npm-install-fail", errorPattern: "npm.*install|MODULE_NOT_FOUND", category: "dependency", action: "retry", successRate: 0, totalAttempts: 0 },
    { id: "build-fail", errorPattern: "Build failed|compilation.*error", category: "build", action: "repair", successRate: 0, totalAttempts: 0 },
    { id: "api-rate-limit", errorPattern: "rate.*limit|429", category: "api", action: "fallback", successRate: 0, totalAttempts: 0 },
    { id: "security-scan-fail", errorPattern: "security.*scan|vulnerability", category: "security", action: "skip", successRate: 0, totalAttempts: 0 },
    { id: "file-not-found", errorPattern: "ENOENT|file.*not.*found", category: "system", action: "repair", successRate: 0, totalAttempts: 0 },
  ];
}

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function categorizeError(error: Error | string): { category: ErrorCategory; severity: ErrorSeverity } {
  const msg = error instanceof Error ? error.message : error;
  const lower = msg.toLowerCase();

  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound") || lower.includes("network")) {
    return { category: "network", severity: "medium" };
  }
  if (lower.includes("npm") || lower.includes("install") || lower.includes("module") || lower.includes("package")) {
    return { category: "dependency", severity: "high" };
  }
  if (lower.includes("build") || lower.includes("compilation") || lower.includes("tsc") || lower.includes("syntax")) {
    return { category: "build", severity: "high" };
  }
  if (lower.includes("rate") || lower.includes("429") || lower.includes("500") || lower.includes("503")) {
    return { category: "api", severity: "medium" };
  }
  if (lower.includes("security") || lower.includes("vulnerability") || lower.includes("injection") || lower.includes("xss")) {
    return { category: "security", severity: "critical" };
  }
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("enoent")) {
    return { category: "system", severity: "medium" };
  }
  return { category: "unknown", severity: "low" };
}

export function trackError(
  error: Error | string,
  phase: string,
  context?: Record<string, unknown>
): TrackedError {
  const errors = loadErrors();
  const { category, severity } = categorizeError(error);

  const tracked: TrackedError = {
    id: generateErrorId(),
    message: error instanceof Error ? error.message : error,
    category,
    severity,
    phase,
    timestamp: new Date().toISOString(),
    context,
    stack: error instanceof Error ? error.stack : undefined,
    resolved: false,
    recoveryAttempts: 0,
  };

  errors.unshift(tracked);
  if (errors.length > 100) errors.length = 100;

  saveErrors(errors);
  logger.error("ErrorTracker", `[${phase}] ${tracked.message}`, { category, severity, id: tracked.id });

  return tracked;
}

export function resolveError(errorId: string, action?: RecoveryAction): TrackedError | null {
  const errors = loadErrors();
  const error = errors.find(e => e.id === errorId);
  if (!error) return null;

  error.resolved = true;
  error.resolvedAt = new Date().toISOString();
  error.recoveryAction = action;

  saveErrors(errors);
  logger.info("ErrorTracker", `Resolved error ${errorId}`, { action });

  updateRecoveryPattern(error.message, error.category, action || "retry", true);

  return error;
}

export function attemptRecovery(errorId: string): RecoveryAction {
  const errors = loadErrors();
  const error = errors.find(e => e.id === errorId);
  if (!error) return "escalate";

  error.recoveryAttempts += 1;

  const recovery = loadRecovery();
  const pattern = recovery.find(p => new RegExp(p.errorPattern, "i").test(error.message));

  if (pattern) {
    pattern.totalAttempts += 1;
    pattern.lastAttempt = new Date().toISOString();
    saveRecovery(recovery);
  }

  saveErrors(errors);
  return pattern?.action || "escalate";
}

function updateRecoveryPattern(message: string, category: ErrorCategory, action: RecoveryAction, success: boolean) {
  const recovery = loadRecovery();
  const pattern = recovery.find(p => new RegExp(p.errorPattern, "i").test(message));

  if (pattern) {
    if (success) {
      if (pattern.totalAttempts === 0) {
        pattern.successRate = 100;
      } else {
        pattern.successRate = ((pattern.successRate * (pattern.totalAttempts - 1)) + 100) / pattern.totalAttempts;
      }
    }
    saveRecovery(recovery);
  }
}

export function getRecommendedRecovery(message: string): RecoveryAction {
  const recovery = loadRecovery();
  const pattern = recovery.find(p => new RegExp(p.errorPattern, "i").test(message));
  return pattern?.action || "retry";
}

export function getErrorStats(): ErrorStats {
  const errors = loadErrors();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const stats: ErrorStats = {
    totalErrors: errors.length,
    resolvedErrors: errors.filter(e => e.resolved).length,
    errorsByCategory: { network: 0, build: 0, dependency: 0, api: 0, security: 0, system: 0, unknown: 0 },
    errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    recentFailureCount: 0,
    currentFailureStreak: 0,
    longestFailureStreak: 0,
  };

  errors.forEach(e => {
    stats.errorsByCategory[e.category]++;
    stats.errorsBySeverity[e.severity]++;
    if (new Date(e.timestamp).getTime() > dayAgo && !e.resolved) stats.recentFailureCount++;
  });

  const recentErrors = errors.slice(0, 20);
  let streak = 0;
  for (const e of recentErrors) {
    if (e.resolved) streak = 0;
    else streak++;
  }
  stats.currentFailureStreak = streak;

  return stats;
}

export function getRecentErrors(limit = 10): TrackedError[] {
  return loadErrors().slice(0, limit);
}

export function getRecoveryPatterns(): RecoveryPattern[] {
  return loadRecovery();
}

export function clearErrors(): void {
  saveErrors([]);
  logger.info("ErrorTracker", "Errors cleared");
}

export function getInsightCandidates(): InsightCandidate[] {
  const recovery = loadRecovery();
  const stats = getErrorStats();
  const candidates: InsightCandidate[] = [];

  for (const r of recovery) {
    if (r.totalAttempts >= 3) {
      candidates.push({
        pattern: `recovery-${r.id}`,
        category: r.successRate > 70 ? 'fix' : 'warning',
        message: `${r.errorPattern} errors: ${r.successRate.toFixed(0)}% recovery rate after ${r.totalAttempts} attempts`,
        confidence: Math.min(0.9, r.totalAttempts * 0.1),
      });
    }
  }

  if (stats.currentFailureStreak >= 3) {
    candidates.push({
      pattern: 'failure-streak',
      category: 'warning',
      message: `Pipeline failure streak: ${stats.currentFailureStreak} — check integrations`,
      confidence: 0.85,
    });
  }

  return candidates;
}

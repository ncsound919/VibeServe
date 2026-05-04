/**
 * PermissionManager — Fine-grained permission system modeled on OpenCode's ask/allow/deny per tool.
 *
 * Rules match tool invocations by scope + glob pattern (last matching rule wins).
 * Supports: edit, bash, read, delete, execute scopes with glob pattern matching.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";
import type { PermissionRule, PermissionCheckResult, PermissionScope, PermissionAction } from "../types/permissions";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const PERMISSIONS_FILE = path.join(DATA_DIR, "permissions.json");

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadRules(): PermissionRule[] {
  ensureDir();
  if (!existsSync(PERMISSIONS_FILE)) return getDefaultRules();
  try { return JSON.parse(readFileSync(PERMISSIONS_FILE, "utf-8")); }
  catch { return getDefaultRules(); }
}

function saveRules(rules: PermissionRule[]): void {
  ensureDir();
  writeFileSync(PERMISSIONS_FILE, JSON.stringify(rules, null, 2), "utf-8");
}

function getDefaultRules(): PermissionRule[] {
  return [
    { id: "allow-read-all", scope: "read", pattern: "**/*", action: "allow", priority: 0, enabled: true, description: "Read any file" },
    { id: "ask-edit-config", scope: "edit", pattern: "**/*.{json,yaml,toml,env*}", action: "ask", priority: 10, enabled: true, description: "Ask before editing config files" },
    { id: "allow-edit-src", scope: "edit", pattern: "src/**/*.{ts,tsx,css}", action: "allow", priority: 5, enabled: true, description: "Allow editing source files" },
    { id: "deny-edit-secrets", scope: "edit", pattern: "**/.env*", action: "deny", priority: 100, enabled: true, description: "Never edit .env files" },
    { id: "allow-bash-status", scope: "bash", pattern: "git status", action: "allow", priority: 5, enabled: true, description: "Allow git status" },
    { id: "ask-bash-push", scope: "bash", pattern: "git push*", action: "ask", priority: 20, enabled: true, description: "Ask before git push" },
    { id: "allow-bash-test", scope: "bash", pattern: "npm*test*", action: "allow", priority: 5, enabled: true, description: "Allow running tests" },
    { id: "allow-bash-lint", scope: "bash", pattern: "npm*run lint*", action: "allow", priority: 5, enabled: true, description: "Allow linting" },
    { id: "allow-bash-build", scope: "bash", pattern: "npm*run build*", action: "allow", priority: 5, enabled: true, description: "Allow builds" },
    { id: "ask-bash-install", scope: "bash", pattern: "npm*install*", action: "ask", priority: 15, enabled: true, description: "Ask before installing packages" },
    { id: "deny-bash-dangerous", scope: "bash", pattern: "rm -rf *|git push --force*|git reset --hard*", action: "deny", priority: 200, enabled: true, description: "Block dangerous commands" },
    { id: "allow-delete-logs", scope: "delete", pattern: "**/*.log", action: "allow", priority: 5, enabled: true, description: "Allow deleting log files" },
    { id: "ask-delete-src", scope: "delete", pattern: "src/**/*", action: "ask", priority: 10, enabled: true, description: "Ask before deleting source files" },
    { id: "deny-execute-arbitrary", scope: "execute", pattern: "**/*", action: "deny", priority: 100, enabled: true, description: "Deny arbitrary execution" },
  ];
}

function matchGlob(pattern: string, target: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(target);
}

export function checkPermission(
  scope: PermissionScope,
  target: string,
  context?: Record<string, unknown>
): PermissionCheckResult {
  const rules = loadRules();
  const defaultAction: PermissionAction = "ask";

  // Filter matching rules, sort by priority DESC (higher = more specific)
  const matching = rules
    .filter((r) => r.enabled && (r.scope === scope || r.scope === "all"))
    .filter((r) => matchGlob(r.pattern, target))
    .sort((a, b) => b.priority - a.priority);

  if (matching.length === 0) {
    return { allowed: true, action: defaultAction, reason: "No matching rule — using default" };
  }

  // Last matching rule wins (highest priority)
  const rule = matching[0];

  return {
    allowed: rule.action !== "deny",
    action: rule.action,
    matchedRule: rule.id,
    reason: rule.description,
  };
}

export function getRules(): PermissionRule[] {
  return loadRules();
}

export function addRule(rule: Omit<PermissionRule, "id">): PermissionRule {
  const rules = loadRules();
  const newRule: PermissionRule = {
    ...rule,
    id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  rules.push(newRule);
  saveRules(rules);
  logger.info("PermissionManager", `Added rule: ${newRule.scope}:${newRule.pattern} → ${newRule.action}`);
  return newRule;
}

export function updateRule(id: string, updates: Partial<PermissionRule>): PermissionRule | null {
  const rules = loadRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...updates };
  saveRules(rules);
  return rules[idx];
}

export function removeRule(id: string): boolean {
  const rules = loadRules();
  const filtered = rules.filter((r) => r.id !== id);
  if (filtered.length === rules.length) return false;
  saveRules(filtered);
  return true;
}

export function toggleRule(id: string): PermissionRule | null {
  const rules = loadRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rules[idx].enabled = !rules[idx].enabled;
  saveRules(rules);
  return rules[idx];
}

export function getPermissionsForScope(scope: PermissionScope): PermissionRule[] {
  return loadRules().filter((r) => r.enabled && (r.scope === scope || r.scope === "all"));
}

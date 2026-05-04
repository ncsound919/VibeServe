// Lightweight real tool runner for Nexus Alpha server
// This module exposes simple, safe commands that can be executed on the host
// to perform real operations (e.g., real build, real npm audit).

import { exec } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

import { permissionService } from '../services/permissionService';
import { logAuditEvent } from './auditLogService';

export interface ShellResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

// Run a shell command with optional cwd and timeout
export async function runShellCommand(
  command: string,
  cwd?: string,
  timeoutMs: number = 60000,
  onData?: (data: string) => void
): Promise<ShellResult> {
  // Permission Check
  const perm = permissionService.checkPermission({
    requestedScope: 'bash',
    requestedAction: 'execute',
    command,
    timestamp: new Date().toISOString()
  });

  if (perm.action === 'deny') {
    await logAuditEvent({
      actor: 'Nexus Agent',
      action: 'EXECUTE_SHELL_DENIED',
      target: command,
      metadata: { perm, cwd },
      status: 'failure'
    });
    throw new Error(`Permission Denied: Execution of "${command}" is restricted by policy.`);
  }
  
  if (perm.action === 'ask') {
    console.warn(`[SECURITY] Command requires manual approval: ${command}`);
    if (process.env.NODE_ENV !== 'development' && !process.env.AUTO_APPROVE) {
      await logAuditEvent({
        actor: 'Nexus Agent',
        action: 'EXECUTE_SHELL_BLOCKED_FOR_APPROVAL',
        target: command,
        metadata: { perm, cwd },
        status: 'warning'
      });
      throw new Error(`Permission Required: Approval needed for "${command}".`);
    }
  }

  await logAuditEvent({
    actor: 'Nexus Agent',
    action: 'EXECUTE_SHELL_START',
    target: command,
    metadata: { perm, cwd },
    status: 'success'
  });

  const options: { cwd: string; timeout: number } = { cwd: cwd ?? process.cwd(), timeout: timeoutMs };
  
  return new Promise<ShellResult>((resolve) => {
    const child = exec(command, options, (error: Error | null, stdout: string, stderr: string) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ stdout, stderr, code });
    });

    if (onData) {
      child.stdout?.on('data', (data) => onData(data.toString()));
      child.stderr?.on('data', (data) => onData(data.toString()));
    }
  });
}

// Real build command for the Nexus Alpha repo root
export async function runBuildCommand(): Promise<ShellResult> {
  // Try to detect a typical build script in package.json. If not present, attempt standard vite build.
  const repoRoot = process.cwd();
  // Ensure dependencies are installed before building
  try {
    if (existsSync(path.resolve(repoRoot, 'package-lock.json'))) {
      await runShellCommand('npm ci', repoRoot, 120000);
    } else if (existsSync(path.resolve(repoRoot, 'package.json'))) {
      await runShellCommand('npm install', repoRoot, 120000);
    }
  } catch {
    // If install fails (e.g., network), proceed to attempt build anyway
  }
  // We simply attempt a plain 'npm run build' first; if that fails, fall back to 'vite build'
  try {
    return await runShellCommand('npm run build', repoRoot, 120000);
  } catch {
    return await runShellCommand('vite build', repoRoot, 120000);
  }
}

// Real npm audit command
export async function runAuditCommand(): Promise<ShellResult> {
  // Run npm audit in json mode for machine parsing
  return await runShellCommand('npm audit --json', process.cwd(), 60000);
}

// Real lint command: try npm script then fall back to tsc
export async function runLintCommand(): Promise<ShellResult> {
  try {
    // Prefer npm script if available
    return await runShellCommand('npm run lint', process.cwd(), 60000);
  } catch {
    // Fallback to TypeScript lint
    return await runShellCommand('tsc --noEmit', process.cwd(), 60000);
  }
}

// Real tests command: run the repository's test suite
export async function runTestsCommand(): Promise<ShellResult> {
  // Use npm test to leverage existing scripts (Playwright in this repo)
  return await runShellCommand('npm test', process.cwd(), 600000);
}

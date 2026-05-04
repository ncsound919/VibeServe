import { spawnSync, SpawnSyncOptions } from 'child_process';
import { logger } from './logger';

export interface SafeExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: Error;
}

/**
 * Safely executes a command with arguments to prevent shell injection.
 * Uses child_process.spawnSync instead of execSync.
 */
export function safeExec(
  command: string,
  args: string[] = [],
  options: SpawnSyncOptions = {}
): SafeExecResult {
  try {
    const result = spawnSync(command, args, {
      ...options,
      encoding: 'utf-8',
      shell: false, // CRITICAL: Disable shell to prevent injection
    });

    if (result.error) {
      return {
        success: false,
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
        exitCode: result.status,
        error: result.error,
      };
    }

    return {
      success: result.status === 0,
      stdout: result.stdout?.toString() || '',
      stderr: result.stderr?.toString() || '',
      exitCode: result.status,
    };
  } catch (err) {
    logger.error('SafeShell', `Failed to execute ${command}`, err);
    return {
      success: false,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Legacy wrapper for easier migration from execSync where necessary.
 * Still uses spawnSync under the hood.
 */
export function safeExecLegacy(commandLine: string, options: SpawnSyncOptions = {}): string {
  // Simple parser for command line strings - handles basic quoting
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  
  const [cmd, ...args] = parts;
  const res = safeExec(cmd, args, options);
  
  if (!res.success && options.stdio !== 'ignore') {
    throw new Error(`Command failed with exit code ${res.exitCode}: ${res.stderr}`);
  }
  
  return res.stdout;
}

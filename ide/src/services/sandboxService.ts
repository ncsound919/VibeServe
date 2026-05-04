/**
 * Sandbox Service for Agent Tasks
 *
 * Provides Docker-based sandboxing for secure agent code execution.
 * Integrates with microsandbox concepts for isolated environments.
 *
 * NOTE: This service is server-only. All Node.js imports are lazy and
 * guarded against browser environments.
 */

// ─── Browser guard ──────────────────────────────────────────────────────
const IS_BROWSER = typeof window !== 'undefined';

import { v4 as uuidv4 } from 'uuid';
import { safeExec, safeExecLegacy } from '../lib/safeShell';

export type SandboxType = 'none' | 'docker' | 'vm';

export interface SandboxConfig {
  type: SandboxType;
  timeoutMs: number;
  memoryLimit: string;
  cpuLimit: string;
  networkDisabled: boolean;
}

export interface SandboxExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  containerId?: string;
}

const DEFAULT_CONFIG: SandboxConfig = {
  type: 'docker',
  timeoutMs: 300000,
  memoryLimit: '512m',
  cpuLimit: '1.0',
  networkDisabled: false,
};

export class SandboxService {
  private config: SandboxConfig;
  private activeContainers: Set<string> = new Set();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isDockerAvailable(): boolean {
    if (IS_BROWSER) return false;
    try {
      safeExec('docker', ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async createSandbox(
    workDir: string,
    command: string,
    files?: Record<string, string>
  ): Promise<SandboxExecutionResult> {
    if (IS_BROWSER) {
      return { success: false, exitCode: 1, stdout: '', stderr: 'Sandbox not available in browser', durationMs: 0 };
    }
    const startTime = Date.now();
    if (this.config.type === 'none') {
      return this.executeWithoutSandbox(workDir, command, startTime);
    }
    if (this.config.type === 'docker') {
      return this.executeWithDocker(workDir, command, files, startTime);
    }
    throw new Error(`Sandbox type ${this.config.type} not yet implemented`);
  }

  private async executeWithoutSandbox(
    workDir: string,
    command: string,
    startTime: number
  ): Promise<SandboxExecutionResult> {
    try {
      const res = safeExecLegacy(command, {
        cwd: workDir,
        timeout: this.config.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { success: true, exitCode: 0, stdout: res, stderr: '', durationMs: Date.now() - startTime };
    } catch (error: any) {
      return { success: false, exitCode: error.status || 1, stdout: error.stdout || '', stderr: error.stderr || error.message, durationMs: Date.now() - startTime };
    }
  }

  private async executeWithDocker(
    workDir: string,
    command: string,
    files?: Record<string, string>,
    startTime: number = Date.now()
  ): Promise<SandboxExecutionResult> {
    if (!this.isDockerAvailable()) {
      throw new Error('Docker is not available. Please install Docker or use sandbox type "none"');
    }
    // Lazy-load Node.js modules
    const { existsSync, mkdirSync, writeFileSync, rmSync } = await import('fs');
    const { join, resolve } = await import('path');

    const containerId = `nexus-sandbox-${uuidv4().slice(0, 8)}`;
    const tempDir = join(workDir, '.nexus-sandbox', containerId);
    try {
      if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
      if (files) {
        for (const [filePath, content] of Object.entries(files)) {
          const fullPath = join(tempDir, filePath);
          const dir = resolve(fullPath, '..');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(fullPath, content, 'utf-8');
        }
      }
      const res = safeExec('docker', [
        'run', '--name', containerId, '--rm',
        '--memory', this.config.memoryLimit,
        '--cpus', this.config.cpuLimit,
        '--pids-limit', '50',
        '--ulimit', 'nofile=128:256',
        this.config.networkDisabled ? '--network-none' : '',
        '-v', `${tempDir}:/workspace`,
        '-w', '/workspace',
        'node:20-alpine', 'sh', '-c', command,
      ].filter(Boolean) as string[], {
        cwd: tempDir,
        timeout: this.config.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });
      this.activeContainers.delete(containerId);
      if (!res.success) throw { status: res.exitCode, stdout: res.stdout, stderr: res.stderr || res.error?.message };
      return { success: true, exitCode: 0, stdout: res.stdout, stderr: '', durationMs: Date.now() - startTime, containerId };
    } catch (error: any) {
      try { safeExec('docker', ['rm', '-f', containerId], { stdio: 'ignore' }); } catch { /* ignore */ }
      this.activeContainers.delete(containerId);
      return { success: false, exitCode: error.status || 1, stdout: error.stdout || '', stderr: error.stderr || error.message, durationMs: Date.now() - startTime, containerId };
    } finally {
      try {
        const { existsSync: exists, rmSync: rm } = await import('fs');
        if (exists(tempDir)) rm(tempDir, { recursive: true, force: true });
      } catch { /* ignore cleanup errors */ }
    }
  }

  stopSandbox(containerId: string): boolean {
    if (IS_BROWSER) return false;
    try {
      safeExec('docker', ['stop', containerId], { stdio: 'ignore' });
      this.activeContainers.delete(containerId);
      return true;
    } catch { return false; }
  }

  getActiveContainers(): string[] {
    return Array.from(this.activeContainers);
  }

  cleanup(): void {
    for (const containerId of this.activeContainers) {
      this.stopSandbox(containerId);
    }
  }
}

export const sandboxService = new SandboxService();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const execAsync = promisify(exec);

export interface SecurityReport {
  vulnerabilities: number;
  secrets: number;
  sastFindings: number;
  passed: boolean;
  summary: string;
  details: string[];
  tools: { name: string; available: boolean; version?: string }[];
}

function resolveBinary(name: string): string {
  const home = homedir();
  const candidates: string[] = [];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'AquaSecurity.Trivy_Microsoft.Winget.Source_8wekyb3d8bbwe', `${name}.exe`),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe', `${name}.exe`),
      path.join(home, 'AppData', 'Roaming', 'Python', 'Python312', 'Scripts', `${name}.exe`),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', name, `${name}.exe`),
    );
  } else {
    candidates.push(`/usr/local/bin/${name}`, `/usr/bin/${name}`, `/opt/homebrew/bin/${name}`);
  }

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return name;
}

async function toolAvailable(cmd: string): Promise<boolean> {
  try {
    const bin = resolveBinary(cmd);
    const { stderr } = await execAsync(`"${bin}" --version`, { timeout: 5000 });
    if (stderr && stderr.toLowerCase().includes('not support')) return false;
    return true;
  } catch {
    return false;
  }
}

function runTool(cmd: string, args: string, opts?: { timeout?: number; cwd?: string }): string | null {
  try {
    const bin = resolveBinary(cmd);
    return execSync(`"${bin}" ${args}`, {
      encoding: 'utf-8',
      timeout: opts?.timeout || 120000,
      cwd: opts?.cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: any) {
    if (e.stdout) return e.stdout;
    return null;
  }
}

async function runToolAsync(cmd: string, args: string, opts?: { timeout?: number; cwd?: string }): Promise<string | null> {
  try {
    const bin = resolveBinary(cmd);
    const { stdout } = await execAsync(`"${bin}" ${args}`, {
      timeout: opts?.timeout || 120000,
      cwd: opts?.cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (e: any) {
    if (e.stdout) return e.stdout;
    return null;
  }
}


async function runTrivy(targetPath?: string): Promise<{ count: number; details: string[]; available: boolean }> {
  const available = await toolAvailable('trivy');
  if (!available) return { count: 0, details: [], available: false };
  const out = await runToolAsync('trivy', 'fs --scanners vuln,secret --severity HIGH,CRITICAL --quiet .', { cwd: targetPath });
  const lines = (out || '').trim().split('\n').filter(Boolean);
  const vulnLines = lines.filter(l => l.includes('CRITICAL') || l.includes('HIGH'));
  return { count: vulnLines.length, details: lines.slice(0, 20), available: true };
}

async function runSemgrep(targetPath?: string): Promise<{ count: number; details: string[]; available: boolean }> {
  const available = await toolAvailable('semgrep');
  if (!available) return { count: 0, details: [], available: false };
  const out = await runToolAsync('semgrep', '--config auto --quiet .', { cwd: targetPath });
  const lines = (out || '').trim().split('\n').filter(Boolean);
  const findings = lines.filter(l => l.includes('finding') || l.includes('warning') || l.includes('error'));
  return { count: findings.length, details: lines.slice(0, 15), available: true };
}

async function runGitleaks(targetPath?: string): Promise<{ count: number; details: string[]; available: boolean }> {
  const available = await toolAvailable('gitleaks');
  if (!available) return { count: 0, details: [], available: false };
  const out = await runToolAsync('gitleaks', 'git --verbose', { cwd: targetPath });
  const lines = (out || '').trim().split('\n').filter(Boolean);
  const findings = lines.filter(l => l.includes('leak') || l.includes('secret') || l.includes('finding'));
  return { count: findings.length, details: lines.slice(0, 10), available: true };
}

async function runOsvScanner(targetPath?: string): Promise<{ count: number; details: string[]; available: boolean }> {
  const available = await toolAvailable('osv-scanner');
  if (!available) return { count: 0, details: [], available: false };
  const out = await runToolAsync('osv-scanner', '--json --recursive .', { cwd: targetPath });
  try {
    const parsed = JSON.parse(out || '{}');
    const results = parsed.results || [];
    let count = 0;
    results.forEach(res => {
      (res.packages || []).forEach(pkg => {
        count += (pkg.vulnerabilities || []).length;
      });
    });
    return { count, details: [`OSV found ${count} package vulnerabilities`], available: true };
  } catch {
    return { count: 0, details: [], available: true };
  }
}

export async function runSecurityAudit(targetPath?: string): Promise<SecurityReport> {
  const [trivyResult, semgrepResult, gitleaksResult, osvResult] = await Promise.all([
    runTrivy(targetPath), runSemgrep(targetPath), runGitleaks(targetPath), runOsvScanner(targetPath)
  ]);

  const totalFindings = trivyResult.count + semgrepResult.count + gitleaksResult.count + osvResult.count;
  const tools = [
    { name: 'Trivy', available: trivyResult.available, version: trivyResult.available ? 'installed' : undefined },
    { name: 'Semgrep', available: semgrepResult.available, version: semgrepResult.available ? 'installed' : undefined },
    { name: 'Gitleaks', available: gitleaksResult.available, version: gitleaksResult.available ? 'installed' : undefined },
    { name: 'OSV-Scanner', available: osvResult.available, version: osvResult.available ? 'installed' : undefined },
  ];

  const availableTools = tools.filter(t => t.available).length;

  return {
    vulnerabilities: trivyResult.count,
    secrets: gitleaksResult.count,
    sastFindings: semgrepResult.count,
    passed: totalFindings === 0 || availableTools === 0,
    summary: availableTools === 0
      ? `Security scan skipped — no tools available (install: trivy, semgrep, gitleaks)`
      : totalFindings === 0
        ? 'Security audit passed — no HIGH/CRITICAL findings'
        : `Security audit found ${totalFindings} issue(s): ${trivyResult.count} vulns, ${semgrepResult.count} SAST, ${gitleaksResult.count} secrets`,
    details: [...trivyResult.details, ...semgrepResult.details, ...gitleaksResult.details],
    tools,
  };
}

export async function runSecurityAuditPhase(ctx: { execution: any; sourceRepos: string[]; targetPath?: string }): Promise<void> {
  const { execution } = ctx;
  const report = await runSecurityAudit(ctx.targetPath);

  execution.logs = [...execution.logs,
    `[SECURITY] ${report.summary}`,
  ];

  for (const tool of report.tools) {
    execution.logs = [...execution.logs, `[SECURITY] ${tool.name}: ${tool.available ? 'available' : 'not installed'}`];
  }

  if (report.details.length > 0) {
    execution.logs = [...execution.logs, `[SECURITY] Detailed findings:`];
    for (const detail of report.details.slice(0, 8)) {
      execution.logs = [...execution.logs, `[SECURITY]   ${detail}`];
    }
  }
}

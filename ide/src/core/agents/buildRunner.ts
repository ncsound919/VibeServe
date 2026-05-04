import { exec } from 'child_process';
import { promisify } from 'util';
import type { BuildResult, BuildError } from './types';

const execP = promisify(exec);

export interface RunBuildOptions {
  timeout?: number;
}

export async function runBuild(root: string, opts: RunBuildOptions = {}): Promise<BuildResult> {
  const { timeout = 120_000 } = opts;
  const start = Date.now();
  const errors: BuildError[] = [];
  const warnings: string[] = [];

  try {
    const { stdout, stderr } = await execP('npm run build', { cwd: root, timeout });
    const combined = (stdout + '\n' + stderr).split('\n');

    for (const line of combined) {
      const lower = line.toLowerCase();
      if (lower.includes('error')) {
        errors.push({ command: 'npm run build', exitCode: 0, stdout: line.slice(0, 200), stderr: line.slice(0, 200) });
      } else if (lower.includes('warning') || lower.includes('warn')) {
        warnings.push(line.slice(0, 200));
      }
    }

    return { success: errors.length === 0, duration: Date.now() - start, errors, warnings, outputPath: root };
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; code?: number | null; message?: string };
    const combined = ((err.stdout ?? '') + '\n' + (err.stderr ?? '')).split('\n').filter(Boolean);
    const buildErrors: BuildError[] = combined
      .filter(l => l.toLowerCase().includes('error'))
      .slice(0, 20)
      .map(l => ({
        command: 'npm run build',
        exitCode: err.code ?? null,
        stdout: err.stdout?.slice(0, 500) ?? '',
        stderr: l.slice(0, 500),
      }));

    if (buildErrors.length === 0) {
      buildErrors.push({
        command: 'npm run build',
        exitCode: err.code ?? null,
        stdout: '',
        stderr: (err.message ?? String(e)).slice(0, 500),
      });
    }

    return { success: false, duration: Date.now() - start, errors: buildErrors, warnings, outputPath: root };
  }
}

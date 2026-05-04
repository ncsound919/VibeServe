import { execSync } from 'child_process';

export interface DeadCodeReport {
  unusedDeps: string[];
  unusedExports: string[];
  totalIssues: number;
  summary: string;
}

export function runKnipCheck(targetPath?: string): DeadCodeReport {
  const cwd = targetPath || process.cwd();
  try {
    const result = execSync('npx knip --production', {
      encoding: 'utf-8',
      timeout: 120000,
      cwd,
    });
    const lines = result.trim().split('\n').filter(Boolean);
    const unusedDeps = lines.filter(l => l.includes('Unused dependencies') || l.includes('unused')).slice(0, 15);
    const unusedExports = lines.filter(l => l.includes('Unused exports') || l.includes('unreferenced')).slice(0, 15);
    return {
      unusedDeps,
      unusedExports,
      totalIssues: unusedDeps.length + unusedExports.length,
      summary: lines.length > 0 ? lines[0] : 'No dead code found',
    };
  } catch (e: any) {
    if (e.stdout) {
      const lines = e.stdout.trim().split('\n').filter(Boolean);
      return {
        unusedDeps: lines.slice(0, 15),
        unusedExports: [],
        totalIssues: lines.length,
        summary: `Knip found ${lines.length} issue(s)`,
      };
    }
    return { unusedDeps: [], unusedExports: [], totalIssues: 0, summary: 'Knip not available — skipped' };
  }
}

export async function runDeadCodeCheckPhase(ctx: { execution: any; sourceRepos: string[]; targetPath?: string }): Promise<void> {
  const { execution } = ctx;
  const logs = ctx.execution?.logs ?? [];
  const report = runKnipCheck(ctx.targetPath);

  execution.logs = [...logs,
    `[DEADCODE] Knip analysis: ${report.totalIssues} dead code/dep issue(s) found`,
  ];

  if (report.unusedDeps.length > 0) {
    execution.logs = [...execution.logs, `[DEADCODE] Unused dependencies: ${report.unusedDeps.length}`];
    for (const d of report.unusedDeps.slice(0, 5)) {
      execution.logs = [...execution.logs, `[DEADCODE]   ${d}`];
    }
  }

  if (report.unusedExports.length > 0) {
    execution.logs = [...execution.logs, `[DEADCODE] Unused exports: ${report.unusedExports.length}`];
    for (const e of report.unusedExports.slice(0, 5)) {
      execution.logs = [...execution.logs, `[DEADCODE]   ${e}`];
    }
  }

  if (report.totalIssues === 0 && report.summary !== 'Knip not available — skipped') {
    execution.logs = [...execution.logs, '[DEADCODE] No dead code detected'];
  }
}

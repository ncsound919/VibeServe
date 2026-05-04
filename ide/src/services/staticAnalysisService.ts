import { execSync } from 'child_process';

export interface LintReport {
  errors: number;
  warnings: number;
  summary: string;
  details: string[];
}

export function runBiomeCheck(targetPath?: string): LintReport {
  const cwd = targetPath || process.cwd();
  try {
    const result = execSync('npx biome check --max-diagnostics=50 .', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd,
    });
    const lines = result.trim().split('\n').filter(Boolean);
    const errorLines = lines.filter(l => l.includes('error'));
    const warnLines = lines.filter(l => l.includes('warning') || l.includes('warn'));
    return {
      errors: errorLines.length,
      warnings: warnLines.length,
      summary: lines.length > 0 ? lines[0] : 'No issues found',
      details: lines.slice(0, 20),
    };
  } catch (e: any) {
    if (e.stdout) {
      const lines = e.stdout.trim().split('\n').filter(Boolean);
      return {
        errors: lines.filter(l => l.includes('error')).length,
        warnings: lines.filter(l => l.includes('warning')).length,
        summary: `Biome found issues`,
        details: lines.slice(0, 20),
      };
    }
    return { errors: 0, warnings: 0, summary: 'Biome not available — skipped', details: [] };
  }
}

export function runDepCheck(targetPath?: string): { unused: string[]; missing: string[]; summary: string } {
  const cwd = targetPath || process.cwd();
  try {
    const result = execSync('npx depcheck --json', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd,
    });
    const parsed = JSON.parse(result);
    const unused = Object.keys(parsed.dependencies || {});
    const missing = Object.keys(parsed.missing || {});
    return {
      unused,
      missing,
      summary: `Dependency check: ${unused.length} unused, ${missing.length} missing`,
    };
  } catch (e: any) {
    return { unused: [], missing: [], summary: 'Depcheck not available — skipped' };
  }
}

export interface DebtRadarReport {
  todos: number;
  complexity: 'low' | 'medium' | 'high';
  debtScore: number;
  untypedExports: number;
  recommendation: string;
}

export function getDebtRadar(content: string): DebtRadarReport {
  const todos = (content.match(/\/\/ TODO:|\/\/ FIXME:/gi) || []).length;
  const lines = content.split('\n');
  const lineCount = lines.length;
  const complexityScore = (content.match(/if |while |for |&& |\|\| /g) || []).length / (lineCount / 10);
  
  const untypedExports = (content.match(/export (const|let|var) \w+ =/g) || []).length;

  let complexity: 'low' | 'medium' | 'high' = 'low';
  if (complexityScore > 1.5) complexity = 'high';
  else if (complexityScore > 0.8) complexity = 'medium';

  const debtScore = (todos * 10) + (complexity === 'high' ? 30 : complexity === 'medium' ? 15 : 0) + (untypedExports * 5);

  const recommendation = debtScore > 50 
    ? "Critical refactor suggested: high complexity and debt found."
    : debtScore > 20 
      ? "Minor technical debt identified. Consider documenting exports."
      : "Codebase healthy. Minimal debt detected.";

  return { todos, complexity, debtScore, untypedExports, recommendation };
}

export async function runStaticAnalysisPhase(ctx: { execution: any; sourceRepos: string[]; targetPath?: string }): Promise<void> {
  const { execution } = ctx;
  const logs = ctx.execution?.logs ?? [];
  const report = runBiomeCheck(ctx.targetPath);
  const depReport = runDepCheck(ctx.targetPath);

  execution.logs = [...logs,
    `[STATIC] Biome analysis complete: ${report.errors} error(s), ${report.warnings} warning(s)`,
    `[STATIC] ${report.summary}`,
    `[STATIC] ${depReport.summary}`,
  ];

  if (report.errors > 0) {
    execution.logs = [...execution.logs, `[STATIC] Top issues:`];
    for (const detail of report.details.slice(0, 5)) {
      execution.logs = [...execution.logs, `[STATIC]   ${detail}`];
    }
  } else if (report.summary !== 'Biome not available — skipped') {
    execution.logs = [...execution.logs, '[STATIC] All checks passed'];
  }
}

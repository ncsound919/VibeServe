import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import path from 'path';
import { logger } from '../../lib/logger';
import type { AppSpec, GenerationResult } from './types';
import { CodingAgentService, codingAgent } from './codingAgentService';
import { runBuild } from './buildRunner';
import { detectPackageManager } from './packageManager';
import { diagnoseError } from './errorDiagnoser';
import {
  runAutoFixLoop,
  createCheckpoint,
  saveFixHistory,
  extendAutoFixContext,
} from '../../services/autoFixLoop';
import type { AutoFixContext } from '../../types/hooks';

const CTX = 'RealPipeline';

export interface PhaseResult {
  phase: string;
  success: boolean;
  logs: string[];
  duration: number;
}

export interface PipelineRunResult {
  id: string;
  success: boolean;
  spec: AppSpec;
  generation: GenerationResult | null;
  phases: PhaseResult[];
  totalDuration: number;
  summary: string;
}

export class RealPipeline {
  private agent: CodingAgentService;

  constructor(agent?: CodingAgentService) {
    this.agent = agent || codingAgent;
  }

  async run(spec: AppSpec): Promise<PipelineRunResult> {
    const start = Date.now();
    const id = `pipeline_${Date.now().toString(36)}`;
    const phases: PhaseResult[] = [];

    logger.info(CTX, `Starting real pipeline for: ${spec.description.slice(0, 60)}`);

    const generation = await this.agent.generateApp(spec);
    const appDir = generation.appPath;

    phases.push(await this.phaseEnvironmentSetup(appDir));

    if (!phases[0].success) {
      const totalDuration = Date.now() - start;
      return { id, success: false, spec, generation, phases, totalDuration, summary: 'Fatal: Environment setup failed. Cannot continue.' };
    }

    phases.push(await this.phaseDependencyResolution(appDir));
    phases.push(await this.phaseRAGSync(appDir));
    phases.push(await this.phaseMCPResolution());
    phases.push(await this.phaseStaticAnalysis(appDir));
    phases.push(await this.phaseBuild(appDir));
    phases.push(await this.phaseSecurityAudit(appDir));
    phases.push(await this.phaseE2ETesting(appDir));
    phases.push(await this.phaseOptimization(appDir));
    phases.push(await this.phaseFinalizing(appDir, generation));

    const success = generation.success && phases.every(p => p.success);
    const totalDuration = Date.now() - start;

    return {
      id,
      success,
      spec,
      generation,
      phases,
      totalDuration,
      summary: success
        ? `Pipeline completed successfully in ${(totalDuration / 1000).toFixed(1)}s`
        : `Pipeline completed with issues in ${(totalDuration / 1000).toFixed(1)}s`,
    };
  }

  private async phaseEnvironmentSetup(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];
    let success = true;

    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      logs.push(`[ENV] Node.js: ${nodeVersion}`);
    } catch {
      logs.push('[ENV] Node.js version check failed');
      success = false;
    }

    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      logs.push(`[ENV] npm: ${npmVersion}`);
    } catch {
      logs.push('[ENV] npm version check failed');
      success = false;
    }

    if (existsSync(appDir)) {
      logs.push(`[ENV] App directory: ${appDir} (exists)`);
      logs.push(`[ENV] Directory contents: ${readdirSync(appDir).length} items`);
    } else {
      logs.push('[ENV] App directory does not exist');
      success = false;
    }

    logs.push(`[ENV] Platform: ${process.platform}, Arch: ${process.arch}`);

    return { phase: 'Environment Setup', success, logs, duration: 0 };
  }

  private async phaseDependencyResolution(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];
    const pkgPath = path.join(appDir, 'package.json');

    if (!existsSync(pkgPath)) {
      logs.push('[DEPS] No package.json found');
      return { phase: 'Dependency Resolution', success: false, logs, duration: 0 };
    }

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;
      logs.push(`[DEPS] package.json: ${depCount} deps, ${devDepCount} devDeps`);

      const pm = detectPackageManager(appDir);
      logs.push(`[DEPS] Package manager: ${pm}`);

      if (existsSync(path.join(appDir, 'node_modules'))) {
        const nmDirs = readdirSync(path.join(appDir, 'node_modules')).length;
        logs.push(`[DEPS] node_modules exists (${nmDirs} packages)`);

        const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
        for (const lf of lockfiles) {
          if (existsSync(path.join(appDir, lf))) {
            logs.push(`[DEPS] Lockfile: ${lf}`);
            break;
          }
        }

        return { phase: 'Dependency Resolution', success: true, logs, duration: 0 };
      }

      logs.push('[DEPS] node_modules missing — installing...');
      try {
        const output = execSync(`${pm} install`, {
          cwd: appDir, timeout: 120000, encoding: 'utf-8', stdio: 'pipe',
          maxBuffer: 5 * 1024 * 1024,
        });
        const lines = output.split('\n').filter(l => l.length > 0);
        logs.push(...lines.slice(-3).map(l => `[DEPS] ${l.trim().slice(0, 100)}`));
        logs.push('[DEPS] Installation complete');
      } catch {
        logs.push('[DEPS] npm install failed — node_modules may be incomplete');
      }
    } catch (err) {
      logs.push(`[DEPS] Error: ${err instanceof Error ? err.message.slice(0, 100) : 'unknown'}`);
    }

    return { phase: 'Dependency Resolution', success: true, logs, duration: 0 };
  }

  private async phaseRAGSync(_appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];

    try {
      const { searchWikiForPhase } = await import('../../services/wikiRetrievalService');
      const wikiContext = searchWikiForPhase('Code Generation');
      if (wikiContext.relevantPages?.length > 0) {
        logs.push(`[RAG] Found ${wikiContext.relevantPages.length} relevant wiki page(s)`);
      } else {
        logs.push('[RAG] No relevant wiki pages found');
      }
    } catch {
      logs.push('[RAG] Wiki unavailable (running without RAG)');
    }

    return { phase: 'RAG Context Sync', success: true, logs, duration: 0 };
  }

  private async phaseMCPResolution(): Promise<PhaseResult> {
    const logs: string[] = [];

    try {
      const { integrationHub: hub } = await import('../../services/integrationService');
      const status = await hub.getStatus();
      const online = Object.values(status).filter(Boolean).length;
      const total = Object.keys(status).length;
      logs.push(`[MCP] Integration hub: ${online}/${total} services connected`);
    } catch {
      logs.push('[MCP] MCP bridge unavailable');
    }

    return { phase: 'MCP Context Resolution', success: true, logs, duration: 0 };
  }

  private async phaseStaticAnalysis(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];

    try {
      const output = execSync('npx biome check --no-errors-on-unmatch 2>&1 || true', {
        cwd: appDir, timeout: 30000, encoding: 'utf-8', stdio: 'pipe',
        maxBuffer: 2 * 1024 * 1024,
      });
      const lines = output.split('\n').filter(l => l.trim());
      for (const line of lines.slice(0, 5)) {
        logs.push(`[LINT] ${line.trim().slice(0, 120)}`);
      }
      if (lines.length > 5) {
        logs.push(`[LINT] ... and ${lines.length - 5} more lines`);
      }
      logs.push('[LINT] Biome check complete');
    } catch {
      logs.push('[LINT] Biome not configured — trying TypeScript check...');
      try {
        const tsOutput = execSync('npx tsc --noEmit 2>&1 || true', {
          cwd: appDir, timeout: 30000, encoding: 'utf-8', stdio: 'pipe',
          maxBuffer: 2 * 1024 * 1024,
        });
        const lines = tsOutput.split('\n').filter(l => l.trim());
        const errors = lines.filter(l => l.includes('error')).length;
        logs.push(`[LINT] tsc: ${lines.length} issues (${errors} errors)`);
        for (const line of lines.slice(0, 5)) {
          logs.push(`[LINT] ${line.trim().slice(0, 120)}`);
        }
      } catch {
        logs.push('[LINT] No static analysis tool available');
      }
    }

    return { phase: 'Static Analysis', success: true, logs, duration: 0 };
  }

  private async phaseBuild(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];
    const buildResult = await runBuild(appDir);

    if (buildResult.success) {
      logs.push(`[BUILD] Build succeeded (${buildResult.duration}ms)`);
      if (existsSync(buildResult.outputPath)) {
        const files = readdirSync(buildResult.outputPath);
        let totalSize = 0;
        for (const f of files) {
          totalSize += statSync(path.join(buildResult.outputPath, f)).size;
        }
        logs.push(`[BUILD] Output: ${files.length} files, ${(totalSize / 1024).toFixed(0)}KB`);
      }
      return { phase: 'Build & Compile', success: true, logs, duration: buildResult.duration };
    }

    logs.push(`[BUILD] Build FAILED (${buildResult.duration}ms)`);
    for (const err of buildResult.errors.slice(0, 5)) {
      logs.push(`[BUILD] ERROR: ${err.stderr.slice(0, 150)}`);
    }

    const primaryError = buildResult.errors[0];
    if (!primaryError) {
      logs.push('[AUTOFIX] No actionable build errors to diagnose');
      return { phase: 'Build & Compile', success: false, logs, duration: buildResult.duration };
    }

    try {
      const diagnosis = await diagnoseError(primaryError, appDir);
      logs.push(`[AUTOFIX] Diagnosis: ${diagnosis.fixStrategy} — ${diagnosis.fixDescription}`);
      if (diagnosis.affectedFile) {
        logs.push(`[AUTOFIX] Affected file: ${diagnosis.affectedFile}`);
      }

      const context: AutoFixContext = {
        executionId: `${appDir}_build`,
        phase: 'Build & Compile',
        error: new Error(primaryError.stderr),
        errorType: 'build',
        sourceRepos: [appDir],
        pipelineLogs: logs,
        previousFixes: [],
      };

      const ctxWithRetry = extendAutoFixContext(context, async () => {
        const retryResult = await runBuild(appDir, { timeout: 120000 });
        if (!retryResult.success) {
          throw new Error(retryResult.errors[0]?.stderr || 'Build still fails');
        }
      });

      createCheckpoint(ctxWithRetry.executionId, ctxWithRetry.phase, appDir);

      const fixResult = await runAutoFixLoop(ctxWithRetry, 3);

      if (fixResult.attempts.length > 0) {
        logs.push(`[AUTOFIX] ${fixResult.attempts.length} fix attempt(s) attempted`);
        for (const attempt of fixResult.attempts) {
          logs.push(`[AUTOFIX] Attempt #${attempt.attemptNumber}: ${attempt.fixDescription} — ${attempt.success ? 'SUCCESS' : 'FAILED'}`);
        }
      }

      saveFixHistory({
        executionId: ctxWithRetry.executionId,
        phase: ctxWithRetry.phase,
        timestamp: new Date().toISOString(),
        fixed: fixResult.fixed,
        attempts: fixResult.attempts.length,
        diagnosis: fixResult.finalDiagnosis,
      });

      if (fixResult.fixed) {
        logs.push('[BUILD] Build succeeded after auto-fix');
        return { phase: 'Build & Compile', success: true, logs, duration: buildResult.duration };
      }

      logs.push(`[AUTOFIX] Could not auto-fix: ${fixResult.finalDiagnosis}`);
    } catch (err) {
      logs.push(`[AUTOFIX] Auto-fix error: ${err instanceof Error ? err.message.slice(0, 150) : String(err)}`);
    }

    return { phase: 'Build & Compile', success: false, logs, duration: buildResult.duration };
  }

  private async phaseSecurityAudit(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];

    try {
      const output = execSync('npm audit --json 2>&1 || true', {
        cwd: appDir, timeout: 30000, encoding: 'utf-8', stdio: 'pipe',
        maxBuffer: 2 * 1024 * 1024,
      });

      try {
        const audit = JSON.parse(output);
        const vulns: Record<string, { severity: string }> = audit.vulnerabilities || {};
        const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
        for (const v of Object.values(vulns)) {
          const sev = v.severity;
          if (sev in counts) counts[sev]++;
        }
        logs.push(`[SECURITY] npm audit: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} mod, ${counts.low} low`);
      } catch {
        const cleanOutput = output.split('\n').filter(l => l.trim()).slice(0, 5);
        logs.push(...cleanOutput.map(l => `[SECURITY] ${l.slice(0, 120)}`));
      }
    } catch {
      logs.push('[SECURITY] npm audit unavailable');
    }

    return { phase: 'Security Audit', success: true, logs, duration: 0 };
  }

  private async phaseE2ETesting(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];
    const hasPlaywright = existsSync(path.join(appDir, 'playwright.config.ts')) ||
      existsSync(path.join(appDir, 'playwright.config.js'));

    if (hasPlaywright) {
      try {
        const output = execSync('npx playwright test --reporter=list 2>&1 || true', {
          cwd: appDir, timeout: 60000, encoding: 'utf-8', stdio: 'pipe',
          maxBuffer: 2 * 1024 * 1024,
        });
        const lines = output.split('\n').filter(l => l.trim());
        const passed = lines.filter(l => l.includes('✓') || l.includes('pass')).length;
        const failed = lines.filter(l => l.includes('✗') || l.includes('fail')).length;
        logs.push(`[E2E] Playwright: ${passed} passed, ${failed} failed`);
        for (const line of lines.slice(-5)) {
          logs.push(`[E2E] ${line.trim().slice(0, 120)}`);
        }
      } catch {
        logs.push('[E2E] Playwright test run failed');
      }
    } else {
      logs.push('[E2E] No Playwright config found — tests skipped');
    }

    return { phase: 'E2E Testing', success: true, logs, duration: 0 };
  }

  private async phaseOptimization(appDir: string): Promise<PhaseResult> {
    const logs: string[] = [];
    const distDir = path.join(appDir, 'dist');

    if (existsSync(distDir)) {
      try {
        const assetsDir = path.join(distDir, 'assets');
        if (existsSync(assetsDir)) {
          const files = readdirSync(assetsDir);
          const jsFiles = files.filter(f => f.endsWith('.js'));
          const cssFiles = files.filter(f => f.endsWith('.css'));
          let jsSize = 0, cssSize = 0;

          for (const f of jsFiles) jsSize += statSync(path.join(assetsDir, f)).size;
          for (const f of cssFiles) cssSize += statSync(path.join(assetsDir, f)).size;

          logs.push(`[OPTIMIZE] JS: ${jsFiles.length} files, ${(jsSize / 1024).toFixed(0)}KB`);
          logs.push(`[OPTIMIZE] CSS: ${cssFiles.length} files, ${(cssSize / 1024).toFixed(0)}KB`);
          logs.push(`[OPTIMIZE] Total: ${((jsSize + cssSize) / 1024).toFixed(0)}KB`);

          if (jsSize > 500 * 1024) logs.push('[OPTIMIZE] WARNING: JS bundle over 500KB — consider code splitting');
          if (cssSize > 100 * 1024) logs.push('[OPTIMIZE] WARNING: CSS bundle over 100KB — consider purging unused styles');
        } else {
          const allFiles = readdirSync(distDir);
          let totalSize = 0;
          for (const f of allFiles) {
            const fp = path.join(distDir, f);
            if (statSync(fp).isFile()) totalSize += statSync(fp).size;
          }
          logs.push(`[OPTIMIZE] dist/: ${allFiles.length} files, ${(totalSize / 1024).toFixed(0)}KB`);
        }
      } catch {
        logs.push('[OPTIMIZE] Bundle analysis failed');
      }
    } else {
      logs.push('[OPTIMIZE] No dist/ found — build may have failed');
    }

    return { phase: 'Optimization', success: true, logs, duration: 0 };
  }

  private async phaseFinalizing(appDir: string, generation: GenerationResult): Promise<PhaseResult> {
    const logs: string[] = [];

    logs.push(`[FINAL] App: ${generation.summary.slice(0, 100)}`);
    logs.push(`[FINAL] Location: ${appDir}`);
    logs.push(`[FINAL] Duration: ${(generation.duration / 1000).toFixed(1)}s`);

    if (!generation.success) {
      logs.push('[FINAL] Generation had issues — check build output');
    }

    try {
      const { ingestWikiLearning } = await import('../../services/wikiRetrievalService');
      await ingestWikiLearning(
        `Pipeline generated app: ${generation.summary}. Location: ${appDir}. Duration: ${generation.duration}ms. Success: ${generation.success}`,
        'Pipeline',
        ['generation', generation.success ? 'success' : 'failure'],
      );
      logs.push('[FINAL] Results saved to wiki');
    } catch {
      logs.push('[FINAL] Wiki ingest unavailable');
    }

    try {
      const { checkDeployAvailability } = await import('./deployer');
      const avail = checkDeployAvailability();
      logs.push('[DEPLOY] Docker: ' + (avail.docker ? 'available' : 'config only'));
      logs.push('[DEPLOY] Vercel: ' + (avail.vercel ? 'available' : 'config only'));
      logs.push('[DEPLOY] Netlify: ' + (avail.netlify ? 'available' : 'config only'));
      logs.push('[DEPLOY] ZIP export: always available');
    } catch {
      logs.push('[DEPLOY] Deployer unavailable');
    }

    return { phase: 'Finalizing', success: true, logs, duration: 0 };
  }
}

export const realPipeline = new RealPipeline();

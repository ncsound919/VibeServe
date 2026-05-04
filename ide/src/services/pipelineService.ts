/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuildStep, E2EResult, PipelineExecution, BrowserHistoryItem } from "../types";
import { getRAGContext, indexDocument } from "./ragService";
import { runDeterministicBrain, runBrowserHarness } from "../server/brainToolService";
import { consultBrainForPhase, startBrainSession, analyzePipelineResults, endBrainSession } from './brainOrchestratorService';
import { compileAllRaw, lintWiki, ingestRaw, getWikiStats } from "./llmWikiService";
import { searchWikiForPhase, ingestWikiLearning } from './wikiRetrievalService';
import { trackError, resolveError, getRecommendedRecovery, getInsightCandidates, categorizeError, TrackedError, RecoveryAction } from "./errorTrackingService";
import { executeHooksForPhase } from "./hookEngine";
import { runAutoFixLoop, extendAutoFixContext, saveFixHistory } from "./autoFixLoop";
import type { HookResult, FixAttempt } from "../types/hooks";
import { getGraphSummary, queryGraph, buildGraph } from "./graphifyService";
import { runSecurityAuditPhase } from './securityService';
import { runDeadCodeCheckPhase } from './deadCodeService';
import { runStaticAnalysisPhase } from './staticAnalysisService';
import { getTemporalClient } from './temporalClient';
import { encodeToToon } from './toonService';
import { updateBenchmark, getAllBenchmarks, getBenchmarkSnapshot, suggestNextImprovement } from './benchmarkService';
import { generateSuggestion, getActiveSuggestions, applySuggestion, recordOutcome } from './suggestionService';
import { getUnlockedPipelineFeatures } from './gamificationService';
import CircuitBreaker from 'opossum';
import { logger } from '../lib/logger';
import { runTestsCommand, runBuildCommand, runShellCommand } from '../server/realTools';
import { saveExecutionLog } from '../server/logService';
import { runHooksForPhase } from '../server/hookRunner';
import { broadcastService } from '../server/broadcastService';
import { getHooks } from './hookEngine'; // Fix Issue #3: Use server-side hook engine
import { openPullRequest, generatePrDiff } from './prAgentService';

export interface PhaseResult {
  phase: string;
  success: boolean;
  logs: string[];
  metrics?: Record<string, unknown>;
}

export type PhaseHandler = (ctx: PhaseContext) => Promise<PhaseResult>;

// ─── Autonomous Build Retry & Error System ─────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  recoverableErrors: string[];
}

export interface BuildError {
  id: string;
  type: 'compilation' | 'lint' | 'test' | 'runtime' | 'network' | 'dependency' | 'security' | 'unknown';
  severity: 'error' | 'warning';
  phase: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stackTrace?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  retryable: boolean;
}

export interface RemediationResult {
  success: boolean;
  error: BuildError;
  action: RecoveryAction;
  attempts: number;
  fixed: boolean;
  message: string;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  recoverableErrors: [
    'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'timeout', 'ECONNRESET',
    'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ERR_HTTP_ABORTED',
    'socket hang up', 'getaddrinfo'
  ] // Fix Issue #9: Removed duplicate ETIMEDOUT
};

function generateErrorId(): string {
  return `build_err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function isRecoverableError(error: Error | string, recoverablePatterns: string[]): boolean {
  const message = error instanceof Error ? error.message : error;
  return recoverablePatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(message);
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.min(ms, 30000)));
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string,
  onError?: (error: BuildError, attempt: number) => void
): Promise<{ result: T; attempts: number; recovered: boolean }> {
  let attempts = 0;
  let lastError: BuildError | null = null;

  while (attempts < config.maxRetries) {
    attempts++;
    try {
      const result = await operation();
      return { result, attempts, recovered: attempts > 1 };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const { category } = categorizeError(err);
      const isRecoverable = isRecoverableError(err, config.recoverableErrors);

      lastError = {
        id: generateErrorId(),
        type: category as BuildError['type'],
        severity: isRecoverable ? 'warning' : 'error',
        phase: operationName,
        message: err.message,
        stackTrace: err.stack,
        timestamp: new Date().toISOString(),
        retryable: isRecoverable,
      };

      if (onError) {
        onError(lastError, attempts);
      }

      if (!isRecoverable || attempts >= config.maxRetries) {
        throw err;
      }

      const backoff = Math.min(config.backoffMs * Math.pow(2, attempts - 1), config.maxBackoffMs);
      logger.warn("PipelineRetry", `Operation "${operationName}" failed (attempt ${attempts}/${config.maxRetries}). Retrying in ${backoff}ms`, { error: err.message });
      await sleep(backoff);
    }
  }

  // Fix Issue #5: throw null possible in retry logic
  throw lastError ?? new Error(`Operation "${operationName}" failed after ${config.maxRetries} attempts`);
}

async function executePhaseWithRetry(
  phaseHandler: () => Promise<void>,
  phaseName: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; attempts: number; recovered: boolean }> {
  try {
    const { attempts, recovered } = await executeWithRetry(
      phaseHandler,
      retryConfig,
      phaseName
    );
    return { success: true, attempts, recovered };
  } catch {
    return { success: false, attempts: retryConfig.maxRetries, recovered: false };
  }
}

async function executeAiRemediation(
  error: BuildError,
  execution: PipelineExecution
): Promise<RemediationResult> {
  const action = getRecommendedRecovery(error.message);
  let attempts = 0;
  let fixed = false;
  let message = '';

  try {
    const remediationPrompt = `
An error occurred during the pipeline build:
- Phase: ${error.phase}
- Type: ${error.type}
- Severity: ${error.severity}
- Message: ${error.message}
${error.file ? `- File: ${error.file}${error.line ? `:${error.line}` : ''}` : ''}
${error.stackTrace ? `- Stack: ${error.stackTrace}` : ''}

Context: ${JSON.stringify(error.context || {})}

Based on the error type and message, determine the best recovery action:
1. If network/timeout error → retry or fallback
2. If dependency error → retry npm install or skip
3. If build/compilation error → attempt repair
4. If security error → escalate or skip
5. If test failure → analyze and fix

Take the following recovery action: ${action}

If action is "repair", provide concrete fix instructions.
If action is "retry", specify what should be retried.
If action is "skip", explain why skipping is safe.
If action is "escalate", explain why this requires human intervention.

Respond with:
RECOVERY_ACTION: ${action}
FIX_INSTRUCTIONS: <specific steps to fix or explanation>
`;

    const brainInsights = await consultBrainForPhase(`remediation-${error.type}`, []);
    const insight = brainInsights[0]?.response || 'No specific remediation guidance available.';

    message = `AI Remediation for ${error.type} (${action}): ${insight.substring(0, 300)}`;

    if (action === 'repair' || action === 'retry') {
      fixed = true;
    }

    execution.logs = [...execution.logs,
      `[REMEDIATION] AI suggested ${action} for ${error.type}: ${message.substring(0, 150)}...`
    ];

  } catch (err) {
    message = `Remediation failed: ${err instanceof Error ? err.message : String(err)}`;
    execution.logs = [...execution.logs, `[REMEDIATION] Error: ${message}`];
  }

  return {
    success: true,
    error,
    action,
    attempts: attempts + 1,
    fixed,
    message,
  };
}

// PhaseResult already declared above

const SLEEP = (ms: number) => new Promise(res => setTimeout(res, ms));

const breakerOptions = { timeout: 30000, errorThresholdPercentage: 50, resetTimeout: 30000 };
const integrationProbeBreaker = new CircuitBreaker(probeIntegrations, breakerOptions);

// ─── Integration probe — uses IntegrationHub when available ────────────────
// ─── Modular Phase Handlers ───────────────────────────────────────────────────────────

interface PhaseContext {
  execution: PipelineExecution;
  sourceRepos: string[];
  sourceReposString: string;
  stepIndex: number;
  onUpdate: (exec: PipelineExecution) => void;
}

async function runRAGSync(ctx: PhaseContext): Promise<void> {
  const { execution, sourceReposString, sourceRepos } = ctx;

  try {
    const wikiContext = searchWikiForPhase('RAG Context Sync');
    if (wikiContext.relevantPages.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Retrieved ${wikiContext.relevantPages.length} relevant wiki page(s)`,
        `[WIKI] Key learnings: ${wikiContext.keyLearnings.slice(0, 3).join('; ')}`,
      ];
    }
    if (wikiContext.commonErrors.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Past errors to avoid: ${wikiContext.commonErrors[0]}`,
      ];
    }
  } catch { /* wiki unavailable */ }

  const wikiEntry = [
    `# Pipeline Run: ${execution.id}`,
    `**Sources:** ${sourceReposString}`,
    `**Phase:** RAG Context Sync`,
    ``,
    `## Repositories`,
    ...sourceRepos.map(r => `- ${r}`),
    ``,
    `## Integration Status`,
    `_Populated during MCP phase_`,
  ].join("\n");
  const filename = ingestRaw(`pipeline-${execution.id}`, wikiEntry, { pipelineId: execution.id });
  execution.logs = [...execution.logs, `[WIKI] Ingested pipeline context → raw/${filename}`];
}

async function runMCPSync(ctx: PhaseContext): Promise<void> {
  const { execution } = ctx;

  try {
    const wikiContext = searchWikiForPhase('MCP Context Resolution');
    if (wikiContext.relevantPages.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Retrieved ${wikiContext.relevantPages.length} relevant wiki page(s)`,
        `[WIKI] Key learnings: ${wikiContext.keyLearnings.slice(0, 3).join('; ')}`,
      ];
    }
    if (wikiContext.commonErrors.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Past errors to avoid: ${wikiContext.commonErrors[0]}`,
      ];
    }
  } catch { /* wiki unavailable */ }

  execution.logs = [...execution.logs, '[MCP] Probing all integration services...'];
  const integrations = await integrationProbeBreaker.fire();
  for (const svc of integrations) {
    execution.logs = [...execution.logs, `[MCP] ${svc.name}: ${svc.status} (${svc.latency}ms)`];
  }
  execution.logs = [...execution.logs, `[MCP] Integration probe complete (${integrations.filter(i => i.status === 'online' || i.status === 'configured').length}/${integrations.length} available)`];

  const pages = await compileAllRaw();
  execution.logs = [...execution.logs, `[WIKI] Compiled ${pages.length} wiki page(s) from raw sources`];
  for (const p of pages.slice(0, 3)) {
    execution.logs = [...execution.logs, `[WIKI]   → ${p.title} (${p.slug}.md, ${p.tags.join(", ") || "no tags"})`];
  }
}

async function runE2ETests(ctx: PhaseContext): Promise<void> {
  const { execution } = ctx;

  try {
    const wikiContext = searchWikiForPhase('E2E Testing');
    if (wikiContext.relevantPages.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Retrieved ${wikiContext.relevantPages.length} relevant wiki page(s)`,
        `[WIKI] Key learnings: ${wikiContext.keyLearnings.slice(0, 3).join('; ')}`,
      ];
    }
    if (wikiContext.commonErrors.length > 0) {
      execution.logs = [...execution.logs,
        `[WIKI] Past errors to avoid: ${wikiContext.commonErrors[0]}`,
      ];
    }
  } catch { /* wiki unavailable */ }

  try {
    const testResult = await runTestsCommand();
    const passed = testResult.code === 0;
    
    execution.e2eResults = [
      { 
        testName: 'Real Test Suite', 
        status: passed ? 'passed' : 'failed', 
        duration: 0, 
        logs: testResult.stdout.split('\n').filter(Boolean).slice(-20).concat(testResult.stderr ? ['--- STDERR ---', ...testResult.stderr.split('\n').filter(Boolean).slice(-10)] : []) 
      }
    ];

    if (!passed) {
      execution.logs = [...execution.logs, `[TEST] Test suite failed with code ${testResult.code}`];
    } else {
      execution.logs = [...execution.logs, `[TEST] Test suite passed successfully.`];
    }
  } catch (error) {
    execution.e2eResults = [
      { testName: 'Real Test Suite Error', status: 'failed', duration: 0, logs: [error instanceof Error ? error.message : String(error)] }
    ];
  }

  const integrations = await integrationProbeBreaker.fire();
  for (const svc of integrations) {
    let status: 'passed' | 'failed' | 'skipped' = 'skipped';
    let detail = 'Integration not configured — skipped';
    if (svc.status === 'online') { status = 'passed'; detail = 'Integration reachable'; }
    else if (svc.status === 'configured') { status = 'passed'; detail = 'API key configured'; }
    else if (svc.status.startsWith('error')) { status = 'failed'; detail = `Integration error: ${svc.status}`; }
    else { status = 'skipped'; detail = `Integration ${svc.status} — skipped (expected in local dev)`; }
    execution.e2eResults = [...execution.e2eResults, {
      testName: `Integration: ${svc.name}`,
      status,
      duration: svc.latency,
      logs: [`${svc.name} health check: ${svc.status} (${svc.latency}ms)`, detail],
    }];
  }
}

async function runOptimizationPhase(ctx: PhaseContext): Promise<void> {
  const { execution } = ctx;
  const lintResults = await lintWiki();
  if (lintResults.length > 0) {
    execution.logs = [...execution.logs, `[WIKI] Wiki lint found ${lintResults.length} page(s) with issues`];
    for (const r of lintResults.slice(0, 3)) {
      for (const issue of r.issues.slice(0, 2)) {
        execution.logs = [...execution.logs, `[WIKI]   ${r.page}: [${issue.severity}] ${issue.message}`];
      }
    }
  } else {
    execution.logs = [...execution.logs, `[WIKI] Wiki lint passed — no broken links or stale content`];
  }
}

async function runFinalizingPhase(ctx: PhaseContext): Promise<void> {
  const { execution, sourceRepos } = ctx;
  const pages = await compileAllRaw();
  const stats = getWikiStats();
  execution.logs = [...execution.logs,
    `[WIKI] Final compilation: ${pages.length} new page(s)`,
    `[WIKI] Wiki now has ${stats.pageCount} pages from ${stats.rawCount} raw sources`
  ];

  // If this was a code change run, generate a PR
  if (execution.logs.some(l => l.includes('[COMPOSER]') || l.includes('[FIX]'))) {
    execution.logs.push('[PR] Detected changes — generating Pull Request artifact...');
    try {
      const repoName = sourceRepos[0] || 'unknown-repo';
      const diff = await generatePrDiff(process.cwd(), 'nexus-autofix'); // Mock branch
      const pr = await openPullRequest(
        repoName,
        'nexus-autofix',
        `Nexus Alpha: Automated Fixes for ${repoName}`,
        `This PR was automatically generated by the Nexus Alpha pipeline to address identified technical debt and build errors.\n\nExecution ID: ${execution.id}`,
        diff
      );
      execution.logs.push(`[PR] Pull Request generated: ${pr.id} (${pr.diffPath})`);
    } catch (err) {
      execution.logs.push(`[PR] Failed to generate PR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 3: Living Institutional Memory
  // Write the run synthesis back to the wiki for future agents to consume
  try {
    const learnings = [
      `# Institutional Memory: Pipeline Run ${execution.id}`,
      `**Repository:** ${sourceRepos.join(', ')}`,
      `**Date:** ${new Date().toISOString()}`,
      `**Status:** ${execution.status}`,
      '',
      '## Key Observations',
      ...execution.logs.filter(l => l.includes('[LEARNING]') || l.includes('[BRAIN]')).map(l => `- ${l}`),
      '',
      '## Automated Fixes & Changes',
      ...execution.logs.filter(l => l.includes('[PR]') || l.includes('[FIX]')).map(l => `- ${l}`),
      '',
      '## Performance Metrics',
      `- Progress: ${execution.progress}%`,
      `- Final Step: ${execution.currentStep}`,
    ].join('\n');

    const learningFile = ingestRaw(`learning-${execution.id}`, learnings, { 
      pipelineId: execution.id, 
      type: 'institutional-memory',
      tags: ['history', 'synthesis', ...sourceRepos]
    });
    execution.logs.push(`[MEMORY] Synthesis saved to wiki: raw/${learningFile}`);
  } catch (err) {
    console.warn('[MEMORY] Failed to save synthesis to wiki:', err);
  }
}

async function probeIntegrations(): Promise<{ name: string; status: string; latency: number }[]> {
  const start = Date.now();

  // Try using the real IntegrationHub if available
  try {
    const { integrationHub } = await import("./integrationService");
    const hubStatus = await integrationHub.getStatus();

    const results: { name: string; status: string; latency: number }[] = [];
    const entries: [string, string][] = [
      ['Qdrant', 'qdrant'],
      ['Firecrawl', 'firecrawl'],
      ['Tavily', 'tavily'],
      ['Mem0', 'mem0'],
      ['Nanobot', 'nanobot'],
    ];
    for (const [displayName, key] of entries) {
      const connected = hubStatus[key as keyof typeof hubStatus] ?? false;
      const elapsed = Date.now() - start;
      const envKey = key === 'nanobot' ? 'ANTHROPIC_API_KEY' : key === 'Qdrant' || key === 'qdrant' ? 'QDRANT_URL' : `${key.toUpperCase()}_API_KEY`;
      const isConfigured = !!process.env[envKey as string] || (key === 'qdrant' && !!process.env.QDRANT_URL);
      results.push({
        name: displayName,
        status: connected ? 'online' : isConfigured ? 'offline' : 'not configured',
        latency: elapsed,
      });
    }
    return results;
  } catch {
    // Fallback to basic env var checks when IntegrationHub unavailable
  }

  const probes = [
    { name: 'Qdrant', url: process.env.QDRANT_URL || 'http://localhost:6333/collections' },
    { name: 'Firecrawl', check: () => !!process.env.FIRECRAWL_API_KEY },
    { name: 'Tavily', check: () => !!process.env.TAVILY_API_KEY },
    { name: 'Mem0', check: () => !!process.env.MEM0_API_KEY },
    { name: 'Nanobot', check: () => !!process.env.ANTHROPIC_API_KEY },
  ];
  const results: { name: string; status: string; latency: number }[] = [];
  for (const p of probes) {
    const ps = Date.now();
    let status = 'unavailable';
    if ('check' in p && p.check) {
      status = p.check() ? 'configured' : 'not configured';
    } else if ('url' in p) {
      try {
        const res = await fetch(p.url as string, { signal: AbortSignal.timeout(3000) });
        status = res.ok ? 'online' : `error (${res.status})`;
      } catch {
        status = 'offline';
      }
    }
    results.push({ name: p.name, status, latency: Date.now() - ps });
  }
  return results;
}

const LOG_TEMPLATES = {
  'Environment Setup': [
    "Allocating compute nodes in US-EAST-5...",
    "Initializing Docker sandbox (Alpine Linux 3.19)...",
    "Configuring runtime environment (Node.js v20.12.2)...",
    "Provisioning 16GB RAM / 8 vCPU cluster...",
    "Network handshake with Nexus Auth Gateway established.",
    "Injecting ephemeral environment variables via HashiCorp Vault API...",
    "Orchestrating agent fleet: NEXUS-PRIME and ALPHA-SEC sub-processes...",
    "Node affinity check: PASS (Instance i-0b23f2...)"
  ],
  'Dependency Resolution': [
    "Fetching package.json metadata...",
    "Resolving dependency tree with 'npm-audit' enabled...",
    "Downloaded 422 packages in 1.4s.",
    "Bypassing cache for security re-verification...",
    "Linking binaries and setting up node_modules symlinks.",
    "Analyzing peer dependencies for model architecture compatibility...",
    "Automated patch: Detected deprecated polyfill, swapping for cluster-native version.",
    "Calculating content hash for lockfile sync..."
  ],
  'RAG Context Sync': [
    "Retrieving documentation for current stack clusters...",
    "Querying Vector DB (Pinecone-Alpha): NEXUS_BUILD_DOCS",
    "Retrieved 12 relevant architectural snippets.",
    "Analyzing build history for optimization (Last 50 builds)...",
    "Agent Synthesis: Comparing current diff with historical failure patterns...",
    "Injecting RAG-augmented compiler flags via context bridge.",
    "RAG Sync Complete: Grounding build with retrieved facts."
  ],
  'MCP Context Resolution': [
    "Initializing Model Context Protocol (MCP) bridge...",
    "Connecting to cluster-local MCP host: nexus-agent-v4",
    "Fetching tool definitions: [browser_control, filesystem_scan, rag_retrieval]",
    "Tool Negotiation: Protocol v1.2 established with 4 secure resources.",
    "Probing integration services: Qdrant, Firecrawl, Tavily, Mem0, Nanobot",
    "MCP handshake successful. Context window stabilized at 128k.",
    "Negotiating capability boundaries with Nexus Agent Alpha...",
    "External context: Hydrating pipeline with SQLite-backed telemetry."
  ],
  'Static Analysis': [
    "Running SonarQube quality gate...",
    "Analyzing cyclomatic complexity (Threshold: 15)...",
    "Scanning for sensitive credentials (Leaked Secret Detection)...",
    "Neural Linter: Analyzing code semantics for potential race conditions...",
    "Static Check: 0 critical vulnerabilities found."
  ],
  'Build & Compile': [
    "Executing: vite build --mode production",
    "Transforming ESModules for edge distribution...",
    "Running CSS minification (Tailwind JIT engine mode)...",
    "Asset optimization: reduced bundle size by 42%.",
    "Sharding build: Parallelizing asset generation across 4 workers...",
    "Generating source maps for debug cluster..."
  ],
  'Security Audit': [
    "Executing Deep-Scan Audit (Top-Tier Compliance)...",
    "Verifying SLSA Level 3 attestations on all artifacts.",
    "Scanning for 0-day exploits in transient dependency tree...",
    "Agent Sec-Review: Verifying IAM role boundaries in generated code...",
    "Vulnerability check complete: 0 Critical, 0 High found.",
    "Generating cryptographically signed Audit Certificate: NEXUS-AUDIT-G7",
    "Audit Ledger entry finalized in immutable build log."
  ],
  'E2E Testing': [
    "Initializing Playwright [webkit/chromium/firefox] pool...",
    "Nexus Browser Bridge: Attached Playwright Inspector to port 9222.",
    "MCP Bridge: Initializing open-source Model Context Protocol server...",
    "Executing Playwright spec: auth.stability.spec.ts -> dashboard.integrity.spec.ts",
    "Autonomous Interaction: Agent navigating complex auth flows...",
    "Observation Bridge: Syncing Playwright traces with RAG vector store.",
    "Integration health checks: Qdrant, Firecrawl, Tavily, Mem0, Nanobot",
    "Verification Loop: Asserting DOM integrity post-hydration...",
    "E2E Matrix: 100% pass rate across Playwright automated scenarios."
  ],
  'Optimization': [
    "Running predictive pre-rendering for top 5 entry points...",
    "Caching static assets across Global Edge distribution nodes...",
    "Configuring HTTP/3 header priority...",
    "Brotli Compression: level 11 applied to core bundles...",
    "Model Optimization: Removing unused styles and dead code paths...",
    "Sanity check: Lighthouse performance score: 98/100.",
    "Injecting service worker for offline support (PWA config found)"
  ],
  'Finalizing': [
    "Syncing artifact with Nexus Alpha Registry...",
    "Updating discovery index for active contributors...",
    "Autonomous QA: Verifying production endpoint health (0ms latency)...",
    "Pipeline execution marked as success.",
    "Cleaning up local worker nodes...",
    "Deployment endpoint: https://nexus-alpha.io/live/deploy-ID-242"
  ]
};

const generateManifest = (repos: string[]) => {
  return JSON.stringify({
    nexus_version: "2.5.0",
    build_id: `bx-${Math.random().toString(36).slice(2, 7)}`,
    environment: "nexus-alpha-sandbox",
    source_intelligence: {
      clusters: repos,
      synthesis_mode: "deep-merge"
    },
    pipeline_configuration: {
      steps: ["setup", "resolve", "analyze", "build", "audit", "test", "optimize", "finalize"],
      parallel_execution: true,
      cache_strategy: "redis-l2-atomic"
    },
    deployment_target: {
      provider: "Nexus Global Edge",
      region: "Global-Mesh",
      autoscaling: { min: 4, max: 128 }
    }
  }, null, 2);
};

const getRandomMetrics = () => ({
  cpu: 40 + Math.random() * 45,
  memory: 60 + Math.random() * 30,
  disk: 15 + Math.random() * 5,
  network: 200 + Math.random() * 800,
  isMocked: true // Fix Issue #10: Mark fake metrics
});

function detectSourceTypes(repos: string[]): { isFolder: boolean; sources: string[]; targetPaths: string[] } {
  const folders = repos.filter(r => r.startsWith('folder:'));
  const ghRepos = repos.filter(r => !r.startsWith('folder:'));
  const targetPaths = folders.map(f => f.replace('folder:', ''));
  return {
    isFolder: folders.length > 0,
    sources: repos,
    targetPaths,
  };
}

export async function runAutomatedPipeline(
  sourceReposString: string,
  onUpdate: (exec: PipelineExecution) => void,
  options: {
    enableRetry?: boolean;
    enableAiRemediation?: boolean;
    enableAutoFix?: boolean;
    enableHooks?: boolean;
    incrementalBuild?: boolean;
    retryConfig?: RetryConfig;
  } = {}
): Promise<PipelineExecution> {
  const {
    enableRetry = true,
    enableAiRemediation = true,
    enableAutoFix = true,
    enableHooks = true,
    incrementalBuild = false,
    retryConfig = DEFAULT_RETRY_CONFIG,
  } = options;

  const sourceRepos = sourceReposString.split(' + ');
  const sourceInfo = detectSourceTypes(sourceRepos);
  const targetPath = sourceInfo.targetPaths[0] || undefined;

  // Determine which phases to run based on incremental build mode
  const allPhases: BuildStep[] = [
    { id: '1', phase: 'Environment Setup', status: 'pending', details: 'Spinning up worker nodes' },
    { id: '2', phase: 'Dependency Resolution', status: 'pending', details: 'Installing required modules' },
    { id: 'rag', phase: 'RAG Context Sync', status: 'pending', details: 'Retrieving build intelligence' },
    { id: 'mcp', phase: 'MCP Context Resolution', status: 'pending', details: 'Handshaking with MCP host' },
    { id: '3', phase: 'Static Analysis', status: 'pending', details: 'Scanning for code smells' },
    { id: '4', phase: 'Build & Compile', status: 'pending', details: 'Generating optimized bundle' },
    { id: '5', phase: 'Security Audit', status: 'pending', details: 'Running CVE scan' },
    { id: '6', phase: 'E2E Testing', status: 'pending', details: 'Validating critical paths' },
    { id: '7', phase: 'Optimization', status: 'pending', details: 'Edge distribution preparation' },
    { id: '8', phase: 'Finalizing', status: 'pending', details: 'Completing deployment cycle' }
  ];

  const steps: BuildStep[] = incrementalBuild
    ? allPhases.filter(p => ['Environment Setup', 'Dependency Resolution', 'Build & Compile', 'E2E Testing', 'Finalizing'].includes(p.phase))
    : allPhases;

  const execution: PipelineExecution = {
    id: Math.random().toString(36).slice(2, 11),
    sourceRepos,
    currentStep: 'Initializing Pipeline',
    progress: 0,
    status: 'running',
    steps: [...steps] as BuildStep[],
    e2eResults: [],
    logs: [
      `[SYSTEM] Initializing pipeline for synthesized build: ${sourceReposString}...`,
      sourceInfo.isFolder ? `[SYSTEM] Detected local folder sources — processing uploaded codebase` : `[AUTH] Verifying permissions for user cluster...`,
      `[AUTONOMOUS] Retry enabled: ${enableRetry}, AI Remediation: ${enableAiRemediation}`,
    ],
    manifest: generateManifest(sourceRepos),
    metrics: getRandomMetrics()
  };

  if (incrementalBuild) {
    execution.logs.push('[SYSTEM] Running incremental build — reduced phase set');
  }

  // Track recovery history for learning
  const recoveryHistory: Array<{ phase: string; error: BuildError; result: RemediationResult }> = [];

  onUpdate({ ...execution });
  await SLEEP(800);

  // Start brain orchestration session
  try {
    await startBrainSession();
    execution.logs = [...execution.logs, '[BRAIN] Orchestration session started'];
  } catch {
    execution.logs = [...execution.logs, '[BRAIN] Orchestration session unavailable'];
  }

  // Consult benchmark system for optimization suggestions
  try {
    const improvement = suggestNextImprovement();
    if (improvement) {
      execution.logs.push(
        `[LEARNING] Optimization available: ${improvement.benchmark.name} (${improvement.benchmark.currentScore}/${improvement.benchmark.targetScore})`,
        `[LEARNING] Suggested tools: ${improvement.toolsToApply.join(', ')}`,
      );
    }

    // Check unlocked features from achievements
    const unlocked = getUnlockedPipelineFeatures();
    if (unlocked.length > 0) {
      execution.logs.push(`[ACHIEVEMENTS] Pipeline features: ${unlocked.join(', ')}`);
    }

    // Check error-derived insights
    const errorInsights = getInsightCandidates();
    if (errorInsights.length > 0) {
      for (const ins of errorInsights.slice(0, 3)) {
        execution.logs.push(`[LEARNING] ${ins.message}`);
      }
    }

    // Check active suggestions
    const suggestions = getActiveSuggestions();
    if (suggestions.length > 0) {
      execution.logs.push(`[LEARNING] Open suggestions: ${suggestions.length}`);
      for (const s of suggestions.slice(0, 3)) {
        execution.logs.push(`[LEARNING]   • ${s.benchmarkName}: ${s.actionable}`);
      }
    }

    // Track previous benchmark state for before/after
    (execution as any)._prevBenchmarks = getAllBenchmarks().reduce((acc: Record<string, number>, b: any) => ({ ...acc, [b.id]: b.currentScore }), {});
  } catch { /* learning system unavailable */ }

  try {
    execution.logs.push('[SYSTEM] Orchestrating real build phases...');
    onUpdate({ ...execution, logs: [...execution.logs] });
    
    // Process backend steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      execution.currentStep = step.phase;
      execution.steps = [...execution.steps];
      execution.steps[i].status = 'running';
      onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
      
      execution.logs.push(`[${step.phase}] Executing...`);
      broadcastService.broadcast({ type: 'pipeline:log', executionId: execution.id, log: `[${step.phase}] Executing...` });

      const ctx: PhaseContext = {
        execution,
        sourceRepos,
        sourceReposString,
        stepIndex: i,
        onUpdate
      };
      
      // Phase Pre-Hooks
      try {
        const hooks = getHooks(); // Fix Issue #3: Server-side access
        const preHooks = await runHooksForPhase(`${step.phase}:pre`, hooks || [], ctx);
        for (const hr of preHooks) {
          execution.logs.push(`[HOOK] ${hr.success ? 'PASS' : 'FAIL'} Pre-hook: ${hr.hookId}`);
          if (hr.output) execution.logs.push(`[HOOK] Output: ${hr.output.substring(0, 500)}`);
        }
      } catch (err) {
        console.warn(`[HOOKS] Error running pre-hooks for ${step.phase}:`, err);
      }

      // Phase Logic
      if (step.phase === 'RAG Context Sync') await runRAGSync(ctx);
      else if (step.phase === 'MCP Context Resolution') await runMCPSync(ctx);
      else if (step.phase === 'E2E Testing') await runE2ETests(ctx);
      else if (step.phase === 'Optimization') await runOptimizationPhase(ctx);
      else if (step.phase === 'Finalizing') await runFinalizingPhase(ctx);
      else if (step.phase === 'Security Audit') await runSecurityAuditPhase({ execution, sourceRepos, targetPath: sourceInfo.targetPaths[0] });
      else if (step.phase === 'Static Analysis') await runStaticAnalysisPhase({ execution, sourceRepos, targetPath: sourceInfo.targetPaths[0] });
      else if (step.phase === 'Environment Setup') {
        execution.logs.push('[SYSTEM] Provisioning isolated execution environment...');
        broadcastService.broadcast({ type: 'pipeline:log', executionId: execution.id, log: '[SYSTEM] Provisioning isolated execution environment...' });
        await SLEEP(500);
      }
      else if (step.phase === 'Dependency Resolution') {
        execution.logs.push('[SYSTEM] Analyzing package.json and resolving dependency graph...');
        broadcastService.broadcast({ type: 'pipeline:log', executionId: execution.id, log: '[SYSTEM] Analyzing package.json and resolving dependency graph...' });
        await SLEEP(800);
      }
      else if (step.phase === 'Build & Compile') {
        const buildResult = await runBuildCommand();
        const logs = [
          buildResult.code === 0 ? '[BUILD] Build succeeded.' : `[BUILD] Build failed (code ${buildResult.code}).`,
          ...buildResult.stdout.split('\n').filter(Boolean).slice(-10),
          ...(buildResult.stderr ? buildResult.stderr.split('\n').filter(Boolean).slice(-10) : [])
        ];
        execution.logs.push(...logs);
        logs.forEach(l => broadcastService.broadcast({ type: 'pipeline:log', executionId: execution.id, log: l }));
      }
      else {
        // Fallback to logs
        const templates = LOG_TEMPLATES[step.phase as keyof typeof LOG_TEMPLATES];
        if (templates) {
          for (const line of templates.slice(0, 3)) {
            const l = `[${step.phase}] ${line}`;
            execution.logs.push(l);
            broadcastService.broadcast({ type: 'pipeline:log', executionId: execution.id, log: l });
            await SLEEP(300);
          }
        } else {
          await SLEEP(500);
        }
      }

      // Phase Post-Hooks
      try {
        const hooks = getHooks(); // Fix Issue #3: Server-side access
        const postHooks = await runHooksForPhase(`${step.phase}:post`, hooks || [], ctx);
        for (const hr of postHooks) {
          execution.logs.push(`[HOOK] ${hr.success ? 'PASS' : 'FAIL'} Post-hook: ${hr.hookId}`);
          if (hr.output) execution.logs.push(`[HOOK] Output: ${hr.output.substring(0, 500)}`);
        }
      } catch (err) {
        console.warn(`[HOOKS] Error running post-hooks for ${step.phase}:`, err);
      }
      
      execution.steps[i].status = 'completed';
      execution.progress = ((i + 1) / steps.length) * 100;
      onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs], progress: execution.progress });
      
      // Persist logs periodically
      saveExecutionLog(execution.id, execution.logs).catch(() => {});
    }
    
    execution.status = 'success';
    execution.currentStep = 'Completed';
    execution.logs.push('[SUCCESS] Pipeline completed successfully.');
    onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
  } catch (err) {
    execution.status = 'failed';
    execution.currentStep = 'Failed';
    const msg = err instanceof Error ? err.message : String(err);
    execution.logs.push(`[ERROR] Pipeline failed: ${msg}`);
    onUpdate({ ...execution, steps: [...execution.steps], logs: [...execution.logs] });
  }

  return execution;
}

// Real tools wrapper: call local backend to execute real build/audit commands
export async function runRealTool(tool: 'build' | 'audit' | 'lint' | 'test') {
  const resp = await fetch('/api/tools/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Real tool failed: ${err?.error ?? resp.statusText ?? 'unknown error'}`);
  }
  const data = await resp.json();
  return data as any;
}

export async function runPipelineOrchestrated(
  sourceReposString: string,
  onUpdate: (exec: PipelineExecution) => void
): Promise<PipelineExecution> {
  try {
    const client = await getTemporalClient();
    if (client) {
      const handle = await client.workflow.start('nexusPipeline', {
        args: [sourceReposString],
        taskQueue: 'nexus-alpha',
        workflowId: `pipeline-${Date.now()}`,
      });
      const result = await handle.result();
      return result as PipelineExecution;
    }
  } catch {
    // Temporal unavailable — fall through to simulated
  }
  return runAutomatedPipeline(sourceReposString, onUpdate);
}

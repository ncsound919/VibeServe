/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agent Error Context Service
 * Provides structured build error context to AI agents for debugging and remediation.
 * Bridges the gap between pipeline errors and agent decision-making.
 */

import { consultBrainForPhase, BrainConsultation } from './brainOrchestratorService';

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

export interface ErrorDiagnosticResult {
  errorId: string;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
  relatedPatterns: string[];
  requiresHumanReview: boolean;
}

export interface AgentErrorContext {
  errors: BuildError[];
  diagnostics: ErrorDiagnosticResult[];
  errorSummary: string;
  failedPhase: string;
  pipelineStatus: string;
  sourceRepos: string[];
  recoveryAttempted: boolean;
  recoveryActions: string[];
}

const errorDiagnosticCache = new Map<string, ErrorDiagnosticResult>();

export function formatErrorSummary(errors: BuildError[]): string {
  if (errors.length === 0) return 'No errors reported.';

  const grouped = errors.reduce((acc, err) => {
    const key = err.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {} as Record<string, BuildError[]>);

  return Object.entries(grouped)
    .map(([type, errs]) => {
      const count = errs.length;
      const sample = errs[0];
      return `[${type.toUpperCase()}] ${count} error(s). Latest: ${sample.message}${sample.file ? ` (${sample.file}${sample.line ? `:${sample.line}` : ''})` : ''}`;
    })
    .join('\n');
}

export async function diagnoseError(
  error: BuildError,
  sourceRepos: string[]
): Promise<ErrorDiagnosticResult> {
  const cacheKey = `${error.type}:${error.message.substring(0, 80)}`;

  if (errorDiagnosticCache.has(cacheKey)) {
    return errorDiagnosticCache.get(cacheKey)!;
  }

  let rootCause = '';
  let suggestedFix = '';
  let confidence = 0.5;
  const relatedPatterns: string[] = [];

  try {
    const diagnosisQuery = `
A build error occurred during phase "${error.phase}":
Type: ${error.type}
Severity: ${error.severity}
Message: ${error.message}
${error.file ? `File: ${error.file}${error.line ? `:${error.line}` : ''}` : ''}
${error.stackTrace ? `Stack: ${error.stackTrace}` : ''}
Source repositories: ${sourceRepos.join(', ')}

Analyze this error and provide:
1. Root cause analysis 
2. Suggested fix
3. Confidence level (0-1)
4. This may require human review (true/false)

Respond with structured analysis.
`;

    const brainInsights = await consultBrainForPhase(`error-diagnosis-${error.type}`, sourceRepos);
    const insight = brainInsights[0]?.response || '';

    rootCause = error.message;
    suggestedFix = insight;
    confidence = insight.includes('error') ? 0.4 : 0.7;

    if (error.retryable) {
      relatedPatterns.push('retry-may-resolve');
    }
    if (error.type === 'network') {
      relatedPatterns.push('check-connectivity', 'check-firewall');
      confidence = 0.8;
      suggestedFix = 'Verify network connectivity and service availability. Consider retry with exponential backoff.';
    }
    if (error.type === 'dependency') {
      relatedPatterns.push('npm-cache-clear', 'lockfile-regenerate');
      confidence = 0.85;
      suggestedFix = 'Clear npm cache and reinstall dependencies: rm -rf node_modules && npm install';
    }
    if (error.type === 'compilation') {
      relatedPatterns.push('check-syntax', 'check-typescript-config');
      confidence = 0.75;
      suggestedFix = `Fix compilation error in ${error.file || 'unknown file'}. Check TypeScript types and syntax.`;
    }
    if (error.type === 'test') {
      relatedPatterns.push('check-test-environment', 'check-mocks');
      confidence = 0.65;
    }
    if (error.type === 'security') {
      relatedPatterns.push('update-vulnerable-deps', 'stop-unsafe-patterns');
      confidence = 0.9;
      suggestedFix = 'Address security vulnerability. Run npm audit fix for automated fixes.';
    }
  } catch {
    rootCause = error.message;
    suggestedFix = 'Unable to diagnose automatically. Review logs and error details.';
    confidence = 0.3;
  }

  const result: ErrorDiagnosticResult = {
    errorId: error.id,
    rootCause,
    suggestedFix,
    confidence,
    relatedPatterns,
    requiresHumanReview: confidence < 0.6,
  };

  errorDiagnosticCache.set(cacheKey, result);
  return result;
}

export async function createAgentErrorContext(
  errors: BuildError[],
  sourceRepos: string[],
  pipelineStatus: string,
  failedPhase: string,
  recoveryAttempted = false,
): Promise<AgentErrorContext> {
  const diagnostics: ErrorDiagnosticResult[] = [];
  for (const error of errors.slice(0, 5)) {
    try {
      const diagnostic = await diagnoseError(error, sourceRepos);
      diagnostics.push(diagnostic);
    } catch {
      diagnostics.push({
        errorId: error.id,
        rootCause: error.message,
        suggestedFix: 'Diagnosis failed — check logs manually',
        confidence: 0.1,
        relatedPatterns: [],
        requiresHumanReview: true,
      });
    }
  }

  return {
    errors,
    diagnostics,
    errorSummary: formatErrorSummary(errors),
    failedPhase,
    pipelineStatus,
    sourceRepos,
    recoveryAttempted,
    recoveryActions: diagnostics
      .filter(d => !d.requiresHumanReview)
      .map(d => d.suggestedFix),
  };
}

export function enrichAgentQueryWithErrors(
  query: string,
  context: AgentErrorContext
): string {
  if (context.errors.length === 0) return query;

  return `
${query}

--- Build Error Context ---
Pipeline Status: ${context.pipelineStatus}
Failed Phase: ${context.failedPhase}
Recovery Attempted: ${context.recoveryAttempted}

Error Summary:
${context.errorSummary}

Diagnostics:
${context.diagnostics.map((d, i) =>
  `  ${i + 1}. [${d.confidence >= 0.7 ? 'HIGH' : 'LOW'} confidence] ${d.rootCause}
     Fix: ${d.suggestedFix}
     ${d.requiresHumanReview ? '⚠️  Requires human review' : '✅ Auto-fix available'}
  `
).join('\n')}

Recovery Actions Available:
${context.recoveryActions.map(a => `  - ${a}`).join('\n') || '  None available'}
`;
}

export function buildErrorFromLogEntry(
  phase: string,
  message: string,
  type?: BuildError['type']
): BuildError {
  const { categorizeError } = require('./errorTrackingService');
  const category = type || categorizeError(message).category as BuildError['type'];

  return {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type: category,
    severity: 'error',
    phase,
    message,
    timestamp: new Date().toISOString(),
    retryable: ['network', 'dependency', 'unknown'].includes(category),
  };
}

export function clearDiagnosticCache(): void {
  errorDiagnosticCache.clear();
}

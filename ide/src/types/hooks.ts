/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HookPhase = 'pre' | 'post' | 'on_error';
export type HookAction = 'allow' | 'block' | 'warn';

export interface HookConfig {
  id: string;
  name: string;
  phase: HookPhase;
  pipelinePhase: string;
  action: HookAction;
  script?: string;
  command?: string;
  condition?: string;
  enabled: boolean;
}

export interface HookResult {
  hookId: string;
  hookName: string;
  phase: HookPhase;
  pipelinePhase: string;
  passed: boolean;
  blocked: boolean;
  success: boolean;
  output?: string;
  warnings: string[];
  logs: string[];
  durationMs: number;
}

export interface FixAttempt {
  id: string;
  attemptNumber: number;
  phase: string;
  errorMessage: string;
  errorType: string;
  diagnosis: string;
  fixDescription: string;
  fixCode?: string;
  targetFile?: string;
  fixStrategy?: string;
  applied: boolean;
  success: boolean;
  timestamp: string;
  durationMs: number;
}

export interface AutoFixContext {
  executionId: string;
  phase: string;
  error: Error;
  errorType: string;
  sourceRepos: string[];
  codebaseContext?: string;
  pipelineLogs: string[];
  previousFixes: FixAttempt[];
  retryPhase?: () => Promise<void>;
}

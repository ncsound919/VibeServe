/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RAGContextData, BrowserObservationData, BrowserHistoryItemData } from './browser';
import type { HookResult, FixAttempt } from './hooks';

export interface BuildStepData {
  id: string;
  phase: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  details: string;
}

export interface E2EResultData {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  logs: string[];
}

export interface UnifiedPipelineAnalysis {
  stack: string;
  utility: string;
  buildType: string;
  suggestedIntegration: string;
  potentialSynergy: string;
  hash?: string;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface PipelineExecutionData {
  id: string;
  sourceRepos: string[];
  currentStep: string;
  progress: number;
  status: 'idle' | 'running' | 'success' | 'failed';
  steps: BuildStepData[];
  e2eResults: E2EResultData[];
  logs: string[];
  duration?: number;
  analysis?: UnifiedPipelineAnalysis;
  manifest?: string;
  metrics?: ResourceMetrics;
  assignedAgentId?: string;
  rag?: RAGContextData;
  browserSnapshot?: BrowserObservationData;
  browserHistory?: BrowserHistoryItemData[];
  hookResults?: HookResult[];
  fixAttempts?: FixAttempt[];
  autoFixActive?: boolean;
  checkpointId?: string;
}

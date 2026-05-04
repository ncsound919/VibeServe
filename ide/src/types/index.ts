/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Barrel export — import everything from '@/types' or './types'
 */

export type { RAGContextData, BrowserObservationData, BrowserHistoryItemData } from './browser';
export type { CustomAgentData, CLIStateData, AgentAssessment } from './agents';
export type {
  BuildStepData,
  E2EResultData,
  UnifiedPipelineAnalysis,
  ResourceMetrics,
  PipelineExecutionData,
} from './pipeline';
export type {
  PredictionData,
  NewsItem,
  RepoTrend,
  OpenSourceStat,
  TrendingTool,
  VideoItem,
  Signal,
  DashboardData,
} from './dashboard';
export type {
  HookConfig,
  HookResult,
  FixAttempt,
  AutoFixContext,
  HookPhase,
  HookAction,
} from './hooks';
export type {
  PermissionRule,
  PermissionContext,
  PermissionScope,
  PermissionAction,
  CheckpointSnapshot,
  CheckpointRestoreResult,
  ModelProvider,
  ModelRoutingDecision,
  CodeSymbol,
  CodeDependency,
  CodeAnalysisResult,
  ExecutionPlan,
  PlanStep,
  PlanApprovalRequest,
} from './pipeline-extensions';

// ── Legacy aliases used by services/stores ──────────────────────────────────
export type { BuildStepData as BuildStep } from './pipeline';
export type { E2EResultData as E2EResult } from './pipeline';
export type { PipelineExecutionData as PipelineExecution } from './pipeline';
export type { RAGContextData as RAGContext } from './browser';
export type { BrowserObservationData as BrowserObservation } from './browser';
export type { BrowserHistoryItemData as BrowserHistoryItem } from './browser';
export type { CustomAgentData as CustomAgent } from './agents';
export type { CLIStateData as CLIState } from './agents';

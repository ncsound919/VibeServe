/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Barrel export — import everything from '@/types' or './types'
 */

export type {
	AgentAssessment,
	CLIStateData,
	CLIStateData as CLIState,
	CustomAgentData,
	CustomAgentData as CustomAgent,
} from "./agents";
export type {
	BrowserHistoryItemData,
	BrowserHistoryItemData as BrowserHistoryItem,
	BrowserObservationData,
	BrowserObservationData as BrowserObservation,
	RAGContextData,
	RAGContextData as RAGContext,
} from "./browser";
export type {
	DashboardData,
	NewsItem,
	OpenSourceStat,
	PredictionData,
	RepoTrend,
	Signal,
	TrendingTool,
	VideoItem,
} from "./dashboard";
export type {
	AutoFixContext,
	FixAttempt,
	HookAction,
	HookConfig,
	HookPhase,
	HookResult,
} from "./hooks";
// ── Legacy aliases used by services/stores ──────────────────────────────────
export type {
	BuildStepData,
	BuildStepData as BuildStep,
	E2EResultData,
	E2EResultData as E2EResult,
	PipelineExecutionData,
	PipelineExecutionData as PipelineExecution,
	ResourceMetrics,
	UnifiedPipelineAnalysis,
} from "./pipeline";
export type {
	CheckpointRestoreResult,
	CheckpointSnapshot,
	CodeAnalysisResult,
	CodeDependency,
	CodeSymbol,
	ExecutionPlan,
	ModelProvider,
	ModelRoutingDecision,
	PermissionAction,
	PermissionContext,
	PermissionRule,
	PermissionScope,
	PlanApprovalRequest,
	PlanStep,
} from "./pipeline-extensions";

/**
 * Integration Types
 * Type definitions for Nexus Alpha integrations
 */

export interface IntegrationServiceStatus {
  name: string;
  connected: boolean;
  latency?: number;
  version?: string;
}

export interface IntegrationHubState {
  services: Record<string, boolean>;
  lastUpdated: number;
  error?: string;
}

export interface AgentChatRequest {
  message: string;
  sessionId?: string;
}

export interface AgentChatResponse {
  success: boolean;
  message: string;
  toolCalls?: string[];
  sessionId?: string;
}

export interface SearchRequest {
  query: string;
  source?: "firecrawl" | "tavily" | "all";
  limit?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
  source: string;
}

export interface MemoryAddRequest {
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryGetRequest {
  userId: string;
  limit?: number;
}

export interface VectorSearchRequest {
  collection?: string;
  query?: string;
  vector?: number[];
  limit?: number;
}

export interface VectorUpsertRequest {
  collection?: string;
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>;
}

export interface TraceRequest {
  name: string;
  metadata?: Record<string, unknown>;
}

export interface TraceResponse {
  traceId: string;
  ts: number;
}

export type {
  DashboardData,
  Signal,
  RepoTrend,
  NewsItem,
  OpenSourceStat,
  TrendingTool,
  VideoItem,
  PredictionData,
  ResourceMetrics,
  PipelineExecutionData,
  E2EResultData,
  BuildStepData,
  UnifiedPipelineAnalysis,
  CLIStateData,
  CustomAgentData,
  BrowserObservationData,
  BrowserHistoryItemData,
  RAGContextData,
} from "./index";

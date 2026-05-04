/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BuildStepData, PipelineExecutionData } from './pipeline';
import type { CustomAgentData, CLIStateData } from './agents';

export interface PredictionData {
  category: string;
  currentValue: number;
  predictedValue: number;
  growth: number;
  impact: 'High' | 'Medium' | 'Low';
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  url: string;
}

export interface RepoTrend {
  name: string;
  stars: number;
  forks: number;
  growth: number;
  tags: string[];
  aiAnalysis?: string;
  stack?: string;
  utility?: string;
  buildType?: string;
  description?: string;
}

export interface OpenSourceStat {
  label: string;
  value: number;
  change: number;
}

export interface TrendingTool {
  name: string;
  description: string;
  category: string;
  stars?: number;
}

export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  views: string;
  url: string;
}

export interface Signal {
  time: string;
  source: string;
  signal: string;
  value: string;
}

export interface DashboardData {
  growthRate: number;
  activeDevelopers: number;
  totalModels: number;
  sentimentScore: number;
  predictions: PredictionData[];
  news: NewsItem[];
  repos: RepoTrend[];
  growthHistory: { month: string; value: number }[];
  openSourceStats: OpenSourceStat[];
  trendingTools: TrendingTool[];
  videos: VideoItem[];
  buildPipeline: BuildStepData[];
  pipelineExecutions?: PipelineExecutionData[];
  signals: Signal[];
  synergyInsights?: string[];
  harvestSources?: { name: string; url: string; lastUpdate: string }[];
  customAgents: CustomAgentData[];
  cliState: CLIStateData;
  isMock?: boolean;
  mcpStatus?: {
    activeServers: number;
    connections: number;
    lastPing: string;
    protocol: string;
  };
}

// Re-export cross-domain types for convenience
export type { BuildStepData, PipelineExecutionData, E2EResultData, UnifiedPipelineAnalysis, ResourceMetrics } from './pipeline';
export type { CustomAgentData, CLIStateData } from './agents';
export type { RAGContextData, BrowserObservationData, BrowserHistoryItemData } from './browser';

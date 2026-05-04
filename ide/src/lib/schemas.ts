import { z } from 'zod';

export const VideoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  thumbnail: z.string(),
  channel: z.string(),
  views: z.string(),
  url: z.string(),
});

export const NewsItemSchema = z.object({
  title: z.string(),
  source: z.string(),
  timestamp: z.string(),
  url: z.string().optional(),
});

export const RepoTrendSchema = z.object({
  name: z.string(),
  stars: z.number(),
  forks: z.number(),
  growth: z.number(),
  tags: z.array(z.string()),
  aiAnalysis: z.string().optional(),
  stack: z.string().optional(),
  utility: z.string().optional(),
  buildType: z.string().optional(),
});

export const PredictionDataSchema = z.object({
  title: z.string(),
  confidence: z.number().min(0).max(100),
  category: z.string().optional(),
});

export const SignalSchema = z.object({
  time: z.string().optional(),
  source: z.string(),
  signal: z.string().optional(),
  message: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
});

export const OpenSourceStatSchema = z.object({
  label: z.string(),
  value: z.number(),
  change: z.number(),
});

export const TrendingToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  stars: z.number().optional(),
});

export const PipelineExecutionSchema = z.object({
  id: z.string(),
  sourceRepos: z.array(z.string()),
  currentStep: z.string(),
  progress: z.number().min(0).max(100),
  status: z.enum(['running', 'completed', 'failed', 'idle']),
  steps: z.array(z.object({
    name: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    duration: z.number().optional(),
    output: z.string().optional(),
  })),
  e2eResults: z.array(z.object({
    testName: z.string(),
    passed: z.boolean(),
    duration: z.number().optional(),
  })),
  logs: z.array(z.string()),
  duration: z.number().optional(),
});

export const DashboardDataSchema = z.object({
  growthRate: z.number(),
  activeDevelopers: z.number(),
  totalModels: z.number(),
  sentimentScore: z.number(),
  predictions: z.array(PredictionDataSchema),
  news: z.array(NewsItemSchema),
  repos: z.array(RepoTrendSchema),
  growthHistory: z.array(z.object({ month: z.string(), value: z.number() })),
  openSourceStats: z.array(OpenSourceStatSchema),
  trendingTools: z.array(TrendingToolSchema),
  videos: z.array(VideoItemSchema),
  buildPipeline: z.array(z.object({
    name: z.string(),
    status: z.string(),
    duration: z.string(),
  })),
  pipelineExecutions: z.array(PipelineExecutionSchema).optional(),
  signals: z.array(SignalSchema),
  synergyInsights: z.array(z.string()).optional(),
  harvestSources: z.array(z.object({
    name: z.string(),
    url: z.string(),
    lastUpdate: z.string(),
  })).optional(),
  customAgents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    role: z.string(),
  })),
  cliState: z.object({
    activeProvider: z.string(),
    output: z.array(z.string()),
  }),
  mcpStatus: z.object({
    activeServers: z.number(),
    connections: z.number(),
    lastPing: z.string(),
    protocol: z.string(),
  }).optional(),
  isMock: z.boolean().optional(),
});

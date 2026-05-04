import { useQuery } from '@tanstack/react-query';
import { analyzeAIData } from '../services/geminiService';
import type { DashboardData } from '../types';

const DEFAULT_FALLBACK: DashboardData = {
  growthRate: 0, activeDevelopers: 0, totalModels: 0, sentimentScore: 0.5,
  predictions: [], growthHistory: [], signals: [], synergyInsights: [],
  repos: [], trendingTools: [], openSourceStats: [], harvestSources: [],
  news: [], videos: [], buildPipeline: [], customAgents: [], cliState: { activeProvider: 'deepseek', output: [] },
  mcpStatus: { activeServers: 0, connections: 0, lastPing: new Date().toISOString(), protocol: 'MCP/1.0' },
  isMock: true,
};

/**
 * Fetches and caches dashboard data from the AI analysis service.
 * - staleTime: 4 minutes (prevents unnecessary refetches while still staying fresh)
 * - refetchInterval: 4 minutes (background polling)
 * - retry: 2 attempts with exponential backoff
 * - AbortSignal.any polyfill: safe fallback if browser doesn't support it
 * - placeholderData: shows mock data immediately on first load
 */
export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async ({ signal }) => {
      // AbortSignal.timeout is baseline in modern browsers; AbortSignal.any has wider support
      const timeout = AbortSignal.timeout(15000);
      // AbortSignal.any may not exist in older environments - safe fallback
      const combined = signal
        ? (typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : timeout)
        : timeout;
      const result = await analyzeAIData(combined);
      return result;
    },
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    refetchOnWindowFocus: false,
    // 2 retries: first retry after 1s, second after 2s
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
    placeholderData: DEFAULT_FALLBACK,
  });
}

import { useMemo } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePipelineStore } from '../../stores/usePipelineStore';

export interface NexusStats {
  modelCount: number;
  activeAgents: number;
  pipelineRuns: number;
  signalScore: number;
  activeDevelopers: number;
  synergyInsights: number;
  trendingTools: number;
  loading: boolean;
  error: boolean;
}

/**
 * useNexusStats
 * Derives platform-level stats from dashboard data and pipeline store.
 * Used by OverviewTab to power the stat cards.
 */
export function useNexusStats(): NexusStats {
  const { data, isLoading, isError } = useDashboardData();
  const executions = usePipelineStore((s) => s.executions);

  return useMemo(() => {
    if (!data) {
      return {
        modelCount: 0,
        activeAgents: 0,
        pipelineRuns: executions?.length ?? 0,
        signalScore: 0,
        activeDevelopers: 0,
        synergyInsights: 0,
        trendingTools: 0,
        loading: isLoading,
        error: isError,
      };
    }
    return {
      modelCount: data.totalModels ?? 0,
      activeAgents: (data.customAgents?.length ?? 0),
      pipelineRuns: executions?.length ?? (data.buildPipeline?.length ?? 0),
      signalScore: Math.round((data.sentimentScore ?? 0) * 100),
      activeDevelopers: data.activeDevelopers ?? 0,
      synergyInsights: data.synergyInsights?.length ?? 0,
      trendingTools: data.trendingTools?.length ?? 0,
      loading: isLoading,
      error: isError,
    };
  }, [data, isLoading, isError, executions]);
}

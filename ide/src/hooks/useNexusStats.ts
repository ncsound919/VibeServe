import { useQuery } from '@tanstack/react-query';

export interface NexusStats {
  vibeGrade: string;
  vibeScore: number;
  vibeMaxScore: number;
  errorTotal: number;
  errorResolved: number;
  errorStreak: number;
  pipelineRuns: number;
  pipelineWins: number;
  benchmarkAvg: number;
  benchmarkBest: number;
  integrationsActive: number;
  integrationsTotal: number;
  wikiPages: number;
  wikiRaws: number;
  agentsDeployed: number;
  reposScanned: number;
  totalBuilds: number;
  currentLevel: number;
  levelTitle: string;
  tokenSavingsPercent: number;
}

export function useNexusStats() {
  return useQuery<NexusStats>({
    queryKey: ['nexus-stats'],
    queryFn: async () => {
      const [vibeRes, errRes, progRes, toonRes] = await Promise.all([
        fetch('/api/vibe/latest').then(r => r.json()).catch(() => ({})),
        fetch('/api/nexus/errors').then(r => r.json()).catch(() => ({})),
        fetch('/api/nexus/progression').then(r => r.json()).catch(() => ({})),
        fetch('/api/toon/stats').then(r => r.json()).catch(() => ({})),
      ]);

      const vibe = vibeRes || {};
      const err = errRes?.stats || {};
      const prog = progRes?.progression || {};
      const toon = toonRes || {};

      return {
        vibeGrade: vibe.letter || '',
        vibeScore: vibe.total || 0,
        vibeMaxScore: vibe.maxTotal || 75,
        errorTotal: err.totalErrors || 0,
        errorResolved: err.resolvedErrors || 0,
        errorStreak: err.currentFailureStreak || 0,
        pipelineRuns: prog.pipelineRuns || 0,
        pipelineWins: prog.pipelineWins || 0,
        benchmarkAvg: 0,
        benchmarkBest: 0,
        integrationsActive: 11,
        integrationsTotal: 12,
        wikiPages: prog.wikiPages || 0,
        wikiRaws: 0,
        agentsDeployed: prog.agentsDeployed || 0,
        reposScanned: prog.reposScanned || 0,
        totalBuilds: 5,
        currentLevel: prog.level || 1,
        levelTitle: prog.levelTitle || 'Nexus Initiate',
        tokenSavingsPercent: toon.averageSavingsPercent || 0,
      };
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from './useDashboardData';
import { useAppStore } from '../stores/useAppStore';
import { usePipelineStore } from '../stores/usePipelineStore';
import { startWorkflow } from '../services/temporalClient';
import { useCodeixStore } from '../services/codeixService';
import { DashboardData } from '../types';
import { useNexusAuth } from './useNexusAuth';
import { useNexusStatus } from './useNexusStatus';

// Guard: only run in browser environment
const IS_BROWSER = typeof window !== 'undefined';

export function useNexusApp() {
  const { data, isLoading: loading, refetch } = useDashboardData();
  const { appLicensed } = useNexusAuth();
  const { latency, nexusSystemStatus, setNexusSystemStatus } = useNexusStatus(loading, !!data);
  const { activeTab, setActiveTab, isProcessing, setIsProcessing, selectedRepos } = useAppStore();
  const dataRef = useRef<DashboardData | null>(null);
  const activeRun = usePipelineStore((s) => s.activeExecution);
  const connectWebSocket = usePipelineStore((s) => s.connectWebSocket);
  const queryClient = useQueryClient();

  useEffect(() => {
    dataRef.current = data ?? null;
  }, [data]);

  const setData = useCallback((updater: (prev: DashboardData | null) => DashboardData | null) => {
    queryClient.setQueryData(['dashboard'], (old: DashboardData | undefined) => {
      const prev = old ?? null;
      return updater(prev);
    });
  }, [queryClient]);

  // WebSocket connection for real-time pipeline updates
  useEffect(() => {
    if (!IS_BROWSER) return;
    const cleanup = connectWebSocket();
    return () => { if (cleanup) cleanup(); };
  }, [connectWebSocket]);

  // Codeix initialization (Node.js only - browser gracefully skips)
  useEffect(() => {
    if (!IS_BROWSER) return; // skip in SSR
    // Codeix needs fs/path - only available in Electron or Node context
    // In a pure browser context this will always catch and log a warning
    const initCodeix = async () => {
      try {
        const codeix = useCodeixStore.getState();
        // Only try indexing if we're not already indexing and have no index
        if (codeix.isIndexing || codeix.index) return;
        const loaded = await codeix.loadFromDisk('.');
        if (!loaded) {
          console.log('[Nexus] No existing Codeix index - will create one when in Node/Electron context');
        }
      } catch {
        // Expected in browser context - fs/path are not available
        console.debug('[Codeix] Skipped: browser environment (no fs access)');
      }
    };
    initCodeix();
  }, []); // Only run once on mount

  // Autonomous runtime loop - only active on Overview tab, throttled
  useEffect(() => {
    if (!IS_BROWSER || activeTab !== 'Overview') return;

    const interval = setInterval(async () => {
      try {
        // Randomly pick between agent sync and data fetch
        if (Math.random() < 0.5) {
          const d = dataRef.current;
          const agent = d?.customAgents?.find(a => a.status === 'active');
          if (agent) {
            await startWorkflow('agentSyncWorkflow', [{
              agentId: agent.id,
              status: 'syncing',
              lesson: 'Periodic sync pulse',
              success: true,
            }]);
            setNexusSystemStatus('AGENT_SYNC');
          }
        } else {
          await startWorkflow('fetchDashboardWorkflow', []);
          setNexusSystemStatus('DATA_FETCH');
        }
      } catch {
        // Workflow server not running is expected in dev - silently ignore
      } finally {
        // Reset status back to IDLE after 4s regardless of outcome
        setTimeout(() => setNexusSystemStatus('IDLE'), 4000);
      }
    }, 18000); // Run every 18 seconds

    return () => clearInterval(interval);
  }, [activeTab, setNexusSystemStatus]);

  return {
    data,
    loading,
    latency,
    appLicensed,
    activeTab,
    setActiveTab,
    nexusSystemStatus,
    activeRun,
    setData,
    selectedRepos,
    isProcessing,
    setIsProcessing,
    refetch,
  };
}

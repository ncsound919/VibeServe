import { create } from "zustand";
import type { PipelineExecution } from "../types";
import type { HookConfig, HookResult, FixAttempt } from "../types/hooks";

interface PipelineStore {
  executions: PipelineExecution[];
  activeExecution: PipelineExecution | null;
  wsConnected: boolean;
  wsUrl: string;
  wsReconnectAttempts: number;
  hooks: HookConfig[];
  hookStats: { total: number; enabled: number; byPhase: Record<string, number>; byPipelinePhase: Record<string, number> } | null;
  fixHistory: Array<{ executionId: string; phase: string; timestamp: string; fixed: boolean; attempts: number; diagnosis: string }>;
  
  startPipeline: (repos: string[]) => Promise<void>;
  stopPipeline: () => void;
  clearHistory: () => void;
  clearActiveExecution: () => void;
  setWsConnected: (v: boolean) => void;
  updateExecution: (exec: PipelineExecution) => void;
  connectWebSocket: () => () => void;
  fetchHooks: () => Promise<void>;
  addHook: (hook: Omit<HookConfig, "id">) => Promise<void>;
  toggleHook: (id: string) => Promise<void>;
  removeHook: (id: string) => Promise<void>;
  fetchFixHistory: () => Promise<void>;
}

// Private references that don't trigger re-renders
let wsInstance: WebSocket | null = null;
let wsCleanupFunc: (() => void) | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null; // Fix Issue #6: Module-level timer (Verified)

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  executions: [],
  activeExecution: null,
  wsConnected: false,
  wsUrl: typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : "ws://localhost:3002/ws",
  wsReconnectAttempts: 0,
  hooks: [],
  hookStats: null,
  fixHistory: [],

  connectWebSocket: () => {
    if (wsCleanupFunc) wsCleanupFunc();
    if (typeof window === "undefined") return () => {};

    const url = get().wsUrl;

    const connect = () => {
      if (wsInstance) {
        wsInstance.onclose = null;
        wsInstance.onerror = null;
        wsInstance.onmessage = null;
        wsInstance.close();
      }

      const ws = new WebSocket(url);
      wsInstance = ws;

      ws.onopen = () => {
        set({ wsConnected: true, wsReconnectAttempts: 0 });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const execData = (msg.type === 'pipeline:update' || msg.type === 'pipeline_update') ? (msg.execution || msg.exec) : null;
          if (execData) {
            const exec = execData as PipelineExecution;
            set({ activeExecution: exec });
            set((s) => {
              const existing = s.executions.find(e => e.id === exec.id);
              const newExecs = existing
                ? s.executions.map(e => e.id === exec.id ? exec : e)
                : [...s.executions, exec];
              return { executions: newExecs };
            });
          }
        } catch {
          // Non-JSON messages ignored
        }
      };

      ws.onclose = () => {
        set({ wsConnected: false });
        wsInstance = null;
        if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
        wsReconnectTimer = setTimeout(() => {
          set((s) => ({ wsReconnectAttempts: s.wsReconnectAttempts + 1 }));
          connect();
        }, Math.min(1000 * Math.pow(2, get().wsReconnectAttempts), 30000));
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    const cleanup = () => {
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
      if (wsInstance) {
        wsInstance.onclose = null;
        wsInstance.onerror = null;
        wsInstance.onmessage = null;
        wsInstance.close();
        wsInstance = null;
      }
      set({ wsConnected: false });
      wsCleanupFunc = null;
    };

    wsCleanupFunc = cleanup;
    return cleanup;
  },

  startPipeline: async (repos) => {
    const { activeExecution } = get();
    if (activeExecution?.status === "running") return;

    const exec: PipelineExecution = {
      id: `pipeline-${Date.now()}`,
      sourceRepos: repos,
      currentStep: 'Starting...',
      progress: 0,
      status: 'running',
      steps: [],
      e2eResults: [],
      logs: ['Initializing pipeline...'],
    };
    set({ activeExecution: exec });

    try {
      const response = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos }),
      });
      
      if (!response.ok) {
        const errData = await response.text().catch(() => '');
        set((s) => ({
          activeExecution: s.activeExecution
            ? { ...s.activeExecution, status: 'failed' as const, logs: [...s.activeExecution.logs, `API error ${response.status}: ${errData.slice(0, 200)}`] }
            : null,
        }));
        return;
      }
      
      const result = await response.json();
      if (result.executionId) {
        set((s) => ({
          activeExecution: s.activeExecution
            ? { ...s.activeExecution, id: result.executionId }
            : null,
        }));
      }
      // Track successful pipeline run for gamification
      fetch('/api/nexus/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'pipeline-run', data: { success: true, repoCount: repos.length } }),
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set((s) => ({
        activeExecution: s.activeExecution
          ? { ...s.activeExecution, status: 'failed' as const, logs: [...s.activeExecution.logs, `Connection error: ${msg}`] }
          : null,
      }));
    }
  },

  stopPipeline: () => {
    set((s) => ({
      activeExecution: s.activeExecution
        ? { ...s.activeExecution, status: "failed" as const }
        : null,
    }));
  },

  clearHistory: () => set({ executions: [], activeExecution: null }),

  clearActiveExecution: () => {
    set({ activeExecution: null });
  },

  setWsConnected: (v) => set({ wsConnected: v }),

  updateExecution: (exec) => set({ activeExecution: exec }),

  // ── Hook Management ──
  fetchHooks: async () => {
    try {
      const res = await fetch('/api/hooks');
      if (res.ok) {
        const data = await res.json();
        set({ hooks: data.hooks || [], hookStats: data.stats || null });
      }
    } catch (err) {
      console.error('[PipelineStore] Failed to fetch hooks:', err);
    }
  },

  addHook: async (hook) => {
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hook),
      });
      if (res.ok) {
        get().fetchHooks();
      }
    } catch (err) {
      console.error('[PipelineStore] Failed to add hook:', err);
    }
  },

  toggleHook: async (id) => {
    try {
      const res = await fetch(`/api/hooks/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        get().fetchHooks();
      }
    } catch (err) {
      console.error('[PipelineStore] Failed to toggle hook:', err);
    }
  },

  removeHook: async (id) => {
    try {
      const res = await fetch(`/api/hooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        get().fetchHooks();
      }
    } catch (err) {
      console.error('[PipelineStore] Failed to remove hook:', err);
    }
  },

  fetchFixHistory: async () => {
    try {
      const res = await fetch('/api/pipeline/fix-history');
      if (res.ok) {
        const data = await res.json();
        set({ fixHistory: data.history || [] });
      }
    } catch (err) {
      console.error('[PipelineStore] Failed to fetch fix history:', err);
    }
  },
}));

import { create } from "zustand";
import type { DashboardData, CustomAgent, CLIState } from "../types";
import { fetchDashboardData } from "../services/geminiService";

const DEFAULT_CLI: CLIState = {
  activeProvider: "opencode",
  output: ["Nexus Alpha CLI ready. Type a command to begin."],
};

const DEFAULT_AGENTS: CustomAgent[] = [
  {
    id: "agent-1",
    name: "RepoHarvester",
    type: "script",
    status: "active",
    lastActive: new Date().toISOString(),
    fileCount: 12,
  },
  {
    id: "agent-2",
    name: "PipelineOrchestrator",
    type: "config",
    status: "active",
    lastActive: new Date().toISOString(),
    fileCount: 4,
  },
];

interface DashboardStore {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetch: () => Promise<void>;
  setAgents: (agents: CustomAgent[]) => void;
  setCLI: (cli: Partial<CLIState>) => void;
  addCLIOutput: (line: string) => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetch: async () => {
    const state = get();
    if (state.loading) return;
    set({ loading: true, error: null });
    try {
      const agents = state.data?.customAgents ?? DEFAULT_AGENTS;
      const cli = state.data?.cliState ?? DEFAULT_CLI;
      const data = await fetchDashboardData(agents, cli);
      set({ data, loading: false, lastFetched: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch dashboard data",
      });
    }
  },

  setAgents: (agents) =>
    set((s) => ({ data: s.data ? { ...s.data, customAgents: agents } : s.data })),

  setCLI: (partial) =>
    set((s) => ({
      data: s.data
        ? { ...s.data, cliState: { ...s.data.cliState, ...partial } }
        : s.data,
    })),

  addCLIOutput: (line) =>
    set((s) => ({
      data: s.data
        ? {
            ...s.data,
            cliState: {
              ...s.data.cliState,
              output: [...(s.data.cliState.output ?? []), line],
            },
          }
        : s.data,
    })),
}));

import { create } from 'zustand';

// TabName is defined here (source of truth) and re-exported by Sidebar.tsx
export type TabName =
  | 'Composer'
  | 'Overview'
  | 'Command Center'
  | 'Pipeline'
  | 'Settings'
  | 'Activity'
  | 'History'
  | 'Audit'
  | 'Mission Control'
  | 'Editor'
  | 'Changes'
  | 'Memory'
  | 'Preview'
  | 'Extensions'
  | 'System'
  | 'Agent Eval'
  | 'Magic'
  | 'Review';

interface AppStore {
  activeTab: TabName;
  isProcessing: boolean;
  browserContext: string | undefined;
  nexusSystemStatus: string;
  selectedRepos: string[];

  setActiveTab: (tab: TabName) => void;
  setIsProcessing: (processing: boolean) => void;
  setBrowserContext: (context: string | undefined) => void;
  setNexusSystemStatus: (status: string) => void;
  setSelectedRepos: (repos: string[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab: 'Composer',
  isProcessing: false,
  browserContext: undefined,
  nexusSystemStatus: 'IDLE',
  selectedRepos: [],

  setActiveTab: (activeTab) => set({ activeTab }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setBrowserContext: (browserContext) => set({ browserContext }),
  setNexusSystemStatus: (nexusSystemStatus) => set({ nexusSystemStatus }),
  setSelectedRepos: (selectedRepos) => set({ selectedRepos }),
}));

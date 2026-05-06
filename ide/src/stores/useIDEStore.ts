import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelId = 'explorer' | 'search' | 'git' | 'debug' | 'integrations' | 'settings' | 'agenda' | 'background' | 'career-library' | 'suggestions';
export type AutonomyMode = 'ide' | 'copilot' | 'pipeline';

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: string;
  isDirty: boolean;
  isPinned: boolean;
}

export interface IDEState {
  activePanel: PanelId;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelActive: 'problems' | 'output' | 'terminal' | 'pipeline-log' | 'gitea';
  tabs: EditorTab[];
  activeTabId: string | null;
  recentFiles: string[];
  autonomyMode: AutonomyMode;
  searchQuery: string;

  setActivePanel: (panel: PanelId) => void;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelActive: (tab: IDEState['bottomPanelActive']) => void;
  openFile: (path: string, name: string, language: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  markTabDirty: (tabId: string, dirty: boolean) => void;
  pinTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setAutonomyMode: (mode: AutonomyMode) => void;
  setSearchQuery: (query: string) => void;
}

const generateId = () => `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      activePanel: 'explorer',
      sidebarOpen: true,
      aiPanelOpen: true,
      bottomPanelOpen: true,
      bottomPanelActive: 'terminal',
      tabs: [],
      activeTabId: null,
      recentFiles: [],
      autonomyMode: 'ide',
      searchQuery: '',

      setActivePanel: (panel) => {
        const state = get();
        if (state.activePanel === panel && state.sidebarOpen) {
          set({ sidebarOpen: false });
        } else {
          set({ activePanel: panel, sidebarOpen: true });
        }
      },

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setBottomPanelActive: (tab) => set({ bottomPanelActive: tab, bottomPanelOpen: true }),

      openFile: (path, name, language) => {
        const state = get();
        const existing = state.tabs.find((t) => t.path === path);
        if (existing) {
          set({ activeTabId: existing.id });
          return;
        }
        const id = generateId();
        const tab: EditorTab = { id, path, name, language, isDirty: false, isPinned: false };
        set({
          tabs: [...state.tabs, tab],
          activeTabId: id,
          recentFiles: [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 20),
        });
      },

      closeTab: (tabId) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === tabId);
          const newTabs = s.tabs.filter((t) => t.id !== tabId);
          let newActive = s.activeTabId;
          if (s.activeTabId === tabId) {
            if (newTabs.length === 0) newActive = null;
            else {
              const nextIdx = Math.min(idx, newTabs.length - 1);
              newActive = newTabs[nextIdx].id;
            }
          }
          return { tabs: newTabs, activeTabId: newActive };
        }),

      setActiveTab: (tabId) => set({ activeTabId: tabId }),
      markTabDirty: (tabId, dirty) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t)),
        })),
      pinTab: (tabId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isPinned: !t.isPinned } : t)),
        })),
      closeOtherTabs: (tabId) =>
        set((s) => ({
          tabs: s.tabs.filter((t) => t.id === tabId || t.isPinned),
          activeTabId: tabId,
        })),
      closeAllTabs: () =>
        set((s) => ({
          tabs: s.tabs.filter((t) => t.isPinned),
          activeTabId: s.tabs.filter((t) => t.isPinned)[0]?.id ?? null,
        })),

      setAutonomyMode: (mode) => set({ autonomyMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'vibeserve-ide-store',
      partialize: (state) => ({
        activePanel: state.activePanel,
        sidebarOpen: state.sidebarOpen,
        aiPanelOpen: state.aiPanelOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        bottomPanelActive: state.bottomPanelActive,
        recentFiles: state.recentFiles,
        autonomyMode: state.autonomyMode,
      }),
    }
  )
);

/**
 * Integration Store
 * Manages state for connected services (Nanobot, Mem0, Qdrant, etc.)
 */

import { create } from "zustand";

interface IntegrationState {
  // Connection status
  nanobotConnected: boolean;
  qdrantConnected: boolean;
  mem0Connected: boolean;
  firecrawlConnected: boolean;
  tavilyConnected: boolean;
  langfuseConnected: boolean;

  // Agent state
  agentSessionId: string | null;
  agentMessages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
  }>;

  // Search state
  searchResults: Array<{
    title: string;
    url: string;
    content?: string;
    source: string;
  }>;
  searchLoading: boolean;

  // Memory state
  memories: Array<{
    id: string;
    content: string;
    timestamp: number;
  }>;

  // Actions
  setServiceConnected: (service: string, connected: boolean) => void;
  setAgentSession: (sessionId: string | null) => void;
  addAgentMessage: (role: "user" | "assistant" | "system", content: string) => void;
  setSearchResults: (results: Array<{ title: string; url: string; content?: string; source: string }>) => void;
  setSearchLoading: (loading: boolean) => void;
  setMemories: (memories: Array<{ id: string; content: string; timestamp: number }>) => void;
  fetchStatus: () => Promise<void>;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  // Initial state
  nanobotConnected: false,
  qdrantConnected: false,
  mem0Connected: false,
  firecrawlConnected: false,
  tavilyConnected: false,
  langfuseConnected: false,

  agentSessionId: null,
  agentMessages: [],

  searchResults: [],
  searchLoading: false,

  memories: [],

  // Actions
  setServiceConnected: (service, connected) => {
    set({ [`${service}Connected`]: connected });
  },

  setAgentSession: (sessionId) => {
    set({ agentSessionId: sessionId });
  },

  addAgentMessage: (role, content) => {
    set((state) => ({
      agentMessages: [
        ...state.agentMessages,
        { role, content, timestamp: Date.now() },
      ],
    }));
  },

  setSearchResults: (results) => {
    set({ searchResults: results });
  },

  setSearchLoading: (loading) => {
    set({ searchLoading: loading });
  },

  setMemories: (memories) => {
    set({ memories });
  },

  fetchStatus: async () => {
    try {
      const response = await fetch("/api/integrations/status");
      const data = await response.json();
      
      if (data.services) {
        set({
          nanobotConnected: data.services.nanobot || false,
          qdrantConnected: data.services.qdrant || false,
          mem0Connected: data.services.mem0 || false,
          firecrawlConnected: data.services.firecrawl || false,
          tavilyConnected: data.services.tavily || false,
          langfuseConnected: data.services.langfuse || false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch integration status:", error);
    }
  },
}));

export default useIntegrationStore;

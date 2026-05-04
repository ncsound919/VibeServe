export interface Memory {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    tier: 'immediate' | 'semantic' | 'episodic';
    timestamp: number;
    source?: string;
    importance?: number;
    tags?: string[];
  };
}

interface MemoryStoreState {
  memories: Memory[];
}

const state: MemoryStoreState = {
  memories: [],
};

const addMemory = (content: string, metadata: {
  tier: 'immediate' | 'semantic' | 'episodic';
  source?: string;
  importance?: number;
  tags?: string[];
}) => {
  const memory: Memory = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
  state.memories.push(memory);

  // Keep only last 10000 memories
  if (state.memories.length > 10000) {
    state.memories = state.memories.slice(-10000);
  }

  return memory;
};

const query = (filter?: {
  tier?: 'immediate' | 'semantic' | 'episodic';
  limit?: number;
  source?: string;
}) => {
  let filtered = state.memories;

  if (filter?.tier) {
    filtered = filtered.filter(m => m.metadata.tier === filter.tier);
  }
  if (filter?.source) {
    filtered = filtered.filter(m => m.metadata.source === filter.source);
  }

  // Sort by importance and timestamp
  filtered.sort((a, b) => {
    const impDiff = (b.metadata.importance || 0) - (a.metadata.importance || 0);
    if (impDiff !== 0) return impDiff;
    return b.metadata.timestamp - a.metadata.timestamp;
  });

  if (filter?.limit) {
    filtered = filtered.slice(0, filter.limit);
  }

  return filtered;
};

const getMemories = () => state.memories;

const clearMemories = () => {
  state.memories = [];
};

export const useMemoryStore = () => ({
  memories: state.memories,
  addMemory,
  query,
  getMemories,
  clearMemories,
});
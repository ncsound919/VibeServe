/**
 * Serena - MCP Server Context Engine
 * 
 * Features:
 * - Unified context management for MCP tools
 * - Prompt enrichment with relevant codebase snippets
 * - Semantic context routing
 * - Tool usage tracking and optimization
 * - Integration with Codeix, CodebaseIntelligence, and Lumen
 */
import { create } from 'zustand';
import { useCodeixStore } from './codeixService';
import { useCodebaseIntelligenceStore } from './codebaseIntelligenceService';
import { useLocalSemanticSearch } from './localSemanticSearch';
import { useRulesStore } from './project-rules';
import { logger } from '../lib/logger';

export interface ContextItem {
  id: string;
  source: 'codeix' | 'intelligence' | 'lumen' | 'mcp' | 'user';
  type: 'code' | 'doc' | 'dependency' | 'impact' | 'tool';
  content: string;
  relevance: number;
  metadata?: any;
}

export interface ContextPack {
  items: ContextItem[];
  totalTokens: number;
  summary: string;
}

interface SerenaStore {
  activeContext: ContextPack | null;
  isProcessing: boolean;
  mcpToolStatus: Record<string, 'active' | 'idle' | 'busy'>;

  enrichPrompt: (prompt: string, options?: { maxTokens?: number }) => Promise<string>;
  gatherContext: (query: string) => Promise<ContextPack>;
  registerToolStatus: (toolName: string, status: 'active' | 'idle' | 'busy') => void;
  clearContext: () => void;
}

export const useSerenaStore = create<SerenaStore>((set, get) => ({
  activeContext: null,
  isProcessing: false,
  mcpToolStatus: {},

  enrichPrompt: async (prompt, options = {}) => {
    set({ isProcessing: true });
    try {
      const pack = await get().gatherContext(prompt);
      const maxTokens = options.maxTokens || 4000;
      
      let enriched = prompt;
      let currentTokens = prompt.length / 4;
      
      const contextString = pack.items
        .filter(item => {
          const itemTokens = item.content.length / 4;
          if (currentTokens + itemTokens < maxTokens) {
            currentTokens += itemTokens;
            return true;
          }
          return false;
        })
        .map(item => `[Context: ${item.source}/${item.type}]\n${item.content}`)
        .join('\n\n');

      if (contextString) {
        enriched = `CONTEXT ENRICHMENT (Serena):\n${contextString}\n\nUSER REQUEST:\n${prompt}`;
      }

      set({ activeContext: pack, isProcessing: false });
      return enriched;
    } catch (error) {
      logger.error('Serena', `Prompt enrichment failed: ${error}`);
      set({ isProcessing: false });
      return prompt;
    }
  },

  gatherContext: async (query) => {
    const items: ContextItem[] = [];
    
    // 1. Query Codeix for symbols
    try {
      const codeix = useCodeixStore.getState();
      if (codeix.index) {
        const symbols = codeix.query(query, { limit: 5 });
        symbols.forEach(sym => {
          items.push({
            id: `codeix-${sym.id}`,
            source: 'codeix',
            type: 'code',
            content: `Symbol: ${sym.name} (${sym.kind}) in ${sym.filePath}`,
            relevance: 0.9,
          });
        });
      }
    } catch (e) { /* ignore */ }

    // 2. Query Codebase Intelligence for impact/dependencies
    try {
      const intel = useCodebaseIntelligenceStore.getState();
      const symbols = intel.findSymbol(query, { fuzzy: true });
      if (symbols.length > 0) {
        const impact = await intel.analyzeChangeImpact([symbols[0].filePath]);
        items.push({
          id: 'intel-impact',
          source: 'intelligence',
          type: 'impact',
          content: `Impact of changing ${symbols[0].filePath}: ${impact.affectedSymbols.length} affected symbols, Risk: ${impact.risk}`,
          relevance: 0.8,
        });
      }
    } catch (e) { /* ignore */ }

    // 3. Query Lumen for semantic search
    try {
      const lumen = useLocalSemanticSearch.getState();
      const results = await lumen.search(query, { limit: 3 });
      results.forEach((res, i) => {
        items.push({
          id: `lumen-${i}`,
          source: 'lumen',
          type: 'code',
          content: `Snippet from ${res.filePath}:\n${res.content.slice(0, 500)}`,
          relevance: res.score,
        });
      });
    } catch (e) { /* ignore */ }

    // 4. Query Project Rules
    try {
      const rules = useRulesStore.getState().getEnabledRules();
      if (rules.length > 0) {
        items.push({
          id: 'project-rules',
          source: 'user', // Rules are user-defined
          type: 'doc',
          content: `Project Rules:\n${rules.map(r => `- ${r.name}: ${r.content}`).join('\n')}`,
          relevance: 1.0, // Rules are always relevant
        });
      }
    } catch (e) { /* ignore */ }

    const pack: ContextPack = {
      items: items.sort((a, b) => b.relevance - a.relevance),
      totalTokens: items.reduce((sum, item) => sum + item.content.length / 4, 0),
      summary: `Serena gathered ${items.length} context items from ${new Set(items.map(i => i.source)).size} sources.`,
    };

    return pack;
  },

  registerToolStatus: (toolName, status) => {
    set(state => ({
      mcpToolStatus: { ...state.mcpToolStatus, [toolName]: status }
    }));
  },

  clearContext: () => {
    set({ activeContext: null });
  },
}));

export function useSerena() {
  return useSerenaStore;
}

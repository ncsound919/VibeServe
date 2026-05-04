/**
 * Adaptive Pricing Engine
 * 
 * Calculates costs based on token usage, model type, and task complexity.
 * Dynamically adjusts "credits" based on user tier and current load.
 */
import { create } from 'zustand';
import { TaskComplexity, Provider } from './modelRouter';

export interface PricingRecord {
  id: string;
  timestamp: number;
  tokens: number;
  model: string;
  provider: Provider;
  complexity: TaskComplexity;
  estimatedCost: number;
  creditsUsed: number;
}

interface PricingStore {
  records: PricingRecord[];
  totalCredits: number;
  usedCredits: number;
  
  trackUsage: (usage: Omit<PricingRecord, 'id' | 'timestamp' | 'estimatedCost' | 'creditsUsed'>) => void;
  getUsageSummary: () => { totalTokens: number; totalCost: number; creditsRemaining: number };
}

const COST_PER_1K_TOKENS: Record<string, number> = {
  'gemini-2.0-flash': 0.0001,
  'gemini-2.5-pro': 0.0015,
  'claude-sonnet-4': 0.003,
  'deepseek-chat': 0.0002,
  'llama3.1': 0, // Local is free
};

export const usePricingStore = create<PricingStore>((set, get) => ({
  records: [],
  totalCredits: 10000,
  usedCredits: 0,

  trackUsage: (usage) => {
    const id = `use-${Date.now()}`;
    const timestamp = Date.now();
    
    const costPerToken = COST_PER_1K_TOKENS[usage.model] || 0.0005;
    const estimatedCost = (usage.tokens / 1000) * costPerToken;
    
    // Convert USD to internal credits (1 credit = $0.001)
    const creditsUsed = Math.ceil(estimatedCost * 1000);

    const record: PricingRecord = {
      ...usage,
      id,
      timestamp,
      estimatedCost,
      creditsUsed,
    };

    set(state => ({
      records: [...state.records, record],
      usedCredits: state.usedCredits + creditsUsed,
    }));
  },

  getUsageSummary: () => {
    const { records, totalCredits, usedCredits } = get();
    return {
      totalTokens: records.reduce((sum, r) => sum + r.tokens, 0),
      totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
      creditsRemaining: totalCredits - usedCredits,
    };
  },
}));

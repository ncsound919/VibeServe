export type AgentType = 'research' | 'coding' | 'analysis' | 'general' | 'triage';

export interface GraphState {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  currentAgent: AgentType;
  query: string;
  context: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
  response: string;
  intent: string;
}

export const AgentTypeSchema = {
  research: 'research',
  coding: 'coding',
  analysis: 'analysis',
  general: 'general',
  triage: 'triage',
} as const;

export function createInitialState(query: string): GraphState {
  return {
    messages: [{ role: 'user', content: query, timestamp: new Date().toISOString() }],
    currentAgent: 'triage',
    query,
    context: [],
    response: '',
    intent: '',
  };
}

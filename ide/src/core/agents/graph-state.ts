export type AgentType = 'research' | 'coding' | 'analysis' | 'general' | 'triage';
export interface GraphState { query: string; intent?: AgentType; messages?: string[]; currentAgent?: AgentType; response?: string; context?: Array<{ id: string; content: string; similarity: number }> }
export function createInitialState(query: string): GraphState { return { query, messages: [query] }; }

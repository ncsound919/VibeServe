import { generateText } from './llmClient';
import { createInitialState, type GraphState } from './graph-state';
export async function triageNode(state: { query: string }): Promise<{ intent: string; confidence: number }> {
  const q = state.query.toLowerCase();
  if (q.includes('search') || q.includes('find') || q.includes('what is') || q.includes('who is')) return { intent: 'research', confidence: 0.8 };
  if (q.includes('code') || q.includes('function') || q.includes('implement') || q.includes('write') || q.includes('fix') || q.includes('bug') || q.includes('generate')) return { intent: 'coding', confidence: 0.8 };
  if (q.includes('analyze') || q.includes('data') || q.includes('metrics') || q.includes('chart')) return { intent: 'analysis', confidence: 0.8 };
  return { intent: 'general', confidence: 0.5 };
}
export async function researchAgentNode(state: { query: string }): Promise<{ response: string; context: Array<{ id: string; content: string; similarity: number }> }> { return { response: 'Research complete.', context: [] }; }
export async function codingAgentNode(state: { query: string }): Promise<{ response: string; context: Array<{ id: string; content: string; similarity: number }> }> { return { response: 'Code generated.', context: [] }; }
export async function analysisAgentNode(state: { query: string }): Promise<{ response: string; context: Array<{ id: string; content: string; similarity: number }> }> { return { response: 'Analysis complete.', context: [] }; }
export async function generalAgentNode(state: { query: string }): Promise<{ response: string; context: Array<{ id: string; content: string; similarity: number }> }> { try { const text = await generateText(state.query, { temperature: 0.7, maxTokens: 512 }); return { response: text, context: [] }; } catch { return { response: 'I could not process that request.', context: [] }; } }

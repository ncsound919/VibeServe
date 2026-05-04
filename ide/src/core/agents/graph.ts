import { triageNode } from './nodes/triage';
import { researchAgentNode } from './nodes/research';
import { codingAgentNode } from './nodes/coding';
import { analysisAgentNode } from './nodes/analysis';
import { generalAgentNode } from './nodes/general';
import { createInitialState, GraphState, AgentType } from './state';

export async function runAgentGraph(query: string): Promise<{
  response: string;
  intent: string;
  sources: Array<{ id: string; content: string }>;
}> {
  const state = createInitialState(query);

  const triageResult = await triageNode({ query: state.query });
  state.intent = triageResult.intent;

  let agentResult: {
    context: Array<{ id: string; content: string; similarity: number }>;
    response: string;
  };

  switch (state.intent as AgentType) {
    case 'research':
      agentResult = await researchAgentNode({ query: state.query });
      break;
    case 'coding':
      agentResult = await codingAgentNode({ query: state.query });
      break;
    case 'analysis':
      agentResult = await analysisAgentNode({ query: state.query });
      break;
    case 'general':
    default:
      agentResult = await generalAgentNode({ query: state.query });
      break;
  }

  state.context = agentResult.context;
  state.response = agentResult.response;
  state.currentAgent = state.intent as AgentType;

  return {
    response: state.response,
    intent: state.intent,
    sources: state.context.map((c) => ({ id: c.id, content: c.content })),
  };
}

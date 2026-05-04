import { runAgentGraph } from '../../core/agents/graph';
import { supabaseData } from '../../services/supabaseClient';

interface AgentInput {
  query: string;
  context?: Record<string, unknown>;
}

interface AgentOutput {
  response: string;
  intent: string;
  sources: Array<{ id: string; content: string }>;
}

/** Log an event to Supabase — type-safe wrapper */
async function logEvent(type: string, details: Record<string, unknown>): Promise<void> {
  await supabaseData.from('events').insert({
    type,
    details,
    created_at: new Date().toISOString(),
  });
}

export async function langGraphAgentActivity(input: AgentInput): Promise<AgentOutput> {
  const startTime = Date.now();

  try {
    const result = await runAgentGraph(input.query);

    await logEvent('langgraph_agent', {
      query: input.query,
      intent: result.intent,
      latency_ms: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    await logEvent('langgraph_agent_error', {
      query: input.query,
      error: String(error),
      latency_ms: Date.now() - startTime,
    });

    throw error;
  }
}

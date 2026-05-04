import { supabase } from '../../services/supabaseClient';

export interface AgentStateUpdate {
  agentId: string;
  status: string;
  lastTask?: string;
  performanceScore?: number;
}

export async function updateAgentStateActivity(update: AgentStateUpdate): Promise<void> {
  const { error } = await supabase.from('agent_state').upsert({
    agent_id: update.agentId,
    status: update.status,
    last_task: update.lastTask,
    performance_score: update.performanceScore,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to update agent state: ${error.message}`);
}

export async function recordAgentLearningActivity(
  agentId: string,
  lesson: string,
  success: boolean
): Promise<void> {
  const { error } = await supabase.rpc('record_agent_learning', {
    p_agent_id: agentId,
    p_lesson: lesson,
    p_success: success,
  });
  if (error) throw new Error(`Failed to record agent learning: ${error.message}`);
}

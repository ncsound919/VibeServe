import { proxyActivities } from '@temporalio/workflow';
import type * as agentActivities from '../workers/activities/agent.activities';
import type * as dbActivities from '../workers/activities/database.activities';

const activityOptions = {
  startToCloseTimeout: '1 minute' as const,
  retry: {
    maximumAttempts: 2,
    initialInterval: '3 seconds' as const,
  },
};

const { updateAgentStateActivity, recordAgentLearningActivity } = proxyActivities<typeof agentActivities>(activityOptions);
const { logEventActivity } = proxyActivities<typeof dbActivities>(activityOptions);

export interface AgentSyncInput {
  agentId: string;
  status: string;
  lesson?: string;
  success?: boolean;
}

export async function agentSyncWorkflow(input: AgentSyncInput): Promise<void> {
  try {
    await updateAgentStateActivity({
      agentId: input.agentId,
      status: input.status,
      lastTask: `Sync at ${new Date().toISOString()}`,
      performanceScore: input.success ? 0.01 : -0.01,
    });

    if (input.lesson) {
      await recordAgentLearningActivity(input.agentId, input.lesson, input.success ?? false);
    }

    await logEventActivity('agent_sync', { agentId: input.agentId, status: input.status });
  } catch (err) {
    await logEventActivity('agent_sync_failed', { agentId: input.agentId, error: String(err) });
    throw err;
  }
}

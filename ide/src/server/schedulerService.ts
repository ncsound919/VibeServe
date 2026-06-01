import type { GoalSummary } from '../types/suggestions';
import { getPipelineQueue, scheduleNightlyJobs, scheduleHourlyJobs, removeAllSchedules, enqueueBackgroundJob } from './orchestrator/orchestrator';

export interface ScheduleStatus {
  nightly: boolean;
  hourly: boolean;
  lastRunAt?: string;
  nextScheduledAt?: string;
}

let _scheduleStatus: ScheduleStatus = { nightly: false, hourly: false };

export function getScheduleStatus(): ScheduleStatus {
  return { ..._scheduleStatus };
}

export async function startScheduler(repos: string[], userId: string): Promise<ScheduleStatus> {
  await scheduleHourlyJobs(repos, userId);
  await scheduleNightlyJobs(repos, userId);
  _scheduleStatus = {
    nightly: true,
    hourly: true,
    lastRunAt: new Date().toISOString(),
    nextScheduledAt: 'Every hour + 2am nightly',
  };
  return { ..._scheduleStatus };
}

export async function stopScheduler(): Promise<void> {
  await removeAllSchedules();
  _scheduleStatus = { nightly: false, hourly: false };
}

export async function triggerJobNow(type: 'find-test-gaps' | 'cross-repo-suggest' | 'find-refactors' | 'gitnexus-analyze' | 'codegraph-build', repos: string[], userId: string): Promise<string> {
  const jobId = await enqueueBackgroundJob(type, repos, userId);
  _scheduleStatus.lastRunAt = new Date().toISOString();
  return jobId;
}

export async function triggerGoalBasedJobs(repos: string[], userId: string): Promise<string[]> {
  const queue = getPipelineQueue();
  if (!queue) return [];

  let client = null;
  try {
    const { getVibeServeClient } = await import('./mcpClient');
    client = getVibeServeClient();
  } catch { /* MCP client not available */ }

  if (!client) return [];

  let activeGoals: GoalSummary[] = [];
  try {
      const response = await client.callTool({ name: 'agenda_get_active_goals', arguments: {} });
    if (Array.isArray(response)) {
      activeGoals = response as GoalSummary[];
    }
  } catch { /* agenda not available */ }

  const jobIds: string[] = [];
  const toolSet = new Set<string>();

  for (const goal of activeGoals) {
    if (!goal.allowBgWork) continue;
    if (goal.scheduleMode === 'manual') continue;

    const goalType = goal.goalType;
    const GOAL_TYPE_TO_TOOLS: Record<string, string[]> = {
      feature: ['cross-repo-suggest', 'find-refactors', 'gitnexus-analyze', 'codegraph-build'],
      reliability: ['find-test-gaps', 'gitnexus-analyze', 'codegraph-build'],
      performance: ['find-refactors', 'gitnexus-analyze', 'codegraph-build'],
      docs: ['cross-repo-suggest'],
      security: ['find-test-gaps', 'gitnexus-analyze', 'codegraph-build'],
    };

    const tools = GOAL_TYPE_TO_TOOLS[goalType || ''] || [];
    for (const tool of tools) {
      if (!toolSet.has(tool)) {
        toolSet.add(tool);
        const jobType = tool as 'find-test-gaps' | 'cross-repo-suggest' | 'find-refactors' | 'gitnexus-analyze' | 'codegraph-build';
        const jobId = await enqueueBackgroundJob(jobType, repos, userId);
        if (jobId) jobIds.push(jobId);
      }
    }
  }

  return jobIds;
}

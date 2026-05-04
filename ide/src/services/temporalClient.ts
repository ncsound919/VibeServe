// Browser-safe temporal client - returns no-ops in browser
import type { Client as TemporalClient, Connection as TemporalConnection } from '@temporalio/client';

const isBrowser = typeof window !== 'undefined';

async function noopGetTemporalClient(): Promise<TemporalClient | null> {
  console.log('[Temporal] Browser mode - no-op');
  return null;
}

async function noopStartWorkflow(
  _workflowName: string,
  _args: unknown[],
  _options?: { taskQueue?: string; workflowId?: string }
) {
  console.log('[Temporal] Browser mode - startWorkflow no-op');
  return { workflowId: 'browser-no-op' };
}

async function noopGetWorkflowStatus(_workflowId: string): Promise<string> {
  return 'unknown';
}

export async function getTemporalClient() {
  if (isBrowser) {
    return noopGetTemporalClient();
  }
  
  // Server-side import
  const { Client, Connection } = await import('@temporalio/client');
  
  const TEMPORAL_HOST = process.env.TEMPORAL_HOST || 'localhost:7233';
  const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

  let connection: TemporalConnection | null = null;
  let client: TemporalClient | null = null;

  if (!client) {
    connection = await Connection.connect({ address: TEMPORAL_HOST });
    client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
  }
  return client;
}

export async function startWorkflow(
  workflowName: string,
  args: unknown[],
  options?: { taskQueue?: string; workflowId?: string }
) {
  if (isBrowser) {
    return noopStartWorkflow(workflowName, args, options);
  }
  
  const c = await getTemporalClient();
  const handle = await c.workflow.start(workflowName, {
    args,
    taskQueue: options?.taskQueue || 'nexus-alpha',
    workflowId: options?.workflowId || `${workflowName}-${Date.now()}`,
  });
  return handle;
}

export async function getWorkflowStatus(workflowId: string): Promise<string> {
  if (isBrowser) {
    return noopGetWorkflowStatus(workflowId);
  }
  
  try {
    const c = await getTemporalClient();
    const handle = c.workflow.getHandle(workflowId);
    return (await handle.describe()).status.name || 'unknown';
  } catch {
    return 'unknown';
  }
}

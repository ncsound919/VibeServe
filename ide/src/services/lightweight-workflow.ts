import { create } from 'zustand';

// Types
export interface WorkflowStep {
  name: string;
  fn: (ctx: WorkflowContext) => Promise<any>;
  retries?: number;
  timeout?: number;
}

export interface WorkflowContext {
  event: any;
  step: (name: string, fn: () => Promise<any>) => Promise<any>;
  sleep: (ms: number) => Promise<void>;
  id: string;
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  event: any;
  status: 'running' | 'completed' | 'failed' | 'waiting';
  steps: Array<{ name: string; status: 'pending' | 'completed' | 'failed'; result?: any; error?: string }>;
  createdAt: number;
  updatedAt: number;
  waitUntil?: number;
}

interface WorkflowStore {
  runs: Record<string, WorkflowRun>;
  registerWorkflow: (name: string, steps: WorkflowStep[]) => void;
  triggerWorkflow: (name: string, event: any) => Promise<any>;
  getRun: (id: string) => WorkflowRun | undefined;
  listRuns: (workflowName?: string) => WorkflowRun[];
}

const workflows: Record<string, WorkflowStep[]> = {};

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  runs: {},

  registerWorkflow: (name, steps) => {
    workflows[name] = steps;
  },

  triggerWorkflow: async (name, event) => {
    const steps = workflows[name];
    if (!steps) throw new Error(`Workflow ${name} not found`);

    const runId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const run: WorkflowRun = {
      id: runId,
      workflowName: name,
      event,
      status: 'running',
      steps: steps.map(s => ({ name: s.name, status: 'pending' })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      runs: { ...state.runs, [runId]: run },
    }));

    const ctx: WorkflowContext = {
      event,
      id: runId,
      step: async (stepName, fn) => {
        const stepConfig = steps.find(s => s.name === stepName);
        const maxRetries = stepConfig?.retries || 3;
        let lastError: any;

        for (let i = 0; i < maxRetries; i++) {
          try {
            const result = await fn();
            set((state) => ({
              runs: {
                ...state.runs,
                [runId]: {
                  ...state.runs[runId],
                  steps: state.runs[runId].steps.map(s =>
                    s.name === stepName ? { ...s, status: 'completed' as const, result } : s
                  ),
                  updatedAt: Date.now(),
                },
              },
            }));
            return result;
          } catch (err) {
            lastError = err;
            if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
        }

        set((state) => ({
          runs: {
            ...state.runs,
            [runId]: {
              ...state.runs[runId],
              status: 'failed',
              steps: state.runs[runId].steps.map(s =>
                s.name === stepName ? { ...s, status: 'failed' as const, error: String(lastError) } : s
              ),
              updatedAt: Date.now(),
            },
          },
        }));
        throw lastError;
      },
      sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    };

    try {
      for (const step of steps) {
        await ctx.step(step.name, () => step.fn(ctx));
      }

      set((state) => ({
        runs: {
          ...state.runs,
          [runId]: {
            ...state.runs[runId],
            status: 'completed',
            updatedAt: Date.now(),
          },
        },
      }));

      return { runId, status: 'completed' };
    } catch (err) {
      return { runId, status: 'failed', error: String(err) };
    }
  },

  getRun: (id) => get().runs[id],

  listRuns: (workflowName) => {
    const runs = Object.values(get().runs);
    return workflowName ? runs.filter(r => r.workflowName === workflowName) : runs;
  },
}));

// Helper to create workflow
export function createWorkflow(name: string, steps: WorkflowStep[]) {
  useWorkflowStore.getState().registerWorkflow(name, steps);

  return {
    trigger: (event: any) => useWorkflowStore.getState().triggerWorkflow(name, event),
  };
}

// Example: Agent workflow
export const agentWorkflow = createWorkflow('agent-task', [
  {
    name: 'analyze',
    fn: async (ctx) => {
      console.log('[Workflow] Analyzing task:', ctx.event);
      await ctx.sleep(100);
      return { analysis: 'Task analyzed' };
    },
    retries: 2,
  },
  {
    name: 'execute',
    fn: async (ctx) => {
      console.log('[Workflow] Executing task');
      await ctx.sleep(100);
      return { result: 'Task executed' };
    },
    retries: 3,
  },
  {
    name: 'verify',
    fn: async (ctx) => {
      console.log('[Workflow] Verifying result');
      return { verified: true };
    },
  },
]);

/**
 * Parallel Agent Orchestrator
 *
 * Multi-agent coordination system with:
 * - Parallel execution (fan-out/fan-in)
 * - Dependency graph for agent ordering
 * - Agent pools with isolation
 * - Shared memory/state
 * - Human-in-the-loop checkpoints
 */
import { create } from 'zustand';
import { sandboxService, type SandboxExecutionResult } from './sandboxService';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting';
export type ExecutionMode = 'parallel' | 'sequential' | 'fan-out' | 'fan-in';

export interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  input: string;
  status: AgentStatus;
  result?: any;
  error?: string;
  dependencies: string[];
  startedAt?: number;
  completedAt?: number;
}

export interface AgentPool {
  id: string;
  name: string;
  maxAgents: number;
  agentIds: string[];
  isolation: 'none' | 'sandbox' | 'vm';
}

export interface ParallelWorkflow {
  id: string;
  name: string;
  tasks: AgentTask[];
  mode: ExecutionMode;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  createdAt: number;
  completedAt?: number;
  sharedMemory: Record<string, any>;
  checkpoints: Array<{ name: string; taskId: string; requiresApproval: boolean; approved?: boolean }>;
}

export interface AgentCoordinationConfig {
  maxParallel: number;
  timeoutMs: number;
  retryAttempts: number;
  checkpointEnabled: boolean;
  autoRollback: boolean;
}

interface OrchestratorStore {
  workflows: Record<string, ParallelWorkflow>;
  pools: Record<string, AgentPool>;
  activeWorkflowId: string | null;
  config: AgentCoordinationConfig;

  createWorkflow: (name: string, mode: ExecutionMode) => string;
  addTask: (workflowId: string, task: Omit<AgentTask, 'id' | 'status'>) => string;
  setDependencies: (workflowId: string, taskId: string, dependencies: string[]) => void;
  executeWorkflow: (workflowId: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  cancelWorkflow: (workflowId: string) => void;
  approveCheckpoint: (workflowId: string, checkpointName: string) => void;
  rejectCheckpoint: (workflowId: string, checkpointName: string) => void;
  addPool: (pool: Omit<AgentPool, 'id'>) => string;
  getWorkflow: (id: string) => ParallelWorkflow | undefined;
  listWorkflows: () => ParallelWorkflow[];
}

const DEFAULT_CONFIG: AgentCoordinationConfig = {
  maxParallel: 5,
  timeoutMs: 300000,
  retryAttempts: 3,
  checkpointEnabled: true,
  autoRollback: true,
};

export const useParallelOrchestrator = create<OrchestratorStore>((set, get) => ({
  workflows: {},
  pools: {},
  activeWorkflowId: null,
  config: DEFAULT_CONFIG,

  createWorkflow: (name, mode) => {
    const id = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workflow: ParallelWorkflow = {
      id,
      name,
      tasks: [],
      mode,
      status: 'pending',
      createdAt: Date.now(),
      sharedMemory: {},
      checkpoints: [],
    };

    set(state => ({
      workflows: { ...state.workflows, [id]: workflow },
    }));

    return id;
  },

  addTask: (workflowId, task) => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newTask: AgentTask = {
      ...task,
      id: taskId,
      status: 'idle',
    };

    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow) return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: {
            ...workflow,
            tasks: [...workflow.tasks, newTask],
          },
        },
      };
    });

    return taskId;
  },

  setDependencies: (workflowId, taskId, dependencies) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow) return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: {
            ...workflow,
            tasks: workflow.tasks.map(t =>
              t.id === taskId ? { ...t, dependencies } : t
            ),
          },
        },
      };
    });
  },

  executeWorkflow: async (workflowId) => {
    const state = get();
    const workflow = state.workflows[workflowId];
    if (!workflow) return;

    set(s => ({
      activeWorkflowId: workflowId,
      workflows: {
        ...s.workflows,
        [workflowId]: { ...workflow, status: 'running' },
      },
    }));

    const { maxParallel, timeoutMs, checkpointEnabled } = state.config;

    try {
      switch (workflow.mode) {
        case 'parallel':
          await executeParallel(workflow, maxParallel, timeoutMs, checkpointEnabled);
          break;
        case 'sequential':
          await executeSequential(workflow, timeoutMs, checkpointEnabled);
          break;
        case 'fan-out':
          await executeFanOut(workflow, maxParallel, timeoutMs);
          break;
        case 'fan-in':
          await executeFanIn(workflow, timeoutMs);
          break;
      }

      set(s => ({
        workflows: {
          ...s.workflows,
          [workflowId]: {
            ...s.workflows[workflowId],
            status: 'completed',
            completedAt: Date.now(),
          },
        },
      }));
    } catch (error) {
      set(s => ({
        workflows: {
          ...s.workflows,
          [workflowId]: {
            ...s.workflows[workflowId],
            status: 'failed',
          },
        },
      }));
    } finally {
      set({ activeWorkflowId: null });
    }
  },

  pauseWorkflow: (workflowId) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow || workflow.status !== 'running') return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: { ...workflow, status: 'paused' },
        },
      };
    });
  },

  resumeWorkflow: (workflowId) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow || workflow.status !== 'paused') return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: { ...workflow, status: 'running' },
        },
      };
    });

    get().executeWorkflow(workflowId);
  },

  cancelWorkflow: (workflowId) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow) return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: {
            ...workflow,
            status: 'failed',
            tasks: workflow.tasks.map(t =>
              t.status === 'running' ? { ...t, status: 'failed', error: 'Cancelled' } : t
            ),
          },
        },
      };
    });
  },

  approveCheckpoint: (workflowId, checkpointName) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow) return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: {
            ...workflow,
            checkpoints: workflow.checkpoints.map(cp =>
              cp.name === checkpointName ? { ...cp, approved: true } : cp
            ),
          },
        },
      };
    });
  },

  rejectCheckpoint: (workflowId, checkpointName) => {
    set(state => {
      const workflow = state.workflows[workflowId];
      if (!workflow) return state;

      return {
        workflows: {
          ...state.workflows,
          [workflowId]: {
            ...workflow,
            status: 'failed',
            checkpoints: workflow.checkpoints.map(cp =>
              cp.name === checkpointName ? { ...cp, approved: false } : cp
            ),
          },
        },
      };
    });
  },

  addPool: (pool) => {
    const id = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newPool: AgentPool = { ...pool, id };

    set(state => ({
      pools: { ...state.pools, [id]: newPool },
    }));

    return id;
  },

  getWorkflow: (id) => get().workflows[id],
  listWorkflows: () => Object.values(get().workflows),
  }));

// ─── Execution Strategies ────────────────────────────────────────────────

/**
 * Determine sandbox type for a workflow based on agent pools
 */
function getSandboxTypeForWorkflow(workflow: ParallelWorkflow): 'none' | 'docker' | 'vm' {
  const state = useParallelOrchestrator.getState();
  
  // Check if any task's agent belongs to a pool with sandbox isolation
  for (const task of workflow.tasks) {
    // Find which pool contains this agent
    for (const pool of Object.values(state.pools)) {
      if (pool.agentIds.includes(task.agentId)) {
        if (pool.isolation === 'sandbox' || pool.isolation === 'vm') {
          return pool.isolation === 'vm' ? 'docker' : 'docker'; // Map to sandbox service type
        }
      }
    }
  }
  
  return 'none'; // Default: no sandbox
}

async function executeParallel(
  workflow: ParallelWorkflow,
  maxParallel: number,
  timeoutMs: number,
  checkpointEnabled: boolean
): Promise<void> {
  // Determine if sandboxing is needed for this workflow
  const sandboxType = getSandboxTypeForWorkflow(workflow);

  const runTask = async (task: AgentTask): Promise<AgentTask> => {
    updateTaskStatus(workflow.id, task.id, 'running', { startedAt: Date.now() });

    try {
      const result = await executeAgentTask(task.input, timeoutMs, sandboxType);

      return {
        ...task,
        status: 'completed' as AgentStatus,
        result,
        completedAt: Date.now(),
      };
    } catch (error) {
      return {
        ...task,
        status: 'failed' as AgentStatus,
        error: String(error),
        completedAt: Date.now(),
      };
    }
  };

  const pendingTasks = workflow.tasks.filter(t => t.status !== 'completed');

  while (pendingTasks.length > 0) {
    const readyTasks = pendingTasks.filter(t =>
      t.dependencies.every(depId => {
        const dep = workflow.tasks.find(x => x.id === depId);
        return dep?.status === 'completed';
      })
    );

    const batch = readyTasks.slice(0, maxParallel);
    const results = await Promise.all(batch.map(runTask));

    results.forEach(result => {
      updateTaskStatus(workflow.id, result.id, result.status, {
        result: result.result,
        error: result.error,
        completedAt: result.completedAt,
      });
    });
  }
}

async function executeSequential(
  workflow: ParallelWorkflow,
  timeoutMs: number,
  checkpointEnabled: boolean
): Promise<void> {
  // Determine if sandboxing is needed
  const sandboxType = getSandboxTypeForWorkflow(workflow);

  for (const task of workflow.tasks) {
    if (task.status === 'completed') continue;

    const checkpoint = workflow.checkpoints.find(cp => cp.taskId === task.id);
    if (checkpoint && checkpoint.requiresApproval && !checkpoint.approved) {
      updateTaskStatus(workflow.id, task.id, 'waiting');
      return;
    }

    updateTaskStatus(workflow.id, task.id, 'running', { startedAt: Date.now() });

    try {
      const result = await executeAgentTask(task.input, timeoutMs, sandboxType);
      updateTaskStatus(workflow.id, task.id, 'completed', {
        result,
        completedAt: Date.now(),
      });
    } catch (error) {
      updateTaskStatus(workflow.id, task.id, 'failed', {
        error: String(error),
        completedAt: Date.now(),
      });
      throw error;
    }
  }
}

async function executeFanOut(
  workflow: ParallelWorkflow,
  maxParallel: number,
  timeoutMs: number
): Promise<void> {
  // Determine sandbox type
  const sandboxType = getSandboxTypeForWorkflow(workflow);
  const results: any[] = [];
  const chunks = chunkArray(workflow.tasks, maxParallel);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async task => {
        updateTaskStatus(workflow.id, task.id, 'running', { startedAt: Date.now() });
        try {
          const result = await executeAgentTask(task.input, timeoutMs, sandboxType);
          updateTaskStatus(workflow.id, task.id, 'completed', {
            result,
            completedAt: Date.now(),
          });
          return result;
        } catch (error) {
          updateTaskStatus(workflow.id, task.id, 'failed', {
            error: String(error),
            completedAt: Date.now(),
          });
          throw error;
        }
      })
    );
    results.push(...chunkResults);
  }

  const aggregateResult = { fanOutResults: results, aggregated: true };
  updateTaskStatus(workflow.id, workflow.tasks[0].id, 'completed', {
    result: aggregateResult,
  });
}

async function executeFanIn(
  workflow: ParallelWorkflow,
  timeoutMs: number
): Promise<void> {
  // Determine sandbox type
  const sandboxType = getSandboxTypeForWorkflow(workflow);
  
  const leafTasks = workflow.tasks.filter(t => t.dependencies.length === 0);
  const aggregateTask = workflow.tasks.find(t => t.dependencies.length > 0);

  if (!aggregateTask) return;

  await Promise.all(
    leafTasks.map(async task => {
      updateTaskStatus(workflow.id, task.id, 'running', { startedAt: Date.now() });
      try {
        const result = await executeAgentTask(task.input, timeoutMs, sandboxType);
        updateTaskStatus(workflow.id, task.id, 'completed', {
          result,
          completedAt: Date.now(),
        });
      } catch (error) {
        updateTaskStatus(workflow.id, task.id, 'failed', {
          error: String(error),
          completedAt: Date.now(),
        });
      }
    })
  );

  const allResults = leafTasks.map(t => t.result);
  updateTaskStatus(workflow.id, aggregateTask.id, 'completed', {
    result: { fanInResults: allResults, aggregated: true },
    completedAt: Date.now(),
  });
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

function updateTaskStatus(
  workflowId: string,
  taskId: string,
  status: AgentStatus,
  updates?: Partial<AgentTask>
) {
  const store = useParallelOrchestrator.getState();
  const workflow = store.workflows[workflowId];
  if (!workflow) return;

  useParallelOrchestrator.setState({
    workflows: {
      ...store.workflows,
      [workflowId]: {
        ...workflow,
        tasks: workflow.tasks.map(t =>
          t.id === taskId ? { ...t, status, ...updates } : t
        ),
      },
    },
  });
}

async function executeAgentTask(
  input: string, 
  timeoutMs: number,
  sandboxType?: 'none' | 'docker' | 'vm'
): Promise<any> {
  // If sandbox is requested, use sandbox service
  if (sandboxType && sandboxType !== 'none') {
    try {
      const result: SandboxExecutionResult = await sandboxService.createSandbox(
        process.cwd(),
        `echo "${input.replace(/"/g, '\\"')}" && node -e "console.log(JSON.stringify({ processed: true, input: '${input.replace(/'/g, "\\'")}' }))"`,
        { 'task.txt': input }
      );
      
      if (!result.success) {
        throw new Error(`Sandbox execution failed: ${result.stderr}`);
      }
      
      return {
        success: true,
        output: result.stdout,
        sandbox: true,
        containerId: result.containerId,
        durationMs: result.durationMs,
      };
    } catch (error) {
      throw error;
    }
  }

  // Fallback to simulated execution (no sandbox)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Task execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    setTimeout(() => {
      clearTimeout(timeout);
      resolve({ 
        success: true, 
        output: `Processed: ${input.slice(0, 50)}...`,
        sandbox: false 
      });
    }, 100);
  });
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ─── Predefined Workflows ───────────────────────────────────────────────────────

export function createMultiAgentResearchWorkflow(query: string): string {
  const store = useParallelOrchestrator.getState();
  const workflowId = store.createWorkflow('Multi-Agent Research', 'fan-out');

  const agents = [
    { name: 'Web Search Agent', input: `Search for: ${query}` },
    { name: 'Code Analysis Agent', input: `Analyze code related to: ${query}` },
    { name: 'Documentation Agent', input: `Find docs for: ${query}` },
  ];

  agents.forEach(agent => {
    store.addTask(workflowId, {
      agentId: agent.name.toLowerCase().replace(/\s+/g, '-'),
      agentName: agent.name,
      input: agent.input,
      dependencies: [],
    });
  });

  return workflowId;
}

export function createBuildPipelineWorkflow(projectName: string): string {
  const store = useParallelOrchestrator.getState();
  const workflowId = store.createWorkflow('Build Pipeline', 'sequential');

  const stages = [
    { name: 'Setup Agent', input: `Initialize project: ${projectName}`, checkpoint: 'setup' },
    { name: 'Code Agent', input: `Generate code for: ${projectName}` },
    { name: 'Test Agent', input: `Write tests for: ${projectName}` },
    { name: 'Deploy Agent', input: `Deploy: ${projectName}`, checkpoint: 'deploy' },
  ];

  let prevTaskId: string | undefined;
  stages.forEach((stage, idx) => {
    const taskId = store.addTask(workflowId, {
      agentId: stage.name.toLowerCase().replace(/\s+/g, '-'),
      agentName: stage.name,
      input: stage.input,
      dependencies: prevTaskId ? [prevTaskId] : [],
    });
    prevTaskId = taskId;

    if (stage.checkpoint) {
      useParallelOrchestrator.setState(s => ({
        workflows: {
          ...s.workflows,
          [workflowId]: {
            ...s.workflows[workflowId],
            checkpoints: [
              ...s.workflows[workflowId].checkpoints,
              { name: stage.checkpoint, taskId, requiresApproval: true },
            ],
          },
        },
      }));
    }
  });

  return workflowId;
}

export function createCodeReviewWorkflow(files: string[]): string {
  const store = useParallelOrchestrator.getState();
  const workflowId = store.createWorkflow('Code Review', 'fan-out');

  files.forEach(file => {
    store.addTask(workflowId, {
      agentId: 'reviewer',
      agentName: 'Code Review Agent',
      input: `Review file: ${file}`,
      dependencies: [],
    });
  });

  store.addTask(workflowId, {
    agentId: 'synthesizer',
    agentName: 'Review Synthesizer',
    input: 'Aggregate all review results',
    dependencies: files.map((_, i) => `task-${i + 1}`),
  });

  return workflowId;
}

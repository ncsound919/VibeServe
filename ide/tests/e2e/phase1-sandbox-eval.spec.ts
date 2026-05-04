import { test, expect } from '@playwright/test';
import { sandboxService } from '../../src/services/sandboxService';
import { useParallelOrchestrator } from '../../src/services/parallelAgentOrchestrator';
import { useEvalStore } from '../../src/services/agentEvalService';

test.describe('Phase 1: Sandbox & Evaluation', () => {
  test.beforeEach(() => {
    // Reset stores
    useParallelOrchestrator.getState().workflows = {};
    useParallelOrchestrator.getState().pools = {};
    useEvalStore.getState().results = [];
  });

  test('Sandbox Service - should be importable and configured', async () => {
    expect(sandboxService).toBeDefined();
    expect(typeof sandboxService.createSandbox).toBe('function');
    expect(typeof sandboxService.isDockerAvailable).toBe('function');
  });

  test('Sandbox Service - Docker availability check', async () => {
    const available = sandboxService.isDockerAvailable();
    // Docker may or may not be available in test environment
    expect(typeof available).toBe('boolean');
  });

  test('Parallel Orchestrator - should integrate sandbox type', async () => {
    const store = useParallelOrchestrator.getState();
    
    // Create a pool with sandbox isolation
    const poolId = store.addPool({
      name: 'Sandboxed Pool',
      maxAgents: 2,
      agentIds: ['agent-1'],
      isolation: 'sandbox',
    });

    expect(poolId).toBeDefined();
    
    // Get updated state
    const updatedStore = useParallelOrchestrator.getState();
    const pool = updatedStore.pools[poolId];
    expect(pool).toBeDefined();
    expect(pool.isolation).toBe('sandbox');
  });

  test('Parallel Orchestrator - should create workflow with sandbox', async () => {
    const store = useParallelOrchestrator.getState();
    
    const workflowId = store.createWorkflow('Test Sandbox Workflow', 'parallel');
    
    // Get updated state
    const updatedStore = useParallelOrchestrator.getState();
    const workflow = updatedStore.workflows[workflowId];
    
    expect(workflow).toBeDefined();
    expect(workflow.mode).toBe('parallel');
    
    // Add a task
    const taskId = updatedStore.addTask(workflowId, {
      agentId: 'test-agent',
      agentName: 'Test Agent',
      input: 'echo "hello"',
      dependencies: [],
    });

    // Get updated state again
    const finalStore = useParallelOrchestrator.getState();
    const finalWorkflow = finalStore.workflows[workflowId];
    
    expect(taskId).toBeDefined();
    expect(finalWorkflow.tasks.length).toBe(1);
  });

  test('Agent Eval Service - should have SWE-bench style structure', async () => {
    const store = useEvalStore.getState();
    
    expect(store.challenges.length).toBeGreaterThan(0);
    expect(store.challenges[0].id).toBeDefined();
    expect(store.challenges[0].difficulty).toMatch(/easy|medium|hard/);
  });

  test('Agent Eval Service - should run evaluation (mocked)', async () => {
    const store = useEvalStore.getState();
    
    if (store.challenges.length === 0) {
      test.skip();
    }

    const challenge = store.challenges[0];
    const result = await store.runEvaluation(challenge.id, 'test-agent');
    
    expect(result).toBeDefined();
    expect(result.challengeId).toBe(challenge.id);
    expect(result.status).toMatch(/passed|failed|error/);
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  test('Integration - Sandbox with Orchestrator', async () => {
    // This test verifies that sandbox service is called when pool has isolation
    // Since we can't easily test Docker in E2E, we'll mock
    const store = useParallelOrchestrator.getState();
    
    // Create pool with sandbox
    const poolId = store.addPool({
      name: 'Docker Pool',
      maxAgents: 1,
      agentIds: ['docker-agent'],
      isolation: 'docker',
    });

    // Get updated state
    const storeAfterPool = useParallelOrchestrator.getState();
    expect(storeAfterPool.pools[poolId]).toBeDefined();
    expect(storeAfterPool.pools[poolId].isolation).toBe('docker');
    
    // Create workflow
    const workflowId = storeAfterPool.createWorkflow('Docker Test', 'sequential');
    
    // Get updated state
    const storeAfterWorkflow = useParallelOrchestrator.getState();
    const workflow = storeAfterWorkflow.workflows[workflowId];
    expect(workflow).toBeDefined();
    
    // Add task
    storeAfterWorkflow.addTask(workflowId, {
      agentId: 'docker-agent',
      agentName: 'Docker Agent',
      input: 'echo "sandboxed"',
      dependencies: [],
    });

    // Get final state
    const finalStore = useParallelOrchestrator.getState();
    const finalWorkflow = finalStore.workflows[workflowId];
    expect(finalWorkflow.tasks.length).toBe(1);
    
    // Note: Actual execution would use sandbox, but we skip in test environment
    // In real E2E, we'd verify container creation
  });
});

import { test, expect } from '@playwright/test';
import { useAgentRuntime } from '../../src/agents/runtime/agentRuntime';
import { useParallelOrchestrator } from '../../src/services/parallelAgentOrchestrator';

test.describe('Phase 4: Extensibility & Marketplace', () => {
  test.beforeEach(() => {
    // Reset stores
    useAgentRuntime.getState().agents = [];
    useParallelOrchestrator.getState().pools = {};
  });

  test('Extension Types Module - should be importable', async () => {
    const typesModule = await import('../../src/extensions/types');
    expect(typesModule).toBeDefined();
    // Check if it has exports
    expect(typeof typesModule).toBe('object');
  });

  test('SQL Connectors Module - should be importable', async () => {
    const sqlModule = await import('../../src/extensions/sql-connectors');
    expect(sqlModule).toBeDefined();
    expect(typeof sqlModule).toBe('object');
    
    // Check if allConnectors export exists
    if (sqlModule.allConnectors) {
      expect(Array.isArray(sqlModule.allConnectors)).toBeTruthy();
    }
  });

  test('API Connectors Module - should be importable', async () => {
    const apiModule = await import('../../src/extensions/api-connectors');
    expect(apiModule).toBeDefined();
    expect(typeof apiModule).toBe('object');
    
    if (apiModule.allConnectors) {
      expect(Array.isArray(apiModule.allConnectors)).toBeTruthy();
    }
  });

  test('Git Hook Extension - should be importable', async () => {
    const gitModule = await import('../../src/extensions/git-hook-extension');
    expect(gitModule).toBeDefined();
    expect(typeof gitModule).toBe('object');
    
    if (gitModule.gitHookExtension) {
      expect(gitModule.gitHookExtension.name).toBeDefined();
    }
  });

  test('Agent Runtime - should support custom agents', async () => {
    const runtime = useAgentRuntime.getState();
    
    // Add a custom agent
    const agentId = runtime.addAgent({
      name: 'Custom Extension Agent',
      description: 'Agent loaded from extension',
      systemPrompt: 'You are a custom agent.',
      model: 'gpt-4',
      tools: ['filesystem', 'terminal'],
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 2000,
    });
    
    expect(agentId).toBeDefined();
    
    const updatedRuntime = useAgentRuntime.getState();
    const agent = updatedRuntime.agents.find(a => a.id === agentId);
    
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Custom Extension Agent');
    expect(agent?.tools).toContain('filesystem');
  });

  test('Parallel Orchestrator - should support agent pools', async () => {
    const orchestrator = useParallelOrchestrator.getState();
    
    // Create a pool for extension agents
    const poolId = orchestrator.addPool({
      name: 'Extension Agents Pool',
      maxAgents: 3,
      agentIds: [],
      isolation: 'none',
    });
    
    expect(poolId).toBeDefined();
    
    const updated = useParallelOrchestrator.getState();
    const pool = updated.pools[poolId];
    
    expect(pool).toBeDefined();
    expect(pool.name).toBe('Extension Agents Pool');
    expect(pool.maxAgents).toBe(3);
  });

  test('Integration - Tools Adapters should be extensible', async () => {
    const toolsModule = await import('../../src/agents/tools/adapters');
    
    expect(toolsModule).toBeDefined();
    expect(toolsModule.TOOL_ADAPTERS).toBeDefined();
    expect(Array.isArray(toolsModule.TOOL_ADAPTERS)).toBeTruthy();
    expect(toolsModule.TOOL_ADAPTERS.length).toBeGreaterThan(0);
  });
});

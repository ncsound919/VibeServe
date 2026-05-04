import { test, expect } from '@playwright/test';

test.describe('Agent System', () => {
  test('should verify agent runtime imports', async () => {
    const { useAgentRuntime } = await import('../src/agents/runtime/agentRuntime');
    expect(useAgentRuntime).toBeDefined();
    expect(typeof useAgentRuntime.getState).toBe('function');
  });

  test('should verify memory store imports', async () => {
    const { useMemoryStore } = await import('../src/agents/memory/memoryStore');
    expect(useMemoryStore).toBeDefined();
    const state = useMemoryStore.getState();
    expect(typeof state.addEpisodic).toBe('function');
    expect(typeof state.addSemantic).toBe('function');
    expect(typeof state.addProcedural).toBe('function');
  });

  test('should verify audit store imports', async () => {
    const { useAuditStore } = await import('../src/agents/monitoring/auditStore');
    expect(useAuditStore).toBeDefined();
    const state = useAuditStore.getState();
    expect(typeof state.logEvent).toBe('function');
    expect(typeof state.getOverallStats).toBe('function');
  });

  test('should verify tool adapters', async () => {
    const { TOOL_ADAPTERS } = await import('../src/agents/tools/adapters');
    expect(TOOL_ADAPTERS.length).toBe(3);
    expect(TOOL_ADAPTERS.map(t => t.name)).toEqual(['terminal', 'git', 'filesystem']);
  });
});
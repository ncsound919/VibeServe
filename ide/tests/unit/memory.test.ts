import { test, expect } from '@playwright/test';
import { useMemoryStore } from '../src/agents/memory/memoryStore';

test.describe('Memory System', () => {
  test('should add episodic memories', async () => {
    const store = useMemoryStore.getState();
    
    const id = store.addEpisodic(
      'Fixed authentication bug',
      'success',
      { file: 'auth.ts', line: 42 },
      'Fixed null pointer exception in auth middleware'
    );
    
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(10);
    
    const memories = store.query({ tier: 'episodic' });
    expect(memories.length).toBe(1);
    expect(memories[0].content).toContain('Fixed null pointer');
  });

  test('should add error-solution memories', async () => {
    const store = useMemoryStore.getState();
    
    const id1 = store.addErrorSolution(
      'TypeError: undefined is not a function',
      'Added null check before calling method',
      'TypeError:undefined:function',
      'Added optional chaining operator'
    );
    
    expect(id1).toBeDefined();
    
    const id2 = store.addErrorSolution(
      'Same error again',
      'Applied same fix',
      'TypeError:undefined:function',
      'Fix already known'
    );
    
    expect(id2).toBe(id1);
    
    const memories = store.query({ tier: 'error-solutions' });
    expect(memories.length).toBe(1);
    expect(memories[0].content).toContain('Fix already known');
  });

  test('should track memory access', async () => {
    const store = useMemoryStore.getState();
    
    const id = store.addSemantic(
      'User authentication flow',
      0.8,
      'codebase',
      'OAuth2 implementation with JWT tokens'
    );
    
    const initial = store.getSession(id);
    expect(initial?.accessCount).toBe(0);
    
    store.accessMemory(id);
    
    const afterAccess = store.getSession(id);
    expect(afterAccess?.accessCount).toBe(1);
  });

  test('should calculate stats correctly', async () => {
    const store = useMemoryStore.getState();
    
    store.addEpisodic('Event 1', 'success', {}, 'First event');
    store.addSemantic('Knowledge', 0.5, 'doc', 'Some info');
    store.addProcedural('Procedure', ['step1', 'step2'], 'How to do something');
    
    const stats = store.getStats();
    
    expect(stats.totalMemories).toBe(3);
    expect(stats.byTier.episodic).toBe(1);
    expect(stats.byTier.semantic).toBe(1);
    expect(stats.byTier.procedural).toBe(1);
    expect(stats.byTier.graph).toBe(0);
    expect(stats.byTier['error-solutions']).toBe(0);
  });

  test('should consolidate memories', async () => {
    const store = useMemoryStore.getState();
    
    for (let i = 0; i < 10; i++) {
      store.addEpisodic(`Event ${i}`, 'success', {}, `Event ${i} content`);
    }
    
    expect(store.memories.length).toBe(10);
    
    store.consolidate();
    
    expect(store.memories.length).toBeLessThan(10);
  });
});
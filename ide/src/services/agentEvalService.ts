export interface EvalChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  testFile: string;
  prompt: string;
}

export interface EvalResult {
  id: string;
  challengeId: string;
  agentId: string;
  status: 'passed' | 'failed' | 'error';
  executionTimeMs: number;
  tokensUsed: number;
  output: string;
  error?: string;
  timestamp: number;
}

interface EvalStoreState {
  challenges: EvalChallenge[];
  results: EvalResult[];
  isEvaluating: boolean;
}

const state: EvalStoreState = {
  challenges: [
    {
      id: 'challenge-1',
      name: 'Type-safe Event Emitter',
      description: 'Build a generic event emitter with typed events and handlers.',
      difficulty: 'medium',
      testFile: 'eventEmitter.test.ts',
      prompt: 'Create a type-safe event emitter class that allows registering handlers for specific event types with proper TypeScript generics.',
    },
    {
      id: 'challenge-2',
      name: 'LRU Cache Implementation',
      description: 'Implement a performant LRU cache with TTL support.',
      difficulty: 'medium',
      testFile: 'lruCache.test.ts',
      prompt: 'Build an LRU (Least Recently Used) cache with get/set operations and optional TTL per entry.',
    },
    {
      id: 'challenge-3',
      name: 'Promise Pool',
      description: 'Control concurrency of async operations with a promise pool.',
      difficulty: 'hard',
      testFile: 'promisePool.test.ts',
      prompt: 'Implement a promise pool that limits concurrent promise execution to N at a time.',
    },
  ],
  results: [],
  isEvaluating: false,
};

const runEvaluation = async (challengeId: string, agentId: string): Promise<EvalResult> => {
  state.isEvaluating = true;
  const challenge = state.challenges.find(c => c.id === challengeId);

  if (!challenge) {
    state.isEvaluating = false;
    throw new Error(`Challenge ${challengeId} not found`);
  }

  // Simulate evaluation
  const startTime = Date.now();
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
  const executionTimeMs = Date.now() - startTime;

  const passed = Math.random() > 0.3;
  const tokensUsed = 500 + Math.floor(Math.random() * 2000);

  const result: EvalResult = {
    id: `result-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    challengeId,
    agentId,
    status: passed ? 'passed' : 'failed',
    executionTimeMs,
    tokensUsed,
    output: passed ? 'All tests passed' : 'Some tests failed',
    timestamp: Date.now(),
  };

  state.results.push(result);
  state.isEvaluating = false;

  return result;
};

const getScoreboard = () => {
  const scores: Record<string, { total: number; passed: number; passRate: number; avgTime: number }> = {};

  state.results.forEach(result => {
    if (!scores[result.agentId]) {
      scores[result.agentId] = { total: 0, passed: 0, passRate: 0, avgTime: 0 };
    }
    scores[result.agentId].total += 1;
    if (result.status === 'passed') {
      scores[result.agentId].passed += 1;
    }
    scores[result.agentId].avgTime = (scores[result.agentId].avgTime * (scores[result.agentId].total - 1) + result.executionTimeMs) / scores[result.agentId].total;
  });

  Object.keys(scores).forEach(agentId => {
    scores[agentId].passRate = (scores[agentId].passed / scores[agentId].total) * 100;
  });

  return scores;
};

export const useEvalStore = () => ({
  challenges: state.challenges,
  results: state.results,
  isEvaluating: state.isEvaluating,
  runEvaluation,
  getScoreboard,
});
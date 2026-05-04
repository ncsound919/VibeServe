import { test as base, type Page } from '@playwright/test';
import { NexusApp } from './pages/nexus.po';

type Fixtures = {
  nexus: NexusApp;
  mockDashboard: () => Promise<void>;
  mockEmpty: () => Promise<void>;
};

export const test = base.extend<Fixtures>({
  nexus: async ({ page }, use) => {
    await page.context().addInitScript(() => {
      localStorage.setItem('nexus_license', JSON.stringify({
        key: 'NEXUS-12AB-34CD-56EF-78GH',
        plan: 'standard',
        activatedAt: new Date().toISOString(),
        machineFingerprint: 'FP-00000001',
      }));
    });
    await page.route('**/api/**', async (route) => {
      const headers = await route.request().allHeaders();
      await route.continue({ headers: { ...headers, 'x-api-key': 'nexus-alpha-dev-key' } });
    });
    const app = new NexusApp(page);
    await use(app);
  },

  mockDashboard: async ({ page }, use) => {
    await page.route('**/api/data/**', async (route: any) => {
      await route.fulfill({ json: getMockDashboardData() });
    });
    await page.route('**/api/nexus/errors', async (route: any) => {
      await route.fulfill({ json: getMockNexusData() });
    });
    await page.route('**/api/nexus/progression', async (route: any) => {
      await route.fulfill({ json: getMockNexusData() });
    });
    await page.route('**/api/vibe/latest', async (route: any) => {
      await route.fulfill({ json: getMockVibeData() });
    });
    await page.route('**/api/toon/stats', async (route: any) => {
      await route.fulfill({ json: { averageSavingsPercent: 42 } });
    });
    await use(undefined);
  },

  mockEmpty: async ({ page }, use) => {
    await page.route('**/api/**', async (route: any) => {
      await route.fulfill({ json: {} });
    });
    await use(undefined);
  },
});

export { expect } from '@playwright/test';

function getMockDashboardData() {
  return {
    repos: [
      {
        name: 'test/repo1',
        stars: 1500,
        growth: 24,
        stack: 'TypeScript + React',
        utility: 'Web Framework',
        buildType: 'Frontend',
        tags: ['typescript', 'react'],
        aiAnalysis: 'Strong TypeScript patterns with excellent React usage.',
      },
      {
        name: 'test/repo2',
        stars: 3200,
        growth: 42,
        stack: 'Rust + WebAssembly',
        utility: 'Performance Layer',
        buildType: 'Library',
        tags: ['rust', 'wasm'],
        aiAnalysis: 'High-performance Rust code with WASM integration.',
      },
    ],
    videos: [
      {
        id: 'vid1',
        title: 'AI Advances 2026',
        channel: 'TechReview',
        views: 120000,
        publishedAt: new Date().toISOString(),
        thumbnailUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
        aspectMode: '4K SCAN',
      },
    ],
    growthRate: 42.5,
    activeDevelopers: 128,
    totalModels: 37,
    mcpStatus: {
      activeServers: 3,
      connections: 12,
      protocol: '1.0.0',
      lastPing: new Date().toISOString(),
    },
    sentimentScore: 0.85,
    growthHistory: Array.from({ length: 12 }, (_, i) => ({
      month: `M${i + 1}`,
      value: 1000 + i * 200,
    })),
    predictions: [
      { category: 'Growth', value: '+45%', confidence: 0.87 },
      { category: 'Adoption', value: '12K', confidence: 0.92 },
    ],
    openSourceStats: { totalRepos: 5, totalStars: 12000, topContributors: 24 },
    signals: [
      { source: 'GitHub', time: '12:00', signal: 'New release', value: 'v2.0' },
    ],
    news: [
      {
        id: 'n1',
        title: 'Nexus Alpha v2 Released',
        source: 'GitHub',
        timestamp: new Date().toISOString(),
        summary: 'Major update with E2E testing improvements.',
      },
    ],
    customAgents: [
      {
        id: 'agent-1',
        name: 'Agent-1',
        type: 'folder',
        status: 'active',
        lastActive: new Date().toISOString(),
        analysis: 'Cross-domain RAG stack | 84% recall',
      },
    ],
    cliState: {
      activeProvider: 'opencode',
      output: ['[SYSTEM] Nexus Alpha ready'],
    },
    buildPipeline: [
      { id: 'step-1', name: 'Code Lint', status: 'pending' },
      { id: 'step-2', name: 'Type Check', status: 'pending' },
      { id: 'step-3', name: 'Unit Tests', status: 'pending' },
    ],
    harvestSources: [],
    synergyInsights: [],
  };
}

function getMockNexusData() {
  return {
    stats: {
      totalErrors: 5,
      resolvedErrors: 3,
      recentFailureCount: 2,
      currentFailureStreak: 1,
      longestFailureStreak: 3,
      errorsByCategory: { network: 2, build: 1, api: 1, system: 1 },
      errorsBySeverity: { low: 2, medium: 2, high: 1 },
    },
    recent: [
      {
        id: 'err-1',
        message: 'Connection timeout on API gateway',
        category: 'network',
        severity: 'high',
        phase: 'pipeline',
        timestamp: new Date().toISOString(),
        resolved: false,
        recoveryAttempts: 2,
        recoveryAction: 'retry',
      },
      {
        id: 'err-2',
        message: 'Build failure: TypeScript compilation error',
        category: 'build',
        severity: 'medium',
        phase: 'build',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        resolved: true,
        recoveryAttempts: 1,
      },
    ],
    patterns: [
      {
        id: 'network-retry',
        errorPattern: 'Connection timeout on *',
        action: 'retry_with_backoff',
        successRate: 85,
        totalAttempts: 20,
        category: 'network',
      },
    ],
    progression: {
      level: 5,
      xp: 2400,
      xpToNext: 3000,
      rank: 'Silver',
    },
    achievements: [{ id: 'first-build', name: 'First Build', unlocked: true }],
    insights: ['Increase test coverage for better scores'],
  };
}

function getMockVibeData() {
  return {
    totalBuilds: 10,
    latestScore: {
      total: 65,
      maxTotal: 75,
      letter: 'B',
      gates: [
        { gate: 'Type Safety', passed: true, score: 18, maxScore: 20, details: ['No any types found'], warnings: [] },
        { gate: 'Code Quality', passed: true, score: 15, maxScore: 20, details: ['Good patterns'], warnings: ['Consider stricter lint'] },
        { gate: 'Security Audit', passed: false, score: 12, maxScore: 20, details: ['2 issues found'], warnings: [] },
        { gate: 'Bundle Health', passed: true, score: 10, maxScore: 10, details: ['Size: 240KB'], warnings: [] },
        { gate: 'Dependencies', passed: true, score: 5, maxScore: 5, details: ['Up to date'], warnings: [] },
      ],
      timestamp: new Date().toISOString(),
      buildId: 'build-123',
      repoCount: 2,
      durationMs: 45000,
      insights: ['Consider adding more type coverage', 'Bundle size is healthy'],
    },
    bestScore: 70,
    averageScore: 58,
    streak: 3,
    longestStreak: 7,
    trends: [
      { label: 'Build 1', score: 45 },
      { label: 'Build 2', score: 52 },
      { label: 'Build 3', score: 65 },
    ],
  };
}

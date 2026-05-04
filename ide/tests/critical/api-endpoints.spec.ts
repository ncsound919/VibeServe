import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3002';
const AUTH_HEADERS = { 'x-api-key': 'nexus-alpha-dev-key' };

test.describe('API Endpoints', () => {
  test('GET /health returns ok status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('ts');
  });

  test('GET /api/pipeline/status returns ws client count', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/pipeline/status`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('wsClients');
    expect(body).toHaveProperty('ts');
  });

  test('POST /api/pipeline/run requires repos array', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/pipeline/run`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/pipeline/run starts pipeline', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/pipeline/run`, {
      headers: AUTH_HEADERS,
      data: { repos: ['test/repo'], agentId: 'test-agent' },
      timeout: 15000,
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('started', true);
    expect(body).toHaveProperty('executionId');
  });

  test('GET /api/integrations/status returns service states', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/integrations/status`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('ts');
  });

  test('POST /api/integrations/agent/chat requires message', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/integrations/agent/chat`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/integrations/search/web works with query', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/integrations/search/web`, {
      headers: AUTH_HEADERS,
      data: { query: 'test query' },
      timeout: 15000,
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('results');
    expect(body).toHaveProperty('ts');
  });

  test('POST /api/integrations/memory/add requires userId and content', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/integrations/memory/add`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/wiki returns pages array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/wiki`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('pages');
    expect(body).toHaveProperty('stats');
  });

  test('POST /api/wiki/ingest requires source and content', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/wiki/ingest`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/wiki/ingest works with valid data', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/wiki/ingest`, {
      headers: AUTH_HEADERS,
      data: {
        source: 'test-source',
        content: '# Test\nTest content',
        metadata: { type: 'test' },
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('filename');
  });

  test('GET /api/wiki/lint returns results', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/wiki/lint`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('results');
  });

  test('POST /api/nexus/track requires valid event', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/nexus/track`, {
      headers: AUTH_HEADERS,
      data: { event: 'invalid-event' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/nexus/track pipeline-run event', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/nexus/track`, {
      headers: AUTH_HEADERS,
      data: { event: 'pipeline-run', data: { success: true, repoCount: 2 } },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('progression');
  });

  test('GET /api/nexus/errors returns error stats', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/nexus/errors`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('recent');
  });

  test('POST /api/nexus/errors/track requires message and phase', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/nexus/errors/track`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/nexus/errors/track creates error entry', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/nexus/errors/track`, {
      headers: AUTH_HEADERS,
      data: { message: 'Test error', phase: 'test', context: { source: 'e2e' } },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('recommendedRecovery');
  });

  test('POST /api/nexus/errors/resolve requires errorId', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/nexus/errors/resolve`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/nexus/errors/recovery returns patterns', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/nexus/errors/recovery`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('patterns');
  });

  test('GET /api/nexus/progression returns gamification data', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/nexus/progression`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('progression');
    expect(body).toHaveProperty('achievements');
    expect(body).toHaveProperty('insights');
  });

  test('GET /api/vibe/gates returns gate definitions', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/vibe/gates`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /api/vibe/check runs quality gates', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/vibe/check`, {
      headers: AUTH_HEADERS,
      data: { repoCount: 1, durationMs: 1000 },
      timeout: 15000,
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('letter');
  });

  test('GET /api/vibe/history returns build history', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/vibe/history`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('builds');
    expect(body).toHaveProperty('totalBuilds');
  });

  test('GET /api/settings/brain/status returns runtime info', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/settings/brain/status`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('brainApiReachable');
  });

  test('GET /api/settings/brain/config returns lane config', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/settings/brain/config`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('lanes');
    expect(body).toHaveProperty('routerModel');
  });

  test('GET /api/settings/integrations returns service statuses', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/settings/integrations`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('services');
  });

  test('POST /api/autoresearch/start begins autonomous loop', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/autoresearch/start`, {
      headers: AUTH_HEADERS,
      data: { repos: ['test/repo'], maxIterations: 1 },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('started', true);
  });

  test('GET /api/autoresearch/status returns loop state', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/autoresearch/status`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
  });

  test('GET /api/graphify/summary returns graph state', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/graphify/summary`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('available');
  });

  test('GET /api/local-infra returns infrastructure status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/local-infra`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('mode');
  });

  test('POST /api/folders/upload requires name and files', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/folders/upload`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/folders/upload with valid data', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/folders/upload`, {
      headers: AUTH_HEADERS,
      data: {
        name: 'test-folder',
        files: [{ path: 'test.ts', content: 'console.log("hello");' }],
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('folderId');
    expect(body).toHaveProperty('fileCount', 1);
  });

  test('POST /api/brain/query requires query', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/brain/query`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/brain/query processes valid query', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/brain/query`, {
      headers: AUTH_HEADERS,
      data: { query: 'test query', lane: 'coding' },
      timeout: 15000,
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('result');
  });

  test('POST /api/brain/browser requires command', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/brain/browser`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/github/create-repo requires name', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/github/create-repo`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/github/push-files requires mandatory fields', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/github/push-files`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/wiki/raw returns raw files', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/wiki/raw`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('files');
  });

  test('GET /api/wiki/:slug returns 404 for unknown page', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/wiki/nonexistent-page`, { headers: AUTH_HEADERS });
    expect(res.status()).toBe(404);
  });

  test('POST /api/wiki/compile-all compiles all raw files', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/wiki/compile-all`, {
      headers: AUTH_HEADERS,
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('pages');
  });

  test('POST /api/toon/compress requires content', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/toon/compress`, {
      headers: AUTH_HEADERS,
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/toon/stats returns compression stats', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/toon/stats`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
  });

  test('GET /api/data/repos fetches trending repos', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/data/repos`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('repos');
  });

  test('GET /api/data/videos fetches AI videos', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/data/videos`, { headers: AUTH_HEADERS });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('videos');
  });

  test('POST /api/proxy/gemini requires prompt', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/proxy/gemini`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/proxy/cli/stream requires provider and messages', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/proxy/cli/stream`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

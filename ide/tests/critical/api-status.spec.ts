import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3002';
const AUTH_HEADER = { 'x-api-key': 'nexus-alpha-dev-key' };

test.describe('API Health', () => {
  test('GET /health returns ok status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('ts');
  });

  test('GET /api/coding-agent/apps returns array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/coding-agent/apps`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data.apps)).toBeTruthy();
  });

  test('GET /api/deploy/availability returns boolean flags', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/deploy/availability`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(typeof data.docker).toBe('boolean');
    expect(typeof data.vercel).toBe('boolean');
    expect(typeof data.zip).toBe('boolean');
  });

  test('GET /api/pipeline/status returns ws client count', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/pipeline/status`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('wsClients');
    expect(typeof data.wsClients).toBe('number');
  });

  test('POST /api/pipeline/generate requires description', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/pipeline/generate`, {
      headers: AUTH_HEADER,
      data: {},
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /api/vibe/gates returns gate definitions', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/vibe/gates`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/vibe/history returns build history', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/vibe/history`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('builds');
    expect(data).toHaveProperty('totalBuilds');
  });

  test('GET /api/settings/brain/status returns runtime info', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/settings/brain/status`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('brainApiReachable');
  });

  test('GET /api/settings/integrations returns service statuses', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/settings/integrations`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('services');
  });

  test('GET /api/local-infra returns infrastructure status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/local-infra`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('mode');
  });

  test('GET /api/data/repos returns repos array', async ({ request }) => {
    test.skip(true, 'Requires GitHub API connectivity');
    const res = await request.get(`${API_BASE}/api/data/repos`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('repos');
  });

  test('GET /api/data/videos returns videos array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/data/videos`, {
      headers: AUTH_HEADER,
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('videos');
  });
});

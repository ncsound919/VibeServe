import { test, expect } from '@playwright/test';

// End-to-end API tests for the Nexus Alpha core intelligence routes

test.describe('Nexus Core API', () => {
  const API_KEY = process.env.NEXUS_API_KEY || 'nexus-alpha-dev-key';

  test('GET /api/nexus/progression returns user progress', async ({ request }) => {
    const resp = await request.get('/api/nexus/progression', {
      headers: { 'x-nexus-api-key': API_KEY }
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('level');
    expect(json).toHaveProperty('experience');
    expect(json).toHaveProperty('badges');
    expect(Array.isArray(json.badges)).toBeTruthy();
  });

  test('GET /api/nexus/errors returns system error count', async ({ request }) => {
    const resp = await request.get('/api/nexus/errors', {
      headers: { 'x-nexus-api-key': API_KEY }
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('errors');
    expect(json).toHaveProperty('count');
    expect(Array.isArray(json.errors)).toBeTruthy();
  });

  test('POST /api/tools/debt returns technical debt report', async ({ request }) => {
    const resp = await request.post('/api/tools/debt', {
      data: { content: 'TODO: fix this complexity' },
      headers: { 
        'Content-Type': 'application/json',
        'x-nexus-api-key': API_KEY 
      },
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('debtScore');
    expect(json).toHaveProperty('complexity');
    expect(json).toHaveProperty('recommendation');
    expect(typeof json.recommendation).toBe('string');
  });

  test('GET /api/vibe/history returns history array', async ({ request }) => {
    const resp = await request.get('/api/vibe/history', {
      headers: { 'x-nexus-api-key': API_KEY }
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('history');
    expect(Array.isArray(json.history)).toBeTruthy();
  });
});

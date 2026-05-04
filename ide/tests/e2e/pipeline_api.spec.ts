import { test, expect, APIRequestContext } from '@playwright/test';

// End-to-end API tests for Nexus Alpha's real tool integration

test.describe('Real Tools API', () => {
  test('POST /api/tools/run build returns stdout', async ({ request }) => {
    // Use direct HTTP to avoid needing the frontend
    const resp = await request.post('http://localhost:3002/api/tools/run', {
      data: { tool: 'build' },
      headers: { 
        'Content-Type': 'application/json',
        'x-nexus-api-key': process.env.NEXUS_API_KEY || 'nexus-alpha-dev-key'
      },
    });
    expect(resp.ok).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('tool', 'build');
    expect(json).toHaveProperty('result');
    expect(json.result).toHaveProperty('stdout');
  });

  test('POST /api/tools/run audit returns stderr', async ({ request }) => {
    const resp = await request.post('http://localhost:3002/api/tools/run', {
      data: { tool: 'audit' },
      headers: { 
        'Content-Type': 'application/json',
        'x-nexus-api-key': process.env.NEXUS_API_KEY || 'nexus-alpha-dev-key'
      },
    });
    expect(resp.ok).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('tool', 'audit');
    expect(json).toHaveProperty('result');
    // Even if the audit runs, it should produce some stdout/stderr fields
    expect(typeof json.result.stdout).toBe('string');
    expect(typeof json.result.stderr).toBe('string');
  });
});

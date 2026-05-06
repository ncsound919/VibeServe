import { test, expect } from '@playwright/test';

test.describe('E-Commerce Pipeline Benchmark', () => {
  test('build baby shopify via pipeline', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');

    // 1. Verify IDE loaded
    await expect(page.locator('text=VibeServe').first()).toBeVisible({ timeout: 5000 });
    const loadTime = Date.now() - startTime;
    console.log(`[Benchmark] IDE load: ${loadTime}ms`);

    // 2. Click Pipeline button in title bar to enter pipeline mode
    const pipelineBtn = page.locator('button').filter({ hasText: 'Pipeline' }).first();
    await pipelineBtn.click();
    await page.waitForTimeout(500);

    // 3. Open the AI Composer panel if not visible
    // Use Ctrl+Shift+M to toggle autonomy mode to Pipeline
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(300);
    // Press again if needed to cycle to pipeline
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(300);

    // 4. Submit e-commerce prompt via API directly
    const promptTime = Date.now();
    const chatResponse = await page.evaluate(async () => {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Build a baby shopify e-commerce platform with: product catalog, shopping cart, checkout flow, user auth, order history. Use React + TypeScript + Tailwind.'
        }),
      });
      return { status: res.status, data: await res.json() };
    });
    console.log(`[Benchmark] AI chat response: ${chatResponse.status} — ${JSON.stringify(chatResponse.data).slice(0, 100)}`);
    const promptResponseTime = Date.now() - promptTime;
    console.log(`[Benchmark] AI response time: ${promptResponseTime}ms`);

    // 5. Start pipeline via API
    const pipelineStart = Date.now();
    const pipelineResponse = await page.evaluate(async () => {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'pipeline' }),
      });
      return { status: res.status, data: await res.json() };
    });
    console.log(`[Benchmark] Pipeline start: ${pipelineResponse.status} — ${JSON.stringify(pipelineResponse.data)}`);

    // 6. Poll pipeline status for progress
    let pipelineComplete = false;
    let pollCount = 0;
    const maxPolls = 30;
    const pipelineSteps: Record<string, { startTime: number; endTime: number }> = {};

    while (!pipelineComplete && pollCount < maxPolls) {
      await page.waitForTimeout(2000);
      pollCount++;

      const status = await page.evaluate(async () => {
        const res = await fetch('/api/pipeline/status');
        if (!res.ok) return null;
        return res.json();
      });

      if (status) {
        console.log(`[Benchmark] Poll #${pollCount}: ${JSON.stringify(status)}`);
        if (status.steps) {
          for (const step of status.steps) {
            if (!pipelineSteps[step.id]) {
              pipelineSteps[step.id] = { startTime: Date.now(), endTime: 0 };
            }
            if (step.status === 'done' || step.status === 'error') {
              pipelineSteps[step.id].endTime = Date.now();
            }
          }
        }
        if (status.complete) pipelineComplete = true;
      }
    }

    // 7. Check file system for generated files
    const fileCheckTime = Date.now();
    const files = await page.evaluate(async () => {
      const res = await fetch('/api/files/list?path=.');
      if (!res.ok) return [];
      const data = await res.json();
      return data.slice(0, 10);
    });
    console.log(`[Benchmark] Files in workspace: ${files.length} entries`);

    // 8. Benchmark report
    const totalTime = Date.now() - startTime;
    console.log('\n=== BENCHMARK REPORT ===');
    console.log(`IDE load time: ${loadTime}ms`);
    console.log(`AI response time: ${promptResponseTime}ms`);
    console.log(`Pipeline polls: ${pollCount}`);
    console.log(`Total test time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log(`Pipeline steps:`, JSON.stringify(pipelineSteps, null, 2));
    console.log('========================\n');

    // Take screenshot of final state
    await page.screenshot({ path: 'tests/e2e/screenshots/pipeline-final.png', fullPage: true });

    // Assertions
    expect(loadTime).toBeLessThan(5000);
    expect(chatResponse.status).toBe(200);
    expect(pipelineResponse.status).toBe(200);
  });
});

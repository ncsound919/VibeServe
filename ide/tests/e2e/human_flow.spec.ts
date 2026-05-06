import { test, expect } from '../fixtures';

test.describe('Human-like Workspace Flow', () => {
  test('should execute the full developer journey: compose, review, and analyze pipeline', async ({ page, nexus }) => {
    // 1. Initial Access with a bit of buffer for the backend to fully settle
    await nexus.goto();
    
    // Mock the templates and generation for stability
    await nexus.mockApi('**/api/coding/templates', {
      templates: [{ appType: 'react-vite', name: 'React Vite', description: 'Modern React' }]
    });

    await nexus.mockApi('**/api/coding/generate', {
      success: true,
      templateId: 'react-vite',
      appPath: 'test-app',
      files: ['src/generated/App.tsx', 'src/generated/Layout.tsx']
    });

    await nexus.mockApi('**/api/composer/apply', {
      success: true
    });

    await page.waitForTimeout(2000); 
    await expect(page).toHaveTitle(/Nexus Alpha/);

    // 2. Start a new project in Composer
    await nexus.navigateTo('Composer');
    await expect(nexus.getSectionHeader('Composer')).toBeVisible();

    const prompt = 'Create a real-time analytics dashboard with React, featuring dark mode and glassmorphism styling.';
    const promptInput = page.getByPlaceholder(/What should I build/);
    await promptInput.fill(prompt);
    
    // 3. Trigger Synthesis
    const generateBtn = page.getByRole('button', { name: /Generate Project/ });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // 4. Observe the Multi-Agent Reasoning or skip to results if fast
    const reasoningTrace = page.locator('text=Agent Reasoning Trace');
    const results = page.locator('.glass-card').filter({ has: page.locator('svg.lucide-code') }).first();
    
    await expect(reasoningTrace.or(results)).toBeVisible({ timeout: 15000 });
    
    // 5. Wait for synthesis completion state
    // If we have results, we are done with synthesis
    if (!(await results.isVisible())) {
      await expect(page.locator('text=Synthesis complete').or(page.locator('text=ready in Editor')), { timeout: 60000 }).toBeVisible();
    }
    
    // 6. Inspect the generated files (looking for any file path starting with src/)
    const fileCard = page.locator('.glass-card').filter({ has: page.locator('svg.lucide-code') }).first();
    await expect(fileCard).toBeVisible();

    // 7. Accept a change (approving the scaffold)
    const acceptBtn = fileCard.locator('button').filter({ has: page.locator('svg.lucide-check') });
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await expect(page.locator('text=ACCEPTED').or(page.locator('text=success')), { timeout: 5000 }).toBeVisible();
    }

    // 8. Pivot to the Pipeline
    await nexus.navigateTo('Pipeline');
    await page.waitForSelector('text=Nexus Automated Pipeline', { state: 'visible', timeout: 10000 });
    await expect(nexus.getSectionHeader('Nexus Automated Pipeline')).toBeVisible();

    // 9. Inspect Technical Debt Radar (Footer check)
    const debtRadar = page.locator('button').filter({ hasText: /DEBT/ });
    await expect(debtRadar).toBeVisible();
    await debtRadar.click();
    
    await expect(page.locator('text=Technical Debt Radar')).toBeVisible();

    // 10. Final check: System Metrics
    await nexus.navigateTo('System');
    await expect(page.locator('text=System Metrics').or(page.locator('text=Cluster Mem'))).toBeVisible();
  });
});

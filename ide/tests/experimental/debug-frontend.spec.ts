import { test, expect } from '@playwright/test';

test('check for console errors on homepage', async ({ page }) => {
  const errors: string[] = [];
  const logs: string[] = [];
  
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.goto('http://localhost:3000/', { timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('=== ALL CONSOLE OUTPUT ===');
  logs.forEach(l => console.log(l));
  console.log('=== ERRORS ONLY ===');
  errors.forEach(e => console.log(e));
  console.log('=== ROOT CONTENT ===');
  console.log(await page.locator('#root').innerHTML());
});

import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  await context.addInitScript(() => {
    localStorage.setItem('nexus_license', JSON.stringify({
      key: 'NEXUS-12AB-34CD-56EF-78GH',
      plan: 'standard',
      activatedAt: new Date().toISOString(),
      machineFingerprint: 'FP-00000001',
    }));
  });

  const page = await context.newPage();
  
  const logs: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') logs.push(msg.text());
  });
  page.on('pageerror', err => logs.push(`PAGE: ${err.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.locator('aside button').last().click();
  await page.waitForTimeout(500);
  
  await page.locator('#nav-item-pipeline').click();
  await page.waitForTimeout(2000);
  
  // Filter for the specific error
  const filtered = logs.filter(l => l.includes('Cannot read') || l.includes('undefined'));
  console.log('=== ERRORS ===');
  for (const l of filtered) {
    console.log(l);
  }
  
  await browser.close();
}

debug().catch(console.error);
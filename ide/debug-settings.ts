import { chromium } from 'playwright';

async function debugSettings() {
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
  
  const allLogs: string[] = [];
  page.on('console', msg => allLogs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => allLogs.push(`PAGE ERROR: ${err.message}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.locator('aside button').last().click();
  await page.waitForTimeout(500);
  
  // Click Settings
  await page.locator('#nav-item-settings').click();
  await page.waitForTimeout(3000);
  
  const content = await page.locator('main').innerText();
  console.log('Content length:', content.length);
  console.log('Content preview:', content.substring(0, 200));
  
  // Filter actual errors (not 500s)
  const realErrors = allLogs.filter(l => 
    l.includes('ReferenceError') || 
    l.includes('TypeError') ||
    l.includes('process is not defined') ||
    (l.includes('error') && !l.includes('500') && !l.includes('favicon'))
  );
  
  console.log('\n=== REAL ERRORS ===');
  for (const e of realErrors.slice(0, 5)) {
    console.log(e.substring(0, 150));
  }
  
  await browser.close();
}

debugSettings().catch(console.error);
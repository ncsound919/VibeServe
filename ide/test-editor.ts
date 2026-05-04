import { chromium } from 'playwright';

async function testEditorTab() {
  const browser = await chromium.launch({ headless: true });
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
  
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  console.log('Loading app...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  
  const TABS = [
    { name: 'Memory', id: 'nav-item-memory' },
    { name: 'Editor', id: 'nav-item-editor' },
    { name: 'Composer', id: 'nav-item-composer' },
    { name: 'Review', id: 'nav-item-review' },
    { name: 'Overview', id: 'nav-item-overview' },
    { name: 'Settings', id: 'nav-item-settings' },
  ];
  await page.waitForTimeout(3000);
  
  // Click Memory first
  console.log('\n=== Testing All Tabs ===\n');
  
  for (const tab of TABS) {
    const tabErrors: string[] = [];
    const handler = (msg: any) => { if (msg.type() === 'error') tabErrors.push(msg.text()); };
    page.on('console', handler);
    
    console.log(`Clicking ${tab.name}...`);
    await page.locator(`#${tab.id}`).click();
    await page.waitForTimeout(1500);
    
    const content = await page.locator('main').innerText().catch(() => '');
    const hasContent = content.length > 10;
    
    page.off('console', handler);
    const criticalErrors = tabErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('ERR_BLOCKED') && 
      !e.includes('WebSocket') &&
      !e.includes('429') &&
      !e.includes('500')
    );
    
    if (criticalErrors.length > 0) {
      console.log(`  ❌ Errors: ${criticalErrors.length}`);
      for (const e of criticalErrors.slice(0,2)) {
        console.log(`     - ${e.substring(0,100)}`);
      }
    } else if (!hasContent) {
      console.log(`  ⚠️  No content`);
    } else {
      console.log(`  ✅ OK (${content.length} chars)`);
    }
  }
  
  console.log('\n=== Console Errors after clicking Editor ===');
  for (const e of consoleErrors) {
    if (!e.includes('favicon') && !e.includes('ERR_BLOCKED')) {
      console.log('- ', e.substring(0, 200));
    }
  }
  
  await browser.close();
}

testEditorTab().catch(console.error);
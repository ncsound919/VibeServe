import { chromium } from 'playwright';

const TABS = [
  { name: 'Overview', id: 'nav-item-overview' },
  { name: 'VibeCoder', id: 'nav-item-vibecoder' },
  { name: 'Command Center', id: 'nav-item-command-center' },
  { name: 'Pipeline', id: 'nav-item-pipeline' },
  { name: 'Activity', id: 'nav-item-activity' },
  { name: 'History', id: 'nav-item-history' },
  { name: 'Settings', id: 'nav-item-settings' },
  { name: 'Memory', id: 'nav-item-memory' },
  { name: 'Editor', id: 'nav-item-editor' },
  { name: 'Review', id: 'nav-item-review' },
  { name: 'Audit', id: 'nav-item-audit' },
  { name: 'YouTube Pulse', id: 'nav-item-youtube-pulse' },
  { name: 'Repo Analysis', id: 'nav-item-repo-analysis' },
  { name: 'LLM Wiki', id: 'nav-item-llm-wiki' },
];

async function testTabs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Set license
  await context.addInitScript(() => {
    localStorage.setItem('nexus_license', JSON.stringify({
      key: 'NEXUS-12AB-34CD-56EF-78GH',
      plan: 'standard',
      activatedAt: new Date().toISOString(),
      machineFingerprint: 'FP-00000001',
    }));
  });

  const page = await context.newPage();
  
  const allErrors: { tab: string; error: string }[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore non-critical
      if (!text.includes('favicon') && 
          !text.includes('Failed to load resource') &&
          !text.includes('ERR_BLOCKED_BY_CLIENT') &&
          !text.includes('WebSocket') &&
          !text.includes('ERR_CONNECTION_REFUSED')) {
        allErrors.push({ tab: 'GLOBAL', error: text });
      }
    }
  });

  page.on('pageerror', (err) => {
    allErrors.push({ tab: 'GLOBAL', error: `PAGE ERROR: ${err.message}` });
  });

  console.log('🚀 Loading app...\n');
  
  await page.goto('http://localhost:3012/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check if loaded
  const bodyText = await page.locator('body').innerText();
  if (bodyText.length < 100) {
    console.log('❌ App failed to load - body text:', bodyText.substring(0, 200));
    await browser.close();
    return;
  }
  console.log('✅ App loaded\n');

  for (const tab of TABS) {
    console.log(`➡️  Clicking ${tab.name}...`);
    
    const tabErrors: string[] = [];
    const handler = (msg: any) => {
      if (msg.type() === 'error') {
        tabErrors.push(msg.text());
      }
    };
    page.on('console', handler);
    
    try {
      const btn = page.locator(`#${tab.id}`);
      const exists = await btn.count();
      if (exists === 0) {
        console.log(`   ⚠️  Button #${tab.id} not found`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(1500);
      
      // Check main content
      const mainText = await page.locator('main').innerText().catch(() => '');
      if (mainText.length < 5) {
        console.log(`   ❌ Empty main content after click`);
      } else {
        console.log(`   ✅ Content loaded (${mainText.length} chars)`);
      }
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}`);
    }
    
    // Remove handler and collect errors
    page.off('console', handler);
    if (tabErrors.length > 0) {
      console.log(`   ⚠️  Errors: ${tabErrors.join('; ')}`);
      allErrors.push(...tabErrors.map(e => ({ tab: tab.name, error: e })));
    }
  }

  console.log('\n=== SUMMARY ===\n');
  if (allErrors.length === 0) {
    console.log('✅ No errors found!');
  } else {
    console.log('❌ Errors found:');
    for (const e of allErrors) {
      console.log(`  - [${e.tab}] ${e.error.substring(0, 150)}`);
    }
  }

  await browser.close();
}

testTabs().catch(console.error);
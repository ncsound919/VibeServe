import { chromium } from 'playwright';

async function checkLastFour() {
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
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.locator('aside button').last().click();
  await page.waitForTimeout(500);
  
  const tabs = ['Command Center', 'Settings', 'Extensions', 'System', 'Agent Eval'];
  
  for (const name of tabs) {
    const id = `nav-item-${name.toLowerCase().replace(' ', '-')}`;
    await page.locator(`#${id}`).click();
    await page.waitForTimeout(1500);
    const content = await page.locator('main').innerText();
    const isOk = content.length > 50 && !content.toLowerCase().includes('failed to load');
    console.log(`${name}: ${content.length} chars, OK=${isOk}`);
  }
  
  await browser.close();
}

checkLastFour().catch(console.error);
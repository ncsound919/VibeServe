import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });

  try {
    await page.goto('http://localhost:3004', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait a bit more for any async errors
    await page.waitForTimeout(3000);
    
    // Get page title and HTML content
    const title = await page.title();
    const bodyText = await page.locator('body').textContent().catch(() => 'No body text');
    
    console.log('=== PAGE INFO ===');
    console.log('Title:', title);
    console.log('Body text length:', bodyText.length);
    console.log('Body preview:', bodyText.substring(0, 200));
    
    console.log('\n=== CONSOLE ERRORS ===');
    if (errors.length === 0) {
      console.log('No console errors found!');
    } else {
      errors.forEach(e => console.log(e));
    }
    
    // Check if page is blank
    const isBlank = bodyText.trim().length === 0;
    console.log('\n=== RESULT ===');
    console.log('Is blank:', isBlank);
    
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  await browser.close();
})();
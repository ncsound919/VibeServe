import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const errors = [];
const logs = [];

page.on('console', msg => {
  const text = msg.text();
  logs.push(`[${msg.type()}] ${text}`);
  if (msg.type() === 'error') errors.push(text);
});

page.on('pageerror', err => {
  errors.push(`PAGE ERROR: ${err.message}\n${err.stack}`);
});

console.log('=== NAVIGATING TO APP ===');
await page.goto('http://localhost:3009', { waitUntil: 'load', timeout: 20000 });

console.log('=== WAITING FOR REACT TO MOUNT ===');
await page.waitForTimeout(3000);

// Check if React root has content
console.log('\n=== ROOT ELEMENT ANALYSIS ===');
const rootHTML = await page.locator('#root').innerHTML();
console.log('Root innerHTML length:', rootHTML.length);
console.log('Root content preview:', rootHTML.substring(0, 300));

// Check body
console.log('\n=== BODY ANALYSIS ===');
const bodyHTML = await page.locator('body').innerHTML();
console.log('Body innerHTML length:', bodyHTML.length);
console.log('Body content:', bodyHTML.substring(0, 500));

// Check for any error boundaries
console.log('\n=== LOOKING FOR ERROR MESSAGES ===');
const errorText = await page.locator('text=/error|Error|failed|Failed/i').first().textContent().catch(() => 'none');
console.log('Found error text:', errorText);

// Check network for failed requests
console.log('\n=== CHECKING NETWORK ===');
const failedRequests = [];
page.on('requestfailed', request => {
  failedRequests.push(`${request.url()} - ${request.failure().errorText}`);
});
await page.waitForTimeout(2000);
if (failedRequests.length > 0) {
  console.log('Failed requests:', failedRequests);
} else {
  console.log('No failed requests detected');
}

console.log('\n=== CONSOLE ERRORS ===');
if (errors.length === 0) console.log('NO CONSOLE ERRORS');
errors.forEach(e => console.log(e));

console.log('\n=== ALL CONSOLE LOGS ===');
logs.slice(0, 30).forEach(l => console.log(l));

// Try to evaluate JS in page context
console.log('\n=== CHECKING WINDOW OBJECTS ===');
const hasReact = await page.evaluate(() => !!document.getElementById('root'));
console.log('Has #root:', hasReact);

const reactRoot = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    exists: !!root,
    innerHTML: root ? root.innerHTML.substring(0, 200) : 'N/A',
    children: root ? root.children.length : 0
  };
});
console.log('React root state:', reactRoot);

console.log('\n=== DONE ===');
// await browser.close();
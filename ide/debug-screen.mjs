import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
const logs = [];

page.on('console', msg => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
  if (msg.type() === 'error') errors.push(msg.text());
});

page.on('pageerror', err => {
  errors.push(`PAGE ERROR: ${err.message}`);
});

console.log('Navigating to http://localhost:3008...');
await page.goto('http://localhost:3008', { waitUntil: 'domcontentloaded', timeout: 15000 });

console.log('Waiting for page to render...');
await page.waitForTimeout(5000);

// Get page info
const title = await page.title();
console.log(`\n=== Page Title: ${title} ===`);

// Check what's in the DOM
const rootContent = await page.locator('#root').innerHTML().catch(() => 'NOT FOUND');
console.log(`\n=== #root innerHTML length: ${rootContent.length} ===`);
console.log(rootContent.substring(0, 500));

// Check for any visible elements
const bodyChildren = await page.locator('body > *').count();
console.log(`\n=== Body children count: ${bodyChildren} ===`);

// Get all console logs
console.log('\n=== ALL CONSOLE LOGS ===');
logs.forEach(l => console.log(l));

// Get errors
console.log('\n=== ERRORS ===');
if (errors.length === 0) console.log('No errors!');
errors.forEach(e => console.log(e));

// Check network failures
console.log('\n=== CHECKING FOR JS FILES ===');
const scripts = await page.locator('script').evaluateAll(scripts => 
  scripts.map(s => ({ src: s.src, type: s.type }))
);
console.log('Scripts found:', scripts.length);
scripts.forEach(s => console.log(` - ${s.src}`));

await browser.close();
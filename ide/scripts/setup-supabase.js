import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const projectId = 'aganpaepissvuamstmol';
  const schemaPath = path.join(__dirname, '..', 'integration', 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Launching browser...');
  
  // Clean up user data if it exists to avoid lock/compatibility issues
  const userDataDir = path.join(__dirname, 'user-data');
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to SQL editor...');
  await page.goto(`https://supabase.com/dashboard/project/${projectId}/sql`);

  console.log('--------------------------------------------------');
  console.log('PLEASE LOG IN MANUALLY IN THE BROWSER.');
  console.log('After logging in and reaching the SQL Editor,');
  console.log('press Enter in this terminal to continue.');
  console.log('--------------------------------------------------');
  
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once('data', resolve));

  console.log('Creating new query...');
  // Use a more specific selector if possible, but keeping it general for now
  await page.getByRole('button', { name: /new query/i }).click();

  console.log('Pasting schema...');
  // Click in the editor area
  await page.mouse.click(500, 300);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(schemaContent);

  console.log('Running query...');
  const runButton = page.locator('button:has-text("Run")').first();
  await runButton.click();

  console.log('Script finished.');
}

run().catch(console.error);

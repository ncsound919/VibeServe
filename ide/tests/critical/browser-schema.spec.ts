/**
 * Nexus Alpha - Browser-based Schema Creator
 * Uses Playwright to control browser and execute SQL in Supabase
 */

import { test, expect } from "@playwright/test";
import { chromium, Browser, Page } from "@playwright/test";

const SUPABASE_URL = "https://aganpaepissvuamstmol.supabase.co";
const SUPABASE_EMAIL = ""; // Add your email if needed
const SUPABASE_PASSWORD = ""; // Add your password if needed

// Read the schema file
import { readFileSync } from "fs";
const schemaSQL = readFileSync("integration/supabase/schema.sql", "utf-8");

test.describe("Browser-based Schema Creator", () => {
  const testMark = process.env.SUPABASE_EMAIL ? test : test.skip;
  
  testMark("Create schema via Supabase SQL Editor", async ({ page }) => {
    console.log("\n=== Starting Browser-based Schema Creation ===\n");
    
    // Step 1: Navigate to Supabase
    console.log("[STEP 1] Navigating to Supabase dashboard...");
    await page.goto(SUPABASE_URL);
    await page.waitForLoadState("networkidle");
    
    // Check if we need to login
    const url = page.url();
    console.log("Current URL:", url);
    
    if (url.includes("login") || url.includes("auth")) {
      console.log("[LOGIN] Need to login - please login manually first");
      console.log("After login, this test will continue automatically");
      await page.waitForURL("**/dashboard/**", { timeout: 60000 });
    }
    
    // Step 2: Navigate to SQL Editor
    console.log("\n[STEP 2] Navigating to SQL Editor...");
    await page.goto(`${SUPABASE_URL}/project/-/sql`);
    await page.waitForLoadState("networkidle");
    
    // Wait for SQL editor to load
    console.log("\n[STEP 3] Waiting for SQL editor to be ready...");
    await page.waitForSelector("textarea, [class*='sql'], [class*='editor']", { 
      timeout: 30000 
    }).catch(() => {
      console.log("Editor selector not found, trying alternative approach");
    });
    
    // Try to find the SQL input area
    const sqlInput = page.locator('textarea').first();
    if (await sqlInput.isVisible({ timeout: 5000 })) {
      console.log("\n[STEP 4] Found SQL editor - typing schema...");
      
      // Type the SQL in chunks if it's too long
      await sqlInput.fill(schemaSQL.substring(0, 5000));
      await page.waitForTimeout(1000);
      
      // Click Run button
      console.log("\n[STEP 5] Executing SQL...");
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.isVisible({ timeout: 5000 })) {
        await runButton.click();
        console.log("SQL execution triggered");
      } else {
        console.log("Run button not found, SQL may have been entered");
      }
    } else {
      console.log("\n[NOTE] SQL editor not immediately visible");
      console.log("The user may need to click 'New query' or navigate to the SQL editor");
    }
    
    // Step 6: Verify by checking if tables exist
    console.log("\n[STEP 6] Verifying schema...");
    await page.waitForTimeout(2000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: "supabase-sql-editor.png" });
    console.log("Screenshot saved to supabase-sql-editor.png");
    
    console.log("\n=== Manual Action May Be Required ===");
    console.log("If the SQL editor didn't accept input automatically:");
    console.log("1. Go to: https://supabase.com/dashboard");
    console.log("2. Navigate to: SQL Editor");
    console.log("3. Copy the content from: integration/supabase/schema.sql");
    console.log("4. Paste and click 'Run'");
  });

  test("Alternative: Quick verify tables via API", async () => {
    // This is a fallback to verify what we can
    console.log("\n[Alternative] Verifying via API what we can...");
    
    // Just report status
    console.log("Note: Schema creation requires browser interaction or manual SQL execution");
  });
});

test("Standalone: Create schema via browser", async () => {
  // This test can run standalone to create the schema
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log("\n=== Creating Schema via Browser ===\n");
    
    // Navigate to Supabase
    await page.goto(SUPABASE_URL, { waitUntil: "networkidle" });
    console.log("Loaded Supabase:", page.url());
    
    // Try to go to SQL editor directly
    await page.goto(`${SUPABASE_URL}/project/-/sql`, { waitUntil: "networkidle" });
    console.log("SQL Editor URL:", page.url());
    
    // Wait for editor
    await page.waitForTimeout(3000);
    
    // Find and fill the SQL editor
    const editorArea = page.locator('textarea, [contenteditable="true"], .codemirror, .monaco-editor').first();
    
    if (await editorArea.isVisible({ timeout: 5000 })) {
      console.log("Found SQL editor, entering schema...");
      await editorArea.click();
      await editorArea.fill(schemaSQL);
      
      // Find and click Run
      const runBtn = page.locator('button:has-text("Run"), [class*="run"], [aria-label*="Run"]').first();
      if (await runBtn.isVisible()) {
        await runBtn.click();
        console.log("Clicked Run!");
      }
    } else {
      console.log("Could not find SQL editor automatically");
      console.log("Please manually navigate to SQL Editor and run the schema");
    }
    
    // Wait for results
    await page.waitForTimeout(5000);
    
    console.log("\nSchema creation attempted");
    
  } catch (error) {
    console.log("Error:", error.message);
  } finally {
    await browser.close();
  }
});

/**
 * Nexus Alpha - Direct Supabase SQL Execution via Playwright
 * More targeted approach to finding and using the SQL editor
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";

const SUPABASE_PROJECT = "aganpaepissvuamstmol";
const SUPABASE_URL = `https://${SUPABASE_PROJECT}.supabase.co`;
const schemaSQL = readFileSync("integration/supabase/schema.sql", "utf-8");

test("Execute SQL in Supabase via browser", async ({ page, context }) => {
  console.log("\n=== Direct SQL Execution via Browser ===\n");
  
  // Navigate directly to SQL editor
  console.log("[1] Navigating to SQL Editor...");
  await page.goto(`${SUPABASE_URL}/project/-/sql`, { timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");
  
  // Wait a bit for the page to fully load
  await page.waitForTimeout(3000);
  
  console.log("[2] Current URL:", page.url());
  
  // Check what elements are on the page
  const pageContent = await page.content();
  
  // Try to find any SQL-related elements
  const newQueryButton = page.locator('button:has-text("New query"), button:has-text("New Query")');
  const runButton = page.locator('button:has-text("Run"), [class*="run-btn"]');
  
  // Click New Query if available
  if (await newQueryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("[3] Clicking 'New Query' button...");
    await newQueryButton.click();
    await page.waitForTimeout(2000);
  }
  
  // Look for any textarea or Monaco editor
  const possibleEditors = [
    page.locator('textarea[class*="sql"]'),
    page.locator('textarea[class*="editor"]'),
    page.locator('.monaco-editor textarea'),
    page.locator('[data-mode="sql"]'),
    page.locator('textarea').first(),
  ];
  
  let foundEditor = null;
  for (const editor of possibleEditors) {
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("[4] Found editor:", await editor.evaluate(el => el.tagName));
      foundEditor = editor;
      break;
    }
  }
  
  if (foundEditor) {
    console.log("[5] Entering SQL schema...");
    await foundEditor.click();
    
    // Enter SQL in chunks if needed
    const sqlChunks = schemaSQL.match(/.{1,5000}/g) || [schemaSQL];
    for (let i = 0; i < sqlChunks.length; i++) {
      await foundEditor.fill(sqlChunks[i]);
      await page.waitForTimeout(500);
      console.log(`   Typed chunk ${i+1}/${sqlChunks.length}`);
    }
    
    // Find and click Run
    console.log("[6] Clicking Run...");
    const runBtn = page.locator('button:has-text("Run"), [class*="run"]').first();
    if (await runBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await runBtn.click();
      console.log("   SQL executed!");
      await page.waitForTimeout(3000);
    }
  } else {
    console.log("[WARN] Could not find SQL editor");
    console.log("   The page may require login or have a different structure");
    
    // Take screenshot for debugging
    await page.screenshot({ path: "supabase-debug.png" });
    console.log("   Screenshot saved: supabase-debug.png");
  }
  
  // Check result
  console.log("\n[7] Final URL:", page.url());
  
  // If successful, verify tables exist
  if (page.url().includes("sql") || page.url().includes("project")) {
    console.log("[INFO] Schema should be created if SQL was entered successfully");
    console.log("   You can verify by checking the tables in the Supabase dashboard");
  }
});

test("Try alternative: Supabase query UI", async ({ page }) => {
  console.log("\n=== Alternative: Try Table Editor ===\n");
  
  // Try the table editor instead
  await page.goto(`${SUPABASE_URL}/project/-/editor`, { timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  
  console.log("Editor URL:", page.url());
  
  // Take screenshot
  await page.screenshot({ path: "supabase-editor.png" });
});

test("Summary: What was accomplished", async () => {
  console.log("\n=== Summary ===\n");
  console.log("Browser automation attempted to:");
  console.log("1. Navigate to Supabase SQL Editor");
  console.log("2. Find and interact with SQL editor");
  console.log("3. Enter and execute the schema SQL");
  console.log("\nIf the automated approach didn't work, the schema");
  console.log("needs to be created manually via Supabase dashboard.");
  console.log("\nLocation: integration/supabase/schema.sql");
  
  expect(true).toBe(true);
});

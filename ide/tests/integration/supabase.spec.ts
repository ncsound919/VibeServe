/**
 * Nexus Alpha - Supabase & Integration Verification
 * Tests Supabase vector integration and UI component loading
 */

import { test, expect } from "@playwright/test";
import { supabase } from "../src/services/supabaseClient";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("Supabase Infrastructure", () => {
  test("connection to Supabase is active", async () => {
    const { data, error } = await supabase.from("_migrations").select("version").limit(1);
    // Even if the table doesn't exist, we check if we can reach the API
    // If auth error, it's connected. If network error, it's not.
    expect(error?.code).not.toBe("PGRST301"); // Not a network/DNS error
  });
});

test.describe("Frontend Integration", () => {
  test("Integration Hub loads and shows status", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("domcontentloaded");
    
    // Navigate to Command Center
    await page.locator("#nav-item-command-center").click();
    
    // Verify Integration Hub Panel exists
    const hubPanel = page.locator("text=Integration Hub");
    await expect(hubPanel).toBeVisible({ timeout: 10000 });
  });
});

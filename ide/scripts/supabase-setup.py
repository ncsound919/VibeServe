"""
Nexus Alpha - Supabase Schema Creator via Browser
Uses Playwright to interact with Supabase dashboard and execute SQL
"""

import asyncio
from playwright.async_api import async_playwright
from supabase import create_client, Client

SUPABASE_URL = "https://aganpaepissvuamstmol.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW5wYWVwaXNzdnVhbXN0bW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4MzQ3MywiZXhwIjoyMDkyOTU5NDczfQ.zqF39DurClHwBisqPYysEi2I_LNHen7xD0YhJZg5gUk"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def create_tables_via_api():
    """Try creating tables using Supabase API directly"""
    
    schema = """
    -- Enable pgvector
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Secrets Table
    CREATE TABLE IF NOT EXISTS secrets (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Logs Table
    CREATE TABLE IF NOT EXISTS logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      type TEXT NOT NULL,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Agent Memory Table
    CREATE TABLE IF NOT EXISTS agent_memory (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Healing Log Table
    CREATE TABLE IF NOT EXISTS healing_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      issue_type TEXT NOT NULL,
      issue_details JSONB,
      remedy_applied TEXT,
      success BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Agent State Table
    CREATE TABLE IF NOT EXISTS agent_state (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      agent_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'idle',
      last_task TEXT,
      performance_score FLOAT DEFAULT 0.0,
      learnings JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Documents Table (Vector Store)
    CREATE TABLE IF NOT EXISTS documents (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      content TEXT NOT NULL,
      embedding VECTOR(1536),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """
    
    # Try executing via postgrest (limited - can only do DML, not DDL)
    # So we'll create tables via direct inserts and verify what exists
    
    tables_to_check = ['secrets', 'logs', 'agent_memory', 'healing_log', 'agent_state', 'documents']
    results = {}
    
    for table in tables_to_check:
        try:
            # Try to insert - if table doesn't exist, we'll get an error
            result = await asyncio.to_thread(
                supabase.table(table).insert,
                {"_init": True}
            )
            results[table] = "exists"
        except Exception as e:
            error_msg = str(e)
            if "does not exist" in error_msg:
                results[table] = "missing"
            else:
                results[table] = f"error: {error_msg[:50]}"
    
    return results

async def create_tables_via_browser():
    """Alternative: Use browser to navigate Supabase and execute SQL"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Navigate to Supabase SQL Editor
        await page.goto(f"{SUPABASE_URL}/project/-/sql")
        await page.wait_for_load_state("networkidle")
        
        print("Opened Supabase SQL Editor - you'll need to paste the schema manually")
        print("URL:", page.url)
        
        # Wait for user interaction
        await page.wait_for_timeout(5000)
        
        await browser.close()

async def main():
    print("[CHECK] Checking Supabase schema via API...\n")
    
    # Method 1: Check via API
    results = await create_tables_via_api()
    
    print("Table Status:")
    for table, status in results.items():
        status_mark = "[OK]" if status == "exists" else "[MISSING]"
        print(f"  {status_mark} {table}: {status}")
    
    missing = [t for t, s in results.items() if s == "missing"]
    
    if missing:
        print(f"\n[WARN] Missing tables: {', '.join(missing)}")
        print("\nTo create these tables:")
        print("  1. Run integration/supabase/schema.sql in Supabase SQL Editor")
    else:
        print("\n[OK] All tables exist!")

if __name__ == "__main__":
    asyncio.run(main())
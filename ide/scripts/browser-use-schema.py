"""
Nexus Alpha - Use browser-use to create Supabase schema
browser-use is an AI-powered browser automation tool
"""

import asyncio
import os
import sys

# Set up environment
os.environ['OPENAI_API_KEY'] = os.environ.get('OPENAI_API_KEY', '')

# Read the schema
schema_path = os.path.join(os.path.dirname(__file__), "..", "integration", "supabase", "schema.sql")
with open(schema_path, "r") as f:
    schema_sql = f.read()

async def main():
    try:
        from browser_use import Browser, BrowserConfig, Agent
        
        print("\n=== Creating Schema with browser-use ===\n")
        
        # Configure browser
        config = BrowserConfig(
            headless=False,  # Show browser
            max_workers=1,
        )
        browser = Browser(config)
        
        # Create agent with task
        task = f"""Navigate to https://aganpaepissvuamstmol.supabase.co/project/-/sql 
        and execute the following SQL to create tables. 
        If asked to login, explain that we need to create database schema.
        SQL to run:
        {schema_sql[:3000]}
        
        After running, confirm if the SQL was executed successfully."""
        
        agent = Agent(task=task, browser=browser)
        
        print("Running browser-use agent...")
        await agent.run()
        
        print("\n[Complete] Check browser for results")
        
    except ImportError:
        print("browser-use not properly installed")
        print("Trying alternative method...")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("browser-use requires an LLM API key to work")
    print("Please set OPENAI_API_KEY environment variable")
    print("\nAlternatively, the schema needs manual creation in Supabase:")
    print("  1. Go to https://supabase.com/dashboard")
    print("  2. Select project aganpaepissvuamstmol")
    print("  3. Go to SQL Editor")
    print("  4. Run integration/supabase/schema.sql")
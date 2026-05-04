#!/usr/bin/env python3
"""
Browser Harness - Create Supabase Schema
Uses browser-harness to control browser and execute SQL
"""

import subprocess
import time
import os

# Read the schema
schema_path = os.path.join(os.path.dirname(__file__), "..", "integration", "supabase", "schema.sql")
with open(schema_path, "r") as f:
    schema_sql = f.read()

# Escape for Python string
escaped_sql = schema_sql.replace("'", "\\'")

# Create browser-harness commands
commands = f'''
goto_url("https://aganpaepissvuamstmol.supabase.co")
wait_for_load()
print(page_info())

# Check if logged in
title = page.title()
print("Page title:", title)

# Try to navigate to SQL editor
goto_url("https://aganpaepissvuamstmol.supabase.co/project/-/sql")
wait_for_load()
print("SQL Editor URL:", page.url())

# Wait for the editor to load
wait_for_timeout(3000)

# Try to find and interact with the editor
# Look for common SQL editor selectors
try:
    # Try clicking on "New Query" button if it exists
    click("text=New Query")
    wait_for_timeout(1000)
except:
    print("Could not find New Query button")

try:
    # Try to find a textarea or code editor
    editor = locate("textarea") | locate("[class*=editor]")
    if editor:
        print("Found editor")
        type(editor, "{escaped_sql[:2000]}")  # Type first 2000 chars
        print("Typed SQL")
except Exception as e:
    print("Editor not found:", str(e)[:100])

# Take screenshot
screenshot()
'''

print("Browser Harness Schema Creator")
print("=" * 50)
print("Note: This requires Chrome with remote debugging enabled")
print("To enable: Open Chrome with --remote-debugging-port=9222")
print("Then go to chrome://inspect to enable DevTools")
print()
print("Alternatively, manually:")
print("1. Go to https://supabase.com/dashboard")
print("2. Select your project")
print("3. Go to SQL Editor")
print("4. Paste schema from integration/supabase/schema.sql")
print("5. Click Run")
print()
print("Attempting to use browser-harness...")

# Try running browser-harness
harness_dir = os.path.join(os.path.dirname(__file__), "..", "browser-harness-temp")
if os.path.exists(harness_dir):
    try:
        result = subprocess.run(
            ["python", "-m", "src.browser_harness.run", "-c", commands],
            cwd=harness_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        print("Output:", result.stdout[:500])
        if result.stderr:
            print("Errors:", result.stderr[:500])
    except Exception as e:
        print(f"Browser harness error: {e}")
else:
    print("Browser harness not found at", harness_dir)
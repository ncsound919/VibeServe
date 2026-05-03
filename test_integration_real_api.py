#!/usr/bin/env python3
"""Real-API integration test — optionally uses local Ollama if available.
Skips silently if no LLM provider is configured."""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mcp_ui_optimizer_v4 import (
    vibe_architect_tool, vibe_review_tool, vibe_verify_tool,
    router, CodeFile, VibeVerifier
)

class Ctx:
    async def info(self, msg): pass
    async def report_progress(self, c, t, m): pass

async def check_ollama():
    """Check if Ollama is available and has a model loaded"""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get("http://127.0.0.1:11434/api/tags")
            if r.status_code == 200:
                models = r.json().get("models", [])
                return len(models) > 0
    except Exception:
        pass
    return False

async def main():
    ctx = Ctx()
    passed = 0
    total = 0

    # Test 1: Architecture (only with Ollama available)
    total += 1
    if os.getenv("DEEPSEEK_API_KEY") or await check_ollama():
        try:
            result = await vibe_architect_tool(ctx=ctx, intent="Build a todo list",
                constraints=["WCAG AAA", "React", "Dark mode"])
            if result.get("status") == "success" and result.get("decision_count", 0) > 0:
                print("PASS: vibe_architect — real LLM call succeeded")
                passed += 1
            else:
                print(f"SKIP: vibe_architect returned: {result.get('status')}")
        except Exception as e:
            print(f"SKIP: vibe_architect failed: {e}")
    else:
        print("SKIP: No LLM provider available (set DEEPSEEK_API_KEY or start Ollama)")

    # Test 2: Verify (no LLM needed — always runs)
    total += 1
    result = VibeVerifier.verify_spec({
        "version": "1.0",
        "metadata": {"id": "test", "name": "Test"},
        "design_system": {}, "layouts": [], "components": []
    })
    if result["valid"]:
        print("PASS: vibe_verify — valid spec passes")
        passed += 1
    else:
        print(f"FAIL: vibe_verify: {result['errors']}")

    # Test 3: Review (no LLM needed — runs with mock data)
    total += 1
    mock_files = [{"path": "/src/Card.tsx", "content": 'export default () => <div role="main"></div>',
                   "language": "tsx", "purpose": "Card component"}]
    result = await vibe_review_tool(ctx=ctx, files=mock_files,
        requirements=["SaaS dashboard", "WCAG AAA"])
    if result.get("status") == "success":
        print(f"PASS: vibe_review — score {result['consensus_score']}")
        passed += 1
    else:
        print(f"FAIL: vibe_review: {result}")

    # Test 4: Provider count
    total += 1
    if len(router.providers) >= 1:
        print(f"PASS: {len(router.providers)} providers registered: {list(router.providers.keys())}")
        passed += 1
    else:
        print("FAIL: No providers registered")

    print(f"\n{passed}/{total} integration tests passed")
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

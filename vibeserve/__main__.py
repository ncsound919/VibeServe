"""VibeServe entry point — registers all tools."""

from __future__ import annotations
import asyncio
import json
import logging

from vibeserve.server import mcp_server
from vibeserve.handlers.resources import *  # noqa: F403
from vibeserve.handlers.prompts import *  # noqa: F403
from vibeserve.tools.v4_tools import *  # noqa: F403
from vibeserve.tools.v5_tools import *  # noqa: F403
from vibeserve.tools.integration_tools import *  # noqa: F403
from vibeserve.tools.pipeline_tools import *  # noqa: F403
from vibeserve.tools.agenda import *  # noqa: F403
from vibeserve.tools.repo_indexer import *  # noqa: F403
from vibeserve.tools.github_sync import *  # noqa: F403

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("VibeServe")

# ====================== DEMO FUNCTIONS ======================
async def demo():
    print("\n[v4] VibeServe Legacy -- Direct Execution Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    result = await generate_ui_spec_tool(ctx=ctx, page_type="product_dashboard",
        requirements=["SaaS dashboard", "Dark mode", "Mobile responsive"], use_cache=False)
    print(json.dumps({"status": result.get("status")}, indent=2))

async def vibe_demo():
    print("\n[v5] VibeServe Agentic Coding Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    print("\n[Step 1] vibe_architect")
    plan_result = await vibe_architect_tool(ctx=ctx, intent="Build a SaaS analytics dashboard",
        constraints=["WCAG AAA", "React + TypeScript"], target_stack="react")
    if plan_result.get("status") == "success":
        print(f"  Plan: {plan_result['decision_count']} decisions")

def main():
    import sys
    if "--vibe-demo" in sys.argv:
        asyncio.run(vibe_demo())
    elif "--demo" in sys.argv:
        asyncio.run(demo())
    elif "--interactive" in sys.argv:
        asyncio.run(_interactive_loop())
    else:
        log.info("Starting VibeServe MCP server...")
        mcp_server.build().run()


async def _interactive_loop():
    print("\nVibeServe Interactive Mode")
    print("Available tools:")
    for name in ["vibe_architect", "vibe_code", "vibe_review", "vibe_verify",
                 "vibe_iterate", "vibe_test", "vibe_deploy", "vibe_health",
                 "vibe_compress", "vibe_docs", "generate_ui_spec", "validate_ui_spec",
                 "read_file", "write_file", "run_build", "supabase_query"]:
        print(f"  - {name}")
    
    print("\nCommands: 'architect <intent>', 'docs <query>', 'health', 'help', 'quit'\n")
    
    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): 
            pct = int(current / total * 100) if total else 0
            print(f"  [{pct:3d}%] {msg}")
    
    ctx = MockCtx()
    
    while True:
        try:
            cmd = input("vibeserve> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break
        
        if not cmd:
            continue
        if cmd == "quit":
            break
        if cmd == "help":
            print("Commands: 'architect <intent>', 'docs <query>', 'health', 'help', 'quit'")
            continue
        if cmd == "health":
            result = await vibe_health_tool(ctx=ctx)
            print(json.dumps(result, indent=2))
            continue
        
        parts = cmd.split(maxsplit=1)
        action = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""
        
        if action == "architect" and arg:
            result = await vibe_architect_tool(ctx=ctx, intent=arg, target_stack="react")
            print(json.dumps({"status": result.get("status"), "plan": result.get("plan", {})}, indent=2))
        elif action == "docs" and arg:
            result = await vibe_docs_tool(ctx=ctx, query=arg)
            print(json.dumps({"status": result.get("status"), "docs_length": result.get("docs_length", 0)}, indent=2))
        else:
            print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()

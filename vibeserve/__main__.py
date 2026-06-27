"""VibeServe entry point — registers all tools and delegates to entrypoint.py."""

from __future__ import annotations
import asyncio
import json
import logging
import os
import signal
import sys
from dotenv import load_dotenv
from vibeserve.server import mcp_server
from vibeserve.tools.v4_tools import *  # noqa: F403
from vibeserve.tools.v5_tools import *  # noqa: F403
from vibeserve.tools import mutly_integration  # noqa: F401 — registers vs_* tools
from vibeserve.handlers.resources import *  # noqa: F403
from vibeserve.mcp_integrations.big_homie_mcp import *  # noqa: F403
from vibeserve.mcp_integrations.mem0_mcp import *  # noqa: F403
from vibeserve.mcp_integrations.nanobot_mcp import *  # noqa: F403

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("VibeServe")

def _cleanup():
    try:
        logging.getLogger("VibeServe").info("Shutting down gracefully...")
    except Exception:
        pass

def _handle_signal(signum, frame):
    _cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)

async def demo():
    print("\n[v4] VibeServe Legacy -- Direct Execution Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    result = await generate_ui_spec_tool(ctx=ctx, page_type="product_dashboard",  # noqa: F405
        requirements=["SaaS dashboard", "Dark mode", "Mobile responsive"], use_cache=False)
    print(json.dumps({"status": result.get("status")}, indent=2))

async def vibe_demo():
    print("\n[v5] VibeServe Agentic Coding Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    print("\n[Step 1] vibe_architect")
    plan_result = await vibe_architect_tool(ctx=ctx, intent="Build a SaaS analytics dashboard",  # noqa: F405
        constraints=["WCAG AAA", "React + TypeScript"], target_stack="react")
    if plan_result.get("status") == "success":
        print(f"  Plan: {plan_result['decision_count']} decisions")

def main():
    _pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_pkg_root, ".env"))

    if "--vibe-demo" in sys.argv:
        asyncio.run(vibe_demo())
    elif "--demo" in sys.argv:
        asyncio.run(demo())
    elif "--interactive" in sys.argv:
        asyncio.run(_interactive_loop())
    elif "--http" in sys.argv:
        from vibeserve.auth import validate_secret_on_startup
        try:
            validate_secret_on_startup()
        except RuntimeError as e:
            log.error(f"Startup validation failed: {e}")
            sys.exit(1)

        from vibeserve.http_bridge import run_http_server
        port = int(os.getenv("VIBESERVE_HTTP_PORT", "8000"))
        host = os.getenv("VIBESERVE_HTTP_HOST", "127.0.0.1")
        log.info("Starting VibeServe Mutly HTTP bridge on %s:%s", host, port)

        async def _http_plus_ws():
            from vibeserve.agent_ws import run_agent_ws_server
            ws_host = host
            ws_port = int(os.getenv("AGENT_WS_PORT", "8001"))
            ws_task = asyncio.create_task(run_agent_ws_server(ws_host, ws_port))
            try:
                await run_http_server(host, port)
            finally:
                ws_task.cancel()
                try:
                    await ws_task
                except (asyncio.CancelledError, Exception):
                    pass

        try:
            asyncio.run(_http_plus_ws())
        except KeyboardInterrupt:
            pass
        return
    else:
        from vibeserve.auth import validate_secret_on_startup
        try:
            validate_secret_on_startup()
        except RuntimeError as e:
            log.error(f"Startup validation failed: {e}")
            sys.exit(1)

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
            cmd = (await asyncio.get_event_loop().run_in_executor(None, input, "vibeserve> ")).strip()
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
            result = await vibe_health_tool(ctx=ctx)  # noqa: F405
            print(json.dumps(result, indent=2))
            continue
        
        parts = cmd.split(maxsplit=1)
        action = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""
        
        if action == "architect" and arg:
            result = await vibe_architect_tool(ctx=ctx, intent=arg, target_stack="react")  # noqa: F405
            print(json.dumps({"status": result.get("status"), "plan": result.get("plan", {})}, indent=2))
        elif action == "docs" and arg:
            result = await vibe_docs_tool(ctx=ctx, query=arg)  # noqa: F405
            print(json.dumps({"status": result.get("status"), "docs_length": result.get("docs_length", 0)}, indent=2))
        else:
            print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()

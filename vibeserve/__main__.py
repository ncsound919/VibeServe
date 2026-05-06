"""VibeServe v2.0 entry point — registers all tools including v2.0 feature tools."""

from __future__ import annotations
import asyncio
import json
import logging


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("VibeServe")


from vibeserve.server import mcp_server
from vibeserve.handlers.resources import *
from vibeserve.handlers.prompts import *
from vibeserve.tools.v4_tools import *
from vibeserve.tools.v5_tools import *
from vibeserve.tools.integration_tools import *
# ====================== REGISTER V2.0 FEATURE TOOLS ======================
from vibeserve.feature_tools import register_feature_tools
register_feature_tools(mcp_server)

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
    print("\n  VibeServe v2.0 — Interactive Mode\n  Type 'help' for commands | 'exit' to quit")

    class MockCtx:
        async def info(self, msg): print(f"  {msg}")
        async def report_progress(self, c, t, m): print(f"  [{int(c/max(1,t)*100):3d}%] {m}")

    ctx = MockCtx()

    while True:
        try:
            raw = input("\n\033[1;36mvibeserve>\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break
        if not raw:
            continue
        parts = raw.split(maxsplit=1)
        cmd, rest = parts[0].lower(), parts[1] if len(parts) > 1 else ""
        try:
            if cmd in ("exit", "quit", "q"):
                print("Goodbye!")
                break
            elif cmd == "clone":
                r = await vibe_clone_tool(ctx, url=rest or "https://stripe.com")
                print(f"\n  Stack: {r.get('detected_stack')} | Colors: {r.get('raw_stats', {}).get('colors_found')}")
            elif cmd == "palette":
                r = await vibe_palette_tool(ctx, base_color=rest or "#5e6ad2")
                print(f"\n  {r.get('color_count')} colors | {r.get('vibe_statement')}")
            elif cmd == "multiverse":
                r = await vibe_multiverse_tool(ctx, intent=rest or "A login form")
                print(f"\n  Winner: {r.get('winner')} | Ran: {r.get('frameworks_run')} frameworks")
            elif cmd == "doctor":
                print("  Provide files via API (doctor requires file objects)")
            elif cmd == "search":
                r = await vibe_search_tool(ctx, query=rest or "dashboard")
                print(f"\n  Found {len(r.get('results', []))} results for '{rest}'")
            elif cmd == "git":
                print("  Usage: git <commit|branch|pr|changelog>")
            elif cmd == "i18n":
                print("  Usage: provide code via API (i18n requires source code)")
            elif cmd == "timemachine":
                r = await vibe_timemachine_tool(ctx, action="list")
                for s in r.get("snapshots", [])[:5]:
                    print(f"  [{s['short_id']}] {s['page_type']} — score {s['score']:.2f} @ {s['date']}")
            elif cmd in ("h", "help"):
                print("""
  V2.0 FEATURES
  clone <url>            Reverse-engineer any live site
  palette <#hex>         One color \u2192 full design system
  multiverse <intent>    Same UI in React/Vue/Svelte/HTML
  doctor                 Diagnose + auto-repair code (via API)
  search <query>         Natural-language search over memory
  git                    AI commits, PRs, changelogs (via API)
  i18n                   Auto-translate to 20 languages (via API)
  timemachine            Browse + restore spec history

  V1 PIPELINE
  architect / code / review / verify / iterate / test / deploy
  design / preview / benchmark / audit / health / memory
  exit""")
            else:
                print(f"  Unknown: '{cmd}'. Type 'help'.")
        except NameError as e:
            print(f"  [note] Tool not in interactive scope — use MCP client: {e}")
        except Exception as e:
            print(f"  \033[1;31mError: {e}\033[0m")

if __name__ == "__main__":
    main()

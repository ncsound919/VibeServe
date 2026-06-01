"""E2E: Run vibe_architect with DeepSeek on Tap919 project."""
import asyncio
import os
from vibeserve.tools.v5_tools import vibe_architect_tool
os.environ["DEEPSEEK_API_KEY"] = "sk-d11b338d040441deaefdb552b80275ab"
os.environ["PYTHONPATH"] = "."
os.environ["DEFAULT_LLM_PROVIDER"] = "deepseek"

print("=== VIBE_ARCHITECT — Tap919 Middleman ===")
print("Provider: DeepSeek")

class MockCtx:
    async def info(self, msg): print(f"  [info] {msg}")
    async def report_progress(self, cur, total, msg): print(f"  [progress {cur}/{total}] {msg}")

async def main():
    result = await vibe_architect_tool(
        ctx=MockCtx(),
        intent="Build Tap919 Middleman: an API monetization gateway between AI agents and LLM providers. Features: usage-based billing with Stripe, request metering, provider adapters (OpenAI, Anthropic, DeepSeek), kill-switch for cost control, Cloudflare Worker edge storefront, FastAPI backend.",
        constraints=["Production-ready", "Observable (tracing, metering)", "Multi-tenant", "Rate limiting", "Audit logging"],
        target_stack="python"
    )
    
    import json
    print("\n=== RESULT ===")
    try:
        print(json.dumps(result, indent=2, default=str)[:3000])
    except Exception as e:
        print(f"Serialization error: {e}")
        print(f"Status: {result.get('status')}")
        if 'plan' in result:
            plan = result['plan']
            print(f"Plan keys: {list(plan.keys()) if isinstance(plan, dict) else type(plan)}")
            if isinstance(plan, dict):
                for k, v in plan.items():
                    if isinstance(v, list):
                        print(f"  {k}: {len(v)} items")
                    elif isinstance(v, dict):
                        print(f"  {k}: {len(v)} keys")
                    else:
                        print(f"  {k}: {str(v)[:100]}")

asyncio.run(main())

"""Full pipeline chain: architect → code → review → test on Tap919."""
import os, sys, json, asyncio
os.environ["DEEPSEEK_API_KEY"] = "sk-d11b338d040441deaefdb552b80275ab"
os.environ["PYTHONPATH"] = "."
os.environ["DEFAULT_LLM_PROVIDER"] = "deepseek"

from vibeserve.tools.v5_tools import vibe_architect_tool, vibe_code_tool, vibe_test_tool

class Ctx:
    async def info(self, msg): print(f"  {msg[:120]}")
    async def report_progress(self, cur, total, msg): print(f"  [{cur}/{total}] {msg[:80]}")

async def main():
    print("=" * 60)
    print("PIPELINE: architect -> code -> test")
    print("=" * 60)

    # Stage 1: Architect
    print("\n--- Stage 1: Architect ---")
    plan = await vibe_architect_tool(
        ctx=Ctx(),
        intent="Build Tap919 Middleman: API monetization gateway. FastAPI backend with Stripe billing, Cloudflare Worker storefront, request metering, provider adapters for OpenAI/Anthropic/DeepSeek, kill-switch.",
        constraints=["Production-ready", "Type-safe", "Testable", "Observable"],
        target_stack="python"
    )
    if plan.get("status") != "success":
        print(f"  FAILED: {json.dumps(plan, default=str)[:500]}")
        return
    print(f"  Generated {plan['decision_count']} ADRs, {plan['risk_count']} risks")

    # Stage 2: Code
    print("\n--- Stage 2: Code Generation ---")
    code = await vibe_code_tool(
        ctx=Ctx(),
        intent="Build Tap919 Middleman API monetization gateway",
        plan=plan["plan"],
        target_language="python"
    )
    if code.get("status") != "success":
        print(f"  FAILED: {json.dumps(code, default=str)[:500]}")
        return
    print(f"  Generated {code['file_count']} files, {code['total_lines']} lines")
    for f in code.get("files", [])[:10]:
        name = f["path"].encode('ascii','replace').decode()
        print(f"    {name} ({f.get('language','?')})")

    # Stage 3: Test
    print("\n--- Stage 3: Test Generation ---")
    files_for_test = [{"path": f["path"], "content": f["content"], "language": f.get("language","")} for f in code.get("files", [])[:5]]
    test_result = await vibe_test_tool(
        ctx=Ctx(),
        files=files_for_test,
        test_framework="pytest"
    )
    status = test_result.get("status", "?")
    tests = test_result.get("tests", [])
    print(f"  Status: {status}, Tests generated: {len(tests) if isinstance(tests, list) else '?'}")
    
    # Save generated code
    out_dir = r"C:\Users\User\Desktop\tap919-middleman-main\generated"
    os.makedirs(out_dir, exist_ok=True)
    for f in code.get("files", []):
        fpath = os.path.join(out_dir, f["path"])
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w", encoding="utf-8") as fh:
            fh.write(f["content"])
    
    print(f"\n  Code saved to: {out_dir}")
    print(f"\n=== PIPELINE COMPLETE ===")

asyncio.run(main())

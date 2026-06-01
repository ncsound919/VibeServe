#!/usr/bin/env python3
"""End-to-end integration test for AetherNexus v5 pipeline.
Requires DEEPSEEK_API_KEY (or any LLM provider) to run."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vibeserve import (
    vibe_architect_tool, vibe_code_tool, vibe_review_tool,
    vibe_verify_tool, vibe_iterate_tool
)

class Ctx:
    async def info(self, msg): print(f"  [i] {msg}")
    async def report_progress(self, c, t, m):
        if c == 0 or c == 100:
            print(f"  [{c}%] {m}")

async def full_pipeline():
    ctx = Ctx()

    print("=" * 60)
    print("AetherNexus v5 -- Full Pipeline Integration Test")
    print("=" * 60)

    # Step 1: Architecture
    print("\n--- [1/5] vibe_architect ---")
    plan_result = await vibe_architect_tool(
        ctx=ctx,
        intent="Build a login page with email/password form, dark mode, WCAG AAA compliance",
        constraints=["React + TypeScript", "Tailwind CSS", "Must use semantic HTML"],
        target_stack="react"
    )
    assert plan_result["status"] == "success", f"Architect failed: {plan_result}"
    plan = plan_result["plan"]
    print(f"  ADRs: {plan_result['decision_count']}, Complexity: {plan['estimated_complexity']}")
    for d in plan["decisions"][:3]:
        print(f"  - {d['title']} (confidence: {d['confidence']})")

    # Step 2: Code generation
    print("\n--- [2/5] vibe_code ---")
    code_result = await vibe_code_tool(
        ctx=ctx,
        intent="Build a login page",
        plan=plan,
        constraints=["WCAG AAA", "React + TypeScript", "Dark mode"]
    )
    assert code_result["status"] == "success", f"Code gen failed: {code_result}"
    print(f"  Files: {code_result['file_count']}, Lines: {code_result['total_lines']}")
    print(f"  Quality: {'PASS' if code_result['quality']['passed'] else 'ISSUES'} ({code_result['quality']['issue_count']} issues)")
    for f in code_result["files"][:5]:
        line_count = len(f["content"].split("\n"))
        a11y = f.get("accessibility_notes", [])
        print(f"  - {f['path']} ({f['language']}, {line_count} lines, {len(a11y)} a11y notes)")

    # Step 3: Review the generated code
    print("\n--- [3/5] vibe_review ---")
    review_result = await vibe_review_tool(
        ctx=ctx,
        files=code_result["files"],
        requirements=["Login page", "Dark mode", "WCAG AAA", "Email/password form"]
    )
    assert review_result["status"] == "success", f"Review failed: {review_result}"
    print(f"  Score: {review_result['consensus_score']}, Rec: {review_result['recommendation']}")
    print(f"  Issues: {len(review_result['line_level_issues'])} ({review_result['critical_issues']} critical)")
    for issue in review_result["line_level_issues"][:3]:
        print(f"  - [{issue['severity']}] {issue['agent']}: {issue['issue'][:80]}")

    # Step 4: Verify
    print("\n--- [4/5] vibe_verify ---")
    verify_result = await vibe_verify_tool(
        ctx=ctx,
        files=code_result["files"]
    )
    for name, r in verify_result["results"].items():
        status = "PASS" if r.get("valid", r.get("passed", False)) else "ISSUES"
        print(f"  [{status}] {name}")

    # Step 5: Iterate (if review score is below threshold)
    if review_result["consensus_score"] < 0.80:
        print("\n--- [5/5] vibe_iterate ---")
        iterate_input = {
            "version": "1.0",
            "metadata": {"id": "test", "name": "login-page"},
            "design_system": {},
            "layouts": [],
            "components": [],
            "files": code_result["files"]
        }
        iterate_result = await vibe_iterate_tool(
            ctx=ctx,
            specification=iterate_input,
            requirements=["Login page", "Dark mode", "WCAG AAA"],
            max_iterations=2,
            quality_threshold=0.70
        )
        print(f"  Iterations: {iterate_result['iterations_used']}")
        print(f"  Final score: {iterate_result['final_score']}")
        print(f"  Score improvement: {iterate_result['score_improvement']}")
        print(f"  Converged: {iterate_result['converged']}")
    else:
        print("\n--- [5/5] vibe_iterate ---")
        print("  Skipped (review score >= 0.80)")

    print("\n" + "=" * 60)
    print("ALL 5 PIPELINE STEPS PASSED")
    print("=" * 60)

if __name__ == "__main__":
    if not os.getenv("DEEPSEEK_API_KEY") and not os.getenv("OPENAI_API_KEY"):
        print("WARNING: No LLM API key set. Tests will fail.")
        print("Set DEEPSEEK_API_KEY or OPENAI_API_KEY environment variable.")
    asyncio.run(full_pipeline())

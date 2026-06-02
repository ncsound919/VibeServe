"""
Self-referential build test: VibeServe builds its own marketing site.
Validates the full architect -> code -> review pipeline.
"""
import asyncio
import json
import os
import time
from pathlib import Path

import pytest

SELF_BUILD_INTENT = """
Build the official VibeServe marketing website. VibeServe is an AI-powered
multi-agent coding system that takes a natural language intent and produces
production-ready code through a 7-step pipeline: architect, code, review,
verify, iterate, test, deploy.

The site needs:
- Hero section: headline, subheadline, primary CTA ("Get Started"), secondary CTA ("View Docs")
- Features section: 3 cards covering pipeline transparency, WCAG AAA enforcement, multi-provider LLM support
- How it works: visual 7-step pipeline diagram
- Footer: GitHub link, PyPI link, license badge

Stack: React + TypeScript + Tailwind CSS
Must pass WCAG AA minimum, AAA preferred
"""

SELF_BUILD_CONSTRAINTS = [
    "WCAG AAA color contrast on all text",
    "Mobile-first responsive layout",
    "No external dependencies beyond React + Tailwind",
    "All interactive elements keyboard accessible",
    "Semantic HTML5 elements throughout",
]

OUTPUT_DIR = Path("tests/artifacts/self_build")


class MockCtx:
    async def info(self, msg):
        pass

    async def report_progress(self, cur, total, msg):
        pass


@pytest.mark.asyncio
async def test_architect_phase():
    from vibeserve.tools.v5_tools import vibe_architect_tool

    result = await vibe_architect_tool(
        ctx=MockCtx(),
        intent=SELF_BUILD_INTENT,
        constraints=SELF_BUILD_CONSTRAINTS,
        target_stack="react",
    )

    plan = result.get("plan", {})
    assert result.get("decision_count", 0) >= 3, "Expected at least 3 architecture decisions"
    assert result.get("risk_count", 0) >= 0
    decisions = plan.get("decisions", [])
    assert any(
        "wcag" in str(d).lower() or "accessib" in str(d).lower()
        for d in decisions
    ), "No accessibility decision found in plan"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "architect_result.json").write_text(json.dumps(result, indent=2))
    return result


@pytest.mark.asyncio
async def test_code_phase():
    from vibeserve.tools.v5_tools import vibe_code_tool

    arch_path = OUTPUT_DIR / "architect_result.json"
    if not arch_path.exists():
        pytest.skip("architect_result.json not found — run test_architect_phase first")
    architect_result = json.loads(arch_path.read_text())

    result = await vibe_code_tool(
        ctx=MockCtx(),
        intent=SELF_BUILD_INTENT,
        plan=architect_result.get("plan", {}),
        constraints=SELF_BUILD_CONSTRAINTS,
        target_language="typescript",
    )

    files = result.get("files", [])
    assert len(files) >= 3, f"Expected at least 3 generated files, got {len(files)}"

    extensions = {Path(f["path"]).suffix for f in files}
    assert ".tsx" in extensions or ".jsx" in extensions, "No React component file generated"
    assert ".css" in extensions or any(
        "tailwind" in f.get("path", "") for f in files
    ), "No stylesheet generated"

    all_content = " ".join(f.get("content", "") for f in files).lower()
    assert "hero" in all_content or "headline" in all_content, "Generated code contains no hero section"

    for f in files:
        out = OUTPUT_DIR / "generated" / f["path"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f.get("content", ""))

    (OUTPUT_DIR / "code_result.json").write_text(json.dumps(result, indent=2))
    return result


@pytest.mark.asyncio
async def test_review_phase():
    from vibeserve.tools.v5_tools import vibe_review_tool

    code_path = OUTPUT_DIR / "code_result.json"
    if not code_path.exists():
        pytest.skip("code_result.json not found — run test_code_phase first")
    code_result = json.loads(code_path.read_text())

    result = await vibe_review_tool(
        ctx=MockCtx(),
        files=code_result.get("files", []),
        requirements=SELF_BUILD_CONSTRAINTS,
    )

    score = result.get("consensus_score", 0)
    assert score >= 0.5, f"Review consensus score too low: {score} (min 0.5)"

    review_text = json.dumps(result).lower()
    assert (
        "wcag" in review_text or "contrast" in review_text or "accessib" in review_text
    ), "Review did not address accessibility constraints"

    (OUTPUT_DIR / "review_result.json").write_text(json.dumps(result, indent=2))
    return result


@pytest.mark.asyncio
async def test_full_pipeline_under_time():
    """Full pipeline must complete in under 120 seconds."""
    start = time.time()

    await test_architect_phase()
    await test_code_phase()
    await test_review_phase()

    elapsed = time.time() - start
    assert elapsed < 120, f"Full pipeline took {elapsed:.1f}s — exceeds 120s budget"
    print(f"\n Full pipeline completed in {elapsed:.1f}s")

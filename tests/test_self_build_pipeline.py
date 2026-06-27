"""
Self-referential build test: VibeServe builds its own marketing site.
Validates the full architect -> code -> review pipeline.
"""
import json
import time
from pathlib import Path
from unittest.mock import patch

import pytest

pytestmark = [pytest.mark.usefixtures("patch_auth")]

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
    auth_token = "test-token"

    async def info(self, msg):
        pass

    async def report_progress(self, cur, total, msg):
        pass


def _make_llm_response(prompt: str) -> str:
    """Route prompt to the correct mock JSON response."""
    p = prompt.lower()
    if "architecture plan for:" in p:
        return json.dumps({
            "decisions": [
                {"id": "d1", "title": "React frontend", "context": "UI layer", "decision": "React",
                 "alternatives": ["Vue"], "rationale": "Component reuse", "consequences": [], "confidence": 1.0},
                {"id": "d2", "title": "WCAG AAA accessibility", "context": "Accessibility",
                 "decision": "WCAG AAA", "alternatives": [], "rationale": "Required by constraints",
                 "consequences": [], "confidence": 1.0},
                {"id": "d3", "title": "Mobile-first responsive", "context": "Layout",
                 "decision": "Mobile-first", "alternatives": [], "rationale": "Best practice",
                 "consequences": [], "confidence": 1.0},
            ],
            "component_tree": ["App", "Hero", "Features"],
            "data_flow": {"input": "user intent", "output": "rendered UI"},
            "file_structure": ["App.tsx", "styles.css", "index.tsx"],
            "estimated_complexity": "medium",
            "risks": [],
            "recommended_stack": {"frontend": "React", "styling": "Tailwind"},
        })
    elif "generate code files" in p:
        # MUST wrap in {"files": [...]} — parse_json_robust tries {} before [],
        # so a bare array [{"path":...}] would return only the first dict.
        return json.dumps({
            "files": [
                {"path": "App.tsx",
                 "content": "export default function App() { return <div><section className='hero'><h1>Hero Headline</h1></section></div>; }",
                 "language": "tsx", "purpose": "Main app component"},
                {"path": "styles.css",
                 "content": ".hero { background: #0A0A0A; color: #EEEEEE; padding: 4rem; }",
                 "language": "css", "purpose": "Global styles"},
                {"path": "index.tsx",
                 "content": "import React from 'react'; import App from './App'; export default App;",
                 "language": "tsx", "purpose": "Entry point"},
            ]
        })
    else:
        return json.dumps({
            "consensus_score": 0.9,
            "review": "The code enforces WCAG AAA contrast and semantic HTML throughout. Accessibility is strong.",
            "passed": True,
            "recommendation": "Deploy",
        })


@pytest.fixture(autouse=True)
def mock_llm_and_rate_limit():
    """Patch vibeserve.providers.LLMRouter.get and reset rate limiter."""
    from vibeserve.middleware import rate_limiter
    rate_limiter._tokens.clear()
    rate_limiter._last_check.clear()

    class MockProvider:
        @property
        def name(self):
            return "MockProvider"
        async def call(self, prompt, temperature=0.7, response_format="json"):
            return _make_llm_response(prompt)

    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        yield


# ---------------------------------------------------------------------------
# Pipeline tests
# ---------------------------------------------------------------------------

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

    plan = {
        "decisions": [
            {"id": "d1", "title": "React", "context": "UI", "decision": "React",
             "alternatives": [], "rationale": "Good", "consequences": [], "confidence": 1.0},
        ],
        "component_tree": ["App", "Hero"],
        "data_flow": {},
        "file_structure": ["App.tsx", "styles.css", "index.tsx"],
        "estimated_complexity": "medium",
        "risks": [],
        "recommended_stack": {"frontend": "React"},
    }

    result = await vibe_code_tool(
        ctx=MockCtx(),
        intent=SELF_BUILD_INTENT,
        plan=plan,
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

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for f in files:
        out = OUTPUT_DIR / "generated" / f["path"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f.get("content", ""))

    (OUTPUT_DIR / "code_result.json").write_text(json.dumps(result, indent=2))
    return result


@pytest.mark.asyncio
async def test_review_phase():
    from vibeserve.tools.v5_tools import vibe_review_tool

    files = [
        {"path": "App.tsx", "content": "<h1>Hero Headline</h1>", "language": "tsx", "purpose": "Main"},
        {"path": "styles.css", "content": ".hero { color: #eee; }", "language": "css", "purpose": "Styles"},
    ]

    result = await vibe_review_tool(
        ctx=MockCtx(),
        files=files,
        requirements=SELF_BUILD_CONSTRAINTS,
    )

    score = result.get("consensus_score", 0)
    assert score >= 0.5, f"Review consensus score too low: {score} (min 0.5)"

    review_text = json.dumps(result).lower()
    assert (
        "wcag" in review_text or "contrast" in review_text or "accessib" in review_text
    ), "Review did not address accessibility constraints"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
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

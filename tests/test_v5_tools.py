"""
Unit tests for vibeserve.tools.v5_tools — covers tool entry points with mocked LLM.
Tests validation errors, success paths, and edge cases across the main tools.
"""
import json
import pytest
from unittest.mock import patch

pytestmark = [pytest.mark.usefixtures("patch_auth")]


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

class MockCtx:
    auth_token = "test-token"
    async def info(self, msg): pass
    async def report_progress(self, cur, total, msg): pass


ARCH_RESPONSE = json.dumps({
    "decisions": [
        {"id": "d1", "title": "React", "context": "UI", "decision": "React",
         "alternatives": [], "rationale": "Good", "consequences": [], "confidence": 1.0},
        {"id": "d2", "title": "WCAG AAA", "context": "A11y", "decision": "WCAG",
         "alternatives": [], "rationale": "Required", "consequences": [], "confidence": 1.0},
        {"id": "d3", "title": "Mobile", "context": "Layout", "decision": "Mobile",
         "alternatives": [], "rationale": "Best practice", "consequences": [], "confidence": 1.0},
    ],
    "component_tree": ["App", "Hero"],
    "data_flow": {},
    "file_structure": ["App.tsx"],
    "estimated_complexity": "medium",
    "risks": ["tight deadline"],
    "recommended_stack": {"frontend": "React"},
})

CODE_RESPONSE = json.dumps({
    "files": [
        {"path": "App.tsx", "content": "<h1>Hero</h1>", "language": "tsx", "purpose": "Main"},
        {"path": "styles.css", "content": ".hero{}", "language": "css", "purpose": "Styles"},
        {"path": "index.tsx", "content": "import App from './App';", "language": "tsx", "purpose": "Entry"},
    ]
})

GENERIC_RESPONSE = json.dumps({"consensus_score": 0.85, "review": "Looks good.", "passed": True})


def _make_llm_response(prompt, **kwargs):
    p = prompt.lower()
    if "architecture plan for:" in p:
        return ARCH_RESPONSE
    elif "generate code files" in p:
        return CODE_RESPONSE
    return GENERIC_RESPONSE


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
# vibe_architect_tool
# ---------------------------------------------------------------------------

class TestVibeArchitectTool:
    @pytest.mark.asyncio
    async def test_returns_decisions(self):
        from vibeserve.tools.v5_tools import vibe_architect_tool
        result = await vibe_architect_tool(
            ctx=MockCtx(), intent="Build a SaaS dashboard", target_stack="react"
        )
        assert result["status"] == "success"
        assert result["decision_count"] >= 3

    @pytest.mark.asyncio
    async def test_empty_intent_validation_error(self):
        from vibeserve.tools.v5_tools import vibe_architect_tool
        result = await vibe_architect_tool(ctx=MockCtx(), intent="", target_stack="react")
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_with_constraints(self):
        from vibeserve.tools.v5_tools import vibe_architect_tool
        result = await vibe_architect_tool(
            ctx=MockCtx(), intent="Build a mobile app",
            constraints=["WCAG AAA", "Mobile-first"], target_stack="react"
        )
        assert result["decision_count"] >= 3

    @pytest.mark.asyncio
    async def test_risk_count_present(self):
        from vibeserve.tools.v5_tools import vibe_architect_tool
        result = await vibe_architect_tool(
            ctx=MockCtx(), intent="Build a login page", target_stack="react"
        )
        assert "risk_count" in result
        assert result["risk_count"] >= 0


# ---------------------------------------------------------------------------
# vibe_code_tool
# ---------------------------------------------------------------------------

SAMPLE_PLAN = {
    "decisions": [{"id": "d1", "title": "React", "context": "UI", "decision": "React",
                   "alternatives": [], "rationale": "Good", "consequences": [], "confidence": 1.0}],
    "component_tree": ["App"],
    "data_flow": {},
    "file_structure": ["App.tsx"],
    "estimated_complexity": "low",
    "risks": [],
    "recommended_stack": {},
}


class TestVibeCodeTool:
    @pytest.mark.asyncio
    async def test_returns_files(self):
        from vibeserve.tools.v5_tools import vibe_code_tool
        result = await vibe_code_tool(
            ctx=MockCtx(), intent="Build a hero section",
            plan=SAMPLE_PLAN, target_language="typescript"
        )
        assert result["status"] == "success"
        assert result["file_count"] >= 3
        assert len(result["files"]) >= 3

    @pytest.mark.asyncio
    async def test_empty_intent_error(self):
        from vibeserve.tools.v5_tools import vibe_code_tool
        result = await vibe_code_tool(
            ctx=MockCtx(), intent="", plan=SAMPLE_PLAN, target_language="typescript"
        )
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_total_lines_positive(self):
        from vibeserve.tools.v5_tools import vibe_code_tool
        result = await vibe_code_tool(
            ctx=MockCtx(), intent="Build a login page",
            plan=SAMPLE_PLAN, target_language="typescript"
        )
        assert result["total_lines"] >= 0

    @pytest.mark.asyncio
    async def test_quality_dict_present(self):
        from vibeserve.tools.v5_tools import vibe_code_tool
        result = await vibe_code_tool(
            ctx=MockCtx(), intent="Build a nav bar",
            plan=SAMPLE_PLAN, target_language="typescript"
        )
        assert "quality" in result
        assert isinstance(result["quality"], dict)


# ---------------------------------------------------------------------------
# vibe_verify_tool
# ---------------------------------------------------------------------------

class TestVibeVerifyTool:
    @pytest.mark.asyncio
    async def test_spec_validation(self):
        from vibeserve.tools.v5_tools import vibe_verify_tool
        spec = {
            "version": "1.0",
            "metadata": {"id": "s1", "name": "Test"},
            "components": [],
            "design_system": {
                "tokens": {"colors": {}},
                "constraints": {"min_wcag_level": "AA"},
            },
        }
        result = await vibe_verify_tool(ctx=MockCtx(), specification=spec)
        assert "results" in result
        assert "all_passed" in result

    @pytest.mark.asyncio
    async def test_file_quality_check(self):
        from vibeserve.tools.v5_tools import vibe_verify_tool
        files = [{"path": "App.tsx", "content": "<h1>Hello</h1>",
                  "language": "tsx", "purpose": "Main"}]
        result = await vibe_verify_tool(ctx=MockCtx(), files=files)
        assert "results" in result

    @pytest.mark.asyncio
    async def test_empty_inputs_returns_empty_results(self):
        from vibeserve.tools.v5_tools import vibe_verify_tool
        result = await vibe_verify_tool(ctx=MockCtx())
        assert result["results"] == {}
        assert result["all_passed"] is True


# ---------------------------------------------------------------------------
# vibe_preview_tool
# ---------------------------------------------------------------------------

class TestVibePreviewTool:
    @pytest.mark.asyncio
    async def test_returns_preview_info(self):
        from vibeserve.tools.v5_tools import vibe_preview_tool
        result = await vibe_preview_tool(
            ctx=MockCtx(),
            html_content="<html><body><h1>Test</h1></body></html>",
            filename="test.html",
        )
        assert result["status"] == "success"
        assert result["html_file"] == "test.html"
        assert result["html_size"] > 0
        assert "playwright_test" in result


# ---------------------------------------------------------------------------
# vibe_health_tool
# ---------------------------------------------------------------------------

class TestVibeHealthTool:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self):
        from vibeserve.tools.v5_tools import vibe_health_tool
        result = await vibe_health_tool(ctx=MockCtx())
        assert result["status"] == "healthy"
        assert "provider_count" in result
        assert "version" in result


# ---------------------------------------------------------------------------
# vibe_compress_tool
# ---------------------------------------------------------------------------

class TestVibeCompressTool:
    @pytest.mark.asyncio
    async def test_compresses_dict(self):
        from vibeserve.tools.v5_tools import vibe_compress_tool
        data = {"key": "value", "nested": {"a": 1, "b": 2}}
        result = await vibe_compress_tool(ctx=MockCtx(), data=data)
        assert result["status"] == "success"
        assert "compressed" in result
        assert "savings" in result

    @pytest.mark.asyncio
    async def test_savings_fields_present(self):
        from vibeserve.tools.v5_tools import vibe_compress_tool
        data = {"decisions": list(range(20)), "complexity": "high"}
        result = await vibe_compress_tool(ctx=MockCtx(), data=data)
        assert result["status"] == "success"
        s = result["savings"]
        assert "original_tokens" in s
        assert "compressed_tokens" in s
        assert "percent" in s


# ---------------------------------------------------------------------------
# vibe_upgrade_design_tool
# ---------------------------------------------------------------------------

class TestVibeUpgradeDesignTool:
    @pytest.mark.asyncio
    async def test_returns_upgraded_design(self):
        from vibeserve.tools.v5_tools import vibe_upgrade_design_tool
        result = await vibe_upgrade_design_tool(ctx=MockCtx(), template="supabase")
        assert result["status"] == "success"
        assert "upgraded_design" in result
        assert len(result["upgraded_design"]) > 0

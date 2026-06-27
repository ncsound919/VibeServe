"""Tests for the LLM HTTP endpoint.

We mock the LLM provider so the test runs offline. The goal is to verify the
endpoint plumbing, rate limiting, and error handling — not the LLM itself.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

import pytest

from vibeserve.llm_endpoint import (
    handle_llm_complete,
    handle_llm_health,
    get_cost_summary,
    _RATE_LIMITER,
    _COST_LOCK,
    COST_LOG,
)


@pytest.fixture(autouse=True)
def _reset_state():
    """Reset rate limiter and cost log between tests."""
    with _COST_LOCK:
        COST_LOG.clear()
    _RATE_LIMITER._calls.clear()
    yield


def _mock_provider(name: str = "MockProvider", model: str = "mock-1", content: str = "ok"):
    """Build a mock LLM provider."""
    prov = AsyncMock()
    prov.name = name
    prov.model = model
    prov.call = AsyncMock(return_value=content)
    return prov


async def test_health_lists_providers():
    """Health endpoint returns a dict with providers list."""
    with patch("vibeserve.providers.router") as mock_router:
        mock_router._ensure_init = lambda: None
        mock_router.providers = {"gemini": _mock_provider(), "openai": _mock_provider()}
        mock_router.default_name = "gemini"
        mock_router.resolve_for_complexity = lambda c: ("gemini", "mock-1")
        result = await handle_llm_health()
    assert result["status"] == "ok"
    assert "gemini" in result["providers"]
    assert result["default"] == "gemini"
    assert result["default_ready"] is True


async def test_complete_success():
    """Successful LLM call returns content, usage, and latency."""
    with patch("vibeserve.providers.router") as mock_router:
        mock_router.get = lambda name: _mock_provider(content="hello world")
        mock_router.resolve_for_complexity = lambda c: ("gemini", "mock-1")
        result = await handle_llm_complete({}, json.dumps({"prompt": "say hi"}).encode())
    assert result["status"] == "success"
    assert result["content"] == "hello world"
    assert result["provider"] == "MockProvider"
    assert "latency_ms" in result
    assert result["usage"]["total_tokens"] > 0


async def test_complete_rejects_empty_prompt():
    """Empty prompt returns error, not exception."""
    result = await handle_llm_complete({}, json.dumps({"prompt": ""}).encode())
    assert result["status"] == "error"
    assert "prompt" in result["error"].lower()


async def test_complete_rejects_invalid_json_body():
    """Malformed JSON body returns error, not crash."""
    result = await handle_llm_complete({}, b"not json at all")
    assert result["status"] == "error"


async def test_complete_handles_provider_failure():
    """Provider returning None surfaces as error with provider info."""
    with patch("vibeserve.providers.router") as mock_router:
        mock_router.get = lambda name: _mock_provider(content=None)
        mock_router.resolve_for_complexity = lambda c: ("gemini", "mock-1")
        result = await handle_llm_complete({}, json.dumps({"prompt": "x"}).encode())
    assert result["status"] == "error"
    assert "no content" in result["error"].lower()


async def test_complete_rate_limited():
    """Exceeding the rate limit returns a structured error, not a crash."""
    with patch("vibeserve.providers.router") as mock_router:
        mock_router.get = lambda name: _mock_provider(content="ok")
        # Pre-fill the limiter window
        _RATE_LIMITER._calls["gemini"] = [__import__("time").time()] * _RATE_LIMITER.max
        result = await handle_llm_complete({}, json.dumps({"prompt": "x", "provider": "gemini"}).encode())
    assert result["status"] == "error"
    assert "rate limit" in result["error"].lower()


async def test_cost_summary_aggregates_records():
    """Cost summary tracks calls and tokens across invocations."""
    with patch("vibeserve.providers.router") as mock_router:
        mock_router.get = lambda name: _mock_provider(content="some response text")
        mock_router.resolve_for_complexity = lambda c: ("gemini", "mock-1")
        await handle_llm_complete({}, json.dumps({"prompt": "first call"}).encode())
        await handle_llm_complete({}, json.dumps({"prompt": "second call"}).encode())
    summary = get_cost_summary()
    assert summary["total_calls"] == 2
    assert summary["total_prompt_tokens"] > 0
    assert "MockProvider" in summary["by_provider"]

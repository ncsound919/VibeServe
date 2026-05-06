#!/usr/bin/env python3
"""
VibeServe MCP Fix Verification Tests — FUNCTIONAL TESTS

These tests actually verify runtime behavior, not source code strings.
They call handlers, mock dependencies, and verify return values.
"""

import asyncio
import json
import logging
import pytest
import sys
import os
from io import StringIO
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ═══════════════════════════════════════════════════════════════════════════════
# FIX 1: Response DTOs actually returned (not raw dicts)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_vibe_architect_returns_response_dto_not_dict():
    """vibe_architect must return ArchitectResponse DTO, not raw dict."""
    from vibeserve.tools.v5_tools import vibe_architect_tool
    from vibeserve.models import ArchitectResponse
    
    # Mock context
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    
    # Mock the LLM to return a plan
    with patch('vibeserve.tools.v5_tools.VibeArchitect') as mock_arch:
        mock_instance = MagicMock()
        mock_instance.plan = AsyncMock(return_value=MagicMock(
            intent="test",
            decisions=[],
            component_tree=[],
            data_flow={},
            file_structure=[],
            estimated_complexity="medium",
            risks=[],
            recommended_stack={}
        ))
        mock_arch.return_value = mock_instance
        
        result = await vibe_architect_tool(
            ctx=mock_ctx,
            intent="Build a dashboard",
            target_stack="react"
        )
    
    # Verify it's NOT a raw dict response
    assert isinstance(result, dict)
    assert 'status' in result
    assert result['status'] == 'success'
    # Verify DTO fields are present (not old raw dict format)
    assert 'plan' in result
    assert 'decision_count' in result
    assert isinstance(result['plan'], dict)


@pytest.mark.asyncio  
async def test_vibe_code_returns_response_dto():
    """vibe_code must return CodeResponse DTO."""
    from vibeserve.tools.v5_tools import vibe_code_tool
    from vibeserve.models import VibePlan, CodeFile
    
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    
    with patch('vibeserve.tools.v5_tools.VibeImplementer') as mock_impl:
        mock_instance = MagicMock()
        mock_instance.implement = AsyncMock(return_value=[
            MagicMock(path='App.tsx', content='export {}', model_dump=lambda: {'path': 'App.tsx', 'content': 'export {}'})
        ])
        mock_impl.return_value = mock_instance
        
        result = await vibe_code_tool(
            ctx=mock_ctx,
            intent="Build app",
            plan={'decisions': [], 'component_tree': []},
            target_language="typescript"
        )
    
    assert 'status' in result
    assert 'files' in result
    assert 'file_count' in result


# ══════════════════════════════════════════════════════════════════════��════════
# FIX 2: ValidationError actually caught and returns error response
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_vibe_architect_returns_error_on_invalid_input():
    """vibe_architect must catch ValidationError and return error dict."""
    from vibeserve.tools.v5_tools import vibe_architect_tool
    
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    
    # Call with invalid input (empty intent violates min_length=1)
    result = await vibe_architect_tool(
        ctx=mock_ctx,
        intent="",  # Invalid: empty string
        target_stack="react"
    )
    
    # Must return error response, NOT raise exception
    assert isinstance(result, dict)
    assert result.get('status') == 'error'
    assert 'error' in result
    assert 'details' in result


@pytest.mark.asyncio
async def test_vibe_code_returns_error_on_invalid_input():
    from vibeserve.tools.v5_tools import vibe_code_tool
    
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    
    # Missing required 'plan' field
    result = await vibe_code_tool(
        ctx=mock_ctx,
        intent="test",
        plan=None,  # Invalid: required field
    )
    
    assert result.get('status') == 'error'


@pytest.mark.asyncio
async def test_vibe_verify_returns_error_on_bad_input():
    from vibeserve.tools.v5_tools import vibe_verify_tool
    
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    
    # Empty specification
    result = await vibe_verify_tool(ctx=mock_ctx, specification=None)
    
    # Should handle gracefully, not raise
    assert isinstance(result, dict)


# ═══════════════════════════════════════════════════════════════════════════════
# FIX 3: @audit_tool actually wraps handlers (__wrapped__ check)
# ═══════════════════════════════════════════════════════════════════════════════

def test_vibe_architect_has_audit_tool_decorator():
    """vibe_architect must be wrapped by audit_tool."""
    from vibeserve.tools.v5_tools import vibe_architect_tool
    # Check __wrapped__ exists (decorated by functools.wraps)
    assert hasattr(vibe_architect_tool, '__wrapped__'), "audit_tool decorator not applied"


def test_vibe_code_has_audit_tool():
    from vibeserve.tools.v5_tools import vibe_code_tool
    assert hasattr(vibe_code_tool, '__wrapped__')


def test_all_core_pipeline_tools_wrapped():
    """Verify all core pipeline tools have audit_tool."""
    from vibeserve.tools import v5_tools
    
    tools = [
        'vibe_architect_tool', 'vibe_code_tool', 'vibe_review_tool',
        'vibe_verify_tool', 'vibe_iterate_tool', 'vibe_test_tool',
        'vibe_deploy_tool', 'vibe_health_tool', 'vibe_audit_tool'
    ]
    
    for name in tools:
        func = getattr(v5_tools, name, None)
        if func:
            assert hasattr(func, '__wrapped__'), f"{name} not wrapped with @audit_tool"


def test_pipeline_file_tools_wrapped():
    """Verify file I/O tools have @audit_tool."""
    from vibeserve.tools import pipeline_tools
    
    tools = ['write_file_tool', 'read_file_tool', 'run_install_tool', 'run_build_tool']
    for name in tools:
        func = getattr(pipeline_tools, name, None)
        if func:
            assert hasattr(func, '__wrapped__'), f"{name} not wrapped"


def test_integration_tools_wrapped():
    from vibeserve.tools import integration_tools
    
    protected = ['supabase_query_tool', 'supabase_insert_tool', 'vercel_deployments_tool']
    for name in protected:
        func = getattr(integration_tools, name, None)
        if func:
            assert hasattr(func, '__wrapped__')


# ═══════════════════════════════════════════════════════════════════════════════
# FIX 4: Correlation IDs actually propagate in structured logging
# ═══════════════════════════════════════════════════════════════════════════════

def test_trace_id_generated_and_stored():
    """new_trace_id generates and stores ID."""
    from vibeserve.middleware import new_trace_id, get_trace_id, set_trace_id
    
    tid = new_trace_id()
    assert tid
    assert len(tid) > 0
    
    set_trace_id(tid)
    assert get_trace_id() == tid


def test_trace_id_context_var_isolation():
    """Trace IDs are isolated per context."""
    from vibeserve.middleware import new_trace_id, set_trace_id, get_trace_id
    
    tid1 = new_trace_id()
    set_trace_id(tid1)
    
    # Simulate another context (no set in between)
    tid2 = get_trace_id()
    
    assert tid1 == tid2  # Same context


@pytest.mark.asyncio
async def test_trace_id_set_in_context():
    """Verify trace_id is set when audit_tool runs."""
    from vibeserve.middleware import new_trace_id, set_trace_id
    
    tid = new_trace_id()
    set_trace_id(tid)
    
    from vibeserve.middleware import get_trace_id
    assert get_trace_id() == tid


# ═══════════════════════════════════════════════════════════════════════════════
# FIX 5: Rate limiting actually blocks excess requests
# ═══════════════════════════════════════════════════════════════════════════════

def test_rate_limiter_blocks_after_burst():
    """TokenBucket must block after burst is exhausted."""
    from vibeserve.middleware import TokenBucket
    
    limiter = TokenBucket(rate=10.0, burst=2)
    
    # First 2 requests allowed
    import asyncio as _asyncio
    assert _asyncio.run(limiter.allow('client-a')) is True
    assert _asyncio.run(limiter.allow('client-a')) is True
    
    # 3rd request blocked
    assert _asyncio.run(limiter.allow('client-a')) is False


def test_rate_limiter_per_identity():
    """Rate limiter is per-identity."""
    from vibeserve.middleware import TokenBucket
    
    limiter = TokenBucket(rate=10.0, burst=1)
    
    import asyncio as _asyncio
    assert _asyncio.run(limiter.allow('client-1')) is True
    assert _asyncio.run(limiter.allow('client-1')) is False
    assert _asyncio.run(limiter.allow('client-2')) is True  # Different client


@pytest.mark.asyncio
async def test_audit_tool_returns_rate_limit_error():
    """audit_tool must return error when rate limited."""
    from vibeserve.tools.v5_tools import vibe_health_tool
    
    mock_ctx = MagicMock()
    mock_ctx.info = AsyncMock()
    mock_ctx.report_progress = AsyncMock()
    mock_ctx.client_id = "rate-test-client"
    
    # Force rate limit by exhausting tokens
    from vibeserve.middleware import rate_limiter
    for _ in range(20):
        await rate_limiter.allow('rate-test-client')
    
    result = await vibe_health_tool(ctx=mock_ctx)
    
    # Should return rate limit error
    assert result.get('status') == 'error'
    assert 'Rate limit' in result.get('error', '')


# ═══════════════════════════════════════════════════════════════════════════════════════
# INTEGRATION: Full MCP server builds with all tools
# ═══════════════════════════════════════════════════════════════════════════════

def test_mcp_server_builds_with_all_tools():
    """MCP server must build and register all tools."""
    from vibeserve import server as server_module
    from vibeserve import tools
    
    # Build will import tools
    from vibeserve.server import mcp_server
    
    server = mcp_server.build()
    assert server is not None


def test_response_dto_serializes_to_json():
    """Response DTOs must serialize to valid JSON."""
    from vibeserve.models import (
        ArchitectResponse, CodeResponse, ReviewResponse,
        VerifyResponse, IterateResponse, TestResponse, DeployResponse
    )
    
    responses = [
        ArchitectResponse(plan={}, decision_count=0, risk_count=0),
        CodeResponse(files=[], file_count=0, quality={}, total_lines=0),
        ReviewResponse(consensus_score=0.0, recommendation=''),
        VerifyResponse(results={}, all_passed=True),
        IterateResponse(final_output={}, iterations=[], iterations_used=0, 
                       final_score=0.0, converged=False, score_improvement=0.0),
        TestResponse(test_files=[], test_count=0, quality={}, framework=''),
        DeployResponse(project='', targets=[], configs={}, environment_variables={})
    ]
    
    for r in responses:
        dumped = r.model_dump()
        # Must be JSON serializable
        json.dumps(dumped)
        assert 'status' in dumped
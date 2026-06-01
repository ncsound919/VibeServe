"""Tests for vibeserve.middleware — TokenBucket rate limiter."""

import asyncio
import time
import pytest
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from starlette.testclient import TestClient
from vibeserve.middleware import TokenBucket, audit_tool, rate_limiter


class TestTokenBucket:
    @pytest.mark.asyncio
    async def test_rate_limiter_allows_burst(self):
        limiter = TokenBucket(rate=1.0, burst=3)
        for _ in range(3):
            assert await limiter.allow("test-id")
        assert not await limiter.allow("test-id")

    @pytest.mark.asyncio
    async def test_rate_limiter_replenishes(self):
        limiter = TokenBucket(rate=1.0, burst=1)
        assert await limiter.allow("test-id")
        assert not await limiter.allow("test-id")
        await asyncio.sleep(1.1)
        assert await limiter.allow("test-id")

    @pytest.mark.asyncio
    async def test_rate_limiter_evicts_stale_entries(self):
        limiter = TokenBucket(rate=1.0, burst=10)
        now = time.monotonic()
        limiter._last_check["stale-entry"] = now - 4000
        limiter._tokens["stale-entry"] = 5.0
        for i in range(1001):
            uid = f"active-{i}"
            limiter._last_check[uid] = now
            limiter._tokens[uid] = 10.0
        limiter._evict_stale()
        assert "stale-entry" not in limiter._tokens
        assert "stale-entry" not in limiter._last_check
        stale_count = sum(1 for k in limiter._tokens if k == "stale-entry")
        assert stale_count == 0


class TestCorsMiddleware:
    def test_cors_headers_set(self):
        app = Starlette(debug=True)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
        app.add_route("/", lambda r: Response("OK", media_type="text/plain"))

        client = TestClient(app)
        resp = client.get("/", headers={"Origin": "http://example.com"})
        assert resp.headers.get("access-control-allow-origin") == "*"

    def test_cors_allows_configured_origins(self):
        app = Starlette(debug=True)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://allowed.com"],
            allow_methods=["GET"],
            allow_headers=["*"],
        )
        app.add_route("/", lambda r: Response("OK", media_type="text/plain"))

        client = TestClient(app)
        resp_allowed = client.get("/", headers={"Origin": "http://allowed.com"})
        assert resp_allowed.headers.get("access-control-allow-origin") == "http://allowed.com"
        resp_denied = client.get("/", headers={"Origin": "http://evil.com"})
        assert resp_denied.headers.get("access-control-allow-origin") != "http://evil.com"


class TestRateLimitMiddleware:
    @pytest.mark.asyncio
    async def test_requests_within_limit_pass(self):
        @audit_tool
        async def my_tool(ctx):
            return {"status": "ok"}

        class MockCtx:
            client_id = "within-limit"

        result = await my_tool(MockCtx())
        assert result["status"] == "ok"

    @pytest.mark.asyncio
    async def test_requests_exceeding_limit_get_429(self):
        for _ in range(15):
            await rate_limiter.allow("exceed-id")

        @audit_tool
        async def my_tool(ctx):
            return {"status": "ok"}

        class MockCtx:
            client_id = "exceed-id"

        result = await my_tool(MockCtx())
        assert result["status"] == "error"


class TestAuditToolDecorator:
    @pytest.mark.asyncio
    async def test_audit_tool_works_on_mock_function(self):
        @audit_tool
        async def my_tool(ctx, x: int):
            return {"result": x * 2}

        class MockCtx:
            client_id = "tester"

        result = await my_tool(MockCtx(), x=5)
        assert result["result"] == 10

    @pytest.mark.asyncio
    async def test_audit_tool_records_timing(self):
        @audit_tool
        async def slow_tool(ctx):
            await asyncio.sleep(0.01)
            return {"status": "ok"}

        class MockCtx:
            client_id = "tester"

        result = await slow_tool(MockCtx())
        assert result["status"] == "ok"

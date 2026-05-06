"""Tests for vibeserve.auth — JWT token creation, verification, and scope enforcement."""

import os
import pytest
from vibeserve.auth import create_token, verify_token, is_auth_enabled, require_scope

SECRET = "test-secret-12345"


@pytest.fixture(autouse=True)
def set_secret():
    os.environ["VIBESERVE_API_SECRET"] = SECRET
    yield
    os.environ.pop("VIBESERVE_API_SECRET", None)


class TestCreateToken:
    def test_creates_valid_token(self):
        token = create_token(api_key="test-key", expires_hours=1)
        assert isinstance(token, str)
        assert len(token) > 20

    def test_fails_without_secret(self):
        os.environ.pop("VIBESERVE_API_SECRET", None)
        with pytest.raises(RuntimeError, match="VIBESERVE_API_SECRET not set"):
            create_token()


class TestVerifyToken:
    def test_verifies_valid_token(self):
        token = create_token()
        claims = verify_token(token)
        assert claims["sub"] == "vibeserve-client"
        assert "mcp:read" in claims["scope"]
        assert "mcp:write" in claims["scope"]

    def test_rejects_tampered_token(self):
        token = create_token()
        tampered = token[:-5] + "abcde"
        with pytest.raises(PermissionError, match="Invalid token"):
            verify_token(tampered)

    def test_anonymous_when_auth_disabled(self):
        os.environ.pop("VIBESERVE_API_SECRET", None)
        claims = verify_token("any-garbage-token")
        assert claims["sub"] == "anonymous"


class TestIsAuthEnabled:
    def test_enabled_with_secret(self):
        assert is_auth_enabled() is True

    def test_disabled_without_secret(self):
        os.environ.pop("VIBESERVE_API_SECRET", None)
        assert is_auth_enabled() is False


class TestRequireScope:
    async def test_allows_with_correct_scope(self):
        token = create_token()

        class MockCtx:
            auth_token = token

        @require_scope("mcp:read")
        async def handler(ctx):
            return {"status": "success"}

        result = await handler(MockCtx())
        assert result == {"status": "success"}

    async def test_denies_without_token(self):
        class MockCtx:
            auth_token = None

        @require_scope("mcp:write")
        async def handler(ctx):
            return {"status": "success"}

        result = await handler(MockCtx())
        assert result["status"] == "error"
        assert result["code"] == "UNAUTHORIZED"

    async def test_denies_wrong_scope(self):
        token = create_token()

        class MockCtx:
            auth_token = token

        @require_scope("mcp:admin")
        async def handler(ctx):
            return {"status": "success"}

        result = await handler(MockCtx())
        assert result["status"] == "error"
        assert result["code"] == "FORBIDDEN"

    async def test_skips_when_auth_disabled(self):
        os.environ.pop("VIBESERVE_API_SECRET", None)

        class MockCtx:
            auth_token = None

        @require_scope("mcp:admin")
        async def handler(ctx):
            return {"status": "success"}

        result = await handler(MockCtx())
        assert result == {"status": "success"}

    async def test_invalid_token(self):
        class MockCtx:
            auth_token = "not-a-valid-jwt"

        @require_scope("mcp:read")
        async def handler(ctx):
            return {"status": "success"}

        result = await handler(MockCtx())
        assert result["status"] == "error"
        assert result["code"] == "UNAUTHORIZED"

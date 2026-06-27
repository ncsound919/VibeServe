"""Pytest configuration — patches auth for offline testing."""
import os
from unittest.mock import patch

import pytest

os.environ["VIBESERVE_API_SECRET"] = "test-secret-32-characters-for-pytest!"

import vibeserve.auth

# Save original for test_auth.py to reference (stash on auth module to avoid import conflicts)
vibeserve.auth._ORIG_VERIFY = vibeserve.auth.verify_token

# Patch globally so all require_scope-decorated tools accept any token
vibeserve.auth.verify_token = lambda token: {"sub": "pytest", "scope": "mcp:read mcp:write mcp:admin"}
vibeserve.auth.validate_secret_on_startup = lambda: None


@pytest.fixture
def patch_auth():
    """Patch verify_token to accept any token. Use in test files that call tools."""
    with patch("vibeserve.auth.verify_token", return_value={"sub": "pytest", "scope": "mcp:read mcp:write mcp:admin"}):
        yield

"""JWT authentication for VibeServe MCP server.

Configure via VIBESERVE_API_SECRET env var. Without it, auth is disabled (allow-all).
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


def _get_secret() -> Optional[str]:
    return os.getenv("VIBESERVE_API_SECRET")


def create_token(api_key: Optional[str] = None, expires_hours: int = 24) -> str:
    secret = _get_secret()
    if not secret:
        raise RuntimeError("VIBESERVE_API_SECRET not set")
    from jose import jwt
    now = datetime.now(timezone.utc)
    payload = {
        "sub": api_key or "vibeserve-client",
        "iat": now,
        "exp": now + timedelta(hours=expires_hours),
        "scope": "mcp:read mcp:write",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_token(token: str) -> Dict[str, Any]:
    secret = _get_secret()
    if not secret:
        return {"sub": "anonymous", "scope": "mcp:read mcp:write"}
    from jose import jwt, JWTError, ExpiredSignatureError
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except ExpiredSignatureError:
        raise PermissionError("Token expired")
    except JWTError as e:
        raise PermissionError(f"Invalid token: {e}")


def is_auth_enabled() -> bool:
    return bool(_get_secret())

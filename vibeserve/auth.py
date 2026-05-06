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


def require_scope(required_scope: str):
    """Decorator that enforces JWT scope on tool handlers.

    Usage:
        @require_scope("mcp:write")
        async def my_tool(ctx, ...): ...
    """
    import functools
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(ctx, *args, **kwargs):
            if not is_auth_enabled():
                return await func(ctx, *args, **kwargs)
            token = getattr(ctx, "auth_token", None)
            if not token:
                return {"status": "error", "error": "Authentication required", "code": "UNAUTHORIZED"}
            try:
                claims = verify_token(token)
            except PermissionError as e:
                return {"status": "error", "error": str(e), "code": "UNAUTHORIZED"}
            scopes = set(claims.get("scope", "").split())
            if required_scope not in scopes and "mcp:admin" not in scopes:
                return {"status": "error", "error": f"Missing scope: {required_scope}", "code": "FORBIDDEN"}
            return await func(ctx, *args, **kwargs)
        return wrapper
    return decorator

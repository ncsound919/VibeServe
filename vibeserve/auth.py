"""JWT authentication for VibeServe MCP server.

Configure via VIBESERVE_API_SECRET env var.
A missing secret raises RuntimeError on startup AND at request time — auth is NEVER silently disabled.
This module implements defense-in-depth: startup validation + per-request enforcement.
"""

from __future__ import annotations

import base64
import functools
import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

log = logging.getLogger("VibeServe")

# ====================== NATIVE JWT ======================


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def create_jwt(payload: dict, secret: str, algorithm: str = "HS256") -> str:
    header = _b64url_encode(json.dumps({"alg": algorithm, "typ": "JWT"}).encode())
    # iat: seconds since epoch (int) — standard JWT practice
    payload["iat"] = payload.get("iat", int(time.time()))
    body = _b64url_encode(json.dumps(payload).encode())
    signature = hmac.new(
        secret.encode(), f"{header}.{body}".encode(), hashlib.sha256
    ).digest()
    return f"{header}.{body}.{_b64url_encode(signature)}"


def decode_jwt(token: str, secret: str, algorithms: list = None) -> dict:
    """Decode and verify a JWT. Raises JWTError on any failure."""
    if algorithms is not None and "HS256" not in algorithms:
        raise ValueError(f"Only HS256 is supported, got {algorithms}")
    parts = token.split(".")
    if len(parts) != 3:
        raise JWTError("Invalid token format")
    header_b64, payload_b64, sig_b64 = parts
    expected_sig = hmac.new(
        secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
    ).digest()
    actual_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise JWTError("Invalid signature")
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise JWTError(f"Invalid payload encoding: {e}")
    if "exp" in payload and payload["exp"] < time.time():
        raise JWTError("Token expired")
    return payload


class JWTError(Exception):
    """Raised when JWT validation fails."""
    pass


# ====================== AUTH FUNCTIONS ======================


def _get_secret() -> Optional[str]:
    """Return the VIBESERVE_API_SECRET value, or None if not set."""
    return os.getenv("VIBESERVE_API_SECRET")


def _require_secret() -> str:
    """Return the secret or raise RuntimeError — never silently allow-all.

    This is called at both startup (validate_secret_on_startup) and
    request-time (verify_token).  Defense-in-depth: even if one layer
    is skipped, the other still enforces.
    """
    secret = _get_secret()
    if not secret:
        raise RuntimeError(
            "VIBESERVE_API_SECRET is not set. "
            "Set this environment variable before starting VibeServe. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return secret


def validate_secret_on_startup() -> None:
    """Call this at server startup to hard-fail before accepting any connections.

    Every entrypoint (MCP server, HTTP bridge, programmatic API) MUST call
    this before serving requests.
    """
    _require_secret()
    log.info("VibeServe auth: secret present, authentication enabled.")


def create_token(api_key: Optional[str] = None, expires_hours: int = 24) -> str:
    secret = _require_secret()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=expires_hours)
    payload = {
        "sub": api_key or "vibeserve-client",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "scope": "mcp:read mcp:write",
    }
    return create_jwt(payload, secret, algorithm="HS256")


def verify_token(token: str) -> Dict[str, Any]:
    """Verify a JWT token and return its claims.

    Fail-closed: raises PermissionError if the secret is missing, token is
    invalid/expired, or any verification step fails.

    NEVER returns anonymous claims — every code path raises on failure.
    """
    secret = _require_secret()

    if not token:
        raise PermissionError("Missing authentication token")

    try:
        return decode_jwt(token, secret, algorithms=["HS256"])
    except JWTError as e:
        raise PermissionError(f"Invalid token: {e}") from e


def is_auth_enabled() -> bool:
    return bool(_get_secret())


def require_scope(required_scope: str):
    """Decorator that enforces JWT scope on tool handlers.

    Usage:
        @require_scope("mcp:write")
        async def my_tool(ctx, ...): ...

    Fail-closed: never silently bypasses auth.  Every request is verified,
    regardless of whether startup validation ran.
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(ctx, *args, **kwargs):
            # Auth is ALWAYS enforced — no silent bypass when secret is missing.
            token = getattr(ctx, "auth_token", None) or getattr(ctx, "request_token", None)
            if not token:
                return {
                    "status": "error",
                    "error": "Authentication required — no token provided",
                    "code": "UNAUTHORIZED",
                }
            try:
                claims = verify_token(token)
            except (PermissionError, RuntimeError) as e:
                return {"status": "error", "error": str(e), "code": "UNAUTHORIZED"}
            scopes = set(claims.get("scope", "").split())
            if required_scope not in scopes and "mcp:admin" not in scopes:
                return {
                    "status": "error",
                    "error": f"Missing required scope: {required_scope}",
                    "code": "FORBIDDEN",
                }
            return await func(ctx, *args, **kwargs)

        return wrapper

    return decorator

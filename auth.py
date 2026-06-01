"""JWT authentication for VibeServe MCP server.

Configure via VIBESERVE_API_SECRET env var.
A missing secret raises RuntimeError on startup — auth is never silently disabled.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import logging
import os
import time
import base64
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
    payload["iat"] = payload.get("iat", int(time.time()))
    body = _b64url_encode(json.dumps(payload).encode())
    # FIX: was hmac.new() which does not exist; correct call is hmac.new()
    signature = hmac.new(
        secret.encode(), f"{header}.{body}".encode(), hashlib.sha256
    ).digest()
    return f"{header}.{body}.{_b64url_encode(signature)}"


def decode_jwt(token: str, secret: str, algorithms: list = None) -> dict:
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
    payload = json.loads(_b64url_decode(payload_b64))
    if "exp" in payload and payload["exp"] < time.time():
        raise JWTError("Token expired")
    return payload


class JWTError(Exception):
    pass


# ====================== AUTH FUNCTIONS ======================


def _get_secret() -> Optional[str]:
    return os.getenv("VIBESERVE_API_SECRET")


def _require_secret() -> str:
    """Return the secret or raise — never silently allow-all."""
    secret = _get_secret()
    if not secret:
        raise RuntimeError(
            "VIBESERVE_API_SECRET is not set. "
            "Set this environment variable before starting VibeServe. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return secret


def validate_secret_on_startup() -> None:
    """Call this at server startup to hard-fail before accepting any connections."""
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
    # FIX: was fail-open (returned anonymous allow-all when secret missing).
    # Now fails closed — raises RuntimeError if secret is absent.
    secret = _require_secret()
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
    """
    import functools

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(ctx, *args, **kwargs):
            # Auth is always enforced — no silent bypass when secret is missing.
            token = getattr(ctx, "auth_token", None)
            if not token:
                return {
                    "status": "error",
                    "error": "Authentication required",
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
                    "error": f"Missing scope: {required_scope}",
                    "code": "FORBIDDEN",
                }
            return await func(ctx, *args, **kwargs)

        return wrapper

    return decorator

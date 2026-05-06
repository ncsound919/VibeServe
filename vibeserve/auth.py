"""JWT authentication for VibeServe MCP server.

Configure via VIBESERVE_API_SECRET env var. Without it, auth is disabled (allow-all).
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import time
import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

# ====================== NATIVE JWT ======================


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data)


def create_jwt(payload: dict, secret: str, algorithm: str = 'HS256') -> str:
    header = _b64url_encode(json.dumps({'alg': algorithm, 'typ': 'JWT'}).encode())
    payload['iat'] = payload.get('iat', int(time.time()))
    body = _b64url_encode(json.dumps(payload).encode())
    signature = hmac.new(secret.encode(), f'{header}.{body}'.encode(), hashlib.sha256).digest()
    return f'{header}.{body}.{_b64url_encode(signature)}'


def decode_jwt(token: str, secret: str, algorithms: list = None) -> dict:
    parts = token.split('.')
    if len(parts) != 3:
        raise JWTError('Invalid token format')
    header_b64, payload_b64, sig_b64 = parts
    expected_sig = hmac.new(secret.encode(), f'{header_b64}.{payload_b64}'.encode(), hashlib.sha256).digest()
    actual_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise JWTError('Invalid signature')
    payload = json.loads(_b64url_decode(payload_b64))
    if 'exp' in payload and payload['exp'] < time.time():
        raise JWTError('Token expired')
    return payload


class JWTError(Exception):
    pass


# ====================== AUTH FUNCTIONS ======================


def _get_secret() -> Optional[str]:
    return os.getenv("VIBESERVE_API_SECRET")


def create_token(api_key: Optional[str] = None, expires_hours: int = 24) -> str:
    secret = _get_secret()
    if not secret:
        raise RuntimeError("VIBESERVE_API_SECRET not set")
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
    secret = _get_secret()
    if not secret:
        return {"sub": "anonymous", "scope": "mcp:read mcp:write"}
    try:
        return decode_jwt(token, secret, algorithms=["HS256"])
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

"""Rate limiting, audit logging, and correlation-ID middleware for VibeServe."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any, Callable, Dict

from vibeserve.utils import StructuredLogger, sanitize_for_display

log = logging.getLogger("VibeServe")

# ====================== CORRELATION / TRACE ID ======================

_trace_id: ContextVar[str] = ContextVar("trace_id", default="")
_tool_name: ContextVar[str] = ContextVar("tool_name", default="")
_caller_id: ContextVar[str] = ContextVar("caller_id", default="")


def new_trace_id() -> str:
    return uuid.uuid4().hex[:16]


def get_trace_id() -> str:
    return _trace_id.get()


def set_trace_id(tid: str):
    _trace_id.set(tid)


def get_tool_name() -> str:
    return _tool_name.get()


def get_caller_id() -> str:
    return _caller_id.get()


# ====================== RATE LIMITER ======================

class TokenBucket:
    """Per-identity token bucket rate limiter (in-process, no Redis)."""

    def __init__(self, rate: float = 30.0, burst: int = 10):
        self.rate = rate
        self.burst = burst
        self._tokens: Dict[str, float] = {}
        self._last_check: Dict[str, float] = {}
        self._bucket_lock = asyncio.Lock()

    async def allow(self, identity: str) -> bool:
        if len(self._tokens) > 1000:
            self._evict_stale()
        async with self._bucket_lock:
            now = time.monotonic()
            last = self._last_check.get(identity, now)
            elapsed = now - last
            tokens = self._tokens.get(identity, self.burst)
            tokens = min(self.burst, tokens + elapsed * self.rate)
            self._last_check[identity] = now
            if tokens >= 1:
                self._tokens[identity] = tokens - 1
                return True
            self._tokens[identity] = tokens
            return False

    def _evict_stale(self):
        """Remove identities not seen in 1 hour."""
        cutoff = time.monotonic() - 3600
        stale = [k for k, v in self._last_check.items() if v < cutoff]
        for k in stale:
            self._tokens.pop(k, None)
            self._last_check.pop(k, None)

    def status(self, identity: str) -> Dict[str, Any]:
        now = time.monotonic()
        last = self._last_check.get(identity, now)
        elapsed = now - last
        tokens = min(self.burst, self._tokens.get(identity, self.burst) + elapsed * self.rate)
        return {"tokens": round(tokens, 2), "burst": self.burst, "rate": self.rate}


rate_limiter = TokenBucket(rate=30.0, burst=10)


# ====================== AUDIT LOGGER ======================

class AuditLogger:
    """Structured audit trail for every tool invocation."""

    @staticmethod
    async def log_invocation(
        tool_name: str,
        caller_identity: str,
        inputs: Dict[str, Any],
        outcome: str = "started",
        duration_ms: float = 0.0,
        error: str = "",
    ):
        input_hash = hashlib.sha256(
            json.dumps(inputs, sort_keys=True, default=str).encode()
        ).hexdigest()[:12]
        trace_id = get_trace_id() or "no-trace"
        StructuredLogger.event(
            "tool_invocation",
            tool=tool_name,
            caller=sanitize_for_display(caller_identity)[:64],
            input_hash=input_hash,
            outcome=outcome,
            duration_ms=round(duration_ms, 1),
            trace_id=trace_id,
            error=error,
        )

    @staticmethod
    async def log_security_event(
        event_type: str,
        detail: str,
        tool_name: str = "",
        identity: str = "",
    ):
        StructuredLogger.warn(
            "security_event",
            event_type=event_type,
            detail=sanitize_for_display(detail)[:200],
            tool=sanitize_for_display(tool_name)[:64],
            caller=sanitize_for_display(identity)[:64],
            trace_id=get_trace_id() or "no-trace",
        )


audit = AuditLogger()


# ====================== TOOL WRAPPER ======================

def audit_tool(func: Callable):
    """Decorator that adds rate limiting, audit logging, and correlation IDs to tool handlers."""
    import functools

    @functools.wraps(func)
    async def wrapper(ctx, *args, **kwargs):
        tid = new_trace_id()
        set_trace_id(tid)
        tool_name = func.__name__
        _tool_name.set(tool_name)

        identity = getattr(ctx, "client_id", "unknown")
        _caller_id.set(identity)

        inputs = {
            "args": [sanitize_for_display(str(a)[:200]) for a in args],
            "kwargs": {
                k: sanitize_for_display(str(v)[:200])
                for k, v in kwargs.items()
                if k != "ctx"
            },
        }

        if not await rate_limiter.allow(identity):
            await audit.log_security_event(
                "rate_limit_exceeded",
                f"Rate limit exceeded for {identity} on {tool_name}",
                tool_name=tool_name,
                identity=identity,
            )
            return {
                "status": "error",
                "error": "Rate limit exceeded. Please slow down.",
                "retry_after_seconds": 5,
            }

        t0 = time.monotonic()
        await audit.log_invocation(tool_name, identity, inputs)
        try:
            result = await func(ctx, *args, **kwargs)
            elapsed = (time.monotonic() - t0) * 1000
            await audit.log_invocation(
                tool_name, identity, inputs,
                outcome="success", duration_ms=elapsed,
            )
            return result
        except Exception as e:
            elapsed = (time.monotonic() - t0) * 1000
            await audit.log_invocation(
                tool_name, identity, inputs,
                outcome="error", duration_ms=elapsed, error=str(e),
            )
            log.exception(f"[{tool_name}] Unhandled error: {e}")
            raise

    return wrapper

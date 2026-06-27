"""Structured audit trail for every tool invocation."""

from __future__ import annotations

import functools
import hashlib
import json
import logging
import time
from typing import Any, Callable, Dict

from vibeserve.correlation import _caller_id, _tool_name, get_trace_id, new_trace_id, set_trace_id
from vibeserve.rate_limiter import rate_limiter
from vibeserve.utils import StructuredLogger, sanitize_for_display

log = logging.getLogger("VibeServe")


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


def audit_tool(func: Callable):
    """Decorator that adds rate limiting, audit logging, and correlation IDs to tool handlers."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        tid = new_trace_id()
        set_trace_id(tid)
        tool_name = func.__name__
        _tool_name.set(tool_name)

        identity = "unknown"
        ctx = args[0] if args else None
        if ctx is not None and hasattr(ctx, "client_id"):
            identity = getattr(ctx, "client_id", "unknown")
        _caller_id.set(identity)

        inputs = {
            "args": [sanitize_for_display(str(a)[:200]) for a in (args[1:] if args else args)],
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
        await audit.log_invocation(tool_name, identity, inputs, outcome="started")
        try:
            result = await func(*args, **kwargs)
            elapsed = (time.monotonic() - t0) * 1000
            outcome = "error" if isinstance(result, dict) and result.get("status") == "error" else "success"
            error_msg = result.get("error", "") if isinstance(result, dict) else ""
            await audit.log_invocation(
                tool_name, identity, inputs,
                outcome=outcome, duration_ms=elapsed, error=error_msg,
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

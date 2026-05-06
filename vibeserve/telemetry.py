"""Telemetry: StructuredLogger and SentryTracker for VibeServe."""

from __future__ import annotations
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

log = logging.getLogger("VibeServe")

# ====================== STRUCTURED LOGGING ======================
class StructuredLogger:
    _SECRET_PATTERNS = [
        (r'sk-[a-zA-Z0-9]{20,}', 'sk-***REDACTED***'),
        (r'Bearer [a-zA-Z0-9_\-]{20,}', 'Bearer ***REDACTED***'),
        (r'github_pat_[a-zA-Z0-9_]{20,}', 'github_pat_***REDACTED***'),
        (r'ghp_[a-zA-Z0-9]{36}', 'ghp_***REDACTED***'),
        (r'gho_[a-zA-Z0-9]{36}', 'gho_***REDACTED***'),
        (r'xox[baprs]-[a-zA-Z0-9\-]{10,}', 'xox*-***REDACTED***'),
        (r'password[\s:=]+[^\s,}]+', 'password=***REDACTED***'),
        (r'AIza[0-9A-Za-z\-_]{35}', 'AIza***REDACTED***'),
        (r'x-api-key[\s:=]+[^\s,}]+', 'x-api-key=***REDACTED***'),
    ]

    @classmethod
    def _redact(cls, text: str) -> str:
        for pattern, replacement in cls._SECRET_PATTERNS:
            text = re.sub(pattern, replacement, text)
        return text

    @staticmethod
    def event(name: str, **kwargs):
        data = StructuredLogger._redact(json.dumps({"event": name, "timestamp": datetime.now(timezone.utc).isoformat(), **kwargs}))
        log.info(f"[Structured] {data}")

    @staticmethod
    def error(name: str, error: str = "", **kwargs):
        data = StructuredLogger._redact(json.dumps({"event": name, "error": error, "timestamp": datetime.now(timezone.utc).isoformat(), "severity": "error", **kwargs}))
        log.error(f"[Structured] {data}")

    @staticmethod
    def warn(name: str, detail: str = "", **kwargs):
        data = StructuredLogger._redact(json.dumps({"event": name, "detail": detail, "timestamp": datetime.now(timezone.utc).isoformat(), "severity": "warning", **kwargs}))
        log.warning(f"[Structured] {data}")


# ====================== SENTRY TRACKER ======================
class SentryTracker:
    """Real Sentry SDK integration with backward-compat shim.

    Configure via SENTRY_DSN env var. Without DSN, SDK operates in no-op mode.
    """
    _initialized = False

    @classmethod
    def _ensure_init(cls):
        if cls._initialized:
            return
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
        dsn = os.getenv("SENTRY_DSN", "")
        sentry_sdk.init(
            dsn=dsn if dsn else None,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
            environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
            integrations=[LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)],
        )
        cls._initialized = True

    @classmethod
    def track(cls, event: str, data: Dict[str, Any] = None):
        cls._ensure_init()
        import sentry_sdk
        sentry_sdk.add_breadcrumb(
            category="vibeserve",
            message=event,
            level="info",
            data=data or {},
            timestamp=datetime.now(timezone.utc),
        )
        log.info(f"[Sentry] {event}: {json.dumps(data)[:200]}" if data else f"[Sentry] {event}")

    @classmethod
    def capture_error(cls, error: Exception, context: Dict[str, Any] = None):
        cls._ensure_init()
        import sentry_sdk
        sentry_sdk.capture_exception(error)
        if context:
            sentry_sdk.set_context("vibeserve", context)
        log.error(f"[Sentry] Captured error: {error}")

    @classmethod
    def capture_message(cls, message: str, level: str = "info", data: Dict[str, Any] = None):
        cls._ensure_init()
        import sentry_sdk
        sentry_sdk.capture_message(message, level=level)
        log.info(f"[Sentry] {message}")

    @classmethod
    def flush(cls) -> List[Dict[str, Any]]:
        cls._ensure_init()
        import sentry_sdk
        sentry_sdk.flush()
        return []

    @classmethod
    def errors(cls) -> List[Dict[str, Any]]:
        return []

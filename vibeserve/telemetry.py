"""Telemetry: StructuredLogger and SentryTracker for VibeServe."""

from __future__ import annotations
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

log = logging.getLogger("VibeServe")

# ====================== SECRET REDACTION FILTER ======================

class SecretRedactionFilter(logging.Filter):
    """Logging filter that redacts secrets from all log messages and arguments."""

    _PATTERNS = [
        (r'(?i)([a-z_]*)(api_key|secret_key|api_secret|secret_token|access_token)["\']?\s*[:=]\s*["\']?[^\s"\' ,}]+', r'\1\2=***REDACTED***'),
        (r'sk-[a-zA-Z0-9]{20,}', 'sk-***REDACTED***'),
        (r'Bearer [a-zA-Z0-9_\-]{20,}', 'Bearer ***REDACTED***'),
        (r'ghp_[a-zA-Z0-9]{36}', 'ghp_***REDACTED***'),
        (r'AIza[0-9A-Za-z\-_]{35}', 'AIza***REDACTED***'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, replacement in self._PATTERNS:
                record.msg = re.sub(pattern, replacement, record.msg)
        # Also redact args that might contain secrets
        if record.args:
            redacted = []
            for a in record.args:
                if isinstance(a, str):
                    for pattern, replacement in self._PATTERNS:
                        a = re.sub(pattern, replacement, a)
                redacted.append(a)
            record.args = tuple(redacted)
        return True


# Install the redaction filter on the VibeServe logger
log.addFilter(SecretRedactionFilter())

# ====================== STRUCTURED LOGGING ======================
class StructuredLogger:
    _SECRET_PATTERNS = [
        # Generic API keys, tokens, and secrets (covers GEMINI_API_KEY, STRIPE_SECRET_KEY, etc.)
        (r'(?i)([a-z_]*)(api_key|secret_key|api_secret|secret_token|access_token|private_key|auth_token)[a-z_]*["\']?\s*[:=]\s*["\']?[^\s"\' ,}]+', r'\1\2=***REDACTED***'),
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

    @classmethod
    def _trace_id(cls) -> str:
        try:
            from vibeserve.middleware import get_trace_id
            tid = get_trace_id()
            return tid if tid else ""
        except Exception:
            return ""

    @classmethod
    def _base_payload(cls, name: str, **kwargs) -> Dict[str, Any]:
        payload = {"event": name, "timestamp": datetime.now(timezone.utc).isoformat()}
        tid = cls._trace_id()
        if tid:
            payload["trace_id"] = tid
        payload.update(kwargs)
        return payload

    @classmethod
    def event(cls, name: str, **kwargs):
        data = cls._redact(json.dumps(cls._base_payload(name, **kwargs)))
        log.info(f"[Structured] {data}")

    @classmethod
    def error(cls, name: str, error: str = "", **kwargs):
        payload = cls._base_payload(name, error=error, severity="error", **kwargs)
        data = cls._redact(json.dumps(payload))
        log.error(f"[Structured] {data}")

    @classmethod
    def warn(cls, name: str, detail: str = "", **kwargs):
        payload = cls._base_payload(name, detail=detail, severity="warning", **kwargs)
        data = cls._redact(json.dumps(payload))
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
        try:
            import sentry_sdk
            from sentry_sdk.integrations.logging import LoggingIntegration
        except ImportError:
            return
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
        if cls._initialized:
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
        if cls._initialized:
            import sentry_sdk
            sentry_sdk.capture_exception(error)
            if context:
                sentry_sdk.set_context("vibeserve", context)
        log.error(f"[Sentry] Captured error: {error}")

    @classmethod
    def capture_message(cls, message: str, level: str = "info", data: Dict[str, Any] = None):
        cls._ensure_init()
        if cls._initialized:
            import sentry_sdk
            sentry_sdk.capture_message(message, level=level)
        log.info(f"[Sentry] {message}")

    @classmethod
    def flush(cls) -> List[Dict[str, Any]]:
        cls._ensure_init()
        if cls._initialized:
            import sentry_sdk
            sentry_sdk.flush()
        return []

    @classmethod
    def errors(cls) -> List[Dict[str, Any]]:
        return []

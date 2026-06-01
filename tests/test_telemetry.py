"""Tests for vibeserve.telemetry — StructuredLogger and SentryTracker."""

import json
import logging
import os
import builtins
from unittest.mock import patch

from vibeserve.telemetry import StructuredLogger, SentryTracker


class TestStructuredLogger:
    def test_redact_api_key(self):
        msg = "api_key=sk-12345678901234567890123456789012345"
        result = StructuredLogger._redact(msg)
        assert "sk-***REDACTED***" in result
        assert "sk-1234567890" not in result

    def test_redact_bearer_token(self):
        msg = "Authorization: Bearer abcdef1234567890abcdef1234567890abcdef12"
        result = StructuredLogger._redact(msg)
        assert "Bearer ***REDACTED***" in result

    def test_redact_github_pat(self):
        msg = "token=github_pat_abcdef1234567890abcdef1234567890abcdef12345"
        result = StructuredLogger._redact(msg)
        assert "github_pat_***REDACTED***" in result
        assert "github_pat_abcdef" not in result

    def test_event(self, caplog):
        caplog.set_level(logging.INFO)
        StructuredLogger.event("user-login", user_id="42")
        assert "[Structured]" in caplog.text
        assert "user-login" in caplog.text
        assert "user_id" in caplog.text

    def test_error(self, caplog):
        caplog.set_level(logging.INFO)
        StructuredLogger.error("db-failure", error="connection refused")
        record = caplog.records[0]
        assert record.levelname == "ERROR"
        assert "[Structured]" in record.getMessage()
        payload = json.loads(record.getMessage().replace("[Structured] ", ""))
        assert payload["severity"] == "error"
        assert payload["event"] == "db-failure"

    def test_warn(self, caplog):
        caplog.set_level(logging.INFO)
        StructuredLogger.warn("rate-limit", detail="approaching limit")
        record = caplog.records[0]
        assert record.levelname == "WARNING"
        assert "[Structured]" in record.getMessage()
        payload = json.loads(record.getMessage().replace("[Structured] ", ""))
        assert payload["severity"] == "warning"
        assert payload["event"] == "rate-limit"


class TestSentryTracker:
    def setup_method(self):
        SentryTracker._initialized = False

    def test_ensure_init_without_sentry(self):
        real_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name.startswith("sentry_sdk"):
                raise ImportError
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            SentryTracker._ensure_init()
        assert not SentryTracker._initialized

    def test_ensure_init_with_sentry(self):
        with patch("sentry_sdk.init") as mock_init:
            with patch.dict(os.environ, {"SENTRY_DSN": "https://key@sentry.io/123"}):
                SentryTracker._ensure_init()
                assert SentryTracker._initialized
                mock_init.assert_called_once()

    def test_track(self, caplog):
        caplog.set_level(logging.INFO)
        with patch("sentry_sdk.init"):
            with patch("sentry_sdk.add_breadcrumb") as mock_add:
                with patch.dict(os.environ, {"SENTRY_DSN": "https://key@sentry.io/123"}):
                    SentryTracker.track("file-saved", {"path": "/tmp/x.py"})
        assert mock_add.called
        assert "[Sentry] file-saved" in caplog.text

    def test_capture_error(self, caplog):
        caplog.set_level(logging.INFO)
        with patch("sentry_sdk.init"):
            with patch("sentry_sdk.capture_exception") as mock_ce:
                with patch("sentry_sdk.set_context") as mock_sc:
                    with patch.dict(os.environ, {"SENTRY_DSN": "https://key@sentry.io/123"}):
                        error = ValueError("something broke")
                        SentryTracker.capture_error(error, {"module": "test"})
        mock_ce.assert_called_once_with(error)
        mock_sc.assert_called_once_with("vibeserve", {"module": "test"})
        assert "[Sentry] Captured error" in caplog.text

    def test_capture_message(self, caplog):
        caplog.set_level(logging.INFO)
        with patch("sentry_sdk.init"):
            with patch("sentry_sdk.capture_message") as mock_cm:
                with patch.dict(os.environ, {"SENTRY_DSN": "https://key@sentry.io/123"}):
                    SentryTracker.capture_message("all good", level="info")
        mock_cm.assert_called_once_with("all good", level="info")
        assert "[Sentry] all good" in caplog.text

    def test_flush_and_errors_not_initialized(self):
        real_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name.startswith("sentry_sdk"):
                raise ImportError
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            SentryTracker._initialized = False
            assert SentryTracker.flush() == []
            assert SentryTracker.errors() == []

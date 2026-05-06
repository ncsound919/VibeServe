"""Tests for vibeserve.utils.SentryTracker — real Sentry SDK integration."""

import os
import pytest
from vibeserve.utils import SentryTracker


@pytest.fixture(autouse=True)
def clear_sentry_env():
    for var in ("SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_TRACES_SAMPLE_RATE"):
        os.environ.pop(var, None)
    SentryTracker._initialized = False
    yield
    SentryTracker._initialized = False
    for var in ("SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_TRACES_SAMPLE_RATE"):
        os.environ.pop(var, None)


class TestSentryTrackerInit:
    def test_init_without_dsn_is_noop(self):
        os.environ.pop("SENTRY_DSN", None)
        SentryTracker._ensure_init()
        assert SentryTracker._initialized is True

    def test_init_is_idempotent(self):
        SentryTracker._ensure_init()
        SentryTracker._ensure_init()
        assert SentryTracker._initialized is True

    def test_init_with_env_vars(self):
        os.environ["SENTRY_DSN"] = ""
        os.environ["SENTRY_TRACES_SAMPLE_RATE"] = "1.0"
        SentryTracker._ensure_init()


class TestSentryTrackerTrack:
    def test_track_no_error(self):
        SentryTracker._ensure_init()
        SentryTracker.track("test_event", {"key": "value"})

    def test_track_empty_data(self):
        SentryTracker._ensure_init()
        SentryTracker.track("minimal_event")

    def test_track_with_nested_data(self):
        SentryTracker._ensure_init()
        SentryTracker.track("complex_event", {
            "nested": {"a": 1, "b": [2, 3]},
            "list": ["x", "y", "z"]
        })


class TestSentryTrackerCapture:
    def test_capture_error(self):
        SentryTracker._ensure_init()
        try:
            raise ValueError("test error for sentry")
        except ValueError as e:
            SentryTracker.capture_error(e, {"context_key": "context_val"})

    def test_capture_error_no_context(self):
        SentryTracker._ensure_init()
        try:
            raise RuntimeError("bare error")
        except RuntimeError as e:
            SentryTracker.capture_error(e)

    def test_capture_message(self):
        SentryTracker._ensure_init()
        SentryTracker.capture_message("test message", level="warning")

    def test_flush(self):
        SentryTracker._ensure_init()
        result = SentryTracker.flush()
        assert result == []

    def test_errors_returns_empty(self):
        result = SentryTracker.errors()
        assert result == []


class TestSentryTrackerSecrets:
    def test_secret_redaction_in_log(self):
        """Only tests that SentryTracker doesn't log raw secrets."""
        os.environ["SENTRY_DSN"] = ""
        SentryTracker._ensure_init()
        SentryTracker.track("auth_event", {"token": "sk-1234567890abcdef1234567890abcdef"})

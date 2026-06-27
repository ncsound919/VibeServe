"""Correlation / trace ID context variables for VibeServe."""

from __future__ import annotations

import uuid
from contextvars import ContextVar

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

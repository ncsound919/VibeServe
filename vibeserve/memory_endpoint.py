"""Memory HTTP endpoints — Phase 4.

POST /v1/memory/feedback       Record a correction
GET  /v1/memory/corrections    List all corrections
POST /v1/memory/context        Record a session context
GET  /v1/memory/contexts       List recent contexts
GET  /v1/memory/shared         List shared team memory
POST /v1/memory/shared         Set a shared key
GET  /v1/memory/status         Snapshot
"""
from __future__ import annotations

import json
from typing import Any, Dict


async def handle_memory_get(path: str) -> Dict[str, Any]:
    """Return JSON body for GET /v1/memory/* paths."""
    from vibeserve.memory import memory

    if path in ("/v1/memory", "/v1/memory/"):
        return await memory.status()
    if path in ("/v1/memory/corrections", "/v1/memory/corrections/"):
        return {"corrections": await memory.list_corrections()}
    if path in ("/v1/memory/contexts", "/v1/memory/contexts/"):
        await memory._ensure_loaded()
        ctx = list(memory._contexts)
        return {"contexts": ctx}
    if path in ("/v1/memory/shared", "/v1/memory/shared/"):
        return {"shared": await memory.list_shared()}
    return {"status": "error", "error": f"Unknown GET path: {path}"}


async def handle_memory_post(path: str, body: bytes) -> Dict[str, Any]:
    """Return JSON body for POST /v1/memory/* paths."""
    from vibeserve.memory import memory

    try:
        data = json.loads(body.decode() or "{}") if body else {}
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON: {e}"}

    if path in ("/v1/memory/feedback", "/v1/memory/feedback/"):
        pattern = data.get("pattern", "")
        correction = data.get("correction", "")
        context = data.get("context")
        return await memory.record_correction(pattern, correction, context)

    if path in ("/v1/memory/context", "/v1/memory/context/"):
        return await memory.record_context(
            session_id=data.get("session_id", ""),
            task=data.get("task", ""),
            outcome=data.get("outcome", ""),
            files=data.get("files"),
        )

    if path in ("/v1/memory/shared", "/v1/memory/shared/"):
        key = data.get("key", "")
        if not key:
            return {"status": "error", "error": "key is required"}
        return await memory.set_shared(key, data.get("value"))

    return {"status": "error", "error": f"Unknown POST path: {path}"}

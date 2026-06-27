"""Memory layer — auto-learning from corrections, cross-session context,
team-shared memory pool.

All memory is persisted to a JSON file (``VIBESERVE_MEMORY_PATH``, defaults to
``./vibeserve_memory.json``) so it survives server restarts. Thread-safe.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional


_DEFAULT_PATH = Path(os.getenv("VIBESERVE_MEMORY_PATH", "./vibeserve_memory.json"))


class Memory:
    """Persistent memory store for a VibeServe deployment.

    Three kinds of memory:
      - corrections: {pattern, correction, count, last_seen}
      - contexts:    recent session outcomes, indexed by task similarity
      - shared:      team-shared key/value pool
    """

    def __init__(self, path: Optional[Path] = None, max_corrections: int = 500, max_contexts: int = 100) -> None:
        self._path = Path(path) if path else _DEFAULT_PATH
        self._lock = asyncio.Lock()
        self._corrections: Deque[Dict[str, Any]] = deque(maxlen=max_corrections)
        self._contexts: Deque[Dict[str, Any]] = deque(maxlen=max_contexts)
        self._shared: Dict[str, Any] = {}
        self._loaded = False

    # ── Persistence ─────────────────────────────────────────────────────────

    async def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        await self._load()
        self._loaded = True

    async def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(await asyncio.to_thread(self._path.read_text, encoding="utf-8"))
            self._corrections = deque(data.get("corrections", []), maxlen=self._corrections.maxlen)
            self._contexts = deque(data.get("contexts", []), maxlen=self._contexts.maxlen)
            self._shared = dict(data.get("shared", {}))
        except (OSError, json.JSONDecodeError):
            pass

    async def _save(self) -> None:
        try:
            await asyncio.to_thread(self._path.parent.mkdir, parents=True, exist_ok=True)
            await asyncio.to_thread(
                self._path.write_text,
                json.dumps(
                    {
                        "corrections": list(self._corrections),
                        "contexts": list(self._contexts),
                        "shared": self._shared,
                    },
                    indent=2,
                    default=str,
                ),
                encoding="utf-8",
            )
        except OSError:
            pass

    # ── Corrections (4.1) ───────────────────────────────────────────────────

    async def record_correction(self, pattern: str, correction: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Record a user correction. Returns the new entry."""
        if not pattern or not correction:
            return {"status": "error", "error": "pattern and correction are required"}
        await self._ensure_loaded()
        entry = {
            "id": f"cor_{uuid.uuid4().hex[:16]}",
            "pattern": pattern,
            "correction": correction,
            "context": context or "",
            "count": 1,
            "ts": time.time(),
        }
        async with self._lock:
            # Increment count if exact pattern exists
            for existing in self._corrections:
                if existing["pattern"] == pattern and existing["correction"] == correction:
                    existing["count"] += 1
                    existing["ts"] = time.time()
                    entry = existing
                    break
            else:
                self._corrections.append(entry)
            await self._save()
        return {"status": "success", "correction": entry}

    async def find_corrections(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Return corrections whose pattern is a substring of *query*."""
        await self._ensure_loaded()
        async with self._lock:
            q = query.lower()
            matches = [
                c for c in self._corrections
                if c["pattern"].lower() in q or q in c["pattern"].lower()
            ]
        matches.sort(key=lambda c: c.get("count", 1), reverse=True)
        return matches[:limit]

    async def list_corrections(self, limit: int = 100) -> List[Dict[str, Any]]:
        await self._ensure_loaded()
        async with self._lock:
            return list(self._corrections)[-limit:]

    # ── Cross-session context (4.2) ─────────────────────────────────────────

    async def record_context(self, session_id: str, task: str, outcome: str, files: Optional[List[str]] = None) -> Dict[str, Any]:
        """Record a completed session's outcome for future context lookups."""
        await self._ensure_loaded()
        entry = {
            "id": f"ctx_{uuid.uuid4().hex[:16]}",
            "session_id": session_id,
            "task": task,
            "outcome": outcome,
            "files": list(files or []),
            "ts": time.time(),
        }
        async with self._lock:
            self._contexts.append(entry)
            await self._save()
        return {"status": "success", "context": entry}

    async def find_similar_context(self, task: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Return recent contexts whose task shares a keyword with *task*."""
        await self._ensure_loaded()
        async with self._lock:
            t = task.lower()
            keywords = {w for w in t.split() if len(w) > 3}
            scored: List[tuple] = []
            for c in self._contexts:
                ctext = c.get("task", "").lower()
                hits = sum(1 for k in keywords if k in ctext)
                if hits:
                    scored.append((hits, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:limit]]

    # ── Shared team memory (4.3) ────────────────────────────────────────────

    async def set_shared(self, key: str, value: Any) -> Dict[str, Any]:
        await self._ensure_loaded()
        async with self._lock:
            self._shared[key] = value
            await self._save()
        return {"status": "success", "key": key}

    async def get_shared(self, key: str) -> Optional[Any]:
        await self._ensure_loaded()
        async with self._lock:
            return self._shared.get(key)

    async def list_shared(self) -> Dict[str, Any]:
        await self._ensure_loaded()
        async with self._lock:
            return dict(self._shared)

    # ── Snapshot ────────────────────────────────────────────────────────────

    async def status(self) -> Dict[str, Any]:
        await self._ensure_loaded()
        async with self._lock:
            return {
                "corrections_count": len(self._corrections),
                "contexts_count": len(self._contexts),
                "shared_keys": len(self._shared),
                "persisted_to": str(self._path),
            }


# Global singleton
memory = Memory()

"""Workspace-scoped memory store for Mutly integration."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

from vibeserve.tools.config import CONFIG

log = logging.getLogger("VibeServe")

DEFAULT_TTL_SECONDS = 7 * 24 * 3600  # 7 days
CONTEXT_TYPES = ("plan", "schema", "errors", "design", "approval", "workflow", "spec")


class WorkspaceMemoryStore:
    """SQLite-backed memory keyed by workspace_id + context_type."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or (CONFIG.memory_db.parent / "mutly_workspace_memory.db")
        self._initialized = False
        self._lock = asyncio.Lock()

    async def _ensure_init(self) -> None:
        if self._initialized:
            return
        async with self._lock:
            if self._initialized:
                return
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            async with aiosqlite.connect(str(self.db_path)) as conn:
                await conn.execute("PRAGMA busy_timeout=5000")
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS workspace_memory (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        workspace_id TEXT NOT NULL,
                        context_type TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        trace_id TEXT,
                        created_at TEXT NOT NULL,
                        expires_at REAL NOT NULL
                    )
                    """
                )
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ws_ctx ON workspace_memory(workspace_id, context_type)"
                )
                await conn.commit()
            self._initialized = True

    async def _purge_expired(self, conn: aiosqlite.Connection) -> None:
        now = time.time()
        await conn.execute("DELETE FROM workspace_memory WHERE expires_at < ?", (now,))

    async def get(
        self,
        workspace_id: str,
        context_types: Optional[List[str]] = None,
        limit: int = 20,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        await self._ensure_init()
        types = list(context_types or CONTEXT_TYPES)
        async with self._lock:
            async with aiosqlite.connect(str(self.db_path)) as conn:
                conn.row_factory = aiosqlite.Row
                await self._purge_expired(conn)
                placeholders = ",".join("?" for _ in types)
                query = f"""
                    SELECT context_type, payload_json, created_at, trace_id
                    FROM workspace_memory
                    WHERE workspace_id = ? AND context_type IN ({placeholders})
                    ORDER BY id DESC
                    LIMIT ?
                """
                params: List[Any] = [workspace_id, *types, limit]
                async with conn.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
        entries = []
        for row in rows:
            try:
                payload = json.loads(row["payload_json"])
            except json.JSONDecodeError:
                payload = {"raw": row["payload_json"]}
            entries.append(
                {
                    "contextType": row["context_type"],
                    "payload": payload,
                    "createdAt": row["created_at"],
                    "traceId": row["trace_id"],
                }
            )
        return {
            "status": "success",
            "workspaceId": workspace_id,
            "traceId": trace_id,
            "entries": entries,
        }

    async def store(
        self,
        workspace_id: str,
        context_type: str,
        payload: Dict[str, Any],
        trace_id: Optional[str] = None,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> Dict[str, Any]:
        await self._ensure_init()
        payload_str = json.dumps(payload)
        max_payload = int(os.getenv("VIBESERVE_MAX_PAYLOAD_BYTES", "262144"))
        if len(payload_str) > max_payload:
            return {"status": "error", "error": f"Payload exceeds {max_payload} bytes"}
        if context_type not in CONTEXT_TYPES:
            context_type = "workflow"
        created = datetime.now(timezone.utc).isoformat()
        expires = time.time() + max(60, ttl_seconds)
        async with self._lock:
            async with aiosqlite.connect(str(self.db_path)) as conn:
                await self._purge_expired(conn)
                await conn.execute(
                    """
                    INSERT INTO workspace_memory
                    (workspace_id, context_type, payload_json, trace_id, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        workspace_id,
                        context_type,
                        json.dumps(payload),
                        trace_id,
                        created,
                        expires,
                    ),
                )
                await conn.commit()
        return {
            "status": "success",
            "workspaceId": workspace_id,
            "contextType": context_type,
            "traceId": trace_id,
            "storedAt": created,
        }


workspace_memory = WorkspaceMemoryStore()

"""Memory store for learned UI specifications with atomic eviction and versioned migrations."""
from __future__ import annotations
import aiosqlite
import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from vibeserve.tools.config import CONFIG
from vibeserve.tools.migrations import apply_pending

log = logging.getLogger("VibeServe")


class MemoryStore:
    MAX_STORED_SPECS = 500

    def __init__(self, db_path: Path = CONFIG.memory_db):
        self.db_path = db_path
        self._initialized = False
        self._lock = asyncio.Lock()

    async def _ensure_init(self):
        if self._initialized:
            return
        async with self._lock:
            if self._initialized:
                return
            applied = await apply_pending(self.db_path)
            if applied:
                log.info(f"Applied {applied} database migration(s)")
            self._initialized = True

    async def store(self, page_type: str, spec: Dict[str, Any], score: float):
        if score < CONFIG.min_score_to_store:
            return
        await self._ensure_init()
        spec_id = spec.get("metadata", {}).get("id", hashlib.sha256(
            f"{page_type}{time.time()}".encode()
        ).hexdigest()[:20])
        timestamp = datetime.now(timezone.utc).isoformat()
        # Serialize all writes through _lock to prevent SQLite write contention
        async with self._lock:
            async with aiosqlite.connect(str(self.db_path)) as conn:
                await conn.execute("PRAGMA busy_timeout=5000")
                await conn.execute("BEGIN")
                count = (await (await conn.execute("SELECT COUNT(*) FROM specs")).fetchone())[0]
                if count >= self.MAX_STORED_SPECS:
                    cutoff = count - self.MAX_STORED_SPECS + 1
                    await conn.execute(
                        "DELETE FROM specs WHERE id IN (SELECT id FROM specs ORDER BY score ASC, timestamp ASC LIMIT ?)",
                        (cutoff,)
                    )
                    log.info(f"Evicted {cutoff} lowest-scoring specs to stay under {self.MAX_STORED_SPECS} limit")
                await conn.execute(
                    "INSERT OR REPLACE INTO specs (id, page_type, score, timestamp, spec_json) VALUES (?, ?, ?, ?, ?)",
                    (spec_id, page_type, score, timestamp, json.dumps(spec))
                )
                await conn.commit()
        log.info(f"Stored spec {spec_id[:8]} for {page_type} (score: {score:.2f})")

    async def get(self, page_type: str, limit: int = 3) -> List[Dict[str, Any]]:
        await self._ensure_init()
        async with aiosqlite.connect(str(self.db_path)) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(
                "SELECT spec_json, score FROM specs WHERE page_type = ? ORDER BY score DESC LIMIT ?",
                (page_type, limit)
            ) as cursor:
                rows = await cursor.fetchall()
        return [{"score": row["score"], "spec": json.loads(row["spec_json"])} for row in rows]

    async def stats(self) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "total_stored_specs": 0, "by_page_type": {},
            "memory_usage_mb": 0, "oldest_spec": None, "highest_score": 0
        }
        await self._ensure_init()
        async with aiosqlite.connect(str(self.db_path)) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute(
                "SELECT page_type, COUNT(*) as cnt, MAX(score) as max_score, MIN(timestamp) as oldest "
                "FROM specs GROUP BY page_type"
            ) as cursor:
                rows = await cursor.fetchall()
        for row in rows:
            stats["by_page_type"][row["page_type"]] = {
                "count": row["cnt"], "highest_score": row["max_score"], "oldest": row["oldest"]
            }
            stats["total_stored_specs"] += row["cnt"]
            stats["highest_score"] = max(stats["highest_score"], row["max_score"])
        if self.db_path.exists():
            stats["memory_usage_mb"] = self.db_path.stat().st_size / (1024 * 1024)
        return stats


memory_store = MemoryStore()


async def store_successful_spec(page_type: str, spec: Dict[str, Any], score: float):
    await memory_store.store(page_type, spec, score)


async def get_similar_specs(page_type: str, limit: int = 3) -> List[Dict[str, Any]]:
    return await memory_store.get(page_type, limit)

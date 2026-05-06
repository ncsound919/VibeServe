"""
SQLite migration manager.

Key design decisions:
- schema_version table is bootstrapped before migrations run (not a migration itself)
- Uses individual conn.execute() calls (never executescript) for proper transaction control
- Each migration runs in its own BEGIN/COMMIT; on failure, ROLLBACK is safe because
  no implicit commit has occurred
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

import aiosqlite

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Migration registry
# ---------------------------------------------------------------------------

class Migration(NamedTuple):
    version: int
    description: str
    sql: str          # may contain multiple semicolon-separated statements


MIGRATIONS: list[Migration] = [
    Migration(
        version=1,
        description="Create specs table",
        sql="""
        CREATE TABLE IF NOT EXISTS specs (
            id TEXT PRIMARY KEY,
            page_type TEXT NOT NULL,
            score REAL NOT NULL DEFAULT 0.0,
            timestamp TEXT NOT NULL,
            spec_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_page_type ON specs(page_type);
        CREATE INDEX IF NOT EXISTS idx_score ON specs(score DESC)
        """,
    ),
    Migration(
        version=2,
        description="Add audit_log table for tool invocation tracking",
        sql="""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trace_id TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            caller_identity TEXT NOT NULL DEFAULT 'unknown',
            input_hash TEXT NOT NULL DEFAULT '',
            outcome TEXT NOT NULL DEFAULT 'started',
            duration_ms REAL NOT NULL DEFAULT 0.0,
            error TEXT NOT NULL DEFAULT '',
            timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_log(trace_id);
        CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_log(tool_name);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)
        """,
    ),
]

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_BOOTSTRAP_SQL = """
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT    NOT NULL,
    description TEXT    NOT NULL
)
"""


def _split_statements(sql: str) -> list[str]:
    """Split a semicolon-delimited SQL string into individual non-empty statements."""
    return [s.strip() for s in sql.split(";") if s.strip()]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def get_current_version(db_path: Path) -> int:
    """Return the highest applied migration version, or 0 if none."""
    async with aiosqlite.connect(str(db_path)) as conn:
        try:
            async with conn.execute(
                "SELECT MAX(version) FROM schema_version"
            ) as cursor:
                row = await cursor.fetchone()
            return row[0] if row and row[0] is not None else 0
        except Exception:
            return 0


async def _bootstrap(conn: aiosqlite.Connection) -> None:
    """Ensure WAL mode, busy timeout, and schema_version table exist (idempotent)."""
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA busy_timeout=5000")
    await conn.execute(_BOOTSTRAP_SQL)
    await conn.commit()


async def apply_pending(db_path: Path) -> int:
    """
    Apply all migrations not yet recorded in schema_version.

    Returns the count of migrations applied in this call.
    Raises on the first migration failure — already-applied migrations are safe.
    """
    current = await get_current_version(db_path)
    pending = [m for m in MIGRATIONS if m.version > current]

    if not pending:
        log.debug("No pending migrations.")
        return 0

    applied = 0

    for migration in pending:
        async with aiosqlite.connect(str(db_path)) as conn:
            # Bootstrap schema_version first — safe to call every time (IF NOT EXISTS).
            await _bootstrap(conn)

            statements = _split_statements(migration.sql)
            await conn.execute("BEGIN")
            try:
                for stmt in statements:
                    await conn.execute(stmt)

                await conn.execute(
                    """
                    INSERT OR REPLACE INTO schema_version (version, applied_at, description)
                    VALUES (?, ?, ?)
                    """,
                    (
                        migration.version,
                        datetime.now(timezone.utc).isoformat(),
                        migration.description,
                    ),
                )
                await conn.commit()
                applied += 1
                log.info(
                    "Migration v%d applied: %s", migration.version, migration.description
                )

            except Exception as exc:
                # Safe to ROLLBACK here because we used explicit BEGIN,
                # never executescript, so no implicit commit has occurred.
                try:
                    await conn.execute("ROLLBACK")
                except Exception:
                    pass  # connection may already be in error state — swallow
                log.error(
                    "Migration v%d failed (%s): %s",
                    migration.version,
                    migration.description,
                    exc,
                )
                raise

    return applied

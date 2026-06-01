import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from pathlib import Path

from vibeserve.tools.memory import MemoryStore, store_successful_spec, get_similar_specs


class MockRow(dict):
    pass


class ExecContext:
    def __init__(self, cursor):
        self._cursor = cursor

    def __await__(self):
        async def _inner():
            return self._cursor
        return _inner().__await__()

    async def __aenter__(self):
        return self._cursor

    async def __aexit__(self, *args):
        pass


@pytest.fixture
def mock_all():
    mock_conn = MagicMock()
    mock_cursor = AsyncMock()
    mock_cursor.fetchone.return_value = None
    mock_cursor.fetchall.return_value = []
    mock_conn.__aenter__.return_value = mock_conn
    mock_conn.__aexit__.return_value = None
    mock_conn.execute.return_value = ExecContext(mock_cursor)
    mock_conn.commit = AsyncMock()
    with patch("vibeserve.tools.memory.aiosqlite") as mock_aiosqlite:
        mock_aiosqlite.connect.return_value = mock_conn
        with patch("vibeserve.tools.memory.apply_pending", AsyncMock(return_value=0)) as mock_migrate:
            yield mock_aiosqlite, mock_conn, mock_cursor, mock_migrate


@pytest.fixture
def store(mock_all):
    s = MemoryStore(db_path=Path(":memory:"))
    yield s


class TestMemoryStoreInit:
    async def test_ensure_init_creates_tables(self, store, mock_all):
        _, mock_conn, mock_cursor, mock_migrate = mock_all
        assert store._initialized is False
        await store._ensure_init()
        assert store._initialized is True
        mock_migrate.assert_called_once()

    async def test_ensure_init_idempotent(self, store, mock_all):
        _, mock_conn, mock_cursor, mock_migrate = mock_all
        await store._ensure_init()
        await store._ensure_init()
        assert store._initialized is True
        mock_migrate.assert_called_once()


class TestMemoryStoreStore:
    async def test_store_inserts(self, store, mock_all):
        _, mock_conn, mock_cursor, _ = mock_all
        mock_cursor.fetchone.return_value = (0,)
        spec = {"metadata": {"id": "abc123"}, "html": "<div/>"}
        await store.store("dashboard", spec, 0.95)
        calls = mock_conn.execute.call_args_list
        insert_calls = [c for c in calls if "INSERT" in str(c[0][0])]
        assert len(insert_calls) == 1

    async def test_store_skips_low_score(self, store, mock_all):
        _, mock_conn, _, _ = mock_all
        await store.store("dashboard", {"metadata": {"id": "abc123"}}, 0.5)
        assert mock_conn.execute.call_count == 0

    async def test_store_evicts_when_full(self, store, mock_all):
        _, mock_conn, mock_cursor, _ = mock_all
        mock_cursor.fetchone.return_value = (store.MAX_STORED_SPECS,)
        await store.store("dashboard", {"metadata": {"id": "abc123"}}, 0.95)
        calls = mock_conn.execute.call_args_list
        delete_calls = [c for c in calls if "DELETE" in str(c[0][0])]
        assert len(delete_calls) == 1


class TestMemoryStoreGet:
    async def test_get_returns_results(self, store, mock_all):
        _, mock_conn, mock_cursor, _ = mock_all
        row_data = {"score": 0.95, "spec_json": json.dumps({"html": "<div>hello</div>"})}
        mock_cursor.fetchall.return_value = [MockRow(row_data)]
        results = await store.get("dashboard", limit=3)
        assert len(results) == 1
        assert results[0]["score"] == 0.95
        assert results[0]["spec"]["html"] == "<div>hello</div>"

    async def test_get_returns_empty(self, store, mock_all):
        _, mock_conn, mock_cursor, _ = mock_all
        mock_cursor.fetchall.return_value = []
        results = await store.get("dashboard")
        assert results == []


class TestMemoryStoreStats:
    async def test_stats_returns_counts(self, store, mock_all):
        _, mock_conn, mock_cursor, _ = mock_all
        row_data = {"page_type": "dashboard", "cnt": 3, "max_score": 0.95, "oldest": "2024-01-01"}
        mock_cursor.fetchall.return_value = [MockRow(row_data)]
        stats = await store.stats()
        assert stats["total_stored_specs"] == 3
        assert stats["by_page_type"]["dashboard"]["count"] == 3
        assert stats["highest_score"] == 0.95


class TestMemoryStoreModuleFunctions:
    async def test_store_successful_spec(self):
        with patch("vibeserve.tools.memory.memory_store") as mock_store:
            mock_store.store = AsyncMock()
            await store_successful_spec("page", {"html": "hi"}, 0.9)
            mock_store.store.assert_called_once_with("page", {"html": "hi"}, 0.9)

    async def test_get_similar_specs(self):
        with patch("vibeserve.tools.memory.memory_store") as mock_store:
            mock_store.get = AsyncMock(return_value=[{"score": 0.9, "spec": {"html": "hi"}}])
            results = await get_similar_specs("page", limit=2)
            assert len(results) == 1
            mock_store.get.assert_called_once_with("page", 2)

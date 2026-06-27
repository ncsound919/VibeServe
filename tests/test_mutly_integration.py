"""Tests for Mutly vs_* tools and HTTP bridge."""

import json
import pytest

from vibeserve.tools.mutly_workspace_memory import WorkspaceMemoryStore
from vibeserve.http_bridge import handle_http_request


@pytest.fixture
def memory_store(tmp_path):
    db = tmp_path / "test_mutly_memory.db"
    return WorkspaceMemoryStore(db_path=db)


@pytest.mark.asyncio
async def test_memory_store_and_get(memory_store):
    await memory_store.store(
        "ws-1",
        "plan",
        {"stepId": "1", "outcome": "ok"},
        trace_id="trace-abc",
    )
    result = await memory_store.get("ws-1", ["plan"], limit=5, trace_id="trace-abc")
    assert result["status"] == "success"
    assert len(result["entries"]) == 1
    assert result["entries"][0]["payload"]["stepId"] == "1"


@pytest.mark.asyncio
async def test_http_health():
    status, _, body = await handle_http_request("GET", "/health", {}, b"")
    assert status == 200
    data = json.loads(body)
    assert data["status"] == "ok"
    assert "authRequired" in data


@pytest.mark.asyncio
async def test_http_plan_review(monkeypatch):
    monkeypatch.setenv("VIBESERVE_REQUIRE_AUTH", "false")
    monkeypatch.delenv("VIBESERVE_MUTLY_API_KEY", raising=False)
    monkeypatch.delenv("VIBESERVE_API_KEY", raising=False)
    monkeypatch.setattr("vibeserve.http_bridge._authorize", lambda h: None)
    status, _, body = await handle_http_request(
        "POST",
        "/tools/vs_plan_review",
        {"content-type": "application/json"},
        json.dumps(
            {
                "_auth_token": "pytest-token",
                "plan": json.dumps(
                    {
                        "tree": [
                            {"id": 1, "step": "edit files", "risk": "High"},
                            {"id": 2, "step": "deploy", "risk": "High"},
                        ]
                    }
                )
            }
        ).encode(),
    )
    assert status == 200
    data = json.loads(body)
    assert data["status"] == "success"
    assert data["stepCount"] == 2
    assert len(data.get("recommendations", [])) >= 1

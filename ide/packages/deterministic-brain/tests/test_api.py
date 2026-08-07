import os
import sys

os.environ.setdefault("BRAIN_WIKI_DIR", str(__import__("tempfile").mkdtemp()))
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # requires: pip install httpx

from api.app import app


def test_health():
    with TestClient(app) as c:
        r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_lanes():
    with TestClient(app) as c:
        r = c.get("/api/brain/lanes")
    assert r.status_code == 200
    assert set(r.json()["lanes"]) == {
        "coding", "business_logic", "agent_brain", "tool_calling", "cross_domain",
    }


def test_query_endpoint():
    with TestClient(app) as c:
        r = c.post("/api/brain/query", json={"query": "analyze mission", "lane": "business_logic", "verbose": True})
    assert r.status_code == 200
    body = r.json()
    assert body["lane"] == "business_logic"
    assert "BUSINESS LOGIC" in body["response"]


def test_wiki_search_endpoint():
    with TestClient(app) as c:
        r = c.get("/api/wiki/search", params={"q": "mission"})
    assert r.status_code == 200
    assert isinstance(r.json()["results"], list)

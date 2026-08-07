import os
import sys
import tempfile
from pathlib import Path

os.environ["BRAIN_WIKI_DIR"] = tempfile.mkdtemp()
WIKI_DIR = Path(os.environ["BRAIN_WIKI_DIR"])
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402  # requires: pip install httpx

from api.app import app  # noqa: E402


def _write_page(slug: str, title: str, namespace: str = "business") -> Path:
    path = WIKI_DIR / f"{slug}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\ntitle: {title}\ntags: [test]\nnamespace: {namespace}\n---\n\n{title} content.\n",
        encoding="utf-8",
    )
    return path


_write_page("business/test", "Test Page")


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
        "coding",
        "business_logic",
        "agent_brain",
        "tool_calling",
        "cross_domain",
    }


def test_query_endpoint():
    with TestClient(app) as c:
        r = c.post(
            "/api/brain/query",
            json={"query": "analyze mission", "lane": "business_logic", "verbose": True},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["lane"] == "business_logic"
    assert "BUSINESS LOGIC" in body["response"]


def test_query_unknown_lane_returns_400():
    with TestClient(app) as c:
        r = c.post("/api/brain/query", json={"query": "hello", "lane": "bogus"})
    assert r.status_code == 400


def test_wiki_search_endpoint():
    with TestClient(app) as c:
        r = c.get("/api/wiki/search", params={"q": "mission"})
    assert r.status_code == 200
    assert isinstance(r.json()["results"], list)


def test_wiki_page_endpoint():
    with TestClient(app) as c:
        r = c.get("/api/wiki/page", params={"slug": "business/test"})
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "business/test"
    assert body["title"] == "Test Page"


def test_wiki_page_not_found():
    with TestClient(app) as c:
        r = c.get("/api/wiki/page", params={"slug": "nope"})
    assert r.status_code == 404


def test_config_endpoint_round_trip():
    with TestClient(app) as c:
        r = c.post("/config", json={"router_model": "x"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["config"]["router_model"] == "x"


def test_reload_endpoint():
    with TestClient(app) as c:
        before = c.get("/health").json()["wiki_pages"]
        _write_page("business/reload", "Reloaded Page")
        r = c.post("/reload")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["wiki_pages"] == before + 1

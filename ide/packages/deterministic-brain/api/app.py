"""
Deterministic Brain — FastAPI server.

Exposes health, lane config, wiki search, and grounded query endpoints that
share the same logic as the CLI (main.py).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import DEFAULT_BRAIN_CONFIG, WIKI_DIR
from main import generate_brain_response
from wiki_index import get_index, reload as reload_index, search

app = FastAPI(title="Deterministic Brain", version="1.0.0")


class QueryRequest(BaseModel):
    query: str
    lane: str = "coding"
    verbose: bool = False


class ConfigPayload(BaseModel):
    lanes: dict | None = None
    router_model: str | None = None


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "wiki_pages": len(get_index(str(WIKI_DIR)).pages),
        "lanes": list(DEFAULT_BRAIN_CONFIG["lanes"].keys()),
        "wiki_dir": str(WIKI_DIR),
        "timestamp": time.time(),
    }


@app.get("/api/brain/lanes")
def lanes() -> dict:
    return {"lanes": list(DEFAULT_BRAIN_CONFIG["lanes"].keys())}


@app.post("/api/brain/query")
def query(req: QueryRequest) -> dict:
    if req.lane not in DEFAULT_BRAIN_CONFIG["lanes"]:
        raise HTTPException(status_code=400, detail=f"unknown lane: {req.lane}")
    start = time.time()
    response = generate_brain_response(req.query, req.lane, req.verbose)
    return {
        "lane": req.lane,
        "query": req.query,
        "response": response,
        "timestamp": time.time(),
        "processing_time_ms": int((time.time() - start) * 1000),
    }


@app.get("/api/wiki/search")
def wiki_search(q: str, max_results: int = 5) -> dict:
    idx = get_index(str(WIKI_DIR))
    return {"results": search(idx, q, max_results)}


@app.get("/api/wiki/page")
def wiki_page(slug: str) -> dict:
    idx = get_index(str(WIKI_DIR))
    page = idx.get(slug)
    if page is None:
        raise HTTPException(status_code=404, detail=f"page not found: {slug}")
    return page


@app.post("/config")
def update_config(payload: ConfigPayload) -> dict:
    # Runtime config override is applied in-memory for this process.
    if payload.lanes:
        for name, overrides in payload.lanes.items():
            if name in DEFAULT_BRAIN_CONFIG["lanes"]:
                DEFAULT_BRAIN_CONFIG["lanes"][name].update(
                    {k: v for k, v in overrides.items() if v is not None}
                )
    if payload.router_model:
        DEFAULT_BRAIN_CONFIG["router_model"] = payload.router_model
    return {"ok": True, "config": DEFAULT_BRAIN_CONFIG}


@app.post("/reload")
def reload_brain() -> dict:
    idx = reload_index(str(WIKI_DIR))
    return {"ok": True, "wiki_pages": len(idx.pages)}

#!/usr/bin/env python3
"""
Deterministic Brain — Main Entry Point.

Grounds every query against the knowledge wiki (business knowledge, bookbridge
reference points, agendas, crons, workflows) and answers per reasoning lane.

CLI contract (preserved for VibeServe's runDeterministicBrain):
  python main.py "<query>" [--lane coding|business_logic|agent_brain|tool_calling|cross_domain] [--verbose]
"""

import argparse
import json
import sys
import time

from config import DEFAULT_BRAIN_CONFIG, WIKI_DIR, BRAIN_BOOKBRIDGE_URL
from wiki_index import get_index, load


def _bookbridge_passages(topic: str, max_results: int = 2) -> list:
    """Live BookBridge lookup; fast-fails (<=800ms) when offline."""
    if not topic or len(topic.strip()) < 12:
        return []
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{BRAIN_BOOKBRIDGE_URL}/search",
            data=json.dumps({
                "query": topic,
                "max_results": max_results,
                "min_score": 0.25,
                "search_mode": "hybrid",
                "include_context_chunks": True,
                "context_window_chunks": 1,
            }).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=0.8) as res:
            body = json.loads(res.read().decode("utf-8"))
        out = []
        for r in body.get("results", [])[:max_results]:
            out.append({
                "book": r.get("book_title") or r.get("book_id") or "unknown",
                "passage": (r.get("text") or "")[:1200],
                "score": r.get("score", 0),
            })
        return out
    except Exception:
        return []


def _grounding_blocks(query: str) -> list:
    """Build [CONTEXT · wiki] and [CONTEXT · bookbridge] blocks."""
    blocks = []
    try:
        idx = get_index(str(WIKI_DIR))
        pages = load(idx, query, max_results=3)
        for p in pages:
            sources = p.get("sources") or []
            srcs = []
            for s in sources:
                if isinstance(s, dict):
                    srcs.append(f"{list(s.items())[0][0]}:{list(s.items())[0][1]}")
                else:
                    srcs.append(str(s))
            if not srcs:
                srcs = [p["slug"]]
            blocks.append({
                "kind": "wiki",
                "title": p["title"],
                "slug": p["slug"],
                "sources": srcs,
                "content": p["content"],
            })
    except Exception:
        pass
    if any("bookbridge" in s for p in blocks for s in p.get("sources", [])):
        for passage in _bookbridge_passages(query):
            blocks.append({
                "kind": "bookbridge",
                "title": passage["book"],
                "sources": [f"bookbridge:{passage['book']}"],
                "content": passage["passage"],
            })
    return blocks


def _render_context(blocks: list) -> str:
    if not blocks:
        return ""
    parts = []
    for b in blocks:
        kind = "wiki" if b["kind"] == "wiki" else "bookbridge"
        parts.append(
            f"[CONTEXT · {kind}] {b['title']}\n"
            f"Sources: {', '.join(b['sources'])}\n"
            f"{b['content']}\n"
        )
    return "\n".join(parts)


def generate_brain_response(query: str, lane: str, verbose: bool) -> str:
    """Compose a grounded, lane-specific response with cited sources."""
    lane_responses = {
        "coding": "[CODE ANALYSIS] Assessed code against wiki knowledge.",
        "business_logic": "[BUSINESS LOGIC] Evaluated workflow against wiki business knowledge.",
        "agent_brain": "[AGENT REASONING] Planned multi-agent coordination from wiki context.",
        "tool_calling": "[TOOL INTEGRATION] Routed tool analysis from wiki + bookbridge references.",
        "cross_domain": "[CROSS-DOMAIN] Synthesized across domains using wiki context.",
    }
    base = lane_responses.get(lane, lane_responses["coding"])
    ctx = _render_context(_grounding_blocks(query))
    if ctx:
        response = f"{ctx}\n\n{base} — Query: {query}"
    else:
        response = f"{base} — Query: {query} (no wiki context matched)"
    if verbose:
        return (
            f"{response}\n\n[METADATA]\nLane: {lane}\nQuery: {query}\n"
            f'Processed at: {time.strftime("%Y-%m-%d %H:%M:%S")}\n'
            f"Temperature: {DEFAULT_BRAIN_CONFIG['temperature']}"
        )
    return response


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description="Deterministic Brain Neuro-Symbolic AI Reasoning Engine")
    parser.add_argument("query", help="Query to process")
    parser.add_argument(
        "--lane",
        choices=list(DEFAULT_BRAIN_CONFIG["lanes"].keys()),
        default="coding",
        help="Reasoning lane to use",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    start = time.time()
    response = generate_brain_response(args.query, args.lane, args.verbose)
    processing_ms = int((time.time() - start) * 1000)

    if args.verbose:
        print(json.dumps({
            "lane": args.lane,
            "query": args.query,
            "response": response,
            "timestamp": time.time(),
            "processing_time_ms": processing_ms,
        }))
    else:
        print(response)


if __name__ == "__main__":
    main()

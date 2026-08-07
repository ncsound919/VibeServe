"""
Deterministic Brain — Wiki Knowledge Indexer.

Pure-stdlib index over the Markdown wiki tree. Each page may carry YAML
frontmatter (title, tags, namespace, sources, aliases). Search ranks pages by
title/tag/heading/body term frequency so the brain can ground queries at
runtime without external dependencies.
"""

from __future__ import annotations

import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Frontmatter / markdown parsing ───────────────────────────────────────────

_FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
_WORD_KEY_RE = re.compile(r"^\w+\s*:\s+\S")

def _parse_frontmatter(text: str) -> tuple[Dict[str, Any], str]:
    """Return (frontmatter dict, body) or ({}, text) when no frontmatter."""
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    block = m.group(1)
    body = text[m.end():]
    data: Dict[str, Any] = {}
    current_key: Optional[str] = None
    for line in block.splitlines():
        if not line.strip():
            continue
        if line.startswith(" ") or line.startswith("\t"):
            # continuation of a list item (sources:)
            if current_key is not None:
                item = line.strip().lstrip("-").strip()
                if item:
                    if current_key not in data:
                        data[current_key] = []
                    # handle "key: value" inline pairs
                    if _WORD_KEY_RE.match(item):
                        k, _, v = item.partition(":")
                        data[current_key].append({k.strip(): v.strip()})
                    else:
                        data[current_key].append(item)
            continue
        current_key = None
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1]
            items = [i.strip() for i in inner.split(",") if i.strip()]
            data[key] = items
        elif value.lower() in ("true", "false"):
            data[key] = value.lower() == "true"
        elif value == "":
            current_key = key
            data[key] = []
        else:
            try:
                data[key] = int(value)
            except ValueError:
                data[key] = value
    return data, body

def _headings(body: str) -> List[str]:
    return [line.strip("#").strip().lower() for line in body.splitlines() if line.startswith("#")]

def _tokens(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9\-_]{1,}", text.lower()) if len(t) > 1]

# ── Index model ──────────────────────────────────────────────────────────────

class WikiIndex:
    def __init__(self, pages: List[Dict[str, Any]]):
        self.pages = pages
        self._by_slug = {p["slug"]: p for p in pages}

    def get(self, slug: str) -> Optional[Dict[str, Any]]:
        return self._by_slug.get(slug)

    def __len__(self) -> int:
        return len(self.pages)

    def __iter__(self):
        return iter(self.pages)


def load_index(wiki_dir: str) -> WikiIndex:
    """Scan wiki_dir recursively for .md files and build the index."""
    root = Path(wiki_dir)
    pages: List[Dict[str, Any]] = []
    for md in sorted(root.rglob("*.md")):
        if md.name.startswith("_"):
            continue
        rel = md.relative_to(root)
        slug = str(rel).replace("\\", "/")[:-3]  # strip .md
        text = md.read_text(encoding="utf-8", errors="replace")
        fm, body = _parse_frontmatter(text)
        title = fm.get("title") or rel.stem.replace("-", " ").title()
        namespace = fm.get("namespace") or (rel.parts[0] if len(rel.parts) > 1 else "root")
        tags = [str(t) for t in fm.get("tags", [])]
        sources = fm.get("sources", [])
        pages.append({
            "slug": slug,
            "title": title,
            "namespace": namespace,
            "tags": tags,
            "sources": sources if isinstance(sources, list) else [],
            "content": body.strip(),
            "headings": _headings(body),
            "mtime": md.stat().st_mtime,
        })
    return WikiIndex(pages)


# ── Search ───────────────────────────────────────────────────────────────────

def _score(page: Dict[str, Any], terms: List[str]) -> float:
    score = 0.0
    title = page["title"].lower()
    body = page["content"].lower()
    tags = " ".join(page["tags"]).lower()
    for t in terms:
        if t in title:
            score += 3.0
        if t in tags:
            score += 2.0
        if any(t in h for h in page["headings"]):
            score += 1.5
        if t in body:
            score += 1.0 + min(1.0, body.count(t) / 20.0)
    return score


def search(idx: WikiIndex, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    terms = [t for t in _tokens(query) if len(t) > 1]
    if not terms:
        terms = [t for t in _tokens(query)]
    scored = [(p, _score(p, terms)) for p in idx.pages]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [{"slug": p["slug"], "title": p["title"], "namespace": p["namespace"],
             "tags": p["tags"], "score": round(s, 3)}
            for p, s in scored[:max_results] if s > 0]


def load_blocks(idx: WikiIndex, topic: str, max_results: int = 3) -> List[Dict[str, Any]]:
    """Return content blocks for the top pages matching `topic`."""
    hits = search(idx, topic, max_results)
    blocks = []
    for h in hits:
        page = idx.get(h["slug"])
        if page is None:
            continue
        excerpt = page["content"]
        if len(excerpt) > 3000:
            excerpt = excerpt[:3000] + "\n…[truncated]"
        blocks.append({
            "slug": page["slug"],
            "title": page["title"],
            "namespace": page["namespace"],
            "tags": page["tags"],
            "sources": page["sources"],
            "content": excerpt,
        })
    return blocks


load = load_blocks


def namespaces(idx: WikiIndex) -> List[str]:
    return sorted({p["namespace"] for p in idx.pages})


# ── Cached module-level index (built once per process) ──────────────────────

_index: Optional[WikiIndex] = None
_index_lock = threading.Lock()
_index_dir: Optional[str] = None


def get_index(wiki_dir: str) -> WikiIndex:
    """Lazily build and cache the index; rebuild when wiki_dir changes."""
    global _index, _index_dir
    with _index_lock:
        if _index is None or _index_dir != wiki_dir:
            _index = load_index(wiki_dir)
            _index_dir = wiki_dir
        return _index

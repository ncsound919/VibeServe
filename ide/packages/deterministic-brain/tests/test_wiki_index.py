from pathlib import Path

from wiki_index import load_index, search, load, namespaces


def _write_wiki(tmp: Path):
    business = tmp / "business"
    business.mkdir(parents=True)
    (business / "mission.md").write_text(
        "---\n"
        "title: 90-Day Mission\n"
        "tags: [mission, revenue]\n"
        "namespace: business\n"
        "sources:\n"
        "  - code: src/lib/draymond/seed.ts\n"
        "---\n"
        "\n"
        "Overlay365 targets $100k in 90 days via four revenue engines.\n"
        "#hashtag\n"
    )
    (business / "entity-catalog.md").write_text(
        "---\n"
        "title: Entity Catalog\n"
        "tags: [agents, tools, registry]\n"
        "namespace: business\n"
        "---\n"
        "\n"
        "Lists uplift-agent, sports-steve, megacode and more.\n"
    )


def test_load_index_finds_pages(tmp_path):
    _write_wiki(tmp_path)
    pages = load_index(str(tmp_path))
    assert len(pages) == 2
    assert {p["slug"] for p in pages} == {"business/mission", "business/entity-catalog"}


def test_frontmatter_parsed(tmp_path):
    _write_wiki(tmp_path)
    pages = load_index(str(tmp_path))
    mission = next(p for p in pages if p["slug"] == "business/mission")
    assert mission["title"] == "90-Day Mission"
    assert mission["namespace"] == "business"
    assert mission["tags"] == ["mission", "revenue"]
    assert mission["sources"] == [{"code": "src/lib/draymond/seed.ts"}]
    assert "title: 90-Day Mission" not in mission["content"]  # frontmatter stripped
    assert "#hashtag" in mission["content"]  # body preserved


def test_search_ranks_by_relevance(tmp_path):
    _write_wiki(tmp_path)
    idx = load_index(str(tmp_path))
    results = search(idx, "revenue engines mission", max_results=5)
    assert results[0]["slug"] == "business/mission"
    assert results[0]["score"] > 0


def test_load_returns_blocks(tmp_path):
    _write_wiki(tmp_path)
    idx = load_index(str(tmp_path))
    blocks = load(idx, "mission", max_results=1)
    assert len(blocks) == 1
    assert "Overlay365" in blocks[0]["content"]
    assert blocks[0]["title"] == "90-Day Mission"


def test_namespaces(tmp_path):
    _write_wiki(tmp_path)
    idx = load_index(str(tmp_path))
    assert "business" in namespaces(idx)

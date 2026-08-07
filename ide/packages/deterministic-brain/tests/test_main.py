import json
import os
import subprocess
import sys
from pathlib import Path

def _write_test_wiki(tmp: Path):
    biz = tmp / "business"
    biz.mkdir(parents=True)
    (biz / "mission.md").write_text(
        "---\ntitle: Mission\ntags: [mission]\nnamespace: business\n---\n"
        "\nOverlay365 targets $100k in 90 days."
    )

def run_brain(tmp, query, *extra):
    env = {"BRAIN_WIKI_DIR": str(tmp)}
    return subprocess.run(
        [sys.executable, "main.py", query, *extra],
        capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, **env},
        cwd=str(Path(__file__).resolve().parent.parent),
    )

def test_cli_non_verbose_outputs_grounded_response(tmp_path):
    _write_test_wiki(tmp_path)
    r = run_brain(tmp_path, "what is the overlay mission?")
    assert r.returncode == 0
    assert "Overlay365" in r.stdout
    assert "[CONTEXT · wiki]" in r.stdout
    assert "business/mission" in r.stdout

def test_cli_verbose_returns_json_shape(tmp_path):
    _write_test_wiki(tmp_path)
    r = run_brain(tmp_path, "analyze revenue", "--verbose")
    assert r.returncode == 0
    data = json.loads(r.stdout)
    assert set(data) == {"lane", "query", "response", "timestamp", "processing_time_ms"}
    assert data["lane"] == "coding"

def test_lane_respected(tmp_path):
    _write_test_wiki(tmp_path)
    r = run_brain(tmp_path, "analyze strategy", "--lane", "business_logic", "--verbose")
    data = json.loads(r.stdout)
    assert data["lane"] == "business_logic"

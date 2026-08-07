import importlib
import os
from pathlib import Path

def test_defaults_exist():
    cfg = importlib.import_module("config")
    assert set(cfg.DEFAULT_LANES.keys()) == {
        "coding", "business_logic", "agent_brain", "tool_calling", "cross_domain",
    }
    assert cfg.DEFAULT_BRAIN_CONFIG["temperature"] == 0.3

def test_wiki_dir_resolves(monkeypatch, tmp_path):
    monkeypatch.setenv("BRAIN_WIKI_DIR", str(tmp_path))
    importlib.reload(importlib.import_module("config"))
    cfg = importlib.import_module("config")
    assert str(cfg.WIKI_DIR) == str(tmp_path)
    assert cfg.WIKI_DIR.exists()  # config mkdirs it

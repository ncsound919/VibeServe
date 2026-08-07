import importlib


def _reload_config():
    return importlib.reload(importlib.import_module("config"))


def test_defaults_exist():
    cfg = importlib.import_module("config")
    assert set(cfg.DEFAULT_LANES.keys()) == {
        "coding", "business_logic", "agent_brain", "tool_calling", "cross_domain",
    }
    assert cfg.DEFAULT_BRAIN_CONFIG["temperature"] == 0.3

def test_wiki_dir_resolves(monkeypatch, tmp_path):
    monkeypatch.setenv("BRAIN_WIKI_DIR", str(tmp_path))
    cfg = _reload_config()
    assert str(cfg.WIKI_DIR) == str(tmp_path)
    assert cfg.WIKI_DIR.exists()  # config mkdirs it

def test_lane_model_env_overrides(monkeypatch):
    monkeypatch.setenv("BRAIN_LANE_CODING_MODEL", "test-coding-model")
    monkeypatch.setenv("BRAIN_LANE_BUSINESS_LOGIC_MODEL", "test-biz-model")
    cfg = _reload_config()
    assert cfg.DEFAULT_LANES["coding"]["model"] == "test-coding-model"
    assert cfg.DEFAULT_LANES["business_logic"]["model"] == "test-biz-model"

def test_router_model_env_override(monkeypatch):
    monkeypatch.setenv("BRAIN_ROUTER_MODEL", "test-router-model")
    cfg = _reload_config()
    assert cfg.DEFAULT_BRAIN_CONFIG["router_model"] == "test-router-model"

def test_numeric_env_casts(monkeypatch):
    monkeypatch.setenv("BRAIN_MAX_TOKENS", "2048")
    monkeypatch.setenv("BRAIN_TEMPERATURE", "0.7")
    monkeypatch.setenv("BRAIN_TIMEOUT_SECONDS", "15")
    cfg = _reload_config()
    assert cfg.DEFAULT_BRAIN_CONFIG["max_tokens"] == 2048
    assert type(cfg.DEFAULT_BRAIN_CONFIG["max_tokens"]) is int
    assert cfg.DEFAULT_BRAIN_CONFIG["temperature"] == 0.7
    assert type(cfg.DEFAULT_BRAIN_CONFIG["temperature"]) is float
    assert cfg.DEFAULT_BRAIN_CONFIG["timeout_seconds"] == 15
    assert type(cfg.DEFAULT_BRAIN_CONFIG["timeout_seconds"]) is int

def test_bookbridge_url_env_override(monkeypatch):
    monkeypatch.setenv("BRAIN_BOOKBRIDGE_URL", "http://localhost:9999")
    cfg = _reload_config()
    assert cfg.BRAIN_BOOKBRIDGE_URL == "http://localhost:9999"

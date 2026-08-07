"""
Deterministic Brain Configuration.

Lane/provider defaults, brain tuning, and the wiki knowledge directory.
All values overridable via environment variables.
"""

import os
from pathlib import Path

# Reasoning lanes: each routes to a provider/model. `enabled` gates routing.
DEFAULT_LANES = {
    "coding": {
        "provider": "anthropic",
        "model": os.environ.get("BRAIN_LANE_CODING_MODEL", "claude-sonnet-4-20250514"),
        "enabled": True,
        "description": "Code analysis and generation",
    },
    "business_logic": {
        "provider": "openai",
        "model": os.environ.get("BRAIN_LANE_BIZ_MODEL", "gpt-4o"),
        "enabled": True,
        "description": "Business logic and workflow analysis",
    },
    "agent_brain": {
        "provider": "anthropic",
        "model": os.environ.get("BRAIN_LANE_AGENT_MODEL", "claude-sonnet-4-20250514"),
        "enabled": True,
        "description": "Multi-agent coordination and planning",
    },
    "tool_calling": {
        "provider": "openai",
        "model": os.environ.get("BRAIN_LANE_TOOL_MODEL", "gpt-4o"),
        "enabled": True,
        "description": "API and tool integration analysis",
    },
    "cross_domain": {
        "provider": "anthropic",
        "model": os.environ.get("BRAIN_LANE_CROSS_MODEL", "claude-sonnet-4-20250514"),
        "enabled": True,
        "description": "Cross-domain synthesis and innovation",
    },
}

DEFAULT_BRAIN_CONFIG = {
    "lanes": DEFAULT_LANES,
    "router_model": os.environ.get("BRAIN_ROUTER_MODEL", "zen-reasoning-1"),
    "max_tokens": int(os.environ.get("BRAIN_MAX_TOKENS", "4096")),
    "temperature": float(os.environ.get("BRAIN_TEMPERATURE", "0.3")),
    "timeout_seconds": int(os.environ.get("BRAIN_TIMEOUT_SECONDS", "30")),
}

# Wiki knowledge directory (source of truth for grounding).
WIKI_DIR = Path(os.environ.get("BRAIN_WIKI_DIR", str(Path(__file__).resolve().parent / "wiki")))
WIKI_DIR.mkdir(parents=True, exist_ok=True)

# BookBridge reference API (fast-fail when offline).
BOOKBRIDGE_URL = os.environ.get("BOOKBRIDGE_URL", "http://127.0.0.1:8777")

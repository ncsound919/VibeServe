"""VibeServe v2.0 entry point — registers all tools including v2.0 feature tools."""

from __future__ import annotations
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from vibeserve.models import CodeFile, ArchitectureDecision, VibePlan
from vibeserve.core import (
    CONFIG, DEFAULT_DESIGN_SYSTEM, memory_store, cache_manager,
    store_successful_spec, get_similar_specs,
    SchemaValidator, SpecGenerator, MultiAgentCritique,
    VibeArchitect, VibeImplementer, VibeVerifier, VibeCodeReviewer,
    SystemAuditor, CritiqueLoop, VibeTester, VibeDeployer,
    TemplateLibrary, DesignUpgrader,
)
from vibeserve.utils import (
    TOON, Graphify, SentryTracker, Context7Provider,
    SupabaseConnector, VercelConnector, GitHubConnector,
    CloudflareConnector, GoogleConnector, EditorBridge,
    contrast_ratio,
)
from vibeserve.core import PlaywrightBridge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("VibeServe")


from vibeserve.server import mcp_server
@mcp_server.resource("design://systems/default")
def resource_default_design_system() -> str:
    return json.dumps(DEFAULT_DESIGN_SYSTEM, indent=2)

@mcp_server.resource("design://tokens/{token_type}")
def resource_design_tokens(token_type: str) -> str:
    tokens = DEFAULT_DESIGN_SYSTEM.get("tokens", {})
    return json.dumps(tokens.get(token_type, {"error": f"Unknown: {token_type}", "available": list(tokens.keys())}), indent=2)

@mcp_server.resource("memory://stats")
def resource_memory_stats() -> str:
    return json.dumps(memory_store.stats(), indent=2)

@mcp_server.resource("aether://version")
def resource_version() -> str:
    return json.dumps({
        "version": "1.1.0", "codename": "VibeServe",
        "tools": 27, "resources": 5, "prompts": 6,
        "providers": ["openai", "deepseek", "openrouter", "local", "opencode"],
        "pipeline": ["architect->code->review->verify->iterate->test->deploy"],
        "v2_features": [
            "vibe_clone", "vibe_git", "vibe_i18n", "vibe_diff", "vibe_search",
            "vibe_palette", "vibe_multiverse", "vibe_doctor", "vibe_live", "vibe_timemachine",
        ],
    }, indent=2)

@mcp_server.resource("spec://examples/{page_type}")
def resource_spec_example(page_type: str) -> str:
    specs = get_similar_specs(page_type, limit=1)
    return json.dumps(specs[0]["spec"] if specs else {"error": f"No specs for {page_type}"}, indent=2)


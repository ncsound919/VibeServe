"""VibeServe MCP resources."""

import json

from vibeserve.tools._tool_deps import (
    DEFAULT_DESIGN_SYSTEM, memory_store, get_similar_specs,
)
from vibeserve.server import mcp_server


@mcp_server.resource("design://systems/default")
def resource_default_design_system() -> str:
    import json
    return json.dumps(DEFAULT_DESIGN_SYSTEM, indent=2)

@mcp_server.resource("design://tokens/{token_type}")
def resource_design_tokens(token_type: str) -> str:
    import json
    tokens = DEFAULT_DESIGN_SYSTEM.get("tokens", {})
    return json.dumps(tokens.get(token_type, {"error": f"Unknown: {token_type}", "available": list(tokens.keys())}), indent=2)

@mcp_server.resource("memory://stats")
async def resource_memory_stats() -> str:
    import json
    return json.dumps(await memory_store.stats(), indent=2)

@mcp_server.resource("aether://version")
def resource_version() -> str:
    import json
    from importlib.metadata import version as pkg_version
    try:
        v = pkg_version("vibeserve")
    except Exception:
        v = "1.1.0"
    return json.dumps({
        "version": v, "codename": "VibeServe",
        "tools": 27, "resources": 5, "prompts": 6,
        "providers": ["openai", "deepseek", "openrouter", "local", "opencode"],
        "pipeline": ["architect->code->review->verify->iterate->test->deploy"],
        "v2_features": [
            "vibe_clone", "vibe_git", "vibe_i18n", "vibe_diff", "vibe_search",
            "vibe_palette", "vibe_multiverse", "vibe_doctor", "vibe_live", "vibe_timemachine",
        ],
    }, indent=2)

@mcp_server.resource("spec://examples/{page_type}")
async def resource_spec_example(page_type: str) -> str:
    import json
    specs = await get_similar_specs(page_type, limit=1)
    return json.dumps(specs[0]["spec"] if specs else {"error": f"No specs for {page_type}"}, indent=2)

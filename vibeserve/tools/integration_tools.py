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
@mcp_server.tool(name="supabase_query", description="Query a Supabase table.")
async def supabase_query_tool(ctx, table: str, select: str = "*", filters: Optional[Dict[str, Any]] = None, limit: int = 10) -> Dict[str, Any]:
    return await SupabaseConnector.query(table, select, filters, limit)

@mcp_server.tool(name="supabase_insert", description="Insert a row into a Supabase table.")
async def supabase_insert_tool(ctx, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return await SupabaseConnector.insert(table, data)

@mcp_server.tool(name="vercel_deployments", description="List recent Vercel deployments.")
async def vercel_deployments_tool(ctx, limit: int = 5) -> Dict[str, Any]:
    return await VercelConnector.list_deployments(limit)

@mcp_server.tool(name="github_repo", description="Get GitHub repo info.")
async def github_repo_tool(ctx, owner: str, repo: str) -> Dict[str, Any]:
    return await GitHubConnector.get_repo(owner, repo)

@mcp_server.tool(name="github_issues", description="List GitHub issues.")
async def github_issues_tool(ctx, owner: str, repo: str, state: str = "open") -> Dict[str, Any]:
    return await GitHubConnector.list_issues(owner, repo, state)

@mcp_server.tool(name="editor_config", description="Generate editor config files (VSCode, Zed, Cursor).")
async def editor_config_tool(ctx, editor: str = "vscode", project_name: str = "vibeserve") -> Dict[str, Any]:
    if editor == "vscode":
        config = {"tasks": EditorBridge.vscode_task_json("VibeServe: Run", "vibeserve"),
                  "settings": EditorBridge.vscode_settings_json()}
    elif editor == "zed":
        config = json.loads(EditorBridge.zed_workspace_config(project_name))
    else:
        config = {"cursor_rules": EditorBridge.cursor_rules("mcp-server")}
    return {"status": "success", "editor": editor, "config": config}


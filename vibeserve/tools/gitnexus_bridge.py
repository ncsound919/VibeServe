"""VibeServe GitNexus Bridge — zero-server code intelligence for AI agents.

Bridges VibeServe's MCP server to GitNexus CLI (36k+ stars, npm: gitnexus).
GitNexus builds a knowledge graph from any codebase: call chains, clusters,
dependency maps, execution flows. Agents query precomputed structure instead
of reading files blindly.

Requires: npx gitnexus (auto-installed on first use)
"""

import logging
import subprocess
from typing import Any, Dict, List, Optional

from vibeserve.auth import require_scope
from vibeserve.middleware import audit_tool
from vibeserve.server import mcp_server

logger = logging.getLogger(__name__)


def _ensure_gitnexus() -> bool:
    """Check if GitNexus CLI is available. Returns True if installed."""
    try:
        result = subprocess.run(
            ["npx", "gitnexus", "--version"],
            capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def _run_gitnexus(args: List[str], cwd: Optional[str] = None, timeout: int = 300) -> Dict[str, Any]:
    """Run a GitNexus CLI command with timeout and error handling."""
    import os
    base_dir = os.path.abspath(os.getcwd())
    if cwd:
        resolved_cwd = os.path.abspath(os.path.join(base_dir, cwd))
        if not resolved_cwd.startswith(base_dir):
            return {"status": "error", "error": f"Path traversal denied: {cwd} resolves outside workspace root.", "stdout": ""}
    else:
        resolved_cwd = base_dir

    cmd = ["npx", "-y", "gitnexus@latest"] + args
    try:
        result = subprocess.run(
            cmd,
            cwd=resolved_cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "stdout": result.stdout.strip()[-5000:],  # Truncate for MCP
            "stderr": result.stderr.strip()[-1000:],
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": f"Command timed out after {timeout}s", "stdout": ""}
    except FileNotFoundError:
        return {"status": "error", "error": "GitNexus CLI not found. Run: npm install -g gitnexus", "stdout": ""}


@mcp_server.tool(
    name="gitnexus_analyze",
    description="Index a repository with GitNexus — builds a knowledge graph of symbols, call chains, clusters, and execution flows. Prerequisite before using other gitnexus_* tools."
)
@audit_tool
@require_scope("mcp:write")
async def gitnexus_analyze(ctx, repo_path: str = ".", force: bool = False) -> Dict[str, Any]:
    """Analyze a repository and build the code intelligence graph.

    Args:
        repo_path: Path to the repository (default: current directory)
        force: Force full re-index even if already indexed

    Returns index statistics on success.
    """
    args = ["analyze", repo_path]
    if force:
        args.append("--force")
    result = _run_gitnexus(args, cwd=repo_path, timeout=600)
    if result.get("stdout"):
        result["stdout"] = result["stdout"]
    return result


@mcp_server.tool(
    name="gitnexus_query",
    description="Search the GitNexus knowledge graph — find symbols, processes, and definitions matching a query. Uses hybrid search (BM25 + semantic)."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_query(ctx, query: str, repo_path: str = ".") -> Dict[str, Any]:
    """Query the GitNexus knowledge graph.

    Returns process-grouped results with definitions, symbols, and execution flows.
    Use this instead of grep/read_file for understanding code structure.
    """
    # Use GitNexus MCP-like query through CLI
    result = _run_gitnexus(["query", query], cwd=repo_path, timeout=60)
    return result


@mcp_server.tool(
    name="gitnexus_context",
    description="Get a 360-degree view of a symbol — all incoming/outgoing calls, imports, processes it belongs to. Like 'go to definition' but shows the full dependency web."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_context(ctx, name: str, repo_path: str = ".") -> Dict[str, Any]:
    """Get full context for a symbol: callers, callees, processes, file location."""
    result = _run_gitnexus(["context", name], cwd=repo_path, timeout=60)
    return result


@mcp_server.tool(
    name="gitnexus_impact",
    description="Analyze blast radius — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_impact(ctx, target: str, direction: str = "upstream",
                          repo_path: str = ".", max_depth: int = 3) -> Dict[str, Any]:
    """Analyze the impact of changing a symbol.

    Args:
        target: Symbol name to analyze (e.g. 'UserService', 'validateUser')
        direction: 'upstream' (what depends on this) or 'downstream' (what this depends on)
        repo_path: Repository path
        max_depth: How deep to trace the dependency chain

    Returns depth-grouped results with confidence scores.
    """
    result = _run_gitnexus(
        ["impact", target, "--direction", direction, "--max-depth", str(max_depth)],
        cwd=repo_path, timeout=90
    )
    return result


@mcp_server.tool(
    name="gitnexus_list_repos",
    description="List all repositories indexed by GitNexus (across your entire machine)."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_list_repos(ctx) -> Dict[str, Any]:
    """List all indexed repositories via the global GitNexus registry."""
    result = _run_gitnexus(["list"], timeout=30)
    return result


@mcp_server.tool(
    name="gitnexus_status",
    description="Check GitNexus index status for the current repo — is it fresh, stale, or missing?"
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_status(ctx, repo_path: str = ".") -> Dict[str, Any]:
    """Check if the current repo has a fresh GitNexus index."""
    result = _run_gitnexus(["status"], cwd=repo_path, timeout=30)
    return result


@mcp_server.tool(
    name="gitnexus_detect_changes",
    description="Pre-commit impact analysis — maps changed lines to affected processes. Use before committing to understand what will break."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_detect_changes(ctx, repo_path: str = ".", scope: str = "all") -> Dict[str, Any]:
    """Analyze the impact of current git changes.

    Args:
        repo_path: Repository path
        scope: 'all' (entire working tree), 'staged' (staged changes only)

    Returns risk level and affected symbols/processes.
    """
    result = _run_gitnexus(
        ["detect-changes", "--scope", scope],
        cwd=repo_path, timeout=120
    )
    return result


@mcp_server.tool(
    name="gitnexus_wiki",
    description="Generate a codebase wiki from the GitNexus knowledge graph — architecture docs with mermaid diagrams."
)
@audit_tool
@require_scope("mcp:read")
async def gitnexus_wiki(ctx, repo_path: str = ".") -> Dict[str, Any]:
    """Generate architecture documentation from the knowledge graph."""
    result = _run_gitnexus(["wiki", repo_path], cwd=repo_path, timeout=300)
    return result


# Two-layer hint envelope helpers
def get_gitnexus_system_addendum(is_main_session: bool = True) -> str:
    """Get the static GitNexus rule block for system prompts.

    Layer 1 (static): Rules that don't change between sessions.
    Injected into the system prompt via hooks.
    """
    tools = [
        "gitnexus_query — search the knowledge graph (replaces grep for structure questions)",
        "gitnexus_context — 360-degree symbol view (callers, callees, processes)",
        "gitnexus_impact — blast radius analysis (what breaks if I change X)",
        "gitnexus_detect_changes — pre-commit impact (what changed and who's affected)",
    ]

    base = f"""<!-- gitnexus:system:start -->
**GitNexus Code Intelligence is available.** The codebase has been pre-indexed into a knowledge graph. You have smart tools that return complete, precomputed context — not raw file reads.

**Tool preference (ordered by use case):**
{chr(10).join(f"- {t}" for t in tools)}

**Rules for gitnexus tools:**
- Always query the graph before reading files when asking structural questions (who calls X, what depends on Y, where is Z used)
- Use `gitnexus_impact` before refactoring to understand blast radius
- Use `gitnexus_query` instead of grep for codebase exploration
- Graph results are precomputed and complete — trust them over partial file reads
"""

    if is_main_session:
        base += """
**Subagent propagation:** When spawning subagents for code investigation, include the
`[[gitnexus:graph]]` marker in their prompt to give them graph access. Qualifying types:
explore, deep, build, quick, refactor, general. Skip for: librarian, oracle, plan critics.
"""

    base += "\n<!-- gitnexus:system:end -->"
    return base


def get_gitnexus_envelope(repo_path: str, freshness: str = "up_to_date",
                          repo_name: str = "current") -> str:
    """Get the dynamic GitNexus graph envelope for user messages.

    Layer 2 (dynamic): Per-instance data that changes between turns.
    Prepended to user messages when the [[gitnexus:graph]] marker is present.
    """
    return f"""<gitnexus_graph source="gitnexus" version="2" freshness="{freshness}">
<summary>Code knowledge graph is available. Graph is {freshness.replace('_', ' ')}.</summary>
<indexed_repos>
<repo name="{repo_name}" path="{repo_path}"/>
</indexed_repos>
<rules>See the GitNexus section of the system prompt for tool preference and subagent propagation rules (marker [[gitnexus:graph]]).</rules>
</gitnexus_graph>"""

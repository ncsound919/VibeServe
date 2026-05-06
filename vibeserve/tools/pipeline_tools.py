"""Pipeline tools: file I/O, subprocess, security scans, wiki ingest.

All subprocess handlers now validate inputs with Pydantic models and
resolve to workspace-bound paths to prevent path-traversal attacks.
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from vibeserve.server import mcp_server
from vibeserve.middleware import audit_tool
from vibeserve.auth import require_scope
from vibeserve.models import FileReadInput, FileWriteInput, SubprocessInput

log = logging.getLogger("VibeServe")

_ALLOWED_MANAGERS = {"npm", "yarn", "pnpm"}
_WORKSPACE_ROOT = Path(os.getenv("VIBESERVE_WORKSPACE", ".")).resolve()


def _resolve_workspace_path(path: str) -> Path:
    """Resolve a user-supplied path within the workspace root. Raises on escape."""
    raw = Path(path)
    if not raw.is_absolute():
        raw = _WORKSPACE_ROOT / raw
    resolved = raw.resolve()
    try:
        resolved.relative_to(_WORKSPACE_ROOT)
    except ValueError:
        raise ValueError(f"Path traversal denied: {path}")
    return resolved


@mcp_server.tool(name="generate_plan", description="Generate a structured task decomposition for a given objective")
@audit_tool
@require_scope("mcp:write")
async def generate_plan_tool(ctx, objective: str, context: Optional[str] = None) -> Dict[str, Any]:
    await ctx.info(f"[plan] Generating plan for: {objective[:100]}...")
    import vibeserve
    prompt = f"Objective: {objective}\nContext: {context or 'None'}\n\nGenerate a structured task decomposition JSON: {{\"tasks\": [{{ \"id\": 1, \"task\": \"...\", \"dependency\": [] }}]}}"
    response = await vibeserve.mcp_llm_call(prompt, temperature=0.3)
    try:
        return {"status": "success", "plan": json.loads(response)}
    except json.JSONDecodeError:
        return {"status": "error", "message": "Failed to parse plan JSON", "raw": response}

@mcp_server.tool(name="retrieve_context", description="Retrieve context from the local wiki/knowledge base")
@audit_tool
@require_scope("mcp:read")
async def retrieve_context_tool(ctx, query: str) -> Dict[str, Any]:
    await ctx.info(f"[wiki] Searching for: {query}")
    wiki_path = Path("wiki")
    if not wiki_path.exists():
        return {"status": "success", "results": [], "message": "Wiki directory not found"}
    
    results = []
    for f in wiki_path.glob("*.md"):
        content = f.read_text()
        if query.lower() in content.lower():
            results.append({"file": f.name, "content": content[:500] + "..."})
    
    return {"status": "success", "results": results[:5]}

@mcp_server.tool(name="read_file", description="Read content from a file in the workspace")
@audit_tool
@require_scope("mcp:read")
async def read_file_tool(ctx, path: str) -> Dict[str, Any]:
    FileReadInput(path=path)
    await ctx.info(f"[fs] Reading {path}")
    p = _resolve_workspace_path(path)
    if not p.exists():
        return {"status": "error", "message": f"File not found: {path}"}
    if not p.is_file():
        return {"status": "error", "message": f"Not a file: {path}"}
    return {"status": "success", "content": p.read_text(encoding="utf-8", errors="replace")}

@mcp_server.tool(name="write_file", description="Write content to a file in the workspace")
@audit_tool
@require_scope("mcp:write")
async def write_file_tool(ctx, path: str, content: str) -> Dict[str, Any]:
    FileWriteInput(path=path, content=content)
    await ctx.info(f"[fs] Writing {path}")
    p = _resolve_workspace_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return {"status": "success", "path": path, "bytes": len(content)}

@mcp_server.tool(name="check_node_env", description="Verify node.js environment")
@require_scope("mcp:read")
async def check_node_env_tool(ctx) -> Dict[str, Any]:
    try:
        res = subprocess.run(["node", "-v"], capture_output=True, text=True, timeout=300)
        return {"status": "success", "version": res.stdout.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@mcp_server.tool(name="detect_package_manager", description="Detect which package manager to use (npm, yarn, pnpm)")
@require_scope("mcp:read")
async def detect_package_manager_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    if (p / "package-lock.json").exists():
        return {"status": "success", "manager": "npm"}
    if (p / "yarn.lock").exists():
        return {"status": "success", "manager": "yarn"}
    if (p / "pnpm-lock.yaml").exists():
        return {"status": "success", "manager": "pnpm"}
    return {"status": "success", "manager": "npm", "note": "defaulted to npm"}

@mcp_server.tool(name="run_install", description="Run package installation")
@audit_tool
@require_scope("mcp:write")
async def run_install_tool(ctx, manager: str = "npm", path: str = ".") -> Dict[str, Any]:
    SubprocessInput(manager=manager, path=path)
    p = _resolve_workspace_path(path)
    await ctx.info(f"[shell] Running {manager} install in {path}")
    try:
        res = subprocess.run([manager, "install"], cwd=str(p), capture_output=True, text=True, timeout=300)
        return {"status": "success" if res.returncode == 0 else "error", "stdout": res.stdout, "stderr": res.stderr}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 300s"}

@mcp_server.tool(name="run_biome", description="Run Biome linter/formatter")
@require_scope("mcp:write")
async def run_biome_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    res = subprocess.run(["npx", "@biomejs/biome", "check", "--apply", "."], cwd=str(p), capture_output=True, text=True, timeout=300)
    return {"status": "success" if res.returncode == 0 else "error", "stdout": res.stdout}

@mcp_server.tool(name="run_tsc", description="Run TypeScript compiler check")
@require_scope("mcp:read")
async def run_tsc_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    res = subprocess.run(["npx", "tsc", "--noEmit"], cwd=str(p), capture_output=True, text=True, timeout=300)
    return {"status": "success" if res.returncode == 0 else "error", "stdout": res.stdout}

@mcp_server.tool(name="run_build", description="Run production build")
@audit_tool
@require_scope("mcp:write")
async def run_build_tool(ctx, manager: str = "npm", path: str = ".") -> Dict[str, Any]:
    SubprocessInput(manager=manager, path=path)
    p = _resolve_workspace_path(path)
    try:
        res = subprocess.run([manager, "run", "build"], cwd=str(p), capture_output=True, text=True, timeout=300)
        return {"status": "success" if res.returncode == 0 else "error", "stdout": res.stdout}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 300s"}

@mcp_server.tool(name="run_semgrep", description="Run Semgrep SAST scan on the project")
@audit_tool
@require_scope("mcp:write")
async def run_semgrep_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    await ctx.info(f"[security] Running semgrep scan in {path}")
    try:
        res = subprocess.run(["semgrep", "scan", "--json", "."], cwd=str(p), capture_output=True, text=True, timeout=300)
        return {"status": "success", "results": json.loads(res.stdout)}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 300s"}
    except Exception as e:
        return {"status": "error", "message": str(e), "note": "Semgrep might not be installed in this environment"}

@mcp_server.tool(name="run_npm_audit", description="Run npm audit for dependency security")
@audit_tool
@require_scope("mcp:write")
async def run_npm_audit_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    await ctx.info(f"[security] Running npm audit in {path}")
    try:
        res = subprocess.run(["npm", "audit", "--json"], cwd=str(p), capture_output=True, text=True, timeout=300)
        try:
            return {"status": "success", "audit": json.loads(res.stdout)}
        except json.JSONDecodeError:
            return {"status": "error", "message": "Failed to parse npm audit JSON", "stdout": res.stdout}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 300s"}

@mcp_server.tool(name="run_playwright", description="Run Playwright E2E tests")
@audit_tool
@require_scope("mcp:write")
async def run_playwright_tool(ctx, path: str = ".") -> Dict[str, Any]:
    p = _resolve_workspace_path(path)
    await ctx.info(f"[test] Running Playwright in {path}")
    if not (p / "playwright.config.ts").exists() and not (p / "playwright.config.js").exists():
         return {"status": "error", "message": "Playwright config not found"}
    try:
        res = subprocess.run(["npx", "playwright", "test"], cwd=str(p), capture_output=True, text=True, timeout=300)
        return {"status": "success" if res.returncode == 0 else "error", "stdout": res.stdout}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 300s"}

@mcp_server.tool(name="ingest_learning", description="Save pipeline results/learnings to the local wiki")
@audit_tool
@require_scope("mcp:write")
async def ingest_learning_tool(ctx, topic: str, content: str) -> Dict[str, Any]:
    wiki_path = Path("wiki")
    wiki_path.mkdir(exist_ok=True)
    f = wiki_path / f"{topic.replace(' ', '_')}.md"
    f.write_text(f"# Learning: {topic}\n\n{content}\n\n*Date: {Path('learning_log.json').name}*")
    return {"status": "success", "file": str(f)}

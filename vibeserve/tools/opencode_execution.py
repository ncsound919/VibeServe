"""
OpenCode Execution Tool — dispatches coding tasks to the OpenCode CLI agent.

This tool integrates OpenCode as the execution backend for VibeServe.
It receives structured tasks, executes them via `npx opencode`, and returns results.
Falls back gracefully if OpenCode is not installed.

Usage (HTTP bridge):
  POST /tools/vs_opencode_execute
  {
    "task": "Description of the coding task to execute",
    "workspace_dir": "/path/to/workspace",
    "context_files": ["src/file1.ts", "src/file2.ts"],
    "model": "claude-sonnet-4-20250514",  // optional
    "timeout_seconds": 300
  }
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional

from vibeserve.auth import require_scope
from vibeserve.middleware import audit_tool, get_trace_id, new_trace_id, set_trace_id
from vibeserve.server import mcp_server

log = logging.getLogger("VibeServe")


def _ensure_trace(trace_id: Optional[str] = None) -> str:
    tid = trace_id or get_trace_id() or new_trace_id()
    set_trace_id(tid)
    return tid


async def _check_opencode_available() -> bool:
    """Check if OpenCode CLI is available via npx or local install."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "npx", "opencode", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        return proc.returncode == 0
    except (FileNotFoundError, asyncio.TimeoutError):
        return False


async def _run_opencode_task(
    task: str,
    workspace_dir: str,
    context_files: Optional[List[str]] = None,
    model: Optional[str] = None,
    timeout_seconds: int = 300,
) -> Dict[str, Any]:
    """
    Execute a coding task using the OpenCode CLI.

    Builds a temporary task file with the instruction and context,
    invokes `npx opencode` in the target workspace, and captures output.
    """
    # Build instruction with context
    context_section = ""
    if context_files:
        context_section = "\n## Relevant Files\n"
        for fpath in context_files:
            full_path = os.path.join(workspace_dir, fpath)
            if os.path.isfile(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(8000)
                    context_section += f"\n### {fpath}\n```\n{content}\n```\n"
                except Exception:
                    context_section += f"\n### {fpath} _(unreadable)_\n"

    instruction = f"{task}\n\n{context_section}" if context_files else task

    # Write instruction to temp file
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    )
    try:
        tmp.write(instruction)
        tmp.close()

        cmd = ["npx", "opencode", "-p", tmp.name]
        if model:
            cmd.extend(["-m", model])

        log.info("OpenCode task started (timeout=%ss)", timeout_seconds)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=workspace_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "status": "error",
                "error": f"OpenCode task timed out after {timeout_seconds}s",
                "execution_seconds": timeout_seconds,
            }

        stdout_str = stdout.decode("utf-8", errors="replace")
        stderr_str = stderr.decode("utf-8", errors="replace")

        return {
            "status": "success" if proc.returncode == 0 else "error",
            "exit_code": proc.returncode,
            "stdout": stdout_str[-50000:],  # cap at 50KB
            "stderr": stderr_str[-10000:],   # cap at 10KB
        }

    except Exception as e:
        log.exception("OpenCode execution failed")
        return {"status": "error", "error": str(e)}
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


# ─── MCP Tool Definition ──────────────────────────────────────


@mcp_server.tool(
    name="vs_opencode_execute",
    description="Execute a coding task using the OpenCode CLI agent.",
)
@audit_tool
@require_scope("mcp:write")
async def vs_opencode_execute_tool(
    ctx,
    task: str,
    workspace_dir: str,
    context_files: Optional[List[str]] = None,
    model: Optional[str] = None,
    timeout_seconds: int = 300,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)

    # Validate workspace directory
    if not os.path.isdir(workspace_dir):
        return {
            "status": "error",
            "error": f"Workspace directory not found: {workspace_dir}",
            "traceId": tid,
        }

    # Check OpenCode availability
    available = await _check_opencode_available()
    if not available:
        return {
            "status": "error",
            "error": (
                "OpenCode CLI not available. Install with:\n"
                "  npx opencode@latest --yes\n"
                "Or add to your project:\n"
                "  npm install --save-dev @opencode/cli"
            ),
            "traceId": tid,
        }

    result = await _run_opencode_task(
        task=task,
        workspace_dir=workspace_dir,
        context_files=context_files,
        model=model,
        timeout_seconds=timeout_seconds,
    )
    result["traceId"] = tid
    return result

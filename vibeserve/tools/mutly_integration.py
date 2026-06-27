"""Mutly integration MCP tools — memory, planning, artifacts, validation."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from vibeserve.auth import require_scope
from vibeserve.middleware import audit_tool, get_trace_id, new_trace_id, set_trace_id
from vibeserve.server import mcp_server
from vibeserve.tools.mutly_workspace_memory import workspace_memory

log = logging.getLogger("VibeServe")


def _ensure_trace(trace_id: Optional[str] = None) -> str:
    tid = trace_id or get_trace_id() or new_trace_id()
    set_trace_id(tid)
    return tid


@mcp_server.tool(
    name="vs_memory_get",
    description="Retrieve workspace-scoped memory entries for Mutly workflows.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_memory_get_tool(
    ctx,
    workspace_id: str,
    context_types: Optional[List[str]] = None,
    limit: int = 20,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)
    return await workspace_memory.get(workspace_id, context_types, limit, tid)


@mcp_server.tool(
    name="vs_memory_store",
    description="Store workspace-scoped memory for Mutly workflows.",
)
@audit_tool
@require_scope("mcp:write")
async def vs_memory_store_tool(
    ctx,
    workspace_id: str,
    context_type: str,
    payload: Dict[str, Any],
    trace_id: Optional[str] = None,
    ttl_seconds: int = 604800,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)
    return await workspace_memory.store(workspace_id, context_type, payload, tid, ttl_seconds)


@mcp_server.tool(
    name="vs_schema_validate",
    description="Validate JSON data against a JSON schema.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_schema_validate_tool(
    ctx,
    data: str,
    schema: str,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)
    errors: List[str] = []
    try:
        parsed_data = json.loads(data) if isinstance(data, str) else data
        parsed_schema = json.loads(schema) if isinstance(schema, str) else schema
    except json.JSONDecodeError as e:
        return {"status": "error", "valid": False, "errors": [str(e)], "traceId": tid}

    # Lightweight validation without jsonschema dependency
    if isinstance(parsed_schema, dict):
        if parsed_schema.get("type") == "object" and isinstance(parsed_data, dict):
            required = parsed_schema.get("required", [])
            if isinstance(required, list):
                for key in required:
                    if not isinstance(key, str) or key not in parsed_data:
                        errors.append(f"Missing required field: {key}")
        elif parsed_schema.get("type") == "array" and not isinstance(parsed_data, list):
            errors.append("Expected array")
    else:
        errors.append("Schema must be a JSON object")

    return {
        "status": "success",
        "valid": len(errors) == 0,
        "errors": errors,
        "traceId": tid,
    }



def _critique_plan(plan_obj: Dict[str, Any]) -> Dict[str, Any]:
    steps = plan_obj.get("tree") or plan_obj.get("steps") or []
    recommendations: List[str] = []
    errors: List[str] = []

    if not steps:
        errors.append("Plan has no steps defined")
    if len(steps) > 15:
        recommendations.append("Consider splitting into smaller workflows (>15 steps)")

    risky = [s for s in steps if str(s.get("risk", "")).lower() in ("high", "orange", "red")]
    if risky:
        recommendations.append(f"{len(risky)} high-risk steps should run verification after each")

    verify_steps = [
        s for s in steps if any(k in str(s.get("step", "")).lower() for k in ("test", "lint", "verify"))
    ]
    if steps and not verify_steps:
        recommendations.append("Add a verification step (lint/test) before marking complete")

    return {
        "artifactType": "plan_critique",
        "recommendations": recommendations,
        "errors": errors,
        "stepCount": len(steps),
    }


@mcp_server.tool(
    name="vs_plan_review",
    description="Review an execution plan and return structured critique.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_plan_review_tool(
    ctx,
    plan: str,
    file_context: Optional[str] = None,
    recent_errors: Optional[List[str]] = None,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)
    try:
        plan_obj = json.loads(plan) if isinstance(plan, str) else plan
    except json.JSONDecodeError:
        plan_obj = {"message": plan, "tree": []}

    critique = _critique_plan(plan_obj if isinstance(plan_obj, dict) else {"tree": []})
    if recent_errors:
        critique["errors"] = critique.get("errors", []) + [
            f"Recent error: {e}" for e in recent_errors[:5]
        ]
    if file_context:
        critique["recommendations"] = critique.get("recommendations", []) + [
            "File context provided — confirm blast radius before multi-file edits"
        ]

    return {"status": "success", "traceId": tid, **critique}


@mcp_server.tool(
    name="vs_generate_artifact",
    description="Generate a structured advisory artifact (not executable).",
)
@audit_tool
@require_scope("mcp:write")
async def vs_generate_artifact_tool(
    ctx,
    prompt: str,
    artifact_type: str = "code_block",
    design_context: Optional[str] = None,
    trace_id: Optional[str] = None,
    use_llm: bool = True,
) -> Dict[str, Any]:
    """Generate a structured advisory artifact.

    When use_llm=True (default) and an LLM provider is configured, the prompt
    is sent to the configured provider. Otherwise returns a deterministic
    stub (preserves the original advisory-only contract).
    """
    tid = _ensure_trace(trace_id)
    atype = artifact_type if artifact_type in (
        "component_spec",
        "code_block",
        "json_patch",
    ) else "code_block"

    # Build the LLM prompt tailored to the artifact type
    llm_content: Optional[str] = None
    provider_used: Optional[str] = None
    if use_llm:
        try:
            from vibeserve import providers
            type_instructions = {
                "code_block": "Respond with a single code block (no markdown fences).",
                "component_spec": (
                    "Respond with a JSON object only — no prose, no markdown — "
                    "with keys: name, description, props (array of {name, type, required})."
                ),
                "json_patch": (
                    "Respond with a JSON Patch array (RFC 6902) only — no prose, no markdown."
                ),
            }
            full_prompt = (
                f"{type_instructions.get(atype, type_instructions['code_block'])}\n\n"
                f"Request: {prompt[:2000]}\n"
            )
            if design_context:
                full_prompt += f"\nDesign constraints:\n{design_context[:2000]}\n"
            response_format = "json" if atype in ("component_spec", "json_patch") else "text"
            llm_content = await providers.mcp_llm_call(full_prompt, temperature=0.3, response_format=response_format)
            if llm_content:
                provider_used = providers.router.get().name if providers.router.providers else None
        except Exception as e:
            log.warning("LLM call failed in vs_generate_artifact, falling back to stub: %s", e)
            llm_content = None

    if llm_content:
        return {
            "status": "success",
            "traceId": tid,
            "artifactType": atype,
            "content": llm_content,
            "provider": provider_used,
            "recommendations": ["Treat as advisory only — Mutly must verify locally"],
        }

    # Deterministic stub fallback (no LLM configured or call failed)
    content = f"// Advisory artifact for: {prompt[:500]}\n"
    if design_context:
        content = f"/* DESIGN constraints:\n{design_context[:2000]}\n*/\n" + content
    if atype == "component_spec":
        content = json.dumps(
            {
                "name": "GeneratedComponent",
                "description": prompt[:300],
                "props": [],
            },
            indent=2,
        )
    elif atype == "json_patch":
        content = json.dumps([{"op": "add", "path": "/TASK", "value": prompt[:100]}])

    return {
        "status": "success",
        "traceId": tid,
        "artifactType": atype,
        "content": content,
        "provider": None,
        "fallback": "stub",
        "recommendations": ["Treat as advisory only — Mutly must verify locally"],
    }


@mcp_server.tool(
    name="vs_validate_artifact",
    description="Validate artifact shape and size constraints.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_validate_artifact_tool(
    ctx,
    artifact: str,
    schema: Optional[str] = None,
    max_chars: int = 50000,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)
    errors: List[str] = []
    if not artifact or not str(artifact).strip():
        errors.append("Artifact is empty")
    if len(artifact) > max_chars:
        errors.append(f"Artifact exceeds {max_chars} characters")

    if schema:
        result = await vs_schema_validate_tool(ctx, artifact, schema, tid)
        if not result.get("valid"):
            errors.extend(result.get("errors", []))

    return {
        "status": "success",
        "traceId": tid,
        "valid": len(errors) == 0,
        "errors": errors,
    }


# ─── OpenCode execution tool ──────────────────────────────────
try:
    from vibeserve.tools.opencode_execution import vs_opencode_execute_tool
except ImportError as e:
    log.warning("OpenCode execution tool not available: %s", e)
    vs_opencode_execute_tool = None  # type: ignore[assignment]

# ─── Hermes Agent memory tools ────────────────────────────────
# Hermes tools are now mounted via FastMCP proxy in server.py
# Individual tool functions are no longer exported from hermes_integration
vs_hermes_memory_query_tool = None
vs_hermes_context_store_tool = None
vs_hermes_skill_generate_tool = None
vs_hermes_health_tool = None

# ─── Code Graph tools (Dim 4 — blast radius analysis) ────────
try:
    from vibeserve.tools.code_graph import (
        codegraph_build as _cg_build,
        codegraph_query as _cg_query,
        codegraph_context as _cg_context,
        codegraph_impact as _cg_impact,
        codegraph_stats as _cg_stats,
    )
    vs_codegraph_build_tool = _cg_build
    vs_codegraph_query_tool = _cg_query
    vs_codegraph_context_tool = _cg_context
    vs_codegraph_impact_tool = _cg_impact
    vs_codegraph_stats_tool = _cg_stats
except ImportError as e:
    log.warning("Code graph tools not available: %s", e)
    vs_codegraph_build_tool = None
    vs_codegraph_query_tool = None
    vs_codegraph_context_tool = None
    vs_codegraph_impact_tool = None
    vs_codegraph_stats_tool = None

# ─── ECC skills & security tools ─────────────────────────────
try:
    from vibeserve.tools.ecc_integration import (
        vs_ecc_skills_list_tool,
        vs_ecc_agent_shield_tool,
        vs_ecc_health_tool,
    )
except ImportError as e:
    log.warning("ECC integration tools not available: %s", e)
    vs_ecc_skills_list_tool = None
    vs_ecc_agent_shield_tool = None
    vs_ecc_health_tool = None


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Any] = {}

    def register(self, name: str, handler) -> None:
        self._tools[name] = handler

    def get(self, name: str):
        return self._tools.get(name)

    def keys(self):
        return self._tools.keys()

    def __getitem__(self, name: str):
        return self._tools[name]

    def __setitem__(self, name: str, handler) -> None:
        self._tools[name] = handler

    def __contains__(self, name: str) -> bool:
        return name in self._tools


# Tool registry for HTTP bridge (name -> handler)
MUTLY_HTTP_TOOLS = ToolRegistry()
MUTLY_HTTP_TOOLS.register("vs_memory_get", vs_memory_get_tool)
MUTLY_HTTP_TOOLS.register("vs_memory_store", vs_memory_store_tool)
MUTLY_HTTP_TOOLS.register("vs_schema_validate", vs_schema_validate_tool)
MUTLY_HTTP_TOOLS.register("vs_plan_review", vs_plan_review_tool)
MUTLY_HTTP_TOOLS.register("vs_generate_artifact", vs_generate_artifact_tool)
MUTLY_HTTP_TOOLS.register("vs_validate_artifact", vs_validate_artifact_tool)

if vs_opencode_execute_tool is not None:
    MUTLY_HTTP_TOOLS.register("vs_opencode_execute", vs_opencode_execute_tool)
# Hermes tools are mounted via FastMCP proxy in server.py
if vs_codegraph_impact_tool is not None:
    MUTLY_HTTP_TOOLS.register("codegraph_build", vs_codegraph_build_tool)
    MUTLY_HTTP_TOOLS.register("codegraph_query", vs_codegraph_query_tool)
    MUTLY_HTTP_TOOLS.register("codegraph_context", vs_codegraph_context_tool)
    MUTLY_HTTP_TOOLS.register("codegraph_impact", vs_codegraph_impact_tool)
    MUTLY_HTTP_TOOLS.register("codegraph_stats", vs_codegraph_stats_tool)
    log.info("Code graph tools registered in HTTP bridge")
if vs_ecc_skills_list_tool is not None:
    MUTLY_HTTP_TOOLS.register("vs_ecc_skills_list", vs_ecc_skills_list_tool)
    MUTLY_HTTP_TOOLS.register("vs_ecc_agent_shield", vs_ecc_agent_shield_tool)
    MUTLY_HTTP_TOOLS.register("vs_ecc_health", vs_ecc_health_tool)

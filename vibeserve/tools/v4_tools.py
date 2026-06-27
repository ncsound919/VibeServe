"""VibeServe v4 tools — UI spec generation, validation, design systems, memory."""

import asyncio
import json
from typing import Any, Dict, List

from vibeserve.tools._tool_deps import (
    CONFIG, DEFAULT_DESIGN_SYSTEM, memory_store, cache_manager,
    store_successful_spec, SchemaValidator, SpecGenerator,
    contrast_ratio, log,
)
from vibeserve.server import mcp_server
from vibeserve.middleware import audit_tool
from vibeserve.auth import require_scope
from vibeserve.models import SpecResponse


def _clip(spec: dict, max_keys: int = 10) -> dict:
    return {k: spec[k] for k in list(spec.keys())[:max_keys]} if spec else {}


@mcp_server.tool(name="generate_ui_spec", description="Generate a production-ready UI specification with multi-agent critique, WCAG AAA validation, and design system enforcement")
@audit_tool
@require_scope("mcp:write")
async def generate_ui_spec_tool(ctx, page_type: str, requirements: List[str],
    design_system=None, target_audience: str = "general users", use_cache: bool = True) -> Dict[str, Any]:
    import hashlib
    try:
        ds = design_system or DEFAULT_DESIGN_SYSTEM
        ds_id = hashlib.sha256(json.dumps(ds, sort_keys=True).encode()).hexdigest()[:20]
        if use_cache:
            ck = cache_manager.get_cache_key(page_type, requirements, ds_id)
            cr = cache_manager.get(ck)
            if cr:
                await ctx.info(f"[cache] Hit for {page_type}")
                return SpecResponse(**cr, cache_hit=True).model_dump()
        else:
            ck = None
        await ctx.info(f"[generate] {page_type}")
        await ctx.report_progress(10, 100, "Validating...")
        gen = SpecGenerator(ds)
        await ctx.report_progress(15, 100, "Generating variants...")
        gen.ctx = ctx
        result = await gen.generate_with_critique([*requirements, f"Target: {target_audience}", "WCAG AAA mandatory"], iterations=1)
        if not result:
            return {"error": "Failed", "status": "error"}
        await ctx.report_progress(85, 100, "Storing...")
        sel = result.get("selected", {})
        score = sel.get("_score", 0)
        if score > CONFIG.min_score_to_store:
            await store_successful_spec(page_type, sel, score)
        response = SpecResponse(
            page_type=page_type,
            selected_specification=_clip(sel),
            alternatives=[_clip(alt) for alt in result.get("alternatives", [])],
            metadata={**result.get("generation_metadata", {}), "design_system_id": ds_id, "target_audience": target_audience},
            critique=sel.get("_critique", {}),
        )
        if use_cache and ck:
            cache_manager.set(ck, response.model_dump())
        await ctx.report_progress(100, 100, "Complete!")
        return response.model_dump()
    except (KeyboardInterrupt, asyncio.CancelledError, MemoryError, SystemExit):
        raise
    except Exception as e:
        log.error(f"[generate_ui_spec] {e}", exc_info=True)
        return {"status": "error", "error": str(e)}

@mcp_server.tool(name="validate_ui_spec", description="Validate a UI specification against design system and WCAG standards")
@audit_tool
@require_scope("mcp:read")
async def validate_ui_spec_tool(ctx, specification: Dict[str, Any]) -> Dict[str, Any]:
    await ctx.info("[validate] Checking...")
    valid, errors = SchemaValidator().validate_schema(specification)
    warnings = []
    if valid and specification.get("components"):
        ds = specification.get("design_system", {})
        bg = ds.get("tokens", {}).get("colors", {}).get("background", {}).get("hex", "#FFF")
        for c in specification.get("components", []):
            cr_key = c.get("visual", {}).get("color_role")
            if cr_key:
                cd = ds.get("tokens", {}).get("colors", {}).get(cr_key, {})
                ratio = contrast_ratio(cd.get("hex", "#000"), bg)
                if ratio < 4.5:
                    warnings.append(f"Component '{c.get('label')}' low contrast ({ratio:.1f}:1)")
    return {"valid": valid, "error_count": len(errors), "errors": errors[:10], "warnings": warnings}

@mcp_server.tool(name="list_design_systems", description="List available design systems")
@audit_tool
@require_scope("mcp:read")
async def list_design_systems_tool(ctx) -> Dict[str, Any]:
    return {
        "available_systems": [{
            "id": "default_grok", "name": "Grok Neon Dark",
            "colors": list(DEFAULT_DESIGN_SYSTEM["tokens"]["colors"].keys()),
            "component_count": len(DEFAULT_DESIGN_SYSTEM["constraints"]["allowed_components"]),
            "wcag_level": "AAA"
        }],
        "custom_systems": [{"id": f.stem, "path": str(f)} for f in CONFIG.memory_dir.glob("*_system.json")] if CONFIG.memory_dir.exists() else []
    }

@mcp_server.tool(name="memory_stats", description="Get statistics on learned/stored UI specifications")
@audit_tool
@require_scope("mcp:read")
async def memory_stats_tool(ctx) -> Dict[str, Any]:
    await ctx.info("[memory] Gathering stats...")
    return memory_store.stats()


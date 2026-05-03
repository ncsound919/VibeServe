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


# ====================== LAZY MCP SERVER ======================
class _LazyMCP:
    _tools: list = []
    _resources: list = []
    _prompts: list = []
    _name: str = ""

    @classmethod
    def init(cls, name: str) -> None:
        cls._name = name

    @classmethod
    def tool(cls, name: Optional[str] = None, description: Optional[str] = None):
        def decorator(func):
            cls._tools.append((name, description, func))
            return func
        return decorator

    @classmethod
    def resource(cls, uri: str):
        def decorator(func):
            cls._resources.append((uri, func))
            return func
        return decorator

    @classmethod
    def prompt(cls):
        def decorator(func):
            cls._prompts.append(func)
            return func
        return decorator

    @classmethod
    def build(cls):
        from fastmcp import FastMCP
        server = FastMCP(cls._name)
        for name, desc, func in cls._tools:
            kwargs = {}
            if name:
                kwargs["name"] = name
            if desc:
                kwargs["description"] = desc
            server.tool(**kwargs)(func)
        for uri, func in cls._resources:
            server.resource(uri)(func)
        for func in cls._prompts:
            server.prompt()(func)
        return server


mcp_server = _LazyMCP
_LazyMCP.init("VibeServe")

CONTENT_GUIDELINES = """
CRITICAL CONTENT RULES:
NO FABRICATION:
- NEVER invent statistics, testimonials, quotes, or named users.
- NEVER use SaaS copy: "Free Trial", "Pricing Plans", "Sign Up", "Enterprise Tier".
MUST INCLUDE: Logo, actual features from plan, pipeline diagram, quick start, donate link.
STRUCTURAL: Valid HTML, ARIA labels, relative asset paths, current year.
"""


def _clip(d, *_):
    return {k: v for k, v in d.items() if not k.startswith("_")}


# ====================== RESOURCES ======================
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
        "version": "2.0.0", "codename": "VibeServe",
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

# ====================== PROMPTS ======================
@mcp_server.prompt()
def prompt_architecture(intent: str = "", constraints: str = "") -> str:
    return f"Architecture plan for: {intent}\nConstraints: {constraints}\n\nUse vibe_architect."

@mcp_server.prompt()
def prompt_code_review(files: str = "", requirements: str = "") -> str:
    return f"Review code from UX/Engineering/Accessibility perspectives.\nFiles: {files}\nUse vibe_review."

@mcp_server.prompt()
def prompt_vibe_build(intent: str = "") -> str:
    return f"Full pipeline: architect->code->review->verify->iterate\nIntent: {intent}\nZero fabrication."

@mcp_server.prompt()
def prompt_accessibility_audit() -> str:
    return "Audit for WCAG AAA: ARIA roles, keyboard nav, contrast (7:1), touch targets (44px)."

@mcp_server.prompt()
def prompt_test_generation(code: str = "") -> str:
    return f"Generate unit, accessibility, integration, edge case tests.\nCode: {code}"

@mcp_server.prompt()
def prompt_deployment(target: str = "vercel") -> str:
    return f"Generate deployment config for {target}: build, env, runtime, health checks."

# ====================== V4 TOOLS ======================
@mcp_server.tool(name="generate_ui_spec", description="Generate a production-ready UI specification with multi-agent critique, WCAG AAA validation, and design system enforcement")
async def generate_ui_spec_tool(ctx, page_type: str, requirements: List[str],
    design_system: Optional[Dict[str, Any]] = None, target_audience: str = "general users", use_cache: bool = True) -> Dict[str, Any]:
    import hashlib
    try:
        ds = design_system or DEFAULT_DESIGN_SYSTEM
        ds_id = hashlib.sha256(json.dumps(ds, sort_keys=True).encode()).hexdigest()[:20]
        if use_cache:
            ck = cache_manager.get_cache_key(page_type, requirements, ds_id)
            cr = cache_manager.get(ck)
            if cr:
                await ctx.info(f"[cache] Hit for {page_type}")
                return {**cr, "_cache_hit": True}
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
        score = sel.get("_score",0)
        if score > CONFIG.min_score_to_store:
            store_successful_spec(page_type, sel, score)
        output = {
            "status": "success", "page_type": page_type,
            "selected_specification": _clip(sel),
            "alternatives": [_clip(alt) for alt in result.get("alternatives", [])],
            "metadata": {**result.get("generation_metadata", {}), "design_system_id": ds_id, "target_audience": target_audience},
            "critique": sel.get("_critique", {})
        }
        if use_cache and ck:
            cache_manager.set(ck, output)
        await ctx.report_progress(100, 100, "Complete!")
        return output
    except Exception as e:
        log.error(f"Error: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}

@mcp_server.tool(name="validate_ui_spec", description="Validate a UI specification against design system and WCAG standards")
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
async def memory_stats_tool(ctx) -> Dict[str, Any]:
    await ctx.info("[memory] Gathering stats...")
    return memory_store.stats()

# ====================== V5 CORE TOOLS ======================
@mcp_server.tool(name="vibe_architect", description="Transform natural language intent into a detailed architecture plan with ADR decisions.")
async def vibe_architect_tool(ctx, intent: str, constraints: Optional[List[str]] = None,
                               context: Optional[Dict[str, Any]] = None, target_stack: str = "react") -> Dict[str, Any]:
    await ctx.info(f"[architect] {intent[:80]}...")
    await ctx.report_progress(0, 100, "Analyzing intent...")
    architect = VibeArchitect(ctx=ctx)
    await ctx.report_progress(30, 100, "Generating decisions...")
    plan = await architect.plan(intent, constraints, context, target_stack)
    await ctx.report_progress(100, 100, "Complete!")
    return {
        "status": "success",
        "plan": {
            "intent": plan.intent,
            "decisions": [d.__dict__ for d in plan.decisions],
            "component_tree": plan.component_tree,
            "data_flow": plan.data_flow,
            "file_structure": plan.file_structure,
            "estimated_complexity": plan.estimated_complexity,
            "risks": plan.risks,
            "recommended_stack": plan.recommended_stack
        },
        "decision_count": len(plan.decisions),
        "risk_count": len(plan.risks)
    }

@mcp_server.tool(name="vibe_code", description="Generate production code from an architecture plan.")
async def vibe_code_tool(ctx, intent: str, plan: Dict[str, Any], constraints: Optional[List[str]] = None,
                          design_system: Optional[Dict[str, Any]] = None, target_language: str = "typescript") -> Dict[str, Any]:
    await ctx.info(f"[code] {intent[:80]}...")
    await ctx.report_progress(0, 100, "Parsing plan...")
    decisions = [ArchitectureDecision(**d) for d in plan.get("decisions", [])]
    vibe_plan = VibePlan(intent=intent, decisions=decisions,
        component_tree=plan.get("component_tree", []), data_flow=plan.get("data_flow", {}),
        file_structure=plan.get("file_structure", []), estimated_complexity=plan.get("estimated_complexity", "medium"),
        risks=plan.get("risks", []), recommended_stack=plan.get("recommended_stack", {}))
    await ctx.report_progress(20, 100, "Generating code...")
    implementer = VibeImplementer(design_system=design_system, ctx=ctx)
    files = await implementer.implement(vibe_plan, intent, constraints, target_language)
    await ctx.report_progress(90, 100, "Quality checks...")
    quality = VibeVerifier.verify_code_quality(files)
    await ctx.report_progress(100, 100, "Complete!")
    return {"status": "success", "files": [f.__dict__ for f in files], "file_count": len(files),
            "quality": quality, "total_lines": sum(len(f.content.split("\n")) for f in files)}

@mcp_server.tool(name="vibe_review", description="Multi-agent code review from three perspectives.")
async def vibe_review_tool(ctx, files: List[Dict[str, Any]], requirements: List[str]) -> Dict[str, Any]:
    await ctx.info(f"[review] {len(files)} files...")
    await ctx.report_progress(0, 100, "Initializing reviewers...")
    code_files = [CodeFile(**f) for f in files]
    reviewer = VibeCodeReviewer()
    await ctx.report_progress(30, 100, "Running parallel reviews...")
    result = await reviewer.review_code(code_files, requirements)
    await ctx.report_progress(100, 100, "Complete!")
    return {"status": "success", **result}

@mcp_server.tool(name="vibe_verify", description="Validate code/specs against WCAG, design system, and code quality.")
async def vibe_verify_tool(ctx, specification: Optional[Dict[str, Any]] = None,
                            files: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    await ctx.info("[verify] Running checks...")
    results = {}
    if specification:
        results["spec_validation"] = VibeVerifier.verify_spec(specification)
    if files:
        results["code_quality"] = VibeVerifier.verify_code_quality([CodeFile(**f) for f in files])
    await ctx.report_progress(100, 100, "Complete!")
    return {"status": "success", "results": results, "all_passed": all(r.get("valid", r.get("passed", True)) for r in results.values())}

@mcp_server.tool(name="vibe_iterate", description="Continuous improvement loop: critique -> repair -> verify -> repeat.")
async def vibe_iterate_tool(ctx, specification: Dict[str, Any], requirements: List[str],
                             max_iterations: int = 3, quality_threshold: float = 0.80) -> Dict[str, Any]:
    await ctx.info(f"[iterate] max {max_iterations} iterations")
    loop = CritiqueLoop(max_iterations=max_iterations, quality_threshold=quality_threshold)
    best_output, history = await loop.improve(specification, requirements, ctx)
    final_score = history[-1].score_after if history else 0
    return {"status": "success", "final_output": best_output,
            "iterations": [h.__dict__ for h in history], "iterations_used": len(history),
            "final_score": final_score, "converged": history[-1].passed if history else False,
            "score_improvement": round(final_score - (history[0].score_before if history else 0), 3)}

@mcp_server.tool(name="vibe_test", description="Generate comprehensive test suites from source code.")
async def vibe_test_tool(ctx, files: List[Dict[str, Any]], requirements: Optional[List[str]] = None,
                          test_framework: str = "vitest") -> Dict[str, Any]:
    await ctx.info(f"[test] Generating tests...")
    code_files = [CodeFile(**f) for f in files]
    tester = VibeTester(ctx=ctx)
    test_files = await tester.generate_tests(code_files, requirements, test_framework)
    quality = VibeVerifier.verify_code_quality(test_files)
    return {"status": "success", "test_files": [f.__dict__ for f in test_files],
            "test_count": len(test_files), "quality": quality, "framework": test_framework}

@mcp_server.tool(name="vibe_deploy", description="Generate deployment configs for Vercel, Docker, static hosting.")
async def vibe_deploy_tool(ctx, project_name: str, files: List[Dict[str, Any]],
                            targets: Optional[List[str]] = None) -> Dict[str, Any]:
    targets = targets or ["vercel"]
    code_files = [CodeFile(**f) for f in files]
    deployer = VibeDeployer(ctx=ctx)
    result = await deployer.generate_deploy(project_name, code_files, targets)
    return {"status": "success", "project": project_name, "targets": targets, **result}

@mcp_server.tool(name="vibe_design", description="Generate a landing page using curated DESIGN.md templates.")
async def vibe_design_tool(ctx, intent: str, template: Optional[str] = None,
                            constraints: Optional[List[str]] = None) -> Dict[str, Any]:
    constraints = constraints or ["WCAG AAA", "Single HTML file", "Zero fabrication"]
    design_tokens = TemplateLibrary.random_template(template)
    selected = template or "random"
    full_intent = f"{intent}\n\nUSE THIS DESIGN SYSTEM EXACTLY:\n{design_tokens}\n\nCRITICAL: Apply the design system above. No fabrication."
    plan_result = await vibe_architect_tool(ctx=ctx, intent=full_intent, constraints=constraints, target_stack="html")
    code_result = await vibe_code_tool(ctx=ctx, intent=intent, plan=plan_result.get("plan", {}),
                                        constraints=list(constraints) + [f"DESIGN SYSTEM: {design_tokens}"], target_language="html")
    verify_result = await vibe_verify_tool(ctx=ctx, files=code_result.get("files", []))
    return {"status": "success", "template": selected, "plan": plan_result, "code": code_result, "verify": verify_result}

@mcp_server.tool(name="vibe_preview", description="Generate a preview HTML page and Playwright test script.")
async def vibe_preview_tool(ctx, html_content: str, filename: str = "preview.html") -> Dict[str, Any]:
    script = PlaywrightBridge.generate_test_script(filename)
    return {"status": "success", "html_file": filename, "html_size": len(html_content), "playwright_test": script}

@mcp_server.tool(name="vibe_docs", description="Fetch documentation for a framework via Context7.")
async def vibe_docs_tool(ctx, query: str, library: Optional[str] = None) -> Dict[str, Any]:
    docs = await Context7Provider.fetch_docs(query, library)
    return {"status": "success", "query": query, "docs": docs, "docs_length": len(docs)}

@mcp_server.tool(name="vibe_health", description="System health stats.")
async def vibe_health_tool(ctx) -> Dict[str, Any]:
    from vibeserve.providers import router
    return {"status": "healthy", "providers_active": list(router.providers.keys()),
            "provider_count": len(router.providers), "memory_specs": memory_store.stats().get("total_stored_specs",0),
            "version": "2.0.0"}

@mcp_server.tool(name="vibe_audit", description="Full system audit: backend code quality, security, performance.")
async def vibe_audit_tool(ctx, files: List[Dict[str, Any]], requirements: Optional[List[str]] = None) -> Dict[str, Any]:
    requirements = requirements or ["Production-grade server", "No security vulnerabilities"]
    code_files = [CodeFile(**f) for f in files]
    auditor = SystemAuditor()
    result = await auditor.audit(code_files, requirements)
    return {"status": "success", **result}

@mcp_server.tool(name="vibe_compress", description="Compress JSON to TOON format — 30-60% token reduction.")
async def vibe_compress_tool(ctx, data: Dict[str, Any]) -> Dict[str, Any]:
    original = json.dumps(data)
    compressed = TOON.compress_json(data)
    savings = TOON.savings(original, compressed)
    return {"status": "success", "compressed": compressed, "savings": savings}

@mcp_server.tool(name="vibe_benchmark", description="Run a benchmarking loop with ASCII graphs.")
async def vibe_benchmark_tool(ctx, iterations: int = 5) -> Dict[str, Any]:
    results, scores = [], []
    for i in range(iterations):
        await ctx.report_progress(int((i / iterations) * 100), 100, f"Loop {i+1}/{iterations}")
        import time as _t
        t0 = _t.time()
        mock = [{"path": "vibeserve.py", "content": "# VibeServe MCP server\nimport asyncio\n", "language": "python", "purpose": "MCP server"}]
        auditor = SystemAuditor()
        audit = await auditor.audit([CodeFile(**m) for m in mock], ["Production-grade MCP server"])
        elapsed = (_t.time() - t0) * 1000
        score = audit["consensus_score"]
        scores.append(score)
        results.append({"iteration": i + 1, "score": score, "recommendation": audit["recommendation"], "time_ms": round(elapsed)})
    dashboard = Graphify.benchmark_summary(results)
    return {"status": "success", "iterations": results, "dashboard": dashboard,
            "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "best_score": max(scores) if scores else 0, "worst_score": min(scores) if scores else 0,
            "trend": "improving" if scores and scores[-1] > scores[0] else "declining" if scores and scores[-1] < scores[0] else "stable"}

@mcp_server.tool(name="vibe_upgrade_design", description="Upgrade a design template with senior-dev production patterns.")
async def vibe_upgrade_design_tool(ctx, template: Optional[str] = None) -> Dict[str, Any]:
    upgraded = DesignUpgrader.upgrade_file(template or "random")
    return {"status": "success", "template": template or "random", "upgraded_design": upgraded}

@mcp_server.tool(name="vibe_build_pro", description="Full professional build: upgrade design -> architect -> code -> verify.")
async def vibe_build_pro_tool(ctx, intent: str, template: Optional[str] = None,
                               constraints: Optional[List[str]] = None) -> Dict[str, Any]:
    constraints = constraints or ["WCAG AAA", "Single HTML", "Zero fabrication", "Responsive mobile-first"]
    upgraded = DesignUpgrader.upgrade_file(template or "supabase")
    full_intent = f"{intent}\nUSE THIS UPGRADED DESIGN SYSTEM:\n{upgraded}\nCRITICAL: Apply ALL production patterns. No fabrication."
    plan = await vibe_architect_tool(ctx=ctx, intent=full_intent, constraints=constraints, target_stack="html")
    code = await vibe_code_tool(ctx=ctx, intent=intent, plan=plan.get("plan", {}),
                                 constraints=constraints + [f"DESIGN SYSTEM: {upgraded}"], target_language="html")
    verify = await vibe_verify_tool(ctx=ctx, files=code.get("files", []))
    return {"status": "success", "template": template or "random", "plan": plan, "code": code, "verify": verify}

# ====================== INTEGRATION TOOLS ======================
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

# ====================== REGISTER V2.0 FEATURE TOOLS ======================
from vibeserve.feature_tools import register_feature_tools
register_feature_tools(mcp_server)

# ====================== DEMO FUNCTIONS ======================
async def demo():
    print("\n[v4] VibeServe Legacy -- Direct Execution Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    result = await generate_ui_spec_tool(ctx=ctx, page_type="product_dashboard",
        requirements=["SaaS dashboard", "Dark mode", "Mobile responsive"], use_cache=False)
    print(json.dumps({"status": result.get("status")}, indent=2))

async def vibe_demo():
    print("\n[v5] VibeServe Agentic Coding Demo")

    class MockCtx:
        async def info(self, msg): print(f"  [i] {msg}")
        async def report_progress(self, current, total, msg): print(f"  [{int(current/total*100):3d}%] {msg}")

    ctx = MockCtx()
    print("\n[Step 1] vibe_architect")
    plan_result = await vibe_architect_tool(ctx=ctx, intent="Build a SaaS analytics dashboard",
        constraints=["WCAG AAA", "React + TypeScript"], target_stack="react")
    if plan_result.get("status") == "success":
        print(f"  Plan: {plan_result['decision_count']} decisions")

def main():
    import sys
    if "--vibe-demo" in sys.argv:
        asyncio.run(vibe_demo())
    elif "--demo" in sys.argv:
        asyncio.run(demo())
    elif "--interactive" in sys.argv:
        asyncio.run(_interactive_loop())
    else:
        server = _LazyMCP.build()
        server.run()

async def _interactive_loop():
    print("\n  VibeServe v2.0 — Interactive Mode\n  Type 'help' for commands | 'exit' to quit")

    class MockCtx:
        async def info(self, msg): print(f"  {msg}")
        async def report_progress(self, c, t, m): print(f"  [{int(c/max(1,t)*100):3d}%] {m}")

    ctx = MockCtx()

    while True:
        try:
            raw = input("\n\033[1;36mvibeserve>\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break
        if not raw:
            continue
        parts = raw.split(maxsplit=1)
        cmd, rest = parts[0].lower(), parts[1] if len(parts) > 1 else ""
        try:
            if cmd in ("exit", "quit", "q"):
                print("Goodbye!")
                break
            elif cmd == "clone":
                r = await vibe_clone_tool(ctx, url=rest or "https://stripe.com")
                print(f"\n  Stack: {r.get('detected_stack')} | Colors: {r.get('raw_stats', {}).get('colors_found')}")
            elif cmd == "palette":
                r = await vibe_palette_tool(ctx, base_color=rest or "#5e6ad2")
                print(f"\n  {r.get('color_count')} colors | {r.get('vibe_statement')}")
            elif cmd == "multiverse":
                r = await vibe_multiverse_tool(ctx, intent=rest or "A login form")
                print(f"\n  Winner: {r.get('winner')} | Ran: {r.get('frameworks_run')} frameworks")
            elif cmd == "doctor":
                print("  Provide files via API (doctor requires file objects)")
            elif cmd == "search":
                r = await vibe_search_tool(ctx, query=rest or "dashboard")
                print(f"\n  Found {len(r.get('results', []))} results for '{rest}'")
            elif cmd == "git":
                print("  Usage: git <commit|branch|pr|changelog>")
            elif cmd == "i18n":
                print("  Usage: provide code via API (i18n requires source code)")
            elif cmd == "timemachine":
                r = await vibe_timemachine_tool(ctx, action="list")
                for s in r.get("snapshots", [])[:5]:
                    print(f"  [{s['short_id']}] {s['page_type']} — score {s['score']:.2f} @ {s['date']}")
            elif cmd in ("h", "help"):
                print("""
  V2.0 FEATURES
  clone <url>            Reverse-engineer any live site
  palette <#hex>         One color → full design system
  multiverse <intent>    Same UI in React/Vue/Svelte/HTML
  doctor                 Diagnose + auto-repair code (via API)
  search <query>         Natural-language search over memory
  git                    AI commits, PRs, changelogs (via API)
  i18n                   Auto-translate to 20 languages (via API)
  timemachine            Browse + restore spec history

  V1 PIPELINE
  architect / code / review / verify / iterate / test / deploy
  design / preview / benchmark / audit / health / memory
  exit""")
            else:
                print(f"  Unknown: '{cmd}'. Type 'help'.")
        except NameError as e:
            print(f"  [note] Tool not in interactive scope — use MCP client: {e}")
        except Exception as e:
            print(f"  \033[1;31mError: {e}\033[0m")

if __name__ == "__main__":
    main()

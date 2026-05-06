"""VibeServe v5 tools — full pipeline: architect, code, review, verify, iterate, test, deploy."""

import json
from typing import Any, Dict, List

from vibeserve.tools._tool_deps import (
    CodeFile, ArchitectureDecision, VibePlan,
    VibeArchitect, VibeImplementer, VibeVerifier, VibeCodeReviewer,
    SystemAuditor, CritiqueLoop, VibeTester, VibeDeployer,
    TemplateLibrary, DesignUpgrader, PlaywrightBridge,
    Context7Provider, TOON, Graphify, memory_store,
)
from vibeserve.server import mcp_server


@mcp_server.tool(name="vibe_architect", description="Transform natural language intent into a detailed architecture plan with ADR decisions.")
async def vibe_architect_tool(ctx, intent: str, constraints=None,
                               context=None, target_stack: str = "react") -> Dict[str, Any]:
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
async def vibe_code_tool(ctx, intent: str, plan: Dict[str, Any], constraints=None,
                          design_system=None, target_language: str = "typescript") -> Dict[str, Any]:
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
async def vibe_verify_tool(ctx, specification=None,
                            files=None) -> Dict[str, Any]:
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
async def vibe_test_tool(ctx, files: List[Dict[str, Any]], requirements=None,
                          test_framework: str = "vitest") -> Dict[str, Any]:
    await ctx.info("[test] Generating tests...")
    code_files = [CodeFile(**f) for f in files]
    tester = VibeTester(ctx=ctx)
    test_files = await tester.generate_tests(code_files, requirements, test_framework)
    quality = VibeVerifier.verify_code_quality(test_files)
    return {"status": "success", "test_files": [f.__dict__ for f in test_files],
            "test_count": len(test_files), "quality": quality, "framework": test_framework}

@mcp_server.tool(name="vibe_deploy", description="Generate deployment configs for Vercel, Docker, static hosting.")
async def vibe_deploy_tool(ctx, project_name: str, files: List[Dict[str, Any]],
                            targets=None) -> Dict[str, Any]:
    targets = targets or ["vercel"]
    code_files = [CodeFile(**f) for f in files]
    deployer = VibeDeployer(ctx=ctx)
    result = await deployer.generate_deploy(project_name, code_files, targets)
    return {"status": "success", "project": project_name, "targets": targets, **result}

@mcp_server.tool(name="vibe_design", description="Generate a landing page using curated DESIGN.md templates.")
async def vibe_design_tool(ctx, intent: str, template=None,
                            constraints=None) -> Dict[str, Any]:
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
async def vibe_docs_tool(ctx, query: str, library=None) -> Dict[str, Any]:
    docs = await Context7Provider.fetch_docs(query, library)
    return {"status": "success", "query": query, "docs": docs, "docs_length": len(docs)}

@mcp_server.tool(name="vibe_health", description="System health stats.")
async def vibe_health_tool(ctx) -> Dict[str, Any]:
    from vibeserve.providers import router
    return {"status": "healthy", "providers_active": list(router.providers.keys()),
            "provider_count": len(router.providers), "memory_specs": memory_store.stats().get("total_stored_specs",0),
            "version": "2.0.0"}

@mcp_server.tool(name="vibe_audit", description="Full system audit: backend code quality, security, performance.")
async def vibe_audit_tool(ctx, files: List[Dict[str, Any]], requirements=None) -> Dict[str, Any]:
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
async def vibe_upgrade_design_tool(ctx, template=None) -> Dict[str, Any]:
    upgraded = DesignUpgrader.upgrade_file(template or "random")
    return {"status": "success", "template": template or "random", "upgraded_design": upgraded}

@mcp_server.tool(name="vibe_build_pro", description="Full professional build: upgrade design -> architect -> code -> verify.")
async def vibe_build_pro_tool(ctx, intent: str, template=None,
                               constraints=None) -> Dict[str, Any]:
    constraints = constraints or ["WCAG AAA", "Single HTML", "Zero fabrication", "Responsive mobile-first"]
    upgraded = DesignUpgrader.upgrade_file(template or "supabase")
    full_intent = f"{intent}\nUSE THIS UPGRADED DESIGN SYSTEM:\n{upgraded}\nCRITICAL: Apply ALL production patterns. No fabrication."
    plan = await vibe_architect_tool(ctx=ctx, intent=full_intent, constraints=constraints, target_stack="html")
    code = await vibe_code_tool(ctx=ctx, intent=intent, plan=plan.get("plan", {}),
                                 constraints=constraints + [f"DESIGN SYSTEM: {upgraded}"], target_language="html")
    verify = await vibe_verify_tool(ctx=ctx, files=code.get("files", []))
    return {"status": "success", "template": template or "random", "plan": plan, "code": code, "verify": verify}

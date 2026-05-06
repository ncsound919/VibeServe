"""
VibeServe v2.0 — Feature Tool Registrations
Drop-in addition to vibeserve/__main__.py
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional


def register_feature_tools(mcp_server):
    """Register all v2.0 feature tools on the given FastMCP instance."""

    # ------------------------------------------------------------------ #
    # 1. vibe_clone — reverse-engineer any live URL into design + code    #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_clone",
        description=(
            "Reverse-engineer any live website URL into a full VibeServe design "
            "system + starter code.  Extracts colours, fonts, spacing, and JS stack "
            "automatically.  No API key needed for the URL fetch."
        ),
    )
    async def vibe_clone_tool(
        ctx,
        url: str,
    ) -> Dict[str, Any]:
        await ctx.info(f"[clone] Analysing {url}…")
        await ctx.report_progress(0, 100, "Fetching page…")
        from vibeserve.features import WebCloner
        await ctx.report_progress(30, 100, "Extracting design tokens…")
        result = await WebCloner.clone(url, ctx=ctx)
        await ctx.report_progress(100, 100, "Done!")
        return result

    # ------------------------------------------------------------------ #
    # 2. vibe_git — AI-generated commits, branch names, PRs, changelogs   #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_git",
        description=(
            "AI-powered git automation: smart-commit (AI writes the message from "
            "your diff), smart-branch (generates a kebab-case branch name from a "
            "description), create-pr (opens a GitHub PR with an AI-written body), "
            "or changelog (generates a semantic CHANGELOG section from git log).\n"
            "action: 'commit' | 'branch' | 'pr' | 'changelog'\n"
            "Requires: GITHUB_TOKEN + GITHUB_OWNER + GITHUB_REPO for PR creation."
        ),
    )
    async def vibe_git_tool(
        ctx,
        action: str,
        repo_path: str = ".",
        description: str = "",
        files: Optional[List[str]] = None,
        base_branch: str = "main",
        from_ref: str = "HEAD~10",
        to_ref: str = "HEAD",
    ) -> Dict[str, Any]:
        await ctx.info(f"[git] action={action}")
        from vibeserve.features import GitAgent
        if action == "commit":
            return await GitAgent.smart_commit(files=files, repo_path=repo_path, ctx=ctx)
        elif action == "branch":
            return await GitAgent.smart_branch(description or "new feature", ctx=ctx)
        elif action == "pr":
            return await GitAgent.create_pr(
                title=description or "Update",
                base_branch=base_branch,
                body_context=description,
                repo_path=repo_path,
                ctx=ctx,
            )
        elif action == "changelog":
            return await GitAgent.generate_changelog(
                from_ref=from_ref, to_ref=to_ref, repo_path=repo_path, ctx=ctx
            )
        else:
            return {"status": "error", "message": f"Unknown action '{action}'. Use commit|branch|pr|changelog"}

    # ------------------------------------------------------------------ #
    # 3. vibe_i18n — extract strings + translate to 20 languages          #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_i18n",
        description=(
            "Auto-internationalise any HTML, JSX, or TSX file in one call.\n"
            "Extracts all human-readable strings → translates to your chosen "
            "languages → returns JSON locale files + instrumented source code "
            "with i18n keys injected.\n"
            "Supported: en es fr de pt ja zh ko ar hi it ru nl pl sv tr vi id th uk"
        ),
    )
    async def vibe_i18n_tool(
        ctx,
        code: str,
        languages: Optional[List[str]] = None,
        source_lang: str = "en",
    ) -> Dict[str, Any]:
        langs = languages or ["es", "fr", "de", "ja", "zh"]
        await ctx.info(f"[i18n] Translating to {langs}…")
        await ctx.report_progress(0, 100, "Extracting strings…")
        from vibeserve.features import I18nEngine
        await ctx.report_progress(40, 100, "Translating…")
        result = await I18nEngine.translate(code, languages=langs, source_lang=source_lang, ctx=ctx)
        await ctx.report_progress(100, 100, "Done!")
        return result

    # ------------------------------------------------------------------ #
    # 4. vibe_diff — semantic diff between specs / code with ASCII art     #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_diff",
        description=(
            "Semantic diff between two specs, code strings, or JSON objects.\n"
            "Returns: change counts (add/remove/edit), an AI-written summary of "
            "what changed and WHY it matters, ASCII-art visualisation, and score delta."
        ),
    )
    async def vibe_diff_tool(
        ctx,
        before: Any,
        after: Any,
        score_before: Optional[float] = None,
        score_after: Optional[float] = None,
    ) -> Dict[str, Any]:
        await ctx.info("[diff] Comparing…")
        from vibeserve.features import DiffEngine
        result = await DiffEngine.diff(
            before, after,
            score_before=score_before,
            score_after=score_after,
            ctx=ctx,
        )
        await ctx.info(f"[diff] {result['total_changes']} changes found")
        return result

    # ------------------------------------------------------------------ #
    # 5. vibe_search — natural-language search over spec memory            #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_search",
        description=(
            "Natural-language semantic search over all specs stored in memory.\n"
            "Examples: 'dark dashboards with charts', 'login pages WCAG AAA', "
            "'latest landing pages generated this week'.\n"
            "No vector DB needed — works with the built-in SQLite store."
        ),
    )
    async def vibe_search_tool(
        ctx,
        query: str,
        limit: int = 5,
        page_type_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        await ctx.info(f"[search] '{query}'")
        from vibeserve.features import SemanticSearch
        result = await SemanticSearch.search(
            query=query,
            limit=limit,
            page_type_filter=page_type_filter,
            ctx=ctx,
        )
        return result

    # ------------------------------------------------------------------ #
    # 6. vibe_palette — one hex → full WCAG-AAA design system              #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_palette",
        description=(
            "Generate a complete, WCAG-AAA-validated design system from a single "
            "brand hex colour.  Uses colour theory (HSL harmonics, tints, shades, "
            "complementary / triadic) to produce 12 tokens + typography + spacing + "
            "shadows.  Every contrast pair is automatically validated."
        ),
    )
    async def vibe_palette_tool(
        ctx,
        base_color: str,
        style: str = "modern",
        brand_name: str = "Brand",
    ) -> Dict[str, Any]:
        await ctx.info(f"[palette] Generating from {base_color} ({style})…")
        from vibeserve.features import PaletteGenerator
        result = await PaletteGenerator.generate(
            base_color=base_color,
            style=style,
            brand_name=brand_name,
            ctx=ctx,
        )
        await ctx.info(f"[palette] {result.get('color_count', 0)} colours generated")
        return result

    # ------------------------------------------------------------------ #
    # 7. vibe_multiverse — same intent → 4 frameworks in parallel          #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_multiverse",
        description=(
            "Generate the same UI simultaneously in React, Vue, Svelte, and plain "
            "HTML (or any subset).  All run in parallel.  Returns all implementations "
            "plus a leaderboard scored on ARIA coverage, responsiveness, and line "
            "efficiency.  The winning framework is highlighted."
        ),
    )
    async def vibe_multiverse_tool(
        ctx,
        intent: str,
        frameworks: Optional[List[str]] = None,
        design_system: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        fws = frameworks or ["react", "vue", "svelte", "html"]
        await ctx.info(f"[multiverse] Generating in {fws} simultaneously…")
        await ctx.report_progress(0, 100, "Launching parallel universes…")
        from vibeserve.features import VibeMultiverse
        result = await VibeMultiverse.generate(
            intent=intent,
            frameworks=fws,
            design_system=design_system,
            ctx=ctx,
        )
        await ctx.report_progress(100, 100, f"Winner: {result.get('winner')}")
        return result

    # ------------------------------------------------------------------ #
    # 8. vibe_doctor — diagnose + auto-repair broken code                  #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_doctor",
        description=(
            "Scan code for 15 categories of real problems (XSS vectors, missing "
            "ARIA, console.log, TypeScript any, loose equality, inline handlers, "
            "etc.) then automatically generate targeted surgical repairs.\n"
            "Returns: health score 0-1, issue list with severity + line numbers, "
            "repaired files ready to use, and a prognosis."
        ),
    )
    async def vibe_doctor_tool(
        ctx,
        files: List[Dict[str, Any]],
        auto_repair: bool = True,
    ) -> Dict[str, Any]:
        await ctx.info(f"[doctor] Diagnosing {len(files)} files…")
        await ctx.report_progress(0, 100, "Running diagnostics…")
        from vibeserve.features import VibeDoctor
        result = await VibeDoctor.diagnose_and_repair(
            files=files,
            auto_repair=auto_repair,
            ctx=ctx,
        )
        await ctx.report_progress(100, 100, f"Health: {result.get('health_score')}")
        await ctx.info(f"[doctor] {result.get('prognosis')}")
        return result

    # ------------------------------------------------------------------ #
    # 9. vibe_live — wrap HTML in live-reload + generate dev server script  #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_live",
        description=(
            "Wrap generated HTML in a self-refreshing live-reload shell (no build "
            "tools needed) AND generate a zero-dependency Python dev server script "
            "that opens the page in your browser automatically.\n"
            "Perfect for demoing generated UIs instantly."
        ),
    )
    async def vibe_live_tool(
        ctx,
        html_content: str,
        filename: str = "index.html",
        port: int = 8080,
        refresh_ms: int = 2000,
    ) -> Dict[str, Any]:
        await ctx.info(f"[live] Wrapping {filename} with LiveReload ({refresh_ms}ms)…")
        from vibeserve.features import LiveReload
        wrapped   = LiveReload.wrap(html_content, refresh_ms=refresh_ms)
        dev_server = LiveReload.generate_dev_server(filename, port=port)
        return {
            "status":              "success",
            "filename":            filename,
            "live_html":           wrapped,
            "live_html_size":      len(wrapped),
            "dev_server_script":   dev_server,
            "instructions": (
                f"1. Save live_html to {filename}\n"
                f"2. Save dev_server_script to serve.py\n"
                f"3. Run: python serve.py\n"
                f"4. Browser opens at http://localhost:{port}\n"
                f"5. Edit {filename} → page auto-refreshes every {refresh_ms}ms"
            ),
        }

    # ------------------------------------------------------------------ #
    # 10. vibe_timemachine — browse + restore any prior spec version        #
    # ------------------------------------------------------------------ #
    @mcp_server.tool(
        name="vibe_timemachine",
        description=(
            "Browse the full history of every spec ever generated (stored in "
            "SQLite) and restore any version instantly.\n"
            "action: 'list' to see all snapshots | 'restore' to get a spec back.\n"
            "Use the short_id from list to restore."
        ),
    )
    async def vibe_timemachine_tool(
        ctx,
        action: str = "list",
        spec_id: Optional[str] = None,
        page_type: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        from vibeserve.features import VibeTimeMachine
        if action == "list":
            await ctx.info("[timemachine] Listing history…")
            return VibeTimeMachine.list_history(page_type=page_type, limit=limit)
        elif action == "restore":
            if not spec_id:
                return {"status": "error", "message": "Provide spec_id to restore"}
            await ctx.info(f"[timemachine] Restoring {spec_id}…")
            return VibeTimeMachine.restore(spec_id)
        else:
            return {"status": "error", "message": "action must be 'list' or 'restore'"}

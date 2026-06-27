# AUTO-GENERATED — do not edit manually

# VibeServe Tools Reference

Auto-generated API documentation for all 82 MCP tools.

## Tools by Category

### Agenda

- [agenda_activate_goal](agenda_activate_goal.md) — Mark a goal as active — agents will prioritize work against this goal.
- [agenda_add_goal](agenda_add_goal.md) — Add a single goal to the agenda with optional type, areas, due date and target metric.
- [agenda_add_initiative](agenda_add_initiative.md) — Add an initiative linked to a goal.
- [agenda_complete_goal](agenda_complete_goal.md) — Mark a goal as completed.
- [agenda_get_active_goals](agenda_get_active_goals.md) — Return all active agenda goals with full metadata.
- [agenda_get_impact](agenda_get_impact.md) — Get 7-day impact summary: suggestions applied per goal.
- [agenda_get_status](agenda_get_status.md) — Get current agenda: goals, progress per goal, recent entries.
- [agenda_log_entry](agenda_log_entry.md) — Log a work entry (PR, refactor, test) against an agenda goal.
- [agenda_set_goals](agenda_set_goals.md) — Define your business objectives, priorities, and constraints for VibeServe agents to work against.
### Assessment

- [vibe_benchmark](vibe_benchmark.md) — Run a benchmarking loop with ASCII graphs.
- [vibe_iterate](vibe_iterate.md) — Continuous improvement loop: critique -> repair -> verify -> repeat.
- [vibe_test](vibe_test.md) — Generate comprehensive test suites from source code.
### Code Generation

- [vibe_architect](vibe_architect.md) — Transform natural language intent into a detailed architecture plan with ADR decisions.
- [vibe_build_pro](vibe_build_pro.md) — Full professional build: upgrade design -> architect -> code -> verify.
- [vibe_code](vibe_code.md) — Generate production code from an architecture plan.
- [vibe_design](vibe_design.md) — Generate a landing page using curated DESIGN.md templates.
- [vibe_upgrade_design](vibe_upgrade_design.md) — Upgrade a design template with senior-dev production patterns.
- [vs_generate_artifact](vs_generate_artifact.md) — Generate a structured advisory artifact (not executable).
### Code Review

- [vibe_audit](vibe_audit.md) — Full system audit: backend code quality, security, performance.
- [vibe_review](vibe_review.md) — Multi-agent code review from three perspectives.
- [vibe_verify](vibe_verify.md) — Validate code/specs against WCAG, design system, and code quality.
- [vs_ecc_agent_shield](vs_ecc_agent_shield.md) — Run ECC AgentShield security scan on provided code content. Checks for secrets, permission risks, hook injection, MCP risks, and config issues.
- [vs_plan_review](vs_plan_review.md) — Review an execution plan and return structured critique.
### Core

- [editor_config](editor_config.md) — Generate editor config files (VSCode, Zed, Cursor).
- [generate_ui_spec](generate_ui_spec.md) — Generate a production-ready UI specification with multi-agent critique, WCAG AAA validation, and design system enforcement.
- [list_design_systems](list_design_systems.md) — List available design systems.
- [validate_ui_spec](validate_ui_spec.md) — Validate a UI specification against design system and WCAG standards.
- [vibe_compress](vibe_compress.md) — Compress JSON to TOON format — 30-60% token reduction.
- [vibe_health](vibe_health.md) — System health stats.
- [vs_ecc_health](vs_ecc_health.md) — Check ECC integration status — skills loaded, rules available.
- [vs_schema_validate](vs_schema_validate.md) — Validate JSON data against a JSON schema.
- [vs_validate_artifact](vs_validate_artifact.md) — Validate artifact shape and size constraints.
### Deployment

- [vibe_deploy](vibe_deploy.md) — Generate deployment configs for Vercel, Docker, static hosting.
- [vibe_preview](vibe_preview.md) — Generate a preview HTML page and Playwright test script.
### Documentation

- [vibe_docs](vibe_docs.md) — Fetch documentation for a framework via Context7.
### Integration

- [codegraph_build](codegraph_build.md) — Build a knowledge graph from an indexed repo — creates call graph, import resolution, class hierarchy, and communities. Prerequisite before using other codegraph_* tools.
- [codegraph_context](codegraph_context.md) — Get 360-degree view of a symbol — all incoming/outgoing calls, inheritance, imports, and cluster membership.
- [codegraph_impact](codegraph_impact.md) — Blast radius analysis — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring.
- [codegraph_query](codegraph_query.md) — Search the knowledge graph for symbols — returns callers, callees, file locations, and export status. Replaces grep for structural code questions.
- [codegraph_stats](codegraph_stats.md) — Get knowledge graph statistics — node count, edge count, clusters, edge type breakdown.
- [cross_repo_suggest](cross_repo_suggest.md) — Find reusable components/symbols from other repos that could help the current repo.
- [find_refactors](find_refactors.md) — Find refactor candidates: large files, duplicated symbols, dead code hints.
- [find_test_gaps](find_test_gaps.md) — Find source files and symbols that have no corresponding tests.
- [github_issues](github_issues.md) — List GitHub issues.
- [github_link_account](github_link_account.md) — Link a GitHub account via personal access token. Required before repo operations.
- [github_link_repo](github_link_repo.md) — Add a GitHub repo to VibeServe scope. Optionally clone it locally.
- [github_list_repos](github_list_repos.md) — List repositories for the linked GitHub account.
- [github_repo](github_repo.md) — Get GitHub repo info.
- [github_sync_all](github_sync_all.md) — Sync metadata for all linked repos — pulls latest data from GitHub API.
- [gitnexus_analyze](gitnexus_analyze.md) — Index a repository with GitNexus — builds a knowledge graph of symbols, call chains, clusters, and execution flows. Prerequisite before using other gitnexus_* tools.
- [gitnexus_context](gitnexus_context.md) — Get a 360-degree view of a symbol — all incoming/outgoing calls, imports, processes it belongs to. Like 'go to definition' but shows the full dependency web.
- [gitnexus_detect_changes](gitnexus_detect_changes.md) — Pre-commit impact analysis — maps changed lines to affected processes. Use before committing to understand what will break.
- [gitnexus_impact](gitnexus_impact.md) — Analyze blast radius — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring.
- [gitnexus_list_repos](gitnexus_list_repos.md) — List all repositories indexed by GitNexus (across your entire machine).
- [gitnexus_query](gitnexus_query.md) — Search the GitNexus knowledge graph — find symbols, processes, and definitions matching a query. Uses hybrid search (BM25 + semantic).
- [gitnexus_status](gitnexus_status.md) — Check GitNexus index status for the current repo — is it fresh, stale, or missing?.
- [gitnexus_wiki](gitnexus_wiki.md) — Generate a codebase wiki from the GitNexus knowledge graph — architecture docs with mermaid diagrams.
- [index_repo](index_repo.md) — Index a local repository — parses source files for symbols, components, tests, and dependencies.
- [list_indexed_repos](list_indexed_repos.md) — List all repos that have been indexed.
- [search_repo](search_repo.md) — Search indexed symbols across all repos, or within a specific repo.
- [supabase_insert](supabase_insert.md) — Insert a row into a Supabase table.
- [supabase_query](supabase_query.md) — Query a Supabase table.
- [vercel_deployments](vercel_deployments.md) — List recent Vercel deployments.
- [vs_ecc_skills_list](vs_ecc_skills_list.md) — List available ECC skills. Optionally filter by category or harness.
- [vs_opencode_execute](vs_opencode_execute.md) — Execute a coding task using the OpenCode CLI agent.
### Memory

- [memory_stats](memory_stats.md) — Get statistics on learned/stored UI specifications.
- [vs_memory_get](vs_memory_get.md) — Retrieve workspace-scoped memory entries for Mutly workflows.
- [vs_memory_store](vs_memory_store.md) — Store workspace-scoped memory for Mutly workflows.
### Pipeline

- [check_node_env](check_node_env.md) — Verify node.js environment.
- [detect_package_manager](detect_package_manager.md) — Detect which package manager to use (npm, yarn, pnpm).
- [generate_plan](generate_plan.md) — Generate a structured task decomposition for a given objective.
- [ingest_learning](ingest_learning.md) — Save pipeline results/learnings to the local wiki.
- [read_file](read_file.md) — Read content from a file in the workspace.
- [retrieve_context](retrieve_context.md) — Retrieve context from the local wiki/knowledge base.
- [run_biome](run_biome.md) — Run Biome linter/formatter.
- [run_build](run_build.md) — Run production build.
- [run_install](run_install.md) — Run package installation.
- [run_npm_audit](run_npm_audit.md) — Run npm audit for dependency security.
- [run_playwright](run_playwright.md) — Run Playwright E2E tests.
- [run_semgrep](run_semgrep.md) — Run Semgrep SAST scan on the project.
- [run_tsc](run_tsc.md) — Run TypeScript compiler check.
- [write_file](write_file.md) — Write content to a file in the workspace.

---

*Documentation generated from 82 tool definitions across 12 modules.*

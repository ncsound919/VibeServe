#!/usr/bin/env python3
"""VibeServe End-to-End Demo
Demonstrates: Agenda setting, repo indexing, cross-repo search, background suggestions.
"""

import asyncio
import json
import os
import sys

os.environ["LOCAL_LLM_MODEL"] = "llama3.2:1b"

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class MockCtx:
    async def info(self, msg):
        print(f"  [i] {msg}")

    async def report_progress(self, current, total, msg):
        pct = int(current / total * 100) if total else 0
        print(f"  [{pct:3d}%] {msg}")


async def demo():
    print("\n" + "=" * 60)
    print("  VibeServe — Business-Aware Development System")
    print("  End-to-End Demo")
    print("=" * 60)

    ctx = MockCtx()

    # Import tools (this registers them)
    from vibeserve.tools.agenda import (
        agenda_set_goals, agenda_add_goal, agenda_get_status,
        agenda_activate_goal, agenda_log_entry, agenda_complete_goal,
    )
    from vibeserve.tools.repo_indexer import (
        index_repo, search_repo, cross_repo_suggest,
        find_test_gaps, find_refactors, list_indexed_repos,
    )

    # 1. Set the agenda
    print("\n--- Step 1: Set the Agenda ---")
    result = await agenda_set_goals(ctx, goals=json.dumps([
        {
            "title": "Ship user authentication",
            "description": "Full OAuth2 flow with JWT, session management, and role-based access",
            "priority": 1,
            "timeline": "Q2 2026",
            "tags": ["auth", "security", "core"],
        },
        {
            "title": "Improve test coverage to 80%",
            "description": "Add unit tests for all core modules, E2E for critical paths",
            "priority": 2,
            "timeline": "Q2 2026",
            "tags": ["testing", "quality"],
        },
        {
            "title": "Reduce technical debt in orchestrator",
            "description": "Split large files, deduplicate symbols, add retry logic",
            "priority": 3,
            "timeline": "Q3 2026",
            "tags": ["refactor", "tech-debt"],
        },
    ]), constraints="Must maintain 100% test pass rate\nNo silent breaking changes\nAll PRs require human review")
    print(f"  Goals set: {result.get('goal_count', 0)}")

    result = await agenda_activate_goal(ctx, goal_id="")
    if result.get("status") != "ok":
        # Try with the first goal
        status = await agenda_get_status(ctx)
        goals = status.get("goals", [])
        if goals:
            result = await agenda_activate_goal(ctx, goal_id=goals[0]["id"])
            print(f"  Activated goal: {goals[0]['title']}")

    # 2. Index the VibeServe repo
    print("\n--- Step 2: Index the Current Repo ---")
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = await index_repo(ctx, repo_path=current_dir, repo_key="vibeserve", repo_name="VibeServe")
    print(f"  Files indexed: {result.get('file_count', 0)}")
    print(f"  Symbols found: {result.get('symbol_count', 0)}")
    print(f"  Test files:    {result.get('test_count', 0)}")

    # 3. Cross-repo search
    print("\n--- Step 3: Search Symbols ---")
    result = await search_repo(ctx, query="Agenda", repo_key="vibeserve")
    print(f"  Results for 'Agenda': {result.get('count', 0)}")
    for r in result.get("results", [])[:3]:
        print(f"    - {r['name']} ({r['kind']}) in {r['file_path']}")

    result = await search_repo(ctx, query="use", repo_key="vibeserve")
    print(f"  Results for 'use': {result.get('count', 0)}")

    # 4. Test gaps
    print("\n--- Step 4: Find Test Gaps ---")
    result = await find_test_gaps(ctx, repo_key="vibeserve")
    print(f"  Test gaps found: {result.get('count', 0)}")
    for g in result.get("gaps", [])[:3]:
        print(f"    - {g['symbol']} ({g['kind']}) in {g['file']}")

    # 5. Refactor targets
    print("\n--- Step 5: Find Refactor Targets ---")
    result = await find_refactors(ctx, repo_key="vibeserve")
    print(f"  Refactor targets: {result.get('count', 0)}")
    for r in result.get("targets", [])[:3]:
        print(f"    - {r.get('suggestion_type')}: {r.get('reasoning', '')[:80]}")

    # 6. Cross-repo reuse
    print("\n--- Step 6: Cross-Repo Suggestions ---")
    result = await cross_repo_suggest(ctx, source_repo="vibeserve")
    print(f"  Reuse suggestions: {result.get('count', 0)}")

    # 7. Log some work
    print("\n--- Step 7: Log Work Against Agenda ---")
    if goals:
        goal = goals[0]
        result = await agenda_log_entry(
            ctx,
            goal_id=goal["id"],
            action_type="pr",
            repo="vibeserve",
            description="Added WS auth to codenexus websocket server",
            branch="main",
        )
        print(f"  Logged entry: {result.get('status')}")

        result = await agenda_log_entry(
            ctx,
            goal_id=goals[1]["id"] if len(goals) > 1 else goal["id"],
            action_type="test",
            repo="vibeserve",
            description="105 tests passing, test gaps identified",
        )
        print(f"  Logged entry: {result.get('status')}")

    # 8. Progress report
    print("\n--- Step 8: Progress Report ---")
    result = await agenda_get_status(ctx)
    progress = result.get("progress", {})
    print(f"  Total entries: {progress.get('total_entries', 0)}")
    print(f"  Completed:     {progress.get('completed', 0)}")
    print(f"  In progress:   {progress.get('in_progress', 0)}")
    print(f"  Pending:       {progress.get('pending', 0)}")
    print(f"  Active goals:  {progress.get('active_goals', 0)}")

    # 9. List indexed repos
    print("\n--- Step 9: Indexed Repos ---")
    result = await list_indexed_repos(ctx)
    for r in result.get("repos", []):
        print(f"  - {r['repo_name']}: {r['file_count']} files, {r['symbol_count']} symbols")

    print("\n" + "=" * 60)
    print("  Demo Complete")
    print("=" * 60)
    print("""
  What was demonstrated:

  1. Agenda — Set 3 business goals with constraints
  2. Repo Indexing — Parsed Python/TS files for symbols
  3. Cross-Repo Search — Found components across repos
  4. Test Gaps — Identified untested symbols
  5. Refactor Targets — Found large files, duplicates
  6. Cross-Repo Reuse — Suggested shared components
  7. Work Logging — Tagged work against agenda items
  8. Progress Tracking — Per-goal completion metrics
  9. Repo Registry — Tracked all indexed repositories

  Next: Open the IDE, link GitHub accounts, and run:
    - index_repo for each linked repo
    - Background agents overnight for refactor suggestions
    - Agenda panel to track progress toward goals
""")


if __name__ == "__main__":
    asyncio.run(demo())

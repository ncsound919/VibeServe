"""Full-cycle E2E test: index → graph → agenda → architect → background tools."""
import asyncio
import os
from vibeserve.tools.repo_indexer import _cross_repo
from vibeserve.tools.code_graph import CodeGraph
from vibeserve.tools.agenda import Agenda
from vibeserve.tools.v5_tools import vibe_architect_tool
os.environ.setdefault("DEEPSEEK_API_KEY", "CHANGE_ME")
os.environ["PYTHONPATH"] = "."

REPO = r"C:\Users\User\Desktop\tap919-middleman-main"

print("=" * 60)
print("VIBESERVE FULL CYCLE TEST — Tap919 Middleman")
print("=" * 60)

# Step 1: Index
print("\n=== STEP 1: INDEX REPO ===")
ri = _cross_repo.index_repo(repo_path=REPO, repo_key="tap919", repo_name="Tap919 Middleman")
print(f"Indexed: {ri.file_count} files, {ri.symbol_count} symbols, {len(ri.test_files)} tests")
for s in ri.symbols[:15]:
    name = s.name[:60].encode('ascii', errors='replace').decode('ascii')
    print(f"  [{s.kind}] {name} @ {s.file_path}")

# Step 2: Build code graph
print("\n=== STEP 2: BUILD CODE GRAPH ===")
graph = CodeGraph()
graph.build_from_repo_index(ri)
stats = graph.stats()
print(f"Graph: {stats['nodes']} nodes, {stats['edges']} edges, {stats['clusters']} clusters")

# Step 3: Set agenda goals
print("\n=== STEP 3: SET AGENDA GOALS ===")
async def setup_agenda():
    a = Agenda()
    goals = await asyncio.gather(
        a.add_goal(
            title="Ship Tap919 Middleman MVP",
            description="Build the FastAPI middleman with metering, tracing, and Stripe billing",
            goal_type="feature",
            priority=1,
            areas=["tap919"],
            due_date="2026-06-15",
            effort="large",
            allow_bg_work=True,
        ),
        a.add_goal(
            title="API monetization pipeline",
            description="Usage-based billing, credit metering, provider adapters",
            goal_type="performance",
            priority=2,
            areas=["tap919"],
            due_date="2026-07-01",
            allow_bg_work=True,
        ),
        a.add_goal(
            title="Reliability and testing",
            description="Test coverage, error handling, monitoring, kill-switch",
            goal_type="reliability",
            priority=3,
            areas=["tap919"],
            due_date="2026-07-15",
            allow_bg_work=True,
        ),
    )
    for g in goals:
        await a.update_goal_status(g.id, "active")
        print(f"  Goal: {g.title} [{g.goal_type}] P{g.priority} due {g.due_date}")

    # Progress report
    report = await a.progress_report()
    print(f"\n  Active goals: {report['active_goals']}")

    return a

a = asyncio.run(setup_agenda())

# Step 4: Run background analysis tools
print("\n=== STEP 4: BACKGROUND TOOLS ===")
print("  find_test_gaps:")
gaps = _cross_repo.find_test_gaps(repo_key="tap919")
print(f"    Found: {len(gaps)} gaps")
for g in gaps[:3]:
    print(f"    - {g.get('symbol','?')} in {g.get('file','?')}")

print("  find_refactors:")
ref = _cross_repo.find_refactor_targets(repo_key="tap919")
print(f"    Found: {len(ref)} refactor targets")
for r in ref[:3]:
    print(f"    - {r.get('suggestion_type','?')}: {r.get('reasoning','?')[:80]}")

print("  cross_repo_suggest:")
cross = _cross_repo.cross_repo_suggestions(source_repo="tap919")
print(f"    Found: {len(cross)} cross-repo suggestions")

# Step 5: Graph queries
print("\n=== STEP 5: GRAPH QUERIES ===")
if stats['nodes'] > 0:
    q = graph.query("middleman")
    print(f"  Query 'middleman': {q['count']} matches")
    for m in q['results'][:5]:
        name = m['name'][:40].encode('ascii','replace').decode()
        print(f"    [{m['kind']}] {name} @ {m['file_path']}")

    ctx = graph.context("Middleman")
    if ctx.symbol:
        print(f"\n  Context 'Middleman': {ctx.symbol['kind']} @ {ctx.symbol['file_path']}:{ctx.symbol['line']}")
        print(f"    Incoming calls: {len(ctx.incoming_calls)}, Outgoing: {len(ctx.outgoing_calls)}")
        print(f"    Clusters: {len(ctx.processes)}")

print("\n" + "=" * 60)
print("FULL CYCLE COMPLETE")
print("=" * 60)

# Step 6: Run vibe_architect with DeepSeek
print("\n=== STEP 6: VIBE_ARCHITECT (DeepSeek) ===")
print("  Generating architecture plan...")

class MockCtx:
    async def info(self, msg): pass
    async def report_progress(self, cur, total, msg): pass

async def architect():
    result = await vibe_architect_tool(
        ctx=MockCtx(),
        intent="Build Tap919 Middleman: API monetization gateway between AI agents and LLM providers. Usage-based billing (Stripe), request metering, provider adapters (OpenAI/Anthropic/DeepSeek), kill-switch, Cloudflare Worker storefront, FastAPI backend.",
        constraints=["Production-ready", "Observable (tracing)", "Multi-tenant", "Rate limiting"],
        target_stack="python"
    )
    plan = result.get("plan", {})
    decisions = plan.get("decisions", [])
    print(f"  ADRs generated: {len(decisions)}")
    for d in decisions:
        name = d.get('title','?').encode('ascii','replace').decode()
        print(f"    [{d.get('id','?')}] {name} (confidence: {d.get('confidence',0)})")
    print(f"  Decision count: {result.get('decision_count',0)}")
    print(f"  Risk count: {result.get('risk_count',0)}")
    return result

architect_result = asyncio.run(architect())

print("\n" + "=" * 60)
print("ALL 6 STAGES COMPLETE")
print("=" * 60)

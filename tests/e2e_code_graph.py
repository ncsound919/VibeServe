"""E2E test for native code graph."""
import os
os.environ["PYTHONPATH"] = "."

from vibeserve.tools.repo_indexer import _cross_repo
from vibeserve.tools.code_graph import CodeGraph

# Index the repo
print("Indexing...")
ri = _cross_repo.index_repo(repo_path=".", repo_key="vibeserve", repo_name="VibeServe")
print(f"Indexed: {ri.file_count} files, {ri.symbol_count} symbols, {len(ri.test_files)} tests")

# Build graph
print("Building graph...")
graph = CodeGraph()
graph.build_from_repo_index(ri)
stats = graph.stats()
print(f"Graph: {stats['nodes']} nodes, {stats['edges']} edges, {stats['clusters']} clusters")
print(f"Edge kinds: {stats['edge_kinds']}")

# Query
res = graph.query("agenda")
print(f"\nQuery 'agenda': {res['count']} matches")
for m in res["results"][:5]:
    print(f"  {m['kind']}: {m['name']} ({m['callers']} callers, {m['callees']} callees) in {m['file_path']}")

# Context
ctx = graph.context("Agenda")
print(f"\nContext 'Agenda': {len(ctx.incoming_calls)} incoming calls, {len(ctx.outgoing_calls)} outgoing, {len(ctx.processes)} clusters")
if ctx.symbol:
    print(f"  Symbol: {ctx.symbol['kind']} in {ctx.symbol['file_path']}:{ctx.symbol['line']}")

# Impact
impact = graph.impact("Agenda", direction="upstream", max_depth=2)
print(f"\nImpact 'Agenda' (upstream): {impact.total_affected} affected across {len(impact.levels)} depth levels")
for lvl in impact.levels[:2]:
    print(f"  Depth {lvl['depth']} ({lvl['label']}): {lvl['count']} symbols")
    for s in lvl["symbols"][:3]:
        print(f"    - {s['kind']}: {s['name']} @ {s['file_path']}:{s['line']}")

# Impact downstream
impact_down = graph.impact("Agenda", direction="downstream", max_depth=2)
print(f"\nImpact 'Agenda' (downstream): {impact_down.total_affected} affected across {len(impact_down.levels)} depth levels")

# Query for heavily-connected nodes
res2 = graph.query("index")
print(f"\nQuery 'index': {res2['count']} matches")

print("\n=== ALL CODE GRAPH E2E TESTS PASSED ===")

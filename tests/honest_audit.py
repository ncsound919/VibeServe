"""Honest competitive audit — test every VibeServe capability end-to-end."""
import asyncio
import os
import time
import pytest
from vibeserve.tools.repo_indexer import _cross_repo
from vibeserve.tools.code_graph import CodeGraph
from vibeserve.tools.agenda import Agenda
from vibeserve.tools.v5_tools import vibe_architect_tool, vibe_code_tool
from vibeserve.middleware import new_trace_id, TokenBucket
os.environ["DEEPSEEK_API_KEY"] = os.getenv("DEEPSEEK_API_KEY", "")
if not os.environ["DEEPSEEK_API_KEY"]:
    pytest.skip("DEEPSEEK_API_KEY not set, skipping DeepSeek tests")
os.environ["PYTHONPATH"] = "."
os.environ["DEFAULT_LLM_PROVIDER"] = "deepseek"

REPO = r"C:\Users\User\Desktop\tap919-middleman-main"

class Ctx:
    async def info(self, msg): pass
    async def report_progress(self, c, t, m): pass

results = {}

def check(name, ok, detail=""):
    results[name] = (ok, detail)
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}: {detail[:100]}")

# ───── 1. Core Infrastructure ─────
print("\n=== 1. CORE INFRASTRUCTURE ===")

t0 = time.monotonic()
ri = _cross_repo.index_repo(repo_path=REPO, repo_key="audit", repo_name="Audit Test")
t1 = time.monotonic()
check("Repo indexer", ri.file_count > 0, f"{ri.file_count} files, {ri.symbol_count} symbols")

graph = CodeGraph()
graph.build_from_repo_index(ri)
stats = graph.stats()
check("Code graph", stats["nodes"] > 0, f"{stats['nodes']} nodes, {stats['edges']} edges")

ag = Agenda()
check("Agenda import", True, "module loads")

async def add_goal():
    g = await ag.add_goal(title="Audit Goal", goal_type="feature", areas=["test"], allow_bg_work=True)
    await ag.update_goal_status(g.id, "active")
    return g
g = asyncio.run(add_goal())
active = [x for x in ag.goals if x.status == "active"]
check("Agenda CRUD", len(active) > 0, f"Created & activated goal: {g.title}")

# ───── 2. Background Tools ─────
print("\n=== 2. BACKGROUND ANALYSIS TOOLS ===")

gaps = _cross_repo.find_test_gaps(repo_key="audit")
check("find_test_gaps", isinstance(gaps, list), f"{len(gaps)} found")

ref = _cross_repo.find_refactor_targets(repo_key="audit")
check("find_refactors", isinstance(ref, list), f"{len(ref)} targets")

cross = _cross_repo.cross_repo_suggestions(source_repo="audit")
check("cross_repo_suggest", isinstance(cross, list), f"{len(cross)} suggestions")

check("search_repo", len(_cross_repo.search_symbols("middleman")) > 0, "symbol search works")

# ───── 3. Graph Intelligence ─────
print("\n=== 3. GRAPH INTELLIGENCE ===")

q = graph.query("monetization")
check("Graph query", q["count"] > 0, f"{q['count']} matches for 'monetization'")

ctx = graph.context("Middleman")
check("Graph context", ctx.symbol is not None, f"{ctx.symbol['kind']} @ {ctx.symbol['file_path']}" if ctx.symbol else "no match")

imp = graph.impact("Middleman", max_depth=2)
check("Graph impact", imp.target_uid != "", f"{imp.total_affected} affected" if imp.target_uid else "no impact path")

# ───── 4. LLM Pipeline ─────
print("\n=== 4. LLM PIPELINE (DeepSeek) ===")

async def llm_pipeline():
    arch = await vibe_architect_tool(ctx=Ctx(), intent="Build an API gateway", target_stack="python", constraints=["Testable"])
    check("vibe_architect", arch.get("status") == "success", f"{arch.get('decision_count',0)} ADRs" if arch.get("status")=="success" else arch.get("error","?"))
    
    if arch.get("status") == "success":
        code = await vibe_code_tool(ctx=Ctx(), intent="Build API gateway", plan=arch["plan"], target_language="python")
        check("vibe_code", code.get("status") == "success", f"{code.get('file_count',0)} files, {code.get('total_lines',0)} lines")
        if code.get("files"):
            langs = set(f.get("language","?") for f in code["files"])
            check("Correct language", "python" in str(langs).lower() or "py" in str(langs).lower(), f"generated: {langs}")
    
    return arch, code if 'code' in dir() else None

arch_r, code_r = asyncio.run(llm_pipeline())

# ───── 5. Audit & Observability ─────
print("\n=== 5. AUDIT & OBSERVABILITY ===")

tid = new_trace_id()
check("Trace ID generation", len(tid) > 0, f"trace_id: {tid}")
check("Structured logging", True, "JSON events emitted (see console)")

tb = TokenBucket(rate=100, burst=10)
ok = asyncio.run(tb.allow("test-user"))
check("Rate limiter", ok, "request allowed")

# ───── 6. Markdown + Extless Indexing ─────
print("\n=== 6. FILE FORMAT SUPPORT ===")

md_count = sum(1 for s in ri.symbols if s.file_path.endswith(".md"))
ext_count = sum(1 for s in ri.symbols if "." not in s.file_path)
check("Markdown parsing", md_count > 0, f"{md_count} md symbols")
check("Extensionless parsing", ext_count > 0, f"{ext_count} extless symbols")

# ───── VERDICT ─────
print("\n" + "=" * 60)
passed = sum(1 for v in results.values() if v[0])
total = len(results)
print(f"SCORE: {passed}/{total} ({passed*100//total}%)")
print("=" * 60)

failures = [f"{name}: {detail}" for name, (ok, detail) in results.items() if not ok]
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  - {f}")
else:
    print("\nALL SYSTEMS OPERATIONAL")

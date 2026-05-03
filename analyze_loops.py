#!/usr/bin/env python3
"""Multi-iteration improvement loop — finds trends, insights, optimization targets."""
import asyncio, json, sys, os, time
sys.path.insert(0, '.')
from vibeserve import (
    vibe_benchmark_tool, vibe_audit_tool, Graphify, TOON,
    AsyncProfiler
)

class Ctx:
    async def info(self, msg): p = msg[:120]; print(f"  [i] {p}" if len(msg)<=120 else f"  [i] {p}...")
    async def report_progress(self, c, t, m): 
        if c in (0, 50, 100): print(f"  [{c}%] {m}")

async def analyze_insights(results: list) -> dict:
    """Extract trends, patterns, and upgrade recommendations from benchmark data."""
    insights = {}
    
    scores = [r.get("score", 0) for r in results]
    times = [r.get("time_ms", 0)/1000 for r in results]
    issues = [r.get("issues", 0) for r in results]
    
    # Trend analysis
    if len(scores) >= 3:
        first_half = sum(scores[:len(scores)//2]) / (len(scores)//2)
        second_half = sum(scores[len(scores)//2:]) / (len(scores) - len(scores)//2)
        insights["score_trend"] = "improving" if second_half > first_half else "declining" if second_half < first_half else "stable"
        insights["score_delta"] = round(second_half - first_half, 3)
    
    # Time efficiency
    if times:
        insights["total_time"] = round(sum(times), 1)
        insights["avg_time_per_loop"] = round(sum(times)/len(times), 2)
        insights["time_trend"] = "faster" if len(times) > 1 and times[-1] < times[0] else "slower" if times[-1] > times[0] else "stable"
    
    # Issue patterns
    insights["total_issues"] = sum(issues)
    insights["avg_issues_per_loop"] = round(sum(issues)/len(issues), 1)
    
    # Recommendations
    recs = []
    if insights.get("score_trend") == "declining":
        recs.append("Scores declining — review prompt quality, may need stronger constraints")
    if insights.get("time_trend") == "slower":
        recs.append("Loop time increasing — check for resource leaks or growing state")
    if max(scores) - min(scores) > 0.15:
        recs.append("High score variance — add deterministic scoring criteria")
    if sum(issues) > 20:
        recs.append(f"High issue count ({sum(issues)}) — prioritize fixes by severity")
    
    # Efficiency potential
    if times:
        best_time = min(times)
        worst_time = max(times)
        if worst_time > best_time * 1.5:
            recs.append(f"Time variance: {best_time:.1f}s → {worst_time:.1f}s — check network/LLM variability")
    
    insights["recommendations"] = recs if recs else ["System performing within expected range"]
    
    return insights

async def main():
    ctx = Ctx()
    print("=" * 65)
    print("  VibeServe Multi-Loop Improvement Analysis")
    print("=" * 65)
    
    # Phase 1: Baseline benchmark
    print("\n--- Phase 1: Baseline (5 iterations) ---")
    t0 = time.time()
    result = await vibe_benchmark_tool(ctx=ctx, iterations=5)
    total_time = time.time() - t0
    
    print(result["dashboard"])
    
    # Phase 2: Analyze trends
    print("\n--- Phase 2: Trend Analysis ---")
    insights = await analyze_insights(result["iterations"])
    
    print(f"  Score trend:      {insights['score_trend']} ({insights.get('score_delta', 0):+.3f})")
    print(f"  Time trend:       {insights.get('time_trend', 'N/A')} (avg {insights['avg_time_per_loop']}s/loop)")
    print(f"  Total issues:     {insights['total_issues']} ({insights['avg_issues_per_loop']}/loop)")
    print(f"  Total duration:   {insights['total_time']}s")
    
    # Phase 3: Efficiency analysis
    print("\n--- Phase 3: Efficiency Analysis ---")
    
    # TOON compression savings (simulated from benchmark data)
    large_payload = {"status":"success","iterations":result["iterations"],"insights":insights}
    orig = json.dumps(large_payload)
    comp = TOON.compress_json(large_payload)
    savings = TOON.savings(orig, comp)
    print(f"  TOON compression: {savings['percent']}% token reduction ({savings['original_tokens']} -> {savings['compressed_tokens']} tokens)")
    
    # Profiler stats
    stats = AsyncProfiler.stats()
    if stats:
        print(f"  Profiler traces:  {len(stats)} operations tracked")
        for name, s in stats.items():
            print(f"    {name}: {s['count']} calls, avg {s['avg']}s, max {s['max']}s")
    else:
        print("  Profiler: no traces recorded (add @ProfilerProvider.profile_async to critical paths)")
    
    # Phase 4: Recommendations
    print("\n--- Phase 4: Upgrade Recommendations ---")
    for i, rec in enumerate(insights["recommendations"], 1):
        print(f"  {i}. {rec}")
    
    # Summary score card
    print("\n" + "=" * 65)
    print(f"  Final Score:     {insights['score_trend']} ({insights.get('score_delta', 0):+.3f})")
    print(f"  Efficiency Gain: {savings['percent']}% via TOON compression")
    print(f"  Loops Tested:    5 | Issues Found: {insights['total_issues']}")
    print("=" * 65)
    
    # Save report
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "iterations": result["iterations"],
        "insights": insights,
        "compression_savings_percent": savings["percent"],
        "profiler_stats": stats
    }
    with open("loop_analysis.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\nReport saved: loop_analysis.json")

asyncio.run(main())

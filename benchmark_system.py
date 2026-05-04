#!/usr/bin/env python3
"""
VibeNexus Trinity Benchmark System
Unified self-improvement benchmarking across all 3 components:
  - VibeServe  (Python MCP Server)
  - CodeNexus  (Node.js Orchestrator Control Plane)
  - Nexus-Alpha (React IDE Frontend)
"""

import asyncio, json, sys, os, time, re, subprocess, shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

ROOT = Path(__file__).parent.parent  # VibeNexus/
VIBESERVE_ROOT = ROOT / "VibeServe"
CODENEXUS_ROOT = ROOT / "CodeNexus"
NEXUS_ALPHA_ROOT = ROOT / "Nexus-Alpha-main"

# ─── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class BenchmarkMetric:
    name: str
    score: float  # 0-100
    raw: Any = None
    detail: str = ""
    severity: str = "info"  # info | warning | critical

@dataclass
class BenchmarkCategory:
    name: str
    weight: float
    metrics: List[BenchmarkMetric] = field(default_factory=list)

    @property
    def score(self) -> float:
        if not self.metrics:
            return 0
        return sum(m.score for m in self.metrics) / len(self.metrics)

@dataclass
class ComponentReport:
    name: str
    categories: List[BenchmarkCategory] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)

    @property
    def overall(self) -> float:
        if not self.categories:
            return 0
        total_w = sum(c.weight for c in self.categories)
        return sum(c.score * c.weight for c in self.categories) / max(1, total_w)

# ─── VibeServe Benchmarks ─────────────────────────────────────────────────────

def bench_vibeserve() -> ComponentReport:
    report = ComponentReport("VibeServe (Python MCP)")
    cwd = str(VIBESERVE_ROOT)
    metrics_perf = []

    # Import time
    t0 = time.time()
    try:
        result = subprocess.run(
            [sys.executable, "-c", "import sys; sys.path.insert(0,'src'); import vibeserve"],
            capture_output=True, text=True, timeout=15, cwd=cwd
        )
        import_time = time.time() - t0
        score = max(0, 100 - import_time * 80)
        metrics_perf.append(BenchmarkMetric("Import time", score, round(import_time, 3),
            f"{import_time:.3f}s", "critical" if score < 60 else "info"))
    except Exception as e:
        metrics_perf.append(BenchmarkMetric("Import time", 0, None, str(e), "critical"))

    # Test suite
    t0 = time.time()
    try:
        r = subprocess.run([sys.executable, "-m", "pytest", "tests/", "-q", "--tb=no"],
                           capture_output=True, text=True, timeout=90, cwd=cwd)
        test_time = time.time() - t0
        m = re.search(r"(\d+) passed", r.stdout + r.stderr)
        passed = int(m.group(1)) if m else 0
        score = min(100, passed * 2.5)
        metrics_perf.append(BenchmarkMetric("Test suite", score, passed,
            f"{passed} tests in {test_time:.1f}s", "warning" if score < 80 else "info"))
    except Exception as e:
        metrics_perf.append(BenchmarkMetric("Test suite", 0, None, str(e), "critical"))

    report.categories.append(BenchmarkCategory("Performance", 25, metrics_perf))

    # Code quality
    metrics_quality = []
    src_files = list(VIBESERVE_ROOT.glob("vibeserve/**/*.py"))
    total_lines = 0
    total_try = 0
    total_types = 0
    total_docs = 0
    for f in src_files:
        code = f.read_text(errors="ignore")
        total_lines += len(code.splitlines())
        total_try += len(re.findall(r"except ", code))
        total_types += len(re.findall(r"->\s*\w+|:\s*\w+\s*=", code))
        total_docs += len(re.findall(r'"""', code)) // 2

    err_score = min(100, total_try * 2.5)
    type_score = min(100, total_types / max(1, total_lines) * 2000)
    doc_score = min(100, total_docs * 1.5)

    metrics_quality.append(BenchmarkMetric("Error handling", err_score, total_try,
        f"{total_try} try/except blocks", "warning" if err_score < 60 else "info"))
    metrics_quality.append(BenchmarkMetric("Type coverage", type_score, total_types,
        f"{total_types} type annotations", "warning" if type_score < 60 else "info"))
    metrics_quality.append(BenchmarkMetric("Documentation", doc_score, total_docs,
        f"{total_docs} docstrings", "info"))

    # Detect sqlite3 blocking (from audit findings)
    sqlite_blocking = any("import sqlite3" in f.read_text(errors="ignore") and
                          "aiosqlite" not in f.read_text(errors="ignore")
                          for f in src_files)
    metrics_quality.append(BenchmarkMetric("Async DB", 0 if sqlite_blocking else 100,
        not sqlite_blocking,
        "CRITICAL: sqlite3 blocks event loop — migrate to aiosqlite" if sqlite_blocking else "OK",
        "critical" if sqlite_blocking else "info"))

    report.categories.append(BenchmarkCategory("Code Quality", 25, metrics_quality))

    # Security
    metrics_sec = []
    all_code = "\n".join(f.read_text(errors="ignore") for f in src_files)
    keys = len(re.findall(r'sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9]{35}', all_code))
    san = len(re.findall(r"sanitize|escape|strip_|parameterize", all_code, re.IGNORECASE))
    log_err = len(re.findall(r"log\.(warning|error|exception|critical)", all_code))
    sql_param = len(re.findall(r"execute\(.*\?.*,|executemany|await conn\.execute\(", all_code))

    metrics_sec.append(BenchmarkMetric("Hardcoded secrets", 100 if keys == 0 else max(0, 100 - keys * 30),
        keys, f"{keys} found (0=good)", "critical" if keys > 0 else "info"))
    metrics_sec.append(BenchmarkMetric("Input sanitization", min(100, san * 20), san,
        f"{san} sanitization patterns", "critical" if san < 2 else "info"))
    metrics_sec.append(BenchmarkMetric("Error logging", min(100, log_err * 2), log_err,
        f"{log_err} logged error points", "warning" if log_err < 20 else "info"))
    metrics_sec.append(BenchmarkMetric("Parameterized SQL", min(100, sql_param * 25), sql_param,
        f"{sql_param} parameterized queries", "critical" if sql_param == 0 else "info"))

    report.categories.append(BenchmarkCategory("Security", 25, metrics_sec))

    # Feature completeness
    metrics_feat = []
    mcp_tools = len(re.findall(r"@mcp_server\.tool\(|@app\.tool\(", all_code))
    metrics_feat.append(BenchmarkMetric("MCP tools", min(100, mcp_tools * 3.5), mcp_tools,
        f"{mcp_tools} registered tools"))
    async_funcs = len(re.findall(r"^async def ", all_code, re.MULTILINE))
    sync_funcs = len(re.findall(r"^def ", all_code, re.MULTILINE))
    async_ratio = (async_funcs / max(1, async_funcs + sync_funcs)) * 100
    metrics_feat.append(BenchmarkMetric("Async coverage", async_ratio, async_funcs,
        f"{async_funcs} async / {sync_funcs} sync", "warning" if async_ratio < 60 else "info"))

    report.categories.append(BenchmarkCategory("Features", 25, metrics_feat))

    # Collect weaknesses
    for cat in report.categories:
        for m in cat.metrics:
            if m.score < 60 or m.severity in ("warning", "critical"):
                report.weaknesses.append(f"[{cat.name}] {m.name}: {m.detail}")

    return report


# ─── CodeNexus Benchmarks ─────────────────────────────────────────────────────

def bench_codenexus() -> ComponentReport:
    report = ComponentReport("CodeNexus (Node.js Orchestrator)")
    cwd = str(CODENEXUS_ROOT)

    # TypeScript compilation
    metrics_build = []
    t0 = time.time()
    try:
        r = subprocess.run(["npx", "tsc", "--noEmit", "--project", "tsconfig.json"],
                           capture_output=True, text=True, timeout=60, cwd=cwd, shell=True)
        build_time = time.time() - t0
        errors = len(re.findall(r"error TS\d+", r.stdout + r.stderr))
        score = max(0, 100 - errors * 10)
        metrics_build.append(BenchmarkMetric("TypeScript errors", score, errors,
            f"{errors} TS errors in {build_time:.1f}s", "critical" if errors > 0 else "info"))
    except Exception as e:
        metrics_build.append(BenchmarkMetric("TypeScript errors", 0, None, str(e)[:80], "critical"))

    # Module coverage: check each module has its adapter
    required_modules = ["agent-runtime", "analytics", "auth-service", "control-plane",
                        "design-reviewer", "knowledge-engine", "security", "pr-manager"]
    missing = [m for m in required_modules if not (CODENEXUS_ROOT / m).exists()]
    score = max(0, 100 - len(missing) * 12.5)
    metrics_build.append(BenchmarkMetric("Module completeness", score, len(required_modules) - len(missing),
        f"{len(required_modules) - len(missing)}/{len(required_modules)} modules present",
        "warning" if missing else "info"))

    report.categories.append(BenchmarkCategory("Build Health", 33, metrics_build))

    # Orchestrator quality
    orch_file = CODENEXUS_ROOT / "control-plane" / "src" / "orchestrator.ts"
    metrics_orch = []
    if orch_file.exists():
        code = orch_file.read_text(errors="ignore")
        steps = len(re.findall(r"ReviewStep\.\w+", code))
        retries = len(re.findall(r"retry|MAX_RETRIES", code, re.IGNORECASE))
        broadcasts = len(re.findall(r"broadcastTrajectoryEvent", code))
        abort_checks = len(re.findall(r"signal\?\.aborted|AbortSignal", code))
        concurrent_limit = len(re.findall(r"CONCURRENT_REVIEW_LIMIT", code))

        metrics_orch.append(BenchmarkMetric("Review steps", min(100, steps * 5), steps,
            f"{steps} ReviewStep references"))
        metrics_orch.append(BenchmarkMetric("Retry logic", min(100, retries * 20), retries,
            f"{retries} retry patterns"))
        metrics_orch.append(BenchmarkMetric("Trajectory broadcasts", min(100, broadcasts * 25), broadcasts,
            f"{broadcasts} broadcastTrajectoryEvent calls", "warning" if broadcasts < 2 else "info"))
        metrics_orch.append(BenchmarkMetric("Concurrency control", 100 if concurrent_limit else 0,
            bool(concurrent_limit), "CONCURRENT_REVIEW_LIMIT present" if concurrent_limit else "Missing"))

    report.categories.append(BenchmarkCategory("Orchestrator Quality", 33, metrics_orch))

    # Security posture
    src_files = list(CODENEXUS_ROOT.rglob("*.ts"))
    all_code = "\n".join(f.read_text(errors="ignore") for f in src_files if "node_modules" not in str(f))
    metrics_sec = []
    secret_scans = len(re.findall(r"Claw.Protect|secrets.*scan|entropy.*scan", all_code, re.IGNORECASE))
    input_val = len(re.findall(r"zod|yup|joi|\.parse\(|\.safeParse\(", all_code))
    audit_logs = len(re.findall(r"logAuditEvent|recordEvent|audit", all_code, re.IGNORECASE))

    metrics_sec.append(BenchmarkMetric("Secret scanning", min(100, secret_scans * 20), secret_scans,
        f"{secret_scans} secret scan references", "warning" if secret_scans < 3 else "info"))
    metrics_sec.append(BenchmarkMetric("Input validation (Zod)", min(100, input_val * 5), input_val,
        f"{input_val} Zod usages", "warning" if input_val < 10 else "info"))
    metrics_sec.append(BenchmarkMetric("Audit logging", min(100, audit_logs / 10), audit_logs,
        f"{audit_logs} audit log calls"))

    report.categories.append(BenchmarkCategory("Security", 34, metrics_sec))

    for cat in report.categories:
        for m in cat.metrics:
            if m.score < 60 or m.severity in ("warning", "critical"):
                report.weaknesses.append(f"[{cat.name}] {m.name}: {m.detail}")

    return report


# ─── Nexus-Alpha Benchmarks ───────────────────────────────────────────────────

def bench_nexus_alpha() -> ComponentReport:
    report = ComponentReport("Nexus-Alpha (React IDE)")
    src_files = list(NEXUS_ALPHA_ROOT.rglob("*.tsx")) + list(NEXUS_ALPHA_ROOT.rglob("*.ts"))
    src_files = [f for f in src_files if "node_modules" not in str(f) and "dist" not in str(f)]
    all_code = "\n".join(f.read_text(errors="ignore") for f in src_files)

    # Bundle health
    metrics_bundle = []
    pkg = json.loads((NEXUS_ALPHA_ROOT / "package.json").read_text())
    deps = len(pkg.get("dependencies", {}))
    dev_deps = len(pkg.get("devDependencies", {}))
    dep_score = max(0, 100 - (deps - 30) * 2)
    metrics_bundle.append(BenchmarkMetric("Dependency count", dep_score, deps,
        f"{deps} runtime deps", "warning" if deps > 40 else "info"))

    # Error boundaries
    err_boundaries = len(re.findall(r"ErrorBoundary|componentDidCatch|getDerivedStateFromError", all_code))
    metrics_bundle.append(BenchmarkMetric("Error boundaries", min(100, err_boundaries * 25), err_boundaries,
        f"{err_boundaries} error boundaries", "warning" if err_boundaries < 2 else "info"))

    # Lazy loading (code splitting)
    lazy = len(re.findall(r"React\.lazy|import\(|lazy\(\(", all_code))
    metrics_bundle.append(BenchmarkMetric("Code splitting", min(100, lazy * 5), lazy,
        f"{lazy} lazy imports"))

    report.categories.append(BenchmarkCategory("Bundle Health", 33, metrics_bundle))

    # Component quality
    metrics_comp = []
    ts_errors = len(re.findall(r"as any|@ts-ignore|@ts-nocheck", all_code))
    memo_usage = len(re.findall(r"React\.memo|useMemo|useCallback", all_code))
    ws_usage = len(re.findall(r"WebSocket|useWebSocket", all_code))
    trajectory_integration = "TrajectorySidebar" in all_code

    ts_score = max(0, 100 - ts_errors * 2)
    metrics_comp.append(BenchmarkMetric("TypeScript strictness", ts_score, ts_errors,
        f"{ts_errors} `as any` / @ts-ignore occurrences", "warning" if ts_errors > 10 else "info"))
    metrics_comp.append(BenchmarkMetric("Memoization", min(100, memo_usage * 5), memo_usage,
        f"{memo_usage} memo/callback usages"))
    metrics_comp.append(BenchmarkMetric("WebSocket integration", min(100, ws_usage * 20), ws_usage,
        f"{ws_usage} WebSocket usages"))
    metrics_comp.append(BenchmarkMetric("Trajectory sidebar", 100 if trajectory_integration else 0,
        trajectory_integration, "Integrated" if trajectory_integration else "MISSING — add TrajectorySidebar",
        "critical" if not trajectory_integration else "info"))

    report.categories.append(BenchmarkCategory("Component Quality", 33, metrics_comp))

    # Accessibility
    metrics_a11y = []
    aria = len(re.findall(r'aria-\w+|role="|alt="', all_code))
    focus_mgmt = len(re.findall(r"focus\(\)|autoFocus|tabIndex", all_code))
    metrics_a11y.append(BenchmarkMetric("ARIA attributes", min(100, aria * 0.5), aria,
        f"{aria} aria/role/alt attributes"))
    metrics_a11y.append(BenchmarkMetric("Focus management", min(100, focus_mgmt * 10), focus_mgmt,
        f"{focus_mgmt} focus usages", "warning" if focus_mgmt < 3 else "info"))

    report.categories.append(BenchmarkCategory("Accessibility", 34, metrics_a11y))

    for cat in report.categories:
        for m in cat.metrics:
            if m.score < 60 or m.severity in ("warning", "critical"):
                report.weaknesses.append(f"[{cat.name}] {m.name}: {m.detail}")

    return report


# ─── Render ───────────────────────────────────────────────────────────────────

GRADE = [(90,"S*"), (80,"A"), (70,"B"), (60,"C"), (50,"D"), (0,"F")]

def grade(score: float) -> str:
    for threshold, letter in GRADE:
        if score >= threshold:
            return letter
    return "F"

def render_full_report(reports: List[ComponentReport]) -> str:
    W = 72
    lines = ["", "=" * W,
             "  VibeNexus Trinity -- System-Wide Benchmark Report",
             "=" * W, ""]

    for report in reports:
        hdr = f"  +-- {report.name} "
        lines.append(hdr + "-" * max(2, W - len(hdr) - 1) + "+")
        for cat in report.categories:
            bar = "#" * int(cat.score / 5) + "." * (20 - int(cat.score / 5))
            lines.append(f"  |  {cat.name:<28} [{bar}] {cat.score:>5.1f}  {grade(cat.score)}")
            for m in cat.metrics:
                sev = "[!!]" if m.severity == "critical" else ("[! ]" if m.severity == "warning" else "[ok]")
                lines.append(f"  |    {sev} {m.name:<32} {m.score:>5.0f}")
        lines.append(f"  |")
        lines.append(f"  |  OVERALL: {report.overall:>5.1f}/100  [{grade(report.overall)}]")
        lines.append(f"  +" + "-" * (W - 3) + "+")
        if report.weaknesses:
            lines.append(f"  >> Weaknesses requiring remediation:")
            for w in report.weaknesses[:5]:
                lines.append(f"     * {w}")
        lines.append("")

    avg = sum(r.overall for r in reports) / len(reports)
    lines += ["-" * W, f"  SYSTEM OVERALL: {avg:.1f}/100  [{grade(avg)}]", "=" * W, ""]
    return "\n".join(lines)


def save_results(reports: List[ComponentReport]):
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    payload = {
        "timestamp": ts,
        "system_overall": round(sum(r.overall for r in reports) / len(reports), 1),
        "components": {
            r.name: {
                "overall": round(r.overall, 1),
                "grade": grade(r.overall),
                "weaknesses": r.weaknesses,
                "categories": {
                    cat.name: {
                        "score": round(cat.score, 1),
                        "metrics": [{"name": m.name, "score": round(m.score, 1),
                                     "detail": m.detail, "severity": m.severity}
                                    for m in cat.metrics]
                    }
                    for cat in r.categories
                }
            }
            for r in reports
        }
    }
    out = VIBESERVE_ROOT / "trinity_benchmark_results.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"\n  Results saved -> {out}")
    return payload


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print("\n  Running VibeNexus Trinity Benchmark System...\n")
    reports = [
        bench_vibeserve(),
        bench_codenexus(),
        bench_nexus_alpha(),
    ]
    print(render_full_report(reports))
    save_results(reports)


if __name__ == "__main__":
    main()

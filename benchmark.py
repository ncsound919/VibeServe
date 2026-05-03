#!/usr/bin/env python3
"""VibeServe Comprehensive Benchmark System.
Measures 8 dimensions with multiple sub-metrics per category."""

import asyncio, json, sys, os, time, re, subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

@dataclass
class BenchmarkMetric:
    name: str
    score: float  # 0-100
    raw: Any = None
    detail: str = ""

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

def measure_performance() -> List[BenchmarkMetric]:
    """Test execution speed, import time, response parsing"""
    results = []
    
    # Import time
    t0 = time.time()
    import vibeserve
    import_time = time.time() - t0
    results.append(BenchmarkMetric("Import time", 
        max(0, 100 - import_time * 100), round(import_time, 3),
        f"{import_time:.3f}s (lower is better)"))

    # Test execution speed  
    t0 = time.time()
    proc = subprocess.run([sys.executable, "-m", "pytest", "test_aether_nexus.py", "-q"],
                         capture_output=True, text=True, timeout=60)
    test_time = time.time() - t0
    # Parse test count
    passed = 0
    m = re.search(r"(\d+) passed", proc.stdout + proc.stderr)
    if m: passed = int(m.group(1))
    results.append(BenchmarkMetric("Test execution", 
        min(100, passed * 2.5), test_time,
        f"{passed} tests in {test_time:.1f}s"))

    # TOON compression efficiency
    from vibeserve import TOON
    large_data = {"status":"success","files":[{"path":f"/src/file{i}.tsx","content":"x"*200} for i in range(20)]}
    orig = json.dumps(large_data)
    comp = TOON.compress_json(large_data)
    savings = TOON.savings(orig, comp)
    results.append(BenchmarkMetric("TOON compression", 
        min(100, savings["percent"] * 2), savings,
        f"{savings['percent']}% token reduction"))

    # Provider count
    from vibeserve import router
    results.append(BenchmarkMetric("LLM providers", 
        len(router.providers) * 20, len(router.providers),
        f"{list(router.providers.keys())}"))

    return results


def measure_code_quality() -> List[BenchmarkMetric]:
    """Code size, test coverage, lint-like checks"""
    results = []
    
    code = Path("vibeserve.py").read_text()
    lines = len(code.splitlines())
    chars = len(code)
    
    # Size metrics
    results.append(BenchmarkMetric("Code size", 
        min(100, 100 - (lines / 100)), lines,
        f"{lines} lines, {chars} chars"))

    # Function count
    funcs = len(re.findall(r"^(async )?def \w+", code, re.MULTILINE))
    results.append(BenchmarkMetric("Functions", 
        min(100, funcs * 0.8), funcs,
        f"{funcs} callable functions"))

    # Class count
    classes = len(re.findall(r"^class \w+", code, re.MULTILINE))
    results.append(BenchmarkMetric("Classes", 
        min(100, classes * 5), classes,
        f"{classes} classes"))

    # Docstring coverage
    doc_funcs = len(re.findall(r"^\s+\"\"\"", code, re.MULTILINE))
    results.append(BenchmarkMetric("Docstrings", 
        min(100, doc_funcs * 2), doc_funcs,
        f"{doc_funcs} docstrings found"))

    # Exception handling
    try_excepts = len(re.findall(r"except ", code))
    results.append(BenchmarkMetric("Error handling", 
        min(100, try_excepts * 2), try_excepts,
        f"{try_excepts} try/except blocks"))

    return results


def measure_security() -> List[BenchmarkMetric]:
    """Security posture assessment"""
    results = []
    code = Path("vibeserve.py").read_text()
    
    # No hardcoded keys
    secrets = len(re.findall(r'sk-[a-zA-Z0-9]{20,}', code))
    results.append(BenchmarkMetric("Hardcoded keys", 
        100 if secrets == 0 else max(0, 100 - secrets * 50), secrets,
        f"{secrets} hardcoded API keys found (0=good)"))

    # Input sanitization
    sanitizers = len(re.findall(r"sani[tz]|escape|strip_", code, re.IGNORECASE))
    results.append(BenchmarkMetric("Input sanitization", 
        min(100, sanitizers * 25), sanitizers,
        f"{sanitizers} sanitization functions"))

    # Logging of errors
    log_errors = len(re.findall(r"log\.(warning|error|exception)", code))
    results.append(BenchmarkMetric("Error logging", 
        min(100, log_errors), log_errors,
        f"{log_errors} logged error points"))

    # .gitignore check
    if Path(".gitignore").exists():
        gitignore = Path(".gitignore").read_text()
        env_ignored = ".env" in gitignore
        results.append(BenchmarkMetric("Git hygiene", 
            100 if env_ignored else 50, env_ignored,
            ".env in .gitignore" if env_ignored else "Missing .env in .gitignore"))
    else:
        results.append(BenchmarkMetric("Git hygiene", 0, False, "No .gitignore found"))

    return results


def measure_features() -> List[BenchmarkMetric]:
    """Feature completeness assessment"""
    results = []
    code = Path("vibeserve.py").read_text()
    
    # MCP tools
    tools = len(re.findall(r"@mcp_server\.tool\(", code))
    results.append(BenchmarkMetric("MCP tools", 
        min(100, tools * 5), tools,
        f"{tools} registered tools"))

    # MCP resources
    resources = len(re.findall(r"@mcp_server\.resource\(", code))
    results.append(BenchmarkMetric("MCP resources", 
        min(100, resources * 20), resources,
        f"{resources} registered resources"))

    # MCP prompts  
    prompts = len(re.findall(r"@mcp_server\.prompt\(\)", code))
    results.append(BenchmarkMetric("MCP prompts", 
        min(100, prompts * 15), prompts,
        f"{prompts} registered prompts"))

    # Design templates
    templates = len(list(Path("designs").glob("*.md"))) if Path("designs").exists() else 0
    results.append(BenchmarkMetric("Design templates", 
        min(100, templates * 20), templates,
        f"{templates} DESIGN.md templates"))

    # LLM providers
    from vibeserve import router
    results.append(BenchmarkMetric("Provider count", 
        len(router.providers) * 20, len(router.providers),
        str(list(router.providers.keys()))))

    return results


def measure_schema_compliance() -> List[BenchmarkMetric]:
    """WCAG, validation, and schema compliance"""
    results = []
    
    from vibeserve import SchemaValidator, WCAGLevel, validate_wcag_contrast, DEFAULT_DESIGN_SYSTEM
    
    # WCAG validation accuracy
    aaa = validate_wcag_contrast("#EEEEEE", "#0A0A0A", WCAGLevel.AAA)
    aa = validate_wcag_contrast("#AAAAAA", "#111111", WCAGLevel.AA)
    
    results.append(BenchmarkMetric("WCAG AAA detection", 
        100 if aaa.passes_aaa else 0, aaa.ratio,
        f"White on dark: {aaa.ratio}:1 (AAA={'pass' if aaa.passes_aaa else 'fail'})"))
    
    results.append(BenchmarkMetric("WCAG AA detection", 
        100 if aa.passes_aa else 0, aa.ratio,
        f"Gray on dark: {aa.ratio}:1 (AA={'pass' if aa.passes_aa else 'fail'})"))

    # Schema validation
    validator = SchemaValidator()
    valid_spec = {"version":"1.0","metadata":{"id":"t","name":"t"},"design_system":DEFAULT_DESIGN_SYSTEM,"layouts":[],"components":[]}
    valid, errors = validator.validate_schema(valid_spec)
    results.append(BenchmarkMetric("Schema validation", 
        100 if valid else max(0, 100 - len(errors)*20), len(errors),
        f"{'Pass' if valid else f'{len(errors)} errors'}: {errors[:2]}"))

    return results


def render_dashboard(categories: List[BenchmarkCategory]) -> str:
    """Render full benchmark dashboard in ASCII."""
    width = 65
    lines = [
        "",
        "=" * width,
        "  VibeServe v1.3 Comprehensive Benchmark",
        "=" * width,
        "",
        f"  {'Category':<25} {'Score':>8} {'Weight':>8} {'Weighted':>10}",
        f"  {'-'*25} {'-'*8} {'-'*8} {'-'*10}",
    ]
    
    total_weighted = 0
    total_weight = 0
    
    for cat in categories:
        weighted = cat.score * cat.weight
        total_weighted += weighted
        total_weight += cat.weight
        bar = "#" * int(cat.score / 10)
        lines.append(f"  {cat.name:<25} {bar:<8} {cat.score:>5.0f}/{100:<3} {cat.weight:>4}%   {weighted:>6.1f}")
        
        # Sub-metrics
        for m in cat.metrics:
            sub_bar = "#" * int(m.score / 20)
            lines.append(f"    {sub_bar:<2} {m.name:<35} {m.score:>5.0f}")
    
    lines.append(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*10}")
    overall = round(total_weighted / max(1, total_weight), 1)
    lines.append(f"  {'OVERALL':<25} {'#'*int(overall/2):<8} {overall:>5.1f}/{100:<3} {'100%':>4}   {overall:>6.1f}")
    lines.append("=" * width)
    
    return "\n".join(lines)


def main():
    print("\nRunning VibeServe Comprehensive Benchmark...")
    
    categories = [
        BenchmarkCategory("Performance", 20, measure_performance()),
        BenchmarkCategory("Code Quality", 20, measure_code_quality()),
        BenchmarkCategory("Security", 20, measure_security()),
        BenchmarkCategory("Features", 20, measure_features()),
        BenchmarkCategory("Schema Compliance", 20, measure_schema_compliance()),
    ]
    
    dashboard = render_dashboard(categories)
    print(dashboard)
    
    # Save results
    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "categories": {
            cat.name: {
                "score": round(cat.score, 1),
                "weight": cat.weight,
                "metrics": [{"name": m.name, "score": round(m.score, 1), "detail": m.detail} for m in cat.metrics]
            }
            for cat in categories
        },
        "overall": round(sum(c.score * c.weight for c in categories) / sum(c.weight for c in categories), 1)
    }
    
    with open("benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to benchmark_results.json")
    print(f"Overall score: {results['overall']}/100")
    return results

if __name__ == "__main__":
    main()

# Nexus Intelligence Loop — Autonomous MCP Development & Benchmarking Spec

**Date:** 2026-06-01  
**Status:** Draft / Proposed  
**Scope:** Recursive self-improving MCP builder, baseline & continuous benchmarking suite, trend/pattern abstraction engine, local registry promotion.

---

## Overview

The **Nexus Intelligence Loop** is an edge-native, proactive self-improvement engine built into VibeServe. By coupling deep codebase analysis with ongoing performance benchmarks (using the **Math X** suite as a reference testbed), the system automatically detects capability gaps, repetitive code blocks, and integration friction. It then autonomously architect-designs, implements, verifies, and registers new specialized Model Context Protocol (MCP) tools to resolve them, logging every optimization milestone in a self-learning wiki.

### Goals
- Establish an autonomous, proactive loop that continuously runs benchmarks to find performance/abstraction gaps.
- Leverage **Math X** (local Pyodide, WASM, bioinformatics, DuckDB analytics) as a benchmark target to evaluate complex multi-domain reasoning and tool performance.
- Use codebase indexers to discover and abstract repetitive/unoptimized blocks into structured, reusable MCP tools.
- Auto-verify generated tools via multi-agent validation and promote them safely to the local registries (`glama.json` / `smithery.json`).
- Feed execution results and performance histories back into VibeServe's RAG system for continuous learning.

---

## Section 1: The Core Loop Architecture

The loop executes as a background daemon or a triggered CLI pipeline, following a four-stage cyclic pipeline:

```
          ┌─────────────────────────────────────────────────────────┐
          │               Stage 1: Benchmark Baseline               │
          │  - Run Math X reasoning / computation benchmark tests   │
          │  - Generate multi-dimensional performance capability    │
          └────────────────────────────┬────────────────────────────┘
                                       │
                                       ▼
          ┌─────────────────────────────────────────────────────────┐
          │        Stage 2: Trend & Abstraction Analysis            │
          │  - Parse repositories with repo_indexer                 │
          │  - Extract pattern clusters & repeat blocks             │
          │  - Define needed tools to abstract these gaps           │
          └────────────────────────────┬────────────────────────────┘
                                       │
                                       ▼
          ┌─────────────────────────────────────────────────────────┐
          │             Stage 3: Autonomous Development             │
          │  - Scaffold new MCP tool decorators using FastMCP       │
          │  - Run multi-perspective review & edge-case checks      │
          │  - Execute unit & E2E verification suites               │
          └────────────────────────────┬────────────────────────────┘
                                       │
                                       ▼
          ┌─────────────────────────────────────────────────────────┐
          │              Stage 4: Logging & Upgrade                 │
          │  - Update uploads/nexus/benchmark-snapshots.json        │
          │  - Generate markdown wiki progress reports              │
          │  - Register tool in glama.json & local runtime          │
          └────────────────────────────┬────────────────────────────┘
                                       ▲
                                       │ (Recursive Loop Trigger)
                                       └────────────────────────────┘
```

### 1.1 Trigger Modalities
- **Proactive Cron / idle trigger:** Executes when workspace activity is low to scan and optimize.
- **Post-Commit Hook:** Executes on git push or pull-request open, verifying that no regression occurred and suggesting optimizations.
- **Manual Command:** Prompting VibeServe to `run_mcp_improvement_loop` from the CLI or UI.

---

## Section 2: Benchmarking Suite & Math X Integration

The system hooks directly into **Math X** as its primary target. Since Math X combines local Pyodide workers, DuckDB analytics, and heavy symbolic math, it serves as a rigorous testing suite for evaluating tool invocation speed, token overhead, and logical accuracy.

### 2.1 Benchmark Metrics Schema
Every run evaluates four distinct axes, logged inside `uploads/nexus/benchmarks.json`:

| Axis | Metric | Unit | Target |
|---|---|---|---|
| **Latency** | End-to-end execution of complex math prompts | ms | < 1200ms per step |
| **Token Cost** | Input/Output token usage via TOON compression check | Tokens | > 35% reduction |
| **Accuracy** | Correct mathematical derivations verified via local SymPy | Score | 100% |
| **Reliability** | Successful error-free tool execution rate | Rate | 100% |

### 2.2 Storage Specification (`uploads/nexus/benchmark-snapshots.json`)

```json
{
  "timestamp": "2026-06-01T12:00:00Z",
  "baseline_commit": "a1b2c3d4",
  "system_stats": {
    "node_version": "v20.x",
    "python_version": "3.12.x",
    "cpu_count": 8
  },
  "metrics": {
    "symbolic_derivation_speed": 450,
    "vectorized_monte_carlo_latency": 890,
    "mcp_overhead_ms": 12,
    "compaction_ratio": 0.42
  },
  "improvements_applied": [
    {
      "tool_name": "vibe_math_matrix_solver",
      "reason": "Optimize NumPy matrix calculation overhead in Pyodide",
      "latency_delta_ms": -120
    }
  ]
}
```

---

## Section 3: Abstraction & Synthesis Engine

The system uses `repo_indexer` and `cross_repo_suggest` to inspect the targeted project's AST (Abstract Syntax Tree) and index files, compiling repeat patterns.

### 3.1 Gaps Identification Logic
1. **Redundancy Threshold:** Finds functions/utility blocks with a cosine similarity > 0.85 across different packages/apps.
2. **Context Bloat:** Identifies prompt paths or system parameters consuming more than 40% of the active context window.
3. **Friction Hotspots:** Scans error logs (`uploads/nexus/errors.json`) to find frequently failing file/API interactions.

### 3.2 Abstraction Generation Specs
When a gap is found, VibeServe creates a "Synthesis Plan":
- **Definition:** The name, parameters, return types, and docstrings for a potential new tool.
- **Placement:** Decides whether the tool should reside in `vibeserve/tools/` or as an external modular server.
- **RAG Hook:** Saves tool descriptions back to the local wiki so indexers can immediately expose it during the next generation step.

---

## Section 4: Autonomous Tool Generation & Promotion

Once the Synthesis Plan is ready, the system delegates implementation to a secure worker agent.

### 4.1 FastMCP Decorator Structure
Tools are implemented in Python, adhering to the FastMCP / VibeServe standard:

```python
from vibeserve.server import mcp_server
from vibeserve.utils import require_scope
import pydantic

class MatrixSolverArgs(pydantic.BaseModel):
    matrix_a: list[list[float]]
    matrix_b: list[list[float]]
    operation: str

@mcp_server.tool(name="vibe_math_matrix_solver", description="Execute optimized matrix operations locally using NumPy WASM backend.")
@require_scope("mcp:write")
async def solve_matrix(args: MatrixSolverArgs) -> dict:
    # Autonomous implementation goes here
    pass
```

### 4.2 Multi-Agent Verification Gate (vibe_verify)
Before any code is integrated:
1. **Lint & Type Check:** Run `run_biome` and `run_tsc` (or Python equivalents `ruff` / `mypy` depending on the language).
2. **Unit Test Generation:** `vibe_test` writes tests in `tests/test_v5_tools.py` targeting the new tool's input validators.
3. **Isolation Sandbox Test:** The server boots the new tool on an isolated socket to verify registration under `glama.json` and `smithery.json` without bricking the parent server.

---

## Section 5: Logging, Upgrades & Self-Learning

Every loop execution records history to the system wiki (`uploads/wiki/pages/`) to feed the active RAG database.

### 5.1 Self-Learning Wiki Log Template (`ncsound919-math-x-1777496211567.md`)
```markdown
# Autonomous Tool Upgrade Report

- **Tool Name:** `vibe_math_matrix_solver`
- **Discovered From:** `apps/web/src/components/ProbabilityLab.tsx`
- **Optimization Reason:** Repeated local vector calculations causing high UI context overhead.
- **Before Latency:** 2450ms
- **After Latency:** 320ms (WASM-offloaded)
- **Status:** Promoted to Registry (Active)

## Learned Constraints
- Matrix size must be sanitized before passing to NumPy to avoid worker heap exhaustion.
- Floating-point calculations require rounding down to 6 decimals to maintain parity with KaTeX outputs.
```

### 5.2 Dynamic Context Ingestion
Upon successful registration, the newly generated tool schemas are dynamically added to the LLM agent system prompts. The next prompt execution automatically utilizes the new tool, establishing a recursive self-improvement capability across all connected apps.

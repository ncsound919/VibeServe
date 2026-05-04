<div align="center">

<img src="https://github.com/ncsound919/VibeServe/blob/main/generated-image%20(8).png?raw=true" alt="VibeServe" width="100%" />

# VibeServe v2.0
### *The Ultimate Agentic IDE, Orchestrator, and MCP Backend*

[![CI](https://github.com/ncsound919/VibeServe/actions/workflows/ci.yml/badge.svg)](https://github.com/ncsound919/VibeServe/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/vibeserve.svg?color=00FF9F)](https://pypi.org/project/vibeserve/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://python.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-00FF9F.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Benchmark](https://img.shields.io/badge/Trinity_Benchmark-83.7%2F100-00FF9F.svg)](#benchmark)

</div>

---

## What is VibeServe?

**VibeServe** is the first full-stack, fully-integrated AI development platform. It unifies a **React-based AI IDE**, a **Node.js Orchestrator**, and a **Python MCP Server** into a single cohesive system. 

It transforms natural language intent into fully-architected, accessible, production-ready UI code — powered by a **7-step agentic pipeline**, a fully aware context engine, and dynamic human-in-the-loop controls.

```
🏗️ architect → 💻 code → 🔍 review → ✅ verify → 🔄 iterate → 🧪 test → 🚀 deploy
```

---

## Unified Repository Structure

This repository is a monorepo housing the three core pillars of the VibeServe ecosystem:

### 1. `ide/` (The Front-End Client)
The **VibeServe IDE** (formerly Nexus-Alpha) is a Vite/React application acting as the command center. It features an interactive command palette, real-time agent trajectories, code editors, artifact previews, and full MCP tool visibility. It's fully WCAG AAA accessible and designed for extreme performance.

### 2. `orchestrator/` (The Control Plane)
The **VibeServe Orchestrator** (formerly CodeNexus) is a high-performance Node.js backend. It coordinates agents, handles WebSockets for real-time streaming, runs deep security audits (AST analysis), and manages the lifecycle of the AI agents and their sandbox environments.

### 3. `mcp/` (The Python Backend)
The original **VibeServe MCP Server**. This is a production-grade FastMCP server containing 28 specialized tools, SQLite-backed memory, multi-LLM routing with auto-fallback (OpenAI, DeepSeek, OpenRouter, Local Ollama), and direct integration endpoints. 

---

## Why VibeServe?

| Feature | Description |
|---|---|
| **True Full-Stack AI** | Complete visibility from IDE UI down to the python MCP tool execution. |
| **Agentic Pipeline** | 7 discrete steps (`architect` to `deploy`), each chainable or runnable standalone. |
| **Auto-Fallback LLMs** | Built-in router across 6 providers prevents single point of failure. |
| **Trinity Benchmarked** | System-wide automated auditing and benchmarking scores ensuring A-grade performance and security. |
| **Human-in-the-Loop** | You choose when to intervene. The IDE allows seamless manual takeover of any automated workflow. |

---

## Quickstart

### Prerequisites
* **Node.js** 20+
* **Python** 3.10+
* **pnpm** (for the orchestrator)

### Setup the Entire Ecosystem

1. **Clone the monorepo:**
   ```bash
   git clone https://github.com/ncsound919/VibeServe
   cd VibeServe
   ```

2. **Start the MCP Server:**
   ```bash
   cd mcp
   pip install -e ".[dev]"
   cp .env.example .env
   # Start in dev mode or hook into Claude Desktop
   pytest tests/ -v
   ```

3. **Start the Orchestrator:**
   ```bash
   cd ../orchestrator
   pnpm install
   pnpm run build
   pnpm run dev
   ```

4. **Start the IDE:**
   ```bash
   cd ../ide
   npm install
   npm run dev
   ```

The system will now be fully interconnected.

---

## Architecture

```
VibeServe IDE (React / Vite)
       ↓ WebSocket / REST
VibeServe Orchestrator (Node.js / Express)
       ↓ stdio MCP Protocol
VibeServe MCP Server (Python / FastMCP)
  ├── 28 Tools · 5 Resources · 6 Prompts
  ├── V5 Agentic Pipeline
  ├── LLMRouter (Auto-fallback chain)
  ├── MemoryStore (aiosqlite)
  └── SchemaValidator (WCAG AAA enforcement)
```

---

## Trinity Benchmark

The entire VibeServe ecosystem undergoes a rigorous, automated audit (The Trinity Benchmark) across Performance, Code Quality, Security, and Features.

**Current System Score: 83.7/100 (Grade A)**

* **VibeServe MCP:** 82.7 (A)
* **VibeServe Orchestrator:** 92.2 (S*)
* **VibeServe IDE:** 76.0 (B)

Run the benchmark yourself:
```bash
cd mcp
python benchmark_system.py
```

---

## Donate

VibeServe is free and open source. If it saves you time:

**💚 CashApp: `$helptools`**

Every dollar helps keep the tools free.

---

## License
MIT License. See [LICENSE](LICENSE) for details.

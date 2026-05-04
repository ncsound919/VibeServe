<p align="center">
  <img src="https://github.com/ncsound919/VibeServe/blob/main/generated-image%20(8).png?raw=true" alt="VibeServe Banner" width="100%" />
</p>

# <img src="assets/logo.png" width="48" height="48" alt=""> VibeServe v1.0

> **The Agentic UI Coding Orchestrator for the Model Context Protocol**

[![CI](https://github.com/ncsound919/VibeServe/actions/workflows/ci.yml/badge.svg)](https://github.com/ncsound919/VibeServe/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/vibeserve.svg)](https://pypi.org/project/vibeserve/)
[![Downloads](https://img.shields.io/pypi/dm/vibeserve.svg)](https://pypi.org/project/vibeserve/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://python.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-00FF9F.svg)](https://modelcontextprotocol.io)
[![WCAG AAA](https://img.shields.io/badge/WCAG-AAA-green.svg)](https://www.w3.org/TR/WCAG21/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-43%20passing-brightgreen.svg)](#)
[![Quality](https://img.shields.io/badge/quality-100%2F100-00FF9F.svg)](#)

---

## What is VibeServe?

VibeServe is a production-grade MCP server that turns natural language intent into fully-architected, accessible, production-ready UI code — through a **7-step agentic pipeline** powered by your choice of LLM.

Drop it into **Claude Desktop**, **Cursor**, **Windsurf**, **Zed**, **VSCode**, or any MCP-compatible client and start building.

---

## The Vibe Pipeline

```
🏗️ vibe_architect → 💻 vibe_code → 🔍 vibe_review → ✅ vibe_verify → 🔄 vibe_iterate → 🧪 vibe_test → 🚀 vibe_deploy
```

Each step is an independent MCP tool. Chain the full pipeline or call any step standalone.

---

## Key Features

- **28 MCP Tools** — Full pipeline from architecture to deployment, plus design, audit, preview, docs, compress, health, and API integrations
- **6 LLM Providers** — OpenAI, DeepSeek, OpenRouter, Local (Ollama), OpenCode CLI, and MCP Sampling — with automatic fallback
- **MCP Sampling** — Works with **zero API keys** via the client's own LLM
- **WCAG AAA** — Accessibility validation built into every generation step
- **Multi-Agent Critique** — UX Designer, Frontend Engineer, and Accessibility Advocate review in parallel
- **10 Design Templates** — Linear, Vercel, Stripe, Apple, Claude, and more via `vibe_design`
- **5 API Integrations** — Supabase, Vercel, GitHub, Cloudflare, Google Sheets
- **SQLite Memory Store** — Learns from high-scoring specs across sessions
- **SHA-256 Cache** — Tamper-resistant filesystem cache with TTL
- **Prompt Injection Guard** — `_sanitize_input()` strips injection patterns before every LLM call
- **43 Tests** — 39 unit + 4 live DeepSeek integration tests, all passing

---

## Quickstart

```bash
pip install vibeserve
```

Or from source:
```bash
git clone https://github.com/ncsound919/VibeServe
cd VibeServe
pip install -e ".[dev]"
cp .env.example .env  # add your API keys, or leave blank for local/sampling
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "vibeserve": {
      "command": "vibeserve"
    }
  }
}
```

**Or with pipx:**
```bash
pipx install vibeserve
```

**Run interactively:**
```bash
vibeserve --interactive
```

**Run tests:**
```bash
pytest test_aether_nexus.py test_integration_v5.py test_integration_real_api.py -v
```

---

## All 28 MCP Tools

### 🏗️ The Vibe Pipeline

| Tool | Description |
|------|-------------|
| `vibe_architect` | Natural language → full architecture plan with ADR decisions, component tree, data flow, risk assessment |
| `vibe_code` | Architecture plan → production TypeScript/JSX/HTML code with ARIA, WCAG, design tokens |
| `vibe_review` | 3-agent parallel code review: UX design, code quality, accessibility compliance |
| `vibe_verify` | Static validation: WCAG, UISchema, ARIA, code quality, fabricated content detection |
| `vibe_iterate` | Critique → repair → verify loop with quality threshold gating |
| `vibe_test` | Generate unit, accessibility, integration, edge case, and responsive tests from source |
| `vibe_deploy` | Generate Vercel, Docker, static, and Node.js deployment configs with health checks |

### 🎨 Design & Build

| Tool | Description |
|------|-------------|
| `vibe_design` | Generate from curated DESIGN.md templates (Linear, Vercel, Stripe, Apple, Claude, etc.) |
| `vibe_build_pro` | Full senior-dev build: upgrade design → architect → code → verify in one call |
| `vibe_upgrade_design` | Upgrade any template with responsive, a11y, perf, SEO, security patterns |
| `vibe_benchmark` | Self-improvement benchmark loop with ASCII trend charts |
| `vibe_audit` | Backend + security + performance audit for server-side code |
| `vibe_preview` | Generate preview HTML + Playwright test script for visual verification |
| `vibe_docs` | Fetch up-to-date framework docs via Context7 for current API generation |
| `vibe_compress` | Compress JSON to TOON format reducing token usage by 30–60% |
| `vibe_health` | System health monitoring: errors, provider status, memory stats |

### 🧩 UI Spec

| Tool | Description |
|------|-------------|
| `generate_ui_spec` | Multi-agent UI spec generation with WCAG AAA + design system enforcement |
| `validate_ui_spec` | Validate any UISchema v1.0 document against design system and WCAG standards |
| `editor_config` | Generate VSCode tasks, Zed workspace config, Cursor rules |
| `list_design_systems` | List available design systems and token palettes |
| `memory_stats` | Stats on the SQLite-backed spec memory store |

### 🔌 API Integrations

| Tool | Description |
|------|-------------|
| `supabase_query` | Query Supabase tables directly |
| `vercel_deployments` | List recent Vercel deployments |
| `github_repo` | Get GitHub repository info |
| `cloudflare_dns` | List Cloudflare DNS records |
| `google_sheets` | Read from Google Sheets |

---

## Architecture

See **[docs](https://ncsound919.github.io/VibeServe)** for the full interactive documentation site.

```
MCP Client (Claude Desktop / Cursor / Windsurf / Zed / VSCode)
       ↓ MCP Protocol
VibeServe FastMCP Server
  ├── 28 Tools · 5 Resources · 6 Prompts · SamplingProvider
  ├── V5 Agentic Pipeline (Architect → Code → Review → Verify → Iterate → Test → Deploy)
  ├── LLMRouter (OpenAI · DeepSeek · OpenRouter · Local · OpenCode · MCP Sampling + auto-fallback)
  ├── MemoryStore (SQLite, indexed by page_type + score)
  ├── CacheManager (SHA-256 integrity + TTL)
  ├── SchemaValidator (UISchema v1.0 + WCAG AAA)
  └── API Integrations (Supabase · Vercel · GitHub · Cloudflare · Google Sheets)
```

---

## LLM Providers

| Provider | Model | Requires |
|----------|-------|----------|
| OpenAI | gpt-4-turbo-preview | `OPENAI_API_KEY` |
| DeepSeek | deepseek-chat | `DEEPSEEK_API_KEY` |
| OpenRouter | claude-3.5-sonnet (default) | `OPENROUTER_API_KEY` |
| Local | llama3.2 (Ollama) | Ollama running locally |
| OpenCode CLI | opencode/hy3-preview-free | `npm install -g opencode-ai` |
| **MCP Sampling** | *(client's LLM)* | **Nothing — zero config** |

---

## Integrations

🤖 Claude Desktop · ↔️ Cursor · 🌿 Windsurf · 💠 Zed · 💻 VSCode · 🌐 Vercel · 📦 Docker · 📈 Supabase · 🌐 Cloudflare · 📊 Google Sheets

---

## Donate

VibeServe is free and open source. If it saves you time:

**💚 CashApp: `$helptools`**

Every dollar helps keep the tools free.

---

## Community

- **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add DESIGN.md templates and code
- **Report bugs**: [GitHub Issues](https://github.com/ncsound919/VibeServe/issues)
- **Share**: Post your builds with `#VibeServe`
- **Star**: If VibeServe saves you time, [star the repo ⭐](https://github.com/ncsound919/VibeServe)

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built with 🖤 · VibeServe v1.0 · [Docs](https://ncsound919.github.io/VibeServe) · [PyPI](https://pypi.org/project/vibeserve/) · [Donate](https://cash.app/$helptools)*

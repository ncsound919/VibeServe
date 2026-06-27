---
hide:
  - navigation
  - toc
---

# VibeServe

**Agentic coding orchestrator for the Model Context Protocol.**

Vibe coding pipeline: architect, code, review, verify, iterate, test, deploy.

[GitHub](https://github.com/ncsound919/VibeServe) · [Tools Reference](tools/index.md)

## Quick Links

- [Tool Reference](tools/index.md) — Complete API documentation for all 82 MCP tools
- [Architecture](reference/ARCHITECTURE.md) — System architecture and design decisions
- [Setup Guide](reference/SETUP.md) — Installation and configuration
- [Deployment Guide](reference/DEPLOYMENT_GUIDE.md) — Production deployment
- [Audit Report](reference/AUDIT.md) — Security and quality audit

## Features

- **Multi-agent critique** — UX, engineering, and accessibility agents review every output
- **WCAG AAA validation** — All generated UIs pass accessibility checks
- **Pipeline automation** — architect -> code -> review -> verify -> iterate -> test -> deploy
- **Code intelligence** — GitNexus and codegraph integration for blast radius analysis
- **Business agenda** — Goal tracking and work alignment for agents
- **Memory & caching** — Learns from successful specifications
- **GitHub integration** — Repo linking, sync, and issue tracking
- **ECC integration** — Skills catalog and AgentShield security scanning

## Installation

```bash
pip install vibeserve
```

Or from source:

```bash
git clone https://github.com/ncsound919/VibeServe
cd VibeServe
pip install -e ".[dev,docs]"
```

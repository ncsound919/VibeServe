# VibeServe v1.0 — The Agentic Coding Orchestrator

> 🚀 **Now available on GitHub** — 13 MCP tools, 5 LLM providers, WCAG AAA built-in.

---

## What is VibeServe?

VibeServe is an **MCP server** that turns natural language intent into deployed applications. Seven-step pipeline:

```
vibe_architect → vibe_code → vibe_review → vibe_verify → vibe_iterate → vibe_test → vibe_deploy
```

**Describe what you want. It builds, reviews, tests, and deploys.**

---

## 🔥 Key Features

- **13 MCP Tools** — full vibe coding pipeline
- **5 LLM Providers** — OpenAI, DeepSeek, OpenRouter, Ollama (free local), OpenCode CLI
- **3-Agent Code Review** — UX Designer, Engineer, Accessibility Advocate critique in parallel
- **WCAG AAA Enforcement** — accessibility is a hard gate, not a suggestion
- **ADR-Gated Architecture** — every decision is auditable with alternatives and confidence scores
- **CritiqueLoop™** — gradient descent on code quality (nothing else in MCP does this)
- **5 Resources + 6 Prompts** — design tokens, version info, reusable templates

---

## ⚡ Quick Start

```bash
git clone https://github.com/ncsound919/VibeServe-MCP
cd VibeServe-MCP
pip install -r requirements.txt

# Free local model (no API keys)
ollama pull llama3.2:1b
DEFAULT_LLM_PROVIDER=local LOCAL_LLM_MODEL=llama3.2:1b python vibeserve.py

# Or with DeepSeek ($0.02/run)
export DEEPSEEK_API_KEY="sk-..."
DEFAULT_LLM_PROVIDER=deepseek python vibeserve.py --vibe-demo
```

---

## 📊 Proven Performance

| Provider | Pipeline | Time | Files | Lines | Cost |
|----------|----------|------|-------|-------|------|
| DeepSeek | Full 5-step | 73s | 10 | 315 | ~$0.02 |
| Ollama 1b | Architect + Review | ~7min | N/A | N/A | **Free** |

---

## 🔗 Links

- **GitHub:** https://github.com/ncsound919/VibeServe-MCP
- **Live Demo:** https://ncsound919.github.io/VibeServe-MCP
- **PyPI (soon):** `pip install vibeserve`

---

## 💰 Support

**Donations welcome!** Help keep VibeServe free and open source.

📱 **CashApp:** `$helptools`

Every donation helps cover API costs for testing and keeps the free tier running.

---

## 🧪 Test Stats

- **39 unit tests** — all pass
- **4 integration tests** — end-to-end with real LLM calls
- **5 providers tested** — DeepSeek, Ollama, OpenAI-compatible

---

*VibeServe v1.0 — Made with 🖤 for the MCP community*

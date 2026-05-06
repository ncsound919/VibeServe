# VibeServe — Real Build Instructions

This is the VibeServe project. Below is what's real, what's broken, and how to build.

## What's Real (working today)
- `vibeserve/` — Python MCP server (FastMCP with 30+ tools)
- `orchestrator/` — TypeScript pipeline spine (WS + multi-model routing)
- `ide/` — React + Electron desktop IDE (Hono API + Playwright tests)
- `codenexus/` — Review gate stubs

## What Needs an LLM (blocked without provider)
The 7-step pipeline tools (architect, code, review, iterate, test, deploy) all need a running LLM provider. Without one they return empty results. The subprocess/integration tools (file I/O, build, lint, supabase, vercel) work independently.

## What's Theater/Stub
- 10 v2 feature tools: all return "not yet implemented"
- CodeNexus reviewer: all phases return "pending execution"
- Self-improvement dashboard: ASCII art, no real learning
- Multi-agent critique: same model, three different prompts

## Build Commands

### Python (VibeServe directory)
```
pytest tests/ -v                        # Run tests
pytest tests/ -v --no-cov               # Run tests without coverage gate
python -m ruff check vibeserve/         # Lint
python -m vibeserve --demo              # Run v4 demo (needs LLM)
python -m vibeserve                     # Start MCP server
```

### TypeScript (orchestrator directory)
```
npx tsx src/index.ts                    # Start orchestrator
npx tsx tests/run.ts                    # Run orchestrator tests
npx tsc --noEmit                        # Type check
```

### IDE (ide directory)
```
npm run dev                             # Start Vite dev server
npm run server                          # Start Hono API server
npx playwright test                     # Run E2E tests
npm run lint                            # Biome lint
```

## Key File Map

```
VibeServe/
├── vibeserve/
│   ├── __main__.py          # CLI entry, demo modes, interactive REPL
│   ├── server.py            # LazyMCP — deferred FastMCP construction
│   ├── models.py            # Pydantic DTOs + input validation
│   ├── middleware.py         # Rate limiter, audit logger, correlation IDs
│   ├── auth.py              # JWT auth (defined but not enforced on tools)
│   ├── telemetry.py         # StructuredLogger + Sentry integration
│   ├── providers.py         # LLM provider abstraction (OpenAI, DeepSeek, local)
│   └── tools/
│       ├── v5_tools.py      # 7-step pipeline: architect→code→review→verify→iterate→test→deploy
│       ├── v4_tools.py      # UI spec generation, validation, memory
│       ├── pipeline_tools.py # File I/O, subprocess, security scans
│       ├── integration_tools.py # Supabase, Vercel, GitHub connectors
│       ├── critique.py      # Multi-agent critique + CritiqueLoop
│       ├── generators.py    # SpecGenerator with LLM-driven spec creation
│       ├── validators.py    # WCAG contrast + schema validation
│       └── memory.py        # SQLite memory store for learned specs
├── orchestrator/
│   ├── src/
│   │   ├── index.ts         # Main entry — wires MCPClient, WSServer, pipeline
│   │   ├── mcp-client.ts    # JSON-RPC over stdio to Python MCP
│   │   ├── ws-server.ts     # WebSocket event broadcast
│   │   ├── pipeline/unifiedPipeline.ts  # 8-phase pipeline orchestrator
│   │   ├── pipeline/multiModelPipeline.ts  # Multi-model routing + fallback
│   │   ├── agents/          # PlannerAgent, CodingAgentService, ErrorDiagnoser
│   │   ├── codenexus/       # ReviewAgent, SecurityAudit, E2ERunner, DebtScorer
│   │   └── models/          # Providers, Router, CostTracker, Desloppify
│   └── tests/run.ts         # 31 test assertions + benchmark simulation
├── ide/
│   ├── src/
│   │   ├── server/hono.ts   # Hono API + WebSocket server (port 3002)
│   │   ├── services/        # 80+ service modules
│   │   ├── stores/          # 12 Zustand stores
│   │   └── components/      # 30+ React components
│   ├── electron/            # Electron shell (main + preload)
│   └── tests/               # Playwright E2E suite (50+ specs)
└── tests/
    ├── test_aether_nexus.py      # Core domain models, WCAG, validators
    ├── test_auth.py              # JWT create/verify, scope enforcement
    ├── test_sentry.py            # SentryTracker init, capture, flush
    ├── test_system_hardening.py  # Import time, sanitization, concurrency
    └── test_fix_functional.py   # Fix verification tests (runtime, not source scan)
```

## Audit Findings (from AUDIT.md)

### CRITICAL — need fixing before release
1. Electron: `contextIsolation: false` + `nodeIntegration: true` in `ide/electron/main.ts`
2. Command injection: `routes/tasks.ts` runs `execAsync(command)` with user input
3. Orchestrator WS has zero auth — any client can trigger pipeline runs
4. `@require_scope` decorator exists but applied to zero tool handlers

### HIGH — next sprint
5. 5 IDE routes have no auth middleware (ai, search, vault, launch, ws/pipeline)
6. `OPENCODE_API_KEY` defaults to empty string
7. `vault.ts` stores secrets in plain array, no encryption
8. Orchestrator has no retry on API calls (retry logic exists in unused `caller.ts`)
9. Concurrent pipeline runs race on same instance

## Honest State

| Pipeline Tool | Needs LLM | Works standalone |
|---|---|---|
| vibe_architect | Yes | No |
| vibe_code | Yes | No |
| vibe_review | Yes | No |
| vibe_verify | Partial (regex) | Partial |
| vibe_iterate | Yes | No |
| vibe_test | Yes | No |
| vibe_deploy | Yes | No |
| vibe_health | No | Yes |
| vibe_compress | No | Yes |
| read_file / write_file | No | Yes |
| run_install / run_build | No | Yes |
| All subprocess tools | No | Yes |
| All integration tools | No | Yes |
| 10 v2 feature tools | N/A | No (all stubs) |

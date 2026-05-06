# VibeServe — Project Context

## What we're building
A desktop agentic coding IDE (Electron + React) backed by a Python MCP pipeline server and TypeScript orchestrator. The system generates UI code from natural language using multi-agent LLM critique.

## Stack
- **Python 3.12+**: FastMCP server (`vibeserve/`), providers, tools, telemetry
- **TypeScript/Node**: Orchestrator (`orchestrator/`), IDE (`ide/`), Hono API server
- **Electron**: Desktop shell for the IDE
- **Playwright**: E2E testing
- **SQLite** (aiosqlite): Memory store for learned specs
- **Sentry**: Error tracking

## Where things live
| Component | Directory | Language | Entry |
|-----------|-----------|----------|-------|
| MCP Server | `vibeserve/` | Python | `python -m vibeserve` |
| Orchestrator | `orchestrator/` | TypeScript | `tsx src/index.ts` |
| IDE | `ide/` | TypeScript/React | Hono on 3002, Vite on 3000 |
| CodeNexus | `codenexus/` | TypeScript | Minimal stubs |
| Tests | `tests/` | Python | `pytest tests/` |

## Build & verify
```
# Python
cd VibeServe
python -m ruff check vibeserve/              # lint
python -m pytest tests/ -v --no-cov          # test (skip coverage gate)
python -m vibeserve --demo                   # demo run

# TypeScript
cd orchestrator
npx tsc --noEmit                             # type check
npx tsx tests/run.ts                         # run tests
```

## Known issues (from AUDIT.md)
- Electron: `contextIsolation: false`, `nodeIntegration: true` — RCE risk
- `routes/tasks.ts`: `execAsync(command)` with user input — command injection
- Orchestrator WS: no auth on port 3001
- `@require_scope` decorator: defined but never applied
- 10 v2 feature tools: all stubs returning "not yet implemented"
- 6/7 pipeline tools non-functional without LLM provider
- `caller.ts` retry logic: dead code, never imported
- `@langchain/langgraph`: in package.json, never used

## How to work
1. Read the relevant source file first before editing
2. Follow existing code conventions (Pydantic for Python, async/await everywhere)
3. Run `python -m ruff check` on changed Python files
4. Run `pytest tests/ -x --no-cov` before claiming completion
5. Never commit without tests passing

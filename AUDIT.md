# VibeServe Architecture & Engineering Audit

Senior-dev assessment against the layered audit framework: architecture, code quality, CI/CD, ops, and security.

---

## Architecture

| Area | Senior-dev question | Healthy signal | Risk signal |
|------|---------------------|---------------|-------------|
| Frontend | Does UI own presentation rather than business policy? | N/A (MCP server, no browser UI) | — |
| API | Are contracts explicit and version-tolerant? | JWT auth module exists (`auth.py`) | Handlers return ad-hoc `Dict[str, Any]` with raw `.__dict__` from dataclasses. Pydantic Response DTOs defined but **unused** (`models.py:140-199`). |
| Services | Is domain logic centralized? | Core pipeline well-split into 16 focused modules | 10 "v2 features" are empty stubs returning hardcoded data (`features/*.py`). `utils.py` is a 591-line util-graveyard with 5 API connectors, WCAG math, and side-effecting `EditorBridge.write_all_configs()`. |
| Data | Can schema evolve safely? | SQLite with `IF NOT EXISTS` for idempotent creation | **No migration system** — schema is inline DDL (`memory.py:32-40`). Adding columns requires manual `ALTER TABLE`. Cache writes are not atomic (no write-to-temp-then-rename pattern). |
| Jobs | Are async workflows idempotent and observable? | Memory store uses double-checked locking for concurrent safety | Eviction and writes use separate DB connections — TOCTOU gap (`memory.py:62,68-72`). No correlation/trace IDs anywhere in logs. |
| CI/CD | Does the pipeline prove deploy safety? | CI runs ruff, mypy, pytest on 3 Python versions, TruffleHog secret scanning | No coverage enforcement was in CI (now added at 50%). No dependency vulnerability scanning. No E2E gate in CI. |
| Security | Are trust boundaries enforced server-side? | Input sanitization exists (`SpecGenerator._sanitize_input`, `sanitize_for_display`). JWT auth module exists (HS256). Secret redaction in StructuredLogger. `.env` in `.gitignore`. | **No server-level rate limiting** — DoS trivial. Auth scope declarations are never enforced. Permission enforcement is client-side only (`ide/src/services/permissionService.ts:25-58`). Subprocess execution with user-supplied paths in `pipeline_tools.py`. |
| Observability | Can incidents be traced end-to-end? | Sentry SDK integrated (no-op without DSN). StructuredLogger with secret redaction. AsyncProfiler for slow-operation detection. | **Zero correlation/trace IDs.** No audit logging — impossible to determine who called what tool and when. SentryTracker is not instrumented into pipeline tool handlers. Ollama has healthcheck in docker-compose, vibeserve does not. |

---

## Code Quality Deep-Dive

### Boundary Leaks
- **`v5_tools.py:29,57,91,103`**: All handlers serialize dataclasses via `.__dict__`, bypassing Pydantic response models. A field rename in `ArchitectureDecision` silently changes the API contract.
- **`ide/src/services/qualityScoringService.ts:74-284`**: Full parallel quality scoring engine lives on the frontend, duplicating backend `VibeVerifier`/`SystemAuditor` logic.
- **`ide/src/services/pipelineService.ts:673-970`**: Second pipeline orchestrator on the frontend with its own retry/remediation/progress logic.

### Duplication
- `CONTENT_GUIDELINES` was duplicated between `server.py:59-66` and `vibe_architect.py:8-33` (server.py copy removed).
- `providers.py:151-163`: `LocalProvider.call()` reimplements retry logic from `_api_call()`.
- `ide/` frontend duplicates quality scoring, pipeline orchestration, and permission rules already handled (or stubbed) in the Python backend.

### Dead Code
All 10 modules in `vibeserve/features/` return hardcoded empty results:
`web_cloner.py`, `semantic_search.py`, `live_reload.py`, `palette_generator.py`, `multiverse.py`, `i18n_engine.py`, `git_agent.py`, `doctor.py`, `diff_engine.py`, `timemachine.py`

These inflate the tool count reported in `resource_version()` (claims "tools: 27") without providing functionality.

### Test Coverage
- **63 pytest tests** (43 unit + 20 system hardening), **9 Playwright E2E** (docs validation)
- Total coverage: **53.57%** (threshold: 50%)
- Low-coverage modules: `utils.py` (47%), `providers.py` (53%), `vibe_architect.py` (39%), `vibe_implementer.py` (37%)
- Auth module has **zero tests**
- SentryTracker has **zero dedicated tests**

---

## CI/CD Pipeline

| Stage | Status | Notes |
|-------|--------|-------|
| Lint (ruff) | K Green | 43 remaining errors in pre-existing files |
| Type check (mypy) | K Green | `--ignore-missing-imports` flag |
| Unit tests (pytest) | K Green | 3 Python versions, 50% coverage floor (new) |
| Security scan (TruffleHog) | K Green | Scans for hardcoded secrets |
| E2E tests | K Yellow | Playwright test exists but not wired into CI |
| Docker build | K Yellow | Base image digest pinned, healthcheck added, non-root user added |
| PyPI publish | K Green | OIDC trusted publishing on `v*` tags |
| Dependency scanning | K Red | No Dependabot, Renovate, or Snyk |

---

## Blast-Radius Risk Map

| Module | Blast Radius | Risk |
|--------|-------------|------|
| `providers.py` (LLM router) | All LLM calls flow through here | K Medium — well-designed fallback, but singleton pattern makes testing hard |
| `memory.py` (MemoryStore) | Spec persistence for all tools | K High — no migration system, global singleton, TOCTOU eviction race |
| `utils.py` (util-graveyard) | Imported by 7+ files, 5 API connectors | K High — side-effecting disk writes in "utility" class, WCAG math misplaced |
| `server.py` (MCP boundary) | All tool invocations | K High — no middleware, no rate limiting, no audit logging, no input validation |
| `pipeline_tools.py` (subprocess) | Shell execution with user paths | K High — weak path validation on `run_install`, `run_build`, `run_playwright` |
| `features/*.py` (dead stubs) | Reported in version metadata | K Low — no runtime impact but misleading |

---

## Fixes Applied During This Audit

| # | Fix | File(s) |
|---|-----|---------|
| 1 | core_logic.py split (1089L > 16 files) | `tools/*.py` (see commit) |
| 2 | Duplicated imports extraction | `tools/_tool_deps.py` |
| 3 | `_mcp_llm_call` mixin | `tools/_llm_mixin.py` |
| 4 | Pydantic response DTOs added | `models.py:140-199` |
| 5 | JWT auth module | `vibeserve/auth.py` |
| 6 | Real Sentry SDK replacing in-memory tracker | `utils.py:282-344` |
| 7 | CONTENT_GUIDELINES dedup | `server.py` (removed dup) |
| 8 | `python-jose`, `sentry-sdk` declared as deps | `pyproject.toml` |
| 9 | Coverage enforcement at 50% | `pyproject.toml`, `ci.yml` |
| 10 | Dockerfile: pinned digest, non-root user, healthcheck | `Dockerfile` |
| 11 | Playwright E2E test infrastructure | `package.json`, `playwright.config.ts` |

---

## Remaining Priority Items

### Immediate (fix before next release)
1. **Wire up response DTOs** — replace `.__dict__` with Pydantic model construction in all handlers
2. **Add rate limiting middleware** — `asgi-ratelimit` or similar at the FastMCP transport layer
3. **Add audit logging** — tool name + caller identity + input hash + timestamp + outcome on every invocation
4. **Add correlation IDs** — generate `x-trace-id` in StructuredLogger and thread through all pipeline steps
5. **Validate input on all handlers** — use Pydantic models for tool argument validation

### Short-term (next sprint)
6. Add migration system for SQLite (`memory.py`) — versioned schema with `ALTER TABLE` support
7. Atomic cache writes — write-to-temp-then-rename pattern in `cache.py`
8. Fill or delete the 10 empty feature stubs in `features/`
9. Split `utils.py`: move WCAG math to `validators.py`, connectors to `integrations/`, Sentry to `telemetry.py`
10. Add auth tests and SentryTracker tests

### Medium-term
11. Fix `LocalProvider` retry duplication in `providers.py`
12. Add Dependabot/Renovate for dependency scanning
13. Wire Playwright E2E tests into CI
14. Enforce auth scope checks on tool invocation (not just token validation)
15. Raise coverage threshold to 70% as tests are added

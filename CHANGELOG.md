# Changelog

## [2.0.0] — 2026-05-31
### Orchestration & Production Readiness (Phase 4–5)
- **orchestrator**: Consolidated `codenexus` and `pipelineQueue.ts` into a unified `ide/src/server/orchestrator/orchestrator.ts` system
- **agenda**: Migrated `agenda.py` to the core Python MCP tools layer as an Execution Memory tool to track agent goals
- **dependencies**: Obsoleted and cleaned up legacy `codenexus/` directory from the repository
- **documentation**: Created `plans/VibeServe-Roadmap-Execution-Plan.md` outlining the roadmap to v2.0.0
- **stability**: Bumped full stack version to `v2.0.0` with strict pre-flight release validation and security policy established

## [1.2.0] — 2026-05-30
### Security (Phase 1–2)
- **auth**: `verify_token()` now fails closed — raises `RuntimeError` when
  `VIBESERVE_API_SECRET` is not set (was silently returning allow-all anonymous access)
- **auth**: Added `validate_secret_on_startup()` — server refuses to start without a secret
- **models**: `FileReadInput` and `FileWriteInput` now reject path traversal sequences
  (`..`) and absolute paths at validation time
- **pipeline**: Subprocess timeout reduced from 300s to 30s; added process group kill
  on timeout so child processes (webpack, node) don't outlive the deadline
- **ci**: TruffleHog now scans full git history (`fetch-depth: 0`, `base: ""`) instead
  of only the last commit diff — previously missed secrets committed more than one push ago
- **ci**: Removed `sk-test-mock`-format key from CI env vars; added `VIBESERVE_API_SECRET`
  for tests; replaced `NEXUS_AUTH_BYPASS` with proper test secret + `NODE_ENV: test`
- **pypi**: Publish workflow now requires `preflight` job to pass (tests + security scan
  + changelog check) before any PyPI release — previously had zero `needs:` dependencies
- **pypi**: Added post-publish smoke test (`pip install vibeserve==<tag> && vibeserve --version`)
- **SECURITY.md**: Added private vulnerability disclosure process via GitHub Advisory System

### Code Quality (Phase 3)
- **models**: Converted `ArchitectureDecision`, `CodeFile`, `VibePlan`, `IterationResult`
  from `@dataclass` with hand-written `model_dump()` to Pydantic `BaseModel` — serialization,
  validation, and schema generation are now consistent across the entire codebase
- **middleware**: Rate limiter now uses per-identity `asyncio.Lock` via `defaultdict`
  instead of a single global lock — contention on one identity no longer blocks all others
- **middleware**: Eviction is now time-based (every 5 minutes) instead of only triggering
  after 1,000 entries — prevents unbounded dict growth under slow drip traffic
- **providers**: `LocalProvider` now reuses the shared `httpx.AsyncClient` instead of
  creating its own private client with different timeouts that was never closed
- **providers**: Added `register_shutdown_hook()` so `_close_client()` is actually called
  on server shutdown (was dead code — defined but never wired to a shutdown event)
- **providers**: `OpenCodeProvider` CLI timeout reduced from 300s to 30s

### Versioning
- Downgraded PyPI classifier from `Production/Stable` to `Development Status :: 4 - Beta`
  until Phase 4 (complete monorepo) and Phase 5 (production ops) are done
- Version bumped to `1.2.0` (internal cleanup, no API breaks)

### Breaking Changes
- Server will **refuse to start** without `VIBESERVE_API_SECRET` set.
  Generate one: `python -c "import secrets; print(secrets.token_hex(32))"`
- Coverage threshold raised from 60% to 80% — existing test runs may fail until
  new tests are added

---

## [1.3.0] — 2026-05-03
### Added
- Interactive CLI mode (`vibeserve --interactive`) with full REPL
- PyPI auto-publish workflow (`v*` tags trigger publish)
- `editor_write` MCP tool for on-disk VSCode/Zed config generation
- Community files: CONTRIBUTING.md, FUNDING.yml, issue templates
- MCP registry descriptors for Glama and Smithery
- Demo walkthrough (DEMO.md)
- Enhanced EditorBridge with VSCode settings, extensions, and Zed formatting configs

### Changed
- Documentation site (`docs/index.html`) completely rewritten with accurate tool list
- Package URLs unified to `github.com/ncsound919/VibeServe`
- `pyproject.toml`: added `long_description`, `py-modules`, fixed URLs

### Performance
- FastMCP import deferred via `_LazyMCP` proxy — import time reduced from 2.8s to 0.75s (73% faster)
- Benchmark score improved from 79.2 to 82.6/100

### Fixed
- `demo()` and `vibe_demo()` moved to module level for proper console entry point access
- CLI entry point `main()` now works correctly from `pip install vibeserve`

## [4.0.0] — 2026-05-03
### Added
- UISchema v1.0 open specification
- Multi-agent critique (Designer, Engineer, Accessibility Advocate)
- WCAG AAA validation with auto-repair
- CacheManager with TTL-based invalidation
- Memory feedback loop (store_successful_spec)
- FastMCP server integration (4 tools exposed)

### Fixed
- validate_wcag_contrast min_level enforcement
- Background-only color WCAG bypass
- Prompt injection sanitization on requirements input

### Security
- Added .gitignore for .env and cache directories
- Cache integrity checksums

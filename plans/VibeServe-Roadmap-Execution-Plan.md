# VibeServe Roadmap Execution Plan

## Phase 1–2: Security & CI Hardening
- [ ] Create `SECURITY.md` (private disclosure process).
- [ ] Add `.github/ISSUE_TEMPLATE/security.md`.
- [ ] Audit all CI/CD workflows for secret exposure; ensure `fetch-depth: 0` is set for all security scans.
- [ ] Implement pre-publish gates (`needs: [test, security]`) in `pypi.yml`.
- [ ] Add post-publish smoke test to `pypi.yml`.
- [ ] Enforce `CHANGELOG.md` entry verification in CI.

## Phase 3: Cleanup & Stability
- [ ] Increase test coverage threshold to 80% (`--cov-fail-under=80`).
- [ ] Enable strict `mypy` type checking; resolve all existing type errors.
- [ ] Refactor identified technical debt in `ide/` and `vibeserve/` (based on `mypy` and `lint` results).

## Phase 4: Orchestration (Architecture Consolidation)
- [ ] **Decision A:** Consolidate `codenexus/` and `ide/src/server/pipelineQueue.ts` into `ide/server/orchestrator`.
- [ ] **Decision B:** Migrate `vibeserve/tools/agenda.py` into the Python MCP as an "Execution Memory" tool.
- [ ] Rebuild pipeline infrastructure using the consolidated orchestrator.
- [ ] Implement and verify the E2E acceptance test (<120s execution time).

## Phase 5: Operations & Finalization
- [ ] Implement full release gate: Security scan, Changelog enforcement, Post-install verification.
- [ ] Finalize `v2.0.0` stability promise.
- [ ] Full E2E validation against local and production providers.

---
*Status: Ready for execution.*

# Nexus Alpha — Full-Implementation Plan: Desktop AI IDE
> **Status:** PLANNING (pre-implementation) | **Date:** 2026-04-30
> **Owner:** Nexus Alpha Team | **Target:** Competes with Cursor / Claude Code / Antigravity

---

## What this plan covers

This document is the **authoritative implementation plan** for transforming Nexus Alpha from a developer-intelligence dashboard into a full-Stack, privacy-first, AI-native desktop IDE that can compete with Cursor, Claude Code, and Google Antigravity in 2026.

It is organized into **phases** with clear deliverables, risks, and verification gates. Each phase must be reviewed and approved before the next begins.

---

## Competitive Reference

The definitive feature checklist this plan is measured against: [CHECKLIST-2026-2026-NEXUS-COMPETITION.md](./CHECKLIST-2026-NEXUS-COMPETITION.md)

Key differentiators Nexus must own:
- Multi-agent orchestration with transparent artifacts and human-review gates
- Local-llm-first (Ollama) + hybrid cloud routing with no data exfil
- Template-driven scaffold generation from a single natural-language prompt
- Production-grade reliability (Temporal) + LangGraph agent orchestration
- One-time-fee model + enterprise-ready extensibility

---

## Phase 0: Infrastructure & Safety Foundations
**Timeline:** 1-2 weeks | **Prerequisite:** None

### Goals
- Stabilize existing codegen scaffolding (already in-progress)
- Eliminate circular dependencies and runtime-require patterns
- Harden editor file service with strict path guards
- Add test scaffolding for all new modules
- Produce plan artifacts (ADRs, changelog, patch plans)

### Deliverables

#### 0.1 — Registry cleanup (DONE)
**File:** `src/coding-agent/templates/registry.ts`
- Eliminated dynamic `require('path')` inside scaffold functions
- Eliminated `this.genSpecTemplate()` etc. inside scaffolds (broken references)
- Changed to module-level `writeFileSync` / `mkdirSync` calls
- Added 3 templates: react-ts-vite, express-api, fullstack
- Added `getTemplateForDescription()` with keyword scoring (longest-match wins)
- Added `listTemplates()` for API discoverability
- Added explicit `AppSpecLike` type (no cross-import cycle)
- Templates use `spec: AppSpecLike` so scaffold functions are pure and typed
- Each template writes proper `gen-spec.ts` for traceability

#### 0.2 — CodingAgentService hardening (DONE)
**File:** `src/services/codingAgentService.ts`
- Renamed `CodingAgentService.generateApp()` — pure function, no side effects outside OUT_DIR
- Added guard: existing-app-ID rejection (never overwrite)
- Added guard: path-traversal enforcement (`appRoot.startsWith(OUT_DIR)`)
- Added guard: description length check (min 3 chars)
- Returns `{ appPath, success, message, templateId, files[] }` — structured
- `walkFiles()` enumerates written files for auditability
- No more broken template method references

#### 0.3 — Plan artifacts (IN PROGRESS)
**This file:** `PLAN-NEXUS-IDE-FULL-IMPLEMENTATION.md` — authoritative plan
**`docs/adr/`** — architecture decision records (see below)
**`CHANGELOG-IDE.md`** — running changelog for IDE features
**Patch plan files** in `docs/superpowers/plans/` (one per phase)

### Phase 0 ADRs
- `docs/adr/ADR-0001-template-registry-design.md` — registry architecture, keyword scoring
- `docs/adr/ADR-0002-codegen-safety-model.md` — path guards, guard taxonomy

### Verification Gate
```bash
npm run build          # Must pass
npm run lint           # Must pass
# Manual: POST /api/coding/generate with { description: "Build a todo app" }
# Expected: 200, { success: true, templateId: "react-ts-vite", files: [...], appPath: ... }
```

---

## Phase 1: Core MVP — Desktop Shell + Coding Engine + Mission Control UI
**Timeline:** 3-4 weeks | **Prerequisite:** Phase 0 verified

### Goals
- A runnable desktop-like experience (Electron shell or browser-based editor panel)
- Working codegen with all 3 templates selectable by prompt
- Basic multi-agent Mission Control panel (spawn/monitor/pause/resume)
- Local-first mode toggle (Ollama/Cloud routing)
- Editor file browser for generated apps (list/read/write)
- Structured logging and WebSocket progress feeds for codegen flows

### Deliverables

#### 1.1 — Editor Panel / Desktop Shell
- Add a Monaco-based editor panel to the React app (or Electron-embedded shell)
- Wire `POST /api/coding/generate` to the editor panel
- Display generated file tree in a sidebar file browser
- Implement `GET /api/editor/file?path=...` for reading generated files
- Implement `POST /api/editor/file` for writing edits (guarded)
- File tree view: collapsible with file type icons
- **Risk:** Monaco bundle size (~5MB); mitigate with lazy loading or code-splitting

#### 1.2 — Template Registry API
- Add `GET /api/coding/templates` — returns `listTemplates()`
- Add `POST /api/coding/generate` — enhanced payload:
  ```json
  {
    "description": "Build a React todo app",
    "templateId?": "react-ts-vite",
    "privacyPreference?": "local" | "cloud"
  }
  ```
- Response includes `files[]` (list of written file paths) and `templateId`
- **Risk:** template selection accuracy; mitigate with keyword scoring expansion

#### 1.3 — Basic Mission Control Panel
- Add a `MissionControl` panel in the UI (tab or drawer)
- Spawn: button to trigger a single agent task (e.g., "implement feature X")
- Monitor: live status via WebSocket (`type: 'agent:update'`)
- Pause/Resume: toggle for agent execution
- Log viewer: scrollable log output per agent
- **Risk:** WebSocket reconnect; mitigate with exponential backoff reconnect
- **Risk:** agent state persistence; mitigate with Temporal workflow (Phase 2)

#### 1.4 — Local-First / Offline Mode
- Add `POST /api/settings/privacy-mode` — toggle local/cloud
- When local:
  - Route to Ollama (`http://localhost:11434`)
  - Fallback chain: Ollama → Gemini → OpenRouter
  - Show "Offline Mode Active" indicator in UI
- When cloud: normal Gemini routing
- **Risk:** Ollama not installed; mitigate with explicit setup wizard and detection

#### 1.5 — Structured Logging & Observability
- Add Langfuse-like traces to key codegen steps:
  - `template-selection`, `scaffold-write`, `file-enumeration`
- Log structured events to `logs/codegen-{date}.log` (rotated daily, max 5MB)
- Add `GET /api/logs/codegen` — returns last N log lines (admin only)
- **Risk:** log explosion; mitigate with log-level config and rotation

#### 1.6 — Tests
- Unit tests: `src/services/__tests__/codingAgentService.test.ts`
  - Happy path: generateApp returns success
  - Error path: description too short → failure
  - Guard path: path traversal rejected
- Unit tests: `src/coding-agent/templates/__tests__/registry.test.ts`
  - Keyword scoring correctness
  - Fallback to react-ts-vite for unknown prompts
  - All 3 templates scaffold without error
- Integration test: `src/server/__tests__/coding.test.ts`
  - Full flow: POST /api/coding/generate → check files exist on disk

### Phase 1 ADRs
- `docs/adr/ADR-0003-desktop-shell-approach.md` — Electron vs Monaco-in-browser decision
- `docs/adr/ADR-0004-local-first-routing.md` — Ollama/Cloud fallback chain

### Verification Gate
```bash
# All Phase 0 gates still pass
npm run build
npm run lint
npm test          # New unit + integration tests must pass

# Manual UX gates:
# 1. Open Nexus Alpha → Mission Control tab visible
# 2. Enter "Build an Express API" → POST /api/coding/generate → files written to generated-apps/{id}/
# 3. Click "Open App" → file tree visible in sidebar
# 4. Toggle local mode → "Offline Mode Active" indicator appears
# 5. Spawn agent → status updates via WebSocket
```

---

## Phase 2: Differentiation — Multi-File Planner + LangGraph Orchestration
**Timeline:** 4-6 weeks | **Prerequisite:** Phase 1 verified

### Goals
- Multi-file planner that outputs fileTree + per-file diffs from a prompt
- LangGraph agent orchestration with Triage / Research / Coding / Analysis agents
- Temporal-powered durable workflows for long-running tasks
- Template versioning + registry API for template management
- Real-Build pipeline (replace simulation in pipelineService)
- Auto-fix loop with real error capture and LLM-driven fixes
- Per-hunk diff acceptance in editor (accept/reject per file/section)

### Deliverables

#### 2.1 — Multi-File Planner
- Add `src/coding-agent/planner.ts`
  - Takes natural-language description → outputs `fileTree` (array of file paths + purposes)
  - Calls LLM (Gemini) to plan architecture before scaffolding
  - Falls back to template selection if LLM unavailable
- Add `POST /api/coding/plan` — returns `fileTree[]` for a description
  ```json
  { "description": "Build a todo app", "files": [{ "path": "src/App.tsx", "purpose": "..." }] }
  ```

#### 2.2 — Per-File Diffs
- Add `src/coding-agent/diffEngine.ts`
  - Generates unified diffs for file modifications
  - Supports add/remove/change per file
- Add `GET /api/coding/diff?appPath=...&file=...` — returns diff for a specific file
- Add `POST /api/coding/apply-diff` — applies a user-approved diff
- Diff viewer in editor panel: inline diff with accept/reject buttons

#### 2.3 — LangGraph + Temporal Integration
- Implement `src/agents/graph.ts` (from existing LangGraph design doc)
  - Triage → Research / Coding / Analysis / General routing
  - Each agent has RAG context from Supabase vector store
- Implement `src/workers/activities/` and `src/workflows/` (from Temporal design doc)
  - Wrap LangGraph execution in a Temporal Activity
  - Durable execution: survives worker restart
  - Native retry policies (exponential backoff)
- Add `GET /api/agents/status` — returns running workflows
- **Risk:** LangGraph + Temporal complexity; mitigate with skeleton-first, test-first

#### 2.4 — Real Build Pipeline
- Replace `LOG_TEMPLATES` in `pipelineService.ts` with real calls:
  - Static Analysis → `biome` (real lint output)
  - Build & Compile → `vite build` (real output)
  - E2E Testing → real Playwright run
  - Security Audit → real `npm audit` output
- Add `POST /api/pipeline/run/{id}/logs` — streaming logs per phase

#### 2.5 — Auto-Fix Loop with Real Errors
- Implement `src/services/autoFixLoop.ts` (already planned)
  - Capture real TypeScript/build errors from build output
  - Call LLM with error context + surrounding code
  - Apply targeted fixes (import fix, dep fix, type fix)
  - Max 5 fix attempts per phase, then escalate
- Add `GET /api/pipeline/{id}/fix-log` — returns fix history

#### 2.6 — Tests
- Unit tests for planner (mock LLM, check fileTree shape)
- Unit tests for diff engine (round-trip: diff → apply → same content)
- Integration tests for LangGraph graph (mocked LLM)
- E2E test: describe "todo app" → plan → scaffold → build → fix errors → success

### Phase 2 ADRs
- `docs/adr/ADR-0005-langgraph-triage-routing.md` — agent routing logic
- `docs/adr/ADR-0006-temporal-workflow-design.md` — activity/workflow mapping
- `docs/adr/ADR-0007-real-build-replacing-simulation.md` — pipeline migration

### Verification Gate
```bash
npm run build; npm run lint; npm test

# Functional gates:
# 1. POST /api/coding/plan with "todo app" → returns fileTree[]
# 2. POST /api/coding/generate → files written → GET /api/coding/diff shows unified diff
# 3. Temporal workflow starts → survives /api/server restart → completes
# 4. Pipeline runs real `vite build` → logs show real output (not templates)
# 5. Intentionally broken code → auto-fix loop attempts fix → fix history populated
```

---

## Phase 3: Advanced / Enterprise
**Timeline:** 6-10 weeks | **Prerequisite:** Phase 2 verified

### Goals
- Real-time collaboration (shared sessions, presence)
- One-click deployment to Vercel / Netlify / Docker
- Full enterprise security (secrets scanning, audit logs, permissions)
- Marketplace / extension API surface
- Licensing + sales page integration
- Long-running autonomous agents with persistent memory
- Cross-platform desktop (Mac / Windows / Linux)
- SWE-bench benchmarking harness

### Deliverables

#### 3.1 — Real-Time Collaboration
- Add `GET /api/collab/sessions` — list active sessions
- Add `POST /api/collab/sessions` — create shared session
- WebSocket: `type: 'collab:cursor'`, `type: 'collab:edit'` for presence + co-editing
- Collaboration panel: show active users with cursor colors
- **Risk:** CRDT for conflict resolution; mitigate with operational transform or Yjs

#### 3.2 — One-Click Deployment
- Add `src/coding-agent/deployer.ts`
  - Vercel CLI integration
  - Netlify CLI integration
  - Docker build + run
- Add `POST /api/deploy/{appPath}` — triggers deploy, returns URL
- Add `POST /api/deploy/{appPath}/preview` — Docker local preview

#### 3.3 — Enterprise Security & Compliance
- Add `src/services/secretsScanner.ts`
  - Scan generated code for API keys, tokens, credentials
  - Reject scaffolding if secrets detected
- Add `src/services/auditLog.ts`
  - Log all /api/editor/write calls with user/session/timestamp
  - Immutable append-only log (no delete)
- Add `GET /api/audit/logs` (admin only)

#### 3.4 — Marketplace & Extensions
- Define `src/services/extensionManifest.ts`
  - Extension schema: `{ id, name, version, tools[], permissions }`
- Add `GET /api/extensions` — list installed extensions
- Add `POST /api/extensions/load` — load extension from file/URL
- Add `GET /api/extensions/{id}/tools` — expose extension tools as MCP-like tools
- **Risk:** malicious extensions; mitigate with sandboxed execution and permission review

#### 3.5 — Long-Running Autonomous Agents
- Extend Temporal workflows to support human-in-the-loop gates
  - Workflow pauses, signals user for approval, resumes on signal
- Add `GET /api/agents/{id}/artifacts` — list generated artifacts (diffs, logs, plans)
- Add `POST /api/agents/{id}/approve` — approve pending changes
- Add `POST /api/agents/{id}/reject` — reject with reason

#### 3.6 — Cross-Platform Desktop
- Add `electron/` directory with Electron main process
  - IPC bridge to Node. js services
  - Native menus and window management
  - System tray integration
- Add `src/desktop/shell.ts`
  - Monaco editor integration with Electron
  - Global shortcuts (Ctrl+Shift+P for command palette)
  - Desktop notifications

#### 3.7 — SWE-Bench Benchmarking
- Add `src/benchmark/sweHarness.ts`
  - Clone SWE-bench repo, apply patch, trigger generation
  - Compare Nexus output vs expected patch
  - Score: % of test cases resolved
- Add `GET /api/benchmark/swe` — returns benchmark scores over time

#### 3.8 — Tests
- Full E2E: collaboration, deployment, secrets scanning, extension loading
- Load test: 50 concurrent /api/coding/generate calls
- Security test: secrets scanner detects injected API key

### Phase 3 ADRs
- `docs/adr/ADR-0008-real-time-collab-crdt.md` — collaboration conflict resolution
- `docs/adr/ADR-0009-deployment-pipeline.md` — Vercel/Netlify/Docker integration
- `docs/adr/ADR-0010-extension-sandbox-model.md` — extension security model

### Verification Gate
```bash
npm run build; npm run lint; npm test
# Functional gates per deliverable above
# Load test: 50 concurrent codegen calls — all succeed, no timeouts
# SWE-bench harness score: report generated and trending over time
```

---

## Implementation Rules (All Phases)

### Safety Rules
1. **Never write outside `generated-apps/{id}/`** — enforce with `path.startsWith(OUT_DIR)` before every write
2. **No arbitrary code execution** — never `eval()` or `new Function()` with user input
3. **Secrets in generated code = reject** — run `secretsScanner` before scaffolding completes
4. **Input validation on every API** — validate all request bodies and query params
5. **Graceful error propagation** — never swallow errors silently; return structured `{ error: string }`

### Dependency Rules
1. **No circular runtime imports** — use type-only imports where needed
2. **No dynamic `require()` inside template scaffolds** — use module-level imports
3. **Side-effect-free templates** — scaffolds must only write files; no I/O side effects
4. **Feature flags for new features** — gate behind `FEATURE_*` env vars
5. **Test before merge** — PR cannot merge without passing unit + integration tests

### Performance Rules
1. **Codegen must complete in < 5s** (for template-only path; LLM-driven may be longer)
2. **File enumeration (< 1s)** — use `readdirSync` with early exit for large dirs
3. **WebSocket messages < 1KB each** — chunk large logs; don't flood the socket
4. **Log rotation** — max 5MB per log file; rotate daily

### Naming Conventions
- **Templates:** `src/coding-agent/templates/{template-id}/`
- **Agents:** `src/agents/{agent-id}/`
- **Workflows:** `src/workflows/{workflow-id}.ts`
- **Activities:** `src/workers/activities/{activity-id}.ts`
- **Services:** `src/services/{service-id}Service.ts`
- **Test files:** `{module}.test.ts` (unit), `{module}.e2e.test.ts` (E2E)

### ADR Template
```markdown
# ADR-{NNNN}: {Title}
**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated
**Context:** {what forced this decision}
**Decision:** {what we decided}
**Alternatives Considered:** {other options and why we rejected them}
**Consequences:** {what changes as a result}
```

---

## Anti-Pattern Catalog

| Anti-Pattern | Why It Fails | How to Avoid |
|---|---|---|
| Circular imports at runtime | Module initialization deadlock | Use type-only imports; no side effects in module top-level |
| Dynamic `require()` inside scaffolds | Platform-quirks, TS resolution failures | Use module-level `import { writeFileSync } from 'fs'` |
| Template method references (`this.genSpecTemplate`) | `this` is undefined in async scaffold context | Inline the template logic or pass a static helper |
| Writing outside `generated-apps/` | Path traversal RCE risk | Always check `path.startsWith(OUT_DIR)` before writes |
| Silently swallowing errors | Debugging impossible | Always return structured `{ error }` and log the full stack |
| No tests for new modules | Every change risks regression | PR requires tests for every new export |
| Massive single-file endpoints (`index.ts`) | Unreviewable, high-collision | Split into router modules progressively |
| Hardcoding port numbers | Env conflict in containerized setups | Use `process.env.PORT` with fallback |

---

## Current Codebase State (post-Phase 0)

| Module | Status | Notes |
|---|---|---|
| `src/coding-agent/templates/registry.ts` | ✅ Clean | 3 templates, keyword scoring, no cycles |
| `src/services/codingAgentService.ts` | ✅ Clean | Guards, structured result, `walkFiles()` |
| `src/server/editorService.ts` | ⚠️ Unused | Needs to be wired to `/api/editor/*` routes |
| `src/server/index.ts` | ⚠️ Partial | `/api/coding/generate` exists; needs template API + editor routes |
| `docs/superpowers/specs/` | ⚠️ Design docs | Temporal + LangGraph designs need review and implementation |
| `plans/nexus-alpha-...` | ⚠️ Strategic | Transformation plan needs phase alignment with this doc |

---

## Open Questions (to be resolved before each phase)

### Before Phase 1
- [ ] Electron shell or Monaco-in-browser? (decision needed for ADR-0003)
- [ ] Ollama detection: auto-install prompt or manual? (decision needed for ADR-0004)
- [ ] Template versioning: semantic or hash-based?

### Before Phase 2
- [ ] LLM provider fallback: Gemini → OpenRouter or Gemini → Ollama? (consistency with ADR-0004)
- [ ] LangGraph state schema: flat object or typed StateGraph? (consistency with existing design doc)
- [ ] Temporal server: self-hosted or Temporal Cloud? (affects deployment plan)

### Before Phase 3
- [ ] Collaboration: Yjs CRDT or operational transform? (decision needed for ADR-0008)
- [ ] Deployment: Vercel CLI vs Netlify CLI vs raw Docker? (priority needed)
- [ ] Extension sandbox: Web Worker or subprocess isolation?

---

## Changelog

| Date | Phase | Change | Rationale |
|---|---|---|---|
| 2026-04-30 | 0 | Added registry. ts (3 templates, keyword scoring) | Eliminating broken `this.*` refs and dynamic requires |
| 2026-04-30 | 0 | Refactored codingAgentService. ts (guards, walkFiles) | Adding safety + traceability |
| 2026-04-30 | 0 | Added PLAN-NEXUS-IDE-FULL-IMPLEMENTATION.md | Authoritative implementation plan |
| 2026-04-30 | 0 | Added this ADR log | Capturing design decisions for future reference |

---

*This plan is a living document. Update it before beginning each phase and link ADRs from `docs/adr/`.*
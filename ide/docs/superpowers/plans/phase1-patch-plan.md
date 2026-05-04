# Phase 1 Patch Plan: Core MVP — Desktop Shell + Coding Engine + Mission Control
> **For:** `feature/phase1-desktop-shell` branch
> **Date:** 2026-04-30
> **Status:** PROPOSED (do not merge until all items verified)

--- 
## Overview
Phase 1 delivers a runnable desktop-like experience with: a file-browser sidebar for generated apps, template selection via description or explicit ID, local/offline mode toggle, and a basic Mission Control panel for agent spawning and monitoring. All changes are additive; no existing routes or tests are modified or removed.

---

## PATCH A — Editor Service wiring (`src/server/editorService. ts`)
```
File: src/server/editorService. ts
Action: COMPLETE (file exists but not yet wired to routes)

Changes:
1. Export listAppFiles(appPath: string): FileTree[] | null
   - Reads {OUT_DIR}/{appPath}, returns tree of { name, type: 'file'|'dir', children? }
   - Guard: abs. startsWith(OUT_DIR) — null on violation

2. Export readAppFile(filePath: string): string | null
   - Resolves {OUT_DIR}/{filePath}, returns file content
   - Guard: abs. startsWith(OUT_DIR) — null on violation

3. Export writeAppFile(filePath: string, content: string): void
   - Writes to {OUT_DIR}/{filePath}, enforces boundary
   - Guard: path traversal → throws
   - Guard: content length > 5MB → throws

4. Export listGeneratedApps(): Array<{ id, path, createdAt, templateId }>
   - Reads all subdirs under OUT_DIR
   - Returns metadata without scanning contents

All functions use the OUT_DIR constant from CodingAgentService.
No new dependencies introduced.
```

---

## PATCH B — Template Registry API (`src/server/index. ts`)
```
File: src/server/index. ts
Action: ADD (route registration only, no new files)

Changes (in app. use("/api/") section):
1. GET /api/coding/templates
   - Calls listTemplates()
   - Returns: { templates: [{ id, name, description }] }

2. GET /api/editor/list?appPath= {id}
   - Calls listAppFiles(id)
   - Returns: { tree } or 404

3. GET /api/editor/file?path= {relativePath}
   - Calls readAppFile(relativePath)
   - Returns: { path, content } or 404

4. POST /api/editor/file
   - Body: { path: string, content: string }
   - Calls writeAppFile(path, content)
   - Returns: { updated: true } or 400/403

5. GET /api/editor/apps
   - Calls listGeneratedApps()
   - Returns: { apps: [...] }

All routes are:
- Authenticated (Nexus API key required)
- Rate-limited via existing strictLimiter
- Return structured JSON (no raw Error messages)

No changes to existing routes or middleware.
```

---

## PATCH C — Enhanced Codegen Endpoint (`src/server/index. ts`)
```
File: src/server/index. ts
Action: MODIFY existing /api/coding/generate

Changes to existing POST /api/coding/generate:
- Request body extended:
  {
    "description": string,           // required
    "templateId?": string,         // optional override
    "privacyPreference?": "local" | "cloud"  // optional
  }
- Response extended:
  {
    "appPath": string,           // absolute path on server
    "success": boolean,
    "message": string,
    "templateId": string,      // now always present
    "files": string[],        // list of written files
    "appId": string,         // friendly ID (last path segment)
    "generatedAt": string    // ISO timestamp
  }
- Privacy mode: stored in process. env. PRIVACY_MODE (set via /api/settings endpoint)
- If templateId override: calls getTemplateForDescription() but enforces override ID if it exists in registry
```

---

## PATCH D — Privacy Mode API (`src/server/index. ts`)
```
File: src/server/index. ts
Action: ADD

Changes:
1. GET /api/settings/privacy-mode
   - Returns: { mode: "local" | "cloud", ollamaAvailable: boolean }
   - Checks Ollama availability via GET http://localhost:11434/api/tags

2. POST /api/settings/privacy-mode
   - Body: { mode: "local" | "cloud" }
   - Sets process. env. PRIVACY_MODE
   - Returns: { applied: true }
```

---

## PATCH E — Mission Control Panel (`src/App.tsx` or new component)
```
File: src/views/MissionControlTab. tsx (new component)
Action: ADD

Structure:
- Tab or collapsible drawer in the app shell
- Sections:
  1. "New Generation" — textarea for description + Generate button
     - Calls POST /api/coding/generate on submit
     - On success: shows appPath + "Open in Explorer" button + file list
  2. "Template Selector" — dropdown from GET /api/coding/templates
  3. "Privacy Mode" — toggle switch (calls POST /api/settings/privacy-mode)
  4. "Agent Mission Control" — spawn/monitor/pause for agent tasks
     - Calls GET /api/agents/status (placeholder in Phase 1)
     - WebSocket listener for type: 'agent:update'
  5. "Generated Apps" — list from GET /api/editor/apps
     - Click to expand: shows file tree via GET /api/editor/list
     - Click file: shows content via GET /api/editor/file
     - Edit button: opens textarea → POST /api/editor/file

Dependencies added:
- react (existing)
- lucide-react for icons (existing)
- No new package dependencies
- Lazy-load component to avoid bundle bloat
```

---

## PATCH F — Test Scaffolding
```
File: src/services/__tests__/codingAgentService. test. ts (new)
Actions:
1. describe('CodingAgentService')
   - it('returns success with valid description')
     service. generateApp({ description: 'Build a todo app' })
     expect(result. success).toBe(true)
     expect(result. templateId).toBeDefined()
     expect(result. files).toBeInstanceOf(Array)
   - it('returns failure for short description')
     service. generateApp({ description: 'a' })
     expect(result. success).toBe(false)
   - it('returns failure for path traversal attempt')
     service. generateApp({ description: '../etc/passwd' })
     expect(result. success).toBe(false)
   - it('selects express-api template for API prompts')
     service. generateApp({ description: 'REST API server' })
     expect(result. templateId).toBe('express-api')
   - it('selects fullstack for full-Stack prompts')
     service. generateApp({ description: 'Build a full-Stack blog app' })
     expect(result. templateId).toBe('fullstack')

File: src/coding-agent/templates/__tests__/registry. test. ts (new)
Actions:
1. describe('getTemplateForDescription')
   - it('returns react-TS-vite for generic prompts')
   - it('returns express-api for API prompts')
   - it('returns fullstack for fullstack prompts')
   - it('returns react-TS-vite as default for unknown')

File: src/server/__tests__/coding. test. ts (new)
Actions:
1. describe('POST /api/coding/generate')
   - it('returns 200 with valid description')
   - it('returns 400 for missing description')
   - it('returns appPath and files in response')
```

---

## Verification Checklist (before PR approval)
```
Pre-flight:
[ ] npm run build — must pass (no new type errors)
[ ] npm run lint — must pass (no new lint warnings)
[ ] npm test — all new unit tests pass
[ ] Manual: POST /api/coding/generate returns structured JSON with files array
[ ] Manual: GET /api/coding/templates returns 3 templates
[ ] Manual: GET /api/editor/apps returns empty array initially
[ ] Manual: GET /api/editor/list?appPath=nonexistent returns 404
[ ] Manual: GET /api/editor/file?path=../etc/passwd returns 400 (path traversal blocked)
[ ] Manual: Mission Control tab renders without errors
[ ] Manual: POST /api/settings/privacy-mode returns 200

Rollback plan:
- git checkout — src/server/editorService. ts (revert to unused state)
- Remove new routes from index. ts (revert API additions)
- Delete Mission Control component files
- No core functionality is affected (existing endpoints unchanged)
```

---

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Path traversal via crafted relative paths | Medium | High | `startsWith(OUT_DIR)` guard on every function |
| Monaco bundle bloat | Medium | Medium | Lazy-load Mission Control + code-split in vite config |
| Ollama detection fails silently | High | Low | Show "Cloud Mode" default; explicit setup wizard in Phase 2 |
| WebSocket reconnect storms | Medium | Low | Exponential backoff; max 3 retries |
| Generated apps directory grows unbounded | Medium | Low | Add `cleanupOldApps()` cron or manual delete endpoint in Phase 2 |
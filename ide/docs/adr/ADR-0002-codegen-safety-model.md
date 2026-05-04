# ADR-0002: Codegen Safety Model
**Date:** 2026-04-30
**Status:** Accepted
**Context:** `POST /api/editor/file` writes user-provided content to disk. Without strict guards, this is a path traversal + arbitrary-write RCE risk. Similarly, the codegen pipeline (`CodingAgentService`) writes scaffolded files and must be confined to a safe output directory.
**Decision:** Every file-write operation enforces three layers of defense:
1. **Output boundary guard:** `appRoot.startsWith(OUT_DIR + sep)` — no write proceeds if path escapes generated-apps/{id}/
2. **Pre-existence guard:** reject if the target directory already exists (never overwrite a running app)
3. **Input length guard:** reject descriptions < 3 chars (no empty/garbage prompts)
4. **Description sanitization:** use `JSON.stringify()` for embedding prompt into generated files (no eval(), no template literals with raw user strings)
**API-level enforcement:**
- Editor file write: always resolve relative to `OUT_DIR`, never allow `../`
- Codegen output: always under `generated-apps/{id}/`, never configurable via request
- Response: always structured `{ success, message, appPath? }` — never throw raw errors to client
**Alternatives Considered:**
- Allow configurable OUT_DIR via env var only (not request): deferred — increases operational complexity
- Path traversal detection via regex: rejected — easier to bypass than `startsWith` check
**Consequences:**
- All file writes (templates, editor, pipeline) route through the OUT_DIR boundary check
- Any violation = 400 response, never 500 (don't expose internal paths in error messages)
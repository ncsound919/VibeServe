# VibeServe MCP Integration Bug Report

**Date:** 2026-05-05
**Reporter:** UI Professionalization Pipeline Test

## Confirmed Bugs

### 1. `ctx` parameter leaks into public tool schema (FastMCP context injection failure)
- **Symptom:** `vibe_architect` tool declares `ctx` as a required argument in its JSON schema
- **Expected:** `ctx` should be FastMCP's auto-injected Context object (`.info()`, `.error()`, `.request_id`)
- **Actual:** Client is required to pass `ctx` as a business parameter, which conflicts with FastMCP framework usage
- **Evidence:** 
  - Without `ctx`: `Missing required argument [type=missing_argument] for ctx`
  - With `ctx` set to intent string: `'str' object has no attribute 'info'` (tool crashes trying to call `.info()` on the string)
- **Root cause:** FastMCP context parameter leaking into published tool schema

### 2. `constraints` field type mismatch
- **Expected:** String ("Target stack: react-typescript-tailwind")
- **Actual:** Tool expects `list_type`, receives string → validation error
- **Fix applied:** Changed to array `["Target stack: react-typescript-tailwind"]`

### 3. `plan` and `design_system` type mismatch
- **Expected:** Native JSON objects (dicts in Python)
- **Actual:** Pipeline was `JSON.stringify()` them into strings, causing Pydantic dict_type validation errors
- **Fix applied:** Pass raw objects, remove `JSON.stringify()`

### 4. False success reporting
- **Symptom:** Pipeline step marked "completed" even when tool returned validation errors
- **Expected:** Step should be "failed" with error logged
- **Fix applied:** Added `isToolFailure()` check after every MCP call, throws on failure, catches in pipeline error handler

### 5. Inconsistent parameter naming across tools
- `vibe_architect` accepts `intent` + `constraints`
- `vibe_review` accepts `files` + `requirements` 
- `vibe_code` accepts `intent` + `plan` + `design_system`
- `vibe_verify` accepts `files`
- `vibe_iterate` accepts `specification` + `requirements` + `max_iterations` + `quality_threshold`
- `vibe_test` accepts `files` + `requirements`
- `vibe_deploy` accepts `project_name` + `files`

## Impact

- MCP pipeline cannot be reliably used for code generation until these issues are fixed on the Python server side
- Workaround: Manual implementation of UI components or direct Python-level MCP tool fixes

## Recommended Fixes

1. **Python side:** Hide `ctx` from published tool schemas by using FastMCP's dependency injection properly
2. **Python side:** Accept both string and list for `constraints` or document the type strictly
3. **Python side:** Accept both string (auto-parsed JSON) and dict for `plan`/`design_system`/`files`
4. **Node side (done):** Pass native objects, add failure detection, gate step completion on success

## Test Artifacts

- Pipeline run logs: `.planning/mcp-pipeline-result.json`
- Fixed pipeline logs: `.planning/mcp-fixed-result.json`
- Raw error outputs: `.planning/vibeserve-code-raw.txt`

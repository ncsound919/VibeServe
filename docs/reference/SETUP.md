# SETUP — How to Get This Build Working

## 1. Start Ollama (required for pipeline tools)

```powershell
ollama serve                                    # start Ollama
ollama pull qwen3.5:4b                          # pull the model (if not present)
```

Without Ollama running, 6 of 7 pipeline tools return empty results.

## 2. Restart OpenCode

Close and reopen OpenCode Desktop. The vibeserve MCP path has been fixed and context7 documentation lookup has been enabled.

## 3. Verify MCP servers

In OpenCode, check MCP status:
```
vibeserve  ✓ connected     (Python MCP server on localhost)
context7   ✓ connected     (documentation lookup)
gh_grep    ○ disabled      (optional — enable for code search)
```

## 4. Run tests

```
python -m pytest tests/ -v --no-cov
```

## 5. Run a demo

```
python -m vibeserve --vibe-demo
```

This runs vibe_architect → vibe_code end-to-end. With Ollama running, the LLM calls will succeed and you'll get real output.

## What was fixed

| Issue | Before | After |
|-------|--------|-------|
| vibeserve MCP path | `.../AetherNexus-MCP-main/vibeserve.py` (deleted) | `.../VibeServe/vibeserve/core.py` |
| PYTHONPATH | Missing | Set to VibeServe root |
| context7 MCP | Disabled | Enabled — real-time docs for React, FastMCP, Playwright |
| AGENTS.md | Outdated, referenced deleted project | Updated with real file map, honest status |
| Agents | 2 basic agents | Added build agent + security auditor |
| OPENCODE.md | Missing | Created with project context |

# AetherNexus-MCP

Agentic UI Coding Orchestrator for the Model Context Protocol.

## Stack
- Python (vibeserve.py, FastMCP)
- Node.js/TypeScript
- Playwright for E2E testing
- Ollama for local LLM

## Key files
- `vibeserve.py` - Main VibeServe MCP server (entry point)
- `tests/test_aether_nexus.py` - Core tests
- `uischema_react_renderer.jsx` - React UI renderer
- `mcp-registry/glama.json` - Glama MCP registry entry
- `mcp-registry/smithery.json` - Smithery MCP registry entry

## Architecture
7-step pipeline: architect -> code -> review -> verify -> iterate -> test -> deploy
Multi-agent critique with WCAG AAA enforcement.
Design tokens and design system enforcement built in.

## Available tools
AetherNexus MCP tools (via vibeserve):
- aethernexus_generate_ui_spec - Generate UI specs with multi-agent critique
- aethernexus_validate_ui_spec - Validate specs against WCAG/design system
- aethernexus_list_design_systems - List available design systems
- aethernexus_memory_stats - View learned UI specifications
- aethernexus_vibe_architect - Architecture planning from intent
- aethernexus_vibe_code - Generate code from architecture plans
- aethernexus_vibe_review - Multi-agent code review
- aethernexus_vibe_verify - Validate code against standards
- aethernexus_vibe_iterate - Continuous improvement loop
- aethernexus_vibe_test - Generate comprehensive tests
- aethernexus_vibe_deploy - Generate deployment configs

## GSD Workflow
GSD (Get Shit Done) is installed globally. Use /gsd- commands in OpenCode:
- `/gsd-new-project` - Full initialization
- `/gsd-discuss-phase N` - Implementation decisions
- `/gsd-plan-phase N` - Research + plan + verify
- `/gsd-execute-phase N` - Execute plans in parallel waves
- `/gsd-verify-work N` - User acceptance testing

## Skills
ECC skills are available in ~/.config/opencode/skills/ecc/
Superpowers skills are in ~/.config/opencode/skills/superpowers/
Use the `skill` tool to load skills on demand.

## Custom agents
- @code-reviewer - Code review agent (read-only)
- @docs-writer - Documentation writing agent

## MCP servers configured
- vibeserve (local) - AetherNexus pipeline
- context7 (remote, disabled) - Documentation lookup
- gh_grep (remote, disabled) - Code search via grep.app

## Testing
- Run: pytest tests/
- Coverage: pytest --cov=. tests/

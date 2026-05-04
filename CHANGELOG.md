# Changelog

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
- Package URLs unified to `github.com/ncsound919/AetherNexus-MCP`
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

# Changelog

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

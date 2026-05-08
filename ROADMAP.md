# VibeServe Roadmap

## Shipped (v1.1)

### IDE Features
- Monaco editor with vim mode, collaboration
- Tab/Explorer/File tree - file management
- Command palette
- ComposerPanel with streaming tokens via WebSocket
- @file/@symbol/@docs mention parsing
- Apply/reject diff UI for proposed changes
- AgentQueue with 7-step pipeline visualization
- StatusBar with agent queue depth indicator

### Backend
- Python MCP server (28+ tools)
- WebSocket streaming for AI responses
- Multi-LLM router (OpenAI, DeepSeek, OpenRouter, Local)

### Project Structure
- Clean monorepo with /ide, /vibeserve, /codenexus
- .gitignore properly configured
- No generated files committed

## In Progress

### Desktop Build
- Electron packaging configured
- macOS dmg, Windows nsis, Linux AppImage targets
- Need: icon files and signing certificates

### Demo
- Screen recording showing: open project → describe task → agent proposes diff → user applies → tests pass
- Replace static banner with demo GIF

## Planned

### Agent Workflows
- Streaming token output (Cursor-style)
- @file, @symbol context injection
- Human-in-the-loop pause/resume controls
- Real-time AuditLogger → DebugPanel

### Quality of Life
- One-command startup from root: `vibeserve start`
- Downloads page
- CHANGELOG.md as changelog

### Future (v2.0)
- Desktop app release
- Extension marketplace
- Team collaboration features
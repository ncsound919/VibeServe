# Trending Open Source Tools for Nexus Alpha Integration

## Top Tools to Wire In (by category)

---

## 1. AI Code Editors / Agents (Fork & Learn From)

| Tool | Stars | Description | Integration Value |
|------|-------|-------------|-------------------|
| **Void IDE** | 28.5k | Open-source Cursor alternative, VS Code fork | Reference for desktop IDE architecture |
| **Skycode** | 10k+ | VS Code fork with 30+ AI tools, 40+ model providers | Inline diff system, semantic search |
| **Roo Code** | 23.6k | AI dev team in VS Code, multi-mode system | Agent orchestration patterns |
| **Flexpilot IDE** | 2.2k | Privacy-first VS Code fork, BYO keys | Privacy-first architecture |
| **CortexIDE** | - | Open-source Cursor alternative | Another reference fork |
| **Mux** | 1.6k | Desktop app for parallel agentic dev | Multi-agent management UI |
| **Orca** | - | Next-gen IDE for coding agents | Worktree-native patterns |

**Quick Win**: Study Void's checkpoint/visualization system and Mux's parallel agent UI

---

## 2. MCP Servers (Wire Directly)

| Server | Stars | Description | Nexus Integration |
|--------|-------|-------------|-------------------|
| **MCP Servers Repo** | 84.8k | Official reference implementations | Use as foundation |
| **awesome-mcp-servers** | 85.9k | Curated MCP server list | Discovery & catalog |
| **Playwright MCP** | 31.2k | Browser automation | Add to agent tools |
| **GitHub MCP Server** | 29.1k | Repo, issues, PR operations | Git integration |
| **Context7 MCP** | 5k+ | Up-to-date code context | Enhance code understanding |
| **Serena** | 22.5k | Semantic code retrieval/ editing | Symbol-level editing |
| **Code Index MCP** | 869 | Codebase indexing for LLMs | Fast context retrieval |
| **Azure MCP** | 3k | Azure cloud integration | Future cloud features |

**Priority Integration**: GitHub MCP + Playwright MCP + Context7 MCP

---

## 3. CLI Coding Agents (Reference)

| Tool | Stars | Description | Learn From |
|------|-------|-------------|------------|
| **OpenAI Codex CLI** | 79k | Lightweight terminal coding agent | CLI UX patterns |
| **SST OpenCode** | 37k | Open-source coding agent | Terminal integration |
| **Claude Code** | - | Anthropic's CLI agent | Best practices |

---

## 4. RAG & Context Tools

| Tool | Stars | Description | Use Case |
|------|-------|-------------|----------|
| **UltraRAG** | 5.5k | Low-code MCP RAG framework | Build RAG pipelines |
| **context7** | 5k+ | Version-specific code docs | Code understanding |
| **AnyQuery** | - | Query 40+ apps via SQL | Database integration |

---

## 5. Recommended Integration Priority

### Phase 1 (This Week)
1. **Playwright MCP** - Add browser automation to agents
2. **GitHub MCP** - Repository operations, PRs, issues
3. **Context7** - Enhanced code documentation retrieval

### Phase 2 (Next 2 Weeks)
4. **Serena** - Symbol-level code editing (as reference)
5. **Code Index MCP** - Fast codebase indexing
6. **Roo Code patterns** - Study agent modes implementation

### Phase 3 (This Month)
7. **Mux** patterns - Parallel agent UI/UX
8. **Void checkpoint system** - Visualization
9. **OpenAI Codex CLI** - Terminal integration

---

## 6. Tech Stack Patterns to Adopt

From trending repos:
- **VS Code fork** - Most successful AI IDEs are VS Code derivatives
- **MCP-first** - Protocol standardization is now mandatory
- **Local + Cloud** - Hybrid LLM routing is standard
- **Multi-agent** - Parallel execution is the norm
- **Inline diffs** - Accept/reject workflow for AI changes

---

## 7. Gaps vs Competitors

| Competitor | Their Strength | Nexus Gap |
|------------|----------------|------------|
| Cursor | Composing entire apps | Need multi-file planner |
| Cline | Terminal-first workflow | Need better terminal integration |
| Roo Code | Multi-mode system | Need mode switching |
| Void | Checkpoint/visualization | Need version tracking UI |
| Codex CLI | Native CLI UX | Need terminal-first entry |

---

## Quick Action Items

1. `npm install @modelcontextprotocol/server-playwright`
2. `npm install @modelcontextprotocol/server-github` 
3. Study Void's checkpoint UI implementation
4. Add Serena as MCP tool for symbol-level editing
5. Fork/discuss Mux parallel agent patterns

---

*Last updated: May 2026 - Based on GitHub trending data*
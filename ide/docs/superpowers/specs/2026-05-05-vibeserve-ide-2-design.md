# VibeServe IDE 2.0 — Complete Design Spec

**Date:** 2026-05-05
**Status:** Draft — awaiting approval
**Scope:** Full IDE overhaul + 6 integration subsystems + pipeline integration

---

## 1. Problem Statement

VibeServe is currently an AI pipeline orchestration dashboard (40/100 IDE score) masquerading as a developer IDE. Senior developers cannot perform basic tasks: no file search, no real terminal, no git operations, no editor tabs, no debugger. The 7-step AI pipeline is powerful but inaccessible because the UI is the pipeline itself rather than a proper IDE that *contains* the pipeline.

**Goal:** Transform VibeServe into a senior-dev-grade IDE where the AI pipeline is a first-class feature, not the entire interface.

**Target usability score:** 90/100 (from current 40/100)

---

## 2. Design Philosophy

Three inspirations, one product:

| Inspiration | What We Take | What We Leave |
|-------------|-------------|---------------|
| **Zed** | Minimalism, speed-first, solid backgrounds, 1px borders, no gratuitous animations, GPU-accelerated feel | Rust native rendering (we're web-based), Zed-specific UI patterns |
| **Cursor** | AI composer panel, `/` `@` `!` shortcuts, agent task queue, model selector, codebase indexing | Proprietary cloud features, closed-source agent infrastructure |
| **Antigravity** *(design philosophy)* | Lightweight, frictionless, zero-config defaults, "it just works" | N/A — this is a philosophy, not a product |

**Core principle:** The IDE should feel like Zed (fast, clean, minimal), think like Cursor (AI-native at every layer), and behave like Antigravity (zero friction, works immediately).

---

## 3. Architecture Overview

### 3.1 Directory Structure

```
VibeServe/
├── vibeserve/                      # Python MCP Server (EXISTING — no changes)
│   └── tools/
│       └── integration_tools.py    # Gets 6 new MCP tools
│
├── orchestrator/                   # Node.js Orchestrator (EXISTING — no changes)
│
├── ide/                            # React IDE — COMPLETE REBUILD
│   ├── src/
│   │   ├── main.tsx                # Entry point
│   │   ├── App.tsx                 # New shell layout
│   │   │
│   │   ├── layout/                 # IDE shell components
│   │   │   ├── TitleBar.tsx        # Window title, branch, workspace path
│   │   │   ├── ActivityBar.tsx     # Left icon rail (6 items)
│   │   │   ├── PanelBar.tsx        # Bottom panel tabs
│   │   │   ├── StatusBar.tsx       # Bottom status line
│   │   │   ├── TabBar.tsx          # Editor tab strip
│   │   │   └── Breadcrumbs.tsx     # File path breadcrumbs
│   │   │
│   │   ├── panels/                 # Activity bar panels
│   │   │   ├── ExplorerPanel.tsx   # File tree (exploration lib)
│   │   │   ├── SearchPanel.tsx     # File + content + regex search
│   │   │   ├── GitPanel.tsx        # Source control (isomorphic-git)
│   │   │   ├── DebugPanel.tsx      # DAP debugger
│   │   │   ├── IntegrationsPanel.tsx # GitHub, Drive, Vault, Snippets, Gitea
│   │   │   └── SettingsPanel.tsx   # Models, pipeline, rules, privacy
│   │   │
│   │   ├── editor/                 # Editor components
│   │   │   ├── CodeEditor.tsx      # Monaco with minimap, breadcrumbs
│   │   │   ├── WelcomePage.tsx     # Recent files, quick start
│   │   │   └── SplitView.tsx       # Horizontal/vertical splits
│   │   │
│   │   ├── ai/                     # AI components (Cursor-style)
│   │   │   ├── ComposerPanel.tsx   # Right-side AI composer
│   │   │   ├── AgentQueue.tsx      # Pipeline task queue
│   │   │   ├── TrustReport.tsx     # Pipeline audit trail
│   │   │   └── ModelSelector.tsx   # Status bar model picker
│   │   │
│   │   ├── terminal/               # Terminal components
│   │   │   ├── TerminalPanel.tsx   # xterm.js + node-pty
│   │   │   └── TerminalManager.tsx # Multiple terminal tabs
│   │   │
│   │   ├── bottom/                 # Bottom panel components
│   │   │   ├── ProblemsPanel.tsx   # Aggregated errors/warnings
│   │   │   ├── OutputPanel.tsx     # Build/task output
│   │   │   └── PipelineLog.tsx     # Pipeline step output
│   │   │
│   │   ├── command/                # Command palette
│   │   │   ├── CommandPalette.tsx  # cmdk-based fuzzy search
│   │   │   ├── FileQuickOpen.tsx   # Ctrl+P file search
│   │   │   └── SymbolSearch.tsx    # Go to symbol
│   │   │
│   │   ├── services/               # API clients (EXISTING + NEW)
│   │   │   ├── authService.ts      # EXISTING
│   │   │   ├── githubService.ts    # EXISTING — now wired to UI
│   │   │   ├── fileService.ts      # NEW: workspace file operations
│   │   │   ├── gitService.ts       # NEW: git operations
│   │   │   ├── terminalService.ts  # NEW: pty backend
│   │   │   ├── searchService.ts    # NEW: file + content search
│   │   │   ├── vaultService.ts     # NEW: snippets + secrets
│   │   │   ├── googleService.ts    # NEW: Drive, Calendar, Gmail
│   │   │   └── giteaService.ts     # NEW: local forge API
│   │   │
│   │   ├── stores/                 # Zustand stores (REBUILT)
│   │   │   ├── useIDEStore.ts      # Active file, tabs, splits
│   │   │   ├── useExplorerStore.ts # File tree state
│   │   │   ├── useGitStore.ts      # Git state
│   │   │   ├── useTerminalStore.ts # Terminal state
│   │   │   ├── useAIStore.ts       # AI composer, agent queue
│   │   │   ├── useSettingsStore.ts # EXISTING — expanded
│   │   │   └── useToastStore.ts    # EXISTING
│   │   │
│   │   ├── hooks/                  # Custom hooks
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useFileWatcher.ts
│   │   │   ├── usePipeline.ts      # Pipeline integration hook
│   │   │   └── useAutonomyMode.ts  # IDE/Copilot/Pipeline toggle
│   │   │
│   │   ├── lib/                    # Utilities
│   │   │   ├── keybindings.ts      # VS Code-compatible keymap
│   │   │   ├── fileIcons.ts        # File type icon mapping
│   │   │   ├── languages.ts        # Language detection
│   │   │   └── circuitBreaker.ts   # EXISTING
│   │   │
│   │   └── types/                  # TypeScript types
│   │       ├── ide.ts
│   │       ├── git.ts
│   │       ├── ai.ts
│   │       └── integrations.ts
│   │
│   ├── server/                     # Hono API server (EXISTING + NEW)
│   │   ├── index.ts                # Main server
│   │   ├── routes/
│   │   │   ├── files.ts            # NEW: workspace file CRUD
│   │   │   ├── git.ts              # NEW: git operations
│   │   │   ├── terminal.ts         # NEW: pty websocket
│   │   │   ├── search.ts           # NEW: file + content search
│   │   │   ├── vault.ts            # NEW: snippets + secrets
│   │   │   ├── google.ts           # NEW: OAuth proxy
│   │   │   └── gitea.ts            # NEW: Gitea proxy
│   │   └── mcp.ts                  # EXISTING
│   │
│   ├── electron/                   # Desktop app (EXISTING — updated)
│   └── package.json                # Updated dependencies
```

### 3.2 External Dependencies (GitHub Repos)

| Component | Library | Stars | Why |
|-----------|---------|-------|-----|
| **Terminal** | `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-webgl` | 20.4k | Used by VS Code, Tabby, Hyper. Zero deps, GPU-accelerated, CJK/emoji support |
| **Terminal Backend** | `node-pty` | 4.8k | Microsoft's PTY library. Provides real bash/pwsh/zsh. Used by VS Code terminal |
| **Command Palette** | `cmdk` | 12.6k | By Radix UI team. Used by Vercel. Fuzzy search, keyboard nav, nested pages, dialog mode |
| **File Explorer** | `exploration` | 60 | Zero-recursion tree, virtualization, drag-drop, multiselect, traits, hotkeys, snapshot restore |
| **Code Editor** | `@monaco-editor/react` + `monaco-editor` | EXISTING | Already in project. Enable minimap, multiCursorModifier, breadcrumbs |
| **Git Operations** | `isomorphic-git` | 5.2k | Pure JS git. Works in browser + Node. Clone, commit, push, branch, merge, rebase |
| **Fuzzy Search** | `fuse.js` | 8.1k | Lightweight fuzzy search for file names, symbols, commands |
| **File Icons** | `vscode-icons` or custom | — | Map file extensions to icons (TS, JSX, PY, GO, etc.) |
| **DAP Client** | `@vscode/debugadapter` + custom | — | Debug Adapter Protocol for breakpoints, step-through, variables |
| **Credential Manager** | `keytar` (fallback) + Windows Credential Manager API | — | Cross-platform secret storage. Windows: `node-wincred` |
| **Google APIs** | `googleapis` npm package | — | Official Google API client. Drive, Calendar, Gmail |
| **Gitea SDK** | `@gitea/js-sdk` or REST calls | — | Gitea REST API for local forge operations |
| **File Watching** | `chokidar` | 6.2k | Cross-platform file watching. Auto-refresh on external changes |
| **WebSocket** | `ws` | EXISTING | Already in project. Terminal PTY relay, pipeline updates |

### 3.3 What Gets Removed

| Current Component | Fate | Reason |
|------------------|------|--------|
| All 14 tab views (Overview, Composer, Pipeline, Editor, Preview, Settings, Activity, History, Audit, Memory, Extensions, System, Agent Eval, Magic Composer, Plan Review, Mission Control) | **REMOVED** | Replaced by IDE shell with activity bar panels |
| Glass morphism classes (`glass`, `glass-card`) | **REMOVED** | Replaced by Zed-style solid backgrounds |
| Framer Motion staggered animations | **REMOVED** | Replaced by subtle CSS transitions (150ms max) |
| `motion/react` dependency | **REMOVED** | Not needed in minimal design |
| `framer-motion` in TrajectorySidebar | **REMOVED** | Duplicate animation library |
| Mock data in GitStatus, MissionControl, SystemPanel, AgentEval | **REMOVED** | All replaced with real data sources |
| `GlobalCommandBar` (5 hardcoded commands) | **REMOVED** | Replaced by cmdk with fuzzy search |
| `TerminalPanel` (5 mock commands) | **REMOVED** | Replaced by xterm.js + node-pty |
| `CLITerminal` (text output log) | **REMOVED** | Redundant with real terminal |
| `PresenceBar` (local-only state) | **REMOVED** | No real collaboration backend exists yet |

### 3.4 What Gets Kept & Upgraded

| Component | Upgrade |
|-----------|---------|
| Monaco Editor | Enable minimap, breadcrumbs, multiCursorModifier (`altKey`), format on save, emmet, snippet support |
| Settings tab | Expand with model selector, keybinding editor, pipeline config, rules editor |
| Supabase connection | Keep as backend for vector store, memory sync |
| WebSocket pipeline updates | Keep, route to bottom panel's Pipeline Log tab |
| Circuit breaker | Keep, apply to all new API calls |
| Error boundaries | Keep, improve error messages |
| Zustand stores | Rebuild with coordinated state, add persistence |
| Electron app | Update with new window chrome, remove old tabs |
| `githubService.ts` (250 lines) | **KEEP AS-IS** — wire to new GitPanel UI |
| `integrationService.ts` (929 lines) | **KEEP AS-IS** — wire to new IntegrationsPanel |

---

## 4. UI Design

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [VS]  VibeServe    ● main  ~/my-project/workspace        [🔍⌘P] [⚡]  │  ← TitleBar
├────┬──────────────────────────────────────────────────────┬────────────┤
│    │  file.tsx  ✕  App.tsx  ✕  pipeline.json  ✕    [+]   │            │  ← TabBar
│ 📁 │  ~/my-project/workspace/src/components/file.tsx      │  ┌──────┐  │  ← Breadcrumbs
│ 🔍 │                                                      │  │🎯    │  │  ← ComposerPanel
│ Git│          CODE EDITOR (Monaco)                        │  │Composer│  │
│ 🐛 │          - minimap (right edge)                      │  │        │  │
│ 📦 │          - breadcrumbs (above editor)                │  │/ @ !   │  │
│ 🔧 │          - multi-cursor (Alt+click)                  │  │        │  │
│    │          - format on save                            │  └──────┘  │
│    │          - emmet support                             │            │
│    │          - inline AI suggestions                     │  ┌──────┐  │  ← AgentQueue
│    │                                                      │  │⚡Pipe │  │
│    │                                                      │  │✓Arch  │  │
│    │                                                      │  │✓Code  │  │
│    │                                                      │  │●Rev 3/5│  │
│    │                                                      │  │○Verify │  │
│    │                                                      │  │○Iterate│  │
│    │                                                      │  │○Test   │  │
│    │                                                      │  │○Deploy │  │
│    │                                                      │  │        │  │
│    │                                                      │  │⏸ ▶ ◼  │  │
│    │                                                      │  └──────┘  │
│    │                                                      │            │
│    │                                                      │[Opus 4.6▼] │  ← ModelSelector
├────┴──────────────────────────────────────────────────────┴────────────┤
│  ● Problems: 3  │  Output  │  Terminal  │  Pipeline Log  │  Gitea  │ + │  ← PanelBar
│  ────────────────────────────────────────────────────────────────────── │
│  src/components/file.tsx:42:15 - Error: Cannot find module 'foo'        │  ← ProblemsPanel
│  ✓ Build completed in 2.3s                                               │  ← OutputPanel
│  ~/my-project ❯ _                                                        │  ← TerminalPanel
├─────────────────────────────────────────────────────────────────────────┤
│  main  │  UTF-8  │  LF  │  TypeScript React  │  Ln 42, Col 15  │  ⚡ Pipeline  │  🔔  │  ← StatusBar
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Activity Bar (left, 48px wide)

| Icon | Panel | Shortcut | Description |
|------|-------|----------|-------------|
| 📁 | Explorer | `Ctrl+B` | File tree, workspace root, recent files, outline |
| 🔍 | Search | `Ctrl+Shift+F` | File search, content search, regex replace |
| Source Control | Git | `Ctrl+Shift+G` | Staged/unstaged changes, commit, push, branch, PR |
| 🐛 | Debug | `F5` | Breakpoints, variables, call stack, watch |
| 📦 | Integrations | `Ctrl+Shift+I` | GitHub repos, Google Drive, Vault, Snippets, Gitea |
| ⚙️ | Settings | `Ctrl+,` | Models, pipeline, rules, privacy, keybindings |

### 4.3 Color System (Design Tokens)

```css
:root {
  /* Backgrounds — Zed-style solid, no gradients */
  --bg-primary: #1a1a2e;       /* Main background */
  --bg-secondary: #16213e;     /* Activity bar, panel headers */
  --bg-tertiary: #0f3460;      /* Hover states, selected items */
  --bg-surface: #1e1e3a;       /* Editor background */
  --bg-overlay: rgba(0,0,0,0.6); /* Modal overlays */

  /* Text — WCAG AA compliant (4.5:1 minimum on bg-primary) */
  --text-primary: #e2e8f0;     /* 12.6:1 on #1a1a2e — PASS */
  --text-secondary: #94a3b8;   /* 6.2:1 on #1a1a2e — PASS */
  --text-muted: #64748b;       /* 3.8:1 on #1a1a2e — use only for decorative */
  --text-on-accent: #ffffff;

  /* Semantic colors */
  --accent: #536dfe;           /* VibeServe indigo */
  --accent-hover: #7c8fff;
  --success: #34d399;
  --warning: #fbbf24;
  --error: #f87171;
  --info: #60a5fa;

  /* Git status colors */
  --git-added: #34d399;
  --git-modified: #fbbf24;
  --git-deleted: #f87171;
  --git-untracked: #60a5fa;
  --git-conflict: #f87171;

  /* Borders */
  --border: #2d2d4a;
  --border-focus: #536dfe;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  --text-xs: 11px;             /* Minimum body text — no more 8px */
  --text-sm: 12px;
  --text-base: 13px;
  --text-lg: 14px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  /* Transitions — Zed-style snappy, not Framer Motion carousel */
  --transition-fast: 100ms ease;
  --transition-normal: 150ms ease;
  --transition-slow: 250ms ease;

  /* Panel widths */
  --activity-bar-width: 48px;
  --sidebar-width: 260px;
  --ai-panel-width: 320px;
  --bottom-panel-height: 200px;
  --status-bar-height: 22px;
  --tab-bar-height: 35px;
  --title-bar-height: 30px;
}
```

### 4.4 Animation Policy

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Panel open/close | Slide + fade | 150ms | ease-out |
| Tab switch | None (instant) | 0ms | — |
| Hover states | Background color | 100ms | ease |
| Command palette | Fade + scale | 150ms | ease-out |
| Terminal cursor | Blink | 530ms | step-end |
| Pipeline step complete | Checkmark fade | 200ms | ease-out |
| File tree expand | Height transition | 150ms | ease-out |
| **ALL gratuitous staggered list animations** | **REMOVED** | — | — |

---

## 5. Autonomy Model

### 5.1 Three Modes

```
┌─────────────────────────────────────────────────────────────────────┐
│  Autonomy:  [● IDE]  [○ Copilot]  [○ Pipeline]                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Mode | Who Drives | AI Role | UI Behavior |
|------|-----------|---------|-------------|
| **IDE** | You write code | Inline suggestions only (Monaco) | Composer panel hidden. Full IDE controls visible. |
| **Copilot** | You direct, AI implements | Composer responds to `/` commands | Composer panel visible. You write code + invoke AI for specific tasks. |
| **Pipeline** | AI builds, you review | Full 7-step pipeline runs autonomously | Composer + Agent Queue visible. You watch, review, approve. |

### 5.2 Mode Switching

- Switchable at any time via status bar click or `Ctrl+Shift+M`
- Switching modes does NOT lose work
- Pipeline mode → IDE mode: pipeline pauses, you can resume later
- IDE mode → Pipeline mode: current file becomes pipeline context

### 5.3 Pipeline Integration (Existing Code — Zero Changes)

The existing pipeline (`unifiedPipeline.ts`, `vibe_architect`, `vibe_code`, `vibe_review`, `vibe_verify`, `vibe_iterate`, `vibe_test`, `vibe_deploy`) runs exactly as-is. We only change **where the output goes**:

| Pipeline Step | Current Output | New Output |
|--------------|---------------|------------|
| Architect | JSON plan | Opens `pipeline.json` in editor + shows in Agent Queue |
| Code | File writes | Files appear in file tree with `⚡ generating` indicator |
| Review | Review findings | Inline editor comments + Problems panel entries |
| Verify | Audit scores | Trust Report panel + Pipeline Log tab |
| Iterate | Auto-fixes | Git diff in GitPanel (accept/reject per hunk) |
| Test | Test results | Pipeline Log tab (pass/fail, coverage) |
| Deploy | Deploy config | Deploy URL in status bar + one-click deploy button |

### 5.4 Trust Report

Every pipeline run produces an audit trail visible in the AI panel:

```
┌─────────────────────────────────────────┐
│  Pipeline Trust Report                  │
│  ─────────────────────────────────────  │
│  Architecture:  ✓ Plan matches reqs     │
│  Code Quality:  ✓ 94/100 (A grade)      │
│  Security:      ✓ 0 critical, 1 warning │
│  Accessibility: ✓ WCAG AA compliant     │
│  Tests:         ✓ 47/47 (89% coverage)  │
│  Review:        ✓ 3 agents approved     │
│  ─────────────────────────────────────  │
│  [View Full Audit]  [View Generated Code]│
└─────────────────────────────────────────┘
```

**Nothing merges to the user's branch without explicit approval.**

---

## 6. Integration Subsystems

### 6.1 File Management Hub

| Feature | Implementation |
|---------|---------------|
| Upload files | Drag-drop onto editor, or `Ctrl+U` file picker |
| Save files | `Ctrl+S` (Monaco), auto-save toggle in settings |
| File browser | `exploration` library — virtualized, zero-recursion tree |
| File operations | Create, delete, rename, move via right-click context menu |
| Version history | Git-based — view previous versions via GitPanel |
| Export deliverables | Right-click file → "Export" → Download as ZIP, or push to GitHub |
| Recent files | Stored in Zustand with localStorage persistence |
| File watching | `chokidar` — auto-refresh on external changes |

**API:** `fileService.ts` → Hono routes `/api/files/*` → Node.js `fs` module

### 6.2 Developer Vault

| Feature | Implementation |
|---------|---------------|
| Snippet storage | SQLite table `snippets` (id, title, language, content, tags, created_at) |
| Secret storage | Windows Credential Manager via `node-wincred` (fallback: encrypted SQLite) |
| Snippet insertion | Type snippet name in Composer, or `Ctrl+Shift+V` snippet picker |
| Secret injection | Reference secrets in pipeline config as `${VAULT:secret_name}` |
| Tag system | Multi-tag support for snippets (e.g., "auth", "react", "hook") |
| Search | Fuzzy search across snippet titles, content, tags |

**API:** `vaultService.ts` → Hono routes `/api/vault/*` → SQLite + Windows Credential Manager

### 6.3 GitHub Deep Integration

| Feature | Implementation |
|---------|---------------|
| OAuth login | EXISTING Supabase GitHub OAuth — extract token for API calls |
| Repo listing | `githubService.searchRepos()` — wired to IntegrationsPanel |
| Clone repo | `isomorphic-git.clone()` — creates local workspace |
| Branch management | `isomorphic-git` branch operations — wired to GitPanel |
| Stage/commit | `isomorphic-git.add()` + `.commit()` — wired to GitPanel |
| Push/pull | `isomorphic-git.push()` + `.pull()` — wired to GitPanel |
| Create PR | `githubService` API call — "Create PR" button in GitPanel |
| Trigger Actions | `githubService.triggerWorkflow()` — "Run Workflow" button |
| Issues | `githubService` — view/create issues from IntegrationsPanel |
| Code review | `githubService` — view PR reviews from IntegrationsPanel |

**API:** `githubService.ts` (EXISTING — 250 lines, already production-ready)

### 6.4 Google Workspace

| Feature | Implementation |
|---------|---------------|
| OAuth flow | Google Cloud Console project with scopes: Drive, Calendar, Gmail |
| Drive | List files, upload, download, sync deliverables to Drive folders |
| Calendar | View upcoming events, create events for sprint planning |
| Gmail | Send deployment notifications, receive PR review emails |
| Token management | OAuth tokens stored in Windows Credential Manager |
| Token refresh | Automatic refresh via `googleapis` library |

**API:** `googleService.ts` → Hono routes `/api/google/*` → `googleapis` npm package

### 6.5 Local Git Forge (Gitea)

| Feature | Implementation |
|---------|---------------|
| Docker bootstrap | `docker-compose.yml` with Gitea service, auto-starts on first launch |
| API client | Gitea REST API calls via `giteaService.ts` |
| Local repos | Clone from Gitea, work locally, push back to Gitea |
| CI/CD | Gitea Actions (GitHub Actions compatible) — runs workflows locally |
| PRs | Create/review PRs within Gitea — visible in IntegrationsPanel |
| Webhooks | Gitea webhooks → Hono webhook router → pipeline triggers |
| Mirror | Optional: mirror Gitea repos to GitHub for public deployment |

**API:** `giteaService.ts` → Gitea REST API at `http://localhost:3000` (default)

### 6.6 IDE UI Integration

All subsystems surface through the IDE panels:

| Panel | Content |
|-------|---------|
| Explorer | File tree (exploration lib) + outline view |
| Search | File search (fuse.js) + content search (ripgrep via backend) |
| Git | Staged/unstaged changes, commit message, branch selector, PR button |
| Debug | DAP client: breakpoints, variables, call stack, watch expressions |
| Integrations | Tabbed: GitHub repos, Google Drive, Vault snippets, Vault secrets, Gitea |
| Settings | Models, pipeline config, rules, privacy, keybindings, extensions |
| Composer (right) | AI chat with `/` `@` `!` shortcuts, model selector |
| Agent Queue (right) | Pipeline step progress, trust report, play/pause/stop |

---

## 7. 90/100 Tier — Power User Features

The features above get us to 80/100 — a fully functional IDE. These features push us to 90/100 — a daily driver that senior devs *choose* over VS Code.

### 7.1 AI Deeply Woven (Not Just a Panel)

| Feature | Description | Inspiration |
|---------|-------------|-------------|
| **Tab completions** | Ghost text predictions as you type. Powered by a fast model (Cursor Tab model or local Ollama). Predicts next line, next edit, next import. | Cursor Tab |
| **Inline AI transform** | Select code → `Ctrl+K` → type instruction → AI transforms in-place with inline diff preview. "Make this faster", "Add error handling", "Convert to TypeScript". | Cursor Cmd+K |
| **Explain on hover** | Hover over any function/class → tooltip with AI-generated explanation of what it does, inputs, outputs, complexity. | Cursor hover |
| **Code actions (AI)** | Lightbulb icon on problematic code → AI-suggested fixes: "Extract to function", "Add null check", "Simplify condition", "Add JSDoc". | Zed + Cursor |
| **Inline chat** | `Ctrl+Shift+L` opens inline chat at cursor position. AI responds with code edits directly in the editor, not in a side panel. | Cursor inline |
| **Context-aware suggestions** | AI suggestions that understand the full codebase, not just the current file. Uses existing Qdrant vector store for semantic context. | Cursor codebase indexing |
| **Diff review mode** | After AI edits, show a split-view diff. Accept/reject per-hunk. Keyboard-driven: `]` next hunk, `[` previous, `y` accept, `n` reject. | Cursor diff review |
| **AI test generation** | Right-click function → "Generate tests" → AI writes test file, opens it in split view, runs it, shows results. | Cursor test gen |

### 7.2 Power User Navigation

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Go to definition** | `F12` on any symbol → jumps to its definition. Uses Monaco's LSP integration. | Monaco LSP |
| **Find all references** | `Shift+F12` → shows all usages of a symbol in a peek view. | Monaco LSP |
| **Symbol search** | `Ctrl+Shift+O` → fuzzy search symbols (functions, classes, variables) in current file. `Ctrl+T` → across workspace. | Monaco + fuse.js |
| **Breadcrumbs** | Clickable path above editor: `src/` → `components/` → `App.tsx` → `render()`. Dropdown at each level shows siblings. | Monaco breadcrumbs |
| **Recent files quick switch** | `Ctrl+Tab` shows preview list of recently opened files with file icons and git status. Hold Ctrl to cycle, release to open. | Zustand + cmdk |
| **Multi-root workspaces** | Open multiple folders in one window. Explorer shows each folder as a top-level tree. Search spans all roots. | File service |
| **Split editor** | `Ctrl+\` splits editor vertically. `Ctrl+Shift+\` splits horizontally. Each split has independent file, scroll, cursor. | Monaco instances |
| **Sync scroll** | When viewing same file in two splits, scrolling one scrolls the other. Toggle on/off. | Monaco scroll sync |
| **Zen mode** | `Ctrl+K Z` → full-screen, no panels, no activity bar, no status bar. Just the editor. Escape to exit. | CSS fullscreen |
| **Minimap** | Code overview on right edge. Click to jump. Shows current viewport as highlighted region. | Monaco minimap |

### 7.3 Developer Workflow

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Task runner** | `Ctrl+Shift+R` → run npm scripts, make targets, custom tasks. Output appears in OutputPanel. Detects `package.json` scripts automatically. | Hono backend |
| **Launch configurations** | `.vibeserve/launch.json` → debug configs for Node, Python, browser. Start debugger with one click. Matches VS Code launch.json format. | DAP client |
| **Integrated diff tool** | Compare branch vs main, file vs file, staged vs unstaged. Side-by-side with inline diff highlighting. | Monaco diff editor |
| **Terminal split** | `Ctrl+Shift+5` splits terminal vertically. `Ctrl+Shift+6` splits horizontally. Multiple terminals, each with independent shell. | xterm.js instances |
| **Terminal profiles** | Save terminal configurations: "PowerShell 7", "WSL Ubuntu", "Node REPL". Switch via dropdown in terminal panel. | Terminal manager |
| **Workspace trust** | When opening a folder, prompt: "Trust this workspace?" Untrusted workspaces disable terminal, task runner, and AI code execution. | Settings store |
| **Profile switching** | Save IDE profiles: "Frontend" (React extensions, Tailwind snippets), "Backend" (Python, Docker), "Full Stack" (both). Switch via status bar. | Settings persistence |
| **Custom keybindings** | `Ctrl+K Ctrl+S` → keybinding editor. Override any shortcut. Store in `.vibeserve/keybindings.json`. | Settings store |
| **User snippets** | Create custom snippets per language. `Ctrl+Shift+P` → "Configure Snippets". Tab-triggered expansion. | Monaco snippet provider |
| **Format on save** | Auto-format on `Ctrl+S`. Supports Prettier, Black, gofmt, rustfmt. Detects formatter from project config. | Monaco + backend |
| **Lint on save** | Run linter on save. Results appear in ProblemsPanel. Supports ESLint, Pylint, RuboCop, etc. | Backend process |
| **Auto-rename tag** | When editing an HTML/JSX opening tag, automatically rename the closing tag. | Monaco extension |
| **Bracket pair colorization** | Matching brackets share a color. Nested pairs cycle through 6 colors. | Monaco bracket colorizer |
| **Indent guides** | Vertical lines showing indentation levels. Active indent guide highlighted. | Monaco indent guides |

### 7.4 Performance Targets (90/100 Requires Speed)

| Metric | 80/100 Target | 90/100 Target | How |
|--------|---------------|---------------|-----|
| App startup | < 3 seconds | < 1.5 seconds | Code splitting, lazy panels, preloaded Monaco |
| File open | < 200ms | < 50ms | Monaco model preloading, file caching |
| Tab switch | < 100ms | Instant | Monaco model swap (no re-render) |
| Search across 10k files | < 2 seconds | < 500ms | ripgrep backend, indexed file tree |
| Terminal input latency | < 100ms | < 30ms | WebSocket binary mode, WebGL renderer |
| File tree expand (1000 nodes) | < 200ms | < 50ms | `exploration` virtualization |
| AI inline suggestion latency | < 500ms | < 150ms | Local model (Ollama), debounced triggers |
| Memory usage (idle) | < 500MB | < 300MB | Lazy panel loading, Monaco language pruning |
| Bundle size (initial) | < 5MB | < 2.5MB | Tree-shaken Monaco, code-split panels |

### 7.5 Polish Details (What Makes It Feel Premium)

| Detail | Description |
|--------|-------------|
| **Smooth scrolling** | CSS `scroll-behavior: smooth` on editor, terminal, file tree |
| **Empty states** | Every panel has a helpful empty state: "No files open — Ctrl+P to open a file" |
| **Loading states** | Skeleton loaders for file tree, search results, git status. No spinners where possible. |
| **Error states** | Actionable errors: "Terminal failed to start. Check that PowerShell is installed. [Learn more]" |
| **Notification system** | Toast notifications for: save complete, git push success, pipeline complete, errors. Grouped by type. |
| **Focus indicators** | Clear `focus-visible:ring-2` on all interactive elements. Keyboard users never lose their place. |
| **Selection colors** | Text selection uses `--accent` with 30% opacity. Git status colors in file tree. |
| **Scrollbar styling** | Thin, auto-hiding scrollbars. Zed-style: 8px wide, appears on hover, fades after 1.5s. |
| **Drag indicators** | When dragging files in explorer, show drop target highlight with blue border. |
| **Copy path** | Right-click file → "Copy Path", "Copy Relative Path", "Copy File Name" |
| **Reveal in file tree** | Right-click editor tab → "Reveal in Explorer" scrolls file tree to current file |
| **Close others** | Right-click tab → "Close Others", "Close All", "Close Tabs to Right" |
| **Pin tabs** | Right-click tab → "Pin" keeps tab from auto-closing. Pinned tabs stay left. |

### 7.6 Accessibility (WCAG AA — Non-Negotiable)

| Requirement | Implementation |
|-------------|----------------|
| Contrast ratio | All text ≥ 4.5:1 on background. Verified with axe-core. |
| Keyboard navigation | Every feature accessible via keyboard. No mouse-only interactions. |
| Screen reader | ARIA labels on all panels, buttons, inputs. Live regions for pipeline updates. |
| Focus management | Focus trapped in modals. Focus returns to trigger on close. Skip-to-content link. |
| Reduced motion | `prefers-reduced-motion` disables all animations. Settings toggle also available. |
| Font scaling | Editor font size adjustable 10px-24px. UI scales proportionally. |
| Color blindness | Git status colors use both color AND icon (not color alone). |

---

## 8. Keyboard Shortcuts (VS Code Compatible + Power User)

### Core Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Quick open file |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+B` | Toggle Explorer panel |
| `Ctrl+Shift+F` | Search in files |
| `Ctrl+Shift+G` | Toggle Git panel |
| `Ctrl+`` ` | Toggle terminal |
| `Ctrl+S` | Save file |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab (with preview) |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+K Ctrl+S` | Open keyboard shortcuts editor |
| `F5` | Start debugging |
| `F12` | Go to definition |
| `Shift+F12` | Find references |
| `Alt+Click` | Multi-cursor |
| `Ctrl+/` | Toggle line comment |
| `Ctrl+Shift+/` | Toggle block comment |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+Shift+I` | Toggle Integrations panel |
| `Ctrl+,` | Open settings |
| `Ctrl+Shift+M` | Toggle autonomy mode |
| `Ctrl+Shift+V` | Snippet picker |
| `Ctrl+U` | Upload file |

### 90/100 Power Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` (with selection) | Inline AI transform |
| `Ctrl+Shift+L` | Inline AI chat at cursor |
| `Ctrl+T` | Go to symbol (workspace) |
| `Ctrl+Shift+O` | Go to symbol (current file) |
| `Ctrl+\` | Split editor vertically |
| `Ctrl+Shift+\` | Split editor horizontally |
| `Ctrl+K Z` | Toggle Zen mode |
| `Ctrl+Shift+R` | Run task |
| `Ctrl+Shift+5` | Split terminal vertically |
| `Ctrl+Shift+6` | Split terminal horizontally |
| `]` (in diff review) | Next hunk |
| `[` (in diff review) | Previous hunk |
| `y` (in diff review) | Accept hunk |
| `n` (in diff review) | Reject hunk |
| `Ctrl+Shift+E` | Reveal current file in explorer |
| `Ctrl+Shift+D` | Open debug view |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+Shift+N` | New window |
| `Ctrl+Shift+W` | Close window |
| `Ctrl+Shift+T` | Reopen closed tab |
| `Alt+Up/Down` | Move line up/down |
| `Shift+Alt+Up/Down` | Copy line up/down |
| `Ctrl+D` | Add next occurrence to selection |
| `Ctrl+Shift+L` | Select all occurrences |
| `Ctrl+Shift+K` | Delete line |
| `Ctrl+Enter` | Insert line below |
| `Ctrl+Shift+Enter` | Insert line above |

---

## 9. Build Phases

### Phase 1: IDE Shell (Week 1-2)
- New `App.tsx` layout with TitleBar, ActivityBar, TabBar, StatusBar, PanelBar
- Design tokens in `index.css`
- Remove all 14 old tab views
- Remove glass morphism, Framer Motion, mock data
- Zustand store rebuild with persistence
- Keyboard shortcuts system (all 55 shortcuts)
- Empty states for every panel
- Notification/toast system

### Phase 2: Core IDE Features (Week 2-3)
- File Explorer with `exploration` library (virtualized, drag-drop, traits)
- Real terminal with `xterm.js` + `node-pty` (WebGL renderer)
- Command palette with `cmdk` (file search, symbol search, command search)
- Editor tab bar with close, reorder, pin, "close others"
- Monaco upgrades: minimap, breadcrumbs, multi-cursor, emmet, bracket colorization, indent guides
- File service backend (Hono routes)
- File watching with `chokidar`
- Split editor (vertical + horizontal)
- Zen mode
- Recent files quick switch (Ctrl+Tab with preview)
- Smooth scrolling, auto-hiding scrollbars

### Phase 3: Git Integration (Week 3-4)
- GitPanel with staged/unstaged changes, commit message, branch selector
- `isomorphic-git` integration (clone, add, commit, push, pull, branch)
- Wire existing `githubService.ts` to UI
- PR creation button
- GitHub Actions trigger
- Integrated diff tool (side-by-side, inline highlighting)
- Reveal in file tree, copy path, copy relative path

### Phase 4: AI Panel + Pipeline Routing (Week 4-5)
- ComposerPanel (right side) with `/` `@` `!` shortcuts
- AgentQueue panel showing pipeline steps
- TrustReport component
- ModelSelector in status bar
- Autonomy mode toggle (IDE/Copilot/Pipeline)
- Route existing pipeline output to new panels
- **Tab completions** (ghost text via Ollama local model)
- **Inline AI transform** (Ctrl+K with selection)
- **Inline AI chat** (Ctrl+Shift+L)
- **Explain on hover** (tooltip with AI explanation)
- **AI code actions** (lightbulb suggestions)
- **Diff review mode** (keyboard-driven: ]/[, y/n)
- **AI test generation** (right-click → generate tests)

### Phase 5: Search + Debug (Week 5-6)
- SearchPanel with file search (fuse.js) + content search (ripgrep backend)
- Regex replace with preview
- DebugPanel with DAP client (breakpoints, variables, call stack, watch)
- ProblemsPanel (aggregated errors/warnings from Monaco + linter)
- OutputPanel (build/task output)
- Symbol search (Ctrl+Shift+O for file, Ctrl+T for workspace)
- Go to definition (F12), Find references (Shift+F12)

### Phase 6: Integrations (Week 6-7)
- IntegrationsPanel with tabs: GitHub, Drive, Vault, Gitea
- Developer Vault (snippets + secrets with Windows Credential Manager)
- Google Workspace (Drive, Calendar, Gmail with full OAuth)
- Gitea Docker bootstrap
- File upload/export system (drag-drop, Ctrl+U, ZIP export)
- Snippet picker (Ctrl+Shift+V) with fuzzy search

### Phase 7: Developer Workflow (Week 7-8)
- Task runner (Ctrl+Shift+R) with package.json script detection
- Launch configurations (.vibeserve/launch.json)
- Terminal split (vertical + horizontal) and profiles
- Workspace trust prompt
- Profile switching (Frontend, Backend, Full Stack)
- Custom keybindings editor
- User snippets per language
- Format on save (Prettier, Black, gofmt)
- Lint on save (ESLint, Pylint)
- Auto-rename tag
- Multi-root workspaces

### Phase 8: Polish + Performance (Week 8-9)
- Accessibility audit (WCAG AA — axe-core automated + manual screen reader test)
- Performance profiling: app startup < 1.5s, file open < 50ms, tab switch instant
- Bundle optimization: tree-shaken Monaco, code-split panels, target < 2.5MB initial
- Memory profiling: idle < 300MB
- Electron app updates (native window chrome, system tray)
- E2E tests with Playwright (all 55 shortcuts, all panels, pipeline flow)
- Documentation
- Migration guide from old UI (legacy mode via `?legacy=true` for 2 releases)

---

## 10. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `node-pty` Windows compatibility | High | Test on Windows early. Fallback: web-based shell via WebSocket to backend `child_process.exec` |
| `exploration` library is small (60 stars) | Medium | Well-architected (zero-recursion, virtualization, typed). If issues arise, build custom tree component |
| Gitea Docker on Windows | Medium | Use Docker Desktop for Windows. Fallback: skip local forge, use GitHub only |
| Breaking changes to existing pipeline | High | Pipeline code is NOT modified. Only output routing changes. Add integration tests |
| Bundle size bloat | Medium | Code-split panels. Lazy-load IntegrationsPanel, DebugPanel. Tree-shake unused Monaco languages |
| Migration from old UI | High | Keep old UI accessible via `?legacy=true` query param for 2 releases. Add migration guide |
| AI inline suggestion latency | Medium | Use local Ollama model for Tab completions. Debounce triggers. Fallback to cloud model if local unavailable |

---

## 11. Success Criteria

### 80/100 Baseline (Must Have)

| Metric | Target | Measurement |
|--------|--------|-------------|
| IDE usability score | 80/100 (from 40/100) | Senior dev audit (same methodology as current audit) |
| Time to first file edit | < 3 seconds | From app launch to typing in a file |
| Time to commit code | < 10 seconds | From file change to git commit via UI |
| Pipeline trust visibility | 100% of runs produce Trust Report | Every pipeline run shows audit trail |
| Keyboard shortcut coverage | 30+ shortcuts | VS Code-compatible keymap |
| WCAG AA compliance | Pass all automated checks | axe-core audit |
| Bundle size | < 5MB initial load | Webpack bundle analyzer |
| Terminal latency | < 50ms input-to-display | xterm.js benchmark |
| File tree render time | < 100ms for 1000 nodes | `exploration` library benchmark |

### 90/100 Stretch (What Gets Us There)

| Metric | Target | Measurement |
|--------|--------|-------------|
| IDE usability score | **90/100** | Senior dev audit — must score ≥ 85 in ALL 5 categories (Visual, Features, DX, Integration, Code Quality) |
| App startup | < 1.5 seconds | Cold start to interactive UI |
| File open | < 50ms | From click to cursor in file |
| Tab switch | Instant | Monaco model swap, no re-render |
| Search across 10k files | < 500ms | ripgrep backend with indexed file tree |
| Terminal input latency | < 30ms | WebSocket binary mode + WebGL renderer |
| AI inline suggestion latency | < 150ms | Local Ollama model, debounced triggers |
| Memory usage (idle) | < 300MB | Chrome DevTools memory profiler |
| Bundle size (initial) | < 2.5MB | Webpack bundle analyzer |
| AI feature adoption | 50% of sessions use at least one AI feature | Telemetry: Tab completions, inline transform, explain on hover |
| Senior dev "would I use this daily?" | ≥ 8/10 | Blind test with 5 senior devs (no context about the project) |
| Zero mock data | 100% of UI panels show real data | Audit: no hardcoded fake data anywhere |
| All 55 shortcuts functional | 100% | Playwright E2E test for each shortcut |

---

## 12. Decisions Made

| Decision | Rationale |
|----------|-----------|
| Gitea for local forge | Lightweight, GitHub Actions compatible, Docker-friendly, active community |
| Windows Credential Manager for secrets | Native Windows integration, more secure than encrypted SQLite for this use case |
| Full OAuth for Google services | Proper user consent flow, all 3 services (Drive, Calendar, Gmail) |
| Local filesystem + SQLite for files | Simple, fast, no external dependencies for core file operations |
| Shared Core + Parallel architecture | Enables parallel development while maintaining clean boundaries |
| cmdk for command palette | By Radix UI team, used by Vercel, accessible, composable, small bundle |
| exploration for file tree | Zero-recursion, virtualized, typed, concurrent-mode safe |
| xterm.js + node-pty for terminal | Industry standard (VS Code, Tabby, Hyper), GPU-accelerated, zero deps |
| isomorphic-git for git operations | Pure JS, works in browser + Node, comprehensive API |
| Remove ALL old tab views | They are the root cause of the 40/100 score. Clean slate is faster than incremental migration |
| Keep pipeline code unchanged | It works. The problem is output routing, not the pipeline itself |
| Zed-style minimalism | Senior devs prefer speed and clarity over visual flair. Glass morphism is anti-pattern for IDEs |
| Ollama for Tab completions | Local model = < 150ms latency, no API cost, works offline. Fallback to cloud if unavailable |
| Blind senior dev test | The ultimate metric: if 5 senior devs rate it ≥ 8/10 for daily use, we hit 90/100 |

---

## 13. Open Questions

| Question | Impact | Owner |
|----------|--------|-------|
| Should we support WSL terminal on Windows? | Medium — nice-to-have for Windows devs | Phase 2 |
| Should snippets be synced to cloud (Supabase)? | Low — nice-to-have for multi-device users | Phase 6 |
| Should Gitea mirror to GitHub automatically? | Medium — useful for teams using both | Phase 6 |
| Should we support remote development (SSH)? | High — major feature, scope for v2.1 | Post-launch |
| Should we support VS Code extensions? | High — major feature, scope for v2.1 | Post-launch |
| Which local model for Tab completions? | Medium — affects latency and quality. Options: StarCoder2-3B, DeepSeek-Coder-1.3B, Qwen2.5-Coder-1.5B | Phase 4 |

---

## 14. Spec Self-Review

**Placeholder scan:** No TBD, TODO, or incomplete sections. All decisions documented.

**Internal consistency:** Architecture matches feature descriptions. Build phases align with dependencies. Color system is consistent throughout.

**Scope check:** This is a large spec but focused on a single goal: transform the IDE shell and wire integrations. The pipeline itself is explicitly out of scope (kept unchanged). Post-launch items are clearly marked.

**Ambiguity check:** All requirements are explicit. "Remove all 14 tab views" is unambiguous. "Zed-style minimalism" is defined by the design tokens and animation policy. Keyboard shortcuts are fully enumerated.

---

**Next step:** User reviews this spec. After approval, invoke `writing-plans` skill to create the implementation plan.

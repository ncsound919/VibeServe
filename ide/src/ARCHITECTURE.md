# Nexus Alpha — Core Architecture & Directory Standards

This document defines the canonical directory structure and ownership rules for the Nexus Alpha platform. Adherence to these standards is mandatory for all new features and refactors to maintain a high-performance, maintainable orchestration environment.

## Canonical Directory Structure

### 1. `src/components` — UI Building Blocks
- **Global Components**: Atomic UI elements (Buttons, Inputs, Cards) used across the app.
- **Layout**: Shared structural components (Header, Sidebar, Footer, Shell).
- **Views**: Tab-level or Page-level components (formerly in `src/views`).

### 2. `src/pages` — Routing & Entry Points
- Top-level routes and screen entry points.

### 3. `src/services` — Business Logic & External Integrations
- All stateless logic, API clients (GitHub, Supabase, LLM proxies).
- Orchestration logic (Pipeline, AutoFixLoop, Cheetah).
- **Migration Goal**: Consolidate `src/core`, `src/features`, and `src/extensions` here.

### 4. `src/hooks` — React State & Lifecycle
- Custom React hooks for data fetching, UI state, and context consumption.

### 5. `src/stores` — Client-Side State Management
- Zustand stores for global application state (Workspace, Pipeline, User).

### 6. `src/lib` — Utilities & Foundations
- Generic helper functions, logging, and infrastructure foundations.

### 7. `src/types` — Type Definitions
- Canonical TypeScript interfaces and types used across multiple modules.

### 8. `src/server` — Node/Hono Backend
- The Hono server entry point (`hono.ts`), routes, and server-only middleware.
- **Workspace boundary**: `packages/server/` provides a separate `tsconfig.json` that enforces Node-only types (no DOM, no React). CI runs `tsc --project packages/server/tsconfig.json` to verify no browser APIs leak into server code. The server entry points (`hono.ts`, `mcp.ts`) remain in `src/server/` for now; the `packages/server/` workspace is the first step toward a full server/client split.

### 9. `packages/server/` — Server Workspace Boundary
- **`packages/server/package.json`** — Lists only server runtime dependencies. Build tools, frontend libs, and test frameworks are excluded.
- **`packages/server/tsconfig.json`** — Strict Node-only type checking (no DOM, lib: ES2022 only). Used by CI to enforce client/server separation at build time.
- **Migration path**: Future phases will move `src/server/` into `packages/server/src/` with proper path aliases for shared types.

---

## Technical Debt & Consolidation Rules

1. **No Node.js Builtins in Frontend**: Do not import `fs`, `path`, or `child_process` in `src/components`, `src/pages`, or `src/hooks`. Use the `apiClient` to communicate with the server for filesystem operations.
2. **Unified LLM Access**: Use `tokenOptimizer.ts` or the `Cheetah` service for code generation. Do not call Gemini/Claude directly in UI components.
3. **Canonical Services**: If a service exists in `src/services`, do not create a duplicate in `src/features`.
4. **Environment Variables**: Use `import.meta.env` for frontend-facing variables and `process.env` only in `src/server`.

## Deprecation Roadmap

- `src/views/` → Migrating to `src/components/views/` or `src/pages/`.
- `src/core/` & `src/features/` → Consolidating into `src/services/` and `src/components/`.
- `src/extensions/` → Moving to `src/services/extensions/`.
- `src/node-polyfills.ts` → **DELETED** (Use Hono server for Node logic).

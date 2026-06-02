# VibeServe Tool Catalog

The VibeServe IDE exposes every MCP tool that the Python backend registers
through a single, uniform surface: the **Tool Catalog**. This document
explains what the catalog is, how it's wired together, and how the UI uses
it to invoke any tool without writing custom panel code.

---

## What it is

`ide/src/server/toolCatalog.ts` is the **single source of truth** for every
tool the IDE can invoke. Each entry describes:

| Field         | Purpose                                                       |
|---------------|---------------------------------------------------------------|
| `name`        | MCP tool name (matches `@mcp_server.tool(name=...)`)          |
| `category`    | Top-level group shown in the catalog (Agenda, Vibe Agents, …) |
| `title`       | Short, human-readable label                                   |
| `description` | One-sentence summary                                          |
| `scope`       | `read` / `write` / `execute` / `ai` — drives auth + UI hints  |
| `args`        | Ordered argument descriptors (name, kind, required, …)        |
| `example`     | Working sample payload — used by the "Try it" button          |
| `resultKind`  | How the UI should render the response (table, code, image, …) |
| `isQuickAction` | Optional flag — surfaces the tool in the command palette    |

There are 59 tools registered in the catalog (matching the 60 unique
`@mcp_server.tool` registrations; one is a placeholder pattern used for
the 7 `vibe_*` agents). They are grouped into 11 categories:

- **Agenda** — goals, initiatives, activity log (9 tools)
- **Vibe Agents** — the 7-stage pipeline (architect → code → review → …)
- **Design** — UI specs, design systems, WCAG validation
- **Code** — index, search, read, write, plan, retrieve
- **Build** — install, build, biome, tsc, audit, semgrep, playwright
- **GitHub** — list/get repos, issues, link account, sync
- **Vercel** — deployment list
- **Supabase** — query / insert
- **Memory** — ingest learning, stats
- **Analysis** — find test gaps, find refactors, cross-repo suggest
- **Meta** — health, audit, compress, benchmark, docs, build-pro

---

## How the UI consumes it

```
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  ToolCatalogPanel  │ →  │  ToolInvokeForm    │ →  │  /api/pipeline/    │
│  (browse + pick)   │    │  (auto-generated)  │    │  mcp/tools/call    │
└────────────────────┘    └────────────────────┘    └─────────┬──────────┘
                                                              │
                                                              ▼
                                                     ┌────────────────────┐
                                                     │  Python MCP bridge │
                                                     │  (python -m vibe…) │
                                                     └────────────────────┘
```

1. The user opens the **Tools** panel from the Activity Bar
   (`Ctrl+Shift+T`).
2. They pick a tool; the `ToolInvokeForm` reads the `args[]` array and
   renders one input per argument (string, number, boolean, enum, array,
   object).
3. On submit, the panel calls `POST /api/pipeline/mcp/tools/call` with
   `{ tool, args }`.
4. The Hono server validates the payload against the same catalog
   (rejects missing required args) and forwards it to the Python MCP via
   `client.callTool`.
5. The response is decoded by `ToolResult` and rendered as a table, code
   block, image, or log, depending on the tool's `resultKind`.

---

## API surface

| Endpoint | Description |
|----------|-------------|
| `GET /api/pipeline/mcp/status` | Connection health, live + static tool counts, version, latency. |
| `GET /api/pipeline/mcp/reconnect` | Force-respawn the Python bridge (admin only). |
| `GET /api/pipeline/mcp/tools/list?category=&q=&scope=` | Filtered tool list with live presence flag. |
| `GET /api/pipeline/mcp/tools/schema/:name` | Full schema for one tool. |
| `GET /api/pipeline/mcp/tools/categories` | Per-category counts. |
| `POST /api/pipeline/mcp/tools/call` | Validated tool invocation. |
| `POST /api/pipeline/mcp_call` | Legacy raw bridge call (still supported). |

All routes are mounted under `/api/*` and use the same auth middleware
(`x-api-key` for system, Supabase JWT for user, `NEXUS_AUTH_BYPASS=true`
for dev).

---

## Adding a new tool

1. Register it in the Python side: decorate the function with
   `@mcp_server.tool(name="my_new_tool", description="…")`.
2. Add an entry to `VIBESERVE_TOOL_CATALOG` in
   `ide/src/server/toolCatalog.ts` with `name`, `category`, `title`,
   `description`, `scope`, `args[]`, `example`, `resultKind`.
3. (Optional) Set `isQuickAction: true` to surface it in the command
   palette.
4. The tool is now:
   - Browsable in the **Tools** panel
   - Searchable in the command palette (`Ctrl+Shift+P`)
   - Callable from anywhere via `client.callTool({ name, args })`
   - Documented in the auto-generated form

The `ToolInvokeForm` is data-driven: it reads `args[]` and renders the
right widget. There is no UI code to write for a new tool beyond the
catalog entry.

---

## Status indicator

The status bar shows a live MCP connection chip:

- **Green** + `MCP N/59` → connected, N live tools reported by the bridge
- **Red** + `MCP offline` → Python bridge is down (with the reason on
  hover)
- **Yellow** + `MCP reconnecting…` → mid-reconnect (double-click the chip)

The chip is clickable and opens the **Tools** panel; double-click
reconnects the bridge.

The status is polled every 15 s; the panel itself polls on mount.

---

## Tests

```
npx tsx tests/smoke/toolCatalog.smoke.ts
```

Boots the Hono server with auth bypass and hits each new endpoint to
verify status codes and shape. Useful for CI.

Unit tests in `tests/unit/toolCatalog.test.ts` and
`tests/unit/toolCatalogContracts.test.ts` assert catalog invariants
(unique names, required arg kinds, GitHub/Supabase/run_* contracts,
JSON-serializable examples).

---

## Design choices

- **Always serve the static catalog.** Even if the Python bridge is
  down, the `/tools/list` endpoint returns the full static catalog. This
  lets the UI render a usable interface in offline mode and degrades
  gracefully.
- **Server-side validation.** The `/tools/call` endpoint validates
  required args against the catalog before forwarding to Python, so
  bad payloads fail fast with a 400 + the schema.
- **One form generator, many tools.** All tool inputs go through the
  same `ToolInvokeForm` component, which means adding a tool with 10
  new args still requires zero new React code.
- **The catalog is the contract.** The TypeScript `ToolEntry` type and
  the Python `@mcp_server.tool` decorator are not automatically kept in
  sync — but the catalog is the authoritative IDE-side description and
  the smoke test catches drift.

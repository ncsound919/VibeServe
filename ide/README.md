# Nexus Alpha

**Nexus Alpha** is an AI-native developer IDE and autonomous orchestration engine built directly in the browser. Powered by React, TypeScript, and Vite, it integrates full-stack generative capabilities with durable workflows, real-time collaborative editing, an embedded terminal, and a sophisticated vector database integration. With Google Gemini as its core reasoning engine, it transitions from a simple dashboard into a comprehensive, multi-modal development environment.

***

## Core Features

> 📸 **Screenshots/Demos** — Visual previews are coming soon. For now, try the app locally using the quickstart below.

- **AI-Native IDE Experience** — Includes a Monaco-based browser editor (`@monaco-editor/react`), real-time collaborative editing via Yjs (CRDTs), and an embedded full terminal (`xterm.js`).
- **Multi-File Planning Engine** — Powered by the **PlannerAgent**, this engine decomposes complex prompts into structured, multi-file implementation plans before execution.
- **Architectural Review UI** — A dedicated review interface for inspecting and approving agent-led code modifications, ensuring human-in-the-loop control.
- **Graphify RAG** — Semantic codebase discovery using a knowledge graph integration (nodes, edges, communities) to reduce token usage and improve code recall accuracy.
- **Performance-Native Codegen** — Real-time performance profiling (Lighthouse vitals) integrated into the generation loop to ensure high-quality, optimized output.
- **Enterprise Audit & Hardening** — Comprehensive administrative dashboard for monitoring agent actions, security events, and cost, backed by zero-trust BOLA safeguards.
- **Self-Healing Loop (Auto-Fix 2.0)** — Autonomous repair engine with visual regression awareness and performance-based self-optimization.
- **Hono Backend Platform** — High-performance, authenticated backend proxies for all AI and system operations, featuring strict rate-limiting and audit logging.
- **Desktop Ready** — Pre-configured Electron build target for native desktop deployment.

***

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 6 |
| Editor & Terminal | Monaco Editor, Yjs (CRDTs), xterm.js |
| State & UI | Zustand, Motion, Recharts, Lucide React |
| Backend Core | **Hono**, WebSocket (`ws`) |
| Workflows & Queues | Temporal.io, BullMQ |
| Autocoder | **Overlay Cheetah V3** (Python/Jinja2 + TS Fallback) |
| AI / LLMs | Google Gemini (`@google/genai`), LangChain, Ollama (Local) |
| Vector DB (RAG) | **Graphify** (Knowledge Graph), Qdrant |
| Resiliency & Ops | Opossum (Circuit Breaker), **Vitals Service** (Lighthouse) |
| Security | **BOLA Guard** (Ownership-based ACL), JWT, Audit Logging |
| Code Quality | Biome (Linter/Formatter) |
| Database/Auth | Supabase |
| Testing / Desktop | Playwright / Electron |

***

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A **Google Gemini API key** (required) — get one at [ai.google.dev](https://ai.google.dev)
- Redis server (required for BullMQ)
- Temporal local server (optional, required for durable workflows)
- Python 3.9+ (optional, required only for native Cheetah V3 generation)

***

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/tap919/Nexus-Alpha.git
cd Nexus-Alpha
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values. At minimum, set `GEMINI_API_KEY` and `NEXUS_API_KEY`.

### 4. Start the development servers

**Frontend (Vite):**
```bash
npm run dev
```
Runs at [http://localhost:3000](http://localhost:3000)

**Backend (Hono + WebSocket):**
```bash
npm run server
```

**MCP Server:**
```bash
npm run mcp
```

***

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key for all AI features |
| `NEXUS_API_KEY` | ✅ Yes | Server-to-server API authentication key (required in production) |
| `SUPABASE_JWT_SECRET` | ✅ Yes | Secret key for JWT verification (enforces Zero-Trust RBAC) |
| `NEXUS_ALLOW_AUTO_FIX` | ⚠️ Optional | **DANGEROUS** — Enables unsandboxed destructive pipeline operations. When `true`, agents can execute arbitrary file system mutations and shell commands without human review gates. Only enable in isolated dev environments where you can afford total project loss. Never enable in production or on shared machines. |
| `MAX_WS_CLIENTS` | Optional | Connection cap for WebSocket server |
| `PORT` | Optional | HTTP server port (default: `3002`) |

> ⚠️ Never commit `.env.local` to version control. It is already listed in `.gitignore`.

***

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build production bundle to `/dist` |
| `npm run electron:dev`| Run the app natively in Electron |
| `npm run lint` | TypeScript type check (no emit) and Biome analysis |
| `npm run test` | Run unit tests and E2E tests |
| `npm run test:unit` | Run unit tests only |
| `npm run server` | Start Hono + WebSocket backend |
| `npm run mcp` | Start MCP server |
| `npm run test:e2e` | Run Playwright end-to-end tests |

***

## Project Structure

```
Nexus-Alpha/
├── docs/                 # Planning docs, checklists, and architecture rules
├── src/
│   ├── components/       # UI elements and tab views (src/components/views)
│   ├── features/         # Feature modules (vibecoder, composer, terminal, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API clients, CRDT syncing, orchestration (Cheetah)
│   ├── stores/           # Zustand state stores
│   ├── server/           # Backend (Hono, MCP, Queues)
│   └── lib/              # Utility functions
├── cheetah/              # Overlay Cheetah V3 engine tasks and templates
├── electron/             # Electron desktop bindings
├── tests/                # Playwright e2e tests
├── vite.config.ts        # Vite configuration
└── package.json          # Dependency management
```

***

## License

Apache 2.0 — see [`LICENSE`](./LICENSE) for details.

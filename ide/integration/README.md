# Nexus Alpha Integration Stack

Synergistic open source tools integrated into a unified AI development platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXUS ALPHA APP (Port 3000)                  │
│              React + Express + MCP Server                       │
└──────────────────────────┬──────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┬────────────────┐
         ▼                ▼                ▼                ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │  Nanobot  │   │   Mem0    │   │ Langfuse  │   │  LightRAG │
   │  Agent    │   │  Memory   │   │Observabil.│   │  Engine   │
   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                    MCP Servers                                    │
   │  • github-mcp    • filesystem-mcp    • markitdown    • postgres   │
   └──────────────────────────────────────────────────────────────────┘
         │
         ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                    Data Layer                                    │
   │  • Qdrant (Vector DB)    • PostgreSQL + pgvector    • File System │
   └──────────────────────────────────────────────────────────────────┘
```

## Integrated Tools by Category

### 🤖 Core Agent
| Tool | Stars | Purpose |
|------|-------|---------|
| **nanobot** | 40K | Agent framework + MCP host |
| **yoyo-evolve** | 1.6K | Rust-powered terminal agent |

### 🧠 Memory & Context
| Tool | Stars | Purpose |
|------|-------|---------|
| **Mem0** | 54K | Universal memory layer (vector + graph) |
| **Letta** | 22K | Self-editing tiered memory |

### 🔍 Web Search
| Tool | Purpose |
|------|---------|
| **Firecrawl** | Agent-ready search/scrape |
| **Tavily** | "Search engine for AI agents" |
| **Exa** | Neural semantic search |

### 📄 Document Processing
| Tool | Stars | Purpose |
|------|-------|---------|
| **markitdown** | 91K | PDF/DOCX → Markdown |

### 🛡️ Observability
| Tool | Purpose |
|------|---------|
| **Langfuse** | LLM traces, costs, feedback |
| **Helicone** | Open-source AI observability |

### 🗄️ Data Layer
| Tool | Purpose |
|------|---------|
| **Qdrant** | Vector database |
| **pgvector** | PostgreSQL vector search |
| **Neo4j** | Knowledge graph (optional) |

### 💰 Token Optimization
| Tool | Stars | Purpose |
|------|-------|---------|
| **RTK** | 9.6K | 60-90% token reduction |

## Quick Start

### 1. Environment Setup

```bash
cd integration
cp .env.example .env
# Edit .env with your API keys
```

Required keys:
- `ANTHROPIC_API_KEY` - Claude models
- `GITHUB_TOKEN` - GitHub API
- `OPENAI_API_KEY` - RAG embeddings

Optional but recommended:
- `MEM0_API_KEY` - Memory layer
- `FIRECRAWL_API_KEY` - Web search
- `TAVILY_API_KEY` - AI search
- `LANGFUSE_PUBLIC_KEY/SECRET` - Observability

### 2. Start the Stack

```bash
# Start all services
docker-compose up -d

# Or start specific services
docker-compose up qdrant postgres nanobot mem0
```

### 3. Verify MCP Connections

```bash
# Test nanobot MCP
docker exec -it nexus-nanobot nanobot mcp test

# Check Mem0
docker logs nexus-mem0

# Langfuse dashboard
# Visit http://localhost:3001
```

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Nexus Alpha | 3000 | http://localhost:3000 |
| Qdrant | 6333 | http://localhost:6333/dashboard |
| Nanobot | 3030 | http://localhost:3030 |
| Langfuse | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |

## MCP Tools Available

- `search_repos` - GitHub trending search
- `get_repo` - Repo details
- `analyze_repo_synergy` - Gemini AI analysis
- `trigger_pipeline` - Run build pipelines
- `markitdown_convert` - Document → Markdown
- `github_*` - Full GitHub API
- `mem0_search` - Semantic memory recall
- `web_search` - Firecrawl/Tavily search

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude model access |
| `GITHUB_TOKEN` | Yes | GitHub API access |
| `OPENAI_API_KEY` | For RAG | Text embeddings |
| `MEM0_API_KEY` | No | Memory layer |
| `FIRECRAWL_API_KEY` | No | Web search |
| `TAVILY_API_KEY` | No | AI search |
| `LANGFUSE_PUBLIC_KEY` | No | Observability |
| `POSTGRES_PASSWORD` | Yes | Database auth |

## Development

```bash
# Add new MCP server
# Edit config/nanobot/nanobot.yaml under tools.mcpServers

# View logs
docker-compose logs -f nanobot

# Rebuild after config change
docker-compose restart nanobot

# Access Langfuse traces
# Open http://localhost:3001
```

## Troubleshooting

**MCP connection refused**
```bash
docker ps | grep mcp
docker-compose restart nanobot
```

**Memory not persisting**
```bash
# Check Mem0 logs
docker logs nexus-mem0
# Verify Qdrant collection
curl http://localhost:6333/collections
```

**Langfuse not receiving traces**
```bash
# Check Langfuse status
curl http://localhost:3001/api/public/health
```
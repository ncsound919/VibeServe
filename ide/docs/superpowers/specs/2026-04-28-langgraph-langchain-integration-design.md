# LangGraph + LangChain Integration Design
**Date:** 2026-04-28
**Author:** Nexus Alpha Team
**Status:** Draft

---

## 1. Context & Vision

We are building a **multi-agent AI system** where:
1. **LangGraph** orchestrates multiple specialist agents (Triage, Research, Coding, Analysis)
2. **LangChain** provides RAG (Retrieval-Augmented Generation) for each agent's knowledge base
3. **Temporal** provides durability, retries, and long-running task management as the backbone

This design assumes **Approach A** — LangGraph runs *inside* Temporal Activities.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TEMPORAL (Backbone)                              │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │ langGraphAgentActivity(...) ← Temporal Activity          │     │
│  │         │                                                │     │
│  │         ▼                                                │     │
│  │  ┌───────────────────────────────────────────────────┐    │     │
│  │  │         LANGGRAPH (Orchestration)               │    │     │
│  │  │                                                   │    │     │
│  │  │  START                                            │    │     │
│  │  │    │                                              │    │     │
│  │  │    ▼                                              │    │     │
│  │  │  ┌──────────┐                                     │    │     │
│  │  │  │ Triage   │──► route by intent                  │    │     │
│  │  │  │  Agent   │                                     │    │     │
│  │  │  └──────────┘                                     │    │     │
│  │  │       │           │           │           │              │    │     │
│  │  │       ▼           ▼           ▼           ▼              │    │     │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │    │     │
│  │  │  │Research│ │Coding  │ │Analysis│ │General│       │    │     │
│  │  │  │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │       │    │     │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘       │    │     │
│  │  │      │          │          │          │               │    │     │
│  │  │      ▼          ▼          ▼          ▼               │    │     │
│  │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │    │     │
│  │  │  │RAG   │  │RAG   │  │RAG   │  │RAG   │← LangChain│    │     │
│  │  │  │      │  │      │  │      │  │      │          │    │     │
│  │  │  └──────┘  └──────┘  └──────┘  └──────┘          │    │     │
│  │  │             └──────────────┬──────��───────┘        │    │     │
│  │  │                            │                         │    │     │
│  │  │                            ▼                         │    │     │
│  │  │  ┌──────────────────────────────────────────┐      │    │     │
│  │  │  │         LANGCHAIN (RAG Layer)             │      │    │     │
│  │  │  │  • Document Loaders                    │      │    │     │
│  │  │  │  • Text Splitters                      │      │    │     │
│  │  │  │  • Embeddings                         │      │    │     │
│  │  │  │  • Vector Store (Supabase pgvector)    │      │    │     │
│  │  │  │  • Retrieval Chains                  │      │    │     │
│  │  │  └──────────────────────────────────────────┘      │    │     │
│  │  └───────────────────────────────────────────────────┘    │     │
│  └───────────────────────────────────────────────────────────┘     │
│                        TEMPORAL                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 LangChain RAG Service (`src/services/langchain/rag.ts`)

| Function | Purpose |
|----------|---------|
| `createVectorStore()` | Initialize Supabase vector store from `documents` table |
| `ingestDocument(content, metadata)` | Add document to knowledge base |
| `retrieve(query, k)` | Semantic search for relevant context |
| `createRAGChain(agentType)` | Create RAG prompt chain for specific agent |

### 3.2 LangGraph Agent System (`src/agents/graph.ts`)

| Component | Purpose |
|------------|---------|
| `GraphState` | Shared state schema for all agents |
| `triageNode` | Classifies intent, routes to specialist |
| `researchAgentNode` | Research-focused agent with RAG |
| `codingAgentNode` | Code-focused agent with RAG |
| `analysisAgentNode` | Data/analytics agent with RAG |
| `generalAgentNode` | Fallback conversational agent |
| `shouldContinue` | Conditional edge for loop control |

### 3.3 Temporal Activity (`src/workers/activities/agent.activities.ts`)

| Activity | Purpose |
|----------|---------|
| `langGraphAgentActivity(input)` | Execute LangGraph inside Temporal |

---

## 4. Directory Structure

```
src/
├── services/
│   ├── langchain/
│   │   ├── index.ts           # Re-exports
│   │   ├── rag.ts             # RAG service
│   │   ├── embeddings.ts     # Embedding utilities
│   │   └── loaders.ts         # Document loaders
│   ├── temporalClient.ts     # Existing
│   ├── supabaseClient.ts    # Existing
│   └── geminiService.ts    # Existing
├── agents/
│   ├── graph.ts              # LangGraph definition
│   ├── state.ts            # Graph state schema
│   ├── nodes/
│   │   ├── triage.ts       # Triage agent
│   │   ├── research.ts    # Research agent
│   │   ├── coding.ts      # Coding agent
│   │   ├── analysis.ts   # Analysis agent
│   │   └── general.ts    # General agent
│   └── tools/              # Agent tools
├── workers/
│   └── activities/
│       └── agent.activities.ts  # Add LangGraph activity
└── workflows/
    └── (existing)
```

---

## 5. Data Flow

1. **External trigger** (HTTP API or Temporal Workflow) calls `langGraphAgentActivity({ query, context })`
2. **Temporal Activity** initializes LangGraph state
3. **Triage Node** classifies intent:
   - `"research"` → Research Agent
   - `"code"` → Coding Agent
   - `"analysis"` → Analysis Agent
   - `other` → General Agent
4. **Specialist Agent** uses LangChain RAG:
   - `retrieve(query)` → documents from Supabase vector store
   - Augments prompt with retrieved context
   - Calls LLM (Gemini via existing service)
5. **Response** returned to Temporal
6. **Temporal logs** result to Supabase

---

## 6. Dependencies

```bash
npm install langgraph langchain langchain-core @langchain/community @langchain/openai
npm install @supabase/postgrest-js  # for vector similarity
```

---

## 7. Self-Healing & Error Handling

| Error | Recovery |
|-------|----------|
| LLM timeout | Retry 3x with exponential backoff |
| Vector store empty | Return "No context found" + allow fallback |
|Invalid intent | Route to General Agent |
| LangGraph crash | Temporal retries the entire activity |

---

## 8. Verification

- [ ] `langGraphAgentActivity` runs and returns response
- [ ] Triage correctly routes to specialist agents
- [ ] Each agent retrieves relevant context via RAG
- [ ] Responses include source citations
- [ ] Errors are logged to Supabase
- [ ] No data loss on worker restart (durability via Temporal)
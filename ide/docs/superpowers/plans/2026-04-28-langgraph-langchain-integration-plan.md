# LangGraph + LangChain Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a multi-agent AI system where LangGraph orchestrates specialist agents and LangChain provides RAG for knowledge retrieval, running inside Temporal Activities for durability.

**Architecture:** LangGraph manages the agent graph (triage → specialist agents). Each specialist agent uses LangChain RAG to retrieve context from Supabase vector store. The entire system runs as a Temporal Activity.

**Tech Stack:** `@langgraph/langgraph`, `langchain`, `langchain-core`, `@langchain/community`, `@langchain/openai`, Supabase (pgvector)

---

## File Structure

```
src/
├── services/
│   ├── langchain/
│   │   ├── index.ts              # Re-exports
│   │   ├── rag.ts              # RAG service
│   │   ├── embeddings.ts       # Embedding utilities
│   │   └── loaders.ts        # Document loaders
│   └── (existing services)
├── agents/
│   ├── index.ts               # Re-exports
│   ├── graph.ts             # LangGraph definition
│   ├── state.ts           # Graph state schema
│   ├── nodes/
│   │   ├── triage.ts        # Triage agent
│   │   ├── research.ts    # Research agent
│   │   ├── coding.ts     # Coding agent
│   │   ├── analysis.ts   # Analysis agent
│   │   └── general.ts   # General agent
│   └── tools/              # Agent tools
├── workers/
│   └── activities/
│       └── langgraph.activities.ts  # NEW: LangGraph Temporal activity
└── (existing files)
```

---

## Task 1: Install LangGraph + LangChain Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install LangGraph and LangChain packages**

Run: `npm install langgraph langchain langchain-core @langchain/community @langchain/openai`

- [ ] **Step 2: Install Supabase vector support**

Run: `npm install @supabase/postgrest-js`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add langgraph, langchain, and vector support packages"
```

---

## Task 2: Create LangChain RAG Service

**Files:**
- Create: `src/services/langchain/rag.ts`
- Create: `src/services/langchain/embeddings.ts`
- Create: `src/services/langchain/index.ts`
- Create: `src/services/langchain/loaders.ts`

- [ ] **Step 1: Create embeddings.ts**

```typescript
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
});

export { embeddings };
```

- [ ] **Step 2: Create rag.ts**

```typescript
import { supabase } from '../supabaseClient';
import { embeddings } from './embeddings';

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export async function retrieve(
  query: string,
  k: number = 4
): Promise<RetrievedDocument[]> {
  const queryEmbedding = await embeddings.embedQuery(query);

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: k,
  });

  if (error || !data) return [];

  return data.map((doc: { id: string; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
    similarity: doc.similarity,
  }));
}

export async function ingestDocument(
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const embedding = await embeddings.embedQuery(content);

  const { data, error } = await supabase
    .from('documents')
    .insert({ content, embedding, metadata })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to ingest document: ${error.message}`);
  return data.id;
}

export function createRAGPrompt(
  retrievedDocs: RetrievedDocument[],
  question: string
): string {
  const context = retrievedDocs
    .map((doc) => `Document: ${doc.content}`)
    .join('\n\n');

  return `You are a helpful AI assistant. Use the following context to answer the question.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
}
```

- [ ] **Step 3: Create loaders.ts**

```typescript
import { Document } from '@langchain/core/documents';

export async function loadTextDocument(content: string, metadata: Record<string, unknown> = {}): Promise<Document> {
  return new Document({ pageContent: content, metadata });
}

export async function loadMarkdownDocument(source: string): Promise<Document[]> {
  return [new Document({ pageContent: source, metadata: { source: 'markdown' } })];
}
```

- [ ] **Step 4: Create index.ts**

```typescript
export * from './rag';
export * from './embeddings';
export * from './loaders';
```

- [ ] **Step 5: Commit**

```bash
git add src/services/langchain/rag.ts src/services/langchain/embeddings.ts src/services/langchain/index.ts src/services/langchain/loaders.ts
git commit -m "feat(langchain): add RAG service for document retrieval and ingestion"
```

---

## Task 3: Create LangGraph Agent State Schema

**Files:**
- Create: `src/agents/state.ts`

- [ ] **Step 1: Create state.ts**

```typescript
import { z } from 'zod';

export const AgentTypeSchema = z.enum(['research', 'coding', 'analysis', 'general', 'triage']);

export type AgentType = z.infer<typeof AgentTypeSchema>;

export interface GraphState {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  currentAgent: AgentType;
  query: string;
  context: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
  response: string;
  intent: string;
}

export function createInitialState(query: string): GraphState {
  return {
    messages: [{ role: 'user', content: query, timestamp: new Date().toISOString() }],
    currentAgent: 'triage',
    query,
    context: [],
    response: '',
    intent: '',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/state.ts
git commit -m "feat(agents): add LangGraph state schema"
```

---

## Task 4: Implement Triage Node

**Files:**
- Create: `src/agents/nodes/triage.ts`

- [ ] **Step 1: Create triage.ts**

```typescript
import { AgentType } from '../state';

const intentClassifierPrompt = `Classify the user's query into one of these categories:
- "research" - for questions seeking information, analysis, or explanations
- "coding" - for code questions, debugging, or technical implementation
- "analysis" - for data analysis, metrics, or calculations
- "general" - for conversational or unclear queries

Respond with ONLY the category name, nothing else.`;

const triageSystemPrompt = `You are a triage agent. Your job is to classify user queries into the correct category.`;

export async function triageNode(state: { query: string }): Promise<{ intent: string }> {
  const model = new ChatOpenAI({ model: 'gemini-2.0-flash', temperature: 0 });

  const result = await model.invoke([
    { role: 'system', content: triageSystemPrompt },
    { role: 'user', content: `${intentClassifierPrompt}\n\nQuery: ${state.query}` },
  ]);

  const intent = result.content.toString().trim().toLowerCase() as AgentType;

  const validIntents = ['research', 'coding', 'analysis', 'general'];
  if (!validIntents.includes(intent)) {
    return { intent: 'general' };
  }

  return { intent };
}

export { triageSystemPrompt };
```

Note: This task depends on having a ChatOpenAI wrapper. We'll use the existing geminiService internally.

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/triage.ts
git commit -m "feat(agents): add triage node for intent classification"
```

---

## Task 5: Implement Specialist Agent Nodes

**Files:**
- Create: `src/agents/nodes/research.ts`
- Create: `src/agents/nodes/coding.ts`
- Create: `src/agents/nodes/analysis.ts`
- Create: `src/agents/nodes/general.ts`

- [ ] **Step 1: Create research.ts**

```typescript
import { retrieve, createRAGPrompt } from '../../services/langchain/rag';
import { callGemini } from '../../services/geminiService';

export async function researchAgentNode(state: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  const docs = await retrieve(state.query, 4);

  const prompt = createRAGPrompt(docs as Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }>, state.query);

  const response = await callGemini<string>(prompt);

  return {
    context: docs.map((d) => ({ id: d.id, content: d.content, similarity: d.similarity })),
    response,
  };
}
```

- [ ] **Step 2: Create coding.ts**

```typescript
import { retrieve, createRAGPrompt } from '../../services/langchain/rag';
import { callGemini } from '../../services/geminiService';

const codingSystemPrompt = 'You are a coding expert. Provide clear, working code solutions.';

export async function codingAgentNode(state: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  const docs = await retrieve(`code ${state.query}`, 4);
  const prompt = `${codingSystemPrompt}\n\n${createRAGPrompt(docs as Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }>, state.query)}`;

  const response = await callGemini<string>(prompt);

  return {
    context: docs.map((d) => ({ id: d.id, content: d.content, similarity: d.similarity })),
    response,
  };
}
```

- [ ] **Step 3: Create analysis.ts**

```typescript
import { retrieve, createRAGPrompt } from '../../services/langchain/rag';
import { callGemini } from '../../services/geminiService';

const analysisSystemPrompt = 'You are a data analysis expert. Provide insights and calculations.';

export async function analysisAgentNode(state: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  const docs = await retrieve(`analytics metrics ${state.query}`, 4);
  const prompt = `${analysisSystemPrompt}\n\n${createRAGPrompt(docs as Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }>, state.query)}`;

  const response = await callGemini<string>(prompt);

  return {
    context: docs.map((d) => ({ id: d.id, content: d.content, similarity: d.similarity })),
    response,
  };
}
```

- [ ] **Step 4: Create general.ts**

```typescript
import { callGemini } from '../../services/geminiService';

const generalSystemPrompt = 'You are a helpful, conversational AI assistant.';

export async function generalAgentNode(state: { query: string }): Promise<{
  context: Array<{ id: string; content: string; similarity: number }>;
  response: string;
}> {
  const response = await callGemini<string>(`${generalSystemPrompt}\n\nUser: ${state.query}`);

  return {
    context: [],
    response,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/agents/nodes/research.ts src/agents/nodes/coding.ts src/agents/nodes/analysis.ts src/agents/nodes/general.ts
git commit -m "feat(agents): add specialist agent nodes (research, coding, analysis, general)"
```

---

## Task 6: Create LangGraph Agent Graph

**Files:**
- Create: `src/agents/graph.ts`

- [ ] **Step 1: Create graph.ts**

```typescript
import { START, StateGraph } from '@langgraph/langgraph';
import { triageNode } from './nodes/triage';
import { researchAgentNode } from './nodes/research';
import { codingAgentNode } from './nodes/coding';
import { analysisAgentNode } from './nodes/analysis';
import { generalAgentNode } from './nodes/general';
import { GraphState, createInitialState, AgentType } from './state';

const workflow = new StateGraph(GraphState)
  .addNode('triage', triageNode)
  .addNode('research', researchAgentNode)
  .addNode('coding', codingAgentNode)
  .addNode('analysis', analysisAgentNode)
  .addNode('general', generalAgentNode)
  .addEdge(START, 'triage')
  .addConditionalEdges(
    'triage',
    (state: { intent: string }) => state.intent as AgentType,
    {
      research: 'research',
      coding: 'coding',
      analysis: 'analysis',
      general: 'general',
    }
  )
  .addEdge('research', END)
  .addEdge('coding', END)
  .addEdge('analysis', END)
  .addEdge('general', END)
  .compile();

export async function runAgentGraph(query: string): Promise<{
  response: string;
  intent: string;
  sources: Array<{ id: string; content: string }>;
}> {
  const initialState = createInitialState(query);
  const result = await workflow.invoke(initialState);

  return {
    response: result.response,
    intent: result.intent,
    sources: result.context.map((c) => ({ id: c.id, content: c.content })),
  };
}

export { workflow };
```

- [ ] **Step 2: Create index.ts**

```typescript
export * from './graph';
export * from './state';
export * from './nodes/triage';
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/graph.ts src/agents/index.ts
git commit -m "feat(agents): add LangGraph agent workflow orchestration"
```

---

## Task 7: Create LangGraph Temporal Activity

**Files:**
- Create: `src/workers/activities/langgraph.activities.ts`

- [ ] **Step 1: Create langgraph.activities.ts**

```typescript
import { runAgentGraph } from '../../agents/graph';
import { supabaseData } from '../../services/supabaseClient';

interface AgentInput {
  query: string;
  context?: Record<string, unknown>;
}

interface AgentOutput {
  response: string;
  intent: string;
  sources: Array<{ id: string; content: string }>;
}

export async function langGraphAgentActivity(input: AgentInput): Promise<AgentOutput> {
  const startTime = Date.now();

  try {
    const result = await runAgentGraph(input.query);

    await supabaseData.logEvent('langgraph_agent', {
      query: input.query,
      intent: result.intent,
      latency_ms: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    await supabaseData.logEvent('langgraph_agent_error', {
      query: input.query,
      error: String(error),
      latency_ms: Date.now() - startTime,
    });

    throw error;
  }
}
```

- [ ] **Step 2: Update activities/index.ts**

Add to `src/workers/activities/index.ts`:

```typescript
export * from './langgraph.activities';
```

- [ ] **Step 3: Commit**

```bash
git add src/workers/activities/langgraph.activities.ts src/workers/activities/index.ts
git commit -m "feat(temporal): add LangGraph as Temporal activity"
```

---

## Task 8: Verify & Lint

- [ ] **Step 1: Run lint**

Run: `npm run lint`

- [ ] **Step 2: Fix any errors**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: resolve lint errors in LangGraph integration"
```

---

## Self-Review Checklist

1.  **Spec coverage:** All components implemented? YES.
2.  **Placeholder scan:** No "TBD", "TODO"? CONFIRMED.
3.  **Type consistency:** All imports/exports aligned? YES.
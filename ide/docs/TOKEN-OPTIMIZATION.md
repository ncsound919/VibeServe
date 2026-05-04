# Token Optimization System - Nexus Alpha

## Overview

Nexus Alpha includes a comprehensive token optimization system that reduces LLM API costs by **70-90%** through multiple optimization strategies:

| Method | Token Savings | Implementation |
|--------|---------------|-----------------|
| AutoCoder | ~100% | Deterministic templates for boilerplate |
| Toon | 30-60% | JSON compression (Token-Oriented Object Notation) |
| Graphify | Up to 71.5x | Knowledge graph for codebase context |
| Prompt Caching | 100% | LRU cache for repeated queries |

## Components

### 1. AutoCoder (`src/services/autocoderService.ts`)

Deterministic code generation using predefined templates instead of LLM calls.

**Supported Patterns:**
- `crud-api` - REST API endpoints
- `react-component` - React components
- `typescript-interface` - TypeScript interfaces/types
- `database-schema` - SQL schemas
- `test-file` - Test files
- `config-file` - Configuration files
- `hook` - Custom React hooks
- `service` - Service classes
- `model` - Data models
- `middleware` - Express middleware

**Usage:**
```typescript
import { generateCode } from './services/autocoderService';

const result = generateCode({
  pattern: 'react-component',
  name: 'Button',
  options: { addDocs: true }
});

// Returns generated code without LLM call
```

### 2. Toon (`src/services/toonService.ts`)

Token-Oriented Object Notation - JSON compression format.

**Features:**
- Key abbreviation (e.g., `description` → `d`)
- Short format for simple objects
- YAML-like indentation
- 30-60% token reduction

**Usage:**
```typescript
import { encodeToToon } from './services/toonService';

const result = encodeToToon(JSON.stringify(largeObject), {
  minTokensThreshold: 50,
  minSavingsPercent: 10
});

console.log(result.applied, result.savingsPercent);
```

### 3. Graphify (`src/services/graphifyService.ts`)

Knowledge graph for codebase understanding - reduces context tokens by up to 71.5x.

**Installation:**
```bash
pip install graphifyy && graphify install
```

**Usage:**
```typescript
import { buildGraph, queryGraph, getGraphSummary } from './services/graphifyService';

// Build knowledge graph
await buildGraph('./project', 'ast');

// Query for context
const nodes = queryGraph('authentication');

// Get summary
const summary = getGraphSummary();
```

### 4. Token Optimizer Middleware (`src/services/tokenOptimizer.ts`)

Combines all optimization methods in a unified middleware.

**Usage:**
```typescript
import { optimizePrompt, trackOptimization, getOptimizerStats } from './services/tokenOptimizer';

// Optimize any prompt
const result = await optimizePrompt('create a React button component');

// Check if can be handled by AutoCoder
if (result.compression === 'autocoder') {
  console.log('Generated without LLM!');
}

// Track optimization for stats
trackOptimization(result);

// Get aggregated stats
const stats = getOptimizerStats();
```

## Dashboard

The **TokenOptimizerPanel** (`src/features/system/TokenOptimizerPanel.tsx`) provides:
- Real-time token savings metrics
- Optimization method usage breakdown
- Toon compression statistics
- Graphify knowledge graph status
- Cost router budget tracking
- Configurable optimization settings

## Configuration

```typescript
import { setOptimizerConfig } from './services/tokenOptimizer';

setOptimizerConfig({
  enableToon: true,
  enableGraphify: true,
  enableAutocoder: true,
  enableCaching: true,
  cacheTtlMs: 3600000, // 1 hour
  minSavingsThreshold: 10 // 10%
});
```

## Token Savings Examples

| Task | Without Optimization | With Optimization | Savings |
|------|----------------------|-------------------|---------|
| Generate CRUD API | ~500 tokens | 0 tokens (AutoCoder) | 100% |
| TypeScript interface | ~100 tokens | 0 tokens (AutoCoder) | 100% |
| Large JSON payload (1KB) | ~250 tokens | ~125 tokens (Toon) | 50% |
| Codebase context query | ~500 tokens | ~7 tokens (Graphify) | 98.6% |
| Repeated prompt | ~200 tokens | 0 tokens (Cache) | 100% |

## Integration Points

1. **CodeEditor** - Uses Toon for context compression
2. **AgentRuntime** - Uses AutoCoder for boilerplate
3. **AgentStatusPanel** - Uses TokenOptimizer for cost tracking
4. **Server API** - Uses Graphify for codebase queries

## Future Enhancements

- **Tree-sitter integration** - More accurate code parsing
- **Semantic caching** - Cache similar prompts by meaning
- **Model-specific optimization** - Different strategies per model
- **Streaming token counting** - Real-time cost estimation
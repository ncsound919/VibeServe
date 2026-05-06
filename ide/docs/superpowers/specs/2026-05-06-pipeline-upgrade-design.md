# VibeServe Pipeline 2.0 — Master Plan

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Pipeline error handling + per-component generation + token optimization

---

## 1. Problem Statement

Current pipeline fails because:
1. No error handling (steps hang, pipeline continues with broken state)
2. Tries to generate ALL files in one API call (fails on reasoning models, times out)
3. No retry logic (single failure = step dead)
4. No runtime validation (generated code doesn't compile)
5. Wastes tokens (full context sent every time, no compression)

## 2. Architecture

```
INPUT: User intent
  │
  ▼
Step 0: SCAFFOLD (Cheetah autocoder — 0 LLM tokens)
  ├─ Generate: package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, .eslintrc, index.html
  ├─ Run: npm install --legacy-peer-deps
  ├─ Validate: node_modules exists, configs parse
  └─ CRITICAL: fail = stop pipeline
  │
  ▼
Step 1: ARCHITECT (deepseek-v4-pro)
  ├─ Output: structured plan + FILE MANIFEST in dependency order
  ├─ Compress output with TOON → store for context
  ├─ 3 retries, 90s timeout
  └─ CRITICAL: fail = stop pipeline
  │
  ▼
Step 2: CODE — Per-File Loop (mimo-v2-pro)
  For each file in manifest (dependency order):
  ├─ Generate: using TOON context (40% token savings)
  ├─ TypeScript check: npx tsc --noEmit on this file
  │   └─ Fail → retry with error message as context (max 3)
  ├─ ESLint check: if config exists
  │   └─ Issues → store for fix
  └─ File status: ✅ green / ⚠ flagged
  │
  ▼
Step 3: REVIEW — Per-File (deepseek-v4-pro)
  For each generated file:
  ├─ Graphify code → dependency + metrics graph
  ├─ LLM reviews graph (75% token savings)
  └─ Output: issues list per file
  │
  ▼
Step 4: VERIFY — Aggregate (deepseek-v4-pro)
  ├─ Graphify all files → summary
  ├─ LLM checks: WCAG AA, OWASP top 10, performance, TypeScript strict
  └─ Output: pass/fail per category
  │
  ▼
Step 5: ITERATE — Per-File Fixes (mimo-v2-pro)
  For files with review/verify issues:
  ├─ Fix using TOON context
  └─ Re-validate (TypeScript + ESLint)
  │
  ▼
Step 7: DEPLOY CONFIG (mimo-v2-pro)
  ├─ Generate: Dockerfile, docker-compose.yml, vercel.json
  └─ OPTIONAL: fail = skip
  │
  ▼
Step 8: FINAL VALIDATE
  ├─ npx tsc --noEmit (all files)
  ├─ npx eslint (all files)
  ├─ npx vite build
  └─ Output: build pass/fail, error count, file statuses
```

## 3. Error Handling

### Retry Strategy

```
Attempt 1: Full prompt, full context
Attempt 2: Simplified prompt, 50% context
Attempt 3: Minimal prompt, no context

Backoff: 2s → 4s → 8s between retries
Timeout: 90s per API call
```

### Error Categories

| Error | Response |
|-------|----------|
| API timeout | Retry simplified |
| API 429 rate limit | Backoff 10s, retry |
| API 500 server error | Retry once, then flag |
| API 400 bad request | Log, skip, don't retry |
| Empty response | Model might be reasoning-only → switch to mimo |
| TypeScript compile fail | Feed errors to AI, retry generate |
| npm install fail | Fix package names, retry |

### Critical vs Non-Critical

| Step | Critical | On Failure |
|------|----------|------------|
| Scaffold | YES | Stop pipeline |
| Architect | YES | Stop pipeline |
| Code (per file) | NO | Flag file, continue |
| Review (per file) | NO | Flag, continue |
| Verify | NO | Flag, continue |
| Iterate | NO | Keep original |
| Deploy | NO | Skip, manual |
| Validate | YES | Return files to iterate |

## 4. Token Optimization

### Scaffolding → Cheetah Autocoder (0 LLM tokens)
- Template-based boilerplate generation
- ~90% token savings vs LLM

### Context → TOON Compression  
- Uses existing `vibe_compress` tool
- 30-60% token reduction for architect output

### Review → Graphify
- Uses existing graphify utility
- 75% token savings for review/verify steps

### Token Budget

| Step | Calls | Uncached tokens | Optimized tokens | Savings |
|------|-------|----------------|-----------------|---------|
| Scaffold | 0 LLM | 0 | 0 | — |
| Architect | 1 | 4,000 | 4,000 | — |
| Code (8 files) | ~12 | 48,000 | 28,800 | 40% |
| Review (8 files) | 8 | 32,000 | 8,000 | 75% |
| Verify | 1 | 4,000 | 1,000 | 75% |
| Iterate (3 files) | ~6 | 12,000 | 7,200 | 40% |
| Deploy | 1 | 2,000 | 2,000 | — |
| **Total** | **~29** | **~102,000** | **~51,000** | **50%** |

## 5. Model Selection

| Step | Model | Why |
|------|-------|-----|
| Architect | deepseek-v4-pro | Reasoning good for planning |
| Code | mimo-v2-pro | Non-reasoning, fast, real code output |
| Review | deepseek-v4-pro | Reasoning good for critique |
| Verify | deepseek-v4-pro | Reasoning good for standards check |
| Iterate | mimo-v2-pro | Code generation |
| Deploy | mimo-v2-pro | Structured config output |

## 6. File Manifest Format

```typescript
interface FileManifestEntry {
  path: string;           // "src/components/ProductCard.tsx"
  type: 'component' | 'store' | 'hook' | 'type' | 'page' | 'util' | 'style';
  dependsOn: string[];    // ["@/types", "cartStore"]
  description: string;    // "Product card with image, price, add to cart"
}

interface Manifest {
  files: FileManifestEntry[];
  dependencyGraph: Record<string, string[]>;
}
```

## 7. Per-File Status

```typescript
interface FileStatus {
  path: string;
  status: 'pending' | 'generating' | 'checking' | 'reviewing' | 'green' | 'red';
  issues: string[];
  retries: number;
  typeScriptErrors?: string;
  reviewFindings?: string;
}
```

## 8. Implementation Checklist

- [ ] Add Cheetah autocoder integration for scaffolding
- [ ] Add TOON compression to architect→code context
- [ ] Add Graphify to review/verify steps
- [ ] Rewrite pipeline as per-file loop with manifest
- [ ] Add retry with exponential backoff
- [ ] Add critical/non-critical step gating
- [ ] Add TypeScript compile check per file
- [ ] Add ESLint check per file
- [ ] Add final build validation step
- [ ] Add per-file status reporting in API
- [ ] Add timeout with AbortController
- [ ] Add model fallback (reasoning → non-reasoning)

## 9. Self-Review

**Placeholder scan:** No TBD, TODO, or incomplete sections.

**Internal consistency:** Architecture matches error handling model. Token budgets correspond to step counts.

**Scope check:** Single deliverable — pipeline upgrade. One spec, one plan.

**Ambiguity check:** All model names confirmed working. All token budgets calculated.

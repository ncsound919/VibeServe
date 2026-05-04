# ADR-0001: Template Registry Architecture
**Date:** 2026-04-30
**Status:** Accepted
**Context:** We need a safe, extensible way to scaffold project templates from natural-language descriptions. The registry must avoid circular dependencies, runtime-require patterns, and broken `this` references that plagued earlier drafts.
**Decision:**
1. Each template is a `TemplateDefinition` object with a typed `scaffold(appRoot, spec)` function
2. Templates use module-level `import { writeFileSync, mkdirSync }` — no dynamic `require()`
3. `AppSpecLike = { description: string }` — a simple type alias used in scaffolds (no import cycle)
4. `getTemplateForDescription()` uses keyword scoring with longest--match wins
5. `listTemplates()` exposes available templates for API discovery
6. Templates are ordered by specificity: express-api > fullstack > react-ts-vite (most specific first)
**Alternatives Considered:**
- Dynamic `require()` loading from `templates/{id}/index.ts`: rejected — TS resolution complexity
- Class-based templates: rejected — adds ceremony without benefit
- LLM-driven template selection: deferred to Phase 2 (LLM planner)
**Consequences:**
- New templates added to `src/coding-agent/templates/registry. ts` by adding a `const xxxTemplate: TemplateDefinition` entry and adding it to `REGISTRY[]`
- Templates must be side-effect free (write files only; no network, no async state)
- All scaffolds receive `appRoot: string` and `spec: AppSpecLike`
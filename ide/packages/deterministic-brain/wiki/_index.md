# Deterministic Brain — Knowledge Wiki

Grounding source for the deterministic brain and its agents.

## Namespaces

- `business/` — mission, revenue engines, entity catalog, decision log
- `bookbridge/` — how to ground with the 133-book library; topic references
- `agendas/` — per-agent agendas (one page per registered agent)
- `crons/` — scheduled jobs and the day-flow orchestration plan
- `workflows/` — business chain templates and the chain builder

## How the brain uses this

On every query the brain searches this wiki and prepends matched pages as
`[CONTEXT · wiki]` blocks before composing its response. Pages list `sources`
so every answer traces to evidence.

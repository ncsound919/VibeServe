---
title: Chain Templates
tags: [workflows, chain-builder, templates]
namespace: workflows
sources:
  - code: src/lib/draymond/chain-builder.ts
aliases: [chain templates, chain builder]
---
# Chain Templates

`chain-builder.ts` builds chains from blueprints: name/slug, steps with
`entity_slug`, `action`, `input_mapping` (JSONPath), `depends_on`, and
`parallel_group`. Validation catches unknown entities, missing deps, and cycles.

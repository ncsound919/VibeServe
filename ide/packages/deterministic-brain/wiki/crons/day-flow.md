---
title: Day Flow
tags: [crons, day, phases, orchestrator]
namespace: crons
sources:
  - code: src/lib/draymond/day-orchestrator.ts
aliases: [day flow, day orchestrator, phases]
---
# Day Flow — Day Orchestrator

Four phases group jobs in order:

- **morning (5–12):** sec-scan, news, market, qa, treasury, mission
- **midday (12–17):** fleet duty, self-repair, marketing pulse
- **evening (17–22):** marketing pulse (next-day prep)
- **night (0–5):** self-learning, rd_night, book library scan, avatars

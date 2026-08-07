---
title: System Health
tags: [health, benchmarks, weakness]
namespace: business
sources:
  - code: src/lib/draymond/run-benchmark.ts
aliases: [system health, health report, weakest components]
---
# System Health

Updated each Friday by the Benchmark: Upgrade Review cron.

## Current weakest components

_(populated by the benchmark loop — see the upgrade queue)_

## Benchmark schedule

- Mon: entities + sites
- Tue: crons
- Wed: chains
- Thu: deep-score weakest N (reporank / Grader / Vibe-Reality)
- Fri: upgrade review + health page refresh

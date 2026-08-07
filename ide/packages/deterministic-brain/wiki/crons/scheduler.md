---
title: Scheduler & Crons
tags: [crons, scheduler, jobs]
namespace: crons
sources:
  - code: src/lib/draymond/scheduler.ts
  - code: src/lib/draymond/business-chains.ts
aliases: [crons, scheduled jobs, cron jobs]
---
# Scheduler & Crons

Core system jobs (seeded in `business-chains.ts` JOB_DEFS):

| Job | Cron |
|---|---|
| Agent Health Check | `*/15 * * * *` |
| Site Health Checks | `*/5 * * * *` |
| Daily Health Digest | `0 20 * * *` |
| Memory Decay Sweep | `0 * * * *` |
| Morning Briefing | `0 9 * * *` |
| Daily Finance Analysis | `30 9 * * 1-5` |
| Daily Marketing Run | `0 10 * * *` |
| Music Business Automation | `0 11 * * *` |
| Sports Betting Daily | `0 12 * * *` |
| Supply Chain Intelligence | `0 8 * * 1-5` |
| Full Content Creation | `0 14 * * 1,3,5` |

Benchmark jobs (added by the benchmarking subsystem): entities+sites Mon,
crons Tue, chains Wed, deep-score Thu, upgrade review Fri.

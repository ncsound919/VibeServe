# `agenda_log_entry`

_Category: Agenda | Module: `vibeserve/tools/agenda.py`_

## Description

Log a work entry (PR, refactor, test) against an agenda goal.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `goal_id` | `str` | `''` |
| `action_type` | `Literal['pr', 'refactor', 'test', 'docs', 'reuse', 'fix']` | `''` |
| `repo` | `str` | `''` |
| `description` | `str` | `''` |
| `initiative_id` | `str` | `''` |
| `branch` | `str` | `''` |

## Returns

`Dict[str, Any]`

## Source

Defined in `agenda_log_entry()` in `vibeserve/tools/agenda.py`


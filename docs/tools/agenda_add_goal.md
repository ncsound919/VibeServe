# `agenda_add_goal`

_Category: Agenda | Module: `vibeserve/tools/agenda.py`_

## Description

Add a single goal to the agenda with optional type, areas, due date and target metric.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `title` | `str` | *(required)* |
| `description` | `str` | `''` |
| `priority` | `int` | `3` |
| `timeline` | `str` | `''` |
| `goal_type` | `str` | `''` |
| `target_metric` | `str` | `''` |
| `due_date` | `str` | `''` |
| `effort` | `str` | `''` |
| `areas` | `str` | `''` |
| `allow_bg_work` | `bool` | `True` |
| `schedule_mode` | `str` | `'hourly'` |

## Returns

`Dict[str, Any]`

## Source

Defined in `agenda_add_goal()` in `vibeserve/tools/agenda.py`


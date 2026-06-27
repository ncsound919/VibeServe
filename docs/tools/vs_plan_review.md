# `vs_plan_review`

_Category: Code Review | Module: `vibeserve/tools/mutly_integration.py`_

## Description

Review an execution plan and return structured critique.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `plan` | `str` | *(required)* |
| `file_context` | `Optional[str]` | `None` |
| `recent_errors` | `Optional[List[str]]` | `None` |
| `trace_id` | `Optional[str]` | `None` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_plan_review_tool()` in `vibeserve/tools/mutly_integration.py`


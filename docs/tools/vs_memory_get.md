# `vs_memory_get`

_Category: Memory | Module: `vibeserve/tools/mutly_integration.py`_

## Description

Retrieve workspace-scoped memory entries for Mutly workflows.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `workspace_id` | `str` | *(required)* |
| `context_types` | `Optional[List[str]]` | `None` |
| `limit` | `int` | `20` |
| `trace_id` | `Optional[str]` | `None` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_memory_get_tool()` in `vibeserve/tools/mutly_integration.py`


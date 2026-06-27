# `vs_memory_store`

_Category: Memory | Module: `vibeserve/tools/mutly_integration.py`_

## Description

Store workspace-scoped memory for Mutly workflows.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `workspace_id` | `str` | *(required)* |
| `context_type` | `str` | *(required)* |
| `payload` | `Dict[str, Any]` | *(required)* |
| `trace_id` | `Optional[str]` | `None` |
| `ttl_seconds` | `int` | `604800` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_memory_store_tool()` in `vibeserve/tools/mutly_integration.py`


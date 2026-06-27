# `vs_opencode_execute`

_Category: Integration | Module: `vibeserve/tools/opencode_execution.py`_

## Description

Execute a coding task using the OpenCode CLI agent.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `task` | `str` | *(required)* |
| `workspace_dir` | `str` | *(required)* |
| `context_files` | `Optional[List[str]]` | `None` |
| `model` | `Optional[str]` | `None` |
| `timeout_seconds` | `int` | `300` |
| `trace_id` | `Optional[str]` | `None` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_opencode_execute_tool()` in `vibeserve/tools/opencode_execution.py`


# `codegraph_query`

_Category: Integration | Module: `vibeserve/tools/code_graph.py`_

## Description

Search the knowledge graph for symbols — returns callers, callees, file locations, and export status. Replaces grep for structural code questions.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `query` | `str` | *(required)* |
| `repo_key` | `str` | `''` |

## Returns

`Dict[str, Any]`

## Source

Defined in `codegraph_query()` in `vibeserve/tools/code_graph.py`


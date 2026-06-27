# `codegraph_build`

_Category: Integration | Module: `vibeserve/tools/code_graph.py`_

## Description

Build a knowledge graph from an indexed repo — creates call graph, import resolution, class hierarchy, and communities. Prerequisite before using other codegraph_* tools.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `repo_key` | `str` | `''` |
| `repo_path` | `str` | `'.'` |

## Returns

`Dict[str, Any]`

## Source

Defined in `codegraph_build()` in `vibeserve/tools/code_graph.py`


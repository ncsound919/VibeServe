# `codegraph_impact`

_Category: Integration | Module: `vibeserve/tools/code_graph.py`_

## Description

Blast radius analysis — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `target` | `str` | *(required)* |
| `direction` | `str` | `'upstream'` |
| `repo_key` | `str` | `''` |
| `max_depth` | `int` | `3` |

## Returns

`Dict[str, Any]`

## Source

Defined in `codegraph_impact()` in `vibeserve/tools/code_graph.py`


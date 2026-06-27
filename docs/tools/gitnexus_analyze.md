# `gitnexus_analyze`

_Category: Integration | Module: `vibeserve/tools/gitnexus_bridge.py`_

## Description

Index a repository with GitNexus — builds a knowledge graph of symbols, call chains, clusters, and execution flows. Prerequisite before using other gitnexus_* tools.

### Details

**Args:**
repo_path: Path to the repository (default: current directory)
force: Force full re-index even if already indexed
Returns index statistics on success.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `repo_path` | `str` | `'.'` |
| `force` | `bool` | `False` |

## Returns

`Dict[str, Any]`

## Source

Defined in `gitnexus_analyze()` in `vibeserve/tools/gitnexus_bridge.py`


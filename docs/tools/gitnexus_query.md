# `gitnexus_query`

_Category: Integration | Module: `vibeserve/tools/gitnexus_bridge.py`_

## Description

Search the GitNexus knowledge graph — find symbols, processes, and definitions matching a query. Uses hybrid search (BM25 + semantic).

### Details

Returns process-grouped results with definitions, symbols, and execution flows.
Use this instead of grep/read_file for understanding code structure.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `query` | `str` | *(required)* |
| `repo_path` | `str` | `'.'` |

## Returns

`Dict[str, Any]`

## Source

Defined in `gitnexus_query()` in `vibeserve/tools/gitnexus_bridge.py`


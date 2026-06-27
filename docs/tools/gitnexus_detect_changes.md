# `gitnexus_detect_changes`

_Category: Integration | Module: `vibeserve/tools/gitnexus_bridge.py`_

## Description

Pre-commit impact analysis — maps changed lines to affected processes. Use before committing to understand what will break.

### Details

**Args:**
repo_path: Repository path
scope: 'all' (entire working tree), 'staged' (staged changes only)
Returns risk level and affected symbols/processes.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `repo_path` | `str` | `'.'` |
| `scope` | `str` | `'all'` |

## Returns

`Dict[str, Any]`

## Source

Defined in `gitnexus_detect_changes()` in `vibeserve/tools/gitnexus_bridge.py`


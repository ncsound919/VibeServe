# `gitnexus_impact`

_Category: Integration | Module: `vibeserve/tools/gitnexus_bridge.py`_

## Description

Analyze blast radius — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring.

### Details

**Args:**
target: Symbol name to analyze (e.g. 'UserService', 'validateUser')
direction: 'upstream' (what depends on this) or 'downstream' (what this depends on)
repo_path: Repository path
max_depth: How deep to trace the dependency chain
Returns depth-grouped results with confidence scores.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `target` | `str` | *(required)* |
| `direction` | `str` | `'upstream'` |
| `repo_path` | `str` | `'.'` |
| `max_depth` | `int` | `3` |

## Returns

`Dict[str, Any]`

## Source

Defined in `gitnexus_impact()` in `vibeserve/tools/gitnexus_bridge.py`


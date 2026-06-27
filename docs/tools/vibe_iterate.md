# `vibe_iterate`

_Category: Assessment | Module: `vibeserve/tools/v5_tools.py`_

## Description

Continuous improvement loop: critique -> repair -> verify -> repeat.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `specification` | `Dict[str, Any]` | *(required)* |
| `requirements` | `List[str]` | *(required)* |
| `max_iterations` | `int` | `3` |
| `quality_threshold` | `float` | `0.8` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vibe_iterate_tool()` in `vibeserve/tools/v5_tools.py`


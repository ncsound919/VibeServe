# `generate_ui_spec`

_Category: Core | Module: `vibeserve/tools/v4_tools.py`_

## Description

Generate a production-ready UI specification with multi-agent critique, WCAG AAA validation, and design system enforcement.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `page_type` | `str` | *(required)* |
| `requirements` | `List[str]` | *(required)* |
| `design_system` | `Any` | `None` |
| `target_audience` | `str` | `'general users'` |
| `use_cache` | `bool` | `True` |

## Returns

`Dict[str, Any]`

## Source

Defined in `generate_ui_spec_tool()` in `vibeserve/tools/v4_tools.py`


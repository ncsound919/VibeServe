# `vs_generate_artifact`

_Category: Code Generation | Module: `vibeserve/tools/mutly_integration.py`_

## Description

Generate a structured advisory artifact (not executable).

### Details

When use_llm=True (default) and an LLM provider is configured, the prompt
is sent to the configured provider. Otherwise returns a deterministic
stub (preserves the original advisory-only contract).

## Parameters

| Name | Type | Default |
|------|------|---------|
| `prompt` | `str` | *(required)* |
| `artifact_type` | `str` | `'code_block'` |
| `design_context` | `Optional[str]` | `None` |
| `trace_id` | `Optional[str]` | `None` |
| `use_llm` | `bool` | `True` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_generate_artifact_tool()` in `vibeserve/tools/mutly_integration.py`


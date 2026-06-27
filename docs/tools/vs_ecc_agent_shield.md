# `vs_ecc_agent_shield`

_Category: Code Review | Module: `vibeserve/tools/ecc_integration.py`_

## Description

Run ECC AgentShield security scan on provided code content. Checks for secrets, permission risks, hook injection, MCP risks, and config issues.

## Parameters

| Name | Type | Default |
|------|------|---------|
| `files` | `str` | *(required)* |
| `trace_id` | `Optional[str]` | `None` |

## Returns

`Dict[str, Any]`

## Source

Defined in `vs_ecc_agent_shield_tool()` in `vibeserve/tools/ecc_integration.py`


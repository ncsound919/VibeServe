"""LLMCallMixin — shared _mcp_llm_call for all pipeline classes."""
from __future__ import annotations
from typing import Any


class LLMCallMixin:
    async def _mcp_llm_call(self, prompt: str, temperature: float = 0.3, ctx: Any = None):
        import vibeserve
        return await vibeserve.mcp_llm_call(prompt, temperature=temperature, ctx=ctx)

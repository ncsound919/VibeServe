"""Local provider (localhost Ollama / OpenAI-compatible endpoint)."""
from __future__ import annotations

import os
from typing import Optional

from vibeserve.providers.base import LLMProvider


class LocalProvider(LLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1")
        self.model = model or os.getenv("LOCAL_LLM_MODEL", "llama3.2")
        self.api_key = "not-needed"

    @property
    def name(self) -> str:
        return "Local"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format
        )

"""DeepSeek provider."""
from __future__ import annotations

import os
from typing import Optional

from vibeserve.providers.base import LLMProvider


class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        self.base_url = "https://api.deepseek.com/v1"
        self.model = model or os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    @property
    def name(self) -> str:
        return "DeepSeek"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format
        )

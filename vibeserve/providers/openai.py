"""OpenAI and OpenRouter providers."""
from __future__ import annotations

import os
from typing import Optional

from vibeserve.providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    @property
    def name(self) -> str:
        return "OpenAI"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format
        )


class OpenRouterProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = model or os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")

    @property
    def name(self) -> str:
        return "OpenRouter"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format,
            extra_headers={
                "HTTP-Referer": "https://vibeserve.dev",
                "X-Title": "VibeServe"
            }
        )

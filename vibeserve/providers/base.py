"""LLMProvider base class."""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

import httpx

log = logging.getLogger("VibeServe")


def _get_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, read=300.0),
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=20),
        transport=httpx.AsyncHTTPTransport(retries=3),
    )


class LLMProvider(ABC):
    @abstractmethod
    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    async def stream(self, prompt: str, temperature: float = 0.7,
                     response_format: str = "json") -> "AsyncIterator[Dict[str, Any]]":
        result = await self.call(prompt, temperature, response_format)
        if result is None:
            yield {"delta": "", "done": True, "error": "call returned None"}
        else:
            yield {"delta": result, "content": result, "done": True, "provider": self.name}

    async def _api_call(self, base_url: str, api_key: str, model: str,
                        prompt: str, temperature: float, response_format: str,
                        extra_headers: Optional[Dict[str, str]] = None,
                        max_retries: int = 4) -> Optional[str]:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        if extra_headers:
            headers.update(extra_headers)

        payload: Dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        async with _get_client() as client:
            for attempt in range(max_retries):
                try:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        json=payload, headers=headers
                    )
                    if resp.status_code == 429:
                        wait = (2 ** attempt) * 1.2
                        log.warning(f"[{self.name}] Rate limited. Waiting {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                except Exception as e:
                    log.warning(f"[{self.name}] LLM call failed (attempt {attempt + 1}): {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
        return None

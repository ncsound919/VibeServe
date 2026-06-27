"""BigHomieProvider — delegates LLM completion to Big Homie's llm_gateway."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import httpx

from vibeserve.providers.base import LLMProvider

log = logging.getLogger("VibeServe")


class BigHomieProvider(LLMProvider):
    def __init__(self):
        self._base_url = (os.getenv("BIG_HOMIE_URL") or "http://localhost:8888").rstrip("/")
        self._model = os.getenv("BIG_HOMIE_MODEL", "")
        self._provider = os.getenv("BIG_HOMIE_LLM_PROVIDER", "")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, read=300.0),
            limits=httpx.Limits(max_keepalive_connections=2, max_connections=10),
        )

    @property
    def name(self) -> str:
        return "big-homie"

    @property
    def model(self) -> str:
        return self._model or "big-homie-gateway"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        messages = [{"role": "user", "content": prompt}]
        if response_format == "json":
            messages.insert(0, {
                "role": "system",
                "content": "Always respond with valid JSON. No markdown, no explanation outside the JSON object.",
            })

        body: dict = {"messages": messages}
        if self._provider:
            body["provider"] = self._provider
        if self._model:
            body["model"] = self._model

        for attempt in range(3):
            try:
                resp = await self._client.post(
                    f"{self._base_url}/llm/complete",
                    json=body,
                )
                if resp.status_code == 429:
                    wait = (2 ** attempt) * 1.5
                    log.warning(f"[big-homie] Rate limited. Waiting {wait}s...")
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "success":
                    return data.get("content", None)
                log.warning(f"[big-homie] Gateway error: {data.get('message', 'unknown')}")
                return None
            except Exception as e:
                log.warning(f"[big-homie] Attempt {attempt + 1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
        return None

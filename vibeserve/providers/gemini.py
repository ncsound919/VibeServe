"""Gemini provider using the native API."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import httpx

from vibeserve.providers.base import LLMProvider

log = logging.getLogger("VibeServe")


class GeminiProvider(LLMProvider):
    """Gemini provider using the NATIVE API (key as query param).

    The OpenAI-compatible endpoint (`/v1beta/openai/...`) uses Bearer auth which
    only works with AIza-prefixed keys.  The native endpoint (``:generateContent``)
    uses ?key= query-param auth which works with ALL Google API key formats.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self._base_api = "https://generativelanguage.googleapis.com/v1beta"
        self.model = model or os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")

    @property
    def name(self) -> str:
        return "Gemini"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self.api_key:
            log.error("GeminiProvider: No GOOGLE_API_KEY set")
            return None

        url = f"{self._base_api}/models/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 4096,
            },
        }
        if response_format == "json":
            payload["generationConfig"]["responseMimeType"] = "application/json"

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=120.0)) as client:
            for attempt in range(3):
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 429:
                        wait = (2 ** attempt) * 2.0
                        log.warning(f"[Gemini] Rate limited. Waiting {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    data = resp.json()

                    candidates = data.get("candidates", [])
                    if not candidates:
                        log.warning(f"[Gemini] No candidates in response")
                        return None

                    content = candidates[0].get("content", {})
                    parts = content.get("parts", [])
                    if not parts:
                        log.warning(f"[Gemini] No parts in candidate")
                        return None

                    text = parts[0].get("text", "")
                    if not text:
                        return None

                    return text

                except Exception as e:
                    log.warning(f"[Gemini] Call failed (attempt {attempt + 1}): {e}")
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
        return None

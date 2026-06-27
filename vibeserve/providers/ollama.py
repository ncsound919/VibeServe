"""Ollama Cloud provider."""
from __future__ import annotations

import asyncio
import json as _json
import logging
import os
from typing import Optional

import httpx

from vibeserve.providers.base import LLMProvider

log = logging.getLogger("VibeServe")


class OllamaCloudProvider(LLMProvider):
    """Ollama Cloud (ollama.com) — paid cloud inference via the native API.

    Distinct from LocalProvider (which targets localhost:11434 for a local
    Ollama daemon).  Ollama Cloud keys are obtained from https://ollama.com
    and have the format `<32-hex>.<base64>`.

    Note: Ollama Cloud's `/v1/chat/completions` OpenAI-compatible endpoint
    returns 404.  Use the native `/api/chat` endpoint instead.
    """
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OLLAMA_API_KEY")
        self.base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com")
        self.model = model or os.getenv("OLLAMA_MODEL", "gemma3:4b")

    @property
    def name(self) -> str:
        return "OllamaCloud"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self.api_key:
            log.error("OllamaCloudProvider: No OLLAMA_API_KEY set")
            return None
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if response_format == "json":
            payload["format"] = "json"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=300.0)) as client:
            for attempt in range(3):
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 429:
                        wait = (2 ** attempt) * 2.0
                        log.warning(f"[OllamaCloud] Rate limited. Waiting {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    msg = data.get("message") or {}
                    content = msg.get("content")
                    if not content:
                        log.warning(f"[OllamaCloud] Empty response: {str(data)[:200]}")
                        return None
                    return content
                except Exception as e:
                    log.warning(f"[OllamaCloud] Call failed (attempt {attempt + 1}): {e}")
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
        return None

    async def stream(self, prompt: str, temperature: float = 0.7,
                     response_format: str = "json"):
        if not self.api_key:
            log.error("OllamaCloudProvider: No OLLAMA_API_KEY set")
            yield {"delta": "", "done": True, "error": "No OLLAMA_API_KEY set"}
            return
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "options": {"temperature": temperature},
        }
        if response_format == "json":
            payload["format"] = "json"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        cumulative = ""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=300.0)) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = _json.loads(line)
                        except _json.JSONDecodeError:
                            continue
                        msg = data.get("message") or {}
                        delta = msg.get("content") or ""
                        if delta:
                            cumulative += delta
                            yield {
                                "delta": delta,
                                "content": cumulative,
                                "done": False,
                                "provider": self.name,
                                "model": self.model,
                            }
                        if data.get("done"):
                            yield {
                                "delta": "",
                                "content": cumulative,
                                "done": True,
                                "provider": self.name,
                                "model": self.model,
                                "usage": data.get("usage") or {},
                            }
                            return
        except Exception as e:
            log.exception(f"[OllamaCloud] stream failed: {e}")
            yield {"delta": "", "done": True, "error": str(e), "provider": self.name}

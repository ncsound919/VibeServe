"""LLMRouter — complexity-based routing, global instances, and convenience call."""
from __future__ import annotations

import logging
import os
import shutil
from typing import Any, Dict, Optional

from vibeserve.task_classifier import ClassifyLevel
from vibeserve.providers.base import LLMProvider
from vibeserve.providers.utils import SamplingProvider, is_mock

log = logging.getLogger("VibeServe")

_DEFAULT_ROUTING: dict[ClassifyLevel, tuple[str, str]] = {
    "simple":   ("local",    ""),
    "medium":   ("deepseek", ""),
    "complex":  ("deepseek", ""),
    "critical": ("opencode", "opencode/hy3-preview-free"),
}


def _load_routing_from_env(routing: dict[ClassifyLevel, tuple[str, str]]) -> None:
    for level, (prov, model) in routing.items():
        key = f"ROUTING_{level.upper()}"
        val = os.getenv(key)
        if val and ":" in val:
            prov, model = val.split(":", 1)
        elif val:
            prov = val
            model = ""
        routing[level] = (prov, model)


class RoutingNotFound(LookupError):
    pass


class LLMRouter:
    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self._initialized = False
        self._routing: dict[ClassifyLevel, tuple[str, str]] = dict(_DEFAULT_ROUTING)
        _load_routing_from_env(self._routing)

    def _ensure_init(self):
        if self._initialized:
            return
        self._initialized = True
        self._init_providers()

    def resolve_for_complexity(self, level: ClassifyLevel) -> tuple[str, str]:
        entry = self._routing.get(level)
        if entry is None:
            raise RoutingNotFound(f"No routing entry for complexity level {level!r}")
        return entry

    def set_routing(self, level: ClassifyLevel, provider_name: str, model: str = "") -> None:
        self._routing[level] = (provider_name, model)

    def get_routing_table(self) -> dict[str, dict[str, str]]:
        return {
            level: {"provider": prov, "model": mdl}
            for level, (prov, mdl) in self._routing.items()
        }

    def _init_providers(self):
        from vibeserve.providers.openai import OpenAIProvider
        from vibeserve.providers.deepseek import DeepSeekProvider
        from vibeserve.providers.openai import OpenRouterProvider
        from vibeserve.providers.gemini import GeminiProvider
        from vibeserve.providers.ollama import OllamaCloudProvider
        from vibeserve.providers.local import LocalProvider
        from vibeserve.providers.opencode import OpenCodeProvider
        from vibeserve.providers.big_homie import BigHomieProvider
        from vibeserve.providers.utils import MockProvider

        if os.getenv("BIG_HOMIE_URL"):
            self.providers["big-homie"] = BigHomieProvider()
            log.info("LLMRouter: Big Homie provider registered (delegates to llm_gateway)")
        if os.getenv("OPENAI_API_KEY"):
            self.providers["openai"] = OpenAIProvider()
            log.info("LLMRouter: OpenAI provider registered")
        if os.getenv("DEEPSEEK_API_KEY"):
            self.providers["deepseek"] = DeepSeekProvider()
            log.info("LLMRouter: DeepSeek provider registered")
        if os.getenv("OPENROUTER_API_KEY"):
            self.providers["openrouter"] = OpenRouterProvider()
            log.info("LLMRouter: OpenRouter provider registered")
        if os.getenv("GOOGLE_API_KEY"):
            self.providers["gemini"] = GeminiProvider()
            log.info("LLMRouter: Gemini provider registered")
        if os.getenv("OLLAMA_API_KEY"):
            self.providers["ollama"] = OllamaCloudProvider()
            log.info("LLMRouter: OllamaCloud provider registered")
        self.providers["local"] = LocalProvider()
        log.info(f"LLMRouter: Local provider registered ({self.providers['local'].model})")
        if shutil.which("opencode"):
            self.providers["opencode"] = OpenCodeProvider()
            log.info("LLMRouter: OpenCode CLI provider registered")
        else:
            log.info("LLMRouter: OpenCode CLI not found -- provider disabled")
        self.providers["mock"] = MockProvider()
        log.info("LLMRouter: Mock provider registered (always-available fallback for testing)")

    @property
    def default_name(self) -> str:
        explicit = os.getenv("DEFAULT_LLM_PROVIDER")
        if explicit and explicit in self.providers:
            return explicit
        for name in ("big-homie", "gemini", "openai", "deepseek", "openrouter", "ollama", "local", "opencode"):
            if name in self.providers:
                return name
        return "mock"

    def get(self, name: Optional[str] = None, allow_fallback: bool = True) -> LLMProvider:
        self._ensure_init()
        if name and name in self.providers:
            return self.providers[name]
        if name and not allow_fallback:
            raise ValueError(
                f"Provider '{name}' not configured. "
                f"Set the required API key or pass allow_fallback=True."
            )
        default = self.default_name
        if default in self.providers:
            return self.providers[default]
        if self.providers:
            fallback = list(self.providers.values())[0]
            if not allow_fallback and getattr(fallback, 'name', '') in ('Local',):
                raise ValueError(
                    f"Provider '{name or default}' not configured and fallback to Local is not allowed. "
                    f"Set a provider API key or pass allow_fallback=True."
                )
            log.warning(
                f"[LLMRouter] Requested provider '{name or default}' not available, "
                f"falling back to {fallback.name}"
            )
            return fallback
        raise RuntimeError("No LLM providers configured. Set an API key or install a local model.")

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json",
                   provider: Optional[str] = None) -> Optional[str]:
        primary = self.get(provider)
        result = await primary.call(prompt, temperature, response_format)
        if result:
            return result
        log.warning(f"[LLMRouter] {primary.name} failed, trying fallback providers...")
        for name, prov in self.providers.items():
            if prov is primary:
                continue
            if os.getenv("PYTEST_CURRENT_TEST"):
                from unittest.mock import AsyncMock, MagicMock
                is_mocked = (
                    isinstance(prov.call, (AsyncMock, MagicMock)) or
                    isinstance(getattr(prov, "_api_call", None), (AsyncMock, MagicMock)) or
                    "Mock" in type(prov).__name__
                )
                if not is_mocked:
                    log.info(f"[LLMRouter] Skipping unmocked fallback provider during tests: {prov.name}")
                    continue
            log.info(f"[LLMRouter] Trying fallback: {prov.name}...")
            result = await prov.call(prompt, temperature, response_format)
            if result:
                return result
        log.error(f"[LLMRouter] All {len(self.providers)} providers failed.")
        return None


router = LLMRouter()
sampling_instance = SamplingProvider()


async def mcp_llm_call(prompt: str, temperature: float = 0.7,
                       response_format: str = "json",
                       ctx: Any = None) -> Optional[str]:
    if ctx:
        sampling_instance.bind(ctx)
        result = await sampling_instance.call(prompt, temperature, response_format)
        if result:
            return result
    return await router.call(prompt, temperature, response_format)

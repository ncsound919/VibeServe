"""VibeServe providers — re-exports for backwards compatibility."""
from vibeserve.providers.base import LLMProvider, _get_client
from vibeserve.providers.openai import OpenAIProvider, OpenRouterProvider
from vibeserve.providers.deepseek import DeepSeekProvider
from vibeserve.providers.gemini import GeminiProvider
from vibeserve.providers.ollama import OllamaCloudProvider
from vibeserve.providers.local import LocalProvider
from vibeserve.providers.opencode import OpenCodeProvider, _resolve_opencode_command
from vibeserve.providers.big_homie import BigHomieProvider
from vibeserve.providers.utils import SamplingProvider, MockProvider, is_mock, create_provider
from vibeserve.providers.router import (
    LLMRouter, RoutingNotFound, router, sampling_instance, mcp_llm_call,
)

__all__ = [
    "LLMProvider", "LLMRouter", "OpenAIProvider", "DeepSeekProvider",
    "OpenRouterProvider", "LocalProvider", "OpenCodeProvider",
    "GeminiProvider", "OllamaCloudProvider", "BigHomieProvider",
    "SamplingProvider", "MockProvider",
    "RoutingNotFound",
    "router", "sampling_instance", "mcp_llm_call",
    "_get_client", "_resolve_opencode_command", "is_mock", "create_provider",
]

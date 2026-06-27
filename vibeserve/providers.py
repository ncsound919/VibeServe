"""VibeServe providers — backward-compat re-export.
All classes now live in vibeserve/providers/* sub-modules.
This file is kept for backward compatibility.
"""
from vibeserve.providers.base import LLMProvider, _get_client
from vibeserve.providers.openai import OpenAIProvider, OpenRouterProvider
from vibeserve.providers.deepseek import DeepSeekProvider
from vibeserve.providers.gemini import GeminiProvider
from vibeserve.providers.ollama import OllamaCloudProvider
from vibeserve.providers.local import LocalProvider
from vibeserve.providers.opencode import OpenCodeProvider, _resolve_opencode_command
from vibeserve.providers.utils import SamplingProvider, MockProvider, is_mock, create_provider
from vibeserve.providers.router import (
    LLMRouter, RoutingNotFound, router, sampling_instance, mcp_llm_call,
)

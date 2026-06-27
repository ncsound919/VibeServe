"""Tests for vibeserve.providers — LLMRouter, providers, and fallback mechanism."""

import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from vibeserve.providers import (
    LLMRouter,
    OpenAIProvider,
    DeepSeekProvider,
    OpenRouterProvider,
    LocalProvider,
    BigHomieProvider,
    LLMProvider,
)


class TestBigHomieProvider:
    def test_big_homie_provider_init(self):
        with patch.dict(os.environ, {
            "BIG_HOMIE_URL": "http://localhost:8888",
            "BIG_HOMIE_MODEL": "claude-sonnet-4-20250514",
            "BIG_HOMIE_LLM_PROVIDER": "anthropic",
        }, clear=True):
            provider = BigHomieProvider()
            assert provider.name == "big-homie"
            assert provider.model == "claude-sonnet-4-20250514"

    def test_big_homie_provider_init_no_env(self):
        with patch.dict(os.environ, {}, clear=True):
            provider = BigHomieProvider()
            assert provider.name == "big-homie"
            assert provider.model == "big-homie-gateway"

    @pytest.mark.asyncio
    async def test_big_homie_provider_call_success(self):
        with patch.dict(os.environ, {
            "BIG_HOMIE_URL": "http://localhost:8888",
        }, clear=True):
            provider = BigHomieProvider()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"status": "success", "content": '{"result": "ok"}'}
            mock_resp.raise_for_status = MagicMock()
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            provider._client = mock_client

            result = await provider.call("test prompt")
            assert result == '{"result": "ok"}'
            mock_client.post.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_big_homie_provider_gateway_error(self):
        with patch.dict(os.environ, {
            "BIG_HOMIE_URL": "http://localhost:8888",
        }, clear=True):
            provider = BigHomieProvider()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"status": "error", "message": "LLM gateway down"}
            mock_resp.raise_for_status = MagicMock()
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_resp
            provider._client = mock_client

            result = await provider.call("test prompt")
            assert result is None


class TestLLMRouterBigHomieIntegration:
    def test_router_registers_big_homie_when_url_set(self):
        with patch.dict(os.environ, {
            "BIG_HOMIE_URL": "http://localhost:8888",
        }, clear=True):
            router = LLMRouter()
            router._ensure_init()
            assert "big-homie" in router.providers
            assert router.providers["big-homie"].name == "big-homie"

    def test_router_prefers_big_homie_as_default(self):
        with patch.dict(os.environ, {
            "BIG_HOMIE_URL": "http://localhost:8888",
        }, clear=True):
            router = LLMRouter()
            router._ensure_init()
            assert router.default_name == "big-homie"

    def test_router_big_homie_not_registered_without_url(self):
        with patch.dict(os.environ, {}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            assert "big-homie" not in router.providers


class TestLLMRouterInitialization:
    def test_llm_router_initialization_with_env_vars(self):
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "sk-test-openai",
            "DEEPSEEK_API_KEY": "sk-test-deepseek",
        }, clear=True):
            router = LLMRouter()
            router._ensure_init()
            assert "openai" in router.providers
            assert "deepseek" in router.providers
            assert router.providers["openai"].api_key == "sk-test-openai"
            assert router.providers["deepseek"].api_key == "sk-test-deepseek"

    def test_llm_router_no_env_vars(self):
        with patch.dict(os.environ, {}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            assert "openai" not in router.providers
            assert "deepseek" not in router.providers
            assert "local" in router.providers


class TestLLMRouterFallback:
    @pytest.mark.asyncio
    async def test_llm_router_fallback_mechanism(self):
        with patch.dict(os.environ, {
            "OPENAI_API_KEY": "sk-test-openai",
            "DEEPSEEK_API_KEY": "sk-test-deepseek",
        }, clear=True):
            router = LLMRouter()
            router._ensure_init()
            router.providers["openai"].call = AsyncMock(return_value=None)
            router.providers["deepseek"].call = AsyncMock(return_value='{"result": "ok"}')
            result = await router.call("test prompt")
            assert result == '{"result": "ok"}'
            router.providers["openai"].call.assert_awaited_once()
            router.providers["deepseek"].call.assert_awaited_once()


class TestLocalProviderTimeout:
    @pytest.mark.asyncio
    async def test_local_provider_timeout_handling(self):
        with patch.dict(os.environ, {}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            local = router.providers["local"]
            local.call = AsyncMock(return_value=None)
            router.providers["mock"].call = AsyncMock(return_value=None)
            result = await router.call("test prompt", provider="local")
            assert result is None
            local.call.assert_awaited_once()


class TestOpenAIProvider:
    def test_openai_provider_init_with_api_key(self):
        provider = OpenAIProvider(api_key="sk-test-openai")
        assert provider.api_key == "sk-test-openai"
        assert provider.name == "OpenAI"

    @pytest.mark.asyncio
    async def test_openai_provider_call(self):
        provider = OpenAIProvider(api_key="sk-test-openai")
        with patch.object(provider, '_api_call', new=AsyncMock(return_value='{"response": "ok"}')):
            result = await provider.call("test prompt")
            assert result == '{"response": "ok"}'
            provider._api_call.assert_awaited_once_with(
                provider.base_url, provider.api_key, provider.model,
                "test prompt", 0.7, "json"
            )


class TestDeepSeekProvider:
    def test_deepseek_provider_init(self):
        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "sk-test-deepseek"}, clear=True):
            provider = DeepSeekProvider()
            assert provider.api_key == "sk-test-deepseek"
            assert provider.name == "DeepSeek"

    @pytest.mark.asyncio
    async def test_deepseek_provider_call(self):
        provider = DeepSeekProvider(api_key="sk-test-deepseek")
        with patch.object(provider, '_api_call', new=AsyncMock(return_value='{"response": "ok"}')):
            result = await provider.call("test prompt")
            assert result == '{"response": "ok"}'
            provider._api_call.assert_awaited_once()


class TestOpenRouterProvider:
    def test_openrouter_provider_init(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-openrouter"}, clear=True):
            provider = OpenRouterProvider()
            assert provider.api_key == "sk-test-openrouter"
            assert provider.name == "OpenRouter"

    @pytest.mark.asyncio
    async def test_openrouter_provider_call(self):
        provider = OpenRouterProvider(api_key="sk-test-openrouter")
        with patch.object(provider, '_api_call', new=AsyncMock(return_value='{"response": "ok"}')):
            result = await provider.call("test prompt")
            assert result == '{"response": "ok"}'
            provider._api_call.assert_awaited_once()


class TestLocalProvider:
    def test_local_provider_init(self):
        with patch.dict(os.environ, {}, clear=True):
            provider = LocalProvider()
            assert provider.base_url == "http://localhost:11434/v1"
            assert provider.model == "llama3.2"
            assert provider.name == "Local"
            assert provider.api_key == "not-needed"

    @pytest.mark.asyncio
    async def test_local_provider_call(self):
        provider = LocalProvider()
        with patch.object(provider, '_api_call', new=AsyncMock(return_value='{"response": "ok"}')):
            result = await provider.call("test prompt")
            assert result == '{"response": "ok"}'
            provider._api_call.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_local_provider_call_failure(self):
        provider = LocalProvider()
        with patch.object(provider, '_api_call', new=AsyncMock(return_value=None)):
            result = await provider.call("test prompt")
            assert result is None
            provider._api_call.assert_awaited_once()


class TestLLMRouterEdgeCases:
    def test_llm_router_provider_selection(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-openai"}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            provider = router.get("openai")
            assert provider.name == "OpenAI"

    @pytest.mark.asyncio
    async def test_llm_router_all_providers_fail(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-openai"}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            for prov in router.providers.values():
                prov.call = AsyncMock(return_value=None)
            result = await router.call("test prompt")
            assert result is None
            for prov in router.providers.values():
                prov.call.assert_awaited()

    def test_llm_router_unavailable_provider(self):
        with patch.dict(os.environ, {}, clear=True):
            router = LLMRouter()
            router._ensure_init()
            provider = router.get("nonexistent")
            assert provider.name == "Local"


class TestLLMProviderBase:
    def test_llm_provider_abstract_methods(self):
        with pytest.raises(TypeError):
            class IncompleteProvider(LLMProvider):
                pass
            IncompleteProvider()

    def test_llm_provider_model_name_property(self):
        provider = OpenAIProvider(api_key="sk-test-openai")
        assert provider.name == "OpenAI"

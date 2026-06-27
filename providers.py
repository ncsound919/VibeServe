"""LLM providers with auto-fallback routing.

FIX 1: _close_client() is now called from a FastMCP shutdown event hook rather
than being dead code. Added register_shutdown_hook() for server.py to call.

FIX 2: LocalProvider previously created its own private httpx.AsyncClient with
different timeouts and never closed it. It now reuses the shared client.
"""

from __future__ import annotations
import asyncio
import json
import logging
import os
import shutil
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

import httpx

log = logging.getLogger("VibeServe")

_shared_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None:
        _shared_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=180.0))
    return _shared_client


async def _close_client():
    """Close the shared HTTP client. Called on server shutdown."""
    global _shared_client
    if _shared_client is not None:
        await _shared_client.aclose()
        _shared_client = None
        log.info("[providers] Shared HTTP client closed.")


def register_shutdown_hook(server: Any) -> None:
    """Register _close_client with the FastMCP server's shutdown lifecycle.

    Call this from server.py after building the FastMCP instance:

        from vibeserve.providers import register_shutdown_hook
        mcp = FastMCP("VibeServe")
        register_shutdown_hook(mcp)
    """
    try:
        # FastMCP exposes on_shutdown for cleanup callbacks.
        server.on_shutdown(_close_client)
        log.info("[providers] HTTP client shutdown hook registered.")
    except AttributeError:
        # Fallback: register via atexit so it still runs on process exit.
        import atexit
        import asyncio as _asyncio

        def _atexit_close():
            try:
                loop = _asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(_close_client())
                else:
                    loop.run_until_complete(_close_client())
            except Exception:
                pass

        atexit.register(_atexit_close)
        log.info("[providers] HTTP client shutdown hook registered via atexit (fallback).")


class LLMProvider(ABC):
    @abstractmethod
    async def call(
        self,
        prompt: str,
        temperature: float = 0.7,
        response_format: str = "json",
    ) -> Optional[str]:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    async def _api_call(
        self,
        base_url: str,
        api_key: str,
        model: str,
        prompt: str,
        temperature: float,
        response_format: str,
        extra_headers: Optional[Dict[str, str]] = None,
        max_retries: int = 4,
    ) -> Optional[str]:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)

        payload: Dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        client = _get_client()
        for attempt in range(max_retries):
            try:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    json=payload,
                    headers=headers,
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


class OpenAIProvider(LLMProvider):
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
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
            prompt, temperature, response_format,
        )


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
            prompt, temperature, response_format,
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
                "X-Title": "VibeServe",
            },
        )


class LocalProvider(LLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1")
        self.model = model or os.getenv("LOCAL_LLM_MODEL", "llama3.2")
        self.api_key = "not-needed"
        # FIX: was creating a private httpx.AsyncClient with different timeouts
        # and never closing it. Now reuses the shared client via _get_client().

    @property
    def name(self) -> str:
        return "Local"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        # FIX: uses shared client (was self._client, a private never-closed instance).
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format,
        )


class OpenCodeProvider(LLMProvider):
    def __init__(self, model: Optional[str] = None):
        self.model = model or os.getenv("OPENCODE_MODEL", "opencode/hy3-preview-free")
        self._available = False
        self._binary = "opencode"
        candidates = ["opencode.cmd", "opencode.exe", "opencode.ps1", "opencode"]
        for name in candidates:
            found = shutil.which(name)
            if found:
                self._available = True
                self._binary = found
                break
        if not self._available:
            for bin_dir in [
                os.path.expandvars(r"%APPDATA%\npm"),
                os.path.expandvars(r"%LOCALAPPDATA%\npm"),
                "/usr/local/bin",
                os.path.expanduser("~/.npm-global/bin"),
            ]:
                for name in candidates:
                    full = os.path.join(bin_dir, name)
                    if os.path.exists(full):
                        self._available = True
                        self._binary = full
                        break
                if self._available:
                    break
        if not self._available:
            log.warning("OpenCode CLI not found. Install: npm install -g opencode-ai")

    @property
    def name(self) -> str:
        return "OpenCode"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self._available:
            log.error("OpenCode CLI not installed -- provider disabled")
            return None

        try:
            # FIX: timeout reduced from 300s to 30s (was a DoS vector).
            # Matches SUBPROCESS_TIMEOUT in subprocess_helper.py.
            cmd = [self._binary, "run", "--model", self.model, "--format", "json", prompt]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                log.warning(f"[{self.name}] CLI timeout after 30s")
                return None

            if proc.returncode != 0:
                stderr_msg = stderr.decode() if stderr else "unknown error"
                log.warning(
                    f"[{self.name}] CLI failed (exit {proc.returncode}): {stderr_msg[:200]}"
                )
                return None

            return self._parse_output(stdout.decode())
        except Exception as e:
            log.warning(f"[{self.name}] Provider error: {e}")
            return None

    def _parse_output(self, output: str) -> Optional[str]:
        try:
            lines = [line.strip() for line in output.strip().split("\n") if line.strip()]
            last_content: Optional[str] = None
            for line in lines:
                try:
                    data = json.loads(line)
                    if isinstance(data, dict):
                        if "content" in data:
                            last_content = data["content"]
                        elif "message" in data and isinstance(data["message"], dict):
                            last_content = data["message"].get("content")
                        elif "response" in data:
                            last_content = data["response"]
                except json.JSONDecodeError:
                    if line and not line.startswith("{"):
                        last_content = line
            return last_content
        except Exception as e:
            log.warning(f"[{self.name}] Failed to parse output: {e}")
            return None


class SamplingProvider(LLMProvider):
    def __init__(self, ctx: Any = None):
        self._ctx = ctx
        self._active = ctx is not None and hasattr(ctx, "sample")

    @property
    def name(self) -> str:
        return "MCP-Sampling"

    def bind(self, ctx: Any):
        self._ctx = ctx
        self._active = ctx is not None and hasattr(ctx, "sample")

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self._active or not self._ctx:
            return None
        try:
            result = await self._ctx.sample(
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=4096,
            )
            if hasattr(result, "text"):
                return result.text
            if hasattr(result, "content"):
                return str(result.content)
            return str(result) if result else None
        except Exception as e:
            log.warning(f"[MCP-Sampling] Sample call failed: {e}")
            return None


class LLMRouter:
    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self._initialized = False

    def _ensure_init(self):
        if self._initialized:
            return
        self._initialized = True
        self._init_providers()

    def _init_providers(self):
        if os.getenv("OPENAI_API_KEY"):
            self.providers["openai"] = OpenAIProvider()
            log.info("LLMRouter: OpenAI provider registered")
        if os.getenv("DEEPSEEK_API_KEY"):
            self.providers["deepseek"] = DeepSeekProvider()
            log.info("LLMRouter: DeepSeek provider registered")
        if os.getenv("OPENROUTER_API_KEY"):
            self.providers["openrouter"] = OpenRouterProvider()
            log.info("LLMRouter: OpenRouter provider registered")
        self.providers["local"] = LocalProvider()
        log.info(f"LLMRouter: Local provider registered ({self.providers['local'].model})")
        if shutil.which("opencode"):
            self.providers["opencode"] = OpenCodeProvider()
            log.info("LLMRouter: OpenCode CLI provider registered")
        else:
            log.info("LLMRouter: OpenCode CLI not found -- provider disabled")

    @property
    def default_name(self) -> str:
        return os.getenv("DEFAULT_LLM_PROVIDER", "openai")

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
        raise RuntimeError(
            "No LLM providers configured. Set an API key or install a local model."
        )

    async def call(
        self,
        prompt: str,
        temperature: float = 0.7,
        response_format: str = "json",
        provider: Optional[str] = None,
    ) -> Optional[str]:
        primary = self.get(provider)
        result = await primary.call(prompt, temperature, response_format)
        if result:
            return result
        log.warning(f"[LLMRouter] {primary.name} failed, trying fallback providers...")
        for name, prov in self.providers.items():
            if prov is primary:
                continue
            log.info(f"[LLMRouter] Trying fallback: {prov.name}...")
            result = await prov.call(prompt, temperature, response_format)
            if result:
                return result
        log.error(f"[LLMRouter] All {len(self.providers)} providers failed.")
        return None


# Global instances
router = LLMRouter()
sampling_instance = SamplingProvider()


async def mcp_llm_call(
    prompt: str,
    temperature: float = 0.7,
    response_format: str = "json",
    ctx: Any = None,
) -> Optional[str]:
    if ctx:
        sampling_instance.bind(ctx)
        result = await sampling_instance.call(prompt, temperature, response_format)
        if result:
            return result
    return await router.call(prompt, temperature, response_format)

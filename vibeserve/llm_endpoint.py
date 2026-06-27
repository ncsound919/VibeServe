"""LLM completion HTTP endpoint — exposes mcp_llm_call over HTTP for RepoRank/Mutly.

POST /v1/llm/complete
  body: {"prompt": "...", "temperature": 0.3, "response_format": "json", "provider": "gemini"}
  returns: {"status": "success", "content": "...", "provider": "Gemini", "model": "...", "usage": {...}, "latencyMs": 123}

GET /v1/llm/health
  returns: {"status": "ok", "providers": ["gemini", "openai"], "default": "gemini"}

Cost tracking: per-request token counts accumulated in COST_LOG (in-memory) and
persisted to a small JSON file so the benchmark can read it.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from vibeserve.task_classifier import classify_task
from vibeserve.budget import budget as _budget, COST_PER_TOKEN

log = logging.getLogger("VibeServe.llm")

# ── Cost tracking ─────────────────────────────────────────────────────────────
COST_LOG: list[Dict[str, Any]] = []
_COST_LOCK = threading.Lock()
_COST_PERSIST_PATH = Path(os.getenv("VIBESERVE_COST_LOG", "/tmp/vibeserve_cost.json"))


def _record_usage(provider: str, model: str, prompt_tokens: int, completion_tokens: int, latency_ms: float) -> None:
    """Append a usage record. Best-effort persistence; never raises."""
    record = {
        "ts": time.time(),
        "provider": provider,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "latency_ms": round(latency_ms, 1),
    }
    with _COST_LOCK:
        COST_LOG.append(record)
        # Keep memory bounded
        if len(COST_LOG) > 10_000:
            del COST_LOG[: len(COST_LOG) - 10_000]
        # Best-effort flush
        try:
            _COST_PERSIST_PATH.parent.mkdir(parents=True, exist_ok=True)
            _COST_PERSIST_PATH.write_text(json.dumps(COST_LOG[-1000:]), encoding="utf-8")
        except OSError:
            pass


def get_cost_summary() -> Dict[str, Any]:
    """Return aggregated cost summary. Safe to call from HTTP handlers."""
    with _COST_LOCK:
        total = len(COST_LOG)
        by_provider: Dict[str, Dict[str, int]] = {}
        total_prompt = 0
        total_completion = 0
        for r in COST_LOG:
            p = r["provider"]
            slot = by_provider.setdefault(p, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0})
            slot["calls"] += 1
            slot["prompt_tokens"] += r["prompt_tokens"]
            slot["completion_tokens"] += r["completion_tokens"]
            total_prompt += r["prompt_tokens"]
            total_completion += r["completion_tokens"]
        return {
            "total_calls": total,
            "total_prompt_tokens": total_prompt,
            "total_completion_tokens": total_completion,
            "by_provider": by_provider,
        }


# ── Token estimation ──────────────────────────────────────────────────────────
def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token. Sufficient for cost telemetry."""
    return max(1, len(text) // 4)


# ── Rate limiting (per-process, simple) ──────────────────────────────────────
class _RateLimiter:
    """Sliding window per (provider) limiter. Default 60 calls/min."""

    def __init__(self, max_per_minute: int = 60) -> None:
        self.max = max_per_minute
        self._calls: Dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            history = [t for t in self._calls.get(key, []) if now - t < 60.0]
            if len(history) >= self.max:
                self._calls[key] = history
                return False
            history.append(now)
            self._calls[key] = history
            return True


_RATE_LIMITER = _RateLimiter(max_per_minute=int(os.getenv("VIBESERVE_LLM_RPM", "60")))


# ── Core handler ──────────────────────────────────────────────────────────────
async def handle_llm_complete(headers: Dict[str, str], body: bytes) -> Dict[str, Any]:
    """Process a POST /v1/llm/complete request body. Always returns a dict.

    Expected body JSON keys: prompt (str, required), temperature (float, default 0.3),
    response_format ("json"|"text", default "json"), provider (str, optional),
    model (str, optional), max_tokens (int, optional).
    """
    try:
        data = json.loads(body.decode() or "{}") if body else {}
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON body: {e}"}

    prompt = data.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return {"status": "error", "error": "Missing or empty 'prompt'"}

    # ── Cross-session context bridge (Phase 4.2) ──────────────────────
    # Look up similar past contexts to surface them in the response.
    # Caller can use this to inject hints into the next request.
    from vibeserve.memory import memory as _memory
    related_contexts = await _memory.find_similar_context(prompt, limit=3)
    related_corrections = await _memory.find_corrections(prompt, limit=3)

    temperature = float(data.get("temperature", 0.3))
    response_format = data.get("response_format", "text")
    if response_format not in ("json", "text"):
        return {"status": "error", "error": "response_format must be 'json' or 'text'"}

    provider_name = data.get("provider") or ""
    model = data.get("model") or ""
    auto_route = data.get("auto_route", True) if not data.get("provider") else False

    # ── Auto-route by complexity when no explicit provider ──────────────
    # This is the "smart" part: if the caller didn't pin a provider, we
    # pick the best one based on the task complexity.
    complexity = classify_task(prompt)

    if auto_route and not provider_name:
        from vibeserve import providers as _providers
        try:
            provider_name, model = _providers.router.resolve_for_complexity(complexity)
        except LookupError:
            # Fall back to the env default if no routing entry exists
            provider_name = os.getenv("DEFAULT_LLM_PROVIDER", "deepseek")

    if not provider_name:
        provider_name = os.getenv("DEFAULT_LLM_PROVIDER", "deepseek")

    # Rate limit
    if not _RATE_LIMITER.check(provider_name):
        return {
            "status": "error",
            "error": f"Rate limit exceeded for provider '{provider_name}'",
            "retry_after_seconds": 60,
        }

    # ── Budget check ──────────────────────────────────────────────────────
    if await _budget.is_exceeded():
        budget_status = await _budget.get_status()
        return {
            "status": "error",
            "error": "Budget exceeded — no further LLM calls allowed until budget is reset or increased",
            "budget": budget_status,
        }

    # Import lazily so the module is importable even if providers are not configured
    from vibeserve import providers

    try:
        prov = providers.router.get(provider_name)
    except RuntimeError as e:
        return {"status": "error", "error": str(e)}

    if model:
        prov.model = model

    start = time.perf_counter()
    try:
        content = await asyncio.wait_for(prov.call(prompt, temperature=temperature, response_format=response_format), timeout=30.0)
    except asyncio.TimeoutError:
        return {
            "status": "error",
            "error": "LLM provider timed out",
            "provider": prov.name,
            "model": getattr(prov, "model", "unknown"),
        }
    except Exception as e:
        log.exception("LLM call failed")
        return {"status": "error", "error": f"LLM call failed: {e}"}
    latency_ms = (time.perf_counter() - start) * 1000.0

    if content is None:
        return {
            "status": "error",
            "error": f"Provider '{prov.name}' returned no content",
            "provider": prov.name,
            "model": getattr(prov, "model", "unknown"),
            "latency_ms": round(latency_ms, 1),
            "complexity": complexity,
            "auto_route": auto_route,
            "routing_provider": provider_name,
            "routing_model": model,
        }

    prompt_tokens = _estimate_tokens(prompt)
    completion_tokens = _estimate_tokens(content)

    # ── Cost estimation (rough: ~$0.15/Mtokens for DeepSeek, adjust per provider) ──
    total_tok = prompt_tokens + completion_tokens
    estimated_cost_usd = total_tok * COST_PER_TOKEN

    _record_usage(prov.name, getattr(prov, "model", "unknown"), prompt_tokens, completion_tokens, latency_ms)
    await _budget.record(prompt_tokens, completion_tokens, estimated_cost_usd)

    return {
        "status": "success",
        "content": content,
        "provider": prov.name,
        "model": getattr(prov, "model", "unknown"),
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tok,
        },
        "latency_ms": round(latency_ms, 1),
        "response_format": response_format,
        "complexity": complexity,
        "auto_route": auto_route,
        "routing_provider": provider_name,
        "routing_model": model or getattr(prov, "model", ""),
        "budget": await _budget.get_status(),
        "related_contexts": related_contexts,
        "related_corrections": related_corrections,
    }


async def handle_llm_health() -> Dict[str, Any]:
    """Return provider health snapshot."""
    from vibeserve import providers

    providers.router._ensure_init()
    available = list(providers.router.providers.keys())
    default = providers.router.default_name
    default_ok = default in available
    return {
        "status": "ok" if default_ok else "degraded",
        "providers": available,
        "default": default,
        "default_ready": default_ok,
        "cost": get_cost_summary(),
        "classifier_available": True,
        "routing_table": providers.router.get_routing_table(),
        "budget": await _budget.get_status(),
    }


async def handle_llm_budget(body_bytes: bytes) -> Dict[str, Any]:
    """Handle POST /v1/llm/budget — configure or reset the budget tracker.

    Body keys:
        max_tokens (int, optional) — new token cap (0 = unlimited)
        max_cost_cents (float, optional) — new cost cap (0 = unlimited)
        reset (bool, optional) — if true, zero accumulated usage
    """
    from vibeserve.budget import budget as _budget

    try:
        data = json.loads(body_bytes.decode() or "{}") if body_bytes else {}
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"Invalid JSON: {e}"}

    max_tokens = data.get("max_tokens")
    max_cost_cents = data.get("max_cost_cents")
    if max_tokens is not None or max_cost_cents is not None:
        await _budget.configure(
            max_tokens=int(max_tokens) if max_tokens is not None else None,
            max_cost_cents=float(max_cost_cents) if max_cost_cents is not None else None,
        )

    if data.get("reset"):
        await _budget.reset()

    return {"status": "success", "budget": await _budget.get_status(), "projections": await _budget.get_projections()}


async def handle_llm_budget_get() -> Dict[str, Any]:
    """Handle GET /v1/llm/budget — return status + projections.

    Returns:
        {
            "budget": {...status fields...},
            "projections": {
                "burn_rate_tokens_per_minute": float,
                "burn_rate_cost_cents_per_minute": float,
                "projected_exhaustion_seconds": float | None,
                "suggested_actions": [str, ...]
            }
        }
    """
    from vibeserve.budget import budget as _budget

    return {"status": "success", "budget": await _budget.get_status(), "projections": await _budget.get_projections()}

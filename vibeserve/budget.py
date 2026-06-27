"""Per-session budget tracking and enforcement for LLM calls.

Supports token-based budgets (``VIBESERVE_BUDGET_MAX_TOKENS``) and
cost-based budgets (``VIBESERVE_BUDGET_MAX_COST``, in USD cents).

Budget state is in-memory; a future version may persist to a file/DB
for cross-session enforcement.
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Dict, List, Optional


class BudgetTracker:
    """Thread-safe budget tracker with optional max-token and max-cost caps.

    Usage::

        bt = BudgetTracker()          # reads env vars on init
        bt.record(prompt_tokens=150, completion_tokens=50, estimated_cost_usd=0.002)
        if bt.exceeded:
            log.warning("Budget exceeded — rejecting request")
        bt.status  # → {"total_prompt_tokens": ..., "remaining_tokens": ...}
        bt.projections  # → burn-rate + projected exhaustion
    """

    def __init__(
        self,
        max_tokens: Optional[int] = None,
        max_cost_cents: Optional[float] = None,
    ):
        self._lock = asyncio.Lock()
        # Env-var defaults
        self.max_tokens: int = max_tokens if max_tokens is not None else int(
            os.getenv("VIBESERVE_BUDGET_MAX_TOKENS", "0") or "0"
        )
        self.max_cost_cents: float = max_cost_cents if max_cost_cents is not None else float(
            os.getenv("VIBESERVE_BUDGET_MAX_COST", "0") or "0"
        )
        # Accumulated
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_cost_cents = 0.0
        self._requests = 0
        # Time-series of (ts, tokens_added) so we can compute burn rate
        self._history: List[tuple[float, int]] = []
        self._started_at = time.time()

    # ── Public API ──────────────────────────────────────────────────────────

    async def record(self, prompt_tokens: int, completion_tokens: int, estimated_cost_usd: float = 0.0) -> None:
        """Record a single LLM call's token/cost usage."""
        async with self._lock:
            self.total_prompt_tokens += prompt_tokens
            self.total_completion_tokens += completion_tokens
            self.total_cost_cents += estimated_cost_usd * 100.0
            self._requests += 1
            self._history.append((time.time(), prompt_tokens + completion_tokens))
            # Keep history bounded
            if len(self._history) > 1000:
                self._history = self._history[-1000:]

    async def is_exceeded(self) -> bool:
        """True if any configured budget cap has been hit."""
        if self.max_tokens > 0 and self.total_tokens >= self.max_tokens:
            return True
        if self.max_cost_cents > 0 and self.total_cost_cents >= self.max_cost_cents:
            return True
        return False

    @property
    def total_tokens(self) -> int:
        return self.total_prompt_tokens + self.total_completion_tokens

    async def get_status(self) -> Dict[str, Any]:
        """JSON-safe snapshot for API responses."""
        async with self._lock:
            remaining_tokens = max(0, self.max_tokens - self.total_tokens) if self.max_tokens > 0 else -1
            remaining_cost = max(0.0, self.max_cost_cents - self.total_cost_cents) if self.max_cost_cents > 0 else -1.0
            return {
                "total_requests": self._requests,
                "total_prompt_tokens": self.total_prompt_tokens,
                "total_completion_tokens": self.total_completion_tokens,
                "total_tokens": self.total_tokens,
                "total_cost_cents": round(self.total_cost_cents, 4),
                "max_tokens": self.max_tokens,
                "max_cost_cents": self.max_cost_cents,
                "remaining_tokens": remaining_tokens,
                "remaining_cost_cents": round(remaining_cost, 4),
                "exceeded": await self.is_exceeded(),
                "elapsed_seconds": round(time.time() - self._started_at, 1),
            }

    async def get_projections(self) -> Dict[str, Any]:
        """Project future usage based on observed burn rate.

        Returns::
            {
                "burn_rate_tokens_per_minute": float,
                "burn_rate_cost_cents_per_minute": float,
                "projected_exhaustion_seconds": float | None,
                "suggested_actions": [str, ...],
            }
        """
        async with self._lock:
            now = time.time()
            window_s = 60.0
            recent = [(t, n) for (t, n) in self._history if now - t < window_s]
            if not recent:
                burn_rate_tpm = 0.0
                burn_rate_cpm = 0.0
            else:
                tokens_recent = sum(n for _, n in recent)
                elapsed = max(1.0, now - recent[0][0])
                burn_rate_tpm = tokens_recent * 60.0 / elapsed
                # Cost rate scales with token rate using the same $0.15/Mtok assumption
                burn_rate_cpm = burn_rate_tpm * COST_PER_TOKEN * 100 * 60  # cents per minute

            actions: List[str] = []
            projected_seconds: Optional[float] = None
            if self.max_tokens > 0 and burn_rate_tpm > 0:
                remaining = max(0, self.max_tokens - self.total_tokens)
                projected_seconds = remaining / (burn_rate_tpm / 60.0)
                if projected_seconds < 300:
                    actions.append(f"Token budget will exhaust in {int(projected_seconds // 60)}m{int(projected_seconds % 60)}s — increase max_tokens or reduce usage")
            if self.max_cost_cents > 0 and burn_rate_cpm > 0:
                remaining_c = max(0.0, self.max_cost_cents - self.total_cost_cents)
                projected_seconds_cost = remaining_c / (burn_rate_cpm / 60.0) if burn_rate_cpm > 0 else None
                if projected_seconds_cost and projected_seconds_cost < 600:
                    actions.append(f"Cost budget will exhaust in {int(projected_seconds_cost // 60)}m{int(projected_seconds_cost % 60)}s")
            if await self.is_exceeded():
                actions.insert(0, "Budget exceeded — reset via POST /v1/llm/budget to continue")
            if not actions and self._requests > 0:
                actions.append("Within budget — burn rate is sustainable")

            return {
                "burn_rate_tokens_per_minute": round(burn_rate_tpm, 2),
                "burn_rate_cost_cents_per_minute": round(burn_rate_cpm, 6),
                "projected_exhaustion_seconds": round(projected_seconds, 1) if projected_seconds else None,
                "suggested_actions": actions,
            }

    async def configure(self, max_tokens: Optional[int] = None, max_cost_cents: Optional[float] = None) -> None:
        """Update budget caps at runtime (e.g. via API)."""
        async with self._lock:
            if max_tokens is not None:
                self.max_tokens = max_tokens
            if max_cost_cents is not None:
                self.max_cost_cents = max_cost_cents

    async def reset(self) -> None:
        """Zero out accumulated usage (new budget period)."""
        async with self._lock:
            self.total_prompt_tokens = 0
            self.total_completion_tokens = 0
            self.total_cost_cents = 0.0
            self._requests = 0
            self._history = []
            self._started_at = time.time()


# Global singleton
budget = BudgetTracker()

COST_PER_TOKEN = 0.00000015

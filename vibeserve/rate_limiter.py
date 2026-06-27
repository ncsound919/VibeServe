"""Per-identity token bucket rate limiter (in-process, no Redis)."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict


class TokenBucket:
    """Per-identity token bucket rate limiter (in-process, no Redis)."""

    def __init__(self, rate: float = 30.0, burst: int = 10):
        self.rate = rate
        self.burst = burst
        self._tokens: Dict[str, float] = {}
        self._last_check: Dict[str, float] = {}
        self._bucket_lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None

    async def _ensure_cleanup(self):
        """Start the background cleanup task lazily (needs a running event loop)."""
        if self._cleanup_task is not None and not self._cleanup_task.done():
            return
        try:
            self._cleanup_task = asyncio.ensure_future(self._periodic_cleanup())
        except RuntimeError:
            pass

    async def _periodic_cleanup(self):
        """Evict stale entries every 2 minutes."""
        try:
            while True:
                await asyncio.sleep(120)
                async with self._bucket_lock:
                    self._evict_stale()
        except asyncio.CancelledError:
            pass

    async def allow(self, identity: str) -> bool:
        await self._ensure_cleanup()
        async with self._bucket_lock:
            now = time.monotonic()

            last = self._last_check.get(identity, now)
            elapsed = now - last
            tokens = self._tokens.get(identity, self.burst)
            tokens = min(self.burst, tokens + elapsed * self.rate)
            self._last_check[identity] = now
            if tokens >= 1:
                self._tokens[identity] = tokens - 1
                return True
            self._tokens[identity] = tokens
            return False

    def _evict_stale(self):
        """Remove identities not seen in 1 hour."""
        cutoff = time.monotonic() - 3600
        stale = [k for k, v in self._last_check.items() if v < cutoff]
        for k in stale:
            self._tokens.pop(k, None)
            self._last_check.pop(k, None)

    def status(self, identity: str) -> Dict[str, Any]:
        now = time.monotonic()
        last = self._last_check.get(identity, now)
        elapsed = now - last
        tokens = min(self.burst, self._tokens.get(identity, self.burst) + elapsed * self.rate)
        return {"tokens": round(tokens, 2), "burst": self.burst, "rate": self.rate}


rate_limiter = TokenBucket(rate=30.0, burst=10)

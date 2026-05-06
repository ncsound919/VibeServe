"""Cache manager for UI spec generation results."""
from __future__ import annotations
import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from vibeserve.tools.config import CONFIG

log = logging.getLogger("VibeServe")


class CacheManager:
    MAX_CACHE_FILES = 200

    def __init__(self, cache_dir: Path = CONFIG.cache_dir, ttl: int = CONFIG.cache_ttl):
        self.cache_dir = cache_dir
        self.ttl = ttl
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _evict_if_needed(self):
        files = sorted(self.cache_dir.glob("*.json"), key=lambda f: f.stat().st_mtime)
        if len(files) >= self.MAX_CACHE_FILES:
            for f in files[:len(files) - self.MAX_CACHE_FILES + 1]:
                f.unlink(missing_ok=True)
                log.info(f"Evicted stale cache file: {f.name}")

    def get_cache_key(self, page_type: str, requirements: List[str], design_system_id: str) -> str:
        return hashlib.sha256(
            json.dumps({"page_type": page_type, "requirements": sorted(requirements),
                        "design_system": design_system_id[:20]}, sort_keys=True).encode()
        ).hexdigest()[:32]

    def get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        f = self.cache_dir / f"{cache_key}.json"
        if not f.exists():
            return None
        try:
            with open(f) as fh:
                raw = json.load(fh)
            payload = json.dumps(raw["data"])
            if hashlib.sha256(payload.encode()).hexdigest() != raw["checksum"]:
                log.warning(f"[CacheManager] Integrity check failed for {cache_key} — evicting")
                f.unlink()
                return None
            data = raw["data"]
            if time.time() - data.get("timestamp", 0) > self.ttl:
                f.unlink()
                return None
            return data.get("result")
        except Exception as e:
            log.warning(f"[CacheManager] Failed to read cache {cache_key}: {e}")
            return None

    def set(self, cache_key: str, result: Dict[str, Any]) -> bool:
        self._evict_if_needed()
        f = self.cache_dir / f"{cache_key}.json"
        try:
            cache_data = {"timestamp": time.time(), "result": result}
            payload = json.dumps(cache_data)
            with open(f, "w") as fh:
                json.dump({"checksum": hashlib.sha256(payload.encode()).hexdigest(),
                           "data": cache_data}, fh)
            return True
        except Exception as e:
            log.warning(f"[CacheManager] Failed to write cache {cache_key}: {e}")
            return False


cache_manager = CacheManager()

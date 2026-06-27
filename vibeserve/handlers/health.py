"""Health check handler."""
import json
import os
from typing import Dict

from vibeserve.auth import is_auth_enabled


async def handle_health(_headers: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    payload = {
        "status": "ok",
        "service": "vibeserve-mutly-bridge",
        "authRequired": bool(os.getenv("VIBESERVE_MUTLY_API_KEY") or os.getenv("VIBESERVE_API_KEY") or is_auth_enabled()),
    }
    return 200, {"Content-Type": "application/json"}, json.dumps(payload).encode()

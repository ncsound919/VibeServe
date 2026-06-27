"""Memory endpoint handlers."""
import json
import logging
from typing import Dict

from vibeserve.memory_endpoint import handle_memory_get, handle_memory_post

log = logging.getLogger("VibeServe")


async def handle_memory(method: str, path: str, _headers: Dict[str, str],
                        body: bytes, cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    try:
        if method == "GET":
            result = await handle_memory_get(path)
        elif method == "POST":
            result = await handle_memory_post(path, body)
        else:
            return 405, cors, json.dumps({"status": "error", "error": "Method not allowed"}).encode()
        status = 200 if result.get("status") != "error" else 400
    except Exception as e:
        log.exception("Memory endpoint crashed")
        return 500, cors, json.dumps({"status": "error", "error": str(e)}).encode()
    return status, cors, json.dumps(result).encode()

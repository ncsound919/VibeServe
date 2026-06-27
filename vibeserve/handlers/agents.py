"""Agent session HTTP API handler."""
import json
import logging
from typing import Dict

log = logging.getLogger("VibeServe")


async def handle_agents(method: str, path: str, body: bytes,
                        cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    from vibeserve.agent_ws import handle_agents_http, handle_agents_http_post
    if method == "GET":
        result = handle_agents_http(path, body)
    elif method == "POST":
        result = await handle_agents_http_post(path, body)
    else:
        return 405, cors, json.dumps({"status": "error", "error": "Method not allowed"}).encode()
    if result is None:
        return 404, cors, json.dumps({"status": "error", "error": "Not found"}).encode()
    status, resp_headers, resp_body = result
    if not isinstance(resp_body, bytes):
        resp_body = resp_body.encode("utf-8")
    return status, {**cors, **resp_headers}, resp_body

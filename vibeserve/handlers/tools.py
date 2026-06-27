"""Tool invocation handler."""
import json
import logging
from typing import Any, Dict, Optional

from vibeserve.http_bridge import _invoke_tool, _extract_api_key

log = logging.getLogger("VibeServe")


async def handle_tools(path: str, headers: Dict[str, str], body: bytes,
                       cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    tool_name = path.split("/tools/", 1)[-1].strip("/")
    try:
        data = json.loads(body.decode() or "{}") if body else {}
    except json.JSONDecodeError:
        return 400, cors, json.dumps({"status": "error", "error": "Invalid JSON body"}).encode()

    token = _extract_api_key(headers)
    if token:
        data["_auth_token"] = token

    try:
        result = await _invoke_tool(tool_name, data)
        status = 200 if result.get("status") != "error" else 400
        return status, cors, json.dumps(result).encode()
    except TypeError as e:
        return 400, cors, json.dumps({"status": "error", "error": str(e)}).encode()
    except Exception as e:
        log.exception("Tool %s failed", tool_name)
        return 500, cors, json.dumps({"status": "error", "error": str(e)}).encode()

"""LLM stream and complete handlers."""
from __future__ import annotations

import json
import logging
from typing import Dict
from urllib.parse import parse_qs

from vibeserve.auth import is_auth_enabled
from vibeserve.llm_endpoint import handle_llm_budget_get

log = logging.getLogger("VibeServe")


async def handle_llm_complete(headers: Dict[str, str], body: bytes, cors: Dict[str, str],
                              authorize_func, _auth_headers: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    from vibeserve.llm_endpoint import handle_llm_complete as _handle_llm_complete
    auth_err = authorize_func(_auth_headers)
    if auth_err:
        return 401, cors, json.dumps({"status": "error", "error": auth_err}).encode()
    try:
        result = await _handle_llm_complete(headers, body)
    except Exception as e:
        log.exception("LLM endpoint crashed")
        return 500, cors, json.dumps({"status": "error", "error": str(e)}).encode()
    status = 200 if result.get("status") == "success" else 400
    return status, cors, json.dumps(result).encode()


async def handle_llm_stream(headers: Dict[str, str], cors: Dict[str, str]) -> tuple:
    qs = parse_qs(headers.get("x-query-string", ""))
    prompt = (qs.get("prompt") or [""])[0]
    provider = (qs.get("provider") or ["ollama"])[0]
    model = (qs.get("model") or [""])[0]
    temperature = float((qs.get("temperature") or ["0.3"])[0])
    response_format = (qs.get("response_format") or ["text"])[0]
    if not prompt:
        return 400, cors, json.dumps({"status": "error", "error": "Missing 'prompt' query param"}).encode()

    from vibeserve import providers
    try:
        prov = providers.router.get(provider)
        if model:
            prov.model = model
    except RuntimeError as e:
        return 400, cors, json.dumps({"status": "error", "error": str(e)}).encode()

    async def _event_source():
        try:
            async for ev in prov.stream(prompt, temperature=temperature, response_format=response_format):
                payload = json.dumps(ev)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            log.exception("SSE stream error")
            err = json.dumps({"delta": "", "done": True, "error": str(e)})
            yield f"data: {err}\n\n"
            yield "data: [DONE]\n\n"

    sse_headers = {
        **cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return ("STREAM", 200, sse_headers, _event_source)


async def handle_llm_health(cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    from vibeserve.llm_endpoint import handle_llm_health as _handle_llm_health
    return 200, cors, json.dumps(await _handle_llm_health()).encode()

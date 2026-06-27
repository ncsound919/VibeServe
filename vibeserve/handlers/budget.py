"""Budget management handlers."""
import json
import logging
from typing import Dict

log = logging.getLogger("VibeServe")


async def handle_budget_post(body: bytes, cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    from vibeserve.llm_endpoint import handle_llm_budget
    try:
        result = await handle_llm_budget(body)
        status = 200 if result.get("status") == "success" else 400
    except Exception as e:
        log.exception("Budget endpoint crashed")
        return 500, cors, json.dumps({"status": "error", "error": str(e)}).encode()
    return status, cors, json.dumps(result).encode()


async def handle_budget_get(cors: Dict[str, str]) -> tuple[int, Dict[str, str], bytes]:
    from vibeserve.llm_endpoint import handle_llm_budget_get
    try:
        result = await handle_llm_budget_get()
        return 200, cors, json.dumps(result).encode()
    except Exception as e:
        log.exception("Budget GET endpoint crashed")
        return 500, cors, json.dumps({"status": "error", "error": str(e)}).encode()

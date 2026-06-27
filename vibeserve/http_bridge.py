"""HTTP bridge for Mutly daemon — POST /tools/{name}, GET /health."""

from __future__ import annotations

import sys
import asyncio

# CRITICAL: Must be set BEFORE any asyncio imports on Windows
# to enable subprocess transport support
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import json
import logging
import os
from typing import Any, Dict, Optional

from vibeserve.auth import is_auth_enabled, verify_token
from vibeserve.middleware import new_trace_id, set_trace_id
from vibeserve.tools.mutly_integration import MUTLY_HTTP_TOOLS

log = logging.getLogger("VibeServe")

# CORS headers shared by every response. Module-level so the body-too-large
# fast-path in _handle_client can use them without an AttributeError.
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-VibeServe-API-Key, X-Mutly-API-Key",
}


class _BridgeCtx:
    auth_token: Optional[str] = None

    async def info(self, msg: str) -> None:
        log.info(msg)


def _extract_api_key(headers: Dict[str, str]) -> Optional[str]:
    key = headers.get("x-vibeserve-api-key") or headers.get("X-VibeServe-API-Key")
    if key:
        return key
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def _authorize(headers: Dict[str, str]) -> Optional[str]:
    """Return error message if unauthorized, else None. Fail closed in production."""
    mutly_key = os.getenv("VIBESERVE_MUTLY_API_KEY") or os.getenv("VIBESERVE_API_KEY")
    presented = _extract_api_key(headers)
    require_auth = os.getenv("VIBESERVE_REQUIRE_AUTH", "true").lower() != "false"

    if mutly_key:
        if not presented or presented != mutly_key:
            return "Invalid or missing API key"
        return None

    if require_auth and not is_auth_enabled():
        return "VIBESERVE_MUTLY_API_KEY required — bridge auth not configured"

    if is_auth_enabled() and presented:
        try:
            verify_token(presented)
            return None
        except PermissionError as e:
            return str(e)

    if is_auth_enabled() and not presented:
        return "Authentication required"

    if require_auth:
        return "Authentication required"

    return None


MAX_BODY_BYTES = int(os.getenv("VIBESERVE_MAX_BODY_BYTES", "1048576"))


FIELD_RENAME_MAP: Dict[str, str] = {
    "workspaceId": "workspace_id",
    "contextTypes": "context_types",
    "contextType": "context_type",
    "artifactType": "artifact_type",
    "designContext": "design_context",
    "fileContext": "file_context",
    "recentErrors": "recent_errors",
    "maxChars": "max_chars",
}


def _rename_fields(data: Dict[str, Any], tool_name: str) -> None:
    """Rename camelCase keys to snake_case in-place using FIELD_RENAME_MAP."""
    for camel, snake in FIELD_RENAME_MAP.items():
        if camel in data:
            data[snake] = data.pop(camel)


async def _invoke_tool(name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    handler = MUTLY_HTTP_TOOLS.get(name)
    if not handler:
        available = sorted(MUTLY_HTTP_TOOLS.keys())[:10]
        return {"status": "error", "error": f"Unknown tool '{name}'. Available: {available}"}

    body = dict(data)
    trace_id = body.pop("trace_id", None) or body.pop("traceId", None) or new_trace_id()
    set_trace_id(trace_id)
    ctx = _BridgeCtx()
    token = body.pop("_auth_token", None)
    if token:
        # If the token is a raw API key (not a JWT), mint a short-lived scoped
        # JWT so downstream require_scope decorators accept it.  This makes
        # the bridge-to-tool handoff symmetric with MCP clients that send JWTs.
        mutly_key = os.getenv("VIBESERVE_MUTLY_API_KEY") or os.getenv("VIBESERVE_API_KEY")
        if mutly_key and token == mutly_key:
            try:
                from vibeserve.auth import create_token
                token = create_token(api_key="mutly-bridge", expires_hours=1)
            except Exception:
                # Fall back to the raw token — require_scope will reject it,
                # but at least the user gets a clean UNAUTHORIZED error.
                pass
        ctx.auth_token = token

    _rename_fields(body, name)
    body.setdefault("trace_id", trace_id)
    result = await handler(ctx, **body)
    if isinstance(result, dict) and "traceId" not in result:
        result["traceId"] = trace_id
    return result


async def handle_http_request(method: str, path: str, headers: Dict[str, str], body: bytes) -> tuple[int, Dict[str, str], bytes]:
    """Dispatcher that routes to extracted handler modules."""
    cors = CORS_HEADERS

    if method == "OPTIONS":
        return 204, cors, b""

    if len(body) > MAX_BODY_BYTES:
        return 413, cors, json.dumps({"status": "error", "error": "Request body too large"}).encode()

    # Health
    if method == "GET" and path in ("/health", "/health/"):
        from vibeserve.handlers.health import handle_health as _health
        return await _health(headers)

    # LLM complete
    if method == "POST" and path in ("/v1/llm/complete", "/v1/llm/complete/"):
        from vibeserve.handlers.llm import handle_llm_complete as _llm_complete
        return await _llm_complete(headers, body, cors, _authorize, headers)

    # SSE streaming
    if method == "GET" and path in ("/v1/llm/stream", "/v1/llm/stream/"):
        from vibeserve.handlers.llm import handle_llm_stream as _llm_stream
        return await _llm_stream(headers, cors)

    # LLM health
    if method == "GET" and path in ("/v1/llm/health", "/v1/llm/health/"):
        from vibeserve.handlers.llm import handle_llm_health as _llm_health
        return await _llm_health(cors)

    # Budget POST
    if method == "POST" and path in ("/v1/llm/budget", "/v1/llm/budget/"):
        auth_err = _authorize(headers)
        if auth_err:
            return 401, cors, json.dumps({"status": "error", "error": auth_err}).encode()
        from vibeserve.handlers.budget import handle_budget_post as _budget_post
        return await _budget_post(body, cors)

    # Budget GET
    if method == "GET" and path in ("/v1/llm/budget", "/v1/llm/budget/"):
        from vibeserve.handlers.budget import handle_budget_get as _budget_get
        return await _budget_get(cors)

    # Memory
    if path.startswith("/v1/memory"):
        from vibeserve.handlers.memory import handle_memory as _memory
        return await _memory(method, path, headers, body, cors)

    # Tools
    if method == "POST" and path.startswith("/tools/"):
        auth_err = _authorize(headers)
        if auth_err:
            return 401, cors, json.dumps({"status": "error", "error": auth_err}).encode()
        from vibeserve.handlers.tools import handle_tools as _tools
        return await _tools(path, headers, body, cors)

    # Agents
    if path.startswith("/v1/agents"):
        from vibeserve.handlers.agents import handle_agents as _agents
        return await _agents(method, path, body, cors)

    return 404, cors, json.dumps({"status": "error", "error": "Not found"}).encode()


async def _handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    # TASK: Replace custom HTTP parser with a framework (e.g. FastAPI/Starlette)
    # The TS bridge already uses Hono for proper HTTP handling.
    try:
        request_line = (await reader.readline()).decode("utf-8", errors="replace").strip()
        if not request_line:
            writer.close()
            return
        parts = request_line.split()
        method = parts[0] if parts else "GET"
        path = parts[1].split("?", 1)[0] if len(parts) > 1 else "/"

        headers: Dict[str, str] = {}
        while True:
            line = (await reader.readline()).decode("utf-8", errors="replace").strip()
            if not line:
                break
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        content_length = int(headers.get("content-length", "0"))
        if content_length > MAX_BODY_BYTES:
            status, resp_headers, resp_body = (
                413,
                CORS_HEADERS,
                json.dumps({"status": "error", "error": "Request body too large"}).encode(),
            )
            response = (
                f"HTTP/1.1 {status} Payload Too Large\r\n"
                f"{chr(10).join(f'{k}: {v}' for k, v in resp_headers.items())}\r\n"
                f"Content-Length: {len(resp_body)}\r\n\r\n"
            ).encode() + resp_body
            writer.write(response)
            await writer.drain()
            return
        body = await reader.readexactly(content_length) if content_length > 0 else b""

        result = await handle_http_request(method, path, headers, body)

        # Streaming response: first element is the sentinel "STREAM"
        if isinstance(result, tuple) and len(result) == 4 and result[0] == "STREAM":
            _, status, resp_headers, source_factory = result
            reason = "OK" if status == 200 else "Error"
            header_lines = "\r\n".join(f"{k}: {v}" for k, v in resp_headers.items())
            head = (
                f"HTTP/1.1 {status} {reason}\r\n"
                f"{header_lines}\r\n"
                f"Transfer-Encoding: chunked\r\n\r\n"
            ).encode()
            writer.write(head)
            await writer.drain()
            # Iterate the async source and write each chunk as a chunked block
            async for chunk in source_factory():
                data = chunk.encode("utf-8") if isinstance(chunk, str) else chunk
                if not data:
                    continue
                # HTTP/1.1 chunked format: <hex length>\r\n<bytes>\r\n
                writer.write(f"{len(data):x}\r\n".encode() + data + b"\r\n")
                await writer.drain()
            # Terminating zero-length chunk
            writer.write(b"0\r\n\r\n")
            await writer.drain()
            return

        # Buffered response (the common case)
        status, resp_headers, resp_body = result
        reason = "OK" if status == 200 else "Error"
        header_lines = "\r\n".join(f"{k}: {v}" for k, v in resp_headers.items())
        response = (
            f"HTTP/1.1 {status} {reason}\r\n{header_lines}\r\nContent-Length: {len(resp_body)}\r\n\r\n"
        ).encode() + resp_body
        writer.write(response)
        await writer.drain()
    except Exception:
        log.exception("HTTP client handler error")
    finally:
        writer.close()
        await writer.wait_closed()


async def run_http_server(host: Optional[str] = None, port: Optional[int] = None) -> None:
    import socket

    bind_host = host or os.getenv("VIBESERVE_HTTP_HOST", "127.0.0.1")
    bind_port = int(port if port is not None else os.getenv("VIBESERVE_HTTP_PORT", "8000"))

    # Workaround for Windows proactor event loop AssertionError
    # Create socket manually first, then pass to start_server
    sock = socket.create_server((bind_host, bind_port), family=socket.AF_INET, backlog=100)
    server = await asyncio.start_server(_handle_client, sock=sock)
    log.info(f"VibeServe Mutly HTTP bridge listening on http://{bind_host}:{bind_port}")
    async with server:
        await server.serve_forever()


def run_http_blocking(host: Optional[str] = None, port: Optional[int | str] = None) -> None:
    bind_host = host or os.getenv("VIBESERVE_HTTP_HOST", "127.0.0.1")
    bind_port = int(port if port is not None else os.getenv("VIBESERVE_HTTP_PORT", "8000"))
    asyncio.run(run_http_server(bind_host, bind_port))

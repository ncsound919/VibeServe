from __future__ import annotations

import asyncio
import logging
import shutil
import sys
from typing import Optional

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastmcp import FastMCP, Client
from fastmcp.client.transports import StdioTransport

logger = logging.getLogger(__name__)


def _check_hermes_available() -> bool:
    return shutil.which("hermes") is not None


def _hermes_transport() -> StdioTransport:
    cmd = ["hermes", "mcp", "serve"]
    return StdioTransport(command=cmd[0], args=cmd[1:])


def build_hermes_proxy() -> Optional[FastMCP]:
    """
    Create a FastMCP proxy that forwards to a `hermes mcp serve` subprocess.
    Returns a FastMCPProxy (mountable) or None if hermes is not available.
    """
    if not _check_hermes_available():
        logger.warning("hermes not found on PATH; Hermes tools disabled")
        return None

    transport = _hermes_transport()
    client = Client(transport=transport)

    hermes_proxy = FastMCP.as_proxy(
        client,
        name="hermes-bridge",
    )

    logger.info("Hermes stdio bridge created via FastMCP.as_proxy()")
    return hermes_proxy


async def run_hermes_http_bridge(host: str = "127.0.0.1", port: int = 9090) -> None:
    """Run the Hermes proxy as a standalone HTTP server."""
    hermes_proxy = build_hermes_proxy()
    if hermes_proxy is None:
        logger.error("Cannot start Hermes HTTP bridge: Hermes not available")
        return

    logger.info("Starting Hermes HTTP bridge on %s:%s", host, port)
    await hermes_proxy.run_async(transport="streamable-http", host=host, port=port)
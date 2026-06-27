"""VibeServe Core MCP Server loop — unified entry point."""
from __future__ import annotations

import sys
import os
import logging
import asyncio
from dotenv import load_dotenv

from vibeserve.server import mcp_server

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr
)
log = logging.getLogger("VibeServe")


def main(mode: str = "full"):
    """Unified entry point for all run modes.

    mode="stdio": Run the MCP server over stdio (for MCP clients).
    mode="full":  The default — supports --http, --demo, --interactive, --vibe-demo,
                  and the plain MCP server fallback (from __main__.py).
    """
    _pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_pkg_root, ".env"))

    if mode == "stdio":
        asyncio.run(_run_stdio())
        return

    # Full mode — delegate to the __main__ logic
    from vibeserve.__main__ import main as _full_main
    _full_main()


async def _run_stdio():
    log.info("Starting VibeServe MCP Server (stdio)...")
    server = mcp_server.build()
    await server.run_stdio_async()


if __name__ == "__main__":
    try:
        main(mode="stdio")
    except KeyboardInterrupt:
        pass
    except Exception as e:
        log.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

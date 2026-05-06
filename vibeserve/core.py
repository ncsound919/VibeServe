"""VibeServe Core MCP Server loop.
This file is the main entry point for the MCP stdio process.
"""

import sys
import logging
import asyncio

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr
)
log = logging.getLogger("VibeServe")

# Import the server registry
from vibeserve.server import mcp_server

# Import all tools to register them

async def main():
    log.info("Starting VibeServe MCP Server...")
    # Build and run the server using stdio
    server = mcp_server.build()
    await server.run_stdio_async()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        log.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

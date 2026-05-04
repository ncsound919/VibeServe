#!/usr/bin/env python3
"""VibeServe v2.0 — Agentic Coding Orchestrator (MCP)
Thin entry point shim — delegates to the vibeserve package.

For the real entry point, see vibeserve/__main__.py.
This file exists for backward compatibility with older configs (e.g., Claude Desktop).
"""

from vibeserve.__main__ import main

if __name__ == "__main__":
    main()

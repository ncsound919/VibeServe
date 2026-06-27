"""mem0 MCP tools — semantic memory, vector search, graph memory."""

from __future__ import annotations

import json
import logging

from vibeserve.server import mcp_server

log = logging.getLogger("VibeServe")

HAS_MEM0 = False
try:
    from mem0 import MemoryClient
    HAS_MEM0 = True
except ImportError:
    log.info("mem0 not installed — mem0 tools will return fallback messages")


@mcp_server.tool(name="mem0_add", description="Store a memory in mem0")
async def mem0_add(content: str, user_id: str = "default", metadata: str = "{}") -> str:
    if not HAS_MEM0:
        return "mem0 not installed - install with: pip install mem0"
    try:
        client = MemoryClient()
        meta = json.loads(metadata)
        result = client.add(content, user_id=user_id, metadata=meta)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("mem0_add failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="mem0_search", description="Search memories by semantic similarity")
async def mem0_search(query: str, user_id: str = "default", limit: int = 5) -> str:
    if not HAS_MEM0:
        return "mem0 not installed"
    try:
        client = MemoryClient()
        result = client.search(query, user_id=user_id, limit=limit)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("mem0_search failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="mem0_get_all", description="List all memories for a user")
async def mem0_get_all(user_id: str = "default") -> str:
    if not HAS_MEM0:
        return "mem0 not installed"
    try:
        client = MemoryClient()
        result = client.get_all(user_id=user_id)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("mem0_get_all failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="mem0_delete", description="Delete a specific memory by ID")
async def mem0_delete(memory_id: str) -> str:
    if not HAS_MEM0:
        return "mem0 not installed"
    try:
        client = MemoryClient()
        client.delete(memory_id)
        return "deleted"
    except Exception as e:
        log.error("mem0_delete failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="mem0_graph_query", description="Query the mem0 knowledge graph for entity relationships")
async def mem0_graph_query(query: str) -> str:
    if not HAS_MEM0:
        return "mem0 not installed"
    try:
        client = MemoryClient()
        result = client.graph.query(query)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("mem0_graph_query failed: %s", e)
        return f"Error: {e}"

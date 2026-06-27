from typing import Optional
import logging

# CRITICAL: Must be set BEFORE any asyncio imports on Windows
# to enable subprocess transport support
import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from vibeserve.tools.hermes_integration import build_hermes_proxy


log = logging.getLogger("VibeServe")


class _LazyMCP:
    _tools: list = []
    _resources: list = []
    _prompts: list = []
    _name: str = ""

    @classmethod
    def init(cls, name: str) -> None:
        cls._name = name

    @classmethod
    def tool(cls, name: Optional[str] = None, description: Optional[str] = None):
        def decorator(func):
            cls._tools.append((name, description, func))
            return func
        return decorator

    @classmethod
    def resource(cls, uri: str):
        def decorator(func):
            cls._resources.append((uri, func))
            return func
        return decorator

    @classmethod
    def prompt(cls):
        def decorator(func):
            cls._prompts.append(func)
            return func
        return decorator

    @classmethod
    def build(cls):
        from fastmcp import FastMCP
        server = FastMCP(cls._name)
        # Mount Hermes as a sub-server using FastMCP.from_client pattern
        hermes_server = build_hermes_proxy()
        if hermes_server:
            server.mount(hermes_server, namespace="hermes")
            log.info("Hermes tools mounted at /hermes namespace")
        else:
            log.warning("Hermes not available — messaging tools disabled")
        for name, desc, func in cls._tools:
            kwargs = {}
            if name:
                kwargs["name"] = name
            if desc:
                kwargs["description"] = desc
            server.tool(**kwargs)(func)
        for uri, func in cls._resources:
            server.resource(uri)(func)
        for func in cls._prompts:
            server.prompt()(func)
        return server


mcp_server = _LazyMCP
_LazyMCP.init("VibeServe")

# NOTE: _LazyMCP retains its singleton behavior for backward compat.
# The factory below is a baby-step toward full multi-instance support
# without breaking existing code that depends on the class-level state.
def create_mcp_server(name: str = "vibeserve", **kwargs) -> _LazyMCP:
    """Create an isolated MCP server instance (for testing or multi-tenant).

    This bypasses the class-level shared state so each instance has its own
    tool/resource/prompt registries.  The original singleton ``mcp_server``
    continues to work exactly as before.
    """
    import copy
    instance = _LazyMCP.__new__(_LazyMCP)
    instance._tools = copy.deepcopy(_LazyMCP._tools)
    instance._resources = copy.deepcopy(_LazyMCP._resources)
    instance._prompts = copy.deepcopy(_LazyMCP._prompts)
    instance._name = name
    return instance

def _clip(d, *_):
    return {k: v for k, v in d.items() if not k.startswith("_")}



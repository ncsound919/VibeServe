"""Tests for vibeserve.server — _LazyMCP and helpers."""

from unittest.mock import patch
from vibeserve.server import _LazyMCP, _clip


class TestLazyMCPInit:
    def setup_method(self):
        _LazyMCP._tools = []
        _LazyMCP._resources = []
        _LazyMCP._prompts = []
        _LazyMCP._name = ""

    def test_init_sets_name(self):
        _LazyMCP.init("TestServer")
        assert _LazyMCP._name == "TestServer"


class TestLazyMCPDecorators:
    def setup_method(self):
        _LazyMCP._tools = []
        _LazyMCP._resources = []
        _LazyMCP._prompts = []
        _LazyMCP._name = ""

    def test_tool_decorator_registers_with_name_and_desc(self):
        @_LazyMCP.tool(name="my_tool", description="does stuff")
        def my_tool():
            pass
        assert len(_LazyMCP._tools) == 1
        name, desc, func = _LazyMCP._tools[0]
        assert name == "my_tool"
        assert desc == "does stuff"
        assert func is my_tool

    def test_tool_decorator_registers_without_name(self):
        @_LazyMCP.tool()
        def another():
            pass
        assert len(_LazyMCP._tools) == 1
        name, desc, func = _LazyMCP._tools[0]
        assert name is None
        assert desc is None

    def test_resource_decorator_registers(self):
        @_LazyMCP.resource("resource://test")
        def my_resource():
            return "data"
        assert len(_LazyMCP._resources) == 1
        uri, func = _LazyMCP._resources[0]
        assert uri == "resource://test"
        assert func is my_resource

    def test_prompt_decorator_registers(self):
        @_LazyMCP.prompt()
        def my_prompt():
            return "prompt data"
        assert len(_LazyMCP._prompts) == 1
        assert _LazyMCP._prompts[0] is my_prompt


class TestLazyMCPBuild:
    def setup_method(self):
        _LazyMCP._tools = []
        _LazyMCP._resources = []
        _LazyMCP._prompts = []
        _LazyMCP._name = ""

    def test_build_creates_fastmcp_server(self):
        _LazyMCP._name = "TestBuild"
        _LazyMCP._tools.append(("t1", "d1", lambda: None))
        _LazyMCP._resources.append(("res://x", lambda: None))
        _LazyMCP._prompts.append(lambda: None)
        with patch("fastmcp.FastMCP") as MockFastMCP:
            mock_instance = MockFastMCP.return_value
            server = _LazyMCP.build()
            MockFastMCP.assert_called_once_with("TestBuild")
            assert server is mock_instance
            assert mock_instance.tool.call_count == 1
            assert mock_instance.resource.call_count == 1
            assert mock_instance.prompt.call_count == 1


class TestClip:
    def test_removes_underscore_prefixed_keys(self):
        d = {"a": 1, "_b": 2, "c": 3}
        assert _clip(d) == {"a": 1, "c": 3}

    def test_preserves_all_keys_when_none_underscored(self):
        d = {"x": 10, "y": 20}
        assert _clip(d) == d

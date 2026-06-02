import pytest
from vibeserve.tools.mcp_generator import MCPGenerator

def test_generate_tool():
    generator = MCPGenerator()
    tool_code = generator.generate_tool(
        name="test_tool",
        description="Test tool description",
        parameters={"param1": "str"},
        return_type="str"
    )
    assert "@mcp_server.tool" in tool_code
    assert "name=\"test_tool\"" in tool_code
    assert "description=\"Test tool description\"" in tool_code

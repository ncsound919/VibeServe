from vibeserve.server import mcp_server
from vibeserve.utils import require_scope
import pydantic

class MCPGenerator:
    def __init__(self):
        pass

    def generate_tool(self, name: str, description: str, parameters: dict, return_type: str) -> str:
        # Generate the tool code
        tool_code = f"""
from vibeserve.server import mcp_server
from vibeserve.utils import require_scope
import pydantic

class {name.capitalize()}Args(pydantic.BaseModel):
    {self._generate_parameters(parameters)}

@mcp_server.tool(name="{name}", description="{description}")
@require_scope("mcp:write")
async def {name}(args: {name.capitalize()}Args) -> {return_type}:
    # Autonomous implementation goes here
    pass
"""
        return tool_code

    def _generate_parameters(self, parameters: dict) -> str:
        param_lines = []
        for param_name, param_type in parameters.items():
            param_lines.append(f"    {param_name}: {param_type}")
        return "\n".join(param_lines)

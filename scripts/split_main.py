import os

os.makedirs('vibeserve/tools', exist_ok=True)
os.makedirs('vibeserve/handlers', exist_ok=True)

with open('vibeserve/__main__.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

sections = {}
current_section = "imports"
sections[current_section] = []

for line in lines:
    if "====================== LAZY MCP SERVER ======================" in line:
        current_section = "lazy_mcp"
        sections[current_section] = []
        continue
    elif "====================== RESOURCES ======================" in line:
        current_section = "resources"
        sections[current_section] = []
        continue
    elif "====================== PROMPTS ======================" in line:
        current_section = "prompts"
        sections[current_section] = []
        continue
    elif "====================== V4 TOOLS ======================" in line:
        current_section = "v4"
        sections[current_section] = []
        continue
    elif "====================== V5 CORE TOOLS ======================" in line:
        current_section = "v5"
        sections[current_section] = []
        continue
    elif "====================== INTEGRATION TOOLS ======================" in line:
        current_section = "integration"
        sections[current_section] = []
        continue
    elif "====================== REGISTER V2.0 FEATURE TOOLS ======================" in line:
        current_section = "main"
        sections[current_section] = [line]
        continue
    
    if current_section not in sections:
        sections[current_section] = []
    sections[current_section].append(line)

# Create server.py
with open('vibeserve/server.py', 'w', encoding='utf-8') as f:
    f.write("from typing import Optional\n")
    f.write("".join(sections.get("lazy_mcp", [])))

# We need common imports for the other files
common_imports = "".join(sections.get("imports", []))
common_imports = common_imports.replace("mcp_server = _LazyMCP\n_LazyMCP.init(\"VibeServe\")", "")

# Create handlers/resources.py
with open('vibeserve/handlers/resources.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("".join(sections.get("resources", [])))

# Create handlers/prompts.py
with open('vibeserve/handlers/prompts.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("".join(sections.get("prompts", [])))

# Create tools/v4.py
with open('vibeserve/tools/v4_tools.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("".join(sections.get("v4", [])))

# Create tools/v5.py
with open('vibeserve/tools/v5_tools.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("".join(sections.get("v5", [])))

# Create tools/integration.py
with open('vibeserve/tools/integration_tools.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("".join(sections.get("integration", [])))

# Recreate __main__.py
with open('vibeserve/__main__.py', 'w', encoding='utf-8') as f:
    f.write(common_imports)
    f.write("from vibeserve.server import mcp_server\n")
    f.write("import vibeserve.handlers.resources\n")
    f.write("import vibeserve.handlers.prompts\n")
    f.write("import vibeserve.tools.v4_tools\n")
    f.write("import vibeserve.tools.v5_tools\n")
    f.write("import vibeserve.tools.integration_tools\n")
    f.write("".join(sections.get("main", [])))


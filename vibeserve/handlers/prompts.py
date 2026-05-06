"""VibeServe MCP prompts."""

from vibeserve.server import mcp_server


@mcp_server.prompt()
def prompt_architecture(intent: str = "", constraints: str = "") -> str:
    return f"Architecture plan for: {intent}\nConstraints: {constraints}\n\nUse vibe_architect."

@mcp_server.prompt()
def prompt_code_review(files: str = "", requirements: str = "") -> str:
    return f"Review code from UX/Engineering/Accessibility perspectives.\nFiles: {files}\nUse vibe_review."

@mcp_server.prompt()
def prompt_vibe_build(intent: str = "") -> str:
    return f"Full pipeline: architect->code->review->verify->iterate\nIntent: {intent}\nZero fabrication."

@mcp_server.prompt()
def prompt_accessibility_audit() -> str:
    return "Audit for WCAG AAA: ARIA roles, keyboard nav, contrast (7:1), touch targets (44px)."

@mcp_server.prompt()
def prompt_test_generation(code: str = "") -> str:
    return f"Generate unit, accessibility, integration, edge case tests.\nCode: {code}"

@mcp_server.prompt()
def prompt_deployment(target: str = "vercel") -> str:
    return f"Generate deployment config for {target}: build, env, runtime, health checks."

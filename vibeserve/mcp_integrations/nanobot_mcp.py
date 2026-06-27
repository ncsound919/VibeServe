"""nanobot (Lil-Homie) MCP tools — multi-channel send, cron, skills."""

from __future__ import annotations

import json
import logging

from vibeserve.server import mcp_server

log = logging.getLogger("VibeServe")

HAS_NANOBOT = False
try:
    from nanobot.channels.manager import ChannelManager
    from nanobot.cron.service import CronService
    from nanobot.skills.loader import SkillLoader
    HAS_NANOBOT = True
except ImportError:
    log.info("nanobot-ai not installed — nanobot tools will return fallback messages")


@mcp_server.tool(name="nanobot_send", description="Send a message through any nanobot channel")
async def nanobot_send(
    channel: str = "telegram",
    recipient: str = "",
    message: str = "",
    data: str = "{}",
) -> str:
    if not HAS_NANOBOT:
        return "nanobot-ai not installed - install with: pip install nanobot-ai"
    try:
        manager = ChannelManager()
        parsed_data = json.loads(data)
        result = manager.send(channel=channel, recipient=recipient, message=message, data=parsed_data)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("nanobot_send failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="nanobot_schedule_cron", description="Register a cron job in nanobot")
async def nanobot_schedule_cron(
    name: str,
    cron_expression: str,
    action: str,
    params: str = "{}",
) -> str:
    if not HAS_NANOBOT:
        return "nanobot-ai not installed"
    try:
        service = CronService()
        parsed_params = json.loads(params)
        result = service.add_job(name=name, cron=cron_expression, action=action, params=parsed_params)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("nanobot_schedule_cron failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="nanobot_run_skill", description="Execute a nanobot skill by name")
async def nanobot_run_skill(skill_name: str, input_data: str = "{}") -> str:
    if not HAS_NANOBOT:
        return "nanobot-ai not installed"
    try:
        loader = SkillLoader()
        parsed_input = json.loads(input_data)
        result = loader.run(skill_name=skill_name, input_data=parsed_input)
        return json.dumps(result, default=str)
    except Exception as e:
        log.error("nanobot_run_skill failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="nanobot_list_skills", description="List all available nanobot skills")
async def nanobot_list_skills() -> str:
    if not HAS_NANOBOT:
        return "nanobot-ai not installed"
    try:
        loader = SkillLoader()
        skills = loader.list_skills()
        return json.dumps(skills, default=str)
    except Exception as e:
        log.error("nanobot_list_skills failed: %s", e)
        return f"Error: {e}"

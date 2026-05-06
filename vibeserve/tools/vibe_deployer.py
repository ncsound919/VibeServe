"""VibeDeployer — deployment config generation."""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List
from vibeserve.models import CodeFile
from vibeserve.tools._llm_mixin import LLMCallMixin

log = logging.getLogger("VibeServe")


class VibeDeployer(LLMCallMixin):
    def __init__(self, provider=None, ctx: Any = None):
        from vibeserve.providers import router
        self.provider = provider or router.get()
        self.ctx = ctx

    async def generate_deploy(self, project_name: str, files: List[CodeFile],
                               targets: List[str] = None) -> Dict[str, Any]:
        targets = targets or ["vercel"]
        files_summary = [{"path": f.path, "purpose": f.purpose} for f in files]
        prompt = f"""You are a DevOps engineer. Generate deployment configurations.

PROJECT: {project_name}
FILES: {json.dumps(files_summary, indent=2)[:2000]}
TARGETS: {', '.join(targets)}

Return a JSON object with deployment configs for each target:
{{
  "configs": {{
    "vercel": {{"vercel.json": "...", "env": {{}}, "build_command": "...", "output_dir": "..."}},
    "docker": {{"Dockerfile": "...", "docker-compose.yml": "...", "nginx.conf": "..."}},
    "static": {{"build_command": "...", "output_dir": "..."}},
    "node": {{"package.json_scripts": {{}}, "start_command": "..."}}
  }},
  "environment_variables": {{"KEY": "description"}},
  "health_check": {{"endpoint": "...", "interval": "..."}},
  "monitoring": {{"recommended": ["tool1", "tool2"]}}
}}

Include only the requested targets."""

        response = await self._mcp_llm_call(prompt, temperature=0.3, ctx=self.ctx)
        if not response:
            return {"configs": {}, "environment_variables": {}}
        try:
            return json.loads(response)
        except Exception as e:
            log.error(f"[VibeDeployer] Failed to parse deploy config: {e}")
            return {"configs": {}, "environment_variables": {}}

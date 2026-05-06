"""Design agent for multi-agent critique."""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List
from vibeserve.tools.config import CONFIG

log = logging.getLogger("VibeServe")


class DesignAgent:
    def __init__(self, role: str, personality: str, provider=None):
        self.role = role
        self.personality = personality
        from vibeserve.providers import router
        self.provider = provider or router.get()

    async def critique(self, schema: Dict[str, Any], requirements: List[str]) -> Dict[str, Any]:
        from vibeserve.providers import router
        prompt = f"""You are a {self.role} reviewing a UI design specification.

Your personality: {self.personality}

Design to critique:
{json.dumps(schema, indent=2)[:2000]}...

Requirements this design should meet:
{chr(10).join(f'- {r}' for r in requirements)}

Provide a JSON critique with:
{{
  "score": <0.0-1.0>,
  "strengths": [<list of 2-3 strengths>],
  "weaknesses": [<list of 2-3 weaknesses>],
  "specific_feedback": "<1-2 sentences of actionable feedback>",
  "concern_level": "<low|medium|high>",
  "recommendation": "<keep|modify|reject>"
}}

Be concise and specific. Your perspective as a {self.role} matters."""

        response = await router.get().call(prompt, temperature=CONFIG.temp_critic)
        if not response:
            return {"score": 0.5, "error": "Failed to generate critique"}
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            log.warning(f"Failed to parse critique from {self.role}")
            return {"score": 0.5, "error": "Invalid JSON response"}

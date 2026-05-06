"""VibeArchitect — architecture planning from intent."""
from __future__ import annotations
import json
from typing import Any, Dict, List
from vibeserve.models import ArchitectureDecision, VibePlan
from vibeserve.tools._llm_mixin import LLMCallMixin

CONTENT_GUIDELINES = """
CRITICAL CONTENT RULES:

NO FABRICATION:
- NEVER invent statistics: no fake download counts, uptime percentages, user numbers.
- NEVER fabricate features not in the architecture plan.
- NEVER invent testimonials, quotes, or named users.
- NEVER use SaaS copy: "Free Trial", "Pricing Plans", "Sign Up", "Enterprise Tier".

MUST INCLUDE (OSS projects):
- Logo image (use provided paths)
- Actual tools/features list from the architecture plan
- Pipeline diagram or workflow
- Quick start / installation code block
- Donate link (GitHub star + CashApp if specified)
- Footer with project name and license

STRUCTURAL:
- Valid HTML with proper tag nesting
- ARIA labels on all interactive elements
- Relative asset paths for deployment context
- Current year

IF UNSURE, OMIT stats and testimonials. ALWAYS include the actual product features.
A clean honest page showing the real product is better than a fabricated marketing page.
"""


class VibeArchitect(LLMCallMixin):
    def __init__(self, provider=None, ctx: Any = None):
        from vibeserve.providers import router
        self.provider = provider or router.get()
        self.ctx = ctx

    async def plan(self, intent: str, constraints: List[str] = None,
                   context: Dict[str, Any] = None, target_stack: str = "react") -> VibePlan:
        constraints = constraints or []
        context = context or {}
        prompt = f"""You are a senior software architect. Produce a detailed architecture plan.

{CONTENT_GUIDELINES}

USER INTENT: {intent}
CONSTRAINTS: {chr(10).join(f'- {c}' for c in constraints) if constraints else 'None'}
TARGET STACK: {target_stack}

Return JSON: {{"decisions": [{{"id":"ADR-001","title":"...","context":"...","decision":"...","alternatives":["A","B"],"rationale":"...","consequences":["..."],"confidence":0.9}}], "component_tree": [...], "data_flow": {{}}, "file_structure": [...], "estimated_complexity": "low|medium|high", "risks": [...], "recommended_stack": {{}}}}"""
        response = await self._mcp_llm_call(prompt, temperature=0.3, ctx=self.ctx)
        if not response:
            return VibePlan(intent=intent, risks=["Failed to generate plan"])
        try:
            data = json.loads(response)
            return VibePlan(intent=intent,
                decisions=[ArchitectureDecision(**d) for d in data.get("decisions", [])],
                component_tree=data.get("component_tree", []),
                data_flow=data.get("data_flow", {}),
                file_structure=data.get("file_structure", []),
                estimated_complexity=data.get("estimated_complexity", "medium"),
                risks=data.get("risks", []),
                recommended_stack=data.get("recommended_stack", {}))
        except Exception as e:
            return VibePlan(intent=intent, risks=[f"Parse error: {str(e)}"])

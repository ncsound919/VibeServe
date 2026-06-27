"""VibeArchitect — architecture planning from intent."""
from __future__ import annotations
import json
import re
from typing import Any, Dict, List
from vibeserve.models import ArchitectureDecision, VibePlan
from vibeserve.tools._llm_mixin import LLMCallMixin

# CONTENT_GUIDELINES — referenced by _tool_deps, core_logic, __init__ modules
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
    def __init__(self, provider_name: str = None, ctx: Any = None):
        from vibeserve.providers import router
        try:
            self.provider = router.get(provider_name, allow_fallback=False)
        except ValueError:
            self.provider = router.get()
        self.ctx = ctx

    async def plan(self, intent: str, constraints: List[str] = None,
                   context: Dict[str, Any] = None, target_stack: str = "react") -> VibePlan:
        constraints = constraints or []
        context = context or {}
        constraints_str = "; ".join(constraints) if constraints else "none"
        prompt = f"""Architecture plan for: {intent}
Constraints: {constraints_str}
Stack: {target_stack}

Return a valid JSON object with the following keys. No markdown, no commentary:
{{
  "decisions": [
    {{
      "id": "string",
      "title": "string",
      "context": "string",
      "decision": "string",
      "alternatives": ["string"],
      "rationale": "string",
      "consequences": ["string"],
      "confidence": 0.5
    }}
  ],
  "component_tree": [],
  "data_flow": {{}},
  "file_structure": ["string"],
  "estimated_complexity": "low|medium|high",
  "risks": ["string"],
  "recommended_stack": {{"key": "value"}}
}}"""
        response = await self._mcp_llm_call(prompt, temperature=0.3, ctx=self.ctx)
        if not response:
            return VibePlan(intent=intent, risks=["Failed to generate plan"])
        
        data = self._parse_json(response)
        if data is None:
            return VibePlan(intent=intent, risks=["Failed to parse LLM response as JSON"])
        
        # Normalize and validate
        def _normalize(data: dict) -> dict:
            return {
                "decisions": [
                    {
                        "id": d.get("id") or f"d-{i}",
                        "title": d.get("title") or "Untitled",
                        "context": d.get("context") or "",
                        "decision": d.get("decision") or "",
                        "alternatives": d.get("alternatives") or [],
                        "rationale": d.get("rationale") or "",
                        "consequences": d.get("consequences") or [],
                        "confidence": float(d.get("confidence") or 0.5)
                    } for i, d in enumerate(data.get("decisions", []))
                ],
                "component_tree": data.get("component_tree") or [],
                "data_flow": data.get("data_flow") or {},
                "file_structure": data.get("file_structure") or [],
                "estimated_complexity": data.get("estimated_complexity") or "medium",
                "risks": data.get("risks") or [],
                "recommended_stack": data.get("recommended_stack") or {}
            }

        clean_data = _normalize(data)
        
        return VibePlan(
            intent=intent,
            decisions=[ArchitectureDecision(**d) for d in clean_data["decisions"]],
            component_tree=clean_data["component_tree"],
            data_flow=clean_data["data_flow"],
            file_structure=clean_data["file_structure"],
            estimated_complexity=clean_data["estimated_complexity"],
            risks=clean_data["risks"],
            recommended_stack=clean_data["recommended_stack"]
        )

    @staticmethod
    def _parse_json(text: str) -> dict | None:
        return parse_json_robust(text)


def parse_json_robust(text: str) -> dict | list | None:
    """Extract and parse the first complete JSON object or array from text."""
    text = re.sub(r"<\|[^|]+\|>", "", text)
    first_brace = text.find("{")
    first_bracket = text.find("[")
    pairs = [("{", "}"), ("[", "]")]
    if first_bracket != -1 and (first_brace == -1 or first_bracket < first_brace):
        pairs = [("[", "]"), ("{", "}")]
    for start_char, end_char in pairs:
        depth = 0
        start = -1
        for i, ch in enumerate(text):
            if ch == start_char:
                if start == -1:
                    start = i
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0 and start != -1:
                    candidate = text[start:i+1]
                    cleaned = re.sub(r",\s*([\]}])", r"\1", candidate)
                    try:
                        return json.loads(cleaned)
                    except json.JSONDecodeError:
                        pass
    return None

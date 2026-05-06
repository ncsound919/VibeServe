"""VibeImplementer — code generation from architecture plans."""
from __future__ import annotations
import json
from dataclasses import asdict
from typing import Any, Dict, List, Optional
from vibeserve.models import CodeFile, VibePlan
from vibeserve.tools.config import CONFIG
from vibeserve.tools._llm_mixin import LLMCallMixin

DEFAULT_DESIGN_SYSTEM = {
    "tokens": {
        "colors": {
            "primary": {"hex": "#00FF9F", "wcag_level": "AAA"},
            "secondary": {"hex": "#00B8FF", "wcag_level": "AAA"},
            "accent": {"hex": "#FF00AA", "wcag_level": "AAA"},
            "background": {"hex": "#0A0A0A", "wcag_level": "FAIL", "role": "background_only"},
            "surface": {"hex": "#111111", "wcag_level": "AA"},
            "text": {"hex": "#EEEEEE", "wcag_level": "AAA"},
            "text_secondary": {"hex": "#AAAAAA", "wcag_level": "AA"},
            "success": {"hex": "#00FF9F", "wcag_level": "AAA"},
            "warning": {"hex": "#FFB800", "wcag_level": "AAA"},
            "error": {"hex": "#FF4444", "wcag_level": "AAA"},
        },
        "typography": {
            "heading": {"font_family": "Inter", "font_size": "2.5rem", "font_weight": "700", "line_height": 1.2, "letter_spacing": "-0.02em"},
            "subheading": {"font_family": "Inter", "font_size": "1.5rem", "font_weight": "600", "line_height": 1.3},
            "body": {"font_family": "Inter", "font_size": "1rem", "font_weight": "400", "line_height": 1.5},
            "caption": {"font_family": "Inter", "font_size": "0.875rem", "font_weight": "400", "line_height": 1.4}
        },
        "spacing": {"xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "2rem", "xl": "4rem", "2xl": "8rem"},
        "shadows": {"sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)", "xl": "0 20px 25px rgba(0,0,0,0.1)"},
        "border_radius": {"sm": "0.25rem", "md": "0.5rem", "lg": "1rem", "full": "9999px"}
    },
    "constraints": {
        "min_wcag_level": "AA",
        "allowed_components": ["button", "input", "card", "modal", "dropdown", "tabs", "badge", "avatar", "breadcrumb", "tooltip", "checkbox", "radio", "toggle", "slider", "progress", "spinner", "alert", "snackbar", "hero", "form", "grid", "list", "table", "pagination", "custom"],
        "color_whitelist": ["primary", "secondary", "accent", "background", "surface", "text", "text_secondary", "success", "warning", "error"],
        "max_component_depth": 6,
        "required_aria_roles": ["button", "navigation", "main", "contentinfo"]
    }
}


class VibeImplementer(LLMCallMixin):
    def __init__(self, provider=None, design_system: Optional[Dict[str, Any]] = None, ctx: Any = None):
        from vibeserve.providers import router
        self.provider = provider or router.get()
        self._design_system = design_system
        self.ctx = ctx

    @property
    def design_system(self):
        return self._design_system or DEFAULT_DESIGN_SYSTEM

    async def implement(self, plan: VibePlan, intent: str, constraints: List[str] = None,
                        target_language: str = "typescript") -> List[CodeFile]:
        constraints = constraints or []
        ds_tokens = json.dumps(self.design_system.get("tokens", {}), indent=2)[:2000]
        from vibeserve.tools.vibe_architect import CONTENT_GUIDELINES
        prompt = f"""Generate production-ready code from this plan. Enforce constraints. Include full accessibility.

{CONTENT_GUIDELINES}

INTENT: {intent}
DECISIONS: {json.dumps([asdict(d) for d in plan.decisions], indent=2)[:2000]}
COMPONENTS: {json.dumps(plan.component_tree, indent=2)[:1000]}
FILES: {json.dumps(plan.file_structure)}
STACK: {json.dumps(plan.recommended_stack)}
CONSTRAINTS: {chr(10).join(f'- {c}' for c in constraints)}
DESIGN TOKENS: {ds_tokens}
TARGET: {target_language}

Return a JSON array of files: [{{"path":"...","content":"...","language":"tsx","purpose":"...","accessibility_notes":["..."]}}]"""
        response = await self._mcp_llm_call(prompt, temperature=CONFIG.temp_generator, ctx=self.ctx)
        if not response:
            return []
        try:
            data = json.loads(response)
            if isinstance(data, list):
                return [CodeFile(**f) for f in data]
            return []
        except Exception as e:
            import logging
            log = logging.getLogger("VibeServe")
            log.warning(f"[VibeImplementer] Failed to parse code files: {e}")
            return []

"""SpecGenerator — UI spec generation with multi-agent critique."""
from __future__ import annotations
import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List
from vibeserve.tools.config import CONFIG
from vibeserve.tools.critique import MultiAgentCritique
from vibeserve.tools.validators import SchemaValidator
from vibeserve.tools._llm_mixin import LLMCallMixin

log = logging.getLogger("VibeServe")


class SpecGenerator(LLMCallMixin):
    def __init__(self, design_system: Dict[str, Any], provider=None):
        self.design_system = design_system
        self.critique = MultiAgentCritique()
        from vibeserve.providers import router
        self.provider = provider or router.get()
        self.ctx = None

    def _sanitize_input(self, text: str, max_len: int = 500) -> str:
        if not text or not isinstance(text, str):
            log.warning("[Security] _sanitize_input received non-string input")
            return ""
        patterns = [
            (r"ignore\s+previous", "", re.IGNORECASE),
            (r"system:", "", re.IGNORECASE),
            (r"assistant:", "", re.IGNORECASE),
            (r"```", ""),
            (r"<\|", ""),
            (r"\|>", ""),
            (r"DROP\s+TABLE", "", re.IGNORECASE),
            (r"DELETE\s+FROM", "", re.IGNORECASE),
            (r"INSERT\s+INTO", "", re.IGNORECASE),
            (r"UNION\s+SELECT", "", re.IGNORECASE),
            (r"<script", "", re.IGNORECASE),
            (r"javascript:", "", re.IGNORECASE),
            (r"onerror\s*=", "", re.IGNORECASE),
            (r"onload\s*=", "", re.IGNORECASE),
            (r"\.\./", ""),
            (r"\\x", ""),
            (r"SELECT\s+\*\s+FROM", "", re.IGNORECASE),
        ]
        for pattern in patterns:
            flags = pattern[2] if len(pattern) > 2 else 0
            text = re.sub(pattern[0], pattern[1], text, flags=flags)
        text = re.sub(r'\s+', ' ', text)
        sanitized = text[:max_len].strip()
        if sanitized != text[:max_len].strip():
            log.warning(f"[Security] Input sanitized: {len(text) - len(sanitized)} chars removed or truncated")
        return sanitized

    async def generate_variant(self, requirements: List[str], iteration: int = 0) -> Dict[str, Any]:
        spec_id = hashlib.sha256(f"{json.dumps(requirements)}{time.time()}".encode()).hexdigest()[:20]
        clean_reqs = [self._sanitize_input(r) for r in requirements]

        prompt = f"""Generate a production-ready UI specification for:
Requirements:
{chr(10).join(f'- {r}' for r in clean_reqs)}

Design System Constraints:
- Must use colors from: {', '.join(self.design_system.get('tokens', {}).get('colors', {}).keys())}
- Minimum WCAG level: {self.design_system.get('constraints', {}).get('min_wcag_level', 'AA')}
- Allowed components: {', '.join(self.design_system.get('constraints', {}).get('allowed_components', []))}

Return a valid UISchema v1.0 JSON with proper metadata, at least 3 components with full accessibility attributes, responsive layouts, and WCAG AAA-passing contrast ratios."""

        response = await self._mcp_llm_call(prompt, temperature=CONFIG.temp_generator, ctx=self.ctx)
        if not response:
            log.error("Failed to generate spec variant")
            return {}
        try:
            spec = json.loads(response)
            spec["metadata"]["id"] = spec_id
            spec["metadata"]["created_at"] = datetime.now(timezone.utc).isoformat()
            return spec
        except (json.JSONDecodeError, KeyError) as e:
            log.error(f"Invalid spec JSON generated: {e}")
            return {}

    async def generate_with_critique(self, requirements: List[str], iterations: int = 2) -> Dict[str, Any]:
        variants = []
        for i in range(min(CONFIG.max_variants, 2)):
            log.info(f"Generating variant {i + 1}...")
            variant = await self.generate_variant(requirements, i)
            if not variant:
                continue
            valid, errors = SchemaValidator.validate_schema(variant)
            if not valid:
                log.warning(f"Variant {i + 1} validation failed: {errors}")
                continue
            critique_result = await self.critique.review(variant, requirements)
            variant["_critique"] = critique_result
            variant["_score"] = critique_result.get("consensus_score", 0.5)
            variants.append(variant)

        if not variants:
            log.error("No valid variants generated")
            return {}

        best = max(variants, key=lambda v: v.get("_score", 0))
        log.info(f"Selected best variant with score {best['_score']}")

        return {
            "selected": best,
            "alternatives": sorted(variants, key=lambda v: v.get("_score", 0), reverse=True)[1:],
            "generation_metadata": {
                "total_variants": len(variants),
                "best_score": best["_score"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }

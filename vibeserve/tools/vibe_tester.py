"""VibeTester — test generation from code."""
from __future__ import annotations
import json
import logging
from typing import Any, List
from vibeserve.models import CodeFile
from vibeserve.tools.config import CONFIG
from vibeserve.tools._llm_mixin import LLMCallMixin

log = logging.getLogger("VibeServe")


class VibeTester(LLMCallMixin):
    def __init__(self, provider=None, ctx: Any = None):
        from vibeserve.providers import router
        self.provider = provider or router.get()
        self.ctx = ctx

    async def generate_tests(self, files: List[CodeFile], requirements: List[str] = None,
                              test_framework: str = "vitest") -> List[CodeFile]:
        requirements = requirements or []
        files_summary = [{"path": f.path, "language": f.language, "purpose": f.purpose, "content": f.content[:800]} for f in files]
        prompt = f"""You are a senior QA engineer. Generate comprehensive tests.

SOURCE FILES:
{json.dumps(files_summary, indent=2)[:3000]}
REQUIREMENTS:
{chr(10).join(f'- {r}' for r in requirements)}
TEST FRAMEWORK: {test_framework}

Return a JSON array of test files with path, content, language, purpose, accessibility_notes.
Cover: unit, accessibility, integration, edge cases, responsive breakpoints."""

        response = await self._mcp_llm_call(prompt, temperature=CONFIG.temp_generator, ctx=self.ctx)
        if not response:
            return []
        try:
            data = json.loads(response)
            if isinstance(data, list):
                return [CodeFile(**f) for f in data]
            return []
        except Exception as e:
            log.error(f"[VibeTester] Failed to parse test files: {e}")
            return []

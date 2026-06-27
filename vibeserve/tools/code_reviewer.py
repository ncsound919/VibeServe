"""VibeCodeReviewer — multi-agent code review."""
from __future__ import annotations
import asyncio
import logging
import os
from typing import Any, Dict, List
from vibeserve.models import CodeFile
from vibeserve.tools.design_agent import DesignAgent

log = logging.getLogger("VibeServe")


class VibeCodeReviewer:
    def __init__(self):
        self.designer = DesignAgent(role="UX Code Reviewer",
            personality="Review for visual quality, design tokens, hierarchy",
            provider=os.getenv("DESIGNER_PROVIDER"))
        self.engineer = DesignAgent(role="Code Quality Reviewer",
            personality="Review for bugs, error handling, architecture",
            provider=os.getenv("ENGINEER_PROVIDER"))
        self.advocate = DesignAgent(role="Accessibility Code Reviewer",
            personality="Review for ARIA, keyboard nav, WCAG",
            provider=os.getenv("ADVOCATE_PROVIDER"))

    async def review_code(self, files: List[CodeFile], requirements: List[str]) -> Dict[str, Any]:
        code_summary = [{"path": f.path, "language": f.language, "purpose": f.purpose, "content_preview": f.content[:8000] if len(f.content) > 8000 else f.content} for f in files]
        schema_for_review = {"files": code_summary, "requirements": requirements}
        critiques = await asyncio.gather(
            self.designer.critique(schema_for_review, requirements),
            self.engineer.critique(schema_for_review, requirements),
            self.advocate.critique(schema_for_review, requirements),
            return_exceptions=True)
        scores = [c.get("score", 0.5) for c in critiques if isinstance(c, dict) and "error" not in c]
        avg_score = sum(scores) / len(scores) if scores else 0.5
        return {
            "consensus_score": round(avg_score, 2),
            "recommendation": "approve" if avg_score > 0.8 else "revise" if avg_score > 0.6 else "reject",
            "agent_reviews": {"designer": critiques[0], "engineer": critiques[1], "advocate": critiques[2]},
            "line_level_issues": [{
                "agent": c.get("role", "?"), "issue": w,
                "severity": "high" if "crash" in str(w).lower() else "medium"
            } for c in critiques if not isinstance(c, Exception) for w in c.get("weaknesses", [])],
            "files_reviewed": len(files), "critical_issues": 0
        }

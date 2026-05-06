"""SystemAuditor — multi-agent system audit."""
from __future__ import annotations
import asyncio
import logging
import os
from typing import Any, Dict, List
from vibeserve.models import CodeFile
from vibeserve.tools.design_agent import DesignAgent

log = logging.getLogger("VibeServe")


class SystemAuditor:
    def __init__(self):
        self.backend = DesignAgent(
            role="Backend Engineer",
            personality="Review for code quality: error handling, async patterns, resource cleanup, SQL injection, type safety, logging consistency, API design.",
            provider=os.getenv("ENGINEER_PROVIDER"))
        self.security = DesignAgent(
            role="Security Auditor",
            personality="Review for vulnerabilities: API key exposure, prompt injection, path traversal, input validation, auth bypass, secrets in logs.",
            provider=os.getenv("ADVOCATE_PROVIDER"))
        self.perf = DesignAgent(
            role="Performance Reviewer",
            personality="Review for performance: blocking I/O in async, missing caching, N+1 queries, large memory structures, excessive retries.",
            provider=os.getenv("DESIGNER_PROVIDER"))

    async def audit(self, files: List[CodeFile], requirements: List[str]) -> Dict[str, Any]:
        code_summary = [{"path": f.path, "language": f.language, "purpose": f.purpose, "content_preview": f.content[:500]} for f in files]
        schema = {"files": code_summary, "requirements": requirements}
        critiques = await asyncio.gather(
            self.backend.critique(schema, requirements),
            self.security.critique(schema, requirements),
            self.perf.critique(schema, requirements),
            return_exceptions=True)
        scores = [c.get("score", 0.5) for c in critiques if isinstance(c, dict) and "error" not in c]
        avg_score = sum(scores) / len(scores) if scores else 0.5
        line_level = []
        for c in critiques:
            if isinstance(c, dict):
                for w in c.get("weaknesses", []):
                    line_level.append({
                        "agent": c.get("role", "?"),
                        "issue": w,
                        "severity": "high" if any(kw in str(w).lower() for kw in ["security", "vulnerability", "exposure", "injection", "crash", "sql"]) else "medium"
                    })
        return {
            "consensus_score": round(avg_score, 2),
            "recommendation": "approve" if avg_score > 0.8 else "revise" if avg_score > 0.6 else "reject",
            "agent_reviews": {
                "backend": critiques[0] if isinstance(critiques[0], dict) else {"error": str(critiques[0])},
                "security": critiques[1] if isinstance(critiques[1], dict) else {"error": str(critiques[1])},
                "performance": critiques[2] if isinstance(critiques[2], dict) else {"error": str(critiques[2])},
            },
            "line_level_issues": line_level,
            "files_reviewed": len(files),
            "critical_issues": len([i for i in line_level if i["severity"] == "high"])
        }

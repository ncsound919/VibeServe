"""Multi-agent critique and critique loop."""
from __future__ import annotations
import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
from vibeserve.models import IterationResult
from vibeserve.tools.config import CONFIG
from vibeserve.tools.design_agent import DesignAgent

log = logging.getLogger("VibeServe")


class MultiAgentCritique:
    def __init__(self):
        self.designer = DesignAgent(
            role="UX Designer",
            personality="Focus on user experience, delight, and aesthetic coherence.",
            provider=os.getenv("DESIGNER_PROVIDER")
        )
        self.engineer = DesignAgent(
            role="Frontend Engineer",
            personality="Focus on implementation feasibility and performance.",
            provider=os.getenv("ENGINEER_PROVIDER")
        )
        self.advocate = DesignAgent(
            role="Accessibility Advocate",
            personality="Focus on accessibility, inclusion, and WCAG compliance.",
            provider=os.getenv("ADVOCATE_PROVIDER")
        )

    async def review(self, schema: Dict[str, Any], requirements: List[str]) -> Dict[str, Any]:
        log.info("Starting multi-agent critique...")
        critiques = await asyncio.gather(
            self.designer.critique(schema, requirements),
            self.engineer.critique(schema, requirements),
            self.advocate.critique(schema, requirements),
            return_exceptions=True
        )
        scores = [c.get("score", 0.5) for c in critiques if "error" not in c]
        avg_score = sum(scores) / len(scores) if scores else 0.5
        concerns = [c.get("concern_level") for c in critiques if c.get("concern_level") == "high"]
        recommendations = [c.get("recommendation") for c in critiques]

        synthesis = {
            "agents": {"designer": critiques[0], "engineer": critiques[1], "advocate": critiques[2]},
            "consensus_score": round(avg_score, 2),
            "red_flags": len([c for c in concerns if c == "high"]),
            "recommendation": "proceed" if avg_score > 0.7 else "revise" if avg_score > 0.5 else "reject",
            "agent_agreement": len([r for r in recommendations if r == "keep"]) / 3 if recommendations else 0.5
        }
        log.info(f"Critique complete. Consensus: {synthesis['recommendation']} (score: {synthesis['consensus_score']})")
        return synthesis


class CritiqueLoop:
    def __init__(self, max_iterations: int = 3, quality_threshold: float = 0.80,
                 generator_provider: Optional[str] = None, critic_provider: Optional[str] = None):
        self.max_iterations = max_iterations
        self.quality_threshold = quality_threshold
        self.critique = MultiAgentCritique()
        from vibeserve.providers import router
        self.generator = router.get(generator_provider) if generator_provider else router.get()
        self.critic = router.get(critic_provider) if critic_provider else self.generator

    async def improve(self, initial_output: Dict[str, Any],
                      requirements: List[str], ctx: Any = None) -> Tuple[Dict[str, Any], List[IterationResult]]:
        history: List[IterationResult] = []
        current = initial_output
        for i in range(self.max_iterations):
            if ctx:
                await ctx.report_progress(int((i / self.max_iterations) * 100), 100,
                    f"Iteration {i + 1}/{self.max_iterations}: Critiquing...")
            review = await self.critique.review(current, requirements)
            score = review.get("consensus_score", 0.5)
            recommendation = review.get("recommendation", "proceed")
            if ctx:
                await ctx.info(f"Iteration {i + 1} score: {score:.2f} [{recommendation}]")
            if recommendation in ("proceed", "approve") and score >= self.quality_threshold:
                history.append(IterationResult(iteration=i + 1, score_before=score, score_after=score, passed=True))
                break
            if recommendation in ("reject", "revise", "modify"):
                repair_prompt = self._build_repair_prompt(current, review, requirements)
                repaired = await self.generator.call(repair_prompt, temperature=CONFIG.temp_generator, response_format="json")
                if repaired:
                    try:
                        new_output = json.loads(repaired)
                        new_review = await self.critique.review(new_output, requirements)
                        new_score = new_review.get("consensus_score", 0.5)
                        history.append(IterationResult(iteration=i + 1, score_before=score, score_after=new_score,
                            critique=review, passed=new_score >= self.quality_threshold))
                        if new_score > score:
                            current = new_output
                        if new_score >= self.quality_threshold:
                            break
                    except json.JSONDecodeError:
                        log.warning("[CritiqueLoop] JSON decode failed for repair response")
                        history.append(IterationResult(iteration=i + 1, score_before=score, score_after=0, passed=False))
            else:
                history.append(IterationResult(iteration=i + 1, score_before=score, score_after=score,
                    critique=review, passed=score >= self.quality_threshold))
        return current, history

    def _build_repair_prompt(self, current: Dict[str, Any], review: Dict[str, Any], requirements: List[str]) -> str:
        weaknesses = []
        for agent_name, agent_review in review.get("agents", {}).items():
            for w in agent_review.get("weaknesses", []):
                weaknesses.append(f"[{agent_name}] {w}")
        specific = []
        for agent_name, agent_review in review.get("agents", {}).items():
            fb = agent_review.get("specific_feedback", "")
            if fb:
                specific.append(f"[{agent_name}] {fb}")
        return f"""Repair this output based on critique feedback.

REQUIREMENTS:
{chr(10).join(f'- {r}' for r in requirements)}
CURRENT OUTPUT:
{json.dumps(current, indent=2)[:3000]}
CRITIQUE WEAKNESSES:
{chr(10).join(f'- {w}' for w in weaknesses)}
SPECIFIC FEEDBACK:
{chr(10).join(f'- {s}' for s in specific)}
Produce the repaired version as valid JSON. Fix every weakness listed above."""

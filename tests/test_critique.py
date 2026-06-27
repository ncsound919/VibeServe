"""
Unit tests for vibeserve.tools.critique — MultiAgentCritique and CritiqueLoop.
"""
import json
import pytest
from unittest.mock import patch
from vibeserve.tools.critique import MultiAgentCritique, CritiqueLoop

@pytest.mark.asyncio
async def test_multi_agent_critique_success():
    class MockProvider:
        @property
        def name(self):
            return "MockProvider"
        async def call(self, prompt, temperature=0.7, response_format="json"):
            return json.dumps({
                "score": 0.85,
                "strengths": ["accessible"],
                "weaknesses": [],
                "specific_feedback": "good",
                "concern_level": "low",
                "recommendation": "keep"
            })
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        critique = MultiAgentCritique()
        result = await critique.review({"components": []}, ["accessible"])
        assert "consensus_score" in result
        assert result["consensus_score"] == 0.85
        assert result["recommendation"] == "proceed"

@pytest.mark.asyncio
async def test_multi_agent_critique_failure():
    class MockProvider:
        @property
        def name(self):
            return "MockProvider"
        async def call(self, prompt, temperature=0.7, response_format="json"):
            return None
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        critique = MultiAgentCritique()
        result = await critique.review({"components": []}, ["accessible"])
        assert "consensus_score" in result
        assert result["consensus_score"] == 0.5
        
@pytest.mark.asyncio
async def test_critique_loop_improve_already_good():
    class MockProvider:
        @property
        def name(self):
            return "MockProvider"
        async def call(self, prompt, temperature=0.7, response_format="json"):
            return json.dumps({
                "score": 0.9,
                "strengths": ["perfect"],
                "weaknesses": [],
                "specific_feedback": "good",
                "concern_level": "low",
                "recommendation": "keep"
            })
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        loop = CritiqueLoop(max_iterations=2, quality_threshold=0.8)
        current, history = await loop.improve({"components": []}, ["perfect"])
        assert len(history) == 1
        assert history[0].passed is True
        assert history[0].score_before == 0.9

@pytest.mark.asyncio
async def test_critique_loop_improve_repair():
    class MockProvider:
        def __init__(self):
            self.call_count = 0
            
        @property
        def name(self):
            return "MockProvider"
            
        async def call(self, prompt, temperature=0.7, response_format="json"):
            self.call_count += 1
            if "repair this output" in prompt.lower():
                return json.dumps({"repaired": True})
            score = 0.5 if self.call_count <= 3 else 0.95
            rec = "modify" if self.call_count <= 3 else "keep"
            return json.dumps({
                "score": score,
                "strengths": [],
                "weaknesses": ["some issue"],
                "specific_feedback": "fix it",
                "concern_level": "high",
                "recommendation": rec
            })
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        loop = CritiqueLoop(max_iterations=2, quality_threshold=0.8)
        current, history = await loop.improve({"components": []}, ["perfect"])
        assert len(history) >= 1
        assert current.get("repaired") is True

@pytest.mark.asyncio
async def test_critique_loop_improve_json_decode_error():
    class MockProvider:
        def __init__(self):
            self.call_count = 0
            
        @property
        def name(self):
            return "MockProvider"
            
        async def call(self, prompt, temperature=0.7, response_format="json"):
            self.call_count += 1
            if "repair this output" in prompt.lower():
                return "invalid json!!"
            return json.dumps({
                "score": 0.5,
                "strengths": [],
                "weaknesses": ["some issue"],
                "specific_feedback": "fix it",
                "concern_level": "high",
                "recommendation": "modify"
            })
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        loop = CritiqueLoop(max_iterations=2, quality_threshold=0.8)
        current, history = await loop.improve({"components": []}, ["perfect"])
        assert len(history) >= 1
        assert history[0].passed is False

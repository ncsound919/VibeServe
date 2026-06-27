"""
Unit tests for vibeserve.tools.system_auditor — SystemAuditor.
"""
import json
import pytest
from unittest.mock import patch
from vibeserve.models import CodeFile
from vibeserve.tools.system_auditor import SystemAuditor

@pytest.mark.asyncio
async def test_system_auditor_audit_success():
    auditor = SystemAuditor()
    files = [CodeFile(path="App.tsx", content="console.log('test');", language="typescript", purpose="App")]
    requirements = ["Production ready"]
    
    class MockProvider:
        async def call(self, prompt, temperature=0.7, response_format="json"):
            return json.dumps({
                "score": 0.85,
                "strengths": ["good"],
                "weaknesses": ["security issue here", "perf concern"],
                "specific_feedback": "ok",
                "concern_level": "medium",
                "recommendation": "keep"
            })
            
    with patch("vibeserve.providers.LLMRouter.get", return_value=MockProvider()):
        result = await auditor.audit(files, requirements)
        assert result["consensus_score"] == 0.85
        assert result["recommendation"] == "approve"
        assert len(result["line_level_issues"]) == 6
        securities = [i for i in result["line_level_issues"] if i["severity"] == "high"]
        assert len(securities) == 3

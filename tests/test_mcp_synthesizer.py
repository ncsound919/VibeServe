import pytest
from vibeserve.tools.mcp_synthesizer import MCPSynthesizer

def test_find_abstractions():
    synthesizer = MCPSynthesizer()
    gaps = synthesizer.analyze_codebase(dummy_content="def add(a, b): return a + b\ndef add(x, y): return x + y")
    assert len(gaps) > 0
    assert gaps[0]["type"] == "duplication"

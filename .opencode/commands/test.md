---
description: Run tests with coverage
agent: build
---

Run the full test suite for AetherNexus-MCP with coverage report and show any failures.
Focus on the failing tests and suggest fixes.

Tests are in the tests/ directory. Use pytest to run them:
- tests/test_aether_nexus.py
- tests/test_integration_v5.py
- tests/test_integration_real_api.py

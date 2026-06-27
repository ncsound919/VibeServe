"""Regex/keyword-based task complexity classifier.

Tags tasks as: simple, medium, complex, critical — based on keyword
weighting.  No LLM calls, no external dependencies; pure Python.
"""
from __future__ import annotations

from typing import Literal

ClassifyLevel = Literal["simple", "medium", "complex", "critical"]

# ── Weighted keyword sets ──────────────────────────────────────────────────────
# Each level has a list of case-insensitive substrings and a weight.
# The level with the highest total weight wins.  Patterns are intentionally
# short so they match naturally in prompt text.
_KEYWORD_SETS: list[tuple[ClassifyLevel, int, list[str]]] = [
    ("critical", 8, [
        "security", "vulnerability", "urgent", "production",
        "critical bug", "emergency", "data loss", "breach",
        "exploit", "injection", "credentials", "secrets leak",
        "denial of service", "cve",
    ]),
    ("complex", 4, [
        "architect", "rewrite", "migrate", "multi-file", "database",
        "auth", "deploy", "pipeline", "design system", "api integration",
        "race condition", "concurrent", "distributed", "microservice",
        "state machine", "event sourcing", "caching strategy",
        "load balancing", "orchestrat", "kubernetes", "terraform",
    ]),
    ("medium", 2, [
        "refactor", "optimize", "modify", "update", "implement",
        "improve", "add feature", "extract function", "reorganize",
        "add validation", "add middleware", "error handling",
        "add endpoint", "add logging", "write test",
    ]),
    ("simple", 1, [
        "simple", "basic", "minor", "add comment", "fix typo",
        "rename", "update readme", "change color", "add test",
        "one-liner", "cosmetic", "format", "lint fix",
        "add docstring", "bump version",
    ]),
]


def classify_task(task: str) -> ClassifyLevel:
    """Return the most specific complexity level for *task*.

    Args:
        task: The task description or prompt to classify.

    Returns:
        One of ``"simple"``, ``"medium"``, ``"complex"``, ``"critical"``.
    """
    task_lower = task.lower()
    best: ClassifyLevel = "simple"
    best_weight = 0

    for level, weight, patterns in _KEYWORD_SETS:
        # Short-circuit: once we find a pattern at this level we can
        # immediately compare weight (we don't need to count occurrences).
        for pattern in patterns:
            if pattern in task_lower:
                if weight > best_weight:
                    best_weight = weight
                    best = level
                break  # one match is enough for this level

    return best

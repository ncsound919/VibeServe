"""
ECC (Everything Claude Code) Integration — skills library, AgentShield security, and agent dispatch.

ECC provides:
  - 249+ cross-harness skills for code review, testing, security, and architecture
  - AgentShield security scanner (1,282 tests, 5 categories)
  - 63 specialized agent definitions
  - 7 harness support (Claude Code, Codex, Cursor, OpenCode, Gemini, Zed, GitHub Copilot)

This module exposes ECC's capabilities as VibeServe tools, so Mutly agents can
query the skills registry and enforce AgentShield security rules.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from vibeserve.auth import require_scope
from vibeserve.middleware import audit_tool, get_trace_id, new_trace_id, set_trace_id
from vibeserve.server import mcp_server

log = logging.getLogger("VibeServe")

# ─── ECC Skills Catalog (Reference) ────────────────────────────
# Based on ECC v2.0.0-rc.1 — 249 skills across these categories.
# This is a representative subset. Full catalog would be loaded from
# an ECC installation at runtime.

ECC_SKILLS_CATALOG: List[Dict[str, Any]] = [
    # Code Review & Quality
    {"id": "coding-standards", "name": "Coding Standards", "category": "review", "harnesses": ["claude-code", "opencode", "cursor"]},
    {"id": "security-review", "name": "Security Review", "category": "review", "harnesses": ["claude-code", "opencode"]},
    {"id": "tdd-workflow", "name": "TDD Workflow", "category": "testing", "harnesses": ["claude-code", "opencode"]},
    {"id": "e2e-testing", "name": "E2E Testing (Playwright)", "category": "testing", "harnesses": ["claude-code", "opencode"]},
    {"id": "backend-patterns", "name": "Backend Patterns", "category": "architecture", "harnesses": ["claude-code", "opencode"]},
    {"id": "frontend-patterns", "name": "Frontend Patterns", "category": "architecture", "harnesses": ["claude-code", "opencode"]},
    {"id": "api-design", "name": "API Design", "category": "architecture", "harnesses": ["claude-code", "opencode"]},
    {"id": "postgres-patterns", "name": "PostgreSQL Patterns", "category": "database", "harnesses": ["claude-code", "opencode"]},
    {"id": "docker-patterns", "name": "Docker Patterns", "category": "devops", "harnesses": ["claude-code", "opencode"]},
    {"id": "deployment-patterns", "name": "Deployment Patterns", "category": "devops", "harnesses": ["claude-code", "opencode"]},
    {"id": "python-patterns", "name": "Python Patterns", "category": "language", "harnesses": ["claude-code", "opencode"]},
    {"id": "golang-patterns", "name": "Go Patterns", "category": "language", "harnesses": ["claude-code", "opencode"]},
    {"id": "rust-patterns", "name": "Rust Patterns", "category": "language", "harnesses": ["claude-code", "opencode"]},
    {"id": "swiftui-patterns", "name": "SwiftUI Patterns", "category": "language", "harnesses": ["claude-code", "opencode"]},
    {"id": "kotlin-patterns", "name": "Kotlin Patterns", "category": "language", "harnesses": ["claude-code", "opencode"]},
    {"id": "database-migrations", "name": "Database Migrations", "category": "database", "harnesses": ["claude-code", "opencode"]},
    {"id": "mcp-server-patterns", "name": "MCP Server Patterns", "category": "architecture", "harnesses": ["claude-code", "opencode"]},
    {"id": "claude-api", "name": "Claude API Patterns", "category": "ai", "harnesses": ["claude-code", "opencode"]},
]

# ─── AgentShield Security Rules ────────────────────────────────
# AgentShield runs 1,282 tests across 5 categories.
# This is a representative rule set. A full ECC installation would provide the complete set.

AGENTSHIELD_RULES: List[Dict[str, Any]] = [
    # Category 1: Secrets Detection
    {"id": "AS-001", "category": "secrets", "severity": "critical", "pattern": "api_key|api_secret|password\\s*=", "message": "Potential API key or secret in code"},
    {"id": "AS-002", "category": "secrets", "severity": "critical", "pattern": "sk-[a-zA-Z0-9]{20,}", "message": "OpenAI API key detected"},
    {"id": "AS-003", "category": "secrets", "severity": "high", "pattern": "ghp_[a-zA-Z0-9]{36}", "message": "GitHub personal access token detected"},
    {"id": "AS-004", "category": "secrets", "severity": "high", "pattern": "-----BEGIN (RSA |EC )?PRIVATE KEY-----", "message": "Private key detected in codebase"},
    {"id": "AS-005", "category": "secrets", "severity": "medium", "pattern": "AKIA[0-9A-Z]{16}", "message": "AWS access key ID detected"},
    # Category 2: Permission Risks
    {"id": "AS-101", "category": "permissions", "severity": "critical", "pattern": "eval\\(|process\\.exec\\(|execSync\\(", "message": "Code execution from string — RCE risk"},
    {"id": "AS-102", "category": "permissions", "severity": "high", "pattern": "fs\\.chmodSync\\([^,]+,\\s*0o777", "message": "Overly permissive file mode 0777"},
    {"id": "AS-103", "category": "permissions", "severity": "medium", "pattern": "require\\(['\"`]\\.\\.", "message": "Relative require with parent traversal"},
    # Category 3: Hook Injection
    {"id": "AS-201", "category": "hooks", "severity": "critical", "pattern": "pre-commit.*curl\\s", "message": "Pre-commit hook downloads from network"},
    {"id": "AS-202", "category": "hooks", "severity": "high", "pattern": "post-checkout.*chmod", "message": "Post-checkout hook modifies permissions"},
    # Category 4: MCP Risk
    {"id": "AS-301", "category": "mcp", "severity": "high", "pattern": "transport.*stdio|stdio.*transport", "message": "MCP stdio transport may allow arbitrary command execution"},
    {"id": "AS-302", "category": "mcp", "severity": "medium", "pattern": "tools\\[.*\\].*command", "message": "MCP tool executes shell commands — verify sandboxing"},
    # Category 5: Agent Config Review
    {"id": "AS-401", "category": "config", "severity": "high", "pattern": "\"permit\"\\s*:", "message": "Permissive agent config — review tool permissions"},
    {"id": "AS-402", "category": "config", "severity": "medium", "pattern": "max_turns.*[5-9]\\d{2}", "message": "High max_turns may cause excessive token usage"},
]


def _ensure_trace(trace_id: Optional[str] = None) -> str:
    tid = trace_id or get_trace_id() or new_trace_id()
    set_trace_id(tid)
    return tid


async def _scan_with_agent_shield(content: str, filename: str = "unknown") -> List[Dict[str, Any]]:
    """Run AgentShield rules against file content. Returns list of matched violations."""
    import re
    findings: List[Dict[str, Any]] = []
    for rule in AGENTSHIELD_RULES:
        try:
            matches = re.findall(rule["pattern"], content, re.IGNORECASE)
            if matches:
                for match in matches[:3]:  # cap per rule
                    findings.append({
                        "ruleId": rule["id"],
                        "category": rule["category"],
                        "severity": rule["severity"],
                        "message": rule["message"],
                        "match": match[:100],
                        "file": filename,
                    })
        except re.error:
            continue
    return findings


# ─── MCP Tool: ECC Skills List ─────────────────────────────────


@mcp_server.tool(
    name="vs_ecc_skills_list",
    description="List available ECC skills. Optionally filter by category or harness.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_ecc_skills_list_tool(
    ctx,
    category: Optional[str] = None,
    harness: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)

    skills = ECC_SKILLS_CATALOG
    if category:
        skills = [s for s in skills if s["category"] == category]
    if harness:
        skills = [s for s in skills if harness in s["harnesses"]]

    return {
        "status": "success",
        "traceId": tid,
        "total": len(skills),
        "skills": skills,
        "categories": list({s["category"] for s in ECC_SKILLS_CATALOG}),
    }


# ─── MCP Tool: ECC AgentShield Security Scan ──────────────────


@mcp_server.tool(
    name="vs_ecc_agent_shield",
    description="Run ECC AgentShield security scan on provided code content. Checks for secrets, permission risks, hook injection, MCP risks, and config issues.",
)
@audit_tool
@require_scope("mcp:write")
async def vs_ecc_agent_shield_tool(
    ctx,
    files: str,  # JSON string: { "path/to/file.ts": "file contents...", ... }
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)

    try:
        file_map = json.loads(files) if isinstance(files, str) else files
    except json.JSONDecodeError:
        return {"status": "error", "error": "Invalid JSON in files parameter", "traceId": tid}

    all_findings: List[Dict[str, Any]] = []
    for filepath, content in file_map.items():
        findings = await _scan_with_agent_shield(str(content), filepath)
        all_findings.extend(findings)

    critical = [f for f in all_findings if f["severity"] == "critical"]
    high = [f for f in all_findings if f["severity"] == "high"]
    medium = [f for f in all_findings if f["severity"] == "medium"]

    return {
        "status": "success",
        "traceId": tid,
        "passed": len(critical) == 0,
        "totalFindings": len(all_findings),
        "criticalCount": len(critical),
        "highCount": len(high),
        "mediumCount": len(medium),
        "findings": all_findings[:50],  # cap at 50
        "summary": {
            "categories": list({f["category"] for f in all_findings}),
            "topSeverity": "critical" if critical else ("high" if high else ("medium" if medium else "none")),
        },
    }


# ─── MCP Tool: ECC Health ──────────────────────────────────────


@mcp_server.tool(
    name="vs_ecc_health",
    description="Check ECC integration status — skills loaded, rules available.",
)
@audit_tool
@require_scope("mcp:read")
async def vs_ecc_health_tool(
    ctx,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = _ensure_trace(trace_id)

    return {
        "status": "ok",
        "traceId": tid,
        "backend": "ecc-reference",
        "skillsLoaded": len(ECC_SKILLS_CATALOG),
        "agentShieldRules": len(AGENTSHIELD_RULES),
        "agentShieldCategories": list({r["category"] for r in AGENTSHIELD_RULES}),
        "note": "Using embedded reference catalog. Install ECC for full 249-skill library + 1,282 AgentShield tests.",
    }

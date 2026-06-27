"""Auto-generate VibeServe tool reference documentation from source AST.

Discovers all @mcp_server.tool() decorated functions in vibeserve/tools/,
extracts metadata, and generates MkDocs Markdown docs. Idempotent.
"""

from __future__ import annotations

import ast
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = PROJECT_ROOT / "vibeserve" / "tools"
DOCS_TOOLS_DIR = PROJECT_ROOT / "docs" / "tools"
MKDOCS_YML = PROJECT_ROOT / "mkdocs.yml"

CATEGORY_RULES: List[Tuple[str, str, List[str]]] = [
    # (category_label, slug, [name_prefixes])
    ("Core", "core", ["generate_ui_spec", "validate_ui_spec", "list_design_systems",
     "vs_schema_validate", "vs_validate_artifact", "vibe_compress", "vibe_health",
     "vs_ecc_health", "editor_config", "mcp"]),
    ("Code Generation", "code-generation", ["vibe_architect", "vibe_code", "vibe_design",
     "vs_generate_artifact", "vibe_upgrade_design", "vibe_build_pro"]),
    ("Code Review", "code-review", ["vibe_review", "vibe_verify", "vibe_audit",
     "vs_ecc_agent_shield", "vs_plan_review"]),
    ("Deployment", "deployment", ["vibe_deploy", "vibe_preview"]),
    ("Memory", "memory", ["vs_memory_get", "vs_memory_store", "memory_stats"]),
    ("Integration", "integration", ["supabase_", "vercel_", "github_", "vs_ecc_skills_list",
     "vs_opencode_execute", "gitnexus_", "codegraph_", "index_repo", "search_repo",
     "cross_repo_suggest", "find_test_gaps", "find_refactors", "list_indexed_repos"]),
    ("Pipeline", "pipeline", ["generate_plan", "retrieve_context", "read_file", "write_file",
     "check_node_env", "detect_package_manager", "run_install", "run_biome", "run_tsc",
     "run_build", "run_semgrep", "run_npm_audit", "run_playwright", "ingest_learning"]),
    ("Assessment", "assessment", ["vibe_benchmark", "vibe_test", "vibe_iterate"]),
    ("Agenda", "agenda", ["agenda_"]),
    ("Documentation", "documentation", ["vibe_docs"]),
]


def _assign_category(tool_name: str) -> Tuple[str, str]:
    for label, slug, prefixes in CATEGORY_RULES:
        for prefix in prefixes:
            if tool_name.startswith(prefix):
                return label, slug
    return "Other", "other"


def _type_hint_to_str(node: Optional[ast.expr]) -> Optional[str]:
    if node is None:
        return None
    return ast.unparse(node)


def _extract_docstring(node: ast.AsyncFunctionDef) -> Optional[str]:
    """Extract docstring from function body if present."""
    if (node.body and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)):
        val = node.body[0].value
        if isinstance(val.value, str):
            return val.value
    return None


def _clean_description(desc: str) -> str:
    """Normalize a tool description."""
    desc = desc.strip()
    if desc.endswith('.') or desc.endswith('。'):
        pass
    else:
        desc += '.'
    return desc[0].upper() + desc[1:] if desc else desc


def discover_tools() -> List[Dict[str, Any]]:
    """Scan vibeserve/tools/*.py for @mcp_server.tool() decorated functions."""
    tools: List[Dict[str, Any]] = []

    for py_file in sorted(TOOLS_DIR.glob("*.py")):
        module_name = py_file.stem
        if module_name.startswith("_"):
            continue  # skip private helpers

        source = py_file.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
                continue

            # Check decorators for mcp_server.tool
            tool_name = None
            tool_desc = None

            for decorator in node.decorator_list:
                call = None
                if isinstance(decorator, ast.Call):
                    # Direct: @mcp_server.tool(...)
                    call = decorator
                elif isinstance(decorator, ast.Attribute):
                    # Attribute access: mcp_server.tool
                    # Check if any decorator wraps it
                    continue

                if call is None:
                    continue

                # Check if it's mcp_server.tool(...)
                if not _is_mcp_tool_call(call):
                    continue

                # Extract kwargs
                for kw in call.keywords:
                    if kw.arg == "name" and isinstance(kw.value, ast.Constant):
                        val = kw.value.value
                        if isinstance(val, str) and "{" not in val:
                            tool_name = val
                    elif kw.arg == "description" and isinstance(kw.value, ast.Constant):
                        val = kw.value.value
                        if isinstance(val, str) and "{" not in val:
                            tool_desc = val

                if tool_name is not None:
                    break

            if tool_name is None:
                continue

            desc = tool_desc or ""
            if not desc:
                doc = _extract_docstring(node)
                if doc:
                    desc = doc.split("\n")[0].strip()
                    desc = _clean_description(desc)

            if not desc:
                desc = "No description provided."

            params = []
            for arg in node.args.args:
                pname = arg.arg
                ptype = _type_hint_to_str(arg.annotation)
                pdefault = None
                # Check for default value
                if node.args.defaults:
                    # defaults align with last N positional args
                    n_pos_with_defaults = len(node.args.defaults)
                    n_pos_total = len(node.args.args) - len(node.args.defaults)
                    arg_idx = node.args.args.index(arg)
                    if arg_idx >= n_pos_total:
                        default_idx = arg_idx - n_pos_total
                        try:
                            pdefault = ast.unparse(node.args.defaults[default_idx])
                        except Exception:
                            pdefault = None

                # Skip 'ctx' parameter (internal)
                if pname == "ctx":
                    continue

                params.append({
                    "name": pname,
                    "type": ptype or "Any",
                    "default": pdefault,
                })

            ret_type = _type_hint_to_str(node.returns) or "Dict[str, Any]"

            # Extract full docstring
            full_doc = _extract_docstring(node)
            summary = ""
            detail = ""
            if full_doc:
                parts = full_doc.strip().split("\n", 1)
                summary = parts[0].strip()
                if len(parts) > 1:
                    detail = parts[1].strip()

            category_label, category_slug = _assign_category(tool_name)

            tools.append({
                "name": tool_name,
                "description": desc,
                "summary": summary or desc,
                "detail": detail,
                "module": module_name,
                "params": params,
                "return_type": ret_type,
                "category": category_label,
                "category_slug": category_slug,
                "function_name": node.name,
            })

    # Sort by category then name
    tools.sort(key=lambda t: (t["category"], t["name"]))
    return tools


def _is_mcp_tool_call(call: ast.Call) -> bool:
    """Check if a Call node is mcp_server.tool(...)"""
    func = call.func
    # mcp_server.tool(...)
    if (isinstance(func, ast.Attribute)
            and func.attr == "tool"
            and isinstance(func.value, ast.Name)
            and func.value.id == "mcp_server"):
        return True
    return False


def generate_index(tools: List[Dict[str, Any]]) -> str:
    """Generate docs/tools/index.md"""
    lines = [
        "# AUTO-GENERATED — do not edit manually",
        "",
        "# VibeServe Tools Reference",
        "",
        "Auto-generated API documentation for all {} MCP tools.".format(len(tools)),
        "",
        "## Tools by Category",
        "",
    ]

    current_cat = None
    for t in tools:
        if t["category"] != current_cat:
            current_cat = t["category"]
            lines.append(f"### {current_cat}")
            lines.append("")

        safe_name = t["name"]
        lines.append(f"- [{safe_name}]({safe_name}.md) — {t['description']}")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"*Documentation generated from {len(tools)} tool definitions across "
                 f"{len(set(t['module'] for t in tools))} modules.*")

    return "\n".join(lines) + "\n"


def generate_tool_page(tool: Dict[str, Any]) -> str:
    """Generate a single tool page."""
    lines = [
        f"# `{tool['name']}`",
        "",
        f"_Category: {tool['category']} | Module: `vibeserve/tools/{tool['module']}.py`_",
        "",
        "## Description",
        "",
        tool["description"],
        "",
    ]

    if tool["detail"]:
        lines.extend([
            "### Details",
            "",
        ])
        for line in tool["detail"].split("\n"):
            stripped = line.strip()
            if stripped.startswith("Args:") or stripped.startswith("Returns:"):
                lines.append(f"**{stripped}**")
            elif stripped:
                lines.append(stripped)
        lines.append("")

    if tool["params"]:
        lines.extend([
            "## Parameters",
            "",
            "| Name | Type | Default |",
            "|------|------|---------|",
        ])
        for p in tool["params"]:
            default = f"`{p['default']}`" if p['default'] is not None else "*(required)*"
            lines.append(f"| `{p['name']}` | `{p['type']}` | {default} |")
        lines.append("")

    lines.extend([
        "## Returns",
        "",
        f"`{tool['return_type']}`",
        "",
        "## Source",
        "",
        f"Defined in `{tool['function_name']}()` in `vibeserve/tools/{tool['module']}.py`",
        "",
    ])

    return "\n".join(lines) + "\n"


def generate_mkdocs_yml(tools: List[Dict[str, Any]]) -> str:
    """Generate mkdocs.yml"""
    lines = [
        "# AUTO-GENERATED — do not edit manually",
        "site_name: VibeServe",
        "site_description: Agentic coding orchestrator for MCP — Tool Reference",
        "repo_url: https://github.com/ncsound919/VibeServe",
        "repo_name: ncsound919/VibeServe",
        "",
        "theme:",
        "  name: material",
        "  palette:",
        "    primary: black",
        "    accent: amber",
        "  features:",
        "    - navigation.sections",
        "    - navigation.expand",
        "    - search.suggest",
        "    - search.highlight",
        "",
        "plugins:",
        "  - search",
        "",
        "markdown_extensions:",
        "  - pymdownx.highlight",
        "  - pymdownx.superfences",
        "  - pymdownx.inlinehilite",
        "  - tables",
        "",
        "exclude_docs: |",
        "  designs/*",
        "  marketing/*",
        "  superpowers/*",
        "",
        "nav:",
        "  - Home: index.md",
        "  - Reference:",
        "    - Setup Guide: reference/SETUP.md",
        "    - Architecture: reference/ARCHITECTURE.md",
        "    - Audit Report: reference/AUDIT.md",
        "    - Deployment Guide: reference/DEPLOYMENT_GUIDE.md",
        "    - Agent Config: reference/AGENTS.md",
        "  - Tools:",
        f"    - Overview: tools/index.md",
    ]

    # Group by category
    categories: Dict[str, List[Dict]] = {}
    for t in tools:
        cat = t["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(t)

    cat_order = [
        "Core", "Code Generation", "Code Review", "Deployment",
        "Memory", "Integration", "Pipeline", "Assessment", "Agenda",
        "Documentation", "Other",
    ]

    for cat in cat_order:
        if cat not in categories:
            continue
        lines.append(f"    - {cat}:")
        for t in categories[cat]:
            lines.append(f"      - {t['name']}: tools/{t['name']}.md")
        # Add separator between categories
        lines.append("")

    return "\n".join(lines) + "\n"


def write_docs(tools: List[Dict[str, Any]]) -> None:
    """Write all generated docs to disk."""
    DOCS_TOOLS_DIR.mkdir(parents=True, exist_ok=True)

    # Write index
    index_path = DOCS_TOOLS_DIR / "index.md"
    index_content = generate_index(tools)
    index_path.write_text(index_content, encoding="utf-8")
    print(f"  Wrote {index_path}")

    # Write tool pages
    for tool in tools:
        page_path = DOCS_TOOLS_DIR / f"{tool['name']}.md"
        page_content = generate_tool_page(tool)
        page_path.write_text(page_content, encoding="utf-8")
    print(f"  Wrote {len(tools)} tool pages")

    # Write mkdocs.yml
    mkdocs_content = generate_mkdocs_yml(tools)
    MKDOCS_YML.write_text(mkdocs_content, encoding="utf-8")
    print(f"  Wrote {MKDOCS_YML}")


def audit_docstrings(tools: List[Dict[str, Any]]) -> None:
    """Report tools with missing or empty docstrings."""
    missing = [t for t in tools if not t["summary"] or t["description"] == "No description provided."]
    if missing:
        print(f"\n  Tools with no function docstring (using decorator description only): {len(missing)}")
        for t in missing:
            print(f"    - {t['name']} ({t['module']}.py)")
    else:
        print(f"\n  All {len(tools)} tools have decorator descriptions.")


def main():
    print("Discovering tools...")
    tools = discover_tools()
    print(f"Found {len(tools)} tools across {len(set(t['module'] for t in tools))} modules.")

    categories = {}
    for t in tools:
        cat = t["category"]
        categories.setdefault(cat, []).append(t)
    for cat, cat_tools in sorted(categories.items()):
        print(f"  {cat}: {len(cat_tools)} tools")

    audit_docstrings(tools)

    write_docs(tools)

    # Verify idempotency marker
    marker = DOCS_TOOLS_DIR / ".generated"
    marker.touch()
    print(f"\nDone. Generated docs for {len(tools)} tools in {DOCS_TOOLS_DIR}")
    print(f"MkDocs config written to {MKDOCS_YML}")


if __name__ == "__main__":
    main()

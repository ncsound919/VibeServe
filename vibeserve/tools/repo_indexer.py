"""VibeServe Repo Indexer — parse source files across repos, extract symbols,
components, and build times. Supports TypeScript, JavaScript, Python, and package.json.

Provides:
- Local repo indexing (files, symbols, components, dependencies)
- Cross-repo symbol search
- Reuse suggestions: "You have X in repo A; it would help in repo B"
- Test gap detection
"""

import ast
import json
import os
import re
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from vibeserve.server import mcp_server
from vibeserve.middleware import audit_tool

INDEX_CACHE_DIR = Path(os.getenv("VIBESERVE_INDEX_DIR", ".vibeserve/index"))


class Symbol(BaseModel):
    """A named code symbol found in a file."""
    name: str
    kind: str  # function, class, component, hook, interface, type, export, import
    file_path: str
    repo_key: str
    line: int = 0
    exported: bool = False
    signature: str = ""  # simplified signature string
    docstring: str = ""  # first line of doc/comment


class RepoIndex(BaseModel):
    repo_key: str
    repo_path: str
    repo_name: str
    indexed_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    symbols: List[Symbol] = Field(default_factory=list)
    test_files: List[str] = Field(default_factory=list)
    source_files: List[str] = Field(default_factory=list)
    dependencies: Dict[str, str] = Field(default_factory=dict)  # pkg → version
    scripts: Dict[str, str] = Field(default_factory=dict)  # npm/pip scripts
    build_config: Dict[str, Any] = Field(default_factory=dict)
    file_count: int = 0
    symbol_count: int = 0


class CrossRepoIndex:
    def __init__(self):
        self.repos: Dict[str, RepoIndex] = {}
        self._symbol_map: Dict[str, List[Symbol]] = defaultdict(list)
        INDEX_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._load_all()

    def _load_all(self):
        for f in INDEX_CACHE_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                ri = RepoIndex(**data)
                self.repos[ri.repo_key] = ri
                for s in ri.symbols:
                    self._symbol_map[s.name.lower()].append(s)
            except Exception:
                pass

    def _save(self, repo_key: str):
        if repo_key in self.repos:
            INDEX_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            (INDEX_CACHE_DIR / f"{repo_key}.json").write_text(
                json.dumps(self.repos[repo_key].model_dump(), indent=2, default=str))

    def index_repo(self, repo_path: str, repo_key: str = "",
                   repo_name: str = "") -> RepoIndex:
        path = Path(repo_path).resolve()
        if not repo_key:
            repo_key = path.name
        if not repo_name:
            repo_name = path.name

        ri = RepoIndex(repo_key=repo_key, repo_path=str(path), repo_name=repo_name)
        patterns = {
            ".ts": self._parse_ts,
            ".tsx": self._parse_tsx,
            ".js": self._parse_js,
            ".jsx": self._parse_jsx,
            ".py": self._parse_python,
        }
        ignore_dirs = {".git", "node_modules", "__pycache__", ".venv", "dist",
                       "build", ".next", ".turbo", "generated-apps", "test-results",
                       ".vibeserve", "uploads", ".aether_prime_cache", ".aether_prime_memory"}

        source_files = []
        test_files = []

        for ext, parser in patterns.items():
            for f in path.rglob(f"*{ext}"):
                parts = set(f.parts)
                if parts & ignore_dirs:
                    continue
                rel = f.relative_to(path)
                source_files.append(str(rel))
                try:
                    content = f.read_text(errors="replace")
                    symbols = parser(str(f), content, str(rel))
                    ri.symbols.extend(symbols)
                except Exception:
                    pass

        for test_pattern in ["**/test_*.py", "**/*_test.py", "**/*.test.ts",
                             "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx",
                             "**/tests/**/*.py", "**/tests/**/*.ts"]:
            for tf in path.glob(test_pattern):
                parts = set(tf.parts)
                if parts & ignore_dirs:
                    continue
                test_files.append(str(tf.relative_to(path)))

        pkg_json = path / "package.json"
        if pkg_json.exists() and pkg_json.stat().st_size < 5_000_000:
            try:
                pkg = json.loads(pkg_json.read_text())
                ri.dependencies = {k: v for k, v in pkg.get("dependencies", {}).items()
                                   if not k.startswith("@types/")}
                ri.scripts = pkg.get("scripts", {})
            except Exception:
                pass

        pyproject = path / "pyproject.toml"
        if pyproject.exists():
            try:
                content = pyproject.read_text()
                deps = re.findall(r'["\']([^"\']+)["\']', content)
                dep_map = {}
                for d in deps:
                    if ">=" in d:
                        name, ver = d.split(">=", 1)
                        dep_map[name.strip()] = ver.strip()
                ri.build_config["python_deps"] = dep_map
            except Exception:
                pass

        ri.source_files = source_files
        ri.test_files = test_files
        ri.file_count = len(source_files)
        ri.symbol_count = len(ri.symbols)

        self.repos[repo_key] = ri
        for s in ri.symbols:
            self._symbol_map[s.name.lower()].append(s)
        self._save(repo_key)
        return ri

    def search_symbols(self, query: str, repo_key: str = "") -> List[Dict[str, Any]]:
        results = []
        query_lower = query.lower()
        for name, symbols in self._symbol_map.items():
            if query_lower in name:
                for s in symbols:
                    if repo_key and s.repo_key != repo_key:
                        continue
                    results.append(s.model_dump())
        results.sort(key=lambda s: s["name"])
        return results[:50]

    def cross_repo_suggestions(self, source_repo: str = "") -> List[Dict[str, Any]]:
        suggestions = []
        if source_repo and source_repo not in self.repos:
            return suggestions

        source_symbols = set()
        if source_repo:
            source_symbols = {s.name.lower() for s in self.repos[source_repo].symbols}

        for repo_key, ri in self.repos.items():
            if repo_key == source_repo:
                continue
            for s in ri.symbols:
                if s.name.lower() not in source_symbols and s.exported:
                    suggestions.append({
                        "symbol": s.model_dump(),
                        "from_repo": repo_key,
                        "from_name": ri.repo_name,
                        "suggestion_type": "reuse",
                        "reasoning": f"'{s.name}' exported from {ri.repo_name} could be reused",
                    })
                    source_symbols.add(s.name.lower())

        return suggestions[:20]

    def find_test_gaps(self, repo_key: str = "") -> List[Dict[str, Any]]:
        gaps = []
        repos_to_check = [self.repos[repo_key]] if repo_key and repo_key in self.repos else self.repos.values()

        for ri in repos_to_check:
            test_map: Dict[str, bool] = {}
            for tf in ri.test_files:
                base = re.sub(r'(test_|_test|\.test|\.spec)', '', Path(tf).stem)
                test_map[base] = True

            for sf in ri.source_files:
                stem = Path(sf).stem
                if not test_map.get(stem):
                    for s in ri.symbols:
                        if s.file_path == sf and s.kind in ("function", "component", "class"):
                            gaps.append({
                                "file": sf,
                                "symbol": s.name,
                                "kind": s.kind,
                                "repo": ri.repo_name,
                                "repo_key": ri.repo_key,
                                "suggestion": f"Add tests for {s.kind} '{s.name}' in {sf}",
                            })
        return gaps[:30]

    def find_refactor_targets(self, repo_key: str = "") -> List[Dict[str, Any]]:
        targets = []
        repos_to_check = [self.repos[repo_key]] if repo_key and repo_key in self.repos else self.repos.values()

        for ri in repos_to_check:
            file_size_map: Dict[str, List[Symbol]] = defaultdict(list)
            for s in ri.symbols:
                file_size_map[s.file_path].append(s)

            for path, symbols in file_size_map.items():
                if len(symbols) > 15:
                    targets.append({
                        "file": path,
                        "repo": ri.repo_name,
                        "repo_key": ri.repo_key,
                        "symbol_count": len(symbols),
                        "suggestion_type": "split_file",
                        "reasoning": f"File has {len(symbols)} symbols — consider splitting",
                    })

            dup_map: Dict[str, List[str]] = defaultdict(list)
            for s in ri.symbols:
                if s.kind in ("function", "component"):
                    dup_map[s.name.lower()].append(s.file_path)
            for name, files in dup_map.items():
                if len(files) > 1:
                    targets.append({
                        "symbol": name,
                        "repo": ri.repo_name,
                        "repo_key": ri.repo_key,
                        "files": files,
                        "suggestion_type": "deduplicate",
                        "reasoning": f"'{name}' defined in {len(files)} files — deduplicate",
                    })

        return targets[:20]

    def _parse_ts(self, full_path: str, content: str, rel: str) -> List[Symbol]:
        symbols = []
        for m in re.finditer(r'export\s+(async\s+)?function\s+(\w+)', content):
            symbols.append(Symbol(name=m.group(2), kind="function", file_path=rel,
                                  repo_key="", line=content[:m.start()].count('\n') + 1,
                                  exported=True))
        for m in re.finditer(r'export\s+class\s+(\w+)', content):
            symbols.append(Symbol(name=m.group(1), kind="class", file_path=rel,
                                  repo_key="", line=content[:m.start()].count('\n') + 1,
                                  exported=True))
        for m in re.finditer(r'export\s+interface\s+(\w+)', content):
            symbols.append(Symbol(name=m.group(1), kind="interface", file_path=rel,
                                  repo_key="", line=content[:m.start()].count('\n') + 1,
                                  exported=True))
        for m in re.finditer(r'export\s+type\s+(\w+)', content):
            symbols.append(Symbol(name=m.group(1), kind="type", file_path=rel,
                                  repo_key="", line=content[:m.start()].count('\n') + 1,
                                  exported=True))
        for m in re.finditer(r'export\s+const\s+(\w+)', content):
            symbols.append(Symbol(name=m.group(1), kind="export", file_path=rel,
                                  repo_key="", line=content[:m.start()].count('\n') + 1,
                                  exported=True))
        return symbols

    def _parse_tsx(self, full_path: str, content: str, rel: str) -> List[Symbol]:
        symbols = self._parse_ts(full_path, content, rel)
        for m in re.finditer(r'(?:export\s+)?(?:default\s+)?function\s+(\w+)', content):
            name = m.group(1)
            if name[0].isupper():
                symbols.append(Symbol(name=name, kind="component", file_path=rel,
                                      repo_key="", line=content[:m.start()].count('\n') + 1,
                                      exported=True))
        for m in re.finditer(r'\buse(\w+)', content):
            hook_name = f"use{m.group(1)}"
            if not any(s.name == hook_name for s in symbols):
                symbols.append(Symbol(name=hook_name, kind="hook", file_path=rel,
                                      repo_key="", line=content[:m.start()].count('\n') + 1,
                                      exported=True))
        return symbols

    def _parse_js(self, full_path: str, content: str, rel: str) -> List[Symbol]:
        return self._parse_ts(full_path, content, rel)

    def _parse_jsx(self, full_path: str, content: str, rel: str) -> List[Symbol]:
        return self._parse_tsx(full_path, content, rel)

    def _parse_python(self, full_path: str, content: str, rel: str) -> List[Symbol]:
        symbols = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return symbols

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                symbols.append(Symbol(name=node.name, kind="function", file_path=rel,
                                      repo_key="", line=node.lineno, exported=not node.name.startswith("_")))
            elif isinstance(node, ast.ClassDef):
                symbols.append(Symbol(name=node.name, kind="class", file_path=rel,
                                      repo_key="", line=node.lineno, exported=not node.name.startswith("_")))
        return symbols


_cross_repo = CrossRepoIndex()


@mcp_server.tool(name="index_repo", description="Index a local repository — parses source files for symbols, components, tests, and dependencies.")
@audit_tool
async def index_repo(ctx, repo_path: str, repo_key: str = "",
                     repo_name: str = "") -> Dict[str, Any]:
    ri = _cross_repo.index_repo(repo_path=repo_path, repo_key=repo_key, repo_name=repo_name)
    return {
        "status": "ok",
        "repo_key": ri.repo_key,
        "repo_name": ri.repo_name,
        "file_count": ri.file_count,
        "symbol_count": ri.symbol_count,
        "test_count": len(ri.test_files),
        "script_count": len(ri.scripts),
        "top_symbols": [s.model_dump() for s in ri.symbols[:20]],
    }


@mcp_server.tool(name="search_repo", description="Search indexed symbols across all repos, or within a specific repo.")
@audit_tool
async def search_repo(ctx, query: str, repo_key: str = "") -> Dict[str, Any]:
    results = _cross_repo.search_symbols(query=query, repo_key=repo_key)
    return {"status": "ok", "query": query, "count": len(results), "results": results}


@mcp_server.tool(name="cross_repo_suggest", description="Find reusable components/symbols from other repos that could help the current repo.")
@audit_tool
async def cross_repo_suggest(ctx, source_repo: str = "") -> Dict[str, Any]:
    suggestions = _cross_repo.cross_repo_suggestions(source_repo=source_repo)
    return {"status": "ok", "count": len(suggestions), "suggestions": suggestions}


@mcp_server.tool(name="find_test_gaps", description="Find source files and symbols that have no corresponding tests.")
@audit_tool
async def find_test_gaps(ctx, repo_key: str = "") -> Dict[str, Any]:
    gaps = _cross_repo.find_test_gaps(repo_key=repo_key)
    return {"status": "ok", "count": len(gaps), "gaps": gaps}


@mcp_server.tool(name="find_refactors", description="Find refactor candidates: large files, duplicated symbols, dead code hints.")
@audit_tool
async def find_refactors(ctx, repo_key: str = "") -> Dict[str, Any]:
    targets = _cross_repo.find_refactor_targets(repo_key=repo_key)
    return {"status": "ok", "count": len(targets), "targets": targets}


@mcp_server.tool(name="list_indexed_repos", description="List all repos that have been indexed.")
@audit_tool
async def list_indexed_repos(ctx) -> Dict[str, Any]:
    repos = []
    for rk, ri in _cross_repo.repos.items():
        repos.append({
            "repo_key": rk,
            "repo_name": ri.repo_name,
            "file_count": ri.file_count,
            "symbol_count": ri.symbol_count,
            "indexed_at": ri.indexed_at,
        })
    return {"status": "ok", "count": len(repos), "repos": repos}

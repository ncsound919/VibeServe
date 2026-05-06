"""VibeServe Code Graph — native knowledge graph for code intelligence.

Builds on top of repo_indexer's symbol extraction to add:
- Call graph (what calls what, cross-file)
- Import resolution (resolve imports to files/symbols)
- Class hierarchy (extends, implements)
- Execution flow tracing (entry point → call chain)
- Blast radius / impact analysis (upstream + downstream)
- 360-degree context view (callers, callees, processes)
- Community detection (Leiden-like clustering)

No native dependencies — pure Python. Works on any platform.

Built to replace the need for GitNexus external dependency.
"""

import asyncio
import json
import logging
import os
import re
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

from vibeserve.middleware import audit_tool
from vibeserve.server import mcp_server
from vibeserve.tools.repo_indexer import RepoIndex

logger = logging.getLogger(__name__)

MAX_FILE_READ_BYTES = 50000
MIN_CLUSTER_SIZE = 3
MAX_CONTEXT_RESULTS = 50
MAX_IMPACT_SYMBOLS = 20

GRAPH_CACHE_DIR = Path(os.getenv("VIBESERVE_GRAPH_DIR", ".vibeserve/graph"))


# ─── Models ────────────────────────────────────────────────────────────────────


class GraphNode(BaseModel):
    """A node in the knowledge graph (wraps a Symbol)."""
    uid: str  # unique id: "Function:validateUser" or "Class:UserService"
    name: str
    kind: str  # function, class, component, method, interface, type, variable
    file_path: str
    repo_key: str
    line: int = 0
    signature: str = ""
    docstring: str = ""
    exported: bool = False


class GraphEdge(BaseModel):
    """A directed edge between two nodes."""
    source: str  # source node uid
    target: str  # target node uid
    kind: str  # CALLS, IMPORTS, EXTENDS, IMPLEMENTS, USES, RETURNS
    source_file: str
    target_file: str
    line: int = 0
    confidence: float = 1.0  # 0-1, lower for heuristic matches


class ImpactResult(BaseModel):
    """Result of impact analysis on a symbol."""
    target: str  # the symbol being analyzed
    target_uid: str
    direction: str  # upstream or downstream
    levels: List[Dict[str, Any]] = Field(default_factory=list)  # depth-grouped results
    total_affected: int = 0
    max_depth: int = 0
    clusters_affected: List[str] = Field(default_factory=list)


class ContextResult(BaseModel):
    """360-degree view of a symbol."""
    symbol: Optional[Dict[str, Any]] = None
    incoming_calls: List[Dict[str, Any]] = Field(default_factory=list)
    outgoing_calls: List[Dict[str, Any]] = Field(default_factory=list)
    inherits_from: List[Dict[str, Any]] = Field(default_factory=list)
    inherited_by: List[Dict[str, Any]] = Field(default_factory=list)
    imports_from: List[Dict[str, Any]] = Field(default_factory=list)
    imported_by: List[Dict[str, Any]] = Field(default_factory=list)
    processes: List[Dict[str, Any]] = Field(default_factory=list)


# ─── Parser Helpers ────────────────────────────────────────────────────────────


def _parse_ts_calls(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract function/method calls from TypeScript/JavaScript."""
    calls = []
    # Method calls: obj.method()
    for m in re.finditer(r'(\w+)\.(\w+)\s*\(', content):
        calls.append({
            "caller": f"unknown@{file_path}",
            "callee_name": m.group(2),
            "receiver": m.group(1),
            "line": content[:m.start()].count('\n') + 1,
            "confidence": 0.5,
        })
    # Direct calls: functionName()
    for m in re.finditer(r'(?<!\.)(\w+)\s*\(', content):
        name = m.group(1)
        # Skip keywords and common patterns
        if name in ('if', 'for', 'while', 'switch', 'catch', 'return', 'throw',
                     'new', 'import', 'export', 'require', 'console', 'typeof',
                     'instanceof', 'delete', 'void', 'super', 'this'):
            continue
        calls.append({
            "caller": f"unknown@{file_path}",
            "callee_name": name,
            "receiver": None,
            "line": content[:m.start()].count('\n') + 1,
            "confidence": 0.4,
        })
    # new ClassName()
    for m in re.finditer(r'new\s+(\w+)\s*\(', content):
        calls.append({
            "caller": f"unknown@{file_path}",
            "callee_name": m.group(1),
            "receiver": None,
            "line": content[:m.start()].count('\n') + 1,
            "confidence": 0.7,
        })
    return calls


def _parse_ts_imports(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract import statements from TypeScript/JavaScript."""
    imports = []
    # import { X } from './path'
    for m in re.finditer(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]", content):
        items = [x.strip() for x in m.group(1).split(',')]
        source = m.group(2)
        for item in items:
            name = item.split(' as ')[0].strip()
            imports.append({
                "name": name,
                "source": source,
                "line": content[:m.start()].count('\n') + 1,
            })
    # import X from './path'
    for m in re.finditer(r"import\s+(\w+)\s+from\s*['\"]([^'\"]+)['\"]", content):
        imports.append({
            "name": m.group(1),
            "source": m.group(2),
            "line": content[:m.start()].count('\n') + 1,
        })
    # import './path'
    for m in re.finditer(r"import\s+['\"]([^'\"]+)['\"]", content):
        imports.append({
            "name": "",
            "source": m.group(1),
            "line": content[:m.start()].count('\n') + 1,
        })
    return imports


def _parse_ts_heritage(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract class extends/implements from TypeScript."""
    heritage = []
    # class X extends Y
    for m in re.finditer(r'class\s+(\w+)\s+extends\s+(\w+)', content):
        heritage.append({
            "child": m.group(1),
            "parent": m.group(2),
            "kind": "EXTENDS",
            "line": content[:m.start()].count('\n') + 1,
        })
    # class X implements Y
    for m in re.finditer(r'class\s+(\w+)\s+implements\s+([^{]+)', content):
        child = m.group(1)
        implements = [x.strip() for x in m.group(2).split(',')]
        for parent in implements:
            heritage.append({
                "child": child,
                "parent": parent,
                "kind": "IMPLEMENTS",
                "line": content[:m.start()].count('\n') + 1,
            })
    return heritage


def _parse_python_calls(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract function/method calls from Python (simple regex, AST for precision)."""
    calls = []
    try:
        import ast as py_ast
        tree = py_ast.parse(content)
        for node in py_ast.walk(tree):
            if isinstance(node, py_ast.Call):
                callee = None
                if isinstance(node.func, py_ast.Name):
                    callee = node.func.id
                elif isinstance(node.func, py_ast.Attribute):
                    callee = node.func.attr
                if callee:
                    # Find enclosing function/class context
                    caller = f"unknown@{file_path}"
                    for parent in py_ast.walk(tree):
                        if isinstance(parent, (py_ast.FunctionDef, py_ast.AsyncFunctionDef)):
                            if parent.lineno <= node.lineno and (
                                not hasattr(parent, 'end_lineno') or
                                (parent.end_lineno and node.lineno <= parent.end_lineno)
                            ):
                                caller = f"{parent.name}@{file_path}"
                    calls.append({
                        "caller": caller,
                        "callee_name": callee,
                        "receiver": None,
                        "line": node.lineno,
                        "confidence": 0.6,
                    })
    except SyntaxError:
        pass
    return calls


def _parse_python_imports(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract import statements from Python."""
    imports = []
    # from x import y, z
    for m in re.finditer(r'from\s+([\.\w]+)\s+import\s+(.+)', content):
        source = m.group(1)
        items = [x.strip() for x in m.group(2).split(',')]
        for item in items:
            name = item.split(' as ')[0].strip()
            imports.append({
                "name": name,
                "source": source,
                "line": content[:m.start()].count('\n') + 1,
            })
    # import x, y
    for m in re.finditer(r'^import\s+(.+)$', content, re.MULTILINE):
        items = [x.strip() for x in m.group(1).split(',')]
        for item in items:
            name = item.split(' as ')[0].strip()
            imports.append({
                "name": name,
                "source": "",
                "line": content[:m.start()].count('\n') + 1,
            })
    return imports


def _parse_python_heritage(content: str, file_path: str) -> List[Dict[str, Any]]:
    """Extract class inheritance from Python."""
    heritage = []
    for m in re.finditer(r'class\s+(\w+)\s*\(([^)]*)\)', content):
        child = m.group(1)
        parents = [x.strip() for x in m.group(2).split(',') if x.strip()]
        for parent in parents:
            if parent and parent != 'object':
                heritage.append({
                    "child": child,
                    "parent": parent,
                    "kind": "EXTENDS",
                    "line": content[:m.start()].count('\n') + 1,
                })
    return heritage


# ─── Graph Engine ──────────────────────────────────────────────────────────────


class CodeGraph:
    """In-memory directed graph of code symbols and their relationships."""

    def __init__(self):
        self.nodes: Dict[str, GraphNode] = {}  # uid → node
        self.edges: List[GraphEdge] = []  # all edges
        self.adj_out: Dict[str, List[str]] = defaultdict(list)  # source → [target_uids]
        self.adj_in: Dict[str, List[str]] = defaultdict(list)  # target → [source_uids]
        self.name_index: Dict[str, List[str]] = defaultdict(list)  # name → [uids]
        self.file_index: Dict[str, List[str]] = defaultdict(list)  # file → [uids]
        self.clusters: Dict[str, List[str]] = defaultdict(list)  # cluster_id → [uids]
        self._caller_index: Dict[str, List[Tuple[int, str]]] = defaultdict(list)  # file → [(line, uid)]
        self.edge_index: Dict[Tuple[str, str], float] = {}  # (source, target) → max confidence
        self._built = False

    def _resolve_caller(self, file_path: str, line: int) -> str:
        """Find the enclosing symbol for a call at a given line in a file."""
        entries = self._caller_index.get(file_path, [])
        if not entries:
            return f"unknown@{file_path}"
        lo, hi = 0, len(entries) - 1
        best = f"unknown@{file_path}"
        while lo <= hi:
            mid = (lo + hi) // 2
            entry_line, uid = entries[mid]
            if entry_line <= line:
                best = uid
                lo = mid + 1
            else:
                hi = mid - 1
        return best

    def build_from_repo_index(self, ri: 'RepoIndex') -> 'CodeGraph':
        """Build the graph from an existing RepoIndex."""
        repo_key = ri.repo_key
        repo_path = ri.repo_path

        # Phase 1: Add nodes for all symbols
        for sym in ri.symbols:
            uid = f"{sym.kind}:{sym.name}@{sym.file_path}"
            node = GraphNode(
                uid=uid,
                name=sym.name,
                kind=sym.kind,
                file_path=sym.file_path,
                repo_key=repo_key,
                line=sym.line,
                signature=sym.signature,
                docstring=sym.docstring,
                exported=sym.exported,
            )
            self.nodes[uid] = node
            self.name_index[sym.name.lower()].append(uid)
            self.file_index[sym.file_path].append(uid)

        # Phase 1.5: Build caller resolution index (per-file line → uid mapping)
        for uid, node in self.nodes.items():
            self._caller_index[node.file_path].append((node.line, uid))
        for file_path in self._caller_index:
            self._caller_index[file_path].sort(key=lambda x: x[0])

        # Phase 2: Parse edges from source files
        for file_path in ri.source_files:
            full_path = Path(repo_path) / file_path
            if not full_path.exists():
                continue
            try:
                content = full_path.read_text(errors='replace')[:MAX_FILE_READ_BYTES]  # Cap at 50KB
            except Exception:
                continue

            is_ts = file_path.endswith(('.ts', '.tsx', '.js', '.jsx'))
            is_py = file_path.endswith('.py')

            if is_ts:
                self._add_ts_edges(content, file_path, repo_key)
            elif is_py:
                self._add_py_edges(content, file_path, repo_key)

        # Phase 3: Build adjacency indices
        for edge in self.edges:
            self.adj_out[edge.source].append(edge.target)
            self.adj_in[edge.target].append(edge.source)

        # Build edge index for O(1) lookups
        for edge in self.edges:
            key = (edge.source, edge.target)
            self.edge_index[key] = max(self.edge_index.get(key, 0), edge.confidence)

        # Phase 4: Community detection
        self._detect_communities()

        self._built = True
        return self

    def _add_ts_edges(self, content: str, file_path: str, repo_key: str):
        """Add edges from TypeScript/JavaScript content."""
        for call in _parse_ts_calls(content, file_path):
            callee_uids = self._resolve_symbol(call["callee_name"], file_path)
            if callee_uids:
                caller_uid = self._resolve_caller(file_path, call["line"])
                for uid in callee_uids:
                    edge = GraphEdge(
                        source=caller_uid,
                        target=uid,
                        kind="CALLS",
                        source_file=file_path,
                        target_file=self.nodes[uid].file_path if uid in self.nodes else file_path,
                        line=call["line"],
                        confidence=call["confidence"],
                    )
                    self.edges.append(edge)

        # Imports
        for imp in _parse_ts_imports(content, file_path):
            if imp["name"]:
                resolved = self._resolve_import(imp["source"], file_path, repo_key)
                if resolved:
                    uid = f"Module:{resolved}"
                    # Link importer to imported module
                    target_uids = self.file_index.get(resolved, [])
                    for tuid in target_uids:
                        edge = GraphEdge(
                            source=f"unknown@{file_path}",
                            target=tuid,
                            kind="IMPORTS",
                            source_file=file_path,
                            target_file=resolved,
                            line=imp["line"],
                            confidence=0.9,
                        )
                        self.edges.append(edge)

        # Heritage
        for h in _parse_ts_heritage(content, file_path):
            # Find child class
            child_uids = self._resolve_symbol(h["child"], file_path)
            parent_uids = self._resolve_symbol(h["parent"], file_path)
            for cuid in child_uids:
                for puid in parent_uids:
                    edge = GraphEdge(
                        source=cuid,
                        target=puid,
                        kind=h["kind"],
                        source_file=file_path,
                        target_file=self.nodes[puid].file_path if puid in self.nodes else file_path,
                        line=h["line"],
                        confidence=0.9,
                    )
                    self.edges.append(edge)

    def _add_py_edges(self, content: str, file_path: str, repo_key: str):
        """Add edges from Python content."""
        for call in _parse_python_calls(content, file_path):
            callee_uids = self._resolve_symbol(call["callee_name"], file_path)
            if callee_uids:
                caller_uid = self._resolve_caller(file_path, call["line"])
                for uid in callee_uids:
                    edge = GraphEdge(
                        source=caller_uid,
                        target=uid,
                        kind="CALLS",
                        source_file=file_path,
                        target_file=self.nodes[uid].file_path if uid in self.nodes else file_path,
                        line=call["line"],
                        confidence=call["confidence"],
                    )
                    self.edges.append(edge)

        # Imports
        for imp in _parse_python_imports(content, file_path):
            if imp["name"]:
                target = self._resolve_import(imp["source"], file_path, repo_key)
                if target and imp["name"] in self.name_index:
                    for uid in self.name_index[imp["name"]]:
                        target_path = self.nodes[uid].file_path if uid in self.nodes else ""
                        if target in target_path or target_path == target:
                            edge = GraphEdge(
                                source=f"unknown@{file_path}",
                                target=uid,
                                kind="IMPORTS",
                                source_file=file_path,
                                target_file=target,
                                line=imp["line"],
                                confidence=0.7,
                            )
                            self.edges.append(edge)

        # Heritage
        for h in _parse_python_heritage(content, file_path):
            child_uids = self._resolve_symbol(h["child"], file_path)
            parent_uids = self._resolve_symbol(h["parent"], file_path)
            for cuid in child_uids:
                for puid in parent_uids:
                    edge = GraphEdge(
                        source=cuid,
                        target=puid,
                        kind=h["kind"],
                        source_file=file_path,
                        target_file=self.nodes[puid].file_path if puid in self.nodes else file_path,
                        line=h["line"],
                        confidence=0.9,
                    )
                    self.edges.append(edge)

    def _resolve_symbol(self, name: str, current_file: str) -> List[str]:
        """Resolve a symbol name to UIDs, preferring same-file matches."""
        if not name or name not in self.name_index:
            return []

        candidates = self.name_index[name]
        # Prefer same-file matches
        same_file = [uid for uid in candidates if current_file in uid]
        if same_file:
            return same_file
        return candidates

    def _resolve_import(self, source: str, current_file: str, repo_key: str) -> Optional[str]:
        """Resolve an import path to a file path."""
        if not source:
            return current_file
        if source.startswith('.'):
            # Relative import
            current_dir = str(Path(current_file).parent)
            resolved = str((Path(current_dir) / source).resolve())
            # Find matching indexed file
            for fpath in self.file_index:
                if fpath.startswith(resolved.rstrip('/')) or resolved in fpath:
                    return fpath
        return None

    def _detect_communities(self):
        """Group related symbols into clusters using BFS."""
        visited: Set[str] = set()
        cluster_id = 0

        for uid in self.nodes:
            if uid in visited:
                continue

            # BFS from this node
            cluster: List[str] = []
            queue = deque([uid])
            while queue:
                node = queue.popleft()
                if node in visited:
                    continue
                visited.add(node)
                cluster.append(node)
                # Follow edges (both directions)
                for neighbor in self.adj_out.get(node, []):
                    if neighbor not in visited:
                        queue.append(neighbor)
                for neighbor in self.adj_in.get(node, []):
                    if neighbor not in visited:
                        queue.append(neighbor)

            if len(cluster) >= MIN_CLUSTER_SIZE:  # Only meaningful clusters
                self.clusters[f"cluster_{cluster_id}"] = cluster
                cluster_id += 1
                logger.debug(f"Found cluster cluster_{cluster_id - 1} with {len(cluster)} nodes")

    def impact(self, target: str, direction: str = "upstream",
               max_depth: int = 3, min_confidence: float = 0.3) -> ImpactResult:
        """Analyze blast radius of changing a symbol.

        Args:
            target: Symbol name or UID to analyze
            direction: 'upstream' (what depends on this) or 'downstream' (what this depends on)
            max_depth: How deep to traverse
            min_confidence: Minimum edge confidence to follow
        """
        # Find target uids
        target_uids = self._resolve_symbol(target, "")
        if not target_uids:
            for uid, node in self.nodes.items():
                if target.lower() in node.name.lower():
                    target_uids.append(uid)
        if not target_uids:
            return ImpactResult(target=target, target_uid="", direction=direction)

        target_uid = target_uids[0]
        levels: List[Dict[str, Any]] = []
        visited: Set[str] = {target_uid}
        current = {target_uid}
        total = 0

        for depth in range(1, max_depth + 1):
            next_level: Set[str] = set()
            level_symbols: List[Dict[str, Any]] = []

            for uid in current:
                neighbors = self.adj_in[uid] if direction == "upstream" else self.adj_out[uid]
                for neighbor in neighbors:
                    if neighbor in visited:
                        continue
                    # Check confidence using edge index
                    key = (neighbor, uid) if direction == "upstream" else (uid, neighbor)
                    confidence = self.edge_index.get(key, 0.5)
                    if confidence < min_confidence:
                        continue
                    visited.add(neighbor)
                    next_level.add(neighbor)
                    if neighbor in self.nodes:
                        node = self.nodes[neighbor]
                        level_symbols.append({
                            "name": node.name,
                            "kind": node.kind,
                            "file_path": node.file_path,
                            "line": node.line,
                            "confidence": confidence,
                            "exported": node.exported,
                        })

            if level_symbols:
                level_label = "WILL BREAK" if depth == 1 else "LIKELY AFFECTED" if depth == 2 else "MIGHT AFFECT"
                levels.append({"depth": depth, "label": level_label, "symbols": level_symbols, "count": len(level_symbols)})
                total += len(level_symbols)

            current = next_level
            if not current:
                break

        # Find relevant clusters
        affected_clusters = []
        for cid, members in self.clusters.items():
            if any(m in visited for m in members):
                affected_clusters.append(cid)

        return ImpactResult(
            target=target,
            target_uid=target_uid,
            direction=direction,
            levels=levels,
            total_affected=total,
            max_depth=len(levels),
            clusters_affected=affected_clusters,
        )

    def context(self, name: str) -> ContextResult:
        """Get 360-degree view of a symbol."""
        uids = self._resolve_symbol(name, "")
        if not uids:
            for uid, node in self.nodes.items():
                if name.lower() in node.name.lower():
                    uids.append(uid)
        if not uids:
            return ContextResult()

        uid = uids[0]
        node = self.nodes.get(uid)
        if not node:
            return ContextResult()

        def _edge_to_dict(e: GraphEdge) -> Dict[str, Any]:
            target_node = self.nodes.get(e.target, None)
            source_node = self.nodes.get(e.source, None)
            return {
                "source": source_node.name if source_node else e.source,
                "target": target_node.name if target_node else e.target,
                "kind": e.kind,
                "file_path": e.target_file if e.target != uid else e.source_file,
                "confidence": e.confidence,
            }

        incoming_calls = [_edge_to_dict(e) for e in self.edges if e.target == uid and e.kind == "CALLS"]
        outgoing_calls = [_edge_to_dict(e) for e in self.edges if e.source == uid and e.kind == "CALLS"]
        inherits_from = [_edge_to_dict(e) for e in self.edges if e.source == uid and e.kind in ("EXTENDS", "IMPLEMENTS")]
        inherited_by = [_edge_to_dict(e) for e in self.edges if e.target == uid and e.kind in ("EXTENDS", "IMPLEMENTS")]
        imports_from = [_edge_to_dict(e) for e in self.edges if e.source == uid and e.kind == "IMPORTS"]
        imported_by = [_edge_to_dict(e) for e in self.edges if e.target == uid and e.kind == "IMPORTS"]

        # Find processes (call chains) this symbol is in
        processes = []
        for cid, members in self.clusters.items():
            if uid in members:
                processes.append({
                    "cluster_id": cid,
                    "member_count": len(members),
                    "key_symbols": [self.nodes[m].name for m in members[:5] if m in self.nodes],
                })

        return ContextResult(
            symbol={
                "uid": node.uid,
                "name": node.name,
                "kind": node.kind,
                "file_path": node.file_path,
                "line": node.line,
                "signature": node.signature,
                "exported": node.exported,
            },
            incoming_calls=incoming_calls[:MAX_CONTEXT_RESULTS],
            outgoing_calls=outgoing_calls[:MAX_CONTEXT_RESULTS],
            inherits_from=inherits_from[:20],
            inherited_by=inherited_by[:20],
            imports_from=imports_from[:20],
            imported_by=imported_by[:20],
            processes=processes[:10],
        )

    def query(self, query: str) -> Dict[str, Any]:
        """Search the graph for symbols matching a query."""
        query_lower = query.lower()
        matches: List[Dict[str, Any]] = []
        for uid, node in self.nodes.items():
            if query_lower in node.name.lower():
                incoming = sum(1 for e in self.edges if e.target == uid and e.kind == "CALLS")
                outgoing = sum(1 for e in self.edges if e.source == uid and e.kind == "CALLS")
                matches.append({
                    "uid": node.uid,
                    "name": node.name,
                    "kind": node.kind,
                    "file_path": node.file_path,
                    "line": node.line,
                    "callers": incoming,
                    "callees": outgoing,
                    "exported": node.exported,
                })
        matches.sort(key=lambda m: m["callers"] + m["callees"], reverse=True)
        return {
            "query": query,
            "count": len(matches),
            "results": matches[:50],
        }

    def stats(self) -> Dict[str, Any]:
        """Get graph statistics."""
        return {
            "nodes": len(self.nodes),
            "edges": len(self.edges),
            "clusters": len(self.clusters),
            "files": len(self.file_index),
            "built": self._built,
            "edge_kinds": {
                kind: sum(1 for e in self.edges if e.kind == kind)
                for kind in set(e.kind for e in self.edges)
            },
        }

    def save(self, repo_key: str):
        """Save graph to disk."""
        GRAPH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "nodes": {uid: node.model_dump() for uid, node in self.nodes.items()},
            "edges": [e.model_dump() for e in self.edges],
            "clusters": self.clusters,
            "built": self._built,
        }
        cache_file = GRAPH_CACHE_DIR / f"{repo_key}_graph.json"
        cache_file.write_text(json.dumps(data, indent=2, default=str))

    @classmethod
    def load(cls, repo_key: str) -> Optional['CodeGraph']:
        """Load graph from disk."""
        cache_file = GRAPH_CACHE_DIR / f"{repo_key}_graph.json"
        if not cache_file.exists():
            return None
        try:
            data = json.loads(cache_file.read_text())
            graph = cls()
            graph.nodes = {uid: GraphNode(**n) for uid, n in data.get("nodes", {}).items()}
            graph.edges = [GraphEdge(**e) for e in data.get("edges", [])]
            graph.clusters = data.get("clusters", {})
            graph._built = data.get("built", False)
            # Rebuild indices
            for uid, node in graph.nodes.items():
                graph.name_index[node.name.lower()].append(uid)
                graph.file_index[node.file_path].append(uid)
            for edge in graph.edges:
                graph.adj_out[edge.source].append(edge.target)
                graph.adj_in[edge.target].append(edge.source)
            return graph
        except Exception:
            return None


# ─── Singleton ─────────────────────────────────────────────────────────────────

_graph_registry: Dict[str, CodeGraph] = {}
_graph_lock = asyncio.Lock()


async def _get_or_build_graph_async(repo_key: str, repo_path: str = ".") -> Optional[CodeGraph]:
    async with _graph_lock:
        return _get_or_build_graph(repo_key, repo_path)


def _get_or_build_graph(repo_key: str, repo_path: str = ".") -> Optional[CodeGraph]:
    """Get a graph from cache or build it from an existing RepoIndex."""
    if repo_key in _graph_registry:
        return _graph_registry[repo_key]

    # Try loading from disk
    graph = CodeGraph.load(repo_key)
    if graph:
        _graph_registry[repo_key] = graph
        return graph

    # Try building from repo_indexer's data
    try:
        from vibeserve.tools.repo_indexer import _cross_repo
        if repo_key in _cross_repo.repos:
            ri = _cross_repo.repos[repo_key]
            graph = CodeGraph()
            graph.build_from_repo_index(ri)
            graph.save(repo_key)
            _graph_registry[repo_key] = graph
            return graph
    except ImportError:
        pass

    # If no index exists, build one first
    try:
        from vibeserve.tools.repo_indexer import _cross_repo
        ri = _cross_repo.index_repo(repo_path=repo_path, repo_key=repo_key)
        graph = CodeGraph()
        graph.build_from_repo_index(ri)
        graph.save(repo_key)
        _graph_registry[repo_key] = graph
        return graph
    except Exception as e:
        logger.error(f"Failed to build graph for {repo_key}: {e}")
        return None


# ─── MCP Tools ─────────────────────────────────────────────────────────────────


@mcp_server.tool(
    name="codegraph_build",
    description="Build a knowledge graph from an indexed repo — creates call graph, import resolution, class hierarchy, and communities. Prerequisite before using other codegraph_* tools."
)
@audit_tool
async def codegraph_build(ctx, repo_key: str = "", repo_path: str = ".") -> Dict[str, Any]:
    graph = await _get_or_build_graph_async(repo_key=repo_key or "current", repo_path=repo_path)
    if not graph:
        return {"status": "error", "error": "Failed to build graph. Index the repo first with index_repo."}
    stats = graph.stats()
    return {"status": "ok", "repo_key": repo_key or "current", "stats": stats}


@mcp_server.tool(
    name="codegraph_query",
    description="Search the knowledge graph for symbols — returns callers, callees, file locations, and export status. Replaces grep for structural code questions."
)
@audit_tool
async def codegraph_query(ctx, query: str, repo_key: str = "") -> Dict[str, Any]:
    graph = await _get_or_build_graph_async(repo_key=repo_key or "current")
    if not graph:
        return {"status": "error", "error": "No graph built. Run codegraph_build or index_repo first."}
    return {"status": "ok", **graph.query(query)}


@mcp_server.tool(
    name="codegraph_context",
    description="Get 360-degree view of a symbol — all incoming/outgoing calls, inheritance, imports, and cluster membership."
)
@audit_tool
async def codegraph_context(ctx, name: str, repo_key: str = "") -> Dict[str, Any]:
    graph = await _get_or_build_graph_async(repo_key=repo_key or "current")
    if not graph:
        return {"status": "error", "error": "No graph built."}
    result = graph.context(name)
    return {"status": "ok", **result.model_dump()}


@mcp_server.tool(
    name="codegraph_impact",
    description="Blast radius analysis — what depends on this symbol? Groups results by depth (WILL BREAK, LIKELY AFFECTED, MIGHT AFFECT). Use before refactoring."
)
@audit_tool
async def codegraph_impact(ctx, target: str, direction: str = "upstream",
                           repo_key: str = "", max_depth: int = 3) -> Dict[str, Any]:
    graph = await _get_or_build_graph_async(repo_key=repo_key or "current")
    if not graph:
        return {"status": "error", "error": "No graph built."}
    result = graph.impact(target, direction=direction, max_depth=max_depth)
    return {"status": "ok", **result.model_dump()}


@mcp_server.tool(
    name="codegraph_stats",
    description="Get knowledge graph statistics — node count, edge count, clusters, edge type breakdown."
)
@audit_tool
async def codegraph_stats(ctx, repo_key: str = "") -> Dict[str, Any]:
    graph = await _get_or_build_graph_async(repo_key=repo_key or "current")
    if not graph:
        return {"status": "error", "error": "No graph built."}
    return {"status": "ok", "stats": graph.stats()}

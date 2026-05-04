/**
 * Graphify Integration — Codebase Knowledge Graph Service
 *
 * Wraps graphify (Python) to build/query knowledge graphs from codebases.
 * Reduces token usage by up to 71.5x for codebase recall — instead of reading
 * entire files, LLMs query a compact graph.json (nodes, edges, communities).
 *
 * Install: pip install graphifyy && graphify install
 */
import { execSync, exec, execFile } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const GRAPH_CACHE = path.join(DATA_DIR, "graphify");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(GRAPH_CACHE)) mkdirSync(GRAPH_CACHE, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  language: string;
  file: string;
  line: number;
  docstring?: string;
  children?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: Array<{ id: string; nodes: string[]; label?: string }>;
  metadata: { totalNodes: number; totalEdges: number; languages: string[]; timestamp: string };
}

export interface GraphifyResult {
  graph: KnowledgeGraph | null;
  wikiPath: string;
  reportPath: string;
  nodeCount: number;
  edgeCount: number;
  communityCount: number;
  tokenSavings: string;
  timestamp: string;
}

// ─── Subprocess Wrapper ───────────────────────────────────────────────────────

function graphifyAvailable(): boolean {
  try {
    execSync("graphify --version", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function runGraphify(
  targetPath: string,
  mode: "ast" | "deep" = "ast"
): Promise<{ ok: boolean; output: string; error: string }> {
  const args = mode === "deep" ? [targetPath, "--mode", "deep"] : [targetPath];
  try {
    const { stdout, stderr } = await execFileAsync("graphify", args, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    });
    return { ok: true, output: stdout, error: stderr };
  } catch (e: any) {
    return { ok: false, output: e.stdout || "", error: e.stderr || e.message };
  }
}

// ─── Graph Parser ─────────────────────────────────────────────────────────────

function parseGraphJson(graphPath: string): KnowledgeGraph | null {
  if (!existsSync(graphPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(graphPath, "utf-8"));
    const nodes: GraphNode[] = Array.isArray(raw.nodes) ? raw.nodes : [];
    const edges: GraphEdge[] = Array.isArray(raw.edges) ? raw.edges : [];
    const communities = Array.isArray(raw.communities)
      ? raw.communities
      : (Array.isArray(raw.communities) ? raw.communities : []);

    const languages = [...new Set(nodes.map((n: GraphNode) => n.language).filter(Boolean))];
    return {
      nodes,
      edges,
      communities,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        languages,
        timestamp: new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildGraph(
  targetPath: string = process.cwd(),
  mode: "ast" | "deep" = "ast"
): Promise<GraphifyResult> {
  ensureDir();

  if (!graphifyAvailable()) {
    logger.warn("Graphify", "graphify not installed — run: pip install graphifyy && graphify install");
    return {
      graph: null, wikiPath: "", reportPath: "",
      nodeCount: 0, edgeCount: 0, communityCount: 0,
      tokenSavings: "graphify unavailable",
      timestamp: new Date().toISOString(),
    };
  }

  logger.info("Graphify", `Building graph for ${targetPath} (mode: ${mode})`);
  const result = await runGraphify(targetPath, mode);

  if (!result.ok) {
    logger.error("Graphify", `Build failed: ${result.error}`);
    return {
      graph: null, wikiPath: "", reportPath: "",
      nodeCount: 0, edgeCount: 0, communityCount: 0,
      tokenSavings: `Build failed: ${result.error.slice(0, 100)}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Parse output
  const outDir = path.join(targetPath, "graphify-out");
  const graphPath = path.join(outDir, "graph.json");
  const wikiPath = path.join(outDir, "wiki");
  const reportPath = path.join(outDir, "GRAPH_REPORT.md");

  const graph = parseGraphJson(graphPath);

  const nodeCount = graph?.nodes.length || 0;
  const edgeCount = graph?.edges.length || 0;
  const communityCount = graph?.communities.length || 0;

  // Calculate token savings estimate
  const fileReadingTokens = nodeCount * 500; // ~500 tokens per file on average
  const graphQueryTokens = communityCount * 50; // ~50 tokens per community query
  const savings = fileReadingTokens > 0
    ? `${((1 - graphQueryTokens / fileReadingTokens) * 100).toFixed(1)}% (${fileReadingTokens.toLocaleString()} → ${graphQueryTokens.toLocaleString()} tokens)`
    : "N/A";

  // Cache the parsed graph
  writeFileSync(path.join(GRAPH_CACHE, "latest.json"), JSON.stringify(graph, null, 2), "utf-8");

  logger.info("Graphify", `Graph built: ${nodeCount} nodes, ${edgeCount} edges, ${communityCount} communities`);

  return {
    graph, wikiPath, reportPath,
    nodeCount, edgeCount, communityCount,
    tokenSavings: savings,
    timestamp: new Date().toISOString(),
  };
}

export function getGraph(): KnowledgeGraph | null {
  ensureDir();
  const cachePath = path.join(GRAPH_CACHE, "latest.json");
  if (existsSync(cachePath)) {
    try { return JSON.parse(readFileSync(cachePath, "utf-8")); } catch { /* ignore */ }
  }
  return null;
}

export function queryGraph(query: string): GraphNode[] {
  const graph = getGraph();
  if (!graph) return [];

  const q = query.toLowerCase();
  const results: Array<{ node: GraphNode; score: number }> = [];

  for (const node of graph.nodes) {
    let score = 0;
    if (node.label.toLowerCase().includes(q)) score += 10;
    if (node.id.toLowerCase().includes(q)) score += 8;
    if (node.type.toLowerCase().includes(q)) score += 5;
    if (node.docstring && node.docstring.toLowerCase().includes(q)) score += 7;
    if (node.file.toLowerCase().includes(q)) score += 3;
    if (score > 0) results.push({ node, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20).map(r => r.node);
}

export function getGraphSummary(): string {
  const graph = getGraph();
  if (!graph) return "No graph available. Run `graphify .` to build one.";

  const lines: string[] = [
    `Knowledge Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.communities.length} communities`,
    `Languages: ${graph.metadata.languages.join(", ") || "unknown"}`,
    "",
    "Top nodes by connections:",
  ];

  // Find most-connected nodes
  const connMap = new Map<string, number>();
  for (const e of graph.edges) {
    connMap.set(e.source, (connMap.get(e.source) || 0) + 1);
    connMap.set(e.target, (connMap.get(e.target) || 0) + 1);
  }
  const topNodes = [...connMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [nodeId, count] of topNodes) {
    const node = graph.nodes.find(n => n.id === nodeId);
    lines.push(`  - ${node?.label || nodeId} (${count} connections)${node?.type ? ` [${node.type}]` : ""}`);
  }

  return lines.join("\n");
}

export function graphAvailable(): boolean {
  return graphifyAvailable();
}

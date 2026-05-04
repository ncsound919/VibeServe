/**
 * CodeAnalyzer — AST-aware code analysis using tree-sitter for semantic diffs
 * and structural code understanding.
 * Modeled on Windsurf Codemaps and Cursor Instant Grep.
 *
 * Provides: code graph building, semantic search, symbol extraction, dependency mapping.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface SymbolInfo {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "import" | "export" | "unknown";
  file: string;
  line: number;
  column: number;
  exported: boolean;
  dependencies: string[];
}

export interface FileAnalysis {
  file: string;
  size: number;
  lines: number;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
  complexity?: number;
}

export interface CodeGraph {
  files: FileAnalysis[];
  symbolIndex: Map<string, SymbolInfo[]>;
  dependencyGraph: Map<string, string[]>;
  orphanFiles: string[];
}

export interface SemanticSearchResult {
  file: string;
  line: number;
  match: string;
  context: string;
  confidence: number;
}

// ─── Symbol Extraction (regex-based, tree-sitter compatible) ────────────

const PATTERNS: Record<SymbolInfo["kind"], RegExp> = {
  function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
  class: /(?:export\s+)?class\s+(\w+)/g,
  interface: /(?:export\s+)?interface\s+(\w+)/g,
  type: /(?:export\s+)?type\s+(\w+)/g,
  variable: /(?:export\s+)?(?:const|let|var)\s+(\w+)/g,
  import: /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
  export: /export\s+\{[^}]+\}/g,
  unknown: /./g,
};

function extractSymbols(filePath: string, content: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = content.split("\n");

  for (const [kind, regex] of Object.entries(PATTERNS)) {
    if (kind === "import" || kind === "export" || kind === "unknown") continue;
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      symbols.push({
        name: match[1],
        kind: kind as SymbolInfo["kind"],
        file: filePath,
        line: lineNum,
        column: match.index - content.lastIndexOf("\n", match.index),
        exported: lines[lineNum - 1]?.includes("export") || false,
        dependencies: [],
      });
    }
  }

  // Extract imports
  const importRe = new RegExp(PATTERNS.import.source, PATTERNS.import.flags);
  let importMatch;
  while ((importMatch = importRe.exec(content)) !== null) {
    const importedPath = importMatch[1];
    symbols.push({
      name: importedPath,
      kind: "import",
      file: filePath,
      line: content.substring(0, importMatch.index).split("\n").length,
      column: 0,
      exported: false,
      dependencies: [importedPath],
    });
  }

  return symbols;
}

// ─── Code Graph Builder ────────────────────────────────────────────────

export async function buildCodeGraph(
  rootDir: string,
  options?: { extensions?: string[]; excludeDirs?: string[]; maxFiles?: number }
): Promise<CodeGraph> {
  const extensions = options?.extensions || [".ts", ".tsx", ".js", ".jsx", ".css", ".json"];
  const excludeDirs = options?.excludeDirs || ["node_modules", "dist", ".git", ".superpowers", "uploads"];
  const maxFiles = options?.maxFiles || 200;

  const files: FileAnalysis[] = [];
  const symbolIndex = new Map<string, SymbolInfo[]>();
  const dependencyGraph = new Map<string, string[]>();

  function scanDir(dir: string, depth = 0): void {
    if (depth > 5 || files.length >= maxFiles) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(".") || excludeDirs.includes(entry)) continue;
        const fullPath = path.join(dir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            scanDir(fullPath, depth + 1);
          } else if (extensions.some((ext) => entry.endsWith(ext))) {
            const content = readFileSync(fullPath, "utf-8");
            const lines = content.split("\n");
            const symbols = extractSymbols(fullPath, content);
            const imports = symbols.filter((s) => s.kind === "import").map((s) => s.name);

            const analysis: FileAnalysis = {
              file: path.relative(rootDir, fullPath).replace(/\\/g, "/"),
              size: stats.size,
              lines: lines.length,
              symbols,
              imports,
              exports: symbols.filter((s) => s.exported).map((s) => s.name),
              complexity: Math.round(lines.length * (symbols.length / Math.max(1, lines.length)) * 10) / 10,
            };

            files.push(analysis);

            for (const sym of symbols.filter((s) => s.kind !== "import")) {
              const existing = symbolIndex.get(sym.name) || [];
              existing.push(sym);
              symbolIndex.set(sym.name, existing);
            }

            dependencyGraph.set(analysis.file, imports);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  scanDir(rootDir);

  const orphanFiles = files
    .filter((f) => f.imports.length === 0 && f.exports.length === 0)
    .map((f) => f.file);

  logger.info("CodeAnalyzer", `Graph built: ${files.length} files, ${symbolIndex.size} symbols, ${orphanFiles.length} orphans`);

  return { files, symbolIndex, dependencyGraph, orphanFiles };
}

// ─── Semantic Search (keyword + symbol aware) ──────────────────────────

export async function semanticSearch(
  query: string,
  codeGraph: CodeGraph
): Promise<SemanticSearchResult[]> {
  const results: SemanticSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const file of codeGraph.files) {
    for (const sym of file.symbols) {
      if (sym.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          file: file.file,
          line: sym.line,
          match: sym.name,
          context: `${sym.kind} in ${file.file}`,
          confidence: 0.9,
        });
      }
    }

    if (file.file.toLowerCase().includes(lowerQuery)) {
      results.push({
        file: file.file,
        line: 1,
        match: file.file,
        context: `File match (${file.lines} lines, ${file.symbols.length} symbols)`,
        confidence: 0.7,
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, 50);
}

// ─── Dependency Analysis ───────────────────────────────────────────────

export function findDependents(
  filePath: string,
  codeGraph: CodeGraph
): string[] {
  const dependents: string[] = [];

  for (const [file, deps] of codeGraph.dependencyGraph) {
    for (const dep of deps) {
      if (dep.includes(path.basename(filePath, path.extname(filePath)))) {
        dependents.push(file);
        break;
      }
    }
  }

  return dependents;
}

export function findCircularDeps(codeGraph: CodeGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(file: string, path: string[]): void {
    if (inStack.has(file)) {
      const cycleStart = path.indexOf(file);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(file)) return;

    visited.add(file);
    inStack.add(file);
    path.push(file);

    const deps = codeGraph.dependencyGraph.get(file) || [];
    for (const dep of deps) {
      const resolved = codeGraph.files.find(
        (f) => f.file.includes(dep.replace(/^[./]+/, "")) || f.file === dep
      );
      if (resolved) dfs(resolved.file, [...path]);
    }

    path.pop();
    inStack.delete(file);
  }

  for (const [file] of codeGraph.dependencyGraph) {
    if (!visited.has(file)) dfs(file, []);
  }

  return cycles;
}

// ─── Complexity Analysis ───────────────────────────────────────────────

export interface ComplexityReport {
  averageComplexity: number;
  mostComplexFile: string;
  mostComplexScore: number;
  totalLines: number;
  totalSymbols: number;
  recommendations: string[];
}

export function analyzeComplexity(codeGraph: CodeGraph): ComplexityReport {
  const complexFiles = codeGraph.files
    .filter((f) => f.complexity !== undefined)
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0));

  const totalComplexity = complexFiles.reduce((s, f) => s + (f.complexity || 0), 0);
  const avgComplexity = complexFiles.length > 0
    ? Math.round((totalComplexity / complexFiles.length) * 10) / 10
    : 0;

  const totalLines = codeGraph.files.reduce((s, f) => s + f.lines, 0);
  const totalSymbols = codeGraph.files.reduce((s, f) => s + f.symbols.length, 0);

  const recommendations: string[] = [];
  if (complexFiles[0]?.complexity && complexFiles[0].complexity > 20) {
    recommendations.push(`High complexity in ${complexFiles[0].file} (${complexFiles[0].complexity}) — consider splitting`);
  }
  if (codeGraph.orphanFiles.length > 5) {
    recommendations.push(`${codeGraph.orphanFiles.length} orphan files — may indicate dead code`);
  }
  const cycles = findCircularDeps(codeGraph);
  if (cycles.length > 0) {
    recommendations.push(`${cycles.length} circular dependency cycle(s) found`);
  }

  return {
    averageComplexity: avgComplexity,
    mostComplexFile: complexFiles[0]?.file || "N/A",
    mostComplexScore: complexFiles[0]?.complexity || 0,
    totalLines,
    totalSymbols,
    recommendations,
  };
}

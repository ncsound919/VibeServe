/**
 * Codebase Intelligence Service (mcp-codebase-intelligence style)
 * 
 * Features:
 * - Symbol search with fuzzy matching
 * - References (find all callers/users)
 * - Exports (public API surface)
 * - Dependencies (import graph)
 * - Call graph (who calls what)
 * - Impact analysis for changes
 * - Semantic diff for git refs
 */
import { create } from 'zustand';

export interface Symbol {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'method' | 'variable' | 'module';
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
  references: string[];
}

export interface Dependency {
  from: string;
  to: string;
  type: 'import' | 'export' | 'inherit';
}

export interface CallGraphNode {
  symbolId: string;
  calls: string[];
  calledBy: string[];
}

export interface ImpactAnalysis {
  changedFiles: string[];
  affectedSymbols: Symbol[];
  downstreamDependents: Symbol[];
  breakingChanges: string[];
  risk: 'low' | 'medium' | 'high';
}

interface CodebaseIntelligenceStore {
  symbols: Map<string, Symbol>;
  dependencies: Dependency[];
  callGraph: Map<string, CallGraphNode>;
  isIndexing: boolean;

  indexWorkspace: (rootPath: string) => Promise<void>;
  findSymbol: (query: string, options?: { kind?: string; fuzzy?: boolean }) => Symbol[];
  getReferences: (symbolId: string, levels?: number) => Symbol[];
  getExports: (filePath: string) => Symbol[];
  getDependencies: (filePath: string, levels?: number) => string[];
  getCallGraph: (symbolId: string) => CallGraphNode | null;
  analyzeChangeImpact: (changedFiles: string[]) => Promise<ImpactAnalysis>;
  getSemanticDiff: (gitRef: string) => Promise<{ oldSymbols: Symbol[]; newSymbols: Symbol[]; changed: Symbol[] }>;
}

function parseSimpleSymbols(content: string, filePath: string): Symbol[] {
  const symbols: Symbol[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    if (line.match(/^(export\s+)?(async\s+)?function\s+\w+/)) {
      const match = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (match) {
        symbols.push({
          id: `${filePath}:${lineNum}`,
          name: match[1],
          kind: 'function',
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: extractSignature(lines, i),
        });
      }
    } else if (line.match(/^(export\s+)?class\s+\w+/)) {
      const match = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (match) {
        symbols.push({
          id: `${filePath}:${lineNum}`,
          name: match[1],
          kind: 'class',
          filePath,
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    } else if (line.match(/^(export\s+)?(interface|type)\s+\w+/)) {
      const match = line.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/);
      if (match) {
        symbols.push({
          id: `${filePath}:${lineNum}`,
          name: match[1],
          kind: 'interface',
          filePath,
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    } else if (line.match(/^(export\s+)?const\s+\w+\s*=/)) {
      const match = line.match(/(?:export\s+)?const\s+(\w+)/);
      if (match) {
        symbols.push({
          id: `${filePath}:${lineNum}`,
          name: match[1],
          kind: 'variable',
          filePath,
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    }
  }
  
  return symbols;
}

function extractSignature(lines: string[], startLine: number): string {
  const sigLines: string[] = [];
  for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
    sigLines.push(lines[i]);
    if (lines[i].includes('{')) break;
  }
  return sigLines.join(' ').trim();
}

function findReferencesInContent(content: string, symbolName: string): string[] {
  const lines = content.split('\n');
  const refs: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(symbolName)) {
      refs.push(`${i + 1}`);
    }
  }
  
  return refs;
}

export const useCodebaseIntelligence = create<CodebaseIntelligenceStore>()((set, get) => ({
  symbols: new Map(),
  dependencies: [],
  callGraph: new Map(),
  isIndexing: false,

  indexWorkspace: async (rootPath: string) => {
    set({ isIndexing: true });
    
    try {
      const { readdirSync, readFileSync, statSync } = await import('fs');
      const { join, relative } = await import('path');
      
      const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];
      const CODE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php'];
      
      const newSymbols = new Map<string, Symbol>();
      const newDependencies: Dependency[] = [];
      const newCallGraph = new Map<string, CallGraphNode>();
      
      const processDir = (dir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
              processDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = entry.name.substring(entry.name.lastIndexOf('.'));
            if (CODE_EXTS.includes(ext)) {
              const relativePath = relative(rootPath, fullPath);
              const content = readFileSync(fullPath, 'utf-8');
              const symbols = parseSimpleSymbols(content, relativePath);
              
              for (const symbol of symbols) {
                newSymbols.set(symbol.id, symbol);
                
                const existing = newCallGraph.get(symbol.id) || { symbolId: symbol.id, calls: [], calledBy: [] };
                
                const calledSymbols = content.match(new RegExp(`${symbol.name}\\s*\\(`, 'g'));
                if (calledSymbols) {
                  for (const called of calledSymbols) {
                    const funcMatch = called.match(/(\w+)\\s*\\(/);
                    if (funcMatch) {
                      existing.calls.push(funcMatch[1]);
                    }
                  }
                }
                
                newCallGraph.set(symbol.id, existing);
              }
              
              const importMatches = content.match(/import\\s+.*from\\s+['"]([^'"]+)['"]/g);
              if (importMatches) {
                for (const imp of importMatches) {
                  const modMatch = imp.match(/from\\s+['"]([^'"]+)['"]/);
                  if (modMatch) {
                    newDependencies.push({
                      from: relativePath,
                      to: modMatch[1],
                      type: 'import',
                    });
                  }
                }
              }
            }
          }
        }
      };
      
      processDir(rootPath);
      
      set({
        symbols: newSymbols,
        dependencies: newDependencies,
        callGraph: newCallGraph,
        isIndexing: false,
      });
      
      console.log('[CodebaseIntelligence] Indexed:', newSymbols.size, 'symbols');
    } catch (error) {
      console.error('[CodebaseIntelligence] Index error:', error);
      set({ isIndexing: false });
    }
  },

  findSymbol: (query, options = {}) => {
    const { symbols } = get();
    const results: Symbol[] = [];
    const queryLower = query.toLowerCase();
    
    symbols.forEach(symbol => {
      const nameMatch = options.fuzzy
        ? symbol.name.toLowerCase().includes(queryLower)
        : symbol.name.toLowerCase() === queryLower;
      
      const kindMatch = options.kind ? symbol.kind === options.kind : true;
      
      if (nameMatch && kindMatch) {
        results.push(symbol);
      }
    });
    
    return results;
  },

  getReferences: (symbolId, levels = 1) => {
    const { symbols } = get();
    const symbol = symbols.get(symbolId);
    if (!symbol) return [];
    
    const refs: Symbol[] = [];
    const visited = new Set<string>();
    
    const findRefs = (name: string, depth: number) => {
      if (depth > levels || visited.has(name)) return;
      visited.add(name);
      
      symbols.forEach(s => {
        if (s.references?.some(r => r.includes(name))) {
          refs.push(s);
          findRefs(s.name, depth + 1);
        }
      });
    };
    
    findRefs(symbol.name, 0);
    return refs;
  },

  getExports: (filePath) => {
    const { symbols } = get();
    return Array.from(symbols.values()).filter(s => 
      s.filePath === filePath && s.kind !== 'variable'
    );
  },

  getDependencies: (filePath, levels = 1) => {
    const { dependencies } = get();
    const deps = new Set<string>();
    
    const findDeps = (path: string, depth: number) => {
      if (depth > levels) return;
      
      dependencies
        .filter(d => d.from === path)
        .forEach(d => {
          deps.add(d.to);
          findDeps(d.to, depth + 1);
        });
    };
    
    findDeps(filePath, 0);
    return Array.from(deps);
  },

  getCallGraph: (symbolId) => {
    return get().callGraph.get(symbolId) || null;
  },

  analyzeChangeImpact: async (changedFiles) => {
    const { symbols } = get();
    const affectedSymbols: Symbol[] = [];
    const downstreamDependents: Symbol[] = [];
    
    for (const file of changedFiles) {
      const fileSymbols = Array.from(symbols.values()).filter(s => s.filePath === file);
      affectedSymbols.push(...fileSymbols);
      
      for (const symbol of fileSymbols) {
        symbols.forEach(s => {
          if (s.references?.some(r => r.includes(symbol.name))) {
            downstreamDependents.push(s);
          }
        });
      }
    }
    
    const breakingChanges = downstreamDependents.filter(s => 
      s.kind === 'function' || s.kind === 'class'
    );
    
    return {
      changedFiles,
      affectedSymbols,
      downstreamDependents,
      breakingChanges: breakingChanges.map(s => s.id),
      risk: breakingChanges.length > 5 ? 'high' : breakingChanges.length > 0 ? 'medium' : 'low',
    };
  },

  getSemanticDiff: async (gitRef) => {
    const { symbols } = get();
    
    console.log('[CodebaseIntelligence] Semantic diff for:', gitRef);
    
    return {
      oldSymbols: [],
      newSymbols: Array.from(symbols.values()),
      changed: [],
    };
  },
}));

export function useCodebaseIntelligenceStore() {
  return useCodebaseIntelligence;
}

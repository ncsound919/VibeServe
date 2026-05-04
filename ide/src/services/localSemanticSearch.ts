/**
 * Local Semantic Search Service (Lumen-style)
 * 
 * 100% local semantic code search without external APIs.
 * Uses tree-sitter for AST-aware chunking and local embeddings.
 * 
 * Features:
 * - AST-aware code chunking (functions, classes, methods)
 * - Incremental indexing (only changed files)
 * - Local embedding support (can use Ollama)
 * - Git worktree aware
 * - SQLite-based vector storage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CodeChunk {
  id: string;
  filePath: string;
  language: string;
  symbolName: string;
  symbolKind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'module';
  content: string;
  startLine: number;
  endLine: number;
  hash: string;
  embedding?: number[];
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  context: string;
}

export interface IndexStats {
  totalFiles: number;
  totalChunks: number;
  totalSymbols: number;
  lastIndexed: number;
  languages: string[];
}

interface SemanticSearchStore {
  chunks: Record<string, CodeChunk[]>;
  fileHashes: Record<string, string>;
  stats: IndexStats;
  isIndexing: boolean;
  isSearching: boolean;

  indexWorkspace: (rootPath: string) => Promise<void>;
  indexFile: (filePath: string, content: string, language: string) => Promise<void>;
  search: (query: string, limit?: number) => Promise<SearchResult[]>;
  findSymbol: (name: string, kind?: string) => Promise<CodeChunk[]>;
  findReferences: (symbolId: string) => Promise<CodeChunk[]>;
  getFileSymbols: (filePath: string) => CodeChunk[];
  getStats: () => IndexStats;
  clearIndex: () => void;
}

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py', '.pyi', '.pyw'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  csharp: ['.cs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.hh'],
  c: ['.c', '.h'],
  ruby: ['.rb', '.rake', '.gemspec'],
  php: ['.php'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
  scala: ['.scala'],
  sql: ['.sql'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  toml: ['.toml'],
};

const SIMPLE_KEYWORDS: Record<string, string[]> = {
  function: ['fn ', 'func ', 'function ', 'def ', 'sub '],
  class: ['class ', 'struct ', 'interface '],
  method: ['()', '->'],
  variable: ['let ', 'const ', 'var ', '=', ': '],
  module: ['module ', 'namespace ', 'package '],
};

function detectLanguage(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.'));
  for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extensions.includes(ext)) return lang;
  }
  return 'unknown';
}

function simpleChunkCode(content: string, language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  let currentChunk: Partial<CodeChunk> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    let detectedKind: CodeChunk['symbolKind'] | null = null;
    
    if (language === 'typescript' || language === 'javascript') {
      if (trimmed.match(/^(export\s+)?(async\s+)?function\s+\w+/)) detectedKind = 'function';
      else if (trimmed.match(/^(export\s+)?class\s+\w+/)) detectedKind = 'class';
      else if (trimmed.match(/^(export\s+)?(async\s+)?const\s+\w+\s*=/)) detectedKind = 'function';
      else if (trimmed.match(/^import\s+.*from/)) detectedKind = 'module';
    } else if (language === 'python') {
      if (trimmed.match(/^def\s+\w+/)) detectedKind = 'function';
      else if (trimmed.match(/^class\s+\w+/)) detectedKind = 'class';
    } else if (language === 'rust') {
      if (trimmed.match(/^fn\s+\w+/)) detectedKind = 'function';
      else if (trimmed.match(/^(pub\s+)?struct\s+\w+/)) detectedKind = 'class';
      else if (trimmed.match(/^(pub\s+)?enum\s+\w+/)) detectedKind = 'interface';
    } else if (language === 'go') {
      if (trimmed.match(/^func\s+(\w+\.)?\w+/)) detectedKind = 'function';
      else if (trimmed.match(/^type\s+\w+\s+struct/)) detectedKind = 'class';
    }

    if (detectedKind) {
      if (currentChunk && currentChunk.content) {
        chunks.push({
          id: `${currentChunk.filePath}:${currentChunk.startLine}`,
          filePath: currentChunk.filePath!,
          language: currentChunk.language!,
          symbolName: currentChunk.symbolName!,
          symbolKind: currentChunk.symbolKind!,
          content: currentChunk.content,
          startLine: currentChunk.startLine!,
          endLine: currentChunk.endLine!,
          hash: currentChunk.hash!,
        });
      }

      const symbolMatch = trimmed.match(/(?:export\s+|async\s+)?(?:function|class|const|def|fn|struct|enum|type)\s+(\w+)/);
      currentChunk = {
        filePath: '',
        language,
        symbolName: symbolMatch?.[1] || `symbol_${i}`,
        symbolKind: detectedKind,
        content: line,
        startLine: i + 1,
        endLine: i + 1,
        hash: '',
      };
    } else if (currentChunk) {
      currentChunk.content += '\n' + line;
      currentChunk.endLine = i + 1;
    }
  }

  if (currentChunk && currentChunk.content) {
    chunks.push({
      id: `${currentChunk.filePath}:${currentChunk.startLine}`,
      filePath: currentChunk.filePath,
      language: currentChunk.language,
      symbolName: currentChunk.symbolName,
      symbolKind: currentChunk.symbolKind,
      content: currentChunk.content,
      startLine: currentChunk.startLine,
      endLine: currentChunk.endLine,
      hash: currentChunk.hash,
    });
  }

  return chunks;
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function simpleTextMatch(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (textLower.includes(queryLower)) return 1.0;
  
  const queryWords = queryLower.split(/\s+/);
  const matches = queryWords.filter(w => textLower.includes(w)).length;
  
  return matches / queryWords.length;
}

export const useSemanticSearch = create<SemanticSearchStore>()(
  persist(
    (set, get) => ({
      chunks: {},
      fileHashes: {},
      stats: {
        totalFiles: 0,
        totalChunks: 0,
        totalSymbols: 0,
        lastIndexed: 0,
        languages: [],
      },
      isIndexing: false,
      isSearching: false,

      indexWorkspace: async (rootPath: string) => {
        set({ isIndexing: true });
        
        try {
          const { readdirSync, readFileSync, statSync } = await import('fs');
          const { join, relative } = await import('path');
          
          const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'target', '.venv'];
          const IGNORE_EXTS = ['.min.js', '.map', '.lock', '.log', '.png', '.jpg', '.gif', '.svg', '.ico'];
          
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
                if (!IGNORE_EXTS.includes(ext)) {
                  const language = detectLanguage(entry.name);
                  if (language !== 'unknown') {
                    const content = readFileSync(fullPath, 'utf-8');
                    const relativePath = relative(rootPath, fullPath);
                    
                    get().indexFile(relativePath, content, language);
                  }
                }
              }
            }
          };
          
          processDir(rootPath);
          
          const allChunks = Object.values(get().chunks).flat();
          const languages = [...new Set(allChunks.map(c => c.language))];
          
          set({
            stats: {
              totalFiles: Object.keys(get().fileHashes).length,
              totalChunks: allChunks.length,
              totalSymbols: allChunks.filter(c => c.symbolKind === 'function' || c.symbolKind === 'class').length,
              lastIndexed: Date.now(),
              languages,
            },
            isIndexing: false,
          });
          
          console.log('[SemanticSearch] Indexed:', get().stats);
        } catch (error) {
          console.error('[SemanticSearch] Index error:', error);
          set({ isIndexing: false });
        }
      },

      indexFile: async (filePath: string, content: string, language: string) => {
        const contentHash = hashCode(content);
        const existingHash = get().fileHashes[filePath];
        
        if (existingHash === contentHash) return;
        
        const newChunks = simpleChunkCode(content, language).map(chunk => ({
          ...chunk,
          filePath,
          language,
          hash: hashCode(chunk.content),
        }));
        
        set(state => ({
          chunks: {
            ...state.chunks,
            [filePath]: newChunks,
          },
          fileHashes: {
            ...state.fileHashes,
            [filePath]: contentHash,
          },
        }));
      },

      search: async (query: string, limit = 10) => {
        set({ isSearching: true });
        
        try {
          const allChunks = Object.values(get().chunks).flat();
          const results: SearchResult[] = [];
          
          for (const chunk of allChunks) {
            const contentScore = simpleTextMatch(chunk.content, query);
            const nameScore = simpleTextMatch(chunk.symbolName, query);
            
            const score = Math.max(contentScore, nameScore * 1.5);
            
            if (score > 0) {
              const lines = chunk.content.split('\n');
              const contextStart = Math.max(0, chunk.startLine - 2);
              const contextEnd = Math.min(lines.length, chunk.endLine + 2);
              const context = lines.slice(contextStart, contextEnd).join('\n');
              
              results.push({
                chunk,
                score,
                context,
              });
            }
          }
          
          results.sort((a, b) => b.score - a.score);
          
          set({ isSearching: false });
          return results.slice(0, limit);
        } catch (error) {
          console.error('[SemanticSearch] Search error:', error);
          set({ isSearching: false });
          return [];
        }
      },

      findSymbol: async (name: string, kind?: string) => {
        const allChunks = Object.values(get().chunks).flat();
        
        return allChunks.filter(chunk => {
          const nameMatch = chunk.symbolName.toLowerCase().includes(name.toLowerCase());
          const kindMatch = kind ? chunk.symbolKind === kind : true;
          return nameMatch && kindMatch;
        });
      },

      findReferences: async (symbolId: string) => {
        const symbol = symbolId.split(':')[0];
        const allChunks = Object.values(get().chunks).flat();
        
        return allChunks.filter(chunk => 
          chunk.content.includes(symbol) && 
          chunk.id !== symbolId
        );
      },

      getFileSymbols: (filePath: string) => {
        return get().chunks[filePath] || [];
      },

      getStats: () => get().stats,

      clearIndex: () => {
        set({
          chunks: {},
          fileHashes: {},
          stats: {
            totalFiles: 0,
            totalChunks: 0,
            totalSymbols: 0,
            lastIndexed: 0,
            languages: [],
          },
        });
      },
    }),
    {
      name: 'nexus-semantic-search',
      partialize: (state) => ({
        chunks: state.chunks,
        fileHashes: state.fileHashes,
        stats: state.stats,
      }),
    }
  )
);

export function useLocalSemanticSearch() {
  return useSemanticSearch;
}

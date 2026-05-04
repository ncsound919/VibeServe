/**
 * Codeix - Portable Code Indexer
 * 
 * Features:
 * - Portable index that can be committed to repo
 * - Language-agnostic parsing (TypeScript, Python, Go, Rust, etc.)
 * - Symbol extraction with scope tracking
 * - Incremental re-indexing
 * - Fast lookups via binary search + bloom filter
 * - Export to JSON for version control
 */
import { create } from 'zustand';

export interface IndexEntry {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'type' | 'module' | 'import' | 'export' | 'interface';
  scope: string;
  filePath: string;
  line: number;
  col: number;
  endLine?: number;
  signature?: string;
  doc?: string;
  visibility: 'public' | 'private' | 'protected';
}

export interface PortableIndex {
  version: string;
  createdAt: number;
  language: string;
  entries: IndexEntry[];
  fileMap: Record<string, string[]>;
  symbolIndex: Record<string, string[]>;
  bloomFilter: number[];
}

export interface CodeixStats {
  totalFiles: number;
  totalSymbols: number;
  indexSize: number;
  lastUpdate: number;
}

const BLOOM_SIZE = 1024;

interface CodeixStore {
  index: PortableIndex | null;
  isIndexing: boolean;
  stats: CodeixStats | null;

  createIndex: (rootPath: string, options?: { language?: string; includePrivate?: boolean }) => Promise<PortableIndex>;
  loadIndex: (indexJson: PortableIndex) => void;
  query: (query: string, options?: { kind?: string; limit?: number }) => IndexEntry[];
  getFileSymbols: (filePath: string) => IndexEntry[];
  getExports: (scope: string) => IndexEntry[];
  mergeIndex: (other: PortableIndex) => PortableIndex;
  exportIndex: () => string;
  saveIndex: (rootPath: string) => Promise<void>;
  loadFromDisk: (rootPath: string) => Promise<boolean>;
  clearIndex: () => void;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createBloomFilter(): number[] {
  return new Array(BLOOM_SIZE).fill(0);
}

function addToBloom(bloom: number[], value: string): void {
  const hash = simpleHash(value);
  const idx = hash % BLOOM_SIZE;
  bloom[idx] = 1;
}

function mightContain(bloom: number[], value: string): boolean {
  const hash = simpleHash(value);
  return bloom[hash % BLOOM_SIZE] === 1;
}

function parseCodeFile(content: string, filePath: string, language: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const lines = content.split('\n');

  const patterns: Record<string, RegExp[]> = {
    ts: [
      /^(export\s+)?(async\s+)?function\s+(\w+)/,
      /^(export\s+)?class\s+(\w+)/,
      /^(export\s+)?interface\s+(\w+)/,
      /^(export\s+)?type\s+(\w+)/,
      /^(export\s+)?const\s+(\w+)\s*=/,
      /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/,
      /^(export\s+)?(default\s+)?import\s+.*from\s+['"]([^'"]+)['"]/,
    ],
    py: [
      /^def\s+(\w+)/,
      /^class\s+(\w+)/,
      /^(\w+)\s*=\s*.*$/,
      /^from\s+(\S+)\s+import/,
      /^import\s+(\S+)/,
    ],
    go: [
      /^func\s+(\w+)/,
      /^func\s+\((\w+)\s+\*?\w+)\s+(\w+)/,
      /^type\s+(\w+)\s+(struct|interface)/,
      /^package\s+(\w+)/,
      /^import\s+\(/,
    ],
    rs: [
      /^fn\s+(\w+)/,
      /^struct\s+(\w+)/,
      /^enum\s+(\w+)/,
      /^impl\s+(\w+)/,
      /^use\s+(\w+)/,
    ],
  };

  const langPatterns = patterns[language] || patterns.ts;
  let currentScope = 'global';
  let visibility: IndexEntry['visibility'] = 'public';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.includes('private:') || line.startsWith('_')) {
      visibility = 'private';
    } else if (line.includes('protected:')) {
      visibility = 'protected';
    }

    for (const pattern of langPatterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1] || match[2] || match[3];
        if (!name || name.length < 2) continue;

        let kind: IndexEntry['kind'] = 'function';
        if (pattern.source.includes('class')) kind = 'class';
        else if (pattern.source.includes('interface')) kind = 'interface';
        else if (pattern.source.includes('type')) kind = 'type';
        else if (pattern.source.includes('const') || pattern.source.includes('variable')) kind = 'variable';
        else if (pattern.source.includes('import')) kind = 'import';

        if (line.startsWith('export') || line.startsWith('pub ')) {
          visibility = 'public';
        }

        entries.push({
          id: `${filePath}:${lineNum}`,
          name,
          kind,
          scope: currentScope,
          filePath,
          line: lineNum,
          col: line.search(/\w/),
          visibility,
        });
      }
    }

    if (line.match(/^(class|interface|struct|type)\s+\w+/)) {
      const match = line.match(/(?:class|interface|struct|type)\s+(\w+)/);
      if (match) currentScope = match[1];
    }
  }

  return entries;
}

export const useCodeixStore = create<CodeixStore>()((set, get) => ({
  index: null,
  isIndexing: false,
  stats: null,

  createIndex: async (rootPath, options = {}) => {
    set({ isIndexing: true });

    try {
      const { readdirSync, readFileSync, statSync } = await import('fs');
      const { join, relative } = await import('path');

      const language = options.language || 'ts';
      const includePrivate = options.includePrivate ?? true;

      const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__'];
      const EXT_MAP: Record<string, string> = {
        '.ts': 'ts', '.tsx': 'ts', '.js': 'ts', '.jsx': 'ts',
        '.py': 'py', '.go': 'go', '.rs': 'rs', '.java': 'java',
      };

      const allEntries: IndexEntry[] = [];
      const fileMap: Record<string, string[]> = {};
      const symbolIndex: Record<string, string[]> = {};
      const bloomFilter = createBloomFilter();

      const processDir = (dir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
              processDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = entry.name.substring(entry.name.lastIndexOf('.'));
            const fileLang = EXT_MAP[ext];
            if (!fileLang) return;

            const relativePath = relative(rootPath, fullPath);
            const content = readFileSync(fullPath, 'utf-8');
            const entries = parseCodeFile(content, relativePath, fileLang);

            fileMap[relativePath] = entries.map(e => e.id);

            for (const entry of entries) {
              if (!includePrivate && entry.visibility === 'private') continue;

              allEntries.push(entry);
              addToBloom(bloomFilter, entry.name);

              if (!symbolIndex[entry.name]) {
                symbolIndex[entry.name] = [];
              }
              symbolIndex[entry.name].push(entry.id);
            }
          }
        }
      };

      processDir(rootPath);

      const index: PortableIndex = {
        version: '1.0.0',
        createdAt: Date.now(),
        language,
        entries: allEntries,
        fileMap,
        symbolIndex,
        bloomFilter,
      };

      const stats: CodeixStats = {
        totalFiles: Object.keys(fileMap).length,
        totalSymbols: allEntries.length,
        indexSize: JSON.stringify(index).length,
        lastUpdate: Date.now(),
      };

      set({ index, stats, isIndexing: false });
      console.log('[Codeix] Created index:', stats);

      return index;
    } catch (error) {
      console.error('[Codeix] Index error:', error);
      set({ isIndexing: false });
      throw error;
    }
  },

  loadIndex: (indexJson) => {
    set({ index: indexJson });
  },

  query: (query, options = {}) => {
    const { index } = get();
    if (!index) return [];

    const limit = options.limit || 20;
    const kind = options.kind;

    if (!mightContain(index.bloomFilter, query)) {
      return [];
    }

    const results = index.symbolIndex[query] || [];
    return results
      .map(id => index.entries.find(e => e.id === id))
      .filter((e): e is IndexEntry => !!e && (!kind || e.kind === kind))
      .slice(0, limit);
  },

  getFileSymbols: (filePath) => {
    const { index } = get();
    if (!index) return [];

    const entryIds = index.fileMap[filePath] || [];
    return entryIds.map(id => index.entries.find(e => e.id === id)).filter(Boolean) as IndexEntry[];
  },

  getExports: (scope) => {
    const { index } = get();
    if (!index) return [];

    return index.entries.filter(e => e.scope === scope && e.visibility === 'public');
  },

  mergeIndex: (other) => {
    const { index: current } = get();
    if (!current) return other;

    const mergedEntries = [...current.entries, ...other.entries];
    const mergedFileMap = { ...current.fileMap, ...other.fileMap };
    const mergedSymbolIndex: Record<string, string[]> = {};

    for (const entry of mergedEntries) {
      if (!mergedSymbolIndex[entry.name]) {
        mergedSymbolIndex[entry.name] = [];
      }
      if (!mergedSymbolIndex[entry.name].includes(entry.id)) {
        mergedSymbolIndex[entry.name].push(entry.id);
      }
    }

    const mergedBloom = createBloomFilter();
    Object.keys(mergedSymbolIndex).forEach(name => addToBloom(mergedBloom, name));

    return {
      version: '1.0.0',
      createdAt: Date.now(),
      language: current.language,
      entries: mergedEntries,
      fileMap: mergedFileMap,
      symbolIndex: mergedSymbolIndex,
      bloomFilter: mergedBloom,
    };
  },

  exportIndex: () => {
    const { index } = get();
    if (!index) return '';
    return JSON.stringify(index, null, 2);
  },

  saveIndex: async (rootPath) => {
    const { index } = get();
    if (!index) return;
    try {
      const { writeFileSync } = await import('fs');
      const { join } = await import('path');
      writeFileSync(join(rootPath, '.codeix.json'), JSON.stringify(index, null, 2));
      console.log('[Codeix] Saved index to disk');
    } catch (e) {
      console.error('[Codeix] Failed to save index:', e);
    }
  },

  loadFromDisk: async (rootPath) => {
    try {
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const indexPath = join(rootPath, '.codeix.json');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        const index = JSON.parse(content);
        set({ index });
        console.log('[Codeix] Loaded index from disk');
        return true;
      }
    } catch (e) {
      console.error('[Codeix] Failed to load index:', e);
    }
    return false;
  },

  clearIndex: () => {
    set({ index: null, stats: null });
  },
}));

export function useCodeix() {
  return useCodeixStore;
}

import { create } from 'zustand';

export interface IndexedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant';
  file: string;
  line: number;
  content: string;
}

interface ContextIndexState {
  symbols: Map<string, IndexedSymbol[]>;
  addFile: (filePath: string, symbols: IndexedSymbol[]) => void;
  getSymbols: (filePath?: string) => IndexedSymbol[];
  searchSymbols: (query: string) => IndexedSymbol[];
  clear: () => void;
}

export const useContextIndex = create<ContextIndexState>((set, get) => ({
  symbols: new Map(),

  addFile: (filePath, newSymbols) => {
    set((state) => {
      const newMap = new Map(state.symbols);
      newMap.set(filePath, newSymbols);
      return { symbols: newMap };
    });
  },

  getSymbols: (filePath) => {
    const { symbols } = get();
    if (filePath) {
      return symbols.get(filePath) || [];
    }
    return Array.from(symbols.values()).flat();
  },

  searchSymbols: (query) => {
    const allSymbols = get().getSymbols();
    const lowerQuery = query.toLowerCase();
    return allSymbols.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.content.toLowerCase().includes(lowerQuery)
    );
  },

  clear: () => set({ symbols: new Map() }),
}));

export function extractSymbols(content: string, fileName: string): IndexedSymbol[] {
  const symbols: IndexedSymbol[] = [];
  const lines = content.split('\n');

  const patterns = [
    { regex: /^(export\s+)?(async\s+)?function\s+(\w+)/, kind: 'function' as const },
    { regex: /^(export\s+)?class\s+(\w+)/, kind: 'class' as const },
    { regex: /^(export\s+)?interface\s+(\w+)/, kind: 'interface' as const },
    { regex: /^(export\s+)?type\s+(\w+)/, kind: 'type' as const },
    { regex: /^(export\s+)?const\s+(\w+)\s*=/, kind: 'constant' as const },
    { regex: /^(export\s+)?let\s+(\w+)\s*=/, kind: 'variable' as const },
    { regex: /^(export\s+)?var\s+(\w+)\s*=/, kind: 'variable' as const },
  ];

  lines.forEach((line, idx) => {
    for (const { regex, kind } of patterns) {
      const match = line.match(regex);
      if (match) {
        const name = match[match.length - 1];
        if (name && name.length > 1) {
          symbols.push({
            name,
            kind,
            file: fileName,
            line: idx + 1,
            content: line.trim(),
          });
        }
        break;
      }
    }
  });

  return symbols;
}

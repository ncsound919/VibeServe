import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
export type Layout = 'default' | 'compact' | 'comfortable';

interface PersonalizationStore {
  theme: Theme;
  fontSize: FontSize;
  layout: Layout;
  fontFamily: string;
  lineHeight: number;
  showMinimap: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setLayout: (layout: Layout) => void;
  toggleMinimap: () => void;
  toggleLineNumbers: () => void;
  toggleWordWrap: () => void;
  resetToDefaults: () => void;
}

const DEFAULTS = {
  theme: 'dark' as Theme,
  fontSize: 'medium' as FontSize,
  layout: 'default' as Layout,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineHeight: 1.5,
  showMinimap: false,
  showLineNumbers: true,
  wordWrap: true,
  tabSize: 2,
};

export const usePersonalizationStore = create<PersonalizationStore>((set) => ({
  ...DEFAULTS,

  setTheme: (theme) => {
    set({ theme });
    if (theme !== 'system') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('nexus:theme', theme);
  },

  setFontSize: (fontSize) => {
    set({ fontSize });
    localStorage.setItem('nexus:fontSize', fontSize);
  },

  setLayout: (layout) => {
    set({ layout });
    localStorage.setItem('nexus:layout', layout);
  },

  toggleMinimap: () => set((state) => {
    const newVal = !state.showMinimap;
    localStorage.setItem('nexus:minimap', String(newVal));
    return { showMinimap: newVal };
  }),

  toggleLineNumbers: () => set((state) => {
    const newVal = !state.showLineNumbers;
    localStorage.setItem('nexus:lineNumbers', String(newVal));
    return { showLineNumbers: newVal };
  }),

  toggleWordWrap: () => set((state) => {
    const newVal = !state.wordWrap;
    localStorage.setItem('nexus:wordWrap', String(newVal));
    return { wordWrap: newVal };
  }),

  resetToDefaults: () => {
    localStorage.removeItem('nexus:theme');
    localStorage.removeItem('nexus:fontSize');
    localStorage.removeItem('nexus:layout');
    localStorage.removeItem('nexus:minimap');
    localStorage.removeItem('nexus:lineNumbers');
    localStorage.removeItem('nexus:wordWrap');
    set(DEFAULTS);
  },
}));

// Load saved preferences on init
try {
  const savedTheme = localStorage.getItem('nexus:theme') as Theme;
  const savedFontSize = localStorage.getItem('nexus:fontSize') as FontSize;
  const savedLayout = localStorage.getItem('nexus:layout') as Layout;
  
  if (savedTheme) usePersonalizationStore.getState().setTheme(savedTheme);
  if (savedFontSize) usePersonalizationStore.getState().setFontSize(savedFontSize);
  if (savedLayout) usePersonalizationStore.getState().setLayout(savedLayout);
} catch (e) {
  console.error('Failed to load personalization:', e);
}

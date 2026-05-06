export const COLORS = {
  bg: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    tertiary: '#0f3460',
    surface: '#1e1e3a',
    overlay: 'rgba(0,0,0,0.6)',
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#64748b',
    onAccent: '#ffffff',
  },
  accent: {
    primary: '#536dfe',
    hover: '#7c8fff',
  },
  semantic: {
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
  git: {
    added: '#34d399',
    modified: '#fbbf24',
    deleted: '#f87171',
    untracked: '#60a5fa',
  },
  border: {
    primary: '#2d2d4a',
    focus: '#536dfe',
  },
  font: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  layout: {
    activityBarWidth: '48px',
    sidebarWidth: '260px',
    aiPanelWidth: '320px',
    bottomPanelHeight: '200px',
    statusBarHeight: '22px',
    tabBarHeight: '35px',
    titleBarHeight: '30px',
  },
} as const;

import { useState, useEffect } from 'react';
import { useIDEStore } from '../stores/useIDEStore';

const BOTTOM_TABS = [
  { id: 'problems' as const, label: 'Problems' },
  { id: 'output' as const, label: 'Output' },
  { id: 'terminal' as const, label: 'Terminal' },
  { id: 'pipeline-log' as const, label: 'Pipeline Log' },
  { id: 'gitea' as const, label: 'Gitea' },
];

export function PanelBar() {
  const { bottomPanelActive, setBottomPanelActive, bottomPanelOpen, toggleBottomPanel } =
    useIDEStore();
  const [problemCount, setProblemCount] = useState(0);

  useEffect(() => {
    const poll = () => {
      try {
        const monaco = (window as unknown as { monaco?: { editor?: { getModelMarkers?: (filter?: { owner?: string }) => any[] } } }).monaco;
        if (!monaco?.editor?.getModelMarkers) return;
        const markers = monaco.editor.getModelMarkers({});
        setProblemCount(markers.filter(m => m.severity >= 2 && m.message && m.message.trim()).length);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-center shrink-0 select-none"
      style={{
        height: '28px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        padding: '0 8px',
      }}
    >
      {BOTTOM_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (bottomPanelActive === tab.id && bottomPanelOpen) {
              toggleBottomPanel();
            } else {
              setBottomPanelActive(tab.id);
            }
          }}
          className="flex items-center gap-1.5 px-3 h-full text-xs transition-colors relative"
          style={{
            color: bottomPanelActive === tab.id && bottomPanelOpen ? 'var(--text-primary)' : 'var(--text-muted)',
            background: bottomPanelActive === tab.id && bottomPanelOpen ? 'var(--bg-tertiary)' : 'transparent',
          }}
        >
          {tab.label}
          {tab.id === 'problems' && problemCount > 0 && (
            <span
              className="text-[10px] px-1.5 rounded-full"
              style={{
                background: 'var(--error)',
                color: 'var(--text-on-accent)',
              }}
            >
              {problemCount}
            </span>
          )}
          {bottomPanelActive === tab.id && bottomPanelOpen && (
            <div
              className="absolute top-0 left-0 right-0"
              style={{ height: '2px', background: 'var(--accent)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

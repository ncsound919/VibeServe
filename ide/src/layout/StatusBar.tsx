import { useState, useEffect } from 'react';
import { useIDEStore } from '../stores/useIDEStore';
import { useAIStore } from '../stores/useAIStore';

export function StatusBar() {
  const { autonomyMode, setAutonomyMode, bottomPanelActive, setBottomPanelActive } = useIDEStore();
  const { selectedModel, setModel } = useAIStore();
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getPosition?: () => { lineNumber: number; column: number } | null }[] } } }).monaco;
        const editors = monaco?.editor?.getEditors?.();
        const activeEditor = editors?.[0];
        if (activeEditor) {
          const pos = activeEditor.getPosition?.();
          if (pos) setCursorPosition({ line: pos.lineNumber, col: pos.column });
        }
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex items-center justify-between shrink-0 text-xs select-none"
      style={{
        height: 'var(--status-bar-height)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
        padding: '0 8px',
      }}
    >
      <div className="flex items-center gap-4">
        <span>main</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>TypeScript React</span>
        <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setBottomPanelActive('pipeline-log')}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          Pipeline
        </button>

        <button
          onClick={() => {
            const modes = ['ide', 'copilot', 'pipeline'] as const;
            const next = modes[(modes.indexOf(autonomyMode) + 1) % modes.length];
            setAutonomyMode(next);
          }}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: autonomyMode === 'pipeline'
                ? 'var(--accent)'
                : autonomyMode === 'copilot'
                ? 'var(--info)'
                : 'var(--success)',
            }}
          />
          {autonomyMode === 'pipeline' ? 'Pipeline' : autonomyMode === 'copilot' ? 'Copilot' : 'IDE'}
        </button>

        <button
          onClick={() => {
            const models = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gpt-4o', 'claude-3.5-sonnet', 'llama3.2'];
            const next = models[(models.indexOf(selectedModel) + 1) % models.length];
            setModel(next);
          }}
          className="hover:text-white transition-colors"
        >
          {selectedModel}
        </button>

        <div className="flex items-center gap-1">
          <span>🔔</span>
          <span>0</span>
        </div>
      </div>
    </div>
  );
}

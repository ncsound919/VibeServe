import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

const TERM_THEME = {
  background: '#1a1a2e',
  foreground: '#e2e8f0',
  cursor: '#536dfe',
  selectionBackground: '#536dfe44',
  black: '#2d2d4a', red: '#f87171', green: '#34d399', yellow: '#fbbf24',
  blue: '#60a5fa', magenta: '#a78bfa', cyan: '#22d3ee', white: '#e2e8f0',
  brightBlack: '#64748b', brightRed: '#fca5a5', brightGreen: '#6ee7b7',
  brightYellow: '#fde68a', brightBlue: '#93c5fd', brightMagenta: '#c4b5fd',
  brightCyan: '#67e8f9', brightWhite: '#f8fafc',
};

type SplitMode = 'single' | 'vertical' | 'horizontal';

function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'var(--font-mono)',
      theme: TERM_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL fallback
    }

    term.open(containerRef.current);
    fitAddon.fit();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      term.write(typeof event.data === 'string' ? event.data : '');
    };
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);
}

export function TerminalPanel() {
  const [splitMode, setSplitMode] = useState<SplitMode>('single');
  const containerRef1 = useRef<HTMLDivElement>(null);
  const containerRef2 = useRef<HTMLDivElement>(null);

  useTerminal(containerRef1);
  useTerminal(containerRef2);

  const cycleSplit = () => {
    setSplitMode(prev => prev === 'single' ? 'vertical' : prev === 'vertical' ? 'horizontal' : 'single');
  };

  const splitIcons: Record<SplitMode, string> = {
    single: '▦',
    vertical: '▯',
    horizontal: '▱',
  };

  const isSplit = splitMode !== 'single';

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between px-2 py-0.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Terminal</span>
        <button
          onClick={cycleSplit}
          className="px-2 py-0.5 rounded text-[11px] hover:opacity-80"
          style={{ background: isSplit ? 'var(--accent)' : 'var(--bg-tertiary)', color: isSplit ? 'var(--text-on-accent)' : 'var(--text-muted)' }}
          title={`Split mode: ${splitMode}`}
        >
          {splitIcons[splitMode]}
        </button>
      </div>
      <div className={`flex-1 flex ${splitMode === 'horizontal' ? 'flex-col' : ''}`}>
        <div ref={containerRef1} className={`${isSplit ? 'flex-1' : 'h-full w-full'}`} style={isSplit ? { borderRight: splitMode === 'vertical' ? '1px solid var(--border)' : 'none', borderBottom: splitMode === 'horizontal' ? '1px solid var(--border)' : 'none' } : {}} />
        {isSplit && (
          <div ref={containerRef2} className="flex-1" />
        )}
      </div>
    </div>
  );
}

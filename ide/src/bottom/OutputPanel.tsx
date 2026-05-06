import { useState, useEffect, useRef, useCallback } from 'react';

interface OutputEntry {
  id: string;
  text: string;
  type: 'stdout' | 'stderr' | 'info';
  timestamp: number;
}

type OutputChannel = 'Tasks' | 'Build' | 'Test' | 'Pipeline';

export function OutputPanel() {
  const [wsConnected, setWsConnected] = useState(false);
  const [channel, setChannel] = useState<OutputChannel>('Tasks');
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [channelStore, setChannelStore] = useState<Record<string, OutputEntry[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const idCounterRef = useRef(0);

  const genId = useCallback((): string => {
    idCounterRef.current += 1;
    return `out_${Date.now()}_${idCounterRef.current}`;
  }, []);

  const pushToChannel = useCallback((ch: string, entry: OutputEntry) => {
    setChannelStore((prev) => {
      const existing = prev[ch] || [];
      const next = [...existing, entry].slice(-1000);
      return { ...prev, [ch]: next };
    });
  }, []);

  const handleClear = useCallback(() => {
    setChannelStore((prev) => ({ ...prev, [channel]: [] }));
    setEntries([]);
  }, [channel]);

  const handleChannelChange = useCallback((ch: OutputChannel) => {
    setChannel(ch);
  }, []);

  useEffect(() => {
    setEntries(channelStore[channel] || []);
  }, [channel, channelStore]);

  useEffect(() => {
    if (wsConnected) return;
    setWsConnected(true);

    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port || '5173';
        const ws = new WebSocket(`${protocol}//localhost:${port}/ws`);

        ws.onopen = () => {
          pushToChannel('Tasks', {
            id: genId(),
            text: 'Connected to Nexus output stream.',
            type: 'info',
            timestamp: Date.now(),
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'pipeline:update' && data.execution) {
              const exec = data.execution;
              const ch = 'Pipeline';
              if (exec.currentStep) {
                pushToChannel(ch, {
                  id: genId(),
                  text: `[${exec.currentStep}] ${exec.progress}%`,
                  type: 'info',
                  timestamp: Date.now(),
                });
              }
              if (Array.isArray(exec.logs)) {
                for (const log of exec.logs.slice(-20)) {
                  pushToChannel(ch, {
                    id: genId(),
                    text: log,
                    type: log.toLowerCase().includes('error') || log.toLowerCase().includes('fail') ? 'stderr' : 'stdout',
                    timestamp: Date.now(),
                  });
                }
              }
              if (exec.status === 'success') {
                pushToChannel(ch, {
                  id: genId(),
                  text: 'Pipeline completed successfully.',
                  type: 'info',
                  timestamp: Date.now(),
                });
              } else if (exec.status === 'failed') {
                pushToChannel(ch, {
                  id: genId(),
                  text: 'Pipeline failed. See errors above.',
                  type: 'stderr',
                  timestamp: Date.now(),
                });
              }
            }

            if (data.type === 'pipeline:relay') {
              pushToChannel('Tasks', {
                id: genId(),
                text: JSON.stringify(data),
                type: 'info',
                timestamp: Date.now(),
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          pushToChannel('Tasks', {
            id: genId(),
            text: 'Output stream disconnected. Reconnecting...',
            type: 'info',
            timestamp: Date.now(),
          });
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          // will trigger onclose
        };
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => { clearTimeout(reconnectTimer); };
  }, [wsConnected, pushToChannel, genId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
        <select
          value={channel}
          onChange={e => handleChannelChange(e.target.value as OutputChannel)}
          className="px-2 py-0.5 rounded text-xs"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <option>Tasks</option>
          <option>Build</option>
          <option>Test</option>
          <option>Pipeline</option>
        </select>
        <button
          onClick={handleClear}
          className="ml-auto text-[10px] px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
        >
          Clear
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            No output yet. Run a task or build to see output.
          </div>
        )}
        {entries.map(e => (
          <div
            key={e.id}
            className="text-xs font-mono leading-relaxed whitespace-pre-wrap"
            style={{
              color: e.type === 'stderr' ? 'var(--error)' : e.type === 'info' ? 'var(--text-muted)' : 'var(--text-secondary)',
            }}
          >
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

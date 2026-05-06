import { useState, useCallback } from 'react';

interface Variable { name: string; value: string; type: string; }
interface Breakpoint { id: string; file: string; line: number; enabled: boolean; }
interface StackFrame { id: number; name: string; file: string; line: number; }

export function DebugPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [stackFrames, setStackFrames] = useState<StackFrame[]>([]);
  const [watchExpressions, setWatchExpressions] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState('');
  const [activeTab, setActiveTab] = useState<'variables' | 'watch' | 'callstack' | 'breakpoints'>('variables');
  const [evaluating, setEvaluating] = useState(false);

  const toggleBreakpoint = useCallback((id: string) => {
    setBreakpoints(prev => prev.map(bp => bp.id === id ? { ...bp, enabled: !bp.enabled } : bp));
  }, []);

  const removeBreakpoint = useCallback((id: string) => {
    setBreakpoints(prev => prev.filter(bp => bp.id !== id));
  }, []);

  const addWatch = useCallback(() => {
    const trimmed = watchInput.trim();
    if (!trimmed) return;
    if (watchExpressions.includes(trimmed)) return;
    setWatchExpressions(prev => [...prev, trimmed]);
    setWatchInput('');
  }, [watchInput, watchExpressions]);

  const removeWatch = useCallback((index: number) => {
    setWatchExpressions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const evaluateWatch = useCallback((expression: string): string => {
    try {
      const fn = new Function('return ' + expression);
      const result = fn();
      if (result === undefined) return 'undefined';
      if (result === null) return 'null';
      if (typeof result === 'function') return '[Function]';
      if (typeof result === 'object') {
        try { return JSON.stringify(result); } catch { return '[Object]'; }
      }
      return String(result);
    } catch (e) {
      return (e as Error).message;
    }
  }, []);

  const handleStartStop = useCallback(() => {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    if (!nextRunning) {
      setVariables([]);
      setStackFrames([]);
    } else {
      setEvaluating(true);
      setTimeout(() => {
        setEvaluating(false);
      }, 600);
    }
  }, [isRunning]);

  const removeAllBreakpoints = useCallback(() => {
    setBreakpoints([]);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Debug
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleStartStop}
            className="text-xs px-3 py-1 rounded font-medium"
            style={{ background: isRunning ? 'var(--error)' : 'var(--success)', color: 'var(--text-on-accent)' }}
          >
            {isRunning ? '■ Stop' : '▶ Start'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'continue', label: '▶', title: 'Continue (F5)' },
          { key: 'stepOver', label: '⤵', title: 'Step Over (F10)' },
          { key: 'stepInto', label: '↓', title: 'Step Into (F11)' },
          { key: 'stepOut', label: '↑', title: 'Step Out (Shift+F11)' },
          { key: 'restart', label: '↻', title: 'Restart (Ctrl+Shift+F5)' },
        ].map(btn => (
          <button
            key={btn.key}
            disabled={!isRunning}
            title={btn.title}
            className="w-7 h-7 flex items-center justify-center rounded text-xs disabled:opacity-30"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 px-3 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['variables', 'watch', 'callstack', 'breakpoints'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-[10px] px-2 py-0.5 rounded capitalize"
            style={{
              background: activeTab === tab ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: activeTab === tab ? 'var(--text-on-accent)' : 'var(--text-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'variables' && (
          <div className="p-3 space-y-1">
            {!isRunning && variables.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No variables. Start debugging to see values.
              </div>
            )}
            {isRunning && evaluating && variables.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Running... waiting for breakpoint.
              </div>
            )}
            {variables.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                <span style={{ color: 'var(--accent)' }}>{v.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v.value}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.type}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'watch' && (
          <div className="p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={watchInput}
                onChange={e => setWatchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addWatch();
                }}
                placeholder="Add expression..."
                className="flex-1 px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
            {watchExpressions.length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No watch expressions. Type an expression and press Enter to add.
              </div>
            )}
            {watchExpressions.map((expr, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-0.5 group">
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{expr}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {evaluateWatch(expr)}
                </span>
                <button
                  onClick={() => removeWatch(i)}
                  className="text-[10px] ml-auto opacity-0 group-hover:opacity-100"
                  style={{ color: 'var(--text-muted)' }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'callstack' && (
          <div className="p-3 space-y-1">
            {stackFrames.length === 0 ? (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                {isRunning ? 'Paused state will show here.' : 'No call stack. Start debugging to see paused state.'}
              </div>
            ) : (
              stackFrames.map((frame) => (
                <div key={frame.id} className="text-xs py-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{frame.name}</span>
                  <span className="ml-2" style={{ color: 'var(--text-muted)' }}>{frame.file}:{frame.line}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'breakpoints' && (
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {breakpoints.filter(b => b.enabled).length} active / {breakpoints.length} total
              </span>
              {breakpoints.length > 0 && (
                <button
                  onClick={removeAllBreakpoints}
                  className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-80"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}
                >
                  Remove All
                </button>
              )}
            </div>
            {breakpoints.length === 0 ? (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No breakpoints. Click the gutter in the editor to add breakpoints.
              </div>
            ) : (
              breakpoints.map((bp) => (
                <div key={bp.id} className="flex items-center gap-2 text-xs py-0.5 group">
                  <input
                    type="checkbox"
                    checked={bp.enabled}
                    onChange={() => toggleBreakpoint(bp.id)}
                    className="w-3 h-3"
                  />
                  <span style={{ color: bp.enabled ? 'var(--error)' : 'var(--text-muted)' }}>●</span>
                  <span style={{ color: bp.enabled ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {bp.file}:{bp.line}
                  </span>
                  <button
                    onClick={() => removeBreakpoint(bp.id)}
                    className="text-[10px] ml-auto opacity-0 group-hover:opacity-100"
                    style={{ color: 'var(--text-muted)' }}
                  >✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

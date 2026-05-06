import { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../stores/useIDEStore';

interface Problem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  message: string;
  source: string;
}

interface MonacoMarker {
  owner: string;
  resource: { path: string };
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string | { value: string };
}

function severityLabel(sev: number): 'error' | 'warning' | 'info' {
  if (sev === 8) return 'error';
  if (sev === 4) return 'warning';
  return 'info';
}

function fileNameFromPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function markerToProblem(m: MonacoMarker, index: number): Problem {
  const path = m.resource?.path || 'unknown';
  const source = typeof m.code === 'object' && m.code !== null ? (m.code as { value: string }).value : (typeof m.code === 'string' ? m.code : m.owner);
  return {
    id: `marker-${path}-${m.startLineNumber}-${m.startColumn}-${index}`,
    severity: severityLabel(m.severity),
    file: path,
    line: m.startLineNumber,
    column: m.startColumn,
    message: m.message,
    source,
  };
}

function readMonacoMarkers(): Problem[] {
  try {
    const monaco = (window as unknown as { monaco?: { editor?: { getModelMarkers?: (filter?: { owner?: string }) => MonacoMarker[] } } }).monaco;
    if (!monaco?.editor?.getModelMarkers) return [];
    const markers = monaco.editor.getModelMarkers({});
    return markers
      .filter(m => m.severity >= 2 && m.message && m.message.trim())
      .map((m, i) => markerToProblem(m, i));
  } catch {
    return [];
  }
}

export function ProblemsPanel() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const { openFile, setBottomPanelActive } = useIDEStore();

  useEffect(() => {
    const poll = () => {
      setProblems(readMonacoMarkers());
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, []);

  const handleClick = useCallback((p: Problem) => {
    const name = fileNameFromPath(p.file);
    const ext = p.file.split('.').pop() || 'plaintext';
    openFile(p.file, name, ext);
    setBottomPanelActive('problems');
  }, [openFile, setBottomPanelActive]);

  const filtered = filter === 'all' ? problems : problems.filter(p => p.severity === filter);
  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;
  const infoCount = problems.filter(p => p.severity === 'info').length;

  const severityConfig = {
    error: { color: 'var(--error)', icon: '✗' },
    warning: { color: 'var(--warning)', icon: '⚠' },
    info: { color: 'var(--info)', icon: 'ℹ' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setFilter('all')}
          className="px-2 py-0.5 rounded"
          style={{ background: filter === 'all' ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-secondary)' }}
        >
          All ({problems.length})
        </button>
        <button
          onClick={() => setFilter('error')}
          className="px-2 py-0.5 rounded"
          style={{ background: filter === 'error' ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--error)' }}
        >
          Errors ({errorCount})
        </button>
        <button
          onClick={() => setFilter('warning')}
          className="px-2 py-0.5 rounded"
          style={{ background: filter === 'warning' ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--warning)' }}
        >
          Warnings ({warningCount})
        </button>
        {infoCount > 0 && (
          <button
            onClick={() => setFilter('info')}
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: filter === 'info' ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--info)' }}
          >
            Info ({infoCount})
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>
            {problems.length === 0 ? 'No problems detected in workspace.' : 'No matching problems.'}
          </div>
        ) : (
          filtered.map(p => (
            <div
              key={p.id}
              onClick={() => handleClick(p)}
              className="flex items-start gap-2 px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ color: severityConfig[p.severity].color, marginTop: '1px' }}>{severityConfig[p.severity].icon}</span>
              <div className="min-w-0">
                <div className="truncate" style={{ color: 'var(--text-primary)' }}>{p.message}</div>
                <div className="flex gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{fileNameFromPath(p.file)}:{p.line}:{p.column}</span>
                  <span>{p.source}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

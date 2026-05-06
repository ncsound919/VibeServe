import { useState, useEffect, useRef } from 'react';
import { useToastStore } from '../../stores/useToastStore';

interface Task { name: string; command: string; type: string; }

export function TaskRunner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetch('/api/tasks/list')
      .then(r => r.json())
      .then(setTasks)
      .catch(() => addToast({ type: 'error', message: 'Failed to load tasks' }))
      .finally(() => setLoading(false));
  }, [addToast]);

  const runTask = async (task: Task) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(task.name);
    setOutput(`Running: ${task.command}...\n`);
    try {
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: task.command }),
        signal: controller.signal,
      });
      const text = await res.text();
      setOutput(prev => prev + text);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setOutput(prev => prev + '\nTask aborted.');
      } else {
        setOutput(prev => prev + `\nError: ${err.message}`);
        addToast({ type: 'error', message: `Task ${task.name} failed: ${err.message}` });
      }
    }
    setRunning(null);
    abortRef.current = null;
  };

  if (loading) return <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>Loading tasks...</div>;

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tasks</div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>No package.json scripts found.</div>
        ) : (
          tasks.map(t => (
            <div
              key={t.name}
              tabIndex={0}
              role="button"
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80"
              onClick={() => runTask(t)}
              onKeyDown={(e) => { if (e.key === 'Enter') runTask(t); }}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{t.type}</span>
              <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
              <span className="font-mono text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>{t.command}</span>
              {running === t.name && <span className="animate-pulse" style={{ color: 'var(--accent)' }}>...</span>}
            </div>
          ))
        )}
      </div>
      {output && (
        <div className="p-3 font-mono text-[11px] whitespace-pre-wrap overflow-auto" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', maxHeight: '40%' }}>
          {output}
        </div>
      )}
    </div>
  );
}

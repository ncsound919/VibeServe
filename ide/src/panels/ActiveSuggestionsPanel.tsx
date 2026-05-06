import { useState, useEffect, useCallback } from 'react';
import { useIDEStore } from '../stores/useIDEStore';
import type { Suggestion } from '../types/suggestions';

export function ActiveSuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openFile } = useIDEStore();

  const apiBase = import.meta.env?.VITE_API_URL || (window.location.port === '3000' ? 'http://localhost:3002' : '');

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('nexus_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const openGoalInAgendaPanel = (goalId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goalId) return;
    import('../stores/useIDEStore').then(({ useIDEStore }) => {
      useIDEStore.getState().setActivePanel('agenda');
    });
  };

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/pipeline/suggestions/pending`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } else {
        setError(`API unreachable (${res.status}). Check that the server is running.`);
        setSuggestions([]);
        setLoading(false);
        return;
      }
    } catch {
      setError('API unreachable. Check that the server is running.');
      setSuggestions([]);
    }
    setLoading(false);
  }, [apiBase]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  useEffect(() => {
    let wsClient: { close: () => void } | null = null;
    import('../ws-client').then(({ createWSClient }) => {
      const wsUrl = apiBase ? `${apiBase.replace('http', 'ws')}/ws` : `ws://${window.location.hostname}:3002/ws`;
      const token = localStorage.getItem('nexus_token');
      wsClient = createWSClient(wsUrl + (token ? `?token=${token}` : ''), {
        maxRetries: 5,
        onMessage: (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'bg:suggestions') {
              const items = msg.suggestions || [];
              setSuggestions(prev => {
                const merged = [...prev];
                for (const item of items) {
                  const idx = merged.findIndex(x => x.id === item.id);
                  if (idx >= 0) merged[idx] = { ...merged[idx], ...item };
                  else merged.push(item);
                }
                return merged;
              });
            }
          } catch { /* ignore */ }
        },
      });
    });
    return () => { wsClient?.close(); };
  }, [apiBase]);

  const handleApply = async (s: Suggestion, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${apiBase}/api/pipeline/suggestions/apply`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ suggestionId: s.id, filePath: s.filePath, repoName: s.repoName }),
      });
      const result = await res.json();
      if (res.ok) {
        setSuggestions(prev => prev.map(x =>
          x.id === s.id ? { ...x, verificationStatus: result.verification?.status || 'not-run' } : x
        ));
        import('../stores/toastStore').then(({ useToastStore }) => {
          const message = `Applied: ${s.title}\nVerification: ${result.verification?.status || 'unknown'}`;
          useToastStore.getState().addToast({ type: 'success', message });
        });
      } else {
        import('../stores/toastStore').then(({ useToastStore }) => {
          const message = `Apply failed: ${result.error || 'Unknown error'}`;
          useToastStore.getState().addToast({ type: 'error', message });
        });
      }
    } catch (err: any) {
      import('../stores/toastStore').then(({ useToastStore }) => {
        useToastStore.getState().addToast({ type: 'error', message: `Apply error: ${err.message}` });
      });
    }
  };

  const typeIcons: Record<string, string> = {
    fix: '\u26A0', refactor: '\u2699', test: '\u2714', reuse: '\u21C4',
    docs: '\u2139', chore: '\u270C', perf: '\u26A1', security: '\u{1F512}',
  };

  const typeColors: Record<string, string> = {
    fix: '#f38ba8', refactor: '#89b4fa', test: '#a6e3a1', reuse: '#cba6f7',
    docs: '#f9e2af', chore: '#94e2d5', perf: '#fab387', security: '#f9e2af',
  };

  const verificationColors: Record<string, string> = {
    'not-run': '#6c7086', 'passing': '#a6e3a1', 'failing': '#f38ba8', 'running': '#f9e2af',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, #1e1e2e)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6c7086)' }}>
          Active Suggestions
        </span>
        <button onClick={fetchSuggestions} className="text-xs px-2 py-0.5 rounded hover:brightness-110"
          style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {error && (
          <div className="text-xs mb-2 p-2 rounded" style={{ color: '#f38ba8', backgroundColor: 'var(--bg-tertiary, #313244)' }}>
            {error}
            <button onClick={fetchSuggestions} className="ml-2 underline">Retry</button>
          </div>
        )}

        {suggestions.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
            No suggestions yet. Index your repo and set an agenda to get actionable suggestions.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="p-2 rounded cursor-pointer hover:brightness-110 transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary, #313244)', borderLeft: `3px solid ${typeColors[s.type] || '#6c7086'}` }}
                onClick={() => s.filePath && openFile(s.filePath, s.filePath.split('/').pop() || 'unknown', 'typescript')}>
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{typeIcons[s.type] || '?'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                        {s.title}
                      </div>
                      <button onClick={(e) => handleApply(s, e)}
                        className="text-[10px] px-1.5 py-0.5 rounded hover:brightness-125"
                        style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}>
                        Apply
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      {s.goalId ? (
                        <button onClick={(e) => openGoalInAgendaPanel(s.goalId, e)}
                          className="text-[10px] px-1.5 py-0.5 rounded hover:brightness-110"
                          style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-muted, #6c7086)', border: '1px solid #45475a' }}>
                          Goal: {s.goalTitle || 'Unknown'}
                        </button>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted, #6c7086)', border: '1px solid #45475a' }}>
                          Unaligned
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: verificationColors[s.verificationStatus || 'not-run'], backgroundColor: verificationColors[s.verificationStatus || 'not-run'] + '22' }}>
                        {s.verificationStatus === 'passing' ? 'Verified' : s.verificationStatus === 'failing' ? 'Failed' : s.verificationStatus === 'running' ? 'Verifying...' : 'Not verified'}
                      </span>
                    </div>
                    <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
                      {s.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

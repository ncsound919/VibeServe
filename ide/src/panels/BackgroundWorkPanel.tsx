import { useState, useEffect, useCallback } from 'react';
import type { Suggestion } from '../types/suggestions';

interface RepoInfo {
  repo_key: string;
  repo_name: string;
  file_count: number;
  symbol_count: number;
  indexed_at: string;
}

type Tab = 'while-you-were-away' | 'refactors' | 'test-gaps' | 'reuse';

export function BackgroundWorkPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('while-you-were-away');
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoToIndex, setRepoToIndex] = useState('.');
  const [lastSessionTime, setLastSessionTime] = useState(() => Date.now());
  const apiBase = import.meta.env?.VITE_API_URL || (window.location.port === '3000' ? 'http://localhost:3002' : '');

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('nexus_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('nexus_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${apiBase}/api/pipeline/mcp_call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, args }),
    });
    if (!res.ok) throw new Error(`MCP call failed: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result || data;
  }, [apiBase]);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/pipeline/suggestions/pending`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch { setError('Failed to load suggestions'); }
  }, [apiBase]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/pipeline/suggestions/pending`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
      const reposRes = await callMcp('list_indexed_repos').catch(() => ({ repos: [] }));
      setRepos(reposRes.repos || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLastSessionTime(Date.now());
    }
  }, [apiBase, callMcp]);

  useEffect(() => {
    loadSuggestions();
    loadAll();
  }, []);

  useEffect(() => {
    let wsClient: { close: () => void } | null = null;
    import('../ws-client').then(({ createWSClient }) => {
      const wsUrl = apiBase ? `${apiBase.replace('http', 'ws')}/ws` : `ws://${window.location.hostname}:3002/ws`;
      const token = localStorage.getItem('nexus_token');
      wsClient = createWSClient(wsUrl + (token ? `?token=${token}` : ''), {
        maxRetries: 5,
        onMessage: () => { loadSuggestions(); },
      });
    });
    return () => { wsClient?.close(); };
  }, [apiBase, loadSuggestions]);

  const indexRepo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await callMcp('index_repo', { repo_path: repoToIndex });
      await loadAll();
      setRepoToIndex('.');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [repoToIndex, callMcp, loadAll]);

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
        if (result.verification?.status === 'passing') {
          import('../stores/toastStore').then(({ useToastStore }) => {
            useToastStore.getState().addToast({
              type: 'info',
              message: `Ready to commit: ${s.title}. Run 'git add -A && git commit -m "feat(${s.repoName}): ${s.title} [goal:${s.goalId}]"'`,
            });
          });
        }
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

  const openGoalInAgenda = (goalId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goalId) return;
    import('../stores/useIDEStore').then(({ useIDEStore }) => {
      useIDEStore.getState().setActivePanel('agenda');
    });
  };

  const typeColors: Record<string, string> = {
    fix: '#f38ba8', refactor: '#89b4fa', test: '#a6e3a1', reuse: '#cba6f7',
    docs: '#f9e2af', chore: '#94e2d5', perf: '#fab387', security: '#f9e2af',
  };

  const verificationColors: Record<string, string> = {
    'not-run': '#6c7086', 'passing': '#a6e3a1', 'failing': '#f38ba8', 'running': '#f9e2af',
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (activeTab === 'reuse') return s.type === 'reuse';
    if (activeTab === 'test-gaps') return s.type === 'test';
    if (activeTab === 'refactors') return s.type === 'refactor';
    return true;
  });

  const goalGroups: Record<string, Suggestion[]> = {};
  for (const s of filteredSuggestions) {
    const key = s.goalId || 'unaligned';
    if (!goalGroups[key]) goalGroups[key] = [];
    goalGroups[key].push(s);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'while-you-were-away', label: 'While You Were Away', count: suggestions.length },
    { id: 'reuse', label: 'Reuse', count: suggestions.filter(s => s.type === 'reuse').length },
    { id: 'test-gaps', label: 'Test Gaps', count: suggestions.filter(s => s.type === 'test').length },
    { id: 'refactors', label: 'Refactors', count: suggestions.filter(s => s.type === 'refactor').length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, #1e1e2e)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6c7086)' }}>
          Background Work
        </span>
        <button onClick={loadAll} className="text-xs px-2 py-0.5 rounded hover:brightness-110"
          style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex-1 text-xxs py-1.5 transition-colors relative"
            style={{ color: activeTab === tab.id ? 'var(--accent, #89b4fa)' : 'var(--text-muted, #6c7086)', borderBottom: activeTab === tab.id ? '2px solid var(--accent, #89b4fa)' : '2px solid transparent' }}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full text-xxs" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Index bar */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <div className="flex gap-1">
          <input value={repoToIndex} onChange={(e) => setRepoToIndex(e.target.value)} placeholder="Repo path (e.g., '.' for current)"
            className="flex-1 text-xs px-2 py-1 rounded border focus:outline-none"
            style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
            onKeyDown={(e) => e.key === 'Enter' && indexRepo()} />
          <button onClick={indexRepo} disabled={loading} className="text-xs px-2 py-1 rounded hover:brightness-110"
            style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}>
            Index
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch(`${apiBase}/api/pipeline/scheduler/trigger`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                  body: JSON.stringify({ type: 'gitnexus-analyze', repos: [repoToIndex || '.'] }),
                });
                if (res.ok) {
                  await loadSuggestions();
                }
              } catch (err: any) { setError(err.message); }
              setLoading(false);
            }}
            disabled={loading}
            className="text-xs px-2 py-1 rounded hover:brightness-110"
            style={{ backgroundColor: '#a6e3a1', color: '#1e1e2e' }}>
            GN Index
          </button>
        </div>
        {repos.length > 0 && (
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {repos.map(r => (
              <span key={r.repo_key} className="text-xxs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}>
                {r.repo_name} ({r.symbol_count} symbols)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!loading && suggestions.length > 0 && (
          <div className="mb-3 p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
            <div className="text-xs" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
              {suggestions.length} new suggestion{suggestions.length !== 1 ? 's' : ''} while you were away
            </div>
            <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
              {(() => {
                const goalIds = new Set(suggestions.filter(s => s.goalId).map(s => s.goalId));
                return `${goalIds.size} goal${goalIds.size !== 1 ? 's' : ''} targeted`;
              })()}
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs mb-2 p-2 rounded" style={{ color: 'var(--error, #f38ba8)', backgroundColor: 'var(--bg-tertiary, #313244)' }}>
            {error}
          </div>
        )}

        {filteredSuggestions.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
            No suggestions yet. Index a repo above to see background analysis.
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(goalGroups).map(([goalKey, items]) => (
              <div key={goalKey}>
                {goalKey !== 'unaligned' && items[0]?.goalTitle && (
                  <div className="text-xxs font-semibold mb-1 px-1" style={{ color: 'var(--accent, #89b4fa)' }}>
                    Goal: {items[0].goalTitle} ({items.length})
                  </div>
                )}
                {goalKey === 'unaligned' && (
                  <div className="text-xxs font-semibold mb-1 px-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    Unaligned ({items.length})
                  </div>
                )}
                {items.map((s) => (
                  <div key={s.id} className="p-2 rounded hover:brightness-110 transition-colors"
                    style={{ backgroundColor: 'var(--bg-tertiary, #313244)', borderLeft: `3px solid ${typeColors[s.type] || '#6c7086'}` }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                          {s.title}
                        </div>
                        <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
                          {s.description}
                        </div>
                        {s.filePath && (
                          <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
                            {s.filePath}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {s.goalId ? (
                            <button onClick={(e) => openGoalInAgenda(s.goalId, e)}
                              className="text-[10px] px-1.5 py-0.5 rounded hover:brightness-110"
                              style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-muted, #6c7086)', border: '1px solid #45475a' }}>
                              Goal: {s.goalTitle || 'Unknown'}
                            </button>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted, #6c7086)', border: '1px solid #45475a' }}>
                              Unaligned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2">
                        <button onClick={(e) => handleApply(s, e)}
                          className="text-[10px] px-1.5 py-0.5 rounded hover:brightness-125"
                          style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}>
                          Apply
                        </button>
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: verificationColors[s.verificationStatus || 'not-run'], backgroundColor: verificationColors[s.verificationStatus || 'not-run'] + '22' }}>
                          {s.verificationStatus === 'passing' ? 'OK' : s.verificationStatus === 'failing' ? 'FAIL' : s.verificationStatus === 'running' ? '...' : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

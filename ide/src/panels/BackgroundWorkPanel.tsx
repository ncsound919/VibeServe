import { useState, useEffect, useCallback } from 'react';

interface RepoInfo {
  repo_key: string;
  repo_name: string;
  file_count: number;
  symbol_count: number;
  indexed_at: string;
}

interface TestGap {
  file: string;
  symbol: string;
  kind: string;
  repo: string;
  repo_key: string;
  suggestion: string;
}

interface RefactorTarget {
  file?: string;
  symbol?: string;
  repo: string;
  repo_key: string;
  symbol_count?: number;
  suggestion_type: string;
  reasoning: string;
  files?: string[];
}

interface CrossRepoSuggestion {
  symbol: {
    name: string;
    kind: string;
    file_path: string;
    repo_key: string;
  };
  from_repo: string;
  from_name: string;
  suggestion_type: string;
  reasoning: string;
}

type Tab = 'while-you-were-away' | 'refactors' | 'test-gaps' | 'reuse';

export function BackgroundWorkPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('while-you-were-away');
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [testGaps, setTestGaps] = useState<TestGap[]>([]);
  const [refactors, setRefactors] = useState<RefactorTarget[]>([]);
  const [reuseSuggestions, setReuseSuggestions] = useState<CrossRepoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoToIndex, setRepoToIndex] = useState('.');

  const apiBase = window.location.port === '3000' ? 'http://localhost:3002' : '';

  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const res = await fetch(`${apiBase}/api/pipeline/mcp_call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, args }),
    });
    if (!res.ok) throw new Error(`MCP call failed: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result || data;
  }, [apiBase]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reposData, gapsData, refactorsData, reuseData] = await Promise.all([
        callMcp('list_indexed_repos').catch(() => ({ repos: [] })),
        callMcp('find_test_gaps').catch(() => ({ gaps: [] })),
        callMcp('find_refactors').catch(() => ({ targets: [] })),
        callMcp('cross_repo_suggest').catch(() => ({ suggestions: [] })),
      ]);
      setRepos(reposData.repos || []);
      setTestGaps(gapsData.gaps || []);
      setRefactors(refactorsData.targets || []);
      setReuseSuggestions(reuseData.suggestions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [callMcp]);

  useEffect(() => { loadAll(); }, []);

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

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'while-you-were-away', label: 'While You Were Away', count: repos.length },
    { id: 'reuse', label: 'Reuse', count: reuseSuggestions.length },
    { id: 'test-gaps', label: 'Test Gaps', count: testGaps.length },
    { id: 'refactors', label: 'Refactors', count: refactors.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary, #1e1e2e)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #6c7086)' }}>
          Background Work
        </span>
        <button
          onClick={loadAll}
          className="text-xs px-2 py-0.5 rounded hover:brightness-110"
          style={{ backgroundColor: 'var(--bg-tertiary, #313244)', color: 'var(--text-muted, #6c7086)' }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 text-xxs py-1.5 transition-colors relative"
            style={{
              color: activeTab === tab.id ? 'var(--accent, #89b4fa)' : 'var(--text-muted, #6c7086)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent, #89b4fa)' : '2px solid transparent',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded-full text-xxs" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Index repo bar */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border, #313244)' }}>
        <div className="flex gap-1">
          <input
            value={repoToIndex}
            onChange={(e) => setRepoToIndex(e.target.value)}
            placeholder="Repo path (e.g., '.' for current)"
            className="flex-1 text-xs px-2 py-1 rounded border focus:outline-none"
            style={{ backgroundColor: 'var(--bg-primary, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)', borderColor: 'var(--border, #313244)' }}
            onKeyDown={(e) => e.key === 'Enter' && indexRepo()}
          />
          <button
            onClick={indexRepo}
            disabled={loading}
            className="text-xs px-2 py-1 rounded hover:brightness-110"
            style={{ backgroundColor: 'var(--accent, #89b4fa)', color: 'var(--bg-primary, #1e1e2e)' }}
          >
            Index
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
        {error && (
          <div className="text-xs mb-2 p-2 rounded" style={{ color: 'var(--error, #f38ba8)', backgroundColor: 'var(--bg-tertiary, #313244)' }}>
            {error}
          </div>
        )}

        {/* While You Were Away */}
        {activeTab === 'while-you-were-away' && (
          <div className="space-y-2">
            {repos.length === 0 && !loading ? (
              <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
                No repos indexed yet.
                <br />
                <span className="mt-1 block">Index a repo above to see background analysis.</span>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                  Indexed Repos ({repos.length})
                </div>
                {repos.map(r => (
                  <div key={r.repo_key} className="p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>{r.repo_name}</div>
                    <div className="flex gap-2 mt-1 text-xxs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                      <span>{r.file_count} files</span>
                      <span>{r.symbol_count} symbols</span>
                      <span>Indexed {new Date(r.indexed_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                <div className="text-xs pt-2" style={{ color: 'var(--text-muted, #6c7086)' }}>
                  <strong>Test gaps found across repos:</strong> {testGaps.length}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                  <strong>Refactor targets:</strong> {refactors.length}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted, #6c7086)' }}>
                  <strong>Reuse opportunities:</strong> {reuseSuggestions.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Reuse */}
        {activeTab === 'reuse' && (
          <div className="space-y-2">
            {reuseSuggestions.length === 0 ? (
              <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
                Index multiple repos to see cross-repo reuse suggestions.
              </div>
            ) : (
              reuseSuggestions.map((s, i) => (
                <div key={i} className="p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                      {s.symbol.name}
                    </span>
                    <span className="text-xxs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent, #89b4fa)' + '22', color: 'var(--accent, #89b4fa)' }}>
                      {s.symbol.kind}
                    </span>
                  </div>
                  <div className="text-xxs mt-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    From <span style={{ color: 'var(--accent, #89b4fa)' }}>{s.from_name}</span> — {s.reasoning}
                  </div>
                  <div className="text-xxs mt-0.5" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    {s.symbol.file_path}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Test Gaps */}
        {activeTab === 'test-gaps' && (
          <div className="space-y-2">
            {testGaps.length === 0 ? (
              <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
                No test gaps found. All symbols have corresponding tests.
              </div>
            ) : (
              testGaps.map((g, i) => (
                <div key={i} className="p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)', borderLeft: '3px solid var(--warning, #f9e2af)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                      {g.symbol}
                    </span>
                    <span className="text-xxs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--warning, #f9e2af)' + '22', color: 'var(--warning, #f9e2af)' }}>
                      {g.kind}
                    </span>
                  </div>
                  <div className="text-xxs mt-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    {g.file} — {g.repo}
                  </div>
                  <div className="text-xxs mt-1 italic" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    {g.suggestion}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Refactors */}
        {activeTab === 'refactors' && (
          <div className="space-y-2">
            {refactors.length === 0 ? (
              <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted, #6c7086)' }}>
                No refactor targets found. Codebase looks clean.
              </div>
            ) : (
              refactors.map((r, i) => (
                <div key={i} className="p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary, #313244)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                      {r.suggestion_type === 'split_file' ? r.file : r.symbol}
                    </span>
                    <span className="text-xxs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent, #89b4fa)' + '22', color: 'var(--accent, #89b4fa)' }}>
                      {r.suggestion_type}
                    </span>
                  </div>
                  <div className="text-xxs mt-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                    {r.reasoning}
                  </div>
                  {r.files && r.files.length > 1 && (
                    <div className="text-xxs mt-1" style={{ color: 'var(--text-muted, #6c7086)' }}>
                      {r.files.join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

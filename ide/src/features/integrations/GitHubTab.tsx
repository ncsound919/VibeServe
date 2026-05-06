import { useState } from 'react';
import { useToastStore } from '../../stores/useToastStore';

interface GitHubRepo { name: string; full_name: string; description: string; stargazers_count: number; language: string; }

export function GitHubTab() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const { addToast } = useToastStore();

  const connect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.github.com/user/repos?per_page=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
        setIsConnected(true);
        addToast({ type: 'success', message: `Connected to GitHub (${data.length} repos)` });
      } else {
        addToast({ type: 'error', message: 'Invalid token or GitHub API error' });
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to connect to GitHub' });
    } finally {
      setLoading(false);
    }
  };

  const searchRepos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRepos(data.items || []);
      }
    } catch { /* fail silently */ }
    setLoading(false);
  };

  return (
    <div className="p-3 space-y-3 text-xs">
      {!isConnected && (
        <div className="space-y-2">
          <div style={{ color: 'var(--text-secondary)' }}>Connect to GitHub</div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="GitHub Personal Access Token..."
            className="w-full px-3 py-1.5 rounded"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <button
            onClick={connect}
            disabled={loading}
            className="w-full px-3 py-1.5 rounded font-medium"
            style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      )}

      {isConnected && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchRepos()}
              placeholder="Search GitHub repos..."
              className="flex-1 px-3 py-1.5 rounded"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button onClick={searchRepos} className="px-3 py-1.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              Search
            </button>
          </div>
          <div className="text-[10px]" style={{ color: 'var(--success)' }}>&#10003; Connected</div>
          {repos.map((repo, i) => (
            <div key={i} className="p-2 rounded" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="font-medium" style={{ color: 'var(--accent)' }}>{repo.full_name}</div>
              {repo.description && <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{repo.description}</div>}
              <div className="flex gap-3 mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {repo.language && <span>&#128309; {repo.language}</span>}
                <span>&#11088; {repo.stargazers_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { GitBranch, GitCommit, GitPullRequest, Circle } from 'lucide-react';

interface GitStatus {
  branch: string;
  modified: number;
  staged: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export function GitStatus() {
  const [status, setStatus] = useState<GitStatus>({
    branch: 'main',
    modified: 0,
    staged: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Simulate git status (in real app, call git commands via IPC or API)
    const mockStatus: GitStatus = {
      branch: 'feature/nexus-alpha',
      modified: 3,
      staged: 1,
      untracked: 2,
      ahead: 2,
      behind: 1,
    };
    setStatus(mockStatus);
  }, []);

  const totalChanges = status.modified + status.staged + status.untracked;

  return (
    <div className="px-3 py-2 border-b border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-300 font-medium">{status.branch}</span>
        </div>
        {totalChanges > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded">
            {totalChanges} changes
          </span>
        )}
      </div>

      {totalChanges > 0 && (
        <div className="space-y-1">
          {status.modified > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Circle className="w-2 h-2 fill-amber-400" />
              <span>{status.modified} modified</span>
            </div>
          )}
          {status.staged > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <GitCommit className="w-3 h-3" />
              <span>{status.staged} staged</span>
            </div>
          )}
          {status.untracked > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Circle className="w-2 h-2 fill-gray-500" />
              <span>{status.untracked} untracked</span>
            </div>
          )}
        </div>
      )}

      {(status.ahead > 0 || status.behind > 0) && (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-800">
          {status.ahead > 0 && (
            <span className="text-xs text-emerald-400">↑{status.ahead}</span>
          )}
          {status.behind > 0 && (
            <span className="text-xs text-red-400">↓{status.behind}</span>
          )}
        </div>
      )}
    </div>
  );
}

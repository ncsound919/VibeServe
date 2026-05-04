import React, { useEffect, useState } from 'react';
import { GitPullRequest, ExternalLink, Check, Clock, FileText } from 'lucide-react';

interface PRResult {
  id: string;
  repo: string;
  branch: string;
  diffPath: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'merged';
  timestamp: string;
}

export const PullRequestList: React.FC = () => {
  const [prs, setPrs] = useState<PRResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPr, setExpandedPr] = useState<string | null>(null);

  const fetchPrs = async () => {
    try {
      const resp = await fetch('/api/pipeline/prs');
      if (resp.ok) {
        const data = await resp.json();
        setPrs(data);
      }
    } catch (err) {
      console.error('Failed to fetch PRs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleHunkAction = async (prId: string, hunkId: string, status: 'approved' | 'rejected') => {
    try {
      const resp = await fetch(`/api/pipeline/prs/${prId}/hunks/${hunkId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (resp.ok) {
        const updatedPr = await resp.json();
        setPrs(prev => prev.map(p => p.id === prId ? updatedPr : p));
      }
    } catch (err) {
      console.error('Failed to update hunk:', err);
    }
  };

  useEffect(() => {
    fetchPrs();
    const timer = setInterval(fetchPrs, 10000);
    return () => clearInterval(timer);
  }, []);

  if (loading && prs.length === 0) return null;
  if (prs.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white/80 mb-4">
        <GitPullRequest size={16} className="text-purple-400" />
        Automated Pull Requests
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {prs.map((pr) => (
          <div key={pr.id} className="bg-[#151619] border border-[#2d2e32] rounded-lg overflow-hidden hover:border-purple-500/30 transition-all group">
            <div className="p-4 cursor-pointer" onClick={() => setExpandedPr(expandedPr === pr.id ? null : pr.id)}>
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <GitPullRequest size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">{pr.title}</div>
                    <div className="text-[10px] font-mono text-white/40 mt-1 flex items-center gap-2">
                      <span className="text-white/60">{pr.repo}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(pr.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span className="text-purple-400/80">{pr.branch}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="text-[10px] font-mono px-2 py-1 bg-white/5 rounded text-white/40 uppercase">
                    {pr.hunks.filter(h => h.status === 'approved').length}/{pr.hunks.length} Approved
                  </div>
                </div>
              </div>
            </div>

            {expandedPr === pr.id && (
              <div className="border-t border-[#2d2e32] bg-[#0c0d0f] p-4 space-y-4">
                <div className="text-[10px] font-mono text-white/60 uppercase mb-3">Review Changes</div>
                {pr.hunks.map((hunk) => (
                  <div key={hunk.id} className="border border-[#2d2e32] rounded bg-[#151619] overflow-hidden">
                    <div className="bg-[#1a1b1e] px-3 py-1.5 flex justify-between items-center border-b border-[#2d2e32]">
                      <div className="text-[10px] font-mono text-white/60 truncate max-w-[250px]">{hunk.file}</div>
                      <div className="flex gap-2">
                        {hunk.status === 'pending' ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleHunkAction(pr.id, hunk.id, 'rejected'); }}
                              className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] rounded font-bold uppercase transition-colors"
                            >Reject</button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleHunkAction(pr.id, hunk.id, 'approved'); }}
                              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold uppercase transition-colors"
                            >Approve</button>
                          </>
                        ) : (
                          <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${hunk.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            <Check size={10} /> {hunk.status}
                          </div>
                        )}
                      </div>
                    </div>
                    <pre className="p-3 text-[9px] font-mono text-white/80 overflow-x-auto whitespace-pre">
                      {hunk.diff}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

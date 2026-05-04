import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Clock, History, AlertTriangle, CheckCircle, XCircle, RefreshCcw, Sparkles, Bug, TrendingUp, Wrench, Zap } from 'lucide-react';
import { usePipelineStore } from '../stores/usePipelineStore';
import { cn } from '../lib/utils';

interface VibeHistoryEntry {
  id?: string;
  description: string;
  score: number;
  grade: string;
  timestamp: string;
  success: boolean;
  duration?: number;
}

interface ErrorStat {
  total: number;
  resolved: number;
  failureStreak: number;
  recentErrors?: Array<{ message: string; timestamp: string; resolved: boolean }>;
}

type FetchState = 'loading' | 'error' | 'empty' | 'populated';

export const HistoryTab = () => {
  const [vibeHistory, setVibeHistory] = useState<VibeHistoryEntry[]>([]);
  const [vibeState, setVibeState] = useState<FetchState>('loading');
  const [vibeError, setVibeError] = useState<string | null>(null);

  const [errorStats, setErrorStats] = useState<ErrorStat | null>(null);
  const [errorState, setErrorState] = useState<FetchState>('loading');
  const [errorFetchError, setErrorFetchError] = useState<string | null>(null);

  const fixHistory = usePipelineStore((s) => s.fixHistory);
  const fetchFixHistory = usePipelineStore((s) => s.fetchFixHistory);

  const fetchAll = useCallback(async () => {
    setVibeState('loading');
    setVibeError(null);

    try {
      const res = await fetch('/api/vibe/history');
      if (res.ok) {
        const data = await res.json();
        const list = data.history || data.results || data || [];
        setVibeHistory(Array.isArray(list) ? list : []);
        setVibeState(list.length > 0 ? 'populated' : 'empty');
      } else {
        setVibeState('empty');
      }
    } catch (err) {
      setVibeError(err instanceof Error ? err.message : String(err));
      setVibeState('error');
    }

    setErrorState('loading');
    setErrorFetchError(null);

    try {
      const res = await fetch('/api/nexus/errors');
      if (res.ok) {
        const data = await res.json();
        const stats = data.stats || data || {};
        setErrorStats({
          total: stats.totalErrors ?? 0,
          resolved: stats.resolvedErrors ?? 0,
          failureStreak: stats.currentFailureStreak ?? 0,
          recentErrors: Array.isArray(stats.errors) ? stats.errors : Array.isArray(data.errors) ? data.errors : [],
        });
        setErrorState('populated');
      } else {
        setErrorState('empty');
      }
    } catch (err) {
      setErrorFetchError(err instanceof Error ? err.message : String(err));
      setErrorState('error');
    }

    fetchFixHistory();
  }, [fetchFixHistory]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getGradeColor = (grade: string) => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'text-emerald-400';
    if (g.startsWith('B')) return 'text-blue-400';
    if (g.startsWith('C')) return 'text-amber-400';
    if (g.startsWith('D') || g.startsWith('F')) return 'text-red-400';
    return 'text-[#6B7280]';
  };

  const getGradeBg = (grade: string) => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'bg-emerald-500/10 border-emerald-500/20';
    if (g.startsWith('B')) return 'bg-blue-500/10 border-blue-500/20';
    if (g.startsWith('C')) return 'bg-amber-500/10 border-amber-500/20';
    if (g.startsWith('D') || g.startsWith('F')) return 'bg-red-500/10 border-red-500/20';
    return 'bg-[#2d2e32]/50 border-[#2d2e32]';
  };

  const resolvedPercent = errorStats ? (errorStats.total > 0 ? Math.round((errorStats.resolved / errorStats.total) * 100) : 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tighter">History & Logs</h2>
          <p className="text-[11px] text-[#9CA3AF] font-mono mt-1">Build scores, fix history, and error tracking</p>
        </div>
        <button
          aria-label="Refresh history"
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1b1e] border border-[#2d2e32] rounded-lg text-[10px] font-mono text-[#9CA3AF] hover:text-white hover:border-[#424348] focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
        >
          <RefreshCcw size={12} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-violet-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">VibeCoder Scores</h3>
          </div>

          <div className="space-y-3">
            {vibeState === 'loading' && (
              <div className="flex items-center justify-center py-12">
                <RefreshCcw size={20} className="animate-spin text-emerald-500" />
              </div>
            )}

            {vibeState === 'error' && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle size={20} className="text-red-400 mb-2" />
                <p className="text-[10px] text-[#6B7280] font-mono">{vibeError}</p>
                <button aria-label="Retry loading history" onClick={fetchAll} className="mt-3 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all">
                  Retry
                </button>
              </div>
            )}

            {vibeState === 'empty' && (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-[#1a1b1e]/30 border border-[#2d2e32] rounded-xl">
                <Sparkles size={20} className="text-[#6B7280] mb-2" />
                <p className="text-[11px] text-[#9CA3AF] font-mono">No build history yet</p>
                <p className="text-[10px] text-[#6B7280] font-mono mt-1">Generate an app to populate scores</p>
              </div>
            )}

            {vibeState === 'populated' && vibeHistory.map((entry, i) => (
              <motion.div
                key={entry.id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn('border rounded-xl p-4 transition-all', getGradeBg(entry.grade))}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-mono text-white truncate pr-2">{entry.description}</p>
                  <span className={cn('text-xs font-mono font-bold shrink-0', getGradeColor(entry.grade))}>
                    {entry.grade}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7280]">
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <span>Score: {entry.score}</span>
                    {entry.duration != null && <span>{entry.duration}ms</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={16} className="text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Fix History</h3>
            {fixHistory.length > 0 && (
              <span className="text-[10px] font-mono text-[#6B7280]">({fixHistory.length})</span>
            )}
          </div>

          <div className="space-y-3">
            {fixHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-[#1a1b1e]/30 border border-[#2d2e32] rounded-xl">
                <Wrench size={20} className="text-[#6B7280] mb-2" />
                <p className="text-[11px] text-[#9CA3AF] font-mono">No fix history recorded</p>
                <p className="text-[10px] text-[#6B7280] font-mono mt-1">Pipeline auto-fixes will appear here</p>
              </div>
            )}

            {fixHistory.map((fix, i) => (
              <motion.div
                key={`${fix.executionId}-${fix.phase}-${fix.timestamp}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 hover:border-[#424348] transition-all"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {fix.fixed ? (
                      <CheckCircle size={14} className="text-emerald-400" />
                    ) : (
                      <XCircle size={14} className="text-red-400" />
                    )}
                    <span className="text-[11px] font-mono text-white">{fix.phase}</span>
                  </div>
                  <span className={cn(
                    'text-[9px] font-mono px-1.5 py-0.5 rounded',
                    fix.fixed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
                  )}>
                    {fix.fixed ? 'FIXED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-[10px] text-[#9CA3AF] font-mono mb-1">{fix.diagnosis}</p>
                <div className="flex items-center gap-3 text-[9px] font-mono text-[#6B7280]">
                  <span>{new Date(fix.timestamp).toLocaleString()}</span>
                  <span>{fix.attempts} attempt{fix.attempts !== 1 ? 's' : ''}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Bug size={16} className="text-red-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Error Tracking</h3>
          </div>

          {errorState === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <RefreshCcw size={20} className="animate-spin text-emerald-500" />
            </div>
          )}

          {errorState === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle size={20} className="text-red-400 mb-2" />
              <p className="text-[10px] text-[#6B7280] font-mono">{errorFetchError}</p>
              <button aria-label="Retry loading errors" onClick={fetchAll} className="mt-3 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all">
                Retry
              </button>
            </div>
          )}

          {errorState === 'populated' && errorStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 text-center">
                  <div className="text-lg font-mono font-bold text-white">{errorStats.total}</div>
                  <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">Total</div>
                </div>
                <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 text-center">
                  <div className="text-lg font-mono font-bold text-emerald-400">{errorStats.resolved}</div>
                  <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">Resolved</div>
                </div>
                <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4 text-center">
                  <div className={cn('text-lg font-mono font-bold', errorStats.failureStreak > 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {errorStats.failureStreak}
                  </div>
                  <div className="text-[9px] text-[#6B7280] font-mono mt-0.5">Streak</div>
                </div>
              </div>

              <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-mono text-[#9CA3AF] uppercase tracking-widest">Resolution Rate</span>
                </div>
                <div className="w-full h-2 bg-[#0a0a0c] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${resolvedPercent}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-mono text-[#6B7280]">{resolvedPercent}% resolved</span>
                  <span className="text-[9px] font-mono text-[#6B7280]">{errorStats.resolved}/{errorStats.total}</span>
                </div>
              </div>

              {errorStats.recentErrors && errorStats.recentErrors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-widest">Recent Errors</span>
                  {errorStats.recentErrors.slice(0, 10).map((err, i) => (
                    <div
                      key={`err-${i}`}
                      className="bg-[#1a1b1e]/50 border border-[#2d2e32] rounded-lg p-3"
                    >
                      <div className="flex items-start gap-2">
                        {err.resolved ? (
                          <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-[#9CA3AF] truncate">{err.message}</p>
                          <span className="text-[9px] font-mono text-[#6B7280]">
                            {new Date(err.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {errorState === 'empty' && (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-[#1a1b1e]/30 border border-[#2d2e32] rounded-xl">
              <Bug size={20} className="text-[#6B7280] mb-2" />
              <p className="text-[11px] text-[#9CA3AF] font-mono">No error data available</p>
              <p className="text-[10px] text-[#6B7280] font-mono mt-1">Start the server to begin tracking</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

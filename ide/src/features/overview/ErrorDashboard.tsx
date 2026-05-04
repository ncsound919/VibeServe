import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Activity, Flame, TrendingUp, Bug, Shield, Server, Wifi, Lock, FileWarning } from 'lucide-react';

const CATEGORY_ICONS: Record<string, typeof Bug> = {
  network: Wifi, build: Activity, dependency: Server, api: TrendingUp, security: Lock, system: FileWarning, unknown: Bug,
};
const CATEGORY_COLORS: Record<string, string> = {
  network: 'text-blue-400', build: 'text-amber-400', dependency: 'text-purple-400',
  api: 'text-cyan-400', security: 'text-red-400', system: 'text-orange-400', unknown: 'text-gray-400',
};
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400', medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400', critical: 'bg-red-500/20 text-red-400',
};

interface TrackedError {
  id: string; message: string; category: string; severity: string;
  phase: string; timestamp: string; resolved: boolean; recoveryAttempts: number; recoveryAction?: string;
}
interface ErrorStats {
  totalErrors: number; resolvedErrors: number; recentFailureCount: number;
  currentFailureStreak: number; longestFailureStreak: number;
  errorsByCategory: Record<string, number>; errorsBySeverity: Record<string, number>;
}

export const ErrorDashboard = () => {
  const queryClient = useQueryClient();

  const { data: errorData, isLoading } = useQuery({
    queryKey: ['nexus-errors'],
    queryFn: async () => {
      const res = await fetch('/api/nexus/errors');
      if (!res.ok) throw new Error('Failed to fetch errors');
      return res.json() as Promise<{ stats: ErrorStats; recent: TrackedError[]; ts: number }>;
    },
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: async (errorId: string) => {
      const res = await fetch('/api/nexus/errors/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorId }),
      });
      if (!res.ok) throw new Error('Failed to resolve');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nexus-errors'] }),
  });

  const { data: recoveryData } = useQuery({
    queryKey: ['nexus-recovery'],
    queryFn: async () => {
      const res = await fetch('/api/nexus/errors/recovery');
      if (!res.ok) throw new Error('Failed to fetch recovery patterns');
      return res.json() as Promise<{ patterns: any[]; ts: number }>;
    },
  });

  const stats = errorData?.stats;
  const errors = errorData?.recent || [];

  const failureRate = stats ? ((stats.currentFailureStreak / Math.max(stats.totalErrors, 1)) * 100) : 0;

  return (
    <div data-testid="error-dashboard" className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Bug size={18} className="text-red-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Error Tracking & Self-Healing</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
        {stats && stats.currentFailureStreak > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30">
            <Flame size={10} className="text-red-400 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400">Active Failures</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[#4a4b50] font-mono text-xs">Loading error stats...</div>
      ) : !stats ? (
        <div className="text-center py-8 text-[#4a4b50] font-mono text-xs">No error data available</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div data-testid="error-stat" whileHover={{ scale: 1.02 }} className="bg-[#151619] border border-red-500/20 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={14} className="text-red-400" />
                <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Total</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.totalErrors}</div>
              <div className="text-[10px] font-mono text-[#4a4b50] mt-1">{stats.resolvedErrors} resolved</div>
            </motion.div>

            <motion.div data-testid="error-stat" whileHover={{ scale: 1.02 }} className="bg-[#151619] border border-amber-500/20 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Failure Streak</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.currentFailureStreak}</div>
              <div className="text-[10px] font-mono text-[#4a4b50] mt-1">Longest: {stats.longestFailureStreak}</div>
            </motion.div>

            <motion.div data-testid="error-stat" whileHover={{ scale: 1.02 }} className="bg-[#151619] border border-purple-500/20 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-purple-400" />
                <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Recent 24h</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">{stats.recentFailureCount}</div>
              <div className="text-[10px] font-mono text-[#4a4b50] mt-1">unresolved</div>
            </motion.div>

            <motion.div data-testid="error-stat" whileHover={{ scale: 1.02 }} className="bg-[#151619] border border-blue-500/20 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-blue-400" />
                <span className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Recovery Rate</span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {stats.totalErrors > 0 ? ((stats.resolvedErrors / stats.totalErrors) * 100).toFixed(0) : 100}%
              </div>
              <div className="text-[10px] font-mono text-[#4a4b50] mt-1">self-healed</div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-3">By Category</h4>
              <div className="space-y-2">
                {Object.entries(stats.errorsByCategory).filter(([, count]) => count > 0).map(([cat, count]) => {
                  const Icon = CATEGORY_ICONS[cat] || Bug;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={12} className={CATEGORY_COLORS[cat] || 'text-gray-400'} />
                        <span className="text-xs font-mono text-[#8E9299] capitalize">{cat}</span>
                      </div>
                      <span className="text-xs font-mono text-white">{count}</span>
                    </div>
                  );
                })}
                {!Object.values(stats.errorsByCategory).some(v => v > 0) && (
                  <div className="text-[10px] text-[#4a4b50] font-mono italic">No errors recorded</div>
                )}
              </div>
            </div>

            <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-3">By Severity</h4>
              <div className="space-y-2">
                {Object.entries(stats.errorsBySeverity).filter(([, count]) => count > 0).map(([sev, count]) => (
                  <div key={sev} className="flex items-center justify-between">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${SEVERITY_COLORS[sev] || 'text-gray-400'}`}>
                      {sev}
                    </span>
                    <span className="text-xs font-mono text-white">{count}</span>
                  </div>
                ))}
              </div>
              {stats.currentFailureStreak > 2 && (
                <div className="mt-3 flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/5 border border-red-500/10">
                  <Flame size={10} className="text-red-400" />
                  <span className="text-[10px] font-mono text-red-400/80">Consecutive failures detected — check integrations</span>
                </div>
              )}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mb-8">
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-3">Recent Errors</h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {errors.slice(0, 10).map((err) => (
                  <motion.div
                    key={err.id}
                    data-testid="error-item"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-xs font-mono ${
                      err.resolved
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="mt-0.5">
                      {err.resolved
                        ? <CheckCircle size={14} className="text-emerald-400" />
                        : <XCircle size={14} className="text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white">{err.message.slice(0, 80)}{err.message.length > 80 ? '...' : ''}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${SEVERITY_COLORS[err.severity] || ''}`}>
                          {err.severity}
                        </span>
                        <span className="text-[#4a4b50] text-[9px]">{err.phase}</span>
                      </div>
                      <div className="text-[#4a4b50] text-[9px]">
                        {new Date(err.timestamp).toLocaleString()} · attempts: {err.recoveryAttempts}
                        {err.recoveryAction && ` · action: ${err.recoveryAction}`}
                      </div>
                    </div>
                    {!err.resolved && (
                      <button
                        onClick={() => resolveMutation.mutate(err.id)}
                        className="px-2 py-1 text-[9px] bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {recoveryData?.patterns && recoveryData.patterns.length > 0 && (
            <div>
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-3">Recovery Patterns</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recoveryData.patterns.map((pattern: any) => (
                  <div key={pattern.id} className="bg-[#151619] border border-[#2d2e32] p-3 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-white">{pattern.id}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${CATEGORY_COLORS[pattern.category] || 'text-gray-400'} bg-opacity-10`}>
                        {pattern.action}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-[#4a4b50] mb-1">{pattern.errorPattern}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1 rounded-full bg-[#1a1b1e] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/50 transition-all"
                          style={{ width: `${Math.min(pattern.totalAttempts > 0 ? pattern.successRate : 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-emerald-400/70">
                        {pattern.totalAttempts > 0 ? `${pattern.successRate.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                    <div className="text-[8px] font-mono text-[#4a4b50] mt-1">
                      {pattern.totalAttempts} attempt(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Trend & Synergy Insights Dashboard
 * The central hub for viewing recursive learning data:
 * - Benchmark score history (all 10 categories)
 * - Suggestion outcomes (applied → improved/worsened/unchanged)
 * - Error recovery trends
 * - VibeCoder score progression over time
 */
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { TrendingUp, Target, Lightbulb, AlertTriangle, CheckCircle, Zap, BarChart3, Sparkles } from 'lucide-react';

const BENCHMARK_CATEGORIES = [
  { id: 'TYPE_SAFETY', name: 'Type Safety' },
  { id: 'BUNDLE_SIZE', name: 'Bundle Size' },
  { id: 'DEPS_AUDIT', name: 'Dependencies' },
  { id: 'SECURITY', name: 'Security' },
  { id: 'LINT_SCORE', name: 'Code Quality' },
  { id: 'TEST_COVERAGE', name: 'Tests' },
  { id: 'ACCESSIBILITY', name: 'Accessibility' },
  { id: 'PERF_SCORE', name: 'Performance' },
  { id: 'STRUCTURE', name: 'Structure' },
  { id: 'TOKEN_EFFICIENCY', name: 'Token Efficiency' },
];

const BENCHMARK_COLORS: Record<string, string> = {
  'Type Safety': 'bg-emerald-500/20 text-emerald-400',
  'Bundle Size': 'bg-blue-500/20 text-blue-400',
  'Dependencies': 'bg-purple-500/20 text-purple-400',
  'Security': 'bg-red-500/20 text-red-400',
  'Code Quality': 'bg-amber-500/20 text-amber-400',
  'Tests': 'bg-cyan-500/20 text-cyan-400',
  'Accessibility': 'bg-pink-500/20 text-pink-400',
  'Performance': 'bg-indigo-500/20 text-indigo-400',
  'Structure': 'bg-emerald-500/20 text-emerald-400',
  'Token Efficiency': 'bg-violet-500/20 text-violet-400',
};

export const TrendInsightsDashboard = () => {
  const { data: vibeHistory } = useQuery({
    queryKey: ['vibe-history'],
    queryFn: async () => {
      const res = await fetch('/api/vibe/history');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/nexus/suggestions');
        return res.json();
      } catch { return { active: [], history: [] }; }
    },
    refetchInterval: 30000,
  });

  const { data: errorStats } = useQuery({
    queryKey: ['nexus-errors'],
    queryFn: async () => {
      const res = await fetch('/api/nexus/errors');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const trends = vibeHistory?.trends || [];
  const activeSugs = suggestions?.active || [];
  const historySugs = suggestions?.history || [];
  const stats = errorStats?.stats;
  const score = vibeHistory?.latestScore;
  const bestScore = vibeHistory?.bestScore || 0;
  const avgScore = vibeHistory?.averageScore || 0;

  // Calculate trend direction
  const scores = trends.map((t: any) => t.score);
  const recentTrend = scores.length >= 2
    ? scores[scores.length - 1] - scores[scores.length - 2]
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={18} className="text-purple-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Trends & Synergy Insights</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent" />
        {scores.length > 1 && (
          <div className={`text-[10px] font-mono ${recentTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {recentTrend >= 0 ? '↑' : '↓'} {Math.abs(recentTrend)}pt trend
          </div>
        )}
      </div>

      {/* Score Trend Chart */}
      {trends.length > 1 && (
        <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-emerald-400" />
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">VibeCoder Score Trend</h4>
            </div>
            <div className="flex gap-4 text-[10px] font-mono">
              <span className="text-emerald-400">Best: {bestScore}</span>
              <span className="text-blue-400">Avg: {avgScore}</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {trends.slice(-20).map((t: any, i: number) => {
              const height = Math.max(3, Math.round((t.score / 75) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-emerald-500/30 to-emerald-400/60 hover:to-emerald-400/80 transition-all"
                    style={{ height: `${height}%` }}
                    title={`${t.label}: ${t.score}`}
                  />
                  {i % 5 === 0 && (
                    <span className="text-[6px] font-mono text-[#4a4b50] whitespace-nowrap">{t.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestion Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} className="text-amber-400" />
            <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Active Suggestions</h4>
            {activeSugs.length > 0 && <span className="text-[10px] font-mono text-amber-400/80">({activeSugs.length})</span>}
          </div>
          {activeSugs.length === 0 ? (
            <div className="text-[10px] font-mono text-[#4a4b50] italic py-4 text-center">No active suggestions — system healthy</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {activeSugs.slice(0, 8).map((s: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/10">
                  <Zap size={10} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-[#8E9299]">
                      <span className="text-amber-400">{s.benchmarkName}</span>: {s.actionable}
                    </div>
                    <div className="text-[9px] font-mono text-[#4a4b50] mt-0.5">
                      Score: {s.scoreBefore}/{s.target || 100} — Created {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestion Outcomes */}
        <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-emerald-400" />
            <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Suggestion Outcomes</h4>
            {historySugs.length > 0 && <span className="text-[10px] font-mono text-emerald-400/80">({historySugs.length})</span>}
          </div>
          {historySugs.length === 0 ? (
            <div className="text-[10px] font-mono text-[#4a4b50] italic py-4 text-center">Apply suggestions to see outcomes</div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {historySugs.slice(-10).reverse().map((s: any, i: number) => {
                const improved = s.outcome === 'applied-improved';
                const noChange = s.outcome === 'applied-no-change';
                return (
                  <div key={i} className={`flex items-center justify-between p-1.5 rounded text-[10px] font-mono ${improved ? 'bg-emerald-500/5' : noChange ? 'bg-blue-500/5' : 'bg-red-500/5'}`}>
                    <div className="flex items-center gap-1.5">
                      {improved ? <CheckCircle size={10} className="text-emerald-400" /> :
                       noChange ? <Target size={10} className="text-blue-400" /> :
                       <AlertTriangle size={10} className="text-red-400" />}
                      <span className="text-[#8E9299]">{s.benchmarkName}</span>
                    </div>
                    <span className={`${improved ? 'text-emerald-400' : noChange ? 'text-blue-400' : 'text-red-400'}`}>
                      {s.scoreBefore} → {s.scoreAfter}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Error Recovery Trends */}
      {stats && (
        <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-400" />
            <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">Error Recovery Trends</h4>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-white">{stats.totalErrors}</div>
              <div className="text-[9px] font-mono text-[#4a4b50]">Total Errors</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-emerald-400">{stats.resolvedErrors}</div>
              <div className="text-[9px] font-mono text-[#4a4b50]">Resolved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-amber-400">{stats.currentFailureStreak}</div>
              <div className="text-[9px] font-mono text-[#4a4b50]">Failure Streak</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-purple-400">{stats.recentFailureCount}</div>
              <div className="text-[9px] font-mono text-[#4a4b50]">Recent (24h)</div>
            </div>
          </div>
        </div>
      )}

      {/* Growth Indicators */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'VibeCoder Grade', value: score?.letter || '—', sub: `${score?.total || 0}/${score?.maxTotal || '—'}`, icon: Target, color: 'text-emerald-400' },
          { label: 'Builds Analyzed', value: String(vibeHistory?.totalBuilds || 0), sub: `streak: ${vibeHistory?.streak || 0}x`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Suggestions Active', value: String(activeSugs.length), sub: `${historySugs.length} resolved`, icon: Lightbulb, color: 'text-amber-400' },
        ].map((card, i) => (
          <motion.div key={i} whileHover={{ scale: 1.02 }} className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl text-center">
            <card.icon size={16} className={`${card.color} mx-auto mb-1`} />
            <div className="text-sm font-bold text-white font-mono">{card.value}</div>
            <div className="text-[9px] text-[#4a4b50] font-mono">{card.label}</div>
            <div className="text-[8px] text-[#4a4b50] font-mono mt-0.5">{card.sub}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

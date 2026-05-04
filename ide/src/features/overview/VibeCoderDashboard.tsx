import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  TrendingUp, Trophy, Shield, Package, GitBranch, FolderTree,
  CheckCircle, AlertTriangle, Zap, Star, Sparkles, BarChart3, RefreshCw,
} from 'lucide-react';

interface QualityGate {
  id: string; name: string; maxScore: number; icon: string; description: string;
}

interface GateResult {
  gate: string; passed: boolean; score: number; maxScore: number; details: string[]; warnings: string[];
}

interface BuildScore {
  total: number; maxTotal: number; letter: string;
  gates: GateResult[]; timestamp: string; buildId: string; repoCount: number; durationMs: number; insights: string[];
}

interface VibeCoderData {
  builds: any[]; latestScore: BuildScore | null; bestScore: number;
  averageScore: number; totalBuilds: number; streak: number; longestStreak: number;
  insights: any[]; trends: { label: string; score: number }[];
}

const GATE_ICONS: Record<string, typeof Shield> = {
  "Type Safety": Shield, "Code Quality": CheckCircle,
  "Security Audit": Shield, "Bundle Health": Package,
  "Dependencies": GitBranch, "Project Structure": FolderTree,
};

const SCORE_COLORS: Record<string, string> = {
  S: 'from-amber-500 to-yellow-500', A: 'from-emerald-500 to-green-500',
  B: 'from-blue-500 to-cyan-500', C: 'from-amber-500 to-orange-500',
  D: 'from-red-500 to-rose-500', F: 'from-red-700 to-red-900',
};

const SCORE_BG: Record<string, string> = {
  S: 'bg-amber-500/10 border-amber-500/30', A: 'bg-emerald-500/10 border-emerald-500/30',
  B: 'bg-blue-500/10 border-blue-500/30', C: 'bg-amber-500/10 border-amber-500/30',
  D: 'bg-red-500/10 border-red-500/30', F: 'bg-red-700/10 border-red-700/30',
};

export const VibeCoderDashboard = () => {
  const queryClient = useQueryClient();

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['vibe-history'],
    queryFn: async () => {
      const res = await fetch('/api/vibe/history');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<VibeCoderData>;
    },
    refetchInterval: 60000,
  });

  const { data: gates } = useQuery({
    queryKey: ['vibe-gates'],
    queryFn: async () => {
      const res = await fetch('/api/vibe/gates');
      return res.json() as Promise<QualityGate[]>;
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/vibe/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoCount: 1 }) });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<BuildScore>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vibe-history'] }),
  });

  const score = history?.latestScore ?? null;
  const prevScore = history?.builds?.[history.builds.length - 2]?.totalScore;
  const trend = prevScore && score ? (score.total - prevScore) : 0;
  const trendPercent = prevScore ? Math.round((trend / prevScore) * 100) : 0;
  const maxScore = score?.maxTotal || 75;

  return (
    <div data-testid="vibe-dashboard" className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={18} className="text-amber-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em]">VibeCoder Quality Score</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
        {history && history.totalBuilds > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp size={10} className="text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-400">{history.totalBuilds} build(s)</span>
          </div>
        )}
      </div>

      {loadingHistory ? (
        <div className="text-center py-8 text-[#4a4b50] font-mono text-xs">Loading scores...</div>
      ) : !score ? (
        <div className="bg-[#151619] border border-[#2d2e32] p-8 rounded-xl text-center">
          <Sparkles size={32} className="text-amber-400/50 mx-auto mb-3" />
          <p className="text-xs text-[#8E9299] font-mono mb-4">No builds scored yet — run your first pipeline!</p>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-2 mx-auto"
          >
            {checkMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            Run Quality Check
          </button>
        </div>
      ) : (
        <>
          {/* Hero Score Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`bg-gradient-to-br ${SCORE_COLORS[score.letter] || 'from-gray-500 to-gray-600'} rounded-2xl p-8 border border-white/10 min-h-auto`}
            style={{ minHeight: 'auto' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-mono text-white/60 uppercase tracking-widest mb-2">VibeCoder Grade</div>
                <div data-testid="vibe-grade" className="text-6xl font-black text-white tracking-tighter">{score.letter}</div>
                <div className="text-sm font-mono text-white/80 mt-2">
                  {score.total} / {score.maxTotal} points
                </div>
                {trend !== 0 && (
                  <div className={`text-[10px] font-mono mt-2 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trendPercent)}% from last build
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => checkMutation.mutate()}
                    disabled={checkMutation.isPending}
                    className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-[10px] font-mono text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"
                  >
                    {checkMutation.isPending ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                    Re-Check
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/80 rounded-full transition-all duration-1000"
                style={{ width: `${(score.total / maxScore) * 100}%` }}
              />
            </div>
          </motion.div>

          {/* Gate Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {score.gates.map((gate, i) => {
              const Icon = GATE_ICONS[gate.gate] || Shield;
              const pct = gate.maxScore > 0 ? Math.round((gate.score / gate.maxScore) * 100) : 0;
              return (
                <motion.div
                  key={gate.gate}
                  data-testid="vibe-gate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-xl border ${gate.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#151619] border-[#2d2e32]'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={gate.passed ? 'text-emerald-400' : 'text-[#4a4b50]'} />
                      <span className="text-[11px] font-mono text-white">{gate.gate}</span>
                    </div>
                    <span className={`text-xs font-mono font-bold ${gate.passed ? 'text-emerald-400' : 'text-[#4a4b50]'}`}>
                      {gate.score}/{gate.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1a1b1e] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${gate.passed ? 'bg-emerald-500/50' : 'bg-[#4a4b50]/30'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {gate.details.slice(0, 2).map((d, j) => (
                    <div key={j} className="text-[9px] font-mono text-[#4a4b50] mt-2">{d}</div>
                  ))}
                  {gate.warnings.slice(0, 1).map((w, j) => (
                    <div key={`w${j}`} className="text-[9px] font-mono text-amber-400/80 mt-1 flex items-center gap-1">
                      <AlertTriangle size={8} /> {w}
                    </div>
                  ))}
                </motion.div>
              );
            })}
          </div>

          {/* Insights */}
          {score.insights.length > 0 && (
            <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-purple-400" />
                <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest">AI Improvement Insights</h4>
              </div>
              <div className="space-y-2">
                {score.insights.map((insight, i) => (
                  <div key={i} data-testid="vibe-insight" className="flex items-start gap-2 text-[10px] font-mono text-[#8E9299]">
                    <Sparkles size={10} className="text-purple-400/50 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History Stats */}
          {history && history.totalBuilds > 1 && (
            <div className="grid grid-cols-3 gap-4">
              <div data-testid="vibe-stat" className="bg-[#151619] border border-[#2d2e32] p-3 rounded-xl text-center">
                <Trophy size={14} className="text-amber-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white font-mono">{history.bestScore}/{maxScore}</div>
                <div className="text-[9px] text-[#4a4b50] font-mono">Best Score</div>
              </div>
              <div data-testid="vibe-stat" className="bg-[#151619] border border-[#2d2e32] p-3 rounded-xl text-center">
                <BarChart3 size={14} className="text-blue-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white font-mono">{history.averageScore}/{maxScore}</div>
                <div className="text-[9px] text-[#4a4b50] font-mono">Average</div>
              </div>
              <div data-testid="vibe-stat" className="bg-[#151619] border border-[#2d2e32] p-3 rounded-xl text-center">
                <Star size={14} className="text-purple-400 mx-auto mb-1" />
                <div className="text-sm font-bold text-white font-mono">{history.streak}x</div>
                <div className="text-[9px] text-[#4a4b50] font-mono">Streak (best: {history.longestStreak}x)</div>
              </div>
            </div>
          )}

          {/* Trend Chart */}
          {history && history.trends.length > 1 && (
            <div data-testid="vibe-trend" className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl">
              <h4 className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-widest mb-3">Score Trend</h4>
              <div className="flex items-end gap-1.5 h-24">
                {history.trends.map((t, i) => {
                  const height = Math.max(4, Math.round((t.score / maxScore) * 100));
                  const isMax = t.score === Math.max(...history.trends.map(x => x.score));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className={`w-full rounded-t transition-all ${isMax ? 'bg-emerald-400/80' : 'bg-emerald-500/20 hover:bg-emerald-500/40'}`}
                        style={{ height: `${height}%` }}
                        title={`${t.label}: ${t.score}/${maxScore}`}
                      />
                      {i % 4 === 0 && (
                        <span className="text-[7px] font-mono text-[#4a4b50] whitespace-nowrap">{t.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {checkMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#4a4b50] py-4">
              <RefreshCw size={12} className="animate-spin" />
              Running quality checks...
            </div>
          )}
        </>
      )}
    </div>
  );
};

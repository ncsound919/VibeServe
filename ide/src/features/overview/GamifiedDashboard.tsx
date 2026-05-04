/**
 * Gamified Executive Dashboard
 * Real-time progression tracking with XP, levels, achievements, streaks, and learning insights.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, Zap, Star, Award, Crown, Flame, BookOpen, Bot, Lightbulb,
  Rocket, RefreshCw, Target, Trophy, GitMerge, Search, Hammer, Users
} from 'lucide-react';

interface Achievement {
  id: string; name: string; description: string; icon: string;
  category: string; unlocked: boolean; unlockedAt?: string;
  progress: number; target: number; rarity: string; xpReward: number;
}

interface Progression {
  level: number; xp: number; xpToNext: number; totalXp: number;
  pipelineRuns: number; pipelineWins: number; pipelineStreak: number;
  wikiPages: number; wikiEdits: number;
  agentsDeployed: number; reposScanned: number; reposBuilt: number;
  searchQueries: number; learningIterations: number; insightsGenerated: number;
  currentStreak: number; longestStreak: number; lastActive: string;
  badges: string[]; levelTitle: string;
  recentWins: Array<{ type: string; message: string; xp: number; ts: string }>;
  trendData: Array<{ label: string; xp: number; runs: number; wins: number }>;
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-gray-500/20 border-gray-500/30 text-gray-400",
  rare: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  epic: "bg-purple-500/20 border-purple-500/30 text-purple-400",
  legendary: "bg-amber-500/20 border-amber-500/30 text-amber-400",
};

const ICON_MAP: Record<string, any> = {
  Rocket, Zap, Star, Crown, Flame, BookOpen, Bot, Lightbulb,
  RefreshCw, Award, Calendar: ()=><span>📅</span>,
  GitMerge, Search, Hammer, Users, TrendingUp, Trophy, Target,
};

export const GamifiedDashboard = () => {
  const [prog, setProg] = useState<Progression | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [tab, setTab] = useState<'stats' | 'achievements' | 'trends' | 'wins'>('stats');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/nexus/progression');
      if (res.ok) {
        const data = await res.json();
        setProg(data.progression);
        setAchievements(data.achievements || []);
        setInsights(data.insights || []);
      }
    } catch { /* OK */ }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

  if (!prog) return <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-8 text-center"><RefreshCw className="animate-spin mx-auto text-emerald-400 mb-3" size={24} /><p className="text-xs font-mono text-[#4a4b50]">Loading Nexus Progression...</p></div>;

  const xpPercent = Math.round((prog.xp / prog.xpToNext) * 100);
  const winRate = prog.pipelineRuns > 0 ? Math.round((prog.pipelineWins / prog.pipelineRuns) * 100) : 0;
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-6">
      {/* LEVEL CARD */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-[#151619] to-[#0a0a0c] border border-[#2d2e32] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Crown size={24} className="text-white" />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-white">Level {prog.level}</h3>
                <p className="text-xs text-emerald-400 font-mono">{prog.levelTitle}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#4a4b50] font-mono w-16">XP</span>
                <div className="flex-1 h-2 bg-[#2d2e32] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpPercent}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" />
                </div>
                <span className="text-emerald-400 font-mono text-[10px]">{prog.xp}/{prog.xpToNext}</span>
              </div>
            </div>
          </div>
          <div className="text-right space-y-3">
            <div className="bg-[#1a1b1e] border border-[#2d2e32] rounded-xl px-4 py-2">
              <div className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-wider">Total XP</div>
              <div className="text-2xl font-bold text-white font-mono">{prog.totalXp.toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                <div className="text-[9px] font-mono text-amber-400">STREAK</div>
                <div className="text-sm font-bold text-amber-300">{prog.currentStreak}d</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                <div className="text-[9px] font-mono text-emerald-400">WIN RATE</div>
                <div className="text-sm font-bold text-emerald-300">{winRate}%</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* STAT GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline Runs', value: prog.pipelineRuns, icon: Rocket, color: 'emerald', sub: `${prog.pipelineWins} wins` },
          { label: 'Wiki Pages', value: prog.wikiPages, icon: BookOpen, color: 'blue', sub: `${prog.wikiEdits} edits` },
          { label: 'Agents', value: prog.agentsDeployed, icon: Bot, color: 'purple', sub: 'deployed' },
          { label: 'Repos Built', value: prog.reposBuilt, icon: Hammer, color: 'amber', sub: `${prog.reposScanned} scanned` },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ y: -2 }} className="bg-[#151619] border border-[#2d2e32] rounded-xl p-4 hover:border-emerald-500/30 transition-all cursor-default">
            <div className={`p-2 rounded-lg bg-${s.color}-500/10 inline-block mb-2`}>
              <s.icon size={18} className={`text-${s.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-wider">{s.label}</div>
            <div className="text-[9px] font-mono text-emerald-400/70 mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-[#2d2e32] pb-2">
        {(['stats', 'achievements', 'trends', 'wins'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg transition-all ${tab === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-[#4a4b50] hover:text-[#8b8b8d]'}`}>
            {t === 'achievements' ? `${t} (${unlockedCount}/${achievements.length})` : t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Searches', value: prog.searchQueries, icon: Search },
              { label: 'Learning Loops', value: prog.learningIterations, icon: RefreshCw },
              { label: 'Insights', value: prog.insightsGenerated, icon: Lightbulb },
              { label: 'Longest Streak', value: `${prog.longestStreak}d`, icon: Flame },
              { label: 'Badges', value: prog.badges.length, icon: Award },
              { label: 'Pipeline Streak', value: prog.pipelineStreak, icon: Zap },
            ].map((s, i) => (
              <div key={i} className="bg-[#0a0a0c] border border-[#1a1b1e] rounded-xl p-4">
                <s.icon size={16} className="text-[#4a4b50] mb-2" />
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-[10px] font-mono text-[#4a4b50] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'achievements' && (
          <motion.div key="achieve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {achievements.filter(a => a.unlocked).length === 0 && (
              <p className="text-xs font-mono text-[#4a4b50] text-center py-8">No achievements yet — run a pipeline to unlock your first!</p>
            )}
            {achievements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`flex items-center gap-4 p-3 rounded-xl border ${a.unlocked ? RARITY_COLORS[a.rarity] : 'bg-[#0a0a0c] border-[#1a1b1e] opacity-50'}`}>
                <div className="relative">
                  <div className={`p-2 rounded-lg ${a.unlocked ? 'bg-current/10' : 'bg-[#1a1b1e]'}`}>
                    {a.unlocked ? <Trophy size={20} className="text-amber-400" /> : <Target size={20} className="text-[#2d2e32]" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-white truncate">{a.name}</h4>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${a.unlocked ? RARITY_COLORS[a.rarity] : 'bg-[#1a1b1e] text-[#4a4b50]'}`}>{a.rarity}</span>
                  </div>
                  <p className="text-[10px] text-[#4a4b50] truncate">{a.description}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#2d2e32] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${a.unlocked ? 'bg-amber-500' : 'bg-emerald-500/30'}`} style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-[#4a4b50]">{a.progress}/{a.target}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-amber-400">+{a.xpReward} XP</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {tab === 'trends' && (
          <motion.div key="trends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {prog.trendData.length === 0 ? (
              <p className="text-xs font-mono text-[#4a4b50] text-center py-8">Trend data will appear as you run pipelines</p>
            ) : (
              <div className="bg-[#0a0a0c] border border-[#1a1b1e] rounded-xl p-4 overflow-x-auto">
                <div className="flex gap-1 items-end min-w-[600px]" style={{ height: 120 }}>
                  {prog.trendData.map((d, i) => {
                    const maxXp = Math.max(...prog.trendData.map(t => t.xp), 1);
                    const h = (d.xp / maxXp) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: i * 0.03, duration: 0.3 }} className={`w-full rounded-t ${d.wins > 0 ? 'bg-emerald-500/60' : 'bg-[#2d2e32]'} group-hover:bg-emerald-400 transition-colors`} />
                        <span className="text-[7px] font-mono text-[#4a4b50] group-hover:text-white transition-colors -rotate-45 origin-left mt-1">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono"><div className="w-2 h-2 rounded-sm bg-emerald-500/60" /> XP Gained</div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono"><div className="w-2 h-2 rounded-sm bg-[#2d2e32]" /> No Activity</div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'wins' && (
          <motion.div key="wins" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 max-h-80 overflow-y-auto">
            {prog.recentWins.length === 0 ? (
              <p className="text-xs font-mono text-[#4a4b50] text-center py-8">Your wins will appear here as you use Nexus Alpha</p>
            ) : (
              prog.recentWins.map((w, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 p-3 bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg">
                  <div className={`p-1.5 rounded-lg ${w.type === 'levelup' ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                    {w.type === 'levelup' ? <Star size={14} className="text-amber-400" /> : <Zap size={14} className="text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{w.message}</p>
                    <p className="text-[9px] font-mono text-[#4a4b50]">{new Date(w.ts).toLocaleString()}</p>
                  </div>
                  {w.xp > 0 && <span className="text-xs font-bold text-emerald-400 font-mono">+{w.xp}</span>}
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEARNING INSIGHTS */}
      {insights.length > 0 && (
        <div className="bg-[#151619] border border-[#2d2e32] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Learning Insights</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-start gap-2 p-2 bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <p className="text-xs text-[#A1A1AA] leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamifiedDashboard;

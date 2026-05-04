/**
 * Agent Evaluation Tab
 * 
 * Interface for running and viewing results of agent evaluations.
 */
import { useState } from 'react';
import { Trophy, Play, CheckCircle2, XCircle, Timer, Zap, BarChart3 } from 'lucide-react';
import { useEvalStore, EvalChallenge } from '../services/agentEvalService';
import { motion } from 'motion/react';

export const AgentEvalTab = () => {
  const { challenges, results, isEvaluating, runEvaluation, getScoreboard } = useEvalStore();
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const scoreboard = getScoreboard();

  const handleRun = async (id: string) => {
    setSelectedChallenge(id);
    await runEvaluation(id, 'Nexus-Prime-Agent');
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="text-amber-400" />
            Agent Evaluation Harness
          </h1>
          <p className="text-sm text-[#4a4b50] mt-1">Benchmark agent performance on real-world coding challenges.</p>
        </div>
        <div className="bg-[#151619] border border-[#2d2e32] px-4 py-2 rounded-lg">
          <div className="text-[10px] text-[#4a4b50] uppercase font-mono">Overall Pass Rate</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {results.length > 0 
              ? Math.round((results.filter(r => r.status === 'passed').length / results.length) * 100) 
              : 0}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Challenges List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Active Challenges</h2>
          {challenges.map((challenge) => {
            const lastResult = [...results].reverse().find(r => r.challengeId === challenge.id);
            return (
              <div 
                key={challenge.id}
                className="bg-[#151619] border border-[#2d2e32] p-5 rounded-xl hover:border-[#424348] transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{challenge.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                        challenge.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                        challenge.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        {challenge.difficulty}
                      </span>
                      <span className="text-[10px] text-[#4a4b50] font-mono uppercase">{challenge.testFile}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRun(challenge.id)}
                    disabled={isEvaluating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    <Play size={14} fill="currentColor" />
                    Run Eval
                  </button>
                </div>
                <p className="text-sm text-[#8E9299] mb-4">{challenge.description}</p>
                
                {lastResult && (
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${
                    lastResult.status === 'passed' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      {lastResult.status === 'passed' ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <XCircle size={18} className="text-rose-400" />
                      )}
                      <div>
                        <div className={`text-xs font-bold ${lastResult.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {lastResult.status === 'passed' ? 'PASSED' : 'FAILED'}
                        </div>
                        <div className="text-[10px] text-[#4a4b50] font-mono">
                          {lastResult.executionTimeMs}ms • {lastResult.tokensUsed} tokens
                        </div>
                      </div>
                    </div>
                    <button className="text-[10px] font-mono text-[#4a4b50] hover:text-white transition-colors">
                      View Logs
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scoreboard */}
        <div className="space-y-6">
          <div className="bg-[#151619] border border-[#2d2e32] p-6 rounded-xl">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 size={14} />
              Agent Leaderboard
            </h2>
            <div className="space-y-4">
              {Object.entries(scoreboard).length === 0 ? (
                <p className="text-[10px] text-[#4a4b50] italic">Run evaluations to populate leaderboard.</p>
              ) : (
                Object.entries(scoreboard).map(([agentId, stats]) => (
                  <div key={agentId} className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-white">{agentId}</span>
                      <span className="text-emerald-400">{Math.round(stats.passRate)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0a0a0c] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.passRate}%` }}
                        className="h-full bg-emerald-500" 
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-[#4a4b50] font-mono">
                      <span>AVG: {Math.round(stats.avgTime)}ms</span>
                      <span>{stats.total} RUNS</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#151619] border border-[#2d2e32] p-6 rounded-xl">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap size={14} className="text-indigo-400" />
              Evaluation Insights
            </h2>
            <ul className="space-y-3">
              <li className="text-[10px] text-[#8E9299] flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5" />
                <span>Agents perform 23% better on isolated logic tasks than UI refactors.</span>
              </li>
              <li className="text-[10px] text-[#8E9299] flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5" />
                <span>Sub-100ms autocomplete reduces halluciation rate by 12%.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, RefreshCcw, ExternalLink, CheckCircle2, Activity, Zap, Radio, Search, Loader2 } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { cn } from '../lib/utils';
import type { RepoTrend, PipelineExecutionData } from '../types';

interface RepoAnalysisTabProps {
  repos: RepoTrend[];
  selectedRepos: string[];
  activeRun: PipelineExecutionData | null;
  isProcessing: boolean;
  onSelectRepo: (name: string) => void;
  onResetSelection: () => void;
  onSynthesize: () => void;
  onRefreshRepos?: () => Promise<void>;
}

export const RepoAnalysisTab = ({
  repos,
  selectedRepos,
  activeRun,
  isProcessing,
  onSelectRepo,
  onResetSelection,
  onSynthesize,
  onRefreshRepos,
}: RepoAnalysisTabProps) => {
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async () => {
    if (!onRefreshRepos) return;
    setScanning(true);
    try { await onRefreshRepos(); } 
    finally { setScanning(false); }
  }, [onRefreshRepos]);

  if (!repos || repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-[#151619] border border-[#2d2e32] rounded-xl gap-4">
        <p className="text-[#4a4b50] font-mono text-sm">No repositories available</p>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded-lg text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {scanning ? 'Scanning GitHub...' : 'Scan Trending Repos'}
        </button>
      </div>
    );
  }

  return (
  <div className="space-y-8 relative">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <SectionHeader title="Source Intelligence" icon={Github} />
          <p className="text-[10px] font-mono text-[#4a4b50] pl-6 uppercase tracking-wider">
            Scanned from GitHub API · DeepSeek analyzed · {repos.length} repos
          </p>
        </div>
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-black font-bold rounded-lg text-xs transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          {scanning ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
          {scanning ? 'SCANNING...' : 'SCAN TRENDS'}
        </motion.button>
        {selectedRepos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
              {selectedRepos.length} Repos Ready
            </span>
            <button
              onClick={onResetSelection}
              className="text-[10px] font-mono text-[#4a4b50] hover:text-white"
            >
              [RESET_SELECTION]
            </button>
          </motion.div>
        )}
        <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          DEEPSEEK CURATED
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
      {repos.map((repo, i) => {
        const isSelected = selectedRepos.includes(repo.name);
        return (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            onClick={() => onSelectRepo(repo.name)}
            className={cn(
              'bg-[#151619] border p-4 rounded-xl group cursor-pointer transition-all relative overflow-hidden',
              isSelected
                ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                : 'border-[#2d2e32] hover:border-[#424348]',
            )}
          >
            {isSelected && (
              <div className="absolute top-0 right-0 p-2 text-emerald-500">
                <CheckCircle2 size={14} />
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-white flex items-center gap-2 group-hover:text-emerald-400 transition-colors truncate">
                  {repo.name}
                  <ExternalLink size={12} className="text-[#4a4b50]" />
                </h4>
                <div className="flex gap-2 mt-2">
                  {repo.tags.slice(0, 2).map((tag, j) => (
                    <span
                      key={j}
                      className="text-[9px] font-mono bg-[#1a1b1e] border border-[#2d2e32] px-1.5 py-0.5 rounded text-[#8E9299]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono text-[#8E9299]">{repo.stars.toLocaleString()}</div>
                <div className="text-[10px] font-mono text-emerald-400">+{repo.growth}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 mt-6 border-t border-[#1a1b1e] pt-4">
              <div>
                <div className="text-[8px] font-mono text-[#4a4b50] uppercase mb-1">Stack Spectrum</div>
                <div className="text-[10px] text-[#A1A1AA] font-mono truncate">{repo.stack || 'ANALYST_PENDING'}</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] font-mono text-[#4a4b50] uppercase mb-1">Functional Utility</div>
                <div className="text-[10px] text-[#A1A1AA] font-mono truncate">{repo.utility || 'ANALYST_PENDING'}</div>
              </div>
              <div>
                <div className="text-[8px] font-mono text-[#4a4b50] uppercase mb-1">Build Archetype</div>
                <div className="text-[10px] text-[#A1A1AA] font-mono truncate">{repo.buildType || 'ANALYST_PENDING'}</div>
              </div>
            </div>

            <div className="mt-4 p-2 bg-[#0a0a0c] rounded border border-[#2d2e32]/50 text-[9px] font-mono text-[#62646b] leading-relaxed">
              <span className="text-emerald-500/80 mr-1 uppercase">Analysis:</span>
              {repo.aiAnalysis}
            </div>
          </motion.div>
        );
      })}
    </div>

    {/* Floating Action Bar */}
    <AnimatePresence>
      {selectedRepos.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[60] w-full max-w-2xl px-4"
        >
          <div className="bg-[#151619] border-2 border-emerald-500/30 p-4 rounded-2xl shadow-2xl shadow-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">NEXUS_SYNTHESIS_ENGINE</p>
                <p className="text-[10px] font-mono text-emerald-500/70">
                  ORCHESTRATING {selectedRepos.length} REPOSITORIES
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onResetSelection}
                className="px-4 py-2 text-[10px] font-mono text-[#8E9299] hover:text-white uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                id="btn-synthesize-action"
                onClick={onSynthesize}
                disabled={activeRun?.status === 'running' || isProcessing}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Activity size={14} />
                Synthesize & Build
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
};

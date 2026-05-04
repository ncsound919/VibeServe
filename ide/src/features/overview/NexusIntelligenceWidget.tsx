/**
 * Nexus Intelligence Widget
 * 
 * Displays status for Codeix and Serena services.
 */
import { motion } from 'motion/react';
import { Database, Share2, Search, Zap, Code, Shield } from 'lucide-react';
import { useCodeixStore } from '../../services/codeixService';
import { useSerenaStore } from '../../services/serenaService';
import { cn } from '../../lib/utils';

export const NexusIntelligenceWidget = () => {
  const { index, stats, isIndexing } = useCodeixStore();
  const { activeContext, isProcessing } = useSerenaStore();

  return (
    <div className="bg-[#151619] border border-[#2d2e32] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#2d2e32] bg-[#1a1b1e]/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-indigo-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Intelligence Services</h3>
        </div>
        <div className="flex gap-2">
          {isIndexing && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[9px] font-mono text-blue-400 uppercase">Indexing</span>
            </div>
          )}
          {isProcessing && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-[9px] font-mono text-indigo-400 uppercase">Enriching</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Codeix Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-blue-400" />
            <h4 className="text-xs font-semibold text-gray-300">Codeix Indexer</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0a0c] p-3 rounded-lg border border-[#1a1b1e]">
              <div className="text-[9px] text-[#4a4b50] uppercase mb-1">Symbols</div>
              <div className="text-lg font-mono font-bold text-white">{stats?.totalSymbols ?? 0}</div>
            </div>
            <div className="bg-[#0a0a0c] p-3 rounded-lg border border-[#1a1b1e]">
              <div className="text-[9px] text-[#4a4b50] uppercase mb-1">Files</div>
              <div className="text-lg font-mono font-bold text-white">{stats?.totalFiles ?? 0}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#4a4b50]">Index Version</span>
              <span className="text-gray-400">{index?.version ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#4a4b50]">Format</span>
              <span className="text-blue-400">Portable JSON</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#4a4b50]">Bloom Filter</span>
              <span className="text-emerald-400">1024-bit Active</span>
            </div>
          </div>
        </div>

        {/* Serena Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Share2 size={14} className="text-indigo-400" />
            <h4 className="text-xs font-semibold text-gray-300">Serena Context Engine</h4>
          </div>

          <div className="bg-[#0a0a0c] p-4 rounded-lg border border-[#1a1b1e] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield size={48} className="text-indigo-500" />
            </div>
            <div className="text-[10px] text-[#8E9299] mb-2 leading-tight">
              {activeContext?.summary ?? 'Serena is standing by to enrich your prompts with relevant codebase context.'}
            </div>
            {activeContext && (
              <div className="flex gap-2 flex-wrap mt-3">
                {Array.from(new Set(activeContext.items.map(i => i.source))).map(source => (
                  <span key={source} className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase font-mono">
                    {source}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-[#0a0a0c]/50 border border-[#1a1b1e]">
              <Search size={12} className="mx-auto mb-1 text-[#4a4b50]" />
              <div className="text-[8px] text-[#4a4b50] uppercase">Semantic</div>
            </div>
            <div className="text-center p-2 rounded bg-[#0a0a0c]/50 border border-[#1a1b1e]">
              <Code size={12} className="mx-auto mb-1 text-[#4a4b50]" />
              <div className="text-[8px] text-[#4a4b50] uppercase">Symbols</div>
            </div>
            <div className="text-center p-2 rounded bg-[#0a0a0c]/50 border border-[#1a1b1e]">
              <Activity size={12} className="mx-auto mb-1 text-[#4a4b50]" />
              <div className="text-[8px] text-[#4a4b50] uppercase">Impact</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-3 bg-[#0a0a0c]/30 border-t border-[#1a1b1e] flex justify-between items-center text-[9px] font-mono text-[#4a4b50]">
        <span>LAST SYNC: {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleTimeString() : 'NEVER'}</span>
        <span className="text-indigo-500/50">MANDATORY_CODE_AWARENESS: ENABLED</span>
      </div>
    </div>
  );
};

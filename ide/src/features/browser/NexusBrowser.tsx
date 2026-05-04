/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, Search, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BrowserControl } from './BrowserControl';
import type { PipelineExecutionData, BrowserHistoryItemData } from '../../types';

interface NexusBrowserProps {
  initialMessage?: string;
  activeRun?: PipelineExecutionData | null;
}

export const NexusBrowser = ({ initialMessage, activeRun }: NexusBrowserProps) => {
  const [url] = useState('https://nexus.alpha/agent/terminal');
  const [localHistory, setLocalHistory] = useState<BrowserHistoryItemData[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localHistory.length === 0) {
      setLocalHistory([
        {
          id: 'init-1',
          timestamp: new Date().toISOString(),
          url: 'https://nexus.alpha/init',
          action: 'Initialize',
          summary: 'Nexus Agent Browser initialized in isolated sandbox environment.',
          type: 'observation',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (initialMessage) {
      setLocalHistory(prev => {
        const newItem: BrowserHistoryItemData = {
          id: Math.random().toString(36).slice(2, 7),
          timestamp: new Date().toISOString(),
          url: 'https://nexus.alpha/import',
          action: 'Context Import',
          summary: initialMessage,
          type: 'audit',
        };
        const next = [...prev, newItem];
        return next.length > 100 ? next.slice(-100) : next;
      });
    }
  }, [initialMessage]);

  const allHistory = [...localHistory, ...(activeRun?.browserHistory || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const clearHistory = () => setLocalHistory([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [allHistory.length]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] border border-[#2d2e32] rounded-xl overflow-hidden shadow-2xl">
      {/* Browser Chrome */}
      <div className="h-10 bg-[#151619] border-b border-[#2d2e32] flex items-center px-4 gap-4">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
        </div>
        <div className="flex-1 bg-[#0a0a0c] rounded px-3 py-1 text-[10px] font-mono text-[#4a4b50] border border-[#2d2e32] flex justify-between items-center">
          <div className="truncate max-w-[400px]">
            {activeRun?.browserSnapshot ? activeRun.browserSnapshot.url : url}
          </div>
          <RefreshCcw size={10} className="text-[#2d2e32]" />
        </div>
        {activeRun?.browserSnapshot && (
          <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-400">
            <Activity size={10} className="animate-pulse" />
            SYNCHRONOUS_AGENT_ATTACHED
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Observation Area */}
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-xs space-y-6">
          {activeRun?.browserSnapshot && (
            <div className="mb-10">
              <BrowserControl snapshot={activeRun.browserSnapshot} />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1a1b1e] pb-2">
              <h5 className="text-[10px] uppercase tracking-[0.2em] text-[#4a4b50]">Chronological Trace</h5>
              <button
                onClick={clearHistory}
                className="text-[9px] text-[#4a4b50] hover:text-white uppercase transition-colors"
              >
                [WIPE_BUFFER]
              </button>
            </div>

            {allHistory.length === 0 && (
              <div className="py-20 text-center space-y-2 opacity-30">
                <Search size={32} className="mx-auto text-[#4a4b50]" />
                <p className="text-[10px] uppercase tracking-widest text-[#4a4b50]">Log Buffer Empty</p>
              </div>
            )}

            {allHistory.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'p-3 rounded border border-transparent hover:bg-[#151619] transition-colors group',
                  item.type === 'navigation' ? 'border-l-2 border-l-blue-500' :
                  item.type === 'click' ? 'border-l-2 border-l-amber-500' :
                  item.type === 'input' ? 'border-l-2 border-l-emerald-500' :
                  item.type === 'audit' ? 'border-l-2 border-l-purple-500' : 'border-l-2 border-l-[#2d2e32]',
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#4a4b50]">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] uppercase px-1.5 py-0.5 rounded-sm font-bold',
                        item.url.startsWith('mcp://') ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        item.type === 'navigation' ? 'bg-blue-500/10 text-blue-400' :
                        item.type === 'click' ? 'bg-amber-500/10 text-amber-400' :
                        item.type === 'input' ? 'bg-emerald-500/10 text-emerald-400' :
                        item.type === 'audit' ? 'bg-purple-500/10 text-purple-400' : 'bg-[#2d2e32] text-[#4a4b50]',
                      )}
                    >
                      {item.url.startsWith('mcp://') ? 'MCP_FETCH' : item.type}
                    </span>
                    {item.type === 'observation' && activeRun?.rag && (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        className="text-[8px] font-mono text-emerald-500 bg-emerald-500/5 px-1 rounded border border-emerald-500/20"
                      >
                        [RAG_INDEXED]
                      </motion.span>
                    )}
                  </div>
                  <span className="text-[9px] text-[#2d2e32] group-hover:text-[#4a4b50] truncate max-w-[200px]">
                    {item.url}
                  </span>
                </div>
                <p className="text-[11px] text-[#8E9299] leading-relaxed">
                  <span className="text-white font-bold">{item.action}:</span> {item.summary}
                </p>
              </motion.div>
            ))}

            <div className="flex gap-2 text-[#4a4b50] pt-4 items-center">
              <span className="text-emerald-500 animate-pulse">●</span>
              <span className="text-[10px] uppercase tracking-widest">Listening for agent events...</span>
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-1.5 h-3 bg-[#4a4b50] inline-block"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Browser Footer */}
      <div className="p-4 border-t border-[#2d2e32] bg-[#151619]/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              activeRun?.status === 'running' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
            )}
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299]">
              Agent Status: {activeRun?.status === 'running' ? 'AUTONOMOUS_CONTROL' : 'READY_FOR_PROTOCOL'}
            </span>
            {activeRun?.currentStep && (
              <span className="text-[8px] font-mono text-[#4a4b50] uppercase mt-0.5">
                Observing Step: {activeRun.currentStep}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <button className="text-[10px] font-mono uppercase text-blue-400 hover:underline">VNC Bridge</button>
          <button className="text-[10px] font-mono uppercase text-emerald-400 hover:underline">Deploy to Cluster</button>
        </div>
      </div>
    </div>
  );
};

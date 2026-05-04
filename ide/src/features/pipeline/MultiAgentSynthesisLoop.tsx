/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Users, Share2, Cpu, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PipelineExecutionData } from '../../types';

interface MultiAgentSynthesisLoopProps {
  execution: PipelineExecutionData | null;
}

export const MultiAgentSynthesisLoop = ({ execution }: MultiAgentSynthesisLoopProps) => {
  if (!execution || execution.status !== 'running') return null;

  const stages = [
    { label: 'Agent Collab', icon: Users, status: execution.progress > 20 ? 'COMPLETE' : 'ORCHESTRATING' },
    { label: 'Context Sharding', icon: Share2, status: execution.progress > 40 ? 'STABILIZED' : 'FRAGMENTING' },
    { label: 'Model Optimization', icon: Cpu, status: execution.progress > 60 ? 'OPTIMIZED' : 'PROCESSING' },
    { label: 'MCP Handshake', icon: Terminal, status: execution.progress > 80 ? 'ESTABLISHED' : 'NEGOTIATING' },
  ];

  const isDone = (s: string) => ['COMPLETE', 'STABILIZED', 'OPTIMIZED', 'ESTABLISHED'].includes(s);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-8 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] font-mono">
            Synthesis Engine Active
          </h4>
        </div>
        <div className="text-[9px] font-mono text-[#4a4b50] uppercase tracking-widest">
          Data Sync: {Math.floor(execution.progress)}%
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stages.map((item, i) => (
          <div key={i} className="bg-[#0a0a0c]/50 p-3 rounded border border-[#2d2e32] flex flex-col gap-2">
            <div
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center border',
                isDone(item.status)
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-amber-500/5 border-amber-500/10 text-amber-500 animate-pulse',
              )}
            >
              <item.icon size={12} />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-[#8E9299] uppercase">{item.label}</div>
              <div
                className={cn(
                  'text-[8px] font-mono uppercase tracking-tighter',
                  isDone(item.status) ? 'text-blue-400' : 'text-amber-500',
                )}
              >
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

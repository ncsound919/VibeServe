/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { BuildStepData } from '../../types';

interface PipelineVisualizerProps {
  steps: BuildStepData[];
}

export const PipelineVisualizer = ({ steps }: PipelineVisualizerProps) => (
  <div className="space-y-6">
    {steps.map((step, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1 }}
        className="relative pl-8 border-l border-[#2d2e32] pb-8 last:pb-0"
      >
        <div
          className={cn(
            'absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full',
            step.status === 'completed' ? 'bg-emerald-500' :
            step.status === 'running' ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[#2d2e32]',
          )}
        />
        <div className="bg-[#151619] border border-[#2d2e32] p-4 rounded-xl group hover:border-[#424348] transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-medium text-white">{step.phase}</h4>
            <span
              className={cn(
                'text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded',
                step.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                step.status === 'running' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-[#2d2e32] text-[#4a4b50]',
              )}
            >
              {step.status}
            </span>
          </div>
          <p className="text-xs text-[#8E9299]">{step.details}</p>
        </div>
      </motion.div>
    ))}
  </div>
);

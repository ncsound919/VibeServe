/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import type { OpenSourceStat } from '../../types';

interface OpenSourceWidgetProps {
  stats?: OpenSourceStat[];
}

export const OpenSourceWidget = ({ stats = [] }: OpenSourceWidgetProps) => (
  <div className="bg-[#151619] border border-[#2d2e32] p-6 rounded-xl overflow-hidden">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {stats.map((stat, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="text-[#8E9299] text-[10px] font-mono uppercase tracking-widest">{stat.label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-medium text-white">{stat.value}%</span>
            <span className="text-emerald-400 text-[10px] font-mono">+{stat.change}%</span>
          </div>
          <div className="w-full h-1 bg-[#2d2e32] rounded-full mt-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stat.value, 100)}%` }}
              className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

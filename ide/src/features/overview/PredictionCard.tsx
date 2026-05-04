/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PredictionData } from '../../types';

interface PredictionCardProps {
  prediction: PredictionData;
}

export const PredictionCard = ({ prediction }: PredictionCardProps) => (
  <div className="bg-[#1a1b1e]/50 border border-[#2d2e32] p-5 rounded-xl hover:border-emerald-500/30 transition-all group relative overflow-hidden">
    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-125 transition-transform">
      <TrendingUp size={48} className="text-emerald-400" />
    </div>
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-500/10">
        +{prediction.growth}% Growth
      </span>
      <span
        className={cn(
          'text-[10px] font-mono uppercase px-2 py-0.5 rounded border shadow-sm',
          prediction.impact === 'High' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5' :
          prediction.impact === 'Medium' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
          'text-slate-400 border-slate-400/20 bg-slate-400/5',
        )}
      >
        {prediction.impact} Impact
      </span>
    </div>
    <h4 className="text-sm font-medium text-white mb-2 group-hover:text-emerald-100 transition-colors">
      {prediction.category}
    </h4>
    <div className="flex items-end gap-4 mt-auto">
      <div className="flex-1 space-y-1">
        <div className="flex justify-between text-[9px] font-mono text-[#4a4b50] uppercase">
          <span>Signal Reliability</span>
          <span>94.2%</span>
        </div>
        <div className="h-1 bg-[#0a0a0c] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '94.2%' }}
            className="h-full bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
          />
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-[#4a4b50] font-mono uppercase tracking-tighter">Proj. Scale</div>
        <div className="text-lg font-bold text-white tracking-tighter">
          {prediction.predictedValue > 1000
            ? `${(prediction.predictedValue / 1000).toFixed(1)}k`
            : prediction.predictedValue}
        </div>
      </div>
    </div>
  </div>
);
